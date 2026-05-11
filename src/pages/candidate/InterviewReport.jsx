import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard,
  User,
  Mic2,
  FileText,
  Globe,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Calendar,
  Target,
  Settings2,
  Clock,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  MessageCircle,
  Zap,
  Layout
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import useCounter from "../../hooks/useCounter";
import useInView from "../../hooks/useInView";

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

// Enhanced Score Ring Component with glow effect
const ScoreRing = ({ score, size = 120 }) => {
  const getColor = (s) => {
    if (s >= 80) return "#16A34A";
    if (s >= 60) return "#F59E0B";
    return "#DC2626";
  };
  
  const getBgGradient = (s) => {
    if (s >= 80) return "from-[#F0FDF4] to-[#DCFCE7]";
    if (s >= 60) return "from-[#FFFBEB] to-[#FEF3C7]";
    return "from-[#FEF2F2] to-[#FEE2E2]";
  };
  
  const color = getColor(score);
  const bgGradient = getBgGradient(score);
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Animate ring + number together from 0 → score on viewport entry.
  const [ref, inView] = useInView({ threshold: 0.3, once: true });
  const animatedScore = useCounter(score, 1400, inView);
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div ref={ref} className={`relative rounded-full bg-gradient-to-br ${bgGradient} shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-3`} style={{ width: size + 24, height: size + 24 }}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/50 to-transparent" />
      
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle with gradient */}
        <defs>
          <linearGradient id={`scoreGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#scoreGradient-${score})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="drop-shadow-sm"
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span className="text-[42px] font-bold text-[#111827] leading-none" style={{ fontFamily: 'Times New Roman, serif' }}>
          {animatedScore}
        </span>
        <span className="text-[14px] text-[#6B7280] mt-1">/100</span>
      </div>
    </div>
  );
};

// Enhanced Score Breakdown Card with icon
const ScoreCard = ({ label, score, icon }) => {
  const getIcon = () => {
    switch(icon) {
      case 'message-circle': return <MessageCircle size={18} />;
      case 'target': return <Target size={18} />;
      case 'zap': return <Zap size={18} />;
      case 'layout': return <Layout size={18} />;
      default: return null;
    }
  };

  // Sync number + bar fill from 0 → score on viewport entry.
  const [ref, inView] = useInView({ threshold: 0.25, once: true });
  const animatedScore = useCounter(score, 1100, inView);

  return (
    <div ref={ref} className="group bg-gradient-to-br from-white to-[#FAFAFA] border border-[#E5E7EB] rounded-[12px] p-5 hover:shadow-[0_4px_16px_rgba(240,78,35,0.08)] hover:border-[#FCA68A] hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#FFF4F1] to-[#FFE4DC] flex items-center justify-center text-[#F04E23] group-hover:scale-105 transition-transform">
            {getIcon()}
          </div>
          <span className="text-[14px] font-medium text-[#374151]">{label}</span>
        </div>
        <span className="text-[22px] font-bold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>
          {animatedScore}%
        </span>
      </div>
      <div className="relative h-2.5 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#F04E23] to-[#FFA07A] rounded-full group-hover:from-[#D43D14] group-hover:to-[#F04E23]"
          style={{ width: `${animatedScore}%` }}
        />
      </div>
    </div>
  );
};

// Accordion Item
const AccordionItem = ({ question, number, score, answer, aiNote, isOpen, onToggle }) => {
  const getScoreColor = (s) => {
    if (s >= 80) return "bg-[#DCFCE7] text-[#166534]";
    if (s >= 60) return "bg-[#FEF3C7] text-[#92400E]";
    return "bg-[#FEE2E2] text-[#991B1B]";
  };
  
  return (
    <div className="border border-[#E5E7EB] rounded-[10px] overflow-hidden hover:border-[#FCA68A] hover:shadow-[0_2px_8px_rgba(240,78,35,0.05)] transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-[#FFF4F1] transition-colors text-left"
      >
        <span className="px-2 py-1 bg-[#F3F4F6] rounded text-[12px] font-medium text-[#374151]">
          Q{number}
        </span>
        <span className="flex-1 text-[14px] text-[#374151] truncate">
          {question}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getScoreColor(score)}`}>
          {score}/100
        </span>
        {isOpen ? <ChevronDown size={18} className="text-[#6B7280]" /> : <ChevronRight size={18} className="text-[#6B7280]" />}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-[#FFF4F1] border border-[#FCA68A] rounded-lg p-4">
            <p className="text-[13px] text-[#9A3412] font-medium mb-1">Question:</p>
            <p className="text-[14px] text-[#0D0D0D]" style={{ fontFamily: 'Times New Roman, serif' }}>
              {question}
            </p>
          </div>
          
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <p className="text-[13px] text-[#6B7280] font-medium mb-1">Your Answer:</p>
            <p className="text-[14px] text-[#374151]" style={{ fontFamily: 'Times New Roman, serif' }}>
              {answer}
            </p>
          </div>
          
          <p className="text-[13px] text-[#6B7280] italic pl-2 border-l-2 border-[#9CA3AF]">
            {aiNote}
          </p>
        </div>
      )}
    </div>
  );
};

// Download Report Button Component
const DownloadReportButton = ({ reportData }) => {
  const handleDownload = () => {
    // Create a simple HTML report for download
    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>IntelliHire Interview Report - ${reportData.role}</title>
  <style>
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { font-size: 28px; color: #111827; }
    h2 { font-size: 20px; color: #374151; border-bottom: 1px solid #EEEEEE; padding-bottom: 8px; }
    .info { background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .score { font-size: 48px; font-weight: bold; color: #F04E23; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #EEEEEE; padding: 16px; border-radius: 8px; }
    .strength { background: #F0FDF4; border-left: 3px solid #16A34A; padding: 16px; }
    .improve { background: #FFFBEB; border-left: 3px solid #F59E0B; padding: 16px; }
    ul { margin: 8px 0; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <h1>IntelliHire Interview Report</h1>
  <div class="info">
    <strong>Role:</strong> ${reportData.role} | 
    <strong>Type:</strong> ${reportData.type} | 
    <strong>Date:</strong> ${reportData.date} | 
    <strong>Duration:</strong> ${reportData.duration}
  </div>
  
  <h2>Overall Score</h2>
  <div class="score">${reportData.overallScore}/100</div>
  <p><em>${reportData.verdict}</em></p>
  
  <h2>Score Breakdown</h2>
  <div class="grid">
    <div class="card">
      <strong>Communication:</strong> ${reportData.breakdown.communication}%
    </div>
    <div class="card">
      <strong>Technical Accuracy:</strong> ${reportData.breakdown.technicalAccuracy}%
    </div>
    <div class="card">
      <strong>Confidence:</strong> ${reportData.breakdown.confidence}%
    </div>
    <div class="card">
      <strong>Answer Structure:</strong> ${reportData.breakdown.structure}%
    </div>
  </div>
  
  <div class="grid" style="margin-top: 24px;">
    <div class="strength">
      <h3>💪 Strengths</h3>
      <ul>
        ${reportData.strengths.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
    <div class="improve">
      <h3>📈 Focus Areas</h3>
      <ul>
        ${reportData.improvements.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>
  </div>
  
  <h2>AI Recommendations</h2>
  <ol>
    ${reportData.recommendations.map(r => `<li>${r}</li>`).join('')}
  </ol>
  
  <h2>Question Breakdown (${reportData.questions.length} Questions)</h2>
  ${reportData.questions.map((q, i) => `
  <div class="card" style="margin: 12px 0;">
    <strong>Q${i + 1}:</strong> ${q.q}<br>
    <strong>Score:</strong> ${q.score}/100<br>
    <em>${q.aiNote}</em>
  </div>
  `).join('')}
</body>
</html>`;

    // Create and download the file
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IntelliHire_Report_${reportData.role.replace(/\s+/g, '_')}_${reportData.date.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button 
      onClick={handleDownload}
      className="text-[13px] text-[#F04E23] hover:underline flex items-center gap-1"
    >
      <Download size={14} /> Download Report
    </button>
  );
};

function InterviewReport() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { id } = useParams();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState("reports");
  const [openAccordion, setOpenAccordion] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Muslim name user
  const userName = "Ahmed Hassan";
  const userInitials = "AH";

  // Get answers from InterviewRoom navigation state
  const interviewAnswers = location.state?.answers || {};
  const interviewQuestions = location.state?.questions || [];

  // Default questions if none passed
  const defaultQuestions = [
    "Tell me about yourself and your background in software development.",
    "What motivated you to pursue a career in frontend development?",
    "Tell me about a time you had to debug a complex performance issue in a React application. Walk me through your approach.",
    "Describe a challenging project you worked on. What was your role and what was the outcome?",
    "How do you stay updated with the latest frontend technologies and best practices?",
    "Tell me about a time you had to work with a difficult team member. How did you handle it?",
    "What are your strengths and areas you'd like to improve?",
    "Where do you see yourself in 5 years, and how does this role fit into your career goals?"
  ];

  const questions = interviewQuestions.length > 0 ? interviewQuestions : defaultQuestions;

  // Build questions data with actual answers from interview
  const buildQuestionsData = () => {
    const questionData = [];
    for (let i = 1; i <= 8; i++) {
      const qText = questions[i - 1] || `Question ${i}`;
      const answer = interviewAnswers[i] || "No answer provided for this question.";
      // Generate score based on answer length (mock scoring)
      const score = interviewAnswers[i] ? Math.floor(70 + Math.random() * 25) : 0;
      // Generate AI note based on score
      let aiNote = "";
      if (score >= 85) aiNote = "Excellent answer with strong technical depth and clear communication.";
      else if (score >= 75) aiNote = "Good response with solid points. Could add more specific examples.";
      else if (score >= 60) aiNote = "Fair answer. Consider using the STAR method for better structure.";
      else aiNote = "Answer not provided or too brief. Practice elaborating on your responses.";
      
      questionData.push({ q: qText, score, answer, aiNote });
    }
    return questionData;
  };

  const questionsData = buildQuestionsData();
  const answeredCount = Object.keys(interviewAnswers).length;
  const averageScore = answeredCount > 0 
    ? Math.round(questionsData.reduce((sum, q) => sum + q.score, 0) / questionsData.length)
    : 0;

  // Mock report data with actual answers
  const reportData = {
    role: "Software Engineer",
    type: "Technical",
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    duration: answeredCount > 0 ? `${Math.floor(answeredCount * 2)} min 30 sec` : "Not completed",
    overallScore: averageScore || 82,
    verdict: answeredCount > 0 
      ? "Strong performance. Excellent technical depth with room to improve structure."
      : "Interview not completed. Please complete the interview to see your full report.",
    breakdown: {
      communication: Math.round(averageScore * 0.95) || 86,
      technicalAccuracy: Math.round(averageScore * 0.92) || 79,
      confidence: Math.round(averageScore * 0.88) || 75,
      structure: Math.round(averageScore * 0.85) || 70
    },
    strengths: answeredCount > 0 ? [
      "Strong technical vocabulary and accurate use of React terminology",
      "Demonstrated real problem-solving with concrete debugging steps",
      "Maintained composure under follow-up questioning"
    ] : ["Complete the interview to see your strengths"],
    improvements: answeredCount > 0 ? [
      "Answers occasionally lacked a clear structure — use STAR or PREP frameworks",
      "Pauses were sometimes interpreted as uncertainty; brief transitions help",
      "Could elaborate more on trade-offs when discussing architecture decisions"
    ] : ["Complete the interview to see focus areas"],
    recommendations: answeredCount > 0 ? [
      "Practise the STAR method for all behavioural questions — 2 sessions/week recommended",
      "Record yourself for 1 week and review pauses and filler words",
      "Study system design trade-offs (SQL vs NoSQL, REST vs GraphQL)",
      "Explore IntelliHire's \"Advanced React\" role pack for targeted prep"
    ] : ["Complete the interview to get personalized recommendations"],
    questions: questionsData
  };

  const navItems = [
    { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
    { id: "profile",     label: "My Profile",  icon: User },
    { id: "interview",   label: "Interviews",  icon: Mic2 },
    { id: "reports",     label: "My Reports",  icon: FileText },
    { id: "communities", label: "Communities", icon: Globe },
    { id: "settings",    label: "Settings",    icon: Settings },
  ];

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard")   navigate("/candidate/dashboard");
    if (navId === "profile")     navigate("/candidate/profile");
    if (navId === "interview")   navigate("/candidate/interview/setup");
    if (navId === "reports")     navigate("/candidate/reports");
    if (navId === "communities") navigate("/candidate/communities");
    if (navId === "settings")    navigate("/candidate/settings");
  };

  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 w-[240px] h-full bg-white border-r border-[#E5E7EB] z-50">
        <div className="h-16 flex items-center px-4 border-b border-[#E5E7EB]">
          <IntelliHireLogo className="w-8 h-8 mr-2" />
          <span className="text-[20px] font-bold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>IntelliHire</span>
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F04E23] flex items-center justify-center text-white text-[12px] font-semibold">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#111827] truncate">{userName}</p>
            </div>
            <button 
              onClick={logout}
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
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 sticky top-0 z-40">
          <h1 className="text-[22px] font-bold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>Interview <em className="text-[#F04E23] italic">Report</em></h1>
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
                <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-[#E5E7EB] rounded-lg shadow-lg py-1 z-50">
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
                    onClick={() => { logout(); setShowUserDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2] flex items-center gap-2"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Report Content */}
        <div className="p-6 max-w-4xl">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[13px]">
              <button 
                onClick={() => navigate("/candidate/reports")}
                className="text-[#6B7280] hover:text-[#F04E23]"
              >
                My Reports
              </button>
              <ChevronRight size={14} className="text-[#9CA3AF]" />
              <span className="text-[#111827]">{reportData.role} — {reportData.type}</span>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <DownloadReportButton reportData={reportData} />
              <button 
                onClick={() => navigate("/candidate/interview/setup")}
                className="px-4 py-2 border border-[#D1D5DB] text-[#374151] rounded-[8px] text-[13px] hover:border-[#F04E23] hover:text-[#F04E23] flex items-center gap-2 transition-colors"
              >
                <RotateCcw size={14} /> Retake Interview
              </button>
            </div>
          </div>

          {/* Session Info Bar */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-4 mb-6">
            <div className="flex items-center gap-6 text-[14px]">
              <span className="flex items-center gap-1.5 text-[#6B7280]">
                <Calendar size={16} className="text-[#9CA3AF]" />
                {reportData.date}
              </span>
              <span className="flex items-center gap-1.5 text-[#6B7280]">
                <Target size={16} className="text-[#9CA3AF]" />
                {reportData.role}
              </span>
              <span className="flex items-center gap-1.5 text-[#6B7280]">
                <Settings2 size={16} className="text-[#9CA3AF]" />
                {reportData.type}
              </span>
              <span className="flex items-center gap-1.5 text-[#6B7280]">
                <Clock size={16} className="text-[#9CA3AF]" />
                {reportData.duration}
              </span>
            </div>
          </div>

          {/* Enhanced Overall Score Hero */}
          <div className="relative bg-gradient-to-br from-white to-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-8 mb-6 hover:shadow-[0_8px_30px_rgba(240,78,35,0.08)] hover:border-[#FCA68A] transition-all duration-300 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {/* Decorative background shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#F04E23]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#F04E23]/3 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
            
            <div className="relative z-10 flex items-center gap-8">
              {/* Score Ring */}
              <div className="flex-shrink-0">
                <ScoreRing score={reportData.overallScore} />
              </div>
              
              {/* Score Details */}
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    reportData.overallScore >= 80 ? 'bg-[#16A34A] shadow-[0_0_8px_rgba(22,163,74,0.5)]' : 
                    reportData.overallScore >= 60 ? 'bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                    'bg-[#DC2626] shadow-[0_0_8px_rgba(220,38,38,0.5)]'
                  }`} />
                  <span className="text-[12px] uppercase tracking-wider text-[#6B7280] font-medium">
                    {reportData.overallScore >= 80 ? 'Excellent Performance' : 
                     reportData.overallScore >= 60 ? 'Good Performance' : 'Needs Improvement'}
                  </span>
                </div>
                
                <h3 className="text-[22px] font-semibold text-[#111827] mb-3" style={{ fontFamily: 'Times New Roman, serif' }}>
                  Overall Performance Score
                </h3>
                
                <div className="relative bg-white/80 backdrop-blur-sm rounded-[10px] border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l border-b border-[#E2E8F0] rotate-45" />
                  <p className="text-[15px] text-[#4B5563] italic leading-relaxed" style={{ fontFamily: 'Times New Roman, serif' }}>
                    &ldquo;{reportData.verdict}&rdquo;
                  </p>
                </div>
                
                {/* Quick stats row */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF4F1] flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-[#F04E23]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6B7280]">Questions</p>
                      <p className="text-[13px] font-semibold text-[#111827]">{reportData.questions.length} Answered</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <Clock size={16} className="text-[#16A34A]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6B7280]">Duration</p>
                      <p className="text-[13px] font-semibold text-[#111827]">{reportData.duration}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Score Breakdown Grid */}
          <div className="mb-6">
            <h4 className="text-[14px] font-bold text-[#111827] mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#F04E23] rounded-full" />
              Score Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard label="Communication" score={reportData.breakdown.communication} icon="message-circle" />
              <ScoreCard label="Technical Accuracy" score={reportData.breakdown.technicalAccuracy} icon="target" />
              <ScoreCard label="Confidence" score={reportData.breakdown.confidence} icon="zap" />
              <ScoreCard label="Answer Structure" score={reportData.breakdown.structure} icon="layout" />
            </div>
          </div>

          {/* Enhanced Strengths & Improvements */}
          <div className="mb-6">
            <h4 className="text-[14px] font-bold text-[#111827] mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#F04E23] rounded-full" />
              Performance Analysis
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="relative bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] rounded-[14px] p-5 overflow-hidden group hover:shadow-[0_4px_20px_rgba(22,163,74,0.12)] transition-shadow">
                {/* Decorative shape */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#16A34A]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[12px] bg-[#16A34A] flex items-center justify-center shadow-[0_4px_12px_rgba(22,163,74,0.3)]">
                      <CheckCircle2 size={20} className="text-white" />
                    </div>
                    <h4 className="text-[15px] font-bold text-[#166534]">Strengths</h4>
                  </div>
                  <ul className="space-y-3">
                    {reportData.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] text-[#374151] bg-white/60 rounded-lg p-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mt-2 flex-shrink-0" />
                        <span style={{ fontFamily: 'Times New Roman, serif' }}>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Areas to Improve */}
              <div className="relative bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] rounded-[14px] p-5 overflow-hidden group hover:shadow-[0_4px_20px_rgba(245,158,11,0.12)] transition-shadow">
                {/* Decorative shape */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[12px] bg-[#F59E0B] flex items-center justify-center shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
                      <AlertCircle size={20} className="text-white" />
                    </div>
                    <h4 className="text-[15px] font-bold text-[#92400E]">Focus Areas</h4>
                  </div>
                  <ul className="space-y-3">
                    {reportData.improvements.map((improvement, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] text-[#374151] bg-white/60 rounded-lg p-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mt-2 flex-shrink-0" />
                        <span style={{ fontFamily: 'Times New Roman, serif' }}>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-6 mb-6 hover:shadow-[0_4px_16px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
            <h4 className="text-[16px] font-bold text-[#111827] mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
              AI Recommendations
            </h4>
            <p className="text-[12px] italic text-[#6B7280] mb-4">Personalised action items based on your interview performance.</p>
            <ol className="space-y-3">
              {reportData.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FFF4F1] text-[#F04E23] flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-[#374151]" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {rec}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Question Breakdown Accordion */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h4 className="text-[16px] font-bold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>
                Question Breakdown
              </h4>
              <span className="text-[13px] text-[#6B7280]">({reportData.questions.length} Questions)</span>
            </div>
            
            <div className="space-y-2">
              {reportData.questions.map((q, i) => (
                <AccordionItem
                  key={i}
                  question={q.q}
                  number={i + 1}
                  score={q.score}
                  answer={q.answer}
                  aiNote={q.aiNote}
                  isOpen={openAccordion === i}
                  onToggle={() => toggleAccordion(i)}
                />
              ))}
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
            <button
              onClick={() => navigate("/candidate/reports")}
              className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              <ChevronLeft size={16} /> Back to My Reports
            </button>
            
            <button
              onClick={() => navigate("/candidate/interview/setup")}
              className="px-5 py-2.5 bg-[#F04E23] hover:bg-[#D43D14] text-white rounded-[8px] text-[14px] font-medium flex items-center gap-2 transition-colors"
            >
              Retake This Interview <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InterviewReport;
