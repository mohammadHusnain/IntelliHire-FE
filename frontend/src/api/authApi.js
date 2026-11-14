// ─── Auth API ───────────────────────────────────────────────────────────────────
// Real Django calls by default. With VITE_USE_MOCK_API=true the in-browser demo is used instead.
// Both expose the same methods, so the store and the pages never know which one they talk to.
import { mapUser } from "@/lib/authMap";
import { api } from "./client";

export { accountsApi } from "./mock/accounts";

const pick = (value) => (value === undefined || value === null ? undefined : value);

function candidateBody(form) {
  const base = { full_name: form.fullName, email: form.email, password: form.password, confirm_password: form.confirmPassword };
  const optional = {
    target_role: pick(form.targetRole),
    linkedin_url: pick(form.linkedinUrl),
    github_url: pick(form.githubUrl),
  };
  if (form.cvFile) {
    // A CV needs multipart; `skills` go as repeated keys.
    const data = new FormData();
    for (const [key, value] of Object.entries({ ...base, ...optional })) if (value !== undefined && value !== "") data.append(key, value);
    for (const skill of form.skills || []) data.append("skills", skill);
    data.append("resume", form.cvFile, form.cvFile.name);
    return data;
  }
  const body = { ...base };
  for (const [key, value] of Object.entries(optional)) if (value) body[key] = value;
  if (form.skills?.length) body.skills = form.skills;
  return body;
}

const realAuthApi = {
  async login(email, password) {
    const data = await api.post("/auth/login/", { email, password }, { auth: false });
    return { tokens: { access: data.access, refresh: data.refresh }, user: mapUser(data.user) };
  },

  registerCandidate: (form) => api.post("/auth/register/candidate/", candidateBody(form), { auth: false }),

  registerCompany: (form) =>
    api.post(
      "/auth/register/company/",
      {
        company_name: form.companyName,
        industry: form.industry,
        official_email: form.email,
        admin_full_name: form.fullName,
        admin_phone: form.phone,
        password: form.password,
        confirm_password: form.confirmPassword,
      },
      { auth: false },
    ),

  verifyEmail: (email, code) => api.post("/auth/verify-email/", { email, code }, { auth: false }),
  resendVerification: (email) => api.post("/auth/resend-verification/", { email }, { auth: false }),
  forgotPassword: (email) => api.post("/auth/password/forgot/", { email }, { auth: false }),

  resetPassword: ({ uid, token, password, confirmPassword }) =>
    api.post("/auth/password/reset/", { uid, token, new_password: password, confirm_password: confirmPassword }, { auth: false }),

  /** The server ends every session of the user after this, including the current one. */
  changePassword: ({ current, next }) => api.post("/auth/password/change/", { old_password: current, new_password: next }),

  async me() {
    return mapUser(await api.get("/auth/me/"));
  },

  async updateMe({ fullName }) {
    return mapUser(await api.patch("/auth/me/", { full_name: fullName }));
  },

  /**
   * Revokes the refresh token on the server. Takes the tokens captured when the user clicked "log out"
   * (local storage is already cleared by then). Never throws: the user is signed out locally either way.
   */
  async logout(tokens) {
    if (!tokens?.refresh) return;
    const call = (pair) =>
      api.post("/auth/logout/", { refresh: pair.refresh }, { auth: false, headers: { Authorization: `Bearer ${pair.access}` } });
    try {
      await call(tokens);
    } catch (error) {
      if (error.status !== 401) return;
      try {
        // the access token had expired: rotate once, then revoke the new refresh token
        await call(await api.post("/auth/token/refresh/", { refresh: tokens.refresh }, { auth: false }));
      } catch {
        /* nothing more to do */
      }
    }
  },
};

// Demo mode loads the in-browser demo auth on first use. The literal `import.meta.env` check below is
// replaced at build time, so a real build contains neither the demo module nor its credentials.
function lazyMockAuthApi() {
  return new Proxy(
    {},
    { get: (_, method) => async (...args) => (await import("./mock/authApi.mock")).mockAuthApi[method](...args) },
  );
}

export const authApi = import.meta.env.VITE_USE_MOCK_API === "true" ? lazyMockAuthApi() : realAuthApi;
export { realAuthApi };
