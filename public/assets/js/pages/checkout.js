// Carrinho e checkout. O checkout valida tudo no servidor e para antes do pagamento
// enquanto nenhum gateway estiver ativo: nenhum pedido é criado e nada é cobrado.
import { t, tx, money } from '../i18n.js';
import { getCatalog, getSettings, api } from '../api.js';
import { cropImg, crown, icons, esc, html, errorMessage } from '../ui.js';
import { state, setQty, lineKey } from '../state.js';
import { main, setTitle } from '../nav.js';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

const ss = {
  get: (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const cartItems = () => state.cart.map(({ productId, size, color, qty }) => ({ productId, size, color, qty }));
const maskCep = (v) => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);

export function shippingResult(options, { selectable = false, selected } = {}) {
  return html`<ul class="ship-options">
    ${options.map((o) => html`<li>
      ${selectable ? `<label><input type="radio" name="shipping" value="${o.id}" ${o.id === selected ? 'checked' : ''} required>` : '<span>'}
      <span><strong>${t(`shipping.${o.id}`)}</strong> · ${t('shipping.days', { n: o.days })}</span>
      <span class="ship-price">${o.price === 0 ? t('shipping.free') : money(o.price)}</span>
      ${selectable ? '</label>' : '</span>'}
    </li>`)}
  </ul>
  <p class="muted small">${t('shipping.estimateNote')}</p>`;
}

async function lines() {
  const { products } = await getCatalog();
  return state.cart
    .map((l) => ({ ...l, key: lineKey(l), product: products.find((p) => p.id === l.productId) }))
    .filter((l) => l.product);
}

function emptyCart() {
  return `<section class="container page-msg">${crown('crown--ghost')}<h1>${t('cart.emptyTitle')}</h1><p>${t('cart.emptyText')}</p><a class="btn" href="/">${t('cart.continue')}</a></section>`;
}

function summaryLines(items) {
  return items.map((l) => html`<li class="mini-line">
    ${cropImg(l.product.images[0], l.product.name, { ratio: 1 })}
    <span><strong>${esc(l.product.name)}</strong><small>${t(`colors.${l.color}`)} · ${esc(l.size)} · ${l.qty}×</small></span>
    <span>${money(l.product.price * l.qty)}</span>
  </li>`).join('');
}

export async function renderCart() {
  setTitle(t('nav.cart'));
  const items = await lines();
  if (!items.length) return (main().innerHTML = emptyCart());
  const settings = await getSettings();
  const subtotal = items.reduce((s, l) => s + l.product.price * l.qty, 0);
  const free = settings.freeShippingThreshold;
  const saved = ss.get('hc.ship');

  main().innerHTML = html`
    <div class="container cart-page">
      <h1>${t('nav.cart')}</h1>
      <div class="cart-layout">
        <ul class="cart-lines">
          ${items.map((l) => html`<li class="cart-line">
            <a href="/produto/${l.product.slug}">${cropImg(l.product.images[0], l.product.name, { ratio: 4 / 5 })}</a>
            <div class="cart-line__info">
              <a href="/produto/${l.product.slug}" class="cart-line__name">${esc(l.product.name)}</a>
              <p class="muted">${t('product.color')}: ${t(`colors.${l.color}`)} · ${t('product.size')}: ${esc(l.size)}</p>
              <div class="qty qty--sm">
                <button data-set="${l.key}" data-v="${l.qty - 1}" aria-label="${t('product.less')}">${icons.minus}</button>
                <span>${l.qty}</span>
                <button data-set="${l.key}" data-v="${l.qty + 1}" aria-label="${t('product.more')}">${icons.plus}</button>
              </div>
            </div>
            <div class="cart-line__end">
              <strong>${money(l.product.price * l.qty)}</strong>
              <button class="link-sm" data-set="${l.key}" data-v="0">${t('cart.remove')}</button>
            </div>
          </li>`)}
        </ul>
        <aside class="summary">
          <h2>${t('cart.summary')}</h2>
          ${free ? html`<div class="free-bar">
            <p>${subtotal >= free ? t('cart.freeReached') : t('cart.freeMissing', { v: money(free - subtotal) })}</p>
            <span><i style="width:${Math.min(100, (subtotal / free) * 100)}%"></i></span>
          </div>` : ''}
          <dl class="totals"><dt>${t('cart.subtotal')}</dt><dd>${money(subtotal)}</dd></dl>
          <form class="ship-calc" id="ship">
            <label for="cep">${icons.truck} ${t('shipping.calc')}</label>
            <div class="inline-form">
              <input id="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" value="${esc(saved?.cep ? maskCep(saved.cep) : '')}">
              <button class="btn btn--ghost btn--sm">${t('shipping.calcBtn')}</button>
            </div>
            <div id="ship-result" aria-live="polite"></div>
          </form>
          <a class="btn btn--block" href="/checkout">${t('cart.checkout')}</a>
          <a class="link-sm center" href="/">${t('cart.continue')}</a>
        </aside>
      </div>
    </div>`;

  const root = main();
  root.querySelectorAll('[data-set]').forEach((b) =>
    b.addEventListener('click', () => {
      setQty(b.dataset.set, +b.dataset.v);
      renderCart();
    }),
  );
  const cep = root.querySelector('#cep');
  cep.addEventListener('input', () => (cep.value = maskCep(cep.value)));
  const quote = async () => {
    const out = root.querySelector('#ship-result');
    try {
      const r = await api('/api/shipping/quote', { method: 'POST', body: { cep: cep.value, items: cartItems() } });
      ss.set('hc.ship', { cep: r.cep });
      out.innerHTML = shippingResult(r.options);
    } catch (err) {
      out.innerHTML = `<p class="form-error">${errorMessage(err)}</p>`;
    }
  };
  root.querySelector('#ship').addEventListener('submit', (e) => (e.preventDefault(), quote()));
  if (saved?.cep) quote();
}

export async function renderCheckout() {
  setTitle(t('checkout.title'));
  const items = await lines();
  if (!items.length) return (main().innerHTML = emptyCart());
  const status = await api('/api/checkout/status').catch(() => ({ enabled: false }));
  const subtotal = items.reduce((s, l) => s + l.product.price * l.qty, 0);
  const c = state.customer;
  const saved = ss.get('hc.ship');

  const field = (name, label, attrs = '', value = '') =>
    `<label class="field" data-field="${name}"><span>${label}</span><input name="${name}" ${attrs} value="${esc(value)}"><em class="field__err"></em></label>`;

  main().innerHTML = html`
    <div class="container checkout">
      <h1>${t('checkout.title')}</h1>
      <div class="cart-layout">
        <form id="checkout" class="checkout__form" novalidate>
          <section class="step">
            <h2><span>1</span>${t('checkout.contact')}</h2>
            ${c ? `<p class="muted">${t('checkout.loggedAs', { name: esc(c.name) })}</p>` : `<p class="muted">${t('checkout.haveAccount')} <a href="/conta?next=/checkout">${t('account.login')}</a></p>`}
            <div class="fields">
              ${field('name', t('form.name'), 'autocomplete="name" required minlength="3"', c?.name)}
              ${field('email', t('form.email'), 'type="email" autocomplete="email" required', c?.email)}
            </div>
          </section>
          <section class="step">
            <h2><span>2</span>${t('checkout.address')}</h2>
            <div class="fields">
              ${field('cep', t('form.cep'), 'inputmode="numeric" autocomplete="postal-code" required maxlength="9" placeholder="00000-000"', saved?.cep ? maskCep(saved.cep) : '')}
              ${field('street', t('form.street'), 'autocomplete="address-line1" required')}
              ${field('number', t('form.number'), 'required')}
              ${field('complement', t('form.complement'), 'autocomplete="address-line2"')}
              ${field('city', t('form.city'), 'autocomplete="address-level2" required')}
              <label class="field" data-field="state"><span>${t('form.state')}</span>
                <select name="state" autocomplete="address-level1" required><option value=""></option>${UFS.map((u) => `<option>${u}</option>`)}</select><em class="field__err"></em></label>
            </div>
          </section>
          <section class="step">
            <h2><span>3</span>${t('checkout.shipping')}</h2>
            <div id="ship-options" data-field="shippingOption"><p class="muted">${t('checkout.shippingHint')}</p></div>
          </section>
          <section class="step">
            <h2><span>4</span>${t('checkout.payment')}</h2>
            <div class="notice ${status.enabled ? '' : 'notice--info'}">
              ${icons.shield}
              <div>
                <strong>${status.enabled ? t('checkout.paymentReady') : t('checkout.paymentPendingTitle')}</strong>
                <p>${status.enabled ? t('checkout.paymentReadyText') : t('checkout.paymentPendingText')}</p>
              </div>
            </div>
          </section>
          <p class="form-error" id="form-error" role="alert"></p>
          <div id="result" aria-live="polite"></div>
          <button class="btn btn--block" id="submit">${t('checkout.submit')}</button>
          <p class="muted small center">${t('checkout.privacy')}</p>
        </form>
        <aside class="summary">
          <h2>${t('cart.summary')}</h2>
          <ul class="mini-lines">${summaryLines(items)}</ul>
          <dl class="totals">
            <dt>${t('cart.subtotal')}</dt><dd>${money(subtotal)}</dd>
            <dt>${t('checkout.shipping')}</dt><dd id="sum-ship">—</dd>
            <dt class="total">${t('cart.total')}</dt><dd class="total" id="sum-total">${money(subtotal)}</dd>
          </dl>
          <a href="/carrinho" class="link-sm">${t('checkout.editCart')}</a>
        </aside>
      </div>
    </div>`;

  const root = main();
  const form = root.querySelector('#checkout');
  let options = [];

  const updateTotals = () => {
    const sel = options.find((o) => o.id === form.querySelector('input[name=shipping]:checked')?.value);
    root.querySelector('#sum-ship').textContent = sel ? (sel.price === 0 ? t('shipping.free') : money(sel.price)) : '—';
    root.querySelector('#sum-total').textContent = money(subtotal + (sel?.price || 0));
  };

  const loadShipping = async () => {
    const box = root.querySelector('#ship-options');
    const cep = form.cep.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await api('/api/shipping/quote', { method: 'POST', body: { cep, items: cartItems() } });
      options = r.options;
      ss.set('hc.ship', { cep: r.cep });
      box.innerHTML = shippingResult(options, { selectable: true, selected: options[0]?.id });
      box.querySelectorAll('input').forEach((i) => i.addEventListener('change', updateTotals));
      updateTotals();
    } catch (err) {
      box.innerHTML = `<p class="form-error">${errorMessage(err)}</p>`;
    }
  };

  form.cep.addEventListener('input', () => {
    form.cep.value = maskCep(form.cep.value);
    if (form.cep.value.length === 9) loadShipping();
  });
  if (saved?.cep) loadShipping();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('has-error'));
    root.querySelector('#form-error').textContent = '';
    root.querySelector('#result').innerHTML = '';
    const btn = root.querySelector('#submit');
    btn.disabled = true;
    const fd = Object.fromEntries(new FormData(form));
    try {
      await api('/api/checkout', {
        method: 'POST',
        body: {
          items: cartItems(),
          cep: fd.cep,
          shippingOption: fd.shipping,
          address: { name: fd.name, email: fd.email, street: fd.street, number: fd.number, complement: fd.complement, city: fd.city, state: fd.state },
        },
      });
    } catch (err) {
      if (err.code === 'PAYMENT_NOT_CONFIGURED') {
        root.querySelector('#result').innerHTML = html`<div class="notice notice--ok">${crown()}<div>
          <strong>${t('checkout.validatedTitle')}</strong><p>${t('checkout.validatedText')}</p>
          <a class="link-sm" href="/contato">${t('checkout.talkToUs')}</a></div></div>`;
      } else {
        const name = err.field || { INVALID_CEP: 'cep', INVALID_SHIPPING: 'shippingOption' }[err.code];
        const el = name && form.querySelector(`[data-field="${name}"]`);
        if (el) {
          el.classList.add('has-error');
          const msg = el.querySelector('.field__err');
          if (msg) msg.textContent = errorMessage(err);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        root.querySelector('#form-error').textContent = errorMessage(err);
      }
    } finally {
      btn.disabled = false;
    }
  });
}
