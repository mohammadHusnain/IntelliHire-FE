import { useState } from "react";
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
  Lock,
  Unlock,
  X,
  Copy,
  Download,
  Search,
  Mail,
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

// ─── Mock Communities ────────────────────────────────────────────────────────
const initialCommunities = [
  { id: "1", name: "React & Frontend Talent Pool", description: "A community for experienced frontend developers skilled in React, TypeScript, and modern web technologies.", members: 48, targetGroup: "Tech Professionals", joinMode: "Open", lastActive: "Updated 2 days ago", activeWeek: 12, interviewReady: 5 },
  { id: "2", name: "Edinburgh CS Grads 2024", description: "Computer Science graduates from the University of Edinburgh, class of 2024.", members: 23, targetGroup: "University Alumni", joinMode: "Invite Only", lastActive: "Updated 5 days ago", activeWeek: 4, interviewReady: 2 },
  { id: "3", name: "Early Talent Pipeline", description: "University students across UK institutions exploring early career opportunities in tech.", members: 61, targetGroup: "University Students", joinMode: "Open", lastActive: "Updated 1 day ago", activeWeek: 18, interviewReady: 8 },
];

const mockMembers = [
  { name: "Alice Johnson", email: "alice@email.com", joined: "Apr 12, 2025", status: "Member", engagement: 87 },
  { name: "Bob Williams", email: "bob@email.com", joined: "Apr 15, 2025", status: "High Match", engagement: 92 },
  { name: "Claire Adams", email: "claire@email.com", joined: "Apr 18, 2025", status: "Interviewed", engagement: 78 },
  { name: "David Chen", email: "david@email.com", joined: "Apr 20, 2025", status: "Member", engagement: 65 },
  { name: "Eva Martinez", email: "eva@email.com", joined: "Apr 22, 2025", status: "Pending", engagement: 45 },
];

const targetGroups = ["University Students", "University Alumni", "Tech Professionals", "Industry Experts", "Early Career"];

function CompanyCommunity() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("community");
  const [communities] = useState(initialCommunities);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailView, setDetailView] = useState(null);
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTarget, setNewTarget] = useState("Tech Professionals");
  const [newTags, setNewTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newJoinMode, setNewJoinMode] = useState("Open");

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/company/dashboard");
    if (navId === "jobs") navigate("/company/jobs");
    if (navId === "team") navigate("/company/team");
    if (navId === "analytics") navigate("/company/analytics");
  };

  const handleAddTag = (e) => {
    if (e.key === "Enter" && newTagInput.trim()) {
      e.preventDefault();
      if (!newTags.includes(newTagInput.trim())) setNewTags((p) => [...p, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalMembers = communities.reduce((a, c) => a + c.members, 0);

  const statusBadge = (status) => {
    const m = { Member: { bg: "#F3F4F6", color: "#6B7280" }, Pending: { bg: "#FFFBEB", color: "#D97706" }, Interviewed: { bg: "#FFF4F1", color: "#F04E23" }, "High Match": { bg: "#F0FDF4", color: "#059669" } };
    const s = m[status] || m.Member;
    return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{status}</span>;
  };

  // ─── Detail View ───────────────────────────────────────────────────────────
  if (detailView) {
    const community = communities.find((c) => c.id === detailView);
    if (!community) return null;
    const filteredMembers = mockMembers.filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        `}</style>

        {/* Sidebar (same) */}
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

        <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => setDetailView(null)} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>← Back to Communities</button>
            </div>
          </header>

          <main style={{ padding: "24px 32px 48px", flex: 1 }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "26px", color: "#0D0D0D", margin: "0 0 24px" }}>{community.name}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
              {/* Left — Settings */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px", alignSelf: "start" }}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Community Name</label>
                  <input type="text" defaultValue={community.name} className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Description</label>
                  <textarea defaultValue={community.description} className="field-input" style={{ width: "100%", height: "80px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Join Link</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input readOnly value={`https://intellihire.app/community/${community.id}/join`} style={{ flex: 1, height: "40px", background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "12px", color: "#374151", outline: "none", boxSizing: "border-box" }} />
                    <button onClick={handleCopyLink} style={{ height: "40px", padding: "0 12px", background: copied ? "white" : "#F04E23", color: copied ? "#059669" : "white", border: copied ? "1px solid #059669" : "none", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 200ms" }}>
                      {copied ? "✓ Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div style={{ display: "inline-block", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "6px" }}>
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                      <rect width="100" height="100" rx="4" fill="white" />
                      <rect x="8" y="8" width="24" height="24" rx="2" fill="#0D0D0D" /><rect x="12" y="12" width="16" height="16" rx="1" fill="white" /><rect x="15" y="15" width="10" height="10" fill="#0D0D0D" />
                      <rect x="68" y="8" width="24" height="24" rx="2" fill="#0D0D0D" /><rect x="72" y="12" width="16" height="16" rx="1" fill="white" /><rect x="75" y="15" width="10" height="10" fill="#0D0D0D" />
                      <rect x="8" y="68" width="24" height="24" rx="2" fill="#0D0D0D" /><rect x="12" y="72" width="16" height="16" rx="1" fill="white" /><rect x="15" y="75" width="10" height="10" fill="#0D0D0D" />
                      <rect x="38" y="8" width="5" height="5" fill="#0D0D0D" /><rect x="48" y="8" width="5" height="5" fill="#0D0D0D" /><rect x="58" y="8" width="5" height="5" fill="#0D0D0D" />
                      <rect x="38" y="38" width="5" height="5" fill="#0D0D0D" /><rect x="48" y="38" width="5" height="5" fill="#0D0D0D" /><rect x="58" y="38" width="5" height="5" fill="#0D0D0D" />
                      <rect x="68" y="38" width="5" height="5" fill="#0D0D0D" /><rect x="78" y="38" width="5" height="5" fill="#0D0D0D" /><rect x="88" y="38" width="5" height="5" fill="#0D0D0D" />
                    </svg>
                  </div>
                  <div style={{ marginTop: "6px" }}>
                    <button style={{ fontSize: "12px", color: "#F04E23", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}><Download size={12} /> Download QR</button>
                  </div>
                  <p style={{ fontSize: "11px", color: "#9CA3AF", margin: "4px 0 0" }}>14 joins via QR this month</p>
                </div>
                <button style={{ width: "100%", height: "40px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: "12px", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Changes</button>
                <button style={{ width: "100%", fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Archive Community</button>
              </div>

              {/* Right — Members */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px" }}>
                {/* Invite row */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Mail size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite by email…" className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px 0 34px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
                  </div>
                  <button style={{ height: "40px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Send Invite</button>
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginBottom: "16px" }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                  <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search members…" className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px 0 34px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
                </div>

                <h4 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 16px" }}>{community.members} Members</h4>

                {/* Members Table */}
                <div style={{ overflow: "hidden", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#FAFAFA" }}>
                        {["Name", "Email", "Joined", "Status", "Engagement", ""].map((col) => (
                          <th key={col} style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", textAlign: "left", padding: "10px 12px", fontFamily: "Inter, sans-serif", borderBottom: "1px solid #E5E7EB" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m, i) => (
                        <tr key={i} style={{ borderBottom: i < filteredMembers.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                          <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: 500, color: "#0D0D0D" }}>{m.name}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "#374151" }}>{m.email}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "#374151" }}>{m.joined}</td>
                          <td style={{ padding: "10px 12px" }}>{statusBadge(m.status)}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 500, color: m.engagement >= 80 ? "#059669" : m.engagement >= 60 ? "#D97706" : "#DC2626" }}>{m.engagement}%</td>
                          <td style={{ padding: "10px 12px" }}>
                            <button style={{ fontSize: "12px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─── Main List View ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .community-card { transition: transform 150ms, border-color 150ms; }
        .community-card:hover { transform: translateY(-2px); border-color: #D1D5DB !important; }
        .skill-tag { display: inline-flex; align-items: center; gap: 4px; background: #FFF4F1; color: #F04E23; border-radius: 999px; font-size: 12px; font-weight: 500; padding: 4px 10px; }
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
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Talent <em style={{ color: "#F04E23", fontStyle: "italic" }}>Communities</em>
          </h1>
          <button onClick={() => setShowCreateModal(true)} style={{ height: "40px", padding: "0 20px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Create Community +</button>
        </header>

        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          {/* Subtext */}
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: "0 0 16px" }}>Build and manage your long-term candidate pools</p>

          {/* KPI Strip */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
            {[
              { label: "Total Communities", value: communities.length },
              { label: "Active Members", value: totalMembers },
              { label: "Jobs Shared This Month", value: 7 },
              { label: "Community-to-Hire", value: "12%" },
            ].map((s) => (
              <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: "#0D0D0D" }}>{s.value}</span>
                <span style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Insight */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFF4F1", border: "1px solid #FCA68A", borderRadius: "6px", padding: "6px 12px", marginBottom: "24px", fontSize: "12px", color: "#374151" }}>
            <span style={{ color: "#F04E23", fontWeight: 600 }}>💡</span> Your React Talent Pool has the highest response rate this month
          </div>

          {/* Community Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {communities.map((c, i) => (
              <div key={c.id} className="community-card" style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px", background: "white", animation: `fadeIn 300ms ease ${i * 100}ms both` }}>
                <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", fontWeight: 700, color: "#0D0D0D", margin: "0 0 8px" }}>{c.name}</h3>
                <p style={{ fontSize: "13px", color: "#374151", margin: "0 0 12px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.description}</p>

                <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                  <span style={{ background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{c.members} Members</span>
                  <span style={{ background: "#F3F4F6", color: "#374151", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{c.targetGroup}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  {c.joinMode === "Open" ? <Unlock size={12} style={{ color: "#9CA3AF" }} /> : <Lock size={12} style={{ color: "#9CA3AF" }} />}
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{c.joinMode}</span>
                </div>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 8px" }}>{c.lastActive}</p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "11px", background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", padding: "2px 8px" }}>{c.activeWeek} active this week</span>
                  <span style={{ fontSize: "11px", background: "#F0FDF4", color: "#059669", borderRadius: "999px", padding: "2px 8px" }}>{c.interviewReady} interview-ready</span>
                </div>

                <div style={{ height: "1px", background: "#F3F4F6", marginBottom: "12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setDetailView(c.id)} style={{ height: "32px", padding: "0 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Manage →</button>
                  <button style={{ height: "32px", padding: "0 12px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Post Job</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* ── CREATE COMMUNITY MODAL ── */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreateModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "480px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: "0 0 20px" }}>Create a Talent Community</h2>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Community Name <span style={{ color: "#F04E23" }}>*</span></label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="field-input" placeholder="e.g. React Talent Pool" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Description</label>
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value.slice(0, 250))} className="field-input" placeholder="Describe the community purpose…" style={{ width: "100%", height: "80px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", resize: "vertical", boxSizing: "border-box" }} />
              <span style={{ fontSize: "12px", color: "#9CA3AF", float: "right" }}>{newDesc.length}/250</span>
            </div>

            <div style={{ marginBottom: "16px", position: "relative" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Target Group</label>
              <select value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="field-input" style={{ width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 36px 0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", appearance: "none", WebkitAppearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
                {targetGroups.map((t) => <option key={t}>{t}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" }}>Filter Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px 10px", minHeight: "40px", alignItems: "center" }}>
                {newTags.map((t) => (
                  <span key={t} className="skill-tag">{t} <button onClick={() => setNewTags((p) => p.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "#F04E23", display: "flex", padding: 0 }}><X size={12} /></button></span>
                ))}
                <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder={newTags.length === 0 ? "Add tags…" : ""} style={{ border: "none", outline: "none", flex: 1, minWidth: "80px", fontSize: "14px", fontFamily: "Inter, sans-serif", background: "transparent", padding: "4px 0" }} />
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "8px" }}>Join Mode</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button onClick={() => setNewJoinMode("Open")} style={{ padding: "14px", border: newJoinMode === "Open" ? "2px solid #F04E23" : "1px solid #E5E7EB", borderRadius: "8px", background: newJoinMode === "Open" ? "#FFF4F1" : "white", cursor: "pointer", textAlign: "left", transition: "all 150ms" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Unlock size={14} style={{ color: newJoinMode === "Open" ? "#F04E23" : "#9CA3AF" }} />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: newJoinMode === "Open" ? "#F04E23" : "#374151" }}>Open</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Anyone can join</span>
                </button>
                <button onClick={() => setNewJoinMode("Invite Only")} style={{ padding: "14px", border: newJoinMode === "Invite Only" ? "2px solid #F04E23" : "1px solid #E5E7EB", borderRadius: "8px", background: newJoinMode === "Invite Only" ? "#FFF4F1" : "white", cursor: "pointer", textAlign: "left", transition: "all 150ms" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Lock size={14} style={{ color: newJoinMode === "Invite Only" ? "#F04E23" : "#9CA3AF" }} />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: newJoinMode === "Invite Only" ? "#F04E23" : "#374151" }}>Invite Only</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Review each member</span>
                </button>
              </div>
            </div>

            <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 16px" }}>Estimated eligible candidates: <strong style={{ color: "#F04E23" }}>134</strong></p>

            <button onClick={() => setShowCreateModal(false)} style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: "10px", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Create Community →</button>
            <button onClick={() => setShowCreateModal(false)} style={{ width: "100%", fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyCommunity;
