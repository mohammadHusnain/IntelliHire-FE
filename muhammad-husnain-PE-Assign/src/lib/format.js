// Display formatting for calculator results and money amounts.

const SIGNIFICANT_DIGITS = 12;

/**
 * Formats a calculator result for display.
 * Rounds to 12 significant digits so binary floating-point noise
 * (0.1 + 0.2 = 0.30000000000000004) never reaches the user.
 * Magnitudes of 1e12 and above use scientific notation, because fixed
 * notation would show rounded digits as if they were exact
 * (123456789012345 would appear as 123456789012000). Magnitudes below
 * 1e-6 also use scientific notation.
 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError('Cannot format a non-finite number');
  }
  if (value === 0) return '0'; // also turns -0 into 0
  const abs = Math.abs(value);
  if (abs >= 1e12 || abs < 1e-6) {
    const [mantissa, exponent] = value.toExponential(SIGNIFICANT_DIGITS - 1).split('e');
    return `${stripTrailingZeros(mantissa)}e${exponent}`;
  }
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}

function stripTrailingZeros(text) {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats an integer number of cents as US dollars, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents) {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('Cents must be a safe integer');
  }
  return moneyFormatter.format(cents / 100);
}
