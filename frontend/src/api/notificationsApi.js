import { api } from "./client";

const PREFERENCES_PATH = "/notifications/preferences/";
const PREFERENCE_FIELDS = {
  emailCommunities: "email_communities",
  inAppReminders: "in_app_reminders",
  inAppCommunities: "in_app_communities",
  notifyApplicants: "notify_applicants",
};

function mapPreferences(data) {
  return Object.fromEntries(
    Object.entries(PREFERENCE_FIELDS)
      .filter(([, serverKey]) => Object.hasOwn(data, serverKey))
      .map(([clientKey, serverKey]) => [clientKey, data[serverKey]]),
  );
}

function toServerPreferences(changes) {
  return Object.fromEntries(Object.entries(changes).map(([key, value]) => [PREFERENCE_FIELDS[key], value]));
}

export const notificationsApi = {
  async list(page = 1, { signal } = {}) {
    const data = await api.get(`/notifications/?page=${encodeURIComponent(page)}`, { signal });
    return {
      count: data.count,
      hasNext: Boolean(data.next),
      results: data.results.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        to: item.link || "",
        createdAt: item.created_at,
        read: item.read,
      })),
    };
  },

  unreadCount: ({ signal } = {}) => api.get("/notifications/unread-count/", { signal }).then((data) => data.count),
  markRead: (id) => api.post(`/notifications/${encodeURIComponent(id)}/read/`),
  markAllRead: () => api.post("/notifications/read-all/"),

  async getPreferences({ signal } = {}) {
    return mapPreferences(await api.get(PREFERENCES_PATH, { signal }));
  },

  async updatePreferences(changes) {
    return mapPreferences(await api.patch(PREFERENCES_PATH, toServerPreferences(changes)));
  },
};
