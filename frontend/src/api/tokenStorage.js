// The only place that touches the login tokens.
//
// Access and refresh tokens live under ONE localStorage key, so they are written and cleared together
// (a single setItem is atomic) and other tabs can never read a half-updated pair. Tokens are never logged,
// never put in a URL and never copied into error messages.

export const SESSION_KEY = "intellihire_session";

// Only used when localStorage is blocked (private mode, policy): the session then lasts until the page closes.
let memory = null;

function read() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const value = JSON.parse(raw);
      if (value && typeof value.access === "string" && typeof value.refresh === "string") return value;
    }
  } catch {
    // corrupt JSON or storage blocked: treated as "no stored session"
  }
  return memory;
}

export function getTokens() {
  return read();
}

export function setTokens({ access, refresh }) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ access, refresh }));
  } catch {
    memory = { access, refresh };
  }
}

export function clearTokens() {
  memory = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
}

export function hasSession() {
  return Boolean(read() || memory);
}

/**
 * Call `listener(tokensOrNull)` when ANOTHER tab changes the session (login, silent refresh, logout).
 * Returns an unsubscribe function.
 */
export function onTokensChanged(listener) {
  const handler = (event) => {
    if (event.key === SESSION_KEY || event.key === null) listener(read());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Keys written by the old demo-only login; removed so a stale demo session can never be mistaken for a real one. */
export function clearLegacySession() {
  try {
    localStorage.removeItem("intellihire_access_token");
    localStorage.removeItem("intellihire_user");
  } catch {
    // nothing to clear
  }
}
