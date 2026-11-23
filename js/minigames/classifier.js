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

function getVisualDescription(challenge) {
  if (String(challenge.visualAsset || '').includes('ecb-pattern.svg')) {
    return 'Diagrama comparativo: AES-ECB cifra bloques repetidos con salidas idénticas y deja visibles los patrones de saldos, mientras AES-GCM con nonce único oculta patrones y protege integridad.';
  }
  return `Ilustración educativa del registro simulado: ${challenge.title}`;
}

function getRecordCategoryTag(challenge) {
  const text = `${challenge.title} ${challenge.recordLabel || ''}`.toLowerCase();
  if (/contraseñ|md5|sha-1/.test(text)) return 'Tipo: Credencial de acceso';
  if (/\bcvv\b/.test(text)) return 'Tipo: Código CVV de tarjeta';
  if (/\bpan\b/.test(text)) return 'Tipo: Número de tarjeta (PAN)';
  if (/aes-ecb|ecb/.test(text)) return 'Tipo: Dato financiero cifrado (ECB)';
  if (/aes-gcm|nonce/.test(text)) return 'Tipo: Registro cifrado (AES-GCM)';
  if (/fiscal/.test(text)) return 'Tipo: Dato fiscal recuperable';
  return 'Tipo: Dato operativo / retención';
}

function getRecordEmblem(challenge) {
  const text = `${challenge.title} ${challenge.recordLabel || ''}`.toLowerCase();
  if (/contraseñ|md5|sha-1/.test(text)) return 'KEY';
  if (/\bcvv\b/.test(text)) return 'CVV';
  if (/\bpan\b/.test(text)) return 'PAN';
  if (/aes-ecb|ecb/.test(text)) return 'ECB';
  if (/aes-gcm|nonce/.test(text)) return 'GCM';
  if (/fiscal/.test(text)) return 'TAX';
  return 'DAT';
}

function getBucketPrefix(bucketId) {
  if (bucketId === 'hash_password') return '[Hash] ';
  if (bucketId === 'authenticated_encryption') return '[Cifrado] ';
  if (bucketId === 'tokenize_minimize') return '[Token/Min.] ';
  if (bucketId === 'delete_do_not_store') return '[Eliminar] ';
  return '';
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

  if (!container || !levelData || !Array.isArray(levelData.challenges) || !Array.isArray(levelData.buckets)) {
    return;
  }

  const doc = container.ownerDocument || globalThis.document;
  const challenges = levelData.challenges;
  const buckets = levelData.buckets;

  const assignedByBucket = new Map();
  for (const bucket of buckets) {
    assignedByBucket.set(bucket.id, []);
  }

  const session = {
    active: true,
    container,
    cleanups: [],
    currentIndex: 0,
    selectedChallengeId: challenges[0]?.id || null,
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

  function buildAssignedList(bucketId) {
    const assignedItems = assignedByBucket.get(bucketId) || [];
    const list = createEl(doc, 'ul', 'bucket-assigned-list');
    for (const item of assignedItems) {
      const li = createEl(
        doc,
        'li',
        'assigned-chip',
        `${item.isCorrect ? '✓' : '✕'} ${item.title}`
      );
      list.appendChild(li);
    }
    return list;
  }

  function formatCount(count) {
    return count === 1 ? '1 asignado' : `${count} asignados`;
  }

  function renderCompletedSummary() {
    const wrapper = createEl(doc, 'div', 'classifier-layout');

    const progressRow = createEl(doc, 'div', 'classifier-progress');
    progressRow.append(
      createEl(doc, 'span', '', `Registros clasificados: ${challenges.length} de ${challenges.length}`),
      createEl(doc, 'span', 'badge badge--safe', 'Clasificación finalizada')
    );
    wrapper.appendChild(progressRow);

    const summaryIntro = createEl(
      doc,
      'p',
      'classifier-instructions',
      'Resumen completo de los ocho registros asignados durante este intento (✓ correcto, ✕ incorrecto).'
    );
    wrapper.appendChild(summaryIntro);

    const bucketsGrid = createEl(doc, 'div', 'classifier-buckets');
    for (const bucket of buckets) {
      const assignedItems = assignedByBucket.get(bucket.id) || [];
      const bucketCard = createEl(doc, 'section', 'bucket-card');
      bucketCard.setAttribute('aria-labelledby', `bucket-summary-heading-${bucket.id}`);

      const bucketHeader = createEl(doc, 'div', 'bucket-header');
      const headerTop = createEl(doc, 'div', 'bucket-header-top');
      const heading = createEl(doc, 'h3', '', `${getBucketPrefix(bucket.id)}${bucket.label}`);
      heading.id = `bucket-summary-heading-${bucket.id}`;
      const countBadge = createEl(doc, 'span', 'badge badge--neutral', formatCount(assignedItems.length));
      headerTop.append(heading, countBadge);
      const desc = createEl(doc, 'p', 'text-muted', bucket.description);
      bucketHeader.append(headerTop, desc);
      bucketCard.appendChild(bucketHeader);

      if (assignedItems.length > 0) {
        bucketCard.appendChild(buildAssignedList(bucket.id));
      } else {
        bucketCard.appendChild(createEl(doc, 'p', 'text-muted', 'Sin registros asignados a esta categoría.'));
      }

      bucketsGrid.appendChild(bucketCard);
    }

    wrapper.appendChild(bucketsGrid);
    container.replaceChildren(wrapper);
  }

  function render() {
    if (!session.active) {
      return;
    }

    clearRenderListeners();
    session.locked = false;

    if (session.currentIndex >= challenges.length) {
      renderCompletedSummary();
      if (typeof callbacks.onLevelComplete === 'function') {
        callbacks.onLevelComplete({
          scorableDecisionsCount: challenges.length,
          outcomeType: 'success',
          summary: 'Clasificaste todos los registros de la bóveda simulada de NovaPay.'
        });
      }
      return;
    }

    const challenge = challenges[session.currentIndex];
    session.selectedChallengeId = challenge.id;

    if (typeof callbacks.onProgress === 'function') {
      callbacks.onProgress({
        current: session.currentIndex + 1,
        total: challenges.length,
        label: `Registro ${session.currentIndex + 1}/${challenges.length}`
      });
    }

    const wrapper = createEl(doc, 'div', 'classifier-layout');

    const progressRow = createEl(doc, 'div', 'classifier-progress');
    progressRow.append(
      createEl(doc, 'span', '', `Registro ${session.currentIndex + 1} de ${challenges.length} · Decide el tratamiento seguro`),
      createEl(doc, 'span', 'badge badge--info', `Objetivo ${challenge.objectiveId}`)
    );
    wrapper.appendChild(progressRow);

    const instructions = createEl(
      doc,
      'p',
      'classifier-instructions',
      'Elige el destino mediante botones (teclado o toque) o arrastra la tarjeta en escritorio.'
    );
    wrapper.appendChild(instructions);

    const deck = createEl(doc, 'div', 'classifier-deck');
    const card = createEl(doc, 'article', 'data-card vault-pedestal is-selected');
    card.setAttribute('draggable', 'true');
    card.setAttribute('aria-labelledby', `classifier-card-${challenge.id}`);

    const cardHeader = createEl(doc, 'div', 'data-card-header');
    const selectCardBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', `Tarjeta seleccionada: ${challenge.title}`);
    selectCardBtn.type = 'button';
    selectCardBtn.setAttribute('data-challenge-id', challenge.id);
    selectCardBtn.setAttribute('aria-pressed', 'true');

    // Evidencia neutral sobre la naturaleza del registro (sin revelar respuesta)
    const typeChip = createEl(doc, 'span', 'evidence-chip', getRecordCategoryTag(challenge));
    cardHeader.append(selectCardBtn, typeChip);

    const bannerRow = createEl(doc, 'div', 'vault-record-banner');
    const emblem = createEl(doc, 'span', 'vault-emblem', getRecordEmblem(challenge));
    emblem.setAttribute('aria-hidden', 'true');
    const cardTitle = createEl(doc, 'h2', '', challenge.title);
    cardTitle.id = `classifier-card-${challenge.id}`;
    bannerRow.append(emblem, cardTitle);

    const cardScenario = createEl(doc, 'p', '', challenge.scenario);
    const recordCode = createEl(doc, 'pre', '', challenge.recordLabel);

    card.append(cardHeader, bannerRow, cardScenario, recordCode);

    if (challenge.visualAsset) {
      const figure = createEl(doc, 'figure', 'ecb-visual-figure');
      const img = createEl(doc, 'img', '', '');
      img.setAttribute('src', challenge.visualAsset);
      img.setAttribute('alt', getVisualDescription(challenge));
      const caption = createEl(
        doc,
        'figcaption',
        '',
        'Comparación visual de bloques: AES-ECB conserva patrones repetitivos; AES-GCM con nonce único los oculta y autentica integridad.'
      );
      figure.append(img, caption);
      card.appendChild(figure);
    }

    listen(selectCardBtn, 'click', () => {
      if (!session.active || session.locked) {
        return;
      }
      session.selectedChallengeId = challenge.id;
      selectCardBtn.setAttribute('aria-pressed', 'true');
      card.classList.add('is-selected');
      if (typeof callbacks.onStatusAnnounce === 'function') {
        callbacks.onStatusAnnounce(`Registro seleccionado: ${challenge.title}. Elige un control para clasificarlo.`);
      }
    });

    listen(card, 'dragstart', (event) => {
      if (!session.active || session.locked) {
        event.preventDefault();
        return;
      }
      session.selectedChallengeId = challenge.id;
      card.classList.add('is-dragging');
      if (event.dataTransfer && typeof event.dataTransfer.setData === 'function') {
        event.dataTransfer.setData('text/plain', challenge.id);
      }
    });

    listen(card, 'dragend', () => {
      card.classList.remove('is-dragging');
    });

    deck.appendChild(card);
    wrapper.appendChild(deck);

    const assignBar = createEl(doc, 'div', 'classifier-assign-bar');
    assignBar.appendChild(
      createEl(
        doc,
        'p',
        '',
        `Asignación directa: selecciona el control para «${challenge.title}».`
      )
    );
    wrapper.appendChild(assignBar);

    const bucketsGrid = createEl(doc, 'div', 'classifier-buckets');
    const bucketButtons = [];
    const bucketListSlots = new Map();
    const bucketCountBadges = new Map();

    function handleAssign(bucket) {
      if (!session.active || session.locked) {
        return;
      }
      if (!session.selectedChallengeId) {
        session.selectedChallengeId = challenge.id;
      }
      session.locked = true;
      const isCorrect = bucket.id === challenge.correctOptionId;
      const feedback = challenge.feedbackByOption?.[bucket.id] || {
        attackerView: 'Un tratamiento inadecuado aumenta la exposición de datos en reposo.',
        why: 'Cada tipo de dato exige un control específico (hash lento, cifrado autenticado, tokenización o eliminación).',
        correctControl: 'Aplica el control acorde a OWASP A04:2025 y PCI DSS.'
      };

      const bucketItems = assignedByBucket.get(bucket.id);
      bucketItems.push({
        id: challenge.id,
        title: challenge.title,
        isCorrect
      });

      const listSlot = bucketListSlots.get(bucket.id);
      if (listSlot) {
        listSlot.replaceChildren(buildAssignedList(bucket.id));
      }
      const countBadge = bucketCountBadges.get(bucket.id);
      if (countBadge) {
        countBadge.textContent = formatCount(bucketItems.length);
      }

      card.classList.add('is-assigned');
      selectCardBtn.disabled = true;
      for (const btn of bucketButtons) {
        btn.disabled = true;
      }

      const advance = () => {
        if (!session.active) {
          return;
        }
        session.currentIndex += 1;
        render();
      };

      if (typeof callbacks.onDecision === 'function') {
        callbacks.onDecision(
          {
            challengeId: challenge.id,
            title: challenge.title,
            objectiveId: challenge.objectiveId,
            selectedOptionId: bucket.id,
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
    }

    for (const bucket of buckets) {
      const assignedItems = assignedByBucket.get(bucket.id) || [];
      const bucketCard = createEl(doc, 'section', 'bucket-card');
      bucketCard.setAttribute('data-chamber', bucket.id);
      bucketCard.setAttribute('aria-labelledby', `bucket-heading-${bucket.id}`);

      const bucketHeader = createEl(doc, 'div', 'bucket-header');
      const headerTop = createEl(doc, 'div', 'bucket-header-top');
      const heading = createEl(doc, 'h3', '', `${getBucketPrefix(bucket.id)}${bucket.label}`);
      heading.id = `bucket-heading-${bucket.id}`;
      const countBadge = createEl(doc, 'span', 'badge badge--neutral', formatCount(assignedItems.length));
      bucketCountBadges.set(bucket.id, countBadge);
      headerTop.append(heading, countBadge);

      const desc = createEl(doc, 'p', 'text-muted', bucket.description);
      bucketHeader.append(headerTop, desc);
      bucketCard.appendChild(bucketHeader);

      const listSlot = createEl(doc, 'div');
      if (assignedItems.length > 0) {
        listSlot.appendChild(buildAssignedList(bucket.id));
      }
      bucketListSlots.set(bucket.id, listSlot);
      bucketCard.appendChild(listSlot);

      const assignBtn = createEl(doc, 'button', 'btn btn--secondary bucket-assign-btn', bucket.label);
      assignBtn.type = 'button';
      assignBtn.setAttribute('data-bucket-id', bucket.id);
      assignBtn.setAttribute('aria-label', `Asignar «${challenge.title}» a ${bucket.label}`);
      bucketButtons.push(assignBtn);

      listen(assignBtn, 'click', () => handleAssign(bucket));

      listen(bucketCard, 'dragover', (event) => {
        if (!session.active || session.locked) {
          return;
        }
        event.preventDefault();
        bucketCard.classList.add('is-drop-target');
      });

      listen(bucketCard, 'dragleave', () => {
        bucketCard.classList.remove('is-drop-target');
      });

      listen(bucketCard, 'drop', (event) => {
        event.preventDefault();
        bucketCard.classList.remove('is-drop-target');
        handleAssign(bucket);
      });

      bucketCard.appendChild(assignBtn);
      bucketsGrid.appendChild(bucketCard);
    }

    wrapper.appendChild(bucketsGrid);
    container.replaceChildren(wrapper);
  }

  render();
}
