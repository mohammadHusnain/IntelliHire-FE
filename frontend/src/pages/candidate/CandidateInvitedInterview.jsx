import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, FileText, MessageSquareText, ShieldCheck, Video } from "lucide-react";
import { Badge, Card, ProgressBar } from "@/components/app/primitives";

const SCREENING_PROMPTS = [
  "Tell us about a project or experience that best prepares you for this role.",
  "Describe a difficult decision you made in that work. What options did you consider?",
  "How did you know the outcome was successful, and what would you change next time?",
];
const TECHNICAL_PROMPTS = [
  "Describe how you would investigate a performance issue in a production service or application.",
  "Tell us about a technical trade-off you made. What constraints shaped your decision?",
  "How would you test and safely deploy a change that affects a critical user workflow?",
];

export default function CandidateInvitedInterview() {
  const { id } = useParams();
  const technical = id.startsWith("technical-");
  const prompts = technical ? TECHNICAL_PROMPTS : SCREENING_PROMPTS;
  const stageLabel = technical ? "Technical interview" : "Screening interview";
  const [state, setState] = useState("invited");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const updateAnswer = (value) => setAnswers((current) => current.map((answer, index) => index === step ? value : answer));
  const next = () => {
    if (!answers[step].trim()) { setError("Add a response before continuing, or type 'Skip' if you prefer not to answer."); return; }
    setError("");
    if (step < prompts.length - 1) setStep((current) => current + 1);
    else setState("complete");
  };

  if (state === "declined" || state === "complete") {
    const declined = state === "declined";
    return <main className="flex min-h-screen items-center justify-center bg-[#FAFAF9] p-5"><Card className="w-full max-w-lg p-7 text-center"><span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${declined ? "bg-stone-100 text-stone-500" : "bg-emerald-50 text-emerald-700"}`}>{declined ? <Check size={22} /> : <CheckCircle2 size={25} />}</span><h1 className="display mt-4 text-[26px]">{declined ? "Invitation declined" : "Session submitted"}</h1><p className="mt-2 text-[14px] leading-relaxed text-stone-500">{declined ? "Your response is recorded in this UI preview." : "Your responses have been captured in this local preview. A confirmation and report status will appear here after integration."}</p>{!declined && <Badge tone="neutral" className="mt-4"><Clock3 size={12} /> Report pending</Badge>}<div className="mt-6"><Link to="/candidate/dashboard" className="btn-secondary">Return to dashboard</Link></div></Card></main>;
  }

  return <main className="min-h-screen bg-[#FAFAF9] text-ink">
    <header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-white px-4 sm:px-8"><Link to="/candidate/dashboard" className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">I</span> IntelliHire</Link><Badge tone="brand">Employer invitation</Badge></header>
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-8 sm:py-10"><Link to="/candidate/dashboard" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-stone-500 hover:text-ink"><ArrowLeft size={14} /> Dashboard</Link>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-5"><div><p className="eyebrow">Private hiring process · ref {id}</p><h1 className="display mt-2 text-[30px] sm:text-[36px]">{state === "invited" ? "Interview invitation" : "Interview session"}</h1><p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-stone-500">This is an employer-led interview, separate from your private practice sessions.</p></div>
        {state === "invited" ? <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[12px] font-medium text-stone-500">Interview stage</p><h2 className="mt-1 text-[20px] font-semibold text-ink">{stageLabel}</h2><p className="mt-1 text-[13px] text-stone-500">Frontend Developer · Acme Hiring</p></div><Badge tone="warning"><Clock3 size={12} /> Response requested</Badge></div><div className="my-5 grid gap-3 border-y border-[var(--line)] py-4 sm:grid-cols-2"><Info icon={Video} label="Format" value="Structured text session" /><Info icon={Clock3} label="Estimated time" value="About 20 minutes" /><Info icon={FileText} label="Questions" value="3 open-response prompts" /><Info icon={ShieldCheck} label="Privacy" value="Visible to the hiring team" /></div><h3 className="text-[13px] font-semibold text-ink">Before you begin</h3><ul className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-stone-600"><li>• Find a quiet place and allow enough time to finish in one sitting.</li><li>• Your answers are shared with the hiring team for this application only.</li><li>• This preview records typed answers only; microphone and camera are not activated.</li></ul><div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4"><button type="button" onClick={() => setState("declined")} className="btn-secondary">Decline invitation</button><button type="button" onClick={() => setState("accepted")} className="btn-primary">Accept and continue <ArrowRight size={15} /></button></div></Card> : <Card className="p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] font-medium text-stone-500">{stageLabel}</p><h2 className="mt-1 text-[16px] font-semibold text-ink">{state === "accepted" ? "Ready when you are" : `Question ${step + 1} of ${prompts.length}`}</h2></div>{state === "session" && <Badge tone="neutral">{Math.round((step / prompts.length) * 100)}% complete</Badge>}</div>{state === "accepted" ? <><p className="mt-3 text-[13px] leading-relaxed text-stone-600">You can begin now. Progress is not saved outside this page preview, so plan to complete in one sitting.</p><button type="button" onClick={() => setState("session")} className="btn-primary mt-5"><Video size={15} /> Start interview</button></> : <><ProgressBar value={((step + 1) / prompts.length) * 100} className="mt-4 h-1.5" /><div className="mt-6 rounded-xl bg-stone-50 p-4 sm:p-5"><p className="text-[11px] font-semibold uppercase text-stone-400">Prompt {step + 1}</p><p className="mt-2 text-[16px] font-medium leading-relaxed text-ink">{prompts[step]}</p></div><label className="mt-5 block text-[12px] font-semibold text-stone-600">Your response<textarea rows="7" value={answers[step]} onChange={(event) => updateAnswer(event.target.value)} placeholder="Write your response here..." className="mt-2 w-full resize-y rounded-lg border border-[var(--line)] bg-white p-3 text-[13px] font-normal leading-relaxed text-ink outline-none focus:border-brand" /></label>{error && <p role="alert" className="mt-2 text-[12px] text-red-600">{error}</p>}<div className="mt-5 flex justify-between gap-2 border-t border-[var(--line)] pt-4"><button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="btn-secondary disabled:opacity-40">Previous</button><button type="button" onClick={next} className="btn-primary">{step === prompts.length - 1 ? "Submit session" : "Save and continue"} <ArrowRight size={15} /></button></div></>}</Card>}
      </div><aside className="space-y-4"><Card className="p-4"><h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><MessageSquareText size={15} className="text-brand" /> Invitation details</h2><div className="mt-3 space-y-3 text-[12px]"><Info icon={Clock3} label="Status" value={state === "invited" ? "Awaiting response" : state === "accepted" ? "Accepted" : "In session"} /><Info icon={Clock3} label="Due" value="Check your invitation email" /></div></Card><Card className="border-amber-200 bg-amber-50/60 p-4"><p className="text-[12px] font-semibold text-amber-800">UI preview</p><p className="mt-1 text-[11.5px] leading-relaxed text-amber-800/80">Answers and invitation state remain in this browser session and are not sent to the employer yet.</p></Card></aside></div>
    </div>
  </main>;
}

function Info({ icon: Icon, label, value }) {
  return <div className="flex items-start gap-2.5"><Icon size={14} className="mt-0.5 shrink-0 text-stone-400" /><span><span className="block text-[10.5px] text-stone-400">{label}</span><span className="mt-0.5 block text-[12px] font-medium text-stone-700">{value}</span></span></div>;
}
