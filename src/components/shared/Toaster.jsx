import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

const TONE = {
  success: { icon: CheckCircle2, color: "text-emerald-600", bar: "bg-emerald-500" },
  error: { icon: XCircle, color: "text-red-600", bar: "bg-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bar: "bg-amber-500" },
  info: { icon: Info, color: "text-brand", bar: "bg-brand" },
};

function ToastItem({ t }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [hover, setHover] = useState(false);
  const tone = TONE[t.type] || TONE.success;
  const Icon = tone.icon;

  useEffect(() => {
    if (hover) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [hover, t.id, t.duration, dismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="animate-toast-in pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-4 pr-10 shadow-[0_20px_40px_-20px_rgba(13,13,13,0.35)]"
    >
      <Icon size={19} className={`mt-0.5 shrink-0 ${tone.color}`} />
      <div className="min-w-0 flex-1">
        {t.title && <p className="text-[14px] font-semibold text-ink">{t.title}</p>}
        {t.message && <p className="mt-0.5 text-[13px] leading-snug text-stone-500">{t.message}</p>}
        {t.action && (
          <button
            type="button"
            onClick={() => { t.action.onClick(); dismiss(t.id); }}
            className="mt-2 text-[13px] font-semibold text-brand hover:text-brand-hover"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="icon-btn absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink"
      >
        <X size={14} />
      </button>
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 h-0.5 origin-left ${tone.bar}`}
        style={{ width: "100%", animation: `toastTimer ${t.duration}ms linear forwards`, animationPlayState: hover ? "paused" : "running" }}
      />
    </div>
  );
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>,
    document.body,
  );
}
