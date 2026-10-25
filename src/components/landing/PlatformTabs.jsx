import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Briefcase, FileSearch, ClipboardCheck, GraduationCap, Mic, LineChart } from "lucide-react";
import WordReveal from "./WordReveal";
import Reveal from "@/components/shared/Reveal";
import { trackSpotlight } from "@/lib/spotlight";
import { fadeUp, stagger, tween } from "@/lib/motion";

const AUDIENCES = {
  company: {
    tab: "For companies",
    icon: Briefcase,
    title: "Screen hundreds of applicants without losing the human judgement.",
    cards: [
      { icon: FileSearch, title: "AI reads every CV", desc: "Skills, projects and experience are extracted and scored against your requirements.", tags: ["Skills", "Projects", "Experience"] },
      { icon: Mic, title: "AI runs the first rounds", desc: "Shortlisted candidates complete AI screening and technical interviews on their own time.", tags: ["Screening", "Technical"] },
      { icon: ClipboardCheck, title: "One report per candidate", desc: "Structured reports compare candidates side by side. Your team makes the call.", tags: ["CV match", "Strengths", "Risks"] },
    ],
    cta: { to: "/register?role=company", label: "Create a company account" },
  },
  candidate: {
    tab: "For candidates",
    icon: GraduationCap,
    title: "Walk into every interview having already rehearsed it.",
    cards: [
      { icon: Mic, title: "Practise with an AI interviewer", desc: "Answer out loud in a realistic interview room, at any hour, as often as you like.", tags: ["Spoken or typed", "Role-specific"] },
      { icon: LineChart, title: "A scored report", desc: "Communication, answer structure, confidence and technical relevance, plus specific ways to improve.", tags: ["Strengths", "Focus areas", "Action plan"] },
      { icon: GraduationCap, title: "Talent communities", desc: "Connect with companies and peers in focused university, skill and alumni groups.", tags: ["University", "Skills", "Alumni"] },
    ],
    cta: { to: "/register?role=individual", label: "Start practising free" },
  },
};

const KEYS = Object.keys(AUDIENCES);

export default function PlatformTabs() {
  const [active, setActive] = useState("company");
  const a = AUDIENCES[active];

  return (
    <section id="platform" className="scroll-mt-24 bg-[#FBFAF9] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">One platform</span>
          </Reveal>
          <WordReveal
            className="display mt-4 text-[34px] sm:text-[44px] lg:text-[56px]"
            segments={[{ t: "One platform," }, { t: "both sides.", em: true }]}
          />
          <Reveal delay={150}>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-stone-500 sm:text-[18px]">
              Companies run a faster, fairer hiring pipeline. Candidates get the practice and feedback that used to cost a coach.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200} className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Audience" className="relative inline-flex rounded-full border border-[var(--line)] bg-white p-1">
            <span
              aria-hidden
              className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-stone-100 transition-transform duration-500 ease-[var(--ease-premium)]"
              style={{ transform: `translateX(${active === "company" ? "0%" : "100%"})` }}
            />
            {KEYS.map((k) => {
              const Icon = AUDIENCES[k].icon;
              const on = active === k;
              return (
                <button
                  key={k}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  onClick={() => setActive(k)}
                  className={`relative z-10 flex min-h-11 w-[8.75rem] items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-semibold transition-colors xs:w-40 xs:text-[14px] sm:w-48 ${
                    on ? "text-ink" : "text-stone-500 hover:text-ink"
                  }`}
                >
                  <Icon size={16} className={on ? "text-brand" : ""} /> {AUDIENCES[k].tab}
                </button>
              );
            })}
          </div>
        </Reveal>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={active}
            role="tabpanel"
            variants={stagger(0.09)}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -8, transition: tween(0.18) }}
            className="mt-14"
          >
            <m.div variants={fadeUp} className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <h3 className="display max-w-2xl text-[26px] sm:text-[32px]">{a.title}</h3>
              <Link to={a.cta.to} className="btn-dark shrink-0">
                {a.cta.label} <ArrowRight size={16} className="btn-arrow" />
              </Link>
            </m.div>

            <ul className="no-scrollbar -mx-6 mt-8 flex snap-x gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
              {a.cards.map((c, i) => {
                const Icon = c.icon;
                return (
                  <m.li key={c.title} variants={fadeUp} className="w-[82%] shrink-0 snap-start md:w-auto">
                    <article
                      onMouseMove={trackSpotlight}
                      className="spotlight surface surface-hover group flex h-full flex-col p-6 sm:p-7"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
                          <Icon size={22} />
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums text-stone-300">0{i + 1}</span>
                      </div>
                      <h4 className="mt-6 font-display text-[23px] font-medium leading-tight tracking-[-0.015em] text-ink">{c.title}</h4>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-stone-500">{c.desc}</p>
                      <ul className="mt-6 flex flex-wrap gap-2 pt-1">
                        {c.tags.map((t) => (
                          <li key={t} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[12px] font-medium text-stone-600 transition-colors group-hover:border-brand/30">
                            {t}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </m.li>
                );
              })}
            </ul>
          </m.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
