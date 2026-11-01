import { useMemo } from "react";
import useCounter from "../../hooks/useCounter";
import useInView from "../../hooks/useInView";

/**
 * AnimatedCounter — counts from 0 → target on viewport entry.
 *
 * Accepts either a numeric `value` or a string like "73/100", "+18%",
 * "+12 points", "1,240". The numeric portion animates; surrounding text
 * is preserved verbatim so call-sites need not change.
 *
 * Props:
 *   value      number | string  (required)
 *   duration   ms (default 1200)
 *   decimals   decimal precision (auto-detected for strings)
 *   className  optional className passthrough on the wrapping span
 *   as         element type (default "span")
 *   formatter  optional (n) => string for custom formatting
 */
export default function AnimatedCounter({
  value,
  duration = 1200,
  decimals,
  className,
  as: Tag = "span",
  formatter,
  ...rest
}) {
  const [ref, inView] = useInView({ threshold: 0.2, once: true });

  const parsed = useMemo(() => {
    if (typeof value === "number") {
      return { prefix: "", suffix: "", number: value, hasComma: false, decimals: decimals ?? 0 };
    }
    const str = String(value ?? "");
    // Match optional sign, then digits w/ optional thousands separators & decimals.
    const match = str.match(/^([^\d-+.]*)([+-]?[\d,]*\.?\d+)(.*)$/);
    if (!match) {
      return { prefix: str, suffix: "", number: 0, hasComma: false, decimals: 0 };
    }
    const [, prefix, numStr, suffix] = match;
    const hasComma = numStr.includes(",");
    const cleaned = numStr.replace(/,/g, "");
    const inferredDecimals =
      decimals ?? (cleaned.includes(".") ? cleaned.split(".")[1].length : 0);
    return {
      prefix,
      suffix,
      number: parseFloat(cleaned) || 0,
      hasComma,
      decimals: inferredDecimals,
    };
  }, [value, decimals]);

  const current = useCounter(parsed.number, duration, inView, parsed.decimals);

  const display = useMemo(() => {
    if (formatter) return formatter(current);
    let n = current.toFixed(parsed.decimals);
    if (parsed.hasComma) {
      const [intPart, decPart] = n.split(".");
      n = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decPart ? "." + decPart : "");
    }
    return `${parsed.prefix}${n}${parsed.suffix}`;
  }, [current, parsed, formatter]);

  return (
    <Tag ref={ref} className={className} {...rest}>
      {display}
    </Tag>
  );
}
