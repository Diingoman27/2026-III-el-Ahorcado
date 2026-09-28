"""Carga el vocabulario inicial sin crear cuentas con contraseñas predeterminadas."""
from django.core.management.base import BaseCommand
from nucleo.models import Word

WORDS = {
    'easy': ['gato', 'casa', 'sol', 'papel', 'raton'],
    'medium': ['muerte', 'traicion', 'fantasma', 'laberinto', 'vampiro'],
    'hard': ['espionaje', 'conspiracion', 'enigmatico', 'venganza', 'masacre'],
}

class Command(BaseCommand):
    help = 'Carga las palabras iniciales.'

    def handle(self, *args, **options):
        for difficulty, words in WORDS.items():
            for word in words:
                Word.objects.get_or_create(word=word, defaults={'difficulty': difficulty})
        self.stdout.write(self.style.SUCCESS('Palabras iniciales listas.'))
