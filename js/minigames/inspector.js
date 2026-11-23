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

function formatHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return '(Sin cabeceras adicionales registradas)';
  }
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return '(Sin cabeceras adicionales registradas)';
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n');
}

function getOptionButtonVariant(optionId) {
  if (optionId === 'allow') return 'btn btn--secondary';
  if (optionId === 'require_https') return 'btn btn--primary';
  if (optionId === 'block') return 'btn btn--danger';
  return 'btn btn--secondary';
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

  if (!container || !levelData || !Array.isArray(levelData.challenges)) {
    return;
  }

  const doc = container.ownerDocument || globalThis.document;
  const challenges = levelData.challenges;
  const session = {
    active: true,
    container,
    cleanups: [],
    currentIndex: 0,
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

  function renderChallenge() {
    if (!session.active) {
      return;
    }

    clearRenderListeners();
    session.locked = false;

    if (session.currentIndex >= challenges.length) {
      if (typeof callbacks.onLevelComplete === 'function') {
        callbacks.onLevelComplete({
          scorableDecisionsCount: challenges.length,
          outcomeType: 'success',
          summary: 'Inspeccionaste todas las solicitudes de red simuladas de NovaPay.'
        });
      }
      return;
    }

    const challenge = challenges[session.currentIndex];
    const req = challenge.requestDetails || {};
    const wrapper = createEl(doc, 'div', 'inspector-layout');

    const progressBar = createEl(doc, 'div', 'inspector-progress');
    progressBar.append(
      createEl(doc, 'span', '', `Solicitud ${session.currentIndex + 1} de ${challenges.length}`),
      createEl(doc, 'span', 'badge badge--info', `Objetivo ${challenge.objectiveId}`)
    );
    wrapper.appendChild(progressBar);

    const card = createEl(doc, 'article', 'packet-card');
    card.setAttribute('aria-labelledby', `inspector-title-${challenge.id}`);

    const title = createEl(doc, 'h2', '', challenge.title);
    title.id = `inspector-title-${challenge.id}`;
    const scenario = createEl(doc, 'p', '', challenge.scenario);
    card.append(title, scenario);

    const headerRow = createEl(doc, 'div', 'packet-header');
    headerRow.append(
      createEl(doc, 'span', 'packet-method-badge', String(req.method || 'GET')),
      createEl(doc, 'code', 'packet-url', String(req.url || ''))
    );
    card.appendChild(headerRow);

    const metaList = createEl(doc, 'dl', 'packet-meta-grid');
    const metaFields = [
      ['Protocolo', req.protocol || 'No especificado'],
      ['Versión TLS / Cifrado', req.tlsVersion || 'No especificado'],
      ['Estado del certificado', req.certificateStatus || 'No especificado']
    ];
    for (const [labelText, valueText] of metaFields) {
      const item = createEl(doc, 'div', 'packet-meta-item');
      item.append(
        createEl(doc, 'dt', 'packet-meta-label', labelText),
        createEl(doc, 'dd', 'packet-meta-value', String(valueText))
      );
      metaList.appendChild(item);
    }
    card.appendChild(metaList);

    const headersSection = createEl(doc, 'div', 'packet-headers');
    headersSection.append(
      createEl(doc, 'h3', '', 'Cabeceras simuladas'),
      createEl(doc, 'pre', '', formatHeaders(req.headers))
    );
    card.appendChild(headersSection);

    const payloadSection = createEl(doc, 'div', 'packet-payload');
    const payloadText = typeof req.payloadPreview === 'string' && req.payloadPreview.trim().length > 0
      ? req.payloadPreview
      : '(Sin cuerpo de solicitud en este ejemplo simulado)';
    payloadSection.append(
      createEl(doc, 'h3', '', 'Vista previa de carga simulada'),
      createEl(doc, 'pre', '', payloadText)
    );
    card.appendChild(payloadSection);

    wrapper.appendChild(card);

    const actionsGroup = createEl(doc, 'div', 'inspector-actions');
    actionsGroup.setAttribute('role', 'group');
    actionsGroup.setAttribute('aria-label', 'Decisión de auditoría de transporte');

    const optionButtons = [];
    for (const option of challenge.options) {
      const btn = createEl(doc, 'button', getOptionButtonVariant(option.id), option.label);
      btn.type = 'button';
      btn.setAttribute('data-option-id', option.id);
      optionButtons.push(btn);

      listen(btn, 'click', () => {
        if (!session.active || session.locked) {
          return;
        }
        session.locked = true;
        const isCorrect = option.id === challenge.correctOptionId;
        const feedback = challenge.feedbackByOption?.[option.id] || {
          attackerView: 'El transporte expuesto incrementa el riesgo en la red simulada.',
          why: 'Revisa los parámetros de TLS, certificado y directivas de seguridad.',
          correctControl: 'Aplica HTTPS con TLS actualizado y certificados confiables.'
        };

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
          session.currentIndex += 1;
          renderChallenge();
        };

        if (typeof callbacks.onDecision === 'function') {
          callbacks.onDecision(
            {
              challengeId: challenge.id,
              title: challenge.title,
              objectiveId: challenge.objectiveId,
              selectedOptionId: option.id,
              isCorrect,
              penaltyOnWrongAnswer: challenge.exposureDelta,
              feedback,
              glossaryTermId: challenge.glossaryTermId,
              owaspRef: challenge.owaspRef
            },
            advance
          );
        } else {
          advance();
        }
      });

      actionsGroup.appendChild(btn);
    }

    wrapper.appendChild(actionsGroup);
    container.replaceChildren(wrapper);
  }

  renderChallenge();
}
