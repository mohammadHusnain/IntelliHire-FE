// Reporting content (Module 13 §13.4). Anyone signed in can report a job, a community or a post;
// a visitor can report a public job through its form slug. The server deduplicates the same
// reporter and target within 24 hours and throttles hard, so a second report is not an error.
import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { reportsApi } from "@/api/platformAdminApi";
import { REASON_MAX, reasonError } from "@/lib/platformMap";

/**
 * `targetType` + `targetId` for a signed-in report, or `formSlug` for the public job form.
 * `variant="link"` renders a quiet text link instead of a button.
 */
export default function ReportButton({ targetType, targetId, formSlug, label = "Report", variant = "button", className = "" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const send = async () => {
    const problem = reasonError(reason);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      if (formSlug) await reportsApi.reportJob(formSlug, reason.trim());
      else await reportsApi.report(targetType, targetId, reason.trim());
      setDone(true);
      setOpen(false);
      setReason("");
    } catch (problem2) {
      setError(
        problem2.status === 429
          ? problem2.retryAfterSeconds
            ? `Too many reports. Try again in ${problem2.retryAfterSeconds} seconds.`
            : "Too many reports from here. Please wait a moment."
          : problem2.message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p role="status" className={`text-[12px] text-stone-500 ${className}`}>
        Thank you — a platform admin will look at this.
      </p>
    );
  }

  if (!open) {
    return variant === "link" ? (
      <button type="button" onClick={() => setOpen(true)} className={`text-[12px] text-stone-400 underline hover:text-stone-600 ${className}`}>
        {label}
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className={`btn-secondary !h-9 text-[12.5px] ${className}`}>
        <Flag size={14} /> {label}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-[var(--line)] bg-white p-3 ${className}`}>
      <label className="block text-[12px] font-semibold text-stone-600">
        What is wrong with this?
        <textarea
          value={reason}
          rows={3}
          maxLength={REASON_MAX}
          onChange={(e) => { setReason(e.target.value); setError(""); }}
          className="field mt-1.5 !h-auto py-2.5"
          placeholder="Tell us what a platform admin should look at."
          autoFocus
        />
      </label>
      {error && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={send} disabled={busy} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Send report
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="btn-secondary !h-9 text-[12.5px]">Cancel</button>
      </div>
    </div>
  );
}
