import {
  createInitialAttempt,
  applyDecision,
  calculateMaxBaseLevel,
  normalizeLevelMaxBase,
  getDecisionDelta
} from '../engine/scoring.js';
import { announce } from '../engine/a11y.js';
import { playCorrect, playError, playLevelComplete } from '../engine/sound.js';

const MISSION_COPY = Object.freeze({
  1: {
    intro: 'Fase 1 de 4 · Inspección de tráfico: identifica comunicaciones potencialmente inseguras antes de que expongan credenciales o pagos.',
    nextTransition: 'Encontramos comunicaciones vulnerables. Ahora revisa qué datos podrían quedar expuestos en la bóveda.'
  },
  2: {
    intro: 'Fase 2 de 4 · Protección de datos: decide qué registros deben hashearse, cifrarse con AES-GCM, tokenizarse o eliminarse.',
    nextTransition: 'Los registros revelan configuraciones riesgosas. Busca el origen en el repositorio de NovaPay.'
  },
  3: {
    intro: 'Fase 3 de 4 · Auditoría de código: marca la línea vulnerable y selecciona la corrección adecuada en cada archivo ficticio.',
    nextTransition: 'La exposición se convirtió en incidente. Coordina la contención y respuesta en seis fases.'
  },
  4: {
    intro: 'Fase 4 de 4 · Respuesta al incidente: toma decisiones ramificadas y observa sus consecuencias en la línea de tiempo.',
    nextTransition: 'El simulacro terminó. Completa el test posterior para ver tu informe de misión y guía de repaso.'
  }
});

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
    return { severity: 'danger', statusText: 'Riesgo crítico: un fallo más comprometerá el nivel' };
  }
  if (exposure >= 35) {
    return { severity: 'warning', statusText: 'Alerta moderada: refuerza los controles criptográficos' };
  }
  return { severity: 'safe', statusText: 'Exposición controlada' };
}

function getContainmentGrade(exposure) {
  if (exposure <= 25) {
    return {
      cardClass: 'card--tinted-safe',
      badgeClass: 'badge--safe',
      label: '✓ Contención limpia',
      note: 'Excelente control criptográfico: la fuga quedó contenida con amplio margen de seguridad.',
      recommendRetry: false
    };
  }
  if (exposure < 60) {
    return {
      cardClass: 'card--tinted-warning',
      badgeClass: 'badge--warning',
      label: '⚠ Contención con alertas',
      note: 'Superaste esta fase, pero las fallas acumuladas dejaron alertas abiertas. Puedes avanzar o reintentar para mejorar tu puntuación base.',
      recommendRetry: false
    };
  }
  return {
    cardClass: 'card--tinted-warning',
    badgeClass: 'badge--danger',
    label: '! Contención al límite — Reintento recomendado',
    note: 'Evitaste por poco el colapso total (100 % de exposición). Se recomienda reintentar este capítulo antes de continuar para afianzar el criterio técnico.',
    recommendRetry: true
  };
}

function formatStreakDots(streak) {
  const mod = streak % 3;
  const filled = streak > 0 && mod === 0 ? 3 : mod;
  return `${'●'.repeat(filled)}${'○'.repeat(3 - filled)}`;
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

  const mission = MISSION_COPY[levelNumber] || {
    intro: `Nivel ${levelNumber}: completa la auditoría criptográfica de NovaPay.`,
    nextTransition: ''
  };

  const section = createEl(doc, 'section', 'view-game');
  section.setAttribute('aria-labelledby', `game-level-title-${levelNumber}`);

  const headerCard = createEl(doc, 'div', 'card level-header-card');
  const headerTop = createEl(doc, 'div', 'hud-header');
  const h1 = createEl(doc, 'h1', '', `Nivel ${levelNumber}: ${levelData.title}`);
  h1.id = `game-level-title-${levelNumber}`;

  const backBtn = createEl(doc, 'button', 'btn btn--ghost btn--sm', 'Volver a inicio');
  backBtn.type = 'button';
  listen(backBtn, 'click', () => onNavigate?.('inicio'));
  headerTop.append(h1, backBtn);

  const missionIntroEl = createEl(doc, 'p', 'text-muted', mission.intro);

  const objBadgeRow = createEl(doc, 'div', 'level-card-meta');
  const objectivesLabel = Array.isArray(levelData.objectiveIds)
    ? levelData.objectiveIds.join(', ')
    : '';
  objBadgeRow.append(
    createEl(doc, 'span', 'badge badge--info', `Objetivos: ${objectivesLabel}`),
    createEl(doc, 'span', 'badge badge--neutral', 'Operación Contener la Fuga · NovaPay')
  );
  headerCard.append(headerTop, missionIntroEl, objBadgeRow);
  section.appendChild(headerCard);

  const workspace = createEl(doc, 'div', 'game-workspace');
  const primaryCol = createEl(doc, 'div', 'game-primary');
  const feedbackContainer = createEl(doc, 'div');
  const outcomeContainer = createEl(doc, 'div');
  const stageContainer = createEl(doc, 'div');
  // Veredicto/resultado inmediatamente visibles arriba del escenario al decidir (sin exigir scroll largo)
  primaryCol.append(outcomeContainer, feedbackContainer, stageContainer);

  // HUD único y responsive (sticky compacto en móvil <1024px, sidebar en escritorio >=1024px)
  const sidebar = createEl(doc, 'aside', 'game-sidebar card game-hud');
  sidebar.setAttribute('aria-label', 'Estado de la auditoría del nivel');

  const hudHeadingRow = createEl(doc, 'div', 'hud-heading-row');
  hudHeadingRow.appendChild(createEl(doc, 'h2', '', 'Panel de auditoría'));

  const statsGrid = createEl(doc, 'div', 'hud-stats');

  const visibleStat = createEl(doc, 'div', 'hud-stat hud-stat--points');
  visibleStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Puntos'));
  const visibleValueEl = createEl(doc, 'span', 'hud-stat-value', '0 pts');
  visibleStat.appendChild(visibleValueEl);

  const streakStat = createEl(doc, 'div', 'hud-stat hud-stat--streak');
  streakStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Racha'));
  const streakValueEl = createEl(doc, 'span', 'hud-stat-value', '0 ○○○');
  streakStat.appendChild(streakValueEl);

  const progressStat = createEl(doc, 'div', 'hud-stat');
  progressStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Avance'));
  const progressValueEl = createEl(doc, 'span', 'hud-stat-value', '1/?');
  progressStat.appendChild(progressValueEl);

  const baseStat = createEl(doc, 'div', 'hud-stat hud-secondary-stat');
  baseStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Puntaje base'));
  const baseValueEl = createEl(doc, 'span', 'hud-stat-value', '0 pts');
  baseStat.appendChild(baseValueEl);

  const bonusStat = createEl(doc, 'div', 'hud-stat hud-secondary-stat');
  bonusStat.appendChild(createEl(doc, 'span', 'hud-stat-label', 'Bono de tiempo'));
  const bonusValueEl = createEl(doc, 'span', 'hud-stat-value', '+0 pts');
  bonusStat.appendChild(bonusValueEl);

  statsGrid.append(visibleStat, streakStat, progressStat, baseStat, bonusStat);

  const timerBadge = createEl(doc, 'div', 'timer-badge');
  const timerTextEl = createEl(doc, 'span', '', '');
  timerBadge.appendChild(timerTextEl);

  // Barra de exposición nativa <progress> sin estilos inline
  const exposureBox = createEl(doc, 'div', 'exposure-meter');
  exposureBox.setAttribute('data-severity', 'safe');
  const exposureHeader = createEl(doc, 'div', 'exposure-header');
  const exposureLabel = createEl(doc, 'label', 'exposure-label', 'Exposición');
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

  const glossaryQuickBtn = createEl(doc, 'button', 'btn btn--secondary btn--block hud-glossary-btn', 'Consultar glosario');
  glossaryQuickBtn.type = 'button';
  listen(glossaryQuickBtn, 'click', () => onOpenGlossary?.({ triggerEl: glossaryQuickBtn }));

  sidebar.append(hudHeadingRow, statsGrid, timerBadge, exposureBox, glossaryQuickBtn);
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
    streakValueEl.textContent = `${attempt.streak} ${formatStreakDots(attempt.streak)}`;
    bonusValueEl.textContent = `+${attempt.optionalTimeBonus} pts`;

    const exp = Math.max(0, Math.min(100, Math.round(attempt.exposure)));
    const meta = getExposureMeta(exp);
    exposureValueEl.textContent = `${exp} % / 100 %`;
    progressEl.value = exp;
    progressEl.setAttribute('value', String(exp));
    progressEl.setAttribute('aria-valuenow', String(exp));
    progressEl.setAttribute('aria-valuetext', `${exp} por ciento — ${meta.statusText}`);
    progressEl.setAttribute('data-severity', meta.severity);
    exposureBox.setAttribute('data-severity', meta.severity);
    exposureStatusEl.textContent = meta.statusText;
  }

  function renderFailurePanel(payload, delta) {
    const panel = createEl(doc, 'section', 'card level-fail-panel breach-banner');
    panel.setAttribute('aria-labelledby', 'level-fail-title');

    const title = createEl(doc, 'h2', '', 'Exposición máxima alcanzada (100 %)');
    title.id = 'level-fail-title';
    const explanation = createEl(
      doc,
      'p',
      '',
      'Las decisiones riesgosas acumuladas llevaron la exposición al 100 % (3 fallos graves o 4 errores detienen el avance). Este intento no desbloquea la siguiente fase ni cuenta para el rango final, pero tu progreso en niveles anteriores se conserva intacto.'
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
      renderFeedbackPanel(payload, delta, null, { isFailed: true });
    }
    if (typeof retryBtn.focus === 'function') {
      retryBtn.focus();
    }
  }

  function renderFeedbackPanel(payload, delta, onContinue, { isFailed = false } = {}) {
    const fb = payload?.feedback || {};
    const isCorrect = payload?.isCorrect === true;

    const panel = createEl(
      doc,
      'section',
      `feedback-panel ${isCorrect ? 'feedback-panel--safe' : 'feedback-panel--danger'}`
    );
    panel.setAttribute('aria-labelledby', 'feedback-panel-heading');

    const header = createEl(doc, 'div', 'feedback-header');
    const verdictHero = createEl(doc, 'div', 'verdict-hero');
    const emblem = createEl(
      doc,
      'span',
      `verdict-emblem ${isCorrect ? 'verdict-emblem--safe' : 'verdict-emblem--danger'}`,
      isCorrect ? '✓' : '✕'
    );
    emblem.setAttribute('aria-hidden', 'true');
    const heading = createEl(
      doc,
      'h2',
      'feedback-title',
      isCorrect ? 'Amenaza contenida' : 'Decisión riesgosa'
    );
    heading.id = 'feedback-panel-heading';
    verdictHero.append(emblem, heading);

    // Deltas reales obtenidos directamente desde scoring.getDecisionDelta
    const deltaRow = createEl(doc, 'div', 'verdict-deltas');
    if (isCorrect) {
      if (delta.pointsDelta > 0) {
        deltaRow.appendChild(createEl(doc, 'span', 'badge badge--safe', `+${delta.pointsDelta} pts base`));
      }
      if (delta.streakBonus > 0) {
        deltaRow.appendChild(createEl(doc, 'span', 'badge badge--info', `+${delta.streakBonus} racha (×${delta.nextStreak})`));
      } else {
        deltaRow.appendChild(createEl(doc, 'span', 'badge badge--neutral', `Racha: ${delta.nextStreak}`));
      }
      if (delta.timeBonusDelta > 0) {
        deltaRow.appendChild(createEl(doc, 'span', 'badge badge--info', `+${delta.timeBonusDelta} bono tiempo`));
      }
    } else {
      deltaRow.appendChild(createEl(doc, 'span', 'badge badge--danger', `+${delta.exposureDelta} % exposición`));
      deltaRow.appendChild(createEl(doc, 'span', 'badge badge--neutral', 'Racha reiniciada'));
    }

    header.append(verdictHero, deltaRow);

    // 3 bloques pedagógicos claros y escaneables
    const blocks = createEl(doc, 'div', 'feedback-blocks');
    const blockDefs = [
      ['1. Qué observó el atacante', fb.attackerView || 'Impacto potencial en el entorno simulado.'],
      ['2. Por qué importa', fb.why || 'Causa técnica relacionada con OWASP A04:2025.'],
      ['3. Control recomendado', fb.correctControl || 'Aplica el control criptográfico recomendado.']
    ];
    for (const [bTitle, bText] of blockDefs) {
      const box = createEl(doc, 'div', 'feedback-block');
      box.append(
        createEl(doc, 'h3', 'feedback-block-title', bTitle),
        createEl(doc, 'p', '', bText)
      );
      blocks.appendChild(box);
    }

    panel.append(header, blocks);

    let nextBtn = null;
    if (!isFailed && typeof onContinue === 'function') {
      const actions = createEl(doc, 'div', 'feedback-actions');
      nextBtn = createEl(doc, 'button', 'btn btn--primary', 'Continuar');
      nextBtn.type = 'button';
      listen(nextBtn, 'click', () => {
        feedbackContainer.replaceChildren();
        startDecisionTimer();
        onContinue();
      });
      actions.appendChild(nextBtn);
      panel.appendChild(actions);
    }

    // Profundidad técnica opcional (glosario y referencia oficial) en bloque expandible por teclado
    const hasGlossary = Boolean(payload?.glossaryTermId);
    const hasRef = isSafeHttps(payload?.owaspRef);
    if (hasGlossary || hasRef) {
      const techDetails = createEl(doc, 'details', 'feedback-details');
      const techSummary = createEl(doc, 'summary', 'feedback-details-summary', 'Ver explicación técnica y referencias');
      const techContent = createEl(doc, 'div', 'feedback-details-content');
      const refs = createEl(doc, 'div', 'feedback-refs');

      if (hasGlossary) {
        const termBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', `Abrir término en glosario (${payload.glossaryTermId})`);
        termBtn.type = 'button';
        listen(termBtn, 'click', () =>
          onOpenGlossary?.({ triggerEl: termBtn, termId: payload.glossaryTermId })
        );
        refs.appendChild(termBtn);
      }
      if (hasRef) {
        const link = createEl(doc, 'a', '', 'Referencia técnica (OWASP / norma)');
        link.setAttribute('href', payload.owaspRef);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        refs.appendChild(link);
      }

      techContent.appendChild(refs);
      techDetails.append(techSummary, techContent);
      panel.appendChild(techDetails);
    }

    feedbackContainer.replaceChildren(panel);

    if (nextBtn && typeof nextBtn.focus === 'function') {
      nextBtn.focus();
    }
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
    playLevelComplete();

    // En Niveles 1 y 3 ocultar el último reto ya respondido; Nivel 2 conserva resumen y Nivel 4 la línea de tiempo
    if (levelNumber === 1 || levelNumber === 3) {
      stageContainer.replaceChildren();
    }

    const containment = getContainmentGrade(attempt.exposure);
    const panel = createEl(doc, 'section', `card level-complete-panel ${containment.cardClass}`);
    panel.setAttribute('aria-labelledby', 'level-complete-title');

    const titleRow = createEl(doc, 'div', 'feedback-header');
    const title = createEl(doc, 'h2', '', `✓ Nivel ${levelNumber} completado`);
    title.id = 'level-complete-title';
    const gradeBadge = createEl(doc, 'span', `badge ${containment.badgeClass}`, containment.label);
    titleRow.append(title, gradeBadge);

    const summaryText = createEl(
      doc,
      'p',
      '',
      completionPayload?.summary || `Completaste la auditoría del Nivel ${levelNumber}.`
    );

    const containmentNote = createEl(doc, 'p', '', containment.note);

    const statsLine = createEl(
      doc,
      'p',
      'text-muted',
      `Puntaje base: ${attempt.baseScore} / ${maxBaseLevel} pts · Puntaje visible: ${attempt.visibleScore} pts · Exposición final: ${attempt.exposure} %`
    );

    panel.append(titleRow, summaryText, containmentNote, statsLine);

    if (mission.nextTransition) {
      panel.appendChild(createEl(doc, 'div', 'mission-transition-note', mission.nextTransition));
    }

    const actions = createEl(doc, 'div', 'hero-actions');
    const nextRoute = levelNumber < 4 ? `nivel-${levelNumber + 1}` : 'quiz-post';
    const nextLabel = levelNumber < 4 ? `Avanzar al Nivel ${levelNumber + 1}` : 'Ir al test posterior';
    const nextBtn = createEl(
      doc,
      'button',
      `btn ${containment.recommendRetry ? 'btn--secondary' : 'btn--primary'}`,
      nextLabel
    );
    nextBtn.type = 'button';
    listen(nextBtn, 'click', () => onNavigate?.(nextRoute));

    const retryBtn = createEl(
      doc,
      'button',
      `btn ${containment.recommendRetry ? 'btn--primary' : 'btn--secondary'}`,
      containment.recommendRetry ? 'Reintentar nivel (recomendado)' : 'Reintentar nivel'
    );
    retryBtn.type = 'button';
    listen(retryBtn, 'click', () => onRetry?.(levelNumber));

    const homeBtn = createEl(doc, 'button', 'btn btn--ghost', 'Volver a inicio');
    homeBtn.type = 'button';
    listen(homeBtn, 'click', () => onNavigate?.('inicio'));

    if (containment.recommendRetry) {
      actions.append(retryBtn, nextBtn, homeBtn);
    } else {
      actions.append(nextBtn, retryBtn, homeBtn);
    }
    panel.appendChild(actions);
    outcomeContainer.replaceChildren(panel);
    announce(`Nivel ${levelNumber} completado con ${attempt.baseScore} puntos base y ${attempt.exposure} por ciento de exposición.`);
    const primaryFocusBtn = containment.recommendRetry ? retryBtn : nextBtn;
    if (typeof primaryFocusBtn.focus === 'function') {
      primaryFocusBtn.focus();
    }
  }

  syncHud();
  startDecisionTimer();

  minigame.mount(stageContainer, levelData, {
    onProgress(info) {
      if (!info) return;
      progressValueEl.textContent = `${info.current}/${info.total}`;
    },
    onDecision(payload, onContinue) {
      if (destroyed || attempt.failed) {
        return;
      }
      stopTimer();
      const elapsedMs = Math.max(0, Date.now() - decisionStartTime);
      const prevAttempt = attempt;
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
      const delta = getDecisionDelta(prevAttempt, attempt);
      syncHud();

      if (payload.isCorrect) {
        playCorrect();
      } else {
        playError();
      }

      if (attempt.failed) {
        renderFailurePanel(payload, delta);
        return;
      }

      renderFeedbackPanel(payload, delta, onContinue, { isFailed: false });
      announce(
        payload.isCorrect
          ? `Amenaza contenida. Más ${delta.baseDelta} puntos base.`
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
