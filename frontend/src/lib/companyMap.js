// Backend company data -> the shapes the company and admin screens use.
// One place for every Module 2 mapping: statuses, member roles, company sizes and field names.

/** Backend company status -> the UI status the badges already know. */
const COMPANY_STATUS = { pending: "pending", approved: "active", rejected: "rejected", suspended: "suspended" };
export const mapCompanyStatus = (status) => COMPANY_STATUS[status] ?? status;

/** Company member roles as the backend names them (not the same as the account role). */
export const MEMBER_ROLES = [
  { value: "admin", label: "Admin", hint: "Full access, manages the team and the company profile" },
  { value: "hr_manager", label: "HR manager", hint: "Works with candidates and roles" },
  { value: "recruiter", label: "Recruiter", hint: "Works with candidates and roles" },
  { value: "viewer", label: "Viewer", hint: "Read-only" },
];
export const memberRoleLabel = (role) => MEMBER_ROLES.find((r) => r.value === role)?.label ?? role ?? "";

/** Only a company admin may edit the profile, the team and the invitations (the server enforces it too). */
export const isCompanyAdmin = (user) => user?.memberRole === "admin";

/** The company sizes the backend accepts. */
export const COMPANY_SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-1000", label: "201–1,000 employees" },
  { value: "1000+", label: "1,000+ employees" },
];
export const companySizeLabel = (value) => COMPANY_SIZES.find((s) => s.value === value)?.label ?? value ?? "";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = /\.(jpe?g|png)$/i;
export const DESCRIPTION_MAX = 2000;
export const MIN_REASON = 10;

const time = (value) => (value ? Date.parse(value) || null : null);

/** GET /company/profile/ -> the profile object the company pages already use. */
export function mapCompanyProfile(data, user) {
  return {
    companyName: data.name || "",
    industry: data.industry || "",
    companySize: data.company_size || "",
    website: data.website || "",
    description: data.description || "",
    location: data.headquarters || "",
    phone: data.contact_phone || "",
    logo: data.logo || null,
    ownerName: user?.name || "",
    email: data.official_email || "",
    status: mapCompanyStatus(data.status),
    completion: Number.isFinite(data.profile_completion) ? data.profile_completion : 0,
  };
}

// Form field -> backend field (and back, for server messages).
const PROFILE_FIELDS = {
  companyName: "name",
  industry: "industry",
  companySize: "company_size",
  website: "website",
  description: "description",
  location: "headquarters",
  phone: "contact_phone",
};
export const COMPANY_FIELD_TO_FORM = { ...Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([form, field]) => [field, form])), logo: "logo" };

/** Only the fields that differ from `base`, under their backend names. */
export function changedCompanyFields(draft, base) {
  const changes = {};
  for (const [form, field] of Object.entries(PROFILE_FIELDS)) {
    const next = typeof draft[form] === "string" ? draft[form].trim() : draft[form] ?? "";
    if (next !== (base[form] ?? "")) changes[field] = next;
  }
  return changes;
}

export function mapMember(m) {
  return {
    id: m.id,
    name: m.full_name || "",
    email: m.email || "",
    role: m.role,
    roleLabel: memberRoleLabel(m.role),
    jobTitle: m.job_title || "",
    joinedAt: time(m.joined_at),
    active: Boolean(m.is_active),
    lastLogin: time(m.last_login),
  };
}

export function mapInvitation(i) {
  return {
    id: i.id,
    email: i.email,
    name: i.full_name || "",
    role: i.role,
    roleLabel: memberRoleLabel(i.role),
    jobTitle: i.job_title || "",
    status: i.status,
    createdAt: time(i.created_at),
    expiresAt: time(i.expires_at),
    acceptedAt: time(i.accepted_at),
  };
}

/** GET /company/dashboard/ */
export function mapDashboard(d) {
  return {
    company: {
      name: d.company?.name || "",
      logo: d.company?.logo || null,
      status: mapCompanyStatus(d.company?.status),
      completion: d.company?.profile_completion ?? 0,
    },
    jobs: { open: d.jobs?.open ?? 0, draft: d.jobs?.draft ?? 0, closed: d.jobs?.closed ?? 0 },
    applicants: { total: d.applicants?.total ?? 0, newLast7Days: d.applicants?.new_last_7_days ?? 0 },
    pipeline: {
      submitted: d.pipeline?.submitted ?? 0,
      underReview: d.pipeline?.under_review ?? 0,
      shortlisted: d.pipeline?.shortlisted ?? 0,
      interview: d.pipeline?.interview ?? 0,
      selected: d.pipeline?.selected ?? 0,
      rejected: d.pipeline?.rejected ?? 0,
      onHold: d.pipeline?.on_hold ?? 0,
    },
    closingSoon: (d.closing_soon || []).map((j) => ({ id: j.id, title: j.title, deadline: time(j.deadline), applicationCount: j.application_count ?? 0 })),
    recent: (d.recent_applications || []).map((a) => ({ candidateName: a.candidate_name, jobTitle: a.job_title, submittedAt: time(a.submitted_at), status: a.status })),
    team: { activeMembers: d.team?.active_members ?? 0, pendingInvitations: d.team?.pending_invitations ?? 0 },
  };
}

/** A row of the platform-admin company list (and the detail, which adds more). */
export function mapAdminCompany(c) {
  const status = mapCompanyStatus(c.status);
  const reason = c.status === "rejected" ? c.rejection_reason : c.status === "suspended" ? c.suspension_reason : "";
  return {
    id: c.id,
    name: c.admin?.full_name || "",
    companyName: c.name,
    email: c.official_email,
    phone: c.contact_phone || "",
    industry: c.industry || "",
    status,
    createdAt: time(c.created_at),
    adminEmailVerified: Boolean(c.admin?.email_verified),
    adminEmail: c.admin?.email || "",
    // detail only
    companySize: companySizeLabel(c.company_size),
    website: c.website || "",
    description: c.description || "",
    location: c.headquarters || "",
    logo: c.logo || null,
    statusReason: reason || "",
    statusChangedAt: time(c.reviewed_at),
    reviewedBy: c.reviewed_by || "",
  };
}
