import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, User, Mic2, FileText, Globe, Settings, LogOut,
  Search, Users, Briefcase, Lock, CheckCircle2, Clock,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import { COMMUNITIES, COMMUNITY_CATEGORIES } from "../../data/communitiesData";

const XCircleIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

// ─── Nav Item ────────────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 h-[40px] text-[14px] transition-all ${
      active
        ? "border-l-[3px] border-[#F04E23] bg-[#FFF4F1] text-[#F04E23] font-medium"
        : "border-l-[3px] border-transparent text-[#374151] hover:bg-[#F9FAFB]"
    }`}>
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:  { icon: Clock,        color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "Pending" },
    approved: { icon: CheckCircle2, color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "Member"  },
    rejected: { icon: XCircleIcon,   color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Rejected" },
  };
  const s = map[status];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      <Icon size={11} /> {s.label}
    </span>
  );
};

// ─── Community Card ───────────────────────────────────────────────────────────
function CommunityCard({ community, requestStatus, onJoin }) {
  const joined = requestStatus === "approved";
  const pending = requestStatus === "pending";
  const rejected = requestStatus === "rejected";

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:border-[#FCA68A] transition-all flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[15px] font-bold shrink-0"
          style={{ background: community.avatarBg }}>
          {community.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-[#111827] truncate">{community.name}</h3>
            {!community.isOpen && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F3F4F6] text-[#6B7280] text-[11px] rounded-full border border-[#E5E7EB]">
                <Lock size={9} /> Private
              </span>
            )}
          </div>
          <span className="text-[12px] text-[#9CA3AF]">{community.category}</span>
        </div>
        {requestStatus && <StatusBadge status={requestStatus} />}
      </div>

      {/* Description */}
      <p className="text-[13px] text-[#6B7280] leading-relaxed line-clamp-2">{community.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {community.tags.map((t) => (
          <span key={t} className="px-2.5 py-0.5 bg-[#F3F4F6] text-[#374151] text-[11px] rounded-full font-medium">
            {t}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[12px] text-[#9CA3AF]">
        <span className="flex items-center gap-1.5"><Users size={13} /> {community.members.toLocaleString()} members</span>
        <span className="flex items-center gap-1.5"><Briefcase size={13} /> {community.postedJobs} jobs</span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          {community.activeThisWeek} active this week
        </span>
      </div>

      {/* Action */}
      <button
        onClick={() => !joined && !pending && onJoin(community.id)}
        disabled={joined || pending}
        className={`w-full h-[38px] rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
          joined
            ? "bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] cursor-default"
            : pending
            ? "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] cursor-default"
            : rejected
            ? "bg-[#F04E23] hover:bg-[#D43D14] text-white"
            : "bg-[#F04E23] hover:bg-[#D43D14] text-white"
        }`}>
        {joined   ? <><CheckCircle2 size={14} /> Joined</> :
         pending  ? <><Clock size={14} /> Request Pending</> :
         rejected ? "Request Again" :
         community.isOpen ? "Join Community" : <><Lock size={13} /> Request to Join</>}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function CandidateCommunities() {
  const navigate = useNavigate();
  const logout = useLogout();

  const [activeNav, setActiveNav] = useState("communities");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  // Map of communityId → "pending" | "approved" | "rejected"
  const [requestStatuses, setRequestStatuses] = useState({});
  const [toast, setToast] = useState(null);

  const navItems = [
    { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
    { id: "profile",     label: "My Profile",  icon: User },
    { id: "interview",   label: "Interviews",  icon: Mic2 },
    { id: "reports",     label: "My Reports",  icon: FileText },
    { id: "communities", label: "Communities", icon: Globe },
    { id: "settings",    label: "Settings",    icon: Settings },
  ];

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "dashboard")   navigate("/candidate/dashboard");
    if (id === "profile")     navigate("/candidate/profile");
    if (id === "interview")   navigate("/candidate/interview/setup");
    if (id === "reports")     navigate("/candidate/reports");
    if (id === "settings")    navigate("/candidate/settings");
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleJoin = (communityId) => {
    const community = COMMUNITIES.find((c) => c.id === communityId);
    setRequestStatuses((prev) => ({ ...prev, [communityId]: "pending" }));

    // Simulate approval for open communities, pending for private
    if (community?.isOpen) {
      setTimeout(() => {
        setRequestStatuses((prev) => ({ ...prev, [communityId]: "approved" }));
        showToast(`You joined ${community.name}!`);
      }, 1500);
    } else {
      showToast(`Join request sent to ${community?.name}.`, "info");
    }
  };

  const filtered = useMemo(() => {
    return COMMUNITIES.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCat = activeCategory === "All" || c.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [search, activeCategory]);

  const myCount = Object.values(requestStatuses).filter((s) => s === "approved").length;
  const pendingCount = Object.values(requestStatuses).filter((s) => s === "pending").length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F9FAFB", fontFamily: "Inter, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: "240px", background: "white", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 40 }}>
        <div style={{ height: "64px", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #E5E7EB" }}>
          <IntelliHireLogo className="w-8 h-8 mr-2" />
          <span style={{ fontFamily: "Times New Roman, serif", fontSize: "20px", fontWeight: 700, color: "#111827" }}>IntelliHire</span>
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label}
              active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />
          ))}
        </nav>
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>AH</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ahmed Hassan</p>
              <span style={{ fontSize: "11px", color: "#F04E23", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Candidate</span>
            </div>
            <button onClick={logout}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header style={{ height: "64px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 30 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Candidate <em style={{ color: "#F04E23", fontStyle: "italic" }}>Communities</em>
          </h1>
          <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#6B7280" }}>
            {myCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} color="#16A34A" />
                <span style={{ color: "#16A34A", fontWeight: 600 }}>{myCount}</span> joined
              </span>
            )}
            {pendingCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={14} color="#D97706" />
                <span style={{ color: "#D97706", fontWeight: 600 }}>{pendingCount}</span> pending
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: "32px", flex: 1 }}>

          {/* Intro banner */}
          <div style={{ background: "linear-gradient(135deg, #F04E23 0%, #FF7043 100%)", borderRadius: "16px", padding: "24px 28px", marginBottom: "28px", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px", fontFamily: "Times New Roman, serif" }}>Discover Your Community</h2>
              <p style={{ fontSize: "14px", opacity: 0.85, margin: 0 }}>Join talent communities to discover jobs, referrals, and industry connections.</p>
            </div>
            <div style={{ display: "flex", gap: "20px", flexShrink: 0 }}>
              {[
                { value: COMMUNITIES.length, label: "Communities" },
                { value: COMMUNITIES.reduce((s, c) => s + c.members, 0).toLocaleString(), label: "Members" },
                { value: COMMUNITIES.reduce((s, c) => s + c.postedJobs, 0), label: "Active Jobs" },
              ].map(({ value, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{value}</p>
                  <p style={{ fontSize: "12px", opacity: 0.75, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search + Filter row */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search communities, skills, tags…"
                style={{ width: "100%", height: "40px", paddingLeft: "36px", paddingRight: "12px", border: "1px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", background: "white" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {COMMUNITY_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  style={{
                    height: "36px", padding: "0 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 500,
                    cursor: "pointer", border: "1px solid",
                    borderColor: activeCategory === cat ? "#F04E23" : "#E5E7EB",
                    background: activeCategory === cat ? "#FFF4F1" : "white",
                    color: activeCategory === cat ? "#F04E23" : "#6B7280",
                    transition: "all 150ms",
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p style={{ fontSize: "13px", color: "#9CA3AF", marginBottom: "16px" }}>
            Showing <strong style={{ color: "#374151" }}>{filtered.length}</strong> {filtered.length === 1 ? "community" : "communities"}
          </p>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
              <Users size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#374151" }}>No communities found</p>
              <p style={{ fontSize: "14px" }}>Try adjusting your search or filter.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
              {filtered.map((c) => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  requestStatus={requestStatuses[c.id] || null}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "success" ? "#16A34A" : toast.type === "info" ? "#1D4ED8" : "#DC2626",
          color: "white", padding: "12px 20px", borderRadius: "12px",
          fontSize: "14px", fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", gap: "8px", maxWidth: "320px",
        }}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default CandidateCommunities;
