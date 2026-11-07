// One error type for every API failure, so screens never parse raw responses.
//
// The backend answers either with field errors   {"email": ["Email already registered."]}
// or with a general error                        {"detail": "…", "code": "invalid_credentials"}.

export const GENERIC_MESSAGE = "Something went wrong. Please try again.";
export const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
export const TOO_LARGE_MESSAGE = "That file or request is too large.";
export const FIELDS_MESSAGE = "Please check the highlighted fields.";

export class ApiError extends Error {
  /**
   * @param {object} p
   * @param {number} [p.status]  HTTP status, 0 when no response was received
   * @param {string} [p.code]    backend `code`, or "network" | "timeout" | "aborted" | "parse"
   * @param {string} [p.message] text that is safe to show to the user
   * @param {Record<string,string[]>} [p.fieldErrors]
   * @param {number|null} [p.retryAfterSeconds]
   */
  constructor({ status = 0, code = "error", message = GENERIC_MESSAGE, fieldErrors = {}, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get isNetwork() {
    return this.code === "network" || this.code === "timeout";
  }

  /** First message for a field, or "" */
  field(name) {
    return this.fieldErrors[name]?.[0] || "";
  }
}

/** "Request was throttled. Expected available in 58 seconds." -> 58 */
export function parseRetryAfter(detail) {
  const match = /(\d+)\s*second/i.exec(String(detail || ""));
  return match ? Number(match[1]) : null;
}

export function throttledMessage(seconds) {
  return seconds ? `Too many attempts. Try again in ${formatWait(seconds)}.` : "Too many attempts. Please wait a moment and try again.";
}

export function formatWait(seconds) {
  if (seconds < 90) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function asMessages(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

/** Build an ApiError from a status and the (already read) response text. */
export function buildApiError(status, text) {
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null; // an HTML error page or an empty body must never crash the UI
  }
  const isObject = body && typeof body === "object" && !Array.isArray(body);
  const detail = isObject && typeof body.detail === "string" ? body.detail : "";
  const code = isObject && typeof body.code === "string" ? body.code : "";

  const fieldErrors = {};
  if (isObject) {
    for (const [key, value] of Object.entries(body)) {
      if (key === "detail" || key === "code") continue;
      const messages = asMessages(value);
      if (messages.length) fieldErrors[key] = messages;
    }
  }

  if (status === 429) {
    const seconds = parseRetryAfter(detail);
    return new ApiError({ status, code: "throttled", message: throttledMessage(seconds), retryAfterSeconds: seconds });
  }
  if (status === 413) return new ApiError({ status, code: "request_too_large", message: TOO_LARGE_MESSAGE });
  if (status >= 500) return new ApiError({ status, code: code || "server_error", message: GENERIC_MESSAGE });

  const nonField = fieldErrors.non_field_errors?.[0];
  if (nonField) delete fieldErrors.non_field_errors;
  const hasFields = Object.keys(fieldErrors).length > 0;
  const message = detail || nonField || (hasFields ? FIELDS_MESSAGE : status === 404 ? "Not found." : GENERIC_MESSAGE);
  return new ApiError({ status, code: code || (hasFields ? "validation_error" : "error"), message, fieldErrors });
}

export function networkError(cause) {
  const error = new ApiError({ status: 0, code: "network", message: NETWORK_MESSAGE });
  error.cause = cause;
  return error;
}

export function timeoutError() {
  return new ApiError({ status: 0, code: "timeout", message: "The server took too long to respond. Please try again." });
}

export function abortedError() {
  return new ApiError({ status: 0, code: "aborted", message: "The request was cancelled." });
}
