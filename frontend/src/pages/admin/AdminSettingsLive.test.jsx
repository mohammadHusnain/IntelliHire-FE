import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiAiSettings, apiPromptVersion, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import AdminSettingsLive from "./AdminSettingsLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ settings = apiAiSettings(), prompts = [apiPromptVersion()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "admin", role: "admin", status: "active", name: "Admin" } });
  server.use(
    ...handlers,
    route.get("/platform-admin/ai-settings/", () => json(settings)),
    route.get("/platform-admin/prompts/", () => paged(prompts)),
  );
  render(<MemoryRouter><AdminSettingsLive /></MemoryRouter>);
}

describe("AdminSettingsLive: models and limits", () => {
  it("shows the settings the server stores, and never asks for a key", async () => {
    mount();
    expect(await screen.findByLabelText("Chat model")).toHaveValue("gpt-4o-mini");
    expect(screen.getByLabelText("Maximum tokens")).toHaveValue(1200);
    expect(screen.getByText(/API keys are not stored here/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("offers none of the platform settings the backend does not have", async () => {
    mount();
    await screen.findByLabelText("Chat model");
    for (const gone of [/announcement banner/i, /auto-approve companies/i, /candidate sign-ups/i, /company sign-ups/i, /reset the community catalogue/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });

  it("sends only what changed and keeps Save off until something does", async () => {
    let body;
    mount({ handlers: [route.put("/platform-admin/ai-settings/", async ({ request }) => (body = await request.json(), json(apiAiSettings(await Promise.resolve({})))))] });
    const user = userEvent.setup();
    const field = await screen.findByLabelText("Chat model");
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled();
    await user.clear(field);
    await user.type(field, "gpt-4o");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(body).toEqual({ chat_model: "gpt-4o" }));
    await waitFor(() => expect(toasts()).toContain("AI settings saved"));
  });

  it("puts the server's unknown-model refusal on that field", async () => {
    mount({ handlers: [route.put("/platform-admin/ai-settings/", () => json({ chat_model: ["Unknown model."] }, 400))] });
    const user = userEvent.setup();
    const field = await screen.findByLabelText("Chat model");
    await user.clear(field);
    await user.type(field, "nonsense-model");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Unknown model.")).toBeInTheDocument();
  });
});

describe("AdminSettingsLive: prompts", () => {
  const openVersions = async (user) => {
    await user.click(await screen.findByRole("tab", { name: "Prompts" }));
    await user.click(await screen.findByRole("button", { name: /versions/i }));
  };

  it("lists prompt keys with their active version", async () => {
    mount();
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Prompts" }));
    expect(await screen.findByText("Cv extract")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("saves a new version and says the old one is still there", async () => {
    let body;
    mount({ handlers: [
      route.get("/platform-admin/prompts/cv_extract/", () => paged([apiPromptVersion(), apiPromptVersion({ version: 1, is_active: false })])),
      route.post("/platform-admin/prompts/cv_extract/", async ({ request }) => (body = await request.json(), json(apiPromptVersion({ version: 3 }), 201))),
    ] });
    const user = userEvent.setup();
    await openVersions(user);
    const drawer = await screen.findByRole("dialog", { name: /Cv extract/ });
    await user.click(within(drawer).getByRole("button", { name: /edit and save a new version/i }));
    const userText = within(drawer).getByLabelText("User text");
    await user.clear(userText);
    await user.type(userText, "CV: {{cv_text}} extra");
    await user.click(within(drawer).getByRole("button", { name: /save as new version/i }));
    await waitFor(() => expect(body).toBeTruthy());
    expect(body.user_text).toContain("cv_text");
    expect(body.system_text).toBe("You extract CV fields.");
    await waitFor(() => expect(toasts()).toContain("New version active"));
  });

  it("shows the server's refusal when a placeholder is dropped", async () => {
    mount({ handlers: [
      route.get("/platform-admin/prompts/cv_extract/", () => paged([apiPromptVersion()])),
      route.post("/platform-admin/prompts/cv_extract/", () => json({ user_text: ["The placeholder {cv_text} is missing."] }, 400)),
    ] });
    const user = userEvent.setup();
    await openVersions(user);
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("button", { name: /edit and save a new version/i }));
    const userText = within(drawer).getByLabelText("User text");
    await user.clear(userText);
    await user.type(userText, "no placeholder here");
    await user.click(within(drawer).getByRole("button", { name: /save as new version/i }));
    expect(await within(drawer).findByText("The placeholder {cv_text} is missing.")).toBeInTheDocument();
  });

  it("rolls back to an earlier version, and never offers that for the active one", async () => {
    let body;
    mount({ handlers: [
      route.get("/platform-admin/prompts/cv_extract/", () => paged([apiPromptVersion(), apiPromptVersion({ version: 1, is_active: false })])),
      route.post("/platform-admin/prompts/cv_extract/rollback/", async ({ request }) => (body = await request.json(), json(apiPromptVersion({ version: 1, is_active: true })))),
    ] });
    const user = userEvent.setup();
    await openVersions(user);
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("v2 · active")).toBeInTheDocument();
    const rollbacks = within(drawer).getAllByRole("button", { name: /roll back to this/i });
    expect(rollbacks).toHaveLength(1);
    await user.click(rollbacks[0]);
    await waitFor(() => expect(body).toEqual({ version: 1 }));
    await waitFor(() => expect(toasts()).toContain("Rolled back to v1"));
  });

  it("says when no prompt has been seeded", async () => {
    mount({ prompts: [] });
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Prompts" }));
    expect(await screen.findByText("No prompts seeded")).toBeInTheDocument();
  });
});
