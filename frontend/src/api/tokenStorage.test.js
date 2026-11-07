import { describe, expect, it, vi } from "vitest";
import { SESSION_KEY, clearLegacySession, clearTokens, getTokens, hasSession, onTokensChanged, setTokens } from "./tokenStorage";

describe("tokenStorage", () => {
  it("writes access and refresh together under one key", () => {
    setTokens({ access: "a", refresh: "r" });
    expect(Object.keys(localStorage)).toEqual([SESSION_KEY]);
    expect(getTokens()).toEqual({ access: "a", refresh: "r" });
    expect(hasSession()).toBe(true);
  });

  it("clears both together", () => {
    setTokens({ access: "a", refresh: "r" });
    clearTokens();
    expect(getTokens()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(hasSession()).toBe(false);
  });

  it.each([["not json"], ["{}"], ['{"access":"a"}'], ['{"access":1,"refresh":2}'], ["null"]])("treats corrupt storage %s as no session", (raw) => {
    localStorage.setItem(SESSION_KEY, raw);
    expect(getTokens()).toBeNull();
  });

  it("replaces a rotated pair as a whole", () => {
    setTokens({ access: "a1", refresh: "r1" });
    setTokens({ access: "a2", refresh: "r2" });
    expect(getTokens()).toEqual({ access: "a2", refresh: "r2" });
  });

  it("falls back to memory when storage is blocked", () => {
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setTokens({ access: "m", refresh: "n" });
    expect(getTokens()).toEqual({ access: "m", refresh: "n" });
    set.mockRestore();
    get.mockRestore();
    clearTokens();
  });

  it("tells the listener when ANOTHER tab changes the session", () => {
    const listener = vi.fn();
    const stop = onTokensChanged(listener);
    setTokens({ access: "a", refresh: "r" });
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY }));
    expect(listener).toHaveBeenLastCalledWith({ access: "a", refresh: "r" });
    clearTokens();
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY }));
    expect(listener).toHaveBeenLastCalledWith(null);
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("removes the keys of the old demo login", () => {
    localStorage.setItem("intellihire_access_token", "x");
    localStorage.setItem("intellihire_user", "{}");
    clearLegacySession();
    expect(localStorage.length).toBe(0);
  });
});
