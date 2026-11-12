import hashlib

from rest_framework.throttling import ScopedRateThrottle


class LinkRateThrottle(ScopedRateThrottle):
    """Limits per interview link instead of per address: the key is a hash of the token in the path."""

    def get_cache_key(self, request, view):
        ident = hashlib.sha256(str(view.kwargs.get("token", "")).encode()).hexdigest()[:32]
        return self.cache_format % {"scope": self.scope, "ident": ident}
