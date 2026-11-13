import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Download, FileText, GraduationCap, Loader2, Mail, MessageSquareText, Phone, Send, Sparkles, UserX, WifiOff } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/app/primitives";
import { Avatar } from "@/components/app/HeaderMenus";
import Reveal from "@/components/shared/Reveal";
import CompanyBlocked from "@/components/company/CompanyBlocked";
import AnswerValue from "@/components/applications/AnswerValue";
import StatusDialog from "@/components/applications/StatusDialog";
import TechnicalInterviewPanel from "@/components/company/TechnicalInterviewPanel";
import CvAnalysisPanel from "@/components/company/CvAnalysisPanel";
import { isBlocked } from "@/api/companyApi";
import { applicationsApi } from "@/api/applicationsApi";
import { useRemote } from "@/hooks/useRemote";
import { LIMITS, canChangeStatus, cleanFileName, statusLabel, statusTone } from "@/lib/applicationMap";
import { formatDate, relativeTime } from "@/lib/candidateStats";
import { openBlobInTab, saveBlob } from "@/lib/download";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { ROUTES } from "@/config/routes";

const when = (t) => (t ? new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

/** One candidate: contact, education, the answers to the form, the CV, the status history and the team's notes. */
export default function CompanyApplicantLive() {
  const { id } = useParams();
  const detail = useRemote((o) => applicationsApi.get(id, o), [id]);

  if (isBlocked(detail.error)) return <CompanyBlocked onRetry={detail.reload} />;
  if (detail.error?.status === 404) {
    return <EmptyState icon={UserX} title="Candidate not found" message="This application may not exist, or it belongs to another company." action={<Link to={ROUTES.COMPANY.CANDIDATES} className="btn-primary">Back to candidates</Link>} />;
  }
  if (detail.status === "error" && !detail.data) {
    return (
      <Card className="p-6">
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <WifiOff size={26} className="text-stone-400" />
          <p className="max-w-sm text-[14.5px] text-stone-600">{detail.error.message}</p>
          <button type="button" onClick={detail.reload} className="btn-secondary">Try again</button>
        </div>
      </Card>
    );
  }
  if (!detail.data) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={26} aria-label="Loading the candidate" /></div>;
  return <Applicant key={detail.data.id} initial={detail.data} />;
}

function Applicant({ initial }) {
  const user = useAuthStore((s) => s.user);
  const canChange = canChangeStatus(user);
  const [a, setA] = useState(initial);
  const [dialog, setDialog] = useState(null); // null | { initial }
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  const changeStatus = async (status, text) => {
    setBusy(true);
    setDialogError("");
    try {
      setA(await applicationsApi.changeStatus(a.id, status, text)); // the server returns the whole application, history included
      setDialog(null);
      toast({ title: `${a.name} is now ${statusLabel(status)}`, message: "The change is in their history." });
    } catch (error) {
      setDialogError(error.fieldErrors?.status?.[0] || error.fieldErrors?.note?.[0] || error.message);
      if (error.status === 404) setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (noteBusy) return;
    const text = note.trim();
    if (!text) return setNoteError("Write something first");
    setNoteBusy(true);
    setNoteError("");
    try {
      const created = await applicationsApi.addNote(a.id, text);
      setA((x) => ({ ...x, notes: [created, ...x.notes] }));
      // Clear the box only if nothing new was typed while the note was being saved.
      setNote((current) => (current.trim() === text ? "" : current));
      toast({ title: "Note saved", message: "Your team can see it on this profile." });
    } catch (error) {
      setNoteError(error.fieldErrors?.text?.[0] || error.message);
    } finally {
      setNoteBusy(false);
    }
  };

  const openResume = async () => {
    if (fileBusy) return;
    setFileBusy(true);
    const tab = openBlobInTab(); // opened by the click, so the browser allows it
    try {
      const { blob, filename } = await applicationsApi.downloadResume(a.id);
      const name = cleanFileName(filename || a.resume?.name);
      if (blob.type === "application/pdf" || /\.pdf$/i.test(name)) tab.show(blob, name);
      else {
        tab.fail();
        saveBlob(blob, name);
      }
    } catch (error) {
      tab.fail();
      toast({ type: "error", title: "Couldn't open the CV", message: error.message });
    } finally {
      setFileBusy(false);
    }
  };

  const download = async (fetcher, fallback) => {
    if (fileBusy) return;
    setFileBusy(true);
    try {
      const { blob, filename } = await fetcher();
      saveBlob(blob, cleanFileName(filename || fallback));
    } catch (error) {
      toast({ type: "error", title: "Couldn't download the file", message: error.message });
    } finally {
      setFileBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={a.job?.title || "Candidate"}
        title={<>{a.name}</>}
        subtitle={`Applied ${formatDate(a.submittedAt)} · reference ${a.reference}`}
        actions={
          <>
            <Link to={a.job ? `/company/jobs/${a.job.id}/candidates` : ROUTES.COMPANY.CANDIDATES} className="btn-secondary"><ArrowLeft size={16} /> {a.job ? "Back to the pipeline" : "All candidates"}</Link>
            {canChange && <button type="button" onClick={() => { setDialogError(""); setDialog({ initial: "" }); }} className="btn-primary">Change status</button>}
            {canChange && a.status !== "rejected" && <button type="button" onClick={() => { setDialogError(""); setDialog({ initial: "rejected" }); }} className="btn-secondary hover:!border-red-200 hover:!text-red-600">Reject</button>}
          </>
        }
      />

      <Reveal>
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={a.name} size={56} />
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold text-ink">{a.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(a.status)}>{statusLabel(a.status)}</Badge>
                  {a.job && <Link to={`/company/jobs/${a.job.id}/preview`} className="inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-brand"><Briefcase size={13} /> {a.job.title}</Link>}
                </div>
              </div>
            </div>
            {a.resume && (
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={openResume} disabled={fileBusy} className="btn-primary"><FileText size={15} /> View CV</button>
                <button type="button" onClick={() => download(() => applicationsApi.downloadResume(a.id), a.resume.name)} disabled={fileBusy} className="btn-secondary"><Download size={15} /> Download</button>
              </div>
            )}
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-4 text-[14px] sm:grid-cols-2">
            <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Email</dt><dd className="mt-1"><a href={`mailto:${a.email}`} className="inline-flex items-center gap-1.5 text-brand hover:underline"><Mail size={14} /> {a.email}</a></dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Phone</dt><dd className="mt-1"><a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-brand hover:underline"><Phone size={14} /> {a.phone}</a></dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Education</dt><dd className="mt-1 inline-flex items-center gap-1.5 text-ink"><GraduationCap size={14} className="text-stone-400" /> {a.educationLabel}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">Institution</dt><dd className="mt-1 text-ink">{a.institution}{a.graduationYear ? ` · graduated ${a.graduationYear}` : ""}</dd></div>
          </dl>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <Reveal delay={40}>
            <Card className="p-6">
              <CardHeader icon={MessageSquareText} title="Application answers" subtitle="What they answered on the form" />
              {a.answers.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-stone-300 p-5 text-center text-[13.5px] text-stone-500">This role has no extra questions.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {a.answers.map((x) => (
                    <li key={x.key} className="rounded-2xl border border-[var(--line)] p-4">
                      <p className="text-[13.5px] font-semibold text-ink">{x.label}</p>
                      <div className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600"><AnswerValue answer={x} busy={fileBusy} onDownload={(key) => download(() => applicationsApi.downloadFile(a.id, key), x.value?.name)} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={80}>
            <Card className="p-6">
              <CardHeader icon={MessageSquareText} title="Team notes" subtitle="Only your team can see these" />
              {canChange && (
                <form onSubmit={submitNote} noValidate className="mt-5">
                  <label htmlFor="note-text" className="sr-only">Add a note</label>
                  <textarea id="note-text" rows={3} maxLength={LIMITS.note} value={note} onChange={(e) => { setNote(e.target.value); setNoteError(""); }} placeholder="Add a note for your team" aria-invalid={noteError ? "true" : undefined} className="field !h-auto resize-none py-3" />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[12px] text-stone-400">{note.length}/{LIMITS.note}</span>
                    <button type="submit" disabled={noteBusy} className="btn-primary !h-10">{noteBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Save note</button>
                  </div>
                  {noteError && <p role="alert" className="mt-1.5 text-[12.5px] text-red-600">{noteError}</p>}
                </form>
              )}
              {a.notes.length === 0 ? (
                <p className="mt-5 text-[13.5px] text-stone-500">No notes yet.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {a.notes.map((n) => (
                    <li key={n.id} className="rounded-2xl bg-stone-50 p-4">
                      <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{n.text}</p>
                      <p className="mt-2 text-[12px] text-stone-500">{n.author || "A former teammate"} · {relativeTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>

        <Reveal delay={120} className="min-w-0 lg:col-span-5">
          <Card className="p-6">
            <CardHeader icon={Sparkles} title="Status history" subtitle="Who moved them, and when" />
            <ol className="mt-5 space-y-5">
              {[...a.statusHistory].reverse().map((h, i, all) => (
                <li key={`${h.at}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand" />
                    {i < all.length - 1 && <span className="mt-1 w-px flex-1 bg-stone-200" />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-[13.5px] font-semibold text-ink">{h.from ? <>{statusLabel(h.from)} <span className="text-stone-400">→</span> {statusLabel(h.to)}</> : `Applied`}</p>
                    <p className="text-[12px] text-stone-500">{when(h.at)}{h.by ? ` · ${h.by}` : ""}</p>
                    {h.note && <p className="mt-1.5 whitespace-pre-line rounded-xl bg-stone-50 p-2.5 text-[13px] text-stone-600">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Reveal>
      </div>

      <CvAnalysisPanel applicationId={a.id} jobId={a.job?.id} memberRole={user?.memberRole} />

      <TechnicalInterviewPanel applicationId={a.id} memberRole={user?.memberRole} />

      {dialog && <StatusDialog title={`Change status of ${a.name}`} current={a.status} initial={dialog.initial} busy={busy} error={dialogError} onConfirm={changeStatus} onClose={() => !busy && setDialog(null)} />}
    </div>
  );
}
