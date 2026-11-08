import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { APPLICATION_STATUSES, LIMITS, statusLabel } from "@/lib/applicationMap";

/**
 * Change the status of one application (or of several: `count`). The current status is not offered (the server refuses
 * "the same status"). `onConfirm(status, note)`; `error` is the server's refusal, shown inside the dialog.
 */
export default function StatusDialog({ title, current = null, initial = "", count = 1, busy, error, onConfirm, onClose }) {
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState("");
  const [local, setLocal] = useState("");
  const options = APPLICATION_STATUSES.filter((s) => s.value !== current);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (!status) return setLocal("Choose the new status");
    setLocal("");
    onConfirm(status, note.trim());
  };

  const message = local || error;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={() => !busy && onClose()} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <form onSubmit={submit} noValidate className="animate-modal-in relative w-full max-w-[480px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">
        <h2 className="display text-[24px]">{title}</h2>
        {current && <p className="mt-1 text-[13.5px] text-stone-500">Now: {statusLabel(current)}</p>}
        <label htmlFor="status-new" className="mb-1.5 mt-5 block text-[13px] font-medium text-stone-700">{count > 1 ? `New status for ${count} candidates` : "New status"}</label>
        <select id="status-new" value={status} onChange={(e) => { setStatus(e.target.value); setLocal(""); }} aria-invalid={message ? "true" : undefined} className="field cursor-pointer" autoFocus>
          <option value="">Choose…</option>
          {options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label htmlFor="status-note" className="mb-1.5 mt-4 flex items-baseline justify-between text-[13px] font-medium text-stone-700">
          <span>Note <span className="font-normal text-stone-400">(optional, kept in the history)</span></span>
          <span className="text-[12px] font-normal text-stone-400">{note.length}/{LIMITS.statusNote}</span>
        </label>
        <textarea id="status-note" rows={3} maxLength={LIMITS.statusNote} value={note} onChange={(e) => setNote(e.target.value)} className="field !h-auto resize-none py-3" />
        {message && <p role="alert" className="mt-2 text-[12.5px] text-red-600">{message}</p>}
        <p className="mt-3 text-[12px] text-stone-500">The candidate is not notified by email.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy && <Loader2 size={16} className="animate-spin" />} Update status</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
