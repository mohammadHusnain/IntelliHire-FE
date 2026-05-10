import { useState, useRef } from "react";
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
  X,
  GripVertical,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
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

// ─── Select Arrow ────────────────────────────────────────────────────────────
const SelectArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Section Divider ─────────────────────────────────────────────────────────
const SectionDivider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "#9CA3AF",
        fontFamily: "Inter, sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
  </div>
);

// ─── Toggle Switch ───────────────────────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange }) => (
  <button
    onClick={onChange}
    style={{
      width: "36px",
      height: "20px",
      borderRadius: "999px",
      background: checked ? "#F04E23" : "#D1D5DB",
      border: "none",
      cursor: "pointer",
      position: "relative",
      transition: "background 150ms",
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: "2px",
        left: checked ? "18px" : "2px",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: "white",
        transition: "left 150ms",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    />
  </button>
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

// ─── Field Type Options ──────────────────────────────────────────────────────
const fieldTypes = ["Short Text", "Long Text", "Dropdown", "File Upload", "Yes/No"];

function CompanyJobCreate() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("jobs");
  const userRole = "Owner"; // mock: Owner | HR Manager | Recruiter
  const descRef = useRef(null);

  // ── Form State ──
  const [form, setForm] = useState({
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote (UK)",
    jobType: "Full-time",
    description:
      "We are looking for a skilled frontend engineer to join our growing team. You will work closely with designers and backend engineers to build beautiful, performant user interfaces that delight our customers.\n\nResponsibilities:\n• Lead frontend architecture decisions\n• Build reusable components and libraries\n• Collaborate with design and product teams\n• Mentor junior engineers",
    deadline: "2025-06-15",
  });

  const [skills, setSkills] = useState(["React", "TypeScript", "JavaScript", "CSS", "GraphQL", "Git"]);
  const [skillInput, setSkillInput] = useState("");
  const [experience, setExperience] = useState("Senior");
  const [education, setEducation] = useState("Bachelor's");

  const [customFields, setCustomFields] = useState([
    { label: "Portfolio URL", type: "Short Text", required: true },
    { label: "Eligible to work in the UK?", type: "Yes/No", required: true },
    { label: "Cover letter (optional)", type: "Long Text", required: false },
  ]);

  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("Short Text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const [deadlineError, setDeadlineError] = useState("");
  const [dragIdx, setDragIdx] = useState(null);

  const handleFieldChange = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (key === "deadline") {
      const d = new Date(value);
      if (d <= new Date()) setDeadlineError("Deadline must be a future date");
      else setDeadlineError("");
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

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields((p) => [...p, { label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired }]);
    setNewFieldLabel("");
    setNewFieldType("Short Text");
    setNewFieldRequired(false);
    setShowAddField(false);
  };

  const handleRemoveCustomField = (i) => setCustomFields((p) => p.filter((_, idx) => idx !== i));

  const handleToggleRequired = (i) =>
    setCustomFields((p) => p.map((f, idx) => (idx === i ? { ...f, required: !f.required } : f)));

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const reordered = [...customFields];
    const [removed] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, removed);
    setCustomFields(reordered);
    setDragIdx(i);
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleNavClick = (id) => {
    setActiveNav(id);
    if (id === "dashboard") navigate("/company/dashboard");
    if (id === "jobs") navigate("/company/jobs");
    if (id === "team") navigate("/company/team");
  };

  const descLength = form.description.length;

  const inputStyle = {
    width: "100%",
    height: "40px",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    padding: "0 14px",
    fontSize: "14px",
    color: "#0D0D0D",
    background: "white",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 150ms, box-shadow 150ms",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    display: "block",
    marginBottom: "6px",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .field-input:focus { border-color: #F04E23 !important; box-shadow: 0 0 0 3px rgba(240,78,35,0.10) !important; }
        .field-input.error { border-color: #DC2626 !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .add-field-panel { animation: fadeIn 150ms ease; }
        .skill-tag { display: inline-flex; align-items: center; gap: 4px; background: #FFF4F1; color: #F04E23; border-radius: 999px; font-size: 12px; font-weight: 500; padding: 4px 10px; font-family: Inter, sans-serif; }
        .toolbar-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; border-radius: 4px; color: #6B7280; transition: all 120ms; }
        .toolbar-btn:hover { background: #FFF4F1; color: #F04E23; }
        .drag-row { transition: box-shadow 150ms, border-color 150ms; }
        .drag-row.dragging { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-left: 3px solid #F04E23 !important; }
      `}</style>

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
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#0D0D0D", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Acme Corp</p>
              <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0, marginTop: "2px" }}>Technology · 51–200</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={activeNav === item.id} onClick={() => handleNavClick(item.id)} />
          ))}
        </nav>

        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#F04E23", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>JS</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>John Smith</p>
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#F04E23", textTransform: "uppercase", letterSpacing: "0.06em", background: "#FFF4F1", borderRadius: "999px", padding: "1px 8px" }}>Owner</span>
            </div>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center", transition: "color 150ms" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")} title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: "240px", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top Bar */}
        <header style={{ height: "56px", background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 40 }}>
          <h1 style={{ fontFamily: "Times New Roman, serif", fontSize: "22px", color: "#0D0D0D", margin: 0 }}>
            Create <em style={{ color: "#F04E23", fontStyle: "italic" }}>Job</em>
          </h1>
        </header>

        {/* Breadcrumb */}
        <div style={{ padding: "12px 32px 0", display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={() => navigate("/company/jobs")} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Job Postings</button>
          <span style={{ color: "#9CA3AF", fontSize: "13px" }}>/</span>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "#0D0D0D", fontFamily: "Inter, sans-serif" }}>Create New Job</span>
        </div>

        {/* Form Content */}
        <main style={{ flex: 1, padding: "40px 32px 100px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "760px" }}>

            {/* ── Section 1 — Basic Info ── */}
            <SectionDivider label="Basic Information" />
            <div style={{ marginBottom: "32px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Job Title <span style={{ color: "#F04E23" }}>*</span></label>
                <input type="text" className="field-input" style={inputStyle} value={form.title} onChange={(e) => handleFieldChange("title", e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input type="text" className="field-input" style={inputStyle} value={form.department} onChange={(e) => handleFieldChange("department", e.target.value)} placeholder="e.g. Engineering" />
                </div>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input type="text" className="field-input" style={inputStyle} value={form.location} onChange={(e) => handleFieldChange("location", e.target.value)} placeholder="e.g. London, UK or Remote" />
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Job Type</label>
                  <select className="field-input" style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" }} value={form.jobType} onChange={(e) => handleFieldChange("jobType", e.target.value)}>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Remote</option>
                    <option>Hybrid</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
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
                <textarea
                  ref={descRef}
                  value={form.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Describe the role, responsibilities, and what a typical day looks like…"
                  style={{
                    width: "100%",
                    minHeight: "240px",
                    border: "none",
                    outline: "none",
                    padding: "14px",
                    fontSize: "14px",
                    fontFamily: "Inter, sans-serif",
                    color: "#0D0D0D",
                    resize: "vertical",
                    lineHeight: 1.7,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ textAlign: "right", marginTop: "6px" }}>
                <span style={{ fontSize: "12px", color: "#9CA3AF", fontFamily: "Inter, sans-serif" }}>{descLength} characters</span>
              </div>
            </div>

            {/* ── Section 3 — Requirements ── */}
            <SectionDivider label="Requirements" />
            <div style={{ marginBottom: "32px" }}>
              <label style={labelStyle}>Skills</label>
              <div
                className="field-input"
                style={{
                  ...inputStyle,
                  height: "auto",
                  minHeight: "40px",
                  padding: "6px 10px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "text",
                }}
                onClick={() => document.getElementById("skill-input")?.focus()}
              >
                {skills.map((s) => (
                  <span key={s} className="skill-tag">
                    {s}
                    <button onClick={() => handleRemoveSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#F04E23", display: "flex", alignItems: "center", padding: 0 }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  id="skill-input"
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder={skills.length === 0 ? "Add a skill…" : ""}
                  style={{ border: "none", outline: "none", flex: 1, minWidth: "80px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: "#0D0D0D", background: "transparent", padding: "4px 0" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Experience Level</label>
                  <select className="field-input" style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" }} value={experience} onChange={(e) => setExperience(e.target.value)}>
                    <option>Entry-level</option>
                    <option>Mid-level</option>
                    <option>Senior</option>
                    <option>Lead</option>
                    <option>Director</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
                <div style={{ position: "relative" }}>
                  <label style={labelStyle}>Education</label>
                  <select className="field-input" style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" }} value={education} onChange={(e) => setEducation(e.target.value)}>
                    <option>High School</option>
                    <option>Bachelor's</option>
                    <option>Master's</option>
                    <option>PhD</option>
                    <option>Any</option>
                  </select>
                  <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                </div>
              </div>
            </div>

            {/* ── Section 4 — Application Deadline ── */}
            <SectionDivider label="Application Deadline" />
            <div style={{ marginBottom: "32px", maxWidth: "300px" }}>
              <label style={labelStyle}>Deadline <span style={{ color: "#F04E23" }}>*</span></label>
              <input
                type="date"
                className={`field-input ${deadlineError ? "error" : ""}`}
                style={{ ...inputStyle, cursor: "pointer" }}
                value={form.deadline}
                onChange={(e) => handleFieldChange("deadline", e.target.value)}
              />
              {deadlineError && <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", fontFamily: "Inter, sans-serif" }}>{deadlineError}</p>}
            </div>

            {/* ── Section 5 — Custom Application Fields ── */}
            <SectionDivider label="Custom Application Fields" />
            <div style={{ marginBottom: "32px" }}>
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "18px", color: "#0D0D0D", margin: "0 0 4px" }}>Custom Questions for Applicants</h3>
              <p style={{ fontSize: "13px", color: "#9CA3AF", margin: "0 0 20px", fontFamily: "Inter, sans-serif" }}>These questions appear on the candidate application form below the standard fields.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {customFields.map((field, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`drag-row ${dragIdx === i ? "dragging" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      background: "white",
                      cursor: "grab",
                    }}
                  >
                    <GripVertical size={16} style={{ color: "#D1D5DB", flexShrink: 0, cursor: "grab" }} />
                    <span style={{ flex: 1, fontSize: "14px", color: "#0D0D0D", fontFamily: "Inter, sans-serif" }}>{field.label}</span>
                    <span style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: "999px", fontSize: "11px", fontWeight: 500, padding: "3px 10px", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>{field.type}</span>
                    <ToggleSwitch checked={field.required} onChange={() => handleToggleRequired(i)} />
                    <span style={{ fontSize: "11px", color: field.required ? "#F04E23" : "#9CA3AF", fontFamily: "Inter, sans-serif", minWidth: "52px" }}>{field.required ? "Required" : "Optional"}</span>
                    <button onClick={() => handleRemoveCustomField(i)} style={{ fontSize: "13px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>Remove</button>
                  </div>
                ))}
              </div>

              {/* Add Field Button */}
              {!showAddField && (
                <button
                  onClick={() => setShowAddField(true)}
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "2px dashed #E5E7EB",
                    borderRadius: "8px",
                    background: "transparent",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#9CA3AF",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#F04E23";
                    e.currentTarget.style.background = "#FFF4F1";
                    e.currentTarget.style.color = "#F04E23";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#9CA3AF";
                  }}
                >
                  + Add Custom Field
                </button>
              )}

              {/* Add Field Inline Panel */}
              {showAddField && (
                <div className="add-field-panel" style={{ border: "1px solid #E5E7EB", borderRadius: "10px", padding: "20px", background: "white" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Field Label</label>
                    <input type="text" className="field-input" style={inputStyle} value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Portfolio URL" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "end", marginBottom: "16px" }}>
                    <div style={{ position: "relative" }}>
                      <label style={labelStyle}>Field Type</label>
                      <select className="field-input" style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: "36px", cursor: "pointer" }} value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
                        {fieldTypes.map((t) => (<option key={t}>{t}</option>))}
                      </select>
                      <span style={{ position: "absolute", right: "12px", bottom: "13px", pointerEvents: "none" }}><SelectArrow /></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#374151", fontFamily: "Inter, sans-serif" }}>Required?</span>
                      <ToggleSwitch checked={newFieldRequired} onChange={() => setNewFieldRequired((p) => !p)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={handleAddCustomField}
                      style={{
                        height: "36px",
                        padding: "0 16px",
                        background: "#F04E23",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                        transition: "background 150ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#D43D14")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#F04E23")}
                    >
                      Add Field
                    </button>
                    <button onClick={() => { setShowAddField(false); setNewFieldLabel(""); }} style={{ fontSize: "13px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")} onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── STICKY FOOTER BAR ── */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "white",
            borderTop: "1px solid #E5E7EB",
            padding: "12px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 40,
            boxShadow: "0 -4px 16px rgba(0,0,0,0.04)",
          }}
        >
          <button
            onClick={() => navigate("/company/jobs")}
            style={{ fontSize: "14px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "color 150ms" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F04E23")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
          >
            Cancel
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              style={{
                height: "40px",
                padding: "0 20px",
                background: "white",
                color: "#374151",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
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
              Save as Draft
            </button>

            <div style={{ position: "relative" }}>
              <button
                onClick={() => navigate("/company/jobs/1/preview")}
                disabled={userRole === "Recruiter"}
                style={{
                  height: "40px",
                  padding: "0 20px",
                  background: "#F04E23",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: userRole === "Recruiter" ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  opacity: userRole === "Recruiter" ? 0.6 : 1,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  if (userRole !== "Recruiter") e.currentTarget.style.background = "#D43D14";
                }}
                onMouseLeave={(e) => {
                  if (userRole !== "Recruiter") e.currentTarget.style.background = "#F04E23";
                }}
                title={userRole === "Recruiter" ? "Only HR Managers can publish jobs" : ""}
              >
                Publish Job →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyJobCreate;
