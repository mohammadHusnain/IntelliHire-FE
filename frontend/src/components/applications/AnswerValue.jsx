import { Download, ExternalLink } from "lucide-react";
import { safeUrl } from "@/lib/applicationMap";

/** One answer of an application form, shown by its type. `onDownload(key)` fetches a file answer with the person's session. */
export default function AnswerValue({ answer, onDownload, busy }) {
  const { type, value } = answer;
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-stone-400">No answer</span>;
  }
  switch (type) {
    case "file":
      return (
        <button type="button" disabled={busy} onClick={() => onDownload(answer.key)} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline disabled:opacity-50">
          <Download size={14} /> {value.name || "Download"}
        </button>
      );
    case "url": {
      const url = safeUrl(value);
      return url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-brand hover:underline">{value} <ExternalLink size={12} /></a>
      ) : (
        <span className="break-all">{String(value)}</span>
      );
    }
    case "email":
      return <a href={`mailto:${value}`} className="break-all text-brand hover:underline">{value}</a>;
    case "date": {
      const d = new Date(`${value}T00:00:00`);
      return <span>{Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>;
    }
    case "multiple_choice":
      return (
        <span className="flex flex-wrap gap-1.5">
          {(Array.isArray(value) ? value : [value]).map((v) => <span key={v} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[12.5px] font-medium text-stone-700">{v}</span>)}
        </span>
      );
    case "long_text":
      return <span className="whitespace-pre-line">{String(value)}</span>;
    default:
      return <span className="break-words">{String(value)}</span>;
  }
}
