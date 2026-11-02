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
 *   - a mention is a CALL SITE only when a request-shaped call is within three lines of it (row
 *     ff31a942): a path built into a variable elsewhere, a runtime-composed middle segment, or a
 *     helper whose name carries no fetch/request token would be reported as PROSE, not as a caller.
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
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES, DEAD_END_ITEMS, RETIRED,
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

// ---------------------------------------------------------------------------------------------
// THE CHECK THAT WOULD HAVE CAUGHT A WRONG DECISION NUMBER (added 2026-10-19)
//
// Until now this file asserted `why` by SHAPE only (`entry.why.length > 40`) and the decision by
// PATTERN only (`/decision \d+/`): it required *a* number, never *the right* number. So an entry whose
// prose credited the wrong decision passed the whole suite — which is exactly how
// `server/reachability-register.js`'s consent entry came to say "decision 14" for the decision 17 that
// kept the table, and stayed latent until a reader noticed it (corrected as a one-word delta, #211).
//
// THE RULE: when an entry's prose names exactly ONE decision number, it must be the number in that
// entry's own `decision`/`owner` field. A prose with no number is fine — most entries have none. A
// prose naming TWO OR MORE distinct numbers is ambiguous by construction and is NAMED AND SKIPPED, not
// silently tolerated: the last test in this file prints every entry the rule did not decide, because a
// check that quietly shrinks prints the same green.
const decisionNumbersIn = (text) =>
  [...String(text || '').matchAll(/decision\s+(\d+)/gi)].map((m) => m[1]);
const WHY_DECISION_SKIPS = [];
function assertWhyNamesTheSameDecision(label, why, field) {
  const inWhy = [...new Set(decisionNumbersIn(why))];
  const inField = [...new Set(decisionNumbersIn(field))];
  if (inWhy.length === 0 || inField.length === 0) {
    WHY_DECISION_SKIPS.push(`${label} — nothing to compare (prose: ${inWhy.join(',') || 'no number'}; field: ${inField.join(',') || 'no number'})`);
    return;
  }
  if (inWhy.length > 1) {
    WHY_DECISION_SKIPS.push(`${label} — prose names decisions ${inWhy.join(' and ')}: ambiguous, not compared`);
    return;
  }
  assert.strictEqual(inWhy[0], inField[0],
    `${label}: the prose credits decision ${inWhy[0]} but its own field says decision ${inField[0]} — `
    + 'one of the two is wrong, and before 2026-10-19 this suite could not see it (it required a '
    + 'number, not the right one)');
}

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
  assertWhyNamesTheSameDecision(key, entry.why, entry.owner);
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
/**
 * The other half of a register. The registers above say "we know about this defect and it is still
 * there"; this one says "we removed this, and here is the proof it has not come back". Both halves
 * are needed on this product: a retired thing has already been re-acquired here once (the tracker's
 * standing test stopped being a line inside an unrelated merge, invisible to ancestry and blob
 * checks alike), and a removal that lives only in a memory or a commit message is not a check.
 *
 * Measured 2026-10-13, owner decisions 21 and 17 executed: `GET /api/employees/:id`,
 * `GET /api/compliance/report` and `POST /api/compliance/consent` are gone, the employee-record
 * consent tile is retired, and the seeder no longer writes the flag. Every entry is re-measured
 * here against the tree that would merge.
 */
test('a retired element stays retired — the removal is re-measured, not remembered', () => {
  const routes = apiRoutes();
  const routeKeys = Object.keys(RETIRED.routes);
  assert.ok(routeKeys.length >= 3, `the retired-route register lost entries: ${routeKeys.length}`);
  for (const [key, entry] of Object.entries(RETIRED.routes)) {
    const back = routes.find((x) => `${x.method} ${x.path}` === key);
    assert.ok(!back,
      `${key} is registered again (server/index.js:${back && back.line}) — a retired route that `
      + 'answers is the defect returning: remove it, or re-decide the retirement and delete its '
      + 'RETIRED entry');
    assert.ok(/decision \d+/.test(entry.decision), `${key}: must name the decision that removed it`);
    assert.ok(entry.why && entry.why.length > 40, `${key}: needs the reason it went`);
    assertWhyNamesTheSameDecision(key, entry.why, entry.decision);
  }
  const anchors = RETIRED.sourceAnchors;
  assert.ok(anchors.length >= 3, `the retired-source register lost entries: ${anchors.length}`);
  for (const a of anchors) {
    const found = r.read(`${r.ROOT}/${a.file}`).split('\n')
      .map((text, i) => ({ line: i + 1, text }))
      .filter((x) => x.text.includes(a.absent));
    assert.deepStrictEqual(found.map((x) => `${a.file}:${x.line}`), [],
      `${a.what} is back in ${a.file} — the string ${JSON.stringify(a.absent)} is the retired `
      + 'instrument returning; if it is intended, the retirement itself needs re-deciding first');
    assert.ok(/decision \d+/.test(a.decision), `${a.what}: must name the decision`);
      assertWhyNamesTheSameDecision(a.what, a.why, a.decision);
  }
});
/**
 * A retired instrument with live write paths is not retired. Decision 17 was executed as "retire the
 * instrument, keep the subject"; the flag's two remaining writers — a key admitted by the PUT
 * whitelist, and a column named on the continuation line of the create-INSERT — were invisible to
 * `columnWriters` (line-by-line text search), so they are checked structurally here. The column
 * itself STAYS with its DEFAULT 0: decision 17's scope is enumerated-first, not dropped.
 */
test('the retired consent flag has no write path left, and its column stays', () => {
  const paths = r.columnWritePaths('consent_granted');
  assert.deepStrictEqual(
    paths.map((p) => `${p.what} (server/index.js:${p.line})`),
    [],
    'a write path names the retired consent flag again — either remove it, or re-decide the '
    + 'retirement and delete this assertion deliberately'
  );
  assert.match(
    r.read(`${r.ROOT}/server/schema.sql`),
    /consent_granted\s+INTEGER\s+DEFAULT\s+0/i,
    'the column was dropped: decision 17 keeps it (enumerated first, recommended later) — dropping '
    + 'it is a separate decision, not a tidy-up'
  );
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
  assertWhyNamesTheSameDecision(name, entry.why, entry.owner);
    assert.ok(/decision \d+/.test(entry.owner), `${name}: must name the owning decision`);
    const found = findOne('client/src/App.tsx', entry.declaration);
    assert.ok(found.text.includes(name), `${name}: the declared line is not the state it names`);
  }
});

test('a value a tile displays has a writer in a route a user can reach — or is registered', () => {
  // -------------------------------------------------------------
  // THIS GUARD USED TO BE VACUOUS, AND THAT IS HOW THE PROBATION GAP SAT GREEN (2026-11-02).
  //
  // The measurement below runs over `DISPLAYED_VALUES`. The register was EMPTY — its own comment said
  // "a displayed value with no reachable writer that is NOT written down still fails the test above",
  // which was false: with nothing in the list, the loop ran zero times and the test passed. So the
  // one value in the product whose only writer was the demo seeder — `probation_end_date`, the column
  // the whole Probation timelines panel is derived from — was never looked at.
  //
  // Two things are fixed here, and both are load-bearing:
  //   1. an EMPTY register FAILS, so the list cannot quietly go back to measuring nothing;
  //   2. an entry can say `writer: 'required'` — a value the product MUST be able to produce — and the
  //      guard then reddens if that write path disappears. The old register could only ever record a
  //      defect, never hold a fix in place.
  // -------------------------------------------------------------
  assert.ok(DISPLAYED_VALUES.length > 0,
    'the displayed-value register is EMPTY, so this guard is measuring nothing: it iterates the '
    + 'register, and an empty register passes whatever the tree does. Register the values a tile draws '
    + '(with `writer: required` for one the product must produce, `writer: missing` for a recorded '
    + 'defect), or this test is a vacuous pass — which is exactly how probation_end_date stayed green.');

  const routes = apiRoutes();
  const routeAt = (file, line) => routes.find((x) => {
    if (file !== 'server/index.js') return false;
    const next = routes.filter((y) => y.line > x.line).sort((a, b) => a.line - b.line)[0];
    return line >= x.line && (!next || line < next.line);
  });

  /**
   * Every place `column` can be written, as a STATEMENT rather than a line. `columnWriters` searches
   * line by line, so it cannot see a column named on the continuation line of a multi-line INSERT nor
   * a key admitted by a PUT whitelist array — and those are the two shapes the employee write path
   * uses. `columnWritePaths` parses both structurally. Both are asked, and the union is de-duplicated
   * by file:line so one statement is not counted twice.
   */
  const writersOf = (column) => {
    const statements = r.columnWritePaths(column)
      .map((p) => ({ file: 'server/index.js', line: p.line, text: p.what, scope: 'server' }));
    const seen = new Set();
    return [...r.columnWriters(column), ...statements].filter((w) => {
      const key = `${w.file}:${w.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Measure every registered value once, and keep the measurement: the assertions below are about the
  // same numbers, so a reader cannot be told two different things by two passes over the tree.
  const measured = DISPLAYED_VALUES.map((entry) => {
    assert.ok(['required', 'missing'].includes(entry.writer),
      `${entry.tile}: writer must be 'required' (the product must produce it) or 'missing' (a recorded `
      + `defect), got ${JSON.stringify(entry.writer)}`);
    const reader = findOne(entry.reader, entry.readerPattern); // the read that produces it is still there
    assert.ok(entry.columns.some((c) => reader.text.includes(c)),
      `${entry.tile}: the reader at ${entry.reader}:${reader.line} no longer reads `
      + `${entry.columns.join(' / ')} — update or drop this entry`);
    if (entry.panel) findOne(entry.panel.file, entry.panel.anchor); // and the tile is still on the screen
    const writers = entry.columns.flatMap(writersOf);
    const production = writers.filter((w) => w.scope === 'server');
    const reachable = production.filter((w) => {
      const route = routeAt(w.file, w.line);
      return route && route.verdict.startsWith('REACHABLE');
    });
    return {
      tile: entry.tile,
      writer: entry.writer,
      entry,
      productionWriters: production.map((w) => `${w.file}:${w.line}`),
      scriptWriters: writers.filter((w) => w.scope === 'script').map((w) => `${w.file}:${w.line}`),
      reachableWriters: reachable.map((w) => `${w.file}:${w.line}`),
    };
  });

  // `required`: the value must be produced by something a user can reach. This is the half that holds
  // the fix in place — delete the write path and this reddens, which the old guard could not do.
  const missingWriter = measured.filter((x) => x.writer === 'required' && x.reachableWriters.length === 0)
    .map((x) => ({
      tile: x.tile,
      productionWriters: x.productionWriters,
      seederWriters: x.scriptWriters,
    }));
  assert.deepStrictEqual(missingWriter, [],
    'a displayed value marked `writer: required` has NO writer in a route a user can reach — the tile '
    + 'is drawing something the product cannot produce, and the only writer is the demo seeder: '
    + JSON.stringify(missingWriter));

  // `missing`: a recorded defect. Every one of these must be written down with the decision that owns it.
  const withoutReachableWriter = measured.filter((x) => x.reachableWriters.length === 0);
  for (const x of withoutReachableWriter) {
    const declared = DISPLAYED_VALUES.find((e) => e.tile === x.tile);
    assert.ok(declared, `unregistered displayed value: ${x.tile}`);
    assert.ok(/decision \d+/.test(declared.owner),
      `${x.tile} shows a value nothing reachable writes, and no decision owns it: `
      + `production writers ${x.productionWriters.join(', ') || 'none'}; `
      + `seeder ${x.scriptWriters.join(', ') || 'none'}`);
  }
  // And the register cannot flatter us: a RECORDED DEFECT whose value now HAS a reachable writer is
  // stale the moment the fix lands, and this asserts it is removed rather than left looking like a
  // defect. An entry marked `required` is the opposite question and is answered above.
  const stale = measured
    .filter((x) => x.writer !== 'required' && x.reachableWriters.length > 0)
    .map((x) => x.tile);
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
    assertWhyNamesTheSameDecision(key, entry.why, entry.owner);
    assert.ok(/counsel|decision \d+/i.test(entry.owner), `${key}: must name who owns the fix`);
  }
  // Nothing may enter this dead end silently: every no-basis item must be one of the registered ones.
  const noBasis = r.parseNoticeBases().filter((x) => !x.collectible).map((x) => x.item_key).sort();
  assert.deepStrictEqual(noBasis, registered,
    'a no-basis item that is not registered here would dead-end the moment someone pressed Request');
});

test('the why/decision agreement rule names what it did not cover', () => {
  // A check that silently shrinks prints the same green, so the run states the size of the hole and
  // every entry inside it. If this list grows, read it — it is the part of the register the new rule
  // does not decide.
  console.log(`  [why/decision] entries not decided by the rule: ${WHY_DECISION_SKIPS.length}`);
  for (const line of WHY_DECISION_SKIPS) console.log(`    - ${line}`);
});

/* ------------------------------------------------------------------------------------------------
 * Row ff31a942 — the role test: a path's SHAPE is not the role it plays.
 *
 * The scanner used to count any uncommented `/api/...` in a client file as a CALL SITE. #254's merge
 * result was therefore RED (257/51/256/1) because `panelLabelOf` compared a url against
 * '/api/analytics' to choose a human label — a string nobody ever fetches. The client side was fixed
 * (PR #256) and this check was NOT weakened to make it green; the check's own defect is fixed here.
 *
 * Every probe below runs against a throwaway tree in the OS temp directory, so no deliberately broken
 * call site is ever written into the product, and nothing this file does can leak into a scan of it.
 * ---------------------------------------------------------------------------------------------- */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Point the scanner at a throwaway tree for the duration of one assertion. */
function withProbeTree(files, fn, scope = 'client') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reachability-role-'));
  try {
    for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), src);
    return fn({ roots: [{ scope, dir }], root: dir }, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the role test: a comparison, a map key and a cache key are not call sites', () => {
  withProbeTree({
    'labelling.js': [
      "const PANELS = { '/api/analytics/dashboard': 'figures' };",
      'export function labelOf(url) {',
      "  if (url.indexOf('/api/analytics') !== -1) return 'the dashboard figures';",
      "  return 'that';",
      '}',
      "const cacheKey = '/api/employees?jurisdiction=AE';",
    ].join('\n'),
  }, (opts) => {
    assert.deepStrictEqual(r.parseCallSites(opts), [], 'none of these three issues a request');
    const prose = r.proseMentions(opts).map((p) => p.raw);
    assert.ok(prose.includes('/api/analytics'), 'the comparison is REPORTED as prose, not dropped');
    assert.ok(prose.includes('/api/employees'), 'and so is the cache key — a mention never vanishes');
  });
});

test('the role test: a request-shaped call is a call site, whatever wraps it', () => {
  withProbeTree({
    'calls.js': [
      'const a = authedFetch(`/api/employees?jurisdiction=AE`);',
      "fetch('/api/analytics/dashboard');",
      "apiRequest('/api/compliance/report', { method: 'POST' });",
      '  const t = await',
      "    authedFetch('/api/preboarding/cases');",
    ].join('\n'),
  }, (opts) => {
    const sites = r.parseCallSites(opts);
    assert.deepStrictEqual(sites.map((s) => s.raw).sort(), [
      '/api/analytics/dashboard', '/api/compliance/report', '/api/employees', '/api/preboarding/cases',
    ], 'a client helper, fetch(, a request-named helper and a split call are all callers');
    assert.strictEqual(sites.find((s) => s.raw === '/api/compliance/report').method, 'POST');
  });
});

test('ANTI-VACUOUS CONTROL: a planted caller to an unregistered route still reddens the drift check', () => {
  withProbeTree({
    'planted.js': "authedFetch('/api/definitely-not-registered');",
  }, (opts) => {
    const drift = r.unregisteredCallSites(r.parseRoutes(), r.parseCallSites(opts))
      .map((s) => `${s.method} ${s.canon}`);
    assert.deepStrictEqual(drift, ['GET /api/definitely-not-registered'],
      'without this, "no drift" could mean "the check sees nothing" rather than "nothing is wrong"');
  });
});

/* ------------------------------------------------------------------------------------------------
 * THE SHELL'S OWN RULE: a `\` continuation is ONE command (measured 2026-11-02, PR #354).
 *
 * The scanner counts `scripts/*.sh` call sites on purpose — `SCAN_ROOTS` carries a `scripts` scope
 * and `issuesRequest` has a shell branch whose comment says "a curl invocation split across lines is
 * still one call". The role test honoured that sentence; the VERB did not: it searched only FORWARD
 * from the path (`lines.slice(idx, idx + 4)`), so a `-X POST` on the line above the URL was invisible
 * and the call was attributed GET. `GET /api/login` is not a registered route, so a correct deploy
 * probe was reported as drift and the gate went red.
 *
 * The rule these tests hold: the shell joins `\` continuations before it runs anything, so one
 * command is one call — its verb may be stated anywhere inside it, and a verb from a NEIGHBOURING
 * command is never borrowed. Both directions matter: reading only the path's own line loses the
 * verb, and widening the verb search to the neighbourhood invents one.
 * ---------------------------------------------------------------------------------------------- */

test('a shell call split across `\\` continuations is ONE call, and its verb is the one it states', () => {
  withProbeTree({
    'probe.sh': [
      'LOGIN_CODE=$(curl -s --noproxy \'*\' -w \'%{http_code}\' \\',
      "  -X POST -H 'Content-Type: application/json' \\",
      '  --data-binary "{}" "$PUBLIC/api/login")',
    ].join('\n'),
  }, (opts) => {
    const sites = r.parseCallSites(opts);
    assert.strictEqual(sites.length, 1, 'the three physical lines are one call, not three mentions');
    assert.strictEqual(sites[0].method, 'POST',
      'the verb is stated on a line ABOVE the path — a forward-only search reads GET and invents drift');
    assert.strictEqual(sites[0].stated, true, 'and it is read as STATED, not defaulted');
    assert.strictEqual(sites[0].scope, 'scripts',
      'a .sh file speaks shell wherever it sits — the language decides the role test, not the root');
  });
});

test('a curl continued over more than three lines is still one call', () => {
  withProbeTree({
    'long.sh': [
      'code=$(curl -s --noproxy \'*\' \\',
      '  --max-time 25 \\',
      '  -o /tmp/out \\',
      '  -w \'%{http_code}\' \\',
      '  -H \'Accept: application/json\' \\',
      '  "$PUBLIC/api/preboarding/checklist/overview")',
    ].join('\n'),
  }, (opts) => {
    const sites = r.parseCallSites(opts);
    assert.strictEqual(sites.length, 1,
      '`curl` is six lines above the path: a three-line proximity window would file this as prose');
    assert.strictEqual(sites[0].method, 'GET', 'and it states no verb, which is curl\'s GET');
  });
});

test('a verb is never borrowed from a neighbouring command', () => {
  withProbeTree({
    'two.sh': [
      'curl -s -X POST "$PUBLIC/api/employees" > /dev/null',
      'curl -s "$PUBLIC/api/preboarding/checklist/overview" > /dev/null',
    ].join('\n'),
  }, (opts) => {
    const sites = r.parseCallSites(opts);
    const second = sites.find((s) => s.raw === '/api/preboarding/checklist/overview');
    assert.ok(second, 'the second command is a caller');
    assert.strictEqual(second.method, 'GET',
      'it states no verb of its own — the POST on the line above belongs to a different command');
    assert.strictEqual(sites.find((s) => s.raw === '/api/employees').method, 'POST');
  });
});

test('ANTI-VACUOUS CONTROL: a shell script calling an unregistered route still reddens the drift check', () => {
  withProbeTree({
    'planted.sh': [
      'code=$(curl -s -w \'%{http_code}\' \\',
      '  -X DELETE \\',
      '  "$PUBLIC/api/definitely-not-registered")',
    ].join('\n'),
  }, (opts) => {
    const drift = r.unregisteredCallSites(r.parseRoutes(), r.parseCallSites(opts))
      .map((s) => `${s.method} ${s.canon}`);
    assert.deepStrictEqual(drift, ['DELETE /api/definitely-not-registered'],
      'a .sh caller is not exempt: the deploy harness cannot hide a route nobody registers');
  });
});

test('a script caller does not upgrade a route to REACHABLE(client): a probe cannot launder reachability', () => {
  withProbeTree({
    'only.sh': 'curl -s "$PUBLIC/api/employees" > /dev/null',
  }, (opts) => {
    const rows = r.classify([{ method: 'GET', path: '/api/employees', line: 1 }], r.parseCallSites(opts));
    assert.strictEqual(rows[0].verdict, 'REACHABLE(scripts)',
      'a maintenance script is not a user path, and the verdict says which scope reached it');
  });
});

test('REGRESSION (#254): the label map that reddened that merge result is not a call site', () => {
  withProbeTree({
    'panelResults.js': [
      'export function panelLabelOf(url) {',
      "  if (typeof url !== 'string') return 'that';",
      "  if (url.indexOf('/api/analytics') !== -1) return 'the dashboard figures';",
      "  if (url.indexOf('/api/employees/') !== -1) return 'the onboarding tasks';",
      "  return 'that';",
      '}',
    ].join('\n'),
  }, (opts) => {
    const drift = r.unregisteredCallSites(r.parseRoutes(), r.parseCallSites(opts));
    assert.deepStrictEqual(drift.map((s) => `${s.method} ${s.canon}`), [],
      'the exact code that reddened 23989a0 must not be read as a route nobody fetches');
  });
});

test('the role test did not silence the real client callers', () => {
  // The anti-vacuous guard for the change itself: no false positives bought with false negatives.
  // Measured on the product tree at this commit: 38 call sites before and after, the same set.
  const sites = r.parseCallSites();
  assert.ok(sites.length >= 30, `call sites found: ${sites.length} — the role test must not empty this set`);
  assert.ok(sites.some((s) => s.file.endsWith('App.tsx')), 'the client helper calls must still count');
  console.log(`  [role test] call sites: ${sites.length}, prose mentions: ${r.proseMentions().length}`);
});

test('every declared extra request helper exists in the client tree', () => {
  // A roster nobody checks is a guess. While EXTRA_REQUEST_HELPERS is empty this assertion is
  // vacuous BY DESIGN, and the family rule carries the client — which the test above measures.
  const clientFiles = r.listFiles(path.join(r.ROOT, 'client', 'src'));
  assert.ok(clientFiles.length > 0, 'the client tree must be readable for this to mean anything');
  for (const helper of r.EXTRA_REQUEST_HELPERS) {
    assert.ok(clientFiles.some((f) => fs.readFileSync(f, 'utf8').includes(`${helper}(`)),
      `${helper} is declared in EXTRA_REQUEST_HELPERS but appears nowhere in client/src`);
  }
});
