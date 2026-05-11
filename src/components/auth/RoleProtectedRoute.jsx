import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ROLE_DASHBOARDS } from "@/config/routes";

/**
 * RoleProtectedRoute — restricts access to specific roles.
 *
 * Usage (layout route):
 *   <Route element={<RoleProtectedRoute allowedRoles={[ROLES.CANDIDATE]} />}>
 *     <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
 *   </Route>
 *
 * If the user is not authenticated → /login.
 * If authenticated but wrong role → their own dashboard.
 */
export default function RoleProtectedRoute({ allowedRoles }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    const fallback = ROLE_DASHBOARDS[user?.role] || "/";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
