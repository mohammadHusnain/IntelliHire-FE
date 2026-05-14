import { useMemo, useState } from "react";
import { FileText, Plus, BarChart3 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminModal from "@/components/admin/AdminModal";
import { useToast } from "@/components/shared/Toast";

const initialReports = [
  { id: "rep_1", title: "Monthly Hiring Health", owner: "Super Admin", status: "Scheduled", updated: "May 10, 2025" },
  { id: "rep_2", title: "Approval SLA Review", owner: "Ops Team", status: "Published", updated: "May 09, 2025" },
  { id: "rep_3", title: "Community Growth", owner: "Analytics", status: "Draft", updated: "May 06, 2025" },
];

const statuses = ["Draft", "Scheduled", "Published", "Archived"];
const statusBadge = {
  Draft: "bg-[#F3F4F6] text-[#6B7280]",
  Scheduled: "bg-[#FFFBEB] text-[#D97706]",
  Published: "bg-[#F0FDF4] text-[#059669]",
  Archived: "bg-[#FEF2F2] text-[#DC2626]",
};

export default function AdminReports() {
  const { addToast, ToastContainer } = useToast();
  const [reports, setReports] = useState(initialReports);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [formValues, setFormValues] = useState({ title: "", owner: "", status: "Draft" });
  const [formErrors, setFormErrors] = useState({});
  const [reason, setReason] = useState("");

  const filtered = useMemo(() => {
    const search = appliedFilters.search.toLowerCase();
    return reports.filter((report) => {
      const matchesSearch = !search || report.title.toLowerCase().includes(search) || report.owner.toLowerCase().includes(search);
      const matchesStatus = !appliedFilters.status || report.status === appliedFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [reports, appliedFilters]);

  const applyFilters = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAppliedFilters(filters);
      setIsLoading(false);
    }, 400);
  };

  const resetFilters = () => {
    const reset = { search: "", status: "" };
    setFilters(reset);
    setAppliedFilters(reset);
  };

  const openCreate = () => {
    setFormValues({ title: "", owner: "", status: "Draft" });
    setFormErrors({});
    setFormModal({ mode: "create" });
  };

  const openEdit = (report) => {
    setFormValues({ title: report.title, owner: report.owner, status: report.status });
    setFormErrors({});
    setFormModal({ mode: "edit", report });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formValues.title.trim()) nextErrors.title = "Report title required";
    if (!formValues.owner.trim()) nextErrors.owner = "Owner required";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = () => {
    if (!validateForm()) return;
    if (formModal.mode === "create") {
      setReports((prev) => [{ id: `rep_${Date.now()}`, updated: "Today", ...formValues }, ...prev]);
      addToast("Report created.", "success");
    } else {
      setReports((prev) => prev.map((report) => (report.id === formModal.report.id ? { ...report, ...formValues } : report)));
      addToast("Report updated.", "info");
    }
    setFormModal(null);
  };

  const openConfirm = (type, report) => {
    setReason("");
    setConfirmModal({ type, report });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (reason.trim().length < 10) return;

    if (confirmModal.type === "archive") {
      setReports((prev) => prev.map((report) => (report.id === confirmModal.report.id ? { ...report, status: "Archived" } : report)));
      addToast("Report archived.", "warning");
    }
    if (confirmModal.type === "delete") {
      setReports((prev) => prev.filter((report) => report.id !== confirmModal.report.id));
      addToast("Report deleted.", "error");
    }
    setConfirmModal(null);
  };

  const columns = [
    { key: "title", label: "Report Title", render: (row) => <span className="font-medium text-[#0D0D0D]">{row.title}</span> },
    { key: "owner", label: "Owner", render: (row) => <span className="text-[#6B7280]">{row.owner}</span> },
    { key: "updated", label: "Last Updated", render: (row) => <span className="text-[#6B7280]">{row.updated}</span> },
    { key: "status", label: "Status", render: (row) => <span className={`px-3 py-1 rounded-full text-[11px] ${statusBadge[row.status]}`}>{row.status}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="text-[12px] text-[#F04E23] hover:underline" onClick={() => openEdit(row)}>Edit</button>
          <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("archive", row)}>Archive</button>
          <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("delete", row)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Reports & Analytics" pendingCount={3}>
      <AdminPageHeader
        icon="📈"
        title="Reports"
        accent="& Analytics"
        subtitle="Create, schedule, and audit platform-wide analytics reports."
        actions={[
          { label: "Create Report", icon: Plus, onClick: openCreate, className: "btn-primary" },
          { label: "Export Report", icon: FileText },
          { label: "Insights", icon: BarChart3 },
        ]}
        chips={[
          { label: "3 reports awaiting review", className: "bg-[#FFF4F1] text-[#F04E23]" },
          { label: "Last synced 1 min ago", className: "text-[#9CA3AF]" },
        ]}
      />

      <div className="border border-[#E5E7EB] rounded-xl bg-white p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input-field" placeholder="Search by report title / owner" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
          <select className="input-field" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">Status: All</option>
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
          <input className="input-field" placeholder="Date range" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={applyFilters}>Apply Filters</button>
          <button className="btn-ghost" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        isLoading={isLoading}
        emptyLabel="No reports match the current filters."
      />

      {formModal && (
        <AdminModal
          title={formModal.mode === "create" ? "Create new report" : `Edit ${formModal.report.title}`}
          description="Define ownership and reporting status for analytics."
          confirmLabel={formModal.mode === "create" ? "Create Report" : "Save Changes"}
          onConfirm={submitForm}
          onClose={() => setFormModal(null)}
        >
          <div className="space-y-3 text-[13px]">
            <div>
              <label className="input-label">Report Title</label>
              <input className="input-field" value={formValues.title} onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))} />
              {formErrors.title && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.title}</div>}
            </div>
            <div>
              <label className="input-label">Owner</label>
              <input className="input-field" value={formValues.owner} onChange={(e) => setFormValues((prev) => ({ ...prev, owner: e.target.value }))} />
              {formErrors.owner && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.owner}</div>}
            </div>
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={formValues.status} onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>
        </AdminModal>
      )}

      {confirmModal && (
        <AdminModal
          title={confirmModal.type === "archive" ? `Archive ${confirmModal.report.title}?` : `Delete ${confirmModal.report.title}?`}
          description="Provide a reason to log in the audit trail."
          confirmLabel={confirmModal.type === "archive" ? "Confirm Archive" : "Confirm Delete"}
          onConfirm={handleConfirm}
          onClose={() => setConfirmModal(null)}
          confirmDisabled={reason.trim().length < 10}
          tone="danger"
        >
          <textarea className="input-field min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (min 10 characters)" />
          <div className="text-[11px] text-[#9CA3AF] mt-1">{reason.length} / 10</div>
        </AdminModal>
      )}

      <ToastContainer />
    </AdminLayout>
  );
}
