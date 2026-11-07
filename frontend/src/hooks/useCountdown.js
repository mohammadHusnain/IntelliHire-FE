import { useCallback, useEffect, useRef, useState } from "react";

/** A whole-second countdown: `const [left, start] = useCountdown(); start(30)`. `left` is 0 when idle. */
export function useCountdown() {
  const [left, setLeft] = useState(0);
  const timer = useRef(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const start = useCallback((seconds) => {
    stop();
    const total = Math.max(0, Math.ceil(seconds || 0));
    setLeft(total);
    if (!total) return;
    const endsAt = Date.now() + total * 1000;
    timer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (!remaining) stop();
    }, 500);
  }, []);

  useEffect(() => stop, []);
  return [left, start];
}
