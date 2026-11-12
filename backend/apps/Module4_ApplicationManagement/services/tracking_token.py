"""The private link every applicant gets to follow their own application, with or without an account (P2-7).

Only the SHA-256 hash is stored (`Application.tracking_token_hash`); the raw token appears in emails only and is
replaced whenever a new link is issued. Company users never see either.
"""
import hashlib
import secrets


def new_token():
    return secrets.token_urlsafe(24)  # 32 characters


def hash_token(raw_token):
    return hashlib.sha256(str(raw_token).encode()).hexdigest()
