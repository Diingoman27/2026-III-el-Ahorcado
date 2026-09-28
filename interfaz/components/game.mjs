import { state, setState } from './state.mjs';
import { setMessage } from './ui.mjs';
import { createGame, submitGuess, loadMyAssignments, loadGameExplanation } from './api.mjs';
import { celebrate, createSoundEngine } from './effects.mjs';

const alphabet = 'abcdefghijklmnñopqrstuvwxyz'.split('');

export function initTraditionalGame({ elements, onGameReady }) {
  const {
    letterInput, guessBtn, newGameBtn, startGameBtn, assignmentSelect, difficultySelect, lettersRow, maskedWord,
    attemptsEl, wrongAttemptsEl, difficultyEl, gameStatusEl, hintArea, gameMessage,
    hangmanParts, attemptMeterFill,
  } = elements;
  const sounds = createSoundEngine();
  let previousState = null;
  const pendingLetters = new Set();
  let explainedGameId = null;

  function renderHangman(wrongAttempts = 0) {
    hangmanParts?.forEach((part) => {
      part.classList.toggle('visible', Number(part.dataset.step) <= wrongAttempts);
    });
    if (attemptMeterFill) attemptMeterFill.style.width = `${Math.min(100, (wrongAttempts / 6) * 100)}%`;
  }

  function renderKeypad(guessed = [], wrong = [], status = 'playing') {
    if (!lettersRow) return;
    lettersRow.innerHTML = '';
    const correctSet = new Set(guessed || []);
    const wrongSet = new Set(wrong || []);

    alphabet.forEach((letter) => {
      const isPending = pendingLetters.has(letter);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = letter.toUpperCase();
      button.dataset.letter = letter;
      button.setAttribute('aria-label', `Letra ${letter}`);
      button.disabled = status !== 'playing' || isPending || correctSet.has(letter) || wrongSet.has(letter);
      if (isPending) button.classList.add('used', 'pending');
      if (correctSet.has(letter)) button.classList.add('used', 'correct');
      if (wrongSet.has(letter)) button.classList.add('used', 'wrong');
      const activateLetter = (event) => {
        event.preventDefault();
        if (button.disabled) return;
        button.blur();
        handleGuess(letter);
      };
      button.addEventListener('pointerdown', activateLetter);
      button.addEventListener('touchstart', activateLetter, { passive: false });
      button.addEventListener('mousedown', activateLetter);
      button.addEventListener('click', (event) => {
        if (event.detail === 0) handleGuess(letter);
      });
      lettersRow.appendChild(button);
    });
  }

  function getLetterButton(letter) {
    return lettersRow?.querySelector(`button[data-letter="${letter}"]`);
  }

  function isAlreadyTried(letter) {
    return pendingLetters.has(letter) || previousState?.guessedLetters?.includes(letter) || previousState?.wrongLetters?.includes(letter);
  }

  function markLetterPending(letter) {
    const button = getLetterButton(letter);
    if (!button || button.disabled) return;
    pendingLetters.add(letter);
    button.classList.add('used', 'pending');
    button.disabled = true;
  }

  function clearLetterPending(letter) {
    pendingLetters.delete(letter);
    const button = getLetterButton(letter);
    if (!button?.classList.contains('pending')) return;
    button.classList.remove('used', 'pending');
    button.disabled = false;
  }

  function announceResult(data) {
    if (data.status === 'won') {
      sounds.win();
      celebrate();
      setMessage(gameMessage, `🎉 ¡Excelente! Adivinaste “${data.word}”. Pulsa “Siguiente palabra” para continuar.`);
      gameMessage?.classList.add('result-message', 'win');
    } else if (data.status === 'lost') {
      sounds.lose();
      setMessage(gameMessage, `La palabra era “${data.word}”. Pulsa “Siguiente palabra” para intentarlo de nuevo.`);
      gameMessage?.classList.add('result-message', 'lose');
    }
  }

  async function showLearningExplanation(data) {
    if (!data?.id || data.status === 'playing' || explainedGameId === data.id || !hintArea) return;
    explainedGameId = data.id;
    hintArea.textContent = 'Generando explicación de aprendizaje...';
    try {
      const { response, data: explanationData } = await loadGameExplanation(data.id);
      if (!response.ok || !explanationData.explanation) {
        hintArea.textContent = data.learningHint || 'Repasa la palabra y vuelve a intentarlo en una nueva ronda.';
        return;
      }
      hintArea.textContent = `Aprendizaje: ${explanationData.explanation}`;
    } catch {
      hintArea.textContent = data.learningHint || 'Repasa la palabra y vuelve a intentarlo en una nueva ronda.';
    }
  }

  function setGameState(data) {
    if (!data || !maskedWord) return;
    const wasPlaying = previousState?.status === 'playing';
    const newCorrectGuess = previousState && data.guessedLetters?.length > previousState.guessedLetters?.length;
    const newWrongGuess = previousState && data.wrongAttempts > previousState.wrongAttempts;
    [...pendingLetters].forEach((letter) => {
      if (data.guessedLetters?.includes(letter) || data.wrongLetters?.includes(letter)) {
        pendingLetters.delete(letter);
      }
    });

    setState({ gameId: data.id });
    maskedWord.textContent = data.masked;
    attemptsEl && (attemptsEl.textContent = data.attempts);
    wrongAttemptsEl && (wrongAttemptsEl.textContent = data.wrongAttempts);
    difficultyEl && (difficultyEl.textContent = `Dificultad: ${data.difficulty === 'easy' ? 'fácil' : data.difficulty === 'medium' ? 'media' : 'difícil'}`);
    gameStatusEl && (gameStatusEl.textContent = data.status === 'playing' ? 'Partida en juego' : data.status === 'won' ? '¡Palabra descubierta!' : 'Fin de la partida');
    hintArea && (hintArea.textContent = data.hint
      ? `Pista: se reveló la letra “${data.hint.toUpperCase()}”. ${data.learningHint || ''}`.trim()
      : 'Recibes una pista cada dos fallos.');
    renderHangman(data.wrongAttempts);
    renderKeypad(data.guessedLetters, data.wrongLetters, data.status);
    startGameBtn?.classList.add('hidden');
    newGameBtn?.classList.toggle('hidden', data.status === 'playing');

    gameMessage?.classList.remove('result-message', 'win', 'lose');
    if (data.status !== 'playing') {
      if (wasPlaying || !previousState) {
        announceResult(data);
      }
      showLearningExplanation(data);
    } else if (newCorrectGuess) {
      sounds.correct();
      setMessage(gameMessage, '¡Bien! Esa letra sí está en la palabra.');
    } else if (newWrongGuess) {
      sounds.wrong();
      setMessage(gameMessage, `Esa letra no aparece. Te quedan ${6 - data.wrongAttempts} oportunidades.`);
    } else {
      setMessage(gameMessage, 'Selecciona una letra del teclado.');
    }

    previousState = data;
    if (typeof onGameReady === 'function') onGameReady(data);
  }

  async function handleGuess(letter) {
    if (!state.gameId) return;
    if (previousState && previousState.status !== 'playing') return;
    const normalized = String(letter).toLowerCase();
    if (!alphabet.includes(normalized)) return;
    if (isAlreadyTried(normalized)) return;
    markLetterPending(normalized);
    setMessage(gameMessage, `Probando “${normalized.toUpperCase()}”...`);
    try {
      const { response, data } = await submitGuess(normalized, state.gameId);
      if (response.ok) setGameState(data);
      else {
        clearLetterPending(normalized);
        setMessage(gameMessage, data.error || 'No se pudo procesar la jugada.');
      }
    } catch {
      clearLetterPending(normalized);
      setMessage(gameMessage, 'No se pudo conectar con el servidor.');
    } finally {
      pendingLetters.delete(normalized);
    }
  }

  async function startNewGame() {
    pendingLetters.clear();
    explainedGameId = null;
    if (!state.user) {
      const stored = localStorage.getItem('ahorcado_user');
      if (stored) setState({ user: JSON.parse(stored) });
      else return setMessage(gameMessage, 'Inicia sesión para comenzar una partida.');
    }
    let themedQueue = null;
    try { themedQueue = JSON.parse(localStorage.getItem('themedGameQueue')); } catch { themedQueue = null; }
    const queuedWord = themedQueue?.words?.[themedQueue.current];
    if (themedQueue && !queuedWord) {
      localStorage.removeItem('themedGameQueue');
      setMessage(gameMessage, `🎉 Completaste la partida temática “${themedQueue.theme}”.`);
      celebrate();
      return;
    }
    previousState = null;
    explainedGameId = null;
    setState({ gameId: null });
    renderHangman(0);
    renderKeypad([], [], 'waiting');
    const assignmentId = assignmentSelect?.value ? Number(assignmentSelect.value) : null;
    const { response, data } = await createGame(
      queuedWord?.difficulty || difficultySelect?.value || state.difficulty,
      queuedWord?.id,
      assignmentId
    );
    if (response.ok) {
      if (queuedWord) {
        themedQueue.current += 1;
        localStorage.setItem('themedGameQueue', JSON.stringify(themedQueue));
        setMessage(gameMessage, `Tema “${themedQueue.theme}” · palabra ${themedQueue.current} de ${themedQueue.words.length}`);
      }
      setGameState(data);
    }
    else setMessage(gameMessage, data.error || 'No se pudo iniciar la partida.');
  }

  letterInput?.addEventListener('input', () => {
    letterInput.value = letterInput.value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚüÜ]/g, '').slice(0, 1);
  });
  guessBtn?.addEventListener('click', () => {
    const guess = letterInput?.value.trim().toLowerCase();
    if (guess?.length === 1) handleGuess(guess);
    else setMessage(gameMessage, 'Ingresa una sola letra.');
    if (letterInput) letterInput.value = '';
  });
  newGameBtn?.addEventListener('click', startNewGame);
  startGameBtn?.addEventListener('click', startNewGame);
  document.addEventListener('keydown', (event) => {
    if (!elements.gamePanel || elements.gamePanel.classList.contains('hidden') || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[a-zA-ZñÑ]$/.test(event.key)) handleGuess(event.key);
  });

  renderHangman(0);
  renderKeypad([], [], 'waiting');

  async function loadGameOptions() {
    setState({ gameId: null });
    previousState = null;
    explainedGameId = null;
    maskedWord && (maskedWord.textContent = 'Pulsa “Iniciar juego”');
    attemptsEl && (attemptsEl.textContent = '0');
    wrongAttemptsEl && (wrongAttemptsEl.textContent = '0');
    renderHangman(0);
    pendingLetters.clear();
    renderKeypad([], [], 'waiting');
    startGameBtn?.classList.remove('hidden');
    newGameBtn?.classList.add('hidden');
    setMessage(gameMessage, 'Elige partida libre o una actividad asignada. Recibes una pista cada dos fallos.');
    if (!assignmentSelect) return;
    assignmentSelect.innerHTML = '<option value="">Partida libre · palabras aleatorias</option>';
    try {
      const { response, data } = await loadMyAssignments();
      if (!response.ok) return;
      data.forEach((assignment) => {
        const option = document.createElement('option');
        option.value = assignment.id;
        option.textContent = `${assignment.theme} · ${assignment.current_index}/${assignment.word_count} · Prof. ${assignment.teacher_name}`;
        assignmentSelect.appendChild(option);
      });
    } catch {
      setMessage(gameMessage, 'Puedes iniciar una partida libre; no se cargaron las asignadas.');
    }
  }

  return { setGameState, startNewGame, loadGameOptions };
}
