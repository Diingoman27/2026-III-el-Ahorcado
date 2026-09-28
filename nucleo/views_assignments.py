import random

from django.db import transaction
from django.http import JsonResponse

from .api import body, endpoint, error, id_list
from .models import AssignedGame, Player, Word


@endpoint(['GET'], auth=True, teacher=True)
def students(request):
    rows = Player.objects.filter(role='student').order_by('first_name', 'last_name', 'name')
    return JsonResponse([{key: getattr(row, key) for key in ('id', 'name', 'first_name', 'last_name', 'email')} for row in rows], safe=False)


@endpoint(['GET'], auth=True)
def mine(request):
    if request.player.role != 'student':
        return JsonResponse([], safe=False)
    rows = AssignedGame.objects.filter(student=request.player).exclude(status='completed').select_related('teacher').order_by('-created_at')
    return JsonResponse([{'id': row.id, 'teacher_id': row.teacher_id, 'student_id': row.student_id,
                          'teacher_name': row.teacher.name, 'theme': row.theme, 'difficulty': row.difficulty,
                          'status': row.status, 'word_ids': row.word_ids, 'word_count': len(row.word_ids),
                          'current_index': row.current_index, 'created_at': row.created_at.isoformat()} for row in rows], safe=False)


@endpoint(['GET'], auth=True, teacher=True)
def teacher_assignments(request):
    rows = AssignedGame.objects.filter(teacher=request.player).select_related('student').order_by('-created_at', '-id')
    return JsonResponse([{'id': row.id, 'theme': row.theme, 'difficulty': row.difficulty,
                          'status': row.status, 'current_index': row.current_index,
                          'created_at': row.created_at.isoformat(), 'word_count': len(row.word_ids),
                          'student_username': row.student.name, 'student_first_name': row.student.first_name,
                          'student_last_name': row.student.last_name} for row in rows], safe=False)


@endpoint(['POST'], auth=True, teacher=True)
def create_assignment(request):
    data = body(request)
    student_ids = id_list(data.get('studentIds'))
    word_ids = id_list(data.get('wordIds'))
    if not student_ids or not word_ids:
        return error('Se requieren IDs de alumnos y de palabras.')
    difficulty = data.get('difficulty')
    if difficulty not in ('easy', 'medium', 'hard'):
        return error('La dificultad no es válida.')
    valid_students = list(Player.objects.filter(pk__in=student_ids, role='student').values_list('id', flat=True))
    valid_words = list(Word.objects.filter(pk__in=word_ids).values_list('id', flat=True))
    if not valid_students:
        return error('No se encontraron alumnos válidos para asignar.')
    if not valid_words:
        return error('No se encontraron palabras válidas para asignar.')
    random.shuffle(valid_words)
    theme = str(data.get('theme') or '').strip()[:50] or 'General'
    assignments = [AssignedGame(teacher=request.player, student_id=student_id,
                                theme=theme, difficulty=difficulty,
                                word_ids=valid_words[index::len(valid_students)])
                   for index, student_id in enumerate(valid_students) if valid_words[index::len(valid_students)]]
    with transaction.atomic():
        AssignedGame.objects.bulk_create(assignments)
    return JsonResponse({'message': f'Partida repartida aleatoriamente entre {len(assignments)} alumno(s).',
                         'assignedStudents': len(assignments), 'totalWords': len(valid_words)}, status=201)


@endpoint(['DELETE'], auth=True, teacher=True)
def delete_assignment(request, assignment_id):
    deleted, _ = AssignedGame.objects.filter(pk=assignment_id, teacher=request.player).delete()
    if not deleted:
        return error('No se encontró esa partida temática para tu profesor.', 404)
    return JsonResponse({'message': 'Partida temática eliminada.'})
