"""Removes personal details from text before it is scored or embedded (the main bias control, NFR-09)."""
import re

_EMAIL = re.compile(r"[\w.+'-]+@[\w-]+(?:\.[\w-]+)+")
_SOCIAL_HOSTS = (
    "linkedin.com", "github.com", "gitlab.com", "bitbucket.org", "twitter.com", "x.com", "facebook.com",
    "instagram.com", "behance.net", "dribbble.com", "medium.com", "stackoverflow.com", "kaggle.com", "t.me",
)  # fmt: skip
_LINK = re.compile(
    r"(?<![\w.-])(?:https?://|www\.)?(?:[\w-]+\.)*(?:%s)(?:/[^\s,;)]*)?" % "|".join(re.escape(h) for h in _SOCIAL_HOSTS), re.IGNORECASE
)
_PHONE = re.compile(r"(?<![\w.])[+(]?\d[\d\s().-]{6,}\d(?![\w])")
MIN_PHONE_DIGITS = 9
MAX_PHONE_DIGITS = 15


def _phone(match):
    digits = sum(ch.isdigit() for ch in match.group(0))
    return "[PHONE]" if MIN_PHONE_DIGITS <= digits <= MAX_PHONE_DIGITS else match.group(0)


def redact_pii(text, known_names=()):
    """Replace emails, phone numbers, social-profile links and the given names with placeholders.

    Names are matched case-insensitively as whole words; the full name goes first, then each part of at least three
    letters (shorter parts such as "Al" would damage ordinary words). Years and date ranges are left alone.
    """
    if not isinstance(text, str) or not text:
        return ""
    result = _EMAIL.sub("[EMAIL]", text)
    result = _LINK.sub("[LINK]", result)
    result = _PHONE.sub(_phone, result)
    names = []
    for full in known_names or ():
        full = " ".join(str(full or "").split())
        if len(full) >= 3:
            names.append(full)
            names.extend(part for part in full.split() if len(part) >= 3 and part not in names)
    for name in sorted(set(names), key=len, reverse=True):
        result = re.sub(r"(?<!\w)%s(?!\w)" % re.escape(name), "[NAME]", result, flags=re.IGNORECASE)
    return result
