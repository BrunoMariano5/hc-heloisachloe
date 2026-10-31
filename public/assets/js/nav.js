// Navegação compartilhada pelas páginas (evita dependência circular com main.js).
import { t } from './i18n.js';

export const NAV = {
  meninos: ['macacoes', 'bodies', 'camisetas', 'toucas', 'natacao'],
  meninas: ['macacoes', 'bodies', 'camisetas', 'toucas', 'natacao'],
  enxoval: ['kits', 'mantas', 'toalhas', 'bodies', 'macacoes', 'cueiros', 'acessorios'],
};

export function navigate(href) {
  history.pushState({}, '', href);
  window.dispatchEvent(new CustomEvent('hc:navigate'));
}

export function setTitle(title) {
  document.title = title ? `${title} — HC Heloísa Chloé` : `HC Heloísa Chloé — ${t('meta.tagline')}`;
}

export const main = () => document.getElementById('main');

// Imagens editoriais (recortes das fotos da marca)
export const PHOTOS = {
  heroGirl: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [560, 0, 752, 495] },
  heroBoy: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [470, 0, 784, 410] },
  embroidery: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [0, 820, 347, 310] },
  label: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [357, 820, 271, 310] },
  tag: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [637, 820, 301, 310] },
  stack: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [946, 822, 308, 308] },
  rompers: { src: '/assets/img/hc-meninos.webp', size: [1254, 1254], crop: [0, 405, 1254, 405] },
  tiles: {
    macacoes: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [0, 500, 455, 262] },
    bodies: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [462, 500, 418, 262] },
    toalhas: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [887, 500, 425, 262] },
    mantas: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [0, 822, 318, 238] },
    toucas: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [326, 822, 307, 238] },
    acessorios: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [641, 822, 284, 238] },
    kits: { src: '/assets/img/hc-colecao.webp', size: [1312, 1199], crop: [932, 822, 380, 238] },
  },
};
