import hashlib
import re
import secrets
import smtplib
from datetime import timedelta
from logging import getLogger
from urllib.parse import urlparse

import bcrypt
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone

from .api import body, endpoint, error, player_data, token_for
from .models import PasswordResetToken, Player

logger = getLogger(__name__)

PASSWORD_RESET_LIFETIME = timedelta(hours=1)
PASSWORD_RESET_REQUEST_LIMIT = 5
PASSWORD_RESET_CONFIRM_LIMIT = 10
PASSWORD_RESET_RATE_WINDOW = 900


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
    try:
        if len(password.encode()) > 72:
            return False
    except UnicodeEncodeError:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'\d', password):
        return False
    return True


def password_reset_rate_limited(request, action, limit):
    ip = request.META.get('REMOTE_ADDR', 'unknown')
    key = f'password-reset:{action}:{ip}'
    attempts = cache.get(key, 0)
    if attempts >= limit:
        return True
    if attempts:
        cache.incr(key)
    else:
        cache.add(key, 1, PASSWORD_RESET_RATE_WINDOW)
    return False


@endpoint(['POST'])
def register(request):
    data = body(request)
    name = str(data.get('name') or '').strip()[:30]
    first_name = str(data.get('first_name') or '').strip()[:50]
    last_name = str(data.get('last_name') or '').strip()[:50]
    email = str(data.get('email') or '').strip().lower()
    role = str(data.get('role') or '').strip().lower()
    password = str(data.get('password') or '')
    grade = str(data.get('grade') or '').strip()
    group_name = str(data.get('group_name') or '').strip()
    if not all((name, first_name, last_name, email, password)):
        return error('Todos los campos del formulario son obligatorios.')
    if role not in ('student', 'teacher'):
        return error('Selecciona explícitamente si la cuenta será Alumno o Profesor.')
    if role == 'student' and (not grade or not group_name):
        return error('Los alumnos deben indicar su grado y grupo.')
    if len(grade) > 30 or len(group_name) > 20:
        return error('El grado debe tener hasta 30 caracteres y el grupo hasta 20.')
    if len(email) > 100:
        return error('El correo electrónico no puede superar los 100 caracteres.')
    try:
        validate_email(email)
    except ValidationError:
        return error('El formato del correo electrónico no es válido.')
    if not strong_password(password):
        return error('La contraseña debe tener entre 12 y 72 bytes e incluir mayúsculas, minúsculas y números.')
    try:
        player = Player.objects.create(name=name, first_name=first_name, last_name=last_name,
                                       email=email, role=role,
                                       grade=grade.upper(), group_name=group_name.upper(),
                                       password=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode())
    except IntegrityError:
        return error('El nombre de usuario o el correo electrónico ya están en uso.')
    return JsonResponse({'token': token_for(player), 'user': player_data(player)})


@endpoint(['POST'])
def request_password_reset(request):
    if password_reset_rate_limited(request, 'request', PASSWORD_RESET_REQUEST_LIMIT):
        return error('Demasiadas solicitudes. Inténtalo de nuevo más tarde.', 429)

    public_url = settings.PUBLIC_APP_URL
    parsed_url = urlparse(public_url)
    if (not settings.EMAIL_HOST or not settings.DEFAULT_FROM_EMAIL
            or parsed_url.scheme not in ('http', 'https') or not parsed_url.netloc):
        return error('La recuperación no está disponible porque el servicio de correo no está configurado.', 503)

    data = body(request)
    email = str(data.get('email') or '').strip().lower()
    if len(email) <= 100:
        try:
            validate_email(email)
        except ValidationError:
            pass
        else:
            player = Player.objects.filter(email=email).first()
            if player:
                token = secrets.token_urlsafe(32)
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                now = timezone.now()
                with transaction.atomic():
                    PasswordResetToken.objects.filter(player=player).delete()
                    reset_request = PasswordResetToken.objects.create(
                        player=player,
                        token_hash=token_hash,
                        expires_at=now + PASSWORD_RESET_LIFETIME,
                    )

                reset_url = f'{public_url.rstrip("/")}/password-recovery.html?token={token}'
                try:
                    send_mail(
                        subject='Recupera tu contraseña de Ahorcado UTVAM',
                        message=(
                            f'Hola {player.first_name},\n\n'
                            'Recibimos una solicitud para cambiar la contraseña de tu cuenta. '
                            'Abre este enlace para elegir una nueva:\n\n'
                            f'{reset_url}\n\n'
                            'El enlace vence en una hora y solo puede utilizarse una vez. '
                            'Si no solicitaste el cambio, puedes ignorar este mensaje.'
                        ),
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[email],
                        fail_silently=False,
                    )
                except (OSError, smtplib.SMTPException, ValueError):
                    logger.exception('No se pudo enviar el correo de recuperación de contraseña.')
                    PasswordResetToken.objects.filter(pk=reset_request.pk).delete()

    return JsonResponse({
        'message': 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar tu contraseña.'
    })


@endpoint(['POST'])
def reset_password(request):
    if password_reset_rate_limited(request, 'confirm', PASSWORD_RESET_CONFIRM_LIMIT):
        return error('Demasiados intentos. Inténtalo de nuevo más tarde.', 429)

    data = body(request)
    token = str(data.get('token') or '').strip()
    password = str(data.get('password') or '')
    if not token or len(token) > 200:
        return error('El enlace de recuperación no es válido o ya fue utilizado.')
    if not strong_password(password):
        return error('La contraseña debe tener entre 12 y 72 bytes e incluir mayúsculas, minúsculas y números.')

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        reset_request = (
            PasswordResetToken.objects.select_for_update()
            .select_related('player')
            .filter(token_hash=token_hash, expires_at__gt=timezone.now())
            .first()
        )
        if not reset_request:
            return error('El enlace de recuperación no es válido, venció o ya fue utilizado.')

        player = reset_request.player
        player.password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        player.save(update_fields=['password'])
        PasswordResetToken.objects.filter(player=player).delete()

    return JsonResponse({'message': 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.'})


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
