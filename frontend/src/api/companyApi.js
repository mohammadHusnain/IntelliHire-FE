// Company workspace: profile (with logo), dashboard, team and invitations (real backend only).
import { COMPANY_FIELD_TO_FORM, mapCompanyProfile, mapDashboard, mapInvitation, mapMember } from "@/lib/companyMap";
import { api } from "./client";

/** The server says "no" to every company request (HTTP 403): company suspended, or this person's access turned off. */
export const isBlocked = (error) => error?.status === 403;

export const mapCompanyFieldErrors = (fieldErrors = {}) => {
  const mapped = {};
  for (const [field, messages] of Object.entries(fieldErrors)) mapped[COMPANY_FIELD_TO_FORM[field] || field] = messages[0];
  return mapped;
};

export const companyApi = {
  async profile(user, opts) {
    return mapCompanyProfile(await api.get("/company/profile/", opts), user);
  },

  /** `changes` uses backend field names (see changedCompanyFields). */
  async saveProfile(changes, user) {
    return mapCompanyProfile(await api.patch("/company/profile/", changes), user);
  },

  async setLogo(file, user, { onProgress, signal } = {}) {
    const form = new FormData();
    form.append("logo", file, file.name);
    return mapCompanyProfile(await api.upload("/company/profile/", form, { method: "PATCH", onProgress, signal }), user);
  },

  async removeLogo(user) {
    return mapCompanyProfile(await api.patch("/company/profile/", { logo: null }), user);
  },

  async dashboard(opts) {
    return mapDashboard(await api.get("/company/dashboard/", opts));
  },

  async members(opts) {
    return (await api.get("/company/members/", opts)).map(mapMember);
  },

  /** `changes`: { role, job_title, is_active } */
  async updateMember(id, changes) {
    return mapMember(await api.patch(`/company/members/${id}/`, changes));
  },

  async invitations({ status, signal } = {}) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return (await api.get(`/company/invitations/${query}`, { signal })).map(mapInvitation);
  },

  async invite({ email, fullName, role, jobTitle }) {
    return mapInvitation(await api.post("/company/invitations/", { email, full_name: fullName, role, job_title: jobTitle || "" }));
  },

  async resendInvitation(id) {
    return mapInvitation(await api.post(`/company/invitations/${id}/resend/`));
  },

  async revokeInvitation(id) {
    return mapInvitation(await api.post(`/company/invitations/${id}/revoke/`));
  },
};
