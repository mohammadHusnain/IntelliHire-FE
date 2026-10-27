import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { evaluate } from '../lib/expression.js';
import { formatNumber } from '../lib/format.js';
import { Segmented } from '../components/Segmented.jsx';
import { Icon } from '../components/Icon.jsx';
import { duration, ease, pressable, swap } from '../motion.js';

// Basic keypad, row by row. `insert` adds text; `action` dispatches that action.
const NUMBER_KEYS = [
  { label: 'AC', action: 'clear', kind: 'fn', aria: 'all clear' },
  { label: <Icon name="backspace" size={22} />, action: 'backspace', kind: 'fn', aria: 'backspace' },
  { label: '(', insert: '(', kind: 'fn' },
  { label: ')', insert: ')', kind: 'fn' },
  { label: '7', insert: '7' },
  { label: '8', insert: '8' },
  { label: '9', insert: '9' },
  { label: '÷', insert: '÷', kind: 'op', aria: 'divide' },
  { label: '4', insert: '4' },
  { label: '5', insert: '5' },
  { label: '6', insert: '6' },
  { label: '×', insert: '×', kind: 'op', aria: 'multiply' },
  { label: '1', insert: '1' },
  { label: '2', insert: '2' },
  { label: '3', insert: '3' },
  { label: '−', insert: '-', kind: 'op', aria: 'minus' },
  { label: '0', insert: '0' },
  { label: '.', insert: '.', aria: 'decimal point' },
  { label: '%', insert: '%', kind: 'op', aria: 'percent', title: 'Percent: divides the number before it by 100' },
  { label: '+', insert: '+', kind: 'op', aria: 'plus' },
  { label: '=', action: 'evaluate', kind: 'equals', aria: 'equals' },
];

// Scientific keys in reading order: one group per row of 3 on wide screens
// (trig, inverse trig, logs & root, powers, constants). On narrow screens the
// keypad is 5 wide, and `order` regroups the same keys into 3 rows of 5.
const SCIENTIFIC_KEYS = [
  { label: 'sin', insert: 'sin(', order: 1, title: 'Sine, in the selected angle unit' },
  { label: 'cos', insert: 'cos(', order: 2, title: 'Cosine, in the selected angle unit' },
  { label: 'tan', insert: 'tan(', order: 3, title: 'Tangent, in the selected angle unit' },
  { label: 'sin⁻¹', insert: 'asin(', order: 6, title: 'Inverse sine, result in the selected angle unit' },
  { label: 'cos⁻¹', insert: 'acos(', order: 7, title: 'Inverse cosine, result in the selected angle unit' },
  { label: 'tan⁻¹', insert: 'atan(', order: 8, title: 'Inverse tangent, result in the selected angle unit' },
  { label: 'ln', insert: 'ln(', order: 4, title: 'Natural logarithm (base e)' },
  { label: 'log', insert: 'log(', order: 5, title: 'Logarithm, base 10' },
  { label: '√', insert: '√(', order: 9, aria: 'square root', title: 'Square root' },
  { label: 'x²', insert: '^2', order: 10, aria: 'squared', title: 'Square' },
  { label: 'xʸ', insert: '^', order: 11, aria: 'power', title: 'Power: x to the power y' },
  { label: 'n!', insert: '!', order: 12, aria: 'factorial', title: 'Factorial (whole numbers 0 to 170)' },
  { label: 'π', insert: 'π', order: 13, title: 'Pi' },
  { label: 'e', insert: 'e', order: 14, title: "Euler's number" },
  { label: 'Ans', insert: 'Ans', order: 15, aria: 'previous answer', title: 'The previous result, at full precision' },
];

const ANGLE_OPTIONS = [
  { value: 'deg', label: 'DEG', ariaLabel: 'Degrees' },
  { value: 'rad', label: 'RAD', ariaLabel: 'Radians' },
];

const prettify = (text) => text.replace(/-/g, '−');
const TRIG = /sin|cos|tan/;
const PLAIN_NUMBER = /^\d*\.?\d*$/;

/** Size step for the main line, so long expressions shrink instead of overflowing. */
function sizeFor(text) {
  if (text.length <= 9) return 'xl';
  if (text.length <= 14) return 'lg';
  if (text.length <= 22) return 'md';
  return 'sm';
}

/**
 * What the current expression would evaluate to, shown faintly while typing.
 * Uses the same engine as "=", so the preview can never disagree with the result.
 * Hidden for a bare number and for anything that does not evaluate yet.
 */
function usePreview(state) {
  return useMemo(() => {
    const { status, expression, angleMode, ans } = state;
    if (status !== 'editing' || PLAIN_NUMBER.test(expression)) return '';
    try {
      return formatNumber(evaluate(expression, { angleMode, ans }));
    } catch {
      return '';
    }
  }, [state]);
}

export function Calculator({ mode, state, dispatch, flashKey }) {
  const scientific = mode === 'scientific';

  return (
    <div className={`calculator calculator-${mode}`}>
      <Display state={state} dispatch={dispatch} scientific={scientific} />
      <div className="keypads">
        <AnimatePresence initial={false}>
          {scientific && (
            <motion.div
              key="scientific"
              className="keypad keypad-scientific"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: duration.fast } }}
            >
              {SCIENTIFIC_KEYS.map((key) => (
                <Key key={key.insert} spec={key} kind="sci" dispatch={dispatch} flashKey={flashKey} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="keypad keypad-numbers">
          {NUMBER_KEYS.map((key) => (
            <Key key={key.insert ?? key.action} spec={key} dispatch={dispatch} flashKey={flashKey} />
          ))}
        </div>
      </div>
      <p className="keyboard-hint">
        <span>Type with your keyboard:</span> <kbd>0–9</kbd> <kbd>+ − * /</kbd> <kbd>^ % !</kbd> <kbd>( )</kbd> <kbd>Enter</kbd> for =,{' '}
        <kbd>Backspace</kbd>, <kbd>Esc</kbd> to clear
      </p>
    </div>
  );
}

function Key({ spec, kind, dispatch, flashKey }) {
  const id = spec.insert !== undefined ? `input:${spec.insert}` : spec.action;
  const onClick = () => dispatch(spec.insert !== undefined ? { type: 'input', text: spec.insert } : { type: spec.action });
  return (
    <motion.button
      type="button"
      className={`key key-${kind ?? spec.kind ?? 'num'}${flashKey === id ? ' is-flashing' : ''}`}
      aria-label={spec.aria}
      title={spec.title}
      onClick={onClick}
      style={spec.order ? { '--order': spec.order } : undefined}
      {...pressable}
    >
      {spec.label}
    </motion.button>
  );
}

function Display({ state, dispatch, scientific }) {
  const { status, expression, resultText, lastExpression, message, angleMode } = state;
  const preview = usePreview(state);
  const [scope, animate] = useAnimate();
  const reducedMotion = useReducedMotion();

  // Count results so each new one animates in, even if it equals the last.
  const resultCount = useRef(0);
  const previous = useRef({ status, message });
  if (status === 'result' && previous.current.status !== 'result') resultCount.current += 1;

  // A brief shake when a new error appears, so the message is noticed.
  useEffect(() => {
    const prev = previous.current;
    const isNewError = status === 'error' && (prev.status !== 'error' || prev.message !== message);
    previous.current = { status, message };
    if (isNewError && !reducedMotion && scope.current) {
      animate(scope.current, { x: [0, -7, 6, -4, 3, 0] }, { duration: 0.32, ease: 'easeOut' });
    }
  }, [status, message, reducedMotion, animate, scope]);

  const usesAngles = TRIG.test(status === 'result' ? lastExpression : expression);
  const mainText = status === 'result' ? resultText : prettify(expression);
  const mainKey = status === 'result' ? `result-${resultCount.current}` : 'editing';

  return (
    <div ref={scope} className={`display display-${status}`} data-testid="display">
      <div className="display-top">
        {scientific ? (
          <Segmented options={ANGLE_OPTIONS} value={angleMode} onChange={(v) => v !== angleMode && dispatch({ type: 'toggleAngle' })} label="Angle unit" layoutId="angle-indicator" size="sm" />
        ) : (
          usesAngles && (
            <span className="angle-badge" title="Angle unit used for sin, cos and tan">
              {angleMode.toUpperCase()}
            </span>
          )
        )}
        <span id="history" className="history num" data-testid="history">
          <AnimatePresence initial={false} mode="popLayout">
            {status === 'result' && (
              <motion.span key={mainKey} {...swapProps}>
                {prettify(lastExpression)} =
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>

      <div className="display-main" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.output
            key={mainKey}
            id="main-display"
            data-testid="main-display"
            className={`main-line num size-${sizeFor(mainText || '0')}${mainText ? '' : ' is-empty'}`}
            initial={status === 'result' ? { opacity: 0, y: 18, scale: 0.98 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: duration.base, ease: ease.out } }}
            exit={{ opacity: 0, y: -14, transition: { duration: duration.fast } }}
          >
            {mainText || '0'}
          </motion.output>
        </AnimatePresence>
      </div>

      <div className="display-status">
        <AnimatePresence initial={false} mode="wait">
          {status === 'error' ? (
            <motion.p key={`error-${message}`} id="calc-error" className="calc-error" role="alert" data-testid="calc-error" {...swapProps}>
              <Icon name="alert" size={16} />
              <span>{message}</span>
            </motion.p>
          ) : preview ? (
            <motion.p key="preview" className="calc-preview num" data-testid="calc-preview" {...swapProps}>
              = {preview}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

const swapProps = { variants: swap, initial: 'initial', animate: 'animate', exit: 'exit' };
