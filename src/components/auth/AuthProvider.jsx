import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { setUnauthorizedHandler } from "@/api/client";
import { Loader2 } from "lucide-react";

/**
 * AuthProvider — wraps the app inside <BrowserRouter>.
 *
 * Responsibilities:
 *  1. Calls authStore.initialize() once on mount to validate any
 *     persisted token (session restoration).
 *  2. Wires the API client's 401 handler to authStore.logout().
 *  3. Shows a loading spinner until initialization completes,
 *     preventing route flicker.
 */
export default function AuthProvider({ children }) {
  const initialize = useAuthStore((s) => s.initialize);
  const logout = useAuthStore((s) => s.logout);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    initialize();
    setUnauthorizedHandler(logout);
  }, [initialize, logout]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#F04E23]" size={28} />
      </div>
    );
  }

  return children;
}
