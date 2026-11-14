// Platform admin panel (Module 13). Every route here is platform-admin only. The monitors are
// read-only: an admin reads everything but never edits a company's jobs, applications or interviews.
import { api } from "./client";

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

const base = "/platform-admin/";
const paged = (data) => ({ count: data.count, hasNext: Boolean(data.next), hasPrevious: Boolean(data.previous), results: data.results });

export const platformAdminApi = {
  /** Every metric block in one request: users, companies, jobs, applications, interviews, communities, moderation, alerts, AI. */
  dashboard: (options) => api.get(`${base}dashboard/`, options),

  userDetail: (userId, options) => api.get(`${base}users/${encodeURIComponent(userId)}/detail/`, options),
  companyOnboarding: (companyId, options) => api.get(`${base}companies/${encodeURIComponent(companyId)}/onboarding/`, options),

  async jobs({ company = "", status = "", q = "", createdFrom = "", createdTo = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    return paged(await api.get(`${base}jobs/${query({ company, status, q: q.trim(), created_from: createdFrom, created_to: createdTo, page, page_size: pageSize })}`, { signal }));
  },
  job: (jobId, options) => api.get(`${base}jobs/${encodeURIComponent(jobId)}/`, options),

  async communities({ company = "", status = "", q = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    return paged(await api.get(`${base}communities/${query({ company, status, q: q.trim(), page, page_size: pageSize })}`, { signal }));
  },
  community: (communityId, options) => api.get(`${base}communities/${encodeURIComponent(communityId)}/`, options),

  /** Flag something for review from a monitor. The flag's source is `admin`. */
  flag: (targetType, targetId, reason) => api.post(`${base}flags/`, { target_type: targetType, target_id: targetId, reason }),

  async moderation({ status = "", targetType = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    return paged(await api.get(`${base}moderation/${query({ status, target_type: targetType, page, page_size: pageSize })}`, { signal }));
  },
  review: (flagId) => api.post(`${base}moderation/${encodeURIComponent(flagId)}/review/`, undefined),
  /**
   * Resolve a flag. `action` is only `dismiss` or `act`; the server derives the concrete action
   * (suspend the user, suspend the company, close the job, remove the community, archive the post)
   * from the flag's target, reusing that object's own service. A note is always required.
   */
  resolve: (flagId, { note, action = "dismiss" }) => api.post(`${base}moderation/${encodeURIComponent(flagId)}/resolve/`, { note, action }),

  async activity({ eventType = "", actor = "", company = "", from = "", to = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    return paged(await api.get(`${base}activity/${query({ event_type: eventType, actor, company, from, to, page, page_size: pageSize })}`, { signal }));
  },
  activityEvent: (eventId, options) => api.get(`${base}activity/${encodeURIComponent(eventId)}/`, options),
  flagActivity: (eventId, reason) => api.post(`${base}activity/${encodeURIComponent(eventId)}/flag/`, { reason }),
  /** The server's CSV, capped at 5000 rows. The log itself can never be written to. */
  exportActivity: ({ eventType = "", actor = "", company = "", from = "", to = "" } = {}, options) =>
    api.download(`${base}activity/export/${query({ event_type: eventType, actor, company, from, to })}`, options),

  /** Database, storage, broker, worker, email queue, AI in the last hour, psutil resources, alerts, last backup. */
  health: (options) => api.get(`${base}health/`, options),
  alerts: ({ active = "" } = {}, { signal } = {}) => api.get(`${base}alerts/${query({ active })}`, { signal }),
  /** Only hides it until the condition returns. */
  acknowledgeAlert: (alertId) => api.post(`${base}alerts/${encodeURIComponent(alertId)}/acknowledge/`, undefined),

  aiSettings: (options) => api.get(`${base}ai-settings/`, options),
  /** Models are checked against the allowed list; an unknown one answers 400. API keys live in the environment and never pass through here. */
  updateAiSettings: (changes) => api.put(`${base}ai-settings/`, changes),

  prompts: (options) => api.get(`${base}prompts/`, options),
  promptVersions: (key, options) => api.get(`${base}prompts/${encodeURIComponent(key)}/`, options),
  /** A new version becomes active. It must pass schema validation and keep every placeholder the previous one had. */
  savePrompt: (key, body) => api.post(`${base}prompts/${encodeURIComponent(key)}/`, body),
  rollbackPrompt: (key, version) => api.post(`${base}prompts/${encodeURIComponent(key)}/rollback/`, { version }),

  /** Calls, failures, tokens and average latency per feature per day. No rows is an answer, not an error. */
  aiUsage: ({ from = "", to = "", feature = "" } = {}, { signal } = {}) => api.get(`${base}ai-usage/${query({ from, to, feature })}`, { signal }),
};

/** Reporting content. Open to anyone signed in; deduplicated per reporter and target for 24 hours, and throttled hard. */
export const reportsApi = {
  report: (targetType, targetId, reason) => api.post("/reports/", { target_type: targetType, target_id: targetId, reason }),
  /** The public form on a shared job page: no account needed. */
  reportJob: (formSlug, reason) => api.post("/public/report-job/", { form_slug: formSlug, reason }, { auth: false }),
};
