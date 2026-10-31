// Inicialização da loja: idioma, layout, roteador (History API) e eventos globais.
import { initI18n, setLocale, getLocale, LOCALES, t } from './i18n.js';
import { state, cartCount, toggleFavorite, loadCustomer } from './state.js';
import { logo, icons, crown, esc, toast } from './ui.js';
import { getSettings } from './api.js';
import * as home from './pages/home.js';
import * as shop from './pages/shop.js';
import * as product from './pages/product.js';
import * as checkout from './pages/checkout.js';
import * as account from './pages/account.js';
import * as info from './pages/info.js';
import { NAV, navigate } from './nav.js';

const routes = [
  [/^\/$/, home.render],
  [/^\/(meninos|meninas|enxoval)(?:\/([a-z]+))?$/, (m) => shop.renderSection(m[1], m[2])],
  [/^\/colecoes$/, () => shop.renderCollections()],
  [/^\/colecoes\/([a-z0-9-]+)$/, (m) => shop.renderCollection(m[1])],
  [/^\/busca$/, () => shop.renderSearch(new URLSearchParams(location.search).get('q') || '')],
  [/^\/produto\/([a-z0-9-]+)$/, (m) => product.render(m[1])],
  [/^\/carrinho$/, checkout.renderCart],
  [/^\/checkout$/, checkout.renderCheckout],
  [/^\/favoritos$/, account.renderFavorites],
  [/^\/conta$/, account.renderAccount],
  [/^\/sobre$/, info.renderAbout],
  [/^\/contato$/, info.renderContact],
];

const main = document.getElementById('main');

// Tema por público: ao entrar em Meninos o site inteiro fica azul bebê; ao entrar em
// Meninas volta à paleta original. A escolha continua nas demais páginas até trocar de seção.
function applyTheme(path) {
  let theme = '';
  try { theme = localStorage.getItem('hc.theme') || ''; } catch {}
  if (path.startsWith('/meninos')) theme = 'meninos';
  else if (path.startsWith('/meninas')) theme = '';
  try { localStorage.setItem('hc.theme', theme); } catch {}
  const html = document.documentElement;
  if (theme) html.dataset.theme = theme;
  else delete html.dataset.theme;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(html).getPropertyValue('--offwhite').trim());
}

async function route({ scroll = true } = {}) {
  const path = location.pathname.replace(/\/$/, '') || '/';
  applyTheme(path);
  let handler = info.renderNotFound;
  let match;
  for (const [re, fn] of routes) {
    if ((match = path.match(re))) {
      handler = () => fn(match);
      break;
    }
  }
  try {
    await handler();
  } catch (err) {
    console.error(err);
    main.innerHTML = `<section class="container page-msg">${crown('crown--ghost')}<h1>${t('errors.pageTitle')}</h1><p>${t('errors.INTERNAL_ERROR')}</p></section>`;
  }
  renderHeader();
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  main.focus({ preventScroll: true });
}

function renderHeader() {
  const path = location.pathname;
  const navItem = (key) => {
    const subs = NAV[key];
    return `<li class="nav__item ${subs ? 'has-sub' : ''}">
      <a href="/${key}" class="${path.startsWith(`/${key}`) ? 'is-active' : ''}">${t(`nav.${key}`)}</a>
      ${subs ? `<div class="nav__sub"><ul>${subs.map((s) => `<li><a href="/${key}/${s}">${t(`cat.${s}`)}</a></li>`).join('')}</ul></div>` : ''}
    </li>`;
  };
  const count = cartCount();
  document.getElementById('site-header').innerHTML = `
    <div class="topbar">
      <p>${t('topbar.message')}</p>
      <label class="lang">${icons.globe}<span class="sr-only">${t('nav.language')}</span>
        <select id="lang-select" aria-label="${t('nav.language')}">
          ${LOCALES.map((l) => `<option value="${l.id}" ${l.id === getLocale() ? 'selected' : ''}>${l.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="header container">
      <button class="icon-btn header__menu" id="menu-open" aria-label="${t('nav.menu')}" aria-expanded="false">${icons.menu}</button>
      <form class="header__search" action="/busca" role="search">
        <label class="sr-only" for="q">${t('nav.search')}</label>
        <input id="q" name="q" type="search" placeholder="${t('nav.searchPlaceholder')}" autocomplete="off">
        <button aria-label="${t('nav.search')}">${icons.search}</button>
      </form>
      <a href="/" class="header__logo" aria-label="HC Heloísa Chloé — ${t('nav.home')}">${logo({ size: 'md' })}</a>
      <div class="header__actions">
        <a href="/conta" class="icon-btn" aria-label="${t('nav.account')}">${icons.user}</a>
        <a href="/favoritos" class="icon-btn" aria-label="${t('nav.favorites')}">${icons.heart}${state.favorites.length ? `<span class="dot">${state.favorites.length}</span>` : ''}</a>
        <a href="/carrinho" class="icon-btn" aria-label="${t('nav.cart')} (${count})">${icons.bag}${count ? `<span class="dot">${count}</span>` : ''}</a>
      </div>
    </div>
    <nav class="nav" id="nav" aria-label="${t('nav.main')}">
      <div class="nav__head">${logo({ size: 'sm', tagline: false })}<button class="icon-btn" id="menu-close" aria-label="${t('nav.close')}">${icons.close}</button></div>
      <ul class="nav__list container">
        ${['meninos', 'meninas', 'enxoval', 'colecoes'].map(navItem).join('')}
        <li class="nav__item"><a href="/sobre" class="${path === '/sobre' ? 'is-active' : ''}">${t('nav.about')}</a></li>
        <li class="nav__item"><a href="/contato" class="${path === '/contato' ? 'is-active' : ''}">${t('nav.contact')}</a></li>
      </ul>
    </nav>
    <div class="scrim" id="scrim"></div>`;
  document.getElementById('lang-select').addEventListener('change', (e) => setLocale(e.target.value));
}

function renderFooter() {
  getSettings().then((s) => {
    const c = s.contact || {};
    document.getElementById('site-footer').innerHTML = `
      <div class="footer container">
        <div class="footer__brand">
          ${logo({ size: 'md' })}
          <p>${t('footer.about')}</p>
          <div class="footer__social">
            ${c.instagram ? `<a href="https://instagram.com/${esc(c.instagram)}" rel="noopener" target="_blank" aria-label="Instagram">${icons.instagram}</a>` : ''}
            ${c.whatsapp ? `<a href="https://wa.me/${esc(c.whatsapp)}" rel="noopener" target="_blank" aria-label="WhatsApp">${icons.whatsapp}</a>` : ''}
            ${c.email ? `<a href="mailto:${esc(c.email)}" aria-label="E-mail">${icons.mail}</a>` : ''}
          </div>
        </div>
        <div><h3>${t('footer.shop')}</h3><ul>
          <li><a href="/meninos">${t('nav.meninos')}</a></li><li><a href="/meninas">${t('nav.meninas')}</a></li>
          <li><a href="/enxoval">${t('nav.enxoval')}</a></li><li><a href="/colecoes">${t('nav.colecoes')}</a></li>
        </ul></div>
        <div><h3>${t('footer.institutional')}</h3><ul>
          <li><a href="/sobre">${t('nav.about')}</a></li><li><a href="/sobre#valores">${t('about.valuesTitle')}</a></li>
          <li><a href="/contato#faq">${t('contact.faqTitle')}</a></li>
        </ul></div>
        <div><h3>${t('footer.service')}</h3><ul>
          <li><a href="/contato">${t('nav.contact')}</a></li><li><a href="/conta">${t('nav.account')}</a></li>
          <li><a href="/favoritos">${t('nav.favorites')}</a></li><li><a href="/carrinho">${t('nav.cart')}</a></li>
        </ul></div>
      </div>
      <div class="footer__legal container">
        <p>© ${new Date().getFullYear()} HC Heloísa Chloé. ${t('footer.rights')}</p>
        <p>${t('footer.prototype')}</p>
      </div>`;
  });
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  document.getElementById('menu-open')?.setAttribute('aria-expanded', 'false');
}

// Eventos globais (delegação)
document.addEventListener('click', async (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.preventDefault();
    const on = await toggleFavorite(fav.dataset.fav);
    document.querySelectorAll(`[data-fav="${fav.dataset.fav}"]`).forEach((b) => {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
    });
    toast(on ? t('product.favAdded') : t('product.favRemoved'), on ? { href: '/favoritos', label: t('nav.favorites') } : null);
    return;
  }
  if (e.target.closest('#menu-open')) {
    document.body.classList.add('menu-open');
    e.target.closest('#menu-open').setAttribute('aria-expanded', 'true');
    return;
  }
  if (e.target.closest('#menu-close, #scrim')) return closeMenu();

  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.hash) {
    document.querySelector(url.hash)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  navigate(url.pathname + url.search + url.hash);
  if (url.hash) requestAnimationFrame(() => document.querySelector(url.hash)?.scrollIntoView());
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('.header__search');
  if (!form) return;
  e.preventDefault();
  const q = form.q.value.trim();
  if (q) navigate(`/busca?q=${encodeURIComponent(q)}`);
});

window.addEventListener('popstate', () => route({ scroll: false }));
window.addEventListener('hc:navigate', () => {
  closeMenu();
  route();
});
window.addEventListener('hc:state', renderHeader);
window.addEventListener('hc:locale', () => {
  renderFooter();
  route({ scroll: false });
});

applyTheme(location.pathname);
await initI18n();
renderHeader();
renderFooter();
loadCustomer();
route();
