import { OBJECTIVES, calculateFinalSummary } from '../engine/scoring.js';
import { ROUTES } from '../engine/router.js';

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

const OBJECTIVE_INFO = Object.freeze({
  O1: {
    name: 'Comunicaciones seguras y transporte',
    recommendation:
      'O1 — Transporte seguro: exige HTTPS con TLS 1.2/1.3 en todos los endpoints, valida la cadena de confianza de certificados, elimina contenido mixto y configura HSTS (y preload cuando aplique).'
  },
  O2: {
    name: 'Cifrado, hashing, tokenización y minimización',
    recommendation:
      'O2 — Tratamiento de datos y tarjetas: trata PAN y CVV por separado, nunca conserves CVV después de la autorización (ni cifrado), minimiza datos innecesarios y aplica tokenización sin omitir controles PCI DSS.'
  },
  O3: {
    name: 'Algoritmos, modos criptográficos y prácticas débiles',
    recommendation:
      'O3 — Criptografía vigente: migra contraseñas a Argon2id (o bcrypt en legado), reemplaza AES-ECB por AES-GCM con nonce único por clave y evita RSA sin padding (NoPadding) prefiriendo RSA-OAEP.'
  },
  O4: {
    name: 'Gestión de secretos, claves y aleatoriedad',
    recommendation:
      'O4 — Secretos y entropía: retira claves del código fuente y archivos .env versionados, usa un gestor dedicado de secretos o KMS/HSM en lugar de variables de entorno aisladas, automatiza renovación de certificados y genera tokens con CSPRNG.'
  },
  O5: {
    name: 'Respuesta proporcionada ante incidentes',
    recommendation:
      'O5 — Respuesta ante brechas: contiene sin propagar evidencias sensibles, revoca y rota credenciales comprometidas de inmediato, re-cifra con llaves nuevas y documenta el cierre con controles preventivos en CI.'
  }
});

function formatSignedDelta(delta) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function buildObjectiveReviewData(state, postQuizData) {
  const byObjective = {};
  for (const objId of OBJECTIVES) {
    byObjective[objId] = {
      gameCorrect: 0,
      gameTotal: 0,
      postCorrect: 0,
      postTotal: 0,
      mistakes: []
    };
  }

  for (const levelNum of [1, 2, 3, 4]) {
    const attempt = state?.levels?.[levelNum]?.acceptedAttempt;
    if (!attempt || attempt.failed === true || attempt.completed === false || !Array.isArray(attempt.decisions)) {
      continue;
    }
    attempt.decisions.forEach((dec, idx) => {
      const bucket = byObjective[dec?.objectiveId];
      if (!bucket) return;
      bucket.gameTotal += 1;
      if (dec.isCorrect) {
        bucket.gameCorrect += 1;
      } else {
        bucket.mistakes.push({
          source: `Nivel ${levelNum}`,
          title: dec.title || (dec.challengeId ? `Reto ${dec.challengeId}` : `Decisión #${idx + 1} del Nivel ${levelNum}`),
          explanation: dec.correctControl || OBJECTIVE_INFO[dec.objectiveId].recommendation,
          glossaryTermId: dec.glossaryTermId || null
        });
      }
    });
  }

  const postQuestions = Array.isArray(postQuizData?.questions) ? postQuizData.questions : [];
  const postDecisions = state?.postQuiz?.completed && Array.isArray(state?.postQuiz?.decisions)
    ? state.postQuiz.decisions
    : [];

  for (const dec of postDecisions) {
    const bucket = byObjective[dec?.objectiveId];
    if (!bucket) continue;
    bucket.postTotal += 1;
    if (dec.isCorrect) {
      bucket.postCorrect += 1;
    } else {
      const matchedQ = postQuestions.find(
        (q) => (dec.questionId && q.id === dec.questionId) || q.objectiveId === dec.objectiveId
      );
      bucket.mistakes.push({
        source: 'Test posterior',
        title: matchedQ?.prompt || `Pregunta del test posterior (${dec.objectiveId})`,
        explanation: matchedQ?.explanation || OBJECTIVE_INFO[dec.objectiveId].recommendation,
        glossaryTermId: matchedQ?.glossaryTermId || null
      });
    }
  }

  return byObjective;
}

export function renderResultsView(
  container,
  { state, preQuizData = null, postQuizData = null, onNavigate, onOpenGlossary } = {}
) {
  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];

  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  }

  const acceptedAttempts = [1, 2, 3, 4]
    .map((n) => state?.levels?.[n]?.acceptedAttempt)
    .filter(Boolean);

  const summary = calculateFinalSummary(acceptedAttempts, state?.postQuiz, state?.preQuiz);
  const objectiveReview = buildObjectiveReviewData(state, postQuizData);

  const section = createEl(doc, 'section', 'view-results');
  section.setAttribute('aria-labelledby', 'results-title');

  // Resumen principal y rango
  const summaryCard = createEl(doc, 'article', 'card results-summary');
  const h1 = createEl(doc, 'h1', '', 'Resultados de la auditoría NovaPay');
  h1.id = 'results-title';

  const rankBadge = createEl(doc, 'div', 'rank-badge', `Rango obtenido: ${summary.rank}`);
  const disclaimer = createEl(
    doc,
    'p',
    'text-muted',
    'Nota de diseño: este rango describe tu desempeño dentro del juego y no certifica una competencia profesional.'
  );

  const breakdownGrid = createEl(doc, 'div', 'score-breakdown');

  const statItems = [
    ['Puntaje base final', `${summary.totalBaseScore} / ${summary.totalMaxBaseLevel} pts`],
    ['Porcentaje base', `${summary.basePercent.toFixed(1)} %`],
    ['Puntaje visible total', `${summary.totalVisibleScore} pts`],
    ['Bono opcional de tiempo', `+${summary.totalOptionalTimeBonus} pts`],
    ['Niveles completados', `${summary.completedLevelsCount} / 4`]
  ];

  for (const [label, value] of statItems) {
    const stat = createEl(doc, 'div', 'hud-stat');
    stat.append(
      createEl(doc, 'span', 'hud-stat-label', label),
      createEl(doc, 'span', 'hud-stat-value', value)
    );
    breakdownGrid.appendChild(stat);
  }

  summaryCard.append(h1, rankBadge, disclaimer, breakdownGrid);
  section.appendChild(summaryCard);

  // Tarjetas paralelas: comparación de tests + guía de repaso por objetivo
  const resultsGrid = createEl(doc, 'div', 'results-grid');

  // Comparación test previo / posterior
  const quizCard = createEl(doc, 'article', 'card quiz-comparison');
  quizCard.appendChild(createEl(doc, 'h2', '', 'Evaluación de aprendizaje (O1–O5)'));

  const cmp = summary.quizComparison;
  if (cmp.hasComparison) {
    const scoreLine = createEl(
      doc,
      'p',
      'lead',
      `Evolución: ${cmp.preScore}/${cmp.preTotal} → ${cmp.postScore}/${cmp.postTotal}`
    );
    const deltaEl = createEl(
      doc,
      'p',
      'comparison-delta',
      `Diferencia en aciertos: ${formatSignedDelta(cmp.delta)}`
    );
    quizCard.append(scoreLine, deltaEl);
  } else if (cmp.postScore !== null) {
    const postOnly = createEl(
      doc,
      'p',
      'lead',
      `Resultado del test posterior: ${cmp.postScore}/${cmp.postTotal}`
    );
    const skippedNote = createEl(
      doc,
      'p',
      'text-muted',
      'El test previo fue omitido o no se completó, por lo que no se calcula una comparación previa/posterior.'
    );
    quizCard.append(postOnly, skippedNote);
  } else {
    quizCard.appendChild(
      createEl(doc, 'p', 'text-muted', 'Aún no hay resultados registrados del test posterior.')
    );
  }

  quizCard.appendChild(
    createEl(
      doc,
      'p',
      'text-muted',
      'Cinco preguntas constituyen un indicador introductorio de comprensión, no una evaluación científica formal.'
    )
  );

  // Soluciones del test previo (reveladas solo en la pantalla final)
  if (state?.preQuiz?.completed && Array.isArray(preQuizData?.questions) && preQuizData.questions.length > 0) {
    const details = createEl(doc, 'details', 'card');
    const summaryEl = createEl(doc, 'summary', '', 'Revisar soluciones del test previo');
    const reviewList = createEl(doc, 'div', 'quiz-review-list');
    preQuizData.questions.forEach((q, idx) => {
      const dec = state.preQuiz.decisions.find((d) => d.questionId === q.id || d.objectiveId === q.objectiveId);
      const item = createEl(doc, 'div', 'quiz-review-item');
      const statusText = dec
        ? dec.isCorrect
          ? `✓ P${idx + 1} (${q.objectiveId}) — Acertaste`
          : `✕ P${idx + 1} (${q.objectiveId}) — Respuesta a reforzar`
        : `P${idx + 1} (${q.objectiveId})`;
      item.append(
        createEl(doc, 'strong', '', statusText),
        createEl(doc, 'p', 'text-muted', q.explanation)
      );
      reviewList.appendChild(item);
    });
    details.append(summaryEl, reviewList);
    quizCard.appendChild(details);
  }

  // Guía de repaso por objetivo (desempeño separado + errores desplegables con glosario)
  const weakCard = createEl(doc, 'article', 'card weakest-objective-card');
  weakCard.appendChild(createEl(doc, 'h2', '', 'Guía de repaso por objetivo'));

  const weak = summary.weakestObjective;
  const weakInfo = OBJECTIVE_INFO[weak.objectiveId] || OBJECTIVE_INFO.O1;
  const weakSummary = weak.hasData
    ? `Objetivo prioritario a reforzar: ${weak.objectiveId} — ${weakInfo.name} (${Math.round(weak.rate * 100)} % de acierto).`
    : 'Aún no hay decisiones evaluadas para determinar el objetivo más débil.';
  weakCard.append(
    createEl(doc, 'p', '', weakSummary),
    createEl(
      doc,
      'p',
      'text-muted',
      `Fuente del cálculo: ${weak.sourceDescription}. Abre cada objetivo para revisar aciertos por separado y consultar tus fallos.`
    )
  );

  const objList = createEl(doc, 'ul', 'objective-breakdown-list');
  for (const objId of OBJECTIVES) {
    const entry = weak.breakdown[objId] || { correct: 0, total: 0, rate: null };
    const rev = objectiveReview[objId];
    const info = OBJECTIVE_INFO[objId];
    const row = createEl(doc, 'li', 'objective-breakdown-row');

    const details = createEl(doc, 'details', 'objective-review-details');
    const summaryToggle = createEl(doc, 'summary', 'objective-review-summary');

    summaryToggle.appendChild(createEl(doc, 'span', 'objective-summary-title', `${objId}: ${info.name}`));

    const metrics = createEl(doc, 'span', 'objective-summary-metrics');
    const gameLabel = rev.gameTotal > 0 ? `Partida: ${rev.gameCorrect}/${rev.gameTotal}` : 'Partida: —';
    const postLabel = rev.postTotal > 0 ? `Test posterior: ${rev.postCorrect}/${rev.postTotal}` : 'Test posterior: —';
    const totalLabel = entry.total > 0 ? `Total: ${Math.round(entry.rate * 100)} %` : 'Sin datos';

    metrics.append(
      createEl(doc, 'span', 'badge badge--neutral', gameLabel),
      createEl(doc, 'span', 'badge badge--neutral', postLabel),
      createEl(
        doc,
        'span',
        `badge ${entry.total > 0 ? (rev.mistakes.length === 0 ? 'badge--safe' : 'badge--warning') : 'badge--neutral'}`,
        totalLabel
      )
    );
    summaryToggle.appendChild(metrics);

    const body = createEl(doc, 'div', 'objective-review-body');
    if (rev.mistakes.length === 0) {
      body.appendChild(
        createEl(
          doc,
          'p',
          'text-muted',
          entry.total > 0
            ? '✓ Sin errores registrados en este objetivo durante el intento aceptado y el test posterior.'
            : 'Aún no existen decisiones registradas para este objetivo.'
        )
      );
    } else {
      body.appendChild(
        createEl(
          doc,
          'p',
          'text-muted',
          `Elementos a repasar (${rev.mistakes.length}):`
        )
      );
      const mistakeList = createEl(doc, 'ul', 'objective-mistake-list');
      for (const m of rev.mistakes) {
        const li = createEl(doc, 'li', 'objective-mistake-item');
        li.append(
          createEl(doc, 'span', 'badge badge--danger', m.source),
          createEl(doc, 'strong', '', m.title),
          createEl(doc, 'p', 'text-muted', m.explanation)
        );
        if (m.glossaryTermId) {
          const gBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', `Abrir término en glosario (${m.glossaryTermId})`);
          gBtn.type = 'button';
          listen(gBtn, 'click', () => onOpenGlossary?.({ triggerEl: gBtn, termId: m.glossaryTermId }));
          li.appendChild(gBtn);
        }
        mistakeList.appendChild(li);
      }
      body.appendChild(mistakeList);
    }

    details.append(summaryToggle, body);
    row.appendChild(details);
    objList.appendChild(row);
  }
  weakCard.appendChild(objList);

  resultsGrid.append(quizCard, weakCard);
  section.appendChild(resultsGrid);

  // Cinco recomendaciones (priorizando el objetivo más débil primero)
  const recCard = createEl(doc, 'article', 'card');
  recCard.appendChild(createEl(doc, 'h2', '', 'Cinco recomendaciones prácticas de seguridad'));
  const orderedObjectives = [
    weak.objectiveId,
    ...OBJECTIVES.filter((id) => id !== weak.objectiveId)
  ];
  const recList = createEl(doc, 'ol', 'recommendations-list');
  for (const objId of orderedObjectives) {
    recList.appendChild(createEl(doc, 'li', 'recommendation-item', OBJECTIVE_INFO[objId].recommendation));
  }
  recCard.appendChild(recList);
  section.appendChild(recCard);

  // Acciones finales
  const actionsRow = createEl(doc, 'div', 'results-actions');

  const retryBtn = createEl(doc, 'button', 'btn btn--primary', 'Reintentar desde Nivel 1');
  retryBtn.type = 'button';
  listen(retryBtn, 'click', () => onNavigate?.(ROUTES.NIVEL_1));

  const homeBtn = createEl(doc, 'button', 'btn btn--secondary', 'Volver a inicio');
  homeBtn.type = 'button';
  listen(homeBtn, 'click', () => onNavigate?.(ROUTES.INICIO));

  const glossaryBtn = createEl(doc, 'button', 'btn btn--ghost', 'Repasar glosario');
  glossaryBtn.type = 'button';
  listen(glossaryBtn, 'click', () => onOpenGlossary?.({ triggerEl: glossaryBtn }));

  actionsRow.append(retryBtn, homeBtn, glossaryBtn);
  section.appendChild(actionsRow);

  container.replaceChildren(section);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };
}
