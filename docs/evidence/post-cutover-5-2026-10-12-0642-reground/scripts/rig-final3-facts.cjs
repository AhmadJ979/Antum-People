// Facts for the post-cutover re-grounding (row 2740fb30): the live demo state, read off the served
// tree on a rig holding a copy of the live DB — plus every refusal the notice-shown gate can produce,
// captured verbatim, and the live acknowledgement action (record on the clear case, watch the count fall).
const fs = require('fs');
const PORT = process.env.PORT || '4744';
const BASE = 'http://localhost:' + PORT;
const OUT = process.env.OUT || '/home/agent-product-designer/rig-final3-out';
const out = [];
const say = (s) => { out.push(s); console.log(s); };
const save = (name, o) => fs.writeFileSync(OUT + '/raw/' + name, typeof o === 'string' ? o : JSON.stringify(o, null, 1));

(async () => {
  const lr = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'scratch-admin', password: process.env.SCRATCH_PASS })
  });
  const { token } = await lr.json();
  if (!token) { say('LOGIN FAILED ' + lr.status); process.exit(1); }
  const H = { Authorization: 'Bearer ' + token };
  const HJ = { ...H, 'Content-Type': 'application/json' };
  say('login: 200, token length ' + token.length);

  const get = async (p) => { const r = await fetch(BASE + p, { headers: H }); return { code: r.status, json: await r.json().catch(() => null) }; };
  const post = async (p, body) => {
    const r = await fetch(BASE + p, { method: 'POST', headers: HJ, body: JSON.stringify(body) });
    return { code: r.status, json: await r.json().catch(() => null) };
  };

  // ---- 1. the roll-up, as the client reads it
  const ov = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  save('overview-AE.json', ov.json);
  say('');
  say('== 1. ROLL-UP (GET /api/preboarding/checklist/overview?jurisdiction=AE)  HTTP ' + ov.code);
  say('totals: ' + JSON.stringify(ov.json.totals));
  for (const c of ov.json.cases || []) {
    const items = c.items || [];
    const open = items.filter((i) => i.status !== 'received' && i.status !== 'verified').length;
    say(`  ${c.offer_reference} start ${c.start_date} flag ${c.flag && c.flag.state} | chip "${c.flag && c.flag.chip}"`
      + ` | items open ${open} | notice_recorded ${c.notice_recorded} acked-items ${c.notice_items_acknowledged} no-basis ${c.notice_items_no_basis}`
      + ` | ws lines ${(c.workspace && c.workspace.lines_total) !== undefined ? c.workspace.lines_total : 'n/a'}`);
  }

  // ---- 2. per-case detail: the item-level record (basis / actor / version)
  const cases = ov.json.cases || [];
  for (const c of cases) {
    const d = await get('/api/preboarding/cases/' + c.case_id);
    save('case-' + c.offer_reference + '.json', d.json);
    const items = (d.json.items || []);
    say('');
    say('== 2. CASE ' + c.offer_reference + '  (' + c.start_date + ')  HTTP ' + d.code);
    say('   acknowledgement summary: ' + JSON.stringify(d.json.acknowledgements_summary || d.json.summary || null));
    for (const i of items.filter((x) => (x.track || 'employee') === 'employee')) {
      const a = i.notice_acknowledgement || i.acknowledgement || null;
      say(`   item ${i.item_key} status=${i.status} basis=${a ? a.lawful_basis : '-'} actor=${a ? a.recorded_by : '-'}`
        + ` version=${a ? a.notice_version : '-'} at=${a ? a.acknowledged_at : '-'} | label "${i.item_label || i.label}"`);
    }
  }

  // ---- 3. every refusal the gate can give, verbatim (on the CLEAR case, where nothing is shown)
  const clearCase = cases.find((c) => (c.flag && c.flag.state) === 'clear') || cases[cases.length - 1];
  const cd = await get('/api/preboarding/cases/' + clearCase.case_id);
  const empItems = (cd.json.items || []).filter((i) => (i.track || 'employee') === 'employee');
  say('');
  say('== 3. REFUSALS, verbatim, on ' + clearCase.offer_reference + ' (state ' + (clearCase.flag && clearCase.flag.state) + ')');
  for (const i of empItems) {
    const r = await post(`/api/preboarding/cases/${clearCase.case_id}/items/${i.item_key}/status`, { status: 'received', actor: 'admin' });
    say(`   receive ${i.item_key.padEnd(24)} -> HTTP ${r.code}  "${(r.json && r.json.error) || ''}"`);
  }
  const un = await post(`/api/preboarding/cases/${clearCase.case_id}/notice-acknowledgements`, { item_key: 'passport' });
  say(`   notice-shown, unnamed actor -> HTTP ${un.code}  "${(un.json && un.json.error) || ''}"`);
  const nb = await post(`/api/preboarding/cases/${clearCase.case_id}/notice-acknowledgements`, { item_key: 'qualification_certificate_1', recorded_by: 'admin' });
  say(`   notice-shown, no-basis item -> HTTP ${nb.code}  "${(nb.json && nb.json.error) || ''}"`);

  // ---- 4. the live action: record the notice as shown, watch the derived count fall
  const ack = await post(`/api/preboarding/cases/${clearCase.case_id}/notice-acknowledgements`, { item_key: 'passport', recorded_by: 'admin' });
  save('ack-write-response.json', ack.json || { code: ack.code });
  say('');
  say('== 4. THE LIVE ACTION on ' + clearCase.offer_reference + ': POST notice-acknowledgements {item_key: passport, recorded_by: admin} -> HTTP ' + ack.code);
  say('   record: ' + JSON.stringify(ack.json && (ack.json.acknowledgement || ack.json)));
  const ov2 = await get('/api/preboarding/checklist/overview?jurisdiction=AE');
  save('overview-AE-after-ack.json', ov2.json);
  say('   cases_notice_not_shown before: ' + ov.json.totals.cases_notice_not_shown + '  after: ' + ov2.json.totals.cases_notice_not_shown);
  for (const c of ov2.json.cases || []) {
    say(`   ${c.offer_reference} notice_recorded ${c.notice_recorded} acked-items ${c.notice_items_acknowledged} no-basis ${c.notice_items_no_basis}`);
  }
  // the item that could not be collected before, now gated only by the other items
  const after = await post(`/api/preboarding/cases/${clearCase.case_id}/items/passport/status`, { status: 'received', actor: 'admin' });
  say('   after the record, receiving passport -> HTTP ' + after.code + '  "' + ((after.json && after.json.error) || 'accepted') + '"');
})().catch((e) => { say('ERROR ' + e.message); process.exit(1); });
