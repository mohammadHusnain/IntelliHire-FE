from rest_framework.exceptions import APIException


class ApiError(APIException):
    """A general error rendered as {"detail": message, "code": code}."""

    def __init__(self, detail, code, status_code=400):
        super().__init__(detail=detail, code=code)
        self.status_code = status_code


def violated_constraint(exc):
    """Name of the database constraint behind an IntegrityError, if known."""
    diag = getattr(exc.__cause__, "diag", None)
    return getattr(diag, "constraint_name", "") or ""
