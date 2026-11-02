from django.urls import path

from .views import review

urlpatterns = [
    path("", review.CompanyReviewListView.as_view(), name="company-review-list"),
    path("<uuid:company_id>/", review.CompanyReviewDetailView.as_view(), name="company-review-detail"),
    path("<uuid:company_id>/approve/", review.CompanyApproveView.as_view(), name="company-approve"),
    path("<uuid:company_id>/reject/", review.CompanyRejectView.as_view(), name="company-reject"),
    path("<uuid:company_id>/suspend/", review.CompanySuspendView.as_view(), name="company-suspend"),
    path("<uuid:company_id>/reactivate/", review.CompanyReactivateView.as_view(), name="company-reactivate"),
]
