import {
  createInitialAttempt,
  applyDecision,
  calculateMaxBaseLevel,
  normalizeLevelMaxBase
} from '../engine/scoring.js';
import { announce } from '../engine/a11y.js';

function createEl(doc, tag, className = '', text = '') {
  const el = doc.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== '') {
    el.textContent = text;
  }
  return el;
}

function isSafeHttps(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim());
}

function getExposureMeta(exposure) {
  if (exposure >= 100) {
    return { severity: 'danger', statusText: 'Brecha simulada (100 % — intento fallido)' };
  }
  if (exposure >= 70) {
    return { severity: 'danger', statusText: 'Riesgo crítico: próxima falla puede comprometer el nivel' };
  }
  if (exposure >= 35) {
    return { severity: 'warning', statusText: 'Alerta moderada: refuerza los controles criptográficos' };
  }
  return { severity: 'safe', statusText: 'Exposición controlada' };
}

export function renderGameView(
  container,
  {
    levelNumber,
    levelData,
    minigame,
    getSettings,
    onAttemptFinished,
    onOpenGlossary,
    onNavigate,
    onRetry
  } = {}
) {
  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];
  let destroyed = false;
  let attempt = createInitialAttempt(levelNumber);

  // Temporizador opcional por reto (se detiene antes de mostrar feedback)
  let timerIntervalId = null;
  let decisionStartTime = Date.now();
  let elapsedSeconds = 0;

  function listen(el, eventType, handler) {
    el.addEventListener(eventType, handler);
    cleanups.push(() => el.removeEventListener(eventType, handler));
  }

  function isTimerEnabled() {
    return Boolean(typeof getSettings === 'function' ? getSettings()?.timerEnabled : false);
  }

  const section = createEl(doc, 'section', 'view-game');
  section.setAttribute('aria-labelledby', `game-level-title-${levelNumber}`);

  const headerCard = createEl(doc, 'div', 'card');
  const headerTop = createEl(doc, 'div', 'hud-header');
  const h1 = createEl(doc, 'h1', '', `Nivel ${levelNumber}: ${levelData.title}`);
  h1.id = `game-level-title-${levelNumber}`;

  const backBtn = createEl(doc, 'button', 'btn btn--ghost btn--sm', 'Volver a inicio');
  backBtn.type = 'button';
  listen(backBtn, 'click', () => onNavigate?.('inicio'));
  headerTop.append(h1, backBtn);

  const objBadgeRow = createEl(doc, 'div', 'level-card-meta');
  const objectivesLabel = Array.isArray(levelData.objectiveIds)
    ? levelData.objectiveIds.join(', ')
    : '';
  objBadgeRow.append(
    createEl(doc, 'span', 'badge badge--info', `Objetivos: ${objectivesLabel}`),
    createEl(doc, 'span', 'badge badge--neutral', 'Entorno simulado NovaPay')
  );
  headerCard.append(headerTop, objBadgeRow);
  section.appendChild(headerCard);

  const workspace = createEl(doc, 'div', 'game-workspace');
  const primaryCol = createEl(doc, 'div', 'game-primary');
  const stageContainer = createEl(doc, 'div');
  const feedbackContainer = createEl(doc, 'div');
  const outcomeContainer = createEl(doc, 'div');
  primaryCol.append(stageContainer, feedbackContainer, outcomeContainer);

  // Sidebar HUD
  const sidebar = createEl(doc, 'aside', 'game-sidebar card game-hud');
  sidebar.setAttribute('aria-label', 'Estado de la auditoría del nivel');

  const hudTitle = createEl(doc, 'h2', '', 'Panel de auditoría');

  const statsGrid = createEl(doc, 'div', 'hud-stats');

  const visibleStat = createEl(doc, 'div', 'hud-stat');
  visibleStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Puntaje visible'));
  const visibleValueEl = createEl(doc, 'span', 'hud-stat-value', '0 pts');
  visibleStat.appendChild(visibleValueEl);

  const baseStat = createEl(doc, 'div', 'hud-stat');
  baseStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Puntaje base'));
  const baseValueEl = createEl(doc, 'span', 'hud-stat-value', '0 pts');
  baseStat.appendChild(baseValueEl);

  const streakStat = createEl(doc, 'div', 'hud-stat');
  streakStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Racha actual'));
  const streakValueEl = createEl(doc, 'span', 'hud-stat-value', '0');
  streakStat.appendChild(streakValueEl);

  const bonusStat = createEl(doc, 'div', 'hud-stat');
  bonusStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Bono de tiempo'));
  const bonusValueEl = createEl(doc, 'span', 'hud-stat-value', '+0 pts');
  bonusStat.appendChild(bonusValueEl);

  statsGrid.append(visibleStat, baseStat, streakStat, bonusStat);

  const timerBadge = createEl(doc, 'div', 'timer-badge');
  const timerTextEl = createEl(doc, 'span', '', '');
  timerBadge.appendChild(timerTextEl);

  // Barra de exposición nativa <progress> sin estilos inline
  const exposureBox = createEl(doc, 'div', 'exposure-meter');
  const exposureHeader = createEl(doc, 'div', 'exposure-header');
  const exposureLabel = createEl(doc, 'label', 'exposure-label', 'Exposición de datos');
  exposureLabel.setAttribute('for', `exposure-bar-${levelNumber}`);
  const exposureValueEl = createEl(doc, 'span', 'exposure-value', '0 % / 100 %');
  exposureHeader.append(exposureLabel, exposureValueEl);

  const progressEl = createEl(doc, 'progress', 'exposure-progress');
  progressEl.id = `exposure-bar-${levelNumber}`;
  progressEl.setAttribute('role', 'progressbar');
  progressEl.setAttribute('max', '100');
  progressEl.setAttribute('value', '0');
  progressEl.setAttribute('aria-valuemin', '0');
  progressEl.setAttribute('aria-valuemax', '100');
  progressEl.setAttribute('aria-valuenow', '0');
  progressEl.setAttribute('aria-label', 'Nivel de exposición de datos simulados');
  progressEl.setAttribute('data-severity', 'safe');

  const exposureStatusEl = createEl(doc, 'span', 'exposure-status-text', 'Exposición controlada');
  exposureBox.append(exposureHeader, progressEl, exposureStatusEl);

  const glossaryQuickBtn = createEl(doc, 'button', 'btn btn--secondary btn--block', 'Consultar glosario');
  glossaryQuickBtn.type = 'button';
  listen(glossaryQuickBtn, 'click', () => onOpenGlossary?.({ triggerEl: glossaryQuickBtn }));

  sidebar.append(hudTitle, statsGrid, timerBadge, exposureBox, glossaryQuickBtn);
  workspace.append(primaryCol, sidebar);
  section.appendChild(workspace);
  container.replaceChildren(section);

  function stopTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  }

  function updateTimerDisplay() {
    if (!isTimerEnabled()) {
      timerTextEl.textContent = 'Temporizador: desactivado (sin penalización)';
      return;
    }
    timerTextEl.textContent = `Tiempo del reto: ${elapsedSeconds} s (pausado al leer feedback)`;
  }

  function startDecisionTimer() {
    stopTimer();
    decisionStartTime = Date.now();
    elapsedSeconds = 0;
    updateTimerDisplay();
    if (!isTimerEnabled()) {
      return;
    }
    timerIntervalId = setInterval(() => {
      if (destroyed) {
        stopTimer();
        return;
      }
      elapsedSeconds = Math.floor((Date.now() - decisionStartTime) / 1000);
      updateTimerDisplay();
    }, 1000);
  }

  function syncHud() {
    visibleValueEl.textContent = `${attempt.visibleScore} pts`;
    baseValueEl.textContent = `${attempt.baseScore} pts`;
    streakValueEl.textContent = String(attempt.streak);
    bonusValueEl.textContent = `+${attempt.optionalTimeBonus} pts`;

    const exp = Math.max(0, Math.min(100, Math.round(attempt.exposure)));
    const meta = getExposureMeta(exp);
    exposureValueEl.textContent = `${exp} % / 100 %`;
    progressEl.value = exp;
    progressEl.setAttribute('value', String(exp));
    progressEl.setAttribute('aria-valuenow', String(exp));
    progressEl.setAttribute('aria-valuetext', `${exp} por ciento — ${meta.statusText}`);
    progressEl.setAttribute('data-severity', meta.severity);
    exposureStatusEl.textContent = meta.statusText;
  }

  function renderFailurePanel(payload) {
    const panel = createEl(doc, 'section', 'card level-fail-panel breach-banner');
    panel.setAttribute('aria-labelledby', 'level-fail-title');

    const title = createEl(doc, 'h2', '', 'Exposición máxima alcanzada (100 %)');
    title.id = 'level-fail-title';
    const explanation = createEl(
      doc,
      'p',
      '',
      'Las decisiones riesgosas acumuladas llevaron la exposición al 100 %. Este intento no cuenta para el rango final, pero tu progreso en niveles anteriores se conserva intacto.'
    );

    const actions = createEl(doc, 'div', 'hero-actions');
    const retryBtn = createEl(doc, 'button', 'btn btn--primary', 'Reintentar nivel');
    retryBtn.type = 'button';
    listen(retryBtn, 'click', () => onRetry?.(levelNumber));

    const homeBtn = createEl(doc, 'button', 'btn btn--secondary', 'Volver a inicio');
    homeBtn.type = 'button';
    listen(homeBtn, 'click', () => onNavigate?.('inicio'));

    actions.append(retryBtn, homeBtn);
    panel.append(title, explanation, actions);
    outcomeContainer.replaceChildren(panel);

    const estimatedN = Array.isArray(levelData.challenges)
      ? levelData.challenges.length
      : Math.max(1, attempt.decisions.length);
    onAttemptFinished?.(attempt, calculateMaxBaseLevel(estimatedN));
    announce(
      `Exposición llegó al 100 por ciento en Nivel ${levelNumber}. Puedes reintentar el nivel sin perder tu progreso anterior.`,
      { priority: 'polite' }
    );

    if (payload?.feedback) {
      renderFeedbackPanel(payload, null, { isFailed: true });
    }
  }

  function renderFeedbackPanel(payload, onContinue, { isFailed = false } = {}) {
    const fb = payload?.feedback || {};
    const isCorrect = payload?.isCorrect === true;

    const panel = createEl(
      doc,
      'section',
      `feedback-panel ${isCorrect ? 'feedback-panel--safe' : 'feedback-panel--danger'}`
    );
    panel.setAttribute('aria-labelledby', 'feedback-panel-heading');

    const header = createEl(doc, 'div', 'feedback-header');
    const heading = createEl(
      doc,
      'h2',
      'feedback-title',
      isCorrect ? '✓ Decisión adecuada' : `✕ Riesgo detectado (+${payload?.penaltyOnWrongAnswer ?? 0} % exposición)`
    );
    heading.id = 'feedback-panel-heading';

    const badge = createEl(
      doc,
      'span',
      `badge ${isCorrect ? 'badge--safe' : 'badge--danger'}`,
      isCorrect ? `Racha: ${attempt.streak}` : 'Racha reiniciada'
    );
    header.append(heading, badge);

    const blocks = createEl(doc, 'div', 'feedback-blocks');
    const blockDefs = [
      ['1. Qué podría aprovechar el atacante', fb.attackerView || 'Impacto potencial en el entorno simulado.'],
      ['2. Por qué ocurre', fb.why || 'Causa técnica relacionada con OWASP A04:2025.'],
      ['3. Cómo prevenirlo', fb.correctControl || 'Aplica el control criptográfico recomendado.']
    ];
    for (const [bTitle, bText] of blockDefs) {
      const box = createEl(doc, 'div', 'feedback-block');
      box.append(
        createEl(doc, 'h3', 'feedback-block-title', bTitle),
        createEl(doc, 'p', '', bText)
      );
      blocks.appendChild(box);
    }

    const refs = createEl(doc, 'div', 'feedback-refs');
    if (payload?.glossaryTermId) {
      const termBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', `Ver término en glosario (${payload.glossaryTermId})`);
      termBtn.type = 'button';
      listen(termBtn, 'click', () =>
        onOpenGlossary?.({ triggerEl: termBtn, termId: payload.glossaryTermId })
      );
      refs.appendChild(termBtn);
    }
    if (isSafeHttps(payload?.owaspRef)) {
      const link = createEl(doc, 'a', '', 'Referencia técnica (OWASP / norma)');
      link.setAttribute('href', payload.owaspRef);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      refs.appendChild(link);
    }

    panel.append(header, blocks, refs);

    if (!isFailed && typeof onContinue === 'function') {
      const actions = createEl(doc, 'div', 'feedback-actions');
      const nextBtn = createEl(doc, 'button', 'btn btn--primary', 'Continuar');
      nextBtn.type = 'button';
      listen(nextBtn, 'click', () => {
        feedbackContainer.replaceChildren();
        startDecisionTimer();
        onContinue();
      });
      actions.appendChild(nextBtn);
      panel.appendChild(actions);
    }

    feedbackContainer.replaceChildren(panel);
  }

  function renderCompletionPanel(completionPayload) {
    stopTimer();
    const scorableCount = Number.isInteger(completionPayload?.scorableDecisionsCount) && completionPayload.scorableDecisionsCount > 0
      ? completionPayload.scorableDecisionsCount
      : Math.max(1, attempt.decisions.length);
    const standardDecisions =
      levelNumber === 4 && Array.isArray(levelData.phases) && levelData.phases.length > 0
        ? levelData.phases.length
        : null;
    const maxBaseLevel = normalizeLevelMaxBase(scorableCount, standardDecisions);
    const normalizedBaseScore = Math.min(attempt.baseScore, maxBaseLevel);
    attempt = {
      ...attempt,
      baseScore: normalizedBaseScore,
      visibleScore: normalizedBaseScore + attempt.optionalTimeBonus,
      completed: true
    };
    onAttemptFinished?.(attempt, maxBaseLevel);

    const panel = createEl(doc, 'section', 'card level-complete-panel card--tinted-safe');
    panel.setAttribute('aria-labelledby', 'level-complete-title');

    const title = createEl(doc, 'h2', '', `✓ Nivel ${levelNumber} completado`);
    title.id = 'level-complete-title';

    const summaryText = createEl(
      doc,
      'p',
      '',
      completionPayload?.summary || `Completaste la auditoría del Nivel ${levelNumber}.`
    );

    const statsLine = createEl(
      doc,
      'p',
      'text-muted',
      `Puntaje base: ${attempt.baseScore} / ${maxBaseLevel} pts · Puntaje visible: ${attempt.visibleScore} pts · Exposición final: ${attempt.exposure} %`
    );

    const actions = createEl(doc, 'div', 'hero-actions');
    const nextRoute = levelNumber < 4 ? `nivel-${levelNumber + 1}` : 'quiz-post';
    const nextLabel = levelNumber < 4 ? `Avanzar al Nivel ${levelNumber + 1}` : 'Ir al test posterior';
    const nextBtn = createEl(doc, 'button', 'btn btn--primary', nextLabel);
    nextBtn.type = 'button';
    listen(nextBtn, 'click', () => onNavigate?.(nextRoute));

    const retryBtn = createEl(doc, 'button', 'btn btn--secondary', 'Reintentar nivel');
    retryBtn.type = 'button';
    listen(retryBtn, 'click', () => onRetry?.(levelNumber));

    const homeBtn = createEl(doc, 'button', 'btn btn--ghost', 'Volver a inicio');
    homeBtn.type = 'button';
    listen(homeBtn, 'click', () => onNavigate?.('inicio'));

    actions.append(nextBtn, retryBtn, homeBtn);
    panel.append(title, summaryText, statsLine, actions);
    outcomeContainer.replaceChildren(panel);
    announce(`Nivel ${levelNumber} completado con ${attempt.baseScore} puntos base.`);
  }

  syncHud();
  startDecisionTimer();

  minigame.mount(stageContainer, levelData, {
    onDecision(payload, onContinue) {
      if (destroyed || attempt.failed) {
        return;
      }
      stopTimer();
      const elapsedMs = Math.max(0, Date.now() - decisionStartTime);
      attempt = applyDecision(attempt, {
        isCorrect: payload.isCorrect,
        penaltyOnWrongAnswer: payload.penaltyOnWrongAnswer,
        objectiveId: payload.objectiveId,
        timerEnabled: isTimerEnabled(),
        elapsedMs,
        challengeId: payload.challengeId,
        title: payload.title,
        glossaryTermId: payload.glossaryTermId,
        correctControl: payload.feedback?.correctControl
      });
      syncHud();

      if (attempt.failed) {
        renderFailurePanel(payload);
        return;
      }

      renderFeedbackPanel(payload, onContinue, { isFailed: false });
      announce(
        payload.isCorrect
          ? `Decisión correcta. Puntaje base: ${attempt.baseScore}.`
          : `Decisión riesgosa. Exposición actual: ${attempt.exposure} por ciento.`
      );
    },
    onLevelComplete(summary) {
      if (destroyed || attempt.failed) {
        return;
      }
      renderCompletionPanel(summary);
    },
    onOpenGlossary(termId) {
      onOpenGlossary?.({ termId });
    },
    onStatusAnnounce(message) {
      announce(message);
    }
  });

  return () => {
    destroyed = true;
    stopTimer();
    try {
      minigame?.destroy?.();
    } catch {
      // Limpieza defensiva
    }
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };
}
