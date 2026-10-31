// Servidor HC: API JSON + arquivos estáticos + HTML com SEO por rota.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createRouter, sendJson, securityHeaders, HttpError } from './core/http.js';
import { registerCatalog } from './modules/catalog.js';
import { registerShipping } from './modules/shipping.js';
import { registerCustomers } from './modules/customers.js';
import { registerOrders } from './modules/orders.js';
import { registerPayments } from './modules/payments.js';
import { registerAdmin, ensureAdmin } from './modules/admin.js';
import { headFor, sitemap, robots } from './seo.js';

const router = createRouter();
registerCatalog(router);
registerShipping(router);
registerCustomers(router);
registerOrders(router);
registerPayments(router);
registerAdmin(router);
ensureAdmin();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const shellTemplate = () => fs.readFileSync(path.join(config.paths.public, 'index.html'), 'utf8');
let shellCache = config.production ? shellTemplate() : null;

function serveStatic(res, pathname) {
  const file = path.normalize(path.join(config.paths.public, pathname));
  if (!file.startsWith(config.paths.public + path.sep)) return false; // bloqueia ../
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : config.production ? 'public, max-age=604800' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  const match = router.match(req.method, url.pathname);
  if (!match) throw new HttpError(404, 'NOT_FOUND');
  const forwarded = config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ctx = { req, res, url, params: match.params, ip: forwarded || req.socket.remoteAddress };
  let result;
  for (const h of match.handlers) result = await h(ctx);
  if (result && result.body !== undefined && (result.status || result.headers))
    return sendJson(res, result.status || 200, result.body, result.headers);
  sendJson(res, 200, result ?? { ok: true });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  if (!config.allowIndexing) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED');

    if (url.pathname === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      return res.end(sitemap());
    }
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(robots());
    }
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      res.setHeader('X-Robots-Tag', 'noindex');
      if (serveStatic(res, url.pathname === '/admin' || url.pathname === '/admin/' ? '/admin/index.html' : url.pathname)) return;
    }
    if (url.pathname !== '/' && serveStatic(res, url.pathname)) return;
    if (path.extname(url.pathname)) throw new HttpError(404, 'NOT_FOUND');

    // Rotas da loja (SPA): HTML com meta tags específicas da página
    let html = (shellCache || shellTemplate()).replace('<!--SEO-->', headFor(url.pathname));
    // Já entrega Meninos em azul bebê, sem piscar a paleta original antes do JS
    if (url.pathname.startsWith('/meninos')) html = html.replace('<html lang="pt-BR">', '<html lang="pt-BR" data-theme="meninos">');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (res.headersSent) return res.end();
    if (url.pathname.startsWith('/api/'))
      return sendJson(res, status, { error: err.code || 'INTERNAL_ERROR', field: err.code && err.message !== err.code ? err.message : undefined });
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Não encontrado' : 'Erro');
  }
});

server.listen(config.port, () => {
  console.log(`HC Heloísa Chloé em ${config.publicUrl}  (admin: ${config.publicUrl}/admin)`);
});
