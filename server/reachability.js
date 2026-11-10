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
 *   - The HTTP method is read from the call site's own `method:` (JS) or `-X`/`--request` (shell);
 *     a call site that states no method is read as GET, which is what `fetch` and curl do by default.
 *     "The call site's own" means the WHOLE call: in a shell file the verb is looked for anywhere in
 *     the backslash-continued command that carries the path, not only below it (see `shellCommand`).
 *   - A segment that is part literal, part template keeps its literal prefix (`workspace${q}` ->
 *     `workspace`). A call site that composes a *middle* segment at runtime would not be matched.
 *   - It reasons about the client's source, not about what a user sees; a control rendered inside
 *     an unreachable branch of JSX is still "called" here.
 *   - A mention is a CALL SITE only when a request-shaped call is within three lines of it (see
 *     `issuesRequest`) — or, in a shell file, anywhere in the same backslash-continued command, since
 *     the shell joins those physical lines into one command before it runs anything: a comparison, an
 *     object or cache key, a display string or a test fixture is not a caller. Those mentions are
 *     kept in the PROSE bucket and printed, so a mention that stops
 *     counting as a caller is still visible to a reader — that is the price of the role test and it
 *     is paid in public rather than by silence.
 *   - RESIDUAL BLIND SPOTS, stated rather than implied: a path built into a variable one place and
 *     passed to a request somewhere far away; a path with a middle segment composed at runtime; a
 *     helper whose name carries no fetch/request token and was not declared in
 *     `EXTRA_REQUEST_HELPERS`. Each of these would be reported as PROSE, not as a caller, so the
 *     report is where a human sees them — the check does not claim to be exhaustive.
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
const REQUEST_PRIMITIVE = /\b(curl|wget|http\.request|https?\.get|requests\.(?:get|post|put|delete|patch)|fetch\s*\(|axios[\s.(])/;

/**
 * The JS/TS role test — the question the shell scope has always asked, now asked of code too: is this
 * path *issued*, or merely *written down*? A path is a CALL SITE only when a request-shaped call is
 * within three lines of it.
 *
 * Measured reason (2026-10-20, row ff31a942): `panelLabelOf` compared a url against '/api/analytics'
 * to pick a human label. That comparison is not a request, but the scanner read any uncommented
 * `/api/...` in a client file as a caller, so it reddened the merge result of #254 (257/51/256/1) for
 * a route nobody ever fetches. **A string's shape is not the role it plays** — the same defect as
 * 2026-10-19's, one level up.
 *
 * The call shape is matched as a FAMILY, not a roster: any identifier ending in `fetch` or `Request`,
 * plus the `fetch(` / `axios` / `http.<verb>(` primitives. A helper whose name carries no such token
 * goes in `EXTRA_REQUEST_HELPERS`, which an anti-rot test requires to exist in the client tree —
 * a list nobody checks is a guess, and a guess that silently loses callers is worse than a red check.
 */
const EXTRA_REQUEST_HELPERS = [];
const REQUEST_CALL_FAMILY = /(?:\bfetch\s*\(|\baxios[\s.(]|\bhttps?\.(?:get|post|put|patch|delete)\s*\(|\b[A-Za-z_$][\w$]*[Ff]etch\s*\(|\b[A-Za-z_$][\w$]*[Rr]equest\s*\()/;

/** Does `window` (a few lines of source) issue a request in this scope? */
function issuesRequest(scope, window) {
  if (scope === 'scripts') return REQUEST_PRIMITIVE.test(window);
  if (REQUEST_CALL_FAMILY.test(window)) return true;
  return EXTRA_REQUEST_HELPERS.some((h) => new RegExp('\\b' + h + '\\s*\\(').test(window));
}

/** A shell line whose trailing backslash continues the same command onto the next physical line. */
function continuesShellLine(line) {
  return /(^|[^\\])\\\s*$/.test(line); // one trailing backslash; a `\\` ends an escaped backslash
}

/**
 * THE ONE COMMAND a shell line belongs to, as text. The shell joins `\` continuations before it runs
 * anything, so
 *
 *     LOGIN_CODE=$(curl -s --max-time 25 -w '%{http_code}' \
 *       -X POST -H 'Content-Type: application/json' \
 *       --data-binary "{...}" "$PUBLIC/api/login")
 *
 * is ONE command whose verb is stated on a line ABOVE the path.
 *
 * Measured 2026-11-02 (PR #354): the verb search was `lines.slice(idx, idx + 4)` — forward only — so
 * this call was attributed GET, `GET /api/login` is not a registered route, and the reachability gate
 * went red on a correct deploy probe. The role test a few lines up already treated a split call as one
 * call ("a curl invocation split across lines is still one call"); the verb now reads the same bytes
 * the role test reads, so both halves of the scanner answer the same question about the same command.
 *
 * Scope of the rule, measured rather than assumed: no script in this tree states its verb by sending
 * data (`-d`/`--data-binary`/`-F`) without `-X`, so curl's own data-implies-POST default is NOT
 * inferred here — a future call that relies on it is attributed GET, which reddens loudly as an
 * unregistered call site rather than passing quietly.
 */
function shellCommand(lines, idx) {
  let start = idx;
  while (start > 0 && continuesShellLine(lines[start - 1])) start -= 1;
  let end = idx;
  while (end < lines.length - 1 && continuesShellLine(lines[end])) end += 1;
  return { start, end, text: lines.slice(start, end + 1).join('\n') };
}

/** The scope a FILE speaks, which is a property of its language, not only of the root it sits in. */
function scopeOfFile(declaredScope, file) {
  return path.extname(file) === '.sh' ? 'scripts' : declaredScope;
}

/**
 * One scanner, two predicates — because the question is not "does this string appear" but "what is it
 * doing here". An /api path appears in two roles:
 *   - a CALL SITE: a code position that issues a request (fetch/axios/api helper in the client, curl or
 *     wget in a script)
 *   - a QUOTATION: prose, a comment, an echo/print describing what was verified
 * On 2026-10-17 the preflight's own line "the two retired routes answer 404 (...)" counted as a call site
 * and turned the gate red for a non-defect. Nothing was re-added; the sentence was doing its job.
 * Scripts are judged on a request primitive within three lines either way of the mention, because a curl
 * invocation split across lines is still one call. JS/TS keeps the looser treatment: its call idiom
 * varies across this codebase, and narrowing it there would be a guess that silently loses callers.
 * A prose mention is COUNTED and PRINTED, never silently dropped — a check that shrinks quietly prints
 * the same green as one that examined everything.
 */
function scanApiMentions(kind, opts = {}) {
  // `opts.roots` REPLACES the scanned set (the tests point the scanner at a throwaway tree);
  // `opts.extraRoots` ADDS to it (the report script's --extra-root, and the anti-vacuous control
  // reproduced from a shell). They are different questions and must not be one parameter.
  const extra = (opts.extraRoots || []).map((e) => (typeof e === 'string' ? { scope: 'client', dir: e } : e));
  const roots = (opts.roots || SCAN_ROOTS).concat(extra);
  const root = opts.root || ROOT;
  const sites = [];
  const callRe = /\/api\/[A-Za-z0-9_\-/${}.]*(?=[?'"`\s,)]|$)/g;
  for (const { scope, dir } of roots) {
    for (const file of listFiles(dir)) {
      const rel = path.relative(root, file);
      if (file.endsWith('.test.js') || SKIP_FILES.has(rel)) continue;
      const fileScope = scopeOfFile(scope, file);
      const isShell = path.extname(file) === '.sh';
      const lines = read(file).split('\n');
      const commented = commentLines(lines, path.extname(file));
      lines.forEach((line, idx) => {
        if (commented.has(idx)) return; // a mention in prose is not a caller
        if (/^\s*app\.(get|post|put|delete|patch)\(\s*'/.test(line)) return;
        // The bytes that make up ONE call: the whole backslash-continued shell command in a script,
        // or the three-lines-either-way window used everywhere else.
        const command = isShell ? shellCommand(lines, idx) : null;
        for (const m of line.matchAll(callRe)) {
          const raw = m[0];
          // the role test: a path quoted in a shell script issues nothing unless a request primitive is
          // within reach of it. "Within reach" is the three-line window OR the whole backslash-
          // continued command the path sits in — never less than before. The window cannot simply be
          // dropped in favour of the command: `scripts/cors-error-contract-test.sh:207` reaches
          // `$BASE/api/employees` through a local `probe` wrapper whose name carries no request token,
          // and only the neighbouring `curl` line makes it a caller. Nor can the command be ignored:
          // a curl continued over six lines puts its `curl` far more than three lines from the path.
          const window = command
            ? `${command.text}\n${lines.slice(Math.max(0, idx - 3), idx + 4).join('\n')}`
            : lines.slice(Math.max(0, idx - 3), idx + 4).join('\n');
          // One role test for every scope: a mention is a caller only when a request is issued
          // around it. A call split across lines is still one call — and a mention that fails the test
          // is REPORTED as prose, never dropped.
          const issues = issuesRequest(fileScope, window);
          if (kind === 'prose' ? issues : !issues) continue;
          // The verb is stated ONCE, anywhere in the call: `-X POST` on the line above the path is the
          // same statement as `-X POST` beside it (measured 2026-11-02 — see `shellCommand`). It is
          // read from the command, never from the wider role-test window: a neighbouring command's
          // verb is not this call's verb.
          let method = null;
          for (const probe of (command ? [command.text] : lines.slice(idx, idx + 4))) {
            const js = /method:\s*'([A-Za-z]+)'/.exec(probe);
            const sh = /(?:-X|--request)[=\s]+([A-Z]+)/.exec(probe);
            if (js) { method = js[1].toUpperCase(); break; }
            if (sh) { method = sh[1].toUpperCase(); break; }
          }
          sites.push({
            file: rel, line: idx + 1, raw, scope: fileScope,
            method: method || 'GET', stated: Boolean(method),
            canon: canonPath(raw), dynamic: raw.includes('${'),
          });
        }
      });
    }
  }
  return sites;
}

function parseCallSites(opts = {}) {
  return scanApiMentions('calls', opts);
}

/** Paths quoted without issuing a request. Reported, never silently discarded. */
function proseMentions(opts = {}) {
  return scanApiMentions('prose', opts);
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
/**
 * Route matching, not string equality.
 *   A route's ':id' canonicalises to '*'; a caller writes the real value ('demo-emp-sarah'). Equality
 *   can therefore only ever compare two texts that happen to agree character for character — which is
 *   how a genuine caller of GET /api/employees/:id/offboarding was reported as drift on 2026-10-17.
 *   '*' matches exactly one segment on either side, which is what an Express parameter does, and the
 *   segment count must agree, so a wildcard cannot swallow a longer path.
 */
function pathMatches(routeKey, siteKey) {
  const a = routeKey.split('/');
  const b = siteKey.split('/');
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== '*' && b[i] !== '*' && a[i] !== b[i]) return false;
  }
  return true;
}

function unregisteredCallSites(routes = parseRoutes(), sites = parseCallSites()) {
  const canons = routes.map((r) => `${r.method} ${canonPath(r.path)}`);
  return sites.filter((s) => !s.dynamic && !canons.some((c) => pathMatches(c, `${s.method} ${s.canon}`)));
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
 * `setX((o) => !o)` / `setX(o => !o)`: a functional updater that negates the argument it is handed.
 * Read on the text AFTER the setter's opening paren, so the parameter name is taken from the call
 * and the negated name must be the SAME name — `(prev) => !other` is not an opener of this state.
 */
function negatesItsOwnArgument(text, setter) {
  const at = text.indexOf(`${setter}(`);
  if (at === -1) return false;
  const arg = text.slice(at + setter.length + 1);
  const m = /^\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*!\s*([A-Za-z_$][\w$]*)\s*\)/.exec(arg);
  return !!m && m[1] === m[2];
}

/**
 * Boolean UI state with no opener gates a control that can never be opened. Measured on 2026-10-12,
 * this is exactly how the Exit Intelligence Intake modal presents: `setShowExitModal` appears twice,
 * both times with `false`.
 *
 * An opener is one of TWO shapes, and the second one was added on 2026-11-10 because the first
 * alone read a wired control as an orphan:
 *   1. the setter called with `true` — `setX(true)`;
 *   2. the setter called with a functional updater that NEGATES its own argument — `setX((o) => !o)`
 *      or `setX(o => !o)`. From the `false` these states are declared with, that is a transition to
 *      `true`: the click really does open the panel. This is how the escalation records panel's
 *      `Show records` toggle is written (`App.tsx`, #400), and before this shape was read, the
 *      report called that toggle a control nobody can open.
 * The negation must be OF THE ARGUMENT ITSELF: `setX(() => true)` and `setX(prev => !other)` are not
 * counted, because neither is proved to depend on the state's own value.
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
    const toggles = calls.filter((c) => negatesItsOwnArgument(c.text, setter));
    out.push({
      name, setter, init, line: idx + 1, calls, toTrue, toFalse, toggles,
      openable: init === 'true' || toTrue.length > 0 || toggles.length > 0,
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
  EXTRA_REQUEST_HELPERS, issuesRequest,
  parseRoutes, parseCallSites, proseMentions, pathMatches, canonPath, classify, unregisteredCallSites,
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
