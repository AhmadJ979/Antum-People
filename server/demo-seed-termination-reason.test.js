/**
 * The demo seed records NO termination reason — the owner's direction of 2026-10-30, verbatim:
 * *"Never seed a demo termination reason — make that impossible and show me the test."*
 *
 * WHY IT MATTERS. `employees.termination_type` stays NULL until a named actor records a real event
 * (owner ruling, 2026-10-29, live). A blank record computes the EOSB UNREDUCED and the figure carries
 * the basis it used — `no_reason_recorded`. A SEEDED reason would do two things at once: invent a
 * personnel event no actor recorded, and turn an unreduced figure into a reduced one. That second
 * half is the defect #338 removed, and it is invisible on screen, because the row and the figure
 * would agree with each other while both disagree with reality.
 *
 * WHAT THIS FILE JUDGES — the SEEDED RESULT, not the seed source. It runs the real
 * `scripts/seed-demo.js` against a throwaway database (the seeder refuses to run anywhere else; the
 * path is pinned above the first require), then asks the database what it wrote:
 *
 *   1. the scan read the roster and PRINTS how many rows it examined, and the seed has to be one whose
 *      leavers are present — a scan that examined nothing must not pass;
 *   2. ZERO seeded rows carry a termination reason, and any offender is named with its value;
 *   3. the demo still shows its terminations (the screens need them) and every one of those rows is
 *      blank — so the fix is "no reason", not "no terminations";
 *   4. the figures on those rows are the UNREDUCED ones, and at least one of them WOULD have differed
 *      had a reason been passed — so assertion 2 cannot pass by arithmetic coincidence;
 *   5. the refusal is EXERCISED (a planted reason throws, naming row, field and value; the blank
 *      states do not), so the control is behaviour, not a comment;
 *   6. one static signal the seeded database cannot give: the employees INSERT names the termination
 *      column and binds it to the guard's single constant — because an OMITTED column and a NULL
 *      column leave identical bytes, and only the source says which one this is.
 *
 * WHAT IT DELIBERATELY DOES NOT JUDGE, printed by the last test rather than left implicit:
 * `exit_interviews.departure_reason` still carries the demo's departure reasons (4 rows). That is the
 * EXIT-INTERVIEW instrument — a reason for leaving as the person gave it — on another table, behind
 * its own route and gate, and it reduces no benefit. A green run here must not be read as "the demo
 * holds no reason anywhere", and the last test prints those rows so a reader cannot read it that way.
 *
 * Runs against its own throwaway database: `cd server && npm test`.
 */
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Pinned ABOVE every require that could load server/db.js (server/live-db-guard.test.js asserts this
// ordering): db.js defaults to the LIVE product database and executes DDL when it loads.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antum-seed-termination-'));
process.env.PRODUCT_DB_PATH = path.join(workDir, 'seed-termination.db');

const { test, describe, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const repoRoot = path.join(__dirname, '..');
const SEEDER = path.join(repoRoot, 'scripts', 'seed-demo.js');
const eosb = require('./eosb');
const guard = require(path.join(repoRoot, 'scripts', 'seed-termination-guard.js'));

const dbPath = path.join(workDir, 'demo.db');

/**
 * Run the seeder for real. A refusal (or any other non-zero exit) is reported WITH THE SEEDER'S OWN
 * WORDS, because the refusal is the thing this file exists to show: a message that only said "the
 * command failed" would hide the row, the field and the value the guard named.
 */
function runSeed() {
  try {
    return execFileSync(process.execPath, [SEEDER], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DEMO_SEED: 'true',
        PRODUCT_DB_PATH: dbPath,
        JWT_SECRET: 'seed-termination-test-secret',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
      },
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    throw new Error(
      `the demo seeder exited ${err.status} instead of seeding — its own words follow.\n`
      + `--- stdout ---\n${err.stdout || ''}\n--- stderr ---\n${err.stderr || ''}`,
    );
  }
}

const seedOutput = runSeed();
const db = new DatabaseSync(dbPath);
const rows = (sql) => db.prepare(sql).all();

after(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('the demo seed records no termination reason (owner direction, 2026-10-30)', () => {
  test('the seed ran to completion and wrote the roster it owns', () => {
    assert.match(seedOutput, /Seeding completed successfully\./,
      'the seeder did not report completion — everything below would be judging a half-written database');
    const n = rows('SELECT COUNT(*) AS n FROM employees')[0].n;
    assert.ok(n > 0, 'the seed wrote no employees at all; a clean scan over nothing proves nothing');
  });

  test('ZERO seeded employee rows carry a termination reason — and the scan prints what it examined', () => {
    const roster = rows('SELECT id, status, termination_type FROM employees ORDER BY id');
    const carriers = roster.filter((r) => guard.carriesAReason(r.termination_type));

    console.log(`[demo-seed-termination-reason] examined ${roster.length} employee rows written by the seed; `
      + `${carriers.length} carry a termination reason`);
    for (const r of roster) {
      console.log(`    ${r.id.padEnd(20)} status=${String(r.status).padEnd(12)} `
        + `termination_type=${JSON.stringify(r.termination_type)}`);
    }

    // Anti-vacuous, two ways: the scan read something, and it read the rows a reason would be attached
    // to. A version of this test that examined an empty table, or a table whose leavers were missing,
    // would report the same "0 carriers" for a reason that has nothing to do with the control.
    assert.ok(roster.length > 0, 'the scan examined NOTHING — a clean result here would prove nothing');
    assert.ok(roster.some((r) => r.status === 'terminated'),
      'no terminated row was seeded, so "no reason on the leavers" was never actually asked');

    assert.deepStrictEqual(
      carriers.map((r) => `${r.id} = ${JSON.stringify(r.termination_type)}`),
      [],
      'the demo seed recorded a termination reason on a row no named actor wrote. The demo may never '
      + 'seed one: it invents a personnel event and it turns an unreduced benefit into a reduced one '
      + '(owner direction 2026-10-30)',
    );
  });

  test('the demo still shows its terminations — every one of them with no reason attached', () => {
    const byStatus = {};
    for (const r of rows('SELECT status, COUNT(*) AS n FROM employees GROUP BY status')) byStatus[r.status] = r.n;

    const leavers = rows("SELECT id, status, termination_type FROM employees WHERE status IN ('terminated','offboarding') ORDER BY id");
    console.log(`[demo-seed-termination-reason] the demo's leavers (terminated or offboarding): ${leavers.length}`);
    for (const r of leavers) {
      console.log(`    ${r.id.padEnd(20)} ${String(r.status).padEnd(12)} termination_type=${JSON.stringify(r.termination_type)} `
        + `→ the Directory row reads "Unreduced — no termination reason recorded"`);
    }

    assert.strictEqual(byStatus.terminated, 2,
      'the demo no longer seeds its two historical leavers — the offboarding/replacement surfaces need them');
    assert.strictEqual(byStatus.offboarding, 2,
      'the demo no longer seeds its two in-flight offboardings');
    assert.ok(leavers.every((r) => !guard.carriesAReason(r.termination_type)),
      'a leaver carries a reason: the fix is "no reason", never "no terminations"');
  });

  test('the leavers carry the UNREDUCED figure, and the comparison has teeth', () => {
    const leavers = rows(`SELECT id, start_date, end_date, basic_salary, salary, data_residency_country,
      eosb_accrued FROM employees WHERE status IN ('terminated','offboarding') ORDER BY id`);

    const wouldHaveDiffered = [];
    for (const r of leavers) {
      const unreduced = eosb.calculateEOSB(r.start_date, r.end_date, r.basic_salary, r.salary,
        r.data_residency_country, null, 0);
      const asResignation = eosb.calculateEOSB(r.start_date, r.end_date, r.basic_salary, r.salary,
        r.data_residency_country, 'resignation', 0);
      console.log(`[demo-seed-termination-reason] ${r.id.padEnd(20)} stored=${r.eosb_accrued} `
        + `unreduced=${unreduced} if-a-resignation-had-been-passed=${asResignation}`);
      assert.strictEqual(r.eosb_accrued, unreduced,
        `${r.id} carries a REDUCED figure while its record holds no reason — the #338 defect, from the `
        + 'seeded side: the figure would be asserting a reduction decision nobody recorded');
      if (asResignation !== unreduced) wouldHaveDiffered.push(r.id);
    }

    assert.ok(wouldHaveDiffered.length > 0,
      'not one seeded leaver would have carried a different figure had a reason been passed, so the '
      + 'assertion above is arithmetic coincidence rather than evidence — re-ground this test on a '
      + 'leaver inside the UAE 1/3 or 2/3 tier before trusting its green');
    console.log(`[demo-seed-termination-reason] rows where a seeded reason WOULD have moved the figure: `
      + `${wouldHaveDiffered.join(', ')}`);
  });

  test('the refusal is exercised: a roster naming a reason is refused, and the blank states are not', () => {
    assert.throws(
      () => guard.assertRosterCarriesNoTerminationReason([
        { id: 'demo-emp-planted', termination_type: 'resignation' },
      ]),
      (err) => /Refusing to seed a termination reason/.test(err.message)
        && /demo-emp-planted\.termination_type = "resignation"/.test(err.message),
      'the guard must REFUSE a roster that names a reason, and name the row, the field and the value',
    );
    // The control: the blank state is what the ruling requires, so it must NOT be refused — otherwise
    // the guard would fail a correct roster and the test above would pass for the wrong reason.
    assert.doesNotThrow(() => guard.assertRosterCarriesNoTerminationReason([
      { id: 'blank-null', termination_type: null },
      { id: 'absent' },
      { id: 'blank-string', termination_type: '   ' },
    ]));
    // And the writer's own refusal, which is what a future edit to the INSERT would meet.
    assert.throws(() => guard.terminationTypeSqlValue('resignation'),
      (err) => /Refusing to write termination_type = "resignation"/.test(err.message));
    assert.strictEqual(guard.terminationTypeSqlValue(guard.SEEDED_TERMINATION_TYPE), 'NULL');
    assert.strictEqual(guard.SEEDED_TERMINATION_TYPE, null,
      'the seed has exactly one reason it may record, and it is blank');
  });

  test('the write names the column and binds the refusal — the one signal the seeded bytes cannot give', () => {
    // An OMITTED column and a NULL column leave identical bytes in the database, so the seeded result
    // cannot tell them apart. This is the assertion that says which one the seed is: explicit, and
    // bound to the constant the guard refuses to render as anything but NULL.
    const source = fs.readFileSync(SEEDER, 'utf8');
    const insert = /INSERT OR REPLACE INTO employees \(([\s\S]*?)\)\s*VALUES/.exec(source);
    assert.ok(insert, 'the employees INSERT did not parse — this check must not pass over an unread file');
    const columns = insert[1].split(',').map((c) => c.trim());
    assert.ok(columns.length > 5, 'the column list parsed');
    assert.ok(columns.includes('termination_type'),
      'the seed no longer writes the termination column explicitly: it went back to omitting it, which '
      + 'reads the same in the data and differently to the next person editing this file');
    const statement = source.slice(insert.index, insert.index + 1600);
    assert.ok(statement.includes('terminationTypeSqlValue(seedTermination.SEEDED_TERMINATION_TYPE)'),
      'the termination column is no longer bound to the guard\'s constant — an unbound NULL is a value '
      + 'someone can change without meeting the refusal');
  });

  test('what this file does NOT judge, printed: the exit-interview reasons are still seeded', () => {
    const interviews = rows('SELECT id, employee_id, departure_reason FROM exit_interviews ORDER BY id');
    console.log(`[demo-seed-termination-reason] NOT a termination reason, and deliberately still seeded: `
      + `${interviews.length} exit-interview row(s)`);
    for (const r of interviews) {
      console.log(`    ${r.id.padEnd(14)} ${String(r.employee_id).padEnd(20)} departure_reason=${JSON.stringify(r.departure_reason)}`);
    }
    assert.ok(interviews.length > 0 && interviews.every((r) => guard.carriesAReason(r.departure_reason)),
      'the exit-interview instrument changed shape: it is a DIFFERENT table, with its own route and '
      + 'gate, and it reduces no benefit — removing its reasons is a separate owner decision, not a '
      + 'silent tidy-up');
    // And none of it reaches the column this file is about.
    assert.strictEqual(rows('SELECT COUNT(*) AS n FROM employees WHERE termination_type IS NOT NULL')[0].n, 0,
      'a departure reason from the exit interview must not appear as an employee termination reason');
  });
});
