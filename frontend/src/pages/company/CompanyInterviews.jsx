// Every interview of one role (Module 7: GET /jobs/<id>/interviews/), filterable by kind and status.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MicOff } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/app/primitives";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import { interviewsApi } from "@/api/interviewsApi";
import { isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useRemote } from "@/hooks/useRemote";
import { formatDate } from "@/lib/candidateStats";
import { ROUTES } from "@/config/routes";

const KINDS = [["", "Any kind"], ["screening", "Screening"], ["technical", "Technical"]];
const STATUSES = ["invited", "in_progress", "interrupted", "completed", "incomplete", "evaluated", "evaluation_failed", "expired", "cancelled"];
const label = (v) => String(v || "").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const tone = (s) => (s === "evaluated" ? "success" : ["evaluation_failed", "expired", "cancelled"].includes(s) ? "danger" : ["invited", "in_progress", "interrupted"].includes(s) ? "warning" : "neutral");

export default function CompanyInterviews() {
  const { id } = useParams();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const job = useRemote((o) => jobsApi.get(id, o), [id]);
  const list = useRemote((o) => interviewsApi.listForJob(id, { kind, status, page }, o), [id, kind, status, page]);
  const rows = list.data?.results || [];

  if (isBlocked(list.error) || isBlocked(job.error)) return <CompanyBlocked onRetry={list.reload} />;
  if (job.error?.status === 404 || list.error?.status === 404) {
    return <EmptyState icon={MicOff} title="Role not found" message="It may have been removed or belongs to another company." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;
  }
  const reset = (set) => (v) => { set(v); setPage(1); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={job.data?.title || "Role"}
        title={<>Role <em>interviews</em></>}
        subtitle="Every screening and technical interview sent for this role."
        actions={<Link to={`/company/jobs/${id}/candidates`} className="btn-secondary"><ArrowLeft size={16} /> Applicants</Link>}
      />
      <div className="flex flex-wrap gap-2">
        <select aria-label="Kind" value={kind} onChange={(e) => reset(setKind)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className="h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] font-semibold text-stone-600">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>
      {list.status === "loading" && !list.data ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-stone-500"><Loader2 size={18} className="animate-spin text-brand" /> Loading interviews</div>
      ) : list.status === "error" ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800"><span className="flex-1">{list.error.message}</span><button type="button" onClick={list.reload} className="font-semibold underline">Retry</button></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={MicOff} title={kind || status ? "No interviews match" : "No interviews yet"} message={kind || status ? "Change the filters." : "Invite a shortlisted candidate from their profile to start one."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-[var(--line)] bg-stone-50/70 text-[11px] font-semibold uppercase text-stone-500">
                <tr><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Invited</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3"><p className="font-semibold text-ink">{s.application?.full_name}</p><p className="text-[11.5px] text-stone-500">{s.application?.reference}</p></td>
                    <td className="px-4 py-3 text-stone-600">{label(s.kind)}</td>
                    <td className="px-4 py-3"><Badge tone={tone(s.status)}>{label(s.status)}</Badge>{s.recommendation && <span className="ml-1.5 text-[11.5px] text-stone-500">{label(s.recommendation)}</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-stone-600">{s.overall_score ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(s.invited_at)}</td>
                    <td className="px-4 py-3 text-right"><Link to={`/company/candidates/${s.application?.id}`} className="btn-secondary !h-8 !px-2.5 text-[11.5px]">Open candidate</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-[12.5px] text-stone-500">
            <span>{list.data.count} interview{list.data.count === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span>Page {page}</span>
              <button type="button" aria-label="Next page" onClick={() => setPage((p) => p + 1)} disabled={!list.data.hasNext} className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
