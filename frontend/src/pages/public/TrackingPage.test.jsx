import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import TrackingPage from "./TrackingPage";

const app = {
  id: "11111111-1111-1111-1111-111111111111", reference: "IH-001", job_title: "Frontend Engineer", company_name: "Acme",
  applied_at: "2026-11-01T10:00:00Z", status: "interview", status_label: "Interview scheduled", current_stage: "screening",
  stages: [{ key: "cv", label: "CV review", state: "done" }, { key: "screening", label: "Screening interview", state: "current" }],
  pending_invitation: null, decision: null, timeline: [],
};

function mount(path) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/track/request-link" element={<TrackingPage />} />
    <Route path="/track/:token" element={<TrackingPage />} />
  </Routes></MemoryRouter>);
}

describe("public tracking", () => {
  it("loads a token link without auth and renders candidate-safe application status", async () => {
    let authHeader = "unset";
    server.use(route.get("/public/track/secret-token/", ({ request }) => ((authHeader = request.headers.get("authorization")), json(app))));
    mount("/track/secret-token");
    expect(await screen.findByRole("heading", { name: /frontend engineer at acme/i })).toBeInTheDocument();
    expect(screen.getByText("Interview scheduled")).toBeInTheDocument();
    expect(authHeader).toBe(null);
  });

  it("submits the lost-link email with the same neutral confirmation", async () => {
    let submitted;
    server.use(route.post("/public/track/request-link/", async ({ request }) => ((submitted = await request.json()), json({ detail: "If we found applications for this email, we have sent you the links to follow them." }))));
    const user = userEvent.setup();
    mount("/track/request-link");
    await user.type(screen.getByLabelText("Email address"), "sara@example.com");
    await user.click(screen.getByRole("button", { name: /send tracking links/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/if we found applications/i);
    expect(submitted).toEqual({ email: "sara@example.com" });
  });
});
