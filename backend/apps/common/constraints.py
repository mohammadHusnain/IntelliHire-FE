from django.db import models


def enum_check(field, choices, name, allow_blank=False):
    """DB-level guarantee that a choice field only ever holds a declared value."""
    values = [*choices.values, ""] if allow_blank else list(choices.values)
    return models.CheckConstraint(condition=models.Q(**{f"{field}__in": values}), name=name)
