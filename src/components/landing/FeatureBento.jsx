import { FileText, Link2, Mic, Users, BarChart3, Copy } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "@/components/shared/Reveal";
import { trackSpotlight } from "@/lib/spotlight";
import { COMMUNITIES } from "@/data/communitiesData";

function Tile({ className = "", delay = 0, icon: Icon, title, desc, children }) {
  return (
    <Reveal delay={delay} className={`min-w-0 ${className}`}>
      <article
        onMouseMove={trackSpotlight}
        className="spotlight surface surface-hover group flex h-full flex-col overflow-hidden"
      >
        <div className="p-6 sm:p-7">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
            <Icon size={19} />
          </span>
          <h3 className="mt-5 font-display text-[22px] font-medium tracking-[-0.015em] text-ink">{title}</h3>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-stone-500">{desc}</p>
        </div>
        <div className="mt-auto px-6 pb-6 sm:px-7 sm:pb-7">{children}</div>
      </article>
    </Reveal>
  );
}

function ReportMock() {
  const rows = [
    ["CV match", 94],
    ["Screening interview", 86],
    ["Technical interview", 89],
  ];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#FBFAF9] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://api.dicebear.com/9.x/notionists/svg?seed=SaraKhan&backgroundColor=fde8e4"
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 rounded-full border border-white bg-white shadow-sm"
          />
          <div>
            <p className="text-[14px] font-semibold text-ink">Sara Khan</p>
            <p className="text-[12px] text-stone-500">Senior Frontend Developer</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Recommended</span>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-[12px]">
              <span className="text-stone-500">{k}</span>
              <span className="font-semibold tabular-nums text-ink">{v}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200/70">
              <div
                className="h-full origin-left rounded-full bg-gradient-to-r from-brand to-[#FF7A50] transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-x-[1.02]"
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {["Clear communicator", "Strong React depth", "System design"].map((t) => (
          <span key={t} className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            + {t}
          </span>
        ))}
        <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700">
          ~ Limited testing experience
        </span>
      </div>
    </div>
  );
}

function WaveMock() {
  const bars = [6, 14, 22, 12, 28, 18, 32, 20, 10, 24, 16, 30, 12, 20, 8, 18, 26, 14];
  return (
    <div className="rounded-2xl bg-ink p-4 text-white">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Recording
        </span>
        <span className="tabular-nums text-white/50">02:14</span>
      </div>
      <div className="mt-4 flex h-9 items-center justify-between gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-full rounded-full bg-brand"
            style={{
              height: h,
              opacity: 0.45 + (h / 32) * 0.55,
              animation: `floatY ${1.4 + (i % 5) * 0.25}s ease-in-out ${i * -0.12}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-snug text-white/60">
        &ldquo;Walk me through how you would structure state in a large React app.&rdquo;
      </p>
    </div>
  );
}

function CvMock() {
  const skills = ["React", "TypeScript", "Node.js", "GraphQL", "AWS", "CI/CD"];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[#FBFAF9] p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium text-stone-500">
        <FileText size={14} className="text-brand" /> ahmed-hassan-cv.pdf
        <span className="ml-auto text-emerald-600">Parsed</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skills.map((s, i) => (
          <span
            key={s}
            className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-all duration-300 group-hover:-translate-y-0.5"
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function CommunityMock() {
  return (
    <ul className="space-y-2">
      {COMMUNITIES.slice(0, 3).map((c) => (
        <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-2.5 pr-3 transition-colors group-hover:border-stone-200">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
            style={{ background: c.avatarBg }}
          >
            {c.avatar}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
            <span className="block text-[11px] text-stone-500">{c.category}</span>
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-stone-600">{c.members.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function LinkMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-1.5 pl-3">
        <Link2 size={15} className="shrink-0 text-brand" />
        <span className="truncate text-[13px] text-stone-600">intellihire.ai/apply/frontend-developer</span>
        <span className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-semibold text-white">
          <Copy size={12} /> Copy
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {["LinkedIn", "University groups", "Communities", "Direct link"].map((c) => (
          <span key={c} className="rounded-full bg-stone-100 px-3 py-1 text-[12px] font-medium text-stone-600">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FeatureBento() {
  return (
    <section id="features" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title={<>Everything between the application <em>and the offer</em></>}
          subtitle="Purpose-built tools for each stage, designed to work together rather than bolted on."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Tile
            className="md:col-span-6 lg:col-span-4 lg:row-span-2"
            icon={BarChart3}
            title="Evaluation reports your team can trust"
            desc="Every candidate gets one structured report: CV match, screening and technical performance, strengths, risks and an AI recommendation, ready for a human decision."
          >
            <ReportMock />
          </Tile>
          <Tile
            className="md:col-span-3 lg:col-span-2"
            delay={80}
            icon={Mic}
            title="Realistic AI interview room"
            desc="Spoken answers, follow-up questions and a natural pace."
          >
            <WaveMock />
          </Tile>
          <Tile
            className="md:col-span-3 lg:col-span-2"
            delay={160}
            icon={FileText}
            title="CV analysis in seconds"
            desc="Skills and experience extracted and matched to the role."
          >
            <CvMock />
          </Tile>
          <Tile
            className="md:col-span-3"
            delay={80}
            icon={Users}
            title="Talent communities"
            desc="Build long-term pipelines with university, alumni and skill-based groups."
          >
            <CommunityMock />
          </Tile>
          <Tile
            className="md:col-span-3"
            delay={160}
            icon={Link2}
            title="Shareable application forms"
            desc="One link per role, generated from the fields you define."
          >
            <LinkMock />
          </Tile>
        </div>
      </div>
    </section>
  );
}
