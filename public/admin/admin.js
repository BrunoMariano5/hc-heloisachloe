// Painel administrativo HC (interno, em português). Toda a proteção está na API:
// sem sessão de administrador, nenhuma rota /api/admin responde.
import { api } from '/assets/js/api.js';
import { esc, logo, toast } from '/assets/js/ui.js';

const root = document.getElementById('admin-root');
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const date = (s) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const CATEGORIES = { macacoes: 'Macacões', bodies: 'Bodies', camisetas: 'Camisetas', toucas: 'Toucas', natacao: 'Moda praia', kits: 'Kits recém-nascido', mantas: 'Mantas', toalhas: 'Toalhas', cueiros: 'Cueiros', acessorios: 'Acessórios' };
const STATUS = { awaiting_payment: 'Aguardando pagamento', paid: 'Pago', preparing: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado', refunded: 'Reembolsado' };
const VIEWS = { dashboard: 'Painel', products: 'Produtos e estoque', collections: 'Coleções', orders: 'Pedidos', customers: 'Clientes', settings: 'Configurações' };

let me = null;
let view = 'dashboard';
let lowThreshold = 8;

const errText = (e) =>
  ({ INVALID_CREDENTIALS: 'E-mail ou senha incorretos.', TOO_MANY_ATTEMPTS: 'Muitas tentativas. Aguarde 15 minutos.', SLUG_IN_USE: 'Este slug já está em uso.', INVALID_FIELD: `Campo inválido: ${e.field}`, UNAUTHENTICATED: 'Sessão expirada. Entre novamente.' })[e.code] ||
  'Não foi possível concluir. Tente novamente.';

async function call(path, opts) {
  try {
    return await api(path, opts);
  } catch (e) {
    if (e.code === 'UNAUTHENTICATED') {
      me = null;
      renderLogin();
    }
    throw e;
  }
}

function renderLogin() {
  root.innerHTML = `<div class="adm-login"><form id="login" novalidate>
    ${logo()}
    <h1 style="font-size:1.6rem;margin:0">Administração</h1>
    <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="field"><span>Senha</span><input name="password" type="password" autocomplete="current-password" required></label>
    <p class="form-error" role="alert"></p>
    <button class="btn btn--block">Entrar</button>
    <a class="link-sm" href="/">Voltar à loja</a>
  </form></div>`;
  root.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      me = await api('/api/admin/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
      renderShell();
    } catch (err) {
      f.querySelector('.form-error').textContent = errText(err);
    }
  });
}

function renderShell() {
  root.innerHTML = `<div class="adm">
    <aside class="adm-side">
      <a href="/admin">${logo({ size: 'sm' })}</a>
      <nav>${Object.entries(VIEWS).map(([k, l]) => `<button data-view="${k}" class="${k === view ? 'is-on' : ''}">${l}</button>`).join('')}</nav>
      <footer><span>${esc(me.email)}</span><a href="/" target="_blank" rel="noopener">Ver loja</a><button id="logout">Sair</button></footer>
    </aside>
    <main class="adm-main" id="view"></main>
  </div>`;
  root.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.view;
      root.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('is-on', x === b));
      renderView();
    }),
  );
  root.querySelector('#logout').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST', body: {} });
    me = null;
    renderLogin();
  });
  renderView();
}

async function renderView() {
  const el = document.getElementById('view');
  el.innerHTML = '<p class="muted">Carregando…</p>';
  try {
    await { dashboard, products, collections, orders, customers, settings }[view](el);
  } catch (e) {
    if (e.code !== 'UNAUTHENTICATED') el.innerHTML = `<p class="form-error">${errText(e)}</p>`;
  }
}

async function dashboard(el) {
  const d = await call('/api/admin/dashboard');
  el.innerHTML = `
    <div class="adm-head"><h1>Painel</h1></div>
    ${d.payment.enabled
      ? `<div class="status-note">Pagamentos ativos via <strong>${esc(d.payment.provider)}</strong>.</div>`
      : `<div class="status-note status-note--warn"><strong>Gateway de pagamento não configurado.</strong> O checkout valida carrinho, estoque e frete e para antes do pagamento — nenhum pedido é criado. Para ativar, implemente um adaptador em <code>server/modules/payments.js</code> (${d.payment.supported.join(', ')}) e defina <code>PAYMENT_PROVIDER</code> no .env.</div>`}
    <div class="kpis">
      <div class="kpi"><span>Faturamento</span><strong>${brl(d.orders.revenue)}</strong><small>${d.orders.paid} pedidos pagos</small></div>
      <div class="kpi"><span>Ticket médio</span><strong>${brl(d.orders.averageTicket)}</strong><small>${d.orders.total} pedidos no total</small></div>
      <div class="kpi"><span>Clientes</span><strong>${d.customers}</strong><small>contas cadastradas</small></div>
      <div class="kpi"><span>Estoque</span><strong>${d.stock.units}</strong><small>peças · ${brl(d.stock.value)} em preço de venda</small></div>
    </div>
    <div class="adm-card"><h2>Estoque baixo</h2>
      ${d.stock.low.length ? `<ul class="low-list">${d.stock.low.map((l) => `<li><span class="pill pill--off">${l.qty}</span> ${esc(l.name)} — tamanho ${esc(l.size)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum item abaixo do limite.</p>'}
    </div>
    <div class="adm-card"><h2>Catálogo</h2><p>${d.products.active} de ${d.products.total} produtos ativos na loja.</p></div>`;
}

// Produtos
async function products(el) {
  const [list, colls, s] = await Promise.all([call('/api/admin/products'), call('/api/admin/collections'), call('/api/admin/settings')]);
  lowThreshold = s.lowStockThreshold ?? 8;
  el.innerHTML = `
    <div class="adm-head"><h1>Produtos e estoque</h1><button class="btn btn--sm" id="new">Novo produto</button></div>
    <div class="adm-card"><table class="adm-table">
      <thead><tr><th>Produto</th><th>Categoria</th><th>Preço (R$)</th><th>Estoque por tamanho</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((p) => `<tr data-id="${p.id}">
        <td><strong>${esc(p.name)}</strong><br><small class="muted">/${esc(p.slug)}${p.demo ? ' · demonstrativo' : ''}</small></td>
        <td>${CATEGORIES[p.category] || esc(p.category)}</td>
        <td><input class="mini price-in" type="number" step="0.01" min="0.01" value="${p.price}" data-price aria-label="Preço de ${esc(p.name)}"></td>
        <td><div class="stock-cells">${Object.entries(p.stock).map(([size, q]) => `<label class="${q <= lowThreshold ? 'low' : ''}">${esc(size)}<input class="mini" type="number" min="0" step="1" value="${q}" data-stock="${esc(size)}"></label>`).join('')}</div></td>
        <td><button class="pill ${p.active ? 'pill--on' : 'pill--off'}" data-toggle>${p.active ? 'Ativo' : 'Inativo'}</button></td>
        <td><button class="link-sm" data-edit>Editar</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="muted small">Preço e estoque são salvos ao sair do campo.</p>`;

  el.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    const p = list.find((x) => x.id === id);
    tr.querySelector('[data-price]').addEventListener('change', async (e) => {
      try {
        await call(`/api/admin/products/${id}`, { method: 'PATCH', body: { price: Number(e.target.value) } });
        toast('Preço atualizado');
      } catch (err) { toast(errText(err)); }
    });
    tr.querySelectorAll('[data-stock]').forEach((inp) =>
      inp.addEventListener('change', async () => {
        try {
          await call(`/api/admin/products/${id}`, { method: 'PATCH', body: { stock: { [inp.dataset.stock]: Number(inp.value) } } });
          inp.parentElement.classList.toggle('low', Number(inp.value) <= lowThreshold);
          toast('Estoque atualizado');
        } catch (err) { toast(errText(err)); }
      }),
    );
    tr.querySelector('[data-toggle]').addEventListener('click', async () => {
      await call(`/api/admin/products/${id}`, { method: 'PATCH', body: { active: !p.active } });
      renderView();
    });
    tr.querySelector('[data-edit]').addEventListener('click', () => productDialog(p, colls));
  });
  el.querySelector('#new').addEventListener('click', () => productDialog(null, colls));
}

function productDialog(p, colls) {
  const d = document.createElement('dialog');
  d.className = 'adm-dialog';
  const desc = p?.description || {};
  d.innerHTML = `<form method="dialog" class="adm-form" novalidate>
    <h2 class="full">${p ? 'Editar produto' : 'Novo produto'}</h2>
    <label class="field"><span>Nome</span><input name="name" required value="${esc(p?.name)}"></label>
    <label class="field"><span>Slug (URL)</span><input name="slug" required pattern="[a-z0-9-]+" value="${esc(p?.slug)}"></label>
    <label class="field"><span>Preço (R$)</span><input name="price" type="number" step="0.01" min="0.01" required value="${p?.price ?? ''}"></label>
    <label class="field"><span>Preço "de" (opcional)</span><input name="compareAtPrice" type="number" step="0.01" value="${p?.compareAtPrice ?? ''}"></label>
    <label class="field"><span>Categoria</span><select name="category">${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}" ${p?.category === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="field"><span>Estoque (ex.: RN:10, P:20, M:15)</span><input name="stock" value="${esc(p ? Object.entries(p.stock).map(([s, q]) => `${s}:${q}`).join(', ') : 'P:0, M:0, G:0')}"></label>
    <div class="full"><span class="small muted">Público e coleções</span><div class="adm-checks">
      <label><input type="checkbox" name="g-meninos" ${p?.genders?.includes('meninos') ? 'checked' : ''}> Meninos</label>
      <label><input type="checkbox" name="g-meninas" ${p?.genders?.includes('meninas') ? 'checked' : ''}> Meninas</label>
      <label><input type="checkbox" name="enxoval" ${p?.enxoval ? 'checked' : ''}> Enxoval</label>
      ${colls.map((c) => `<label><input type="checkbox" name="c-${c.id}" ${p?.collections?.includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}
    </div></div>
    <div class="full"><span class="small muted">Vitrine</span><div class="adm-checks">
      <label><input type="checkbox" name="t-bestseller" ${p?.tags?.includes('bestseller') ? 'checked' : ''}> Mais vendido</label>
      <label><input type="checkbox" name="t-new" ${p?.tags?.includes('new') ? 'checked' : ''}> Novidade</label>
      <label><input type="checkbox" name="active" ${p ? (p.active ? 'checked' : '') : ''}> Ativo na loja</label>
      <label><input type="checkbox" name="demo" ${p ? (p.demo ? 'checked' : '') : 'checked'}> Modelo demonstrativo</label>
    </div></div>
    <label class="field full"><span>Descrição — Português</span><textarea name="d-pt" required>${esc(desc.pt)}</textarea></label>
    <label class="field full"><span>Descrição — English</span><textarea name="d-en">${esc(desc.en)}</textarea></label>
    <label class="field full"><span>Descrição — 日本語</span><textarea name="d-ja">${esc(desc.ja)}</textarea></label>
    <p class="full muted small">Imagens: o upload depende de um armazenamento de arquivos (ex.: S3, Cloudinary) e será ativado com a infraestrutura definitiva. Produtos novos usam uma imagem provisória com a coroa HC.</p>
    <p class="form-error full" role="alert"></p>
    <div class="actions full">
      ${p ? '<button type="button" class="link-sm danger" data-del style="margin-right:auto">Excluir</button>' : ''}
      <button type="button" class="btn btn--ghost btn--sm" data-close>Cancelar</button>
      <button class="btn btn--sm">Salvar</button>
    </div>
  </form>`;
  document.body.append(d);
  d.showModal();
  d.addEventListener('close', () => d.remove());
  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  d.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!confirm(`Excluir "${p.name}" do catálogo?`)) return;
    await call(`/api/admin/products/${p.id}`, { method: 'DELETE', body: {} });
    d.close();
    toast('Produto excluído');
    renderView();
  });
  const f = d.querySelector('form');
  f.slug.addEventListener('focus', () => {
    if (!f.slug.value) f.slug.value = f.elements.namedItem('name').value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const stock = {};
    for (const part of String(fd.get('stock')).split(',')) {
      const [s, q] = part.split(':').map((x) => x?.trim());
      if (s) stock[s] = Number(q) || 0;
    }
    const body = {
      name: fd.get('name'), slug: fd.get('slug'), price: Number(fd.get('price')),
      compareAtPrice: fd.get('compareAtPrice') ? Number(fd.get('compareAtPrice')) : null,
      category: fd.get('category'), stock,
      genders: ['meninos', 'meninas'].filter((g) => fd.get(`g-${g}`)),
      collections: colls.map((c) => c.id).filter((id) => fd.get(`c-${id}`)),
      enxoval: Boolean(fd.get('enxoval')), active: Boolean(fd.get('active')), demo: Boolean(fd.get('demo')),
      tags: ['bestseller', 'new'].filter((t) => fd.get(`t-${t}`)),
      description: { pt: fd.get('d-pt'), en: fd.get('d-en'), ja: fd.get('d-ja') },
    };
    try {
      await call(p ? `/api/admin/products/${p.id}` : '/api/admin/products', { method: p ? 'PUT' : 'POST', body });
      d.close();
      toast('Produto salvo');
      renderView();
    } catch (err) {
      f.querySelector('.form-error').textContent = errText(err);
    }
  });
}

// Coleções
async function collections(el) {
  const list = await call('/api/admin/collections');
  el.innerHTML = `
    <div class="adm-head"><h1>Coleções</h1><button class="btn btn--sm" id="new">Nova coleção</button></div>
    <div class="adm-card"><table class="adm-table">
      <thead><tr><th>Ordem</th><th>Coleção</th><th>Faixa etária</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((c) => `<tr><td>${c.order}</td><td><strong>${esc(c.name)}</strong><br><small class="muted">/colecoes/${esc(c.slug)}</small></td><td>${esc(c.age.pt)}</td>
        <td><span class="pill ${c.active ? 'pill--on' : 'pill--off'}">${c.active ? 'Ativa' : 'Inativa'}</span></td>
        <td><button class="link-sm" data-edit="${c.id}">Editar</button></td></tr>`).join('')}</tbody>
    </table></div>`;
  el.querySelector('#new').addEventListener('click', () => collectionDialog(null));
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => collectionDialog(list.find((c) => c.id === b.dataset.edit))));
}

function collectionDialog(c) {
  const d = document.createElement('dialog');
  d.className = 'adm-dialog';
  const lang = (obj, prefix, label, area) =>
    ['pt', 'en', 'ja'].map((l) => `<label class="field ${area ? 'full' : ''}"><span>${label} — ${l.toUpperCase()}</span>${area ? `<textarea name="${prefix}-${l}">${esc(obj?.[l])}</textarea>` : `<input name="${prefix}-${l}" value="${esc(obj?.[l])}">`}</label>`).join('');
  d.innerHTML = `<form class="adm-form" novalidate>
    <h2 class="full">${c ? 'Editar coleção' : 'Nova coleção'}</h2>
    <label class="field"><span>Nome</span><input name="name" value="${esc(c?.name)}" required></label>
    <label class="field"><span>Slug</span><input name="slug" value="${esc(c?.slug)}" ${c ? 'disabled' : ''} required></label>
    <label class="field"><span>Ordem</span><input name="order" type="number" value="${c?.order ?? ''}"></label>
    <div class="adm-checks"><label><input type="checkbox" name="active" ${!c || c.active ? 'checked' : ''}> Ativa</label></div>
    ${lang(c?.age, 'age', 'Faixa etária')}
    ${lang(c?.description, 'desc', 'Descrição', true)}
    <p class="form-error full" role="alert"></p>
    <div class="actions full"><button type="button" class="btn btn--ghost btn--sm" data-close>Cancelar</button><button class="btn btn--sm">Salvar</button></div>
  </form>`;
  document.body.append(d);
  d.showModal();
  d.addEventListener('close', () => d.remove());
  d.querySelector('[data-close]').addEventListener('click', () => d.close());
  const f = d.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const pick = (p) => ({ pt: fd.get(`${p}-pt`), en: fd.get(`${p}-en`), ja: fd.get(`${p}-ja`) });
    const body = { name: fd.get('name'), slug: fd.get('slug') || c?.slug, order: Number(fd.get('order')) || 1, active: Boolean(fd.get('active')), age: pick('age'), description: pick('desc') };
    try {
      await call(c ? `/api/admin/collections/${c.id}` : '/api/admin/collections', { method: c ? 'PUT' : 'POST', body });
      d.close();
      toast('Coleção salva');
      renderView();
    } catch (err) {
      f.querySelector('.form-error').textContent = errText(err);
    }
  });
}

// Pedidos
async function orders(el) {
  const { orders: list, statuses } = await call('/api/admin/orders');
  el.innerHTML = `
    <div class="adm-head"><h1>Pedidos</h1></div>
    ${list.length ? `<div class="adm-card"><table class="adm-table">
      <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${list.map((o) => `<tr><td><strong>${esc(o.id)}</strong></td><td>${date(o.createdAt)}</td><td>${esc(o.address?.name)}<br><small class="muted">${esc(o.address?.email)}</small></td>
        <td>${o.lines.reduce((s, l) => s + l.qty, 0)}</td><td>${brl(o.total)}</td>
        <td><select data-order="${esc(o.id)}">${statuses.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></td></tr>`).join('')}</tbody>
    </table></div>`
    : `<div class="adm-card"><p><strong>Nenhum pedido ainda.</strong></p><p class="muted">Pedidos são criados somente quando o gateway de pagamento confirmar um pagamento real (webhook em <code>/api/payments/webhook</code>). Fluxo de status preparado: ${statuses.map((s) => STATUS[s]).join(' → ')}.</p></div>`}`;
  el.querySelectorAll('[data-order]').forEach((s) =>
    s.addEventListener('change', async () => {
      await call(`/api/admin/orders/${encodeURIComponent(s.dataset.order)}`, { method: 'PATCH', body: { status: s.value } });
      toast('Status atualizado');
    }),
  );
}

// Clientes
async function customers(el) {
  const list = await call('/api/admin/customers');
  el.innerHTML = `
    <div class="adm-head"><h1>Clientes</h1><span class="muted">${list.length} cadastrados</span></div>
    <div class="status-note">Por segurança, a loja guarda apenas nome, e-mail e senha criptografada. CPF, telefone, endereço e dados de cartão não são armazenados até haver banco de dados com criptografia e política LGPD.</div>
    ${list.length ? `<div class="adm-card"><table class="adm-table">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Cadastro</th><th>Favoritos</th><th>Pedidos</th><th>Novidades</th></tr></thead>
      <tbody>${list.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${date(c.createdAt)}</td><td>${c.favorites}</td><td>${c.orders}</td><td>${c.marketingOptIn ? 'Sim' : 'Não'}</td></tr>`).join('')}</tbody>
    </table></div>` : '<div class="adm-card"><p class="muted">Nenhum cliente cadastrado ainda.</p></div>'}`;
}

// Configurações
async function settings(el) {
  const s = await call('/api/admin/settings');
  const c = s.contact || {};
  el.innerHTML = `
    <div class="adm-head"><h1>Configurações da loja</h1></div>
    <form class="adm-card adm-form" id="settings" novalidate>
      <label class="field full"><span>Nome da loja</span><input name="storeName" value="${esc(s.storeName)}"></label>
      <label class="field"><span>WhatsApp (com DDI e DDD, só números)</span><input name="whatsapp" value="${esc(c.whatsapp)}" placeholder="5511999999999"></label>
      <label class="field"><span>Instagram (usuário)</span><input name="instagram" value="${esc(c.instagram)}" placeholder="heloisachloe"></label>
      <label class="field"><span>E-mail de atendimento</span><input name="email" type="email" value="${esc(c.email)}"></label>
      <label class="field"><span>Frete grátis acima de (R$, 0 = desativado)</span><input name="free" type="number" step="0.01" value="${s.shipping?.freeShippingThreshold ?? 0}"></label>
      <label class="field"><span>Prazo de separação (dias úteis)</span><input name="handling" type="number" value="${s.shipping?.handlingDays ?? 2}"></label>
      <label class="field"><span>Alerta de estoque baixo (peças)</span><input name="low" type="number" value="${s.lowStockThreshold ?? 8}"></label>
      ${['pt', 'en', 'ja'].map((l) => `<label class="field"><span>Horário de atendimento — ${l.toUpperCase()}</span><input name="hours-${l}" value="${esc(c.hours?.[l])}"></label>`).join('')}
      <p class="form-error full" role="alert"></p>
      <div class="actions full"><button class="btn btn--sm">Salvar configurações</button></div>
    </form>
    <div class="adm-card"><h2>Integrações</h2><ul class="ticks">
      <li><strong>Pagamentos:</strong> adaptador em <code>server/modules/payments.js</code> + <code>PAYMENT_PROVIDER</code> no .env.</li>
      <li><strong>Frete:</strong> provedor em <code>server/modules/shipping.js</code> (Correios, Melhor Envio…) + <code>SHIPPING_PROVIDER</code>.</li>
      <li><strong>Banco de dados:</strong> trocar <code>server/core/db.js</code> (hoje arquivos JSON) por PostgreSQL ou similar.</li>
      <li><strong>Marketing:</strong> consentimento de novidades já é registrado por cliente (opt-in) para exportar a uma ferramenta de e-mail.</li>
    </ul></div>`;
  const f = el.querySelector('#settings');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    try {
      await call('/api/admin/settings', {
        method: 'PUT',
        body: {
          storeName: fd.get('storeName'),
          contact: { whatsapp: fd.get('whatsapp'), instagram: fd.get('instagram'), email: fd.get('email'), hours: { pt: fd.get('hours-pt'), en: fd.get('hours-en'), ja: fd.get('hours-ja') } },
          shipping: { freeShippingThreshold: Number(fd.get('free')) || 0, handlingDays: Number(fd.get('handling')) || 0 },
          lowStockThreshold: Number(fd.get('low')) || 0,
        },
      });
      toast('Configurações salvas');
    } catch (err) {
      f.querySelector('.form-error').textContent = errText(err);
    }
  });
}

try {
  me = await api('/api/admin/me');
  renderShell();
} catch {
  renderLogin();
}
