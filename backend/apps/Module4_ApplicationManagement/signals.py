from django.dispatch import Signal

# Sent inside the submission transaction, after the application and its files are saved.
# Receivers get `application` and must never raise: a failing listener may not block an application.
application_submitted = Signal()

# Sent after an application moved to "shortlisted" (by a person or automatically). Receivers get `application`.
application_shortlisted = Signal()
