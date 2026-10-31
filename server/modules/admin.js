// Administração: produtos, preços, estoque, coleções, pedidos, clientes, indicadores e configurações.
// Todas as rotas /api/admin/* (exceto login) exigem sessão de administrador.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { collection } from '../core/db.js';
import { HttpError, readJson, cookie, v } from '../core/http.js';
import {
  COOKIE, createSession, destroySession, hashPassword, verifyPassword,
  rateLimit, clearRateLimit, requireSession,
} from '../core/auth.js';
import { products, collections, settings } from './catalog.js';
import { customers } from './customers.js';
import { orders, ORDER_STATUSES } from './orders.js';
import { paymentStatus } from './payments.js';

const admins = collection('admins');
const CATEGORIES = ['macacoes', 'bodies', 'camisetas', 'toucas', 'natacao', 'kits', 'mantas', 'toalhas', 'cueiros', 'acessorios'];
const GENDERS = ['meninos', 'meninas'];

// Garante um administrador. Sem ADMIN_PASSWORD, gera uma senha forte e grava em arquivo local (fora do git).
export function ensureAdmin() {
  if (admins.all().length) return;
  let pass = config.admin.password;
  if (!pass) {
    pass = crypto.randomBytes(12).toString('base64url');
    fs.mkdirSync(config.paths.runtime, { recursive: true });
    const file = path.join(config.paths.runtime, 'admin-credentials.txt');
    fs.writeFileSync(file, `E-mail: ${config.admin.email}\nSenha: ${pass}\n\nTroque definindo ADMIN_PASSWORD no .env e apagando data/runtime/admins.json.\n`);
    console.log(`[admin] credenciais iniciais gravadas em ${file}`);
  }
  admins.insert({ id: crypto.randomUUID(), email: config.admin.email, passwordHash: hashPassword(pass), createdAt: new Date().toISOString() });
}

const i18nText = (obj, field, max = 2000) => {
  const out = {};
  for (const l of config.locales) out[l] = v.str(obj?.[l] ?? '', { max, field: `${field}.${l}` });
  if (!out.pt) throw new HttpError(400, 'INVALID_FIELD', `${field}.pt`);
  return out;
};

function productInput(b, existing) {
  const stock = {};
  for (const [size, qty] of Object.entries(b.stock || {}))
    stock[v.str(size, { min: 1, max: 6, field: 'size' }).toUpperCase()] = v.num(qty, { max: 100000, int: true, field: `stock.${size}` });
  const slug = v.slug(b.slug);
  if (products.find((p) => p.slug === slug && p.id !== existing?.id)) throw new HttpError(409, 'SLUG_IN_USE', 'slug');
  const category = v.str(b.category, { field: 'category' });
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'INVALID_FIELD', 'category');
  return {
    slug,
    name: v.str(b.name, { min: 2, max: 120, field: 'name' }),
    price: v.num(b.price, { min: 0.01, max: 100000, field: 'price' }),
    compareAtPrice: b.compareAtPrice ? v.num(b.compareAtPrice, { min: 0.01, max: 100000, field: 'compareAtPrice' }) : null,
    category,
    genders: (b.genders || []).filter((g) => GENDERS.includes(g)),
    collections: (b.collections || []).filter((id) => collections.get(id)),
    enxoval: Boolean(b.enxoval),
    tags: (b.tags || []).filter((t) => ['bestseller', 'new'].includes(t)),
    active: Boolean(b.active),
    demo: Boolean(b.demo),
    stock,
    description: i18nText(b.description, 'description'),
    details: existing?.details || { pt: [], en: [], ja: [] },
    colors: existing?.colors || [],
    images: existing?.images || [],
  };
}

export function registerAdmin(router) {
  const auth = requireSession('admin');

  router.post('/api/admin/login', async ({ req, ip }) => {
    const body = await readJson(req);
    const email = v.email(body.email);
    rateLimit(`admin:${ip}`, { max: 5 });
    const a = admins.find((x) => x.email === email);
    if (!a || !verifyPassword(String(body.password || ''), a.passwordHash)) throw new HttpError(401, 'INVALID_CREDENTIALS');
    clearRateLimit(`admin:${ip}`);
    const token = createSession('admin', a.id);
    return { body: { email: a.email }, headers: { 'Set-Cookie': cookie(COOKIE.admin, token, { maxAge: config.sessionTtlMs }) } };
  });

  router.post('/api/admin/logout', ({ req }) => {
    destroySession(req, 'admin');
    return { body: { ok: true }, headers: { 'Set-Cookie': cookie(COOKIE.admin, '', { maxAge: 0 }) } };
  });

  router.get('/api/admin/me', auth, ({ session }) => ({ email: admins.get(session.subjectId)?.email }));

  router.get('/api/admin/dashboard', auth, () => {
    const all = products.all();
    const low = settings.read().lowStockThreshold ?? 8;
    const paid = orders.filter((o) => !['awaiting_payment', 'cancelled', 'refunded'].includes(o.status));
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const units = all.reduce((s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0), 0);
    return {
      products: { total: all.length, active: all.filter((p) => p.active).length },
      stock: {
        units,
        value: Math.round(all.reduce((s, p) => s + p.price * Object.values(p.stock).reduce((a, b) => a + b, 0), 0) * 100) / 100,
        low: all.flatMap((p) => Object.entries(p.stock).filter(([, q]) => q <= low).map(([size, qty]) => ({ name: p.name, size, qty }))),
      },
      customers: customers.all().length,
      orders: { total: orders.all().length, paid: paid.length, revenue, averageTicket: paid.length ? revenue / paid.length : 0 },
      payment: paymentStatus(),
    };
  });

  // Produtos
  router.get('/api/admin/products', auth, () => products.all());
  router.post('/api/admin/products', auth, async ({ req }) => {
    const b = await readJson(req);
    const p = products.insert({ id: `p-${crypto.randomUUID().slice(0, 8)}`, ...productInput(b), createdAt: new Date().toISOString() });
    return { status: 201, body: p };
  });
  router.put('/api/admin/products/:id', auth, async ({ req, params }) => {
    const existing = products.get(params.id);
    if (!existing) throw new HttpError(404, 'NOT_FOUND');
    return products.update(params.id, productInput(await readJson(req), existing));
  });
  // Ajuste rápido de preço/estoque pela tabela
  router.patch('/api/admin/products/:id', auth, async ({ req, params }) => {
    const p = products.get(params.id);
    if (!p) throw new HttpError(404, 'NOT_FOUND');
    const b = await readJson(req);
    const patch = {};
    if (b.price !== undefined) patch.price = v.num(b.price, { min: 0.01, max: 100000, field: 'price' });
    if (b.active !== undefined) patch.active = Boolean(b.active);
    if (b.stock) {
      patch.stock = { ...p.stock };
      for (const [size, qty] of Object.entries(b.stock)) {
        if (!(size in p.stock)) throw new HttpError(400, 'INVALID_FIELD', 'size');
        patch.stock[size] = v.num(qty, { max: 100000, int: true, field: `stock.${size}` });
      }
    }
    return products.update(params.id, patch);
  });
  router.delete('/api/admin/products/:id', auth, ({ params }) => {
    if (!products.remove(params.id)) throw new HttpError(404, 'NOT_FOUND');
    return { ok: true };
  });

  // Coleções
  router.get('/api/admin/collections', auth, () => collections.all().sort((a, b) => a.order - b.order));
  router.post('/api/admin/collections', auth, async ({ req }) => {
    const b = await readJson(req);
    const slug = v.slug(b.slug);
    if (collections.get(slug)) throw new HttpError(409, 'SLUG_IN_USE', 'slug');
    return {
      status: 201,
      body: collections.insert({
        id: slug, slug,
        name: v.str(b.name, { min: 2, max: 80, field: 'name' }),
        order: v.num(b.order ?? collections.all().length + 1, { int: true, max: 999, field: 'order' }),
        active: Boolean(b.active),
        age: i18nText(b.age, 'age', 80),
        description: i18nText(b.description, 'description', 500),
        image: null,
      }),
    };
  });
  router.put('/api/admin/collections/:id', auth, async ({ req, params }) => {
    if (!collections.get(params.id)) throw new HttpError(404, 'NOT_FOUND');
    const b = await readJson(req);
    return collections.update(params.id, {
      name: v.str(b.name, { min: 2, max: 80, field: 'name' }),
      order: v.num(b.order, { int: true, max: 999, field: 'order' }),
      active: Boolean(b.active),
      age: i18nText(b.age, 'age', 80),
      description: i18nText(b.description, 'description', 500),
    });
  });

  // Pedidos
  router.get('/api/admin/orders', auth, () => ({
    statuses: ORDER_STATUSES,
    orders: orders.all().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));
  router.patch('/api/admin/orders/:id', auth, async ({ req, params }) => {
    const b = await readJson(req);
    if (!ORDER_STATUSES.includes(b.status)) throw new HttpError(400, 'INVALID_FIELD', 'status');
    const o = orders.update(params.id, { status: b.status });
    if (!o) throw new HttpError(404, 'NOT_FOUND');
    return o;
  });

  // Clientes (somente dados não sensíveis)
  router.get('/api/admin/customers', auth, () =>
    customers.all().map((c) => ({
      id: c.id, name: c.name, email: c.email, createdAt: c.createdAt,
      favorites: (c.favorites || []).length, marketingOptIn: Boolean(c.marketingOptIn),
      orders: orders.filter((o) => o.customerId === c.id).length,
    })),
  );

  // Configurações da loja
  router.get('/api/admin/settings', auth, () => settings.read());
  router.put('/api/admin/settings', auth, async ({ req }) => {
    const b = await readJson(req);
    const c = b.contact || {};
    return settings.write({
      storeName: v.str(b.storeName, { min: 2, max: 80, field: 'storeName' }),
      contact: {
        whatsapp: v.str(c.whatsapp || '', { max: 20, field: 'whatsapp' }).replace(/\D/g, ''),
        instagram: v.str(c.instagram || '', { max: 40, field: 'instagram' }).replace(/^@/, ''),
        email: c.email ? v.email(c.email) : '',
        hours: i18nText(c.hours, 'hours', 120),
      },
      shipping: {
        freeShippingThreshold: v.num(b.shipping?.freeShippingThreshold ?? 0, { max: 100000, field: 'freeShippingThreshold' }),
        handlingDays: v.num(b.shipping?.handlingDays ?? 2, { int: true, max: 60, field: 'handlingDays' }),
      },
      lowStockThreshold: v.num(b.lowStockThreshold ?? 8, { int: true, max: 1000, field: 'lowStockThreshold' }),
    });
  });
}
