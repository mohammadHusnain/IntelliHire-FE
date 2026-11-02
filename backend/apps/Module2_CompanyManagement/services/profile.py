from django.db import transaction

PROFILE_COMPLETION_FIELDS = ("website", "description", "headquarters", "logo", "company_size")


def profile_completion(company):
    """Percentage of the optional profile fields that are filled."""
    filled = sum(bool(getattr(company, field)) for field in PROFILE_COMPLETION_FIELDS)
    return round(filled * 100 / len(PROFILE_COMPLETION_FIELDS))


def update_company_profile(company, validated_data):
    """Apply a profile edit. A new name regenerates the slug; a replaced logo is deleted after commit."""
    old_logo = company.logo.name if "logo" in validated_data else ""
    name_changed = "name" in validated_data and validated_data["name"] != company.name
    with transaction.atomic():
        for field, value in validated_data.items():
            setattr(company, field, value)
        if name_changed:
            company.slug = ""
        company.save()
        if old_logo and old_logo != company.logo.name:
            storage = company.logo.storage
            transaction.on_commit(lambda: storage.delete(old_logo))
    return company
