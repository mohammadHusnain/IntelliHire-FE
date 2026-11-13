import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { bearer, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { cvAnalysisApi } from "./cvAnalysisApi";

const signedIn = () => setTokens({ access: "access-token", refresh: "refresh-token" });

describe("cvAnalysisApi", () => {
  it("loads the per-job screening config and sends the authenticated session", async () => {
    signedIn();
    let authorization;
    server.use(route.get("/jobs/job-1/screening-config/", ({ request }) => {
      authorization = bearer(request);
      return json({ shortlist_threshold: 70, warnings: [] });
    }));
    expect(await cvAnalysisApi.config("job-1")).toMatchObject({ shortlist_threshold: 70 });
    expect(authorization).toBe("Bearer access-token");
  });

  it("uses backend filter names and returns pagination metadata for ranking", async () => {
    signedIn();
    let params;
    server.use(route.get("/jobs/job-1/ranking/", ({ request }) => {
      params = Object.fromEntries(new URL(request.url).searchParams);
      return paged([{ id: "app-1", rank: 1, score: 82 }], { count: 21, next: "?page=2", previous: null });
    }));
    const result = await cvAnalysisApi.ranking("job-1", { minScore: 70, status: "under_review", analysisStatus: "completed", page: 1, pageSize: 20 });
    expect(params).toEqual({ min_score: "70", status: "under_review", analysis_status: "completed", page: "1", page_size: "20" });
    expect(result).toEqual({ count: 21, hasNext: true, hasPrevious: false, results: [{ id: "app-1", rank: 1, score: 82 }] });
  });

  it("updates only the threshold without changing AI scoring weights", async () => {
    signedIn();
    let body;
    server.use(route.put("/jobs/job-1/screening-config/", async ({ request }) => {
      body = await request.json();
      return json({ shortlist_threshold: 75, weight_skills: 50, weight_experience: 25, weight_education: 15, weight_semantic: 10, warnings: [] });
    }));
    await cvAnalysisApi.updateConfig("job-1", { shortlist_threshold: 75 });
    expect(body).toEqual({ shortlist_threshold: 75 });
  });

  it("loads analysis detail and separates shortlist preview from applying decisions", async () => {
    signedIn();
    const requests = [];
    server.use(
      route.get("/applications/app-1/cv-analysis/", () => json({ status: "completed", parsed: {}, flags: [], match: { score: 80 } })),
      route.post("/jobs/job-1/shortlist/apply-threshold/", async ({ request }) => {
        const body = await request.json();
        requests.push(body);
        return json(body.dry_run ? { threshold: 70, would_shortlist: 1, scored: 2 } : { threshold: 70, shortlisted: 1 });
      }),
    );
    expect(await cvAnalysisApi.analysis("app-1")).toMatchObject({ status: "completed", match: { score: 80 } });
    expect(await cvAnalysisApi.previewThreshold("job-1", 70)).toMatchObject({ would_shortlist: 1 });
    expect(await cvAnalysisApi.applyThreshold("job-1", 70)).toMatchObject({ shortlisted: 1 });
    expect(requests).toEqual([{ threshold: 70, dry_run: true }, { threshold: 70 }]);
  });

  it("sends the whole screening config, weights included, as one partial update", async () => {
    signedIn();
    let body;
    server.use(route.put("/jobs/job-1/screening-config/", async ({ request }) => {
      body = await request.json();
      return json({ ...body, warnings: [] });
    }));
    await cvAnalysisApi.updateConfig("job-1", { weight_skills: 40, weight_experience: 30, weight_education: 20, weight_semantic: 10 });
    expect(body).toEqual({ weight_skills: 40, weight_experience: 30, weight_education: 20, weight_semantic: 10 });
    await cvAnalysisApi.updateConfig("job-1", { auto_shortlist: true });
    expect(body).toEqual({ auto_shortlist: true });
  });

  it("begins a run with the backend's mode, defaulting to 'missing'", async () => {
    signedIn();
    const bodies = [];
    server.use(route.post("/jobs/job-1/cv-screening/run/", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return json({ mode: body.mode, queued: 3 }, 202);
    }));
    expect(await cvAnalysisApi.run("job-1")).toEqual({ mode: "missing", queued: 3 });
    await cvAnalysisApi.run("job-1", "full");
    await cvAnalysisApi.run("job-1", "rescore");
    expect(bodies).toEqual([{ mode: "missing" }, { mode: "full" }, { mode: "rescore" }]);
  });

  it("surfaces the 409 when a job has no applications to screen", async () => {
    signedIn();
    server.use(route.post("/jobs/job-1/cv-screening/run/", () => detail(409, "This job has no applications yet.", "no_applications")));
    await expect(cvAnalysisApi.run("job-1")).rejects.toMatchObject({ status: 409, code: "no_applications", message: "This job has no applications yet." });
  });

  it("asks for one CV again, and surfaces the 409 while it is already running", async () => {
    signedIn();
    let method;
    server.use(route.post("/applications/app-1/cv-analysis/rerun/", ({ request }) => {
      method = request.method;
      return json({ detail: "Analysis queued." }, 202);
    }));
    expect(await cvAnalysisApi.rerun("app-1")).toMatchObject({ detail: "Analysis queued." });
    expect(method).toBe("POST");

    server.use(route.post("/applications/app-1/cv-analysis/rerun/", () => detail(409, "This CV is being analysed right now.", "analysis_in_progress")));
    await expect(cvAnalysisApi.rerun("app-1")).rejects.toMatchObject({ status: 409, code: "analysis_in_progress" });
  });

  it("refuses a run for a role of another company the same way as a missing one", async () => {
    signedIn();
    server.use(route.post("/jobs/job-9/cv-screening/run/", () => detail(404, "Job not found.", "not_found")));
    await expect(cvAnalysisApi.run("job-9")).rejects.toMatchObject({ status: 404 });
  });
});
