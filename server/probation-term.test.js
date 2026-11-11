/**
 * THE PROBATION TERM A CLIENT CHOOSES — one stored value, two units, and no default.
 *
 * Owner ruling 2026-11-11: *"Probation is 3 months by default, but some clients may change it to 6
 * months based on their policy, so we make two options so the client will choose one."* The choice is
 * one term per employer, stored in DAYS on the employer row, printed in the unit each jurisdiction's
 * statute counts in, and withheld when nobody has chosen.
 *
 * The six things this file exists to hold, and the defect behind each:
 *
 *   1. a null term withholds BOTH contracts and names the fact — never a default;
 *   2. UAE 180 prints "6 months" and demands no extension — the UAE has no extension mechanism;
 *   3. KSA 180 with the written agreement prints "180 days" and is issued;
 *   4. KSA 180 without it is REFUSED, and the refusal names the extension (an empty refusal list
 *      standing in for "something is wrong" is the defect class this project closed in #396/#399);
 *   5. the SAME stored 180 renders both ways — the old failure mode, recorded at
 *      `server/compliance_engine.js` line 101, was one value printing "6 months" in one contract and
 *      "6 days" in the other;
 *   6. the two options are the database's rule, not only the client's: 120 days cannot be stored at
 *      all, by any path.
 *
 * It runs a REAL server on a scratch port against a throwaway database and never touches the live
 * service, the live database or the live credential (WORKFLOW rules 5, 10, 14).
 *
 * `cd server && node --test probation-term.test.js`
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const SCRATCH_DB = path.join(os.tmpdir(), `antum-probation-term-${randomUUID()}.db`);
const PORT = 33000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
process.env.JWT_SECRET = 'probation-term-test-secret-not-a-production-key';
process.env.ENCRYPTION_KEY = 'p'.repeat(32);

const auth = require('./auth');
const probationTerm = require('./probation-term');

const HR = { username: 'probation-term-hr', password: 'scratch-instance-password-9', role: 'hr_admin' };
const EMPLOYER_AE = 'probation-employer-uae';
const EMPLOYER_KS = 'probation-employer-ksa';
const EMP_AE = 'probation-employee-uae';
const EMP_KS = 'probation-employee-ksa';

let server;
let token;

const call = async (urlPath, { method = 'GET', body } = {}) => {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a refusal may carry no body */ }
  return { status: res.status, text, json };
};

const contract = async (templateName, employeeId) => {
  const r = await call(`/api/compliance/templates/${templateName}/${employeeId}`);
  assert.strictEqual(r.status, 200, `the templates route must answer (got ${r.status}: ${r.text})`);
  return r.json;
};

/** The line of the issued document that carries the probation term — its own words, not ours. */
const probationLine = (content) => {
  const line = String(content).split('\n').filter((l) => l.indexOf('Probation Period') !== -1)[0];
  assert.ok(line, `the issued document must carry a probation-term line (got ${JSON.stringify(String(content).slice(0, 400))})`);
  return line;
};

/** Write the employer row directly — the only way to reach a state the API refuses to store. */
const writeRowDirectly = (sql, ...params) => {
  const db = new DatabaseSync(SCRATCH_DB);
  try {
    db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
};

const setProbation = async (employerId, body) => call(`/api/employers/${employerId}`, { method: 'PUT', body });

before(async () => {
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  db.prepare('INSERT INTO users (id, username, password_hash, access_role) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), HR.username, bcrypt.hashSync(HR.password, 4), HR.role);

  // Both employers hold EVERY fact the contracts print, so the only fact under test is the probation
  // term. Nothing here is a made-up value a reader could mistake for a real company's: the strings say
  // what they are.
  const employerInsert = db.prepare(`INSERT INTO employers
    (id, legal_name, jurisdiction, registered_address, po_box, city, phone, email, signatory_name,
     signatory_title, trade_license, mohre_code, qiwa_id, dpo_name, dpo_email, dpo_phone)
    VALUES (?, ?, ?, 'Office 1, Example Tower', '00000', 'Example City', '+971 4 000 0000',
     'hr@example.invalid', 'Example Signatory', 'Head of People', 'CN-0000001', 'EST-0000001',
     'QIWA-0000001', 'Example Data Protection Officer', 'dpo@example.invalid', '+971 4 000 0001')`);
  employerInsert.run(EMPLOYER_AE, 'Example UAE Employer LLC', 'UAE');
  employerInsert.run(EMPLOYER_KS, 'Example KSA Employer LLC', 'KSA');

  const employeeInsert = db.prepare(`INSERT INTO employees
    (id, first_name, last_name, email, department, role, start_date, status, data_residency_country,
     jurisdiction, visa_status, basic_salary, salary, national_id_value, employer_id)
    VALUES (?, 'Amina', 'Haddad', ?, 'People', 'Coordinator', '2025-02-03', 'active', 'AE', ?, 'Employment Visa',
     11000, 16000, ?, ?)`);
  employeeInsert.run(EMP_AE, `${EMP_AE}@example.invalid`, 'AE', auth.encrypt('784-1990-1234567-1'), EMPLOYER_AE);
  employeeInsert.run(EMP_KS, `${EMP_KS}@example.invalid`, 'SA', auth.encrypt('2841234567'), EMPLOYER_KS);
  db.close();

  server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB, NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      await fetch(`${BASE}/api/employees`);
      break;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error('the scratch server did not start');
    await new Promise((r) => setTimeout(r, 200));
  }
  const login = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: HR.username, password: HR.password }),
  });
  assert.strictEqual(login.status, 200, 'the scratch account must be able to sign in');
  token = (await login.json()).token;
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* already gone */ }
  }
});

describe('ONE STORED VALUE, TWO UNITS', () => {
  test('180 days prints "6 months" in the UAE and "180 days" in KSA — from the same number', () => {
    const uae = probationTerm.render(180, 'UAE');
    const ksa = probationTerm.render(180, 'KSA');
    assert.strictEqual(uae.text, '6 months', 'the UAE statute counts months, so the term is stated in months');
    assert.strictEqual(ksa.text, '180 days', 'the KSA statute counts days, and a calendar-month phrase is not a lawful way to say its ceiling');
    assert.strictEqual(uae.value, '6');
    assert.strictEqual(ksa.value, '180');
  });

  test('90 days prints "3 months" in the UAE and "90 days" in KSA', () => {
    assert.strictEqual(probationTerm.render(90, 'UAE').text, '3 months');
    assert.strictEqual(probationTerm.render(90, 'KSA').text, '90 days');
  });

  test('no jurisdiction means no unit, so there is no term to print', () => {
    assert.strictEqual(probationTerm.render(180, null), null,
      'the unit is a legal question: with no jurisdiction the term cannot be written down');
    assert.deepStrictEqual(probationTerm.factsFrom({ probation_days: 180, jurisdiction: null }), {},
      'a term with no jurisdiction supplies no fact, so the contract is withheld');
  });

  test('nothing chosen is nothing supplied — there is no default', () => {
    assert.strictEqual(probationTerm.reading({ probation_days: null, jurisdiction: 'UAE' }), null);
    assert.deepStrictEqual(probationTerm.factsFrom({ probation_days: null, jurisdiction: 'UAE' }), {});
    assert.deepStrictEqual(probationTerm.missingFrom({ probation_days: null, jurisdiction: 'UAE' }), ['probation period']);
  });
});

describe('THE SAVE IS REFUSED WITH THE REASON NAMED — and not only by the client', () => {
  test('a KSA 180-day term without the written extension agreement is 422, naming the field', async () => {
    const r = await setProbation(EMPLOYER_KS, { probation_days: '180' });
    assert.strictEqual(r.status, 422, `the server must refuse it (got ${r.status}: ${r.text})`);
    assert.strictEqual(r.json.field, 'probation_extension_reference');
    assert.match(r.json.error, /written extension agreement/,
      'the refusal must say why, not only that the write failed');
    const read = await call('/api/employers');
    const row = read.json.employers.filter((e) => e.id === EMPLOYER_KS)[0];
    assert.strictEqual(row.probation_days, null, 'a refused write must not have stored the term');
  });

  test('the reference without the date is refused too, and names the date', async () => {
    const r = await setProbation(EMPLOYER_KS, { probation_days: '180', probation_extension_reference: 'EXT-2026-0001' });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.field, 'probation_extension_date');
  });

  test('a 180-day term needs a jurisdiction before it can be stored', async () => {
    const r = await setProbation(EMPLOYER_AE, { jurisdiction: '', probation_days: '180' });
    assert.strictEqual(r.status, 422);
    assert.strictEqual(r.json.field, 'jurisdiction');
  });

  test('extension evidence is refused for the UAE — it has no extension mechanism', async () => {
    const r = await setProbation(EMPLOYER_AE, {
      probation_days: '180',
      probation_extension_reference: 'EXT-2026-0001',
      probation_extension_date: '2026-11-11',
    });
    assert.strictEqual(r.status, 422, `the UAE must not accept extension evidence (got ${r.status}: ${r.text})`);
    assert.match(r.json.error, /UAE has no extension mechanism/);
  });

  test('a date that is not a calendar day is refused by name', async () => {
    const r = await setProbation(EMPLOYER_KS, {
      probation_days: '180',
      probation_extension_reference: 'EXT-2026-0001',
      probation_extension_date: '2026-02-30',
    });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /probation_extension_date/);
  });

  test('120 days cannot be STORED — the database constraint refuses it, not only the route', () => {
    assert.throws(
      () => writeRowDirectly('UPDATE employers SET probation_days = 120 WHERE id = ?', EMPLOYER_AE),
      /CHECK constraint failed/i,
      'the two options must be the database\'s rule: a hand-run write must not be able to store a third term');
    const db = new DatabaseSync(SCRATCH_DB);
    try {
      const row = db.prepare('SELECT probation_days FROM employers WHERE id = ?').get(EMPLOYER_AE);
      assert.strictEqual(row.probation_days, null, 'the refused write stored nothing');
    } finally {
      db.close();
    }
  });
});

describe('A TERM NOBODY CHOSE WITHHOLDS BOTH CONTRACTS', () => {
  test('both contracts are NOT ISSUED, and the refusal names the probation period', async () => {
    for (const [templateName, employeeId] of [['uae-employment-contract', EMP_AE], ['ksa-employment-contract', EMP_KS]]) {
      const doc = await contract(templateName, employeeId);
      assert.strictEqual(doc.issued, false, `${templateName}: a term nobody chose must withhold the contract`);
      assert.ok((doc.missing_fields || []).indexOf('probation period') !== -1,
        `${templateName}: the refusal must name the probation period (it names ${JSON.stringify(doc.missing_fields)})`);
      assert.strictEqual(String(doc.content).indexOf('[probation_period]'), -1,
        `${templateName}: no bracketed placeholder may reach a reader`);
      assert.strictEqual(/Probation Period/.test(String(doc.content)), false,
        `${templateName}: a refused document carries no part of the contract`);
    }
  });
});

describe('A CHOSEN TERM PRINTS, IN THE UNIT OF THE DOCUMENT THAT CARRIES IT', () => {
  test('UAE 180 → issued, "6 months", and no extension is demanded', async () => {
    const write = await setProbation(EMPLOYER_AE, { probation_days: '180' });
    assert.strictEqual(write.status, 200, `the UAE may hold the 6-month term (got ${write.status}: ${write.text})`);
    assert.strictEqual(write.json.employer.probation.text, '6 months', 'the record reads the term in months');
    assert.deepStrictEqual(write.json.employer.probation_not_held, [],
      'the UAE has no extension mechanism, so nothing about an extension is blank there');

    const doc = await contract('uae-employment-contract', EMP_AE);
    assert.deepStrictEqual(doc.unpopulated_fields, [], 'every fact the contract names is held');
    assert.strictEqual(doc.issued, true);
    const line = probationLine(doc.content);
    assert.ok(line.indexOf('6 months') !== -1, `the contract must print 6 months (got ${JSON.stringify(line)})`);
    assert.strictEqual(/extension/i.test(line), false, 'the UAE contract must not mention an extension');
  });

  test('KSA 180 with the written agreement → issued, "180 days"', async () => {
    const write = await setProbation(EMPLOYER_KS, {
      probation_days: '180',
      probation_extension_reference: 'EXT-2026-0001',
      probation_extension_date: '2026-11-11',
    });
    assert.strictEqual(write.status, 200, `the KSA employer may hold the 180-day term with its evidence (got ${write.status}: ${write.text})`);
    assert.strictEqual(write.json.employer.probation.text, '180 days', 'the record reads the term in days');
    assert.deepStrictEqual(write.json.employer.probation_not_held, []);

    const doc = await contract('ksa-employment-contract', EMP_KS);
    assert.deepStrictEqual(doc.unpopulated_fields, []);
    assert.strictEqual(doc.issued, true);
    const line = probationLine(doc.content);
    assert.ok(line.indexOf('180 days') !== -1, `the KSA contract must print 180 days (got ${JSON.stringify(line)})`);
    assert.strictEqual(/month/i.test(line), false, 'a KSA contract must never state its probation ceiling in calendar months');
  });

  test('KSA 180 with the evidence REMOVED is refused, and the refusal names the extension', async () => {
    // The API will not store this state (the 422 above), so it is written directly: the ISSUE-time rule
    // has to hold against the row as stored, not against the route that usually writes it.
    writeRowDirectly('UPDATE employers SET probation_extension_reference = NULL, probation_extension_date = NULL WHERE id = ?', EMPLOYER_KS);
    try {
      const doc = await contract('ksa-employment-contract', EMP_KS);
      assert.strictEqual(doc.issued, false, 'a 180-day term enforceable only to day 90 must not be issued');
      const named = doc.missing_fields || [];
      assert.ok(named.length > 0, 'the refusal must name the facts it is missing, not stand in for them with an empty list');
      assert.ok(named.indexOf('probation extension agreement reference') !== -1,
        `the refusal must name the extension reference (it names ${JSON.stringify(named)})`);
      assert.ok(named.indexOf('probation extension agreement date') !== -1,
        `the refusal must name the extension date (it names ${JSON.stringify(named)})`);
      assert.strictEqual(String(doc.content).indexOf('[probation_period]'), -1);
      assert.strictEqual(/180 days/.test(String(doc.content)), false, 'the withheld contract carries no term');
    } finally {
      writeRowDirectly('UPDATE employers SET probation_extension_reference = ?, probation_extension_date = ? WHERE id = ?',
        'EXT-2026-0001', '2026-11-11', EMPLOYER_KS);
    }
  });

  test('90 days → issued in both, "3 months" (UAE) and "90 days" (KSA)', async () => {
    const uae = await setProbation(EMPLOYER_AE, { probation_days: '90' });
    assert.strictEqual(uae.status, 200, `90 days is lawful in the UAE (got ${uae.status}: ${uae.text})`);
    const uaeDoc = await contract('uae-employment-contract', EMP_AE);
    assert.strictEqual(uaeDoc.issued, true);
    assert.ok(probationLine(uaeDoc.content).indexOf('3 months') !== -1, 'the UAE contract prints the 3-month term');

    // The screen sends the whole form, so moving off the 180-day term sends the extension evidence
    // EMPTIED with it — which is what the client's own handler does when the term stops being KSA 180.
    const ksa = await setProbation(EMPLOYER_KS, {
      probation_days: '90', probation_extension_reference: '', probation_extension_date: '',
    });
    assert.strictEqual(ksa.status, 200, `90 days is lawful in KSA (got ${ksa.status}: ${ksa.text})`);
    assert.deepStrictEqual(ksa.json.employer.probation_not_held, [],
      'a 90-day KSA term needs no extension evidence');
    const ksaDoc = await contract('ksa-employment-contract', EMP_KS);
    assert.strictEqual(ksaDoc.issued, true);
    assert.ok(probationLine(ksaDoc.content).indexOf('90 days') !== -1, 'the KSA contract prints the 90-day term');
  });

  test('the same stored 180, read off the two contracts, is "6 months" and "180 days"', async () => {
    // The one fact, two units rule at the level a reader sees it: the same column value, two documents.
    assert.strictEqual((await setProbation(EMPLOYER_AE, { probation_days: '180' })).status, 200);
    assert.strictEqual((await setProbation(EMPLOYER_KS, {
      probation_days: '180', probation_extension_reference: 'EXT-2026-0001', probation_extension_date: '2026-11-11',
    })).status, 200);
    const uae = await contract('uae-employment-contract', EMP_AE);
    const ksa = await contract('ksa-employment-contract', EMP_KS);
    assert.ok(probationLine(uae.content).indexOf('6 months') !== -1);
    assert.ok(probationLine(ksa.content).indexOf('180 days') !== -1);
    assert.strictEqual(probationLine(ksa.content).indexOf('6 months'), -1,
      'the old failure mode was the same value printing months into a contract that counts days');
  });
});

describe('THE SCREEN IS TOLD THE SAME FACTS', () => {
  test('the record payload carries the printed term and the facts that withhold, by their labels', async () => {
    const r = await call('/api/employers');
    assert.strictEqual(r.status, 200);
    const uae = r.json.employers.filter((e) => e.id === EMPLOYER_AE)[0];
    const ksa = r.json.employers.filter((e) => e.id === EMPLOYER_KS)[0];
    assert.deepStrictEqual(uae.probation, { days: 180, value: '6', unit: 'months', text: '6 months' });
    assert.deepStrictEqual(ksa.probation, { days: 180, value: '180', unit: 'days', text: '180 days' });
    assert.deepStrictEqual(uae.probation_not_held, []);
    assert.deepStrictEqual(ksa.probation_not_held, []);
  });

  test('a term nobody chose is reported as unchosen, and the blank fact is named', async () => {
    assert.strictEqual((await setProbation(EMPLOYER_AE, { probation_days: '' })).status, 200,
      'clearing the term is a legal write: the record then holds no choice');
    const r = await call('/api/employers');
    const uae = r.json.employers.filter((e) => e.id === EMPLOYER_AE)[0];
    assert.strictEqual(uae.probation_days, null);
    assert.strictEqual(uae.probation, null, 'the screen must be able to say "nothing is chosen"');
    assert.deepStrictEqual(uae.probation_not_held, ['probation period']);
  });
});
