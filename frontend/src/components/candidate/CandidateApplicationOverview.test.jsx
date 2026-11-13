import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { setTokens } from "@/api/tokenStorage";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import CandidateApplicationOverview from "./CandidateApplicationOverview";

describe("CandidateApplicationOverview", () => {
  it("shows server application counts and links to pending invitations", async () => {
    setTokens({ access: "access", refresh: "refresh" });
    server.use(route.get("/candidate/dashboard/", () => json({
      counts: { Submitted: 2, Reviewing: 1, "Interview scheduled": 1 },
      total: 4,
      pending_invitations: [{ application_id: "app-1", reference: "IH-001", job_title: "Frontend Engineer", company_name: "Acme", kind: "technical", expires_at: "2026-11-20T10:00:00Z" }],
      recent_mock_sessions: [], unread_notifications: 0, profile: { percent: 100, missing: [] },
    })));
    render(<MemoryRouter><CandidateApplicationOverview /></MemoryRouter>);
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /frontend engineeracmetechnical/i })).toHaveAttribute("href", "/candidate/applications/app-1");
  });
});
