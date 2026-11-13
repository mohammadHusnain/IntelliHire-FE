import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { interviewsApi } from "./interviewsApi";

describe("interviewsApi", () => {
  beforeEach(() => setTokens({ access: "access-token", refresh: "refresh-token" }));

  it("uses the authenticated company endpoints and exact technical invite contract", async () => {
    let seen;
    server.use(
      route.get("/applications/app-7/interviews/", ({ request }) => {
        seen = { listAuth: request.headers.get("authorization") };
        return json([]);
      }),
      route.post("/applications/app-7/interviews/", async ({ request }) => {
        seen = { ...seen, inviteAuth: request.headers.get("authorization"), invite: await request.json() };
        return json({ id: "session-9", kind: "technical", warnings: [] }, 201);
      }),
    );

    expect(await interviewsApi.listForApplication("app-7")).toEqual([]);
    await interviewsApi.invite("app-7", { kind: "technical", expires_in_days: 8, override: true, note: "Approved exception" });
    expect(seen).toEqual({
      listAuth: "Bearer access-token",
      inviteAuth: "Bearer access-token",
      invite: { kind: "technical", expires_in_days: 8, override: true, note: "Approved exception" },
    });
  });

  it("uses company session action and detail paths", async () => {
    const calls = [];
    server.use(
      route.get("/interviews/s-1/", () => (calls.push(["detail"]), json({ id: "s-1", turns: [] }))),
      route.post("/interviews/s-1/resend/", () => (calls.push(["resend"]), json({ id: "s-1" }))),
      route.post("/interviews/s-1/extend/", async ({ request }) => (calls.push(["extend", await request.json()]), json({ expires_at: "2026-11-20T00:00:00Z" }))),
      route.post("/interviews/s-1/cancel/", () => (calls.push(["cancel"]), json({ id: "s-1" }))),
      route.post("/interviews/s-1/reevaluate/", () => (calls.push(["reevaluate"]), json({ detail: "Evaluation queued." }, 202))),
    );

    await interviewsApi.get("s-1");
    await interviewsApi.resend("s-1");
    await interviewsApi.extend("s-1", 5);
    await interviewsApi.cancel("s-1");
    await interviewsApi.reevaluate("s-1");
    expect(calls).toEqual([["detail"], ["resend"], ["extend", { days: 5 }], ["cancel"], ["reevaluate"]]);
  });

  it("keeps public link requests unauthenticated and sends typed answers", async () => {
    const calls = [];
    server.use(
      route.get("/public/interviews/token-abc/", ({ request }) => (calls.push(["summary", request.headers.get("authorization")]), json({ kind: "technical" }))),
      route.post("/public/interviews/token-abc/start/", ({ request }) => (calls.push(["start", request.headers.get("authorization")]), json({ done: false }))),
      route.post("/public/interviews/token-abc/answer/", async ({ request }) => (calls.push(["answer", request.headers.get("authorization"), await request.json()]), json({ done: true }))),
      route.post("/public/interviews/token-abc/finish/", ({ request }) => (calls.push(["finish", request.headers.get("authorization")]), json({ done: true }))),
    );

    await interviewsApi.publicSummary("token-abc");
    await interviewsApi.startPublic("token-abc");
    await interviewsApi.answerPublic("token-abc", 2, "A typed answer");
    await interviewsApi.finishPublic("token-abc");
    expect(calls).toEqual([
      ["summary", null],
      ["start", null],
      ["answer", null, { turn_index: 2, answer_text: "A typed answer" }],
      ["finish", null],
    ]);
  });
});
