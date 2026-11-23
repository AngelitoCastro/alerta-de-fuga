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

export function renderQuizView(
  container,
  { type, quizData, onComplete, onSkip, onOpenGlossary, onNavigateNext } = {}
) {
  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];
  const questions = Array.isArray(quizData?.questions) ? quizData.questions : [];
  const isPre = type === 'pre';

  let currentIndex = 0;
  let selectedOptionId = null;
  let postAnswered = false;
  let validationMessage = '';
  const decisions = [];

  function clearListeners() {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  }

  function listen(el, eventType, handler) {
    el.addEventListener(eventType, handler);
    cleanups.push(() => el.removeEventListener(eventType, handler));
  }

  function renderFinishedSummary() {
    clearListeners();
    const score = decisions.filter((d) => d.isCorrect).length;
    const total = questions.length || 5;

    const section = createEl(doc, 'section', 'view-quiz');
    const shell = createEl(doc, 'div', 'quiz-shell');
    const card = createEl(doc, 'article', 'card quiz-question-card');

    const h1 = createEl(
      doc,
      'h1',
      '',
      isPre ? 'Test previo registrado' : 'Test posterior completado'
    );
    const intro = createEl(
      doc,
      'p',
      'lead',
      isPre
        ? 'Tus respuestas iniciales se guardaron. Las soluciones y la comparación se mostrarán al terminar la partida en la pantalla de resultados.'
        : `Obtuviste ${score}/${total} aciertos en el test posterior (indicador introductorio sobre O1–O5).`
    );

    const actions = createEl(doc, 'div', 'quiz-actions');
    const continueBtn = createEl(
      doc,
      'button',
      'btn btn--primary',
      isPre ? 'Continuar al Nivel 1' : 'Ver pantalla de resultados'
    );
    continueBtn.type = 'button';
    listen(continueBtn, 'click', () => onNavigateNext?.());
    actions.appendChild(continueBtn);

    card.append(h1, intro, actions);
    shell.appendChild(card);

    if (!isPre) {
      const reviewSection = createEl(doc, 'div', 'quiz-review-list');
      questions.forEach((q, idx) => {
        const dec = decisions[idx];
        const item = createEl(doc, 'article', 'quiz-review-item');
        const statusBadge = createEl(
          doc,
          'span',
          `badge ${dec?.isCorrect ? 'badge--safe' : 'badge--danger'}`,
          dec?.isCorrect ? `✓ Pregunta ${idx + 1} (${q.objectiveId}): Correcta` : `✕ Pregunta ${idx + 1} (${q.objectiveId}): Revisar`
        );
        const qText = createEl(doc, 'p', '', q.prompt);
        const expText = createEl(doc, 'p', 'text-muted', q.explanation);
        item.append(statusBadge, qText, expText);
        reviewSection.appendChild(item);
      });
      shell.appendChild(reviewSection);
    }

    section.appendChild(shell);
    container.replaceChildren(section);
  }

  function renderQuestion() {
    clearListeners();

    if (currentIndex >= questions.length) {
      renderFinishedSummary();
      return;
    }

    const q = questions[currentIndex];
    const section = createEl(doc, 'section', 'view-quiz');
    const shell = createEl(doc, 'div', 'quiz-shell');

    const h1 = createEl(
      doc,
      'h1',
      '',
      isPre ? 'Test previo (diagnóstico opcional)' : 'Test posterior (evaluación final)'
    );
    const subtitle = createEl(
      doc,
      'p',
      'text-muted',
      isPre
        ? 'Cinco preguntas breves para estimar tu punto de partida sobre O1–O5. No mostraremos soluciones hasta la pantalla de resultados; también puedes omitirlo.'
        : 'Cinco preguntas equivalentes con escenarios distintos para repasar O1–O5 antes de ver tus resultados.'
    );

    const progressRow = createEl(doc, 'div', 'quiz-progress');
    progressRow.append(
      createEl(doc, 'span', '', `Pregunta ${currentIndex + 1} / ${questions.length}`),
      createEl(doc, 'span', 'badge badge--info', `Objetivo ${q.objectiveId}`)
    );

    const card = createEl(doc, 'article', 'card quiz-question-card');
    const promptEl = createEl(doc, 'h2', '', q.prompt);
    card.appendChild(promptEl);

    const optionList = createEl(doc, 'ul', 'option-list');
    optionList.setAttribute('role', 'group');
    optionList.setAttribute('aria-label', `Opciones de la pregunta ${currentIndex + 1}`);

    for (const opt of q.options) {
      const li = createEl(doc, 'li');
      const isSelected = selectedOptionId === opt.id;
      let extraClass = '';
      if (postAnswered) {
        if (opt.id === q.correctOptionId) {
          extraClass = ' is-correct';
        } else if (isSelected && opt.id !== q.correctOptionId) {
          extraClass = ' is-incorrect';
        }
      } else if (isSelected) {
        extraClass = ' is-selected';
      }

      const btn = createEl(doc, 'button', `btn option-btn${extraClass}`, opt.label);
      btn.type = 'button';
      btn.setAttribute('data-option-id', opt.id);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.disabled = postAnswered;

      listen(btn, 'click', () => {
        if (postAnswered) {
          return;
        }
        selectedOptionId = opt.id;
        validationMessage = '';
        renderQuestion();
      });

      li.appendChild(btn);
      optionList.appendChild(li);
    }

    card.appendChild(optionList);

    if (validationMessage) {
      const warn = createEl(doc, 'p', 'alert alert--warning', validationMessage);
      warn.setAttribute('role', 'alert');
      card.appendChild(warn);
    }

    if (!isPre && postAnswered) {
      const isCorrect = selectedOptionId === q.correctOptionId;
      const feedbackBox = createEl(
        doc,
        'div',
        `feedback-panel ${isCorrect ? 'feedback-panel--safe' : 'feedback-panel--danger'}`
      );
      feedbackBox.append(
        createEl(
          doc,
          'strong',
          '',
          isCorrect ? '✓ Respuesta correcta' : '✕ Respuesta incorrecta'
        ),
        createEl(doc, 'p', '', q.explanation)
      );

      const refsRow = createEl(doc, 'div', 'feedback-refs');
      if (q.glossaryTermId) {
        const gBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', 'Consultar término en glosario');
        gBtn.type = 'button';
        listen(gBtn, 'click', () => onOpenGlossary?.({ triggerEl: gBtn, termId: q.glossaryTermId }));
        refsRow.appendChild(gBtn);
      }
      if (isSafeHttps(q.owaspRef)) {
        const refLink = createEl(doc, 'a', '', 'Referencia técnica (OWASP / norma)');
        refLink.setAttribute('href', q.owaspRef);
        refLink.setAttribute('target', '_blank');
        refLink.setAttribute('rel', 'noopener noreferrer');
        refsRow.appendChild(refLink);
      }
      feedbackBox.appendChild(refsRow);
      card.appendChild(feedbackBox);
    }

    const actions = createEl(doc, 'div', 'quiz-actions');

    if (isPre) {
      const skipBtn = createEl(doc, 'button', 'btn btn--ghost', 'Omitir test previo');
      skipBtn.type = 'button';
      listen(skipBtn, 'click', () => onSkip?.());
      actions.appendChild(skipBtn);
    }

    const isLast = currentIndex === questions.length - 1;
    let primaryLabel = isLast ? 'Finalizar cuestionario' : 'Siguiente pregunta';
    if (!isPre && !postAnswered) {
      primaryLabel = 'Confirmar respuesta';
    } else if (!isPre && postAnswered) {
      primaryLabel = isLast ? 'Finalizar y ver resultados' : 'Siguiente pregunta';
    }

    const primaryBtn = createEl(doc, 'button', 'btn btn--primary', primaryLabel);
    primaryBtn.type = 'button';

    listen(primaryBtn, 'click', () => {
      if (!selectedOptionId) {
        validationMessage = 'Selecciona una opción antes de continuar.';
        announce(validationMessage);
        renderQuestion();
        return;
      }

      if (!isPre && !postAnswered) {
        const isCorrect = selectedOptionId === q.correctOptionId;
        decisions.push({
          questionId: q.id,
          objectiveId: q.objectiveId,
          selectedOptionId,
          isCorrect
        });
        postAnswered = true;
        announce(isCorrect ? 'Respuesta correcta.' : 'Respuesta incorrecta. Revisa la explicación.');
        renderQuestion();
        return;
      }

      if (isPre) {
        const isCorrect = selectedOptionId === q.correctOptionId;
        decisions.push({
          questionId: q.id,
          objectiveId: q.objectiveId,
          selectedOptionId,
          isCorrect
        });
      }

      currentIndex += 1;
      selectedOptionId = null;
      postAnswered = false;
      validationMessage = '';

      if (currentIndex >= questions.length) {
        const score = decisions.filter((d) => d.isCorrect).length;
        onComplete?.({
          score,
          total: questions.length,
          decisions: decisions.map((d) => ({ ...d }))
        });
        renderFinishedSummary();
      } else {
        renderQuestion();
      }
    });

    actions.appendChild(primaryBtn);
    card.appendChild(actions);

    shell.append(h1, subtitle, progressRow, card);
    section.appendChild(shell);
    container.replaceChildren(section);
  }

  renderQuestion();

  return () => {
    clearListeners();
  };
}
