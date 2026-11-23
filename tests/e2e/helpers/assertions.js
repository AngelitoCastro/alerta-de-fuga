import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_ROOT } from './staticServer.js';

export const REQUIRED_GLOSSARY_IDS = [
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
  'minimizacion-datos',
];

// Paleta aprobada Tropical Cybercrime Thriller (plan_integracion_diseno_stitch_alerta_de_fuga.md §3)
export const REQUIRED_PALETTE_TOKENS = {
  bg: '#160D2D',
  surface: '#231A3A',
  surfaceRaised: '#2D2545',
  text: '#E9DDFF',
  textMuted: '#E4BDC2',
  pink: '#FF3377',
  coral: '#FF6B35',
  gold: '#FFC107',
  lavender: '#B070D6',
  cream: '#FCF6EE',
};

export const ACCENT_FILL_TOKENS = ['#FF3377', '#FF6B35', '#FFC107', '#34D399', '#FF5C8A', '#FFB2BF'];
export const ON_ACCENT_TOKEN = '#110828';

export const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
];

export const REQUIRED_LEVEL4_PHASES = [
  'Detección',
  'Contención',
  'Evaluación',
  'Protección',
  'Recuperación',
  'Cierre',
];

export const OBJECTIVES = ['O1', 'O2', 'O3', 'O4', 'O5'];

/**
 * Reads an application file relative to PROJECT_ROOT.
 * Throws a clear AssertionError('[MISSING_TARGET] ...') when not yet created.
 * @param {string} relPath
 * @returns {Promise<string>}
 */
export async function requireAppFile(relPath) {
  const absPath = path.resolve(PROJECT_ROOT, relPath);
  try {
    return await fs.readFile(absPath, 'utf8');
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      throw new assert.AssertionError({
        message: `[MISSING_TARGET] ${relPath} does not exist yet at ${absPath}`,
        operator: 'requireAppFile',
      });
    }
    throw err;
  }
}

export async function appFileExists(relPath) {
  const absPath = path.resolve(PROJECT_ROOT, relPath);
  try {
    const stat = await fs.stat(absPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Dynamically imports an app ES module inside a test block for progressive testability.
 * @param {string} relPath
 * @param {{ fresh?: boolean }} [options]
 */
export async function importAppModule(relPath, options = {}) {
  await requireAppFile(relPath);
  const absPath = path.resolve(PROJECT_ROOT, relPath);
  const url = pathToFileURL(absPath).href;
  if (options.fresh) {
    return import(`${url}?bust=${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }
  return import(url);
}

/**
 * Lists relative file paths under a project directory, returning [] if absent.
 * @param {string} dirRel
 * @param {string} [extFilter]
 * @returns {Promise<string[]>}
 */
export async function listProjectFiles(dirRel, extFilter = '') {
  const startAbs = path.resolve(PROJECT_ROOT, dirRel);
  const results = [];

  async function walk(curAbs) {
    let entries;
    try {
      entries = await fs.readdir(curAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(curAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        if (!extFilter || entry.name.endsWith(extFilter)) {
          results.push(path.relative(PROJECT_ROOT, full).replace(/\\/g, '/'));
        }
      }
    }
  }

  await walk(startAbs);
  return results.sort();
}

export async function fetchHttp(baseUrl, pathname) {
  const url = new URL(pathname, `${baseUrl}/`).href;
  const response = await fetch(url);
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    json() {
      return JSON.parse(text);
    },
  };
}

export async function fetchAppJson(baseUrl, pathname) {
  const rel = pathname.replace(/^\/+/, '');
  await requireAppFile(rel);
  const res = await fetchHttp(baseUrl, pathname);
  assert.equal(res.status, 200, `Expected HTTP 200 for ${pathname}, got ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  assert.match(ct, /application\/json/i, `Expected application/json for ${pathname}, got ${ct}`);
  return JSON.parse(res.text);
}

// --- WCAG 2.2 AA Contrast Utilities ---

export function hexToRgb(hex) {
  const clean = String(hex).trim().replace(/^#/, '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Secret & Real PAN/CVV Scanners ---

export function luhnCheck(digits) {
  const clean = String(digits).replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let digit = Number(clean[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function findLuhnPanCandidates(text) {
  const matches = [];
  // Match 13-19 digit card-like sequences separated by optional spaces or dashes
  const regex = /\b(?:\d[ -]?){13,19}\b/g;
  let m;
  while ((m = regex.exec(String(text || ''))) !== null) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) continue;
    // Check common real IIN prefixes (Visa 4, MC 51-55 / 2221-2720, Amex 34/37, Discover 6011/65)
    const isCardPrefix =
      digits.startsWith('4') ||
      /^5[1-5]/.test(digits) ||
      /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(digits) ||
      /^3[47]/.test(digits) ||
      /^(6011|65)/.test(digits);
    if (!isCardPrefix) continue;
    // Ignore obvious all-same-digit placeholders like 4444444444444444 if not Luhn, or check Luhn
    if (luhnCheck(digits)) {
      matches.push(raw.trim());
    }
  }
  return matches;
}

export function findSecretPatterns(text) {
  const str = String(text || '');
  const findings = [];
  const rules = [
    { name: 'AWS Access Key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { name: 'Stripe Live Key', regex: /\b(?:sk|rk)_live_[0-9a-zA-Z]{16,}\b/g },
    { name: 'GitHub PAT', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{20,}\b/g },
    { name: 'GitHub Fine-Grained PAT', regex: /\bgithub_pat_[0-9A-Za-z_]{20,}\b/g },
    { name: 'Slack Token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
    { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
    { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
    { name: 'JWT Token', regex: /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g },
  ];
  for (const rule of rules) {
    const m = str.match(rule.regex);
    if (m) {
      findings.push({ rule: rule.name, samples: m });
    }
  }
  return findings;
}

export function assertNoSecretsOrRealPans(text, contextLabel) {
  const secrets = findSecretPatterns(text);
  assert.equal(
    secrets.length,
    0,
    `${contextLabel}: found forbidden secret pattern(s): ${JSON.stringify(secrets)}`,
  );
  const pans = findLuhnPanCandidates(text);
  assert.equal(
    pans.length,
    0,
    `${contextLabel}: found Luhn-valid card PAN candidate(s): ${JSON.stringify(pans)}`,
  );
}

// --- Static CSP & XSS Compliance Scanners ---

export function scanHtmlForCspViolations(html, label = 'index.html') {
  const issues = [];
  const str = String(html || '');

  // Inline <script> without src or with non-whitespace body
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRegex.exec(str)) !== null) {
    const attrs = m[1] || '';
    const body = (m[2] || '').trim();
    if (!/\bsrc\s*=/.test(attrs) || body.length > 0) {
      issues.push(`${label}: inline <script> detected`);
    }
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch && /^(https?:)?\/\//i.test(srcMatch[1])) {
      issues.push(`${label}: external <script src="${srcMatch[1]}"> detected`);
    }
  }

  if (/<style\b/i.test(str)) {
    issues.push(`${label}: inline <style> tag detected`);
  }
  if (/\sstyle\s*=\s*["']/i.test(str)) {
    issues.push(`${label}: inline style="..." attribute detected`);
  }
  if (/\son[a-z]+\s*=/i.test(str)) {
    issues.push(`${label}: inline on*= event handler detected`);
  }
  if (/javascript:/i.test(str)) {
    issues.push(`${label}: javascript: URI detected`);
  }

  const linkRegex = /<link\b([^>]*)>/gi;
  while ((m = linkRegex.exec(str)) !== null) {
    const hrefMatch = m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch && /^(https?:)?\/\//i.test(hrefMatch[1])) {
      issues.push(`${label}: external <link href="${hrefMatch[1]}"> detected`);
    }
  }

  return issues;
}

export function scanJsForSecurityViolations(jsCode, label = 'module.js') {
  const issues = [];
  const str = String(jsCode || '');

  if (/\beval\s*\(/.test(str)) issues.push(`${label}: eval() detected`);
  if (/\bnew\s+Function\b/.test(str)) issues.push(`${label}: new Function() detected`);
  if (/\bdocument\.write\s*\(/.test(str)) issues.push(`${label}: document.write() detected`);
  if (/\.insertAdjacentHTML\s*\(/.test(str)) issues.push(`${label}: insertAdjacentHTML() detected`);
  if (/\.outerHTML\s*=/.test(str)) issues.push(`${label}: outerHTML assignment detected`);
  if (/\.innerHTML\s*=\s*(?!(['"`]{2}|['"`]\s*['"`]))/.test(str)) {
    issues.push(`${label}: non-empty innerHTML assignment detected`);
  }
  if (/\b(?:setTimeout|setInterval)\s*\(\s*['"`]/.test(str)) {
    issues.push(`${label}: string-argument timer execution detected`);
  }
  if (/setAttribute\s*\(\s*['"`]style['"`]/i.test(str)) {
    issues.push(`${label}: setAttribute('style', ...) violates strict style-src 'self'`);
  }
  if (/setAttribute\s*\(\s*['"`]on[a-z]+['"`]/i.test(str)) {
    issues.push(`${label}: setAttribute('on...', ...) inline handler detected`);
  }
  if (/\bfetch\s*\(\s*['"`]https?:\/\//i.test(str)) {
    issues.push(`${label}: hardcoded external fetch(http/https) detected`);
  }

  return issues;
}

export function scanCssForViolations(cssCode, label = 'style.css') {
  const issues = [];
  const str = String(cssCode || '');
  if (/@import\s+(?:url\s*\()?\s*['"]?https?:\/\//i.test(str)) {
    issues.push(`${label}: external @import URL detected`);
  }
  if (/url\(\s*['"]?https?:\/\//i.test(str)) {
    issues.push(`${label}: external url(http/https) detected`);
  }
  return issues;
}

// --- Level 4 DAG & Graph Analyzer ---

export function analyzeLevel4Graph(levelData) {
  const nodes = levelData?.nodes || {};
  const startNodeId = levelData?.startNodeId;
  const nodeIds = Object.keys(nodes);
  const reachable = new Set();
  const danglingEdges = [];
  const nonTerminalsWithWrongOptionCount = [];
  const terminals = [];

  if (startNodeId && nodes[startNodeId]) {
    const queue = [startNodeId];
    reachable.add(startNodeId);
    while (queue.length > 0) {
      const id = queue.shift();
      const node = nodes[id];
      if (node.isTerminal) {
        terminals.push(id);
        continue;
      }
      const opts = Array.isArray(node.options) ? node.options : [];
      if (opts.length !== 3) {
        nonTerminalsWithWrongOptionCount.push({ id, count: opts.length });
      }
      for (const opt of opts) {
        if (!nodes[opt.nextNodeId]) {
          danglingEdges.push({ from: id, optionId: opt.id, nextNodeId: opt.nextNodeId });
        } else if (!reachable.has(opt.nextNodeId)) {
          reachable.add(opt.nextNodeId);
          queue.push(opt.nextNodeId);
        }
      }
    }
  }

  const unreachableNodes = nodeIds.filter((id) => !reachable.has(id));

  // Cycle detection via 3-color DFS from startNodeId
  const color = new Map(); // 0/undefined=unvisited, 1=visiting, 2=visited
  const cycles = [];
  function dfsCycle(nodeId, stack) {
    color.set(nodeId, 1);
    const node = nodes[nodeId];
    if (node && !node.isTerminal && Array.isArray(node.options)) {
      for (const opt of node.options) {
        const next = opt.nextNodeId;
        if (!nodes[next]) continue;
        if (color.get(next) === 1) {
          cycles.push([...stack, next]);
        } else if (!color.get(next)) {
          dfsCycle(next, [...stack, next]);
        }
      }
    }
    color.set(nodeId, 2);
  }
  if (startNodeId && nodes[startNodeId]) {
    dfsCycle(startNodeId, [startNodeId]);
  }

  // Enumerate simple paths up to depth 20
  const simplePaths = [];
  function enumPaths(nodeId, pathSoFar, choices) {
    if (pathSoFar.length > 20) return;
    const node = nodes[nodeId];
    if (!node) return;
    if (node.isTerminal) {
      simplePaths.push({
        nodes: pathSoFar,
        choices,
        terminalId: nodeId,
        outcomeType: node.outcomeType || 'success',
      });
      return;
    }
    for (const opt of node.options || []) {
      if (!pathSoFar.includes(opt.nextNodeId) && nodes[opt.nextNodeId]) {
        enumPaths(opt.nextNodeId, [...pathSoFar, opt.nextNodeId], [...choices, { nodeId, option: opt }]);
      }
    }
  }
  if (startNodeId && nodes[startNodeId]) {
    enumPaths(startNodeId, [startNodeId], []);
  }

  return {
    reachableNodes: [...reachable],
    unreachableNodes,
    danglingEdges,
    cycles,
    terminals,
    nonTerminalsWithWrongOptionCount,
    simplePaths,
  };
}

// --- Opaque-Box UI Helpers for Minigame DOM Testing ---

export function normalizeText(str) {
  return String(str || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function findButtons(container) {
  return container.querySelectorAll('button, [role="button"]');
}

export function findControlByText(container, text) {
  const target = normalizeText(text);
  const candidates = container.querySelectorAll('button, [role="button"], label, input[type="radio"], input[type="checkbox"]');
  for (const el of candidates) {
    const label = normalizeText(el.textContent || el.getAttribute('aria-label') || el.value || '');
    if (label && (label === target || label.includes(target))) {
      return el;
    }
  }
  return null;
}

export function collectText(node) {
  return normalizeText(node?.textContent || '');
}
