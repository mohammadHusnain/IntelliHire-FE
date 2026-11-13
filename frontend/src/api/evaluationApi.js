import { api } from "./client";

function query(params) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") values.set(key, value);
  }
  const text = values.toString();
  return text ? `?${text}` : "";
}

const jobPath = (jobId) => `/jobs/${encodeURIComponent(jobId)}`;
const applicationPath = (applicationId) => `/applications/${encodeURIComponent(applicationId)}`;

export const evaluationApi = {
  weights: (jobId, options) => api.get(`${jobPath(jobId)}/evaluation-weights/`, options),
  updateWeights: (jobId, payload) => api.put(`${jobPath(jobId)}/evaluation-weights/`, payload),

  async ranking(jobId, { minScore, maxScore, status, stage, partial, page = 1, signal } = {}) {
    const data = await api.get(`${jobPath(jobId)}/evaluations/${query({
      min_score: minScore,
      max_score: maxScore,
      status,
      stage,
      partial: partial === "" ? "" : partial,
      page,
    })}`, { signal });
    return {
      count: data.count,
      hasNext: Boolean(data.next),
      hasPrevious: Boolean(data.previous),
      results: data.results,
    };
  },

  compare: (jobId, applicationIds, options) =>
    api.get(`${jobPath(jobId)}/evaluations/compare/${query({ applications: applicationIds.join(",") })}`, options),

  detail: (applicationId, options) => api.get(`${applicationPath(applicationId)}/evaluation/`, options),
  decisions: (applicationId, options) => api.get(`${applicationPath(applicationId)}/decisions/`, options),
  decide: (applicationId, payload) => api.post(`${applicationPath(applicationId)}/decision/`, payload),
  generateReport: (applicationId) => api.post(`${applicationPath(applicationId)}/evaluation/generate/`, undefined),
  downloadPdf: (applicationId, options) => api.download(`${applicationPath(applicationId)}/evaluation/pdf/`, options),
};
