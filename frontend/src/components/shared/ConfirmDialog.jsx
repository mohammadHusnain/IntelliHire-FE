import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * An in-app replacement for `window.confirm`: same yes/no shape, but styled like the rest of the
 * app instead of the browser's own dialog. `danger` renders a red confirm button for a destructive
 * action (delete, cancel); otherwise it uses the normal brand button.
 *
 * `open` is the only thing a caller needs to manage; render it unconditionally and gate it with `open`.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={() => !busy && onClose()} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="animate-modal-in relative w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${danger ? "bg-red-50 text-red-600" : "bg-brand/10 text-brand"}`}>
          <AlertTriangle size={20} />
        </span>
        <h2 className="display mt-4 text-[21px]">{title}</h2>
        {message && <p className="mt-2 text-[14px] leading-relaxed text-stone-600">{message}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">{cancelLabel}</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={danger ? "btn-primary !bg-red-600 !shadow-none hover:!bg-red-700" : "btn-primary"}
          >
            {busy && <Loader2 size={16} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
