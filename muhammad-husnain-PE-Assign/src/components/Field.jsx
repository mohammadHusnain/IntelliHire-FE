import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collapse } from '../motion.js';
import { Icon } from './Icon.jsx';

/**
 * Labelled text input with optional adornments (a "$" prefix, a "%" suffix,
 * or stepper buttons), a hint, and an animated error message.
 * `before` / `after` render inside the input frame; `children` render below it.
 */
export const Field = forwardRef(function Field(
  { id, label, hint, error, before, after, size = 'md', children, ...inputProps },
  ref,
) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field field-${size}${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-frame">
        {before}
        <input
          ref={ref}
          id={id}
          type="text"
          autoComplete="off"
          spellCheck="false"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className="num"
          {...inputProps}
        />
        {after}
      </div>
      {children}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      <div aria-live="polite">
        <AnimatePresence initial={false}>
          {error && (
            <motion.div key="error" className="field-error-wrap" initial="initial" animate="animate" exit="exit" variants={collapse}>
              <p id={errorId} className="field-error" data-field-error={id}>
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

/** Text adornment inside an input frame, e.g. "$" or "years". */
export function Adornment({ children, side }) {
  return (
    <span className={`adornment adornment-${side}`} aria-hidden="true">
      {children}
    </span>
  );
}
