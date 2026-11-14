import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCountdown } from "@/hooks/useCountdown";

const COOLDOWN_SECONDS = 30;

/**
 * "Resend verification email" for a given address. The server always answers the same way (so it
 * never reveals which emails exist) and allows 3 requests an hour; both cases are explained here.
 */
export default function ResendVerification({ email, className = "" }) {
  const resend = useAuthStore((s) => s.resendVerification);
  const [state, setState] = useState({ busy: false, sent: false, error: "" });
  const [cooldown, startCooldown] = useCountdown();

  const send = async () => {
    if (state.busy || cooldown > 0 || !email) return;
    setState({ busy: true, sent: false, error: "" });
    const result = await resend(email);
    if (result.success) {
      setState({ busy: false, sent: true, error: "" });
      startCooldown(COOLDOWN_SECONDS);
    } else {
      setState({ busy: false, sent: false, error: result.error });
      if (result.retryAfterSeconds) startCooldown(result.retryAfterSeconds);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={send}
        disabled={state.busy || cooldown > 0 || !email}
        className="link-brand inline-flex items-center gap-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.busy ? <Loader2 size={14} className="animate-spin" /> : <MailCheck size={14} />}
        {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification code"}
      </button>
      <p aria-live="polite" className="mt-1 text-[12.5px]">
        {state.sent && <span className="text-emerald-700">If that address needs verifying, a new code is on its way.</span>}
        {state.error && <span className="text-red-600">{state.error}</span>}
      </p>
    </div>
  );
}
