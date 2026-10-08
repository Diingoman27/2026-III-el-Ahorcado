from django.urls import path
from ahorcado import views_permissions
from nucleo import views_auth, views_words, views_games, views_daily, views_assignments, views_misc

urlpatterns = [
    # Módulo de Gestión de Permisos (CRUD: ModelForm + CBV)
    path('permisos/', views_permissions.PermissionListView.as_view(), name='permission_list'),
    path('permisos/nuevo/', views_permissions.PermissionCreateView.as_view(), name='permission_create'),
    path('permisos/<int:pk>/', views_permissions.PermissionDetailView.as_view(), name='permission_detail'),
    path('permisos/<int:pk>/editar/', views_permissions.PermissionUpdateView.as_view(), name='permission_update'),
    path('permisos/<int:pk>/eliminar/', views_permissions.PermissionDeleteView.as_view(), name='permission_delete'),

    path('api/health', views_misc.health),
    path('api/auth/register', views_auth.register),
    path('api/auth/login', views_auth.login),
    path('api/auth/me', views_auth.account),
    path('api/leaderboard', views_misc.leaderboard),
    path('api/game', views_games.create_game),
    path('api/game/guess', views_games.guess),
    path('api/game/solve', views_games.solve),
    path('api/game/explain', views_games.explain),
    path('api/words', views_words.words),
    path('api/words/generate', views_words.generate),
    path('api/words/prepare-game', views_words.prepare_game),
    path('api/daily-words', views_daily.daily_word),
    path('api/daily-words/answer', views_daily.answer),
    path('api/daily-words/leaderboard/<int:daily_word_id>', views_daily.daily_leaderboard),
    path('api/assignments', views_assignments.create_assignment),
    path('api/assignments/students', views_assignments.students),
    path('api/assignments/mine', views_assignments.mine),
    path('api/assignments/teacher', views_assignments.teacher_assignments),
    path('api/assignments/<int:assignment_id>', views_assignments.delete_assignment),
    path('register.html', views_misc.register_page),
    path('', views_misc.index),
]
