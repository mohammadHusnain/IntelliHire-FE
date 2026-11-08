import { useState } from "react";
import { Plus, X } from "lucide-react";
import { LIMITS } from "@/lib/jobMap";

/** A list of short tags (skills): type and press Enter, click a suggestion, remove with the x. Duplicates are ignored. */
export default function SkillsInput({ id, label, hint, value, onChange, suggestions = [], max = LIMITS.skills, error, disabled = false, tone = "dark" }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const add = (raw) => {
    const skill = raw.trim();
    if (!skill) return;
    if (skill.length > LIMITS.skill) return setNote(`Keep each skill under ${LIMITS.skill} characters.`);
    if (value.some((x) => x.toLowerCase() === skill.toLowerCase())) return setNote(`${skill} is already in the list.`);
    if (value.length >= max) return setNote(`At most ${max} skills.`);
    setNote("");
    onChange([...value, skill]);
    setText("");
  };

  const open = suggestions.filter((s) => !value.some((x) => x.toLowerCase() === s.toLowerCase())).slice(0, 10);
  const chip = tone === "dark" ? "bg-ink text-white" : "bg-stone-100 text-stone-700";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-stone-700">
        <span>{label}</span>
        <span className="text-[12px] font-normal text-stone-400">{value.length}/{max}</span>
      </label>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-[12.5px] font-medium ${chip}`}>
              {s}
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="flex h-5 w-5 items-center justify-center rounded-full opacity-60 hover:bg-black/10 hover:opacity-100">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="relative">
          <input
            id={id}
            value={text}
            maxLength={LIMITS.skill}
            onChange={(e) => { setText(e.target.value); setNote(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(text);
              }
            }}
            aria-invalid={error ? "true" : undefined}
            placeholder="Type a skill and press Enter"
            className="field pr-12"
          />
          <button type="button" onClick={() => add(text)} disabled={!text.trim()} aria-label={`Add ${label.toLowerCase()}`} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-ink text-white disabled:opacity-0">
            <Plus size={15} />
          </button>
        </div>
      )}
      {open.length > 0 && !disabled && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[12px] font-medium text-stone-600 hover:border-brand/50 hover:text-brand">+ {s}</button>
          ))}
        </div>
      )}
      {hint && !error && !note && <p className="mt-1.5 text-[12.5px] text-stone-500">{hint}</p>}
      {(error || note) && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{error || note}</p>}
    </div>
  );
}
