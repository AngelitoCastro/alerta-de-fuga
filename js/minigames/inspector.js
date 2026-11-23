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

function getHstsStatus(headers) {
  if (!headers || typeof headers !== 'object') {
    return 'Ausente';
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'strict-transport-security');
  if (!key || !String(headers[key]).trim()) {
    return 'Ausente';
  }
  return /preload/i.test(String(headers[key])) ? 'Presente (con preload)' : 'Presente';
}

function getSchemeLabel(url, protocol) {
  const raw = String(url || '');
  if (/^https:\/\//i.test(raw)) return `HTTPS (${protocol || 'HTTP'})`;
  if (/^http:\/\//i.test(raw)) return `HTTP (${protocol || 'HTTP'})`;
  return String(protocol || 'No especificado');
}

function createEvidenceChip(doc, label, value) {
  const chip = createEl(doc, 'span', 'evidence-chip');
  chip.append(
    createEl(doc, 'span', 'evidence-chip-key', `${label}:`),
    createEl(doc, 'span', '', String(value))
  );
  return chip;
}

function getOptionButtonVariant(optionId) {
  // Neutralidad visual antes de decidir: no destacar una acción por color antes del veredicto
  if (optionId === 'allow' || optionId === 'require_https' || optionId === 'block') {
    return 'btn btn--secondary';
  }
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
    const hstsStatus = getHstsStatus(req.headers);

    if (typeof callbacks.onProgress === 'function') {
      callbacks.onProgress({
        current: session.currentIndex + 1,
        total: challenges.length,
        label: `Solicitud ${session.currentIndex + 1}/${challenges.length}`
      });
    }

    const wrapper = createEl(doc, 'div', 'inspector-layout');

    const progressBar = createEl(doc, 'div', 'inspector-progress');
    progressBar.append(
      createEl(doc, 'span', '', `Solicitud ${session.currentIndex + 1} de ${challenges.length} · Evalúa la evidencia antes de decidir`),
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

    // Visualizador animado del túnel de red (neutral: no adelanta veredicto)
    const tunnelStage = createEl(doc, 'div', 'tunnel-stage');
    tunnelStage.setAttribute('aria-hidden', 'true');

    const clientNode = createEl(doc, 'div', 'tunnel-endpoint');
    clientNode.append(
      createEl(doc, 'span', 'tunnel-endpoint-icon', '[PC]'),
      createEl(doc, 'span', 'tunnel-endpoint-name', 'Cliente')
    );

    const conduit = createEl(doc, 'div', 'tunnel-conduit');
    conduit.append(
      createEl(doc, 'span', 'tunnel-packet-pill', `${String(req.method || 'GET')} · ${getSchemeLabel(req.url, req.protocol)}`),
      createEl(doc, 'div', 'tunnel-wire')
    );

    const serverNode = createEl(doc, 'div', 'tunnel-endpoint');
    serverNode.append(
      createEl(doc, 'span', 'tunnel-endpoint-icon', '[SRV]'),
      createEl(doc, 'span', 'tunnel-endpoint-name', 'NovaPay')
    );

    tunnelStage.append(clientNode, conduit, serverNode);
    card.appendChild(tunnelStage);

    // Evidencia visual neutral (sin colores de veredicto antes de responder)
    const telemetryStrip = createEl(doc, 'div', 'evidence-strip');
    telemetryStrip.setAttribute('aria-label', 'Resumen neutral de parámetros de transporte');
    telemetryStrip.append(
      createEvidenceChip(doc, 'Canal', getSchemeLabel(req.url, req.protocol)),
      createEvidenceChip(doc, 'TLS', req.tlsVersion || 'No especificado'),
      createEvidenceChip(doc, 'Certificado', req.certificateStatus || 'No especificado'),
      createEvidenceChip(doc, 'HSTS', hstsStatus)
    );
    card.appendChild(telemetryStrip);

    const rawDetails = createEl(doc, 'details', 'packet-raw-details');
    rawDetails.open = true;
    const rawSummary = createEl(doc, 'summary', 'packet-raw-summary', 'Detalle de cabeceras y carga simulada');
    const rawBody = createEl(doc, 'div', 'packet-raw-body');

    const headersSection = createEl(doc, 'div', 'packet-headers');
    headersSection.append(
      createEl(doc, 'h3', '', 'Cabeceras simuladas'),
      createEl(doc, 'pre', '', formatHeaders(req.headers))
    );

    const payloadSection = createEl(doc, 'div', 'packet-payload');
    const payloadText = typeof req.payloadPreview === 'string' && req.payloadPreview.trim().length > 0
      ? req.payloadPreview
      : '(Sin cuerpo de solicitud en este ejemplo simulado)';
    payloadSection.append(
      createEl(doc, 'h3', '', 'Vista previa de carga simulada'),
      createEl(doc, 'pre', '', payloadText)
    );

    rawBody.append(headersSection, payloadSection);
    rawDetails.append(rawSummary, rawBody);
    card.appendChild(rawDetails);

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
