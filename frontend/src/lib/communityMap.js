// Talent communities (Module 12): backend data <-> the shapes the community screens use.
// One place for the enums, the nested `filters` object, the limits, and who may do what.

/** How someone gets in. The backend has exactly these two; there is no "open to everyone". */
export const JOIN_MODES = [
  { value: "request", label: "Anyone eligible may ask to join", short: "By request", tone: "success" },
  { value: "invite_only", label: "Invitation only (hidden from discovery)", short: "Invite only", tone: "neutral" },
];
export const COMMUNITY_STATUS = {
  active: { label: "Active", tone: "success" },
  archived: { label: "Archived", tone: "warning" },
  removed: { label: "Removed", tone: "danger" },
};
export const SKILL_MODES = [
  { value: "any", label: "Any of these skills" },
  { value: "all", label: "All of these skills" },
];
export const MEMBERSHIP_SOURCES = { invitation: "Invited", request: "Asked to join" };
export const INVITATION_STATUS = {
  pending: { label: "Waiting", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  revoked: { label: "Withdrawn", tone: "neutral" },
};
export const REQUEST_STATUS = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  auto_rejected: { label: "Not eligible", tone: "neutral" },
};
export const POST_KINDS = [
  { value: "internship", label: "Internship" },
  { value: "job", label: "Role" },
  { value: "event", label: "Event" },
  { value: "announcement", label: "Announcement" },
];
export const POST_STATUS = { published: { label: "Published", tone: "success" }, archived: { label: "Archived", tone: "neutral" } };

/** A candidate's state on a discovery row, exactly as `discovery.states_for` reports it. */
export const DISCOVERY_STATES = {
  none: { label: "", tone: "neutral" },
  pending_request: { label: "Waiting for a decision", tone: "warning" },
  invited: { label: "You are invited", tone: "brand" },
  member: { label: "Member", tone: "success" },
};

const labelOf = (map, value, fallback = "") => map[value]?.label ?? fallback;
export const joinModeLabel = (v) => JOIN_MODES.find((m) => m.value === v)?.label ?? "";
export const joinModeShort = (v) => JOIN_MODES.find((m) => m.value === v)?.short ?? "";
export const communityStatusLabel = (v) => labelOf(COMMUNITY_STATUS, v, v ?? "");
export const communityStatusTone = (v) => COMMUNITY_STATUS[v]?.tone ?? "neutral";
export const invitationStatusLabel = (v) => labelOf(INVITATION_STATUS, v, v ?? "");
export const invitationStatusTone = (v) => INVITATION_STATUS[v]?.tone ?? "neutral";
export const requestStatusLabel = (v) => labelOf(REQUEST_STATUS, v, v ?? "");
export const requestStatusTone = (v) => REQUEST_STATUS[v]?.tone ?? "neutral";
export const postKindLabel = (v) => POST_KINDS.find((k) => k.value === v)?.label ?? v ?? "";
export const postStatusLabel = (v) => labelOf(POST_STATUS, v, v ?? "");
export const discoveryStateLabel = (v) => labelOf(DISCOVERY_STATES, v);
export const discoveryStateTone = (v) => DISCOVERY_STATES[v]?.tone ?? "neutral";
export const sourceLabel = (v) => MEMBERSHIP_SOURCES[v] ?? "";

/** The server's own limits, so a hopeless request is never sent. */
export const LIMITS = {
  name: 150, mission: 500, description: 4000, message: 500, reason: 500,
  postTitle: 200, postBody: 5000, applyUrl: 500, listItem: 100, pageSize: 20,
};
/** A reason must be real text (the server trims and requires it). */
export const reasonError = (text) => (String(text || "").trim().length ? "" : "Give a reason.");

const time = (v) => (v ? Date.parse(v) || null : null);
const list = (v) => (Array.isArray(v) ? v : []);

/** The nested `filters` object the server sends and expects. An empty value restricts nothing. */
export function mapFilters(filters = {}) {
  return {
    universities: list(filters.universities),
    degrees: list(filters.degrees),
    gradYearFrom: filters.grad_year_from ?? null,
    gradYearTo: filters.grad_year_to ?? null,
    skills: list(filters.skills),
    skillMode: filters.skill_mode || "any",
  };
}
/** Back to the flat field names `CommunityInputSerializer` takes. */
export function filtersToBody(filters = {}) {
  return {
    filter_universities: list(filters.universities),
    filter_degrees: list(filters.degrees),
    filter_grad_year_from: filters.gradYearFrom === "" ? null : filters.gradYearFrom ?? null,
    filter_grad_year_to: filters.gradYearTo === "" ? null : filters.gradYearTo ?? null,
    filter_skills: list(filters.skills),
    filter_skill_mode: filters.skillMode || "any",
  };
}
/** True when nothing is restricted, which the UI words as "open to every candidate". */
export const noRestrictions = (f = {}) =>
  !f.universities?.length && !f.degrees?.length && !f.skills?.length && f.gradYearFrom == null && f.gradYearTo == null;

export function mapCommunity(c) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || "",
    mission: c.mission || "",
    joinMode: c.join_mode,
    status: c.status,
    memberCount: c.member_count ?? 0,
    filters: mapFilters(c.filters),
    createdAt: time(c.created_at),
    company: c.company || null,
  };
}

/** A discovery row: a community plus its company, my eligibility and my state on it. */
export function mapDiscoveryRow(row) {
  return {
    ...mapCommunity(row),
    eligible: row.eligibility ? Boolean(row.eligibility.eligible) : null,
    reasons: list(row.eligibility?.reasons),
    state: row.state || "none",
    companyName: row.company?.name || "",
    joinedAt: time(row.joined_at),
  };
}

/** `profile_summary`: no email, no phone, no CV — the server never sends them (P2-9). */
export function mapCandidate(summary = {}) {
  return {
    id: summary.id,
    name: summary.full_name || "",
    headline: summary.headline || "",
    institution: summary.institution || "",
    degree: summary.degree || "",
    skills: list(summary.skills),
  };
}

export function mapMember(m) {
  return { ...mapCandidate(m), joinedAt: time(m.joined_at), source: m.source, skillMatch: m.skill_match ?? 0 };
}

/**
 * Two shapes, one mapper. The company side sends `{id, user_id, full_name, message, status,
 * created_at, expires_at}`; the candidate side sends `{id, message, created_at, expires_at,
 * community}` with no status (every row there is pending).
 */
export function mapInvitation(i) {
  return {
    id: i.id,
    userId: i.user_id ?? null,
    name: i.full_name || "",
    message: i.message || "",
    status: i.status || "pending",
    createdAt: time(i.created_at),
    expiresAt: time(i.expires_at),
    community: i.community ? mapDiscoveryRow(i.community) : null,
  };
}

export function mapRequest(r) {
  return {
    id: r.id,
    candidate: r.candidate ? mapCandidate(r.candidate) : null,
    message: r.message || "",
    status: r.status,
    eligible: r.eligibility ? Boolean(r.eligibility.eligible) : null,
    reasons: list(r.eligibility?.reasons),
    createdAt: time(r.created_at),
    reviewedAt: time(r.reviewed_at),
    decisionReason: r.decision_reason || "",
  };
}

export function mapPost(p) {
  return {
    id: p.id,
    communityId: p.community_id,
    kind: p.kind,
    title: p.title || "",
    body: p.body || "",
    jobId: p.job_id ?? null,
    applyUrl: p.apply_url || "",
    closesAt: time(p.closes_at),
    closed: Boolean(p.closed),
    status: p.status,
    createdAt: time(p.created_at),
    responses: p.responses ?? null,
  };
}

export const mapPostResponse = (r) => ({ candidate: mapCandidate(r.candidate), message: r.message || "", createdAt: time(r.created_at) });

/** Only an http(s) link is ever rendered as one. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

// Who may do what. Mirrors `CanManage = CompanyRole(ADMIN, HR_MANAGER)` in
// Module12_Communities/views.py: every company user reads, admin and HR manager write.
export const canManageCommunities = (user) => ["admin", "hr_manager"].includes(user?.memberRole);

/** The form body `CommunityInputSerializer` takes (only the fields given). */
export function communityBody({ name, description, mission, joinMode, filters }) {
  const body = {};
  if (name !== undefined) body.name = name.trim();
  if (description !== undefined) body.description = description.trim();
  if (mission !== undefined) body.mission = mission.trim();
  if (joinMode !== undefined) body.join_mode = joinMode;
  if (filters !== undefined) Object.assign(body, filtersToBody(filters));
  return body;
}

/** Local checks that mirror the server's, so the form fails before the request does. */
export function communityError({ name, description, mission, filters }) {
  if (!String(name || "").trim()) return { field: "name", message: "Give the community a name." };
  if (String(name).trim().length > LIMITS.name) return { field: "name", message: `At most ${LIMITS.name} characters.` };
  if (!String(description || "").trim()) return { field: "description", message: "Describe the community." };
  if (!String(mission || "").trim()) return { field: "mission", message: "Say what the community is for." };
  if (String(mission).trim().length > LIMITS.mission) return { field: "mission", message: `At most ${LIMITS.mission} characters.` };
  const from = filters?.gradYearFrom;
  const to = filters?.gradYearTo;
  if (from && to && Number(from) > Number(to)) return { field: "gradYearFrom", message: "The first year is after the last year." };
  return null;
}

/** The body `PostInputSerializer` takes. `job` must be a published job of the same company. */
export function postBody({ kind, title, body, jobId, applyUrl, closesAt, notifyMembers }) {
  const out = { kind, title: String(title || "").trim(), body: String(body || "").trim() };
  if (jobId) out.job = jobId;
  if (applyUrl) out.apply_url = applyUrl.trim();
  if (closesAt) out.closes_at = new Date(closesAt).toISOString();
  if (notifyMembers !== undefined) out.notify_members = Boolean(notifyMembers);
  return out;
}

export function postError({ kind, title, body, applyUrl }) {
  if (!kind) return { field: "kind", message: "Choose what this post is." };
  if (!String(title || "").trim()) return { field: "title", message: "Give the post a title." };
  if (String(title).trim().length > LIMITS.postTitle) return { field: "title", message: `At most ${LIMITS.postTitle} characters.` };
  if (!String(body || "").trim()) return { field: "body", message: "Write the post." };
  if (String(body).trim().length > LIMITS.postBody) return { field: "body", message: `At most ${LIMITS.postBody} characters.` };
  if (applyUrl && !safeUrl(applyUrl)) return { field: "applyUrl", message: "Give a full http or https link." };
  return null;
}
