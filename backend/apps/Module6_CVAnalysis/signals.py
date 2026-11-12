from django.dispatch import Signal

# Sent once per job when its screening run has nothing left to analyse. Receivers get `job` and `summary`.
screening_completed = Signal()

# Sent after an application's CV match is saved or recomputed. Receivers get `application`.
cv_scored = Signal()
