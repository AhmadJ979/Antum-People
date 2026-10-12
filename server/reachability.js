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

module.exports = {
  ROOT,
  parseRoutes, parseCallSites, canonPath, classify, unregisteredCallSites,
  routesAfterCatchAll, uiStateReachability, columnWriters, shapesOverlap, listFiles, read,
};
