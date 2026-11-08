import { useState } from "react";
import { ArrowDown, ArrowUp, ListChecks, Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/app/primitives";
import { ActionDialog } from "@/components/admin/primitives";
import { jobFieldsApi } from "@/api/jobFieldsApi";
import { LIMITS, blankFieldForm, fieldBody, fieldProblems, fieldTypeLabel, formFromField, isChoiceType, isTextType, mapFieldErrors, FIELD_TYPES } from "@/lib/jobMap";
import { toast } from "@/store/toastStore";

const ALWAYS_ASKED = ["Full name", "Email", "Phone number", "Highest education level", "Institution", "Graduation year", "CV"];

/**
 * The questions HR adds to a job's application form (after the fixed ones). Everything goes through the server:
 * the list only changes from what the server returns, and the server's lock messages are shown as they are.
 * `job` is { id, status, applicationsCount, customFields }.
 */
export default function ApplicationFormBuilder({ job, canEdit, onChanged }) {
  const [fields, setFields] = useState(job.customFields);
  const [editor, setEditor] = useState(null); // null | { id: null | number, form, errors, error }
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const closed = job.status === "closed";
  const expired = job.expired;
  const editable = canEdit && !closed && !expired;
  const locked = job.applicationsCount > 0; // applications exist: the server limits which changes are safe
  const full = fields.length >= LIMITS.customFields;

  const apply = (next) => {
    setFields(next);
    onChanged?.(next);
  };

  /** Reads the list again from the server (after a refusal or a delete), so what is shown is what is stored. */
  const reload = async () => {
    try {
      apply(await jobFieldsApi.list(job.id));
    } catch {
      /* keep what is shown; the next action reports the problem */
    }
  };

  const open = (field) =>
    setEditor(field ? { id: field.id, form: formFromField(field), errors: {}, error: "", original: field } : { id: null, form: blankFieldForm(), errors: {}, error: "", original: null });

  const set = (key, value) => setEditor((e) => ({ ...e, form: { ...e.form, [key]: value }, errors: { ...e.errors, [key]: "" }, error: "" }));

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const problems = fieldProblems(editor.form);
    if (Object.keys(problems).length) return setEditor((e) => ({ ...e, errors: problems }));
    setBusy(true);
    try {
      const body = fieldBody(editor.form);
      if (editor.id === null) {
        const created = await jobFieldsApi.add(job.id, body);
        apply([...fields, created]);
        toast({ title: "Question added", message: `“${created.label}” is now on the application form.` });
      } else {
        const updated = await jobFieldsApi.update(job.id, editor.id, body);
        apply(fields.map((f) => (f.id === updated.id ? updated : f)));
        toast({ title: "Question updated", message: `“${updated.label}” was saved.` });
      }
      setEditor(null);
    } catch (error) {
      const mapped = mapFieldErrors(error.fieldErrors);
      const known = ["label", "type", "required", "options", "helpText", "maxLength"].some((k) => mapped[k]);
      setEditor((e) => ({ ...e, errors: known ? mapped : e.errors, error: known ? "" : error.message }));
      if (error.status === 409 || error.status === 404) await reload();
    } finally {
      setBusy(false);
    }
  };

  const move = async (index, delta) => {
    if (busy) return;
    const ids = fields.map((f) => f.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      apply(await jobFieldsApi.reorder(job.id, ids));
    } catch (error) {
      toast({ type: "error", title: "Couldn't reorder", message: error.message });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await jobFieldsApi.remove(job.id, removing.id);
      toast({ type: "warning", title: "Question removed", message: `“${removing.label}” is no longer on the form.` });
      setRemoving(null);
      await reload();
    } catch (error) {
      toast({ type: "warning", title: "Nothing changed", message: error.message });
      setRemoving(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const form = editor?.form;
  const editingLocked = editor && editor.id !== null && locked; // a question that candidates may already have answered

  return (
    <Card className="p-6">
      <CardHeader icon={ListChecks} title="Application form" subtitle="Candidates always answer the basics. Add your own questions below." />

      <p className="mt-5 text-[12.5px] text-stone-500"><span className="font-semibold text-stone-600">Always asked:</span> {ALWAYS_ASKED.join(", ")}.</p>

      {(closed || expired) && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-[13px] text-stone-600"><Lock size={15} className="mt-0.5 shrink-0" /> {closed ? "This role is closed, so its form is read-only. Reopen it to change the form." : "The deadline passed, so the form can't be changed. Close the role and reopen it with a new deadline."}</p>
      )}
      {editable && locked && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800"><Lock size={15} className="mt-0.5 shrink-0" /> This role has {job.applicationsCount} {job.applicationsCount === 1 ? "application" : "applications"}. Questions can no longer be deleted, change type, become required or lose options, and new questions must be optional. You can still change labels, help text and order, and add options.</p>
      )}

      {fields.length === 0 && !editor ? (
        <p className="mt-5 rounded-2xl border border-dashed border-stone-300 p-5 text-center text-[13.5px] text-stone-500">No extra questions yet.</p>
      ) : (
        <ol className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]" aria-label="Custom questions">
          {fields.map((f, i) => (
            <li key={f.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink">
                  {f.label}
                  <Badge tone="neutral">{fieldTypeLabel(f.type)}</Badge>
                  {f.required && <Badge tone="brand">Required</Badge>}
                </p>
                {f.options.length > 0 && <p className="mt-1 text-[12.5px] text-stone-500">{f.options.join(" · ")}</p>}
                {f.helpText && <p className="mt-0.5 text-[12.5px] text-stone-500">{f.helpText}</p>}
              </div>
              {editable && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.label} up`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 disabled:opacity-40"><ArrowUp size={15} /></button>
                  <button type="button" disabled={busy || i === fields.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.label} down`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 disabled:opacity-40"><ArrowDown size={15} /></button>
                  <button type="button" disabled={busy} onClick={() => open(f)} aria-label={`Edit ${f.label}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:text-brand disabled:opacity-40"><Pencil size={15} /></button>
                  {!locked && (
                    <button type="button" disabled={busy} onClick={() => setRemoving(f)} aria-label={`Delete ${f.label}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:border-red-200 hover:text-red-600 disabled:opacity-40"><Trash2 size={15} /></button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editor && (
        <form onSubmit={save} noValidate className="mt-5 space-y-4 rounded-2xl border border-brand/30 bg-brand-soft/30 p-5" aria-label={editor.id === null ? "New question" : "Edit question"}>
          <div>
            <label htmlFor="q-label" className="mb-1.5 block text-[13px] font-medium text-stone-700">Question</label>
            <input id="q-label" value={form.label} maxLength={LIMITS.fieldLabel} onChange={(e) => set("label", e.target.value)} aria-invalid={editor.errors.label ? "true" : undefined} className="field" placeholder="e.g. LinkedIn profile URL" autoFocus />
            {editor.errors.label && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{editor.errors.label}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="q-type" className="mb-1.5 block text-[13px] font-medium text-stone-700">Answer type</label>
              <select id="q-type" value={form.type} disabled={editingLocked} onChange={(e) => setEditor((s) => ({ ...s, form: { ...s.form, type: e.target.value, options: isChoiceType(e.target.value) ? s.form.options : [], maxLength: isTextType(e.target.value) ? s.form.maxLength : "" }, errors: { ...s.errors, type: "" } }))} className="field cursor-pointer">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {editor.errors.type && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{editor.errors.type}</p>}
              {editingLocked && <p className="mt-1.5 text-[12px] text-stone-500">The type can&apos;t change once applications exist.</p>}
            </div>
            {isTextType(form.type) && (
              <div>
                <label htmlFor="q-max" className="mb-1.5 block text-[13px] font-medium text-stone-700">Maximum length <span className="font-normal text-stone-400">(optional)</span></label>
                <input id="q-max" type="number" min="1" max={LIMITS.fieldMaxLength} value={form.maxLength} onChange={(e) => set("maxLength", e.target.value)} aria-invalid={editor.errors.maxLength ? "true" : undefined} className="field" />
                {editor.errors.maxLength && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{editor.errors.maxLength}</p>}
              </div>
            )}
          </div>
          {isChoiceType(form.type) && (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-stone-700">Options <span className="font-normal text-stone-400">({LIMITS.options.min}–{LIMITS.options.max})</span></p>
              <ul className="space-y-2">
                {form.options.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <input aria-label={`Option ${i + 1}`} value={o} maxLength={LIMITS.option} onChange={(e) => set("options", form.options.map((x, j) => (j === i ? e.target.value : x)))} className="field !h-10" />
                    {!(editingLocked && editor.original?.options.includes(o)) && (
                      <button type="button" onClick={() => set("options", form.options.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`} className="icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:text-red-600"><X size={15} /></button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" disabled={form.options.length >= LIMITS.options.max} onClick={() => set("options", [...form.options, ""])} className="btn-secondary mt-2 !h-9 !px-3 text-[12.5px] disabled:opacity-50"><Plus size={14} /> Add option</button>
              {editor.errors.options && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{editor.errors.options}</p>}
              {editingLocked && <p className="mt-1.5 text-[12px] text-stone-500">Existing options can&apos;t be removed or renamed once applications exist; you can add more.</p>}
            </div>
          )}
          <div>
            <label htmlFor="q-help" className="mb-1.5 block text-[13px] font-medium text-stone-700">Help text <span className="font-normal text-stone-400">(optional)</span></label>
            <input id="q-help" value={form.helpText} maxLength={LIMITS.helpText} onChange={(e) => set("helpText", e.target.value)} aria-invalid={editor.errors.helpText ? "true" : undefined} className="field" />
            {editor.errors.helpText && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{editor.errors.helpText}</p>}
          </div>
          <label className="flex items-center gap-2.5 text-[13.5px] text-stone-700">
            <input type="checkbox" checked={form.required} disabled={locked && !(editor.original?.required)} onChange={(e) => set("required", e.target.checked)} /> Candidates must answer this
          </label>
          {locked && !(editor.original?.required) && <p className="-mt-2 text-[12px] text-stone-500">A question can&apos;t become required once applications exist.</p>}
          {editor.errors.required && <p role="alert" className="text-[12.5px] text-red-600">{editor.errors.required}</p>}
          {editor.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{editor.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditor(null)} disabled={busy} className="btn-secondary !h-10">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary !h-10">{busy && <Loader2 size={15} className="animate-spin" />} {editor.id === null ? "Add question" : "Save question"}</button>
          </div>
        </form>
      )}

      {editable && !editor && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => open(null)} disabled={full || busy} className="btn-secondary disabled:opacity-50"><Plus size={15} /> Add a question</button>
          {full && <span className="text-[12.5px] text-stone-500">A role can have at most {LIMITS.customFields} extra questions.</span>}
        </div>
      )}

      {removing && (
        <ActionDialog title={`Delete “${removing.label}”?`} message="The question is removed from the form." confirmLabel="Delete question" tone="danger" busy={busy} onConfirm={remove} onClose={() => !busy && setRemoving(null)} />
      )}
    </Card>
  );
}
