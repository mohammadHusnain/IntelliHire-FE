import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, ChevronDown, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import { invitationsApi } from "@/api/invitationsApi";
import { useCountdown } from "@/hooks/useCountdown";
import { INDUSTRIES } from "@/lib/industries";
import { ROUTES } from "@/config/routes";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD = { official_email: "email", password: "password", company_name: "companyName", industry: "industry", admin_full_name: "fullName", admin_phone: "phone" };
const labelCls = "mb-1.5 block text-[13px] font-medium text-stone-700";

/** /resubmit-company  A rejected company corrects its details and goes back into review. */
export default function ResubmitCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", companyName: "", industry: "", fullName: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, startWait] = useCountdown();
  const formRef = useRef(null);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setFormError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || wait > 0) return;
    const next = {};
    if (!form.email.trim()) next.email = "Enter the email you registered with";
    else if (!EMAIL_RX.test(form.email.trim())) next.email = "Enter a valid email address";
    if (!form.password) next.password = "Enter your password";
    if (!form.companyName.trim()) next.companyName = "Company name is required";
    if (!form.industry) next.industry = "Select an industry";
    if (!form.fullName.trim()) next.fullName = "Your name is required";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      await invitationsApi.resubmitCompany({ ...form, email: form.email.trim(), companyName: form.companyName.trim(), fullName: form.fullName.trim(), phone: form.phone.trim() });
      navigate(ROUTES.LOGIN, { replace: true, state: { resubmitted: true, email: form.email.trim() } });
    } catch (error) {
      const mapped = {};
      for (const [field, messages] of Object.entries(error.fieldErrors || {})) if (FIELD[field]) mapped[FIELD[field]] = messages[0];
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      } else {
        setFormError(error.message); // wrong password, not a rejected company, throttle, network
      }
      if (error.retryAfterSeconds) startWait(error.retryAfterSeconds);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      headline={<>Fix the details and <em className="!text-white/90">try again.</em></>}
      points={["Only for companies that were not approved", "Use the email and password you registered with", "We review it again and email you the decision"]}
    >
      <h1 className="display text-[34px] sm:text-[40px]">Submit your company again</h1>
      <p className="mt-2 text-[15px] text-stone-500">Check the reason in the rejection email, correct the details below and send it back for review.</p>

      {formError && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">{formError}</div>}

      <form ref={formRef} onSubmit={submit} noValidate className="mt-8 space-y-5">
        <AuthField label="Official email" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email} hint="The email you registered with" />
        <AuthField label="Password" icon={Lock} type="password" autoComplete="current-password" value={form.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />
        <AuthField label="Company name" icon={Building2} autoComplete="organization" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} error={errors.companyName} />
        <div>
          <label htmlFor="resubmit-industry" className={labelCls}>Industry</label>
          <div className="relative">
            <select id="resubmit-industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} aria-invalid={errors.industry ? "true" : undefined} className="field cursor-pointer appearance-none pr-10">
              <option value="">Select an industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          </div>
          {errors.industry && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{errors.industry}</p>}
        </div>
        <AuthField label="Your full name" icon={User} autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
        <AuthField label="Your phone number" icon={Phone} type="tel" autoComplete="tel" placeholder="+92 300 1234567" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
        <button type="submit" disabled={busy || wait > 0} className="btn-primary btn-lg w-full">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : wait > 0 ? `Try again in ${wait}s` : <>Submit for review <ArrowRight size={18} className="btn-arrow" /></>}
        </button>
      </form>

      <p className="mt-8 text-center text-[14px] text-stone-500"><Link to={ROUTES.LOGIN} className="link-brand">Back to log in</Link></p>
    </AuthLayout>
  );
}
