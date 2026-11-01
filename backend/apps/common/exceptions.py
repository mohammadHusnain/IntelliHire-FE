from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """DRF's default shapes, with a machine-readable `code` on general errors.

    Field errors:   {"field_name": ["message"]}
    General errors: {"detail": "message", "code": "..."}
    """
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError):
        if isinstance(response.data, list):
            response.data = {"non_field_errors": response.data}
        return response
    detail = response.data.get("detail") if isinstance(response.data, dict) else None
    if detail is not None:
        response.data = {"detail": str(detail), "code": getattr(detail, "code", "error")}
    return response
