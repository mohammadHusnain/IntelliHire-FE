from django.db import migrations, models

import apps.Module4_ApplicationManagement.models


class Migration(migrations.Migration):
    dependencies = [("applications", "0004_tracking_token_hash")]
    operations = [
        migrations.AlterField("application", "tracking_token_hash", models.CharField(max_length=64, unique=True, editable=False, default=apps.Module4_ApplicationManagement.models.random_tracking_hash)),
    ]
