import { describe, expect, it } from "vitest";
import { ApiError, buildApiError, formatWait, networkError, parseRetryAfter, throttledMessage } from "./errors";

describe("buildApiError", () => {
  it("reads a general error with a code", () => {
    const e = buildApiError(401, JSON.stringify({ detail: "Invalid email or password.", code: "invalid_credentials" }));
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.message]).toEqual([401, "invalid_credentials", "Invalid email or password."]);
    expect(e.fieldErrors).toEqual({});
  });

  it("reads field errors and keeps every field", () => {
    const e = buildApiError(400, JSON.stringify({ email: ["Email already registered."], password: ["Too short.", "Too common."] }));
    expect(e.code).toBe("validation_error");
    expect(e.fieldErrors).toEqual({ email: ["Email already registered."], password: ["Too short.", "Too common."] });
    expect(e.field("password")).toBe("Too short.");
    expect(e.field("nope")).toBe("");
    expect(e.message).toBe("Please check the highlighted fields.");
  });

  it("accepts a single string as a field message", () => {
    expect(buildApiError(400, JSON.stringify({ resume: "Only PDF and DOCX files are accepted." })).fieldErrors.resume).toEqual(["Only PDF and DOCX files are accepted."]);
  });

  it("moves non_field_errors into the message", () => {
    const e = buildApiError(400, JSON.stringify({ non_field_errors: ["Passwords differ."] }));
    expect(e.message).toBe("Passwords differ.");
    expect(e.fieldErrors).toEqual({});
  });

  it("does not crash on an HTML page, an empty body or a JSON list", () => {
    for (const text of ["<html>Bad gateway</html>", "", "[1,2]", "null"]) {
      const e = buildApiError(400, text);
      expect(e).toBeInstanceOf(ApiError);
      expect(e.fieldErrors).toEqual({});
    }
    expect(buildApiError(404, "").message).toBe("Not found.");
  });

  it("never leaks server text on a 5xx", () => {
    const e = buildApiError(500, JSON.stringify({ detail: "Traceback: secret-host-name" }));
    expect(e.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(e)).not.toContain("secret-host-name");
  });

  it("maps 413 and 429", () => {
    expect(buildApiError(413, "").message).toBe("That file or request is too large.");
    const t = buildApiError(429, JSON.stringify({ detail: "Request was throttled. Expected available in 58 seconds.", code: "throttled" }));
    expect([t.code, t.retryAfterSeconds, t.message]).toEqual(["throttled", 58, "Too many attempts. Try again in 58 seconds."]);
    const unknown = buildApiError(429, "");
    expect(unknown.retryAfterSeconds).toBeNull();
    expect(unknown.message).toBe("Too many attempts. Please wait a moment and try again.");
  });
});

describe("helpers", () => {
  it("parses the wait from a throttle detail", () => {
    expect(parseRetryAfter("Expected available in 3 seconds.")).toBe(3);
    expect(parseRetryAfter("Expected available in 1 second.")).toBe(1);
    expect(parseRetryAfter("nothing here")).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
  it("formats waits", () => {
    expect(formatWait(1)).toBe("1 second");
    expect(formatWait(59)).toBe("59 seconds");
    expect(formatWait(120)).toBe("2 minutes");
    expect(throttledMessage(3500)).toContain("minutes");
  });
  it("a network error is flagged and friendly", () => {
    const e = networkError(new Error("boom"));
    expect([e.isNetwork, e.code, e.status]).toEqual([true, "network", 0]);
    expect(e.message).toMatch(/reach the server/);
  });
});
