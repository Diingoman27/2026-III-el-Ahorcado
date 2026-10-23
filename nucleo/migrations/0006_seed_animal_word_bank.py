from django.db import migrations


ANIMAL_WORDS = {
    'easy': (
        'gato', 'perro', 'pato', 'lobo', 'rana', 'vaca', 'mono', 'tigre',
        'leon', 'oso',
    ),
    'medium': (
        'delfin', 'tortuga', 'jirafa', 'canguro', 'cocodrilo',
        'murcielago', 'elefante', 'pingüino',
    ),
    'hard': (
        'ornitorrinco', 'hipopotamo', 'rinoceronte', 'chimpance', 'avestruz',
    ),
}


def add_animal_words(apps, schema_editor):
    Word = apps.get_model('core', 'Word')
    database = schema_editor.connection.alias
    for difficulty, words in ANIMAL_WORDS.items():
        for word in words:
            Word.objects.using(database).get_or_create(
                word=word,
                defaults={'difficulty': difficulty, 'theme': 'Animales'},
            )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0005_player_is_active'),
    ]

    operations = [
        migrations.RunPython(add_animal_words, migrations.RunPython.noop),
    ]
