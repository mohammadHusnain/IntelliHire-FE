import { useState, useMemo, useCallback } from "react";
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
  Plus,
  Search,
  X,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

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

// ─── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Published: { bg: "#FFF4F1", color: "#F04E23" },
    Draft: { bg: "#F3F4F6", color: "#6B7280" },
    Closed: { bg: "#FEF2F2", color: "#DC2626" },
  };
  const s = map[status] || map.Draft;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", fontFamily: "Inter, sans-serif" }}>
      {status}
    </span>
  );
};

// ─── Select Arrow ────────────────────────────────────────────────────────────
const SelectArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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

// ─── Mock Job Data ───────────────────────────────────────────────────────────
const jobData = [
  { id: 1, title: "Frontend Developer", department: "Engineering", deadline: "May 31, 2025", applicants: 34, status: "Published" },
  { id: 2, title: "Backend Engineer", department: "Engineering", deadline: "Jun 15, 2025", applicants: 28, status: "Published" },
  { id: 3, title: "Product Designer", department: "Design", deadline: "May 28, 2025", applicants: 22, status: "Published" },
  { id: 4, title: "DevOps Engineer", department: "Engineering", deadline: null, applicants: 0, status: "Draft" },
  { id: 5, title: "Data Scientist", department: "Data & AI", deadline: "Jun 30, 2025", applicants: 24, status: "Published" },
  { id: 6, title: "UX Researcher", department: "Design", deadline: "Apr 30, 2025", applicants: 16, status: "Closed" },
  { id: 7, title: "Marketing Manager", department: "Marketing", deadline: null, applicants: 0, status: "Draft" },
];

// ─── Deadline Color Helper ───────────────────────────────────────────────────
function getDeadlineStyle(deadline) {
  if (!deadline) return { color: "#9CA3AF" };
  const d = new Date(deadline);
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { color: "#DC2626" };
  if (diff <= 7) return { color: "#D97706" };
  return { color: "#374151" };
}

function CompanyJobs() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("jobs");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [closeConfirm, setCloseConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [jobs, setJobs] = useState(jobData);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [editJob, setEditJob] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", department: "", deadline: "", status: "" });
  const userRole = "Owner"; // mock: Owner, HR Manager, Recruiter

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "dashboard") navigate("/company/dashboard");
    if (id === "jobs") navigate("/company/jobs");
    if (id === "team") navigate("/company/team");
    if (id === "analytics") navigate("/company/analytics");
    if (id === "community") navigate("/company/community");
  };

  const filteredJobs = useMemo(() => {
    let list = [...jobs];
    if (statusFilter !== "All") list = list.filter((j) => j.status === statusFilter);
    if (search.trim()) list = list.filter((j) => j.title.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [search, statusFilter, jobs]);

  const handleCloseJob = useCallback((id) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: "Closed" } : j));
    setCloseConfirm(null);
    showToast("Job posting closed successfully");
  }, [showToast]);

  const handleDeleteJob = useCallback((id) => {
    const job = jobs.find((j) => j.id === id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeleteConfirm(null);
    showToast(`"${job?.title}" deleted`, "error");
  }, [jobs, showToast]);

  const handleEditOpen = useCallback((job) => {
    setEditForm({ title: job.title, department: job.department, deadline: job.deadline || "", status: job.status });
    setEditJob(job.id);
  }, []);

  const handleEditSave = useCallback((e) => {
    e.preventDefault();
    setJobs((prev) => prev.map((j) => j.id === editJob ? { ...j, ...editForm } : j));
    showToast(`"${editForm.title}" updated successfully`);
    setEditJob(null);
  }, [editJob, editForm, showToast]);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .job-row:hover { background: #FAFAFA; }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
      `}</style>

      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}

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
            <button
              onClick={() => navigate("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center", transition: "color 150ms" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              title="Log out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
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
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Job <em style={{ color: "#F04E23", fontStyle: "italic" }}>Postings</em>
          </h1>
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
              transition: "background 150ms",
              fontFamily: "Inter, sans-serif",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}
          >
            <Plus size={15} />
            Create New Job
          </button>
        </header>

        {/* Content */}
        <main style={{ padding: "32px", flex: 1 }}>
          {/* Filter Bar */}
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", width: "220px" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search job title…"
                className="field-input"
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "0 32px 0 34px",
                  fontSize: "14px",
                  color: "#0D0D0D",
                  background: "white",
                  outline: "none",
                  fontFamily: "Inter, sans-serif",
                  transition: "border-color 150ms, box-shadow 150ms",
                  boxSizing: "border-box",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div style={{ position: "relative", width: "150px" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field-input"
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "0 36px 0 12px",
                  fontSize: "14px",
                  color: "#0D0D0D",
                  background: "white",
                  outline: "none",
                  fontFamily: "Inter, sans-serif",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "pointer",
                  transition: "border-color 150ms, box-shadow 150ms",
                  boxSizing: "border-box",
                }}
              >
                <option value="All">All</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Closed">Closed</option>
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <SelectArrow />
              </span>
            </div>
          </div>

          {/* Jobs Table */}
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA" }}>
                  {["Job Title", "Department", "Deadline", "Applicants", "Status", "Actions"].map((col) => (
                    <th
                      key={col}
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "#9CA3AF",
                        textAlign: "left",
                        padding: "12px 16px",
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
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: "48px 16px", textAlign: "center" }}>
                      <p style={{ fontSize: "14px", color: "#9CA3AF", margin: 0 }}>No jobs match your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, i) => (
                    <tr
                      key={job.id}
                      className="job-row"
                      style={{
                        borderBottom: i < filteredJobs.length - 1 ? "1px solid #F3F4F6" : "none",
                        transition: "background 150ms",
                        height: "52px",
                        position: "relative",
                      }}
                    >
                      {/* Title */}
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => navigate(`/company/jobs/${job.id}/candidates`)}
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
                          {job.title}
                        </button>
                      </td>

                      {/* Department */}
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151", fontFamily: "Inter, sans-serif" }}>
                        {job.department}
                      </td>

                      {/* Deadline */}
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontFamily: "Inter, sans-serif", ...getDeadlineStyle(job.deadline) }}>
                        {job.deadline || "—"}
                      </td>

                      {/* Applicants */}
                      <td style={{ padding: "12px 16px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: job.applicants === 0 ? "#9CA3AF" : "#374151", fontStyle: job.applicants === 0 ? "italic" : "normal" }}>
                        {job.applicants === 0 ? "0 applicants" : job.applicants}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge status={job.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px", position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "nowrap" }}>
                          <button
                            onClick={() => navigate(`/company/jobs/${job.id}/candidates`)}
                            style={{ fontSize: "13px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >
                            View Candidates →
                          </button>

                          {/* Edit — hidden for Recruiter on Published/Closed */}
                          {!(userRole === "Recruiter" && (job.status === "Published" || job.status === "Closed")) && (
                            <button
                              onClick={() => handleEditOpen(job)}
                              style={{ fontSize: "13px", color: "#374151", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", transition: "color 150ms" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
                            >
                              Edit
                            </button>
                          )}

                          {/* Close — Owner/HR only, Published only */}
                          {(userRole === "Owner" || userRole === "HR Manager") && job.status === "Published" && (
                            <button
                              onClick={() => setCloseConfirm(job.id)}
                              style={{ fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", transition: "text-decoration 150ms" }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              Close
                            </button>
                          )}

                          {/* Delete — Owner/HR only, Draft or Closed */}
                          {(userRole === "Owner" || userRole === "HR Manager") && (job.status === "Draft" || job.status === "Closed") && (
                            <button
                              onClick={() => setDeleteConfirm(job.id)}
                              style={{ fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif", transition: "text-decoration 150ms" }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {/* Close Confirm Popover */}
                        {closeConfirm === job.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              right: "16px",
                              background: "white",
                              border: "1px solid #E5E7EB",
                              borderRadius: "8px",
                              padding: "12px 16px",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                              zIndex: 20,
                              animation: "fadeIn 200ms ease",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <p style={{ fontSize: "13px", color: "#0D0D0D", margin: "0 0 10px" }}>
                              Close this job posting? Candidates can no longer apply.
                            </p>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleCloseJob(job.id)}
                                style={{ height: "30px", padding: "0 14px", fontSize: "12px", fontWeight: 500, color: "white", background: "#DC2626", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setCloseConfirm(null)}
                                style={{ fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Delete Confirm Popover */}
                        {deleteConfirm === job.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              right: "16px",
                              background: "white",
                              border: "1px solid #E5E7EB",
                              borderRadius: "8px",
                              padding: "12px 16px",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                              zIndex: 20,
                              animation: "fadeIn 200ms ease",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <p style={{ fontSize: "13px", color: "#0D0D0D", margin: "0 0 10px" }}>
                              Permanently delete "{job.title}"? This cannot be undone.
                            </p>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                style={{ height: "30px", padding: "0 14px", fontSize: "12px", fontWeight: 500, color: "white", background: "#DC2626", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                style={{ fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── EDIT JOB MODAL ── */}
      {editJob !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setEditJob(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "460px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: "0 0 6px" }}>Edit Job Posting</h2>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 24px" }}>Update the job details below.</p>
            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Job Title</label>
                <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 150ms, box-shadow 150ms" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Department</label>
                <input type="text" value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} required className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 150ms, box-shadow 150ms" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Deadline</label>
                <input type="text" value={editForm.deadline} onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))} placeholder="e.g. Jun 30, 2025" className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 150ms, box-shadow 150ms" }} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Status</label>
                <div style={{ position: "relative" }}>
                  <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", paddingRight: "36px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", boxSizing: "border-box", transition: "border-color 150ms, box-shadow 150ms" }}>
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
              </div>
              <button type="submit" style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>
                Save Changes
              </button>
              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button type="button" onClick={() => setEditJob(null)} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyJobs;
