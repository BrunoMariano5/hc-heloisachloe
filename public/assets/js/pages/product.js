// Página de produto: galeria, cor, tamanho, quantidade, carrinho, favorito e frete.
import { t, tx, money } from '../i18n.js';
import { getCatalog, api } from '../api.js';
import { cropImg, productGrid, priceTag, icons, esc, html, toast, errorMessage } from '../ui.js';
import { addToCart, isFavorite } from '../state.js';
import { main, setTitle } from '../nav.js';
import { shippingResult } from './checkout.js';

export async function render(slug) {
  const { products, collections } = await getCatalog();
  const p = products.find((x) => x.slug === slug);
  if (!p) {
    const { renderNotFound } = await import('./info.js');
    return renderNotFound();
  }
  setTitle(p.name);
  const colls = collections.filter((c) => p.collections.includes(c.id));
  const related = products.filter((x) => x.id !== p.id && (x.category === p.category || x.collections.some((c) => p.collections.includes(c)))).slice(0, 4);
  const fav = isFavorite(p.id);
  const firstSize = p.sizes.find((s) => s.available)?.size;

  main().innerHTML = html`
    <div class="container">
      <nav class="crumbs crumbs--page" aria-label="${t('common.breadcrumb')}">
        <a href="/">${t('nav.home')}</a> / <a href="/${p.category === 'kits' ? 'enxoval' : p.genders[0] || 'enxoval'}/${p.category}">${t(`cat.${p.category}`)}</a> / <span aria-current="page">${esc(p.name)}</span>
      </nav>
      <article class="pdp">
        <div class="pdp__gallery">
          <div class="pdp__main" id="pdp-main">${cropImg(p.images[0], `${p.name} — ${t('product.demoAlt')}`, { ratio: 4 / 5, eager: true })}</div>
          ${p.images.length > 1 ? html`<div class="pdp__thumbs">
            ${p.images.map((img, i) => html`<button class="pdp__thumb ${i === 0 ? 'is-on' : ''}" data-img="${i}" aria-label="${t('product.image', { n: i + 1 })}">${cropImg(img, '', { ratio: 1 })}</button>`)}
          </div>` : ''}
          ${p.demo ? `<p class="demo-note">${t('product.demoLong')}</p>` : ''}
        </div>

        <div class="pdp__info">
          <p class="kicker">${colls.map((c) => esc(c.name)).join(' · ')}</p>
          <h1>${esc(p.name)}</h1>
          <p class="pdp__price">${priceTag(p)}</p>
          <p class="pdp__desc">${esc(tx(p.description))}</p>

          <fieldset class="opt">
            <legend>${t('product.color')}: <strong id="color-name">${t(`colors.${p.colors[0].id}`)}</strong></legend>
            <div class="color-list">
              ${p.colors.map((c, i) => html`<label class="color"><input type="radio" name="color" value="${c.id}" ${i === 0 ? 'checked' : ''}><i style="background:${c.hex}"></i><span class="sr-only">${t(`colors.${c.id}`)}</span></label>`)}
            </div>
          </fieldset>

          <fieldset class="opt">
            <legend>${t('product.size')} <a href="#size-guide" class="link-sm">${t('product.sizeGuide')}</a></legend>
            <div class="size-list">
              ${p.sizes.map((s) => html`<label class="size ${s.available ? '' : 'is-out'}">
                <input type="radio" name="size" value="${esc(s.size)}" ${s.available ? '' : 'disabled'} ${s.size === firstSize ? 'checked' : ''}>
                <span>${esc(s.size)}</span>${s.low ? `<em>${t('product.lastUnits')}</em>` : ''}
              </label>`)}
            </div>
          </fieldset>

          <div class="buy">
            <div class="qty" role="group" aria-label="${t('product.qty')}">
              <button type="button" data-q="-1" aria-label="${t('product.less')}">${icons.minus}</button>
              <input id="qty" type="number" min="1" max="20" value="1" inputmode="numeric" aria-label="${t('product.qty')}">
              <button type="button" data-q="1" aria-label="${t('product.more')}">${icons.plus}</button>
            </div>
            <button class="btn btn--block" id="add" ${firstSize ? '' : 'disabled'}>${firstSize ? t('product.addToCart') : t('product.soldOut')}</button>
            <button class="icon-btn icon-btn--outline card__fav ${fav ? 'is-on' : ''}" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${t('product.favorite')}">${icons.heart}</button>
          </div>

          <form class="ship-calc" id="ship">
            <label for="cep">${icons.truck} ${t('shipping.calc')}</label>
            <div class="inline-form">
              <input id="cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9">
              <button class="btn btn--ghost btn--sm">${t('shipping.calcBtn')}</button>
            </div>
            <div id="ship-result" aria-live="polite"></div>
          </form>

          <div class="accordion">
            <details open><summary>${t('product.details')}</summary><ul class="ticks">${(tx(p.details) || []).map((d) => `<li>${esc(d)}</li>`)}</ul></details>
            <details id="size-guide"><summary>${t('product.sizeGuide')}</summary>
              <table class="table"><thead><tr><th>${t('product.size')}</th><th>${t('sizes.age')}</th><th>${t('sizes.height')}</th></tr></thead><tbody>
                ${[['RN', '0–1', '≤ 50'], ['P', '1–3', '50–60'], ['M', '3–6', '60–68'], ['G', '6–9', '68–74'], ['GG', '9–12', '74–80'], ['1', '12–18', '80–86'], ['2', '18–24', '86–92']]
                  .map(([s, a, h]) => `<tr><td>${s}</td><td>${a} ${t('sizes.months')}</td><td>${h} cm</td></tr>`)}
              </tbody></table>
              <p class="muted">${t('sizes.note')}</p>
            </details>
            <details><summary>${t('product.care')}</summary><p>${t('product.careText')}</p></details>
            <details><summary>${t('product.exchange')}</summary><p>${t('product.exchangeText')}</p></details>
          </div>
        </div>
      </article>

      ${related.length ? html`<section class="section"><div class="section-head"><div><p class="kicker">${t('product.relatedKicker')}</p><h2>${t('product.related')}</h2></div></div>${productGrid(related)}</section>` : ''}
    </div>`;

  const root = main();
  root.querySelectorAll('[data-img]').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelector('#pdp-main').innerHTML = cropImg(p.images[+b.dataset.img], `${p.name} — ${t('product.demoAlt')}`, { ratio: 4 / 5 });
      root.querySelectorAll('[data-img]').forEach((x) => x.classList.toggle('is-on', x === b));
    }),
  );
  root.querySelectorAll('input[name=color]').forEach((r) =>
    r.addEventListener('change', () => (root.querySelector('#color-name').textContent = t(`colors.${r.value}`))),
  );
  const qty = root.querySelector('#qty');
  root.querySelectorAll('[data-q]').forEach((b) =>
    b.addEventListener('click', () => (qty.value = Math.min(20, Math.max(1, (+qty.value || 1) + +b.dataset.q)))),
  );
  root.querySelector('#add').addEventListener('click', () => {
    const size = root.querySelector('input[name=size]:checked')?.value;
    if (!size) return toast(t('product.chooseSize'));
    addToCart({ productId: p.id, size, color: root.querySelector('input[name=color]:checked').value, qty: Math.min(20, Math.max(1, +qty.value || 1)) });
    toast(t('product.added', { name: esc(p.name) }), { href: '/carrinho', label: t('cart.view') });
  });
  const cep = root.querySelector('#cep');
  cep.addEventListener('input', () => (cep.value = cep.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9)));
  root.querySelector('#ship').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = root.querySelector('#ship-result');
    try {
      const size = root.querySelector('input[name=size]:checked')?.value || p.sizes[0].size;
      const r = await api('/api/shipping/quote', { method: 'POST', body: { cep: cep.value, items: [{ productId: p.id, size, qty: +qty.value || 1 }] } });
      out.innerHTML = shippingResult(r.options);
    } catch (err) {
      out.innerHTML = `<p class="form-error">${errorMessage(err)}</p>`;
    }
  });
}
