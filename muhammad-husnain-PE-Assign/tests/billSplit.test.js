import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBillFromForm, splitBill, validateBill, validateTip, validatePeople } from '../src/lib/billSplit.js';
import { formatCents } from '../src/lib/format.js';

const shown = (form) => {
  const outcome = splitBillFromForm(form);
  assert.equal(outcome.ok, true, outcome.message);
  const split = outcome.value;
  return {
    tip: formatCents(split.tipCents),
    total: formatCents(split.totalCents),
    shares: split.shares.map((s) => `${s.people} × ${formatCents(s.amountCents)}`),
  };
};

const failure = (form) => {
  const outcome = splitBillFromForm(form);
  assert.equal(outcome.ok, false);
  return { field: outcome.field, message: outcome.message };
};

/* S-10 Tip, total and fair shares */

test('S-10 an even split', () => {
  assert.deepEqual(shown({ bill: '80', tip: '20', people: '4' }), {
    tip: '$16.00',
    total: '$96.00',
    shares: ['4 × $24.00'],
  });
});

test('S-10 an uneven split gives the leftover cents to some people', () => {
  assert.deepEqual(shown({ bill: '100', tip: '15', people: '3' }), {
    tip: '$15.00',
    total: '$115.00',
    shares: ['1 × $38.34', '2 × $38.33'],
  });
});

test('S-10 the tip is rounded half-up to the cent', () => {
  assert.equal(shown({ bill: '10.05', tip: '15', people: '1' }).tip, '$1.51'); // 1.5075
  assert.equal(shown({ bill: '84.60', tip: '18', people: '4' }).tip, '$15.23'); // 15.228
  assert.equal(shown({ bill: '0.10', tip: '5', people: '1' }).tip, '$0.01'); // 0.005
});

test('S-10 a 0% tip and a single person', () => {
  assert.deepEqual(shown({ bill: '42.50', tip: '0', people: '1' }), {
    tip: '$0.00',
    total: '$42.50',
    shares: ['1 × $42.50'],
  });
});

test('S-10 shares always add up to the total exactly', () => {
  for (let billCents = 1; billCents <= 5000; billCents += 37) {
    for (const people of [1, 2, 3, 7, 13, 100]) {
      for (const tipHundredths of [0, 1250, 1500, 1800, 2000, 10000]) {
        const split = splitBill({ billCents, tipHundredths, people });
        const sum = split.shares.reduce((acc, s) => acc + s.people * s.amountCents, 0);
        const count = split.shares.reduce((acc, s) => acc + s.people, 0);
        assert.equal(sum, split.totalCents);
        assert.equal(count, people);
      }
    }
  }
});

test('S-10 boundary values: smallest and largest bills', () => {
  assert.deepEqual(shown({ bill: '0.01', tip: '0', people: '3' }), {
    tip: '$0.00',
    total: '$0.01',
    shares: ['1 × $0.01', '2 × $0.00'],
  });
  assert.deepEqual(shown({ bill: '1,000,000', tip: '100', people: '100' }), {
    tip: '$1,000,000.00',
    total: '$2,000,000.00',
    shares: ['100 × $20,000.00'],
  });
});

/* S-11 Bill split input validation */

test('S-11 empty and non-numeric input', () => {
  assert.deepEqual(failure({ bill: '', tip: '15', people: '2' }), { field: 'bill', message: 'Enter a bill amount.' });
  assert.deepEqual(failure({ bill: '20', tip: '', people: '2' }), { field: 'tip', message: 'Enter a tip percentage.' });
  assert.deepEqual(failure({ bill: '20', tip: '15', people: '' }), { field: 'people', message: 'Enter a number of people.' });
  assert.equal(failure({ bill: 'twenty', tip: '15', people: '2' }).message, 'Bill amount must be a number, for example 1250 or 1,250.50.');
});

test('S-11 zero, negative and out-of-range values', () => {
  assert.equal(failure({ bill: '0', tip: '15', people: '2' }).message, 'Bill amount must be more than $0.00.');
  assert.equal(failure({ bill: '-20', tip: '15', people: '2' }).message, 'Bill amount cannot be negative.');
  assert.equal(failure({ bill: '1000000.01', tip: '15', people: '2' }).message, 'Bill amount cannot be more than $1,000,000.00.');
  assert.equal(failure({ bill: '20', tip: '-5', people: '2' }).message, 'Tip percentage cannot be negative.');
  assert.equal(failure({ bill: '20', tip: '101', people: '2' }).message, 'Tip cannot be more than 100%.');
  assert.equal(failure({ bill: '20', tip: '15', people: '0' }).message, 'Number of people must be between 1 and 100.');
  assert.equal(failure({ bill: '20', tip: '15', people: '101' }).message, 'Number of people must be between 1 and 100.');
});

test('S-11 too many decimals and fractional people', () => {
  assert.equal(failure({ bill: '20.999', tip: '15', people: '2' }).message, 'Bill amount can have at most 2 decimal places.');
  assert.equal(failure({ bill: '20', tip: '12.345', people: '2' }).message, 'Tip percentage can have at most 2 decimal places.');
  assert.equal(failure({ bill: '20', tip: '15', people: '2.5' }).message, 'Number of people must be a whole number.');
});

test('S-11 field validators give the same messages as the whole-form check', () => {
  assert.deepEqual(validateBill('1,234.50'), { ok: true, value: 123450 });
  assert.deepEqual(validateTip('12.5'), { ok: true, value: 1250 });
  assert.deepEqual(validatePeople('4'), { ok: true, value: 4 });
  assert.equal(validateBill('0').message, failure({ bill: '0', tip: '15', people: '2' }).message);
  assert.equal(validateTip('-5').message, 'Tip percentage cannot be negative.');
  assert.equal(validatePeople('101').message, 'Number of people must be between 1 and 100.');
});
