import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Menu, Search, X } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import { isNavActive } from "@/lib/nav";

function Sidebar({ pathname, onNavigate, homeTo, brandTag, nav, renderTop, renderBottom, navLabel }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <BrandLogo to={homeTo} />
        {brandTag && <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white">{brandTag}</span>}
      </div>
      {renderTop && <div className="px-4 pb-2 pt-2">{renderTop(onNavigate)}</div>}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={navLabel}>
        {nav.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                        active ? "bg-brand-soft text-brand" : "text-stone-600 hover:bg-stone-100/80 hover:text-ink"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-all duration-300 ${active ? "opacity-100" : "scale-y-0 opacity-0"}`}
                      />
                      <Icon size={18} className={`transition-transform duration-300 ${active ? "" : "group-hover:scale-110"}`} />
                      <span className="flex-1">{item.label}</span>
                      {item.count > 0 && (
                        <span
                          className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold ${
                            item.alert ? "bg-amber-500 text-white" : active ? "bg-brand text-white" : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {renderBottom && renderBottom(onNavigate)}
    </div>
  );
}

/**
 * Portal chrome shared by every signed-in workspace: sidebar (drawer below lg), sticky top bar
 * with breadcrumbs, Ctrl/Cmd+K palette and header actions. Each workspace passes its own content.
 */
export default function AppShell({
  homeTo,
  brandTag,
  nav,
  navLabel = "Primary",
  pageMeta = [],
  renderSidebarTop,
  renderSidebarBottom,
  headerActions,
  renderPalette,
  banner,
}) {
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const meta = pageMeta.find((m) => pathname.startsWith(m.match));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  useEffect(() => {
    if (!renderPalette) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renderPalette]);

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const sidebarProps = { homeTo, brandTag, nav, navLabel, renderTop: renderSidebarTop, renderBottom: renderSidebarBottom };

  return (
    <div className="min-h-dvh bg-[#FAFAF9] font-sans text-stone-700 antialiased print:bg-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] border-r border-[var(--line)] bg-white lg:block print:!hidden">
        <Sidebar pathname={pathname} {...sidebarProps} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="animate-backdrop-in absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl" style={{ animation: "slideInLeft 320ms var(--ease-premium)" }}>
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="icon-btn absolute right-3 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
            >
              <X size={18} />
            </button>
            <Sidebar pathname={pathname} onNavigate={() => setDrawer(false)} {...sidebarProps} />
          </div>
        </div>
      )}

      <div className="lg:pl-[256px] print:!pl-0">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#FAFAF9]/80 backdrop-blur-xl print:hidden">
          {banner}
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="icon-btn -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-stone-100 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13.5px] sm:flex">
              <Link to={homeTo} className="text-stone-500 transition-colors hover:text-ink">
                Home
              </Link>
              {meta?.parent && (
                <>
                  <ChevronRight size={14} className="text-stone-300" />
                  <Link to={meta.parent.to} className="text-stone-500 transition-colors hover:text-ink">
                    {meta.parent.label}
                  </Link>
                </>
              )}
              {meta && (
                <>
                  <ChevronRight size={14} className="text-stone-300" />
                  <span className="truncate font-semibold text-ink">{meta.title}</span>
                </>
              )}
            </nav>
            <span className="truncate text-[15px] font-semibold text-ink sm:hidden">{meta?.title}</span>

            <div className="ml-auto flex items-center gap-1.5">
              {renderPalette && (
                <>
                  <button
                    type="button"
                    onClick={() => setPalette(true)}
                    className="hidden h-10 w-64 items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white px-3 text-[13.5px] text-stone-400 transition-all hover:border-stone-300 hover:shadow-sm md:flex"
                  >
                    <Search size={16} />
                    <span className="flex-1 text-left">Search or jump to…</span>
                    <kbd className="rounded-md border border-[var(--line)] bg-stone-50 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">Ctrl K</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPalette(true)}
                    aria-label="Search"
                    className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 md:hidden"
                  >
                    <Search size={18} />
                  </button>
                </>
              )}
              {headerActions}
            </div>
          </div>
        </header>

        <main key={pathname} className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 animate-fade-in sm:px-6 sm:pt-8 lg:px-8">
          <Outlet />
        </main>
      </div>

      {palette && renderPalette?.(() => setPalette(false))}
    </div>
  );
}

export function SidebarUserCard({ avatar, name, subtitle }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-ink">{name}</p>
        <p className="truncate text-[12px] text-stone-500">{subtitle}</p>
      </div>
    </div>
  );
}

export function SidebarCallout({ to, onClick, title, text, percent }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group mx-4 mb-3 block rounded-2xl border border-[var(--line)] bg-gradient-to-br from-brand-soft to-white p-3.5 transition-all hover:border-brand/30"
    >
      <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink">
        {title}
        <ChevronRight size={14} className="text-stone-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      {percent != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${percent}%` }} />
        </div>
      )}
      {text && <p className="mt-2 text-[11.5px] text-stone-500">{text}</p>}
    </Link>
  );
}
