import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock, Copy, Loader2, Pencil, SearchX, Users, WifiOff } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import ApplicationFormFields from "@/components/jobs/ApplicationFormFields";
import JobSummary from "@/components/jobs/JobSummary";
import ReopenDialog from "@/components/jobs/ReopenDialog";
import { isBlocked } from "@/api/companyApi";
import { jobsApi } from "@/api/jobsApi";
import { useJobActions } from "@/hooks/useJobActions";
import { useRemote } from "@/hooks/useRemote";
import { JOB_STATUS, canEditJobs, canManageJobs, formatDeadline } from "@/lib/jobMap";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

/** "How candidates see it": the real application form of a role, exactly as the public page builds it. */
export default function CompanyJobPreviewLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = canEditJobs(user);
  const canManage = canManageJobs(user);
  const [copied, setCopied] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState("");

  const job = useRemote((o) => jobsApi.get(id, o), [id]);
  const schema = useRemote((o) => jobsApi.formPreview(id, o), [id]);
  const refresh = () => {
    job.reload();
    schema.reload();
  };
  const actions = useJobActions({ onChanged: refresh });

  if (isBlocked(job.error) || isBlocked(schema.error)) return <CompanyBlocked onRetry={refresh} />;
  if (job.error?.status === 404 || schema.error?.status === 404) {
    return <EmptyState icon={SearchX} title="Role not found" message="This role may have been deleted." action={<Link to={ROUTES.COMPANY.JOBS} className="btn-primary">Back to roles</Link>} />;
  }
  if ((job.status === "error" && !job.data) || (schema.status === "error" && !schema.data)) {
    const error = job.error || schema.error;
    return (
      <Card className="p-6">
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff size={26} className="text-stone-400" />
          <p className="max-w-sm text-[14.5px] text-stone-600">{error.message}</p>
          <button type="button" onClick={refresh} className="btn-secondary">Try again</button>
        </div>
      </Card>
    );
  }
  if (!job.data || !schema.data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading the preview" /></div>;

  const j = job.data;
  const s = schema.data;
  const status = JOB_STATUS[j.status] || { label: j.status, tone: "neutral" };
  const working = actions.busy.has(j.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(j.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "Link copied", message: "Paste it anywhere candidates will see it." });
    } catch {
      toast({ type: "error", title: "Could not copy", message: "Select the link and copy it manually." });
    }
  };

  const publish = async () => {
    const result = await actions.publish(j);
    if (result && actions.isError(result) && result.error.status === 400) navigate(`/company/jobs/${j.id}/edit`);
  };

  const reopen = async (deadline) => {
    setReopenError("");
    const result = await actions.reopen(j, deadline);
    if (result && actions.isError(result)) setReopenError(result.error.fieldErrors?.deadline?.[0] || result.error.message);
    else if (result) setReopening(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Role preview"
        title={<>How candidates <em>see it</em></>}
        subtitle="This is the page your application link opens."
        actions={
          <>
            <Link to={ROUTES.COMPANY.JOBS} className="btn-secondary"><ArrowLeft size={16} /> Roles</Link>
            {canEdit && j.status !== "closed" && <Link to={`/company/jobs/${j.id}/edit`} className="btn-secondary"><Pencil size={15} /> Edit</Link>}
            {canEdit && j.status === "draft" && <button type="button" disabled={working} onClick={publish} className="btn-primary">{working && <Loader2 size={15} className="animate-spin" />} Publish</button>}
            {canEdit && j.status === "open" && <button type="button" disabled={working} onClick={() => actions.close(j)} className="btn-secondary hover:!border-red-200 hover:!text-red-600">Close role</button>}
            {canManage && j.status === "closed" && <button type="button" disabled={working} onClick={() => { setReopenError(""); setReopening(true); }} className="btn-primary">Reopen</button>}
          </>
        }
      />

      <Reveal>
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] text-stone-600">
            <Badge tone={status.tone}>{status.label}</Badge>
            {j.expired && <Badge tone="warning">Deadline passed</Badge>}
            <Link to={`/company/jobs/${j.id}/candidates`} className="inline-flex items-center gap-1.5 hover:text-brand"><Users size={14} /> {j.applicationsCount} {j.applicationsCount === 1 ? "application" : "applications"}</Link>
            {j.deadline && <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {j.status === "open" && !j.expired ? `${j.daysLeft} ${j.daysLeft === 1 ? "day" : "days"} left · ` : ""}{formatDeadline(j.deadline)}</span>}
            {j.status === "closed" && <span>{j.closeReason === "deadline" ? "Closed: the deadline passed" : "Closed by your team"}</span>}
          </div>
          {j.status === "open" && j.shareUrl ? (
            <div className="flex min-w-0 items-center gap-2">
              <input readOnly aria-label="Application link" value={j.shareUrl} onFocus={(e) => e.target.select()} className="field !h-10 min-w-0 flex-1 !text-[13px] sm:w-72" />
              <button type="button" onClick={copy} className="btn-secondary !h-10 shrink-0">{copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} Copy</button>
            </div>
          ) : j.status === "draft" ? (
            <p className="text-[13px] text-stone-500">Publish the role to get its application link.</p>
          ) : null}
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <Card className="p-6 sm:p-8">
          <JobSummary job={s.job} />
        </Card>
      </Reveal>

      <Reveal delay={100}>
        <Card className="p-6 sm:p-8">
          <h2 className="display text-[24px]">The application form</h2>
          <p className="mt-1 text-[14px] text-stone-500">Exactly what candidates fill in. Fields marked * are required.</p>
          {!s.accepting && (
            <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-[13.5px] text-amber-800">{s.message || "This role is not accepting applications."}</p>
          )}
          <div className="mt-6">
            <ApplicationFormFields fields={s.fields} readOnly idPrefix="preview" />
          </div>
        </Card>
      </Reveal>

      {reopening && <ReopenDialog title={j.title} busy={working} error={reopenError} onConfirm={reopen} onClose={() => setReopening(false)} />}
    </div>
  );
}
