import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

/**
 * GuestRoute — prevents authenticated users from seeing login/register.
 * Redirects them to their role-appropriate dashboard.
 */
export default function GuestRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated && user) {
    const dest = ROLE_DASHBOARDS[user.role] || "/";
    return <Navigate to={dest} replace />;
  }

  return children;
}
