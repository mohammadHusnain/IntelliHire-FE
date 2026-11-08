import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiField, apiJob, apiJobRow, apiSchema, bearer, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "./tokenStorage";
import { jobsApi } from "./jobsApi";
import { jobFieldsApi } from "./jobFieldsApi";
import { publicJobsApi } from "./publicJobsApi";

const signedIn = () => setTokens({ access: "A", refresh: "R" });

describe("jobsApi", () => {
  it("lists with the server's filter names, trimmed search and paging", async () => {
    signedIn();
    let q;
    server.use(route.get("/jobs/", ({ request }) => ((q = Object.fromEntries(new URL(request.url).searchParams)), paged([apiJobRow()], { count: 45, next: "x" }))));
    const page = await jobsApi.list({ status: "open", department: " Engineering ", employmentType: "contract", search: " django ", ordering: "-applications_count", page: 2, pageSize: 20 });
    expect(q).toEqual({ status: "open", department: "Engineering", employment_type: "contract", search: "django", ordering: "-applications_count", page: "2", page_size: "20" });
    expect(page).toMatchObject({ count: 45, hasNext: true });
    expect(page.results[0]).toMatchObject({ id: "job-1", employmentType: "full_time" });
  });

  it("'all' sends no status filter", async () => {
    signedIn();
    let status = "unset";
    server.use(route.get("/jobs/", ({ request }) => ((status = new URL(request.url).searchParams.get("status")), paged([]))));
    await jobsApi.list({ status: "all" });
    expect(status).toBeNull();
  });

  it("builds the per-status counts from one-row requests", async () => {
    signedIn();
    const n = { open: 5, draft: 2, closed: 7 };
    server.use(route.get("/jobs/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      expect(q.get("page_size")).toBe("1");
      return paged([], { count: n[q.get("status")] });
    }));
    expect(await jobsApi.counts()).toEqual({ open: 5, draft: 2, closed: 7, all: 14 });
  });

  it("reads the departments and a job", async () => {
    signedIn();
    server.use(route.get("/jobs/departments/", () => json(["Design", "Engineering"])), route.get("/jobs/job-1/", () => json(apiJob())));
    expect(await jobsApi.departments()).toEqual(["Design", "Engineering"]);
    expect((await jobsApi.get("job-1")).title).toBe("Senior Django Engineer");
  });

  it("creates a draft, or creates and publishes in one request", async () => {
    signedIn();
    const bodies = [];
    server.use(route.post("/jobs/", async ({ request }) => (bodies.push(await request.json()), json(apiJob(), 201))));
    await jobsApi.create({ title: "T", department: "D" });
    await jobsApi.create({ title: "T", department: "D" }, { publish: true });
    expect(bodies).toEqual([{ title: "T", department: "D" }, { title: "T", department: "D", publish: true }]);
  });

  it("updates, publishes, closes, reopens (with the deadline), duplicates and deletes", async () => {
    signedIn();
    const seen = {};
    server.use(
      route.patch("/jobs/job-1/", async ({ request }) => ((seen.patch = await request.json()), json(apiJob()))),
      route.post("/jobs/job-1/publish/", () => ((seen.publish = true), json(apiJob()))),
      route.post("/jobs/job-1/close/", () => ((seen.close = true), json(apiJob({ status: "closed" })))),
      route.post("/jobs/job-1/reopen/", async ({ request }) => ((seen.reopen = await request.json()), json(apiJob()))),
      route.post("/jobs/job-1/duplicate/", () => ((seen.duplicate = true), json(apiJob({ id: "job-2" }), 201))),
      route.delete("/jobs/job-1/", () => ((seen.remove = true), new Response(null, { status: 204 }))),
    );
    await jobsApi.update("job-1", { title: "New" });
    await jobsApi.publish("job-1");
    expect((await jobsApi.close("job-1")).status).toBe("closed");
    await jobsApi.reopen("job-1", "2030-01-01T00:00:00.000Z");
    expect((await jobsApi.duplicate("job-1")).id).toBe("job-2");
    await jobsApi.remove("job-1");
    expect(seen).toEqual({ patch: { title: "New" }, publish: true, close: true, reopen: { deadline: "2030-01-01T00:00:00.000Z" }, duplicate: true, remove: true });
  });

  it.each([
    ["field_locked", 409, "These fields cannot be changed after publishing: department."],
    ["deadline_passed", 409, "The deadline has passed."],
    ["job_closed", 409, "Closed jobs are read-only."],
    ["invalid_state", 409, "Only draft jobs can be deleted."],
  ])("exposes the %s refusal with its status and message", async (code, status, message) => {
    signedIn();
    server.use(route.patch("/jobs/job-1/", () => detail(status, message, code)));
    await expect(jobsApi.update("job-1", { department: "x" })).rejects.toMatchObject({ code, status, message });
  });

  it("a slug_unavailable (503) keeps its code, with the client's plain retry message", async () => {
    signedIn();
    server.use(route.post("/jobs/job-1/publish/", () => detail(503, "Could not generate a unique link. Please try again.", "slug_unavailable")));
    await expect(jobsApi.publish("job-1")).rejects.toMatchObject({ code: "slug_unavailable", status: 503, message: "Something went wrong. Please try again." });
  });

  it("returns publish problems keyed by field", async () => {
    signedIn();
    server.use(route.post("/jobs/job-1/publish/", () => json({ description: ["Description is required to publish."], deadline: ["Deadline is required to publish."] }, 400)));
    await expect(jobsApi.publish("job-1")).rejects.toMatchObject({ status: 400, fieldErrors: { description: ["Description is required to publish."], deadline: ["Deadline is required to publish."] } });
  });

  it("reads the form preview with the bearer token", async () => {
    signedIn();
    let auth;
    server.use(route.get("/jobs/job-1/form-preview/", ({ request }) => ((auth = bearer(request)), json(apiSchema()))));
    expect((await jobsApi.formPreview("job-1")).fields).toHaveLength(7);
    expect(auth).toBe("Bearer A");
  });
});

describe("jobFieldsApi", () => {
  it("lists, adds, updates, deletes and reorders", async () => {
    signedIn();
    const seen = {};
    server.use(
      route.get("/jobs/job-1/fields/", () => json([apiField()])),
      route.post("/jobs/job-1/fields/", async ({ request }) => ((seen.add = await request.json()), json(apiField({ id: 2, label: "Why us" }), 201))),
      route.patch("/jobs/job-1/fields/2/", async ({ request }) => ((seen.patch = await request.json()), json(apiField({ id: 2, label: "Renamed" })))),
      route.delete("/jobs/job-1/fields/2/", () => ((seen.remove = true), new Response(null, { status: 204 }))),
      route.post("/jobs/job-1/fields/reorder/", async ({ request }) => ((seen.reorder = await request.json()), json([apiField({ id: 2 }), apiField({ id: 1 })]))),
    );
    expect((await jobFieldsApi.list("job-1"))[0].label).toBe("LinkedIn profile");
    expect((await jobFieldsApi.add("job-1", { label: "Why us" })).id).toBe(2);
    expect((await jobFieldsApi.update("job-1", 2, { label: "Renamed" })).label).toBe("Renamed");
    await jobFieldsApi.remove("job-1", 2);
    expect((await jobFieldsApi.reorder("job-1", [2, 1])).map((f) => f.id)).toEqual([2, 1]);
    expect(seen).toEqual({ add: { label: "Why us" }, patch: { label: "Renamed" }, remove: true, reorder: { field_ids: [2, 1] } });
  });

  it.each([
    ["limit_reached", 400, "A job can have at most 30 custom fields."],
    ["field_locked", 409, "A field cannot be deleted after applications were received."],
  ])("exposes %s", async (code, status, message) => {
    signedIn();
    server.use(route.post("/jobs/job-1/fields/", () => detail(status, message, code)));
    await expect(jobFieldsApi.add("job-1", { label: "x" })).rejects.toMatchObject({ code, status, message });
  });

  it("a stale reorder is a 400 on field_ids", async () => {
    signedIn();
    server.use(route.post("/jobs/job-1/fields/reorder/", () => json({ field_ids: ["Send every field ID of this job exactly once."] }, 400)));
    await expect(jobFieldsApi.reorder("job-1", [1])).rejects.toMatchObject({ fieldErrors: { field_ids: ["Send every field ID of this job exactly once."] } });
  });
});

describe("publicJobsApi", () => {
  it("reads the schema without a token and url-encodes the slug", async () => {
    signedIn();
    let auth = "unset";
    let path;
    server.use(route.get("/public/jobs/:slug/", ({ request }) => ((auth = bearer(request)), (path = new URL(request.url).pathname), json(apiSchema()))));
    expect((await publicJobsApi.schema("a/b c")).accepting).toBe(true);
    expect(auth).toBeNull();
    expect(path).toBe("/api/public/jobs/a%2Fb%20c/");
  });

  it("sends the answers as multipart: repeated keys for multiple choice, files as parts, an empty honeypot", async () => {
    let form;
    server.use(route.post("/public/jobs/slug1/apply/", async ({ request }) => ((form = await request.formData()), json({ reference: "IH-ABC123", job_title: "T", company: "Acme", submitted_at: "2026-01-01T00:00:00Z" }, 201))));
    const receipt = await publicJobsApi.apply("slug1", {
      full_name: "Sara Malik", email: "sara@example.com", skills: ["a", "b"], note: "", missing: null, resume: new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" }),
    });
    expect(receipt.reference).toBe("IH-ABC123");
    expect(form.get("full_name")).toBe("Sara Malik");
    expect(form.getAll("skills")).toEqual(["a", "b"]);
    expect(form.has("note")).toBe(false);
    expect(form.has("missing")).toBe(false);
    expect(form.get("hp-website")).toBe("");
    expect(await form.get("resume").text()).toBe("%PDF-1.4");
  });

  it.each([
    [400, { email: ["Enter a valid email address."] }],
  ])("a %i keeps the per-field messages", async (status, body) => {
    server.use(route.post("/public/jobs/slug1/apply/", () => json(body, status)));
    await expect(publicJobsApi.apply("slug1", { email: "x" })).rejects.toMatchObject({ status, fieldErrors: body });
  });

  it.each([
    [410, "This position is no longer accepting applications.", "This position is no longer accepting applications."],
    [413, "The request is too large.", "That file or request is too large."],
    [503, "We could not save your application. Please try again.", "Something went wrong. Please try again."],
  ])("a %i is reported (the client keeps 413 and 5xx messages plain)", async (status, serverMessage, shown) => {
    server.use(route.post("/public/jobs/slug1/apply/", () => detail(status, serverMessage, "x")));
    await expect(publicJobsApi.apply("slug1", { email: "x" })).rejects.toMatchObject({ status, message: shown });
  });
});
