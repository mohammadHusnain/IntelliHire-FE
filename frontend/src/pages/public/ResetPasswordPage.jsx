import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, KeyRound, Loader2, Lock } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import ForgotPasswordModal from "@/components/shared/ForgotPasswordModal";
import { useAuthStore } from "@/store/authStore";

/** /reset-password?uid=...&token=...  The server ends every session of the user, so success goes to the login page. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  // Captured once so the form keeps working after re-renders.
  const [{ uid, token }] = useState(() => ({ uid: params.get("uid") || "", token: params.get("token") || "" }));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [linkError, setLinkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const formRef = useRef(null);
  const missing = !uid || !token;

  const submit = async (e) => {
    e.preventDefault();
    if (busy || missing) return;
    const next = {};
    if (!password) next.password = "Enter a new password";
    if (password !== confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    setLinkError("");
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    const result = await resetPassword({ uid, token, password, confirmPassword });
    setBusy(false);
    if (result.success) {
      navigate("/login", { replace: true });
      return;
    }
    const fields = result.fieldErrors || {};
    const mapped = { password: fields.new_password?.[0], confirmPassword: fields.confirm_password?.[0] };
    if (mapped.password || mapped.confirmPassword) {
      setErrors(mapped);
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
    } else {
      setLinkError(result.error); // an invalid or expired link, a throttle, or a network problem
    }
  };

  return (
    <AuthLayout
      headline={<>Choose a new password and <em className="!text-white/90">get back in.</em></>}
      points={["Reset links work once", "You will be signed out everywhere", "Then log in with the new password"]}
    >
      <h1 className="display text-[34px] sm:text-[40px]">Set a new password</h1>

      {missing ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-800">
          This reset link is incomplete. Request a new one to continue.
          <button type="button" onClick={() => setShowForgot(true)} className="link-brand ml-1 font-semibold">Send a new link</button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-stone-500">Use at least 8 characters that are hard to guess.</p>
          {linkError && (
            <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
              {linkError}{" "}
              <button type="button" onClick={() => setShowForgot(true)} className="link-brand font-semibold">Send a new link</button>
            </div>
          )}
          <form ref={formRef} onSubmit={submit} noValidate className="mt-8 space-y-5">
            <AuthField label="New password" icon={Lock} type="password" autoComplete="new-password" autoFocus value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "" })); }} error={errors.password} />
            <AuthField label="Confirm new password" icon={KeyRound} type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors((er) => ({ ...er, confirmPassword: "" })); }} error={errors.confirmPassword} />
            <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <>Update password <ArrowRight size={18} className="btn-arrow" /></>}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-[14px] text-stone-500">
        <Link to="/login" className="link-brand">Back to log in</Link>
      </p>
      {showForgot && <ForgotPasswordModal open onClose={() => setShowForgot(false)} />}
    </AuthLayout>
  );
}
