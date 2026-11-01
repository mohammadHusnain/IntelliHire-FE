import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, ChevronDown, Loader2, Lock, Mail, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import ForgotPasswordModal from "@/components/shared/ForgotPasswordModal";
import { DEMO_USERS } from "@/api/authApi";
import { ADMIN_CREDENTIALS } from "@/store/authStore";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_META = {
  candidate: { label: "Candidate", icon: User },
  company: { label: "Company", icon: Building2 },
  admin: { label: "Admin", icon: ShieldCheck },
};

const DEMO_ACCOUNTS = [
  ...DEMO_USERS,
  { email: ADMIN_CREDENTIALS.email, password: ADMIN_CREDENTIALS.password, role: "admin", name: "Super Admin" },
];

const validateEmail = (v) => (!v ? "Email is required" : !EMAIL_RX.test(v) ? "Enter a valid email address" : "");
const validatePassword = (v) => (!v ? "Password is required" : v.length < 6 ? "Password must be at least 6 characters" : "");

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const location = useLocation();
  const justRegistered = !!location.state?.registered;

  const [email, setEmail] = useState(justRegistered ? location.state?.email || "" : "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(next);
    setAuthError("");
    if (next.email || next.password) return;
    const result = await login(email.trim(), password);
    if (!result.success) {
      setAuthError(result.error || "Invalid email or password.");
      setShakeKey((k) => k + 1);
    }
  };

  const fillDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
    setAuthError("");
  };

  return (
    <AuthLayout
      headline={<>Welcome back to <em className="!text-white/90">smarter hiring.</em></>}
      points={["AI screening and technical interviews", "Clear, explainable candidate reports", "Every final decision stays human"]}
      topRight={
        <p className="hidden text-[13px] text-stone-500 sm:block">
          New here?{" "}
          <Link to="/register" className="link-brand">
            Create an account
          </Link>
        </p>
      }
    >
      <h1 className="display text-[34px] sm:text-[40px]">Welcome back</h1>
      <p className="mt-2 text-[15px] text-stone-500">Log in to continue to your IntelliHire workspace.</p>

      {justRegistered && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 animate-fade-in-up">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-[14px] text-emerald-800">
            <span className="font-semibold">Account created.</span> Log in below to get started.
          </p>
        </div>
      )}

      {authError && (
        <div
          key={shakeKey}
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 animate-shake"
        >
          <p className="flex-1 text-[14px] text-red-700">{authError}</p>
          <button
            type="button"
            onClick={() => setAuthError("")}
            aria-label="Dismiss"
            className="icon-btn -m-1 flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-700"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: "" })); }}
          onBlur={() => email && setErrors((er) => ({ ...er, email: validateEmail(email) }))}
          error={errors.email}
        />
        <AuthField
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: "" })); }}
          onBlur={() => password && setErrors((er) => ({ ...er, password: validatePassword(password) }))}
          error={errors.password}
          trailing={
            <button type="button" onClick={() => setShowForgot(true)} className="link-brand text-[13px]">
              Forgot password?
            </button>
          }
        />

        <button type="submit" disabled={isLoading} className="btn-primary btn-lg w-full">
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Log in <ArrowRight size={18} className="btn-arrow" />
            </>
          )}
        </button>
      </form>

      {/* Demo accounts */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50/60">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          aria-expanded={showDemo}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-stone-700 transition-colors hover:bg-stone-100/70"
        >
          Exploring? Use a demo account
          <ChevronDown size={16} className={`text-stone-400 transition-transform duration-300 ${showDemo ? "rotate-180" : ""}`} />
        </button>
        <div className="accordion-panel" data-open={showDemo}>
          <div>
            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const meta = ROLE_META[acc.role] || ROLE_META.candidate;
                const Icon = meta.icon;
                const active = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    tabIndex={showDemo ? 0 : -1}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      active
                        ? "border-brand text-brand shadow-[0_8px_18px_-10px_rgba(240,78,35,0.6)]"
                        : "border-[var(--line)] text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    <Icon size={17} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="px-4 pb-3 text-[12px] text-stone-500">Fills the form for you. Press Log in to continue.</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-[14px] text-stone-500">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="link-brand">
          Create one free
        </Link>
      </p>

      {showForgot && (
        <ForgotPasswordModal open onClose={() => setShowForgot(false)} initialEmail={EMAIL_RX.test(email) ? email : ""} />
      )}
    </AuthLayout>
  );
}
