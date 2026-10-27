// Strict parsing of form fields into scaled integers.
// Parsing text directly into integers (cents, hundredths of a percent)
// avoids floating-point rounding before any money calculation starts.
//
// Every parser returns {ok: true, value} or {ok: false, message}.

const PLAIN_DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/;
const GROUPED_DECIMAL = /^\d{1,3}(,\d{3})+(\.\d*)?$/;

/**
 * Parses a non-negative decimal string into an integer scaled by 10^decimals.
 * "1,234.5" with decimals 2 -> 123450.
 */
function parseScaled(raw, { label, decimals, allowCommas }) {
  const text = String(raw ?? '').trim();
  if (text === '') return fail(`Enter ${withArticle(label)}.`);
  if (text.startsWith('-')) return fail(`${capitalise(label)} cannot be negative.`);

  const isGrouped = allowCommas && GROUPED_DECIMAL.test(text);
  if (!isGrouped && !PLAIN_DECIMAL.test(text)) {
    const example = allowCommas ? 'for example 1250 or 1,250.50' : 'for example 15 or 12.5';
    return fail(`${capitalise(label)} must be a number, ${example}.`);
  }

  const [whole, fraction = ''] = text.replace(/,/g, '').split('.');
  if (fraction.length > decimals) {
    return fail(
      decimals === 0
        ? `${capitalise(label)} must be a whole number.`
        : `${capitalise(label)} can have at most ${decimals} decimal places.`,
    );
  }
  if (whole.replace(/^0+/, '').length > 12) return fail(`${capitalise(label)} is too large.`);

  const scaled = Number(whole || '0') * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || '0');
  return { ok: true, value: scaled };
}

function checkRange(result, { min, max, tooSmall, tooLarge }) {
  if (!result.ok) return result;
  if (result.value < min) return fail(tooSmall);
  if (result.value > max) return fail(tooLarge);
  return result;
}

/** Money in dollars -> integer cents. */
export function parseMoney(raw, { label, minCents, maxCents, tooSmall, tooLarge }) {
  return checkRange(parseScaled(raw, { label, decimals: 2, allowCommas: true }), {
    min: minCents,
    max: maxCents,
    tooSmall,
    tooLarge,
  });
}

/** Percentage -> integer scaled by 10^decimals (e.g. 12.5% with 2 decimals -> 1250). */
export function parsePercent(raw, { label, decimals, max, tooLarge }) {
  return checkRange(parseScaled(raw, { label, decimals, allowCommas: false }), {
    min: 0,
    max: max * 10 ** decimals,
    tooSmall: '',
    tooLarge,
  });
}

/** Whole number within [min, max]. */
export function parseWholeNumber(raw, { label, min, max, outOfRange }) {
  return checkRange(parseScaled(raw, { label, decimals: 0, allowCommas: false }), {
    min,
    max,
    tooSmall: outOfRange,
    tooLarge: outOfRange,
  });
}

function fail(message) {
  return { ok: false, message };
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function withArticle(label) {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
