// Multi-Step Registration / Onboarding Wizard
// Candidate: 4 steps -- Account -> Role & Skills -> Links & CV -> Review
// Company:   2 steps -- Account -> Company Info
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Eye, EyeOff, Loader2, Check, User, Building2,
  Upload, FileText, X, ChevronDown, Search,
  ArrowLeft, CheckCircle2, Edit2,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ROLE_CATEGORIES } from "@/data/rolesData";
import { SKILLS_LIST, ROLE_SKILLS } from "@/data/skillsData";

//  Constants 
const CANDIDATE_STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Role & Skills" },
  { id: 3, label: "Links & CV" },
  { id: 4, label: "Review" },
];
const COMPANY_STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Company Info" },
];
const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education",
  "Retail", "Manufacturing", "Consulting", "Media",
  "Real Estate", "Non-profit", "Other",
];
const COMPANY_SIZES = [
  "1–10 employees", "11–50 employees", "51–200 employees",
  "201–500 employees", "500+ employees",
];
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//  Logo 
const IntelliHireLogo = () => (
  <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
    <rect width="40" height="40" rx="10" fill="#F04E23" fillOpacity="0.1" />
    <path d="M12 12h4v16h-4zM18 16h4v12h-4zM24 8h4v20h-4z" fill="#F04E23" />
    <circle cx="30" cy="30" r="4" fill="#F04E23" />
  </svg>
);

//  Step Indicator 
function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = s.id < currentStep;
        const active = s.id === currentStep;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all ${
                done ? "bg-[#F04E23] text-white" : active ? "border-2 border-[#F04E23] text-[#F04E23] bg-white" : "border-2 border-[#E5E7EB] text-[#9CA3AF] bg-white"
              }`}>
                {done ? <Check size={14} /> : s.id}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${active ? "text-[#F04E23]" : done ? "text-[#374151]" : "text-[#9CA3AF]"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 sm:w-16 h-[2px] mb-5 mx-1 rounded transition-all ${s.id < currentStep ? "bg-[#F04E23]" : "bg-[#E5E7EB]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

//  Main Component 
function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((s) => s.register);

  //  Step management 
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  //  Unified form state 
  const [form, setForm] = useState({
    role: null,            // "individual" | "company"
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    desiredRole: "",       // candidate only
    skills: [],            // candidate only
    linkedIn: "",          // candidate only
    github: "",            // candidate only
    cvFile: null,          // candidate only
    cvFileName: "",
    cvSize: 0,
    companyName: "",       // company only
    industry: "",          // company only
    companySize: "",       // company only
    website: "",           // company only
    description: "",       // company only
    logoPreview: null,     // company only
  });
  const upd = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  //  UI state 
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [showRoleDrop, setShowRoleDrop] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const logoRef = useRef(null);
  const roleDropRef = useRef(null);

  const steps = form.role === "company" ? COMPANY_STEPS : CANDIDATE_STEPS;

  // Pre-select role from URL param
  useEffect(() => {
    const r = searchParams.get("role");
    if (r === "individual" || r === "company") upd("role", r);
  }, []);

  // Close role dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (roleDropRef.current && !roleDropRef.current.contains(e.target)) setShowRoleDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  //  Password strength 
  const pwdStrength = useCallback((p) => {
    if (!p) return { score: 0, label: "", color: "#E5E7EB" };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return [
      { score: 0, label: "", color: "#E5E7EB" },
      { score: 1, label: "Weak", color: "#DC2626" },
      { score: 2, label: "Fair", color: "#D97706" },
      { score: 3, label: "Good", color: "#2563EB" },
      { score: 4, label: "Strong", color: "#16A34A" },
    ][s];
  }, []);

  //  Validation 
  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.role) e.role = "Please select an account type";
      if (!form.fullName.trim()) e.fullName = "Full name is required";
      if (!form.email) e.email = "Email is required";
      else if (!EMAIL_RX.test(form.email)) e.email = "Enter a valid email address";
      if (!form.password) e.password = "Password is required";
      else if (form.password.length < 8) e.password = "At least 8 characters required";
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    }
    if (s === 2 && form.role === "individual") {
      if (!form.desiredRole) e.desiredRole = "Please select your desired role";
      if (form.skills.length === 0) e.skills = "Add at least one skill";
    }
    if (s === 2 && form.role === "company") {
      if (!form.companyName.trim()) e.companyName = "Company name is required";
      if (!form.industry) e.industry = "Please select an industry";
      if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) e.website = "Enter a valid URL (include https://)";
    }
    if (s === 3) {
      if (!form.linkedIn.trim()) e.linkedIn = "LinkedIn URL is required";
      else if (!form.linkedIn.includes("linkedin.com")) e.linkedIn = "Enter a valid LinkedIn URL (must contain linkedin.com)";
      if (!form.github.trim()) e.github = "GitHub URL is required";
      else if (!form.github.includes("github.com")) e.github = "Enter a valid GitHub URL (must contain github.com)";
      if (!form.cvFileName) e.cv = "Please upload your CV before continuing";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) { setStep((s) => s + 1); window.scrollTo(0, 0); } };
  const back = () => { setStep((s) => s - 1); setErrors({}); window.scrollTo(0, 0); };

  //  Submit 
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

  //  CV upload 
  const handleFile = (file) => {
    if (!file) return;
    const valid = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!valid.includes(file.type)) return setErrors((e) => ({ ...e, cv: "Upload a PDF or Word document" }));
    if (file.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, cv: "File must be under 5 MB" }));
    setErrors((e) => ({ ...e, cv: "" }));
    setForm((f) => ({ ...f, cvFile: file, cvFileName: file.name, cvSize: file.size }));
  };

  const handleLogo = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => upd("logoPreview", ev.target.result);
    reader.readAsDataURL(file);
  };

  //  Skills 
  const toggleSkill = (skill) =>
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : f.skills.length < 15 ? [...f.skills, skill] : f.skills,
    }));

  //  Filtered data 
  const filteredCategories = ROLE_CATEGORIES.map((c) => ({
    ...c, roles: c.roles.filter((r) => r.toLowerCase().includes(roleSearch.toLowerCase())),
  })).filter((c) => c.roles.length > 0);

  // Role-specific sections or flat fallback
  const roleSkillSections = form.desiredRole && ROLE_SKILLS[form.desiredRole]
    ? ROLE_SKILLS[form.desiredRole]
    : null;

  const availableSkills = SKILLS_LIST.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !form.skills.includes(s)
  );

  // Filtered sections for role-specific view
  const filteredSections = roleSkillSections
    ? roleSkillSections
        .map((sec) => ({
          ...sec,
          skills: sec.skills.filter(
            (s) =>
              s.toLowerCase().includes(skillSearch.toLowerCase()) &&
              !form.skills.includes(s)
          ),
        }))
        .filter((sec) => sec.skills.length > 0)
    : null;

  //  Shared input styles 
  const inputCls = (err) =>
    `w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all bg-white ${
      err ? "border-[#DC2626] focus:ring-2 focus:ring-red-100" : "border-[#E5E7EB] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
    }`;
  const label = "block text-[13px] font-medium text-[#374151] mb-1.5";
  const errTxt = "mt-1 text-[12px] text-[#DC2626]";

  // 
  // STEP RENDERERS
  // 

  //  Step 1: Account Details 
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <p className={label}>I am a...</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: "individual", icon: User, title: "Candidate", sub: "I'm looking for a job" },
            { val: "company", icon: Building2, title: "Company", sub: "I'm hiring talent" },
          ].map(({ val, icon: Icon, title, sub }) => (
            <button key={val} type="button" onClick={() => upd("role", val)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                form.role === val ? "border-[#F04E23] bg-[#FFF4F1]" : "border-[#E5E7EB] hover:border-[#FCA68A] bg-white"
              }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.role === val ? "bg-[#F04E23] text-white" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className={`text-[14px] font-semibold ${form.role === val ? "text-[#F04E23]" : "text-[#111827]"}`}>{title}</p>
                <p className="text-[12px] text-[#9CA3AF]">{sub}</p>
              </div>
              {form.role === val && <CheckCircle2 size={16} className="text-[#F04E23] absolute top-3 right-3" />}
            </button>
          ))}
        </div>
        {errors.role && <p className={errTxt}>{errors.role}</p>}
      </div>

      <div>
        <label className={label}>Full Name</label>
        <input type="text" value={form.fullName} onChange={(e) => upd("fullName", e.target.value)}
          placeholder="Your full name" className={inputCls(errors.fullName)} />
        {errors.fullName && <p className={errTxt}>{errors.fullName}</p>}
      </div>

      <div>
        <label className={label}>Email Address</label>
        <input type="email" value={form.email} onChange={(e) => upd("email", e.target.value)}
          placeholder="you@example.com" className={inputCls(errors.email)} />
        {errors.email && <p className={errTxt}>{errors.email}</p>}
      </div>

      <div>
        <label className={label}>Password</label>
        <div className="relative">
          <input type={showPwd ? "text" : "password"} value={form.password}
            onChange={(e) => upd("password", e.target.value)} placeholder="Min. 8 characters"
            className={inputCls(errors.password) + " pr-12"} />
          <button type="button" onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {form.password && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pwdStrength(form.password).score * 25}%`, background: pwdStrength(form.password).color }} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: pwdStrength(form.password).color }}>{pwdStrength(form.password).label}</span>
          </div>
        )}
        {errors.password && <p className={errTxt}>{errors.password}</p>}
      </div>

      <div>
        <label className={label}>Confirm Password</label>
        <div className="relative">
          <input type={showConfirm ? "text" : "password"} value={form.confirmPassword}
            onChange={(e) => upd("confirmPassword", e.target.value)} placeholder="Repeat your password"
            className={inputCls(errors.confirmPassword) + " pr-12"} />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.confirmPassword && <p className={errTxt}>{errors.confirmPassword}</p>}
      </div>
    </div>
  );

  //  Step 2 (Candidate): Role & Skills
  const renderStep2Candidate = () => (
    <div className="space-y-6">
      <div ref={roleDropRef} className="relative">
        <label className={label}>Desired Role <span className="text-[#F04E23]">*</span></label>
        <button type="button" onClick={() => setShowRoleDrop(!showRoleDrop)}
          className={`w-full h-[44px] px-4 rounded-lg border text-[15px] text-left flex items-center justify-between bg-white transition-all ${
            errors.desiredRole ? "border-[#DC2626]" : showRoleDrop ? "border-[#F04E23] ring-2 ring-orange-100" : "border-[#E5E7EB] hover:border-[#FCA68A]"
          }`}>
          <span className={form.desiredRole ? "text-[#111827]" : "text-[#9CA3AF]"}>
            {form.desiredRole || "Search or select your role..."}
          </span>
          <ChevronDown size={16} className={`text-[#9CA3AF] transition-transform ${showRoleDrop ? "rotate-180" : ""}`} />
        </button>
        {showRoleDrop && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg max-h-64 overflow-y-auto">
            <div className="p-2 border-b border-[#F3F4F6] sticky top-0 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input autoFocus type="text" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search roles..." className="w-full h-[36px] pl-8 pr-3 text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#F04E23]" />
              </div>
            </div>
            {filteredCategories.length === 0 ? (
              <p className="p-4 text-[13px] text-[#9CA3AF] text-center">No roles match</p>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.category}>
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{cat.category}</p>
                  {cat.roles.map((r) => (
                    <button key={r} type="button"
                      onClick={() => { upd("desiredRole", r); setShowRoleDrop(false); setRoleSearch(""); setSkillSearch(""); }}
                      className={`w-full text-left px-3 py-2 text-[14px] hover:bg-[#FFF4F1] hover:text-[#F04E23] transition-colors ${form.desiredRole === r ? "bg-[#FFF4F1] text-[#F04E23] font-medium" : "text-[#374151]"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
        {errors.desiredRole && <p className={errTxt}>{errors.desiredRole}</p>}
      </div>

      <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={label + " !mb-0"}>
          Skills <span className="text-[#F04E23]">*</span>
        </label>
        <span className="text-[12px] text-[#9CA3AF]">{form.skills.length}/15 selected</span>
      </div>

      {/* Selected chips */}
      {form.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          {form.skills.map((s) => (
            <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-[#F04E23] text-white text-[12px] rounded-full font-medium">
              {s}
              <button type="button" onClick={() => toggleSkill(s)} className="opacity-70 hover:opacity-100"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)}
          placeholder={roleSkillSections ? `Search ${form.desiredRole} skills...` : "Search all skills..."}
          className="w-full h-[38px] pl-8 pr-3 text-[13px] border border-[#E5E7EB] rounded-lg outline-none focus:border-[#F04E23] bg-white" />
      </div>

      {/* Role-specific sectioned view */}
      {roleSkillSections ? (
        <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
          {(skillSearch ? filteredSections : roleSkillSections).map((sec) => {
            const chips = skillSearch
              ? sec.skills
              : sec.skills.filter((s) => !form.skills.includes(s));
            if (chips.length === 0) return null;
            return (
              <div key={sec.label}>
                <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">{sec.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((s) => (
                    <button key={s} type="button" onClick={() => toggleSkill(s)}
                      disabled={form.skills.length >= 15}
                      className="px-2.5 py-1 text-[12px] border border-[#E5E7EB] rounded-full text-[#374151] hover:border-[#F04E23] hover:text-[#F04E23] hover:bg-[#FFF4F1] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {(skillSearch ? filteredSections : roleSkillSections).every(
            (sec) => sec.skills.filter((s) => !form.skills.includes(s)).length === 0
          ) && (
            <p className="text-[13px] text-[#9CA3AF] text-center py-4">All skills for this role are selected!</p>
          )}
        </div>
      ) : (
        /* Flat fallback for roles without a specific map */
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
          {availableSkills.slice(0, 40).map((s) => (
            <button key={s} type="button" onClick={() => toggleSkill(s)}
              disabled={form.skills.length >= 15}
              className="px-2.5 py-1 text-[12px] border border-[#E5E7EB] rounded-full text-[#374151] hover:border-[#F04E23] hover:text-[#F04E23] hover:bg-[#FFF4F1] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              + {s}
            </button>
          ))}
        </div>
      )}
      {!form.desiredRole && (
        <p className="mt-2 text-[12px] text-[#9CA3AF]">Select a role above to see relevant skills.</p>
      )}
      {errors.skills && <p className={errTxt}>{errors.skills}</p>}
      </div>
    </div>
  );

  //  Step 2 (Company): Company Info
  const renderStep2Company = () => (
    <div className="space-y-5">

      {/* Logo Upload */}
      <div>
        <label className={label}>Company Logo <span className="text-[12px] text-[#9CA3AF] font-normal">(optional)</span></label>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={(e) => handleLogo(e.target.files[0])} />
        <div className="flex items-center gap-4">
          <div
            onClick={() => logoRef.current?.click()}
            className={`w-[68px] h-[68px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer shrink-0 overflow-hidden transition-all ${
              form.logoPreview ? "border-[#E5E7EB]" : "border-[#E5E7EB] hover:border-[#F04E23] hover:bg-[#FFF4F1]"
            }`}
          >
            {form.logoPreview ? (
              <img src={form.logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <>
                <Building2 size={20} className="text-[#9CA3AF]" />
                <span className="text-[10px] text-[#9CA3AF] mt-0.5">Upload</span>
              </>
            )}
          </div>
          {form.logoPreview && (
            <button type="button" onClick={() => upd("logoPreview", null)}
              className="text-[12px] text-[#9CA3AF] hover:text-[#DC2626] transition-colors">
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Company Name */}
      <div>
        <label className={label}>Company Name <span className="text-[#F04E23]">*</span></label>
        <input type="text" value={form.companyName} onChange={(e) => upd("companyName", e.target.value)}
          placeholder="Your company name" className={inputCls(errors.companyName)} />
        {errors.companyName && <p className={errTxt}>{errors.companyName}</p>}
      </div>

      {/* Industry */}
      <div>
        <label className={label}>Industry <span className="text-[#F04E23]">*</span></label>
        <div className="relative">
          <select value={form.industry} onChange={(e) => upd("industry", e.target.value)}
            className={inputCls(errors.industry) + " appearance-none pr-10 cursor-pointer"}>
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
        </div>
        {errors.industry && <p className={errTxt}>{errors.industry}</p>}
      </div>

      {/* Company Size */}
      <div>
        <label className={label}>Company Size</label>
        <div className="relative">
          <select value={form.companySize} onChange={(e) => upd("companySize", e.target.value)}
            className={inputCls(false) + " appearance-none pr-10 cursor-pointer"}>
            <option value="">Select size</option>
            {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
        </div>
      </div>

      {/* Website */}
      <div>
        <label className={label}>Website</label>
        <input type="url" value={form.website} onChange={(e) => upd("website", e.target.value)}
          placeholder="https://yourcompany.com" className={inputCls(errors.website)} />
        {errors.website && <p className={errTxt}>{errors.website}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={label}>Company Description</label>
        <div className="relative">
          <textarea rows={4} value={form.description}
            onChange={(e) => upd("description", e.target.value.slice(0, 500))}
            placeholder="Tell candidates about your company, culture, and mission."
            className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] text-[15px] outline-none transition-all bg-white resize-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 pb-7"
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-[#9CA3AF] pointer-events-none">
            {form.description.length}/500
          </span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#FFF4F1] border border-[#FCA68A]">
        <p className="text-[13px] text-[#92400E] font-medium mb-1">What happens next?</p>
        <p className="text-[13px] text-[#B45309]">After registration, your account will be reviewed. You'll receive access to post jobs, review candidates, and use AI hiring tools once approved.</p>
      </div>
    </div>
  );

  //  Step 3: Professional Links & CV 
  const renderStep3 = () => (
    <div className="space-y-6">
      <p className="text-[13px] text-[#6B7280] -mt-1">All fields are required to complete your profile and move to the next step.</p>

      <div>
        <label className={label}><span className="flex items-center gap-2"><svg width="15" height="15" viewBox="0 0 24 24" fill="#0A66C2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn URL</span></label>
        <input type="url" value={form.linkedIn} onChange={(e) => upd("linkedIn", e.target.value)}
          placeholder="https://linkedin.com/in/your-profile" className={inputCls(errors.linkedIn)} />
        {errors.linkedIn && <p className={errTxt}>{errors.linkedIn}</p>}
      </div>

      <div>
        <label className={label}><span className="flex items-center gap-2"><svg width="15" height="15" viewBox="0 0 24 24" fill="#24292F"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>GitHub URL</span></label>
        <input type="url" value={form.github} onChange={(e) => upd("github", e.target.value)}
          placeholder="https://github.com/your-username" className={inputCls(errors.github)} />
        {errors.github && <p className={errTxt}>{errors.github}</p>}
      </div>

      <div>
        <label className={label}>CV / Resume <span className="text-[#F04E23]">*</span></label>
        {form.cvFileName ? (
          <div className="flex items-center gap-3 p-4 border-2 border-[#F04E23] bg-[#FFF4F1] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-[#F04E23] flex items-center justify-center shrink-0">
              <FileText size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#111827] truncate">{form.cvFileName}</p>
              <p className="text-[12px] text-[#6B7280]">{(form.cvSize / 1024).toFixed(0)} KB  PDF / Word</p>
            </div>
            <button type="button" onClick={() => setForm((f) => ({ ...f, cvFile: null, cvFileName: "", cvSize: 0 }))}
              className="p-1.5 rounded-lg hover:bg-red-100 text-[#9CA3AF] hover:text-[#DC2626] transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              isDragging ? "border-[#F04E23] bg-[#FFF4F1]" : errors.cv ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#E5E7EB] hover:border-[#FCA68A] hover:bg-[#FFFBF9]"
            }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isDragging ? "bg-[#F04E23] text-white" : "bg-[#F3F4F6] text-[#9CA3AF]"}`}>
              <Upload size={22} />
            </div>
            <p className="text-[14px] font-medium text-[#374151]">{isDragging ? "Drop it here!" : "Drag & drop or click to upload"}</p>
            <p className="text-[12px] text-[#9CA3AF]">PDF or Word  Max 5 MB</p>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        )}
        {errors.cv && <p className={errTxt}>{errors.cv}</p>}
      </div>
    </div>
  );

  //  Step 4: Review 
  const renderStep4 = () => (
    <div className="space-y-4">
      <p className="text-[13px] text-[#6B7280] -mt-1">Review your details before creating your account.</p>

      {[
        { title: "Account Details", editStep: 1, rows: [
          { k: "Name", v: form.fullName },
          { k: "Email", v: form.email },
          { k: "Password", v: "" },
        ]},
        { title: "Role & Skills", editStep: 2, rows: [
          { k: "Desired Role", v: form.desiredRole || <span className="text-[#9CA3AF]">Not set</span> },
          { k: "Skills", v: form.skills.length > 0
            ? <div className="flex flex-wrap gap-1">{form.skills.map((s) => <span key={s} className="px-2 py-0.5 bg-[#FFF4F1] text-[#F04E23] text-[11px] rounded-full border border-[#FCA68A]">{s}</span>)}</div>
            : <span className="text-[#9CA3AF]">None selected</span>
          },
        ]},
        { title: "Links & CV", editStep: 3, rows: [
          { k: "LinkedIn", v: form.linkedIn || <span className="text-[#9CA3AF]">Not provided</span> },
          { k: "GitHub", v: form.github || <span className="text-[#9CA3AF]">Not provided</span> },
          { k: "CV", v: form.cvFileName || <span className="text-[#9CA3AF]">No file uploaded</span> },
        ]},
      ].map(({ title, editStep, rows }) => (
        <div key={title} className="border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
            <p className="text-[13px] font-semibold text-[#111827]">{title}</p>
            <button type="button" onClick={() => { setStep(editStep); setErrors({}); }}
              className="flex items-center gap-1 text-[12px] text-[#F04E23] hover:underline font-medium">
              <Edit2 size={11} /> Edit
            </button>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {rows.map(({ k, v }) => (
              <div key={k} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-[12px] text-[#6B7280] w-24 shrink-0 pt-0.5">{k}</span>
                <span className="text-[13px] text-[#111827] flex-1 break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {errors.submit && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="flex-1 text-[13px] text-[#DC2626]">{errors.submit}</p>
          <button type="button" onClick={() => setErrors((e) => ({ ...e, submit: "" }))} className="text-red-400 hover:text-red-600"><X size={15} /></button>
        </div>
      )}
    </div>
  );

  //  Current step content 
  const stepContent = () => {
    if (step === 1) return renderStep1();
    if (step === 2 && form.role === "individual") return renderStep2Candidate();
    if (step === 2 && form.role === "company") return renderStep2Company();
    if (step === 3) return renderStep3();
    if (step === 4) return renderStep4();
    return null;
  };

  const stepTitles = {
    "individual-1": { h: "Create your account", sub: "Choose your role and set up credentials" },
    "individual-2": { h: "Your role & skills", sub: "Help recruiters find the right match for you" },
    "individual-3": { h: "Professional links", sub: "Connect your profiles and upload your CV" },
    "individual-4": { h: "Review & confirm", sub: "Everything look good? Let's get you started" },
    "company-1": { h: "Create your account", sub: "Set up your company recruiter account" },
    "company-2": { h: "Company details", sub: "Complete your company profile to get started" },
  };
  const titleKey = `${form.role === "company" ? "company" : "individual"}-${step}`;
  const { h: heading, sub: subheading } = stepTitles[titleKey] || { h: "Register", sub: "" };

  const isFinalStep = step === steps.length;

  // 
  // RENDER
  // 
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <IntelliHireLogo />
          <span className="text-[22px] font-extrabold tracking-tight text-[#111827]">IntelliHire</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8">

          {/* Step Indicator */}
          <StepIndicator steps={steps} currentStep={step} />

          {/* Step heading */}
          <div className="mb-6">
            <h1 className="text-[24px] font-bold text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
              {heading}
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">{subheading}</p>
          </div>

          {/* Step body */}
          <form onSubmit={(e) => e.preventDefault()}>
            {stepContent()}

            {/* Navigation buttons */}
            <div className={`flex gap-3 mt-8 ${step > 1 ? "justify-between" : "justify-end"}`}>
              {step > 1 && (
                <button type="button" onClick={back}
                  className="flex items-center gap-2 px-5 h-[44px] rounded-xl border border-[#E5E7EB] text-[14px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition-all">
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {isFinalStep ? (
                <button type="button" onClick={handleSubmit} disabled={isLoading}
                  className="flex items-center gap-2 px-6 h-[44px] bg-[#F04E23] hover:bg-[#D43D14] disabled:opacity-60 text-white text-[14px] font-semibold rounded-xl transition-all">
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={16} /> Create Account</>}
                </button>
              ) : (
                <button type="button" onClick={next}
                  className="flex items-center gap-2 px-6 h-[44px] bg-[#F04E23] hover:bg-[#D43D14] text-white text-[14px] font-semibold rounded-xl transition-all">
                  Continue <ArrowLeft size={16} className="rotate-180" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Login link */}
        <p className="mt-5 text-center text-[14px] text-[#6B7280]">
          Already have an account?{" "}
          <Link to="/login" className="text-[#F04E23] font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
  
