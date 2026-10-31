// Pedidos. Um pedido só nasce de um pagamento confirmado pelo gateway (webhook).
// Enquanto não houver gateway, o checkout valida tudo e para antes do pagamento.
import crypto from 'node:crypto';
import { collection } from '../core/db.js';
import { HttpError, readJson, v } from '../core/http.js';
import { readSession } from '../core/auth.js';
import { priceCart } from './cart.js';
import { getShippingProvider, normalizeCep } from './shipping.js';
import { createCheckout, paymentStatus } from './payments.js';

export const orders = collection('orders');

export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'];

// Chamado pelo webhook do gateway quando o pagamento for aprovado.
export function createFromPayment({ draft, externalPaymentId }) {
  return orders.insert({
    id: `HC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    ...draft,
    status: 'paid',
    externalPaymentId,
    createdAt: new Date().toISOString(),
  });
}

export function registerOrders(router) {
  // Monta e valida o pedido (preços, estoque, frete) e entrega ao gateway.
  router.post('/api/checkout', async ({ req }) => {
    const body = await readJson(req);
    const { lines, subtotal } = priceCart(body.items || []);
    if (!lines.length) throw new HttpError(400, 'EMPTY_CART');
    if (lines.some((l) => !l.inStock)) throw new HttpError(409, 'OUT_OF_STOCK');

    const cep = normalizeCep(body.cep);
    const option = getShippingProvider()
      .quote({ cep, subtotal })
      .find((o) => o.id === body.shippingOption);
    if (!option) throw new HttpError(400, 'INVALID_SHIPPING');

    // Endereço e contato são validados, mas não são gravados aqui:
    // ficam no rascunho entregue ao gateway e só persistem com o pedido pago.
    const a = body.address || {};
    const draft = {
      customerId: readSession(req, 'customer')?.subjectId || null,
      lines,
      subtotal,
      shipping: { cep, option: option.id, price: option.price, days: option.days },
      total: Math.round((subtotal + option.price) * 100) / 100,
      address: {
        name: v.str(a.name, { min: 3, max: 120, field: 'name' }),
        email: v.email(a.email),
        street: v.str(a.street, { min: 3, max: 160, field: 'street' }),
        number: v.str(a.number, { min: 1, max: 20, field: 'number' }),
        complement: v.str(a.complement || '', { max: 80, field: 'complement' }),
        city: v.str(a.city, { min: 2, max: 80, field: 'city' }),
        state: v.str(a.state, { min: 2, max: 2, field: 'state' }).toUpperCase(),
      },
    };

    const payment = createCheckout({ orderDraft: draft }); // 503 enquanto não houver gateway
    return { payment, total: draft.total };
  });

  router.get('/api/checkout/status', () => paymentStatus());
}
