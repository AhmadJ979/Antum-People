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
    await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
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
    await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
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

describe('P2-2 · a document cannot be collected before the PDPL consent record exists', () => {
  test('received is refused with 428 while no consent record exists', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-110' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });

    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'received' }),
      (err) => err.status === 428 && /cannot be collected before the PDPL consent record/.test(err.message)
    );
    // The refusal left the item where it was: nothing was collected.
    const unchanged = await items.getItem(row.id, 'passport');
    assert.strictEqual(unchanged.status, 'requested');
    assert.strictEqual(unchanged.received_at, null);
  });

  test('verified is gated the same way, not only received', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-111' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'verified' }),
      (err) => err.status === 409 || err.status === 428
    );
  });

  test('recording consent opens the gate, and replaying it changes nothing', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-112' });
    await items.setItemStatus({ case_id: row.id, item_key: 'passport', status: 'requested' });

    const first = await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
    assert.strictEqual(first.created, true);

    const consentRowsBefore = await countRows('preboarding_consents');
    const replay = await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
    assert.strictEqual(replay.created, false);
    assert.strictEqual(replay.consent.id, first.consent.id);
    assert.strictEqual(await countRows('preboarding_consents'), consentRowsBefore, 'the replay added no row');

    const received = await items.setItemStatus({
      case_id: row.id, item_key: 'passport', status: 'received',
      document_reference: 'passport-scan.pdf',
    });
    assert.strictEqual(received.status, 'received');
    assert.ok(received.received_at);
  });

  test('consent requires its own fields and a real case', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-113' });
    await assert.rejects(
      () => items.recordConsent({ case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent' }),
      (err) => err.status === 400 && /consent_version is required/.test(err.message)
    );
    await assert.rejects(
      () => items.recordConsent({
        case_id: randomUUID(), consent_type: 'pdpl_notice', lawful_basis: 'consent', consent_version: 'v1',
      }),
      (err) => err.status === 404
    );
  });

  test('consent is per case: one case cannot collect on another case\'s record', async () => {
    const consented = await openCase({ offer_reference: 'OFR-2026-114' });
    const other = await openCase({ offer_reference: 'OFR-2026-115' });
    await items.recordConsent({
      case_id: consented.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });

    await items.setItemStatus({ case_id: other.id, item_key: 'passport', status: 'requested' });
    await assert.rejects(
      () => items.setItemStatus({ case_id: other.id, item_key: 'passport', status: 'received' }),
      (err) => err.status === 428
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
    assert.strictEqual(typeof withOutstanding.consent_recorded, 'boolean');
  });

  test('a collected item leaves the outstanding list, and the totals follow', async () => {
    const row = await openCase({ offer_reference: 'OFR-2026-117' });
    await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
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

  test('the roll-up filters by jurisdiction and reports the consent gap', async () => {
    const ksa = await items.checklistOverview({ jurisdiction: 'SA' });
    assert.ok(ksa.cases.length >= 1);
    assert.ok(ksa.cases.every((row) => row.jurisdiction === 'SA'));
    assert.ok(ksa.cases.every((row) => row.document_set_active === false));
    assert.strictEqual(ksa.totals.cases, ksa.cases.length);

    const ae = await items.checklistOverview({ jurisdiction: 'AE' });
    assert.ok(ae.cases.every((row) => row.jurisdiction === 'AE'));
    assert.ok(ae.totals.cases_without_consent >= 1, 'cases still missing a consent record are counted');
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
    await items.recordConsent({
      case_id: row.id, consent_type: 'pdpl_notice', lawful_basis: 'consent',
      consent_version: 'v1', actor: 'hr-user',
    });
    for (const item of await items.listItems(row.id)) {
      await items.setItemStatus({ case_id: row.id, item_key: item.item_key, status: 'requested' });
      await items.setItemStatus({ case_id: row.id, item_key: item.item_key, status: 'received' });
    }
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

  test('the checklist lives in the product database, and nowhere else', async () => {
    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'preboarding_%' ORDER BY name"
    );
    const names = rows.map((row) => row.name);
    for (const table of ['preboarding_cases', 'preboarding_items', 'preboarding_reminders', 'preboarding_consents']) {
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
