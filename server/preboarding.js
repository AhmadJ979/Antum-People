/**
 * Antum People — Layer 2 · Pre-boarding Intelligence
 * P2-1: an accepted job offer opens a pre-boarding case.
 *
 * ---------------------------------------------------------------------------
 * ONE PAYLOAD, ONE WRITER
 * ---------------------------------------------------------------------------
 * `recordOfferAcceptance()` below is the only function in this product that creates a
 * pre-boarding case, and `preboarding_cases` has exactly one INSERT call site in server/.
 * Today one caller uses it — the intake form, through POST /api/preboarding/cases in
 * index.js. When a signed pilot has a documented, credentialled system and wants automated
 * sync, the ATS adapter is a second CALLER of this same function, not a second
 * implementation of these rules; two implementations of validation, idempotency and the
 * start-date invariant would drift the moment either changed.
 * `server/preboarding.test.js` asserts the single call site so a second writer cannot be
 * added quietly.
 *
 * The trigger is the offer acceptance and nothing else: this module opens a case only from
 * a payload that describes an accepted offer. An employee row created through
 * POST /api/employees is a different object and does not open a case.
 *
 * Idempotency is per accepted offer — `offer_reference` identifies the offer (the HR
 * reference today, the ATS's offer id later) and is UNIQUE in the schema, so replaying the
 * same acceptance returns the existing case instead of opening a second one.
 */

const { randomUUID } = require('crypto');
const db = require('./db');
const items = require('./preboarding-items');
const workspace = require('./preboarding-workspace');

// A real field, not a UAE constant: launch is UAE-first, KSA stays in the engine.
const SUPPORTED_JURISDICTIONS = ['AE', 'SA'];

/** A rejection the caller can act on; anything else is a server fault. */
class OfferAcceptanceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'OfferAcceptanceError';
    this.status = status;
  }
}

const asText = (value) =>
  value === null || value === undefined ? '' : String(value).trim();

/**
 * Normalises and validates an accepted-offer payload.
 * Throws OfferAcceptanceError(400) naming the field that is missing or wrong, so the form
 * can show a usable message instead of a generic 500.
 */
function normaliseOfferAcceptance(payload) {
  const raw = payload || {};
  const value = {
    offer_reference: asText(raw.offer_reference),
    candidate_name: asText(raw.candidate_name),
    candidate_email: asText(raw.candidate_email) || null,
    role: asText(raw.role),
    department: asText(raw.department),
    reporting_line: asText(raw.reporting_line),
    jurisdiction: asText(raw.jurisdiction).toUpperCase(),
    start_date: asText(raw.start_date).slice(0, 10),
    offered_at: asText(raw.offered_at) || null,
  };

  if (!value.offer_reference) {
    throw new OfferAcceptanceError(
      'offer_reference is required: it identifies the accepted offer, and it is what keeps one offer to one case'
    );
  }
  if (!value.candidate_name) throw new OfferAcceptanceError('candidate_name is required');
  if (!value.role) throw new OfferAcceptanceError('role is required');
  if (!value.department) throw new OfferAcceptanceError('department is required');
  if (!value.reporting_line) throw new OfferAcceptanceError('reporting_line is required');
  if (!SUPPORTED_JURISDICTIONS.includes(value.jurisdiction)) {
    throw new OfferAcceptanceError(
      `jurisdiction is required and must be one of ${SUPPORTED_JURISDICTIONS.join(', ')}`
    );
  }
  if (!value.start_date) {
    throw new OfferAcceptanceError('start_date is required: a pre-boarding case cannot exist without one');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.start_date)) {
    throw new OfferAcceptanceError('start_date must be a YYYY-MM-DD date');
  }

  return value;
}

const SELECT_CASE = 'SELECT * FROM preboarding_cases';

async function findByOfferReference(offerReference) {
  const rows = await db.query(
    `${SELECT_CASE} WHERE offer_reference = ${db.escapeString(offerReference)}`
  );
  return rows[0] || null;
}

// The statuses a case can carry. Only 'open' is written by the product today; 'closed' is what
// a finished case will be. The filter names the values it accepts instead of passing anything
// through, because a caller asking for a status nobody writes must not be told "no cases".
const CASE_STATUSES = ['open', 'closed'];

/**
 * The totals for a set of cases a caller has already read. Pure: it queries nothing.
 *
 * `{cases, totals}` is the collection contract **at HTTP** (`GET /api/preboarding/cases`), but the
 * envelope is composed at the route, not here: this module is an internal API, `listCases` keeps
 * returning a plain array for its module-level callers and their tests, and the arithmetic behind
 * the number a caller reads lives in exactly one place — this function.
 *
 * `open + closed === cases` because `CASE_STATUSES` is exactly those two values.
 */
function caseTotals(cases) {
  const rows = Array.isArray(cases) ? cases : [];
  return {
    cases: rows.length,
    open: rows.filter((row) => row.status === 'open').length,
    closed: rows.filter((row) => row.status === 'closed').length,
  };
}

async function listCases(options = {}) {
  const conditions = [];
  if (options.jurisdiction) {
    conditions.push(`jurisdiction = ${db.escapeString(String(options.jurisdiction).toUpperCase())}`);
  }
  if (options.status !== undefined && options.status !== null && options.status !== '') {
    const status = String(options.status).toLowerCase();
    if (CASE_STATUSES.indexOf(status) === -1) {
      throw new OfferAcceptanceError(`status must be one of ${CASE_STATUSES.join(', ')}`, 400);
    }
    conditions.push(`status = ${db.escapeString(status)}`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  return db.query(`${SELECT_CASE}${where} ORDER BY start_date ASC, created_at ASC`);
}

async function getCase(id) {
  const rows = await db.query(`${SELECT_CASE} WHERE id = ${db.escapeString(id)}`);
  return rows[0] || null;
}

/**
 * The single writer: records an accepted offer and opens its pre-boarding case.
 *
 * @param {object} payload  the accepted offer (see normaliseOfferAcceptance)
 * @param {object} [options]
 * @param {string} [options.actor]   who recorded it, for the audit trail
 * @param {string} [options.source]  'intake_form' today, 'ats' for the future adapter
 * @returns {Promise<{case: object, created: boolean}>} created=false means the offer
 *          already had a case and this call changed nothing.
 */
async function recordOfferAcceptance(payload, options = {}) {
  const claim = normaliseOfferAcceptance(payload);
  const actor = options.actor || 'system';
  const source = options.source || 'intake_form';

  // Replay of the same acceptance: hand back the case that exists, create nothing.
  const existing = await findByOfferReference(claim.offer_reference);
  if (existing) return { case: existing, created: false };

  const id = randomUUID();
  try {
    await db.query(`
      INSERT INTO preboarding_cases (
        id, offer_reference, candidate_name, candidate_email, role, department,
        reporting_line, jurisdiction, start_date, status, source, offered_at, created_by
      ) VALUES (
        ${db.escapeString(id)},
        ${db.escapeString(claim.offer_reference)},
        ${db.escapeString(claim.candidate_name)},
        ${db.escapeString(claim.candidate_email)},
        ${db.escapeString(claim.role)},
        ${db.escapeString(claim.department)},
        ${db.escapeString(claim.reporting_line)},
        ${db.escapeString(claim.jurisdiction)},
        ${db.escapeString(claim.start_date)},
        'open',
        ${db.escapeString(source)},
        ${db.escapeString(claim.offered_at)},
        ${db.escapeString(actor)}
      )
    `);
  } catch (err) {
    // Two callers processing the same acceptance at the same moment: the UNIQUE constraint
    // is the guarantee, so whoever loses that race returns the case that was created.
    const raced = await findByOfferReference(claim.offer_reference);
    if (raced) return { case: raced, created: false };
    throw err;
  }

  const created = await findByOfferReference(claim.offer_reference);
  // The employee track (P2-2) arrives with the case: the checklist is seeded from the case's
  // jurisdiction set here, on the same single creation path, so no case exists without one.
  // Seeding is idempotent (UNIQUE case_id+item_key), so it cannot duplicate on a replay.
  const checklist = await items.seedItemsForCase(created);
  // The workspace track (P2-4) arrives on the same path and from the same case row: its lines are
  // a consequence of the role and department recorded above, so there is no second way to create
  // a case, and none that could carry a hand-typed list. Also idempotent.
  const workspaceLines = await workspace.seedWorkspaceItemsForCase(created);
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(actor)}, 'preboarding_case',
      ${db.escapeString(created.id)}, 'CREATE',
      ${db.escapeString(JSON.stringify({
        offer_reference: created.offer_reference,
        start_date: created.start_date,
        role: created.role,
        department: created.department,
        reporting_line: created.reporting_line,
        jurisdiction: created.jurisdiction,
        source: created.source,
      }))}, CURRENT_TIMESTAMP)`);

  return {
    case: created,
    created: true,
    checklist_items: checklist.length,
    workspace_lines: workspaceLines.length,
  };
}

module.exports = {
  SUPPORTED_JURISDICTIONS,
  CASE_STATUSES,
  OfferAcceptanceError,
  normaliseOfferAcceptance,
  recordOfferAcceptance,
  listCases,
  caseTotals,
  getCase,
};
