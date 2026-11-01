import { Link } from "react-router-dom";
import logo from "@/assets/logo/logo.png";
import logoLight from "@/assets/logo/logo-light.png";

const HEIGHT = { sm: "h-8", md: "h-10", lg: "h-14" };

/** IntelliHire wordmark, linking home. `tone="light"` for dark grounds. */
export default function BrandLogo({ tone = "dark", size = "md", className = "", to = "/" }) {
  return (
    <Link
      to={to}
      aria-label="IntelliHire home"
      className={`group inline-flex items-center rounded-lg transition-transform duration-300 ease-[var(--ease-spring)] hover:scale-[1.03] ${className}`}
    >
      <img
        src={tone === "light" ? logoLight : logo}
        alt="IntelliHire"
        width={900}
        height={268}
        className={`${HEIGHT[size] || HEIGHT.md} w-auto select-none`}
        draggable={false}
      />
    </Link>
  );
}
