from django.db import migrations


def link(apps, schema_editor):
    """One time: applications made with the verified email of an existing candidate account now belong to that account."""
    User = apps.get_model("accounts", "User")
    Application = apps.get_model("applications", "Application")
    for user in User.objects.filter(role="candidate", email_verified=True).iterator():
        Application.objects.filter(email=user.email, candidate_user__isnull=True).update(candidate_user=user)


class Migration(migrations.Migration):
    dependencies = [("applications", "0005_tracking_token_required"), ("accounts", "0002_candidate_profile_extensions")]
    operations = [migrations.RunPython(link, migrations.RunPython.noop)]
