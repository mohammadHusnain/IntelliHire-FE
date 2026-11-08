import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { delay } from "msw";
import { server } from "@/test/server";
import { bearer, detail, errors, json, route, tokens } from "@/test/fixtures";
import { HttpResponse } from "msw";
import { ApiError } from "./errors";
import { api, filenameFrom, setSessionEndedHandler } from "./client";
import { clearTokens, getTokens, setTokens } from "./tokenStorage";

const ended = vi.fn();
beforeEach(() => {
  ended.mockReset();
  setSessionEndedHandler(ended);
  clearTokens();
});
afterEach(() => setSessionEndedHandler(null));

/** A protected endpoint that accepts only `valid` as the access token. */
function protectedRoute(valid, onCall) {
  return route.get("/thing/", ({ request }) => {
    onCall?.(bearer(request));
    return bearer(request) === `Bearer ${valid}` ? json({ ok: true }) : errors.tokenInvalid();
  });
}

describe("requests", () => {
  it("sends the bearer token and parses JSON", async () => {
    setTokens(tokens(1));
    let seen;
    server.use(route.get("/thing/", ({ request }) => ((seen = bearer(request)), json({ a: 1 }))));
    expect(await api.get("/thing/")).toEqual({ a: 1 });
    expect(seen).toBe("Bearer access-1");
  });

  it("sends no Authorization header without a session or when auth is off", async () => {
    const seen = [];
    server.use(route.get("/thing/", ({ request }) => (seen.push(bearer(request)), json({}))));
    await api.get("/thing/");
    setTokens(tokens(1));
    await api.get("/thing/", { auth: false });
    expect(seen).toEqual([null, null]);
  });

  it("sends JSON bodies with a content type and FormData without one", async () => {
    let jsonType;
    let formType;
    server.use(
      route.post("/j/", ({ request }) => ((jsonType = request.headers.get("content-type")), json({}))),
      route.post("/f/", ({ request }) => ((formType = request.headers.get("content-type")), json({}))),
    );
    await api.post("/j/", { a: 1 });
    const form = new FormData();
    form.append("x", "1");
    await api.post("/f/", form);
    expect(jsonType).toBe("application/json");
    expect(formType).toMatch(/^multipart\/form-data; boundary=/);
  });

  it("returns null for 204 and 205 and for an empty body", async () => {
    server.use(route.post("/a/", () => new HttpResponse(null, { status: 205 })), route.delete("/b/", () => new HttpResponse(null, { status: 204 })));
    expect(await api.post("/a/")).toBeNull();
    expect(await api.delete("/b/")).toBeNull();
  });

  it("throws a parse error on a 200 that is not JSON", async () => {
    server.use(route.get("/x/", () => new HttpResponse("<html>", { status: 200 })));
    await expect(api.get("/x/")).rejects.toMatchObject({ code: "parse" });
  });

  it.each([
    [400, { email: ["Bad."] }, "validation_error"],
    [404, { detail: "Not found.", code: "not_found" }, "not_found"],
    [409, { detail: "Conflict.", code: "invalid_state" }, "invalid_state"],
  ])("throws an ApiError for %i", async (status, body, code) => {
    server.use(route.get("/x/", () => json(body, status)));
    const error = await api.get("/x/").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.code]).toEqual([status, code]);
  });

  it("maps 429, 413 and 5xx without leaking server text", async () => {
    server.use(route.get("/t/", () => errors.throttled(12)), route.get("/l/", () => errors.tooLarge()), route.get("/s/", () => json({ detail: "secret stack" }, 502)));
    expect(await api.get("/t/").catch((e) => e)).toMatchObject({ code: "throttled", retryAfterSeconds: 12 });
    expect(await api.get("/l/").catch((e) => e)).toMatchObject({ status: 413, message: "That file or request is too large." });
    const server5 = await api.get("/s/").catch((e) => e);
    expect(server5.message).toBe("Something went wrong. Please try again.");
  });

  it("turns a dropped connection into a friendly network error", async () => {
    server.use(route.get("/x/", () => HttpResponse.error()));
    const error = await api.get("/x/").catch((e) => e);
    expect([error.code, error.isNetwork]).toEqual(["network", true]);
  });

  it("times out", async () => {
    server.use(route.get("/slow/", async () => (await delay(200), json({}))));
    const error = await api.get("/slow/", { timeoutMs: 30 }).catch((e) => e);
    expect(error).toMatchObject({ code: "timeout", isNetwork: true });
  });

  it("can be cancelled with an AbortSignal", async () => {
    server.use(route.get("/slow/", async () => (await delay(200), json({}))));
    const controller = new AbortController();
    const pending = api.get("/slow/", { signal: controller.signal }).catch((e) => e);
    controller.abort();
    expect(await pending).toMatchObject({ code: "aborted" });
  });
});

describe("silent refresh", () => {
  it("refreshes once on 401, stores the NEW pair and retries the request once", async () => {
    setTokens(tokens(1));
    const calls = [];
    let refreshBody;
    server.use(
      protectedRoute("access-2", (auth) => calls.push(auth)),
      route.post("/auth/token/refresh/", async ({ request }) => ((refreshBody = await request.json()), json({ access: "access-2", refresh: "refresh-2" }))),
    );
    expect(await api.get("/thing/")).toEqual({ ok: true });
    expect(refreshBody).toEqual({ refresh: "refresh-1" });
    expect(calls).toEqual(["Bearer access-1", "Bearer access-2"]);
    expect(getTokens()).toEqual({ access: "access-2", refresh: "refresh-2" }); // the rotated refresh token is the one kept
    expect(ended).not.toHaveBeenCalled();
  });

  it("makes exactly ONE refresh call for many parallel 401s, and every request is retried", async () => {
    setTokens(tokens(1));
    let refreshes = 0;
    server.use(
      protectedRoute("access-2"),
      route.post("/auth/token/refresh/", async () => (refreshes++, await delay(40), json({ access: "access-2", refresh: "refresh-2" }))),
    );
    const results = await Promise.all(Array.from({ length: 8 }, () => api.get("/thing/")));
    expect(results).toEqual(Array(8).fill({ ok: true }));
    expect(refreshes).toBe(1);
  });

  it("retries only once: a second 401 is returned, never a loop", async () => {
    setTokens(tokens(1));
    let hits = 0;
    let refreshes = 0;
    server.use(
      route.get("/thing/", () => (hits++, errors.tokenInvalid())),
      route.post("/auth/token/refresh/", () => (refreshes++, json({ access: "access-2", refresh: "refresh-2" }))),
    );
    const error = await api.get("/thing/").catch((e) => e);
    expect(error.status).toBe(401);
    expect([hits, refreshes]).toEqual([2, 1]);
  });

  it("ends the session when the refresh token is refused", async () => {
    setTokens(tokens(1));
    server.use(protectedRoute("never"), route.post("/auth/token/refresh/", () => errors.tokenInvalid()));
    const error = await api.get("/thing/").catch((e) => e);
    expect(error.status).toBe(401);
    expect(getTokens()).toBeNull();
    expect(ended).toHaveBeenCalledWith("expired");
  });

  it("tells a deactivated member why the session ended (not 'expired')", async () => {
    setTokens(tokens(1));
    server.use(protectedRoute("never"), route.post("/auth/token/refresh/", () => detail(401, "Your access to this company has been turned off. Contact your company admin.", "member_deactivated")));
    await api.get("/thing/").catch(() => {});
    expect(getTokens()).toBeNull();
    expect(ended).toHaveBeenCalledWith("deactivated");
  });

  it("KEEPS the session when the network fails during the refresh", async () => {
    setTokens(tokens(1));
    server.use(protectedRoute("never"), route.post("/auth/token/refresh/", () => HttpResponse.error()));
    const error = await api.get("/thing/").catch((e) => e);
    expect(error.isNetwork).toBe(true);
    expect(getTokens()).toEqual(tokens(1));
    expect(ended).not.toHaveBeenCalled();
  });

  it("KEEPS the session when the refresh endpoint answers 5xx", async () => {
    setTokens(tokens(1));
    server.use(protectedRoute("never"), route.post("/auth/token/refresh/", () => json({}, 503)));
    const error = await api.get("/thing/").catch((e) => e);
    expect(error.status).toBe(503);
    expect(getTokens()).toEqual(tokens(1));
    expect(ended).not.toHaveBeenCalled();
  });

  it("ends the session at once for a suspended account (account_inactive), without refreshing", async () => {
    setTokens(tokens(1));
    let refreshes = 0;
    server.use(route.get("/thing/", () => errors.accountInactive()), route.post("/auth/token/refresh/", () => (refreshes++, json({}))));
    const error = await api.get("/thing/").catch((e) => e);
    expect(error.code).toBe("account_inactive");
    expect(refreshes).toBe(0);
    expect(getTokens()).toBeNull();
    expect(ended).toHaveBeenCalledWith("suspended");
  });

  it("uses the tokens another tab just stored instead of refreshing again", async () => {
    setTokens(tokens(1));
    let refreshes = 0;
    server.use(
      route.get("/thing/", ({ request }) => {
        if (bearer(request) === "Bearer access-1") {
          setTokens(tokens(2)); // another tab rotated while this request was in flight
          return errors.tokenInvalid();
        }
        return bearer(request) === "Bearer access-2" ? json({ ok: true }) : errors.tokenInvalid();
      }),
      route.post("/auth/token/refresh/", () => (refreshes++, json({ access: "x", refresh: "y" }))),
    );
    expect(await api.get("/thing/")).toEqual({ ok: true });
    expect(refreshes).toBe(0);
  });

  it("a 403 never logs the user out", async () => {
    setTokens(tokens(1));
    server.use(route.get("/thing/", () => errors.denied()));
    const error = await api.get("/thing/").catch((e) => e);
    expect([error.status, error.code]).toEqual([403, "permission_denied"]);
    expect(getTokens()).toEqual(tokens(1));
    expect(ended).not.toHaveBeenCalled();
  });

  it.each([
    "/auth/login/",
    "/auth/token/refresh/",
    "/auth/register/candidate/",
    "/auth/register/company/",
    "/auth/verify-email/",
    "/auth/resend-verification/",
    "/auth/password/forgot/",
    "/auth/password/reset/",
  ])("a 401 from %s is the answer, never a reason to refresh", async (path) => {
    setTokens(tokens(1));
    let refreshes = 0;
    server.use(
      route.post(path, () => errors.invalidCredentials()),
      ...(path === "/auth/token/refresh/" ? [] : [route.post("/auth/token/refresh/", () => (refreshes++, json({})))]),
    );
    const error = await api.post(path, {}, { auth: path === "/auth/token/refresh/" ? false : true }).catch((e) => e);
    expect(error.status).toBe(401);
    expect(refreshes).toBe(0);
    expect(ended).not.toHaveBeenCalled();
  });

  it("does not report an ended session for a 401 when nobody was logged in", async () => {
    server.use(route.get("/thing/", () => errors.tokenInvalid()));
    await expect(api.get("/thing/")).rejects.toMatchObject({ status: 401 });
    expect(ended).not.toHaveBeenCalled();
  });
});

describe("files", () => {
  it("uploads multipart with progress and a cancel signal", async () => {
    setTokens(tokens(1));
    let received;
    server.use(route.put("/up/", async ({ request }) => ((received = (await request.formData()).get("resume")), json({ resume: "/x" }))));
    const form = new FormData();
    form.append("resume", new File(["hello"], "cv.pdf", { type: "application/pdf" }));
    const progress = vi.fn();
    expect(await api.upload("/up/", form, { method: "PUT", onProgress: progress })).toEqual({ resume: "/x" });
    expect(received.name).toBe("cv.pdf");
  });

  it("an upload can be cancelled", async () => {
    setTokens(tokens(1));
    server.use(route.put("/up/", async () => (await delay(300), json({}))));
    const controller = new AbortController();
    const pending = api.upload("/up/", new FormData(), { method: "PUT", onProgress: () => {}, signal: controller.signal }).catch((e) => e);
    setTimeout(() => controller.abort(), 20);
    expect(await pending).toMatchObject({ code: "aborted" });
  });

  it("an upload that gets 401 refreshes and retries once", async () => {
    setTokens(tokens(1));
    const seen = [];
    server.use(
      route.put("/up/", ({ request }) => (seen.push(bearer(request)), bearer(request) === "Bearer access-2" ? json({ ok: 1 }) : errors.tokenInvalid())),
      route.post("/auth/token/refresh/", () => json({ access: "access-2", refresh: "refresh-2" })),
    );
    expect(await api.upload("/up/", new FormData(), { method: "PUT", onProgress: () => {} })).toEqual({ ok: 1 });
    expect(seen).toEqual(["Bearer access-1", "Bearer access-2"]);
  });

  it("downloads a blob with the file name from Content-Disposition", async () => {
    setTokens(tokens(1));
    server.use(route.get("/file/", () => new HttpResponse("PDFDATA", { headers: { "Content-Disposition": 'attachment; filename="Sara CV.pdf"', "Content-Type": "application/pdf" } })));
    const { blob, filename } = await api.download("/file/");
    expect(filename).toBe("Sara CV.pdf");
    expect(await blob.text()).toBe("PDFDATA");
  });

  it("a missing download is a clean 404 error", async () => {
    setTokens(tokens(1));
    server.use(route.get("/file/", () => detail(404, "No resume uploaded.", "not_found")));
    await expect(api.download("/file/")).rejects.toMatchObject({ status: 404, message: "No resume uploaded." });
  });
});

describe("filenameFrom", () => {
  it.each([
    ['attachment; filename="a b.pdf"', "a b.pdf"],
    ["attachment; filename=plain.pdf", "plain.pdf"],
    ["attachment; filename*=UTF-8''na%C3%AFve%20cv.pdf", "naïve cv.pdf"],
    ["attachment", ""],
    [null, ""],
  ])("%s", (header, expected) => expect(filenameFrom(header)).toBe(expected));
});
