import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { json, paged, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { notificationsApi } from "./notificationsApi";

describe("notificationsApi", () => {
  it("maps paginated notifications and server links to the shared UI shape", async () => {
    setTokens({ access: "A", refresh: "R" });
    server.use(route.get("/notifications/", () => paged([{
      id: "n1", kind: "new_applicant", title: "New applicant", body: "Sara applied.", link: "/company/candidates/a1",
      created_at: "2026-11-12T10:00:00Z", read: false,
    }], { next: "http://api.test/api/notifications/?page=2" })));
    expect(await notificationsApi.list()).toEqual({
      count: 1, hasNext: true,
      results: [{ id: "n1", title: "New applicant", body: "Sara applied.", to: "/company/candidates/a1", createdAt: "2026-11-12T10:00:00Z", read: false }],
    });
  });

  it("maps role-specific preferences and sends only the changed server fields", async () => {
    setTokens({ access: "A", refresh: "R" });
    let body;
    server.use(
      route.get("/notifications/preferences/", () => json({ email_communities: false, in_app_reminders: true, in_app_communities: true })),
      route.patch("/notifications/preferences/", async ({ request }) => ((body = await request.json()), json({ email_communities: true, in_app_reminders: true, in_app_communities: true }))),
    );
    expect(await notificationsApi.getPreferences()).toEqual({ emailCommunities: false, inAppReminders: true, inAppCommunities: true });
    expect(await notificationsApi.updatePreferences({ emailCommunities: true })).toEqual({ emailCommunities: true, inAppReminders: true, inAppCommunities: true });
    expect(body).toEqual({ email_communities: true });
  });
});
