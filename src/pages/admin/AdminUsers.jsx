import { useMemo, useState } from "react";
import { FileText, ShieldAlert, Timer, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminModal from "@/components/admin/AdminModal";
import { useToast } from "@/components/shared/Toast";

const initialUsers = [
  {
    id: "usr_1",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    role: "Candidate",
    registered: "Apr 18, 2025",
    lastActive: "2h ago",
    verification: "Verified",
    status: "Active",
  },
  {
    id: "usr_2",
    name: "David Chen",
    email: "david.chen@email.com",
    role: "Recruiter",
    registered: "Apr 21, 2025",
    lastActive: "1d ago",
    verification: "Pending",
    status: "Restricted",
  },
  {
    id: "usr_3",
    name: "Amira Patel",
    email: "amira.patel@email.com",
    role: "HR Manager",
    registered: "Apr 25, 2025",
    lastActive: "3d ago",
    verification: "Failed",
    status: "Suspended",
  },
];

const roles = ["Candidate", "Recruiter", "HR Manager", "Company Owner", "Admin"];
const statuses = ["Active", "Suspended", "Restricted", "Pending Verification"];
const verifications = ["Verified", "Pending", "Failed"];

const badgeStyles = {
  Verified: "bg-[#F0FDF4] text-[#059669]",
  Pending: "bg-[#FFFBEB] text-[#D97706]",
  Failed: "bg-[#FEF2F2] text-[#DC2626]",
  Active: "bg-[#F0FDF4] text-[#059669]",
  Suspended: "bg-[#FEF2F2] text-[#DC2626]",
  Restricted: "bg-[#FFFBEB] text-[#D97706]",
  "Pending Verification": "bg-[#FFFBEB] text-[#D97706]",
};

export default function AdminUsers() {
  const { addToast, ToastContainer } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [filters, setFilters] = useState({ search: "", role: "", status: "", verification: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [drawerUser, setDrawerUser] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [formValues, setFormValues] = useState({ name: "", email: "", role: "Candidate", status: "Active", verification: "Verified" });
  const [formErrors, setFormErrors] = useState({});
  const [reason, setReason] = useState("");

  const filteredUsers = useMemo(() => {
    const search = appliedFilters.search.toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !search || user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
      const matchesRole = !appliedFilters.role || user.role === appliedFilters.role;
      const matchesStatus = !appliedFilters.status || user.status === appliedFilters.status;
      const matchesVerification = !appliedFilters.verification || user.verification === appliedFilters.verification;
      return matchesSearch && matchesRole && matchesStatus && matchesVerification;
    });
  }, [users, appliedFilters]);

  const applyFilters = () => {
    setIsLoading(true);
    setTimeout(() => {
      setAppliedFilters(filters);
      setIsLoading(false);
    }, 400);
  };

  const resetFilters = () => {
    const reset = { search: "", role: "", status: "", verification: "" };
    setFilters(reset);
    setAppliedFilters(reset);
  };

  const openCreate = () => {
    setFormValues({ name: "", email: "", role: "Candidate", status: "Active", verification: "Verified" });
    setFormErrors({});
    setFormModal({ mode: "create" });
  };

  const openEdit = (user) => {
    setFormValues({ name: user.name, email: user.email, role: user.role, status: user.status, verification: user.verification });
    setFormErrors({});
    setFormModal({ mode: "edit", user });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formValues.name.trim()) nextErrors.name = "Name is required";
    if (!formValues.email.trim() || !/\S+@\S+\.\S+/.test(formValues.email)) nextErrors.email = "Valid email required";
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = () => {
    if (!validateForm()) return;
    if (formModal.mode === "create") {
      const newUser = {
        id: `usr_${Date.now()}`,
        registered: "Today",
        lastActive: "Just now",
        ...formValues,
      };
      setUsers((prev) => [newUser, ...prev]);
      addToast("User created successfully.", "success");
    } else {
      setUsers((prev) => prev.map((user) => (user.id === formModal.user.id ? { ...user, ...formValues } : user)));
      addToast("User updated successfully.", "info");
    }
    setFormModal(null);
  };

  const openConfirm = (type, user) => {
    setReason("");
    setConfirmModal({ type, user });
  };

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === "delete" && reason.trim().length < 10) return;
    if (confirmModal.type === "suspend" && reason.trim().length < 10) return;

    if (confirmModal.type === "delete") {
      setUsers((prev) => prev.filter((user) => user.id !== confirmModal.user.id));
      addToast("User deleted.", "error");
    }
    if (confirmModal.type === "suspend") {
      setUsers((prev) => prev.map((user) => (user.id === confirmModal.user.id ? { ...user, status: "Suspended" } : user)));
      addToast("User suspended.", "warning");
    }
    if (confirmModal.type === "activate") {
      setUsers((prev) => prev.map((user) => (user.id === confirmModal.user.id ? { ...user, status: "Active" } : user)));
      addToast("User reactivated.", "success");
    }
    setConfirmModal(null);
  };

  const toggleSelection = (id) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  };

  const toggleAll = (checked) => {
    setSelectedRows(checked ? filteredUsers.map((row) => row.id) : []);
  };

  const columns = [
    {
      key: "name",
      label: "User Name",
      sortable: true,
      onSort: () => setUsers((prev) => [...prev].reverse()),
      render: (row) => <span className="font-medium text-[#0D0D0D]">{row.name}</span>,
    },
    { key: "email", label: "Email", render: (row) => <span className="text-[#6B7280]">{row.email}</span> },
    { key: "role", label: "Role", render: (row) => <span className="text-[#6B7280]">{row.role}</span> },
    { key: "registered", label: "Registered", render: (row) => <span className="text-[#6B7280]">{row.registered}</span> },
    { key: "lastActive", label: "Last Active", render: (row) => <span className="text-[#6B7280]">{row.lastActive}</span> },
    {
      key: "verification",
      label: "Verification",
      render: (row) => <span className={`px-3 py-1 rounded-full text-[11px] ${badgeStyles[row.verification]}`}>{row.verification}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <span className={`px-3 py-1 rounded-full text-[11px] ${badgeStyles[row.status]}`}>{row.status}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="text-[12px] text-[#F04E23] hover:underline" onClick={() => openEdit(row)}>Edit</button>
          {row.status === "Suspended" ? (
            <button className="text-[12px] text-[#059669]" onClick={() => openConfirm("activate", row)}>Activate</button>
          ) : (
            <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("suspend", row)}>Suspend</button>
          )}
          <button className="text-[12px] text-[#DC2626]" onClick={() => openConfirm("delete", row)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="User Management" pendingCount={3}>
      <AdminPageHeader
        icon="👤"
        title="User"
        accent="Management"
        subtitle="Manage users, verification status, and access across the IntelliHire platform."
        actions={[
          { label: "Create User", icon: UserPlus, onClick: openCreate, className: "btn-primary" },
          { label: "Export Report", icon: FileText },
          { label: "Admin Audit Logs", icon: Timer },
          { label: "Quick Review", icon: ShieldAlert },
        ]}
        chips={[
          { label: "7 accounts require review today", className: "bg-[#FFF4F1] text-[#F04E23]" },
          { label: "Last synced 3 mins ago", className: "text-[#9CA3AF]" },
        ]}
      />

      {error ? (
        <div className="border border-[#FCA68A] bg-[#FFF4F1] rounded-xl p-6 text-[#9A3412]">
          {error}
          <button className="ml-4 text-[#F04E23] hover:underline" onClick={() => setError(null)}>Retry</button>
        </div>
      ) : (
        <>
          <div className="border border-[#E5E7EB] rounded-xl bg-white p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <input className="input-field" placeholder="Search by Name / Email" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
              <select className="input-field" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
                <option value="">Role: All</option>
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
              <select className="input-field" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">Status: All</option>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <select className="input-field" value={filters.verification} onChange={(e) => setFilters((prev) => ({ ...prev, verification: e.target.value }))}>
                <option value="">Verification: All</option>
                {verifications.map((item) => <option key={item}>{item}</option>)}
              </select>
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
              <button className="px-3 py-1 rounded-full bg-white border border-[#FCA68A] text-[#F04E23]">Suspend Selected</button>
              <button className="px-3 py-1 rounded-full bg-white border border-[#FCA68A] text-[#F04E23]">Export Selected</button>
              <button onClick={() => setSelectedRows([])} className="ml-auto text-[#9CA3AF]">Clear</button>
            </div>
          )}

          <AdminDataTable
            columns={columns}
            rows={filteredUsers}
            onRowClick={setDrawerUser}
            selectedRows={selectedRows}
            onToggleRow={toggleSelection}
            onToggleAll={toggleAll}
            isLoading={isLoading}
            emptyLabel="No users match the current filters."
          />
        </>
      )}

      {drawerUser && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerUser(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white border-l border-[#E5E7EB] p-6 admin-drawer">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
                {drawerUser.name}
              </h3>
              <button onClick={() => setDrawerUser(null)} className="text-[#9CA3AF] hover:text-[#374151]">✕</button>
            </div>
            <div className="mt-4 space-y-4 text-[13px] text-[#6B7280]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Role</div>
                <div className="text-[#374151] font-medium">{drawerUser.role}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Activity</div>
                <div className="text-[#374151] font-medium">Last active {drawerUser.lastActive}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Risk Flags</div>
                <div className="text-[#374151] font-medium">No critical alerts</div>
              </div>
            </div>
            <button className="mt-6 w-full h-[40px] rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#374151]" onClick={() => setDrawerUser(null)}>
              Close Drawer
            </button>
          </aside>
        </div>
      )}

      {formModal && (
        <AdminModal
          title={formModal.mode === "create" ? "Create new user" : `Edit ${formModal.user.name}`}
          description="All fields are required for account provisioning."
          confirmLabel={formModal.mode === "create" ? "Create User" : "Save Changes"}
          onConfirm={submitForm}
          onClose={() => setFormModal(null)}
        >
          <div className="space-y-3 text-[13px]">
            <div>
              <label className="input-label">Name</label>
              <input className="input-field" value={formValues.name} onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))} />
              {formErrors.name && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.name}</div>}
            </div>
            <div>
              <label className="input-label">Email</label>
              <input className="input-field" value={formValues.email} onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))} />
              {formErrors.email && <div className="text-[11px] text-[#DC2626] mt-1">{formErrors.email}</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Role</label>
                <select className="input-field" value={formValues.role} onChange={(e) => setFormValues((prev) => ({ ...prev, role: e.target.value }))}>
                  {roles.map((role) => <option key={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Status</label>
                <select className="input-field" value={formValues.status} onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value }))}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Verification</label>
              <select className="input-field" value={formValues.verification} onChange={(e) => setFormValues((prev) => ({ ...prev, verification: e.target.value }))}>
                {verifications.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </AdminModal>
      )}

      {confirmModal && (
        <AdminModal
          title={
            confirmModal.type === "delete"
              ? `Delete ${confirmModal.user.name}?`
              : confirmModal.type === "suspend"
                ? `Suspend ${confirmModal.user.name}?`
                : `Reactivate ${confirmModal.user.name}?`
          }
          description="Provide a reason to log in the audit trail."
          confirmLabel={confirmModal.type === "delete" ? "Confirm Delete" : confirmModal.type === "suspend" ? "Confirm Suspension" : "Confirm Reactivation"}
          onConfirm={handleConfirm}
          onClose={() => setConfirmModal(null)}
          confirmDisabled={confirmModal.type !== "activate" && reason.trim().length < 10}
          tone={confirmModal.type === "activate" ? "primary" : "danger"}
        >
          {confirmModal.type !== "activate" && (
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
