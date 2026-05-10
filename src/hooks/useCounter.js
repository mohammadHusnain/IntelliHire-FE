import { useEffect, useRef, useState } from "react";
import useReducedMotion from "./useReducedMotion";

// Smooth easeOutCubic — natural deceleration, premium feel.
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * useCounter – animates a numeric value from 0 to target with easing.
 *   - Triggers only when `start` is true.
 *   - Respects prefers-reduced-motion (jumps directly to target).
 *   - Cleans up rAF on unmount / target change.
 *
 * @param {number} target  Final value
 * @param {number} duration  ms (default 1200)
 * @param {boolean} start  Gate the animation (e.g. on viewport entry)
 * @param {number} decimals  Decimal places to preserve (default 0)
 */
export default function useCounter(target, duration = 1200, start = false, decimals = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!start) return;
    const numericTarget = Number(target) || 0;

    if (reduced || duration <= 0) {
      setValue(numericTarget);
      return;
    }

    let startTime = null;
    const factor = Math.pow(10, decimals);

    const step = (ts) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      const next = Math.round(eased * numericTarget * factor) / factor;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, start, decimals, reduced]);

  return value;
}
