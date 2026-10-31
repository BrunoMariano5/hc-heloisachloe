// Utilitários HTTP: roteador mínimo, JSON, cookies e erros padronizados.
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

const MAX_BODY = 256 * 1024;

export async function readJson(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return {};
  const type = req.headers['content-type'] || '';
  // Exigir JSON também bloqueia formulários cross-site (proteção CSRF complementar ao SameSite).
  if (!type.startsWith('application/json')) throw new HttpError(415, 'JSON_REQUIRED');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Strict'];
  if (config.production) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  return parts.join('; ');
}

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      // 'unsafe-inline' só para estilos: os recortes de imagem usam style="" calculado
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
}

// Roteador: router.get('/api/products/:slug', handler)
export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$',
    );
    routes.push({ method, re, keys, handlers });
  };
  return {
    get: add('GET'),
    post: add('POST'),
    put: add('PUT'),
    patch: add('PATCH'),
    delete: add('DELETE'),
    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = pathname.match(r.re);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { handlers: r.handlers, params };
      }
      return null;
    },
  };
}

// Validação simples e explícita
export const v = {
  str(val, { min = 0, max = 200, field = 'campo' } = {}) {
    if (typeof val !== 'string') throw new HttpError(400, 'INVALID_FIELD', field);
    const s = val.trim();
    if (s.length < min || s.length > max) throw new HttpError(400, 'INVALID_FIELD', field);
    return s;
  },
  email(val) {
    const s = v.str(val, { min: 5, max: 160, field: 'email' }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new HttpError(400, 'INVALID_EMAIL', 'email');
    return s;
  },
  num(val, { min = 0, max = 1e7, field = 'número', int = false } = {}) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n)))
      throw new HttpError(400, 'INVALID_FIELD', field);
    return n;
  },
  slug(val) {
    const s = v.str(val, { min: 2, max: 80, field: 'slug' });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) throw new HttpError(400, 'INVALID_FIELD', 'slug');
    return s;
  },
};
