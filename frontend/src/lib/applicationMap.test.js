import { describe, expect, it } from "vitest";
import { apiApplication, apiApplicationRow, apiNote } from "@/test/fixtures";
import { APPLICATION_STATUSES, canChangeStatus, cleanFileName, dateParam, mapApplication, mapApplicationRow, mapNote, safeUrl, statusLabel, statusTone } from "./applicationMap";

describe("statuses", () => {
  it("are the backend's seven, in pipeline order, rejected last", () => {
    expect(APPLICATION_STATUSES.map((s) => s.value)).toEqual(["submitted", "under_review", "shortlisted", "interview", "selected", "on_hold", "rejected"]);
  });
  it("have labels and tones; an unknown status is shown as it is", () => {
    expect(statusLabel("submitted")).toBe("Applied");
    expect(statusLabel("on_hold")).toBe("On hold");
    expect(statusTone("rejected")).toBe("danger");
    expect(statusLabel("weird")).toBe("weird");
    expect(statusTone("weird")).toBe("neutral");
  });
});

describe("rows and details", () => {
  it("maps a list row (with the job in the company-wide list)", () => {
    expect(mapApplicationRow({ ...apiApplicationRow(), job: { id: "j", title: "T" } })).toMatchObject({ id: "app-1", reference: "IH-AAA111", name: "Sara Malik", educationLabel: "Bachelor's degree", status: "submitted", hasCv: true, job: { id: "j", title: "T" } });
    expect(mapApplicationRow(apiApplicationRow()).job).toBeNull();
  });
  it("maps the detail: answers, history and notes", () => {
    const a = mapApplication(apiApplication({
      answers: [{ key: "why", label: "Why us", type: "long_text", value: "Great" }, { key: "x", label: "X", type: "url", value: null }],
      status_history: [{ from_status: "submitted", to_status: "shortlisted", changed_by: { id: "u", full_name: "Ali" }, note: "Strong", changed_at: "2026-03-02T00:00:00Z" }],
      notes: [apiNote()],
    }));
    expect(a).toMatchObject({ graduationYear: 2020, resume: { name: "cv.pdf" }, job: { id: "job-1" } });
    expect(a.answers[1].value).toBeNull();
    expect(a.statusHistory[0]).toMatchObject({ from: "submitted", to: "shortlisted", by: "Ali", note: "Strong" });
    expect(a.notes[0]).toMatchObject({ text: "Spoke on the phone", author: "Ali Khan" });
  });
  it("survives a missing resume, author and history", () => {
    const a = mapApplication({ ...apiApplication(), resume: null, status_history: undefined, notes: undefined, answers: undefined });
    expect(a.resume).toBeNull();
    expect(a.statusHistory).toEqual([]);
    expect(a.notes).toEqual([]);
    expect(mapNote({ id: 2, text: "x", author: null, created_at: null })).toMatchObject({ author: "", createdAt: null });
  });
});

describe("helpers", () => {
  it.each([["2026-03-01", "2026-03-01"], ["01/03/2026", ""], ["", ""], [undefined, ""], ["2026-3-1", ""]])("dateParam(%j) -> %j", (v, out) => expect(dateParam(v)).toBe(out));
  it("links only http(s) addresses", () => {
    expect(safeUrl("https://linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
  it("makes a downloaded file name safe", () => {
    expect(cleanFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(cleanFileName("CV Zoë.pdf")).toBe("CV Zoë.pdf");
    expect(cleanFileName("")).toBe("file");
  });
  it.each([["admin", true], ["hr_manager", true], ["recruiter", true], ["viewer", false], [null, false]])("%s may change status: %s", (role, ok) => expect(canChangeStatus({ memberRole: role })).toBe(ok));
});
