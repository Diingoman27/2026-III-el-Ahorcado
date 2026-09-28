from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.AutoField'
    name = 'nucleo'
    # Conserva la etiqueta de la app para mantener el historial de migraciones existente.
    label = 'core'
