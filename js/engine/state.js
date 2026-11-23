import { OBJECTIVES } from './scoring.js';

export const STORAGE_KEY = 'alerta_de_fuga_progress_v1';
export const STATE_VERSION = 1;

const OBJECTIVE_SET = new Set(OBJECTIVES);
const LEVEL_KEYS = ['1', '2', '3', '4'];
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function safeJsonReviver(key, value) {
  if (POLLUTION_KEYS.has(key)) {
    return undefined;
  }
  return value;
}

function isNonNegativeInt(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonNegativeFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function cloneState(state) {
  return {
    version: STATE_VERSION,
    unlockedLevel: state.unlockedLevel,
    settings: {
      timerEnabled: Boolean(state.settings.timerEnabled),
      reducedMotion: Boolean(state.settings.reducedMotion)
    },
    preQuiz: {
      completed: Boolean(state.preQuiz.completed),
      skipped: Boolean(state.preQuiz.skipped),
      score: state.preQuiz.score,
      total: state.preQuiz.total,
      decisions: state.preQuiz.decisions.map((d) => ({
        questionId: d.questionId,
        objectiveId: d.objectiveId,
        selectedOptionId: d.selectedOptionId,
        isCorrect: Boolean(d.isCorrect)
      }))
    },
    levels: {
      1: cloneLevelEntry(state.levels[1]),
      2: cloneLevelEntry(state.levels[2]),
      3: cloneLevelEntry(state.levels[3]),
      4: cloneLevelEntry(state.levels[4])
    },
    postQuiz: {
      completed: Boolean(state.postQuiz.completed),
      score: state.postQuiz.score,
      total: state.postQuiz.total,
      decisions: state.postQuiz.decisions.map((d) => ({
        questionId: d.questionId,
        objectiveId: d.objectiveId,
        selectedOptionId: d.selectedOptionId,
        isCorrect: Boolean(d.isCorrect)
      }))
    }
  };
}

function cloneDecisionItem(d) {
  const entry = {
    objectiveId: d.objectiveId,
    isCorrect: Boolean(d.isCorrect)
  };
  if (typeof d.challengeId === 'string' && d.challengeId) entry.challengeId = d.challengeId;
  if (typeof d.title === 'string' && d.title) entry.title = d.title;
  if (typeof d.glossaryTermId === 'string' && d.glossaryTermId) entry.glossaryTermId = d.glossaryTermId;
  if (typeof d.correctControl === 'string' && d.correctControl) entry.correctControl = d.correctControl;
  return entry;
}

function cloneLevelEntry(entry) {
  return {
    attemptsCount: entry.attemptsCount,
    bestBaseScore: entry.bestBaseScore,
    bestVisibleScore: entry.bestVisibleScore,
    acceptedAttempt: entry.acceptedAttempt
      ? {
        levelId: entry.acceptedAttempt.levelId,
        baseScore: entry.acceptedAttempt.baseScore,
        optionalTimeBonus: entry.acceptedAttempt.optionalTimeBonus,
        visibleScore: entry.acceptedAttempt.visibleScore,
        maxBaseLevel: entry.acceptedAttempt.maxBaseLevel,
        streak: entry.acceptedAttempt.streak,
        exposure: entry.acceptedAttempt.exposure,
        failed: false,
        completed: true,
        decisions: entry.acceptedAttempt.decisions.map(cloneDecisionItem)
      }
      : null
  };
}

function sanitizeLevelDecisions(rawDecisions) {
  if (!Array.isArray(rawDecisions)) {
    return null;
  }
  const sanitized = [];
  for (const item of rawDecisions) {
    if (!isPlainObject(item) || !hasOwn(item, 'objectiveId') || !hasOwn(item, 'isCorrect')) {
      return null;
    }
    if (!OBJECTIVE_SET.has(item.objectiveId) || typeof item.isCorrect !== 'boolean') {
      return null;
    }
    const clean = {
      objectiveId: item.objectiveId,
      isCorrect: item.isCorrect
    };
    if (hasOwn(item, 'challengeId') && typeof item.challengeId === 'string' && item.challengeId.trim()) {
      clean.challengeId = item.challengeId.trim().slice(0, 64);
    }
    if (hasOwn(item, 'title') && typeof item.title === 'string' && item.title.trim()) {
      clean.title = item.title.trim().slice(0, 160);
    }
    if (hasOwn(item, 'glossaryTermId') && typeof item.glossaryTermId === 'string' && item.glossaryTermId.trim()) {
      clean.glossaryTermId = item.glossaryTermId.trim().slice(0, 64);
    }
    if (hasOwn(item, 'correctControl') && typeof item.correctControl === 'string' && item.correctControl.trim()) {
      clean.correctControl = item.correctControl.trim().slice(0, 320);
    }
    sanitized.push(clean);
  }
  return sanitized;
}

function sanitizeQuizDecisions(rawDecisions) {
  if (!Array.isArray(rawDecisions)) {
    return null;
  }
  if (rawDecisions.length > 5) {
    return null;
  }
  const sanitized = [];
  for (const item of rawDecisions) {
    if (!isPlainObject(item)) {
      return null;
    }
    const objectiveId = hasOwn(item, 'objectiveId') ? item.objectiveId : null;
    const isCorrect = hasOwn(item, 'isCorrect') ? item.isCorrect : null;
    if (!OBJECTIVE_SET.has(objectiveId) || typeof isCorrect !== 'boolean') {
      return null;
    }
    const questionId = hasOwn(item, 'questionId') && typeof item.questionId === 'string'
      ? item.questionId.slice(0, 64)
      : '';
    const selectedOptionId = hasOwn(item, 'selectedOptionId') && typeof item.selectedOptionId === 'string'
      ? item.selectedOptionId.slice(0, 64)
      : '';
    sanitized.push({
      questionId,
      objectiveId,
      selectedOptionId,
      isCorrect
    });
  }
  return sanitized;
}

function sanitizeAcceptedAttempt(rawAttempt, expectedLevelId) {
  if (rawAttempt === null || rawAttempt === undefined) {
    return null;
  }
  if (!isPlainObject(rawAttempt)) {
    return undefined;
  }
  if (rawAttempt.completed === false || rawAttempt.failed === true) {
    return undefined;
  }
  const exposure = hasOwn(rawAttempt, 'exposure') ? rawAttempt.exposure : 0;
  const optionalTimeBonus = hasOwn(rawAttempt, 'optionalTimeBonus') ? rawAttempt.optionalTimeBonus : 0;
  const streak = hasOwn(rawAttempt, 'streak') ? rawAttempt.streak : 0;
  const baseScore = rawAttempt.baseScore;
  const visibleScore = hasOwn(rawAttempt, 'visibleScore')
    ? rawAttempt.visibleScore
    : (isNonNegativeFinite(baseScore) ? baseScore + (isNonNegativeFinite(optionalTimeBonus) ? optionalTimeBonus : 0) : undefined);
  const maxBaseLevel = rawAttempt.maxBaseLevel;

  if (
    !isNonNegativeFinite(exposure) ||
    exposure >= 100 ||
    !isNonNegativeFinite(baseScore) ||
    !isNonNegativeFinite(optionalTimeBonus) ||
    !isNonNegativeFinite(visibleScore) ||
    !isNonNegativeFinite(maxBaseLevel) ||
    maxBaseLevel <= 0 ||
    !isNonNegativeInt(streak)
  ) {
    return undefined;
  }
  const levelId = hasOwn(rawAttempt, 'levelId') && Number.isInteger(rawAttempt.levelId)
    ? rawAttempt.levelId
    : expectedLevelId;
  if (levelId !== expectedLevelId) {
    return undefined;
  }
  const decisions = hasOwn(rawAttempt, 'decisions')
    ? sanitizeLevelDecisions(rawAttempt.decisions)
    : [];
  if (decisions === null) {
    return undefined;
  }
  return {
    levelId,
    baseScore,
    optionalTimeBonus,
    visibleScore,
    maxBaseLevel,
    streak,
    exposure,
    failed: false,
    completed: true,
    decisions
  };
}

export function safeGetLocalStorage() {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
      return null;
    }
    const storage = globalThis.localStorage;
    if (
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function' ||
      typeof storage.removeItem !== 'function'
    ) {
      return null;
    }
    const probeKey = '__adf_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

export function createDefaultState() {
  return {
    version: STATE_VERSION,
    unlockedLevel: 1,
    settings: {
      timerEnabled: false,
      reducedMotion: false
    },
    preQuiz: {
      completed: false,
      skipped: false,
      score: 0,
      total: 5,
      decisions: []
    },
    levels: {
      1: { attemptsCount: 0, bestBaseScore: 0, bestVisibleScore: 0, acceptedAttempt: null },
      2: { attemptsCount: 0, bestBaseScore: 0, bestVisibleScore: 0, acceptedAttempt: null },
      3: { attemptsCount: 0, bestBaseScore: 0, bestVisibleScore: 0, acceptedAttempt: null },
      4: { attemptsCount: 0, bestBaseScore: 0, bestVisibleScore: 0, acceptedAttempt: null }
    },
    postQuiz: {
      completed: false,
      score: 0,
      total: 5,
      decisions: []
    }
  };
}

export function validateAndSanitizeState(rawInput) {
  if (!isPlainObject(rawInput) || rawInput.version !== STATE_VERSION) {
    return null;
  }

  if (
    !hasOwn(rawInput, 'unlockedLevel') ||
    !Number.isInteger(rawInput.unlockedLevel) ||
    rawInput.unlockedLevel < 1 ||
    rawInput.unlockedLevel > 4
  ) {
    return null;
  }

  if (!hasOwn(rawInput, 'settings') || !isPlainObject(rawInput.settings)) {
    return null;
  }
  const rawSettings = rawInput.settings;
  if (typeof rawSettings.timerEnabled !== 'boolean' || typeof rawSettings.reducedMotion !== 'boolean') {
    return null;
  }

  let preQuiz = {
    completed: false,
    skipped: false,
    score: 0,
    total: 5,
    decisions: []
  };
  if (hasOwn(rawInput, 'preQuiz')) {
    if (!isPlainObject(rawInput.preQuiz)) {
      return null;
    }
    const rawPre = rawInput.preQuiz;
    const preScore = hasOwn(rawPre, 'score') ? rawPre.score : 0;
    const preTotal = hasOwn(rawPre, 'total') ? rawPre.total : 5;
    if (
      typeof rawPre.completed !== 'boolean' ||
      (hasOwn(rawPre, 'skipped') && typeof rawPre.skipped !== 'boolean') ||
      !Number.isInteger(preScore) ||
      preScore < 0 ||
      preScore > 5 ||
      preTotal !== 5
    ) {
      return null;
    }
    const preDecisions = hasOwn(rawPre, 'decisions')
      ? sanitizeQuizDecisions(rawPre.decisions)
      : [];
    if (preDecisions === null) {
      return null;
    }
    preQuiz = {
      completed: rawPre.completed,
      skipped: Boolean(rawPre.skipped),
      score: preScore,
      total: 5,
      decisions: preDecisions
    };
  }

  let postQuiz = {
    completed: false,
    score: 0,
    total: 5,
    decisions: []
  };
  if (hasOwn(rawInput, 'postQuiz')) {
    if (!isPlainObject(rawInput.postQuiz)) {
      return null;
    }
    const rawPost = rawInput.postQuiz;
    const postScore = hasOwn(rawPost, 'score') ? rawPost.score : 0;
    const postTotal = hasOwn(rawPost, 'total') ? rawPost.total : 5;
    if (
      typeof rawPost.completed !== 'boolean' ||
      !Number.isInteger(postScore) ||
      postScore < 0 ||
      postScore > 5 ||
      postTotal !== 5
    ) {
      return null;
    }
    const postDecisions = hasOwn(rawPost, 'decisions')
      ? sanitizeQuizDecisions(rawPost.decisions)
      : [];
    if (postDecisions === null) {
      return null;
    }
    postQuiz = {
      completed: rawPost.completed,
      score: postScore,
      total: 5,
      decisions: postDecisions
    };
  }

  const levels = {};
  if (hasOwn(rawInput, 'levels') && !isPlainObject(rawInput.levels)) {
    return null;
  }
  const rawLevels = isPlainObject(rawInput.levels) ? rawInput.levels : {};
  for (const key of LEVEL_KEYS) {
    const levelNumber = Number(key);
    if (!hasOwn(rawLevels, key)) {
      levels[levelNumber] = {
        attemptsCount: 0,
        bestBaseScore: 0,
        bestVisibleScore: 0,
        acceptedAttempt: null
      };
      continue;
    }
    if (!isPlainObject(rawLevels[key])) {
      return null;
    }
    const rawLevel = rawLevels[key];
    const attemptsCount = hasOwn(rawLevel, 'attemptsCount') ? rawLevel.attemptsCount : (rawLevel.acceptedAttempt ? 1 : 0);
    const bestBaseScore = hasOwn(rawLevel, 'bestBaseScore') ? rawLevel.bestBaseScore : 0;
    const bestVisibleScore = hasOwn(rawLevel, 'bestVisibleScore') ? rawLevel.bestVisibleScore : bestBaseScore;
    if (
      !isNonNegativeInt(attemptsCount) ||
      !isNonNegativeFinite(bestBaseScore) ||
      !isNonNegativeFinite(bestVisibleScore)
    ) {
      return null;
    }
    const acceptedAttempt = hasOwn(rawLevel, 'acceptedAttempt')
      ? sanitizeAcceptedAttempt(rawLevel.acceptedAttempt, levelNumber)
      : null;
    if (acceptedAttempt === undefined) {
      return null;
    }
    levels[levelNumber] = {
      attemptsCount,
      bestBaseScore,
      bestVisibleScore,
      acceptedAttempt
    };
  }

  return {
    version: STATE_VERSION,
    unlockedLevel: rawInput.unlockedLevel,
    settings: {
      timerEnabled: rawSettings.timerEnabled,
      reducedMotion: rawSettings.reducedMotion
    },
    preQuiz,
    levels,
    postQuiz
  };
}

export function isLevelCompleted(state, levelNumber) {
  if (!state || typeof state !== 'object' || !Number.isInteger(levelNumber)) {
    return false;
  }
  const accepted = state.levels?.[levelNumber]?.acceptedAttempt;
  return Boolean(accepted && accepted.completed === true && accepted.failed !== true);
}

function buildSanitizedQuizSubmission(result) {
  if (!isPlainObject(result)) {
    throw new TypeError('El resultado del cuestionario debe ser un objeto válido.');
  }
  const rawDecisions = Array.isArray(result.decisions) ? result.decisions : [];
  const decisions = [];
  for (const item of rawDecisions.slice(0, 5)) {
    if (!isPlainObject(item) || !OBJECTIVE_SET.has(item.objectiveId)) {
      continue;
    }
    decisions.push({
      questionId: typeof item.questionId === 'string' ? item.questionId.slice(0, 64) : '',
      objectiveId: item.objectiveId,
      selectedOptionId: typeof item.selectedOptionId === 'string' ? item.selectedOptionId.slice(0, 64) : '',
      isCorrect: Boolean(item.isCorrect)
    });
  }
  const computedScore = decisions.filter((d) => d.isCorrect).length;
  const rawScore = Number.isInteger(result.score) ? result.score : computedScore;
  const score = Math.max(0, Math.min(5, rawScore));

  return {
    score,
    total: 5,
    decisions
  };
}

export function createStateStore(storage = safeGetLocalStorage()) {
  let memoryFallback = !storage ||
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function';
  let state = createDefaultState();
  const listeners = new Set();

  function persist() {
    if (memoryFallback) {
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      memoryFallback = true;
      return false;
    }
  }

  function notify() {
    const snapshot = cloneState(state);
    for (const listener of [...listeners]) {
      listener(snapshot);
    }
  }

  if (!memoryFallback) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (typeof raw === 'string' && raw.length > 0) {
        const parsed = JSON.parse(raw, safeJsonReviver);
        const sanitized = validateAndSanitizeState(parsed);
        if (sanitized) {
          state = sanitized;
        } else {
          state = createDefaultState();
          persist();
        }
      }
    } catch {
      if (state.version !== STATE_VERSION) {
        state = createDefaultState();
      }
      // If getItem threw SecurityError, degrade cleanly to memory; if JSON.parse threw, reset persisted state.
      try {
        storage.getItem(STORAGE_KEY);
        state = createDefaultState();
        persist();
      } catch {
        memoryFallback = true;
        state = createDefaultState();
      }
    }
  }

  return {
    isMemoryFallback() {
      return memoryFallback;
    },

    getState() {
      return cloneState(state);
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new TypeError('El suscriptor debe ser una función.');
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    updateSettings({ timerEnabled, reducedMotion } = {}) {
      if (typeof timerEnabled === 'boolean') {
        state.settings.timerEnabled = timerEnabled;
      }
      if (typeof reducedMotion === 'boolean') {
        state.settings.reducedMotion = reducedMotion;
      }
      persist();
      notify();
      return cloneState(state);
    },

    recordPreQuiz(result) {
      const clean = buildSanitizedQuizSubmission(result);
      state.preQuiz = {
        completed: true,
        skipped: false,
        score: clean.score,
        total: 5,
        decisions: clean.decisions
      };
      persist();
      notify();
      return cloneState(state);
    },

    skipPreQuiz() {
      state.preQuiz = {
        completed: false,
        skipped: true,
        score: 0,
        total: 5,
        decisions: []
      };
      persist();
      notify();
      return cloneState(state);
    },

    recordPostQuiz(result) {
      const clean = buildSanitizedQuizSubmission(result);
      state.postQuiz = {
        completed: true,
        score: clean.score,
        total: 5,
        decisions: clean.decisions
      };
      persist();
      notify();
      return cloneState(state);
    },

    recordLevelAttemptResult(levelNumber, attemptRecord, maxBaseLevel) {
      if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 4) {
        throw new RangeError('Número de nivel inválido; debe estar entre 1 y 4.');
      }
      if (!isPlainObject(attemptRecord)) {
        throw new TypeError('El registro del intento debe ser un objeto válido.');
      }

      const currentEntry = state.levels[levelNumber];
      currentEntry.attemptsCount += 1;

      const exposure = isNonNegativeFinite(attemptRecord.exposure)
        ? attemptRecord.exposure
        : 0;
      const isFailedOrIncomplete =
        attemptRecord.failed === true ||
        exposure >= 100 ||
        attemptRecord.completed !== true;

      if (isFailedOrIncomplete) {
        persist();
        notify();
        return cloneState(state);
      }

      if (!isNonNegativeFinite(maxBaseLevel) || maxBaseLevel <= 0) {
        throw new RangeError('maxBaseLevel debe ser un número finito positivo.');
      }

      const baseScore = isNonNegativeFinite(attemptRecord.baseScore) ? attemptRecord.baseScore : 0;
      const optionalTimeBonus = isNonNegativeFinite(attemptRecord.optionalTimeBonus)
        ? attemptRecord.optionalTimeBonus
        : 0;
      const visibleScore = isNonNegativeFinite(attemptRecord.visibleScore)
        ? attemptRecord.visibleScore
        : baseScore + optionalTimeBonus;
      const streak = isNonNegativeInt(attemptRecord.streak) ? attemptRecord.streak : 0;
      const sanitizedDecisions = Array.isArray(attemptRecord.decisions)
        ? attemptRecord.decisions
          .filter((d) => isPlainObject(d) && OBJECTIVE_SET.has(d.objectiveId))
          .map((d) => {
            const clean = {
              objectiveId: d.objectiveId,
              isCorrect: Boolean(d.isCorrect)
            };
            if (typeof d.challengeId === 'string' && d.challengeId.trim()) {
              clean.challengeId = d.challengeId.trim().slice(0, 64);
            }
            if (typeof d.title === 'string' && d.title.trim()) {
              clean.title = d.title.trim().slice(0, 160);
            }
            if (typeof d.glossaryTermId === 'string' && d.glossaryTermId.trim()) {
              clean.glossaryTermId = d.glossaryTermId.trim().slice(0, 64);
            }
            if (typeof d.correctControl === 'string' && d.correctControl.trim()) {
              clean.correctControl = d.correctControl.trim().slice(0, 320);
            }
            return clean;
          })
        : [];

      currentEntry.bestBaseScore = Math.max(currentEntry.bestBaseScore, baseScore);
      currentEntry.bestVisibleScore = Math.max(currentEntry.bestVisibleScore, visibleScore);
      currentEntry.acceptedAttempt = {
        levelId: levelNumber,
        baseScore,
        optionalTimeBonus,
        visibleScore,
        maxBaseLevel,
        streak,
        exposure,
        failed: false,
        completed: true,
        decisions: sanitizedDecisions
      };

      state.unlockedLevel = Math.min(4, Math.max(state.unlockedLevel, levelNumber + 1));

      persist();
      notify();
      return cloneState(state);
    },

    resetProgress({ preserveSettings = true } = {}) {
      const prevSettings = {
        timerEnabled: state.settings.timerEnabled,
        reducedMotion: state.settings.reducedMotion
      };
      state = createDefaultState();
      if (preserveSettings !== false) {
        state.settings = prevSettings;
      }
      persist();
      notify();
      return cloneState(state);
    },

    isLevelCompleted(levelNumber) {
      return isLevelCompleted(state, levelNumber);
    }
  };
}
