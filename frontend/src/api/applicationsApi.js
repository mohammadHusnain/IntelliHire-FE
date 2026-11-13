// Candidate applications: lists, detail, status changes, notes, downloads and the CSV export (real backend only).
import { APPLICATION_STATUSES, dateParam, mapApplication, mapApplicationRow, mapNote } from "@/lib/applicationMap";
import { api } from "./client";

const STATUSES = APPLICATION_STATUSES.map((s) => s.value);

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const applicationsApi = {
  /**
   * One page of applications. With `jobId` it is that job's list (which also carries `statusCounts`);
   * without it, every application of the company (no counts: use `counts`).
   */
  async list({ jobId = "", status = "", educationLevel = "", submittedAfter = "", submittedBefore = "", search = "", minCvScore = "", ordering = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    const params = {
      status,
      education_level: educationLevel,
      submitted_after: dateParam(submittedAfter),
      submitted_before: dateParam(submittedBefore),
      search: search.trim(),
      min_cv_score: minCvScore,
      ordering,
      page,
      page_size: pageSize,
    };
    const path = jobId ? `/jobs/${jobId}/applications/` : "/applications/";
    const data = await api.get(`${path}${query(params)}`, { signal });
    return { count: data.count, hasNext: Boolean(data.next), results: data.results.map(mapApplicationRow), statusCounts: data.status_counts || null };
  },

  /** Applications per status (and `total`). A job has them in one request; the whole company needs one count-only request per status. */
  async counts({ jobId = "", signal } = {}) {
    if (jobId) {
      const data = await api.get(`/jobs/${jobId}/applications/?page_size=1`, { signal });
      return data.status_counts;
    }
    const entries = await Promise.all(STATUSES.map(async (status) => [status, (await api.get(`/applications/${query({ status, page_size: 1 })}`, { signal })).count]));
    const counts = Object.fromEntries(entries);
    return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  },

  async get(id, { signal } = {}) {
    return mapApplication(await api.get(`/applications/${id}/`, { signal }));
  },

  /** Returns the whole application as the server now has it (status, history and notes). */
  async changeStatus(id, status, note = "") {
    return mapApplication(await api.patch(`/applications/${id}/status/`, { status, note }));
  },

  async notes(id, { signal } = {}) {
    return (await api.get(`/applications/${id}/notes/`, { signal })).map(mapNote);
  },
  async addNote(id, text) {
    return mapNote(await api.post(`/applications/${id}/notes/`, { text }));
  },

  /** Authenticated downloads -> { blob, filename }. */
  downloadResume: (id, options) => api.download(`/applications/${id}/resume/`, options),
  downloadFile: (id, fieldKey, options) => api.download(`/applications/${id}/files/${encodeURIComponent(fieldKey)}/`, options),
  /** The server's CSV of one job's applications (the whole job, whatever is filtered on screen). */
  exportJob: (jobId, options) => api.download(`/jobs/${jobId}/applications/export/`, options),
};
