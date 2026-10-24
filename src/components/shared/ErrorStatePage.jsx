import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/layout/PublicNavbar";
import { trackSpotlight } from "@/lib/spotlight";

/**
 * Full-page error state (404, 403…). `links` are suggested destinations
 * shown as cards: [{ to, label, desc, icon }].
 */
export default function ErrorStatePage({ code, icon: Icon, eyebrow, title, message, primary, links = [] }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-white font-sans text-stone-700 antialiased">
      <PublicNavbar />

      <main className="relative flex flex-1 items-center justify-center px-6 pb-16 pt-32">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-dot-grid mask-radial absolute inset-0" />
          <div className="absolute left-1/2 top-1/3 h-[480px] w-[min(820px,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,78,35,0.14),transparent)]" />
        </div>

        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="relative mx-auto inline-flex animate-fade-in-up">
            <span
              aria-hidden
              className="select-none font-display text-[120px] font-semibold leading-none tracking-[-0.06em] text-transparent sm:text-[168px]"
              style={{
                backgroundImage: "linear-gradient(180deg, rgba(13,13,13,0.9) 10%, rgba(13,13,13,0.08) 95%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {code}
            </span>
            {Icon && (
              <span className="float-y absolute -right-9 top-0 flex h-12 w-12 items-center justify-center rounded-2xl sm:-right-5 sm:top-5 sm:h-14 sm:w-14 bg-brand text-white shadow-[0_16px_32px_-12px_rgba(240,78,35,0.7)]">
                <Icon size={24} />
              </span>
            )}
          </div>

          <p className="eyebrow mt-6 flex justify-center animate-fade-in-up" style={{ animationDelay: "80ms" }}>
            {eyebrow}
          </p>
          <h1 className="display mt-4 text-[34px] sm:text-[46px] animate-fade-in-up" style={{ animationDelay: "140ms" }}>
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-stone-500 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            {message}
          </p>

          <div className="mt-9 flex flex-col-reverse justify-center gap-3 sm:flex-row animate-fade-in-up" style={{ animationDelay: "260ms" }}>
            <button type="button" onClick={goBack} className="btn-secondary btn-lg">
              <ArrowLeft size={17} /> Go back
            </button>
            <Link to={primary.to} className="btn-primary btn-lg">
              {primary.label} <ArrowRight size={17} className="btn-arrow" />
            </Link>
          </div>

          {links.length > 0 && (
            <div className="mt-14 animate-fade-in-up" style={{ animationDelay: "340ms" }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-400">Or try one of these</p>
              <div className="mt-4 grid gap-3 text-left sm:grid-cols-3">
                {links.map(({ to, label, desc, icon: LinkIcon }) => (
                  <Link
                    key={label}
                    to={to}
                    onMouseMove={trackSpotlight}
                    className="spotlight surface surface-hover group flex flex-col p-4"
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <LinkIcon size={17} />
                      </span>
                      <ArrowRight size={15} className="text-stone-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-brand" />
                    </span>
                    <span className="mt-3 text-[14px] font-semibold text-ink">{label}</span>
                    <span className="mt-0.5 text-[13px] leading-snug text-stone-500">{desc}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
