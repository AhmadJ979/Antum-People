/**
 * Antum People — Layer 2 · Pre-boarding Intelligence
 * P2-2: the employee track — pre-boarding document collection.
 *
 * ---------------------------------------------------------------------------
 * ONE MODULE OWNS THE CHECKLIST
 * ---------------------------------------------------------------------------
 * This file holds every rule about the employee track: which items a case carries, the item
 * status machine, the reminder records, and the PDPL consent gate that the collection step
 * reads. The routes in index.js are transport only — they carry no checklist rules of their
 * own, so an ATS adapter or a hire-facing portal later becomes another CALLER, never a second
 * implementation.
 *
 * Two rules this module exists to keep:
 *
 * 1. Items are derived from the case's jurisdiction, never typed per case. `DOCUMENT_SETS`
 *    below is data: the UAE set is the active one (UAE-first), the KSA set is kept and
 *    switched off, so re-enabling it is an edit to this table and not a code change. Nothing
 *    here asserts what any jurisdiction legally requires — the items are the documents an
 *    HR team collects, and the compliance engine remains the only place a statutory claim
 *    could ever be sourced from.
 *
 * 2. A document cannot be collected before the PDPL consent record exists. "Collected" means
 *    an item reaches `received`, and the check sits on that transition — not in the UI, which
 *    a direct API call would bypass. P2-6 owns the consent lifecycle (notice versioning,
 *    withdrawal, the Arabic-first notice, the hire-facing capture); P2-2 ships the record the
 *    gate reads and nothing more.
 *
 * What this module deliberately does NOT do: hold a document's contents. An item carries a
 * short `document_reference` (a file name or the reference the hire quoted), not the personal
 * data inside the document — there is no file storage in this release, and `document_reference`
 * never enters the audit trail.
 */

const { randomUUID } = require('crypto');
const db = require('./db');
const preboardingFlag = require('./preboarding-flag');
// The workspace track (P2-4) owns its own catalog and its own switch. This module asks it two
// questions — is the track active for a jurisdiction, and what are the per-track counts — rather
// than holding a copy of either answer.
const workspace = require('./preboarding-workspace');

/** The four statuses every item carries. Every item is in exactly one of them at all times. */
const ITEM_STATUSES = ['not_started', 'requested', 'received', 'verified'];

/** Received or verified: the two statuses that mean we hold the document. */
const COLLECTED_STATUSES = ['received', 'verified'];

/**
 * The status machine. `verified` is terminal in P2-2: a verified document is not reopened
 * through this API, and a rejection sends it back to `requested` for the next correction.
 */
const ALLOWED_TRANSITIONS = {
  not_started: ['requested'],
  requested: ['received', 'not_started'],
  received: ['verified', 'requested'],
  verified: [],
};

/**
 * The document sets, by jurisdiction. `active` is what UAE-first means in code: the UAE set
 * is worked, the KSA set is kept intact but cannot be collected against until it is switched
 * on. The KSA list is the same collection of documents — it is not a claim about KSA law,
 * and nothing here was invented to look jurisdiction-specific.
 */
const DOCUMENT_SETS = {
  AE: {
    active: true,
    label: 'UAE pre-boarding documents',
    items: [
      { item_key: 'passport', label: 'Passport copy', category: 'identity' },
      { item_key: 'visa_or_entry_permit', label: 'Visa or entry permit', category: 'immigration' },
      { item_key: 'emirates_id', label: 'Emirates ID', category: 'identity' },
      { item_key: 'education_certificate', label: 'Education certificate', category: 'qualification' },
      { item_key: 'experience_certificate', label: 'Experience certificate', category: 'qualification' },
      { item_key: 'bank_details', label: 'Bank details (IBAN letter)', category: 'payroll' },
      { item_key: 'emergency_contact', label: 'Emergency contact', category: 'welfare' },
    ],
  },
  SA: {
    active: false,
    label: 'KSA pre-boarding documents',
    items: [
      { item_key: 'passport', label: 'Passport copy', category: 'identity' },
      { item_key: 'visa_or_entry_permit', label: 'Visa or entry permit', category: 'immigration' },
      { item_key: 'education_certificate', label: 'Education certificate', category: 'qualification' },
      { item_key: 'experience_certificate', label: 'Experience certificate', category: 'qualification' },
      { item_key: 'bank_details', label: 'Bank details (IBAN letter)', category: 'payroll' },
      { item_key: 'emergency_contact', label: 'Emergency contact', category: 'welfare' },
    ],
  },
};

/** A rejection the caller can act on; anything else is a server fault. */
class PreboardingItemError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PreboardingItemError';
    this.status = status;
  }
}

function documentSetFor(jurisdiction) {
  return DOCUMENT_SETS[String(jurisdiction || '').toUpperCase()] || null;
}

function documentSetItems(jurisdiction) {
  const set = documentSetFor(jurisdiction);
  return set ? set.items : [];
}

function isDocumentSetActive(jurisdiction) {
  const set = documentSetFor(jurisdiction);
  return Boolean(set && set.active);
}

/**
 * The case row, read straight from the table.
 *
 * Not through preboarding.getCase(): preboarding.js requires this module to seed the
 * checklist when it opens a case, and a require back the other way would be a cycle. One
 * small read duplicated here is cheaper than a cycle.
 */
async function getCaseRow(caseId) {
  const rows = await db.query(
    `SELECT * FROM preboarding_cases WHERE id = ${db.escapeString(caseId)}`
  );
  return rows[0] || null;
}

/**
 * The employee track's checklist for one case, in the order the jurisdiction's set defines it.
 *
 * The track is named here rather than assumed: since P2-4 both tracks share this table, and every
 * caller of this function wants "the documents this case carries" — the seeded set, the reminder
 * that is written about them, the panel that prints them. Anything that genuinely needs both
 * tracks calls listAllItems() and splits them itself.
 */
async function listItems(caseId) {
  return db.query(
    `SELECT * FROM preboarding_items WHERE case_id = ${db.escapeString(caseId)}
      AND track = 'employee' ORDER BY rowid ASC`
  );
}

/** Every item on the case, both tracks — for the flag (defined over all of them) and for the
 *  per-track counts in the roll-up. Nothing that renders a list should use this unsplit. */
async function listAllItems(caseId) {
  return db.query(
    `SELECT * FROM preboarding_items WHERE case_id = ${db.escapeString(caseId)} ORDER BY rowid ASC`
  );
}

async function getItem(caseId, itemKey) {
  const rows = await db.query(
    `SELECT * FROM preboarding_items WHERE case_id = ${db.escapeString(caseId)}
      AND item_key = ${db.escapeString(itemKey)}`
  );
  return rows[0] || null;
}

/**
 * Seed a case's checklist from its jurisdiction's set.
 *
 * Called by the single case-creation path (preboarding.recordOfferAcceptance) right after the
 * case row exists, so a case always arrives with its items. Safe to call again: UNIQUE
 * (case_id, item_key) makes every insert a no-op the second time, so a replayed acceptance or
 * a repeat call cannot duplicate a checklist item.
 */
async function seedItemsForCase(caseRow) {
  const set = documentSetFor(caseRow.jurisdiction);
  if (!set) {
    throw new PreboardingItemError(
      `no pre-boarding document set is defined for jurisdiction ${caseRow.jurisdiction}`,
      400
    );
  }
  for (const item of set.items) {
    await db.query(`
      INSERT OR IGNORE INTO preboarding_items (
        id, case_id, item_key, label, category, jurisdiction, required, status, created_at, updated_at
      ) VALUES (
        ${db.escapeString(randomUUID())},
        ${db.escapeString(caseRow.id)},
        ${db.escapeString(item.item_key)},
        ${db.escapeString(item.label)},
        ${db.escapeString(item.category)},
        ${db.escapeString(String(caseRow.jurisdiction).toUpperCase())},
        1,
        'not_started',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
  }
  return listItems(caseRow.id);
}

async function getConsent(caseId) {
  const rows = await db.query(
    `SELECT * FROM preboarding_consents WHERE case_id = ${db.escapeString(caseId)}`
  );
  return rows[0] || null;
}

async function hasConsent(caseId) {
  return Boolean(await getConsent(caseId));
}

/**
 * Record the PDPL consent this case's document collection is gated on.
 *
 * Replay-safe in the same spirit as the case writer: recording consent for a case that already
 * has a record returns the existing record and changes nothing.
 */
async function recordConsent(input) {
  const caseId = input.case_id;
  const caseRow = await getCaseRow(caseId);
  if (!caseRow) throw new PreboardingItemError('Pre-boarding case not found', 404);

  for (const field of ['consent_type', 'lawful_basis', 'consent_version']) {
    if (!input[field] || !String(input[field]).trim()) {
      throw new PreboardingItemError(`${field} is required to record PDPL consent`, 400);
    }
  }

  const existing = await getConsent(caseId);
  if (existing) return { consent: existing, created: false };

  const id = randomUUID();
  const grantedAt = input.granted_at || new Date().toISOString();
  await db.query(`
    INSERT INTO preboarding_consents (
      id, case_id, consent_type, lawful_basis, consent_version, granted_at, recorded_by
    ) VALUES (
      ${db.escapeString(id)},
      ${db.escapeString(caseId)},
      ${db.escapeString(input.consent_type)},
      ${db.escapeString(input.lawful_basis)},
      ${db.escapeString(input.consent_version)},
      ${db.escapeString(grantedAt)},
      ${db.escapeString(input.actor || 'system')}
    )
  `);

  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(input.actor || 'system')},
      'preboarding_consent', ${db.escapeString(caseId)}, 'CREATE',
      ${db.escapeString(JSON.stringify({
        consent_type: input.consent_type,
        lawful_basis: input.lawful_basis,
        consent_version: input.consent_version,
      }))}, CURRENT_TIMESTAMP)`);

  return { consent: await getConsent(caseId), created: true };
}

/**
 * Move one checklist item to a new status.
 *
 * The order of the checks is the whole point: the case and the item must exist, the status
 * must be one of the four, the set must be active for this jurisdiction, the transition must
 * be legal from where the item is now, and only then does a collection step have to clear the
 * PDPL consent gate. Refusals name what was wrong so the caller can act on them.
 */
async function setItemStatus(input) {
  const { case_id: caseId, item_key: itemKey, status } = input;

  const caseRow = await getCaseRow(caseId);
  if (!caseRow) throw new PreboardingItemError('Pre-boarding case not found', 404);

  if (!status || ITEM_STATUSES.indexOf(status) === -1) {
    throw new PreboardingItemError(
      `status is required and must be one of ${ITEM_STATUSES.join(', ')}`,
      400
    );
  }
  if (!itemKey) throw new PreboardingItemError('item_key is required', 400);

  const item = await getItem(caseId, itemKey);
  if (!item) throw new PreboardingItemError(`No checklist item ${itemKey} on this case`, 404);

  if (input.document_reference && String(input.document_reference).length > 120) {
    throw new PreboardingItemError('document_reference must be 120 characters or fewer', 400);
  }

  // Which switch applies is decided by the line's own track, never by the caller: an
  // employee-track item is frozen when its jurisdiction's document set is switched off, and a
  // workspace line (P2-4) is frozen when the workspace track is switched off for the case's
  // jurisdiction. Two switches, each read from its own module's configuration.
  const track = item.track || 'employee';
  if (track === 'workspace') {
    if (!workspace.isWorkspaceActive(caseRow.jurisdiction) && status !== 'not_started') {
      throw new PreboardingItemError(
        `The ${caseRow.jurisdiction} workspace track is kept but not active in this release `
        + '(UAE-first), so its lines cannot move off not started',
        409
      );
    }
  } else {
    const set = documentSetFor(caseRow.jurisdiction);
    if ((!set || !set.active) && status !== 'not_started') {
      throw new PreboardingItemError(
        `The ${caseRow.jurisdiction} document set is kept but not active in this release (UAE-first), `
        + 'so its items cannot move off not started',
        409
      );
    }
  }

  const allowed = ALLOWED_TRANSITIONS[item.status] || [];
  if (allowed.indexOf(status) === -1) {
    throw new PreboardingItemError(
      `Item ${itemKey} is ${item.status}; it cannot move to ${status}`
      + (allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (verified is terminal)'),
      409
    );
  }

  // The gate itself. Receiving a document means the hire's personal data is collected, so the
  // consent record must already exist — checked here, on the transition, for every caller.
  // Scoped to the employee track on purpose: a provisioning line (a laptop, a badge, a seat) is
  // not the hire's personal document, and making IT's work wait on a PDPL consent the hire has
  // not signed would invent a rule nobody stated. The `track` column is what keeps those apart —
  // without it, putting both tracks in one table would have silently gated the laptop too.
  if (track === 'employee'
      && COLLECTED_STATUSES.indexOf(status) !== -1
      && !(await hasConsent(caseId))) {
    throw new PreboardingItemError(
      'A document cannot be collected before the PDPL consent record exists for this case. '
      + 'Record PDPL consent first.',
      428
    );
  }

  const now = new Date().toISOString();
  const requestedAt = status === 'not_started' ? null : (item.requested_at || now);
  const receivedAt = status === 'received' ? now : (status === 'verified' ? item.received_at : null);
  const verifiedAt = status === 'verified' ? now : null;
  const reference = input.document_reference === undefined
    ? item.document_reference
    : input.document_reference;

  await db.query(`
    UPDATE preboarding_items SET
      status = ${db.escapeString(status)},
      document_reference = ${db.escapeString(reference)},
      note = ${db.escapeString(input.note === undefined ? item.note : input.note)},
      requested_at = ${db.escapeString(requestedAt)},
      received_at = ${db.escapeString(receivedAt)},
      verified_at = ${db.escapeString(verifiedAt)},
      last_actor = ${db.escapeString(input.actor || 'system')},
      updated_at = CURRENT_TIMESTAMP
    WHERE case_id = ${db.escapeString(caseId)} AND item_key = ${db.escapeString(itemKey)}
  `);

  // The audit trail records the transition, never the document: new_values carries keys and
  // statuses only, so a reference or a note cannot leak into a log that is read widely.
  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(input.actor || 'system')},
      'preboarding_item', ${db.escapeString(caseId)}, 'STATUS',
      ${db.escapeString(JSON.stringify({ item_key: itemKey, from: item.status, to: status }))},
      CURRENT_TIMESTAMP)`);

  return getItem(caseId, itemKey);
}

/**
 * Outstanding = every required item **on the given track** that has not been collected yet.
 * Derived from the item rows on every read; nothing stores an "outstanding" flag that could go
 * stale.
 *
 * The track argument exists because the two tracks must never be counted as one (P2-4's lines
 * live in the same table): the employee-track roll-up, and the reminder that is written from it,
 * are about the hire's documents. A laptop is not something to remind the hire about, and a
 * single blended count would hide which function is late — the defect the design review names.
 */
function outstandingOf(items, track = 'employee') {
  return items
    .filter((item) => (item.track || 'employee') === track)
    .filter((item) => COLLECTED_STATUSES.indexOf(item.status) === -1)
    .map((item) => ({
      item_key: item.item_key,
      label: item.label,
      status: item.status,
      required: Boolean(item.required),
      track: item.track || 'employee',
      // Present on the workspace track, and null on the employee track — where no owner is
      // recorded, and therefore none is invented.
      owner: item.owner === undefined ? null : item.owner,
    }));
}

/**
 * Record a reminder for a case's outstanding items.
 *
 * The product has **no delivery channel** — no mailer, no webhook, no SMS — so this records
 * that HR asked, and what was outstanding when they asked. It is an in-product record, not
 * proof that a message reached the hire, and the review of how it is delivered is a separate
 * decision. Outstanding items are derived at read time, never frozen into this row beyond the
 * snapshot of what the reminder covered.
 */
async function recordReminder(input) {
  const caseId = input.case_id;
  const caseRow = await getCaseRow(caseId);
  if (!caseRow) throw new PreboardingItemError('Pre-boarding case not found', 404);

  const items = await listItems(caseId);
  let outstanding = outstandingOf(items);

  if (input.item_keys && input.item_keys.length) {
    const known = items.map((item) => item.item_key);
    for (const key of input.item_keys) {
      if (known.indexOf(key) === -1) {
        throw new PreboardingItemError(`No checklist item ${key} on this case`, 404);
      }
    }
    outstanding = outstanding.filter((item) => input.item_keys.indexOf(item.item_key) !== -1);
  }

  if (outstanding.length === 0) {
    throw new PreboardingItemError(
      'Nothing is outstanding on this case, so there is nothing to remind about',
      400
    );
  }

  const id = randomUUID();
  await db.query(`
    INSERT INTO preboarding_reminders (
      id, case_id, item_key, outstanding_count, outstanding_keys, channel, note, created_by
    ) VALUES (
      ${db.escapeString(id)},
      ${db.escapeString(caseId)},
      ${db.escapeString(input.item_keys && input.item_keys.length === 1 ? input.item_keys[0] : null)},
      ${outstanding.length},
      ${db.escapeString(JSON.stringify(outstanding.map((item) => item.item_key)))},
      'in_product',
      ${db.escapeString(input.note || null)},
      ${db.escapeString(input.actor || 'system')}
    )
  `);

  await db.query(`INSERT INTO audit_logs (id, performed_by, entity_type, entity_id, action, new_values, timestamp)
    VALUES (${db.escapeString(randomUUID())}, ${db.escapeString(input.actor || 'system')},
      'preboarding_reminder', ${db.escapeString(caseId)}, 'REMIND',
      ${db.escapeString(JSON.stringify({ outstanding_count: outstanding.length, channel: 'in_product' }))},
      CURRENT_TIMESTAMP)`);

  const rows = await db.query(
    `SELECT * FROM preboarding_reminders WHERE id = ${db.escapeString(id)}`
  );
  return { reminder: rows[0], outstanding };
}

async function listReminders(caseId) {
  return db.query(
    `SELECT * FROM preboarding_reminders WHERE case_id = ${db.escapeString(caseId)} ORDER BY created_at ASC`
  );
}

/** Whole days from today (UTC) to the start date. Derived on read; never stored. */
function daysUntil(startDate) {
  const target = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - startOfToday) / 86400000);
}

/**
 * One case's roll-up: the counts, the outstanding items by name, the consent state.
 *
 * **Every count here is the EMPLOYEE track's** unless it is inside `by_track`, and that is
 * deliberate. Pre-P2-4 this table held one track, so "the counts" needed no qualifier; now that
 * P2-4's provisioning lines live in the same table, an unqualified `items_total` would silently
 * become a blended number — the merged-track defect the design review rules out. So the
 * employee-track fields keep their old meaning and their old numbers, the workspace counts travel
 * in `by_track`, and each surface prints the track it is talking about. The 48-hour flag is the
 * one thing that reads BOTH, because it is defined over every item on the case (P2-5).
 */
function caseSummary(caseRow, items, consent, reminders) {
  const employeeItems = items.filter((item) => (item.track || 'employee') === 'employee');
  const byStatus = { not_started: 0, requested: 0, received: 0, verified: 0 };
  for (const item of employeeItems) {
    if (byStatus[item.status] === undefined) byStatus[item.status] = 0;
    byStatus[item.status] += 1;
  }
  const outstanding = outstandingOf(items);
  const byTrack = workspace.trackCountsFor(items, COLLECTED_STATUSES);
  const lastReminder = reminders.length ? reminders[reminders.length - 1] : null;
  return {
    case_id: caseRow.id,
    offer_reference: caseRow.offer_reference,
    candidate_name: caseRow.candidate_name,
    candidate_email: caseRow.candidate_email,
    role: caseRow.role,
    department: caseRow.department,
    jurisdiction: caseRow.jurisdiction,
    start_date: caseRow.start_date,
    days_to_start: daysUntil(caseRow.start_date),
    // P2-5 — the derived 48-hour flag. Computed here on every read from this case's start date
    // and every item it carries (whatever track created them); never stored, never seeded, and
    // there is no field anywhere that a stale value could be read from. One definition, so the
    // row chip, the case header and Layer 3's escalation all read this and nothing else.
    flag: preboardingFlag.deriveFlag({
      start_date: caseRow.start_date,
      items,
      collected_statuses: COLLECTED_STATUSES,
    }),
    document_set_active: isDocumentSetActive(caseRow.jurisdiction),
    checklist_seeded: employeeItems.length > 0,
    items_total: employeeItems.length,
    by_status: byStatus,
    outstanding_count: outstanding.length,
    outstanding,
    // P2-4 — the per-track roll-up. "7 of 7" and "4 of 14" are two facts about one case; a single
    // blended count would hide which track and which function is late.
    by_track: {
      employee: { ...byTrack.employee, active: isDocumentSetActive(caseRow.jurisdiction) },
      workspace: {
        ...byTrack.workspace,
        active: workspace.isWorkspaceActive(caseRow.jurisdiction),
        functions: workspace.WORKSPACE_FUNCTIONS,
      },
    },
    consent_recorded: Boolean(consent),
    consent_granted_at: consent ? consent.granted_at : null,
    last_reminder_at: lastReminder ? lastReminder.created_at : null,
    last_reminder_count: lastReminder ? lastReminder.outstanding_count : null,
  };
}

/**
 * The roll-up HR reads: every case, its progress and **the names of its outstanding items**,
 * from one list and without opening each case. Four queries in total, whatever the number of
 * cases — the items, consents and reminders are fetched once for all of them.
 *
 * @returns {Promise<{jurisdiction: string|null, cases: object[], totals: object}>}
 *          `totals` describes **the set this response carries, under this endpoint's own filters** —
 *          and this endpoint's only filter is `jurisdiction`, so `totals.cases` counts the open and
 *          the closed cases alike. It is deliberately not the same measure as
 *          `preboarding.listCases`'s own `totals`, which describes the set *that* call returned under
 *          both of its filters (jurisdiction and status). Two different questions about two different
 *          sets; they are never printed as one number.
 */
async function checklistOverview(options = {}) {
  const jurisdiction = options.jurisdiction ? String(options.jurisdiction).toUpperCase() : null;
  const where = jurisdiction ? ` WHERE jurisdiction = ${db.escapeString(jurisdiction)}` : '';
  const cases = await db.query(
    `SELECT * FROM preboarding_cases${where} ORDER BY start_date ASC, created_at ASC`
  );

  const emptyTotals = {
    cases: 0,
    // Employee-track totals: these keep the meaning they had before P2-4 existed, so a figure a
    // surface already prints does not silently change what it counts.
    items: 0,
    items_outstanding: 0,
    items_received: 0,
    items_verified: 0,
    cases_without_consent: 0,
    cases_ready: 0,
    // Workspace-track totals (P2-4), side by side and never summed with the above.
    workspace_lines: 0,
    workspace_lines_open: 0,
    cases_provisioned: 0,
  };
  if (cases.length === 0) return { jurisdiction, cases: [], totals: emptyTotals };

  const idList = cases.map((row) => db.escapeString(row.id)).join(', ');
  const [items, consents, reminders] = await Promise.all([
    db.query(`SELECT * FROM preboarding_items WHERE case_id IN (${idList}) ORDER BY rowid ASC`),
    db.query(`SELECT * FROM preboarding_consents WHERE case_id IN (${idList})`),
    db.query(`SELECT * FROM preboarding_reminders WHERE case_id IN (${idList}) ORDER BY created_at ASC`),
  ]);

  const groupBy = (rows) => rows.reduce((acc, row) => {
    (acc[row.case_id] = acc[row.case_id] || []).push(row);
    return acc;
  }, {});
  const itemsByCase = groupBy(items);
  const consentByCase = groupBy(consents);
  const remindersByCase = groupBy(reminders);

  const summaries = cases.map((row) => caseSummary(
    row,
    itemsByCase[row.id] || [],
    (consentByCase[row.id] || [])[0] || null,
    remindersByCase[row.id] || []
  ));

  const totals = summaries.reduce((acc, summary) => {
    acc.cases += 1;
    acc.items += summary.items_total;
    acc.items_outstanding += summary.outstanding_count;
    acc.items_received += summary.by_status.received;
    acc.items_verified += summary.by_status.verified;
    if (!summary.consent_recorded) acc.cases_without_consent += 1;
    if (summary.checklist_seeded && summary.outstanding_count === 0) acc.cases_ready += 1;
    acc.workspace_lines += summary.by_track.workspace.lines;
    acc.workspace_lines_open += summary.by_track.workspace.open;
    if (summary.by_track.workspace.lines > 0 && summary.by_track.workspace.open === 0) {
      acc.cases_provisioned += 1;
    }
    return acc;
  }, { ...emptyTotals });

  return { jurisdiction, cases: summaries, totals };
}

/** Everything the case screen needs in one read: the checklist, the set state, the consent. */
async function caseChecklist(caseId) {
  const caseRow = await getCaseRow(caseId);
  if (!caseRow) throw new PreboardingItemError('Pre-boarding case not found', 404);
  const [allItems, consent, reminders] = await Promise.all([
    listAllItems(caseId),
    getConsent(caseId),
    listReminders(caseId),
  ]);
  return {
    case_id: caseRow.id,
    jurisdiction: caseRow.jurisdiction,
    document_set_active: isDocumentSetActive(caseRow.jurisdiction),
    consent: consent || null,
    reminders,
    // The summary counts both tracks (it carries by_track and the flag), so it is built from
    // every item on the case…
    summary: caseSummary(caseRow, allItems, consent, reminders),
    // …while this list is the EMPLOYEE track's, because that is the panel it feeds: documents,
    // the status machine's verbs and the PDPL consent gate. P2-4's provisioning lines have their
    // own read (GET …/workspace) with its own shape and their own function grouping.
    items: allItems.filter((item) => (item.track || 'employee') === 'employee'),
  };
}

/**
 * Everything the in-process flag watcher reads in one pass: every case with the items it carries.
 * The watcher (preboarding-flag-scheduler.js) holds no DB rule of its own — it is handed a
 * snapshot, and this is that snapshot. The collected-status list travels with it so the watcher
 * cannot derive the flag by a different rule than the surface does.
 */
async function flagWatchSnapshot() {
  const cases = await db.query('SELECT * FROM preboarding_cases');
  if (cases.length === 0) return [];
  const idList = cases.map((row) => db.escapeString(row.id)).join(', ');
  const itemRows = await db.query(
    `SELECT * FROM preboarding_items WHERE case_id IN (${idList}) ORDER BY rowid ASC`
  );
  const itemsByCase = itemRows.reduce((acc, item) => {
    (acc[item.case_id] = acc[item.case_id] || []).push(item);
    return acc;
  }, {});
  return cases.map((row) => ({
    case_id: row.id,
    offer_reference: row.offer_reference,
    start_date: row.start_date,
    items: itemsByCase[row.id] || [],
    collected_statuses: COLLECTED_STATUSES,
  }));
}

module.exports = {
  ITEM_STATUSES,
  COLLECTED_STATUSES,
  flagWatchSnapshot,
  ALLOWED_TRANSITIONS,
  DOCUMENT_SETS,
  PreboardingItemError,
  documentSetFor,
  documentSetItems,
  isDocumentSetActive,
  seedItemsForCase,
  listItems,
  listAllItems,
  getItem,
  setItemStatus,
  getConsent,
  hasConsent,
  recordConsent,
  recordReminder,
  listReminders,
  checklistOverview,
  caseChecklist,
  outstandingOf,
  daysUntil,
};
