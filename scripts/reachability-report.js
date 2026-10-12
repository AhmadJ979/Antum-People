#!/usr/bin/env node
/**
 * Reachability, printed for a person.
 *
 * `server/reachability.test.js` asserts; this prints. Both read the same measurement
 * (`server/reachability.js`) and the same registers (`server/reachability-register.js`), so the two
 * cannot disagree about what is reachable.
 *
 * Run: `node scripts/reachability-report.js`   (exit 0 = nothing new, exit 1 = a NEW un-operable
 * element exists that no decision owns — the same condition the test fails on)
 */
const r = require('../server/reachability');
const {
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES,
} = require('../server/reachability-register');

const key = (x) => `${x.method} ${x.path}`;
let newFindings = 0;

function rule(title, sub) {
  console.log(`\n${'='.repeat(78)}\n${title}`);
  if (sub) console.log(sub);
  console.log('='.repeat(78));
}

rule('ROUTE REACHABILITY', 'every route registered in server/index.js, and what can reach it');
const routes = r.classify().filter((x) => x.path.startsWith('/api/'));
for (const x of routes) {
  const who = x.callers.length
    ? x.callers.slice(0, 2).map((c) => `${c.file}:${c.line}`).join(', ')
    : (x.plausible.length ? `dynamic: ${x.plausible[0].file}:${x.plausible[0].line}` : '—');
  const flag = x.verdict === 'NONE' ? (CALLERLESS[key(x)] ? '[known]' : '[NEW]') : '       ';
  console.log(`  ${flag} ${x.verdict.padEnd(18)} ${key(x).padEnd(52)} ${who}`);
  if (x.verdict === 'NONE' && !CALLERLESS[key(x)]) newFindings += 1;
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
  newFindings += stale.length;
}

rule('CONTROLS THAT CANNOT BE OPENED', 'boolean UI state whose setter is never called with true');
const states = r.uiStateReachability();
for (const s of states) {
  if (s.openable) continue;
  const reg = UNOPENABLE_CONTROLS[s.name];
  console.log(`  ${reg ? '[known]' : '[NEW]  '} ${s.name} (client/src/App.tsx:${s.line})`
    + ` — setter called ${s.calls.length}x, never with true`);
  if (reg) console.log(`          ${reg.owner}`);
  else newFindings += 1;
}
console.log(`  (${states.length - states.filter((s) => !s.openable).length} of ${states.length} boolean states are openable)`);

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
newFindings += dead.length;

rule('CLIENT CALLS THAT NAME NO ROUTE', 'drift between the client and the route table');
const drift = r.unregisteredCallSites();
console.log(drift.length
  ? drift.map((s) => `  ${s.method} ${s.canon} at ${s.file}:${s.line}`).join('\n')
  : '  none');
newFindings += drift.length;

console.log(`\n${newFindings === 0
  ? 'Nothing new: every un-operable element on this product is registered with an owner.'
  : `${newFindings} NEW finding(s) — wire it, remove it, or register it with the decision that owns it.`}`);
process.exit(newFindings === 0 ? 0 : 1);
