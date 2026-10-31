// Catálogo público: produtos ativos e coleções. Estoque exposto só como disponibilidade.
import { collection, documentStore } from '../core/db.js';
import { HttpError } from '../core/http.js';

export const products = collection('products');
export const collections = collection('collections');
export const settings = documentStore('settings');

export function publicProduct(p) {
  const low = settings.read().lowStockThreshold ?? 8;
  const sizes = Object.entries(p.stock || {}).map(([size, qty]) => ({
    size,
    available: qty > 0,
    low: qty > 0 && qty <= Math.max(2, Math.round(low / 3)),
  }));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    genders: p.genders,
    collections: p.collections,
    enxoval: p.enxoval,
    tags: p.tags,
    demo: p.demo,
    colors: p.colors,
    sizes,
    images: p.images,
    description: p.description,
    details: p.details,
  };
}

export function registerCatalog(router) {
  router.get('/api/catalog', () => ({
    products: products.filter((p) => p.active).map(publicProduct),
    collections: collections
      .filter((c) => c.active)
      .sort((a, b) => a.order - b.order),
  }));

  router.get('/api/products/:slug', ({ params }) => {
    const p = products.find((x) => x.slug === params.slug && x.active);
    if (!p) throw new HttpError(404, 'NOT_FOUND');
    return publicProduct(p);
  });

  router.get('/api/settings/public', () => {
    const s = settings.read();
    return {
      storeName: s.storeName,
      currency: s.currency,
      contact: s.contact,
      freeShippingThreshold: s.shipping?.freeShippingThreshold ?? null,
    };
  });
}
