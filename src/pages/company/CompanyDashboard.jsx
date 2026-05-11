import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart2,
  Globe,
  UserCheck,
  Settings,
  LogOut,
  Plus,
  X,
  ChevronDown,
  ClipboardList,
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

// ─── KPI Counter Hook ─────────────────────────────────────────────────────────
function useCounter(target, duration = 1200, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ target, label, link, valueColor, index, onVisible }) => {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 80);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [index]);

  const count = useCounter(target, 1200, visible);

  return (
    <div
      ref={cardRef}
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: "10px",
        padding: "24px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 400ms ease ${index * 80}ms, transform 400ms ease ${index * 80}ms, border-color 150ms, box-shadow 150ms`,
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#D1D5DB";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          fontFamily: "Times New Roman, serif",
          fontSize: "40px",
          color: valueColor || "#0D0D0D",
          lineHeight: 1,
          marginBottom: "8px",
        }}
      >
        {count}
      </div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.07em",
          color: "#9CA3AF",
          textTransform: "uppercase",
          fontFamily: "Inter, sans-serif",
          marginBottom: "12px",
        }}
      >
        {label}
      </div>
      {link && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            style={{
              fontSize: "13px",
              color: "#F04E23",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              padding: 0,
            }}
          >
            {link}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    Published: { bg: "#FFF4F1", color: "#F04E23" },
    Draft: { bg: "#F3F4F6", color: "#6B7280" },
    Closed: { bg: "#FEF2F2", color: "#DC2626" },
  };
  const s = styles[status] || styles.Draft;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 500,
        padding: "3px 10px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {status}
    </span>
  );
};

// ─── Pipeline Segment ─────────────────────────────────────────────────────────
const PipelineSegment = ({ label, count, pct, color, total, isFirst, isLast }) => {
  const [tooltip, setTooltip] = useState(false);
  const pctOfTotal = Math.round((count / total) * 100);
  const barWidth = Math.max((count / total) * 100, 8);

  return (
    <div
      style={{ flex: 1, position: "relative", minWidth: 0 }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "6px",
          fontFamily: "Inter, sans-serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </p>
      <div
        style={{
          height: "28px",
          background: color,
          borderRadius: isFirst
            ? "6px 0 0 6px"
            : isLast
            ? "0 6px 6px 0"
            : "0",
          width: `${barWidth}%`,
          opacity: 0.82,
          cursor: "default",
          transition: "opacity 150ms",
          minWidth: "12px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.82")}
      />
      <div
        style={{
          fontFamily: "Times New Roman, serif",
          fontSize: "18px",
          color: "#0D0D0D",
          marginTop: "6px",
        }}
      >
        {count}
      </div>
      {pct && (
        <div
          style={{
            fontSize: "11px",
            color: parseFloat(pct) > 30 ? "#D97706" : "#059669",
            fontFamily: "Inter, sans-serif",
            marginTop: "2px",
          }}
        >
          {pct}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "#374151",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 10,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <strong style={{ color: "#0D0D0D" }}>{count}</strong> candidates —{" "}
          <span style={{ color: "#9CA3AF" }}>{pctOfTotal}% of total</span>
        </div>
      )}
    </div>
  );
};

// ─── Activity Dot ─────────────────────────────────────────────────────────────
const activityDotColor = (type) => {
  if (type === "applicant") return "#F04E23";
  if (type === "job") return "#059669";
  return "#9CA3AF";
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const jobRows = [
  { title: "Frontend Developer", applicants: 34, status: "Published", posted: "Apr 28, 2025" },
  { title: "Backend Engineer", applicants: 28, status: "Published", posted: "May 1, 2025" },
  { title: "Product Designer", applicants: 22, status: "Published", posted: "May 3, 2025" },
  { title: "DevOps Engineer", applicants: 0, status: "Draft", posted: "May 5, 2025" },
  { title: "UX Researcher", applicants: 16, status: "Closed", posted: "Apr 10, 2025" },
];

const pipelineData = [
  { label: "Applied", count: 142, pct: null, color: "#F04E23" },
  { label: "Screened", count: 67, pct: "↓53%", color: "#F59E0B" },
  { label: "Interviewed", count: 31, pct: "↓54%", color: "#EAB308" },
  { label: "Shortlisted", count: 28, pct: "↓10%", color: "#10B981" },
  { label: "Decided", count: 14, pct: "↓50%", color: "#059669" },
];

const activityItems = [
  { type: "applicant", text: "New application — Priya Patel, Frontend Developer", time: "2h ago", link: true },
  { type: "applicant", text: "Interview completed — James Wilson: 79/100", time: "5h ago", link: true },
  { type: "job", text: "3 candidates shortlisted — Backend Engineer", time: "Yesterday", link: true },
  { type: "job", text: 'Job "UX Researcher" closed by Sarah', time: "2 days ago", link: false },
  { type: "team", text: "New team member invited — recruiter@acmecorp.com", time: "3 days ago", link: false },
  { type: "applicant", text: "New application — Daniel Osei, Product Designer", time: "3 days ago", link: true },
  { type: "job", text: "Backend Engineer job posted", time: "4 days ago", link: false },
  { type: "team", text: "Mike Brown accepted team invitation", time: "5 days ago", link: false },
];

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "community", label: "Community", icon: Globe },
  { id: "team", label: "Team", icon: UserCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

function CompanyDashboard() {
  const navigate = useNavigate();
  const logout = useLogout();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [showBanner, setShowBanner] = useState(true);
  const [bannerExiting, setBannerExiting] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [profileComplete] = useState(false);

  const handleDismissBanner = () => {
    setBannerExiting(true);
    setTimeout(() => setShowBanner(false), 300);
  };

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "jobs") navigate("/company/jobs");
    if (id === "candidates") navigate("/company/candidates");
    if (id === "team") navigate("/company/team");
    if (id === "analytics") navigate("/company/analytics");
    if (id === "community") navigate("/company/community");
    if (id === "settings") navigate("/company/settings");
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "Inter, sans-serif" }}
      onClick={() => showUserDropdown && setShowUserDropdown(false)}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 80px; }
        }
        @keyframes slideUp {
          from { opacity: 1; transform: translateY(0); max-height: 80px; }
          to { opacity: 0; transform: translateY(-10px); max-height: 0; }
        }
        .banner-enter { animation: slideDown 300ms ease forwards; }
        .banner-exit { animation: slideUp 300ms ease forwards; }
        .activity-scroll::-webkit-scrollbar { width: 5px; }
        .activity-scroll::-webkit-scrollbar-track { background: #E5E7EB; border-radius: 999px; }
        .activity-scroll::-webkit-scrollbar-thumb { background: #F04E23; border-radius: 999px; }
        .job-row:hover { background: #FAFAFA; }
        .activity-item:hover { background: #FAFAFA; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in { animation: fadeIn 350ms ease forwards; }
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
        {/* Wordmark */}
        <div
          style={{
            height: "56px",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            borderBottom: "1px solid #E5E7EB",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IntelliHireLogo className="w-8 h-8" />
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#0D0D0D", fontFamily: "Inter, sans-serif", letterSpacing: "-0.3px" }}>IntelliHire</span>
          </div>
        </div>

        {/* Company Info Strip */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #E5E7EB",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#F04E23",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              AC
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#0D0D0D",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Acme Corp
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#9CA3AF",
                  margin: 0,
                  marginTop: "2px",
                }}
              >
                Technology · 51–200
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </nav>

        {/* User Bottom */}
        <div
          style={{
            borderTop: "1px solid #E5E7EB",
            padding: "12px 16px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#F04E23",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              JS
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#0D0D0D",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                John Smith
              </p>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#F04E23",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "#FFF4F1",
                  borderRadius: "999px",
                  padding: "1px 8px",
                }}
              >
                Owner
              </span>
            </div>
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9CA3AF",
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top Bar */}
        <header
          style={{
            height: "56px",
            background: "white",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          <h1
            style={{
              fontFamily: "Times New Roman, serif",
              fontSize: "22px",
              color: "#0D0D0D",
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => navigate("/company/jobs/create")}
              style={{
                height: "36px",
                background: "#F04E23",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                padding: "0 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background 150ms, transform 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}
            >
              <Plus size={15} />
              New Job
            </button>

            {/* Avatar */}
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserDropdown((v) => !v);
                }}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#F04E23",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "opacity 150ms",
                }}
              >
                JS
              </button>
              {showUserDropdown && (
                <div
                  className="fade-in"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: "180px",
                    background: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "10px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    padding: "6px 0",
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 14px 10px",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>
                      John Smith
                    </p>
                    <p style={{ fontSize: "11px", color: "#9CA3AF", margin: "2px 0 0" }}>
                      john@acmecorp.com
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/company/settings")}
                    style={dropdownItemStyle}
                  >
                    Settings
                  </button>
                  <button
                    onClick={logout}
                    style={{ ...dropdownItemStyle, color: "#DC2626" }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Banner */}
        {showBanner && profileComplete === false && (
          <div
            className={bannerExiting ? "banner-exit" : "banner-enter"}
            style={{
              background: "#FFFBEB",
              borderLeft: "3px solid #D97706",
              padding: "14px 24px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              overflow: "hidden",
            }}
          >
            <ClipboardList size={18} color="#D97706" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: "14px", color: "#92400E", margin: 0, flex: 1 }}>
              Complete your company profile to attract better candidates. Add your logo and
              description.{" "}
              <button
                onClick={() => navigate("/company/onboarding")}
                style={{
                  color: "#F04E23",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "14px",
                  padding: 0,
                  textDecoration: "none",
                  fontFamily: "Inter, sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Finish Setup →
              </button>
            </p>
            <button
              onClick={handleDismissBanner}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#9CA3AF",
                fontSize: "16px",
                lineHeight: 1,
                padding: "2px",
                transition: "color 150ms",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Content */}
        <main style={{ padding: "32px", flex: 1 }}>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <KpiCard target={6} label="Active Job Postings" link="View All →" index={0} />
            <KpiCard target={142} label="Total Applications Received" index={1} />
            <KpiCard
              target={28}
              label="Candidates Shortlisted"
              valueColor="#059669"
              index={2}
            />
            <KpiCard target={19} label="Screening Interviews Completed" index={3} />
          </div>

          {/* Two-Column Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "65fr 35fr",
              gap: "24px",
              alignItems: "start",
            }}
          >
            {/* ─── LEFT COLUMN ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Recent Job Postings Card */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "20px",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Times New Roman, serif",
                      fontSize: "18px",
                      color: "#0D0D0D",
                      margin: 0,
                    }}
                  >
                    Recent Job Postings
                  </h2>
                  <button
                    onClick={() => navigate("/company/jobs")}
                    style={orangeLinkStyle}
                  >
                    View All →
                  </button>
                </div>

                {/* Table */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#FAFAFA" }}>
                      {["Job Title", "Applicants", "Status", "Posted", "Action"].map((col) => (
                        <th
                          key={col}
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            color: "#9CA3AF",
                            textAlign: "left",
                            padding: "8px 12px",
                            fontFamily: "Inter, sans-serif",
                            borderBottom: "1px solid #E5E7EB",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobRows.map((row, i) => (
                      <tr
                        key={i}
                        className="job-row"
                        style={{
                          borderBottom:
                            i < jobRows.length - 1 ? "1px solid #F3F4F6" : "none",
                          transition: "background 150ms",
                          cursor: "default",
                        }}
                      >
                        <td style={{ padding: "14px 12px" }}>
                          <button
                            onClick={() => navigate(`/company/jobs/${i + 1}/candidates`)}
                            style={{
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "#0D0D0D",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              fontFamily: "Inter, sans-serif",
                              textDecoration: "none",
                              transition: "color 150ms",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#F04E23";
                              e.currentTarget.style.textDecoration = "underline";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#0D0D0D";
                              e.currentTarget.style.textDecoration = "none";
                            }}
                          >
                            {row.title}
                          </button>
                        </td>
                        <td
                          style={{
                            padding: "14px 12px",
                            fontSize: "14px",
                            color: "#374151",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {row.applicants}
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <StatusBadge status={row.status} />
                        </td>
                        <td
                          style={{
                            padding: "14px 12px",
                            fontSize: "13px",
                            color: "#9CA3AF",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {row.posted}
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <button
                            onClick={() => navigate(`/company/jobs/${i + 1}/candidates`)}
                            style={orangeLinkStyle}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.textDecoration = "underline")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.textDecoration = "none")
                            }
                          >
                            View Candidates →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* View All button */}
                <div style={{ marginTop: "16px" }}>
                  <button
                    onClick={() => navigate("/company/jobs")}
                    style={{
                      width: "100%",
                      height: "36px",
                      background: "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#374151",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      transition: "border-color 150ms, color 150ms",
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
                    View All Job Postings →
                  </button>
                </div>
              </div>

              {/* Hiring Pipeline Card */}
              <div
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "24px",
                }}
              >
                <h2
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontSize: "18px",
                    color: "#0D0D0D",
                    margin: "0 0 20px",
                  }}
                >
                  Hiring Pipeline
                </h2>

                <div
                  style={{
                    display: "flex",
                    gap: "2px",
                    alignItems: "flex-end",
                  }}
                >
                  {pipelineData.map((seg, i) => (
                    <PipelineSegment
                      key={seg.label}
                      label={seg.label}
                      count={seg.count}
                      pct={seg.pct}
                      color={seg.color}
                      total={142}
                      isFirst={i === 0}
                      isLast={i === pipelineData.length - 1}
                    />
                  ))}
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                    marginTop: "16px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Applied 142 → Screened 67 → Interviewed 31 → Shortlisted 28 → Decided 14
                </p>
              </div>
            </div>

            {/* ─── RIGHT COLUMN ─── */}
            <div>
              <div
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "24px",
                  position: "sticky",
                  top: "80px",
                }}
              >
                <h2
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontSize: "18px",
                    color: "#0D0D0D",
                    margin: "0 0 16px",
                  }}
                >
                  Recent Activity
                </h2>

                <div
                  className="activity-scroll"
                  style={{
                    maxHeight: "460px",
                    overflowY: "auto",
                  }}
                >
                  {activityItems.map((item, i) => (
                    <div
                      key={i}
                      className="activity-item"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px 4px",
                        borderBottom:
                          i < activityItems.length - 1 ? "1px solid #F3F4F6" : "none",
                        transition: "background 150ms",
                        cursor: item.link ? "pointer" : "default",
                        borderRadius: "4px",
                        opacity: 0,
                        animation: `fadeIn 300ms ease ${i * 40}ms forwards`,
                      }}
                      onClick={() => {
                        if (item.link) navigate("/company/candidates");
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: activityDotColor(item.type),
                          marginTop: "5px",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "13px",
                            color: item.link ? "#374151" : "#374151",
                            margin: 0,
                            lineHeight: 1.5,
                            fontFamily: "Inter, sans-serif",
                            transition: "color 150ms",
                          }}
                          onMouseEnter={(e) => {
                            if (item.link) e.currentTarget.style.color = "#F04E23";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#374151";
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#9CA3AF",
                          flexShrink: 0,
                          fontFamily: "Inter, sans-serif",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const orangeLinkStyle = {
  fontSize: "13px",
  color: "#F04E23",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  fontFamily: "Inter, sans-serif",
  fontWeight: 400,
};

const dropdownItemStyle = {
  width: "100%",
  padding: "8px 14px",
  textAlign: "left",
  fontSize: "13px",
  color: "#374151",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "Inter, sans-serif",
  display: "block",
  transition: "background 100ms",
};

export default CompanyDashboard;
