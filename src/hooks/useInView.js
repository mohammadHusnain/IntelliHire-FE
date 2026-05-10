import { useEffect, useRef, useState } from "react";

/**
 * useInView – fires once when the element first intersects the viewport.
 * Returns [ref, inView]. Falls back to true immediately if IntersectionObserver
 * is unavailable so SSR / older browsers still render content.
 */
export default function useInView({ threshold = 0.2, rootMargin = "0px", once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}
