import { useState, useMemo, useCallback } from "react";
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
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { candidatesList, getSavedStages, saveStage, stageOrder, stageBadgeStyle } from "../../data/candidatesData";

// ─── Sidebar Nav Item ────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 transition-all"
    style={{
      height: "38px", borderRadius: "6px", margin: "1px 8px", width: "calc(100% - 16px)",
      fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "none",
      borderLeft: active ? "2px solid #F04E23" : "2px solid transparent",
      background: active ? "#FFF4F1" : "transparent", color: active ? "#F04E23" : "#9CA3AF",
      transition: "all 150ms ease",
    }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}
  >
    <Icon size={17} />
    <span>{label}</span>
  </button>
);

// ─── Select Arrow ────────────────────────────────────────────────────────────
const SelectArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ─── CV Match Badge ──────────────────────────────────────────────────────────
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

// ─── Stage Badge ─────────────────────────────────────────────────────────────
const StageBadge = ({ stage }) => {
  const s = stageBadgeStyle[stage] || stageBadgeStyle.Applied;
  return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", fontFamily: "Inter, sans-serif" }}>{stage}</span>;
};

// ─── Toast ──────────────────────────────────────────────────────────────────
const Toast = ({ message, type = "success", onClose }) => {
  const colors = { success: "#059669", error: "#DC2626", warning: "#D97706", info: "#F04E23" };
  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px 18px", width: "360px", borderLeft: `4px solid ${colors[type] || colors.success}`, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "toastIn 200ms ease", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "2px" }}><X size={14} /></button>
    </div>
  );
};

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

const stages = ["All", "Applied", "Screened", "Shortlisted", "Interviewed", "Decided", "On Hold", "Rejected"];
const sortOptions = ["CV Match Score ↓", "Application Date ↓", "Name A–Z"];

function CompanyCandidates() {
  const navigate = useNavigate();
  const { id: jobId } = useParams();
  const [activeNav, setActiveNav] = useState("jobs");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [sortBy, setSortBy] = useState("CV Match Score ↓");
  const [selected, setSelected] = useState([]);
  const [stageDropdown, setStageDropdown] = useState(null);
  const [page] = useState(1);
  const perPage = 20;
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");

  // Build candidates with live stage from localStorage
  const [stageVersion, setStageVersion] = useState(0);
  const candidates = useMemo(() => {
    const saved = getSavedStages();
    return candidatesList.map((c) => ({
      ...c,
      stage: saved[c.id] || c.defaultStage,
    }));
  }, [stageVersion]);

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/company/dashboard");
    if (navId === "jobs") navigate("/company/jobs");
    if (navId === "team") navigate("/company/team");
    if (navId === "analytics") navigate("/company/analytics");
    if (navId === "community") navigate("/company/community");
  };

  const updateCandidateStage = useCallback((cid, newStage) => {
    saveStage(cid, newStage);
    setStageVersion((v) => v + 1);
    setStageDropdown(null);
  }, []);

  const handleStageChange = useCallback((cid, newStage, candidateName) => {
    updateCandidateStage(cid, newStage);
    showToast(`${candidateName} moved to ${newStage}`);
  }, [updateCandidateStage, showToast]);

  const handleBulkStageChange = useCallback((newStage) => {
    selected.forEach((cid) => saveStage(cid, newStage));
    setStageVersion((v) => v + 1);
    showToast(`${selected.length} candidate(s) moved to ${newStage}`);
    setSelected([]);
  }, [selected, showToast]);

  const filtered = useMemo(() => {
    let list = [...candidates];
    if (stageFilter !== "All") list = list.filter((c) => c.stage === stageFilter);
    if (search.trim()) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === "CV Match Score ↓") list.sort((a, b) => b.score - a.score);
    else if (sortBy === "Name A–Z") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, stageFilter, sortBy, candidates]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalApplicants = candidates.length;
  const shortlisted = candidates.filter((c) => c.stage === "Shortlisted").length;
  const interviewsPending = candidates.filter((c) => c.stage === "Interviewed").length;
  const decided = candidates.filter((c) => c.stage === "Decided").length;

  const toggleSelect = (cid) => setSelected((p) => p.includes(cid) ? p.filter((x) => x !== cid) : [...p, cid]);
  const toggleAll = () => {
    if (selected.length === paged.length) setSelected([]);
    else setSelected(paged.map((c) => c.id));
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }} onClick={() => stageDropdown && setStageDropdown(null)}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
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
          {navItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>JS</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>John Smith</p>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#F04E23", textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Owner</span>
            </div>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")} title="Log out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            <em style={{ color: "#F04E23", fontStyle: "italic" }}>Candidates</em>
          </h1>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Job Postings</button>
            <span style={{ color: "#9CA3AF", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#9CA3AF" }}>Senior Frontend Engineer</span>
            <span style={{ color: "#9CA3AF", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D" }}>Candidates</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "26px", color: "#0D0D0D", margin: 0 }}>Senior Frontend Engineer</h2>
            <span style={{ background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>Published</span>
          </div>

          {/* Stats Strip */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px 24px", marginBottom: "24px", display: "flex", alignItems: "center" }}>
            {[
              { value: totalApplicants, label: "Total Applicants", color: "#0D0D0D" },
              { value: shortlisted, label: "Shortlisted", color: "#059669" },
              { value: interviewsPending, label: "Interviews Pending", color: "#D97706" },
              { value: decided, label: "Decided", color: "#6B7280" },
            ].map((s, i, arr) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", borderRight: i < arr.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                <span style={{ fontFamily: "Times New Roman, serif", fontSize: "28px", color: s.color, fontWeight: 700 }}>{s.value}</span>
                <span style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Filter + Sort Bar */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px", marginBottom: selected.length > 0 ? "0" : "24px", display: "flex", alignItems: "center", gap: "12px", borderBottomLeftRadius: selected.length > 0 ? 0 : "10px", borderBottomRightRadius: selected.length > 0 ? 0 : "10px" }}>
            <div style={{ position: "relative", width: "220px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by candidate name…" className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 32px 0 34px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" }} />
              {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}><X size={14} /></button>}
            </div>
            <div style={{ position: "relative", width: "160px" }}>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 36px 0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
                {stages.map((s) => <option key={s}>{s}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
            </div>
            <div style={{ position: "relative", width: "180px" }}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 36px 0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
                {sortOptions.map((s) => <option key={s}>{s}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selected.length > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderTop: "none", borderBottomLeftRadius: "10px", borderBottomRightRadius: "10px", padding: "12px 16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px", animation: "slideDown 150ms ease" }}>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#92400E", fontFamily: "Inter, sans-serif" }}>{selected.length} candidate{selected.length > 1 ? "s" : ""} selected</span>
              <button onClick={() => handleBulkStageChange("Shortlisted")} style={{ height: "32px", padding: "0 14px", background: "#D97706", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Shortlist Selected</button>
              <div style={{ position: "relative", display: "inline-block" }}>
                <select onChange={(e) => { if (e.target.value !== "Move to Stage") { handleBulkStageChange(e.target.value); e.target.value = "Move to Stage"; } }} style={{ height: "32px", padding: "0 28px 0 10px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", background: "white", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
                  <option>Move to Stage</option>
                  {stages.filter((s) => s !== "All").map((s) => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
              </div>
              <button onClick={() => setSelected([])} style={{ fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", marginLeft: "auto" }}>Clear Selection ×</button>
            </div>
          )}

          {/* Candidates Table */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA" }}>
                  <th style={{ width: "40px", padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
                    <input type="checkbox" className="orange-check" checked={selected.length === paged.length && paged.length > 0} onChange={toggleAll} style={{ cursor: "pointer", width: "15px", height: "15px" }} />
                  </th>
                  {["Name", "Email", "Applied", "CV Match %", "Stage", "Actions"].map((col) => (
                    <th key={col} style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", textAlign: "left", padding: "12px 16px", fontFamily: "Inter, sans-serif", borderBottom: "1px solid #E5E7EB" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan="7" style={{ padding: "48px 16px", textAlign: "center" }}><p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>No candidates match your filters.</p></td></tr>
                ) : (
                  paged.map((c, i) => (
                    <tr key={c.id} className="cand-row" style={{ borderBottom: i < paged.length - 1 ? "1px solid #F3F4F6" : "none", transition: "background 120ms", height: "52px", cursor: "pointer" }} onClick={(e) => { if (e.target.closest("button, input, select, .stage-dropdown")) return; navigate(`/company/candidates/${c.id}`); }}>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="orange-check" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: "pointer", width: "15px", height: "15px" }} />
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: "#0D0D0D" }}>{c.name}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{c.email}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#374151" }}>{c.applied}</td>
                      <td style={{ padding: "12px 16px" }}><CvMatchBadge score={c.score} /></td>
                      <td style={{ padding: "12px 16px", position: "relative" }} onClick={(e) => e.stopPropagation()}>
                        <button className="stage-dropdown" onClick={() => setStageDropdown(stageDropdown === c.id ? null : c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          <StageBadge stage={c.stage} />
                        </button>
                        {stageDropdown === c.id && (
                          <div style={{ position: "absolute", top: "calc(100% - 4px)", left: "16px", background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20, animation: "fadeIn 150ms ease", minWidth: "140px" }} onClick={(e) => e.stopPropagation()}>
                            {stages.filter((s) => s !== "All").map((s) => (
                              <button key={s} onClick={() => handleStageChange(c.id, s, c.name)} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "13px", color: c.stage === s ? "#F04E23" : "#374151", fontWeight: c.stage === s ? 500 : 400, background: c.stage === s ? "#FFF4F1" : "transparent", border: "none", borderRadius: "4px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "background 120ms" }} onMouseEnter={(e) => { if (c.stage !== s) e.currentTarget.style.background = "#FAFAFA"; }} onMouseLeave={(e) => { if (c.stage !== s) e.currentTarget.style.background = "transparent"; }}>{s}</button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/company/candidates/${c.id}`)} style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>View Profile →</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
            <span style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>Showing 1–{Math.min(perPage, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ height: "36px", padding: "0 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "4px", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}><ChevronLeft size={14} /> Prev</button>
              <button style={{ height: "36px", padding: "0 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "4px", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Next <ChevronRight size={14} /></button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CompanyCandidates;
