import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { evaluationApi } from "./evaluationApi";

describe("evaluationApi", () => {
  beforeEach(() => setTokens({ access: "access-token", refresh: "refresh-token" }));

  it("loads and updates per-job weights with the backend contract", async () => {
    let payload;
    server.use(
      route.get("/jobs/job-1/evaluation-weights/", () => json({ weight_cv: 30, weight_screening: 30, weight_technical: 40, missing_stage_policy: "renormalise" })),
      route.put("/jobs/job-1/evaluation-weights/", async ({ request }) => ((payload = await request.json()), json({ ...payload, updated_at: "2026-11-13T10:00:00Z" }))),
    );
    expect(await evaluationApi.weights("job-1")).toMatchObject({ weight_cv: 30, weight_technical: 40 });
    await evaluationApi.updateWeights("job-1", { weight_cv: 40, weight_screening: 30, weight_technical: 30, missing_stage_policy: "zero" });
    expect(payload).toEqual({ weight_cv: 40, weight_screening: 30, weight_technical: 30, missing_stage_policy: "zero" });
  });

  it("maps the ranking filters and pagination query", async () => {
    let url;
    server.use(route.get("/jobs/job-1/evaluations/", ({ request }) => {
      url = new URL(request.url);
      return json({ count: 24, next: "?page=3", previous: "?page=1", results: [{ application_id: "app-1", rank: 1 }] });
    }));
    const result = await evaluationApi.ranking("job-1", { minScore: 60, maxScore: 90, status: "interview", stage: "technical", partial: false, page: 2 });
    expect(url.searchParams.toString()).toBe("min_score=60&max_score=90&status=interview&stage=technical&partial=false&page=2");
    expect(result).toMatchObject({ count: 24, hasNext: true, hasPrevious: true, results: [{ application_id: "app-1" }] });
  });

  it("requests comparison and per-application evaluation and decision endpoints", async () => {
    const calls = [];
    server.use(
      route.get("/jobs/job-1/evaluations/compare/", ({ request }) => (calls.push(new URL(request.url).searchParams.get("applications")), json({ applications: [] }))),
      route.get("/applications/app-1/evaluation/", () => (calls.push("detail"), json({ application_id: "app-1" }))),
      route.get("/applications/app-1/decisions/", () => (calls.push("decisions"), json([]))),
      route.post("/applications/app-1/decision/", async ({ request }) => (calls.push(await request.json()), json({ status: "selected" }, 201))),
      route.post("/applications/app-1/evaluation/generate/", () => (calls.push("generate"), json({ detail: "Report queued." }, 202))),
    );
    await evaluationApi.compare("job-1", ["app-1", "app-2"]);
    await evaluationApi.detail("app-1");
    await evaluationApi.decisions("app-1");
    await evaluationApi.decide("app-1", { decision: "selected", note: "Strong evidence", notify: false });
    await evaluationApi.generateReport("app-1");
    expect(calls).toEqual(["app-1,app-2", "detail", "decisions", { decision: "selected", note: "Strong evidence", notify: false }, "generate"]);
  });

  it("downloads the application report as a PDF blob", async () => {
    server.use(route.get("/applications/app-1/evaluation/pdf/", () => new Response("pdf-data", { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="evaluation-IH-001.pdf"' } })));
    const file = await evaluationApi.downloadPdf("app-1");
    expect(file.filename).toBe("evaluation-IH-001.pdf");
    expect(file.blob.type).toBe("application/pdf");
  });
});
