// Mock (practice) interviews, Module 11. The engine runs today; feedback text and scores only
// exist once the AI hooks are connected, and the server says so in `feedback_message`.
import { api } from "./client";

function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, v);
  const t = q.toString();
  return t ? `?${t}` : "";
}
const one = (id) => `/mock-interviews/${encodeURIComponent(id)}/`;

export const mockInterviewApi = {
  roles: ({ q = "", category = "", page = 1 } = {}, { signal } = {}) =>
    api.get(`/mock-interviews/roles/${query({ q: q.trim(), category, page })}`, { signal }),
  list: ({ status = "", page = 1 } = {}, { signal } = {}) => api.get(`/mock-interviews/${query({ status, page })}`, { signal }),
  /** 409 `session_in_progress` (carries `session_id`) · 429 `daily_limit` (carries `resets_at`). */
  create: (body) => api.post("/mock-interviews/", body),
  get: (id, options) => api.get(one(id), options),
  start: (id) => api.post(`${one(id)}start/`, undefined),
  /** Typed answers only; `turn_index` makes a repeat harmless. 422 `voice_not_available` for audio. */
  answer: (id, turnIndex, text) => api.post(`${one(id)}answer/`, { turn_index: turnIndex, answer_text: text }),
  /** Under 3 answers the session is cancelled; otherwise it finishes with partial feedback. */
  end: (id) => api.post(`${one(id)}end/`, undefined),
  retryFeedback: (id) => api.post(`${one(id)}feedback/retry/`, undefined),
  remove: (id) => api.delete(one(id)),
  progress: (options) => api.get("/mock-interviews/progress/", options),
};
