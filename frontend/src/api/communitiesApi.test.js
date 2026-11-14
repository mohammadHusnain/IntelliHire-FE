import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  apiCandidateInvitation,
  apiCandidateSummary,
  apiCommunity,
  apiCommunityInvitation,
  apiCommunityMember,
  apiCommunityPost,
  apiDiscoveryRow,
  apiJoinRequest,
  apiPostResponse,
  bearer,
  detail,
  json,
  paged,
  route,
} from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { communitiesApi } from "./communitiesApi";
import { candidateCommunitiesApi } from "./candidateCommunitiesApi";

const signedIn = () => setTokens({ access: "access-token", refresh: "refresh-token" });

describe("communitiesApi: the company side", () => {
  it("lists the company's communities with the session, and asks for no filters the server does not take", async () => {
    signedIn();
    let authorization;
    let params;
    server.use(route.get("/company/communities/", ({ request }) => {
      authorization = bearer(request);
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([apiCommunity()]);
    }));
    const result = await communitiesApi.list({ pageSize: 100 });
    expect(authorization).toBe("Bearer access-token");
    expect(params).toEqual({ page: "1", page_size: "100" });
    expect(result.results[0]).toMatchObject({ id: "com-1", joinMode: "request", memberCount: 3 });
    expect(result.results[0].filters.skillMode).toBe("any");
  });

  it("creates and patches with the flat field names the serializer takes", async () => {
    signedIn();
    const bodies = [];
    server.use(
      route.post("/company/communities/", async ({ request }) => (bodies.push(await request.json()), json(apiCommunity(), 201))),
      route.patch("/company/communities/com-1/", async ({ request }) => (bodies.push(await request.json()), json(apiCommunity()))),
    );
    await communitiesApi.create({ name: "Cohort", filter_skills: ["Python"], filter_skill_mode: "all" });
    await communitiesApi.update("com-1", { join_mode: "invite_only" });
    expect(bodies).toEqual([{ name: "Cohort", filter_skills: ["Python"], filter_skill_mode: "all" }, { join_mode: "invite_only" }]);
  });

  it("sends the reason in the body of a DELETE, for a community and for a member", async () => {
    signedIn();
    const bodies = [];
    server.use(
      route.delete("/company/communities/com-1/", async ({ request }) => (bodies.push(await request.json()), new Response(null, { status: 204 }))),
      route.delete("/company/communities/com-1/members/u-cand-1/", async ({ request }) => (bodies.push(await request.json()), new Response(null, { status: 204 }))),
    );
    await communitiesApi.remove("com-1", "duplicate group");
    await communitiesApi.removeMember("com-1", "u-cand-1", "left the course");
    expect(bodies).toEqual([{ reason: "duplicate group" }, { reason: "left the course" }]);
  });

  it("orders members by the server's own ordering values", async () => {
    signedIn();
    let params;
    server.use(route.get("/company/communities/com-1/members/", ({ request }) => {
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([apiCommunityMember()]);
    }));
    const result = await communitiesApi.members("com-1", { q: " sara ", ordering: "skill_match" });
    expect(params).toMatchObject({ q: "sara", ordering: "skill_match" });
    expect(result.results[0]).toMatchObject({ name: "Sara Malik", source: "request", skillMatch: 1 });
  });

  it("searches candidates with the server's filter names and never receives contact details", async () => {
    signedIn();
    let params;
    server.use(route.get("/company/communities/com-1/candidates/search/", ({ request }) => {
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([{ ...apiCandidateSummary(), eligible: false, reasons: ["Requires a degree."] }]);
    }));
    const rows = await communitiesApi.searchCandidates("com-1", { q: "sara", eligibleOnly: true });
    expect(params).toMatchObject({ q: "sara", eligible_only: "true" });
    expect(rows[0].reasons).toEqual(["Requires a degree."]);
    expect(JSON.stringify(rows)).not.toMatch(/@|phone|resume/i);
  });

  it("carries the eligibility warning back from an invitation", async () => {
    signedIn();
    let body;
    server.use(route.post("/company/communities/com-1/invitations/", async ({ request }) => {
      body = await request.json();
      return json({ ...apiCommunityInvitation(), eligibility: { eligible: false, reasons: ["Requires a degree."] } }, 201);
    }));
    const invitation = await communitiesApi.invite("com-1", "u-cand-1", "Join us");
    expect(body).toEqual({ user_id: "u-cand-1", message: "Join us" });
    expect(invitation.eligibility).toEqual({ eligible: false, reasons: ["Requires a degree."] });
  });

  it("refuses a second invitation with the server's 409", async () => {
    signedIn();
    server.use(route.post("/company/communities/com-1/invitations/", () => detail(409, "They are already a member or already invited.", "conflict")));
    await expect(communitiesApi.invite("com-1", "u-cand-1")).rejects.toMatchObject({ status: 409 });
  });

  it("defaults join requests to pending and sends a reason when rejecting", async () => {
    signedIn();
    let params;
    let body;
    server.use(
      route.get("/company/communities/com-1/join-requests/", ({ request }) => {
        params = Object.fromEntries(new URL(request.url).searchParams);
        return paged([apiJoinRequest()]);
      }),
      route.post("/company/communities/com-1/join-requests/req-1/reject/", async ({ request }) => (body = await request.json(), json(apiJoinRequest({ status: "rejected", decision_reason: "not this cohort" })))),
    );
    await communitiesApi.joinRequests("com-1");
    expect(params.status).toBe("pending");
    const rejected = await communitiesApi.rejectRequest("com-1", "req-1", "not this cohort");
    expect(body).toEqual({ reason: "not this cohort" });
    expect(rejected).toMatchObject({ status: "rejected", decisionReason: "not this cohort" });
  });

  it("reads posts with their closed flag and response count, and their responses", async () => {
    signedIn();
    server.use(
      route.get("/company/communities/com-1/posts/", () => paged([apiCommunityPost({ closed: true, responses: 2 })])),
      route.get("/company/communities/com-1/posts/post-1/responses/", () => paged([apiPostResponse()])),
    );
    const posts = await communitiesApi.posts("com-1");
    expect(posts.results[0]).toMatchObject({ closed: true, responses: 2, kind: "job" });
    const responses = await communitiesApi.postResponses("com-1", "post-1");
    expect(responses.results[0].candidate.name).toBe("Sara Malik");
  });

  it("treats another company's community as missing", async () => {
    signedIn();
    server.use(route.get("/company/communities/com-9/", () => detail(404, "Community not found.", "not_found")));
    await expect(communitiesApi.get("com-9")).rejects.toMatchObject({ status: 404 });
  });
});

describe("candidateCommunitiesApi: the candidate side", () => {
  it("discovers communities with eligibility and my state on each row", async () => {
    signedIn();
    let params;
    server.use(route.get("/candidate/communities/", ({ request }) => {
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([apiDiscoveryRow({ eligible: false, reasons: ["Requires graduation between 2025 and 2026."], state: "pending_request" })]);
    }));
    const result = await candidateCommunitiesApi.discover({ q: " nust " });
    expect(params.q).toBe("nust");
    expect(result.results[0]).toMatchObject({ eligible: false, state: "pending_request", companyName: "Acme" });
    expect(result.results[0].reasons).toHaveLength(1);
  });

  it("reads an ineligible join as an answer, not an error", async () => {
    signedIn();
    server.use(route.post("/candidate/communities/com-1/join/", () => json(apiJoinRequest({ status: "auto_rejected", eligible: false, reasons: ["Requires a degree."] }), 200)));
    const result = await candidateCommunitiesApi.join("com-1", "please");
    expect(result.status).toBe("auto_rejected");
    expect(result.reasons).toEqual(["Requires a degree."]);
  });

  it("sends no body at all when there is no message", async () => {
    signedIn();
    let body;
    server.use(route.post("/candidate/communities/com-1/join/", async ({ request }) => (body = await request.json(), json(apiJoinRequest(), 201))));
    await candidateCommunitiesApi.join("com-1");
    expect(body).toEqual({});
  });

  it("surfaces 409 when already a member or waiting", async () => {
    signedIn();
    server.use(route.post("/candidate/communities/com-1/join/", () => detail(409, "You are already a member.", "conflict")));
    await expect(candidateCommunitiesApi.join("com-1")).rejects.toMatchObject({ status: 409 });
  });

  it("treats an invite-only community and a non-member feed as 404", async () => {
    signedIn();
    server.use(
      route.get("/candidate/communities/com-9/", () => detail(404, "Community not found.", "not_found")),
      route.get("/candidate/communities/com-9/feed/", () => detail(404, "Community not found.", "not_found")),
    );
    await expect(candidateCommunitiesApi.get("com-9")).rejects.toMatchObject({ status: 404 });
    await expect(candidateCommunitiesApi.feed("com-9")).rejects.toMatchObject({ status: 404 });
  });

  it("surfaces 410 for an expired invitation and 409 for a repeated response", async () => {
    signedIn();
    server.use(
      route.post("/candidate/community-invitations/inv-1/accept/", () => detail(410, "This invitation has expired.", "expired")),
      route.post("/candidate/community-posts/post-1/respond/", () => detail(409, "You have already responded.", "conflict")),
    );
    await expect(candidateCommunitiesApi.accept("inv-1")).rejects.toMatchObject({ status: 410, code: "expired" });
    await expect(candidateCommunitiesApi.respond("post-1", "hi")).rejects.toMatchObject({ status: 409 });
  });

  it("maps the candidate-side invitation, which carries the community and no status", async () => {
    signedIn();
    server.use(route.get("/candidate/community-invitations/", () => paged([apiCandidateInvitation()])));
    const rows = await candidateCommunitiesApi.invitations();
    expect(rows[0]).toMatchObject({ id: "inv-1", status: "pending" });
    expect(rows[0].community).toMatchObject({ name: "NUST Computer Science 2026", companyName: "Acme" });
  });

  it("lists my communities with the date I joined", async () => {
    signedIn();
    server.use(route.get("/candidate/communities/mine/", () => paged([{ ...apiDiscoveryRow({ state: "member" }), joined_at: "2026-05-20T09:00:00Z" }])));
    const rows = await candidateCommunitiesApi.mine();
    expect(rows[0].state).toBe("member");
    expect(rows[0].joinedAt).toBeTruthy();
  });
});
