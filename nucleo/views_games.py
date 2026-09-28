import random
import re
import unicodedata

from django.db import transaction
from django.db.models import F
from django.http import JsonResponse
from django.utils import timezone

from .ai import generate as generate_content
from .api import body, endpoint, error, integer
from .models import AssignedGame, Game, Player, Word

MAX_WRONG = 6


def normalize(letter):
    value = letter.lower().replace('ñ', '__enie__')
    value = ''.join(ch for ch in unicodedata.normalize('NFD', value) if not unicodedata.combining(ch))
    return value.replace('__enie__', 'ñ')


def masked(word, guessed):
    return ' '.join(ch if normalize(ch) in guessed else '_' for ch in word)


def state(game):
    word = game.word
    result = {'id': game.id, 'status': game.status, 'difficulty': game.difficulty,
              'player_id': game.player_id, 'masked': masked(word.word, game.guessed),
              'wrongLetters': game.wrong, 'guessedLetters': game.guessed,
              'wrongAttempts': game.wrong_attempts, 'attempts': game.attempts,
              'hint': game.revealed_hint, 'theme': word.theme,
              'learningHint': (f'Tema: {word.theme}. Usa las letras reveladas para conectar la palabra con este concepto.'
                               if game.wrong_attempts >= 2 else None), 'maxWrong': MAX_WRONG}
    if game.status != 'playing':
        result['word'] = word.word
    return result


@endpoint(['POST'], auth=True)
def create_game(request):
    data = body(request)
    difficulty = data.get('difficulty') if data.get('difficulty') in ('easy', 'medium', 'hard') else 'easy'
    assignment_id = integer(data.get('assignmentId'))
    with transaction.atomic():
        assignment = None
        if assignment_id:
            assignment = AssignedGame.objects.select_for_update().filter(pk=assignment_id, student=request.player).exclude(status='completed').first()
            if not assignment:
                return error('La partida asignada no está disponible.', 403)
            if assignment.current_index >= len(assignment.word_ids):
                return error('La partida asignada ya fue completada.')
            word_id = assignment.word_ids[assignment.current_index]
        else:
            word_id = integer(data.get('wordId'))
        if word_id:
            word = Word.objects.filter(pk=word_id).first()
        else:
            word = Word.objects.filter(difficulty=difficulty).order_by('?').first()
        if not word:
            return error('No hay palabras disponibles', 404)
        game = Game.objects.create(player=request.player, word=word, difficulty=word.difficulty,
                                   assigned_game=assignment)
        if assignment:
            assignment.status = 'playing'
            assignment.save(update_fields=['status'])
    return JsonResponse(state(game))


@endpoint(['POST'], auth=True)
def guess(request):
    data = body(request)
    game_id = integer(data.get('gameId'))
    letter = data.get('letter')
    if not game_id or not isinstance(letter, str) or not re.fullmatch('[a-zñ]', letter.strip().lower()):
        return error('gameId y una letra válida son obligatorios')
    letter = letter.strip().lower()
    with transaction.atomic():
        game = Game.objects.select_for_update().select_related('word').filter(pk=game_id).first()
        if not game:
            return error('Partida no encontrada', 404)
        if game.player_id != request.player.id:
            return error('No tienes permiso para interactuar con esta partida', 403)
        if game.status != 'playing':
            return error('La partida ya terminó')
        if letter in game.guessed or letter in game.wrong:
            return error('Ya intentaste esa letra')
        guessed = list(game.guessed)
        wrong = list(game.wrong)
        if letter in [normalize(ch) for ch in game.word.word]:
            guessed.append(letter)
        else:
            wrong.append(letter)
            game.wrong_attempts += 1
            if game.wrong_attempts % 2 == 0:
                missing = list({normalize(ch) for ch in game.word.word if re.fullmatch('[a-zñ]', normalize(ch))} - set(guessed))
                if missing:
                    game.revealed_hint = random.choice(missing)
                    guessed.append(game.revealed_hint)
        game.guessed = guessed
        game.wrong = wrong
        game.attempts += 1
        if '_' not in masked(game.word.word, guessed):
            game.status = 'won'
        elif game.wrong_attempts >= MAX_WRONG:
            game.status = 'lost'
        if game.status != 'playing':
            game.finished_at = timezone.now()
            if game.status == 'won':
                bonus = {'easy': 10, 'medium': 25, 'hard': 40}[game.difficulty]
                Player.objects.filter(pk=game.player_id).update(score=F('score') + max(0, 100 + bonus - game.wrong_attempts * 10))
            if game.assigned_game_id:
                assignment = AssignedGame.objects.select_for_update().get(pk=game.assigned_game_id)
                assignment.current_index += 1
                assignment.status = 'completed' if assignment.current_index >= len(assignment.word_ids) else 'playing'
                assignment.save(update_fields=['current_index', 'status'])
        game.save()
    return JsonResponse(state(game))


@endpoint(['POST'], auth=True)
def solve(request):
    return error('Resolver por palabra completa está deshabilitado. Ingresa solo letras individuales.', 410)


@endpoint(['POST'], auth=True)
def explain(request):
    game_id = integer(body(request).get('gameId'))
    if not game_id:
        return error('gameId es obligatorio')
    game = Game.objects.select_related('word').filter(pk=game_id, player=request.player).first()
    if not game:
        return error('Partida no encontrada', 404)
    if game.status == 'playing':
        return error('Termina la partida para ver la explicación.')
    word = game.word
    fallback = (f'“{word.word}” pertenece al tema {word.theme}. Repásala escribiendo una definición '
                'con tus propias palabras y crea una oración donde la uses correctamente. '
                'Pregunta de repaso: ¿qué pista del tema te ayudó a reconocerla?')
    prompt = (f'Explica en español para estudiantes de forma clara y breve. Palabra: "{word.word}". '
              f'Tema: "{word.theme}". Dificultad: "{game.difficulty}". '
              'Responde con una explicación de máximo 2 frases y una mini pregunta de repaso. Sin markdown.')
    try:
        explanation, _ = generate_content(prompt)
    except Exception:
        explanation = None
    return JsonResponse({'word': word.word, 'theme': word.theme,
                         'explanation': explanation or fallback,
                         'source': 'gemini' if explanation else 'local'})
