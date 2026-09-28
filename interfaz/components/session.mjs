import { state, setState } from './state.mjs';

export function saveSession(token, user) {
  localStorage.setItem('ahorcado_token', token);
  localStorage.setItem('ahorcado_user', JSON.stringify(user));
}

export function loadSession() {
  const token = localStorage.getItem('ahorcado_token');
  const userJson = localStorage.getItem('ahorcado_user');
  if (!token || !userJson) return null;

  try {
    const user = JSON.parse(userJson);
    if (!user.id || !user.role) throw new Error('Datos corruptos');
    setState({ token, user });
    return { token, user };
  } catch (error) {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('ahorcado_token');
  localStorage.removeItem('ahorcado_user');
  setState({ token: null, user: null });
}
