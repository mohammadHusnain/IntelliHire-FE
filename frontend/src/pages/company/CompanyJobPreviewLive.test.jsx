import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiJob, apiSchema, detail, json, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyJobPreviewLive from "./CompanyJobPreviewLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ memberRole = "admin", job = apiJob(), schema = apiSchema(), handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  server.use(...handlers, route.get("/jobs/job-1/", () => json(job)), route.get("/jobs/job-1/form-preview/", () => json(schema)));
  return render(
    <MemoryRouter initialEntries={["/company/jobs/job-1/preview"]}>
      <Routes>
        <Route path="/company/jobs/:id/preview" element={<CompanyJobPreviewLive />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CompanyJobPreviewLive", () => {
  it("renders the real form schema exactly as the public page does, built-in fields first, with custom ones after", async () => {
    const schema = apiSchema();
    schema.fields.push({ key: "linkedin", label: "LinkedIn", type: "url", required: false, options: [], option_labels: null, help_text: "Your profile", max_length: null, built_in: false });
    mount({ schema });
    expect(await screen.findByRole("heading", { name: "Senior Django Engineer" })).toBeInTheDocument();
    expect(screen.getByText("PKR 100,000 – 200,000")).toBeInTheDocument();
    const labels = [...document.querySelectorAll("label")].map((l) => l.textContent.replace(/\s*\*|\s*\(optional\)/g, "").trim());
    expect(labels).toEqual(["Full name", "Email", "Phone number", "Highest education level", "Institution", "Graduation year", "CV", "LinkedIn"]);
    expect(screen.getByText("Your profile")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toBeDisabled();
  });

  it("shows no salary the server did not send, and no hard-coded currency", async () => {
    const schema = apiSchema();
    schema.job.salary = null;
    mount({ schema });
    await screen.findByRole("heading", { name: "Senior Django Engineer" });
    expect(screen.queryByText(/£|PKR/)).not.toBeInTheDocument();
  });

  it("an open role shows its application link (the server's) and copies it", async () => {
    mount();
    const user = userEvent.setup();
    const link = await screen.findByLabelText("Application link");
    expect(link).toHaveValue("http://localhost:5173/apply/slug123456");
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:5173/apply/slug123456");
  });

  it("reports a clipboard that is denied", async () => {
    mount();
    const user = userEvent.setup();
    await screen.findByLabelText("Application link");
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("no")) }, configurable: true });
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(toasts()).toContain("Could not copy"));
  });

  it("a draft has no link yet, shows why the form is not accepting, and can be published", async () => {
    let published = false;
    mount({
      job: apiJob({ status: "draft", share_url: null, form_slug: null, deadline: null, days_left: null }),
      schema: apiSchema({ accepting: false, message: "This job has not been published yet." }),
      handlers: [route.post("/jobs/job-1/publish/", () => ((published = true), json(apiJob())))],
    });
    expect(await screen.findByText(/publish the role to get its application link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Application link")).not.toBeInTheDocument();
    expect(screen.getByText("This job has not been published yet.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(published).toBe(true));
  });

  it("an incomplete draft that the server refuses sends the person to the editor", async () => {
    mount({ job: apiJob({ status: "draft", share_url: null, deadline: null, days_left: null }), handlers: [route.post("/jobs/job-1/publish/", () => json({ description: ["Description is required to publish."] }, 400))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Publish" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-1/edit");
  });

  it("a closed role shows how it closed, the server's message, and a reopen for managers", async () => {
    mount({ job: apiJob({ status: "closed", days_left: null, close_reason: "deadline" }), schema: apiSchema({ accepting: false, message: "This position is no longer accepting applications." }) });
    expect(await screen.findByText("Closed: the deadline passed")).toBeInTheDocument();
    expect(screen.getByText("This position is no longer accepting applications.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("reopening needs a deadline and sends it as an instant", async () => {
    let body;
    mount({ job: apiJob({ status: "closed", days_left: null, close_reason: "manual" }), handlers: [route.post("/jobs/job-1/reopen/", async ({ request }) => ((body = await request.json()), json(apiJob())))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("New deadline"), "2030-06-01T10:30");
    await user.click(within(dialog).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(body).toEqual({ deadline: new Date(2030, 5, 1, 10, 30).toISOString() }));
  });

  it("an open role whose deadline passed says so", async () => {
    mount({ job: apiJob({ days_left: 0, deadline: "2026-01-01T00:00:00Z" }), schema: apiSchema({ accepting: false, message: "This position is no longer accepting applications." }) });
    expect(await screen.findByText("Deadline passed")).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("closes an open role", async () => {
    let closed = false;
    mount({ handlers: [route.post("/jobs/job-1/close/", () => ((closed = true), json(apiJob({ status: "closed" }))))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Close role" }));
    await waitFor(() => expect(closed).toBe(true));
  });

  it("shows the application count as plain text (no link into the candidate pages)", async () => {
    mount({ job: apiJob({ applications_count: 5 }) });
    expect(await screen.findByText("5 applications")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /applications|candidates/i })).not.toBeInTheDocument();
  });

  it("a viewer can look but not change anything", async () => {
    mount({ memberRole: "viewer" });
    await screen.findByLabelText("Application link");
    for (const name of [/^edit$/i, /^publish$/i, /close role/i, /reopen/i]) expect(screen.queryByRole("button", { name }) || screen.queryByRole("link", { name })).toBeNull();
  });

  it("a missing role is a clear not-found page", async () => {
    mount({ handlers: [route.get("/jobs/job-1/", () => detail(404, "Job not found.", "not_found")), route.get("/jobs/job-1/form-preview/", () => detail(404, "Job not found.", "not_found"))] });
    expect(await screen.findByText("Role not found")).toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount({ handlers: [route.get("/jobs/job-1/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/jobs/job-1/form-preview/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("a load failure offers a retry that works", async () => {
    let fail = true;
    mount({ handlers: [route.get("/jobs/job-1/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json(apiJob())))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: "Senior Django Engineer" })).toBeInTheDocument();
  });

  it("uses an uploaded-file label for the CV and lists option labels for the education choice", async () => {
    mount();
    expect(await screen.findByRole("option", { name: "Bachelor's degree" })).toBeInTheDocument();
    expect(screen.getByText("PDF or DOCX, 5 MB or smaller.")).toBeInTheDocument();
  });
});
