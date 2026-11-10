from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase
from django.urls import reverse

from nucleo.auth_integration import ensure_role_groups, sync_player_to_django_user
from nucleo.models import Player

User = get_user_model()


def make_player(name, role, **extra):
    player = Player.objects.create(
        name=name, first_name=name.title(), last_name='Prueba', email=f'{name}@example.com',
        role=role, grade='1' if role == 'student' else '', group_name='A' if role == 'student' else '', **extra,
    )
    return player, sync_player_to_django_user(player)


class UserPermissionsPanelTests(TestCase):
    def setUp(self):
        ensure_role_groups()
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'Admin-Pass-12345')
        self.teacher_player, self.teacher = make_player('docente', 'teacher')
        self.student_player, self.student = make_player('alumno', 'student')
        self.supervisor_player, self.supervisor = make_player('supervisor', 'supervisor')
        self.view_word = Permission.objects.get(codename='view_word')
        self.delete_word = Permission.objects.get(codename='delete_word')

    def test_supervisor_group_is_read_only(self):
        group = Group.objects.get(name='Supervisor')
        codenames = set(group.permissions.values_list('codename', flat=True))
        self.assertIn('view_word', codenames)
        self.assertTrue(all(code.startswith('view_') for code in codenames))
        self.assertTrue(self.supervisor.groups.filter(name='Supervisor').exists())
        self.assertTrue(self.supervisor.has_perm('core.view_word'))
        self.assertFalse(self.supervisor.has_perm('core.delete_word'))

    def test_list_filters_by_role(self):
        self.client.force_login(self.admin)
        url = reverse('user_permissions_list')
        response = self.client.get(url, {'rol': 'supervisor'})
        self.assertContains(response, '@supervisor')
        self.assertNotContains(response, '@docente')
        response = self.client.get(url, {'rol': 'teacher'})
        self.assertContains(response, '@docente')
        self.assertNotContains(response, '@alumno')
        response = self.client.get(url, {'q': 'alum'})
        self.assertContains(response, '@alumno')
        self.assertNotContains(response, '@docente')

    def test_superuser_assigns_permissions(self):
        self.client.force_login(self.admin)
        url = reverse('user_permissions_edit', args=[self.teacher.pk])
        self.assertContains(self.client.get(url), 'perm-search')
        response = self.client.post(url, {'permissions': [self.view_word.pk, self.delete_word.pk]})
        self.assertRedirects(response, url)
        self.assertEqual(
            set(self.teacher.user_permissions.values_list('codename', flat=True)), {'view_word', 'delete_word'}
        )
        self.client.post(url, {'permissions': [self.view_word.pk]})
        self.assertEqual(list(self.teacher.user_permissions.values_list('codename', flat=True)), ['view_word'])

    def test_supervisor_cannot_receive_write_permissions(self):
        self.client.force_login(self.admin)
        url = reverse('user_permissions_edit', args=[self.supervisor.pk])
        self.client.post(url, {'permissions': [self.view_word.pk, self.delete_word.pk]})
        self.assertFalse(self.supervisor.user_permissions.exists())
        self.client.post(url, {'permissions': [self.view_word.pk]})
        self.assertEqual(list(self.supervisor.user_permissions.values_list('codename', flat=True)), ['view_word'])

    def test_supervisor_can_view_but_not_assign(self):
        self.client.force_login(self.supervisor)
        self.assertEqual(self.client.get(reverse('user_permissions_list')).status_code, 200)
        url = reverse('user_permissions_edit', args=[self.teacher.pk])
        self.assertContains(self.client.get(url), 'Vista de solo lectura')
        self.client.post(url, {'permissions': [self.delete_word.pk]})
        self.assertFalse(self.teacher.user_permissions.exists())
        # Read-only role cannot use the write views of the CRUD.
        self.assertNotEqual(self.client.get(reverse('manage_words_create')).status_code, 200)

    def test_student_without_permissions_is_redirected(self):
        self.client.force_login(self.student)
        response = self.client.get(reverse('user_permissions_list'))
        self.assertNotEqual(response.status_code, 200)

    def test_changing_role_to_supervisor_drops_write_permissions(self):
        self.teacher.user_permissions.add(self.view_word, self.delete_word)
        self.teacher_player.role = 'supervisor'
        self.teacher_player.save()
        sync_player_to_django_user(self.teacher_player)
        self.assertEqual(list(self.teacher.user_permissions.values_list('codename', flat=True)), ['view_word'])
        self.assertEqual(list(self.teacher.groups.values_list('name', flat=True)), ['Supervisor'])

    def test_public_registration_rejects_supervisor_role(self):
        response = self.client.post('/api/auth/register', {
            'name': 'nuevo_sup', 'first_name': 'Nuevo', 'last_name': 'Sup', 'email': 'nuevo@example.com',
            'password': 'Password-Segura-123', 'role': 'supervisor',
        }, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Player.objects.filter(name='nuevo_sup').exists())
