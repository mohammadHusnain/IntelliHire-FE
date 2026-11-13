import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import AdminLayout from "./AdminLayout";

describe("AdminLayout notifications", () => {
  it("mounts the server-backed bell for platform admins in live mode", async () => {
    setTokens({ access: "A", refresh: "R" });
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin-1", role: "admin", name: "Platform Admin", email: "admin@example.com" } });
    server.use(route.get("/notifications/unread-count/", () => json({ count: 2 })));
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();
  });
});
