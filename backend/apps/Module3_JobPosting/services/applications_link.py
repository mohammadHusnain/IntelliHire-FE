"""The only place Module 3 looks at applications.

Applications are created by Module 4, which depends on this module, so jobs must not import
that app at module level. Until Module 4 is installed every job has zero applications; once it
is, these three helpers read the real table through the `applications` related name.
"""

from django.apps import apps as django_apps
from django.db.models import Count, IntegerField, Value


def _application_model():
    try:
        return django_apps.get_model("applications", "Application")
    except LookupError:
        return None


def applications_count_expression():
    """Annotation used by job lists and details (`applications_count`)."""
    if _application_model() is None:
        return Value(0, output_field=IntegerField())
    return Count("applications", distinct=True)


def has_applications(job):
    """True once at least one application exists; this is what partly locks custom fields."""
    model = _application_model()
    return bool(model and model.objects.filter(job=job).exists())
