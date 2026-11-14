// Microphone capture and interviewer playback for the live interview.
//
// This is the reference implementation's audio layer, unchanged in behaviour: an AudioWorklet turns
// Float32 mic samples into Int16 and posts ~40 ms chunks, capture runs at 16 kHz so the browser
// resamples for us, and playback schedules each 24 kHz chunk at a running play head so the
// interviewer's voice is gapless. `stopPlayback` drops queued audio when the candidate interrupts.

export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

// AudioWorklet: converts Float32 mic samples to Int16 and posts ~40ms chunks.
const WORKLET_SRC = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(640); this.n = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf.buffer.slice(0));
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);`;

/** Thrown when the candidate refuses the microphone or the browser has none. */
export class MicrophoneDenied extends Error {}

/**
 * Opens the microphone and the two audio contexts.
 * `onChunk(ArrayBuffer)` receives the PCM16 frames to send; call `close()` when the call ends.
 */
export async function openAudio({ onChunk }) {
  let micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new MicrophoneDenied("Microphone permission denied.");
  }

  // Capture context runs at 16kHz so the browser resamples the mic for us.
  const captureCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
  const playCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  let playHead = 0;
  let activeSources = [];

  const workletUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
  try {
    await captureCtx.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }
  const workletNode = new AudioWorkletNode(captureCtx, "pcm-capture");
  captureCtx.createMediaStreamSource(micStream).connect(workletNode);
  workletNode.port.onmessage = (event) => onChunk(event.data);

  function play(arrayBuffer) {
    const pcm = new Int16Array(arrayBuffer);
    if (!pcm.length) return;
    const buffer = playCtx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000;

    const source = playCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playCtx.destination);
    playHead = Math.max(playHead, playCtx.currentTime);
    source.start(playHead);
    playHead += buffer.duration;
    activeSources.push(source);
    source.onended = () => { activeSources = activeSources.filter((s) => s !== source); };
  }

  function stopPlayback() {
    activeSources.forEach((s) => { try { s.stop(); } catch { /* already finished */ } });
    activeSources = [];
    playHead = playCtx.currentTime;
  }

  function close() {
    workletNode.port.onmessage = null;
    micStream.getTracks().forEach((track) => track.stop());
    captureCtx.close().catch(() => {});
    // let any closing words finish, then release the speaker
    const remaining = Math.max(0, (playHead - playCtx.currentTime) * 1000) + 200;
    setTimeout(() => playCtx.close().catch(() => {}), remaining);
  }

  return { play, stopPlayback, close };
}
