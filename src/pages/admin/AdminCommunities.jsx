import { useMemo, useState } from "react";
import { Globe, Plus, FileText } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminModal from "@/components/admin/AdminModal";
import { useToast } from "@/components/shared/Toast";

const initialCommunities = [
  { id: "com_1", name: "Frontend Guild", owner: "NexusTech", members: 210, status: "Active", updated: "2h ago" },
  { id: "com_2", name: "Recruiter Exchange", owner: "BuildCo", members: 98, status: "Active", updated: "1d ago" },
  { id: "com_3", name: "Hiring Ops Circle", owner: "AlphaMedia", members: 64, status: "Paused", updated: "3d ago" },
];

const statusBadge = {
  Active: "bg-[#F0FDF4] text-[#059669]",
  Paused: "bg-[#FFFBEB] text-[#D97706]",
  Archived: "bg-[#FEF2F2] text-[#DC2626]",
};

export default function AdminCommunities() {
  const { addToast, ToastContainer } = useToast();
  const [communities, setCommunities] = useState(initialCommunities);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [formModal, setFormModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [formValues, setFormValues] = useState({ name: "", owner: "", members: 0, status: "Active" });
  const [formErrors, setFormErrors] = useState({});
  const [reason, setReason] = useState("");

  const filtered = useMemo(() => {
    const search = appliedFilters.search.toLowerCase();
    return communities.filter((community) => {
      const matchesSearch = !search || community.name.toLowerCase().includes(search) || community.owner.toLowerCase().includes(search);
      const matchesStatus = !appliedFilters.status || community.status === appliedFilters.status;
      return matchesSearch && matchesStatus;
    });
  }, [communities, appliedFilters]);

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
    setFormValues({ name: "", owner: "", members: 0, status: "Active" });
    setFormErrors({});
    setFormModal({ mode: "create" });
  };

  const openEdit = (community) => {
    setFormValues({ name: community.name, owner: community.owner, members: community.members, status: community.status });
    setFormErrors({});
    setFormModal({ mode: "edit", community });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formValues.name.trim()) nextErrors.name = "Community name required";
    if (!formValues.owner.trim()) nextErrors.owner = "Owner required";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = () => {
    if (!validateForm()) return;
    if (formModal.mode === "create") {
      setCommunities((prev) => [{ id: `com_${Date.now()}`, updated: "Just now", ...formValues }, ...prev]);
      addToast("Community created.", "success");
    } else {
      setCommunities((prev) => prev.map((community) => (community.id === formModal.community.id ? { ...community, ...formValues } : community)));
      addToast("Community updated.", "info");
    }
    setFormModal(null);
  };

  const openConfirm = (type, community) => {
    setReason("");
    setConfirmModal({ type, community });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (reason.trim().length < 10) return;

    if (confirmModal.type === "archive") {
      setCommunities((prev) => prev.map((community) => (community.id === confirmModal.community.id ? { ...community, status: "Archived" } : community)));
      addToast("Community archived.", "warning");
    }
    if (confirmModal.type === "delete") {
      setCommunities((prev) => prev.filter((community) => community.id !== confirmModal.community.id));
      addToast("Community deleted.", "error");
    }
    setConfirmModal(null);
  };

  const toggleSelection = (id) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const toggleAll = (checked) => {
    setSelectedRows(checked ? filtered.map((row) => row.id) : []);
  };

  const columns = [
    { key: "name", label: "Community Name", render: (row) => <span className="font-medium text-[#0D0D0D]">{row.name}</span> },
    { key: "owner", label: "Owner", render: (row) => <span className="text-[#6B7280]">{row.owner}</span> },
    { key: "members", label: "Members", render: (row) => <span className="text-[#6B7280]">{row.members}</span> },
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
    <AdminLayout title="Community Management" pendingCount={3}>
      <AdminPageHeader
        icon="🌐"
        title="Community"
        accent="Management"
        subtitle="Manage recruiter and candidate communities, moderation status, and engagement."
        actions={[
          { label: "Create Community", icon: Plus, onClick: openCreate, className: "btn-primary" },
          { label: "Export Report", icon: FileText },
          { label: "Community Health", icon: Globe },
        ]}
        chips={[
          { label: "2 communities require moderation", className: "bg-[#FFF4F1] text-[#F04E23]" },
          { label: "Last synced 4 mins ago", className: "text-[#9CA3AF]" },
        ]}
      />

      <div className="border border-[#E5E7EB] rounded-xl bg-white p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input-field" placeholder="Search community / owner" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
          <select className="input-field" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">Status: All</option>
            {Object.keys(statusBadge).map((status) => <option key={status}>{status}</option>)}
          </select>
          <input className="input-field" placeholder="Registration range" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={applyFilters}>Apply Filters</button>
          <button className="btn-ghost" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-4 border border-[#FCA68A] bg-[#FFF4F1] rounded-xl p-3 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="font-semibold text-[#F04E23]">{selectedRows.length} selected</span>
          <button className="px-3 py-1 rounded-full bg-white border border-[#FCA68A] text-[#F04E23]">Archive Selected</button>
          <button onClick={() => setSelectedRows([])} className="ml-auto text-[#9CA3AF]">Clear</button>
        </div>
      )}

      <AdminDataTable
        columns={columns}
        rows={filtered}
        selectedRows={selectedRows}
        onToggleRow={toggleSelection}
        onToggleAll={toggleAll}
        isLoading={isLoading}
        emptyLabel="No communities match the current filters."
      />

      {formModal && (
        <AdminModal
          title={formModal.mode === "create" ? "Create new community" : `Edit ${formModal.community.name}`}
          description="Maintain community details and moderation scope."
          confirmLabel={formModal.mode === "create" ? "Create Community" : "Save Changes"}
          onConfirm={submitForm}
          onClose={() => setFormModal(null)}
        >
          <div className="space-y-3 text-[13px]">
            <div>
              <label className="input-label">Community Name</label>
              <input className="input-field" value={formValues.name} onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))} />
              {formErrors.name && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.name}</div>}
            </div>
            <div>
              <label className="input-label">Owner</label>
              <input className="input-field" value={formValues.owner} onChange={(e) => setFormValues((prev) => ({ ...prev, owner: e.target.value }))} />
              {formErrors.owner && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.owner}</div>}
            </div>
            <div>
              <label className="input-label">Status</label>
              <select className="input-field" value={formValues.status} onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}>
                {Object.keys(statusBadge).map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          </div>
        </AdminModal>
      )}

      {confirmModal && (
        <AdminModal
          title={confirmModal.type === "archive" ? `Archive ${confirmModal.community.name}?` : `Delete ${confirmModal.community.name}?`}
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
