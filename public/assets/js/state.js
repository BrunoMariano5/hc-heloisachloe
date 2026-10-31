// Estado do cliente: carrinho e favoritos (localStorage) e sessão da conta.
// O carrinho guarda só ids/tamanho/cor/quantidade: preços são sempre recalculados no servidor.
import { api } from './api.js';

const read = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};
const emit = () => window.dispatchEvent(new CustomEvent('hc:state'));

export const state = {
  cart: read('hc.cart', []),
  favorites: read('hc.favorites', []),
  customer: null,
};

// Carrinho
const lineKey = (l) => `${l.productId}|${l.size}|${l.color}`;

export function addToCart(item) {
  const existing = state.cart.find((l) => lineKey(l) === lineKey(item));
  if (existing) existing.qty = Math.min(20, existing.qty + item.qty);
  else state.cart.push({ ...item });
  write('hc.cart', state.cart);
  emit();
}

export function setQty(key, qty) {
  state.cart = state.cart
    .map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(0, Math.min(20, qty)) } : l))
    .filter((l) => l.qty > 0);
  write('hc.cart', state.cart);
  emit();
}

export const cartCount = () => state.cart.reduce((s, l) => s + l.qty, 0);
export { lineKey };

// Favoritos (sincroniza com a conta quando logado)
export function isFavorite(id) {
  return state.favorites.includes(id);
}

export async function toggleFavorite(id) {
  state.favorites = isFavorite(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
  write('hc.favorites', state.favorites);
  emit();
  if (state.customer) {
    try {
      state.customer = await api('/api/account/favorites', { method: 'PUT', body: { favorites: state.favorites } });
    } catch {}
  }
  return isFavorite(id);
}

// Conta
export async function loadCustomer() {
  try {
    state.customer = (await api('/api/account/me')).customer;
    if (state.customer) mergeFavorites(state.customer.favorites);
  } catch {
    state.customer = null;
  }
  emit();
}

export async function setCustomer(c) {
  state.customer = c;
  if (c) {
    mergeFavorites(c.favorites);
    // favoritos feitos antes do login sobem para a conta
    if (state.favorites.length !== c.favorites.length) {
      try {
        state.customer = await api('/api/account/favorites', { method: 'PUT', body: { favorites: state.favorites } });
      } catch {}
    }
  }
  emit();
}

function mergeFavorites(remote = []) {
  state.favorites = [...new Set([...state.favorites, ...remote])];
  write('hc.favorites', state.favorites);
}
