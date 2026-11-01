import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, Check, CheckCircle2, ChevronDown,
  Clock, Download, FileSearch, Gauge, Lightbulb, MessageSquareText, Minus, PartyPopper, RotateCcw,
  Target, Trash2, X,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, ScoreRing } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate, formatDuration, scoreTone, toneFor } from "@/lib/candidateStats";
import { DIMENSION_LABEL } from "@/lib/interview/evaluate";
import { toast } from "@/store/toastStore";

const KIND_LABEL = { general: "Behavioural", technical: "Technical", "role-specific": "Role scenario" };
const NOTE_ICON = { good: CheckCircle2, warn: AlertCircle, tip: Lightbulb };
const NOTE_TONE = { good: "text-emerald-600", warn: "text-amber-600", tip: "text-brand" };

function Delta({ value, suffix = "" }) {
  if (value == null) return null;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone = value > 0 ? "text-emerald-600 bg-emerald-50" : value < 0 ? "text-red-600 bg-red-50" : "text-stone-500 bg-stone-100";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
      <Icon size={12} />
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function QuestionItem({ q, answer, result, index, open, onToggle }) {
  const tone = result.skipped ? "danger" : toneFor(result.score);
  const m = result.metrics;
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-colors duration-300 ${open ? "border-brand/30 shadow-[0_12px_30px_-20px_rgba(13,13,13,0.3)]" : "border-[var(--line)]"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left sm:items-center sm:gap-4 sm:p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-[12.5px] font-semibold text-stone-600">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">{KIND_LABEL[q.kind]}</span>
          <span className="mt-0.5 block text-[14.5px] font-medium leading-snug text-ink">{q.text}</span>
        </span>
        <Badge tone={tone} className="shrink-0 tabular-nums">{result.skipped ? "Skipped" : `${result.score}/100`}</Badge>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-stone-400 transition-transform duration-300 sm:mt-0 ${open ? "rotate-180" : ""} print:hidden`} />
      </button>
      <div className="accordion-panel print:!grid print:!opacity-100 print:![grid-template-rows:1fr]" data-open={open}>
        <div>
          <div className="space-y-4 border-t border-[var(--line)] px-4 pb-5 pt-4 sm:px-5">
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Your answer</p>
              {result.skipped ? (
                <p className="text-[14px] italic text-stone-400">No answer recorded.</p>
              ) : (
                <p className="whitespace-pre-line rounded-xl bg-stone-50 p-4 text-[14px] leading-relaxed text-stone-700">{answer.text}</p>
              )}
            </div>
            {!result.skipped && (
              <div className="flex flex-wrap gap-2 text-[12px]">
                <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-stone-600">{m.words} words</span>
                {m.wpm && <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-stone-600">{m.wpm} words/min</span>}
                <span className={`rounded-full border px-2.5 py-1 ${m.fillers > 3 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-[var(--line)] text-stone-600"}`}>{m.fillers} fillers</span>
                {[["S", "Situation", m.star.s], ["A", "Action", m.star.a], ["R", "Result", m.star.r]].map(([k, label, on]) => (
                  <span key={k} title={label} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[var(--line)] text-stone-400"}`}>
                    {on ? <Check size={12} /> : <X size={12} />} {label}
                  </span>
                ))}
                {m.quantified && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">Quantified</span>}
              </div>
            )}
            <ul className="space-y-2">
              {result.notes.map((n) => {
                const Icon = NOTE_ICON[n.tone] || Lightbulb;
                return (
                  <li key={n.text} className="flex gap-2.5 text-[13.5px] leading-snug text-stone-600">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${NOTE_TONE[n.tone]}`} /> {n.text}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewReport() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessions } = useCandidateRecord();
  const { deleteSession } = useCandidateActions();
  const [open, setOpen] = useState(0);
  const [showBanner, setShowBanner] = useState(!!location.state?.fresh);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = sessions.find((s) => s.id === id);
  const previous = useMemo(
    () =>
      session
        ? [...sessions].filter((s) => s.role === session.role && s.completedAt < session.completedAt).sort((a, b) => b.completedAt - a.completedAt)[0]
        : null,
    [sessions, session],
  );

  if (!session) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Report not found"
        message="This report doesn't exist or was deleted. Your other reports are still available."
        action={
          <Link to="/candidate/reports" className="btn-primary">
            Back to reports <ArrowRight size={15} className="btn-arrow" />
          </Link>
        }
      />
    );
  }

  const { summary } = session;
  const delta = previous ? summary.overall - previous.summary.overall : null;
  const retakeUrl = `/candidate/interview/setup?type=${session.type}&role=${encodeURIComponent(session.role)}&difficulty=${session.difficulty}&length=${session.questions.length}`;
  const verdictTone = toneFor(summary.overall);

  const remove = () => {
    deleteSession(session.id);
    toast({ type: "success", title: "Report deleted", message: `${session.role} · ${formatDate(session.completedAt)} was removed.` });
    navigate("/candidate/reports", { replace: true });
  };

  return (
    <div className="space-y-6">
      {showBanner && (
        <div className="animate-fade-in-up flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 print:hidden">
          <span className="animate-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
            <PartyPopper size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">Interview complete</p>
            <p className="text-[13px] text-stone-600">Your report is saved to Reports. Here is how you did.</p>
          </div>
          <button type="button" onClick={() => setShowBanner(false)} aria-label="Dismiss" className="icon-btn flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-white hover:text-ink">
            <X size={15} />
          </button>
        </div>
      )}

      <Reveal y={10} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Interview report</p>
          <h1 className="display text-[30px] sm:text-[36px]">{session.role}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-stone-500">
            <span className="inline-flex items-center gap-1.5"><Target size={14} /> {TYPE_LABEL[session.type]} · {DIFFICULTY_LABEL[session.difficulty]}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar size={14} /> {formatDate(session.completedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {formatDuration(session.durationSec)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete report" className="icon-btn flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-[var(--line)] bg-white text-stone-500 hover:border-red-200 hover:text-red-600">
            <Trash2 size={16} />
          </button>
          <button type="button" onClick={() => window.print()} className="btn-secondary">
            <Download size={16} /> Download PDF
          </button>
          <Link to={retakeUrl} className="btn-primary">
            <RotateCcw size={16} /> Retake
          </Link>
        </div>
      </Reveal>

      {confirmDelete && (
        <div className="animate-fade-in-up flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center print:hidden">
          <p className="flex-1 text-[14px] text-red-800">Delete this report permanently? Your score history will update.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={remove} className="btn-dark !bg-red-600 hover:!bg-red-700">Delete report</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <Reveal>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl print:hidden" />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex justify-center">
              <ScoreRing score={summary.overall} size={168} stroke={12} label="overall" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={verdictTone}>{summary.verdict.label}</Badge>
                {previous && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-stone-500">
                    <Delta value={delta} /> vs your last {session.role} interview
                  </span>
                )}
              </div>
              <h2 className="display mt-3 text-[24px] sm:text-[28px]">{summary.verdict.text}</h2>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: MessageSquareText, label: "Answered", value: `${summary.stats.answered}/${session.questions.length}` },
                  { icon: FileSearch, label: "Words spoken", value: summary.stats.totalWords.toLocaleString() },
                  { icon: Gauge, label: "Avg pace", value: summary.stats.avgPace ? `${summary.stats.avgPace} wpm` : "Typed" },
                  { icon: AlertCircle, label: "Filler words", value: summary.stats.fillerTotal },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="rounded-2xl border border-[var(--line)] bg-stone-50/60 p-3.5">
                      <dt className="flex items-center gap-1.5 text-[12px] text-stone-500"><Icon size={13} /> {s.label}</dt>
                      <dd className="mt-1 text-[17px] font-semibold tabular-nums text-ink">{s.value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(summary.breakdown).map(([k, v], i) => (
          <Reveal key={k} delay={i * 70} className="min-w-0">
            <Card interactive className="h-full p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-stone-500">{DIMENSION_LABEL[k]}</p>
                {previous && <Delta value={v - previous.summary.breakdown[k]} />}
              </div>
              <p className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.03em] text-ink tabular-nums">
                {v}
                <span className="ml-0.5 text-[16px] text-stone-400">/100</span>
              </p>
              <ProgressBar className="mt-4" value={v} tone={scoreTone(v).bar} />
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={CheckCircle2} title="What went well" subtitle="Keep doing these" />
            <ul className="mt-5 space-y-3">
              {summary.strengths.length ? (
                summary.strengths.map((s) => (
                  <li key={s} className="flex gap-3 rounded-xl bg-emerald-50/60 p-3 text-[14px] leading-snug text-stone-700">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> {s}
                  </li>
                ))
              ) : (
                <li className="text-[14px] text-stone-500">Answer more questions to see your strengths.</li>
              )}
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={80} className="min-w-0">
          <Card className="h-full p-6">
            <CardHeader icon={Target} title="Focus areas" subtitle="Biggest gains from here" />
            <ul className="mt-5 space-y-3">
              {summary.focus.map((s) => (
                <li key={s} className="flex gap-3 rounded-xl bg-amber-50/60 p-3 text-[14px] leading-snug text-stone-700">
                  <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-600" /> {s}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card className="relative overflow-hidden !bg-ink p-6 text-white sm:p-8">
          <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50 print:hidden" />
          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-muted">
                <Lightbulb size={15} /> Your action plan
              </p>
              <ol className="mt-4 space-y-3">
                {summary.recommendations.map((r, i) => (
                  <li key={r} className="flex gap-3 text-[14.5px] leading-snug text-white/85">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold">{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
            <Link to={retakeUrl} className="btn-primary btn-lg print:hidden">
              Practise again <ArrowRight size={17} className="btn-arrow" />
            </Link>
          </div>
        </Card>
      </Reveal>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-[24px]">Question by question</h2>
            <p className="mt-1 text-[13.5px] text-stone-500">Open a question to see your answer, metrics and notes.</p>
          </div>
          <button type="button" onClick={() => setOpen(open === "all" ? -1 : "all")} className="hidden text-[13px] font-semibold text-stone-500 hover:text-brand sm:block print:hidden">
            {open === "all" ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div className="space-y-3">
          {session.questions.map((q, i) => (
            <Reveal key={q.id} delay={Math.min(i, 6) * 40}>
              <QuestionItem
                q={q}
                index={i}
                answer={session.answers[i]}
                result={session.results[i]}
                open={open === "all" || open === i}
                onToggle={() => setOpen(open === i ? -1 : i)}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <p className="text-center text-[12px] text-stone-400">
        Scores come from an instant analysis of your answers: length, pace, filler words, STAR structure, quantified results and role-skill coverage.
      </p>
    </div>
  );
}
