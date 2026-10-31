import { t, tx, money } from '../i18n.js';
import { getCatalog } from '../api.js';
import { cropImg, productGrid, sectionHead, crown, icons, html } from '../ui.js';
import { main, setTitle, PHOTOS } from '../nav.js';

export async function render() {
  const { products, collections } = await getCatalog();
  const best = products.filter((p) => p.tags.includes('bestseller')).slice(0, 4);
  const fresh = products.filter((p) => p.tags.includes('new')).slice(0, 4);
  const kit = products.find((p) => p.category === 'kits');
  setTitle();

  main().innerHTML = html`
    <section class="hero">
      <div class="hero__inner container">
        <div class="hero__text">
          <p class="kicker">${t('home.heroKicker')}</p>
          <h1>${t('home.heroTitle')}</h1>
          <p class="lead">${t('home.heroLead')}</p>
          <div class="btn-row">
            <a class="btn" href="/meninas">${t('home.shopGirls')}</a>
            <a class="btn btn--ghost" href="/meninos">${t('home.shopBoys')}</a>
          </div>
        </div>
        <div class="hero__media">
          ${cropImg(PHOTOS.heroGirl, t('home.heroAltGirl'), { ratio: 1.25, cls: 'hero__main', eager: true })}
          <figure class="hero__inset">
            ${cropImg(PHOTOS.heroBoy, t('home.heroAltBoy'), { ratio: 1, eager: true })}
            <figcaption>HC Baby · ${tx(collections.find((c) => c.id === 'baby')?.age)}</figcaption>
          </figure>
          <span class="hero__note">${t('product.demoLong')}</span>
        </div>
      </div>
    </section>

    <section class="pillars">
      <ul class="container">
        <li>${icons.cotton}<span>${t('pillars.cotton')}</span></li>
        <li>${icons.shield}<span>${t('pillars.quality')}</span></li>
        <li>${icons.heart}<span>${t('pillars.comfort')}</span></li>
        <li>${icons.globe}<span>${t('pillars.world')}</span></li>
      </ul>
    </section>

    <section class="intro container">
      ${crown('crown--lg')}
      <p class="kicker">${t('home.introKicker')}</p>
      <h2 class="display">${t('home.introTitle')}</h2>
      <p class="lead">${t('home.introText')}</p>
    </section>

    <section class="section container">
      ${sectionHead(t('home.collectionsKicker'), t('home.collectionsTitle'), { href: '/colecoes', label: t('common.viewAll') })}
      <div class="collections">
        ${collections.map((c, i) => html`
          <a class="collection-card" href="/colecoes/${c.slug}">
            ${cropImg(c.image, c.name, { ratio: 3 / 4 })}
            <span class="collection-card__body">
              <span class="collection-card__num">0${i + 1}</span>
              <strong>${c.name}</strong>
              <span>${tx(c.age)}</span>
            </span>
          </a>`)}
      </div>
    </section>

    <section class="section container">
      ${sectionHead(t('home.bestKicker'), t('home.bestTitle'), { href: '/busca', label: t('common.viewAll') })}
      ${productGrid(best)}
    </section>

    <section class="details">
      <div class="container details__inner">
        <div class="details__text">
          <p class="kicker">${t('home.detailsKicker')}</p>
          <h2>${t('home.detailsTitle')}</h2>
          <p>${t('home.detailsText')}</p>
        </div>
        <div class="details__media">
          ${cropImg(PHOTOS.embroidery, t('home.altEmbroidery'), { ratio: 1 })}
          ${cropImg(PHOTOS.label, t('home.altLabel'), { ratio: 1 })}
          ${cropImg(PHOTOS.tag, t('home.altTag'), { ratio: 1 })}
        </div>
      </div>
    </section>

    <section class="section container">
      ${sectionHead(t('home.newKicker'), t('home.newTitle'))}
      ${productGrid(fresh)}
    </section>

    <section class="section container enxoval-band">
      <div class="enxoval-band__media">${cropImg(PHOTOS.tiles.kits, t('home.altKit'), { ratio: 4 / 3 })}</div>
      <div class="enxoval-band__text">
        <p class="kicker">${t('home.enxovalKicker')}</p>
        <h2>${t('home.enxovalTitle')}</h2>
        <p>${t('home.enxovalText')}</p>
        ${kit ? html`<a class="kit-line" href="/produto/${kit.slug}"><span>${kit.name}</span><span>${money(kit.price)}</span></a>` : ''}
        <div class="btn-row">
          <a class="btn" href="/enxoval/kits">${t('home.enxovalCta')}</a>
          <a class="btn btn--ghost" href="/enxoval">${t('home.enxovalAll')}</a>
        </div>
      </div>
    </section>

    <section class="section container">
      <div class="tiles">
        ${['macacoes', 'bodies', 'mantas', 'toalhas', 'toucas', 'acessorios'].map((k) => html`
          <a class="tile" href="/enxoval/${k}">
            ${cropImg(PHOTOS.tiles[k], t(`cat.${k}`), { ratio: 1 })}
            <span>${t(`cat.${k}`)}</span>
          </a>`)}
      </div>
    </section>

    <section class="philosophy">
      <div class="container philosophy__inner">
        ${crown('crown--lg crown--light')}
        <p class="kicker">${t('home.philoKicker')}</p>
        <h2 class="display">${t('home.philoTitle')}</h2>
        <p class="lead">${t('home.philoText')}</p>
        <ol class="journey">
          ${collections.map((c) => html`<li><a href="/colecoes/${c.slug}"><strong>${c.name}</strong><span>${tx(c.age)}</span></a></li>`)}
        </ol>
        <a class="btn btn--light" href="/sobre">${t('home.philoCta')}</a>
      </div>
    </section>`;
}
