// The live interview WebSocket (Module 7 `live/`).
//
// The interview token travels in the first frame, never in the URL, so it cannot reach an access
// log. Binary frames are audio in both directions; everything else is JSON.

/** Where the ASGI server listens. Same origin in production; the dev proxy forwards /ws. */
function socketUrl() {
  const base = import.meta.env.VITE_WS_URL;
  if (base) return base.replace(/\/$/, "") + "/ws/interviews/live/";
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws/interviews/live/`;
}

/**
 * Opens the call. Handlers: onReady({seconds}), onAudio(ArrayBuffer), onTranscript({role,text}),
 * onInterrupted(), onEnded({reason}), onError({code,message}).
 * Returns { sendAudio, stop, close }.
 */
export function openLiveInterview(token, handlers) {
  const socket = new WebSocket(socketUrl());
  socket.binaryType = "arraybuffer";
  let closed = false;

  socket.onopen = () => socket.send(JSON.stringify({ type: "start", token }));

  socket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      handlers.onAudio?.(event.data);
      return;
    }
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    switch (message.type) {
      case "ready":
        handlers.onReady?.(message);
        break;
      case "transcript":
        handlers.onTranscript?.(message);
        break;
      case "interrupted":
        handlers.onInterrupted?.();
        break;
      case "ended":
        closed = true;
        handlers.onEnded?.(message);
        break;
      case "error":
        closed = true;
        handlers.onError?.(message);
        break;
      default:
        break;
    }
  };

  socket.onclose = () => {
    if (!closed) handlers.onEnded?.({ reason: "disconnected" });
  };
  socket.onerror = () => {
    if (!closed) handlers.onError?.({ code: "network", message: "The connection to the interview was lost." });
  };

  return {
    sendAudio(chunk) {
      if (socket.readyState === WebSocket.OPEN) socket.send(chunk);
    },
    stop() {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "stop" }));
    },
    close() {
      closed = true;
      if (socket.readyState <= WebSocket.OPEN) socket.close();
    },
  };
}

/** What to tell the candidate for each refusal the server can send. */
export function liveInterviewError(code, fallback) {
  return {
    not_found: "This interview link is not valid. Please check the link in your email.",
    interview_expired: "This interview link has expired. Please contact the recruiting team.",
    interview_completed: "This interview has already been completed. Thank you.",
    interview_cancelled: "This interview has been cancelled. Please contact the recruiting team.",
    interview_unavailable: "This interview is not available at the moment.",
    not_live: "This interview is not a live call.",
    network: "The connection to the interview was lost.",
    server_error: "The interview could not be started. Please try again in a moment.",
  }[code] || fallback || "The interview could not be started.";
}
