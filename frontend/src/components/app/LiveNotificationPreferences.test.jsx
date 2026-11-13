import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/server";
import { json, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import LiveNotificationPreferences from "./LiveNotificationPreferences";

describe("LiveNotificationPreferences", () => {
  it("loads server state and persists a role-supported change", async () => {
    setTokens({ access: "A", refresh: "R" });
    let body;
    server.use(
      route.get("/notifications/preferences/", () => json({ email_communities: false, in_app_reminders: true, in_app_communities: true })),
      route.patch("/notifications/preferences/", async ({ request }) => ((body = await request.json()), json({ email_communities: false, in_app_reminders: false, in_app_communities: true }))),
    );
    render(<LiveNotificationPreferences fields={[{ key: "inAppReminders", title: "Interview reminders", description: "Reminder" }]} />);
    const toggle = await screen.findByRole("switch", { name: "Interview reminders" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(body).toEqual({ in_app_reminders: false }));
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("offers retry when the preference service is unavailable", async () => {
    setTokens({ access: "A", refresh: "R" });
    let attempts = 0;
    server.use(route.get("/notifications/preferences/", () => (++attempts === 1 ? json({ detail: "Unavailable", code: "server_error" }, 500) : json({ notify_applicants: true }))));
    render(<LiveNotificationPreferences fields={[{ key: "notifyApplicants", title: "New applicants", description: "Applications" }]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("switch", { name: "New applicants" })).toHaveAttribute("aria-checked", "true");
  });
});
