from django.conf import settings
from rest_framework.parsers import MultiPartParser

from .errors import ApiError


class LimitedMultiPartParser(MultiPartParser):
    """Rejects an oversized upload from its Content-Length, before any file is written."""

    def parse(self, stream, media_type=None, parser_context=None):
        request = (parser_context or {}).get("request")
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0) if request is not None else 0
        except ValueError:
            length = 0
        if length > settings.MAX_REQUEST_BYTES:
            raise ApiError("The request is too large.", "request_too_large", 413)
        return super().parse(stream, media_type, parser_context)
