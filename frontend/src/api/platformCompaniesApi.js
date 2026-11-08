// Platform admin: review, approve, reject, suspend and reactivate companies (real backend only).
import { mapAdminCompany } from "@/lib/companyMap";
import { api } from "./client";

const BACKEND_STATUS = { pending: "pending", active: "approved", suspended: "suspended", rejected: "rejected" };

function query(params) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") q.set(key, value);
  const text = q.toString();
  return text ? `?${text}` : "";
}

export const platformCompaniesApi = {
  /** `status` is a UI status (pending | active | suspended | rejected | all). */
  async list({ status = "pending", search = "", page = 1, pageSize = 20 } = {}, { signal } = {}) {
    const data = await api.get(
      `/platform-admin/companies/${query({ status: status === "all" ? "all" : BACKEND_STATUS[status], search: search.trim(), page, page_size: pageSize })}`,
      { signal },
    );
    return { count: data.count, hasNext: Boolean(data.next), results: data.results.map(mapAdminCompany) };
  },

  /**
   * Every company matching `status` and `search`, page by page (for the CSV export). Stops at `cap` rows and says so.
   */
  async listAll({ status = "all", search = "" } = {}, { signal, cap = 5000 } = {}) {
    const results = [];
    for (let page = 1; ; page += 1) {
      const data = await platformCompaniesApi.list({ status, search, page, pageSize: 100 }, { signal });
      results.push(...data.results);
      if (!data.hasNext) return { results, truncated: false };
      if (results.length >= cap) return { results: results.slice(0, cap), truncated: true };
    }
  },

  /** Companies per status. The list has no counts, so this asks for one row per status. */
  async counts({ signal } = {}) {
    const entries = await Promise.all(
      Object.entries(BACKEND_STATUS).map(async ([ui, backend]) => {
        const data = await api.get(`/platform-admin/companies/${query({ status: backend, page_size: 1 })}`, { signal });
        return [ui, data.count];
      }),
    );
    const counts = Object.fromEntries(entries);
    return { ...counts, all: Object.values(counts).reduce((a, b) => a + b, 0) };
  },

  async detail(id, { signal } = {}) {
    return mapAdminCompany(await api.get(`/platform-admin/companies/${id}/`, { signal }));
  },

  async approve(id) {
    return mapAdminCompany(await api.post(`/platform-admin/companies/${id}/approve/`));
  },
  async reject(id, reason) {
    return mapAdminCompany(await api.post(`/platform-admin/companies/${id}/reject/`, { reason }));
  },
  async suspend(id, reason) {
    return mapAdminCompany(await api.post(`/platform-admin/companies/${id}/suspend/`, { reason }));
  },
  async reactivate(id) {
    return mapAdminCompany(await api.post(`/platform-admin/companies/${id}/reactivate/`));
  },
};
