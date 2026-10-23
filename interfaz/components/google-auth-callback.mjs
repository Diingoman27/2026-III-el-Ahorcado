import { completeGoogleAuth } from './google-auth.mjs?v=20261022-google-signup-recovery';
import { saveSession } from './session.mjs';

const status = document.getElementById('google-auth-status');
const backLink = document.getElementById('google-auth-back');

try {
  const result = await completeGoogleAuth();
  if (result.requires_registration) {
    window.location.replace('/register.html?google=complete');
  } else {
    saveSession(result.token, result.user);
    window.location.replace('/');
  }
} catch (error) {
  status.textContent = error.message || 'No se pudo completar el inicio de sesión con Google.';
  const message = status.textContent.toLocaleLowerCase();
  if (message.includes('ya existe una cuenta') || message.includes('ya tiene una cuenta')) {
    backLink.href = '/';
    backLink.textContent = 'Volver al inicio de sesión';
  }
  backLink.classList.remove('hidden');
}
