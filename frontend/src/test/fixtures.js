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
