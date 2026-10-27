import { useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { duration, ease } from '../motion.js';

/**
 * Counts from the previously shown value to `value` (an integer, e.g. cents).
 * The animated text is hidden from assistive technology; a visually hidden
 * copy always holds the exact final value, so screen readers and tests never
 * see an intermediate number.
 * Writes to the DOM directly during the animation, so it does not re-render
 * React on every frame.
 */
export function AnimatedNumber({ value, format, className = '', testId, countFromZero = true }) {
  const ref = useRef(null);
  const shown = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    const start = shown.current ?? (countFromZero ? 0 : value);
    if (reducedMotion || start === value) {
      shown.current = value;
      el.textContent = format(value);
      return undefined;
    }
    const controls = animate(start, value, {
      duration: duration.slow,
      ease: ease.out,
      onUpdate: (latest) => {
        shown.current = latest;
        el.textContent = format(Math.round(latest));
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = format(value);
      },
    });
    return () => controls.stop();
  }, [value, format, reducedMotion, countFromZero]);

  return (
    <span className={`animated-number ${className}`}>
      <span ref={ref} className="num" aria-hidden="true" />
      <span className="sr-only" data-testid={testId}>
        {format(value)}
      </span>
    </span>
  );
}
