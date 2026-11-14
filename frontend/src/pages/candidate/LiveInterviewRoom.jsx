// The candidate's side of a live AI interview (Module 7 `live/`).
//
// The call is spoken: the microphone streams to the server, the interviewer's voice comes back, and
// the whole conversation is transcribed. There is nothing to type and nothing to submit — the call
// ends when the time runs out or the candidate ends it.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";
import logo from "@/assets/logo/logo.png";
import { interviewsApi } from "@/api/interviewsApi";
import { liveInterviewError, openLiveInterview } from "@/api/liveInterviewSocket";
import { MicrophoneDenied, openAudio } from "@/lib/liveAudio";

const KIND_LABEL = { screening: "Screening interview", technical: "Technical interview" };
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function LiveInterviewRoom({ token }) {
  const [summary, setSummary] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | live | ended | error
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [lines, setLines] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  const audio = useRef(null);
  const socket = useRef(null);
  const ticker = useRef(null);

  // The interview's own details, so the candidate knows what they are joining.
  useEffect(() => {
    const controller = new AbortController();
    interviewsApi.publicSummary(token, { signal: controller.signal })
      .then((data) => {
        setSummary(data);
        const done = ["completed", "evaluated", "incomplete", "cancelled", "expired"].includes(data.status);
        setPhase(done ? "ended" : "ready");
      })
      .catch((cause) => {
        if (cause.code === "aborted") return;
        setError(liveInterviewError(cause.code, cause.message));
        setPhase("error");
      });
    return () => controller.abort();
  }, [token]);

  const teardown = useCallback(() => {
    clearInterval(ticker.current);
    ticker.current = null;
    socket.current?.close();
    socket.current = null;
    audio.current?.close();
    audio.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  /** Merge streaming fragments into the line being spoken, so the page reads like a conversation. */
  const addLine = useCallback((role, text) => {
    setLines((current) => {
      const last = current[current.length - 1];
      if (last && last.role === role) {
        return [...current.slice(0, -1), { role, text: `${last.text}${text}` }];
      }
      return [...current, { role, text }];
    });
  }, []);

  const begin = async () => {
    setError("");
    setPhase("connecting");
    try {
      audio.current = await openAudio({ onChunk: (chunk) => socket.current?.sendAudio(chunk) });
    } catch (cause) {
      setError(cause instanceof MicrophoneDenied
        ? "The interview needs your microphone. Allow access in your browser and try again."
        : "Your microphone could not be opened.");
      setPhase("ready");
      return;
    }

    socket.current = openLiveInterview(token, {
      onReady: ({ seconds }) => {
        setPhase("live");
        setSecondsLeft(seconds);
        const endsAt = Date.now() + seconds * 1000;
        ticker.current = setInterval(() => {
          setSecondsLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
        }, 250);
      },
      onAudio: (buffer) => {
        setSpeaking(true);
        audio.current?.play(buffer);
      },
      onTranscript: ({ role, text }) => {
        if (role === "candidate") setSpeaking(false);
        addLine(role, text);
      },
      onInterrupted: () => {
        setSpeaking(false);
        audio.current?.stopPlayback();
      },
      onEnded: ({ reason }) => {
        teardown();
        setPhase("ended");
        if (String(reason || "").startsWith("error")) {
          setError("The interview service had a problem. Anything you answered has been saved.");
        }
      },
      onError: ({ code, message }) => {
        teardown();
        setError(liveInterviewError(code, message));
        setPhase("error");
      },
    });
  };

  const end = () => {
    socket.current?.stop();
    setPhase("ending");
  };

  const kind = KIND_LABEL[summary?.kind] || "Interview";

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-white px-5 py-3">
        <img src={logo} alt="IntelliHire" className="h-7" />
        {phase === "live" && (
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            Live
            <span className="tabular-nums text-stone-500">{secondsLeft != null ? clock(secondsLeft) : ""}</span>
          </span>
        )}
      </header>

      <main className="mx-auto max-w-2xl p-5">
        {phase === "loading" && (
          <p className="flex items-center justify-center gap-2 py-20 text-[13px] text-stone-500">
            <Loader2 size={18} className="animate-spin text-brand" /> Loading your interview
          </p>
        )}

        {phase === "error" && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-[14px] text-red-800">{error}</p>
          </div>
        )}

        {(phase === "ready" || phase === "connecting") && summary && (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-brand">{kind}</p>
            <h1 className="mt-1 text-[22px] font-semibold text-ink">{summary.role_title}</h1>
            <p className="text-[13px] text-stone-500">{summary.company_name}</p>
            <ul className="mt-5 space-y-2 text-[13px] leading-relaxed text-stone-600">
              <li>This is a spoken interview with an AI interviewer. Speak naturally; it will reply out loud.</li>
              <li>It lasts about {Math.max(1, Math.round((summary.estimated_minutes || 3)))} minutes and ends by itself when the time is up.</li>
              <li>Find a quiet place and use headphones if you can. You need a working microphone.</li>
              <li>Everything said is transcribed for the hiring team. A person reviews the result; the AI does not decide.</li>
            </ul>
            {error && <p role="alert" className="mt-4 text-[12.5px] text-red-700">{error}</p>}
            <button type="button" onClick={begin} disabled={phase === "connecting"} className="btn-primary btn-lg mt-6 w-full disabled:opacity-50">
              {phase === "connecting" ? <><Loader2 size={18} className="animate-spin" /> Connecting…</> : <><Mic size={18} /> Start the interview</>}
            </button>
          </div>
        )}

        {(phase === "live" || phase === "ending") && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center">
              <span className={`inline-flex h-16 w-16 items-center justify-center rounded-full ${speaking ? "bg-brand-soft text-brand" : "bg-stone-100 text-stone-400"}`}>
                {speaking ? <Mic size={26} /> : <MicOff size={26} />}
              </span>
              <p className="mt-3 text-[14px] font-semibold text-ink">{speaking ? "The interviewer is speaking" : "Your turn — speak naturally"}</p>
              <p className="mt-1 text-[12px] text-stone-500">You can interrupt at any time.</p>
              <button type="button" onClick={end} disabled={phase === "ending"} className="btn-secondary mt-5 disabled:opacity-50">
                <PhoneOff size={15} /> {phase === "ending" ? "Ending…" : "End interview"}
              </button>
            </div>
            <Conversation lines={lines} />
          </div>
        )}

        {phase === "ended" && (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center">
            <h1 className="text-[20px] font-semibold text-ink">Interview finished</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-stone-600">
              Thank you. Your answers have been sent to the hiring team, and they will be in touch about the next step.
            </p>
            {error && <p role="alert" className="mt-3 text-[12.5px] text-amber-800">{error}</p>}
            {lines.length > 0 && <div className="mt-5 text-left"><Conversation lines={lines} /></div>}
          </div>
        )}
      </main>
    </div>
  );
}

function Conversation({ lines }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label="Conversation" className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-4">
      {lines.map((line, index) => (
        <p key={index} className={`text-[13px] leading-relaxed ${line.role === "interviewer" ? "text-stone-600" : "text-ink"}`}>
          <span className="font-semibold">{line.role === "interviewer" ? "Interviewer: " : "You: "}</span>
          {line.text.trim()}
        </p>
      ))}
    </section>
  );
}
