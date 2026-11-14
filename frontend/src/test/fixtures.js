// The backend contract as the tests see it. Bodies copy the real error shapes (verified against the
// running backend by `npm run test:contract`).
import { HttpResponse, http } from "msw";

export const API = "http://api.test/api";

export const apiUser = (overrides = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "sara@example.com",
  full_name: "Sara Malik",
  role: "candidate",
  status: "active",
  company: null,
  ...overrides,
});

export const companyUser = (overrides = {}) =>
  apiUser({
    id: "22222222-2222-2222-2222-222222222222",
    email: "hr@acme.example",
    full_name: "Ali Khan",
    role: "company_admin",
    company: { id: "c0", name: "Acme", member_role: "admin", status: "approved" },
    ...overrides,
  });

export const apiProfile = (overrides = {}) => ({
  phone: "",
  headline: "",
  location: "",
  bio: "",
  target_role: "",
  experience_level: "",
  avatar: null,
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  skills: [],
  resume: null,
  resume_name: "",
  updated_at: "2026-01-01T00:00:00Z",
  education: [],
  experience: [],
  ...overrides,
});

export const tokens = (n = 1) => ({ access: `access-${n}`, refresh: `refresh-${n}` });

export const json = (body, status = 200) => HttpResponse.json(body, { status });
export const detail = (status, message, code) => json({ detail: message, code }, status);

export const errors = {
  invalidCredentials: () => detail(401, "Invalid email or password.", "invalid_credentials"),
  pendingVerification: () => detail(403, "Please verify your email before logging in.", "pending_verification"),
  pendingApproval: () => detail(403, "Your company account is awaiting administrator approval.", "pending_approval"),
  rejected: () => detail(403, "Your company registration was not approved.", "rejected"),
  suspended: () => detail(403, "Your account has been suspended.", "suspended"),
  accountInactive: () => detail(401, "Account is not active.", "account_inactive"),
  tokenInvalid: () => detail(401, "Given token not valid for any token type", "token_not_valid"),
  throttled: (seconds = 58) => detail(429, `Request was throttled. Expected available in ${seconds} seconds.`, "throttled"),
  denied: () => detail(403, "Unauthorized access.", "permission_denied"),
  expired: () => detail(400, "This verification link has expired.", "expired"),
  invalidLink: () => detail(400, "Invalid verification link.", "invalid_token"),
  tooLarge: () => detail(413, "The request is too large.", "request_too_large"),
};

/** Routes a test can register: `server.use(...handlers)`. */
export const route = {
  get: (path, resolver) => http.get(`${API}${path}`, resolver),
  post: (path, resolver) => http.post(`${API}${path}`, resolver),
  put: (path, resolver) => http.put(`${API}${path}`, resolver),
  patch: (path, resolver) => http.patch(`${API}${path}`, resolver),
  delete: (path, resolver) => http.delete(`${API}${path}`, resolver),
};

export const bearer = (request) => request.headers.get("authorization");

// ── Module 2 ──────────────────────────────────────────────────────────────────
export const apiCompanyProfile = (overrides = {}) => ({
  id: "c0",
  name: "Acme",
  slug: "acme",
  industry: "Technology",
  official_email: "hr@acme.example",
  contact_phone: "+92 300 1234567",
  website: "",
  description: "",
  headquarters: "",
  logo: null,
  company_size: "",
  status: "approved",
  profile_completion: 0,
  created_at: "2026-01-05T10:00:00Z",
  ...overrides,
});

export const apiMember = (overrides = {}) => ({
  id: 1,
  full_name: "Ali Khan",
  email: "hr@acme.example",
  role: "admin",
  job_title: "",
  joined_at: "2026-01-01T00:00:00Z",
  is_active: true,
  last_login: null,
  ...overrides,
});

export const apiInvitation = (overrides = {}) => ({
  id: "inv-1",
  email: "newbie@acme.example",
  full_name: "New Hire",
  role: "recruiter",
  job_title: "",
  status: "pending",
  created_at: "2026-02-01T00:00:00Z",
  expires_at: "2026-02-08T00:00:00Z",
  accepted_at: null,
  ...overrides,
});

export const apiDashboard = (overrides = {}) => ({
  company: { name: "Acme", logo: null, status: "approved", profile_completion: 40 },
  jobs: { open: 2, draft: 1, closed: 3 },
  applicants: { total: 10, new_last_7_days: 4 },
  pipeline: { submitted: 3, under_review: 2, shortlisted: 2, interview: 1, selected: 1, rejected: 1, on_hold: 0 },
  closing_soon: [{ id: "j1", title: "Backend Engineer", deadline: "2026-03-01T00:00:00Z", application_count: 5 }],
  recent_applications: [{ id: "app-1", candidate_name: "Sara Malik", job_title: "Backend Engineer", submitted_at: "2026-02-28T00:00:00Z", status: "submitted" }],
  team: { active_members: 3, pending_invitations: 1 },
  ...overrides,
});

export const apiAdminCompany = (overrides = {}) => ({
  id: "co-1",
  name: "Acme",
  industry: "Technology",
  official_email: "hr@acme.example",
  contact_phone: "+92 300 1234567",
  status: "pending",
  created_at: "2026-01-02T00:00:00Z",
  admin: { id: "u-1", full_name: "Ali Khan", email: "hr@acme.example", email_verified: true, status: "pending_approval", date_joined: "2026-01-02T00:00:00Z" },
  ...overrides,
});

export const paged = (results, extra = {}) => json({ count: results.length, next: null, previous: null, results, ...extra });

// ── Module 3 ──────────────────────────────────────────────────────────────────
export const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

export const apiJobRow = (overrides = {}) => ({
  id: "job-1",
  title: "Senior Django Engineer",
  department: "Engineering",
  employment_type: "full_time",
  work_mode: "hybrid",
  location: "Lahore",
  status: "open",
  deadline: future(10),
  days_left: 10,
  applications_count: 0,
  share_url: "http://localhost:5173/apply/slug123456",
  created_at: "2026-02-01T00:00:00Z",
  published_at: "2026-02-02T00:00:00Z",
  ...overrides,
});

export const apiField = (overrides = {}) => ({
  id: 1,
  label: "LinkedIn profile",
  key: "linkedin_profile",
  field_type: "url",
  required: false,
  options: [],
  help_text: "",
  max_length: null,
  order: 0,
  ...overrides,
});

export const apiJob = (overrides = {}) => ({
  ...apiJobRow(),
  description: "Build the platform.",
  responsibilities: "Write code\nReview code",
  required_skills: ["Python", "Django"],
  soft_skills: ["Communication"],
  min_experience_years: 3,
  education_level: "bachelor",
  salary_min: 100000,
  salary_max: 200000,
  salary_currency: "PKR",
  show_salary: true,
  openings: 2,
  form_slug: "slug123456",
  close_reason: null,
  closed_at: null,
  updated_at: "2026-02-03T00:00:00Z",
  created_by: { id: "u1", full_name: "Ali Khan" },
  custom_fields: [],
  ...overrides,
});

export const apiSchema = (overrides = {}) => ({
  accepting: true,
  message: null,
  job: {
    title: "Senior Django Engineer",
    company: { name: "Acme", logo: null },
    department: "Engineering",
    location: "Lahore",
    work_mode: "hybrid",
    employment_type: "full_time",
    description: "Build the platform.",
    responsibilities: "Write code\nReview code",
    required_skills: ["Python", "Django"],
    soft_skills: ["Communication"],
    deadline: future(10),
    salary: { min: 100000, max: 200000, currency: "PKR" },
  },
  fields: [
    { key: "full_name", label: "Full name", type: "short_text", required: true, options: [], option_labels: null, help_text: "", max_length: 150, built_in: true },
    { key: "email", label: "Email", type: "email", required: true, options: [], option_labels: null, help_text: "", max_length: 254, built_in: true },
    { key: "phone", label: "Phone number", type: "short_text", required: true, options: [], option_labels: null, help_text: "Digits, spaces, + and - only.", max_length: 20, built_in: true },
    { key: "education_level", label: "Highest education level", type: "single_choice", required: true, options: ["none", "bachelor"], option_labels: { none: "None", bachelor: "Bachelor's degree" }, help_text: "", max_length: null, built_in: true },
    { key: "institution", label: "Institution", type: "short_text", required: true, options: [], option_labels: null, help_text: "", max_length: 200, built_in: true },
    { key: "graduation_year", label: "Graduation year", type: "number", required: true, options: [], option_labels: null, help_text: "", max_length: null, built_in: true },
    { key: "resume", label: "CV", type: "file", required: true, options: [], option_labels: null, help_text: "PDF or DOCX, 5 MB or smaller.", max_length: null, built_in: true },
  ],
  ...overrides,
});

// ── Module 4 ──────────────────────────────────────────────────────────────────
export const apiApplicationRow = (overrides = {}) => ({
  id: "app-1",
  reference: "IH-AAA111",
  full_name: "Sara Malik",
  email: "sara@example.com",
  phone: "+92 300 1234567",
  education_level: "bachelor",
  institution: "NUST",
  status: "submitted",
  submitted_at: "2026-03-01T10:00:00Z",
  has_cv: true,
  ...overrides,
});

export const apiApplication = (overrides = {}) => ({
  id: "app-1",
  reference: "IH-AAA111",
  status: "submitted",
  submitted_at: "2026-03-01T10:00:00Z",
  updated_at: "2026-03-01T10:00:00Z",
  job: { id: "job-1", title: "Senior Django Engineer" },
  full_name: "Sara Malik",
  email: "sara@example.com",
  phone: "+92 300 1234567",
  education_level: "bachelor",
  institution: "NUST",
  graduation_year: 2020,
  resume: { name: "cv.pdf", url: "/api/applications/app-1/resume/" },
  answers: [],
  status_history: [{ from_status: null, to_status: "submitted", changed_by: null, note: "", changed_at: "2026-03-01T10:00:00Z" }],
  notes: [],
  ...overrides,
});

export const apiNote = (overrides = {}) => ({ id: 1, text: "Spoke on the phone", author: { id: "u1", full_name: "Ali Khan" }, created_at: "2026-03-02T10:00:00Z", ...overrides });

export const statusCounts = (overrides = {}) => ({ submitted: 0, under_review: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0, on_hold: 0, total: 0, ...overrides });

// ── Module 12 (talent communities) ───────────────────────────────────────────
export const apiCommunityFilters = (overrides = {}) => ({
  universities: ["NUST"], degrees: ["Computer Science"], grad_year_from: 2025, grad_year_to: 2026,
  skills: ["Python"], skill_mode: "any", ...overrides,
});

export const apiCommunity = (overrides = {}) => ({
  id: "com-1",
  name: "NUST Computer Science 2026",
  slug: "nust-cs-2026",
  description: "Graduate roles for this cohort.",
  mission: "Internships and graduate roles",
  join_mode: "request",
  status: "active",
  member_count: 3,
  filters: apiCommunityFilters(),
  created_at: "2026-05-01T09:00:00Z",
  ...overrides,
});

/** A candidate discovery row: a community plus the company, my eligibility and my state. */
export const apiDiscoveryRow = ({ eligible = true, reasons = [], state = "none", ...overrides } = {}) => ({
  ...apiCommunity(overrides),
  company: { id: "c0", name: "Acme" },
  eligibility: { eligible, reasons },
  state,
});

/** `profile_summary`: never an email, a phone number or a CV (P2-9). */
export const apiCandidateSummary = (overrides = {}) => ({
  id: "u-cand-1", full_name: "Sara Malik", headline: "Backend engineer",
  institution: "NUST", degree: "Computer Science", skills: ["Python", "Django"], ...overrides,
});

export const apiCommunityMember = (overrides = {}) => ({ ...apiCandidateSummary(), joined_at: "2026-05-10T09:00:00Z", source: "request", skill_match: 1, ...overrides });
export const apiCommunityInvitation = (overrides = {}) => ({
  id: "inv-1", user_id: "u-cand-1", full_name: "Sara Malik", message: "Join us",
  status: "pending", created_at: "2026-05-11T09:00:00Z", expires_at: "2026-05-25T09:00:00Z", ...overrides,
});
export const apiCandidateInvitation = (overrides = {}) => ({
  id: "inv-1", message: "Join us", created_at: "2026-05-11T09:00:00Z", expires_at: "2026-05-25T09:00:00Z",
  community: apiDiscoveryRow({ state: "invited" }), ...overrides,
});
export const apiJoinRequest = ({ eligible = true, reasons = [], ...overrides } = {}) => ({
  id: "req-1", candidate: apiCandidateSummary(), message: "I would like to join", status: "pending",
  eligibility: { eligible, reasons }, created_at: "2026-05-12T09:00:00Z", reviewed_at: null, decision_reason: "", ...overrides,
});
export const apiCommunityPost = (overrides = {}) => ({
  id: "post-1", community_id: "com-1", kind: "job", title: "Graduate backend engineer",
  body: "We are hiring from this cohort.", job_id: null, apply_url: "", closes_at: null,
  closed: false, status: "published", created_at: "2026-05-13T09:00:00Z", responses: 0, ...overrides,
});
export const apiPostResponse = (overrides = {}) => ({ candidate: apiCandidateSummary(), message: "Interested", created_at: "2026-05-14T09:00:00Z", ...overrides });

// ── Module 13 (platform admin) ───────────────────────────────────────────────
export const apiAdminDashboard = (overrides = {}) => ({
  users: { by_role: { candidate: 30, company_admin: 5, hr: 4, admin: 1 }, by_status: { active: 38, suspended: 2 }, total: 40 },
  companies: { by_status: { approved: 6, pending: 1, suspended: 2 }, pending_review: 1 },
  jobs: { open: 7, by_status: { draft: 2, open: 7, closed: 3 } },
  applications: { last_7_days: 4, last_30_days: 18, total: 52 },
  interviews_30_days: { screening: 6, technical: 2, mock: 9 },
  communities: { total: 3 },
  moderation: { open_flags: 2 },
  alerts: { active: 0 },
  ai_24h: { calls: 120, failures: 3, average_latency_ms: 840, prompt_tokens: 9000, completion_tokens: 3000 },
  ...overrides,
});

export const apiHealth = (overrides = {}) => ({
  database: { ok: true, detail: "" },
  storage: { ok: true, detail: "" },
  broker: { ok: true, detail: "" },
  worker: { ok: true, last_heartbeat: "2026-06-01T09:00:00Z", seconds_since: 12 },
  email: { queued: 1, failed: 0 },
  ai_last_hour: { calls: 10, failures: 0, failure_rate: 0, last_successful_at: "2026-06-01T08:55:00Z" },
  resources: { cpu_percent: 21, memory_percent: 48, disk_percent: 63 },
  alerts: { active: 0 },
  backup: { last_successful_at: "2026-06-01T02:00:00Z", size_bytes: 1024, warning: "" },
  checked_at: "2026-06-01T09:00:00Z",
  ...overrides,
});

export const apiAlert = (overrides = {}) => ({
  id: "alert-1", kind: "worker.down", severity: "critical", message: "No worker heartbeat in 10 minutes.",
  is_active: true, created_at: "2026-06-01T08:00:00Z", acknowledged_at: null, resolved_at: null, ...overrides,
});

export const apiFlag = (overrides = {}) => ({
  id: "flag-1", target_type: "community", target_id: "com-1", target: { label: "NUST Computer Science 2026" },
  reason: "Looks like spam", source: "reported", status: "open", reported_by: "Sara Malik",
  resolution_note: "", action_taken: "none", resolved_by: "", created_at: "2026-06-01T07:00:00Z", resolved_at: null, ...overrides,
});

export const apiActivityEvent = (overrides = {}) => ({
  id: "evt-1", event_type: "company.approved", summary: "Acme was approved",
  actor: { id: "admin", full_name: "Admin" }, company_id: "c0", target_type: "company", target_id: "c0",
  metadata: { reason: "" }, created_at: "2026-06-01T06:00:00Z", ...overrides,
});

export const apiAiSettings = (overrides = {}) => ({
  provider: "fake", chat_model: "gpt-4o-mini", eval_model: "gpt-4o-mini", embed_model: "text-embedding-3-small",
  stt_model: "whisper-1", fallback_provider: "", fallback_chat_model: "",
  temperature_questions: 0.7, temperature_evaluation: 0.2, max_tokens: 1200, timeout_seconds: 30,
  screening_min_score: 60, screening_questions: 6, technical_questions: 8, mock_questions: 6,
  updated_at: "2026-06-01T09:00:00Z", ...overrides,
});

export const apiPromptVersion = (overrides = {}) => ({
  key: "cv_extract", version: 2, model_role: "chat", system_text: "You extract CV fields.",
  user_text: "CV: {cv_text}", output_schema: {}, is_active: true, created_by: "Admin",
  created_at: "2026-06-01T09:00:00Z", ...overrides,
});

export const apiAiUsageRow = (overrides = {}) => ({
  day: "2026-06-01", feature: "cv_extract", calls: 12, failures: 1,
  prompt_tokens: 800, completion_tokens: 200, average_latency_ms: 910, ...overrides,
});

export const apiUserDetail = (overrides = {}) => ({
  id: "u-1", full_name: "Sara Malik", email: "sara@example.com", role: "candidate", status: "active",
  email_verified: true, date_joined: "2026-01-01T09:00:00Z", last_login: "2026-06-01T08:00:00Z",
  company: null, counts: { applications: 4 },
  recent_activity: [{ id: "evt-1", event_type: "application.submitted", summary: "Applied to Django Engineer", created_at: "2026-05-30T09:00:00Z" }],
  open_flags: [], ...overrides,
});

export const apiCompanyOnboarding = (overrides = {}) => ({
  profile_completion: 80,
  members_by_role: { admin: 1, hr_manager: 2 },
  jobs_by_status: { open: 3, closed: 1 },
  applications_total: 24,
  communities: 2,
  staff: [{ id: "u-2", full_name: "Ali Khan", email: "ali@acme.example", role: "admin", status: "active", is_active: true, joined_at: "2026-02-01T09:00:00Z" }],
  open_flags: [],
  ...overrides,
});

// ── Module 6 (CV analysis and shortlisting) ──────────────────────────────────
export const apiScreeningConfig = (overrides = {}) => ({
  auto_analyse: true,
  shortlist_threshold: 70,
  auto_shortlist: false,
  invite_on_shortlist: false,
  weight_skills: 50,
  weight_experience: 25,
  weight_education: 15,
  weight_semantic: 10,
  updated_at: "2026-06-01T09:00:00Z",
  warnings: [],
  ...overrides,
});

/** `percent_done` is the server's "done out of analysed", not out of every application. */
export const apiScreeningProgress = (overrides = {}) => ({
  total_applications: 3,
  not_analysed: 1,
  queued: 0,
  processing: 0,
  completed: 2,
  failed: 0,
  manual_review: 0,
  paused: 0,
  stale_scores: 0,
  in_progress: false,
  percent_done: 100,
  ...overrides,
});

export const apiRankingRow = (overrides = {}) => ({
  rank: 1,
  id: "app-1",
  reference: "IH-000001",
  full_name: "Sara Malik",
  email: "sara@example.com",
  status: "under_review",
  submitted_at: "2026-06-03T12:00:00Z",
  score: 84.5,
  skills_score: 90,
  experience_score: 75,
  education_score: 80,
  semantic_score: 70,
  cv_label: "meets_threshold",
  analysis_status: "completed",
  stale: false,
  ...overrides,
});

export const apiCvAnalysis = ({ match, ...overrides } = {}) => ({
  status: "completed",
  failure_reason: "",
  flags: [],
  parsed: {
    technical_skills: ["Python", "Django"],
    soft_skills: ["Communication"],
    education: [{ degree: "MSc Computer Science", institution: "UCL", year: "2022" }],
    experience: [{ role: "Backend Engineer", company: "Acme", start: "2022", end: "Present" }],
    projects: [{ name: "Hiring API", summary: "Built a recruiting service" }],
    achievements: ["Open-source contributor"],
  },
  attempts: 1,
  analysed_at: "2026-06-03T12:00:00Z",
  cv_label: "meets_threshold",
  notice: "Scores and the explanation are generated automatically to support, not replace, a person's review.",
  match: match === null ? null : {
    score: 84.5,
    skills_score: 90,
    experience_score: 75,
    education_score: 80,
    semantic_score: 70,
    matched_skills: ["Python", "Django"],
    missing_skills: ["Kubernetes"],
    experience_years: 4,
    weights_used: { weight_skills: 50, weight_experience: 25, weight_education: 15, weight_semantic: 10 },
    explanation: "Strong backend skills with relevant experience.",
    explanation_is_ai_generated: true,
    stale: false,
    computed_at: "2026-06-03T12:00:00Z",
    ...match,
  },
  ...overrides,
});
