import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS, ROLES, ROUTES } from "@/config/routes";

/**
 * RoleProtectedRoute — restricts access to specific roles.
 *
 * If the user is not authenticated → /login.
 * If authenticated but wrong role → their own dashboard.
 * Companies awaiting admin approval are held on /company/pending.
 */
export default function RoleProtectedRoute({ allowedRoles }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { pathname } = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    const fallback = ROLE_DASHBOARDS[user?.role] || "/";
    return <Navigate to={fallback} replace />;
  }

  if (user.role === ROLES.COMPANY) {
    const onPending = pathname === ROUTES.COMPANY.PENDING;
    if (user.status === "pending" && !onPending) return <Navigate to={ROUTES.COMPANY.PENDING} replace />;
    if (user.status !== "pending" && onPending) return <Navigate to={ROUTES.COMPANY.DASHBOARD} replace />;
  }

  return <Outlet />;
}
