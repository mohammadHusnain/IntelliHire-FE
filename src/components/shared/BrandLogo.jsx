import { Link } from "react-router-dom";
import IntelliHireLogo from "./IntelliHireLogo";

/** Logo mark + wordmark, linking home. `tone="light"` for dark grounds. */
export default function BrandLogo({ tone = "dark", size = "md", className = "", to = "/" }) {
  const mark = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const text = size === "lg" ? "text-[24px]" : size === "sm" ? "text-[18px]" : "text-[20px]";
  return (
    <Link
      to={to}
      aria-label="IntelliHire home"
      className={`group inline-flex items-center gap-2.5 rounded-lg ${className}`}
    >
      <IntelliHireLogo
        className={`${mark} transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-105`}
        color={tone === "light" ? "#FFFFFF" : "#F04E23"}
      />
      <span
        className={`${text} font-display font-semibold tracking-[-0.02em] ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        IntelliHire
      </span>
    </Link>
  );
}
