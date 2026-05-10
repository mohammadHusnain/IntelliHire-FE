import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, Users, BarChart2, Globe, UserCheck, Settings, LogOut,
  Lock, Unlock, X, Copy, Download, Search, Mail, Plus, Trash2, Edit3,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { getJobs } from "../../data/jobsStore";

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

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Job Postings", icon: Briefcase },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "community", label: "Community", icon: Globe },
  { id: "team", label: "Team", icon: UserCheck },
  { id: "settings", label: "Settings", icon: Settings },
];
const targetGroups = ["University Students", "University Alumni", "Tech Professionals", "Industry Experts", "Early Career", "Bootcamp Grads", "Diversity & Inclusion"];

const seedCommunities = [
  { id: "c1", name: "React & Frontend Talent Pool", description: "A community for experienced frontend developers skilled in React, TypeScript, and modern web technologies.", members: [
    { name: "Alice Johnson", email: "alice@email.com", joined: "Apr 12, 2025", status: "Member", engagement: 87 },
    { name: "Bob Williams", email: "bob@email.com", joined: "Apr 15, 2025", status: "High Match", engagement: 92 },
    { name: "Claire Adams", email: "claire@email.com", joined: "Apr 18, 2025", status: "Interviewed", engagement: 78 },
    { name: "David Chen", email: "david@email.com", joined: "Apr 20, 2025", status: "Member", engagement: 65 },
  ], targetGroup: "Tech Professionals", joinMode: "Open", tags: ["React", "Frontend", "TypeScript"], lastActive: "2 days ago", activeWeek: 12, interviewReady: 5 },
  { id: "c2", name: "Edinburgh CS Grads 2024", description: "Computer Science graduates from the University of Edinburgh, class of 2024.", members: [
    { name: "Eva Martinez", email: "eva@email.com", joined: "Apr 22, 2025", status: "Member", engagement: 45 },
    { name: "Frank Lee", email: "frank@email.com", joined: "Apr 25, 2025", status: "Pending", engagement: 30 },
  ], targetGroup: "University Alumni", joinMode: "Invite Only", tags: ["Edinburgh", "CS", "2024"], lastActive: "5 days ago", activeWeek: 4, interviewReady: 2 },
  { id: "c3", name: "Early Talent Pipeline", description: "University students across UK institutions exploring early career opportunities in tech.", members: [
    { name: "Grace Kim", email: "grace@email.com", joined: "May 01, 2025", status: "High Match", engagement: 88 },
    { name: "Henry Brown", email: "henry@email.com", joined: "May 02, 2025", status: "Member", engagement: 72 },
    { name: "Isla Patel", email: "isla@email.com", joined: "May 03, 2025", status: "Interviewed", engagement: 91 },
  ], targetGroup: "University Students", joinMode: "Open", tags: ["Early Career", "UK", "Students"], lastActive: "1 day ago", activeWeek: 18, interviewReady: 8 },
];

let _nextId = 10;

function CompanyCommunity() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("community");
  const [communities, setCommunities] = useState(seedCommunities);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailView, setDetailView] = useState(null);
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [postJobModal, setPostJobModal] = useState(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTarget, setNewTarget] = useState("Tech Professionals");
  const [newTags, setNewTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newJoinMode, setNewJoinMode] = useState("Open");

  // Detail edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editJoinMode, setEditJoinMode] = useState("Open");
  const [editTags, setEditTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState("");

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

  const handleCopyLink = (communityId) => {
    navigator.clipboard?.writeText(`https://intellihire.app/community/${communityId}/join`);
    setCopied(true);
    showToast("Join link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Create ──
  const handleAddTag = (e) => {
    if (e.key === "Enter" && newTagInput.trim()) {
      e.preventDefault();
      if (!newTags.includes(newTagInput.trim())) setNewTags((p) => [...p, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) { showToast("Community name is required", "error"); return; }
    const newCommunity = {
      id: `c${_nextId++}`,
      name: newName.trim(),
      description: newDesc.trim(),
      members: [],
      targetGroup: newTarget,
      joinMode: newJoinMode,
      tags: [...newTags],
      lastActive: "Just now",
      activeWeek: 0,
      interviewReady: 0,
    };
    setCommunities((prev) => [newCommunity, ...prev]);
    setShowCreateModal(false);
    setNewName(""); setNewDesc(""); setNewTarget("Tech Professionals"); setNewTags([]); setNewTagInput(""); setNewJoinMode("Open");
    showToast(`"${newCommunity.name}" created successfully`);
  };

  // ── Delete / Archive ──
  const handleDelete = (id) => {
    const c = communities.find((x) => x.id === id);
    setCommunities((prev) => prev.filter((x) => x.id !== id));
    setDeleteConfirm(null);
    if (detailView === id) setDetailView(null);
    showToast(`"${c?.name}" archived`, "warning");
  };

  // ── Open detail and load edit form ──
  const openDetail = (id) => {
    const c = communities.find((x) => x.id === id);
    if (!c) return;
    setEditName(c.name); setEditDesc(c.description); setEditTarget(c.targetGroup); setEditJoinMode(c.joinMode); setEditTags([...(c.tags || [])]); setEditTagInput("");
    setDetailView(id);
    setMemberSearch(""); setInviteEmail("");
  };

  // ── Save detail edits ──
  const handleSaveDetail = () => {
    setCommunities((prev) => prev.map((c) => c.id === detailView ? { ...c, name: editName, description: editDesc, targetGroup: editTarget, joinMode: editJoinMode, tags: [...editTags] } : c));
    showToast("Community updated successfully");
  };

  // ── Invite member ──
  const handleInvite = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inviteEmail.trim() || !emailRegex.test(inviteEmail)) { showToast("Please enter a valid email address", "error"); return; }
    const existing = communities.find((c) => c.id === detailView);
    if (existing?.members.some((m) => m.email === inviteEmail.trim())) { showToast("This email is already a member", "warning"); return; }
    const newMember = { name: inviteEmail.split("@")[0], email: inviteEmail.trim(), joined: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }), status: "Pending", engagement: 0 };
    setCommunities((prev) => prev.map((c) => c.id === detailView ? { ...c, members: [...c.members, newMember] } : c));
    setInviteEmail("");
    showToast(`Invitation sent to ${newMember.email}`);
  };

  // ── Remove member ──
  const handleRemoveMember = (email) => {
    setCommunities((prev) => prev.map((c) => c.id === detailView ? { ...c, members: c.members.filter((m) => m.email !== email) } : c));
    showToast("Member removed");
  };

  // ── Post Job to Community ──
  const handlePostJob = (jobTitle) => {
    showToast(`"${jobTitle}" posted to community`);
    setPostJobModal(null);
  };

  const handleEditAddTag = (e) => {
    if (e.key === "Enter" && editTagInput.trim()) {
      e.preventDefault();
      if (!editTags.includes(editTagInput.trim())) setEditTags((p) => [...p, editTagInput.trim()]);
      setEditTagInput("");
    }
  };

  const totalMembers = communities.reduce((a, c) => a + c.members.length, 0);

  const statusBadge = (status) => {
    const m = { Member: { bg: "#F3F4F6", color: "#6B7280" }, Pending: { bg: "#FFFBEB", color: "#D97706" }, Interviewed: { bg: "#FFF4F1", color: "#F04E23" }, "High Match": { bg: "#F0FDF4", color: "#059669" } };
    const s = m[status] || m.Member;
    return <span style={{ background: s.bg, color: s.color, borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{status}</span>;
  };

  // ─── Shared Sidebar ─────────────────────────────────────────────────────────
  const Sidebar = () => (
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
  );

  const inputStyle = { width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };
  const labelStyle = { fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px" };
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" };

  // ─── Detail View ──────────────────────────────────────────────────────────
  if (detailView) {
    const community = communities.find((c) => c.id === detailView);
    if (!community) { setDetailView(null); return null; }
    const filteredMembers = community.members.filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase()));

    return (
      <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
          @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        `}</style>
        {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}
        <Sidebar />
        <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
            <button onClick={() => setDetailView(null)} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>← Back to Communities</button>
          </header>
          <main style={{ padding: "24px 32px 48px", flex: 1 }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "26px", color: "#0D0D0D", margin: "0 0 24px" }}>{community.name}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
              {/* Left — Settings */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px", alignSelf: "start" }}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Community Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="field-input" style={inputStyle} />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="field-input" style={{ ...inputStyle, height: "80px", padding: "10px 14px", resize: "vertical" }} />
                </div>
                <div style={{ marginBottom: "16px", position: "relative" }}>
                  <label style={labelStyle}>Target Group</label>
                  <select value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="field-input" style={selectStyle}>
                    {targetGroups.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Join Mode</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {["Open", "Invite Only"].map((m) => (
                      <button key={m} onClick={() => setEditJoinMode(m)} style={{ flex: 1, padding: "10px", border: editJoinMode === m ? "2px solid #F04E23" : "1px solid #E5E7EB", borderRadius: "8px", background: editJoinMode === m ? "#FFF4F1" : "white", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: editJoinMode === m ? "#F04E23" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 150ms" }}>
                        {m === "Open" ? <Unlock size={13} /> : <Lock size={13} />} {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Tags</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "6px 10px", minHeight: "36px", alignItems: "center" }}>
                    {editTags.map((t) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "12px", fontWeight: 500, padding: "3px 10px" }}>
                        {t} <button onClick={() => setEditTags((p) => p.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "#F04E23", display: "flex", padding: 0 }}><X size={11} /></button>
                      </span>
                    ))}
                    <input type="text" value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} onKeyDown={handleEditAddTag} placeholder="" style={{ border: "none", outline: "none", flex: 1, minWidth: "60px", fontSize: "13px", fontFamily: "Inter, sans-serif", background: "transparent", padding: "2px 0" }} />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Join Link</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input readOnly value={`https://intellihire.app/community/${community.id}/join`} style={{ flex: 1, height: "40px", background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 12px", fontSize: "12px", color: "#374151", outline: "none", boxSizing: "border-box" }} />
                    <button onClick={() => handleCopyLink(community.id)} style={{ height: "40px", padding: "0 12px", background: copied ? "white" : "#F04E23", color: copied ? "#059669" : "white", border: copied ? "1px solid #059669" : "none", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 200ms" }}>
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <button onClick={handleSaveDetail} style={{ width: "100%", height: "40px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: "12px", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Save Changes</button>
                <button onClick={() => setDeleteConfirm(community.id)} style={{ width: "100%", fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Archive Community</button>
              </div>
              {/* Right — Members */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <Mail size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                    <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }} placeholder="Invite by email…" className="field-input" style={{ ...inputStyle, paddingLeft: "34px" }} />
                  </div>
                  <button onClick={handleInvite} style={{ height: "40px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Send Invite</button>
                </div>
                <div style={{ position: "relative", marginBottom: "16px" }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
                  <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search members…" className="field-input" style={{ ...inputStyle, paddingLeft: "34px" }} />
                </div>
                <h4 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 16px" }}>{community.members.length} Members</h4>
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
                      {filteredMembers.length === 0 ? (
                        <tr><td colSpan="6" style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "#9CA3AF" }}>No members found</td></tr>
                      ) : filteredMembers.map((m, i) => (
                        <tr key={m.email} style={{ borderBottom: i < filteredMembers.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                          <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: 500, color: "#0D0D0D" }}>{m.name}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "#374151" }}>{m.email}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", color: "#374151" }}>{m.joined}</td>
                          <td style={{ padding: "10px 12px" }}>{statusBadge(m.status)}</td>
                          <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 500, color: m.engagement >= 80 ? "#059669" : m.engagement >= 60 ? "#D97706" : "#DC2626" }}>{m.engagement}%</td>
                          <td style={{ padding: "10px 12px" }}>
                            <button onClick={() => handleRemoveMember(m.email)} style={{ fontSize: "12px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Remove</button>
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
        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirm(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "400px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 12px" }}>Archive Community?</h3>
              <p style={{ fontSize: "14px", color: "#374151", margin: "0 0 24px", lineHeight: 1.5 }}>This will remove the community from your active list. Members will be notified.</p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, height: "40px", background: "#DC2626", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Archive</button>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: "40px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Main Grid View ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .community-card { transition: transform 150ms, border-color 150ms; }
        .community-card:hover { transform: translateY(-2px); border-color: #D1D5DB !important; }
        .skill-tag { display: inline-flex; align-items: center; gap: 4px; background: #FFF4F1; color: #F04E23; border-radius: 999px; font-size: 12px; font-weight: 500; padding: 4px 10px; }
      `}</style>
      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}
      <Sidebar />
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>Talent <em style={{ color: "#F04E23", fontStyle: "italic" }}>Communities</em></h1>
          <button onClick={() => setShowCreateModal(true)} style={{ height: "40px", padding: "0 20px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: "6px", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}><Plus size={15} /> Create Community</button>
        </header>
        <main style={{ padding: "24px 32px 48px", flex: 1 }}>
          <p style={{ fontSize: "14px", color: "#9CA3AF", margin: "0 0 16px" }}>Build and manage your long-term candidate pools</p>
          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
            {[{ label: "Total Communities", value: communities.length }, { label: "Active Members", value: totalMembers }, { label: "Jobs Shared This Month", value: 7 }, { label: "Community-to-Hire", value: "12%" }].map((s) => (
              <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: "#0D0D0D" }}>{s.value}</span>
                <span style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>{s.label}</span>
              </div>
            ))}
          </div>
          {communities.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFF4F1", border: "1px solid #FCA68A", borderRadius: "6px", padding: "6px 12px", marginBottom: "24px", fontSize: "12px", color: "#374151" }}>
              <span style={{ color: "#F04E23", fontWeight: 600 }}>Tip:</span> Your "{communities[0].name}" has the highest engagement this month
            </div>
          )}
          {communities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: "16px", color: "#9CA3AF", marginBottom: "16px" }}>No communities yet. Create your first talent pool.</p>
              <button onClick={() => setShowCreateModal(true)} style={{ height: "40px", padding: "0 24px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Create Community +</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
              {communities.map((c, i) => (
                <div key={c.id} className="community-card" style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "24px", background: "white", animation: `fadeIn 300ms ease ${i * 80}ms both`, position: "relative" }}>
                  <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "6px" }}>
                    <button onClick={() => openDetail(c.id)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><Edit3 size={14} /></button>
                    <button onClick={() => setDeleteConfirm(c.id)} title="Archive" style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><Trash2 size={14} /></button>
                  </div>
                  <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", fontWeight: 700, color: "#0D0D0D", margin: "0 0 8px", paddingRight: "50px" }}>{c.name}</h3>
                  <p style={{ fontSize: "13px", color: "#374151", margin: "0 0 12px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.description}</p>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <span style={{ background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{c.members.length} Members</span>
                    <span style={{ background: "#F3F4F6", color: "#374151", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px" }}>{c.targetGroup}</span>
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", marginBottom: "8px", flexWrap: "wrap" }}>
                      {c.tags.slice(0, 3).map((t) => <span key={t} style={{ fontSize: "10px", background: "#F3F4F6", color: "#6B7280", borderRadius: "999px", padding: "2px 8px" }}>{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    {c.joinMode === "Open" ? <Unlock size={12} style={{ color: "#9CA3AF" }} /> : <Lock size={12} style={{ color: "#9CA3AF" }} />}
                    <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{c.joinMode}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "0 0 8px" }}>Updated {c.lastActive}</p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", background: "#FFF4F1", color: "#F04E23", borderRadius: "999px", padding: "2px 8px" }}>{c.activeWeek} active this week</span>
                    <span style={{ fontSize: "11px", background: "#F0FDF4", color: "#059669", borderRadius: "999px", padding: "2px 8px" }}>{c.interviewReady} interview-ready</span>
                  </div>
                  <div style={{ height: "1px", background: "#F3F4F6", marginBottom: "12px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button onClick={() => openDetail(c.id)} style={{ height: "32px", padding: "0 14px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Manage →</button>
                    <button onClick={() => setPostJobModal(c.id)} style={{ height: "32px", padding: "0 12px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Post Job</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCreateModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "480px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: "0 0 20px" }}>Create a Talent Community</h2>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Community Name <span style={{ color: "#F04E23" }}>*</span></label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="field-input" placeholder="e.g. React Talent Pool" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Description</label>
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value.slice(0, 250))} className="field-input" placeholder="Describe the community purpose…" style={{ ...inputStyle, height: "80px", padding: "10px 14px", resize: "vertical" }} />
              <span style={{ fontSize: "12px", color: "#9CA3AF", float: "right" }}>{newDesc.length}/250</span>
            </div>
            <div style={{ marginBottom: "16px", position: "relative" }}>
              <label style={labelStyle}>Target Group</label>
              <select value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="field-input" style={selectStyle}>
                {targetGroups.map((t) => <option key={t}>{t}</option>)}
              </select>
              <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Filter Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "8px 10px", minHeight: "40px", alignItems: "center" }}>
                {newTags.map((t) => (
                  <span key={t} className="skill-tag">{t} <button onClick={() => setNewTags((p) => p.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "#F04E23", display: "flex", padding: 0 }}><X size={12} /></button></span>
                ))}
                <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder={newTags.length === 0 ? "Add tags…" : ""} style={{ border: "none", outline: "none", flex: 1, minWidth: "80px", fontSize: "14px", fontFamily: "Inter, sans-serif", background: "transparent", padding: "4px 0" }} />
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Join Mode</label>
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
            <button onClick={handleCreate} style={{ width: "100%", height: "42px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: "10px", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Create Community →</button>
            <button onClick={() => setShowCreateModal(false)} style={{ width: "100%", fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && !detailView && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "400px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease" }}>
            <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 12px" }}>Archive Community?</h3>
            <p style={{ fontSize: "14px", color: "#374151", margin: "0 0 24px", lineHeight: 1.5 }}>This will remove "{communities.find((c) => c.id === deleteConfirm)?.name}" from your active list.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, height: "40px", background: "#DC2626", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Archive</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: "40px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── POST JOB MODAL ── */}
      {postJobModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPostJobModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "440px", background: "white", borderRadius: "10px", padding: "32px", animation: "modalIn 150ms ease", maxHeight: "70vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", color: "#0D0D0D", margin: "0 0 8px" }}>Post Job Opportunity</h3>
            <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 20px" }}>Select a published job to share with this community.</p>
            {(() => {
              const publishedJobs = getJobs().filter((j) => j.status === "Published");
              if (publishedJobs.length === 0) return <p style={{ fontSize: "14px", color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>No published jobs available</p>;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {publishedJobs.map((j) => (
                    <button key={j.id} onClick={() => handlePostJob(j.title)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: "8px", background: "white", cursor: "pointer", transition: "border-color 150ms", width: "100%", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0 }}>{j.title}</p>
                        <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>{j.department} · {j.location || "Remote"}</p>
                      </div>
                      <span style={{ fontSize: "12px", color: "#F04E23", fontWeight: 500 }}>Post →</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <button onClick={() => setPostJobModal(null)} style={{ width: "100%", fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "center", marginTop: "16px" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyCommunity;
