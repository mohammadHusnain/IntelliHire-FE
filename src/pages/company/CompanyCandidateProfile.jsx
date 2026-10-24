import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Briefcase, Building2, Check, FileText, GraduationCap, Mail, MessageSquareText,
  Phone, Send, Sparkles, UserX, X,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, ScoreRing } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import { PIPELINE, PIPELINE_META, useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { formatDate, relativeTime, scoreTone } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

function QA({ items, title }) {
  if (!items?.length) return null;
  return (
    <div className="mt-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">{title}</p>
      <ul className="mt-3 space-y-3">
        {items.map((qa, i) => (
          <li key={i} className="rounded-2xl border border-[var(--line)] p-4">
            <p className="text-[13.5px] font-semibold text-ink">{qa.q}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">{qa.a}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CompanyCandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = useCompanyRecord();
  const { setStage, addNote } = useCompanyActions();
  const [note, setNote] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);

  const a = record.applicants.find((x) => x.id === id);
  const job = a ? record.jobs.find((j) => j.id === a.jobId) : null;
  const notes = record.notes[id] || [];

  const scores = useMemo(() => {
    if (!a) return [];
    return [
      { label: "CV match", value: a.cvScore },
      { label: "Screening interview", value: a.screeningScore },
      { label: "Technical interview", value: a.technicalScore },
    ].filter((s) => typeof s.value === "number");
  }, [a]);

  const composite = scores.length ? Math.round(scores.reduce((n, s) => n + s.value, 0) / scores.length) : 0;

  if (!a) {
    return (
      <EmptyState
        icon={UserX}
        title="Candidate not found"
        message="This candidate may have been removed with their role."
        action={<Link to={ROUTES.COMPANY.CANDIDATES} className="btn-primary">Back to candidates <ArrowRight size={15} className="btn-arrow" /></Link>}
      />
    );
  }

  const stageIndex = PIPELINE.indexOf(a.stage);
  const nextStage = stageIndex >= 0 && stageIndex < PIPELINE.length - 1 ? PIPELINE[stageIndex + 1] : null;

  const move = (stage) => {
    setStage(a.id, stage);
    toast({ title: `${a.name} moved to ${stage}`, message: "Their pipeline history was updated." });
  };

  const reject = (reason) => {
    setStage(a.id, "Rejected", reason);
    setConfirmReject(false);
    toast({ type: "warning", title: `${a.name} marked as not proceeding`, message: "They stay searchable under Not proceeding." });
    navigate(ROUTES.COMPANY.CANDIDATES);
  };

  const submitNote = (e) => {
    e.preventDefault();
    if (note.trim().length < 2) return;
    addNote(a.id, note.trim());
    setNote("");
    toast({ title: "Note saved", message: `Added to ${a.name}'s profile for your team.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={job?.title || "Candidate"}
        title={<>{a.name}</>}
        subtitle={`Applied ${formatDate(a.appliedAt)} · via ${a.source}`}
        actions={
          <>
            <Link to={ROUTES.COMPANY.CANDIDATES} className="btn-secondary">
              <ArrowLeft size={16} /> All candidates
            </Link>
            {a.stage !== "Rejected" && nextStage && (
              <button type="button" onClick={() => move(nextStage)} className="btn-primary">
                Move to {nextStage} <ArrowRight size={16} className="btn-arrow" />
              </button>
            )}
          </>
        }
      />

      <Reveal>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-3">
              <ScoreRing score={composite} size={140} stroke={11} label="overall" />
              <Badge tone={PIPELINE_META[a.stage]?.tone || "neutral"}>{a.stage}</Badge>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold text-ink">{a.name}</p>
                  <p className="truncate text-[13px] text-stone-500">{a.experience} experience</p>
                </div>
              </div>
              {a.summary && <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-[14px] leading-relaxed text-stone-700">{a.summary}</p>}
              <ul className="mt-5 space-y-3">
                {scores.map((s) => (
                  <li key={s.label}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="font-medium text-stone-600">{s.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{s.value}/100</span>
                    </div>
                    <ProgressBar value={s.value} tone={scoreTone(s.value).bar} />
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3 text-[13px]">
                <a href={`mailto:${a.email}`} className="link-brand inline-flex items-center gap-1.5"><Mail size={13} /> {a.email}</a>
                {a.phone && <span className="inline-flex items-center gap-1.5 text-stone-500"><Phone size={13} /> {a.phone}</span>}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Stage control */}
      <Reveal>
        <Card className="p-6">
          <CardHeader icon={Sparkles} title="Pipeline stage" subtitle="Move them forward, or mark them as not proceeding" />
          <div className="mt-5 flex flex-wrap gap-2">
            {PIPELINE.map((s) => {
              const on = a.stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => move(s)}
                  aria-pressed={on}
                  className={`h-10 rounded-xl border px-4 text-[13px] font-semibold transition-all duration-200 ${
                    on ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600 hover:border-stone-300 hover:text-ink"
                  }`}
                >
                  {on && <Check size={14} className="mr-1.5 inline" />}
                  {s}
                </button>
              );
            })}
            {a.stage !== "Rejected" ? (
              <button type="button" onClick={() => setConfirmReject(true)} className="btn-secondary !h-10 hover:!border-red-300 hover:!text-red-600">
                <X size={15} /> Not proceeding
              </button>
            ) : (
              <Badge tone="danger" className="h-10 px-4">Not proceeding</Badge>
            )}
          </div>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          {(a.matchedSkills.length > 0 || a.unmatchedSkills.length > 0) && (
            <Reveal>
              <Card className="p-6">
                <CardHeader icon={Briefcase} title="Skills against this role" subtitle={job ? `Required for ${job.title}` : "Role removed"} />
                <div className="mt-5 space-y-4">
                  {a.matchedSkills.length > 0 && (
                    <div>
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-emerald-600">Matched</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a.matchedSkills.map((s) => (
                          <span key={s} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12.5px] font-medium text-emerald-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.unmatchedSkills.length > 0 && (
                    <div>
                      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-amber-600">Gaps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a.unmatchedSkills.map((s) => (
                          <span key={s} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12.5px] font-medium text-amber-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>
          )}

          {(a.screeningQA.length > 0 || a.technicalQA.length > 0) && (
            <Reveal>
              <Card className="p-6">
                <CardHeader icon={MessageSquareText} title="Interview answers" subtitle="What they said in each round" />
                <QA items={a.screeningQA} title="Screening" />
                <QA items={a.technicalQA} title="Technical" />
              </Card>
            </Reveal>
          )}

          {(a.work.length > 0 || a.education.length > 0) && (
            <Reveal>
              <Card className="p-6">
                <CardHeader icon={FileText} title="Background" subtitle="From their CV" />
                {a.work.length > 0 && (
                  <ul className="mt-5 space-y-3">
                    {a.work.map((w, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><Building2 size={16} /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink">{w.role}</span>
                          <span className="block truncate text-[12.5px] text-stone-500">{w.company} · {w.duration}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {a.education.length > 0 && (
                  <ul className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
                    {a.education.map((e, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><GraduationCap size={16} /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink">{e.degree}</span>
                          <span className="block truncate text-[12.5px] text-stone-500">{e.institution} · {e.year}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Reveal>
          )}
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          <Reveal delay={80}>
            <Card className="p-6">
              <CardHeader icon={MessageSquareText} title="Team notes" subtitle="Only your team can see these" />
              <form onSubmit={submitNote} className="mt-5">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 400))}
                  rows={3}
                  placeholder="What stood out? Anything to check in the next round?"
                  className="field !h-auto resize-none py-3 leading-relaxed"
                  aria-label="Add a note"
                />
                <button type="submit" disabled={note.trim().length < 2} className="btn-primary mt-2 w-full disabled:opacity-50">
                  <Send size={15} /> Add note
                </button>
              </form>
              {notes.length > 0 && (
                <ul className="mt-5 space-y-3 border-t border-[var(--line)] pt-5">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-xl bg-stone-50 p-3">
                      <p className="text-[13.5px] leading-relaxed text-stone-700">{n.text}</p>
                      <p className="mt-1.5 text-[11.5px] text-stone-400">{relativeTime(n.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={140}>
            <Card className="p-6">
              <CardHeader icon={Sparkles} title="Stage history" subtitle="How they moved through the pipeline" />
              <ol className="mt-5 space-y-4">
                {[...a.history].reverse().map((h, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="relative flex flex-col items-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-brand" : "bg-stone-300"}`} />
                      {i < a.history.length - 1 && <span className="mt-1 w-px flex-1 bg-stone-200" />}
                    </span>
                    <span className="min-w-0 flex-1 pb-1">
                      <span className="block text-[13.5px] font-semibold text-ink">{h.stage}</span>
                      {h.note && <span className="block text-[12.5px] text-stone-500">{h.note}</span>}
                      <span className="block text-[11.5px] text-stone-400">{formatDate(h.at, { day: "numeric", month: "short" })}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </Reveal>
        </div>
      </div>

      {confirmReject && (
        <ActionDialog
          title={`Mark ${a.name} as not proceeding?`}
          message="They move out of the active pipeline. You can still find them under Not proceeding."
          confirmLabel="Confirm"
          tone="danger"
          requireReason
          onConfirm={reject}
          onClose={() => setConfirmReject(false)}
        />
      )}
    </div>
  );
}
