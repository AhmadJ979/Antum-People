/**
 * Calculates End-of-Service Benefits (EOSB) based on GCC rules.
 */
function calculateEOSB(startDateStr, endDateStr, basicSalary, totalSalary, country, terminationType = 'resignation', unpaidLeaveDays = 0) {
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
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
  
  if (terminationType === 'summary_dismissal') {
    return 0; // Forfeit entire EOSB for gross misconduct
  }

  let accrued = 0;
  const isResignation = terminationType === 'resignation';
  
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
  } else {
    // UAE (FDL 33/2021): Based on Basic Salary
    const bSalary = parseFloat(basicSalary) || 0;
    const dailyBasic = bSalary / 30;
    if (tenureYears < 1) return 0;

    const firstPeriodYears = Math.min(5, tenureYears);
    accrued += firstPeriodYears * 21 * dailyBasic;
    
    if (tenureYears > 5) {
      const secondPeriodYears = tenureYears - 5;
      accrued += secondPeriodYears * 30 * dailyBasic;
    }

    // UAE Cap: 2 years of Basic Salary
    accrued = Math.min(accrued, bSalary * 24);

    if (isResignation) {
      if (tenureYears >= 1 && tenureYears < 3) accrued *= (1/3);
      else if (tenureYears >= 3 && tenureYears < 5) accrued *= (2/3);
    }
  }
  
  return Math.round(accrued * 100) / 100;
}

module.exports = { calculateEOSB };
