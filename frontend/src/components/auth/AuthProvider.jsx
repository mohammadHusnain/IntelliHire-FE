import { useEffect } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { setSessionEndedHandler } from "@/api/client";
import { onTokensChanged } from "@/api/tokenStorage";
import { handleSessionEnded, useAuthStore } from "@/store/authStore";

/**
 * AuthProvider — wraps the app inside <BrowserRouter>.
 *
 *  1. Rebuilds the signed-in user from the server once on mount (never from cached user data).
 *  2. Lets the API client end the session when the server says it is over (expired / suspended).
 *  3. Follows other tabs: logging out in one tab logs out the rest; logging in elsewhere signs this tab in.
 *  4. Shows a spinner until the first check finishes, so no page flashes in the wrong state.
 */
export default function AuthProvider({ children }) {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const bootError = useAuthStore((s) => s.bootError);

  useEffect(() => {
    setSessionEndedHandler(handleSessionEnded);
    initialize();
    return onTokensChanged((tokens) => {
      const { isAuthenticated, endSessionLocally } = useAuthStore.getState();
      if (!tokens && isAuthenticated) endSessionLocally(null);
      if (tokens && !isAuthenticated) initialize();
    });
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#F04E23]" size={28} />
      </div>
    );
  }

  if (bootError) {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <WifiOff size={30} className="text-stone-400" />
        <p className="max-w-sm text-[15px] text-stone-600">{bootError}</p>
        <button type="button" onClick={() => initialize()} className="btn-primary">
          Try again
        </button>
      </div>
    );
  }

  return children;
}
