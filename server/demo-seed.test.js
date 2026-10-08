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
 *   5. each case also arrives with its P2-4 workspace lines — all open, every line owned by one
 *      of the four functions, all four functions represented — because the case-creation path
 *      seeds both tracks and the demo has to show the provisioning half too;
 *   6. no consent record is seeded, so the PDPL gate on `received` stays demonstrable;
 *   7. `preboarding_cases` carries no flag-like column, and the seed writes none — the state is
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
    // Scoped to the employee track, which is what this test has always been about: the documents
    // whose statuses make the three flag states true. Since P2-4 every case also carries
    // workspace-track provisioning lines, and that track is asserted separately below — a count
    // over both tracks at once would be a blended number, which is exactly what the design
    // review rules out.
    const byCase = rows(`
      SELECT c.offer_reference, i.status, COUNT(*) AS n
      FROM preboarding_items i JOIN preboarding_cases c ON c.id = i.case_id
      WHERE i.track = 'employee'
      GROUP BY c.offer_reference, i.status ORDER BY c.offer_reference, i.status
    `);
    const counts = (ref) => Object.fromEntries(byCase.filter((r) => r.offer_reference === ref).map((r) => [r.status, r.n]));

    assert.deepStrictEqual(counts('OFR-2026-DEMO-01'), { requested: 3, not_started: 4 });
    assert.deepStrictEqual(counts('OFR-2026-DEMO-02'), { not_started: 7 });
    assert.deepStrictEqual(counts('OFR-2026-DEMO-03'), { not_started: 7 });
    assert.strictEqual(one("SELECT COUNT(*) AS n FROM preboarding_items WHERE status IN ('received','verified')").n, 0);
  });

  test('the workspace track arrives with each case, owned and all open', () => {
    // P2-4: the demo must show the provisioning half, and it must show it honestly — every line
    // attributable to one of the four functions, nothing pre-completed, and all four functions
    // represented so the "View by function" filter has something to filter.
    const perCase = rows(`
      SELECT c.offer_reference, i.owner, i.status, COUNT(*) AS n
      FROM preboarding_items i JOIN preboarding_cases c ON c.id = i.case_id
      WHERE i.track = 'workspace'
      GROUP BY c.offer_reference, i.owner, i.status ORDER BY c.offer_reference, i.owner
    `);
    const refs = ['OFR-2026-DEMO-01', 'OFR-2026-DEMO-02', 'OFR-2026-DEMO-03'];
    for (const ref of refs) {
      const mine = perCase.filter((r) => r.offer_reference === ref);
      assert.ok(mine.length > 0, `${ref} must carry workspace lines`);
      assert.ok(mine.every((r) => r.status === 'not_started'), `${ref}: no workspace line is pre-completed`);
      assert.ok(mine.every((r) => ['IT', 'Admin', 'HR', 'Manager'].includes(r.owner)),
        `${ref}: every line names one of the four functions`);
      const functions = [...new Set(mine.map((r) => r.owner))].sort();
      assert.deepStrictEqual(functions, ['Admin', 'HR', 'IT', 'Manager'],
        `${ref}: all four functions own at least one line, so the filter is demonstrable`);
    }
    // No workspace line can be collected either, so the three-state demo is unchanged by P2-4.
    assert.strictEqual(one(`SELECT COUNT(*) AS n FROM preboarding_items
      WHERE track = 'workspace' AND status IN ('received','verified')`).n, 0);
    // And no employee-track row lost its track label to the new column's default.
    assert.strictEqual(one(`SELECT COUNT(*) AS n FROM preboarding_items WHERE track NOT IN ('employee','workspace')`).n, 0);
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
    const workspaceItemsBefore = one("SELECT COUNT(*) AS n FROM preboarding_items WHERE track = 'workspace'").n;
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
    // 21 employee-track items (3 cases × 7 documents), and each case's derived workspace lines —
    // counted per track, because a replay must not add a second copy of either, and the two
    // tracks are never summed into one figure. The employee count is the number this test has
    // always asserted; the workspace count is measured before the replay and must not move.
    assert.strictEqual(one("SELECT COUNT(*) AS n FROM preboarding_items WHERE track = 'employee'").n, 21,
      '21 employee-track items, not 42');
    assert.strictEqual(one("SELECT COUNT(*) AS n FROM preboarding_items WHERE track = 'workspace'").n,
      workspaceItemsBefore, 'a replay must not duplicate a workspace line either');
    assert.strictEqual(one('SELECT COUNT(*) AS n FROM preboarding_items').n,
      21 + workspaceItemsBefore, 'both tracks, seeded exactly once');
  });
});
