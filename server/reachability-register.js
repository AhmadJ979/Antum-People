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
  'POST /api/compliance/calculate-eosb': {
    route: 'server/index.js:335',
    why: 'A pure EOSB calculator over the request body. The product computes EOSB server-side for the '
       + 'settlement statement, so nothing calls the endpoint form of it.',
    owner: 'decision 21 — recommendation: remove (the engine keeps its tests; only the HTTP door goes)',
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
  // EMPTY as of 2026-10-13, and that is the measurement: this register held exactly one entry — the
  // employee record's "✓ GRANTED ON {date}" tile, whose value only the demo seeder wrote (decision
  // 17). The tile is retired, so there is nothing left to register here. A displayed value with no
  // reachable writer that is NOT written down still fails the test above; this list is where it goes
  // when one is found, and it is deliberately empty rather than deleted.
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

/**
 * Elements a decision REMOVED, each with an anchor the test re-measures. A register of defects is
 * only half a check: this repository has already re-acquired a retired thing once (the tracker's
 * standing test stopped being a line inside an unrelated merge, invisible to ancestry and blob
 * checks alike). So a removal is not a memory here — it is a route that must not be registered and
 * a string that must not be in a file, and server/reachability.test.js reddens if either returns.
 *
 * Measured 2026-10-13, owner decisions 21 and 17 executed.
 */
const RETIRED = {
  routes: {
    'GET /api/employees/:id': {
      removed: '2026-10-13',
      decision: 'decision 21',
      usedToReturn: 'One employee row with national_id_value and national_id_iqama decrypted and '
        + 'returned as the response body.',
      why: 'No caller existed (the roster is what the UI reads, and the detail view takes its '
        + 'employee from that list) and the payload was the decrypted identifier. Removed rather '
        + 'than wired: there is no screen that needs it, so the only thing wiring it would produce '
        + 'is a second copy of a national ID in a response.',
    },
    'POST /api/compliance/consent': {
      removed: '2026-10-13',
      decision: 'decision 17',
      usedToReturn: 'The id of the consent_records row it wrote — and, on the employee record, '
        + 'consent_granted = 1 with consent_date.',
      why: "The employee-record consent instrument's only writer inside the product, and no client "
        + 'called it. The instrument is retired: the product records the notice as SHOWN, one row '
        + "per collectable document per pre-boarding case, with that document's basis, the notice's "
        + 'version and a named actor. The `consent_records` TABLE stays (purpose-scoped consent is '
        + "decision 14's subject) — this takes away the door, not the store.",
    },
    'GET /api/compliance/report': {
      removed: '2026-10-13',
      decision: 'decision 21',
      usedToReturn: 'A whole-roster PII payload: it decrypted national_id_value and '
        + 'national_id_iqama for every employee, filtered that decrypted array by visa expiry and '
        + 'returned `alerts` whole — a plaintext national ID and Iqama for every employee whose visa '
        + 'expires within 60 days — plus `consentGranted`, the seeder-written flag.',
      why: 'No client code called it, and it was also the only server-side READER of '
        + 'employees.consent_granted, so removing it retired the last thing that could print the '
        + 'fabricated count.',
    },
  },
  /**
   * Strings whose return would mean the retired instrument came back. Each is checked against the
   * file named, on the line's own text — not by counting hits anywhere, because a hit count does
   * not know what role a string plays (the pass that corrected this register learned that a
   * corrected document quoting a retired phrase is not the defect coming back).
   */
  sourceAnchors: [
    {
      what: 'the employee-record consent tile, which printed a status the product cannot produce',
      file: 'client/src/App.tsx',
      absent: '\u2713 GRANTED ON ${selectedEmployee.consent_date}',
      decision: 'decision 17',
      why: 'Its value was written only by the demo seeder, and its "MISSING / REQUIRED" branch '
        + 'asserted an obligation the notice\u2019s purpose table assigns to almost nothing. The tile '
        + 'now states the instrument the product operates and displays no status.',
    },
    {
      what: 'the seeder writing the consent flag as granted onto every employee',
      file: 'scripts/seed-demo.js',
      absent: 'consent_granted, consent_date, created_at, updated_at',
      decision: 'decision 17',
      why: '13 of 13 seeded employees read GRANTED because of this line, and no production path '
        + 'could have written it. The columns keep their schema default (0).',
    },
    {
      what: 'the orphan writer\u2019s SQL, which set the flag on the employee record',
      file: 'server/index.js',
      absent: 'INSERT INTO consent_records',
      decision: 'decision 17',
      why: 'The only product-side write into consent_records sat inside that removed route.',
    },
  ],
};

module.exports = {
  CALLERLESS, DYNAMIC_SITES, UNOPENABLE_CONTROLS, DISPLAYED_VALUES, DEAD_END_ITEMS, RETIRED,
};
