export function createSoundEngine() {
  let context;
  function tone(frequency, duration, type = 'sine', volume = 0.05, delay = 0) {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration);
    } catch {
      // El juego sigue funcionando en navegadores sin Web Audio.
    }
  }

  return {
    correct() { tone(520, 0.12); tone(720, 0.16, 'sine', 0.05, 0.08); },
    wrong() { tone(180, 0.2, 'sawtooth', 0.035); },
    win() { [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.28, 'sine', 0.05, index * 0.11)); },
    lose() { [330, 277, 220].forEach((frequency, index) => tone(frequency, 0.3, 'triangle', 0.045, index * 0.14)); },
  };
}

export function celebrate() {
  const colors = ['#8587ff', '#b078ff', '#5ee7a8', '#ffd166', '#ff7a9c'];
  for (let index = 0; index < 55; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.setProperty('--fall-delay', `${Math.random() * 0.35}s`);
    piece.style.setProperty('--fall-time', `${1.8 + Math.random() * 1.5}s`);
    piece.style.background = colors[index % colors.length];
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}
