/**
 * The reachability registers — the *policy* half of the check, kept separate from the measurement
 * (`server/reachability.js`) and from the assertions (`server/reachability.test.js`), because a
 * person needs to read and run these too (`scripts/reachability-report.js`).
 *
 * What a register is for: a defect the team knows about and has NOT fixed. Every entry names the
 * decision that owns the fix, so "leave it and say so" is written down rather than assumed — that
 * is the whole reason decision 21 exists. The test asserts each register matches reality EXACTLY:
 * a new orphan fails the build, and a fixed one cannot linger here looking like a defect.
 *
 * Measured 2026-10-12 on origin/main 83dd151 (the tree that served cutover #5). Line numbers in the
 * prose are dated readings; every anchor the test uses is a string, not a line number, because a
 * line number goes stale on its own (this repository has been bitten by that repeatedly).
 */

const CALLERLESS = {
  'GET /api/employees/:id': {
    route: 'server/index.js:170',
    why: 'Returns one employee with the national ID decrypted. No client code calls it: the roster '
       + '(GET /api/employees) is what the UI reads, and the detail view takes its employee from that '
       + 'list. An orphan that also widens the API surface by an unnecessary PII read: the handler answers '
       + 'res.json(emp), so the decrypted identifier is the response body, not an incidental field.',
    owner: 'decision 21 — recommendation: remove (a dead route whose response body is the decrypted national ID)',
  },
  'POST /api/compliance/calculate-eosb': {
    route: 'server/index.js:335',
    why: 'A pure EOSB calculator over the request body. The product computes EOSB server-side for the '
       + 'settlement statement, so nothing calls the endpoint form of it.',
    owner: 'decision 21 — recommendation: remove (the engine keeps its tests; only the HTTP door goes)',
  },
  'POST /api/compliance/consent': {
    route: 'server/index.js:359',
    why: 'The employee-record consent instrument. No caller and no test; the tile it feeds is written '
       + 'by the demo seeder (scripts/seed-demo.js). Measured for decision 17.',
    owner: 'decision 17 — measured; recommendation is to retire the instrument and keep the subject',
  },
  'GET /api/compliance/report': {
    route: 'server/index.js:424',
    why: 'A compliance roll-up no client code requests, and the second callerless route that decrypts '
       + 'national IDs: it decrypts national_id_value and national_id_iqama, filters the decrypted array by '
       + 'visa expiry and returns the alerts array whole, so wiring it unchanged would return a plaintext '
       + 'national ID and Iqama for every employee whose visa expires within 60 days. The figure it would '
       + 'print is consentGranted, the seeder-written flag (scripts/seed-demo.js:320; the only other writer '
       + 'is the callerless POST /api/compliance/consent). Found while measuring decision 17.',
    owner: 'decision 21 — recommendation: remove (wiring it would return a plaintext national ID and Iqama for every employee whose visa expires within 60 days); wiring stays open only behind decision 17',
  },
  'GET /api/preboarding/cases/:id': {
    route: 'server/index.js:646',
    why: 'Single-case detail. The UI reads the list (GET /api/preboarding/cases) and each sub-resource '
       + 'it actually shows (checklist, workspace, package), never this one.',
    owner: 'decision 21 — recommendation: remove (the list response already carries the case)',
  },
  'GET /api/preboarding/flag-watch': {
    route: 'server/index.js:840',
    why: 'Reports the flag watcher record over HTTP. Nothing calls it — the scheduler reads the module '
       + 'directly (flagWatcher.status()), so this route is a second, unused door to the same value.',
    owner: 'decision 21 — recommendation: wire it to the operator check, or remove',
  },
};

/**
 * Call sites that build their path at runtime. Equality cannot prove these, so each is declared
 * with what it covers and why it is believed to reach it — and the test re-checks that the
 * declaration still matches the source.
 *
 * The anchor is the expression's TEXT, located in the file, not a line number. Reason, measured:
 * pinning `App.tsx:1068` made the check fail when an unrelated line was *inserted above* it — a
 * false alarm about a call site that had not moved. A line number in a register goes stale on its
 * own; the string does not.
 */
const DYNAMIC_SITES = [
  {
    file: 'client/src/App.tsx',
    expr: '/api/${endpoint}/${taskId}',
    covers: ['PUT /api/onboarding-tasks/:id', 'PUT /api/offboarding-tasks/:id'],
    why: 'the line above sets endpoint from a ternary — onboarding-tasks or offboarding-tasks — which '
       + 'are exactly the two task routes; the task checkbox in the employee view calls it.',
  },
];

/**
 * Boolean UI state that can never be turned on: the control it gates has no opener. Measured
 * 2026-10-12 — `setShowExitModal` is called twice in App.tsx and both times with `false`.
 */
const UNOPENABLE_CONTROLS = {
  showExitModal: {
    declaration: 'const [showExitModal, setShowExitModal] = useState(false);',
    why: 'The Exit Intelligence Intake modal. Its setter is called twice — after a successful submit '
       + '(App.tsx:1148 as measured 2026-10-12) and on the close button (:2424) — never with `true`, '
       + 'so no click in the product opens it. Its route, POST /api/exit-interviews, IS reachable by '
       + 'path; the control is not. That split is exactly what the route check alone cannot see.',
    owner: 'decision 16 (wire it, or leave it and say so) — not yet ruled',
  },
};

/**
 * Values a tile displays, and whether anything that RUNS IN PRODUCTION writes them. A tile whose
 * value only the demo seeder writes shows a number the product cannot produce — that is decision
 * 17's defect in one sentence, and this is the assertion that keeps it from being re-forgotten.
 */
const DISPLAYED_VALUES = [
  {
    tile: 'employee record — "✓ GRANTED ON {date}"',
    reader: 'client/src/App.tsx',
    readerPattern: '✓ GRANTED ON ${selectedEmployee.consent_date}',
    columns: ['consent_granted', 'consent_date'],
    why: 'The only writer in the product is inside POST /api/compliance/consent, which no client code '
       + 'calls; every value the demo shows was written by scripts/seed-demo.js.',
    owner: 'decision 17',
  },
];

/**
 * The fourth instance, found on the live product by the designer on 2026-10-12 and measured here:
 * a document item the notice assigns **no basis** to can still be moved to `requested`, and from
 * there nothing can move it on. `Mark received` is disabled by that same missing basis
 * (`client/src/App.tsx:2119`), while the `Request` control above it carries no condition
 * (`:2115`) and the server's collect gate only fires for `received`/`verified`
 * (`server/preboarding-items.js`, the `COLLECTED_STATUSES.indexOf(status)` branch). The item then
 * sits in `requested` forever and counts in `items_outstanding` — a state a user can enter and
 * cannot leave, which is a distinct class from "no caller" and "no opener".
 *
 * Wire/remove is not a code question: the basis for these three items is what counsel (15(a)) has
 * not answered, so the *item* cannot be collected until it does. What can be decided now is the
 * control: do not offer `Request` for an item that cannot be received (recommended — it is the
 * cheap half), or offer it and say on the tile what it is waiting for.
 */
const DEAD_END_ITEMS = {
  education_certificate: {
    why: 'The notice has no purpose row for qualifications, so no basis is assigned and the item is '
       + 'not collectible; the Request control offers the move anyway, and the collect gate refuses '
       + 'every step after it.',
    owner: 'counsel (15(a), question Q1) + a product ruling on the Request control — not yet ruled',
  },
  experience_certificate: {
    why: 'Same as the education certificate: no notice basis, not collectible, requestable.',
    owner: 'counsel (15(a), question Q1) + a product ruling on the Request control — not yet ruled',
  },
  emergency_contact: {
    why: 'The notice assigns no basis and the data is a third person\'s, not the hire\'s, so it is not '
       + 'collectible; requestable like the other two.',
    owner: 'counsel (15(a), question Q5) + a product ruling on the Request control — not yet ruled',
  },
};

module.exports = {
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES, DEAD_END_ITEMS,
};
