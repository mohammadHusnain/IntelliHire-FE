import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { bearer, json, paged, route } from "@/test/fixtures";
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
});
