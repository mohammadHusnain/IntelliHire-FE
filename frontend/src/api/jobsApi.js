// Job postings: list, detail, create, edit and the lifecycle (real backend only).
import { mapJob, mapJobRow } from "@/lib/jobMap";
import { api } from "./client";

const STATUSES = ["open", "draft", "closed"];

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const jobsApi = {
  /** `status` is draft | open | closed | "all". Search matches the title. */
  async list({ status = "open", department = "", employmentType = "", search = "", ordering = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    const data = await api.get(
      `/jobs/${query({ status: status === "all" ? "" : status, department: department.trim(), employment_type: employmentType, search: search.trim(), ordering, page, page_size: pageSize })}`,
      { signal },
    );
    return { count: data.count, hasNext: Boolean(data.next), results: data.results.map(mapJobRow) };
  },

  /** Jobs per status. The list has no counts, so this asks for one row per status. */
  async counts({ signal } = {}) {
    const entries = await Promise.all(
      STATUSES.map(async (status) => [status, (await api.get(`/jobs/${query({ status, page_size: 1 })}`, { signal })).count]),
    );
    const counts = Object.fromEntries(entries);
    return { ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0) };
  },

  /** The departments this company has used (for the filter and the suggestions). */
  departments: ({ signal } = {}) => api.get("/jobs/departments/", { signal }),

  async get(id, { signal } = {}) {
    return mapJob(await api.get(`/jobs/${id}/`, { signal }));
  },

  /** `body` uses backend names (see jobBody). With `publish` the job is validated and opened in the same step. */
  async create(body, { publish = false } = {}) {
    return mapJob(await api.post("/jobs/", publish ? { ...body, publish: true } : body));
  },

  /** `changes` uses backend names (see changedJobFields). */
  async update(id, changes) {
    return mapJob(await api.patch(`/jobs/${id}/`, changes));
  },

  async publish(id) {
    return mapJob(await api.post(`/jobs/${id}/publish/`));
  },
  async close(id) {
    return mapJob(await api.post(`/jobs/${id}/close/`));
  },
  /** `deadline` is an ISO instant. */
  async reopen(id, deadline) {
    return mapJob(await api.post(`/jobs/${id}/reopen/`, { deadline }));
  },
  async duplicate(id) {
    return mapJob(await api.post(`/jobs/${id}/duplicate/`));
  },
  remove: (id) => api.delete(`/jobs/${id}/`),

  /** The application form exactly as candidates will see it (drafts included). */
  formPreview: (id, { signal } = {}) => api.get(`/jobs/${id}/form-preview/`, { signal }),
};
