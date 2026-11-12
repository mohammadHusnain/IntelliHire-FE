from django.dispatch import Signal

# Sent when a screening interview has been evaluated. Receivers get `session` and `recommendation`.
# Module 8 listens to invite the candidate to the technical interview after an `advance`.
interview_evaluated = Signal()
