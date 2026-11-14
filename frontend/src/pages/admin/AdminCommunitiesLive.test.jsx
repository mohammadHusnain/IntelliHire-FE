import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiFlag, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminCommunitiesLive from "./AdminCommunitiesLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

const adminJob = (overrides = {}) => ({
  id: "job-1", title: "Django Engineer", company: { id: "c0", name: "Acme" }, status: "open",
  department: "Engineering", applications: 4, deadline: null, published_at: "2026-05-01T09:00:00Z",
  created_at: "2026-04-28T09:00:00Z", ...overrides,
});
const adminCommunityRow = (overrides = {}) => ({
  id: "com-1", name: "NUST Computer Science 2026", company: { id: "c0", name: "Acme" },
  status: "active", join_mode: "request", member_count: 3, created_at: "2026-05-01T09:00:00Z", ...overrides,
});

function mount({ jobs = [adminJob()], communities = [adminCommunityRow()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(
    ...handlers,
    route.get("/platform-admin/jobs/", () => paged(jobs)),
    route.get("/platform-admin/communities/", () => paged(communities)),
  );
  render(<MemoryRouter><AdminCommunitiesLive /></MemoryRouter>);
}

describe("AdminCommunitiesLive: the content monitor", () => {
  it("lists every company's jobs, read-only", async () => {
    mount();
    expect(await screen.findByText("Django Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    // A platform admin never edits a company's content from here.
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("filters jobs through the server's own parameters", async () => {
    const asked = [];
    mount({ handlers: [route.get("/platform-admin/jobs/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([adminJob()])))] });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Job status"), "closed");
    await waitFor(() => expect(asked.at(-1).status).toBe("closed"));
    await user.type(screen.getByLabelText("Created from"), "2026-01-01");
    await waitFor(() => expect(asked.at(-1).created_from).toBe("2026-01-01"));
  });

  it("switches to communities and shows the server's figures", async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Communities" }));
    expect(await screen.findByText("NUST Computer Science 2026")).toBeInTheDocument();
    expect(screen.getByText("By request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("flags a community for review from its detail", async () => {
    let body;
    mount({ handlers: [
      route.get("/platform-admin/communities/com-1/", () => json({ ...adminCommunityRow(), description: "d", mission: "m", members_active: 3, posts_total: 1, recent_posts: [], open_flags: [] })),
      route.post("/platform-admin/flags/", async ({ request }) => (body = await request.json(), json(apiFlag(), 201))),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Communities" }));
    await user.click(await screen.findByRole("button", { name: /open/i }));
    const drawer = await screen.findByRole("dialog", { name: /NUST Computer Science 2026/ });
    expect(within(drawer).getByText("No open flags.")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: /flag for review/i }));
    await user.type(within(drawer).getByLabelText(/need review/i), "spam group");
    await user.click(within(drawer).getByRole("button", { name: /raise flag/i }));
    await waitFor(() => expect(body).toEqual({ target_type: "community", target_id: "com-1", reason: "spam group" }));
    await waitFor(() => expect(toasts()).toContain("Flagged for review"));
  });

  it("shows a job's open flags and its applications by status", async () => {
    mount({ handlers: [route.get("/platform-admin/jobs/job-1/", () => json({
      ...adminJob(), description: "About the role", required_skills: ["Python"], employment_type: "full_time",
      work_mode: "remote", location: "Lahore", openings: 2, created_by: "Ali Khan",
      applications_by_status: { submitted: 3, shortlisted: 1 },
      open_flags: [{ id: "f1", reason: "Suspicious pay", source: "reported", status: "open", created_at: "2026-05-02T09:00:00Z" }],
    }))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open/i }));
    const drawer = await screen.findByRole("dialog", { name: /Django Engineer/ });
    expect(await within(drawer).findByText("Suspicious pay")).toBeInTheDocument();
    expect(within(drawer).getByText(/submitted: ?3/)).toBeInTheDocument();
    expect(within(drawer).getByText("Python")).toBeInTheDocument();
  });

  it("says when nothing matches rather than showing an empty table", async () => {
    mount({ jobs: [] });
    expect(await screen.findByText("No jobs match")).toBeInTheDocument();
  });
});
