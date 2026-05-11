// ─── Role Constants ─────────────────────────────────────────────────────────
export const ROLES = {
  CANDIDATE: "candidate",
  COMPANY: "company",
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
    CANDIDATE_PROFILE: "/company/candidates/:id",
    ANALYTICS: "/company/analytics",
    COMMUNITY: "/company/community",
    SETTINGS: "/company/settings",
  },
};

// ─── Role → Default Dashboard Mapping ───────────────────────────────────────
export const ROLE_DASHBOARDS = {
  [ROLES.CANDIDATE]: ROUTES.CANDIDATE.DASHBOARD,
  [ROLES.COMPANY]: ROUTES.COMPANY.DASHBOARD,
};
