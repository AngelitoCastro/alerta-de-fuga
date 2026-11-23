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

export function renderResultsView(
  container,
  { state, preQuizData = null, onNavigate, onOpenGlossary } = {}
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

  // Tarjetas paralelas: comparación de tests + objetivo más débil
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

  // Objetivo más débil y desglose O1-O5
  const weakCard = createEl(doc, 'article', 'card weakest-objective-card');
  weakCard.appendChild(createEl(doc, 'h2', '', 'Desempeño por objetivo'));

  const weak = summary.weakestObjective;
  const weakInfo = OBJECTIVE_INFO[weak.objectiveId] || OBJECTIVE_INFO.O1;
  const weakSummary = weak.hasData
    ? `Objetivo prioritario a reforzar: ${weak.objectiveId} — ${weakInfo.name} (${Math.round(weak.rate * 100)} % de acierto).`
    : 'Aún no hay decisiones evaluadas para determinar el objetivo más débil.';
  weakCard.append(
    createEl(doc, 'p', '', weakSummary),
    createEl(doc, 'p', 'text-muted', `Fuente del cálculo: ${weak.sourceDescription}.`)
  );

  const objList = createEl(doc, 'ul', 'objective-breakdown-list');
  for (const objId of OBJECTIVES) {
    const entry = weak.breakdown[objId] || { correct: 0, total: 0, rate: null };
    const info = OBJECTIVE_INFO[objId];
    const row = createEl(doc, 'li', 'objective-breakdown-row');
    row.append(
      createEl(doc, 'span', '', `${objId}: ${info.name}`),
      createEl(
        doc,
        'span',
        'badge badge--neutral',
        entry.total > 0 ? `${entry.correct}/${entry.total} (${Math.round(entry.rate * 100)} %)` : 'Sin datos'
      )
    );
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
