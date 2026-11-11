from django.db import migrations


def seed(apps, schema_editor):
    from apps.Module6_CVAnalysis.prompts import TEMPLATES

    PromptTemplate = apps.get_model("foundation", "PromptTemplate")
    for template in TEMPLATES:
        if not PromptTemplate.objects.filter(key=template["key"]).exists():
            PromptTemplate.objects.create(version=1, is_active=True, **template)


class Migration(migrations.Migration):
    dependencies = [("cv_analysis", "0001_initial"), ("foundation", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
