/**
 * Reachability — the check this suite was missing.
 *
 * Three defects of one shape were each found here by a *person*, after the fact:
 *   1. the Exit Intelligence Intake modal — no opener (owner decision 16);
 *   2. the employee-record consent instrument — its route has no caller, and every demo value the
 *      tile prints is written by the demo seeder (decision 17);
 *   3. `GET /api/compliance/report` — no client code calls it.
 * The suite missed all three because it tests writers and readers *separately*: a route can have a
 * passing test and no caller; a tile can have a passing test and no writer that runs.
 *
 * This file asserts reachability four ways — route, control, value, registration order — and each
 * register below must match reality EXACTLY: a new orphan fails the build, and a fixed one cannot
 * linger in a register (its entry stops matching and the build fails too). That is deliberate: an
 * inventory nobody has to keep true is a document, not a check.
 *
 * What it cannot see (stated so a green run is not read as more than it is):
 *   - a path composed at runtime, unless the call site is declared in DYNAMIC_SITES;
 *   - a panel hidden by something that is not a boolean (a null selection, an empty list);
 *   - a value that is *measured* rather than stored (nothing checks whether a displayed number is
 *     right, only whether something that runs produces it);
 *   - a control rendered inside a JSX branch that no state can reach.
 * The measurement lives in `server/reachability.js`; `scripts/reachability-report.js` prints the
 * same thing for a person, so the two can never disagree.
 */
const test = require('node:test');
const assert = require('node:assert');
const r = require('./reachability');

/**
 * Routes with no caller anywhere, and no user path to them. Every one of these is a defect to wire
 * or to remove — the register records which decision owns that choice, because "leave it and say
 * so" is only an answer once it is written down (decision 21).
 */
const {
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES, DEAD_END_ITEMS,
} = require('./reachability-register');

/** Locate an anchor by its own text, so an unrelated insertion above it is not a failure. */
function findOne(file, needle) {
  const lines = r.read(`${r.ROOT}/${file}`).split('\n');
  const hits = lines.map((l, i) => ({ line: i + 1, text: l })).filter((x) => x.text.includes(needle));
  assert.strictEqual(hits.length, 1,
    `${file}: expected exactly one line containing ${JSON.stringify(needle)}, found ${hits.length}`);
  return hits[0];
}

function apiRoutes() {
  return r.classify().filter((x) => x.path.startsWith('/api/'));
}

test('the reachability measurement found the routes at all (it cannot pass vacuously)', () => {
  const routes = apiRoutes();
  assert.ok(routes.length >= 20, `expected the API surface, parsed ${routes.length} /api routes`);
  const sites = r.parseCallSites();
  assert.ok(sites.length >= 10, `expected call sites to find, got ${sites.length}`);
});

test('every /api route is reachable from a caller, or registered as callerless with a reason', () => {
  const unregistered = apiRoutes().filter(
    (x) => x.verdict === 'NONE' && !CALLERLESS[`${x.method} ${x.path}`]
  );
  assert.deepStrictEqual(
    unregistered.map((x) => `${x.method} ${x.path} (server/index.js:${x.line})`),
    [],
    'a route with no caller must be wired or removed, or registered in CALLERLESS with a reason'
  );
});

test('the callerless register matches reality — a fixed orphan must leave it', () => {
  const stale = [];
  for (const [key, entry] of Object.entries(CALLERLESS)) {
    const route = apiRoutes().find((x) => `${x.method} ${x.path}` === key);
    if (!route) { stale.push(`${key} — no such route any more`); continue; }
    if (route.verdict !== 'NONE') {
      stale.push(`${key} — now reachable (${route.verdict}), remove its register entry`);
    }
    assert.ok(entry.why && entry.why.length > 40,
      `${key}: the register entry needs a real reason, not a placeholder`);
    assert.ok(entry.owner && /decision \d+/.test(entry.owner),
      `${key}: the register entry must name the decision that owns the fix`);
  }
  assert.deepStrictEqual(stale, []);
});

test('a route reachable only through a runtime-built path is covered by a declared call site', () => {
  const undeclared = [];
  for (const route of apiRoutes()) {
    if (route.verdict !== 'PLAUSIBLE(dynamic)') continue;
    const key = `${route.method} ${route.path}`;
    const declared = DYNAMIC_SITES.some((d) => d.covers.includes(key));
    if (!declared) undeclared.push(key);
  }
  assert.deepStrictEqual(undeclared, [], 'declare the dynamic call site that reaches these, in DYNAMIC_SITES');
});

test('each declared dynamic call site still exists, and still means what it claims', () => {
  for (const d of DYNAMIC_SITES) {
    const found = findOne(d.file, d.expr);
    assert.ok(found.line > 0, `${d.file}: the declared expression is gone`);
    for (const key of d.covers) {
      const [method, ...rest] = key.split(' ');
      const path = rest.join(' ');
      const route = r.parseRoutes().find((x) => x.method === method && x.path === path);
      assert.ok(route, `${d.file} claims to reach ${key}, which is not a registered route`);
    }
  }
});

test('no client call site names a route the product does not register', () => {
  const drift = r.unregisteredCallSites().map((s) => `${s.method} ${s.canon} at ${s.file}:${s.line}`);
  assert.deepStrictEqual(drift, [], 'a call site and the route table have drifted apart');
});

test('no route is registered after the SPA catch-all (it would be dead on arrival)', () => {
  const dead = r.routesAfterCatchAll().map((x) => `${x.method} ${x.path} (index.js:${x.line})`);
  assert.deepStrictEqual(dead, [],
    'the catch-all answers every unknown path, so a route below it can never match');
});

test('every boolean control state can be opened, or is registered as un-openable with a reason', () => {
  const states = r.uiStateReachability();
  assert.ok(states.length >= 5, `expected to find the UI states, found ${states.length}`);
  const unregistered = states
    .filter((s) => !s.openable && !UNOPENABLE_CONTROLS[s.name])
    .map((s) => `${s.name} (App.tsx:${s.line}) — setter never called with true`);
  assert.deepStrictEqual(unregistered, [],
    'a control whose state is never turned on has no opener: wire it, remove it, or register it');
  const stale = Object.entries(UNOPENABLE_CONTROLS)
    .filter(([name]) => {
      const s = states.find((x) => x.name === name);
      return s && s.openable;
    })
    .map(([name]) => name);
  assert.deepStrictEqual(stale, [], 'these are openable now — remove their register entries');
  for (const [name, entry] of Object.entries(UNOPENABLE_CONTROLS)) {
    assert.ok(entry.why && entry.why.length > 40, `${name}: needs a real reason`);
    assert.ok(/decision \d+/.test(entry.owner), `${name}: must name the owning decision`);
    const found = findOne('client/src/App.tsx', entry.declaration);
    assert.ok(found.text.includes(name), `${name}: the declared line is not the state it names`);
  }
});

test('a value a tile displays has a writer in a route a user can reach — or is registered', () => {
  const routes = apiRoutes();
  const routeAt = (file, line) => routes.find((x) => {
    if (file !== 'server/index.js') return false;
    const next = routes.filter((y) => y.line > x.line).sort((a, b) => a.line - b.line)[0];
    return line >= x.line && (!next || line < next.line);
  });
  const withoutReachableWriter = [];
  for (const entry of DISPLAYED_VALUES) {
    const reader = findOne(entry.reader, entry.readerPattern); // the tile is still there to be read
    assert.ok(entry.columns.some((c) => reader.text.includes(c)),
      `${entry.tile}: the reader at ${entry.reader}:${reader.line} no longer reads `
      + `${entry.columns.join(' / ')} — update or drop this entry`);
    const writers = entry.columns.flatMap((c) => r.columnWriters(c));
    const production = writers.filter((w) => w.scope === 'server');
    const reachable = production.filter((w) => {
      const route = routeAt(w.file, w.line);
      return route && route.verdict.startsWith('REACHABLE');
    });
    if (!reachable.length) {
      withoutReachableWriter.push({
        tile: entry.tile,
        productionWriters: production.map((w) => `${w.file}:${w.line}`),
        scriptWriters: writers.filter((w) => w.scope === 'script').map((w) => `${w.file}:${w.line}`),
      });
    }
  }
  // Every displayed value in this state has to be registered, because none of them has a reachable
  // writer. The register is where the defect is written down as a defect, with a decision on it.
  for (const x of withoutReachableWriter) {
    const declared = DISPLAYED_VALUES.find((e) => e.tile === x.tile);
    assert.ok(declared, `unregistered displayed value: ${x.tile}`);
    assert.ok(/decision \d+/.test(declared.owner),
      `${x.tile} shows a value nothing reachable writes, and no decision owns it: `
      + `production writers ${x.productionWriters.join(', ') || 'none'}; `
      + `seeder ${x.scriptWriters.join(', ') || 'none'}`);
  }
  // And the register cannot flatter us: an entry whose value now HAS a reachable writer is stale
  // the moment the fix lands, and this asserts it is removed rather than left looking like a defect.
  const stale = DISPLAYED_VALUES
    .filter((e) => !withoutReachableWriter.some((x) => x.tile === e.tile))
    .map((e) => e.tile);
  assert.deepStrictEqual(stale, [],
    'these displayed values now have a reachable writer — remove their register entries');
});

test('an item the notice assigns no basis to is not offered a move it can never complete', () => {
  const measured = r.deadEndItems();
  const found = measured.items.map((x) => x.item_key).sort();
  const registered = Object.keys(DEAD_END_ITEMS).sort();
  assert.deepStrictEqual(found, registered,
    'the set of items that can be requested and never received must be exactly the registered set: '
    + 'a new no-basis item, a newly unguarded Request control, or a fix that makes one of these '
    + 'collectible all belong in this diff');
  const guard = measured.guard;
  assert.ok(guard.request_line > 0, 'the Request control was not found in client/src/App.tsx');
  assert.strictEqual(guard.request_guarded, false,
    `the Request control at client/src/App.tsx:${guard.request_line} is now guarded — if that is the `
    + 'fix, remove the item from DEAD_END_ITEMS in the same commit');
  assert.strictEqual(guard.receive_guarded, true,
    `Mark received at client/src/App.tsx:${guard.receive_line} no longer checks collectibility, which `
    + 'is the other half of this defect');
  for (const [key, entry] of Object.entries(DEAD_END_ITEMS)) {
    assert.ok(entry.why && entry.why.length > 40, `${key}: needs a real reason, not a placeholder`);
    assert.ok(/counsel|decision \d+/i.test(entry.owner), `${key}: must name who owns the fix`);
  }
  // Nothing may enter this dead end silently: every no-basis item must be one of the registered ones.
  const noBasis = r.parseNoticeBases().filter((x) => !x.collectible).map((x) => x.item_key).sort();
  assert.deepStrictEqual(noBasis, registered,
    'a no-basis item that is not registered here would dead-end the moment someone pressed Request');
});
