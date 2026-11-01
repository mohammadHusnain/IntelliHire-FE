import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive, Briefcase, CheckCircle2, Download, Globe2, Lock, PauseCircle, PlayCircle, Plus, SearchX, Users, X,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile, Toggle } from "@/components/app/primitives";
import { ActionDialog, DataTable, Drawer, Field, SearchField, SelectField, Tabs } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import AuthField from "@/components/shared/AuthField";
import { useCommunityStore } from "@/store/communityStore";
import { useCandidateActions, useCandidateStore } from "@/store/candidateStore";
import { joinRequests } from "@/lib/adminStats";
import { logAudit } from "@/store/auditStore";
import { COMMUNITY_CATEGORIES } from "@/data/communitiesData";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";

const STATUS = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  archived: { label: "Archived", tone: "danger" },
};

const CATEGORIES = COMMUNITY_CATEGORIES.filter((c) => c !== "All");

const Logo = ({ c, size = 40 }) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
    style={{ background: c.avatarBg, width: size, height: size, fontSize: size * 0.33 }}
  >
    {c.avatar}
  </span>
);

const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone || "neutral"}>{STATUS[status]?.label || status}</Badge>;

function EditDialog({ community, onSave, onClose }) {
  const [form, setForm] = useState({
    name: community?.name || "",
    category: community?.category || CATEGORIES[0],
    description: community?.description || "",
    tags: (community?.tags || []).join(", "),
    isOpen: community?.isOpen ?? true,
  });
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 3) errs.name = "Give the community a name";
    if (form.description.trim().length < 20) errs.description = "Describe it in at least 20 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
      isOpen: form.isOpen,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <form onSubmit={submit} noValidate className="animate-modal-in relative max-h-[90dvh] w-full max-w-[520px] overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">
        <button type="button" onClick={onClose} aria-label="Close" className="icon-btn absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100">
          <X size={18} />
        </button>
        <h2 className="display text-[26px]">{community ? "Edit community" : "New community"}</h2>
        <p className="mt-1.5 text-[14px] text-stone-500">Candidates see this in their Communities tab.</p>

        <div className="mt-6 space-y-4">
          <AuthField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="e.g. Frontend Developers Pakistan" />
          <div>
            <label htmlFor="cat" className="mb-1.5 block text-[13px] font-medium text-stone-700">Category</label>
            <select id="cat" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="field cursor-pointer">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="desc" className="mb-1.5 block text-[13px] font-medium text-stone-700">Description</label>
            <textarea
              id="desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value.slice(0, 300) }))}
              aria-invalid={errors.description ? "true" : undefined}
              placeholder="What this community is for and who should join."
              className="field !h-auto resize-none py-3 leading-relaxed"
            />
            {errors.description && <p className="mt-1.5 text-[12.5px] text-red-600">{errors.description}</p>}
          </div>
          <AuthField label="Tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} hint="Comma separated, up to six" placeholder="React, Frontend, Pakistan" />
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] p-4">
            <div className="min-w-0 pr-4">
              <p className="text-[14px] font-semibold text-ink">{form.isOpen ? "Open to everyone" : "Private"}</p>
              <p className="mt-0.5 text-[12.5px] text-stone-500">{form.isOpen ? "Candidates join instantly." : "Join requests come to you for approval."}</p>
            </div>
            <Toggle checked={form.isOpen} onChange={(v) => setForm((f) => ({ ...f, isOpen: v }))} label="Open to everyone" />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">{community ? "Save changes" : "Create community"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default function AdminCommunities() {
  const catalogue = useCommunityStore((s) => s.catalogue);
  const { create, update, setStatus } = useCommunityStore();
  const records = useCandidateStore((s) => s.records);
  const { resolveRequest } = useCandidateActions();

  const [tab, setTab] = useState("requests");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dialog, setDialog] = useState(null);

  const requests = useMemo(() => {
    void records;
    void catalogue;
    return joinRequests();
  }, [records, catalogue]);

  const joinedCount = useMemo(() => {
    const counts = {};
    for (const rec of Object.values(records)) {
      for (const [id, m] of Object.entries(rec.memberships || {})) {
        if (m.status === "joined") counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }, [records]);

  const counts = useMemo(
    () => ({
      requests: requests.length,
      active: catalogue.filter((c) => c.status === "active").length,
      paused: catalogue.filter((c) => c.status === "paused").length,
      archived: catalogue.filter((c) => c.status === "archived").length,
      all: catalogue.length,
    }),
    [catalogue, requests.length],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue
      .filter((c) => (tab === "all" ? true : c.status === tab))
      .filter((c) => category === "all" || c.category === category)
      .filter((c) => !q || `${c.name} ${c.description} ${c.tags.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => b.members - a.members);
  }, [catalogue, tab, category, query]);

  const open = catalogue.find((c) => c.id === openId);

  const resolve = (req, approve) => {
    resolveRequest(req.userId, req.communityId, approve ? "joined" : null, req.community.name);
    logAudit({
      action: approve ? "request-approve" : "request-decline",
      targetType: "community",
      targetId: req.communityId,
      targetName: req.community.name,
      detail: `${req.name} (${req.email})`,
    });
    toast({
      type: approve ? "success" : "info",
      title: approve ? `${req.name} joined ${req.community.name}` : "Request declined",
      message: `${req.name} has been notified.`,
    });
  };

  const save = (data) => {
    if (editing?.id) {
      update(editing.id, data);
      logAudit({ action: "update", targetType: "community", targetId: editing.id, targetName: data.name });
      toast({ title: "Community updated", message: `${data.name} is live for candidates.` });
    } else {
      const id = create(data);
      logAudit({ action: "create", targetType: "community", targetId: id, targetName: data.name });
      toast({ title: "Community created", message: `${data.name} now appears in the candidate catalogue.` });
    }
    setEditing(null);
  };

  const changeStatus = (c, status, reason) => {
    setStatus(c.id, status);
    logAudit({ action: status === "archived" ? "archive" : status === "paused" ? "pause" : "restore", targetType: "community", targetId: c.id, targetName: c.name, reason });
    toast({
      type: status === "active" ? "success" : "warning",
      title: `${c.name} ${status === "active" ? "restored" : status}`,
      message:
        status === "archived" ? "It no longer appears for candidates." : status === "paused" ? "It is visible but not accepting new members." : "It is visible and accepting members again.",
    });
    setDialog(null);
    setOpenId(null);
  };

  const exportCsv = () => {
    const headers = ["Community", "Category", "Privacy", "Status", "Seed members", "Joined here", "Open roles", "Created"];
    const data = rows.map((c) => [
      c.name, c.category, c.isOpen ? "Open" : "Private", STATUS[c.status].label,
      c.members, joinedCount[c.id] || 0, c.postedJobs, new Date(c.createdAt).toISOString().slice(0, 10),
    ]);
    const name = `intellihire-communities-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Communities exported", message: `${data.length} communities saved to ${name}.` });
  };

  const columns = [
    {
      key: "name",
      label: "Community",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Logo c={c} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.name}</p>
            <p className="truncate text-[12.5px] text-stone-500">{c.category}</p>
          </div>
        </div>
      ),
    },
    { key: "privacy", label: "Privacy", cell: (c) => <Badge tone="neutral">{c.isOpen ? <><Globe2 size={11} /> Open</> : <><Lock size={11} /> Private</>}</Badge> },
    { key: "members", label: "Members", className: "text-center", cell: (c) => <span className="tabular-nums text-stone-600">{(c.members + (joinedCount[c.id] || 0)).toLocaleString()}</span> },
    { key: "roles", label: "Roles", className: "text-center", cell: (c) => <span className="tabular-nums text-stone-600">{c.postedJobs}</span> },
    { key: "status", label: "Status", cell: (c) => <StatusBadge status={c.status} /> },
  ];

  const card = (c) => (
    <Card interactive className="p-4" onClick={() => setOpenId(c.id)}>
      <div className="flex items-start gap-3">
        <Logo c={c} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{c.name}</p>
          <p className="truncate text-[12.5px] text-stone-500">{c.category}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={c.status} />
            <Badge tone="neutral">{c.isOpen ? "Open" : "Private"}</Badge>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-stone-500">{(c.members + (joinedCount[c.id] || 0)).toLocaleString()} members · {c.postedJobs} roles</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communities"
        title={<>Talent <em>communities</em></>}
        subtitle="The catalogue candidates browse, and the requests waiting on private groups."
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <button type="button" onClick={() => setEditing({})} className="btn-primary">
              <Plus size={16} /> New community
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Globe2} label="Communities" value={counts.all} hint={`${counts.active} active`} />
        <StatTile icon={Users} label="Join requests" value={counts.requests} hint={counts.requests ? "Needs review" : "All clear"} delay={60} />
        <StatTile icon={PauseCircle} label="Paused" value={counts.paused} delay={120} />
        <StatTile icon={Briefcase} label="Roles shared" value={catalogue.reduce((n, c) => n + c.postedJobs, 0)} delay={180} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "requests", label: "Join requests", count: counts.requests, alert: true },
          { value: "active", label: "Active", count: counts.active },
          { value: "paused", label: "Paused", count: counts.paused },
          { value: "archived", label: "Archived", count: counts.archived },
          { value: "all", label: "All", count: counts.all },
        ]}
      />

      {tab === "requests" ? (
        <Reveal>
          {requests.length ? (
            <Card className="p-6">
              <CardHeader icon={Users} title="Waiting for a decision" subtitle="Approving adds the candidate and notifies them" />
              <ul className="mt-5 space-y-3">
                {requests.map((r, i) => (
                  <li
                    key={r.id}
                    className="animate-fade-in-up flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-4 sm:flex-row sm:items-center"
                    style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  >
                    <Logo c={r.community} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">{r.name}</p>
                      <p className="truncate text-[12.5px] text-stone-500">
                        {r.targetRole || "Candidate"} · wants to join <span className="font-medium text-stone-600">{r.community.name}</span> · {relativeTime(r.at)}
                      </p>
                      {r.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.skills.slice(0, 4).map((s) => (
                            <span key={s} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11.5px] font-medium text-stone-600">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => resolve(r, true)} className="btn-primary !h-9 !px-3.5 text-[12.5px]">
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button type="button" onClick={() => resolve(r, false)} className="btn-secondary !h-9 !px-3.5 text-[12.5px] hover:!border-red-300 hover:!text-red-600">
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState icon={CheckCircle2} title="No requests waiting" message="Candidates asking to join a private community will appear here." />
          )}
        </Reveal>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchField value={query} onChange={setQuery} placeholder="Search name, description or tag" className="flex-1" />
            <SelectField label="Category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
          </div>
          <Reveal>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(c) => c.id}
              onRowClick={(c) => setOpenId(c.id)}
              renderCard={card}
              empty={
                <EmptyState
                  icon={SearchX}
                  title="No communities here"
                  message="Try a different tab, category or search."
                  action={
                    <button type="button" onClick={() => { setQuery(""); setCategory("all"); setTab("all"); }} className="btn-secondary">
                      Clear filters
                    </button>
                  }
                />
              }
            />
          </Reveal>
        </>
      )}

      {open && (
        <Drawer
          title={open.name}
          subtitle={open.category}
          accent={<Logo c={open} size={44} />}
          onClose={() => setOpenId(null)}
          footer={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(open)} className="btn-secondary flex-1">Edit</button>
              {open.status === "active" && (
                <button type="button" onClick={() => changeStatus(open, "paused")} className="btn-secondary flex-1">
                  <PauseCircle size={15} /> Pause
                </button>
              )}
              {open.status !== "active" && (
                <button type="button" onClick={() => changeStatus(open, "active")} className="btn-secondary flex-1">
                  <PlayCircle size={15} /> Restore
                </button>
              )}
              {open.status !== "archived" && (
                <button type="button" onClick={() => setDialog({ community: open })} className="btn-dark !bg-red-600 hover:!bg-red-700">
                  <Archive size={15} /> Archive
                </button>
              )}
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={open.status} />
            <Badge tone="neutral">{open.isOpen ? "Open to everyone" : "Private · approval required"}</Badge>
          </div>
          <p className="mb-4 text-[14px] leading-relaxed text-stone-600">{open.description}</p>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[["Members", (open.members + (joinedCount[open.id] || 0)).toLocaleString()], ["Joined here", joinedCount[open.id] || 0], ["Roles", open.postedJobs]].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-[var(--line)] bg-stone-50/60 p-3 text-center">
                <p className="font-display text-[20px] font-medium tabular-nums text-ink">{v}</p>
                <p className="text-[11.5px] text-stone-500">{k}</p>
              </div>
            ))}
          </div>
          <Field label="Tags">
            {open.tags.length ? (
              <span className="flex flex-wrap gap-1.5">
                {open.tags.map((t) => <span key={t} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[12px] font-medium text-stone-600">{t}</span>)}
              </span>
            ) : null}
          </Field>
          <Field label="Created">{formatDate(open.createdAt, { day: "numeric", month: "long", year: "numeric" })}</Field>
        </Drawer>
      )}

      {editing && <EditDialog community={editing.id ? editing : null} onSave={save} onClose={() => setEditing(null)} />}

      {dialog && (
        <ActionDialog
          title={`Archive ${dialog.community.name}?`}
          message="Candidates will no longer see it. Existing members keep their membership, and you can restore it later."
          confirmLabel="Archive community"
          tone="danger"
          requireReason
          onConfirm={(reason) => changeStatus(dialog.community, "archived", reason)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
