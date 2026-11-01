import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

/**
 * useAuth — convenience hook that bundles auth state with
 * navigation-aware login/logout helpers.
 */
export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);

  const login = useCallback(
    async (email, password) => {
      const result = await storeLogin(email, password);
      if (result.success) {
        const dest =
          location.state?.from?.pathname ||
          ROLE_DASHBOARDS[result.user.role] ||
          "/";
        navigate(dest, { replace: true });
      }
      return result;
    },
    [storeLogin, navigate, location],
  );

  const logout = useCallback(() => {
    storeLogout();
    navigate("/login", { replace: true });
  }, [storeLogout, navigate]);

  return { user, isAuthenticated, isLoading, error, login, logout };
}
