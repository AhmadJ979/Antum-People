/**
 * Antum People — Layer 2 · Pre-boarding Intelligence
 * P2-4: the workspace track — role-based provisioning across IT, Admin, HR and Manager.
 *
 * ---------------------------------------------------------------------------
 * ONE MODULE OWNS THE WORKSPACE CHECKLIST
 * ---------------------------------------------------------------------------
 * Same shape as the employee track (preboarding-items.js) and for the same reason: the routes
 * in index.js carry no checklist rules of their own, so a second caller later (an ATS adapter,
 * an onboarding portal) is another CALLER of this file, never a second implementation of it.
 *
 * Four rules this file exists to keep:
 *
 * 1. **The checklist is a consequence of the case, never a form.** `deriveWorkspaceLines()`
 *    takes the case row — the role, the department, the jurisdiction — and returns the lines
 *    that follow from it. Nothing in the API accepts a hand-typed list per hire; there is no
 *    parameter that could carry one. Adding a line is an entry in `WORKSPACE_CATALOG`; adding a
 *    role is an entry in `WORKSPACE_PROFILES`. Neither is a code change per hire.
 *
 * 2. **Every line has exactly one responsible function and a due date.** The function is one of
 *    the four the spec names (IT · Admin · HR · Manager) and is stored on the item row at
 *    seeding, because an assignment is a record — a later edit to the catalog must not silently
 *    reassign work in flight. The due date is DERIVED on every read from the case's start date
 *    and the line's offset, so it cannot go stale, and the offsets stay configuration.
 *
 * 3. **Two tracks, one case, never merged.** These lines land in `preboarding_items` with
 *    `track = 'workspace'`, which is what keeps the two counts apart everywhere: the employee
 *    track's progress bar, the PDPL consent gate (documents, not laptops) and the reminder
 *    (about the hire's documents) all read the `track` column rather than assuming.
 *
 * 4. **A filter is a filter.** "IT and Admin see only their own lines" is P2-4's acceptance
 *    line, and the design review is explicit that it cannot be delivered as an access boundary
 *    while the product has one shared account: `users` carries a `role`, but the surface is
 *    signed in as one admin, so "who is looking" is not knowable at request time. What ships is
 *    the filter, labelled as a filter (`VIEW_LABEL` / `VIEW_NOTE`), and the scope half ships
 *    with per-user accounts at Layer 3.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CONTENT IS, AND WHAT IT IS NOT
 * ---------------------------------------------------------------------------
 * The lines below cover the five areas P2-4 names (hardware, software, email, system access,
 * building card) and follow the spec's function/line direction table, which says in its own
 * words that "the item lists themselves are P2-4's content decision". So this is content, not a
 * claim: **nothing here asserts that any jurisdiction requires any of it.** Where a line is
 * jurisdiction-specific in law, it belongs to the compliance engine and the employee track, not
 * here.
 *
 * Three things are deliberately NOT content decisions I made silently:
 *
 * - **The due offsets** (D-5, D-3, D-0 …) are an OPEN PRODUCT DECISION — the spec's §10 Q3 and
 *   §9 D3, assigned to the owner. The numbers in `WORKSPACE_CATALOG` are therefore placeholders
 *   in configuration: one integer per line, changeable without touching code.
 * - **The number of lines** is likewise a product call. This set is the spec's direction table
 *   instantiated, and it is a table, not a code path.
 * - **Lines that would duplicate a fact the product already derives are omitted on purpose, so
 *   there is one source per fact.** "Consent recorded" is the PDPL consent record the employee
 *   track's gate already reads; "visa/entry-permit tracking" is the employee track's own
 *   `visa_or_entry_permit` item; "signed JD filed"/"signed NDA filed" are the P2-3
 *   acknowledgement records. A second line for any of them could disagree with the record the
 *   product already holds, and a disagreement between two of our own surfaces is worse than a
 *   line that is not there.
 */

const { randomUUID } = require('crypto');
const db = require('./db');

/** The four functions the spec names. One line, one of these — never two owners. */
const WORKSPACE_FUNCTIONS = ['IT', 'Admin', 'HR', 'Manager'];

/**
 * The lines the workspace track knows, as data.
 *
 * `due_offset_days` = whole days BEFORE the start date (D-n), the unit the spec's §6 uses.
 * 0 means "due on the start date". These numbers are placeholders pending §10 Q3 — see the
 * header. `category` is the provisioning area (the technical equivalent of the employee track's
 * document categories) and is not shown as a legal grouping.
 */
const WORKSPACE_CATALOG = [
  // --- IT -----------------------------------------------------------------
  { item_key: 'ws_device', label: 'Laptop or device issued', category: 'hardware', owner: 'IT', due_offset_days: 5 },
  { item_key: 'ws_email_sso', label: 'Email and SSO account created', category: 'email', owner: 'IT', due_offset_days: 5 },
  { item_key: 'ws_licensed_software', label: 'Licensed software installed', category: 'software', owner: 'IT', due_offset_days: 3 },
  { item_key: 'ws_system_access', label: "System access granted with the role's permissions", category: 'system_access', owner: 'IT', due_offset_days: 3 },
  { item_key: 'ws_vpn', label: 'VPN access provisioned', category: 'system_access', owner: 'IT', due_offset_days: 3 },
  // --- Admin --------------------------------------------------------------
  { item_key: 'ws_building_card', label: 'Building card or access badge issued', category: 'building_card', owner: 'Admin', due_offset_days: 1 },
  { item_key: 'ws_desk_seat', label: 'Desk and seat allocated', category: 'workplace', owner: 'Admin', due_offset_days: 1 },
  { item_key: 'ws_parking', label: 'Parking pass issued', category: 'workplace', owner: 'Admin', due_offset_days: 1 },
  // --- HR -----------------------------------------------------------------
  { item_key: 'ws_employee_file', label: 'Employee file opened', category: 'hr_file', owner: 'HR', due_offset_days: 3 },
  { item_key: 'ws_payroll_setup', label: 'Payroll setup', category: 'payroll', owner: 'HR', due_offset_days: 5 },
  // --- Manager ------------------------------------------------------------
  { item_key: 'ws_first_week_agenda', label: 'First-week agenda prepared', category: 'manager_setup', owner: 'Manager', due_offset_days: 1 },
  { item_key: 'ws_buddy_mentor', label: 'Buddy or mentor assigned', category: 'manager_setup', owner: 'Manager', due_offset_days: 1 },
  { item_key: 'ws_day_30_checkin', label: '30-day check-in scheduled', category: 'manager_setup', owner: 'Manager', due_offset_days: 0 },
  { item_key: 'ws_team_introduction', label: 'Team introduction arranged', category: 'manager_setup', owner: 'Manager', due_offset_days: 0 },
  // --- lines a profile can add (never in the base set) --------------------
  { item_key: 'ws_manager_system_access', label: 'Manager-level system access (approvals, team reporting)', category: 'system_access', owner: 'IT', due_offset_days: 3 },
  { item_key: 'ws_finance_system_access', label: 'Finance system access', category: 'system_access', owner: 'IT', due_offset_days: 3 },
];

/**
 * The role rules — the whole of "assignment is derived from the role on the case".
 *
 * Each profile reads the case's own fields. `role_matches` compares against `preboarding_cases.
 * role`, which is the PERSON'S JOB ROLE ("Marketing Manager") and never the login account's
 * system role — the spec flags that naming hazard explicitly, and the two are separate columns
 * in this schema (`preboarding_cases.role` vs `users.role`). `department_in` compares against
 * `preboarding_cases.department`, case-insensitively.
 *
 * Conservative on purpose: a profile fires on a word it is sure about, and a case that matches
 * nothing gets the base set rather than a guess about the hire.
 */
const WORKSPACE_PROFILES = [
  {
    profile_key: 'people_manager',
    when: { role_matches: ['manager', 'director', 'head of'] },
    adds: ['ws_manager_system_access'],
  },
  {
    profile_key: 'finance_department',
    when: { department_in: ['finance', 'accounting'] },
    adds: ['ws_finance_system_access'],
  },
];

/**
 * Which jurisdictions the workspace track is worked in.
 *
 * UAE-first is the product's stance (owner, 2026-10-07), and the employee track expresses it by
 * keeping the KSA document set switched off. The workspace track says the same thing in one
 * list: a case outside it is seeded — so its board can be read — but its lines cannot move off
 * not started. Nothing about this list is a claim about KSA law; if any line here were
 * jurisdiction-specific it would belong to the employee track and the compliance engine.
 */
const WORKSPACE_ACTIVE_JURISDICTIONS = ['AE'];

/** The label the surface must use for the function filter, and the sentence that goes with it. */
const VIEW_LABEL = 'View by function';
const VIEW_NOTE = 'This narrows the board to one function. It is a filter, not access control: '
  + 'everyone signed in can still open any case and see every line. Per-user scoping — "My lines" '
  + '— ships with per-user accounts at Layer 3.';

class PreboardingWorkspaceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PreboardingWorkspaceError';
    this.status = status;
  }
}

const catalogByKey = WORKSPACE_CATALOG.reduce((acc, line) => {
  acc[line.item_key] = line;
  return acc;
}, {});

function isWorkspaceActive(jurisdiction) {
  return WORKSPACE_ACTIVE_JURISDICTIONS.indexOf(String(jurisdiction || '').toUpperCase()) !== -1;
}

function normalise(value) {
  return String(value === null || value === undefined ? '' : value).trim().toLowerCase();
}

/** Which profiles the case's own fields fire. Exported so a test can read the rule, not a count. */
function profilesFor(caseRow) {
  const role = normalise(caseRow.role);
  const department = normalise(caseRow.department);
  return WORKSPACE_PROFILES.filter((profile) => {
    const when = profile.when || {};
    if (Array.isArray(when.role_matches) && when.role_matches.some((token) => role.includes(normalise(token)))) {
      return true;
    }
    if (Array.isArray(when.department_in) && when.department_in.some((value) => normalise(value) === department)) {
      return true;
    }
    return false;
  });
}

/**
 * The lines every case carries: the catalog minus the lines a profile owns. Derived from the
 * profiles themselves, so a new profile-only line cannot be left in the base set by accident.
 */
const PROFILE_ONLY_KEYS = WORKSPACE_PROFILES.reduce((acc, profile) => acc.concat(profile.adds), []);

/**
 * The lines this case carries, in catalog order, each with the function that owns it.
 *
 * Derived from the case row and nothing else: no argument can add a line per hire. The same role
 * in the same department always produces the same list, which is the property that makes this a
 * consequence of the case rather than a form.
 */
function deriveWorkspaceLines(caseRow) {
  const fired = profilesFor(caseRow);
  const baseKeys = WORKSPACE_CATALOG
    .filter((line) => PROFILE_ONLY_KEYS.indexOf(line.item_key) === -1)
    .map((line) => line.item_key);
  const addedKeys = fired.reduce((acc, profile) => acc.concat(profile.adds), []);
  const allKeys = baseKeys.concat(addedKeys.filter((key) => baseKeys.indexOf(key) === -1));

  return {
    profile_keys: fired.map((profile) => profile.profile_key),
    lines: allKeys
      .map((key) => catalogByKey[key])
      .filter(Boolean)
      .sort((a, b) => {
        const fa = WORKSPACE_FUNCTIONS.indexOf(a.owner);
        const fb = WORKSPACE_FUNCTIONS.indexOf(b.owner);
        if (fa !== fb) return fa - fb;
        return WORKSPACE_CATALOG.indexOf(a) - WORKSPACE_CATALOG.indexOf(b);
      }),
  };
}

/** The case row, read straight from the table (same reason as the employee track: no cycles). */
async function getCaseRow(caseId) {
  const rows = await db.query(
    `SELECT * FROM preboarding_cases WHERE id = ${db.escapeString(caseId)}`
  );
  return rows[0] || null;
}

function startMidnightMs(startDate) {
  const iso = String(startDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The line's due date, derived from the case's start date and the line's offset — never stored.
 * Returns the ISO date and the rule that produced it, so the surface can show WHY it is that
 * date (the offsets are configuration and an open product decision; a bare date hides that).
 */
function dueDateFor(startDate, offsetDays) {
  const startMs = startMidnightMs(startDate);
  if (startMs === null) return { due_date: null, due_rule: null, due_offset_days: offsetDays };
  return {
    due_date: isoDate(startMs - offsetDays * 86400000),
    due_rule: `D-${offsetDays}`,
    due_offset_days: offsetDays,
  };
}

/** Whole days from today (UTC) to a date derived above; negative means the date has passed. */
function daysUntilDate(isoDateString, now = new Date()) {
  if (!isoDateString) return null;
  const target = Date.parse(`${isoDateString}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - startOfToday) / 86400000);
}

/** The workspace rows on one case, in the order they were seeded. */
async function listWorkspaceItems(caseId) {
  return db.query(
    `SELECT * FROM preboarding_items
      WHERE case_id = ${db.escapeString(caseId)} AND track = 'workspace'
      ORDER BY rowid ASC`
  );
}

/**
 * Seed a case's workspace lines from the case's own fields.
 *
 * Called by the single case-creation path (preboarding.recordOfferAcceptance) right after the
 * employee track is seeded, so a case arrives with both tracks and nobody can create one
 * without the other. Safe to call again: UNIQUE (case_id, item_key) makes every insert a no-op
 * the second time, so a replayed offer acceptance cannot duplicate a line.
 */
async function seedWorkspaceItemsForCase(caseRow) {
  const { lines } = deriveWorkspaceLines(caseRow);
  for (const line of lines) {
    await db.query(`
      INSERT OR IGNORE INTO preboarding_items (
        id, case_id, item_key, label, category, jurisdiction, required, status, track, owner,
        created_at, updated_at
      ) VALUES (
        ${db.escapeString(randomUUID())},
        ${db.escapeString(caseRow.id)},
        ${db.escapeString(line.item_key)},
        ${db.escapeString(line.label)},
        ${db.escapeString(line.category)},
        ${db.escapeString(String(caseRow.jurisdiction).toUpperCase())},
        1,
        'not_started',
        'workspace',
        ${db.escapeString(line.owner)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
  }
  return listWorkspaceItems(caseRow.id);
}

/**
 * One line, ready for a surface: the record (label, function, status) plus the two derived
 * fields (the due date and how far away it is). `overdue` is deliberately only about THIS line:
 * the case-level flag is one definition in preboarding-flag.js and is not recomputed here.
 */
function lineView(item, caseRow, collectedStatuses, now = new Date()) {
  const catalogLine = catalogByKey[item.item_key];
  const complete = collectedStatuses.indexOf(item.status) !== -1;
  // The offset is read from the catalog (configuration) at read time; an item whose key is no
  // longer in the catalog keeps its record and shows no due date rather than a guessed one.
  const due = catalogLine
    ? dueDateFor(caseRow.start_date, catalogLine.due_offset_days)
    : { due_date: null, due_rule: null, due_offset_days: null };
  const daysToDue = daysUntilDate(due.due_date, now);
  return {
    item_key: item.item_key,
    label: item.label,
    category: item.category,
    owner: item.owner,
    status: item.status,
    complete,
    due_date: due.due_date,
    due_rule: due.due_rule,
    due_offset_days: due.due_offset_days,
    days_to_due: daysToDue,
    overdue: !complete && daysToDue !== null && daysToDue < 0,
  };
}

function functionCounts(lines) {
  return WORKSPACE_FUNCTIONS.map((fn) => {
    const own = lines.filter((line) => line.owner === fn);
    return {
      function: fn,
      lines: own.length,
      complete: own.filter((line) => line.complete).length,
      open: own.filter((line) => !line.complete).length,
    };
  });
}

/**
 * The workspace board for one case — everything a surface needs, from one read.
 *
 * `options.function` is the "View by function" filter (one of the four names). Unknown names are
 * refused rather than ignored: silently returning the whole board for a typo would read as "this
 * function has no lines", which is a different and false statement. The unfiltered counts travel
 * with a filtered board (`available_functions`), so a chip can show "IT (2)" without a second
 * call, and the view block always says which mode the caller is in.
 */
async function workspaceBoard(caseId, options = {}, now = new Date()) {
  const caseRow = await getCaseRow(caseId);
  if (!caseRow) throw new PreboardingWorkspaceError('Pre-boarding case not found', 404);

  let requested = options.function === undefined || options.function === null || options.function === ''
    ? null
    : String(options.function).trim();
  if (requested !== null) {
    const canonical = WORKSPACE_FUNCTIONS.find((fn) => normalise(fn) === normalise(requested));
    if (!canonical) {
      throw new PreboardingWorkspaceError(
        `Function ${requested} is not one of the four the workspace track assigns to `
        + `(${WORKSPACE_FUNCTIONS.join(', ')})`,
        400
      );
    }
    requested = canonical;
  }

  const collected = options.collected_statuses || ['received', 'verified'];
  const items = await listWorkspaceItems(caseId);
  const allLines = items.map((item) => lineView(item, caseRow, collected, now));
  const counts = functionCounts(allLines);
  const shown = requested === null ? allLines : allLines.filter((line) => line.owner === requested);

  return {
    case_id: caseRow.id,
    offer_reference: caseRow.offer_reference,
    jurisdiction: caseRow.jurisdiction,
    start_date: caseRow.start_date,
    track_active: isWorkspaceActive(caseRow.jurisdiction),
    track_note: isWorkspaceActive(caseRow.jurisdiction)
      ? null
      : `The workspace track is kept but not active for ${String(caseRow.jurisdiction).toUpperCase()} `
        + 'in this release (UAE-first), so its lines cannot move off not started.',
    // Which rules fired, so "derived from the role" is inspectable rather than asserted.
    derived_from: {
      role: caseRow.role,
      department: caseRow.department,
      profile_keys: profilesFor(caseRow).map((profile) => profile.profile_key),
    },
    available_functions: counts,
    view: {
      mode: requested === null ? 'all' : 'function',
      function: requested,
      label: VIEW_LABEL,
      note: VIEW_NOTE,
      is_access_control: false,
    },
    groups: WORKSPACE_FUNCTIONS
      .map((fn) => ({ function: fn, lines: shown.filter((line) => line.owner === fn) }))
      .filter((group) => group.lines.length > 0),
    totals: {
      lines: shown.length,
      complete: shown.filter((line) => line.complete).length,
      open: shown.filter((line) => !line.complete).length,
      overdue: shown.filter((line) => line.overdue).length,
    },
  };
}

/** The per-track roll-up the case row prints: a count, never a percentage-as-score. */
function trackCountsFor(items, collectedStatuses) {
  const of = (track) => {
    const own = items.filter((item) => (item.track || 'employee') === track);
    const complete = own.filter((item) => collectedStatuses.indexOf(item.status) !== -1).length;
    return { lines: own.length, complete, open: own.length - complete };
  };
  return { employee: of('employee'), workspace: of('workspace') };
}

module.exports = {
  WORKSPACE_FUNCTIONS,
  WORKSPACE_CATALOG,
  WORKSPACE_PROFILES,
  WORKSPACE_ACTIVE_JURISDICTIONS,
  VIEW_LABEL,
  VIEW_NOTE,
  PreboardingWorkspaceError,
  isWorkspaceActive,
  profilesFor,
  deriveWorkspaceLines,
  dueDateFor,
  daysUntilDate,
  listWorkspaceItems,
  seedWorkspaceItemsForCase,
  workspaceBoard,
  trackCountsFor,
};
