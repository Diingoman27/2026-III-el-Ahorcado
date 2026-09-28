// public/js/theme.js

const themeToggleButton = document.getElementById('theme-toggle');

function applyParticlePalette(theme) {
  const isDark = theme === 'dark';
  document.documentElement.style.setProperty('--particle-color', isDark ? 'rgba(184, 167, 255, 0.75)' : 'rgba(91, 92, 240, 0.55)');
  document.documentElement.style.setProperty('--particle-glow', isDark ? 'rgba(105, 224, 231, 0.45)' : 'rgba(139, 92, 246, 0.35)');
}

function ensureParticleField() {
  const field = document.getElementById('particle-field');
  if (!field || field.dataset.ready === 'true') return;

  const particleCount = window.innerWidth < 640 ? 24 : 42;
  for (let i = 0; i < particleCount; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.style.setProperty('--size', `${(Math.random() * 8 + 5).toFixed(2)}px`);
    particle.style.setProperty('--left', `${(Math.random() * 100).toFixed(2)}%`);
    particle.style.setProperty('--delay', `${(Math.random() * 12).toFixed(2)}s`);
    particle.style.setProperty('--duration', `${(Math.random() * 14 + 12).toFixed(2)}s`);
    particle.style.setProperty('--drift-x', `${(Math.random() * 80 - 40).toFixed(2)}px`);
    particle.style.setProperty('--drift-y', `${(Math.random() * 120 - 40).toFixed(2)}px`);
    particle.style.opacity = String(0.26 + Math.random() * 0.6);
    field.appendChild(particle);
  }
  field.dataset.ready = 'true';
}

/**
 * Aplica un tema a la página y lo guarda en localStorage.
 * @param {string} theme - El tema a aplicar ('light' o 'dark').
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  applyParticlePalette(theme);
  themeToggleButton?.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggleButton?.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

/**
 * Inicializa el tema al cargar la página.
 * Usa el tema guardado, o el preferido por el sistema operativo como fallback.
 */
function initializeTheme() {
  ensureParticleField();
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
