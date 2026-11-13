import { api } from "./client";

const candidateApplications = "/candidate/applications/";
const publicTrack = (token) => `/public/track/${encodeURIComponent(token)}/`;

function query(params) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") values.set(key, value);
  }
  const text = values.toString();
  return text ? `?${text}` : "";
}

function mapStage(stage) {
  return { key: stage.key, label: stage.label, state: stage.state };
}

function mapDetail(data) {
  return {
    id: data.id,
    reference: data.reference,
    jobTitle: data.job_title,
    companyName: data.company_name,
    appliedAt: data.applied_at,
    status: data.status,
    statusLabel: data.status_label,
    stages: data.stages.map(mapStage),
    currentStage: data.current_stage,
    pendingInvitation: data.pending_invitation && {
      kind: data.pending_invitation.kind,
      expiresAt: data.pending_invitation.expires_at,
      canGetLink: data.pending_invitation.can_get_link,
    },
    decision: data.decision && {
      decision: data.decision.decision,
      label: data.decision.label,
      decidedAt: data.decision.decided_at,
    },
    timeline: data.timeline.map((event) => ({ status: event.status, label: event.label, at: event.at })),
  };
}

function mapRow(data) {
  return {
    id: data.id,
    reference: data.reference,
    jobTitle: data.job_title,
    companyName: data.company_name,
    appliedAt: data.applied_at,
    status: data.status,
    statusLabel: data.status_label,
    currentStage: data.current_stage,
    pendingInvitation: data.pending_invitation,
  };
}

function mapDashboard(data) {
  return {
    counts: data.counts,
    total: data.total,
    pendingInvitations: data.pending_invitations.map((item) => ({
      applicationId: item.application_id,
      reference: item.reference,
      jobTitle: item.job_title,
      companyName: item.company_name,
      kind: item.kind,
      expiresAt: item.expires_at,
    })),
  };
}

export const trackingApi = {
  async list({ status = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    const data = await api.get(`${candidateApplications}${query({ status, page, page_size: pageSize })}`, { signal });
    return {
      count: data.count,
      hasNext: Boolean(data.next),
      hasPrevious: Boolean(data.previous),
      results: data.results.map(mapRow),
    };
  },

  detail: (id, options) => api.get(`${candidateApplications}${encodeURIComponent(id)}/`, options).then(mapDetail),
  dashboard: (options) => api.get("/candidate/dashboard/", options).then(mapDashboard),
  refreshCandidateInterviewLink: (id) => api.post(`${candidateApplications}${encodeURIComponent(id)}/invitation/link/`),
  publicDetail: (token, options) => api.get(publicTrack(token), { ...options, auth: false, referrerPolicy: "no-referrer" }).then(mapDetail),
  refreshPublicInterviewLink: (token) => api.post(`${publicTrack(token)}invitation/link/`, undefined, { auth: false, referrerPolicy: "no-referrer" }),
  requestLinks: (email) => api.post("/public/track/request-link/", { email }, { auth: false, referrerPolicy: "no-referrer" }),
};

export { mapDetail, mapRow };
