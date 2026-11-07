import django_filters
from django.db.models import Q

from apps.common.choices import UserRole, UserStatus

from .models import User


class AdminUserFilter(django_filters.FilterSet):
    """Repeat a parameter to match several values: `?role=candidate&role=hr`."""

    role = django_filters.MultipleChoiceFilter(choices=UserRole.choices)
    status = django_filters.MultipleChoiceFilter(choices=UserStatus.choices)
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = User
        fields = ["role", "status", "search"]

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(email__icontains=value) | Q(full_name__icontains=value) | Q(company_membership__company__name__icontains=value)
        )
