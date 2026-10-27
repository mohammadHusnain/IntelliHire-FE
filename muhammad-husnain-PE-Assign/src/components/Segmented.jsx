import { useRef } from 'react';
import { motion } from 'motion/react';
import { spring } from '../motion.js';

/**
 * Single-choice control (radio group) with a sliding selection indicator.
 * `value` may match none of the options (e.g. a custom tip); then nothing is
 * selected and the first option takes keyboard focus.
 * Arrow keys move the selection, as in a native radio group.
 */
export function Segmented({ options, value, onChange, label, layoutId, size = 'md', className = '' }) {
  const refs = useRef([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (focusIndex + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div className={`segmented segmented-${size} ${className}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={index === focusIndex ? 0 : -1}
            className={`segment${checked ? ' is-checked' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {checked && <motion.span layoutId={layoutId} className="segment-indicator" transition={spring.indicator} />}
            <span className="segment-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
