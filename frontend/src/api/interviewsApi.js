import { api } from "./client";

const sessionPath = (id) => `/interviews/${encodeURIComponent(id)}/`;
const publicPath = (token) => `/public/interviews/${encodeURIComponent(token)}/`;

export const interviewsApi = {
  listForApplication: (applicationId, options) =>
    api.get(`/applications/${encodeURIComponent(applicationId)}/interviews/`, options),
  invite: (applicationId, payload) =>
    api.post(`/applications/${encodeURIComponent(applicationId)}/interviews/`, payload),
  get: (sessionId, options) => api.get(sessionPath(sessionId), options),
  resend: (sessionId) => api.post(`${sessionPath(sessionId)}resend/`),
  extend: (sessionId, days) => api.post(`${sessionPath(sessionId)}extend/`, { days }),
  cancel: (sessionId) => api.post(`${sessionPath(sessionId)}cancel/`),
  reevaluate: (sessionId) => api.post(`${sessionPath(sessionId)}reevaluate/`),

  publicSummary: (token, options) => api.get(publicPath(token), { ...options, auth: false }),
  startPublic: (token) => api.post(`${publicPath(token)}start/`, undefined, { auth: false }),
  answerPublic: (token, turnIndex, answerText) =>
    api.post(`${publicPath(token)}answer/`, { turn_index: turnIndex, answer_text: answerText }, { auth: false }),
  finishPublic: (token) => api.post(`${publicPath(token)}finish/`, undefined, { auth: false }),
};
