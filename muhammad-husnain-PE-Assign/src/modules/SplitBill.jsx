import { useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { splitBill, SPLIT_LIMITS } from '../lib/billSplit.js';
import { formatCents } from '../lib/format.js';
import { Field, Adornment } from '../components/Field.jsx';
import { Segmented } from '../components/Segmented.jsx';
import { AnimatedNumber } from '../components/AnimatedNumber.jsx';
import { ProportionBar } from '../components/ProportionBar.jsx';
import { InputChecklist, checklistState } from '../components/InputChecklist.jsx';
import { Icon } from '../components/Icon.jsx';
import { duration, ease, pressable, rise, stagger, swap } from '../motion.js';
import { groupedAmount, submitOnEnter } from './formHelpers.js';

const TIP_PRESETS = ['0', '10', '15', '18', '20'].map((tip) => ({ value: tip, label: `${tip}%`, ariaLabel: `${tip} percent tip` }));
const LABELS = { bill: 'Bill amount', tip: 'Tip percentage', people: 'Number of people' };
const MAX_PEOPLE_SHOWN = 12;

export function SplitBill({ form }) {
  const { fields, allValid, hasVisibleError, setValue, visit, submit } = form;
  const refs = { bill: useRef(null), tip: useRef(null), people: useRef(null) };

  // Same validation and arithmetic as splitBillFromForm, computed live.
  const split = useMemo(() => {
    if (!allValid) return null;
    const tipHundredths = fields.tip.result.value;
    const result = splitBill({ billCents: fields.bill.result.value, tipHundredths, people: fields.people.result.value });
    return { ...result, billCents: fields.bill.result.value, tipPercent: tipHundredths / 100 };
  }, [allValid, fields.bill.result, fields.tip.result, fields.people.result]);

  const onSubmit = (event) => {
    event.preventDefault();
    const firstInvalid = submit();
    if (firstInvalid) refs[firstInvalid].current?.focus();
  };

  const bind = (key) => ({
    id: `split-${key}`,
    name: key,
    ref: refs[key],
    value: fields[key].value,
    error: fields[key].error,
    onChange: (event) => setValue(key, event.target.value),
    onBlur: () => visit(key),
  });

  const people = fields.people.result.ok ? fields.people.result.value : null;
  const stepPeople = (delta) => {
    const next = people === null ? SPLIT_LIMITS.minPeople : Math.min(SPLIT_LIMITS.maxPeople, Math.max(SPLIT_LIMITS.minPeople, people + delta));
    setValue('people', String(next));
  };

  return (
    <div className="module-grid">
      <motion.form className="card form-card" noValidate onSubmit={onSubmit} onKeyDown={submitOnEnter} variants={stagger(0.05)} initial="initial" animate="animate">
        <motion.div variants={rise}>
          <Field
            {...bind('bill')}
            label="Bill amount"
            inputMode="decimal"
            placeholder="84.60"
            size="lg"
            hint="Before tip, up to $1,000,000"
            before={<Adornment side="before">$</Adornment>}
            onBlur={() => {
              visit('bill');
              if (fields.bill.result.ok) setValue('bill', groupedAmount(fields.bill.result.value));
            }}
          />
        </motion.div>
        <motion.div variants={rise}>
          <Field {...bind('tip')} label="Tip" inputMode="decimal" hint="Pick a preset or type any amount from 0% to 100%" after={<Adornment side="after">%</Adornment>}>
            <Segmented className="quick-picks" options={TIP_PRESETS} value={fields.tip.value.trim()} onChange={(value) => setValue('tip', value)} label="Tip presets" layoutId="tip-indicator" size="sm" />
          </Field>
        </motion.div>
        <motion.div variants={rise}>
          <Field
            {...bind('people')}
            label="Number of people"
            inputMode="numeric"
            hint="1 to 100"
            before={
              <motion.button type="button" className="stepper-btn" aria-label="One person fewer" disabled={people !== null && people <= SPLIT_LIMITS.minPeople} onClick={() => stepPeople(-1)} {...pressable}>
                <Icon name="minus" size={18} />
              </motion.button>
            }
            after={
              <motion.button type="button" className="stepper-btn" aria-label="One person more" disabled={people !== null && people >= SPLIT_LIMITS.maxPeople} onClick={() => stepPeople(1)} {...pressable}>
                <Icon name="plus" size={18} />
              </motion.button>
            }
          />
        </motion.div>
        <motion.p className="form-note" variants={rise}>
          Results update as you type. Press <kbd>Enter</kbd> to check every field.
        </motion.p>
      </motion.form>

      <section className="card result-card" aria-label="Bill split">
        <AnimatePresence mode="wait" initial={false}>
          {split ? (
            <motion.div key="result" variants={swap} initial="initial" animate="animate" exit="exit">
              <SplitResult split={split} />
            </motion.div>
          ) : (
            <motion.div key="waiting" variants={swap} initial="initial" animate="animate" exit="exit">
              <InputChecklist
                title={hasVisibleError ? 'Check the highlighted field' : 'Each share will appear here'}
                description={
                  hasVisibleError
                    ? 'The split comes back as soon as every input is valid.'
                    : 'Enter the bill. You will see the tip, the total and what each person pays, correct to the cent.'
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

function SplitResult({ split }) {
  const { billCents, tipCents, totalCents, tipPercent, people, shares } = split;
  // Headline the amount most people pay; describe the (smaller) group that differs by 1¢.
  const [usual, different] = [...shares].sort((a, b) => b.people - a.people || a.amountCents - b.amountCents);
  const sharesSum = shares.reduce((sum, s) => sum + s.people * s.amountCents, 0);

  return (
    <motion.div className="result" variants={stagger(0.06)} initial="initial" animate="animate">
      <motion.div className="hero" variants={rise}>
        <p className="eyebrow">{people === 1 ? 'You pay' : 'Each person pays'}</p>
        <AnimatedNumber className="hero-value" value={usual.amountCents} format={formatCents} />
        <p className="hero-sub">
          {different
            ? `${different.people} of ${people} ${different.people === 1 ? 'pays' : 'pay'} 1¢ ${different.amountCents > usual.amountCents ? 'more' : 'less'} (${formatCents(different.amountCents)}) so the total is exact.`
            : people === 1
              ? 'The whole bill, tip included.'
              : `Split evenly between ${people} people.`}
        </p>
      </motion.div>

      <motion.div className="receipt num" variants={rise}>
        <div className="receipt-row">
          <span>Bill</span>
          <span>{formatCents(billCents)}</span>
        </div>
        <div className="receipt-row">
          <span>Tip ({tipPercent}%)</span>
          <AnimatedNumber value={tipCents} format={formatCents} testId="split-tip" countFromZero={false} />
        </div>
        <ProportionBar
          label={`Bill ${formatCents(billCents)} and tip ${formatCents(tipCents)}`}
          segments={[
            { key: 'bill', value: billCents, className: 'tone-primary' },
            { key: 'tip', value: tipCents, className: 'tone-secondary' },
          ]}
        />
        <div className="receipt-row receipt-total">
          <span>Total with tip</span>
          <AnimatedNumber value={totalCents} format={formatCents} testId="split-total" countFromZero={false} />
        </div>
      </motion.div>

      <motion.div className="people" variants={rise}>
        <p className="eyebrow">Who pays what</p>
        <PeopleGrid people={people} usual={usual} different={different} />
        <ul className="share-lines num" data-testid="split-shares">
          {shares.map((share) => (
            <li key={share.amountCents}>
              {shares.length === 1
                ? `${people === 1 ? '1 person pays' : `All ${people} pay`} ${formatCents(share.amountCents)}`
                : `${share.people} ${share.people === 1 ? 'person pays' : 'people pay'} ${formatCents(share.amountCents)}`}
            </li>
          ))}
        </ul>
        <p className={`check-line${sharesSum === totalCents ? '' : ' is-off'}`}>
          <Icon name="check" size={16} strokeWidth={2.2} />
          Shares add up to {formatCents(sharesSum)}
        </p>
      </motion.div>
    </motion.div>
  );
}

/** One token per person (up to 12); people who pay a cent more or less are marked. */
function PeopleGrid({ people, usual, different }) {
  const differentCount = different ? different.people : 0;
  const badge = different && (different.amountCents > usual.amountCents ? '+1¢' : '−1¢');
  const shownCount = people > MAX_PEOPLE_SHOWN ? MAX_PEOPLE_SHOWN - 1 : people;
  const tokens = Array.from({ length: shownCount }, (_, i) => ({ index: i + 1, differs: i < differentCount }));

  return (
    <ul className="people-grid" aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {tokens.map((token) => (
          <motion.li
            key={token.index}
            layout
            className={`person${token.differs ? ' differs' : ''}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: duration.base, ease: ease.out, delay: Math.min(token.index, 12) * 0.015 } }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.fast } }}
          >
            <span className="person-avatar">{token.index}</span>
            {token.differs && <span className="person-badge">{badge}</span>}
          </motion.li>
        ))}
        {people > MAX_PEOPLE_SHOWN && (
          <motion.li key="more" layout className="person person-more" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="person-avatar">+{people - shownCount}</span>
          </motion.li>
        )}
      </AnimatePresence>
    </ul>
  );
}
