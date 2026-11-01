import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import useDismiss from "@/hooks/useDismiss";
import { ROLE_CATEGORIES } from "@/data/rolesData";

/** Searchable, grouped role combobox over the shared role catalogue. */
export default function RolePicker({ value, onChange, placeholder = "Search or select a role", invalid = false, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const inputRef = useRef(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROLE_CATEGORIES.map((c) => ({ ...c, roles: c.roles.filter((r) => r.toLowerCase().includes(q)) })).filter((c) => c.roles.length);
  }, [query]);

  const pick = (r) => {
    onChange(r);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid ? "true" : undefined}
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className={`field flex items-center justify-between text-left ${open ? "!border-brand shadow-[0_0_0_4px_rgba(240,78,35,0.12)]" : ""}`}
      >
        <span className={`truncate ${value ? "text-ink" : "text-stone-400"}`}>{value || placeholder}</span>
        <ChevronDown size={17} className={`shrink-0 text-stone-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="animate-fade-in-up absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_24px_48px_-20px_rgba(13,13,13,0.35)]">
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && groups[0]) {
                    e.preventDefault();
                    pick(groups[0].roles[0]);
                  }
                }}
                placeholder="Search roles"
                className="field !h-10 !rounded-xl !pl-9 !text-[14px]"
              />
            </div>
          </div>
          <div role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {groups.length === 0 && <p className="p-4 text-center text-[13px] text-stone-400">No roles match &ldquo;{query}&rdquo;</p>}
            {groups.map((g) => (
              <div key={g.category}>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.category}</p>
                {g.roles.map((r) => {
                  const sel = r === value;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => pick(r)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                        sel ? "bg-brand-soft font-medium text-brand" : "text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {r}
                      {sel && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
