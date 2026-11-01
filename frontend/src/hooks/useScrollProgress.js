import { useEffect, useState } from "react";

/**
 * Page scroll state, rAF-throttled.
 * Returns { y, progress } — progress is 0..1 across the whole document.
 */
export default function useScrollProgress() {
  const [state, setState] = useState({ y: 0, progress: 0 });

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setState({ y, progress: max > 0 ? Math.min(y / max, 1) : 0 });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return state;
}
