from django.http import JsonResponse
from django.views import defaults


def api_not_found(request, exception):
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": "Not found.", "code": "not_found"}, status=404)
    return defaults.page_not_found(request, exception)


def api_server_error(request):
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": "A server error occurred.", "code": "server_error"}, status=500)
    return defaults.server_error(request)
