// Content monitor (Module 13, FR-74): every company's jobs and communities, read-only, with
// "flag for review" from a detail. A platform admin never edits a company's content here.
import { useState } from "react";
import { Briefcase, ChevronLeft, ChevronRight, Globe2, RefreshCw, SearchX } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { Drawer, SearchField, Tabs } from "@/components/admin/primitives";
import { ErrorPanel, FlagForReviewButton, InlineError, Loading, OpenFlags } from "@/components/admin/platformParts";
import { platformAdminApi } from "@/api/platformAdminApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { REASON_MAX, reasonError } from "@/lib/platformMap";
import { communityStatusLabel, communityStatusTone, joinModeShort, postKindLabel } from "@/lib/communityMap";
import { JOB_STATUS } from "@/lib/jobMap";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const PAGE_SIZE = 20;
const JOB_FILTERS = [["", "Any status"], ["draft", "Draft"], ["open", "Open"], ["closed", "Closed"]];
const COMMUNITY_FILTERS = [["", "Any status"], ["active", "Active"], ["archived", "Archived"], ["removed", "Removed"]];

export default function AdminCommunitiesLive() {
  const [tab, setTab] = useState("jobs");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title={<>Content <em>monitor</em></>}
        subtitle="Jobs and communities across every company. Read-only: flag anything that needs a decision."
      />
      <Tabs value={tab} onChange={setTab} options={[{ value: "jobs", label: "Jobs" }, { value: "communities", label: "Communities" }]} />
      {tab === "jobs" ? <JobsMonitor /> : <CommunitiesMonitor />}
    </div>
  );
}

function JobsMonitor() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState("");
  const search = useDebounced(query);
  const list = useRemote((o) => platformAdminApi.jobs({ q: search, status, createdFrom: from, createdTo: to, page, pageSize: PAGE_SIZE }, o), [search, status, from, to, page, version]);
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;
  const rows = list.data?.results || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Jobs matching" value={list.data?.count ?? "—"} />
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <SearchField value={query} onChange={reset(setQuery)} placeholder="Search by title" className="flex-1" />
        <select aria-label="Job status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          {JOB_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">Created from <input type="date" aria-label="Created from" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-stone-500">to <input type="date" aria-label="Created to" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px]" /></label>
        <button type="button" onClick={() => setVersion((v) => v + 1)} aria-label="Refresh jobs" className="icon-btn flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500"><RefreshCw size={16} /></button>
      </div>

      {list.status === "loading" && !list.data ? (
        <Loading label="Loading jobs" />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No jobs match" message="Change the filters, or no company has posted one yet." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                <tr><th className="px-4 py-3">Role</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Applications</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((job) => (
                  <tr key={job.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{job.title}</p>
                      <p className="text-[11.5px] text-stone-500">{job.department || "No department"}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{job.company?.name}</td>
                    <td className="px-4 py-3"><Badge tone={JOB_STATUS[job.status]?.tone || "neutral"}>{JOB_STATUS[job.status]?.label || job.status}</Badge></td>
                    <td className="px-4 py-3 tabular-nums text-stone-600">{job.applications ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => setOpenId(job.id)} className="btn-secondary !h-8 !px-2.5 text-[11.5px]">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} data={list.data} />
        </Card>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
      {openId && <JobDrawer jobId={openId} onClose={() => setOpenId("")} onFlagged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

function JobDrawer({ jobId, onClose, onFlagged }) {
  const detail = useRemote((o) => platformAdminApi.job(jobId, o), [jobId]);
  const job = detail.data;
  return (
    <Drawer title={job?.title || "Job"} subtitle={job?.company?.name} onClose={onClose}>
      {detail.status === "loading" && !job ? <Loading label="Loading the job" /> : detail.status === "error" ? <InlineError message={detail.error.message} onRetry={detail.reload} /> : job ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={JOB_STATUS[job.status]?.tone || "neutral"}>{JOB_STATUS[job.status]?.label || job.status}</Badge>
            {job.employment_type && <Badge tone="neutral">{job.employment_type.replaceAll("_", " ")}</Badge>}
            {job.work_mode && <Badge tone="neutral">{job.work_mode}</Badge>}
          </div>
          <dl className="divide-y divide-[var(--line)] text-[13px]">
            {[
              ["Location", job.location || "—"],
              ["Openings", job.openings ?? "—"],
              ["Deadline", job.deadline ? formatDate(job.deadline) : "none"],
              ["Published", job.published_at ? formatDate(job.published_at) : "not published"],
              ["Created by", job.created_by || "—"],
            ].map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{key}</dt><dd className="font-medium text-ink">{value}</dd></div>
            ))}
          </dl>
          {job.required_skills?.length > 0 && (
            <section>
              <h3 className="text-[12.5px] font-semibold text-ink">Required skills</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">{job.required_skills.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}</div>
            </section>
          )}
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Applications by status</h3>
            {Object.keys(job.applications_by_status || {}).length === 0 ? (
              <p className="mt-1.5 text-[12.5px] text-stone-500">No applications yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(job.applications_by_status).map(([key, value]) => <Badge key={key} tone="neutral">{key.replaceAll("_", " ")}: {value}</Badge>)}
              </div>
            )}
          </section>
          {job.description && <section><h3 className="text-[12.5px] font-semibold text-ink">Description</h3><p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-stone-600">{job.description}</p></section>}
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Open flags</h3>
            <div className="mt-2"><OpenFlags flags={job.open_flags} /></div>
          </section>
          <FlagTarget targetType="job" targetId={job.id} onFlagged={onFlagged} />
        </div>
      ) : null}
    </Drawer>
  );
}

function CommunitiesMonitor() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState("");
  const search = useDebounced(query);
  const list = useRemote((o) => platformAdminApi.communities({ q: search, status, page, pageSize: PAGE_SIZE }, o), [search, status, page, version]);
  const reset = (setter) => (value) => { setter(value); setPage(1); };

  if (list.status === "error" && !list.data) return <ErrorPanel message={list.error.message} onRetry={list.reload} />;
  const rows = list.data?.results || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Globe2} label="Communities matching" value={list.data?.count ?? "—"} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchField value={query} onChange={reset(setQuery)} placeholder="Search by name" className="flex-1" />
        <select aria-label="Community status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className="h-11 cursor-pointer rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          {COMMUNITY_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={() => setVersion((v) => v + 1)} aria-label="Refresh communities" className="icon-btn flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] text-stone-500"><RefreshCw size={16} /></button>
      </div>

      {list.status === "loading" && !list.data ? (
        <Loading label="Loading communities" />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No communities match" message="Change the filters, or no company has created one yet." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-[13px]">
              <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                <tr><th className="px-4 py-3">Community</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((community) => (
                  <tr key={community.id} className="transition-colors hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{community.name}</p>
                      <p className="text-[11.5px] text-stone-500">{joinModeShort(community.join_mode)}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{community.company?.name}</td>
                    <td className="px-4 py-3"><Badge tone={communityStatusTone(community.status)}>{communityStatusLabel(community.status)}</Badge></td>
                    <td className="px-4 py-3 tabular-nums text-stone-600">{community.member_count ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(community.created_at)}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => setOpenId(community.id)} className="btn-secondary !h-8 !px-2.5 text-[11.5px]">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} data={list.data} />
        </Card>
      )}
      {list.status === "error" && <InlineError message={list.error.message} onRetry={list.reload} />}
      {openId && <CommunityDrawer communityId={openId} onClose={() => setOpenId("")} onFlagged={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

function CommunityDrawer({ communityId, onClose, onFlagged }) {
  const detail = useRemote((o) => platformAdminApi.community(communityId, o), [communityId]);
  const c = detail.data;
  return (
    <Drawer title={c?.name || "Community"} subtitle={c?.company?.name} onClose={onClose}>
      {detail.status === "loading" && !c ? <Loading label="Loading the community" /> : detail.status === "error" ? <InlineError message={detail.error.message} onRetry={detail.reload} /> : c ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={communityStatusTone(c.status)}>{communityStatusLabel(c.status)}</Badge>
            <Badge tone="neutral">{joinModeShort(c.join_mode)}</Badge>
          </div>
          <p className="text-[13px] text-stone-600">{c.mission}</p>
          {c.description && <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-stone-600">{c.description}</p>}
          <dl className="divide-y divide-[var(--line)] text-[13px]">
            {[["Active members", c.members_active ?? 0], ["Cached count", c.member_count ?? 0], ["Posts", c.posts_total ?? 0], ["Created", formatDate(c.created_at)]].map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 py-2"><dt className="text-stone-500">{key}</dt><dd className="font-medium tabular-nums text-ink">{value}</dd></div>
            ))}
          </dl>
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Recent posts</h3>
            {(c.recent_posts || []).length === 0 ? (
              <p className="mt-1.5 text-[12.5px] text-stone-500">Nothing posted yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {c.recent_posts.map((post) => (
                  <li key={post.id} className="rounded-lg border border-[var(--line)] px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="brand">{postKindLabel(post.kind)}</Badge>
                      {post.status === "archived" && <Badge tone="neutral">Archived</Badge>}
                      <span className="text-[11px] text-stone-400">{relativeTime(post.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-stone-700">{post.title}</p>
                    <div className="mt-1.5"><FlagTarget targetType="community_post" targetId={post.id} onFlagged={onFlagged} compact /></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink">Open flags</h3>
            <div className="mt-2"><OpenFlags flags={c.open_flags} /></div>
          </section>
          <FlagTarget targetType="community" targetId={c.id} onFlagged={onFlagged} />
        </div>
      ) : null}
    </Drawer>
  );
}

/** Raise a flag against whatever is open. The flag's source is `admin`. */
function FlagTarget({ targetType, targetId, onFlagged, compact = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const problem = reasonError(reason);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await platformAdminApi.flag(targetType, targetId, reason.trim());
      toast({ title: "Flagged for review", message: "It is in the moderation queue now." });
      setOpen(false);
      setReason("");
      onFlagged();
    } catch (problem2) {
      setError(problem2.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return compact
      ? <button type="button" onClick={() => setOpen(true)} className="text-[11.5px] font-semibold text-brand hover:underline">Flag this post</button>
      : <FlagForReviewButton onClick={() => setOpen(true)} />;
  }

  return (
    <div className="rounded-xl border border-[var(--line)] p-3">
      <label className="block text-[12px] font-semibold text-stone-600">
        Why does this need review?
        <textarea value={reason} rows={3} maxLength={REASON_MAX} onChange={(e) => { setReason(e.target.value); setError(""); }} className="field mt-1.5 !h-auto py-2.5" autoFocus />
      </label>
      {error && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={send} disabled={busy} className="btn-primary !h-9 text-[12.5px] disabled:opacity-50">Raise flag</button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="btn-secondary !h-9 text-[12.5px]">Cancel</button>
      </div>
    </div>
  );
}

function Pager({ page, setPage, data }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-stone-500">
      <span>{data.count} in total</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Previous page" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button>
        <span>Page {page}</span>
        <button type="button" aria-label="Next page" onClick={() => setPage((v) => v + 1)} disabled={!data.hasNext} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
