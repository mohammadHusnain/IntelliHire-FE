from apps.common.errors import ApiError

JOB_CLOSED = "Closed jobs are read-only. Reopen the job to change it."
DEADLINE_PASSED = "The deadline has passed. Close the job and reopen it with a new deadline to change it."


def job_closed():
    return ApiError(JOB_CLOSED, "job_closed", 409)


def deadline_passed():
    return ApiError(DEADLINE_PASSED, "deadline_passed", 409)


def field_locked(message):
    return ApiError(message, "field_locked", 409)
