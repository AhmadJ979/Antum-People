/**
 * THE DOCUMENTS THIS PRODUCT SERVES MUST NOT INVENT A FACT.
 *
 * A document a reader can act on — a contract, a settlement statement, the notice a hire is shown —
 * may only state facts a record holds. Until 2026-10-28 `server/compliance_engine.js` filled the gaps
 * with defaults, so the served contract printed an employer ("Antum Regional Hub"), a trade licence
 * ("TL-882733-G"), a MoHRE establishment code ("EST-99228"), a Qiwa ID ("QIWA-88271") and a signatory
 * title ("HR Director"); the notice printed a Controller and a data-protection address
 * ("privacy@antum.ae") that exists nowhere else in the product; and the settlement statement printed
 * `0.00` down its money rows and a NET PAYABLE computed from a salary nobody had recorded.
 *
 * WHAT THIS HOLDS
 *   * no served document contains any of those literals — read from the SERVED BODY through the
 *     routes, not from the source file, over EVERY template on disk and both notice routes;
 *   * a document that names a fact no record holds is NOT ISSUED: no body of a contract, a
 *     settlement statement or the notice leaves the server, and the refusal names what is missing;
 *   * the positive control: hand the renderer every fact and it still produces the document — so
 *     "refuse" is not the only behaviour this file would accept;
 *   * the notice route's raw text is the repository's own file, byte for byte, and it names its own
 *     unfilled placeholders instead of serving an invented Controller;
 *   * every template on disk is CLASSIFIED, so a new document cannot be served without someone
 *     deciding whether it is an instrument or a form.
 *
 * It runs a REAL server on a scratch port against a throwaway database and never touches the live
 * service, the live database or the live credential (WORKFLOW rules 5, 10, 14). Rule 40 does not
 * apply: this is a test, not an uptime observer.
 *
 * `cd server && node --test served-document-facts.test.js`
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

const SCRATCH_DB = path.join(os.tmpdir(), `antum-served-docs-${randomUUID()}.db`);
const PORT = 31000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = 'served-documents-test-secret-not-a-production-key';
const ENCRYPTION_KEY = 'b'.repeat(32);
const ACCOUNT = 'docs-hr';
const PASSWORD = 'scratch-instance-password-2';
/** An employee whose record holds every amount the templates ask for. */
const WITH_MONEY = 'docs-with-money';
/** An employee whose record holds no salary at all — the row that used to print a 0.00 net. */
const NO_MONEY = 'docs-no-money';

/**
 * The literals this change exists to remove. Typed out here rather than imported from the module
 * under test: a guard that reads its own list from the code it guards cannot notice that the code
 * changed the list. (The engine keeps its own copy for the same reason, in `REQUIRED_FACTS`.)
 */
const INVENTED_LITERALS = [
  'Antum Regional Hub',
  'Dubai Internet City, UAE / Riyadh Business Gate, KSA',
  'TL-882733-G',
  'EST-99228',
  'QIWA-88271',
  'HR Director',
  'privacy@antum.ae',
];

/** Markers of a document's own body — what must NOT reach a reader when a document is not issued. */
const BODY_MARKERS = {
  'uae-employment-contract': ['PART 1: PARTY INFORMATION', 'IN WITNESS WHEREOF'],
  'ksa-employment-contract': ['PART 1', 'IN WITNESS WHEREOF'],
  'final-settlement-statement': ['NET PAYABLE AMOUNT', 'Acknowledgment & Waiver'],
  'privacy-notice': ['Controller / Data Controller', 'How to exercise your rights'],
};

const TEMPLATE_NAMES = fs.readdirSync(path.join(__dirname, '..', 'templates'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

let server;
const authToken = { value: null };

const api = async (urlPath) => {
  const headers = authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {};
  const res = await fetch(BASE + urlPath, { headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
};

/** One rendered template, as a reader receives it. */
const servedDocument = async (templateName, employeeId) => {
  const r = await api(`/api/compliance/templates/${templateName}/${employeeId}`);
  assert.strictEqual(r.status, 200, `the route must answer for ${templateName} (got ${r.status})`);
  assert.ok(r.json && typeof r.json.content === 'string', `${templateName} must carry content`);
  return r.json;
};

before(async () => {
  const db = new DatabaseSync(SCRATCH_DB);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  db.prepare('INSERT INTO users (id, username, password_hash, access_role) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), ACCOUNT, bcrypt.hashSync(PASSWORD, 4), 'hr_admin');
  db.prepare(`INSERT INTO employees (id, first_name, last_name, email, department, role, start_date, end_date,
      status, salary, basic_salary, eosb_accrued, data_residency_country, termination_type)
      VALUES (?, 'Amina', 'Haddad', ?, 'Finance', 'Analyst', '2024-01-15', '2026-10-10', 'offboarding',
      16000, 11000, 6415.79, 'AE', 'resignation')`)
    .run(WITH_MONEY, `${WITH_MONEY}@example.invalid`);
  db.prepare(`INSERT INTO employees (id, first_name, last_name, email, start_date, status, data_residency_country)
      VALUES (?, 'Bilal', 'Nasser', ?, '2026-09-01', 'onboarding', 'AE')`)
    .run(NO_MONEY, `${NO_MONEY}@example.invalid`);
  db.close();
  server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), PRODUCT_DB_PATH: SCRATCH_DB, JWT_SECRET, ENCRYPTION_KEY },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  const deadline = Date.now() + 30000;
  for (;;) {
    try { await fetch(BASE + '/api/employees'); break; }
    catch { if (Date.now() > deadline) throw new Error('the scratch server never answered'); await new Promise((r) => setTimeout(r, 250)); }
  }
  const login = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ACCOUNT, password: PASSWORD }),
  });
  const body = await login.json();
  assert.strictEqual(login.status, 200, 'the fixture account must be able to log in');
  authToken.value = body.token;
});

after(() => {
  if (server) server.kill('SIGKILL');
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(SCRATCH_DB + suffix); } catch { /* not there */ } }
});

describe('no served document contains a fact we invented', () => {
  test('not one of them, in any template on disk or in the notice text', async () => {
    const offenders = [];
    const notice = await api('/api/compliance/notice');
    assert.strictEqual(notice.status, 200);
    const served = [['/api/compliance/notice', notice.json.content]];
    for (const name of TEMPLATE_NAMES) {
      for (const employeeId of [WITH_MONEY, NO_MONEY]) {
        served.push([`/api/compliance/templates/${name}/${employeeId}`, (await servedDocument(name, employeeId)).content]);
      }
    }
    for (const [url, content] of served) {
      for (const literal of INVENTED_LITERALS) {
        if (content.indexOf(literal) !== -1) offenders.push(`${url} serves ${JSON.stringify(literal)}`);
      }
    }
    assert.deepStrictEqual(offenders, [], 'a served document still states a fact no record holds');
  });

  test('the control: the same read catches a literal the engine would have to be told to keep', () => {
    // The check above is only worth something if it can see a literal at all. This plants one in the
    // renderer's own output and requires the same comparison to notice it.
    const planted = compliance.renderTemplate('[employer_name]', { employer_name: 'Antum Regional Hub' });
    const found = INVENTED_LITERALS.filter((literal) => planted.content.indexOf(literal) !== -1);
    assert.deepStrictEqual(found, ['Antum Regional Hub'], 'the comparison must redden on the defect it closes');
  });
});

describe('a document that names a fact we do not hold is not issued', () => {
  for (const [templateName, markers] of Object.entries(BODY_MARKERS)) {
    test(`${templateName}: the refusal reaches the reader, and the document does not`, async () => {
      const doc = await servedDocument(templateName, WITH_MONEY);
      assert.strictEqual(doc.issued, false, `${templateName} must not be issued`);
      assert.ok(doc.missing_fields.length > 0, 'the refusal names the facts that are missing');
      assert.strictEqual(doc.content.indexOf('NOT ISSUED') !== -1, true, 'the body says so in words');
      for (const marker of markers) {
        assert.strictEqual(doc.content.indexOf(marker), -1,
          `${templateName} shipped part of its document body (${JSON.stringify(marker)}) inside a refusal`);
      }
    });
  }

  test('the refusal names the facts THAT DOCUMENT states and no record holds — and not the held ones', async () => {
    const settlement = await servedDocument('final-settlement-statement', WITH_MONEY);
    // The settlement statement states these and nothing holds them; a refusal that named anything
    // else would send a reader to record the wrong fact.
    for (const fact of ['employer legal name', 'total deductions', 'net settlement payable']) {
      assert.ok(settlement.missing_fields.indexOf(fact) !== -1,
        `the settlement refusal must name ${fact} (got ${JSON.stringify(settlement.missing_fields)})`);
    }
    // ... and it must NOT name an amount the record holds: the money half of this document is real.
    for (const fact of ['end-of-service benefit', 'pro-rated final salary']) {
      assert.strictEqual(settlement.missing_fields.indexOf(fact), -1,
        `${fact} IS held on the employee's row, so it must not be named as missing`);
    }
    // A fact the settlement does not state is not in its refusal, even though we hold it nowhere:
    // the licence row belongs to the contract, and naming it here would be noise a reader must filter.
    assert.strictEqual(settlement.missing_fields.indexOf('trade licence number'), -1);
    const contract = await servedDocument('uae-employment-contract', WITH_MONEY);
    assert.ok(contract.missing_fields.indexOf('trade licence number') !== -1,
      'the contract DOES state a licence number, so its refusal names it');
  });

  test('a record with no salary cannot produce a settlement at all', async () => {
    const doc = await servedDocument('final-settlement-statement', NO_MONEY);
    assert.strictEqual(doc.issued, false);
    assert.ok(doc.missing_fields.indexOf('pro-rated final salary') !== -1, 'the missing salary is named');
    assert.strictEqual(doc.content.indexOf('NET PAYABLE'), -1, 'the payment section does not reach a reader at all');
  });
});

describe('the positive control: with the facts held, the document IS produced', () => {
  test('the renderer issues the contract, and never the invented values, when every fact is supplied', () => {
    const facts = {
      employer_name: 'Example Employment LLC',
      employer_address: 'Office 1, Example Tower, Dubai, UAE',
      employer_representative: 'Nadia Rahman',
      employer_representative_title: 'Head of People',
      trade_license: 'CN-0000001',
      mohre_code: 'EST-0000001',
      qiwa_id: 'QIWA-0000001',
      dpo_email: 'dpo@example.invalid',
      probation_period: '6 months',
      visa_status: 'Employment Visa',
      basic_salary: '11000.00',
      total_salary: '16000.00',
      eosb_amount: '6415.79',
      final_pro_rated_salary: '5161.29',
      unused_leave_amount: '0.00',
      notice_pay: '0.00',
      ticket_allowance: '0.00',
      other_payments: '0.00',
      gross_settlement: '11577.08',
      loan_deduction: '0.00',
      assets_deduction: '0.00',
      fine_deduction: '0.00',
      total_deductions: '0.00',
      net_settlement: '11577.08',
      full_name: 'Amina Haddad',
      employee_id: WITH_MONEY,
      termination_reason: 'resignation',
      end_date: '2026-10-10'
    };
    for (const templateName of Object.keys(BODY_MARKERS)) {
      const file = fs.readFileSync(path.join(__dirname, '..', 'templates', `${templateName}.md`), 'utf8');
      const rendered = compliance.renderTemplate(file, facts);
      assert.deepStrictEqual(rendered.missing, [], `${templateName}: nothing is missing when the facts are held`);
      for (const literal of INVENTED_LITERALS) {
        assert.strictEqual(rendered.content.indexOf(literal), -1, `${templateName} printed ${JSON.stringify(literal)}`);
      }
      for (const marker of BODY_MARKERS[templateName]) {
        assert.ok(rendered.content.indexOf(marker) !== -1, `${templateName} must still be a document when it can be issued`);
      }
    }
  });
});

describe('the notice is served as its own text, and says which of its lines are blank', () => {
  test('the raw route serves the repository file byte for byte', async () => {
    const r = await api('/api/compliance/notice');
    const onDisk = fs.readFileSync(path.join(__dirname, '..', 'templates', 'privacy-notice.md'), 'utf8');
    assert.strictEqual(r.json.content, onDisk, 'the notice a record names must be the file the repository holds');
  });

  test('its Controller and data-protection contact are named as unfilled, not filled in', async () => {
    const r = await api('/api/compliance/notice');
    const named = r.json.unpopulated_placeholders || [];
    for (const fact of ['employer_name', 'dpo_email']) {
      assert.ok(named.indexOf(fact) !== -1, `a reader sees [${fact}] as a blank, and the payload must say so`);
    }
    assert.strictEqual(/Controller[^:]*:\s*Antum/.test(r.json.content), false, 'no Controller is invented in the text');
  });
});

describe('the document class is declared for every template, not defaulted', () => {
  test('every template on disk is in the table', () => {
    assert.deepStrictEqual(TEMPLATE_NAMES.filter((name) => !(name in compliance.DOCUMENT_CLASS)), [],
      'a template nobody classified would be served as an unknown document');
  });

  test('the four instruments and the three forms are classified as the PR body says', () => {
    assert.deepStrictEqual(
      TEMPLATE_NAMES.map((name) => [name, compliance.documentClassFor(name)]).sort(),
      [
        ['breach-notification-letters', 'form'],
        ['data-processing-agreement', 'form'],
        ['dpia-questionnaire', 'form'],
        ['final-settlement-statement', 'instrument'],
        ['ksa-employment-contract', 'instrument'],
        ['privacy-notice', 'instrument'],
        ['uae-employment-contract', 'instrument'],
      ].sort()
    );
  });

  test('an unknown template is treated as an instrument — withheld rather than issued', () => {
    assert.strictEqual(compliance.documentClassFor('a-template-nobody-classified'), 'instrument');
  });
});
