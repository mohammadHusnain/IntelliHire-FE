import { useState, useCallback } from "react";
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

// ─── Role Badge ──────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const map = {
    Owner: { bg: "#0D0D0D", color: "#FFFFFF" },
    "HR Manager": { bg: "#FFF4F1", color: "#F04E23" },
    Recruiter: { bg: "#F3F4F6", color: "#374151" },
  };
  const s = map[role] || map.Recruiter;
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
      {role}
    </span>
  );
};

// ─── Status Badge ────────────────────────────────────────────────────────────
const TeamStatusBadge = ({ status }) => {
  if (status === "Active") {
    return (
      <span
        style={{
          background: "#F0FDF4",
          color: "#059669",
          borderRadius: "999px",
          fontSize: "11px",
          fontWeight: 500,
          padding: "3px 10px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Active
      </span>
    );
  }
  return (
    <span
      style={{
        background: "#FFFBEB",
        color: "#D97706",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 500,
        padding: "3px 10px",
        fontFamily: "Inter, sans-serif",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#D97706",
          display: "inline-block",
          animation: "pulse 1.5s infinite",
        }}
      />
      Pending Invite
    </span>
  );
};

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ message, onClose }) => (
  <div
    style={{
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: 9999,
      background: "#FFFFFF",
      border: "1px solid #E5E7EB",
      borderRadius: "10px",
      padding: "14px 18px",
      width: "340px",
      borderLeft: "4px solid #F04E23",
      fontSize: "14px",
      color: "#0D0D0D",
      fontFamily: "Inter, sans-serif",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      animation: "toastIn 200ms ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <span>{message}</span>
    <button
      onClick={onClose}
      style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "2px" }}
    >
      <X size={14} />
    </button>
  </div>
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

// ─── Initial Mock Data ───────────────────────────────────────────────────────
const initialTeam = [
  { name: "John Smith", email: "john@acmecorp.com", role: "Owner", status: "Active", date: "Jan 15, 2025" },
  { name: "Sarah Lee", email: "sarah@acmecorp.com", role: "HR Manager", status: "Active", date: "Feb 01, 2025" },
  { name: "Mike Brown", email: "mike@acmecorp.com", role: "HR Manager", status: "Active", date: "Feb 14, 2025" },
  { name: "Ana Torres", email: "ana@acmecorp.com", role: "Recruiter", status: "Active", date: "Mar 03, 2025" },
  { name: "Raj Patel", email: "raj@acmecorp.com", role: "Recruiter", status: "Active", date: "Mar 10, 2025" },
  { name: "—", email: "dev@acmecorp.com", role: "Recruiter", status: "Pending", date: "May 06, 2025" },
];

// ─── Select Arrow ────────────────────────────────────────────────────────────
const SelectArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CompanyTeam() {
  const navigate = useNavigate();
  const logout = useLogout();
  const [activeNav, setActiveNav] = useState("team");
  const [team, setTeam] = useState(initialTeam);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Recruiter");
  const [toast, setToast] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", status: "" });

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "dashboard") navigate("/company/dashboard");
    if (id === "jobs") navigate("/company/jobs");
    if (id === "candidates") navigate("/company/candidates");
    if (id === "team") navigate("/company/team");
    if (id === "analytics") navigate("/company/analytics");
    if (id === "community") navigate("/company/community");
    if (id === "settings") navigate("/company/settings");
  };

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const newMember = {
      name: "—",
      email: inviteEmail,
      role: inviteRole,
      status: "Pending",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    };
    setTeam((prev) => [...prev, newMember]);
    showToast(`✓ Invite sent to ${inviteEmail}`);
    setInviteEmail("");
    setInviteRole("Recruiter");
    setShowModal(false);
  };

  const handleRemove = (index) => {
    const memberName = team[index].status === "Pending" ? team[index].email : team[index].name;
    setTeam((prev) => prev.filter((_, i) => i !== index));
    setRemoveConfirm(null);
    showToast(`✓ ${memberName} removed from team`);
  };

  const handleEditOpen = (index) => {
    const m = team[index];
    setEditForm({ name: m.name === "—" ? "" : m.name, role: m.role, status: m.status });
    setEditIndex(index);
  };

  const handleEditSave = (e) => {
    e.preventDefault();
    setTeam((prev) => prev.map((m, i) => i === editIndex ? { ...m, name: editForm.name || m.name, role: editForm.role, status: editForm.status } : m));
    showToast(`✓ ${editForm.name || team[editIndex].email} updated successfully`);
    setEditIndex(null);
  };

  const totalMembers = team.length;
  const owners = team.filter((m) => m.role === "Owner").length;
  const hrManagers = team.filter((m) => m.role === "HR Manager").length;
  const recruiters = team.filter((m) => m.role === "Recruiter").length;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .team-row:hover { background: #FAFAFA; }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
      `}</style>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

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
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              onClick={() => handleNavClick(item.id)}
            />
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
              onClick={logout}
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
            Team <em style={{ color: "#F04E23", fontStyle: "italic" }}>Management</em>
          </h1>
          <button
            onClick={() => setShowModal(true)}
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
            Invite Member
          </button>
        </header>

        {/* Content */}
        <main style={{ padding: "32px", flex: 1 }}>
          {/* Summary Strip */}
          <div
            style={{
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: "10px",
              padding: "16px 24px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {[
              { value: owners, label: "Owner" },
              { value: hrManagers, label: "HR Managers" },
              { value: recruiters, label: "Recruiters" },
              { value: totalMembers, label: "Total Members", bold: true },
            ].map((stat, i, arr) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  borderRight: i < arr.length - 1 ? "1px solid #E5E7EB" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "Times New Roman, serif",
                    fontSize: "18px",
                    color: "#0D0D0D",
                    fontWeight: stat.bold ? 700 : 400,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                    marginTop: "2px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Team Table */}
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
                  {["Name", "Email", "Role", "Status", "Date Added", "Actions"].map((col) => (
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
                {team.map((member, i) => (
                  <tr
                    key={i}
                    className="team-row"
                    style={{
                      borderBottom: i < team.length - 1 ? "1px solid #F3F4F6" : "none",
                      transition: "background 150ms",
                      height: "52px",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: "#0D0D0D" }}>
                      {member.status === "Pending" ? <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Pending</span> : member.name}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{member.email}</td>
                    <td style={{ padding: "12px 16px" }}><RoleBadge role={member.role} /></td>
                    <td style={{ padding: "12px 16px" }}><TeamStatusBadge status={member.status} /></td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", color: "#9CA3AF" }}>{member.date}</td>
                    <td style={{ padding: "12px 16px", position: "relative" }}>
                      {member.role === "Owner" ? (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {member.status === "Pending" ? (
                            <button
                              style={{
                                fontSize: "13px",
                                color: "#F04E23",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                fontFamily: "Inter, sans-serif",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                              onClick={() => showToast(`Invite resent to ${member.email}`)}
                            >
                              Resend Invite
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditOpen(i)}
                              style={{
                                height: "32px",
                                padding: "0 12px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#374151",
                                background: "white",
                                border: "1px solid #E5E7EB",
                                borderRadius: "6px",
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
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => setRemoveConfirm(i)}
                            style={{
                              fontSize: "13px",
                              color: "#DC2626",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              fontFamily: "Inter, sans-serif",
                              transition: "text-decoration 150ms",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Inline Confirm Popover */}
                      {removeConfirm === i && (
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
                            Remove {member.status === "Pending" ? member.email : member.name} from your team?
                          </p>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => handleRemove(i)}
                              style={{
                                height: "30px",
                                padding: "0 14px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "white",
                                background: "#DC2626",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setRemoveConfirm(null)}
                              style={{
                                fontSize: "12px",
                                color: "#9CA3AF",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ── INVITE MODAL ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.40)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px",
              background: "white",
              borderRadius: "10px",
              padding: "32px",
              animation: "modalIn 150ms ease",
            }}
          >
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: "0 0 6px" }}>
              Invite a Team Member
            </h2>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 24px" }}>
              They'll receive an email invitation to join your workspace.
            </p>

            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@company.com"
                  className="field-input"
                  style={{
                    width: "100%",
                    height: "40px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "0 12px",
                    fontSize: "14px",
                    color: "#0D0D0D",
                    background: "white",
                    outline: "none",
                    fontFamily: "Inter, sans-serif",
                    transition: "border-color 150ms, box-shadow 150ms",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Role</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="field-input"
                    style={{
                      width: "100%",
                      height: "40px",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      padding: "0 12px",
                      paddingRight: "36px",
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
                    <option value="HR Manager">HR Manager</option>
                    <option value="Recruiter">Recruiter</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <SelectArrow />
                  </span>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  height: "42px",
                  background: "#F04E23",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}
              >
                Send Invite →
              </button>

              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    fontSize: "13px",
                    color: "#9CA3AF",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "color 150ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MEMBER MODAL ── */}
      {editIndex !== null && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEditIndex(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "420px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: "0 0 6px" }}>
              Edit Team Member
            </h2>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 24px" }}>
              Update member details below.
            </p>
            <form onSubmit={handleEditSave}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Member name"
                  className="field-input"
                  style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Role</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    className="field-input"
                    style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", paddingRight: "36px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" }}
                  >
                    <option value="HR Manager">HR Manager</option>
                    <option value="Recruiter">Recruiter</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Status</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="field-input"
                    style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", paddingRight: "36px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" }}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending Invite</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
              </div>
              <button
                type="submit"
                style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}
              >
                Save Changes
              </button>
              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button type="button" onClick={() => setEditIndex(null)} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyTeam;
