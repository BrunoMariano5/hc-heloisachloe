// Clientes: cadastro mínimo (nome, e-mail, senha com hash) e favoritos.
// Propositalmente NÃO guarda CPF, telefone, endereço ou cartão: esses dados exigem
// banco com criptografia, backups e política LGPD antes de serem armazenados.
import crypto from 'node:crypto';
import { collection } from '../core/db.js';
import { HttpError, readJson, cookie, v } from '../core/http.js';
import {
  COOKIE, createSession, destroySession, hashPassword, verifyPassword,
  rateLimit, clearRateLimit, requireSession, readSession,
} from '../core/auth.js';
import { config } from '../config.js';
import { products } from './catalog.js';

export const customers = collection('customers');

const publicCustomer = (c) => ({ id: c.id, name: c.name, email: c.email, favorites: c.favorites || [] });

function password(val) {
  const s = v.str(val, { max: 128, field: 'password' });
  if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new HttpError(400, 'WEAK_PASSWORD', 'password');
  return s;
}

function sessionCookie(token) {
  return { 'Set-Cookie': cookie(COOKIE.customer, token, { maxAge: config.sessionTtlMs }) };
}

export function registerCustomers(router) {
  router.post('/api/account/register', async ({ req, ip }) => {
    rateLimit(`register:${ip}`, { max: 10 });
    const body = await readJson(req);
    const name = v.str(body.name, { min: 2, max: 120, field: 'name' });
    const email = v.email(body.email);
    const pass = password(body.password);
    if (body.acceptPrivacy !== true) throw new HttpError(400, 'PRIVACY_REQUIRED', 'acceptPrivacy');
    if (customers.find((c) => c.email === email)) throw new HttpError(409, 'EMAIL_IN_USE', 'email');
    const c = customers.insert({
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(pass),
      favorites: Array.isArray(body.favorites) ? body.favorites.filter((id) => products.get(id)).slice(0, 100) : [],
      marketingOptIn: body.marketingOptIn === true,
      createdAt: new Date().toISOString(),
    });
    const token = createSession('customer', c.id);
    return { status: 201, body: publicCustomer(c), headers: sessionCookie(token) };
  });

  router.post('/api/account/login', async ({ req, ip }) => {
    const body = await readJson(req);
    const email = v.email(body.email);
    rateLimit(`login:${ip}:${email}`);
    const c = customers.find((x) => x.email === email);
    if (!c || !verifyPassword(String(body.password || ''), c.passwordHash))
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    clearRateLimit(`login:${ip}:${email}`);
    return { body: publicCustomer(c), headers: sessionCookie(createSession('customer', c.id)) };
  });

  router.post('/api/account/logout', ({ req }) => {
    destroySession(req, 'customer');
    return { body: { ok: true }, headers: { 'Set-Cookie': cookie(COOKIE.customer, '', { maxAge: 0 }) } };
  });

  // Visitante sem login recebe { customer: null } (não é erro)
  router.get('/api/account/me', ({ req }) => {
    const c = customers.get(readSession(req, 'customer')?.subjectId);
    return { customer: c ? publicCustomer(c) : null };
  });

  router.put('/api/account/favorites', requireSession('customer'), async ({ req, session }) => {
    const body = await readJson(req);
    const ids = (Array.isArray(body.favorites) ? body.favorites : [])
      .map(String)
      .filter((id) => products.get(id))
      .slice(0, 100);
    const c = customers.update(session.subjectId, { favorites: [...new Set(ids)] });
    return publicCustomer(c);
  });

  // LGPD: o cliente pode excluir a própria conta
  router.delete('/api/account', requireSession('customer'), ({ req, session }) => {
    customers.remove(session.subjectId);
    destroySession(req, 'customer');
    return { body: { ok: true }, headers: { 'Set-Cookie': cookie(COOKIE.customer, '', { maxAge: 0 }) } };
  });
}
