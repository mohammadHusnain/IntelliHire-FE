import { useEffect } from "react";
import { Ban, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useLogout";

const MESSAGES = {
  suspended: { title: "Your company is suspended", text: "The IntelliHire team has paused your company's access. Contact support if you think this is a mistake." },
  pending: { title: "Your company is awaiting approval", text: "We will email you as soon as the review is done." },
  rejected: { title: "Your company was not approved", text: "Check your email for the reason. You can correct the details and register again from the log-in page." },
  default: { title: "You no longer have access", text: "Your access to this company's workspace was turned off. Ask your company admin to restore it." },
};

/**
 * Shown instead of a company page after a 403. The 403 itself does not say why, so the account is
 * re-read from the server (`/auth/me/`) to find out whether the company or only this person is blocked.
 */
export default function CompanyBlocked({ onRetry }) {
  const refresh = useAuthStore((s) => s.refresh);
  const companyStatus = useAuthStore((s) => s.user?.companyStatus);
  const logout = useLogout();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const key = companyStatus === "suspended" || companyStatus === "pending" || companyStatus === "rejected" ? companyStatus : "default";
  const { title, text } = MESSAGES[key];
  const Icon = key === "default" ? LockKeyhole : Ban;

  const check = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
    onRetry?.();
  };

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center">
      <div role="alert" className="max-w-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Icon size={26} /></span>
        <h1 className="display mt-5 text-[28px]">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{text}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" onClick={check} disabled={checking} className="btn-secondary">
            {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Check again
          </button>
          <button type="button" onClick={logout} className="btn-secondary">Log out</button>
        </div>
      </div>
    </div>
  );
}
