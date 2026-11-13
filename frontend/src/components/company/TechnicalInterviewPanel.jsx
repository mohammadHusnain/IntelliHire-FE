import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3, Eye, Loader2, RefreshCw, Send, X } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/app/primitives";
import { interviewsApi } from "@/api/interviewsApi";

const MANAGE_ROLES = ["admin", "hr_manager", "recruiter"];
const OVERRIDE_ROLES = ["admin", "hr_manager"];
const OPEN_STATUSES = ["invited", "in_progress", "interrupted"];
const FINISHED_STATUSES = ["completed", "incomplete", "evaluated", "evaluation_failed"];
const title = (value) => String(value || "").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function ApiMessage({ children }) {
  if (!children) return null;
  return <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{children}</p>;
}

function InterviewDetail({ value }) {
  const report = value.report || {};
  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      {value.ai_disclaimer && <p className="text-[12px] leading-relaxed text-stone-500">{value.ai_disclaimer}</p>}
      {report.summary ? (
        <div className="mt-3 space-y-3 text-[13.5px]">
          <p className="leading-relaxed text-stone-700">{report.summary}</p>
          {report.technical_relevance && <p><span className="font-semibold text-ink">Technical relevance:</span> {report.technical_relevance}</p>}
          {["strengths", "weaknesses"].map((key) => report[key]?.length > 0 && (
            <div key={key}>
              <h4 className="font-semibold text-ink">{title(key)}</h4>
              <ul className="mt-1 list-inside list-disc text-stone-600">{report[key].map((item, i) => <li key={`${key}-${i}`}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      ) : value.report_message ? (
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2.5 text-[13px] text-stone-600">{value.report_message}</p>
      ) : null}
      <h4 className="mt-4 text-[12px] font-semibold uppercase text-stone-400">Interview transcript</h4>
      {!value.turns?.length ? <p className="mt-2 text-[13px] text-stone-500">No answers have been recorded yet.</p> : (
        <ol className="mt-2 space-y-3">
          {value.turns.map((turn) => (
            <li key={turn.index} className="rounded-xl border border-[var(--line)] p-3.5">
              <p className="text-[13px] font-semibold text-ink">{turn.index}. {turn.question_text}{turn.is_follow_up && <Badge tone="warning" className="ml-2">Follow-up</Badge>}</p>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-stone-600">{turn.answer_text || "No answer recorded."}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-stone-500">
                {turn.score != null && <span>Score {turn.score}/10</span>}
                {turn.feedback && <span>{turn.feedback}</span>}
                {turn.topic && <span>Topic: {turn.topic}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function TechnicalInterviewPanel({ applicationId, memberRole }) {
  const canManage = MANAGE_ROLES.includes(memberRole);
  const canOverride = OVERRIDE_ROLES.includes(memberRole);
  const canReevaluate = canOverride;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [extendId, setExtendId] = useState("");
  const [extendDays, setExtendDays] = useState(7);

  const reload = useCallback(async (signal) => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await interviewsApi.listForApplication(applicationId, { signal });
      setSessions(result);
    } catch (cause) {
      if (cause.code !== "aborted") setLoadError(cause.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal);
    return () => controller.abort();
  }, [reload, reloadKey]);

  const screening = useMemo(() => sessions.find((session) => session.kind === "screening"), [sessions]);
  const technical = useMemo(() => sessions.filter((session) => session.kind === "technical"), [sessions]);
  const openTechnical = technical.some((session) => OPEN_STATUSES.includes(session.status));
  const screeningPassed = screening?.status === "evaluated" && screening.recommendation === "advance";
  const mayInvite = canManage && !openTechnical && (screeningPassed || canOverride);

  const invite = async (event) => {
    event.preventDefault();
    setError("");
    setWarning("");
    setInviteBusy(true);
    try {
      const result = await interviewsApi.invite(applicationId, {
        kind: "technical",
        expires_in_days: Number(expiresInDays),
        override,
        ...(override ? { note: note.trim() } : {}),
      });
      if (result.warnings?.length) setWarning(result.warnings.join(" "));
      setShowInvite(false);
      setOverride(false);
      setNote("");
      setReloadKey((x) => x + 1);
    } catch (cause) {
      setError(cause.fieldErrors?.note?.[0] || cause.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const runAction = async (id, action, successMessage = "") => {
    setError("");
    setActionBusy(`${id}:${action}`);
    try {
      await action();
      if (successMessage) setWarning(successMessage);
      setReloadKey((x) => x + 1);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setActionBusy("");
    }
  };

  const showDetail = async (session) => {
    if (expandedId === session.id) {
      setExpandedId("");
      setDetail(null);
      return;
    }
    setExpandedId(session.id);
    setDetail(null);
    setError("");
    setActionBusy(`${session.id}:detail`);
    try {
      setDetail(await interviewsApi.get(session.id));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setActionBusy("");
    }
  };

  const extend = async (sessionId) => {
    await runAction(sessionId, () => interviewsApi.extend(sessionId, Number(extendDays)), "Interview deadline extended.");
    setExtendId("");
  };

  return (
    <Card className="p-6">
      <CardHeader icon={CalendarClock} title="Technical interview" subtitle="Technical interview invitations and candidate responses" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
        <p className="text-[13px] text-stone-600">
          Screening: <span className="font-semibold text-ink">{screening ? `${title(screening.status)}${screening.recommendation ? ` · ${title(screening.recommendation)}` : ""}` : "Not started"}</span>
          {screeningPassed && <CheckCircle2 size={14} className="ml-1.5 inline text-emerald-600" />}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setReloadKey((x) => x + 1)} disabled={loading} aria-label="Refresh interview sessions" className="icon-btn" title="Refresh interviews"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
          {mayInvite && !showInvite && <button type="button" onClick={() => { setError(""); setShowInvite(true); }} className="btn-primary !h-9"><Send size={14} /> Invite to technical interview</button>}
        </div>
      </div>

      {!screeningPassed && canManage && !openTechnical && <p className="mt-3 text-[12.5px] text-stone-500">A technical interview is normally sent after an evaluated screening recommendation to advance. Only an admin or HR manager can override that prerequisite.</p>}

      {showInvite && (
        <form onSubmit={invite} className="mt-4 rounded-xl border border-[var(--line)] p-4">
          <h3 className="text-[14px] font-semibold text-ink">Send technical interview link</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <label className="text-[12.5px] font-medium text-stone-600">Link valid for
              <span className="mt-1 flex items-center gap-2"><input className="field !h-10 w-20" type="number" min="1" max="14" required value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} /><span>days</span></span>
            </label>
            {canOverride && !screeningPassed && (
              <div>
                <label className="flex min-h-10 items-center gap-2 text-[13px] font-medium text-stone-700"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override screening prerequisite</label>
                {override && <label className="mt-1 block text-[12.5px] font-medium text-stone-600">Reason for override<textarea className="field mt-1 !h-auto resize-y py-2.5" rows={2} required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>}
              </div>
            )}
          </div>
          <ApiMessage>{error}</ApiMessage>
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setShowInvite(false)} className="btn-secondary !h-9">Cancel</button><button type="submit" disabled={inviteBusy || (override && !note.trim())} className="btn-primary !h-9">{inviteBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} Send invitation</button></div>
        </form>
      )}

      <ApiMessage>{loadError || (!showInvite ? error : "")}</ApiMessage>
      {warning && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">{warning}</p>}

      {loading && sessions.length === 0 ? <div className="flex justify-center py-8"><Loader2 size={21} className="animate-spin text-brand" aria-label="Loading interviews" /></div> : technical.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-stone-300 p-5 text-center text-[13px] text-stone-500">No technical interview has been sent.</p>
      ) : (
        <ol className="mt-4 divide-y divide-[var(--line)]">
          {technical.map((session) => {
            const open = OPEN_STATUSES.includes(session.status);
            const busy = actionBusy.startsWith(`${session.id}:`);
            return (
              <li key={session.id} className="py-4 first:pt-1 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={open ? "warning" : session.status === "evaluated" ? "success" : "neutral"}>{title(session.status)}</Badge>{session.overall_score != null && <span className="text-[13px] font-semibold tabular-nums text-ink">{session.overall_score}/100</span>}</div>
                    <p className="mt-1.5 text-[12.5px] text-stone-500">Invited {date(session.invited_at)} · {session.answered_count}/{session.question_target} answered · expires {date(session.expires_at)}</p>
                    {session.status === "evaluated" && session.recommendation == null && <p className="mt-1 text-[12px] text-stone-500">No automatic hiring recommendation is made for technical interviews.</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => showDetail(session)} className="btn-secondary !h-8 !px-3 text-[12px]">{busy && actionBusy.endsWith(":detail") ? <Loader2 size={13} className="animate-spin" /> : expandedId === session.id ? <ChevronUp size={14} /> : <Eye size={14} />} {expandedId === session.id ? "Hide details" : "View details"}</button>
                    {canManage && open && <>
                      <button type="button" disabled={busy} onClick={() => runAction(session.id, () => interviewsApi.resend(session.id), "A fresh invitation link has been emailed.")} className="btn-secondary !h-8 !px-3 text-[12px]">Resend link</button>
                      <button type="button" disabled={busy} onClick={() => setExtendId(extendId === session.id ? "" : session.id)} className="btn-secondary !h-8 !px-3 text-[12px]"><Clock3 size={13} /> Extend</button>
                      <button type="button" disabled={busy} onClick={() => { if (window.confirm("Cancel this technical interview? Its candidate link will stop working.")) runAction(session.id, () => interviewsApi.cancel(session.id), "Technical interview cancelled."); }} aria-label="Cancel technical interview" className="icon-btn !h-8 !w-8 text-red-600" title="Cancel interview"><X size={15} /></button>
                    </>}
                    {canReevaluate && FINISHED_STATUSES.includes(session.status) && <button type="button" disabled={busy} onClick={() => runAction(session.id, () => interviewsApi.reevaluate(session.id), "Evaluation queued. Scores and report remain unavailable until the AI hooks are connected.")} className="btn-secondary !h-8 !px-3 text-[12px]">Re-evaluate</button>}
                  </div>
                </div>
                {extendId === session.id && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-[12px] font-medium text-stone-600">Add days<input type="number" min="1" max="14" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="field mt-1 !h-9 w-24" /></label><button type="button" disabled={busy || Number(extendDays) < 1 || Number(extendDays) > 14} onClick={() => extend(session.id)} className="btn-primary !h-9">Save extension</button></div>}
                {expandedId === session.id && (actionBusy === `${session.id}:detail` ? <div className="py-5"><Loader2 size={18} className="animate-spin text-brand" aria-label="Loading interview transcript" /></div> : detail?.id === session.id ? <InterviewDetail value={detail} /> : null)}
              </li>
            );
          })}
        </ol>
      )}
      {loading && sessions.length > 0 && <div className="mt-2 flex justify-end text-[12px] text-stone-400"><ChevronDown size={14} className="mr-1" /> Updating</div>}
    </Card>
  );
}
