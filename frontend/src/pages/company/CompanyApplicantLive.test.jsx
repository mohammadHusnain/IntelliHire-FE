import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiApplication, apiCvAnalysis, apiNote, detail, json, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyApplicantLive from "./CompanyApplicantLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ memberRole = "admin", application = apiApplication(), handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  server.use(
    ...handlers,
    route.get("/applications/app-1/", () => json(application)),
    route.get("/applications/app-1/interviews/", () => json([])),
    // Module 6's panel asks for this on every profile; "not analysed" is the neutral default.
    route.get("/applications/app-1/cv-analysis/", () => detail(404, "This CV has not been analysed yet.", "not_analysed")),
  );
  return render(
    <MemoryRouter initialEntries={["/company/candidates/app-1"]}>
      <Routes>
        <Route path="/company/candidates/:id" element={<CompanyApplicantLive />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const withAnswers = () => apiApplication({
  answers: [
    { key: "why", label: "Why us?", type: "long_text", value: "Great team.\nGood pay." },
    { key: "linkedin", label: "LinkedIn", type: "url", value: "https://linkedin.com/in/sara" },
    { key: "evil", label: "Website", type: "url", value: "javascript:alert(1)" },
    { key: "tools", label: "Tools", type: "multiple_choice", value: ["Spark", "dbt"] },
    { key: "level", label: "Level", type: "single_choice", value: "Senior" },
    { key: "years", label: "Years", type: "number", value: 3.5 },
    { key: "start", label: "Available from", type: "date", value: "2026-12-01" },
    { key: "mail", label: "Contact email", type: "email", value: "sara@home.example" },
    { key: "portfolio", label: "Portfolio", type: "file", value: { name: "portfolio.pdf", url: "/api/applications/app-1/files/portfolio/" } },
    { key: "nick", label: "Nickname", type: "short_text", value: null },
  ],
});

describe("CompanyApplicantLive: the profile", () => {
  it("shows contact, education, reference, status and the job", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: /Sara Malik/ })).toBeInTheDocument();
    expect(screen.getByText(/reference IH-AAA111/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sara@example.com/ })).toHaveAttribute("href", "mailto:sara@example.com");
    expect(screen.getByRole("link", { name: /\+92 300 1234567/ })).toHaveAttribute("href", "tel:+923001234567");
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
    expect(screen.getByText(/NUST · graduated 2020/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Senior Django Engineer/ })).toHaveAttribute("href", "/company/jobs/job-1/preview");
    expect(screen.getByRole("link", { name: /back to the pipeline/i })).toHaveAttribute("href", "/company/jobs/job-1/candidates");
  });

  it("never shows made-up scores", async () => {
    mount();
    await screen.findByRole("heading", { name: /Sara Malik/ });
    expect(screen.queryByText(/cv match|overall score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b\d+(?:\.\d+)?\/100\b/)).not.toBeInTheDocument();
  });

  it("shows every answer type properly: links only for http(s), choices as tags, unanswered as 'No answer'", async () => {
    mount({ application: withAnswers() });
    await screen.findByText("Why us?");
    expect(screen.getByText(/Great team\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /linkedin.com\/in\/sara/ })).toHaveAttribute("href", "https://linkedin.com/in/sara");
    expect(screen.queryByRole("link", { name: /javascript/ })).not.toBeInTheDocument();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByText("dbt")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("1 December 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sara@home.example" })).toHaveAttribute("href", "mailto:sara@home.example");
    expect(screen.getByRole("button", { name: /portfolio.pdf/ })).toBeInTheDocument();
    expect(screen.getByText("No answer")).toBeInTheDocument();
  });

  it("a role with no extra questions says so", async () => {
    mount();
    expect(await screen.findByText("This role has no extra questions.")).toBeInTheDocument();
  });

  it("shows the history newest first with who, when and the note; the first row is 'Applied'", async () => {
    mount({ application: apiApplication({ status: "shortlisted", status_history: [
      { from_status: null, to_status: "submitted", changed_by: null, note: "", changed_at: "2026-03-01T10:00:00Z" },
      { from_status: "submitted", to_status: "shortlisted", changed_by: { id: "u", full_name: "Hana HR" }, note: "Strong portfolio", changed_at: "2026-03-02T10:00:00Z" },
    ] }) });
    await screen.findByText("Strong portfolio");
    const items = screen.getAllByRole("listitem").filter((li) => /Hana HR|^Applied/.test(li.textContent));
    expect(items[0]).toHaveTextContent("Applied → Shortlisted");
    expect(items[0]).toHaveTextContent("Hana HR");
    expect(items.at(-1)).toHaveTextContent("Applied");
  });

  it("an application with no CV file shows no CV buttons", async () => {
    mount({ application: apiApplication({ resume: null }) });
    await screen.findByRole("heading", { name: /Sara Malik/ });
    expect(screen.queryByRole("button", { name: /view cv/i })).not.toBeInTheDocument();
  });
});

describe("CompanyApplicantLive: technical interviews", () => {
  it("invites a technical interview after screening passes and refreshes the session list", async () => {
    const sessions = [{ id: "screen-1", kind: "screening", status: "evaluated", recommendation: "advance", invited_at: "2026-11-01T10:00:00Z", expires_at: "2026-11-08T10:00:00Z", question_target: 6, answered_count: 6, overall_score: null }];
    let inviteBody;
    mount({ handlers: [
      route.get("/applications/app-1/interviews/", () => json(inviteBody ? [...sessions, { id: "tech-1", kind: "technical", status: "invited", invited_at: "2026-11-12T10:00:00Z", expires_at: "2026-11-19T10:00:00Z", question_target: 8, answered_count: 0, overall_score: null }] : sessions)),
      route.post("/applications/app-1/interviews/", async ({ request }) => ((inviteBody = await request.json()), json({ id: "tech-1", kind: "technical", status: "invited", warnings: [] }, 201))),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /invite to technical interview/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(await screen.findByText("Invited")).toBeInTheDocument();
    expect(inviteBody).toEqual({ kind: "technical", expires_in_days: 7, override: false });
  });

  it("requires an explicit reason when an admin overrides the screening gate", async () => {
    let inviteBody;
    mount({ handlers: [
      route.post("/applications/app-1/interviews/", async ({ request }) => ((inviteBody = await request.json()), json({ id: "tech-1", kind: "technical", status: "invited", warnings: [] }, 201))),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /invite to technical interview/i }));
    await user.click(screen.getByRole("checkbox", { name: /override screening prerequisite/i }));
    expect(screen.getByRole("button", { name: /send invitation/i })).toBeDisabled();
    await user.type(screen.getByLabelText("Reason for override"), "Urgent specialist review");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() => expect(inviteBody).toEqual({ kind: "technical", expires_in_days: 7, override: true, note: "Urgent specialist review" }));
  });

  it("shows the backend report-pending state and transcript without inventing scores", async () => {
    mount({ handlers: [
      route.get("/applications/app-1/interviews/", () => json([{ id: "tech-1", kind: "technical", status: "completed", invited_at: "2026-11-12T10:00:00Z", expires_at: "2026-11-19T10:00:00Z", question_target: 8, answered_count: 3, overall_score: null, recommendation: null }])),
      route.get("/interviews/tech-1/", () => json({ id: "tech-1", kind: "technical", status: "completed", overall_score: null, recommendation: null, report: {}, report_message: "Report not available yet", ai_disclaimer: "AI output is reviewed by the hiring team.", turns: [{ index: 1, question_text: "How would you design a queue?", answer_text: "I would start with...", score: null, feedback: "", topic: "Systems", is_follow_up: false }] })),
    ] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /view details/i }));
    expect(await screen.findByText("Report not available yet")).toBeInTheDocument();
    expect(screen.getByText(/How would you design a queue/)).toBeInTheDocument();
    expect(screen.getByText("I would start with...")).toBeInTheDocument();
    expect(screen.queryByText(/\b\d+(?:\.\d+)?\/100\b/)).not.toBeInTheDocument();
  });
});

describe("CompanyApplicantLive: status", () => {
  it("changes the status with a note; the history comes back from the server", async () => {
    let body;
    const after = apiApplication({ status: "shortlisted", status_history: [
      { from_status: null, to_status: "submitted", changed_by: null, note: "", changed_at: "2026-03-01T10:00:00Z" },
      { from_status: "submitted", to_status: "shortlisted", changed_by: { id: "u1", full_name: "Ali Khan" }, note: "Great CV", changed_at: "2026-03-03T10:00:00Z" },
    ] });
    mount({ handlers: [route.patch("/applications/app-1/status/", async ({ request }) => ((body = await request.json()), json(after)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change status" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("option", { name: "Applied" })).not.toBeInTheDocument(); // the current status is not offered
    await user.selectOptions(within(dialog).getByLabelText("New status"), "shortlisted");
    await user.type(within(dialog).getByLabelText(/^Note/), "Great CV");
    expect(within(dialog).getByText("8/1000")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Update status" }));
    expect(await screen.findByText("Great CV")).toBeInTheDocument();
    expect(body).toEqual({ status: "shortlisted", note: "Great CV" });
    expect(toasts()).toContain("Sara Malik is now Shortlisted");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Shortlisted", { selector: "span" })).toBeInTheDocument();
  });

  it("asks for a new status before sending anything", async () => {
    let called = false;
    mount({ handlers: [route.patch("/applications/app-1/status/", () => ((called = true), json(apiApplication())))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change status" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Update status" }));
    expect(await screen.findByText("Choose the new status")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("Reject opens the dialog with 'Rejected' chosen", async () => {
    mount();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Reject" }));
    expect(within(await screen.findByRole("dialog")).getByLabelText("New status")).toHaveValue("rejected");
  });

  it("the server's refusal stays in the dialog (the same status, a note that is too long)", async () => {
    mount({ handlers: [route.patch("/applications/app-1/status/", () => json({ status: ["The application already has this status."] }, 400))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change status" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("New status"), "under_review");
    await user.click(within(dialog).getByRole("button", { name: "Update status" }));
    expect(await within(dialog).findByText("The application already has this status.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("a viewer is refused by the server too: the message shows and nothing changes", async () => {
    mount({ handlers: [route.patch("/applications/app-1/status/", () => detail(403, "Unauthorized access.", "permission_denied"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Change status" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("New status"), "rejected");
    await user.click(within(dialog).getByRole("button", { name: "Update status" }));
    expect(await within(dialog).findByText("Unauthorized access.")).toBeInTheDocument();
    expect(toasts()).not.toContain("Sara Malik is now Rejected");
  });

  it("a viewer sees no status, reject or note controls", async () => {
    mount({ memberRole: "viewer", application: apiApplication({ notes: [apiNote()] }) });
    await screen.findByRole("heading", { name: /Sara Malik/ });
    expect(screen.queryByRole("button", { name: "Change status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add a note")).not.toBeInTheDocument();
    expect(screen.getByText("Spoke on the phone")).toBeInTheDocument(); // reading notes is allowed
  });

  it("a rejected candidate can be moved back", async () => {
    mount({ application: apiApplication({ status: "rejected" }) });
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Change status" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("option", { name: "Shortlisted" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("option", { name: "Rejected" })).not.toBeInTheDocument();
  });

  it("says plainly that the candidate is not emailed", async () => {
    mount();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Change status" }));
    expect(await screen.findByText(/candidate is not notified by email/i)).toBeInTheDocument();
  });
});

describe("CompanyApplicantLive: notes", () => {
  it("adds a note, newest first, without touching the status", async () => {
    let body;
    mount({ application: apiApplication({ notes: [apiNote({ id: 1, text: "Earlier note" })] }), handlers: [route.post("/applications/app-1/notes/", async ({ request }) => ((body = await request.json()), json(apiNote({ id: 2, text: "Later note", created_at: new Date().toISOString() }), 201)))] });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Add a note"), "  Later note  ");
    await user.click(screen.getByRole("button", { name: /save note/i }));
    await waitFor(() => expect(toasts()).toContain("Note saved"));
    expect(body).toEqual({ text: "Later note" });
    const notes = screen.getAllByText(/^(Earlier|Later) note$/).map((e) => e.textContent);
    expect(notes).toEqual(["Later note", "Earlier note"]);
    expect(screen.getByLabelText("Add a note")).toHaveValue("");
  });

  it("text typed while a note is still being saved is not wiped when the save finishes", async () => {
    mount({ handlers: [route.post("/applications/app-1/notes/", async ({ request }) => { await new Promise((r) => setTimeout(r, 150)); return json(apiNote({ id: 9, text: (await request.json()).text }), 201); })] });
    const user = userEvent.setup();
    const box = await screen.findByLabelText("Add a note");
    await user.type(box, "First");
    await user.click(screen.getByRole("button", { name: /save note/i }));
    await user.type(box, " and a next thought"); // typed during the save
    await waitFor(() => expect(toasts()).toContain("Note saved"));
    expect(box).toHaveValue("First and a next thought");
  });

  it("an empty note is refused locally", async () => {
    let called = false;
    mount({ handlers: [route.post("/applications/app-1/notes/", () => ((called = true), json(apiNote(), 201)))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /save note/i }));
    expect(await screen.findByText("Write something first")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows the server's refusal (the limit) and keeps the text", async () => {
    mount({ handlers: [route.post("/applications/app-1/notes/", () => detail(400, "An application can have at most 100 notes.", "limit_reached"))] });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Add a note"), "One more");
    await user.click(screen.getByRole("button", { name: /save note/i }));
    expect(await screen.findByText("An application can have at most 100 notes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a note")).toHaveValue("One more");
  });

  it("does not post twice on a double click", async () => {
    let calls = 0;
    mount({ handlers: [route.post("/applications/app-1/notes/", async () => { calls += 1; await new Promise((r) => setTimeout(r, 120)); return json(apiNote({ id: 5 }), 201); })] });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Add a note"), "Once");
    await user.dblClick(screen.getByRole("button", { name: /save note/i }));
    await waitFor(() => expect(toasts()).toContain("Note saved"));
    expect(calls).toBe(1);
  });

  it("a note whose author was deleted still shows", async () => {
    mount({ application: apiApplication({ notes: [apiNote({ author: null })] }) });
    expect(await screen.findByText(/A former teammate/)).toBeInTheDocument();
  });

  it("shows the 2000-character counter", async () => {
    mount();
    await userEvent.setup().type(await screen.findByLabelText("Add a note"), "abc");
    expect(screen.getByText("3/2000")).toBeInTheDocument();
  });
});

describe("CompanyApplicantLive: downloads", () => {
  const setup = () => {
    const saved = [];
    const opened = [];
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { saved.push(this.download); });
    const tab = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockImplementation(() => (opened.push(tab), tab));
    return { saved, opened, tab, restore: () => (click.mockRestore(), open.mockRestore()) };
  };
  const file = (name, type, body = "x") => new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"` } });

  it("'View CV' opens a PDF in a new tab from an authenticated blob (never a bare API link)", async () => {
    const env = setup();
    mount({ handlers: [route.get("/applications/app-1/resume/", () => file("cv.pdf", "application/pdf", "%PDF-1.4"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /view cv/i }));
    await waitFor(() => expect(env.tab.location.href).toBe("blob:test"));
    expect(env.opened).toHaveLength(1);
    expect(document.querySelector('a[href*="/api/"]')).toBeNull();
    env.restore();
  });

  it("a DOCX is downloaded instead (a browser cannot show it) and the blank tab is closed", async () => {
    const env = setup();
    mount({ application: apiApplication({ resume: { name: "cv.docx", url: "x" } }), handlers: [route.get("/applications/app-1/resume/", () => file("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /view cv/i }));
    await waitFor(() => expect(env.saved).toEqual(["cv.docx"]));
    expect(env.tab.close).toHaveBeenCalled();
    env.restore();
  });

  it("a missing CV is reported and the blank tab is closed", async () => {
    const env = setup();
    mount({ handlers: [route.get("/applications/app-1/resume/", () => detail(404, "No resume.", "not_found"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /view cv/i }));
    await waitFor(() => expect(toasts()).toContain("Couldn't open the CV"));
    expect(env.tab.close).toHaveBeenCalled();
    env.restore();
  });

  it("Download saves the CV under the server's file name (made safe)", async () => {
    const env = setup();
    // Django sends non-ASCII names as RFC 5987 (filename*=UTF-8''...); a path-like name must not escape the downloads folder
    mount({ handlers: [route.get("/applications/app-1/resume/", () => new Response("x", { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename*=UTF-8''..%2F..%2FZo%C3%AB%20CV.pdf" } }))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /^download$/i }));
    await waitFor(() => expect(env.saved).toHaveLength(1));
    expect(env.saved[0]).not.toMatch(/[\\/]/);
    expect(env.saved[0]).toContain("Zoë CV.pdf");
    env.restore();
  });

  it("a file answer downloads with the session", async () => {
    const env = setup();
    mount({ application: withAnswers(), handlers: [route.get("/applications/app-1/files/portfolio/", () => file("portfolio.pdf", "application/pdf"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /portfolio.pdf/ }));
    await waitFor(() => expect(env.saved).toEqual(["portfolio.pdf"]));
    env.restore();
  });

  it("a failed file download is reported", async () => {
    const env = setup();
    mount({ application: withAnswers(), handlers: [route.get("/applications/app-1/files/portfolio/", () => detail(404, "File not found.", "not_found"))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: /portfolio.pdf/ }));
    await waitFor(() => expect(toasts()).toContain("Couldn't download the file"));
    env.restore();
  });
});

describe("CompanyApplicantLive: access", () => {
  it("another company's (or a missing) application is a clear not-found page", async () => {
    mount({ handlers: [route.get("/applications/app-1/", () => detail(404, "Application not found.", "not_found"))] });
    expect(await screen.findByText("Candidate not found")).toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount({ handlers: [route.get("/applications/app-1/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "approved" } }))] });
    expect(await screen.findByText("You no longer have access")).toBeInTheDocument();
  });

  it("a load failure offers a retry that works", async () => {
    let fail = true;
    mount({ handlers: [route.get("/applications/app-1/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json(apiApplication())))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: /Sara Malik/ })).toBeInTheDocument();
  });
});

describe("CompanyApplicantLive: the CV analysis panel (Module 6)", () => {
  const analysed = (overrides) => [route.get("/applications/app-1/cv-analysis/", () => json(apiCvAnalysis(overrides)))];

  it("shows the score, the four parts, the skill chips and the AI notice", async () => {
    mount({ handlers: analysed() });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(await within(panel).findByText("85%")).toBeInTheDocument();
    expect(within(panel).getByText("Meets threshold")).toBeInTheDocument();
    for (const part of ["Skills", "Experience", "Education", "Semantic fit"]) {
      expect(within(panel).getByText(part)).toBeInTheDocument();
    }
    expect(within(panel).getByText("Matched skills")).toBeInTheDocument();
    expect(within(panel).getByText("Kubernetes")).toBeInTheDocument();
    expect(within(panel).getByText("Experience identified: 4 years")).toBeInTheDocument();
    expect(within(panel).getByText("Strong backend skills with relevant experience.")).toBeInTheDocument();
    expect(within(panel).getByText("AI-generated, for review by a person")).toBeInTheDocument();
  });

  it("hides what was read from the CV until it is asked for", async () => {
    mount({ handlers: analysed() });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    await within(panel).findByText("85%");
    expect(within(panel).queryByText("MSc Computer Science · UCL · 2022")).not.toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole("button", { name: /show what was read/i }));
    expect(await within(panel).findByText("MSc Computer Science · UCL · 2022")).toBeInTheDocument();
  });

  it("says plainly when a CV has not been analysed, and offers to analyse it", async () => {
    let hits = 0;
    mount({ handlers: [route.post("/applications/app-1/cv-analysis/rerun/", () => (hits += 1, json({ detail: "Analysis queued." }, 202)))] });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(await within(panel).findByText("This CV has not been analysed yet.")).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole("button", { name: /analyse again/i }));
    await waitFor(() => expect(hits).toBe(1));
    await waitFor(() => expect(toasts()).toContain("Analysis queued"));
  });

  it("offers Retry beside a failure reason and reports a 409", async () => {
    mount({
      handlers: [
        route.get("/applications/app-1/cv-analysis/", () => json(apiCvAnalysis({ status: "manual_review", failure_reason: "Scanned or unreadable CV", match: null }))),
        route.post("/applications/app-1/cv-analysis/rerun/", () => detail(409, "This CV is being analysed right now.", "analysis_in_progress")),
      ],
    });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(await within(panel).findByText("Scanned or unreadable CV")).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getAllByRole("button", { name: /analyse again/i })[0]);
    expect(await within(panel).findByText("This CV is being analysed right now.")).toBeInTheDocument();
  });

  it("warns when the score predates the role's current requirements", async () => {
    mount({ handlers: analysed({ match: { stale: true } }) });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(await within(panel).findByText(/computed before the role's requirements or weights last changed/)).toBeInTheDocument();
  });

  it("gives a viewer no way to start an analysis", async () => {
    const seen = [];
    mount({ memberRole: "viewer", handlers: [
      route.get("/applications/app-1/cv-analysis/", () => json(apiCvAnalysis({ status: "failed", failure_reason: "The model was unavailable.", match: null }))),
      route.post("/applications/app-1/cv-analysis/rerun/", () => (seen.push("rerun"), json({}, 202))),
    ] });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(await within(panel).findByText("The model was unavailable.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /analyse again/i })).not.toBeInTheDocument();
    expect(seen).toEqual([]);
  });

  it("links to the role's full ranking", async () => {
    mount({ handlers: analysed() });
    const panel = (await screen.findByRole("heading", { name: "CV analysis" })).closest("section");
    expect(within(panel).getByRole("link", { name: "Full ranking" })).toHaveAttribute("href", "/company/jobs/job-1/cv-analysis");
  });
});
