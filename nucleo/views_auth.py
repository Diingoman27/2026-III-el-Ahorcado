import re
import time
from collections import defaultdict

import bcrypt
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse

from .api import body, endpoint, error, player_data, token_for
from .models import Player

LOGIN_ATTEMPTS = defaultdict(int)


def rate_limited(request):
    key = f'login:{request.META.get("REMOTE_ADDR", "unknown")}'
    attempts = cache.get(key, 0)
    if attempts >= 5:
        return True
    return False


def check_password(raw, stored):
    if not isinstance(raw, str):
        return False
    if stored.startswith('$2'):
        return bcrypt.checkpw(raw.encode(), stored.encode())
    return raw == stored


def strong_password(password):
    if len(password) < 12:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'\d', password):
        return False
    return True


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
    if not strong_password(password):
        return error('La contraseña debe tener al menos 12 caracteres, incluir mayúsculas, minúsculas y números.')
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
    ip_key = f'login:{request.META.get("REMOTE_ADDR", "unknown")}'
    if rate_limited(request):
        return error('Demasiados intentos. Intenta nuevamente en unos minutos.', 429)
    player = Player.objects.filter(Q(name=credential) | Q(email=credential.lower())).first()
    if not player or not check_password(password, player.password):
        attempts = cache.get(ip_key, 0) + 1
        cache.set(ip_key, attempts, 300)
        return error('Credenciales incorrectas. Por favor, verifica tu usuario y contraseña.', 401)
    cache.delete(ip_key)
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
