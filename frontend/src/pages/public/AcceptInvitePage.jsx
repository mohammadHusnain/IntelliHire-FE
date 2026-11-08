import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, KeyRound, Loader2, Lock, MailWarning, User, WifiOff } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import { invitationsApi } from "@/api/invitationsApi";
import { ROUTES } from "@/config/routes";

/** What each failure of the invitation link means for the person holding it. */
const HELP = {
  expired: "Ask your company admin to send you a new invitation.",
  revoked: "Ask your company admin whether you should still join.",
  already_used: "You can log in with the password you chose.",
  company_unavailable: "The company is not active right now. Ask your company admin.",
  invalid_invitation: "Open the link from your invitation email, or ask for a new one.",
};

/** /accept-invite?token=...  Reads the invitation, removes the token from the address bar, then sets the password. */
export default function AcceptInvitePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // Captured once: the token is a credential and leaves the URL as soon as it has been read.
  const [token] = useState(() => params.get("token") || "");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: token ? "loading" : "missing", invite: null, error: null });
  const [form, setForm] = useState({ fullName: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  // One request per attempt, even when React StrictMode runs the effect twice in development.
  const request = useRef({ attempt: null, promise: null });

  useEffect(() => {
    if (!token) return;
    if (request.current.attempt !== attempt) {
      request.current = { attempt, promise: invitationsApi.details(token).then((invite) => ({ invite }), (error) => ({ error })) };
    }
    let live = true;
    request.current.promise.then(({ invite, error }) => {
      if (!live) return;
      if (invite) {
        setState({ phase: "ready", invite, error: null });
        setForm((f) => (f.fullName ? f : { ...f, fullName: invite.fullName }));
      } else if (error.isNetwork || error.status >= 500 || error.status === 429) setState({ phase: "network", invite: null, error });
      else setState({ phase: "invalid", invite: null, error });
      setParams({}, { replace: true });
    });
    return () => {
      live = false;
    };
  }, [token, attempt, setParams]);

  const retry = () => {
    setState({ phase: "loading", invite: null, error: null });
    setAttempt((n) => n + 1);
  };

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setFormError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name";
    if (!form.password) next.password = "Choose a password";
    if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      await invitationsApi.accept(token, { fullName: form.fullName.trim(), password: form.password, confirmPassword: form.confirmPassword });
      navigate(ROUTES.LOGIN, { replace: true, state: { invited: true, email: state.invite.email } });
    } catch (error) {
      const fe = error.fieldErrors || {};
      const mapped = { fullName: fe.full_name?.[0], password: fe.password?.[0] || fe.new_password?.[0], confirmPassword: fe.confirm_password?.[0] };
      if (mapped.fullName || mapped.password || mapped.confirmPassword) {
        setErrors(mapped);
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      } else {
        setFormError(error.message); // taken e-mail, used or expired link, throttle, network
      }
    } finally {
      setBusy(false);
    }
  };

  const { phase, invite, error } = state;

  return (
    <AuthLayout
      headline={<>Join your team on <em className="!text-white/90">IntelliHire.</em></>}
      points={["Set a password and you are in", "Your admin controls your access", "Invitation links can be used once"]}
    >
      {phase === "loading" && (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto animate-spin text-brand" size={30} aria-label="Checking your invitation" />
          <p className="mt-4 text-[15px] text-stone-600">Checking your invitation…</p>
        </div>
      )}

      {(phase === "invalid" || phase === "missing") && (
        <div className="py-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><MailWarning size={26} /></span>
          <h1 className="display mt-5 text-[32px]">{phase === "missing" ? "Invitation link needed" : "This invitation can't be used"}</h1>
          <p role="alert" className="mt-2 text-[15px] leading-relaxed text-stone-600">
            {phase === "missing" ? "Open the link from your invitation email." : error.message}
          </p>
          <p className="mt-2 text-[14px] text-stone-500">{phase === "missing" ? HELP.invalid_invitation : HELP[error.code] || HELP.invalid_invitation}</p>
          <Link to={ROUTES.LOGIN} className="link-brand mt-6 inline-block text-[14px]">Go to log in</Link>
        </div>
      )}

      {phase === "network" && (
        <div className="py-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><WifiOff size={26} /></span>
          <h1 className="display mt-5 text-[32px]">We couldn&apos;t check it yet</h1>
          <p role="alert" className="mt-2 text-[15px] text-stone-600">{error.message}</p>
          <button type="button" onClick={retry} className="btn-primary btn-lg mt-7 w-full">Try again</button>
        </div>
      )}

      {phase === "ready" && (
        <>
          <h1 className="display text-[34px] sm:text-[40px]">Join {invite.companyName}</h1>
          <p className="mt-2 text-[15px] text-stone-500">
            You were invited as <span className="font-semibold text-ink">{invite.roleLabel}</span> with <span className="font-semibold text-ink">{invite.email}</span>. Choose a password to finish.
          </p>
          {formError && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">{formError}</div>}
          <form ref={formRef} onSubmit={submit} noValidate className="mt-8 space-y-5">
            <AuthField label="Full name" icon={User} autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
            <AuthField label="Password" icon={Lock} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />
            <AuthField label="Confirm password" icon={KeyRound} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} error={errors.confirmPassword} />
            <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <>Join the team <ArrowRight size={18} className="btn-arrow" /></>}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
