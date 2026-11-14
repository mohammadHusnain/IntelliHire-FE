// Practice interviews on the real engine (Module 11): pick, run, review, history and progress.
// Nothing is scored or written locally. Until the AI hooks are connected the server leaves scores
// and feedback empty and explains why in `feedback_message`; this screen shows that, not a guess.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Play, RefreshCw, Send, Trash2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/app/primitives";
import { SearchField } from "@/components/admin/primitives";
import { mockInterviewApi as api } from "@/api/mockInterviewApi";
import { useDebounced } from "@/hooks/useDebounced";
import { useRemote } from "@/hooks/useRemote";
import { formatDate } from "@/lib/candidateStats";
import { toast } from "@/store/toastStore";

const FEEDBACK_TONE = { none: "neutral", generating: "warning", ready: "success", partial: "warning", failed: "danger" };
const TYPE = { general: "General", role_specific: "Role specific" };
const OPEN = ["in_progress", "invited"];

const Busy = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-stone-500">
    <Loader2 size={18} className="animate-spin text-brand" /> {label}
  </div>
);
const Err = ({ message, onRetry }) => (
  <div role="alert" className="mt-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
    <span className="flex-1">{message}</span>
    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
  </div>
);

export function Setup() {
  const navigate = useNavigate();
  const [type, setType] = useState("general");
  const [roleId, setRoleId] = useState("");
  const [useCv, setUseCv] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const search = useDebounced(q);
  const roles = useRemote((o) => api.roles({ q: search }, o), [search]);
  const rows = roles.data?.results || [];

  const start = async () => {
    if (type === "role_specific" && !roleId) return setError("Choose a role from the catalog.");
    setBusy(true);
    setError("");
    try {
      const session = await api.create({ interview_type: type, use_cv: useCv, ...(type === "role_specific" ? { role_id: roleId } : {}) });
      navigate(`/candidate/interview/room?s=${session.id}`);
    } catch (e) {
      setError(e.status === 429 ? "You have reached today's limit of practice interviews. Try again tomorrow." : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Practice" title={<>New practice <em>interview</em></>} subtitle="Questions come from the platform's own bank. One practice session at a time." />
      <Card className="max-w-3xl space-y-5 p-6">
        <div className="flex gap-2" role="radiogroup" aria-label="Interview type">
          {Object.entries(TYPE).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={type === value} onClick={() => setType(value)} className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${type === value ? "border-ink bg-ink text-white" : "border-[var(--line)] bg-white text-stone-600"}`}>{label}</button>
          ))}
        </div>
        {type === "role_specific" && (
          <div className="space-y-3">
            <SearchField value={q} onChange={setQ} placeholder="Search roles" />
            {roles.status === "loading" && !roles.data ? <Busy label="Loading roles" /> : rows.length === 0 ? <p className="text-[13px] text-stone-500">No role matches.</p> : (
              <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {rows.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setRoleId(r.id); setError(""); }} className={`rounded-xl border p-3 text-left ${roleId === r.id ? "border-brand bg-brand-soft" : "border-[var(--line)]"}`}>
                    <p className="text-[13.5px] font-semibold text-ink">{r.title}</p>
                    <p className="text-[11.5px] text-stone-500">{r.category}</p>
                  </button>
                ))}
              </div>
            )}
            {roles.status === "error" && <Err message={roles.error.message} onRetry={roles.reload} />}
          </div>
        )}
        <label className="flex items-start gap-2 text-[13px] text-stone-700">
          <input type="checkbox" checked={useCv} onChange={(e) => setUseCv(e.target.checked)} className="mt-0.5" />
          <span>Tailor questions to my CV (personal details are removed first). Needs a CV on your profile.</span>
        </label>
        {error && <Err message={error} />}
        <button type="button" onClick={start} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Begin
        </button>
      </Card>
    </div>
  );
}

export function Room() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("s");
  const [session, setSession] = useState(null);
  const [turn, setTurn] = useState(null);
  const [counts, setCounts] = useState({ a: 0, q: 0 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = (p) => {
    setTurn(p.turn);
    setCounts({ a: p.answered_count, q: p.question_count });
    if (p.done) navigate(`/candidate/report/${id}`);
  };
  const begin = async () => {
    setBusy(true);
    setError("");
    try {
      apply(await api.start(id));
    } catch (e) {
      setError(e.status === 503 ? "No question could be made right now. Try again in a moment." : e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!id) return undefined;
    const c = new AbortController();
    api.get(id, { signal: c.signal }).then((s) => {
      if (!OPEN.includes(s.status)) return navigate(`/candidate/report/${id}`, { replace: true });
      setSession(s);
      setTurn(s.current_turn);
      setCounts({ a: s.answered_count, q: s.question_count });
      return undefined;
    }).catch((e) => e.code !== "aborted" && setError(e.status === 404 ? "This practice session was not found." : e.message));
    return () => c.abort();
  }, [id, navigate]);

  const send = async () => {
    if (!text.trim()) return setError("Type an answer first.");
    setBusy(true);
    setError("");
    try {
      const p = await api.answer(id, turn.index, text.trim());
      setText("");
      apply(p);
    } catch (e) {
      setError(e.status === 409 ? "That question is no longer current. Reload to continue." : e.status === 422 ? "That answer could not be read. Please type it." : e.message);
    } finally {
      setBusy(false);
    }
  };
  const end = async () => {
    setBusy(true);
    try {
      const s = await api.end(id);
      const cancelled = s.status === "cancelled";
      toast({ title: cancelled ? "Practice cancelled" : "Practice ended", message: cancelled ? "Under 3 answers, so it does not count." : "Partial feedback follows once it is available." });
      navigate(cancelled ? "/candidate/reports" : `/candidate/report/${id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!id) return <EmptyState title="No practice session" message="Start one first." action={<Link to="/candidate/interview/setup" className="btn-primary">New practice</Link>} />;
  if (!session && !error) return <Busy label="Loading your session" />;
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <PageHeader eyebrow="Practice interview" title={<>{session?.target_role?.title || "General"} <em>practice</em></>} subtitle={session?.disclaimer} />
      {error && <Err message={error} />}
      {turn ? (
        <Card className="space-y-4 p-6">
          <p className="text-[12px] text-stone-500">Question {counts.a + 1} of {counts.q}{turn.is_follow_up ? " · follow-up" : ""}</p>
          <p className="text-[16px] font-semibold text-ink">{turn.question_text}</p>
          <textarea aria-label="Your answer" value={text} rows={7} onChange={(e) => { setText(e.target.value); setError(""); }} className="field !h-auto py-3" placeholder="Type your answer." />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={busy} className="btn-primary disabled:opacity-50"><Send size={15} /> Submit answer</button>
            <button type="button" onClick={end} disabled={busy} className="btn-secondary">End practice</button>
          </div>
          {session && !session.voice_available && <p className="text-[11.5px] text-stone-400">Voice answers are not available yet. Type your answer.</p>}
        </Card>
      ) : session && !busy ? (
        <Card className="p-6 text-center"><button type="button" onClick={begin} className="btn-primary"><Play size={15} /> Start</button></Card>
      ) : session ? <Busy label="Preparing the next question" /> : null}
    </div>
  );
}

export function Report() {
  const { id } = useParams();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const remote = useRemote((o) => api.get(id, o), [id, version]);
  const s = remote.data;

  const retry = async () => {
    setBusy(true);
    try {
      await api.retryFeedback(id);
      toast({ title: "Feedback queued" });
      setVersion((v) => v + 1);
    } catch (e) {
      toast({ type: "error", title: "Could not retry", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (remote.status === "error" && !s) return <Err message={remote.error.status === 404 ? "This session was not found." : remote.error.message} onRetry={remote.reload} />;
  if (!s) return <Busy label="Loading the report" />;
  const r = s.report;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Practice report" title={<>{s.role_title || "General"} <em>practice</em></>} subtitle={formatDate(s.date)} actions={<Link to="/candidate/reports" className="btn-secondary">All sessions</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Play} label="Score" value={s.overall_score ?? "—"} hint={s.overall_score == null ? "Not scored yet" : undefined} />
        <StatTile icon={Send} label="Answered" value={`${s.answered_count}/${s.question_count}`} />
      </div>
      <Card className="p-5">
        <Badge tone={FEEDBACK_TONE[s.feedback_status]}>{s.feedback_status}</Badge>
        {s.feedback_message && <p className="mt-2 text-[13px] text-stone-600">{s.feedback_message}</p>}
        {["failed", "partial"].includes(s.feedback_status) && (
          <button type="button" onClick={retry} disabled={busy} className="btn-secondary mt-3 !h-9 text-[12.5px]"><RefreshCw size={14} /> Try feedback again</button>
        )}
      </Card>
      {r && (
        <Card className="space-y-3 p-5">
          <CardHeader title="Feedback" />
          {r.summary && <p className="text-[13px] text-stone-700">{r.summary}</p>}
          {[["Strengths", r.strengths], ["To improve", r.weaknesses], ["Suggestions", r.suggestions]].map(([title, list]) => (
            list?.length ? (
              <div key={title}>
                <p className="text-[12px] font-semibold text-ink">{title}</p>
                <ul className="mt-1 list-disc pl-5 text-[13px] text-stone-600">{list.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ) : null
          ))}
        </Card>
      )}
      <Card className="p-5">
        <CardHeader title="Transcript" subtitle="What you were asked and what you answered." />
        {s.transcript.length === 0 ? <p className="mt-3 text-[13px] text-stone-500">No answers were given.</p> : (
          <ol className="mt-3 space-y-3">
            {s.transcript.map((t) => (
              <li key={t.index} className="rounded-xl border border-[var(--line)] p-3">
                <p className="text-[13px] font-semibold text-ink">{t.question}</p>
                <p className="mt-1 whitespace-pre-line text-[13px] text-stone-600">{t.answer}</p>
                {t.score != null && <p className="mt-1 text-[12px] text-stone-500">Score {t.score}{t.feedback ? ` · ${t.feedback}` : ""}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function History() {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const list = useRemote((o) => api.list({}, o), [version]);
  const progress = useRemote((o) => api.progress(o), [version]);
  const rows = list.data?.results || [];
  const p = progress.data;

  const remove = async (row) => {
    if (!window.confirm("Delete this practice session and its transcript for good?")) return;
    setBusy(row.id);
    try {
      await api.remove(row.id);
      toast({ title: "Session deleted" });
      setVersion((v) => v + 1);
    } catch (e) {
      toast({ type: "error", title: "Could not delete", message: e.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Practice" title={<>Practice <em>history</em></>} subtitle="Your past sessions and how you are doing." actions={<Link to="/candidate/interview/setup" className="btn-primary"><Play size={15} /> New practice</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Play} label="Scored sessions" value={p?.scored_sessions ?? "—"} />
        <StatTile icon={Play} label="Best" value={p?.best_score ?? "—"} />
        <StatTile icon={Play} label="Latest" value={p?.latest_score ?? "—"} />
        <StatTile icon={Play} label="Trend" value={p?.trend ?? "—"} hint={p?.trend ? undefined : "Needs 4 scored sessions"} />
      </div>
      {p && Object.keys(p.dimension_averages || {}).length > 0 && (
        <Card className="p-5">
          <CardHeader title="Average by dimension" subtitle="0 to 10, last 10 scored sessions." />
          <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(p.dimension_averages).map(([k, v]) => <Badge key={k} tone="neutral">{k.replaceAll("_", " ")}: {v}</Badge>)}</div>
        </Card>
      )}
      {list.status === "loading" && !list.data ? <Busy label="Loading your sessions" /> : rows.length === 0 ? (
        <EmptyState title="No practice sessions yet" message="Start one to see it here." action={<Link to="/candidate/interview/setup" className="btn-primary">New practice</Link>} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{row.role_title || "General"}</p>
                <p className="text-[11.5px] text-stone-500">{formatDate(row.date)} · {TYPE[row.interview_type]} · {row.answered_count}/{row.question_count} answered</p>
              </div>
              <Badge tone={FEEDBACK_TONE[row.feedback_status]}>{row.overall_score != null ? `${row.overall_score}` : row.feedback_status}</Badge>
              <Link to={OPEN.includes(row.status) ? `/candidate/interview/room?s=${row.id}` : `/candidate/report/${row.id}`} className="btn-secondary !h-8 !px-3 text-[12px]">{OPEN.includes(row.status) ? "Resume" : "Open"}</Link>
              <button type="button" disabled={busy === row.id} onClick={() => remove(row)} aria-label="Delete session" className="icon-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-red-600"><Trash2 size={14} /></button>
            </Card>
          ))}
        </div>
      )}
      {list.status === "error" && <Err message={list.error.message} onRetry={list.reload} />}
    </div>
  );
}
