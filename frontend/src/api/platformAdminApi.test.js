import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  apiActivityEvent,
  apiAdminDashboard,
  apiAiSettings,
  apiAiUsageRow,
  apiAlert,
  apiCompanyOnboarding,
  apiFlag,
  apiHealth,
  apiPromptVersion,
  apiUserDetail,
  bearer,
  detail,
  json,
  paged,
  route,
} from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { platformAdminApi, reportsApi } from "./platformAdminApi";

const signedIn = () => setTokens({ access: "access-token", refresh: "refresh-token" });

describe("platformAdminApi: reading the platform", () => {
  it("reads every metric block in one authenticated request", async () => {
    signedIn();
    let authorization;
    server.use(route.get("/platform-admin/dashboard/", ({ request }) => {
      authorization = bearer(request);
      return json(apiAdminDashboard());
    }));
    const data = await platformAdminApi.dashboard();
    expect(authorization).toBe("Bearer access-token");
    expect(data.users.total).toBe(40);
    expect(data.interviews_30_days.screening).toBe(6);
  });

  it("uses the endpoints the backend actually exposes, not the ones the guide lists", async () => {
    signedIn();
    const paths = [];
    server.use(
      route.get("/platform-admin/users/u-1/detail/", ({ request }) => (paths.push(new URL(request.url).pathname), json(apiUserDetail()))),
      route.get("/platform-admin/companies/c0/onboarding/", ({ request }) => (paths.push(new URL(request.url).pathname), json(apiCompanyOnboarding()))),
    );
    await platformAdminApi.userDetail("u-1");
    await platformAdminApi.companyOnboarding("c0");
    expect(paths).toEqual(["/api/platform-admin/users/u-1/detail/", "/api/platform-admin/companies/c0/onboarding/"]);
  });

  it("sends the monitors' own filter names", async () => {
    signedIn();
    const asked = [];
    server.use(
      route.get("/platform-admin/jobs/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([]))),
      route.get("/platform-admin/communities/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([]))),
    );
    await platformAdminApi.jobs({ q: " eng ", status: "open", createdFrom: "2026-01-01", createdTo: "2026-02-01" });
    await platformAdminApi.communities({ q: "nust", status: "archived" });
    expect(asked[0]).toMatchObject({ q: "eng", status: "open", created_from: "2026-01-01", created_to: "2026-02-01" });
    expect(asked[1]).toMatchObject({ q: "nust", status: "archived" });
  });

  it("reports health and alerts as the server gives them, nulls included", async () => {
    signedIn();
    server.use(
      route.get("/platform-admin/health/", () => json(apiHealth({ resources: { cpu_percent: null, memory_percent: null, disk_percent: null } }))),
      route.get("/platform-admin/alerts/", () => paged([apiAlert()])),
    );
    const health = await platformAdminApi.health();
    expect(health.resources.cpu_percent).toBeNull();
    const alerts = await platformAdminApi.alerts({ active: true });
    expect(alerts.results[0].severity).toBe("critical");
  });
});

describe("platformAdminApi: moderation", () => {
  it("resolves with only the actions the serializer accepts, and always a note", async () => {
    signedIn();
    const bodies = [];
    server.use(route.post("/platform-admin/moderation/flag-1/resolve/", async ({ request }) => (bodies.push(await request.json()), json(apiFlag({ status: "actioned" })))));
    await platformAdminApi.resolve("flag-1", { note: "spam", action: "dismiss" });
    await platformAdminApi.resolve("flag-1", { note: "removed", action: "act" });
    await platformAdminApi.resolve("flag-1", { note: "default" });
    expect(bodies).toEqual([
      { note: "spam", action: "dismiss" },
      { note: "removed", action: "act" },
      { note: "default", action: "dismiss" },
    ]);
  });

  it("surfaces the 400 when the note is missing and the 409 when another admin is reviewing", async () => {
    signedIn();
    server.use(
      route.post("/platform-admin/moderation/flag-1/resolve/", () => json({ note: ["This field may not be blank."] }, 400)),
      route.post("/platform-admin/moderation/flag-1/review/", () => detail(409, "Already being reviewed.", "conflict")),
    );
    await expect(platformAdminApi.resolve("flag-1", { note: "" })).rejects.toMatchObject({ status: 400 });
    await expect(platformAdminApi.review("flag-1")).rejects.toMatchObject({ status: 409 });
  });

  it("raises a flag against a target", async () => {
    signedIn();
    let body;
    server.use(route.post("/platform-admin/flags/", async ({ request }) => (body = await request.json(), json(apiFlag(), 201))));
    await platformAdminApi.flag("community", "com-1", "spam");
    expect(body).toEqual({ target_type: "community", target_id: "com-1", reason: "spam" });
  });
});

describe("platformAdminApi: the activity log", () => {
  it("filters with the server's parameter names", async () => {
    signedIn();
    let params;
    server.use(route.get("/platform-admin/activity/", ({ request }) => {
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([apiActivityEvent()]);
    }));
    await platformAdminApi.activity({ eventType: "company.approved", from: "2026-01-01", to: "2026-02-01" });
    expect(params).toMatchObject({ event_type: "company.approved", from: "2026-01-01", to: "2026-02-01" });
  });

  it("flags one entry, and reports when the entry points at nothing", async () => {
    signedIn();
    server.use(route.post("/platform-admin/activity/evt-1/flag/", () => detail(400, "This entry does not point at anything that can be flagged.", "no_target")));
    await expect(platformAdminApi.flagActivity("evt-1", "looks wrong")).rejects.toMatchObject({ code: "no_target" });
  });

  it("downloads the export as a file", async () => {
    signedIn();
    server.use(route.get("/platform-admin/activity/export/", () => new Response("id,event\n1,x\n", { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="activity.csv"' } })));
    const { blob, filename } = await platformAdminApi.exportActivity({ eventType: "company.approved" });
    expect(filename).toBe("activity.csv");
    expect(await blob.text()).toContain("id,event");
  });
});

describe("platformAdminApi: AI settings and prompts", () => {
  it("saves settings and surfaces an unknown model as a field error", async () => {
    signedIn();
    let body;
    server.use(route.put("/platform-admin/ai-settings/", async ({ request }) => {
      body = await request.json();
      return body.chat_model === "nope" ? json({ chat_model: ["Unknown model."] }, 400) : json(apiAiSettings(body));
    }));
    await platformAdminApi.updateAiSettings({ chat_model: "gpt-4o" });
    expect(body).toEqual({ chat_model: "gpt-4o" });
    await expect(platformAdminApi.updateAiSettings({ chat_model: "nope" })).rejects.toMatchObject({ status: 400 });
  });

  it("saves a new prompt version and rolls back to an earlier one", async () => {
    signedIn();
    const calls = [];
    server.use(
      route.get("/platform-admin/prompts/cv_extract/", () => paged([apiPromptVersion(), apiPromptVersion({ version: 1, is_active: false })])),
      route.post("/platform-admin/prompts/cv_extract/", async ({ request }) => (calls.push(["save", await request.json()]), json(apiPromptVersion({ version: 3 }), 201))),
      route.post("/platform-admin/prompts/cv_extract/rollback/", async ({ request }) => (calls.push(["rollback", await request.json()]), json(apiPromptVersion({ version: 1, is_active: true })))),
    );
    const versions = await platformAdminApi.promptVersions("cv_extract");
    expect(versions.results).toHaveLength(2);
    await platformAdminApi.savePrompt("cv_extract", { system_text: "s", user_text: "u {cv_text}" });
    await platformAdminApi.rollbackPrompt("cv_extract", 1);
    expect(calls).toEqual([["save", { system_text: "s", user_text: "u {cv_text}" }], ["rollback", { version: 1 }]]);
  });

  it("refuses a prompt that drops a placeholder, with the server's message", async () => {
    signedIn();
    server.use(route.post("/platform-admin/prompts/cv_extract/", () => json({ user_text: ["The placeholder {cv_text} is missing."] }, 400)));
    await expect(platformAdminApi.savePrompt("cv_extract", { system_text: "s", user_text: "u" })).rejects.toMatchObject({ status: 400 });
  });

  it("reads the AI usage report, and an empty range is not an error", async () => {
    signedIn();
    server.use(route.get("/platform-admin/ai-usage/", ({ request }) => {
      const from = new URL(request.url).searchParams.get("from");
      return paged(from === "2020-01-01" ? [] : [apiAiUsageRow()]);
    }));
    expect((await platformAdminApi.aiUsage({ from: "2026-06-01" })).results[0].calls).toBe(12);
    expect((await platformAdminApi.aiUsage({ from: "2020-01-01" })).results).toEqual([]);
  });
});

describe("reportsApi: reporting content", () => {
  it("reports as a signed-in user, and reports a public job without a token", async () => {
    signedIn();
    const seen = [];
    server.use(
      route.post("/reports/", async ({ request }) => (seen.push(["reports", bearer(request), await request.json()]), json(apiFlag(), 201))),
      route.post("/public/report-job/", async ({ request }) => (seen.push(["public", bearer(request), await request.json()]), json({ detail: "Thank you." }, 201))),
    );
    await reportsApi.report("community_post", "post-1", "spam");
    await reportsApi.reportJob("django-engineer", "misleading");
    expect(seen[0]).toEqual(["reports", "Bearer access-token", { target_type: "community_post", target_id: "post-1", reason: "spam" }]);
    expect(seen[1]).toEqual(["public", null, { form_slug: "django-engineer", reason: "misleading" }]);
  });

  it("surfaces the throttle with the wait the server names", async () => {
    signedIn();
    server.use(route.post("/reports/", () => detail(429, "Request was throttled. Expected available in 58 seconds.", "throttled")));
    await expect(reportsApi.report("job", "j1", "spam")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 58 });
  });
});
