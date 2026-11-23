import { createStateStore } from './engine/state.js';
import { createDataLoader } from './engine/dataLoader.js';
import { createRouter, ROUTES } from './engine/router.js';
import {
  announce,
  closeAllModals,
  syncReducedMotion,
  subscribeReducedMotion
} from './engine/a11y.js';
import {
  initSound,
  isSoundEnabled,
  toggleSound,
  subscribeSound
} from './engine/sound.js';

import * as inspectorMinigame from './minigames/inspector.js';
import * as classifierMinigame from './minigames/classifier.js';
import * as codeHuntMinigame from './minigames/codeHunt.js';
import * as branchingIncidentMinigame from './minigames/branchingIncident.js';

import { renderHomeView } from './views/homeView.js';
import { renderQuizView } from './views/quizView.js';
import { renderGameView } from './views/gameView.js';
import { renderResultsView } from './views/resultsView.js';
import { createGlossaryDrawer } from './views/glossaryDrawer.js';
import { createSettingsModal } from './views/settingsModal.js';
import { createGuideModal } from './views/guideModal.js';

const MINIGAMES = {
  1: inspectorMinigame,
  2: classifierMinigame,
  3: codeHuntMinigame,
  4: branchingIncidentMinigame
};

const ROUTE_TITLES = {
  [ROUTES.INICIO]: 'Inicio — Alerta de Fuga',
  [ROUTES.QUIZ_PRE]: 'Test previo — Alerta de Fuga',
  [ROUTES.NIVEL_1]: 'Nivel 1: El Túnel Abierto — Alerta de Fuga',
  [ROUTES.NIVEL_2]: 'Nivel 2: La Bóveda de Texto Plano — Alerta de Fuga',
  [ROUTES.NIVEL_3]: 'Nivel 3: Llaves bajo el Tapete — Alerta de Fuga',
  [ROUTES.NIVEL_4]: 'Nivel 4: Simulacro de Brecha — Alerta de Fuga',
  [ROUTES.QUIZ_POST]: 'Test posterior — Alerta de Fuga',
  [ROUTES.RESULTADOS]: 'Resultados — Alerta de Fuga'
};

let booted = false;

function renderErrorState(container, message, onRetry) {
  const doc = container.ownerDocument || globalThis.document;
  const section = doc.createElement('section');
  section.className = 'card alert alert--danger';

  const h1 = doc.createElement('h1');
  h1.textContent = 'No se pudo cargar la vista';

  const p = doc.createElement('p');
  p.textContent =
    message ||
    'Ocurrió un error al cargar los datos educativos. Verifica que estés ejecutando el proyecto desde un servidor HTTP local.';

  const actions = doc.createElement('div');
  actions.className = 'hero-actions';

  const retryBtn = doc.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn btn--primary';
  retryBtn.textContent = 'Volver a inicio';
  retryBtn.addEventListener('click', () => onRetry?.());

  actions.appendChild(retryBtn);
  section.append(h1, p, actions);
  container.replaceChildren(section);
}

export function initApp() {
  if (booted) {
    return null;
  }
  const doc = globalThis.document;
  if (!doc) {
    return null;
  }
  const mainEl = doc.getElementById('main-content');
  if (!mainEl) {
    return null;
  }
  booted = true;

  const store = createStateStore();
  const dataLoader = createDataLoader({ basePath: './data', cache: true });
  initSound();

  syncReducedMotion(store.getState().settings.reducedMotion);
  subscribeReducedMotion(() => {
    syncReducedMotion(store.getState().settings.reducedMotion);
  });
  store.subscribe((nextState) => {
    syncReducedMotion(nextState.settings.reducedMotion);
  });

  const glossaryContainer = doc.getElementById('glossary-drawer');
  const settingsContainer = doc.getElementById('settings-modal');
  const guideContainer = doc.getElementById('guide-modal');

  const glossaryDrawer = createGlossaryDrawer({
    container: glossaryContainer,
    loadGlossary: () => dataLoader.loadGlossary()
  });

  const guideModal = createGuideModal({
    container: guideContainer
  });

  let router = null;

  const settingsModal = createSettingsModal({
    container: settingsContainer,
    store,
    onResetComplete() {
      router?.navigate(ROUTES.INICIO, { force: true, replace: true });
    }
  });

  const navHomeBtn = doc.getElementById('nav-home-btn');
  const toggleSoundBtn = doc.getElementById('toggle-sound-btn');
  const openGlossaryBtn = doc.getElementById('open-glossary-btn');
  const openSettingsBtn = doc.getElementById('open-settings-btn');

  function syncSoundButton() {
    if (!toggleSoundBtn) return;
    const on = isSoundEnabled();
    toggleSoundBtn.textContent = on ? 'Silenciar' : 'Activar sonido';
    toggleSoundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggleSoundBtn.setAttribute('aria-label', on ? 'Silenciar sonido de efectos' : 'Activar sonido de efectos');
    toggleSoundBtn.classList.toggle('is-active', on);
  }
  syncSoundButton();
  subscribeSound(syncSoundButton);

  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', () => {
      router?.navigate(ROUTES.INICIO);
    });
  }
  if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener('click', () => {
      const next = toggleSound();
      announce(next ? 'Sonido activado.' : 'Sonido silenciado.');
    });
  }
  if (openGlossaryBtn) {
    openGlossaryBtn.addEventListener('click', () => {
      glossaryDrawer.open({ triggerEl: openGlossaryBtn });
    });
  }
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      settingsModal.open(openSettingsBtn);
    });
  }

  function updateNavState(route) {
    if (navHomeBtn) {
      if (route === ROUTES.INICIO) {
        navHomeBtn.setAttribute('aria-current', 'page');
      } else {
        navHomeBtn.removeAttribute('aria-current');
      }
    }
    if (ROUTE_TITLES[route]) {
      doc.title = ROUTE_TITLES[route];
    }
  }

  router = createRouter({
    getState: () => store.getState(),
    fallbackMode: 'inicio',
    beforeLeave() {
      closeAllModals({ restoreFocus: false });
    },
    announceRoute(route) {
      if (ROUTE_TITLES[route]) {
        announce(`Vista actual: ${ROUTE_TITLES[route]}`);
      }
    },
    onBlocked(fromRoute, toRoute, reason) {
      if (reason === 'locked') {
        announce(`La ruta ${fromRoute} aún está bloqueada. Redirigido a ${toRoute}.`);
      }
    },
    onError(err) {
      renderErrorState(mainEl, err?.message, () => {
        router.navigate(ROUTES.INICIO, { force: true, replace: true });
      });
    },
    async onRouteChange(route, context) {
      updateNavState(route);

      if (route === ROUTES.INICIO) {
        return renderHomeView(mainEl, {
          state: store.getState(),
          isMemoryFallback: store.isMemoryFallback(),
          onNavigate: (target) => router.navigate(target),
          onOpenGuide: (triggerEl) => guideModal.open(triggerEl),
          onOpenSettings: (triggerEl) => settingsModal.open(triggerEl),
          onOpenGlossary: (opts) => glossaryDrawer.open(opts)
        });
      }

      if (route === ROUTES.QUIZ_PRE || route === ROUTES.QUIZ_POST) {
        const quizType = route === ROUTES.QUIZ_PRE ? 'pre' : 'post';
        const quizData = await dataLoader.loadQuiz(quizType, { signal: context.signal });
        if (context.isStale()) {
          return null;
        }
        return renderQuizView(mainEl, {
          type: quizType,
          quizData,
          onComplete(result) {
            if (quizType === 'pre') {
              store.recordPreQuiz(result);
            } else {
              store.recordPostQuiz(result);
            }
          },
          onSkip() {
            store.skipPreQuiz();
            router.navigate(ROUTES.NIVEL_1);
          },
          onOpenGlossary: (opts) => glossaryDrawer.open(opts),
          onNavigateNext() {
            router.navigate(quizType === 'pre' ? ROUTES.NIVEL_1 : ROUTES.RESULTADOS);
          }
        });
      }

      if (route.startsWith('nivel-')) {
        const levelNumber = Number(route.slice('nivel-'.length));
        const levelData = await dataLoader.loadLevel(levelNumber, { signal: context.signal });
        if (context.isStale()) {
          return null;
        }
        return renderGameView(mainEl, {
          levelNumber,
          levelData,
          minigame: MINIGAMES[levelNumber],
          getSettings: () => store.getState().settings,
          onAttemptFinished(attemptRecord, maxBaseLevel) {
            store.recordLevelAttemptResult(levelNumber, attemptRecord, maxBaseLevel);
          },
          onOpenGlossary: (opts) => glossaryDrawer.open(opts),
          onNavigate: (target) => router.navigate(target),
          onRetry(targetLevel) {
            router.navigate(`nivel-${targetLevel}`, { force: true, replace: true });
          }
        });
      }

      if (route === ROUTES.RESULTADOS) {
        let preQuizData = null;
        let postQuizData = null;
        const currentState = store.getState();
        if (currentState.preQuiz.completed) {
          try {
            preQuizData = await dataLoader.loadQuiz('pre', { signal: context.signal });
          } catch {
            preQuizData = null;
          }
        }
        if (currentState.postQuiz.completed) {
          try {
            postQuizData = await dataLoader.loadQuiz('post', { signal: context.signal });
          } catch {
            postQuizData = null;
          }
        }
        if (context.isStale()) {
          return null;
        }
        return renderResultsView(mainEl, {
          state: store.getState(),
          preQuizData,
          postQuizData,
          onNavigate: (target) => router.navigate(target),
          onOpenGlossary: (opts) => glossaryDrawer.open(opts)
        });
      }

      return null;
    }
  });

  router.start();
  return { store, router, dataLoader };
}

if (typeof globalThis.document !== 'undefined') {
  if (globalThis.document.readyState === 'loading') {
    globalThis.document.addEventListener('DOMContentLoaded', () => {
      initApp();
    });
  } else {
    initApp();
  }
}
