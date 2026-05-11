import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, User, Mic2, FileText, Globe, Settings, LogOut,
  Bell, Shield, Eye, EyeOff, Save, X,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

// ─── Nav Item ────────────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick}
    style={{
      width: "calc(100% - 16px)", height: "38px", display: "flex", alignItems: "center",
      gap: "10px", padding: "0 14px", margin: "1px 8px", borderRadius: "6px",
      fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer",
      border: "none", borderLeft: active ? "2px solid #F04E23" : "2px solid transparent",
      background: active ? "#FFF4F1" : "transparent",
      color: active ? "#F04E23" : "#9CA3AF", transition: "all 150ms ease",
    }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}>
    <Icon size={17} /><span>{label}</span>
  </button>
);

const ToggleSwitch = ({ checked, onChange }) => (
  <button onClick={onChange}
    style={{ width: "38px", height: "22px", borderRadius: "999px", background: checked ? "#F04E23" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 150ms", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: "3px", left: checked ? "19px" : "3px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
  </button>
);

const Toast = ({ message, type, onClose }) => {
  const colors = { success: "#16A34A", error: "#DC2626", info: "#F04E23" };
  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px 18px", minWidth: "300px", borderLeft: `4px solid ${colors[type] || colors.success}`, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X size={14} /></button>
    </div>
  );
};

const settingsTabs = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy",       label: "Privacy",        icon: Eye },
  { id: "security",      label: "Security",       icon: Shield },
];

function CandidateSettings() {
  const navigate  = useNavigate();
  const logout    = useLogout();

  const [activeNav,  setActiveNav]  = useState("settings");
  const [activeTab,  setActiveTab]  = useState("profile");
  const [toast,      setToast]      = useState(null);

  // Profile fields
  const [fullName,   setFullName]   = useState("Ahmed Hassan");
  const [email,      setEmail]      = useState("ahmed.hassan@email.com");
  const [location,   setLocation]   = useState("Lahore, Pakistan");
  const [bio,        setBio]        = useState("");
  const [linkedIn,   setLinkedIn]   = useState("");
  const [github,     setGithub]     = useState("");
  const [portfolio,  setPortfolio]  = useState("");

  // Notification toggles
  const [notif, setNotif] = useState({
    emailJobMatch:    true,
    emailInterviews:  true,
    emailCommunities: false,
    emailWeekly:      true,
    inAppMessages:    true,
    inAppReminders:   true,
    inAppUpdates:     false,
  });

  // Privacy toggles
  const [privacy, setPrivacy] = useState({
    profilePublic:    true,
    resumeVisible:    true,
    showEmail:        false,
    showActivity:     true,
    allowRecruiter:   true,
  });

  // Security
  const [currPwd,   setCurrPwd]   = useState("");
  const [newPwd,    setNewPwd]    = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurr,   setShowCurr]  = useState(false);
  const [showNew,    setShowNew]   = useState(false);
  const [showConf,   setShowConf]  = useState(false);
  const [pwdErrors,  setPwdErrors] = useState({});

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard")   navigate("/candidate/dashboard");
    if (navId === "profile")     navigate("/candidate/profile");
    if (navId === "interview")   navigate("/candidate/interview/setup");
    if (navId === "reports")     navigate("/candidate/reports");
    if (navId === "communities") navigate("/candidate/communities");
  };

  const handleSaveProfile = () => {
    showToast("Profile settings saved successfully!");
  };

  const handleSaveNotif = () => {
    showToast("Notification preferences updated!");
  };

  const handleSavePrivacy = () => {
    showToast("Privacy settings updated!");
  };

  const handleChangePassword = () => {
    const e = {};
    if (!currPwd)               e.currPwd    = "Enter your current password";
    if (!newPwd)                e.newPwd     = "Enter a new password";
    else if (newPwd.length < 8) e.newPwd     = "At least 8 characters required";
    if (newPwd !== confirmPwd)  e.confirmPwd = "Passwords do not match";
    setPwdErrors(e);
    if (Object.keys(e).length) return;
    setCurrPwd(""); setNewPwd(""); setConfirmPwd("");
    showToast("Password changed successfully!");
  };

  // ── Input style ───────────────────────────────────────────────────────────
  const inp = (err) => ({
    width: "100%", height: "42px", padding: "0 14px", borderRadius: "8px",
    border: `1px solid ${err ? "#DC2626" : "#E5E7EB"}`, fontSize: "14px",
    fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box",
    background: "white", color: "#111827",
  });

  const navItems = [
    { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
    { id: "profile",     label: "My Profile",  icon: User },
    { id: "interview",   label: "Interviews",  icon: Mic2 },
    { id: "reports",     label: "My Reports",  icon: FileText },
    { id: "communities", label: "Communities", icon: Globe },
    { id: "settings",    label: "Settings",    icon: Settings },
  ];

  // ── Tab content ───────────────────────────────────────────────────────────
  const renderProfile = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label style={lbl}>Full Name</label>
          <input style={inp()} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
        </div>
        <div>
          <label style={lbl}>Email Address</label>
          <input style={{ ...inp(), background: "#F9FAFB", color: "#9CA3AF" }} value={email} readOnly />
          <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px" }}>Email cannot be changed here</p>
        </div>
        <div>
          <label style={lbl}>Location</label>
          <input style={inp()} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
        </div>
        <div>
          <label style={lbl}>Portfolio URL</label>
          <input style={inp()} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://yourportfolio.com" />
        </div>
      </div>
      <div>
        <label style={lbl}>Bio <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({bio.length}/300)</span></label>
        <textarea
          value={bio} onChange={(e) => e.target.value.length <= 300 && setBio(e.target.value)}
          placeholder="Write a short professional bio about yourself..."
          style={{ width: "100%", height: "96px", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label style={lbl}>LinkedIn URL</label>
          <input style={inp()} value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
        <div>
          <label style={lbl}>GitHub URL</label>
          <input style={inp()} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/..." />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleSaveProfile} style={saveBtn}>
          <Save size={15} /> Save Changes
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {[
        { title: "Email Notifications", items: [
          { key: "emailJobMatch",    label: "New job matches",           desc: "Get notified when a job matches your profile" },
          { key: "emailInterviews",  label: "Interview reminders",       desc: "Reminders before scheduled AI interview sessions" },
          { key: "emailCommunities", label: "Community activity",        desc: "Updates from communities you're a member of" },
          { key: "emailWeekly",      label: "Weekly digest",             desc: "A weekly summary of activity and new opportunities" },
        ]},
        { title: "In-App Notifications", items: [
          { key: "inAppMessages",   label: "New messages",              desc: "Notifications when a recruiter messages you" },
          { key: "inAppReminders",  label: "Task reminders",            desc: "Reminders for incomplete profile or pending actions" },
          { key: "inAppUpdates",    label: "Product updates",           desc: "Learn about new IntelliHire features" },
        ]},
      ].map(({ title, items }) => (
        <div key={title}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0px", border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
            {items.map((item, i) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < items.length - 1 ? "1px solid #F3F4F6" : "none", background: "white" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>{item.desc}</p>
                </div>
                <ToggleSwitch checked={notif[item.key]} onChange={() => setNotif((n) => ({ ...n, [item.key]: !n[item.key] }))} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleSaveNotif} style={saveBtn}><Save size={15} /> Save Preferences</button>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
        {[
          { key: "profilePublic",  label: "Public Profile",         desc: "Allow anyone to view your candidate profile" },
          { key: "resumeVisible",  label: "Resume Visibility",      desc: "Allow recruiters to download your uploaded CV" },
          { key: "showEmail",      label: "Show Email to Recruiters", desc: "Display your email on your public profile" },
          { key: "showActivity",   label: "Show Activity Status",   desc: "Let others see when you were last active" },
          { key: "allowRecruiter", label: "Recruiter Outreach",     desc: "Allow recruiters to send you direct messages" },
        ].map((item, i, arr) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < arr.length - 1 ? "1px solid #F3F4F6" : "none", background: "white" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>{item.label}</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>{item.desc}</p>
            </div>
            <ToggleSwitch checked={privacy[item.key]} onChange={() => setPrivacy((p) => ({ ...p, [item.key]: !p[item.key] }))} />
          </div>
        ))}
      </div>
      <div style={{ padding: "16px", background: "#FFF4F1", borderRadius: "10px", border: "1px solid #FCA68A" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#92400E", margin: "0 0 4px" }}>Data & Account</p>
        <p style={{ fontSize: "13px", color: "#B45309", margin: "0 0 12px" }}>You can request a copy of your data or permanently delete your account at any time.</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => showToast("Data export request sent. You'll receive an email within 24 hours.", "info")}
            style={{ height: "34px", padding: "0 16px", borderRadius: "8px", border: "1px solid #FCA68A", background: "white", color: "#92400E", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Export Data
          </button>
          <button onClick={() => showToast("Please contact support to delete your account.", "error")}
            style={{ height: "34px", padding: "0 16px", borderRadius: "8px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Delete Account
          </button>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleSavePrivacy} style={saveBtn}><Save size={15} /> Save Settings</button>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "24px" }}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>Change Password</p>
        <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 20px" }}>Choose a strong password with at least 8 characters.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            { label: "Current Password", value: currPwd, setter: setCurrPwd, show: showCurr, toggleShow: () => setShowCurr(!showCurr), errKey: "currPwd" },
            { label: "New Password",     value: newPwd,  setter: setNewPwd,  show: showNew,  toggleShow: () => setShowNew(!showNew),   errKey: "newPwd" },
            { label: "Confirm New Password", value: confirmPwd, setter: setConfirmPwd, show: showConf, toggleShow: () => setShowConf(!showConf), errKey: "confirmPwd" },
          ].map(({ label, value, setter, show, toggleShow, errKey }) => (
            <div key={errKey}>
              <label style={lbl}>{label}</label>
              <div style={{ position: "relative" }}>
                <input type={show ? "text" : "password"} value={value} onChange={(e) => setter(e.target.value)}
                  placeholder="••••••••" style={{ ...inp(pwdErrors[errKey]), paddingRight: "44px" }} />
                <button onClick={toggleShow}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwdErrors[errKey] && <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>{pwdErrors[errKey]}</p>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleChangePassword} style={saveBtn}><Shield size={15} /> Update Password</button>
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "24px" }}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>Active Sessions</p>
        <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 16px" }}>Devices currently logged into your account.</p>
        {[
          { device: "Chrome on Windows", location: "Lahore, PK", current: true,  lastSeen: "Now" },
          { device: "Mobile Safari",     location: "Lahore, PK", current: false, lastSeen: "2 days ago" },
        ].map((s) => (
          <div key={s.device} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>{s.device}</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>{s.location} · {s.lastSeen}</p>
            </div>
            {s.current
              ? <span style={{ fontSize: "12px", fontWeight: 600, color: "#16A34A", background: "#F0FDF4", padding: "3px 10px", borderRadius: "999px", border: "1px solid #BBF7D0" }}>Current</span>
              : <button onClick={() => showToast("Session revoked.", "info")}
                  style={{ fontSize: "12px", color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "3px 10px", borderRadius: "999px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Revoke
                </button>
            }
          </div>
        ))}
      </div>
    </div>
  );

  const lbl = { display: "block", fontSize: "13px", fontWeight: 500, color: "#374151", marginBottom: "6px" };
  const saveBtn = { display: "flex", alignItems: "center", gap: "6px", height: "38px", padding: "0 20px", borderRadius: "8px", background: "#F04E23", color: "white", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" };

  const tabContent = { profile: renderProfile, notifications: renderNotifications, privacy: renderPrivacy, security: renderSecurity };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F9FAFB", fontFamily: "Inter, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: "240px", background: "white", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 40 }}>
        <div style={{ height: "64px", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #E5E7EB" }}>
          <IntelliHireLogo className="w-8 h-8 mr-2" />
          <span style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: "#111827" }}>IntelliHire</span>
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label}
              active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>AH</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ahmed Hassan</p>
              <span style={{ fontSize: "11px", color: "#F04E23", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Candidate</span>
            </div>
            <button onClick={logout}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{ height: "64px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 30 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Account <em style={{ color: "#F04E23", fontStyle: "italic" }}>Settings</em>
          </h1>
        </header>

        {/* Content */}
        <main style={{ padding: "32px", flex: 1 }}>

          {/* Settings layout */}
          <div style={{ display: "flex", gap: "28px", alignItems: "flex-start" }}>

            {/* Sidebar tabs */}
            <div style={{ width: "200px", flexShrink: 0, background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", overflow: "hidden" }}>
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", background: active ? "#FFF4F1" : "white", color: active ? "#F04E23" : "#374151", fontWeight: active ? 600 : 400, fontSize: "14px", border: "none", borderLeft: `3px solid ${active ? "#F04E23" : "transparent"}`, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 150ms" }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "white"; }}>
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content panel */}
            <div style={{ flex: 1, background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "28px" }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: "0 0 4px", fontFamily: "Times New Roman, serif" }}>
                  {settingsTabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <div style={{ height: "2px", width: "40px", background: "#F04E23", borderRadius: "2px" }} />
              </div>
              {tabContent[activeTab]?.()}
            </div>
          </div>
        </main>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default CandidateSettings;
