import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real microphone access with a live input level (0..1).
 * status: "idle" | "requesting" | "active" | "denied" | "unsupported" | "error"
 */
export default function useMicrophone() {
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [status, setStatus] = useState(supported ? "idle" : "unsupported");
  const [level, setLevel] = useState(0);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const frameRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setStatus((s) => (s === "active" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    if (!supported) return false;
    if (streamRef.current) return true;
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus("active");
      return true;
    } catch (err) {
      setStatus(err?.name === "NotAllowedError" || err?.name === "SecurityError" ? "denied" : "error");
      return false;
    }
  }, [supported]);

  useEffect(() => stop, [stop]);

  return { status, level, start, stop, supported };
}
