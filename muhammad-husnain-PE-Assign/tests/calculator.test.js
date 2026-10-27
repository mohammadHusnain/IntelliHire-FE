// Basic and Scientific calculator tests, driven through the same key
// sequences the UI sends. Test names reference the user story they verify.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduce, initialState } from '../src/lib/calculatorState.js';
import { evaluate, CalcError } from '../src/lib/expression.js';
import { formatNumber } from '../src/lib/format.js';

/** Presses keys in order. '=' evaluates, 'AC' clears, '⌫' deletes, 'DEG/RAD' toggles. */
function press(keys, state = initialState) {
  for (const key of keys) {
    if (key === '=') state = reduce(state, { type: 'evaluate' });
    else if (key === 'AC') state = reduce(state, { type: 'clear' });
    else if (key === '⌫') state = reduce(state, { type: 'backspace' });
    else if (key === 'DEG/RAD') state = reduce(state, { type: 'toggleAngle' });
    else state = reduce(state, { type: 'input', text: key });
  }
  return state;
}

const result = (keys, state) => {
  const s = press(keys, state);
  assert.equal(s.status, 'result', `expected a result, got error "${s.message}"`);
  return s.resultText;
};

const errorOf = (keys, state) => {
  const s = press(keys, state);
  assert.equal(s.status, 'error', `expected an error, got "${s.resultText}"`);
  return s.message;
};

/* S-1 Basic arithmetic */

test('S-1 adds, subtracts, multiplies and divides', () => {
  assert.equal(result(['1', '2', '+', '7', '=']), '19');
  assert.equal(result(['5', '-', '8', '=']), '-3');
  assert.equal(result(['6', '×', '7', '=']), '42');
  assert.equal(result(['7', '÷', '2', '=']), '3.5');
});

test('S-1 multiplication and division happen before addition and subtraction', () => {
  assert.equal(result(['2', '+', '3', '×', '4', '=']), '14');
  assert.equal(result(['(', '2', '+', '3', ')', '×', '4', '=']), '20');
});

test('S-1 decimal results are free of floating-point noise', () => {
  assert.equal(result(['0', '.', '1', '+', '0', '.', '2', '=']), '0.3');
  assert.equal(result(['1', '÷', '3', '=']), '0.333333333333');
});

test('S-1 percent divides the number before it by 100', () => {
  assert.equal(result(['5', '0', '%', '=']), '0.5');
  assert.equal(result(['2', '0', '0', '×', '1', '5', '%', '=']), '30');
});

test('S-1 a negative number can be entered with a leading minus', () => {
  assert.equal(result(['-', '5', '×', '2', '=']), '-10');
});

test('S-1 very large and very small results use scientific notation', () => {
  assert.equal(result([...'9999999999', '×', ...'9999999999', '=']), '9.999999998e+19');
  assert.equal(result(['1', '÷', ...'10000000', '=']), '1e-7');
  // 12 significant digits are shown; beyond that, fixed notation would fake precision.
  assert.equal(result([...'123456789012', '=']), '123456789012');
  assert.equal(result([...'123456789012345', '=']), '1.23456789012e+14');
  assert.equal(result([...'0', '.', '0', '0', '0', '0', '0', '1', '=']), '0.000001');
});

/* S-2 Clear errors and recovery */

test('S-2 division by zero shows a message and no result', () => {
  const s = press(['8', '÷', '0', '=']);
  assert.equal(s.status, 'error');
  assert.equal(s.message, 'Cannot divide by zero');
  assert.equal(s.resultText, '');
  assert.equal(errorOf(['8', '÷', '(', '2', '-', '2', ')', '=']), 'Cannot divide by zero');
  assert.equal(errorOf(['0', '÷', '0', '=']), 'Cannot divide by zero');
});

test('S-2 malformed expressions show specific messages', () => {
  assert.equal(errorOf(['2', '+', '=']), 'The expression is incomplete');
  assert.equal(errorOf(['×', '3', '=']), 'Unexpected "×"');
  assert.equal(errorOf(['(', '2', '+', '3', '=']), 'Missing closing bracket ")"');
  assert.equal(errorOf(['2', '+', '3', ')', '=']), 'There is a ")" without a matching "("');
  assert.equal(errorOf(['1', '.', '2', '.', '3', '=']), '"1.2.3" is not a valid number');
  assert.equal(errorOf(['(', ')', '=']), 'Empty brackets "()"');
});

test('S-2 a result too large to calculate is reported, not shown as Infinity', () => {
  assert.equal(errorOf(['1', '0', '^', '4', '0', '0', '=']), 'The result is too large to calculate');
});

test('S-2 after an error the expression stays and can be corrected', () => {
  let s = press(['8', '÷', '0', '=']);
  assert.equal(s.expression, '8÷0');
  s = press(['⌫', '4', '='], s);
  assert.equal(s.status, 'result');
  assert.equal(s.resultText, '2');
});

test('S-2 typing after an error clears the message', () => {
  const s = press(['8', '÷', '0', '=', '1']);
  assert.equal(s.status, 'editing');
  assert.equal(s.message, '');
  assert.equal(s.expression, '8÷01');
});

test('S-2 AC after an error clears everything', () => {
  const s = press(['8', '÷', '0', '=', 'AC']);
  assert.equal(s.status, 'editing');
  assert.equal(s.expression, '');
  assert.equal(s.message, '');
});

test('S-2 pressing = with nothing entered does nothing', () => {
  assert.deepEqual(press(['=']), initialState);
});

test('S-2 expressions are limited to 200 characters', () => {
  const s = press(Array(201).fill('1'));
  assert.equal(s.status, 'error');
  assert.equal(s.message, 'The expression is too long (maximum 200 characters)');
  assert.equal(s.expression.length, 200);
});

test('S-2 an error does not change the previous answer', () => {
  const s = press(['5', '=', '1', '÷', '0', '=']);
  assert.equal(s.ans, 5);
});

/* S-3 Continue from a result */

test('S-3 an operator after a result continues from that result', () => {
  const s = press(['6', '×', '7', '=', '+', '8']);
  assert.equal(s.expression, 'Ans+8');
  assert.equal(result(['='], s), '50');
});

test('S-3 a digit after a result starts a new calculation', () => {
  const s = press(['6', '×', '7', '=', '3']);
  assert.equal(s.expression, '3');
  assert.equal(result(['+', '1', '='], s), '4');
});

test('S-3 pressing = again after a result keeps the same result', () => {
  const s = press(['2', '+', '2', '=']);
  assert.equal(press(['='], s), s);
});

test('S-3 Backspace after a result clears the display', () => {
  const s = press(['2', '+', '2', '=', '⌫']);
  assert.equal(s.expression, '');
  assert.equal(s.status, 'editing');
  assert.equal(s.ans, 4);
});

test('S-3 Ans keeps full precision between steps', () => {
  assert.equal(result(['1', '÷', '3', '=', '×', '3', '=']), '1');
});

/* S-5 Scientific functions */

test('S-5 powers, roots, factorial and constants', () => {
  assert.equal(result(['2', '^', '1', '0', '=']), '1024');
  assert.equal(result(['3', '^2', '=']), '9');
  assert.equal(result(['√(', '1', '4', '4', ')', '=']), '12');
  assert.equal(result(['5', '!', '=']), '120');
  assert.equal(result(['0', '!', '=']), '1');
  assert.equal(result(['π', '=']), '3.14159265359');
  assert.equal(result(['e', '=']), '2.71828182846');
  assert.equal(result(['l', 'o', 'g', '(', '1', '0', '0', '0', ')', '=']), '3');
  assert.equal(result(['ln(', 'e', ')', '=']), '1');
});

test('S-5 precedence: powers are right-associative and bind tighter than minus', () => {
  assert.equal(result(['2', '^', '3', '^', '2', '=']), '512');
  assert.equal(result(['-', '2', '^', '2', '=']), '-4');
  assert.equal(result(['2', '^', '-', '1', '=']), '0.5');
});

test('S-5 implicit multiplication next to brackets, constants and functions', () => {
  assert.equal(result(['2', 'π', '=']), '6.28318530718');
  assert.equal(result(['2', '(', '3', '+', '4', ')', '=']), '14');
  assert.equal(result(['2', 'sin(', '3', '0', ')', '=']), '1');
});

test('S-5 x² after a result squares the result', () => {
  const s = press(['1', '2', '=', '^2']);
  assert.equal(s.expression, 'Ans^2');
  assert.equal(result(['='], s), '144');
});

test('S-5 Backspace removes a whole function name', () => {
  const s = press(['2', '+', 'sin(', '⌫']);
  assert.equal(s.expression, '2+');
});

/* S-6 Degrees and radians */

test('S-6 the calculator starts in degrees', () => {
  assert.equal(initialState.angleMode, 'deg');
  assert.equal(result(['sin(', '3', '0', ')', '=']), '0.5');
  assert.equal(result(['cos(', '6', '0', ')', '=']), '0.5');
  assert.equal(result(['tan(', '4', '5', ')', '=']), '1');
  assert.equal(result(['sin(', '1', '8', '0', ')', '=']), '0');
});

test('S-6 radians mode uses radians for input and output', () => {
  const rad = press(['DEG/RAD']);
  assert.equal(rad.angleMode, 'rad');
  assert.equal(result(['sin(', 'π', '÷', '2', ')', '='], rad), '1');
  assert.equal(result(['cos(', 'π', ')', '='], rad), '-1');
  assert.equal(result(['asin(', '1', ')', '='], rad), '1.57079632679');
});

test('S-6 inverse trig returns degrees in degrees mode', () => {
  assert.equal(result(['asin(', '0', '.', '5', ')', '=']), '30');
  assert.equal(result(['atan(', '1', ')', '=']), '45');
});

test('S-6 switching the angle unit keeps the expression and result', () => {
  const s = press(['sin(', '3', '0', ')', '=', 'DEG/RAD']);
  assert.equal(s.status, 'result');
  assert.equal(s.resultText, '0.5');
  assert.equal(s.angleMode, 'rad');
});

/* S-7 Domain errors */

test('S-7 out-of-domain inputs give a specific message', () => {
  assert.equal(errorOf(['√(', '-', '4', ')', '=']), 'Square root of a negative number is not a real number');
  assert.equal(errorOf(['ln(', '0', ')', '=']), 'Logarithm is only defined for numbers greater than 0');
  assert.equal(errorOf(['log(', '-', '1', ')', '=']), 'Logarithm is only defined for numbers greater than 0');
  assert.equal(errorOf(['asin(', '2', ')', '=']), 'asin needs a value between -1 and 1');
  assert.equal(errorOf(['tan(', '9', '0', ')', '=']), 'tan is undefined at 90° + k·180°');
  assert.equal(errorOf(['tan(', '2', '7', '0', ')', '=']), 'tan is undefined at 90° + k·180°');
  assert.equal(errorOf(['tan(', 'π', '÷', '2', ')', '='], press(['DEG/RAD'])), 'tan is undefined at π/2 + kπ');
  assert.equal(errorOf(['3', '.', '5', '!', '=']), 'Factorial is only defined for whole numbers 0 or greater');
  assert.equal(errorOf(['(', '-', '3', ')', '!', '=']), 'Factorial is only defined for whole numbers 0 or greater');
  assert.equal(errorOf(['1', '7', '1', '!', '=']), 'The result is too large to calculate');
  assert.equal(errorOf(['(', '-', '8', ')', '^', '0', '.', '5', '=']), 'The result is not a real number');
  assert.equal(errorOf(['0', '^', '-', '1', '=']), 'Cannot divide by zero');
});

test('S-7 a function without brackets explains how to use it', () => {
  assert.equal(errorOf(['s', 'i', 'n', '3', '0', '=']), 'sin needs brackets, for example sin(30)');
});

test('S-7 170! is the largest factorial', () => {
  assert.equal(result(['1', '7', '0', '!', '=']), '7.25741561531e+306');
});

/* Engine-level guarantees */

test('evaluate never returns a non-finite number and only throws CalcError', () => {
  const inputs = ['', '   ', '2++', '))', '((', '1/0', '2^9999', 'foo(2)', '#', '9!!!', '%', '!', '^', '.', 'Ans'];
  for (const input of inputs) {
    try {
      const value = evaluate(input);
      assert.ok(Number.isFinite(value), `${input} gave ${value}`);
    } catch (error) {
      assert.ok(error instanceof CalcError, `${input} threw ${error}`);
    }
  }
});

test('formatNumber turns -0 into 0', () => {
  assert.equal(formatNumber(-0), '0');
});
