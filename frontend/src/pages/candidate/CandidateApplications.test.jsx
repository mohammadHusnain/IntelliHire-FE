import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setTokens } from "@/api/tokenStorage";
import { server } from "@/test/server";
import { detail as errorResponse, json, route } from "@/test/fixtures";
import CandidateApplications from "./CandidateApplications";

const appId = "11111111-1111-1111-1111-111111111111";
const row = { id: appId, reference: "IH-001", job_title: "Frontend Engineer", company_name: "Acme", applied_at: "2026-11-01T10:00:00Z", status: "interview", status_label: "Interview scheduled", current_stage: "screening", pending_invitation: true };
const detail = {
  ...row,
  stages: [
    { key: "cv", label: "CV review", state: "done" }, { key: "screening", label: "Screening interview", state: "current" },
    { key: "technical", label: "Technical interview", state: "waiting" }, { key: "decision", label: "Decision", state: "waiting" },
  ],
  pending_invitation: { kind: "screening", expires_at: "2026-11-20T10:00:00Z", can_get_link: true },
  decision: null,
  timeline: [{ status: "interview", label: "Interview scheduled", at: "2026-11-10T10:00:00Z" }],
};

function mount(path = "/candidate/applications") {
  setTokens({ access: "access", refresh: "refresh" });
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/candidate/applications" element={<CandidateApplications />} />
    <Route path="/candidate/applications/:id" element={<CandidateApplications />} />
  </Routes></MemoryRouter>);
}

describe("CandidateApplications", () => {
  it("loads server applications, filters by status and paginates", async () => {
    let listUrl;
    server.use(route.get("/candidate/applications/", ({ request }) => {
      listUrl = new URL(request.url);
      return json({ count: 11, next: listUrl.searchParams.get("page") === "1" ? "?page=2" : null, previous: null, results: [row] });
    }));
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter applications by status" }), "interview");
    await waitFor(() => expect(listUrl.searchParams.get("status")).toBe("interview"));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(listUrl.searchParams.get("page")).toBe("2"));
  });

  it("renders candidate-safe detail and requests a fresh invitation link", async () => {
    let posted = false;
    server.use(
      route.get(`/candidate/applications/${appId}/`, () => json(detail)),
      route.post(`/candidate/applications/${appId}/invitation/link/`, () => ((posted = true), json({ url: "/interview/new-private-token", kind: "screening", expires_at: detail.pending_invitation.expires_at }))),
    );
    const user = userEvent.setup();
    mount(`/candidate/applications/${appId}`);
    expect(await screen.findAllByText("Screening interview")).not.toHaveLength(0);
    expect(screen.getAllByText("Interview scheduled").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /get fresh interview link/i }));
    const open = await screen.findByRole("link", { name: /open interview/i });
    expect(posted).toBe(true);
    expect(open).toHaveAttribute("href", "/interview/new-private-token");
    expect(screen.getByText(/candidate-safe milestones only/i)).toBeInTheDocument();
  });

  it("shows a retry state for list failures and an empty result separately", async () => {
    server.use(route.get("/candidate/applications/", () => errorResponse(503, "Unavailable")));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn’t reach|went wrong|unavailable/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
