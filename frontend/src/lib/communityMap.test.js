import { describe, expect, it } from "vitest";
import {
  DISCOVERY_STATES,
  canManageCommunities,
  communityBody,
  communityError,
  discoveryStateLabel,
  filtersToBody,
  joinModeShort,
  mapCandidate,
  mapCommunity,
  mapDiscoveryRow,
  mapFilters,
  mapInvitation,
  mapRequest,
  noRestrictions,
  postBody,
  postError,
  reasonError,
  requestStatusLabel,
  safeUrl,
} from "./communityMap";

describe("communityMap: enums the backend defines", () => {
  it("has only the server's two join modes, and no 'open to everyone'", () => {
    expect(joinModeShort("request")).toBe("By request");
    expect(joinModeShort("invite_only")).toBe("Invite only");
    expect(joinModeShort("open")).toBe("");
  });

  it("uses the server's own discovery state key, pending_request", () => {
    expect(Object.keys(DISCOVERY_STATES)).toEqual(["none", "pending_request", "invited", "member"]);
    expect(discoveryStateLabel("pending_request")).toBe("Waiting for a decision");
    expect(discoveryStateLabel("none")).toBe("");
  });

  it("words auto_rejected as a requirement, not a rejection", () => {
    expect(requestStatusLabel("auto_rejected")).toBe("Not eligible");
    expect(requestStatusLabel("rejected")).toBe("Rejected");
  });
});

describe("communityMap: the nested filters object", () => {
  const server = { universities: ["NUST"], degrees: ["CS"], grad_year_from: 2025, grad_year_to: 2026, skills: ["Python"], skill_mode: "all" };

  it("reads the server's shape and writes back the flat field names", () => {
    const filters = mapFilters(server);
    expect(filters).toEqual({ universities: ["NUST"], degrees: ["CS"], gradYearFrom: 2025, gradYearTo: 2026, skills: ["Python"], skillMode: "all" });
    expect(filtersToBody(filters)).toEqual({
      filter_universities: ["NUST"], filter_degrees: ["CS"], filter_grad_year_from: 2025,
      filter_grad_year_to: 2026, filter_skills: ["Python"], filter_skill_mode: "all",
    });
  });

  it("turns an empty year back into null rather than an empty string", () => {
    expect(filtersToBody({ gradYearFrom: "", gradYearTo: "" })).toMatchObject({ filter_grad_year_from: null, filter_grad_year_to: null });
  });

  it("knows when nothing is restricted", () => {
    expect(noRestrictions(mapFilters({}))).toBe(true);
    expect(noRestrictions(mapFilters(server))).toBe(false);
  });
});

describe("communityMap: local checks mirroring the server", () => {
  const valid = { name: "Cohort", description: "About", mission: "Why", filters: {} };

  it("requires a name, a description and a mission", () => {
    expect(communityError(valid)).toBeNull();
    expect(communityError({ ...valid, name: "  " })).toMatchObject({ field: "name" });
    expect(communityError({ ...valid, description: "" })).toMatchObject({ field: "description" });
    expect(communityError({ ...valid, mission: "" })).toMatchObject({ field: "mission" });
  });

  it("refuses a reversed graduation range", () => {
    expect(communityError({ ...valid, filters: { gradYearFrom: 2027, gradYearTo: 2025 } })).toMatchObject({ field: "gradYearFrom" });
  });

  it("sends only the fields it was given, trimmed", () => {
    expect(communityBody({ name: "  Cohort  ", joinMode: "invite_only" })).toEqual({ name: "Cohort", join_mode: "invite_only" });
  });

  it("requires a reason wherever the server does", () => {
    expect(reasonError("")).toBeTruthy();
    expect(reasonError("   ")).toBeTruthy();
    expect(reasonError("duplicate")).toBe("");
  });
});

describe("communityMap: posts", () => {
  const valid = { kind: "job", title: "Role", body: "Body" };

  it("builds the body PostInputSerializer takes", () => {
    expect(postBody({ ...valid, jobId: "job-1", notifyMembers: true })).toMatchObject({ kind: "job", title: "Role", body: "Body", job: "job-1", notify_members: true });
  });

  it("leaves out an empty job and link rather than sending blanks", () => {
    const body = postBody({ ...valid, jobId: "", applyUrl: "" });
    expect(body).not.toHaveProperty("job");
    expect(body).not.toHaveProperty("apply_url");
  });

  it("checks what the server checks", () => {
    expect(postError(valid)).toBeNull();
    expect(postError({ ...valid, kind: "" })).toMatchObject({ field: "kind" });
    expect(postError({ ...valid, title: "" })).toMatchObject({ field: "title" });
    expect(postError({ ...valid, body: "" })).toMatchObject({ field: "body" });
    expect(postError({ ...valid, applyUrl: "javascript:alert(1)" })).toMatchObject({ field: "applyUrl" });
  });

  it("only ever treats http and https as links", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("not a url")).toBe("");
  });
});

describe("communityMap: mapping server rows", () => {
  it("maps a community, including the nested filters", () => {
    const row = mapCommunity({ id: "c1", name: "N", description: "d", mission: "m", join_mode: "request", status: "active", member_count: 2, filters: {}, created_at: "2026-01-01T00:00:00Z" });
    expect(row).toMatchObject({ id: "c1", name: "N", joinMode: "request", memberCount: 2 });
    expect(row.filters.skillMode).toBe("any");
  });

  it("carries eligibility and state onto a discovery row", () => {
    const row = mapDiscoveryRow({ ...{ id: "c1", filters: {} }, company: { id: "co", name: "Acme" }, eligibility: { eligible: false, reasons: ["Requires graduation between 2025 and 2026."] }, state: "pending_request" });
    expect(row).toMatchObject({ eligible: false, state: "pending_request", companyName: "Acme" });
    expect(row.reasons).toEqual(["Requires graduation between 2025 and 2026."]);
  });

  it("never invents a verdict when the server sent none", () => {
    expect(mapDiscoveryRow({ id: "c1", filters: {} }).eligible).toBeNull();
  });

  it("keeps a candidate summary free of contact details", () => {
    const candidate = mapCandidate({ id: "u1", full_name: "Sara", headline: "Dev", institution: "NUST", degree: "CS", skills: ["Python"], email: "leak@example.com", phone: "123" });
    expect(candidate).toEqual({ id: "u1", name: "Sara", headline: "Dev", institution: "NUST", degree: "CS", skills: ["Python"] });
    expect(JSON.stringify(candidate)).not.toContain("leak@example.com");
    expect(JSON.stringify(candidate)).not.toContain("123");
  });

  it("maps both invitation shapes the server sends", () => {
    expect(mapInvitation({ id: "i1", user_id: "u1", full_name: "Sara", status: "pending" })).toMatchObject({ id: "i1", userId: "u1", name: "Sara", status: "pending" });
    const candidateSide = mapInvitation({ id: "i1", community: { id: "c1", filters: {}, company: { id: "co", name: "Acme" } } });
    expect(candidateSide.status).toBe("pending");
    expect(candidateSide.community.companyName).toBe("Acme");
  });

  it("maps a join request with its eligibility snapshot", () => {
    const row = mapRequest({ id: "r1", candidate: { id: "u1", full_name: "Sara", skills: [] }, status: "auto_rejected", eligibility: { eligible: false, reasons: ["Requires a degree."] } });
    expect(row).toMatchObject({ id: "r1", status: "auto_rejected", eligible: false });
    expect(row.reasons).toEqual(["Requires a degree."]);
  });
});

describe("communityMap: who may do what", () => {
  it("lets admins and HR managers manage, and nobody else", () => {
    expect(canManageCommunities({ memberRole: "admin" })).toBe(true);
    expect(canManageCommunities({ memberRole: "hr_manager" })).toBe(true);
    expect(canManageCommunities({ memberRole: "recruiter" })).toBe(false);
    expect(canManageCommunities({ memberRole: "viewer" })).toBe(false);
    expect(canManageCommunities(null)).toBe(false);
  });
});
