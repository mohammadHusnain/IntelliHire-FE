import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Check, User, Building2 } from "lucide-react";

const IntelliHireLogo = () => (
  <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
    <rect width="40" height="40" rx="10" fill="#F04E23" fillOpacity="0.1" />
    <path d="M12 12h4v16h-4zM18 16h4v12h-4zM24 8h4v20h-4z" fill="#F04E23" />
    <circle cx="30" cy="30" r="4" fill="#F04E23" />
  </svg>
);

function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Role selection
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Form states - Individual
  const [fullName, setFullName] = useState("");
  const [individualEmail, setIndividualEmail] = useState("");
  const [individualPassword, setIndividualPassword] = useState("");
  const [individualConfirmPassword, setIndividualConfirmPassword] = useState("");
  
  // Form states - Company
  const [companyName, setCompanyName] = useState("");
  const [companyFullName, setCompanyFullName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyPassword, setCompanyPassword] = useState("");
  const [companyConfirmPassword, setCompanyConfirmPassword] = useState("");
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Error states
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  const industries = [
    "Technology",
    "Finance",
    "Healthcare",
    "Education",
    "Retail",
    "Manufacturing",
    "Media",
    "Other"
  ];

  // Pre-select role from URL param
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "individual" || roleParam === "company") {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
  };

  const handlePasswordChange = (value, isCompany) => {
    if (isCompany) {
      setCompanyPassword(value);
    } else {
      setIndividualPassword(value);
    }
    setPasswordStrength(calculatePasswordStrength(value));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (selectedRole === "individual") {
      if (!fullName.trim()) newErrors.fullName = "Full name is required";
      if (!individualEmail.trim()) {
        newErrors.individualEmail = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(individualEmail)) {
        newErrors.individualEmail = "Please enter a valid email address";
      }
      if (!individualPassword) {
        newErrors.individualPassword = "Password is required";
      } else if (individualPassword.length < 8) {
        newErrors.individualPassword = "Password must be at least 8 characters";
      }
      if (individualPassword !== individualConfirmPassword) {
        newErrors.individualConfirmPassword = "Passwords do not match";
      }
    } else {
      if (!companyName.trim() || companyName.length < 2) {
        newErrors.companyName = "Company name must be at least 2 characters";
      }
      if (!companyFullName.trim()) newErrors.companyFullName = "Your full name is required";
      if (!companyEmail.trim()) {
        newErrors.companyEmail = "Work email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
        newErrors.companyEmail = "Please enter a valid email address";
      }
      if (!industry) newErrors.industry = "Please select an industry";
      if (!companyPassword) {
        newErrors.companyPassword = "Password is required";
      } else if (companyPassword.length < 8) {
        newErrors.companyPassword = "Password must be at least 8 characters";
      }
      if (companyPassword !== companyConfirmPassword) {
        newErrors.companyConfirmPassword = "Passwords do not match";
      }
    }
    
    if (!termsAccepted) {
      newErrors.terms = "Please accept the terms to continue";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (error) {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    if (!selectedRole || !termsAccepted) return false;
    
    if (selectedRole === "individual") {
      return fullName && individualEmail && individualPassword && 
             individualConfirmPassword && individualPassword === individualConfirmPassword;
    } else {
      return companyName && companyFullName && companyEmail && industry && 
             companyPassword && companyConfirmPassword && companyPassword === companyConfirmPassword;
    }
  };

  const getPasswordStrengthLabel = () => {
    const labels = ["Weak", "Fair", "Good", "Strong"];
    const colors = ["bg-red-500", "bg-yellow-500", "bg-orange-500", "bg-green-500"];
    return { label: labels[passwordStrength - 1] || "", color: colors[passwordStrength - 1] || "" };
  };

  const strength = getPasswordStrengthLabel();

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8 ">
        <div className="w-full max-w-[480px] bg-white rounded-xl p-[48px_40px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <IntelliHireLogo />
            <span className="text-[24px] font-extrabold tracking-tight text-[#111827]">IntelliHire</span>
          </div>
          {/* Animated Checkmark */}
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-[scale-in_0.3s_ease-out]">
            <Check size={32} className="text-green-600" />
          </div>
          
          <h2 className="text-[28px] font-semibold text-[#111827] mb-3">Account Created!</h2>
          
          <p className="text-[15px] text-[#6B7280] mb-6">
            {selectedRole === "individual" 
              ? "Check your email inbox to verify your account, then log in."
              : "Your account is under review. We'll email you once approved (typically within 24 hours)."
            }
          </p>
          
          <button
            onClick={() => navigate("/login")}
            className="w-full h-[44px] border border-[#F04E23] text-[#F04E23] hover:bg-[#FFF4F1] text-[15px] rounded-lg transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8 ">
      <div className="w-full max-w-[480px] bg-white rounded-xl p-[48px_40px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <IntelliHireLogo />
          <span className="text-[24px] font-extrabold tracking-tight text-[#111827]">IntelliHire</span>
        </div>

        {/* Heading */}
        <h2 className="mt-6 text-[30px] text-[#111827] text-center">Create your account</h2>
        <p className="mt-2 text-[14px] text-[#6B7280] text-center">
          Join thousands of candidates and hiring teams.
        </p>

        {/* Role Selector */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {/* Job Seeker Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedRole("individual");
              setErrors({});
            }}
            className={`relative h-[100px] rounded-xl border-[1.5px] p-4 transition-all hover:scale-[1.01] ${
              selectedRole === "individual"
                ? "border-[#F04E23] bg-[#FFF4F1]"
                : "border-[#DDDDDD] bg-white hover:border-[#AAAAAA]"
            }`}
          >
            {selectedRole === "individual" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F04E23] flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
            <div className="flex flex-col items-center text-center">
              <User size={28} className={selectedRole === "individual" ? "text-[#F04E23]" : "text-[#6B7280]"} />
              <p className={`mt-2 text-[15px] font-medium ${selectedRole === "individual" ? "text-[#111827]" : "text-[#374151]"}`}>
                I'm a Job Seeker
              </p>
              <p className="text-[12px] text-[#6B7280]">Practice & track interviews</p>
            </div>
          </button>

          {/* Company Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedRole("company");
              setErrors({});
            }}
            className={`relative h-[100px] rounded-xl border-[1.5px] p-4 transition-all hover:scale-[1.01] ${
              selectedRole === "company"
                ? "border-[#F04E23] bg-[#FFF4F1]"
                : "border-[#DDDDDD] bg-white hover:border-[#AAAAAA]"
            }`}
          >
            {selectedRole === "company" && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F04E23] flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
            <div className="flex flex-col items-center text-center">
              <Building2 size={28} className={selectedRole === "company" ? "text-[#F04E23]" : "text-[#6B7280]"} />
              <p className={`mt-2 text-[15px] font-medium ${selectedRole === "company" ? "text-[#111827]" : "text-[#374151]"}`}>
                I'm Hiring
              </p>
              <p className="text-[12px] text-[#6B7280]">Post jobs & find talent</p>
            </div>
          </button>
        </div>

        {/* Dynamic Form */}
        {selectedRole && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5 animate-[fade-in_0.3s_ease-out]">
            {selectedRole === "individual" ? (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
                      errors.fullName
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  />
                  {errors.fullName && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.fullName}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Email Address</label>
                  <input
                    type="email"
                    value={individualEmail}
                    onChange={(e) => setIndividualEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
                      errors.individualEmail
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  />
                  {errors.individualEmail && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.individualEmail}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={individualPassword}
                      onChange={(e) => handlePasswordChange(e.target.value, false)}
                      placeholder="Create a password"
                      className={`w-full h-[44px] px-4 pr-12 rounded-lg border text-[15px] outline-none transition-all ${
                        errors.individualPassword
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                          : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {individualPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1 rounded-full ${
                              i <= passwordStrength ? strength.color : "bg-[#E5E7EB]"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-[12px] text-[#6B7280]">{strength.label}</p>
                    </div>
                  )}
                  {errors.individualPassword && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.individualPassword}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={individualConfirmPassword}
                      onChange={(e) => setIndividualConfirmPassword(e.target.value)}
                      onBlur={() => {
                        if (individualConfirmPassword && individualConfirmPassword !== individualPassword) {
                          setErrors({ ...errors, individualConfirmPassword: "Passwords do not match" });
                        } else {
                          setErrors({ ...errors, individualConfirmPassword: null });
                        }
                      }}
                      placeholder="Confirm your password"
                      className={`w-full h-[44px] px-4 pr-12 rounded-lg border text-[15px] outline-none transition-all ${
                        errors.individualConfirmPassword
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                          : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.individualConfirmPassword && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.individualConfirmPassword}</p>}
                </div>
              </>
            ) : (
              <>
                {/* Company Name */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
                      errors.companyName
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  />
                  {errors.companyName && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.companyName}</p>}
                </div>

                {/* Your Full Name */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Your Full Name</label>
                  <input
                    type="text"
                    value={companyFullName}
                    onChange={(e) => setCompanyFullName(e.target.value)}
                    placeholder="John Smith"
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
                      errors.companyFullName
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  />
                  {errors.companyFullName && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.companyFullName}</p>}
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Work Email</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="john@acmecorp.com"
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all ${
                      errors.companyEmail
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  />
                  {errors.companyEmail && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.companyEmail}</p>}
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className={`w-full h-[44px] px-4 rounded-lg border text-[15px] outline-none transition-all bg-white ${
                      errors.industry
                        ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                        : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    }`}
                  >
                    <option value="">Select an industry</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                  {errors.industry && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.industry}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={companyPassword}
                      onChange={(e) => handlePasswordChange(e.target.value, true)}
                      placeholder="Create a password"
                      className={`w-full h-[44px] px-4 pr-12 rounded-lg border text-[15px] outline-none transition-all ${
                        errors.companyPassword
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                          : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {companyPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1 rounded-full ${
                              i <= passwordStrength ? strength.color : "bg-[#E5E7EB]"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-[12px] text-[#6B7280]">{strength.label}</p>
                    </div>
                  )}
                  {errors.companyPassword && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.companyPassword}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-[14px] text-[#374151] mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={companyConfirmPassword}
                      onChange={(e) => setCompanyConfirmPassword(e.target.value)}
                      onBlur={() => {
                        if (companyConfirmPassword && companyConfirmPassword !== companyPassword) {
                          setErrors({ ...errors, companyConfirmPassword: "Passwords do not match" });
                        } else {
                          setErrors({ ...errors, companyConfirmPassword: null });
                        }
                      }}
                      placeholder="Confirm your password"
                      className={`w-full h-[44px] px-4 pr-12 rounded-lg border text-[15px] outline-none transition-all ${
                        errors.companyConfirmPassword
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                          : "border-[#DDDDDD] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#374151]"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.companyConfirmPassword && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.companyConfirmPassword}</p>}
                </div>
              </>
            )}

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[#DDDDDD] text-[#F04E23] focus:ring-[#F04E23]"
                />
                <span className="text-[12px] text-[#6B7280]">
                  By creating an account, you agree to our{" "}
                  <a href="#" className="text-[#F04E23] hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-[#F04E23] hover:underline">Privacy Policy</a>.
                </span>
              </label>
              {errors.terms && <p className="mt-1 text-[13px] text-[#DC2626]">{errors.terms}</p>}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-[13px] text-[#DC2626]">{errors.submit}</p>
              </div>
            )}

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={!isFormValid() || isLoading}
              className="w-full h-[44px] bg-[#F04E23] hover:bg-[#D43D14] disabled:opacity-60 disabled:cursor-not-allowed text-white text-[15px] rounded-lg transition-all flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        )}

        {/* Login Link */}
        <p className="mt-8 text-center text-[14px] text-[#6B7280]">
          Already have an account?{" "}
          <a href="/login" className="text-[#F04E23] hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
