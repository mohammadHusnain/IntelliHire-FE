import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Briefcase, FileSearch, ListChecks, ClipboardCheck,
  GraduationCap, Mic, LineChart, Target,
} from "lucide-react";
import companiesImg from "@/assets/save time and money image section intellihire.png";
import candidatesImg from "@/assets/automate process image intellihire .png";
import SectionHeading from "./SectionHeading";
import Reveal from "@/components/shared/Reveal";

const AUDIENCES = {
  company: {
    tab: "For companies",
    icon: Briefcase,
    title: "Screen hundreds of applicants without losing the human judgement.",
    points: [
      { icon: ListChecks, title: "Build a role once", desc: "Define skills, experience and custom application fields. IntelliHire generates a shareable form." },
      { icon: FileSearch, title: "Let AI read every CV", desc: "Skills, projects and experience are extracted and scored against your requirements." },
      { icon: Mic, title: "Automate first rounds", desc: "Shortlisted candidates move through AI screening and technical interviews on their own time." },
      { icon: ClipboardCheck, title: "Decide with evidence", desc: "Structured reports compare candidates side by side. Your team makes the call." },
    ],
    cta: { to: "/register?role=company", label: "Create a company account" },
    img: companiesImg,
    alt: "Company hiring workspace with interview responses",
  },
  candidate: {
    tab: "For candidates",
    icon: GraduationCap,
    title: "Walk into every interview having already rehearsed it.",
    points: [
      { icon: Target, title: "Pick your exact role", desc: "Questions adapt to the position you want, from frontend engineering to product design." },
      { icon: Mic, title: "Practise with an AI interviewer", desc: "Answer out loud in a realistic interview room, at any hour, as often as you like." },
      { icon: LineChart, title: "Get honest feedback", desc: "Communication, confidence, technical relevance, plus specific ways to improve." },
      { icon: GraduationCap, title: "Join talent communities", desc: "Connect with companies and peers in focused university, skill and alumni groups." },
    ],
    cta: { to: "/register?role=individual", label: "Start practising free" },
    img: candidatesImg,
    alt: "Candidate recording an interview answer",
  },
};

const KEYS = Object.keys(AUDIENCES);

export default function PlatformTabs() {
  const [active, setActive] = useState("company");
  const a = AUDIENCES[active];

  return (
    <section id="platform" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="One platform"
          title={<>Both sides of the <em>interview table</em></>}
          subtitle="Companies run a faster, fairer hiring pipeline. Candidates get the practice and feedback that used to cost a coach."
        />

        <Reveal delay={200} className="mt-10 flex justify-center">
          <div role="tablist" aria-label="Audience" className="relative inline-flex rounded-full border border-[var(--line)] bg-stone-50 p-1">
            <span
              aria-hidden
              className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_4px_14px_-6px_rgba(13,13,13,0.3)] transition-transform duration-500 ease-[var(--ease-premium)]"
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
                  className={`relative z-10 flex w-[8.75rem] items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-semibold transition-colors xs:w-40 xs:text-[14px] sm:w-48 ${
                    on ? "text-ink" : "text-stone-500 hover:text-ink"
                  }`}
                >
                  <Icon size={16} className={on ? "text-brand" : ""} /> {AUDIENCES[k].tab}
                </button>
              );
            })}
          </div>
        </Reveal>

        <div key={active} role="tabpanel" className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="animate-fade-in-up">
            <h3 className="display text-[28px] sm:text-[34px]">{a.title}</h3>
            <ul className="mt-8 space-y-2">
              {a.points.map((p, i) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.title}
                    className="group flex gap-4 rounded-2xl p-3 transition-colors hover:bg-stone-50 animate-fade-in-up"
                    style={{ animationDelay: `${80 + i * 70}ms` }}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-white text-brand shadow-sm transition-all duration-300 group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                      <Icon size={19} />
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold text-ink">{p.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">{p.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link to={a.cta.to} className="btn-dark mt-8">
              {a.cta.label} <ArrowRight size={16} className="btn-arrow" />
            </Link>
          </div>

          <div className="relative animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-6 -z-10 rounded-[36px] bg-gradient-to-tr from-brand/15 via-transparent to-amber-100/40 blur-2xl" />
            <div className="surface overflow-hidden p-2">
              <img
                src={a.img}
                alt={a.alt}
                width={1142}
                height={922}
                loading="lazy"
                className="h-auto w-full rounded-[14px] object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
