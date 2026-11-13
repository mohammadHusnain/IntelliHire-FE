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
    path("api/platform-admin/", include("apps.Module13_PlatformAdmin.urls")),
    path("api/platform-admin/users/", include("apps.Module1_Authentication.platform_urls")),
    path("api/reports/", include("apps.Module13_PlatformAdmin.report_urls")),
    path("api/platform-admin/companies/", include("apps.Module2_CompanyManagement.platform_urls")),
    path("api/company/", include("apps.Module2_CompanyManagement.urls")),
    path("api/jobs/", include("apps.Module3_JobPosting.urls")),
    path("api/jobs/", include("apps.Module4_ApplicationManagement.jobs_urls")),
    path("api/applications/", include("apps.Module4_ApplicationManagement.urls")),
    path("api/jobs/", include("apps.Module6_CVAnalysis.jobs_urls")),
    path("api/applications/", include("apps.Module6_CVAnalysis.urls")),
    path("api/jobs/", include("apps.Module7_Interviews.jobs_urls")),
    path("api/applications/", include("apps.Module7_Interviews.urls")),
    path("api/interviews/", include("apps.Module7_Interviews.interviews_urls")),
    path("api/jobs/", include("apps.Module9_Evaluation.jobs_urls")),
    path("api/applications/", include("apps.Module9_Evaluation.urls")),
    path("api/notifications/", include("apps.Module5_Foundation.urls")),
    path("api/candidate/", include("apps.Module10_Tracking.candidate_urls")),
    path("api/candidate/", include("apps.Module12_Communities.candidate_urls")),
    path("api/company/communities/", include("apps.Module12_Communities.company_urls")),
    path("api/mock-interviews/", include("apps.Module11_MockInterview.urls")),
    path("api/public/", include("apps.Module2_CompanyManagement.public_urls")),
    path("api/public/", include("apps.Module3_JobPosting.public_urls")),
    path("api/public/", include("apps.Module4_ApplicationManagement.public_urls")),
    path("api/public/", include("apps.Module7_Interviews.public_urls")),
    path("api/public/", include("apps.Module10_Tracking.public_urls")),
    path("api/public/", include("apps.Module13_PlatformAdmin.public_urls")),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
