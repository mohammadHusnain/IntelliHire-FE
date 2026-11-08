// The public application form of a published job and its submission (no sign-in needed).
import { api } from "./client";

const path = (slug) => `/public/jobs/${encodeURIComponent(slug)}/`;

export const publicJobsApi = {
  /** The form schema: { accepting, message, job{…}, fields[] }. 404 for an unknown slug or a draft. */
  schema: (slug, { signal } = {}) => api.get(path(slug), { auth: false, signal }),

  /**
   * Submits an application (multipart). `values` maps a field key to a string, an array of strings
   * (multiple choice: sent as repeated keys) or a File. Returns { reference, job_title, company, submitted_at }.
   */
  apply(slug, values, { onProgress, signal } = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) for (const item of value) form.append(key, item);
      else if (value instanceof File) form.append(key, value, value.name);
      else form.append(key, value);
    }
    form.append("hp-website", ""); // the honeypot stays empty for real people
    return api.upload(`${path(slug)}apply/`, form, { onProgress, signal });
  },
};
