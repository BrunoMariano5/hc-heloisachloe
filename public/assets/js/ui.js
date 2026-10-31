// Componentes reutilizáveis da loja (retornam HTML em string).
import { t, tx, money } from './i18n.js';
import { isFavorite } from './state.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const html = (strings, ...vals) =>
  strings.reduce((out, s, i) => out + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join('') : vals[i] ?? '') : ''), '');

const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  bag: svg('<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/>'),
  cotton: svg('<path d="M12 21v-6"/><circle cx="12" cy="9" r="3.2"/><circle cx="7.5" cy="11.5" r="2.8"/><circle cx="16.5" cy="11.5" r="2.8"/><path d="M8 16c1.2-.8 2.5-1 4-1s2.8.2 4 1"/>'),
  shield: svg('<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'),
  truck: svg('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>'),
  whatsapp: svg('<path d="M4 20l1.3-3.8A8 8 0 1 1 8 19l-4 1Z"/><path d="M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1-1.4-1.8-1-.9.8a4 4 0 0 1-2.2-2.2l.8-.9-1-1.8L9 9.5Z"/>'),
  instagram: svg('<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6" fill="currentColor"/>'),
  mail: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  minus: svg('<path d="M6 12h12"/>'),
  plus: svg('<path d="M6 12h12M12 6v12"/>'),
};

// Coroa HC: cinco pontas suaves, pérolas nas extremidades e um coração ao centro —
// a mesma coroa para príncipes e princesas.
export function crown(cls = '') {
  return `<svg class="crown ${cls}" viewBox="0 0 64 42" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
    <path d="M10 33 6 14l11 9 7-15 8 12 8-12 7 15 11-9-4 19Z"/>
    <path d="M11 37.5h42"/>
    <circle cx="6" cy="12" r="2.3" fill="currentColor" stroke="none"/>
    <circle cx="24" cy="6.5" r="2.3" fill="currentColor" stroke="none"/>
    <circle cx="40" cy="6.5" r="2.3" fill="currentColor" stroke="none"/>
    <circle cx="58" cy="12" r="2.3" fill="currentColor" stroke="none"/>
    <path d="M32 30.5s-4.3-2.6-4.3-5.6a2.3 2.3 0 0 1 4.3-1.2 2.3 2.3 0 0 1 4.3 1.2c0 3-4.3 5.6-4.3 5.6Z" fill="currentColor" stroke="none"/>
  </svg>`;
}

export function logo({ size = 'md', tagline = true } = {}) {
  return `<span class="logo logo--${size}">
    ${crown()}
    <span class="logo__hc">HC</span>
    ${tagline ? '<span class="logo__name">Heloísa Chloé</span>' : ''}
  </span>`;
}

// Recorte responsivo de uma região da imagem-fonte, opcionalmente forçando proporção (cover).
export function cropImg(img, alt, { ratio, cls = '', eager = false } = {}) {
  if (!img) return `<div class="crop crop--empty ${cls}" style="aspect-ratio:${ratio || 1}">${crown('crown--ghost')}</div>`;
  const [W] = img.size;
  let [x, y, w, h] = img.crop;
  if (ratio) {
    if (w / h > ratio) {
      const nw = h * ratio;
      x += (w - nw) / 2;
      w = nw;
    } else {
      const nh = w / ratio;
      y += (h - nh) / 2;
      h = nh;
    }
  }
  return `<div class="crop ${cls}" style="aspect-ratio:${(w / h).toFixed(4)}"><img src="${img.src}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="width:${((W / w) * 100).toFixed(3)}%;left:${((-x / w) * 100).toFixed(3)}%;top:${((-y / h) * 100).toFixed(3)}%"></div>`;
}

export function priceTag(p) {
  return `<span class="price">${p.compareAtPrice ? `<s>${money(p.compareAtPrice)}</s> ` : ''}${money(p.price)}</span>`;
}

export function productCard(p) {
  const fav = isFavorite(p.id);
  const badge = p.tags.includes('new') ? t('product.badgeNew') : p.tags.includes('bestseller') ? t('product.badgeBest') : '';
  return html`<article class="card">
    <a href="/produto/${p.slug}" class="card__media">
      ${cropImg(p.images[0], `${p.name} — ${t('product.demoAlt')}`, { ratio: 4 / 5 })}
      ${badge ? `<span class="card__badge">${badge}</span>` : ''}
      ${p.demo ? `<span class="card__demo">${t('product.demoShort')}</span>` : ''}
    </a>
    <button class="card__fav ${fav ? 'is-on' : ''}" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${t('product.favorite')}">${icons.heart}</button>
    <div class="card__body">
      <a href="/produto/${p.slug}" class="card__name">${esc(p.name)}</a>
      <div class="card__meta">
        ${priceTag(p)}
        <span class="swatches">${p.colors.map((c) => `<i style="background:${c.hex}" title="${t(`colors.${c.id}`)}"></i>`).join('')}</span>
      </div>
    </div>
  </article>`;
}

export function productGrid(list, empty) {
  if (!list.length) return `<div class="empty">${crown('crown--ghost')}<p>${empty || t('list.empty')}</p></div>`;
  return `<div class="grid">${list.map(productCard).join('')}</div>`;
}

export function sectionHead(kicker, title, link) {
  return `<div class="section-head">
    <div><p class="kicker">${kicker}</p><h2>${title}</h2></div>
    ${link ? `<a class="link-arrow" href="${link.href}">${link.label} ${icons.arrow}</a>` : ''}
  </div>`;
}

let toastTimer;
export function toast(message, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${message}</span>${action ? `<a href="${action.href}">${action.label}</a>` : ''}`;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3800);
}

export function errorMessage(err) {
  const key = `errors.${err?.code || 'INTERNAL_ERROR'}`;
  const msg = t(key);
  return msg === key ? t('errors.INTERNAL_ERROR') : msg;
}
