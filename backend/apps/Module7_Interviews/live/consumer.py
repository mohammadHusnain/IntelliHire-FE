"""The live interview WebSocket.

    Browser <-> (Channels) <-> this consumer <-> (WebSocket) <-> Gemini Live API

The relay is the reference app's: three tasks race (browser to Gemini, Gemini to browser, and a
timer) and the first to finish ends the call. Only the transport differs, because this is a Channels
consumer rather than a FastAPI route.

Protocol
    client -> server
      text   {"type": "start", "token": "<raw interview token>"}   first message
      binary raw PCM16 mono 16 kHz microphone audio
      text   {"type": "stop"}
    server -> client
      binary raw PCM16 mono 24 kHz interviewer audio
      text   {"type": "ready", "seconds": 180}
      text   {"type": "transcript", "role": "interviewer"|"candidate", "text": "..."}
      text   {"type": "interrupted"}                stop playing queued audio
      text   {"type": "ended", "reason": "..."}
      text   {"type": "error", "code": "...", "message": "..."}

The token arrives in the first frame, never in the URL, so it cannot reach an access log.
"""
import asyncio
import json
import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.common.errors import ApiError

from . import gemini
from .prompts import OPENING_NUDGE, build_system_prompt, live_seconds
from .transcript import CANDIDATE, INTERVIEWER, Transcript

logger = logging.getLogger(__name__)


@database_sync_to_async
def _open_session(raw_token):
    """Resolve the token and open the session, using the engine's own checks.

    Returns (session, system_prompt, seconds). Raises ApiError exactly as the REST path does.
    """
    from ..services import engine
    from ..services.kinds import rules_for
    from .session import begin_live

    session = engine.session_for_token(raw_token)
    rules = rules_for(session.kind)
    if not getattr(rules, "live", False):
        raise ApiError("This interview is not a live call.", "not_live", 409)
    engine.ensure_available(session)
    begin_live(session)
    return session, build_system_prompt(session, rules), live_seconds(rules)


@database_sync_to_async
def _finish_session(session, entries, reason):
    from .session import finish_live

    return finish_live(session, entries, reason)


class InterviewLiveConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session = None
        self.transcript = Transcript()
        self.inbox = asyncio.Queue()
        self.started = time.monotonic()
        self.finished = False
        await self.accept()

    async def disconnect(self, code):
        await self._finish("disconnected", notify=False)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data:
            await self.inbox.put(bytes_data)
            return
        if not text_data:
            return
        try:
            message = json.loads(text_data)
        except json.JSONDecodeError:
            return
        kind = message.get("type")
        if kind == "start" and self.session is None:
            await self._start(message.get("token") or "")
        elif kind == "stop":
            await self.inbox.put(None)

    async def _send(self, payload):
        try:
            await self.send(text_data=json.dumps(payload))
        except Exception:  # the browser went away mid-write
            pass

    async def _start(self, raw_token):
        try:
            self.session, prompt, seconds = await _open_session(raw_token)
        except ApiError as problem:
            await self._send({"type": "error", "code": problem.code, "message": str(problem.detail)})
            await self.close(code=4403)
            return
        except Exception:
            logger.exception("Could not open the live interview")
            await self._send({"type": "error", "code": "server_error", "message": "The interview could not be opened."})
            await self.close(code=1011)
            return
        self.relay = asyncio.create_task(self._run(prompt, seconds))

    async def _run(self, prompt, seconds):
        reason = "stopped"
        try:
            async with gemini.connect(prompt) as live:
                await self._send({"type": "ready", "seconds": seconds})
                # Kick off the call so the interviewer speaks first.
                await live.send_realtime_input(text=OPENING_NUDGE)

                async def browser_to_gemini():
                    while True:
                        chunk = await self.inbox.get()
                        if chunk is None:
                            return "stopped"
                        await live.send_realtime_input(audio=gemini.audio_blob(chunk))

                async def gemini_to_browser():
                    while True:  # receive() yields one turn at a time; loop for the next turn
                        async for response in live.receive():
                            content = response.server_content
                            if not content:
                                continue
                            if content.model_turn:
                                for part in content.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        await self.send(bytes_data=part.inline_data.data)
                            for source, role in ((content.input_transcription, CANDIDATE), (content.output_transcription, INTERVIEWER)):
                                if source and source.text:
                                    self.transcript.add(role, source.text)
                                    await self._send({"type": "transcript", "role": role, "text": source.text})
                            if content.interrupted:
                                await self._send({"type": "interrupted"})

                async def timer():
                    await asyncio.sleep(seconds)
                    return "time_up"

                tasks = {asyncio.create_task(c()) for c in (browser_to_gemini, gemini_to_browser, timer)}
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in pending:
                    task.cancel()
                for task in done:
                    if task.exception():
                        raise task.exception()
                    reason = task.result() or reason
        except asyncio.CancelledError:
            raise
        except Exception as problem:
            logger.exception("Live interview failed")
            reason = f"error: {type(problem).__name__}"

        await self._finish(reason)
        await self.close()

    async def _finish(self, reason, notify=True):
        """Persist once, however the call ended."""
        if self.finished or self.session is None:
            self.finished = True
            return
        self.finished = True
        entries = self.transcript.cleaned()
        elapsed = time.monotonic() - self.started
        try:
            await _finish_session(self.session, entries, reason)
        except Exception:
            logger.exception("Could not save the live interview transcript")
        await database_sync_to_async(gemini.log_call)(
            self.session,
            status="failed" if reason.startswith("error") else "ok",
            seconds=elapsed,
            error=reason if reason.startswith("error") else "",
        )
        if notify:
            await self._send({"type": "ended", "reason": reason, "answers": len(entries)})
