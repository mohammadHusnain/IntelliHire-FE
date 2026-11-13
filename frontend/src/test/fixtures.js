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
