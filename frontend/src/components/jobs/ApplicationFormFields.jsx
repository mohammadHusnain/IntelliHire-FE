const inputCls = "field";

/**
 * The questions of an application form, built from a form schema (GET .../form-preview/ or the public schema).
 * `values` maps a field key to a string, an array of strings (multiple choice) or a File.
 * With `readOnly` it only shows what candidates will fill in.
 */
export default function ApplicationFormFields({ fields, values = {}, onChange = () => {}, errors = {}, readOnly = false, idPrefix = "f" }) {
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const error = errors[f.key];
        const value = values[f.key];
        const labelOf = (option) => f.option_labels?.[option] || option;
        const label = (
          <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-stone-700">
            {f.label}
            {f.required ? <span className="text-brand" aria-hidden> *</span> : <span className="ml-1 text-stone-400">(optional)</span>}
          </label>
        );
        let control;
        switch (f.type) {
          case "long_text":
            control = <textarea id={id} rows={4} maxLength={f.max_length || undefined} value={value || ""} onChange={(e) => onChange(f.key, e.target.value)} disabled={readOnly} aria-invalid={error ? "true" : undefined} className={`${inputCls} !h-auto resize-none py-3`} />;
            break;
          case "single_choice":
            control = (
              <select id={id} value={value || ""} onChange={(e) => onChange(f.key, e.target.value)} disabled={readOnly} aria-invalid={error ? "true" : undefined} className={`${inputCls} cursor-pointer`}>
                <option value="">Select…</option>
                {f.options.map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
              </select>
            );
            break;
          case "multiple_choice": {
            const chosen = Array.isArray(value) ? value : [];
            control = (
              <fieldset id={id} className="space-y-2" aria-invalid={error ? "true" : undefined}>
                {f.options.map((o) => (
                  <label key={o} className="flex items-center gap-2.5 text-[14px] text-stone-700">
                    <input
                      type="checkbox"
                      checked={chosen.includes(o)}
                      disabled={readOnly}
                      onChange={(e) => onChange(f.key, e.target.checked ? [...chosen, o] : chosen.filter((x) => x !== o))}
                    />
                    {o}
                  </label>
                ))}
              </fieldset>
            );
            break;
          }
          case "file":
            control = (
              <input
                id={id}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={readOnly}
                onChange={(e) => onChange(f.key, e.target.files?.[0] || null)}
                aria-invalid={error ? "true" : undefined}
                className="block w-full text-[13.5px] text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-stone-700"
              />
            );
            break;
          default: {
            const type = { number: "number", email: "email", url: "url", date: "date" }[f.type] || "text";
            control = <input id={id} type={type} maxLength={type === "text" ? f.max_length || undefined : undefined} value={value || ""} onChange={(e) => onChange(f.key, e.target.value)} disabled={readOnly} aria-invalid={error ? "true" : undefined} className={inputCls} />;
          }
        }
        return (
          <div key={f.key}>
            {label}
            {control}
            {f.help_text && <p className="mt-1.5 text-[12.5px] text-stone-500">{f.help_text}</p>}
            {value instanceof File && <p className="mt-1.5 text-[12.5px] text-stone-500">{value.name} · {(value.size / 1024).toFixed(0)} KB</p>}
            {error && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
