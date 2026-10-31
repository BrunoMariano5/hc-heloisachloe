// Pagamentos — estrutura pronta para integração, SEM provedor ativo.
// Nenhum pagamento é simulado e nenhum pedido é criado enquanto não houver gateway real.
//
// Para integrar, implemente um adaptador com a interface abaixo e registre em `adapters`:
//   createCheckout({ orderDraft, customer, returnUrls }) -> { redirectUrl | clientSecret, externalId }
//   verifyWebhook(req, rawBody) -> { externalId, status: 'paid'|'failed'|'refunded' }
// Dados de cartão NUNCA passam por este servidor: use o checkout/tokenização do provedor.
import { config } from '../config.js';
import { HttpError } from '../core/http.js';

const adapters = {
  // mercadopago: (await import('./payments/mercadopago.js')).default,
  // stripe: (await import('./payments/stripe.js')).default,
};

export function paymentStatus() {
  const adapter = adapters[config.payment.provider];
  return {
    enabled: Boolean(adapter && config.payment.apiKey),
    provider: adapter ? config.payment.provider : null,
    supported: ['mercadopago', 'stripe', 'pagarme'],
  };
}

export function createCheckout(args) {
  const status = paymentStatus();
  if (!status.enabled) throw new HttpError(503, 'PAYMENT_NOT_CONFIGURED');
  return adapters[status.provider].createCheckout(args);
}

export function registerPayments(router) {
  router.get('/api/payments/status', () => paymentStatus());
  // Webhook do gateway: confirmará o pagamento e criará o pedido (orders.createFromPayment)
  router.post('/api/payments/webhook', () => {
    throw new HttpError(501, 'PAYMENT_NOT_CONFIGURED');
  });
}
