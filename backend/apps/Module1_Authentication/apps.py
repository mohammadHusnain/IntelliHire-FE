from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "apps.Module1_Authentication"
    label = "accounts"

    def ready(self):
        from . import schema  # noqa: F401  (registers the OpenAPI auth scheme)
