import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  User, 
  Mic2, 
  FileText, 
  LogOut,
  Camera,
  MapPin,
  X,
  Upload,
  FileText as FileIcon,
  Trash2,
  Check,
  Eye,
  Pencil,
  Plus,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Toast } from "../../components/shared/Toast";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { SkeletonProfileCard, SkeletonForm } from "../../components/shared/SkeletonLoader";
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

function CandidateProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeNav, setActiveNav] = useState("profile");
  
  // Enhanced toast system
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // Form validation errors
  const [errors, setErrors] = useState({});

  // Muslim name user data
  const [formData, setFormData] = useState({
    fullName: "Ahmed Hassan",
    jobTitle: "Frontend Developer",
    location: "London, UK",
    linkedin: "linkedin.com/in/ahmedhassan",
    skills: ["JavaScript", "React", "TypeScript", "HTML/CSS", "Git"],
    bio: "Passionate frontend developer with 2 years of experience building responsive web apps. Looking to level up my interview skills and land my next role.",
  });

  const [skillInput, setSkillInput] = useState("");
  const [bioCharCount, setBioCharCount] = useState(formData.bio.length);
  const [cvFile, setCvFile] = useState({
    name: "Ahmed_Hassan_Resume_2025.pdf",
    size: "2.1 MB"
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");
  
  // Photo upload states
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const photoInputRef = useRef(null);
  
  // Track original data for change detection
  const [originalData, setOriginalData] = useState({ ...formData, skills: [...formData.skills] });
  const [changedFields, setChangedFields] = useState([]);
  
  // Field touched states for validation
  const [touched, setTouched] = useState({});

  const userInitials = "AH";
  const userName = "Ahmed Hassan";
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "My Profile", icon: User },
    { id: "interview", label: "Start Interview", icon: Mic2 },
    { id: "reports", label: "My Reports", icon: FileText },
  ];

  // Calculate profile completeness
  const completeness = Math.round(
    ((formData.fullName ? 1 : 0) + 
     (formData.jobTitle ? 1 : 0) + 
     (formData.location ? 1 : 0) + 
     (formData.linkedin ? 1 : 0) + 
     (formData.skills.length > 0 ? 1 : 0) + 
     (formData.bio ? 1 : 0) + 
     (cvFile ? 1 : 0)) / 7 * 100
  );

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    if (navId === "dashboard") navigate("/candidate/dashboard");
    if (navId === "interview") navigate("/candidate/interview/setup");
    if (navId === "reports") navigate("/candidate/reports");
  };

  // Validation functions
  const validateField = (name, value) => {
    switch (name) {
      case "fullName":
        return value.trim().length < 2 ? "Name must be at least 2 characters" : "";
      case "linkedin":
        if (!value) return "";
        return !value.includes("linkedin.com") ? "Please enter a valid LinkedIn URL" : "";
      case "bio":
        return value.length > 300 ? "Bio must be under 300 characters" : "";
      default:
        return "";
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    newErrors.fullName = validateField("fullName", formData.fullName);
    newErrors.linkedin = validateField("linkedin", formData.linkedin);
    newErrors.bio = validateField("bio", formData.bio);
    setErrors(newErrors);
    return !Object.values(newErrors).some(e => e);
  };

  // Photo management functions
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be under 5MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result);
        showToast("Photo uploaded successfully!", "success");
      };
      reader.readAsDataURL(file);
    }
    setShowPhotoOptions(false);
  };

  const handleDeletePhoto = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Photo?",
      message: "Are you sure you want to remove your profile photo?",
      confirmText: "Remove",
      cancelText: "Keep Photo",
      type: "warning",
      onConfirm: () => {
        setProfilePhoto(null);
        showToast("Photo removed", "info");
        setShowPhotoOptions(false);
      }
    });
  };

  const handleEditPhoto = () => {
    photoInputRef.current?.click();
  };

  // View CV function
  const handleViewCv = () => {
    // In real app, this would open the CV in a new tab or modal
    showToast("Opening CV preview...", "info");
    window.open("#", "_blank");
  };

  // Track field changes
  const trackChange = (field) => {
    if (!changedFields.includes(field)) {
      setChangedFields([...changedFields, field]);
    }
    // Clear error when field is edited
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };
  
  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    const error = validateField(field, formData[field]);
    setErrors({ ...errors, [field]: error });
  };

  const handleSave = async () => {
    setTouched({ fullName: true, linkedin: true, bio: true });
    
    if (!validateForm()) {
      showToast("Please fix the errors before saving", "error");
      return;
    }
    
    setIsSaving(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setOriginalData({ ...formData, skills: [...formData.skills] });
    
    const fieldNames = {
      fullName: "Full name",
      jobTitle: "Job title",
      location: "Location",
      linkedin: "LinkedIn",
      skills: "Skills",
      bio: "Bio",
      cv: "CV/Resume"
    };
    
    const changedList = changedFields.map(f => fieldNames[f] || f).join(", ");
    showToast(`Profile updated: ${changedList}`, "success");
    setChangedFields([]);
    setIsSaving(false);
  };

  const handleAddSkill = (e) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      if (!formData.skills.includes(skillInput.trim())) {
        setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
        trackChange("skills");
      }
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skillToRemove) });
    trackChange("skills");
  };

  const handleBioChange = (e) => {
    const text = e.target.value;
    if (text.length <= 300) {
      setFormData({ ...formData, bio: text });
      setBioCharCount(text.length);
      trackChange("bio");
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError("");
    
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB.");
      return;
    }
    
    setCvFile({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + " MB"
    });
    trackChange("cv");
    showToast("CV uploaded successfully!", "success");
  };

  const handleRemoveCv = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove CV?",
      message: "Are you sure you want to remove your CV? This action cannot be undone.",
      confirmText: "Remove",
      cancelText: "Keep CV",
      type: "danger",
      onConfirm: () => {
        setCvFile(null);
        trackChange("cv");
        showToast("CV removed successfully", "success");
      }
    });
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
      
      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          type={confirmDialog.type}
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
            <div className="w-8 h-8 rounded-full bg-[#F04E23] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#111827] truncate">{formData.fullName}</p>
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
              <div>
                <h1 className="text-[20px] font-bold text-[#111827]">My Profile</h1>
                {changedFields.length > 0 && (
                  <p className="text-[12px] text-[#F04E23]">{changedFields.length} unsaved change{changedFields.length > 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={changedFields.length === 0 || isSaving}
                  className={`px-4 py-2 rounded-[8px] text-[14px] font-medium flex items-center gap-2 transition-all ${
                    changedFields.length > 0 && !isSaving
                      ? "bg-[#F04E23] hover:bg-[#D43D14] text-white shadow-md hover:shadow-lg"
                      : "bg-[#E5E7EB] text-[#6B7280] cursor-not-allowed"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save Changes
                    </>
                  )}
                </button>

                <span className="text-[14px] text-[#6B7280]">{userName.split(' ')[0]} 👋</span>

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
                        onClick={() => { setShowUserDropdown(false); }}
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

            {/* Profile Content */}
            <div className="p-6 max-w-5xl">
              {/* Enhanced Profile Completeness Bar */}
              <div className="relative bg-gradient-to-br from-white to-[#F8FAFC] border border-[#E5E7EB] rounded-[14px] p-5 mb-6 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                {/* Decorative shape */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#F04E23]/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
                
                <div className="relative z-10 flex items-center gap-4">
                  {/* Circular progress */}
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" stroke="#E5E7EB" strokeWidth="4" fill="none" />
                      <circle 
                        cx="28" cy="28" r="24" 
                        stroke="#F04E23" 
                        strokeWidth="4" 
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - completeness / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[14px] font-bold text-[#F04E23]">{completeness}%</span>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[15px] font-semibold text-[#111827]">Profile Completion</h4>
                      {completeness === 100 && (
                        <span className="px-2 py-0.5 bg-[#FEE2E2] text-[#F04E23] rounded-full text-[11px] font-medium">
                          Complete
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#6B7280]">
                      {completeness < 100 
                        ? "Add your Skills and CV to unlock AI-personalised questions." 
                        : "Your profile is fully set up! Ready for interviews."}
                    </p>
                  </div>
                </div>
                
                {/* Linear progress bar */}
                <div className="mt-4 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#F04E23] to-[#FFA07A] rounded-full transition-all duration-700"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Photo Card */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Profile Photo Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <div className="relative mx-auto w-28 h-28 mb-4">
                      {profilePhoto ? (
                        <img 
                          src={profilePhoto} 
                          alt="Profile" 
                          className="w-full h-full rounded-full object-cover border-2 border-[#E5E7EB]"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#F04E23] to-[#FFA07A] flex items-center justify-center text-white text-[28px] font-bold">
                          {userInitials}
                        </div>
                      )}
                      
                      {/* Camera button */}
                      <button
                        onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                        className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center shadow-sm hover:border-[#F04E23] hover:text-[#F04E23] transition-colors"
                      >
                        <Camera size={14} />
                      </button>
                      
                      {/* Photo options dropdown */}
                      {showPhotoOptions && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-white border border-[#E5E7EB] rounded-lg shadow-lg py-1 z-10">
                          <button
                            onClick={handleEditPhoto}
                            className="w-full px-3 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F9FAFB] flex items-center gap-2"
                          >
                            <Pencil size={14} /> Change Photo
                          </button>
                          {profilePhoto && (
                            <button
                              onClick={handleDeletePhoto}
                              className="w-full px-3 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Remove Photo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    
                    <div className="text-center">
                      <h3 className="text-[16px] font-semibold text-[#111827]">{formData.fullName}</h3>
                      <p className="text-[13px] text-[#6B7280] mt-0.5">{formData.jobTitle}</p>
                      {formData.location && (
                        <p className="text-[12px] text-[#6B7280] mt-1 flex items-center justify-center gap-1">
                          <MapPin size={12} /> {formData.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                    <h4 className="text-[14px] font-semibold text-[#111827] mb-4">Profile Stats</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Interviews</span>
                        <span className="text-[13px] font-bold text-[#111827]">12</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Avg. Score</span>
                        <span className="text-[13px] font-bold text-[#F04E23]">87%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Member Since</span>
                        <span className="text-[13px] font-bold text-[#111827]">Jan 2025</span>
                      </div>
                    </div>
                  </div>

                  {/* CV / Resume */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                    <h4 className="text-[14px] font-semibold text-[#111827] mb-4">CV / Resume</h4>
                    {cvFile ? (
                      <div className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                        <div className="w-10 h-10 bg-[#FFF4F1] rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileIcon size={18} className="text-[#F04E23]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#111827] truncate">{cvFile.name}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{cvFile.size}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleViewCv}
                            className="p-1.5 text-[#6B7280] hover:text-[#F04E23] hover:bg-[#FFF4F1] rounded transition-colors"
                            title="View CV"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={handleRemoveCv}
                            className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors"
                            title="Remove CV"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all ${
                          isDragging
                            ? "border-[#F04E23] bg-[#FFF4F1]"
                            : uploadError
                              ? "border-[#DC2626] bg-red-50"
                              : "border-[#E5E7EB] hover:border-[#F04E23] hover:bg-[#FFF4F1]"
                        }`}
                      >
                        <Upload size={18} className="mx-auto mb-2 text-[#F04E23]" />
                        <p className="text-[12px] font-medium text-[#374151]">
                          <span className="text-[#F04E23]">Click to upload</span> or drag
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] mt-1">PDF only, max 5MB</p>
                        {uploadError && (
                          <p className="mt-2 text-[11px] text-[#DC2626] flex items-center justify-center gap-1">
                            <AlertCircle size={10} /> {uploadError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Personal Information */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                    <h3 className="text-[16px] font-bold text-[#111827] mb-1">Personal Information</h3>
                    <p className="text-[12px] text-[#6B7280] italic mb-5">Update your details to help us personalise your interview experience.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Full Name */}
                      <div>
                        <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => {
                            setFormData({ ...formData, fullName: e.target.value });
                            trackChange("fullName");
                          }}
                          onBlur={() => handleBlur("fullName")}
                          className={`w-full h-[40px] px-3 rounded-lg border text-[14px] outline-none transition-all ${
                            touched.fullName && errors.fullName
                              ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                              : "border-[#E5E7EB] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                          }`}
                          placeholder="Enter your full name"
                        />
                        {touched.fullName && errors.fullName && (
                          <p className="mt-1 text-[12px] text-[#DC2626]">{errors.fullName}</p>
                        )}
                      </div>

                      {/* Job Title */}
                      <div>
                        <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Job Title</label>
                        <input
                          type="text"
                          value={formData.jobTitle}
                          onChange={(e) => {
                            setFormData({ ...formData, jobTitle: e.target.value });
                            trackChange("jobTitle");
                          }}
                          className="w-full h-[40px] px-3 rounded-lg border border-[#E5E7EB] text-[14px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 transition-all"
                          placeholder="e.g. Frontend Developer"
                        />
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Location</label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => {
                            setFormData({ ...formData, location: e.target.value });
                            trackChange("location");
                          }}
                          className="w-full h-[40px] px-3 rounded-lg border border-[#E5E7EB] text-[14px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 transition-all"
                          placeholder="e.g. London, UK"
                        />
                      </div>

                      {/* LinkedIn */}
                      <div>
                        <label className="block text-[13px] font-medium text-[#374151] mb-1.5">LinkedIn Profile</label>
                        <input
                          type="text"
                          value={formData.linkedin}
                          onChange={(e) => {
                            setFormData({ ...formData, linkedin: e.target.value });
                            trackChange("linkedin");
                          }}
                          onBlur={() => handleBlur("linkedin")}
                          className={`w-full h-[40px] px-3 rounded-lg border text-[14px] outline-none transition-all ${
                            touched.linkedin && errors.linkedin
                              ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                              : "border-[#E5E7EB] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                          }`}
                          placeholder="linkedin.com/in/yourprofile"
                        />
                        {touched.linkedin && errors.linkedin && (
                          <p className="mt-1 text-[12px] text-[#DC2626]">{errors.linkedin}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                    <h3 className="text-[16px] font-bold text-[#111827] mb-1">Skills</h3>
                    <p className="text-[12px] text-[#6B7280] italic mb-4">Add skills relevant to your target roles for better AI questions.</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFF4F1] text-[#F04E23] rounded-lg text-[13px] font-medium border border-[#FCA68A]/30"
                        >
                          {skill}
                          <button
                            onClick={() => handleRemoveSkill(skill)}
                            className="hover:text-[#D43D14] transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={handleAddSkill}
                        className="w-full h-[40px] px-3 rounded-lg border border-[#E5E7EB] text-[14px] outline-none focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100 transition-all"
                        placeholder="Type a skill and press Enter"
                      />
                      <Plus size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    </div>
                    <p className="mt-2 text-[12px] text-[#9CA3AF]">Press Enter to add a skill</p>
                  </div>

                  {/* Bio */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_20px_rgba(240,78,35,0.06)] hover:border-[#FCA68A] transition-all duration-300">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[16px] font-bold text-[#111827]">Bio</h3>
                      <span className={`text-[12px] ${bioCharCount > 280 ? "text-[#DC2626]" : "text-[#9CA3AF]"}`}>
                        {bioCharCount}/300
                      </span>
                    </div>
                    <textarea
                      value={formData.bio}
                      onChange={handleBioChange}
                      onBlur={() => handleBlur("bio")}
                      rows={4}
                      className={`w-full px-3 py-2.5 rounded-lg border text-[14px] outline-none resize-none transition-all ${
                        touched.bio && errors.bio
                          ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-red-100"
                          : "border-[#E5E7EB] focus:border-[#F04E23] focus:ring-2 focus:ring-orange-100"
                      }`}
                      placeholder="Tell us about yourself, your experience, and what you're looking for..."
                    />
                    {touched.bio && errors.bio && (
                      <p className="mt-1 text-[12px] text-[#DC2626]">{errors.bio}</p>
                    )}
                  </div>

                </div>
              </div>
            </div>
          
          {/* Hidden file input for CV */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
      </main>
    </div>
  );
}

export default CandidateProfile;
