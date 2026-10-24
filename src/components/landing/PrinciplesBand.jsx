import { Eye, Scale, ShieldCheck, UserCheck } from "lucide-react";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import Reveal from "@/components/shared/Reveal";
import SectionHeading from "./SectionHeading";
import { ROLE_CATEGORIES } from "@/data/rolesData";

const ROLE_COUNT = ROLE_CATEGORIES.reduce((n, c) => n + c.roles.length, 0);

const STATS = [
  { value: ROLE_COUNT, suffix: "+", label: "Roles with tailored interviews" },
  { value: 3, label: "AI evaluation stages per candidate" },
  { value: 6, label: "Steps from job post to offer" },
  { value: 100, suffix: "%", label: "Of final decisions made by people" },
];

const PRINCIPLES = [
  { icon: UserCheck, title: "Human in control", desc: "AI recommends. Recruiters review, override and decide." },
  { icon: Scale, title: "Consistent evaluation", desc: "Every candidate answers comparable questions, scored on the same criteria." },
  { icon: Eye, title: "Explainable scores", desc: "Reports show why a candidate scored as they did, not just a number." },
  { icon: ShieldCheck, title: "Candidate respect", desc: "Interviews on their own time, with feedback instead of silence." },
];

export default function PrinciplesBand() {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-white sm:py-28">
      <div aria-hidden className="bg-dot-grid-light mask-radial pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(240,78,35,0.28),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <SectionHeading
          tone="light"
          eyebrow="Our principle"
          title={<>AI assists. <em>People decide.</em></>}
          subtitle="IntelliHire is built to remove the repetitive work from hiring, never the judgement."
        />

        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="bg-ink p-6 sm:p-8">
              <p className="font-display text-[44px] font-medium leading-none tracking-[-0.03em] sm:text-[56px]">
                <AnimatedCounter value={s.value} duration={1400} />
                <span className="text-brand">{s.suffix}</span>
              </p>
              <p className="mt-3 text-[14px] leading-snug text-white/55">{s.label}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
                  <Icon size={20} className="text-brand transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mt-4 font-sans text-[16px] font-semibold text-white">{p.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-white/55">{p.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
