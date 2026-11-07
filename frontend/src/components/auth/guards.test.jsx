import { describe, expect, it } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { HttpResponse } from "msw";
import { server } from "@/test/server";
import { apiProfile, apiUser, errors, json, route } from "@/test/fixtures";
import { renderRoutes } from "@/test/utils";
import { useAuthStore } from "@/store/authStore";
import { getTokens, setTokens, SESSION_KEY } from "@/api/tokenStorage";
import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";
import RoleProtectedRoute from "./RoleProtectedRoute";
import AuthProvider from "./AuthProvider";
import CandidateGate from "@/components/candidate/CandidateGate";

const signedIn = (role, status = "active") => useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "1", role, status, name: "X" } });

function Role({ roles }) {
  return <RoleProtectedRoute allowedRoles={roles} />;
}
const tree = (roles) => ({
  "/": <div>HOME</div>,
  "/login": <div>LOGIN</div>,
  "/candidate/dashboard": <div>CANDIDATE DASH</div>,
  "/company/dashboard": <div>COMPANY DASH</div>,
  "/company/pending": <div>COMPANY PENDING</div>,
  "/admin/dashboard": <div>ADMIN DASH</div>,
  "/private": <ProtectedRoute><div>PRIVATE</div></ProtectedRoute>,
  "/guest": <GuestRoute><div>GUEST ONLY</div></GuestRoute>,
  ...roles,
});

describe("ProtectedRoute / GuestRoute", () => {
  it("sends a signed-out visitor to /login", () => {
    renderRoutes(tree({}), "/private");
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });
  it("lets a signed-in user in", () => {
    signedIn("candidate");
    renderRoutes(tree({}), "/private");
    expect(screen.getByText("PRIVATE")).toBeInTheDocument();
  });
  it.each([["candidate", "CANDIDATE DASH"], ["company", "COMPANY DASH"], ["admin", "ADMIN DASH"]])("keeps a signed-in %s off the guest pages", (role, text) => {
    signedIn(role);
    renderRoutes(tree({}), "/guest");
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it("shows guest pages to a signed-out visitor", () => {
    renderRoutes(tree({}), "/guest");
    expect(screen.getByText("GUEST ONLY")).toBeInTheDocument();
  });
});

describe("RoleProtectedRoute", () => {
  const guarded = (extra = {}) => ({
    ...tree({}),
    "/candidate-area": <Role roles={["candidate"]} />,
    ...extra,
  });
  const companyRouter = (start) =>
    render(
      <RouterProvider
        router={createMemoryRouter(
          [{
            element: <Role roles={["company"]} />,
            children: [
              { path: "/company/dashboard", element: <div>COMPANY DASH</div> },
              { path: "/company/pending", element: <div>COMPANY PENDING</div> },
              { path: "/company/jobs", element: <div>COMPANY JOBS</div> },
            ],
          }],
          { initialEntries: [start] },
        )}
      />,
    );
  it("redirects the signed-out to /login", () => {
    renderRoutes(guarded(), "/candidate-area");
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });
  it.each([["company", "COMPANY DASH"], ["admin", "ADMIN DASH"]])("sends a %s who opens a candidate area to their own dashboard", (role, text) => {
    signedIn(role);
    renderRoutes(guarded(), "/candidate-area");
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it("holds a company that is awaiting approval on /company/pending", () => {
    signedIn("company", "pending");
    companyRouter("/company/jobs");
    expect(screen.getByText("COMPANY PENDING")).toBeInTheDocument();
  });
  it("sends an approved company away from /company/pending", () => {
    signedIn("company", "active");
    companyRouter("/company/pending");
    expect(screen.getByText("COMPANY DASH")).toBeInTheDocument();
  });
  it("lets an approved company use its pages", () => {
    signedIn("company", "active");
    companyRouter("/company/jobs");
    expect(screen.getByText("COMPANY JOBS")).toBeInTheDocument();
  });
});

describe("AuthProvider", () => {
  const boot = (user) => route.get("/auth/me/", () => json(user));

  it("rebuilds the user from /auth/me/ before rendering", async () => {
    setTokens({ access: "a", refresh: "r" });
    server.use(boot(apiUser()));
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    expect(await screen.findByText("APP")).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, user: { name: "Sara Malik" } });
  });

  it("signed-out boot makes no request and renders", async () => {
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    expect(await screen.findByText("APP")).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("keeps the session and offers a retry when the server cannot be reached at boot", async () => {
    setTokens({ access: "a", refresh: "r" });
    server.use(route.get("/auth/me/", () => HttpResponse.error()));
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(getTokens()).not.toBeNull();
    server.use(boot(apiUser()));
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("APP")).toBeInTheDocument();
  });

  it("clears the session when the tokens are rejected at boot", async () => {
    setTokens({ access: "a", refresh: "r" });
    server.use(route.get("/auth/me/", () => errors.tokenInvalid()), route.post("/auth/token/refresh/", () => errors.tokenInvalid()));
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    expect(await screen.findByText("APP")).toBeInTheDocument();
    expect(getTokens()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("signs this tab out when another tab logs out", async () => {
    setTokens({ access: "a", refresh: "r" });
    server.use(boot(apiUser()));
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    await screen.findByText("APP");
    await act(async () => {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY, oldValue: "x", newValue: null }));
    });
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  });

  it("signs this tab in when another tab logs in", async () => {
    renderRoutes({ "/": <AuthProvider><div>APP</div></AuthProvider> }, "/");
    await screen.findByText("APP");
    server.use(boot(apiUser()));
    const value = JSON.stringify({ access: "a", refresh: "r" });
    await act(async () => {
      localStorage.setItem(SESSION_KEY, value);
      window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY, oldValue: null, newValue: value }));
    });
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  });
});

describe("CandidateGate", () => {
  it("loads the profile before rendering any candidate page, and retries after a failure", async () => {
    useAuthStore.setState({ isAuthenticated: true, isInitialized: true, user: { id: "u1", role: "candidate", status: "active", name: "Sara", email: "s@x.co" } });
    let fail = true;
    server.use(
      route.get("/auth/profile/", () => (fail ? HttpResponse.error() : json(apiProfile({ headline: "Backend dev" })))),
      route.get("/auth/profile/education/", () => json([])),
      route.get("/auth/profile/experience/", () => json([])),
    );
    const router = createMemoryRouter([{ path: "/c", element: <CandidateGate />, children: [{ index: true, element: <div>CANDIDATE PAGE</div> }] }], { initialEntries: ["/c"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("CANDIDATE PAGE")).not.toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("CANDIDATE PAGE")).toBeInTheDocument();
  });
});
