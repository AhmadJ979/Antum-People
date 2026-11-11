/**
 * THE EMPLOYER RECORD → THE FACTS A DOCUMENT PRINTS
 * --------------------------------------------------
 * Owner ruling 2026-11-10, option (b): the employer is a TABLE with one row per legal entity, and an
 * employee points at one (`employees.employer_id`). This module is the one place that says which
 * column fills which placeholder, so the screen that writes the record, the route that serves it and
 * the templates that print it cannot disagree about a field name.
 *
 * WHAT IT WILL NOT DO, and each refusal is the reason the module exists:
 *
 *   * NO DEFAULT. A column that is NULL or blank contributes NO fact. It is not filled with `''`, not
 *     with `'N/A'`, and not with the label — the renderer already knows what to do with a fact it was
 *     not given (`server/compliance_engine.js#renderTemplate`: a REQUIRED_FACTS key with no value is
 *     rendered as a legible blank, named in `missing`, and an instrument is WITHHELD). Serving `''`
 *     here would print an empty cell on a contract and call it filled.
 *   * NEVER THE SESSION'S USER AS SIGNATORY. `signatory_name`/`signatory_title` come from the
 *     employer row and from nowhere else. The person filling the form in is not the person who signs
 *     for the company, and a document that signed itself with whoever was logged in would be a
 *     fabricated signature — the same class of defect as the invented party name this change closes.
 *     Nothing in this module takes a request, a user or an actor for exactly that reason.
 *   * NO FALLBACK TO "THE ONLY EMPLOYER". An employee whose `employer_id` is NULL gets no facts. The
 *     tempting convenience — one row in the table, so use it — is a guess about which legal entity
 *     employs that person, and it is the guess that would print the wrong company on a contract.
 *
 * The template placeholders this record fills, measured from `templates/` (the four documents that
 * name the employer): `employer_name`, `employer_address`, `employer_po_box`, `employer_city`,
 * `employer_phone`, `employer_email`, `employer_representative`, `employer_representative_title`,
 * `trade_license`, `mohre_code`, `qiwa_id`, `mudad_code`, `dpo_name`, `dpo_email`, `dpo_phone`.
 */

/**
 * Column → the placeholder it fills, in the order the record is laid out for a reader.
 *
 * `label` is the wording `compliance_engine.REQUIRED_FACTS` (or, for a fact that does not withhold a
 * document, `OPTIONAL_FACTS`) uses for the same fact, so the refusal a reader gets names the field the
 * screen names. The lists are tied together by a test (`server/employers.test.js`), because a fact
 * this record fills and the engine knows nothing about would print as a bracketed blank on an issued
 * document — the defect this change closes.
 */
const { OPTIONAL_FACTS } = require('./compliance_engine');
const probationTerm = require('./probation-term');

const FIELDS = Object.freeze([
  { column: 'legal_name', fact: 'employer_name', label: 'employer legal name' },
  { column: 'jurisdiction', fact: null, label: 'jurisdiction' },
  { column: 'registered_address', fact: 'employer_address', label: 'employer registered address' },
  { column: 'po_box', fact: 'employer_po_box', label: 'employer PO box' },
  { column: 'city', fact: 'employer_city', label: 'employer city' },
  { column: 'phone', fact: 'employer_phone', label: 'employer phone' },
  { column: 'email', fact: 'employer_email', label: 'employer email' },
  { column: 'signatory_name', fact: 'employer_representative', label: 'employer signatory name' },
  { column: 'signatory_title', fact: 'employer_representative_title', label: 'employer signatory title' },
  { column: 'trade_license', fact: 'trade_license', label: 'trade licence number' },
  { column: 'mohre_code', fact: 'mohre_code', label: 'MoHRE establishment code' },
  { column: 'qiwa_id', fact: 'qiwa_id', label: 'Qiwa establishment ID' },
  { column: 'mudad_code', fact: 'mudad_code', label: 'Mudad establishment code' },
  { column: 'dpo_name', fact: 'dpo_name', label: 'data protection contact name' },
  { column: 'dpo_email', fact: 'dpo_email', label: 'data protection contact email' },
  { column: 'dpo_phone', fact: 'dpo_phone', label: 'data protection contact phone' },
]);

/**
 * The columns a write may set — every field above, plus the probation term and its extension
 * evidence, and nothing else (no `id`, no timestamps).
 *
 * The probation columns are NOT in `FIELDS` on purpose: `FIELDS` is the column → placeholder mapping
 * for a fact that prints as itself, and a probation term does not. One stored number of days prints
 * as "6 months" in a UAE contract and "180 days" in a KSA one, so the rendering is jurisdiction work
 * (`server/probation-term.js`) and the raw column must never reach a template as a fact.
 */
const WRITABLE_COLUMNS = Object.freeze(FIELDS.map((f) => f.column).concat(probationTerm.COLUMNS));

/** The two markets this record can name. Stored as the market, not as the employee residency code
 *  (`employees.jurisdiction` holds `AE`/`SA`, which is a residence question, not an entity one). */
const JURISDICTIONS = Object.freeze(['UAE', 'KSA']);

/** Is this value a fact the record actually holds? A blank is not. */
function held(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * The facts a template may be rendered from, for one employer row.
 *
 * Only the columns that hold something appear in the result: a blank column is ABSENT, so the
 * renderer reports it missing rather than printing it. `null` row (no employer linked) yields `{}`.
 *
 * @param {object|null|undefined} row one `employers` row, or nothing
 * @returns {Record<string, string>} placeholder → value
 */
function factsFrom(row) {
  const facts = {};
  if (!row) return facts;
  for (const field of FIELDS) {
    if (!field.fact) continue;
    const value = row[field.column];
    if (held(value)) facts[field.fact] = String(value).trim();
  }
  return facts;
}

/**
 * The fields this record does NOT hold, by the label the screen and the refusal both use.
 * A reader of the settings screen is told what is still blank; a reader of a withheld document is
 * told the same thing by `renderTemplate`'s `missing`.
 */
function notHeld(row) {
  const absent = [];
  for (const field of FIELDS) {
    if (!held(row ? row[field.column] : null)) absent.push(field.label);
  }
  return absent;
}

/**
 * The subset of `notHeld` that does NOT withhold a document.
 *
 * Owner ruling 2026-11-10 (the KSA/Mudad question): the Mudad establishment code is required only
 * where the employer is enrolled, so a blank one stops nothing — a document that prints it says
 * "not held" in words (`server/compliance_engine.js#OPTIONAL_FACTS`). The screen needs both lists to
 * tell the truth: `not_held` is what is blank, and this is the part of it that does not withhold.
 * Kept here, beside the mapping, so the screen never derives it from a second list that could drift.
 */
function notHeldOptional(row) {
  return notHeld(row).filter((label) => {
    const field = FIELDS.filter((f) => f.label === label)[0];
    return Boolean(field && field.fact && Object.prototype.hasOwnProperty.call(OPTIONAL_FACTS, field.fact));
  });
}

/**
 * Validate and normalise a write body into column values.
 *
 * Strings only, trimmed, and a blank string becomes SQL NULL — the same "blank is not a fact" rule
 * the read side applies, so a screen that saves an emptied field clears the fact instead of storing
 * `''` that would print as an empty cell. An unknown key is the caller's mistake and is named; it is
 * never ignored, because a typo silently dropped is a field the reader believes they saved.
 *
 * @returns {{values: Record<string,string|null>|null, problem: string|null}}
 */
function normalise(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { values: null, problem: 'the request body must be a JSON object' };
  }
  const unknown = Object.keys(body).filter((k) => WRITABLE_COLUMNS.indexOf(k) === -1);
  if (unknown.length) {
    return { values: null, problem: `unknown field(s): ${unknown.join(', ')} — a field this record does not hold cannot be written` };
  }
  const values = {};
  for (const column of WRITABLE_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
    const raw = body[column];
    if (raw === null || raw === undefined) { values[column] = null; continue; }
    // THE PROBATION TERM IS A NUMBER OF DAYS, and only the two the client may choose. It arrives as a
    // JSON string from the screen's `<select>` and as a number from any other caller, so both are
    // accepted and both are stored as the integer — one value, one type. Anything else is refused by
    // name rather than stored: the database CHECK would refuse it too, and a rule the client alone
    // enforces is not a rule.
    if (column === 'probation_days') {
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        return { values: null, problem: 'probation_days must be 90 or 180' };
      }
      const text = String(raw).trim();
      if (text === '') { values[column] = null; continue; }
      const days = Number(text);
      if (probationTerm.TERMS.indexOf(days) === -1) {
        return { values: null, problem: `probation_days must be one of ${probationTerm.TERMS.join(' / ')} — the two terms a client may choose` };
      }
      values[column] = days;
      continue;
    }
    if (typeof raw !== 'string') {
      return { values: null, problem: `${column} must be a string` };
    }
    const trimmed = raw.trim();
    if (column === 'jurisdiction' && trimmed !== '' && JURISDICTIONS.indexOf(trimmed) === -1) {
      return { values: null, problem: `jurisdiction must be one of ${JURISDICTIONS.join(' / ')}` };
    }
    if (column === 'probation_extension_date' && trimmed !== '') {
      const problem = probationTerm.dateProblem(trimmed);
      if (problem) return { values: null, problem: `probation_extension_date ${problem}` };
    }
    values[column] = trimmed === '' ? null : trimmed;
  }
  return { values, problem: null };
}

module.exports = {
  FIELDS,
  WRITABLE_COLUMNS,
  JURISDICTIONS,
  factsFrom,
  notHeld,
  notHeldOptional,
  normalise,
};
