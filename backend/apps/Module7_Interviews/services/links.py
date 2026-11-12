"""The candidate's private link. Only the SHA-256 hash is stored; the raw token lives in the invitation email alone."""
import hashlib
import secrets

from django.conf import settings


def new_token():
    return secrets.token_urlsafe(32)


def hash_token(raw_token):
    return hashlib.sha256(str(raw_token).encode()).hexdigest()


def interview_url(raw_token):
    return f"{settings.FRONTEND_URL.rstrip('/')}/interview/{raw_token}"
