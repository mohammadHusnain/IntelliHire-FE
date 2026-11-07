import { useState } from "react";
import { Briefcase, GraduationCap, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import { mapFieldErrors, profileApi } from "@/api/profileApi";
import { toast } from "@/store/toastStore";

const MAX_ROWS = 50;

const EDUCATION = {
  title: "Education",
  subtitle: "Schools, degrees and certificates.",
  icon: GraduationCap,
  noun: "education",
  api: profileApi.education,
  empty: { institution: "", degree: "", field_of_study: "", start_year: "", end_year: "", grade: "" },
  fields: [
    { name: "institution", label: "Institution", required: true },
    { name: "degree", label: "Degree", required: true },
    { name: "field_of_study", label: "Field of study", required: true },
    { name: "start_year", label: "Start year", type: "number", required: true },
    { name: "end_year", label: "End year (leave empty if ongoing)", type: "number" },
    { name: "grade", label: "Grade" },
  ],
  numeric: ["start_year", "end_year"],
  summary: (r) => ({ title: [r.degree, r.field_of_study].filter(Boolean).join(", ") || r.institution, meta: `${r.institution} · ${r.start_year}–${r.end_year ?? "present"}` }),
};

const EXPERIENCE = {
  title: "Experience",
  subtitle: "Roles you have held.",
  icon: Briefcase,
  noun: "experience",
  api: profileApi.experience,
  empty: { company: "", position: "", start_date: "", end_date: "", is_current: false, description: "" },
  fields: [
    { name: "company", label: "Company", required: true },
    { name: "position", label: "Position", required: true },
    { name: "start_date", label: "Start date", type: "date", required: true },
    { name: "end_date", label: "End date", type: "date", hideWhenCurrent: true, requiredUnlessCurrent: true },
    { name: "description", label: "What you did", textarea: true },
  ],
  numeric: [],
  summary: (r) => ({ title: r.position, meta: `${r.company} · ${r.start_date} – ${r.is_current ? "present" : r.end_date}` }),
};

function toPayload(config, values) {
  const body = { ...values };
  for (const name of config.numeric) body[name] = values[name] === "" ? null : Number(values[name]);
  if (config === EXPERIENCE) {
    body.end_date = values.is_current || !values.end_date ? null : values.end_date;
  }
  return body;
}

function fromRow(config, row) {
  const values = { ...config.empty };
  for (const key of Object.keys(config.empty)) if (row[key] !== null && row[key] !== undefined) values[key] = row[key];
  return values;
}

function RowsCard({ config, rows, onRowsChange }) {
  const [editing, setEditing] = useState(null); // null | "new" | row id
  const [values, setValues] = useState(config.empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const Icon = config.icon;
  const full = rows.length >= MAX_ROWS;

  const open = (row) => {
    setEditing(row ? row.id : "new");
    setValues(row ? fromRow(config, row) : config.empty);
    setErrors({});
  };
  const close = () => {
    setEditing(null);
    setErrors({});
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    // Mirror the server's required fields so the user is told before a round trip.
    const missing = {};
    for (const field of config.fields) {
      const needed = field.required || (field.requiredUnlessCurrent && !values.is_current);
      if (needed && !String(values[field.name] ?? "").trim()) missing[field.name] = "This field is required.";
    }
    if (Object.keys(missing).length) return setErrors(missing);
    setBusy(true);
    try {
      const body = toPayload(config, values);
      if (editing === "new") {
        const created = await config.api.create(body);
        onRowsChange([...rows, created]);
      } else {
        const updated = await config.api.update(editing, body);
        onRowsChange(rows.map((row) => (row.id === editing ? updated : row)));
      }
      close();
      toast({ title: "Saved", message: `Your ${config.noun} was saved.` });
    } catch (error) {
      const fields = mapFieldErrors(error.fieldErrors, {});
      if (Object.keys(fields).length) setErrors(fields);
      toast({ type: "error", title: "Not saved", message: error.code === "limit_reached" ? `You can add up to ${MAX_ROWS} entries.` : error.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (removing) return;
    setRemoving(id);
    try {
      await config.api.remove(id);
      onRowsChange(rows.filter((row) => row.id !== id));
    } catch (error) {
      // 404 means it is already gone: drop it from the list instead of showing a broken row
      if (error.status === 404) onRowsChange(rows.filter((row) => row.id !== id));
      else toast({ type: "error", title: "Couldn't delete", message: error.message });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader
        icon={Icon}
        title={config.title}
        subtitle={config.subtitle}
        action={
          editing === null && (
            <button type="button" onClick={() => open(null)} disabled={full} className="btn-secondary !h-9 !px-3 text-[13px] disabled:opacity-50">
              <Plus size={14} /> Add
            </button>
          )
        }
      />

      {rows.length === 0 && editing === null && <p className="mt-5 text-[13.5px] text-stone-500">Nothing added yet.</p>}

      <ul className="mt-5 space-y-2">
        {rows.map((row) => {
          const { title, meta } = config.summary(row);
          return (
            <li key={row.id} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{title}</p>
                <p className="truncate text-[12.5px] text-stone-500">{meta}</p>
              </div>
              <button type="button" onClick={() => open(row)} aria-label={`Edit ${title}`} className="icon-btn flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => remove(row.id)} disabled={removing === row.id} aria-label={`Delete ${title}`} className="icon-btn flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600">
                {removing === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          );
        })}
      </ul>

      {editing !== null && (
        <form onSubmit={save} noValidate className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-[var(--line)] bg-stone-50/60 p-4 sm:grid-cols-2">
          {config.fields.map((field) => {
            if (field.hideWhenCurrent && values.is_current) return null;
            const common = {
              label: field.label,
              value: values[field.name] ?? "",
              error: errors[field.name],
              onChange: (e) => {
                setValues((v) => ({ ...v, [field.name]: e.target.value }));
                setErrors((er) => ({ ...er, [field.name]: "" }));
              },
            };
            return field.textarea ? (
              <div key={field.name} className="sm:col-span-2">
                <label className="mb-1.5 block text-[13px] font-medium text-stone-700">{field.label}</label>
                <textarea rows={3} {...{ value: common.value, onChange: common.onChange }} className="field !h-auto resize-none py-3" aria-invalid={common.error ? "true" : undefined} />
                {common.error && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{common.error}</p>}
              </div>
            ) : (
              <AuthField key={field.name} type={field.type || "text"} {...common} />
            );
          })}
          {config === EXPERIENCE && (
            <label className="flex items-center gap-2 text-[13.5px] text-stone-700 sm:col-span-2">
              <input type="checkbox" checked={values.is_current} onChange={(e) => setValues((v) => ({ ...v, is_current: e.target.checked, end_date: e.target.checked ? "" : v.end_date }))} />
              I currently work here
            </label>
          )}
          {errors.non_field_errors && <p role="alert" className="text-[12.5px] text-red-600 sm:col-span-2">{errors.non_field_errors}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={close} className="btn-secondary !h-9">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary !h-9">
              {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Save"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

export const EducationCard = (props) => <RowsCard config={EDUCATION} {...props} />;
export const ExperienceCard = (props) => <RowsCard config={EXPERIENCE} {...props} />;
