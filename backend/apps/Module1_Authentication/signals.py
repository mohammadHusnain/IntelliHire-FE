from django.dispatch import Signal

# Sent when an account verifies its email for the first time. Receivers get `user` and must never raise.
email_verified = Signal()
