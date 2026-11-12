from django.db import migrations


def seed(apps, schema_editor):
    from apps.Module7_Interviews import seed_data

    Bank = apps.get_model("interviews", "InterviewQuestionBank")
    # Idempotent: the (kind, text) unique rule makes a second run, or an edited bank, harmless.
    Bank.objects.bulk_create([Bank(**row) for row in seed_data.rows()], ignore_conflicts=True)


def unseed(apps, schema_editor):
    from apps.Module7_Interviews import seed_data

    Bank = apps.get_model("interviews", "InterviewQuestionBank")
    Bank.objects.filter(text__in=[row["text"] for row in seed_data.rows()]).delete()


class Migration(migrations.Migration):
    dependencies = [("interviews", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
