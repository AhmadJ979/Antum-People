#!/usr/bin/env node
/**
 * Reachability, printed for a person.
 *
 * `server/reachability.test.js` asserts; this prints. Both read the same measurement
 * (`server/reachability.js`) and the same registers (`server/reachability-register.js`), so the two
 * cannot disagree about what is reachable.
 *
 * The four categories the plan and the tracker quote — CALLERLESS / UNOPENABLE_CONTROLS /
 * DISPLAYED_VALUES / DEAD_END_ITEMS — are summarised at the top, counted from the register module's
 * own exports. Until 2026-10-14 `DEAD_END_ITEMS` was imported by nothing but the test, so the
 * four-count line could not be reproduced from any single command: the count was quoted without a run.
 *
 * The summary is checked in BOTH directions against the register module's actual exports: a declared
 * category the register no longer exports fails, and an export this file does not declare fails.
 * A report that can quietly drop a category is the defect — worse than one that omits a line — so the
 * check runs before anything else is printed and refuses rather than summarising what it cannot read.
 *
 * Run: `node scripts/reachability-report.js`   (exit 0 = nothing new, exit 1 = a NEW un-operable
 * element exists that no decision owns — the same condition the test fails on)
 */
const r = require('../server/reachability');
const register = require('../server/reachability-register');
const {
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES, DEAD_END_ITEMS, RETIRED,
} = register;

/**
 * Every export of the register, declared here as either a DEFECT CATEGORY (a count in the summary the
 * plan and the tracker quote) or an INFORMATIONAL register (printed, not counted). Set equality
 * between this table and `Object.keys(register)` is asserted below, so neither side can drift alone.
 *
 * Keep the DEFECT rows in the order the summary is quoted in (CALLERLESS, UNOPENABLE_CONTROLS,
 * DISPLAYED_VALUES, DEAD_END_ITEMS) — the JSON line below is emitted in this order.
 */
const DECLARED = [
  ['CALLERLESS', 'defect', 'routes registered in server/index.js that nothing calls'],
  ['UNOPENABLE_CONTROLS', 'defect', 'boolean UI state whose setter is never called with true'],
  ['DISPLAYED_VALUES', 'defect', 'a tile whose value no production path writes'],
  ['DEAD_END_ITEMS', 'defect', 'an item offered a move the collect gate then refuses'],
  ['DYNAMIC_SITES', 'informational', 'call sites whose path is built at runtime'],
  ['RETIRED', 'informational', 'elements a decision removed, re-measured'],
];
const DEFECT_CATEGORIES = DECLARED.filter(([, kind]) => kind === 'defect').map(([name]) => name);
const size = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length);
const registeredIds = (v) => (Array.isArray(v)
  ? v.map((e) => e.tile || e.item_key || e.key || JSON.stringify(e))
  : Object.keys(v));

const key = (x) => `${x.method} ${x.path}`;
/**
 * Findings, as a SET of identifications rather than a running count: the summary and the sections
 * below look at the same elements, and a counter that adds once in each place reports one orphan
 * route as two findings. The closing line counts elements, so the same element carries the same id
 * wherever it is noticed. (Same rule the rest of this repository works by: a number is measured, and
 * a number that overstates is a false artifact.)
 */
const findings = new Set();

function rule(title, sub) {
  console.log(`\n${'='.repeat(78)}\n${title}`);
  if (sub) console.log(sub);
  console.log('='.repeat(78));
}

// ---- the summary can only be printed if this report recognises the register it was pointed at ----
const missing = DECLARED.map(([name]) => name).filter((name) => !(name in register));
const undeclared = Object.keys(register)
  .filter((name) => !DECLARED.some(([declared]) => declared === name));
if (missing.length || undeclared.length) {
  rule('REGISTER SUMMARY — REFUSED', 'this report does not recognise the register it was handed');
  for (const name of missing) {
    console.log(`  MISSING    ${name} — declared in this report, not exported by`
      + ' server/reachability-register.js');
  }
  for (const name of undeclared) {
    console.log(`  UNDECLARED ${name} — exported by the register, not covered by this report's summary`);
  }
  console.log('\n  Refusing to print a summary that would silently omit a category.');
  console.log('  Fix: update DECLARED (scripts/reachability-report.js) in the SAME commit as the register');
  console.log('  change, so the four-count line stays a measurement rather than a memory.');
  process.exit(1);
}

// ---- the measurements, taken once and used by both the summary and the sections below ----
const routes = r.classify().filter((x) => x.path.startsWith('/api/'));
const states = r.uiStateReachability();
const deadEnds = r.deadEndItems();

/**
 * What "measured" means per category — the same sets `server/reachability.test.js` asserts on, so a
 * register entry reality no longer supports shows up here as well as there. `DISPLAYED_VALUES` has no
 * entry here on purpose: its set is "a tile whose value no production writer in a reachable route
 * writes", a rule that lives in the test, and re-deriving it in a second place is how two readers of
 * one measurement start disagreeing. Below, that category says so instead of implying a re-run.
 */
const MEASURED = {
  CALLERLESS: new Set(routes.filter((x) => x.verdict === 'NONE').map(key)),
  UNOPENABLE_CONTROLS: new Set(states.filter((s) => !s.openable).map((s) => s.name)),
  DEAD_END_ITEMS: new Set(deadEnds.items.map((x) => x.item_key)),
};
/** The id an element carries wherever this report notices it — so one element is one finding. */
const FINDING_ID = {
  CALLERLESS: (x, stale) => (stale ? 'callerless-stale:' : 'callerless:') + x,
  UNOPENABLE_CONTROLS: (x, stale) => (stale ? 'unopenable-stale:' : 'unopenable:') + x,
  DEAD_END_ITEMS: (x, stale) => (stale ? 'deadend-stale:' : 'deadend:') + x,
  DISPLAYED_VALUES: (x, stale) => (stale ? 'displayed-stale:' : 'displayed:') + x,
};

rule('REGISTER SUMMARY', 'the four categories the plan and the tracker quote, counted from the register');
const counts = {};
for (const [name, kind, what] of DECLARED) {
  const value = register[name];
  if (kind !== 'defect') continue;
  counts[name] = size(value);
  console.log(`\n  ${name.padEnd(20)} ${String(counts[name]).padStart(2)}   ${what}`);
  const measured = MEASURED[name];
  if (!measured) {
    console.log(`    measured: not re-derived here — the test measures this set (its rule: a production`
      + ' writer inside a REACHABLE route), this report prints the entries');
    continue;
  }
  const registered = new Set(registeredIds(value));
  const onlyRegistered = [...registered].filter((x) => !measured.has(x));
  const onlyMeasured = [...measured].filter((x) => !registered.has(x));
  const agrees = !onlyRegistered.length && !onlyMeasured.length;
  console.log(`    measured: ${measured.size} — ${agrees ? 'agrees with the register' : 'DISAGREES'}`);
  for (const x of onlyRegistered) {
    console.log(`      registered but not measured: ${x} — the measurement does not see it:`
      + ' a stale register entry, or the measurement is wrong');
    findings.add(FINDING_ID[name](x, true));
  }
  for (const x of onlyMeasured) {
    console.log(`      measured but not registered: ${x} — found just now, no decision owns it`);
    findings.add(FINDING_ID[name](x, false));
  }
}
console.log(`\n  raw: ${JSON.stringify(counts)}`);
console.log(`  (the registers that are NOT in those four counts:`
  + ` ${DECLARED.filter(([, kind]) => kind !== 'defect').map(([name]) => name).join(', ')})`);

rule('ROUTE REACHABILITY', 'every route registered in server/index.js, and what can reach it');
for (const x of routes) {
  const who = x.callers.length
    ? x.callers.slice(0, 2).map((c) => `${c.file}:${c.line}`).join(', ')
    : (x.plausible.length ? `dynamic: ${x.plausible[0].file}:${x.plausible[0].line}` : '—');
  const flag = x.verdict === 'NONE' ? (CALLERLESS[key(x)] ? '[known]' : '[NEW]') : '       ';
  console.log(`  ${flag} ${x.verdict.padEnd(18)} ${key(x).padEnd(52)} ${who}`);
  if (x.verdict === 'NONE' && !CALLERLESS[key(x)]) findings.add(FINDING_ID.CALLERLESS(key(x), false));
}
console.log(`  (${routes.length} routes; non-/api handlers such as the SPA catch-all are out of scope)`);

rule('ROUTES WITH NO CALLER', 'a defect to wire or to remove — "leave it and say so" must be written down');
const none = routes.filter((x) => x.verdict === 'NONE');
if (!none.length) console.log('  none');
for (const x of none) {
  const reg = CALLERLESS[key(x)];
  console.log(`\n  ${key(x)}  (server/index.js:${x.line})`);
  if (reg) {
    console.log(`    registered: yes — ${reg.owner}`);
    console.log(`    ${reg.why.replace(/\s+/g, ' ')}`);
  } else {
    console.log('    registered: NO — this one was found just now, and no decision owns it');
  }
}
const stale = Object.keys(CALLERLESS).filter((k) => {
  const route = routes.find((x) => key(x) === k);
  return !route || route.verdict !== 'NONE';
});
if (stale.length) {
  console.log(`\n  STALE register entries (now reachable or gone — remove them): ${stale.join(', ')}`);
  for (const k of stale) findings.add(FINDING_ID.CALLERLESS(k, true));
}

rule('CONTROLS THAT CANNOT BE OPENED', 'boolean UI state whose setter is never called with true');
for (const s of states) {
  if (s.openable) continue;
  const reg = UNOPENABLE_CONTROLS[s.name];
  console.log(`  ${reg ? '[known]' : '[NEW]  '} ${s.name} (client/src/App.tsx:${s.line})`
    + ` — setter called ${s.calls.length}x, never with true`);
  if (reg) console.log(`          ${reg.owner}`);
  else findings.add(FINDING_ID.UNOPENABLE_CONTROLS(s.name, false));
}
console.log(`  (${states.length - states.filter((s) => !s.openable).length} of ${states.length} boolean states are openable)`);

rule('ITEMS OFFERED A MOVE THEY CAN NEVER COMPLETE',
  'a no-basis item can be pressed to `requested`, and the collect gate refuses every step after it');
for (const [item, entry] of Object.entries(DEAD_END_ITEMS)) {
  const measured = deadEnds.items.find((x) => x.item_key === item);
  console.log(`\n  ${measured ? '[measured]' : '[registered, NOT measured]'} ${item}`);
  console.log(`    ${entry.why.replace(/\s+/g, ' ')}`);
  console.log(`    owner: ${entry.owner}`);
}
const guard = deadEnds.guard;
console.log(`\n  Request control (client/src/App.tsx:${guard.request_line}): `
  + `${guard.request_guarded ? 'guarded' : 'NOT guarded — it offers a move the product then refuses'}`);
console.log(`  Mark received (client/src/App.tsx:${guard.receive_line}): `
  + `disabled unless collectible: ${guard.receive_guarded}`);
console.log(`  collect gate fires only for collected statuses`
  + ` (COLLECTED_STATUSES.indexOf(status)): ${deadEnds.collectibilityScopedToCollected}`);

rule('VALUES A TILE DISPLAYS', 'does anything that RUNS IN PRODUCTION write it?');
for (const entry of DISPLAYED_VALUES) {
  const lines = r.read(`${r.ROOT}/${entry.reader}`).split('\n');
  const at = lines.findIndex((l) => l.includes(entry.readerPattern)) + 1;
  const writers = [];
  for (const w of entry.columns.flatMap((c) => r.columnWriters(c))) {
    if (!writers.some((x) => x.file === w.file && x.line === w.line)) writers.push(w);
  }
  console.log(`\n  ${entry.tile}`);
  console.log(`    read at ${entry.reader}:${at} (${entry.columns.join(', ')})`);
  for (const w of writers) console.log(`    written: ${w.scope.padEnd(7)} ${w.file}:${w.line}`);
  console.log(`    ${entry.owner}`);
}
if (!DISPLAYED_VALUES.length) {
  console.log('  none — no tile in the product displays a value nothing reachable writes.');
}
rule('RETIRED ELEMENTS', 'removals, re-measured: a retired route that answers again is a finding');
for (const [k, entry] of Object.entries(RETIRED.routes)) {
  const back = routes.find((x) => key(x) === k);
  console.log(`  ${back ? '[BACK]' : '[gone]'} ${k.padEnd(40)} ${entry.decision}`
    + ` — removed ${entry.removed}`);
  if (back) {
    console.log(`         registered again at server/index.js:${back.line}`);
    findings.add(`retired-route:${k}`);
  }
}
for (const a of RETIRED.sourceAnchors) {
  const lines = r.read(`${r.ROOT}/${a.file}`).split('\n')
    .map((text, i) => ({ line: i + 1, text }))
    .filter((x) => x.text.includes(a.absent));
  console.log(`  ${lines.length ? '[BACK]' : '[gone]'} ${a.file.padEnd(24)} ${a.decision}`
    + ` — ${a.what}`);
  for (const x of lines) {
    console.log(`         ${a.file}:${x.line} contains ${JSON.stringify(a.absent)}`);
    findings.add(`retired-anchor:${a.file}:${x.line}`);
  }
}

rule('RETIRED COLUMNS', 'a retired instrument must not keep a write path (decision 17 fence)');
for (const col of ['consent_granted', 'consent_date']) {
  const paths = r.columnWritePaths(col);
  console.log(`  ${paths.length ? '[WRITABLE]' : '[fenced]'} ${col}`);
  for (const p of paths) {
    console.log(`         ${p.what} (server/index.js:${p.line})`);
    findings.add(`column-write:${col}:${p.line}`);
  }
}
rule('DECLARED DYNAMIC CALL SITES', 'paths built at runtime — equality cannot prove these, so they are declared');
for (const d of DYNAMIC_SITES) {
  const lines = r.read(`${r.ROOT}/${d.file}`).split('\n');
  const line = lines.findIndex((l) => l.includes(d.expr)) + 1;
  console.log(`  ${d.file}:${line}  ${d.expr}`);
  console.log(`    covers: ${d.covers.join(', ')}`);
}

rule('REGISTRATION ORDER', 'a route declared after the SPA catch-all is dead on arrival');
const dead = r.routesAfterCatchAll();
console.log(dead.length ? dead.map((x) => `  ${key(x)} (index.js:${x.line})`).join('\n') : '  none');
for (const x of dead) findings.add(`after-catchall:${key(x)}`);

rule('CLIENT CALLS THAT NAME NO ROUTE', 'drift between the client and the route table');
const drift = r.unregisteredCallSites();
console.log(drift.length
  ? drift.map((s) => `  ${s.method} ${s.canon} at ${s.file}:${s.line}`).join('\n')
  : '  none');
for (const s of drift) findings.add(`drift:${s.method} ${s.canon} at ${s.file}:${s.line}`);
const prose = r.proseMentions();
if (prose.length) {
  console.log(`  (${prose.length} quoted mention(s) NOT counted as callers — a path in prose issues no request: ` +
    prose.map((s) => `${s.file}:${s.line}`).join(', ') + ')');
}

const newFindings = findings.size;
console.log(`\n${newFindings === 0
  ? 'Nothing new: every un-operable element on this product is registered with an owner.'
  : `${newFindings} NEW finding(s) — wire it, remove it, or register it with the decision that owns it.`}`);
console.log(`Summary of the four counted categories: ${JSON.stringify(counts)}`);
process.exit(newFindings === 0 ? 0 : 1);
