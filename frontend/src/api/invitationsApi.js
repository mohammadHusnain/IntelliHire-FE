// Public staff-invitation links and the rejected-company resubmission (no sign-in needed).
import { memberRoleLabel } from "@/lib/companyMap";
import { api } from "./client";

const path = (token) => `/public/invitations/${encodeURIComponent(token)}/`;

export const invitationsApi = {
  async details(token, { signal } = {}) {
    const data = await api.get(path(token), { auth: false, signal });
    return {
      companyName: data.company?.name || "",
      companyLogo: data.company?.logo || null,
      role: data.role,
      roleLabel: memberRoleLabel(data.role),
      email: data.email,
      fullName: data.full_name || "",
    };
  },

  /** Returns { email, status }. No tokens: the new user logs in normally. */
  accept: (token, { fullName, password, confirmPassword }) =>
    api.post(`${path(token)}accept/`, { full_name: fullName, password, confirm_password: confirmPassword }, { auth: false }),

  resubmitCompany: (form) =>
    api.post(
      "/auth/register/company/resubmit/",
      {
        official_email: form.email,
        password: form.password,
        company_name: form.companyName,
        industry: form.industry,
        admin_full_name: form.fullName,
        admin_phone: form.phone,
      },
      { auth: false },
    ),
};
