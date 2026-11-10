/**
 * THE EMPLOYER RECORD — one row per legal entity, and the facts the documents print.
 *
 * Owner ruling 2026-11-10, option (b): the employer is a TABLE, not a singleton. What this file holds
 * is the half of that ruling a reader cannot see from the schema:
 *
 *   * a BLANK record still WITHHOLDS — the document is not issued and the refusal names the fields,
 *     and no `[employer_po_box]`-style placeholder reaches a reader;
 *   * a FILLED record UNBLOCKS — the same document, through the same route, is issued and prints the
 *     facts the record holds;
 *   * the signatory is the RECORD'S, never the session's user, and nothing falls back to "the only
 *     employer" when the employee points at none;
 *   * the WRITE refuses what it cannot store (an unknown field, a jurisdiction outside UAE/KSA), and a
 *     blank field CLEARS the fact instead of storing an empty cell;
 *   * every fact this record fills is one `compliance_engine.REQUIRED_FACTS` will withhold a document
 *     for — the direction that matters, because a fact the record fills and the engine does not
 *     require is a bracketed blank on an ISSUED document.
 *
 * It runs a REAL server on a scratch port against a throwaway database and never touches the live
 * service, the live database or the live credential (WORKFLOW rules 5, 10, 14).
 *
 * `cd server && node --test employers.test.js`
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
const compliance = require('./compliance_engine');
const employers = require('./employers');

const SCRATCH_DB = path.join(os.tmpdir(), `antum-employers-${randomUUID()}.db`);
const PORT = 33000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
process.env.JWT_SECRET = 'employers-test-secret-not-a-production-key';
process.env.ENCRYPTION_KEY = 'c'.repeat(32);

const HR = { username: 'employers-hr', password: 'scratch-instance-password-3', role: 'hr_admin' };
const FINANCE = { username: 'employers-finance', password: 'scratch-instance-password-4', role: 'finance' };
/** The employee the documents are rendered for. Points at the employer row below. */
const EMPLOYEE = 'employer-record-employee';
/** The employer row the demo seed creates: an id and no facts at all. */
const EMPLOYER_ID = 'employer-record-under-test';

let server;
const tokens = { hr: null, finance: null };

const call = async (urlPath, { token, method = 'GET', body } = {}) => {
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
  try { json = JSON.parse(text); } catch { /* a refusal has no body by design */ }
  return { status: res.status, text, json };
};

const login = async (account) => {
  const r = await call('/api/login', { method: 'POST', body: { username: account.username, password: account.password } });
  assert.strictEqual(r.status, 200, `login for ${account.username} must answer 200 (got ${r.status})`);
  return r.json.token;
};

const notice = async (token) => {
  const r = await call(`/api/compliance/templates/privacy-notice/${EMPLOYEE}`, { token });
  assert.strictEqual(r.status, 200, `the templates route must answer (got ${r.status})`);
  return r.json;
};

before(async () => {
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, access_role) VALUES (?, ?, ?, ?)');
  insertUser.run(randomUUID(), HR.username, bcrypt.hashSync(HR.password, 4), HR.role);
  insertUser.run(randomUUID(), FINANCE.username, bcrypt.hashSync(FINANCE.password, 4), FINANCE.role);
  // The employer row as the seed writes it: an id, no facts. Every column NULL is a legal state.
  db.prepare('INSERT INTO employers (id) VALUES (?)').run(EMPLOYER_ID);
  db.prepare(`INSERT INTO employees (id, first_name, last_name, email, department, role, start_date, status,
      data_residency_country, jurisdiction, employer_id)
      VALUES (?, 'Layla', 'Mansour', ?, 'People', 'Coordinator', '2025-02-03', 'active', 'AE', 'AE', ?)`)
    .run(EMPLOYEE, `${EMPLOYEE}@example.invalid`, EMPLOYER_ID);
  db.close();

  server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB, NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  // Readiness is "the port answers", not "the port answers 200": an unauthenticated request to a
  // gated route is a 401/403 and is a perfectly good sign that the server is up. `/api/health` does
  // not exist (the public paths are `/login` and `/health`), which is how this loop first failed.
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      await fetch(`${BASE}/api/employees`);
      break;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error('the scratch server did not start');
    await new Promise((r) => setTimeout(r, 200));
  }
  tokens.hr = await login(HR);
  tokens.finance = await login(FINANCE);
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* already gone */ }
  }
});

describe('a BLANK employer record still withholds, and no placeholder reaches a reader', () => {
  test('the notice is NOT ISSUED and the refusal names the employer-side fields', async () => {
    const served = await notice(tokens.hr);
    assert.strictEqual(served.issued, false, 'a document that names facts no record holds must not be issued');
    const named = served.missing_fields || [];
    for (const fact of ['employer legal name', 'employer registered address', 'data protection contact email']) {
      assert.ok(named.indexOf(fact) !== -1, `the refusal must name "${fact}" (it names ${JSON.stringify(named)})`);
    }
  });

  test('no bracketed employer placeholder is left in what a reader receives', async () => {
    const served = await notice(tokens.hr);
    assert.strictEqual(/\[(employer|dpo|trade|mohre|qiwa|mudad)[a-z_]*\]/.test(served.content), false,
      `a reader was handed a bracketed placeholder: ${(served.content.match(/\[[a-z_]+\]/g) || []).join(', ')}`);
  });

  test('the blank record is reported as blank, field by field', async () => {
    const r = await call('/api/employers', { token: tokens.hr });
    assert.strictEqual(r.status, 200);
    const row = r.json.employers[0];
    assert.strictEqual(row.id, EMPLOYER_ID);
    assert.strictEqual(row.legal_name, null, 'a fact nobody recorded is NULL, not an empty string');
    assert.ok(row.not_held.indexOf('employer legal name') !== -1, 'the read must say which facts are blank');
    assert.ok(row.not_held.indexOf('employer PO box') !== -1, 'the PO box is one of them');
  });
});

describe('the session user is never the signatory', () => {
  test('a record with every fact EXCEPT the signatory is still withheld, and names the signatory', async () => {
    const write = await call(`/api/employers/${EMPLOYER_ID}`, {
      token: tokens.hr, method: 'PUT',
      body: {
        legal_name: 'Example Employment LLC',
        registered_address: 'Office 1, Example Tower, Dubai, UAE',
        dpo_name: 'Example Data Protection Officer',
        dpo_email: 'dpo@example.invalid',
        dpo_phone: '+971 4 000 0000',
      },
    });
    assert.strictEqual(write.status, 200, `the write must be accepted (got ${write.status}: ${write.text})`);

    // The UAE contract is the document that PRINTS a signatory (`employer_representative`, the
    // signature block of `templates/uae-employment-contract.md`); the privacy notice names the employer
    // and its data-protection contact and signs nothing, so it cannot witness this rule.
    const contractResponse = await call(`/api/compliance/templates/uae-employment-contract/${EMPLOYEE}`, { token: tokens.hr });
    assert.strictEqual(contractResponse.status, 200);
    const served = contractResponse.json;
    assert.strictEqual(served.issued, false,
      'the signatory is a fact the record does not hold, so the document is withheld rather than signed by whoever is signed in');
    assert.ok((served.missing_fields || []).indexOf('employer signatory name') !== -1,
      `the refusal must name the signatory (it names ${JSON.stringify(served.missing_fields)})`);
    assert.strictEqual(served.content.indexOf(HR.username), -1,
      'the refusal carried the signed-in account name as if it were the signatory');
  });
});

describe('a FILLED employer record unblocks the document it names', () => {
  test('once every fact the notice names is recorded, the same route ISSUES it', async () => {
    const write = await call(`/api/employers/${EMPLOYER_ID}`, {
      token: tokens.hr, method: 'PUT',
      body: {
        legal_name: 'Example Employment LLC',
        registered_address: 'Office 1, Example Tower, Dubai, UAE',
        po_box: '48201',
        city: 'Dubai',
        phone: '+971 4 000 0000',
        email: 'hr@example.invalid',
        signatory_name: 'Nadia Rahman',
        signatory_title: 'Head of People',
        trade_license: 'DED-0000001',
        mohre_code: 'EST-00001',
        qiwa_id: 'QIWA-00001',
        mudad_code: 'MUDAD-00001',
        dpo_name: 'Example Data Protection Officer',
        dpo_email: 'dpo@example.invalid',
        dpo_phone: '+971 4 000 0001',
        jurisdiction: 'UAE',
      },
    });
    assert.strictEqual(write.status, 200, `the write must be accepted (got ${write.status}: ${write.text})`);
    assert.deepStrictEqual(write.json.employer.not_held, [], 'every fact is now recorded, so none is blank');

    const served = await notice(tokens.hr);
    assert.strictEqual(served.issued, true, `the notice must be issued once the employer is recorded (missing: ${JSON.stringify(served.missing_fields)})`);
    assert.ok(served.content.indexOf('Example Employment LLC') !== -1, 'the served notice prints the employer legal name');
    assert.ok(served.content.indexOf('dpo@example.invalid') !== -1, 'the served notice prints the data-protection contact');
    assert.strictEqual(/\[(employer|dpo|trade|mohre|qiwa|mudad)[a-z_]*\]/.test(served.content), false,
      'an issued document must carry no bracketed placeholder');
  });
});

describe('the write refuses what it cannot store, and clearing a field clears the fact', () => {
  test('an unknown field is the caller\'s mistake and is named', async () => {
    const r = await call(`/api/employers/${EMPLOYER_ID}`, { token: tokens.hr, method: 'PUT', body: { trade_licence: 'typo' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /trade_licence/, 'the refusal names the field it did not recognise');
  });

  test('a jurisdiction outside UAE/KSA is refused', async () => {
    const r = await call(`/api/employers/${EMPLOYER_ID}`, { token: tokens.hr, method: 'PUT', body: { jurisdiction: 'QA' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.json.error, /UAE/);
  });

  test('an employer that does not exist is 404, not a silent success', async () => {
    const r = await call('/api/employers/no-such-employer', { token: tokens.hr, method: 'PUT', body: { city: 'Dubai' } });
    assert.strictEqual(r.status, 404);
  });

  test('a blank string CLEARS the fact rather than storing an empty cell', async () => {
    const r = await call(`/api/employers/${EMPLOYER_ID}`, { token: tokens.hr, method: 'PUT', body: { po_box: '   ' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.employer.po_box, null, 'a blank field must be stored as NULL — an empty string would print as filled');
    assert.ok(r.json.employer.not_held.indexOf('employer PO box') !== -1, 'and it is reported blank again');
  });
});

describe('the cell is the roster\'s own', () => {
  test('finance may READ the employer record and may NOT write it', async () => {
    const read = await call('/api/employers', { token: tokens.finance });
    assert.strictEqual(read.status, 200, 'finance holds employees:read, so the employer record is readable');
    const write = await call(`/api/employers/${EMPLOYER_ID}`, { token: tokens.finance, method: 'PUT', body: { city: 'Abu Dhabi' } });
    assert.strictEqual(write.status, 403, 'employees:write is hr_admin only, and the gate refuses with no body');
    assert.strictEqual(write.text, '', 'the gate\'s refusal carries no body');
  });
});

describe('the mapping is tied to the engine in the direction that matters', () => {
  test('every fact the employer record fills is one a document is withheld for', () => {
    const missing = employers.FIELDS
      .filter((field) => field.fact && !(field.fact in compliance.REQUIRED_FACTS))
      .map((field) => field.fact);
    assert.deepStrictEqual(missing, [],
      'a fact this record fills and the engine does not require would print as a bracketed blank on an ISSUED document');
  });

  test('the label the screen uses and the label a refusal names are the same words', () => {
    for (const field of employers.FIELDS) {
      if (!field.fact) continue;
      assert.strictEqual(compliance.REQUIRED_FACTS[field.fact], field.label,
        `${field.fact}: the screen says "${field.label}" and the refusal says "${compliance.REQUIRED_FACTS[field.fact]}"`);
    }
  });

  test('a record with no row yields NO facts — no default, and no fallback to another employer', () => {
    assert.deepStrictEqual(employers.factsFrom(null), {});
    assert.deepStrictEqual(employers.factsFrom(undefined), {});
    const blank = {};
    for (const field of employers.WRITABLE_COLUMNS) blank[field] = null;
    assert.deepStrictEqual(employers.factsFrom(blank), {}, 'every column NULL is a record that holds nothing');
  });
});
