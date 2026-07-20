const CACHE = 'rambuy-v75';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/icons.js',
  './js/seo-render.js',
  './js/data.js',
  './js/app.js',
  './lang/en.json',
  './lang/pl.json',
  './lang/fr.json',
  './lang/es.json',
  './lang/pt.json',
  './lang/pt-br.json',
  './lang/de.json',
  './lang/it.json',
  './lang/zh.json',
  './lang/ja.json',
  './lang/ko.json',
  './manifest.json',
  './assets/ram-hero.webp',
  './assets/ram-32gb.webp',
  './assets/ram-64gb.webp',
  './assets/ram-96gb.webp',
  './assets/ram-white.webp',
  './assets/ram-rgb.webp',
  './assets/ram-sodimm.webp',
  './assets/ram-ecc.webp',
  './assets/ram-nightcity.webp',
  './assets/ram-wasteland.webp',
  './assets/ram-voxel.webp',
  './assets/ram-aperture.webp',
  './assets/ram-wolfschool.webp',
  './assets/ram-inferno.webp',
  './assets/ram-kyber.webp',
  './assets/ram-outrun.webp',
  './assets/ram-matrix.webp',
  './assets/ram-midas.webp',
  './assets/ram-cryo.webp',
  './assets/ram-brick.webp',
  './assets/ram-mystery.webp',
  './assets/ram-sakura.webp',
  './assets/ram-steampunk.webp',
  './assets/ram-abyss.webp',
  './assets/ram-marble.webp',
  './assets/ram-carbon.webp',
  './assets/ram-aztec.webp',
  './assets/ram-candy.webp',
  './assets/ram-graffiti.webp',
  './assets/ram-bonsai.webp',
  './assets/ram-reactor.webp',
  './assets/ram-origami.webp',
  './assets/ram-terracotta.webp',
  './assets/ram-stainedglass.webp',
  './assets/ram-hive.webp',
  './assets/ram-obsidian.webp',
  './assets/ram-pearl.webp',
  './assets/ram-blueprint.webp',
  './assets/ram-mecha.webp',
  './assets/ram-nebula.webp',
  './assets/ram-singularity.webp',
  './assets/ram-plasma.webp',
  './assets/ram-antimatter.webp',
  './assets/ram-quantum.webp',
  './assets/ram-dyson.webp',
  './assets/ram-wormhole.webp',
  './assets/ram-darkmatter.webp',
  './assets/ram-supernova.webp',
  './assets/ram-timecrystal.webp',
  './assets/ram-multiverse.webp',
  './assets/ram-omega.webp',
  './assets/ram-simulation.webp',
  './assets/ram-entropy.webp',
  './assets/ram-genesis.webp',
  './assets/ram-akashic.webp',
  './assets/ram-laplace.webp',
  './assets/ram-ouroboros.webp',
  './assets/ram-planck.webp',
  './assets/ram-demiurge.webp',
  './assets/ram-infinity.webp',
  './assets/ram-absolute.webp',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' omija cache HTTP przeglądarki - Cloudflare daje .js/.css max-age=4h,
  // a .json/.html zawsze świeże; bez tego addAll potrafi zmieszać stary app.js z nowymi
  // plikami językowymi w jednym cache (objaw: gołe klucze i18n, np. "rvpool.1")
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(err => {
      // Trasy History API (np. /spin) offline: podaj shell aplikacji.
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }))
  );
});
