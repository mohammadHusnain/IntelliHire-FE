import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import useSectionNav from "@/hooks/useSectionNav";

const PLATFORM = [
  { id: "platform", label: "For candidates" },
  { id: "platform", label: "For companies" },
  { id: "how-it-works", label: "Hiring pipeline" },
  { id: "features", label: "Features" },
];

const ACCOUNT = [
  { to: "/register?role=individual", label: "Practice interviews" },
  { to: "/register?role=company", label: "Hire with IntelliHire" },
  { to: "/login", label: "Log in" },
];

const RESOURCES = [
  { id: "stories", label: "Customer stories" },
  { id: "faq", label: "FAQ" },
];

const linkCls =
  "group inline-flex items-center gap-1 text-left text-[14px] text-white/60 transition-colors hover:text-white";

export default function PublicFooter() {
  const goTo = useSectionNav();

  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="bg-dot-grid-light mask-radial pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 lg:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-12 lg:col-span-6">
            <BrandLogo tone="light" />
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
              AI-assisted interviews and hiring. Candidates practise until they are ready; companies
              screen faster and still make every final decision themselves.
            </p>
          </div>

          <FooterCol title="Platform">
            {PLATFORM.map((l) => (
              <li key={l.label}>
                <button type="button" onClick={() => goTo(l.id)} className={linkCls}>
                  {l.label}
                </button>
              </li>
            ))}
          </FooterCol>

          <FooterCol title="Get started">
            {ACCOUNT.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className={linkCls}>
                  {l.label}
                  <ArrowUpRight
                    size={13}
                    className="opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </FooterCol>

          <FooterCol title="Resources">
            {RESOURCES.map((l) => (
              <li key={l.label}>
                <button type="button" onClick={() => goTo(l.id)} className={linkCls}>
                  {l.label}
                </button>
              </li>
            ))}
          </FooterCol>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-white/10 py-6 text-[13px] text-white/45 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} IntelliHire. All rights reserved.</p>
          <p>AI assists. People decide.</p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none relative -mb-[0.22em] select-none text-center font-display text-[22vw] font-semibold leading-none tracking-[-0.05em] text-transparent"
        style={{
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        IntelliHire
      </div>
    </footer>
  );
}

function FooterCol({ title, children }) {
  return (
    <div className="md:col-span-4 lg:col-span-2">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/40">{title}</p>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}
