// SEO: o servidor injeta título, descrição, Open Graph, hreflang e JSON-LD
// no HTML de cada rota, para que buscadores e redes sociais leiam sem executar JS.
import { config } from './config.js';
import { products, collections } from './modules/catalog.js';

const SITE = 'HC Heloísa Chloé';
const DEFAULT_DESC =
  'HC Heloísa Chloé — moda infantil premium do nascimento aos 10 anos. Macacões, bodies, enxoval e coleções com conforto, qualidade e amor em cada detalhe.';

const STATIC = {
  '/': { title: `${SITE} — Moda infantil premium do nascimento aos 10 anos`, desc: DEFAULT_DESC },
  '/meninos': { title: `Meninos — ${SITE}`, desc: 'Macacões, bodies, camisetas, toucas e moda praia para meninos. HC Heloísa Chloé.' },
  '/meninas': { title: `Meninas — ${SITE}`, desc: 'Macacões, bodies, camisetas, toucas e moda praia para meninas. HC Heloísa Chloé.' },
  '/enxoval': { title: `Enxoval — ${SITE}`, desc: 'Kits para recém-nascidos, mantas, toalhas, bodies, macacões, cueiros e acessórios HC.' },
  '/colecoes': { title: `Coleções — ${SITE}`, desc: 'HC Newborn, HC Baby, HC Kids e HC Junior: uma coleção para cada fase, do nascimento aos 10 anos.' },
  '/sobre': { title: `Sobre a HC — ${SITE}`, desc: 'Tudo começou com um sorriso. Conheça a história da HC Heloísa Chloé, uma marca que nasceu do amor de uma família e sonha conquistar o mundo.' },
  '/contato': { title: `Contato — ${SITE}`, desc: 'Fale com a HC por WhatsApp, Instagram ou e-mail.' },
};
const SUBCATS = {
  meninos: ['macacoes', 'bodies', 'camisetas', 'toucas', 'natacao'],
  meninas: ['macacoes', 'bodies', 'camisetas', 'toucas', 'natacao'],
  enxoval: ['kits', 'mantas', 'toalhas', 'bodies', 'macacoes', 'cueiros', 'acessorios'],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function headFor(pathname) {
  const url = `${config.publicUrl}${pathname}`;
  let title = STATIC[pathname]?.title;
  let desc = STATIC[pathname]?.desc;
  let image = `${config.publicUrl}/assets/img/hc-colecao.webp`;
  let jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HC Heloísa Chloé',
    url: config.publicUrl,
    logo: `${config.publicUrl}/assets/img/logo-hc.svg`,
  };

  const prod = pathname.match(/^\/produto\/([a-z0-9-]+)$/);
  const coll = pathname.match(/^\/colecoes\/([a-z0-9-]+)$/);
  const sub = pathname.match(/^\/(meninos|meninas|enxoval)\/([a-z]+)$/);
  if (prod) {
    const p = products.find((x) => x.slug === prod[1] && x.active);
    if (p) {
      title = `${p.name} — ${SITE}`;
      desc = p.description.pt;
      if (p.images[0]) image = `${config.publicUrl}${p.images[0].src}`;
      jsonld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: p.description.pt,
        image,
        brand: { '@type': 'Brand', name: 'HC Heloísa Chloé' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'BRL',
          price: p.price.toFixed(2),
          availability: Object.values(p.stock).some((q) => q > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url,
        },
      };
    }
  } else if (coll) {
    const c = collections.get(coll[1]);
    if (c) {
      title = `${c.name} (${c.age.pt}) — ${SITE}`;
      desc = c.description.pt;
    }
  } else if (sub && SUBCATS[sub[1]]?.includes(sub[2])) {
    title = `${STATIC[`/${sub[1]}`].title}`;
    desc = STATIC[`/${sub[1]}`].desc;
  }

  title ||= `${SITE}`;
  desc ||= DEFAULT_DESC;
  const noindex = !config.allowIndexing || /^\/(carrinho|checkout|conta|favoritos)/.test(pathname);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    noindex ? '<meta name="robots" content="noindex">' : '',
    `<link rel="canonical" href="${esc(url)}">`,
    ...config.locales.map((l) => `<link rel="alternate" hreflang="${l === 'pt' ? 'pt-BR' : l}" href="${esc(url)}?lang=${l}">`),
    `<link rel="alternate" hreflang="x-default" href="${esc(url)}">`,
    `<meta property="og:type" content="${prod ? 'product' : 'website'}">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    '<meta property="og:locale" content="pt_BR"><meta property="og:locale:alternate" content="en_US"><meta property="og:locale:alternate" content="ja_JP">',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ');
}

export function sitemap() {
  const paths = [
    ...Object.keys(STATIC),
    ...Object.entries(SUBCATS).flatMap(([g, subs]) => subs.map((s) => `/${g}/${s}`)),
    ...collections.filter((c) => c.active).map((c) => `/colecoes/${c.slug}`),
    ...products.filter((p) => p.active).map((p) => `/produto/${p.slug}`),
  ];
  const urls = paths
    .map((p) => {
      const loc = `${config.publicUrl}${p}`;
      const alts = config.locales
        .map((l) => `<xhtml:link rel="alternate" hreflang="${l === 'pt' ? 'pt-BR' : l}" href="${loc}?lang=${l}"/>`)
        .join('');
      return `<url><loc>${loc}</loc>${alts}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robots() {
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout\nDisallow: /conta\nSitemap: ${config.publicUrl}/sitemap.xml\n`;
}
