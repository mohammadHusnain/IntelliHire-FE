// Talent communities, candidate side (Module 12). Another candidate's membership, an invite-only
// community you were not invited to, and a post you cannot see are all 404.
import { api } from "./client";
import { mapCommunity, mapDiscoveryRow, mapInvitation, mapPost, mapRequest } from "@/lib/communityMap";

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

const page = (data, map) => ({ count: data.count, hasNext: Boolean(data.next), hasPrevious: Boolean(data.previous), results: data.results.map(map) });

export const candidateCommunitiesApi = {
  /** Discoverable communities with my eligibility and my state on each row. Invite-only ones never appear unless I was invited. */
  async discover({ q = "", company = "", page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`/candidate/communities/${query({ q: q.trim(), company, page: pageNumber, page_size: pageSize })}`, { signal }), mapDiscoveryRow);
  },
  async mine({ signal } = {}) {
    const data = await api.get("/candidate/communities/mine/", { signal });
    return (data.results || data).map(mapDiscoveryRow);
  },
  /** One community; the member list is never shown to a candidate. */
  async get(id, { signal } = {}) {
    return mapCommunity(await api.get(`/candidate/communities/${encodeURIComponent(id)}/`, { signal }));
  },

  /**
   * Ask to join. Eligible: 201 and a pending request. **Not eligible: 200** with
   * `status: auto_rejected` and the reasons — that is an answer, not an error.
   * Already a member or waiting: 409. Invite-only without an invitation: 404.
   */
  async join(id, message = "") {
    const data = await api.post(`/candidate/communities/${encodeURIComponent(id)}/join/`, message ? { message } : {});
    return mapRequest(data);
  },
  leave: (id) => api.post(`/candidate/communities/${encodeURIComponent(id)}/leave/`, undefined),

  /** Posts of a community I belong to. Anyone else gets 404. */
  async feed(id, { page: pageNumber = 1, pageSize = 20 } = {}, { signal } = {}) {
    return page(await api.get(`/candidate/communities/${encodeURIComponent(id)}/feed/${query({ page: pageNumber, page_size: pageSize })}`, { signal }), mapPost);
  },
  /** Show interest in a post. 404 for a non-member, 409 once I have already responded. */
  respond: (postId, message = "") => api.post(`/candidate/community-posts/${encodeURIComponent(postId)}/respond/`, message ? { message } : {}),

  async invitations({ signal } = {}) {
    const data = await api.get("/candidate/community-invitations/", { signal });
    return (data.results || data).map(mapInvitation);
  },
  /** 410 once the invitation has expired. */
  accept: (invitationId) => api.post(`/candidate/community-invitations/${encodeURIComponent(invitationId)}/accept/`, undefined),
  decline: (invitationId) => api.post(`/candidate/community-invitations/${encodeURIComponent(invitationId)}/decline/`, undefined),
};
