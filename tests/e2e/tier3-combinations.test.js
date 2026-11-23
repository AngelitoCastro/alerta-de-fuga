import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStaticServer } from './helpers/staticServer.js';
import {
  installDomGlobals,
  createMemoryStorage,
  StubKeyboardEvent,
} from './helpers/domStub.js';
import {
  OBJECTIVES,
  requireAppFile,
  importAppModule,
  listProjectFiles,
  fetchHttp,
  fetchAppJson,
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

function makeMinigameDriverCallbacks() {
  const decisions = [];
  let completion = null;
  const glossaryCalls = [];
  return {
    decisions,
    get completion() {
      return completion;
    },
    glossaryCalls,
    callbacks: {
      onDecision(payload, onContinue) {
        decisions.push(payload);
        if (typeof onContinue === 'function') onContinue();
      },
      onLevelComplete(summary) {
        completion = summary;
      },
      onOpenGlossary(termId) {
        glossaryCalls.push(termId);
      },
      onStatusAnnounce() {},
    },
  };
}

describe('Tier 3 — Pairwise Cross-Feature Combinations (24 tests)', () => {
  before(async () => {
    server = await startStaticServer();
  });

  after(async () => {
    if (server) await server.close();
  });

  test('[T3-01] FEAT-03 × FEAT-12: Timer enabled bonus increases visibleScore while basePercent and rank stay invariant', async () => {
    const { createInitialAttempt, applyDecision, calculateMaxBaseLevel, calculateFinalSummary } =
      await importAppModule('js/engine/scoring.js');
    const maxBase = calculateMaxBaseLevel(6);

    let timed = createInitialAttempt(1);
    let untimed = createInitialAttempt(1);
    for (let i = 0; i < 6; i += 1) {
      timed = applyDecision(timed, { isCorrect: true, objectiveId: 'O1', timerEnabled: true, elapsedMs: 5000 });
      untimed = applyDecision(untimed, { isCorrect: true, objectiveId: 'O1', timerEnabled: false, elapsedMs: 5000 });
    }
    timed.completed = true;
    untimed.completed = true;
    const sTimed = calculateFinalSummary([{ ...timed, maxBaseLevel: maxBase }]);
    const sUntimed = calculateFinalSummary([{ ...untimed, maxBaseLevel: maxBase }]);
    assert.ok(sTimed.totalVisibleScore > sUntimed.totalVisibleScore);
    assert.equal(sTimed.basePercent, sUntimed.basePercent);
    assert.equal(sTimed.rank, sUntimed.rank);
  });

  test('[T3-02] FEAT-03 × FEAT-15: timerEnabled and reducedMotion persist to alerta_de_fuga_progress_v1 and reload', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const storage = createMemoryStorage();
    const s1 = createStateStore(storage);
    s1.updateSettings({ timerEnabled: true, reducedMotion: true });
    const s2 = createStateStore(storage);
    assert.deepEqual(s2.getState().settings, { timerEnabled: true, reducedMotion: true });
  });

  test('[T3-03] FEAT-03 × FEAT-14 × FEAT-15: Confirmed Reset Progress clears levels, quizzes, and unlockedLevel back to 1', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const storage = createMemoryStorage();
    const store = createStateStore(storage);
    store.recordPreQuiz({ score: 4, total: 5, decisions: [] });
    store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
    store.recordPostQuiz({ score: 5, total: 5, decisions: [] });

    const env = await bootAppInStub({ storage });
    try {
      const settingsBtn = findControlByText(env.document.body, 'ajustes');
      assert.ok(settingsBtn);
      settingsBtn.click();
      const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
      assert.ok(dlg);
      const resetBtn = findControlByText(dlg, 'restablecer');
      assert.ok(resetBtn);
      resetBtn.click();
      const confirmBtn = findControlByText(dlg, 'confirmar') || findControlByText(dlg, 'sí') || findControlByText(dlg, 'aceptar');
      assert.ok(confirmBtn, 'Expected explicit confirmation button after clicking Restablecer');
      confirmBtn.click();
      const reloaded = createStateStore(storage).getState();
      assert.equal(reloaded.unlockedLevel, 1);
      assert.equal(reloaded.preQuiz.completed, false);
      assert.equal(reloaded.postQuiz.completed, false);
    } finally {
      env.restore();
    }
  });

  test('[T3-04] FEAT-04 × FEAT-13 × FEAT-14: Pre-Quiz + Post-Quiz both completed produces X/5 -> Y/5 and signed delta', async () => {
    const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
    const summary = calculateFinalSummary(
      [{ baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] }],
      { completed: true, score: 5, decisions: [] },
      { completed: true, score: 3 },
    );
    assert.equal(summary.quizComparison.hasComparison, true);
    assert.equal(summary.quizComparison.preScore, 3);
    assert.equal(summary.quizComparison.postScore, 5);
    assert.equal(summary.quizComparison.delta, 2);
  });

  test('[T3-05] FEAT-04 × FEAT-13 × FEAT-14: Skipping Pre-Quiz + completing Post-Quiz produces hasComparison: false', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
    const store = createStateStore(createMemoryStorage());
    store.skipPreQuiz();
    store.recordPostQuiz({ score: 4, total: 5, decisions: [] });
    const summary = calculateFinalSummary(
      [{ baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, maxBaseLevel: 700, decisions: [] }],
      store.getState().postQuiz,
      store.getState().preQuiz,
    );
    assert.equal(summary.quizComparison.hasComparison, false);
    assert.equal(summary.quizComparison.postScore, 4);
  });

  test('[T3-06] FEAT-05 × FEAT-06 × FEAT-12: Real nivel-1.json driven through inspector.js + scoring.js yields exact 700 maxBaseLevel', async () => {
    const n1 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-1.json');
    const { createInitialAttempt, applyDecision, calculateMaxBaseLevel } = await importAppModule('js/engine/scoring.js');
    const { mount, destroy } = await importAppModule('js/minigames/inspector.js');

    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const container = env.document.createElement('div');
      const driver = makeMinigameDriverCallbacks();
      mount(container, n1, driver.callbacks);
      for (const ch of n1.challenges) {
        const opt = ch.options.find((o) => o.id === ch.correctOptionId);
        const btn = container.querySelector(`[data-option-id="${opt.id}"]`) || findControlByText(container, opt.label);
        btn.click();
      }
      let att = createInitialAttempt(1);
      for (const d of driver.decisions) {
        att = applyDecision(att, d);
      }
      const maxBase = calculateMaxBaseLevel(driver.completion.scorableDecisionsCount);
      assert.equal(maxBase, 700);
      assert.equal(att.baseScore, 700);
      assert.equal(att.exposure, 0);
      destroy();
    } finally {
      env.restore();
    }
  });

  test('[T3-07] FEAT-05 × FEAT-07 × FEAT-12: Real nivel-2.json driven through classifier.js handles mid-level streak break', async () => {
    const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
    const { createInitialAttempt, applyDecision, calculateMaxBaseLevel } = await importAppModule('js/engine/scoring.js');
    const { mount, destroy } = await importAppModule('js/minigames/classifier.js');

    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const container = env.document.createElement('div');
      const driver = makeMinigameDriverCallbacks();
      mount(container, n2, driver.callbacks);
      n2.challenges.forEach((ch, idx) => {
        const cardCtrl = container.querySelector(`[data-challenge-id="${ch.id}"]`) || findControlByText(container, ch.recordLabel || ch.title);
        if (cardCtrl) cardCtrl.click();
        const chosenBucket =
          idx === 3
            ? n2.buckets.find((b) => b.id !== ch.correctOptionId)
            : n2.buckets.find((b) => b.id === ch.correctOptionId);
        const btn = container.querySelector(`[data-bucket-id="${chosenBucket.id}"]`) || findControlByText(container, chosenBucket.label);
        btn.click();
      });
      let att = createInitialAttempt(2);
      for (const d of driver.decisions) att = applyDecision(att, d);
      assert.equal(calculateMaxBaseLevel(driver.completion.scorableDecisionsCount), 900);
      // 3 hits (350) + 1 miss (0, streak reset) + 4 hits (450) = 800
      assert.equal(att.baseScore, 800);
      assert.ok(att.exposure > 0 && att.exposure < 100);
      destroy();
    } finally {
      env.restore();
    }
  });

  test('[T3-08] FEAT-05 × FEAT-08 × FEAT-12: Real nivel-3.json driven through codeHunt.js handles wrong-line vs wrong-mitigation penalties', async () => {
    const n3 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-3.json');
    const { createInitialAttempt, applyDecision, calculateMaxBaseLevel } = await importAppModule('js/engine/scoring.js');
    const { mount, destroy } = await importAppModule('js/minigames/codeHunt.js');

    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const container = env.document.createElement('div');
      const driver = makeMinigameDriverCallbacks();
      mount(container, n3, driver.callbacks);
      n3.challenges.forEach((ch, idx) => {
        const targetLineNum =
          idx === 0
            ? (ch.lines.find((l) => !ch.vulnerableLineNumbers.includes(l.lineNumber)) || ch.lines[0]).lineNumber
            : ch.vulnerableLineNumbers[0];
        const lineBtn = container.querySelector(`[data-line-number="${targetLineNum}"]`) || findControlByText(container, String(targetLineNum));
        lineBtn.click();

        const targetMit =
          idx === 1
            ? ch.mitigationOptions.find((m) => m.id !== ch.correctMitigationId)
            : ch.mitigationOptions.find((m) => m.id === ch.correctMitigationId);
        const mitBtn = container.querySelector(`[data-mitigation-id="${targetMit.id}"]`) || findControlByText(container, targetMit.label);
        mitBtn.click();

        const submitBtn = findControlByText(container, 'confirmar') || findControlByText(container, 'aplicar') || findControlByText(container, 'verificar') || findControlByText(container, 'enviar') || container.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      });

      let att = createInitialAttempt(3);
      for (const d of driver.decisions) att = applyDecision(att, d);
      assert.equal(calculateMaxBaseLevel(driver.completion.scorableDecisionsCount), 700);
      assert.equal(att.baseScore, 450); // 2 misses then 4 consecutive hits = 450
      destroy();
    } finally {
      env.restore();
    }
  });

  test('[T3-09] FEAT-05 × FEAT-09 × FEAT-12: Real nivel-4.json driven through branchingIncident.js normalizes maxBaseLevel to played route', async () => {
    const n4 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-4.json');
    const g = analyzeLevel4Graph(n4);
    const route = g.simplePaths[0];
    const { createInitialAttempt, applyDecision, calculateMaxBaseLevel } = await importAppModule('js/engine/scoring.js');
    const { mount, destroy } = await importAppModule('js/minigames/branchingIncident.js');

    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const container = env.document.createElement('div');
      const driver = makeMinigameDriverCallbacks();
      mount(container, n4, driver.callbacks);
      for (const step of route.choices) {
        const btn = container.querySelector(`[data-option-id="${step.option.id}"]`) || findControlByText(container, step.option.label);
        btn.click();
      }
      let att = createInitialAttempt(4);
      for (const d of driver.decisions) att = applyDecision(att, d);
      const maxRoute = calculateMaxBaseLevel(driver.completion.scorableDecisionsCount);
      assert.equal(driver.completion.scorableDecisionsCount, route.choices.length);
      assert.ok(att.baseScore <= maxRoute);
      destroy();
    } finally {
      env.restore();
    }
  });

  test('[T3-10] FEAT-06..09 × FEAT-12 × FEAT-15: Failing Level 2 at exposure 100 preserves Level 1 acceptedAttempt & unlockedLevel 2', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const { createInitialAttempt, applyDecision } = await importAppModule('js/engine/scoring.js');
    const storage = createMemoryStorage();
    const store = createStateStore(storage);

    store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [{ objectiveId: 'O1', isCorrect: true }] }, 700);
    let att2 = createInitialAttempt(2);
    for (let i = 0; i < 6; i += 1) {
      att2 = applyDecision(att2, { isCorrect: false, penaltyOnWrongAnswer: 20, objectiveId: 'O2' });
    }
    assert.equal(att2.failed, true);
    store.recordLevelAttemptResult(2, att2, 900);

    const reloaded = createStateStore(storage).getState();
    assert.equal(reloaded.unlockedLevel, 2);
    assert.equal(reloaded.levels[1].acceptedAttempt.baseScore, 700);
    assert.equal(reloaded.levels[2]?.acceptedAttempt || null, null);
  });

  test('[T3-11] FEAT-12 × FEAT-15: Retrying completed Level 1 replaces acceptedAttempt without summing scores', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
    const store = createStateStore(createMemoryStorage());

    store.recordLevelAttemptResult(1, { baseScore: 400, optionalTimeBonus: 0, visibleScore: 400, failed: false, completed: true, decisions: [] }, 700);
    store.recordLevelAttemptResult(1, { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
    const accepted = store.getState().levels[1].acceptedAttempt;
    const summary = calculateFinalSummary([{ ...accepted, maxBaseLevel: 700 }]);
    assert.equal(summary.totalBaseScore, 700);
    assert.equal(summary.basePercent, 100);
  });

  test('[T3-12] FEAT-06..09 × FEAT-12: Streaks NEVER carry across level boundaries', async () => {
    const { createInitialAttempt, applyDecision } = await importAppModule('js/engine/scoring.js');
    let l1 = createInitialAttempt(1);
    l1 = applyDecision(l1, { isCorrect: true, objectiveId: 'O1' });
    l1 = applyDecision(l1, { isCorrect: true, objectiveId: 'O1' });
    assert.equal(l1.streak, 2);

    let l2 = createInitialAttempt(2);
    l2 = applyDecision(l2, { isCorrect: true, objectiveId: 'O2' });
    assert.equal(l2.streak, 1);
    assert.equal(l2.baseScore, 100, 'First hit of Level 2 must NOT earn +50 cross-level streak');
  });

  test('[T3-13] FEAT-10 × FEAT-11: Every glossaryTermId in quizzes and levels resolves to an entry in glossary.json', async () => {
    const g = await fetchAppJson(server.baseUrl, '/data/glossary.json');
    const ids = new Set(g.terms.map((t) => t.id));
    for (const p of ['/data/quiz-pre.json', '/data/quiz-post.json', '/data/levels/nivel-1.json', '/data/levels/nivel-2.json', '/data/levels/nivel-3.json', '/data/levels/nivel-4.json']) {
      const jsonStr = JSON.stringify(await fetchAppJson(server.baseUrl, p));
      for (const m of jsonStr.matchAll(/"glossaryTermId"\s*:\s*"([^"]+)"/g)) {
        assert.ok(ids.has(m[1]), `Missing glossary term ${m[1]} referenced in ${p}`);
      }
    }
  });

  test('[T3-14] FEAT-11 × FEAT-17: Opening glossaryDrawer traps focus, closes on Escape, and returns focus to opener', async () => {
    const env = await bootAppInStub();
    try {
      const trigger = findControlByText(env.document.body, 'glosario');
      assert.ok(trigger);
      trigger.focus();
      trigger.click();
      await new Promise((r) => setTimeout(r, 30));
      const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
      assert.ok(dlg);
      assert.ok(dlg.contains(env.document.activeElement) || env.document.activeElement === dlg);
      env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
      assert.equal(env.document.activeElement, trigger);
    } finally {
      env.restore();
    }
  });

  test('[T3-15] FEAT-01 × FEAT-02 × FEAT-17: Opening guideModal from Inicio, cycling Tab, and pressing Escape restores focus', async () => {
    const env = await bootAppInStub();
    try {
      const trigger = findControlByText(env.document.body, 'guía');
      assert.ok(trigger);
      trigger.focus();
      trigger.click();
      const dlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
      assert.ok(dlg);
      dlg.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Tab' }));
      assert.ok(dlg.contains(env.document.activeElement) || env.document.activeElement === dlg);
      env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
      assert.equal(env.document.activeElement, trigger);
    } finally {
      env.restore();
    }
  });

  test('[T3-16] FEAT-06..09 × FEAT-13 × FEAT-14: calculateWeakestObjective combines accepted level decisions + postQuiz (excluding preQuiz)', async () => {
    const { calculateWeakestObjective } = await importAppModule('js/engine/scoring.js');
    const res = calculateWeakestObjective(
      [{ decisions: [{ objectiveId: 'O1', isCorrect: true }, { objectiveId: 'O2', isCorrect: true }] }],
      [{ objectiveId: 'O1', isCorrect: true }, { objectiveId: 'O2', isCorrect: false }, { objectiveId: 'O5', isCorrect: false }],
    );
    // O1: 2/2 (100%), O2: 1/2 (50%), O5: 0/1 (0%) -> weakest is O5
    assert.equal(res.objectiveId, 'O5');
  });

  test('[T3-17] FEAT-05 × FEAT-06..09: Sequential mount -> destroy -> mount switching across all 4 minigames leaves zero leaked callbacks', async () => {
    const levels = [];
    for (let i = 1; i <= 4; i += 1) {
      levels.push(await fetchAppJson(server.baseUrl, `/data/levels/nivel-${i}.json`));
    }
    const paths = [
      'js/minigames/inspector.js',
      'js/minigames/classifier.js',
      'js/minigames/codeHunt.js',
      'js/minigames/branchingIncident.js',
    ];
    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const container = env.document.createElement('div');
      env.document.body.appendChild(container);
      const drivers = [];
      for (let i = 0; i < 4; i += 1) {
        const mod = await importAppModule(paths[i]);
        const d = makeMinigameDriverCallbacks();
        drivers.push(d);
        mod.mount(container, levels[i], d.callbacks);
        assert.ok(container.children.length > 0);
        mod.destroy();
      }
      assert.ok(drivers.every((d) => d.decisions.length === 0));
    } finally {
      env.restore();
    }
  });

  test('[T3-18] FEAT-04 × FEAT-13 × FEAT-18: All JSON files loaded via dataLoader pass XSS/HTML safety scans', async () => {
    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const { loadGlossary, loadQuiz, loadLevel } = await importAppModule('js/engine/dataLoader.js');
      const payloads = [
        await loadGlossary(),
        await loadQuiz('pre'),
        await loadQuiz('post'),
        await loadLevel(1),
        await loadLevel(2),
        await loadLevel(3),
        await loadLevel(4),
      ];
      for (const p of payloads) {
        assert.doesNotMatch(JSON.stringify(p), /<(?:script|iframe|object|embed)\b/i);
      }
    } finally {
      env.restore();
    }
  });

  test('[T3-19] FEAT-16 × FEAT-17: CSS prefers-reduced-motion media query pairs with settings reducedMotion support', async () => {
    const cssFiles = await listProjectFiles('css', '.css');
    let allCss = '';
    for (const f of cssFiles) allCss += '\n' + (await requireAppFile(f));
    assert.match(allCss, /prefers-reduced-motion:\s*reduce/i);
    assert.match(allCss, /reduced-motion|data-reduced-motion/i);
  });

  test('[T3-20] FEAT-15 × FEAT-18: In-memory fallback mode completes progression & reset with zero PII', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const store = createStateStore(createMemoryStorage({ throwOnGet: 'SecurityError', throwOnSet: 'SecurityError' }));
    assert.equal(store.isMemoryFallback(), true);
    store.recordPreQuiz({ score: 3, total: 5, decisions: [] });
    store.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);
    assert.equal(store.getState().unlockedLevel, 2);
    store.resetProgress();
    assert.equal(store.getState().unlockedLevel, 1);
  });

  test('[T3-21] FEAT-07 × FEAT-16 × FEAT-17: Level 2 classifier pairs ecb-pattern.svg with accessible alternative text & button controls', async () => {
    const n2 = await fetchAppJson(server.baseUrl, '/data/levels/nivel-2.json');
    const svgRes = await fetchHttp(server.baseUrl, '/assets/ecb-pattern.svg');
    assert.equal(svgRes.status, 200);
    const ecbIndex = n2.challenges.findIndex((c) => String(c.visualAsset || '').includes('ecb-pattern.svg'));
    assert.ok(ecbIndex >= 0);

    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl });
    try {
      const { mount, destroy } = await importAppModule('js/minigames/classifier.js');
      const container = env.document.createElement('div');
      const driver = makeMinigameDriverCallbacks();
      mount(container, n2, driver.callbacks);
      // Advance or inspect rendered images
      const imgs = container.querySelectorAll('img');
      for (const img of imgs) {
        assert.ok(img.getAttribute('alt') && img.getAttribute('alt').trim().length > 0, 'ECB image must have descriptive alt text');
      }
      assert.ok(collectText(container).length > 0);
      destroy();
    } finally {
      env.restore();
    }
  });

  test('[T3-22] FEAT-10 × FEAT-12 × FEAT-17: gameView.js integrates progressbar, aria-live, and 3-block feedback without inline styles', async () => {
    const code = await requireAppFile('js/views/gameView.js');
    assert.deepEqual(scanJsForSecurityViolations(code, 'gameView.js'), []);
    assert.match(code, /progressbar/);
    assert.match(code, /aria-valuenow/);
    assert.match(code, /attackerView|attacker/i);
  });

  test('[T3-23] FEAT-01 × FEAT-15 × FEAT-14: Reloading store after Levels 1-4 + Post-Quiz exposes complete final summary data', async () => {
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const { calculateFinalSummary } = await importAppModule('js/engine/scoring.js');
    const storage = createMemoryStorage();
    const s1 = createStateStore(storage);
    s1.recordPreQuiz({ score: 2, total: 5, decisions: [] });
    for (const [lvl, max] of [[1, 700], [2, 900], [3, 700], [4, 700]]) {
      s1.recordLevelAttemptResult(lvl, { baseScore: max, optionalTimeBonus: 0, visibleScore: max, failed: false, completed: true, decisions: [{ objectiveId: `O${lvl}`, isCorrect: true }] }, max);
    }
    s1.recordPostQuiz({ score: 5, total: 5, decisions: OBJECTIVES.map((o) => ({ objectiveId: o, isCorrect: true })) });

    const s2 = createStateStore(storage).getState();
    const accepted = [1, 2, 3, 4].map((n) => ({ ...s2.levels[n].acceptedAttempt, maxBaseLevel: s2.levels[n].maxBaseLevel || 700 }));
    const summary = calculateFinalSummary(accepted, s2.postQuiz, s2.preQuiz);
    assert.equal(summary.rank, 'Arquitecto Criptográfico');
    assert.equal(summary.quizComparison.delta, 3);
  });

  test('[T3-24] FEAT-18 × FEAT-19 × FEAT-20: _headers CSP directives are satisfied by index.html, css/*, js/*, and README HTTP guide', async () => {
    const html = await requireAppFile('index.html');
    const headersRaw = await requireAppFile('_headers');
    const readme = await requireAppFile('README.md');
    assert.match(headersRaw, /script-src 'self'/);
    assert.match(headersRaw, /style-src 'self'/);
    assert.deepEqual(scanHtmlForCspViolations(html, 'index.html'), []);
    for (const f of await listProjectFiles('css', '.css')) {
      assert.deepEqual(scanCssForViolations(await requireAppFile(f), f), []);
    }
    for (const f of await listProjectFiles('js', '.js')) {
      assert.deepEqual(scanJsForSecurityViolations(await requireAppFile(f), f), []);
    }
    assert.match(readme, /http\.server|HTTP/i);
  });
});
