import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Loader2, WifiOff } from "lucide-react";
import { profileApi } from "@/api/profileApi";
import { USE_MOCK_API } from "@/config/env";
import { useAuthStore } from "@/store/authStore";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";

const Centered = ({ children }) => (
  <div className="flex min-h-dvh items-center justify-center bg-[#FAFAF9] px-6 text-center">{children}</div>
);

/**
 * Prepares the signed-in candidate's workspace before any candidate page renders.
 * Demo mode: creates the local record on first visit.
 * Real backend: loads the profile from the server first (so no page ever shows a stale copy), then renders.
 */
export default function CandidateGate() {
  const user = useAuthStore((s) => s.user);
  const record = useCandidateRecord();
  const { ensure, hydrateProfile } = useCandidateActions();
  const [load, setLoad] = useState({ status: USE_MOCK_API ? "ready" : "loading", error: "" });
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (USE_MOCK_API) {
      if (user && !record) ensure(user);
      return;
    }
    if (!user) return;
    let live = true;
    profileApi
      .load(user)
      .then((profile) => {
        if (!live) return;
        hydrateProfile(user, profile);
        setLoad({ status: "ready", error: "" });
      })
      .catch((error) => live && setLoad({ status: "error", error: error?.message || "Couldn't load your profile." }));
    return () => {
      live = false;
    };
    // `user` is read through userId: a new user object with the same id must not reload the profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attempt]);

  if (load.status === "error") {
    return (
      <Centered>
        <div role="alert" className="max-w-sm">
          <WifiOff size={30} className="mx-auto text-stone-400" />
          <p className="mt-4 text-[15px] text-stone-600">{load.error}</p>
          <button type="button" onClick={() => {
              setLoad({ status: "loading", error: "" });
              setAttempt((n) => n + 1);
            }} className="btn-primary mt-5">
            Try again
          </button>
        </div>
      </Centered>
    );
  }

  if (load.status !== "ready" || !record) {
    return (
      <Centered>
        <Loader2 className="animate-spin text-brand" size={26} />
      </Centered>
    );
  }
  return <Outlet />;
}
