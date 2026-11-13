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

  /**
   * Begin CV screening for a job. `missing` (the default) reads CVs never analysed or failed,
   * `full` reads every CV again, `rescore` recomputes scores from what was already read.
   * Answers 202 `{ mode, queued }`; 409 `no_applications` when the job has none yet.
   */
  run: (jobId, mode = "missing") => api.post(`/jobs/${jobId}/cv-screening/run/`, { mode }),

  /** Analyse one CV again. 202 on success; 409 `analysis_in_progress` while it is already running. */
  rerun: (applicationId) => api.post(`/applications/${applicationId}/cv-analysis/rerun/`, undefined),
};
