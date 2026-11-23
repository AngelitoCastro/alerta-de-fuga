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
  REQUIRED_CSP_DIRECTIVES,
  OBJECTIVES,
  requireAppFile,
  importAppModule,
  listProjectFiles,
  fetchHttp,
  fetchAppJson,
  assertNoSecretsOrRealPans,
  scanHtmlForCspViolations,
  scanJsForSecurityViolations,
  scanCssForViolations,
  analyzeLevel4Graph,
  findControlByText,
  collectText,
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

async function runCampaignThroughEngine({
  storage,
  timerEnabled = false,
  elapsedMs = 4000,
  missIndicesByLevel = {},
  level4RouteSelector = 'optimal',
  preQuizScore = 3,
  skipPreQuiz = false,
  postQuizDecisions,
}) {
  const env = installDomGlobals({ fetchBaseUrl: server.baseUrl, storage });
  try {
    const { loadQuiz, loadLevel } = await importAppModule('js/engine/dataLoader.js');
    const scoring = await importAppModule('js/engine/scoring.js');
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const minigames = {
      1: await importAppModule('js/minigames/inspector.js'),
      2: await importAppModule('js/minigames/classifier.js'),
      3: await importAppModule('js/minigames/codeHunt.js'),
      4: await importAppModule('js/minigames/branchingIncident.js'),
    };

    const store = createStateStore(storage);
    store.updateSettings({ timerEnabled });

    const preQuiz = await loadQuiz('pre');
    if (skipPreQuiz) {
      store.skipPreQuiz();
    } else {
      store.recordPreQuiz({
        score: preQuizScore,
        total: preQuiz.questions.length,
        decisions: preQuiz.questions.map((q, idx) => ({
          objectiveId: q.objectiveId,
          isCorrect: idx < preQuizScore,
        })),
      });
    }

    const container = env.document.createElement('div');
    env.document.body.appendChild(container);
    const acceptedForSummary = [];

    for (const lvlNum of [1, 2, 3, 4]) {
      const levelData = await loadLevel(lvlNum);
      const misses = new Set(missIndicesByLevel[lvlNum] || []);
      let attempt = scoring.createInitialAttempt(lvlNum);
      let completionPayload = null;
      const emittedDecisions = [];

      minigames[lvlNum].mount(container, levelData, {
        onDecision(payload, onContinue) {
          emittedDecisions.push(payload);
          attempt = scoring.applyDecision(attempt, {
            isCorrect: payload.isCorrect,
            penaltyOnWrongAnswer: payload.penaltyOnWrongAnswer,
            objectiveId: payload.objectiveId,
            timerEnabled,
            elapsedMs,
          });
          if (!attempt.failed && typeof onContinue === 'function') {
            onContinue();
          }
        },
        onLevelComplete(summary) {
          completionPayload = summary;
        },
        onOpenGlossary() {},
        onStatusAnnounce() {},
      });

      if (lvlNum === 1) {
        levelData.challenges.forEach((ch, idx) => {
          if (attempt.failed) return;
          const opt = misses.has(idx)
            ? ch.options.find((o) => o.id !== ch.correctOptionId)
            : ch.options.find((o) => o.id === ch.correctOptionId);
          const btn = container.querySelector(`[data-option-id="${opt.id}"]`) || findControlByText(container, opt.label);
          btn.click();
        });
      } else if (lvlNum === 2) {
        levelData.challenges.forEach((ch, idx) => {
          if (attempt.failed) return;
          const card = container.querySelector(`[data-challenge-id="${ch.id}"]`) || findControlByText(container, ch.recordLabel || ch.title);
          if (card) card.click();
          const bucket = misses.has(idx)
            ? levelData.buckets.find((b) => b.id !== ch.correctOptionId)
            : levelData.buckets.find((b) => b.id === ch.correctOptionId);
          const btn = container.querySelector(`[data-bucket-id="${bucket.id}"]`) || findControlByText(container, bucket.label);
          btn.click();
        });
      } else if (lvlNum === 3) {
        levelData.challenges.forEach((ch, idx) => {
          if (attempt.failed) return;
          const lineNum = ch.vulnerableLineNumbers[0];
          const lineBtn = container.querySelector(`[data-line-number="${lineNum}"]`) || findControlByText(container, String(lineNum));
          lineBtn.click();
          const mit = misses.has(idx)
            ? ch.mitigationOptions.find((m) => m.id !== ch.correctMitigationId)
            : ch.mitigationOptions.find((m) => m.id === ch.correctMitigationId);
          const mitBtn = container.querySelector(`[data-mitigation-id="${mit.id}"]`) || findControlByText(container, mit.label);
          mitBtn.click();
          const submit = findControlByText(container, 'confirmar') || findControlByText(container, 'aplicar') || findControlByText(container, 'verificar') || findControlByText(container, 'enviar') || container.querySelector('button[type="submit"]');
          if (submit) submit.click();
        });
      } else if (lvlNum === 4) {
        const g = analyzeLevel4Graph(levelData);
        let route;
        if (level4RouteSelector === 'observations') {
          route = g.simplePaths.find((p) => p.outcomeType === 'observations' && p.choices.some((c) => !c.option.isCorrect)) || g.simplePaths.find((p) => p.choices.some((c) => !c.option.isCorrect)) || g.simplePaths[0];
        } else if (level4RouteSelector === 'worst') {
          route = [...g.simplePaths].sort((a, b) => a.choices.filter((c) => c.option.isCorrect).length - b.choices.filter((c) => c.option.isCorrect).length)[0];
        } else {
          route = g.simplePaths.find((p) => p.choices.every((c) => c.option.isCorrect)) || g.simplePaths[0];
        }
        for (const step of route.choices) {
          if (attempt.failed) break;
          const btn = container.querySelector(`[data-option-id="${step.option.id}"]`) || findControlByText(container, step.option.label);
          btn.click();
        }
      }

      minigames[lvlNum].destroy();

      if (!attempt.failed) {
        attempt.completed = true;
        const nCount = completionPayload?.scorableDecisionsCount ?? emittedDecisions.length;
        const maxBaseLevel = scoring.calculateMaxBaseLevel(nCount);
        store.recordLevelAttemptResult(lvlNum, attempt, maxBaseLevel);
        acceptedForSummary.push({ ...attempt, maxBaseLevel });
      }
    }

    const postQuiz = await loadQuiz('post');
    const postDecisions =
      postQuizDecisions ||
      postQuiz.questions.map((q) => ({ objectiveId: q.objectiveId, isCorrect: true }));
    const postScore = postDecisions.filter((d) => d.isCorrect).length;
    store.recordPostQuiz({ score: postScore, total: postQuiz.questions.length, decisions: postDecisions });

    const finalState = store.getState();
    const summary = scoring.calculateFinalSummary(acceptedForSummary, finalState.postQuiz, finalState.preQuiz);
    return { store, finalState, summary, acceptedForSummary };
  } finally {
    env.restore();
  }
}

describe('Tier 4 — Real-World End-to-End User Journeys (12 scenarios)', () => {
  before(async () => {
    server = await startStaticServer();
  });

  after(async () => {
    if (server) await server.close();
  });

  test('[T4-S01] Happy Path — Arquitecto Criptográfico (>= 85%) with 3/5 -> 5/5 comparison over HTTP', async () => {
    const storage = createMemoryStorage();
    const { finalState, summary } = await runCampaignThroughEngine({
      storage,
      timerEnabled: false,
      preQuizScore: 3,
      postQuizDecisions: OBJECTIVES.map((o) => ({ objectiveId: o, isCorrect: true })),
    });
    assert.equal(finalState.unlockedLevel, 4);
    assert.equal(summary.basePercent, 100);
    assert.equal(summary.rank, 'Arquitecto Criptográfico');
    assert.equal(summary.quizComparison.hasComparison, true);
    assert.equal(summary.quizComparison.preScore, 3);
    assert.equal(summary.quizComparison.postScore, 5);
    assert.equal(summary.quizComparison.delta, 2);
  });

  test('[T4-S02] Analyst Path (50%-84.99%) with strategic mistakes and streak breaks', async () => {
    const storage = createMemoryStorage();
    const { summary } = await runCampaignThroughEngine({
      storage,
      missIndicesByLevel: {
        1: [1, 4],
        2: [2, 6],
        3: [1, 4],
      },
      postQuizDecisions: [
        { objectiveId: 'O1', isCorrect: true },
        { objectiveId: 'O2', isCorrect: true },
        { objectiveId: 'O3', isCorrect: false },
        { objectiveId: 'O4', isCorrect: true },
        { objectiveId: 'O5', isCorrect: true },
      ],
    });
    assert.ok(summary.basePercent >= 50 && summary.basePercent < 85, `Expected Analyst percent, got ${summary.basePercent}`);
    assert.equal(summary.rank, 'Analista');
    assert.equal(summary.weakestObjective.hasData, true);
  });

  test('[T4-S03] Apprentice Path (< 50%) with heavy misses remaining below 100% exposure', async () => {
    const storage = createMemoryStorage();
    const { summary } = await runCampaignThroughEngine({
      storage,
      missIndicesByLevel: {
        1: [0, 1, 2, 4],
        2: [0, 1, 2, 4, 5],
        3: [0, 1, 2, 4],
      },
      level4RouteSelector: 'worst',
      postQuizDecisions: OBJECTIVES.map((o) => ({ objectiveId: o, isCorrect: false })),
    });
    assert.ok(summary.basePercent < 50, `Expected <50% Apprentice percent, got ${summary.basePercent}`);
    assert.equal(summary.rank, 'Aprendiz');
    assert.equal(Number.isNaN(summary.basePercent), false);
  });

  test('[T4-S04] Pre-Quiz Skipped Journey shows Y/5 only with hasComparison: false', async () => {
    const storage = createMemoryStorage();
    const { finalState, summary } = await runCampaignThroughEngine({
      storage,
      skipPreQuiz: true,
      postQuizDecisions: [
        { objectiveId: 'O1', isCorrect: true },
        { objectiveId: 'O2', isCorrect: true },
        { objectiveId: 'O3', isCorrect: true },
        { objectiveId: 'O4', isCorrect: true },
        { objectiveId: 'O5', isCorrect: false },
      ],
    });
    assert.equal(finalState.preQuiz.skipped, true);
    assert.equal(summary.quizComparison.hasComparison, false);
    assert.equal(summary.quizComparison.postScore, 4);
  });

  test('[T4-S05] Exposure 100% Failure on Level 2 preserves Level 1 & unlockedLevel 2, then passes on Retry', async () => {
    const storage = createMemoryStorage();
    const env = installDomGlobals({ fetchBaseUrl: server.baseUrl, storage });
    try {
      const { loadLevel } = await importAppModule('js/engine/dataLoader.js');
      const scoring = await importAppModule('js/engine/scoring.js');
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const { mount, destroy } = await importAppModule('js/minigames/classifier.js');

      const store = createStateStore(storage);
      store.recordLevelAttemptResult(1, { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, failed: false, completed: true, decisions: [{ objectiveId: 'O1', isCorrect: true }] }, 700);
      assert.equal(store.getState().unlockedLevel, 2);

      // Fail Level 2
      const n2 = await loadLevel(2);
      const container = env.document.createElement('div');
      let failAtt = scoring.createInitialAttempt(2);
      mount(container, n2, {
        onDecision(p, onContinue) {
          failAtt = scoring.applyDecision(failAtt, p);
          if (!failAtt.failed && onContinue) onContinue();
        },
        onLevelComplete() {},
        onOpenGlossary() {},
        onStatusAnnounce() {},
      });
      for (const ch of n2.challenges) {
        if (failAtt.failed) break;
        const card = container.querySelector(`[data-challenge-id="${ch.id}"]`) || findControlByText(container, ch.recordLabel || ch.title);
        if (card) card.click();
        const wrongBucket = n2.buckets.find((b) => b.id !== ch.correctOptionId);
        const btn = container.querySelector(`[data-bucket-id="${wrongBucket.id}"]`) || findControlByText(container, wrongBucket.label);
        btn.click();
      }
      destroy();
      assert.equal(failAtt.failed, true);
      assert.equal(failAtt.exposure, 100);
      store.recordLevelAttemptResult(2, failAtt, 900);
      assert.equal(store.getState().unlockedLevel, 2);
      assert.equal(store.getState().levels[1].acceptedAttempt.baseScore, 700);

      // Retry Level 2 cleanly
      let passAtt = scoring.createInitialAttempt(2);
      let completedN = 0;
      mount(container, n2, {
        onDecision(p, onContinue) {
          passAtt = scoring.applyDecision(passAtt, p);
          if (!passAtt.failed && onContinue) onContinue();
        },
        onLevelComplete(s) {
          completedN = s.scorableDecisionsCount;
        },
        onOpenGlossary() {},
        onStatusAnnounce() {},
      });
      for (const ch of n2.challenges) {
        const card = container.querySelector(`[data-challenge-id="${ch.id}"]`) || findControlByText(container, ch.recordLabel || ch.title);
        if (card) card.click();
        const rightBucket = n2.buckets.find((b) => b.id === ch.correctOptionId);
        const btn = container.querySelector(`[data-bucket-id="${rightBucket.id}"]`) || findControlByText(container, rightBucket.label);
        btn.click();
      }
      destroy();
      passAtt.completed = true;
      store.recordLevelAttemptResult(2, passAtt, scoring.calculateMaxBaseLevel(completedN));
      assert.equal(store.getState().unlockedLevel, 3);
      assert.equal(store.getState().levels[2].acceptedAttempt.baseScore, 900);
    } finally {
      env.restore();
    }
  });

  test('[T4-S06] Completed-Level Retry updates acceptedAttempt without duplicating/summing scores', async () => {
    const storage = createMemoryStorage();
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const scoring = await importAppModule('js/engine/scoring.js');
    const store = createStateStore(storage);

    store.recordLevelAttemptResult(1, { baseScore: 400, optionalTimeBonus: 0, visibleScore: 400, failed: false, completed: true, decisions: [{ objectiveId: 'O1', isCorrect: true }] }, 700);
    store.recordLevelAttemptResult(1, { baseScore: 700, optionalTimeBonus: 0, visibleScore: 700, failed: false, completed: true, decisions: [{ objectiveId: 'O1', isCorrect: true }] }, 700);
    const att = store.getState().levels[1].acceptedAttempt;
    const summary = scoring.calculateFinalSummary([{ ...att, maxBaseLevel: 700 }]);
    assert.equal(summary.totalBaseScore, 700);
    assert.equal(summary.basePercent, 100);
  });

  test('[T4-S07] Level 4 Alternative Branching & Observations Path completes DAG with route-exact maxBaseLevel', async () => {
    const storage = createMemoryStorage();
    const { acceptedForSummary, summary } = await runCampaignThroughEngine({
      storage,
      level4RouteSelector: 'observations',
    });
    const l4 = acceptedForSummary.find((a) => a.levelId === 4);
    assert.ok(l4, 'Expected completed Level 4 attempt');
    assert.ok(l4.baseScore <= l4.maxBaseLevel);
    assert.ok(summary.basePercent <= 100);
  });

  test('[T4-S08] Timer-Enabled Speed Bonus increases visibleScore while leaving basePercent and rank identical', async () => {
    const timed = await runCampaignThroughEngine({
      storage: createMemoryStorage(),
      timerEnabled: true,
      elapsedMs: 2000,
    });
    const untimed = await runCampaignThroughEngine({
      storage: createMemoryStorage(),
      timerEnabled: false,
      elapsedMs: 2000,
    });
    assert.ok(timed.summary.totalVisibleScore > untimed.summary.totalVisibleScore);
    assert.equal(timed.summary.totalBaseScore, untimed.summary.totalBaseScore);
    assert.equal(timed.summary.basePercent, untimed.summary.basePercent);
    assert.equal(timed.summary.rank, untimed.summary.rank);
  });

  test('[T4-S09] Private-Browsing localStorage SecurityError fallback allows full gameplay in memory', async () => {
    const blocked = createMemoryStorage({ throwOnGet: 'SecurityError', throwOnSet: 'SecurityError' });
    const { store, summary } = await runCampaignThroughEngine({ storage: blocked });
    assert.equal(store.isMemoryFallback(), true);
    assert.equal(summary.rank, 'Arquitecto Criptográfico');
  });

  test('[T4-S10] Mid-Game Glossary Lookup, Escape Focus Return & Settings Reset Confirmation in booted app', async () => {
    const storage = createMemoryStorage();
    const env = await bootAppInStub({ storage });
    try {
      // Open Glossary, check terms, close with Escape -> focus returns
      const glossaryBtn = findControlByText(env.document.body, 'glosario');
      assert.ok(glossaryBtn);
      glossaryBtn.focus();
      glossaryBtn.click();
      await new Promise((r) => setTimeout(r, 30));
      const gDlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
      assert.ok(gDlg);
      env.document.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Escape' }));
      assert.equal(env.document.activeElement, glossaryBtn);

      // Seed progress then open Settings -> Cancel -> Confirm Reset
      const { createStateStore } = await importAppModule('js/engine/state.js');
      const seededStore = createStateStore(storage);
      seededStore.recordLevelAttemptResult(1, { baseScore: 700, visibleScore: 700, failed: false, completed: true, decisions: [] }, 700);

      const settingsBtn = findControlByText(env.document.body, 'ajustes');
      assert.ok(settingsBtn);
      settingsBtn.click();
      const sDlg = env.document.querySelector('[role="dialog"]:not([hidden]), dialog[open]');
      assert.ok(sDlg);
      const resetBtn = findControlByText(sDlg, 'restablecer');
      assert.ok(resetBtn);
      resetBtn.click();
      const cancelBtn = findControlByText(sDlg, 'cancelar');
      if (cancelBtn) {
        cancelBtn.click();
        assert.equal(JSON.parse(storage.getItem('alerta_de_fuga_progress_v1')).unlockedLevel, 2);
        resetBtn.click();
      }
      const confirmBtn = findControlByText(sDlg, 'confirmar') || findControlByText(sDlg, 'sí') || findControlByText(sDlg, 'aceptar');
      assert.ok(confirmBtn);
      confirmBtn.click();
      assert.equal(JSON.parse(storage.getItem('alerta_de_fuga_progress_v1')).unlockedLevel, 1);
    } finally {
      env.restore();
    }
  });

  test('[T4-S11] Reload Persistence Journey preserves unlockedLevel, scores, and reducedMotion across boot cycles', async () => {
    const storage = createMemoryStorage();
    const { createStateStore } = await importAppModule('js/engine/state.js');
    const s1 = createStateStore(storage);
    s1.updateSettings({ reducedMotion: true, timerEnabled: true });
    s1.recordPreQuiz({ score: 4, total: 5, decisions: [] });
    s1.recordLevelAttemptResult(1, { baseScore: 700, optionalTimeBonus: 15, visibleScore: 715, failed: false, completed: true, decisions: [{ objectiveId: 'O1', isCorrect: true }] }, 700);
    s1.recordLevelAttemptResult(2, { baseScore: 800, optionalTimeBonus: 10, visibleScore: 810, failed: false, completed: true, decisions: [{ objectiveId: 'O2', isCorrect: true }] }, 900);

    const env = await bootAppInStub({ storage });
    try {
      const s2 = createStateStore(storage).getState();
      assert.equal(s2.unlockedLevel, 3);
      assert.equal(s2.settings.reducedMotion, true);
      assert.equal(s2.levels[1].bestBaseScore, 700);
      assert.equal(s2.levels[2].bestBaseScore, 800);
      assert.match(collectText(env.document.body), /nivel 3/);
    } finally {
      env.restore();
    }
  });

  test('[T4-S12] Full Static Deployment, Security Hygiene & Documentation Audit over live HTTP', async () => {
    const requiredAssets = [
      '/',
      '/index.html',
      '/_headers',
      '/README.md',
      '/css/tokens.css',
      '/css/base.css',
      '/css/layout.css',
      '/css/components.css',
      '/css/minigames.css',
      '/assets/logo.svg',
      '/assets/analyst.svg',
      '/assets/attacker.svg',
      '/assets/ecb-pattern.svg',
      '/data/glossary.json',
      '/data/quiz-pre.json',
      '/data/quiz-post.json',
      '/data/levels/nivel-1.json',
      '/data/levels/nivel-2.json',
      '/data/levels/nivel-3.json',
      '/data/levels/nivel-4.json',
      '/js/main.js',
    ];

    for (const route of requiredAssets) {
      const fileRel = route === '/' ? 'index.html' : route.slice(1);
      await requireAppFile(fileRel);
      const res = await fetchHttp(server.baseUrl, route);
      assert.equal(res.status, 200, `Expected HTTP 200 for ${route}`);
      if (route === '/index.html') {
        const csp = res.headers.get('content-security-policy') || '';
        for (const d of REQUIRED_CSP_DIRECTIVES) {
          assert.ok(csp.includes(d), `Missing CSP directive ${d}`);
        }
        assert.deepEqual(scanHtmlForCspViolations(res.text, 'index.html'), []);
      }
    }

    const glossary = await fetchAppJson(server.baseUrl, '/data/glossary.json');
    const gIds = new Set(glossary.terms.map((t) => t.id));
    for (const id of REQUIRED_GLOSSARY_IDS) {
      assert.ok(gIds.has(id), `Missing glossary ID ${id}`);
    }

    for (const f of await listProjectFiles('css', '.css')) {
      assert.deepEqual(scanCssForViolations(await requireAppFile(f), f), []);
    }
    for (const f of await listProjectFiles('js', '.js')) {
      const content = await requireAppFile(f);
      assert.deepEqual(scanJsForSecurityViolations(content, f), []);
      assertNoSecretsOrRealPans(content, f);
    }
    for (const f of await listProjectFiles('data', '.json')) {
      assertNoSecretsOrRealPans(await requireAppFile(f), f);
    }
    assertNoSecretsOrRealPans(await requireAppFile('README.md'), 'README.md');
  });
});
