import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, Briefcase, Users, BarChart2, Globe, UserCheck, Settings, LogOut,
  Copy, Share2, ExternalLink, Download, Eye, X, MapPin, Clock, DollarSign, Layers,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { getJobById, updateJob } from "../../data/jobsStore";

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 transition-all"
    style={{ height: "38px", borderRadius: "6px", margin: "1px 8px", width: "calc(100% - 16px)", fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "none", borderLeft: active ? "2px solid #F04E23" : "2px solid transparent", background: active ? "#FFF4F1" : "transparent", color: active ? "#F04E23" : "#9CA3AF", transition: "all 150ms ease" }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}>
    <Icon size={17} /><span>{label}</span>
  </button>
);

const Toast = ({ message, type = "success", onClose }) => {
  const colors = { success: "#059669", error: "#DC2626", warning: "#D97706", info: "#F04E23" };
  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px 18px", width: "360px", borderLeft: `4px solid ${colors[type] || colors.success}`, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "toastIn 200ms ease", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "2px" }}><X size={14} /></button>
    </div>
  );
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "community", label: "Community", icon: Globe },
  { id: "team", label: "Team", icon: UserCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

const QRCode = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="120" rx="4" fill="white" />
    <rect x="10" y="10" width="30" height="30" rx="2" fill="#0D0D0D" /><rect x="14" y="14" width="22" height="22" rx="1" fill="white" /><rect x="18" y="18" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="80" y="10" width="30" height="30" rx="2" fill="#0D0D0D" /><rect x="84" y="14" width="22" height="22" rx="1" fill="white" /><rect x="88" y="18" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="10" y="80" width="30" height="30" rx="2" fill="#0D0D0D" /><rect x="14" y="84" width="22" height="22" rx="1" fill="white" /><rect x="18" y="88" width="14" height="14" rx="1" fill="#0D0D0D" />
    <rect x="46" y="10" width="6" height="6" fill="#0D0D0D" /><rect x="56" y="10" width="6" height="6" fill="#0D0D0D" /><rect x="66" y="10" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="46" width="6" height="6" fill="#0D0D0D" /><rect x="56" y="46" width="6" height="6" fill="#0D0D0D" /><rect x="66" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="46" width="6" height="6" fill="#0D0D0D" /><rect x="90" y="46" width="6" height="6" fill="#0D0D0D" /><rect x="100" y="46" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="80" width="6" height="6" fill="#0D0D0D" /><rect x="56" y="80" width="6" height="6" fill="#0D0D0D" /><rect x="66" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="80" y="80" width="6" height="6" fill="#0D0D0D" /><rect x="100" y="80" width="6" height="6" fill="#0D0D0D" />
    <rect x="46" y="100" width="6" height="6" fill="#0D0D0D" /><rect x="66" y="100" width="6" height="6" fill="#0D0D0D" /><rect x="80" y="100" width="6" height="6" fill="#0D0D0D" /><rect x="100" y="100" width="6" height="6" fill="#0D0D0D" />
  </svg>
);

// ─── Render multiline text with bullet support ─────────────────────────────
const RenderText = ({ text }) => {
  if (!text) return <p style={{ fontSize: "14px", color: "#9CA3AF", fontStyle: "italic", margin: 0 }}>Not provided</p>;
  return (
    <div style={{ fontSize: "14px", color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
      {text}
    </div>
  );
};

function CompanyJobPreview() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { id } = useParams();
  const [activeNav, setActiveNav] = useState("jobs");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");

  const job = getJobById(id);
  const shareUrl = `https://intellihire.app/apply/acmecorp/${id || "1"}`;

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handlePublish = () => {
    updateJob(id, { status: "Published" });
    showToast(`"${job?.title}" published successfully!`);
    setTimeout(() => navigate("/company/jobs"), 800);
  };

  if (!job) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "18px", color: "#374151", marginBottom: "12px" }}>Job not found</p>
          <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "14px", color: "#F04E23", background: "none", border: "none", cursor: "pointer" }}>← Back to Job Postings</button>
        </div>
      </div>
    );
  }

  const customFields = job.customFields || [];
  const previewInputStyle = { width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#D1D5DB", background: "#FAFAFA", fontFamily: "Inter, sans-serif", boxSizing: "border-box", outline: "none" };
  const formatDeadline = (d) => { if (!d) return "Not set"; try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; } };
  const formatSalary = () => {
    if (job.salaryMin && job.salaryMax) return `£${Number(job.salaryMin).toLocaleString()} – £${Number(job.salaryMax).toLocaleString()}`;
    if (job.salaryMin) return `From £${Number(job.salaryMin).toLocaleString()}`;
    if (job.salaryMax) return `Up to £${Number(job.salaryMax).toLocaleString()}`;
    return "Not specified";
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .icon-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid #E5E7EB; border-radius: 8px; background: white; cursor: pointer; color: #6B7280; transition: all 150ms; }
        .icon-btn:hover { border-color: #F04E23; color: #F04E23; }
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
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Job <em style={{ color: "#F04E23", fontStyle: "italic" }}>Preview</em>
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={() => navigate(`/company/jobs/${id}/edit`)} style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>← Edit Job</button>
            <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>← Back to Jobs</button>
          </div>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>

            {/* ── LEFT — Job Details Preview ── */}
            <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden", background: "white" }}>
              <div style={{ background: "#FAFAFA", borderBottom: "1px solid #E5E7EB", padding: "10px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Eye size={13} style={{ color: "#9CA3AF" }} />
                <span style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF" }}>Job Preview</span>
              </div>

              <div style={{ padding: "28px" }}>
                {/* Title & Meta */}
                <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "24px", color: "#0D0D0D", margin: "0 0 8px" }}>{job.title}</h2>
                <p style={{ fontSize: "15px", color: "#374151", margin: "0 0 16px" }}>Acme Corp · {job.department || "—"}</p>

                {/* Meta Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
                  {job.location && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6B7280", background: "#F3F4F6", borderRadius: "999px", padding: "4px 12px" }}><MapPin size={12} /> {job.location}</span>}
                  {job.workplaceType && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6B7280", background: "#F3F4F6", borderRadius: "999px", padding: "4px 12px" }}>{job.workplaceType}</span>}
                  {job.jobType && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6B7280", background: "#F3F4F6", borderRadius: "999px", padding: "4px 12px" }}><Clock size={12} /> {job.jobType}</span>}
                  {job.experienceLevel && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6B7280", background: "#F3F4F6", borderRadius: "999px", padding: "4px 12px" }}><Layers size={12} /> {job.experienceLevel}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6B7280", background: "#F3F4F6", borderRadius: "999px", padding: "4px 12px" }}><DollarSign size={12} /> {formatSalary()}</span>
                </div>

                {/* Description */}
                {job.description && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>About the Role</h3>
                    <RenderText text={job.description} />
                  </div>
                )}

                {/* Responsibilities */}
                {job.responsibilities && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>Responsibilities</h3>
                    <RenderText text={job.responsibilities} />
                  </div>
                )}

                {/* Requirements */}
                {job.requirements && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>Requirements</h3>
                    <RenderText text={job.requirements} />
                  </div>
                )}

                {/* Preferred Qualifications */}
                {job.preferredQualifications && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>Preferred Qualifications</h3>
                    <RenderText text={job.preferredQualifications} />
                  </div>
                )}

                {/* Skills */}
                {job.skills && job.skills.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>Required Skills</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {job.skills.map((s) => <span key={s} style={{ background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "12px", fontWeight: 500, padding: "4px 12px" }}>{s}</span>)}
                    </div>
                  </div>
                )}

                {/* Hiring Stages */}
                {job.hiringStages && job.hiringStages.length > 0 && (
                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 10px" }}>Hiring Process</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                      {job.hiringStages.map((s, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ background: "#F3F4F6", borderRadius: "999px", fontSize: "12px", fontWeight: 500, padding: "5px 12px", color: "#374151" }}>{i + 1}. {s}</span>
                          {i < job.hiringStages.length - 1 && <span style={{ color: "#D1D5DB", fontSize: "16px" }}>→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider before Application Form Preview */}
                <div style={{ height: "1px", background: "#E5E7EB", margin: "24px 0" }} />

                {/* Application Form Preview */}
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#0D0D0D", margin: "0 0 16px" }}>Application Form Preview</h3>
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
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>CV / Resume <span style={{ color: "#F04E23" }}>*</span></label>
                    <div style={{ border: "2px dashed #E5E7EB", borderRadius: "8px", padding: "24px", textAlign: "center", background: "#FAFAFA" }}>
                      <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>Drag & drop your PDF here, or click to browse</p>
                    </div>
                  </div>
                </div>

                {customFields.length > 0 && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                      <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
                      <span style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", whiteSpace: "nowrap" }}>Additional Questions</span>
                      <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                      {customFields.map((f, i) => (
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
                  </>
                )}

                <button style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "default", fontFamily: "Inter, sans-serif", opacity: 0.7 }}>Submit Application</button>
                <p style={{ fontSize: "11px", color: "#9CA3AF", textAlign: "center", marginTop: "8px" }}>Preview only — this button is not functional</p>
              </div>
            </div>

            {/* ── RIGHT — Job Summary + Sharing ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Job Summary Card */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", background: "white", padding: "24px" }}>
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 16px" }}>Job Summary</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { label: "Department", value: job.department || "—" },
                    { label: "Location", value: job.location || "—" },
                    { label: "Workplace", value: job.workplaceType || "—" },
                    { label: "Type", value: job.jobType || "—" },
                    { label: "Experience", value: job.experienceLevel || "—" },
                    { label: "Openings", value: job.openings || "—" },
                    { label: "Salary", value: formatSalary() },
                    { label: "Deadline", value: formatDeadline(job.deadline) },
                    { label: "Recruiter", value: job.recruiter || "—" },
                    { label: "Status", value: job.status || "Draft" },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "#9CA3AF" }}>{row.label}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: row.label === "Status" && row.value === "Published" ? "#059669" : row.label === "Status" && row.value === "Draft" ? "#6B7280" : "#374151" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Publish / Edit Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {job.status !== "Published" && (
                  <button onClick={handlePublish} style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>
                    Publish Job →
                  </button>
                )}
                {job.status === "Published" && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "12px 16px", textAlign: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#059669" }}>✓ This job is live</span>
                  </div>
                )}
                <button onClick={() => navigate(`/company/jobs/${id}/edit`)} style={{ width: "100%", height: "40px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>
                  ← Edit Job
                </button>
              </div>

              {/* Share Card */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", background: "white", padding: "24px" }}>
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 16px" }}>
                  Share This <em style={{ color: "#F04E23", fontStyle: "italic" }}>Job</em>
                </h3>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <input readOnly value={shareUrl} style={{ flex: 1, height: "40px", background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "13px", color: copied ? "#F04E23" : "#374151", fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box", transition: "color 200ms" }} />
                  <button onClick={handleCopyLink} style={{ height: "40px", padding: "0 14px", background: copied ? "white" : "#F04E23", color: copied ? "#059669" : "white", border: copied ? "1px solid #059669" : "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 200ms", whiteSpace: "nowrap", minWidth: "90px" }}>
                    {copied ? "✓ Copied!" : "Copy Link"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "6px", padding: "8px", display: "inline-block" }}><QRCode /></div>
                  <button style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}><Download size={13} /> Download QR</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#9CA3AF", marginRight: "4px" }}>Share via</span>
                  <button className="icon-btn" title="Share"><Share2 size={16} /></button>
                  <button className="icon-btn" title="Copy Link" onClick={handleCopyLink}><Copy size={16} /></button>
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
