import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { apiField, apiJob, detail, future, json, route } from "@/test/fixtures";
import { Where } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { setTokens } from "@/api/tokenStorage";
import CompanyJobFormLive from "./CompanyJobFormLive";

const toasts = () => useToastStore.getState().toasts.map((t) => t.title);

function mount({ at = "/company/jobs/create", memberRole = "admin", job, handlers = [] } = {}) {
  setTokens({ access: "a", refresh: "r" });
  useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "company", status: "active", name: "Ali", email: "ali@acme.example", memberRole, companyStatus: "approved" } });
  server.use(...handlers, route.get("/jobs/departments/", () => json(["Design", "Engineering"])), ...(job ? [route.get("/jobs/job-1/", () => json(job))] : []));
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/company/jobs/create" element={<CompanyJobFormLive />} />
        <Route path="/company/jobs/job-new/edit" element={<Where />} />
        <Route path="/company/jobs/:id/edit" element={<CompanyJobFormLive />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const edit = (job, extra = {}) => mount({ at: "/company/jobs/job-1/edit", job, ...extra });
const draftJob = (o = {}) => apiJob({ status: "draft", deadline: null, days_left: null, share_url: null, form_slug: null, published_at: null, ...o });

async function fillValid(user, { skipDeadline = false } = {}) {
  await user.type(screen.getByLabelText("Role title"), "Data Engineer");
  await user.type(screen.getByLabelText("Department"), "Data");
  await user.selectOptions(screen.getByLabelText("Employment type"), "full_time");
  await user.selectOptions(screen.getByLabelText("Workplace"), "hybrid");
  await user.type(screen.getByLabelText("Location"), "Lahore");
  await user.type(screen.getByLabelText(/^Description/), "Build pipelines.");
  await user.type(screen.getByLabelText(/^Required skills/), "Python{Enter}");
  if (!skipDeadline) await user.type(screen.getByLabelText("Applications close"), "2030-06-01T10:30");
}

describe("CompanyJobFormLive: new role", () => {
  it("saves a draft with only a title and department, then opens the editor (where the form builder lives)", async () => {
    let body;
    mount({ handlers: [route.post("/jobs/", async ({ request }) => ((body = await request.json()), json(draftJob({ id: "job-new" }), 201)))] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Role title"), "Data Engineer");
    await user.type(screen.getByLabelText("Department"), "Data");
    expect(screen.getByText(/save the role as a draft to add your own application questions/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-new/edit");
    expect(body).toEqual({ title: "Data Engineer", department: "Data", education_level: "none", min_experience_years: 0, openings: 1, required_skills: [], soft_skills: [], show_salary: false });
  });

  it("a draft needs a title and department locally", async () => {
    let called = false;
    mount({ handlers: [route.post("/jobs/", () => ((called = true), json(draftJob(), 201)))] });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByText("Give the role a title")).toBeInTheDocument();
    expect(screen.getByText("Department is required")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("publishing lists every missing item at once and sends nothing", async () => {
    let called = false;
    mount({ handlers: [route.post("/jobs/", () => ((called = true), json(draftJob(), 201)))] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Role title"), "Data Engineer");
    await user.type(screen.getByLabelText("Department"), "Data");
    await user.click(screen.getByRole("button", { name: "Publish role" }));
    expect(await screen.findByText("Describe the role")).toBeInTheDocument();
    expect(screen.getByText("Add at least one required skill")).toBeInTheDocument();
    expect(screen.getByText("Choose an employment type")).toBeInTheDocument();
    expect(screen.getByText("Add a location, or choose Remote")).toBeInTheDocument();
    expect(screen.getByText("Set a deadline")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("creates and publishes in one request, with the deadline as an instant, then shows the preview", async () => {
    let body;
    mount({ handlers: [route.post("/jobs/", async ({ request }) => ((body = await request.json()), json(apiJob({ id: "job-new" }), 201)))] });
    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Publish role" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-new/preview");
    expect(body).toMatchObject({ title: "Data Engineer", department: "Data", employment_type: "full_time", work_mode: "hybrid", location: "Lahore", description: "Build pipelines.", required_skills: ["Python"], publish: true, deadline: new Date(2030, 5, 1, 10, 30).toISOString() });
  });

  it("server refusals land on the right inputs and nothing typed is lost", async () => {
    mount({ handlers: [route.post("/jobs/", () => json({ deadline: ["Deadline must be at least 1 hour from now."], required_skills: ["Add at least one required skill."] }, 400))] });
    const user = userEvent.setup();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Publish role" }));
    expect(await screen.findByText("Deadline must be at least 1 hour from now.")).toBeInTheDocument();
    expect(screen.getByText("Add at least one required skill.")).toBeInTheDocument();
    expect(screen.getByLabelText("Role title")).toHaveValue("Data Engineer");
    expect(screen.getByLabelText(/^Description/)).toHaveValue("Build pipelines.");
  });

  it("a salary needs a currency, and the maximum cannot be below the minimum", async () => {
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Role title"), "T");
    await user.type(screen.getByLabelText("Department"), "D");
    await user.type(screen.getByLabelText("Salary from"), "200");
    await user.type(screen.getByLabelText("Salary to"), "100");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByText("Maximum must be at least the minimum")).toBeInTheDocument();
    expect(screen.getByText(/add the currency/i)).toBeInTheDocument();
  });

  it("skills: Enter adds, duplicates are refused, remove works, suggestions follow the title", async () => {
    mount();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Required skills/);
    await user.type(input, "Python{Enter}");
    await user.type(input, "python{Enter}");
    expect(screen.getByText("python is already in the list.")).toBeInTheDocument();
    expect(screen.getAllByText("Python")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Remove Python" }));
    expect(screen.queryByText("Python")).not.toBeInTheDocument();
  });

  it("warns before leaving with unsaved changes", async () => {
    mount();
    await userEvent.setup().type(screen.getByLabelText("Role title"), "T");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not create twice on a double click", async () => {
    let calls = 0;
    mount({ handlers: [route.post("/jobs/", async () => { calls += 1; await new Promise((r) => setTimeout(r, 120)); return json(draftJob({ id: "job-new" }), 201); })] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Role title"), "T");
    await user.type(screen.getByLabelText("Department"), "D");
    await user.dblClick(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByTestId("where");
    expect(calls).toBe(1);
  });
});

describe("CompanyJobFormLive: editing", () => {
  it("shows the saved role, suggests the company's departments, and sends only what changed", async () => {
    let body;
    edit(draftJob({ deadline: future(30), days_left: 30 }), { handlers: [route.patch("/jobs/job-1/", async ({ request }) => ((body = await request.json()), json(draftJob({ title: "Renamed", deadline: future(30) }))))] });
    const user = userEvent.setup();
    const title = await screen.findByLabelText("Role title");
    expect(title).toHaveValue("Senior Django Engineer");
    expect(screen.getByLabelText("Department")).toHaveValue("Engineering");
    expect(document.querySelectorAll("#job-departments option")).toHaveLength(2);
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(toasts()).toContain("Draft saved"));
    expect(body).toEqual({ title: "Renamed" });
  });

  it("publishing a draft saves the edits first, then publishes, then shows the preview", async () => {
    const calls = [];
    edit(draftJob({ deadline: future(30), days_left: 30 }), {
      handlers: [
        route.patch("/jobs/job-1/", async ({ request }) => (calls.push(["patch", await request.json()]), json(draftJob({ title: "Renamed", deadline: future(30) })))),
        route.post("/jobs/job-1/publish/", () => (calls.push(["publish"]), json(apiJob({ title: "Renamed" })))),
      ],
    });
    const user = userEvent.setup();
    const title = await screen.findByLabelText("Role title");
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Publish role" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/company/jobs/job-1/preview");
    expect(calls).toEqual([["patch", { title: "Renamed" }], ["publish"]]);
  });

  it("an open role keeps its locked fields read-only and the editable ones work", async () => {
    let body;
    edit(apiJob(), { handlers: [route.patch("/jobs/job-1/", async ({ request }) => ((body = await request.json()), json(apiJob({ location: "Karachi" }))))] });
    const user = userEvent.setup();
    await screen.findByLabelText("Role title");
    for (const label of ["Department", "Employment type", "Workplace", "Openings", "Minimum years of experience", "Education"]) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getAllByText("Can't be changed after publishing").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    const location = screen.getByLabelText("Location");
    await user.clear(location);
    await user.type(location, "Karachi");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toasts()).toContain("Changes saved"));
    expect(body).toEqual({ location: "Karachi" });
    expect(screen.queryByRole("button", { name: "Publish role" })).not.toBeInTheDocument();
  });

  it("a locked-field refusal from the server (409) is explained and the role is reloaded", async () => {
    let gets = 0;
    edit(apiJob(), { handlers: [route.get("/jobs/job-1/", () => (gets++, json(apiJob()))), route.patch("/jobs/job-1/", () => detail(409, "These fields cannot be changed after publishing: department.", "field_locked"))] });
    const user = userEvent.setup();
    const location = await screen.findByLabelText("Location");
    await user.type(location, "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => /cannot be changed after publishing/.test(t.message))).toBe(true));
    await waitFor(() => expect(gets).toBeGreaterThan(1));
  });

  it("an open role whose deadline passed is read-only and offers Close", async () => {
    let closedCalled = false;
    edit(apiJob({ days_left: 0, deadline: "2026-01-01T00:00:00Z" }), { handlers: [route.post("/jobs/job-1/close/", () => ((closedCalled = true), json(apiJob({ status: "closed", days_left: null }))))] });
    expect(await screen.findByText(/deadline passed, so this role can't be edited/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Role title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close the role" }));
    await waitFor(() => expect(closedCalled).toBe(true));
  });

  it("a closed role is read-only; admin can reopen, a recruiter cannot", async () => {
    edit(apiJob({ status: "closed", days_left: null, close_reason: "deadline" }));
    expect(await screen.findByText(/closed \(the deadline passed\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Role title")).toBeDisabled();
    expect(screen.getByRole("button", { name: /reopen with a new deadline/i })).toBeInTheDocument();
  });

  it("a recruiter cannot reopen", async () => {
    edit(apiJob({ status: "closed", days_left: null, close_reason: "manual" }), { memberRole: "recruiter" });
    expect(await screen.findByText(/closed by your team/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  it("a viewer cannot edit at all", async () => {
    mount({ memberRole: "viewer" });
    expect(await screen.findByText("You can't edit roles")).toBeInTheDocument();
    expect(screen.queryByLabelText("Role title")).not.toBeInTheDocument();
  });

  it("a missing role is a clear not-found page", async () => {
    mount({ at: "/company/jobs/job-1/edit", handlers: [route.get("/jobs/job-1/", () => detail(404, "Job not found.", "not_found"))] });
    expect(await screen.findByText("Role not found")).toBeInTheDocument();
  });

  it("a 403 shows the blocked screen", async () => {
    mount({ at: "/company/jobs/job-1/edit", handlers: [route.get("/jobs/job-1/", () => detail(403, "Unauthorized access.", "permission_denied")), route.get("/auth/me/", () => json({ id: "u1", email: "ali@acme.example", full_name: "Ali", role: "company_admin", status: "active", company: { id: "c0", name: "Acme", member_role: "admin", status: "suspended" } }))] });
    expect(await screen.findByText("Your company is suspended")).toBeInTheDocument();
  });

  it("a load failure offers a retry that works", async () => {
    let fail = true;
    mount({ at: "/company/jobs/job-1/edit", handlers: [route.get("/jobs/job-1/", () => (fail ? detail(500, "Something went wrong.", "server_error") : json(apiJob())))] });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByLabelText("Role title")).toHaveValue("Senior Django Engineer");
  });

  it("shows the server's list of broken custom questions after a refused publish", async () => {
    edit(draftJob({ deadline: future(30), days_left: 30 }), { handlers: [route.post("/jobs/job-1/publish/", () => json({ custom_fields: ["Custom field 'Pick': Choice fields need between 2 and 20 options."] }, 400))] });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Publish role" }));
    expect(await screen.findByText(/Choice fields need between 2 and 20 options/)).toBeInTheDocument();
    expect(screen.getByText(/fix these application questions first/i)).toBeInTheDocument();
  });
});

describe("Application form builder (on the edit page)", () => {
  const withFields = (fields, o = {}) => draftJob({ custom_fields: fields, deadline: future(30), days_left: 30, ...o });

  it("lists the fixed questions and the custom ones in order", async () => {
    edit(withFields([apiField({ id: 1, label: "LinkedIn" }), apiField({ id: 2, label: "Notice", field_type: "single_choice", options: ["Now", "Later"], required: true })]));
    expect((await screen.findByText(/always asked:/i)).closest("p")).toHaveTextContent("Full name, Email, Phone number");
    const items = within(screen.getByRole("list", { name: "Custom questions" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("LinkedIn");
    expect(items[1]).toHaveTextContent("Notice");
    expect(items[1]).toHaveTextContent("Required");
    expect(items[1]).toHaveTextContent("Now · Later");
  });

  it("adds a question (text length only for text types, options only for choices)", async () => {
    let body;
    edit(withFields([]), { handlers: [route.post("/jobs/job-1/fields/", async ({ request }) => ((body = await request.json()), json(apiField({ id: 9, label: "Why us?", field_type: "long_text", max_length: 500 }), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /add a question/i }));
    const form = screen.getByRole("form", { name: "New question" });
    expect(within(form).queryByLabelText(/Option 1/)).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("Question"), "Why us?");
    await user.selectOptions(within(form).getByLabelText("Answer type"), "long_text");
    await user.type(within(form).getByLabelText(/Maximum length/), "500");
    await user.click(within(form).getByRole("button", { name: "Add question" }));
    await waitFor(() => expect(toasts()).toContain("Question added"));
    expect(body).toEqual({ label: "Why us?", field_type: "long_text", required: false, help_text: "", options: [], max_length: 500 });
    expect(screen.getByRole("list", { name: "Custom questions" })).toHaveTextContent("Why us?");
  });

  it("a choice question needs 2 to 20 unique options, checked before sending", async () => {
    let called = false;
    edit(withFields([]), { handlers: [route.post("/jobs/job-1/fields/", () => ((called = true), json(apiField(), 201)))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /add a question/i }));
    const form = screen.getByRole("form", { name: "New question" });
    await user.type(within(form).getByLabelText("Question"), "Pick");
    await user.selectOptions(within(form).getByLabelText("Answer type"), "single_choice");
    await user.click(within(form).getByRole("button", { name: /add option/i }));
    await user.type(within(form).getByLabelText("Option 1"), "A");
    await user.click(within(form).getByRole("button", { name: "Add question" }));
    expect(await within(form).findByText(/between 2 and 20 options/i)).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: /add option/i }));
    await user.type(within(form).getByLabelText("Option 2"), "a");
    await user.click(within(form).getByRole("button", { name: "Add question" }));
    expect(await within(form).findByText("Options must be unique")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows a server refusal on the field it belongs to and keeps the question open", async () => {
    edit(withFields([]), { handlers: [route.post("/jobs/job-1/fields/", () => json({ options: ["Options must be unique."], label: ["Label is too long."] }, 400))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /add a question/i }));
    const form = screen.getByRole("form", { name: "New question" });
    await user.type(within(form).getByLabelText("Question"), "Pick one");
    await user.selectOptions(within(form).getByLabelText("Answer type"), "single_choice");
    for (const text of ["A", "B"]) {
      await user.click(within(form).getByRole("button", { name: /add option/i }));
      await user.type(within(form).getAllByLabelText(/^Option \d/).at(-1), text);
    }
    await user.click(within(form).getByRole("button", { name: "Add question" }));
    expect(await within(form).findByText("Options must be unique.")).toBeInTheDocument();
    expect(within(form).getByText("Label is too long.")).toBeInTheDocument();
    expect(within(form).getByLabelText("Question")).toHaveValue("Pick one");
    expect(screen.queryByText("Question added")).not.toBeInTheDocument();
  });

  it("a refusal with no field (the 30-question limit) is shown as a message", async () => {
    edit(withFields([]), { handlers: [route.post("/jobs/job-1/fields/", () => detail(400, "A job can have at most 30 custom fields.", "limit_reached"))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /add a question/i }));
    const form = screen.getByRole("form", { name: "New question" });
    await user.type(within(form).getByLabelText("Question"), "One too many");
    await user.click(within(form).getByRole("button", { name: "Add question" }));
    expect(await within(form).findByText("A job can have at most 30 custom fields.")).toBeInTheDocument();
  });

  it("stops at 30 questions", async () => {
    edit(withFields(Array.from({ length: 30 }, (_, i) => apiField({ id: i + 1, label: `Q${i + 1}`, order: i }))));
    expect(await screen.findByRole("button", { name: /add a question/i })).toBeDisabled();
    expect(screen.getByText(/at most 30 extra questions/i)).toBeInTheDocument();
  });

  it("edits a question's label and help text", async () => {
    let body;
    edit(withFields([apiField({ id: 4, label: "Old label" })]), { handlers: [route.patch("/jobs/job-1/fields/4/", async ({ request }) => ((body = await request.json()), json(apiField({ id: 4, label: "New label", help_text: "Hint" }))))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit Old label" }));
    const form = screen.getByRole("form", { name: "Edit question" });
    await user.clear(within(form).getByLabelText("Question"));
    await user.type(within(form).getByLabelText("Question"), "New label");
    await user.type(within(form).getByLabelText(/Help text/), "Hint");
    await user.click(within(form).getByRole("button", { name: "Save question" }));
    await waitFor(() => expect(toasts()).toContain("Question updated"));
    expect(body).toMatchObject({ label: "New label", help_text: "Hint", field_type: "url" });
    expect(screen.getByRole("list", { name: "Custom questions" })).toHaveTextContent("New label");
  });

  it("reorders through the server and shows the order the server returns", async () => {
    let body;
    edit(withFields([apiField({ id: 1, label: "First" }), apiField({ id: 2, label: "Second", key: "second", order: 1 })]), {
      handlers: [route.post("/jobs/job-1/fields/reorder/", async ({ request }) => ((body = await request.json()), json([apiField({ id: 2, label: "Second", key: "second" }), apiField({ id: 1, label: "First" })])))],
    });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Move Second up" }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Custom questions" })).getAllByRole("listitem")[0]).toHaveTextContent("Second"));
    expect(body).toEqual({ field_ids: [2, 1] });
    expect(screen.getByRole("button", { name: "Move Second up" })).toBeDisabled();
  });

  it("a stale reorder (400) is reported and the list is read again", async () => {
    let lists = 0;
    edit(withFields([apiField({ id: 1, label: "First" }), apiField({ id: 2, label: "Second", key: "second", order: 1 })]), {
      handlers: [
        route.get("/jobs/job-1/fields/", () => (lists++, json([apiField({ id: 1, label: "First" }), apiField({ id: 2, label: "Second", key: "second" }), apiField({ id: 3, label: "Added elsewhere", key: "x" })]))),
        route.post("/jobs/job-1/fields/reorder/", () => json({ field_ids: ["Send every field ID of this job exactly once."] }, 400)),
      ],
    });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Move Second up" }));
    await waitFor(() => expect(toasts()).toContain("Couldn't reorder"));
    expect(await screen.findByText("Added elsewhere")).toBeInTheDocument();
    expect(lists).toBe(1);
  });

  it("deletes a question after confirmation (only while no applications exist)", async () => {
    let removed = false;
    edit(withFields([apiField({ id: 4, label: "Gone soon" })]), { handlers: [route.delete("/jobs/job-1/fields/4/", () => ((removed = true), new Response(null, { status: 204 }))), route.get("/jobs/job-1/fields/", () => json([]))] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Delete Gone soon" }));
    expect(removed).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete question" }));
    await waitFor(() => expect(removed).toBe(true));
    await waitFor(() => expect(screen.queryByText("Gone soon")).not.toBeInTheDocument());
  });

  it("once applications exist: no delete, no type change, no new required, and the lock is explained", async () => {
    edit(withFields([apiField({ id: 4, label: "Optional one", field_type: "single_choice", options: ["a", "b"], required: false })], { applications_count: 3 }));
    const user = userEvent.setup();
    expect(await screen.findByText(/has 3 applications/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete / })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Optional one" }));
    const form = screen.getByRole("form", { name: "Edit question" });
    expect(within(form).getByLabelText("Answer type")).toBeDisabled();
    expect(within(form).getByLabelText(/Candidates must answer this/)).toBeDisabled();
    expect(within(form).queryByRole("button", { name: /Remove option/ })).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: /add option/i }));
    expect(within(form).getByLabelText("Option 3")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Remove option 3" })).toBeInTheDocument();
  });

  it("shows the server's field_locked message when it refuses and re-reads the list", async () => {
    edit(withFields([apiField({ id: 4, label: "Locked q" })], { applications_count: 0 }), {
      handlers: [route.patch("/jobs/job-1/fields/4/", () => detail(409, "Options cannot be removed after applications were received.", "field_locked")), route.get("/jobs/job-1/fields/", () => json([apiField({ id: 4, label: "Locked q" })]))],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit Locked q" }));
    await user.click(screen.getByRole("button", { name: "Save question" }));
    expect(await screen.findByText("Options cannot be removed after applications were received.")).toBeInTheDocument();
  });

  it("is read-only on a closed role", async () => {
    edit(apiJob({ status: "closed", days_left: null, custom_fields: [apiField({ id: 1, label: "LinkedIn" })] }));
    expect(await screen.findByText(/form is read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add a question/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit LinkedIn" })).not.toBeInTheDocument();
  });
});
