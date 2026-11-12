"""What a candidate is allowed to read about an application. Labels and stage names only: never a score, a note or a name."""

STATUS_LABELS = {
    "submitted": "Submitted",
    "under_review": "Reviewing",
    "shortlisted": "Shortlisted",
    "interview": "Interview scheduled",
    "selected": "Decision: Selected",
    "rejected": "Decision: Not selected",
    "on_hold": "Decision: On hold",
}
DECISION_STATUSES = ("selected", "rejected", "on_hold")
STAGES = ("cv", "screening", "technical", "decision")
STAGE_LABELS = {"cv": "CV review", "screening": "Screening interview", "technical": "Technical interview", "decision": "Decision"}
