import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, Loader2, Search, X } from "lucide-react";
import { Card } from "@/components/app/primitives";

export function SearchField({ value, onChange, placeholder = "Search", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="field !h-11 !pl-10 pr-10" />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="icon-btn absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function SelectField({ value, onChange, options, label }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <ArrowUpDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-[var(--line)] bg-white pl-8 pr-4 text-[13px] font-semibold text-stone-600 outline-none transition-colors hover:border-stone-300 focus:border-brand"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Table on md+, stacked cards below.
 * columns: [{ key, label, className?, cell(row), mobile?: false }]
 */
export function DataTable({ columns, rows, rowKey, onRowClick, selected, onToggle, onToggleAll, renderCard, empty, busy }) {
  const selectable = !!onToggle;
  const allOn = selectable && rows.length > 0 && rows.every((r) => selected.includes(rowKey(r)));

  if (busy) {
    return (
      <Card className="flex items-center justify-center gap-2 p-16 text-[14px] text-stone-500">
        <Loader2 size={18} className="animate-spin text-brand" /> Loading…
      </Card>
    );
  }
  if (!rows.length) return empty;

  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[12px] font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                {selectable && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOn}
                      onChange={(e) => onToggleAll(e.target.checked)}
                      aria-label="Select all"
                      className="h-4 w-4 cursor-pointer accent-[#F04E23]"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} className={`px-3 py-3 ${c.className || ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rows.map((row, i) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`row-hover animate-fade-in ${onRowClick ? "cursor-pointer" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                  >
                    {selectable && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(key)}
                          onChange={() => onToggle(key)}
                          aria-label={`Select row ${i + 1}`}
                          className="h-4 w-4 cursor-pointer accent-[#F04E23]"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-3.5 align-middle ${c.className || ""}`}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {rows.map((row, i) => (
          <div key={rowKey(row)} className="animate-fade-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            {renderCard(row)}
          </div>
        ))}
      </div>
    </>
  );
}

/** Right-hand detail panel. */
export function Drawer({ title, subtitle, onClose, footer, children, accent }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"}>
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <aside className="animate-panel-in absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] p-5">
          {accent}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[22px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-stone-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-[var(--line)] p-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/** Centred dialog with an optional required reason. */
export function ActionDialog({ title, message, confirmLabel, tone = "primary", requireReason, onConfirm, onClose, busy }) {
  const [reason, setReason] = useState("");
  const tooShort = requireReason && reason.trim().length < 10;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="animate-modal-in relative w-full max-w-[460px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">
        <h2 className="display text-[24px]">{title}</h2>
        {message && <p className="mt-2 text-[14px] leading-relaxed text-stone-500">{message}</p>}
        {requireReason && (
          <div className="mt-5">
            <label htmlFor="action-reason" className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Reason <span className="font-normal text-stone-400">(recorded in the audit log)</span>
            </label>
            <textarea
              id="action-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="At least 10 characters, e.g. duplicate account reported by the owner"
              className="field !h-auto resize-none py-3 leading-relaxed"
              autoFocus
            />
            <p className={`mt-1 text-[12px] ${tooShort && reason ? "text-amber-600" : "text-stone-400"}`}>{reason.trim().length}/10</p>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={tooShort || busy}
            onClick={() => onConfirm(reason.trim())}
            className={tone === "danger" ? "btn-dark !bg-red-600 hover:!bg-red-700" : "btn-primary"}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children }) {
  return (
    <div className="border-b border-[var(--line)] py-3 last:border-0">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-1 text-[14px] text-ink">{children || <span className="text-stone-400">Not provided</span>}</div>
    </div>
  );
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-all duration-200 ${
              on ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600 hover:border-stone-300 hover:text-ink"
            }`}
          >
            {o.label}
            {o.count > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-white/20" : o.alert ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
