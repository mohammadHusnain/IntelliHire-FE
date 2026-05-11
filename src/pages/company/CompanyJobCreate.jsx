import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLogout } from "@/hooks/useLogout";
import {
  LayoutDashboard, Briefcase, Users, BarChart2, Globe, UserCheck, Settings, LogOut,
  X, GripVertical, Bold, Italic, List, ListOrdered, Heading2, Plus, Minus,
} from "lucide-react";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";
import {
  getJobById, addJob, updateJob,
  departmentOptions, locationOptions, workplaceTypes, jobTypes,
  experienceLevels, educationLevels, defaultHiringStages, recruiterOptions,
} from "../../data/jobsStore";

// ─── Sidebar Nav Item ────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 transition-all"
    style={{ height: "38px", borderRadius: "6px", margin: "1px 8px", width: "calc(100% - 16px)", fontSize: "14px", fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "none", borderLeft: active ? "2px solid #F04E23" : "2px solid transparent", background: active ? "#FFF4F1" : "transparent", color: active ? "#F04E23" : "#9CA3AF", transition: "all 150ms ease" }}
    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; } }}
    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}>
    <Icon size={17} /><span>{label}</span>
  </button>
);

const SelectArrow = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const SectionDivider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
    <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>{label}</span>
    <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
  </div>
);

const ToggleSwitch = ({ checked, onChange }) => (
  <button onClick={onChange} style={{ width: "36px", height: "20px", borderRadius: "999px", background: checked ? "#F04E23" : "#D1D5DB", border: "none", cursor: "pointer", position: "relative", transition: "background 150ms", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
  </button>
);

const Toast = ({ message, type = "success", onClose }) => {
  const colors = { success: "#059669", error: "#DC2626", warning: "#D97706", info: "#F04E23" };
  return (
    <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "14px 18px", width: "360px", borderLeft: `4px solid ${colors[type] || colors.success}`, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "toastIn 200ms ease", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "2px" }}><X size={14} /></button>
    </div>
  );
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

const fieldTypes = ["Short Text", "Long Text", "Dropdown", "File Upload", "Yes/No"];

function CompanyJobCreate() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [activeNav, setActiveNav] = useState("jobs");
  const descRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [toastType, setToastType] = useState("success");

  // ── Form State ──
  const [form, setForm] = useState({
    title: "", department: "", location: "", workplaceType: "Remote", jobType: "Full-time",
    experienceLevel: "Mid-level", openings: "1", salaryMin: "", salaryMax: "",
    description: "", responsibilities: "", requirements: "", preferredQualifications: "",
    deadline: "", recruiter: "", status: "Draft",
  });
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [hiringStages, setHiringStages] = useState([...defaultHiringStages]);
  const [stageInput, setStageInput] = useState("");

  const [customFields, setCustomFields] = useState([]);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("Short Text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [deadlineError, setDeadlineError] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [titleError, setTitleError] = useState("");

  // ── Load existing job for edit ──
  useEffect(() => {
    if (isEdit) {
      const job = getJobById(editId);
      if (job) {
        setForm({
          title: job.title || "", department: job.department || "", location: job.location || "",
          workplaceType: job.workplaceType || "Remote", jobType: job.jobType || "Full-time",
          experienceLevel: job.experienceLevel || "Mid-level",
          openings: String(job.openings || 1), salaryMin: job.salaryMin || "", salaryMax: job.salaryMax || "",
          description: job.description || "", responsibilities: job.responsibilities || "",
          requirements: job.requirements || "", preferredQualifications: job.preferredQualifications || "",
          deadline: job.deadline || "", recruiter: job.recruiter || "", status: job.status || "Draft",
        });
        setSkills(job.skills || []);
        setHiringStages(job.hiringStages || [...defaultHiringStages]);
        setCustomFields(job.customFields || []);
      }
    }
  }, [editId, isEdit]);

  const showToast = useCallback((msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleFieldChange = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (key === "title" && value.trim()) setTitleError("");
    if (key === "deadline") {
      if (value) {
        const d = new Date(value);
        if (d <= new Date()) setDeadlineError("Deadline must be a future date");
        else setDeadlineError("");
      } else setDeadlineError("");
    }
  };

  const handleAddSkill = (e) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) setSkills((p) => [...p, skillInput.trim()]);
      setSkillInput("");
    }
  };
  const handleRemoveSkill = (s) => setSkills((p) => p.filter((x) => x !== s));

  const handleAddStage = () => {
    if (stageInput.trim() && !hiringStages.includes(stageInput.trim())) {
      setHiringStages((p) => [...p, stageInput.trim()]);
      setStageInput("");
    }
  };
  const handleRemoveStage = (s) => setHiringStages((p) => p.filter((x) => x !== s));

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields((p) => [...p, { label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired }]);
    setNewFieldLabel(""); setNewFieldType("Short Text"); setNewFieldRequired(false); setShowAddField(false);
  };
  const handleRemoveCustomField = (i) => setCustomFields((p) => p.filter((_, idx) => idx !== i));
  const handleToggleRequired = (i) => setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, required: !f.required } : f)));

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const reordered = [...customFields];
    const [removed] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, removed);
    setCustomFields(reordered); setDragIdx(i);
  };
  const handleDragEnd = () => setDragIdx(null);

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

  const buildJobData = (status) => ({
    ...form, status, skills, hiringStages, customFields,
    openings: parseInt(form.openings, 10) || 1,
  });

  const validate = () => {
    if (!form.title.trim()) { setTitleError("Job title is required"); return false; }
    return true;
  };

  const handleSaveDraft = () => {
    if (!form.title.trim()) { setTitleError("Job title is required"); showToast("Please enter a job title", "error"); return; }
    const data = buildJobData("Draft");
    if (isEdit) {
      updateJob(editId, data);
      showToast(`"${form.title}" draft updated`);
    } else {
      const created = addJob(data);
      showToast(`"${form.title}" saved as draft`);
      setTimeout(() => navigate(`/company/jobs/${created.id}/edit`), 600);
    }
  };

  const handlePreview = () => {
    if (!validate()) { showToast("Please fix form errors before previewing", "error"); return; }
    const data = buildJobData(form.status === "Published" ? "Published" : "Draft");
    if (isEdit) {
      updateJob(editId, data);
      navigate(`/company/jobs/${editId}/preview`);
    } else {
      const created = addJob(data);
      navigate(`/company/jobs/${created.id}/preview`);
    }
  };

  const inputStyle = { width: "100%", height: "40px", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0 14px", fontSize: "14px", color: "#0D0D0D", background: "white", outline: "none", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, box-shadow 150ms", boxSizing: "border-box" };
  const labelStyle = { fontSize: "13px", fontWeight: 500, color: "#374151", display: "block", marginBottom: "6px", fontFamily: "Inter, sans-serif" };
  const selectStyle = { ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .field-input.error { border-color: #DC2626 !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .add-field-panel { animation: fadeIn 150ms ease; }
        .skill-tag { display: inline-flex; align-items: center; gap: 4px; background: #FFF4F1; color: #F04E23; border-radius: 999px; font-size: 12px; font-weight: 500; padding: 4px 10px; font-family: Inter, sans-serif; }
        .toolbar-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; border-radius: 4px; color: #6B7280; transition: all 120ms; }
        .toolbar-btn:hover { background: #FFF4F1; color: #F04E23; }
        .drag-row { transition: box-shadow 150ms, border-color 150ms; }
        .drag-row.dragging { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-left: 3px solid #F04E23 !important; }
      `}</style>

      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}

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
            <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            {isEdit ? "Edit" : "Create"} <em style={{ color: "#F04E23", fontStyle: "italic" }}>Job</em>
          </h1>
        </header>

        <div style={{ padding: "12px 32px 0", display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Job Postings</button>
          <span style={{ color: "#9CA3AF", fontSize: "13px" }}>/</span>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", fontFamily: "Inter, sans-serif" }}>{isEdit ? `Edit: ${form.title || "Untitled"}` : "Create New Job"}</span>
        </div>

        <main style={{ flex: 1, padding: "40px 32px 100px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "760px" }}>

            {/* ── Section 1 — Basic Information ── */}
            <SectionDivider label="Basic Information" />
            <div style={{ marginBottom: "32px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Job Title <span style={{ color: "#F04E23" }}>*</span></label>
                <input type="text" className={`field-input ${titleError ? "error" : ""}`} style={inputStyle} value={form.title} onChange={(e) => handleFieldChange("title", e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
                {titleError && <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>{titleError}</p>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Department</label>
                  <select className="field-input" style={selectStyle} value={form.department} onChange={(e) => handleFieldChange("department", e.target.value)}>
                    <option value="">Select department…</option>
                    {departmentOptions.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Location</label>
                  <select className="field-input" style={selectStyle} value={form.location} onChange={(e) => handleFieldChange("location", e.target.value)}>
                    <option value="">Select location…</option>
                    {locationOptions.map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Workplace Type</label>
                  <select className="field-input" style={selectStyle} value={form.workplaceType} onChange={(e) => handleFieldChange("workplaceType", e.target.value)}>
                    {workplaceTypes.map((w) => <option key={w}>{w}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Employment Type</label>
                  <select className="field-input" style={selectStyle} value={form.jobType} onChange={(e) => handleFieldChange("jobType", e.target.value)}>
                    {jobTypes.map((j) => <option key={j}>{j}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div>
                  <label style={labelStyle}>Number of Openings</label>
                  <input type="number" min="1" className="field-input" style={inputStyle} value={form.openings} onChange={(e) => handleFieldChange("openings", e.target.value)} />
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Experience Level</label>
                  <select className="field-input" style={selectStyle} value={form.experienceLevel} onChange={(e) => handleFieldChange("experienceLevel", e.target.value)}>
                    {experienceLevels.map((e) => <option key={e}>{e}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <div>
                  <label style={labelStyle}>Salary Min (£)</label>
                  <input type="number" className="field-input" style={inputStyle} value={form.salaryMin} onChange={(e) => handleFieldChange("salaryMin", e.target.value)} placeholder="e.g. 45000" />
                </div>
                <div>
                  <label style={labelStyle}>Salary Max (£)</label>
                  <input type="number" className="field-input" style={inputStyle} value={form.salaryMax} onChange={(e) => handleFieldChange("salaryMax", e.target.value)} placeholder="e.g. 75000" />
                </div>
              </div>
            </div>

            {/* ── Section 2 — Job Description ── */}
            <SectionDivider label="Job Description" />
            <div style={{ marginBottom: "32px" }}>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden", transition: "border-color 150ms" }} onFocus={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(240,78,35,0.10)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "6px 8px", borderBottom: "1px solid #E5E7EB", background: "white" }}>
                  <button className="toolbar-btn" title="Bold"><Bold size={15} /></button>
                  <button className="toolbar-btn" title="Italic"><Italic size={15} /></button>
                  <button className="toolbar-btn" title="Bullet List"><List size={15} /></button>
                  <button className="toolbar-btn" title="Numbered List"><ListOrdered size={15} /></button>
                  <button className="toolbar-btn" title="Heading"><Heading2 size={15} /></button>
                </div>
                <textarea ref={descRef} value={form.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Describe the role, what the team does, and what a typical day looks like…" style={{ width: "100%", minHeight: "180px", border: "none", outline: "none", padding: "14px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: "#0D0D0D", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }} />
              </div>
              <div style={{ textAlign: "right", marginTop: "6px" }}>
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{form.description.length} characters</span>
              </div>
            </div>

            {/* ── Section 3 — Responsibilities ── */}
            <SectionDivider label="Responsibilities" />
            <div style={{ marginBottom: "32px" }}>
              <textarea value={form.responsibilities} onChange={(e) => handleFieldChange("responsibilities", e.target.value)} placeholder="• Lead frontend architecture decisions&#10;• Build reusable components&#10;• Collaborate with design and product teams" className="field-input" style={{ ...inputStyle, height: "auto", minHeight: "120px", padding: "12px 14px", resize: "vertical", lineHeight: 1.7 }} />
            </div>

            {/* ── Section 4 — Requirements ── */}
            <SectionDivider label="Requirements" />
            <div style={{ marginBottom: "32px" }}>
              <textarea value={form.requirements} onChange={(e) => handleFieldChange("requirements", e.target.value)} placeholder="• 5+ years experience with React&#10;• Strong understanding of HTML, CSS, JavaScript&#10;• Experience with RESTful APIs" className="field-input" style={{ ...inputStyle, height: "auto", minHeight: "120px", padding: "12px 14px", resize: "vertical", lineHeight: 1.7, marginBottom: "16px" }} />

              <label style={labelStyle}>Preferred Qualifications</label>
              <textarea value={form.preferredQualifications} onChange={(e) => handleFieldChange("preferredQualifications", e.target.value)} placeholder="• Experience with TypeScript&#10;• Knowledge of testing frameworks&#10;• Familiarity with CI/CD pipelines" className="field-input" style={{ ...inputStyle, height: "auto", minHeight: "100px", padding: "12px 14px", resize: "vertical", lineHeight: 1.7 }} />
            </div>

            {/* ── Section 5 — Skills ── */}
            <SectionDivider label="Required Skills" />
            <div style={{ marginBottom: "32px" }}>
              <div className="field-input" style={{ ...inputStyle, height: "auto", minHeight: "40px", padding: "6px 10px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", cursor: "text" }} onClick={() => document.getElementById("skill-input")?.focus()}>
                {skills.map((s) => (
                  <span key={s} className="skill-tag">{s}<button onClick={() => handleRemoveSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#F04E23", display: "flex", alignItems: "center", padding: 0 }}><X size={12} /></button></span>
                ))}
                <input id="skill-input" type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleAddSkill} placeholder={skills.length === 0 ? "Type a skill and press Enter…" : ""} style={{ border: "none", outline: "none", flex: 1, minWidth: "80px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: "#0D0D0D", background: "transparent", padding: "4px 0" }} />
              </div>
            </div>

            {/* ── Section 6 — Hiring Stages ── */}
            <SectionDivider label="Hiring Stages" />
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                {hiringStages.map((s, i) => (
                  <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F3F4F6", borderRadius: "999px", padding: "6px 12px", fontSize: "13px", color: "#374151", fontFamily: "Inter, sans-serif" }}>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}.</span> {s}
                    {s !== "Applied" && s !== "Offer" && (
                      <button onClick={() => handleRemoveStage(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", padding: 0 }}><Minus size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="text" value={stageInput} onChange={(e) => setStageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStage(); } }} placeholder="Add custom stage…" className="field-input" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleAddStage} style={{ height: "40px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms", whiteSpace: "nowrap" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>
                  <Plus size={14} style={{ marginRight: "4px", verticalAlign: "middle" }} />Add
                </button>
              </div>
            </div>

            {/* ── Section 7 — Recruiter & Deadline ── */}
            <SectionDivider label="Assignment & Deadline" />
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Assigned Recruiter</label>
                  <select className="field-input" style={selectStyle} value={form.recruiter} onChange={(e) => handleFieldChange("recruiter", e.target.value)}>
                    <option value="">Select recruiter…</option>
                    {recruiterOptions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div>
                  <label style={labelStyle}>Application Deadline</label>
                  <input type="date" className={`field-input ${deadlineError ? "error" : ""}`} style={{ ...inputStyle, cursor: "pointer" }} value={form.deadline} onChange={(e) => handleFieldChange("deadline", e.target.value)} />
                  {deadlineError && <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px" }}>{deadlineError}</p>}
                </div>
              </div>
            </div>

            {/* ── Section 8 — Custom Application Fields ── */}
            <SectionDivider label="Custom Application Fields" />
            <div style={{ marginBottom: "32px" }}>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 20px", fontFamily: "Inter, sans-serif" }}>These questions appear on the candidate application form below the standard fields.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {customFields.map((field, i) => (
                  <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDragEnd={handleDragEnd} className={`drag-row ${dragIdx === i ? "dragging" : ""}`} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid #E5E7EB", borderRadius: "8px", background: "white", cursor: "grab" }}>
                    <GripVertical size={16} style={{ color: "#D1D5DB", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "14px", color: "#0D0D0D" }}>{field.label}</span>
                    <span style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", whiteSpace: "nowrap" }}>{field.type}</span>
                    <ToggleSwitch checked={field.required} onChange={() => handleToggleRequired(i)} />
                    <span style={{ fontSize: "11px", color: field.required ? "#F04E23" : "#9CA3AF", minWidth: "52px" }}>{field.required ? "Required" : "Optional"}</span>
                    <button onClick={() => handleRemoveCustomField(i)} style={{ fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0 }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Remove</button>
                  </div>
                ))}
              </div>
              {!showAddField && (
                <button onClick={() => setShowAddField(true)} style={{ width: "100%", height: "44px", border: "2px dashed #E5E7EB", borderRadius: "8px", background: "transparent", fontSize: "13px", fontWeight: 500, color: "#9CA3AF", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.background = "#FFF4F1"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}>+ Add Custom Field</button>
              )}
              {showAddField && (
                <div className="add-field-panel" style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px", background: "white" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Field Label</label>
                    <input type="text" className="field-input" style={inputStyle} value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Portfolio URL" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "end", marginBottom: "16px" }}>
                    <div style={{ position: "relative" }}>
                      <label style={labelStyle}>Field Type</label>
                      <select className="field-input" style={selectStyle} value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
                        {fieldTypes.map((t) => (<option key={t}>{t}</option>))}
                      </select>
                      <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#374151" }}>Required?</span>
                      <ToggleSwitch checked={newFieldRequired} onChange={() => setNewFieldRequired((p) => !p)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button onClick={handleAddCustomField} style={{ height: "36px", padding: "0 16px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Add Field</button>
                    <button onClick={() => { setShowAddField(false); setNewFieldLabel(""); }} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── STICKY FOOTER BAR ── */}
        <div style={{ position: "sticky", bottom: 0, background: "white", borderTop: "1px solid #E5E7EB", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 40, boxShadow: "0 -4px 16px rgba(0,0,0,0.04)" }}>
          <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "14px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={handleSaveDraft} style={{ height: "40px", padding: "0 20px", background: "white", color: "#374151", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "border-color 150ms, color 150ms" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F04E23"; e.currentTarget.style.color = "#F04E23"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}>Save as Draft</button>
            <button onClick={handlePreview} style={{ height: "40px", padding: "0 20px", background: "#F04E23", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "background 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")} onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}>Preview & Publish →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyJobCreate;
