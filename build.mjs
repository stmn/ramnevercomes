// Build step for deploy: minifies JS/CSS and compacts lang JSONs into dist/.
// Sources in js/, css/, lang/ stay readable — only dist/ ships to nginx.
// Top-level function names survive minification (inline onclick handlers rely
// on them); local identifiers, whitespace and comments do not.
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist';
// Hosting pod podkatalogiem (GitHub Pages: BASE_PATH=/ramnevercomes) albo w rocie domeny (domyslnie).
// SITE_ORIGIN to publiczny adres bez koncowego ukosnika, do canonical/og/sitemap/robots.
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const ORIGIN = (process.env.SITE_ORIGIN || 'https://ramnevercomes.com').replace(/\/+$/, '');
// Linki w kodzie sa wzgledem aplikacji ("/product/x"); pod podkatalogiem dostaja prefiks juz w buildzie,
// zeby "otworz w nowej karcie" i strony statyczne dla robotow tez trafialy w dobry adres.
const prefixLinks = text => BASE_PATH ? text.replace(/href="\//g, 'href="' + BASE_PATH + '/').replace(/href='\//g, "href='" + BASE_PATH + '/') : text;
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['css', 'js', 'lang']) fs.mkdirSync(path.join(out, d), { recursive: true });

const kb = f => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
const report = [];

for (const f of ['js/app.js', 'js/data.js', 'js/icons.js', 'js/seo-render.js', 'sw.js', 'css/styles.css']) {
  buildSync({
    entryPoints: [f],
    minify: true,
    target: ['es2020'],
    charset: 'utf8',
    legalComments: 'none',
    outfile: path.join(out, f),
  });
  if (f.endsWith('.js')) fs.writeFileSync(path.join(out, f), prefixLinks(fs.readFileSync(path.join(out, f), 'utf8')));
  report.push(`${f}: ${kb(f)} -> ${kb(path.join(out, f))}`);
}

for (const f of fs.readdirSync('lang')) {
  const src = path.join('lang', f);
  const dst = path.join(out, 'lang', f);
  fs.writeFileSync(dst, JSON.stringify(JSON.parse(fs.readFileSync(src, 'utf8'))));
  report.push(`${src}: ${kb(src)} -> ${kb(dst)}`);
}

fs.copyFileSync('manifest.json', path.join(out, 'manifest.json'));
fs.writeFileSync(path.join(out, 'index.html'), prefixLinks(fs.readFileSync('index.html', 'utf8'))
  .replace('<base href="/">', '<base href="' + BASE_PATH + '/">')
  .replace(/https:\/\/ramnevercomes\.com/g, ORIGIN));

// ---------- statyczne strony produktow (SEO) ----------
// Ta sama funkcja renderujaca co w przegladarce (js/seo-render.js) uruchomiona
// w Node: /product/<id>/index.html to indeksowalne wejscia dla wyszukiwarek;
// nawigacja w grze pozostaje hashowa i nie linkuje do tych stron.
const sandbox = new Function(
  ['js/data.js', 'js/icons.js', 'js/seo-render.js'].map(f => fs.readFileSync(f, 'utf8')).join(';\n')
  + '; return { PRODUCTS, RV_META, icon, seededReviewsFor, pdpCoreHtml, reviewRowsHtml };'
)();
const EN = JSON.parse(fs.readFileSync('lang/en.json', 'utf8'));
const tEn = (k, params = {}) => Object.entries(params).reduce((s, [n, v]) => s.replaceAll('{' + n + '}', v), EN[k] ?? k);
const ctx = { t: tEn, icon: sandbox.icon, locale: 'en' };
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const shell = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const staticPage = p => {
  const desc = tEn('p.' + p.id + '.desc') !== 'p.' + p.id + '.desc' ? tEn('p.' + p.id + '.desc') : p.desc;
  const reviews = sandbox.seededReviewsFor(p, sandbox.RV_META, tEn)
    .map(r => ({ ...r, date: tEn('rv.daysAgo', { n: r.days }) }));
  // Prerender do <main>: crawler widzi tresc bez JS; aplikacja po starcie
  // renderuje te sama trase (pelny, interaktywny widok) w to samo miejsce.
  const core = sandbox.pdpCoreHtml(p, { ...ctx, extras: { desc } });
  const view = prefixLinks('<div class="page"><div class="pdp">' + core + '</div>'
    + '<section class="reviews"><h3>' + tEn('rv.title') + '</h3>' + sandbox.reviewRowsHtml(reviews, ctx) + '</section></div>');
  return shell
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(p.name) + ' - RamNeverComes</title>')
    .replace(/(<meta name="description" content=")[^"]*/, '$1' + esc(desc))
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + ORIGIN + '/product/' + p.id + '/')
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + ORIGIN + '/product/' + p.id + '/')
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + esc(p.name) + ' - RamNeverComes')
    .replace(/(<meta property="og:description" content=")[^"]*/, '$1' + esc(desc))
    .replace(/(<meta property="og:image" content=")[^"]*/, '$1' + ORIGIN + '/' + p.img)
    .replace(/(<meta name="twitter:image" content=")[^"]*/, '$1' + ORIGIN + '/' + p.img)
    .replace(/<meta property="og:image:width"[^>]*>\s*/, '')
    .replace(/<meta property="og:image:height"[^>]*>\s*/, '')
    .replace('<main id="view"></main>', '<main id="view">' + view + '</main>');
};

// SPA fallback dla tras History API (/kits, /spin, ...): Cloudflare Pages
// serwuje istniejace pliki wprost, reszta sciezek dostaje shell aplikacji.
fs.writeFileSync(path.join(out, '_redirects'), '/* /index.html 200\n');
// GitHub Pages nie ma fallbacku: nieznana sciezka dostaje 404.html, ktory jest tym samym shellem
// (router czyta location.pathname i renderuje trase). .nojekyll: Jekyll ukrylby pliki z "_".
fs.copyFileSync(path.join(out, 'index.html'), path.join(out, '404.html'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /cdn-cgi/\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n');

const today = new Date().toISOString().slice(0, 10);
const urls = [{ loc: ORIGIN + '/', freq: 'weekly' }];
for (const p of sandbox.PRODUCTS) {
  const dir = path.join(out, 'product', p.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), staticPage(p));
  urls.push({ loc: ORIGIN + '/product/' + p.id + '/', freq: 'monthly' });
}
fs.writeFileSync(path.join(out, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(u => '  <url><loc>' + u.loc + '</loc><lastmod>' + today + '</lastmod><changefreq>' + u.freq + '</changefreq></url>').join('\n')
  + '\n</urlset>\n');
report.push('product pages: ' + sandbox.PRODUCTS.length + ' + sitemap.xml');

console.log(report.join('\n'));
console.log('dist/ ready');
