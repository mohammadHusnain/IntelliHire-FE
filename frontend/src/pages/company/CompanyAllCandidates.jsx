import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, Download, LayoutGrid, List, SearchX, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Segmented, StatTile } from "@/components/app/primitives";
import { DataTable, SearchField, SelectField, Tabs } from "@/components/admin/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import { PIPELINE, PIPELINE_META, companyStats, useCompanyActions, useCompanyRecord } from "@/store/companyStore";
import { formatDate, relativeTime, scoreTone } from "@/lib/candidateStats";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const SORTS = {
  recent: { label: "Newest first", fn: (a, b) => b.appliedAt - a.appliedAt },
  score: { label: "Best match", fn: (a, b) => b.cvScore - a.cvScore },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};

function KanbanCard({ a, job }) {
  const tone = scoreTone(a.cvScore);
  return (
    <Link to={`/company/candidates/${a.id}`} className="group block rounded-xl border border-[var(--line)] bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_10px_24px_-16px_rgba(13,13,13,0.35)]">
      <div className="flex items-center gap-2.5">
        <Avatar name={a.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink">{a.name}</p>
          <p className="truncate text-[11.5px] text-stone-500">{job?.title || "Role removed"}</p>
        </div>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${tone.bg} ${tone.text}`}>{a.cvScore}</span>
      </div>
      <p className="mt-2 text-[11.5px] text-stone-400">{relativeTime(a.appliedAt)}</p>
    </Link>
  );
}

export default function CompanyAllCandidates() {
  const { id: jobIdParam } = useParams();
  const record = useCompanyRecord();
  const { bulkStage } = useCompanyActions();
  const stats = useMemo(() => companyStats(record), [record]);

  const [view, setView] = useState("board");
  const [tab, setTab] = useState("active");
  const [jobFilter, setJobFilter] = useState(jobIdParam || "all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState([]);

  const job = record.jobs.find((j) => j.id === jobIdParam);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return record.applicants
      .filter((a) => (jobFilter === "all" ? true : a.jobId === jobFilter))
      .filter((a) => (tab === "active" ? a.stage !== "Rejected" : tab === "rejected" ? a.stage === "Rejected" : true))
      .filter((a) => !q || `${a.name} ${a.email}`.toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [record.applicants, jobFilter, tab, query, sort]);

  const jobOf = (a) => record.jobs.find((j) => j.id === a.jobId);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Role", "Stage", "CV match", "Screening", "Technical", "Source", "Applied"];
    const data = base.map((a) => [
      a.name, a.email, jobOf(a)?.title || "", a.stage, a.cvScore, a.screeningScore ?? "", a.technicalScore ?? "", a.source,
      new Date(a.appliedAt).toISOString().slice(0, 10),
    ]);
    const name = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(name, toCsv(headers, data));
    toast({ title: "Candidates exported", message: `${data.length} candidates saved to ${name}.` });
  };

  const move = (stage) => {
    bulkStage(selected, stage);
    toast({ title: `${selected.length} moved to ${stage}`, message: "Their pipeline history was updated." });
    setSelected([]);
  };

  const columns = [
    {
      key: "name",
      label: "Candidate",
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar name={a.name} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{a.name}</p>
            <p className="truncate text-[12.5px] text-stone-500">{a.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", cell: (a) => <span className="truncate text-stone-600">{jobOf(a)?.title || "—"}</span> },
    { key: "score", label: "CV match", className: "text-center", cell: (a) => <span className={`rounded-md px-2 py-1 text-[13px] font-semibold tabular-nums ${scoreTone(a.cvScore).bg} ${scoreTone(a.cvScore).text}`}>{a.cvScore}</span> },
    { key: "stage", label: "Stage", cell: (a) => <Badge tone={PIPELINE_META[a.stage]?.tone || "neutral"}>{a.stage}</Badge> },
    { key: "applied", label: "Applied", cell: (a) => <span className="whitespace-nowrap text-stone-600">{formatDate(a.appliedAt)}</span> },
    { key: "go", label: "", className: "text-right", cell: () => <ChevronRight size={16} className="ml-auto text-stone-300" /> },
  ];

  const card = (a) => (
    <Card interactive className="p-4">
      <Link to={`/company/candidates/${a.id}`} className="flex items-start gap-3">
        <Avatar name={a.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{a.name}</p>
          <p className="truncate text-[12.5px] text-stone-500">{jobOf(a)?.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={PIPELINE_META[a.stage]?.tone || "neutral"}>{a.stage}</Badge>
            <Badge tone="neutral">CV {a.cvScore}</Badge>
          </div>
        </div>
      </Link>
    </Card>
  );

  if (!record.applicants.length) {
    return (
      <div>
        <PageHeader eyebrow="Candidates" title={<>Your <em>candidates</em></>} subtitle="Everyone who has applied to your roles." />
        <EmptyState
          icon={Users}
          title="No applicants yet"
          message="Share a role's application link and candidates will appear here with their CV match score."
          action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Go to roles <ArrowRight size={15} className="btn-arrow" /></Link>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={job ? job.title : "Candidates"}
        title={job ? <>Pipeline for <em>{job.title}</em></> : <>Your <em>candidates</em></>}
        subtitle={`${base.length} shown · ${stats.needsReview} awaiting first review`}
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn-secondary">
              <Download size={16} /> Export CSV
            </button>
            <Segmented
              ariaLabel="View"
              value={view}
              onChange={setView}
              options={[{ value: "board", label: "Board", icon: LayoutGrid }, { value: "list", label: "List", icon: List }]}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Applicants" value={stats.applicants} />
        <StatTile icon={Users} label="Awaiting review" value={stats.needsReview} delay={60} />
        <StatTile icon={Users} label="Shortlisted" value={stats.shortlisted} delay={120} />
        <StatTile icon={Users} label="Average CV match" value={stats.avgScore} suffix="/100" delay={180} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "In play", count: stats.active },
            { value: "rejected", label: "Not proceeding", count: stats.rejected },
            { value: "all", label: "All", count: stats.applicants },
          ]}
        />
        <SearchField value={query} onChange={setQuery} placeholder="Search name or email" className="flex-1" />
        <SelectField label="Role" value={jobFilter} onChange={setJobFilter} options={[{ value: "all", label: "All roles" }, ...record.jobs.map((j) => ({ value: j.id, label: j.title }))]} />
        <SelectField label="Sort" value={sort} onChange={setSort} options={Object.entries(SORTS).map(([k, v]) => ({ value: k, label: v.label }))} />
      </div>

      {selected.length > 0 && (
        <div className="animate-fade-in-up flex flex-wrap items-center gap-2 rounded-2xl border border-brand/20 bg-brand-soft p-3 pl-4">
          <p className="mr-2 text-[13px] font-semibold text-ink">{selected.length} selected</p>
          {["Screened", "Shortlisted", "Rejected"].map((s) => (
            <button key={s} type="button" onClick={() => move(s)} className="btn-secondary !h-9 !px-3.5 text-[12.5px]">
              Move to {s}
            </button>
          ))}
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-[12.5px] font-semibold text-stone-500 hover:text-ink">
            Clear
          </button>
        </div>
      )}

      {base.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No candidates match"
          message="Try a different tab, role or search."
          action={<button type="button" onClick={() => { setQuery(""); setJobFilter("all"); setTab("all"); }} className="btn-secondary">Clear filters</button>}
        />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[820px] grid-cols-5 gap-3">
            {PIPELINE.map((stage) => {
              const items = base.filter((a) => a.stage === stage);
              return (
                <section key={stage} className="flex min-w-0 flex-col rounded-2xl bg-stone-100/70 p-2.5">
                  <header className="flex items-center justify-between px-1.5 pb-2.5">
                    <h2 className="truncate text-[12.5px] font-semibold text-stone-600">{stage}</h2>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-stone-500">{items.length}</span>
                  </header>
                  <div className="flex flex-col gap-2">
                    {items.map((a) => <KanbanCard key={a.id} a={a} job={jobOf(a)} />)}
                    {items.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 px-2 py-6 text-center text-[12px] text-stone-400">Empty</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <Reveal>
          <DataTable
            columns={columns}
            rows={base}
            rowKey={(a) => a.id}
            selected={selected}
            onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            onToggleAll={(on) => setSelected(on ? base.map((a) => a.id) : [])}
            renderCard={card}
            empty={null}
          />
        </Reveal>
      )}
    </div>
  );
}
