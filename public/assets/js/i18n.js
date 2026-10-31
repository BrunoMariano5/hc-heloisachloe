// Internacionalização. Textos da interface em /locales/{pt,en,ja}.json;
// textos de produto vêm do catálogo como { pt, en, ja }.
// Para um novo idioma: criar o JSON, incluir em LOCALES e no config do servidor.
export const LOCALES = [
  { id: 'pt', label: 'Português', short: 'PT', html: 'pt-BR', intl: 'pt-BR' },
  { id: 'en', label: 'English', short: 'EN', html: 'en', intl: 'en-US' },
  { id: 'ja', label: '日本語', short: 'JP', html: 'ja', intl: 'ja-JP' },
];

let locale = 'pt';
let dict = {};
const fallback = {};

function detect() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem('hc.lang'); } catch {}
  const nav = (navigator.language || 'pt').slice(0, 2);
  return [fromUrl, saved, nav].find((l) => LOCALES.some((x) => x.id === l)) || 'pt';
}

async function load(id) {
  const res = await fetch(`/locales/${id}.json`);
  return res.json();
}

export async function initI18n() {
  Object.assign(fallback, await load('pt'));
  await setLocale(detect(), { silent: true });
}

export async function setLocale(id, { silent } = {}) {
  locale = id;
  dict = id === 'pt' ? fallback : await load(id);
  try { localStorage.setItem('hc.lang', id); } catch {}
  const meta = LOCALES.find((l) => l.id === id);
  document.documentElement.lang = meta.html;
  document.documentElement.dataset.locale = id;
  if (!silent) window.dispatchEvent(new CustomEvent('hc:locale'));
}

export const getLocale = () => locale;
export const intlLocale = () => LOCALES.find((l) => l.id === locale).intl;

export function t(key, vars) {
  const raw = key.split('.').reduce((o, k) => o?.[k], dict) ?? key.split('.').reduce((o, k) => o?.[k], fallback) ?? key;
  if (!vars || typeof raw !== 'string') return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// Texto multilíngue vindo do catálogo
export const tx = (obj) => (obj ? obj[locale] || obj.pt || '' : '');

// Preços em BRL; a estrutura aceita outra moeda por região no futuro
export function money(value, currency = 'BRL') {
  return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency }).format(value);
}
