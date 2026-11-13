import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import CompanyEvaluation from "./CompanyEvaluation";

const rankingRows = [
  { rank: 1, application_id: "app-1", reference: "IH-001", full_name: "Sara Malik", email: "sara@example.com", status: "interview", submitted_at: "2026-11-10T10:00:00Z", cv_score: 88, screening_score: 74, technical_score: null, composite_score: 82, is_partial: true, missing_stages: ["technical"], report_status: "none", recommendation: "", decision: null },
  { rank: 2, application_id: "app-2", reference: "IH-002", full_name: "Ali Khan", email: "ali@example.com", status: "shortlisted", submitted_at: "2026-11-09T10:00:00Z", cv_score: 80, screening_score: 76, technical_score: 72, composite_score: 76, is_partial: false, missing_stages: [], report_status: "ready", recommendation: "yes", decision: "on_hold" },
];
const evaluationDetail = (overrides = {}) => ({
  application_id: "app-1",
  scores: { cv: 88, screening: 74, technical: null, composite: 82 },
  is_partial: true,
  missing_stages: ["technical"],
  weights_used: { weight_cv: 30, weight_screening: 30, weight_technical: 40, missing_stage_policy: "renormalise" },
  report_status: "none",
  report: {},
  generated_at: null,
  ai_disclaimer: "AI-assisted summary supports, not replaces, a hiring decision.",
  current_decision: null,
  decisions: [],
  ...overrides,
});

function mount({ memberRole = "admin", extraHandlers = [] } = {}) {
  setTokens({ access: "access-token", refresh: "refresh-token" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "member-1", role: "company", memberRole, status: "active", name: "HR User" } });
  server.use(
    route.get("/jobs/", () => json({ count: 1, next: null, previous: null, results: [{ id: "job-1", title: "Platform Engineer", status: "open" }] })),
    route.get("/jobs/job-1/evaluation-weights/", () => json({ weight_cv: 30, weight_screening: 30, weight_technical: 40, missing_stage_policy: "renormalise", updated_at: "2026-11-01T10:00:00Z" })),
    route.get("/jobs/job-1/evaluations/", () => json({ count: rankingRows.length, next: null, previous: null, results: rankingRows })),
    ...extraHandlers,
  );
  return render(<MemoryRouter><CompanyEvaluation /></MemoryRouter>);
}

describe("CompanyEvaluation", () => {
  it("renders server ranking and preserves partial/missing stage information", async () => {
    mount();
    expect(await screen.findByRole("button", { name: /Sara Malik/ })).toBeInTheDocument();
    expect(screen.getByText("1 missing")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
  });

  it("persists weights only for privileged roles and sends normalized policy names", async () => {
    let update;
    server.use(route.put("/jobs/job-1/evaluation-weights/", async ({ request }) => ((update = await request.json()), json({ ...update, updated_at: "2026-11-13T10:00:00Z" }))));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: /manage weights/i }));
    await user.clear(screen.getByRole("spinbutton", { name: "CV match weight" }));
    await user.type(screen.getByRole("spinbutton", { name: "CV match weight" }), "40");
    await user.clear(screen.getByRole("spinbutton", { name: "Technical weight" }));
    await user.type(screen.getByRole("spinbutton", { name: "Technical weight" }), "30");
    await user.selectOptions(screen.getByRole("combobox", { name: "Missing stage policy" }), "zero");
    await user.click(screen.getByRole("button", { name: /save scoring policy/i }));
    await waitFor(() => expect(update).toEqual({ weight_cv: 40, weight_screening: 30, weight_technical: 30, missing_stage_policy: "zero" }));
  });

  it("makes weights and HR decisions read-only for viewers", async () => {
    mount({ memberRole: "viewer", extraHandlers: [route.get("/applications/app-1/evaluation/", () => json(evaluationDetail()))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /manage weights/i }));
    expect(screen.getByText(/only company admins and hr managers/i)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /sara malik/i }));
    const dialog = await screen.findByRole("dialog", { name: /sara malik evaluation detail/i });
    expect(within(dialog).getByText(/read-only access to hr decisions/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /record decision/i })).not.toBeInTheDocument();
  });

  it("records only backend decision enums with note and notification preference", async () => {
    let requestBody;
    server.use(
      route.get("/applications/app-1/evaluation/", () => json(evaluationDetail())),
      route.post("/applications/app-1/decision/", async ({ request }) => ((requestBody = await request.json()), json({ decision: { id: "d-1" }, status: "selected", hint: { openings: 2, selected: 1, filled: false } }, 201))),
    );
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: /sara malik/i }));
    const dialog = await screen.findByRole("dialog", { name: /sara malik evaluation detail/i });
    await user.type(within(dialog).getByLabelText("Rationale"), "Strong role-relevant evidence");
    await user.selectOptions(within(dialog).getByLabelText("Outcome"), "on_hold");
    await user.click(within(dialog).getByRole("button", { name: /record decision/i }));
    await waitFor(() => expect(requestBody).toEqual({ decision: "on_hold", note: "Strong role-relevant evidence", notify: true }));
    expect(await within(dialog).findByText(/^Decision recorded\./)).toBeInTheDocument();
  });

  it("compares selected candidates using the job-scoped endpoint", async () => {
    let requested;
    server.use(route.get("/jobs/job-1/evaluations/compare/", ({ request }) => (requested = new URL(request.url).searchParams.get("applications"), json({ applications: [] }))));
    const user = userEvent.setup();
    mount();
    await screen.findByRole("button", { name: /sara malik/i });
    await user.click(screen.getByRole("checkbox", { name: "Compare Sara Malik" }));
    await user.click(screen.getByRole("checkbox", { name: "Compare Ali Khan" }));
    await user.click(screen.getByRole("button", { name: /compare selected/i }));
    await waitFor(() => expect(requested).toBe("app-1,app-2"));
    expect(await screen.findByText(/side-by-side api comparison/i)).toBeInTheDocument();
  });
});
