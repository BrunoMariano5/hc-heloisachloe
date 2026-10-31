// Páginas institucionais: Sobre, Contato (com FAQ) e 404.
import { t } from '../i18n.js';
import { getSettings, getCatalog } from '../api.js';
import { cropImg, crown, icons, esc, html } from '../ui.js';
import { main, setTitle, PHOTOS } from '../nav.js';

export async function renderAbout() {
  setTitle(t('nav.about'));
  const { collections } = await getCatalog();
  const values = ['quality', 'comfort', 'care', 'fair', 'durability', 'inclusion'];
  main().innerHTML = html`
    <section class="about-hero">
      <div class="container about-hero__inner">
        <div>
          <p class="kicker">${t('about.kicker')}</p>
          <h1 class="display">${t('about.title')}</h1>
          <p class="lead">${t('about.lead')}</p>
        </div>
        <figure class="about-hero__media">
          ${cropImg(PHOTOS.heroGirl, t('home.heroAltGirl'), { ratio: 4 / 3, eager: true })}
          <figcaption class="birth-stamp">${icons.heart}<span>${t('about.birthStamp')}</span></figcaption>
        </figure>
      </div>
    </section>
    <section class="container prose story">
      <h2>${t('about.storyTitle')}</h2>
      ${(t('about.story') || []).map((p) => (typeof p === 'string' ? `<p>${p}</p>` : `<p class="story__hl">${p.h}</p>`))}
      <blockquote>
        ${crown()}
        <strong class="story__sign">${t('about.closingSign')}</strong>
        <p>${t('about.closing')}</p>
        <p class="story__last">${t('about.closingLine')}</p>
      </blockquote>
    </section>
    <section class="mvv container">
      <article><p class="kicker">${t('about.missionTitle')}</p><p>${t('about.mission')}</p></article>
      <article><p class="kicker">${t('about.visionTitle')}</p><p>${t('about.vision')}</p></article>
    </section>
    <section class="section container" id="valores">
      <div class="section-head"><div><p class="kicker">HC</p><h2>${t('about.valuesTitle')}</h2></div></div>
      <ul class="values">${values.map((v, i) => `<li><span>0${i + 1}</span><h3>${t(`about.values.${v}.t`)}</h3><p>${t(`about.values.${v}.d`)}</p></li>`)}</ul>
    </section>
    <section class="philosophy">
      <div class="container philosophy__inner">
        <p class="kicker">${t('about.journeyKicker')}</p>
        <h2 class="display">${t('about.journeyTitle')}</h2>
        <ol class="journey">${collections.map((c) => `<li><a href="/colecoes/${c.slug}"><strong>${esc(c.name)}</strong><span>${esc(c.age[document.documentElement.dataset.locale] || c.age.pt)}</span></a></li>`)}</ol>
      </div>
    </section>`;
}

export async function renderContact() {
  setTitle(t('nav.contact'));
  const s = await getSettings();
  const c = s.contact || {};
  const loc = document.documentElement.dataset.locale;
  const channel = (icon, title, value, href) => html`<li class="channel">
    ${icon}<div><h3>${title}</h3>
    ${value ? `<a href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(value)}</a>` : `<p class="muted">${t('contact.soon')}</p>`}</div>
  </li>`;
  const faqs = ['shipping', 'exchange', 'sizes', 'payment', 'international', 'care'];
  main().innerHTML = html`
    <div class="container page-head">
      ${crown()}
      <h1>${t('nav.contact')}</h1>
      <p class="lead">${t('contact.lead')}</p>
    </div>
    <div class="container">
      <ul class="channels">
        ${channel(icons.whatsapp, 'WhatsApp', c.whatsapp && `+${c.whatsapp}`, `https://wa.me/${c.whatsapp}`)}
        ${channel(icons.instagram, 'Instagram', c.instagram && `@${c.instagram}`, `https://instagram.com/${c.instagram}`)}
        ${channel(icons.mail, 'E-mail', c.email, `mailto:${c.email}`)}
        <li class="channel">${icons.clock}<div><h3>${t('contact.service')}</h3><p>${esc(c.hours?.[loc] || c.hours?.pt || '')}</p></div></li>
      </ul>
      <section class="section faq" id="faq">
        <div class="section-head"><div><p class="kicker">${t('contact.faqKicker')}</p><h2>${t('contact.faqTitle')}</h2></div></div>
        <div class="accordion">
          ${faqs.map((f) => `<details><summary>${t(`faq.${f}.q`)}</summary><p>${t(`faq.${f}.a`)}</p></details>`)}
        </div>
      </section>
    </div>`;
}

export function renderNotFound() {
  setTitle(t('errors.notFoundTitle'));
  main().innerHTML = `<section class="container page-msg">${crown('crown--ghost')}<h1>${t('errors.notFoundTitle')}</h1><p>${t('errors.notFoundText')}</p><a class="btn" href="/">${t('nav.home')}</a></section>`;
}
