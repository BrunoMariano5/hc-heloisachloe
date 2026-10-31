// Precificação do carrinho SEMPRE no servidor, a partir do catálogo —
// o navegador só informa { productId, size, color, qty }.
import { HttpError } from '../core/http.js';
import { products } from './catalog.js';

export function priceCart(items) {
  if (!Array.isArray(items) || items.length > 50) throw new HttpError(400, 'INVALID_CART');
  const lines = [];
  for (const it of items) {
    const p = products.get(String(it.productId));
    const qty = Number(it.qty);
    if (!p || !p.active || !Number.isInteger(qty) || qty < 1 || qty > 20) continue;
    const stock = p.stock?.[it.size] ?? 0;
    lines.push({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      size: it.size,
      color: it.color,
      qty,
      unitPrice: p.price,
      total: Math.round(p.price * qty * 100) / 100,
      inStock: stock >= qty,
    });
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  return { lines, subtotal };
}
