import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const IntelliHireLogo = () => (
  <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
    <rect width="40" height="40" rx="10" fill="#F04E23" fillOpacity="0.1" />
    <path d="M12 12h4v16h-4zM18 16h4v12h-4zM24 8h4v20h-4z" fill="#F04E23" />
    <circle cx="30" cy="30" r="4" fill="#F04E23" />
  </svg>
);

function LoginPage() {
  const { login, isLoading } = useAuth();
  const location = useLocation();
  const registeredEmail = location.state?.registered ? (location.state?.email || "") : "";

  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");
  const justRegistered = !!location.state?.registered;
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return "Email is required";
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return "";
  };

  const validatePassword = (value) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    setAuthError("");
    if (emailErr || passwordErr) return;
    const result = await login(email, password);
    if (!result.success) {
      setAuthError(result.error || "Invalid email or password. Please try again.");
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail || validateEmail(resetEmail)) return;
    setResetSent(true);
  };

  const handleEmailBlur = () => setEmailError(validateEmail(email));
  const handlePasswordBlur = () => setPasswordError(validatePassword(password));

  const inputCls = (err) =>
    `w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
      err
        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
        : "border-[#E5E7EB] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
    }`;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px] bg-white rounded-xl p-[48px_40px] border border-[#E5E7EB]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <IntelliHireLogo />
          <span className="text-[24px] font-extrabold tracking-tight text-[#111827]">IntelliHire</span>
        </div>

        {/* Heading */}
        <h2 className="mt-6 text-[30px] text-[#0D0D0D] text-center">Welcome back</h2>
        <p className="mt-2 text-[14px] text-[#6B7280] text-center">Log in to your account</p>

        {/* Registration Success Banner */}
        {justRegistered && (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
            <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
            <span className="text-[14px] text-green-800">Account created! Log in below to continue.</span>
          </div>
        )}

        {/* Auth Error Banner */}
        {authError && (
          <div className="mt-6 flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <span className="flex-1 text-[14px] text-amber-800">{authError}</span>
            <button onClick={() => setAuthError("")} className="text-amber-600 hover:text-amber-800">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-5">
          <div>
            <label className="block text-[14px] text-[#374151] mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={handleEmailBlur}
              placeholder="you@example.com" className={inputCls(emailError)} />
            {emailError && <p className="mt-1 text-[13px] text-[#DC2626]">{emailError}</p>}
          </div>

          <div>
            <label className="block text-[14px] text-[#374151] mb-2">Password</label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur} placeholder="Your password" className={inputCls(passwordError) + " pr-12"} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordError && <p className="mt-1 text-[13px] text-[#DC2626]">{passwordError}</p>}
          </div>

          <div className="text-right">
            <button type="button" onClick={() => setShowForgotPassword(true)}
              className="text-[13px] text-[#F04E23] hover:underline">Forgot password?</button>
          </div>

          <button type="submit" disabled={isLoading}
            className="w-full h-[44px] bg-[#F04E23] hover:bg-[#D43D14] disabled:opacity-60 disabled:cursor-not-allowed text-white text-[15px] rounded-lg transition-all flex items-center justify-center">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Log In"}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-[14px] text-[#9CA3AF]">or</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        <p className="mt-6 text-center text-[14px] text-[#6B7280]">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#F04E23] hover:underline">Create one here</Link>
        </p>
        <div className="mt-5 p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
          <p className="text-[11px] font-semibold text-[#374151] mb-1.5 uppercase tracking-wide">Demo Credentials</p>
          <div className="space-y-1 text-[11px] text-[#6B7280] font-mono">
            <p>candidate@test.com / password123</p>
            <p>company@test.com &nbsp;&nbsp;/ password123</p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(""); }} />
          <div className="relative w-full max-w-[400px] bg-white rounded-xl p-8 border border-[#E5E7EB]">
            <button onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(""); }}
              className="absolute right-4 top-4 text-[#9CA3AF] hover:text-[#374151]"><X size={20} /></button>
            {resetSent ? (
              <div className="text-center py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <h3 className="text-[20px] font-semibold text-[#0D0D0D] mb-2">Check your email</h3>
                <p className="text-[14px] text-[#6B7280]">We've sent a password reset link to {resetEmail}</p>
              </div>
            ) : (
              <>
                <h3 className="text-[20px] font-semibold text-[#0D0D0D] mb-2">Reset your password</h3>
                <p className="text-[14px] text-[#6B7280] mb-6">Enter your email address and we'll send you a link to reset your password.</p>
                <form onSubmit={handleForgotPassword}>
                  <label className="block text-[14px] text-[#374151] mb-2">Email</label>
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-[44px] px-4 rounded-lg border border-[#E5E7EB] text-[15px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 mb-4" />
                  <button type="submit" disabled={!resetEmail}
                    className="w-full h-[44px] bg-[#F04E23] hover:bg-[#D43D14] disabled:opacity-60 text-white text-[15px] rounded-lg transition-all">
                    Send Reset Link
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
