import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart2,
  Globe,
  UserCheck,
  Settings,
  LogOut,
  Download,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Zap,
  Search,
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

// ─── Toggle Switch ───────────────────────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    {label && <span style={{ fontSize: "13px", color: "#374151", fontFamily: "Inter, sans-serif" }}>{label}</span>}
    <button onClick={onChange} style={{ width: "36px", height: "20px", borderRadius: "999px", background: checked ? "#F04E23" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 150ms", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  </div>
);

// ─── useCounter Hook ─────────────────────────────────────────────────────────
const useCounter = (target, duration = 1200) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    let start = 0;
    const step = target / (duration / 16);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(interval); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(interval);
  }, [target, duration]);
  return count;
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, suffix = "", color = "#0D0D0D", tooltip, loading }) => {
  const numericTarget = parseFloat(value);
  const animated = useCounter(loading ? 0 : numericTarget);
  const [showTip, setShowTip] = useState(false);
  const displayVal = String(value).includes(".") ? (loading ? "0.0" : animated.toFixed(1)) : (loading ? 0 : animated);
  return (
    <div
      style={{ flex: 1, background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px", position: "relative", transition: "border-color 150ms, transform 150ms", cursor: "default" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.transform = "translateY(-2px)"; setShowTip(true); }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.transform = "translateY(0)"; setShowTip(false); }}
    >
      <p style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", margin: "0 0 8px", fontFamily: "Inter, sans-serif" }}>{label}</p>
      {loading ? (
        <div className="shimmer" style={{ height: "28px", width: "60%", borderRadius: "6px" }} />
      ) : (
        <p style={{ fontFamily: "Times New Roman, serif", fontSize: "28px", fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{displayVal}{suffix}</p>
      )}
      {showTip && tooltip && !loading && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "white", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "8px 12px", fontSize: "12px", color: "#374151", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", zIndex: 10, fontFamily: "Inter, sans-serif" }}>{tooltip}</div>
      )}
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

// ─── Per-Job Mock Data ───────────────────────────────────────────────────────
const allFunnel = { Applied: 142, Screened: 67, Interviewed: 31, Shortlisted: 28, Decided: 14 };
const jobFunnels = {
  "Frontend Developer": { Applied: 34, Screened: 18, Interviewed: 12, Shortlisted: 10, Decided: 5 },
  "Backend Engineer":   { Applied: 28, Screened: 14, Interviewed: 9,  Shortlisted: 7,  Decided: 3 },
  "Product Designer":   { Applied: 22, Screened: 12, Interviewed: 8,  Shortlisted: 6,  Decided: 3 },
  "Data Scientist":     { Applied: 24, Screened: 10, Interviewed: 6,  Shortlisted: 5,  Decided: 2 },
};
const funnelColors = ["#F04E23", "#FCA68A", "#D97706", "#059669", "#0D9488"];

const allKpis = { applicants: 142, cvMatch: 72, interviewRate: 68, timeToShortlist: 4.2, acceptance: "81%", response: "1.8 Days", topSource: "Referrals", dropOff: "Interview Stage" };
const jobKpis = {
  "Frontend Developer": { applicants: 34, cvMatch: 78, interviewRate: 71, timeToShortlist: 3.2, acceptance: "85%", response: "1.5 Days", topSource: "LinkedIn", dropOff: "Screening Stage" },
  "Backend Engineer":   { applicants: 28, cvMatch: 72, interviewRate: 64, timeToShortlist: 4.1, acceptance: "78%", response: "2.1 Days", topSource: "Referrals", dropOff: "Interview Stage" },
  "Product Designer":   { applicants: 22, cvMatch: 81, interviewRate: 73, timeToShortlist: 2.8, acceptance: "90%", response: "1.2 Days", topSource: "Dribbble", dropOff: "Screening Stage" },
  "Data Scientist":     { applicants: 24, cvMatch: 69, interviewRate: 50, timeToShortlist: 5.3, acceptance: "67%", response: "2.6 Days", topSource: "Indeed", dropOff: "Technical Stage" },
};

const allCandidates = [
  { name: "Priya Patel", score: 91, badge: "AI Recommended", id: "c1", job: "Frontend Developer" },
  { name: "James Wilson", score: 87, badge: "Fast Responder", id: "c2", job: "Backend Engineer" },
  { name: "Ahmed Malik", score: 82, badge: "Top Community Match", id: "c3", job: "Frontend Developer" },
  { name: "Sarah Chen", score: 76, badge: null, id: "c4", job: "Product Designer" },
  { name: "Daniel Kim", score: 71, badge: null, id: "c5", job: "Data Scientist" },
  { name: "Maria Torres", score: 65, badge: null, id: "c6", job: "Backend Engineer" },
  { name: "Tom Evans", score: 58, badge: null, id: "c7", job: "Product Designer" },
  { name: "Lisa Nguyen", score: 44, badge: null, id: "c8", job: "Data Scientist" },
];

const jobComparison = [
  { title: "Frontend Developer", applicants: 34, avgScore: 78, interviews: 12, velocity: "3.2 days", velocityNum: 3.2, acceptance: "85%", acceptNum: 85, status: "Published", id: "1" },
  { title: "Backend Engineer", applicants: 28, avgScore: 72, interviews: 9, velocity: "4.1 days", velocityNum: 4.1, acceptance: "78%", acceptNum: 78, status: "Published", id: "2" },
  { title: "Product Designer", applicants: 22, avgScore: 81, interviews: 8, velocity: "2.8 days", velocityNum: 2.8, acceptance: "90%", acceptNum: 90, status: "Published", id: "3" },
  { title: "Data Scientist", applicants: 24, avgScore: 69, interviews: 6, velocity: "5.3 days", velocityNum: 5.3, acceptance: "67%", acceptNum: 67, status: "Published", id: "4" },
  { title: "DevOps Engineer", applicants: 0, avgScore: 0, interviews: 0, velocity: "—", velocityNum: 0, acceptance: "—", acceptNum: 0, status: "Draft", id: "5" },
  { title: "UX Researcher", applicants: 16, avgScore: 64, interviews: 5, velocity: "4.8 days", velocityNum: 4.8, acceptance: "60%", acceptNum: 60, status: "Closed", id: "6" },
];

// ─── Export Helpers ───────────────────────────────────────────────────────────
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV(kpis, funnel, candidates, jobs, filterLabel) {
  const lines = [];
  lines.push("IntelliHire — Recruitment Analytics Report");
  lines.push(`Filter: ${filterLabel}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("--- KPI Summary ---");
  lines.push("Metric,Value");
  lines.push(`Total Applicants,${kpis.applicants}`);
  lines.push(`Avg CV Match Score,${kpis.cvMatch}%`);
  lines.push(`Interview Completion Rate,${kpis.interviewRate}%`);
  lines.push(`Avg Time to Shortlist,${kpis.timeToShortlist} days`);
  lines.push(`Offer Acceptance Rate,${kpis.acceptance}`);
  lines.push(`Recruiter Response Time,${kpis.response}`);
  lines.push(`Top Source,${kpis.topSource}`);
  lines.push(`Drop-off Risk,${kpis.dropOff}`);
  lines.push("");
  lines.push("--- Hiring Funnel ---");
  lines.push("Stage,Count,Conversion %");
  funnel.forEach((s, i) => lines.push(`${s.stage},${s.count},${i === 0 ? "100%" : s.percent + "%"}`));
  lines.push("");
  lines.push("--- Top Candidates ---");
  lines.push("Name,Composite Score,Badge");
  candidates.forEach((c) => lines.push(`${c.name},${c.score},${c.badge || "—"}`));
  lines.push("");
  lines.push("--- Job Comparison ---");
  lines.push("Job Title,Applicants,Avg CV Score,Interviews,Velocity,Acceptance,Status");
  jobs.forEach((j) => lines.push(`${j.title},${j.applicants},${j.avgScore > 0 ? j.avgScore + "%" : "—"},${j.interviews},${j.velocity},${j.acceptance},${j.status}`));
  downloadBlob(lines.join("\n"), `intellihire-analytics-${Date.now()}.csv`, "text/csv;charset=utf-8;");
}

function exportPDF(kpis, funnel, candidates, jobs, filterLabel) {
  const html = `<!DOCTYPE html><html><head><title>IntelliHire Analytics Report</title>
<style>body{font-family:Inter,Arial,sans-serif;padding:40px;color:#0D0D0D;max-width:900px;margin:0 auto}
h1{font-family:'Times New Roman',serif;font-size:28px;margin-bottom:4px}h2{font-family:'Times New Roman',serif;font-size:18px;margin-top:32px;border-bottom:2px solid #F04E23;padding-bottom:6px}
.meta{color:#9CA3AF;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:12px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9CA3AF;padding:8px 12px;border-bottom:1px solid #E5E7EB}
td{padding:8px 12px;font-size:13px;border-bottom:1px solid #F3F4F6}.kpi-row{display:flex;gap:20px;margin-top:12px}
.kpi-box{flex:1;border:1px solid #E5E7EB;border-radius:8px;padding:16px}.kpi-label{font-size:11px;text-transform:uppercase;color:#9CA3AF;letter-spacing:0.06em}
.kpi-val{font-family:'Times New Roman',serif;font-size:24px;font-weight:700;margin-top:6px}
.green{color:#059669}.amber{color:#D97706}.red{color:#DC2626}.orange{color:#F04E23}
@media print{body{padding:20px}}</style></head><body>
<h1>Recruitment <span style="color:#F04E23;font-style:italic">Analytics</span></h1>
<p class="meta">Filter: ${filterLabel} · Generated: ${new Date().toLocaleString()}</p>
<h2>KPI Summary</h2>
<div class="kpi-row">
<div class="kpi-box"><div class="kpi-label">Total Applicants</div><div class="kpi-val">${kpis.applicants}</div></div>
<div class="kpi-box"><div class="kpi-label">Avg CV Match</div><div class="kpi-val orange">${kpis.cvMatch}%</div></div>
<div class="kpi-box"><div class="kpi-label">Interview Completion</div><div class="kpi-val">${kpis.interviewRate}%</div></div>
<div class="kpi-box"><div class="kpi-label">Avg Time to Shortlist</div><div class="kpi-val">${kpis.timeToShortlist} days</div></div>
</div>
<h2>Hiring Funnel</h2><table><thead><tr><th>Stage</th><th>Count</th><th>Conversion</th></tr></thead><tbody>
${funnel.map((s, i) => `<tr><td>${s.stage}</td><td>${s.count}</td><td>${i === 0 ? "—" : s.percent + "%"}</td></tr>`).join("")}
</tbody></table>
<h2>Top Candidates</h2><table><thead><tr><th>Name</th><th>Score</th><th>Badge</th></tr></thead><tbody>
${candidates.map((c) => `<tr><td>${c.name}</td><td>${c.score}</td><td>${c.badge || "—"}</td></tr>`).join("")}
</tbody></table>
<h2>Job Comparison</h2><table><thead><tr><th>Job</th><th>Applicants</th><th>Avg CV</th><th>Interviews</th><th>Velocity</th><th>Acceptance</th><th>Status</th></tr></thead><tbody>
${jobs.map((j) => `<tr><td>${j.title}</td><td>${j.applicants}</td><td class="${j.avgScore >= 75 ? "green" : j.avgScore >= 50 ? "amber" : "red"}">${j.avgScore > 0 ? j.avgScore + "%" : "—"}</td><td>${j.interviews}</td><td>${j.velocity}</td><td>${j.acceptance}</td><td>${j.status}</td></tr>`).join("")}
</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 400);
}

function exportSnapshot(kpis, funnel, candidates, filterLabel) {
  const lines = [];
  lines.push("═══════════════════════════════════════════════");
  lines.push("   INTELLIHIRE — MONTHLY ANALYTICS SNAPSHOT");
  lines.push("═══════════════════════════════════════════════");
  lines.push(`Filter: ${filterLabel}`);
  lines.push(`Period: ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("KEY METRICS");
  lines.push("───────────────────────────────────────────────");
  lines.push(`  Total Applicants ......... ${kpis.applicants}`);
  lines.push(`  Avg CV Match Score ....... ${kpis.cvMatch}%`);
  lines.push(`  Interview Completion ..... ${kpis.interviewRate}%`);
  lines.push(`  Avg Time to Shortlist .... ${kpis.timeToShortlist} days`);
  lines.push(`  Offer Acceptance Rate .... ${kpis.acceptance}`);
  lines.push(`  Recruiter Response Time .. ${kpis.response}`);
  lines.push(`  Top Candidate Source ..... ${kpis.topSource}`);
  lines.push(`  Drop-off Risk Stage ..... ${kpis.dropOff}`);
  lines.push("");
  lines.push("HIRING FUNNEL");
  lines.push("───────────────────────────────────────────────");
  funnel.forEach((s, i) => {
    const bar = "█".repeat(Math.round(s.count / 5)) + "░".repeat(Math.max(0, 28 - Math.round(s.count / 5)));
    lines.push(`  ${s.stage.padEnd(12)} ${bar} ${String(s.count).padStart(3)} ${i === 0 ? "    " : ("(" + s.percent + "%)").padStart(6)}`);
  });
  lines.push("");
  lines.push("TOP CANDIDATES");
  lines.push("───────────────────────────────────────────────");
  candidates.slice(0, 5).forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.name.padEnd(18)} Score: ${c.score}  ${c.badge ? "[" + c.badge + "]" : ""}`);
  });
  lines.push("");
  lines.push("═══════════════════════════════════════════════");
  lines.push("  AI INSIGHT: Hiring performance improved by 14% this month.");
  lines.push("  RECOMMENDATION: Review screening criteria for stages with <50% conversion.");
  lines.push("═══════════════════════════════════════════════");
  downloadBlob(lines.join("\n"), `intellihire-snapshot-${new Date().toISOString().slice(0, 7)}.txt`, "text/plain;charset=utf-8;");
}

// ─── Sort Keys ───────────────────────────────────────────────────────────────
const sortKeys = {
  "Job Title": (a, b) => a.title.localeCompare(b.title),
  Applicants: (a, b) => a.applicants - b.applicants,
  "Avg CV Score": (a, b) => a.avgScore - b.avgScore,
  Interviews: (a, b) => a.interviews - b.interviews,
  Velocity: (a, b) => a.velocityNum - b.velocityNum,
  Acceptance: (a, b) => a.acceptNum - b.acceptNum,
  Status: (a, b) => a.status.localeCompare(b.status),
};

function CompanyAnalytics() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("analytics");

  // Filter state (pending = user is editing, applied = committed)
  const [pendingJob, setPendingJob] = useState("All Jobs");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [appliedJob, setAppliedJob] = useState("All Jobs");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const [comparePrev, setComparePrev] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredFunnel, setHoveredFunnel] = useState(null);
  const [hoveredCandidate, setHoveredCandidate] = useState(null);
  const [tableSearch, setTableSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [exportToast, setExportToast] = useState("");

  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

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

  const scoreColor = (s) => { if (s >= 75) return "#059669"; if (s >= 50) return "#D97706"; return "#DC2626"; };

  const statusBadge = (status) => {
    const m = { Published: { bg: "#FFF4F1", color: "#F04E23" }, Draft: { bg: "#F3F4F6", color: "#6B7280" }, Closed: { bg: "#FEF2F2", color: "#DC2626" } };
    const s = m[status] || m.Draft;
    return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{status}</span>;
  };

  // ─── Derived Filtered Data ─────────────────────────────────────────────────
  const filterLabel = useMemo(() => {
    let label = appliedJob;
    if (appliedFrom) label += ` · From ${appliedFrom}`;
    if (appliedTo) label += ` · To ${appliedTo}`;
    return label;
  }, [appliedJob, appliedFrom, appliedTo]);

  const kpis = useMemo(() => {
    return appliedJob === "All Jobs" ? allKpis : (jobKpis[appliedJob] || allKpis);
  }, [appliedJob]);

  const funnel = useMemo(() => {
    const raw = appliedJob === "All Jobs" ? allFunnel : (jobFunnels[appliedJob] || allFunnel);
    const stages = Object.entries(raw);
    return stages.map(([stage, count], i) => {
      const prev = i === 0 ? count : stages[i - 1][1];
      const percent = i === 0 ? 100 : Math.round((count / prev) * 100);
      return { stage, count, percent, color: funnelColors[i] || "#F04E23" };
    });
  }, [appliedJob]);

  const candidates = useMemo(() => {
    const list = appliedJob === "All Jobs" ? allCandidates : allCandidates.filter((c) => c.job === appliedJob);
    return [...list].sort((a, b) => b.score - a.score);
  }, [appliedJob]);

  const maxFunnelCount = useMemo(() => Math.max(...funnel.map((s) => s.count), 1), [funnel]);

  const filteredJobs = useMemo(() => {
    let list = [...jobComparison];
    if (tableSearch.trim()) list = list.filter((j) => j.title.toLowerCase().includes(tableSearch.toLowerCase()));
    if (sortCol && sortKeys[sortCol]) {
      list.sort(sortKeys[sortCol]);
      if (!sortAsc) list.reverse();
    }
    return list;
  }, [tableSearch, sortCol, sortAsc]);

  // ─── Apply / Reset ────────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setAppliedJob(pendingJob);
      setAppliedFrom(pendingFrom);
      setAppliedTo(pendingTo);
      setLoading(false);
    }, 400);
  }, [pendingJob, pendingFrom, pendingTo]);

  const handleReset = useCallback(() => {
    setPendingJob("All Jobs");
    setPendingFrom("");
    setPendingTo("");
    setLoading(true);
    setTimeout(() => {
      setAppliedJob("All Jobs");
      setAppliedFrom("");
      setAppliedTo("");
      setLoading(false);
    }, 400);
  }, []);

  // ─── Export Handlers ───────────────────────────────────────────────────────
  const showToast = (msg) => { setExportToast(msg); setTimeout(() => setExportToast(""), 3000); };

  const handleExport = useCallback((type) => {
    setShowExport(false);
    if (type === "CSV Export") {
      exportCSV(kpis, funnel, candidates, filteredJobs, filterLabel);
      showToast("CSV exported successfully");
    } else if (type === "PDF Report") {
      exportPDF(kpis, funnel, candidates, filteredJobs, filterLabel);
      showToast("PDF report opened for printing");
    } else if (type === "Monthly Snapshot") {
      exportSnapshot(kpis, funnel, candidates, filterLabel);
      showToast("Monthly snapshot downloaded");
    }
  }, [kpis, funnel, candidates, filteredJobs, filterLabel]);

  const handleSort = (col) => {
    if (!sortKeys[col]) return;
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .shimmer { background: linear-gradient(90deg, #F3F4F6 25%, #FAFAFA 50%, #F3F4F6 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .job-row:hover { transform: translateY(-1px); border-color: #D1D5DB !important; }
        .sort-th { cursor: pointer; user-select: none; }
        .sort-th:hover { color: #F04E23 !important; }
      `}</style>

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
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top Bar */}
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
              Recruitment <em style={{ color: "#F04E23", fontStyle: "italic" }}>Analytics</em>
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <ToggleSwitch checked={comparePrev} onChange={() => setComparePrev(!comparePrev)} label="Compare Previous" />
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowExport(!showExport)} style={{ height: "36px", padding: "0 14px", background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "6px", color: "#374151", transition: "border-color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}>
                <Download size={14} /> Export Report <ChevronDown size={12} />
              </button>
              {showExport && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20, minWidth: "160px", animation: "fadeIn 150ms ease" }}>
                  {["PDF Report", "CSV Export", "Monthly Snapshot"].map((o) => (
                    <button key={o} onClick={() => handleExport(o)} style={{ display: "block", width: "100%", padding: "8px 12px", fontSize: "13px", color: "#374151", background: "transparent", border: "none", borderRadius: "4px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "background 120ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF4F1")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{o}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }} onClick={() => showExport && setShowExport(false)}>
          {/* Subtext + AI Insight */}
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "14px", color: "#9CA3AF", margin: "0 0 10px" }}>View your hiring performance and pipeline insights</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "white", border: "1px solid #E5E7EB", borderLeft: "3px solid #F04E23", borderRadius: "6px", padding: "8px 14px" }}>
              <TrendingUp size={14} style={{ color: "#F04E23" }} />
              <span style={{ fontSize: "13px", color: "#374151" }}>Hiring performance improved by <strong style={{ color: "#F04E23" }}>14%</strong> this month</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", color: "#374151", whiteSpace: "nowrap" }}>View data for:</span>
            <div style={{ position: "relative", width: "200px" }}>
              <select value={pendingJob} onChange={(e) => setPendingJob(e.target.value)} className="field-input" style={{ width: "100%", height: "36px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 32px 0 12px", fontSize: "13px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
                <option>All Jobs</option>
                <option>Frontend Developer</option>
                <option>Backend Engineer</option>
                <option>Product Designer</option>
                <option>Data Scientist</option>
              </select>
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
            </div>
            <input type="date" value={pendingFrom} onChange={(e) => setPendingFrom(e.target.value)} className="field-input" style={{ width: "150px", height: "36px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "13px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif" }} />
            <input type="date" value={pendingTo} onChange={(e) => setPendingTo(e.target.value)} className="field-input" style={{ width: "150px", height: "36px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 10px", fontSize: "13px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif" }} />
            <button onClick={handleApply} style={{ height: "36px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Apply</button>
            <button onClick={handleReset} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Reset</button>
          </div>

          {/* Active filter indicator */}
          {appliedJob !== "All Jobs" && (
            <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", animation: "slideDown 200ms ease" }}>
              <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Showing data for:</span>
              <span style={{ fontSize: "12px", fontWeight: 500, background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", padding: "3px 10px" }}>{appliedJob}</span>
              {appliedFrom && <span style={{ fontSize: "12px", color: "#374151" }}>from {appliedFrom}</span>}
              {appliedTo && <span style={{ fontSize: "12px", color: "#374151" }}>to {appliedTo}</span>}
            </div>
          )}

          {/* KPI Cards */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
            <KpiCard label="Total Applicants" value={String(kpis.applicants)} loading={loading} tooltip="Total applications received across all jobs" />
            <KpiCard label="Avg CV Match Score" value={String(kpis.cvMatch)} suffix="%" color="#F04E23" loading={loading} tooltip="Average AI-generated CV match score" />
            <KpiCard label="Interview Completion" value={String(kpis.interviewRate)} suffix="%" loading={loading} tooltip="Percentage of scheduled interviews completed" />
            <KpiCard label="Avg Time to Shortlist" value={String(kpis.timeToShortlist)} suffix=" days" loading={loading} tooltip="Average days from application to shortlist" />
          </div>

          {/* Micro Metrics */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "28px", flexWrap: "wrap" }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer" style={{ height: "26px", width: "140px", borderRadius: "999px" }} />)
            ) : (
              [
                { label: "Offer Acceptance", value: kpis.acceptance, color: "#059669" },
                { label: "Recruiter Response", value: kpis.response, color: "#374151" },
                { label: "Top Source", value: kpis.topSource, color: "#F04E23" },
                { label: "Drop-off Risk", value: kpis.dropOff, color: "#D97706" },
              ].map((m) => (
                <span key={m.label} style={{ fontSize: "12px", fontFamily: "Inter, sans-serif", background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "999px", padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: "6px", animation: "fadeIn 300ms ease" }}>
                  <span style={{ color: "#9CA3AF" }}>{m.label}:</span>
                  <span style={{ fontWeight: 500, color: m.color }}>{m.value}</span>
                </span>
              ))
            )}
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", marginBottom: "28px" }}>
            {/* Left — Hiring Funnel */}
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: 0 }}>Hiring Funnel</h3>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{appliedJob} · Last 30 Days</span>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer" style={{ height: "24px", borderRadius: "6px" }} />)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {funnel.map((s, i) => {
                    const barWidth = `${(s.count / maxFunnelCount) * 100}%`;
                    const isWeak = s.percent < 50 && i > 0;
                    return (
                      <div key={s.stage} style={{ position: "relative", animation: `fadeIn 300ms ease ${i * 60}ms both` }} onMouseEnter={() => setHoveredFunnel(i)} onMouseLeave={() => setHoveredFunnel(null)}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ width: "90px", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", flexShrink: 0 }}>{s.stage}</span>
                          <div style={{ flex: 1, height: "24px", background: "#F9FAFB", borderRadius: "6px", overflow: "hidden", position: "relative" }}>
                            <div style={{ width: barWidth, height: "100%", background: s.color, borderRadius: "6px", transition: `width 700ms ease ${i * 100}ms` }} />
                          </div>
                          <span style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", fontWeight: 700, color: "#0D0D0D", minWidth: "40px", textAlign: "right" }}>{s.count}</span>
                          {i > 0 && (
                            <span style={{ fontSize: "12px", fontWeight: 500, color: isWeak ? "#D97706" : "#059669", minWidth: "40px", textAlign: "right" }}>{s.percent}%</span>
                          )}
                        </div>
                        {isWeak && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", marginLeft: "102px" }}>
                            <Zap size={11} style={{ color: "#F04E23" }} />
                            <span style={{ fontSize: "11px", color: "#F04E23", fontStyle: "italic" }}>Review screening criteria</span>
                          </div>
                        )}
                        {hoveredFunnel === i && (
                          <div style={{ position: "absolute", top: "-44px", left: "102px", background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px", color: "#374151", zIndex: 10, whiteSpace: "nowrap", animation: "fadeIn 150ms ease" }}>
                            Stage: {s.stage} | {s.count} candidates{i > 0 ? ` | ${s.percent}% of previous` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right — Top Candidates */}
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: 0 }}>Top Candidates</h3>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>By Composite Score</span>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer" style={{ height: "16px", borderRadius: "999px" }} />)}
                </div>
              ) : candidates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: "14px", color: "#9CA3AF" }}>No candidates found for this filter</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {candidates.map((c, i) => (
                    <div
                      key={c.id}
                      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 0", borderRadius: "4px", transition: "background 120ms", animation: `fadeIn 300ms ease ${i * 40}ms both` }}
                      onMouseEnter={() => setHoveredCandidate(i)}
                      onMouseLeave={() => setHoveredCandidate(null)}
                      onClick={() => navigate(`/company/candidates/${c.id}`)}
                    >
                      <span style={{ width: "100px", fontSize: "13px", color: hoveredCandidate === i ? "#F04E23" : "#374151", transition: "color 120ms", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{c.name}</span>
                      {c.badge && <span style={{ fontSize: "9px", fontWeight: 500, background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{c.badge}</span>}
                      <div style={{ flex: 1, height: "8px", background: "#F3F4F6", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ width: `${c.score}%`, height: "100%", background: hoveredCandidate === i ? "#D43D14" : "#F04E23", borderRadius: "999px", transition: `width 600ms ease ${i * 60}ms, background 120ms` }} />
                      </div>
                      <span style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", fontWeight: 700, color: "#0D0D0D", minWidth: "32px", textAlign: "right" }}>{c.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Job Comparison Table */}
          <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: 0, flexShrink: 0 }}>Job Comparison</h3>
              <div style={{ position: "relative", width: "240px" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Search jobs…" className="field-input" style={{ width: "100%", height: "36px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px 0 34px", fontSize: "13px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA" }}>
                  {["Job Title", "Applicants", "Avg CV Score", "Interviews", "Velocity", "Acceptance", "Status", ""].map((col) => (
                    <th key={col} className={sortKeys[col] ? "sort-th" : ""} onClick={() => handleSort(col)} style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: sortCol === col ? "#F04E23" : "#9CA3AF", textAlign: "left", padding: "12px 16px", fontFamily: "Inter, sans-serif", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB", transition: "color 120ms" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {col}
                        {sortCol === col && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", fontSize: "14px", color: "#9CA3AF" }}>No jobs match your search</td></tr>
                ) : filteredJobs.map((job, i) => (
                  <tr key={job.id} className="job-row" style={{ borderBottom: i < filteredJobs.length - 1 ? "1px solid #F3F4F6" : "none", transition: "transform 150ms, border-color 150ms", cursor: "pointer" }} onClick={() => navigate(`/company/jobs/${job.id}/candidates`)}>
                    <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 500, color: "#0D0D0D" }}>{job.title}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{job.applicants}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 500, color: scoreColor(job.avgScore) }}>{job.avgScore > 0 ? `${job.avgScore}%` : "—"}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{job.interviews}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{job.velocity}</td>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#374151" }}>{job.acceptance}</td>
                    <td style={{ padding: "14px 16px" }}>{statusBadge(job.status)}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/company/jobs/${job.id}/candidates`); }} style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── EXPORT TOAST ── */}
      {exportToast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "#059669", color: "white", borderRadius: "8px", padding: "12px 20px", fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200, animation: "slideDown 200ms ease", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>✓</span> {exportToast}
        </div>
      )}
    </div>
  );
}

export default CompanyAnalytics;
