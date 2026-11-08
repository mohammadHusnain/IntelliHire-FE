// The custom questions of a job's application form (real backend only).
import { mapCustomField } from "@/lib/jobMap";
import { api } from "./client";

export const jobFieldsApi = {
  async list(jobId, { signal } = {}) {
    return (await api.get(`/jobs/${jobId}/fields/`, { signal })).map(mapCustomField);
  },
  /** `body` uses backend names (see fieldBody). */
  async add(jobId, body) {
    return mapCustomField(await api.post(`/jobs/${jobId}/fields/`, body));
  },
  async update(jobId, fieldId, changes) {
    return mapCustomField(await api.patch(`/jobs/${jobId}/fields/${fieldId}/`, changes));
  },
  remove: (jobId, fieldId) => api.delete(`/jobs/${jobId}/fields/${fieldId}/`),
  /** Every field id of the job, in the new order. Returns the fields in that order. */
  async reorder(jobId, fieldIds) {
    return (await api.post(`/jobs/${jobId}/fields/reorder/`, { field_ids: fieldIds })).map(mapCustomField);
  },
};
