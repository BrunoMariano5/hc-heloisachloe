// Listagens: Meninos, Meninas, Enxoval, Coleções e Busca — com filtros e ordenação.
import { t, tx } from '../i18n.js';
import { getCatalog } from '../api.js';
import { cropImg, productGrid, crown, esc, html } from '../ui.js';
import { main, setTitle, NAV, PHOTOS } from '../nav.js';

const SECTION_PHOTO = { meninos: PHOTOS.heroBoy, meninas: PHOTOS.heroGirl, enxoval: PHOTOS.tiles.kits };

function banner({ kicker, title, text, photo, crumbs }) {
  return html`<section class="banner">
    <div class="container banner__inner">
      <div class="banner__text">
        <nav class="crumbs" aria-label="${t('common.breadcrumb')}">
          <a href="/">${t('nav.home')}</a>${crumbs.map((c) => (c.href ? ` / <a href="${c.href}">${c.label}</a>` : ` / <span aria-current="page">${c.label}</span>`))}
        </nav>
        ${kicker ? `<p class="kicker">${kicker}</p>` : ''}
        <h1>${title}</h1>
        ${text ? `<p class="lead">${text}</p>` : ''}
      </div>
      ${photo ? `<div class="banner__media">${cropImg(photo, title, { ratio: 16 / 10, eager: true })}</div>` : ''}
    </div>
  </section>`;
}

// Grade com filtros de tamanho/coleção e ordenação; re-renderiza só a grade.
function listing(products, collections, { empty } = {}) {
  const sizes = [...new Set(products.flatMap((p) => p.sizes.map((s) => s.size)))];
  const used = collections.filter((c) => products.some((p) => p.collections.includes(c.id)));
  const markup = html`<div class="listing">
    ${products.length ? html`<div class="toolbar">
      <p class="toolbar__count" id="count"></p>
      <div class="toolbar__filters">
        ${sizes.length > 1 ? html`<div class="chips" role="group" aria-label="${t('list.size')}">
          ${sizes.map((s) => `<button class="chip" data-size="${esc(s)}" aria-pressed="false">${esc(s)}</button>`)}
        </div>` : ''}
        ${used.length > 1 ? html`<label class="select"><span class="sr-only">${t('list.collection')}</span>
          <select id="f-coll"><option value="">${t('list.allCollections')}</option>${used.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)}</select></label>` : ''}
        <label class="select"><span class="sr-only">${t('list.sort')}</span>
          <select id="f-sort">
            <option value="featured">${t('list.sortFeatured')}</option>
            <option value="price-asc">${t('list.sortPriceAsc')}</option>
            <option value="price-desc">${t('list.sortPriceDesc')}</option>
            <option value="name">${t('list.sortName')}</option>
          </select></label>
      </div>
    </div>` : ''}
    <div id="grid"></div>
  </div>`;

  const mount = (root) => {
    const f = { sizes: new Set(), coll: '', sort: 'featured' };
    const draw = () => {
      let list = products.filter(
        (p) =>
          (!f.sizes.size || p.sizes.some((s) => s.available && f.sizes.has(s.size))) &&
          (!f.coll || p.collections.includes(f.coll)),
      );
      if (f.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
      if (f.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
      if (f.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      root.querySelector('#grid').innerHTML = productGrid(list, products.length ? t('list.noMatch') : empty);
      const count = root.querySelector('#count');
      if (count) count.textContent = t('list.count', { n: list.length });
    };
    root.querySelectorAll('[data-size]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = b.dataset.size;
        f.sizes.has(s) ? f.sizes.delete(s) : f.sizes.add(s);
        b.setAttribute('aria-pressed', f.sizes.has(s));
        draw();
      }),
    );
    root.querySelector('#f-coll')?.addEventListener('change', (e) => ((f.coll = e.target.value), draw()));
    root.querySelector('#f-sort')?.addEventListener('change', (e) => ((f.sort = e.target.value), draw()));
    draw();
  };
  return { markup, mount };
}

function comingSoon(label, backHref) {
  return `<div class="empty">${crown('crown--ghost')}<h3>${t('list.soonTitle')}</h3><p>${t('list.soonText', { name: label })}</p>${
    backHref ? `<a class="btn btn--ghost" href="${backHref}">${t('list.seeAvailable')}</a>` : ''
  }</div>`;
}

export async function renderSection(section, sub) {
  const { products, collections } = await getCatalog();
  if (sub && !NAV[section].includes(sub)) sub = null;
  const inSection = products.filter((p) => (section === 'enxoval' ? p.enxoval : p.genders.includes(section)));
  const list = sub ? inSection.filter((p) => p.category === sub) : inSection;
  const sectionName = t(`nav.${section}`);
  const title = sub ? t(`cat.${sub}`) : sectionName;
  setTitle(sub ? `${title} · ${sectionName}` : title);

  const { markup, mount } = listing(list, collections, {
    empty: comingSoon(sub ? t(`cat.${sub}`) : sectionName, sub ? `/${section}` : null),
  });
  main().innerHTML = html`
    ${banner({
      kicker: sub ? sectionName : t(`section.${section}.kicker`),
      title,
      text: t(`section.${section}.text`),
      photo: sub ? null : SECTION_PHOTO[section],
      crumbs: sub ? [{ href: `/${section}`, label: sectionName }, { label: title }] : [{ label: title }],
    })}
    <div class="container">
      <nav class="subnav" aria-label="${sectionName}">
        <a href="/${section}" class="${!sub ? 'is-active' : ''}">${t('common.all')}</a>
        ${NAV[section].map((s) => `<a href="/${section}/${s}" class="${sub === s ? 'is-active' : ''}">${t(`cat.${s}`)}</a>`)}
      </nav>
      ${list.length ? markup : comingSoon(title, sub ? `/${section}` : null)}
    </div>`;
  if (list.length) mount(main());
}

export async function renderCollections() {
  const { products, collections } = await getCatalog();
  setTitle(t('nav.colecoes'));
  main().innerHTML = html`
    ${banner({ kicker: t('collections.kicker'), title: t('nav.colecoes'), text: t('collections.text'), crumbs: [{ label: t('nav.colecoes') }] })}
    <div class="container collections-list">
      ${collections.map((c, i) => {
        const n = products.filter((p) => p.collections.includes(c.id)).length;
        return html`<a class="collection-row" href="/colecoes/${c.slug}">
          ${cropImg(c.image, c.name, { ratio: 4 / 3 })}
          <div>
            <span class="collection-card__num">0${i + 1}</span>
            <h2>${esc(c.name)}</h2>
            <p class="kicker">${tx(c.age)}</p>
            <p>${tx(c.description)}</p>
            <span class="link-arrow">${n ? t('collections.pieces', { n }) : t('list.soonTitle')}</span>
          </div>
        </a>`;
      })}
    </div>`;
}

export async function renderCollection(slug) {
  const { products, collections } = await getCatalog();
  const c = collections.find((x) => x.slug === slug);
  if (!c) {
    const { renderNotFound } = await import('./info.js');
    return renderNotFound();
  }
  const list = products.filter((p) => p.collections.includes(c.id));
  setTitle(c.name);
  const { markup, mount } = listing(list, []);
  main().innerHTML = html`
    ${banner({
      kicker: tx(c.age),
      title: esc(c.name),
      text: tx(c.description),
      photo: c.image,
      crumbs: [{ href: '/colecoes', label: t('nav.colecoes') }, { label: esc(c.name) }],
    })}
    <div class="container">
      <nav class="subnav">${collections.map((x) => `<a href="/colecoes/${x.slug}" class="${x.id === c.id ? 'is-active' : ''}">${esc(x.name)}</a>`)}</nav>
      ${list.length ? markup : comingSoon(c.name, '/colecoes')}
    </div>`;
  if (list.length) mount(main());
}

export async function renderSearch(q) {
  const { products, collections } = await getCatalog();
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const list = products.filter((p) => {
    const hay = norm([p.name, tx(p.description), t(`cat.${p.category}`)].join(' '));
    return terms.every((w) => hay.includes(w));
  });
  const title = q ? t('search.resultsFor', { q: esc(q) }) : t('search.all');
  setTitle(q ? `${t('nav.search')}: ${q}` : t('search.all'));
  const { markup, mount } = listing(list, collections);
  main().innerHTML = html`
    ${banner({ title, crumbs: [{ label: t('nav.search') }] })}
    <div class="container">${list.length ? markup : `<div class="empty">${crown('crown--ghost')}<p>${t('search.none')}</p><a class="btn btn--ghost" href="/busca">${t('search.all')}</a></div>`}</div>`;
  if (list.length) mount(main());
}
