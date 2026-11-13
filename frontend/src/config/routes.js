// ─── Role Constants ─────────────────────────────────────────────────────────
export const ROLES = {
  CANDIDATE: "candidate",
  COMPANY: "company",
  ADMIN: "admin",
};

// ─── Route Path Constants ───────────────────────────────────────────────────
export const ROUTES = {
  // Public
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  UNAUTHORIZED: "/unauthorized",

  // Candidate
  CANDIDATE: {
    DASHBOARD: "/candidate/dashboard",
    PROFILE: "/candidate/profile",
    REPORTS: "/candidate/reports",
    INTERVIEW_SETUP: "/candidate/interview/setup",
    INTERVIEW_ROOM: "/candidate/interview/room",
    REPORT: "/candidate/report/:id",
    INVITED_INTERVIEW: "/candidate/interviews/:id",
    APPLICATIONS: "/candidate/applications",
    APPLICATION: "/candidate/applications/:id",
  },

  // Company
  COMPANY: {
    PENDING: "/company/pending",
    ONBOARDING: "/company/onboarding",
    DASHBOARD: "/company/dashboard",
    TEAM: "/company/team",
    JOBS: "/company/jobs",
    JOB_CREATE: "/company/jobs/create",
    JOB_EDIT: "/company/jobs/:id/edit",
    JOB_PREVIEW: "/company/jobs/:id/preview",
    CANDIDATES: "/company/candidates",
    JOB_CANDIDATES: "/company/jobs/:id/candidates",
    CV_ANALYSIS: "/company/jobs/:id/cv-analysis",
    INTERVIEWS: "/company/interviews",
    EVALUATION: "/company/evaluation",
    CANDIDATE_PROFILE: "/company/candidates/:id",
    ANALYTICS: "/company/analytics",
    COMMUNITY: "/company/community",
    SETTINGS: "/company/settings",
  },

  // Admin
  ADMIN: {
    DASHBOARD: "/admin/dashboard",
    USERS: "/admin/users",
    COMPANIES: "/admin/companies",
    COMMUNITIES: "/admin/communities",
    REPORTS: "/admin/reports",
    SETTINGS: "/admin/settings",
    MANAGEMENT: "/admin/management",
    OPERATIONS: "/admin/operations",
  },
};

// ─── Role → Default Dashboard Mapping ───────────────────────────────────────
export const ROLE_DASHBOARDS = {
  [ROLES.CANDIDATE]: ROUTES.CANDIDATE.DASHBOARD,
  [ROLES.COMPANY]: ROUTES.COMPANY.DASHBOARD,
  [ROLES.ADMIN]: ROUTES.ADMIN.DASHBOARD,
};
