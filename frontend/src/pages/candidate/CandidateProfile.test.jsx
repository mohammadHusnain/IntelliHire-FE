import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { apiProfile, apiUser, errors, json, route } from "@/test/fixtures";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import CandidateGate from "@/components/candidate/CandidateGate";
import CandidateProfile from "./CandidateProfile";

const toasts = () => useToastStore.getState().toasts.map((t) => `${t.title}`);

function mount(profile = apiProfile({ headline: "Backend dev", skills: ["Python"] }), extra = []) {
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "candidate", status: "active", name: "Sara Malik", email: "sara@example.com" } });
  server.use(
    route.get("/auth/profile/", () => json(profile)),
    route.get("/auth/profile/education/", () => json([])),
    route.get("/auth/profile/experience/", () => json([])),
    ...extra,
  );
  const router = createMemoryRouter([{ path: "/p", element: <CandidateGate />, children: [{ index: true, element: <CandidateProfile /> }] }], { initialEntries: ["/p"] });
  return render(<RouterProvider router={router} />);
}

async function ready() {
  await screen.findByLabelText("Full name");
  return userEvent.setup();
}

describe("CandidateProfile (real API)", () => {
  it("shows the server profile and no save bar until something changes", async () => {
    mount();
    await ready();
    expect(screen.getByLabelText("Headline")).toHaveValue("Backend dev");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  });

  it("sends only the changed field", async () => {
    let body;
    mount(undefined, [route.patch("/auth/profile/", async ({ request }) => ((body = await request.json()), json(apiProfile({ headline: "Staff dev", skills: ["Python"] }))))]);
    const user = await ready();
    const headline = screen.getByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "Staff dev");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Profile saved"));
    expect(body).toEqual({ headline: "Staff dev" });
  });

  it("changing the name goes to the account endpoint, not the profile", async () => {
    let me;
    let profileCalled = false;
    mount(undefined, [
      route.patch("/auth/me/", async ({ request }) => ((me = await request.json()), json(apiUser({ full_name: "Sara M. Malik" })))),
      route.patch("/auth/profile/", () => ((profileCalled = true), json(apiProfile()))),
    ]);
    const user = await ready();
    const name = screen.getByLabelText("Full name");
    await user.clear(name);
    await user.type(name, "Sara M. Malik");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Profile saved"));
    expect(me).toEqual({ full_name: "Sara M. Malik" });
    expect(profileCalled).toBe(false);
  });

  it("puts a server field error on the input and keeps the draft", async () => {
    mount(undefined, [route.patch("/auth/profile/", () => json({ phone: ["Enter a valid phone number."] }, 400))]);
    const user = await ready();
    const phone = await screen.findByLabelText("Phone");
    await user.type(phone, "abc");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveValue("abc");
    expect(toasts()).toContain("Profile not saved");
  });

  it("validates links locally and sends nothing", async () => {
    let called = false;
    mount(undefined, [route.patch("/auth/profile/", () => ((called = true), json(apiProfile())))]);
    const user = await ready();
    await user.type(screen.getByLabelText("LinkedIn"), "not-a-url");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a full LinkedIn URL")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("explains a server failure instead of pretending it saved", async () => {
    mount(undefined, [route.patch("/auth/profile/", () => errors.denied())]);
    const user = await ready();
    await user.type(screen.getByLabelText("Location"), "Lahore");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Profile not saved"));
    expect(toasts()).not.toContain("Profile saved");
  });

  it("refuses a CV that is not a PDF or DOCX, or is over 5 MB, without calling the server", async () => {
    let called = false;
    mount(undefined, [route.put("/auth/profile/resume/", () => ((called = true), json({})))]);
    const user = await ready();
    const input = document.querySelector('input[type="file"][accept*="pdf"]');
    const bad = userEvent.setup({ applyAccept: false });
    await bad.upload(input, new File(["x"], "cv.exe"));
    await waitFor(() => expect(toasts()).toContain("Unsupported file"));
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cv.pdf", { type: "application/pdf" });
    await user.upload(input, big);
    await waitFor(() => expect(toasts()).toContain("File too large"));
    expect(called).toBe(false);
  });

  it("uploads a valid CV and shows the stored file name", async () => {
    let profile = apiProfile();
    mount(profile, [
      route.put("/auth/profile/resume/", () => ((profile = apiProfile({ resume: "http://api.test/media/x.pdf", resume_name: "cv.pdf" })), json({}))),
    ]);
    // reload after upload returns the new profile
    server.use(route.get("/auth/profile/", () => json(profile)));
    const user = await ready();
    const input = document.querySelector('input[type="file"][accept*="pdf"]');
    await user.upload(input, new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(toasts()).toContain("CV uploaded"));
    expect(await screen.findByText("cv.pdf")).toBeInTheDocument();
  });
});
