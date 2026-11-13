import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import InterviewRoom from "./InterviewRoom";

const summary = (overrides = {}) => ({
  company_name: "Acme Systems",
  role_title: "Platform Engineer",
  kind: "technical",
  status: "invited",
  instructions: "Answer each technical question in your own words.",
  question_count: 3,
  answered_count: 0,
  estimated_minutes: 12,
  expires_at: "2026-11-20T12:00:00Z",
  seconds_left_to_start: 600,
  voice_available: false,
  ai_disclaimer: "The hiring team reviews all interview responses.",
  current_turn: null,
  ...overrides,
});

function mount() {
  return render(<MemoryRouter initialEntries={["/interview/token-abc"]}><Routes><Route path="/interview/:token" element={<InterviewRoom />} /></Routes></MemoryRouter>);
}

describe("InterviewRoom public invitation mode", () => {
  it("uses the existing room for typed server-backed answers and reports submission, not a local score", async () => {
    let answerPayload;
    server.use(
      route.get("/public/interviews/token-abc/", () => json(summary())),
      route.post("/public/interviews/token-abc/start/", () => json({ done: false, turn: { index: 1, question_text: "Explain an idempotent API.", is_follow_up: false }, answered_count: 0, question_count: 3 })),
      route.post("/public/interviews/token-abc/answer/", async ({ request }) => ((answerPayload = await request.json()), json({ done: true, turn: null, answered_count: 3, question_count: 3 }))),
    );
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole("heading", { name: "Platform Engineer" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /begin interview/i }));
    expect(await screen.findByText("Explain an idempotent API.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Repeated requests should not duplicate side effects.");
    await user.click(screen.getByRole("button", { name: /submit answer/i }));
    expect(await screen.findByRole("heading", { name: "Interview submitted" })).toBeInTheDocument();
    expect(answerPayload).toEqual({ turn_index: 1, answer_text: "Repeated requests should not duplicate side effects." });
    expect(screen.queryByText(/score|report/i)).not.toBeInTheDocument();
  });

  it("keeps the room open and offers a retry when the technical question service is unavailable", async () => {
    let attempts = 0;
    server.use(
      route.get("/public/interviews/token-abc/", () => json(summary())),
      route.post("/public/interviews/token-abc/start/", () => (++attempts === 1
        ? json({ detail: "Question service unavailable.", code: "ai_unavailable" }, 503)
        : json({ done: false, turn: { index: 1, question_text: "Describe a database index.", is_follow_up: false }, answered_count: 0, question_count: 3 }))),
    );
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: /begin interview/i }));
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /begin interview/i }));
    expect(await screen.findByText("Describe a database index.")).toBeInTheDocument();
  });

  it("resumes an already-started interview from the current server turn", async () => {
    server.use(route.get("/public/interviews/token-abc/", () => json(summary({
      status: "in_progress",
      answered_count: 1,
      current_turn: { index: 2, question_text: "How do you prevent a race condition?", is_follow_up: false },
    }))));
    mount();
    expect(await screen.findByText("How do you prevent a race condition?")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });
});
