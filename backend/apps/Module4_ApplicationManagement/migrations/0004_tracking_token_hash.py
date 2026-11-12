import hashlib
import secrets

from django.db import migrations, models


def fill(apps, schema_editor):
    """Existing applications get a random hash nobody knows; their owners get a working link through "lost link"."""
    Application = apps.get_model("applications", "Application")
    for pk in Application.objects.filter(tracking_token_hash__isnull=True).values_list("pk", flat=True).iterator():
        Application.objects.filter(pk=pk).update(tracking_token_hash=hashlib.sha256(secrets.token_urlsafe(24).encode()).hexdigest())


class Migration(migrations.Migration):
    dependencies = [("applications", "0003_status_change_source")]
    operations = [
        migrations.AddField("application", "tracking_token_hash", models.CharField(max_length=64, null=True, editable=False)),
        migrations.RunPython(fill, migrations.RunPython.noop),
    ]
