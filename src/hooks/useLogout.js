import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * useLogout — returns a single function that clears auth state and
 * navigates to /login. Drop-in replacement for `() => navigate("/login")`
 * in dashboard sidebar logout buttons.
 */
export function useLogout() {
  const navigate = useNavigate();
  const storeLogout = useAuthStore((s) => s.logout);

  return useCallback(() => {
    storeLogout();
    navigate("/login", { replace: true });
  }, [storeLogout, navigate]);
}
