// The interview in progress lives in sessionStorage so a refresh resumes it,
// but closing the tab abandons it.
const KEY = "intellihire_active_interview";

export function saveActive(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: the interview still works, it just won't survive a refresh
  }
}

export function loadActive() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function clearActive() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
