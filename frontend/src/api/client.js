// ─── API client ─────────────────────────────────────────────────────────────────
// fetch wrapper for the Django API: bearer token, normalised errors, silent token refresh.
//
// Refresh rules (the access token lives 15 minutes, the refresh token rotates on every use):
//  * on 401 the request waits for ONE shared refresh call (single-flight, also across tabs through the
//    Web Locks API) and is then retried exactly once;
//  * an account the platform suspended (code `account_inactive`) ends the session immediately;
//  * a refresh that the server refuses ends the session; a network failure during refresh does NOT
//    (the tokens are kept and the caller gets a retryable error).
import { ApiError, abortedError, buildApiError, networkError, timeoutError } from "./errors";
import { clearTokens, getTokens, setTokens } from "./tokenStorage";

const BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 20000;
const LOCK_NAME = "intellihire-token-refresh";

// Endpoints that carry their own credentials or none at all: a 401 there is the answer, never a reason to refresh.
const NO_REFRESH = [
  /^\/auth\/login\//,
  /^\/auth\/token\/refresh\//,
  /^\/auth\/register\//,
  /^\/auth\/verify-email\//,
  /^\/auth\/resend-verification\//,
  /^\/auth\/password\/(forgot|reset)\//,
];

let onSessionEnded = null;

/** AuthProvider registers this; `reason` is "expired" or "suspended". */
export function setSessionEndedHandler(handler) {
  onSessionEnded = handler;
}

function endSession(reason) {
  clearTokens();
  onSessionEnded?.(reason);
}

// ─── Transports ──────────────────────────────────────────────────────────────────

function linkSignal(controller, signal) {
  if (!signal) return () => {};
  if (signal.aborted) controller.abort();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

async function fetchTransport({ url, method, headers, body, signal, timeoutMs, responseType }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = timeoutMs > 0
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : null;
  const unlink = linkSignal(controller, signal);
  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal });
    // error bodies are always text, even when a file was expected, so the server message is not lost
    const payload = responseType === "blob" && response.ok ? await response.blob() : await response.text();
    return { status: response.status, ok: response.ok, headers: response.headers, payload };
  } catch (cause) {
    if (timedOut) throw timeoutError();
    if (cause?.name === "AbortError" || signal?.aborted) throw abortedError();
    throw networkError(cause);
  } finally {
    if (timer) clearTimeout(timer);
    unlink();
  }
}

function xhrTransport({ url, method, headers, body, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }
    const abort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) return reject(abortedError());
      signal.addEventListener("abort", abort, { once: true });
    }
    const finish = () => signal?.removeEventListener("abort", abort);
    xhr.onload = () => {
      finish();
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        headers: { get: (name) => xhr.getResponseHeader(name) },
        payload: xhr.responseText,
      });
    };
    xhr.onerror = () => {
      finish();
      reject(networkError());
    };
    xhr.onabort = () => {
      finish();
      reject(abortedError());
    };
    xhr.send(body);
  });
}

// ─── Refresh (single-flight) ─────────────────────────────────────────────────────

let refreshing = null;

async function callRefresh(staleRefresh) {
  const current = getTokens();
  if (!current?.refresh) throw new ApiError({ status: 401, code: "no_session", message: "Please log in again." });
  // Another tab already rotated the token while we waited for the lock: use its result.
  if (staleRefresh && current.refresh !== staleRefresh) return current;

  const response = await fetchTransport({
    url: `${BASE_URL}/auth/token/refresh/`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: current.refresh }),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!response.ok) throw buildApiError(response.status, response.payload);
  let data;
  try {
    data = JSON.parse(response.payload);
  } catch {
    data = null;
  }
  if (!data?.access || !data?.refresh) throw new ApiError({ status: 502, code: "parse", message: "Unexpected server response." });
  // The NEW refresh token must replace the old one: the old one is blacklisted by the server.
  setTokens({ access: data.access, refresh: data.refresh });
  return { access: data.access, refresh: data.refresh };
}

function refreshTokens(staleRefresh) {
  if (!refreshing) {
    const run = () => callRefresh(staleRefresh);
    const locked = typeof navigator !== "undefined" && navigator.locks?.request ? navigator.locks.request(LOCK_NAME, run) : run();
    refreshing = Promise.resolve(locked).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// ─── Core request ────────────────────────────────────────────────────────────────

function buildBody(body, headers) {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData) return body; // the browser sets the multipart boundary itself
  headers["Content-Type"] = "application/json";
  return JSON.stringify(body);
}

async function send(endpoint, options, accessToken) {
  const { method = "GET", body, headers: extra = {}, auth = true, signal, timeoutMs = DEFAULT_TIMEOUT_MS, onProgress, responseType = "text" } = options;
  const headers = { Accept: "application/json", ...extra };
  const payload = buildBody(body, headers);
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const args = { url: `${BASE_URL}${endpoint}`, method, headers, body: payload, signal, timeoutMs, responseType, onProgress };
  return onProgress ? xhrTransport(args) : fetchTransport(args);
}

async function request(endpoint, options = {}) {
  const { auth = true, retry = true } = options;
  const tokens = auth ? getTokens() : null;
  const response = await send(endpoint, options, tokens?.access);

  if (response.status === 401 && auth && retry && !NO_REFRESH.some((rx) => rx.test(endpoint))) {
    const failure = buildApiError(401, response.payload);
    if (!tokens) throw failure; // never logged in: nothing to refresh and no session to end
    if (failure.code === "account_inactive") {
      endSession("suspended");
      throw failure;
    }
    const latest = getTokens();
    if (!latest?.refresh) {
      endSession("expired");
      throw failure;
    }
    // If another tab already refreshed, the stored access token differs from the one that failed.
    if (latest.access === tokens.access) {
      try {
        await refreshTokens(tokens.refresh);
      } catch (error) {
        if (error instanceof ApiError && error.isNetwork) throw error; // keep the session, let the caller retry
        if (error instanceof ApiError && error.status >= 500) throw error;
        endSession("expired");
        throw failure;
      }
    }
    return request(endpoint, { ...options, retry: false }); // reads the refreshed tokens from storage
  }

  if (!response.ok) throw buildApiError(response.status, response.payload);
  return response;
}

function parseJson(response) {
  const text = response.payload;
  if (!text || response.status === 204 || response.status === 205) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError({ status: response.status, code: "parse", message: "Unexpected server response." });
  }
}

async function jsonRequest(endpoint, options) {
  return parseJson(await request(endpoint, options));
}

// ─── Public API ──────────────────────────────────────────────────────────────────

export const api = {
  get: (url, opts) => jsonRequest(url, { method: "GET", ...opts }),
  post: (url, body, opts) => jsonRequest(url, { method: "POST", body, ...opts }),
  put: (url, body, opts) => jsonRequest(url, { method: "PUT", body, ...opts }),
  patch: (url, body, opts) => jsonRequest(url, { method: "PATCH", body, ...opts }),
  delete: (url, opts) => jsonRequest(url, { method: "DELETE", ...opts }),

  /** Multipart upload with progress (0-100) and cancel (AbortSignal). */
  upload: (url, formData, { method = "POST", onProgress, signal } = {}) =>
    jsonRequest(url, { method, body: formData, onProgress, signal, timeoutMs: 0 }),

  /** Authenticated file download -> { blob, filename }. */
  async download(url, { signal } = {}) {
    const response = await request(url, { method: "GET", signal, responseType: "blob", timeoutMs: 60000 });
    return { blob: response.payload, filename: filenameFrom(response.headers.get("Content-Disposition")) };
  },
};

/** The file name from a Content-Disposition header (RFC 5987 `filename*` first), or "". */
export function filenameFrom(header) {
  if (!header) return "";
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : "";
}

export { ApiError };
