import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Keyboard, Loader2, Mic, RotateCcw, SkipForward,
  Sparkles, Square, Trash2, Volume2, X,
} from "lucide-react";
import IntelliHireLogo from "@/components/shared/IntelliHireLogo";
import useMicrophone from "@/hooks/useMicrophone";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";
import { useCandidateActions, useCandidateRecord } from "@/store/candidateStore";
import { clearActive, loadActive, saveActive } from "@/lib/interview/activeSession";
import { evaluateAnswer, summarise } from "@/lib/interview/evaluate";
import { skillsForRole } from "@/lib/interview/questionBank";
import { TYPE_LABEL } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const KIND_LABEL = { general: "Behavioural", technical: "Technical", "role-specific": "Role scenario" };
const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Orb({ state, level }) {
  const active = state === "speaking" || state === "listening";
  const scale = state === "listening" ? 1 + level * 0.35 : 1;
  return (
    <div className="relative mx-auto flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
      {active &&
        [0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border border-brand/30"
            style={{ animation: `orbPulse 2.4s ease-out ${i * 0.8}s infinite` }}
          />
        ))}
      <span
        className="absolute inset-4 rounded-full bg-[radial-gradient(circle_at_30%_25%,#FF9A6B,#F04E23_55%,#B8350F)] shadow-[0_30px_60px_-20px_rgba(240,78,35,0.75)] transition-transform duration-100"
        style={{ transform: `scale(${scale})` }}
      />
      <span className="absolute inset-4 rounded-full bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.25),transparent_45%)]" />
      <span className="relative flex items-center gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-white/90"
            style={{
              height: state === "speaking" ? 18 : state === "listening" ? 6 + level * 26 * (1 - Math.abs(i - 2) * 0.25) : 6,
              animation: state === "speaking" ? `floatY ${0.6 + i * 0.12}s ease-in-out ${i * -0.1}s infinite` : undefined,
              transition: "height 90ms linear",
            }}
          />
        ))}
      </span>
    </div>
  );
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="animate-backdrop-in absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="animate-modal-in relative w-full max-w-[440px] rounded-3xl bg-white p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,0.5)] sm:p-7">{children}</div>
    </div>,
    document.body,
  );
}

const ANALYSIS_STEPS = ["Reviewing your answers", "Scoring structure and delivery", "Matching skills to the role", "Writing your recommendations"];

function Analysing({ step }) {
  return createPortal(
    <div className="fixed inset-0 z-[160] flex flex-col items-center justify-center bg-[#FAFAF9]/95 px-6 backdrop-blur-md animate-fade-in">
      <Orb state="speaking" level={0} />
      <h2 className="display mt-8 text-center text-[28px]">Analysing your interview</h2>
      <ul className="mt-6 w-full max-w-xs space-y-3">
        {ANALYSIS_STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-[14px] transition-all duration-500 ${i <= step ? "text-ink opacity-100" : "text-stone-400 opacity-60"}`}>
            {i < step ? (
              <CheckCircle2 size={18} className="text-emerald-500 animate-pop" />
            ) : i === step ? (
              <Loader2 size={18} className="animate-spin text-brand" />
            ) : (
              <span className="h-[18px] w-[18px] rounded-full border-2 border-stone-200" />
            )}
            {s}
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

export default function InterviewRoom() {
  const navigate = useNavigate();
  const { profile } = useCandidateRecord();
  const { saveSession } = useCandidateActions();
  const [active, setActive] = useState(loadActive);

  const mic = useMicrophone();
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(() => (active ? Math.round((Date.now() - active.startedAt) / 1000) : 0));
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [analysing, setAnalysing] = useState(-1);
  const textRef = useRef(null);

  const readAloud = !!active?.config.readAloud;
  const autoTranscribe = !!active?.config.autoTranscribe;
  const index = active?.index ?? 0;
  const question = active?.questions[index];
  const answer = active?.answers[index] || { text: "", durationSec: 0 };
  const total = active?.questions.length || 0;
  const isLast = index === total - 1;
  const answeredCount = active?.answers.filter((a) => a.text.trim().split(/\s+/).filter(Boolean).length >= 3).length || 0;

  const update = useCallback((fn) => {
    setActive((prev) => {
      const next = fn(prev);
      saveActive(next);
      return next;
    });
  }, []);

  const appendText = useCallback(
    (phrase) => {
      if (!phrase) return;
      update((prev) => {
        const answers = [...prev.answers];
        const cur = answers[prev.index];
        answers[prev.index] = { ...cur, text: cur.text ? `${cur.text.trim()} ${phrase}` : phrase };
        return { ...prev, answers };
      });
    },
    [update],
  );

  const speech = useSpeechRecognition({ onFinal: appendText });

  // Global elapsed timer
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - active.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Per-answer timer while recording
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      update((prev) => {
        const answers = [...prev.answers];
        answers[prev.index] = { ...answers[prev.index], durationSec: answers[prev.index].durationSec + 1 };
        return { ...prev, answers };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [recording, update]);

  const speak = useCallback(
    (text) => {
      if (!ttsSupported || !readAloud) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [readAloud],
  );

  // Ask each new question
  useEffect(() => {
    if (!question) return;
    const t = setTimeout(() => speak(question.text), 350);
    return () => {
      clearTimeout(t);
      if (ttsSupported) window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [question, speak]);

  // Leave protection
  useEffect(() => {
    if (!active || analysing >= 0) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active, analysing]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    speech.stop();
    mic.stop();
  }, [speech, mic]);

  const startRecording = useCallback(async () => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
    const ok = await mic.start();
    if (!ok) {
      toast({ type: "warning", title: "Microphone unavailable", message: "Type your answer in the box instead. It is scored the same way." });
      textRef.current?.focus();
      return;
    }
    if (autoTranscribe) speech.start();
    setRecording(true);
  }, [mic, speech, autoTranscribe]);

  const toggleRecording = useCallback(() => (recording ? stopRecording() : startRecording()), [recording, stopRecording, startRecording]);

  const goTo = useCallback(
    (i) => {
      stopRecording();
      update((prev) => ({ ...prev, index: i }));
    },
    [stopRecording, update],
  );

  const finish = useCallback(
    async (answersOverride) => {
      stopRecording();
      if (ttsSupported) window.speechSynthesis.cancel();
      const snapshot = answersOverride || active.answers;
      const skills = [...new Set([...(active.config.useCV ? profile.skills : []), ...skillsForRole(active.config.role)])];
      const results = active.questions.map((q, i) => evaluateAnswer({ ...snapshot[i], kind: q.kind, skills }));
      const summary = summarise(results);
      for (let s = 0; s < ANALYSIS_STEPS.length; s++) {
        setAnalysing(s);
        await new Promise((r) => setTimeout(r, 520));
      }
      const completedAt = Date.now();
      const session = {
        id: active.config.id,
        role: active.config.role,
        type: active.config.type,
        difficulty: active.config.difficulty,
        useCV: active.config.useCV,
        createdAt: active.startedAt,
        completedAt,
        durationSec: Math.max(1, Math.round((completedAt - active.startedAt) / 1000)),
        questions: active.questions,
        answers: snapshot,
        results,
        summary,
      };
      saveSession(session);
      clearActive();
      navigate(`/candidate/report/${session.id}`, { replace: true, state: { fresh: true } });
    },
    [active, profile.skills, saveSession, navigate, stopRecording],
  );

  const next = useCallback(() => (isLast ? finish() : goTo(index + 1)), [isLast, finish, goTo, index]);

  // Keyboard: Space toggles recording, Ctrl/Cmd+Enter advances
  useEffect(() => {
    const onKey = (e) => {
      if (confirmEnd || analysing >= 0) return;
      const typing = e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
      if (e.code === "Space" && !typing) {
        e.preventDefault();
        toggleRecording();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRecording, next, confirmEnd, analysing]);

  const setText = (text) =>
    update((prev) => {
      const answers = [...prev.answers];
      answers[prev.index] = { ...answers[prev.index], text };
      return { ...prev, answers };
    });

  const discard = () => {
    stopRecording();
    clearActive();
    navigate("/candidate/dashboard", { replace: true });
  };

  const orbState = speaking ? "speaking" : recording ? "listening" : "idle";
  const words = useMemo(() => answer.text.trim().split(/\s+/).filter(Boolean).length, [answer.text]);

  if (!active) return <Navigate to="/candidate/interview/setup" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAF9] font-sans text-stone-700 antialiased">
      <div aria-hidden className="bg-dot-grid pointer-events-none fixed inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]" />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#FAFAF9]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <IntelliHireLogo className="h-8 w-8 shrink-0" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13.5px] font-semibold text-ink">{active.config.role}</p>
              <p className="text-[12px] text-stone-500">{TYPE_LABEL[active.config.type]} interview</p>
            </div>
          </div>

          <div className="mx-auto flex min-w-0 max-w-md flex-1 flex-col items-center gap-1.5">
            <p className="text-[12.5px] font-semibold text-stone-600">
              Question <span className="text-ink">{index + 1}</span> of {total}
            </p>
            <div className="flex w-full gap-1">
              {active.questions.map((q, i) => {
                const done = active.answers[i].text.trim().split(/\s+/).filter(Boolean).length >= 3;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to question ${i + 1}`}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i === index ? "bg-brand" : done ? "bg-ink/70" : "bg-stone-200 hover:bg-stone-300"}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-lg bg-white px-2.5 py-1.5 font-mono text-[13px] tabular-nums text-stone-600 shadow-[0_1px_2px_rgba(13,13,13,0.06)] xs:block">{fmt(elapsed)}</span>
            <button type="button" onClick={() => setConfirmEnd(true)} className="btn-secondary !h-9 !px-3.5">
              <X size={15} /> <span className="hidden sm:inline">End</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8 lg:py-10">
        {/* Interviewer */}
        <section className="flex min-w-0 flex-col">
          <div key={question.id} className="animate-fade-in-up rounded-[24px] border border-[var(--line)] bg-white p-6 text-center shadow-[0_1px_2px_rgba(13,13,13,0.03)] sm:p-8">
            <Orb state={orbState} level={mic.level} />
            <p className="mt-5 text-[13px] font-semibold text-ink">Ava · AI interviewer</p>
            <p className="mt-0.5 text-[12.5px] text-stone-500" aria-live="polite">
              {speaking ? "Asking the question…" : recording ? "Listening to your answer" : answer.text ? "Answer captured. Continue when ready." : "Your turn. Press Space or the mic to answer."}
            </p>
            <div className="mt-6 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-semibold text-brand">{KIND_LABEL[question.kind]}</span>
                {ttsSupported && active.config.readAloud && (
                  <button type="button" onClick={() => speak(question.text)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-stone-500 hover:text-brand">
                    <Volume2 size={14} /> Repeat
                  </button>
                )}
              </div>
              <h1 className="display mt-4 text-[24px] leading-[1.25] sm:text-[28px]">{question.text}</h1>
            </div>
          </div>
          <p className="mt-4 hidden items-center justify-center gap-4 text-[12px] text-stone-400 lg:flex">
            <span className="inline-flex items-center gap-1.5"><Keyboard size={13} /> <kbd className="font-semibold text-stone-500">Space</kbd> record</span>
            <span><kbd className="font-semibold text-stone-500">Ctrl Enter</kbd> next question</span>
          </p>
        </section>

        {/* Answer */}
        <section className="flex min-w-0 flex-col rounded-[24px] border border-[var(--line)] bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.03)] sm:p-7">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-[15px] font-semibold text-ink">Your answer</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[12.5px] tabular-nums ${recording ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"}`}>
              {recording && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
              {fmt(answer.durationSec)}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <button
              type="button"
              onClick={toggleRecording}
              aria-pressed={recording}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white transition-all duration-300 ease-[var(--ease-premium)] focus-visible:outline-offset-4 ${
                recording ? "bg-red-500 shadow-[0_16px_36px_-12px_rgba(239,68,68,0.7)]" : "bg-brand shadow-[0_16px_36px_-12px_rgba(240,78,35,0.7)] hover:scale-105"
              }`}
            >
              {recording && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-4 border-red-300/60 transition-transform duration-100"
                  style={{ transform: `scale(${1.08 + mic.level * 0.45})` }}
                />
              )}
              {recording ? <Square size={24} className="fill-white" /> : <Mic size={28} />}
            </button>
            <p className={`mt-3 text-[13px] font-medium ${recording ? "text-red-600" : "text-stone-500"}`}>
              {mic.status === "requesting" ? "Waiting for microphone permission…" : recording ? "Recording. Tap to stop." : answer.text ? "Tap to add more" : "Tap to answer out loud"}
            </p>
          </div>

          <div className="relative mt-6 flex-1">
            <textarea
              ref={textRef}
              value={answer.text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                active.config.autoTranscribe
                  ? "Your words appear here as you speak. You can also type or edit."
                  : "Type your answer here, or record and type what you said."
              }
              className="field min-h-[200px] !h-full resize-none py-3.5 leading-relaxed"
              aria-label="Answer transcript"
            />
            {speech.interim && (
              <p className="pointer-events-none absolute bottom-3 left-4 right-4 truncate text-[14px] italic text-stone-400">{speech.interim}…</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-stone-500">
            <span className={words >= 45 ? "font-semibold text-emerald-600" : ""}>
              {words} word{words === 1 ? "" : "s"}
              {words > 0 && words < 45 && " · aim for 60 to 200"}
              {words >= 45 && <Check size={13} className="ml-1 inline" />}
            </span>
            {answer.text && (
              <button type="button" onClick={() => setText("")} className="inline-flex items-center gap-1 font-semibold hover:text-red-600">
                <Trash2 size={13} /> Clear answer
              </button>
            )}
          </div>
          {speech.error && (
            <p className="mt-2 text-[12.5px] text-amber-700">Transcription paused ({speech.error}). You can keep typing.</p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center">
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} className="btn-secondary disabled:invisible">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex flex-1 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!isLast && (
                <button type="button" onClick={() => goTo(index + 1)} className="btn-secondary">
                  <SkipForward size={15} /> Skip
                </button>
              )}
              <button type="button" onClick={next} className="btn-primary sm:min-w-[170px]">
                {isLast ? (
                  <>
                    <Sparkles size={16} /> Finish and get report
                  </>
                ) : (
                  <>
                    Next question <ArrowRight size={16} className="btn-arrow" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>

      {confirmEnd && (
        <Modal onClose={() => setConfirmEnd(false)}>
          <h2 className="display text-[26px]">End this interview?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-stone-500">
            You have answered {answeredCount} of {total} questions.{" "}
            {answeredCount ? "You can get a report now. Unanswered questions score zero." : "Nothing has been answered yet."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={() => setConfirmEnd(false)} className="btn-primary">
              <RotateCcw size={15} /> Keep going
            </button>
            {answeredCount > 0 && (
              <button type="button" onClick={() => { setConfirmEnd(false); finish(); }} className="btn-secondary">
                <Sparkles size={15} /> End and see my report
              </button>
            )}
            <button type="button" onClick={discard} className="btn-secondary !text-red-600 hover:!border-red-300">
              <Trash2 size={15} /> Discard interview
            </button>
          </div>
        </Modal>
      )}

      {analysing >= 0 && <Analysing step={analysing} />}
    </div>
  );
}
