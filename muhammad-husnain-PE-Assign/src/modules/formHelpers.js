// Small helpers shared by the Loan and Split bill forms.

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Tidies a valid money field after the user leaves it: 250000 -> "250,000",
 * 1234.5 -> "1,234.50". The parser accepts this format, so the value is unchanged.
 */
export function groupedAmount(amountCents) {
  return amountCents % 100 === 0 ? whole.format(amountCents / 100) : cents.format(amountCents / 100);
}

/** Enter in any field checks the whole form (there is no submit button: results are live). */
export function submitOnEnter(event) {
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}
