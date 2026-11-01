// ─── API Client Abstraction ─────────────────────────────────────────────────
// Centralized fetch wrapper with token injection and 401 interception.
// When the real Django backend is ready, only the BASE_URL changes.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

let onUnauthorized = null;

/**
 * Register a callback that fires on any 401 response.
 * AuthProvider wires this to authStore.logout().
 */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/**
 * Core request helper.
 */
async function request(endpoint, { method = "GET", body, headers = {}, ...opts } = {}) {
  const token = localStorage.getItem("intellihire_access_token");

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...opts,
  };

  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, config);

  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ─── Convenience Methods ────────────────────────────────────────────────────
export const apiClient = {
  get: (url, opts) => request(url, { method: "GET", ...opts }),
  post: (url, body, opts) => request(url, { method: "POST", body, ...opts }),
  put: (url, body, opts) => request(url, { method: "PUT", body, ...opts }),
  patch: (url, body, opts) => request(url, { method: "PATCH", body, ...opts }),
  delete: (url, opts) => request(url, { method: "DELETE", ...opts }),
};
