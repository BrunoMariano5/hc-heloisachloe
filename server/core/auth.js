// Autenticação: senhas com scrypt, sessões opacas em memória e limite de tentativas.
// Em produção as sessões devem ir para Redis/banco (mesma interface).
import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError, parseCookies } from './http.js';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return crypto.timingSafeEqual(expected, actual);
}

// kind: 'customer' | 'admin' — cookies separados para não misturar papéis
const sessions = new Map();
export const COOKIE = { customer: 'hc_sid', admin: 'hc_admin' };

export function createSession(kind, subjectId) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { kind, subjectId, expires: Date.now() + config.sessionTtlMs });
  return token;
}

export function destroySession(req, kind) {
  const token = parseCookies(req)[COOKIE[kind]];
  if (token) sessions.delete(token);
}

export function readSession(req, kind) {
  const token = parseCookies(req)[COOKIE[kind]];
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.kind !== kind) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

export function requireSession(kind) {
  return (ctx) => {
    const s = readSession(ctx.req, kind);
    if (!s) throw new HttpError(401, 'UNAUTHENTICATED');
    ctx.session = s;
  };
}

// Limite de tentativas por IP + chave (ex.: login)
const attempts = new Map();
export function rateLimit(key, { max = 8, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.reset < now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  rec.count += 1;
  if (rec.count > max) throw new HttpError(429, 'TOO_MANY_ATTEMPTS');
}

export function clearRateLimit(key) {
  attempts.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expires < now) sessions.delete(k);
  for (const [k, a] of attempts) if (a.reset < now) attempts.delete(k);
}, 60_000).unref();
