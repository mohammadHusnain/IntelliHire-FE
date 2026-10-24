import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase, Check, Copy, Eye, MapPin, Plus, SearchX, Share2, Trash2, Users,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { ActionDialog, SearchField, SelectField, Tabs } from "@/components/admin/primitives";
import Reveal from "@/components/shared/Reveal";
import { companyStats, useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { relativeTime } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const STATUS_TONE = { Open: "success", Draft: "neutral", Closed: "danger" };

const applyLink = (job) => `${window.location.origin}/apply/${job.id}`;

export default function CompanyJobs() {
  const navigate = useNavigate();
  const record = useCompanyRecord();
  const { setJobStatus, deleteJob, saveJob } = useCompanyActions();
  const stats = useMemo(() => companyStats(record), [record]);
  const [tab, setTab] = useState("Open");
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [confirm, setConfirm] = useState(null);
  const [copied, setCopied] = useState(null);

  const counts = useMemo(
    () => ({
      Open: stats.openJobs,
      Draft: stats.drafts,
      Closed: stats.closed,
      all: stats.jobs,
    }),
    [stats],
  );

  const departments = useMemo(() => [...new Set(record.jobs.map((j) => j.department).filter(Boolean))].sort(), [record.jobs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return record.jobs
      .filter((j) => (tab === "all" ? true : j.status === tab))
      .filter((j) => dept === "all" || j.department === dept)
      .filter((j) => !q || `${j.title} ${j.location} ${(j.skills || []).join(" ")}`.toLowerCase().includes(q))
      .map((j) => ({ ...j, count: record.applicants.filter((a) => a.jobId === j.id).length, needsReview: record.applicants.filter((a) => a.jobId === j.id && a.stage === "Applied").length }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [record, tab, dept, query]);

  const copyLink = async (job) => {
    try {
      await navigator.clipboard.writeText(applyLink(job));
      setCopied(job.id);
      setTimeout(() => setCopied(null), 1800);
      toast({ title: "Link copied", message: `Share it to collect applications for ${job.title}.` });
    } catch {
      toast({ type: "error", title: "Could not copy", message: "Copy the link from the role preview instead." });
    }
  };

  const duplicate = (job) => {
    const { id, createdAt, ...rest } = job;
    void id;
    void createdAt;
    const copy = saveJob({ ...rest, title: `${job.title} (copy)`, status: "Draft" });
    toast({ title: "Role duplicated", message: `${copy.title} saved as a draft.` });
    navigate(`/company/jobs/${copy.id}/edit`);
  };

  const remove = () => {
    deleteJob(confirm.id);
    toast({ type: "warning", title: "Role deleted", message: `${confirm.title} and its applicants were removed.` });
    setConfirm(null);
  };

  if (!record.jobs.length) {
    return (
      <div>
        <PageHeader eyebrow="Roles" title={<>Your <em>open roles</em></>} subtitle="Every role you post gets its own application link and pipeline." />
        <EmptyState
          icon={Briefcase}
          title="No roles yet"
          message="Post your first role to start collecting applications. You can save it as a draft first."
          action={<Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary"><Plus size={16} /> Post a role</Link>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roles"
        title={<>Your <em>open roles</em></>}
        subtitle={`${stats.openJobs} open · ${stats.applicants} applicants in total`}
        actions={
          <Link to={ROUTES.COMPANY.JOB_CREATE} className="btn-primary">
            <Plus size={16} /> Post a role
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Open" value={stats.openJobs} />
        <StatTile icon={Users} label="Applicants" value={stats.applicants} delay={60} />
        <StatTile icon={Eye} label="Awaiting review" value={stats.needsReview} delay={120} />
        <StatTile icon={Check} label="Shortlisted" value={stats.shortlisted} delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "Open", label: "Open", count: counts.Open },
            { value: "Draft", label: "Drafts", count: counts.Draft },
            { value: "Closed", label: "Closed", count: counts.Closed },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Search title, location or skill" className="flex-1" />
        <SelectField label="Department" value={dept} onChange={setDept} options={[{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No roles match"
          message="Try a different tab, department or search."
          action={<button type="button" onClick={() => { setQuery(""); setDept("all"); setTab("all"); }} className="btn-secondary">Clear filters</button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((j, i) => (
            <Reveal key={j.id} delay={Math.min(i, 8) * 50} className="min-w-0">
              <Card interactive className="group relative flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-sans text-[16px] font-semibold text-ink">
                      <Link to={`/company/jobs/${j.id}/candidates`} className="after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none">
                        {j.title}
                      </Link>
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-stone-500">
                      <MapPin size={12} /> {j.location} · {j.workplaceType}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[j.status] || "neutral"}>{j.status}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(j.skills || []).slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11.5px] font-medium text-stone-600">{s}</span>
                  ))}
                  {(j.skills || []).length > 3 && <span className="px-1 text-[11.5px] text-stone-400">+{j.skills.length - 3}</span>}
                </div>

                <div className="mt-auto pt-5">
                  <div className="flex items-center justify-between text-[12.5px] text-stone-500">
                    <span className="inline-flex items-center gap-1.5"><Users size={13} /> {j.count} applicants</span>
                    <span>{relativeTime(j.createdAt)}</span>
                  </div>
                  {j.needsReview > 0 && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-700">{j.needsReview} awaiting review</p>
                  )}
                </div>

                <div className="relative z-10 mt-4 flex items-center gap-1.5 border-t border-[var(--line)] pt-4" onClick={(e) => e.stopPropagation()}>
                  <Link to={`/company/jobs/${j.id}/preview`} className="btn-secondary !h-9 flex-1 !px-3 text-[12.5px]">
                    <Eye size={14} /> Preview
                  </Link>
                  <button type="button" onClick={() => copyLink(j)} aria-label={`Copy application link for ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:border-brand/40 hover:text-brand">
                    {copied === j.id ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
                  </button>
                  <button type="button" onClick={() => duplicate(j)} aria-label={`Duplicate ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-500 hover:text-ink">
                    <Copy size={15} />
                  </button>
                  <button type="button" onClick={() => setConfirm(j)} aria-label={`Delete ${j.title}`} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-stone-400 hover:border-red-200 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="relative z-10 mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {j.status !== "Open" && (
                    <button type="button" onClick={() => { setJobStatus(j.id, "Open"); toast({ title: "Role published", message: `${j.title} is now collecting applications.` }); }} className="btn-primary !h-9 flex-1 !px-3 text-[12.5px]">
                      Publish
                    </button>
                  )}
                  {j.status === "Open" && (
                    <button type="button" onClick={() => { setJobStatus(j.id, "Closed"); toast({ type: "info", title: "Role closed", message: `${j.title} no longer accepts applications.` }); }} className="btn-secondary !h-9 flex-1 !px-3 text-[12.5px]">
                      Close role
                    </button>
                  )}
                  <Link to={`/company/jobs/${j.id}/edit`} className="btn-secondary !h-9 flex-1 !px-3 text-[12.5px]">
                    Edit
                  </Link>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      {confirm && (
        <ActionDialog
          title={`Delete ${confirm.title}?`}
          message="The role and every applicant attached to it are removed. This cannot be undone."
          confirmLabel="Delete role"
          tone="danger"
          onConfirm={remove}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

