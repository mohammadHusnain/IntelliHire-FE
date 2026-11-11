"""Small helpers that keep untrusted or oversized values out of stored records."""
import datetime
import decimal
import json
import re
import uuid

from django.utils.html import strip_tags

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
SECRET_KEY_PARTS = ("password", "token", "secret", "authorization", "resume", "cv_text", "otp", "api_key", "apikey", "credential")
MAX_DEPTH = 4


def clean_text(value, limit, *, multiline=False):
    """Plain text: no tags, no control characters, no line breaks unless asked, cut to `limit` characters."""
    text = strip_tags(str(value if value is not None else ""))
    text = _CONTROL.sub("", text)
    if not multiline:
        text = " ".join(text.split())
    text = text.strip()
    if len(text) > limit:
        text = text[: max(limit - 1, 0)].rstrip() + "…"
    return text


def _plain(value, depth):
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return clean_text(value, 500, multiline=True)
    if isinstance(value, (uuid.UUID, decimal.Decimal)):
        return str(value)
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if depth >= MAX_DEPTH:
        return "[too deep]"
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            key = clean_text(key, 60)
            lowered = key.lower()
            out[key] = "[redacted]" if any(part in lowered for part in SECRET_KEY_PARTS) else _plain(item, depth + 1)
        return out
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_plain(item, depth + 1) for item in list(value)[:50]]
    return clean_text(value, 200)


def sanitize_json(value, *, max_bytes):
    """A JSON-safe copy of `value` with secret-looking keys hidden; replaced by {"truncated": true} when too large."""
    result = _plain(value if value is not None else {}, 0)
    if not isinstance(result, dict):
        result = {"value": result}
    if len(json.dumps(result, default=str).encode()) > max_bytes:
        return {"truncated": True}
    return result
