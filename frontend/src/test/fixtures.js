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
  recent_applications: [{ candidate_name: "Sara Malik", job_title: "Backend Engineer", submitted_at: "2026-02-28T00:00:00Z", status: "submitted" }],
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
