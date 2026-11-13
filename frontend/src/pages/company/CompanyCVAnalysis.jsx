import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock3, FileSearch, FileText, Play, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, ProgressBar, StatTile, Toggle } from "@/components/app/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import { useCompanyRecord } from "@/store/companyStore";
import { scoreTone } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const INITIAL_SETTINGS = { autoAnalyze: true, threshold: 70, skills: 45, experience: 25, education: 15, keywords: 15 };
const SCORE_PARTS = [
  { key: "skills", label: "Skills", max: 45 },
  { key: "experience", label: "Experience", max: 25 },
  { key: "education", label: "Education", max: 15 },
  { key: "keywords", label: "Role keywords", max: 15 },
];

export default function CompanyCVAnalysis() {
  const { id: jobId } = useParams();
  const record = useCompanyRecord();
  const job = record.jobs.find((item) => item.id === jobId);
  const applicants = record.applicants.filter((item) => item.jobId === jobId);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [shortlisted, setShortlisted] = useState(() => new Set(applicants.filter((a) => a.stage === "Shortlisted").map((a) => a.id)));
  const [overrides, setOverrides] = useState({});
  const [running, setRunning] = useState(false);

  const rows = useMemo(() => applicants.map((a, index) => {
    const score = Number(a.cvScore || 0);
    const status = overrides[a.id] || (index === 2 ? "Failed" : score < settings.threshold ? "Manual review" : "Complete");
    return { ...a, score, status };
  }), [applicants, overrides, settings.threshold]);
  const visible = rows.filter((a) => {
    const matchesFilter = activeFilter === "all" || (activeFilter === "shortlisted" ? shortlisted.has(a.id) : a.status.toLowerCase().replace(" ", "-") === activeFilter);
    const matchesQuery = !query || `${a.name} ${a.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });
  const completeCount = rows.filter((a) => a.status === "Complete").length;
  const reviewCount = rows.filter((a) => a.status === "Manual review").length;

  const setStatus = (candidateId, status) => setOverrides((current) => ({ ...current, [candidateId]: status }));
  const runAnalysis = () => {
    if (!applicants.length) return;
    setRunning(true);
    applicants.forEach((a) => setStatus(a.id, "Queued"));
    window.setTimeout(() => {
      setOverrides(Object.fromEntries(applicants.map((a) => [a.id, Number(a.cvScore || 0) < settings.threshold ? "Manual review" : "Complete"])));
      setRunning(false);
      toast({ title: "Analysis run complete", message: `${applicants.length} CVs were processed in this UI preview.` });
    }, 900);
  };
  const retry = (candidateId) => {
    setStatus(candidateId, "Queued");
    window.setTimeout(() => setStatus(candidateId, "Complete"), 700);
    toast({ title: "Retry queued", message: "The preview status will update shortly." });
  };
  const toggleShortlist = (candidateId) => {
    setShortlisted((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  if (!job) return <EmptyState icon={FileSearch} title="Role not found" message="This CV analysis workspace is linked to a role that is no longer available." action={<Link to="/company/jobs" className="btn-secondary"><ArrowLeft size={15} /> Back to roles</Link>} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hiring · CV analysis"
        title={<>CV match for <em>{job.title}</em></>}
        subtitle="Review role-fit signals and decide which applications need a closer look. Scores are sample UI data until API integration."
        actions={<><Link to={`/company/jobs/${job.id}/candidates`} className="btn-secondary"><ArrowLeft size={15} /> Pipeline</Link><button type="button" onClick={() => setSettingsOpen((open) => !open)} className="btn-secondary"><Settings2 size={15} /> Settings</button><button type="button" onClick={runAnalysis} disabled={running || !applicants.length} className="btn-primary"><Play size={15} /> {running ? "Processing…" : "Run analysis"}</button></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={FileText} label="Applications" value={applicants.length} />
        <StatTile icon={ShieldCheck} label="Analyzed" value={completeCount} delay={60} />
        <StatTile icon={AlertTriangle} label="Manual review" value={reviewCount} delay={120} />
        <StatTile icon={Clock3} label="Failed / queued" value={rows.filter((a) => ["Failed", "Queued"].includes(a.status)).length} delay={180} />
      </div>

      {settingsOpen && <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4"><div><h2 className="text-[15px] font-semibold text-ink">Analysis settings</h2><p className="mt-1 text-[13px] text-stone-500">Tune the preview criteria for this role. Changes are kept in this page only.</p></div><Toggle checked={settings.autoAnalyze} onChange={(value) => setSettings((s) => ({ ...s, autoAnalyze: value }))} label="Automatically analyze new applications" /></div>
        <div className="mt-5 grid gap-6 md:grid-cols-[1fr_220px]">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{SCORE_PARTS.map((part) => <label key={part.key} className="block"><span className="flex justify-between text-[13px] font-medium text-stone-700"><span>{part.label}</span><span>{settings[part.key]}%</span></span><input className="mt-2 w-full accent-[#F04E23]" type="range" min="0" max="100" step="5" value={settings[part.key]} onChange={(e) => setSettings((s) => ({ ...s, [part.key]: Number(e.target.value) }))} /></label>)}</div>
          <label className="block"><span className="text-[13px] font-medium text-stone-700">Review threshold</span><span className="mt-2 flex items-center gap-2"><input type="number" min="0" max="100" value={settings.threshold} onChange={(e) => setSettings((s) => ({ ...s, threshold: Math.max(0, Math.min(100, Number(e.target.value))) }))} className="h-10 w-24 rounded-lg border border-[var(--line)] px-3 text-sm" /><span className="text-sm text-stone-500">/ 100</span></span><span className="mt-2 block text-[12px] text-stone-500">Below this score, flag for a person to review.</span></label>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" onClick={() => { setSettingsOpen(false); toast({ title: "Settings saved", message: "Preview criteria updated for this workspace." }); }} className="btn-primary"><Check size={15} /> Save settings</button></div>
      </Card>}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--line)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-[15px] font-semibold text-ink">Applicant analysis</h2><p className="mt-1 text-[12.5px] text-stone-500">{rows.length} candidates · threshold {settings.threshold}/100</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates" className="h-10 w-full rounded-lg border border-[var(--line)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-brand sm:w-52" /></div><div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-stone-100 p-1">{[{ id: "all", label: "All" }, { id: "complete", label: "Complete" }, { id: "manual-review", label: "Review" }, { id: "failed", label: "Failed" }, { id: "shortlisted", label: "Shortlisted" }].map((filter) => <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${activeFilter === filter.id ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-ink"}`}>{filter.label}</button>)}</div></div>
        </div>
        {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-stone-50 text-[11px] uppercase tracking-[0.08em] text-stone-500"><tr><th className="px-5 py-3 font-semibold">Candidate</th><th className="px-4 py-3 font-semibold">Match</th><th className="px-4 py-3 font-semibold">Strongest signal</th><th className="px-4 py-3 font-semibold">Analysis</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{visible.map((a) => { const tone = scoreTone(a.score); const skills = a.matchedSkills || []; return <tr key={a.id} className="group hover:bg-stone-50/70"><td className="px-5 py-4"><button type="button" onClick={() => setSelected(a)} className="flex items-center gap-3 text-left"><Avatar name={a.name} size={36} /><span><span className="block text-[13px] font-semibold text-ink">{a.name}</span><span className="mt-0.5 block text-[12px] text-stone-500">{a.email}</span></span></button></td><td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-[13px] font-semibold tabular-nums ${tone.bg} ${tone.text}`}>{a.score}<span className="font-normal opacity-70"> / 100</span></span></td><td className="px-4 py-4"><span className="text-[12.5px] text-stone-600">{skills.slice(0, 3).join(" · ") || "Experience & role fit"}</span></td><td className="px-4 py-4"><StatusBadge status={a.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button title="View analysis" aria-label={`View ${a.name} analysis`} onClick={() => setSelected(a)} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-brand-soft hover:text-brand"><ChevronRight size={17} /></button>{a.status === "Failed" && <button title="Retry analysis" aria-label={`Retry analysis for ${a.name}`} onClick={() => retry(a.id)} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-brand-soft hover:text-brand"><RotateCcw size={15} /></button>}</div></td></tr>; })}</tbody></table></div> : <div className="p-6"><EmptyState icon={UserRound} title="No applicants in this view" message="Change the status filter or search query to see candidates." /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3"><p className="text-[12px] text-stone-500">Showing {visible.length} of {rows.length}</p><p className="flex items-center gap-1.5 text-[11.5px] text-stone-400"><Sparkles size={13} /> Preview scores are not connected to the analysis API</p></div>
      </Card>

      {selected && <div className="fixed inset-0 z-[80] flex justify-end bg-ink/35" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-label={`${selected.name} CV analysis`} className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-4"><div className="flex items-center gap-3"><Avatar name={selected.name} size={40} /><div><h2 className="text-[15px] font-semibold text-ink">{selected.name}</h2><p className="text-[12px] text-stone-500">{selected.email}</p></div></div><button type="button" onClick={() => setSelected(null)} aria-label="Close candidate analysis" className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X size={18} /></button></div><div className="space-y-6 p-5 sm:p-6"><div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-stone-50 p-4"><div><p className="text-[12px] font-medium text-stone-500">Overall role match</p><p className="mt-1 text-[13px] text-stone-600">{selected.summary || "Profile signals compared with this role's requirements."}</p></div><strong className={`text-3xl tabular-nums ${scoreTone(selected.score).text}`}>{selected.score}</strong></div><section><div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-semibold text-ink">Score breakdown</h3><span className="text-[11px] text-stone-400">Weight · result</span></div><div className="space-y-3">{SCORE_PARTS.map((part, index) => { const raw = [selected.score, Math.min(100, selected.score + 8), Math.max(35, selected.score - 12), Math.min(100, selected.score + 3)][index]; return <div key={part.key}><div className="mb-1.5 flex justify-between text-[12px]"><span className="text-stone-600">{part.label} <span className="text-stone-400">· {settings[part.key]}%</span></span><span className="font-semibold text-ink">{raw}%</span></div><ProgressBar value={raw} className="h-1.5" /></div>; })}</div></section><section><h3 className="mb-3 text-[13px] font-semibold text-ink">Skills evidence</h3><div className="flex flex-wrap gap-2">{(selected.matchedSkills || job.skills || []).map((skill) => <Badge key={skill} tone="success"><Check size={11} />{skill}</Badge>)}{(selected.unmatchedSkills || []).map((skill) => <Badge key={skill} tone="warning">{skill}</Badge>)}</div><p className="mt-2 text-[11.5px] text-stone-500">Green indicates matched evidence; amber items may need validation.</p></section><section className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><SlidersHorizontal size={15} className="text-brand" /> Review guidance</div><p className="mt-2 text-[12.5px] leading-relaxed text-stone-600">Check the source CV for context and validate skill depth during interview. This comparison is assistive and should not be used as the sole hiring decision.</p></section><div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--line)] pt-4"><button type="button" onClick={() => { setStatus(selected.id, "Manual review"); setSelected(null); }} className="btn-secondary flex-1"><AlertTriangle size={15} /> Mark for review</button><button type="button" onClick={() => { toggleShortlist(selected.id); setSelected(null); }} className="btn-primary flex-1"><Check size={15} /> {shortlisted.has(selected.id) ? "Remove shortlist" : "Shortlist"}</button></div></div></aside></div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = status === "Complete" ? "success" : status === "Manual review" ? "warning" : status === "Failed" ? "danger" : "neutral";
  return <Badge tone={tone}>{status === "Queued" && <Clock3 size={11} />}{status}</Badge>;
}
