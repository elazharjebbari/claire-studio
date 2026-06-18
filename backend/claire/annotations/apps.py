from django.apps import AppConfig


class AnnotationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "claire.annotations"
    label = "annotations"

    def ready(self):
        from . import signals  # noqa: F401
