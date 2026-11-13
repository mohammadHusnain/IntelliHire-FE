import { api } from "./client";

function query(params) {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") values.set(key, value);
  }
  const text = values.toString();
  return text ? `?${text}` : "";
}

export const cvAnalysisApi = {
  config: (jobId, { signal } = {}) => api.get(`/jobs/${jobId}/screening-config/`, { signal }),
  updateConfig: (jobId, changes) => api.put(`/jobs/${jobId}/screening-config/`, changes),
  progress: (jobId, { signal } = {}) => api.get(`/jobs/${jobId}/cv-screening/`, { signal }),

  async ranking(jobId, { minScore = "", status = "", analysisStatus = "", page = 1, pageSize = 20, signal } = {}) {
    const data = await api.get(`/jobs/${jobId}/ranking/${query({ min_score: minScore, status, analysis_status: analysisStatus, page, page_size: pageSize })}`, { signal });
    return { count: data.count, hasNext: Boolean(data.next), hasPrevious: Boolean(data.previous), results: data.results };
  },

  analysis: (applicationId, { signal } = {}) => api.get(`/applications/${applicationId}/cv-analysis/`, { signal }),
  previewThreshold: (jobId, threshold) => api.post(`/jobs/${jobId}/shortlist/apply-threshold/`, { threshold, dry_run: true }),
  applyThreshold: (jobId, threshold) => api.post(`/jobs/${jobId}/shortlist/apply-threshold/`, { threshold }),
};
