// The pieces that render a community, its filters, its people and its posts (Module 12).
// Shared by the company workspace and the candidate screens so the two cannot drift apart.
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge, Card } from "@/components/app/primitives";
import {
  communityStatusLabel,
  communityStatusTone,
  discoveryStateLabel,
  discoveryStateTone,
  joinModeShort,
  noRestrictions,
  postKindLabel,
  safeUrl,
} from "@/lib/communityMap";

export function Loading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-stone-500">
      <Loader2 size={18} className="animate-spin text-brand" /> <span>{label}</span>
    </div>
  );
}

export function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <Card className="p-6">
      <div role="alert" className="py-8 text-center">
        <p className="text-[14px] text-stone-600">{message}</p>
        <button type="button" onClick={onRetry} className="btn-secondary mt-4">Try again</button>
      </div>
    </Card>
  );
}

export function CommunityStatusBadge({ status }) {
  return <Badge tone={communityStatusTone(status)}>{communityStatusLabel(status)}</Badge>;
}

export function JoinModeBadge({ joinMode }) {
  return <Badge tone="neutral">{joinModeShort(joinMode)}</Badge>;
}

/** The candidate's own state on a community. Nothing is shown for "none". */
export function StateBadge({ state }) {
  const label = discoveryStateLabel(state);
  return label ? <Badge tone={discoveryStateTone(state)}>{label}</Badge> : null;
}

/** Who a community is for. An empty filter restricts nothing, and that is said in words. */
export function FilterChips({ filters, className = "" }) {
  if (noRestrictions(filters)) {
    return <p className={`text-[12px] text-stone-500 ${className}`}>Open to every candidate — no requirements.</p>;
  }
  const years =
    filters.gradYearFrom && filters.gradYearTo
      ? `Graduating ${filters.gradYearFrom}–${filters.gradYearTo}`
      : filters.gradYearFrom
        ? `Graduating ${filters.gradYearFrom} or later`
        : filters.gradYearTo
          ? `Graduating ${filters.gradYearTo} or earlier`
          : "";
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {filters.universities.map((value) => <Badge key={`u-${value}`} tone="neutral">{value}</Badge>)}
      {filters.degrees.map((value) => <Badge key={`d-${value}`} tone="neutral">{value}</Badge>)}
      {years && <Badge tone="neutral">{years}</Badge>}
      {filters.skills.length > 0 && (
        <Badge tone="brand">{filters.skillMode === "all" ? "All of" : "Any of"}: {filters.skills.join(", ")}</Badge>
      )}
    </div>
  );
}

/**
 * Why a candidate does not qualify, in the server's own plain words (§12.3).
 * Never an error: it is the requirements, shown so they can be read.
 */
export function EligibilityNote({ eligible, reasons = [], className = "" }) {
  if (eligible === null || eligible === undefined) return null;
  if (eligible) return <p className={`text-[12.5px] text-emerald-700 ${className}`}>You meet the requirements.</p>;
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-3 ${className}`}>
      <p className="flex items-start gap-2 text-[12.5px] font-semibold text-amber-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> You do not meet the requirements yet
      </p>
      {reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-7 text-[12.5px] text-amber-900">
          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </div>
  );
}

/** A candidate as `profile_summary` gives them: never an email, a phone number or a CV. */
export function CandidateSummary({ candidate, extra }) {
  if (!candidate) return <p className="text-[12.5px] text-stone-400">Candidate unavailable</p>;
  return (
    <div className="min-w-0">
      <p className="truncate text-[13.5px] font-semibold text-ink">{candidate.name}</p>
      {candidate.headline && <p className="truncate text-[12px] text-stone-500">{candidate.headline}</p>}
      <p className="truncate text-[11.5px] text-stone-400">
        {[candidate.institution, candidate.degree].filter(Boolean).join(" · ") || "No education recorded"}
      </p>
      {candidate.skills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {candidate.skills.slice(0, 8).map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}
        </div>
      )}
      {extra}
    </div>
  );
}

export function PostCard({ post, actions, footer }) {
  const link = safeUrl(post.applyUrl);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">{postKindLabel(post.kind)}</Badge>
            {post.closed && <Badge tone="neutral">Closed</Badge>}
            {post.status === "archived" && <Badge tone="neutral">Archived</Badge>}
          </div>
          <h3 className="mt-1.5 text-[14.5px] font-semibold text-ink">{post.title}</h3>
        </div>
        {actions}
      </div>
      <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-stone-600">{post.body}</p>
      {link && (
        <a href={link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
          How to apply
        </a>
      )}
      {footer}
    </Card>
  );
}
