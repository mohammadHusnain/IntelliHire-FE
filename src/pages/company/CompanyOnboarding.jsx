import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const BuildingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#D1D5DB" strokeWidth="1.8" />
    <path d="M8 21V11h8v10" stroke="#D1D5DB" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="9.5" y="13.5" width="2" height="2" rx="0.5" fill="#D1D5DB" />
    <rect x="12.5" y="13.5" width="2" height="2" rx="0.5" fill="#D1D5DB" />
    <rect x="9.5" y="16.5" width="2" height="2" rx="0.5" fill="#D1D5DB" />
    <rect x="12.5" y="16.5" width="2" height="2" rx="0.5" fill="#D1D5DB" />
    <path d="M10 3v3M14 3v3" stroke="#D1D5DB" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const SelectArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const industries = [
  "Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing",
  "Media & Entertainment", "Consulting", "Logistics", "Legal", "Government", "Other",
];

const companySizes = [
  "1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees",
];

function CompanyOnboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoHover, setLogoHover] = useState(false);

  const [form, setForm] = useState({
    companyName: "Acme Corp",
    industry: "Technology",
    companySize: "",
    website: "",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const descLength = form.description.length;

  const handleLogoClick = () => fileInputRef.current?.click();

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (e) => {
    e.stopPropagation();
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleChange = (field, value) => {
    if (field === "description" && value.length > 500) return;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateWebsite = () => {
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) {
      setErrors((prev) => ({ ...prev, website: "Please enter a valid URL (include https://)" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.companyName.trim()) newErrors.companyName = "Company name is required";
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website))
      newErrors.website = "Please enter a valid URL (include https://)";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      navigate("/company/dashboard");
    }, 1600);
  };

  const handleSkip = () => navigate("/company/dashboard");

  const descCountColor =
    descLength >= 500 ? "#DC2626" : descLength >= 400 ? "#F04E23" : "#9CA3AF";

  const inputBase = {
    height: "40px",
    width: "100%",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    padding: "0 12px",
    fontSize: "14px",
    color: "#0D0D0D",
    background: "white",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 150ms, box-shadow 150ms",
    boxSizing: "border-box",
  };

  const selectBase = {
    ...inputBase,
    appearance: "none",
    WebkitAppearance: "none",
    paddingRight: "36px",
    cursor: "pointer",
  };

  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-4 py-12"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .onboarding-card { animation: fadeSlideIn 350ms ease forwards; }
        .field-input:focus {
          border-color: #F04E23 !important;
          box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important;
        }
        .field-input.error { border-color: #DC2626 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.8s linear infinite; }
        select option:checked { background: #FFF4F1; color: #F04E23; }
      `}</style>

      <div className="w-full max-w-[560px] onboarding-card">
        {/* Progress Indicator */}
        <div className="mb-5">
          <p
            className="text-center mb-2"
            style={{ fontSize: "12px", color: "#9CA3AF" }}
          >
            Step 1 of 1 — Complete Your Company Profile
          </p>
          <div
            style={{
              height: "3px",
              background: "#E5E7EB",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                background: "#F04E23",
                borderRadius: "999px",
              }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "48px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Section Tag */}
          <p
            className="text-center mb-2"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#F04E23",
              textTransform: "uppercase",
            }}
          >
            ● COMPANY SETUP
          </p>

          {/* Heading */}
          <h1
            className="text-center"
            style={{
              fontFamily: "Times New Roman, serif",
              fontSize: "30px",
              color: "#0D0D0D",
              lineHeight: 1.2,
              marginTop: "8px",
              marginBottom: "8px",
            }}
          >
            Set Up Your{" "}
            <em style={{ color: "#F04E23", fontStyle: "italic" }}>Company</em>
          </h1>

          {/* Subtext */}
          <p
            className="text-center"
            style={{
              fontSize: "14px",
              color: "#374151",
              marginTop: "4px",
              marginBottom: "20px",
            }}
          >
            Help candidates and your team understand who you are.
          </p>

          {/* Logo Upload */}
          <div className="flex flex-col items-center" style={{ marginBottom: "24px" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: "none" }}
              onChange={handleLogoChange}
            />
            <div
              onClick={handleLogoClick}
              onMouseEnter={() => setLogoHover(true)}
              onMouseLeave={() => setLogoHover(false)}
              style={{
                width: "100px",
                height: "100px",
                border: logoPreview
                  ? "2px solid #E5E7EB"
                  : `2px dashed ${logoHover ? "#F04E23" : "#E5E7EB"}`,
                borderRadius: "10px",
                background: logoHover && !logoPreview ? "#FFF4F1" : "#FAFAFA",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "border-color 150ms, background 150ms",
                overflow: "hidden",
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company logo"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <>
                  <BuildingIcon />
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9CA3AF",
                      marginTop: "6px",
                    }}
                  >
                    Upload Logo
                  </span>
                </>
              )}
            </div>
            {logoPreview && (
              <button
                onClick={handleRemoveLogo}
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#9CA3AF",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              >
                Remove
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Company Name */}
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Company Name
                </label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  className={`field-input ${errors.companyName ? "error" : ""}`}
                  style={{
                    ...inputBase,
                    borderColor: errors.companyName ? "#DC2626" : "#E5E7EB",
                  }}
                />
                {errors.companyName && (
                  <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>
                    {errors.companyName}
                  </p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Industry
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.industry}
                    onChange={(e) => handleChange("industry", e.target.value)}
                    className="field-input"
                    style={selectBase}
                  >
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <SelectArrow />
                  </span>
                </div>
              </div>

              {/* Company Size */}
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Company Size
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={form.companySize}
                    onChange={(e) => handleChange("companySize", e.target.value)}
                    className="field-input"
                    style={selectBase}
                  >
                    <option value="">Select size…</option>
                    {companySizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <SelectArrow />
                  </span>
                </div>
              </div>

              {/* Website */}
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  onBlur={validateWebsite}
                  placeholder="https://yourcompany.com"
                  className={`field-input ${errors.website ? "error" : ""}`}
                  style={{
                    ...inputBase,
                    borderColor: errors.website ? "#DC2626" : "#E5E7EB",
                  }}
                />
                {errors.website && (
                  <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>
                    {errors.website}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#374151",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Description
                </label>
                <div style={{ position: "relative" }}>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Tell candidates about your company, culture, and mission."
                    maxLength={500}
                    className="field-input"
                    style={{
                      ...inputBase,
                      height: "auto",
                      padding: "10px 12px",
                      resize: "vertical",
                      lineHeight: 1.6,
                      paddingBottom: "24px",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      right: "10px",
                      fontSize: "12px",
                      color: descCountColor,
                      pointerEvents: "none",
                    }}
                  >
                    {descLength} / 500
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Setup Button */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                height: "44px",
                background: saving ? "#FCA68A" : "#F04E23",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
                transition: "background 150ms",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "28px",
                fontFamily: "Inter, sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = "#D43D14";
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = "#F04E23";
              }}
            >
              {saving ? (
                <>
                  <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5" strokeDasharray="30 28" />
                  </svg>
                  Saving…
                </>
              ) : (
                "Complete Setup →"
              )}
            </button>

            {/* Skip note + link */}
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#92400E",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
              >
                You can complete this later from your settings.
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{
                    fontSize: "13px",
                    color: "#9CA3AF",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "color 150ms",
                    fontFamily: "Inter, sans-serif",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
                >
                  Skip for now →
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CompanyOnboarding;
