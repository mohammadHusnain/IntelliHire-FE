import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiCandidateInvitation, apiCommunityPost, apiDiscoveryRow, apiJoinRequest, detail, json, paged, route } from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import CandidateCommunitiesLive from "./CandidateCommunitiesLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ rows = [apiDiscoveryRow()], invitations = [], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "candidate", status: "active", name: "Sara", email: "sara@example.com" } });
  server.use(
    ...handlers,
    route.get("/candidate/community-invitations/", () => paged(invitations)),
    route.get("/candidate/communities/", () => paged(rows)),
    route.get("/candidate/communities/mine/", () => paged([])),
  );
  render(<MemoryRouter><CandidateCommunitiesLive /></MemoryRouter>);
}

describe("CandidateCommunitiesLive: discovery", () => {
  it("shows a community with its company, requirements and member count", async () => {
    mount();
    expect(await screen.findByText("NUST Computer Science 2026")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("You meet the requirements.")).toBeInTheDocument();
    expect(screen.getByText(/3 members/)).toBeInTheDocument();
    expect(screen.queryByText(/category/i)).not.toBeInTheDocument();
  });

  it("says why a candidate does not qualify, in the server's words", async () => {
    mount({ rows: [apiDiscoveryRow({ eligible: false, reasons: ["Requires graduation between 2025 and 2026.", "Requires any of these skills: Python."] })] });
    expect(await screen.findByText("Requires graduation between 2025 and 2026.")).toBeInTheDocument();
    expect(screen.getByText("Requires any of these skills: Python.")).toBeInTheDocument();
    expect(screen.getByText("You do not meet the requirements yet")).toBeInTheDocument();
  });

  it("shows each state the server reports, and offers Join only when there is none", async () => {
    mount({ rows: [
      apiDiscoveryRow({ id: "a", name: "Open one", state: "none" }),
      apiDiscoveryRow({ id: "b", name: "Waiting one", state: "pending_request" }),
      apiDiscoveryRow({ id: "c", name: "Member one", state: "member" }),
    ] });
    expect(await screen.findByText("Waiting for a decision")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("Your request is with the company.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ask to join/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /open feed/i })).toHaveLength(1);
  });

  it("treats an ineligible join as the requirements, not an error", async () => {
    mount({ handlers: [route.post("/candidate/communities/com-1/join/", () => json(apiJoinRequest({ status: "auto_rejected", eligible: false, reasons: ["Requires a degree in Computer Science."] }), 200))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /ask to join/i }));
    const drawer = await screen.findByRole("dialog", { name: /Ask to join/ });
    await user.click(within(drawer).getByRole("button", { name: /send request/i }));
    expect(await within(drawer).findByText("Requires a degree in Computer Science.")).toBeInTheDocument();
    expect(within(drawer).getByText(/cannot be approved while these are unmet/)).toBeInTheDocument();
    expect(within(drawer).queryByRole("alert")).not.toBeInTheDocument();
    expect(toasts()).not.toContain("Request sent");
  });

  it("confirms a real request, and explains a 409", async () => {
    let body;
    mount({ handlers: [route.post("/candidate/communities/com-1/join/", async ({ request }) => {
      body = await request.json();
      return body.message === "again" ? detail(409, "Already waiting.", "conflict") : json(apiJoinRequest(), 201);
    })] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /ask to join/i }));
    let drawer = await screen.findByRole("dialog", { name: /Ask to join/ });
    await user.type(within(drawer).getByLabelText(/Message/), "please");
    await user.click(within(drawer).getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(toasts()).toContain("Request sent"));

    await user.click(await screen.findByRole("button", { name: /ask to join/i }));
    drawer = await screen.findByRole("dialog", { name: /Ask to join/ });
    await user.type(within(drawer).getByLabelText(/Message/), "again");
    await user.click(within(drawer).getByRole("button", { name: /send request/i }));
    expect(await within(drawer).findByText("You are already a member, or a request is already waiting.")).toBeInTheDocument();
  });

  it("points at the privacy switch when there is nothing to discover", async () => {
    mount({ rows: [] });
    expect(await screen.findByText("No communities to discover yet")).toBeInTheDocument();
    expect(screen.getByText(/let companies find me/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy settings/i })).toHaveAttribute("href", "/candidate/settings");
  });
});

describe("CandidateCommunitiesLive: invitations", () => {
  it("shows a waiting invitation with its message and expiry, and accepts it", async () => {
    let accepted = false;
    mount({ invitations: [apiCandidateInvitation()], handlers: [route.post("/candidate/community-invitations/inv-1/accept/", () => (accepted = true, json({})))] });
    const banner = await screen.findByRole("region", { name: "Invitations waiting" });
    expect(banner).toHaveTextContent("NUST Computer Science 2026");
    expect(banner).toHaveTextContent("Join us");
    await userEvent.setup().click(within(banner).getByRole("button", { name: /join/i }));
    await waitFor(() => expect(accepted).toBe(true));
    await waitFor(() => expect(toasts()).toContain("You joined"));
  });

  it("explains an expired invitation rather than showing a raw error", async () => {
    mount({ invitations: [apiCandidateInvitation()], handlers: [route.post("/candidate/community-invitations/inv-1/accept/", () => detail(410, "Gone.", "expired"))] });
    const banner = await screen.findByRole("region", { name: "Invitations waiting" });
    await userEvent.setup().click(within(banner).getByRole("button", { name: /join/i }));
    expect(await screen.findByText("That invitation has expired.")).toBeInTheDocument();
  });

  it("declines an invitation", async () => {
    let declined = false;
    mount({ invitations: [apiCandidateInvitation()], handlers: [route.post("/candidate/community-invitations/inv-1/decline/", () => (declined = true, json({})))] });
    const banner = await screen.findByRole("region", { name: "Invitations waiting" });
    await userEvent.setup().click(within(banner).getByRole("button", { name: /decline/i }));
    await waitFor(() => expect(declined).toBe(true));
  });
});

describe("CandidateCommunitiesLive: the feed", () => {
  const member = [apiDiscoveryRow({ state: "member" })];

  it("shows the posts of a community I belong to, and lets me report one", async () => {
    let reported;
    mount({ rows: member, handlers: [
      route.get("/candidate/communities/com-1/", () => json(apiDiscoveryRow({ state: "member" }))),
      route.get("/candidate/communities/com-1/feed/", () => paged([apiCommunityPost()])),
      route.post("/reports/", async ({ request }) => (reported = await request.json(), json({}, 201))),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open feed/i }));
    expect(await screen.findByText("Graduate backend engineer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /report this post/i }));
    await user.type(screen.getByLabelText(/What is wrong with this/), "spam");
    await user.click(screen.getByRole("button", { name: /send report/i }));
    await waitFor(() => expect(reported).toEqual({ target_type: "community_post", target_id: "post-1", reason: "spam" }));
    expect(await screen.findByText(/a platform admin will look at this/i)).toBeInTheDocument();
  });

  it("tells a non-member the community is not open to them instead of showing an error", async () => {
    mount({ rows: member, handlers: [
      route.get("/candidate/communities/com-1/", () => detail(404, "Not found.", "not_found")),
      route.get("/candidate/communities/com-1/feed/", () => detail(404, "Not found.", "not_found")),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open feed/i }));
    expect(await screen.findByText("This community is not open to you")).toBeInTheDocument();
  });

  it("says when nothing has been posted", async () => {
    mount({ rows: member, handlers: [
      route.get("/candidate/communities/com-1/", () => json(apiDiscoveryRow({ state: "member" }))),
      route.get("/candidate/communities/com-1/feed/", () => paged([])),
    ] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /open feed/i }));
    expect(await screen.findByText("Nothing posted yet")).toBeInTheDocument();
  });

  it("explains a repeated response with the server's 409", async () => {
    mount({ rows: member, handlers: [
      route.get("/candidate/communities/com-1/", () => json(apiDiscoveryRow({ state: "member" }))),
      route.get("/candidate/communities/com-1/feed/", () => paged([apiCommunityPost()])),
      route.post("/candidate/community-posts/post-1/respond/", () => detail(409, "Already responded.", "conflict")),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /open feed/i }));
    await user.click(await screen.findByRole("button", { name: /i am interested/i }));
    const drawer = await screen.findByRole("dialog", { name: "Show interest" });
    await user.click(within(drawer).getByRole("button", { name: /^Send$/ }));
    expect(await within(drawer).findByText("You have already told them you are interested.")).toBeInTheDocument();
  });
});
