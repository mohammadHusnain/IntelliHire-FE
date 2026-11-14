// Talent communities, company side (Module 12). Staff of the owning company only; another
// company's community is 404 everywhere. Reads are open to every company user; writes are
// admin and HR manager (Module12_Communities/views.py `CanManage`).
import { api } from "./client";
import { mapCommunity, mapInvitation, mapMember, mapPost, mapPostResponse, mapRequest } from "@/lib/communityMap";

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

const base = "/company/communities/";
const one = (id) => `${base}${encodeURIComponent(id)}/`;
const page = (data, map) => ({ count: data.count, hasNext: Boolean(data.next), hasPrevious: Boolean(data.previous), results: data.results.map(map) });

export const communitiesApi = {
  /** Every non-removed community of the company. The server takes no filters here. */
  async list({ page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${base}${query({ page: pageNumber, page_size: pageSize })}`, { signal }), mapCommunity);
  },
  async get(id, { signal } = {}) {
    return mapCommunity(await api.get(one(id), { signal }));
  },
  async create(body) {
    return mapCommunity(await api.post(base, body));
  },
  /** Only changed fields. Existing members stay whatever the new filters say. */
  async update(id, changes) {
    return mapCommunity(await api.patch(one(id), changes));
  },
  /** Hides it from discovery and stops new joins; members and posts stay readable. */
  async archive(id) {
    return mapCommunity(await api.post(`${one(id)}archive/`, undefined));
  },
  /** Marks it removed (nothing is deleted) and emails the members once. A reason is required. */
  remove: (id, reason) => api.delete(one(id), { body: { reason } }),

  async members(id, { q = "", ordering = "-joined_at", page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${one(id)}members/${query({ q: q.trim(), ordering, page: pageNumber, page_size: pageSize })}`, { signal }), mapMember);
  },
  removeMember: (id, userId, reason) => api.delete(`${one(id)}members/${encodeURIComponent(userId)}/`, { body: { reason } }),

  /**
   * Discoverable, email-verified candidates only, and never their email, phone or CV.
   * `eligibleOnly` applies the community's own filters.
   */
  async searchCandidates(id, { q = "", university = "", skill = "", gradYear = "", eligibleOnly = false } = {}, { signal } = {}) {
    const data = await api.get(`${one(id)}candidates/search/${query({ q: q.trim(), university, skill, grad_year: gradYear, eligible_only: eligibleOnly || "" })}`, { signal });
    return (data.results || data).map((row) => ({ ...row, eligible: Boolean(row.eligible), reasons: row.reasons || [] }));
  },

  async invitations(id, { status = "", page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${one(id)}invitations/${query({ status, page: pageNumber, page_size: pageSize })}`, { signal }), mapInvitation);
  },
  /** Allowed even when the candidate fails the filters: the reply carries an eligibility preview. */
  async invite(id, userId, message = "") {
    const data = await api.post(`${one(id)}invitations/`, { user_id: userId, ...(message ? { message } : {}) });
    return { ...mapInvitation(data), eligibility: data.eligibility || null };
  },
  revokeInvitation: (id, invitationId) => api.delete(`${one(id)}invitations/${encodeURIComponent(invitationId)}/`),

  /** Pending by default, which is the server's own default. */
  async joinRequests(id, { status = "pending", page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${one(id)}join-requests/${query({ status, page: pageNumber, page_size: pageSize })}`, { signal }), mapRequest);
  },
  async approveRequest(id, requestId) {
    return mapRequest(await api.post(`${one(id)}join-requests/${encodeURIComponent(requestId)}/approve/`, undefined));
  },
  /** A reason is required; the server answers 400 without one. */
  async rejectRequest(id, requestId, reason) {
    return mapRequest(await api.post(`${one(id)}join-requests/${encodeURIComponent(requestId)}/reject/`, { reason }));
  },

  async posts(id, { page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${one(id)}posts/${query({ page: pageNumber, page_size: pageSize })}`, { signal }), mapPost);
  },
  async createPost(id, body) {
    return mapPost(await api.post(`${one(id)}posts/`, body));
  },
  async updatePost(id, postId, changes) {
    return mapPost(await api.patch(`${one(id)}posts/${encodeURIComponent(postId)}/`, changes));
  },
  deletePost: (id, postId) => api.delete(`${one(id)}posts/${encodeURIComponent(postId)}/`),
  async postResponses(id, postId, { page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`${one(id)}posts/${encodeURIComponent(postId)}/responses/${query({ page: pageNumber, page_size: pageSize })}`, { signal }), mapPostResponse);
  },
};
