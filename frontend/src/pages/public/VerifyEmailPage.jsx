import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, Mail, MailWarning, WifiOff } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import ResendVerification from "@/components/shared/ResendVerification";
import { useAuthStore } from "@/store/authStore";

const SUCCESS_TEXT = {
  pending_approval: "Your email is verified. Your company account is now waiting for administrator approval, and we will email you the decision.",
};

/** /verify-email?token=...  Verifies exactly once, then removes the token from the address bar. */
export default function VerifyEmailPage() {
  const [params, setParams] = useSearchParams();
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  // Captured once: the token leaves the URL after the first attempt, and re-renders must not verify again.
  const [token] = useState(() => params.get("token") || "");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: token ? "verifying" : "missing", message: "", status: "" });
  const [email, setEmail] = useState("");
  // One request per attempt. React StrictMode runs effects twice in development, so the request is kept here
  // and each effect run only attaches its own (cancellable) result handler to it.
  const request = useRef({ attempt: null, promise: null });

  useEffect(() => {
    if (!token) return;
    if (request.current.attempt !== attempt) {
      request.current = { attempt, promise: verifyEmail(token) };
    }
    let live = true;
    request.current.promise.then((result) => {
      if (!live) return;
      if (result.success) setState({ phase: "success", message: "", status: result.status });
      else if (result.isNetwork || result.status >= 500) setState({ phase: "network", message: result.error, status: "" });
      else setState({ phase: result.code === "expired" ? "expired" : "invalid", message: result.error, status: "" });
      // Remove the token from the address bar and the history entry (it is a credential).
      setParams({}, { replace: true });
    });
    return () => {
      live = false;
    };
  }, [token, attempt, verifyEmail, setParams]);

  const retry = () => {
    setState({ phase: "verifying", message: "", status: "" });
    setAttempt((n) => n + 1);
  };

  const { phase, message, status } = state;

  return (
    <AuthLayout
      headline={<>One quick step to <em className="!text-white/90">get started.</em></>}
      points={["Confirm your email address", "Then log in to your workspace", "Companies are reviewed before they go live"]}
    >
      <div aria-live="polite">
        {phase === "verifying" && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto animate-spin text-brand" size={30} />
            <p className="mt-4 text-[15px] text-stone-600">Verifying your email…</p>
          </div>
        )}

        {phase === "success" && (
          <div className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={26} /></span>
            <h1 className="display mt-5 text-[32px]">Email verified</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {SUCCESS_TEXT[status] || "Your email is verified. You can log in now."}
            </p>
            <Link to="/login" className="btn-primary btn-lg mt-7 w-full">Go to log in</Link>
          </div>
        )}

        {(phase === "expired" || phase === "invalid" || phase === "missing") && (
          <div className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><MailWarning size={26} /></span>
            <h1 className="display mt-5 text-[32px]">
              {phase === "expired" ? "This link has expired" : phase === "missing" ? "Verification link needed" : "This link isn't valid"}
            </h1>
            <p role="alert" className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {phase === "missing" ? "Open the link from the verification email we sent you." : message}
            </p>
            <p className="mt-6 text-[14px] text-stone-600">Enter your email and we will send a new link.</p>
            <AuthField className="mt-3" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <ResendVerification email={email.trim()} className="mt-3" />
            <Link to="/login" className="link-brand mt-6 inline-block text-[14px]">Back to log in</Link>
          </div>
        )}

        {phase === "network" && (
          <div className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><WifiOff size={26} /></span>
            <h1 className="display mt-5 text-[32px]">We couldn&apos;t verify it yet</h1>
            <p role="alert" className="mt-2 flex items-start gap-2 text-[15px] text-stone-600"><AlertCircle size={18} className="mt-0.5 shrink-0" />{message}</p>
            <button type="button" onClick={retry} className="btn-primary btn-lg mt-7 w-full">Try again</button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
