import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { calculateLoan, LOAN_LIMITS } from '../lib/loan.js';
import { formatCents } from '../lib/format.js';
import { Field, Adornment } from '../components/Field.jsx';
import { Segmented } from '../components/Segmented.jsx';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { ProportionBar } from '../components/ProportionBar.jsx';
import { Disclosure } from '../components/Disclosure.jsx';
import { InputChecklist, checklistState } from '../components/InputChecklist.jsx';
import { rise, stagger, swap } from '../motion.js';
import { groupedAmount, submitOnEnter } from './formHelpers.js';

const TERM_PICKS = ['5', '10', '15', '20', '25', '30'].map((years) => ({ value: years, label: years, ariaLabel: `${years} years` }));
const LABELS = { amount: 'Loan amount', rate: 'Interest rate', years: 'Loan term' };

const percent = (part, whole) => (whole === 0 ? 0 : (part / whole) * 100);
const formatPercent = (value) => `${value.toFixed(1)}%`;

export function Loan({ form }) {
  const { fields, allValid, hasVisibleError, setValue, visit, submit } = form;
  const refs = { amount: useRef(null), rate: useRef(null), years: useRef(null) };

  // Same order and formula as calculateLoanFromForm; computed live from the validated fields.
  const loan = useMemo(() => {
    if (!allValid) return null;
    const principalCents = fields.amount.result.value;
    const annualRatePercent = fields.rate.result.value / 10 ** LOAN_LIMITS.rateDecimals;
    const years = fields.years.result.value;
    return { principalCents, annualRatePercent, years, ...calculateLoan({ principalCents, annualRatePercent, years }) };
  }, [allValid, fields.amount.result, fields.rate.result, fields.years.result]);

  const onSubmit = (event) => {
    event.preventDefault();
    const firstInvalid = submit();
    if (firstInvalid) refs[firstInvalid].current?.focus();
  };

  const bind = (key) => ({
    id: `loan-${key}`,
    name: key,
    ref: refs[key],
    value: fields[key].value,
    error: fields[key].error,
    onChange: (event) => setValue(key, event.target.value),
    onBlur: () => visit(key),
  });

  return (
    <div className="module-grid">
      <motion.form className="card form-card" noValidate onSubmit={onSubmit} onKeyDown={submitOnEnter} variants={stagger(0.05)} initial="initial" animate="animate">
        <motion.div variants={rise}>
          <Field
            {...bind('amount')}
            label="Loan amount"
            inputMode="decimal"
            placeholder="250,000"
            size="lg"
            hint="$100 to $100,000,000"
            before={<Adornment side="before">$</Adornment>}
            onBlur={() => {
              visit('amount');
              if (fields.amount.result.ok) setValue('amount', groupedAmount(fields.amount.result.value));
            }}
          />
        </motion.div>
        <motion.div variants={rise}>
          <Field {...bind('rate')} label="Annual interest rate" inputMode="decimal" placeholder="6.5" hint="0% to 100%, up to 3 decimal places" after={<Adornment side="after">%</Adornment>} />
        </motion.div>
        <motion.div variants={rise}>
          <Field {...bind('years')} label="Loan term" inputMode="numeric" placeholder="30" hint="Whole years, 1 to 50" after={<Adornment side="after">years</Adornment>}>
            <Segmented
              className="quick-picks"
              options={TERM_PICKS}
              value={fields.years.value.trim()}
              onChange={(value) => setValue('years', value)}
              label="Common loan terms in years"
              layoutId="term-indicator"
              size="sm"
            />
          </Field>
        </motion.div>
        <motion.p className="form-note" variants={rise}>
          Results update as you type. Press <kbd>Enter</kbd> to check every field.
        </motion.p>
      </motion.form>

      <section className="card result-card" aria-label="Loan repayment">
        <AnimatePresence mode="wait" initial={false}>
          {loan ? (
            <motion.div key="result" variants={swap} initial="initial" animate="animate" exit="exit">
              <LoanResult loan={loan} />
            </motion.div>
          ) : (
            <motion.div key="waiting" variants={swap} initial="initial" animate="animate" exit="exit">
              <InputChecklist
                title={hasVisibleError ? 'Check the highlighted field' : 'Your repayment will appear here'}
                description={
                  hasVisibleError
                    ? 'Results come back as soon as every input is valid.'
                    : 'Enter the amount, rate and term. You will see the monthly payment, the total interest and how much of what you repay is interest.'
                }
                items={Object.keys(LABELS).map((key) => ({ key, label: LABELS[key], state: checklistState(fields[key]) }))}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

function LoanResult({ loan }) {
  const { principalCents, annualRatePercent, years, months, monthlyPaymentCents, totalPaidCents, totalInterestCents } = loan;
  const principalShare = percent(principalCents, totalPaidCents);
  const interestShare = 100 - principalShare;
  const repaidPerDollar = (totalPaidCents / principalCents).toFixed(2);
  const monthlyRate = Number((annualRatePercent / 12).toPrecision(4));

  return (
    <motion.div className="result" variants={stagger(0.06)} initial="initial" animate="animate">
      <motion.div className="hero" variants={rise}>
        <p className="eyebrow">Monthly payment</p>
        <AnimatedNumber className="hero-value" value={monthlyPaymentCents} format={formatCents} testId="loan-monthly" />
        <p className="hero-sub num">
          <span data-testid="loan-months">{months}</span> monthly payments over {years} {years === 1 ? 'year' : 'years'} at {annualRatePercent}%
        </p>
      </motion.div>

      <motion.div className="breakdown" variants={rise}>
        <div className="breakdown-head">
          <span>What you repay</span>
          <AnimatedNumber className="breakdown-total" value={totalPaidCents} format={formatCents} testId="loan-total" />
        </div>
        <ProportionBar
          label={`Principal ${formatPercent(principalShare)}, interest ${formatPercent(interestShare)} of the total repaid`}
          segments={[
            { key: 'principal', value: principalCents, className: 'tone-primary' },
            { key: 'interest', value: totalInterestCents, className: 'tone-secondary' },
          ]}
        />
        <dl className="legend">
          <div className="legend-row">
            <dt>
              <span className="swatch tone-primary" /> Amount borrowed
            </dt>
            <dd className="num">
              {formatCents(principalCents)} <span className="legend-share">{formatPercent(principalShare)}</span>
            </dd>
          </div>
          <div className="legend-row">
            <dt>
              <span className="swatch tone-secondary" /> Total interest
            </dt>
            <dd className="num">
              <AnimatedNumber value={totalInterestCents} format={formatCents} testId="loan-interest" countFromZero={false} />{' '}
              <span className="legend-share">{formatPercent(interestShare)}</span>
            </dd>
          </div>
        </dl>
      </motion.div>

      <motion.p className="insight" variants={rise}>
        {totalInterestCents === 0
          ? 'No interest: you repay exactly what you borrow.'
          : `You repay $${repaidPerDollar} for every $1 borrowed.`}
      </motion.p>

      <motion.div variants={rise}>
        <Disclosure title="How this is calculated">
          <ol className="steps num">
            <li>
              <span>Amount borrowed</span> <code>P = {formatCents(principalCents)}</code>
            </li>
            <li>
              <span>Monthly rate</span>{' '}
              <code>
                r = {annualRatePercent}% ÷ 12 {annualRatePercent === 0 ? '= 0%' : `≈ ${monthlyRate}%`}
              </code>
            </li>
            <li>
              <span>Number of payments</span>{' '}
              <code>
                n = {years} × 12 = {months}
              </code>
            </li>
            <li>
              <span>Monthly payment</span>{' '}
              <code>{annualRatePercent === 0 ? 'M = P ÷ n' : 'M = P × r ÷ (1 − (1 + r)^−n)'} = {formatCents(monthlyPaymentCents)}</code>
            </li>
            <li>
              <span>Total repaid</span> <code>M × n = {formatCents(totalPaidCents)}</code>
            </li>
            <li>
              <span>Total interest</span> <code>total − P = {formatCents(totalInterestCents)}</code>
            </li>
          </ol>
          <p className="fine-print">
            Fixed rate, one payment a month, interest compounded monthly. Totals use the unrounded monthly payment, so they can differ from the
            rounded payment × {months} by up to half a cent per payment.
          </p>
        </Disclosure>
      </motion.div>
    </motion.div>
  );
}
