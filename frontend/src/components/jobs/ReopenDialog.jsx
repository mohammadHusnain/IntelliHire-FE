import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { fromDateTimeInput } from "@/lib/jobMap";

/**
 * Asks for the new deadline of a closed job. The date-time is typed in the person's own time zone and sent as an instant.
 * `onConfirm(isoDeadline)`; `error` is the server's message about the deadline (1 hour to 6 months rules live on the server).
 */
export default function ReopenDialog({ title, busy, error, onConfirm, onClose }) {
  const [value, setValue] = useState("");
  const [local, setLocal] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    const iso = fromDateTimeInput(value);
    if (!iso) return setLocal("Choose the new deadline");
    setLocal("");
    onConfirm(iso);
  };

  const message = local || error;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Reopen ${title}`}>
      <button type="button" aria-label="Close" onClick={() => !busy && onClose()} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <form onSubmit={submit} noValidate className="animate-modal-in relative w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">
        <h2 className="display text-[24px]">Reopen {title}?</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-500">It keeps the same application link and accepts applications again until the new deadline (between 1 hour and about 6 months from now).</p>
        <label htmlFor="reopen-deadline" className="mb-1.5 mt-5 block text-[13px] font-medium text-stone-700">New deadline</label>
        <input id="reopen-deadline" type="datetime-local" value={value} onChange={(e) => { setValue(e.target.value); setLocal(""); }} aria-invalid={message ? "true" : undefined} className="field" autoFocus />
        {message && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{message}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Loader2 size={16} className="animate-spin" />} Reopen
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
