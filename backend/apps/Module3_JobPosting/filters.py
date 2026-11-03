import django_filters

from .models import EmploymentType, JobPosting, JobStatus


class JobFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=JobStatus.choices)
    department = django_filters.CharFilter(lookup_expr="iexact")
    employment_type = django_filters.ChoiceFilter(choices=EmploymentType.choices)

    class Meta:
        model = JobPosting
        fields = ["status", "department", "employment_type"]
