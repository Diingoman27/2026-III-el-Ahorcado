from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.db import connection
from .api import endpoint
from .models import Player


def index(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/index.html').open('rb'), content_type='text/html')


def register_page(request):
    return FileResponse((settings.BASE_DIR / 'interfaz/register.html').open('rb'), content_type='text/html')


@endpoint(['GET'])
def health(request):
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'ok', 'databaseConfigured': True})
    except Exception:
        return JsonResponse({'status': 'error', 'databaseConfigured': False}, status=503)


@endpoint(['GET'])
def leaderboard(request):
    rows = Player.objects.order_by('-score', 'created_at').values('name', 'score')[:10]
    return JsonResponse(list(rows), safe=False)
