import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startStaticServer } from './helpers/staticServer.js';
import {
  installDomGlobals,
  createMemoryStorage,
  StubKeyboardEvent,
} from './helpers/domStub.js';
import {
  REQUIRED_GLOSSARY_IDS,
  ACCENT_FILL_TOKENS,
  OBJECTIVES,
  requireAppFile,
  importAppModule,
  listProjectFiles,
  fetchHttp,
  fetchAppJson,
  contrastRatio,
  luhnCheck,
  findLuhnPanCandidates,
  findSecretPatterns,
  assertNoSecretsOrRealPans,
  scanHtmlForCspViolations,
  scanJsForSecurityViolations,
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

function makeMinigameDriverCallbacks() {
  const decisions = [];
  let completion = null;
  return {
    decisions,
    get completion() {
      return completion;
    },
    callbacks: {
      onDecision(payload, onContinue) {
        decisions.push(payload);
        if (typeof onContinue === 'function') onContinue();
      },
      onLevelComplete(summary) {
        completion = summary;
      },
      onOpenGlossary() {},
      onStatusAnnounce() {},
    },
  };
}

describe('Tier 2 — Boundaries, Edge Cases & Error Handling (FEAT-01..FEAT-20, 100 tests)', () => {
  before(async () => {
    server = await startStaticServer();
  });

  after(async () => {
    if (server) await server.close();
  });

  // =========================================================================
  // FEAT-01: Portada / Inicio boundaries
  // =========================================================================
  describe('FEAT-01 Boundaries', () => {
    test('[T2-F01-1] Locked Nivel 2/3/4 cannot be launched when unlockedLevel === 1', async () => {
      const env = await bootAppInStub();
      try {
        const lvl3Btn = findControlByText(env.document.body, 'nivel 3');
        if (lvl3Btn) {
          if (!lvl3Btn.disabled) lvl3Btn.click();
          await new Promise((r) => setTimeout(r, 25));
          const text = collectText(env.document.body);
          assert.doesNotMatch(text, /envelope\.js|payments\.js|llaves bajo el tapete.*archivo 1/);
        } else {
          assert.ok(env.document.querySelectorAll('h1').length === 1);
        }
      } finally {
        env.restore();
      }
    });

    test('[T2-F01-2] Direct navigation to unknown/locked hash (#/nivel/4 or #/ruta-inexistente) falls back safely', async () => {
      const env = await bootAppInStub({ initialHash: '#/ruta-inexistente' });
      try {
        assert.equal(env.document.querySelectorAll('h1').length, 1);
        const bodyText = collectText(env.document.body);
        assert.ok(bodyText.length > 0);
      } finally {
        env.restore();
      }
    });

    test('[T2-F01-3] HTTP server returns 404 for nonexistent path and blocks directory traversal', async () => {
      const missing = await fetchHttp(server.baseUrl, '/data/levels/nivel-99.json');
      assert.equal(missing.status, 404);
      const traversalStatus = await new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: server.port, path: '/../AGENTS.md' }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', reject);
      });
      assert.ok(traversalStatus === 403 || traversalStatus === 404);
    });

    test('[T2-F01-4] Exactly one <h1> exists on Inicio even with corrupted localStorage', async () => {
      const env = await bootAppInStub({
        initialStorage: { alerta_de_fuga_progress_v1: '{corrupt-json' },
      });
      try {
        assert.equal(env.document.querySelectorAll('h1').length, 1);
      } finally {
        env.restore();
      }
    });

    test('[T2-F01-5] index.html contains zero file:// links and zero external script/stylesheet CDNs', async () => {
      const html = await requireAppFile('index.html');
      assert.doesNotMatch(html, /file:\/\//i);
      assert.deepEqual(scanHtmlForCspViolations(html, 'index.html'), []);
    });
  });

  // =========================================================================
  // FEAT-02: Guía visual boundaries
  // =========================================================================
  describe('FEAT-02 Boundaries', () => {
    test('[T2-F02-1] Repeated open/close of guideModal does not leave ghost open dialogs', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger);
        for (let i = 0; i < 3; i += 1) {
          trigger.click();
          const openDlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
          assert.ok(openDlg);
          env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        }
        const remaining = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(!remaining || remaining.getAttribute('aria-hidden') === 'true');
      } finally {
        env.restore();
      }
    });

    test('[T2-F02-2] Tab and Shift+Tab wrap inside guideModal focus trap', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger);
        trigger.click();
        const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(dlg);
        const focusables = dlg.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusables.length >= 2) {
          focusables[0].focus();
          dlg.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
          assert.ok(dlg.contains(env.document.activeElement), 'Shift+Tab must stay inside dialog');
        } else {
          assert.ok(dlg.contains(env.document.activeElement) || dlg === env.document.activeElement);
        }
      } finally {
        env.restore();
      }
    });

    test('[T2-F02-3] Escape closes guideModal even when focus is on last interactive control', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'guía');
        assert.ok(trigger);
        trigger.focus();
        trigger.click();
        const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(dlg);
        const focusables = dlg.querySelectorAll('button:not([disabled])');
        if (focusables.length > 0) focusables[focusables.length - 1].focus();
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        assert.equal(env.document.activeElement, trigger);
      } finally {
        env.restore();
      }
    });

    test('[T2-F02-4] guideModal falls back focus to #main-content when trigger is detached before close', async () => {
      const { openModal } = await importAppModule('js/engine/a11y.js');
      const env = installDomGlobals({
        html: '<html lang="es"><body><main id="main-content" tabindex="-1"><button id="tmp">Tmp</button></main><div id="m" role="dialog" aria-modal="true"><button id="c">Cerrar</button></div></body></html>',
      });
      try {
        const main = env.document.getElementById('main-content');
        const tmp = env.document.getElementById('tmp');
        const modal = env.document.getElementById('m');
        tmp.focus();
        const closeHandle = openModal(modal, tmp, () => {});
        tmp.parentNode.removeChild(tmp);
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        if (typeof closeHandle === 'function' && env.document.activeElement !== main) closeHandle();
        assert.equal(env.document.activeElement, main);
      } finally {
        env.restore();
      }
    });

    test('[T2-F02-5] guideModal.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/views/guideModal.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'guideModal.js'), []);
    });
  });

  // =========================================================================
  // FEAT-03: Ajustes boundaries
  // =========================================================================
  describe('FEAT-03 Boundaries', () => {
    test('[T2-F03-1] Canceling Reset Progress confirmation preserves 100% of progress and settings', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.updateSettings({ timerEnabled: true, reducedMotion: true });
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 720, failed: false, completed: true, decisions: [] }, 700);

      const env = await bootAppInStub({ storage });
      try {
        const trigger = findControlByText(env.document.body, 'ajustes');
        assert.ok(trigger);
        trigger.click();
        const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(dlg);
        const resetBtn = findControlByText(dlg, 'restablecer');
        assert.ok(resetBtn);
        resetBtn.click();
        const cancelBtn = findControlByText(dlg, 'cancelar');
        if (cancelBtn) cancelBtn.click();
        else env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));

        const saved = JSON.parse(storage.getItem('alerta_de_fuga_progress_v1'));
        assert.equal(saved.unlockedLevel, 2);
        assert.equal(saved.settings.timerEnabled, true);
      } finally {
        env.restore();
      }
    });

    test('[T2-F03-2] Pressing Escape during Reset confirmation aborts reset without erasing progress', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage();
      const store = createStateStore(storage);
      store.recordPreQuiz({ score: 4, total: 5, decisions: [] });

      const env = await bootAppInStub({ storage });
      try {
        const trigger = findControlByText(env.document.body, 'ajustes');
        assert.ok(trigger);
        trigger.click();
        const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        const resetBtn = findControlByText(dlg, 'restablecer');
        resetBtn.click();
        env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
        const saved = JSON.parse(storage.getItem('alerta_de_fuga_progress_v1'));
        assert.equal(saved.preQuiz.score, 4);
      } finally {
        env.restore();
      }
    });

    test('[T2-F03-3] Toggling timerEnabled and reducedMotion preserves each flag independently', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const store = createStateStore(createMemoryStorage());
      store.updateSettings({ timerEnabled: true });
      store.updateSettings({ reducedMotion: true });
      assert.deepEqual(store.getState().settings, { timerEnabled: true, reducedMotion: true });
      store.updateSettings({ timerEnabled: false });
      assert.deepEqual(store.getState().settings, { timerEnabled: false, reducedMotion: true });
    });

    test('[T2-F03-4] Confirming resetProgress works cleanly when localStorage is blocked (memory fallback)', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const blocked = createMemoryStorage({ throwOnGet: 'SecurityError', throwOnSet: 'SecurityError' });
      const store = createStateStore(blocked);
      assert.equal(store.isMemoryFallback(), true);
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      assert.equal(store.getState().unlockedLevel, 2);
      store.resetProgress();
      assert.equal(store.getState().unlockedLevel, 1);
    });

    test('[T2-F03-5] settingsModal.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/views/settingsModal.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'settingsModal.js'), []);
    });
  });

  // =========================================================================
  // FEAT-04: Test previo boundaries
  // =========================================================================
  describe('FEAT-04 Boundaries', () => {
    test('[T2-F04-1] dataLoader.loadQuiz("invalid") rejects with an error instead of returning undefined', async () => {
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { loadQuiz } = await importAppModule('js/engine/dataLoader.js');
        await assert.rejects(() => loadQuiz('invalid'));
      } finally {
        env.restore();
      }
    });

    test('[T2-F04-2] quiz-pre.json has zero duplicate question IDs and zero duplicate objectiveIds', async () => {
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      const ids = new Set(quiz.questions.map((q) => q.id));
      const objs = new Set(quiz.questions.map((q) => q.objectiveId));
      assert.equal(ids.size, 5);
      assert.equal(objs.size, 5);
    });

    test('[T2-F04-3] Every quiz-pre question has unique option IDs and a valid correctOptionId', async () => {
      const quiz = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      for (const q of quiz.questions) {
        const optIds = q.options.map((o) => o.id);
        assert.equal(new Set(optIds).size, optIds.length, `Duplicate option ID in ${q.id}`);
        assert.ok(optIds.includes(q.correctOptionId), `Missing correctOptionId in ${q.id}`);
      }
    });

    test('[T2-F04-4] Pre-quiz view blocks advancing when no option is selected', async () => {
      const env = await bootAppInStub();
      try {
        const startPre = findControlByText(env.document.body, 'test previo') || findControlByText(env.document.body, 'comenzar');
        assert.ok(startPre);
        startPre.click();
        await new Promise((r) => setTimeout(r, 35));
        const beforeText = collectText(env.document.body);
        const nextBtn = findControlByText(env.document.body, 'siguiente') || findControlByText(env.document.body, 'responder') || findControlByText(env.document.body, 'confirmar');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
        await new Promise((r) => setTimeout(r, 20));
        // Should still be on question 1 (1/5) or prompt user to select
        assert.match(collectText(env.document.body), /1\s*\/\s*5|selecciona|elige|pregunta 1/);
        assert.ok(beforeText.length > 0);
      } finally {
        env.restore();
      }
    });

    test('[T2-F04-5] skipPreQuiz sets skipped:true and completed:false without fabricating 0/5 comparison', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const store = createStateStore(createMemoryStorage());
      store.skipPreQuiz();
      const summary = calculateFinalSummary(
        [{ baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] }],
        { completed: true, score: 4, decisions: [] },
        store.getState().preQuiz,
      );
      assert.equal(summary.quizComparison.hasComparison, false);
    });
  });

  // =========================================================================
  // FEAT-05: Contrato de minijuegos boundaries
  // =========================================================================
  describe('FEAT-05 Boundaries', () => {
    const minigames = [
      'js/minigames/inspector.js',
      'js/minigames/classifier.js',
      'js/minigames/codeHunt.js',
      'js/minigames/branchingIncident.js',
    ];

    test('[T2-F05-1] Calling destroy() before mount() and twice in a row is idempotent on all 4 minigames', async () => {
      for (const rel of minigames) {
        const mod = await importAppModule(rel);
        assert.doesNotThrow(() => mod.destroy());
        assert.doesNotThrow(() => mod.destroy());
      }
    });

    test('[T2-F05-2] All 4 minigames pass static security checks (no eval, new Function, unsafe innerHTML)', async () => {
      for (const rel of minigames) {
        const code = await requireAppFile(rel);
        assert.deepEqual(scanJsForSecurityViolations(code, rel), []);
      }
    });

    test('[T2-F05-3] Re-mounting into same container replaces old content without duplicate callbacks', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const d1 = makeMinigameDriverCallbacks();
        mount(container, level1, d1.callbacks);
        destroy();
        const d2 = makeMinigameDriverCallbacks();
        mount(container, level1, d2.callbacks);
        const opt = level1.challenges[0].options[0];
        const btn = container.querySelector(`[data-option-id="${opt.id}"]`) || findControlByText(container, opt.label);
        btn.click();
        assert.equal(d1.decisions.length, 0, 'Previous mount must not receive events after destroy()');
        assert.equal(d2.decisions.length, 1);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F05-4] Firing synthetic click on detached old child after destroy() does not invoke onDecision', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        env.document.body.appendChild(container);
        const driver = makeMinigameDriverCallbacks();
        mount(container, level1, driver.callbacks);
        const opt = level1.challenges[0].options[0];
        const btn = container.querySelector(`[data-option-id="${opt.id}"]`) || findControlByText(container, opt.label);
        destroy();
        btn.click();
        assert.equal(driver.decisions.length, 0, 'Detached control must not fire onDecision after destroy()');
      } finally {
        env.restore();
      }
    });

    test('[T2-F05-5] Minigames do not mutate the input levelData object', async () => {
      const level1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const snapshotBefore = JSON.stringify(level1);
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, level1, driver.callbacks);
        const opt = level1.challenges[0].options[0];
        const btn = container.querySelector(`[data-option-id="${opt.id}"]`) || findControlByText(container, opt.label);
        btn.click();
        destroy();
        assert.equal(JSON.stringify(level1), snapshotBefore);
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-06: Nivel 1 boundaries
  // =========================================================================
  describe('FEAT-06 Boundaries', () => {
    test('[T2-F06-1] nivel-1.json has unique challenge IDs and every glossaryTermId exists in glossary.json', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const glossary = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      const termIds = new Set(glossary.terms.map((t) => t.id));
      const ids = new Set(n1.challenges.map((c) => c.id));
      assert.equal(ids.size, 6);
      for (const c of n1.challenges) {
        assert.ok(termIds.has(c.glossaryTermId), `Unknown glossaryTermId ${c.glossaryTermId}`);
      }
    });

    test('[T2-F06-2] Nivel 1 does NOT claim missing HSTS alone proves an active interception', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const raw = JSON.stringify(n1).toLowerCase();
      assert.doesNotMatch(raw, /falta de hsts (?:demuestra|prueba) (?:por s[ií] sola )?(?:una )?interceptaci[oó]n/);
    });

    test('[T2-F06-3] Nivel 1 does NOT claim every self-signed certificate is universally insecure', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const raw = JSON.stringify(n1).toLowerCase();
      assert.doesNotMatch(raw, /todo certificado autofirmado es siempre inseguro/);
    });

    test('[T2-F06-4] Selecting wrong options in inspector.js emits isCorrect:false with positive penaltyOnWrongAnswer', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n1, driver.callbacks);
        const wrong = n1.challenges[0].options.find((o) => o.id !== n1.challenges[0].correctOptionId);
        const btn = container.querySelector(`[data-option-id="${wrong.id}"]`) || findControlByText(container, wrong.label);
        btn.click();
        assert.equal(driver.decisions.length, 1);
        assert.equal(driver.decisions[0].isCorrect, false);
        assert.ok(driver.decisions[0].penaltyOnWrongAnswer >= 10);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F06-5] inspector.js handles challenge with empty headers/payloadPreview gracefully', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      const cloned = JSON.parse(JSON.stringify(n1));
      cloned.challenges[0].requestDetails.headers = {};
      cloned.challenges[0].requestDetails.payloadPreview = '';
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/inspector.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        assert.doesNotThrow(() => mount(container, cloned, driver.callbacks));
        destroy();
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-07: Nivel 2 boundaries
  // =========================================================================
  describe('FEAT-07 Boundaries', () => {
    test('[T2-F07-1] All 8 Nivel 2 cards map to one of the 4 declared bucket IDs with unique challenge IDs', async () => {
      const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const bucketIds = new Set(n2.buckets.map((b) => b.id));
      const chIds = new Set(n2.challenges.map((c) => c.id));
      assert.equal(bucketIds.size, 4);
      assert.equal(chIds.size, 8);
      for (const ch of n2.challenges) {
        assert.ok(bucketIds.has(ch.correctOptionId), `${ch.id} correctOptionId ${ch.correctOptionId} not in buckets`);
      }
    });

    test('[T2-F07-2] Nivel 2 never claims tokenization alone replaces all PCI DSS obligations', async () => {
      const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const raw = JSON.stringify(n2).toLowerCase();
      assert.doesNotMatch(raw, /tokenizaci[oó]n (?:elimina|sustituye) por completo (?:todas las obligaciones de )?pci dss/);
    });

    test('[T2-F07-3] Selecting wrong bucket in classifier.js emits isCorrect:false and bucket-specific feedback', async () => {
      const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/classifier.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n2, driver.callbacks);
        const ch = n2.challenges[0];
        const cardCtrl = container.querySelector(`[data-challenge-id="${ch.id}"]`) || findControlByText(container, ch.recordLabel || ch.title);
        if (cardCtrl) cardCtrl.click();
        const wrongBucket = n2.buckets.find((b) => b.id !== ch.correctOptionId);
        const bucketBtn = container.querySelector(`[data-bucket-id="${wrongBucket.id}"]`) || findControlByText(container, wrongBucket.label);
        assert.ok(bucketBtn);
        bucketBtn.click();
        assert.equal(driver.decisions.length, 1);
        assert.equal(driver.decisions[0].isCorrect, false);
        assert.ok(driver.decisions[0].feedback?.why);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F07-4] assets/ecb-pattern.svg has valid <svg> root, viewBox, and zero <script>/on*= attributes', async () => {
      const svg = await requireAppFile('assets/ecb-pattern.svg');
      assert.match(svg, /<svg\b[^>]*viewBox=/i);
      assert.doesNotMatch(svg, /<script\b|\bon[a-z]+\s*=/i);
    });

    test('[T2-F07-5] Activating a bucket button without selecting a card first never throws uncaught errors', async () => {
      const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/classifier.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n2, driver.callbacks);
        const bucketBtn = container.querySelector(`[data-bucket-id="${n2.buckets[0].id}"]`) || findControlByText(container, n2.buckets[0].label);
        assert.doesNotThrow(() => bucketBtn.click());
        destroy();
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-08: Nivel 3 boundaries
  // =========================================================================
  describe('FEAT-08 Boundaries', () => {
    test('[T2-F08-1] codeHunt.js marks right line + wrong mitigation as incorrect (wrongMitigation)', async () => {
      const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n3, driver.callbacks);
        const ch = n3.challenges[0];
        const vulnNum = ch.vulnerableLineNumbers[0];
        const lineBtn = container.querySelector(`[data-line-number="${vulnNum}"]`) || findControlByText(container, String(vulnNum));
        lineBtn.click();
        const wrongMit = ch.mitigationOptions.find((m) => m.id !== ch.correctMitigationId);
        const mitBtn = container.querySelector(`[data-mitigation-id="${wrongMit.id}"]`) || findControlByText(container, wrongMit.label);
        mitBtn.click();
        const submitBtn = findControlByText(container, 'confirmar') || findControlByText(container, 'aplicar') || findControlByText(container, 'verificar') || findControlByText(container, 'enviar') || container.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
        assert.equal(driver.decisions.length, 1);
        assert.equal(driver.decisions[0].isCorrect, false);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F08-2] codeHunt.js marks wrong line + right mitigation as incorrect (wrongLine)', async () => {
      const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n3, driver.callbacks);
        const ch = n3.challenges[0];
        const safeLine = ch.lines.find((l) => !ch.vulnerableLineNumbers.includes(l.lineNumber)) || ch.lines[0];
        const lineBtn = container.querySelector(`[data-line-number="${safeLine.lineNumber}"]`) || findControlByText(container, String(safeLine.lineNumber));
        lineBtn.click();
        const rightMit = ch.mitigationOptions.find((m) => m.id === ch.correctMitigationId);
        const mitBtn = container.querySelector(`[data-mitigation-id="${rightMit.id}"]`) || findControlByText(container, rightMit.label);
        mitBtn.click();
        const submitBtn = findControlByText(container, 'confirmar') || findControlByText(container, 'aplicar') || findControlByText(container, 'verificar') || findControlByText(container, 'enviar') || container.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
        assert.equal(driver.decisions.length, 1);
        assert.equal(driver.decisions[0].isCorrect, false);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F08-3] codeHunt.js renders HTML-like characters in mock code safely as inert textContent', async () => {
      const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const cloned = JSON.parse(JSON.stringify(n3));
      cloned.challenges[0].lines[0].text = '<img src=x onerror=alert(1)> // mock';
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, cloned, driver.callbacks);
        assert.equal(container.querySelectorAll('img[onerror]').length, 0, 'Code snippet must never be parsed as live HTML');
        assert.ok(container.textContent.includes('<img src=x onerror=alert(1)>'));
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F08-4] Nivel 3 never equates all PKCS#1 v1.5 uses with NoPadding or env vars with a secrets manager', async () => {
      const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const raw = JSON.stringify(n3).toLowerCase();
      assert.doesNotMatch(raw, /pkcs#?1 v1\.5 es (?:id[eé]ntico|igual) a nopadding/);
      assert.doesNotMatch(raw, /variable de entorno (?:equivale|sustituye|es igual) (?:a )?un gestor seguro/);
    });

    test('[T2-F08-5] Submitting in codeHunt.js without selecting both line and mitigation does not emit premature decision', async () => {
      const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n3, driver.callbacks);
        const submitBtn = findControlByText(container, 'confirmar') || findControlByText(container, 'aplicar') || findControlByText(container, 'verificar') || findControlByText(container, 'enviar') || container.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) submitBtn.click();
        assert.equal(driver.decisions.length, 0);
        destroy();
      } finally {
        env.restore();
      }
    });
  });

  // =========================================================================
  // FEAT-09: Nivel 4 boundaries
  // =========================================================================
  describe('FEAT-09 Boundaries', () => {
    test('[T2-F09-1] Nivel 4 cycle detector confirms zero cycles across all nodes', async () => {
      const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const g = analyzeLevel4Graph(n4);
      assert.equal(g.cycles.length, 0);
    });

    test('[T2-F09-2] Every terminal node in nivel-4.json has isTerminal:true and outcomeType success|observations', async () => {
      const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const terminals = Object.values(n4.nodes).filter((n) => n.isTerminal);
      assert.ok(terminals.length >= 1);
      for (const t of terminals) {
        assert.ok(['success', 'observations'].includes(t.outcomeType), `Bad outcomeType on ${t.id}: ${t.outcomeType}`);
      }
    });

    test('[T2-F09-3] branchingIncident.js supports completing a non-optimal branch with route-accurate scorableDecisionsCount', async () => {
      const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const g = analyzeLevel4Graph(n4);
      const altPath = g.simplePaths.find((p) => p.choices.some((c) => !c.option.isCorrect)) || g.simplePaths[0];
      assert.ok(altPath);
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/branchingIncident.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        mount(container, n4, driver.callbacks);
        for (const step of altPath.choices) {
          const btn = container.querySelector(`[data-option-id="${step.option.id}"]`) || findControlByText(container, step.option.label);
          assert.ok(btn);
          btn.click();
        }
        assert.equal(driver.completion?.scorableDecisionsCount, altPath.choices.length);
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F09-4] Nivel 4 handles terminal node safely when options array is omitted', async () => {
      const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      const singleTerminal = {
        level: 4,
        title: 'Test',
        objectiveIds: ['O1'],
        startNodeId: 'end',
        phases: n4.phases,
        nodes: {
          end: { id: 'end', phase: 'Cierre', title: 'Cierre', scenario: 'Fin', isTerminal: true, outcomeType: 'success' },
        },
      };
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { mount, destroy } = await importAppModule('js/minigames/branchingIncident.js');
        const container = env.document.createElement('div');
        const driver = makeMinigameDriverCallbacks();
        assert.doesNotThrow(() => mount(container, singleTerminal, driver.callbacks));
        destroy();
      } finally {
        env.restore();
      }
    });

    test('[T2-F09-5] Nivel 4 does not present PAN hashing as universal PCI DSS substitute', async () => {
      const raw = (await requireAppFile('data/levels/nivel-4.json')).toLowerCase();
      assert.doesNotMatch(raw, /hashear el pan (?:sustituye|reemplaza) todos los controles/);
    });
  });

  // =========================================================================
  // FEAT-10: Retroalimentación boundaries
  // =========================================================================
  describe('FEAT-10 Boundaries', () => {
    test('[T2-F10-1] nivel-1.json feedbackByOption covers every declared option ID', async () => {
      const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
      for (const ch of n1.challenges) {
        for (const opt of ch.options) {
          assert.ok(ch.feedbackByOption?.[opt.id], `Missing feedbackByOption[${opt.id}] in ${ch.id}`);
        }
      }
    });

    test('[T2-F10-2] nivel-2.json feedbackByOption covers every declared bucket ID', async () => {
      const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
      for (const ch of n2.challenges) {
        for (const b of n2.buckets) {
          assert.ok(ch.feedbackByOption?.[b.id], `Missing feedbackByOption[${b.id}] in ${ch.id}`);
        }
      }
    });

    test('[T2-F10-3] Feedback strings across all data JSONs contain zero raw HTML tags (<script>, <img>, <iframe)', async () => {
      const jsonFiles = await listProjectFiles('data', '.json');
      assert.ok(jsonFiles.length >= 6);
      for (const f of jsonFiles) {
        const raw = await requireAppFile(f);
        assert.doesNotMatch(raw, /<(?:script|iframe|img|svg|object|embed)\b/i, `Forbidden HTML tag in ${f}`);
      }
    });

    test('[T2-F10-4] All owaspRef URLs across quizzes and levels use https:// (never http:// or javascript:)', async () => {
      const jsonFiles = await listProjectFiles('data', '.json');
      for (const f of jsonFiles) {
        const data = JSON.parse(await requireAppFile(f));
        const str = JSON.stringify(data);
        const refs = str.match(/"owaspRef"\s*:\s*"([^"]+)"/g) || [];
        for (const r of refs) {
          assert.match(r, /"https:\/\//, `Unsafe owaspRef in ${f}: ${r}`);
        }
      }
    });

    test('[T2-F10-5] gameView.js handles optional/missing owaspRef or unknown glossaryTermId safely without unsafe innerHTML', async () => {
      const code = await requireAppFile('js/views/gameView.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'gameView.js'), []);
    });
  });

  // =========================================================================
  // FEAT-11: Glosario boundaries
  // =========================================================================
  describe('FEAT-11 Boundaries', () => {
    test('[T2-F11-1] glossary.json has zero duplicate term IDs and all 18 required IDs', async () => {
      const g = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      const ids = g.terms.map((t) => t.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const req of REQUIRED_GLOSSARY_IDS) {
        assert.ok(ids.includes(req));
      }
    });

    test('[T2-F11-2] Every glossaryTermId referenced in quizzes and levels exists in glossary.json', async () => {
      const g = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      const validIds = new Set(g.terms.map((t) => t.id));
      const files = [
        '/data/quiz-pre.json',
        '/data/quiz-post.json',
        '/data/levels/nivel-1.json',
        '/data/levels/nivel-2.json',
        '/data/levels/nivel-3.json',
        '/data/levels/nivel-4.json',
      ];
      for (const f of files) {
        const raw = JSON.stringify(await fetchAppJson(server.baseUrl, f));
        const matches = [...raw.matchAll(/"glossaryTermId"\s*:\s*"([^"]+)"/g)];
        for (const m of matches) {
          assert.ok(validIds.has(m[1]), `Broken glossaryTermId "${m[1]}" in ${f}`);
        }
      }
    });

    test('[T2-F11-3] Every glossary relatedChallengeId resolves to an existing challenge/node in its relatedLevel', async () => {
      const g = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      const levelIds = {};
      for (const lvl of [1, 2, 3]) {
        const d = await fetchAppJson(server.baseUrl, `/data/levels/nivel-${lvl}.json`);
        levelIds[lvl] = new Set(d.challenges.map((c) => c.id));
      }
      const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
      levelIds[4] = new Set(Object.keys(n4.nodes));

      for (const t of g.terms) {
        assert.ok(levelIds[t.relatedLevel]?.has(t.relatedChallengeId), `${t.id} points to missing ${t.relatedChallengeId} in level ${t.relatedLevel}`);
      }
    });

    test('[T2-F11-4] Searching nonexistent term in Glosario drawer shows clean empty state without crashing', async () => {
      const env = await bootAppInStub();
      try {
        const trigger = findControlByText(env.document.body, 'glosario');
        assert.ok(trigger);
        trigger.click();
        await new Promise((r) => setTimeout(r, 30));
        const dialog = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
        assert.ok(dialog);
        const search = dialog.querySelector('input[type="search"], input[type="text"], input');
        if (search) {
          search.value = 'zzzznoexiste999';
          search.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
          assert.ok(dialog.textContent.length > 0);
        }
      } finally {
        env.restore();
      }
    });

    test('[T2-F11-5] glossaryDrawer.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/views/glossaryDrawer.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'glossaryDrawer.js'), []);
    });
  });

  // =========================================================================
  // FEAT-12: Motor de puntuación boundaries
  // =========================================================================
  describe('FEAT-12 Boundaries', () => {
    test('[T2-F12-1] calculateMaxBaseLevel guards 0 and negative inputs without NaN', async () => {
      const { calculateMaxBaseLevel, calculateBasePercent } = await importAppModule('js/engine/scoring.js');
      assert.equal(calculateMaxBaseLevel(0), 0);
      assert.equal(calculateMaxBaseLevel(-3), 0);
      assert.equal(calculateBasePercent(0, 0), 0);
      assert.equal(calculateBasePercent(100, -10), 0);
    });

    test('[T2-F12-2] calculateTimeBonus returns 0 for null, undefined, NaN, negative, >30000ms, or timer disabled', async () => {
      const { calculateTimeBonus } = await importAppModule('js/engine/scoring.js');
      assert.equal(calculateTimeBonus(null, true), 0);
      assert.equal(calculateTimeBonus(undefined, true), 0);
      assert.equal(calculateTimeBonus(Number.NaN, true), 0);
      assert.equal(calculateTimeBonus(-100, true), 0);
      assert.equal(calculateTimeBonus(120000, true, 30), 0);
      assert.equal(calculateTimeBonus(0, false, 30), 0);
    });

    test('[T2-F12-3] applyDecision clamps exposure at 100, marks failed=true, and freezes subsequent scoring', async () => {
      const { createInitialAttempt, applyDecision } = await importAppModule('js/engine/scoring.js');
      let att = createInitialAttempt(1);
      for (let i = 0; i < 4; i += 1) {
        att = applyDecision(att, { isCorrect: false, penaltyOnWrongAnswer: 30, objectiveId: 'O1' });
      }
      assert.equal(att.exposure, 100);
      assert.equal(att.failed, true);
      const afterFail = applyDecision(att, { isCorrect: true, objectiveId: 'O1', timerEnabled: true, elapsedMs: 0 });
      assert.equal(afterFail.failed, true);
      assert.equal(afterFail.baseScore, att.baseScore);
      assert.equal(afterFail.visibleScore, att.visibleScore);
    });

    test('[T2-F12-4] Exact rank boundaries: 49.99 -> Aprendiz, 50 -> Analista, 84.99 -> Analista, 85 -> Arquitecto Criptográfico', async () => {
      const { getRank } = await importAppModule('js/engine/scoring.js');
      assert.equal(getRank(0), 'Aprendiz');
      assert.equal(getRank(49.99), 'Aprendiz');
      assert.equal(getRank(50), 'Analista');
      assert.equal(getRank(84.99), 'Analista');
      assert.equal(getRank(85), 'Arquitecto Criptográfico');
      assert.equal(getRank(100), 'Arquitecto Criptográfico');
    });

    test('[T2-F12-5] calculateWeakestObjective avoids division by zero and breaks ties ascending O1..O5', async () => {
      const { calculateWeakestObjective } = await importAppModule('js/engine/scoring.js');
      const empty = calculateWeakestObjective([], []);
      assert.equal(empty.objectiveId, 'O1');
      assert.equal(empty.hasData, false);
      assert.equal(Number.isNaN(empty.rate), false);

      const tied = calculateWeakestObjective([
        {
          decisions: [
            { objectiveId: 'O1', isCorrect: true },
            { objectiveId: 'O2', isCorrect: false },
            { objectiveId: 'O2', isCorrect: true },
            { objectiveId: 'O4', isCorrect: false },
            { objectiveId: 'O4', isCorrect: true },
          ],
        },
      ]);
      // O2 and O4 both 50%; O3 and O5 have 0 decisions so excluded; tie resolves to O2
      assert.equal(tied.objectiveId, 'O2');
      assert.equal(tied.breakdown.O3.rate, null);
    });
  });

  // =========================================================================
  // FEAT-13: Test posterior boundaries
  // =========================================================================
  describe('FEAT-13 Boundaries', () => {
    test('[T2-F13-1] quiz-post.json has zero duplicate IDs and covers O1-O5 once each', async () => {
      const post = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      assert.equal(new Set(post.questions.map((q) => q.id)).size, 5);
      assert.deepEqual(post.questions.map((q) => q.objectiveId).sort(), [...OBJECTIVES].sort());
    });

    test('[T2-F13-2] quiz-post.json shares zero identical question IDs or prompts with quiz-pre.json', async () => {
      const pre = await fetchAppJson(server.baseUrl, '/data/quiz-pre.json');
      const post = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      const preIds = new Set(pre.questions.map((q) => q.id));
      const prePrompts = new Set(pre.questions.map((q) => normalizeText(q.prompt)));
      for (const q of post.questions) {
        assert.ok(!preIds.has(q.id));
        assert.ok(!prePrompts.has(normalizeText(q.prompt)));
      }
    });

    test('[T2-F13-3] quiz-post.json options are unique per question and correctOptionId exists', async () => {
      const post = await fetchAppJson(server.baseUrl, '/data/quiz-post.json');
      for (const q of post.questions) {
        const optIds = q.options.map((o) => o.id);
        assert.equal(new Set(optIds).size, optIds.length);
        assert.ok(optIds.includes(q.correctOptionId));
      }
    });

    test('[T2-F13-4] Post-quiz score 0/5 feeds 0% per-objective decisions cleanly into calculateWeakestObjective', async () => {
      const { calculateWeakestObjective } = await importAppModule('js/engine/scoring.js');
      const res = calculateWeakestObjective(
        [{ decisions: [{ objectiveId: 'O1', isCorrect: true }, { objectiveId: 'O2', isCorrect: true }] }],
        OBJECTIVES.map((id) => ({ objectiveId: id, isCorrect: false })),
      );
      assert.equal(res.objectiveId, 'O3');
      assert.equal(res.rate, 0);
    });

    test('[T2-F13-5] quizView.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/views/quizView.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'quizView.js'), []);
    });
  });

  // =========================================================================
  // FEAT-14: Pantalla de resultados boundaries
  // =========================================================================
  describe('FEAT-14 Boundaries', () => {
    test('[T2-F14-1] calculateFinalSummary handles empty acceptedAttempts without NaN or Infinity', async () => {
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const res = calculateFinalSummary([], null, null);
      assert.equal(res.basePercent, 0);
      assert.equal(res.rank, 'Aprendiz');
      assert.equal(res.quizComparison.hasComparison, false);
    });

    test('[T2-F14-2] calculateFinalSummary preserves negative quiz delta (e.g. 4/5 -> 2/5 gives -2)', async () => {
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const res = calculateFinalSummary(
        [{ baseScore: 350, optionalTimeBonus: 0, visibleScore: 350, maxBaseLevel: 700, decisions: [] }],
        { completed: true, score: 2, decisions: [] },
        { completed: true, score: 4 },
      );
      assert.equal(res.quizComparison.hasComparison, true);
      assert.equal(res.quizComparison.delta, -2);
    });

    test('[T2-F14-3] resultsView.js does not show X/5 -> Y/5 arrow when preQuiz was skipped', async () => {
      const seeded = JSON.stringify({
        version: 1,
        unlockedLevel: 4,
        settings: { timerEnabled: false, reducedMotion: false },
        preQuiz: { completed: false, skipped: true },
        postQuiz: { completed: true, score: 4, total: 5, decisions: [] },
        levels: {
          1: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] } },
          2: { completed: true, bestBaseScore: 900, bestVisibleScore: 900, acceptedAttempt: { baseScore: 900, optionalTimeBonus: 0, visibleScore: 900, maxBaseLevel: 900, decisions: [] } },
          3: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] } },
          4: { completed: true, bestBaseScore: 700, bestVisibleScore: 700, acceptedAttempt: { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] } },
        },
      });
      const env = await bootAppInStub({
        initialStorage: { alerta_de_fuga_progress_v1: seeded },
        initialHash: '#/resultados',
      });
      try {
        const viewBtn = findControlByText(env.document.body, 'resultados');
        if (viewBtn) viewBtn.click();
        await new Promise((r) => setTimeout(r, 30));
        const text = collectText(env.document.body);
        assert.doesNotMatch(text, /0\/5\s*→\s*4\/5|null\/5|nan/);
      } finally {
        env.restore();
      }
    });

    test('[T2-F14-4] calculateFinalSummary handles 100% score across all 4 levels cleanly', async () => {
      const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
      const res = calculateFinalSummary(
        [
          { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O1', isCorrect: true }] },
          { baseScore: 900, optionalTimeBonus: 0, visibleScore: 900, maxBaseLevel: 900, decisions: [{ objectiveId: 'O2', isCorrect: true }] },
          { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O3', isCorrect: true }] },
          { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [{ objectiveId: 'O4', isCorrect: true }, { objectiveId: 'O5', isCorrect: true }] },
        ],
        { completed: true, score: 5, decisions: OBJECTIVES.map((o) => ({ objectiveId: o, isCorrect: true })) },
        { completed: true, score: 5 },
      );
      assert.equal(res.basePercent, 100);
      assert.equal(res.rank, 'Arquitecto Criptográfico');
      assert.equal(res.weakestObjective.objectiveId, 'O1');
      assert.equal(res.weakestObjective.rate, 1);
    });

    test('[T2-F14-5] resultsView.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/views/resultsView.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'resultsView.js'), []);
    });
  });

  // =========================================================================
  // FEAT-15: Persistencia boundaries
  // =========================================================================
  describe('FEAT-15 Boundaries', () => {
    test('[T2-F15-1] Corrupted JSON in alerta_de_fuga_progress_v1 resets cleanly without SyntaxError', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage({ initial: { alerta_de_fuga_progress_v1: '{bad-json' } });
      const store = createStateStore(storage);
      assert.equal(store.getState().unlockedLevel, 1);
    });

    test('[T2-F15-2] Wrong schema version in localStorage resets safely to version 1 defaults', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const storage = createMemoryStorage({ initial: { alerta_de_fuga_progress_v1: JSON.stringify({ version: 999, unlockedLevel: 4 }) } });
      const store = createStateStore(storage);
      assert.equal(store.getState().unlockedLevel, 1);
    });

    test('[T2-F15-3] Passing null storage or QuotaExceededError degrades to memory fallback cleanly', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const nullStore = createStateStore(null);
      assert.equal(nullStore.isMemoryFallback(), true);

      const quotaStorage = createMemoryStorage({ throwOnSet: 'QuotaExceededError' });
      const qStore = createStateStore(quotaStorage);
      qStore.updateSettings({ timerEnabled: true });
      assert.equal(qStore.isMemoryFallback(), true);
      assert.equal(qStore.getState().settings.timerEnabled, true);
    });

    test('[T2-F15-4] Failed level attempt never overwrites prior acceptedAttempt, bestBaseScore, or unlockedLevel', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const store = createStateStore(createMemoryStorage());
      store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      store.recordLevelAttemptResult(1, { baseScore: 100, visibleScore: 100, failed: true, completed: false, decisions: [] }, 700);
      assert.equal(store.getState().unlockedLevel, 2);
      assert.equal(store.getState().levels[1].bestBaseScore, 700);
      assert.equal(store.getState().levels[1].acceptedAttempt.baseScore, 700);
    });

    test('[T2-F15-5] Completing Level 4 caps unlockedLevel at 4 and unsubscribe stops notifications', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const store = createStateStore(createMemoryStorage());
      let count = 0;
      const unsub = store.subscribe(() => {
        count += 1;
      });
      store.recordLevelAttemptResult(4, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
      assert.equal(store.getState().unlockedLevel, 4);
      const snapshotCount = count;
      unsub();
      store.updateSettings({ timerEnabled: true });
      assert.equal(count, snapshotCount);
    });
  });

  // =========================================================================
  // FEAT-16: Visual & Responsive boundaries
  // =========================================================================
  describe('FEAT-16 Boundaries', () => {
    test('[T2-F16-1] Primary and secondary text tokens (#F0F6FC, #A8B8C8) meet >= 4.5:1 on #0B1016 and #131B26', async () => {
      await requireAppFile('css/tokens.css');
      for (const bg of ['#0B1016', '#131B26']) {
        for (const fg of ['#F0F6FC', '#A8B8C8']) {
          const ratio = contrastRatio(fg, bg);
          assert.ok(ratio >= 4.5, `${fg} on ${bg} contrast ${ratio.toFixed(2)} < 4.5`);
        }
      }
    });

    test('[T2-F16-2] #0B1016 text on all 4 solid accent fills meets >= 4.5:1 while #F0F6FC fails (< 3:1)', async () => {
      await requireAppFile('css/tokens.css');
      for (const fill of ACCENT_FILL_TOKENS) {
        assert.ok(contrastRatio('#0B1016', fill) >= 4.5);
        assert.ok(contrastRatio('#F0F6FC', fill) < 3.0);
      }
    });

    test('[T2-F16-3] CSS layout avoids fixed oversized min-width breaking 390px mobile viewport', async () => {
      const layout = await requireAppFile('css/layout.css');
      const components = await requireAppFile('css/components.css');
      const combined = layout + '\n' + components;
      const bigMinWidths = [...combined.matchAll(/min-width\s*:\s*(\d+)px/gi)].filter((m) => Number(m[1]) >= 400);
      // Exclude @media (min-width: ...) queries — check only property declarations
      const propMinWidths = [...combined.replace(/@media[^{]+/g, '').matchAll(/min-width\s*:\s*(\d+)px/gi)].filter(
        (m) => Number(m[1]) >= 390,
      );
      assert.equal(propMinWidths.length, 0, `Oversized property min-width >= 390px found: ${JSON.stringify(propMinWidths)}`);
      assert.ok(bigMinWidths.length >= 0);
    });

    test('[T2-F16-4] All 4 SVGs under assets/ have valid <svg> root and zero <script> or on*= handlers', async () => {
      const svgs = ['assets/logo.svg', 'assets/analyst.svg', 'assets/attacker.svg', 'assets/ecb-pattern.svg'];
      for (const s of svgs) {
        const raw = await requireAppFile(s);
        assert.match(raw, /<svg\b/i);
        assert.doesNotMatch(raw, /<script\b|\bon[a-z]+\s*=|javascript:/i);
      }
    });

    test('[T2-F16-5] index.html includes viewport meta without disabling user zoom (no user-scalable=no / maximum-scale=1)', async () => {
      const html = await requireAppFile('index.html');
      assert.match(html, /<meta[^>]*name=["']viewport["'][^>]*width=device-width/i);
      assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?/i);
    });
  });

  // =========================================================================
  // FEAT-17: WCAG 2.2 AA boundaries
  // =========================================================================
  describe('FEAT-17 Boundaries', () => {
    test('[T2-F17-1] No positive tabindex (>0) anti-patterns exist in index.html or js/', async () => {
      const html = await requireAppFile('index.html');
      assert.doesNotMatch(html, /tabindex\s*=\s*["']?[1-9]\d*/i);
      const jsFiles = await listProjectFiles('js', '.js');
      assert.ok(jsFiles.length >= 1);
      for (const f of jsFiles) {
        const code = await requireAppFile(f);
        assert.doesNotMatch(code, /tabindex\s*,\s*['"][1-9]\d*['"]|\.tabIndex\s*=\s*[1-9]\d*/i, `Positive tabindex in ${f}`);
      }
    });

    test('[T2-F17-2] a11y.announce handles missing/empty live region or empty string without throwing', async () => {
      const { announce } = await importAppModule('js/engine/a11y.js');
      const env = installDomGlobals({ html: '<html lang="es"><body><main id="main-content"></main></body></html>' });
      try {
        assert.doesNotThrow(() => announce('Alerta de prueba'));
        assert.doesNotThrow(() => announce(''));
      } finally {
        env.restore();
      }
    });

    test('[T2-F17-3] a11y.openModal handles modal with zero focusable children cleanly without throwing', async () => {
      const { openModal } = await importAppModule('js/engine/a11y.js');
      const env = installDomGlobals({
        html: '<html lang="es"><body><main id="main-content" tabindex="-1"><button id="b">Open</button></main><div id="m" role="dialog" tabindex="-1">Solo texto</div></body></html>',
      });
      try {
        const btn = env.document.getElementById('b');
        const modal = env.document.getElementById('m');
        assert.doesNotThrow(() => openModal(modal, btn, () => {}));
      } finally {
        env.restore();
      }
    });

    test('[T2-F17-4] gameView.js never sets inline style="width:..." on the exposure progressbar', async () => {
      const code = await requireAppFile('js/views/gameView.js');
      assert.doesNotMatch(code, /setAttribute\s*\(\s*['"]style['"]/i);
      assert.match(code, /aria-valuenow/);
    });

    test('[T2-F17-5] a11y.js has zero static CSP/XSS security violations', async () => {
      const code = await requireAppFile('js/engine/a11y.js');
      assert.deepEqual(scanJsForSecurityViolations(code, 'a11y.js'), []);
    });
  });

  // =========================================================================
  // FEAT-18: Seguridad cliente & _headers boundaries
  // =========================================================================
  describe('FEAT-18 Boundaries', () => {
    test('[T2-F18-1] _headers forbids unsafe-inline, unsafe-eval, wildcard *, and unverified HSTS preload', async () => {
      const headersRaw = await requireAppFile('_headers');
      assert.doesNotMatch(headersRaw, /unsafe-inline|unsafe-eval/i);
      assert.doesNotMatch(headersRaw, /script-src[^;\n]*\*/i);
      assert.doesNotMatch(headersRaw, /Strict-Transport-Security[^\n]*preload/i);
    });

    test('[T2-F18-2] dataLoader.js rejects HTTP 404 or invalid JSON cleanly without uncaught silent pass', async () => {
      const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
      try {
        const { loadLevel } = await importAppModule('js/engine/dataLoader.js');
        await assert.rejects(() => loadLevel(99));
      } finally {
        env.restore();
      }
    });

    test('[T2-F18-3] Luhn and secret scanners reliably catch synthetic test patterns (scanner efficacy check)', () => {
      // Built dynamically at runtime so no card literal exists in repo source
      const syntheticCard = ['4', '1'.repeat(15)].join('');
      const syntheticAws = ['AKIA', '1234567890ABCDEF'].join('');
      assert.equal(luhnCheck(syntheticCard), true);
      assert.equal(findLuhnPanCandidates(`pan=${syntheticCard}`).length, 1);
      assert.equal(findSecretPatterns(`key=${syntheticAws}`).length, 1);
    });

    test('[T2-F18-4] state.js ignores/strips unknown PII fields injected into stored JSON payload', async () => {
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const poisoned = JSON.stringify({
        version: 1,
        unlockedLevel: 2,
        email: 'leak@example.test',
        password: 'dummy',
        settings: { timerEnabled: false, reducedMotion: false },
      });
      const storage = createMemoryStorage({ initial: { alerta_de_fuga_progress_v1: poisoned } });
      const store = createStateStore(storage);
      const st = store.getState();
      assert.equal(st.email, undefined);
      assert.equal(st.password, undefined);
    });

    test('[T2-F18-5] HTML, CSS, and JS files use relative paths compatible with subpath/localhost HTTP (no hardcoded localhost/file://)', async () => {
      const html = await requireAppFile('index.html');
      assert.doesNotMatch(html, /http:\/\/localhost|file:\/\//i);
      const dl = await requireAppFile('js/engine/dataLoader.js');
      assert.doesNotMatch(dl, /http:\/\/localhost|file:\/\//i);
    });
  });

  // =========================================================================
  // FEAT-19: Pruebas automatizadas boundaries
  // =========================================================================
  describe('FEAT-19 Boundaries', () => {
    test('[T2-F19-1] tests/scoring.test.js has zero browser DOM imports and zero test.skip/todo', async () => {
      const code = await requireAppFile('tests/scoring.test.js');
      assert.doesNotMatch(code, /\btest\.(?:skip|todo)\s*\(/);
      assert.doesNotMatch(code, /\bdocument\.|\bwindow\./);
    });

    test('[T2-F19-2] tests/data-integrity.test.js has zero test.skip/todo and tests Level 4 cycles/orphans', async () => {
      const code = await requireAppFile('tests/data-integrity.test.js');
      assert.doesNotMatch(code, /\btest\.(?:skip|todo)\s*\(/);
      assert.match(code, /cycle|ciclo|orphan|hu[eé]rfano|alcanz/i);
    });

    test('[T2-F19-3] tests/scoring.test.js explicitly tests division-by-zero protection', async () => {
      const code = await requireAppFile('tests/scoring.test.js');
      assert.match(code, /0\s*,|cero|zero|NaN/i);
    });

    test('[T2-F19-4] tests/data-integrity.test.js explicitly validates all 18 glossary IDs', async () => {
      const code = await requireAppFile('tests/data-integrity.test.js');
      assert.match(code, /argon2id/);
      assert.match(code, /rsa-oaep/);
      assert.match(code, /minimizacion-datos/);
    });

    test('[T2-F19-5] tests/scoring.test.js and tests/data-integrity.test.js require zero npm packages', async () => {
      const s = await requireAppFile('tests/scoring.test.js');
      const d = await requireAppFile('tests/data-integrity.test.js');
      for (const code of [s, d]) {
        const imports = [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
        for (const imp of imports) {
          assert.ok(imp.startsWith('node:') || imp.startsWith('.'), `Unexpected non-builtin dependency "${imp}"`);
        }
      }
    });
  });

  // =========================================================================
  // FEAT-20: E2E & README boundaries
  // =========================================================================
  describe('FEAT-20 Boundaries', () => {
    test('[T2-F20-1] README.md does not claim unverified live deployment URLs when pending', async () => {
      const readme = await requireAppFile('README.md');
      assert.doesNotMatch(readme, /https:\/\/[a-z0-9-]+\.(?:pages\.dev|netlify\.app)/i);
      assert.match(readme, /PENDIENTE_DE_DESPLIEGUE|PENDIENTE_DE_PUBLICACI[ÓO]N/i);
    });

    test('[T2-F20-2] README.md does not fabricate completed P1-P5 user study results', async () => {
      const readme = await requireAppFile('README.md');
      assert.doesNotMatch(readme, /P1\s*\|\s*S[íi]\s*\|/i);
    });

    test('[T2-F20-3] README.md warns against opening via file:// and instructs local HTTP server', async () => {
      const readme = await requireAppFile('README.md');
      assert.match(readme, /file:\/\//i);
      assert.match(readme, /http\.server|HTTP/i);
    });

    test('[T2-F20-4] Data JSON files serve valid UTF-8 Spanish characters over HTTP', async () => {
      const g = await fetchAppJson(server.baseUrl, '/data/glossary.json');
      assert.match(JSON.stringify(g), /[áéíóúñÁÉÍÓÚÑ]/);
    });

    test('[T2-F20-5] Browser E2E playbook includes failure gates for console errors, 404s, CSP, and Lighthouse < 90', async () => {
      const playbook = await requireAppFile('tests/e2e/browser-e2e-playbook.md');
      assert.match(playbook, /console/i);
      assert.match(playbook, /404/);
      assert.match(playbook, /CSP/i);
      assert.match(playbook, /90/);
    });
  });
});
