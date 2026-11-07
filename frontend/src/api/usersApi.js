// Platform admin: the accounts list and suspend / reactivate (real backend only).
import { api } from "./client";

function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const usersApi = {
  /** { role: [..], status: [..], search, ordering, page, page_size } -> { count, next, previous, results, status_counts } */
  list: (params) => api.get(`/platform-admin/users/${toQuery(params)}`),
  suspend: (id) => api.post(`/platform-admin/users/${id}/suspend/`),
  reactivate: (id) => api.post(`/platform-admin/users/${id}/reactivate/`),
};

const PAGE_SIZE = 100; // the largest page the API allows

/**
 * Every account matching `params`, fetched page by page (the admin page filters in the browser).
 * Stops at `cap` accounts and says so, instead of looping without end.
 */
export async function listAllUsers(params = {}, { cap = 1000, signal } = {}) {
  const results = [];
  let page = 1;
  let counts;
  for (;;) {
    const data = await api.get(`/platform-admin/users/${toQuery({ ...params, page, page_size: PAGE_SIZE })}`, { signal });
    results.push(...data.results);
    counts = data.status_counts;
    if (!data.next || results.length >= cap) return { results: results.slice(0, cap), truncated: Boolean(data.next) || results.length > cap, statusCounts: counts, total: data.count };
    page += 1;
  }
}
