// Wspoldzielone renderowanie strony produktu - uzywane w przegladarce (app.js)
// i w Node (build.mjs) do generowania statycznych stron /product/<id>/ dla SEO.
// Wylacznie czyste funkcje (dane -> string): zadnego DOM, localStorage, stanu gry.
// Zaleznosci (t, icon, locale) wstrzykiwane przez ctx - build.mjs podaje wersje
// oparte o lang/en.json, app.js swoje runtime'owe.

function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// 5 deterministycznych recenzji: metadane (imie, gwiazdki, dni) z puli RV_META
// dobrane hashem id produktu, teksty z i18n rv.<id>.<1..5>.
function seededReviewsFor(p, rvMeta, tF) {
  const base = hashStr(p.id);
  return [0, 1, 2, 3, 4].map(i => {
    const m = rvMeta[(base + i * 11) % rvMeta.length];
    return { ...m, text: tF('rv.' + p.id + '.' + (i + 1)) };
  }).sort((a, b) => a.days - b.days);
}

function starsLineHtml(p, ctx) {
  return `<div class="stars">${ctx.icon('star', 13)} ${p.rating} <em>(${p.reviews.toLocaleString(ctx.locale)} ${ctx.t('reviewsWord')})</em></div>`;
}

// Rdzen PDP: zdjecie + naglowek + opis + tabela specyfikacji. Elementy
// interaktywne (share, viewers, buy box, wykres) wchodza przez ctx.extras.
function pdpCoreHtml(p, ctx) {
  const x = Object.assign({ titleExtra: '', afterStars: '', desc: p.desc, afterSpecs: '' }, ctx.extras);
  const tF = ctx.t;
  return `
      <div class="pdp-img"><img src="${p.img}" alt="${p.name}"></div>
      <div class="pdp-info">
        <h1>${p.name}${x.titleExtra}</h1>
        <div class="sub">${p.sub}</div>
        ${starsLineHtml(p, ctx)}
        ${x.afterStars}
        <p class="desc">${x.desc}</p>
        <table class="spec-table">
          <tr><td>${tF('pdp.speed')}</td><td>${p.speed}</td></tr>
          <tr><td>${tF('pdp.latency')}</td><td>${p.latency}</td></tr>
          <tr><td>${tF('pdp.voltage')}</td><td>${p.voltage}</td></tr>
          <tr><td>${tF('pdp.profile')}</td><td>${p.profile}</td></tr>
          <tr><td>${tF('pdp.warranty')}</td><td>${tF('pdp.lifetime')}</td></tr>
        </table>
        ${x.afterSpecs}
      </div>`;
}

// Lista recenzji (bez formularza - ten jest czescia aplikacji).
// rows: [{ name, stars, text, date }]
function reviewRowsHtml(rows, ctx) {
  return rows.map(r => `
    <div class="review">
      <div class="rv-head">
        <b>${r.name}</b>
        <span class="rv-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>
        <span class="rv-verified">${ctx.icon('check', 10)} ${ctx.t('rv.verified')}</span>
        <span class="rv-date">${r.date}</span>
      </div>
      <p>${r.text}</p>
    </div>`).join('');
}
