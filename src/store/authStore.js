import { create } from "zustand";
import { authApi } from "@/api/authApi";
import { ROLE_DASHBOARDS, ROLES } from "@/config/routes";

// ─── Storage Keys ───────────────────────────────────────────────────────────
const TOKEN_KEY = "intellihire_access_token";
const USER_KEY = "intellihire_user";

// ─── Helpers ────────────────────────────────────────────────────────────────
function persistSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Auth Store ─────────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  // ── Login ─────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await authApi.login(email, password);
      persistSession(token, user);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return { success: true, user };
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ── Register ──────────────────────────────────────────────────────────────
  // Deliberately does NOT authenticate — user must login after registering.
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authApi.register(userData);
      set({ isLoading: false });
      return { success: true, email: user.email };
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: () => {
    clearSession();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // ── Initialize (called once on app mount by AuthProvider) ─────────────────
  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isInitialized: true });
      return;
    }
    try {
      const { user } = await authApi.validateToken(token);
      set({ user, token, isAuthenticated: true, isInitialized: true });
    } catch {
      clearSession();
      set({ isInitialized: true });
    }
  },

  // ── Derived Helper ────────────────────────────────────────────────────────
  getDashboardPath: () => {
    const { user } = get();
    if (!user) return "/login";
    return ROLE_DASHBOARDS[user.role] || "/login";
  },
}));
