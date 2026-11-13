import { BriefcaseBusiness, CalendarDays, ChevronRight, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { trackingApi } from "@/api/trackingApi";
import { Badge, Card, CardHeader } from "@/components/app/primitives";
import { useRemote } from "@/hooks/useRemote";
import { USE_MOCK_API } from "@/config/env";

export default function CandidateApplicationOverview() {
  const remote = useRemote(({ signal }) => USE_MOCK_API ? Promise.resolve(null) : trackingApi.dashboard({ signal }), []);
  if (USE_MOCK_API) return null;

  const data = remote.data;
  return <Card className="p-6">
    <CardHeader icon={BriefcaseBusiness} title="Job applications" subtitle="Candidate-visible progress across your applications" action={<Link to="/candidate/applications" className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-500 hover:text-brand">View all <ChevronRight size={15} /></Link>} />
    {remote.status === "loading" && !data && <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-brand" aria-label="Loading application summary" /></div>}
    {remote.status === "error" && !data && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-stone-600"><span className="flex items-center gap-2"><WifiOff size={16} /> {remote.error.message}</span><button type="button" className="btn-secondary !h-8 !px-3 text-[12px]" onClick={remote.reload}><RefreshCw size={13} /> Retry</button></div>}
    {data && <div className="mt-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Total" value={data.total} />
        <Count label="Submitted" value={data.counts.Submitted || 0} />
        <Count label="Reviewing" value={data.counts.Reviewing || 0} />
        <Count label="Interview scheduled" value={data.counts["Interview scheduled"] || 0} />
      </div>
      {data.pendingInvitations.length > 0 ? <div className="mt-5 border-t border-[var(--line)] pt-4"><p className="mb-2 text-[12px] font-semibold text-stone-500">Waiting interview invitations</p><ul className="divide-y divide-[var(--line)]">{data.pendingInvitations.map((invite) => <li key={invite.applicationId}><Link to={`/candidate/applications/${invite.applicationId}`} className="flex flex-wrap items-center gap-2 py-3 text-[13px] hover:text-brand"><CalendarDays size={15} className="shrink-0 text-brand" /><span className="min-w-0 flex-1"><span className="font-semibold text-ink">{invite.jobTitle}</span><span className="ml-2 text-stone-500">{invite.companyName}</span></span><Badge tone="brand">{invite.kind}</Badge><ChevronRight size={15} /></Link></li>)}</ul></div> : <p className="mt-4 text-[13px] text-stone-500">No interview invitations are waiting.</p>}
      {data.total === 0 && <Link to="/candidate/applications" className="mt-3 inline-flex text-[12px] font-semibold text-brand hover:underline">Open application tracking</Link>}
    </div>}
  </Card>;
}

function Count({ label, value }) { return <div className="rounded-xl bg-stone-50 p-3"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 font-display text-[23px] tabular-nums text-ink">{value}</p></div>; }
