import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiAiUsageRow, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import AdminReportsLive from "./AdminReportsLive";

function mount({ rows = [apiAiUsageRow()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(...handlers, route.get("/platform-admin/ai-usage/", () => paged(rows)));
  render(<MemoryRouter><AdminReportsLive /></MemoryRouter>);
}

describe("AdminReportsLive: the AI usage report", () => {
  it("shows a row per feature per day, with the server's numbers", async () => {
    mount();
    expect((await screen.findAllByText("Cv extract")).length).toBeGreaterThan(0);
    expect(screen.getByText("910 ms")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument(); // prompt + completion tokens
  });

  it("says plainly when there were no AI calls, rather than erroring", async () => {
    mount({ rows: [] });
    expect(await screen.findByText("No AI calls in this range")).toBeInTheDocument();
  });

  it("filters by date and feature through the server", async () => {
    const asked = [];
    mount({ handlers: [route.get("/platform-admin/ai-usage/", ({ request }) => (asked.push(Object.fromEntries(new URL(request.url).searchParams)), paged([apiAiUsageRow()])))] });
    const user = userEvent.setup();
    (await screen.findAllByText("Cv extract"))[0];
    await user.selectOptions(screen.getByLabelText("Feature"), "cv_extract");
    await waitFor(() => expect(asked.at(-1).feature).toBe("cv_extract"));
    expect(asked[0]).toHaveProperty("from");
    expect(asked[0]).toHaveProperty("to");
  });

  it("flags a reversed date range", async () => {
    mount();
    const user = userEvent.setup();
    (await screen.findAllByText("Cv extract"))[0];
    await user.clear(screen.getByLabelText("From"));
    await user.type(screen.getByLabelText("From"), "2030-01-01");
    expect(await screen.findByRole("alert")).toHaveTextContent("start date is after the end date");
  });

  it("offers none of the interview analytics the backend cannot supply", async () => {
    mount();
    (await screen.findAllByText("Cv extract"))[0];
    for (const gone of [/score distribution/i, /average by skill/i, /most practised roles/i, /interview types/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });
});
