import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiCvAnalysis, apiJob, apiRankingRow, apiScreeningConfig, apiScreeningProgress, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import CompanyCVAnalysis from "./CompanyCVAnalysis";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

const rankedRows = [
  apiRankingRow(),
  apiRankingRow({ rank: 2, id: "app-2", reference: "IH-000002", full_name: "Noor Ali", email: "noor@example.com", status: "submitted", submitted_at: "2026-06-02T12:00:00Z", score: null, skills_score: null, experience_score: null, education_score: null, semantic_score: null, cv_label: "analysing", analysis_status: "queued" }),
];
const analysis = apiCvAnalysis({ flags: ["education_mismatch"] });

function mount({ memberRole = "admin", config = apiScreeningConfig(), progress = apiScreeningProgress(), rows = rankedRows, handlers = [] } = {}) {
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
    route.get("/jobs/job-1/ranking/", () => paged(rows, { count: rows.length })),
  );
  render(
    <MemoryRouter initialEntries={["/company/jobs/job-1/cv-analysis"]}>
      <Routes><Route path="/company/jobs/:id/cv-analysis" element={<CompanyCVAnalysis />} /></Routes>
    </MemoryRouter>,
  );
}

describe("CompanyCVAnalysis: progress and ranking", () => {
  it("shows the server's progress and ranked rows without substituting demo scores", async () => {
    mount({ progress: apiScreeningProgress({ percent_done: 66, completed: 2, not_analysed: 1 }) });
    expect(await screen.findByText("Django Engineer · Review ranked applications and the evidence behind each match.")).toBeInTheDocument();
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getByText("85 / 100")).toBeInTheDocument();
    expect(screen.getByText("66%")).toBeInTheDocument();
    expect(screen.getByText(/1 CV has never been analysed/)).toBeInTheDocument();
  });

  it("writes the server's cv_label in words, not as a title-cased key", async () => {
    mount();
    expect(await screen.findByText("Meets threshold")).toBeInTheDocument();
    expect(screen.getByText("Analysing")).toBeInTheDocument();
    expect(screen.queryByText("Meets Threshold")).not.toBeInTheDocument();
  });

  it("filters ranking through the backend query and opens parsed CV details with the AI notice", async () => {
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
    expect(within(drawer).getByText("AI-generated, for review by a person")).toBeInTheDocument();
    expect(within(drawer).getByText("Kubernetes")).toBeInTheDocument();
    expect(within(drawer).getByText("MSc Computer Science · UCL · 2022")).toBeInTheDocument();
  });

  it("shows a retryable ranking error", async () => {
    let hits = 0;
    mount({ handlers: [route.get("/jobs/job-1/ranking/", () => ++hits === 1 ? detail(503, "Screening unavailable.", "service_unavailable") : paged(rankedRows, { count: rankedRows.length }))] });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
  });
});

describe("CompanyCVAnalysis: beginning a run", () => {
  it("confirms before running and sends the chosen mode", async () => {
    const bodies = [];
    mount({ handlers: [route.post("/jobs/job-1/cv-screening/run/", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return json({ mode: body.mode, queued: 4 }, 202);
    })] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /run screening/i }));
    const dialog = await screen.findByRole("dialog", { name: "Begin CV screening?" });
    expect(dialog).toHaveTextContent("Reads the CVs that were never analysed");
    await user.click(within(dialog).getByRole("button", { name: "Run screening" }));
    await waitFor(() => expect(bodies).toEqual([{ mode: "missing" }]));
    await waitFor(() => expect(toasts()).toContain("4 CVs queued"));
  });

  it("sends 'full' when that mode is chosen, and nothing if the dialog is dismissed", async () => {
    const bodies = [];
    mount({ handlers: [route.post("/jobs/job-1/cv-screening/run/", async ({ request }) => {
      bodies.push(await request.json());
      return json({ mode: "full", queued: 9 }, 202);
    })] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Every CV again" }));
    await user.click(screen.getByRole("button", { name: /run screening/i }));
    const dialog = await screen.findByRole("dialog", { name: "Begin CV screening?" });
    expect(dialog).toHaveTextContent("Reads every CV from scratch");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(bodies).toEqual([]);
    await user.click(screen.getByRole("button", { name: /run screening/i }));
    await user.click(within(await screen.findByRole("dialog", { name: "Begin CV screening?" })).getByRole("button", { name: "Run screening" }));
    await waitFor(() => expect(bodies).toEqual([{ mode: "full" }]));
  });

  it("shows the server's message when the role has no applications", async () => {
    mount({ handlers: [route.post("/jobs/job-1/cv-screening/run/", () => detail(409, "This job has no applications yet.", "no_applications"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /run screening/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Run screening" }));
    expect(await screen.findByText("This job has no applications yet.")).toBeInTheDocument();
  });

  it("says a run is already working and does not offer to start another", async () => {
    mount({ progress: apiScreeningProgress({ in_progress: true, queued: 2, percent_done: 40 }) });
    expect(await screen.findByRole("button", { name: /running/i })).toBeDisabled();
    expect(await screen.findByRole("status")).toHaveTextContent("A run is working on this role");
  });

  it("asks the server again while a run is working, stops when it clears, and re-reads the ranking", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let progressHits = 0;
      let rankingHits = 0;
      mount({ handlers: [
        route.get("/jobs/job-1/cv-screening/", () => {
          progressHits += 1;
          return json(apiScreeningProgress({ in_progress: progressHits < 3, queued: 1, percent_done: 50 }));
        }),
        route.get("/jobs/job-1/ranking/", () => {
          rankingHits += 1;
          return paged(rankedRows, { count: rankedRows.length });
        }),
      ] });
      const tick = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
      await waitFor(() => expect(progressHits).toBe(1));
      await tick(4000);
      await waitFor(() => expect(progressHits).toBe(2));
      await tick(4000);
      await waitFor(() => expect(progressHits).toBe(3));
      await waitFor(() => expect(rankingHits).toBeGreaterThan(1));
      const settled = progressHits;
      await tick(30000);
      expect(progressHits).toBe(settled);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CompanyCVAnalysis: out-of-date scores", () => {
  it("warns without re-scoring, and re-scores only when asked", async () => {
    const bodies = [];
    mount({
      progress: apiScreeningProgress({ stale_scores: 2 }),
      handlers: [route.post("/jobs/job-1/cv-screening/run/", async ({ request }) => {
        bodies.push(await request.json());
        return json({ mode: "rescore", queued: 2 }, 202);
      })],
    });
    const banner = await screen.findByRole("region", { name: "Scores are out of date" });
    expect(banner).toHaveTextContent("2 scores were computed before this role's requirements or weights last changed");
    expect(bodies).toEqual([]);
    const user = userEvent.setup();
    await user.click(within(banner).getByRole("button", { name: /re-score/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Re-score" }));
    await waitFor(() => expect(bodies).toEqual([{ mode: "rescore" }]));
  });

  it("shows no banner when nothing is out of date", async () => {
    mount();
    await screen.findByText("Sara Malik");
    expect(screen.queryByRole("region", { name: "Scores are out of date" })).not.toBeInTheDocument();
  });
});

describe("CompanyCVAnalysis: the screening settings", () => {
  it("saves a flag through the config endpoint", async () => {
    const bodies = [];
    mount({ handlers: [route.put("/jobs/job-1/screening-config/", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return json(apiScreeningConfig({ ...body }));
    })] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("switch", { name: "Shortlist at or above the threshold" }));
    await waitFor(() => expect(bodies).toEqual([{ auto_shortlist: true }]));
  });

  it("keeps the interview invitation read-only, as decided", async () => {
    mount({ config: apiScreeningConfig({ invite_on_shortlist: true }) });
    expect(await screen.findByText("Invite to a screening interview on shortlisting")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /invite to a screening interview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Module 7 pending/)).not.toBeInTheDocument();
  });

  it("refuses to send weights that do not total 100, and sends them when they do", async () => {
    const bodies = [];
    mount({ handlers: [route.put("/jobs/job-1/screening-config/", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return json(apiScreeningConfig({ ...body }));
    })] });
    const user = userEvent.setup();
    const skills = await screen.findByLabelText("Skills weight");
    await user.clear(skills);
    await user.type(skills, "60");
    expect(await screen.findByText("The four weights must add up to 100. They add up to 110.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save weights/i })).toBeDisabled();
    expect(bodies).toEqual([]);

    const experience = screen.getByLabelText("Experience weight");
    await user.clear(experience);
    await user.type(experience, "15");
    await waitFor(() => expect(screen.getByRole("button", { name: /save weights/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /save weights/i }));
    await waitFor(() => expect(bodies).toEqual([{ weight_skills: 60, weight_experience: 15, weight_education: 15, weight_semantic: 10 }]));
    await waitFor(() => expect(toasts()).toContain("Weights saved"));
  });

  it("puts the server's weights error on the group", async () => {
    mount({ handlers: [route.put("/jobs/job-1/screening-config/", () => json({ weights: ["The four weights must add up to 100."] }, 400))] });
    const user = userEvent.setup();
    const skills = await screen.findByLabelText("Skills weight");
    await user.clear(skills);
    await user.type(skills, "45");
    const semantic = screen.getByLabelText("Semantic fit weight");
    await user.clear(semantic);
    await user.type(semantic, "15");
    await waitFor(() => expect(screen.getByRole("button", { name: /save weights/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /save weights/i }));
    expect(await screen.findByText("The four weights must add up to 100.")).toBeInTheDocument();
  });

  it("surfaces the server's warning when the role lists no required skills", async () => {
    mount({ config: apiScreeningConfig({ warnings: ["This job lists no required skills, so every CV gets full marks for skills."] }) });
    expect(await screen.findByText("This job lists no required skills, so every CV gets full marks for skills.")).toBeInTheDocument();
  });
});

describe("CompanyCVAnalysis: asking for one CV again", () => {
  const failedRows = [apiRankingRow({ cv_label: "failed", analysis_status: "failed", score: null })];

  it("offers Retry on a failed analysis and queues it", async () => {
    let hits = 0;
    mount({ rows: failedRows, handlers: [route.post("/applications/app-1/cv-analysis/rerun/", () => (hits += 1, json({ detail: "Analysis queued." }, 202)))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Analyse Sara Malik's CV again" }));
    await waitFor(() => expect(hits).toBe(1));
    await waitFor(() => expect(toasts()).toContain("Analysis queued"));
  });

  it("shows the server's message when that CV is already being analysed", async () => {
    mount({ rows: failedRows, handlers: [route.post("/applications/app-1/cv-analysis/rerun/", () => detail(409, "This CV is being analysed right now.", "analysis_in_progress"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Analyse Sara Malik's CV again" }));
    expect(await screen.findByText("This CV is being analysed right now.")).toBeInTheDocument();
  });

  it("does not offer Retry on a completed analysis", async () => {
    mount();
    await screen.findByText("Sara Malik");
    expect(screen.queryByRole("button", { name: /CV again/ })).not.toBeInTheDocument();
  });
});

describe("CompanyCVAnalysis: who may do what", () => {
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

  it("lets a recruiter run a screening but not change any setting", async () => {
    const bodies = [];
    mount({ memberRole: "recruiter", handlers: [
      route.post("/jobs/job-1/cv-screening/run/", async ({ request }) => (bodies.push(await request.json()), json({ mode: "missing", queued: 1 }, 202))),
      route.put("/jobs/job-1/screening-config/", () => detail(403, "Unauthorized access.", "permission_denied")),
    ] });
    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: /run screening/i })).toBeEnabled();
    expect(await screen.findByLabelText("Shortlist threshold")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save threshold" })).toBeDisabled();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Skills weight")).not.toBeInTheDocument();
    expect(screen.getByText("Only company admins and HR managers can change these settings.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /run screening/i }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Run screening" }));
    await waitFor(() => expect(bodies).toEqual([{ mode: "missing" }]));
  });

  it("gives a viewer no control that the server would refuse", async () => {
    const seen = [];
    mount({ memberRole: "viewer", progress: apiScreeningProgress({ stale_scores: 3 }), rows: [apiRankingRow({ analysis_status: "failed", cv_label: "failed", score: null })], handlers: [
      route.post("/jobs/job-1/cv-screening/run/", () => (seen.push("run"), json({ mode: "missing", queued: 0 }, 202))),
      route.post("/applications/app-1/cv-analysis/rerun/", () => (seen.push("rerun"), json({ detail: "Analysis queued." }, 202))),
    ] });
    expect(await screen.findByLabelText("Shortlist threshold")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save threshold" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /run screening/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-score/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CV again/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(seen).toEqual([]);
  });
});
