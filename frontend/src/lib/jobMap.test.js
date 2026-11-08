import { describe, expect, it } from "vitest";
import { apiField, apiJob, apiJobRow } from "@/test/fixtures";
import {
  blankFieldForm, blankJobForm, canEditJobs, canManageJobs, changedJobFields, draftProblems, fieldBody, fieldProblems, formFromField, formFromJob,
  formatSalary, fromDateTimeInput, isChoiceType, isTextType, jobBody, mapCustomField, mapJob, mapJobErrors, mapJobRow, publishProblems, toDateTimeInput,
} from "./jobMap";

const complete = () => ({ ...blankJobForm(), title: "T", department: "Eng", description: "d", requiredSkills: ["Python"], employmentType: "full_time", workMode: "hybrid", location: "Lahore", deadline: "2030-01-01T10:00" });

describe("rows and jobs", () => {
  it("maps a list row", () => {
    expect(mapJobRow(apiJobRow({ applications_count: 4 }))).toMatchObject({ id: "job-1", employmentType: "full_time", workMode: "hybrid", daysLeft: 10, applicationsCount: 4, shareUrl: "http://localhost:5173/apply/slug123456", expired: false });
  });
  it("an open job with days_left 0 is expired; a closed one is not", () => {
    expect(mapJobRow(apiJobRow({ days_left: 0 })).expired).toBe(true);
    expect(mapJobRow(apiJobRow({ status: "closed", days_left: null })).expired).toBe(false);
    expect(mapJobRow(apiJobRow({ status: "draft", days_left: null, deadline: null })).expired).toBe(false);
  });
  it("maps the detail with its custom fields", () => {
    const job = mapJob(apiJob({ custom_fields: [apiField({ id: 3, field_type: "single_choice", options: ["a", "b"], required: true })] }));
    expect(job).toMatchObject({ requiredSkills: ["Python", "Django"], softSkills: ["Communication"], minExperienceYears: 3, educationLevel: "bachelor", salaryCurrency: "PKR", showSalary: true, openings: 2, formSlug: "slug123456", createdBy: "Ali Khan" });
    expect(job.customFields[0]).toMatchObject({ id: 3, type: "single_choice", options: ["a", "b"], required: true });
  });
  it("survives missing optional data", () => {
    expect(mapJob({ id: "x", title: "T", status: "draft" })).toMatchObject({ department: "", requiredSkills: [], salaryMin: "", educationLevel: "none", openings: 1, customFields: [], shareUrl: null });
    expect(mapCustomField({ id: 1, label: "L", field_type: "date" }).options).toEqual([]);
  });
});

describe("deadline and time zone", () => {
  it("a typed local time becomes the matching instant and back", () => {
    expect(fromDateTimeInput("2030-06-01T10:30")).toBe(new Date(2030, 5, 1, 10, 30).toISOString());
    expect(toDateTimeInput(new Date(2030, 5, 1, 10, 30).toISOString())).toBe("2030-06-01T10:30");
  });
  it.each(["", null, "nonsense"])("%j is no deadline", (value) => {
    expect(fromDateTimeInput(value)).toBeNull();
  });
  it("shows nothing for a missing or invalid instant", () => {
    expect(toDateTimeInput(null)).toBe("");
    expect(toDateTimeInput("nope")).toBe("");
  });
});

describe("request bodies", () => {
  it("a new job sends what was filled in, trimmed, under backend names", () => {
    const body = jobBody({ ...complete(), title: "  Dev  ", salaryMin: "100", salaryMax: "200", salaryCurrency: " pkr ", showSalary: true, openings: "3", minExperienceYears: "2" });
    expect(body).toMatchObject({ title: "Dev", department: "Eng", employment_type: "full_time", work_mode: "hybrid", required_skills: ["Python"], salary_min: 100, salary_max: 200, salary_currency: "pkr", show_salary: true, openings: 3, min_experience_years: 2 });
    expect(body.deadline).toBe(new Date(2030, 0, 1, 10, 0).toISOString());
  });
  it("a draft with only a title and department sends nothing else that is empty", () => {
    const body = jobBody({ ...blankJobForm(), title: "T", department: "D" });
    expect(Object.keys(body).sort()).toEqual(["department", "education_level", "min_experience_years", "openings", "required_skills", "show_salary", "soft_skills", "title"]);
  });
  it("an edit sends only the changed fields; a cleared salary goes as null", () => {
    const base = formFromJob(mapJob(apiJob()));
    expect(changedJobFields({ ...base }, base)).toEqual({});
    expect(changedJobFields({ ...base, title: "New", salaryMin: "", requiredSkills: [...base.requiredSkills, "Go"] }, base)).toEqual({ title: "New", salary_min: null, required_skills: ["Python", "Django", "Go"] });
  });
  it("clearing the deadline is sent as null", () => {
    const base = formFromJob(mapJob(apiJob()));
    expect(changedJobFields({ ...base, deadline: "" }, base)).toEqual({ deadline: null });
  });
  it("an unchanged deadline is not resent (seconds from the server do not count as a change)", () => {
    const base = formFromJob(mapJob(apiJob({ deadline: "2030-01-01T10:00:37Z" })));
    expect(changedJobFields({ ...base }, base)).toEqual({});
  });
});

describe("server errors", () => {
  it("lands on form fields, keeps custom field problems together", () => {
    const mapped = mapJobErrors({ required_skills: ["Add at least one required skill."], employment_type: ["Employment type is required to publish."], custom_fields: ["Custom field 'A': bad", "Custom field 'B': bad"], weird: ["x"] });
    expect(mapped).toMatchObject({ requiredSkills: "Add at least one required skill.", employmentType: "Employment type is required to publish.", custom_fields: "Custom field 'A': bad", weird: "x" });
    expect(mapped.customFieldsAll).toHaveLength(2);
  });
});

describe("local checks mirror the server", () => {
  it("a draft needs a title and a department only", () => {
    expect(draftProblems({ ...blankJobForm(), title: "T", department: "D" })).toEqual({});
    expect(draftProblems(blankJobForm())).toMatchObject({ title: expect.any(String), department: expect.any(String) });
  });
  it("publishing lists every missing item at once", () => {
    expect(Object.keys(publishProblems(blankJobForm())).sort()).toEqual(["deadline", "department", "description", "employmentType", "location", "requiredSkills", "title"]);
    expect(publishProblems(complete())).toEqual({});
  });
  it("remote needs no location", () => {
    expect(publishProblems({ ...complete(), workMode: "remote", location: "" })).toEqual({});
    expect(publishProblems({ ...complete(), workMode: "", location: "" }).location).toBeTruthy();
  });
  it.each([
    [{ salaryMin: "200", salaryMax: "100", salaryCurrency: "PKR" }, "salaryMax"],
    [{ salaryMin: "100" }, "salaryCurrency"],
    [{ salaryMax: "-5", salaryCurrency: "PKR" }, "salaryMax"],
    [{ salaryMin: "1.5", salaryCurrency: "PKR" }, "salaryMin"],
    [{ salaryMin: "2000000000", salaryCurrency: "PKR" }, "salaryMin"],
    [{ openings: "0" }, "openings"],
    [{ openings: "1001" }, "openings"],
    [{ minExperienceYears: "31" }, "minExperienceYears"],
    [{ minExperienceYears: "-1" }, "minExperienceYears"],
    [{ title: "x".repeat(151) }, "title"],
    [{ description: "x".repeat(10001) }, "description"],
    [{ salaryCurrency: "ABCDEFGHIJK" }, "salaryCurrency"],
  ])("rejects %j on %s", (change, key) => {
    expect(draftProblems({ ...complete(), ...change })[key]).toBeTruthy();
  });
  it("accepts the boundaries", () => {
    expect(draftProblems({ ...complete(), openings: "1000", minExperienceYears: "30", salaryMin: "0", salaryMax: "1000000000", salaryCurrency: "PKR" })).toEqual({});
  });
});

describe("custom fields", () => {
  it("knows the type groups", () => {
    expect(isChoiceType("single_choice") && isChoiceType("multiple_choice") && !isChoiceType("short_text")).toBe(true);
    expect(isTextType("short_text") && isTextType("long_text") && !isTextType("number")).toBe(true);
  });
  it("a choice field sends its options and no max length; a text field the reverse", () => {
    expect(fieldBody({ ...blankFieldForm(), label: " Pick ", type: "single_choice", options: [" a ", "b"] })).toEqual({ label: "Pick", field_type: "single_choice", required: false, help_text: "", options: ["a", "b"], max_length: null });
    expect(fieldBody({ ...blankFieldForm(), label: "Why", type: "long_text", maxLength: "500", helpText: " h " })).toEqual({ label: "Why", field_type: "long_text", required: false, help_text: "h", options: [], max_length: 500 });
  });
  it("round-trips a saved field into the editor", () => {
    expect(formFromField(mapCustomField(apiField({ field_type: "long_text", max_length: 300, options: [] })))).toMatchObject({ type: "long_text", maxLength: "300" });
  });
  it.each([
    [{ label: "" }, "label"],
    [{ type: "single_choice", options: ["a"] }, "options"],
    [{ type: "single_choice", options: Array.from({ length: 21 }, (_, i) => `o${i}`) }, "options"],
    [{ type: "single_choice", options: ["a", "A"] }, "options"],
    [{ type: "single_choice", options: ["a", ""] }, "options"],
    [{ type: "short_text", maxLength: "0" }, "maxLength"],
    [{ type: "short_text", maxLength: "5001" }, "maxLength"],
    [{ type: "short_text", maxLength: "1.5" }, "maxLength"],
  ])("rejects %j on %s", (change, key) => {
    expect(fieldProblems({ ...blankFieldForm(), label: "L", ...change })[key]).toBeTruthy();
  });
  it("accepts a valid choice field", () => {
    expect(fieldProblems({ ...blankFieldForm(), label: "L", type: "multiple_choice", options: ["a", "b"] })).toEqual({});
  });
});

describe("salary text and permissions", () => {
  it("uses the job's own currency (never a hard-coded symbol)", () => {
    expect(formatSalary({ min: 1000, max: 2000, currency: "PKR" })).toBe("PKR 1,000 – 2,000");
    expect(formatSalary({ min: 1000, max: null, currency: "USD" })).toBe("From USD 1,000");
    expect(formatSalary({ min: null, max: 2000, currency: "" })).toBe("Up to 2,000");
    expect(formatSalary(null)).toBeNull();
  });
  it.each([["admin", true, true], ["hr_manager", true, true], ["recruiter", true, false], ["viewer", false, false], [null, false, false]])("%s: edit %s, manage %s", (role, edit, manage) => {
    expect(canEditJobs({ memberRole: role })).toBe(edit);
    expect(canManageJobs({ memberRole: role })).toBe(manage);
  });
});
