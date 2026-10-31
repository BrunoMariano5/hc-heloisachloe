// Frete. Interface de provedor: quote({ cep, items }) -> [{ id, label, price, days }]
// Sem transportadora configurada usa uma tabela de ESTIMATIVA por região do CEP,
// sempre marcada como estimada para o cliente.
import { config } from '../config.js';
import { HttpError, readJson } from '../core/http.js';
import { settings } from './catalog.js';
import { priceCart } from './cart.js';

// Primeiro dígito do CEP → região aproximada
const REGIONS = {
  0: { region: 'SP', base: 18.9, days: 3 },
  1: { region: 'SP', base: 21.9, days: 4 },
  2: { region: 'RJ/ES', base: 24.9, days: 5 },
  3: { region: 'MG', base: 24.9, days: 5 },
  4: { region: 'BA/SE', base: 32.9, days: 7 },
  5: { region: 'PE/AL/PB/RN', base: 36.9, days: 8 },
  6: { region: 'CE/PI/MA/PA/AM/AP/RR/AC', base: 42.9, days: 10 },
  7: { region: 'DF/GO/TO/MT/MS/RO', base: 32.9, days: 7 },
  8: { region: 'PR/SC', base: 26.9, days: 5 },
  9: { region: 'RS', base: 29.9, days: 6 },
};

const estimateProvider = {
  id: 'estimate',
  quote({ cep, subtotal }) {
    const r = REGIONS[cep[0]];
    const s = settings.read().shipping || {};
    const handling = s.handlingDays ?? 2;
    const free = s.freeShippingThreshold && subtotal >= s.freeShippingThreshold;
    return [
      { id: 'standard', price: free ? 0 : r.base, days: r.days + handling, estimated: true },
      { id: 'express', price: Math.round(r.base * 1.8 * 100) / 100, days: Math.ceil(r.days / 2) + handling, estimated: true },
    ].map((o) => ({ ...o, region: r.region }));
  },
};

// Futuro: { correios, melhorenvio, jadlog } implementando a mesma interface
const providers = { estimate: estimateProvider };

export function getShippingProvider() {
  return providers[config.shipping.provider] || estimateProvider;
}

export function normalizeCep(raw) {
  const cep = String(raw || '').replace(/\D/g, '');
  if (cep.length !== 8) throw new HttpError(400, 'INVALID_CEP');
  return cep;
}

export function registerShipping(router) {
  router.post('/api/shipping/quote', async ({ req }) => {
    const body = await readJson(req);
    const cep = normalizeCep(body.cep);
    const { subtotal } = priceCart(body.items || []);
    return { cep, provider: getShippingProvider().id, options: getShippingProvider().quote({ cep, subtotal }) };
  });
}
