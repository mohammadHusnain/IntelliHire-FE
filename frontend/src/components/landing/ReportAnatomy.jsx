import { useRef, useState, useSyncExternalStore } from "react";
import { m, useMotionValueEvent, useScroll } from "motion/react";
import { Check, Minus } from "lucide-react";
import WordReveal from "./WordReveal";
import Reveal from "@/components/shared/Reveal";
import useReducedMotion from "@/hooks/useReducedMotion";
import { DIMENSION_LABEL, summarise } from "@/lib/interview/evaluate";
import { tween } from "@/lib/motion";

const row = (c, s, f, t, star, quantified) => ({
  skipped: false,
  score: Math.round((c + s + f + t) / 4),
  dimensions: { communication: c, structure: s, confidence: f, technical: t },
  metrics: {
    words: 120,
    wpm: 142,
    fillers: 0,
    hedges: 0,
    skillsMentioned: ["React", "TypeScript"],
    quantified,
    star: { s: star, a: star, r: star },
  },
});

const REPORT = summarise([
  row(84, 78, 80, 72, true, true),
  row(80, 76, 82, 70, true, false),
  row(86, 70, 78, 74, true, true),
  row(78, 72, 76, 68, false, false),
  row(82, 80, 82, 72, true, true),
  row(80, 66, 76, 70, false, false),
]);

const STEPS = [
  { title: "A score you can explain", desc: "One overall score and a plain-language verdict, built from every answer in the session." },
  { title: "Four skill dimensions", desc: "Communication, answer structure, confidence and technical relevance are scored separately, so you know exactly what to work on." },
  { title: "STAR structure, checked", desc: "Each answer is checked for situation, action and result, and for numbers that back the claim up." },
  { title: "Strengths and focus areas", desc: "Specific observations about what worked and what to sharpen, tied to your own answers." },
  { title: "A plan for the next attempt", desc: "Concrete actions to take before you retake the interview and compare your breakdown." },
];

function useMedia(query) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function Region({ id, step, className = "", children }) {
  const state = step < 0 ? "idle" : step === id ? "on" : "off";
  return (
    <div
      data-state={state}
      className={`rounded-2xl p-4 transition-all duration-500 ease-[var(--ease-premium)] data-[state=off]:opacity-40 data-[state=on]:bg-white data-[state=on]:shadow-[0_0_0_2px_rgb(var(--brand-rgb)/0.5),0_20px_40px_-24px_rgba(13,13,13,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

function Ring({ value, reduced }) {
  return (
    <span className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 text-brand">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-stone-200/80" />
        <m.circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          whileInView={{ pathLength: value / 100 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={tween(1.2, 0.15)}
        />
      </svg>
      <span className="font-display text-[30px] font-medium leading-none text-ink">{value}</span>
    </span>
  );
}

function Mock({ step, reduced, scale }) {
  const r = REPORT;
  return (
    <div
      className="surface mx-auto w-full max-w-[480px] p-4 sm:p-5"
      style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">Sample report</span>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500">Role-specific · Mid</span>
      </div>

      <div className="space-y-1.5">
        <Region id={0} step={step} className="flex items-center gap-5">
          <Ring value={r.overall} reduced={reduced} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">Overall</p>
            <p className="font-display text-[26px] font-medium leading-tight text-ink">{r.verdict.label}</p>
            <p className="mt-1 text-[13px] leading-snug text-stone-500">{r.verdict.text}</p>
          </div>
        </Region>

        <Region id={1} step={step} className="space-y-3">
          {Object.entries(r.breakdown).map(([k, v], i) => (
            <div key={k}>
              <div className="flex justify-between text-[12.5px]">
                <span className="text-stone-500">{DIMENSION_LABEL[k]}</span>
                <span className="font-semibold tabular-nums text-ink">{v}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200/70">
                <m.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-brand to-brand-muted"
                  style={{ width: `${v}%` }}
                  initial={reduced ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={tween(0.9, 0.2 + i * 0.08)}
                />
              </div>
            </div>
          ))}
        </Region>

        <Region id={2} step={step} className="grid grid-cols-2 gap-3">
          {[
            ["Complete STAR answers", r.stats.starFull],
            ["Answers with numbers", r.stats.quantifiedCount],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-[var(--line)] bg-white/70 p-3">
              <p className="font-display text-[26px] font-medium leading-none text-ink">
                {n}
                <span className="text-[15px] text-stone-400"> / {r.stats.answered}</span>
              </p>
              <p className="mt-1.5 text-[12px] leading-snug text-stone-500">{label}</p>
            </div>
          ))}
        </Region>

        <Region id={3} step={step} className="space-y-2">
          {r.strengths.slice(0, 2).map((t) => (
            <p key={t} className="flex gap-2 text-[12.5px] leading-snug text-stone-600">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" /> {t}
            </p>
          ))}
          {r.focus.slice(0, 1).map((t) => (
            <p key={t} className="flex gap-2 text-[12.5px] leading-snug text-stone-600">
              <Minus size={14} className="mt-0.5 shrink-0 text-amber-600" /> {t}
            </p>
          ))}
        </Region>

        <Region id={4} step={step}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">Action plan</p>
          <ol className="mt-2 space-y-1.5">
            {r.recommendations.map((t, i) => (
              <li key={t} className="flex gap-2.5 text-[12.5px] leading-snug text-stone-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </Region>
      </div>
    </div>
  );
}

export default function ReportAnatomy() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const isLg = useMedia("(min-width: 1024px)");
  const short = useMedia("(max-height: 940px)");
  const veryShort = useMedia("(max-height: 780px)");
  const [raw, setRaw] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setRaw(Math.max(0, Math.min(STEPS.length - 1, Math.floor(v * STEPS.length)))));
  const step = isLg ? raw : -1;

  return (
    <section id="report" ref={ref} className="relative scroll-mt-24 py-24 lg:h-[360vh] lg:py-0">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:px-8">
          <div>
            <Reveal>
              <span className="eyebrow">Inside the report</span>
            </Reveal>
            <WordReveal
              className="display mt-4 text-[34px] sm:text-[44px] lg:text-[52px]"
              segments={[{ t: "Know exactly" }, { t: "where you stand.", em: true }]}
            />

            <ol className="mt-8 space-y-1">
              {STEPS.map((s, i) => {
                const on = step < 0 || step === i;
                return (
                  <li
                    key={s.title}
                    className={`flex gap-4 rounded-2xl p-3 transition-opacity duration-500 ${on ? "opacity-100" : "opacity-40"}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-500 ${
                        step === i ? "bg-brand text-white" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="pt-1 font-sans text-[16px] font-semibold text-ink">{s.title}</h3>
                      <div className="accordion-panel" data-open={step < 0 || step === i}>
                        <div>
                          <p className="pt-1 text-[14.5px] leading-relaxed text-stone-500">{s.desc}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 px-3 text-[13px] leading-relaxed text-stone-500">
              Candidates get a report like this after every practice session. Companies get one structured report per applicant.
            </p>
          </div>

          <Mock step={step} reduced={reduced} scale={isLg ? (veryShort ? 0.74 : short ? 0.86 : 1) : 1} />
        </div>
      </div>
    </section>
  );
}
