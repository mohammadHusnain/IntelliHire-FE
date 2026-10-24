import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import illustration from "@/assets/auth-illustration.webp";
import BrandLogo from "@/components/shared/BrandLogo";
import useReducedMotion from "@/hooks/useReducedMotion";

const QUOTES = [
  { text: "I practised the frontend interview six times. By the real one, nothing surprised me.", who: "Ayesha Raza", role: "Frontend Developer" },
  { text: "We screened four hundred applicants in under a week, and still made every decision ourselves.", who: "Marcus Lee", role: "Head of Recruitment" },
  { text: "The reports explain the score. Our hiring managers finally trust the shortlist.", who: "Sophie Andersen", role: "Talent Acquisition Lead" },
];

function QuoteRotator() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % QUOTES.length), 6000);
    return () => clearInterval(t);
  }, [reduced]);
  const q = QUOTES[i];
  return (
    <figure className="glass rounded-2xl p-5 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]">
      <blockquote key={i} className="animate-fade-in text-[15px] leading-relaxed">
        &ldquo;{q.text}&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center justify-between gap-3">
        <span key={`c-${i}`} className="animate-fade-in text-[13px]">
          <span className="font-semibold">{q.who}</span>
          <span className="text-stone-500"> · {q.role}</span>
        </span>
        <span className="flex gap-1.5" role="tablist" aria-label="Testimonials">
          {QUOTES.map((_, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Show testimonial ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-premium)] ${
                n === i ? "w-6 bg-brand" : "w-1.5 bg-stone-300 hover:bg-stone-400"
              }`}
            />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Split auth shell: form column on the left, brand illustration panel on the right (lg+).
 * `headline` / `points` let each auth screen speak to its audience.
 */
export default function AuthLayout({ children, topRight, headline, points = [], wide = false }) {
  return (
    <div className="flex min-h-dvh bg-white font-sans text-stone-700 antialiased">
      {/* Form column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip px-5 py-5 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo />
          {topRight}
        </header>

        <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className={`w-full animate-fade-in-up ${wide ? "max-w-[520px]" : "max-w-[440px]"}`}>{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-stone-400">
          <Link to="/" className="group inline-flex items-center gap-1.5 transition-colors hover:text-ink">
            <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" /> Back to site
          </Link>
          <span>© {new Date().getFullYear()} IntelliHire · AI assists. People decide.</span>
        </footer>
      </div>

      {/* Illustration panel */}
      <aside className="relative hidden w-[46%] max-w-[760px] shrink-0 p-3 lg:block">
        <div className="sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[28px] bg-brand-art text-white">
          <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-60" />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

          <div className="relative z-10 px-10 pt-12 xl:px-14">
            <h2 className="display max-w-md text-[34px] !text-white xl:text-[42px]">{headline}</h2>
            {points.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {points.map((p, i) => (
                  <li
                    key={p}
                    className="flex items-center gap-2.5 text-[15px] text-white/85 animate-fade-in-up"
                    style={{ animationDelay: `${200 + i * 90}ms` }}
                  >
                    <CheckCircle2 size={17} className="shrink-0 text-white" /> {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            <img
              src={illustration}
              alt="A candidate in an interview with an AI interviewer"
              width={765}
              height={1024}
              fetchPriority="high"
              className="absolute inset-x-0 bottom-0 mx-auto h-[min(100%,620px)] w-auto max-w-full object-contain object-bottom"
            />
            <div className="float-y glass absolute right-6 top-6 hidden items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-ink shadow-[0_16px_32px_-16px_rgba(0,0,0,0.4)] xl:flex">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[12px] font-semibold">AI interviewer live</span>
            </div>
          </div>

          <div className="relative z-10 px-6 pb-6 xl:px-8 xl:pb-8">
            <QuoteRotator />
          </div>
        </div>
      </aside>
    </div>
  );
}
