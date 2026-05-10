import { useState, useEffect, useRef, useCallback } from "react";
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
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { candidateProfiles, candidatesList, getSavedStages, saveStage, stageOrder, stageBadgeStyle } from "../../data/candidatesData";

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

// ─── Circular Progress Arc ───────────────────────────────────────────────────
const CircularScore = ({ score, size = 80, strokeWidth = 5, color = "#059669" }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 800ms ease" }} />
    </svg>
  );
};

// ─── Animated Bar ────────────────────────────────────────────────────────────
const AnimatedBar = ({ value, color = "#F04E23", animate }) => (
  <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: "#F3F4F6", overflow: "hidden" }}>
    <div style={{ width: animate ? `${value}%` : "0%", height: "100%", borderRadius: "999px", background: color, transition: "width 800ms ease" }} />
  </div>
);

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

function CompanyCandidateProfile() {
  const navigate = useNavigate();
  const { id: candidateId } = useParams();
  const [activeNav, setActiveNav] = useState("candidates");
  const [activeTab, setActiveTab] = useState("overview");
  const [animateBars, setAnimateBars] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedQ, setExpandedQ] = useState({});
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const tabRef = useRef(null);

  const cData = candidateProfiles[candidateId] || candidateProfiles.c1;
  const defaultStage = cData ? (getSavedStages()[candidateId] || "Applied") : "Applied";
  const [currentStage, setCurrentStage] = useState(defaultStage);

  useEffect(() => {
    const saved = getSavedStages();
    const listItem = candidatesList.find((c) => c.id === candidateId);
    setCurrentStage(saved[candidateId] || (listItem ? listItem.defaultStage : "Applied"));
  }, [candidateId]);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateBars(true), 300);
    return () => clearTimeout(timer);
  }, [activeTab]);

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

  const toggleQ = (key) => setExpandedQ((p) => ({ ...p, [key]: !p[key] }));
  const tabs = ["overview", "cv-analysis", "screening", "technical"];
  const tabLabels = { overview: "Overview", "cv-analysis": "CV Analysis", screening: "Screening Interview", technical: "Technical Interview" };
  const scoreColor = (s) => { if (s >= 80) return "#059669"; if (s >= 60) return "#D97706"; return "#DC2626"; };

  // ─── Stage Actions ─────────────────────────────────────────────────────────
  const handleMoveNext = () => {
    if (currentStage === "Rejected" || currentStage === "On Hold") {
      setCurrentStage("Applied"); saveStage(candidateId, "Applied");
      showToast(`${cData.name} moved back to Applied`, "info"); return;
    }
    const idx = stageOrder.indexOf(currentStage);
    if (idx < stageOrder.length - 1) {
      const next = stageOrder[idx + 1];
      setCurrentStage(next); saveStage(candidateId, next);
      showToast(`${cData.name} moved to ${next}`);
    } else {
      showToast(`${cData.name} is already at the final stage`, "warning");
    }
  };

  const handleHold = () => {
    if (currentStage === "On Hold") { showToast(`${cData.name} is already on hold`, "warning"); return; }
    setCurrentStage("On Hold"); saveStage(candidateId, "On Hold");
    showToast(`${cData.name} put on hold`, "warning");
  };

  const handleReject = () => {
    setCurrentStage("Rejected"); saveStage(candidateId, "Rejected");
    setShowRejectModal(false); setRejectReason("");
    showToast(`${cData.name} marked as rejected`, "error");
  };

  const stBadge = stageBadgeStyle[currentStage] || stageBadgeStyle.Applied;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .tab-btn { position: relative; background: none; border: none; cursor: pointer; font-family: Inter, sans-serif; font-size: 14px; font-weight: 500; color: #9CA3AF; padding: 10px 0; transition: color 150ms; }
        .tab-btn.active { color: #0D0D0D; }
        .tab-btn.active::after { content: ''; position: absolute; left: 0; bottom: 0; width: 100%; height: 2px; background: #F04E23; border-radius: 1px; }
        .tab-btn:hover { color: #0D0D0D; }
        .accordion-card { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; transition: border-color 150ms; }
        .accordion-card:hover { border-color: #D1D5DB; }
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
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Candidate <em style={{ color: "#F04E23", fontStyle: "italic" }}>Profile</em>
          </h1>
        </header>

        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 32px 0", display: "flex", alignItems: "center", gap: "6px" }}>
            <button onClick={() => navigate(-1)} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Candidates</button>
            <span style={{ color: "#9CA3AF", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D" }}>{cData.name}</span>
          </div>

          <div style={{ padding: "8px 32px 20px" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "26px", color: "#0D0D0D", margin: 0 }}>{cData.name} — {cData.role}</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px", padding: "0 32px 24px", flex: 1 }}>

            {/* ── LEFT — Profile Card ── */}
            <div style={{ position: "sticky", top: "80px", alignSelf: "start" }}>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", background: "white", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Times New Roman, serif", fontSize: "24px", fontWeight: 700, marginBottom: "12px" }}>{cData.initials}</div>
                <p style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: "#0D0D0D", margin: "0 0 4px", textAlign: "center" }}>{cData.name}</p>
                <p style={{ fontSize: "14px", color: "#374151", margin: "0 0 8px", textAlign: "center" }}>{cData.role}</p>
                <span style={{ background: stBadge.bg, color: stBadge.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", marginBottom: "16px", transition: "all 200ms ease" }}>{currentStage}</span>

                <div style={{ position: "relative", width: "80px", height: "80px", marginBottom: "4px" }}>
                  <CircularScore score={cData.cvScore} color={scoreColor(cData.cvScore)} />
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Times New Roman, serif", fontSize: "24px", fontWeight: 700, color: scoreColor(cData.cvScore) }}>{cData.cvScore}%</span>
                </div>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 16px" }}>CV Match Score</p>

                <div style={{ width: "100%", height: "1px", background: "#E5E7EB", marginBottom: "16px" }} />

                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  <a href={`mailto:${cData.email}`} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", textDecoration: "none", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}>
                    <Mail size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} /> {cData.email}
                  </a>
                  <a href={`tel:${cData.phone}`} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", textDecoration: "none", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}>
                    <Phone size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} /> {cData.phone}
                  </a>
                </div>
                <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 4px", width: "100%" }}>Applied: {cData.applied}</p>
              </div>
            </div>

            {/* ── RIGHT — Tabbed Evaluation ── */}
            <div>
              <div ref={tabRef} style={{ display: "flex", gap: "24px", borderBottom: "1px solid #E5E7EB", marginBottom: "24px" }}>
                {tabs.map((t) => (
                  <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => { setActiveTab(t); setAnimateBars(false); setTimeout(() => setAnimateBars(true), 100); }}>
                    {tabLabels[t]}
                  </button>
                ))}
              </div>

              {/* ── Overview Tab ── */}
              {activeTab === "overview" && (
                <div style={{ animation: "fadeIn 250ms ease" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                    {[
                      { label: "CV Match", value: `${cData.cvScore}%`, color: scoreColor(cData.cvScore) },
                      { label: "Screening Score", value: `${cData.screeningScore}/100`, color: scoreColor(cData.screeningScore) },
                      { label: "Technical Score", value: `${cData.technicalScore}/100`, color: scoreColor(cData.technicalScore) },
                      { label: "Composite Score", value: `${cData.compositeScore}/100`, color: scoreColor(cData.compositeScore), large: true },
                    ].map((card, i) => (
                      <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", margin: "0 0 8px" }}>{card.label}</p>
                        <p style={{ fontFamily: "Times New Roman, serif", fontSize: card.large ? "36px" : "32px", fontWeight: 700, color: card.color, margin: 0, lineHeight: 1 }}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F04E23", display: "inline-block" }} />
                      <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#F04E23" }}>AI Verdict</span>
                    </div>
                    <p style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", color: "#374151", fontStyle: "italic", margin: "0 0 12px", lineHeight: 1.6 }}>{cData.aiVerdict}</p>
                    <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>Generated by IntelliHire AI</p>
                  </div>
                </div>
              )}

              {/* ── CV Analysis Tab ── */}
              {activeTab === "cv-analysis" && (
                <div style={{ animation: "fadeIn 250ms ease", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#0D0D0D", margin: "0 0 12px" }}>Extracted Skills</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {cData.matchedSkills.map((s) => (
                        <span key={s} style={{ background: "#F0FDF4", color: "#059669", borderRadius: "999px", fontSize: "12px", fontWeight: 500, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>✅ {s}</span>
                      ))}
                      {cData.unmatchedSkills.map((s) => (
                        <span key={s} style={{ background: "#FEF2F2", color: "#DC2626", borderRadius: "999px", fontSize: "12px", fontWeight: 500, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>❌ {s}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#0D0D0D", margin: "0 0 12px" }}>Education</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {cData.education.map((e, i) => (
                        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: e.recent ? "#F04E23" : "#D1D5DB", display: "block" }} />
                            {i < cData.education.length - 1 && <span style={{ width: "1px", height: "24px", background: "#E5E7EB", display: "block", marginTop: "4px" }} />}
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{e.institution}</p>
                            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>{e.degree} · {e.year}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#0D0D0D", margin: "0 0 12px" }}>Work Experience</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {cData.experience.map((e, i) => (
                        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: e.recent ? "#F04E23" : "#D1D5DB", display: "block" }} />
                            {i < cData.experience.length - 1 && <span style={{ width: "1px", height: "24px", background: "#E5E7EB", display: "block", marginTop: "4px" }} />}
                          </div>
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{e.company}</p>
                            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>{e.role} · {e.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: "#FFF4F1", border: "1px solid #FCA68A", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "14px", color: "#374151", margin: 0, lineHeight: 1.7 }}>{cData.aiHighlight}</p>
                  </div>
                </div>
              )}

              {/* ── Screening Interview Tab ── */}
              {activeTab === "screening" && (
                <div style={{ animation: "fadeIn 250ms ease" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
                    <div style={{ position: "relative", width: "80px", height: "80px" }}>
                      <CircularScore score={cData.screeningScore} color={scoreColor(cData.screeningScore)} />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: scoreColor(cData.screeningScore) }}>{cData.screeningScore}/100</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "28px" }}>
                    {cData.screeningSubs.map((s) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", width: "120px", flexShrink: 0 }}>{s.label}</span>
                        <AnimatedBar value={s.value} animate={animateBars} />
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", minWidth: "36px", textAlign: "right" }}>{s.value}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                    {cData.screeningQA.map((qa, i) => {
                      const key = `s-${i}`;
                      const open = expandedQ[key];
                      return (
                        <div key={key} className="accordion-card">
                          <button onClick={() => toggleQ(key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: open ? "#FFF4F1" : "white", border: "none", cursor: "pointer", transition: "background 150ms" }}>
                            <span style={{ fontSize: "14px", color: "#F04E23", fontWeight: 500, textAlign: "left", fontFamily: "Inter, sans-serif" }}>{qa.q}</span>
                            {open ? <ChevronUp size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} />}
                          </button>
                          {open && <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E7EB", fontSize: "14px", color: "#374151", lineHeight: 1.7, animation: "fadeIn 150ms ease" }}>{qa.a}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", margin: "0 0 8px" }}>AI Key Observations</p>
                    <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: "14px", color: "#374151", fontStyle: "italic", lineHeight: 1.8 }}>
                      {cData.screeningObs.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* ── Technical Interview Tab ── */}
              {activeTab === "technical" && (
                <div style={{ animation: "fadeIn 250ms ease" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
                    <div style={{ position: "relative", width: "80px", height: "80px" }}>
                      <CircularScore score={cData.technicalScore} color={scoreColor(cData.technicalScore)} />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: scoreColor(cData.technicalScore) }}>{cData.technicalScore}/100</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "28px" }}>
                    {cData.technicalSubs.map((s) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", width: "120px", flexShrink: 0 }}>{s.label}</span>
                        <AnimatedBar value={s.value} color={s.color} animate={animateBars} />
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", minWidth: "36px", textAlign: "right" }}>{s.value}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                    {cData.technicalQA.map((qa, i) => {
                      const key = `t-${i}`;
                      const open = expandedQ[key];
                      return (
                        <div key={key} className="accordion-card">
                          <button onClick={() => toggleQ(key)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: open ? "#FFF4F1" : "white", border: "none", cursor: "pointer", transition: "background 150ms" }}>
                            <span style={{ fontSize: "14px", color: "#F04E23", fontWeight: 500, textAlign: "left", fontFamily: "Inter, sans-serif" }}>{qa.q}</span>
                            {open ? <ChevronUp size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} />}
                          </button>
                          {open && <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E7EB", fontSize: "14px", color: "#374151", lineHeight: 1.7, animation: "fadeIn 150ms ease" }}>{qa.a}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "16px" }}>
                    <p style={{ fontSize: "14px", color: "#374151", fontStyle: "italic", margin: 0, lineHeight: 1.7 }}>{cData.technicalNote}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ACTION BUTTONS ROW ── */}
          <div style={{ borderTop: "1px solid #E5E7EB", padding: "16px 32px", background: "white", display: "flex", alignItems: "center", gap: "12px", position: "sticky", bottom: 0, zIndex: 30 }}>
            <button onClick={handleMoveNext} style={{ height: "40px", padding: "0 20px", background: currentStage === "Decided" ? "#E5E7EB" : "#F04E23", color: currentStage === "Decided" ? "#9CA3AF" : "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: currentStage === "Decided" ? "default" : "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => { if (currentStage !== "Decided") e.currentTarget.style.background = "#D43D14"; }} onMouseLeave={(e) => { if (currentStage !== "Decided") e.currentTarget.style.background = "#F04E23"; }}>
              {currentStage === "Rejected" || currentStage === "On Hold" ? "Reactivate →" : "Move to Next Stage →"}
            </button>
            <button onClick={handleHold} style={{ height: "40px", padding: "0 20px", background: currentStage === "On Hold" ? "#FFFBEB" : "white", color: currentStage === "On Hold" ? "#D97706" : "#374151", border: `1px solid ${currentStage === "On Hold" ? "#FDE68A" : "#E5E7EB"}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = currentStage === "On Hold" ? "#FDE68A" : "#E5E7EB"; e.currentTarget.style.color = currentStage === "On Hold" ? "#D97706" : "#374151"; }}>
              Put on Hold
            </button>
            <button onClick={() => currentStage !== "Rejected" && setShowRejectModal(true)} style={{ height: "40px", padding: "0 20px", background: currentStage === "Rejected" ? "#FEF2F2" : "white", color: "#DC2626", border: `1px solid ${currentStage === "Rejected" ? "#FECACA" : "#FCA5A5"}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: currentStage === "Rejected" ? "default" : "pointer", fontFamily: "Inter, sans-serif", marginLeft: "auto", transition: "background 150ms" }} onMouseEnter={(e) => { if (currentStage !== "Rejected") e.currentTarget.style.background = "#FEF2F2"; }} onMouseLeave={(e) => { if (currentStage !== "Rejected") e.currentTarget.style.background = "white"; }}>
              {currentStage === "Rejected" ? "Rejected" : "Mark as Rejected"}
            </button>
          </div>
        </main>
      </div>

      {/* ── REJECT MODAL ── */}
      {showRejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowRejectModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "440px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 8px" }}>Mark {cData.name} as Rejected?</h2>
            <p style={{ fontSize: "14px", color: "#374151", margin: "0 0 20px" }}>Please provide a reason — this will be logged for compliance.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="field-input" placeholder="Enter reason for rejection…" style={{ width: "100%", minHeight: "100px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "12px", fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", marginBottom: "20px" }}>
              <span style={{ fontSize: "12px", color: rejectReason.length < 20 ? "#DC2626" : "#9CA3AF" }}>{rejectReason.length}/20 min characters</span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button disabled={rejectReason.length < 20} onClick={handleReject} style={{ height: "40px", padding: "0 20px", background: rejectReason.length < 20 ? "#F3F4F6" : "#DC2626", color: rejectReason.length < 20 ? "#9CA3AF" : "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: rejectReason.length < 20 ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
                Confirm Rejection
              </button>
              <button onClick={() => setShowRejectModal(false)} style={{ fontSize: "14px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyCandidateProfile;
