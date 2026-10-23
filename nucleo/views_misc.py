from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.db import connection
from .api import endpoint
from .models import Player


def index(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/index.html').open('rb'), content_type='text/html')


def register_page(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/register.html').open('rb'), content_type='text/html')


def google_auth_callback_page(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/auth-callback.html').open('rb'), content_type='text/html')


def password_recovery_page(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/password-recovery.html').open('rb'), content_type='text/html')


@endpoint(['GET'])
def health(request):
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'ok', 'databaseConfigured': True})
    except Exception:
        return JsonResponse({'status': 'error', 'databaseConfigured': False}, status=503)


@endpoint(['GET'])
def leaderboard(request):
    search = request.GET.get('q', '').strip()
    limit = request.GET.get('limit', '10')

    players = Player.objects.order_by('-score', 'created_at')
    if search:
        players = players.filter(name__icontains=search)

    if limit != 'all':
        limits = {'10': 10, '50': 50, '100': 100}
        players = players[:limits.get(limit, 10)]

    rows = players.values('name', 'score')
    return JsonResponse(list(rows), safe=False)
