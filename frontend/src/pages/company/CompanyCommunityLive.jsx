// Talent communities, company side (Module 12). A list of the company's communities and, for the
// chosen one, its members, join requests, invitations and posts. Reads are open to every company
// user; everything that changes anything is admin and HR manager, matching the server.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArrowLeft, Check, Mail, Plus, RefreshCw, Search, Send, Trash2, Users, X } from "lucide-react";
import { ActionDialog, Drawer, SearchField, Tabs } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Segmented, StatTile } from "@/components/app/primitives";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import {
  CandidateSummary,
  CommunityStatusBadge,
  EligibilityNote,
  ErrorPanel,
  FilterChips,
  InlineError,
  JoinModeBadge,
  Loading,
  PostCard,
} from "@/components/community/communityParts";
import { communitiesApi } from "@/api/communitiesApi";
import { isBlocked } from "@/api/companyApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useOpenJobs } from "@/hooks/useOpenJobs";
import { useRemote } from "@/hooks/useRemote";
import {
  JOIN_MODES,
  LIMITS,
  POST_KINDS,
  SKILL_MODES,
  canManageCommunities,
  communityBody,
  communityError,
  invitationStatusLabel,
  invitationStatusTone,
  postBody,
  postError,
  reasonError,
  requestStatusLabel,
  requestStatusTone,
  sourceLabel,
} from "@/lib/communityMap";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { ROUTES } from "@/config/routes";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

const MEMBER_ORDERINGS = [
  { value: "-joined_at", label: "Newest members" },
  { value: "joined_at", label: "Oldest members" },
  { value: "institution", label: "Institution" },
  { value: "skill_match", label: "Best skill match" },
];
const REQUEST_FILTERS = ["pending", "approved", "rejected", "auto_rejected"];
const emptyFilters = { universities: [], degrees: [], gradYearFrom: "", gradYearTo: "", skills: [], skillMode: "any" };
const emptyForm = { name: "", description: "", mission: "", joinMode: "request", filters: emptyFilters };
const asList = (text) => String(text || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
const asText = (values) => (values || []).join(", ");

export default function CompanyCommunityLive() {
  const user = useAuthStore((state) => state.user);
  const manage = canManageCommunities(user);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useRemote((options) => communitiesApi.list({ pageSize: 100 }, options), [version]);

  if (isBlocked(list.error)) return <CompanyBlocked onRetry={() => setVersion((v) => v + 1)} />;
  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;

  const rows = list.data?.results || [];
  const open = rows.find((row) => row.id === openId) || null;
  const refresh = () => setVersion((v) => v + 1);

  if (creating) {
    return (
      <CommunityForm
        title="New community"
        onCancel={() => setCreating(false)}
        onSave={async (body) => {
          const created = await communitiesApi.create(body);
          toast({ title: "Community created", message: `${created.name} is ready for members.` });
          setCreating(false);
          setOpenId(created.id);
          refresh();
        }}
      />
    );
  }

  if (open) {
    return <CommunityWorkspace community={open} manage={manage} onBack={() => setOpenId("")} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent communities"
        title={<>Your <em>communities</em></>}
        subtitle="Private talent pools you can share internships and roles with."
        actions={
          <>
            <button type="button" onClick={refresh} aria-label="Refresh communities" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500 hover:bg-stone-50"><RefreshCw size={16} /></button>
            {manage && <button type="button" onClick={() => setCreating(true)} className="btn-primary"><Plus size={16} /> New community</button>}
          </>
        }
      />

      {list.status === "loading" && !list.data ? (
        <Loading label="Loading your communities" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No communities yet"
          message={manage ? "Create one to gather a cohort, an alumni group or a skill group, then share roles with just them." : "Nobody has created a community for your company yet."}
          action={manage ? <button type="button" onClick={() => setCreating(true)} className="btn-primary"><Plus size={15} /> New community</button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} interactive className="flex flex-col p-5 text-left">
              <button type="button" onClick={() => setOpenId(row.id)} className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CommunityStatusBadge status={row.status} />
                  <JoinModeBadge joinMode={row.joinMode} />
                </div>
                <h2 className="mt-2 truncate text-[16px] font-semibold text-ink">{row.name}</h2>
                <p className="mt-1 line-clamp-2 text-[13px] text-stone-600">{row.mission}</p>
              </button>
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <FilterChips filters={row.filters} />
                <p className="mt-2 text-[12px] text-stone-500">{row.memberCount} {row.memberCount === 1 ? "member" : "members"} · created {formatDate(row.createdAt)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
    </div>
  );
}

/** Create or edit. Only the fields the server takes, and the same checks it makes. */
function CommunityForm({ title, initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(initial || {}),
    filters: { ...emptyFilters, ...(initial?.filters || {}) },
  }));
  // The three list fields are held as the text the user typed, so a comma is never eaten
  // mid-word; they become lists when the form is saved.
  const [lists, setLists] = useState(() => ({
    universities: asText(initial?.filters?.universities),
    degrees: asText(initial?.filters?.degrees),
    skills: asText(initial?.filters?.skills),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };
  const setFilter = (key) => (value) => { setForm((f) => ({ ...f, filters: { ...f.filters, [key]: value } })); setError(null); };
  const setList = (key) => (text) => { setLists((l) => ({ ...l, [key]: text })); setError(null); };
  const fieldError = (field) => (error?.field === field ? error.message : "");
  const withLists = (values) => ({
    ...values,
    filters: { ...values.filters, universities: asList(lists.universities), degrees: asList(lists.degrees), skills: asList(lists.skills) },
  });

  const save = async () => {
    const values = withLists(form);
    const problem = communityError(values);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSave(communityBody(values));
    } catch (problem2) {
      const field = ["name", "description", "mission"].find((key) => problem2.field?.(key));
      setError({ field: field || "", message: field ? problem2.field(field) : problem2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent communities"
        title={<>{title}</>}
        subtitle="Who it is for decides who may ask to join. Leave a requirement empty to let everyone in."
        actions={<button type="button" onClick={onCancel} className="btn-secondary"><ArrowLeft size={16} /> Back</button>}
      />
      <Card className="max-w-3xl space-y-5 p-6">
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Name
          <input value={form.name} maxLength={LIMITS.name} onChange={(e) => set("name")(e.target.value)} className="field mt-1.5" placeholder="NUST Computer Science 2026" />
          {fieldError("name") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("name")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          What it is for
          <input value={form.mission} maxLength={LIMITS.mission} onChange={(e) => set("mission")(e.target.value)} className="field mt-1.5" placeholder="Internships and graduate roles for this cohort" />
          {fieldError("mission") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("mission")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Description
          <textarea value={form.description} rows={4} maxLength={LIMITS.description} onChange={(e) => set("description")(e.target.value)} className="field mt-1.5 !h-auto py-2.5" placeholder="What members get, and what you will share here." />
          {fieldError("description") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("description")}</p>}
        </label>
        <div>
          <p className="text-[12.5px] font-semibold text-stone-600">How people get in</p>
          <div className="mt-2 space-y-2">
            {JOIN_MODES.map((mode) => (
              <label key={mode.value} className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] p-3 text-[13px]">
                <input type="radio" name="join-mode" value={mode.value} checked={form.joinMode === mode.value} onChange={() => set("joinMode")(mode.value)} className="mt-0.5" />
                <span className="text-stone-700">{mode.label}</span>
              </label>
            ))}
          </div>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-[var(--line)] p-4">
          <legend className="px-1 text-[12.5px] font-semibold text-stone-600">Who may join (leave empty for no requirement)</legend>
          <label className="block text-[12px] font-semibold text-stone-600">
            Institutions, comma separated
            <input value={lists.universities} onChange={(e) => setList("universities")(e.target.value)} className="field mt-1.5" placeholder="NUST, FAST" />
          </label>
          <label className="block text-[12px] font-semibold text-stone-600">
            Degrees or fields, comma separated
            <input value={lists.degrees} onChange={(e) => setList("degrees")(e.target.value)} className="field mt-1.5" placeholder="Computer Science, Software Engineering" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="text-[12px] font-semibold text-stone-600">
              Graduating from
              <input type="number" min="1950" max="2100" value={form.filters.gradYearFrom ?? ""} onChange={(e) => setFilter("gradYearFrom")(e.target.value)} className="field mt-1.5 w-28" />
            </label>
            <label className="text-[12px] font-semibold text-stone-600">
              to
              <input type="number" min="1950" max="2100" value={form.filters.gradYearTo ?? ""} onChange={(e) => setFilter("gradYearTo")(e.target.value)} className="field mt-1.5 w-28" />
            </label>
          </div>
          {fieldError("gradYearFrom") && <p role="alert" className="text-[12px] text-red-700">{fieldError("gradYearFrom")}</p>}
          <label className="block text-[12px] font-semibold text-stone-600">
            Skills, comma separated
            <input value={lists.skills} onChange={(e) => setList("skills")(e.target.value)} className="field mt-1.5" placeholder="Python, Django" />
          </label>
          <div>
            <p className="text-[12px] font-semibold text-stone-600">Skill match</p>
            <Segmented ariaLabel="Skill match" className="mt-1.5" value={form.filters.skillMode} onChange={setFilter("skillMode")} options={SKILL_MODES} />
          </div>
        </fieldset>

        {error && !error.field && <p role="alert" className="text-[12.5px] text-red-700">{error.message}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-50"><Check size={16} /> Save</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </Card>
    </div>
  );
}

function CommunityWorkspace({ community, manage, onBack, onChanged }) {
  const [tab, setTab] = useState("members");
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (run, message) => {
    setBusy(true);
    setError("");
    try {
      await run();
      toast({ title: message });
      setDialog("");
      onChanged();
      if (dialog === "remove") onBack();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <CommunityForm
        title={`Edit ${community.name}`}
        initial={community}
        onCancel={() => setEditing(false)}
        onSave={async (body) => {
          await communitiesApi.update(community.id, body);
          toast({ title: "Community saved", message: "Existing members keep their place whatever the new requirements say." });
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent communities"
        title={<>{community.name}</>}
        subtitle={community.mission}
        actions={
          <>
            <button type="button" onClick={onBack} className="btn-secondary"><ArrowLeft size={16} /> All communities</button>
            {manage && community.status === "active" && <button type="button" onClick={() => setEditing(true)} className="btn-secondary">Edit</button>}
            {manage && community.status === "active" && <button type="button" onClick={() => setDialog("archive")} className="btn-secondary"><Archive size={15} /> Archive</button>}
            {manage && <button type="button" onClick={() => setDialog("remove")} aria-label="Remove community" className="icon-btn flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Members" value={community.memberCount} />
        <StatTile icon={Mail} label="How people join" value={community.joinMode === "invite_only" ? "Invite only" : "By request"} />
        <StatTile icon={Check} label="Status" value={community.status === "active" ? "Active" : community.status === "archived" ? "Archived" : "Removed"} />
        <StatTile icon={Users} label="Created" value={formatDate(community.createdAt)} />
      </div>

      <Card className="p-5">
        <CardHeader title="Who may join" subtitle="Existing members are never removed when these change." />
        <FilterChips filters={community.filters} className="mt-3" />
        {community.description && <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-stone-600">{community.description}</p>}
        {community.status === "archived" && <p className="mt-3 text-[12.5px] text-amber-800">Archived: hidden from discovery and closed to new joins. Members and posts stay readable.</p>}
      </Card>

      {error && <InlineError message={error} />}

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "members", label: "Members" },
          ...(manage ? [{ value: "requests", label: "Requests" }, { value: "invitations", label: "Invitations" }] : []),
          { value: "posts", label: "Posts" },
        ]}
      />

      {tab === "members" && <MembersTab community={community} manage={manage} onChanged={onChanged} />}
      {tab === "requests" && manage && <RequestsTab community={community} onChanged={onChanged} />}
      {tab === "invitations" && manage && <InvitationsTab community={community} />}
      {tab === "posts" && <PostsTab community={community} manage={manage} />}

      {dialog === "archive" && (
        <ActionDialog
          title={`Archive ${community.name}?`}
          message="It disappears from discovery and takes no new members. Members and posts stay readable, and you can still remove it later."
          confirmLabel="Archive"
          busy={busy}
          onConfirm={() => act(() => communitiesApi.archive(community.id), "Community archived")}
          onClose={() => !busy && setDialog("")}
        />
      )}
      {dialog === "remove" && (
        <ActionDialog
          title={`Remove ${community.name}?`}
          message="Members are emailed once and nobody can open the posts again. Nothing is deleted, so the history stays. Give a reason."
          confirmLabel="Remove"
          tone="danger"
          requireReason
          busy={busy}
          onConfirm={(reason) => {
            const problem = reasonError(reason);
            if (problem) return setError(problem);
            return act(() => communitiesApi.remove(community.id, reason), "Community removed");
          }}
          onClose={() => !busy && setDialog("")}
        />
      )}
    </div>
  );
}

function MembersTab({ community, manage, onChanged }) {
  const [query, setQuery] = useState("");
  const [ordering, setOrdering] = useState("-joined_at");
  const [version, setVersion] = useState(0);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const search = useDebounced(query);
  const members = useRemote((o) => communitiesApi.members(community.id, { q: search, ordering, pageSize: 50 }, o), [community.id, search, ordering, version]);
  const rows = members.data?.results || [];

  const remove = async (reason) => {
    const problem = reasonError(reason);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await communitiesApi.removeMember(community.id, removing.id, reason);
      toast({ title: "Member removed", message: `${removing.name} was told and can no longer see the posts.` });
      setRemoving(null);
      setVersion((v) => v + 1);
      onChanged();
    } catch (problem2) {
      setError(problem2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchField value={query} onChange={setQuery} placeholder="Search members by name" className="flex-1" />
        <label>
          <span className="sr-only">Order members by</span>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
            {MEMBER_ORDERINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {error && <InlineError message={error} />}
      {members.status === "loading" && !members.data ? (
        <Loading label="Loading members" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" message={community.joinMode === "invite_only" ? "Invite candidates from the Invitations tab." : "Eligible candidates can ask to join, and their requests appear under Requests."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((member) => (
            <Card key={member.id} className="flex items-start gap-3 p-4">
              <Avatar name={member.name} size={38} />
              <CandidateSummary
                candidate={member}
                extra={
                  <p className="mt-1.5 text-[11.5px] text-stone-400">
                    {sourceLabel(member.source)} · joined {relativeTime(member.joinedAt)}
                    {community.filters.skills.length > 0 && ` · ${member.skillMatch} of ${community.filters.skills.length} skills`}
                  </p>
                }
              />
              {manage && (
                <button type="button" onClick={() => { setError(""); setRemoving(member); }} aria-label={`Remove ${member.name}`} className="icon-btn ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-red-600 hover:bg-red-50"><X size={14} /></button>
              )}
            </Card>
          ))}
        </div>
      )}
      {members.status === "error" && <InlineError message={members.error.message} onRetry={members.reload} />}
      {removing && (
        <ActionDialog
          title={`Remove ${removing.name}?`}
          message="They are told, and they stop seeing this community's posts. Give a reason."
          confirmLabel="Remove"
          tone="danger"
          requireReason
          busy={busy}
          onConfirm={remove}
          onClose={() => !busy && setRemoving(null)}
        />
      )}
    </div>
  );
}

function RequestsTab({ community, onChanged }) {
  const [status, setStatus] = useState("pending");
  const [version, setVersion] = useState(0);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const requests = useRemote((o) => communitiesApi.joinRequests(community.id, { status, pageSize: 50 }, o), [community.id, status, version]);
  const rows = requests.data?.results || [];

  const approve = async (row) => {
    setBusy(row.id);
    setError("");
    try {
      await communitiesApi.approveRequest(community.id, row.id);
      toast({ title: "Request approved", message: `${row.candidate?.name} is a member now and has been told.` });
      setVersion((v) => v + 1);
      onChanged();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  const reject = async (reason) => {
    const problem = reasonError(reason);
    if (problem) return setError(problem);
    setBusy(rejecting.id);
    setError("");
    try {
      await communitiesApi.rejectRequest(community.id, rejecting.id, reason);
      toast({ title: "Request rejected", message: "The candidate was told." });
      setRejecting(null);
      setVersion((v) => v + 1);
    } catch (problem2) {
      setError(problem2.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <label>
        <span className="sr-only">Request status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          {REQUEST_FILTERS.map((value) => <option key={value} value={value}>{requestStatusLabel(value)}</option>)}
        </select>
      </label>
      {error && <InlineError message={error} />}
      {requests.status === "loading" && !requests.data ? (
        <Loading label="Loading requests" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={status === "pending" ? "No requests waiting" : "Nothing here"} message={status === "pending" ? "Eligible candidates who ask to join appear here." : "No request has this status."} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={row.candidate?.name || ""} size={38} />
                <CandidateSummary candidate={row.candidate} />
                <div className="ml-auto flex flex-col items-end gap-2">
                  <Badge tone={requestStatusTone(row.status)}>{requestStatusLabel(row.status)}</Badge>
                  <span className="text-[11.5px] text-stone-400">{relativeTime(row.createdAt)}</span>
                </div>
              </div>
              {row.message && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-600">{row.message}</p>}
              <EligibilityNote eligible={row.eligible} reasons={row.reasons} className="mt-3" />
              {row.decisionReason && <p className="mt-2 text-[12.5px] text-stone-500">Reason given: {row.decisionReason}</p>}
              {row.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === row.id} onClick={() => approve(row)} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50"><Check size={14} /> Approve</button>
                  <button type="button" disabled={busy === row.id} onClick={() => { setError(""); setRejecting(row); }} className="btn-secondary !h-9 text-[12.5px] disabled:opacity-50">Reject</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {requests.status === "error" && <InlineError message={requests.error.message} onRetry={requests.reload} />}
      {rejecting && (
        <ActionDialog
          title="Reject this request?"
          message="The candidate is told. A reason is required."
          confirmLabel="Reject"
          tone="danger"
          requireReason
          busy={Boolean(busy)}
          onConfirm={reject}
          onClose={() => !busy && setRejecting(null)}
        />
      )}
    </div>
  );
}

function InvitationsTab({ community }) {
  const [version, setVersion] = useState(0);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const invitations = useRemote((o) => communitiesApi.invitations(community.id, { pageSize: 50 }, o), [community.id, version]);
  const rows = invitations.data?.results || [];

  const revoke = async (row) => {
    setBusy(row.id);
    setError("");
    try {
      await communitiesApi.revokeInvitation(community.id, row.id);
      toast({ title: "Invitation withdrawn" });
      setVersion((v) => v + 1);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end">
        <button type="button" onClick={() => setFinding(true)} className="btn-primary"><Search size={15} /> Find candidates</button>
      </div>
      {error && <InlineError message={error} />}
      {invitations.status === "loading" && !invitations.data ? (
        <Loading label="Loading invitations" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Mail} title="No invitations yet" message="Search candidates who allow companies to find them, and invite the ones you want." action={<button type="button" onClick={() => setFinding(true)} className="btn-secondary"><Search size={15} /> Find candidates</button>} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={row.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{row.name}</p>
                <p className="truncate text-[11.5px] text-stone-500">
                  Sent {relativeTime(row.createdAt)}
                  {row.status === "pending" && row.expiresAt ? ` · expires ${formatDate(row.expiresAt)}` : ""}
                </p>
                {row.message && <p className="mt-1 truncate text-[12px] text-stone-500">“{row.message}”</p>}
              </div>
              <Badge tone={invitationStatusTone(row.status)}>{invitationStatusLabel(row.status)}</Badge>
              {row.status === "pending" && (
                <button type="button" disabled={busy === row.id} onClick={() => revoke(row)} className="btn-secondary !h-8 !px-3 text-[12px] disabled:opacity-50">Withdraw</button>
              )}
            </Card>
          ))}
        </div>
      )}
      {invitations.status === "error" && <InlineError message={invitations.error.message} onRetry={invitations.reload} />}
      {finding && <CandidateFinder community={community} onClose={() => setFinding(false)} onInvited={() => { setVersion((v) => v + 1); }} />}
    </div>
  );
}

/**
 * Candidate search for invitations. The server only returns candidates who allow companies to
 * find them and whose email is verified, and it never sends an email address, a phone number or a CV.
 */
function CandidateFinder({ community, onClose, onInvited }) {
  const [query, setQuery] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [inviting, setInviting] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const search = useDebounced(query);
  const results = useRemote((o) => communitiesApi.searchCandidates(community.id, { q: search, eligibleOnly }, o), [community.id, search, eligibleOnly]);
  const rows = results.data || [];

  const invite = async (row) => {
    setInviting(row.id);
    setError("");
    try {
      const created = await communitiesApi.invite(community.id, row.id, message);
      const warn = created.eligibility && created.eligibility.eligible === false;
      toast({
        type: warn ? "warning" : "success",
        title: `${row.full_name || row.name || "Candidate"} invited`,
        message: warn ? "They do not meet the requirements, but you chose them, so the invitation stands." : "They were emailed and will see it in the app.",
      });
      setMessage("");
      onInvited();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setInviting("");
    }
  };

  return (
    <Drawer title="Find candidates" subtitle={`Invite people to ${community.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-xl bg-stone-50 p-3 text-[12px] leading-relaxed text-stone-500">
          Only candidates who turned on “let companies find me” and verified their email appear here. Their contact details and CV are never shown.
        </p>
        <SearchField value={query} onChange={setQuery} placeholder="Name, headline, institution, degree or skill" />
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-stone-700">
          <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Show only those who meet the requirements
        </label>
        <label className="block text-[12px] font-semibold text-stone-600">
          Message with the invitation (optional)
          <input value={message} maxLength={LIMITS.message} onChange={(e) => setMessage(e.target.value)} className="field mt-1.5" placeholder="We thought this group would suit you." />
        </label>
        {error && <InlineError message={error} />}
        {results.status === "loading" && !results.data ? (
          <Loading label="Searching" />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-5 text-center text-[13px] text-stone-500">
            {search ? "Nobody matches that search." : "No discoverable candidates yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const candidate = { name: row.full_name, headline: row.headline, institution: row.institution, degree: row.degree, skills: row.skills || [] };
              return (
                <Card key={row.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={candidate.name} size={34} />
                    <CandidateSummary candidate={candidate} />
                    <button type="button" disabled={inviting === row.id} onClick={() => invite(row)} className="btn-secondary ml-auto !h-8 !px-3 text-[12px] disabled:opacity-50"><Send size={13} /> Invite</button>
                  </div>
                  {!row.eligible && <EligibilityNote eligible={false} reasons={row.reasons} className="mt-2" />}
                </Card>
              );
            })}
          </div>
        )}
        {results.status === "error" && <InlineError message={results.error.message} onRetry={results.reload} />}
      </div>
    </Drawer>
  );
}

function PostsTab({ community, manage }) {
  const [version, setVersion] = useState(0);
  const [writing, setWriting] = useState(false);
  const [responsesOf, setResponsesOf] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const posts = useRemote((o) => communitiesApi.posts(community.id, { pageSize: 50 }, o), [community.id, version]);
  const rows = posts.data?.results || [];

  const remove = async (post) => {
    setBusy(post.id);
    setError("");
    try {
      await communitiesApi.deletePost(community.id, post.id);
      toast({ title: "Post removed" });
      setVersion((v) => v + 1);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      {manage && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setWriting(true)} className="btn-primary"><Plus size={15} /> New post</button>
        </div>
      )}
      {error && <InlineError message={error} />}
      {posts.status === "loading" && !posts.data ? (
        <Loading label="Loading posts" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Send} title="Nothing posted yet" message={manage ? "Share an internship, a role, an event or an announcement with these members only." : "Nothing has been shared with this community yet."} />
      ) : (
        <div className="space-y-3">
          {rows.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              actions={
                manage && (
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setResponsesOf(post)} className="btn-secondary !h-8 !px-3 text-[12px]">
                      {post.responses ?? 0} interested
                    </button>
                    <button type="button" disabled={busy === post.id} onClick={() => remove(post)} aria-label={`Remove ${post.title}`} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                )
              }
              footer={<p className="mt-3 text-[11.5px] text-stone-400">Posted {relativeTime(post.createdAt)}{post.closesAt ? ` · closes ${formatDate(post.closesAt)}` : ""}</p>}
            />
          ))}
        </div>
      )}
      {posts.status === "error" && <InlineError message={posts.error.message} onRetry={posts.reload} />}
      {writing && <PostForm community={community} onClose={() => setWriting(false)} onSaved={() => { setWriting(false); setVersion((v) => v + 1); }} />}
      {responsesOf && <ResponsesDrawer community={community} post={responsesOf} onClose={() => setResponsesOf(null)} />}
    </div>
  );
}

function PostForm({ community, onClose, onSaved }) {
  const { jobs } = useOpenJobs();
  const [form, setForm] = useState({ kind: "job", title: "", body: "", jobId: "", applyUrl: "", closesAt: "", notifyMembers: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };
  const fieldError = (field) => (error?.field === field ? error.message : "");

  const save = async () => {
    const problem = postError(form);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await communitiesApi.createPost(community.id, postBody(form));
      toast({
        title: "Posted",
        message: form.notifyMembers ? "Members are being notified in batches." : "Only members of this community can see it.",
      });
      onSaved();
    } catch (problem2) {
      const field = ["kind", "title", "body", "job", "apply_url", "closes_at"].find((key) => problem2.field?.(key));
      setError({ field: field === "apply_url" ? "applyUrl" : field === "closes_at" ? "closesAt" : field || "", message: field ? problem2.field(field) : problem2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title="New post" subtitle={`Visible only to members of ${community.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-[12.5px] font-semibold text-stone-600">What is this</p>
          <Segmented ariaLabel="Post kind" className="mt-1.5 w-full" value={form.kind} onChange={set("kind")} options={POST_KINDS} />
          {fieldError("kind") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("kind")}</p>}
        </div>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Title
          <input value={form.title} maxLength={LIMITS.postTitle} onChange={(e) => set("title")(e.target.value)} className="field mt-1.5" />
          {fieldError("title") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("title")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Body
          <textarea value={form.body} rows={6} maxLength={LIMITS.postBody} onChange={(e) => set("body")(e.target.value)} className="field mt-1.5 !h-auto py-2.5" />
          {fieldError("body") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("body")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Link one of your published roles (optional)
          <select value={form.jobId} onChange={(e) => set("jobId")(e.target.value)} className="field mt-1.5">
            <option value="">No role</option>
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
          {fieldError("job") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("job")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Or an external link (optional)
          <input value={form.applyUrl} maxLength={LIMITS.applyUrl} onChange={(e) => set("applyUrl")(e.target.value)} className="field mt-1.5" placeholder="https://" />
          {fieldError("applyUrl") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("applyUrl")}</p>}
        </label>
        <label className="block text-[12.5px] font-semibold text-stone-600">
          Closes on (optional)
          <input type="date" value={form.closesAt} onChange={(e) => set("closesAt")(e.target.value)} className="field mt-1.5" />
          {fieldError("closesAt") && <p role="alert" className="mt-1 text-[12px] text-red-700">{fieldError("closesAt")}</p>}
        </label>
        <label className="flex items-start gap-2 text-[12.5px] font-medium text-stone-700">
          <input type="checkbox" checked={form.notifyMembers} onChange={(e) => set("notifyMembers")(e.target.checked)} className="mt-0.5" />
          <span>Notify every member — in the app and by email, sent in batches of 50.</span>
        </label>
        {error && !error.field && <p role="alert" className="text-[12.5px] text-red-700">{error.message}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-50"><Send size={15} /> Post</button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Drawer>
  );
}

function ResponsesDrawer({ community, post, onClose }) {
  const responses = useRemote((o) => communitiesApi.postResponses(community.id, post.id, { pageSize: 50 }, o), [community.id, post.id]);
  const rows = responses.data?.results || [];
  return (
    <Drawer title="Interested members" subtitle={post.title} onClose={onClose}>
      {responses.status === "loading" && !responses.data ? (
        <Loading label="Loading responses" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-5 text-center text-[13px] text-stone-500">Nobody has shown interest yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <Card key={`${row.candidate.id}-${index}`} className="p-3">
              <div className="flex items-start gap-3">
                <Avatar name={row.candidate.name} size={34} />
                <CandidateSummary candidate={row.candidate} />
              </div>
              {row.message && <p className="mt-2 rounded-lg bg-stone-50 p-2.5 text-[12.5px] text-stone-600">{row.message}</p>}
              <p className="mt-1.5 text-[11.5px] text-stone-400">{relativeTime(row.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}
      {responses.status === "error" && <InlineError message={responses.error.message} onRetry={responses.reload} />}
      <p className="mt-4 border-t border-[var(--line)] pt-3 text-[11.5px] text-stone-500">
        <Link to={ROUTES.COMPANY.CANDIDATES} className="font-semibold text-brand hover:underline">Your applicants</Link> are separate: showing interest here is not an application.
      </p>
    </Drawer>
  );
}
