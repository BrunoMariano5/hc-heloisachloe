// Configuração central. Lê .env (sem dependências) e expõe valores tipados.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  production: env.NODE_ENV === 'production',
  // RENDER_EXTERNAL_URL é preenchida automaticamente pelo Render
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/$/, ''),
  // Enquanto a loja for demonstrativa, fica fora do Google (ALLOW_INDEXING=true libera)
  allowIndexing: env.ALLOW_INDEXING === 'true',
  // Atrás do proxy do Render, o IP real do visitante vem em X-Forwarded-For
  trustProxy: env.TRUST_PROXY === 'true',
  paths: {
    public: path.join(ROOT, 'public'),
    seed: path.join(ROOT, 'data', 'seed'),
    runtime: path.join(ROOT, 'data', 'runtime'),
  },
  admin: {
    email: (env.ADMIN_EMAIL || 'admin@hc.local').toLowerCase(),
    password: env.ADMIN_PASSWORD || '',
  },
  payment: { provider: env.PAYMENT_PROVIDER || '', apiKey: env.PAYMENT_API_KEY || '' },
  shipping: { provider: env.SHIPPING_PROVIDER || '', originCep: env.SHIPPING_ORIGIN_CEP || '' },
  locales: ['pt', 'en', 'ja'],
  defaultLocale: 'pt',
  sessionTtlMs: 1000 * 60 * 60 * 8,
};
