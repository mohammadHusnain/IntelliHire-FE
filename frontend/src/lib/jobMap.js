// Job postings and the application form: backend data <-> the shapes the job screens use.
// One place for enums, labels, limits, error-field names, the deadline's time zone and who may do what.

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];
export const WORK_MODES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];
export const EDUCATION_LEVELS = [
  { value: "none", label: "No requirement" },
  { value: "intermediate", label: "Intermediate" },
  { value: "bachelor", label: "Bachelor's degree" },
  { value: "master", label: "Master's degree" },
  { value: "phd", label: "PhD" },
];
const labelOf = (list, value) => list.find((o) => o.value === value)?.label ?? value ?? "";
export const employmentLabel = (v) => labelOf(EMPLOYMENT_TYPES, v);
export const workModeLabel = (v) => labelOf(WORK_MODES, v);
export const educationLabel = (v) => labelOf(EDUCATION_LEVELS, v);

export const JOB_STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "success" },
  closed: { label: "Closed", tone: "danger" },
};
export const JOB_TABS = ["open", "draft", "closed"];

// Limits the server enforces (mirrored so people are told before a round trip).
export const LIMITS = {
  title: 150,
  department: 100,
  location: 200,
  text: 10000,
  skills: 30,
  skill: 50,
  openings: 1000,
  experienceYears: 30,
  salary: 1_000_000_000,
  currency: 10,
  customFields: 30,
  fieldLabel: 150,
  option: 100,
  options: { min: 2, max: 20 },
  helpText: 500,
  fieldMaxLength: 5000,
};

/** Application-form field types the builder offers. */
export const FIELD_TYPES = [
  { value: "short_text", label: "Short text", text: true },
  { value: "long_text", label: "Long text", text: true },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "url", label: "Link (URL)" },
  { value: "date", label: "Date" },
  { value: "single_choice", label: "Single choice", choice: true },
  { value: "multiple_choice", label: "Multiple choice", choice: true },
  { value: "file", label: "File (PDF or DOCX)" },
];
export const fieldTypeLabel = (v) => FIELD_TYPES.find((t) => t.value === v)?.label ?? v;
export const isChoiceType = (v) => Boolean(FIELD_TYPES.find((t) => t.value === v)?.choice);
export const isTextType = (v) => Boolean(FIELD_TYPES.find((t) => t.value === v)?.text);

// ── Who may do what (the server is the real gate) ───────────────────────────────
export const canEditJobs = (user) => ["admin", "hr_manager", "recruiter"].includes(user?.memberRole);
export const canManageJobs = (user) => ["admin", "hr_manager"].includes(user?.memberRole);

// ── Deadline: typed in the person's time zone, stored as an instant ──────────────
const pad = (n) => String(n).padStart(2, "0");

/** ISO instant -> value for <input type="datetime-local"> in the browser's time zone. */
export function toDateTimeInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (browser time zone) -> ISO instant, or null when empty/invalid. */
export function fromDateTimeInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDeadline(iso) {
  if (!iso) return "No deadline";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const time = (v) => (v ? Date.parse(v) || null : null);

/** A row of GET /jobs/. `days_left` comes from the server; 0 on an open job means the deadline has passed. */
export function mapJobRow(j) {
  return {
    id: j.id,
    title: j.title,
    department: j.department || "",
    employmentType: j.employment_type || "",
    workMode: j.work_mode || "",
    location: j.location || "",
    status: j.status,
    deadline: j.deadline || null,
    daysLeft: j.days_left ?? null,
    applicationsCount: j.applications_count ?? 0,
    shareUrl: j.share_url || null,
    createdAt: time(j.created_at),
    publishedAt: time(j.published_at),
    // An open job whose deadline passed is still "open" on the server until the clean-up command runs.
    expired: j.status === "open" && j.days_left === 0,
  };
}

export function mapCustomField(f) {
  return {
    id: f.id,
    label: f.label,
    key: f.key,
    type: f.field_type,
    required: Boolean(f.required),
    options: Array.isArray(f.options) ? f.options : [],
    helpText: f.help_text || "",
    maxLength: f.max_length ?? null,
    order: f.order ?? 0,
  };
}

/** GET /jobs/<id>/ */
export function mapJob(j) {
  return {
    ...mapJobRow(j),
    description: j.description || "",
    responsibilities: j.responsibilities || "",
    requiredSkills: Array.isArray(j.required_skills) ? j.required_skills : [],
    softSkills: Array.isArray(j.soft_skills) ? j.soft_skills : [],
    minExperienceYears: j.min_experience_years ?? 0,
    educationLevel: j.education_level || "none",
    salaryMin: j.salary_min ?? "",
    salaryMax: j.salary_max ?? "",
    salaryCurrency: j.salary_currency || "",
    showSalary: Boolean(j.show_salary),
    openings: j.openings ?? 1,
    formSlug: j.form_slug || null,
    closeReason: j.close_reason || null,
    closedAt: time(j.closed_at),
    updatedAt: time(j.updated_at),
    createdBy: j.created_by?.full_name || "",
    customFields: (j.custom_fields || []).map(mapCustomField),
  };
}

/** The blank form of a new job. */
export const blankJobForm = () => ({
  title: "", department: "", description: "", responsibilities: "", employmentType: "", workMode: "", location: "",
  requiredSkills: [], softSkills: [], minExperienceYears: 0, educationLevel: "none",
  salaryMin: "", salaryMax: "", salaryCurrency: "", showSalary: false, openings: 1, deadline: "",
});

/** A saved job as the form edits it (the deadline as a local date-time string). */
export function formFromJob(job) {
  return {
    title: job.title, department: job.department, description: job.description, responsibilities: job.responsibilities,
    employmentType: job.employmentType, workMode: job.workMode, location: job.location,
    requiredSkills: [...job.requiredSkills], softSkills: [...job.softSkills],
    minExperienceYears: job.minExperienceYears, educationLevel: job.educationLevel,
    salaryMin: job.salaryMin === "" ? "" : String(job.salaryMin), salaryMax: job.salaryMax === "" ? "" : String(job.salaryMax),
    salaryCurrency: job.salaryCurrency, showSalary: job.showSalary, openings: job.openings, deadline: toDateTimeInput(job.deadline),
  };
}

const intOrNull = (v) => (v === "" || v == null ? null : Number(v));

// form key -> [backend key, convert]
const WRITE = {
  title: ["title", (v) => v.trim()],
  department: ["department", (v) => v.trim()],
  description: ["description", (v) => v.trim()],
  responsibilities: ["responsibilities", (v) => v.trim()],
  employmentType: ["employment_type", (v) => v],
  workMode: ["work_mode", (v) => v],
  location: ["location", (v) => v.trim()],
  requiredSkills: ["required_skills", (v) => v],
  softSkills: ["soft_skills", (v) => v],
  minExperienceYears: ["min_experience_years", (v) => Number(v) || 0],
  educationLevel: ["education_level", (v) => v],
  salaryMin: ["salary_min", intOrNull],
  salaryMax: ["salary_max", intOrNull],
  salaryCurrency: ["salary_currency", (v) => v.trim()],
  showSalary: ["show_salary", (v) => Boolean(v)],
  openings: ["openings", (v) => Number(v) || 1],
  deadline: ["deadline", fromDateTimeInput],
};

/** The whole form as a request body (create). Empty optional fields are left out. */
export function jobBody(form) {
  const body = {};
  for (const [key, [field, convert]] of Object.entries(WRITE)) {
    const value = convert(form[key]);
    if (value === "" || value === null || value === undefined) continue;
    body[field] = value;
  }
  return body;
}

/** Only what differs from `base`, under backend names (update). A cleared salary or deadline is sent as null. */
export function changedJobFields(form, base) {
  const changes = {};
  for (const [key, [field, convert]] of Object.entries(WRITE)) {
    const next = convert(form[key]);
    const before = convert(base[key]);
    if (JSON.stringify(next) !== JSON.stringify(before)) changes[field] = next;
  }
  return changes;
}

// Backend field -> form field, so server messages land on the right input.
export const JOB_FIELD_TO_FORM = Object.fromEntries(Object.entries(WRITE).map(([form, [field]]) => [field, form]));

/** {backend_field: [msg]} -> {formField: firstMessage}; unknown keys (such as custom_fields) keep their name. */
export function mapJobErrors(fieldErrors = {}) {
  const mapped = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const list = Array.isArray(messages) ? messages : [String(messages)];
    mapped[JOB_FIELD_TO_FORM[field] || field] = list[0];
    if (field === "custom_fields") mapped.customFieldsAll = list;
  }
  return mapped;
}

/** Salary text for the preview and the public page, in the job's own currency. */
export function formatSalary(salary) {
  if (!salary) return null;
  const n = (v) => (v == null ? null : Number(v).toLocaleString("en-US"));
  const cur = salary.currency ? `${salary.currency} ` : "";
  if (salary.min != null && salary.max != null) return `${cur}${n(salary.min)} – ${n(salary.max)}`;
  if (salary.min != null) return `From ${cur}${n(salary.min)}`;
  return `Up to ${cur}${n(salary.max)}`;
}

// ── Custom field forms ──────────────────────────────────────────────────────────
export const blankFieldForm = () => ({ label: "", type: "short_text", required: false, options: [], helpText: "", maxLength: "" });

export const formFromField = (f) => ({ label: f.label, type: f.type, required: f.required, options: [...f.options], helpText: f.helpText, maxLength: f.maxLength == null ? "" : String(f.maxLength) });

export function fieldBody(form) {
  const body = { label: form.label.trim(), field_type: form.type, required: Boolean(form.required), help_text: form.helpText.trim() };
  body.options = isChoiceType(form.type) ? form.options.map((o) => o.trim()) : [];
  body.max_length = isTextType(form.type) && form.maxLength !== "" ? Number(form.maxLength) : null;
  return body;
}

const FIELD_ERROR_KEYS = { label: "label", field_type: "type", required: "required", options: "options", help_text: "helpText", max_length: "maxLength" };
export function mapFieldErrors(fieldErrors = {}) {
  const mapped = {};
  for (const [field, messages] of Object.entries(fieldErrors)) mapped[FIELD_ERROR_KEYS[field] || field] = Array.isArray(messages) ? messages[0] : String(messages);
  return mapped;
}

/** Client-side check mirroring the server's rules for one custom field. Returns { key: message }. */
export function fieldProblems(form) {
  const problems = {};
  if (!form.label.trim()) problems.label = "Give the question a label";
  if (isChoiceType(form.type)) {
    const options = form.options.map((o) => o.trim());
    if (options.some((o) => !o)) problems.options = "Options cannot be empty";
    else if (options.length < LIMITS.options.min || options.length > LIMITS.options.max) problems.options = `Add between ${LIMITS.options.min} and ${LIMITS.options.max} options`;
    else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) problems.options = "Options must be unique";
  }
  if (isTextType(form.type) && form.maxLength !== "") {
    const n = Number(form.maxLength);
    if (!Number.isInteger(n) || n < 1 || n > LIMITS.fieldMaxLength) problems.maxLength = `Use a whole number from 1 to ${LIMITS.fieldMaxLength}`;
  }
  return problems;
}

/** Client-side check of the job form before "Publish" (the server's list, keyed by form field). Drafts need only title and department. */
export function publishProblems(form) {
  const p = {};
  if (!form.title.trim()) p.title = "Title is required";
  if (!form.department.trim()) p.department = "Department is required";
  if (!form.description.trim()) p.description = "Describe the role";
  if (!form.requiredSkills.length) p.requiredSkills = "Add at least one required skill";
  if (!form.employmentType) p.employmentType = "Choose an employment type";
  if (form.workMode !== "remote" && !form.location.trim()) p.location = "Add a location, or choose Remote";
  if (!form.deadline) p.deadline = "Set a deadline";
  Object.assign(p, draftProblems(form));
  return p;
}

/** Problems that block even a draft (the same rules the server applies to every save). */
export function draftProblems(form) {
  const p = {};
  if (!form.title.trim()) p.title = "Give the role a title";
  else if (form.title.trim().length > LIMITS.title) p.title = `Keep the title under ${LIMITS.title} characters`;
  if (!form.department.trim()) p.department = "Department is required";
  if (form.description.length > LIMITS.text) p.description = `Keep it under ${LIMITS.text.toLocaleString()} characters`;
  if (form.responsibilities.length > LIMITS.text) p.responsibilities = `Keep it under ${LIMITS.text.toLocaleString()} characters`;
  const min = form.salaryMin === "" ? null : Number(form.salaryMin);
  const max = form.salaryMax === "" ? null : Number(form.salaryMax);
  for (const [key, value] of [["salaryMin", min], ["salaryMax", max]]) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > LIMITS.salary)) p[key] = "Use a whole number";
  }
  if (!p.salaryMin && !p.salaryMax && min !== null && max !== null && max < min) p.salaryMax = "Maximum must be at least the minimum";
  if ((min !== null || max !== null) && !form.salaryCurrency.trim()) p.salaryCurrency = "Add the currency (for example PKR or USD)";
  if (form.salaryCurrency.length > LIMITS.currency) p.salaryCurrency = `Use at most ${LIMITS.currency} characters`;
  const openings = Number(form.openings);
  if (!Number.isInteger(openings) || openings < 1 || openings > LIMITS.openings) p.openings = `Use a whole number from 1 to ${LIMITS.openings}`;
  const years = Number(form.minExperienceYears);
  if (!Number.isInteger(years) || years < 0 || years > LIMITS.experienceYears) p.minExperienceYears = `Use a whole number from 0 to ${LIMITS.experienceYears}`;
  return p;
}
