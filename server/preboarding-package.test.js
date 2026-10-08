/**
 * P2-3 acceptance criteria — the pre-reading package and its acknowledgement record.
 *
 * Runs against its own throwaway product database (PRODUCT_DB_PATH is set before db.js is
 * required), never the live one: `cd server && npm test`. Every value below is synthetic.
 *
 * The point of this file is the refusal path. "Nothing is ever shown as acknowledged unless the
 * acknowledgement record exists" is not a UI convention here, so most of these tests call the
 * module directly — the way a hand-written API call would — and assert that it refuses.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const TEST_DB = path.join(os.tmpdir(), `antum-p2-3-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;
const db = require('./db');
const preboarding = require('./preboarding');
const pkg = require('./preboarding-package');

const acceptedOffer = (overrides = {}) => ({
  offer_reference: `OFR-2026-${Math.floor(Math.random() * 900) + 100}`,
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
after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('P2-3 · the package is one list, derived from the case', () => {
  test('nine items, from one server-side list, with the JD and the NDA as the two required', () => {
    assert.strictEqual(pkg.PRE_READING_ITEMS.length, 9);
    assert.deepStrictEqual(pkg.requiredItemKeys('AE'), ['signed_jd', 'nda']);
    assert.deepStrictEqual(
      pkg.PRE_READING_ITEMS.map((item) => item.label),
      [
        'Signed job description (JD)', 'Organisation chart', 'Reporting line', 'Team members',
        'Non-disclosure agreement (NDA)', 'Employee handbook', 'Company policies',
        'Code of conduct', 'Dress code',
      ]
    );
  });

  test('the set is jurisdiction-aware: UAE is worked, KSA is kept and switched off', () => {
    assert.strictEqual(pkg.isPackageSetActive('AE'), true);
    assert.strictEqual(pkg.isPackageSetActive('SA'), false);
    assert.strictEqual(pkg.PRE_READING_SETS.SA.label, 'KSA pre-reading package');
    // The same nine items in both sets: kept, not re-invented.
    assert.deepStrictEqual(
      pkg.packageItems('SA').map((item) => item.item_key),
      pkg.packageItems('AE').map((item) => item.item_key)
    );
  });

  test('a pre-reading item is not a document-set item: the two lists stay separate', () => {
    const items = require('./preboarding-items');
    const docKeys = items.documentSetItems('AE').map((item) => item.item_key);
    for (const item of pkg.PRE_READING_ITEMS) {
      assert.ok(!docKeys.includes(item.item_key), `${item.item_key} must not be in the document set`);
    }
  });
});

describe('P2-3 · sent cannot exist, and read is not observable', () => {
  test('every item carries delivery: not available, with the reason, and the label says so', async () => {
    const row = await openCase();
    const data = await pkg.casePackage(row.id);
    assert.strictEqual(data.delivery_channel, 'none');
    for (const item of data.items) {
      assert.strictEqual(item.delivery.state, 'not_available');
      assert.strictEqual(item.delivery.reason, 'no_delivery_channel');
      assert.match(item.delivery.label, /^Not sent —/);
    }
  });

  test('no read state can be claimed either — there is no hire-facing portal', async () => {
    const row = await openCase();
    const data = await pkg.casePackage(row.id);
    for (const item of data.items) {
      assert.strictEqual(item.reading.state, 'not_tracked');
      assert.strictEqual(item.reading.reason, 'no_hire_portal');
    }
  });

  test('the serialised package never words a delivery or a read as a success', async () => {
    const row = await openCase();
    const serialised = JSON.stringify(await pkg.casePackage(row.id));
    for (const claim of ['"sent"', '"emailed"', '"notified"', '"delivered":true', '"read":true']) {
      assert.strictEqual(serialised.includes(claim), false, `must not contain ${claim}`);
    }
  });
});

describe('P2-3 · acknowledged is a record, never an inference', () => {
  test('a case starts with nothing acknowledged — the package is not pre-marked', async () => {
    const row = await openCase();
    const data = await pkg.casePackage(row.id);
    assert.strictEqual(data.recorded_count, 0);
    assert.strictEqual(data.items.every((item) => item.state === 'not_recorded'), true);
    assert.strictEqual(data.required_recorded, 0);
    assert.deepStrictEqual(data.missing_required, ['signed_jd', 'nda']);
  });

  test('recording one item does not mark any other: no inference from progress anywhere', async () => {
    const row = await openCase();
    await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'signed_jd', recorded_by: 'HR Admin', note: 'in person',
    });
    const data = await pkg.casePackage(row.id);
    const jd = data.items.find((item) => item.item_key === 'signed_jd');
    const nda = data.items.find((item) => item.item_key === 'nda');
    assert.strictEqual(jd.state, 'acknowledged');
    assert.strictEqual(nda.state, 'not_recorded');
    assert.strictEqual(data.recorded_count, 1);
    assert.strictEqual(data.required_total, 2);
    assert.strictEqual(data.required_recorded, 1);
    assert.deepStrictEqual(data.missing_required, ['nda']);
  });

  test('the record names who recorded it and a UTC timestamp, and the method says what it is', async () => {
    const row = await openCase();
    const before = Date.now();
    const { acknowledgement } = await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'nda', recorded_by: 'Ahmad Aljairoudi',
    });
    assert.strictEqual(acknowledgement.recorded_by, 'Ahmad Aljairoudi');
    assert.match(acknowledgement.acknowledged_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(new Date(acknowledgement.acknowledged_at).getTime() >= before);
    assert.strictEqual(acknowledgement.method, 'in_product_record');
    assert.match(acknowledgement.method_label, /not an electronic signature/);
  });

  test('another case is unaffected by it: the record is per case', async () => {
    const first = await openCase();
    const second = await openCase();
    await pkg.recordAcknowledgement({
      case_id: first.id, item_key: 'signed_jd', recorded_by: 'HR Admin',
    });
    const other = await pkg.casePackage(second.id);
    assert.strictEqual(other.recorded_count, 0);
    assert.strictEqual(other.missing_required.length, 2);
  });

  test('recording the same item again returns the first record and does not rewrite it', async () => {
    const row = await openCase();
    const first = await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'nda', recorded_by: 'HR Admin',
    });
    const second = await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'nda', recorded_by: 'Someone Else',
    });
    assert.strictEqual(second.created, false);
    assert.strictEqual(second.acknowledgement.id, first.acknowledgement.id);
    assert.strictEqual(second.acknowledgement.recorded_by, 'HR Admin');
    assert.strictEqual(second.acknowledgement.acknowledged_at, first.acknowledgement.acknowledged_at);
    const rows = await db.query(
      `SELECT COUNT(*) AS n FROM preboarding_acknowledgements WHERE case_id = '${row.id}'`
    );
    assert.strictEqual(rows[0].n, 1);
  });

  test('the audit trail records the acknowledgement without the note body', async () => {
    const row = await openCase();
    await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'signed_jd', recorded_by: 'HR Admin',
      note: 'kept on file under the hire reference',
    });
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE entity_id = '${row.id}' AND action = 'ACKNOWLEDGE'`
    );
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].performed_by, 'HR Admin');
    assert.match(logs[0].new_values, /signed_jd/);
    assert.strictEqual(logs[0].new_values.includes('kept on file'), false);
  });

  test('as of an earlier instant the item reads unrecorded: the past view cannot be rewritten', async () => {
    const row = await openCase();
    const before = new Date(Date.now() - 60_000).toISOString();
    await pkg.recordAcknowledgement({
      case_id: row.id, item_key: 'nda', recorded_by: 'HR Admin',
    });
    const past = await pkg.casePackage(row.id, { as_of: before });
    assert.strictEqual(past.recorded_count, 0);
    assert.strictEqual(past.items.find((item) => item.item_key === 'nda').state, 'not_recorded');
    const now = await pkg.casePackage(row.id);
    assert.strictEqual(now.recorded_count, 1);
  });
});

describe('P2-3 · the refusal path', () => {
  test('a record without a named actor is refused, and the reason names the gap', async () => {
    const row = await openCase();
    await assert.rejects(
      () => pkg.recordAcknowledgement({ case_id: row.id, item_key: 'signed_jd' }),
      (err) => err instanceof pkg.PreboardingPackageError && err.status === 400
        && /recorded_by is required/.test(err.message)
        && /no new-hire login/.test(err.message)
    );
    const data = await pkg.casePackage(row.id);
    assert.strictEqual(data.recorded_count, 0);
  });

  test('an item key outside the case package is refused, and the message lists the set', async () => {
    const row = await openCase();
    await assert.rejects(
      () => pkg.recordAcknowledgement({
        case_id: row.id, item_key: 'passport_copy', recorded_by: 'HR Admin',
      }),
      (err) => err.status === 400 && /not part of this case's pre-reading package/.test(err.message)
        && /signed_jd/.test(err.message)
    );
  });

  test('a signature-implying method is refused: the product cannot obtain a signature', async () => {
    const row = await openCase();
    for (const method of pkg.UNAVAILABLE_METHODS) {
      await assert.rejects(
        () => pkg.recordAcknowledgement({
          case_id: row.id, item_key: 'nda', recorded_by: 'HR Admin', method,
        }),
        (err) => err.status === 400 && /cannot obtain an e-signature/.test(err.message)
      );
    }
    const data = await pkg.casePackage(row.id);
    assert.strictEqual(data.recorded_count, 0);
  });

  test('an unknown method is refused rather than silently accepted', async () => {
    const row = await openCase();
    await assert.rejects(
      () => pkg.recordAcknowledgement({
        case_id: row.id, item_key: 'nda', recorded_by: 'HR Admin', method: 'whatsapp',
      }),
      (err) => err.status === 400 && /only method this release can write/.test(err.message)
    );
  });

  test('a KSA case cannot record: the set is kept but not active', async () => {
    const row = await openCase({ jurisdiction: 'SA' });
    await assert.rejects(
      () => pkg.recordAcknowledgement({
        case_id: row.id, item_key: 'nda', recorded_by: 'HR Admin',
      }),
      (err) => err.status === 409 && /kept but not active/.test(err.message)
    );
    const data = await pkg.casePackage(row.id);
    assert.strictEqual(data.package_available, false);
    assert.strictEqual(data.recorded_count, 0);
    assert.match(data.package_unavailable_reason, /not active in this release/);
  });

  test('an unknown case is refused with 404, and an unusable as_of with 400', async () => {
    await assert.rejects(
      () => pkg.casePackage('00000000-0000-4000-8000-000000000000'),
      (err) => err.status === 404
    );
    const row = await openCase();
    await assert.rejects(
      () => pkg.casePackage(row.id, { as_of: 'last tuesday' }),
      (err) => err.status === 400 && /ISO 8601/.test(err.message)
    );
  });
});
