import { useMemo, useState } from "react";
import { FileText, ShieldAlert, Timer, Building2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminModal from "@/components/admin/AdminModal";
import { useToast } from "@/components/shared/Toast";

const initialCompanies = [
  {
    id: "cmp_1",
    name: "NexusTech Ltd",
    ownerEmail: "ceo@nexustech.com",
    industry: "Technology",
    registered: "May 06, 2025",
    activity: "High",
    recruiters: 12,
    status: "Pending",
    verification: "Review Required",
  },
  {
    id: "cmp_2",
    name: "BuildCo Staffing",
    ownerEmail: "hr@buildco.com",
    industry: "Recruitment",
    registered: "May 07, 2025",
    activity: "Medium",
    recruiters: 6,
    status: "Approved",
    verification: "Fully Verified",
  },
  {
    id: "cmp_3",
    name: "AlphaMedia Group",
    ownerEmail: "talent@alphamedia.com",
    industry: "Media",
    registered: "May 07, 2025",
    activity: "Low",
    recruiters: 4,
    status: "Rejected",
    verification: "Partial",
  },
];

const industries = ["Technology", "Recruitment", "Media", "Healthcare", "Finance"];
const activities = ["High", "Medium", "Low", "Inactive"];
const statuses = ["Pending", "Approved", "Rejected", "Suspended"];
const verificationLevels = ["Fully Verified", "Partial", "Review Required"];

const badgeStyles = {
  Approved: "bg-[#F0FDF4] text-[#059669]",
  Pending: "bg-[#FFFBEB] text-[#D97706]",
  Rejected: "bg-[#FEF2F2] text-[#DC2626]",
  Suspended: "bg-[#111111] text-white",
  "Fully Verified": "bg-[#F0FDF4] text-[#059669]",
  Partial: "bg-[#FFF4F1] text-[#F04E23]",
  "Review Required": "bg-[#FFFBEB] text-[#D97706]",
};

export default function AdminCompanies() {
  const { addToast, ToastContainer } = useToast();
  const [companies, setCompanies] = useState(initialCompanies);
  const [filters, setFilters] = useState({ search: "", industry: "", activity: "", status: "", verification: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [drawerCompany, setDrawerCompany] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [formValues, setFormValues] = useState({ name: "", ownerEmail: "", industry: "Technology", activity: "Medium", recruiters: 1, status: "Pending", verification: "Review Required" });
  const [formErrors, setFormErrors] = useState({});
  const [reason, setReason] = useState("");

  const filteredCompanies = useMemo(() => {
    const search = appliedFilters.search.toLowerCase();
    return companies.filter((company) => {
      const matchesSearch = !search || company.name.toLowerCase().includes(search) || company.ownerEmail.toLowerCase().includes(search);
      const matchesIndustry = !appliedFilters.industry || company.industry === appliedFilters.industry;
      const matchesActivity = !appliedFilters.activity || company.activity === appliedFilters.activity;
      const matchesStatus = !appliedFilters.status || company.status === appliedFilters.status;
      const matchesVerification = !appliedFilters.verification || company.verification === appliedFilters.verification;
      return matchesSearch && matchesIndustry && matchesActivity && matchesStatus && matchesVerification;
    });
  }, [companies, appliedFilters]);

  const applyFilters = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAppliedFilters(filters);
      setIsLoading(false);
    }, 400);
  };

  const resetFilters = () => {
    const reset = { search: "", industry: "", activity: "", status: "", verification: "" };
    setFilters(reset);
    setAppliedFilters(reset);
  };

  const openCreate = () => {
    setFormValues({ name: "", ownerEmail: "", industry: "Technology", activity: "Medium", recruiters: 1, status: "Pending", verification: "Review Required" });
    setFormErrors({});
    setFormModal({ mode: "create" });
  };

  const openEdit = (company) => {
    setFormValues({ name: company.name, ownerEmail: company.ownerEmail, industry: company.industry, activity: company.activity, recruiters: company.recruiters, status: company.status, verification: company.verification });
    setFormErrors({});
    setFormModal({ mode: "edit", company });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formValues.name.trim()) nextErrors.name = "Company name is required";
    if (!formValues.ownerEmail.trim() || !/\S+@\S+\.\S+/.test(formValues.ownerEmail)) nextErrors.ownerEmail = "Valid owner email required";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = () => {
    if (!validateForm()) return;
    if (formModal.mode === "create") {
      const newCompany = { id: `cmp_${Date.now()}`, registered: "Today", ...formValues };
      setCompanies((prev) => [newCompany, ...prev]);
      addToast("Company created successfully.", "success");
    } else {
      setCompanies((prev) => prev.map((company) => (company.id === formModal.company.id ? { ...company, ...formValues } : company)));
      addToast("Company updated successfully.", "info");
    }
    setFormModal(null);
  };

  const openConfirm = (type, company) => {
    setReason("");
    setConfirmModal({ type, company });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (["reject", "suspend", "delete"].includes(confirmModal.type) && reason.trim().length < 10) return;

    if (confirmModal.type === "approve") {
      setCompanies((prev) => prev.map((company) => (company.id === confirmModal.company.id ? { ...company, status: "Approved" } : company)));
      addToast("Company approved.", "success");
    }
    if (confirmModal.type === "reject") {
      setCompanies((prev) => prev.map((company) => (company.id === confirmModal.company.id ? { ...company, status: "Rejected" } : company)));
      addToast("Company rejected.", "error");
    }
    if (confirmModal.type === "suspend") {
      setCompanies((prev) => prev.map((company) => (company.id === confirmModal.company.id ? { ...company, status: "Suspended" } : company)));
      addToast("Company suspended.", "warning");
    }
    if (confirmModal.type === "delete") {
      setCompanies((prev) => prev.filter((company) => company.id !== confirmModal.company.id));
      addToast("Company deleted.", "error");
    }
    setConfirmModal(null);
  };

  const toggleSelection = (id) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const toggleAll = (checked) => {
    setSelectedRows(checked ? filteredCompanies.map((row) => row.id) : []);
  };

  const columns = [
    { key: "name", label: "Company Name", render: (row) => <span className="font-medium text-[#0D0D0D]">{row.name}</span> },
    { key: "ownerEmail", label: "Owner Email", render: (row) => <span className="text-[#6B7280]">{row.ownerEmail}</span> },
    { key: "industry", label: "Industry", render: (row) => <span className="text-[#6B7280]">{row.industry}</span> },
    { key: "registered", label: "Registered", render: (row) => <span className="text-[#6B7280]">{row.registered}</span> },
    {
      key: "activity",
      label: "Hiring Activity",
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-[11px] ${row.activity === "High" ? "bg-[#F0FDF4] text-[#059669]" : row.activity === "Medium" ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
          {row.activity}
        </span>
      ),
    },
    { key: "recruiters", label: "Recruiter Count", render: (row) => <span className="text-[#6B7280]">{row.recruiters}</span> },
    { key: "status", label: "Approval Status", render: (row) => <span className={`px-3 py-1 rounded-full text-[11px] ${badgeStyles[row.status]}`}>{row.status}</span> },
    { key: "verification", label: "Verification Level", render: (row) => <span className={`px-3 py-1 rounded-full text-[11px] ${badgeStyles[row.verification]}`}>{row.verification}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="text-[12px] text-[#F04E23] hover:underline" onClick={() => openEdit(row)}>Edit</button>
          <button className="text-[12px] text-[#059669]" onClick={() => openConfirm("approve", row)}>Approve</button>
          <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("reject", row)}>Reject</button>
          <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("suspend", row)}>Suspend</button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Company Management" pendingCount={3}>
      <AdminPageHeader
        icon="🏢"
        title="Company"
        accent="Management"
        subtitle="Approve, manage, and audit employer accounts across the IntelliHire platform."
        actions={[
          { label: "Create Company", icon: Building2, onClick: openCreate, className: "btn-primary" },
          { label: "Export Report", icon: FileText },
          { label: "Admin Audit Logs", icon: Timer },
          { label: "Quick Review", icon: ShieldAlert },
        ]}
        chips={[
          { label: "5 companies pending review", className: "bg-[#FFF4F1] text-[#F04E23]" },
          { label: "Last synced 2 mins ago", className: "text-[#9CA3AF]" },
        ]}
      />

      <div className="border border-[#E5E7EB] rounded-xl bg-white p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input className="input-field" placeholder="Search by Company Name / Owner Email" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
          <select className="input-field" value={filters.industry} onChange={(e) => setFilters((prev) => ({ ...prev, industry: e.target.value }))}>
            <option value="">Industry: All</option>
            {industries.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="input-field" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">Approval: All</option>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="input-field" value={filters.activity} onChange={(e) => setFilters((prev) => ({ ...prev, activity: e.target.value }))}>
            <option value="">Activity: All</option>
            {activities.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="input-field" value={filters.verification} onChange={(e) => setFilters((prev) => ({ ...prev, verification: e.target.value }))}>
            <option value="">Verification: All</option>
            {verificationLevels.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="input-field" placeholder="Registration range" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={applyFilters}>Apply Filters</button>
          <button className="btn-ghost" onClick={resetFilters}>Reset</button>
          <button className="btn-secondary h-[36px] px-4 text-[12px]">Save Filter View</button>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-4 border border-[#FCA68A] bg-[#FFF4F1] rounded-xl p-3 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="font-semibold text-[#F04E23]">{selectedRows.length} selected</span>
          <button className="px-3 py-1 rounded-full bg-white border border-[#FCA68A] text-[#F04E23]">Approve Selected</button>
          <button className="px-3 py-1 rounded-full bg-white border border-[#FCA68A] text-[#F04E23]">Suspend Selected</button>
          <button onClick={() => setSelectedRows([])} className="ml-auto text-[#9CA3AF]">Clear</button>
        </div>
      )}

      <AdminDataTable
        columns={columns}
        rows={filteredCompanies}
        onRowClick={setDrawerCompany}
        selectedRows={selectedRows}
        onToggleRow={toggleSelection}
        onToggleAll={toggleAll}
        isLoading={isLoading}
        emptyLabel="No companies match the current filters."
      />

      {drawerCompany && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerCompany(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white border-l border-[#E5E7EB] p-6 admin-drawer">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>{drawerCompany.name}</h3>
              <button onClick={() => setDrawerCompany(null)} className="text-[#9CA3AF] hover:text-[#374151]">✕</button>
            </div>
            <div className="mt-4 space-y-4 text-[13px] text-[#6B7280]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Hiring Activity</div>
                <div className="text-[#374151] font-medium">{drawerCompany.activity}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Recruiter Count</div>
                <div className="text-[#374151] font-medium">{drawerCompany.recruiters} recruiters</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Verification</div>
                <div className="text-[#374151] font-medium">{drawerCompany.verification}</div>
              </div>
            </div>
            <button className="mt-6 w-full h-[40px] rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#374151]" onClick={() => setDrawerCompany(null)}>
              Close Drawer
            </button>
          </aside>
        </div>
      )}

      {formModal && (
        <AdminModal
          title={formModal.mode === "create" ? "Create new company" : `Edit ${formModal.company.name}`}
          description="Provide core company details for the employer account."
          confirmLabel={formModal.mode === "create" ? "Create Company" : "Save Changes"}
          onConfirm={submitForm}
          onClose={() => setFormModal(null)}
        >
          <div className="space-y-3 text-[13px]">
            <div>
              <label className="input-label">Company Name</label>
              <input className="input-field" value={formValues.name} onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))} />
              {formErrors.name && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.name}</div>}
            </div>
            <div>
              <label className="input-label">Owner Email</label>
              <input className="input-field" value={formValues.ownerEmail} onChange={(e) => setFormValues((prev) => ({ ...prev, ownerEmail: e.target.value }))} />
              {formErrors.ownerEmail && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.ownerEmail}</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Industry</label>
                <select className="input-field" value={formValues.industry} onChange={(e) => setFormValues((prev) => ({ ...prev, industry: e.target.value }))}>
                  {industries.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Activity</label>
                <select className="input-field" value={formValues.activity} onChange={(e) => setFormValues((prev) => ({ ...prev, activity: e.target.value }))}>
                  {activities.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Approval Status</label>
                <select className="input-field" value={formValues.status} onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}>
                  {statuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Verification</label>
                <select className="input-field" value={formValues.verification} onChange={(e) => setFormValues((prev) => ({ ...prev, verification: e.target.value }))}>
                  {verificationLevels.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>
        </AdminModal>
      )}

      {confirmModal && (
        <AdminModal
          title={
            confirmModal.type === "approve"
              ? `Approve ${confirmModal.company.name}?`
              : confirmModal.type === "reject"
                ? `Reject ${confirmModal.company.name}?`
                : confirmModal.type === "suspend"
                  ? `Suspend ${confirmModal.company.name}?`
                  : `Delete ${confirmModal.company.name}?`
          }
          description="Provide a reason to log in the audit trail."
          confirmLabel={confirmModal.type === "approve" ? "Confirm Approval" : confirmModal.type === "reject" ? "Reject Company" : confirmModal.type === "suspend" ? "Confirm Suspension" : "Confirm Delete"}
          onConfirm={handleConfirm}
          onClose={() => setConfirmModal(null)}
          confirmDisabled={confirmModal.type !== "approve" && reason.trim().length < 10}
          tone={confirmModal.type === "approve" ? "primary" : "danger"}
        >
          {confirmModal.type !== "approve" && (
            <>
              <textarea
                className="input-field min-h-[90px]"
                placeholder="Reason (min 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="text-[11px] text-[#9CA3AF] mt-1">{reason.length} / 10</div>
            </>
          )}
        </AdminModal>
      )}

      <ToastContainer />
    </AdminLayout>
  );
}
