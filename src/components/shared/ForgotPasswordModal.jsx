import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mail, MailCheck, X } from "lucide-react";
import AuthField from "./AuthField";
import { authApi } from "@/api/authApi";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordModal({ open, onClose, initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RX.test(email)) return setError("Enter a valid email address");
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSentTo(email);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="animate-modal-in relative w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="icon-btn absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink"
        >
          <X size={18} />
        </button>

        {sentTo ? (
          <div className="py-2 text-center">
            <span className="animate-pop mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <MailCheck size={26} />
            </span>
            <h3 id="forgot-title" className="display mt-5 text-[26px]">Check your inbox</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-stone-500">
              If an account exists for <span className="font-semibold text-ink">{sentTo}</span>, a reset link is on its way.
            </p>
            <button type="button" onClick={onClose} className="btn-dark mt-7 w-full">
              Back to log in
            </button>
          </div>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Mail size={22} />
            </span>
            <h3 id="forgot-title" className="display mt-5 text-[26px]">Reset your password</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-stone-500">
              Enter the email you signed up with and we will send you a reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <AuthField
                label="Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <><Loader2 size={17} className="animate-spin" /> Sending link…</> : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
