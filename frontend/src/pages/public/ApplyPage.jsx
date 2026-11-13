import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, Loader2, SearchX, WifiOff } from "lucide-react";
import BrandLogo from "@/components/shared/BrandLogo";
import ApplicationFormFields from "@/components/jobs/ApplicationFormFields";
import JobSummary from "@/components/jobs/JobSummary";
import { publicJobsApi } from "@/api/publicJobsApi";
import { useCountdown } from "@/hooks/useCountdown";
import { formatDeadline } from "@/lib/jobMap";

const FILE_RX = /\.(pdf|docx)$/i;
const MAX_FILE = 5 * 1024 * 1024;

const Shell = ({ children }) => (
  <div className="min-h-dvh bg-[#FAFAF9] px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-[760px]">
      <div className="mb-8"><BrandLogo /></div>
      {children}
    </div>
  </div>
);

const Panel = ({ children, className = "" }) => <div className={`rounded-[24px] border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8 ${className}`}>{children}</div>;

/** /apply/:slug  The public application page of a job: read the role, fill in its form, submit. No account needed. */
export default function ApplyPage() {
  const { slug } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: "loading", schema: null, error: null });
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [progress, setProgress] = useState(null); // null = idle, 0-100 while sending
  const [done, setDone] = useState(null);
  const [wait, startWait] = useCountdown();
  const sending = useRef(false);
  const formRef = useRef(null);
  // One request per attempt, even when React StrictMode runs the effect twice in development.
  const request = useRef({ key: null, promise: null });

  useEffect(() => {
    const key = `${slug}:${attempt}`;
    if (request.current.key !== key) request.current = { key, promise: publicJobsApi.schema(slug).then((schema) => ({ schema }), (error) => ({ error })) };
    let live = true;
    request.current.promise.then(({ schema, error }) => {
      if (!live) return;
      if (schema) setState({ phase: "ready", schema, error: null });
      else if (error.status === 404) setState({ phase: "missing", schema: null, error });
      else setState({ phase: "error", schema: null, error });
    });
    return () => {
      live = false;
    };
  }, [slug, attempt]);

  const retry = () => {
    setState({ phase: "loading", schema: null, error: null });
    setAttempt((n) => n + 1);
  };

  const set = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setFormError("");
  };

  const focusFirstError = () => requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());

  const checkLocally = (fields) => {
    const found = {};
    for (const f of fields) {
      const v = values[f.key];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (f.required && empty) found[f.key] = `${f.label} is required.`;
      else if (v instanceof File) {
        if (!FILE_RX.test(v.name)) found[f.key] = "Only PDF and DOCX files are accepted.";
        else if (v.size > MAX_FILE) found[f.key] = "File must be 5 MB or smaller.";
      }
    }
    return found;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending.current || wait > 0) return;
    const found = checkLocally(state.schema.fields);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return focusFirstError();
    sending.current = true;
    setProgress(0);
    try {
      const receipt = await publicJobsApi.apply(slug, values, { onProgress: setProgress });
      setDone(receipt);
      setValues({});
    } catch (error) {
      const fields = error.fieldErrors || {};
      const keys = new Set(state.schema.fields.map((f) => f.key));
      const mapped = {};
      for (const [key, messages] of Object.entries(fields)) mapped[keys.has(key) ? key : "_other"] = Array.isArray(messages) ? messages[0] : String(messages);
      const { _other, ...onFields } = mapped;
      if (Object.keys(onFields).length) {
        setErrors(onFields);
        focusFirstError();
      }
      if (error.status === 410) {
        // Closed while the person was filling it in: show the page as closed, keep nothing half-sent.
        setState((s) => ({ ...s, schema: { ...s.schema, accepting: false, message: error.message } }));
      } else if (!Object.keys(onFields).length || _other) {
        setFormError(_other || error.message); // throttle, too large, server trouble, network
      }
      if (error.retryAfterSeconds) startWait(error.retryAfterSeconds);
    } finally {
      sending.current = false;
      setProgress(null);
    }
  };

  const { phase, schema, error } = state;

  if (phase === "loading") {
    return <Shell><div className="flex justify-center py-24"><Loader2 className="animate-spin text-brand" size={28} aria-label="Loading the application form" /></div></Shell>;
  }
  if (phase === "missing") {
    return (
      <Shell>
        <Panel className="text-center">
          <SearchX size={30} className="mx-auto text-stone-400" />
          <h1 className="display mt-4 text-[28px]">This job link isn&apos;t valid</h1>
          <p role="alert" className="mt-2 text-[15px] text-stone-600">We couldn&apos;t find that position. Check the link, or ask the company for a new one.</p>
        </Panel>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <Panel className="text-center">
          <WifiOff size={30} className="mx-auto text-stone-400" />
          <h1 className="display mt-4 text-[28px]">We couldn&apos;t load this job</h1>
          <p role="alert" className="mt-2 text-[15px] text-stone-600">{error.message}</p>
          <button type="button" onClick={retry} className="btn-primary mt-6">Try again</button>
        </Panel>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <Panel className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={28} /></span>
          <h1 className="display mt-5 text-[30px]">Application received</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
            Thank you. {done.company} has your application for <span className="font-semibold text-ink">{done.job_title}</span>. We emailed you a confirmation.
          </p>
          <p className="mt-5 inline-block rounded-xl bg-stone-50 px-4 py-2 text-[14px] text-stone-600">Your reference: <span className="font-semibold tabular-nums text-ink">{done.reference}</span></p>
          <p className="mt-4 text-[13px] text-stone-500">Your confirmation email includes a private tracking link. <Link to="/track/request-link" className="font-semibold text-brand hover:underline">Recover it by email</Link>.</p>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <Panel>
        <JobSummary job={schema.job} />
      </Panel>
      {!schema.accepting ? (
        <Panel className="mt-6">
          <div role="alert" className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-sans text-[16px] font-semibold text-ink">Applications are closed</h2>
              <p className="mt-1 text-[14.5px] text-stone-600">{schema.message || "This position is no longer accepting applications."}</p>
              {schema.job.deadline && <p className="mt-1 text-[13px] text-stone-500">Deadline: {formatDeadline(schema.job.deadline)}</p>}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="mt-6">
          <h2 className="display text-[24px]">Apply for this role</h2>
          <p className="mt-1 text-[14px] text-stone-500">Fields marked * are required.</p>
          {formError && (
            <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" /> {formError}
            </div>
          )}
          <form ref={formRef} onSubmit={submit} noValidate className="mt-6 space-y-6">
            <ApplicationFormFields fields={schema.fields} values={values} errors={errors} onChange={set} idPrefix="apply" />
            <button type="submit" disabled={progress !== null || wait > 0} className="btn-primary btn-lg w-full">
              {progress !== null ? <><Loader2 size={18} className="animate-spin" /> {progress > 0 && progress < 100 ? `Sending… ${progress}%` : "Sending…"}</> : wait > 0 ? `Try again in ${wait}s` : "Submit application"}
            </button>
          </form>
        </Panel>
      )}
    </Shell>
  );
}
