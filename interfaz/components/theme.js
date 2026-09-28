// public/js/theme.js

const themeToggleButton = document.getElementById('theme-toggle'); // Necesitas un botón o switch con este ID

/**
 * Aplica un tema a la página y lo guarda en localStorage.
 * @param {string} theme - El tema a aplicar ('light' o 'dark').
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggleButton?.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggleButton?.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

/**
 * Inicializa el tema al cargar la página.
 * Usa el tema guardado, o el preferido por el sistema operativo como fallback.
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

themeToggleButton?.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

initializeTheme();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (!localStorage.getItem('theme')) applyTheme(event.matches ? 'dark' : 'light');
});
