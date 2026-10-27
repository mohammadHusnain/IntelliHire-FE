// Keypad state machine shared by the Basic and Scientific calculators.
// Pure: reduce(state, action) returns a new state and never throws,
// so the UI only renders whatever state it is given.

import { evaluate, CalcError, MAX_EXPRESSION_LENGTH } from './expression.js';
import { formatNumber } from './format.js';

// Keys that continue from the previous result instead of replacing it.
const CONTINUING_OPERATORS = new Set(['+', '-', '×', '÷', '^', '%', '!']);

// Multi-character tokens that Backspace removes as one unit.
const BACKSPACE_UNITS = /(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|Ans)$/;

export const initialState = Object.freeze({
  expression: '',      // what the user is typing
  status: 'editing',   // 'editing' | 'result' | 'error'
  resultText: '',      // formatted result when status === 'result'
  lastExpression: '',  // expression that produced the result
  message: '',         // error message when status === 'error'
  ans: 0,              // value of the last successful result
  angleMode: 'deg',    // 'deg' | 'rad'
});

/**
 * @param {typeof initialState} state
 * @param {{type: 'input', text: string} | {type: 'backspace'} | {type: 'clear'}
 *   | {type: 'evaluate'} | {type: 'toggleAngle'}} action
 */
export function reduce(state, action) {
  switch (action.type) {
    case 'input':
      return input(state, action.text);
    case 'backspace':
      return backspace(state);
    case 'clear':
      return { ...initialState, ans: state.ans, angleMode: state.angleMode };
    case 'evaluate':
      return calculate(state);
    case 'toggleAngle':
      return { ...state, angleMode: state.angleMode === 'deg' ? 'rad' : 'deg' };
    default:
      return state;
  }
}

function input(state, text) {
  let expression;
  if (state.status === 'result') {
    // After a result: an operator (including "^2") continues from it,
    // anything else starts a new expression.
    expression = CONTINUING_OPERATORS.has(text[0]) ? `Ans${text}` : text;
  } else {
    // While editing, or after an error: keep the expression so it can be fixed.
    expression = state.expression + text;
  }

  if (expression.length > MAX_EXPRESSION_LENGTH) {
    return {
      ...state,
      status: 'error',
      message: `The expression is too long (maximum ${MAX_EXPRESSION_LENGTH} characters)`,
    };
  }
  return { ...state, expression, status: 'editing', message: '', resultText: '' };
}

function backspace(state) {
  if (state.status === 'result') {
    return { ...initialState, ans: state.ans, angleMode: state.angleMode };
  }
  const unit = state.expression.match(BACKSPACE_UNITS);
  const cut = unit ? unit[0].length : 1;
  return {
    ...state,
    expression: state.expression.slice(0, -cut),
    status: 'editing',
    message: '',
  };
}

function calculate(state) {
  if (state.status === 'result' || state.expression.trim() === '') return state;
  try {
    const value = evaluate(state.expression, { angleMode: state.angleMode, ans: state.ans });
    return {
      ...state,
      status: 'result',
      resultText: formatNumber(value),
      lastExpression: state.expression,
      message: '',
      ans: value,
    };
  } catch (error) {
    if (!(error instanceof CalcError)) throw error;
    return { ...state, status: 'error', message: error.message };
  }
}
