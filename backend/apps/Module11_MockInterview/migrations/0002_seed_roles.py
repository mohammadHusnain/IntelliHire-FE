from django.db import migrations


def seed(apps, schema_editor):
    from apps.Module11_MockInterview import seed_data

    Role = apps.get_model("mock_interview", "InterviewRole")
    for row in seed_data.rows():
        Role.objects.get_or_create(slug=row["slug"], defaults=row)  # idempotent: a second run, or an edited catalog, is harmless


class Migration(migrations.Migration):
    dependencies = [("mock_interview", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
