import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { detail, json, route } from "@/test/fixtures";
import LiveInterviewRoom from "./LiveInterviewRoom";

const summary = (overrides = {}) => ({
  kind: "screening", role_title: "Backend Developer", company_name: "Acme", status: "invited",
  question_count: 3, answered_count: 0, current_turn: null, seconds_left_to_start: 600000,
  estimated_minutes: 3, voice_available: true, ai_disclaimer: "An AI conducts this interview.", ...overrides,
});

/** A fake WebSocket the test drives: it records what the page sent and pushes server frames back. */
class FakeSocket {
  static last = null;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.sent = [];
    FakeSocket.last = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; }
  emit(payload) { act(() => { this.onmessage?.({ data: JSON.stringify(payload) }); }); }
  emitAudio(bytes) { act(() => { this.onmessage?.({ data: new Int16Array(bytes).buffer }); }); }
  get texts() { return this.sent.filter((d) => typeof d === "string").map((d) => JSON.parse(d)); }
}

let audio;

beforeEach(() => {
  audio = { play: vi.fn(), stopPlayback: vi.fn(), close: vi.fn() };
  vi.stubGlobal("WebSocket", FakeSocket);
  FakeSocket.last = null;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

vi.mock("@/lib/liveAudio", async () => {
  const actual = await vi.importActual("@/lib/liveAudio");
  return {
    ...actual,
    openAudio: vi.fn(async ({ onChunk }) => {
      globalThis.__pushChunk = onChunk;
      return globalThis.__audio;
    }),
  };
});

function mount({ status = 200, body = summary() } = {}) {
  globalThis.__audio = audio;
  server.use(route.get("/public/interviews/tok-1/", () => (status === 200 ? json(body) : detail(status, "Gone.", "interview_expired"))));
  render(<MemoryRouter><LiveInterviewRoom token="tok-1" /></MemoryRouter>);
}

const start = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /start the interview/i }));
  await waitFor(() => expect(FakeSocket.last).not.toBeNull());
  return user;
};

describe("LiveInterviewRoom: before the call", () => {
  it("describes the interview and says a person decides, not the AI", async () => {
    mount();
    expect(await screen.findByText("Backend Developer")).toBeInTheDocument();
    expect(screen.getByText("Screening interview")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/spoken interview with an AI interviewer/)).toBeInTheDocument();
    expect(screen.getByText(/A person reviews the result; the AI does not decide/)).toBeInTheDocument();
    expect(screen.getByText(/about 3 minutes/)).toBeInTheDocument();
  });

  it("shows an already-finished interview as finished instead of offering to start", async () => {
    mount({ body: summary({ status: "evaluated" }) });
    expect(await screen.findByText("Interview finished")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start the interview/i })).not.toBeInTheDocument();
  });

  it("explains an expired link in the candidate's words", async () => {
    mount({ status: 410 });
    expect(await screen.findByRole("alert")).toHaveTextContent("This interview link has expired");
  });

  it("asks for the microphone again rather than failing silently", async () => {
    const { openAudio } = await import("@/lib/liveAudio");
    const { MicrophoneDenied } = await vi.importActual("@/lib/liveAudio");
    openAudio.mockRejectedValueOnce(new MicrophoneDenied("no mic"));
    mount();
    await userEvent.setup().click(await screen.findByRole("button", { name: /start the interview/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("needs your microphone");
    expect(screen.getByRole("button", { name: /start the interview/i })).toBeEnabled();
  });
});

describe("LiveInterviewRoom: the call", () => {
  it("sends the token in the first frame, never in the URL", async () => {
    mount();
    await start();
    expect(FakeSocket.last.url).not.toContain("tok-1");
    expect(FakeSocket.last.texts[0]).toEqual({ type: "start", token: "tok-1" });
  });

  it("goes live on ready and counts the time down", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    expect(await screen.findByText("Live")).toBeInTheDocument();
    expect(screen.getByText("3:00")).toBeInTheDocument();
  });

  it("streams microphone audio to the server once live", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    const chunk = new Int16Array([1, 2, 3]).buffer;
    act(() => globalThis.__pushChunk(chunk));
    expect(FakeSocket.last.sent).toContain(chunk);
  });

  it("plays the interviewer's audio and shows who is speaking", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    FakeSocket.last.emitAudio([5, 6, 7]);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("The interviewer is speaking")).toBeInTheDocument();
  });

  it("drops queued audio when the candidate interrupts", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    FakeSocket.last.emitAudio([1]);
    FakeSocket.last.emit({ type: "interrupted" });
    expect(audio.stopPlayback).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Your turn/)).toBeInTheDocument();
  });

  it("builds the conversation from streaming fragments", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    FakeSocket.last.emit({ type: "transcript", role: "interviewer", text: "Tell me " });
    FakeSocket.last.emit({ type: "transcript", role: "interviewer", text: "about yourself." });
    FakeSocket.last.emit({ type: "transcript", role: "candidate", text: "I build APIs." });
    expect(await screen.findByText(/Tell me about yourself\./)).toBeInTheDocument();
    expect(screen.getByText(/I build APIs\./)).toBeInTheDocument();
  });

  it("ends the call on request and tells the server to stop", async () => {
    mount();
    const user = await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    await user.click(screen.getByRole("button", { name: /end interview/i }));
    expect(FakeSocket.last.texts.some((m) => m.type === "stop")).toBe(true);
    FakeSocket.last.emit({ type: "ended", reason: "stopped" });
    expect(await screen.findByText("Interview finished")).toBeInTheDocument();
    expect(audio.close).toHaveBeenCalled();
  });

  it("closes the microphone when the time runs out", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    FakeSocket.last.emit({ type: "ended", reason: "time_up" });
    expect(await screen.findByText("Interview finished")).toBeInTheDocument();
    expect(audio.close).toHaveBeenCalled();
  });

  it("says the answers are safe when the service fails mid-call", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "ready", seconds: 180 });
    FakeSocket.last.emit({ type: "ended", reason: "error: RuntimeError" });
    expect(await screen.findByRole("alert")).toHaveTextContent("has been saved");
  });

  it("surfaces a refusal from the server as its own message", async () => {
    mount();
    await start();
    FakeSocket.last.emit({ type: "error", code: "interview_completed", message: "done" });
    expect(await screen.findByRole("alert")).toHaveTextContent("already been completed");
  });
});
