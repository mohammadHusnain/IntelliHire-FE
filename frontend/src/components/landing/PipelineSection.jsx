import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenSquare, Share2, FileSearch, MessagesSquare, Code2, ClipboardCheck } from "lucide-react";
import SectionHeading from "./SectionHeading";
import useReducedMotion from "@/hooks/useReducedMotion";

const STEPS = [
  { icon: PenSquare, title: "Create the role", desc: "Set the title, required skills, experience and any custom application fields. A dynamic application form is generated for you.", tag: "You" },
  { icon: Share2, title: "Share the application link", desc: "Post it on LinkedIn, university groups, your talent communities or anywhere else. Every application lands in one place.", tag: "You" },
  { icon: FileSearch, title: "AI analyses every CV", desc: "Skills, education, projects and experience are extracted and scored against the role, producing a ranked shortlist.", tag: "AI" },
  { icon: MessagesSquare, title: "AI screening interview", desc: "Shortlisted candidates complete a first-round interview assessing communication, motivation and role understanding.", tag: "AI" },
  { icon: Code2, title: "AI technical interview", desc: "Role-specific questions, personalised to each candidate's CV, test real technical depth.", tag: "AI" },
  { icon: ClipboardCheck, title: "Your team decides", desc: "A structured report combines CV match, screening and technical results with strengths and risks. People make the final call.", tag: "You" },
];

export default function PipelineSection() {
  const listRef = useRef(null);
  const [scrollFill, setFill] = useState(0);
  const reduced = useReducedMotion();
  const fill = reduced ? 1 : scrollFill;

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = listRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const anchor = window.innerHeight * 0.55;
      setFill(Math.min(1, Math.max(0, (anchor - r.top) / r.height)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-[var(--line)] bg-[#FBFAF9] py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:px-8">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="How it works"
            title={<>From job post to offer, <em>in six steps</em></>}
            subtitle="AI handles the repetitive early rounds. Your team spends its time on the shortlist that matters."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3 text-[13px] text-stone-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-ink" /> Your team
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-brand" /> Handled by AI
            </span>
          </div>
          <Link to="/register?role=company" className="btn-primary mt-8">
            Set up your first role <ArrowRight size={16} className="btn-arrow" />
          </Link>
        </div>

        <ol ref={listRef} className="relative">
          <span aria-hidden className="absolute bottom-6 left-[23px] top-6 w-px bg-stone-200" />
          <span
            aria-hidden
            className="absolute left-[23px] top-6 w-px origin-top bg-brand"
            style={{ height: "calc(100% - 48px)", transform: `scaleY(${fill})` }}
          />
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const reached = fill >= (i + 0.35) / STEPS.length;
            const ai = s.tag === "AI";
            return (
              <li key={s.title} className="relative flex gap-6 pb-10 last:pb-0">
                <span
                  className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 ease-[var(--ease-premium)] ${
                    reached
                      ? ai
                        ? "border-brand bg-brand text-white shadow-[0_10px_24px_-10px_rgba(240,78,35,0.7)]"
                        : "border-ink bg-ink text-white shadow-[0_10px_24px_-10px_rgba(13,13,13,0.6)]"
                      : "border-[var(--line)] bg-white text-stone-400"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <div
                  className={`surface surface-hover flex-1 p-5 transition-all duration-500 sm:p-6 ${
                    reached ? "opacity-100" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold tabular-nums text-stone-400">
                      Step {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        ai ? "bg-brand-soft text-brand" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {ai ? "AI" : "Your team"}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-[21px] font-medium tracking-[-0.015em] text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-stone-500">{s.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
