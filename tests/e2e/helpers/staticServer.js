import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '': 'text/plain; charset=utf-8',
};

/**
 * Parses Cloudflare Pages / Netlify `_headers` syntax into structured rules.
 * @param {string} raw
 * @returns {{ rules: Array<{ pattern: string, headers: Record<string, string> }> }}
 */
export function parseHeadersFile(raw) {
  const rules = [];
  let current = null;

  for (const rawLine of String(raw || '').split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!/^\s/.test(rawLine)) {
      current = { pattern: trimmed, headers: {} };
      rules.push(current);
    } else if (current) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const name = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        current.headers[name] = value;
      }
    }
  }

  return { rules };
}

function getMimeType(filePath) {
  const base = path.basename(filePath);
  if (base === '_headers') return 'text/plain; charset=utf-8';
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function matchRule(pattern, pathname) {
  if (pattern === '/*' || pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return pathname.startsWith(prefix);
  }
  return pathname === pattern;
}

/**
 * Starts an ephemeral static HTTP server bound to 127.0.0.1:0.
 * @param {{ rootDir?: string, applyHeadersFile?: boolean }} [options]
 */
export async function startStaticServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || PROJECT_ROOT);
  const applyHeadersFile = options.applyHeadersFile !== false;

  const server = http.createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      let pathname;
      try {
        const parsed = new URL(req.url || '/', 'http://127.0.0.1');
        pathname = decodeURIComponent(parsed.pathname);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
      }

      // Guard raw traversal attempts before path normalization as well
      const rawUrlPath = (req.url || '/').split('?')[0];
      if (rawUrlPath.includes('..') || pathname.includes('\0')) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const relativeReqPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const resolvedPath = path.resolve(rootDir, relativeReqPath);

      if (resolvedPath !== rootDir && !resolvedPath.startsWith(rootDir + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      let stat;
      try {
        stat = await fs.stat(resolvedPath);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      if (!stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const headers = {
        'Content-Type': getMimeType(resolvedPath),
        'Cache-Control': 'no-store',
      };

      if (applyHeadersFile) {
        try {
          const rawHeaders = await fs.readFile(path.join(rootDir, '_headers'), 'utf8');
          const { rules } = parseHeadersFile(rawHeaders);
          for (const rule of rules) {
            if (matchRule(rule.pattern, pathname)) {
              for (const [k, v] of Object.entries(rule.headers)) {
                headers[k] = v;
              }
            }
          }
        } catch {
          // _headers may not exist yet during parallel greenfield builds
        }
      }

      const body = await fs.readFile(resolvedPath);
      res.writeHead(200, headers);
      if (method === 'HEAD') {
        res.end();
      } else {
        res.end(body);
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err?.message || err));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    port,
    baseUrl,
    rootDir,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
