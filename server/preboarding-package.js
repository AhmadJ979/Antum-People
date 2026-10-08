/**
 * Layer 2 — P2-3: the pre-reading package, and the acknowledgement record behind each item.
 *
 * The package is what the hire is given before day one: the signed JD, the org chart, the
 * reporting line, the team, the NDA, the handbook, the policies, the code of conduct and the
 * dress code. Nine items, held in ONE server-side list (`PRE_READING_SETS`) and derived from the
 * case's jurisdiction exactly as P2-2's document set is — never typed per case, never re-listed
 * per screen.
 *
 * Three rules are the whole of this module:
 *
 * 1. `sent` CANNOT EXIST. The product has no mailer, webhook or SMS (spec §9 D10), so the product
 *    cannot deliver the package. `delivery` therefore reads `not_available` on every item, with
 *    the reason spelled out, and no surface in this release may print sent / emailed / notified.
 *    This is the same discipline the flag's copy rules carry: name the honest state instead of a
 *    plausible story.
 *
 * 2. EVERY STATE IS A RECORD, NEVER AN INFERENCE. An item reads `acknowledged` only when a row
 *    exists for it in `preboarding_acknowledgements`. That check lives HERE — on the read and on
 *    the write, for every caller, the way the PDPL consent gate is enforced on the transition
 *    rather than in the UI. A case can be nine tenths done and its unrecorded item still reads
 *    `not_recorded`: progress elsewhere is never evidence for this item. There is no default, no
 *    optimistic path and no way to mark a box without writing the record.
 *
 * 3. NO INVENTED ACTOR, NO IMPLIED SIGNATURE. There is no hire-facing portal (P2-6) and no
 *    new-hire login (per-user accounts land at Layer 3), so the only honest actor in this release
 *    is the person recording on the hire's behalf. `recorded_by` is required and the module
 *    refuses without it; the method is pinned to an in-product record, and a signature-implying
 *    method is refused outright. An in-product acknowledgement is not an e-signature, and the
 *    response says so in words a surface can render directly.
 *
 * Reads are derived on every call and time-stamped: `casePackage(caseId, { as_of })` answers
 * "what was outstanding on a given date" from the records themselves, so HR's view of a past date
 * cannot be rewritten by a later acknowledgement.
 */
const { randomUUID } = require('crypto');
const db = require('./db');

/** The nine package items. One list. `acknowledgement_required` is what P2-3 names for JD/NDA. */
const PRE_READING_ITEMS = [
  {
    item_key: 'signed_jd', label: 'Signed job description (JD)', category: 'role',
    acknowledgement_required: true,
  },
  { item_key: 'org_chart', label: 'Organisation chart', category: 'context' },
  { item_key: 'reporting_line', label: 'Reporting line', category: 'context' },
  { item_key: 'team_members', label: 'Team members', category: 'context' },
  {
    item_key: 'nda', label: 'Non-disclosure agreement (NDA)', category: 'legal',
    acknowledgement_required: true,
  },
  { item_key: 'handbook', label: 'Employee handbook', category: 'policy' },
  { item_key: 'policies', label: 'Company policies', category: 'policy' },
  { item_key: 'code_of_conduct', label: 'Code of conduct', category: 'policy' },
  { item_key: 'dress_code', label: 'Dress code', category: 'policy' },
];

/**
 * The sets, by jurisdiction. `active` is UAE-first in code, the same shape P2-2's document set
 * uses: the UAE set is worked, the KSA set is kept intact and switched off, so an acknowledgement
 * cannot be recorded against it until it is turned on. Both sets carry the same nine items — this
 * is not a claim about KSA practice, and nothing here was invented to look jurisdiction-specific.
 */
const PRE_READING_SETS = {
  AE: { active: true, label: 'UAE pre-reading package', items: PRE_READING_ITEMS },
  SA: { active: false, label: 'KSA pre-reading package', items: PRE_READING_ITEMS },
};

/**
 * The delivery state, on every item, always. There is no delivery channel in this release, so
 * this is a fact about the product rather than a state the package moves through. Nothing in this
 * module returns the words "sent", "emailed" or "notified" as a success state; the label below
 * is the only place the concept appears, and it says what is true.
 */
const DELIVERY = {
  state: 'not_available',
  reason: 'no_delivery_channel',
  label: 'Not sent — this release has no delivery channel (no mailer, webhook or SMS), so the '
    + 'product cannot deliver this item',
};

/** Reading is not observable either: there is no hire-facing surface to read from (P2-6). */
const READING = {
  state: 'not_tracked',
  reason: 'no_hire_portal',
  label: 'Not tracked — there is no hire-facing portal in this release, so no read event exists '
    + 'to record',
};

/** The only method this release can honestly write. */
const RECORD_METHOD = 'in_product_record';
const RECORD_METHOD_LABEL = 'Recorded in the product by the person named — this is not an '
  + 'electronic signature';

/**
 * Methods a caller might ask for that the product cannot deliver. They are refused by name, so a
 * caller cannot quietly obtain a record that reads like a signature.
 */
const UNAVAILABLE_METHODS = ['e_signature', 'esign', 'signature', 'signed', 'electronic_signature'];

/** A rejection the caller can act on; anything else is a server fault. */
class PreboardingPackageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PreboardingPackageError';
    this.status = status;
  }
}

function packageSetFor(jurisdiction) {
  return PRE_READING_SETS[String(jurisdiction || '').toUpperCase()] || null;
}

function packageItems(jurisdiction) {
  const set = packageSetFor(jurisdiction);
  return set ? set.items.map((item) => ({ ...item })) : [];
}

function isPackageSetActive(jurisdiction) {
  const set = packageSetFor(jurisdiction);
  return Boolean(set && set.active);
}

function requiredItemKeys(jurisdiction) {
  return packageItems(jurisdiction)
    .filter((item) => item.acknowledgement_required)
    .map((item) => item.item_key);
}

async function loadCase(caseId) {
  const rows = await db.query(
    `SELECT * FROM preboarding_cases WHERE id = ${db.escapeString(caseId)}`
  );
  if (!rows.length) {
    throw new PreboardingPackageError(`No pre-boarding case with id ${caseId}`, 404);
  }
  return rows[0];
}

async function listAcknowledgements(caseId) {
  const rows = await db.query(
    'SELECT * FROM preboarding_acknowledgements WHERE case_id = '
    + `${db.escapeString(caseId)} ORDER BY acknowledged_at ASC, item_key ASC`
  );
  return rows.map((row) => ({
    ...row,
    acknowledgement_required: Boolean(row.acknowledgement_required),
    method_label: RECORD_METHOD_LABEL,
  }));
}

async function getAcknowledgement(caseId, itemKey) {
  const rows = await db.query(
    'SELECT * FROM preboarding_acknowledgements WHERE case_id = '
    + `${db.escapeString(caseId)} AND item_key = ${db.escapeString(itemKey)}`
  );
  if (!rows.length) return null;
  return {
    ...rows[0],
    acknowledgement_required: Boolean(rows[0].acknowledgement_required),
    method_label: RECORD_METHOD_LABEL,
  };
}

/**
 * Write the acknowledgement record. Every guard below is enforced here, for every caller — the
 * route is transport only. Replaying a record that exists returns it unchanged (`created: false`)
 * rather than rewriting the timestamp HR reads.
 */
async function recordAcknowledgement(input = {}) {
  const caseId = input.case_id;
  const itemKey = input.item_key;
  if (!caseId) throw new PreboardingPackageError('case_id is required', 400);
  const caseRow = await loadCase(caseId);

  const set = packageSetFor(caseRow.jurisdiction);
  if (!set) {
    throw new PreboardingPackageError(
      `No pre-reading package is defined for jurisdiction ${caseRow.jurisdiction}`, 409
    );
  }
  if (!set.active) {
    throw new PreboardingPackageError(
      `The ${caseRow.jurisdiction} pre-reading package is kept but not active in this release `
      + '(UAE-first), so no acknowledgement can be recorded against it', 409
    );
  }
  const item = set.items.find((candidate) => candidate.item_key === itemKey);
  if (!item) {
    throw new PreboardingPackageError(
      `Item ${itemKey} is not part of this case's pre-reading package `
      + `(${set.items.map((candidate) => candidate.item_key).join(', ')})`, 400
    );
  }

  // Rule 3: no invented actor. A record without a named person would imply a hire who cannot
  // yet sign in, or a system that recorded something it never observed.
  const recordedBy = typeof input.recorded_by === 'string' ? input.recorded_by.trim() : '';
  if (!recordedBy) {
    throw new PreboardingPackageError(
      'recorded_by is required: there is no new-hire login in this release, so the record must '
      + 'name the person recording the acknowledgement on the hire\'s behalf', 400
    );
  }

  // Rule 3 again, from the other side: the product cannot obtain a signature, so a caller cannot
  // ask for one.
  const method = input.method === undefined || input.method === null || input.method === ''
    ? RECORD_METHOD
    : String(input.method);
  if (UNAVAILABLE_METHODS.indexOf(method) !== -1) {
    throw new PreboardingPackageError(
      `Method ${method} is not available: the product cannot obtain an e-signature. An `
      + `acknowledgement can only be recorded as ${RECORD_METHOD}, and reads as a record rather `
      + 'than a signature', 400
    );
  }
  if (method !== RECORD_METHOD) {
    throw new PreboardingPackageError(
      `Unknown method ${method}; the only method this release can write is ${RECORD_METHOD}`, 400
    );
  }

  const existing = await getAcknowledgement(caseId, itemKey);
  if (existing) return { acknowledgement: existing, created: false, package: await casePackage(caseId) };

  const acknowledgedAt = new Date().toISOString();
  const id = randomUUID();
  await db.query(`INSERT INTO preboarding_acknowledgements (
      id, case_id, item_key, item_label, jurisdiction, acknowledgement_required,
      recorded_by, method, note, acknowledged_at
    ) VALUES (
      ${db.escapeString(id)},
      ${db.escapeString(caseId)},
      ${db.escapeString(item.item_key)},
      ${db.escapeString(item.label)},
      ${db.escapeString(caseRow.jurisdiction)},
      ${item.acknowledgement_required ? 1 : 0},
      ${db.escapeString(recordedBy)},
      ${db.escapeString(RECORD_METHOD)},
      ${db.escapeString(input.note === undefined ? null : input.note)},
      ${db.escapeString(acknowledgedAt)}
    )`);
  // The audit trail records the acknowledgement, never its note body: item keys and the state
  // change only, so nothing written here can leak a free-text field into a widely-read log.
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(recordedBy)},
      'preboarding_package_item', ${db.escapeString(caseId)}, 'ACKNOWLEDGE',
      ${db.escapeString(JSON.stringify({
        item_key: item.item_key,
        from: 'not_recorded',
        to: 'acknowledged',
        method: RECORD_METHOD,
        acknowledged_at: acknowledgedAt,
      }))},
      CURRENT_TIMESTAMP)`);

  return {
    acknowledgement: await getAcknowledgement(caseId, itemKey),
    created: true,
    package: await casePackage(caseId),
  };
}

/**
 * The package as a surface reads it: every item in the jurisdiction's list, with its delivery
 * state (always not available), its read state (always not tracked) and its acknowledgement
 * state — which is `acknowledged` only where a record exists.
 *
 * `as_of` answers the acceptance criterion "HR can see what was outstanding on a given date":
 * records written after that instant are ignored, so the view of a past date is derived from the
 * records themselves and cannot be rewritten by a later one.
 */
async function casePackage(caseId, options = {}) {
  const caseRow = await loadCase(caseId);
  const set = packageSetFor(caseRow.jurisdiction);
  const records = await listAcknowledgements(caseId);

  let asOf = null;
  if (options.as_of) {
    asOf = new Date(options.as_of);
    if (Number.isNaN(asOf.getTime())) {
      throw new PreboardingPackageError('as_of must be an ISO 8601 timestamp', 400);
    }
  }
  const byKey = new Map();
  for (const record of records) {
    if (!asOf || new Date(record.acknowledged_at) <= asOf) byKey.set(record.item_key, record);
  }

  const items = (set ? set.items : []).map((item) => {
    const record = byKey.get(item.item_key) || null;
    return {
      item_key: item.item_key,
      label: item.label,
      category: item.category,
      acknowledgement_required: Boolean(item.acknowledgement_required),
      delivery: { ...DELIVERY },
      reading: { ...READING },
      state: record ? 'acknowledged' : 'not_recorded',
      state_label: record ? 'Acknowledged' : 'Not recorded',
      acknowledged: Boolean(record),
      acknowledgement: record
        ? {
          recorded_by: record.recorded_by,
          acknowledged_at: record.acknowledged_at,
          method: record.method,
          method_label: RECORD_METHOD_LABEL,
          note: record.note,
        }
        : null,
    };
  });

  const required = items.filter((item) => item.acknowledgement_required);
  const missingRequired = required.filter((item) => !item.acknowledged);
  return {
    case_id: caseRow.id,
    offer_reference: caseRow.offer_reference,
    candidate_name: caseRow.candidate_name,
    jurisdiction: caseRow.jurisdiction,
    start_date: caseRow.start_date,
    package_label: set ? set.label : null,
    package_available: Boolean(set && set.active),
    package_unavailable_reason: !set
      ? `No pre-reading package is defined for jurisdiction ${caseRow.jurisdiction}`
      : (set.active ? null
        : `The ${caseRow.jurisdiction} pre-reading package is kept but not active in this release `
          + '(UAE-first), so no acknowledgement can be recorded against it'),
    delivery_channel: 'none',
    // One line a surface can render verbatim so no screen has to re-word this.
    copy_note: 'This release has no delivery channel and no hire-facing portal: nothing in this '
      + 'package has been sent, and no read event can exist. An acknowledgement is an in-product '
      + 'record by the person named, not an electronic signature.',
    as_of: options.as_of || null,
    item_count: items.length,
    recorded_count: items.filter((item) => item.acknowledged).length,
    required_total: required.length,
    required_recorded: required.filter((item) => item.acknowledged).length,
    missing_required: missingRequired.map((item) => item.item_key),
    items,
  };
}

module.exports = {
  PRE_READING_ITEMS,
  PRE_READING_SETS,
  DELIVERY,
  READING,
  RECORD_METHOD,
  RECORD_METHOD_LABEL,
  UNAVAILABLE_METHODS,
  PreboardingPackageError,
  packageSetFor,
  packageItems,
  isPackageSetActive,
  requiredItemKeys,
  listAcknowledgements,
  getAcknowledgement,
  recordAcknowledgement,
  casePackage,
};
