import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiProfile, errors, json, route, tokens } from "@/test/fixtures";
import { changedFields, mapFieldErrors, mapProfile, profileApi } from "./profileApi";
import { setTokens } from "./tokenStorage";

const user = { name: "Sara Malik", email: "sara@example.com" };
beforeEach(() => setTokens(tokens(1)));

describe("mapProfile", () => {
  it("maps every field to the shape the candidate pages use", () => {
    const profile = mapProfile(apiProfile({
      phone: "+92 300 1234567", headline: "Dev", location: "Lahore", bio: "Hi", target_role: "Backend Developer", experience_level: "mid",
      skills: ["Python"], linkedin_url: "https://linkedin.com/in/s", github_url: "https://github.com/s", portfolio_url: "https://s.dev",
      resume: "/api/auth/profile/resume/", resume_name: "Sara CV.pdf", avatar: "http://x/media/a.jpg",
      education: [{ id: 1, institution: "FAST" }], experience: [{ id: 2, company: "Acme" }],
    }), user);
    expect(profile).toEqual({
      fullName: "Sara Malik", email: "sara@example.com", phone: "+92 300 1234567", headline: "Dev", location: "Lahore", bio: "Hi",
      targetRole: "Backend Developer", experience: "mid", skills: ["Python"],
      links: { linkedin: "https://linkedin.com/in/s", github: "https://github.com/s", portfolio: "https://s.dev" },
      cv: { name: "Sara CV.pdf" }, photo: "http://x/media/a.jpg", education: [{ id: 1, institution: "FAST" }], experienceRows: [{ id: 2, company: "Acme" }],
      discoverable: false,
    });
  });

  it("an empty profile has no CV, no photo and no experience level (nothing is invented)", () => {
    const profile = mapProfile(apiProfile(), user);
    expect([profile.cv, profile.photo, profile.experience, profile.skills]).toEqual([null, null, "", []]);
  });

  it("a CV without a stored name still shows as a CV", () => {
    expect(mapProfile(apiProfile({ resume: "/x", resume_name: "" }), user).cv).toEqual({ name: "CV" });
  });

  it("ignores an unexpected experience level and non-list values", () => {
    const profile = mapProfile(apiProfile({ experience_level: "guru", skills: null, education: null, experience: undefined }), user);
    expect([profile.experience, profile.skills, profile.education, profile.experienceRows]).toEqual(["", [], [], []]);
  });
});

describe("changedFields", () => {
  const base = mapProfile(apiProfile({ headline: "Dev", skills: ["Python"], linkedin_url: "https://linkedin.com/in/s" }), user);

  it("sends nothing when nothing changed", () => {
    expect(changedFields({ ...base, links: { ...base.links } }, base)).toEqual({});
  });

  it("sends only what changed, under the backend names", () => {
    const draft = { ...base, headline: "Senior Dev", targetRole: "Backend", experience: "senior", phone: "+92 300 1234567", skills: ["Python", "SQL"], links: { ...base.links, github: "https://github.com/s" } };
    expect(changedFields(draft, base)).toEqual({
      headline: "Senior Dev", target_role: "Backend", experience_level: "senior", phone: "+92 300 1234567", skills: ["Python", "SQL"], github_url: "https://github.com/s",
    });
  });

  it("can clear a field", () => {
    expect(changedFields({ ...base, headline: "", links: { ...base.links, linkedin: "" } }, base)).toEqual({ headline: "", linkedin_url: "" });
  });

  it("treats a reordered skills list as a change", () => {
    expect(changedFields({ ...base, skills: ["SQL", "Python"] }, { ...base, skills: ["Python", "SQL"] })).toEqual({ skills: ["SQL", "Python"] });
  });
});

describe("mapFieldErrors", () => {
  it("names the form field for each backend field and keeps the first message", () => {
    expect(mapFieldErrors({ target_role: ["Too long."], linkedin_url: ["Enter a valid URL.", "x"], phone: ["Enter a valid phone number."], mystery: ["?"] })).toEqual({
      targetRole: "Too long.", linkedin: "Enter a valid URL.", phone: "Enter a valid phone number.", mystery: "?",
    });
  });
  it("accepts a custom table", () => {
    expect(mapFieldErrors({ end_date: ["Bad."] }, {})).toEqual({ end_date: "Bad." });
  });
});

describe("requests", () => {
  it("load maps the profile", async () => {
    server.use(route.get("/auth/profile/", () => json(apiProfile({ headline: "Dev" }))));
    expect((await profileApi.load(user)).headline).toBe("Dev");
  });

  it("save PATCHes JSON and returns the mapped result", async () => {
    let body;
    server.use(route.patch("/auth/profile/", async ({ request }) => ((body = await request.json()), json(apiProfile({ headline: "New" })))));
    expect((await profileApi.save({ headline: "New" }, user)).headline).toBe("New");
    expect(body).toEqual({ headline: "New" });
  });

  it("save surfaces field errors from the server", async () => {
    server.use(route.patch("/auth/profile/", () => json({ linkedin_url: ["Enter a valid URL."] }, 400)));
    const error = await profileApi.save({ linkedin_url: "x" }, user).catch((e) => e);
    expect(error.fieldErrors).toEqual({ linkedin_url: ["Enter a valid URL."] });
  });

  it("setAvatar uploads multipart and removeAvatar sends avatar: null", async () => {
    const seen = {};
    server.use(route.patch("/auth/profile/", async ({ request }) => {
      const type = request.headers.get("content-type");
      if (type.includes("multipart")) { seen.upload = (await request.formData()).has("avatar"); return json(apiProfile({ avatar: "http://x/a.jpg" })); }
      seen.remove = await request.json();
      return json(apiProfile());
    }));
    expect((await profileApi.setAvatar(new Blob(["x"], { type: "image/jpeg" }), user)).photo).toBe("http://x/a.jpg");
    expect((await profileApi.removeAvatar(user)).photo).toBeNull();
    expect(seen).toEqual({ upload: true, remove: { avatar: null } });
  });

  it("uploadResume PUTs the file and then re-reads the profile for the stored name", async () => {
    const calls = [];
    server.use(
      route.put("/auth/profile/resume/", async ({ request }) => (calls.push(["put", (await request.formData()).has("resume")]), json({ resume: "/api/auth/profile/resume/" }))),
      route.get("/auth/profile/", () => (calls.push(["get"]), json(apiProfile({ resume: "/api/auth/profile/resume/", resume_name: "cv.pdf" })))),
    );
    const next = await profileApi.uploadResume(new File(["%PDF"], "cv.pdf", { type: "application/pdf" }), user, { onProgress: () => {} });
    expect(next.cv).toEqual({ name: "cv.pdf" });
    expect(calls).toEqual([["put", true], ["get"]]);
  });

  it("a rejected CV carries the server message", async () => {
    server.use(route.put("/auth/profile/resume/", () => json({ resume: ["Only PDF and DOCX files are accepted."] }, 400)));
    const error = await profileApi.uploadResume(new File(["x"], "cv.pdf"), user).catch((e) => e);
    expect(error.fieldErrors.resume[0]).toBe("Only PDF and DOCX files are accepted.");
  });

  it("education and experience rows use their own endpoints", async () => {
    const seen = [];
    server.use(
      route.post("/auth/profile/education/", async ({ request }) => (seen.push(["post", await request.json()]), json({ id: 1 }, 201))),
      route.patch("/auth/profile/education/:id/", async ({ request, params }) => (seen.push(["patch", params.id, await request.json()]), json({ id: 1 }))),
      route.delete("/auth/profile/education/:id/", ({ params }) => (seen.push(["delete", params.id]), new Response(null, { status: 204 }))),
      route.post("/auth/profile/experience/", async () => json({ id: 2 }, 201)),
    );
    await profileApi.education.create({ institution: "FAST" });
    await profileApi.education.update(1, { grade: "A" });
    await profileApi.education.remove(1);
    expect((await profileApi.experience.create({ company: "Acme" })).id).toBe(2);
    expect(seen).toEqual([["post", { institution: "FAST" }], ["patch", "1", { grade: "A" }], ["delete", "1"]]);
  });

  it("the row limit and a missing row are clean errors", async () => {
    server.use(
      route.post("/auth/profile/education/", () => json({ detail: "You can add up to 50 entries.", code: "limit_reached" }, 400)),
      route.delete("/auth/profile/education/:id/", () => errors.denied()),
    );
    expect(await profileApi.education.create({}).catch((e) => e)).toMatchObject({ code: "limit_reached" });
    expect(await profileApi.education.remove(9).catch((e) => e)).toMatchObject({ status: 403 });
  });
});
