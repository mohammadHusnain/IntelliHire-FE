import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";

/** items: [{ id, group, label, icon, hint?, keywords?, run }] */
export default function CommandPalette({ items: allItems, onClose, placeholder = "Search or jump to…" }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => `${i.label} ${i.group} ${i.keywords || ""}`.toLowerCase().includes(q));
  }, [query, allItems]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item) => {
    if (!item) return;
    item.run();
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(items[active]);
    } else if (e.key === "Escape") onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command menu">
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div className="animate-modal-in relative w-full max-w-[580px] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <Search size={18} className="shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-stone-400"
            aria-controls="cmd-list"
          />
          <kbd className="hidden rounded-md border border-[var(--line)] bg-stone-50 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 sm:block">Esc</kbd>
        </div>
        <ul id="cmd-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-10 text-center text-[14px] text-stone-500">No results for &ldquo;{query}&rdquo;</li>}
          {items.map((item, i) => {
            const Icon = item.icon;
            const header = i === 0 || items[i - 1].group !== item.group;
            return (
              <li key={item.id}>
                {header && <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{item.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors ${i === active ? "bg-brand-soft text-ink" : "text-stone-700"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${i === active ? "bg-brand text-white" : "bg-stone-100 text-stone-500"}`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[12px] text-stone-400">{item.hint}</span>}
                  {i === active ? <CornerDownLeft size={14} className="text-brand" /> : <ArrowRight size={14} className="text-stone-300" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-[var(--line)] bg-stone-50/70 px-4 py-2.5 text-[11.5px] text-stone-500">
          <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold">Enter</kbd> open</span>
          <span className="ml-auto hidden sm:inline">Tip: press <kbd className="font-semibold">Ctrl K</kbd> anywhere</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
