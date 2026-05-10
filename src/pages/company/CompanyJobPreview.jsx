import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart2,
  Globe,
  UserCheck,
  Settings,
  LogOut,
  Copy,
  Share2,
  ExternalLink,
  Download,
  Eye,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

// ─── Sidebar Nav Item ────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 transition-all"
    style={{
      height: "38px",
      borderRadius: "6px",
      margin: "1px 8px",
      width: "calc(100% - 16px)",
      fontSize: "14px",
      fontWeight: 500,
      fontFamily: "Inter, sans-serif",
      cursor: "pointer",
      border: "none",
      borderLeft: active ? "2px solid #F04E23" : "2px solid transparent",
      background: active ? "#FFF4F1" : "transparent",
      color: active ? "#F04E23" : "#9CA3AF",
      transition: "all 150ms ease",
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = "#FFF4F1";
        e.currentTarget.style.color = "#F04E23";
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#9CA3AF";
      }
    }}
  >
    <Icon size={17} />
    <span>{label}</span>
  </button>
);

// ─── Nav Items ───────────────────────────────────────────────────────────────
const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "community", label: "Community", icon: Globe },
  { id: "team", label: "Team", icon: UserCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

// ─── QR Code SVG (simplified mock) ──────────────────────────────────────────
const QRCode = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="120" rx="4" fill="white" />
    <rect x="10" y="10" width="30" height="30" rx="2" fill="#0D0D0D" />
    <rect x="14" y="14" width="22" height="22" rx="1" fill="white" />
    <rect x="18" y="18" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="80" y="10" width="30" height="30" rx="2" fill="#0D0D0D" />
    <rect x="84" y="14" width="22" height="22" rx="1" fill="white" />
    <rect x="88" y="18" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="10" y="80" width="30" height="30" rx="2" fill="#0D0D0D" />
    <rect x="14" y="84" width="22" height="22" rx="1" fill="white" />
    <rect x="18" y="88" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="46" y="10" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="10" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="10" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="20" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="20" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="30" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="30" width="6" height="6" fill="#0D0D0D" />
    <rect x="10" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="20" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="30" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="90" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="100" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="10" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="30" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="100" y="56" width="6" height="6" fill="#0D0D0D" />
    <rect x="10" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="20" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="30" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="90" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="100" y="66" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="100" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="90" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="90" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="90" width="6" height="6" fill="#0D0D0D" />
    <rect x="90" y="90" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="100" width="6" height="6" fill="#0D0D0D" />
    <rect x="56" y="100" width="6" height="6" fill="#0D0D0D" />
    <rect x="66" y="100" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="100" width="6" height="6" fill="#0D0D0D" />
    <rect x="100" y="100" width="6" height="6" fill="#0D0D0D" />
  </svg>
);

function CompanyJobPreview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeNav, setActiveNav] = useState("jobs");
  const [copied, setCopied] = useState(false);
  const [submitTooltip, setSubmitTooltip] = useState(false);

  const shareUrl = `https://intellihire.app/apply/acmecorp/${id || "1"}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/company/dashboard");
    if (navId === "jobs") navigate("/company/jobs");
    if (navId === "team") navigate("/company/team");
  };

  const mockFields = [
    { label: "Portfolio URL", type: "Short Text", required: true },
    { label: "Eligible to work in the UK?", type: "Yes/No", required: true },
    { label: "Cover letter (optional)", type: "Long Text", required: false },
  ];

  const previewInputStyle = {
    width: "100%",
    height: "40px",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    padding: "0 14px",
    fontSize: "14px",
    color: "#D1D5DB",
    background: "#FAFAFA",
    fontFamily: "Inter, sans-serif",
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .icon-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid #E5E7EB; border-radius: 8px; background: white; cursor: pointer; color: #6B7280; transition: all 150ms; }
        .icon-btn:hover { border-color: #F04E23; color: #F04E23; }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "240px",
          height: "100vh",
          background: "white",
          borderRight: "1px solid #E5E7EB",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
        }}
      >
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
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Acme Corp</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0, marginTop: "2px" }}>Technology · 51–200</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />
          ))}
        </nav>

        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>JS</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>John Smith</p>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#F04E23", textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Owner</span>
            </div>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")} title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top Bar */}
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
              Application Form <em style={{ color: "#F04E23", fontStyle: "italic" }}>Preview</em>
            </h1>
          </div>
        </header>

        {/* Sub Header */}
        <div style={{ padding: "12px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0, fontFamily: "Inter, sans-serif" }}>Senior Frontend Engineer</p>
          <div style={{ display: "flex", gap: "16px" }}>
            <button
              onClick={() => navigate(`/company/jobs/${id || "1"}/edit`)}
              style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              ← Edit Job
            </button>
            <button
              onClick={() => navigate("/company/jobs")}
              style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
            >
              ← Back to Job Postings
            </button>
          </div>
        </div>

        {/* Two-Column Content */}
        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 0.66fr", gap: "24px", alignItems: "start" }}>

            {/* ── LEFT — Live Form Preview ── */}
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden", background: "white" }}>
              {/* Label Bar */}
              <div style={{ background: "#FAFAFA", borderBottom: "1px solid #E5E7EB", padding: "10px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Eye size={13} style={{ color: "#9CA3AF" }} />
                <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Candidate View</span>
              </div>

              {/* Form Preview */}
              <div style={{ padding: "24px" }}>
                <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 20px" }}>
                  Applying for <strong>Senior Frontend Engineer</strong> at <strong>Acme Corp</strong>
                </h2>

                {/* Standard Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Full Name <span style={{ color: "#F04E23" }}>*</span></label>
                    <input readOnly placeholder="Enter your full name" style={previewInputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Email <span style={{ color: "#F04E23" }}>*</span></label>
                    <input readOnly placeholder="your@email.com" style={previewInputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Phone</label>
                    <input readOnly placeholder="+44 7XXX XXX XXX" style={previewInputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>CV / Resume <span style={{ color: "#F04E23" }}>*</span></label>
                    <div style={{ border: "2px dashed #E5E7EB", borderRadius: "8px", padding: "24px", textAlign: "center", background: "#FAFAFA" }}>
                      <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>Drag & drop your PDF here, or click to browse</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
                  <span style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>Additional Questions</span>
                  <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
                </div>

                {/* Custom Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                  {mockFields.map((f, i) => (
                    <div key={i}>
                      <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>
                        {f.label} {f.required && <span style={{ color: "#F04E23" }}>*</span>}
                      </label>
                      {f.type === "Long Text" ? (
                        <textarea readOnly placeholder="Type your answer…" style={{ ...previewInputStyle, height: "80px", padding: "10px 14px", resize: "none" }} />
                      ) : f.type === "Yes/No" ? (
                        <div style={{ display: "flex", gap: "12px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#374151", cursor: "default" }}>
                            <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #E5E7EB", display: "inline-block" }} /> Yes
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#374151", cursor: "default" }}>
                            <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #E5E7EB", display: "inline-block" }} /> No
                          </label>
                        </div>
                      ) : (
                        <input readOnly placeholder="Type your answer…" style={previewInputStyle} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Button (non-interactive) */}
                <div style={{ position: "relative" }}>
                  <button
                    onMouseEnter={() => setSubmitTooltip(true)}
                    onMouseLeave={() => setSubmitTooltip(false)}
                    style={{
                      width: "100%",
                      height: "42px",
                      background: "#F04E23",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "default",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Submit Application
                  </button>
                  {submitTooltip && (
                    <div style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      color: "#9CA3AF",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      animation: "fadeIn 150ms ease",
                      fontFamily: "Inter, sans-serif",
                    }}>
                      Preview Only — not functional
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT — Sharing Panel ── */}
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", background: "white", padding: "24px" }}>
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 20px" }}>
                Share This <em style={{ color: "#F04E23", fontStyle: "italic" }}>Job</em>
              </h3>

              {/* Shareable URL */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                <input
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    height: "40px",
                    background: "#FAFAFA",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "0 12px",
                    fontSize: "13px",
                    color: copied ? "#F04E23" : "#374151",
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "color 200ms",
                  }}
                />
                <button
                  onClick={handleCopyLink}
                  style={{
                    height: "40px",
                    padding: "0 14px",
                    background: copied ? "white" : "#F04E23",
                    color: copied ? "#059669" : "white",
                    border: copied ? "1px solid #059669" : "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 200ms",
                    whiteSpace: "nowrap",
                    minWidth: "100px",
                  }}
                >
                  {copied ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>

              {/* QR Code */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", padding: "8px", display: "inline-block" }}>
                  <QRCode />
                </div>
                <button
                  style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  <Download size={13} /> Download QR
                </button>
              </div>

              {/* Open in New Tab */}
              <button
                style={{
                  width: "100%",
                  height: "36px",
                  background: "white",
                  color: "#374151",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "border-color 150ms, color 150ms",
                  marginBottom: "20px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#F04E23";
                  e.currentTarget.style.color = "#F04E23";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E5E7EB";
                  e.currentTarget.style.color = "#374151";
                }}
              >
                <ExternalLink size={14} /> Open in New Tab →
              </button>

              {/* Divider */}
              <div style={{ height: "1px", background: "#E5E7EB", margin: "0 0 16px" }} />

              {/* Share via */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <span style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "Inter, sans-serif", marginRight: "4px" }}>Share via</span>
                <button className="icon-btn" title="Share on LinkedIn"><Share2 size={16} /></button>
                <button className="icon-btn" title="Copy Link" onClick={handleCopyLink}><Copy size={16} /></button>
              </div>

              {/* Divider */}
              <div style={{ height: "1px", background: "#E5E7EB", margin: "0 0 16px" }} />

              {/* Settings Summary */}
              <div style={{ background: "#FAFAFA", borderRadius: "10px", padding: "16px", border: "1px solid #E5E7EB" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Deadline</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#059669", fontFamily: "Inter, sans-serif" }}>Jun 15, 2025</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Total Fields</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151", fontFamily: "Inter, sans-serif" }}>7 fields</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Status</span>
                  <span style={{ background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", fontFamily: "Inter, sans-serif" }}>Published</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CompanyJobPreview;
