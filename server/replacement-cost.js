/**
 * P4-1 — Replacement cost: the cost of filling a seat after its holder leaves.
 *
 * WHAT THIS IS. Four components, computed from this product's own records when the request is
 * served — never stored, never typed into a screen by hand:
 *
 *   1. recruitment          the recruitment cost recorded on the employee's own record
 *   2. vacancy cover        the window between the recorded departure date and the recorded start
 *                           date of the replacement found in the same department and role
 *   3. onboarding / ramp    the window between the employee's recorded start date and their
 *                           recorded fully-productive date
 *   4. lost productivity    the same vacancy window, at the share of the role's output that cover
 *                           does not replace
 *
 * WHAT THIS IS NOT. It is not a measured outcome, and it is not a statutory figure. Three rates in
 * `MODEL.assumptions` are modelling ASSUMPTIONS: every payload carries them and the sentence that
 * says what they are, and the surfaces render them beside the figure, so no reader can mistake the
 * total for something this product measured. The money and the days, however, are all derived from
 * records — move a salary or a date in the record and the figure moves with it. Nothing here is
 * pinned so a screen will agree with a record (WORKFLOW.md rule 16).
 *
 * A COMPONENT THAT CANNOT BE COMPUTED SAYS SO. It comes back `not_calculated` with the reason
 * naming the missing record. It is never silently 0, and the total is `partial` with the list of
 * missing components rather than presenting a part-sum as if it were the figure. A 0 that is a
 * real reading — a replacement who started the same day the seat emptied — is a different thing:
 * that is a *calculated* 0, carrying the inputs that produced it.
 *
 * The engine is pure: it takes records in and returns a payload out. Resolving WHICH records (the
 * employee, the replacement) is the route's job, and every derivation of that choice is stated in
 * the payload so a reader can disagree with it.
 */

const MODEL_ID = 'replacement-cost/1';

/** The rates that are assumptions, each with the sentence that says so on the surface. */
const ASSUMPTIONS = Object.freeze([
  Object.freeze({
    key: 'vacancy_cover_rate',
    label: 'Vacancy cover',
    value: 1,
    unit: 'days of the role\'s daily salary per vacant day',
    basis: 'ASSUMPTION, not a measurement: the empty seat is covered at one day of the role\'s own '
         + 'daily salary per vacant day — an interim or overtime at the same grade.',
  }),
  Object.freeze({
    key: 'ramp_shortfall_rate',
    label: 'Ramp shortfall',
    value: 0.5,
    unit: 'share of the role\'s output',
    basis: 'ASSUMPTION, not a measurement: across the recorded ramp window the replacement produces '
         + 'about half the role\'s output, so half the salary paid in that window is a cost of the '
         + 'replacement rather than of the work.',
  }),
  Object.freeze({
    key: 'vacancy_output_shortfall_rate',
    label: 'Vacancy output shortfall',
    value: 0.35,
    unit: 'share of the role\'s output',
    basis: 'ASSUMPTION, not a measurement: while the seat is empty, cover replaces about 65% of the '
         + 'role\'s output, so 35% of the role\'s daily value is lost on each vacant day.',
  }),
]);

/** The role's daily cost, from the record. 30-day month is the convention used across the product. */
const DAYS_PER_MONTH = 30;

const CURRENCY_BY_COUNTRY = Object.freeze({ AE: 'AED', SA: 'SAR' });

const round2 = (n) => Math.round(n * 100) / 100;

/** Whole days from `from` to `to`, on date parts only — a time of day must never move a day count. */
function daysBetween(from, to) {
  const a = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

const isMoney = (v) => typeof v === 'number' && Number.isFinite(v);

/** A component that could not be computed: the reason names the record that is missing. */
const notCalculated = (key, label, reason, inputs = {}) => ({
  key, label, state: 'not_calculated', value: null, reason, inputs,
});

/** A component that was computed. `value` may legitimately be 0 — then the inputs say why. */
const calculated = (key, label, value, inputs, basis) => ({
  key, label, state: 'calculated', value: round2(value), reason: null, inputs, basis,
});

/**
 * The four components for one seat.
 *
 * @param {object} input
 * @param {object} input.employee    the record the flag is on
 * @param {object|null} input.successor the replacement found in the roster (or null)
 * @param {string} [input.asOf]      the date the request is served, for open-ended readings
 * @returns {object} the payload the route returns and the client renders
 */
function computeReplacementCost({ employee, successor = null, asOf = null }) {
  const assumptions = Object.fromEntries(ASSUMPTIONS.map((a) => [a.key, a.value]));
  const currency = CURRENCY_BY_COUNTRY[String(employee.data_residency_country || '').toUpperCase()]
    || CURRENCY_BY_COUNTRY[String(employee.jurisdiction || '').toUpperCase()]
    || null;

  const totalSalary = isMoney(employee.total_salary) && employee.total_salary > 0
    ? employee.total_salary
    : (isMoney(employee.salary) && employee.salary > 0 ? employee.salary : null);
  const salaryBasis = totalSalary === null
    ? null
    : (isMoney(employee.total_salary) && employee.total_salary > 0 ? 'total_salary' : 'salary');
  const dailySalary = totalSalary === null ? null : totalSalary / DAYS_PER_MONTH;

  // --- 1. recruitment: recorded, so nothing is assumed about it -------------------------------
  const recruitment = isMoney(employee.recruitment_cost) && employee.recruitment_cost > 0
    ? calculated('recruitment', 'Recruitment', employee.recruitment_cost,
        { recorded_recruitment_cost: employee.recruitment_cost },
        'recorded on the employee\'s own record')
    : notCalculated('recruitment', 'Recruitment',
        employee.recruitment_cost === 0
          ? 'the record holds 0, which is this column\'s default — a default and a real zero '
            + 'cannot be told apart, so this component is not calculated'
          : 'no recruitment cost is recorded for this employee, so what the last hire into this seat cost is unknown');

  // --- the vacancy window, shared by components 2 and 4 --------------------------------------
  let vacancyDays = null;
  let vacancyInputs = null;
  let vacancyReason = null;
  if (!employee.end_date) {
    vacancyReason = 'no departure date is recorded, so there is no vacancy to measure';
  } else if (!successor) {
    vacancyReason = 'no replacement is recorded in this department and role, so the length of the '
                  + 'vacancy is unknown — the seat may still be empty';
  } else if (dailySalary === null) {
    vacancyReason = 'no total salary is recorded, so a day of this role cannot be priced';
  } else {
    const d = daysBetween(employee.end_date, successor.start_date);
    if (d === null || d < 0) {
      vacancyReason = `the replacement's recorded start date (${successor.start_date}) is not after `
                    + `the departure date (${employee.end_date}), so the window cannot be read`;
    } else {
      vacancyDays = d;
      vacancyInputs = {
        departure_date: String(employee.end_date).slice(0, 10),
        replacement_start_date: String(successor.start_date).slice(0, 10),
        replacement_employee_id: successor.id,
        vacancy_days: d,
        daily_salary: round2(dailySalary),
        salary_basis: salaryBasis,
      };
    }
  }

  // --- 2. vacancy cover -----------------------------------------------------------------------
  const vacancyCover = vacancyDays === null
    ? notCalculated('vacancy_cover', 'Vacancy cover', vacancyReason)
    : calculated('vacancy_cover', 'Vacancy cover',
        vacancyDays * dailySalary * assumptions.vacancy_cover_rate,
        { ...vacancyInputs, rate: assumptions.vacancy_cover_rate, rate_key: 'vacancy_cover_rate' },
        'the vacancy window priced at the role\'s own daily salary');

  // --- 3. onboarding / ramp: the ramp window is recorded on the employee -----------------------
  let rampDays = null;
  let rampInputs = null;
  let rampReason = null;
  if (!employee.fully_productive_date) {
    rampReason = 'no fully-productive date is recorded, so the ramp window is unknown';
  } else if (dailySalary === null) {
    rampReason = 'no total salary is recorded, so a day of this role cannot be priced';
  } else {
    const d = daysBetween(employee.start_date, employee.fully_productive_date);
    if (d === null || d < 0) {
      rampReason = `the fully-productive date (${employee.fully_productive_date}) is not after the `
                 + `start date (${employee.start_date}), so the window cannot be read`;
    } else {
      rampDays = d;
      rampInputs = {
        start_date: String(employee.start_date).slice(0, 10),
        fully_productive_date: String(employee.fully_productive_date).slice(0, 10),
        ramp_days: d,
        daily_salary: round2(dailySalary),
        salary_basis: salaryBasis,
      };
    }
  }
  const onboardingRamp = rampDays === null
    ? notCalculated('onboarding_ramp', 'Onboarding / ramp', rampReason)
    : calculated('onboarding_ramp', 'Onboarding / ramp',
        rampDays * dailySalary * assumptions.ramp_shortfall_rate,
        { ...rampInputs, rate: assumptions.ramp_shortfall_rate, rate_key: 'ramp_shortfall_rate' },
        'the recorded ramp window priced at the share of output the replacement is assumed not to produce yet');

  // --- 4. lost productivity: the same vacancy window, the output cover does not replace --------
  const lostProductivity = vacancyDays === null
    ? notCalculated('lost_productivity', 'Lost productivity', vacancyReason)
    : calculated('lost_productivity', 'Lost productivity',
        vacancyDays * dailySalary * assumptions.vacancy_output_shortfall_rate,
        { ...vacancyInputs, rate: assumptions.vacancy_output_shortfall_rate, rate_key: 'vacancy_output_shortfall_rate' },
        'the vacancy window priced at the share of the role\'s output that cover does not replace');

  const components = [recruitment, vacancyCover, onboardingRamp, lostProductivity];
  const missing = components.filter((c) => c.state === 'not_calculated').map((c) => c.key);
  const sum = components.reduce((acc, c) => acc + (c.value === null ? 0 : c.value), 0);

  return {
    model: MODEL_ID,
    employee_id: employee.id,
    employee_name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
    role: employee.role || null,
    department: employee.department || null,
    currency,
    as_of: asOf,
    // What made this figure appear. The flag is read from the record, never passed in by a screen.
    trigger: triggerOf(employee),
    window: {
      departure_date: employee.end_date ? String(employee.end_date).slice(0, 10) : null,
      replacement: successor
        ? {
            employee_id: successor.id,
            start_date: String(successor.start_date).slice(0, 10),
            // Said out loud, because a reader may disagree with how the replacement was found.
            basis: 'the earliest employee recorded in the same department and role with a start date '
                 + 'after the departure date',
          }
        : null,
    },
    components,
    total: {
      state: missing.length === 0 ? 'calculated' : 'partial',
      value: round2(sum),
      currency,
      calculated_components: components.length - missing.length,
      components_total: components.length,
      not_calculated: missing,
      note: missing.length === 0
        ? 'all four components are computed from records; the three rates they use are the assumptions below'
        : `PARTIAL: ${missing.length} of ${components.length} components could not be computed `
        + `(${missing.join(', ')}), so this figure is what could be computed and is NOT the whole cost`,
    },
    assumptions: ASSUMPTIONS,
  };
}

/**
 * The flag the figure hangs on, read from the record. A termination flag is a status of
 * `offboarding` or `terminated`, or a recorded termination type. There is no performance flag in
 * the schema today — no column, no route, no data — so this function does not invent one; when a
 * performance record exists, this is the one place that learns to read it.
 */
function triggerOf(employee) {
  const status = String(employee.status || '').toLowerCase();
  if (employee.termination_type || status === 'offboarding' || status === 'terminated') {
    return {
      key: 'termination_flag',
      label: 'Termination flag',
      detail: `status ${status || 'unset'}`
        + (employee.termination_type ? `, termination type ${employee.termination_type}` : '')
        + (employee.end_date ? `, departure ${String(employee.end_date).slice(0, 10)}` : ', no departure date recorded'),
    };
  }
  return null;
}

module.exports = { computeReplacementCost, triggerOf, MODEL_ID, ASSUMPTIONS, DAYS_PER_MONTH, daysBetween };
