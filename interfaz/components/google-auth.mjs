const authIntentKey = 'ahorcado_google_auth_intent';
const registrationTokenKey = 'ahorcado_google_registration_token';
const registrationProfileKey = 'ahorcado_google_registration_profile';
const registrationDraftKey = 'ahorcado_google_registration_draft';

let supabaseClientPromise;

async function getSupabaseClient() {
  if (!window.supabase?.createClient) {
    throw new Error('No se pudo cargar el cliente de autenticación. Recarga la página e inténtalo de nuevo.');
  }

  if (!supabaseClientPromise) {
    supabaseClientPromise = fetch('/api/auth/google/config', { cache: 'no-store' })
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok || !config.enabled) {
          throw new Error('El inicio de sesión con Google aún no está configurado en el servidor.');
        }
        return window.supabase.createClient(config.supabase_url, config.supabase_key, {
          auth: {
            flowType: 'pkce',
            detectSessionInUrl: false,
            autoRefreshToken: true,
            storage: window.localStorage,
          },
        });
      })
      .catch((error) => {
        supabaseClientPromise = null;
        throw error;
      });
  }
  return supabaseClientPromise;
}

export async function startGoogleAuth(intent = 'login', registrationDraft = null) {
  const client = await getSupabaseClient();
  sessionStorage.setItem(authIntentKey, intent);
  sessionStorage.removeItem(registrationTokenKey);
  sessionStorage.removeItem(registrationProfileKey);
  if (registrationDraft) {
    sessionStorage.setItem(registrationDraftKey, JSON.stringify(registrationDraft));
  } else {
    sessionStorage.removeItem(registrationDraftKey);
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback/` },
  });
  if (error) {
    sessionStorage.removeItem(authIntentKey);
    throw error;
  }
}

export async function completeGoogleAuth() {
  const client = await getSupabaseClient();
  const oauthError = new URLSearchParams(window.location.search).get('error_description');
  if (oauthError) {
    throw new Error('Google canceló o rechazó la autenticación. Inténtalo de nuevo.');
  }

  let session;
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    session = data.session;
  } else {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data.session;
  }
  if (!session?.access_token) {
    throw new Error('No se recibió una sesión válida de Google. Vuelve a intentarlo.');
  }

  const intent = sessionStorage.getItem(authIntentKey) || 'login';
  sessionStorage.removeItem(authIntentKey);

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: session.access_token,
      intent,
    }),
  });
  let result = {};
  try {
    result = await response.json();
  } catch {
    throw new Error('El servidor no devolvió una respuesta válida al iniciar sesión.');
  }
  if (response.ok && result.requires_registration && result.profile) {
    sessionStorage.setItem(registrationTokenKey, 'pending');
    sessionStorage.setItem(registrationProfileKey, JSON.stringify(result.profile));
    return result;
  }
  if (!response.ok || !result.token || !result.user) {
    throw new Error(result.error || 'No se pudo completar el inicio de sesión con Google.');
  }

  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  return result;
}

export function getGoogleRegistrationProfile() {
  const storedProfile = sessionStorage.getItem(registrationProfileKey);
  if (!storedProfile || !sessionStorage.getItem(registrationTokenKey)) return null;
  try {
    return JSON.parse(storedProfile);
  } catch {
    sessionStorage.removeItem(registrationProfileKey);
    sessionStorage.removeItem(registrationTokenKey);
    throw new Error('Los datos de Google no se pudieron recuperar. Inicia el registro de nuevo.');
  }
}

export function getGoogleRegistrationDraft() {
  const storedDraft = sessionStorage.getItem(registrationDraftKey);
  if (!storedDraft) return null;
  try {
    return JSON.parse(storedDraft);
  } catch {
    sessionStorage.removeItem(registrationDraftKey);
    throw new Error('Los datos del formulario se dañaron. Vuelve a completarlos.');
  }
}

export async function registerWithGoogle(registrationData) {
  if (!sessionStorage.getItem(registrationTokenKey)) {
    throw new Error('La autorización de Google expiró. Inicia el registro con Google de nuevo.');
  }

  const client = await getSupabaseClient();
  let { data, error } = await client.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session?.access_token) {
    throw new Error('La sesión de Google ya no está disponible. Vuelve a autorizar tu cuenta.');
  }

  if (!session.expires_at || session.expires_at * 1000 <= Date.now() + 60_000) {
    ({ data, error } = await client.auth.refreshSession());
    if (error) throw error;
    session = data.session;
  }
  if (!session?.access_token) {
    throw new Error('La autorización de Google expiró. Vuelve a autorizar tu cuenta.');
  }

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: session.access_token,
      intent: 'register',
      ...registrationData,
    }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('El servidor no devolvió una respuesta válida al crear la cuenta.');
  }
  if (!response.ok || !result.token || !result.user) {
    throw new Error(result.error || 'No se pudo completar el registro con Google.');
  }

  const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
  if (signOutError) throw signOutError;
  sessionStorage.removeItem(registrationTokenKey);
  sessionStorage.removeItem(registrationProfileKey);
  sessionStorage.removeItem(registrationDraftKey);
  return result;
}
