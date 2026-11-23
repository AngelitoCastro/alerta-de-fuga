import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RANK_THRESHOLDS,
  OBJECTIVES,
  calculateMaxBaseLevel,
  calculateTimeBonus,
  createInitialAttempt,
  applyDecision,
  calculateBasePercent,
  getRank,
  calculateWeakestObjective,
  comparePrePostQuizzes,
  calculateFinalSummary
} from '../js/engine/scoring.js';

test('exports expected RANK_THRESHOLDS and OBJECTIVES constants', () => {
  assert.deepEqual(RANK_THRESHOLDS, { ANALYST: 50, ARCHITECT: 85 });
  assert.deepEqual(OBJECTIVES, ['O1', 'O2', 'O3', 'O4', 'O5']);
});

test('calculateMaxBaseLevel follows 100 * N + 50 * floor(N / 3) and guards invalid inputs', () => {
  assert.equal(calculateMaxBaseLevel(1), 100);
  assert.equal(calculateMaxBaseLevel(3), 350);
  assert.equal(calculateMaxBaseLevel(6), 700);
  assert.equal(calculateMaxBaseLevel(8), 900);

  assert.equal(calculateMaxBaseLevel(0), 0);
  assert.equal(calculateMaxBaseLevel(-3), 0);
  assert.equal(calculateMaxBaseLevel(Number.NaN), 0);
  assert.equal(calculateMaxBaseLevel(Number.POSITIVE_INFINITY), 0);
  assert.equal(calculateMaxBaseLevel('6'), 0);
  assert.equal(calculateMaxBaseLevel(null), 0);
});

test('calculateTimeBonus enforces 0-30 range, disabled timer, and strict finite number guard', () => {
  assert.equal(calculateTimeBonus(0, false), 0);
  assert.equal(calculateTimeBonus(5000, false), 0);

  assert.equal(calculateTimeBonus(0, true), 30);
  assert.equal(calculateTimeBonus(15000, true), 15);
  assert.equal(calculateTimeBonus(30000, true), 0);
  assert.equal(calculateTimeBonus(90000, true), 0);

  assert.equal(calculateTimeBonus('', true), 0);
  assert.equal(calculateTimeBonus(null, true), 0);
  assert.equal(calculateTimeBonus(undefined, true), 0);
  assert.equal(calculateTimeBonus(Number.NaN, true), 0);
  assert.equal(calculateTimeBonus(Number.POSITIVE_INFINITY, true), 0);
  assert.equal(calculateTimeBonus(Number.NEGATIVE_INFINITY, true), 0);
  assert.equal(calculateTimeBonus(-1000, true), 0);
});

test('applyDecision handles hit, miss, 3-streak bonus, streak reset, and immutability', () => {
  const initial = createInitialAttempt(1);
  const frozenSnapshot = JSON.stringify(initial);

  const afterHit1 = applyDecision(initial, { isCorrect: true, objectiveId: 'O1' });
  assert.equal(JSON.stringify(initial), frozenSnapshot);
  assert.equal(afterHit1.baseScore, 100);
  assert.equal(afterHit1.streak, 1);
  assert.equal(afterHit1.exposure, 0);

  const afterHit2 = applyDecision(afterHit1, { isCorrect: true, objectiveId: 'O1' });
  assert.equal(afterHit2.baseScore, 200);
  assert.equal(afterHit2.streak, 2);

  const afterHit3 = applyDecision(afterHit2, { isCorrect: true, objectiveId: 'O1' });
  assert.equal(afterHit3.baseScore, 350);
  assert.equal(afterHit3.streak, 3);

  const afterMiss = applyDecision(afterHit3, {
    isCorrect: false,
    penaltyOnWrongAnswer: 20,
    objectiveId: 'O1'
  });
  assert.equal(afterMiss.baseScore, 350);
  assert.equal(afterMiss.streak, 0);
  assert.equal(afterMiss.exposure, 20);
  assert.equal(afterMiss.failed, false);

  const afterNewStreak1 = applyDecision(afterMiss, { isCorrect: true, objectiveId: 'O1' });
  const afterNewStreak2 = applyDecision(afterNewStreak1, { isCorrect: true, objectiveId: 'O1' });
  const afterNewStreak3 = applyDecision(afterNewStreak2, { isCorrect: true, objectiveId: 'O1' });
  assert.equal(afterNewStreak1.streak, 1);
  assert.equal(afterNewStreak2.streak, 2);
  assert.equal(afterNewStreak3.streak, 3);
  assert.equal(afterNewStreak3.baseScore, 700);
  assert.equal(afterHit3.decisions.length, 3);
  assert.equal(afterNewStreak3.decisions.length, 7);
});

test('streaks do not carry over across distinct level attempts', () => {
  let level1 = createInitialAttempt(1);
  level1 = applyDecision(level1, { isCorrect: true, objectiveId: 'O1' });
  level1 = applyDecision(level1, { isCorrect: true, objectiveId: 'O1' });
  assert.equal(level1.streak, 2);

  let level2 = createInitialAttempt(2);
  level2 = applyDecision(level2, { isCorrect: true, objectiveId: 'O2' });
  assert.equal(level2.streak, 1);
  assert.equal(level2.baseScore, 100);
});

test('exposure is clamped to 0-100 and locks scoring once failed', () => {
  let attempt = createInitialAttempt(2);
  attempt = applyDecision(attempt, { isCorrect: true, objectiveId: 'O2' });
  attempt = applyDecision(attempt, { isCorrect: false, penaltyOnWrongAnswer: 60, objectiveId: 'O2' });
  assert.equal(attempt.exposure, 60);
  assert.equal(attempt.failed, false);

  attempt = applyDecision(attempt, { isCorrect: false, penaltyOnWrongAnswer: 55, objectiveId: 'O3' });
  assert.equal(attempt.exposure, 100);
  assert.equal(attempt.failed, true);
  assert.equal(attempt.baseScore, 100);

  const afterLockedHit = applyDecision(attempt, {
    isCorrect: true,
    objectiveId: 'O3',
    timerEnabled: true,
    elapsedMs: 1000
  });
  assert.equal(afterLockedHit.failed, true);
  assert.equal(afterLockedHit.exposure, 100);
  assert.equal(afterLockedHit.baseScore, 100);
  assert.equal(afterLockedHit.optionalTimeBonus, 0);
  assert.equal(afterLockedHit.visibleScore, 100);
  assert.equal(afterLockedHit.streak, 0);
});

test('calculateBasePercent guards division by zero and getRank enforces thresholds and NaN fallback', () => {
  assert.equal(calculateBasePercent(300, 0), 0);
  assert.equal(calculateBasePercent(300, -100), 0);
  assert.equal(calculateBasePercent(300, Number.NaN), 0);
  assert.equal(calculateBasePercent(Number.NaN, 350), 0);
  assert.equal(calculateBasePercent(350, 700), 50);

  assert.equal(getRank(Number.NaN), 'Aprendiz');
  assert.equal(getRank(-10), 'Aprendiz');
  assert.equal(getRank(0), 'Aprendiz');
  assert.equal(getRank(49.99), 'Aprendiz');
  assert.equal(getRank(50), 'Analista');
  assert.equal(getRank(84.99), 'Analista');
  assert.equal(getRank(85), 'Arquitecto Criptográfico');
  assert.equal(getRank(100), 'Arquitecto Criptográfico');
});

test('timer disabled adds zero bonus without degrading baseScore or rank compared to timer enabled', () => {
  let noTimer = createInitialAttempt(1);
  let withTimer = createInitialAttempt(1);

  for (let i = 0; i < 6; i += 1) {
    noTimer = applyDecision(noTimer, {
      isCorrect: true,
      objectiveId: 'O1',
      timerEnabled: false,
      elapsedMs: 2000
    });
    withTimer = applyDecision(withTimer, {
      isCorrect: true,
      objectiveId: 'O1',
      timerEnabled: true,
      elapsedMs: 2000
    });
  }

  assert.equal(noTimer.baseScore, 700);
  assert.equal(withTimer.baseScore, 700);
  assert.equal(noTimer.optionalTimeBonus, 0);
  assert.equal(withTimer.optionalTimeBonus, 168);
  assert.equal(noTimer.visibleScore, 700);
  assert.equal(withTimer.visibleScore, 868);

  const summaryNoTimer = calculateFinalSummary([{ ...noTimer, completed: true, maxBaseLevel: 700 }]);
  const summaryWithTimer = calculateFinalSummary([{ ...withTimer, completed: true, maxBaseLevel: 700 }]);
  assert.equal(summaryNoTimer.basePercent, 100);
  assert.equal(summaryWithTimer.basePercent, 100);
  assert.equal(summaryNoTimer.rank, 'Arquitecto Criptográfico');
  assert.equal(summaryWithTimer.rank, 'Arquitecto Criptográfico');
});

test('calculateWeakestObjective excludes zero-total objectives, breaks ties ascending O1-O5, and handles empty data', () => {
  const empty = calculateWeakestObjective([], []);
  assert.equal(empty.hasData, false);
  assert.equal(empty.objectiveId, 'O1');
  assert.equal(empty.rate, 0);
  assert.equal(empty.breakdown.O2.rate, null);

  // O2 and O4 tie at 0.5 (1/2); O1 is 1.0; O3 and O5 have total === 0 (must not win as 0%).
  const tieResult = calculateWeakestObjective(
    [
      {
        completed: true,
        failed: false,
        decisions: [
          { objectiveId: 'O1', isCorrect: true },
          { objectiveId: 'O2', isCorrect: false },
          { objectiveId: 'O4', isCorrect: true }
        ]
      }
    ],
    [
      { objectiveId: 'O2', isCorrect: true },
      { objectiveId: 'O4', isCorrect: false }
    ]
  );

  assert.equal(tieResult.hasData, true);
  assert.equal(tieResult.objectiveId, 'O2');
  assert.equal(tieResult.rate, 0.5);
  assert.equal(tieResult.breakdown.O3.total, 0);
  assert.equal(tieResult.breakdown.O3.rate, null);
  assert.equal(tieResult.breakdown.O5.rate, null);
});

test('comparePrePostQuizzes omits delta when preQuiz is skipped or missing', () => {
  const skipped = comparePrePostQuizzes(
    { completed: false, skipped: true, score: 0, total: 5 },
    { completed: true, score: 4, total: 5 }
  );
  assert.equal(skipped.hasComparison, false);
  assert.equal(skipped.preScore, null);
  assert.equal(skipped.postScore, 4);
  assert.equal(skipped.delta, null);

  const missingPre = comparePrePostQuizzes(null, { completed: true, score: 5, total: 5 });
  assert.equal(missingPre.hasComparison, false);
  assert.equal(missingPre.delta, null);

  const bothDone = comparePrePostQuizzes(
    { completed: true, skipped: false, score: 2, total: 5 },
    { completed: true, score: 5, total: 5 }
  );
  assert.equal(bothDone.hasComparison, true);
  assert.equal(bothDone.preScore, 2);
  assert.equal(bothDone.postScore, 5);
  assert.equal(bothDone.delta, 3);
});

test('calculateFinalSummary excludes failed/incomplete attempts and never sums discarded retries', () => {
  const level1Accepted = {
    levelId: 1,
    baseScore: 550,
    optionalTimeBonus: 20,
    visibleScore: 570,
    maxBaseLevel: 700,
    exposure: 20,
    failed: false,
    completed: true,
    decisions: [
      { objectiveId: 'O1', isCorrect: true },
      { objectiveId: 'O1', isCorrect: false }
    ]
  };
  const failedAttempt = {
    levelId: 2,
    baseScore: 200,
    optionalTimeBonus: 0,
    visibleScore: 200,
    maxBaseLevel: 900,
    exposure: 100,
    failed: true,
    completed: false,
    decisions: [{ objectiveId: 'O2', isCorrect: false }]
  };
  const incompleteAttempt = {
    levelId: 3,
    baseScore: 700,
    optionalTimeBonus: 0,
    visibleScore: 700,
    maxBaseLevel: 700,
    exposure: 0,
    failed: false,
    completed: false,
    decisions: [{ objectiveId: 'O3', isCorrect: true }]
  };
  const level2Accepted = {
    levelId: 2,
    baseScore: 800,
    optionalTimeBonus: 10,
    visibleScore: 810,
    maxBaseLevel: 900,
    exposure: 15,
    failed: false,
    completed: true,
    decisions: [
      { objectiveId: 'O2', isCorrect: true },
      { objectiveId: 'O3', isCorrect: true }
    ]
  };

  const summary = calculateFinalSummary(
    [level1Accepted, failedAttempt, incompleteAttempt, level2Accepted],
    {
      completed: true,
      score: 4,
      total: 5,
      decisions: [
        { objectiveId: 'O1', isCorrect: false },
        { objectiveId: 'O2', isCorrect: true }
      ]
    },
    { completed: false, skipped: true, score: 0, total: 5 }
  );

  assert.equal(summary.completedLevelsCount, 2);
  assert.equal(summary.totalBaseScore, 1350);
  assert.equal(summary.totalMaxBaseLevel, 1600);
  assert.equal(summary.totalOptionalTimeBonus, 30);
  assert.equal(summary.totalVisibleScore, 1380);
  assert.equal(summary.basePercent, (1350 / 1600) * 100);
  assert.equal(summary.rank, 'Analista');
  assert.equal(summary.quizComparison.hasComparison, false);
  assert.equal(summary.quizComparison.delta, null);
  assert.equal(summary.weakestObjective.objectiveId, 'O1');
  assert.equal(summary.weakestObjective.breakdown.O1.correct, 1);
  assert.equal(summary.weakestObjective.breakdown.O1.total, 3);
});
