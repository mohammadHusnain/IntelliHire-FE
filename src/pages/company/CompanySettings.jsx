import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, Briefcase, Users, BarChart2, Globe, UserCheck, Settings, LogOut,
  Building2, Bell, Shield, Palette, X, Eye, EyeOff, ChevronDown, ChevronRight,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

// ─── Reusable Components ────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 transition-all"
    style={{ height: "38px", borderRadius: "6px", margin: "1px 8px", width: "calc(100% - 16px)", fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "none", borderLeft: active ? "2px solid #F04E23" : "2px solid transparent", background: active ? "#FFF4F1" : "transparent", color: active ? "#F04E23" : "#9CA3AF", transition: "all 150ms ease" }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}>
    <Icon size={17} /><span>{label}</span>
  </button>
);
const SelectArrow = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Toast = ({ message, type = "success", onClose }) => {
  const colors = { success: "#059669", error: "#DC2626", warning: "#D97706", info: "#F04E23" };
  return (<div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px 18px", width: "360px", borderLeft: `4px solid ${colors[type] || colors.success}`, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "toastIn 200ms ease", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <span>{message}</span>
    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "2px" }}><X size={14} /></button>
  </div>);
};
const ToggleSwitch = ({ checked, onChange }) => (
  <button onClick={onChange} style={{ width: "36px", height: "20px", borderRadius: "999px", background: checked ? "#F04E23" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 150ms", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
  </button>
);

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "community", label: "Community", icon: Globe },
  { id: "team", label: "Team", icon: UserCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

const settingsTabs = [
  { id: "company", label: "Company Profile", icon: Building2 },
  { id: "hiring", label: "Hiring Preferences", icon: Briefcase },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "security", label: "Security", icon: Shield },
];

const industrys = ["Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Consulting", "Media", "Real Estate", "Non-profit"];
const companySizes = ["1–10", "11–50", "51–200", "201–500", "501–1000", "1001–5000", "5000+"];

function CompanySettings() {
  const navigate = useNavigate();
  const logout = useLogout();
  const [activeNav, setActiveNav] = useState("settings");
  const [activeTab, setActiveTab] = useState("company");
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");

  // ── Company Profile ──
  const [companyName, setCompanyName] = useState("Acme Corp");
  const [industry, setIndustry] = useState("Technology");
  const [companySize, setCompanySize] = useState("51–200");
  const [website, setWebsite] = useState("https://acmecorp.com");
  const [headquarters, setHeadquarters] = useState("London, UK");
  const [aboutCompany, setAboutCompany] = useState("Acme Corp is a leading technology company building innovative SaaS solutions for enterprise clients. Founded in 2018, we focus on AI-powered hiring tools that help companies find the best talent efficiently.");
  const [linkedin, setLinkedin] = useState("https://linkedin.com/company/acmecorp");
  const [twitter, setTwitter] = useState("https://twitter.com/acmecorp");

  // ── Hiring Preferences ──
  const [defaultStages, setDefaultStages] = useState(["Applied", "Screened", "Technical Interview", "Final Interview", "Offer"]);
  const [stageInput, setStageInput] = useState("");
  const [autoShortlist, setAutoShortlist] = useState(true);
  const [shortlistThreshold, setShortlistThreshold] = useState("75");
  const [defaultRecruiter, setDefaultRecruiter] = useState("Auto-assign");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [interviewFormat, setInterviewFormat] = useState("Video Call");

  // ── Notifications ──
  const [emailNewApp, setEmailNewApp] = useState(true);
  const [emailStageChange, setEmailStageChange] = useState(true);
  const [emailWeeklyReport, setEmailWeeklyReport] = useState(true);
  const [emailInterviewReminder, setEmailInterviewReminder] = useState(true);
  const [emailCommunityActivity, setEmailCommunityActivity] = useState(false);
  const [emailJobExpiry, setEmailJobExpiry] = useState(true);

  // ── Branding ──
  const [careerPageVisible, setCareerPageVisible] = useState(true);
  const [showCompanyLogo, setShowCompanyLogo] = useState(true);
  const [showTeamSize, setShowTeamSize] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [brandColor, setBrandColor] = useState("#F04E23");

  // ── Security ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [twoFa, setTwoFa] = useState(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/company/dashboard");
    if (navId === "jobs") navigate("/company/jobs");
    if (navId === "candidates") navigate("/company/candidates");
    if (navId === "team") navigate("/company/team");
    if (navId === "analytics") navigate("/company/analytics");
    if (navId === "community") navigate("/company/community");
    if (navId === "settings") navigate("/company/settings");
  };

  const handleSaveCompany = () => showToast("Company profile saved successfully");
  const handleSaveHiring = () => showToast("Hiring preferences saved");
  const handleSaveNotifications = () => showToast("Notification settings saved");
  const handleSaveBranding = () => showToast("Branding preferences saved");
  const handleChangePassword = () => {
    if (!currentPw || !newPw) { showToast("Please fill in all password fields", "error"); return; }
    if (newPw !== confirmPw) { showToast("New passwords do not match", "error"); return; }
    if (newPw.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    showToast("Password changed successfully");
  };
  const handleSaveSecurity = () => showToast("Security settings saved");

  const handleAddStage = () => {
    if (stageInput.trim() && !defaultStages.includes(stageInput.trim())) {
      setDefaultStages((p) => [...p, stageInput.trim()]);
      setStageInput("");
    }
  };

  const inputStyle = { width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 150ms, box-shadow 150ms" };
  const labelStyle = { fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px", fontFamily: "Inter, sans-serif" };
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" };
  const cardStyle = { background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "28px", marginBottom: "24px" };
  const sectionTitle = (text) => <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 6px" }}>{text}</h3>;
  const sectionDesc = (text) => <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 20px" }}>{text}</p>;

  const renderTab = () => {
    switch (activeTab) {
      case "company": return (
        <>
          <div style={cardStyle}>
            {sectionTitle("Company Information")}
            {sectionDesc("Manage your organization's public-facing details.")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="field-input" style={inputStyle} />
              </div>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Industry</label>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="field-input" style={selectStyle}>
                  {industrys.map((i) => <option key={i}>{i}</option>)}
                </select>
                <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Company Size</label>
                <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="field-input" style={selectStyle}>
                  {companySizes.map((s) => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
              <div>
                <label style={labelStyle}>Website</label>
                <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="field-input" style={inputStyle} placeholder="https://yourcompany.com" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Headquarters</label>
                <input type="text" value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} className="field-input" style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>About Company</label>
                <textarea value={aboutCompany} onChange={(e) => setAboutCompany(e.target.value)} className="field-input" style={{ ...inputStyle, height: "100px", padding: "10px 14px", resize: "vertical" }} />
              </div>
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Social Links")}
            {sectionDesc("Connect your company's social profiles.")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>LinkedIn</label>
                <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="field-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Twitter / X</label>
                <input type="url" value={twitter} onChange={(e) => setTwitter(e.target.value)} className="field-input" style={inputStyle} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveCompany} style={{ height: "42px", padding: "0 28px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Company Profile</button>
          </div>
        </>
      );
      case "hiring": return (
        <>
          <div style={cardStyle}>
            {sectionTitle("Default Hiring Pipeline")}
            {sectionDesc("Configure the default stages for new job postings.")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {defaultStages.map((s, i) => (
                <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F3F4F6", borderRadius: "999px", padding: "6px 12px", fontSize: "13px", color: "#374151" }}>
                  <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}.</span> {s}
                  {s !== "Applied" && s !== "Offer" && (
                    <button onClick={() => setDefaultStages((p) => p.filter((x) => x !== s))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: 0 }}><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={stageInput} onChange={(e) => setStageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStage(); } }} placeholder="Add custom stage…" className="field-input" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleAddStage} style={{ height: "40px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Add</button>
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Automation Rules")}
            {sectionDesc("Set up automatic candidate processing rules.")}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>Auto-Shortlist Candidates</p>
                  <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "2px 0 0" }}>Automatically shortlist candidates above a score threshold</p>
                </div>
                <ToggleSwitch checked={autoShortlist} onChange={() => setAutoShortlist(!autoShortlist)} />
              </div>
              {autoShortlist && (
                <div style={{ paddingLeft: "16px", borderLeft: "2px solid #FFF4F1" }}>
                  <label style={labelStyle}>Minimum Score Threshold (%)</label>
                  <input type="number" min="50" max="100" value={shortlistThreshold} onChange={(e) => setShortlistThreshold(e.target.value)} className="field-input" style={{ ...inputStyle, width: "120px" }} />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>Approval Required for Publishing</p>
                  <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "2px 0 0" }}>Require manager approval before a job goes live</p>
                </div>
                <ToggleSwitch checked={approvalRequired} onChange={() => setApprovalRequired(!approvalRequired)} />
              </div>
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Interview Settings")}
            {sectionDesc("Default interview configuration for new roles.")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Default Interview Format</label>
                <select value={interviewFormat} onChange={(e) => setInterviewFormat(e.target.value)} className="field-input" style={selectStyle}>
                  {["Video Call", "In-Person", "Phone Screen", "Take-Home Assessment"].map((f) => <option key={f}>{f}</option>)}
                </select>
                <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Default Recruiter Assignment</label>
                <select value={defaultRecruiter} onChange={(e) => setDefaultRecruiter(e.target.value)} className="field-input" style={selectStyle}>
                  {["Auto-assign", "John Smith", "Sarah Johnson", "Emily Davis", "Michael Chen"].map((r) => <option key={r}>{r}</option>)}
                </select>
                <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveHiring} style={{ height: "42px", padding: "0 28px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Hiring Preferences</button>
          </div>
        </>
      );
      case "notifications": return (
        <>
          <div style={cardStyle}>
            {sectionTitle("Email Notifications")}
            {sectionDesc("Control which email notifications you receive.")}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "New Application Received", desc: "Get notified when a candidate applies to a job", checked: emailNewApp, toggle: () => setEmailNewApp(!emailNewApp) },
                { label: "Stage Changes", desc: "Notify when a candidate moves to a new pipeline stage", checked: emailStageChange, toggle: () => setEmailStageChange(!emailStageChange) },
                { label: "Interview Reminders", desc: "Receive reminders 24h and 1h before scheduled interviews", checked: emailInterviewReminder, toggle: () => setEmailInterviewReminder(!emailInterviewReminder) },
                { label: "Weekly Hiring Report", desc: "Summary of hiring activity sent every Monday", checked: emailWeeklyReport, toggle: () => setEmailWeeklyReport(!emailWeeklyReport) },
                { label: "Job Posting Expiry Alerts", desc: "Notify 3 days before a job posting deadline", checked: emailJobExpiry, toggle: () => setEmailJobExpiry(!emailJobExpiry) },
                { label: "Community Activity", desc: "Updates about community engagement and new joins", checked: emailCommunityActivity, toggle: () => setEmailCommunityActivity(!emailCommunityActivity) },
              ].map((n) => (
                <div key={n.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{n.label}</p>
                    <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "2px 0 0" }}>{n.desc}</p>
                  </div>
                  <ToggleSwitch checked={n.checked} onChange={n.toggle} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveNotifications} style={{ height: "42px", padding: "0 28px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Notification Settings</button>
          </div>
        </>
      );
      case "branding": return (
        <>
          <div style={cardStyle}>
            {sectionTitle("Career Page Visibility")}
            {sectionDesc("Control how your company appears to candidates.")}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "Public Career Page", desc: "Allow candidates to view your career page and open positions", checked: careerPageVisible, toggle: () => setCareerPageVisible(!careerPageVisible) },
                { label: "Show Company Logo", desc: "Display your logo on job listings and career page", checked: showCompanyLogo, toggle: () => setShowCompanyLogo(!showCompanyLogo) },
                { label: "Show Team Size", desc: "Display company size on your public profile", checked: showTeamSize, toggle: () => setShowTeamSize(!showTeamSize) },
                { label: "Public Company Profile", desc: "Allow your company profile to appear in search results", checked: publicProfile, toggle: () => setPublicProfile(!publicProfile) },
              ].map((b) => (
                <div key={b.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{b.label}</p>
                    <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "2px 0 0" }}>{b.desc}</p>
                  </div>
                  <ToggleSwitch checked={b.checked} onChange={b.toggle} />
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Brand Color")}
            {sectionDesc("Your primary brand color used across career page and emails.")}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} style={{ width: "48px", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "4px", cursor: "pointer" }} />
              <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="field-input" style={{ ...inputStyle, width: "140px" }} />
              <div style={{ width: "120px", height: "40px", borderRadius: "8px", background: brandColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "12px", color: "white", fontWeight: 500, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>Preview</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveBranding} style={{ height: "42px", padding: "0 28px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Branding Settings</button>
          </div>
        </>
      );
      case "security": return (
        <>
          <div style={cardStyle}>
            {sectionTitle("Change Password")}
            {sectionDesc("Update your account password. Use at least 8 characters.")}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
              <div>
                <label style={labelStyle}>Current Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="field-input" style={inputStyle} />
                  <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex" }}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="field-input" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="field-input" style={inputStyle} />
              </div>
              <button onClick={handleChangePassword} style={{ height: "40px", padding: "0 24px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", alignSelf: "flex-start", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Update Password</button>
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Two-Factor Authentication")}
            {sectionDesc("Add an extra layer of security to your account.")}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>Enable 2FA</p>
                <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "2px 0 0" }}>Require a verification code when signing in</p>
              </div>
              <ToggleSwitch checked={twoFa} onChange={() => { setTwoFa(!twoFa); showToast(twoFa ? "2FA disabled" : "2FA enabled"); }} />
            </div>
          </div>
          <div style={cardStyle}>
            {sectionTitle("Active Sessions")}
            {sectionDesc("Devices currently logged into your account.")}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { device: "Chrome on Windows", location: "London, UK", time: "Active now", current: true },
                { device: "Safari on macOS", location: "Edinburgh, UK", time: "Last active 2 hours ago", current: false },
                { device: "Mobile App (iOS)", location: "London, UK", time: "Last active 1 day ago", current: false },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #F3F4F6", borderRadius: "8px" }}>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{s.device} {s.current && <span style={{ fontSize: "11px", color: "#059669", fontWeight: 500 }}>• Current</span>}</p>
                    <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>{s.location} · {s.time}</p>
                  </div>
                  {!s.current && (
                    <button onClick={() => showToast("Session revoked")} style={{ fontSize: "12px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSaveSecurity} style={{ height: "42px", padding: "0 28px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Security Settings</button>
          </div>
        </>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .settings-tab { transition: all 150ms; }
        .settings-tab:hover { background: #FFF4F1 !important; color: #F04E23 !important; }
      `}</style>
      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}

      {/* ── SIDEBAR ── */}
      <aside style={{ position: "fixed", left: 0, top: 0, width: "240px", height: "100vh", background: "white", borderRight: "1px solid #E5E7EB", zIndex: 50, display: "flex", flexDirection: "column" }}>
        <div style={{ height: "56px", display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IntelliHireLogo className="w-8 h-8" />
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#0D0D0D", fontFamily: "Inter, sans-serif", letterSpacing: "-0.3px" }}>IntelliHire</span>
          </div>
        </div>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "14px", fontWeight: 600, flexShrink: 0 }}>AC</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>Acme Corp</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0, marginTop: "2px" }}>Technology · 51–200</p>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (<NavItem key={item.id} icon={item.icon} label={item.label} active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />))}
        </nav>
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>JS</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>John Smith</p>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#F04E23", textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Owner</span>
            </div>
            <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Company <em style={{ color: "#F04E23", fontStyle: "italic" }}>Settings</em>
          </h1>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "32px" }}>
            {/* ─ Left Tab Nav ─ */}
            <div style={{ alignSelf: "start", position: "sticky", top: "80px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {settingsTabs.map((tab) => (
                  <button key={tab.id} className="settings-tab" onClick={() => setActiveTab(tab.id)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", background: activeTab === tab.id ? "#FFF4F1" : "transparent", color: activeTab === tab.id ? "#F04E23" : "#6B7280", borderLeft: activeTab === tab.id ? "2px solid #F04E23" : "2px solid transparent", textAlign: "left", width: "100%" }}>
                    <tab.icon size={16} /> {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─ Right Content ─ */}
            <div style={{ animation: "fadeIn 200ms ease" }}>
              {renderTab()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CompanySettings;
