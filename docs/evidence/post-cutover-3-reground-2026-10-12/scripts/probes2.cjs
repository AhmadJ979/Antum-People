// Probes for the interface review (row 2740fb30): the exact refusal a user meets, whether the
// "Request" control on a no-basis item leads anywhere, and where the recorded actor comes from.
const fs = require('fs');
const PORT = process.env.PORT || '4744';
const BASE = 'http://localhost:' + PORT;
const OUT = process.env.OUT || '/home/agent-product-designer/rig-final3-out';
const say = (s) => console.log(s);
(async () => {
  const lr = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'scratch-admin', password: process.env.SCRATCH_PASS })
  });
  const { token } = await lr.json();
  if (!token) { say('LOGIN FAILED ' + lr.status); process.exit(1); }
  const HJ = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const post = async (p, body) => { const r = await fetch(BASE + p, { method: 'POST', headers: HJ, body: JSON.stringify(body) });
    return { code: r.status, json: await r.json().catch(() => null) }; };
  const get = async (p) => { const r = await fetch(BASE + p, { headers: HJ }); return { code: r.status, json: await r.json().catch(() => null) }; };

  const ov = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  fs.writeFileSync(OUT + '/raw/overview-AE-pristine.json', JSON.stringify(ov.json, null, 1));
  const clear = (ov.json.cases || []).find((c) => c.flag && c.flag.state === 'clear');
  const acked = (ov.json.cases || []).find((c) => c.flag && c.flag.state === 'started');
  say('pristine tile: cases_notice_not_shown = ' + ov.json.totals.cases_notice_not_shown + '  (cases ' + ov.json.totals.cases + ')');
  say('clear case ' + clear.offer_reference + '  acked case ' + acked.offer_reference);
  say('');

  // A. the receive refusal on a no-basis item, and on a collectible item with no notice shown
  const probes = [
    ['clear', clear.case_id, 'education_certificate', 'receive a qualification certificate'],
    ['clear', clear.case_id, 'emergency_contact', 'receive the emergency contact'],
    ['clear', clear.case_id, 'bank_details', 'receive bank details with no notice shown'],
  ];
  for (const [, id, key, what] of probes) {
    const r = await post(`/api/preboarding/cases/${id}/items/${key}/status`, { status: 'received' });
    say(`A. ${what}  (${key})  -> HTTP ${r.code}  "${(r.json && r.json.error) || ''}"`);
  }
  say('');

  // B. does the "Request" control on a no-basis item lead anywhere? (the client enables it: no disabled prop)
  const req = await post(`/api/preboarding/cases/${clear.case_id}/items/education_certificate/status`, { status: 'requested' });
  say(`B. REQUEST a no-basis item (education_certificate -> requested) -> HTTP ${req.code}  "${(req.json && req.json.error) || 'ACCEPTED'}"`);
  const cd = await get('/api/preboarding/cases/' + clear.case_id);
  fs.writeFileSync(OUT + '/raw/case-clear-after-request.json', JSON.stringify(cd.json, null, 1));
  const ei = (cd.json.items || []).find((i) => i.item_key === 'education_certificate');
  say('   after the request, that item\'s status is: ' + (ei ? ei.status : 'not in payload'));
  const ov2 = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  say('   tile after the request: ' + ov2.json.totals.cases_notice_not_shown
    + '  | ' + clear.offer_reference + ' flag ' + (ov2.json.cases.find((c) => c.case_id === clear.case_id).flag.chip));
  say('');

  // C. where does the recorded actor come from? body says 'Someone Else', session says scratch-admin
  const w = await post(`/api/preboarding/cases/${clear.case_id}/notice-acknowledgements`, { item_key: 'bank_details', recorded_by: 'Someone Else' });
  const rec = w.json && w.json.acknowledgements && w.json.acknowledgements[0];
  say(`C. record with body recorded_by='Someone Else' -> HTTP ${w.code}; the row's recorded_by is "${rec && rec.recorded_by}"`);
  say('   full row: ' + JSON.stringify(rec));
  say('');

  // D. the whole-case record (no item_key): what the button does
  const all = await post(`/api/preboarding/cases/${clear.case_id}/notice-acknowledgements`, {});
  say(`D. Record for the whole case (no item_key) -> HTTP ${all.code}  created ${all.json && all.json.created} of ${all.json && all.json.considered}`
    + ` | version ${all.json && all.json.notice_version}`);
  const ov3 = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  say('   tile after: ' + ov3.json.totals.cases_notice_not_shown);
  for (const c of ov3.json.cases) say(`   ${c.offer_reference} notice_recorded ${c.notice_recorded} acked ${c.notice_items_acknowledged}/${c.notice_items_collectible} no-basis ${c.notice_items_no_basis}`);
})().catch((e) => { say('ERROR ' + e.message); process.exit(1); });
