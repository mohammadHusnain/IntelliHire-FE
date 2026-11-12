import logging
import re

# Private links carry their credential in the path; it must never reach a log line.
_TOKEN_PATH = re.compile(r"(/api/public/(?:interviews|invitations)/)[^/\s?\"']+")


class RedactTokens(logging.Filter):
    def filter(self, record):
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 - a malformed record is not ours to fix
            return True
        redacted = _TOKEN_PATH.sub(r"\1<redacted>", message)
        if redacted != message:
            record.msg, record.args = redacted, ()
        return True
