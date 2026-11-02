/**
 * The demo seed records NO termination reason — and it refuses rather than ignores.
 *
 * OWNER DIRECTION, 2026-10-30, verbatim: *"Never seed a demo termination reason — make that
 * impossible and show me the test."* It closes the open detail under the L4 ruling of 2026-10-29
 * ("`termination_type` stays NULL until a named actor records a real event; a blank record computes
 * UNREDUCED and says so").
 *
 * WHY A MODULE AND NOT A COMMENT. `scripts/seed-demo.js` enumerates its INSERT columns, so a
 * termination reason named on a persona object is DROPPED SILENTLY — no error, no row, nothing to
 * see. And the one expression that does reach the database is a template literal, so the next edit
 * that turns it into a reason writes one with the same amount of ceremony as writing NULL. A rule
 * that lives in a plan sentence, or in a comment beside the code, is a comment, not a control (the
 * team's own rule). Two mechanisms here, and they are deliberately different:
 *
 *   1. `assertRosterCarriesNoTerminationReason(people)` — REFUSES a roster that names a reason
 *      anywhere on it, naming the row, the field and the value. It converts the silent drop into a
 *      loud failure, which is the only way the enumerating-INSERT trap can be caught at all.
 *   2. `terminationTypeSqlValue(value)` — the writer's own refusal. The seed has exactly one
 *      constant for the reason it seeds (`null`), and this function renders it to SQL. Hand it
 *      anything else and it throws BEFORE the statement is built, so there is no expression a future
 *      edit can leave in place that would write a reason.
 *
 * WHAT THIS IS NOT. It does not police the *product*: `PUT /api/employees/:id` may record a real
 * termination reason, and it is gated on a named actor (`employees:write`, HR_ADMIN) and asserted
 * by `server/access.test.js`. That is the only path that may write one, it names who wrote it, and
 * it is not this module's business. Nor does it touch `exit_interviews.departure_reason`: that is
 * the EXIT-INTERVIEW instrument — a reason for leaving as the person themselves gave it — a
 * different table, a different route with its own gate, and it reduces no figure. The L4 figure is
 * computed from `employees.termination_type` alone (`server/eosb.js`), and that is the column this
 * module keeps empty.
 *
 * The proof that both mechanisms bite lives in `server/demo-seed-termination-reason.test.js`, which
 * judges the SEEDED DATABASE (zero rows carry a reason, and the leavers' figures are the unreduced
 * ones) and exercises the refusal directly.
 */

/** The only termination reason the demo seed may record. There is no second one. */
const SEEDED_TERMINATION_TYPE = null;

/**
 * Every spelling a roster object could use to carry a reason. The DB column is `termination_type`;
 * the rest are here because a persona is a plain JS object and a camelCase twin would be dropped by
 * the INSERT just as silently as the snake_case one.
 */
const TERMINATION_REASON_FIELDS = Object.freeze([
  'termination_type',
  'termination_reason',
  'terminationType',
  'terminationReason',
]);

/** A value is a REASON only if it says something: `null`, `undefined` and `''` are the blank state. */
function carriesAReason(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * The rows on this roster that would carry a termination reason, as printable descriptions.
 * Returns [] for a clean roster — including one where a field is present and blank, which is the
 * state the ruling requires, not an offender.
 */
function findSeededTerminationReasons(people) {
  const offenders = [];
  for (const person of Array.isArray(people) ? people : []) {
    const id = (person && (person.id || person.email)) || '<no id>';
    for (const field of TERMINATION_REASON_FIELDS) {
      if (person && carriesAReason(person[field])) {
        offenders.push(`${id}.${field} = ${JSON.stringify(person[field])}`);
      }
    }
  }
  return offenders;
}

/**
 * Refuse to seed a roster that names a termination reason. Throws (the seed's `catch` exits 1, so a
 * refusal cannot be mistaken for a run) and names every offender it found.
 */
function assertRosterCarriesNoTerminationReason(people) {
  const offenders = findSeededTerminationReasons(people);
  if (offenders.length > 0) {
    throw new Error(
      'Refusing to seed a termination reason. The demo dataset may never record one: '
      + 'employees.termination_type stays NULL until a named actor records a real event, and a '
      + 'seeded reason would both invent a personnel event nobody recorded and turn an unreduced '
      + 'benefit into a reduced one. Owner direction 2026-10-30. Offending rows on the roster:\n  '
      + offenders.join('\n  '),
    );
  }
  return people;
}

/**
 * The SQL value for the seed's termination column — the writer's own refusal.
 *
 * `value` is `SEEDED_TERMINATION_TYPE` and nothing else. A non-blank value throws here, before the
 * INSERT is built, so no edit can reach the database with a seeded reason.
 */
function terminationTypeSqlValue(value) {
  if (carriesAReason(value)) {
    throw new Error(
      `Refusing to write termination_type = ${JSON.stringify(value)} from the demo seed. The only `
      + 'value the seed may write to that column is NULL (SEEDED_TERMINATION_TYPE). Owner direction '
      + '2026-10-30: never seed a demo termination reason.',
    );
  }
  return 'NULL';
}

module.exports = {
  SEEDED_TERMINATION_TYPE,
  TERMINATION_REASON_FIELDS,
  carriesAReason,
  findSeededTerminationReasons,
  assertRosterCarriesNoTerminationReason,
  terminationTypeSqlValue,
};
