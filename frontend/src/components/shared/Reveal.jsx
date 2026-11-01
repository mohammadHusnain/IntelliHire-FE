import useInView from "../../hooks/useInView";
import useReducedMotion from "../../hooks/useReducedMotion";

/**
 * Reveal — fades + slides children up on viewport entry.
 *
 * Lightweight, GPU-friendly (transform/opacity only), respects
 * prefers-reduced-motion and stays composable with existing layouts.
 *
 * Props:
 *   delay      ms before animating (stagger sequences)
 *   duration   ms (default 500)
 *   y          translateY offset in px (default 16)
 *   as         element type (default "div")
 *   className  passthrough
 */
export default function Reveal({
  children,
  delay = 0,
  duration = 500,
  y = 16,
  as: Tag = "div",
  className = "",
  style: styleProp,
  ...rest
}) {
  const [ref, inView] = useInView({ threshold: 0.15, once: true });
  const reduced = useReducedMotion();

  const style = reduced
    ? { ...styleProp }
    : {
        opacity: inView ? 1 : 0,
        transform: inView ? "translate3d(0,0,0)" : `translate3d(0, ${y}px, 0)`,
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: "opacity, transform",
        ...styleProp,
      };

  return (
    <Tag ref={ref} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}
