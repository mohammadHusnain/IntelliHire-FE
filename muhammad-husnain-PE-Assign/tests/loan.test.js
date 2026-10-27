import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoanFromForm, validateLoanAmount, validateLoanRate, validateLoanYears } from '../src/lib/loan.js';
import { formatCents } from '../src/lib/format.js';

const shown = (form) => {
  const outcome = calculateLoanFromForm(form);
  assert.equal(outcome.ok, true, outcome.message);
  const loan = outcome.value;
  return {
    monthly: formatCents(loan.monthlyPaymentCents),
    months: loan.months,
    interest: formatCents(loan.totalInterestCents),
    total: formatCents(loan.totalPaidCents),
  };
};

const failure = (form) => {
  const outcome = calculateLoanFromForm(form);
  assert.equal(outcome.ok, false);
  return { field: outcome.field, message: outcome.message };
};

/* S-8 Monthly payment and total cost */

test('S-8 a 30-year mortgage matches the standard amortisation formula', () => {
  assert.deepEqual(shown({ amount: '250,000', rate: '6.5', years: '30' }), {
    monthly: '$1,580.17',
    months: 360,
    interest: '$318,861.22',
    total: '$568,861.22',
  });
});

test('S-8 a 5-year car loan', () => {
  assert.deepEqual(shown({ amount: '20000', rate: '7', years: '5' }), {
    monthly: '$396.02',
    months: 60,
    interest: '$3,761.44',
    total: '$23,761.44',
  });
});

test('S-8 a 0% loan has no interest and divides the amount evenly', () => {
  assert.deepEqual(shown({ amount: '12000', rate: '0', years: '1' }), {
    monthly: '$1,000.00',
    months: 12,
    interest: '$0.00',
    total: '$12,000.00',
  });
  assert.equal(shown({ amount: '100', rate: '0', years: '50' }).interest, '$0.00');
});

test('S-8 total paid always equals amount plus total interest', () => {
  for (const [amount, rate, years] of [['100', '0.001', '1'], ['999999.99', '23.75', '17'], ['5000', '3', '3']]) {
    const loan = calculateLoanFromForm({ amount, rate, years }).value;
    assert.equal(loan.totalPaidCents, Math.round(Number(amount) * 100) + loan.totalInterestCents);
    assert.ok(Math.abs(loan.totalPaidCents - loan.monthlyPaymentCents * loan.months) <= loan.months / 2);
  }
});

test('S-8 boundary values: smallest and largest allowed inputs', () => {
  assert.equal(shown({ amount: '100', rate: '0', years: '1' }).monthly, '$8.33');
  assert.deepEqual(shown({ amount: '100,000,000', rate: '100', years: '50' }), {
    monthly: '$8,333,333.33',
    months: 600,
    interest: '$4,900,000,000.00',
    total: '$5,000,000,000.00',
  });
});

/* S-9 Loan input validation */

test('S-9 empty fields', () => {
  assert.deepEqual(failure({ amount: '', rate: '5', years: '5' }), { field: 'amount', message: 'Enter a loan amount.' });
  assert.deepEqual(failure({ amount: '1000', rate: ' ', years: '5' }), { field: 'rate', message: 'Enter an interest rate.' });
  assert.deepEqual(failure({ amount: '1000', rate: '5', years: '' }), { field: 'years', message: 'Enter a loan term.' });
});

test('S-9 text and malformed numbers', () => {
  assert.deepEqual(failure({ amount: 'abc', rate: '5', years: '5' }), {
    field: 'amount',
    message: 'Loan amount must be a number, for example 1250 or 1,250.50.',
  });
  assert.equal(failure({ amount: '1,23', rate: '5', years: '5' }).field, 'amount');
  assert.equal(failure({ amount: '1000', rate: '5%', years: '5' }).message, 'Interest rate must be a number, for example 15 or 12.5.');
});

test('S-9 negative values', () => {
  assert.equal(failure({ amount: '-5000', rate: '5', years: '5' }).message, 'Loan amount cannot be negative.');
  assert.equal(failure({ amount: '5000', rate: '-1', years: '5' }).message, 'Interest rate cannot be negative.');
});

test('S-9 out-of-range values', () => {
  assert.equal(failure({ amount: '99.99', rate: '5', years: '5' }).message, 'Loan amount must be at least $100.00.');
  assert.equal(failure({ amount: '100000000.01', rate: '5', years: '5' }).message, 'Loan amount cannot be more than $100,000,000.00.');
  assert.equal(failure({ amount: '1' + '0'.repeat(20), rate: '5', years: '5' }).message, 'Loan amount is too large.');
  assert.equal(failure({ amount: '5000', rate: '100.001', years: '5' }).message, 'Interest rate cannot be more than 100%.');
  assert.equal(failure({ amount: '5000', rate: '5', years: '0' }).message, 'Loan term must be between 1 and 50 years.');
  assert.equal(failure({ amount: '5000', rate: '5', years: '51' }).message, 'Loan term must be between 1 and 50 years.');
});

test('S-9 too many decimal places and fractional years', () => {
  assert.equal(failure({ amount: '1000.001', rate: '5', years: '5' }).message, 'Loan amount can have at most 2 decimal places.');
  assert.equal(failure({ amount: '1000', rate: '5.1234', years: '5' }).message, 'Interest rate can have at most 3 decimal places.');
  assert.equal(failure({ amount: '1000', rate: '5', years: '2.5' }).message, 'Loan term must be a whole number.');
});

test('S-9 the first invalid field is reported', () => {
  assert.equal(failure({ amount: '', rate: '', years: '' }).field, 'amount');
});

test('S-9 field validators give the same messages as the whole-form check', () => {
  assert.deepEqual(validateLoanAmount('250,000'), { ok: true, value: 25_000_000 });
  assert.deepEqual(validateLoanRate('6.5'), { ok: true, value: 6500 });
  assert.deepEqual(validateLoanYears('30'), { ok: true, value: 30 });
  assert.equal(validateLoanAmount('').message, failure({ amount: '', rate: '5', years: '5' }).message);
  assert.equal(validateLoanRate('101').message, 'Interest rate cannot be more than 100%.');
  assert.equal(validateLoanYears('2.5').message, 'Loan term must be a whole number.');
});
