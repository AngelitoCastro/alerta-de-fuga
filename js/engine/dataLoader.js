export const REQUIRED_GLOSSARY_IDS = Object.freeze([
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
]);

export const VALID_OBJECTIVES = Object.freeze(['O1', 'O2', 'O3', 'O4', 'O5']);

export const LEVEL_4_PHASES = Object.freeze([
  'Detección',
  'Contención',
  'Evaluación',
  'Protección',
  'Recuperación',
  'Cierre'
]);

const OBJECTIVE_SET = new Set(VALID_OBJECTIVES);
const PHASE_SET = new Set(LEVEL_4_PHASES);
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const LOCAL_ASSET_REGEX = /^(?:\.\/)?assets\/[a-zA-Z0-9._-]+\.(?:svg|png|webp)$/;

export class DataLoadError extends Error {
  constructor(message, { code = 'DATA_LOAD_ERROR', status = null, path = null, cause = undefined } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'DataLoadError';
    this.code = code;
    this.status = status;
    this.path = path;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeJsonReviver(key, value) {
  if (POLLUTION_KEYS.has(key)) {
    return undefined;
  }
  return value;
}

function isSafeHttpsUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeLocalAssetPath(value) {
  if (typeof value !== 'string' || value.includes('..')) {
    return false;
  }
  return LOCAL_ASSET_REGEX.test(value);
}

function validationError(message, path = null) {
  return new DataLoadError(message, { code: 'VALIDATION_ERROR', path });
}

function validateFeedbackBlock(feedback, contextLabel) {
  if (!isPlainObject(feedback)) {
    throw validationError(`Falta el bloque de retroalimentación en ${contextLabel}.`);
  }
  if (
    !isNonEmptyString(feedback.attackerView) ||
    !isNonEmptyString(feedback.why) ||
    !isNonEmptyString(feedback.correctControl)
  ) {
    throw validationError(`La retroalimentación en ${contextLabel} debe incluir attackerView, why y correctControl.`);
  }
}

function validateOptionList(options, contextLabel, minLength = 2) {
  if (!Array.isArray(options) || options.length < minLength) {
    throw validationError(`Las opciones de ${contextLabel} deben ser al menos ${minLength}.`);
  }
  const ids = new Set();
  for (const option of options) {
    if (!isPlainObject(option) || !isNonEmptyString(option.id) || !isNonEmptyString(option.label)) {
      throw validationError(`Cada opción de ${contextLabel} debe tener id y label válidos.`);
    }
    if (ids.has(option.id)) {
      throw validationError(`Existen opciones con identificador duplicado (${option.id}) en ${contextLabel}.`);
    }
    ids.add(option.id);
  }
  return ids;
}

export function validateGlossaryData(data) {
  if (!isPlainObject(data) || data.version !== 1 || !Array.isArray(data.terms)) {
    throw validationError('El glosario no tiene la estructura esperada (version 1 y arreglo terms).');
  }
  if (data.terms.length < REQUIRED_GLOSSARY_IDS.length) {
    throw validationError(`El glosario debe incluir al menos ${REQUIRED_GLOSSARY_IDS.length} términos.`);
  }

  const seenIds = new Set();
  for (let i = 0; i < data.terms.length; i += 1) {
    const term = data.terms[i];
    if (!isPlainObject(term)) {
      throw validationError(`El término #${i + 1} del glosario no es un objeto válido.`);
    }
    if (
      !isNonEmptyString(term.id) ||
      !isNonEmptyString(term.term) ||
      !isNonEmptyString(term.definition) ||
      !isNonEmptyString(term.analogy) ||
      !isNonEmptyString(term.analogyLimit) ||
      !isNonEmptyString(term.relatedChallengeId) ||
      !Number.isInteger(term.relatedLevel) ||
      term.relatedLevel < 1 ||
      term.relatedLevel > 4
    ) {
      throw validationError(`El término del glosario "${term.id || `#${i + 1}`}" tiene campos obligatorios incompletos o inválidos.`);
    }
    if (seenIds.has(term.id)) {
      throw validationError(`El identificador del glosario "${term.id}" está duplicado.`);
    }
    seenIds.add(term.id);
  }

  for (const requiredId of REQUIRED_GLOSSARY_IDS) {
    if (!seenIds.has(requiredId)) {
      throw validationError(`Falta el término obligatorio "${requiredId}" en el glosario.`);
    }
  }

  return data;
}

export function validateQuizData(data, expectedType) {
  if (expectedType !== 'pre' && expectedType !== 'post') {
    throw new DataLoadError('Tipo de cuestionario no válido.', { code: 'INVALID_ARGUMENT' });
  }
  if (!isPlainObject(data) || data.version !== 1 || data.type !== expectedType || !Array.isArray(data.questions)) {
    throw validationError(`El cuestionario "${expectedType}" no tiene una estructura válida.`);
  }
  if (data.questions.length !== 5) {
    throw validationError(`El cuestionario "${expectedType}" debe contener exactamente 5 preguntas.`);
  }

  const seenIds = new Set();
  const coveredObjectives = new Set();

  for (let i = 0; i < data.questions.length; i += 1) {
    const q = data.questions[i];
    const label = `pregunta #${i + 1} (${expectedType})`;
    if (!isPlainObject(q)) {
      throw validationError(`La ${label} no es un objeto válido.`);
    }
    if (
      !isNonEmptyString(q.id) ||
      !OBJECTIVE_SET.has(q.objectiveId) ||
      !isNonEmptyString(q.prompt) ||
      !isNonEmptyString(q.explanation) ||
      !isNonEmptyString(q.glossaryTermId) ||
      !isSafeHttpsUrl(q.owaspRef)
    ) {
      throw validationError(`La ${label} contiene campos faltantes o inseguros.`);
    }
    if (seenIds.has(q.id)) {
      throw validationError(`El identificador de pregunta "${q.id}" está duplicado en "${expectedType}".`);
    }
    seenIds.add(q.id);

    if (coveredObjectives.has(q.objectiveId)) {
      throw validationError(`El objetivo "${q.objectiveId}" está repetido en el cuestionario "${expectedType}".`);
    }
    coveredObjectives.add(q.objectiveId);

    const optionIds = validateOptionList(q.options, label, 2);
    if (!isNonEmptyString(q.correctOptionId) || !optionIds.has(q.correctOptionId)) {
      throw validationError(`La respuesta correcta de la ${label} no coincide con ninguna opción.`);
    }
  }

  if (coveredObjectives.size !== VALID_OBJECTIVES.length) {
    throw validationError(`El cuestionario "${expectedType}" debe cubrir exactamente O1 a O5.`);
  }

  return data;
}

function validateObjectiveIdsArray(objectiveIds, levelLabel, requiredObjectives = []) {
  if (!Array.isArray(objectiveIds) || objectiveIds.length === 0) {
    throw validationError(`El ${levelLabel} debe declarar objetivos válidos en objectiveIds.`);
  }
  for (const objId of objectiveIds) {
    if (!OBJECTIVE_SET.has(objId)) {
      throw validationError(`Objetivo no válido ("${objId}") en ${levelLabel}.`);
    }
  }
  for (const req of requiredObjectives) {
    if (!objectiveIds.includes(req)) {
      throw validationError(`El ${levelLabel} debe incluir el objetivo "${req}".`);
    }
  }
}

function validateExposureDelta(value, contextLabel, allowZero = false) {
  const minValid = allowZero ? value >= 0 : value > 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || !minValid || value > 100) {
    throw validationError(`El valor exposureDelta en ${contextLabel} está fuera de rango.`);
  }
}

function validateLevel1(data) {
  validateObjectiveIdsArray(data.objectiveIds, 'Nivel 1', ['O1']);
  if (!Array.isArray(data.challenges) || data.challenges.length !== 6) {
    throw validationError('El Nivel 1 debe contener exactamente 6 retos.');
  }
  const seenIds = new Set();
  for (let i = 0; i < data.challenges.length; i += 1) {
    const c = data.challenges[i];
    const label = `reto #${i + 1} del Nivel 1`;
    if (!isPlainObject(c) || !isNonEmptyString(c.id)) {
      throw validationError(`El ${label} no tiene un identificador válido.`);
    }
    if (seenIds.has(c.id)) {
      throw validationError(`Identificador duplicado "${c.id}" en Nivel 1.`);
    }
    seenIds.add(c.id);

    if (
      !OBJECTIVE_SET.has(c.objectiveId) ||
      c.type !== 'network-inspector' ||
      !isNonEmptyString(c.title) ||
      !isNonEmptyString(c.scenario) ||
      !isNonEmptyString(c.glossaryTermId) ||
      !isSafeHttpsUrl(c.owaspRef)
    ) {
      throw validationError(`El ${label} tiene campos inválidos o referencia OWASP insegura.`);
    }
    validateExposureDelta(c.exposureDelta, label, false);

    const req = c.requestDetails;
    if (
      !isPlainObject(req) ||
      !isNonEmptyString(req.method) ||
      !isNonEmptyString(req.url) ||
      !isNonEmptyString(req.protocol) ||
      !isNonEmptyString(req.tlsVersion) ||
      !isNonEmptyString(req.certificateStatus) ||
      req.headers == null ||
      typeof req.headers !== 'object' ||
      typeof req.payloadPreview !== 'string'
    ) {
      throw validationError(`Los detalles de solicitud en el ${label} son inválidos.`);
    }

    const optionIds = validateOptionList(c.options, label, 2);
    if (!isNonEmptyString(c.correctOptionId) || !optionIds.has(c.correctOptionId)) {
      throw validationError(`La opción correcta del ${label} no existe en options.`);
    }
    if (!isPlainObject(c.feedbackByOption)) {
      throw validationError(`Falta feedbackByOption en el ${label}.`);
    }
    for (const optId of optionIds) {
      validateFeedbackBlock(c.feedbackByOption[optId], `${label} (opción ${optId})`);
    }
  }
  return data;
}

function validateLevel2(data) {
  validateObjectiveIdsArray(data.objectiveIds, 'Nivel 2', ['O2', 'O3', 'O5']);
  if (!Array.isArray(data.buckets) || data.buckets.length !== 4) {
    throw validationError('El Nivel 2 debe contener exactamente 4 contenedores (buckets).');
  }
  const bucketIds = new Set();
  for (const bucket of data.buckets) {
    if (
      !isPlainObject(bucket) ||
      !isNonEmptyString(bucket.id) ||
      !isNonEmptyString(bucket.label) ||
      !isNonEmptyString(bucket.description)
    ) {
      throw validationError('Cada contenedor del Nivel 2 debe incluir id, label y description.');
    }
    if (bucketIds.has(bucket.id)) {
      throw validationError(`Contenedor duplicado "${bucket.id}" en Nivel 2.`);
    }
    bucketIds.add(bucket.id);
  }

  if (!Array.isArray(data.challenges) || data.challenges.length !== 8) {
    throw validationError('El Nivel 2 debe contener exactamente 8 tarjetas de clasificación.');
  }
  const seenIds = new Set();
  for (let i = 0; i < data.challenges.length; i += 1) {
    const c = data.challenges[i];
    const label = `reto #${i + 1} del Nivel 2`;
    if (!isPlainObject(c) || !isNonEmptyString(c.id)) {
      throw validationError(`El ${label} no tiene un identificador válido.`);
    }
    if (seenIds.has(c.id)) {
      throw validationError(`Identificador duplicado "${c.id}" en Nivel 2.`);
    }
    seenIds.add(c.id);

    if (
      !OBJECTIVE_SET.has(c.objectiveId) ||
      c.type !== 'data-classifier' ||
      !isNonEmptyString(c.title) ||
      !isNonEmptyString(c.scenario) ||
      !isNonEmptyString(c.recordLabel) ||
      !isNonEmptyString(c.glossaryTermId) ||
      !isSafeHttpsUrl(c.owaspRef)
    ) {
      throw validationError(`El ${label} tiene campos inválidos o referencia OWASP insegura.`);
    }
    validateExposureDelta(c.exposureDelta, label, false);

    if (c.visualAsset !== undefined && c.visualAsset !== null && !isSafeLocalAssetPath(c.visualAsset)) {
      throw validationError(`La ruta de recurso visual en el ${label} no es segura.`);
    }
    if (!isNonEmptyString(c.correctOptionId) || !bucketIds.has(c.correctOptionId)) {
      throw validationError(`La categoría correcta del ${label} no existe en buckets.`);
    }
    if (!isPlainObject(c.feedbackByOption)) {
      throw validationError(`Falta feedbackByOption en el ${label}.`);
    }
    for (const bucketId of bucketIds) {
      validateFeedbackBlock(c.feedbackByOption[bucketId], `${label} (contenedor ${bucketId})`);
    }
  }
  return data;
}

function validateLevel3(data) {
  validateObjectiveIdsArray(data.objectiveIds, 'Nivel 3', ['O3', 'O4']);
  if (!Array.isArray(data.challenges) || data.challenges.length !== 6) {
    throw validationError('El Nivel 3 debe contener exactamente 6 archivos de auditoría.');
  }
  const seenIds = new Set();
  for (let i = 0; i < data.challenges.length; i += 1) {
    const c = data.challenges[i];
    const label = `reto #${i + 1} del Nivel 3`;
    if (!isPlainObject(c) || !isNonEmptyString(c.id)) {
      throw validationError(`El ${label} no tiene un identificador válido.`);
    }
    if (seenIds.has(c.id)) {
      throw validationError(`Identificador duplicado "${c.id}" en Nivel 3.`);
    }
    seenIds.add(c.id);

    if (
      !OBJECTIVE_SET.has(c.objectiveId) ||
      c.type !== 'code-hunt' ||
      !isNonEmptyString(c.title) ||
      !isNonEmptyString(c.filePath) ||
      !isNonEmptyString(c.scenario) ||
      !isNonEmptyString(c.glossaryTermId) ||
      !isSafeHttpsUrl(c.owaspRef)
    ) {
      throw validationError(`El ${label} tiene campos inválidos o referencia OWASP insegura.`);
    }
    validateExposureDelta(c.exposureDelta, label, false);

    if (!Array.isArray(c.lines) || c.lines.length === 0) {
      throw validationError(`El ${label} debe incluir líneas simuladas.`);
    }
    const lineNumbers = new Set();
    for (const line of c.lines) {
      if (
        !isPlainObject(line) ||
        !Number.isInteger(line.lineNumber) ||
        line.lineNumber < 1 ||
        typeof line.text !== 'string'
      ) {
        throw validationError(`Una línea del ${label} tiene formato inválido.`);
      }
      if (lineNumbers.has(line.lineNumber)) {
        throw validationError(`Número de línea duplicado (${line.lineNumber}) en ${label}.`);
      }
      lineNumbers.add(line.lineNumber);
    }

    if (!Array.isArray(c.vulnerableLineNumbers) || c.vulnerableLineNumbers.length === 0) {
      throw validationError(`El ${label} debe declarar al menos una línea vulnerable.`);
    }
    for (const vulnLine of c.vulnerableLineNumbers) {
      if (!Number.isInteger(vulnLine) || !lineNumbers.has(vulnLine)) {
        throw validationError(`La línea vulnerable ${vulnLine} en ${label} no existe en lines.`);
      }
    }

    const mitigationIds = validateOptionList(c.mitigationOptions, label, 2);
    if (!isNonEmptyString(c.correctMitigationId) || !mitigationIds.has(c.correctMitigationId)) {
      throw validationError(`La mitigación correcta del ${label} no existe en mitigationOptions.`);
    }

    if (!isPlainObject(c.feedbackByOutcome)) {
      throw validationError(`Falta feedbackByOutcome en el ${label}.`);
    }
    validateFeedbackBlock(c.feedbackByOutcome.correct, `${label} (correct)`);
    validateFeedbackBlock(c.feedbackByOutcome.wrongLine, `${label} (wrongLine)`);
    validateFeedbackBlock(c.feedbackByOutcome.wrongMitigation, `${label} (wrongMitigation)`);
  }
  return data;
}

function validateLevel4(data) {
  validateObjectiveIdsArray(data.objectiveIds, 'Nivel 4', VALID_OBJECTIVES);
  if (
    !Array.isArray(data.phases) ||
    data.phases.length !== LEVEL_4_PHASES.length ||
    data.phases.some((phase, idx) => phase !== LEVEL_4_PHASES[idx])
  ) {
    throw validationError('Las fases del Nivel 4 deben coincidir exactamente con las 6 fases establecidas.');
  }
  if (!isPlainObject(data.nodes)) {
    throw validationError('El Nivel 4 debe contener un mapa de nodos válido.');
  }
  const nodeIds = Object.keys(data.nodes);
  if (nodeIds.length === 0 || !isNonEmptyString(data.startNodeId) || !Object.prototype.hasOwnProperty.call(data.nodes, data.startNodeId)) {
    throw validationError('El nodo inicial startNodeId del Nivel 4 no existe en nodes.');
  }

  for (const nodeId of nodeIds) {
    const node = data.nodes[nodeId];
    if (!isPlainObject(node) || node.id !== nodeId) {
      throw validationError(`El nodo "${nodeId}" del Nivel 4 debe coincidir con su clave y ser un objeto.`);
    }
    if (
      !PHASE_SET.has(node.phase) ||
      !isNonEmptyString(node.title) ||
      !isNonEmptyString(node.scenario)
    ) {
      throw validationError(`El nodo "${nodeId}" del Nivel 4 tiene fase, título o escenario inválido.`);
    }

    if (node.isTerminal === true) {
      if (node.outcomeType !== 'success' && node.outcomeType !== 'observations') {
        throw validationError(`El nodo terminal "${nodeId}" debe definir outcomeType "success" u "observations".`);
      }
      if (Array.isArray(node.options) && node.options.length > 0) {
        throw validationError(`El nodo terminal "${nodeId}" no debe tener opciones de salida.`);
      }
    } else {
      if (!Array.isArray(node.options) || node.options.length !== 3) {
        throw validationError(`El nodo no terminal "${nodeId}" debe ofrecer exactamente 3 opciones.`);
      }
      const optIds = new Set();
      for (const option of node.options) {
        const optLabel = `opción "${option?.id}" del nodo "${nodeId}"`;
        if (
          !isPlainObject(option) ||
          !isNonEmptyString(option.id) ||
          !OBJECTIVE_SET.has(option.objectiveId) ||
          !isNonEmptyString(option.label) ||
          typeof option.isCorrect !== 'boolean' ||
          !isNonEmptyString(option.nextNodeId) ||
          !Object.prototype.hasOwnProperty.call(data.nodes, option.nextNodeId) ||
          !isNonEmptyString(option.glossaryTermId) ||
          !isSafeHttpsUrl(option.owaspRef)
        ) {
          throw validationError(`La ${optLabel} contiene campos inválidos o destino inexistente.`);
        }
        if (optIds.has(option.id)) {
          throw validationError(`La opción "${option.id}" está duplicada en el nodo "${nodeId}".`);
        }
        optIds.add(option.id);
        validateExposureDelta(option.exposureDelta, optLabel, true);
        validateFeedbackBlock(option.feedback, optLabel);
      }
    }
  }

  // 3-color DFS from startNodeId: 0 = unvisited, 1 = visiting, 2 = visited.
  const color = new Map();
  const reachablePhases = new Set();
  let successTerminals = 0;

  function dfs(nodeId) {
    const state = color.get(nodeId) ?? 0;
    if (state === 1) {
      throw validationError(`Se detectó un ciclo no permitido que involucra al nodo "${nodeId}" en Nivel 4.`);
    }
    if (state === 2) {
      return;
    }

    color.set(nodeId, 1);
    const node = data.nodes[nodeId];
    reachablePhases.add(node.phase);

    if (node.isTerminal === true) {
      if (node.outcomeType === 'success') {
        successTerminals += 1;
      }
    } else {
      for (const option of node.options) {
        dfs(option.nextNodeId);
      }
    }

    color.set(nodeId, 2);
  }

  dfs(data.startNodeId);

  if (color.size !== nodeIds.length) {
    throw validationError('Existen nodos huérfanos inalcanzables desde startNodeId en el Nivel 4.');
  }
  if (reachablePhases.size !== LEVEL_4_PHASES.length) {
    throw validationError('El grafo del Nivel 4 no cubre las 6 fases requeridas.');
  }
  if (successTerminals < 1) {
    throw validationError('El Nivel 4 debe incluir al menos un nodo terminal exitoso alcanzable.');
  }

  return data;
}

export function validateLevelData(data, expectedLevel) {
  if (!Number.isInteger(expectedLevel) || expectedLevel < 1 || expectedLevel > 4) {
    throw new DataLoadError('Número de nivel no válido.', { code: 'INVALID_ARGUMENT' });
  }
  if (!isPlainObject(data) || data.level !== expectedLevel || !isNonEmptyString(data.title)) {
    throw validationError(`Los datos del Nivel ${expectedLevel} no tienen una cabecera válida.`);
  }
  if (expectedLevel === 1) return validateLevel1(data);
  if (expectedLevel === 2) return validateLevel2(data);
  if (expectedLevel === 3) return validateLevel3(data);
  return validateLevel4(data);
}

export function createDataLoader({ basePath = './data', fetchImpl = globalThis.fetch, cache = false } = {}) {
  const normalizedBase = String(basePath ?? './data').replace(/\/+$/, '') || './data';
  const cacheStore = cache ? new Map() : null;

  async function fetchJson(url, signal) {
    if (cacheStore && cacheStore.has(url)) {
      return structuredClone(cacheStore.get(url));
    }

    if (typeof fetchImpl !== 'function') {
      throw new DataLoadError(
        'No se pudieron cargar los datos porque la función fetch no está disponible.',
        { code: 'NETWORK_ERROR', path: url }
      );
    }

    const init = signal ? { signal } : undefined;
    let response;
    try {
      response = fetchImpl === globalThis.fetch
        ? await globalThis.fetch(url, init)
        : await fetchImpl(url, init);
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      throw new DataLoadError(
        'No se pudieron cargar los datos. Verifica la conexión o usa un servidor HTTP local.',
        { code: 'NETWORK_ERROR', path: url, cause: err }
      );
    }

    if (!response || !response.ok) {
      const status = Number(response?.status) || 0;
      throw new DataLoadError(
        `No se pudo cargar el recurso solicitado (HTTP ${status}).`,
        { code: 'HTTP_ERROR', status, path: url }
      );
    }

    let parsed;
    try {
      if (typeof response.text === 'function') {
        const rawText = await response.text();
        parsed = JSON.parse(rawText, safeJsonReviver);
      } else if (typeof response.json === 'function') {
        const rawJson = await response.json();
        parsed = JSON.parse(JSON.stringify(rawJson), safeJsonReviver);
      } else {
        throw new SyntaxError('La respuesta no expone text() ni json().');
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      throw new DataLoadError(
        'Los datos recibidos no tienen un formato JSON válido.',
        { code: 'PARSE_ERROR', path: url, cause: err }
      );
    }

    return parsed;
  }

  async function loadGlossary(options = {}) {
    const url = `${normalizedBase}/glossary.json`;
    const data = await fetchJson(url, options.signal);
    const validated = validateGlossaryData(data);
    if (cacheStore) {
      cacheStore.set(url, structuredClone(validated));
    }
    return validated;
  }

  async function loadQuiz(type, options = {}) {
    if (type !== 'pre' && type !== 'post') {
      throw new DataLoadError('Tipo de cuestionario no válido.', { code: 'INVALID_ARGUMENT' });
    }
    const url = `${normalizedBase}/quiz-${type}.json`;
    const data = await fetchJson(url, options.signal);
    const validated = validateQuizData(data, type);
    if (cacheStore) {
      cacheStore.set(url, structuredClone(validated));
    }
    return validated;
  }

  async function loadLevel(levelNumber, options = {}) {
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 4) {
      throw new DataLoadError('Número de nivel no válido.', { code: 'INVALID_ARGUMENT' });
    }
    const url = `${normalizedBase}/levels/nivel-${levelNumber}.json`;
    const data = await fetchJson(url, options.signal);
    const validated = validateLevelData(data, levelNumber);
    if (cacheStore) {
      cacheStore.set(url, structuredClone(validated));
    }
    return validated;
  }

  return {
    loadGlossary,
    loadQuiz,
    loadLevel
  };
}

export async function loadGlossary(options = {}) {
  const loader = createDataLoader({
    basePath: options.basePath ?? './data',
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  });
  return loader.loadGlossary(options);
}

export async function loadQuiz(type, options = {}) {
  const loader = createDataLoader({
    basePath: options.basePath ?? './data',
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  });
  return loader.loadQuiz(type, options);
}

export async function loadLevel(levelNumber, options = {}) {
  const loader = createDataLoader({
    basePath: options.basePath ?? './data',
    fetchImpl: options.fetchImpl ?? globalThis.fetch
  });
  return loader.loadLevel(levelNumber, options);
}
