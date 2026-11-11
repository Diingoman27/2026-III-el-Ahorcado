from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _ensure_role_groups(sender, **kwargs):
    from .auth_integration import ensure_role_groups

    ensure_role_groups()


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'nucleo'
    # Conserva la etiqueta de la app para mantener el historial de migraciones existente.
    label = 'core'

    def ready(self):
        # Runs after every `migrate`, once all permissions exist.
        post_migrate.connect(_ensure_role_groups, sender=self, dispatch_uid='core_ensure_role_groups')
