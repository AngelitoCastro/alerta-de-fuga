import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const OBJECTIVES = ['O1', 'O2', 'O3', 'O4', 'O5'];
const REQUIRED_GLOSSARY_IDS = [
  'texto-plano',
  'mitm',
  'tls',
  'https',
  'hsts',
  'certificado-digital',
  'hash',
  'salt',
  'argon2id',
  'bcrypt',
  'aes-gcm',
  'aes-ecb',
  'nonce-iv',
  'tokenizacion',
  'rsa-oaep',
  'gestion-secretos',
  'csprng',
  'minimizacion-datos'
];
const ALLOWED_PENALTIES = new Set([10, 15, 20, 25]);
const LEVEL4_PHASES = [
  'Detección',
  'Contención',
  'Evaluación',
  'Protección',
  'Recuperación',
  'Cierre'
];
const ALLOWED_REFERENCE_HOSTS = new Set([
  'top10.owasp.org',
  'cheatsheetseries.owasp.org',
  'www.pcisecuritystandards.org',
  'www.w3.org'
]);

async function loadJson(relPath) {
  const raw = await readFile(resolve(ROOT, relPath), 'utf8');
  return JSON.parse(raw);
}

function assertNonEmptyString(val, label) {
  assert.equal(typeof val, 'string', `${label} must be a string`);
  assert.ok(val.trim().length > 0, `${label} must be non-empty`);
}

function assertFeedbackBlock(block, label) {
  assert.ok(block && typeof block === 'object', `${label} must be an object`);
  assertNonEmptyString(block.attackerView, `${label}.attackerView`);
  assertNonEmptyString(block.why, `${label}.why`);
  assertNonEmptyString(block.correctControl, `${label}.correctControl`);
}

function assertHttpsRef(url, label) {
  assertNonEmptyString(url, label);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    assert.fail(`${label} is not a valid URL: ${url}`);
  }
  assert.equal(parsed.protocol, 'https:', `${label} must use https://`);
  assert.ok(
    ALLOWED_REFERENCE_HOSTS.has(parsed.hostname),
    `${label} hostname ${parsed.hostname} must be an approved reference host`
  );
}

function collectStrings(value, path = '$', out = []) {
  if (typeof value === 'string') {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, idx) => collectStrings(item, `${path}[${idx}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectStrings(v, `${path}.${k}`, out);
    }
  }
  return out;
}

function passesLuhn(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

test('All 7 JSON files parse cleanly and conform to schemas', async () => {
  const glossary = await loadJson('data/glossary.json');
  const quizPre = await loadJson('data/quiz-pre.json');
  const quizPost = await loadJson('data/quiz-post.json');
  const n1 = await loadJson('data/levels/nivel-1.json');
  const n2 = await loadJson('data/levels/nivel-2.json');
  const n3 = await loadJson('data/levels/nivel-3.json');
  const n4 = await loadJson('data/levels/nivel-4.json');

  // Glossary schema
  assert.equal(glossary.version, 1);
  assert.ok(Array.isArray(glossary.terms));
  assert.ok(glossary.terms.length >= 18);
  const glossaryIds = new Set(glossary.terms.map((t) => t.id));
  assert.equal(glossaryIds.size, glossary.terms.length, 'Duplicate glossary IDs');
  for (const requiredId of REQUIRED_GLOSSARY_IDS) {
    assert.ok(glossaryIds.has(requiredId), `Missing glossary ID: ${requiredId}`);
  }
  for (const term of glossary.terms) {
    assertNonEmptyString(term.id, 'glossary.id');
    assertNonEmptyString(term.term, `glossary[${term.id}].term`);
    assertNonEmptyString(term.definition, `glossary[${term.id}].definition`);
    assertNonEmptyString(term.analogy, `glossary[${term.id}].analogy`);
    assertNonEmptyString(term.analogyLimit, `glossary[${term.id}].analogyLimit`);
    assert.ok([1, 2, 3, 4].includes(term.relatedLevel), `glossary[${term.id}].relatedLevel invalid`);
    assertNonEmptyString(term.relatedChallengeId, `glossary[${term.id}].relatedChallengeId`);
  }

  // Quizzes schema
  for (const [quiz, expectedType] of [[quizPre, 'pre'], [quizPost, 'post']]) {
    assert.equal(quiz.version, 1);
    assert.equal(quiz.type, expectedType);
    assert.ok(Array.isArray(quiz.questions));
    assert.equal(quiz.questions.length, 5, `${expectedType} quiz must have 5 questions`);
    for (const q of quiz.questions) {
      assertNonEmptyString(q.id, `${expectedType}.id`);
      assert.ok(OBJECTIVES.includes(q.objectiveId), `${q.id}.objectiveId invalid`);
      assertNonEmptyString(q.prompt, `${q.id}.prompt`);
      assert.ok(Array.isArray(q.options) && q.options.length === 4, `${q.id} must have 4 options`);
      const optIds = new Set();
      for (const opt of q.options) {
        assertNonEmptyString(opt.id, `${q.id}.option.id`);
        assertNonEmptyString(opt.label, `${q.id}.option.label`);
        optIds.add(opt.id);
      }
      assert.equal(optIds.size, 4, `${q.id} duplicate option ids`);
      assert.ok(optIds.has(q.correctOptionId), `${q.id}.correctOptionId missing from options`);
      assertNonEmptyString(q.explanation, `${q.id}.explanation`);
      assert.ok(
        !/^(correcto|incorrecto)\b/i.test(q.explanation.trim()),
        `${q.id}.explanation must be neutral (not start with Correcto/Incorrecto)`
      );
      assertHttpsRef(q.owaspRef, `${q.id}.owaspRef`);
      assert.ok(glossaryIds.has(q.glossaryTermId), `${q.id}.glossaryTermId unknown: ${q.glossaryTermId}`);
    }
  }

  // Level 1 schema
  assert.equal(n1.level, 1);
  assertNonEmptyString(n1.title, 'nivel-1.title');
  assert.deepEqual(n1.objectiveIds, ['O1']);
  assert.equal(n1.challenges.length, 6);
  for (const c of n1.challenges) {
    assertNonEmptyString(c.id, 'n1.id');
    assert.equal(c.objectiveId, 'O1');
    assert.equal(c.type, 'network-inspector');
    assertNonEmptyString(c.title, `${c.id}.title`);
    assertNonEmptyString(c.scenario, `${c.id}.scenario`);
    assert.ok(c.requestDetails && typeof c.requestDetails === 'object');
    for (const field of ['method', 'url', 'protocol', 'tlsVersion', 'certificateStatus', 'payloadPreview']) {
      assertNonEmptyString(c.requestDetails[field], `${c.id}.requestDetails.${field}`);
    }
    assert.ok(c.requestDetails.headers && typeof c.requestDetails.headers === 'object');
    assert.equal(c.options.length, 3);
    const optIds = new Set(c.options.map((o) => o.id));
    assert.equal(optIds.size, 3);
    assert.ok(optIds.has(c.correctOptionId));
    assert.ok(ALLOWED_PENALTIES.has(c.exposureDelta), `${c.id}.exposureDelta invalid`);
    for (const optId of optIds) {
      assertFeedbackBlock(c.feedbackByOption?.[optId], `${c.id}.feedbackByOption.${optId}`);
    }
    assert.ok(glossaryIds.has(c.glossaryTermId), `${c.id}.glossaryTermId unknown`);
    assertHttpsRef(c.owaspRef, `${c.id}.owaspRef`);
  }

  // Level 2 schema
  assert.equal(n2.level, 2);
  assertNonEmptyString(n2.title, 'nivel-2.title');
  assert.deepEqual(n2.objectiveIds, ['O2', 'O3', 'O5']);
  assert.equal(n2.buckets.length, 4);
  const bucketIds = new Set(n2.buckets.map((b) => b.id));
  assert.equal(bucketIds.size, 4);
  for (const b of n2.buckets) {
    assertNonEmptyString(b.id, 'n2.bucket.id');
    assertNonEmptyString(b.label, `n2.bucket[${b.id}].label`);
    assertNonEmptyString(b.description, `n2.bucket[${b.id}].description`);
  }
  assert.equal(n2.challenges.length, 8);
  let hasEcbVisualAsset = false;
  for (const c of n2.challenges) {
    assertNonEmptyString(c.id, 'n2.id');
    assert.ok(n2.objectiveIds.includes(c.objectiveId), `${c.id}.objectiveId invalid`);
    assert.equal(c.type, 'data-classifier');
    assertNonEmptyString(c.title, `${c.id}.title`);
    assertNonEmptyString(c.scenario, `${c.id}.scenario`);
    assertNonEmptyString(c.recordLabel, `${c.id}.recordLabel`);
    if (c.visualAsset !== undefined) {
      assert.equal(c.visualAsset, 'assets/ecb-pattern.svg');
      hasEcbVisualAsset = true;
    }
    assert.ok(bucketIds.has(c.correctOptionId), `${c.id}.correctOptionId invalid`);
    assert.ok(ALLOWED_PENALTIES.has(c.exposureDelta), `${c.id}.exposureDelta invalid`);
    for (const bId of bucketIds) {
      assertFeedbackBlock(c.feedbackByOption?.[bId], `${c.id}.feedbackByOption.${bId}`);
    }
    assert.ok(glossaryIds.has(c.glossaryTermId), `${c.id}.glossaryTermId unknown`);
    assertHttpsRef(c.owaspRef, `${c.id}.owaspRef`);
  }
  assert.ok(hasEcbVisualAsset, 'nivel-2 must reference assets/ecb-pattern.svg on AES-ECB challenge');

  // Level 3 schema
  assert.equal(n3.level, 3);
  assertNonEmptyString(n3.title, 'nivel-3.title');
  assert.deepEqual(n3.objectiveIds, ['O3', 'O4']);
  assert.equal(n3.challenges.length, 6);
  for (const c of n3.challenges) {
    assertNonEmptyString(c.id, 'n3.id');
    assert.ok(n3.objectiveIds.includes(c.objectiveId), `${c.id}.objectiveId invalid`);
    assert.equal(c.type, 'code-hunt');
    assertNonEmptyString(c.title, `${c.id}.title`);
    assertNonEmptyString(c.filePath, `${c.id}.filePath`);
    assertNonEmptyString(c.scenario, `${c.id}.scenario`);
    assert.ok(Array.isArray(c.lines) && c.lines.length >= 4);
    const lineNums = new Set();
    for (const line of c.lines) {
      assert.equal(typeof line.lineNumber, 'number');
      assert.equal(typeof line.text, 'string');
      lineNums.add(line.lineNumber);
    }
    assert.ok(Array.isArray(c.vulnerableLineNumbers) && c.vulnerableLineNumbers.length >= 1);
    for (const vn of c.vulnerableLineNumbers) {
      assert.ok(lineNums.has(vn), `${c.id}.vulnerableLineNumbers references missing line ${vn}`);
    }
    assert.ok(Array.isArray(c.mitigationOptions) && c.mitigationOptions.length === 3);
    const mitIds = new Set(c.mitigationOptions.map((m) => m.id));
    assert.equal(mitIds.size, 3);
    assert.ok(mitIds.has(c.correctMitigationId), `${c.id}.correctMitigationId missing`);
    assert.ok(ALLOWED_PENALTIES.has(c.exposureDelta), `${c.id}.exposureDelta invalid`);
    for (const outcome of ['correct', 'wrongLine', 'wrongMitigation']) {
      assertFeedbackBlock(c.feedbackByOutcome?.[outcome], `${c.id}.feedbackByOutcome.${outcome}`);
    }
    assert.ok(glossaryIds.has(c.glossaryTermId), `${c.id}.glossaryTermId unknown`);
    assertHttpsRef(c.owaspRef, `${c.id}.owaspRef`);
  }

  // Level 4 schema
  assert.equal(n4.level, 4);
  assertNonEmptyString(n4.title, 'nivel-4.title');
  assert.deepEqual(n4.objectiveIds, OBJECTIVES);
  assert.deepEqual(n4.phases, LEVEL4_PHASES);
  assert.ok(n4.nodes && typeof n4.nodes === 'object');
  assert.ok(Object.hasOwn(n4.nodes, n4.startNodeId), 'startNodeId missing from nodes');
  for (const [key, node] of Object.entries(n4.nodes)) {
    assert.equal(node.id, key, `Node key ${key} must match node.id`);
    assert.ok(LEVEL4_PHASES.includes(node.phase), `${key}.phase invalid`);
    assertNonEmptyString(node.title, `${key}.title`);
    assertNonEmptyString(node.scenario, `${key}.scenario`);
    if (node.isTerminal) {
      assert.equal(node.scorable, false, `Terminal node ${key} must have scorable: false`);
      assert.ok(['success', 'observations'].includes(node.outcomeType), `${key}.outcomeType invalid`);
      assert.equal(node.options, undefined, `Terminal node ${key} should not define options`);
    } else {
      assert.equal(node.scorable, true, `Non-terminal node ${key} must have scorable: true`);
      assert.ok(Array.isArray(node.options) && node.options.length === 3, `${key} must have 3 options`);
      let correctCount = 0;
      const optIds = new Set();
      for (const opt of node.options) {
        assertNonEmptyString(opt.id, `${key}.opt.id`);
        optIds.add(opt.id);
        assert.ok(OBJECTIVES.includes(opt.objectiveId), `${key}.${opt.id}.objectiveId invalid`);
        assertNonEmptyString(opt.label, `${key}.${opt.id}.label`);
        assert.equal(typeof opt.isCorrect, 'boolean');
        if (opt.isCorrect) {
          correctCount++;
          assert.equal(opt.exposureDelta, 0, `${key}.${opt.id} correct option must have exposureDelta 0`);
        } else {
          assert.ok(ALLOWED_PENALTIES.has(opt.exposureDelta), `${key}.${opt.id}.exposureDelta invalid`);
        }
        assert.ok(Object.hasOwn(n4.nodes, opt.nextNodeId), `${key}.${opt.id}.nextNodeId invalid: ${opt.nextNodeId}`);
        assertFeedbackBlock(opt.feedback, `${key}.${opt.id}.feedback`);
        assert.ok(glossaryIds.has(opt.glossaryTermId), `${key}.${opt.id}.glossaryTermId unknown`);
        assertHttpsRef(opt.owaspRef, `${key}.${opt.id}.owaspRef`);
      }
      assert.equal(optIds.size, 3, `${key} duplicate option ids`);
      assert.equal(correctCount, 1, `${key} must have exactly 1 correct option`);
    }
  }
});

test('Global ID uniqueness & bidirectional glossary <-> challenge cross-references', async () => {
  const glossary = await loadJson('data/glossary.json');
  const quizPre = await loadJson('data/quiz-pre.json');
  const quizPost = await loadJson('data/quiz-post.json');
  const levels = {
    1: await loadJson('data/levels/nivel-1.json'),
    2: await loadJson('data/levels/nivel-2.json'),
    3: await loadJson('data/levels/nivel-3.json'),
    4: await loadJson('data/levels/nivel-4.json')
  };

  const globalIds = new Set();
  const addUnique = (id, source) => {
    assert.ok(!globalIds.has(id), `Duplicate global ID "${id}" at ${source}`);
    globalIds.add(id);
  };

  glossary.terms.forEach((t) => addUnique(t.id, 'glossary'));
  quizPre.questions.forEach((q) => addUnique(q.id, 'quiz-pre'));
  quizPost.questions.forEach((q) => addUnique(q.id, 'quiz-post'));
  for (const lvl of [1, 2, 3]) {
    levels[lvl].challenges.forEach((c) => addUnique(c.id, `nivel-${lvl}`));
  }
  Object.keys(levels[4].nodes).forEach((id) => addUnique(id, 'nivel-4'));

  const challengeIdsByLevel = {
    1: new Set(levels[1].challenges.map((c) => c.id)),
    2: new Set(levels[2].challenges.map((c) => c.id)),
    3: new Set(levels[3].challenges.map((c) => c.id)),
    4: new Set(Object.keys(levels[4].nodes))
  };

  for (const term of glossary.terms) {
    assert.ok(
      challengeIdsByLevel[term.relatedLevel].has(term.relatedChallengeId),
      `Glossary "${term.id}" relatedChallengeId "${term.relatedChallengeId}" not found in nivel-${term.relatedLevel}`
    );
  }
});

test('Quizzes cover O1-O5 once each and are distinct non-memorizable forms', async () => {
  const quizPre = await loadJson('data/quiz-pre.json');
  const quizPost = await loadJson('data/quiz-post.json');

  const preObjectives = quizPre.questions.map((q) => q.objectiveId);
  const postObjectives = quizPost.questions.map((q) => q.objectiveId);

  assert.equal(new Set(preObjectives).size, 5);
  assert.equal(new Set(postObjectives).size, 5);
  for (const obj of OBJECTIVES) {
    assert.ok(preObjectives.includes(obj), `quiz-pre missing ${obj}`);
    assert.ok(postObjectives.includes(obj), `quiz-post missing ${obj}`);
  }
  assert.notDeepEqual(preObjectives, postObjectives, 'Pre and Post objective ordering must differ');

  const preByObj = new Map(quizPre.questions.map((q) => [q.objectiveId, q]));
  const postByObj = new Map(quizPost.questions.map((q) => [q.objectiveId, q]));
  for (const obj of OBJECTIVES) {
    const preQ = preByObj.get(obj);
    const postQ = postByObj.get(obj);
    assert.notEqual(preQ.prompt.trim(), postQ.prompt.trim(), `${obj} prompt identical in pre and post`);
    assert.notEqual(
      preQ.correctOptionId,
      postQ.correctOptionId,
      `${obj} correctOptionId must vary between pre and post`
    );
    const preLabels = preQ.options.map((o) => o.label.trim());
    const postLabels = postQ.options.map((o) => o.label.trim());
    assert.notDeepEqual(preLabels, postLabels, `${obj} option labels identical in pre and post`);
  }

  // Varied correctOptionId positions across each 5-question quiz
  assert.ok(new Set(quizPre.questions.map((q) => q.correctOptionId)).size >= 3);
  assert.ok(new Set(quizPost.questions.map((q) => q.correctOptionId)).size >= 3);
});

function isCorrectStrictlyLongest(options, isCorrectFn) {
  let correctLen = -1;
  let maxOtherLen = -1;
  for (const opt of options) {
    const len = opt.label.length;
    if (isCorrectFn(opt)) {
      correctLen = len;
    } else if (len > maxOtherLen) {
      maxOtherLen = len;
    }
  }
  return correctLen > maxOtherLen;
}

test('Option position & length-cue anti-bias checks across quizzes, Level 3, and Level 4', async () => {
  const quizPre = await loadJson('data/quiz-pre.json');
  const quizPost = await loadJson('data/quiz-post.json');
  const n3 = await loadJson('data/levels/nivel-3.json');
  const n4 = await loadJson('data/levels/nivel-4.json');

  // Level 3: correctMitigationId must be distributed across indices 0, 1, and 2
  const n3Indices = n3.challenges.map((c) =>
    c.mitigationOptions.findIndex((m) => m.id === c.correctMitigationId)
  );
  assert.ok(
    new Set(n3Indices).size >= 3,
    `nivel-3 correctMitigationId indices (${n3Indices.join(', ')}) must cover all 3 positions`
  );

  // Correct option must not be strictly the longest in 100% (or > 50%) of items in each file
  const groups = [
    {
      name: 'quiz-pre.json',
      items: quizPre.questions.map((q) => ({
        id: q.id,
        options: q.options,
        isCorrect: (o) => o.id === q.correctOptionId
      }))
    },
    {
      name: 'quiz-post.json',
      items: quizPost.questions.map((q) => ({
        id: q.id,
        options: q.options,
        isCorrect: (o) => o.id === q.correctOptionId
      }))
    },
    {
      name: 'nivel-3.json',
      items: n3.challenges.map((c) => ({
        id: c.id,
        options: c.mitigationOptions,
        isCorrect: (o) => o.id === c.correctMitigationId
      }))
    },
    {
      name: 'nivel-4.json',
      items: Object.values(n4.nodes)
        .filter((node) => !node.isTerminal)
        .map((node) => ({
          id: node.id,
          options: node.options,
          isCorrect: (o) => o.isCorrect === true
        }))
    }
  ];

  for (const group of groups) {
    const longestCount = group.items.filter((item) =>
      isCorrectStrictlyLongest(item.options, item.isCorrect)
    ).length;
    assert.ok(
      longestCount < group.items.length,
      `${group.name}: correct option is strictly longest in all ${group.items.length} items`
    );
    assert.ok(
      longestCount / group.items.length <= 0.5,
      `${group.name}: correct option is strictly longest in ${longestCount}/${group.items.length} (> 50%) items`
    );
  }
});

test('Level 4 DAG reachability, 3-color DFS acyclicity, pre-closure branch, and >=100 maxWrongExposure', async () => {
  const n1 = await loadJson('data/levels/nivel-1.json');
  const n2 = await loadJson('data/levels/nivel-2.json');
  const n3 = await loadJson('data/levels/nivel-3.json');
  const n4 = await loadJson('data/levels/nivel-4.json');

  // Max wrong exposure >= 100 for Levels 1-3
  for (const [lvl, data] of [[1, n1], [2, n2], [3, n3]]) {
    const totalWrong = data.challenges.reduce((acc, c) => acc + c.exposureDelta, 0);
    assert.ok(totalWrong >= 100, `nivel-${lvl} total wrong exposure (${totalWrong}) must be >= 100`);
  }

  const nodes = n4.nodes;
  const allNodeIds = Object.keys(nodes);

  // BFS reachability
  const visited = new Set();
  const queue = [n4.startNodeId];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    const node = nodes[curr];
    if (!node.isTerminal) {
      for (const opt of node.options) {
        queue.push(opt.nextNodeId);
      }
    }
  }
  assert.equal(visited.size, allNodeIds.length, 'Level 4 has unreachable orphan nodes');

  // 3-color DFS cycle detection (0=unvisited, 1=visiting, 2=done)
  const color = new Map(allNodeIds.map((id) => [id, 0]));
  function dfsCycle(nodeId) {
    color.set(nodeId, 1);
    const node = nodes[nodeId];
    if (!node.isTerminal) {
      for (const opt of node.options) {
        const next = opt.nextNodeId;
        assert.notEqual(color.get(next), 1, `Cycle detected at edge ${nodeId} -> ${next}`);
        if (color.get(next) === 0) dfsCycle(next);
      }
    }
    color.set(nodeId, 2);
  }
  dfsCycle(n4.startNodeId);

  // Verify terminals, phases, objectives, pre-closure correction branch, and min-path maxWrongExposure >= 100
  const reachedTerminals = new Set();
  const coveredPhases = new Set();
  const coveredObjectives = new Set();
  let hasPreClosureCorrectionBranch = false;

  for (const node of Object.values(nodes)) {
    coveredPhases.add(node.phase);
    if (node.isTerminal) {
      reachedTerminals.add(node.outcomeType);
    } else {
      const correctTargets = new Set();
      const wrongNonTerminalTargets = new Set();
      for (const opt of node.options) {
        coveredObjectives.add(opt.objectiveId);
        const targetNode = nodes[opt.nextNodeId];
        if (opt.isCorrect) {
          correctTargets.add(opt.nextNodeId);
        } else if (!targetNode.isTerminal) {
          wrongNonTerminalTargets.add(opt.nextNodeId);
        }
      }
      for (const wt of wrongNonTerminalTargets) {
        if (!correctTargets.has(wt)) {
          hasPreClosureCorrectionBranch = true;
        }
      }
    }
  }

  assert.ok(reachedTerminals.has('success') && reachedTerminals.has('observations'), 'Both success and observations terminals must exist');
  assert.equal(coveredPhases.size, 6, 'All 6 phases must be present');
  assert.equal(coveredObjectives.size, 5, 'All 5 objectives O1-O5 must be covered in Level 4');
  assert.ok(hasPreClosureCorrectionBranch, 'Level 4 must include a pre-closure correction branch on wrong choice');

  // Enumerate all root-to-terminal edge paths: verify each covers all 6 phases and each route/terminal can accumulate >= 100 actual wrong exposure
  const maxWrongByRoute = new Map();
  const maxWrongByTerminal = new Map();
  function checkPaths(nodeId, phasesSeen, nodeRoute, actualWrongSum) {
    const node = nodes[nodeId];
    const nextPhases = new Set(phasesSeen);
    nextPhases.add(node.phase);
    const nextRoute = [...nodeRoute, nodeId];
    if (node.isTerminal) {
      assert.equal(nextPhases.size, 6, `Path ending at ${nodeId} did not cover all 6 phases`);
      const routeKey = nextRoute.join(' -> ');
      maxWrongByRoute.set(routeKey, Math.max(maxWrongByRoute.get(routeKey) ?? 0, actualWrongSum));
      maxWrongByTerminal.set(nodeId, Math.max(maxWrongByTerminal.get(nodeId) ?? 0, actualWrongSum));
      return;
    }
    for (const opt of node.options) {
      const edgeWrong = opt.isCorrect ? 0 : opt.exposureDelta;
      checkPaths(opt.nextNodeId, nextPhases, nextRoute, actualWrongSum + edgeWrong);
    }
  }
  checkPaths(n4.startNodeId, new Set(), [], 0);

  assert.ok(maxWrongByRoute.size >= 2, 'Level 4 must have at least 2 distinct structural routes');
  for (const [routeKey, maxWrong] of maxWrongByRoute.entries()) {
    assert.ok(
      maxWrong >= 100,
      `Structural route "${routeKey}" has max actual wrong exposure ${maxWrong} < 100`
    );
  }
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.isTerminal) {
      const maxWrong = maxWrongByTerminal.get(nodeId) ?? 0;
      assert.ok(
        maxWrong >= 100,
        `Terminal node "${nodeId}" max actual wrong exposure (${maxWrong}) must be >= 100`
      );
    }
  }
});

test('Security hygiene: zero real secrets, Luhn PANs, numeric CVVs, XSS/HTML, or non-example URLs', async () => {
  const files = [
    'data/glossary.json',
    'data/quiz-pre.json',
    'data/quiz-post.json',
    'data/levels/nivel-1.json',
    'data/levels/nivel-2.json',
    'data/levels/nivel-3.json',
    'data/levels/nivel-4.json'
  ];

  const secretPatterns = [
    /\bsk_(live|test)_[A-Za-z0-9]{12,}/,
    /\bpk_(live|test)_[A-Za-z0-9]{12,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bghp_[A-Za-z0-9]{20,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/
  ];

  for (const file of files) {
    const data = await loadJson(file);
    const strings = collectStrings(data);
    for (const { path, value } of strings) {
      // No HTML tags, inline event handlers, or unsafe javascript:/data:text/html URIs
      assert.ok(!/<\/?[a-z][^>]*>/i.test(value), `HTML tag found in ${file} at ${path}: ${value}`);
      assert.ok(
        !/\bon(click|load|error|mouseover|focus|submit)\s*=/i.test(value),
        `Inline event handler found in ${file} at ${path}`
      );
      assert.ok(
        !/(?:javascript\s*:|data\s*:\s*text\/html)/i.test(value),
        `Unsafe URI scheme found in ${file} at ${path}: ${value}`
      );

      // No secret patterns
      for (const re of secretPatterns) {
        assert.ok(!re.test(value), `Secret-like pattern (${re}) found in ${file} at ${path}`);
      }

      // No 13-19 digit PAN sequences (space, hyphen, or dot separated, especially Luhn-valid)
      const panCandidates = value.match(/(?:\d[\s.-]*){13,19}/g) || [];
      for (const candidate of panCandidates) {
        const digits = candidate.replace(/\D/g, '');
        if (digits.length >= 13 && digits.length <= 19) {
          assert.fail(`Numeric PAN-like sequence (${digits.length} digits) in ${file} at ${path}: ${passesLuhn(digits)}`);
        }
      }

      // URL check: every http/https URL must be .example or approved reference host
      const urls = value.match(/https?:\/\/[^\s"'`<>)]+/g) || [];
      for (const rawUrl of urls) {
        const parsed = new URL(rawUrl);
        const isExample = parsed.hostname === 'example' || parsed.hostname.endsWith('.example');
        const isApprovedRef = parsed.protocol === 'https:' && ALLOWED_REFERENCE_HOSTS.has(parsed.hostname);
        assert.ok(
          isExample || isApprovedRef,
          `Unapproved URL "${rawUrl}" in ${file} at ${path}`
        );
      }
    }
  }

  // Verify CVV challenge does not contain a numeric 3-4 digit CVV literal
  const n2 = await loadJson('data/levels/nivel-2.json');
  const cvvChallenge = n2.challenges.find((c) => c.id === 'n2-r7');
  assert.ok(cvvChallenge, 'n2-r7 missing');
  assert.ok(!/\b\d{3,4}\b/.test(cvvChallenge.recordLabel), 'n2-r7.recordLabel must not contain numeric CVV');
});

test('Mandatory OWASP A04:2025 & PCI DSS technical accuracy rules are present', async () => {
  const n1 = await loadJson('data/levels/nivel-1.json');
  const n2 = await loadJson('data/levels/nivel-2.json');
  const n3 = await loadJson('data/levels/nivel-3.json');

  const n1r3 = JSON.stringify(n1.challenges.find((c) => c.id === 'n1-r3'));
  assert.match(n1r3, /preload/i);
  assert.match(n1r3, /no demuestra|no prueba/i);

  const n1r4 = JSON.stringify(n1.challenges.find((c) => c.id === 'n1-r4'));
  assert.match(n1r4, /autofirmado/i);
  assert.match(n1r4, /cadena de confianza/i);

  const n2r5 = JSON.stringify(n2.challenges.find((c) => c.id === 'n2-r5'));
  assert.match(n2r5, /nonce/i);

  const n2r6 = JSON.stringify(n2.challenges.find((c) => c.id === 'n2-r6'));
  assert.match(n2r6, /PCI DSS/i);
  assert.match(n2r6, /PAN y CVV/i);

  const n2r7 = JSON.stringify(n2.challenges.find((c) => c.id === 'n2-r7'));
  assert.match(n2r7, /incluso cifrado/i);

  const n3r1 = JSON.stringify(n3.challenges.find((c) => c.id === 'n3-r1'));
  assert.match(n3r1, /variable de entorno/i);
  assert.match(n3r1, /gestor/i);

  const n3r6 = JSON.stringify(n3.challenges.find((c) => c.id === 'n3-r6'));
  assert.match(n3r6, /PKCS#1 v1\.5/i);
  assert.match(n3r6, /RSA-OAEP/i);
});
