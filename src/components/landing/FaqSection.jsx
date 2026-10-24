import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import Reveal from "@/components/shared/Reveal";
import SectionHeading from "./SectionHeading";

const FAQS = [
  { q: "What is IntelliHire?", a: "An AI interview and recruitment platform with two sides. Candidates practise role-specific mock interviews and get detailed feedback. Companies run an AI-assisted hiring pipeline, from CV analysis through screening and technical interviews to a structured evaluation report." },
  { q: "Does the AI decide who gets hired?", a: "No. The AI analyses, scores and recommends, but every shortlist and hiring decision is reviewed and made by your team. Reports explain each score so recruiters can agree, question or override it." },
  { q: "How does the hiring pipeline work?", a: "You create a role and share its generated application link. IntelliHire analyses each CV against your requirements, invites the strongest matches to an AI screening interview, then a CV-personalised technical interview, and compiles everything into one report per candidate." },
  { q: "What do candidates get from mock interviews?", a: "A realistic interview for the exact role they want, followed by feedback on communication, confidence and technical relevance, with clear strengths, weaknesses and suggestions for improvement." },
  { q: "What are talent communities?", a: "Focused groups such as university cohorts, alumni networks or skill-based pools, where companies can share opportunities with the right audience and build a long-term hiring pipeline. It is a professional network, not a social feed." },
  { q: "How quickly can a company get started?", a: "Create a company account in a couple of minutes. Each new company is reviewed before it can post roles; once approved, you can publish your first role straight away." },
];

function Item({ item, open, onToggle }) {
  const id = useId();
  return (
    <div className={`surface overflow-hidden transition-colors ${open ? "border-brand/30" : ""}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
        >
          <span className="text-[16px] font-semibold text-ink">{item.q}</span>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-[var(--ease-premium)] ${
              open ? "rotate-45 border-brand bg-brand text-white" : "border-[var(--line)] text-stone-500"
            }`}
          >
            <Plus size={16} />
          </span>
        </button>
      </h3>
      <div id={id} role="region" className="accordion-panel" data-open={open}>
        <div>
          <p className="px-6 pb-6 text-[15px] leading-relaxed text-stone-500">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-[var(--line)] bg-[#FBFAF9] py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16 lg:px-8">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="FAQ"
            title={<>Questions, <em>answered</em></>}
            subtitle="Everything you need to know before your first interview or your first role."
          />
          <Reveal delay={240}>
            <Link to="/register" className="btn-secondary mt-8">
              Create a free account <ArrowRight size={16} className="btn-arrow" />
            </Link>
          </Reveal>
        </div>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 50}>
              <Item item={f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
