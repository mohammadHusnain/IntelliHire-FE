// Multi-step registration wizard
// Candidate: Account → Role & Skills → Links & CV → Review
// Company:   Account → Company Info
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, CloudUpload,
  FileText, Globe, ImagePlus, Info, Loader2, Lock, Mail, Pencil, Search, User, X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ROLE_CATEGORIES } from "@/data/rolesData";
import { SKILLS_LIST, ROLE_SKILLS } from "@/data/skillsData";
import AuthLayout from "@/components/layout/AuthLayout";
import AuthField from "@/components/shared/AuthField";
import { GithubIcon, LinkedinIcon } from "@/components/shared/BrandIcons";

const CANDIDATE_STEPS = ["Account", "Role & skills", "Links & CV", "Review"];
const COMPANY_STEPS = ["Account", "Company info"];
const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing",
  "Consulting", "Media", "Real Estate", "Non-profit", "Other",
];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];
const MAX_SKILLS = 15;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PANEL = {
  company: {
    headline: <>Hire with evidence, <em className="!text-white/90">not guesswork.</em></>,
    points: ["AI reads every CV against your role", "Automated screening and technical rounds", "Structured reports for the final call"],
  },
  individual: {
    headline: <>Rehearse the interview <em className="!text-white/90">before it counts.</em></>,
    points: ["Mock interviews for your exact role", "Feedback on delivery and technical depth", "Join focused talent communities"],
  },
  none: {
    headline: <>Interviews that find <em className="!text-white/90">real talent.</em></>,
    points: ["Practise interviews as a candidate", "Run AI-assisted hiring as a company", "People always make the final decision"],
  },
};

const STEP_TITLES = {
  "individual-1": ["Create your account", "Choose how you will use IntelliHire."],
  "individual-2": ["Your role and skills", "We tailor interview questions to this."],
  "individual-3": ["Professional profile", "Connect your profiles and upload your CV."],
  "individual-4": ["Review and confirm", "Check everything before we create your account."],
  "company-1": ["Create your account", "Choose how you will use IntelliHire."],
  "company-2": ["Company details", "Candidates see this on your roles."],
};

function strengthOf(p) {
  if (!p) return { score: 0, label: "", tone: "bg-stone-200", text: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return [
    { score: 0, label: "Too short", tone: "bg-red-500", text: "text-red-600" },
    { score: 1, label: "Weak", tone: "bg-red-500", text: "text-red-600" },
    { score: 2, label: "Fair", tone: "bg-amber-500", text: "text-amber-600" },
    { score: 3, label: "Good", tone: "bg-sky-500", text: "text-sky-600" },
    { score: 4, label: "Strong", tone: "bg-emerald-500", text: "text-emerald-600" },
  ][s];
}

function Progress({ steps, current, onJump }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between text-[12px] font-medium">
        <span className="text-stone-500">
          Step <span className="font-semibold text-ink">{current}</span> of {steps.length}
        </span>
        <span className="font-semibold text-brand">{steps[current - 1]}</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          return (
            <button
              key={label}
              type="button"
              disabled={!done}
              onClick={() => onJump(n)}
              aria-label={done ? `Back to ${label}` : label}
              className="group h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 disabled:cursor-default"
            >
              <span
                className={`block h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-[var(--ease-premium)] ${
                  done ? "group-hover:bg-brand-hover" : ""
                }`}
                style={{ transform: `scaleX(${n <= current ? 1 : 0})` }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p role="alert" className="mt-1.5 text-[12.5px] text-red-600 animate-fade-in">{children}</p>;
}

const labelCls = "mb-1.5 block text-[13px] font-medium text-stone-700";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState(() => {
    const r = searchParams.get("role");
    return {
      role: r === "individual" || r === "company" ? r : null,
      fullName: "", email: "", password: "", confirmPassword: "",
      desiredRole: "", skills: [], linkedIn: "", github: "",
      cvFile: null, cvFileName: "", cvSize: 0,
      companyName: "", industry: "", companySize: "", website: "", description: "", logoPreview: null,
    };
  });
  const upd = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  };

  const [roleSearch, setRoleSearch] = useState("");
  const [showRoleDrop, setShowRoleDrop] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const roleDropRef = useRef(null);

  const steps = form.role === "company" ? COMPANY_STEPS : CANDIDATE_STEPS;
  const panel = PANEL[form.role || "none"];
  const strength = strengthOf(form.password);

  useEffect(() => {
    const handler = (e) => {
      if (roleDropRef.current && !roleDropRef.current.contains(e.target)) setShowRoleDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.role) e.role = "Choose an account type to continue";
      if (!form.fullName.trim()) e.fullName = "Full name is required";
      if (!form.email) e.email = "Email is required";
      else if (!EMAIL_RX.test(form.email)) e.email = "Enter a valid email address";
      if (!form.password) e.password = "Password is required";
      else if (form.password.length < 8) e.password = "Use at least 8 characters";
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    }
    if (s === 2 && form.role === "individual") {
      if (!form.desiredRole) e.desiredRole = "Select the role you are aiming for";
      if (form.skills.length === 0) e.skills = "Add at least one skill";
    }
    if (s === 2 && form.role === "company") {
      if (!form.companyName.trim()) e.companyName = "Company name is required";
      if (!form.industry) e.industry = "Select an industry";
      if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) e.website = "Enter a full URL, including https://";
    }
    if (s === 3) {
      if (!form.linkedIn.trim()) e.linkedIn = "LinkedIn URL is required";
      else if (!form.linkedIn.includes("linkedin.com")) e.linkedIn = "Enter a LinkedIn profile URL";
      if (!form.github.trim()) e.github = "GitHub URL is required";
      else if (!form.github.includes("github.com")) e.github = "Enter a GitHub profile URL";
      if (!form.cvFileName) e.cv = "Upload your CV to continue";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goTo = (n) => {
    setDir(n > step ? "next" : "back");
    setStep(n);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => validate(step) && goTo(step + 1);
  const back = () => goTo(step - 1);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const payload = {
        name: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role === "company" ? "company" : "candidate",
        ...(form.role === "individual"
          ? { desiredRole: form.desiredRole, skills: form.skills, linkedIn: form.linkedIn, github: form.github, cvFileName: form.cvFileName }
          : { companyName: form.companyName, industry: form.industry, companySize: form.companySize, website: form.website, description: form.description, logoFileName: form.logoPreview ? "company-logo.png" : "" }),
      };
      const result = await register(payload);
      if (result.success) {
        navigate("/login", { replace: true, state: { registered: true, email: result.email } });
      } else {
        setErrors({ submit: result.error });
      }
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isFinalStep = step === steps.length;
  const onSubmit = (e) => {
    e.preventDefault();
    if (showRoleDrop) return;
    if (isFinalStep) {
      if (validate(step)) handleSubmit();
    } else next();
  };

  const handleFile = (file) => {
    if (!file) return;
    const valid = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!valid.includes(file.type)) return setErrors((e) => ({ ...e, cv: "Upload a PDF or Word document" }));
    if (file.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, cv: "File must be under 5 MB" }));
    setErrors((e) => ({ ...e, cv: "" }));
    setForm((f) => ({ ...f, cvFile: file, cvFileName: file.name, cvSize: file.size }));
  };

  const handleLogo = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return setErrors((e) => ({ ...e, logo: "Logo must be under 2 MB" }));
    setErrors((e) => ({ ...e, logo: "" }));
    const reader = new FileReader();
    reader.onload = (ev) => upd("logoPreview", ev.target.result);
    reader.readAsDataURL(file);
  };

  const toggleSkill = useCallback(
    (skill) =>
      setForm((f) => ({
        ...f,
        skills: f.skills.includes(skill)
          ? f.skills.filter((s) => s !== skill)
          : f.skills.length < MAX_SKILLS ? [...f.skills, skill] : f.skills,
      })),
    [],
  );

  const filteredCategories = ROLE_CATEGORIES.map((c) => ({
    ...c,
    roles: c.roles.filter((r) => r.toLowerCase().includes(roleSearch.toLowerCase())),
  })).filter((c) => c.roles.length > 0);

  const q = skillSearch.toLowerCase();
  const roleSections = form.desiredRole && ROLE_SKILLS[form.desiredRole] ? ROLE_SKILLS[form.desiredRole] : null;
  const skillSections = roleSections
    ? roleSections
        .map((sec) => ({ ...sec, skills: sec.skills.filter((s) => s.toLowerCase().includes(q) && !form.skills.includes(s)) }))
        .filter((sec) => sec.skills.length > 0)
    : [{ label: "Popular skills", skills: SKILLS_LIST.filter((s) => s.toLowerCase().includes(q) && !form.skills.includes(s)).slice(0, 40) }].filter(
        (sec) => sec.skills.length > 0,
      );

  // ─── Steps ────────────────────────────────────────────────────────────────

  const renderAccount = () => (
    <div className="space-y-5">
      <div>
        <p className={labelCls}>I want to</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
          {[
            { val: "individual", icon: User, title: "Practise interviews", sub: "I'm a candidate" },
            { val: "company", icon: Building2, title: "Hire talent", sub: "I represent a company" },
          ].map(({ val, icon: Icon, title, sub }) => {
            const on = form.role === val;
            return (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${title}: ${sub}`}
                onClick={() => { upd("role", val); setErrors((e) => ({ ...e, role: "" })); }}
                className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300 ease-[var(--ease-premium)] ${
                  on
                    ? "border-brand bg-brand-soft shadow-[0_12px_28px_-16px_rgba(240,78,35,0.6)]"
                    : errors.role
                      ? "border-red-300 bg-white"
                      : "border-[var(--line)] bg-white hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_12px_24px_-18px_rgba(13,13,13,0.3)]"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 ${
                    on ? "bg-brand text-white" : "bg-stone-100 text-stone-500 group-hover:text-ink"
                  }`}
                >
                  <Icon size={19} />
                </span>
                <span>
                  <span className={`block text-[14px] font-semibold ${on ? "text-brand" : "text-ink"}`}>{title}</span>
                  <span className="mt-0.5 block text-[12px] text-stone-500">{sub}</span>
                </span>
                {on && (
                  <span className="animate-pop absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <FieldError>{errors.role}</FieldError>
      </div>

      <AuthField label="Full name" icon={User} autoComplete="name" placeholder="Your full name"
        value={form.fullName} onChange={(e) => upd("fullName", e.target.value)} error={errors.fullName} />
      <AuthField label={form.role === "company" ? "Work email" : "Email"} icon={Mail} type="email" autoComplete="email"
        placeholder={form.role === "company" ? "you@company.com" : "you@example.com"}
        value={form.email} onChange={(e) => upd("email", e.target.value)} error={errors.email} />

      <div>
        <AuthField label="Password" icon={Lock} type="password" autoComplete="new-password" placeholder="At least 8 characters"
          value={form.password} onChange={(e) => upd("password", e.target.value)} error={errors.password} />
        {form.password && !errors.password && (
          <div className="mt-2.5 flex items-center gap-3 animate-fade-in">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200">
                  <span
                    className={`block h-full rounded-full transition-all duration-500 ease-[var(--ease-premium)] ${strength.tone}`}
                    style={{ width: strength.score >= n ? "100%" : "0%" }}
                  />
                </span>
              ))}
            </div>
            <span className={`w-14 text-right text-[12px] font-semibold ${strength.text}`}>{strength.label}</span>
          </div>
        )}
      </div>

      <AuthField label="Confirm password" icon={Lock} type="password" autoComplete="new-password" placeholder="Repeat your password"
        value={form.confirmPassword} onChange={(e) => upd("confirmPassword", e.target.value)} error={errors.confirmPassword}
        hint={form.confirmPassword && form.confirmPassword === form.password ? "Passwords match" : undefined} />
    </div>
  );

  const renderRoleSkills = () => (
    <div className="space-y-6">
      <div ref={roleDropRef} className="relative">
        <label className={labelCls}>Target role</label>
        <button
          type="button"
          onClick={() => setShowRoleDrop((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={showRoleDrop}
          aria-invalid={errors.desiredRole ? "true" : undefined}
          className={`field flex items-center justify-between text-left ${showRoleDrop ? "!border-brand shadow-[0_0_0_4px_rgba(240,78,35,0.12)]" : ""}`}
        >
          <span className={form.desiredRole ? "text-ink" : "text-stone-400"}>{form.desiredRole || "Search or select a role"}</span>
          <ChevronDown size={17} className={`text-stone-400 transition-transform duration-300 ${showRoleDrop ? "rotate-180" : ""}`} />
        </button>
        {showRoleDrop && (
          <div className="animate-fade-in-up absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white shadow-[0_24px_48px_-20px_rgba(13,13,13,0.35)]">
            <div className="sticky top-0 border-b border-stone-100 bg-white p-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  autoFocus
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setShowRoleDrop(false)}
                  placeholder="Search roles"
                  className="field !h-10 !rounded-xl !pl-9 !text-[14px]"
                />
              </div>
            </div>
            <div role="listbox" className="p-1.5">
              {filteredCategories.length === 0 ? (
                <p className="p-4 text-center text-[13px] text-stone-400">No roles match &ldquo;{roleSearch}&rdquo;</p>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.category}>
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{cat.category}</p>
                    {cat.roles.map((r) => {
                      const sel = form.desiredRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          role="option"
                          aria-selected={sel}
                          onClick={() => { upd("desiredRole", r); setShowRoleDrop(false); setRoleSearch(""); setSkillSearch(""); setErrors((e) => ({ ...e, desiredRole: "" })); }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                            sel ? "bg-brand-soft font-medium text-brand" : "text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {r}
                          {sel && <Check size={15} />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <FieldError>{errors.desiredRole}</FieldError>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`${labelCls} !mb-0`}>Skills</span>
          <span className={`text-[12px] font-medium tabular-nums ${form.skills.length >= MAX_SKILLS ? "text-brand" : "text-stone-400"}`}>
            {form.skills.length}/{MAX_SKILLS}
          </span>
        </div>

        <div
          className={`min-h-[52px] rounded-2xl border p-2 transition-colors ${
            errors.skills ? "border-red-300 bg-red-50/40" : "border-[var(--line)] bg-stone-50/70"
          }`}
        >
          {form.skills.length === 0 ? (
            <p className="px-2 py-2 text-[13px] text-stone-400">Your selected skills appear here</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {form.skills.map((s) => (
                <span key={s} className="animate-pop inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-[12px] font-medium text-white">
                  {s}
                  <button
                    type="button"
                    onClick={() => toggleSkill(s)}
                    aria-label={`Remove ${s}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <FieldError>{errors.skills}</FieldError>

        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder={roleSections ? `Search ${form.desiredRole} skills` : "Search skills"}
            className="field !h-10 !pl-10 !text-[14px]"
          />
        </div>

        <div className="mt-3 max-h-56 space-y-4 overflow-y-auto pr-1">
          {skillSections.map((sec) => (
            <div key={sec.label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{sec.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {sec.skills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    disabled={form.skills.length >= MAX_SKILLS}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-medium text-stone-600 transition-all duration-200 hover:-translate-y-px hover:border-brand/50 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {skillSections.length === 0 && (
            <p className="py-4 text-center text-[13px] text-stone-400">
              {skillSearch ? `No skills match "${skillSearch}"` : "Every suggested skill is selected."}
            </p>
          )}
        </div>
        {!form.desiredRole && <p className="mt-2 text-[12px] text-stone-500">Pick a target role to see skills grouped for it.</p>}
      </div>
    </div>
  );

  const renderCompany = () => (
    <div className="space-y-5">
      <div>
        <p className={labelCls}>
          Company logo <span className="font-normal text-stone-400">(optional)</span>
        </p>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className={`group flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-300 ${
              form.logoPreview ? "border-[var(--line)]" : "border-dashed border-stone-300 bg-stone-50 hover:border-brand hover:bg-brand-soft"
            }`}
            aria-label={form.logoPreview ? "Change logo" : "Upload logo"}
          >
            {form.logoPreview ? (
              <img src={form.logoPreview} alt="Company logo preview" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus size={22} className="text-stone-400 transition-colors group-hover:text-brand" />
            )}
          </button>
          <div className="text-[12px] text-stone-500">
            <p>PNG or JPG, up to 2 MB.</p>
            {form.logoPreview && (
              <button type="button" onClick={() => upd("logoPreview", null)} className="mt-1 font-semibold text-red-600 hover:text-red-700">
                Remove logo
              </button>
            )}
          </div>
        </div>
        <FieldError>{errors.logo}</FieldError>
      </div>

      <AuthField label="Company name" icon={Building2} placeholder="Acme Inc." autoComplete="organization"
        value={form.companyName} onChange={(e) => upd("companyName", e.target.value)} error={errors.companyName} />

      <div>
        <label htmlFor="industry" className={labelCls}>Industry</label>
        <div className="relative">
          <select
            id="industry"
            value={form.industry}
            onChange={(e) => upd("industry", e.target.value)}
            aria-invalid={errors.industry ? "true" : undefined}
            className={`field cursor-pointer appearance-none pr-10 ${form.industry ? "" : "!text-stone-400"}`}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i} className="text-ink">{i}</option>)}
          </select>
          <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        </div>
        <FieldError>{errors.industry}</FieldError>
      </div>

      <div>
        <p className={labelCls}>
          Team size <span className="font-normal text-stone-400">(employees)</span>
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Team size">
          {COMPANY_SIZES.map((s) => {
            const on = form.companySize === `${s} employees`;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => upd("companySize", on ? "" : `${s} employees`)}
                className={`h-10 rounded-xl border px-4 text-[13px] font-semibold transition-all duration-200 ${
                  on ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600 hover:border-stone-300 hover:text-ink"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <AuthField label="Website" icon={Globe} type="url" placeholder="https://yourcompany.com" autoComplete="url"
        value={form.website} onChange={(e) => upd("website", e.target.value)} error={errors.website} />

      <div>
        <label htmlFor="description" className={labelCls}>
          About the company <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <div className="relative">
          <textarea
            id="description"
            rows={4}
            value={form.description}
            onChange={(e) => upd("description", e.target.value.slice(0, 500))}
            placeholder="Your mission, culture and what makes your team a great place to work."
            className="field !h-auto resize-none py-3 pb-7"
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-[11px] tabular-nums text-stone-400">
            {form.description.length}/500
          </span>
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4">
        <Info size={17} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-[13px] leading-relaxed text-stone-700">
          <span className="font-semibold text-ink">What happens next?</span> Our team reviews new company accounts. Once
          approved, you can post roles and use every AI hiring tool.
        </p>
      </div>
    </div>
  );

  const renderLinks = () => (
    <div className="space-y-5">
      <AuthField label="LinkedIn profile" icon={LinkedinIcon} type="url" placeholder="https://linkedin.com/in/your-profile"
        value={form.linkedIn} onChange={(e) => upd("linkedIn", e.target.value)} error={errors.linkedIn} />
      <AuthField label="GitHub profile" icon={GithubIcon} type="url" placeholder="https://github.com/your-username"
        value={form.github} onChange={(e) => upd("github", e.target.value)} error={errors.github} />

      <div>
        <p className={labelCls}>CV / résumé</p>
        {form.cvFileName ? (
          <div className="animate-pop flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              <FileText size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{form.cvFileName}</p>
              <p className="flex items-center gap-1 text-[12px] text-emerald-700">
                <CheckCircle2 size={12} /> Uploaded · {(form.cvSize / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, cvFile: null, cvFileName: "", cvSize: 0 }))}
              aria-label="Remove CV"
              className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all duration-300 ${
              isDragging
                ? "scale-[1.01] border-brand bg-brand-soft"
                : errors.cv
                  ? "border-red-300 bg-red-50/40"
                  : "border-stone-300 bg-stone-50/60 hover:border-brand/60 hover:bg-brand-soft/60"
            }`}
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${
                isDragging ? "-translate-y-1 bg-brand text-white" : "bg-white text-stone-400 shadow-sm group-hover:-translate-y-1 group-hover:text-brand"
              }`}
            >
              <CloudUpload size={22} />
            </span>
            <span className="text-[14px] font-semibold text-ink">{isDragging ? "Drop to upload" : "Drop your CV here, or browse"}</span>
            <span className="text-[12px] text-stone-500">PDF or Word · up to 5 MB</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <FieldError>{errors.cv}</FieldError>
      </div>
    </div>
  );

  const renderReview = () => {
    const none = (t) => <span className="text-stone-400">{t}</span>;
    const sections = [
      { title: "Account", edit: 1, rows: [["Name", form.fullName], ["Email", form.email], ["Password", "••••••••"]] },
      {
        title: "Role and skills",
        edit: 2,
        rows: [
          ["Target role", form.desiredRole || none("Not set")],
          [
            "Skills",
            form.skills.length ? (
              <span className="flex flex-wrap gap-1">
                {form.skills.map((s) => (
                  <span key={s} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{s}</span>
                ))}
              </span>
            ) : none("None selected"),
          ],
        ],
      },
      { title: "Profile", edit: 3, rows: [["LinkedIn", form.linkedIn || none("Not provided")], ["GitHub", form.github || none("Not provided")], ["CV", form.cvFileName || none("Not uploaded")]] },
    ];
    return (
      <div className="space-y-3">
        {sections.map((sec, i) => (
          <div key={sec.title} className="overflow-hidden rounded-2xl border border-[var(--line)] animate-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center justify-between bg-stone-50/80 px-4 py-2.5">
              <p className="text-[13px] font-semibold text-ink">{sec.title}</p>
              <button type="button" onClick={() => goTo(sec.edit)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-soft">
                <Pencil size={11} /> Edit
              </button>
            </div>
            <dl className="divide-y divide-stone-100">
              {sec.rows.map(([k, v]) => (
                <div key={k} className="flex gap-3 px-4 py-2.5">
                  <dt className="w-24 shrink-0 text-[12px] text-stone-500">{k}</dt>
                  <dd className="min-w-0 flex-1 break-words text-[13px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  };

  const stepContent = () => {
    if (step === 1) return renderAccount();
    if (step === 2) return form.role === "company" ? renderCompany() : renderRoleSkills();
    if (step === 3) return renderLinks();
    return renderReview();
  };

  const [heading, sub] = STEP_TITLES[`${form.role === "company" ? "company" : "individual"}-${step}`] || ["Create your account", ""];

  return (
    <AuthLayout
      wide
      headline={panel.headline}
      points={panel.points}
      topRight={
        <p className="hidden text-[13px] text-stone-500 sm:block">
          Have an account?{" "}
          <Link to="/login" className="link-brand">Log in</Link>
        </p>
      }
    >
      <Progress steps={steps} current={step} onJump={goTo} />

      <div key={step} className={dir === "next" ? "animate-step-next" : dir === "back" ? "animate-step-back" : ""}>
        <h1 className="display text-[30px] sm:text-[36px]">{heading}</h1>
        <p className="mt-2 text-[15px] text-stone-500">{sub}</p>

        <form onSubmit={onSubmit} noValidate className="mt-7">
          {stepContent()}

          {errors.submit && (
            <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 animate-shake">
              <p className="flex-1 text-[13px] text-red-700">{errors.submit}</p>
              <button type="button" onClick={() => setErrors((e) => ({ ...e, submit: "" }))} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <button type="button" onClick={back} className="btn-secondary btn-lg">
                <ArrowLeft size={17} /> Back
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <button type="submit" disabled={isLoading} className="btn-primary btn-lg sm:min-w-[180px]">
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Creating account…</>
              ) : isFinalStep ? (
                <><CheckCircle2 size={18} /> Create account</>
              ) : (
                <>Continue <ArrowRight size={18} className="btn-arrow" /></>
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-8 text-center text-[13px] text-stone-500 sm:hidden">
        Have an account? <Link to="/login" className="link-brand">Log in</Link>
      </p>
    </AuthLayout>
  );
}
