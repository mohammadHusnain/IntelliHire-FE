import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiJob, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import CompanyCVAnalysis from "./CompanyCVAnalysis";

const config = {
  auto_analyse: true,
  shortlist_threshold: 70,
  auto_shortlist: false,
  invite_on_shortlist: false,
  weight_skills: 50,
  weight_experience: 25,
  weight_education: 15,
  weight_semantic: 10,
  warnings: [],
};
const progress = {
  total_applications: 3, not_analysed: 0, queued: 1, processing: 0, completed: 2,
  failed: 0, manual_review: 0, paused: 0, stale_scores: 1, in_progress: true, percent_done: 66,
};
const rankedRows = [
  { id: "app-1", rank: 1, reference: "IH-000001", full_name: "Sara Malik", email: "sara@example.com", status: "under_review", submitted_at: "2026-06-03T12:00:00Z", score: 84.5, skills_score: 90, experience_score: 75, education_score: 80, semantic_score: 70, cv_label: "meets_threshold", analysis_status: "completed", stale: false },
  { id: "app-2", rank: 2, reference: "IH-000002", full_name: "Noor Ali", email: "noor@example.com", status: "submitted", submitted_at: "2026-06-02T12:00:00Z", score: null, skills_score: null, experience_score: null, education_score: null, semantic_score: null, cv_label: "analysing", analysis_status: "queued", stale: false },
];
const analysis = {
  status: "completed",
  failure_reason: "",
  flags: ["education_mismatch"],
  parsed: {
    technical_skills: ["Python", "Django"], soft_skills: ["Communication"],
    education: [{ degree: "MSc Computer Science", institution: "UCL", year: "2022" }],
    experience: [{ role: "Backend Engineer", company: "Acme", start: "2022", end: "Present" }],
    projects: [{ name: "Hiring API", summary: "Built a recruiting service" }], achievements: ["Open-source contributor"],
  },
  attempts: 1,
  analysed_at: "2026-06-03T12:00:00Z",
  cv_label: "meets_threshold",
  notice: "Scores and the explanation support, not replace, a person's review.",
  match: {
    score: 84.5, skills_score: 90, experience_score: 75, education_score: 80, semantic_score: 70,
    matched_skills: ["Python", "Django"], missing_skills: ["Kubernetes"], experience_years: 4,
    weights_used: { skills: 50, experience: 25, education: 15, semantic: 10 }, explanation: "Strong backend skills with relevant experience.", stale: false,
  },
};

function mount({ memberRole = "admin", handlers = [] } = {}) {
  setTokens({ access: "access", refresh: "refresh" });
  useAuthStore.setState({
    isAuthenticated: true,
    isInitialized: true,
    user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@example.com", memberRole, companyStatus: "approved" },
  });
  server.use(
    ...handlers,
    route.get("/jobs/job-1/", () => json(apiJob({ id: "job-1", title: "Django Engineer" }))),
    route.get("/jobs/job-1/screening-config/", () => json(config)),
    route.get("/jobs/job-1/cv-screening/", () => json(progress)),
    route.get("/jobs/job-1/ranking/", () => paged(rankedRows, { count: rankedRows.length })),
  );
  render(
    <MemoryRouter initialEntries={["/company/jobs/job-1/cv-analysis"]}>
      <Routes><Route path="/company/jobs/:id/cv-analysis" element={<CompanyCVAnalysis />} /></Routes>
    </MemoryRouter>,
  );
}

describe("CompanyCVAnalysis", () => {
  it("shows server progress and ranked rows without substituting demo scores", async () => {
    mount();
    expect(await screen.findByText("Django Engineer · Review ranked applications and the evidence behind each match.")).toBeInTheDocument();
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getByText("85 / 100")).toBeInTheDocument();
    expect(screen.getByText("67% complete")).toBeInTheDocument();
    expect(screen.getByText("Not analysed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run analysis/i })).toBeDisabled();
  });

  it("filters ranking through the backend query and opens parsed CV details", async () => {
    let asked;
    mount({ handlers: [
      route.get("/jobs/job-1/ranking/", ({ request }) => {
        asked = Object.fromEntries(new URL(request.url).searchParams);
        const filtered = asked.analysis_status === "queued" ? [rankedRows[1]] : rankedRows;
        return paged(filtered, { count: filtered.length });
      }),
      route.get("/applications/app-1/cv-analysis/", () => json(analysis)),
    ] });
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Analysis state"), "queued");
    await waitFor(() => expect(asked?.analysis_status).toBe("queued"));
    await user.selectOptions(screen.getByLabelText("Analysis state"), "");
    await user.click((await screen.findAllByRole("button", { name: "Details" }))[0]);
    const drawer = await screen.findByRole("dialog", { name: "Sara Malik" });
    expect(await within(drawer).findByText("Strong backend skills with relevant experience.")).toBeInTheDocument();
    expect(within(drawer).getByText(/Education mismatch/i)).toBeInTheDocument();
    expect(within(drawer).getByText("Kubernetes")).toBeInTheDocument();
    expect(within(drawer).getByText("MSc Computer Science · UCL · 2022")).toBeInTheDocument();
  });

  it("requires an explicit preview and confirmation before applying a threshold", async () => {
    const requests = [];
    mount({ handlers: [route.post("/jobs/job-1/shortlist/apply-threshold/", async ({ request }) => {
      const body = await request.json();
      requests.push(body);
      return json(body.dry_run ? { threshold: body.threshold, would_shortlist: 1, scored: 2 } : { threshold: body.threshold, shortlisted: 1 });
    })] });
    const user = userEvent.setup();
    const threshold = await screen.findByLabelText("Shortlist threshold");
    await user.clear(threshold);
    await user.type(threshold, "75");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByRole("status").some((element) => element.textContent.includes("1 of 2 scored applications would be shortlisted"))).toBe(true));
    await user.click(screen.getByRole("button", { name: "Shortlist 1" }));
    const dialog = screen.getByRole("dialog", { name: "Apply shortlist threshold?" });
    await user.click(within(dialog).getByRole("button", { name: "Shortlist 1" }));
    await waitFor(() => expect(requests).toEqual([{ threshold: 75, dry_run: true }, { threshold: 75 }]));
  });

  it("keeps threshold mutations disabled for viewers and never calls gated AI endpoints", async () => {
    const seen = [];
    mount({ memberRole: "viewer", handlers: [
      route.post("/jobs/job-1/cv-screening/run/", () => (seen.push("run"), json({ mode: "missing", queued: 0 }, 202))),
      route.post("/applications/app-1/cv-analysis/rerun/", () => (seen.push("rerun"), json({ detail: "Analysis queued." }, 202))),
    ] });
    expect(await screen.findByLabelText("Shortlist threshold")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save threshold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /run analysis/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /run analysis/i }));
    expect(seen).toEqual([]);
  });

  it("shows a retryable ranking error", async () => {
    let hits = 0;
    mount({ handlers: [route.get("/jobs/job-1/ranking/", () => ++hits === 1 ? detail(503, "Screening unavailable.", "service_unavailable") : paged(rankedRows, { count: rankedRows.length }))] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
  });
});
