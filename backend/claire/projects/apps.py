from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "claire.projects"
    label = "projects"

    def ready(self):
        # Branche les signaux de synchro Assignment.status ↔ Annotation (R2).
        from . import signals  # noqa: F401
