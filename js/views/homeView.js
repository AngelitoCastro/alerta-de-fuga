import { ROUTES } from '../engine/router.js';
import { isLevelCompleted } from '../engine/state.js';

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

const LEVEL_CATALOG = [
  {
    number: 1,
    route: ROUTES.NIVEL_1,
    phaseTag: 'FASE 01',
    title: 'Nivel 1: El Túnel Abierto',
    mechanic: 'Inspección de tráfico',
    objectives: 'O1 · Transporte, TLS y HSTS',
    summary: 'Audita seis solicitudes de red simuladas de NovaPay frente a HTTP plano, TLS obsoleto, certificados y HSTS.'
  },
  {
    number: 2,
    route: ROUTES.NIVEL_2,
    phaseTag: 'FASE 02',
    title: 'Nivel 2: La Bóveda de Texto Plano',
    mechanic: 'Protección de datos',
    objectives: 'O2, O3, O5 · Hash, AES-GCM, PAN/CVV',
    summary: 'Clasifica ocho registros sensibles mediante teclado, toque o arrastre según OWASP A04 y PCI DSS.'
  },
  {
    number: 3,
    route: ROUTES.NIVEL_3,
    phaseTag: 'FASE 03',
    title: 'Nivel 3: Llaves bajo el Tapete',
    mechanic: 'Auditoría de código',
    objectives: 'O3, O4 · Secretos, CSPRNG y RSA-OAEP',
    summary: 'Marca la línea vulnerable y selecciona la corrección técnica en seis archivos simulados del repositorio.'
  },
  {
    number: 4,
    route: ROUTES.NIVEL_4,
    phaseTag: 'FASE 04',
    title: 'Nivel 4: Simulacro de Brecha',
    mechanic: 'Respuesta al incidente',
    objectives: 'O1–O5 · 6 fases ramificadas',
    summary: 'Coordina la contención de una filtración en NovaPay y observa las consecuencias reales de cada decisión.'
  }
];

export function renderHomeView(
  container,
  { state, isMemoryFallback = false, onNavigate, onOpenGuide, onOpenSettings, onOpenGlossary } = {}
) {
  const doc = container.ownerDocument || globalThis.document;
  const cleanups = [];

  function listen(el, type, handler) {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  }

  const completedCount = [1, 2, 3, 4].filter((n) => isLevelCompleted(state, n)).length;
  const allLevelsDone = completedCount === 4;
  const postDone = Boolean(state?.postQuiz?.completed);
  const unlockedLevel = Number.isFinite(state?.unlockedLevel) ? state.unlockedLevel : 1;
  const nextLevelNum = Math.max(1, Math.min(4, unlockedLevel));

  const section = createEl(doc, 'section', 'view-home');
  section.setAttribute('aria-labelledby', 'home-title');

  // Portada cinematográfica ilustrada (Tropical Cybercrime Thriller)
  const heroCinema = createEl(doc, 'div', 'hero-cinema');

  const heroMedia = createEl(doc, 'div', 'hero-cinema-media');
  const coverImg = createEl(doc, 'img', 'hero-cinema-img');
  coverImg.setAttribute('src', 'assets/hero-cover.webp');
  coverImg.setAttribute('srcset', 'assets/hero-cover-mobile.webp 640w, assets/hero-cover.webp 1280w');
  coverImg.setAttribute('sizes', '(max-width: 767px) 100vw, 1280px');
  coverImg.setAttribute(
    'alt',
    'Analistas forenses de NovaPay inspeccionando alertas criptográficas frente a la ciudad costera de Costa Esmeralda al atardecer'
  );
  coverImg.setAttribute('width', '1280');
  coverImg.setAttribute('height', '714');

  const scrim = createEl(doc, 'div', 'hero-cinema-scrim');
  scrim.setAttribute('aria-hidden', 'true');
  heroMedia.append(coverImg, scrim);

  const heroContent = createEl(doc, 'div', 'hero-cinema-content');

  const missionKicker = createEl(doc, 'span', 'mission-kicker');
  const beacon = createEl(doc, 'span', `status-beacon${allLevelsDone ? ' status-beacon--safe' : ''}`);
  beacon.setAttribute('aria-hidden', 'true');
  missionKicker.append(beacon, 'INCIDENTE NOVAPAY · COSTA ESMERALDA · OWASP A04:2025');

  const h1 = createEl(doc, 'h1', 'hero-brand-title', 'Alerta de Fuga');
  h1.id = 'home-title';

  const brandRule = createEl(doc, 'div', 'hero-brand-rule');
  brandRule.setAttribute('aria-hidden', 'true');

  const lead = createEl(
    doc,
    'p',
    'lead',
    'La información está en riesgo. Tu misión es contener la fuga en los sistemas simulados de NovaPay.'
  );

  const heroActions = createEl(doc, 'div', 'hero-actions');

  const primaryLabel = completedCount === 0
    ? 'Iniciar misión'
    : allLevelsDone && !postDone
      ? 'Ir al test posterior'
      : allLevelsDone && postDone
        ? 'Ver resultados finales'
        : `Continuar misión (Nivel ${nextLevelNum})`;
  const primaryTarget = completedCount === 0
    ? ROUTES.NIVEL_1
    : allLevelsDone && !postDone
      ? ROUTES.QUIZ_POST
      : allLevelsDone && postDone
        ? ROUTES.RESULTADOS
        : `nivel-${nextLevelNum}`;

  const startAuditBtn = createEl(doc, 'button', 'btn btn--primary cta-launch', primaryLabel);
  startAuditBtn.type = 'button';
  listen(startAuditBtn, 'click', () => onNavigate?.(primaryTarget));

  const preQuizLabel = state?.preQuiz?.completed
    ? 'Repetir test previo (5 preguntas)'
    : 'Evaluar mis conocimientos (test previo)';
  const startPreBtn = createEl(doc, 'button', 'btn btn--secondary', preQuizLabel);
  startPreBtn.type = 'button';
  listen(startPreBtn, 'click', () => onNavigate?.(ROUTES.QUIZ_PRE));

  const guideBtn = createEl(doc, 'button', 'btn btn--ghost', 'Guía visual (1 min)');
  guideBtn.type = 'button';
  listen(guideBtn, 'click', () => onOpenGuide?.(guideBtn));

  heroActions.append(startAuditBtn, startPreBtn, guideBtn);

  const preNote = createEl(
    doc,
    'p',
    'text-muted',
    'Puedes iniciar el Nivel 1 de inmediato o realizar primero el test previo opcional (5 preguntas). Todo es simulado y se guarda localmente sin datos personales.'
  );

  // Franja de estado real de la operación (sin métricas ficticias)
  const missionStrip = createEl(doc, 'div', 'hero-mission-strip');
  const missionMeta = createEl(doc, 'div', 'hero-mission-meta');
  missionMeta.append(
    createEl(doc, 'span', 'badge badge--info', `Capítulos completados: ${completedCount}/4`),
    createEl(
      doc,
      'span',
      'badge badge--neutral',
      state?.settings?.timerEnabled ? 'Temporizador: activado' : 'Temporizador: desactivado'
    )
  );

  const socNodes = createEl(doc, 'div', 'soc-nodes-grid');
  const sectorLabels = ['01 Red', '02 Bóveda', '03 Código', '04 Brecha'];
  sectorLabels.forEach((label, idx) => {
    const num = idx + 1;
    const done = isLevelCompleted(state, num);
    const active = !done && num === nextLevelNum;
    const node = createEl(
      doc,
      'div',
      `soc-node${done ? ' is-done' : active ? ' is-active' : ''}`,
      `${done ? '✓' : active ? '●' : '○'} ${label}`
    );
    socNodes.appendChild(node);
  });

  const progressTrack = createEl(doc, 'div', 'mission-progress-track');
  progressTrack.setAttribute('aria-hidden', 'true');
  for (let n = 1; n <= 4; n += 1) {
    const segDone = isLevelCompleted(state, n);
    const segCurrent = !segDone && n === nextLevelNum;
    progressTrack.appendChild(
      createEl(
        doc,
        'span',
        `mission-progress-segment${segDone ? ' is-done' : segCurrent ? ' is-current' : ''}`
      )
    );
  }

  missionStrip.append(missionMeta, socNodes, progressTrack);

  heroContent.append(missionKicker, h1, brandRule, lead, heroActions, preNote, missionStrip);
  heroCinema.append(heroMedia, heroContent);
  section.appendChild(heroCinema);

  if (isMemoryFallback) {
    const notice = createEl(
      doc,
      'div',
      'alert alert--warning',
      'Modo de sesión en memoria: el almacenamiento local del navegador no está disponible, pero puedes completar toda la partida sin restricciones.'
    );
    section.appendChild(notice);
  }

  // Selección de capítulos / expediente forense (4 niveles reales)
  const roadmapSection = createEl(doc, 'section', '');
  roadmapSection.setAttribute('aria-labelledby', 'roadmap-heading');
  const roadmapHeader = createEl(doc, 'div', 'section-header');
  const roadmapH2 = createEl(doc, 'h2', '', 'Selección de capítulos · Expediente NovaPay');
  roadmapH2.id = 'roadmap-heading';
  const roadmapSub = createEl(
    doc,
    'p',
    'text-muted',
    'Cada capítulo desbloquea el siguiente; puedes reintentar cualquier fase completada.'
  );
  roadmapHeader.append(roadmapH2, roadmapSub);

  const grid = createEl(doc, 'div', 'level-roadmap');

  for (const item of LEVEL_CATALOG) {
    const completed = isLevelCompleted(state, item.number);
    const unlocked = unlockedLevel >= item.number;
    const entry = state?.levels?.[item.number];

    const stateClass = completed ? 'is-completed' : unlocked ? 'is-unlocked' : 'is-locked';
    const card = createEl(doc, 'article', `level-card ${stateClass}`);
    card.setAttribute('data-sector', String(item.number));

    const topMeta = createEl(doc, 'div', 'level-card-header');
    const sectorTag = createEl(doc, 'span', 'sector-tag', `${item.phaseTag} · ${item.mechanic.toUpperCase()}`);
    const badgeClass = completed ? 'badge--safe' : unlocked ? 'badge--info' : 'badge--neutral';
    const badgeLabel = completed ? '✓ Completado' : unlocked ? 'Disponible' : 'Bloqueado';
    topMeta.append(sectorTag, createEl(doc, 'span', `badge ${badgeClass}`, badgeLabel));

    const titleEl = createEl(doc, 'h3', 'level-card-title', item.title);

    const meta = createEl(doc, 'div', 'level-card-meta');
    meta.append(createEl(doc, 'span', '', item.objectives));
    if (completed && entry?.acceptedAttempt) {
      meta.appendChild(
        createEl(
          doc,
          'span',
          'badge badge--safe',
          `Aceptado: ${entry.acceptedAttempt.baseScore}/${entry.acceptedAttempt.maxBaseLevel} pts base`
        )
      );
    }

    const summary = createEl(doc, 'p', '', item.summary);

    const actions = createEl(doc, 'div', 'level-card-actions');
    const actionBtn = createEl(
      doc,
      'button',
      `btn btn--block ${completed ? 'btn--secondary' : unlocked ? 'btn--primary' : 'btn--ghost'}`,
      completed ? `Reintentar Nivel ${item.number}` : unlocked ? `Desplegar Nivel ${item.number}` : `Nivel ${item.number} bloqueado`
    );
    actionBtn.type = 'button';
    actionBtn.disabled = !unlocked;
    if (unlocked) {
      listen(actionBtn, 'click', () => onNavigate?.(item.route));
    }
    actions.appendChild(actionBtn);

    card.append(topMeta, titleEl, meta, summary, actions);
    grid.appendChild(card);
  }

  roadmapSection.append(roadmapHeader, grid);
  section.appendChild(roadmapSection);

  container.replaceChildren(section);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };
}
