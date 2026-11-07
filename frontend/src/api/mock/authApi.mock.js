// ─── Mock auth API (demo mode only) ─────────────────────────────────────────────
// Same methods as the real API, backed by localStorage. Only used when VITE_USE_MOCK_API=true.
import { getPlatformSettings } from "@/store/platformStore";
import { getTokens } from "../tokenStorage";
import { ApiError } from "../errors";
import { ADMIN_CREDENTIALS, ADMIN_USER, SEED_PASSWORDS } from "./credentials";
import {
  REGISTERED_USERS_KEY,
  assertCanSignIn,
  delay,
  generateToken,
  loadUsers,
  readJson,
  sanitizeUser,
  saveRegisteredUser,
  writeJson,
} from "./accounts";

const passwordOf = (user) => user.password ?? SEED_PASSWORDS[user.email];
const fail = (message, code = "error") => new ApiError({ status: 400, code, message });

function register(form, isCompany) {
  const policy = getPlatformSettings();
  if (isCompany && !policy.allowCompanySignup) throw fail("Company sign-ups are paused right now. Please try again later.");
  if (!isCompany && !policy.allowCandidateSignup) throw fail("Candidate sign-ups are paused right now. Please try again later.");
  const email = form.email.trim().toLowerCase();
  if (loadUsers().some((u) => u.email === email)) {
    throw new ApiError({ status: 400, code: "validation_error", message: "Please check the highlighted fields.", fieldErrors: { email: ["Email already registered."] } });
  }
  const now = Date.now();
  const user = {
    id: `usr_${now}`,
    email,
    name: form.fullName,
    role: isCompany ? "company" : "candidate",
    status: isCompany && !policy.autoApproveCompanies ? "pending" : "active",
    createdAt: now,
    ...(isCompany
      ? { companyName: form.companyName, industry: form.industry, companySize: form.companySize || "", website: form.website || "", description: form.description || "", logoFileName: "", profileComplete: true }
      : { desiredRole: form.targetRole || "", skills: form.skills || [], linkedIn: form.linkedinUrl || "", github: form.githubUrl || "", cvFileName: form.cvFile?.name || "" }),
  };
  saveRegisteredUser({ ...user, password: form.password });
  return { email, status: "pending_verification" };
}

export const mockAuthApi = {
  async login(email, password) {
    await delay();
    if (email?.toLowerCase() === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      return { user: ADMIN_USER, tokens: { access: `admin|${Date.now()}`, refresh: "mock-refresh" } };
    }
    const user = loadUsers().find((u) => u.email === email && passwordOf(u) === password);
    if (!user) throw new ApiError({ status: 401, code: "invalid_credentials", message: "Invalid email or password." });
    assertCanSignIn(user);
    return { user: sanitizeUser(user), tokens: { access: generateToken(user.id), refresh: "mock-refresh" } };
  },

  async registerCandidate(form) {
    await delay();
    return register(form, false);
  },

  async registerCompany(form) {
    await delay();
    return register(form, true);
  },

  async verifyEmail() {
    await delay(300);
    return { detail: "Email verified.", status: "active" };
  },
  async resendVerification() {
    await delay(300);
    return { detail: "If that email needs verification, a new link has been sent." };
  },
  async forgotPassword() {
    await delay();
    return { detail: "If that email is registered, a reset link has been sent." };
  },
  async resetPassword() {
    await delay(300);
    return { detail: "Password updated." };
  },

  async changePassword({ current, next }) {
    await delay(700);
    const email = (await this.me()).email;
    if (email in SEED_PASSWORDS) throw fail("Demo accounts can't change their password. Register your own account to try this.");
    const stored = readJson(REGISTERED_USERS_KEY, []);
    const index = stored.findIndex((u) => u.email === email);
    if (index === -1) throw fail("Account not found.");
    if (stored[index].password !== current) {
      throw new ApiError({ status: 400, code: "validation_error", message: "Please check the highlighted fields.", fieldErrors: { old_password: ["Current password is incorrect."] } });
    }
    stored[index] = { ...stored[index], password: next };
    writeJson(REGISTERED_USERS_KEY, stored);
    return { detail: "Password updated." };
  },

  /** The demo "session": the access token encodes the user id. */
  async me() {
    await delay(400);
    const token = getTokens()?.access;
    if (!token) throw new ApiError({ status: 401, code: "not_authenticated", message: "Please log in." });
    if (token.startsWith("admin|")) return ADMIN_USER;
    const userId = token.startsWith("mock|") ? token.split("|")[1] : null;
    const user = loadUsers().find((u) => u.id === userId);
    if (!user) throw new ApiError({ status: 401, code: "authentication_failed", message: "User not found." });
    assertCanSignIn(user);
    return sanitizeUser(user);
  },

  async updateMe({ fullName }) {
    await delay(300);
    return { ...(await this.me()), name: fullName };
  },

  async logout() {
    /* nothing to revoke in demo mode */
  },
};
