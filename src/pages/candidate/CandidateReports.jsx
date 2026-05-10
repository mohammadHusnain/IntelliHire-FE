import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  User, 
  Mic2, 
  FileText, 
  LogOut,
  ChevronRight,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Search,
  Filter,
  Download,
  Eye,
  RotateCcw
} from "lucide-react";
import { Toast } from "../../components/shared/Toast";
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

// Report Card Component
const ReportCard = ({ report, onView, onDownload, onRetake }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return "text-[#16A34A] bg-[#DCFCE7]";
    if (score >= 60) return "text-[#F59E0B] bg-[#FEF3C7]";
    return "text-[#DC2626] bg-[#FEE2E2]";
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-[#16A34A] bg-[#DCFCE7]">Completed</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-[#F04E23] bg-[#FFF4F1]">In Progress</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-[#6B7280] bg-[#F3F4F6]">Draft</span>;
    }
  };

  return (
    <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-5 hover:shadow-[0_8px_30px_rgba(240,78,35,0.08)] hover:border-[#FCA68A] hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getStatusBadge(report.status)}
            <span className="text-[12px] text-[#6B7280]">{report.type}</span>
          </div>
          <h3 className="text-[16px] font-semibold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>
            {report.role}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-[12px] text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {report.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {report.duration}
            </span>
          </div>
        </div>
        <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center ${getScoreColor(report.score)}`}>
          <span className="text-[18px] font-bold">{report.score}</span>
          <span className="text-[10px]">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
          <p className="text-[11px] text-[#6B7280]">Communication</p>
          <p className="text-[13px] font-semibold text-[#374151]">{report.breakdown.communication}%</p>
        </div>
        <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
          <p className="text-[11px] text-[#6B7280]">Technical</p>
          <p className="text-[13px] font-semibold text-[#374151]">{report.breakdown.technical}%</p>
        </div>
        <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
          <p className="text-[11px] text-[#6B7280]">Confidence</p>
          <p className="text-[13px] font-semibold text-[#374151]">{report.breakdown.confidence}%</p>
        </div>
        <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
          <p className="text-[11px] text-[#6B7280]">Structure</p>
          <p className="text-[13px] font-semibold text-[#374151]">{report.breakdown.structure}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(report.id)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#F04E23] hover:bg-[#D43D14] text-white rounded-[8px] text-[13px] font-medium transition-colors"
        >
          <Eye size={14} /> View Report
        </button>
        <button
          onClick={() => onDownload(report)}
          className="p-2 text-[#6B7280] hover:text-[#F04E23] hover:bg-[#FFF4F1] rounded-[8px] transition-colors"
          title="Download"
        >
          <Download size={16} />
        </button>
        <button
          onClick={() => onRetake(report.role)}
          className="p-2 text-[#6B7280] hover:text-[#16A34A] hover:bg-[#DCFCE7] rounded-[8px] transition-colors"
          title="Retake Interview"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};

// Empty State Component
const EmptyReportsState = ({ onStartInterview }) => (
  <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-12 text-center">
    <div className="w-16 h-16 rounded-full bg-[#FFF4F1] flex items-center justify-center mx-auto mb-4">
      <FileText size={32} className="text-[#F04E23]" />
    </div>
    <h3 className="text-[18px] font-semibold text-[#111827] mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
      No Reports Yet
    </h3>
    <p className="text-[14px] text-[#6B7280] mb-6 max-w-md mx-auto italic">
      You haven't completed any interviews yet. Start your first mock interview to get detailed AI-powered feedback.
    </p>
    <button
      onClick={onStartInterview}
      className="px-6 py-3 bg-[#F04E23] hover:bg-[#D43D14] text-white rounded-[8px] text-[14px] font-medium flex items-center gap-2 mx-auto transition-colors"
    >
      <Mic2 size={16} /> Start Interview
    </button>
  </div>
);

function CandidateReports() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("reports");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [toast, setToast] = useState(null);

  // Toast helper
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Muslim name user
  const userName = "Ahmed Hassan";
  const userInitials = "AH";

  // Mock reports data
  const reports = [
    {
      id: "123",
      role: "Software Engineer",
      type: "Technical",
      status: "completed",
      date: "May 9, 2026",
      duration: "18 min 42 sec",
      score: 82,
      breakdown: {
        communication: 86,
        technical: 79,
        confidence: 75,
        structure: 70
      }
    },
    {
      id: "122",
      role: "Frontend Developer",
      type: "Technical",
      status: "completed",
      date: "May 5, 2026",
      duration: "15 min 20 sec",
      score: 78,
      breakdown: {
        communication: 80,
        technical: 82,
        confidence: 70,
        structure: 75
      }
    },
    {
      id: "121",
      role: "React Developer",
      type: "Technical",
      status: "completed",
      date: "Apr 28, 2026",
      duration: "20 min 10 sec",
      score: 85,
      breakdown: {
        communication: 88,
        technical: 85,
        confidence: 82,
        structure: 80
      }
    },
    {
      id: "120",
      role: "Full Stack Developer",
      type: "Technical",
      status: "completed",
      date: "Apr 20, 2026",
      duration: "22 min 45 sec",
      score: 71,
      breakdown: {
        communication: 75,
        technical: 70,
        confidence: 68,
        structure: 65
      }
    }
  ];

  // Filter reports
  const filteredReports = reports.filter(report => {
    const matchesSearch = report.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || report.type.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  // Calculate stats
  const averageScore = Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length);
  const completedInterviews = reports.filter(r => r.status === "completed").length;
  const bestScore = Math.max(...reports.map(r => r.score));
  const totalTime = reports.reduce((sum, r) => {
    const [mins] = r.duration.split(" ");
    return sum + parseInt(mins);
  }, 0);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: User },
    { id: "interview", label: "Start Interview", icon: Mic2 },
    { id: "reports", label: "My Reports", icon: FileText },
  ];

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/candidate/dashboard");
    if (navId === "profile") navigate("/candidate/profile");
    if (navId === "interview") navigate("/candidate/interview/setup");
  };

  const handleViewReport = (id) => {
    navigate(`/candidate/report/${id}`);
  };

  const handleDownloadReport = (report) => {
    showToast(`Downloading report for ${report.role}...`, "success");
    // Simulate download delay
    setTimeout(() => {
      showToast(`Report downloaded successfully!`, "success");
    }, 1500);
  };

  const handleRetakeInterview = (role) => {
    showToast(`Starting new interview for ${role}...`, "info");
    setTimeout(() => {
      navigate("/candidate/interview/setup");
    }, 500);
  };

  const handleStartInterview = () => {
    navigate("/candidate/interview/setup");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-['Times_New_Roman']">
      {/* Toast Notification */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-[240px] h-full bg-white border-r border-[#EEEEEE] z-50">
        <div className="h-16 flex items-center px-4 border-b border-[#EEEEEE]">
          <IntelliHireLogo className="w-8 h-8 mr-2" />
          <span className="text-[20px] font-bold text-[#111827]">IntelliHire</span>
        </div>

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

      {/* Main Content */}
      <main className="ml-[240px]">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-[#EEEEEE] flex items-center justify-between px-6 sticky top-0 z-40">
          <h1 className="text-[20px] font-bold text-[#111827]">My Reports</h1>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-[#6B7280]">Ahmed 👋</span>
            
            <div className="relative">
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F04E23] to-[#FFA07A] flex items-center justify-center text-white text-[12px] font-semibold hover:shadow-md transition-shadow"
              >
                {userInitials}
              </button>
              
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
                    <User size={14} /> Edit Profile
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

        {/* Reports Content */}
        <div className="p-6">
          {/* Stats Cards */}
          {reports.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-4 hover:shadow-[0_4px_16px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF4F1] flex items-center justify-center">
                    <TrendingUp size={20} className="text-[#F04E23]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Average Score</p>
                    <p className="text-[20px] font-bold text-[#111827]">{averageScore}/100</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-4 hover:shadow-[0_4px_16px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center">
                    <Award size={20} className="text-[#16A34A]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Best Score</p>
                    <p className="text-[20px] font-bold text-[#111827]">{bestScore}/100</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-4 hover:shadow-[0_4px_16px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                    <Mic2 size={20} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Interviews</p>
                    <p className="text-[20px] font-bold text-[#111827]">{completedInterviews}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#EEEEEE] rounded-[12px] p-4 hover:shadow-[0_4px_16px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF4F1] flex items-center justify-center">
                    <Clock size={20} className="text-[#F04E23]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#6B7280]">Total Time</p>
                    <p className="text-[20px] font-bold text-[#111827]">{totalTime} min</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-[8px] border border-[#E5E7EB] text-[14px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 px-4 rounded-[8px] border border-[#E5E7EB] text-[14px] bg-white outline-none focus:border-[#F04E23] cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          {/* Reports Grid */}
          {filteredReports.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onView={handleViewReport}
                  onDownload={handleDownloadReport}
                  onRetake={handleRetakeInterview}
                />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyReportsState onStartInterview={handleStartInterview} />
          ) : (
            <div className="text-center py-12">
              <p className="text-[14px] text-[#6B7280]">No reports match your search.</p>
              <button
                onClick={() => { setSearchQuery(""); setFilterType("all"); }}
                className="mt-2 text-[14px] text-[#F04E23] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default CandidateReports;
