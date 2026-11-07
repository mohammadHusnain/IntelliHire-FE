import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";
import { useAuthStore } from "@/store/authStore";
import { useCandidateStore } from "@/store/candidateStore";
import { useToastStore } from "@/store/toastStore";
import { setSessionEndedHandler } from "@/api/client";

const initial = {
  auth: useAuthStore.getState(),
  candidate: useCandidateStore.getState(),
  toast: useToastStore.getState(),
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.setState(initial.auth, true);
  useCandidateStore.setState(initial.candidate, true);
  useToastStore.setState(initial.toast, true);
  // Last: persisted stores write to storage when reset.
  localStorage.clear();
  sessionStorage.clear();
  setSessionEndedHandler(null);
});
afterAll(() => server.close());
