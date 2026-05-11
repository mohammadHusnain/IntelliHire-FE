import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, Briefcase, Users, BarChart2, Globe, UserCheck, Settings, LogOut,
  Search, X, ChevronLeft, ChevronRight, Download, MoreHorizontal, Calendar, UserPlus,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { candidatesList, getSavedStages, saveStage, stageOrder, stageBadgeStyle } from "../../data/candidatesData";

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
const CvMatchBadge = ({ score }) => {
  let bg, color, fill;
  if (score >= 80) { bg = "#F0FDF4"; color = "#059669"; fill = "#059669"; }
  else if (score >= 50) { bg = "#FFFBEB"; color = "#D97706"; fill = "#D97706"; }
  else { bg = "#FEF2F2"; color = "#DC2626"; fill = "#DC2626"; }
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", background: bg, borderRadius: "8px", padding: "4px 10px", minWidth: "52px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color, fontFamily: "Inter, sans-serif" }}>{score}%</span>
      <div style={{ width: "40px", height: "4px", borderRadius: "999px", background: "#E5E7EB", marginTop: "3px", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: "999px", background: fill, transition: "width 600ms ease" }} />
      </div>
    </div>
  );
};
const StageBadge = ({ stage }) => {
  const s = stageBadgeStyle[stage] || stageBadgeStyle.Applied;
  return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>{stage}</span>;
};
const InterviewBadge = ({ status }) => {
  const m = {
    "Scheduled": { bg: "#EFF6FF", color: "#2563EB" },
    "Completed": { bg: "#F0FDF4", color: "#059669" },
    "Pending": { bg: "#FFFBEB", color: "#D97706" },
    "Not Scheduled": { bg: "#F3F4F6", color: "#6B7280" },
  };
  const s = m[status] || m["Not Scheduled"];
  return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", whiteSpace: "nowrap" }}>{status}</span>;
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

const allStages = ["All", "Applied", "Screened", "Shortlisted", "Interviewed", "Decided", "On Hold", "Rejected"];
const allJobs = ["All Jobs", "Frontend Developer", "Backend Engineer", "Product Designer", "Data Scientist", "DevOps Engineer"];
const allSources = ["All Sources", "LinkedIn", "Referral", "Job Board", "Career Page"];
const allRecruiters = ["All Recruiters", "John Smith", "Sarah Johnson", "Emily Davis", "Michael Chen", "Unassigned"];
const sortOptions = ["Match Score ↓", "Name A–Z", "Date Applied ↓"];

function CompanyAllCandidates() {
  const navigate = useNavigate();
  const logout = useLogout();
  const [activeNav, setActiveNav] = useState("candidates");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All Jobs");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [recruiterFilter, setRecruiterFilter] = useState("All Recruiters");
  const [sortBy, setSortBy] = useState("Match Score ↓");
  const [selected, setSelected] = useState([]);
  const [stageDropdown, setStageDropdown] = useState(null);
  const [actionDropdown, setActionDropdown] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [assignModal, setAssignModal] = useState(null);
  const [assignRecruiter, setAssignRecruiter] = useState("");

  const [stageVersion, setStageVersion] = useState(0);
  const candidates = useMemo(() => {
    const saved = getSavedStages();
    return candidatesList.map((c) => ({ ...c, stage: saved[c.id] || c.defaultStage }));
  }, [stageVersion]);

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

  const handleStageChange = useCallback((cid, newStage, name) => {
    saveStage(cid, newStage);
    setStageVersion((v) => v + 1);
    setStageDropdown(null);
    showToast(`${name} moved to ${newStage}`);
  }, [showToast]);

  const handleBulkStageChange = useCallback((newStage) => {
    selected.forEach((cid) => saveStage(cid, newStage));
    setStageVersion((v) => v + 1);
    showToast(`${selected.length} candidate(s) moved to ${newStage}`);
    setSelected([]);
  }, [selected, showToast]);

  const handleExport = () => {
    const csv = ["Name,Email,Job,Score,Stage,Source,Recruiter,Interview", ...candidates.map((c) => `${c.name},${c.email},${c.job},${c.score},${c.stage},${c.source},${c.recruiter},${c.interviewStatus}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "candidates_export.csv";
    a.click();
    showToast("Candidates exported as CSV");
  };

  const handleAssignRecruiter = (cid, name) => {
    if (!assignRecruiter) return;
    showToast(`${name} assigned to ${assignRecruiter}`);
    setAssignModal(null);
    setAssignRecruiter("");
  };

  const filtered = useMemo(() => {
    let list = [...candidates];
    if (stageFilter !== "All") list = list.filter((c) => c.stage === stageFilter);
    if (jobFilter !== "All Jobs") list = list.filter((c) => c.job === jobFilter);
    if (sourceFilter !== "All Sources") list = list.filter((c) => c.source === sourceFilter);
    if (recruiterFilter !== "All Recruiters") list = list.filter((c) => c.recruiter === recruiterFilter);
    if (search.trim()) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.job.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "Match Score ↓") list.sort((a, b) => b.score - a.score);
    else if (sortBy === "Name A–Z") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, stageFilter, jobFilter, sourceFilter, recruiterFilter, sortBy, candidates]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // KPIs
  const totalActive = candidates.filter((c) => !["Rejected", "Decided"].includes(c.stage)).length;
  const interviewScheduled = candidates.filter((c) => c.interviewStatus === "Scheduled").length;
  const highMatch = candidates.filter((c) => c.score >= 80).length;
  const offerPending = candidates.filter((c) => c.stage === "Decided").length;
  const needsReview = candidates.filter((c) => c.stage === "Applied").length;

  const toggleSelect = (cid) => setSelected((p) => p.includes(cid) ? p.filter((x) => x !== cid) : [...p, cid]);
  const toggleAll = () => { if (selected.length === paged.length) setSelected([]); else setSelected(paged.map((c) => c.id)); };

  const inputStyle = { width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }} onClick={() => { stageDropdown && setStageDropdown(null); actionDropdown && setActionDropdown(null); }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .cand-row:hover { background: #FAFAFA; }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .orange-check { accent-color: #F04E23; }
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
            <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")} title="Log out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Candidate <em style={{ color: "#F04E23", fontStyle: "italic" }}>Management</em>
          </h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleExport} style={{ height: "36px", padding: "0 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "6px", transition: "border-color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}><Download size={14} /> Export</button>
          </div>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: "0 0 20px" }}>Manage all candidates across every job posting in one place</p>

          {/* ── KPI Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px" }}>
            {[
              { value: totalActive, label: "Active Candidates", color: "#0D0D0D", bg: "white" },
              { value: interviewScheduled, label: "Interviews Scheduled", color: "#2563EB", bg: "#EFF6FF" },
              { value: highMatch, label: "High Match (80%+)", color: "#059669", bg: "#F0FDF4" },
              { value: offerPending, label: "Offer Pending", color: "#D97706", bg: "#FFFBEB" },
            ].map((k) => (
              <div key={k.label} style={{ background: k.bg, border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: "Times New Roman, serif", fontSize: "28px", fontWeight: 700, color: k.color }}>{k.value}</span>
                <span style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px" }}>{k.label}</span>
              </div>
            ))}
          </div>

          {/* ── Insight ── */}
          {needsReview > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFF4F1", border: "1px solid #FCA68A", borderRadius: "6px", padding: "6px 12px", marginBottom: "20px", fontSize: "12px", color: "#374151" }}>
              <span style={{ color: "#F04E23", fontWeight: 600 }}>Action:</span> {needsReview} candidate{needsReview > 1 ? "s" : ""} need review this week
            </div>
          )}

          {/* ── Filter Bar ── */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px", marginBottom: selected.length > 0 ? "0" : "20px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderBottomLeftRadius: selected.length > 0 ? 0 : "10px", borderBottomRightRadius: selected.length > 0 ? 0 : "10px" }}>
            <div style={{ position: "relative", width: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search candidates…" className="field-input" style={{ ...inputStyle, paddingLeft: "34px", paddingRight: search ? "32px" : "14px" }} />
              {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex" }}><X size={14} /></button>}
            </div>
            {[
              { value: jobFilter, set: setJobFilter, options: allJobs, width: "160px" },
              { value: stageFilter, set: setStageFilter, options: allStages, width: "140px" },
              { value: sourceFilter, set: setSourceFilter, options: allSources, width: "140px" },
              { value: recruiterFilter, set: setRecruiterFilter, options: allRecruiters, width: "160px" },
              { value: sortBy, set: setSortBy, options: sortOptions, width: "150px" },
            ].map((f, i) => (
              <div key={i} style={{ position: "relative", width: f.width }}>
                <select value={f.value} onChange={(e) => { f.set(e.target.value); setPage(1); }} className="field-input" style={{ ...selectStyle, width: "100%" }}>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
                <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
            ))}
          </div>

          {/* ── Bulk Actions ── */}
          {selected.length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderTop: "none", borderBottomLeftRadius: "10px", borderBottomRightRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px", animation: "slideDown 150ms ease", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#92400E" }}>{selected.length} selected</span>
              <button onClick={() => handleBulkStageChange("Shortlisted")} style={{ height: "30px", padding: "0 12px", background: "#F04E23", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Shortlist</button>
              <button onClick={() => handleBulkStageChange("Rejected")} style={{ height: "30px", padding: "0 12px", background: "#DC2626", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Reject</button>
              <div style={{ position: "relative" }}>
                <select onChange={(e) => { if (e.target.value !== "Move to…") { handleBulkStageChange(e.target.value); e.target.value = "Move to…"; } }} style={{ height: "30px", padding: "0 24px 0 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", background: "white", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
                  <option>Move to…</option>
                  {allStages.filter((s) => s !== "All").map((s) => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
              <button onClick={() => setSelected([])} style={{ fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}>Clear ×</button>
            </div>
          )}

          {/* ── Empty State ── */}
          {candidates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <Users size={48} style={{ color: "#E5E7EB", marginBottom: "16px" }} />
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 8px" }}>No candidates yet</h3>
              <p style={{ fontSize: "14px", color: "#9CA3AF", margin: "0 0 24px" }}>Publish a job posting to start receiving applications.</p>
              <button onClick={() => navigate("/company/jobs/create")} style={{ height: "42px", padding: "0 24px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Create a Job Posting</button>
            </div>
          ) : (
            <>
              {/* ── Candidates Table ── */}
              <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                    <thead>
                      <tr style={{ background: "#FAFAFA" }}>
                        <th style={{ width: "40px", padding: "12px 12px", borderBottom: "1px solid #E5E7EB" }}>
                          <input type="checkbox" className="orange-check" checked={selected.length === paged.length && paged.length > 0} onChange={toggleAll} style={{ cursor: "pointer", width: "15px", height: "15px" }} />
                        </th>
                        {["Candidate", "Applied Job", "Match", "Stage", "Source", "Recruiter", "Last Activity", "Interview", "Actions"].map((col) => (
                          <th key={col} style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", textAlign: "left", padding: "12px 12px", fontFamily: "Inter, sans-serif", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.length === 0 ? (
                        <tr><td colSpan="10" style={{ padding: "48px 16px", textAlign: "center" }}><p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>No candidates match your filters.</p></td></tr>
                      ) : paged.map((c, i) => (
                        <tr key={c.id} className="cand-row" style={{ borderBottom: i < paged.length - 1 ? "1px solid #F3F4F6" : "none", transition: "background 120ms", cursor: "pointer" }} onClick={(e) => { if (e.target.closest("button, input, select, .dropdown-menu")) return; navigate(`/company/candidates/${c.id}`); }}>
                          <td style={{ padding: "10px 12px" }} onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="orange-check" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: "pointer", width: "15px", height: "15px" }} />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>{c.name.split(" ").map((w) => w[0]).join("")}</div>
                              <div>
                                <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{c.name}</p>
                                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>{c.email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "#374151" }}>{c.job}</td>
                          <td style={{ padding: "10px 12px" }}><CvMatchBadge score={c.score} /></td>
                          <td style={{ padding: "10px 12px", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                            <button className="dropdown-menu" onClick={() => setStageDropdown(stageDropdown === c.id ? null : c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                              <StageBadge stage={c.stage} />
                            </button>
                            {stageDropdown === c.id && (
                              <div className="dropdown-menu" style={{ position: "absolute", top: "calc(100% - 4px)", left: "12px", background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20, animation: "fadeIn 150ms ease", minWidth: "130px" }} onClick={(e) => e.stopPropagation()}>
                                {allStages.filter((s) => s !== "All").map((s) => (
                                  <button key={s} onClick={() => handleStageChange(c.id, s, c.name)} style={{ display: "block", width: "100%", padding: "5px 10px", fontSize: "13px", color: c.stage === s ? "#F04E23" : "#374151", fontWeight: c.stage === s ? 500 : 400, background: c.stage === s ? "#FFF4F1" : "transparent", border: "none", borderRadius: "4px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => { if (c.stage !== s) e.currentTarget.style.background = "#FAFAFA"; }} onMouseLeave={(e) => { if (c.stage !== s) e.currentTarget.style.background = "transparent"; }}>{s}</button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: "12px", color: "#6B7280" }}>{c.source}</td>
                          <td style={{ padding: "10px 12px", fontSize: "12px", color: c.recruiter === "Unassigned" ? "#D97706" : "#374151", fontWeight: c.recruiter === "Unassigned" ? 500 : 400 }}>{c.recruiter}</td>
                          <td style={{ padding: "10px 12px", fontSize: "12px", color: "#9CA3AF" }}>{c.lastActivity}</td>
                          <td style={{ padding: "10px 12px" }}><InterviewBadge status={c.interviewStatus} /></td>
                          <td style={{ padding: "10px 12px", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                            <button className="dropdown-menu" onClick={() => setActionDropdown(actionDropdown === c.id ? null : c.id)} style={{ background: "none", border: "1px solid #E5E7EB", borderRadius: "6px", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", color: "#6B7280", transition: "border-color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}><MoreHorizontal size={14} /></button>
                            {actionDropdown === c.id && (
                              <div className="dropdown-menu" style={{ position: "absolute", top: "calc(100% - 2px)", right: "12px", background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20, animation: "fadeIn 150ms ease", minWidth: "180px" }} onClick={(e) => e.stopPropagation()}>
                                {[
                                  { label: "View Profile", action: () => navigate(`/company/candidates/${c.id}`), color: "#374151" },
                                  { label: "Move to Next Stage", action: () => { const idx = stageOrder.indexOf(c.stage); if (idx < stageOrder.length - 1) handleStageChange(c.id, stageOrder[idx + 1], c.name); else showToast(`${c.name} is already at final stage`, "warning"); }, color: "#059669" },
                                  { label: "Put on Hold", action: () => handleStageChange(c.id, "On Hold", c.name), color: "#D97706" },
                                  { label: "Mark as Rejected", action: () => handleStageChange(c.id, "Rejected", c.name), color: "#DC2626" },
                                  { label: "Assign Recruiter", action: () => { setAssignModal(c.id); setAssignRecruiter(""); setActionDropdown(null); }, color: "#374151" },
                                  { label: "Move to Community", action: () => { showToast(`${c.name} added to talent community`); setActionDropdown(null); }, color: "#F04E23" },
                                ].map((a) => (
                                  <button key={a.label} onClick={() => { a.action(); setActionDropdown(null); }} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "13px", color: a.color, background: "transparent", border: "none", borderRadius: "4px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{a.label}</button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Pagination ── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
                <span style={{ fontSize: "13px", color: "#9CA3AF" }}>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ height: "36px", padding: "0 14px", background: "white", color: page === 1 ? "#D1D5DB" : "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: page === 1 ? "default" : "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "4px" }}><ChevronLeft size={14} /> Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ height: "36px", padding: "0 14px", background: "white", color: page === totalPages ? "#D1D5DB" : "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: page === totalPages ? "default" : "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>Next <ChevronRight size={14} /></button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Assign Recruiter Modal ── */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAssignModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "400px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
            <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 6px" }}>Assign Recruiter</h3>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 20px" }}>Select a recruiter for {candidates.find((c) => c.id === assignModal)?.name}</p>
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <select value={assignRecruiter} onChange={(e) => setAssignRecruiter(e.target.value)} className="field-input" style={selectStyle}>
                <option value="">Select recruiter…</option>
                {["John Smith", "Sarah Johnson", "Emily Davis", "Michael Chen"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => handleAssignRecruiter(assignModal, candidates.find((c) => c.id === assignModal)?.name)} disabled={!assignRecruiter} style={{ flex: 1, height: "40px", background: assignRecruiter ? "#F04E23" : "#E5E7EB", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: assignRecruiter ? "pointer" : "default" }}>Assign</button>
              <button onClick={() => setAssignModal(null)} style={{ flex: 1, height: "40px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyAllCandidates;
