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
          summary: 'Auditaste todos los archivos ficticios del repositorio de NovaPay.'
        });
      }
      return;
    }

    const challenge = challenges[session.currentIndex];
    let selectedLineNumber = null;
    let selectedMitigationId = null;

    const wrapper = createEl(doc, 'div', 'codehunt-layout');

    const stepRow = createEl(doc, 'div', 'codehunt-step-indicator');
    stepRow.append(
      createEl(doc, 'span', '', `Archivo ${session.currentIndex + 1} de ${challenges.length}`),
      createEl(doc, 'span', 'badge badge--info', `Objetivo ${challenge.objectiveId}`)
    );
    wrapper.appendChild(stepRow);

    const introCard = createEl(doc, 'section', 'card');
    const heading = createEl(doc, 'h2', '', challenge.title);
    const scenario = createEl(doc, 'p', '', challenge.scenario);
    const helper = createEl(
      doc,
      'p',
      'text-muted',
      'Paso 1: selecciona la línea vulnerable en el archivo simulado. Paso 2: elige la mitigación adecuada y confirma.'
    );
    introCard.append(heading, scenario, helper);
    wrapper.appendChild(introCard);

    const viewer = createEl(doc, 'section', 'code-viewer');
    viewer.setAttribute('aria-label', `Archivo ficticio ${challenge.filePath}`);

    const fileHeader = createEl(doc, 'div', 'repo-file-header');
    fileHeader.append(
      createEl(doc, 'span', 'repo-file-path', challenge.filePath),
      createEl(doc, 'span', 'badge badge--neutral', 'Código simulado no ejecutable')
    );
    viewer.appendChild(fileHeader);

    const lineList = createEl(doc, 'ol', 'code-lines');
    const lineButtons = [];

    const selectionStatus = createEl(
      doc,
      'p',
      'text-muted',
      'Selección actual: ninguna línea seleccionada; ninguna mitigación seleccionada.'
    );
    const submitBtn = createEl(doc, 'button', 'btn btn--primary', 'Confirmar diagnóstico');
    submitBtn.type = 'button';
    submitBtn.disabled = true;

    function updateSelectionUi() {
      const lineText = selectedLineNumber !== null ? `línea ${selectedLineNumber}` : 'ninguna línea seleccionada';
      const mitObj = challenge.mitigationOptions.find((m) => m.id === selectedMitigationId);
      const mitText = mitObj ? `mitigación elegida` : 'ninguna mitigación seleccionada';
      selectionStatus.textContent = `Selección actual: ${lineText}; ${mitText}.`;
      submitBtn.disabled = session.locked || selectedLineNumber === null || selectedMitigationId === null;
    }

    for (const line of challenge.lines) {
      const li = createEl(doc, 'li');
      const lineBtn = createEl(doc, 'button', 'code-line-btn');
      lineBtn.type = 'button';
      lineBtn.setAttribute('data-line-number', String(line.lineNumber));
      lineBtn.setAttribute('aria-pressed', 'false');
      lineBtn.setAttribute('aria-label', `Línea ${line.lineNumber}: ${line.text}`);

      const numSpan = createEl(doc, 'span', 'code-line-num', String(line.lineNumber));
      const codeSpan = createEl(doc, 'code', 'code-line-text', line.text);
      lineBtn.append(numSpan, codeSpan);
      lineButtons.push(lineBtn);

      listen(lineBtn, 'click', () => {
        if (!session.active || session.locked) {
          return;
        }
        selectedLineNumber = line.lineNumber;
        for (const other of lineButtons) {
          const isCurrent = other === lineBtn;
          other.classList.toggle('is-selected', isCurrent);
          other.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
        }
        updateSelectionUi();
      });

      li.appendChild(lineBtn);
      lineList.appendChild(li);
    }

    viewer.appendChild(lineList);
    wrapper.appendChild(viewer);

    const mitPanel = createEl(doc, 'section', 'mitigation-panel');
    mitPanel.appendChild(createEl(doc, 'h3', '', 'Paso 2: Selecciona la mitigación recomendada'));

    const mitList = createEl(doc, 'div', 'mitigation-options');
    mitList.setAttribute('role', 'group');
    mitList.setAttribute('aria-label', 'Opciones de mitigación');
    const mitButtons = [];

    for (const option of challenge.mitigationOptions) {
      const mitBtn = createEl(doc, 'button', 'btn option-btn', option.label);
      mitBtn.type = 'button';
      mitBtn.setAttribute('data-mitigation-id', option.id);
      mitBtn.setAttribute('aria-pressed', 'false');
      mitButtons.push(mitBtn);

      listen(mitBtn, 'click', () => {
        if (!session.active || session.locked) {
          return;
        }
        selectedMitigationId = option.id;
        for (const other of mitButtons) {
          const isCurrent = other === mitBtn;
          other.classList.toggle('is-selected', isCurrent);
          other.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
        }
        updateSelectionUi();
      });

      mitList.appendChild(mitBtn);
    }

    mitPanel.append(mitList, selectionStatus);

    const submitRow = createEl(doc, 'div', 'codehunt-submit-row');
    submitRow.appendChild(submitBtn);
    mitPanel.appendChild(submitRow);

    listen(submitBtn, 'click', () => {
      if (!session.active || session.locked) {
        return;
      }
      if (selectedLineNumber === null || selectedMitigationId === null) {
        return;
      }

      session.locked = true;
      submitBtn.disabled = true;

      const lineCorrect = challenge.vulnerableLineNumbers.includes(selectedLineNumber);
      const mitigationCorrect = selectedMitigationId === challenge.correctMitigationId;
      const isCorrect = lineCorrect && mitigationCorrect;

      let outcomeKey = 'correct';
      if (!lineCorrect) {
        outcomeKey = 'wrongLine';
      } else if (!mitigationCorrect) {
        outcomeKey = 'wrongMitigation';
      }

      for (const btn of lineButtons) {
        btn.disabled = true;
        const num = Number(btn.getAttribute('data-line-number'));
        if (challenge.vulnerableLineNumbers.includes(num)) {
          btn.classList.add('is-vulnerable');
        }
      }
      for (const btn of mitButtons) {
        btn.disabled = true;
        const id = btn.getAttribute('data-mitigation-id');
        if (id === challenge.correctMitigationId) {
          btn.classList.add('is-correct');
        } else if (id === selectedMitigationId && !mitigationCorrect) {
          btn.classList.add('is-incorrect');
        }
      }

      const feedback = challenge.feedbackByOutcome?.[outcomeKey] || {
        attackerView: 'Una configuración o secreto expuesto facilita el compromiso del componente.',
        why: 'Es necesario identificar tanto la línea vulnerable como el control correctivo apropiado.',
        correctControl: 'Corrige la línea afectada y aplica el control criptográfico recomendado.'
      };

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
            title: `${challenge.title} (${challenge.filePath})`,
            objectiveId: challenge.objectiveId,
            selectedOptionId: `${selectedLineNumber}:${selectedMitigationId}`,
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

    wrapper.appendChild(mitPanel);
    container.replaceChildren(wrapper);
  }

  renderChallenge();
}
