// Probes 3: the two refusals the client's own copy refers to, captured verbatim, on a fresh copy of
// the live DB. Requires the item to be in the state where each guard is reachable:
//   state machine -> basis (409) -> notice shown (428).
const fs = require('fs');
const PORT = process.env.PORT || '4744';
const BASE = 'http://localhost:' + PORT;
const OUT = process.env.OUT || '/home/agent-product-designer/rig-final3-out';
const say = (s) => console.log(s);
(async () => {
  const lr = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'scratch-admin', password: process.env.SCRATCH_PASS }) });
  const { token } = await lr.json();
  if (!token) { say('LOGIN FAILED ' + lr.status); process.exit(1); }
  const HJ = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const post = async (p, body) => { const r = await fetch(BASE + p, { method: 'POST', headers: HJ, body: JSON.stringify(body) });
    return { code: r.status, json: await r.json().catch(() => null) }; };
  const get = async (p) => { const r = await fetch(BASE + p, { headers: HJ }); return { code: r.status, json: await r.json().catch(() => null) }; };

  const ov = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  const clear = (ov.json.cases || []).find((c) => c.flag && c.flag.state === 'clear');
  say('tile now: ' + ov.json.totals.cases_notice_not_shown + ' | clear case ' + clear.offer_reference);
  const cid = clear.case_id;

  // the shape the client actually reads for a case
  const cd = await get('/api/preboarding/cases/' + cid);
  fs.writeFileSync(OUT + '/raw/case-GET-' + clear.offer_reference + '.json', JSON.stringify(cd.json, null, 1));
  say('GET /cases/:id keys: ' + Object.keys(cd.json).join(', '));
  say('  summary items_total ' + (cd.json.summary && cd.json.summary.items_total) + ' by_track ' + JSON.stringify(cd.json.summary && cd.json.summary.by_track));
  say('  notice keys: ' + Object.keys(cd.json.notice || {}).join(', ') + '  acked rows ' + ((cd.json.notice || {}).acknowledgements || []).length);
  say('  checklist.items ' + ((cd.json.checklist || {}).items || []).length + '  workspace lines ' + (((cd.json.checklist || {}).workspace || {}).lines || []).length);

  // 1. the no-basis refusal: request first (allowed), then try to receive
  const r1 = await post(`/api/preboarding/cases/${cid}/items/education_certificate/status`, { status: 'requested' });
  say('');
  say('1. request education_certificate (no-basis item) -> HTTP ' + r1.code);
  const r2 = await post(`/api/preboarding/cases/${cid}/items/education_certificate/status`, { status: 'received' });
  say('   then receive -> HTTP ' + r2.code + '  "' + ((r2.json && r2.json.error) || '') + '"');
  const r3 = await post(`/api/preboarding/cases/${cid}/notice-acknowledgements`, { item_key: 'education_certificate' });
  say('   POST notice-acknowledgements on it -> HTTP ' + r3.code + '  "' + ((r3.json && r3.json.error) || '') + '"');
  const ov2 = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  const c2 = ov2.json.cases.find((c) => c.case_id === cid);
  say('   after that request: tile ' + ov2.json.totals.cases_notice_not_shown + ' | items_outstanding ' + ov2.json.totals.items_outstanding
    + ' | this case flag "' + c2.flag.chip + '" open_count ' + c2.flag.open_count);

  // 2. the notice-not-shown refusal: a collectible item, requested, on a case with no ack
  const r4 = await post(`/api/preboarding/cases/${cid}/items/passport/status`, { status: 'requested' });
  const r5 = await post(`/api/preboarding/cases/${cid}/items/passport/status`, { status: 'received' });
  say('');
  say('2. request passport (collectible) -> HTTP ' + r4.code + ' ; then receive with no notice shown -> HTTP ' + r5.code);
  say('   "' + ((r5.json && r5.json.error) || '') + '"');
  const ov3 = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  say('   tile after: ' + ov3.json.totals.cases_notice_not_shown);
})().catch((e) => { say('ERROR ' + e.message); process.exit(1); });
