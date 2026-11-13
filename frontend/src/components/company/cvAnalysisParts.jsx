// The pieces that render one CV analysis (Module 6). Shared by the ranking drawer on the CV
// analysis page and the panel on a candidate's profile, so the two can never drift apart.
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge, Card, ProgressBar } from "@/components/app/primitives";
import { AI_NOTICE, analysisStateLabel, cvLabel, cvLabelTone, scoreBarTone, scoreText } from "@/lib/cvMap";

/** The four parts of the score, in the order the guide lists them. */
const SCORE_PARTS = [
  ["Skills", "skills_score"],
  ["Experience", "experience_score"],
  ["Education", "education_score"],
  ["Semantic fit", "semantic_score"],
];

export function ScoreLine({ label, value }) {
  const number = Number(value || 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-stone-600">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{scoreText(value)}</span>
      </div>
      <ProgressBar value={number} tone={scoreBarTone(number)} />
    </div>
  );
}

/** The overall score with the screening label the server derived for it. */
export function ScoreSummary({ match, label }) {
  return (
    <section className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase text-stone-400">CV match</p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums text-ink">{match ? `${scoreText(match.score)}%` : "—"}</p>
      </div>
      {label && <Badge tone={cvLabelTone(label)}>{cvLabel(label)}</Badge>}
    </section>
  );
}

export function ScoreBreakdown({ match }) {
  if (!match) return null;
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-ink">Score breakdown</h3>
      <div className="mt-3 space-y-3">
        {SCORE_PARTS.map(([label, key]) => <ScoreLine key={key} label={label} value={match[key]} />)}
      </div>
      {match.weights_used && (
        <p className="mt-2 text-[11.5px] text-stone-400">
          Weighted {match.weights_used.weight_skills}/{match.weights_used.weight_experience}/{match.weights_used.weight_education}/{match.weights_used.weight_semantic}
        </p>
      )}
    </section>
  );
}

/** Matched and missing skills as chips, which is how the guide's §6.5 asks for them. */
export function SkillChips({ title, values = [], tone }) {
  return (
    <section>
      <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">{values.map((skill) => <Badge key={skill} tone={tone}>{skill}</Badge>)}</div>
      ) : (
        <p className="mt-1 text-[12px] text-stone-400">None recorded</p>
      )}
    </section>
  );
}

/** The model's two or three sentences, never without the notice next to them. */
export function AiExplanation({ match }) {
  if (!match?.explanation) return null;
  return (
    <section className="rounded-xl border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-ink">Match explanation</h3>
        <Badge tone="warning">{AI_NOTICE}</Badge>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-stone-600">{match.explanation}</p>
    </section>
  );
}

/** §6.6: a score computed before the role's requirements or weights last changed. */
export function StaleWarning({ children = "This score was computed before the role's requirements or weights last changed." }) {
  return (
    <p className="flex items-start gap-2 text-[12px] text-amber-800">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

export function AnalysisStateBadge({ status }) {
  const tone = status === "failed" ? "danger" : status === "manual_review" ? "warning" : status === "completed" ? "success" : "neutral";
  return <Badge tone={tone}>{analysisStateLabel(status)}</Badge>;
}

export function ParsedEntries({ title, values = [], render }) {
  if (!values?.length) return null;
  return (
    <section>
      <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-2">
        {values.map((value, index) => (
          <li key={`${title}-${index}`} className="rounded-lg border border-[var(--line)] px-3 py-2 text-[12px] leading-relaxed text-stone-600">
            {render(value)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ParsedSection({ title, values = [] }) {
  return <ParsedEntries title={title} values={values} render={(value) => value} />;
}

/** Everything the extraction read out of the CV. */
export function ParsedCv({ parsed = {} }) {
  return (
    <>
      <ParsedSection title="Technical skills" values={parsed.technical_skills} />
      <ParsedSection title="Soft skills" values={parsed.soft_skills} />
      <ParsedEntries title="Education" values={parsed.education} render={(item) => [item.degree, item.institution, item.year, item.level].filter(Boolean).join(" · ")} />
      <ParsedEntries title="Experience" values={parsed.experience} render={(item) => [item.role, item.company, item.start && item.end ? `${item.start}–${item.end}` : item.start || item.end, item.summary].filter(Boolean).join(" · ")} />
      <ParsedEntries title="Projects" values={parsed.projects} render={(item) => [item.name, item.summary].filter(Boolean).join(" · ")} />
      <ParsedSection title="Achievements" values={parsed.achievements} />
    </>
  );
}

export function ReviewFlags({ flags = [] }) {
  if (!flags.length) return null;
  return (
    <section>
      <h3 className="text-[12.5px] font-semibold text-ink">Review flags</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flags.map((flag) => <Badge key={flag} tone="warning">{flag.replaceAll("_", " ")}</Badge>)}
      </div>
    </section>
  );
}

export function Loading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-stone-500">
      <Loader2 size={18} className="animate-spin text-brand" /> <span>{label}</span>
    </div>
  );
}

export function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <Card className="p-6">
      <div role="alert" className="py-8 text-center">
        <p className="text-[14px] text-stone-600">{message}</p>
        <button type="button" onClick={onRetry} className="btn-secondary mt-4">Try again</button>
      </div>
    </Card>
  );
}
