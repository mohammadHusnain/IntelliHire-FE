import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiJob, detail, json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import ScreeningInvitePanel from "@/components/company/ScreeningInvitePanel";
import CompanyInterviews from "./CompanyInterviews";

const session = (o = {}) => ({
  id: "i1", kind: "screening", status: "evaluated", recommendation: "advance", overall_score: 80,
  invited_at: "2026-06-01T09:00:00Z", application: { id: "app-1", reference: "IH-1", full_name: "Sara Malik" }, ...o,
});
const signIn = (memberRole) => {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", memberRole, companyStatus: "approved" } });
};

function panel({ role = "admin", status = "shortlisted", sessions = [], handlers = [] } = {}) {
  signIn(role);
  server.use(...handlers, route.get("/applications/app-1/interviews/", () => json(sessions)));
  render(<MemoryRouter><ScreeningInvitePanel applicationId="app-1" applicationStatus={status} memberRole={role} /></MemoryRouter>);
}

describe("ScreeningInvitePanel", () => {
  it("invites a shortlisted candidate to a screening interview", async () => {
    let body;
    panel({ handlers: [route.post("/applications/app-1/interviews/", async ({ request }) => (body = await request.json(), json(session({ status: "invited" }), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /invite to screening/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect(body).toEqual({ kind: "screening", expires_in_days: 7, override: false }));
  });

  it("makes a not-shortlisted invitation an override that needs a reason", async () => {
    let body;
    panel({ status: "submitted", handlers: [route.post("/applications/app-1/interviews/", async ({ request }) => (body = await request.json(), json(session(), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /invite to screening/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(await screen.findByText(/Give a reason/)).toBeInTheDocument();
    expect(body).toBeUndefined();
    await user.type(screen.getByLabelText("Reason"), "Referred by the CEO");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect(body).toMatchObject({ kind: "screening", override: true, note: "Referred by the CEO" }));
  });

  it("gives a recruiter no invite for a not-shortlisted candidate, and explains why", async () => {
    panel({ role: "recruiter", status: "submitted" });
    expect(await screen.findByText(/Shortlist this candidate first/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invite to screening/i })).not.toBeInTheDocument();
  });

  it("gives a viewer no invite at all", async () => {
    panel({ role: "viewer" });
    await screen.findByText("Not invited yet.");
    expect(screen.queryByRole("button", { name: /invite to screening/i })).not.toBeInTheDocument();
  });

  it("shows the current status and offers no second invitation while one is open", async () => {
    panel({ sessions: [session({ status: "invited", recommendation: null })] });
    expect(await screen.findByText("Invited")).toBeInTheDocument();
    expect(screen.getByText(/already open/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invite to screening/i })).not.toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    panel({ handlers: [route.post("/applications/app-1/interviews/", () => detail(409, "An interview is already open for this application.", "conflict"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /invite to screening/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(await screen.findByText("An interview is already open for this application.")).toBeInTheDocument();
  });
});

function list({ rows = [session()], handlers = [] } = {}) {
  signIn("admin");
  server.use(
    ...handlers,
    route.get("/jobs/job-1/", () => json(apiJob({ id: "job-1", title: "Django Engineer" }))),
    route.get("/jobs/job-1/interviews/", () => json({ count: rows.length, next: null, previous: null, results: rows })),
  );
  render(<MemoryRouter initialEntries={["/company/jobs/job-1/interviews"]}><Routes><Route path="/company/jobs/:id/interviews" element={<CompanyInterviews />} /></Routes></MemoryRouter>);
}

describe("CompanyInterviews", () => {
  it("lists the role's interviews with status, score and a link to the candidate", async () => {
    list();
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getAllByText("Evaluated").length).toBeGreaterThan(0);
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open candidate/i })).toHaveAttribute("href", "/company/candidates/app-1");
  });

  it("filters by kind and status through the server", async () => {
    const asked = [];
    list({ handlers: [route.get("/jobs/job-1/interviews/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), json({ count: 1, next: null, previous: null, results: [session()] })))] });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Kind"), "technical");
    await waitFor(() => expect(asked.at(-1).kind).toBe("technical"));
    await user.selectOptions(screen.getByLabelText("Status"), "expired");
    await waitFor(() => expect(asked.at(-1).status).toBe("expired"));
  });

  it("says when there are none, with no invented rows", async () => {
    list({ rows: [] });
    expect(await screen.findByText("No interviews yet")).toBeInTheDocument();
  });

  it("treats another company's role as not found", async () => {
    list({ handlers: [route.get("/jobs/job-1/interviews/", () => detail(404, "Job not found.", "not_found")), route.get("/jobs/job-1/", () => detail(404, "Job not found.", "not_found"))] });
    expect(await screen.findByText("Role not found")).toBeInTheDocument();
  });
});
