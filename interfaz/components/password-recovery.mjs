const requestForm = document.getElementById('request-reset-form');
const resetForm = document.getElementById('reset-password-form');
const emailInput = document.getElementById('recovery-email');
const passwordInput = document.getElementById('new-password');
const confirmInput = document.getElementById('confirm-password');
const message = document.getElementById('recovery-message');
const title = document.getElementById('recovery-title');
const description = document.getElementById('recovery-description');
const token = new URLSearchParams(window.location.search).get('token') || '';

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

if (token) {
  requestForm.classList.add('hidden');
  resetForm.classList.remove('hidden');
  title.textContent = 'Elige una nueva contraseña';
  description.textContent = 'Crea una contraseña segura para volver a acceder a tu cuenta.';
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requestForm.checkValidity()) {
    requestForm.reportValidity();
    return;
  }

  const button = requestForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage('Enviando solicitud...');
  try {
    const { response, data } = await postJson('/api/auth/password-reset', {
      email: emailInput.value.trim().toLowerCase(),
    });
    if (!response.ok) {
      showMessage(data.error || 'No se pudo procesar la solicitud.', true);
      return;
    }
    showMessage(data.message || 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperarla.');
    requestForm.reset();
  } catch {
    showMessage('No se pudo conectar con el servidor. Inténtalo de nuevo.', true);
  } finally {
    button.disabled = false;
  }
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!resetForm.checkValidity()) {
    resetForm.reportValidity();
    return;
  }
  if (passwordInput.value !== confirmInput.value) {
    confirmInput.setCustomValidity('Las contraseñas no coinciden.');
    confirmInput.reportValidity();
    return;
  }
  confirmInput.setCustomValidity('');

  const button = resetForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage('Actualizando contraseña...');
  try {
    const { response, data } = await postJson('/api/auth/password-reset/confirm', {
      token,
      password: passwordInput.value,
    });
    if (!response.ok) {
      showMessage(data.error || 'No se pudo actualizar la contraseña.', true);
      return;
    }
    resetForm.classList.add('hidden');
    title.textContent = 'Contraseña actualizada';
    description.textContent = 'Ya puedes iniciar sesión con tu nueva contraseña.';
    showMessage(data.message);
  } catch {
    showMessage('No se pudo conectar con el servidor. Inténtalo de nuevo.', true);
  } finally {
    button.disabled = false;
  }
});

confirmInput.addEventListener('input', () => confirmInput.setCustomValidity(''));

if (token.length > 200) {
  resetForm.classList.add('hidden');
  showMessage('El enlace de recuperación no es válido.', true);
}
