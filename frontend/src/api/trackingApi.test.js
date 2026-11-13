import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { trackingApi } from "./trackingApi";

const rawDetail = {
  id: "11111111-1111-1111-1111-111111111111",
  reference: "IH-001",
  job_title: "Frontend Engineer",
  company_name: "Acme",
  applied_at: "2026-11-01T10:00:00Z",
  status: "interview",
  status_label: "Interview scheduled",
  stages: [{ key: "cv", label: "CV review", state: "done" }],
  current_stage: "screening",
  pending_invitation: { kind: "screening", expires_at: "2026-11-20T10:00:00Z", can_get_link: true },
  decision: null,
  timeline: [{ status: "interview", label: "Interview scheduled", at: "2026-11-10T10:00:00Z" }],
};

describe("trackingApi", () => {
  it("maps application rows and sends status/pagination parameters", async () => {
    setTokens({ access: "access", refresh: "refresh" });
    let url;
    server.use(route.get("/candidate/applications/", ({ request }) => {
      url = new URL(request.url);
      return json({ count: 1, next: "next", previous: null, results: [{
        id: rawDetail.id, reference: "IH-001", job_title: "Frontend Engineer", company_name: "Acme",
        applied_at: rawDetail.applied_at, status: "interview", status_label: "Interview scheduled",
        current_stage: "screening", pending_invitation: true,
      }] });
    }));

    const result = await trackingApi.list({ status: "interview", page: 2, pageSize: 10 });
    expect(url.searchParams.get("status")).toBe("interview");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("10");
    expect(result).toMatchObject({ count: 1, hasNext: true, hasPrevious: false });
    expect(result.results[0]).toMatchObject({ jobTitle: "Frontend Engineer", statusLabel: "Interview scheduled", pendingInvitation: true });
  });

  it("maps detail without adding dates to stages or exposing private fields", async () => {
    server.use(route.get(`/candidate/applications/${rawDetail.id}/`, () => json(rawDetail)));
    const result = await trackingApi.detail(rawDetail.id);
    expect(result.stages[0]).toEqual({ key: "cv", label: "CV review", state: "done" });
    expect(result.pendingInvitation).toEqual({ kind: "screening", expiresAt: rawDetail.pending_invitation.expires_at, canGetLink: true });
    expect(result.timeline[0].at).toBe(rawDetail.timeline[0].at);
    expect(result).not.toHaveProperty("scores");
  });

  it("uses unauthenticated calls for public tracking and lost-link recovery", async () => {
    setTokens({ access: "access", refresh: "refresh" });
    let authHeader = "unset";
    let body;
    server.use(
      route.get("/public/track/private-token/", ({ request }) => ((authHeader = request.headers.get("authorization")), json(rawDetail))),
      route.post("/public/track/request-link/", async ({ request }) => ((authHeader = request.headers.get("authorization")), (body = await request.json()), json({ detail: "If we found applications for this email, we have sent you the links to follow them." }))),
    );

    await trackingApi.publicDetail("private-token");
    await trackingApi.requestLinks("sara@example.com");
    expect(authHeader).toBe(null);
    expect(body).toEqual({ email: "sara@example.com" });
  });

  it("rotates a public interview link without sending bearer credentials", async () => {
    setTokens({ access: "access", refresh: "refresh" });
    let authHeader = "unset";
    server.use(route.post("/public/track/private-token/invitation/link/", ({ request }) => {
      authHeader = request.headers.get("authorization");
      return json({ url: "/interview/rotated", kind: "technical", expires_at: rawDetail.pending_invitation.expires_at });
    }));
    const result = await trackingApi.refreshPublicInterviewLink("private-token");
    expect(authHeader).toBe(null);
    expect(result.url).toBe("/interview/rotated");
  });

  it("posts for an authenticated fresh link and maps dashboard invitation summaries", async () => {
    setTokens({ access: "access", refresh: "refresh" });
    let requestBody = "unset";
    server.use(
      route.post(`/candidate/applications/${rawDetail.id}/invitation/link/`, async ({ request }) => ((requestBody = await request.text()), json({ url: "/interview/new-token", kind: "screening", expires_at: rawDetail.pending_invitation.expires_at }))),
      route.get("/candidate/dashboard/", () => json({
        counts: { Submitted: 1 }, total: 1,
        pending_invitations: [{ application_id: rawDetail.id, reference: "IH-001", job_title: "Frontend Engineer", company_name: "Acme", kind: "screening", expires_at: rawDetail.pending_invitation.expires_at }],
        recent_mock_sessions: [], unread_notifications: 0, profile: { percent: 50, missing: [] },
      })),
    );
    expect(await trackingApi.refreshCandidateInterviewLink(rawDetail.id)).toEqual({ url: "/interview/new-token", kind: "screening", expires_at: rawDetail.pending_invitation.expires_at });
    const dashboard = await trackingApi.dashboard();
    expect(requestBody).toBe("");
    expect(dashboard.pendingInvitations[0]).toMatchObject({ applicationId: rawDetail.id, kind: "screening" });
    expect(dashboard).not.toHaveProperty("unreadNotifications");
  });
});
