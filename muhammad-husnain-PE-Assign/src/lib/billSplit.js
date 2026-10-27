// Tip and bill splitting in integer cents.
//
// tip   = bill × tip% rounded half-up to the cent (integer arithmetic only)
// total = bill + tip
// Shares: everyone pays floor(total / people); the leftover cents
// (total mod people) are given one each to that many people. The shares
// therefore always add up to the total exactly, and no two people's
// shares differ by more than one cent.

import { parseMoney, parsePercent, parseWholeNumber } from './parseInput.js';

export const SPLIT_LIMITS = Object.freeze({
  minCents: 1,                // $0.01
  maxCents: 1_000_000_00,     // $1,000,000.00
  maxTipPercent: 100,
  tipDecimals: 2,
  minPeople: 1,
  maxPeople: 100,
});

/**
 * @param {{billCents: number, tipHundredths: number, people: number}} input
 *   tipHundredths: tip percentage × 100, e.g. 12.5% -> 1250
 */
export function splitBill({ billCents, tipHundredths, people }) {
  // bill × (tipHundredths / 10000), rounded half-up, without floats.
  const tipCents = Math.floor((billCents * tipHundredths + 5000) / 10000);
  const totalCents = billCents + tipCents;
  const baseShareCents = Math.floor(totalCents / people);
  const peoplePayingExtraCent = totalCents % people;

  const shares = [];
  if (peoplePayingExtraCent > 0) shares.push({ people: peoplePayingExtraCent, amountCents: baseShareCents + 1 });
  if (people - peoplePayingExtraCent > 0) shares.push({ people: people - peoplePayingExtraCent, amountCents: baseShareCents });

  return { tipCents, totalCents, people, shares };
}

// Field validators. Each returns {ok: true, value} or {ok: false, message}.
// Exported separately so the UI can validate a field as soon as it is edited.

/** Bill text -> integer cents. */
export function validateBill(bill) {
  return parseMoney(bill, {
    label: 'bill amount',
    minCents: SPLIT_LIMITS.minCents,
    maxCents: SPLIT_LIMITS.maxCents,
    tooSmall: 'Bill amount must be more than $0.00.',
    tooLarge: 'Bill amount cannot be more than $1,000,000.00.',
  });
}

/** Tip text -> hundredths of a percent (12.5% -> 1250). */
export function validateTip(tip) {
  return parsePercent(tip, {
    label: 'tip percentage',
    decimals: SPLIT_LIMITS.tipDecimals,
    max: SPLIT_LIMITS.maxTipPercent,
    tooLarge: 'Tip cannot be more than 100%.',
  });
}

/** People text -> whole number of people. */
export function validatePeople(people) {
  return parseWholeNumber(people, {
    label: 'number of people',
    min: SPLIT_LIMITS.minPeople,
    max: SPLIT_LIMITS.maxPeople,
    outOfRange: 'Number of people must be between 1 and 100.',
  });
}

/**
 * Validates raw form text and calculates.
 * Fields are checked in order (bill, tip, people) and the first failure is returned.
 * @returns {{ok: true, value: ReturnType<typeof splitBill>} | {ok: false, field: string, message: string}}
 */
export function splitBillFromForm({ bill, tip, people }) {
  const billPart = validateBill(bill);
  if (!billPart.ok) return { ok: false, field: 'bill', message: billPart.message };

  const tipPart = validateTip(tip);
  if (!tipPart.ok) return { ok: false, field: 'tip', message: tipPart.message };

  const peoplePart = validatePeople(people);
  if (!peoplePart.ok) return { ok: false, field: 'people', message: peoplePart.message };

  return {
    ok: true,
    value: splitBill({ billCents: billPart.value, tipHundredths: tipPart.value, people: peoplePart.value }),
  };
}
