import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  User,
  Mic2,
  FileText,
  LogOut,
  MessageCircle,
  Settings2,
  Target,
  Check,
  ChevronRight,
  Search,
  ArrowRight,
  FileText as FileIcon,
  Clock
} from "lucide-react";
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

// Interview Type Card
const InterviewTypeCard = ({ icon: Icon, title, description, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`relative p-5 rounded-[10px] border-2 text-left transition-all h-[120px] ${
      selected 
        ? "border-[#F04E23] bg-[#FFF4F1]" 
        : "border-[#EEEEEE] bg-white hover:border-[#CCCCCC]"
    }`}
  >
    {selected && (
      <div className="absolute top-2 right-2 w-5 h-5 bg-[#F04E23] rounded-full flex items-center justify-center">
        <Check size={12} className="text-white" />
      </div>
    )}
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
      selected ? "bg-[#F04E23]" : "bg-[#F3F4F6]"
    }`}>
      <Icon size={16} className={selected ? "text-white" : "text-[#6B7280]"} />
    </div>
    <h4 className="text-[14px] font-semibold text-[#111827]">{title}</h4>
    <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{description}</p>
  </button>
);

// Toggle Switch Component
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors ${
      disabled ? "bg-[#E5E7EB] cursor-not-allowed" : checked ? "bg-[#F04E23]" : "bg-[#D1D5DB]"
    }`}
  >
    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
      checked ? "translate-x-5" : "translate-x-0"
    }`} />
  </button>
);

function InterviewSetup() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("interview");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Muslim name user
  const userName = "Ahmed Hassan";
  const userInitials = "AH";
  const hasCV = true; // Mock: user has CV uploaded
  const cvFileName = "Ahmed_Hassan_Resume_2025.pdf";

  // Interview setup state
  const [interviewType, setInterviewType] = useState(null);
  const [targetRole, setTargetRole] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [customRole, setCustomRole] = useState("");
  const [useCV, setUseCV] = useState(hasCV);
  
  const roleInputRef = useRef(null);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: User },
    { id: "interview", label: "Start Interview", icon: Mic2 },
    { id: "reports", label: "My Reports", icon: FileText },
  ];

  const commonRoles = [
    "Software Engineer",
    "Frontend Developer", 
    "Product Manager",
    "Data Analyst",
    "UX Designer",
    "Marketing Manager",
    "Business Analyst",
    "DevOps Engineer",
    "Project Manager",
    "Graphic Designer"
  ];

  const filteredRoles = targetRole 
    ? commonRoles.filter(role => role.toLowerCase().includes(targetRole.toLowerCase()))
    : commonRoles;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/candidate/dashboard");
    if (navId === "profile") navigate("/candidate/profile");
    if (navId === "reports") navigate("/candidate/reports");
  };

  const handleRoleSelect = (role) => {
    setTargetRole(role);
    setCustomRole("");
    setRoleDropdownOpen(false);
  };

  const handleCustomRole = () => {
    if (targetRole.trim()) {
      setCustomRole(targetRole);
      setRoleDropdownOpen(false);
    }
  };

  // Determine if all steps are complete
  const canStart = interviewType && (targetRole.length >= 2 || customRole);

  // Generate AI note based on selections
  const getAINote = () => {
    if (!interviewType || !targetRole) return null;
    const typeFocus = interviewType === "Technical" ? "React, TypeScript, and system design concepts" :
                      interviewType === "Role-Specific" ? "Frontend architecture and UI/UX patterns" :
                      "communication, problem-solving, and soft skills";
    return useCV && hasCV 
      ? `I'll focus on ${typeFocus} from your CV background.`
      : `I'll cover ${typeFocus} relevant to your target role.`;
  };

  const interviewTypes = [
    { id: "general", icon: MessageCircle, title: "General", description: "Broad soft skills & communication" },
    { id: "technical", icon: Settings2, title: "Technical", description: "Domain knowledge & problem-solving" },
    { id: "role-specific", icon: Target, title: "Role-Specific", description: "Targeted questions for your exact role" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-['Times_New_Roman']">
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
          <div className="flex items-center gap-4">
            <h1 className="text-[20px] font-bold text-[#111827]">Start Interview</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-[#6B7280]">Ahmed 👋</span>
            
            {/* Avatar with Dropdown */}
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

        {/* Setup Content */}
        <div className="p-8 max-w-5xl">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-4">
            <button onClick={() => navigate("/candidate/dashboard")} className="hover:text-[#F04E23]">Dashboard</button>
            <ChevronRight size={14} />
            <span className="text-[#111827]">Start Interview</span>
          </nav>

          {/* Header */}
          <h1 className="text-[26px] text-[#111827] mb-8" style={{ fontFamily: 'Times New Roman, serif' }}>
            Set Up Your Interview
          </h1>

          {/* Two Column Layout */}
          <div className="grid grid-cols-[65%_35%] gap-6">
            {/* Left Column - Step Configuration */}
            <div className="space-y-6">
              {/* Step 1 - Interview Type */}
              <div className="bg-white border border-[#EEEEEE] rounded-[10px] p-6">
                <h3 className="text-[14px] font-medium text-[#6B7280] uppercase tracking-wider mb-4">
                  Step 1 — Choose Interview Type
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {interviewTypes.map((type) => (
                    <InterviewTypeCard
                      key={type.id}
                      icon={type.icon}
                      title={type.title}
                      description={type.description}
                      selected={interviewType === type.id}
                      onClick={() => setInterviewType(type.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Step 2 - Target Role */}
              <div className={`bg-white border border-[#EEEEEE] rounded-[10px] p-6 transition-opacity ${interviewType ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <h3 className="text-[14px] font-medium text-[#6B7280] uppercase tracking-wider mb-4">
                  Step 2 — What role are you preparing for?
                </h3>
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      ref={roleInputRef}
                      type="text"
                      value={targetRole}
                      onChange={(e) => {
                        setTargetRole(e.target.value);
                        setRoleDropdownOpen(true);
                        setCustomRole("");
                      }}
                      onFocus={() => setRoleDropdownOpen(true)}
                      placeholder="Search or type a role..."
                      className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#DDDDDD] text-[15px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  
                  {/* Dropdown */}
                  {roleDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#EEEEEE] rounded-lg shadow-lg max-h-60 overflow-auto z-10">
                      {targetRole && !commonRoles.some(r => r.toLowerCase() === targetRole.toLowerCase()) && (
                        <button
                          onClick={handleCustomRole}
                          className="w-full px-4 py-3 text-left text-[14px] text-[#F04E23] hover:bg-[#F9FAFB] border-b border-[#F3F4F6]"
                        >
                          Use &quot;{targetRole}&quot;
                        </button>
                      )}
                      {filteredRoles.map((role) => (
                        <button
                          key={role}
                          onClick={() => handleRoleSelect(role)}
                          className="w-full px-4 py-2.5 text-left text-[14px] text-[#374151] hover:bg-[#F9FAFB]"
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {customRole && (
                  <p className="text-[12px] text-[#F04E23] mt-2">Custom role: {customRole}</p>
                )}
              </div>

              {/* Step 3 - CV Personalisation */}
              <div className={`bg-white border border-[#EEEEEE] rounded-[10px] p-6 transition-opacity ${targetRole ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                <h3 className="text-[14px] font-medium text-[#6B7280] uppercase tracking-wider mb-4">
                  Step 3 — Personalise Your Questions
                </h3>
                
                <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                      <FileIcon size={20} className="text-[#DC2626]" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#111827]">Use my CV for AI-matched questions</p>
                      {hasCV && useCV && (
                        <p className="text-[12px] text-[#6B7280]">
                          The AI will reference your skills from {cvFileName}
                        </p>
                      )}
                    </div>
                  </div>
                  <Toggle 
                    checked={useCV} 
                    onChange={setUseCV} 
                    disabled={!hasCV}
                  />
                </div>
                
                {!hasCV && (
                  <p className="text-[12px] text-[#DC2626] mt-2">
                    Upload a CV in My Profile to enable AI personalisation.
                  </p>
                )}

                <div className="flex items-center gap-2 mt-4 text-[13px] text-[#6B7280]">
                  <Clock size={14} />
                  <span>Estimated session: 8 questions · ~15 minutes</span>
                </div>
              </div>
            </div>

            {/* Right Column - Summary Card */}
            <div>
              <div className="sticky top-24 bg-white border border-[#EEEEEE] rounded-[10px] p-5">
                <h3 className="text-[16px] font-medium text-[#111827] mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
                  Your Session
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                    <span className="text-[13px] text-[#6B7280]">Interview Type</span>
                    <span className="text-[13px] font-medium text-[#111827]">
                      {interviewType ? interviewTypes.find(t => t.id === interviewType)?.title : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                    <span className="text-[13px] text-[#6B7280]">Target Role</span>
                    <span className="text-[13px] font-medium text-[#111827]">
                      {targetRole || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#F3F4F6]">
                    <span className="text-[13px] text-[#6B7280]">CV Mode</span>
                    <span className="text-[13px] font-medium text-[#111827]">
                      {useCV && hasCV ? `On (${cvFileName})` : useCV ? "Off (no CV)" : "Off"}
                    </span>
                  </div>
                </div>

                {/* AI Note */}
                {getAINote() && (
                  <div className="mt-4 p-3 bg-[#FFF4F1] rounded-lg border border-[#FCA68A]">
                    <p className="text-[13px] text-[#F04E23] italic">
                      &ldquo;{getAINote()}&rdquo;
                    </p>
                  </div>
                )}

                {/* Start Button */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => navigate("/candidate/interview/room")}
                    disabled={!canStart}
                    className={`w-full h-12 rounded-[8px] text-[16px] font-medium transition-all flex items-center justify-center gap-2 ${
                      canStart 
                        ? "bg-[#F04E23] hover:bg-[#D43D14] text-white" 
                        : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed opacity-50"
                    }`}
                  >
                    Begin Interview <ArrowRight size={18} />
                  </button>
                  
                  <button
                    onClick={() => navigate("/candidate/dashboard")}
                    className="w-full text-[13px] text-[#6B7280] hover:text-[#374151] text-center"
                  >
                    Cancel
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

export default InterviewSetup;
