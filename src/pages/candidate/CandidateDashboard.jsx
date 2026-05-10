import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  User, 
  Mic2, 
  FileText, 
  LogOut,
  ArrowRight,
  TrendingUp,
  Calendar,
  Award,
  Lightbulb,
  ChevronRight,
  Search,
  RefreshCw
} from "lucide-react";
import { Toast } from "../../components/shared/Toast";
import { EmptyState } from "../../components/shared/EmptyState";
import { SkeletonStatCard, SkeletonSessionCard } from "../../components/shared/SkeletonLoader";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

// Sidebar Navigation Item
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 h-[40px] text-[14px] transition-all ${
      active 
        ? "border-l-[3px] border-[#F04E23] bg-[#FFF4F1] text-[#F04E23] font-medium" 
        : "border-l-[3px] border-transparent text-[#374151] hover:bg-[#F9FAFB]"
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

// Enhanced Stat Card Component
const StatCard = ({ value, label, trend, trendValue, sparkline, icon: Icon }) => (
  <div className="relative bg-gradient-to-br from-white to-[#F8FAFC] border border-[#E5E7EB] rounded-[14px] p-5 overflow-hidden group hover:shadow-[0_8px_30px_rgba(240,78,35,0.08)] hover:border-[#FCA68A] transition-all duration-300">
    {/* Decorative background shape */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#F04E23]/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
    
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[40px] font-bold text-[#111827] leading-none" style={{ fontFamily: 'Times New Roman, serif' }}>
          {value}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#FFF4F1] to-[#FFE4DC] flex items-center justify-center text-[#F04E23] group-hover:scale-105 transition-transform">
            <Icon size={20} />
          </div>
        )}
      </div>
      
      <div className="text-[13px] text-[#6B7280]">{label}</div>
      
      {trend && (
        <div className={`flex items-center gap-1.5 mt-3 px-2 py-1 rounded-full text-[12px] font-medium w-fit ${
          trend === 'up' ? 'bg-[#FFF4F1] text-[#F04E23]' : 'bg-[#FEF2F2] text-[#DC2626]'
        }`}>
          <TrendingUp size={12} />
          <span>{trendValue}</span>
        </div>
      )}
      
      {sparkline && (
        <div className="mt-4 h-10 flex items-end gap-[3px]">
          {[40, 60, 45, 70, 55, 80, 65, 75].map((h, i) => (
            <div key={i} 
              className="flex-1 bg-gradient-to-t from-[#FFA07A] to-[#F04E23]/30 rounded-t-[2px] transition-all duration-300 group-hover:from-[#F04E23] group-hover:to-[#FFA07A]" 
              style={{ height: `${h}%` }} 
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

// Enhanced Session Card Component
const SessionCard = ({ role, date, type, score, onClick }) => {
  const getScoreStyle = (s) => {
    if (s >= 80) return {
      badge: 'bg-gradient-to-r from-[#DCFCE7] to-[#BBF7D0] text-[#166534] border border-[#86EFAC]',
      ring: 'shadow-[0_0_0_3px_#DCFCE7]',
      color: '#16A34A'
    };
    if (s >= 60) return {
      badge: 'bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] text-[#92400E] border border-[#FCD34D]',
      ring: 'shadow-[0_0_0_3px_#FEF3C7]',
      color: '#F59E0B'
    };
    return {
      badge: 'bg-gradient-to-r from-[#FEE2E2] to-[#FECACA] text-[#991B1B] border border-[#FCA5A5]',
      ring: 'shadow-[0_0_0_3px_#FEE2E2]',
      color: '#DC2626'
    };
  };
  
  const scoreStyle = getScoreStyle(score);
  
  const typeBadge = type === 'Technical' ? 'bg-[#FFF4F1] text-[#F04E23] border border-[#FCA68A]' :
                    type === 'Role-Specific' ? 'bg-[#FFF4F1] text-[#F04E23] border border-[#FCA68A]' :
                    'bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]';

  return (
    <div 
      onClick={onClick}
      className="group relative bg-gradient-to-br from-white to-[#FAFAFA] border border-[#E5E7EB] rounded-[14px] p-4 hover:shadow-[0_8px_24px_rgba(240,78,35,0.1)] hover:border-[#FCA68A] transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Decorative gradient on hover */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#F04E23]/5 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-[16px] font-semibold text-[#111827] truncate" style={{ fontFamily: 'Times New Roman, serif' }}>
              {role}
            </h4>
            <p className="text-[13px] text-[#6B7280] mt-1 flex items-center gap-1.5">
              <Calendar size={13} className="text-[#9CA3AF]" />
              {date}
            </p>
          </div>
          <div className={`flex-shrink-0 ml-3 w-14 h-14 rounded-full flex flex-col items-center justify-center ${scoreStyle.ring} transition-shadow`}>
            <span className="text-[18px] font-bold" style={{ color: scoreStyle.color, fontFamily: 'Times New Roman, serif' }}>
              {score}
            </span>
            <span className="text-[9px] text-[#9CA3AF]">/100</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F0]">
          <span className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium ${typeBadge}`}>
            {type}
          </span>
          <button className="flex items-center gap-1 text-[13px] text-[#F04E23] font-medium group-hover:gap-2 transition-all">
            View Report <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Tip Card Component
const TipCard = ({ icon: Icon, title, description }) => (
  <div className="flex gap-4 py-3 group">
    <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#FFA07A] to-[#F04E23] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm">
      <Icon size={18} className="text-white" />
    </div>
    <div className="flex-1">
      <h5 className="text-[15px] font-semibold text-[#111827] mb-1" style={{ fontFamily: 'Times New Roman, serif' }}>
        {title}
      </h5>
      <p className="text-[13px] text-[#6B7280] leading-relaxed">{description}</p>
    </div>
  </div>
);

function CandidateDashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [greeting, setGreeting] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Toast notification
  const [toast, setToast] = useState(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Notification indicator
  const [hasNotifications, setHasNotifications] = useState(true);
  
  // Show toast helper
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Muslim name user
  const userName = "Ahmed Hassan";
  const userInitials = "AH";

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: User },
    { id: "interview", label: "Start Interview", icon: Mic2 },
    { id: "reports", label: "My Reports", icon: FileText },
  ];

  const recentSessions = [
    { role: "Frontend Developer", date: "Apr 28, 2025", type: "Technical", score: 82 },
    { role: "Product Manager", date: "Apr 21, 2025", type: "Role-Specific", score: 69 },
    { role: "Data Analyst", date: "Apr 14, 2025", type: "General", score: 61 },
  ];

  const tips = [
    { 
      icon: Award, 
      title: "Use the STAR method", 
      description: "STAR structures your answers clearly for behavioural questions." 
    },
    { 
      icon: Lightbulb, 
      title: "Practise pausing", 
      description: "2 seconds of pause shows confidence before answering." 
    },
    { 
      icon: User, 
      title: "Complete your profile", 
      description: "CV-matched questions dramatically improve relevance." 
    },
  ];

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "profile") {
      showToast("Navigating to profile...", "info");
      navigate("/candidate/profile");
    }
    if (navId === "interview") {
      showToast("Starting interview setup...", "info");
      navigate("/candidate/interview/setup");
    }
    if (navId === "reports") {
      showToast("Loading your reports...", "info");
      navigate("/candidate/reports");
    }
  };
  
  // Filter sessions based on search
  const filteredSessions = recentSessions.filter(session => 
    session.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.type.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Refresh data handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast("Dashboard refreshed successfully!", "success");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-['Times_New_Roman']">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-[240px] h-full bg-white border-r border-[#EEEEEE] z-50">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-[#EEEEEE]">
          <IntelliHireLogo className="w-8 h-8 mr-2" />
          <span className="text-[20px] font-bold text-[#111827]">IntelliHire</span>
        </div>

        {/* Navigation */}
        <nav className="py-4">
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

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#EEEEEE]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F04E23] flex items-center justify-center text-white text-[12px] font-semibold">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#111827] truncate">{userName}</p>
            </div>
            <button 
              onClick={() => navigate("/login")}
              className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Main Content */}
      <main className="ml-[240px]">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-[#EEEEEE] flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="text-[20px] font-bold text-[#111827]">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-[#6B7280]">{greeting}, {userName.split(' ')[0]} 👋</span>
            
            {/* Avatar with Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F04E23] to-[#FFA07A] flex items-center justify-center text-white text-[12px] font-semibold hover:shadow-md transition-shadow"
              >
                {userInitials}
              </button>
              
              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-[#EEEEEE] rounded-lg shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-[#F3F4F6]">
                    <p className="text-[13px] font-medium text-[#111827]">{userName}</p>
                    <p className="text-[11px] text-[#6B7280]">ahmed.hassan@email.com</p>
                  </div>
                  <button 
                    onClick={() => { navigate("/candidate/profile"); setShowUserDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2"
                  >
                    <Pencil size={14} /> Edit Profile
                  </button>
                  <button 
                    onClick={() => { navigate("/login"); setShowUserDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] flex items-center gap-2"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Enhanced Welcome Banner */}
          <div className="relative bg-gradient-to-br from-white to-[#F8FAFC] border border-[#E5E7EB] rounded-[16px] p-6 mb-6 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            {/* Decorative background shapes */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-[#F04E23]/8 to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#F04E23]/5 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#F0FDF4] to-[#DCFCE7] border border-[#BBF7D0] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                    <span className="text-[12px] font-medium text-[#166534]">+12 points improvement</span>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 text-[#6B7280] hover:text-[#F04E23] hover:bg-[#FFF4F1] rounded-full transition-all disabled:opacity-50"
                    title="Refresh dashboard"
                  >
                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                  </button>
                </div>
                
                <h2 className="text-[26px] font-semibold text-[#111827] leading-tight" style={{ fontFamily: 'Times New Roman, serif' }}>
                  Ready for your next interview,<br />{userName.split(' ')[0]}?
                </h2>
                <p className="text-[15px] text-[#6B7280] mt-3 max-w-md italic">
                  You've shown great progress in the last 7 days. Keep practicing to reach your target score of <span className="font-bold text-[#F04E23] not-italic">85/100</span>.
                </p>
              </div>
              
              <button 
                onClick={() => {
                  showToast("Starting interview setup...", "info");
                  navigate("/candidate/interview/setup");
                }}
                className="relative bg-gradient-to-r from-[#F04E23] to-[#FFA07A] hover:bg-[#D43D14] hover:to-[#FFA07A] text-white px-6 py-3 rounded-[12px] text-[15px] font-medium flex items-center gap-2 transition-all shadow-[0_4px_16px_rgba(240,78,35,0.3)] hover:shadow-[0_6px_20px_rgba(240,78,35,0.4)] hover:-translate-y-0.5 active:translate-y-0"
              >
                Start New Interview <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Enhanced Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {isLoading ? (
              <>
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </>
            ) : (
              <>
                <StatCard 
                  value="14" 
                  label="Sessions Completed" 
                  sparkline={true}
                  icon={Calendar}
                />
                <StatCard 
                  value="73/100" 
                  label="Avg. Interview Score" 
                  sparkline={true}
                  icon={Award}
                />
                <StatCard 
                  value="+18%" 
                  label="Score Improvement" 
                  trend="up"
                  trendValue="Up from 55%"
                  icon={TrendingUp}
                />
              </>
            )}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left Column - Recent Sessions */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-[16px] font-medium text-[#111827]">Recent Sessions</h3>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 h-9 pl-9 pr-3 rounded-lg border border-[#E5E7EB] text-[13px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => navigate("/candidate/reports")}
                    className="text-[14px] text-[#F04E23] hover:bg-[#FFF4F1] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    View All <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {isLoading ? (
                  <>
                    <SkeletonSessionCard />
                    <SkeletonSessionCard />
                    <SkeletonSessionCard />
                  </>
                ) : filteredSessions.length > 0 ? (
                  filteredSessions.map((session, index) => (
                    <SessionCard
                      key={index}
                      role={session.role}
                      date={session.date}
                      type={session.type}
                      score={session.score}
                      onClick={() => {
                        showToast(`Opening report for ${session.role}...`, "info");
                        navigate(`/candidate/report/${index + 1}`);
                      }}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon="search"
                    title="No sessions found"
                    description={`No sessions match "${searchQuery}". Try a different search term.`}
                    action={searchQuery !== ""}
                    actionLabel="Clear Search"
                    onAction={() => setSearchQuery("")}
                  />
                )}
              </div>
            </div>

            {/* Right Column - Quick Tips & Notifications */}
            <div className="space-y-4">
              {/* Notifications Widget */}
              <div className="relative bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-medium text-[#111827]">Notifications</h3>
                    {hasNotifications && (
                      <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
                    )}
                  </div>
                  <button 
                    onClick={() => setHasNotifications(false)}
                    className="text-[12px] text-[#6B7280] hover:text-[#F04E23] transition-colors"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="space-y-2">
                  {hasNotifications ? (
                    <>
                      <div className="flex items-start gap-2 p-2 bg-[#FFF4F1] rounded-lg cursor-pointer hover:bg-[#FFF4F1] transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#F04E23] mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-[13px] text-[#374151]">New feedback available for your last interview</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">2 hours ago</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 hover:bg-[#F9FAFB] rounded-lg cursor-pointer transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#9CA3AF] mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-[13px] text-[#374151]">Complete your profile to unlock CV-matched questions</p>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">1 day ago</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px] text-[#6B7280] text-center py-4">No new notifications</p>
                  )}
                </div>
              </div>
              
              {/* Quick Tips */}
              <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-[#F59E0B]" />
                  <h3 className="text-[14px] font-medium text-[#6B7280]">Suggested for You</h3>
                </div>
                <div className="divide-y divide-[#F0F0F0]">
                  {tips.map((tip, index) => (
                    <TipCard
                      key={index}
                      icon={tip.icon}
                      title={tip.title}
                      description={tip.description}
                    />
                  ))}
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-[#F04E23] to-[#FFA07A] rounded-[14px] p-4 text-white hover:shadow-[0_8px_30px_rgba(240,78,35,0.2)] transition-all duration-300">
                <h3 className="text-[14px] font-bold mb-1">Quick Actions</h3>
                <p className="text-[11px] text-white/70 italic mb-3">Jump back in where you left off.</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => navigate("/candidate/interview/setup")}
                    className="w-full flex items-center gap-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-[13px]"
                  >
                    <Mic2 size={14} />
                    Start Practice Interview
                  </button>
                  <button 
                    onClick={() => navigate("/candidate/profile")}
                    className="w-full flex items-center gap-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-[13px]"
                  >
                    <User size={14} />
                    Update Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CandidateDashboard;
