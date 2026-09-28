import { setMessage } from './ui.mjs';
import { apiFetch, loadWordsForTeacher, setDailyWord } from './api.mjs';

const difficultyLabels = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };
const statusLabels = { pending: 'Pendiente', playing: 'En progreso', completed: 'Completada' };

export function initTeacherPanel({ elements, onWordsLoaded, onStartGame }) {
  const {
    wordForm, wordText, wordDifficulty, wordTheme, wordAssignDaily, teacherMessage,
    aiWordForm, aiWordTheme, aiWordCount, aiWordDifficulty, aiWordMessage,
    dailyWordForm, dailyWordSelect, dailyWordMessage, wordFilter, themeFilter,
    teacherWordBank, gameConfigForm, gameTheme, gameWordCount, gameSource,
    gameConfigDifficulty, gameConfigMessage, studentFilter, studentChecklist, startPreparedGameBtn,
    assignedGamesList, assignedGamesMessage,
    dailyWordText, dailyWordTheme, dailyWordDifficulty,
  } = elements;
  let words = [];
  let assignedGames = [];
  let students = [];
  const selectedWordIds = new Set();
  const selectedStudentIds = new Set();

  function formatStudent(student) {
    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    return {
      fullName: fullName || student.name || 'Alumno',
      username: student.name || '',
      email: student.email || '',
      searchText: `${fullName} ${student.name || ''} ${student.email || ''}`.toLocaleLowerCase('es'),
    };
  }

  function renderStudents() {
    if (!studentChecklist) return;
    const query = studentFilter?.value.trim().toLocaleLowerCase('es') || '';
    const filtered = students.filter((student) => !query || formatStudent(student).searchText.includes(query));

    studentChecklist.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = students.length ? 'No hay alumnos que coincidan con el filtro.' : 'No hay alumnos registrados.';
      studentChecklist.appendChild(empty);
      return;
    }

    filtered.forEach((student) => {
      const formatted = formatStudent(student);
      const id = String(student.id);
      const row = document.createElement('label');
      row.className = 'student-option';
      row.classList.toggle('selected', selectedStudentIds.has(id));

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selectedStudentIds.has(id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedStudentIds.add(id);
        else selectedStudentIds.delete(id);
        row.classList.toggle('selected', checkbox.checked);
      });

      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = formatted.fullName;
      const meta = document.createElement('small');
      meta.textContent = [formatted.username && `@${formatted.username}`, formatted.email].filter(Boolean).join(' · ');
      text.append(name, meta);
      row.append(checkbox, text);
      studentChecklist.appendChild(row);
    });
  }

  async function loadStudents() {
    if (!studentChecklist) return;
    try {
      const { response, data } = await apiFetch('/api/assignments/students');
      if (!response.ok) return setMessage(gameConfigMessage, data.error || 'No se pudieron cargar los alumnos.');
      students = Array.isArray(data) ? data : [];
      selectedStudentIds.forEach((id) => {
        if (!students.some((student) => String(student.id) === id)) selectedStudentIds.delete(id);
      });
      renderStudents();
    } catch {
      students = [];
      renderStudents();
      setMessage(gameConfigMessage, 'No se pudieron cargar los alumnos.');
    }
  }

  function populateThemes() {
    if (!themeFilter) return;
    const current = themeFilter.value;
    const themes = [...new Set(words.map((item) => item.theme || 'General'))].sort((a, b) => a.localeCompare(b, 'es'));
    themeFilter.innerHTML = '<option value="">Todos los temas</option>';
    themes.forEach((theme) => {
      const option = document.createElement('option');
      option.value = theme;
      option.textContent = theme;
      themeFilter.appendChild(option);
    });
    if (themes.includes(current)) themeFilter.value = current;
  }

  function renderWordBank() {
    if (!teacherWordBank) return;
    const query = wordFilter?.value.trim().toLocaleLowerCase('es') || '';
    const selectedTheme = themeFilter?.value || '';
    const filtered = words.filter((item) =>
      (!query || item.word.toLocaleLowerCase('es').includes(query)) &&
      (!selectedTheme || item.theme === selectedTheme)
    );

    teacherWordBank.innerHTML = '';
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No hay palabras que coincidan con los filtros.';
      teacherWordBank.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'word-chip';
      card.classList.toggle('selected', selectedWordIds.has(String(item.id)));
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.id;
      checkbox.checked = selectedWordIds.has(String(item.id));
      checkbox.setAttribute('aria-label', `Seleccionar ${item.word}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedWordIds.add(String(item.id));
        else selectedWordIds.delete(String(item.id));
        card.classList.toggle('selected', checkbox.checked);
      });
      const name = document.createElement('strong');
      name.textContent = item.word;
      const meta = document.createElement('span');
      meta.textContent = `${item.theme || 'General'} · ${difficultyLabels[item.difficulty]}`;
      const text = document.createElement('div');
      text.append(name, meta);
      card.append(checkbox, text);
      teacherWordBank.appendChild(card);
    });
  }

  function formatStudentName(assignment) {
    const fullName = `${assignment.student_first_name || ''} ${assignment.student_last_name || ''}`.trim();
    return fullName || assignment.student_username || 'Alumno';
  }

  function renderAssignedGames() {
    if (!assignedGamesList) return;
    assignedGamesList.innerHTML = '';

    if (!assignedGames.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Aún no has creado partidas temáticas para alumnos.';
      assignedGamesList.appendChild(empty);
      return;
    }

    assignedGames.forEach((assignment) => {
      const card = document.createElement('article');
      card.className = 'assignment-card';

      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = assignment.theme || 'General';

      const meta = document.createElement('span');
      const current = Number(assignment.current_index || 0);
      const total = Number(assignment.word_count || 0);
      meta.textContent = `${formatStudentName(assignment)} · ${current}/${total} palabras · ${difficultyLabels[assignment.difficulty] || assignment.difficulty} · ${statusLabels[assignment.status] || assignment.status}`;

      const date = document.createElement('small');
      date.textContent = assignment.created_at ? new Date(assignment.created_at).toLocaleString('es-MX') : '';

      content.append(title, meta, date);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'secondary-button danger-button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.addEventListener('click', () => deleteAssignedGame(assignment.id, assignment.theme));

      card.append(content, deleteButton);
      assignedGamesList.appendChild(card);
    });
  }

  async function loadAssignedGames() {
    if (!assignedGamesList) return;
    try {
      const { response, data } = await apiFetch('/api/assignments/teacher');
      if (!response.ok) {
        assignedGames = [];
        renderAssignedGames();
        return setMessage(assignedGamesMessage, data.error || 'No se pudieron cargar las partidas.');
      }
      assignedGames = Array.isArray(data) ? data : [];
      renderAssignedGames();
    } catch {
      assignedGames = [];
      renderAssignedGames();
      setMessage(assignedGamesMessage, 'No se pudo conectar con el servidor.');
    }
  }

  async function deleteAssignedGame(assignmentId, theme) {
    const ok = window.confirm(`¿Eliminar la partida temática "${theme || 'General'}"?`);
    if (!ok) return;

    setMessage(assignedGamesMessage, 'Eliminando partida temática...');
    try {
      const { response, data } = await apiFetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' });
      setMessage(assignedGamesMessage, data.message || data.error);
      if (response.ok) {
        await loadAssignedGames();
      }
    } catch {
      setMessage(assignedGamesMessage, 'No se pudo conectar con el servidor.');
    }
  }

  async function loadDailyWordsOptions() {
    try {
      const { response, data } = await loadWordsForTeacher();
      if (!response.ok) return setMessage(teacherMessage, data.error || 'No se pudo cargar el banco.');
      words = data;
      if (dailyWordSelect) {
        dailyWordSelect.innerHTML = '<option value="">Selecciona una palabra…</option>';
        words.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = `${item.word} · ${item.theme || 'General'} (${difficultyLabels[item.difficulty]})`;
          dailyWordSelect.appendChild(option);
        });
      }
      populateThemes();
      renderWordBank();
      await loadStudents();
      await loadAssignedGames();
      if (typeof onWordsLoaded === 'function') onWordsLoaded(words);
    } catch {
      setMessage(teacherMessage, 'No se pudo conectar con el servidor.');
    }
  }

  async function submitWord() {
    if (!wordForm?.checkValidity()) return wordForm?.reportValidity();
    const { response, data } = await apiFetch('/api/words', {
      method: 'POST',
      body: JSON.stringify({
        word: wordText.value.trim(),
        difficulty: wordDifficulty.value,
        theme: wordTheme?.value.trim() || 'General',
        assignDaily: Boolean(wordAssignDaily?.checked),
      }),
    });
    setMessage(teacherMessage, data.message || data.error);
    if (response.ok) {
      wordText.value = '';
      if (wordAssignDaily) wordAssignDaily.checked = false;
      await loadDailyWordsOptions();
    }
  }

  async function submitDailyWord() {
    const typedWord = dailyWordText?.value.trim() || '';
    const selectedWordId = dailyWordSelect?.value || '';

    if (!selectedWordId && !typedWord) {
      return setMessage(dailyWordMessage, 'Selecciona una palabra o escribe una nueva.');
    }
    if (typedWord && !dailyWordForm?.checkValidity()) return dailyWordForm?.reportValidity();

    const payload = typedWord
      ? {
          word: typedWord,
          theme: dailyWordTheme?.value.trim() || 'General',
          difficulty: dailyWordDifficulty?.value || 'easy',
        }
      : { wordId: selectedWordId };

    const { response, data } = await setDailyWord(payload);
    setMessage(dailyWordMessage, data.message || data.error);
    if (response.ok) {
      if (dailyWordSelect) dailyWordSelect.value = '';
      if (dailyWordText) dailyWordText.value = '';
      await loadDailyWordsOptions();
    }
  }

  async function generateAiWordsForBank() {
    if (!aiWordForm?.checkValidity()) return aiWordForm?.reportValidity();
    const button = aiWordForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Generando…';
    setMessage(aiWordMessage, 'La IA está creando palabras para el banco.');
    try {
      const { response, data } = await apiFetch('/api/words/generate', {
        method: 'POST',
        body: JSON.stringify({
          theme: aiWordTheme.value.trim(),
          count: Number(aiWordCount.value),
          difficulty: aiWordDifficulty.value,
        }),
      });
      if (!response.ok) return setMessage(aiWordMessage, data.error || 'No fue posible generar palabras.');
      const generated = data.words.map((item) => item.word).join(', ');
      setMessage(aiWordMessage, `✓ ${data.message}: ${generated}`);
      if (gameTheme) gameTheme.value = data.theme || aiWordTheme.value.trim();
      await loadDailyWordsOptions();
    } catch {
      setMessage(aiWordMessage, 'No se pudo conectar con el servidor.');
    } finally {
      button.disabled = false;
      button.textContent = 'Generar y guardar palabras';
    }
  }

  async function prepareThemedGame() {
    if (!gameConfigForm?.checkValidity()) return gameConfigForm?.reportValidity();
    const button = gameConfigForm.querySelector('button[type="submit"]');
    const originalButtonText = button.textContent;
    button.disabled = true;
    button.textContent = gameSource.value === 'ai' ? 'Generando con IA…' : 'Preparando…';
    setMessage(gameConfigMessage, 'Estamos preparando la selección de palabras.');
    try {
      const { response, data } = await apiFetch('/api/words/prepare-game', {
        method: 'POST',
        body: JSON.stringify({
          theme: gameTheme.value.trim(),
          count: Number(gameWordCount.value),
          source: gameSource.value,
          difficulty: gameConfigDifficulty.value,
          wordIds: [...selectedWordIds],
        }),
      });
      if (!response.ok) return setMessage(gameConfigMessage, data.error || 'No fue posible preparar la partida.');
      const selected = data.words.map((item) => item.word).join(', ');
      const studentIds = [...selectedStudentIds].map((id) => Number(id));
      if (studentIds.length) {
        const { response: assignmentResponse, data: assignmentData } = await apiFetch('/api/assignments', {
          method: 'POST',
          body: JSON.stringify({
            studentIds,
            wordIds: data.words.map((item) => item.id),
            theme: data.theme,
            difficulty: gameConfigDifficulty.value,
          }),
        });
        if (!assignmentResponse.ok) return setMessage(gameConfigMessage, assignmentData.error || 'No se pudo asignar la partida.');
        localStorage.removeItem('themedGameQueue');
        startPreparedGameBtn?.classList.add('hidden');
        setMessage(gameConfigMessage, `✓ ${assignmentData.message} (${data.words.length} palabras: ${selected})`);
        await loadAssignedGames();
      } else {
        localStorage.setItem('themedGameQueue', JSON.stringify({
          theme: data.theme,
          words: data.words.map((item) => ({ id: item.id, word: item.word, difficulty: item.difficulty })),
          current: 0,
        }));
        startPreparedGameBtn?.classList.remove('hidden');
        setMessage(gameConfigMessage, `✓ ${data.message} Pulsa “Iniciar partida ahora”. Palabras: ${selected}`);
      }
      selectedWordIds.clear();
      selectedStudentIds.clear();
      await loadDailyWordsOptions();
    } catch {
      setMessage(gameConfigMessage, 'No se pudo conectar con el servidor.');
    } finally {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }

  wordForm?.addEventListener('submit', (event) => { event.preventDefault(); submitWord(); });
  aiWordForm?.addEventListener('submit', (event) => { event.preventDefault(); generateAiWordsForBank(); });
  dailyWordForm?.addEventListener('submit', (event) => { event.preventDefault(); submitDailyWord(); });
  gameConfigForm?.addEventListener('submit', (event) => { event.preventDefault(); prepareThemedGame(); });
  wordFilter?.addEventListener('input', renderWordBank);
  studentFilter?.addEventListener('input', renderStudents);
  themeFilter?.addEventListener('change', () => {
    renderWordBank();
    if (themeFilter.value && gameTheme) gameTheme.value = themeFilter.value;
  });
  startPreparedGameBtn?.addEventListener('click', () => {
    if (typeof onStartGame === 'function') onStartGame();
  });

  return { loadDailyWordsOptions, loadStudents, loadAssignedGames };
}
