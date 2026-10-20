/**
 * server/access.js — THE ONE PLACE the authorization policy lives. Layer 3, slices 1–2 (decision 11).
 *
 * WHY THIS EXISTS (measured 2026-10-19): `users.access_role` was signed into the JWT and returned by
 * `/api/login` and **never checked anywhere else** — so any authenticated caller reached every
 * `/api` route. The role was decoration. Slice 1 built this gate; slice 2 fills its cells.
 *
 * HOW IT IS USED. `server/index.js` mounts this gate once, immediately after `authenticateToken`,
 * for all of `/api`:
 *
 *     app.use('/api', auth.authenticateToken, access.gate);
 *
 * The gate maps `(method, path)` to a RESOURCE name and looks that resource up in `POLICY`.
 *
 * THE DEFAULT IS DENY, in three distinct ways — all of them deliberate:
 *   1. a route whose resource is not in `POLICY` is refused (unknown is denied, never assumed open);
 *   2. a resource whose role list is empty is refused;
 *   3. a caller whose role is not in the resource's list is refused.
 * A refusal is `403` **with no body** — the caller is told nothing about what exists. `authenticateToken`
 * runs first: a request with no token is `401` there, and one whose token does not verify is refused
 * before this module sees it.
 *
 * ============================ THE CELLS (slice 2) ============================
 *
 * `POLICY` IS the roles × resources matrix of `docs/access-model.md` §3, written out cell by cell.
 * Three marks are kept apart here, because they mean different things and flattening any two of them
 * is the defect this file exists to prevent:
 *
 *   * a role IN a cell          — permitted, and ENFORCED by the gate below;
 *   * a role ABSENT from a cell — `✖`, denied by policy at every horizon. The absence IS the mark:
 *                                 a role that is not in a list cannot pass the check;
 *   * a role in `PENDING_CELLS` — `⊘`, permitted by policy but **not yet expressible**: the ruling
 *                                 says yes, and no column in this schema can say *whose* row. Each
 *                                 entry names the missing link, and a check asserts that such a cell
 *                                 has not quietly become granted without the mark being removed.
 *
 * `COUNSEL_PENDING` is a fourth thing, and deliberately not either of the above: a cell **denied for
 * now because counsel owns the question** (docs/access-model.md §8). It is neither `✖` (no future
 * schema change makes those permitted) nor `⊘` (expressible once a column exists). Keeping it separate
 * is what stops a later reader taking today's refusal for a permanent one, or for a missing column.
 *
 * ============================ THE SCOPE (slice 2) ============================
 *
 * A cell says WHICH roles may use a resource. For five resources it does not say HOW FAR a role
 * reaches, because that is a question about an individual row — so `SCOPES` answers it, and the
 * routes resolve the relation between the signed-in account and the row before they read it:
 *
 *     'all'      every row  ·  'reports'  the caller's own reporting line  ·  'own'  the caller only
 *
 * A scope-bearing resource must state a scope for EVERY role its cell allows, and `scopeFor` returns
 * `null` — which the call sites treat as refuse — for a role the table does not cover. That is
 * deliberate: "how far may this role reach" must never fall back to "everywhere". A check asserts the
 * table's completeness, so a new role in a cell reddens rather than ships unscoped.
 *
 * `FIELD_RULES` is the same idea for the columns of a payload ("field" in the matrix's cells), and
 * `TEMPLATE_SCOPES` for which documents the settlement templates are — with the same
 * no-entry-means-refuse rule.
 *
 * NOT IN THIS SLICE: "My lines", the hire-facing portal (decision 14), document storage (IFZA,
 * decision 10), SSO, password reset, MFA. No session/cookie change: the JWT still travels in
 * `Authorization`, and JWT-in-localStorage is a separate, still-open item.
 */

/**
 * The roles this product knows, spelled as docs/access-model.md §2.1 names them.
 *
 * `hr_admin` is the `admin` account under its new name — the rename that rides this slice (§2.4,
 * §8 item 9), because this is the slice that derives `manager` from `employees.manager_id` and so is
 * the slice in which `users.access_role` and `employees.role` (a job title) sit in one function.
 * The column rename and the value rename are migrations (server/db.js), not a second name kept
 * alongside: a role value this list does not know is refused by the account path, exactly as before.
 */
const ROLES = Object.freeze({
  HR_ADMIN: 'hr_admin',
  MANAGER: 'manager',
  FINANCE: 'finance',
  EMPLOYEE: 'employee',
  COMPLIANCE_VIEWER: 'compliance_viewer',
});
const ROLE_LIST = Object.freeze(Object.values(ROLES));

/**
 * The policy: resource → the roles allowed to use it. Every cell is a row of the matrix.
 *
 * Read this table as docs/access-model.md §3 reads: a role that is not listed is refused, and that
 * refusal is the `✖` mark — §6's five named cases (`GET /api/employees` for an `employee`, the
 * dashboard for a `manager`, the settlement documents outside HR and finance, ticking someone else's
 * step, ending someone's employment) are all enforceable by the ABSENCE of a role from a cell here,
 * which is why they are asserted rather than commented.
 */
const POLICY = Object.freeze({
  // §3.1 — the sensitive core. The roster carries decrypted national IDs and every salary; the
  // manager's cell is field-limited and line-scoped, finance keeps the pay columns and never the
  // identifiers, and `employee` and `compliance_viewer` are not in the cell at all (§6.1).
  'employees:read': [ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.FINANCE],
  'employees:write': [ROLES.HR_ADMIN],
  // §3.1 — the task lists. An employee may read their own (`⊘` in the model's terms, and expressible
  // now that `users.employee_id` exists); the manager's is their reports'; the WRITE stays with HR and
  // the reporting line, never the employee (§6.4 — the view is read-only, and the step is not theirs
  // to tick).
  'onboarding:read': [ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE],
  'onboarding:write': [ROLES.HR_ADMIN, ROLES.MANAGER],
  'offboarding:read': [ROLES.HR_ADMIN, ROLES.EMPLOYEE],
  'offboarding:write': [ROLES.HR_ADMIN],
  // §3.3 — the exit, the EOSB calculator and the documents.
  'compliance:calculate': [ROLES.HR_ADMIN, ROLES.FINANCE],
  // The notice is the document a data subject is shown: every role may read it, deliberately (§3.3).
  'compliance:notice': [ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.FINANCE, ROLES.EMPLOYEE, ROLES.COMPLIANCE_VIEWER],
  // §6.2 — a settlement document is a statement about a named person's money. HR reads them all;
  // finance gets the settlement templates and not the rest (TEMPLATE_SCOPES).
  'compliance:templates': [ROLES.HR_ADMIN, ROLES.FINANCE],
  // §3.3 and §6.3 — company-wide figures. A manager is not in the cell, and that refusal is the
  // honest default until counsel answers the small-cohort question (COUNSEL_PENDING).
  'analytics:read': [ROLES.HR_ADMIN, ROLES.FINANCE, ROLES.COMPLIANCE_VIEWER],
  'exit:write': [ROLES.HR_ADMIN],
  // §3.2 — pre-boarding, in three resources because the matrix's cells for these routes differ.
  // This third cell is forced by the same argument §1.1 makes for the split: the LIST is a cell
  // `compliance_viewer` may not have, while the roll-up and the flag watch are a cell it may — one
  // resource would grant the viewer the list, or deny it the roll-up. The model's own words for
  // these three are "the company-wide reads", and `:aggregate` is the two that are derived over all
  // cases rather than the collection itself.
  'preboarding:read': [ROLES.HR_ADMIN],
  'preboarding:read:own': [ROLES.HR_ADMIN],
  'preboarding:read:aggregate': [ROLES.HR_ADMIN, ROLES.COMPLIANCE_VIEWER],
  // §3.2 — the five write routes. `hr_admin` only: the model's "✔ (read-only)" on the notice
  // acknowledgement POST contradicts the read-only definition of `compliance_viewer` (§3.4), and a
  // write is not read-only. Not granted, and named for the model's owner instead of guessed at.
  'preboarding:write': [ROLES.HR_ADMIN],
  // §3.4 — the accounts. `compliance_viewer` reads them because it is the role that resolves a
  // `performed_by` name; creating one stays with HR (§5.2 rule 2 logs it, this slice's prerequisite).
  'users:read': [ROLES.HR_ADMIN, ROLES.COMPLIANCE_VIEWER],
  'users:write': [ROLES.HR_ADMIN],
});

/**
 * `⊘` — permitted by policy, NOT YET EXPRESSIBLE. Resource → role → the link that is missing.
 *
 * There is no mark meaning "yes but later" in a list of roles, so these are written down here:
 * a check asserts none of these roles is in the cell (a grant must delete its own mark), and none of
 * them can pass the gate, because the gate reads `POLICY` alone.
 *
 * THE MISSING LINK, measured 2026-10-20 at `b4f479a`: `preboarding_cases` has no `employee_id`.
 * It carries `candidate_name`, `candidate_email`, `role`, `department`, `reporting_line` and no
 * reference to an `employees` row, so `users.employee_id` — which is what says *which person the
 * caller is* — cannot say *which case is theirs*, nor which hires are a manager's reports. The only
 * link that exists anywhere is a demo convention: `scripts/seed-demo.js` writes `source =
 * 'roster:<employee id>'`, and `server/demo-seed.test.js` asserts the absence of the column on
 * purpose ("the link is by roster id in source until a schema change is decided"). A real client's
 * case is created with `source = 'intake_form'`, so nothing joins it to a person.
 *
 * So the model's two named prerequisites (§8 item 8) are necessary and NOT sufficient: the split and
 * `users.employee_id` are both in place, and these cells still cannot be enforced without a third —
 * a stored case → person link. That is a schema decision, so it is recorded rather than invented.
 */
const PENDING_CELLS = Object.freeze({
  'preboarding:read': Object.freeze({
    [ROLES.MANAGER]: `a manager's own reports' hires — no column joins a pre-boarding case to an employees row`,
  }),
  'preboarding:read:own': Object.freeze({
    [ROLES.EMPLOYEE]: `the caller's own case — users.employee_id names the person, and nothing joins that person to their case`,
    [ROLES.MANAGER]: `the caller's reports' hires — the same missing case → person link`,
  }),
});

/**
 * Denied FOR NOW because counsel owns the question — neither `✖` nor `⊘`. Resource → role → the
 * question, as docs/access-model.md §8 numbers it.
 */
const COUNSEL_PENDING = Object.freeze({
  'preboarding:read': Object.freeze({
    [ROLES.MANAGER]: `§8 item 4 — whether a manager may see a candidate's contact details before the start date`,
  }),
  'preboarding:read:own': Object.freeze({
    [ROLES.EMPLOYEE]: `§8 item 5 — whether the workspace track (lines worked by other functions) belongs on the person's own view at all`,
  }),
  'analytics:read': Object.freeze({
    [ROLES.MANAGER]: `§8 item 3 — the minimum cohort size before an aggregate becomes a disclosure; §6.3's honest default is to refuse a manager rather than answer this by guessing`,
  }),
});

/** How far a role reaches, and the relation a route resolves before it reads one row. */
const SCOPE = Object.freeze({ ALL: 'all', REPORTS: 'reports', OWN: 'own' });
const RELATION = Object.freeze({ SELF: 'self', REPORT: 'report', OTHER: 'other', UNKNOWN: 'unknown' });

/**
 * Resource → role → how far that role reaches. See the header: a role in a cell with no entry here
 * resolves to `null`, and every call site refuses on `null` rather than reading.
 */
const SCOPES = Object.freeze({
  // §3.1 — HR the company, a manager their line (resolved from `employees.manager_id` against the
  // caller's own `users.employee_id`), finance the company (their limit is the FIELDS, not the rows).
  'employees:read': Object.freeze({ [ROLES.HR_ADMIN]: SCOPE.ALL, [ROLES.MANAGER]: SCOPE.REPORTS, [ROLES.FINANCE]: SCOPE.ALL }),
  // Note, and asserted: a `manager` account may read its REPORTS' tasks and not its own — the
  // matrix gives that column `scoped (own reports)` and the employee column `scoped (own)`, and a
  // manager account holds one role. Widening `reports` to include the caller would be the kind of
  // inference this file refuses; it is raised in the PR body instead.
  'onboarding:read': Object.freeze({ [ROLES.HR_ADMIN]: SCOPE.ALL, [ROLES.MANAGER]: SCOPE.REPORTS, [ROLES.EMPLOYEE]: SCOPE.OWN }),
  'onboarding:write': Object.freeze({ [ROLES.HR_ADMIN]: SCOPE.ALL, [ROLES.MANAGER]: SCOPE.REPORTS }),
  'offboarding:read': Object.freeze({ [ROLES.HR_ADMIN]: SCOPE.ALL, [ROLES.EMPLOYEE]: SCOPE.OWN }),
  // The templates route names an employee as well as a document: finance reaches the whole roster for
  // the settlement documents (TEMPLATE_SCOPES is their limit), HR reaches everything.
  'compliance:templates': Object.freeze({ [ROLES.HR_ADMIN]: SCOPE.ALL, [ROLES.FINANCE]: SCOPE.ALL }),
});

/**
 * The columns that never reach a role, and the columns that are a person's pay. Named per resource
 * and role so the payload rule lives beside the route rule — "field" in the matrix's cells.
 *
 * An EMPTY LIST IS A STATEMENT: HR reads the roster as the product has always served it, and that is
 * asserted with a positive control (the columns are present for HR) so "removed for the manager"
 * cannot pass because the column was never there.
 */
const EMPLOYEE_FIELD_GROUPS = Object.freeze({
  // §3.1/§4 — "National-ID columns never leave the HR boundary": encrypted at rest, and the roster
  // read decrypts them, so encryption alone controls nothing about disclosure.
  national_id: Object.freeze(['national_id_value', 'national_id_iqama']),
  // §4 — "Salary, allowances, EOSB accrued/paid": a manager must not see a report's pay; finance may.
  pay: Object.freeze([
    'salary', 'basic_salary', 'total_salary',
    'allowances_housing', 'allowances_transport',
    'eosb_accrued', 'eosb_paid',
  ]),
});
const FIELD_RULES = Object.freeze({
  'employees:read': Object.freeze({
    [ROLES.HR_ADMIN]: Object.freeze([]),
    [ROLES.MANAGER]: Object.freeze(['national_id', 'pay']),
    [ROLES.FINANCE]: Object.freeze(['national_id']),
  }),
});

/** The document a settlement is: finance gets this, and not the contracts or the notices (§6.2). */
const SETTLEMENT_TEMPLATES = Object.freeze(['final-settlement-statement']);
const ALL_TEMPLATES = 'all';
const TEMPLATE_SCOPES = Object.freeze({
  [ROLES.HR_ADMIN]: ALL_TEMPLATES,
  [ROLES.FINANCE]: SETTLEMENT_TEMPLATES,
});

/**
 * Every authenticated `/api` route, in order, as `[method, path pattern, resource]`.
 *
 * The pattern is matched against the request path with the `/api` prefix REMOVED (`/api/employees`
 * → `/employees`). `:name` matches exactly one segment. Order matters only for overlapping
 * patterns, so the most specific come first.
 *
 * Adding a route means adding a line here — and if you forget, the route is refused with 403 rather
 * than left open, which is the property that makes this list safe to get wrong.
 */
const ROUTES = Object.freeze([
  // accounts
  ['GET', '/users', 'users:read'],
  ['POST', '/users', 'users:write'],
  // employees
  ['GET', '/employees', 'employees:read'],
  ['POST', '/employees', 'employees:write'],
  ['PUT', '/employees/:id', 'employees:write'],
  ['GET', '/employees/:id/onboarding', 'onboarding:read'],
  ['PUT', '/onboarding-tasks/:id', 'onboarding:write'],
  ['GET', '/employees/:id/offboarding', 'offboarding:read'],
  ['PUT', '/offboarding-tasks/:id', 'offboarding:write'],
  // compliance
  ['POST', '/compliance/calculate-eosb', 'compliance:calculate'],
  ['GET', '/compliance/notice', 'compliance:notice'],
  ['GET', '/compliance/templates/:templateName/:employeeId', 'compliance:templates'],
  // analytics and exit
  ['GET', '/analytics/dashboard', 'analytics:read'],
  ['POST', '/exit-interviews', 'exit:write'],
  // pre-boarding — the specific paths before the case-collection ones
  // The two DERIVED company-wide reads (they span cases and name no single record).
  ['GET', '/preboarding/checklist/overview', 'preboarding:read:aggregate'],
  ['GET', '/preboarding/flag-watch', 'preboarding:read:aggregate'],
  // The collection itself: a list is the one shape a per-row scope cannot make safe, which is why
  // an employee never holds it (docs/access-model.md §3.2).
  ['GET', '/preboarding/cases', 'preboarding:read'],
  ['POST', '/preboarding/cases', 'preboarding:write'],
  // The single-case reads are the own-record shape: one record per request, so a scope check is
  // possible on them at all (see PENDING_CELLS for why it is not yet possible to resolve which one).
  ['GET', '/preboarding/cases/:id', 'preboarding:read:own'],
  ['GET', '/preboarding/cases/:id/checklist', 'preboarding:read:own'],
  ['GET', '/preboarding/cases/:id/workspace', 'preboarding:read:own'],
  ['GET', '/preboarding/cases/:id/package', 'preboarding:read:own'],
  ['POST', '/preboarding/cases/:id/items/:itemKey/status', 'preboarding:write'],
  ['POST', '/preboarding/cases/:id/reminders', 'preboarding:write'],
  ['POST', '/preboarding/cases/:id/notice-acknowledgements', 'preboarding:write'],
  ['POST', '/preboarding/cases/:id/package/:itemKey/acknowledgement', 'preboarding:write'],
]);

/** `/api/login` and `/api/health` are unauthenticated by design and never reach the gate. */
const PUBLIC_PATHS = Object.freeze(['/login', '/health']);

/** Compile a `:name` pattern once, anchored to the whole path. */
function compile(pattern) {
  const source = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${source}$`);
}
const COMPILED = ROUTES.map(([method, pattern, resource]) => [method, compile(pattern), resource]);

/** The resource a request needs, or `null` when no route declares it (null = denied). */
function resourceFor(method, path) {
  const p = path.startsWith('/api') ? path.slice(4) || '/' : path;
  for (const [m, re, resource] of COMPILED) {
    if (m === method && re.test(p)) return resource;
  }
  return null;
}

/** Is this a role the product knows? Used by the account-creation path so a typo cannot make a
 *  user who matches no policy cell (which would be a person who can log in and do nothing). */
function isKnownRole(role) {
  return typeof role === 'string' && ROLE_LIST.indexOf(role) !== -1;
}

/** How far a role reaches on a resource: a `SCOPE` value, or `null` — and `null` means refuse. */
function scopeFor(resource, role) {
  const table = SCOPES[resource];
  if (!table) return SCOPE.ALL; // the cell is the whole control; no row-level question exists
  const scope = table[role];
  return scope === undefined ? null : scope;
}

/** May a caller holding `scope` reach a row whose relation to them is `relation`? */
function scopedAllows(scope, relation) {
  if (scope === SCOPE.ALL) return true;
  if (scope === SCOPE.OWN) return relation === RELATION.SELF;
  if (scope === SCOPE.REPORTS) return relation === RELATION.REPORT;
  return false; // null (unstated) or anything unrecognised: refuse, never assume
}

/** The employee columns this role's payload must not carry — `null` when the policy does not say. */
function fieldsRemovedFor(resource, role) {
  const table = FIELD_RULES[resource];
  if (!table) return null;
  const groups = table[role];
  if (groups === undefined) return null;
  const columns = [];
  for (const group of groups) columns.push(...EMPLOYEE_FIELD_GROUPS[group]);
  return columns;
}

/** Which documents a role may render: `ALL_TEMPLATES`, a list of names, or `undefined` (refuse). */
function templatesAllowedFor(role) {
  return TEMPLATE_SCOPES[role];
}

/** Routes whose resource no policy cell covers — must be empty. A check runs on this in
 *  server/access.test.js, so a new route cannot be added without a cell to match it. */
function unpoliciedRoutes() {
  return ROUTES.filter(([, , resource]) => !Object.prototype.hasOwnProperty.call(POLICY, resource))
    .map(([method, pattern, resource]) => `${method} /api${pattern} -> ${resource}`);
}

/** Policy cells that name a role the product does not know. Also must be empty. */
function unknownRolesInPolicy() {
  return Object.entries(POLICY)
    .filter(([, roles]) => roles.some((role) => !isKnownRole(role)))
    .map(([resource]) => resource);
}

/**
 * The gate. Runs after `authenticateToken`, so an authenticated caller is guaranteed to be on
 * `req.user`; if somehow not, this refuses rather than falling through.
 */
function gate(req, res, next) {
  const path = req.path || (req.url || '').split('?')[0];
  if (PUBLIC_PATHS.indexOf(path) !== -1) return next();
  if (!req.user) return res.status(401).json({ error: 'Authentication token required' });

  const resource = resourceFor(req.method, path);
  const allowed = resource ? POLICY[resource] : undefined;
  if (!allowed || allowed.length === 0) {
    // Unnamed resource, or a resource nobody may use: deny, and say nothing else.
    return res.status(403).end();
  }
  if (allowed.indexOf(req.user.access_role) === -1) return res.status(403).end();

  // What this request was authorized for, and how far the role reaches on it — so the route (and the
  // audit row it may write) names the rule it went through instead of re-deriving it. `scope` is
  // `null` for a role the table does not cover, and every call site refuses on that.
  req.accessResource = resource;
  req.accessScope = scopeFor(resource, req.user.access_role);
  next();
}

module.exports = {
  ROLES,
  ROLE_LIST,
  POLICY,
  PENDING_CELLS,
  COUNSEL_PENDING,
  SCOPE,
  RELATION,
  SCOPES,
  EMPLOYEE_FIELD_GROUPS,
  FIELD_RULES,
  SETTLEMENT_TEMPLATES,
  ALL_TEMPLATES,
  TEMPLATE_SCOPES,
  ROUTES,
  PUBLIC_PATHS,
  resourceFor,
  isKnownRole,
  scopeFor,
  scopedAllows,
  fieldsRemovedFor,
  templatesAllowedFor,
  unpoliciedRoutes,
  unknownRolesInPolicy,
  gate,
};
