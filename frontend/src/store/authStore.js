import { create } from "zustand";
import { authApi } from "@/api/authApi";
import { ApiError } from "@/api/errors";
import { clearLegacySession, clearTokens, getTokens, setTokens } from "@/api/tokenStorage";
import { ROLE_DASHBOARDS } from "@/config/routes";

// Every action returns a plain result and never throws, so screens only branch on `success`.
//   success: { success: true, ...data }
//   failure: { success: false, error, code, status, fieldErrors, retryAfterSeconds }
function failure(error) {
  const e = error instanceof ApiError ? error : new ApiError({ message: "Something went wrong. Please try again." });
  return {
    success: false,
    error: e.message,
    code: e.code,
    status: e.status,
    fieldErrors: e.fieldErrors,
    retryAfterSeconds: e.retryAfterSeconds,
    isNetwork: e.isNetwork,
  };
}

const SIGNED_OUT = { user: null, isAuthenticated: false };

export const useAuthStore = create((set, get) => {
  const guarded = async (run, { loading = false } = {}) => {
    if (loading) set({ isLoading: true, error: null });
    try {
      const data = await run();
      if (loading) set({ isLoading: false });
      return { success: true, ...data };
    } catch (error) {
      const result = failure(error);
      if (loading) set({ isLoading: false, error: result.error });
      return result;
    }
  };

  return {
    // State
    user: null,
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    error: null,
    // Why the user is on the login page without having clicked "log out": "expired" | "suspended" | "deactivated" | "password-changed" | "password-reset"
    notice: null,
    // Set when the stored session could not be checked because the server was unreachable
    bootError: null,

    clearNotice: () => set({ notice: null }),

    // ── Login ──────────────────────────────────────────────────────────────────
    login: (email, password) =>
      guarded(
        async () => {
          const { user, tokens } = await authApi.login(email, password);
          setTokens(tokens);
          set({ user, isAuthenticated: true, notice: null, bootError: null });
          return { user };
        },
        { loading: true },
      ),

    // ── Register (never signs the user in: the account must be verified first) ──
    registerCandidate: (form) => guarded(async () => ({ ...(await authApi.registerCandidate(form)) }), { loading: true }),
    registerCompany: (form) => guarded(async () => ({ ...(await authApi.registerCompany(form)) }), { loading: true }),

    verifyEmail: (token) => guarded(async () => ({ ...(await authApi.verifyEmail(token)) })),
    resendVerification: (email) => guarded(async () => ({ ...(await authApi.resendVerification(email)) })),
    forgotPassword: (email) => guarded(async () => ({ ...(await authApi.forgotPassword(email)) })),

    // The server ends every session of the user on a reset or a change, so the local one ends too.
    resetPassword: (payload) =>
      guarded(async () => {
        const data = await authApi.resetPassword(payload);
        get().endSessionLocally("password-reset");
        return { ...data };
      }),

    changePassword: (payload) =>
      guarded(async () => {
        const data = await authApi.changePassword(payload);
        get().endSessionLocally("password-changed");
        return { ...data };
      }),

    updateMe: (changes) =>
      guarded(async () => {
        const user = await authApi.updateMe(changes);
        set({ user });
        return { user };
      }),

    // ── Logout ─────────────────────────────────────────────────────────────────
    // The user is signed out on this device at once; the server-side revocation runs in the background.
    logout: () => {
      const tokens = getTokens();
      get().endSessionLocally(null);
      return authApi.logout(tokens);
    },

    /** Clears local state and tokens (other tabs follow through the storage event). */
    endSessionLocally: (notice = null) => {
      clearTokens();
      set({ ...SIGNED_OUT, error: null, notice });
    },

    // ── Boot: rebuild the user from the server, never from cached data ─────────────
    initialize: async () => {
      clearLegacySession();
      if (!getTokens()) {
        set({ ...SIGNED_OUT, isInitialized: true, bootError: null });
        return;
      }
      try {
        const user = await authApi.me();
        set({ user, isAuthenticated: true, isInitialized: true, bootError: null });
      } catch (error) {
        if (error instanceof ApiError && (error.isNetwork || error.status >= 500)) {
          // The server could not be reached: keep the session and offer a retry instead of logging the user out.
          set({ ...SIGNED_OUT, isInitialized: true, bootError: error.message });
          return;
        }
        clearTokens();
        set({ ...SIGNED_OUT, isInitialized: true, bootError: null });
      }
    },

    /** Re-read the signed-in user (status or company may have changed). */
    refresh: async () => {
      if (!getTokens()) return { error: "Not signed in." };
      try {
        const user = await authApi.me();
        set({ user, isAuthenticated: true });
        return { user };
      } catch (error) {
        const result = failure(error);
        if (!result.isNetwork && result.status !== 0 && result.status < 500) get().endSessionLocally("expired");
        return { error: result.error };
      }
    },

    // ── Derived helper ─────────────────────────────────────────────────────────
    getDashboardPath: () => {
      const { user } = get();
      return user ? ROLE_DASHBOARDS[user.role] || "/login" : "/login";
    },
  };
});

/** Wired once by AuthProvider: the API client reports sessions the server ended. */
export function handleSessionEnded(reason) {
  useAuthStore.getState().endSessionLocally(reason);
}
