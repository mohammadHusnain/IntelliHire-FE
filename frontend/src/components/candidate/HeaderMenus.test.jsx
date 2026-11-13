import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useCandidateStore } from "@/store/candidateStore";
import { CandidateNotifications } from "./HeaderMenus";

describe("CandidateNotifications in live mode", () => {
  it("uses the server inbox instead of local demo notifications", async () => {
    setTokens({ access: "A", refresh: "R" });
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "candidate", name: "Sara" } });
    useCandidateStore.setState({ records: { u1: { notifications: [{ id: "local", title: "Local demo notice", body: "Not live", to: "", read: false }] } } });
    server.use(
      route.get("/notifications/unread-count/", () => json({ count: 1 })),
      route.get("/notifications/", () => json({ count: 1, next: null, previous: null, results: [{
        id: "server", kind: "interview_reminder", title: "Server notice", body: "Live inbox", link: "", payload: {},
        read: false, read_at: null, created_at: "2026-11-12T10:00:00Z",
      }] })),
    );
    const user = userEvent.setup();
    render(<MemoryRouter><CandidateNotifications /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    expect(await screen.findByText("Server notice")).toBeInTheDocument();
    expect(screen.queryByText("Local demo notice")).not.toBeInTheDocument();
  });
});
