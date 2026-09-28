import { state, setState } from './components/state.mjs';
import { setMessage, showPanel } from './components/ui.mjs';
import { deleteMyAccount, loadLeaderboard as fetchLeaderboard, registerUser, loginUser } from './components/api.mjs';
import { saveSession, loadSession, clearSession as clearStoredSession } from './components/session.mjs';
import { initTraditionalGame } from './components/game.mjs';
import { initDailyChallenge } from './components/challenge.mjs';
import { initTeacherPanel } from './components/teacher.mjs';

const APP_BUILD = '2026-07-18-auth-ui-fix';

const elements = {
  loginForm: document.getElementById('login-form'),
  authName: document.getElementById('auth-name'),
  authPassword: document.getElementById('auth-password'),
  showRegisterBtn: document.getElementById('show-register-btn'),
  authMessage: document.getElementById('auth-message'),
  rankingList: document.getElementById('ranking-list'),
  registerForm: document.getElementById('register-form'),
  registerUsername: document.getElementById('register-username'),
  registerFirstName: document.getElementById('register-first-name'),
  registerLastName: document.getElementById('register-last-name'),
  registerEmail: document.getElementById('register-email'),
  registerRole: document.getElementById('register-role'),
  registerPassword: document.getElementById('register-password'),
  registerMessage: document.getElementById('register-message'),
  backToLoginBtn: document.getElementById('back-to-login'),
  introPanel: document.getElementById('intro-panel'),
  homePanel: document.getElementById('home-panel'),
  settingsPanel: document.getElementById('settings-panel'),
  gamePanel: document.getElementById('game-panel'),
  teacherPanel: document.getElementById('teacher-panel'),
  speedChallengePanel: document.getElementById('speed-challenge-panel'),
  welcomeName: document.getElementById('welcome-name'),
  playGameBtn: document.getElementById('play-game-btn'),
  speedChallengeBtn: document.getElementById('speed-challenge-btn'),
  teacherBtn: document.getElementById('teacher-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  settingsLogoutBtn: document.getElementById('settings-logout-btn'),
  backToHomeBtn: document.getElementById('back-to-home-btn'),
  backToHomeFromSettingsBtn: document.getElementById('back-to-home-from-settings-btn'),
  backToHomeFromTeacherBtn: document.getElementById('back-to-home-from-teacher-btn'),
  backToHomeFromChallengeBtn: document.getElementById('back-to-home-from-challenge-btn'),
  letterInput: document.getElementById('letter-input'),
  guessBtn: document.getElementById('guess-btn'),
  newGameBtn: document.getElementById('new-game'),
  startGameBtn: document.getElementById('start-game-btn'),
  assignmentSelect: document.getElementById('assignment-select'),
  difficultySelect: document.getElementById('difficulty'),
  lettersRow: document.getElementById('letters-row'),
  maskedWord: document.getElementById('masked-word'),
  attemptsEl: document.getElementById('attempts'),
  wrongAttemptsEl: document.getElementById('wrong-attempts'),
  hangmanParts: document.querySelectorAll('.hangman-part'),
  attemptMeterFill: document.getElementById('attempt-meter-fill'),
  difficultyEl: document.getElementById('game-difficulty'),
  gameStatusEl: document.getElementById('game-status'),
  hintArea: document.getElementById('hint-area'),
  gameMessage: document.getElementById('game-message'),
  wordForm: document.getElementById('word-form'),
  wordText: document.getElementById('word-text'),
  wordDifficulty: document.getElementById('word-difficulty'),
  wordTheme: document.getElementById('word-theme'),
  wordAssignDaily: document.getElementById('word-assign-daily'),
  aiWordForm: document.getElementById('ai-word-form'),
  aiWordTheme: document.getElementById('ai-word-theme'),
  aiWordCount: document.getElementById('ai-word-count'),
  aiWordDifficulty: document.getElementById('ai-word-difficulty'),
  aiWordMessage: document.getElementById('ai-word-message'),
  wordFilter: document.getElementById('word-filter'),
  themeFilter: document.getElementById('theme-filter'),
  teacherWordBank: document.getElementById('teacher-word-bank'),
  gameConfigForm: document.getElementById('game-config-form'),
  gameTheme: document.getElementById('game-theme'),
  gameWordCount: document.getElementById('game-word-count'),
  gameSource: document.getElementById('game-source'),
  gameConfigDifficulty: document.getElementById('game-config-difficulty'),
  gameConfigMessage: document.getElementById('game-config-message'),
  studentFilter: document.getElementById('student-filter'),
  studentChecklist: document.getElementById('student-checklist'),
  startPreparedGameBtn: document.getElementById('start-prepared-game-btn'),
  assignedGamesList: document.getElementById('assigned-games-list'),
  assignedGamesMessage: document.getElementById('assigned-games-message'),
  teacherMessage: document.getElementById('teacher-message'),
  dailyWordForm: document.getElementById('daily-word-form'),
  dailyWordSelect: document.getElementById('daily-word-select'),
  dailyWordText: document.getElementById('daily-word-text'),
  dailyWordTheme: document.getElementById('daily-word-theme'),
  dailyWordDifficulty: document.getElementById('daily-word-difficulty'),
  dailyWordMessage: document.getElementById('daily-word-message'),
  challengeWaiting: document.getElementById('challenge-waiting'),
  challengeGame: document.getElementById('challenge-game'),
  challengeResult: document.getElementById('challenge-result'),
  challengeLeaderboard: document.getElementById('challenge-leaderboard'),
  challengeMaskedWord: document.getElementById('challenge-masked-word'),
  challengeDifficultyBadge: document.getElementById('challenge-difficulty-badge'),
  challengeStatus: document.getElementById('challenge-status'),
  challengeLettersRow: document.getElementById('challenge-letters-row'),
  challengeAttemptsEl: document.getElementById('challenge-attempts'),
  challengeWrongAttemptsEl: document.getElementById('challenge-wrong-attempts'),
  challengeHangmanParts: document.querySelectorAll('.challenge-hangman-part'),
  challengeAttemptMeterFill: document.getElementById('challenge-attempt-meter-fill'),
  challengeHintArea: document.getElementById('challenge-hint-area'),
  challengeSolveForm: document.getElementById('challenge-solve-form'),
  challengeSolveInput: document.getElementById('challenge-solve-input'),
  challengeAnswerForm: document.getElementById('challenge-answer-form'),
  challengeLetterInput: document.getElementById('challenge-letter-input'),
  challengeMessage: document.getElementById('challenge-message'),
  timerText: document.getElementById('timer-text'),
  timerProgress: document.getElementById('timer-progress'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  resultPoints: document.getElementById('result-points'),
  resultTime: document.getElementById('result-time'),
  challengeLeaderboardBtn: document.getElementById('challenge-leaderboard-btn'),
  challengeBackBtn: document.getElementById('challenge-back-btn'),
  challengeRankingList: document.getElementById('challenge-ranking-list'),
  deleteAccountForm: document.getElementById('delete-account-form'),
  deleteAccountPassword: document.getElementById('delete-account-password'),
  deleteAccountMessage: document.getElementById('delete-account-message'),
};

async function loadLeaderboard() {
  if (!elements.rankingList) return;
  try {
    const { response, data } = await fetchLeaderboard();
    if (!response.ok || !Array.isArray(data)) throw new Error(data.error || 'Ranking no disponible');
    elements.rankingList.innerHTML = '';
    if (data.length === 0) {
      elements.rankingList.innerHTML = '<li>Aún no hay jugadores en el ranking.</li>';
      return;
    }
    data.forEach((player) => {
      const li = document.createElement('li');
      li.textContent = `${player.name} — ${player.score} pts`;
      elements.rankingList.appendChild(li);
    });
  } catch (error) {
    elements.rankingList.innerHTML = '<li>El ranking no está disponible por el momento.</li>';
  }
}

async function setUserSession(data) {
  setState({ token: data.token, user: data.user });
  saveSession(data.token, data.user);

  showPanel(elements.introPanel, false);
  showPanel(elements.homePanel, true);
  showPanel(elements.settingsPanel, false);
  showPanel(elements.gamePanel, false);
  showPanel(elements.teacherPanel, false);
  showPanel(elements.speedChallengePanel, false);

  if (elements.welcomeName) {
    elements.welcomeName.textContent = data.user.name;
  }
  elements.settingsBtn?.classList.remove('hidden');

  if (elements.teacherBtn) {
    if (data.user.role === 'teacher') {
      elements.teacherBtn.classList.remove('hidden');
      elements.teacherBtn.style.display = '';
      teacherController.loadDailyWordsOptions();
    } else {
      elements.teacherBtn.classList.add('hidden');
      elements.teacherBtn.style.display = 'none';
    }
  }

  await loadLeaderboard();
}

function logout() {
  clearStoredSession();
  setState({ token: null, user: null });
  elements.settingsBtn?.classList.add('hidden');
  showPanel(elements.homePanel, false);
  showPanel(elements.settingsPanel, false);
  showPanel(elements.gamePanel, false);
  showPanel(elements.teacherPanel, false);
  showPanel(elements.speedChallengePanel, false);
  showPanel(elements.introPanel, true);
  if (elements.authName) elements.authName.value = '';
  if (elements.authPassword) elements.authPassword.value = '';
  setMessage(elements.authMessage, 'Sesión cerrada');
}

const gameController = initTraditionalGame({
  elements,
  onGameReady: () => showPanel(elements.gamePanel, true),
});

const challengeController = initDailyChallenge({ elements });
const teacherController = initTeacherPanel({
  elements,
  onStartGame: async () => {
    showPanel(elements.teacherPanel, false);
    showPanel(elements.gamePanel, true);
    // Inicia directamente la partida preparada sin mostrar las opciones de alumno.
    await gameController.startNewGame();
  },
});

if (elements.loginForm) {
  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!elements.loginForm.checkValidity()) {
      elements.loginForm.reportValidity();
      return;
    }

    const { response, data } = await loginUser(elements.authName.value.trim(), elements.authPassword.value.trim());
    if (response.ok && data.token) {
      await setUserSession(data);
    } else {
      setMessage(elements.authMessage, data.error || 'Error de inicio de sesión');
    }
  });
}

if (elements.showRegisterBtn) {
  elements.showRegisterBtn.addEventListener('click', () => {
    window.location.href = '/register.html';
  });
}

if (elements.registerForm) {
  elements.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!elements.registerForm.checkValidity()) {
      elements.registerForm.reportValidity();
      return;
    }

    const payload = {
      name: elements.registerUsername.value.trim(),
      first_name: elements.registerFirstName.value.trim(),
      last_name: elements.registerLastName.value.trim(),
      email: elements.registerEmail.value.trim().toLowerCase(),
      role: elements.registerRole.value,
      password: elements.registerPassword.value,
    };

    const { response, data } = await registerUser(payload);
    if (response.ok && data.token) {
      if (data.user?.role !== payload.role) {
        setMessage(elements.registerMessage, 'El rol guardado no coincide con el rol seleccionado. Inicia sesión de nuevo o contacta al administrador.');
        return;
      }
      saveSession(data.token, data.user);
      window.location.href = '/';
    } else {
      setMessage(elements.registerMessage, data.error || 'Error registrando usuario');
    }
  });
}

if (elements.backToLoginBtn) {
  elements.backToLoginBtn.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.href = '/';
  });
}

if (elements.playGameBtn) {
  elements.playGameBtn.addEventListener('click', () => {
    showPanel(elements.homePanel, false);
    showPanel(elements.gamePanel, true);
    gameController.loadGameOptions();
  });
}

if (elements.speedChallengeBtn) {
  elements.speedChallengeBtn.addEventListener('click', () => {
    showPanel(elements.homePanel, false);
    showPanel(elements.speedChallengePanel, true);
    challengeController.loadChallenge();
  });
}

if (elements.teacherBtn) {
  elements.teacherBtn.addEventListener('click', () => {
    showPanel(elements.homePanel, false);
    showPanel(elements.teacherPanel, true);
  });
}

if (elements.settingsBtn) {
  elements.settingsBtn.addEventListener('click', () => {
    showPanel(elements.introPanel, false);
    showPanel(elements.homePanel, false);
    showPanel(elements.gamePanel, false);
    showPanel(elements.teacherPanel, false);
    showPanel(elements.speedChallengePanel, false);
    showPanel(elements.settingsPanel, true);
  });
}

if (elements.logoutBtn) {
  elements.logoutBtn.addEventListener('click', logout);
}
if (elements.settingsLogoutBtn) {
  elements.settingsLogoutBtn.addEventListener('click', logout);
}

if (elements.deleteAccountForm) {
  elements.deleteAccountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!elements.deleteAccountForm.checkValidity()) {
      elements.deleteAccountForm.reportValidity();
      return;
    }

    const confirmed = window.confirm('¿Eliminar tu cuenta permanentemente? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    const button = elements.deleteAccountForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Eliminando...';
    setMessage(elements.deleteAccountMessage, 'Eliminando cuenta...');
    try {
      const { response, data } = await deleteMyAccount(elements.deleteAccountPassword.value);
      if (!response.ok) {
        return setMessage(elements.deleteAccountMessage, data.error || 'No se pudo eliminar la cuenta.');
      }
      clearStoredSession();
      setState({ token: null, user: null });
      elements.settingsBtn?.classList.add('hidden');
      elements.deleteAccountPassword.value = '';
      showPanel(elements.settingsPanel, false);
      showPanel(elements.homePanel, false);
      showPanel(elements.gamePanel, false);
      showPanel(elements.teacherPanel, false);
      showPanel(elements.speedChallengePanel, false);
      showPanel(elements.introPanel, true);
      setMessage(elements.authMessage, data.message || 'Cuenta eliminada permanentemente.');
      await loadLeaderboard();
    } catch {
      setMessage(elements.deleteAccountMessage, 'No se pudo conectar con el servidor.');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

const backToHomeAction = () => {
  showPanel(elements.homePanel, true);
  showPanel(elements.settingsPanel, false);
  showPanel(elements.gamePanel, false);
  showPanel(elements.teacherPanel, false);
  showPanel(elements.speedChallengePanel, false);
  loadLeaderboard();
};

if (elements.backToHomeBtn) elements.backToHomeBtn.addEventListener('click', backToHomeAction);
if (elements.backToHomeFromSettingsBtn) elements.backToHomeFromSettingsBtn.addEventListener('click', backToHomeAction);
if (elements.backToHomeFromTeacherBtn) elements.backToHomeFromTeacherBtn.addEventListener('click', backToHomeAction);
if (elements.backToHomeFromChallengeBtn) elements.backToHomeFromChallengeBtn.addEventListener('click', backToHomeAction);
if (elements.challengeBackBtn) elements.challengeBackBtn.addEventListener('click', backToHomeAction);

if (elements.loginForm && window.location.pathname === '/') {
  const existingSession = loadSession();
  if (existingSession) {
    setUserSession(existingSession);
  } else {
    loadLeaderboard();
  }
}
