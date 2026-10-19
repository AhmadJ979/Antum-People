/**
 * server/access.js — THE ONE PLACE the authorization policy lives. Layer 3, slice 1 (decision 11).
 *
 * WHY THIS EXISTS (measured 2026-10-19): `users.role` was signed into the JWT and returned by
 * `/api/login` and **never checked anywhere else** — so any authenticated caller reached every
 * `/api` route. The role was decoration. This module makes it load-bearing.
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
 * A refusal is `403` **with no body** — the caller is told nothing about what exists. An absent or
 * invalid token is a different thing and stays `401`, from `authenticateToken`, before this runs.
 *
 * THE POLICY BELOW, today: every cell allows `admin` only. That is not a guess about the business —
 * it is today's behaviour written down, because `admin` is the only role that exists in this
 * product's data (the seeded demo account) and this slice must not silently widen or narrow what
 * works. The compliance expert's `docs/access-model.md` (roles × resources, each cell with its PDPL
 * basis, `(counsel)` where that is the honest answer) is what fills these cells in. Widening access
 * is therefore an edit to ONE table in ONE file, visible in review — never an omission, and never a
 * route that forgot to declare anything.
 *
 * NOT IN THIS SLICE: "My lines", the hire-facing portal (decision 14), document storage (IFZA,
 * decision 10), SSO, password reset, MFA. No session/cookie change: the JWT still travels in
 * `Authorization`, and JWT-in-localStorage is a separate, still-open item.
 */

/** The roles this product knows. `admin` is the only one in the data today. */
const ROLES = Object.freeze({ ADMIN: 'admin' });
const ROLE_LIST = Object.freeze(Object.values(ROLES));

/**
 * The policy: resource → the roles allowed to use it.
 *
 * Every cell is `[ROLES.ADMIN]` today, and that is the point: this table IS today's behaviour. When
 * `docs/access-model.md` lands, its matrix edits these cells.
 */
const POLICY = Object.freeze({
  'employees:read': [ROLES.ADMIN],
  'employees:write': [ROLES.ADMIN],
  'onboarding:read': [ROLES.ADMIN],
  'onboarding:write': [ROLES.ADMIN],
  'offboarding:read': [ROLES.ADMIN],
  'offboarding:write': [ROLES.ADMIN],
  'compliance:calculate': [ROLES.ADMIN],
  'compliance:notice': [ROLES.ADMIN],
  'compliance:templates': [ROLES.ADMIN],
  'analytics:read': [ROLES.ADMIN],
  'exit:write': [ROLES.ADMIN],
  'preboarding:read': [ROLES.ADMIN],
  'preboarding:write': [ROLES.ADMIN],
  'users:read': [ROLES.ADMIN],
  'users:write': [ROLES.ADMIN],
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
  // accounts (this slice)
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
  ['GET', '/preboarding/checklist/overview', 'preboarding:read'],
  ['GET', '/preboarding/flag-watch', 'preboarding:read'],
  ['GET', '/preboarding/cases', 'preboarding:read'],
  ['POST', '/preboarding/cases', 'preboarding:write'],
  ['GET', '/preboarding/cases/:id', 'preboarding:read'],
  ['GET', '/preboarding/cases/:id/checklist', 'preboarding:read'],
  ['GET', '/preboarding/cases/:id/workspace', 'preboarding:read'],
  ['GET', '/preboarding/cases/:id/package', 'preboarding:read'],
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
  if (allowed.indexOf(req.user.role) === -1) return res.status(403).end();

  req.accessResource = resource; // the route (and its logs) can name what it was authorized for
  next();
}

module.exports = {
  ROLES,
  ROLE_LIST,
  POLICY,
  ROUTES,
  PUBLIC_PATHS,
  resourceFor,
  isKnownRole,
  unpoliciedRoutes,
  unknownRolesInPolicy,
  gate,
};
