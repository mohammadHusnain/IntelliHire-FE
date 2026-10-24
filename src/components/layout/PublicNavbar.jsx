import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import useScrollProgress from "@/hooks/useScrollProgress";
import useSectionNav from "@/hooks/useSectionNav";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

const NAV_LINKS = [
  { id: "platform", label: "Platform" },
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "stories", label: "Stories" },
  { id: "faq", label: "FAQ" },
];

export default function PublicNavbar({ showProgress = false }) {
  const { y, progress } = useScrollProgress();
  const goTo = useSectionNav();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const linksRef = useRef(null);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const dashboard = isAuthenticated && user ? ROLE_DASHBOARDS[user.role] : null;
  const scrolled = y > 12;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onLinkEnter = (e) => {
    const parent = linksRef.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (parent) setHover({ left: r.left - parent.left, width: r.width });
  };

  const go = (id) => {
    if (!open) return goTo(id);
    setOpen(false);
    // Wait for the scroll lock to be released, or the scroll is swallowed.
    setTimeout(() => goTo(id), 30);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 sm:px-4">
      <div
        className={`relative mx-auto flex h-16 items-center justify-between transition-all duration-500 ease-[var(--ease-premium)] ${
          scrolled
            ? "mt-3 max-w-6xl rounded-2xl glass px-4 shadow-[0_12px_40px_-18px_rgba(13,13,13,0.25)] sm:px-5"
            : "mt-0 max-w-7xl border border-transparent px-2 sm:px-4"
        }`}
      >
        <BrandLogo />

        <nav
          ref={linksRef}
          onMouseLeave={() => setHover(null)}
          className="relative hidden items-center lg:flex"
          aria-label="Primary"
        >
          <span
            aria-hidden
            className="absolute top-1/2 h-9 -translate-y-1/2 rounded-full bg-ink/[0.05] transition-all duration-300 ease-[var(--ease-premium)]"
            style={{
              left: hover?.left ?? 0,
              width: hover?.width ?? 0,
              opacity: hover ? 1 : 0,
            }}
          />
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onMouseEnter={onLinkEnter}
              onClick={() => go(l.id)}
              className="relative z-10 rounded-full px-4 py-2 text-[14px] font-medium text-stone-600 transition-colors hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {dashboard ? (
            <Link to={dashboard} className="btn-dark hidden sm:inline-flex">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full px-4 py-2 text-[14px] font-semibold text-stone-700 transition-colors hover:bg-ink/[0.05] hover:text-ink sm:inline-flex"
              >
                Log in
              </Link>
              <Link to="/register" className="btn-primary hidden sm:inline-flex">
                Get started <ArrowRight size={16} className="btn-arrow" />
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="icon-btn inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-ink/[0.05] lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {showProgress && (
          <span
            aria-hidden
            className={`absolute bottom-0 left-4 right-4 h-[2px] origin-left rounded-full bg-brand transition-opacity duration-300 ${
              scrolled ? "opacity-100" : "opacity-0"
            }`}
            style={{ transform: `scaleX(${progress})` }}
          />
        )}
      </div>

      {/* Mobile sheet */}
      <div
        className={`fixed inset-x-3 top-[84px] origin-top rounded-2xl border border-[var(--line)] bg-white p-3 shadow-[0_30px_60px_-20px_rgba(13,13,13,0.35)] transition-all duration-300 ease-[var(--ease-premium)] lg:hidden ${
          open ? "visible scale-100 opacity-100" : "invisible scale-[0.97] opacity-0"
        }`}
      >
        <nav className="flex flex-col" aria-label="Mobile">
          {NAV_LINKS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => go(l.id)}
              className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-[16px] font-medium text-ink transition-all hover:bg-stone-50"
              style={{
                transitionDelay: open ? `${60 + i * 35}ms` : "0ms",
                transform: open ? "none" : "translateY(-6px)",
                opacity: open ? 1 : 0,
              }}
            >
              {l.label}
              <ArrowRight size={16} className="text-stone-400" />
            </button>
          ))}
        </nav>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
          {dashboard ? (
            <Link to={dashboard} onClick={() => setOpen(false)} className="btn-dark col-span-2">
              <LayoutDashboard size={16} /> Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary">
                Log in
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="animate-backdrop-in fixed inset-0 top-0 -z-10 bg-ink/20 backdrop-blur-[2px] lg:hidden"
        />
      )}
    </header>
  );
}
