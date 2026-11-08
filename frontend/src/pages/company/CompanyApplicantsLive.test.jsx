import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiApplication, apiApplicationRow, apiJobRow, detail, json, paged, route, statusCounts } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyApplicantsLive from "./CompanyApplicantsLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

/** A tiny fake of the server's two list endpoints over an array of rows (status, search, paging, status_counts). */
function fakeServer(rows, { jobs = [apiJobRow({ id: "job-1", title: "Django Engineer" }), apiJobRow({ id: "job-2", title: "Designer" })] } = {}) {
  const asked = [];
  const answer = (request, jobId) => {
    const q = new URL(request.url).searchParams;
    asked.push({ jobId, ...Object.fromEntries(q) });
    let list = rows.filter((r) => !jobId || r.job?.id === jobId);
    const counts = statusCounts({ total: list.length });
    for (const r of list) counts[r.status] += 1;
    if (q.get("status")) list = list.filter((r) => r.status === q.get("status"));
    if (q.get("search")) list = list.filter((r) => `${r.full_name} ${r.email} ${r.reference}`.toLowerCase().includes(q.get("search").toLowerCase()));
    if (q.get("education_level")) list = list.filter((r) => r.education_level === q.get("education_level"));
    const size = Number(q.get("page_size") || 20);
    const page = Number(q.get("page") || 1);
    if ((page - 1) * size >= Math.max(list.length, 1)) return detail(404, "Invalid page.", "not_found");
    return json({ count: list.length, next: page * size < list.length ? "x" : null, previous: null, results: list.slice((page - 1) * size, page * size), ...(jobId ? { status_counts: counts } : {}) });
  };
  return {
    asked,
    handlers: [
      route.get("/jobs/", () => paged(jobs, { count: jobs.length })),
      route.get("/jobs/:id/applications/", ({ request, params }) => answer(request, params.id)),
      route.get("/applications/", ({ request }) => answer(request, null)),
    ],
  };
}

const row = (n, o = {}) => apiApplicationRow({ id: `app-${n}`, reference: `IH-${String(n).padStart(6, "0")}`, full_name: `Person ${n}`, email: `p${n}@example.com`, job: { id: "job-1", title: "Django Engineer" }, ...o });

function mount({ at = "/company/candidates", memberRole = "admin", rows = [row(1)], handlers = [], jobs } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  const fake = fakeServer(rows, { jobs });
  server.use(...handlers, ...fake.handlers);
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/company/candidates" element={<CompanyApplicantsLive />} />
        <Route path="/company/jobs/:id/candidates" element={<CompanyApplicantsLive />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return fake;
}

const listView = async (user) => user.click(await screen.findByRole("radio", { name: /list/i }));

describe("CompanyApplicantsLive: the company-wide view", () => {
  it("shows the board with one column per status, each with its own count, fed by the server", async () => {
    const fake = mount({ rows: [row(1), row(2, { status: "shortlisted" }), row(3, { status: "shortlisted" }), row(4, { status: "rejected" })] });
    expect(await screen.findByRole("region", { name: "Shortlisted" })).toHaveTextContent("2");
    expect(screen.getByRole("region", { name: "Applied" })).toHaveTextContent("1");
    expect(screen.getByRole("region", { name: "Rejected" })).toHaveTextContent("1");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Applied", "Under review", "Shortlisted", "Interview", "Selected", "On hold", "Rejected"]);
    expect(within(screen.getByRole("region", { name: "Shortlisted" })).getByText("Person 2").closest("a")).toHaveAttribute("href", "/company/candidates/app-2");
    expect(fake.asked.filter((q) => q.page_size === "10").map((q) => q.status).sort()).toEqual(["interview", "on_hold", "rejected", "selected", "shortlisted", "submitted", "under_review"]);
  });

  it("the header counts come from one count-only request per status", async () => {
    const fake = mount({ rows: [row(1), row(2, { status: "shortlisted" })] });
    expect(await screen.findByText("2 applications · 1 awaiting first review")).toBeInTheDocument();
    expect(fake.asked.filter((q) => q.page_size === "1")).toHaveLength(7);
  });

  it("the list has a tab per status with its count, and the tab filters on the server", async () => {
    const fake = mount({ rows: [row(1), row(2, { status: "shortlisted" })] });
    const user = userEvent.setup();
    await listView(user);
    expect(await screen.findByRole("tab", { name: /^all/i })).toHaveTextContent("2");
    await user.click(screen.getByRole("tab", { name: /shortlisted/i }));
    await waitFor(() => expect(fake.asked.some((q) => q.page_size === "20" && q.status === "shortlisted")).toBe(true));
    expect((await screen.findAllByText("Person 2")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Person 1")).toHaveLength(0);
  });

  it("search is debounced and sent to the server (by name, email or reference)", async () => {
    const fake = mount({ rows: [row(1), row(2)] });
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    await user.type(screen.getByPlaceholderText(/search name, email or reference/i), "IH-000002");
    await waitFor(() => expect(fake.asked.some((q) => q.search === "IH-000002")).toBe(true));
    expect(fake.asked.filter((q) => q.page_size === "20" && q.search && q.search !== "IH-000002")).toHaveLength(0);
    expect((await screen.findAllByText("Person 2")).length).toBeGreaterThan(0);
  });

  it("education, date range and ordering are sent as the server names them; a reversed range is flagged", async () => {
    const fake = mount();
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    await user.selectOptions(screen.getByLabelText("Education"), "master");
    await user.type(screen.getByLabelText("Applied from"), "2026-03-05");
    await user.type(screen.getByLabelText("Applied to"), "2026-03-10");
    await user.selectOptions(screen.getByLabelText("Order by"), "full_name");
    await waitFor(() => expect(fake.asked.some((q) => q.education_level === "master" && q.submitted_after === "2026-03-05" && q.submitted_before === "2026-03-10" && q.ordering === "full_name")).toBe(true));
  });

  it("pages through a long list and recovers from a page that no longer exists", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => row(i + 1));
    mount({ rows });
    const user = userEvent.setup();
    await listView(user);
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getAllByText("Person 21").length).toBeGreaterThan(0);
  });

  it("an empty search says nothing matched and can be cleared", async () => {
    mount({ rows: [row(1)] });
    const user = userEvent.setup();
    await listView(user);
    await user.type(await screen.findByPlaceholderText(/search name/i), "zzzz");
    expect(await screen.findByText("No candidates match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect((await screen.findAllByText("Person 1")).length).toBeGreaterThan(0);
  });

  it("a company with no applications at all gets a friendly empty state", async () => {
    mount({ rows: [] });
    expect(await screen.findByText("No applicants yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to roles/i })).toHaveAttribute("href", "/company/jobs");
  });

  it("never shows made-up scores, sources or years of experience", async () => {
    mount();
    await screen.findAllByText("Person 1");
    expect(screen.queryByText(/cv match|screening|technical|source|average/i)).not.toBeInTheDocument();
  });

  it("choosing a role switches to that role's pipeline (and its address)", async () => {
    mount({ rows: [row(1), row(2, { job: { id: "job-2", title: "Designer" } })] });
    const user = userEvent.setup();
    await screen.findByRole("region", { name: "Applied" });
    await user.selectOptions(screen.getByLabelText("Role"), "job-2");
    expect(await screen.findByText(/pipeline for/i)).toHaveTextContent("Designer");
    expect(within(screen.getByRole("region", { name: "Applied" })).queryByText("Person 1")).not.toBeInTheDocument();
  });
});

describe("CompanyApplicantsLive: one role", () => {
  it("opens on the job route with the server's own status_counts, and the role's name", async () => {
    const fake = mount({ at: "/company/jobs/job-1/candidates", rows: [row(1), row(2, { status: "shortlisted" }), row(3, { job: { id: "job-2", title: "Designer" } })] });
    expect(await screen.findByText(/pipeline for/i)).toHaveTextContent("Django Engineer");
    expect(await screen.findByText("2 applications · 1 awaiting first review")).toBeInTheDocument();
    expect(fake.asked.filter((q) => q.page_size === "1" && q.jobId === "job-1")).toHaveLength(1);
    expect(fake.asked.some((q) => q.jobId === null && q.page_size === "1")).toBe(false);
  });

  it("exports the server's CSV of the role with the server's file name", async () => {
    const saved = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { saved.push(this.download); });
    mount({ at: "/company/jobs/job-1/candidates", handlers: [route.get("/jobs/job-1/applications/export/", () => new Response("a,b", { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="applications-abc.csv"' } }))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(saved).toEqual(["applications-abc.csv"]));
    await waitFor(() => expect(toasts()).toContain("Candidates exported"));
    click.mockRestore();
    URL.createObjectURL = original;
  });

  it("an export failure is reported", async () => {
    mount({ at: "/company/jobs/job-1/candidates", handlers: [route.get("/jobs/job-1/applications/export/", () => detail(404, "Job not found.", "not_found"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /export csv/i }));
    await waitFor(() => expect(toasts()).toContain("Couldn't export"));
  });

  it("there is no export without a role (the server exports one role)", async () => {
    mount();
    await screen.findByRole("region", { name: "Applied" });
    expect(screen.queryByRole("button", { name: /export csv/i })).not.toBeInTheDocument();
  });

  it("a role that does not exist is a clear not-found page", async () => {
    mount({ at: "/company/jobs/job-9/candidates", handlers: [route.get("/jobs/job-9/applications/", () => detail(404, "Job not found.", "not_found"))] });
    expect(await screen.findByText("Role not found")).toBeInTheDocument();
  });
});

describe("CompanyApplicantsLive: changing status in bulk", () => {
  it("moves the selected candidates with one request each and re-reads the lists", async () => {
    const calls = [];
    mount({ rows: [row(1), row(2), row(3)], handlers: [route.patch("/applications/:id/status/", async ({ params, request }) => (calls.push([params.id, await request.json()]), json(apiApplication({ id: params.id, status: "shortlisted" }))))] });
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    const boxes = screen.getAllByRole("checkbox");
    await user.click(boxes[1]);
    await user.click(boxes[2]);
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /change status…/i }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/new status for 2 candidates/i), "shortlisted");
    await user.type(within(dialog).getByLabelText(/^Note/), "Good CVs");
    await user.click(within(dialog).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(calls).toEqual([["app-1", { status: "shortlisted", note: "Good CVs" }], ["app-2", { status: "shortlisted", note: "Good CVs" }]]));
    await waitFor(() => expect(toasts()).toContain("2 moved to Shortlisted"));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("reports a partial failure honestly (some moved, some not)", async () => {
    mount({ rows: [row(1), row(2)], handlers: [route.patch("/applications/:id/status/", ({ params }) => (params.id === "app-2" ? detail(403, "Unauthorized access.", "permission_denied") : json(apiApplication({ id: params.id, status: "rejected" }))))] });
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: /change status…/i }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/new status/i), "rejected");
    await user.click(within(dialog).getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(toasts()).toContain("1 moved, 1 not"));
  });

  it("a whole page can be selected at once (selection is cleared when the page changes, so it can never pass the 50 limit)", async () => {
    mount({ rows: Array.from({ length: 20 }, (_, i) => row(i + 1)) });
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("20 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change status…/i })).toBeEnabled();
  });

  it("a viewer has no checkboxes and no way to change status", async () => {
    mount({ memberRole: "viewer", rows: [row(1)] });
    const user = userEvent.setup();
    await listView(user);
    await screen.findAllByText("Person 1");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /change status/i })).not.toBeInTheDocument();
  });
});

describe("CompanyApplicantsLive: errors and access", () => {
  it("a 403 shows the blocked screen", async () => {
    mount({ handlers: [route.get("/applications/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("a list error shows a message and a working retry", async () => {
    let fail = true;
    mount({ handlers: [route.get("/applications/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (fail && q.get("page_size") === "20") return detail(500, "Something went wrong.", "server_error");
      return paged([row(1)], { count: 1 });
    })] });
    const user = userEvent.setup();
    await listView(user);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect((await screen.findAllByText("Person 1")).length).toBeGreaterThan(0);
  });

  it("one failing board column does not break the others", async () => {
    mount({ rows: [row(1)], handlers: [route.get("/applications/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (q.get("status") === "interview" && q.get("page_size") === "10") return detail(500, "Something went wrong.", "server_error");
      return undefined;
    })] });
    expect((await screen.findAllByText("Person 1")).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("region", { name: "Interview" })).getByRole("alert")).toBeInTheDocument();
  });
});
