// Expression engine for the Basic and Scientific calculators.
//
// Pipeline: text -> tokenize() -> Parser (recursive descent) -> number.
// The parser evaluates while it parses, so there is no separate AST step.
//
// Grammar, lowest to highest precedence:
//   expression := term (('+' | '-') term)*
//   term       := unary (('×' | '÷') unary | <implicit ×> unary)*
//   unary      := ('-' | '+') unary | power
//   power      := postfix ('^' unary)?          right-associative: 2^3^2 = 2^9
//   postfix    := primary ('!' | '%')*
//   primary    := number | constant | function '(' expression ')' | '(' expression ')'
//
// Consequences worth knowing: -2^2 = -4, 2^-1 = 0.5, 2π = 2×π, 50% = 0.5.
// Every invalid input raises CalcError with a message meant for the user.

export class CalcError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalcError';
  }
}

export const MAX_EXPRESSION_LENGTH = 200;

// Below this magnitude a trig result is treated as exactly 0, so
// sin(180°) shows 0 instead of 1.22e-16.
const TRIG_EPSILON = 1e-12;

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt']);
const CONSTANTS = new Set(['pi', 'e', 'Ans']);

const SYMBOL_ALIASES = {
  '*': '×',
  '/': '÷',
  '−': '-',
  '√': 'sqrt',
  'π': 'pi',
};

const OPERATORS = new Set(['+', '-', '×', '÷', '^', '%', '!']);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      const text = source.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) {
        throw new CalcError(`"${text}" is not a valid number`);
      }
      tokens.push({ type: 'number', value: Number(text) });
      i = j;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z]/.test(source[j])) j += 1;
      const word = source.slice(i, j);
      if (FUNCTIONS.has(word)) tokens.push({ type: 'function', value: word });
      else if (CONSTANTS.has(word)) tokens.push({ type: 'constant', value: word });
      else throw new CalcError(`Unknown name "${word}"`);
      i = j;
      continue;
    }

    const symbol = SYMBOL_ALIASES[ch] ?? ch;
    if (symbol === 'sqrt') tokens.push({ type: 'function', value: 'sqrt' });
    else if (symbol === 'pi') tokens.push({ type: 'constant', value: 'pi' });
    else if (OPERATORS.has(symbol)) tokens.push({ type: 'operator', value: symbol });
    else if (symbol === '(') tokens.push({ type: 'lparen' });
    else if (symbol === ')') tokens.push({ type: 'rparen' });
    else throw new CalcError(`"${ch}" is not allowed in an expression`);
    i += 1;
  }
  return tokens;
}

function ensureFinite(value) {
  if (Number.isNaN(value)) throw new CalcError('The result is not a real number');
  if (!Number.isFinite(value)) throw new CalcError('The result is too large to calculate');
  return value;
}

function snapTiny(value) {
  return Math.abs(value) < TRIG_EPSILON ? 0 : value;
}

function nearestInteger(value) {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-9 ? rounded : null;
}

function factorial(value) {
  const n = nearestInteger(value);
  if (n === null || n < 0) {
    throw new CalcError('Factorial is only defined for whole numbers 0 or greater');
  }
  if (n > 170) throw new CalcError('The result is too large to calculate');
  let result = 1;
  for (let k = 2; k <= n; k += 1) result *= k;
  return result;
}

function applyFunction(name, x, angleMode) {
  const toRadians = (v) => (angleMode === 'deg' ? (v * Math.PI) / 180 : v);
  const fromRadians = (v) => (angleMode === 'deg' ? (v * 180) / Math.PI : v);

  switch (name) {
    case 'sin':
      return snapTiny(Math.sin(toRadians(x)));
    case 'cos':
      return snapTiny(Math.cos(toRadians(x)));
    case 'tan': {
      const undefinedAt =
        angleMode === 'deg'
          ? ((x % 180) + 180) % 180 === 90
          : Math.abs(Math.cos(x)) < TRIG_EPSILON;
      if (undefinedAt) throw new CalcError(`tan is undefined at ${angleMode === 'deg' ? '90° + k·180°' : 'π/2 + kπ'}`);
      return snapTiny(Math.tan(toRadians(x)));
    }
    case 'asin':
    case 'acos':
      if (x < -1 || x > 1) throw new CalcError(`${name} needs a value between -1 and 1`);
      return fromRadians(name === 'asin' ? Math.asin(x) : Math.acos(x));
    case 'atan':
      return fromRadians(Math.atan(x));
    case 'ln':
    case 'log':
      if (x <= 0) throw new CalcError('Logarithm is only defined for numbers greater than 0');
      return name === 'ln' ? Math.log(x) : Math.log10(x);
    case 'sqrt':
      if (x < 0) throw new CalcError('Square root of a negative number is not a real number');
      return Math.sqrt(x);
    default:
      throw new CalcError(`Unknown function "${name}"`);
  }
}

function describe(token) {
  if (!token) return 'end of expression';
  if (token.type === 'number') return String(token.value);
  if (token.type === 'lparen') return '(';
  if (token.type === 'rparen') return ')';
  if (token.value === 'sqrt') return '√';
  if (token.value === 'pi') return 'π';
  return token.value;
}

class Parser {
  constructor(tokens, { angleMode, ans }) {
    this.tokens = tokens;
    this.pos = 0;
    this.angleMode = angleMode;
    this.ans = ans;
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    const token = this.tokens[this.pos];
    this.pos += 1;
    return token;
  }

  isOperator(value) {
    const token = this.peek();
    return token?.type === 'operator' && token.value === value;
  }

  parse() {
    const value = this.expression();
    const leftover = this.peek();
    if (leftover) {
      if (leftover.type === 'rparen') throw new CalcError('There is a ")" without a matching "("');
      throw new CalcError(`Unexpected "${describe(leftover)}"`);
    }
    return ensureFinite(value);
  }

  expression() {
    let value = this.term();
    while (this.isOperator('+') || this.isOperator('-')) {
      const op = this.next().value;
      const right = this.term();
      value = ensureFinite(op === '+' ? value + right : value - right);
    }
    return value;
  }

  term() {
    let value = this.unary();
    for (;;) {
      const token = this.peek();
      if (this.isOperator('×') || this.isOperator('÷')) {
        const op = this.next().value;
        const right = this.unary();
        if (op === '÷' && right === 0) throw new CalcError('Cannot divide by zero');
        value = ensureFinite(op === '×' ? value * right : value / right);
      } else if (token && (token.type === 'lparen' || token.type === 'function' || token.type === 'constant')) {
        // Implicit multiplication: 2π, 3(4+1), 2sin(30), (1+1)(2)
        value = ensureFinite(value * this.unary());
      } else {
        return value;
      }
    }
  }

  unary() {
    if (this.isOperator('-')) {
      this.next();
      return -this.unary();
    }
    if (this.isOperator('+')) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  power() {
    const base = this.postfix();
    if (!this.isOperator('^')) return base;
    this.next();
    const exponent = this.unary();
    if (base === 0 && exponent < 0) throw new CalcError('Cannot divide by zero');
    return ensureFinite(Math.pow(base, exponent));
  }

  postfix() {
    let value = this.primary();
    for (;;) {
      if (this.isOperator('!')) {
        this.next();
        value = factorial(value);
      } else if (this.isOperator('%')) {
        this.next();
        value /= 100;
      } else {
        return value;
      }
    }
  }

  primary() {
    const token = this.next();
    if (!token) throw new CalcError('The expression is incomplete');

    switch (token.type) {
      case 'number':
        return token.value;
      case 'constant':
        if (token.value === 'pi') return Math.PI;
        if (token.value === 'e') return Math.E;
        return this.ans;
      case 'function': {
        if (this.peek()?.type !== 'lparen') {
          const example = { sin: '30', cos: '60', tan: '45', asin: '0.5', acos: '0.5', atan: '1', ln: '10', log: '100', sqrt: '9' }[token.value];
          throw new CalcError(`${describe(token)} needs brackets, for example ${describe(token)}(${example})`);
        }
        const argument = this.group();
        return ensureFinite(applyFunction(token.value, argument, this.angleMode));
      }
      case 'lparen':
        this.pos -= 1;
        return this.group();
      case 'rparen':
        throw new CalcError('There is a ")" without a matching "("');
      default:
        throw new CalcError(`Unexpected "${describe(token)}"`);
    }
  }

  group() {
    this.next(); // consume '('
    if (this.peek()?.type === 'rparen') throw new CalcError('Empty brackets "()"');
    const value = this.expression();
    const closing = this.next();
    if (!closing) throw new CalcError('Missing closing bracket ")"');
    if (closing.type !== 'rparen') throw new CalcError(`Unexpected "${describe(closing)}"`);
    return value;
  }
}

/**
 * Evaluates a calculator expression.
 * @param {string} source  e.g. "2+3×4", "sin(30)", "√(2)^2"
 * @param {{angleMode?: 'deg'|'rad', ans?: number}} options
 * @returns {number} a finite number
 * @throws {CalcError} with a user-facing message for any invalid input
 */
export function evaluate(source, { angleMode = 'deg', ans = 0 } = {}) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new CalcError('Enter an expression');
  }
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new CalcError(`The expression is too long (maximum ${MAX_EXPRESSION_LENGTH} characters)`);
  }
  const tokens = tokenize(source);
  return new Parser(tokens, { angleMode, ans }).parse();
}
