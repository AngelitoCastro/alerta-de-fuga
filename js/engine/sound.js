// Preferencia de sonido separada (alerta_de_fuga_sound_v1) para mantener
// compatibilidad estricta con el contrato de state.settings ({ timerEnabled, reducedMotion })
// y con los estados guardados previamente en alerta_de_fuga_progress_v1.
export const SOUND_STORAGE_KEY = 'alerta_de_fuga_sound_v1';

let soundEnabled = false;
let audioCtx = null;
const listeners = new Set();

function readStoredPreference(storage = globalThis.localStorage) {
  try {
    if (!storage || typeof storage.getItem !== 'function') {
      return false;
    }
    return storage.getItem(SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredPreference(enabled, storage = globalThis.localStorage) {
  try {
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    storage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Degradación silenciosa a memoria si localStorage no está disponible
  }
}

function getAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (typeof Ctor !== 'function') {
    return null;
  }
  try {
    if (!audioCtx) {
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playNotes(notes) {
  if (!soundEnabled) {
    return false;
  }
  const ctx = getAudioContext();
  if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
    return false;
  }
  try {
    const startBase = ctx.currentTime;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, startBase + note.offset);

      gain.gain.setValueAtTime(0.0001, startBase + note.offset);
      gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.08, startBase + note.offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startBase + note.offset + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startBase + note.offset);
      osc.stop(startBase + note.offset + note.duration + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

function notify() {
  for (const listener of [...listeners]) {
    try {
      listener(soundEnabled);
    } catch {
      // Aislamiento defensivo
    }
  }
}

export function initSound(storage = globalThis.localStorage) {
  soundEnabled = readStoredPreference(storage);
  notify();
  return soundEnabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled, storage = globalThis.localStorage) {
  soundEnabled = Boolean(enabled);
  writeStoredPreference(soundEnabled, storage);
  if (soundEnabled) {
    // Inicializar AudioContext bajo gesto explícito del usuario
    getAudioContext();
  }
  notify();
  return soundEnabled;
}

export function toggleSound(storage = globalThis.localStorage) {
  return setSoundEnabled(!soundEnabled, storage);
}

export function subscribeSound(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Primera iteración (P2): únicamente acierto, error y nivel completado
export function playCorrect() {
  return playNotes([
    { freq: 523.25, offset: 0, duration: 0.11, type: 'sine', volume: 0.07 },
    { freq: 659.25, offset: 0.09, duration: 0.14, type: 'sine', volume: 0.07 }
  ]);
}

export function playError() {
  return playNotes([
    { freq: 240, offset: 0, duration: 0.14, type: 'triangle', volume: 0.08 },
    { freq: 185, offset: 0.11, duration: 0.16, type: 'triangle', volume: 0.07 }
  ]);
}

export function playLevelComplete() {
  return playNotes([
    { freq: 523.25, offset: 0, duration: 0.12, type: 'sine', volume: 0.07 },
    { freq: 659.25, offset: 0.1, duration: 0.12, type: 'sine', volume: 0.07 },
    { freq: 783.99, offset: 0.2, duration: 0.2, type: 'sine', volume: 0.08 }
  ]);
}
