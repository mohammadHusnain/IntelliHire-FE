import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { detail, json, paged, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { History, Report, Room, Setup } from "./MockInterviewLive";

const session = (o = {}) => ({
  id: "s1", date: "2026-06-01T09:00:00Z", role_title: "Backend Engineer", interview_type: "role_specific", overall_score: null,
  status: "in_progress", feedback_status: "none", answered_count: 0, question_count: 8, use_cv: false, target_role: { title: "Backend Engineer" },
  started_at: null, completed_at: null, feedback_message: "Feedback is not available yet.", voice_available: false, disclaimer: "Practice only.",
  current_turn: null, report: null, transcript: [], ...o,
});
const turn = (index = 1) => ({ index, question_text: `Question ${index}?`, asked_at: "2026-06-01T09:00:00Z", is_follow_up: false });

function mount(path, handlers = []) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "candidate", status: "active", name: "Sara" } });
  server.use(...handlers);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/candidate/interview/setup" element={<Setup />} />
        <Route path="/candidate/interview/room" element={<Room />} />
        <Route path="/candidate/report/:id" element={<Report />} />
        <Route path="/candidate/reports" element={<History />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Setup", () => {
  it("starts a general session and goes to the room", async () => {
    let body;
    mount("/candidate/interview/setup", [
      route.get("/mock-interviews/roles/", () => paged([])),
      route.post("/mock-interviews/", async ({ request }) => (body = await request.json(), json(session({ id: "s9" }), 201))),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: /begin/i }));
    await waitFor(() => expect(body).toEqual({ interview_type: "general", use_cv: false }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/candidate/interview/room?s=s9"));
  });

  it("needs a role for a role-specific session, and sends role_id", async () => {
    let body;
    mount("/candidate/interview/setup", [
      route.get("/mock-interviews/roles/", () => paged([{ id: "r1", title: "Data Analyst", category: "Data", focus_skills: [] }])),
      route.post("/mock-interviews/", async ({ request }) => (body = await request.json(), json(session(), 201))),
    ]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Role specific" }));
    await user.click(screen.getByRole("button", { name: /begin/i }));
    expect(await screen.findByText("Choose a role from the catalog.")).toBeInTheDocument();
    await user.click(await screen.findByText("Data Analyst"));
    await user.click(screen.getByRole("button", { name: /begin/i }));
    await waitFor(() => expect(body).toMatchObject({ interview_type: "role_specific", role_id: "r1" }));
  });

  it("says the daily limit has been reached on 429", async () => {
    mount("/candidate/interview/setup", [
      route.get("/mock-interviews/roles/", () => paged([])),
      route.post("/mock-interviews/", () => detail(429, "limit", "daily_limit")),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: /begin/i }));
    expect(await screen.findByText(/reached today's limit/)).toBeInTheDocument();
  });
});

describe("Room", () => {
  it("shows the open question and sends a typed answer with its turn index", async () => {
    let body;
    mount("/candidate/interview/room?s=s1", [
      route.get("/mock-interviews/s1/", () => json(session({ current_turn: turn(1) }))),
      route.post("/mock-interviews/s1/answer/", async ({ request }) => (body = await request.json(), json({ done: false, turn: turn(2), answered_count: 1, question_count: 8 }))),
    ]);
    const user = userEvent.setup();
    expect(await screen.findByText("Question 1?")).toBeInTheDocument();
    expect(screen.getByText(/Voice answers are not available yet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your answer"), "My answer");
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    await waitFor(() => expect(body).toEqual({ turn_index: 1, answer_text: "My answer" }));
    expect(await screen.findByText("Question 2?")).toBeInTheDocument();
  });

  it("goes to the report when the last answer finishes the session", async () => {
    mount("/candidate/interview/room?s=s1", [
      route.get("/mock-interviews/s1/", () => json(session({ current_turn: turn(8), answered_count: 7 }))),
      route.post("/mock-interviews/s1/answer/", () => json({ done: true, turn: null, answered_count: 8, question_count: 8 })),
    ]);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Your answer"), "Last one");
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/candidate/report/s1"));
  });

  it("refuses an empty answer without a request", async () => {
    const seen = [];
    mount("/candidate/interview/room?s=s1", [
      route.get("/mock-interviews/s1/", () => json(session({ current_turn: turn(1) }))),
      route.post("/mock-interviews/s1/answer/", () => (seen.push(1), json({}))),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: /submit answer/i }));
    expect(await screen.findByText("Type an answer first.")).toBeInTheDocument();
    expect(seen).toEqual([]);
  });

  it("sends a finished session to its report instead of the room", async () => {
    mount("/candidate/interview/room?s=s1", [route.get("/mock-interviews/s1/", () => json(session({ status: "completed" })))]);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/candidate/report/s1"));
  });

  it("ending under three answers cancels and says it does not count", async () => {
    mount("/candidate/interview/room?s=s1", [
      route.get("/mock-interviews/s1/", () => json(session({ current_turn: turn(1) }))),
      route.post("/mock-interviews/s1/end/", () => json(session({ status: "cancelled" }))),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: /end practice/i }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/candidate/reports"));
  });
});

describe("Report", () => {
  it("shows the server's message and no score instead of inventing one", async () => {
    mount("/candidate/report/s1", [route.get("/mock-interviews/s1/", () => json(session({ status: "completed", transcript: [{ index: 1, question: "Q?", answer: "A.", answer_source: "text", score: null, feedback: "", criteria: {} }] })))]);
    expect(await screen.findByText("Feedback is not available yet.")).toBeInTheDocument();
    expect(screen.getByText("Not scored yet")).toBeInTheDocument();
    expect(screen.getByText("A.")).toBeInTheDocument();
  });

  it("offers a retry when feedback failed", async () => {
    let hits = 0;
    mount("/candidate/report/s1", [
      route.get("/mock-interviews/s1/", () => json(session({ status: "completed", feedback_status: "failed" }))),
      route.post("/mock-interviews/s1/feedback/retry/", () => (hits += 1, json({ detail: "Feedback queued." }, 202))),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: /try feedback again/i }));
    await waitFor(() => expect(hits).toBe(1));
  });

  it("treats another candidate's session as not found", async () => {
    mount("/candidate/report/s9", [route.get("/mock-interviews/s9/", () => detail(404, "Not found.", "not_found"))]);
    expect(await screen.findByText("This session was not found.")).toBeInTheDocument();
  });
});

describe("History", () => {
  it("lists sessions with a resume link for an open one, and progress with an empty state", async () => {
    mount("/candidate/reports", [
      route.get("/mock-interviews/", () => paged([session(), session({ id: "s2", status: "completed", overall_score: 72, feedback_status: "ready" })])),
      route.get("/mock-interviews/progress/", () => json({ scored_sessions: 0, scores_over_time: [], dimension_averages: {}, best_score: null, latest_score: null, trend: null })),
    ]);
    expect(await screen.findByRole("link", { name: "Resume" })).toHaveAttribute("href", "/candidate/interview/room?s=s1");
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/candidate/report/s2");
    expect(screen.getByText("Needs 4 scored sessions")).toBeInTheDocument();
  });

  it("says when there are no sessions, and deletes one after confirming", async () => {
    let deleted = false;
    window.confirm = () => true;
    mount("/candidate/reports", [
      route.get("/mock-interviews/", () => paged(deleted ? [] : [session({ status: "completed" })])),
      route.get("/mock-interviews/progress/", () => json({ scored_sessions: 0, scores_over_time: [], dimension_averages: {}, best_score: null, latest_score: null, trend: null })),
      route.delete("/mock-interviews/s1/", () => (deleted = true, new Response(null, { status: 204 }))),
    ]);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Delete session" }));
    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText("No practice sessions yet")).toBeInTheDocument();
  });
});
