// Invite one candidate to the AI screening interview (Module 7). The server only allows it for a
// shortlisted application unless an admin or HR manager overrides with a note; the UI mirrors that.
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/app/primitives";
import { interviewsApi } from "@/api/interviewsApi";
import { useRemote } from "@/hooks/useRemote";
import { toast } from "@/store/toastStore";

const INVITE_ROLES = ["admin", "hr_manager", "recruiter"];
const OVERRIDE_ROLES = ["admin", "hr_manager"];
const OPEN = ["invited", "in_progress", "interrupted"];
const ELIGIBLE = ["shortlisted", "interview"];
const label = (v) => String(v || "").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

export default function ScreeningInvitePanel({ applicationId, applicationStatus, memberRole }) {
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sessions = useRemote((o) => interviewsApi.listForApplication(applicationId, o), [applicationId, reload]);
  const screening = useMemo(() => (sessions.data || []).find((s) => s.kind === "screening"), [sessions.data]);
  const canInvite = INVITE_ROLES.includes(memberRole);
  const canOverride = OVERRIDE_ROLES.includes(memberRole);
  const eligible = ELIGIBLE.includes(applicationStatus);
  const blocked = screening && OPEN.includes(screening.status);
  const mayInvite = canInvite && !blocked && (eligible || canOverride);

  const send = async (event) => {
    event.preventDefault();
    if ((override || !eligible) && !note.trim()) return setError("Give a reason for inviting someone who is not shortlisted.");
    setBusy(true);
    setError("");
    try {
      const result = await interviewsApi.invite(applicationId, {
        kind: "screening",
        expires_in_days: Number(days),
        override: !eligible || override,
        ...(!eligible || override ? { note: note.trim() } : {}),
      });
      toast({ title: "Screening invitation sent", message: result.warnings?.length ? result.warnings.join(" ") : "The candidate was emailed a private link." });
      setOpen(false);
      setNote("");
      setReload((n) => n + 1);
    } catch (cause) {
      setError(cause.fieldErrors?.note?.[0] || cause.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader title="Screening interview" subtitle="A short AI-led interview the candidate takes from a private link." />
        {mayInvite && !open && (
          <button type="button" onClick={() => { setError(""); setOpen(true); }} className="btn-primary !h-9 text-[12.5px]"><Send size={14} /> Invite to screening</button>
        )}
      </div>
      {sessions.status === "loading" && !sessions.data ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-stone-500"><Loader2 size={14} className="animate-spin" /> Loading</p>
      ) : (
        <p className="mt-3 text-[13px] text-stone-600">
          {screening ? (
            <>Status: <span className="font-semibold text-ink">{label(screening.status)}</span>
              {screening.recommendation ? ` · ${label(screening.recommendation)}` : ""}
              {screening.status === "evaluated" && screening.recommendation === "advance" && <CheckCircle2 size={14} className="ml-1.5 inline text-emerald-600" />}
            </>
          ) : "Not invited yet."}
        </p>
      )}
      {sessions.status === "error" && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{sessions.error.message}</p>}
      {blocked && <p className="mt-2 text-[12.5px] text-stone-500">An invitation is already open, so another cannot be sent.</p>}
      {canInvite && !eligible && !blocked && !canOverride && (
        <p className="mt-2 text-[12.5px] text-stone-500">Shortlist this candidate first. Only an admin or HR manager can invite someone who is not shortlisted.</p>
      )}
      {open && (
        <form onSubmit={send} className="mt-4 space-y-3 rounded-xl border border-[var(--line)] p-4">
          <label className="block text-[12.5px] font-semibold text-stone-600">
            Link valid for (days, 1–14)
            <input type="number" min="1" max="14" value={days} onChange={(e) => setDays(e.target.value)} className="field mt-1.5 w-28" />
          </label>
          {eligible ? (
            canOverride && (
              <label className="flex items-center gap-2 text-[12.5px] text-stone-700">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Record a note with this invitation
              </label>
            )
          ) : (
            <Badge tone="warning">Not shortlisted: this is an override and needs a reason</Badge>
          )}
          {(override || !eligible) && (
            <label className="block text-[12.5px] font-semibold text-stone-600">
              Reason
              <textarea aria-label="Reason" value={note} rows={2} maxLength={500} onChange={(e) => { setNote(e.target.value); setError(""); }} className="field mt-1.5 !h-auto py-2" />
            </label>
          )}
          {error && <p role="alert" className="text-[12.5px] text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send invitation</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary !h-9 text-[12.5px]">Cancel</button>
          </div>
        </form>
      )}
    </Card>
  );
}
