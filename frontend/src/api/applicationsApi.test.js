import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiApplication, apiApplicationRow, apiNote, bearer, detail, json, paged, route, statusCounts } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { applicationsApi } from "./applicationsApi";

const signedIn = () => setTokens({ access: "A", refresh: "R" });

describe("applicationsApi.list", () => {
  it("a job's list uses the job endpoint, the server's filter names, trimmed search and only valid dates, and returns its counts", async () => {
    signedIn();
    let q;
    server.use(route.get("/jobs/job-1/applications/", ({ request }) => ((q = Object.fromEntries(new URL(request.url).searchParams)), paged([apiApplicationRow()], { count: 45, next: "x", status_counts: statusCounts({ total: 45, submitted: 5 }) }))));
    const page = await applicationsApi.list({ jobId: "job-1", status: "shortlisted", educationLevel: "master", submittedAfter: "2026-01-01", submittedBefore: "garbage", search: " sara ", ordering: "full_name", page: 2, pageSize: 20 });
    expect(q).toEqual({ status: "shortlisted", education_level: "master", submitted_after: "2026-01-01", search: "sara", ordering: "full_name", page: "2", page_size: "20" });
    expect(page).toMatchObject({ count: 45, hasNext: true, statusCounts: { total: 45, submitted: 5 } });
    expect(page.results[0]).toMatchObject({ id: "app-1", name: "Sara Malik" });
  });

  it("without a job it lists the whole company (rows carry their job, no counts)", async () => {
    signedIn();
    server.use(route.get("/applications/", () => paged([apiApplicationRow({ job: { id: "j", title: "Role" } })])));
    const page = await applicationsApi.list({});
    expect(page.statusCounts).toBeNull();
    expect(page.results[0].job).toEqual({ id: "j", title: "Role" });
  });

  it("sends the bearer token", async () => {
    signedIn();
    let auth;
    server.use(route.get("/applications/", ({ request }) => ((auth = bearer(request)), paged([]))));
    await applicationsApi.list({});
    expect(auth).toBe("Bearer A");
  });
});

describe("applicationsApi.counts", () => {
  it("a job's counts come in one request", async () => {
    signedIn();
    let hits = 0;
    server.use(route.get("/jobs/job-1/applications/", () => (hits++, paged([], { status_counts: statusCounts({ total: 9, submitted: 4 }) }))));
    expect(await applicationsApi.counts({ jobId: "job-1" })).toMatchObject({ total: 9, submitted: 4 });
    expect(hits).toBe(1);
  });

  it("the whole company needs one count-only request per status", async () => {
    signedIn();
    const n = { submitted: 5, under_review: 2, shortlisted: 1, interview: 0, selected: 1, rejected: 3, on_hold: 0 };
    server.use(route.get("/applications/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      expect(q.get("page_size")).toBe("1");
      return paged([], { count: n[q.get("status")] });
    }));
    expect(await applicationsApi.counts({})).toEqual({ ...n, total: 12 });
  });
});

describe("applicationsApi: one application", () => {
  it("reads the detail", async () => {
    signedIn();
    server.use(route.get("/applications/app-1/", () => json(apiApplication())));
    expect((await applicationsApi.get("app-1")).job.title).toBe("Senior Django Engineer");
  });

  it("changes the status with a note and returns the whole application as the server now has it", async () => {
    signedIn();
    let body;
    server.use(route.patch("/applications/app-1/status/", async ({ request }) => ((body = await request.json()), json(apiApplication({ status: "shortlisted" })))));
    expect((await applicationsApi.changeStatus("app-1", "shortlisted", "Strong")).status).toBe("shortlisted");
    expect(body).toEqual({ status: "shortlisted", note: "Strong" });
  });

  it.each([
    [400, { status: ["The application already has this status."] }, "validation_error"],
    [403, { detail: "Unauthorized access.", code: "permission_denied" }, "permission_denied"],
    [404, { detail: "Application not found.", code: "not_found" }, "not_found"],
  ])("exposes a %i refusal of a status change", async (status, body, code) => {
    signedIn();
    server.use(route.patch("/applications/app-1/status/", () => json(body, status)));
    await expect(applicationsApi.changeStatus("app-1", "rejected")).rejects.toMatchObject({ status, code });
  });

  it("reads and adds notes", async () => {
    signedIn();
    let body;
    server.use(
      route.get("/applications/app-1/notes/", () => json([apiNote()])),
      route.post("/applications/app-1/notes/", async ({ request }) => ((body = await request.json()), json(apiNote({ id: 2, text: "Second" }), 201))),
    );
    expect((await applicationsApi.notes("app-1"))[0].author).toBe("Ali Khan");
    expect((await applicationsApi.addNote("app-1", "Second")).id).toBe(2);
    expect(body).toEqual({ text: "Second" });
  });

  it("a note the server refuses (limit) keeps its code", async () => {
    signedIn();
    server.use(route.post("/applications/app-1/notes/", () => detail(400, "An application can have at most 100 notes.", "limit_reached")));
    await expect(applicationsApi.addNote("app-1", "x")).rejects.toMatchObject({ code: "limit_reached" });
  });
});

describe("applicationsApi downloads", () => {
  it("downloads the CV, a file answer (key url-encoded) and the job's CSV with the session's token and the server's file name", async () => {
    signedIn();
    const seen = {};
    const file = (name, type, body) => new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
    server.use(
      route.get("/applications/app-1/resume/", ({ request }) => ((seen.cv = bearer(request)), file("My CV.pdf", "application/pdf", "%PDF-1.4"))),
      route.get("/applications/app-1/files/portfolio/", () => file("portfolio.pdf", "application/pdf", "PORTFOLIO")),
      route.get("/jobs/job-1/applications/export/", () => file("applications-abc.csv", "text/csv", "a,b")),
    );
    const cv = await applicationsApi.downloadResume("app-1");
    expect(seen.cv).toBe("Bearer A");
    expect(cv.filename).toBe("My CV.pdf");
    expect(await cv.blob.text()).toBe("%PDF-1.4");
    expect((await applicationsApi.downloadFile("app-1", "portfolio")).filename).toBe("portfolio.pdf");
    expect((await applicationsApi.exportJob("job-1")).filename).toBe("applications-abc.csv");
  });

  it("a missing file is a 404 with the server's message", async () => {
    signedIn();
    server.use(route.get("/applications/app-1/files/nope/", () => detail(404, "File not found.", "not_found")));
    await expect(applicationsApi.downloadFile("app-1", "nope")).rejects.toMatchObject({ status: 404, message: "File not found." });
  });
});
