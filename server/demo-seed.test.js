/**
 * The Layer 2 demo seed — the three pre-boarding cases (owner decision, 2026-10-07).
 *
 * The owner asked for three demo cases, one per flag state, and Gate 2 decided the 48-hour flag
 * is DERIVED from the start date and the item statuses, never stored. So the seed's job is
 * narrow and checkable: produce start dates and item statuses from which the three states are
 * true when the surface reads them, and store no state of its own. This test runs the real seed
 * against a throwaway database and holds that:
 *
 *   1. exactly three demo cases exist, on the three offer references the seed owns;
 *   2. their start dates are the seeded OFFSETS from the day the seed ran (+14, +1, -1) — the
 *      offsets are the fixed thing, never the dates, so the demo cannot go stale;
 *   3. case 1 is the roster's own in-flight UAE hire, by that row's id (carried in `source`
 *      because preboarding_cases has no employee_id column), with the person's own name, role,
 *      department and jurisdiction copied from the roster row;
 *   4. the item statuses are what the states need: case 1 has items requested and none verified,
 *      cases 2 and 3 have every item still open;
 *   5. no consent record is seeded, so the PDPL gate on `received` stays demonstrable;
 *   6. `preboarding_cases` carries no flag-like column, and the seed writes none — the state is
 *      derived, not stored.
 *
 * Runs against its own throwaway database: `cd server && npm test`.
 */
const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const repoRoot = path.join(__dirname, '..');
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antum-demo-seed-'));
const dbPath = path.join(workDir, 'demo.db');

// The seed refuses to run without DEMO_SEED=true, and the server modules it requires refuse to
// load without the two secrets. Both are throwaway values for a throwaway database.
execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'seed-demo.js')], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DEMO_SEED: 'true',
    PRODUCT_DB_PATH: dbPath,
    JWT_SECRET: 'demo-seed-test-secret',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  },
  stdio: 'pipe',
});

const db = new DatabaseSync(dbPath);
const rows = (sql) => db.prepare(sql).all();
const one = (sql) => rows(sql)[0];

/** UTC day difference, the same clock the seed's offsets are computed on. */
function daysFromToday(dateString) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = dateString.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - todayUtc) / 86400000);
}

function isoOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

after(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('Layer 2 demo seed — the three pre-boarding cases', () => {
  const cases = () => rows('SELECT * FROM preboarding_cases ORDER BY offer_reference');

  test('seeds exactly the three offer references it owns, all UAE', () => {
    assert.deepStrictEqual(
      cases().map((c) => c.offer_reference),
      ['OFR-2026-DEMO-01', 'OFR-2026-DEMO-02', 'OFR-2026-DEMO-03']
    );
    for (const c of cases()) {
      assert.strictEqual(c.jurisdiction, 'AE', `${c.offer_reference} must be on the UAE surface`);
      assert.strictEqual(c.status, 'open');
    }
  });

  test('dates are the seeded offsets from the day the seed ran, not fixed dates', () => {
    const offsets = cases().map((c) => daysFromToday(c.start_date));
    assert.deepStrictEqual(offsets, [14, 1, -1], 'case 1 on track, case 2 inside 48h, case 3 passed');
    for (const c of cases()) {
      const expected = isoOffset({ 'OFR-2026-DEMO-01': 14, 'OFR-2026-DEMO-02': 1, 'OFR-2026-DEMO-03': -1 }[c.offer_reference]);
      assert.strictEqual(c.start_date, expected, `${c.offer_reference} start date drifted`);
    }
  });

  test('case 1 is the roster\'s in-flight UAE hire, by that row\'s id', () => {
    const c = cases()[0];
    assert.strictEqual(c.source, 'roster:demo-emp-omar', 'the pointer to the roster row is the id');
    const employee = one("SELECT * FROM employees WHERE id = 'demo-emp-omar'");
    assert.ok(employee, 'demo-emp-omar must exist in the roster the seed writes');
    assert.strictEqual(c.candidate_name, `${employee.first_name} ${employee.last_name}`);
    assert.strictEqual(c.role, employee.role);
    assert.strictEqual(c.department, employee.department);
    assert.strictEqual(c.jurisdiction, employee.jurisdiction);
    assert.strictEqual(employee.status, 'onboarding', 'the row used is the one already onboarding');
  });

  test('item statuses are what the three states need: none verified, none collected', () => {
    const byCase = rows(`
      SELECT c.offer_reference, i.status, COUNT(*) AS n
      FROM preboarding_items i JOIN preboarding_cases c ON c.id = i.case_id
      GROUP BY c.offer_reference, i.status ORDER BY c.offer_reference, i.status
    `);
    const counts = (ref) => Object.fromEntries(byCase.filter((r) => r.offer_reference === ref).map((r) => [r.status, r.n]));

    assert.deepStrictEqual(counts('OFR-2026-DEMO-01'), { requested: 3, not_started: 4 });
    assert.deepStrictEqual(counts('OFR-2026-DEMO-02'), { not_started: 7 });
    assert.deepStrictEqual(counts('OFR-2026-DEMO-03'), { not_started: 7 });
    assert.strictEqual(one("SELECT COUNT(*) AS n FROM preboarding_items WHERE status IN ('received','verified')").n, 0);
  });

  test('no consent record is seeded, so the PDPL gate on received stays demonstrable', () => {
    assert.strictEqual(one('SELECT COUNT(*) AS n FROM preboarding_consents').n, 0);
    assert.strictEqual(one('SELECT COUNT(*) AS n FROM preboarding_reminders').n, 0);
  });

  test('the state is derived, not stored: no flag-like column on the case table', () => {
    const columns = db.prepare('PRAGMA table_info(preboarding_cases)').all().map((c) => c.name);
    const flagLike = columns.filter((name) => /flag|(^|_)state($|_)/i.test(name));
    assert.deepStrictEqual(flagLike, [], 'the 48-hour flag is computed from the start date and items');
    assert.ok(!columns.includes('employee_id'), 'the link is by roster id in source until a schema change is decided');
  });

  test('re-running the seed changes nothing it owns (idempotent on offer_reference)', () => {
    const before = rows('SELECT id, offer_reference, start_date FROM preboarding_cases ORDER BY offer_reference');
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'seed-demo.js')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DEMO_SEED: 'true',
        PRODUCT_DB_PATH: dbPath,
        JWT_SECRET: 'demo-seed-test-secret',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
      },
      stdio: 'pipe',
    });
    const after = rows('SELECT id, offer_reference, start_date FROM preboarding_cases ORDER BY offer_reference');
    assert.deepStrictEqual(after, before, 'a replay must not duplicate a case or move a date');
    assert.strictEqual(one('SELECT COUNT(*) AS n FROM preboarding_items').n, 21, '21 items, not 42');
  });
});
