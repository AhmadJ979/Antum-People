/**
 * Calculates End-of-Service Benefits (EOSB) based on GCC rules.
 *
 * THE TERMINATION REASON IS NEVER DEFAULTED (owner ruling, 2026-10-29)
 * -------------------------------------------------------------------
 * Until this change the signature read `terminationType = 'resignation'`, so a caller that knew
 * nothing about the reason got a resignation — and the UAE 1/3 and 2/3 tiers were then applied to a
 * figure no record justified. The ruling, verbatim: "Leave the termination reason blank until a
 * named person records a real one, and when it's blank show EOSB unreduced rather than guessing."
 *
 * So:
 *   * a BLANK reason (`null`, `undefined`, `''`) is a STATE, not a value. It computes the benefit
 *     UNREDUCED, and the returned basis says so (`no_reason_recorded`);
 *   * an UNKNOWN reason is REFUSED by name, loudly — never coerced to a resignation and never
 *     quietly treated as an ordinary termination;
 *   * a RECORDED reason keeps exactly the arithmetic it had before this change. The 1/3 and 2/3
 *     tiers are untouched, thresholds included: they are counsel's open question (the engine letter's
 *     item 2 freezes the engine on them), not ours to move;
 *   * every call returns the BASIS it used, so no caller has to infer one.
 */
const TERMINATION_REASONS = Object.freeze(['resignation', 'termination', 'summary_dismissal']);

/**
 * WHY an amount is what it is — the basis of the ARITHMETIC, which is the thing a screen has to be
 * able to say out loud. `recorded_reduced` and `recorded_no_reduction` both mean a reason IS on the
 * record; only `no_reason_recorded` means the figure carries a reduction decision nobody made.
 */
const BASIS = Object.freeze({
  NO_REASON_RECORDED: 'no_reason_recorded',
  RECORDED_NO_REDUCTION: 'recorded_no_reduction',
  RECORDED_REDUCED: 'recorded_reduced',
  FORFEITED: 'forfeited',
  BELOW_MINIMUM_SERVICE: 'below_minimum_service',
  NOT_COMPUTABLE: 'not_computable',
});

/**
 * The reason as a RECORD holds it: `null` when the record holds none, the value when it is known.
 * Throws on anything else — the flag, at the one place every caller passes through.
 */
function recordedReason(value) {
  if (value === null || value === undefined) return null;
  const reason = String(value).trim();
  if (reason === '') return null;
  if (TERMINATION_REASONS.indexOf(reason) === -1) {
    throw new Error(
      `unknown termination reason ${JSON.stringify(reason)} — accepted: ${TERMINATION_REASONS.join(', ') || '(none)'}. `
      + 'A blank reason is a state (pass null), not a value.'
    );
  }
  return reason;
}

/** A value a screen may read back off a stored row: never throws, and says when it recognises nothing. */
function storedReason(value) {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (raw === '') return { reason: null, state: 'not_recorded', recognised: true };
  if (TERMINATION_REASONS.indexOf(raw) === -1) return { reason: raw, state: 'unrecognised', recognised: false };
  return { reason: raw, state: 'recorded', recognised: true };
}

/**
 * @returns {{amount: number, reason: string|null, basis: string, factor: number}}
 *   `factor` is the reduction the engine applied: 1 = unreduced, 0 = nothing payable, 1/3 and 2/3 are
 *   the recorded-resignation tiers.
 */
function calculateEOSBDetailed(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType, unpaidLeaveDays = 0) {
  const reason = recordedReason(terminationType);
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { amount: 0, reason, basis: BASIS.NOT_COMPUTABLE, factor: 0 };
  }

  const isKSA = country === 'SA' || country === 'KSA';

  const rawDiffTime = Math.max(0, end.getTime() - start.getTime());
  const rawDays = rawDiffTime / (1000 * 60 * 60 * 24);
  const leaveDays = parseInt(unpaidLeaveDays) || 0;

  let netDays;
  if (isKSA) {
    // KSA: No statutory exclusion for unpaid leave unless specified in contract.
    // Following compliance recommendation Finding 2: subtract all.
    netDays = Math.max(0, rawDays - leaveDays);
  } else {
    // UAE: Only exclude unpaid leave exceeding 90 days per year of service (Decree-Law 33/2021)
    const totalYears = rawDays / 365.25;
    const allowedUnpaidTotal = 90 * totalYears;
    const excessUnpaid = Math.max(0, leaveDays - allowedUnpaidTotal);
    netDays = Math.max(0, rawDays - excessUnpaid);
  }

  const tenureYears = netDays / 365.25;

  if (reason === 'summary_dismissal') {
    return { amount: 0, reason, basis: BASIS.FORFEITED, factor: 0 }; // Forfeit entire EOSB for gross misconduct
  }

  let accrued = 0;

  if (isKSA) {
    // Saudi Arabia (Option B - Royal Decree M/51 Art. 84): Based on Total Salary (including allowances)
    // - Pro-rata from day one (no under-2-year zero)
    // - No resignation reduction (full EOSB for both resignation and termination)
    const monthlyRate = parseFloat(totalSalary) || parseFloat(basicSalary) || 0;

    if (tenureYears <= 5) {
      accrued = (monthlyRate / 2) * tenureYears;
    } else {
      accrued = (monthlyRate / 2) * 5 + (monthlyRate) * (tenureYears - 5);
    }
    // No reduction exists in this jurisdiction for any reason, so the basis is the same whether a
    // reason is recorded or not — but it still says WHICH, because "unreduced" and "not recorded"
    // are different facts about the record and a screen must not conflate them.
    return {
      amount: Math.round(accrued * 100) / 100,
      reason,
      basis: reason === null ? BASIS.NO_REASON_RECORDED : BASIS.RECORDED_NO_REDUCTION,
      factor: 1,
    };
  }

  // UAE (FDL 33/2021): Based on Basic Salary
  const bSalary = parseFloat(basicSalary) || 0;
  const dailyBasic = bSalary / 30;
  if (tenureYears < 1) return { amount: 0, reason, basis: BASIS.BELOW_MINIMUM_SERVICE, factor: 0 };

  const firstPeriodYears = Math.min(5, tenureYears);
  accrued += firstPeriodYears * 21 * dailyBasic;

  if (tenureYears > 5) {
    const secondPeriodYears = tenureYears - 5;
    accrued += secondPeriodYears * 30 * dailyBasic;
  }

  // UAE Cap: 2 years of Basic Salary
  accrued = Math.min(accrued, bSalary * 24);

  let factor = 1;
  let basis = BASIS.RECORDED_NO_REDUCTION;
  if (reason === 'resignation') {
    if (tenureYears >= 1 && tenureYears < 3) { accrued *= (1 / 3); factor = 1 / 3; basis = BASIS.RECORDED_REDUCED; }
    else if (tenureYears >= 3 && tenureYears < 5) { accrued *= (2 / 3); factor = 2 / 3; basis = BASIS.RECORDED_REDUCED; }
  } else if (reason === null) {
    // The reduction decision nobody recorded: no reason, so NO reduction is applied. This is the
    // owner's ruling, and it is the whole point of the change — the old default silently made this
    // row a resignation and shrank the figure.
    basis = BASIS.NO_REASON_RECORDED;
  }

  return { amount: Math.round(accrued * 100) / 100, reason, basis, factor };
}

/** The amount, unchanged in shape for every caller that only wants the money. */
function calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType, unpaidLeaveDays = 0) {
  return calculateEOSBDetailed(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType, unpaidLeaveDays).amount;
}

/**
 * The basis for an employee ROW (a stored record), read by a screen. Never throws and never coerces:
 * a stored reason this engine does not recognise is reported as `unrecognised_reason` with no factor,
 * because guessing a factor for it would be the same defect in a new place.
 */
function basisForRow(row) {
  const record = row || {};
  const state = storedReason(record.termination_type);
  if (!state.recognised) {
    return { reason: state.reason, basis: 'unrecognised_reason', factor: null, recognised: false };
  }
  const computed = calculateEOSBDetailed(
    record.start_date,
    record.end_date || null,
    record.basic_salary,
    record.salary,
    record.data_residency_country,
    state.reason,
    record.unpaid_leave_days || 0
  );
  return { reason: computed.reason, basis: computed.basis, factor: computed.factor, recognised: true };
}

module.exports = { calculateEOSB, calculateEOSBDetailed, basisForRow, recordedReason, storedReason, TERMINATION_REASONS, BASIS };
