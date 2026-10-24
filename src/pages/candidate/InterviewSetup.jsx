import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, Code2, FileText, Headphones, Lightbulb,
  MessageCircle, Mic, MicOff, Target, Volume2,
} from "lucide-react";
import { Badge, Card, PageHeader, Segmented, Toggle } from "@/components/app/primitives";
import Reveal from "@/components/shared/Reveal";
import RolePicker from "@/components/candidate/RolePicker";
import useMicrophone from "@/hooks/useMicrophone";
import { speechRecognitionSupported } from "@/hooks/useSpeechRecognition";
import { useCandidateRecord } from "@/store/candidateStore";
import { DIFFICULTIES, INTERVIEW_TYPES, LENGTHS, buildQuestions } from "@/lib/interview/questionBank";
import { saveActive } from "@/lib/interview/activeSession";

const TYPE_ICON = { general: MessageCircle, technical: Code2, "role-specific": Target };
const TYPE_MIX = { general: "Behavioural only", technical: "Technical + behavioural", "role-specific": "Scenarios + technical" };

function Step({ n, title, subtitle, children, delay = 0, done }) {
  return (
    <Reveal delay={delay}>
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-300 ${
              done ? "bg-brand text-white" : "bg-stone-100 text-stone-500"
            }`}
          >
            {done ? <Check size={15} strokeWidth={3} /> : n}
          </span>
          <div>
            <h2 className="font-sans text-[16px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>}
          </div>
        </div>
        {children}
      </Card>
    </Reveal>
  );
}

function MicCheck() {
  const mic = useMicrophone();
  const bars = 24;
  const lit = Math.round(mic.level * bars);
  const state = {
    idle: { tone: "neutral", label: "Not tested" },
    requesting: { tone: "warning", label: "Waiting for permission" },
    active: { tone: "success", label: mic.level > 0.06 ? "Hearing you" : "Working, say something" },
    denied: { tone: "danger", label: "Access blocked" },
    unsupported: { tone: "danger", label: "Not supported" },
    error: { tone: "danger", label: "No microphone found" },
  }[mic.status];

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-stone-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${mic.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-white text-stone-500 shadow-sm"}`}>
            {mic.status === "denied" || mic.status === "error" ? <MicOff size={18} /> : <Mic size={18} />}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-ink">Microphone</p>
            <Badge tone={state.tone} className="mt-1">{state.label}</Badge>
          </div>
        </div>
        {mic.status === "active" ? (
          <button type="button" onClick={mic.stop} className="btn-secondary">
            Stop test
          </button>
        ) : (
          <button type="button" onClick={mic.start} disabled={mic.status === "unsupported" || mic.status === "requesting"} className="btn-secondary">
            <Headphones size={15} /> Test microphone
          </button>
        )}
      </div>
      <div className="mt-4 flex h-8 items-end gap-[3px]" aria-hidden>
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full transition-all duration-75 ${i < lit ? (i > bars * 0.8 ? "bg-amber-500" : "bg-brand") : "bg-stone-200"}`}
            style={{ height: `${30 + (i / bars) * 70}%` }}
          />
        ))}
      </div>
      {mic.status === "denied" && (
        <p className="mt-3 flex items-start gap-2 text-[12.5px] text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Allow microphone access from the padlock icon in your address bar, then test again. You can still type your answers.
        </p>
      )}
      {!speechRecognitionSupported && (
        <p className="mt-3 text-[12.5px] text-stone-500">
          Live transcription isn&apos;t available in this browser. Use Chrome or Edge for spoken answers, or type them in the room.
        </p>
      )}
    </div>
  );
}

export default function InterviewSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, sessions, prefs } = useCandidateRecord();

  const initialType = INTERVIEW_TYPES.some((t) => t.id === params.get("type")) ? params.get("type") : prefs.interview.type;
  const [type, setType] = useState(initialType);
  const [role, setRole] = useState(params.get("role") || profile.targetRole || "");
  const [difficulty, setDifficulty] = useState(params.get("difficulty") || prefs.interview.difficulty);
  const [length, setLength] = useState(Number(params.get("length")) || prefs.interview.length);
  const [useCV, setUseCV] = useState(!!profile.cv);
  const [readAloud, setReadAloud] = useState(prefs.interview.readAloud);
  const [autoTranscribe, setAutoTranscribe] = useState(prefs.interview.autoTranscribe && speechRecognitionSupported);
  const [seed] = useState(() => Date.now());
  const [roleError, setRoleError] = useState(false);

  const chooseRole = (r) => {
    setRole(r);
    setRoleError(false);
  };

  const recentRoles = useMemo(() => [...new Set([profile.targetRole, ...[...sessions].reverse().map((s) => s.role)].filter(Boolean))].slice(0, 4), [profile.targetRole, sessions]);
  const minutes = LENGTHS.find((l) => l.id === length)?.minutes || 14;
  const preview = useMemo(
    () => (role ? buildQuestions({ role, type, difficulty, count: length, skills: useCV ? profile.skills : [], seed }) : []),
    [role, type, difficulty, length, useCV, profile.skills, seed],
  );

  const start = () => {
    if (!role) {
      setRoleError(true);
      document.getElementById("role-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    saveActive({
      config: { id: `s-${seed}`, role, type, difficulty, count: length, useCV, readAloud, autoTranscribe, seed },
      questions: preview,
      answers: preview.map(() => ({ text: "", durationSec: 0 })),
      index: 0,
      startedAt: Date.now(),
    });
    navigate("/candidate/interview/room");
  };

  return (
    <div>
      <PageHeader
        eyebrow="New interview"
        title={<>Set up your <em>practice</em> session</>}
        subtitle="Choose the interview you want to rehearse. Every answer is analysed the moment you finish."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Step n={1} title="Interview type" subtitle="What kind of questions do you want to practise?" done>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Interview type">
              {INTERVIEW_TYPES.map((t) => {
                const Icon = TYPE_ICON[t.id];
                const on = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setType(t.id)}
                    className={`group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-300 ease-[var(--ease-premium)] ${
                      on
                        ? "border-brand bg-brand-soft shadow-[0_14px_30px_-18px_rgba(240,78,35,0.65)]"
                        : "border-[var(--line)] bg-white hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_12px_24px_-18px_rgba(13,13,13,0.3)]"
                    }`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 ${on ? "bg-brand text-white" : "bg-stone-100 text-stone-500 group-hover:text-ink"}`}>
                      <Icon size={19} />
                    </span>
                    <span className={`mt-3 text-[15px] font-semibold ${on ? "text-brand" : "text-ink"}`}>{t.title}</span>
                    <span className="mt-1 text-[12.5px] leading-snug text-stone-500">{t.description}</span>
                    <span className="mt-3 text-[11.5px] font-semibold uppercase tracking-wide text-stone-400">{TYPE_MIX[t.id]}</span>
                    {on && (
                      <span className="animate-pop absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={2} title="Target role" subtitle="Questions and skill matching adapt to this role." done={!!role} delay={60}>
            <RolePicker id="role-picker" value={role} onChange={chooseRole} invalid={roleError} />
            {roleError && <p className="mt-1.5 text-[12.5px] text-red-600 animate-fade-in">Choose the role you are preparing for.</p>}
            {recentRoles.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-stone-500">Quick pick:</span>
                {recentRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => chooseRole(r)}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-all ${
                      role === r ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600 hover:border-stone-300 hover:text-ink"
                    }`}
                  >
                    {r}
                    {r === profile.targetRole && role !== r && <span className="ml-1 text-brand">· target</span>}
                  </button>
                ))}
              </div>
            )}
          </Step>

          <Step n={3} title="Level and length" subtitle={DIFFICULTIES.find((d) => d.id === difficulty)?.hint} done delay={120}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[13px] font-medium text-stone-700">Difficulty</p>
                <Segmented
                  ariaLabel="Difficulty"
                  className="w-full"
                  value={difficulty}
                  onChange={setDifficulty}
                  options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
                />
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-stone-700">Length</p>
                <Segmented
                  ariaLabel="Length"
                  className="w-full"
                  value={length}
                  onChange={setLength}
                  options={LENGTHS.map((l) => ({ value: l.id, label: `${l.id} Qs` }))}
                />
              </div>
            </div>
          </Step>

          <Step n={4} title="Personalise" subtitle="Fine-tune how the interview runs." done delay={180}>
            <ul className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              <li className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <FileText size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">Match questions to my CV</p>
                  <p className="truncate text-[12.5px] text-stone-500">
                    {profile.cv ? `Uses your skills and ${profile.cv.name}` : (
                      <>
                        No CV yet. <Link to="/candidate/profile" className="link-brand">Upload one</Link>
                      </>
                    )}
                  </p>
                </div>
                <Toggle checked={useCV} onChange={setUseCV} disabled={!profile.cv} label="Match questions to my CV" />
              </li>
              <li className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <Volume2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">Read questions aloud</p>
                  <p className="text-[12.5px] text-stone-500">The interviewer speaks each question, like a real call.</p>
                </div>
                <Toggle checked={readAloud} onChange={setReadAloud} label="Read questions aloud" />
              </li>
              <li className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <Mic size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">Live transcription</p>
                  <p className="text-[12.5px] text-stone-500">
                    {speechRecognitionSupported ? "Your spoken answer is transcribed as you talk." : "Not available in this browser. You can type answers."}
                  </p>
                </div>
                <Toggle checked={autoTranscribe} onChange={setAutoTranscribe} disabled={!speechRecognitionSupported} label="Live transcription" />
              </li>
            </ul>
          </Step>

          <Step n={5} title="Check your setup" subtitle="Optional, but it takes ten seconds." delay={240}>
            <MicCheck />
          </Step>
        </div>

        <div className="min-w-0">
          <Reveal delay={120} className="lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <div className="relative bg-ink p-6 text-white">
                <div aria-hidden className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50" />
                <p className="relative text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50">Your session</p>
                <p className="relative mt-2 font-display text-[24px] font-medium leading-tight tracking-[-0.02em]">{role || "Choose a role"}</p>
                <div className="relative mt-4 flex flex-wrap gap-2 text-[12px]">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{INTERVIEW_TYPES.find((t) => t.id === type)?.title}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{DIFFICULTIES.find((d) => d.id === difficulty)?.label}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                    <Clock size={12} /> ~{minutes} min
                  </span>
                </div>
              </div>

              <div className="p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-stone-400">First questions</p>
                {preview.length ? (
                  <ol className="mt-3 space-y-2.5">
                    {preview.slice(0, 3).map((q, i) => (
                      <li key={`${q.text}-${i}`} className="flex gap-2.5 text-[13px] leading-snug text-stone-600 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-500">{i + 1}</span>
                        {q.text}
                      </li>
                    ))}
                    {preview.length > 3 && <li className="pl-7 text-[12.5px] text-stone-400">+ {preview.length - 3} more</li>}
                  </ol>
                ) : (
                  <p className="mt-3 text-[13px] text-stone-500">Pick a target role to preview your questions.</p>
                )}

                <button type="button" onClick={start} className="btn-primary btn-lg mt-6 w-full">
                  Begin interview <ArrowRight size={18} className="btn-arrow" />
                </button>
                <Link to="/candidate/dashboard" className="btn-secondary mt-2 w-full">
                  Cancel
                </Link>

                <div className="mt-6 rounded-2xl bg-stone-50 p-4">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <Lightbulb size={15} className="text-brand" /> Before you start
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {["Find a quiet room and use headphones if you can.", "Answer in one to two minutes using STAR.", "Press Space to start and stop recording."].map((t) => (
                      <li key={t} className="flex gap-2 text-[12.5px] leading-snug text-stone-600">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
