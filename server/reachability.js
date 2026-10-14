/**
 * Reachability — "does this control have a path a user can actually take, and is its value
 * produced by something that runs?"
 *
 * Three defects of the same shape have now been found on this product by a *person*, each time
 * after the fact: an intake modal with no opener, a consent instrument whose only writer runs in
 * the demo seeder, and a route no client code calls. The suite missed all three because it tests
 * writers and readers *separately*: a route can have a passing test and no caller, a tile can have
 * a passing test and no writer that runs in production.
 *
 * This module is the measurement those tests were missing. It is deliberately ONE implementation
 * with two consumers: `server/reachability.test.js` asserts against it, and
 * `scripts/reachability-report.js` prints it for a person. What it can and cannot see is stated in
 * each function rather than implied.
 *
 * Limits, stated up front (a check that overstates itself is worse than none):
 *   - Paths are matched statically. A call site that builds its path at runtime is not proven by
 *     equality; it is reported as PLAUSIBLE and must be *declared* in the test's DYNAMIC_SITES.
 *   - The HTTP method is read from the call site's own `method:` (JS) or `-X` (shell); a call site
 *     that states no method is read as GET, which is what `fetch` and curl do by default.
 *   - A segment that is part literal, part template keeps its literal prefix (`workspace${q}` ->
 *     `workspace`). A call site that composes a *middle* segment at runtime would not be matched.
 *   - It reasons about the client's source, not about what a user sees; a control rendered inside
 *     an unreachable branch of JSX is still "called" here.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROUTE_FILE = path.join(ROOT, 'server', 'index.js');
const CLIENT_GLOB_ROOT = path.join(ROOT, 'client', 'src');
const SCAN_ROOTS = [
  { scope: 'client', dir: path.join(ROOT, 'client', 'src') },
  { scope: 'scripts', dir: path.join(ROOT, 'scripts') },
  { scope: 'server-module', dir: path.join(ROOT, 'server') },
];
const EXTS = ['.tsx', '.ts', '.js', '.jsx', '.mjs', '.sh', '.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/**
 * Files whose own subject IS this check. Their route strings are bookkeeping, not callers: the
 * register names `PUT /api/onboarding-tasks/:id` as a route it covers, and a scanner that reads its
 * own bookkeeping as evidence reports drift against itself. (Measured: adding the register module
 * turned three green tests red for exactly this reason.)
 */
const SKIP_FILES = new Set([
  'server/reachability.js',
  'server/reachability-register.js',
  'scripts/reachability-report.js',
  'server/index.js', // route definitions, not calls
]);

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...listFiles(full));
    } else if (EXTS.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Every route the product registers, in file order. */
function parseRoutes(src = read(ROUTE_FILE)) {
  const routes = [];
  src.split('\n').forEach((line, idx) => {
    const m = /^\s*app\.(get|post|put|delete|patch)\(\s*'([^']+)'/.exec(line);
    if (m) routes.push({ method: m[1].toUpperCase(), path: m[2], line: idx + 1 });
  });
  return routes;
}

/**
 * A path reduced to what a router compares: `:param` and `${expr}` are the same thing — one
 * segment, value unknown. A segment that is only partly a template keeps its literal head.
 */
function canonSegment(seg) {
  if (seg.startsWith(':') && seg.length > 1) return '*';
  if (seg.includes('${')) {
    const head = seg.split('${')[0];
    return head || '*';
  }
  return seg;
}

function canonPath(p) {
  const clean = p.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean.split('/').map(canonSegment).join('/');
}

/** Every `/api/...` a non-test file mentions, with the method its own call states. */
function parseCallSites() {
  const sites = [];
  const callRe = /\/api\/[A-Za-z0-9_\-/${}.]*(?=[?'"`\s,)]|$)/g;
  for (const { scope, dir } of SCAN_ROOTS) {
    for (const file of listFiles(dir)) {
      const rel = path.relative(ROOT, file);
      if (file.endsWith('.test.js') || SKIP_FILES.has(rel)) continue;
      const lines = read(file).split('\n');
      const commented = commentLines(lines, path.extname(file));
      lines.forEach((line, idx) => {
        if (commented.has(idx)) return; // a mention in prose is not a caller
        if (/^\s*app\.(get|post|put|delete|patch)\(\s*'/.test(line)) return;
        for (const m of line.matchAll(callRe)) {
          const raw = m[0];
          let method = null;
          for (const probe of lines.slice(idx, idx + 4)) {
            const js = /method:\s*'([A-Za-z]+)'/.exec(probe);
            const sh = /-X\s+([A-Z]+)/.exec(probe);
            if (js) { method = js[1].toUpperCase(); break; }
            if (sh) { method = sh[1].toUpperCase(); break; }
          }
          sites.push({
            file: rel, line: idx + 1, raw, scope,
            method: method || 'GET', stated: Boolean(method),
            canon: canonPath(raw), dynamic: raw.includes('${'),
          });
        }
      });
    }
  }
  return sites;
}

/**
 * Lines that are comments in a JS/TS/SH file. Rationale, measured: `server/preboarding.js` opens
 * with a docblock that *names* `POST /api/preboarding/cases` and `POST /api/employees`, and a
 * scanner that counts those as callers reports a reachability that does not exist. Heuristic and
 * stated as such: it tracks `/* *​/` blocks and skips lines starting with `//`, `*`, `#`, `/*`;
 * a path mentioned in a *trailing* comment on a code line still counts.
 */
function commentLines(lines, ext) {
  const out = new Set();
  let block = false;
  lines.forEach((line, idx) => {
    const t = line.trim();
    const hashComment = (ext === '.sh' || ext === '.html') && t.startsWith('#');
    if (block || hashComment || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) out.add(idx);
    const opens = (line.match(/\/\*/g) || []).length;
    const closes = (line.match(/\*\//g) || []).length;
    if (opens > closes) block = true;
    else if (block && closes > 0) block = false;
  });
  return out;
}

/** A runtime-built call can stand for a literal segment in the route; the method must still agree. */
function shapesOverlap(route, site) {
  if (!site.dynamic || site.method !== route.method) return false;
  const rc = canonPath(route.path).split('/');
  const sc = site.canon.split('/');
  if (rc.length !== sc.length) return false;
  return rc.every((seg, i) => (sc[i] === '*' && seg !== '*') || sc[i] === seg);
}

/**
 * Join the two sides.
 *   REACHABLE(client)   a call site in the product UI names this path and method
 *   REACHABLE(<scopes>) only callers outside the client (scripts, server modules)
 *   PLAUSIBLE(dynamic)  only a call site whose path is built at runtime can cover it
 *   NONE                no caller anywhere — the defect this exists to find
 */
function classify(routes = parseRoutes(), sites = parseCallSites()) {
  return routes.map((route) => {
    const canon = canonPath(route.path);
    const callers = sites.filter((s) => s.canon === canon && s.method === route.method);
    const otherMethod = sites.filter((s) => s.canon === canon && s.method !== route.method);
    const plausible = sites.filter((s) => shapesOverlap(route, s));
    const scopes = [...new Set(callers.map((s) => s.scope))].sort();
    let verdict = 'NONE';
    if (scopes.includes('client')) verdict = 'REACHABLE(client)';
    else if (scopes.length) verdict = `REACHABLE(${scopes.join('+')})`;
    else if (plausible.length) verdict = 'PLAUSIBLE(dynamic)';
    return { ...route, canon, callers, otherMethod, plausible, verdict };
  });
}

/** Call sites naming a path+method the product does not register — a typo, or drift. */
function unregisteredCallSites(routes = parseRoutes(), sites = parseCallSites()) {
  const known = new Set(routes.map((r) => `${r.method} ${canonPath(r.path)}`));
  return sites.filter((s) => !s.dynamic && !known.has(`${s.method} ${s.canon}`));
}

/**
 * A route declared *after* the SPA catch-all is dead on arrival: the catch-all answers every
 * unknown path, so nothing below it can ever match. `server/index.js` already carries a comment
 * warning about this, which means someone hit it; this is the assertion that keeps it fixed.
 */
function routesAfterCatchAll(src = read(ROUTE_FILE)) {
  const lines = src.split('\n');
  const catchAll = lines.findIndex((l) => /^\s*app\.(get|use|all)\(\s*'\*'/.test(l));
  if (catchAll === -1) return [];
  const after = [];
  lines.slice(catchAll + 1).forEach((line, idx) => {
    const m = /^\s*app\.(get|post|put|delete|patch)\(\s*'([^']+)'/.exec(line);
    if (m) after.push({ method: m[1].toUpperCase(), path: m[2], line: catchAll + idx + 2 });
  });
  return after;
}

/**
 * Boolean UI state whose setter is never called with `true` gates a control that can never be
 * opened. Measured on 2026-10-12, this is exactly how the Exit Intelligence Intake modal presents:
 * `setShowExitModal` appears twice, both times with `false`.
 * The honest limit: a panel can also be hidden by a non-boolean (a null `selectedX`, a list
 * length), which this cannot see.
 */
function uiStateReachability(src = read(path.join(CLIENT_GLOB_ROOT, 'App.tsx'))) {
  const lines = src.split('\n');
  const out = [];
  lines.forEach((line, idx) => {
    const m = /const \[(\w+), (\w+)\] = useState(?:<boolean>)?\((false|true)\)/.exec(line);
    if (!m) return;
    const [, name, setter, init] = m;
    const calls = [];
    lines.forEach((l, i) => {
      if (i === idx) return;
      if (new RegExp(`\\b${setter}\\s*\\(`).test(l)) calls.push({ line: i + 1, text: l.trim() });
    });
    const toTrue = calls.filter((c) => new RegExp(`${setter}\\s*\\(\\s*true`).test(c.text));
    const toFalse = calls.filter((c) => new RegExp(`${setter}\\s*\\(\\s*false`).test(c.text));
    out.push({
      name, setter, init, line: idx + 1, calls, toTrue, toFalse,
      openable: init === 'true' || toTrue.length > 0,
    });
  });
  return out;
}

/**
 * Where a column that a *tile* displays is written, and by whom. `scope` is derived from the file,
 * so "the only writer is the demo seeder" is visible as such. This is a text search over the
 * source; it will not see a column written through a dynamically built statement.
 */
function columnWriters(column) {
  const hits = [];
  const writeRe = new RegExp(`(INSERT[^;]*\\b${column}\\b|UPDATE[^;]*SET[^;]*\\b${column}\\b|\\b${column}\\b\\s*=)`, 'i');
  const scan = [...listFiles(path.join(ROOT, 'server')), ...listFiles(path.join(ROOT, 'scripts'))];
  for (const file of scan) {
    const rel = path.relative(ROOT, file);
    const lines = read(file).split('\n');
    lines.forEach((line, idx) => {
      const decl = new RegExp(`\\b${column}\\s*\\b(?:TEXT|INTEGER|REAL|BOOLEAN)`, 'i').test(line)
        || new RegExp(`\\b${column}\\s*[,)]`).test(line) && /CREATE TABLE/i.test(line);
      if (decl) return;
      if (writeRe.test(line)) {
        hits.push({
          file: rel, line: idx + 1, text: line.trim().slice(0, 100),
          scope: rel.startsWith('scripts/') ? 'script' : 'server',
        });
      }
    });
  }
  return hits;
}

/**
 * The statement-level paths that could WRITE `column`: the column list of an INSERT, and any
 * `[...].includes(key)` key whitelist in the route file. Parsed structurally (balanced parens, the
 * quoted keys inside the array), not by counting strings.
 *
 * Why this exists next to `columnWriters` above: that one searches LINE BY LINE for `INSERT …
 * column`, `UPDATE … SET … column` or `column =`, so it cannot see a column named on the
 * continuation line of a multi-line INSERT, nor a key admitted by an array checked with
 * `.includes(key)`. Both remaining writers of the retired consent flag were of exactly those two
 * shapes, which is how a tile's value could be written by two routes while `columnWriters` reported
 * the demo seeder as the only writer.
 */
function columnWritePaths(column) {
  const src = read(ROUTE_FILE);
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const hits = [];
  for (const m of src.matchAll(/INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    const cols = src.slice(open + 1, end).split(',').map((c) => c.trim()).filter(Boolean);
    if (cols.includes(column)) {
      hits.push({ kind: 'insert', what: `INSERT INTO ${m[1]} names it in its column list`, line: lineOf(open) });
    }
  }
  for (const m of src.matchAll(/\[([^\]]*)\]\.includes\(\s*key\s*\)/g)) {
    const keys = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    if (keys.includes(column)) {
      hits.push({ kind: 'whitelist', what: `a key whitelist of ${keys.length} keys admits it`, line: lineOf(m.index) });
    }
  }
  return hits;
}

module.exports = {
  ROOT,
  parseRoutes, parseCallSites, canonPath, classify, unregisteredCallSites,
  routesAfterCatchAll, uiStateReachability, columnWriters, shapesOverlap, listFiles, read,
  parseNoticeBases, requestControlGuard, deadEndItems, routeHasTest, tablesTouchedByRoute,
  columnWritePaths,
};

/**
 * The privacy notice's item table, read as data: which items carry a basis, and which do not.
 * Parsed from `server/preboarding-items.js` so the check cannot drift from the gate it describes.
 */
function parseNoticeBases(src = read(path.join(ROOT, 'server', 'preboarding-items.js'))) {
  const block = /const NOTICE_BASES = \{([\s\S]*?)\n\};/.exec(src);
  if (!block) return [];
  const items = [];
  const re = /(\w+):\s*\{([\s\S]*?)\n\s{2}\},/g;
  for (const m of block[1].matchAll(re)) {
    const body = m[2];
    items.push({
      item_key: m[1],
      collectible: /collectible:\s*true/.test(body),
      pending_counsel: (/pending_counsel:\s*'([^']+)'/.exec(body) || [])[1] || null,
      reason: (/reason:\s*'([^']+)'/.exec(body) || [])[1] || null,
    });
  }
  return items;
}

/**
 * Where the client's Request control is guarded, and where it is not. Measured asymmetry, 2026-10-12:
 * `App.tsx:2115` renders `label="Request"` with no condition, while the `Mark received` button on the
 * next lines carries `disabled={!collectible || !ack}` — so the product offers a move into a state it
 * will not let you leave.
 */
function requestControlGuard(src = read(path.join(CLIENT_GLOB_ROOT, 'App.tsx'))) {
  const lines = src.split('\n');
  const at = lines.findIndex((l) => l.includes('label="Request"'));
  const receiveAt = lines.findIndex((l) => l.includes('label="Mark received"'));
  return {
    request_line: at + 1,
    request_text: at === -1 ? null : lines[at].trim(),
    request_guarded: at === -1 ? null : /collectible|disabled|basis/i.test(lines[at]),
    receive_line: receiveAt + 1,
    receive_text: receiveAt === -1 ? null : lines[receiveAt].trim(),
    receive_guarded: receiveAt === -1 ? null : /collectible/.test(lines[receiveAt]),
  };
}

/**
 * The flow-level defect: an item the notice assigns **no basis** to can still be moved to `requested`
 * (the status guard only fires for `received`/`verified`, `server/preboarding-items.js` collects gate),
 * and from there the product offers no way forward — `Mark received` is disabled by that same missing
 * basis. The item then sits in `requested` forever and counts in `items_outstanding`.
 *
 * This reads the *shape* of the two guards, not their runtime behaviour: the behaviour was measured on
 * a scratch instance and filed beside the inventory. What it guarantees is that the set of items in
 * this dead end is exactly the registered set — a fourth no-basis item, or a newly unguarded Request
 * control, fails the build.
 */
function deadEndItems() {
  const items = parseNoticeBases();
  const guard = requestControlGuard();
  const serverSrc = read(path.join(ROOT, 'server', 'preboarding-items.js'));
  const collectibilityScopedToCollected = /COLLECTED_STATUSES\.indexOf\(status\)/.test(serverSrc);
  const requestedIsUngated = collectibilityScopedToCollected; // the gate names only collected statuses
  const out = [];
  for (const item of items) {
    if (item.collectible) continue;
    if (!requestedIsUngated || guard.request_guarded === false) {
      out.push({ ...item, guard, why: 'offered by the Request control, refused by the collect gate' });
    }
  }
  return { items: out, guard, requestedIsUngated, collectibilityScopedToCollected };
}

/** Whether any test file exercises a route path — "no caller and no test" is a different finding from
 *  "no caller", and the row asked for both. */
function routeHasTest(routePath) {
  const needle = canonPath(routePath).split('/').filter(Boolean).slice(1).join('/');
  const tests = listFiles(path.join(ROOT, 'server')).filter((f) => f.endsWith('.test.js'));
  const hits = [];
  for (const file of tests) {
    const rel = path.relative(ROOT, file);
    read(file).split('\n').forEach((line, i) => {
      if (line.includes(routePath) || (needle && line.includes(needle))) {
        hits.push({ file: rel, line: i + 1 });
      }
    });
  }
  return hits;
}

/** The tables a route's own handler reads or writes, so "who else writes this data" has an answer. */
function tablesTouchedByRoute(routePath, src = read(ROUTE_FILE)) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(`'${routePath}'`));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*app\.(get|post|put|delete|patch)\(\s*'/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start, end).join('\n');
  const tables = new Set();
  for (const m of body.matchAll(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi)) {
    if (!/^(SELECT|VALUES|preboarding_items)$/i.test(m[1])) tables.add(m[1]);
  }
  return [...tables];
}
