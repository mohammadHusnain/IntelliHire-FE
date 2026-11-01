import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";

/** Creates the signed-in candidate's record on first visit, then renders the candidate routes. */
export default function CandidateGate() {
  const user = useAuthStore((s) => s.user);
  const record = useCandidateRecord();
  const { ensure } = useCandidateActions();

  useEffect(() => {
    if (user && !record) ensure(user);
  }, [user, record, ensure]);

  if (!record) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FAFAF9]">
        <Loader2 className="animate-spin text-brand" size={26} />
      </div>
    );
  }
  return <Outlet />;
}
