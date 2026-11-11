from django.apps import AppConfig
from django.db.models.signals import post_delete, post_save


class FoundationConfig(AppConfig):
    name = "apps.Module5_Foundation"
    label = "foundation"

    def ready(self):
        from .ai.config import clear_config_cache
        from .models import AISettings

        post_save.connect(clear_config_cache, sender=AISettings, dispatch_uid="foundation.ai-config-save")
        post_delete.connect(clear_config_cache, sender=AISettings, dispatch_uid="foundation.ai-config-delete")
