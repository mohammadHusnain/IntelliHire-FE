import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Eye, Loader2, Plus, Save, X } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import RolePicker from "@/components/candidate/RolePicker";
import { useCompanyActions, useCompanyRecord, PIPELINE } from "@/store/companyStore";
import { departmentOptions, experienceLevels, jobTypes, locationOptions, workplaceTypes } from "@/data/jobsStore";
import { skillsForRole } from "@/lib/interview/questionBank";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const blank = {
  title: "", department: departmentOptions[0], location: locationOptions[0], workplaceType: "Hybrid",
  jobType: "Full-time", experienceLevel: "Mid-level", openings: 1, salaryMin: "", salaryMax: "",
  description: "", responsibilities: "", requirements: "", skills: [], hiringStages: PIPELINE, status: "Draft",
};

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-stone-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field cursor-pointer" aria-label={label}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function CompanyJobCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = useCompanyRecord();
  const { saveJob } = useCompanyActions();
  const existing = id ? record.jobs.find((j) => j.id === id) : null;

  const [form, setForm] = useState(() => (existing ? { ...blank, ...existing } : { ...blank, recruiter: record.profile.ownerName }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const suggestions = useMemo(
    () => (form.title ? skillsForRole(form.title).filter((s) => !form.skills.includes(s)).slice(0, 10) : []),
    [form.title, form.skills],
  );

  const addSkill = (raw) => {
    const s = raw.trim();
    if (!s || form.skills.some((x) => x.toLowerCase() === s.toLowerCase()) || form.skills.length >= 12) return;
    set("skills", [...form.skills, s]);
    setSkillInput("");
  };

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 3) e.title = "Give the role a title";
    if (form.description.trim().length < 40) e.description = "Describe the role in at least 40 characters";
    if (form.requirements.trim().length < 10) e.requirements = "List what you need from candidates";
    if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) e.salaryMax = "Maximum must be higher than minimum";
    if (!form.skills.length) e.skills = "Add at least one skill so CVs can be matched";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (status) => {
    if (status === "Open" && !validate()) {
      toast({ type: "error", title: "Check the highlighted fields", message: "A published role needs a title, description, requirements and skills." });
      return;
    }
    if (status === "Draft" && form.title.trim().length < 3) {
      setErrors({ title: "Give the role a title before saving" });
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    const saved = saveJob({ ...form, status, openings: Number(form.openings) || 1 });
    setSaving(false);
    toast({
      title: status === "Open" ? "Role published" : "Draft saved",
      message: status === "Open" ? `${saved.title} is now collecting applications.` : `${saved.title} is saved. Publish it when you are ready.`,
    });
    navigate(status === "Open" ? `/company/jobs/${saved.id}/preview` : ROUTES.COMPANY.JOBS);
  };

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow={existing ? "Edit role" : "New role"}
        title={existing ? <>Edit <em>{existing.title}</em></> : <>Post a <em>new role</em></>}
        subtitle="Candidates see this, and the skills you list are what CVs are matched against."
        actions={
          <Link to={ROUTES.COMPANY.JOBS} className="btn-secondary">
            <ArrowLeft size={16} /> Back to roles
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Reveal>
            <Card className="p-6">
              <CardHeader icon={Plus} title="The basics" subtitle="What the job is and where it sits" />
              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-stone-700">Role title</label>
                  <RolePicker value={form.title} onChange={(v) => set("title", v)} invalid={!!errors.title} placeholder="Search the role catalogue" />
                  {errors.title && <p className="mt-1.5 text-[12.5px] text-red-600">{errors.title}</p>}
                  <p className="mt-1.5 text-[12.5px] text-stone-500">Picking from the catalogue lets us suggest the right skills and interview questions.</p>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Select label="Department" value={form.department} onChange={(v) => set("department", v)} options={departmentOptions} />
                  <Select label="Location" value={form.location} onChange={(v) => set("location", v)} options={locationOptions} />
                  <Select label="Workplace" value={form.workplaceType} onChange={(v) => set("workplaceType", v)} options={workplaceTypes} />
                  <Select label="Employment type" value={form.jobType} onChange={(v) => set("jobType", v)} options={jobTypes} />
                  <Select label="Experience level" value={form.experienceLevel} onChange={(v) => set("experienceLevel", v)} options={experienceLevels} />
                  <AuthField label="Openings" type="number" min="1" value={form.openings} onChange={(e) => set("openings", e.target.value)} />
                  <AuthField label="Salary from" type="number" value={form.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} placeholder="45000" hint="Optional" />
                  <AuthField label="Salary to" type="number" value={form.salaryMax} onChange={(e) => set("salaryMax", e.target.value)} error={errors.salaryMax} placeholder="65000" />
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={60}>
            <Card className="p-6">
              <CardHeader icon={Eye} title="The description" subtitle="What candidates read before applying" />
              <div className="mt-6 space-y-5">
                {[
                  { k: "description", label: "About the role", rows: 4, ph: "What the team does, what this person will own, and why it matters." },
                  { k: "responsibilities", label: "Responsibilities", rows: 4, ph: "One per line" },
                  { k: "requirements", label: "Requirements", rows: 4, ph: "One per line" },
                ].map((f) => (
                  <div key={f.k}>
                    <label htmlFor={f.k} className="mb-1.5 block text-[13px] font-medium text-stone-700">{f.label}</label>
                    <textarea
                      id={f.k}
                      rows={f.rows}
                      value={form[f.k]}
                      onChange={(e) => set(f.k, e.target.value)}
                      placeholder={f.ph}
                      aria-invalid={errors[f.k] ? "true" : undefined}
                      className="field !h-auto resize-none py-3 leading-relaxed"
                    />
                    {errors[f.k] && <p className="mt-1.5 text-[12.5px] text-red-600">{errors[f.k]}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={120}>
            <Card className="p-6">
              <CardHeader icon={Check} title="Skills to match" subtitle="CVs are scored against these" action={<span className="text-[12px] tabular-nums text-stone-400">{form.skills.length}/12</span>} />
              <div className="mt-5">
                <div className={`flex min-h-[52px] flex-wrap gap-1.5 rounded-2xl border p-2 ${errors.skills ? "border-red-300 bg-red-50/40" : "border-[var(--line)] bg-stone-50/60"}`}>
                  {form.skills.length === 0 && <p className="px-2 py-1.5 text-[13px] text-stone-400">Add the skills this role needs.</p>}
                  {form.skills.map((s) => (
                    <span key={s} className="animate-pop inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12.5px] font-medium text-white">
                      {s}
                      <button type="button" onClick={() => set("skills", form.skills.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="flex h-5 w-5 items-center justify-center rounded-full text-white/60 hover:bg-white/15 hover:text-white">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                {errors.skills && <p className="mt-1.5 text-[12.5px] text-red-600">{errors.skills}</p>}
                <div className="relative mt-3">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); } }}
                    placeholder="Type a skill and press Enter"
                    aria-label="Add a skill"
                    className="field pr-24"
                  />
                  <button type="button" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim()} className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center gap-1 rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-0">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-stone-400">Suggested for {form.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => addSkill(s)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-stone-600 transition-all duration-200 hover:-translate-y-px hover:border-brand/50 hover:bg-brand-soft hover:text-brand">
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Reveal>
        </div>

        <div className="min-w-0">
          <Reveal delay={100} className="lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <div className="relative bg-ink p-6 text-white">
                <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50" />
                <p className="relative text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Preview</p>
                <p className="relative mt-2 font-display text-[22px] font-medium leading-tight tracking-[-0.02em]">{form.title || "Untitled role"}</p>
                <div className="relative mt-3 flex flex-wrap gap-2 text-[12px]">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{form.workplaceType}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{form.jobType}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{form.experienceLevel}</span>
                </div>
              </div>
              <div className="p-6">
                <dl className="space-y-3 text-[13px]">
                  {[["Department", form.department], ["Location", form.location], ["Openings", form.openings],
                    ["Salary", form.salaryMin && form.salaryMax ? `£${Number(form.salaryMin).toLocaleString()} – £${Number(form.salaryMax).toLocaleString()}` : "Not shown"]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="truncate font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Hiring stages</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PIPELINE.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <button type="button" onClick={() => submit("Open")} disabled={saving} className="btn-primary btn-lg w-full">
                    {saving ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} className="btn-arrow" />}
                    {existing?.status === "Open" ? "Save and keep open" : "Publish role"}
                  </button>
                  <button type="button" onClick={() => submit("Draft")} disabled={saving} className="btn-secondary w-full">
                    <Save size={15} /> Save as draft
                  </button>
                </div>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
