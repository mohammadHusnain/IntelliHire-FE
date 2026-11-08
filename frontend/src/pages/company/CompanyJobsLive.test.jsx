import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiJob, apiJobRow, detail, json, paged, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyJobsLive from "./CompanyJobsLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);
const counts = { open: 3, draft: 2, closed: 1 };

function mount({ memberRole = "admin", rows = {}, handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  const asked = [];
  server.use(
    ...handlers,
    route.get("/jobs/departments/", () => json(["Design", "Engineering"])),
    route.get("/jobs/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      asked.push(Object.fromEntries(q));
      if (q.get("page_size") === "1") return paged([], { count: counts[q.get("status")] });
      const status = q.get("status") || "all";
      const list = rows[status] ?? [apiJobRow({ status: status === "all" ? "open" : status })];
      return paged(list, { count: list.length });
    }),
  );
  render(
    <MemoryRouter initialEntries={["/company/jobs"]}>
      <Routes>
        <Route path="/company/jobs" element={<CompanyJobsLive />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return asked;
}

const draft = (o = {}) => apiJobRow({ id: "job-d", title: "Draft Analyst", status: "draft", deadline: null, days_left: null, share_url: null, published_at: null, ...o });
const closed = (o = {}) => apiJobRow({ id: "job-c", title: "Old Designer", status: "closed", days_left: null, ...o });

describe("CompanyJobsLive: the list", () => {
  it("asks the server for the open tab first, with counts per status", async () => {
    const asked = mount();
    expect(await screen.findByText("Senior Django Engineer")).toBeInTheDocument();
    expect(asked.find((q) => q.page_size === "20")).toMatchObject({ status: "open", ordering: "-created_at", page: "1" });
    expect(screen.getByRole("tab", { name: /open/i })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /drafts/i })).toHaveTextContent("2");
  });

  it("shows the applications count (a link to the role's candidates) and the server's days left", async () => {
    mount({ rows: { open: [apiJobRow({ applications_count: 4, days_left: 7 })] } });
    expect(await screen.findByText("4 applications")).toBeInTheDocument();
    expect(screen.getByText(/7 days left/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /4 applications/ })).toHaveAttribute("href", "/company/jobs/job-1/candidates");
  });

  it("switches tab, search, department, type and ordering on the server and goes back to page 1", async () => {
    const asked = mount();
    await screen.findByText("Senior Django Engineer");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /drafts/i }));
    await waitFor(() => expect(asked.some((q) => q.status === "draft" && q.page === "1")).toBe(true));
    await user.selectOptions(screen.getByLabelText("Department"), "Engineering");
    await user.selectOptions(screen.getByLabelText("Employment type"), "contract");
    await user.selectOptions(screen.getByLabelText("Order by"), "-applications_count");
    await user.type(screen.getByPlaceholderText("Search by title"), "django");
    await waitFor(() => expect(asked.some((q) => q.status === "draft" && q.department === "Engineering" && q.employment_type === "contract" && q.ordering === "-applications_count" && q.search === "django")).toBe(true));
    expect(asked.filter((q) => q.page_size === "20" && q.search && q.search !== "django")).toHaveLength(0);
  });

  it("offers every department the company has used", async () => {
    mount();
    await screen.findByText("Senior Django Engineer");
    expect(within(screen.getByLabelText("Department")).getAllByRole("option").map((o) => o.textContent)).toEqual(["All departments", "Design", "Engineering"]);
  });

  it("shows friendly empty states", async () => {
    mount({ rows: { open: [] } });
    expect(await screen.findByText("No open roles")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /post a role/i }).length).toBeGreaterThan(0);
  });

  it("an empty search says nothing matched and can be cleared", async () => {
    mount({ rows: { open: [] } });
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText("Search by title"), "zzz");
    expect(await screen.findByText("No roles match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByPlaceholderText("Search by title")).toHaveValue("");
  });

  it("pages through the list and recovers from a page that no longer exists", async () => {
    let missing = false;
    mount({
      handlers: [route.get("/jobs/", ({ request }) => {
        const q = new URL(request.url).searchParams;
        if (q.get("page_size") === "1") return paged([], { count: 45 });
        if (q.get("page") === "2" && missing) return detail(404, "Invalid page.", "not_found");
        return json({ count: 45, next: q.get("page") === "1" ? "x" : null, previous: null, results: [apiJobRow({ id: `j${q.get("page")}`, title: `Role page ${q.get("page")}` })] });
      })],
    });
    const user = userEvent.setup();
    expect(await screen.findByText("Role page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    missing = true;
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("That page no longer exists.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /go to page 1/i }));
    expect(await screen.findByText("Role page 1")).toBeInTheDocument();
  });

  it("a list error shows a message and a working retry", async () => {
    let fail = true;
    mount({ handlers: [route.get("/jobs/", ({ request }) => {
      const q = new URL(request.url).searchParams;
      if (q.get("page_size") === "1") return paged([], { count: 1 });
      return fail ? detail(500, "Something went wrong.", "server_error") : paged([apiJobRow()]);
    })] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Senior Django Engineer")).toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount({ handlers: [route.get("/jobs/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });
});

describe("CompanyJobsLive: expired roles", () => {
  it("an open role past its deadline is flagged and tells how to continue", async () => {
    mount({ rows: { open: [apiJobRow({ days_left: 0, deadline: "2026-01-01T00:00:00Z" })] } });
    expect(await screen.findByText("Deadline passed")).toBeInTheDocument();
    expect(screen.getByText(/close it, then reopen it/i)).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });
});

describe("CompanyJobsLive: actions", () => {
  it("copies the server's share link for an open role only", async () => {
    mount({ rows: { all: [apiJobRow(), draft()] } });
    const user = userEvent.setup(); // user-event installs its own clipboard, so replace it afterwards
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(await screen.findByRole("tab", { name: /^all/i }));
    await user.click(await screen.findByRole("button", { name: /copy application link for senior django engineer/i }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:5173/apply/slug123456");
    expect(screen.queryByRole("button", { name: /copy application link for draft analyst/i })).not.toBeInTheDocument();
  });

  it("reports a clipboard that is denied", async () => {
    mount();
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    await user.click(await screen.findByRole("button", { name: /copy application link/i }));
    await waitFor(() => expect(toasts()).toContain("Could not copy"));
  });

  it("publishes a draft", async () => {
    let published = false;
    mount({ rows: { draft: [draft()] }, handlers: [route.post("/jobs/job-d/publish/", () => ((published = true), json(apiJob({ id: "job-d", title: "Draft Analyst" }))))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /drafts/i }));
    await user.click(await screen.findByRole("button", { name: "Publish" }));
    await waitFor(() => expect(published).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Role published"));
  });

  it("an incomplete draft that the server refuses opens the editor so it can be fixed", async () => {
    mount({ rows: { draft: [draft()] }, handlers: [route.post("/jobs/job-d/publish/", () => json({ description: ["Description is required to publish."], deadline: ["Deadline is required to publish."] }, 400))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /drafts/i }));
    await user.click(await screen.findByRole("button", { name: "Publish" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-d/edit");
  });

  it("closes an open role", async () => {
    let closedCalled = false;
    mount({ handlers: [route.post("/jobs/job-1/close/", () => ((closedCalled = true), json(apiJob({ status: "closed" }))))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /^close$/i }));
    await waitFor(() => expect(closedCalled).toBe(true));
  });

  it("a 409 (somebody else already changed it) is explained and the list is refreshed", async () => {
    let lists = 0;
    mount({
      handlers: [
        route.get("/jobs/", ({ request }) => {
          const q = new URL(request.url).searchParams;
          if (q.get("page_size") === "1") return paged([], { count: 1 });
          lists += 1;
          return paged([apiJobRow()]);
        }),
        route.post("/jobs/job-1/close/", () => detail(409, "Only open jobs can be closed.", "invalid_state")),
      ],
    });
    await userEvent.setup().click(await screen.findByRole("button", { name: /^close$/i }));
    await waitFor(() => expect(toasts()).toContain("Nothing changed"));
    await waitFor(() => expect(lists).toBeGreaterThan(1));
  });

  it("duplicates a role and opens the new draft", async () => {
    mount({ handlers: [route.post("/jobs/job-1/duplicate/", () => json(apiJob({ id: "job-copy", title: "Senior Django Engineer (copy)", status: "draft" }), 201))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /duplicate senior django engineer/i }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-copy/edit");
  });

  it("deletes a draft only after confirming; a non-draft has no delete", async () => {
    let removed = false;
    mount({ rows: { draft: [draft()], open: [apiJobRow()] }, handlers: [route.delete("/jobs/job-d/", () => ((removed = true), new Response(null, { status: 204 })))] });
    const user = userEvent.setup();
    expect(await screen.findByText("Senior Django Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete /i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /drafts/i }));
    await user.click(await screen.findByRole("button", { name: "Delete Draft Analyst" }));
    expect(removed).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(removed).toBe(true));
  });

  it("a delete the server refuses (409) is explained", async () => {
    mount({ rows: { draft: [draft()] }, handlers: [route.delete("/jobs/job-d/", () => detail(409, "Only draft jobs can be deleted.", "invalid_state"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /drafts/i }));
    await user.click(await screen.findByRole("button", { name: "Delete Draft Analyst" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete draft" }));
    await waitFor(() => expect(toasts()).toContain("Nothing changed"));
  });

  it("reopens a closed role with a new deadline (sent as an instant)", async () => {
    let body;
    mount({ rows: { closed: [closed()] }, handlers: [route.post("/jobs/job-c/reopen/", async ({ request }) => ((body = await request.json()), json(apiJob({ id: "job-c" }))))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /closed/i }));
    await user.click(await screen.findByRole("button", { name: /reopen/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reopen" }));
    expect(await within(dialog).findByText("Choose the new deadline")).toBeInTheDocument();
    expect(body).toBeUndefined();
    await user.type(within(dialog).getByLabelText("New deadline"), "2030-06-01T10:30");
    await user.click(within(dialog).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(body).toEqual({ deadline: new Date(2030, 5, 1, 10, 30).toISOString() }));
  });

  it("shows the server's deadline rule inside the reopen dialog and keeps it open", async () => {
    mount({ rows: { closed: [closed()] }, handlers: [route.post("/jobs/job-c/reopen/", () => json({ deadline: ["Deadline cannot be more than 6 months ahead."] }, 400))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /closed/i }));
    await user.click(await screen.findByRole("button", { name: /reopen/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("New deadline"), "2031-06-01T10:30");
    await user.click(within(dialog).getByRole("button", { name: "Reopen" }));
    expect(await within(dialog).findByText("Deadline cannot be more than 6 months ahead.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("CompanyJobsLive: who sees what", () => {
  it("a viewer can look and preview, nothing else", async () => {
    mount({ memberRole: "viewer", rows: { all: [apiJobRow(), draft(), closed()] } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /^all/i }));
    await screen.findByText("Draft Analyst");
    expect(screen.queryByRole("link", { name: /post a role/i })).not.toBeInTheDocument();
    for (const name of [/^edit$/i, /^publish$/i, /^close$/i, /reopen/i, /duplicate/i, /^delete /i]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /preview/i })).toHaveLength(3);
  });

  it("a recruiter can edit, publish and close but not delete or reopen", async () => {
    mount({ memberRole: "recruiter", rows: { all: [apiJobRow(), draft(), closed()] } });
    await userEvent.setup().click(await screen.findByRole("tab", { name: /^all/i }));
    await screen.findByText("Draft Analyst");
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete /i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  it("an HR manager can also delete drafts and reopen closed roles", async () => {
    mount({ memberRole: "hr_manager", rows: { all: [draft(), closed()] } });
    await userEvent.setup().click(await screen.findByRole("tab", { name: /^all/i }));
    await screen.findByText("Draft Analyst");
    expect(screen.getByRole("button", { name: "Delete Draft Analyst" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reopen/i })).toBeInTheDocument();
  });
});
