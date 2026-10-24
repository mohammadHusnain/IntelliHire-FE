import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Sparkles, Mic } from "lucide-react";
import heroImg from "@/assets/herosection image intellihire.png";
import useScrollProgress from "@/hooks/useScrollProgress";
import useReducedMotion from "@/hooks/useReducedMotion";
import useSectionNav from "@/hooks/useSectionNav";

const WORDS = ["real talent.", "the right fit.", "your next hire."];

function RotatingWord() {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2600);
    return () => clearInterval(t);
  }, [reduced]);
  return (
    <span className="relative inline-block whitespace-nowrap">
      <em key={i} className="word-in">
        {WORDS[i]}
      </em>
      <svg
        aria-hidden
        viewBox="0 0 300 14"
        preserveAspectRatio="none"
        className="absolute -bottom-1 left-0 h-[0.18em] w-full text-brand/30"
      >
        <path d="M2 10 C 80 2, 220 2, 298 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function Hero() {
  const { y } = useScrollProgress();
  const reduced = useReducedMotion();
  const goTo = useSectionNav();
  const tilt = reduced ? 0 : Math.max(0, 16 - y / 28);
  const lift = reduced ? 1 : Math.min(1, 0.94 + y / 4000);

  return (
    <section className="relative overflow-hidden pt-32 sm:pt-36 lg:pt-44">
      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-dot-grid mask-radial absolute inset-0" />
        <div className="absolute left-1/2 top-[-12%] h-[620px] w-[min(1100px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,78,35,0.16),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="mx-auto max-w-6xl px-6 text-center lg:px-8">
        <button
          type="button"
          onClick={() => goTo("how-it-works")}
          className="chip animate-fade-in-up max-w-full pr-3"
        >
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand px-2.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <Sparkles size={11} /> New
          </span>
          <span className="truncate">
            AI technical interviews<span className="hidden sm:inline">, personalised to every CV</span>
          </span>
          <ArrowRight size={14} className="btn-arrow text-stone-400" />
        </button>

        <h1
          className="display mx-auto mt-7 max-w-4xl text-[42px] leading-[1.02] xs:text-[48px] sm:text-[64px] lg:text-[80px] animate-fade-in-up"
          style={{ animationDelay: "80ms" }}
        >
          Interviews that find <br className="hidden sm:block" />
          <RotatingWord />
        </h1>

        <p
          className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-stone-500 sm:text-[19px] animate-fade-in-up"
          style={{ animationDelay: "160ms" }}
        >
          IntelliHire analyses every CV, runs AI screening and technical interviews, and hands your
          team a clear report. Candidates practise the same interviews until they are ready.
        </p>

        <div
          className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center animate-fade-in-up"
          style={{ animationDelay: "240ms" }}
        >
          <Link to="/register?role=company" className="btn-primary btn-lg">
            Start hiring <ArrowRight size={18} className="btn-arrow" />
          </Link>
          <Link to="/register?role=individual" className="btn-secondary btn-lg">
            <Mic size={17} /> Practise an interview
          </Link>
        </div>

        <ul
          className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-stone-500 animate-fade-in-up"
          style={{ animationDelay: "320ms" }}
        >
          {["Final decisions stay human", "No credit card required", "Live in minutes"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-500" /> {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Product visual */}
      <div
        className="relative mx-auto mt-16 max-w-6xl px-4 animate-fade-in-up sm:mt-20 sm:px-6 lg:px-8"
        style={{ perspective: "1600px", animationDelay: "400ms" }}
      >
        <div
          className="relative will-change-transform"
          style={{
            transform: `rotateX(${tilt}deg) scale(${lift})`,
            transformOrigin: "50% 0%",
            transition: "transform 120ms linear",
          }}
        >
          <div className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[40px] bg-gradient-to-b from-brand/20 via-brand/5 to-transparent blur-3xl" />
          <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-white p-1.5 shadow-[0_50px_100px_-40px_rgba(13,13,13,0.45)] sm:p-2">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <div className="mx-auto hidden h-6 w-full max-w-xs items-center justify-center rounded-md bg-stone-100 text-[11px] text-stone-400 sm:flex">
                app.intellihire.ai/candidates
              </div>
              <span className="hidden w-12 sm:block" />
            </div>
            <img
              src={heroImg}
              alt="IntelliHire candidate review workspace"
              width={1592}
              height={1088}
              fetchPriority="high"
              className="h-auto w-full rounded-[14px] border border-stone-100 object-cover"
            />
          </div>

          {/* Floating cards */}
          <div className="float-y glass absolute -left-2 top-[18%] hidden w-56 rounded-2xl p-4 text-left shadow-[0_20px_40px_-20px_rgba(13,13,13,0.35)] md:block lg:-left-10">
            <div className="flex items-center gap-3">
              <ScoreRing value={92} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">AI match score</p>
                <p className="text-[15px] font-semibold text-ink">Strong fit</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {[["CV match", 94], ["Screening", 88], ["Technical", 91]].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[11px] text-stone-500">
                  <span className="w-16 shrink-0">{k}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${v}%` }} />
                  </span>
                  <span className="w-6 text-right font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="float-y-2 glass absolute -right-2 bottom-[16%] hidden items-center gap-3 rounded-2xl p-3.5 pr-5 text-left shadow-[0_20px_40px_-20px_rgba(13,13,13,0.35)] md:flex lg:-right-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">Screening interview complete</p>
              <p className="text-[12px] text-stone-500">Shortlisted for the technical round</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreRing({ value }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#F5F5F4" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--orange)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="text-[13px] font-bold text-ink">{value}</span>
    </span>
  );
}
