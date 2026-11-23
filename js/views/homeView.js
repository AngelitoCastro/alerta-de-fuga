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
    title: 'Nivel 1: El Túnel Abierto',
    mechanic: 'Inspector de solicitudes de red',
    objectives: 'O1 · Protección en tránsito, TLS, certificados y HSTS',
    summary: 'Analiza seis solicitudes HTTP/HTTPS simuladas y decide si permitirlas, exigir configuración segura o bloquearlas.'
  },
  {
    number: 2,
    route: ROUTES.NIVEL_2,
    title: 'Nivel 2: La Bóveda de Texto Plano',
    mechanic: 'Clasificador de datos en reposo',
    objectives: 'O2, O3, O5 · Hash de contraseñas, AES-GCM, PAN/CVV y minimización',
    summary: 'Asigna ocho registros simulados al control adecuado usando selección por teclado/botones o arrastre en escritorio.'
  },
  {
    number: 3,
    route: ROUTES.NIVEL_3,
    title: 'Nivel 3: Llaves bajo el Tapete',
    mechanic: 'Búsqueda de errores en repositorio simulado',
    objectives: 'O3, O4 · Gestión de secretos, CSPRNG, certificados y RSA-OAEP',
    summary: 'Localiza la línea vulnerable en seis archivos ficticios no ejecutables y selecciona la remediación correcta.'
  },
  {
    number: 4,
    route: ROUTES.NIVEL_4,
    title: 'Nivel 4: Simulacro de Brecha',
    mechanic: 'Respuesta ramificada en 6 fases',
    objectives: 'O1–O5 · Integración completa de respuesta a incidentes',
    summary: 'Contiene una filtración simulada de NovaPay desde la detección hasta el cierre formal con línea de tiempo.'
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

  const section = createEl(doc, 'section', 'view-home');
  section.setAttribute('aria-labelledby', 'home-title');

  // Hero
  const heroGrid = createEl(doc, 'div', 'hero-grid');
  const heroCopy = createEl(doc, 'div', 'hero-copy card');

  const h1 = createEl(doc, 'h1', '', 'Auditoría criptográfica de NovaPay');
  h1.id = 'home-title';

  const lead = createEl(
    doc,
    'p',
    'lead',
    'NovaPay presenta indicios de exposición de datos. Como analista junior de seguridad, auditarás cuatro componentes del sistema para identificar fallas criptográficas (OWASP Top 10:2025 A04) y elegir controles adecuados.'
  );

  const missionNote = createEl(
    doc,
    'p',
    'text-muted',
    'Sin registro ni datos personales: todo se ejecuta localmente en tu navegador con registros y archivos ficticios no ejecutables.'
  );

  const heroActions = createEl(doc, 'div', 'hero-actions');

  const preQuizLabel = state?.preQuiz?.completed
    ? 'Repetir test previo'
    : 'Comenzar con test previo';
  const startPreBtn = createEl(doc, 'button', 'btn btn--primary', preQuizLabel);
  startPreBtn.type = 'button';
  listen(startPreBtn, 'click', () => onNavigate?.(ROUTES.QUIZ_PRE));

  const nextLevelNum = Math.max(1, Math.min(4, state?.unlockedLevel || 1));
  const jumpBtn = createEl(
    doc,
    'button',
    'btn btn--secondary',
    completedCount === 0 ? 'Ir directo al Nivel 1' : `Continuar en Nivel ${nextLevelNum}`
  );
  jumpBtn.type = 'button';
  listen(jumpBtn, 'click', () => onNavigate?.(`nivel-${nextLevelNum}`));

  const guideBtn = createEl(doc, 'button', 'btn btn--ghost', 'Guía visual (1 min)');
  guideBtn.type = 'button';
  listen(guideBtn, 'click', () => onOpenGuide?.(guideBtn));

  heroActions.append(startPreBtn, jumpBtn, guideBtn);

  if (allLevelsDone && !postDone) {
    const postBtn = createEl(doc, 'button', 'btn btn--safe', 'Completar test posterior');
    postBtn.type = 'button';
    listen(postBtn, 'click', () => onNavigate?.(ROUTES.QUIZ_POST));
    heroActions.appendChild(postBtn);
  }

  if (allLevelsDone && postDone) {
    const resultsBtn = createEl(doc, 'button', 'btn btn--safe', 'Ver resultados finales');
    resultsBtn.type = 'button';
    listen(resultsBtn, 'click', () => onNavigate?.(ROUTES.RESULTADOS));
    heroActions.appendChild(resultsBtn);
  }

  heroCopy.append(h1, lead, missionNote, heroActions);

  // Hero visual & status card
  const heroVisual = createEl(doc, 'div', 'hero-visual card');
  const img = createEl(doc, 'img', 'hero-illustration');
  img.setAttribute('src', 'assets/analyst.svg');
  img.setAttribute('alt', 'Consola de auditoría criptográfica de NovaPay supervisando tráfico y controles');
  img.setAttribute('width', '320');
  img.setAttribute('height', '240');

  const statusMeta = createEl(doc, 'div', 'level-card-meta');
  statusMeta.append(
    createEl(doc, 'span', 'badge badge--info', `Niveles completados: ${completedCount}/4`),
    createEl(
      doc,
      'span',
      'badge badge--neutral',
      state?.settings?.timerEnabled ? 'Temporizador: activado' : 'Temporizador: desactivado'
    )
  );

  const quickTools = createEl(doc, 'div', 'hero-actions');
  const quickGlossaryBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', 'Abrir glosario');
  quickGlossaryBtn.type = 'button';
  listen(quickGlossaryBtn, 'click', () => onOpenGlossary?.({ triggerEl: quickGlossaryBtn }));

  const quickSettingsBtn = createEl(doc, 'button', 'btn btn--secondary btn--sm', 'Ajustes');
  quickSettingsBtn.type = 'button';
  listen(quickSettingsBtn, 'click', () => onOpenSettings?.(quickSettingsBtn));
  quickTools.append(quickGlossaryBtn, quickSettingsBtn);

  heroVisual.append(img, statusMeta, quickTools);
  heroGrid.append(heroCopy, heroVisual);
  section.appendChild(heroGrid);

  if (isMemoryFallback) {
    const notice = createEl(
      doc,
      'div',
      'alert alert--warning',
      'Modo de sesión en memoria: el almacenamiento local del navegador no está disponible, pero puedes completar toda la partida sin restricciones.'
    );
    section.appendChild(notice);
  }

  // Roadmap de niveles
  const roadmapSection = createEl(doc, 'section', '');
  roadmapSection.setAttribute('aria-labelledby', 'roadmap-heading');
  const roadmapHeader = createEl(doc, 'div', 'section-header');
  const roadmapH2 = createEl(doc, 'h2', '', 'Ruta de auditoría (4 niveles)');
  roadmapH2.id = 'roadmap-heading';
  const roadmapSub = createEl(
    doc,
    'p',
    'text-muted',
    'Completa cada nivel para desbloquear el siguiente. Puedes reintentar cualquier nivel completado.'
  );
  roadmapHeader.append(roadmapH2, roadmapSub);

  const grid = createEl(doc, 'div', 'level-roadmap');
  const unlockedLevel = Number.isFinite(state?.unlockedLevel) ? state.unlockedLevel : 1;

  for (const item of LEVEL_CATALOG) {
    const completed = isLevelCompleted(state, item.number);
    const unlocked = unlockedLevel >= item.number;
    const entry = state?.levels?.[item.number];

    const stateClass = completed ? 'is-completed' : unlocked ? 'is-unlocked' : 'is-locked';
    const card = createEl(doc, 'article', `level-card ${stateClass}`);

    const cardHeader = createEl(doc, 'div', 'level-card-header');
    cardHeader.appendChild(createEl(doc, 'h3', 'level-card-title', item.title));

    const badgeClass = completed ? 'badge--safe' : unlocked ? 'badge--info' : 'badge--neutral';
    const badgeLabel = completed ? '✓ Completado' : unlocked ? 'Disponible' : 'Bloqueado';
    cardHeader.appendChild(createEl(doc, 'span', `badge ${badgeClass}`, badgeLabel));

    const meta = createEl(doc, 'div', 'level-card-meta');
    meta.append(
      createEl(doc, 'span', '', `Mecánica: ${item.mechanic}`),
      createEl(doc, 'span', '', item.objectives)
    );
    if (completed && entry?.acceptedAttempt) {
      meta.appendChild(
        createEl(
          doc,
          'span',
          '',
          `Último intento aceptado: ${entry.acceptedAttempt.baseScore}/${entry.acceptedAttempt.maxBaseLevel} pts base`
        )
      );
    }

    const summary = createEl(doc, 'p', '', item.summary);

    const actions = createEl(doc, 'div', 'level-card-actions');
    const actionBtn = createEl(
      doc,
      'button',
      `btn ${completed ? 'btn--secondary' : unlocked ? 'btn--primary' : 'btn--ghost'}`,
      completed ? `Reintentar Nivel ${item.number}` : unlocked ? `Iniciar Nivel ${item.number}` : `Nivel ${item.number} bloqueado`
    );
    actionBtn.type = 'button';
    actionBtn.disabled = !unlocked;
    if (unlocked) {
      listen(actionBtn, 'click', () => onNavigate?.(item.route));
    }
    actions.appendChild(actionBtn);

    card.append(cardHeader, meta, summary, actions);
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
