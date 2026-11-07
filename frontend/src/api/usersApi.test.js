import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { apiUser, errors, json, route, tokens } from "@/test/fixtures";
import { listAllUsers, usersApi } from "./usersApi";
import { setTokens } from "./tokenStorage";

beforeEach(() => setTokens(tokens(1)));

const page = (n, count, total, next) => ({
  count: total, next: next ? `http://api.test/api/platform-admin/users/?page=${n + 1}` : null, previous: null,
  results: Array.from({ length: count }, (_, i) => apiUser({ id: `id-${n}-${i}`, email: `u${n}-${i}@x.co` })),
  status_counts: { active: total, total },
});

describe("usersApi", () => {
  it("builds repeated query parameters and skips empty ones", async () => {
    let url;
    server.use(route.get("/platform-admin/users/", ({ request }) => ((url = new URL(request.url)), json(page(1, 0, 0, false)))));
    await usersApi.list({ role: ["candidate", "hr"], status: [], search: "ana zaidi", ordering: "-date_joined", page: undefined });
    expect(url.searchParams.getAll("role")).toEqual(["candidate", "hr"]);
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.get("search")).toBe("ana zaidi");
  });

  it("suspend and reactivate post to the right endpoints", async () => {
    const seen = [];
    server.use(
      route.post("/platform-admin/users/:id/suspend/", ({ params }) => (seen.push(["suspend", params.id]), json(apiUser({ status: "suspended" })))),
      route.post("/platform-admin/users/:id/reactivate/", ({ params }) => (seen.push(["reactivate", params.id]), json(apiUser()))),
    );
    expect((await usersApi.suspend("abc")).status).toBe("suspended");
    await usersApi.reactivate("abc");
    expect(seen).toEqual([["suspend", "abc"], ["reactivate", "abc"]]);
  });

  it("surfaces the server's rules as codes", async () => {
    server.use(route.post("/platform-admin/users/:id/suspend/", () => json({ detail: "You cannot suspend yourself.", code: "cannot_suspend_self" }, 400)));
    expect(await usersApi.suspend("me").catch((e) => e)).toMatchObject({ code: "cannot_suspend_self", message: "You cannot suspend yourself." });
  });

  it("a non-admin gets 403", async () => {
    server.use(route.get("/platform-admin/users/", () => errors.denied()));
    expect(await usersApi.list().catch((e) => e)).toMatchObject({ status: 403 });
  });
});

describe("listAllUsers", () => {
  it("follows the pages until the end", async () => {
    server.use(route.get("/platform-admin/users/", ({ request }) => {
      const n = Number(new URL(request.url).searchParams.get("page"));
      return json(page(n, n < 3 ? 100 : 40, 240, n < 3));
    }));
    const all = await listAllUsers();
    expect([all.results.length, all.truncated, all.total]).toEqual([240, false, 240]);
  });

  it("stops at the cap and says so", async () => {
    server.use(route.get("/platform-admin/users/", ({ request }) => {
      const n = Number(new URL(request.url).searchParams.get("page"));
      return json(page(n, 100, 5000, true));
    }));
    const all = await listAllUsers({}, { cap: 250 });
    expect([all.results.length, all.truncated]).toEqual([250, true]);
  });

  it("asks for the largest page", async () => {
    let size;
    server.use(route.get("/platform-admin/users/", ({ request }) => ((size = new URL(request.url).searchParams.get("page_size")), json(page(1, 1, 1, false)))));
    await listAllUsers();
    expect(size).toBe("100");
  });
});
