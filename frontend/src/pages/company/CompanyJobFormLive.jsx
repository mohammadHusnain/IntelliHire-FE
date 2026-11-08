import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Banknote, Briefcase, CalendarClock, FileText, Loader2, Lock, SearchX, WifiOff } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/app/primitives";
import AuthField from "@/components/shared/AuthField";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import ApplicationFormBuilder from "@/components/jobs/ApplicationFormBuilder";
import SkillsInput from "@/components/jobs/SkillsInput";
import ReopenDialog from "@/components/jobs/ReopenDialog";
import { isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useJobActions } from "@/hooks/useJobActions";
import { useRemote } from "@/hooks/useRemote";
import { skillsForRole } from "@/lib/interview/questionBank";
import {
  EDUCATION_LEVELS, EMPLOYMENT_TYPES, LIMITS, WORK_MODES, blankJobForm, canEditJobs, canManageJobs, changedJobFields, draftProblems,
  formFromJob, jobBody, mapJobErrors, publishProblems,
} from "@/lib/jobMap";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AED", "SAR"];
const ERROR_KEYS = ["title", "department", "description", "responsibilities", "employmentType", "workMode", "location", "requiredSkills", "softSkills", "minExperienceYears", "educationLevel", "salaryMin", "salaryMax", "salaryCurrency", "openings", "deadline"];

function Select({ id, label, value, onChange, options, error, disabled, blank, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-stone-700">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={error ? "true" : undefined} className="field cursor-pointer">
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && !error && <p className="mt-1.5 text-[12.5px] text-stone-500">{hint}</p>}
      {error && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

function TextArea({ id, label, value, onChange, error, disabled, rows = 6, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-stone-700">
        <span>{label}</span>
        <span className="text-[12px] font-normal text-stone-400">{value.length.toLocaleString()}/{LIMITS.text.toLocaleString()}</span>
      </label>
      <textarea id={id} rows={rows} value={value} maxLength={LIMITS.text} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={error ? "true" : undefined} className="field !h-auto resize-y py-3 leading-relaxed" />
      {hint && !error && <p className="mt-1.5 text-[12.5px] text-stone-500">{hint}</p>}
      {error && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}

/** New role and edit role, against the real backend. Draft and publish are separate actions. */
export default function CompanyJobFormLive() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const departments = useRemote((o) => jobsApi.departments(o), []);
  const loaded = useRemote((o) => (id ? jobsApi.get(id, o) : Promise.resolve(null)), [id]);

  if (!canEditJobs(user)) {
    return (
      <EmptyState icon={Lock} title="You can't edit roles" message="Only company admins, HR managers and recruiters can create or change roles." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />
    );
  }
  if (isBlocked(loaded.error)) return <CompanyBlocked onRetry={loaded.reload} />;
  if (id && loaded.error?.status === 404) {
    return <EmptyState icon={SearchX} title="Role not found" message="This role may have been deleted." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;
  }
  if (id && loaded.status === "error" && !loaded.data) {
    return (
      <Card className="p-6">
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff size={26} className="text-stone-400" />
          <p className="max-w-sm text-[14.5px] text-stone-600">{loaded.error.message}</p>
          <button type="button" onClick={loaded.reload} className="btn-secondary">Try again</button>
        </div>
      </Card>
    );
  }
  if (id && !loaded.data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading the role" /></div>;

  // Keyed by the job id and its server version, so a new load starts from what the server has.
  return <JobForm key={loaded.data ? `${loaded.data.id}:${loaded.data.updatedAt}` : "new"} job={loaded.data} departments={departments.data || []} reload={loaded.reload} />;
}

function JobForm({ job, departments, reload }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageJobs(user);
  const base = useMemo(() => (job ? formFromJob(job) : blankJobForm()), [job]);
  const [form, setForm] = useState(base);
  const [errors, setErrors] = useState({});
  const [customProblems, setCustomProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState("");
  const formRef = useRef(null);
  const actions = useJobActions({ onChanged: () => reload() });

  const status = job?.status || "draft";
  const isOpen = status === "open";
  const closed = status === "closed";
  const expired = Boolean(job?.expired);
  const readOnly = closed || expired;
  // On an open role the server allows only these to change (everything else answers 409 field_locked).
  const lockedAfterPublish = isOpen;
  const dirty = JSON.stringify(form) !== JSON.stringify(base);

  useEffect(() => {
    if (!dirty) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const suggestions = useMemo(() => (form.title ? skillsForRole(form.title) || [] : []), [form.title]);
  const focusFirst = () => requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

  const showServerErrors = (error) => {
    const mapped = mapJobErrors(error.fieldErrors);
    const known = Object.fromEntries(Object.entries(mapped).filter(([k]) => ERROR_KEYS.includes(k)));
    setCustomProblems(mapped.customFieldsAll || []);
    if (Object.keys(known).length || mapped.customFieldsAll) {
      setErrors(known);
      focusFirst();
      toast({ type: "error", title: "Check the highlighted fields", message: "The server found problems with this role." });
    } else {
      toast({ type: error.status === 409 ? "warning" : "error", title: error.status === 409 ? "Can't change that" : "Not saved", message: error.message });
    }
    if (error.status === 409) reload();
  };

  /** Saves what changed (a new role is created). Returns the saved job, or null. */
  const save = async ({ publish = false } = {}) => {
    const local = publish ? publishProblems(form) : draftProblems(form);
    setErrors(local);
    setCustomProblems([]);
    if (Object.keys(local).length) {
      toast({ type: "error", title: "Check the highlighted fields", message: publish ? "A published role needs every highlighted item." : "Fix the highlighted fields to save." });
      focusFirst();
      return null;
    }
    if (saving) return null;
    setSaving(true);
    try {
      if (!job) return await jobsApi.create(jobBody(form), { publish });
      const changes = changedJobFields(form, base);
      return Object.keys(changes).length ? await jobsApi.update(job.id, changes) : job;
    } catch (error) {
      showServerErrors(error);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    const saved = await save();
    if (!saved) return;
    toast({ title: job ? "Draft saved" : "Draft created", message: job ? `${saved.title} is saved.` : "Now add your own application questions, then publish." });
    if (!job) navigate(`/company/jobs/${saved.id}/edit`, { replace: true });
    else reload();
  };

  const saveOpen = async () => {
    const saved = await save();
    if (!saved) return;
    toast({ title: "Changes saved", message: `${saved.title} is updated.` });
    reload();
  };

  const publish = async () => {
    if (!job) {
      const created = await save({ publish: true });
      if (created) {
        toast({ title: "Role published", message: `${created.title} is now collecting applications.` });
        navigate(`/company/jobs/${created.id}/preview`);
      }
      return;
    }
    const saved = await save({ publish: true });
    if (!saved) return;
    const result = await actions.publish(saved, { quiet: true });
    if (result && !actions.isError(result)) navigate(`/company/jobs/${job.id}/preview`);
    else if (result && actions.isError(result)) showServerErrors(result.error);
  };

  const reopen = async (deadline) => {
    setReopenError("");
    const result = await actions.reopen(job, deadline);
    if (result && actions.isError(result)) setReopenError(result.error.fieldErrors?.deadline?.[0] || result.error.message);
    else if (result) setReopening(false);
  };

  const lockHint = lockedAfterPublish ? "Can't be changed after publishing" : undefined;
  const working = saving || (job && actions.busy.has(job.id));

  return (
    <div className="pb-28">
      <PageHeader
        eyebrow={job ? "Edit role" : "New role"}
        title={job ? <>Edit <em>{job.title}</em></> : <>Post a <em>new role</em></>}
        subtitle="Candidates see this page, and the skills you list are what CVs are matched against."
        actions={<Link to={ROUTES.COMPANY.JOBS} className="btn-secondary"><ArrowLeft size={16} /> Back to roles</Link>}
      />

      {closed && (
        <div role="status" className="mb-5 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-stone-600"><Lock size={14} className="mr-1.5 inline" />This role is closed ({job.closeReason === "deadline" ? "the deadline passed" : "closed by your team"}), so it is read-only.</p>
          {canManage && <button type="button" onClick={() => { setReopenError(""); setReopening(true); }} className="btn-secondary">Reopen with a new deadline</button>}
        </div>
      )}
      {expired && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-amber-800">The deadline passed, so this role can&apos;t be edited and no longer takes applications. Close it, then reopen it with a new deadline.</p>
          <button type="button" disabled={working} onClick={() => actions.close(job)} className="btn-secondary shrink-0">Close the role</button>
        </div>
      )}

      <div className="space-y-5">
        <form ref={formRef} noValidate onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <Reveal>
            <Card className="p-6">
              <CardHeader icon={Briefcase} title="The basics" subtitle="What the job is and where it sits" />
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <AuthField className="sm:col-span-2" label="Role title" value={form.title} maxLength={LIMITS.title} onChange={(e) => set("title", e.target.value)} error={errors.title} disabled={readOnly} placeholder="e.g. Senior Django Engineer" />
                <div>
                  <AuthField label="Department" list="job-departments" value={form.department} maxLength={LIMITS.department} onChange={(e) => set("department", e.target.value)} error={errors.department} disabled={readOnly || lockedAfterPublish} hint={lockHint} placeholder="e.g. Engineering" />
                  <datalist id="job-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
                </div>
                <Select id="job-type" label="Employment type" value={form.employmentType} onChange={(v) => set("employmentType", v)} options={EMPLOYMENT_TYPES} blank="Select…" error={errors.employmentType} disabled={readOnly || lockedAfterPublish} hint={lockHint} />
                <Select id="job-mode" label="Workplace" value={form.workMode} onChange={(v) => set("workMode", v)} options={WORK_MODES} blank="Not specified" error={errors.workMode} disabled={readOnly || lockedAfterPublish} hint={lockHint} />
                <AuthField label="Location" value={form.location} maxLength={LIMITS.location} onChange={(e) => set("location", e.target.value)} error={errors.location} disabled={readOnly} placeholder={form.workMode === "remote" ? "Optional for remote roles" : "City, Country"} />
                <AuthField label="Openings" type="number" min="1" max={LIMITS.openings} value={form.openings} onChange={(e) => set("openings", e.target.value)} error={errors.openings} disabled={readOnly || lockedAfterPublish} hint={lockHint} />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={40}>
            <Card className="p-6">
              <CardHeader icon={FileText} title="About the role" subtitle="Shown to candidates on the application page" />
              <div className="mt-6 space-y-5">
                <TextArea id="job-description" label="Description" value={form.description} onChange={(v) => set("description", v)} error={errors.description} disabled={readOnly} />
                <TextArea id="job-responsibilities" label="Responsibilities" rows={5} value={form.responsibilities} onChange={(v) => set("responsibilities", v)} error={errors.responsibilities} disabled={readOnly} hint="One per line." />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={80}>
            <Card className="p-6">
              <CardHeader icon={Briefcase} title="Who you're looking for" subtitle="CVs are matched against the required skills" />
              <div className="mt-6 space-y-5">
                <SkillsInput id="job-skills" label="Required skills" value={form.requiredSkills} onChange={(v) => set("requiredSkills", v)} suggestions={suggestions} error={errors.requiredSkills} disabled={readOnly} />
                <SkillsInput id="job-soft-skills" label="Soft skills" tone="light" value={form.softSkills} onChange={(v) => set("softSkills", v)} error={errors.softSkills} disabled={readOnly} hint="Optional, for example communication or leadership." />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <AuthField label="Minimum years of experience" type="number" min="0" max={LIMITS.experienceYears} value={form.minExperienceYears} onChange={(e) => set("minExperienceYears", e.target.value)} error={errors.minExperienceYears} disabled={readOnly || lockedAfterPublish} hint={lockHint} />
                  <Select id="job-education" label="Education" value={form.educationLevel} onChange={(v) => set("educationLevel", v)} options={EDUCATION_LEVELS} error={errors.educationLevel} disabled={readOnly || lockedAfterPublish} hint={lockHint} />
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={120}>
            <Card className="p-6">
              <CardHeader icon={Banknote} title="Pay" subtitle="Optional. Whole numbers per year or per month, as you prefer; the currency is required with an amount" />
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <AuthField label="Salary from" type="number" min="0" value={form.salaryMin} onChange={(e) => set("salaryMin", e.target.value)} error={errors.salaryMin} disabled={readOnly} />
                <AuthField label="Salary to" type="number" min="0" value={form.salaryMax} onChange={(e) => set("salaryMax", e.target.value)} error={errors.salaryMax} disabled={readOnly} />
                <div>
                  <AuthField label="Currency" list="job-currencies" value={form.salaryCurrency} maxLength={LIMITS.currency} onChange={(e) => set("salaryCurrency", e.target.value.toUpperCase())} error={errors.salaryCurrency} disabled={readOnly} placeholder="PKR" />
                  <datalist id="job-currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2.5 text-[13.5px] text-stone-700">
                <input type="checkbox" checked={form.showSalary} disabled={readOnly} onChange={(e) => set("showSalary", e.target.checked)} /> Show the salary to candidates
              </label>
            </Card>
          </Reveal>

          <Reveal delay={160}>
            <Card className="p-6">
              <CardHeader icon={CalendarClock} title="Deadline" subtitle="Applications stop at this time (your time zone). Required to publish." />
              <div className="mt-6 max-w-sm">
                <label htmlFor="job-deadline" className="mb-1.5 block text-[13px] font-medium text-stone-700">Applications close</label>
                <input id="job-deadline" type="datetime-local" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} disabled={readOnly} aria-invalid={errors.deadline ? "true" : undefined} className="field" />
                <p className="mt-1.5 text-[12.5px] text-stone-500">Between 1 hour and about 6 months from now.{job?.daysLeft != null && isOpen && !expired ? ` ${job.daysLeft} ${job.daysLeft === 1 ? "day" : "days"} left.` : ""}</p>
                {errors.deadline && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{errors.deadline}</p>}
              </div>
            </Card>
          </Reveal>

          {customProblems.length > 0 && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-700">
              <p className="font-semibold">Fix these application questions first:</p>
              <ul className="mt-1 list-disc pl-5">{customProblems.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
        </form>

        {job ? (
          <Reveal delay={200}>
            <ApplicationFormBuilder key={job.id} job={job} canEdit onChanged={() => {}} />
          </Reveal>
        ) : (
          <p className="rounded-2xl bg-stone-50 p-4 text-[13.5px] text-stone-600">Save the role as a draft to add your own application questions.</p>
        )}
      </div>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 px-4 py-3 backdrop-blur lg:left-[256px]">
          {/* Buttons sit on the left: notifications appear bottom-right and must never cover them. */}
          <div className="mx-auto flex max-w-[1100px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
            {isOpen ? (
              <button type="button" disabled={working || !dirty} onClick={saveOpen} className="btn-primary">{saving && <Loader2 size={16} className="animate-spin" />} Save changes</button>
            ) : (
              <>
                <button type="button" disabled={working} onClick={saveDraft} className="btn-secondary">{saving && <Loader2 size={16} className="animate-spin" />} Save as draft</button>
                <button type="button" disabled={working} onClick={publish} className="btn-primary">{working && <Loader2 size={16} className="animate-spin" />} Publish role</button>
              </>
            )}
            {job && <Link to={`/company/jobs/${job.id}/preview`} className="btn-secondary">Preview</Link>}
            {dirty && <span className="text-[13px] text-stone-500 sm:ml-2">You have unsaved changes.</span>}
          </div>
        </div>
      )}

      {reopening && <ReopenDialog title={job.title} busy={actions.busy.has(job.id)} error={reopenError} onConfirm={reopen} onClose={() => setReopening(false)} />}
    </div>
  );
}
