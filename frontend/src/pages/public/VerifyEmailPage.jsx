import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, Mail, ShieldAlert } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import ResendVerification from "@/components/shared/ResendVerification";
import { useAuthStore } from "@/store/authStore";

const EMAIL_KEY = "intellihire.verify-email.address";
const REDIRECT_DELAY_MS = 1200;
const SUCCESS_TEXT = {
  pending_approval: "Your email is verified. Your company account is now waiting for administrator approval, and we will email you the decision.",
};

/** /verify-email  Takes the email from registration (or a refreshed page via sessionStorage) and a
 * 6-digit code typed by the candidate; no credential ever sits in the URL or browser history. */
export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const verifyEmail = useAuthStore((s) => s.verifyEmail);

  const [email, setEmail] = useState(() => {
    const fromRegister = location.state?.email || "";
    if (fromRegister) {
      try {
        sessionStorage.setItem(EMAIL_KEY, fromRegister);
      } catch {
        /* private browsing or storage disabled: the field still works, just not across a refresh */
      }
      return fromRegister;
    }
    try {
      return sessionStorage.getItem(EMAIL_KEY) || "";
    } catch {
      return "";
    }
  });
  const [code, setCode] = useState("");
  const [state, setState] = useState({ phase: "idle", message: "", status: "" });
  const submittedCode = useRef("");

  const submit = async (candidateCode) => {
    if (state.phase === "verifying" || state.phase === "success" || !email) return;
    submittedCode.current = candidateCode;
    setState({ phase: "verifying", message: "", status: "" });
    const result = await verifyEmail(email, candidateCode);
    if (submittedCode.current !== candidateCode) return; // a later attempt already replaced this one
    if (result.success) {
      setState({ phase: "success", message: "", status: result.status });
      try {
        sessionStorage.removeItem(EMAIL_KEY);
      } catch {
        /* nothing to clean up */
      }
      setTimeout(() => navigate("/login", { replace: true }), REDIRECT_DELAY_MS);
    } else {
      setState({ phase: "error", message: result.error, status: "" });
      setCode("");
    }
  };

  const onCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submit(digits);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (code.length === 6) submit(code);
  };

  const { phase, message, status } = state;
  const locked = phase === "error" && message.toLowerCase().includes("too many");

  return (
    <AuthLayout
      headline={<>One quick step to <em className="!text-white/90">get started.</em></>}
      points={["Check your inbox for the code", "Enter it below to confirm your email", "Companies are reviewed before they go live"]}
    >
      <div aria-live="polite">
        {phase === "success" ? (
          <div className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={26} /></span>
            <h1 className="display mt-5 text-[32px]">Email verified</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {SUCCESS_TEXT[status] || "Your email is verified. Taking you to log in…"}
            </p>
          </div>
        ) : (
          <div className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Mail size={26} /></span>
            <h1 className="display mt-5 text-[32px]">Enter your code</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              We emailed a 6-digit code to confirm your address. Enter it below.
            </p>

            <form onSubmit={onSubmit} className="mt-6">
              <AuthField
                label="Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
              />
              <AuthField
                className="mt-3"
                label="Verification code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={onCodeChange}
                disabled={phase === "verifying" || locked}
                autoFocus
              />
              {phase === "error" && (
                <p role="alert" className="mt-2 flex items-start gap-2 text-[13.5px] text-red-600">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />{message}
                </p>
              )}
              <button type="submit" disabled={phase === "verifying" || code.length !== 6 || !email} className="btn-primary btn-lg mt-5 w-full">
                {phase === "verifying" ? <Loader2 className="mx-auto animate-spin" size={20} /> : "Verify"}
              </button>
            </form>

            <p className="mt-6 text-[14px] text-stone-600">Didn&apos;t get it, or did the code expire?</p>
            <ResendVerification email={email.trim()} className="mt-2" />
            <Link to="/login" className="link-brand mt-6 inline-block text-[14px]">Back to log in</Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
