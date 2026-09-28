from django.test import TestCase


class SecurityHardeningTests(TestCase):
    def test_register_rejects_weak_password(self):
        response = self.client.post(
            '/api/auth/register',
            {
                'name': 'alice',
                'first_name': 'Alice',
                'last_name': 'Tester',
                'email': 'alice@example.com',
                'role': 'student',
                'password': 'abc123',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('contraseña', response.json()['error'].lower())

    def test_login_bruteforce_is_rate_limited(self):
        self.client.post(
            '/api/auth/register',
            {
                'name': 'bob',
                'first_name': 'Bob',
                'last_name': 'Tester',
                'email': 'bob@example.com',
                'role': 'student',
                'password': 'SecurePass123',
            },
            content_type='application/json',
        )

        responses = []
        for _ in range(6):
            response = self.client.post(
                '/api/auth/login',
                {'credential': 'bob', 'password': 'wrong-password'},
                content_type='application/json',
            )
            responses.append(response.status_code)

        self.assertIn(429, responses)
