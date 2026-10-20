import hashlib
import re
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import AssignedGame, PasswordResetToken, Player, Word


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    EMAIL_HOST='smtp.test',
    DEFAULT_FROM_EMAIL='no-reply@example.com',
    PUBLIC_APP_URL='https://ahorcado.test',
)
class SecurityHardeningTests(TestCase):
    def setUp(self):
        cache.clear()
        mail.outbox.clear()

    def register(self, name='testuser', email='test@example.com', password='SecurePass123',
                 role='student', grade='1° secundaria', group_name='A'):
        return self.client.post(
            '/api/auth/register',
            {
                'name': name,
                'first_name': 'Test',
                'last_name': 'User',
                'email': email,
                'role': role,
                'grade': grade,
                'group_name': group_name,
                'password': password,
            },
            content_type='application/json',
        )

    def test_registration_creates_account_directly(self):
        response = self.register()

        self.assertEqual(response.status_code, 200)
        self.assertIn('token', response.json())
        self.assertEqual(response.json()['user']['email'], 'test@example.com')
        self.assertEqual(response.json()['user']['grade'], '1° SECUNDARIA')
        self.assertEqual(response.json()['user']['group_name'], 'A')
        self.assertTrue(Player.objects.filter(email='test@example.com').exists())
        login = self.client.post(
            '/api/auth/login',
            {'credential': 'testuser', 'password': 'SecurePass123'},
            content_type='application/json',
        )
        self.assertEqual(login.status_code, 200)

    def test_student_registration_requires_grade_and_group(self):
        response = self.register(grade='', group_name='')

        self.assertEqual(response.status_code, 400)
        self.assertIn('grado y grupo', response.json()['error'])
        self.assertFalse(Player.objects.filter(email='test@example.com').exists())

    def test_teacher_registration_does_not_require_student_group(self):
        response = self.register(
            name='teacheruser',
            email='teacher@example.com',
            role='teacher',
            grade='',
            group_name='',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['role'], 'teacher')
        self.assertEqual(response.json()['user']['grade'], '')

    def test_teacher_student_list_includes_grade_and_group_for_filtering(self):
        teacher_response = self.register(
            name='teacheruser',
            email='teacher@example.com',
            role='teacher',
            grade='',
            group_name='',
        )
        self.register(name='studentone', email='student@example.com', grade='2° secundaria', group_name='B')

        response = self.client.get(
            '/api/assignments/students',
            HTTP_AUTHORIZATION=f"Bearer {teacher_response.json()['token']}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['grade'], '2° SECUNDARIA')
        self.assertEqual(response.json()[0]['group_name'], 'B')

    def test_teacher_can_assign_the_same_word_set_to_all_students_in_a_group(self):
        teacher_response = self.register(
            name='teacheruser',
            email='teacher@example.com',
            role='teacher',
            grade='',
            group_name='',
        )
        first_student = self.register(name='studentone', email='student1@example.com')
        second_student = self.register(
            name='studenttwo',
            email='student2@example.com',
            grade='1° secundaria',
            group_name='A',
        )
        words = [
            Word.objects.create(word=f'Palabra{i}', difficulty='easy')
            for i in range(3)
        ]

        response = self.client.post(
            '/api/assignments',
            {
                'studentIds': [
                    first_student.json()['user']['id'],
                    second_student.json()['user']['id'],
                ],
                'wordIds': [word.id for word in words],
                'theme': 'Ciencias',
                'difficulty': 'easy',
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f"Bearer {teacher_response.json()['token']}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['assignedStudents'], 2)
        assignments = AssignedGame.objects.order_by('student_id')
        self.assertEqual(assignments.count(), 2)
        self.assertEqual(assignments[0].word_ids, assignments[1].word_ids)
        self.assertEqual(set(assignments[0].word_ids), {word.id for word in words})

    def test_register_rejects_malformed_email(self):
        response = self.register(name='invalidemail', email='student@invalid_domain.com')

        self.assertEqual(response.status_code, 400)
        self.assertIn('correo', response.json()['error'].lower())

    def test_register_rejects_email_longer_than_model_limit(self):
        response = self.register(name='longemail', email=f'{"a" * 90}@example.com')

        self.assertEqual(response.status_code, 400)
        self.assertIn('100 caracteres', response.json()['error'])

    def test_register_rejects_weak_password(self):
        response = self.register(name='alice', email='alice@example.com', password='abc123')

        self.assertEqual(response.status_code, 400)
        self.assertIn('contraseña', response.json()['error'].lower())

    def test_login_bruteforce_is_rate_limited(self):
        self.register(name='bob', email='bob@example.com')

        responses = []
        for _ in range(6):
            response = self.client.post(
                '/api/auth/login',
                {'credential': 'bob', 'password': 'wrong-password'},
                content_type='application/json',
            )
            responses.append(response.status_code)

        self.assertIn(429, responses)

    def test_password_reset_email_and_token_can_change_password_once(self):
        self.register()

        response = self.client.post(
            '/api/auth/password-reset',
            {'email': 'test@example.com'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('password-recovery.html?token=', mail.outbox[0].body)
        reset_token = re.search(
            r'password-recovery\.html\?token=([A-Za-z0-9_-]+)',
            mail.outbox[0].body,
        ).group(1)
        stored_reset = PasswordResetToken.objects.get(player__email='test@example.com')
        self.assertNotEqual(stored_reset.token_hash, reset_token)

        changed = self.client.post(
            '/api/auth/password-reset/confirm',
            {'token': reset_token, 'password': 'NewSecurePass456'},
            content_type='application/json',
        )

        self.assertEqual(changed.status_code, 200)
        self.assertFalse(PasswordResetToken.objects.filter(player__email='test@example.com').exists())
        old_login = self.client.post(
            '/api/auth/login',
            {'credential': 'testuser', 'password': 'SecurePass123'},
            content_type='application/json',
        )
        new_login = self.client.post(
            '/api/auth/login',
            {'credential': 'testuser', 'password': 'NewSecurePass456'},
            content_type='application/json',
        )
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)

        reused = self.client.post(
            '/api/auth/password-reset/confirm',
            {'token': reset_token, 'password': 'AnotherSecure789'},
            content_type='application/json',
        )
        self.assertEqual(reused.status_code, 400)

    def test_password_reset_request_does_not_disclose_unknown_email(self):
        self.register()
        known_email_response = self.client.post(
            '/api/auth/password-reset',
            {'email': 'test@example.com'},
            content_type='application/json',
        )
        unknown_email_response = self.client.post(
            '/api/auth/password-reset',
            {'email': 'missing@example.com'},
            content_type='application/json',
        )

        self.assertEqual(known_email_response.status_code, unknown_email_response.status_code)
        self.assertEqual(known_email_response.json(), unknown_email_response.json())
        self.assertEqual(len(mail.outbox), 1)

    def test_expired_password_reset_token_is_rejected(self):
        player = Player.objects.create(
            name='expireduser',
            first_name='Expired',
            last_name='User',
            email='expired@example.com',
            password='old-password',
        )
        reset_token = 'expired-reset-token'
        PasswordResetToken.objects.create(
            player=player,
            token_hash=hashlib.sha256(reset_token.encode()).hexdigest(),
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.post(
            '/api/auth/password-reset/confirm',
            {'token': reset_token, 'password': 'NewSecurePass456'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        player.refresh_from_db()
        self.assertEqual(player.password, 'old-password')

    def test_password_reset_rejects_passwords_over_bcrypt_limit(self):
        player = Player.objects.create(
            name='longpassworduser',
            first_name='Long',
            last_name='Password',
            email='longpassword@example.com',
            password='old-password',
        )
        reset_token = 'long-password-reset-token'
        PasswordResetToken.objects.create(
            player=player,
            token_hash=hashlib.sha256(reset_token.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.post(
            '/api/auth/password-reset/confirm',
            {'token': reset_token, 'password': f'NewSecurePass456{"x" * 60}'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('72 bytes', response.json()['error'])
        self.assertTrue(PasswordResetToken.objects.filter(player=player).exists())

    @patch('nucleo.views_auth.send_mail', side_effect=OSError('SMTP unavailable'))
    def test_password_reset_email_failure_is_logged_without_exposing_account(self, send_mail_mock):
        self.register()

        response = self.client.post(
            '/api/auth/password-reset',
            {'email': 'test@example.com'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message'], (
            'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar tu contraseña.'
        ))
        self.assertFalse(PasswordResetToken.objects.exists())
        send_mail_mock.assert_called_once()
