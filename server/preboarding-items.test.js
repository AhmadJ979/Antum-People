/**
 * P2-2 acceptance criteria — the employee track collects pre-boarding documents.
 *
 * Runs against its own throwaway product database (PRODUCT_DB_PATH is set before db.js is
 * required), never the live one: `cd server && npm test`. Every value below is synthetic.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TEST_DB = path.join(os.tmpdir(), `antum-p2-2-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

const db = require('./db');
const preboarding = require('./preboarding');
const items = require('./preboarding-items');
const privacyNotice = require('./privacy-notice');

const acceptedOffer = (overrides = {}) => ({
  offer_reference: 'OFR-2026-101',
  candidate_name: 'Layla Haddad',
  candidate_email: 'layla.haddad@example.com',
  role: 'Financial Analyst',
  department: 'Finance',
  reporting_line: 'Head of Finance',
  jurisdiction: 'AE',
  start_date: '2026-11-02',
  ...overrides,
});

/** Open a case through the single creation path, exactly as the intake form does. */
const openCase = async (overrides = {}) => {
  const { case: row } = await preboarding.recordOfferAcceptance(acceptedOffer(overrides), {
    actor: 'test-runner',
    source: 'intake_form',
  });
  return row;
};

const countRows = async (table) => {
  const rows = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
  return rows[0].n;
};

/**
 * Record that the privacy notice was shown for one document, the way the route does: a named
 * actor, no version (the module reads it from the notice the server serves).
 */
const showNotice = (caseId, itemKey, recordedBy = 'hr-user', note) =>
  items.recordNoticeAcknowledgement({
    case_id: caseId, item_key: itemKey, recorded_by: recordedBy, note,
  });

after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('P2-2 · the checklist arrives with the case', () => {
  test('an accepted offer seeds the jurisdiction document set, every item not started', async () => {
    const row = await openCase();
    const list = await items.listItems(row.id);

    assert.strictEqual(list.length, items.DOCUMENT_SETS.AE.items.length);
    assert.ok(list.every((item) => item.status === 'not_started'));
    assert.ok(list.every((item) => item.jurisdiction === 'AE'));
    assert.deepStrictEqual(
      list.map((item) => item.item_key),
      items.DOCUMENT_SETS.AE.items.map((item) => item.item_key)
    );
  });

  test('the item set is data, not a hard-coded list in the route', () => {
    assert.ok(items.DOCUMENT_SETS.AE.active, 'the UAE set is the active one');
    assert.strictEqual(items.DOCUMENT_SETS.SA.active, false, 'KSA is kept and switched off');
    assert.ok(items.DOCUMENT_SETS.SA.items.length > 0, 'the KSA set is kept intact to re-enable');
  });

  test('replaying the same accepted offer does not duplicate the checklist', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-102' });
    const before = (await items.listItems(row.id)).length;

    const { created } = await preboarding.recordOfferAcceptance(
      acceptedOffer({ offer_reference: 'OFR-2026-102' }),
      { actor: 'test-runner' }
    );
    assert.strictEqual(created, false);
    assert.strictEqual((await items.listItems(row.id)).length, before);
  });

  test('seeding twice directly is also a no-op', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-103' });
    const before = await countRows('preboarding_items');
    await items.seedItemsForCase(row);
    assert.strictEqual(await countRows('preboarding_items'), before);
  });
});

describe('P2-2 · every item carries an explicit status', () => {
  test('a status outside the four is refused, and the message names them', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-104' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'collected' }),
      (err) => err instanceof items.PreboardingItemError
        && err.status === 400
        && /not_started, requested, received, verified/.test(err.message)
    );
  });

  test('an illegal transition is refused with the status the item is actually in', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-105' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'verified' }),
      (err) => err.status === 409 && /is not_started; it cannot move to verified/.test(err.message)
    );
  });

  test('not started -> requested is allowed and time-stamped', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-106' });
    const item = await items.setItemStatus({
      case_id: row.id, item_key: 'passport', status: 'requested', actor: 'hr-user',
    });
    assert.strictEqual(item.status, 'requested');
    assert.ok(item.requested_at, 'the request is time-stamped');
    assert.strictEqual(item.received_at, null);
    assert.strictEqual(item.last_actor, 'hr-user');
  });

  test('verified is terminal: nothing moves out of it', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-107' });
    await showNotice(row.id, 'passport');
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'received' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'verified' });

    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' }),
      (err) => err.status === 409 && /verified is terminal/.test(err.message)
    );
  });

  test('a rejection sends a received item back to requested and clears the receipt', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-108' });
    await showNotice(row.id, 'emirates_id');
    await items.setItemStatus({ case_id: row.id, item_key: 'emirates_id', status: 'requested' });
    await items.setItemStatus({ case_id: row.id, item_key: 'emirates_id', status: 'received' });

    const back = await items.setItemStatus({
      case_id: row.id, item_key: 'emirates_id', status: 'requested', note: 'unreadable scan',
    });
    assert.strictEqual(back.status, 'requested');
    assert.strictEqual(back.received_at, null);
  });

  test('an unknown item, case or an over-long reference is refused', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-109' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'nope', status: 'requested' }),
      (err) => err.status === 404
    );
    await assert.rejects(
      () => items.setItemStatus({ case_id: randomUUID(), item_key: 'passport', status: 'requested' }),
      (err) => err.status === 404 && /case not found/.test(err.message)
    );
    await assert.rejects(
      () => items.setItemStatus({
        case_id: row.id, item_key: 'passport', status: 'requested',
        document_reference: 'x'.repeat(121),
      }),
      (err) => err.status === 400 && /120 characters/.test(err.message)
    );
  });
});

describe('P2-2 · a document cannot be collected before the privacy notice was shown for it', () => {
  // The instrument is `notice_shown`, and the record is per document: it carries the basis the
  // notice itself assigns that document. The gate is per item too — a case-level flag would open
  // every document on the strength of one.

  test('received is refused with 428 while the notice has not been shown for the item', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-201' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });

    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'received' }),
      (err) => err.status === 428
        && /privacy notice has not been shown for Passport copy/.test(err.message)
    );
    // The refusal left the item where it was: nothing was collected.
    const unchanged = await items.getItem(row.id, 'passport');
    assert.strictEqual(unchanged.status, 'requested');
    assert.strictEqual(unchanged.received_at, null);
  });

  test('verified is gated the same way, not only received', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-202' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'verified' }),
      (err) => err.status === 409 || err.status === 428
    );
  });

  test('the gate is per item: showing the notice for one document does not open another', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-203' });
    await showNotice(row.id, 'passport');

    await items.setItemStatus({ case_id: row.id, item_key: 'bank_details', status: 'requested' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'bank_details', status: 'received' }),
      (err) => err.status === 428 && /has not been shown for Bank details/.test(err.message),
      'a case-level record would have opened this item on the passport\'s strength'
    );

    // …while the document whose notice WAS shown collects normally, and is time-stamped.
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });
    await items.setItemStatus({
      case_id: row.id, item_key: 'passport', status: 'received',
      document_reference: 'passport-scan.pdf',
    });
    const received = await items.getItem(row.id, 'passport');
    assert.strictEqual(received.status, 'received');
    assert.ok(received.received_at);
  });

  test('the record carries the notice\'s own basis per document, its version, and a named actor', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-204' });
    const passport = await showNotice(row.id, 'passport', 'Aisha Al-Mansoori', 'id check at handover');
    const bank = await showNotice(row.id, 'bank_details', 'Aisha Al-Mansoori');
    await showNotice(row.id, 'emirates_id', 'Aisha Al-Mansoori');

    assert.strictEqual(passport.created, true);
    assert.strictEqual(passport.acknowledgement.instrument, 'notice_shown',
      'the instrument says the notice was shown — this record is not a consent record');
    assert.strictEqual(passport.acknowledgement.lawful_basis, 'Legal obligation');
    assert.strictEqual(
      bank.acknowledgement.lawful_basis,
      'Performance of the employment contract / contractual necessity',
      'the basis is the notice\'s per-document value, not one value repeated across the case'
    );
    assert.strictEqual(passport.acknowledgement.recorded_by, 'Aisha Al-Mansoori');
    assert.strictEqual(passport.acknowledgement.item_label, 'Passport copy');
    assert.strictEqual(passport.acknowledgement.jurisdiction, 'AE');
    assert.strictEqual(passport.acknowledgement.method, 'in_product_record',
      'an in-product record, not an e-signature');
    // The version is read from the notice the server serves and is never taken from the caller, so
    // no caller can state a version the hire was never shown.
    assert.strictEqual(passport.acknowledgement.notice_version, privacyNotice.noticeVersion());
    assert.ok(/^v[0-9]/.test(passport.acknowledgement.notice_version));
    assert.strictEqual((await items.listNoticeAcknowledgements(row.id)).length, 3);
  });

  test('an unnamed actor is refused: the record must name who showed the notice', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-205' });
    for (const actor of [undefined, null, '', '   ']) {
      await assert.rejects(
        () => items.recordNoticeAcknowledgement({
          case_id: row.id, item_key: 'passport', recorded_by: actor,
        }),
        (err) => err.status === 400 && /recorded_by is required/.test(err.message),
        `recorded_by=${JSON.stringify(actor)} must not be accepted`
      );
    }
    assert.strictEqual((await items.listNoticeAcknowledgements(row.id)).length, 0,
      'the refusals wrote nothing');
  });

  test('replaying a record changes nothing: the timestamp is the one first written', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-206' });
    const first = await showNotice(row.id, 'passport', 'Aisha Al-Mansoori');
    const replay = await showNotice(row.id, 'passport', 'Someone Else');
    assert.strictEqual(replay.created, false);
    assert.strictEqual(replay.acknowledgement.id, first.acknowledgement.id);
    assert.strictEqual(replay.acknowledgement.recorded_by, 'Aisha Al-Mansoori');
    assert.strictEqual((await items.listNoticeAcknowledgements(row.id)).length, 1);
  });

  test('the two items the notice assigns no basis to cannot be recorded, and name their question', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-207' });
    for (const itemKey of ['education_certificate', 'experience_certificate']) {
      await assert.rejects(
        () => showNotice(row.id, itemKey),
        (err) => err.status === 409
          && /no purpose row for qualifications/.test(err.message)
          && /pending counsel Q1/.test(err.message),
        `${itemKey}: the notice assigns no basis, so no basis may be written for it`
      );
    }
    await assert.rejects(
      () => showNotice(row.id, 'emergency_contact'),
      (err) => err.status === 409
        && /third person/.test(err.message)
        && /pending counsel Q5/.test(err.message),
      "the emergency contact is a third person's data and the notice assigns no basis for it"
    );
    assert.strictEqual((await items.listNoticeAcknowledgements(row.id)).length, 0);
  });

  test('the gate refuses a document the notice assigns no basis to, with its own reason', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-208' });
    // Asking for a document is not collecting it: the gate sits on collection, so this succeeds —
    // which is exactly why the screen has to say the item cannot be collected.
    await items.setItemStatus({
      case_id: row.id, item_key: 'education_certificate', status: 'requested',
    });
    await assert.rejects(
      () => items.setItemStatus({
        case_id: row.id, item_key: 'education_certificate', status: 'received',
      }),
      (err) => err.status === 409 && /cannot be collected in this release/.test(err.message),
      'a 428 would be wrong here: there is nothing HR could show to open this item'
    );
    const still = await items.getItem(row.id, 'education_certificate');
    assert.strictEqual(still.status, 'requested');
  });

  test("the record is per case: one case cannot collect on another case's record", async () => {
    const shown = await openCase({ offer_reference: 'OFR-2026-209' });
    const other = await openCase({ offer_reference: 'OFR-2026-210' });
    await showNotice(shown.id, 'passport');

    await items.setItemStatus({ case_id: other.id, item_key: 'passport', status: 'requested' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: other.id, item_key: 'passport', status: 'received' }),
      (err) => err.status === 428
    );
  });

  test('an unknown case or item is refused before any rule about the notice', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-211' });
    await assert.rejects(
      () => items.recordNoticeAcknowledgement({
        case_id: randomUUID(), item_key: 'passport', recorded_by: 'hr',
      }),
      (err) => err.status === 404 && /case not found/.test(err.message)
    );
    await assert.rejects(
      () => items.recordNoticeAcknowledgement({
        case_id: row.id, item_key: 'nope', recorded_by: 'hr',
      }),
      (err) => err.status === 404
    );
    await assert.rejects(
      () => items.recordNoticeAcknowledgement({ case_id: row.id, recorded_by: 'hr' }),
      (err) => err.status === 400 && /item_key is required/.test(err.message)
    );
  });
});

describe('P2-2 · the KSA set is kept, and switched off', () => {
  test('a KSA case gets the KSA set and cannot move off not started', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-116', jurisdiction: 'SA' });
    const list = await items.listItems(row.id);
    assert.strictEqual(list.length, items.DOCUMENT_SETS.SA.items.length);
    assert.ok(list.every((item) => item.jurisdiction === 'SA'));

    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' }),
      (err) => err.status === 409 && /not active in this release \(UAE-first\)/.test(err.message)
    );
  });
});

describe('P2-2 · HR sees the incomplete items from one list', () => {
  test('the roll-up names each case\'s outstanding items without opening the case', async () => {
    const overview = await items.checklistOverview();

    assert.ok(overview.cases.length >= 1);
    const withOutstanding = overview.cases.find((row) => row.outstanding_count > 0);
    assert.ok(withOutstanding, 'some case still has items outstanding');
    assert.ok(withOutstanding.outstanding.length === withOutstanding.outstanding_count);
    assert.ok(withOutstanding.outstanding.every((item) => typeof item.label === 'string' && item.label.length > 0));
    assert.strictEqual(
      withOutstanding.items_total,
      Object.values(withOutstanding.by_status).reduce((a, b) => a + b, 0),
      'the per-status counts add up to the items on the case'
    );
    assert.strictEqual(typeof withOutstanding.days_to_start, 'number');
    assert.strictEqual(typeof withOutstanding.notice_recorded, 'boolean');
    assert.strictEqual(typeof withOutstanding.notice_version, 'string');
    assert.strictEqual(
      withOutstanding.notice_items_collectible + withOutstanding.notice_items_no_basis,
      withOutstanding.items_total,
      'every employee-track item is either covered by the notice or has no basis at all'
    );
  });

  test('a collected item leaves the outstanding list, and the totals follow', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-117' });
    await showNotice(row.id, 'passport');
    const before = (await items.checklistOverview()).cases.find((c) => c.case_id === row.id);
    assert.strictEqual(before.outstanding_count, before.items_total);

    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'received' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'verified' });

    const after = (await items.checklistOverview()).cases.find((c) => c.case_id === row.id);
    assert.strictEqual(after.outstanding_count, before.outstanding_count - 1);
    assert.strictEqual(after.by_status.verified, 1);
    assert.ok(!after.outstanding.some((item) => item.item_key === 'passport'));
  });

  test('the roll-up filters by jurisdiction and reports the notice gap', async () => {
    const ksa = await items.checklistOverview({ jurisdiction: 'SA' });
    assert.ok(ksa.cases.length >= 1);
    assert.ok(ksa.cases.every((row) => row.jurisdiction === 'SA'));
    assert.ok(ksa.cases.every((row) => row.document_set_active === false));
    assert.strictEqual(ksa.totals.cases, ksa.cases.length);

    const ae = await items.checklistOverview({ jurisdiction: 'AE' });
    assert.ok(ae.cases.every((row) => row.jurisdiction === 'AE'));
    assert.ok(
      ae.totals.cases_notice_not_shown >= 1,
      'cases where the notice has not been shown for a single document are counted'
    );
  });
});

describe('P2-2 · reminders are recorded, not claimed as delivered', () => {
  test('a reminder records what was outstanding, on the in-product channel', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-118' });
    const { reminder, outstanding } = await items.recordReminder({
      case_id: row.id, actor: 'hr-user', note: 'chase before day one',
    });

    assert.strictEqual(reminder.channel, 'in_product');
    assert.strictEqual(reminder.outstanding_count, outstanding.length);
    assert.deepStrictEqual(
      JSON.parse(reminder.outstanding_keys).sort(),
      outstanding.map((item) => item.item_key).sort()
    );
    assert.strictEqual(reminder.created_by, 'hr-user');
  });

  test('a reminder for a case with nothing outstanding is refused', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-119' });
    // Every collectible document goes through the product's own path, notice first.
    for (const item of await items.listItems(row.id)) {
      if (!items.isNoticeCollectible(item.item_key)) continue;
      await showNotice(row.id, item.item_key);
      await items.setItemStatus({ case_id: row.id, item_key: item.item_key, status: 'requested' });
      await items.setItemStatus({ case_id: row.id, item_key: item.item_key, status: 'received' });
    }
    // The items the notice assigns no basis to cannot be collected by ANY path in this release, so
    // this test writes their statuses directly to reach the state it is about — HR with nothing
    // left to chase. The gate that refuses them is the subject of its own test above; invoking it
    // here would only make this test about that one.
    for (const item of await items.listItems(row.id)) {
      if (items.isNoticeCollectible(item.item_key)) continue;
      await db.query(`UPDATE preboarding_items SET status = 'verified'
        WHERE case_id = ${db.escapeString(row.id)} AND item_key = ${db.escapeString(item.item_key)}`);
    }
    assert.strictEqual(
      (await items.checklistOverview()).cases.find((c) => c.case_id === row.id).outstanding_count,
      0,
      'nothing is left outstanding, which is the state the refusal is about'
    );
    await assert.rejects(
      () => items.recordReminder({ case_id: row.id }),
      (err) => err.status === 400 && /nothing to remind about/.test(err.message)
    );
  });

  test('a reminder can be aimed at named items, and an unknown key is refused', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-120' });
    const { outstanding } = await items.recordReminder({
      case_id: row.id, item_keys: ['passport', 'emirates_id'],
    });
    assert.deepStrictEqual(outstanding.map((item) => item.item_key).sort(), ['emirates_id', 'passport']);

    await assert.rejects(
      () => items.recordReminder({ case_id: row.id, item_keys: ['not_a_key'] }),
      (err) => err.status === 404
    );
  });

  test('the last reminder is surfaced on the roll-up row', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-121' });
    await items.recordReminder({ case_id: row.id, actor: 'hr-user' });
    const summary = (await items.checklistOverview()).cases.find((c) => c.case_id === row.id);
    assert.ok(summary.last_reminder_at);
    assert.strictEqual(typeof summary.last_reminder_count, 'number');
  });
});

describe('P2-2 · what the audit trail records, and what it never records', () => {
  test('a status change is audited as keys and statuses only', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-122' });
    await items.setItemStatus({
      case_id: row.id, item_key: 'bank_details', status: 'requested',
      actor: 'hr-user', document_reference: 'iban-letter.pdf',
    });
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'preboarding_item' AND entity_id = ${db.escapeString(row.id)}`
    );
    assert.strictEqual(logs.length, 1);
    const logged = JSON.parse(logs[0].new_values);
    assert.deepStrictEqual(logged, { item_key: 'bank_details', from: 'not_started', to: 'requested' });
    assert.ok(!logs[0].new_values.includes('iban-letter.pdf'), 'the document reference is not logged');
  });

  test('a notice acknowledgement is audited with its basis and version, never its note body', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-216' });
    await items.recordNoticeAcknowledgement({
      case_id: row.id, item_key: 'passport', recorded_by: 'hr-user',
      note: 'shown at the desk; the hire asked about WPS reporting',
    });
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'preboarding_notice_acknowledgement'
        AND entity_id = ${db.escapeString(row.id)}`
    );
    assert.strictEqual(logs.length, 1);
    assert.deepStrictEqual(JSON.parse(logs[0].new_values), {
      item_key: 'passport',
      instrument: 'notice_shown',
      lawful_basis: 'Legal obligation',
      notice_version: privacyNotice.noticeVersion(),
    });
    assert.ok(!logs[0].new_values.includes('WPS'), 'the note body is not logged');
  });

  test('the checklist lives in the product database, and nowhere else', async () => {
    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'preboarding_%' ORDER BY name"
    );
    const names = rows.map((row) => row.name);
    for (const table of ['preboarding_cases', 'preboarding_items', 'preboarding_reminders',
      'preboarding_consents', 'preboarding_notice_acknowledgements']) {
      assert.ok(names.includes(table), `${table} is in the product database`);
    }
  });

  test('one case\'s item status never touches another case', async () => {
    const a = await openCase({ offer_reference: 'OFR-2026-123' });
    const b = await openCase({ offer_reference: 'OFR-2026-124' });
    await items.setItemStatus({ case_id: a.id, item_key: 'passport', status: 'requested' });

    const otherCase = await items.getItem(b.id, 'passport');
    assert.strictEqual(otherCase.status, 'not_started');
  });
});

// ---------------------------------------------------------------------------
// The tile and the list agree on what "open" means (lead's fix, 2026-10-07), and the
// document-byte boundary refuses to store bytes by decision — a reference string only until
// IFZA registration (owner, 2026-10-07) — and the refusal says so (spec §9 D5).
// ---------------------------------------------------------------------------
const documentStore = require('./document-store');

describe('P2-2 · the tile is labelled "Cases open", so the list is asked for open cases', () => {
  test('a closed case is out of the open list and still in the unfiltered one', async () => {
    const closedOne = await openCase({ offer_reference: 'OFR-2026-125' });
    await db.query(
      `UPDATE preboarding_cases SET status = 'closed' WHERE id = ${db.escapeString(closedOne.id)}`
    );

    const { cases: all } = await preboarding.listCases();
    const { cases: open } = await preboarding.listCases({ status: 'open' });

    assert.ok(all.some((row) => row.id === closedOne.id), 'the unfiltered list still carries it');
    assert.ok(!open.some((row) => row.id === closedOne.id), 'the open list does not');
    assert.ok(open.every((row) => row.status === 'open'));

    await db.query(
      `UPDATE preboarding_cases SET status = 'open' WHERE id = ${db.escapeString(closedOne.id)}`
    );
  });

  test('an unknown status is a 400, not a filter that quietly matches nothing', async () => {
    await assert.rejects(
      () => preboarding.listCases({ status: 'archived' }),
      (err) => err instanceof preboarding.OfferAcceptanceError
        && err.status === 400
        && /open, closed/.test(err.message)
    );
  });

  test('jurisdiction and status combine in one query', async () => {
    const { cases: rows } = await preboarding.listCases({ jurisdiction: 'AE', status: 'open' });
    assert.ok(rows.every((row) => row.jurisdiction === 'AE' && row.status === 'open'));
  });

  test('both collection reads are envelopes, and the roll-up keys are pinned', async () => {
    const list = await preboarding.listCases({ jurisdiction: 'AE', status: 'open' });
    const overview = await items.checklistOverview({ jurisdiction: 'AE' });
    assert.deepStrictEqual(Object.keys(list).sort(), ['cases', 'totals']);
    assert.deepStrictEqual(
      Object.keys(overview).sort(),
      ['cases', 'jurisdiction', 'totals'],
      'the roll-up keeps its own jurisdiction echo; the README for row 62d7142b names it as an endpoint-specific extra'
    );
    assert.ok(Array.isArray(overview.cases));
    assert.strictEqual(typeof overview.totals, 'object');
  });
});

describe('P2-2 · no document bytes are stored, and the boundary says why — not that it is undecided', () => {
  test('the store is absent by decision, and every byte path refuses with that reason', async () => {
    assert.strictEqual(
      documentStore.isConfigured(),
      false,
      "the owner's decision (2026-10-07) is a reference string only — no bytes are stored"
    );
    await assert.rejects(
      () => documentStore.saveDocument({ case_id: 'any', item_key: 'passport', bytes: 'x' }),
      (err) => err instanceof documentStore.DocumentStoreNotConfiguredError
        && err.status === 501
        // The refusal must carry the decision and its gate, and must not read as though nobody
        // had ruled yet — that wording is what this test exists to hold down.
        && /reference string/.test(err.message)
        && /2026-10-07/.test(err.message)
        && /IFZA registration/.test(err.message)
        && !/undecided/i.test(err.message)
    );
    await assert.rejects(
      () => documentStore.readDocument(),
      (err) => err.status === 501
        && /reference string/.test(err.message)
        && /IFZA/.test(err.message)
        && !/undecided/i.test(err.message)
    );
  });

  test('an item has a reference, and no column can hold a document body', async () => {
    const columns = (await db.query('PRAGMA table_info(preboarding_items)')).map((c) => c.name);
    assert.ok(columns.includes('document_reference'), 'the reference is where HR names the document');
    for (const forbidden of ['document_bytes', 'document_body', 'file_data', 'content']) {
      assert.ok(!columns.includes(forbidden), `${forbidden} would mean document bytes are stored, which the owner's decision (a reference string only) does not permit`);
    }
  });
});
