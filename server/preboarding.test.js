/**
 * P2-1 acceptance criteria — an accepted job offer opens a pre-boarding case.
 *
 * Runs against its own throwaway product database (PRODUCT_DB_PATH below is set before
 * db.js is required), never the live one: `cd server && npm test`.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TEST_DB = path.join(os.tmpdir(), `antum-p2-1-${randomUUID()}.db`);
process.env.PRODUCT_DB_PATH = TEST_DB;

const db = require('./db');
const preboarding = require('./preboarding');

const acceptedOffer = (overrides = {}) => ({
  offer_reference: 'OFR-2026-001',
  candidate_name: 'Layla Haddad',
  candidate_email: 'layla.haddad@example.com',
  role: 'Financial Analyst',
  department: 'Finance',
  reporting_line: 'Head of Finance',
  jurisdiction: 'AE',
  start_date: '2026-11-02',
  ...overrides,
});

const countCases = async () => {
  const rows = await db.query('SELECT COUNT(*) AS n FROM preboarding_cases');
  return rows[0].n;
};

after(() => {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(TEST_DB + suffix); } catch { /* not created */ }
  }
});

describe('P2-1 · an accepted offer opens a pre-boarding case', () => {
  test('the case carries start date, role, department, reporting line and jurisdiction', async () => {
    const { case: createdCase, created } = await preboarding.recordOfferAcceptance(acceptedOffer());

    assert.strictEqual(created, true, 'a first acceptance opens the case');
    assert.strictEqual(createdCase.start_date, '2026-11-02');
    assert.strictEqual(createdCase.role, 'Financial Analyst');
    assert.strictEqual(createdCase.department, 'Finance');
    assert.strictEqual(createdCase.reporting_line, 'Head of Finance');
    assert.strictEqual(createdCase.jurisdiction, 'AE');
    assert.strictEqual(createdCase.status, 'open');
    assert.strictEqual(createdCase.source, 'intake_form', 'the caller is recorded: form today, ATS later');
    assert.ok(createdCase.offer_reference, 'the accepted offer it came from is recorded');

    // and it is readable back out of the database, not just returned by the writer
    const reread = await preboarding.getCase(createdCase.id);
    assert.strictEqual(reread.start_date, '2026-11-02');
    assert.strictEqual(reread.reporting_line, 'Head of Finance');
  });

  test('no case can exist without a start date — the write is refused and nothing is stored', async () => {
    const before = await countCases();

    await assert.rejects(
      () => preboarding.recordOfferAcceptance(acceptedOffer({ offer_reference: 'OFR-NO-DATE', start_date: '' })),
      (err) => err instanceof preboarding.OfferAcceptanceError && err.status === 400 && /start_date is required/.test(err.message)
    );

    assert.strictEqual(await countCases(), before, 'a refused acceptance leaves no row behind');
    assert.strictEqual(
      (await db.query("SELECT * FROM preboarding_cases WHERE offer_reference = 'OFR-NO-DATE'")).length,
      0
    );
  });

  test('a malformed start date is refused as well — the invariant is a date, not a non-empty string', async () => {
    await assert.rejects(
      () => preboarding.recordOfferAcceptance(acceptedOffer({ offer_reference: 'OFR-BAD-DATE', start_date: '02/11/2026' })),
      (err) => err instanceof preboarding.OfferAcceptanceError && /YYYY-MM-DD/.test(err.message)
    );
  });

  test('re-processing the same accepted offer does not open a second case', async () => {
    const first = await db.query(
      "SELECT * FROM preboarding_cases WHERE offer_reference = 'OFR-2026-001'"
    );
    const replay = await preboarding.recordOfferAcceptance(acceptedOffer());

    assert.strictEqual(replay.created, false, 'the second call creates nothing');
    assert.strictEqual(replay.case.id, first[0].id, 'it returns the case that already exists');
    assert.strictEqual(
      (await db.query("SELECT COUNT(*) AS n FROM preboarding_cases WHERE offer_reference = 'OFR-2026-001'"))[0].n,
      1,
      'exactly one case per accepted offer'
    );
  });

  test('idempotency is per offer, not per candidate: a different offer opens its own case', async () => {
    const before = await countCases();
    const { case: second, created } = await preboarding.recordOfferAcceptance(
      acceptedOffer({ offer_reference: 'OFR-2026-002', role: 'HR Officer' })
    );

    assert.strictEqual(created, true);
    assert.strictEqual(await countCases(), before + 1);
    assert.notStrictEqual(second.id, (await db.query(
      "SELECT id FROM preboarding_cases WHERE offer_reference = 'OFR-2026-001'"
    ))[0].id);
  });

  test('jurisdiction is a real field, not UAE-hardcoded: KSA is stored as given', async () => {
    const { case: ksaCase } = await preboarding.recordOfferAcceptance(
      acceptedOffer({ offer_reference: 'OFR-2026-003', jurisdiction: 'SA' })
    );
    assert.strictEqual(ksaCase.jurisdiction, 'SA');

    const filtered = await preboarding.listCases({ jurisdiction: 'AE' });
    assert.ok(
      filtered.every((c) => c.jurisdiction === 'AE'),
      'filtering by jurisdiction returns only that jurisdiction'
    );
  });

  test('an unsupported jurisdiction is refused rather than silently defaulted', async () => {
    await assert.rejects(
      () => preboarding.recordOfferAcceptance(acceptedOffer({ offer_reference: 'OFR-2026-004', jurisdiction: 'QA' })),
      (err) => err instanceof preboarding.OfferAcceptanceError && /jurisdiction/.test(err.message)
    );
  });

  test('every field the two Layer 2 workflows need is required, and the error names it', async () => {
    for (const field of ['offer_reference', 'candidate_name', 'role', 'department', 'reporting_line']) {
      const payload = acceptedOffer({ offer_reference: `OFR-MISSING-${field}` });
      payload[field] = '';

      await assert.rejects(
        () => preboarding.recordOfferAcceptance(payload),
        (err) => err instanceof preboarding.OfferAcceptanceError && err.message.includes(field),
        `${field} must be required`
      );
    }
  });

  test('the creation is audited', async () => {
    const audit = await db.query(
      "SELECT * FROM audit_logs WHERE entity_type = 'preboarding_case' AND action = 'CREATE'"
    );
    assert.strictEqual(audit.length, await countCases(), 'one audit entry per case created');
    const recordedCase = await preboarding.getCase(audit[0].entity_id);
    assert.ok(recordedCase, 'the audit entry points at the case it recorded');
  });
});

describe('P2-1 · one payload, one writer', () => {
  test('server/ holds exactly one INSERT into preboarding_cases, and it is in preboarding.js', () => {
    const callers = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
      .filter((file) =>
        /INSERT\s+INTO\s+preboarding_cases/i.test(fs.readFileSync(path.join(__dirname, file), 'utf8'))
      );

    assert.deepStrictEqual(
      callers,
      ['preboarding.js'],
      'a second writer would be a second implementation of the same rules — call recordOfferAcceptance instead'
    );
  });

  test('the routes are transport only: the case rules live in the shared function', () => {
    const index = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    assert.ok(
      index.includes("app.post('/api/preboarding/cases'"),
      'the intake form has its own route'
    );
    assert.ok(
      index.includes('preboarding.recordOfferAcceptance('),
      'and that route calls the same writer an ATS adapter will call'
    );
  });
});
