import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * ProtectedRoute — blocks unauthenticated users.
 * Redirects to /login while preserving the intended destination.
 */
export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
