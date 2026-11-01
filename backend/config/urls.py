from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

handler404 = "apps.common.views.api_not_found"
handler500 = "apps.common.views.api_server_error"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.companies.auth_urls")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/platform-admin/users/", include("apps.accounts.platform_urls")),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
