let activeSession = null;

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

export function destroy() {
  if (!activeSession) {
    return;
  }
  const session = activeSession;
  activeSession = null;
  session.active = false;

  for (const cleanup of session.cleanups) {
    try {
      cleanup();
    } catch {
      // Limpieza defensiva idempotente
    }
  }
  session.cleanups.length = 0;

  if (session.container && typeof session.container.replaceChildren === 'function') {
    session.container.replaceChildren();
  }
  session.container = null;
}

export function mount(container, levelData, callbacks = {}) {
  destroy();

  if (!container || !levelData || !levelData.nodes || !levelData.startNodeId) {
    return;
  }

  const doc = container.ownerDocument || globalThis.document;
  const phases = Array.isArray(levelData.phases) ? levelData.phases : [];
  const nodes = levelData.nodes;

  const session = {
    active: true,
    container,
    cleanups: [],
    currentNodeId: levelData.startNodeId,
    scorableDecisionsCount: 0,
    timeline: [],
    completedPhases: new Set(),
    locked: false
  };
  activeSession = session;

  function listen(el, eventType, handler) {
    el.addEventListener(eventType, handler);
    session.cleanups.push(() => el.removeEventListener(eventType, handler));
  }

  function clearRenderListeners() {
    for (const cleanup of session.cleanups) {
      cleanup();
    }
    session.cleanups.length = 0;
  }

  function renderPhaseStepper(currentPhase, isTerminal) {
    const ol = createEl(doc, 'ol', 'phase-stepper');
    ol.setAttribute('aria-label', 'Fases del simulacro de brecha');
    const currentPhaseIdx = phases.indexOf(currentPhase);

    phases.forEach((phaseName, idx) => {
      let stateClass = 'is-upcoming';
      let statusPrefix = `${idx + 1}.`;
      if (isTerminal || session.completedPhases.has(phaseName) || (currentPhaseIdx !== -1 && idx < currentPhaseIdx)) {
        stateClass = 'is-complete';
        statusPrefix = '✓';
      } else if (phaseName === currentPhase) {
        stateClass = 'is-current';
        statusPrefix = `${idx + 1}.`;
      }

      const li = createEl(doc, 'li', `phase-step ${stateClass}`, `${statusPrefix} ${phaseName}`);
      if (stateClass === 'is-current') {
        li.setAttribute('aria-current', 'step');
      }
      ol.appendChild(li);
    });

    return ol;
  }

  function renderTimeline() {
    const section = createEl(doc, 'section', 'incident-timeline');
    section.appendChild(createEl(doc, 'h3', '', 'Línea de tiempo de decisiones'));

    if (session.timeline.length === 0) {
      section.appendChild(
        createEl(doc, 'p', 'text-muted', 'Aún no registras acciones en este simulacro. Cada elección quedará documentada aquí.')
      );
      return section;
    }

    const list = createEl(doc, 'ol', 'timeline-list');
    for (const entry of session.timeline) {
      const li = createEl(
        doc,
        'li',
        `timeline-entry ${entry.isCorrect ? 'timeline-entry--safe' : 'timeline-entry--danger'}`
      );
      const statusLabel = entry.isCorrect ? 'Acción adecuada' : `Riesgo (+${entry.exposureDelta} % exposición)`;
      li.append(
        createEl(doc, 'span', 'timeline-entry-phase', `${entry.phase} · ${statusLabel}`),
        createEl(doc, 'span', 'timeline-entry-decision', entry.label)
      );
      list.appendChild(li);
    }

    section.appendChild(list);
    return section;
  }

  function renderNode() {
    if (!session.active) {
      return;
    }

    clearRenderListeners();
    session.locked = false;

    const node = nodes[session.currentNodeId];
    if (!node) {
      return;
    }

    const wrapper = createEl(doc, 'div', 'incident-layout');
    wrapper.appendChild(renderPhaseStepper(node.phase, Boolean(node.isTerminal)));

    const card = createEl(doc, 'article', 'incident-node-card');
    card.setAttribute('aria-labelledby', `incident-title-${node.id}`);

    const phaseBadge = createEl(
      doc,
      'span',
      `badge ${node.isTerminal ? (node.outcomeType === 'observations' ? 'badge--warning' : 'badge--safe') : 'badge--info'} incident-phase-badge`,
      `Fase: ${node.phase}`
    );
    const title = createEl(doc, 'h2', '', node.title);
    title.id = `incident-title-${node.id}`;
    const scenario = createEl(doc, 'p', '', node.scenario);
    card.append(phaseBadge, title, scenario);

    if (node.isTerminal) {
      const outcomeNote = createEl(
        doc,
        'div',
        `alert ${node.outcomeType === 'observations' ? 'alert--warning' : 'alert--safe'}`,
        node.outcomeType === 'observations'
          ? 'Resultado del simulacro: cierre con observaciones de auditoría.'
          : 'Resultado del simulacro: incidente contenido y cerrado correctamente.'
      );
      card.appendChild(outcomeNote);
      wrapper.append(card, renderTimeline());
      container.replaceChildren(wrapper);

      if (typeof callbacks.onLevelComplete === 'function') {
        callbacks.onLevelComplete({
          scorableDecisionsCount: session.scorableDecisionsCount,
          outcomeType: node.outcomeType || 'success',
          summary: node.scenario
        });
      }
      return;
    }

    const options = Array.isArray(node.options) ? node.options : [];
    const optionsContainer = createEl(doc, 'div', 'incident-options');
    optionsContainer.setAttribute('role', 'group');
    optionsContainer.setAttribute('aria-label', `Opciones de respuesta para ${node.phase}`);

    const optionButtons = [];
    for (const option of options) {
      const btn = createEl(doc, 'button', 'btn option-btn', option.label);
      btn.type = 'button';
      btn.setAttribute('data-option-id', option.id);
      optionButtons.push(btn);

      listen(btn, 'click', () => {
        if (!session.active || session.locked) {
          return;
        }
        session.locked = true;

        const isCorrect = option.isCorrect === true;
        if (node.scorable !== false) {
          session.scorableDecisionsCount += 1;
        }

        session.timeline.push({
          phase: node.phase,
          label: option.label,
          isCorrect,
          exposureDelta: option.exposureDelta ?? 0
        });

        const nextNode = nodes[option.nextNodeId];
        if (!nextNode || nextNode.phase !== node.phase) {
          session.completedPhases.add(node.phase);
        }

        for (const otherBtn of optionButtons) {
          otherBtn.disabled = true;
          if (otherBtn === btn) {
            otherBtn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
          }
        }

        const advance = () => {
          if (!session.active) {
            return;
          }
          session.currentNodeId = option.nextNodeId;
          renderNode();
        };

        if (typeof callbacks.onDecision === 'function') {
          callbacks.onDecision(
            {
              challengeId: node.id,
              objectiveId: option.objectiveId,
              selectedOptionId: option.id,
              isCorrect,
              penaltyOnWrongAnswer: option.exposureDelta ?? 0,
              feedback: option.feedback,
              glossaryTermId: option.glossaryTermId,
              owaspRef: option.owaspRef
            },
            advance
          );
        } else {
          advance();
        }
      });

      optionsContainer.appendChild(btn);
    }

    card.appendChild(optionsContainer);
    wrapper.append(card, renderTimeline());
    container.replaceChildren(wrapper);
  }

  renderNode();
}
