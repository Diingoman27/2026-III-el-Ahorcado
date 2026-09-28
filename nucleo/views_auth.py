import re

import bcrypt
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse

from .api import body, endpoint, error, player_data, token_for
from .models import Player


def check_password(raw, stored):
    if stored.startswith('$2'):
        return bcrypt.checkpw(raw.encode(), stored.encode())
    return raw == stored


@endpoint(['POST'])
def register(request):
    data = body(request)
    name = str(data.get('name') or '').strip()[:30]
    first_name = str(data.get('first_name') or '').strip()[:50]
    last_name = str(data.get('last_name') or '').strip()[:50]
    email = str(data.get('email') or '').strip().lower()[:100]
    role = str(data.get('role') or '').strip().lower()
    password = str(data.get('password') or '')
    if not all((name, first_name, last_name, email, password)):
        return error('Todos los campos del formulario son obligatorios.')
    if role not in ('student', 'teacher'):
        return error('Selecciona explícitamente si la cuenta será Alumno o Profesor.')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        return error('El formato del correo electrónico no es válido.')
    if len(password) < 6:
        return error('La contraseña debe tener al menos 6 caracteres.')
    try:
        player = Player.objects.create(name=name, first_name=first_name, last_name=last_name,
                                       email=email, role=role,
                                       password=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode())
    except IntegrityError:
        return error('El nombre de usuario o el correo electrónico ya están en uso.')
    return JsonResponse({'token': token_for(player), 'user': player_data(player)})


@endpoint(['POST'])
def login(request):
    data = body(request)
    credential = str(data.get('credential') or data.get('name') or data.get('username') or data.get('email') or '').strip()[:100]
    password = str(data.get('password') or '')
    if not credential or not password:
        return error('El usuario/correo y la contraseña son obligatorios.')
    player = Player.objects.filter(Q(name=credential) | Q(email=credential.lower())).first()
    if not player or not check_password(password, player.password):
        return error('Credenciales incorrectas. Por favor, verifica tu usuario y contraseña.', 401)
    if not player.password.startswith('$2'):
        player.password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        player.save(update_fields=['password'])
    return JsonResponse({'token': token_for(player), 'user': player_data(player)})


@endpoint(['DELETE'], auth=True)
def account(request):
    password = str(body(request).get('password') or '')
    if not password:
        return error('Ingresa tu contraseña para eliminar la cuenta.')
    if not check_password(password, request.player.password):
        return error('Contraseña incorrecta.', 401)
    with transaction.atomic():
        request.player.delete()
    return JsonResponse({'message': 'Cuenta eliminada permanentemente.'})
