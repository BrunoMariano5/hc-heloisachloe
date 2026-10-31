// Conta do cliente (entrar / cadastrar / sair / excluir) e favoritos.
import { t } from '../i18n.js';
import { api, getCatalog } from '../api.js';
import { productGrid, crown, esc, html, errorMessage, toast } from '../ui.js';
import { state, setCustomer } from '../state.js';
import { main, setTitle, navigate } from '../nav.js';

export async function renderFavorites() {
  setTitle(t('nav.favorites'));
  const { products } = await getCatalog();
  const list = products.filter((p) => state.favorites.includes(p.id));
  main().innerHTML = html`
    <div class="container page-head">
      <h1>${t('nav.favorites')}</h1>
      <p class="muted">${state.customer ? t('favorites.synced') : t('favorites.local')}</p>
    </div>
    <div class="container">${list.length ? productGrid(list) : `<div class="empty">${crown('crown--ghost')}<p>${t('favorites.empty')}</p><a class="btn btn--ghost" href="/busca">${t('search.all')}</a></div>`}</div>`;
}

const field = (name, label, attrs = '') =>
  `<label class="field" data-field="${name}"><span>${label}</span><input name="${name}" ${attrs}><em class="field__err"></em></label>`;

function showError(form, err) {
  form.querySelectorAll('.field').forEach((f) => f.classList.remove('has-error'));
  const el = err.field && form.querySelector(`[data-field="${err.field}"]`);
  if (el) {
    el.classList.add('has-error');
    el.querySelector('.field__err').textContent = errorMessage(err);
  }
  form.querySelector('.form-error').textContent = errorMessage(err);
}

export async function renderAccount() {
  setTitle(t('nav.account'));
  const next = new URLSearchParams(location.search).get('next');
  const c = state.customer;

  if (c) {
    main().innerHTML = html`
      <div class="container account">
        <div class="page-head">${crown()}<h1>${t('account.hello', { name: esc(c.name.split(' ')[0]) })}</h1><p class="muted">${esc(c.email)}</p></div>
        <div class="account-grid">
          <a class="panel" href="/favoritos"><h2>${t('nav.favorites')}</h2><p>${t('account.favCount', { n: state.favorites.length })}</p></a>
          <div class="panel"><h2>${t('account.orders')}</h2><p class="muted">${t('account.noOrders')}</p></div>
          <div class="panel"><h2>${t('account.data')}</h2><p class="muted">${t('account.dataText')}</p>
            <div class="btn-row"><button class="btn btn--ghost btn--sm" id="logout">${t('account.logout')}</button>
            <button class="link-sm danger" id="delete">${t('account.delete')}</button></div></div>
        </div>
      </div>`;
    main().querySelector('#logout').addEventListener('click', async () => {
      await api('/api/account/logout', { method: 'POST', body: {} });
      await setCustomer(null);
      renderAccount();
    });
    main().querySelector('#delete').addEventListener('click', async () => {
      if (!confirm(t('account.deleteConfirm'))) return;
      await api('/api/account', { method: 'DELETE', body: {} });
      await setCustomer(null);
      toast(t('account.deleted'));
      renderAccount();
    });
    return;
  }

  main().innerHTML = html`
    <div class="container account">
      <div class="page-head">${crown()}<h1>${t('nav.account')}</h1><p class="muted">${t('account.intro')}</p></div>
      <div class="auth-grid">
        <form class="panel" id="login" novalidate>
          <h2>${t('account.login')}</h2>
          ${field('email', t('form.email'), 'type="email" autocomplete="email" required')}
          ${field('password', t('form.password'), 'type="password" autocomplete="current-password" required')}
          <p class="form-error" role="alert"></p>
          <button class="btn btn--block">${t('account.login')}</button>
        </form>
        <form class="panel" id="register" novalidate>
          <h2>${t('account.register')}</h2>
          ${field('name', t('form.name'), 'autocomplete="name" required')}
          ${field('email', t('form.email'), 'type="email" autocomplete="email" required')}
          ${field('password', t('form.password'), 'type="password" autocomplete="new-password" required minlength="8"')}
          <p class="muted small">${t('account.passwordHint')}</p>
          <label class="check" data-field="acceptPrivacy"><input type="checkbox" name="acceptPrivacy" required> <span>${t('account.privacy')}</span><em class="field__err"></em></label>
          <label class="check"><input type="checkbox" name="marketingOptIn"> <span>${t('account.marketing')}</span></label>
          <p class="form-error" role="alert"></p>
          <button class="btn btn--block">${t('account.create')}</button>
          <p class="muted small">${t('account.dataNote')}</p>
        </form>
      </div>
    </div>`;

  const done = async (customer) => {
    await setCustomer(customer);
    toast(t('account.welcome', { name: esc(customer.name.split(' ')[0]) }));
    if (next?.startsWith('/') && !next.startsWith('//')) navigate(next);
    else renderAccount();
  };

  main().querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      done(await api('/api/account/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } }));
    } catch (err) {
      showError(f, err);
    }
  });
  main().querySelector('#register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      done(await api('/api/account/register', {
        method: 'POST',
        body: {
          name: f.elements.namedItem('name').value, email: f.email.value, password: f.password.value,
          acceptPrivacy: f.acceptPrivacy.checked, marketingOptIn: f.marketingOptIn.checked, favorites: state.favorites,
        },
      }));
    } catch (err) {
      showError(f, err);
    }
  });
}
