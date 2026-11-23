export const RANK_THRESHOLDS = Object.freeze({
  ANALYST: 50,
  ARCHITECT: 85
});

export const OBJECTIVES = Object.freeze(['O1', 'O2', 'O3', 'O4', 'O5']);

const OBJECTIVE_SET = new Set(OBJECTIVES);

function isValidFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function calculateMaxBaseLevel(numDecisions) {
  if (!isValidFiniteNumber(numDecisions) || numDecisions <= 0) {
    return 0;
  }
  const n = Math.floor(numDecisions);
  if (n <= 0) {
    return 0;
  }
  return 100 * n + 50 * Math.floor(n / 3);
}

export function normalizeLevelMaxBase(scorableDecisionsCount, standardDecisionsCount = null) {
  const effectiveDecisions =
    isValidFiniteNumber(standardDecisionsCount) && standardDecisionsCount > 0
      ? standardDecisionsCount
      : scorableDecisionsCount;
  return calculateMaxBaseLevel(effectiveDecisions);
}

export function calculateTimeBonus(elapsedMs, timerEnabled, maxBonus = 30) {
  if (!timerEnabled) {
    return 0;
  }
  if (!isValidFiniteNumber(elapsedMs) || elapsedMs < 0) {
    return 0;
  }
  if (!isValidFiniteNumber(maxBonus) || maxBonus <= 0) {
    return 0;
  }
  const rawBonus = Math.round(maxBonus - elapsedMs / 1000);
  return Math.max(0, Math.min(maxBonus, rawBonus));
}

export function createInitialAttempt(levelId) {
  return {
    levelId,
    baseScore: 0,
    optionalTimeBonus: 0,
    visibleScore: 0,
    streak: 0,
    exposure: 0,
    failed: false,
    completed: false,
    decisions: []
  };
}

export function applyDecision(
  attempt,
  {
    isCorrect,
    penaltyOnWrongAnswer = 15,
    objectiveId,
    timerEnabled = false,
    elapsedMs = null,
    challengeId,
    title,
    glossaryTermId,
    correctControl
  } = {}
) {
  const baseAttempt = attempt && typeof attempt === 'object'
    ? attempt
    : createInitialAttempt(null);

  const existingDecisions = Array.isArray(baseAttempt.decisions)
    ? baseAttempt.decisions.map((item) => {
      const copy = {
        objectiveId: item?.objectiveId,
        isCorrect: Boolean(item?.isCorrect)
      };
      if (typeof item?.challengeId === 'string' && item.challengeId) copy.challengeId = item.challengeId;
      if (typeof item?.title === 'string' && item.title) copy.title = item.title;
      if (typeof item?.glossaryTermId === 'string' && item.glossaryTermId) copy.glossaryTermId = item.glossaryTermId;
      if (typeof item?.correctControl === 'string' && item.correctControl) copy.correctControl = item.correctControl;
      return copy;
    })
    : [];

  const currentBaseScore = isValidFiniteNumber(baseAttempt.baseScore) && baseAttempt.baseScore >= 0
    ? baseAttempt.baseScore
    : 0;
  const currentTimeBonus = isValidFiniteNumber(baseAttempt.optionalTimeBonus) && baseAttempt.optionalTimeBonus >= 0
    ? baseAttempt.optionalTimeBonus
    : 0;
  const currentStreak = isValidFiniteNumber(baseAttempt.streak) && baseAttempt.streak >= 0
    ? Math.floor(baseAttempt.streak)
    : 0;
  const currentExposure = isValidFiniteNumber(baseAttempt.exposure)
    ? Math.max(0, Math.min(100, baseAttempt.exposure))
    : 0;

  if (baseAttempt.failed === true || currentExposure >= 100) {
    return {
      ...baseAttempt,
      baseScore: currentBaseScore,
      optionalTimeBonus: currentTimeBonus,
      visibleScore: currentBaseScore + currentTimeBonus,
      streak: 0,
      exposure: Math.min(100, currentExposure),
      failed: true,
      decisions: existingDecisions
    };
  }

  const penalty = isValidFiniteNumber(penaltyOnWrongAnswer) && penaltyOnWrongAnswer >= 0
    ? penaltyOnWrongAnswer
    : 15;

  const correct = isCorrect === true;
  let nextStreak = 0;
  let newBaseScore = currentBaseScore;
  let newTimeBonus = currentTimeBonus;
  let newExposure = currentExposure;

  if (correct) {
    nextStreak = currentStreak + 1;
    const streakBonus = nextStreak % 3 === 0 ? 50 : 0;
    const basePoints = 100 + streakBonus;
    const timeBonus = calculateTimeBonus(elapsedMs, timerEnabled);
    newBaseScore = currentBaseScore + basePoints;
    newTimeBonus = currentTimeBonus + timeBonus;
  } else {
    nextStreak = 0;
    newExposure = Math.max(0, Math.min(100, currentExposure + penalty));
  }

  const failed = newExposure >= 100;
  const newVisibleScore = newBaseScore + newTimeBonus;

  const nextDecision = {
    objectiveId,
    isCorrect: correct
  };
  if (typeof challengeId === 'string' && challengeId.trim()) {
    nextDecision.challengeId = challengeId.trim();
  }
  if (typeof title === 'string' && title.trim()) {
    nextDecision.title = title.trim();
  }
  if (typeof glossaryTermId === 'string' && glossaryTermId.trim()) {
    nextDecision.glossaryTermId = glossaryTermId.trim();
  }
  if (typeof correctControl === 'string' && correctControl.trim()) {
    nextDecision.correctControl = correctControl.trim();
  }

  return {
    ...baseAttempt,
    baseScore: newBaseScore,
    optionalTimeBonus: newTimeBonus,
    visibleScore: newVisibleScore,
    streak: nextStreak,
    exposure: newExposure,
    failed,
    decisions: [
      ...existingDecisions,
      nextDecision
    ]
  };
}

export function calculateBasePercent(baseScore, maxBaseLevel) {
  if (!isValidFiniteNumber(baseScore) || !isValidFiniteNumber(maxBaseLevel) || maxBaseLevel <= 0) {
    return 0;
  }
  const safeBase = Math.max(0, baseScore);
  return (safeBase / maxBaseLevel) * 100;
}

export function getRank(basePercent) {
  if (!isValidFiniteNumber(basePercent)) {
    return 'Aprendiz';
  }
  if (basePercent < RANK_THRESHOLDS.ANALYST) {
    return 'Aprendiz';
  }
  if (basePercent < RANK_THRESHOLDS.ARCHITECT) {
    return 'Analista';
  }
  return 'Arquitecto Criptográfico';
}

export function calculateWeakestObjective(acceptedAttempts = [], postQuizDecisions = []) {
  const breakdown = {};
  for (const objId of OBJECTIVES) {
    breakdown[objId] = { correct: 0, total: 0, rate: null };
  }

  let hasAttemptDecisions = false;
  let hasPostQuizDecisions = false;

  if (Array.isArray(acceptedAttempts)) {
    for (const attempt of acceptedAttempts) {
      if (!attempt || typeof attempt !== 'object') {
        continue;
      }
      if (attempt.failed === true || attempt.completed === false) {
        continue;
      }
      if (isValidFiniteNumber(attempt.exposure) && attempt.exposure >= 100) {
        continue;
      }
      if (!Array.isArray(attempt.decisions)) {
        continue;
      }
      for (const decision of attempt.decisions) {
        const objId = decision?.objectiveId;
        if (!OBJECTIVE_SET.has(objId)) {
          continue;
        }
        breakdown[objId].total += 1;
        if (decision.isCorrect === true) {
          breakdown[objId].correct += 1;
        }
        hasAttemptDecisions = true;
      }
    }
  }

  if (Array.isArray(postQuizDecisions)) {
    for (const decision of postQuizDecisions) {
      const objId = decision?.objectiveId;
      if (!OBJECTIVE_SET.has(objId)) {
        continue;
      }
      breakdown[objId].total += 1;
      if (decision.isCorrect === true) {
        breakdown[objId].correct += 1;
      }
      hasPostQuizDecisions = true;
    }
  }

  let weakestId = null;
  let minRate = Infinity;

  for (const objId of OBJECTIVES) {
    const entry = breakdown[objId];
    if (entry.total > 0) {
      entry.rate = entry.correct / entry.total;
      if (entry.rate < minRate) {
        minRate = entry.rate;
        weakestId = objId;
      }
    }
  }

  let sourceDescription = 'Sin decisiones evaluadas';
  if (hasAttemptDecisions && hasPostQuizDecisions) {
    sourceDescription = 'Intentos aceptados de los niveles y test posterior';
  } else if (hasAttemptDecisions) {
    sourceDescription = 'Intentos aceptados de los niveles';
  } else if (hasPostQuizDecisions) {
    sourceDescription = 'Test posterior';
  }

  if (weakestId === null) {
    return {
      objectiveId: 'O1',
      rate: 0,
      hasData: false,
      breakdown,
      sourceDescription
    };
  }

  return {
    objectiveId: weakestId,
    rate: minRate,
    hasData: true,
    breakdown,
    sourceDescription
  };
}

export function comparePrePostQuizzes(preQuiz = null, postQuiz = null) {
  const hasPre = Boolean(
    preQuiz &&
    typeof preQuiz === 'object' &&
    preQuiz.completed === true &&
    preQuiz.skipped !== true &&
    isValidFiniteNumber(preQuiz.score)
  );
  const hasPost = Boolean(
    postQuiz &&
    typeof postQuiz === 'object' &&
    postQuiz.completed === true &&
    isValidFiniteNumber(postQuiz.score)
  );

  const preTotal = isValidFiniteNumber(preQuiz?.total) && preQuiz.total > 0 ? preQuiz.total : 5;
  const postTotal = isValidFiniteNumber(postQuiz?.total) && postQuiz.total > 0 ? postQuiz.total : 5;

  if (hasPre && hasPost) {
    return {
      hasComparison: true,
      preScore: preQuiz.score,
      preTotal,
      postScore: postQuiz.score,
      postTotal,
      delta: postQuiz.score - preQuiz.score
    };
  }

  return {
    hasComparison: false,
    preScore: hasPre ? preQuiz.score : null,
    preTotal,
    postScore: hasPost ? postQuiz.score : null,
    postTotal,
    delta: null
  };
}

export function calculateFinalSummary(acceptedAttempts = [], postQuiz = null, preQuiz = null) {
  const validAttempts = Array.isArray(acceptedAttempts)
    ? acceptedAttempts.filter((attempt) => (
      attempt &&
      typeof attempt === 'object' &&
      attempt.failed !== true &&
      attempt.completed !== false &&
      !(isValidFiniteNumber(attempt.exposure) && attempt.exposure >= 100)
    ))
    : [];

  let totalBaseScore = 0;
  let totalMaxBaseLevel = 0;
  let totalOptionalTimeBonus = 0;
  let totalVisibleScore = 0;

  for (const attempt of validAttempts) {
    const baseScore = isValidFiniteNumber(attempt.baseScore) && attempt.baseScore >= 0
      ? attempt.baseScore
      : 0;
    const maxBaseLevel = isValidFiniteNumber(attempt.maxBaseLevel) && attempt.maxBaseLevel >= 0
      ? attempt.maxBaseLevel
      : 0;
    const timeBonus = isValidFiniteNumber(attempt.optionalTimeBonus) && attempt.optionalTimeBonus >= 0
      ? attempt.optionalTimeBonus
      : 0;
    const visibleScore = isValidFiniteNumber(attempt.visibleScore) && attempt.visibleScore >= 0
      ? attempt.visibleScore
      : baseScore + timeBonus;

    totalBaseScore += baseScore;
    totalMaxBaseLevel += maxBaseLevel;
    totalOptionalTimeBonus += timeBonus;
    totalVisibleScore += visibleScore;
  }

  const basePercent = calculateBasePercent(totalBaseScore, totalMaxBaseLevel);
  const rank = getRank(basePercent);
  const postQuizDecisions = postQuiz && postQuiz.completed === true && Array.isArray(postQuiz.decisions)
    ? postQuiz.decisions
    : [];
  const weakestObjective = calculateWeakestObjective(validAttempts, postQuizDecisions);
  const quizComparison = comparePrePostQuizzes(preQuiz, postQuiz);

  return {
    totalBaseScore,
    totalMaxBaseLevel,
    totalOptionalTimeBonus,
    totalVisibleScore,
    basePercent,
    rank,
    weakestObjective,
    quizComparison,
    completedLevelsCount: validAttempts.length
  };
}
