from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

handler404 = "apps.common.views.api_not_found"
handler500 = "apps.common.views.api_server_error"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.Module2_CompanyManagement.auth_urls")),
    path("api/auth/", include("apps.Module1_Authentication.urls")),
    path("api/platform-admin/users/", include("apps.Module1_Authentication.platform_urls")),
    path("api/platform-admin/companies/", include("apps.Module2_CompanyManagement.platform_urls")),
    path("api/company/", include("apps.Module2_CompanyManagement.urls")),
    path("api/public/", include("apps.Module2_CompanyManagement.public_urls")),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
