import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, CircleAlert, ClipboardCheck, Clock3, FileText, Mail, MessageSquareText, Plus, Search, Send, Video, X } from "lucide-react";
import { Avatar } from "@/components/app/HeaderMenus";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { useCompanyRecord } from "@/store/companyStore";
import { toast } from "@/store/toastStore";

const STATES = ["Invitation sent", "Accepted", "In progress", "Completed", "Expired"];
const DEMO_QUESTIONS = [
  "Walk me through a recent project that is relevant to this role.",
  "What trade-offs did you make, and how did you evaluate the result?",
  "What would you improve if you revisited that work today?",
];

export default function CompanyInterviews() {
  const record = useCompanyRecord();
  const [mode, setMode] = useState("screening");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ candidateId: "", jobId: "", dueDate: "", note: "" });
  const [localInvites, setLocalInvites] = useState([]);

  const rows = useMemo(() => {
    const base = record.applicants.map((applicant, index) => {
      const score = mode === "screening" ? applicant.screeningScore : applicant.technicalScore;
      return {
        ...applicant,
        score: score ?? null,
        state: STATES[index % STATES.length],
        duration: `${18 + (index * 7) % 21} min`,
        updated: index < 2 ? "Today" : `${index + 1} days ago`,
      };
    });
    const all = [...localInvites.filter((item) => item.mode === mode), ...base];
    return all.filter((item) => (status === "all" || item.state === status) && (!query || `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase())));
  }, [record.applicants, mode, status, query, localInvites]);
  const completed = rows.filter((row) => row.state === "Completed").length;
  const pending = rows.filter((row) => row.state === "Invitation sent").length;
  const inProgress = rows.filter((row) => row.state === "In progress").length;

  const sendInvite = (event) => {
    event.preventDefault();
    const person = record.applicants.find((item) => item.id === invite.candidateId);
    const role = record.jobs.find((item) => item.id === invite.jobId);
    if (!person || !role) return;
    const entry = { ...person, jobTitle: role.title, state: "Invitation sent", score: null, dueDate: invite.dueDate, note: invite.note, mode, id: `${mode}-${Date.now()}` };
    setLocalInvites((current) => [entry, ...current]);
    setInviteOpen(false);
    setInvite({ candidateId: "", jobId: "", dueDate: "", note: "" });
    toast({ title: "Invitation prepared", message: "This preview does not send email or create an API invitation." });
  };

  return <div className="space-y-6">
        <PageHeader eyebrow="Hiring · Interview operations" title={<>Interview <em>center</em></>} subtitle="Manage employer-led screening and technical interview invitations, sessions, and reports." actions={<button type="button" disabled={!record.applicants.length} title={!record.applicants.length ? "Add an applicant before creating an interview invitation" : undefined} onClick={() => setInviteOpen(true)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /> Invite candidate</button>} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-[var(--line)] bg-stone-50 p-1" role="tablist" aria-label="Interview stage">{[{ key: "screening", label: "Screening" }, { key: "technical", label: "Technical" }].map((item) => <button key={item.key} role="tab" aria-selected={mode === item.key} type="button" onClick={() => setMode(item.key)} className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${mode === item.key ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-ink"}`}>{item.label}</button>)}</div><div className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-[12px] text-stone-600"><Video size={15} className="text-brand" />{mode === "screening" ? "Experience, communication, and motivation" : "Role-specific problem solving and skills"}</div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatTile icon={ClipboardCheck} label="In this stage" value={rows.length} /><StatTile icon={Mail} label="Invitations sent" value={pending} delay={50} /><StatTile icon={Video} label="In progress" value={inProgress} delay={100} /><StatTile icon={FileText} label="Reports ready" value={completed} delay={150} /></div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="text-[15px] font-semibold text-ink">{mode === "screening" ? "Screening queue" : "Technical interview queue"}</h2><p className="mt-1 text-[12.5px] text-stone-500">Invitations and interview sessions for your active roles</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Candidate name" className="h-10 w-full rounded-lg border border-[var(--line)] pl-9 pr-3 text-[13px] outline-none focus:border-brand sm:w-48" /></label><select aria-label="Filter by invitation state" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] text-stone-600"><option value="all">All states</option>{STATES.map((state) => <option key={state}>{state}</option>)}</select></div></div>
      {rows.length ? <div className="divide-y divide-[var(--line)]">{rows.map((row) => <button key={row.id} type="button" onClick={() => setSelected(row)} className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-stone-50 sm:px-5"><Avatar name={row.name} size={38} /><span className="min-w-[170px] flex-1"><span className="block text-[13px] font-semibold text-ink">{row.name}</span><span className="mt-0.5 block text-[12px] text-stone-500">{row.jobTitle || record.jobs.find((job) => job.id === row.jobId)?.title || "Role"}</span></span><span className="min-w-[135px] text-[12.5px] text-stone-500">{row.updated || (row.dueDate ? `Due ${row.dueDate}` : "Invitation sent")}</span><StateBadge state={row.state} /><span className="w-16 text-right text-[13px] font-semibold tabular-nums text-ink">{row.score == null ? "—" : `${row.score}/100`}</span><ChevronRight size={16} className="text-stone-400" /></button>)}</div> : <div className="p-6"><EmptyState icon={ClipboardCheck} title="No interviews in this view" message="Change the filter or invite an applicant to this interview stage." action={<button type="button" onClick={() => setInviteOpen(true)} className="btn-secondary"><Plus size={15} /> Create invitation</button>} /></div>}
      <div className="border-t border-[var(--line)] px-5 py-3 text-[11.5px] text-stone-400">Interview state and reports shown here are sample UI data; no invitations are sent.</div>
    </Card>

    {inviteOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><form onSubmit={sendInvite} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">{mode} interview</p><h2 className="mt-1 text-[20px] font-semibold text-ink">Invite a candidate</h2><p className="mt-1 text-[13px] text-stone-500">Create a preview invitation for a role and interview stage.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="Close invitation" className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X size={18} /></button></div><div className="space-y-4"><label className="block text-[12px] font-semibold text-stone-600">Candidate<select required value={invite.candidateId} onChange={(e) => setInvite((v) => ({ ...v, candidateId: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] font-normal text-ink"><option value="">Choose an applicant</option>{record.applicants.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}</select></label><label className="block text-[12px] font-semibold text-stone-600">Role<select required value={invite.jobId} onChange={(e) => setInvite((v) => ({ ...v, jobId: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] font-normal text-ink"><option value="">Choose a role</option>{record.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label className="block text-[12px] font-semibold text-stone-600">Response deadline<input type="date" value={invite.dueDate} onChange={(e) => setInvite((v) => ({ ...v, dueDate: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] font-normal text-ink" /></label><label className="block text-[12px] font-semibold text-stone-600">Message<textarea rows="3" value={invite.note} onChange={(e) => setInvite((v) => ({ ...v, note: e.target.value }))} placeholder="Add a short note for the candidate" className="mt-1.5 w-full resize-y rounded-lg border border-[var(--line)] px-3 py-2.5 text-[13px] font-normal text-ink outline-none focus:border-brand" /></label></div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--line)] pt-4"><button type="button" onClick={() => setInviteOpen(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary"><Send size={15} /> Prepare invite</button></div></form></div>}

    {selected && <div className="fixed inset-0 z-[80] flex justify-end bg-ink/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-label="Interview session detail" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div className="flex items-center gap-3"><Avatar name={selected.name} size={42} /><div><h2 className="text-[15px] font-semibold text-ink">{selected.name}</h2><p className="text-[12px] text-stone-500">{selected.jobTitle || record.jobs.find((job) => job.id === selected.jobId)?.title || "Applicant"}</p></div></div><button type="button" aria-label="Close session detail" onClick={() => setSelected(null)} className="icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X size={18} /></button></header><div className="space-y-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><StateBadge state={selected.state} /><span className="text-[12px] text-stone-500">{selected.duration || "Awaiting response"} · {mode} interview</span></div>{selected.state === "Completed" ? <><Card className="bg-stone-50 p-4"><div className="flex items-center justify-between"><div><p className="text-[12px] text-stone-500">Interview summary score</p><p className="mt-1 text-[13px] text-stone-600">Based on the completed sample report</p></div><strong className="text-3xl tabular-nums text-ink">{selected.score ?? 78}<span className="text-sm font-normal text-stone-400">/100</span></strong></div></Card><section><h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink"><MessageSquareText size={15} className="text-brand" /> Session transcript</h3><div className="space-y-3">{DEMO_QUESTIONS.map((question, index) => <div key={question} className="rounded-lg border border-[var(--line)] p-3"><p className="text-[11px] font-semibold uppercase text-stone-400">Question {index + 1}</p><p className="mt-1 text-[12.5px] text-stone-700">{question}</p><p className="mt-2 rounded-md bg-stone-50 p-2.5 text-[12px] leading-relaxed text-stone-500">Candidate response summary is available in the completed session report.</p></div>)}</div></section><section><h3 className="mb-2 text-[13px] font-semibold text-ink">Report state</h3><p className="text-[12.5px] text-stone-600">Interview completed. AI-generated assessment and recommendation will be supplied by the interview service after integration.</p></section></> : <Card className="p-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Clock3 size={18} /></div><h3 className="text-[14px] font-semibold text-ink">{selected.state === "Invitation sent" ? "Waiting for candidate" : selected.state}</h3><p className="mt-1 text-[12.5px] leading-relaxed text-stone-500">Session details, invitation status, and reminder controls will be connected to the interview API later.</p>{selected.state === "Invitation sent" && <a href={`/candidate/interviews/${selected.id}`} className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-brand">Preview candidate invitation <ArrowRight size={14} /></a>}</Card>}<div className="rounded-lg border border-[var(--line)] p-4"><p className="flex items-center gap-2 text-[12px] font-semibold text-stone-700"><CircleAlert size={14} className="text-amber-600" /> Employer-only interview record</p><p className="mt-1 text-[11.5px] text-stone-500">Do not expose interview notes or evaluation scores in candidate tracking.</p></div></div></aside></div>}
  </div>;
}

function StateBadge({ state }) {
  const tone = state === "Completed" ? "success" : state === "In progress" ? "brand" : state === "Expired" ? "danger" : state === "Accepted" ? "warning" : "neutral";
  return <Badge tone={tone}>{state}</Badge>;
}
