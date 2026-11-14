import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import {
  apiCandidateSummary,
  apiCommunity,
  apiCommunityInvitation,
  apiCommunityMember,
  apiCommunityPost,
  apiJoinRequest,
  detail,
  json,
  paged,
  route,
} from "@/test/fixtures";
import { setTokens } from "@/api/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import CompanyCommunityLive from "./CompanyCommunityLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ memberRole = "admin", communities = [apiCommunity()], handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  server.use(
    ...handlers,
    route.get("/company/communities/", () => paged(communities)),
    route.get("/company/communities/com-1/members/", () => paged([apiCommunityMember()])),
    route.get("/company/communities/com-1/join-requests/", () => paged([apiJoinRequest()])),
    route.get("/company/communities/com-1/invitations/", () => paged([apiCommunityInvitation()])),
    route.get("/company/communities/com-1/posts/", () => paged([apiCommunityPost()])),
    route.get("/company/communities/com-1/candidates/search/", () => paged([{ ...apiCandidateSummary(), eligible: true, reasons: [] }])),
    route.get("/jobs/", () => paged([])),
  );
  render(<MemoryRouter><CompanyCommunityLive /></MemoryRouter>);
}

const open = async (user) => user.click(await screen.findByRole("button", { name: /NUST Computer Science 2026/ }));

describe("CompanyCommunityLive: the list", () => {
  it("shows the company's communities with who may join, from the server", async () => {
    mount();
    expect(await screen.findByText("NUST Computer Science 2026")).toBeInTheDocument();
    expect(screen.getByText("Internships and graduate roles")).toBeInTheDocument();
    expect(screen.getByText("By request")).toBeInTheDocument();
    expect(screen.getByText(/3 members/)).toBeInTheDocument();
    // The filters are the real axes; there is no category or tag anywhere.
    expect(screen.getByText("NUST")).toBeInTheDocument();
    expect(screen.queryByText(/category/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tags/i)).not.toBeInTheDocument();
  });

  it("says plainly when a community has no requirements", async () => {
    mount({ communities: [apiCommunity({ filters: { universities: [], degrees: [], grad_year_from: null, grad_year_to: null, skills: [], skill_mode: "any" } })] });
    expect(await screen.findByText("Open to every candidate — no requirements.")).toBeInTheDocument();
  });

  it("offers nothing to create for a viewer, and an empty state that says so", async () => {
    mount({ memberRole: "viewer", communities: [] });
    expect(await screen.findByText("No communities yet")).toBeInTheDocument();
    expect(screen.getByText(/Nobody has created a community for your company yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new community/i })).not.toBeInTheDocument();
  });

  it("lets an HR manager create one, sending the server's flat field names", async () => {
    let body;
    mount({ memberRole: "hr_manager", handlers: [route.post("/company/communities/", async ({ request }) => (body = await request.json(), json(apiCommunity(), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /new community/i }));
    await user.type(screen.getByLabelText(/^Name/), "Alumni 2024");
    await user.type(screen.getByLabelText(/What it is for/), "Alumni roles");
    await user.type(screen.getByLabelText(/^Description/), "For our alumni");
    await user.type(screen.getByLabelText(/Skills, comma separated/), "Python, Django");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(body).toBeTruthy());
    expect(body.name).toBe("Alumni 2024");
    expect(body.mission).toBe("Alumni roles");
    expect(body.description).toBe("For our alumni");
    expect(body.filter_skills).toEqual(["Python", "Django"]);
  });

  it("refuses to send a form the server would reject", async () => {
    const seen = [];
    mount({ handlers: [route.post("/company/communities/", () => (seen.push("post"), json(apiCommunity(), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /new community/i }));
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Give the community a name.")).toBeInTheDocument();
    expect(seen).toEqual([]);
  });
});

describe("CompanyCommunityLive: one community", () => {
  it("shows members with their join source, and no contact details", async () => {
    mount();
    await open(userEvent.setup());
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
    expect(screen.getByText(/Asked to join/)).toBeInTheDocument();
    expect(screen.queryByText(/sara@example.com/)).not.toBeInTheDocument();
  });

  it("gives a viewer no tab or control that the server would refuse", async () => {
    mount({ memberRole: "viewer" });
    await open(userEvent.setup());
    expect(await screen.findByText("Sara Malik")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Invitations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new post/i })).not.toBeInTheDocument();
  });

  it("shows a pending request with the eligibility snapshot and approves it", async () => {
    let approved = false;
    mount({ handlers: [
      route.get("/company/communities/com-1/join-requests/", () => paged([apiJoinRequest({ eligible: false, reasons: ["Requires graduation between 2025 and 2026."] })])),
      route.post("/company/communities/com-1/join-requests/req-1/approve/", () => (approved = true, json(apiJoinRequest({ status: "approved" })))),
    ] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("tab", { name: "Requests" }));
    expect(await screen.findByText("Requires graduation between 2025 and 2026.")).toBeInTheDocument();
    expect(screen.getByText("You do not meet the requirements yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(approved).toBe(true));
    await waitFor(() => expect(toasts()).toContain("Request approved"));
  });

  it("needs a reason to reject, and sends it", async () => {
    let body;
    mount({ handlers: [route.post("/company/communities/com-1/join-requests/req-1/reject/", async ({ request }) => (body = await request.json(), json(apiJoinRequest({ status: "rejected" }))))] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("tab", { name: "Requests" }));
    await user.click(await screen.findByRole("button", { name: /^Reject$/ }));
    const dialog = await screen.findByRole("dialog", { name: /Reject this request/ });
    expect(within(dialog).getByRole("button", { name: /^Reject$/ })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Reason/), "not this cohort");
    await user.click(within(dialog).getByRole("button", { name: /^Reject$/ }));
    await waitFor(() => expect(body).toEqual({ reason: "not this cohort" }));
  });

  it("warns, but still allows, an invitation to someone who fails the filters", async () => {
    mount({ handlers: [
      route.get("/company/communities/com-1/candidates/search/", () => paged([{ ...apiCandidateSummary(), eligible: false, reasons: ["Requires a degree in Computer Science."] }])),
      route.post("/company/communities/com-1/invitations/", () => json({ ...apiCommunityInvitation(), eligibility: { eligible: false, reasons: ["Requires a degree in Computer Science."] } }, 201)),
    ] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("tab", { name: "Invitations" }));
    await user.click(await screen.findByRole("button", { name: /find candidates/i }));
    const drawer = await screen.findByRole("dialog", { name: "Find candidates" });
    expect(within(drawer).getByText(/Their contact details and CV are never shown/)).toBeInTheDocument();
    expect(await within(drawer).findByText("Requires a degree in Computer Science.")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: /invite/i }));
    await waitFor(() => expect(toasts().some((t) => /invited/i.test(t))).toBe(true));
  });

  it("requires a reason to remove a community, and says nothing is deleted", async () => {
    let body;
    mount({ handlers: [route.delete("/company/communities/com-1/", async ({ request }) => (body = await request.json(), new Response(null, { status: 204 })))] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("button", { name: /remove community/i }));
    const dialog = await screen.findByRole("dialog", { name: /Remove NUST/ });
    expect(dialog).toHaveTextContent("Nothing is deleted");
    await user.type(within(dialog).getByLabelText(/Reason/), "duplicate of another group");
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/ }));
    await waitFor(() => expect(body).toEqual({ reason: "duplicate of another group" }));
  });

  it("archives with a dialog that explains what archiving keeps", async () => {
    let archived = false;
    mount({ handlers: [route.post("/company/communities/com-1/archive/", () => (archived = true, json(apiCommunity({ status: "archived" }))))] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("button", { name: /archive/i }));
    const dialog = await screen.findByRole("dialog", { name: /Archive NUST/ });
    expect(dialog).toHaveTextContent("Members and posts stay readable");
    await user.click(within(dialog).getByRole("button", { name: /^Archive$/ }));
    await waitFor(() => expect(archived).toBe(true));
  });

  it("creates a post and says it reaches members only", async () => {
    let body;
    mount({ handlers: [route.post("/company/communities/com-1/posts/", async ({ request }) => (body = await request.json(), json(apiCommunityPost(), 201)))] });
    const user = userEvent.setup();
    await open(user);
    await user.click(await screen.findByRole("tab", { name: "Posts" }));
    await user.click(await screen.findByRole("button", { name: /new post/i }));
    const drawer = await screen.findByRole("dialog", { name: "New post" });
    expect(drawer).toHaveTextContent("Visible only to members");
    await user.type(within(drawer).getByLabelText(/^Title/), "Graduate role");
    await user.type(within(drawer).getByLabelText(/^Body/), "Apply by Friday");
    await user.click(within(drawer).getByLabelText(/Notify every member/));
    await user.click(within(drawer).getByRole("button", { name: /^Post$/ }));
    await waitFor(() => expect(body).toMatchObject({ kind: "job", title: "Graduate role", body: "Apply by Friday", notify_members: true }));
  });

  it("treats a community of another company as missing", async () => {
    mount({ handlers: [route.get("/company/communities/", () => detail(404, "Not found.", "not_found"))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
