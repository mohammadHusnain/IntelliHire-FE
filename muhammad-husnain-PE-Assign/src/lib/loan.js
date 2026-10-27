// Fixed-rate loan repayment (monthly payments, monthly compounding).
//
// Standard annuity formula for the exact payment:
//   M = P · r / (1 − (1 + r)^−n)       r = annual rate / 12, n = months
//   M = P / n                           when r = 0
//
// Everything is computed from the exact (unrounded) payment and only
// rounded to the cent for display:
//   monthly payment = round(M)
//   total paid      = round(M · n)
//   total interest  = total paid − principal
// Rounding the payment first and then simulating a cent-by-cent schedule
// was tried and rejected: at long terms and high rates the sub-cent error
// compounds into a wildly wrong final payment. Computing totals from the
// exact payment keeps interest at exactly $0.00 for a 0% loan. The cost:
// total paid can differ from (rounded monthly payment × n) by at most
// half a cent per payment, which the UI states.

import { parseMoney, parsePercent, parseWholeNumber } from './parseInput.js';

export const LOAN_LIMITS = Object.freeze({
  minCents: 100_00,             // $100.00
  maxCents: 100_000_000_00,     // $100,000,000.00
  maxRatePercent: 100,
  rateDecimals: 3,
  minYears: 1,
  maxYears: 50,
});

/**
 * @param {{principalCents: number, annualRatePercent: number, years: number}} input
 */
export function calculateLoan({ principalCents, annualRatePercent, years }) {
  const months = years * 12;
  const r = annualRatePercent / 100 / 12;
  const exactPaymentCents = r === 0 ? principalCents / months : (principalCents * r) / (1 - (1 + r) ** -months);
  const totalPaidCents = Math.round(exactPaymentCents * months);
  return {
    months,
    monthlyPaymentCents: Math.round(exactPaymentCents),
    totalPaidCents,
    totalInterestCents: totalPaidCents - principalCents,
  };
}

// Field validators. Each returns {ok: true, value} or {ok: false, message}.
// Exported separately so the UI can validate a field as soon as it is edited.

/** Loan amount text -> integer cents. */
export function validateLoanAmount(amount) {
  return parseMoney(amount, {
    label: 'loan amount',
    minCents: LOAN_LIMITS.minCents,
    maxCents: LOAN_LIMITS.maxCents,
    tooSmall: 'Loan amount must be at least $100.00.',
    tooLarge: 'Loan amount cannot be more than $100,000,000.00.',
  });
}

/** Annual rate text -> rate in thousandths of a percent (6.5% -> 6500). */
export function validateLoanRate(rate) {
  return parsePercent(rate, {
    label: 'interest rate',
    decimals: LOAN_LIMITS.rateDecimals,
    max: LOAN_LIMITS.maxRatePercent,
    tooLarge: 'Interest rate cannot be more than 100%.',
  });
}

/** Term text -> whole years. */
export function validateLoanYears(years) {
  return parseWholeNumber(years, {
    label: 'loan term',
    min: LOAN_LIMITS.minYears,
    max: LOAN_LIMITS.maxYears,
    outOfRange: 'Loan term must be between 1 and 50 years.',
  });
}

/**
 * Validates raw form text and calculates.
 * Fields are checked in order (amount, rate, term) and the first failure is returned.
 * @returns {{ok: true, value: ReturnType<typeof calculateLoan>} | {ok: false, field: string, message: string}}
 */
export function calculateLoanFromForm({ amount, rate, years }) {
  const principal = validateLoanAmount(amount);
  if (!principal.ok) return { ok: false, field: 'amount', message: principal.message };

  const ratePart = validateLoanRate(rate);
  if (!ratePart.ok) return { ok: false, field: 'rate', message: ratePart.message };

  const term = validateLoanYears(years);
  if (!term.ok) return { ok: false, field: 'years', message: term.message };

  return {
    ok: true,
    value: calculateLoan({
      principalCents: principal.value,
      annualRatePercent: ratePart.value / 10 ** LOAN_LIMITS.rateDecimals,
      years: term.value,
    }),
  };
}
