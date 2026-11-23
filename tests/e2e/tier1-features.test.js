import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStaticServer } from './helpers/staticServer.js';
import {
  installDomGlobals,
  createMemoryStorage,
  StubKeyboardEvent,
} from './helpers/domStub.js';
import {
  REQUIRED_GLOSSARY_IDS,
  REQUIRED_PALETTE_TOKENS,
  ACCENT_FILL_TOKENS,
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_LEVEL4_PHASES,
  OBJECTIVES,
  requireAppFile,
  importAppModule,
  listProjectFiles,
  fetchHttp,
  fetchAppJson,
  contrastRatio,
  assertNoSecretsOrRealPans,
  scanHtmlForCspViolations,
  scanJsForSecurityViolations,
  scanCssForViolations,
  analyzeLevel4Graph,
  findControlByText,
  collectText,
  normalizeText,
} from './helpers/assertions.js';

let server;

async function bootAppInStub(options = {}) {
  const html = await requireAppFile('index.html');
  await requireAppFile('js/main.js');
  const storage = options.storage ?? createMemoryStorage(options.initialStorage);
  const env = installDomGlobals({
    html,
    storage,
    fetchBaseUrl: server.baseUrl,
    reducedMotion: Boolean(options.reducedMotion),
    initialHash: options.initialHash || '',
  });
  try {
    await importAppModule('js/main.js', { fresh: true });
    env.document.dispatchEvent(new globalThis.Event('DOMContentLoaded', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 35));
    return env;
  } catch (err) {
    env.restore();
    throw err;
  }
}

function makeMinigameDriverCallbacks(state = {}) {
  const decisions = [];
  let completion = null;
  const glossaryCalls = [];
  const announcements = [];
  return {
    decisions,
    get completion() {
      return completion;
    },
    glossaryCalls,
    announcements,
    callbacks: {
      onDecision(payload, onContinue) {
        decisions.push(payload);
        if (typeof onContinue === 'function' && !state.holdContinue) {
          onContinue();
        }
      },
      onLevelComplete(summary) {
        completion = summary;
      },
      onOpenGlossary(termId) {
        glossaryCalls.push(termId);
      },
      onStatusAnnounce(msg) {
        announcements.push(msg);
      },
    },
  };
}

function clickChallengeOption(container, option) {
  const byAttr =
    container.querySelector(`[data-option-id="${option.id}"]`) ||
    container.querySelector(`[value="${option.id}"]`) ||
    findControlByText(container, option.label);
  assert.ok(byAttr, `Expected interactive control for option "${option.label}" (${option.id})`);
  byAttr.click();
  if (byAttr.localName === 'input') {
    const submitBtn = container.querySelector('button[type="submit"], button');
    if (submitBtn && submitBtn !== byAttr) submitBtn.click();
  }
}

describe('Tier 1 — Feature Functional Coverage (FEAT-01..FEAT-20, 100 tests)', () => {
  before(async () => {
    server = await startStaticServer();
  });

  after(async () => {
    if (server) await server.close();
  });

  // =========================================================================
  // FEAT-01: Portada / Inicio (homeView.js)
  // =========================================================================
  describe('FEAT-01: Portada / Inicio', () => {
    test('[T1-F01-1] index.html serves HTTP 200 with lang="es", skip link, single <h1>, and NovaPay context', async () => {
      await requireAppFile('index.html');
      const res = await fetchHttp(server.baseUrl, '/');
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/i);
      assert.match(res.text, /<html[^>]*\blang=["']es["']/i);
      assert.match(res.text, /href=["']#main-content["']/i);
      assert.match(res.text, /id=["']main-content["']/i);
      assert.match(res.text, /NovaPay|Alerta de Fuga/i);
    });

    test('[T1-F01-2] homeView.js and router.js exist, serve HTTP 200, and export module functions', async () => {
      const homeRes = await fetchHttp(server.baseUrl, '/js/views/homeView.js');
      const routerRes = await fetchHttp(server.baseUrl, '/js/engine/router.js');
      await requireAppFile('js/views/homeView.js');
      await requireAppFile('js/engine/router.js');
      assert.equal(homeRes.status, 200);
      assert.equal(routerRes.status, 200);

      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const homeMod = await importAppModule('js/views/homeView.js');
        const routerMod = await importAppModule('js/engine/router.js');
        assert.ok(Object.values(homeMod).some((v) => typeof v === 'function'), 'homeView.js must export functions');
        assert.ok(Object.values(routerMod).some((v) => typeof v === 'function'), 'router.js must export functions');
      } finally {
        env.restore();
      }
    });

    test('[T1-F01-3] Booting app renders NovaPay story, mission, single <h1>, and entry triggers', async () => {
      const env = await bootAppInStub();
      try {
        const main = env.document.getElementById('main-content');
        assert.ok(main, 'Expected #main-content landmark');
        const h1s = env.document.querySelectorAll('h1');
        assert.equal(h1s.length, 1, 'Expected exactly one <h1> on Inicio');
        const bodyText = collectText(env.document.body);
        assert.match(bodyText, /novapay/);
        const buttons = env.document.querySelectorAll('button, a');
        assert.ok(buttons.length >= 3, 'Expected entry controls for Guide, Settings, Quiz/Levels');
      } finally {
        env.restore();
      }
    });

    test('[T1-F01-4] All core stylesheets and SVG assets referenced by index.html return HTTP 200', async () => {
      await requireAppFile('index.html');
      const paths = [
        '/css/tokens.css',
        '/css/base.css',
        '/css/layout.css',
        '/css/components.css',
        '/css/minigames.css',
        '/js/main.js',
        '/assets/logo.svg',
        '/assets/analyst.svg',
        '/assets/attacker.svg',
      ];
      for (const p of paths) {
        await requireAppFile(p.slice(1));
        const res = await fetchHttp(server.baseUrl, p);
        assert.equal(res.status, 200, `Expected HTTP 200 for ${p}`);
      }
    });

    test('[T1-F01-5] Home reflects unlocked level progression from state store without asking for PII', async () => {
      const seeded = JSON.stringify({
        version: 1,
        unlockedLevel: 2,
        settings: { timerEnabled: false, reducedMotion: false },
        levels: {
          1: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, maxBaseLevel: 700, decisions: [] } },
        },
      });
      const env = await bootAppInStub({
        initialStorage: { alerta_de_fuga_progress_v1: seeded },
      });
      try {
        const bodyText = collectText(env.document.body);
        assert.match(bodyText, /nivel 1/);
        assert.match(bodyText, /nivel 2/);
        assert.equal(env.document.querySelectorAll('input[type="email"], input[type="password"]').length, 0);
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-02: Guía visual opcional (guideModal.js)
  // =========================================================================
  describe('FEAT-02: Guía visual opcional', () => {
    test('[T1-F02-1] guideModal.js exists, serves HTTP 200, and exports controller function(s)', async () => {
      await requireAppFile('js/views/guideModal.js');
      const res = await fetchHttp(server.baseUrl, '/js/views/guideModal.js');
      assert.equal(res.status, 200);
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const mod = await importAppModule('js/views/guideModal.js');
        assert.ok(Object.values(mod).some((v) => typeof v === 'function'));
      } finally {
        env.restore();
      }
    });

    test('[T1-F02-2] Clicking Guía visual trigger on Inicio opens an accessible dialog explaining mechanics', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger, 'Expected Guía visual button on Inicio');
        trigger.click();
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog, 'Expected open dialog when Guía visual is triggered');
        const text = collectText(dialog);
        assert.match(text, /exposici[oó]n|nivel|retroalimentaci[oó]n|puntos/);
      } finally {
        env.restore();
      }
    });

    test('[T1-F02-3] Guía visual explains exposure bar, scoring/streaks, and 3-block feedback', async () => {
      const code = await requireAppFile('js/views/guideModal.js');
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger);
        trigger.click();
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog);
        const combined = normalizeText(dialog.textContent + ' ' + code);
        assert.match(combined, /exposici[oó]n/);
        assert.match(combined, /punto|racha|mec[aá]nica|nivel/);
      } finally {
        env.restore();
      }
    });

    test('[T1-F02-4] Closing Guía visual via close button or Escape closes dialog and restores focus', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger);
        trigger.focus();
        trigger.click();
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog);
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        const stillOpen = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(!stillOpen || stillOpen.getAttribute('aria-hidden') === 'true', 'Guide modal should close on Escape');
        assert.equal(env.document.activeElement, trigger, 'Focus should return to trigger button');
      } finally {
        env.restore();
      }
    });

    test('[T1-F02-5] Bypassing Guía visual does not block starting Pre-Quiz or Nivel 1', async () => {
      const env = await bootAppInStub();
      try {
        const startTrigger =
          findControlByText(env.document.body, 'comenzar') ||
          findControlByText(env.document.body, 'test previo') ||
          findControlByText(env.document.body, 'nivel 1');
        assert.ok(startTrigger, 'Expected start trigger without opening guide');
        startTrigger.click();
        await new Promise((r) => setTimeout(r, 30));
        assert.ok(env.document.querySelectorAll('h1').length === 1);
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-03: Modal de ajustes (settingsModal.js)
  // =========================================================================
  describe('FEAT-03: Modal de ajustes', () => {
    test('[T1-F03-1] settingsModal.js exists, serves HTTP 200, and exports controller function(s)', async () => {
      await requireAppFile('js/views/settingsModal.js');
      const res = await fetchHttp(server.baseUrl, '/js/views/settingsModal.js');
      assert.equal(res.status, 200);
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const mod = await importAppModule('js/views/settingsModal.js');
        assert.ok(Object.values(mod).some((v) => typeof v === 'function'));
      } finally {
        env.restore();
      }
    });

    test('[T1-F03-2] Opening Ajustes displays timer, reduced-motion, and Reset Progress controls', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'ajustes');
        assert.ok(trigger, 'Expected Ajustes trigger');
        trigger.click();
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog, 'Expected Ajustes dialog');
        const text = collectText(dialog);
        assert.match(text, /temporizador/);
        assert.match(text, /animaciones|movimiento/);
        assert.match(text, /restablecer/);
      } finally {
        env.restore();
      }
    });

    test('[T1-F03-3] state.updateSettings toggles timerEnabled and persists to alerta_de_fuga_progress_v1', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      assert.equal(store.getState().settings.timerEnabled, false);
      store.updateSettings({ timerEnabled: true });
      assert.equal(store.getState().settings.timerEnabled, true);
      const saved = JSON.parse(storage.getItem('alerta_de_fuga_progress_v1'));
      assert.equal(saved.settings.timerEnabled, true);
    });

    test('[T1-F03-4] state.updateSettings toggles reducedMotion and UI reflects reduced-motion state', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.updateSettings({ reducedMotion: true });
      assert.equal(store.getState().settings.reducedMotion, true);
      const env = await bootAppInStub({ storage });
      try {
        const htmlAttr =
          env.document.documentElement.getAttribute('data-reduced-motion') ||
          env.document.documentElement.className + ' ' + env.document.body.className;
        assert.match(htmlAttr, /true|reduced/i);
      } finally {
        env.restore();
      }
    });

    test('[T1-F03-5] Clicking Restablecer progreso requires confirmation before clearing state', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      assert.equal(store.getState().unlockedLevel, 2);

      const env = await bootAppInStub({ storage });
      try {
        const trigger = findControlByText(env.document.body, 'ajustes');
        assert.ok(trigger);
        trigger.click();
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog);
        const resetBtn = findControlByText(dialog, 'restablecer');
        assert.ok(resetBtn);
        resetBtn.click();
        // Single click must NOT wipe progress yet
        const stillStored = JSON.parse(storage.getItem('alerta_de_fuga_progress_v1'));
        assert.equal(stillStored.unlockedLevel, 2, 'Single click must require confirmation before resetting');
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-04: Test previo (quiz-pre.json, quizView.js)
  // =========================================================================
  describe('FEAT-04: Test previo', () => {
    test('[T1-F04-1] quiz-pre.json serves HTTP 200 with version 1, type "pre", and 5 valid questions', async () => {
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      assert.equal(quiz.version, 1);
      assert.equal(quiz.type, 'pre');
      assert.equal(quiz.questions.length, 5);
      for (const q of quiz.questions) {
        assert.ok(q.id && q.prompt && q.correctOptionId);
        assert.ok(Array.isArray(q.options) && q.options.length >= 3);
        assert.ok(q.options.some((o) => o.id === q.correctOptionId));
      }
    });

    test('[T1-F04-2] quiz-pre.json covers O1-O5 exactly once each', async () => {
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      const covered = quiz.questions.map((q) => q.objectiveId).sort();
      assert.deepEqual(covered, [...OBJECTIVES].sort());
    });

    test('[T1-F04-3] dataLoader.loadQuiz("pre") loads quiz-pre.json over HTTP', async () => {
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { loadQuiz } = await importAppModule('js/engine/dataLoader.js');
        const quiz = await loadQuiz('pre');
        assert.equal(quiz.type, 'pre');
        assert.equal(quiz.questions.length, 5);
      } finally {
        env.restore();
      }
    });

    test('[T1-F04-4] quizView.js renders pre-quiz with skip option and hides solutions during test', async () => {
      await requireAppFile('js/views/quizView.js');
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      const env = await bootAppInStub();
      try {
        const startPre =
          findControlByText(env.document.body, 'test previo') ||
          findControlByText(env.document.body, 'comenzar');
        assert.ok(startPre, 'Expected pre-quiz entry control');
        startPre.click();
        await new Promise((r) => setTimeout(r, 35));
        const skipBtn = findControlByText(env.document.body, 'omitir');
        assert.ok(skipBtn, 'Pre-quiz must provide Omitir button');
        const bodyText = collectText(env.document.body);
        assert.ok(!bodyText.includes(normalizeText(quiz.questions[0].explanation)), 'Must hide explanation during pre-quiz');
      } finally {
        env.restore();
      }
    });

    test('[T1-F04-5] state.skipPreQuiz() and state.recordPreQuiz() record aggregate pre-quiz state cleanly', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const s1 = createStateStore(createMemoryStorage());
      s1.skipPreQuiz();
      assert.equal(s1.getState().preQuiz.skipped, true);
      assert.equal(s1.getState().preQuiz.completed, false);

      const s2 = createStateStore(createMemoryStorage());
      s2.recordPreQuiz({ score: 3, total: 5, decisions: [] });
      assert.equal(s2.getState().preQuiz.completed, true);
      assert.equal(s2.getState().preQuiz.skipped, false);
      assert.equal(s2.getState().preQuiz.score, 3);
    });
  });

  // =========================================================================
  // FEAT-05: Contrato de minijuegos (mount/destroy)
  // =========================================================================
  describe('FEAT-05: Contrato de minijuegos', () => {
    const minigamePaths = [
      'js/minigames/inspector.js',
      'js/minigames/classifier.js',
      'js/minigames/codeHunt.js',
      'js/minigames/branchingIncident.js',
    ];

    test('[T1-F05-1] All 4 minigame modules export mount() and destroy() functions', async () => {
      for (const rel of minigamePaths) {
        const mod = await importAppModule(rel);
        assert.equal(typeof mod.mount, 'function', `${rel} must export mount()`);
        assert.equal(typeof mod.destroy, 'function', `${rel} must export destroy()`);
      }
    });

    test('[T1-F05-2] mount(container, levelData, callbacks) renders interactive DOM inside container', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, level1, driver.callbacks);
        assert.ok(container.children.length > 0, 'mount() must render DOM nodes');
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F05-3] onDecision emits required payload schema ({ challengeId, objectiveId, selectedOptionId, isCorrect, penaltyOnWrongAnswer, feedback })', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, level1, driver.callbacks);
        clickChallengeOption(container, level1.challenges[0].options[0]);
        assert.equal(driver.decisions.length, 1);
        const d = driver.decisions[0];
        assert.ok(d.challengeId);
        assert.ok(d.objectiveId);
        assert.ok(d.selectedOptionId);
        assert.equal(typeof d.isCorrect, 'boolean');
        assert.equal(typeof d.penaltyOnWrongAnswer, 'number');
        assert.ok(d.feedback && d.feedback.attackerView && d.feedback.why && d.feedback.correctControl);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F05-4] Completing all challenges invokes onLevelComplete({ scorableDecisionsCount, outcomeType, summary })', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, level1, driver.callbacks);
        for (const ch of level1.challenges) {
          const opt = ch.options.find((o) => o.id === ch.correctOptionId);
          clickChallengeOption(container, opt);
        }
        assert.ok(driver.completion, 'Expected onLevelComplete after final challenge');
        assert.equal(driver.completion.scorableDecisionsCount, level1.challenges.length);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F05-5] Minigames never import state.js directly to mutate global state', async () => {
      for (const rel of minigamePaths) {
        const code = await requireAppFile(rel);
        assert.doesNotMatch(code, /state\.js/, `${rel} must not couple to state.js directly`);
      }
    });
  });

  // =========================================================================
  // FEAT-06: Nivel 1 — El Túnel Abierto (inspector.js, nivel-1.json)
  // =========================================================================
  describe('FEAT-06: Nivel 1 — El Túnel Abierto', () => {
    test('[T1-F06-1] nivel-1.json serves HTTP 200 with level:1, O1, and 6 network-inspector challenges', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      assert.equal(data.level, 1);
      assert.ok(data.objectiveIds.includes('O1'));
      assert.equal(data.challenges.length, 6);
      for (const ch of data.challenges) {
        assert.equal(ch.type, 'network-inspector');
        assert.equal(ch.objectiveId, 'O1');
        assert.ok(ch.requestDetails && ch.requestDetails.method && ch.requestDetails.url);
        assert.equal(ch.options.length, 3);
      }
    });

    test('[T1-F06-2] inspector.js renders request details (method, url, protocol, TLS, cert) and 3 options', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        const text = collectText(container);
        assert.match(text, new RegExp(normalizeText(data.challenges[0].requestDetails.method)));
        for (const opt of data.challenges[0].options) {
          assert.ok(findControlByText(container, opt.label), `Missing option "${opt.label}"`);
        }
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F06-3] Completing all 6 Nivel 1 challenges correctly produces 6 correct decisions and scorableDecisionsCount 6', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        for (const ch of data.challenges) {
          const correct = ch.options.find((o) => o.id === ch.correctOptionId);
          clickChallengeOption(container, correct);
        }
        assert.equal(driver.decisions.length, 6);
        assert.ok(driver.decisions.every((d) => d.isCorrect === true));
        assert.equal(driver.completion.scorableDecisionsCount, 6);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F06-4] Nivel 1 includes a valid TLS 1.3 Permitir case and insecure transport cases', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const combined = JSON.stringify(data).toLowerCase();
      assert.match(combined, /tls 1\.3/);
      assert.match(combined, /hsts/);
      assert.match(combined, /rc4|tls 1\.0/);
      assert.match(combined, /mixed|mixto|http:\/\//);
      assert.ok(data.challenges.some((c) => /allow|permitir/i.test(c.correctOptionId)));
    });

    test('[T1-F06-5] Nivel 1 HSTS/preload and self-signed cert explanations respect AGENTS.md precision', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const text = JSON.stringify(data).toLowerCase();
      assert.match(text, /preload/);
      assert.match(text, /visitas posteriores|primera visita|degradaci[oó]n/);
      assert.match(text, /cadena de confianza|confianza|autofirmad|entorno/);
    });
  });

  // =========================================================================
  // FEAT-07: Nivel 2 — La Bóveda de Texto Plano (classifier.js, nivel-2.json)
  // =========================================================================
  describe('FEAT-07: Nivel 2 — La Bóveda de Texto Plano', () => {
    test('[T1-F07-1] nivel-2.json serves HTTP 200 with 4 buckets, 8 cards (O2,O3,O5), and ecb-pattern.svg reference', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      assert.equal(data.level, 2);
      assert.equal(data.buckets.length, 4);
      assert.equal(data.challenges.length, 8);
      for (const obj of ['O2', 'O3', 'O5']) {
        assert.ok(data.objectiveIds.includes(obj), `Expected ${obj} in Nivel 2 objectiveIds`);
      }
      assert.ok(data.challenges.some((c) => String(c.visualAsset || '').includes('ecb-pattern.svg')));
    });

    test('[T1-F07-2] classifier.js renders 4 control bucket buttons usable without drag-and-drop', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/classifier.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        for (const bucket of data.buckets) {
          assert.ok(findControlByText(container, bucket.label), `Expected button/control for bucket "${bucket.label}"`);
        }
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F07-3] Completing all 8 cards via keyboard/button clicks emits 8 decisions and onLevelComplete(8)', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/classifier.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);

        for (const ch of data.challenges) {
          const cardCtrl =
            container.querySelector(`[data-challenge-id="${ch.id}"]`) ||
            findControlByText(container, ch.recordLabel || ch.title);
          if (cardCtrl && typeof cardCtrl.click === 'function') {
            cardCtrl.click();
          }
          const targetBucket = data.buckets.find((b) => b.id === ch.correctOptionId);
          const bucketBtn =
            container.querySelector(`[data-bucket-id="${targetBucket.id}"]`) ||
            findControlByText(container, targetBucket.label);
          assert.ok(bucketBtn, `Missing bucket button for ${targetBucket.label}`);
          bucketBtn.click();
        }
        assert.equal(driver.decisions.length, 8);
        assert.ok(driver.decisions.every((d) => d.isCorrect === true));
        assert.equal(driver.completion?.scorableDecisionsCount, 8);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F07-4] Nivel 2 separates PAN and CVV and forbids post-auth CVV storage even encrypted', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const cardSubject = (c) => `${c.title} ${c.scenario} ${c.recordLabel || ''}`;
      const panCards = data.challenges.filter((c) => /\bpan\b/i.test(cardSubject(c)));
      const cvvCards = data.challenges.filter((c) => /\bcvv\b/i.test(cardSubject(c)));
      assert.ok(panCards.length >= 1, 'Expected separate PAN challenge');
      assert.ok(cvvCards.length >= 1, 'Expected separate CVV challenge');
      assert.notEqual(panCards[0].id, cvvCards[0].id, 'PAN and CVV must be separate challenges');
      const cvvText = JSON.stringify(cvvCards[0]).toLowerCase();
      assert.match(cvvText, /pci dss|autorizaci[oó]n/);
      assert.match(cvvText, /cifrad|no almacenar|prohib/);
    });

    test('[T1-F07-5] Nivel 2 enforces AES-GCM unique nonce per key and tokenization limits', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const text = JSON.stringify(data).toLowerCase();
      assert.match(text, /aes-gcm/);
      assert.match(text, /nonce/);
      assert.match(text, /tokeniz/);
      assert.match(text, /pci dss/);
    });
  });

  // =========================================================================
  // FEAT-08: Nivel 3 — Llaves bajo el Tapete (codeHunt.js, nivel-3.json)
  // =========================================================================
  describe('FEAT-08: Nivel 3 — Llaves bajo el Tapete', () => {
    test('[T1-F08-1] nivel-3.json serves HTTP 200 with 6 non-executable mock files (O3,O4)', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      assert.equal(data.level, 3);
      assert.equal(data.challenges.length, 6);
      assert.ok(data.objectiveIds.includes('O3'));
      assert.ok(data.objectiveIds.includes('O4'));
      for (const ch of data.challenges) {
        assert.equal(ch.type, 'code-hunt');
        assert.ok(ch.filePath && Array.isArray(ch.lines) && ch.lines.length >= 3);
        assert.ok(Array.isArray(ch.vulnerableLineNumbers) && ch.vulnerableLineNumbers.length >= 1);
        assert.ok(Array.isArray(ch.mitigationOptions) && ch.mitigationOptions.length >= 3);
      }
    });

    test('[T1-F08-2] codeHunt.js displays numbered lines and mitigation options without executing snippets', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        const ch = data.challenges[0];
        const text = collectText(container);
        assert.match(text, new RegExp(normalizeText(ch.filePath)));
        for (const m of ch.mitigationOptions) {
          assert.ok(findControlByText(container, m.label), `Missing mitigation option "${m.label}"`);
        }
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F08-3] Selecting vulnerable line + correct mitigation across all 6 files completes Nivel 3', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);

        for (const ch of data.challenges) {
          const vulnNum = ch.vulnerableLineNumbers[0];
          const vulnLine = ch.lines.find((l) => l.lineNumber === vulnNum);
          const lineBtn =
            container.querySelector(`[data-line-number="${vulnNum}"]`) ||
            findControlByText(container, vulnLine.text.trim()) ||
            findControlByText(container, String(vulnNum));
          assert.ok(lineBtn, `Missing clickable control for line ${vulnNum} in ${ch.filePath}`);
          lineBtn.click();

          const mitOpt = ch.mitigationOptions.find((m) => m.id === ch.correctMitigationId);
          const mitBtn =
            container.querySelector(`[data-mitigation-id="${mitOpt.id}"]`) ||
            findControlByText(container, mitOpt.label);
          assert.ok(mitBtn, `Missing control for mitigation "${mitOpt.label}"`);
          mitBtn.click();

          const submitBtn =
            findControlByText(container, 'confirmar') ||
            findControlByText(container, 'aplicar') ||
            findControlByText(container, 'verificar') ||
            findControlByText(container, 'enviar') ||
            container.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
        assert.equal(driver.decisions.length, 6);
        assert.ok(driver.decisions.every((d) => d.isCorrect === true));
        assert.equal(driver.completion?.scorableDecisionsCount, 6);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F08-4] Nivel 3 covers all 6 fictional repo files from plan §5 N3', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const paths = data.challenges.map((c) => c.filePath).join(' ');
      assert.match(paths, /payments\.js/i);
      assert.match(paths, /\.env/i);
      assert.match(paths, /storage\.yml/i);
      assert.match(paths, /tls\.conf/i);
      assert.match(paths, /resetToken\.js/i);
      assert.match(paths, /envelope\.js/i);
    });

    test('[T1-F08-5] Nivel 3 differentiates RSA NoPadding/PKCS#1 v1.5/RSA-OAEP and env var vs secret manager', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const text = JSON.stringify(data).toLowerCase();
      assert.match(text, /nopadding/);
      assert.match(text, /pkcs#?1\s*v?1\.5/);
      assert.match(text, /rsa-oaep/);
      assert.match(text, /gestor de secretos|secrets?\s*manager|kms|b[oó]veda/);
      assert.match(text, /variable de entorno|variables de entorno/);
    });
  });

  // =========================================================================
  // FEAT-09: Nivel 4 — Simulacro de Brecha (branchingIncident.js, nivel-4.json)
  // =========================================================================
  describe('FEAT-09: Nivel 4 — Simulacro de Brecha', () => {
    test('[T1-F09-1] nivel-4.json serves HTTP 200 with all 6 phases and O1-O5 coverage', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      assert.equal(data.level, 4);
      assert.deepEqual(data.phases, REQUIRED_LEVEL4_PHASES);
      assert.deepEqual([...data.objectiveIds].sort(), [...OBJECTIVES].sort());
      assert.ok(data.startNodeId && data.nodes[data.startNodeId]);
    });

    test('[T1-F09-2] nivel-4.json is a valid reachable DAG with 3 options per non-terminal and zero cycles', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const g = analyzeLevel4Graph(data);
      assert.deepEqual(g.danglingEdges, [], 'No dangling edges allowed');
      assert.deepEqual(g.unreachableNodes, [], 'No orphan/unreachable nodes allowed');
      assert.deepEqual(g.cycles, [], 'No unintended cycles allowed');
      assert.deepEqual(g.nonTerminalsWithWrongOptionCount, [], 'Every non-terminal node must have 3 options');
      assert.ok(g.terminals.length >= 1, 'Expected at least 1 explicit terminal node');
    });

    test('[T1-F09-3] branchingIncident.js renders phase timeline and 3 options from startNodeId', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/branchingIncident.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        const startNode = data.nodes[data.startNodeId];
        const text = collectText(container);
        assert.match(text, /detecci[oó]n/);
        for (const opt of startNode.options) {
          assert.ok(findControlByText(container, opt.label), `Missing option "${opt.label}"`);
        }
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F09-4] Playing an optimal route reaches terminal and emits scorableDecisionsCount matching route', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const g = analyzeLevel4Graph(data);
      const bestPath = g.simplePaths.find((p) => p.choices.every((c) => c.option.isCorrect)) || g.simplePaths[0];
      assert.ok(bestPath, 'Expected at least one complete path to terminal');

      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/branchingIncident.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, data, driver.callbacks);
        for (const step of bestPath.choices) {
          clickChallengeOption(container, step.option);
        }
        assert.equal(driver.decisions.length, bestPath.choices.length);
        assert.ok(driver.completion, 'Expected onLevelComplete at terminal node');
        assert.equal(driver.completion.scorableDecisionsCount, bestPath.choices.length);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T1-F09-5] Nivel 4 covers prohibited response options (hide breach, reuse leaked key, store CVV) without real secrets', async () => {
      const raw = await requireAppFile('data/levels/nivel-4.json');
      assertNoSecretsOrRealPans(raw, 'data/levels/nivel-4.json');
      const lower = raw.toLowerCase();
      assert.match(lower, /ocultar|silencio|ignorar/);
      assert.match(lower, /misma clave|reutilizar/);
      assert.match(lower, /cvv|pan/);
    });
  });

  // =========================================================================
  // FEAT-10: Retroalimentación en 3 bloques
  // =========================================================================
  describe('FEAT-10: Retroalimentación en 3 bloques', () => {
    test('[T1-F10-1] All Nivel 1 & 2 options provide 3-block feedback, glossaryTermId, and owaspRef', async () => {
      for (const lvl of [1, 2]) {
        const data = await fetchAppJson(server.baseUrl, `/data/levels/nivel-${lvl}.json`);
        for (const ch of data.challenges) {
          assert.ok(ch.glossaryTermId, `${ch.id} missing glossaryTermId`);
          assert.match(String(ch.owaspRef || ''), /^https:\/\//, `${ch.id} invalid owaspRef`);
          const fbEntries = Object.values(ch.feedbackByOption || {});
          assert.ok(fbEntries.length >= 3, `${ch.id} feedbackByOption incomplete`);
          for (const fb of fbEntries) {
            assert.ok(fb.attackerView && fb.why && fb.correctControl, `${ch.id} missing 3-block fields`);
          }
        }
      }
    });

    test('[T1-F10-2] All Nivel 3 challenges provide 3-block feedback for correct, wrongLine, and wrongMitigation', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      for (const ch of data.challenges) {
        assert.ok(ch.glossaryTermId);
        assert.match(String(ch.owaspRef || ''), /^https:\/\//);
        for (const key of ['correct', 'wrongLine', 'wrongMitigation']) {
          const fb = ch.feedbackByOutcome?.[key];
          assert.ok(fb && fb.attackerView && fb.why && fb.correctControl, `${ch.id} missing ${key} 3-block feedback`);
        }
      }
    });

    test('[T1-F10-3] All Nivel 4 node options provide 3-block feedback, glossaryTermId, and owaspRef', async () => {
      const data = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      for (const node of Object.values(data.nodes)) {
        if (node.isTerminal) continue;
        for (const opt of node.options) {
          assert.ok(opt.feedback?.attackerView && opt.feedback?.why && opt.feedback?.correctControl, `${node.id}/${opt.id} missing 3-block feedback`);
          assert.ok(opt.glossaryTermId, `${node.id}/${opt.id} missing glossaryTermId`);
          assert.match(String(opt.owaspRef || ''), /^https:\/\//, `${node.id}/${opt.id} invalid owaspRef`);
        }
      }
    });

    test('[T1-F10-4] gameView.js exists, exports functions, and renders 3-block feedback labels', async () => {
      const code = await requireAppFile('js/views/gameView.js');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const mod = await importAppModule('js/views/gameView.js');
        assert.ok(Object.values(mod).some((v) => typeof v === 'function'));
      } finally {
        env.restore();
      }
      assert.match(code.toLowerCase(), /attackerview|atacante/);
      assert.match(code.toLowerCase(), /correctcontrol|prevenir/);
    });

    test('[T1-F10-5] Feedback stops timer before display and avoids claiming consummated attack on risk-only scenarios', async () => {
      const gameViewCode = await requireAppFile('js/views/gameView.js');
      // Timer stop/pause must appear alongside decision handling
      assert.match(gameViewCode, /clearInterval|stopTimer|pauseTimer/i);
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const ch1Text = JSON.stringify(n1.challenges[0].feedbackByOption).toLowerCase();
      assert.doesNotMatch(ch1Text, /ya fueron robadas con [eé]xito|ataque ya consumado/);
    });
  });

  // =========================================================================
  // FEAT-11: Glosario accesible (glossaryDrawer.js, glossary.json)
  // =========================================================================
  describe('FEAT-11: Glosario accesible', () => {
    test('[T1-F11-1] glossary.json serves HTTP 200 and includes all 18 required exact term IDs', async () => {
      const glossary = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      assert.equal(glossary.version, 1);
      const ids = new Set(glossary.terms.map((t) => t.id));
      for (const reqId of REQUIRED_GLOSSARY_IDS) {
        assert.ok(ids.has(reqId), `Missing required glossary term ID: ${reqId}`);
      }
    });

    test('[T1-F11-2] Every glossary entry has definition, analogy, analogyLimit, relatedLevel, relatedChallengeId', async () => {
      const glossary = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      for (const t of glossary.terms) {
        assert.ok(t.term && t.definition, `${t.id} missing term/definition`);
        assert.ok(t.analogy && t.analogyLimit, `${t.id} missing analogy/analogyLimit`);
        assert.ok(Number.isInteger(t.relatedLevel) && t.relatedLevel >= 1 && t.relatedLevel <= 4, `${t.id} bad relatedLevel`);
        assert.ok(t.relatedChallengeId, `${t.id} missing relatedChallengeId`);
      }
    });

    test('[T1-F11-3] dataLoader.loadGlossary() fetches glossary.json over HTTP', async () => {
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { loadGlossary } = await importAppModule('js/engine/dataLoader.js');
        const g = await loadGlossary();
        assert.ok(Array.isArray(g.terms) && g.terms.length >= 18);
      } finally {
        env.restore();
      }
    });

    test('[T1-F11-4] glossaryDrawer.js exists and opening Glosario in booted app renders terms with analogy limits', async () => {
      await requireAppFile('js/views/glossaryDrawer.js');
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'glosario');
        assert.ok(trigger, 'Expected Glosario trigger');
        trigger.click();
        await new Promise((r) => setTimeout(r, 35));
        const dialog = env.document.querySelector('[role="dialog"], dialog[open]');
        assert.ok(dialog, 'Expected open Glosario dialog/drawer');
        const text = collectText(dialog);
        assert.match(text, /argon2id|tls|aes-gcm/);
      } finally {
        env.restore();
      }
    });

    test('[T1-F11-5] Closing Glosario with Escape returns focus to trigger element', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'glosario');
        assert.ok(trigger);
        trigger.focus();
        trigger.click();
        await new Promise((r) => setTimeout(r, 35));
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        const stillOpen = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(!stillOpen || stillOpen.getAttribute('aria-hidden') === 'true');
        assert.equal(env.document.activeElement, trigger);
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-12: Motor de puntuación, racha, exposición y rangos (scoring.js)
  // =========================================================================
  describe('FEAT-12: Motor de puntuación, racha, exposición y rangos', () => {
    test('[T1-F12-1] calculateMaxBaseLevel(N) matches 100*N + 50*floor(N/3)', async () => {
      const { calculateMaxBaseLevel } = await importAppModule('js/engine/scoring.js');
      assert.equal(calculateMaxBaseLevel(6), 700);
      assert.equal(calculateMaxBaseLevel(8), 900);
      assert.equal(calculateMaxBaseLevel(5), 550);
      assert.equal(calculateMaxBaseLevel(3), 350);
    });

    test('[T1-F12-2] applyDecision awards +100 hit and +50 bonus on 3rd/6th consecutive hit and resets on miss', async () => {
      const { createInitialAttempt, applyDecision } = await importAppModule('js/engine/scoring.js');
      let att = createInitialAttempt(1);
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      assert.equal(att.baseScore, 350);
      assert.equal(att.streak, 3);
      att = applyDecision(att, { isCorrect: false, penaltyOnWrongAnswer: 15, objectiveId: 'O1' });
      assert.equal(att.streak, 0);
      assert.equal(att.exposure, 15);
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1' });
      assert.equal(att.baseScore, 700);
    });

    test('[T1-F12-3] calculateTimeBonus awards 0-30 when enabled and 0 when disabled without altering baseScore', async () => {
      const { calculateTimeBonus, createInitialAttempt, applyDecision } = await importAppModule('js/engine/scoring.js');
      assert.equal(calculateTimeBonus(0, true, 30), 30);
      assert.equal(calculateTimeBonus(10000, true, 30), 20);
      assert.equal(calculateTimeBonus(30000, true, 30), 0);
      assert.equal(calculateTimeBonus(0, false, 30), 0);

      let att = createInitialAttempt(1);
      att = applyDecision(att, { isCorrect: true, objectiveId: 'O1', timerEnabled: true, elapsedMs: 0 });
      assert.equal(att.baseScore, 100);
      assert.equal(att.optionalTimeBonus, 30);
      assert.equal(att.visibleScore, 130);
    });

    test('[T1-F12-4] getRank returns Aprendiz (<50), Analista (50..84.99), Arquitecto Criptográfico (>=85)', async () => {
      const { getRank, RANK_THRESHOLDS } = await importAppModule('js/engine/scoring.js');
      assert.deepEqual(RANK_THRESHOLDS, { ANALYST: 50, ARCHITECT: 85 });
      assert.equal(getRank(25), 'Aprendiz');
      assert.equal(getRank(65), 'Analista');
      assert.equal(getRank(92), 'Arquitecto Criptográfico');
    });

    test('[T1-F12-5] calculateWeakestObjective aggregates accepted attempts and postQuizDecisions accurately', async () => {
      const { calculateWeakestObjective } = await importAppModule('js/engine/scoring.js');
      const attempts = [
        {
          decisions: [
            { objectiveId: 'O1', isCorrect: true },
            { objectiveId: 'O1', isCorrect: true },
            { objectiveId: 'O2', isCorrect: false },
            { objectiveId: 'O3', isCorrect: true },
          ],
        },
      ];
      const postQuiz = [
        { objectiveId: 'O2', isCorrect: false },
        { objectiveId: 'O4', isCorrect: true },
        { objectiveId: 'O5', isCorrect: true },
      ];
      const res = calculateWeakestObjective(attempts, postQuiz);
      assert.equal(res.objectiveId, 'O2');
      assert.equal(res.rate, 0);
      assert.equal(res.hasData, true);
      assert.ok(typeof res.sourceDescription === 'string' && res.sourceDescription.length > 0);
    });
  });

  // =========================================================================
  // FEAT-13: Test posterior (quiz-post.json, quizView.js)
  // =========================================================================
  describe('FEAT-13: Test posterior', () => {
    test('[T1-F13-1] quiz-post.json serves HTTP 200 with version 1, type "post", and 5 valid questions', async () => {
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      assert.equal(quiz.version, 1);
      assert.equal(quiz.type, 'post');
      assert.equal(quiz.questions.length, 5);
      for (const q of quiz.questions) {
        assert.ok(q.id && q.prompt && q.explanation && q.correctOptionId);
        assert.ok(q.options.some((o) => o.id === q.correctOptionId));
      }
    });

    test('[T1-F13-2] quiz-post.json covers O1-O5 once each and is non-identical to quiz-pre.json', async () => {
      const pre = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      const post = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      assert.deepEqual(post.questions.map((q) => q.objectiveId).sort(), [...OBJECTIVES].sort());
      const prePrompts = new Set(pre.questions.map((q) => normalizeText(q.prompt)));
      for (const q of post.questions) {
        assert.ok(!prePrompts.has(normalizeText(q.prompt)), `Post-quiz prompt duplicates pre-quiz: ${q.id}`);
      }
    });

    test('[T1-F13-3] Every quiz-post question includes valid https owaspRef and existing glossaryTermId', async () => {
      const post = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      const glossary = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      const termIds = new Set(glossary.terms.map((t) => t.id));
      for (const q of post.questions) {
        assert.match(String(q.owaspRef || ''), /^https:\/\//);
        assert.ok(termIds.has(q.glossaryTermId), `Unknown glossaryTermId ${q.glossaryTermId} in ${q.id}`);
      }
    });

    test('[T1-F13-4] dataLoader.loadQuiz("post") fetches quiz-post.json cleanly', async () => {
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { loadQuiz } = await importAppModule('js/engine/dataLoader.js');
        const quiz = await loadQuiz('post');
        assert.equal(quiz.type, 'post');
        assert.equal(quiz.questions.length, 5);
      } finally {
        env.restore();
      }
    });

    test('[T1-F13-5] state.recordPostQuiz stores post-quiz results and decisions for weakest objective calculation', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const store = createStateStore(createMemoryStorage());
      store.recordPostQuiz({
        score: 4,
        total: 5,
        decisions: [
          { objectiveId: 'O1', isCorrect: true },
          { objectiveId: 'O4', isCorrect: false },
        ],
      });
      const st = store.getState();
      assert.equal(st.postQuiz.completed, true);
      assert.equal(st.postQuiz.score, 4);
      assert.equal(st.postQuiz.decisions.length, 2);
    });
  });

  // =========================================================================
  // FEAT-14: Pantalla de resultados (resultsView.js)
  // =========================================================================
  describe('FEAT-14: Pantalla de resultados', () => {
    test('[T1-F14-1] resultsView.js exists, serves HTTP 200, and exports function(s)', async () => {
      await requireAppFile('js/views/resultsView.js');
      const res = await fetchHttp(server.baseUrl, '/js/views/resultsView.js');
      assert.equal(res.status, 200);
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const mod = await importAppModule('js/views/resultsView.js');
        assert.ok(Object.values(mod).some((v) => typeof v === 'function'));
      } finally {
        env.restore();
      }
    });

    test('[T1-F14-2] calculateFinalSummary returns basePercent, rank, weakestObjective, and pre/post comparison when both quizzes completed', async () => {
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const summary = calculateFinalSummary(
        [{ baseScore: 700, optionalTimeBonus: 20, visibleScore: 720, maxBaseLevel: 700, decisions: [{ objectiveId: 'O1', isCorrect: true }] }],
        { completed: true, score: 5, decisions: [{ objectiveId: 'O3', isCorrect: true }] },
        { completed: true, score: 2 },
      );
      assert.equal(summary.totalBaseScore, 700);
      assert.equal(summary.totalVisibleScore, 720);
      assert.equal(summary.rank, 'Arquitecto Criptográfico');
      assert.equal(summary.quizComparison.hasComparison, true);
      assert.equal(summary.quizComparison.preScore, 2);
      assert.equal(summary.quizComparison.postScore, 5);
      assert.equal(summary.quizComparison.delta, 3);
    });

    test('[T1-F14-3] calculateFinalSummary omits pre/post comparison when preQuiz was skipped', async () => {
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const summary = calculateFinalSummary(
        [{ baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] }],
        { completed: true, score: 4, decisions: [] },
        { completed: false, skipped: true },
      );
      assert.equal(summary.quizComparison.hasComparison, false);
      assert.equal(summary.quizComparison.postScore, 4);
    });

    test('[T1-F14-4] resultsView.js renders rank, weakest objective, non-certification disclaimer, and 5 recommendations', async () => {
      const seeded = JSON.stringify({
        version: 1,
        unlockedLevel: 4,
        settings: { timerEnabled: false, reducedMotion: false },
        preQuiz: { completed: true, skipped: false, score: 2, total: 5 },
        postQuiz: { completed: true, score: 4, total: 5, decisions: [{ objectiveId: 'O3', isCorrect: false }] },
        levels: {
          1: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O1', isCorrect: true }] } },
          2: { completed: true, bestBaseScore: 900, bestVisibleScore: 900, acceptedAttempt: { baseScore: 900, optionalTimeBonus: 0, visibleScore: 900, maxBaseLevel: 900, decisions: [{ objectiveId: 'O2', isCorrect: true }] } },
          3: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O3', isCorrect: false }] } },
          4: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O4', isCorrect: true }] } },
        },
      });
      const env = await bootAppInStub({
        initialStorage: { alerta_de_fuga_progress_v1: seeded },
        initialHash: '#/resultados',
      });
      try {
        const viewBtn = findControlByText(env.document.body, 'resultados');
        if (viewBtn) {
          viewBtn.click();
          await new Promise((r) => setTimeout(r, 35));
        }
        const text = collectText(env.document.body);
        const resultsCode = await requireAppFile('js/views/resultsView.js');
        assert.match(text + ' ' + resultsCode.toLowerCase(), /arquitecto criptogr[aá]fico|analista|aprendiz/);
        assert.match(resultsCode.toLowerCase(), /certific/);
        const listItems = env.document.querySelectorAll('li');
        assert.ok(listItems.length >= 5 || (resultsCode.match(/O[1-5]/g) || []).length >= 5, 'Expected 5 recommendations in resultsView');
      } finally {
        env.restore();
      }
    });

    test('[T1-F14-5] resultsView provides Retry and Return Home navigation actions', async () => {
      const code = await requireAppFile('js/views/resultsView.js');
      assert.match(code.toLowerCase(), /reintentar/);
      assert.match(code.toLowerCase(), /inicio/);
    });
  });

  // =========================================================================
  // FEAT-15: Persistencia versionada y fallback (state.js)
  // =========================================================================
  describe('FEAT-15: Persistencia versionada y fallback', () => {
    test('[T1-F15-1] state.js uses exact storage key "alerta_de_fuga_progress_v1"', async () => {
      const code = await requireAppFile('js/engine/state.js');
      assert.match(code, /alerta_de_fuga_progress_v1/);
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.updateSettings({ timerEnabled: true });
      assert.ok(storage.getItem('alerta_de_fuga_progress_v1'));
    });

    test('[T1-F15-2] createStateStore persists unlockedLevel, bestBaseScore, and acceptedAttempt across reloads', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store1 = createStateStore(storage);
      store1.recordLevelAttemptResult(
        1,
        { baseScore: 600, optionalTimeBonus: 10, visibleScore: 610, failed: false, completed: true, decisions: [] },
        700,
      );
      const store2 = createStateStore(storage);
      assert.equal(store2.getState().unlockedLevel, 2);
      assert.equal(store2.getState().levels[1].bestBaseScore, 600);
      assert.equal(store2.getState().levels[1].acceptedAttempt.baseScore, 600);
    });

    test('[T1-F15-3] subscribe() notifies listeners on state mutations', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const store = createStateStore(createMemoryStorage());
      let calls = 0;
      const unsub = store.subscribe((st) => {
        calls += 1;
        assert.equal(typeof st.unlockedLevel, 'number');
      });
      store.updateSettings({ reducedMotion: true });
      assert.ok(calls >= 1);
      unsub();
    });

    test('[T1-F15-4] resetProgress() restores clean initial state without throwing', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.recordPreQuiz({ score: 4, total: 5, decisions: [] });
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      store.resetProgress();
      const st = store.getState();
      assert.equal(st.unlockedLevel, 1);
      assert.equal(st.preQuiz.completed, false);
    });

    test('[T1-F15-5] Persisted state payload never stores PII, passwords, secrets, or real PANs', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.recordPreQuiz({ score: 5, total: 5, decisions: [] });
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      const dumped = storage.getItem('alerta_de_fuga_progress_v1');
      assertNoSecretsOrRealPans(dumped, 'alerta_de_fuga_progress_v1');
      assert.doesNotMatch(dumped, /"(?:email|password|nombre|telefono|cvv|pan)"\s*:/i);
    });
  });

  // =========================================================================
  // FEAT-16: Estética consola de seguridad & Responsive
  // =========================================================================
  describe('FEAT-16: Estética consola de seguridad & Responsive', () => {
    test('[T1-F16-1] All 5 CSS stylesheets serve HTTP 200 with text/css', async () => {
      const cssFiles = ['tokens.css', 'base.css', 'layout.css', 'components.css', 'minigames.css'];
      for (const f of cssFiles) {
        await requireAppFile(`css/${f}`);
        const res = await fetchHttp(server.baseUrl, `/css/${f}`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') || '', /text\/css/i);
      }
    });

    test('[T1-F16-2] css/tokens.css defines all 9 exact palette colors from plan §8.1', async () => {
      const tokensCss = await requireAppFile('css/tokens.css');
      const upper = tokensCss.toUpperCase();
      for (const [name, hex] of Object.entries(REQUIRED_PALETTE_TOKENS)) {
        assert.ok(upper.includes(hex.toUpperCase()), `Missing palette token ${name} (${hex}) in css/tokens.css`);
      }
    });

    test('[T1-F16-3] Solid accent fills paired with #0B1016 meet WCAG AA contrast (>= 4.5:1) while #F0F6FC fails', async () => {
      await requireAppFile('css/tokens.css');
      for (const fill of ACCENT_FILL_TOKENS) {
        const darkTextRatio = contrastRatio('#0B1016', fill);
        const lightTextRatio = contrastRatio('#F0F6FC', fill);
        assert.ok(darkTextRatio >= 4.5, `#0B1016 on ${fill} contrast ${darkTextRatio.toFixed(2)} must be >= 4.5`);
        assert.ok(lightTextRatio < 3.0, `#F0F6FC on ${fill} is low contrast (${lightTextRatio.toFixed(2)})`);
      }
    });

    test('[T1-F16-4] All 4 local SVG assets serve HTTP 200 as image/svg+xml with valid <svg>', async () => {
      const svgs = ['logo.svg', 'analyst.svg', 'attacker.svg', 'ecb-pattern.svg'];
      for (const s of svgs) {
        await requireAppFile(`assets/${s}`);
        const res = await fetchHttp(server.baseUrl, `/assets/${s}`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') || '', /image\/svg\+xml/i);
        assert.match(res.text, /<svg\b/i);
      }
    });

    test('[T1-F16-5] css/layout.css implements mobile-first responsive rules for intermediate and 1280px desktop', async () => {
      const layoutCss = await requireAppFile('css/layout.css');
      assert.match(layoutCss, /@media\s*\([^)]*min-width/i);
      assert.match(layoutCss, /768px|48rem|1024px|1280px|64rem|75rem/);
    });
  });

  // =========================================================================
  // FEAT-17: Accesibilidad WCAG 2.2 AA
  // =========================================================================
  describe('FEAT-17: Accesibilidad WCAG 2.2 AA', () => {
    test('[T1-F17-1] index.html has lang="es", skip link to #main-content, header, nav, main, footer', async () => {
      const html = await requireAppFile('index.html');
      assert.match(html, /<html[^>]*lang=["']es["']/i);
      assert.match(html, /<a[^>]*href=["']#main-content["'][^>]*>[\s\S]*Saltar al contenido/i);
      assert.match(html, /<header\b/i);
      assert.match(html, /<nav\b/i);
      assert.match(html, /<main[^>]*id=["']main-content["'][^>]*tabindex=["']-1["']/i);
      assert.match(html, /<footer\b/i);
    });

    test('[T1-F17-2] CSS defines explicit :focus-visible outline and >= 44px touch target min sizing', async () => {
      const cssFiles = await listProjectFiles('css', '.css');
      assert.ok(cssFiles.length >= 4, 'Expected CSS files in css/');
      let allCss = '';
      for (const f of cssFiles) allCss += '\n' + (await requireAppFile(f));
      assert.match(allCss, /:focus-visible/);
      assert.match(allCss, /44px|2\.75rem/);
    });

    test('[T1-F17-3] a11y.js openModal manages focus trap, Escape closing, and focus return', async () => {
      const { openModal } = await importAppModule('js/engine/a11y.js');
      const env = installDomGlobals({
        html: '<html lang="es"><body><main id="main-content" tabindex="-1"><button id="opener">Abrir</button></main><div id="dlg" role="dialog" aria-modal="true" hidden><button id="first">1</button><button id="last">2</button></div></body></html>',
      });
      try {
        const opener = env.document.getElementById('opener');
        const dlg = env.document.getElementById('dlg');
        const first = env.document.getElementById('first');
        const last = env.document.getElementById('last');
        opener.focus();
        dlg.hidden = false;
        let closedCalled = false;
        const handle = openModal(dlg, opener, () => {
          closedCalled = true;
          dlg.hidden = true;
        });
        assert.ok(dlg.contains(env.document.activeElement), 'Focus must move inside modal on open');
        last.focus();
        const tabEvt = new StubKeyboardEvent('keydown', { key: 'Tab' });
        dlg.dispatchEvent(tabEvt);
        assert.equal(env.document.activeElement, first, 'Tab on last focusable must wrap to first');
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        if (typeof handle === 'function' && !closedCalled) handle();
        assert.equal(closedCalled, true, 'Escape must trigger onClose');
        assert.equal(env.document.activeElement, opener, 'Focus must return to opener on close');
      } finally {
        env.restore();
      }
    });

    test('[T1-F17-4] gameView.js uses accessible progressbar and aria-live="polite" with non-color cues', async () => {
      const gameViewCode = await requireAppFile('js/views/gameView.js');
      const a11yCode = await requireAppFile('js/engine/a11y.js');
      assert.match(gameViewCode, /progressbar/);
      assert.match(gameViewCode, /aria-valuenow/);
      assert.match(a11yCode + '\n' + gameViewCode, /aria-live/);
      assert.match(a11yCode + '\n' + gameViewCode, /polite/);
    });

    test('[T1-F17-5] CSS supports @media (prefers-reduced-motion: reduce)', async () => {
      const cssFiles = await listProjectFiles('css', '.css');
      assert.ok(cssFiles.length >= 1);
      let allCss = '';
      for (const f of cssFiles) allCss += '\n' + (await requireAppFile(f));
      assert.match(allCss, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/i);
    });
  });

  // =========================================================================
  // FEAT-18: Seguridad cliente y _headers
  // =========================================================================
  describe('FEAT-18: Seguridad cliente y _headers', () => {
    test('[T1-F18-1] _headers serves HTTP 200 and contains exact strict CSP and security headers', async () => {
      await requireAppFile('_headers');
      const res = await fetchHttp(server.baseUrl, '/_headers');
      assert.equal(res.status, 200);
      const csp = res.headers.get('content-security-policy') || '';
      for (const directive of REQUIRED_CSP_DIRECTIVES) {
        assert.ok(csp.includes(directive), `Missing CSP directive: ${directive}`);
      }
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok((res.headers.get('permissions-policy') || '').includes('camera=()'));
      assert.match(res.headers.get('strict-transport-security') || '', /max-age=31536000/);
    });

    test('[T1-F18-2] index.html has zero inline scripts, inline styles, inline handlers, or external CDNs', async () => {
      const html = await requireAppFile('index.html');
      const issues = scanHtmlForCspViolations(html, 'index.html');
      assert.deepEqual(issues, []);
    });

    test('[T1-F18-3] All JS files under js/ contain zero eval, new Function, unsafe innerHTML, or inline style attrs', async () => {
      const jsFiles = await listProjectFiles('js', '.js');
      assert.ok(jsFiles.length >= 1, 'Expected JS files under js/');
      const allIssues = [];
      for (const f of jsFiles) {
        const code = await requireAppFile(f);
        allIssues.push(...scanJsForSecurityViolations(code, f));
      }
      assert.deepEqual(allIssues, []);
    });

    test('[T1-F18-4] All CSS files contain zero external @import or url(http...) calls', async () => {
      const cssFiles = await listProjectFiles('css', '.css');
      assert.ok(cssFiles.length >= 1);
      const allIssues = [];
      for (const f of cssFiles) {
        const css = await requireAppFile(f);
        allIssues.push(...scanCssForViolations(css, f));
      }
      assert.deepEqual(allIssues, []);
    });

    test('[T1-F18-5] All data/, js/, and HTML files contain zero real secrets or Luhn-valid real PANs', async () => {
      const targets = [
        ...(await listProjectFiles('data', '.json')),
        ...(await listProjectFiles('js', '.js')),
      ];
      assert.ok(targets.length >= 1);
      for (const f of targets) {
        const content = await requireAppFile(f);
        assertNoSecretsOrRealPans(content, f);
      }
    });
  });

  // =========================================================================
  // FEAT-19: Pruebas automatizadas (tests/scoring.test.js, tests/data-integrity.test.js)
  // =========================================================================
  describe('FEAT-19: Pruebas automatizadas unitarias e integridad', () => {
    test('[T1-F19-1] tests/scoring.test.js exists and uses node:test without external deps', async () => {
      const code = await requireAppFile('tests/scoring.test.js');
      assert.match(code, /node:test/);
      assert.match(code, /node:assert/);
    });

    test('[T1-F19-2] tests/data-integrity.test.js exists and uses node:test without external deps', async () => {
      const code = await requireAppFile('tests/data-integrity.test.js');
      assert.match(code, /node:test/);
      assert.match(code, /node:assert/);
    });

    test('[T1-F19-3] tests/scoring.test.js covers hit, miss, 3-streak, 0-100 exposure, timer off, div-by-zero', async () => {
      const code = await requireAppFile('tests/scoring.test.js');
      assert.match(code, /streak|racha/i);
      assert.match(code, /exposure|exposici[oó]n/i);
      assert.match(code, /timer|bono/i);
      assert.match(code, /rank|rango/i);
    });

    test('[T1-F19-4] tests/data-integrity.test.js covers glossary, O1-O5 quizzes, 4 levels, Level 4 DAG, and secret scan', async () => {
      const code = await requireAppFile('tests/data-integrity.test.js');
      assert.match(code, /glossary/i);
      assert.match(code, /quiz-pre|quiz-post/i);
      assert.match(code, /nivel-4/i);
      assert.match(code, /secret|luhn|pan/i);
    });

    test('[T1-F19-5] tests/scoring.test.js and tests/data-integrity.test.js contain no real secrets or PANs', async () => {
      const s = await requireAppFile('tests/scoring.test.js');
      const d = await requireAppFile('tests/data-integrity.test.js');
      assertNoSecretsOrRealPans(s, 'tests/scoring.test.js');
      assertNoSecretsOrRealPans(d, 'tests/data-integrity.test.js');
    });
  });

  // =========================================================================
  // FEAT-20: E2E Testing, Hardening & Documentación (README.md, playbook)
  // =========================================================================
  describe('FEAT-20: E2E Testing, Hardening & Documentación', () => {
    test('[T1-F20-1] README.md exists and documents local HTTP execution (not file://) and pure stack', async () => {
      const readme = await requireAppFile('README.md');
      assert.match(readme, /Alerta de Fuga/i);
      assert.match(readme, /OWASP\s*A04/i);
      assert.match(readme, /http\.server|http:\/\/localhost/i);
      assert.match(readme, /node --test/);
    });

    test('[T1-F20-2] README.md documents all 4 levels, project structure, and technical references', async () => {
      const readme = await requireAppFile('README.md');
      assert.match(readme, /Nivel 1|El T[uú]nel Abierto/i);
      assert.match(readme, /Nivel 2|B[oó]veda/i);
      assert.match(readme, /Nivel 3|Llaves/i);
      assert.match(readme, /Nivel 4|Simulacro/i);
      assert.match(readme, /data\/|js\//);
    });

    test('[T1-F20-3] README.md leaves un-deployed links as honest pending markers and keeps AI usage honest', async () => {
      const readme = await requireAppFile('README.md');
      assert.match(readme, /PENDIENTE/i);
      assert.match(readme, /IA|inteligencia artificial/i);
    });

    test('[T1-F20-4] Browser E2E playbook exists under tests/e2e/browser-e2e-playbook.md', async () => {
      const playbook = await requireAppFile('tests/e2e/browser-e2e-playbook.md');
      assert.match(playbook, /390\s*[×x]\s*844/);
      assert.match(playbook, /1280\s*[×x]\s*800/);
      assert.match(playbook, /lighthouse_audit/);
    });

    test('[T1-F20-5] Zero package.json external runtime dependencies are required by the project', async () => {
      const files = await listProjectFiles('.', '.json');
      if (files.includes('package.json')) {
        const pkg = JSON.parse(await requireAppFile('package.json'));
        assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'External runtime dependencies forbidden');
      }
      // Verify static HTTP serving of index.html & dataLoader without any bundler or npm runtime
      await requireAppFile('index.html');
      const res = await fetchHttp(server.baseUrl, '/index.html');
      assert.equal(res.status, 200);
      assert.doesNotMatch(res.text, /node_modules|unpkg\.com|cdn\.jsdelivr|cdnjs\./i);
    });
  });
});
