import django_filters

from apps.Module3_JobPosting.models import EducationLevel

from .models import Application, ApplicationStatus


class JobApplicationFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=ApplicationStatus.choices)
    education_level = django_filters.ChoiceFilter(choices=EducationLevel.choices)
    submitted_after = django_filters.DateFilter(field_name="submitted_at", lookup_expr="date__gte")
    submitted_before = django_filters.DateFilter(field_name="submitted_at", lookup_expr="date__lte")

    class Meta:
        model = Application
        fields = ["status", "education_level", "submitted_after", "submitted_before"]


class CompanyApplicationFilter(JobApplicationFilter):
    job = django_filters.UUIDFilter(field_name="job_id")

    class Meta(JobApplicationFilter.Meta):
        fields = JobApplicationFilter.Meta.fields + ["job"]
