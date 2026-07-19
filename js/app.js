/* RamNeverComes - fully client-side fictional store. No backend beyond static files. */
/* ---------- i18n ----------
   All user-facing strings live in lang/<code>.json. English is the default
   and the fallback for missing keys. */
const LANG_KEY = 'rambuy.lang';
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português (Portugal)' },
  { code: 'pt-br', label: 'Português (Brasil)' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];
const LOCALES = { en: 'en-US', pl: 'pl-PL', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', 'pt-br': 'pt-BR', de: 'de-DE', it: 'it-IT', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };
let I18N = {}, I18N_EN = {};
function detectLang() {
  for (const raw of navigator.languages || [navigator.language || 'en']) {
    const l = raw.toLowerCase();
    if (LANGS.some(x => x.code === l)) return l;
    const base = l.split('-')[0];
    if (base === 'pt') return 'pt'; // pt-br złapane wyżej pełnym kodem
    if (LANGS.some(x => x.code === base)) return base;
  }
  return 'en';
}
const curLang = () => localStorage.getItem(LANG_KEY) || detectLang();
const curLocale = () => LOCALES[curLang()] || 'en-US';

async function loadLang() {
  // Na hostach dev omijaj cache przegladarki - stare jsony pokazywaly surowe klucze.
  const bust = (location.hostname === 'rambuy.test' || location.hostname === 'localhost') ? '?t=' + Date.now() : '';
  try { I18N_EN = await fetch('lang/en.json' + bust).then(r => r.json()); } catch (e) { I18N_EN = {}; }
  const code = curLang();
  document.documentElement.lang = code;
  if (code === 'en') { I18N = I18N_EN; return; }
  try { I18N = await fetch(`lang/${code}.json` + bust).then(r => r.json()); } catch (e) { I18N = {}; }
}

function t(key, vars) {
  let s = I18N[key] ?? I18N_EN[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const descOf = p => I18N['p.' + p.id + '.desc'] ?? I18N_EN['p.' + p.id + '.desc'] ?? p.desc;
const msTxt = m => I18N['ms.' + m.gb] ?? I18N_EN['ms.' + m.gb] ?? m.txt;
const plural = (n, one, many) => t(n === 1 ? one : many, { n: n.toLocaleString(curLocale()) });

function setLang(code) {
  localStorage.setItem(LANG_KEY, code);
  location.reload();
}

function toggleLangMenu(e) {
  e.stopPropagation();
  const old = document.getElementById('lang-menu');
  if (old) { old.remove(); return; }
  const menu = document.createElement('div');
  menu.id = 'lang-menu';
  menu.innerHTML = LANGS.map(l =>
    `<button class="lang-item ${l.code === curLang() ? 'on' : ''}" onclick="setLang('${l.code}')">${l.label}</button>`).join('');
  document.body.appendChild(menu);
  const r = e.currentTarget.getBoundingClientRect();
  menu.style.top = (r.bottom + 8) + 'px';
  menu.style.right = Math.max(10, window.innerWidth - r.right) + 'px';
}
document.addEventListener('click', () => document.getElementById('lang-menu')?.remove());

// Static texts in index.html carry data-i18n / data-i18n-title attributes.
function hydrateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}


const $view = document.getElementById('view');
const BAG_KEY = 'rambuy.bag';
const ORDERS_KEY = 'rambuy.orders';
const PROMO_KEY = 'rambuy.promo';
const REVIEWS_KEY = 'rambuy.reviews';
const THEME_KEY = 'rambuy.theme';
let viewTimers = [];
let viewTimersGlobalTick = null;
let keepScrollY = null;

/* ---------- storage ---------- */
const loadBag = () => JSON.parse(localStorage.getItem(BAG_KEY) || '{}');
const saveBag = bag => { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); updateBagBadge(); };
const loadOrders = () => JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
const saveOrders = list => localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
const loadPromo = () => localStorage.getItem(PROMO_KEY) || '';
const loadReviews = () => JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');

const product = id => PRODUCTS.find(p => p.id === id);
const bagCount = bag => Object.values(bag).reduce((a, b) => a + b, 0);


// Codes must be EARNED (scratch cards) and are one-time
// use - placing an order consumes the code from your wallet.
const CODES_KEY = 'rambuy.codes';
const loadCodes = () => JSON.parse(localStorage.getItem(CODES_KEY) || '[]');
function grantCode(code) {
  const l = loadCodes();
  l.push(code);
  localStorage.setItem(CODES_KEY, JSON.stringify(l));
}
function consumeCode(code) {
  const l = loadCodes();
  const i = l.indexOf(code);
  if (i >= 0) { l.splice(i, 1); localStorage.setItem(CODES_KEY, JSON.stringify(l)); }
}

function promoRate(code) {
  if (!code) return 0;
  if (PROMO_CODES[code]) return PROMO_CODES[code];
  // STREAK zostaje w regexie tylko po to, by wcześniej zdobyte kody STREAK25 dalej działały
  const earned = code.match(/^(LUCKY|STREAK)(\d{1,2})$/);
  if (earned) return Math.min(50, Math.max(5, +earned[2])) / 100;
  return 0;
}

// "2 × 32GB" -> 64
function capacityGB(p) {
  const m = p.sub.match(/^(\d+)\s*×\s*(\d+)GB/);
  return m ? +m[1] * +m[2] : 0;
}

function pricing(bag = loadBag()) {
  const ownedAll = ownedCounts(true);
  let subtotal = 0;
  Object.entries(bag).forEach(([id, q]) => {
    const p = product(id), o = ownedAll[id] || 0;
    for (let k = 0; k < q; k++) subtotal += p.rpCost * Math.pow(1.15, o + k);
  });
  subtotal = Math.round(subtotal);
  const promo = loadPromo();
  const rate = loadCodes().includes(promo) ? promoRate(promo) : 0;
  const discount = Math.round(subtotal * rate);
  return { subtotal, promo: rate ? promo : '', discount, shipping: 0, total: subtotal - discount };
}

function lineCost(id, q) {
  const p = product(id), o = ownedCounts(true)[id] || 0;
  let s = 0;
  for (let k = 0; k < q; k++) s += p.rpCost * Math.pow(1.15, o + k);
  return Math.round(s);
}

/* ---------- deterministic rng ---------- */
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- theme ---------- */
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  const lb = document.getElementById('lang-btn');
  if (lb && !lb.innerHTML) lb.innerHTML = icon('globe', 16);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = icon(th === 'dark' ? 'sun' : 'moon', 16);
  document.querySelector('meta[name="theme-color"]').content = th === 'dark' ? '#0b0b0c' : '#ffffff';
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}

/* ---------- sound ---------- */
let audioCtx = null;
function note(freq, when, dur, vol) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(when); o.stop(when + dur + 0.05);
}
function sndPop() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    note(560, audioCtx.currentTime, 0.09, 0.09);
    note(840, audioCtx.currentTime + 0.055, 0.1, 0.07);
  } catch (e) { /* audio unavailable */ }
}
function sndSuccess() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((f, i) => note(f, audioCtx.currentTime + i * 0.09, 0.22, 0.07));
  } catch (e) { /* audio unavailable */ }
}
// Reveal shimmer: low pad + rising arpeggio, sparkles timed to the card shine (~0.45s).
function sndReveal() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    note(262, t0, 0.8, 0.035);
    [523, 659, 784, 1047].forEach((f, i) => note(f, t0 + 0.06 + i * 0.085, 0.32, 0.055));
    note(1319, t0 + 0.46, 0.16, 0.045);
    note(1568, t0 + 0.55, 0.2, 0.04);
  } catch (e) { /* audio unavailable */ }
}

/* ---------- shared ui ---------- */
function updateBagBadge(pop = false) {
  const el = document.getElementById('bag-count');
  const n = bagCount(loadBag());
  el.hidden = n === 0;
  el.textContent = n;
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}

function dismissToast(el) {
  if (!el || !el.isConnected || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 320);
}

function toast(msg, iconName = 'check') {
  const root = document.getElementById('toast-root');
  // Maksymalnie 3 na ekranie: nowy wypycha najstarszy natychmiast.
  const live = [...root.children].filter(el => !el.classList.contains('leaving'));
  if (live.length >= 3) dismissToast(live[0]);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(iconName, 15)}${msg}`;
  root.appendChild(el);
  setTimeout(() => dismissToast(el), 2200);
}

function starsHtml(p) {
  return `<div class="stars">${icon('star', 13)} ${p.rating} <em>(${p.reviews.toLocaleString(curLocale())} ${t('reviewsWord')})</em></div>`;
}

// Allocation grows with loyalty: base stock + half of the copies you own.
function stockOf(p) {
  return p.stock + Math.floor((ownedCounts(true)[p.id] || 0) / 2);
}

function stockHtml(p) {
  const st = stockOf(p);
  return st <= 3
    ? `<span class="stock-note stock-low">${t('card.onlyLeft', { n: st })}</span>`
    : `<span class="stock-note stock-ok">${t('card.inStock', { n: st })}</span>`;
}

function confetti() {
  const colors = ['#0071e3', '#5ac8fa', '#34c759', '#ffd60a', '#ff9f0a'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    const s = 5 + Math.random() * 6;
    c.style.cssText = `left:${Math.random() * 100}vw;width:${s}px;height:${s * 0.45}px;` +
      `background:${colors[i % colors.length]};animation-duration:${2.2 + Math.random() * 1.6}s;` +
      `animation-delay:${Math.random() * .4}s`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

/* ---------- live purchase feed ---------- */
let feedTimeout = null;
function scheduleFeed(delay) {
  clearTimeout(feedTimeout);
  feedTimeout = setTimeout(fireFeed, delay);
}
function fireFeed() {
  if (!document.hidden && !document.querySelector('.overlay')) {
    const viewedId = (location.hash.match(/^#\/product\/(.+)$/) || [])[1];
    const pool = RP_LADDER.filter(isRevealed);
    const p = Math.random() < 0.25 && product(viewedId)
      ? product(viewedId)
      : pool[Math.floor(Math.random() * pool.length)];
    const city = FEED_CITIES[Math.floor(Math.random() * FEED_CITIES.length)];
    const mins = 1 + Math.floor(Math.random() * 9);
    const root = document.getElementById('feed-root');
    root.innerHTML = `
      <div class="feed-toast">
        <img src="${p.img}" alt="">
        <div>${t('feed.bought', { city: `<b>${city}</b>`, name: `<b>${p.name}</b>` })}<small>${t('feed.minAgo', { n: mins })}</small></div>
      </div>`;
    const el = root.firstElementChild;
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 320); }, 5000);
    if (p.id === viewedId) liveStockDrop(p);
  }
  scheduleFeed(28000 + Math.random() * 36000);
}

/* ---------- live stock / viewers (product page) ---------- */
function liveStockDrop(p) {
  if (p.stock > 1) p.stock--;
  const el = document.getElementById('pdp-stock');
  if (el) {
    el.innerHTML = stockHtml(p);
    el.classList.remove('stock-flash'); void el.offsetWidth; el.classList.add('stock-flash');
  }
  refreshStockButtons();
}
function startPdpLive(p) {
  const seed = mulberry32(hashStr(p.id) ^ 77);
  let viewers = 3 + Math.floor(seed() * 11);
  const render = () => {
    const el = document.getElementById('pdp-viewers');
    if (el) el.innerHTML = `${icon('eye', 14)} <b>${viewers}</b>&nbsp;${t('pdp.viewers')}`;
  };
  render();
  viewTimers.push(setInterval(() => {
    viewers = Math.max(2, Math.min(18, viewers + (Math.random() < 0.5 ? -1 : 1)));
    render();
  }, 6000));
  viewTimers.push(setInterval(() => liveStockDrop(p), 28000 + Math.random() * 16000));
}

/* ---------- mini bag popover ---------- */
let miniBagTimer = null;
function renderMiniBag() {
  const el = document.getElementById('mini-bag');
  const bag = loadBag();
  const ids = Object.keys(bag);
  if (!ids.length) {
    el.innerHTML = `
      <h4>${icon('shopping-bag', 15)} ${t('mb.title')}</h4>
      <div class="mb-empty">${icon('shopping-bag', 26)}${t('mb.empty')}</div>`;
    return;
  }
  const pr = pricing(bag);
  el.innerHTML = `
    <h4>${icon('shopping-bag', 15)} ${t('mb.title')}
      <small>${plural(bagCount(bag), 'mb.items', 'mb.itemsPlural')} ·
      <button class="mb-clear" onclick="clearBag()">${t('mb.clear')}</button></small></h4>
    <div class="mb-items">
      ${ids.map(id => {
        const p = product(id), q = bag[id];
        return `
        <div class="mb-row">
          <img src="${p.img}" alt="${p.name}">
          <div class="n"><b>${p.name}</b><small>×${q}</small></div>
          <span class="p">${fmtRP(lineCost(id, q))} RP</span>
        </div>`;
      }).join('')}
    </div>
    <div class="mb-total"><span>${t('mb.total')}</span><span>${fmtRP(pr.total)} RP</span></div>
    <div class="mb-actions">
      <a class="btn ghost" href="#/bag" onclick="hideMiniBag()">${icon('shopping-bag', 13)} ${t('mb.checkout')}</a>
      ${!instantPopoverUnlocked()
        ? `<span data-tip="${t('mb.instantLockTip')}"><button class="btn" disabled style="pointer-events:none">${icon('lock', 13)} ${t('mb.instant')}</button></span>`
        : rpBal >= pr.total
          ? `<button class="btn" onclick="instantFromPopover()">${icon('zap', 13)} ${t('mb.instant')}</button>`
          : `<button class="btn" disabled>${icon('lock', 13)} ${t('mb.instant')}</button>`}
    </div>`;
}
let miniBagShownAt = 0;
function showMiniBag(autoHide = false) {
  const el = document.getElementById('mini-bag');
  renderMiniBag();
  el.hidden = false;
  miniBagShownAt = Date.now();
  clearTimeout(miniBagTimer);
  if (autoHide) miniBagTimer = setTimeout(hideMiniBag, 3800);
}
function hideMiniBag() {
  clearTimeout(miniBagTimer);
  document.getElementById('mini-bag').hidden = true;
}
function toggleMiniBag(e) {
  e.preventDefault();
  e.stopPropagation();
  const el = document.getElementById('mini-bag');
  el.hidden ? showMiniBag() : hideMiniBag();
}
document.addEventListener('click', e => {
  const el = document.getElementById('mini-bag');
  // The click that opened the popover bubbles here too - don't let it close it.
  if (Date.now() - miniBagShownAt < 150) return;
  if (!el.hidden && !el.contains(e.target)) hideMiniBag();
});
document.getElementById('mini-bag').addEventListener('mouseenter', () => clearTimeout(miniBagTimer));

/* ---------- cart actions ---------- */
function addToBag(id, qty = 1, quiet = false) {
  const p = product(id);
  const bag = loadBag();
  const cur = bag[id] || 0;
  if (cur >= stockOf(p)) {
    if (!quiet) toast(t('stock.allInBag', { n: stockOf(p) }), 'x');
    return false;
  }
  const st = addBtnState(p);
  if (st.state === 'poor') {
    if (!quiet) toast(t('toast.needMoreForThis', { amount: fmtRP(st.shortfall) }), 'lock');
    return false;
  }
  const clamped = Math.min(stockOf(p), cur + qty);
  if (clamped < cur + qty && !quiet) toast(t('stock.only', { n: stockOf(p) }), 'x');
  bag[id] = clamped;
  saveBag(bag);
  updateBagBadge(true);
  if (quiet) sndTick(280);
  else {
    sndPop();
    toast(t('toast.addedToBag', { name: p.name }), 'shopping-bag');
  }
  if (!document.getElementById('mini-bag').hidden) renderMiniBag();
  refreshStockButtons();
  return true;
}

/* ---------- hold-to-add ----------
   Press and hold any Add-to-bag button: after 350ms it starts adding
   10 units per second until you let go, stock runs out or RP runs short.
   One summary toast fires at the end instead of one per unit. */
const HOLD_DELAY = 350, HOLD_RATE = 100;
let holdTimer = null, holdInterval = null, holdCount = 0, holdItemId = null, holdSuppressClick = false;

function stopHold() {
  clearTimeout(holdTimer); clearInterval(holdInterval);
  holdTimer = holdInterval = null;
  if (holdCount > 0) {
    sndPop();
    toast(t('toast.addedToBag', { name: `${product(holdItemId).name} ×${holdCount}` }), 'shopping-bag');
  }
  holdCount = 0;
}

document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-add]');
  if (!btn || btn.disabled) return;
  holdItemId = btn.dataset.add;
  holdCount = 0;
  holdSuppressClick = false;
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => {
      if (!addToBag(holdItemId, 1, true)) { stopHold(); return; }
      holdCount++;
      holdSuppressClick = true;
    }, HOLD_RATE);
  }, HOLD_DELAY);
});
document.addEventListener('pointerup', stopHold);
document.addEventListener('pointercancel', stopHold);
// The release click after a hold must not add one more unit on top.
document.addEventListener('click', e => {
  if (holdSuppressClick && e.target.closest('[data-add]')) {
    e.preventDefault();
    e.stopPropagation();
    holdSuppressClick = false;
  }
}, true);

function setQty(id, qty) {
  const bag = loadBag();
  qty = Math.min(qty, stockOf(product(id)));
  if (qty <= 0) delete bag[id]; else bag[id] = qty;
  saveBag(bag);
  if (!document.getElementById('mini-bag').hidden) renderMiniBag();
  renderRoute();
}

function clearBag() {
  saveBag({});
  if (!document.getElementById('mini-bag').hidden) renderMiniBag();
  toast(t('toast.bagCleared'), 'trash-2');
  renderRoute();
}

function removeFromBag(id) {
  const bag = loadBag();
  delete bag[id];
  saveBag(bag);
  if (!document.getElementById('mini-bag').hidden) renderMiniBag();
  toast(t('toast.removed', { name: product(id).name }), 'trash-2');
  renderRoute();
}

/* ---------- promo ---------- */
function applyPromo(codeArg) {
  const inp = document.getElementById('promo-input');
  const code = (codeArg || (inp && inp.value) || '').trim().toUpperCase();
  if (!code) {
    const err = document.getElementById('promo-err');
    if (err) err.textContent = t('promo.enterFirst');
    return;
  }
  if (!loadCodes().includes(code)) {
    const err = document.getElementById('promo-err');
    if (err) err.textContent = t('promo.notEarned');
    if (inp) inp.classList.add('invalid');
    return;
  }
  localStorage.setItem(PROMO_KEY, code);
  sndPop();
  toast(t('promo.appliedToast', { code, pct: Math.round(promoRate(code) * 100) }), 'ticket');
  renderRoute();
}
function removePromo() {
  localStorage.removeItem(PROMO_KEY);
  renderRoute();
}


/* ---------- price history - live, ever-rising ----------
   Cosmetic FOMO chart: one tick = one fictional "day". The price mostly
   climbs, sometimes stalls, occasionally dips a little - but always trends
   up. Resets on every page load; nothing is persisted. */
const PC = { W: 560, H: 170, L: 46, R: 12, T: 12, B: 24, MAX: 90, TICK: 800 };
let pcHist = [];

// One market step: 14% small dip, 28% stagnation, 58% growth.
function pcFactor() {
  const r = Math.random();
  if (r < 0.14) return 1 - Math.random() * 0.006;
  if (r < 0.42) return 1 + (Math.random() - 0.5) * 0.0015;
  return 1 + Math.random() * 0.011;
}

// Seed 30 points that end exactly at the current unit cost.
function pcSeed(p) {
  let v = rpUnitCost(p);
  const arr = [v];
  for (let i = 0; i < 29; i++) { v /= pcFactor(); arr.unshift(v); }
  return arr;
}

function priceChartHtml() {
  const { W, H, L } = PC;
  return `
  <section class="price-chart">
    <div class="pc-head"><h3>${icon('chart-line', 17)} ${t('chart.title')}</h3><span id="pc-chip"></span></div>
    <div class="pc-wrap" id="pc-wrap">
      <svg viewBox="0 0 ${W} ${H}" id="pc-svg">
        <g id="pc-grid"></g>
        <text class="axis-label" x="${L}" y="${H - 8}" id="pc-x0"></text>
        <text class="axis-label" x="${W - PC.R}" y="${H - 8}" text-anchor="end">${t('chart.today')}</text>
        <path class="price-area" id="pc-area" d=""/>
        <path class="price-line" id="pc-line" d=""/>
        <line class="crosshair" id="pc-cross" y1="${PC.T}" y2="${H - PC.B}" x1="0" x2="0"/>
        <circle class="price-dot" id="pc-dot" r="4" cx="0" cy="0"/>
      </svg>
      <div class="pc-tip" id="pc-tip"></div>
    </div>
    <div class="pc-stats">
      <span>${t('chart.low')} <b id="pc-low"></b></span>
      <span>${t('chart.high')} <b id="pc-high"></b></span>
      <span>${t('chart.now')} <b id="pc-now"></b></span>
    </div>
  </section>`;
}

// Shared SVG chart helpers (PDP price history + RAM Exchange).
function chartScales(hist, D) {
  const { W, H, L, R, T, B } = D;
  const min = Math.min(...hist), max = Math.max(...hist);
  const pad = (max - min) * 0.15 || 10;
  return {
    min, max,
    x: i => L + (W - L - R) * i / (hist.length - 1),
    y: v => T + (H - T - B) * (1 - (v - min + pad) / (max - min + 2 * pad)),
  };
}
const chartLinePath = (hist, sc) =>
  hist.map((v, i) => `${i ? 'L' : 'M'}${sc.x(i).toFixed(1)},${sc.y(v).toFixed(1)}`).join(' ');
const chartAreaPath = (line, sc, n, D) =>
  `${line} L${sc.x(n - 1).toFixed(1)},${D.H - D.B} L${D.L},${D.H - D.B} Z`;
const chartGridHtml = (sc, D, fmt) =>
  [sc.min, (sc.min + sc.max) / 2, sc.max].map(v =>
    `<line class="grid-line" x1="${D.L}" x2="${D.W - D.R}" y1="${sc.y(v).toFixed(1)}" y2="${sc.y(v).toFixed(1)}"/>
     <text class="axis-label" x="${D.L - 6}" y="${(sc.y(v) + 3).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');

const pcScales = () => chartScales(pcHist, PC);

function pcDraw() {
  const svg = document.getElementById('pc-svg');
  if (!svg || !pcHist.length) return;
  const sc = pcScales();
  const { min, max, x, y } = sc;
  const line = chartLinePath(pcHist, sc);
  document.getElementById('pc-line').setAttribute('d', line);
  document.getElementById('pc-area').setAttribute('d', chartAreaPath(line, sc, pcHist.length, PC));
  document.getElementById('pc-grid').innerHTML = chartGridHtml(sc, PC, fmtRP);
  const dot = document.getElementById('pc-dot');
  dot.setAttribute('cx', x(pcHist.length - 1)); dot.setAttribute('cy', y(pcHist[pcHist.length - 1]));
  document.getElementById('pc-x0').textContent = t('chart.tipDaysAgo', { n: pcHist.length - 1 });
  const base = pcHist[Math.max(0, pcHist.length - 31)];
  const change = (pcHist[pcHist.length - 1] - base) / base;
  document.getElementById('pc-chip').outerHTML = change < 0
    ? `<span class="pc-chip down" id="pc-chip">${t('chart.down', { pct: Math.abs(change * 100).toFixed(1) })}</span>`
    : `<span class="pc-chip up" id="pc-chip">${t('chart.up', { pct: (change * 100).toFixed(1) })}</span>`;
  document.getElementById('pc-low').textContent = fmtRP(min) + ' RP';
  document.getElementById('pc-high').textContent = fmtRP(max) + ' RP';
  document.getElementById('pc-now').textContent = fmtRP(pcHist[pcHist.length - 1]) + ' RP';
}

function bindPriceChart(p) {
  const svg = document.getElementById('pc-svg');
  if (!svg) return;
  pcHist = pcSeed(p);
  pcDraw();
  viewTimers.push(setInterval(() => {
    pcHist.push(pcHist[pcHist.length - 1] * pcFactor());
    if (pcHist.length > PC.MAX) pcHist.shift();
    pcDraw();
  }, PC.TICK));

  const wrap = document.getElementById('pc-wrap');
  const tip = document.getElementById('pc-tip');
  const cross = document.getElementById('pc-cross');
  const dot = document.getElementById('pc-dot');
  svg.addEventListener('mousemove', e => {
    const { W } = PC;
    const { x, y } = pcScales();
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(pcHist.length - 1,
      Math.round((mx - PC.L) / (W - PC.L - PC.R) * (pcHist.length - 1))));
    const days = pcHist.length - 1 - i;
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    cross.style.opacity = 1;
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(pcHist[i]));
    tip.style.opacity = 1;
    tip.style.left = (x(i) / W * 100) + '%';
    tip.style.top = (y(pcHist[i]) / PC.H * 100) + '%';
    tip.innerHTML = `<b>${fmtRP(pcHist[i])} RP</b> · ${days === 0 ? t('chart.tipToday') : t('chart.tipDaysAgo', { n: days })}`;
  });
  svg.addEventListener('mouseleave', () => {
    cross.style.opacity = 0; tip.style.opacity = 0;
    pcDraw();
  });
}

/* ---------- reviews ---------- */
function seededReviews(p) {
  const base = hashStr(p.id);
  return [0, 1, 2, 3, 4].map(i => {
    const m = RV_META[(base + i * 11) % RV_META.length];
    return { ...m, text: t('rv.' + p.id + '.' + (i + 1)) };
  }).sort((a, b) => a.days - b.days);
}
function reviewsHtml(p) {
  const mine = (loadReviews()[p.id] || []);
  const rows = [
    ...mine.map(r => ({ ...r, date: new Date(r.ts).toLocaleDateString(curLocale()) })),
    ...seededReviews(p).map(r => ({ ...r, date: t('rv.daysAgo', { n: r.days }) })),
  ].map(r => `
    <div class="review">
      <div class="rv-head">
        <b>${r.name}</b>
        <span class="rv-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>
        <span class="rv-verified">${icon('check', 10)} ${t('rv.verified')}</span>
        <span class="rv-date">${r.date}</span>
      </div>
      <p>${r.text}</p>
    </div>`).join('');

  return `
  <section class="reviews">
    <h3>${t('rv.title')}</h3>
    ${rows}
    <div class="rv-form">
      <h4>${t('rv.write')}</h4>
      <div class="rv-star-pick" id="rv-stars">
        ${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="on" onclick="rvPick(${n})">${icon('star', 20)}</button>`).join('')}
      </div>
      <textarea id="rv-text" placeholder="${t('rv.placeholder')}"></textarea>
      <div class="f-row">
        <div class="field"><input id="rv-name" placeholder="${t('rv.namePlaceholder')}"></div>
      </div>
      <button class="btn" onclick="rvSubmit('${p.id}')">${t('rv.publish')}</button>
    </div>
  </section>`;
}
let rvStars = 5;
function rvPick(n) {
  rvStars = n;
  document.querySelectorAll('#rv-stars button').forEach(b =>
    b.classList.toggle('on', +b.dataset.n <= n));
}
function rvSubmit(id) {
  const text = document.getElementById('rv-text').value.trim();
  if (!text) { toast(t('rv.empty'), 'x'); return; }
  const name = document.getElementById('rv-name').value.trim() || t('rv.anonymous');
  const all = loadReviews();
  const firstForProduct = !(all[id] || []).length;
  (all[id] = all[id] || []).unshift({ name, stars: rvStars, text, ts: Date.now() });
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  sndPop();
  addXp(firstForProduct ? Math.max(10, Math.round(cps() * 60)) : 5, t('rv.published'));
  renderRoute();
}

/* ---------- views ---------- */
function productCard(p) {
  return `
    <div class="prod-card">
      <div class="thumb-zoom" onclick="openLightbox('${p.img}')" title="${t('card.zoomTip')}">
        <img src="${p.img}" alt="${p.name}" loading="lazy">
        <span class="zoom-hint">${icon('zoom-in', 20)}</span>
      </div>
      <a href="#/product/${p.id}">
        <h4>${p.name}</h4>
        <div class="sub">${p.sub}</div>
        <div class="price"${(ownedCounts(true)[p.id] || 0) ? ` data-tip="${t('card.nextCopyTip', { n: ownedCounts(true)[p.id] })}"` : ''}>${fmtRP(rpUnitCost(p))} RP</div>
        <div class="prod-line">${t('card.prodLine', { n: fmtRP(p.rpProd) })}</div>
        ${cardMetaHtml(p)}
      </a>
      ${addBtnHtml(p)}
    </div>`;
}


// 'ok' | 'out' (stock exhausted) | 'poor' (bag total + next copy exceeds balance)
function addBtnState(p) {
  const bagQty = loadBag()[p.id] || 0;
  if (bagQty >= stockOf(p)) return { state: 'out' };
  const shortfall = rpUnitCost(p, bagQty) - (rpBal - pricing().total);
  return shortfall > 0 ? { state: 'poor', shortfall } : { state: 'ok' };
}

// "Need 3.5K more RP" becomes a promise when production can cover it.
function affordLabel(shortfall) {
  const c = cps();
  if (c > 0) return `${icon('clock', 13)} ${t('card.affordableIn', { time: fmtDuration(Math.ceil(shortfall / c)) })}`;
  return `${icon('lock', 13)} ${t('card.needMore', { amount: fmtRP(shortfall) })}`;
}

function addBtnLabel(st) {
  if (st.state === 'out') return `${icon('x', 13)} ${t('card.outOfStock')}`;
  if (st.state === 'poor') return affordLabel(st.shortfall);
  return `${icon('shopping-bag', 13)} ${t('card.addToBag')}`;
}

// One quiet line: ownership and availability together.
function cardMetaHtml(p) {
  const owned = ownedCounts(true)[p.id] || 0;
  const st = stockOf(p);
  const stock = st <= 3 ? `<span class="stock-low">${t('card.onlyLeft', { n: st })}</span>` : t('card.inStock', { n: st });
  return `<div class="card-meta">${owned ? t('card.owned', { n: owned }) + ' · ' : ''}${stock}</div>`;
}

function addBtnHtml(p, big = false) {
  // At 1-second deliveries the bag is ceremony: the card's main button
  // becomes a one-click Instant buy.
  if (!big && instantCardUnlocked()) {
    const can = rpBal >= rpUnitCost(p);
    return `<button class="btn" data-instant="${p.id}" ${can ? '' : 'disabled'}
      onclick="instantBuy('${p.id}')">${icon('zap', 13)} ${t('card.instantBuy')}</button>`;
  }
  const st = addBtnState(p);
  const cls = big ? 'btn big full' : 'btn';
  return `<button class="${cls}" data-add="${p.id}" data-state="${st.state}"
    ${st.state === 'ok' ? '' : 'disabled'}
    onclick="addToBag('${p.id}'${big ? ', pdpQtyVal()' : ''})">${addBtnLabel(st)}</button>`;
}

// Re-evaluates every Add button; runs on cart changes and on the economy tick,
// so buttons unlock live as your balance grows.
function refreshStockButtons() {
  document.querySelectorAll('[data-instant]').forEach(btn => {
    const p = product(btn.dataset.instant);
    if (p) btn.disabled = rpBal < rpUnitCost(p);
  });
  const btns = document.querySelectorAll('[data-add]');
  if (!btns.length) return;
  const bag = loadBag();
  const ownedAll = ownedCounts(true);
  const budget = rpBal - pricing(bag).total;
  btns.forEach(btn => {
    const p = product(btn.dataset.add);
    if (!p) return;
    const bagQty = bag[p.id] || 0;
    let st;
    if (bagQty >= stockOf(p)) st = { state: 'out' };
    else {
      const shortfall = Math.round(p.rpCost * Math.pow(1.15, (ownedAll[p.id] || 0) + bagQty)) - budget;
      st = shortfall > 0 ? { state: 'poor', shortfall } : { state: 'ok' };
    }
    const key = st.state + (st.shortfall ? ':' + fmtRP(st.shortfall) : '');
    if (btn.dataset.state === key) return;
    btn.dataset.state = key;
    btn.disabled = st.state !== 'ok';
    btn.innerHTML = addBtnLabel(st);
  });
}

function lockedCard(p) {
  return `
    <div class="prod-card locked">
      <div class="lock-img">
        <img src="assets/ram-mystery.webp" alt="${t('ladder.locked.sub')}" loading="lazy">
        <span class="lock-q">?</span>
      </div>
      <h4>${t('ladder.locked.name')}</h4>
      <div class="sub">${t('ladder.locked.sub')}</div>
      <div class="price">${fmtRP(p.rpCost)} RP</div>
      <div class="lock-note">${icon('lock', 11)} ${t('ladder.locked.note', { amount: fmtRP(p.rpCost * 8) })}</div>
    </div>`;
}

// Hero showcases the priciest kit you can afford right now (stock included).
function heroPickKit() {
  const bag = loadBag();
  const budget = rpBal - pricing(bag).total;
  const ownedAll = ownedCounts(true);
  let pick = null;
  RP_LADDER.forEach(p => {
    const q = bag[p.id] || 0;
    if (isRevealed(p) && q < stockOf(p) && Math.round(p.rpCost * Math.pow(1.15, (ownedAll[p.id] || 0) + q)) <= budget) pick = p;
  });
  return pick;
}

function heroBuyHtml(pick) {
  if (!featureUnlocked('herobuy')) {
    return `<span data-tip="${t('hero.quickBuyTip', { lvl: FEATURE_LVL.herobuy, cur: xpInfo().lvl })}"><button class="btn big" disabled style="pointer-events:none">${icon('lock', 15)} ${t('card.addToBag')}</button></span>`;
  }
  if (pick) {
    const cost = Math.round(pick.rpCost * Math.pow(1.15, (ownedCounts(true)[pick.id] || 0) + (loadBag()[pick.id] || 0)));
    return `<button class="btn big" onclick="heroBuy('${pick.id}')">${icon('shopping-bag', 15)} ${t('hero.addToBag', { price: fmtRP(cost) })}</button>`;
  }
  const cheapest = RP_LADDER[0];
  const budget = rpBal - pricing().total;
  const missing = Math.max(1, rpUnitCost(cheapest, loadBag()[cheapest.id] || 0) - budget);
  return `<button class="btn big" disabled>${affordLabel(missing)}</button>`;
}

function heroBuy(id) {
  if (!featureUnlocked('herobuy')) return;
  addToBag(id);
  updateHero();
}

function updateHero() {
  const holder = document.getElementById('hero-buy');
  if (!holder) return;
  const pick = heroPickKit();
  const show = pick || RP_LADDER[0];
  const img = document.getElementById('main-clicker');
  if (img && !img.src.endsWith(show.img)) img.src = show.img;
  const hint = document.getElementById('hero-hint-name');
  if (hint && hint.textContent !== show.name) hint.textContent = show.name;
  const title = document.getElementById('hero-title');
  if (title && title.textContent !== show.name) {
    title.textContent = show.name;
    const lead = document.getElementById('hero-lead');
    if (lead) lead.textContent = descOf(show);
  }
  const key = (featureUnlocked('herobuy') ? 'u:' : 'l' + xpInfo().lvl + ':') + (pick
    ? pick.id + ':' + (loadBag()[pick.id] || 0)
    : 'none:' + fmtRP(rpBal));
  if (holder.dataset.key !== key) {
    holder.dataset.key = key;
    holder.innerHTML = heroBuyHtml(pick);
  }
}

function homeView() {
    const revealed = RP_LADDER.filter(isRevealed).length;
  const cards = RP_LADDER.map(p => isRevealed(p) ? productCard(p) : lockedCard(p)).join('');

  return `
  <div class="page">
    <section class="hero">
      <div class="hero-txt">
        <span class="eyebrow">${icon('zap', 12)} ${t('hero.eyebrow')}</span>
        <h1 id="hero-title">${(heroPickKit() || RP_LADDER[0]).name}</h1>
        <p class="lead" id="hero-lead">${descOf(heroPickKit() || RP_LADDER[0])}</p>
        <div class="cta-row">
          <span id="hero-buy">${heroBuyHtml(heroPickKit())}</span>
          <a class="btn ghost" href="#/kits">${t('hero.browse')} ${icon('chevron-right', 14)}</a>
        </div>
      </div>
      <div class="hero-img"><img src="${(heroPickKit() || RP_LADDER[0]).img}" alt="${t('hero.clickAlt')}" id="main-clicker" draggable="false" onclick="mainClick(event)" title="${t('hero.clickTitle')}">
        ${(loadStats().clicks || 0) ? '' : `<div class="hero-click-cue" id="hero-click-cue">${icon('mouse-pointer-click', 14)} ${t('hero.clickCue')}</div>`}
        <div class="hero-hint">${icon('mouse-pointer-click', 13)} <span id="hero-hint-name">${(heroPickKit() || RP_LADDER[0]).name}</span>&nbsp;${t('hero.hint')}</div>
      </div>
    </section>


    <div class="strip">
      <span>${icon('gauge')} ${t('strip.speed')}</span>
      <span>${icon('thermometer')} ${t('strip.thermals')}</span>
      <span>${icon('flame')} ${t('strip.binned')}</span>
      <span>${icon('shield-check')} ${t('strip.warranty')}</span>
    </div>

    <section id="kits">
      <div class="sec-head">
        <h2>${t('ladder.title')}</h2>
        <span class="count">${t('ladder.count', { n: revealed, total: RP_LADDER.length })}</span>
      </div>
      <div class="grid">${cards}</div>
    </section>
  </div>`;
}

function productView(id) {
  const p = product(id);
  if (!p) return notFoundView();
  const preview = !isRevealed(p);
  return `
  <div class="page">
    <a class="crumb" href="#/">${icon('chevron-left', 14)} ${t('pdp.allMemory')}</a>
    <div class="pdp">
      <div class="pdp-img"><img src="${p.img}" alt="${p.name}"></div>
      <div class="pdp-info">
        <h1>${p.name}
          <button class="share-btn" onclick="shareKit('${p.id}')" data-tip="${t('pdp.shareTip')}">${icon('share-2', 15)}</button>
        </h1>
        <div class="sub">${p.sub}</div>
        ${starsHtml(p)}
        ${preview ? `<div class="preview-note">${icon('lock', 13)} ${t('pdp.previewNote', { amount: fmtRP(p.rpCost * 8) })}</div>` : ''}
        <div class="viewers" id="pdp-viewers"></div>
        <p class="desc">${descOf(p)}</p>
        <table class="spec-table">
          <tr><td>${t('pdp.speed')}</td><td>${p.speed}</td></tr>
          <tr><td>${t('pdp.latency')}</td><td>${p.latency}</td></tr>
          <tr><td>${t('pdp.voltage')}</td><td>${p.voltage}</td></tr>
          <tr><td>${t('pdp.profile')}</td><td>${p.profile}</td></tr>
          <tr><td>${t('pdp.warranty')}</td><td>${t('pdp.lifetime')}</td></tr>
        </table>
        ${preview ? '' : `<div class="buy-box">
          <div class="price-row"><span class="price">${fmtRP(rpUnitCost(p))} RP</span></div>
          <div class="prod-line" style="margin-bottom:6px">${t('pdp.prodLine', { n: fmtRP(p.rpProd) })}${(ownedCounts(true)[p.id] || 0) ? ` · ${t('pdp.youOwn', { n: ownedCounts(true)[p.id] })}` : ''}</div>
          <span id="pdp-stock">${stockHtml(p)}</span>
          <div class="qty-row" style="margin-top:16px">
            <div class="qty-stepper">
              <button onclick="pdpQty(-1)" aria-label="${t('pdp.decrease')}">${icon('minus', 14)}</button>
              <span class="qty" id="pdp-qty">1</span>
              <button onclick="pdpQty(1, ${Math.min(99, stockOf(p))})" aria-label="${t('pdp.increase')}">${icon('plus', 14)}</button>
            </div>
          </div>
          ${addBtnHtml(p, true)}
          <div class="ship-hint">${icon('truck', 14)} ${t('pdp.shipHint')}</div>
        </div>`}
        ${priceChartHtml()}
      </div>
    </div>
    ${reviewsHtml(p)}
  </div>`;
}

function pdpQtyVal() { return parseInt(document.getElementById('pdp-qty').textContent, 10); }
function pdpQty(d, max = 9) {
  const el = document.getElementById('pdp-qty');
  el.textContent = Math.min(max, Math.max(1, pdpQtyVal() + d));
}

const AUTOPROMO_KEY = 'rambuy.autopromo';
const hasScratchedAny = () => loadOrders().some(o => o.scratched);
// Domyslnie WLACZONE po odblokowaniu (pierwsze zdrapanie); klucz trzyma tylko opt-out.
const autoPromoOn = () => hasScratchedAny() && localStorage.getItem(AUTOPROMO_KEY) !== '0';
function setAutoPromo(on) {
  if (on) localStorage.removeItem(AUTOPROMO_KEY);
  else localStorage.setItem(AUTOPROMO_KEY, '0');
  toast(t(on ? 'scratch.autoOn' : 'scratch.autoOff'), 'ticket');
}
// Przy wlaczonym auto: zastosuj najlepszy kod z portfela, jesli zaden nie jest aktywny.
function maybeAutoApplyPromo() {
  if (!autoPromoOn() || loadPromo()) return;
  const best = loadCodes().sort((a, b) => promoRate(b) - promoRate(a))[0];
  if (best) localStorage.setItem(PROMO_KEY, best);
}

function promoBoxHtml(pr) {
  if (pr.promo) {
    return `
    <div class="promo-applied">${icon('ticket', 14)} ${t('promo.applied', { code: pr.promo, pct: Math.round(promoRate(pr.promo) * 100) })}
      <button onclick="removePromo()" aria-label="${t('promo.removeAria')}">${icon('x', 13)}</button>
    </div>`;
  }
  const wallet = loadCodes();
  const chips = wallet.length
    ? `<div class="code-wallet">${wallet.map(c =>
        `<button class="code-chip" onclick="applyPromo('${c}')">${icon('ticket', 11)} ${c} · ${Math.round(promoRate(c) * 100)}%</button>`).join('')}</div>`
    : `<div class="promo-error" style="color:var(--ink-4)">${t('promo.noCodes')}</div>`;
  return `
  <div>
    ${chips}
    <div class="promo-row">
      <input id="promo-input" placeholder="${t('promo.placeholder')}" onkeydown="if(event.key==='Enter'){event.preventDefault();applyPromo()}">
      <button class="btn" onclick="applyPromo()">${t('promo.apply')}</button>
    </div>
    <div class="promo-error" id="promo-err"></div>
  </div>`;
}

function bagView() {
  const bag = loadBag();
  const ids = Object.keys(bag);
  if (ids.length) maybeAutoApplyPromo();
  if (!ids.length) {
    return `
    <div class="page"><div class="empty-state">
      ${icon('shopping-bag', 44)}
      <h3>${t('bag.empty.title')}</h3>
      <p>${t('bag.empty.sub')}</p>
      <a class="btn" href="#/">${t('bag.empty.cta')}</a>
    </div></div>`;
  }
  const pr = pricing(bag);
  const items = ids.map(id => {
    const p = product(id), q = bag[id];
    return `
    <div class="bag-item">
      <a href="#/product/${id}"><img src="${p.img}" alt="${p.name}"></a>
      <div class="bi-info">
        <h4>${p.name}</h4>
        <div class="sub">${p.sub}</div>
      </div>
      <div class="qty-stepper">
        <button onclick="setQty('${id}', ${q - 1})" aria-label="${t('pdp.decrease')}">${icon('minus', 14)}</button>
        <span class="qty">${q}</span>
        <button onclick="setQty('${id}', ${Math.min(99, q + 1)})" aria-label="${t('pdp.increase')}" ${q >= Math.min(99, stockOf(p)) ? 'disabled style="opacity:.35;pointer-events:none"' : ''}>${icon('plus', 14)}</button>
      </div>
      <div class="bi-price">${fmtRP(lineCost(id, q))} RP</div>
      <button class="remove" onclick="removeFromBag('${id}')" aria-label="${t('bag.removeAria')}">${icon('trash-2', 16)}</button>
    </div>`;
  }).join('');

  return `
  <div class="page">
    <h1 class="page-title">${t('bag.title')}</h1>
    <p class="page-sub">${plural(bagCount(bag), 'mb.items', 'mb.itemsPlural')} ·
      <button class="bag-clear" onclick="clearBag()">${icon('trash-2', 12)} ${t('bag.clear')}</button></p>
    <div class="bag-layout">
      <div class="bag-items">${items}</div>
      <div class="bag-summary">
        <h3>${t('bag.summary')}</h3>
        <div class="sum-row"><span>${t('bag.subtotal')}</span><span>${fmtRP(pr.subtotal)} RP</span></div>
        ${pr.discount ? `<div class="sum-row"><span>${t('bag.discount', { code: pr.promo })}</span><span class="disc">−${fmtRP(pr.discount)} RP</span></div>` : ''}
        <div class="sum-row"><span>${t('bag.shipping')}</span><span>${t('bag.shippingFree')}</span></div>
        ${promoBoxHtml(pr)}
        <div class="sum-row total"><span>${t('bag.total')}</span>
          <span>${pr.discount ? `<span class="was">${fmtRP(pr.subtotal)}</span>` : ''}${fmtRP(pr.total)} RP</span></div>
        <div class="sum-row" style="font-size:12px"><span>${t('bag.balance')}</span><span data-rp="bal">${fmtRP(rpBal)}</span></div>
        <br>
        ${rpBal >= pr.total
          ? `<button class="btn big full" onclick="placeOrder()">${icon('shopping-bag', 15)} ${t('bag.placeOrder', { amount: fmtRP(pr.total) })}</button>`
          : `<button class="btn big full" disabled>${affordLabel(pr.total - rpBal)}</button>`}
        <p class="co-note" style="margin:12px 0 0;justify-content:center">${icon('shield-check', 14)} ${t('bag.noPayment')}</p>
      </div>
    </div>
  </div>`;
}

function placeOrder() {
  maybeAutoApplyPromo();
  const overlay = document.getElementById('overlay-root');
  overlay.innerHTML = `
    <div class="overlay"><div class="processing">
      <div class="spinner"></div>
      <p id="proc-msg">${t('proc.placing')}</p>
    </div></div>`;

  const steps = [t('proc.placing'), t('proc.reserving'), t('proc.confirming')];
  steps.forEach((s, i) => setTimeout(() => {
    const el = document.getElementById('proc-msg');
    if (el) el.textContent = s;
  }, i * 400));

  setTimeout(() => {
    const pr = pricing();
    if (rpBal < pr.total) { overlay.innerHTML = ''; toast(t('toast.notEnough'), 'x'); return; }
    spendRp(pr.total);
    const order = {
      id: 'RB-' + Date.now().toString(36).toUpperCase().slice(-6),
      ts: Date.now(),
      dur: deliveredAt(),
      items: Object.entries(loadBag()).map(([id, qty]) => ({ id, qty })),
      total: pr.total,
      promo: pr.promo,
      discount: pr.discount,
      name: 'friend',
      city: 'Your address',
    };
    const hour = new Date().getHours();
    if (hour < 4) bumpStat('nightOrders');
    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);
    saveBag({});
    if (pr.promo) consumeCode(pr.promo);
    localStorage.removeItem(PROMO_KEY);
    dbg('order', { total: pr.total, promo: pr.promo || '-', disc: pr.discount || 0 });
    overlay.innerHTML = '';
    location.hash = '#/order/' + order.id;
    confetti();
    sndSuccess();
  }, 1300);
}

/* ---------- delivery booster ----------
   BP and upgrades are simply yours, forever, across all orders.
   Clicks speed up the delivery you are clicking; the BP they earn
   land in one permanent balance you spend on permanent upgrades. */
const BP_KEY = 'rambuy.bp';
const loadBP = () => Object.assign({ bank: 0, clickLv: 0, autoLv: 0 }, JSON.parse(localStorage.getItem(BP_KEY) || '{}'));
const saveBP = b => localStorage.setItem(BP_KEY, JSON.stringify(b));
function booster(order) {
  return order.booster || (order.booster = { earned: 0 });
}
const boClickVal = b => 1 + (b.clickLv || 0);
const boAutoRate = b => b.autoLv || 0;
const boClickCost = b => Math.round(50 * Math.pow(1.9, b.clickLv || 0));
const boAutoCost = b => Math.round(120 * Math.pow(1.9, b.autoLv || 0));

/* ---------- instant buy unlock ladder ---------- */
const instantPopoverUnlocked = () => loadOrders().some(isDelivered);
// Instant buy na kartach aktywuje sie, gdy dostawa spada do <=1 s (poziomy/bonusy).
const instantCardUnlocked = () => deliveredAt() <= 1;

function persistOrder(order) {
  const orders = loadOrders();
  const i = orders.findIndex(o => o.id === order.id);
  if (i < 0) return;
  // Rozne miejsca trzymaja wlasne kopie zamowienia (tracking, zdrapka) - zapis
  // starszej kopii nie moze cofnac jednokierunkowej flagi zdrapania.
  if (orders[i].scratched) order.scratched = true;
  orders[i] = order;
  saveOrders(orders);
}

function fmtDuration(sec) {
  if (sec < 60) return Math.round(sec) + 's';
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m ${Math.round(sec % 60)}s`;
}

function addBoost(order, amount) {
  booster(order).earned += amount;
  persistOrder(order);
  const g = loadBP();
  g.bank += amount;
  saveBP(g);
  bumpStat('bp', amount);
  updateBoosterUi(order);
}

// Rhythmic clicking builds a combo: 10 fast hits = x2, 25 = x3, 50 = x5.
let comboN = 0, comboLast = 0, comboTimer = null;
const comboMult = () => comboN >= 50 ? 5 : comboN >= 25 ? 3 : comboN >= 10 ? 2 : 1;

function boostClick(orderId, e) {
  const order = trackedOrder && trackedOrder.id === orderId ? trackedOrder : loadOrders().find(o => o.id === orderId);
  if (!order) return;
  const cue = document.getElementById('bo-click-cue');
  if (cue) { cue.classList.add('gone'); setTimeout(() => cue.remove(), 400); }
  const b = loadBP();
  const now = Date.now();
  comboN = now - comboLast < 700 ? comboN + 1 : 1;
  comboLast = now;
  bumpStat('clicks');
  const mult = comboMult();
  const gain = boClickVal(b) * mult;
  addBoost(order, gain);
  addXp(Math.max(1, Math.round(clickValue())));
  sndTick(Math.min(comboN * 12, 620));

  const wrap = e.currentTarget.parentElement;
  const f = document.createElement('span');
  f.className = 'bo-float';
  f.textContent = '+' + gain;
  f.style.left = (30 + Math.random() * 48) + '%';
  wrap.appendChild(f);
  setTimeout(() => f.remove(), 800);

  const badge = document.getElementById('bo-combo');
  if (badge) {
    badge.hidden = mult < 2;
    badge.textContent = t('bo.combo', { mult, n: comboN });
    badge.classList.remove('bo-combo'); void badge.offsetWidth; badge.classList.add('bo-combo');
  }
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => {
    comboN = 0;
    const el = document.getElementById('bo-combo');
    if (el) el.hidden = true;
  }, 900);
}

function buyUpgrade(kind) {
  const b = loadBP();
  const cost = kind === 'click' ? boClickCost(b) : boAutoCost(b);
  if (b.bank < cost) return;
  b.bank -= cost;
  if (kind === 'click') b.clickLv++; else b.autoLv++;
  saveBP(b);
  sndPop();
  updateBoosterUi(trackedOrder);
}

function boosterHtml(order) {
  return `
  <div class="booster-card">
    <div class="bo-head">
      <h3>${icon('zap', 17)} ${t('bo.title')}</h3>
      <span class="bo-bank"><span id="bo-bank">0</span> BP</span>
    </div>
    <div class="bo-main">
      <div class="bo-btn-wrap">
        <button class="bo-btn" onclick="boostClick('${order.id}', event)" aria-label="${t('bo.boostAria')}">${icon('package', 40)}</button>
        ${(loadStats().bp || 0) ? '' : `<div class="hero-click-cue bo-cue" id="bo-click-cue">${icon('mouse-pointer-click', 13)} ${t('hero.clickCue')}</div>`}
        <span class="bo-combo" id="bo-combo" hidden></span>
      </div>
      <div class="bo-stats">
        <div class="bo-stat"><b id="bo-saved">0s</b><span>${t('bo.saved')}</span></div>
        <div class="bo-stat"><b id="bo-click">+1</b><span>${t('bo.perClick')}</span></div>
        <div class="bo-stat"><b id="bo-auto">0/s</b><span>${t('bo.auto')}</span></div>
      </div>
    </div>
    <div class="bo-shop">
      <button class="bo-up" id="bo-up-click" onclick="buyUpgrade('click')">
        ${icon('coffee', 19)}
        <div><b>${t('bo.espresso.name')}</b><small>${t('bo.espresso.desc')} <span id="bo-lv-click">0</span></small></div>
        <span class="cost" id="bo-cost-click">50 BP</span>
      </button>
      <button class="bo-up" id="bo-up-auto" onclick="buyUpgrade('auto')">
        ${icon('mouse-pointer-click', 19)}
        <div><b>${t('bo.intern.name')}</b><small>${t('bo.intern.desc')} <span id="bo-lv-auto">0</span></small></div>
        <span class="cost" id="bo-cost-auto">120 BP</span>
      </button>
    </div>
    <p class="bo-note">${t('bo.note')}</p>
  </div>`;
}

function updateBoosterUi(order) {
  if (!order) return;
  const g = loadBP();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('bo-bank', fmtRP(g.bank));
  set('bo-saved', fmtDuration(booster(order).earned));
  set('bo-click', '+' + boClickVal(g));
  set('bo-auto', boAutoRate(g) + '/s');
  set('bo-lv-click', g.clickLv);
  set('bo-lv-auto', g.autoLv);
  set('bo-cost-click', fmtRP(boClickCost(g)) + ' BP');
  set('bo-cost-auto', fmtRP(boAutoCost(g)) + ' BP');
  const upC = document.getElementById('bo-up-click'), upA = document.getElementById('bo-up-auto');
  if (upC) upC.disabled = g.bank < boClickCost(g);
  if (upA) upA.disabled = g.bank < boAutoCost(g);
  if (isDelivered(order)) {
    const card = document.querySelector('.booster-card');
    if (card && !card.dataset.done) {
      card.dataset.done = '1';
      const btn = card.querySelector('.bo-btn');
      if (btn) { btn.setAttribute('disabled', ''); btn.style.pointerEvents = 'none'; }
      const note = card.querySelector('.bo-note');
      if (note) note.textContent = t('bo.doneNote');
    }
  }
}

function sndDelivered() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    // doorbell: ding-dong
    note(988, audioCtx.currentTime, 0.35, 0.09);
    note(784, audioCtx.currentTime + 0.28, 0.5, 0.09);
  } catch (e) { /* audio unavailable */ }
}

function sndTick(pitchUp = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    note(1150 + pitchUp, audioCtx.currentTime, 0.045, 0.05);
  } catch (e) { /* audio unavailable */ }
}

function instantFromPopover() {
  hideMiniBag();
  placeOrder();
}

const IBOK_KEY = 'rambuy.ibok';

// One-click purchase of a single unit straight from a card.
// First use explains the delivery time in a modal.
// Wycena instant buy z uwzglednieniem kuponu (auto lub recznie zalozonego).
function instantPricing(p) {
  maybeAutoApplyPromo();
  const base = rpUnitCost(p);
  const promo = loadPromo();
  const rate = loadCodes().includes(promo) ? promoRate(promo) : 0;
  const discount = Math.round(base * rate);
  return { base, promo: rate ? promo : '', discount, cost: base - discount };
}

function instantBuy(id) {
  const p = product(id);
  const { cost } = instantPricing(p);
  if (rpBal < cost) { toast(t('toast.needMore', { amount: fmtRP(cost - rpBal) }), 'lock'); return; }
  if (!localStorage.getItem(IBOK_KEY)) {
    document.getElementById('overlay-root').innerHTML = `
      <div class="overlay"><div class="unlock-modal">
        <div class="um-icon">${icon('zap', 30)}</div>
        <h2>${t('modal.instant.title')}</h2>
        <p>${t('modal.instant.body', { name: p.name, amount: fmtRP(cost), time: fmtDuration(deliveredAt()) })}</p>
        <label class="um-check"><input type="checkbox" id="ib-skip"> ${t('modal.instant.skip')}</label>
        <div class="um-actions">
          <button class="btn ghost" onclick="document.getElementById('overlay-root').innerHTML = ''">${t('modal.instant.cancel')}</button>
          <button class="btn" onclick="confirmInstant('${id}')">${icon('zap', 13)} ${t('modal.instant.buy', { amount: fmtRP(cost) })}</button>
        </div>
      </div></div>`;
    return;
  }
  doInstantBuy(id);
}

function confirmInstant(id) {
  if (document.getElementById('ib-skip')?.checked) localStorage.setItem(IBOK_KEY, '1');
  document.getElementById('overlay-root').innerHTML = '';
  doInstantBuy(id);
}

function doInstantBuy(id) {
  const p = product(id);
  const ip = instantPricing(p);
  if (rpBal < ip.cost) { toast(t('toast.needMore', { amount: fmtRP(ip.cost - rpBal) }), 'lock'); return; }
  spendRp(ip.cost);
  if (ip.promo) { consumeCode(ip.promo); localStorage.removeItem(PROMO_KEY); }
  dbg('instant', { total: ip.cost, promo: ip.promo || '-', disc: ip.discount });
  const order = {
    id: 'RB-' + Date.now().toString(36).toUpperCase().slice(-6),
    ts: Date.now(),
    dur: deliveredAt(),
    items: [{ id, qty: 1 }],
    total: ip.cost, promo: ip.promo, discount: ip.discount,
    name: 'friend', city: 'Your address',
  };
  if (new Date().getHours() < 4) bumpStat('nightOrders');
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);
  sndPop();
  toast(t('toast.ordered', { name: p.name, time: fmtDuration(deliveredAt()) }), 'zap');
  keepScrollY = window.scrollY;
  renderRoute();
}

function shareKit(id) {
  const p = product(id);
  const url = location.origin + location.pathname + '#/product/' + id;
  if (navigator.share) {
    navigator.share({ title: `${p.name} - RamNeverComes`, text: `${p.name} · +${fmtRP(p.rpProd)} RP/s`, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(
      () => toast(t('pdp.shareCopied'), 'share-2'),
      () => toast(url, 'share-2'));
  }
}

/* ---------- order tracking + courier map ---------- */
// Boost points shift the whole delivery timeline forward: 1 BP = 1 second.
function effectiveElapsed(order) {
  return (Date.now() - order.ts) / 1000 + booster(order).earned;
}

function orderStage(order) {
  const elapsed = effectiveElapsed(order);
  let stage = 0;
  STAGE_TIMES.forEach((t, i) => { if (elapsed >= stageAt(i, order)) stage = i; });
  return stage;
}

function courierMapHtml(order) {
  return `
  <div class="map-wrap">
    <svg viewBox="0 0 640 240">
      <rect class="block" x="70" y="50" width="90" height="70" rx="4"/>
      <rect class="block" x="200" y="80" width="110" height="90" rx="4"/>
      <rect class="park" x="360" y="80" width="90" height="55" rx="4"/>
      <rect class="block" x="200" y="20" width="120" height="30" rx="4"/>
      <rect class="water" x="60" y="150" width="140" height="60" rx="20"/>
      <rect class="block" x="480" y="150" width="110" height="60" rx="4"/>
      <line class="street minor" x1="0" x2="640" y1="40" y2="40"/>
      <line class="street minor" x1="0" x2="640" y1="130" y2="130"/>
      <line class="street minor" x1="180" x2="180" y1="0" y2="240"/>
      <line class="street minor" x1="340" x2="340" y1="0" y2="240"/>
      <line class="street minor" x1="470" x2="470" y1="0" y2="240"/>

      <path class="route-path" id="map-main" d="M50,205 L50,142 L188,142 L188,64 L332,64 L332,142 L462,142 L462,98 L560,98 L560,116 L596,116"/>
      <path class="route-done" id="map-done" d="M50,205 L50,142 L188,142 L188,64 L332,64 L332,142 L462,142 L462,98 L560,98 L560,116 L596,116"/>

      <g transform="translate(38,208)" class="map-pin-ico">${icon('package', 18)}</g>
      <text class="map-label" x="62" y="222">${t('order.warehouse')}</text>
      <g transform="translate(596,108)" class="map-pin-ico">${icon('house', 18)}</g>
      <text class="map-label" x="590" y="140" text-anchor="end">${t('order.yourAddress')}</text>

      <g class="map-courier" id="map-courier">
        <circle class="ring" r="7"/>
        <circle r="5"/>
      </g>
    </svg>
  </div>`;
}

function updateCourier(order) {
  const main = document.getElementById('map-main');
  const done = document.getElementById('map-done');
  const courier = document.getElementById('map-courier');
  if (!main || !courier) return;
  const mainLen = main.getTotalLength();
  const p = Math.min(1, effectiveElapsed(order) / orderDur(order));
  const pt = main.getPointAtLength(p * mainLen);
  done.style.strokeDasharray = mainLen;
  done.style.strokeDashoffset = mainLen * (1 - p);
  courier.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
  courier.classList.toggle('arrived', p >= 1);
  // Mobile: mapa jest szersza niz ekran - podazaj kadrem za kurierem,
  // chyba ze user wlasnie przesuwa mape palcem.
  const wrap = courier.closest('.map-wrap');
  if (wrap && wrap.scrollWidth > wrap.clientWidth + 4) {
    if (!wrap.dataset.panBound) {
      wrap.dataset.panBound = '1';
      wrap.addEventListener('touchstart', () => { wrap.dataset.hold = Date.now(); }, { passive: true });
    }
    if (!wrap.dataset.hold || Date.now() - +wrap.dataset.hold > 4000) {
      const scale = wrap.scrollWidth / 640;
      wrap.scrollTo({ left: Math.max(0, pt.x * scale - wrap.clientWidth / 2), behavior: 'smooth' });
    }
  }
}

function orderView(id) {
  const order = loadOrders().find(o => o.id === id);
  if (!order) return notFoundView();
  const isNew = Date.now() - order.ts < 8000;

  const items = order.items.map(({ id, qty }) => {
    const p = product(id);
    return `<div class="oi-row">
      <img src="${p.img}" alt="${p.name}">
      <div class="n">${p.name}<small>${p.sub}</small></div>
      <span>× ${qty}</span>
    </div>`;
  }).join('');

  return `
  <div class="page">
    <div class="order-hero">
      <div class="check-ring">${icon('circle-check-big', 36)}</div>
      <h1>${isNew ? t('order.thanks') : t('order.details')}</h1>
      <p>${t('order.meta', { id: `<span class="ord-no">${order.id}</span>`, amount: fmtRP(order.total), date: new Date(order.ts).toLocaleString(curLocale()) })}</p>
      ${order.promo ? `<p class="ord-promo">${icon('ticket', 13)} ${t('order.promoUsed', { code: order.promo, amount: fmtRP(order.discount) })}</p>` : ''}
    </div>

    <div class="track-card">
      <div class="track-head">
        <h3>${icon('package', 18)} ${t('order.tracking')}</h3>
        <span class="eta" id="order-eta">${icon('clock', 13)} ${orderEtaText(order)}</span>
      </div>
      <div class="timeline" id="timeline"></div>
      ${courierMapHtml(order)}
    </div>

    ${boosterHtml(order)}
    ${scratchHtml(order)}

    <div class="order-items">
      <h3>${t('order.items')}</h3>
      ${items}
      <p class="page-sub" style="margin:14px 0 0;font-size:12px">
        ${t('order.note')}
      </p>
    </div>
  </div>`;
}

function orderEtaText(order) {
  return isDelivered(order)
    ? t('order.etaDone')
    : t('order.eta', { time: fmtDuration(Math.max(1, orderDur(order) - effectiveElapsed(order))) });
}

function renderTimeline(order) {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  const eta = document.getElementById('order-eta');
  if (eta) eta.innerHTML = `${icon('clock', 13)} ${orderEtaText(order)}`;
  const stage = orderStage(order);
  tl.innerHTML = TRACKING_STAGES.map((s, i) => {
    const done = i < stage, current = i === stage;
    // Boost can pull a stage into the present - never show a future timestamp.
    const at = Math.min(Date.now(), order.ts + stageAt(i) * 1000);
    // Przyszle etapy renderuja tresc niewidocznie: wysokosc kroku jest stala,
    // wiec boostowanie nie przesuwa strony (i przycisku) pod kursorem.
    const hide = i <= stage ? '' : ' style="visibility:hidden"';
    const time = `<span class="t-time"${hide}>${new Date(at).toLocaleTimeString(curLocale())}</span>`;
    return `
    <div class="t-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
      <div class="t-dot">${icon(done ? 'check' : s.icon, 17)}</div>
      <div class="t-body">
        <h5>${t('stage.' + s.key + '.label')}</h5>
        <p${hide}>${t('stage.' + s.key + '.detail')}</p>
        ${time}
      </div>
    </div>`;
  }).join('');
  updateCourier(order);
  updateBoosterUi(order);
}

let trackedOrder = null;
function startTracking(id) {
  const order = loadOrders().find(o => o.id === id);
  if (!order) return;
  trackedOrder = order;
  let wasDelivered = isDelivered(order);
  renderTimeline(order);
  updateBoosterUi(order);
  viewTimers.push(setInterval(() => {
    renderTimeline(order);
    if (!wasDelivered && isDelivered(order)) {
      wasDelivered = true;
      sndDelivered();
      toast(t('order.deliveredToast'), 'house');
    }
  }, 1000));
  viewTimers.push(setInterval(() => {
    if (!document.hidden && !isDelivered(order) && boAutoRate(loadBP()) > 0) {
      addBoost(order, boAutoRate(loadBP()));
    }
  }, 1000));
}

/* ---------- orders list ---------- */
function ordersView() {
  const orders = loadOrders();
  if (!orders.length) {
    return `
    <div class="page"><div class="empty-state">
      ${icon('receipt', 44)}
      <h3>${t('orders.empty.title')}</h3>
      <p>${t('orders.empty.sub')}</p>
      <a class="btn" href="#/">${t('orders.empty.cta')}</a>
    </div></div>`;
  }
  const saved = orders.reduce((s, o) => s + o.total, 0);
  const rows = orders.map(o => {
    const stage = orderStage(o);
    const s = TRACKING_STAGES[stage];
    const n = o.items.reduce((a, it) => a + it.qty, 0);
    return `
    <a class="order-card" href="#/order/${o.id}">
      <div class="oc-icon">${icon('package', 20)}</div>
      <div class="oc-info">
        <h4>${o.id}</h4>
        <div class="sub">${plural(n, 'orders.items', 'orders.itemsPlural')} · ${fmtRP(o.total)} RP · ${new Date(o.ts).toLocaleDateString(curLocale())}</div>
      </div>
      <span class="status-chip">${icon(s.icon, 11)} ${t('stage.' + s.key + '.label')}</span>
    </a>`;
  }).join('');
  return `
  <div class="page">
    <h1 class="page-title">${t('orders.title')}</h1>
    <p class="page-sub">${t('orders.spent')} <b style="color:var(--ink)">${fmtRP(saved)} RP</b> ·
      ${t('orders.real')} <b style="color:var(--green)">$0.00</b>${t('orders.forever')}</p>
    ${rows}
  </div>`;
}


function notFoundView() {
  return `
  <div class="page"><div class="empty-state">
    ${icon('search', 44)}
    <h3>${t('nf.title')}</h3>
    <p>${t('nf.sub')}</p>
    <a class="btn" href="#/">${t('nf.cta')}</a>
  </div></div>`;
}

const legalContact = () =>
  `<p class="legal-contact">${t('legal.contact', { email: '<a href="mailto:contact@ramnevercomes.com">contact@ramnevercomes.com</a>' })}</p>`;

function termsView() {
  const rules = [1, 2, 3, 4, 5, 6, 7].map(i => `<li>${t('legal.terms.r' + i)}</li>`).join('');
  return `
  <div class="page legal-page">
    <h1>${t('legal.terms.title')}</h1>
    <p class="legal-intro">${t('legal.terms.intro')}</p>
    <ol class="legal-list">${rules}</ol>
    ${legalContact()}
  </div>`;
}

function privacyView() {
  const secs = [1, 2, 3, 4].map(i =>
    `<h4>${t('legal.privacy.s' + i + 't')}</h4><p>${t('legal.privacy.s' + i + 'b')}</p>`).join('');
  return `
  <div class="page legal-page">
    <h1>${t('legal.privacy.title')}</h1>
    <p class="legal-intro">${t('legal.privacy.intro')}</p>
    ${secs}
    ${legalContact()}
  </div>`;
}


/* ---------- RP economy core (incremental engine) ---------- */
const RP_KEY = 'rambuy.rp';
const SEEN_KEY = 'rambuy.seen';
let rpBal = parseFloat(localStorage.getItem(RP_KEY) ?? 'NaN');
let welcomeGrant = false;
if (Number.isNaN(rpBal)) { rpBal = 128; welcomeGrant = true; }
const saveRp = () => localStorage.setItem(RP_KEY, String(Math.floor(rpBal)));

function fmtRP(n) {
  n = Math.floor(n);
  if (n < 1000) return n.toLocaleString('en-US');
  const units = [[1e18, 'Qi'], [1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [v, u] of units) if (n >= v) {
    const x = n / v;
    return (x >= 100 ? Math.round(x) : x.toFixed(x >= 10 ? 1 : 2)) + u;
  }
}

const signedRp = n => (n < 0 ? '-' : '+') + fmtRP(Math.abs(n)) + ' RP';

const RP_LADDER = [...PRODUCTS].sort((a, b) => a.rpCost - b.rpCost);
// Dostawy przyspieszaja z poziomem: -21 s/lvl, 1 s ~lvl 30 (15 s/lvl dawalo lvl 41 - za pozno).
const deliveredAt = () => Math.max(1, STAGE_TIMES[STAGE_TIMES.length - 1] - 21 * (xpInfo().lvl - 1));
// Czas dostawy zamrozony w momencie zlozenia zamowienia (o.dur) - awans w trakcie
// nie skraca retroaktywnie starych dostaw (zawyzalo zarobki offline). Fallback
// deliveredAt() dla zapisow sprzed tej zmiany.
const orderDur = o => (o && o.dur) || deliveredAt();
const stageAt = (i, o) => STAGE_TIMES[i] / STAGE_TIMES[STAGE_TIMES.length - 1] * orderDur(o);
const isDelivered = order => effectiveElapsed(order) >= orderDur(order);

// all=true counts everything you bought (for pricing/milestones);
// all=false counts only delivered kits + case drops (production).
function ownedCounts(all = false) {
  const c = {};
  loadOrders().forEach(o => {
    if (all || isDelivered(o)) o.items.forEach(it => { c[it.id] = (c[it.id] || 0) + it.qty; });
  });
  loadGacha().forEach(x => { c[x.id] = (c[x.id] || 0) + 1; });
  return c;
}
// GB liczone z DOSTARCZONYCH kitow (+ skrzynki, ktore instaluja sie od razu) -
// mnoznik progow rusza dopiero, gdy zamowienie dojedzie, spojnie z produkcja.
function gbOwned() {
  const c = ownedCounts();
  return Object.entries(c).reduce((s, [id, n]) => s + capacityGB(product(id)) * n, 0);
}
function prodMult() {
  const gb = gbOwned();
  let n = 0;
  GB_MILESTONES.forEach(m => { if (gb >= m.gb) n++; });
  // 1.15^n: progi GB wypadaja ~1 na tier drabinki, wiec mnoznik kamienia
  // sklada sie z produkcja tieru (x1.618). Warunek stabilnosci ekonomii:
  // 1.618 * bonus < 2 (wzrost cen), inaczej czas do kolejnego kitu MALEJE
  // i gra ucieka (logi gracza 2026-07-19: przy 1.5 odstepy staly w miejscu ~20 s,
  // przy 2.0 malaly do 2 s). 1.15: efektywnie 1.86/tier, odstepy rosna ~7%/tier.
  return Math.pow(1.15, n);
}
function cps() {
  const c = ownedCounts();
  let s = 0;
  Object.entries(c).forEach(([id, n]) => { s += product(id).rpProd * n; });
  return s * prodMult();
}
// Each extra copy of the same kit costs x1.15 more.
function rpUnitCost(p, offset = 0) {
  const owned = ownedCounts(true)[p.id] || 0;
  return Math.round(p.rpCost * Math.pow(1.15, owned + offset));
}
function spendRp(n) { rpBal -= n; saveRp(); updateXpChip(); }

// The first two rungs are always visible; the rest reveal once you have
// earned 8x their price (or own one). Earnings only grow, so reveals never regress.
// Prog 8x: symulacja (CLAUDE.md, Balans) - przy 2x odkrycia wypadaly co ~1 min
// na starcie; przy 8x pierwsze co ~5-9 min, pozniejsze co kilkanascie+.
const CHEAT_KEY = 'rambuy.cheat';
const isRevealed = p => RP_LADDER.indexOf(p) < 2 ||
  localStorage.getItem(CHEAT_KEY) === 'unlockall' ||
  loadStats().xp >= p.rpCost * 8 || (ownedCounts(true)[p.id] || 0) > 0;

// Console cheat, e.g. cheat('unlockall'). Cleared by "Clear progress".
function cheat(code) {
  if (code === 'unlockall') {
    localStorage.setItem(CHEAT_KEY, 'unlockall');
    localStorage.setItem(REVEAL_KEY, String(RP_LADDER.length));
    toast(t('toast.cheat'), 'sparkles');
    renderRoute();
    tickNavBadges();
    return `all ${RP_LADDER.length} kits + all features unlocked (resets with Clear progress)`;
  }
  return `unknown cheat: ${code}`;
}
const REVEAL_KEY = 'rambuy.reveal';
function checkReveals() {
  const n = RP_LADDER.filter(isRevealed).length;
  const seen = parseInt(localStorage.getItem(REVEAL_KEY) || '0', 10);
  if (n > seen) {
    localStorage.setItem(REVEAL_KEY, String(n));
    if (seen > 0) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        sndPop();
        toast(t('toast.newKit', { name: RP_LADDER[n - 1].name }), 'sparkles');
      } else {
        sndReveal();
        revealCinematic(RP_LADDER[n - 1], n - seen - 1);
      }
      dbg('reveal', {
        kit: RP_LADDER[n - 1].id,
        plus: n - seen - 1,
        gapS: dbgLastRevealTs ? Math.round((Date.now() - dbgLastRevealTs) / 1000) : null,
      });
      dbgLastRevealTs = Date.now();
      // Odswiez drabinke od razu (bez przeladowania), jesli jest na ekranie.
      const route = (location.hash || '#/').replace(/^#\//, '').split('/')[0];
      if (route === '' || route === 'kits') {
        keepScrollY = window.scrollY;
        renderRoute();
      }
    }
  }
  if (n === RP_LADDER.length && !localStorage.getItem('rambuy.allkits')) {
    localStorage.setItem('rambuy.allkits', '1');
    confetti();
    sndSuccess();
    document.getElementById('overlay-root').innerHTML = `
      <div class="overlay"><div class="unlock-modal">
        <div class="um-icon">${icon('trophy', 30)}</div>
        <span class="eyebrow">${icon('sparkles', 12)} ${t('modal.allkits.eyebrow')}</span>
        <h2>${t('modal.allkits.title', { n: RP_LADDER.length })}</h2>
        <p>${t('modal.allkits.body')}</p>
        <div class="um-actions">
          <button class="btn" onclick="closeUnlockModal()">${t('modal.allkits.cta')}</button>
        </div>
      </div></div>`;
  }
}


/* ---------- burger menu (mobile) ---------- */
function toggleBurger(e) {
  e?.stopPropagation();
  const root = document.getElementById('burger-root');
  if (root.innerHTML) { closeBurger(); return; }
  const items = [
    ['nav.kits', '#/kits', null],
    ['nav.discover', '#/discover', 'discover'],
    ['nav.mystery', '#/mystery', 'mystery'],
    ['nav.spin', '#/spin', 'spin'],
    ['nav.market', '#/market', 'market'],
    ['nav.orders', '#/orders', null],
    ['nav.profile', '#/profile', null],
  ].map(([key, href, feat]) => {
    const locked = feat && !featureUnlocked(feat);
    return locked
      ? `<button class="bm-item locked" onclick="toast(t('nav.unlocksAt', { lvl: FEATURE_LVL['${feat}'], cur: xpInfo().lvl }), 'lock')">${t(key)} ${icon('lock', 13)}</button>`
      : `<a class="bm-item" href="${href}">${t(key)} ${icon('chevron-right', 14)}</a>`;
  }).join('');
  root.innerHTML = `
    <div class="burger-veil" onclick="closeBurger()"></div>
    <aside class="burger-drawer">
      <div class="bm-head"><b data-icon="memory-stick">RamNeverComes</b>
        <button class="theme-btn" onclick="closeBurger()">${icon('x', 18)}</button></div>
      ${items}
    </aside>`;
  hydrateIcons(root);
}
function closeBurger() {
  const root = document.getElementById('burger-root');
  const drawer = root.querySelector('.burger-drawer');
  if (!drawer) return;
  drawer.classList.add('closing');
  root.querySelector('.burger-veil').classList.add('closing');
  setTimeout(() => { root.innerHTML = ''; }, 250);
}


/* ---------- debug telemetry (rambuy.test / cheat('debug')) ---------- */
const DBG_KEY = 'rambuy.debuglog';
// Tryb debug: debug(true/false) z konsoli; bez flagi auto-on na hostach dev.
const dbgOn = () => {
  const f = localStorage.getItem('rambuy.debug');
  if (f === '1') return true;
  if (f === '0') return false;
  return location.hostname === 'rambuy.test' || location.hostname === 'localhost';
};
function debug(on = true) {
  localStorage.setItem('rambuy.debug', on ? '1' : '0');
  location.reload();
}
let dbgEvents = null;
let dbgClicks = [];
let dbgLastRevealTs = 0;
function dbg(type, data = {}) {
  if (!dbgOn()) return;
  if (!dbgEvents) { try { dbgEvents = JSON.parse(localStorage.getItem(DBG_KEY) || '[]'); } catch (e) { dbgEvents = []; } }
  dbgEvents.push({
    t: new Date().toISOString().slice(11, 19),
    type,
    xp: Math.round(loadStats().xp),
    rp: Math.round(rpBal),
    cps: Math.round(cps() * 10) / 10,
    lvl: xpInfo().lvl,
    ...data,
  });
  if (dbgEvents.length > 4000) dbgEvents = dbgEvents.slice(-3000);
  localStorage.setItem(DBG_KEY, JSON.stringify(dbgEvents));
}
const dbgClickRate = () => {
  const cut = Date.now() - 5000;
  dbgClicks = dbgClicks.filter(x => x > cut);
  return Math.round(dbgClicks.length / 5 * 10) / 10;
};
function debugDump() {
  if (!dbgEvents) { try { dbgEvents = JSON.parse(localStorage.getItem(DBG_KEY) || '[]'); } catch (e) { dbgEvents = []; } }
  const lines = dbgEvents.map(e => {
    const extra = Object.entries(e).filter(([k]) => !['t', 'type', 'xp', 'rp', 'cps', 'lvl'].includes(k))
      .map(([k, v]) => k + '=' + v).join(' ');
    return `${e.t} ${e.type.padEnd(8)} xp=${e.xp} rp=${e.rp} cps=${e.cps} lvl=${e.lvl} ${extra}`.trim();
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ramnevercomes-log.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  return lines.length + ' zdarzen';
}
function debugClear() { dbgEvents = []; localStorage.removeItem(DBG_KEY); return 'log wyczyszczony'; }
function dbgHud() {
  if (!dbgOn() || document.getElementById('dbg-hud')) return;
  const el = document.createElement('div');
  el.id = 'dbg-hud';
  el.innerHTML = `<span id="dbg-line"></span><button onclick="debugDump()" title="Pobierz log">log</button>`;
  document.body.appendChild(el);
  setInterval(() => {
    const line = document.getElementById('dbg-line');
    if (line) line.textContent = `${dbgClickRate()} kl/s · ${fmtRP(cps())} RP/s · lvl ${xpInfo().lvl} · xp ${fmtRP(loadStats().xp)}`;
  }, 500);
  setInterval(() => dbg('snap', { klps: dbgClickRate(), rev: RP_LADDER.filter(isRevealed).length, mult: Math.round(prodMult() * 10) / 10 }), 10000);
}

/* ---------- konami code: deszcz kosci RAM ---------- */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiPos = 0;
window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  konamiPos = k === KONAMI[konamiPos] ? konamiPos + 1 : (k === KONAMI[0] ? 1 : 0);
  if (konamiPos === KONAMI.length) { konamiPos = 0; ramRain(); }
});

function ramRain() {
  sndSuccess();
  const pool = RP_LADDER.filter(isRevealed).map(p => p.img);
  if (!pool.length) pool.push(RP_LADDER[0].img);
  for (let i = 0; i < 36; i++) {
    const el = document.createElement('img');
    el.src = pool[Math.floor(Math.random() * pool.length)];
    el.className = 'ram-drop';
    el.style.width = (34 + Math.random() * 56) + 'px';
    el.style.left = (Math.random() * 96) + 'vw';
    el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    el.style.animationDuration = (1.6 + Math.random() * 2.2) + 's';
    el.style.animationDelay = (Math.random() * 1.1) + 's';
    el.addEventListener('animationend', () => el.remove());
    document.body.appendChild(el);
  }
  toast(t('konami.toast'), 'sparkles');
}

/* ---------- kit reveal cinematic ---------- */
let revealTimer = null;
function revealCinematic(p, extra) {
  const old = document.getElementById('kit-reveal');
  if (old) old.remove();
  clearTimeout(revealTimer);
  const el = document.createElement('div');
  el.id = 'kit-reveal';
  // Przez pierwsza 1s przepuszczaj klikniecia (spam w booster nie zamyka overlay'a).
  el.classList.add('kr-passthrough');
  setTimeout(() => el.classList.remove('kr-passthrough'), 1000);
  el.innerHTML = `
    <div class="kr-card" onclick="closeKitReveal('#/product/${p.id}')">
      <div class="kr-glow"></div>
      ${[...Array(8)].map((_, i) => `<i class="kr-spark s${i}"></i>`).join('')}
      <div class="kr-img"><img src="${p.img}" alt="${p.name}" draggable="false"></div>
      <span class="kr-eyebrow">${icon('sparkles', 12)} ${t('reveal.eyebrow')}</span>
      <b class="kr-name">${p.name}</b>
      ${extra > 0 ? `<span class="kr-more">${t('reveal.more', { n: extra })}</span>` : ''}
      <i class="kr-timer"></i>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) closeKitReveal(); });
  document.body.appendChild(el);
  el.style.setProperty('--kr-ttl', '3200ms');
  revealTimer = setTimeout(() => closeKitReveal(), 3200);
}
function closeKitReveal(href) {
  const el = document.getElementById('kit-reveal');
  if (!el) return;
  clearTimeout(revealTimer);
  el.classList.add('kr-out');
  setTimeout(() => el.remove(), 350);
  if (href) location.hash = href;
}

/* ---------- main clicker ---------- */
let frenzyUntil = 0;
function clickValue() {
  // 4% produkcji za klik (historia: 1% -> 2% -> 4%; przy 1% klik czul sie bezuzyteczny).
  // Z combo x5 i frenzy x7 aktywne klikanie 8/s daje ~60-100% bonusu do produkcji.
  return (1 + cps() * 0.04) * comboMult() * (Date.now() < frenzyUntil ? 7 : 1);
}
function mainClick(e) {
  dbgClicks.push(Date.now());
  const now = Date.now();
  comboN = now - comboLast < 700 ? comboN + 1 : 1;
  comboLast = now;
  bumpStat('clicks');
  const cue = document.getElementById('hero-click-cue');
  if (cue) { cue.classList.add('gone'); setTimeout(() => cue.remove(), 400); }
  const crit = Math.random() < 0.05;
  const v = Math.max(1, Math.round(clickValue() * (crit ? 10 : 1)));
  addXp(v);
  sndTick(crit ? 700 : Math.min(comboN * 12, 500));
  const host = e.currentTarget.parentElement;
  host.style.position = 'relative';
  const f = document.createElement('span');
  f.className = 'bo-float' + (crit ? ' crit' : '');
  f.textContent = (crit ? t('hero.crit') + ' +' : '+') + fmtRP(v);
  const r = e.currentTarget.getBoundingClientRect(), hr = host.getBoundingClientRect();
  f.style.left = (e.clientX - hr.left) + 'px';
  f.style.top = (e.clientY - hr.top - 10) + 'px';
  host.appendChild(f);
  setTimeout(() => f.remove(), 800);
  const img = e.currentTarget;
  img.classList.remove('clicked'); void img.offsetWidth; img.classList.add('clicked');
}

/* ---------- tick + offline earnings ---------- */
function tickEconomy() {
  const c = cps();
  if (c > 0) {
    rpBal += c;
    const st = loadStats(); st.xp += c; saveStats(st);
    saveRp();
  }
  localStorage.setItem(SEEN_KEY, String(Date.now()));
  updateXpChip();
  checkReveals();
  const msNow = gbMilestone(gbOwned()).reached;
  const msSeen = localStorage.getItem('rambuy.msseen');
  if (msNow && msSeen !== String(msNow.gb)) {
    // brak klucza = pierwszy tick po aktualizacji/nowej grze - zapisz bez fanfar
    if (msSeen !== null) toast(t('toast.milestone', { what: msTxt(msNow) }), 'memory-stick');
    localStorage.setItem('rambuy.msseen', String(msNow.gb));
  } else if (!msNow && msSeen === null) localStorage.setItem('rambuy.msseen', '0');
  tickNavBadges();
  refreshStockButtons();
  updateHero();
  if (Date.now() % 10000 < 1000) checkAchievements();
  document.querySelectorAll('[data-rp]').forEach(el => {
    const k = el.dataset.rp;
    el.textContent = k === 'bal' ? fmtRP(rpBal) : k === 'cps' ? fmtRP(cps()) : fmtRP(Math.round(clickValue()));
  });
}
// The game never pauses: production accrues in full while you are away.
// Each kit earns from the moment it was actually delivered (boost included).
function offlineEarnings() {
  const seen = parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
  if (!seen) return;
  const now = Date.now();
  let gain = 0;
  loadOrders().forEach(o => {
    const deliveredTs = o.ts + (orderDur(o) - (o.booster ? o.booster.earned : 0)) * 1000;
    const from = Math.max(seen, deliveredTs);
    if (now > from) {
      const kitProd = o.items.reduce((s, it) => s + product(it.id).rpProd * it.qty, 0);
      gain += kitProd * (now - from) / 1000;
    }
  });
  loadGacha().forEach(x => {
    const from = Math.max(seen, x.ts);
    if (now > from) gain += product(x.id).rpProd * (now - from) / 1000;
  });
  gain = Math.floor(gain * prodMult());
  if (gain >= 10) {
    addXp(gain);
    setTimeout(() => toast(t('toast.away', { amount: fmtRP(gain) }), 'memory-stick'), 1200);
  }
}

/* ---------- golden package ---------- */
function scheduleGolden() {
  setTimeout(spawnGolden, 120000 + Math.random() * 180000);
}
function spawnGolden() {
  if (!document.hidden && !document.querySelector('.golden-pkg')) {
    const el = document.createElement('button');
    el.className = 'golden-pkg';
    el.innerHTML = icon('gift', 26);
    el.style.top = (12 + Math.random() * 55) + 'vh';
    el.onclick = () => {
      el.remove();
      sndSuccess();
      bumpStat('golden');
      if (Math.random() < 0.3) {
        frenzyUntil = Date.now() + 20000;
        dbg('golden', { frenzy: 1 });
        toast(t('toast.frenzy'), 'zap');
      } else {
        const gain = Math.max(50, Math.round(cps() * 60 + rpBal * 0.01));
        dbg('golden', { gain });
        addXp(gain, t('toast.golden'));
      }
    };
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 10000);
  }
  scheduleGolden();
}

/* ---------- RAM Points (xp) - the layer that ties every mechanic together ---------- */
const STATS_KEY = 'rambuy.stats';
const loadStats = () => Object.assign({ xp: 0, swipes: 0, spins: 0 }, JSON.parse(localStorage.getItem(STATS_KEY) || '{}'));
const saveStats = s => localStorage.setItem(STATS_KEY, JSON.stringify(s));

function bumpStat(key, n = 1) {
  const s = loadStats();
  s[key] = (s[key] || 0) + n;
  saveStats(s);
}

function addXp(n, label, bump = {}) {
  const s = loadStats();
  s.xp += n;
  Object.entries(bump).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
  saveStats(s);
  rpBal += n;
  saveRp();
  updateXpChip();
  if (label) toast(`${label} · +${fmtRP(n)} RP`, 'sparkles');
}

// Logarithmic levels for an exponential economy: each level doubles the
// lifetime earnings required. Level 1 ends at 100 RP, 10 at ~51K, 22 at ~210M.
function xpInfo() {
  const xp = loadStats().xp;
  const lvl = Math.max(1, Math.floor(Math.log2(xp / 50)));
  const base = 50 * Math.pow(2, lvl);
  const need = base; // next level costs as much again
  return { lvl, cur: Math.max(0, xp - base), need, xp };
}

function updateXpChip() {
  const chip = document.getElementById('xp-chip');
  if (!chip) return;
  const { lvl } = xpInfo();
  chip.innerHTML = `${fmtRP(rpBal)} RP <span class="xp-cps">· ${fmtRP(cps())}/s</span>`;
  chip.title = t('nav.xpChipTip', { lvl });
}

// GB milestones with real-world (approximately true) reference points.
const GB_MILESTONES = [
  { gb: 16, txt: 'a PlayStation 5 (16 GB GDDR6)' },
  { gb: 32, txt: 'a serious gaming PC (32 GB)' },
  { gb: 64, txt: 'about 16 million Apollo Guidance Computers (4 KB each)' },
  { gb: 128, txt: 'a maxed-out MacBook Pro (128 GB)' },
  { gb: 192, txt: 'a maxed-out Mac Studio M2 Ultra (192 GB)' },
  { gb: 512, txt: 'a maxed-out Mac Studio M3 Ultra (512 GB)' },
  { gb: 1024, txt: 'half an NVIDIA DGX H100 AI server (2 TB)' },
  { gb: 2048, txt: 'a full NVIDIA DGX H100 AI server (2 TB)' },
  { gb: 6144, txt: 'a fully loaded dual-socket EPYC server (6 TB)' },
  { gb: 16384, txt: 'IBM Watson, the computer that won Jeopardy! (16 TB)' },
  { gb: 104000, txt: 'Roadrunner, the fastest supercomputer of 2008 (~104 TB)' },
  { gb: 1300000, txt: 'Sierra, a top-3 supercomputer (~1.3 PB)' },
  { gb: 4900000, txt: 'Fugaku, Japan’s flagship supercomputer (~4.9 PB)' },
  { gb: 9200000, txt: 'Frontier, the first exascale supercomputer (~9.2 PB of total memory)' },
];

function gbMilestone(gb) {
  let reached = null, next = null;
  for (const m of GB_MILESTONES) {
    if (gb >= m.gb) reached = m;
    else { next = m; break; }
  }
  return { reached, next };
}

function lifetimeStats() {
  const orders = loadOrders();
  const spent = orders.reduce((s, o) => s + o.total, 0);
  const codeSaved = orders.reduce((s, o) => s + (o.discount || 0), 0);
  const boost = orders.reduce((s, o) => s + (o.booster ? o.booster.earned : 0), 0);
  const kits = Object.values(ownedCounts(true)).reduce((a, b) => a + b, 0);
  const pulls = loadGacha();
  const st = loadStats();
  return { orders: orders.length, gb: gbOwned(), spent, codeSaved, boost, kits, pulls, st };
}

function profileView() {
  const { lvl, cur, need, xp } = xpInfo();
  const L = lifetimeStats();
  const legend = L.pulls.filter(x => x.rarity === 'legendary').length;
  const since = parseInt(localStorage.getItem(SINCE_KEY) || String(Date.now()), 10);
  const custNo = hashStr(String(since)).toString(16).slice(0, 5).toUpperCase();
  const ach = achievementsHtml();
  const tile = (ic, val, label, small = '') =>
    `<div class="stat-tile">${icon(ic, 18)}<b>${val}</b><span>${label}</span>${small ? `<small>${small}</small>` : ''}</div>`;
  return `
  <div class="page">
    <div class="profile-card">
      <div class="p-avatar">${icon('memory-stick', 34)}</div>
      <div class="p-who">
        <h1>${t('profile.customer', { no: custNo })}</h1>
        <p>${t('profile.member', { date: new Date(since).toLocaleDateString(curLocale(), { month: 'long', day: 'numeric', year: 'numeric' }), amount: fmtRP(xp) })}</p>
        <div class="p-chips">
          <span class="p-chip">${icon('sparkles', 12)} ${t('profile.level', { n: lvl })}</span>
          <span class="p-chip">${icon('trophy', 12)} ${t('profile.achChip', { n: ach.unlockedCount, total: ACHIEVEMENTS.length })}</span>
        </div>
      </div>
      <div class="p-lvl" style="--p:${Math.round(cur / need * 100)}"><b>${lvl}</b><span>${t('profile.levelWord')}</span></div>
    </div>
    <div class="p-xpbar" data-tip="${t('profile.xpTip', { cur: cur.toLocaleString(curLocale()), need: need.toLocaleString(curLocale()), next: lvl + 1 })}">
      <i style="width:${Math.round(cur / need * 100)}%"></i>
    </div>
    ${(() => {
      const { reached, next } = gbMilestone(L.gb);
      if (!reached && !next) return '';
      return `<div class="xp-ways" style="margin-bottom:16px">
        ${reached
          ? `<b>${t('profile.ms.own', { gb: L.gb.toLocaleString(curLocale()) })}</b> ${t('profile.ms.asMuch', { what: msTxt(reached) })}`
          : `<b>${t('profile.ms.own', { gb: L.gb.toLocaleString(curLocale()) })}.</b>`}
        ${next ? ' ' + t('profile.ms.next', { gb: next.gb.toLocaleString(curLocale()), what: msTxt(next) }) : ' ' + t('profile.ms.done')}
      </div>`;
    })()}
    <div class="stat-grid">
      ${tile('sparkles', fmtRP(rpBal) + ' RP', t('profile.tile.balance'))}
      ${tile('gauge', fmtRP(cps()) + '/s', t('profile.tile.production'), t('profile.tile.prodSmall', { n: +prodMult().toFixed(2) }))}
      ${tile('chart-line', fmtRP(L.st.xp) + ' RP', t('profile.tile.lifetime'))}
      ${tile('memory-stick', L.gb.toLocaleString(curLocale()) + ' GB', t('profile.tile.memory'), t('profile.tile.memorySmall', { n: L.kits }))}
      ${tile('receipt', fmtRP(L.spent) + ' RP', t('profile.tile.spent'), plural(L.orders, 'profile.tile.spentSmall', 'profile.tile.spentSmallPlural'))}
      ${tile('ticket', fmtRP(L.codeSaved) + ' RP', t('profile.tile.codes'))}
      ${tile('zap', L.boost.toLocaleString(curLocale()) + ' BP', t('profile.tile.boost'))}
      ${tile('gift', L.pulls.length, t('profile.tile.cases'), legend ? t('case.legendaryCount', { n: legend }) : t('profile.tile.casesNone'))}
      ${tile('rotate-ccw', (L.st.spins || 0).toLocaleString(curLocale()), t('profile.tile.spins'))}
      ${tile('heart', (L.st.swipes || 0).toLocaleString(curLocale()), t('profile.tile.swiped'))}
      ${tile('arrow-right-left', (L.st.trades || 0).toLocaleString(curLocale()), t('profile.tile.trades'), signedRp(L.st.tradeNet || 0))}
    </div>
    <div class="sec-head" style="padding-top:34px"><h2>${t('profile.ach.title')}</h2>
      <span class="count">${t('profile.ach.count', { n: ach.unlockedCount, total: ACHIEVEMENTS.length })}</span></div>
    <div class="ach-grid">${ach.html}</div>

    <div class="xp-ways" style="margin-top:30px">
      ${t('profile.how', { time: fmtDuration(deliveredAt()) })}
    </div>
    <div style="text-align:center;margin-top:26px">
      <button class="btn ghost danger" onclick="clearProgress(this)">${icon('trash-2', 14)} ${t('profile.clear')}</button>
      <p class="queue-note" style="margin-top:10px">${t('profile.clearNote')}</p>
    </div>
  </div>`;
}

function clearProgress(btn) {
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.innerHTML = `${icon('trash-2', 14)} ${t('profile.clearConfirm')}`;
    setTimeout(() => {
      if (!btn.isConnected) return;
      delete btn.dataset.armed;
      btn.innerHTML = `${icon('trash-2', 14)} ${t('profile.clear')}`;
    }, 4000);
    return;
  }
  [ORDERS_KEY, GACHA_KEY, STATS_KEY, 'rambuy.streak', WHEEL_KEY, PROMO_KEY, SEEN_KEY, CODES_KEY, REVEAL_KEY, DISCOVER_KEY, CASE_KEY, CHEAT_KEY, BP_KEY, IBOK_KEY, ACH_KEY, MARKET_KEY, BAG_KEY, 'rambuy.queue', AUTOPROMO_KEY, 'rambuy.lvlseen', 'rambuy.allkits', 'rambuy.msseen'].forEach(k => localStorage.removeItem(k));
  dbg('reset', {});
  rpBal = 128;
  saveRp();
  updateXpChip();
  updateBagBadge();
  toast(t('profile.clearedToast'), 'rotate-ccw');
  renderRoute();
}

/* ---------- mystery kit (gacha) ---------- */
const GACHA_KEY = 'rambuy.gacha';
const loadGacha = () => JSON.parse(localStorage.getItem(GACHA_KEY) || '[]');

function gachaRarity(p) {
  return p.price > 600 ? 'legendary' : p.price >= 300 ? 'rare' : 'common';
}

function mysteryView() {
  const pulls = loadGacha();
  const legend = pulls.filter(x => x.rarity === 'legendary').length;
  const coll = pulls.length ? `
    <div class="collection">
      <h3>${plural(pulls.length, 'case.collection', 'case.collectionPlural')}${legend ? ` · ${t('case.legendaryCount', { n: legend })}` : ''}</h3>
      <div class="coll-grid">
        ${pulls.map(x => {
          const p = product(x.id);
          return `<a class="coll-item ${x.rarity}" href="#/product/${p.id}"><img src="${p.img}" alt="${p.name}"><small>${p.name}</small></a>`;
        }).join('')}
      </div>
    </div>` : '';

  return `
  <div class="page"><div class="mystery-page" style="max-width:none">
    <h1>${t('case.title')}</h1>
    <p class="m-sub">${t('case.sub')}</p>
    <div id="pack-zone">
      <div class="case-tiers">
        ${Object.keys(CASE_TYPES).map(k => {
          const wait = caseReadyIn(k);
          return `
        <div class="case-tier ct-${k}">
          <div class="ct-hero">
            <img class="ct-img" src="assets/case-${k}.jpg" alt="" loading="lazy">
            <h3>${t('case.' + k + '.name')}</h3>
          </div>
          <div class="ct-body">
            <div class="ct-drops"><div class="ct-rows" data-drops="${k}">${caseDropsHtml(k)}</div></div>
            <button class="btn" data-case="${k}" onclick="openCase('${k}')" ${wait > 0 || caseCost(k) === null ? 'disabled' : ''}>
              ${caseCost(k) === null ? `${icon('lock', 13)} ${t('case.locked', { n: caseRevealNeed(k) })}` : wait > 0 ? t('case.next', { s: Math.ceil(wait / 1000) }) : t('case.open', { amount: fmtRP(caseCost(k)) })}
            </button>
          </div>
        </div>`; }).join('')}
      </div>
      <div id="case-stage"></div>
    </div>
    ${coll}
  </div></div>`;
}

const CASE_KEY = 'rambuy.case';
const caseReadyIn = (type = 'standard') => {
  const st = JSON.parse(localStorage.getItem(CASE_KEY) || '{}');
  return Math.max(0, (st[type] || st.ts || 0) + CASE_TYPES[type].cooldown - Date.now());
};

const REEL_WIN_IDX = 46;

// Trzy poziomy ryzyka. Cena = sekundy produkcji (zawsze osiagalna po chwili gry).
// Nagroda-kit dobierany wzgledem CENY skrzynki (kotwica: najdrozszy tier <= cena),
// wiec placisz X i dostajesz kit warty ulamkiem albo wielokrotnoscia X.
// EV ~= cena (safe lekko na plus, black ~1.0 przy 75% szansie straty i jackpocie x8).
const CASE_TYPES = {
  // Wszystkie skrzynki: rowno 8 mozliwych dropow. EV 110% / 125% / 150%,
  // szansa zysku ~42% / ~36% / ~26% - stale, bo cena = cena kitu-kotwicy.
  // Okno przycinane do odkrytych kitow (zero '???' na liscie); pelne okno
  // wymaga odkrycia floorTier+maxOff+1 kitow - inaczej skrzynka zablokowana.
  standard: { secs: 60,  floorTier: 3, cooldown: 120000, odds: [[-3, .09], [-2, .2], [-1, .29], [0, .207], [1, .15], [2, .04], [3, .017], [4, .006]] },
  premium:  { secs: 300, floorTier: 3, cooldown: 300000, odds: [[-3, .16], [-2, .245], [-1, .238], [0, .10], [1, .15], [2, .075], [3, .02], [4, .012]] },
  black:    { secs: 900, floorTier: 4, cooldown: 600000, odds: [[-4, .323], [-3, .23], [-2, .14], [-1, .05], [1, .10], [2, .08], [3, .045], [4, .032]] },
};
const caseMaxOff = type => Math.max(...CASE_TYPES[type].odds.map(([o]) => o));
const highestRevealedTier = () => {
  let hi = -1;
  RP_LADDER.forEach((p, i) => { if (isRevealed(p)) hi = i; });
  return hi;
};
// Zwraca tier kotwicy albo -1, gdy gracz nie odkryl jeszcze pelnego okna.
function caseAnchor(type) {
  const c = CASE_TYPES[type];
  const target = Math.max(RP_LADDER[c.floorTier].rpCost, cps() * c.secs);
  let t = c.floorTier, best = Infinity;
  RP_LADDER.forEach((p, i) => {
    const d = Math.abs(Math.log(p.rpCost / target));
    if (d < best) { best = d; t = i; }
  });
  t = Math.max(c.floorTier, t);
  // Okno nie moze wystawac ponad front odkryc - skrzynka nigdy nie zawiera '???'.
  t = Math.min(t, highestRevealedTier() - caseMaxOff(type));
  return t < c.floorTier ? -1 : t;
}
// Ile kitow drabinki trzeba miec odkrytych, by otworzyc skrzynke danego typu.
const caseRevealNeed = type => CASE_TYPES[type].floorTier + caseMaxOff(type) + 1;
function caseCost(type = 'standard') {
  const a = caseAnchor(type);
  return a < 0 ? null : RP_LADDER[a].rpCost;
}
// Lista mozliwych dropow (po klampowaniu ofsety moga sie scalac - sumujemy szanse).
function caseOutcomes(type) {
  const anchor = caseAnchor(type);
  if (anchor < 0) return [];
  const byIdx = new Map();
  for (const [off, prob] of CASE_TYPES[type].odds) {
    const idx = Math.max(0, Math.min(RP_LADDER.length - 1, anchor + off));
    byIdx.set(idx, (byIdx.get(idx) || 0) + prob);
  }
  return [...byIdx.entries()].sort((a, b) => a[0] - b[0])
    .map(([idx, prob]) => ({
      p: RP_LADDER[idx],
      prob,
      pct: prob < 0.01 ? (prob * 100).toFixed(1) : Math.round(prob * 100),
    }));
}

function pickCaseKit(type = 'standard') {
  const anchor = caseAnchor(type);
  const odds = CASE_TYPES[type].odds;
  let roll = Math.random(), off = odds[odds.length - 1][0];
  for (const [o, p] of odds) { if (roll < p) { off = o; break; } roll -= p; }
  const idx = Math.max(0, Math.min(RP_LADDER.length - 1, anchor + off));
  const rar = off >= 2 ? 'legendary' : off >= 1 ? 'rare' : 'common';
  return { p: RP_LADDER[idx], rar };
}

function openCase(type = 'standard') {
  const zone = document.getElementById('case-stage');
  if (!zone || zone.querySelector(`.case-run[data-type="${type}"][data-spinning]`)) return;
  if (caseReadyIn(type) > 0) return;
  const cost = caseCost(type);
  if (cost === null) { toast(t('case.locked', { n: caseRevealNeed(type) }), 'lock'); return; }
  if (rpBal < cost) { toast(t('toast.needMore', { amount: fmtRP(cost - rpBal) }), 'x'); return; }
  spendRp(cost);
  const cd = JSON.parse(localStorage.getItem(CASE_KEY) || '{}');
  cd[type] = Date.now();
  delete cd.ts;
  localStorage.setItem(CASE_KEY, JSON.stringify(cd));
  const pick = pickCaseKit(type);
  const winner = pick.p;
  const winRarity = pick.rar;
  dbg('case', { type, drop: winner.id, rar: winRarity, cost });

  // 54 filler tiles with case odds, the winner planted at REEL_WIN_IDX.
  const tiles = Array.from({ length: 54 }, (_, i) => i === REEL_WIN_IDX ? winner : pickCaseKit(type).p);
  // Kazdy typ skrzynki ma wlasny slot - rownolegle tasmy nie przeszkadzaja sobie.
  zone.querySelector(`.case-run[data-type="${type}"]`)?.remove();
  zone.insertAdjacentHTML('beforeend', `
    <div class="case-run" data-type="${type}" data-spinning="1">
      <div class="reel-wrap">
        <div class="reel-needle"></div>
        <div class="reel-fade-l"></div><div class="reel-fade-r"></div>
        <div class="reel" id="case-reel-${type}">
          ${tiles.map(p => `<div class="reel-tile ${gachaRarity(p)}"><img src="${p.img}" alt=""><small>${p.name}</small></div>`).join('')}
        </div>
      </div>
    </div>`);
  const run = zone.querySelector(`.case-run[data-type="${type}"]`);
  const reel = document.getElementById(`case-reel-${type}`);
  const wrapW = reel.parentElement.clientWidth;
  // Krok mierzony z DOM: responsywny CSS moze zmienic szerokosc kafelka,
  // a sztywna stala rozjezdzala taśmę z iglą (pusta taśma na mobile).
  const tileW = reel.firstElementChild.getBoundingClientRect().width || 152;
  const step = tileW + (parseFloat(getComputedStyle(reel).columnGap) || 12);
  const jitter = (Math.random() - 0.5) * Math.min(70, tileW * 0.45);
  const target = REEL_WIN_IDX * step + tileW / 2 - wrapW / 2 + jitter;
  const DUR = 5800;

  run.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    reel.style.transition = `transform ${DUR}ms cubic-bezier(.08,.6,.1,1)`;
    reel.style.transform = `translateX(${-target}px)`;
  }));
  // Tick as tiles cross the needle - dense early, sparse at the end.
  const passes = Math.round(target / step);
  for (let k = 1; k <= passes; k++) {
    const t = DUR * (1 - Math.pow(1 - k / passes, 1 / 3));
    setTimeout(() => sndTick(200), t);
  }

  setTimeout(() => {
    const pulls = loadGacha();
    pulls.unshift({ id: winner.id, rarity: winRarity, ts: Date.now() });
    localStorage.setItem(GACHA_KEY, JSON.stringify(pulls));
    addXp(winRarity === 'legendary' ? 100 : 25, t('case.openedXp'));
    if (winRarity === 'legendary') { confetti(); sndSuccess(); } else sndPop();
    run.remove();
    // Wygrana pokazuje sie na chwile nad lista dropow tej skrzynki, potem znika.
    const drops = document.querySelector(`[data-drops="${type}"]`)?.closest('.ct-drops');
    if (drops) {
      drops.querySelector('.ct-win')?.remove();
      drops.insertAdjacentHTML('beforeend', `
        <div class="ct-win ${winRarity}">
          <span class="rarity ${winRarity}">${t('rarity.' + winRarity)}</span>
          <img src="${winner.img}" alt="${winner.name}">
          <h4>${winner.name}</h4>
          <div class="sub">${t('case.pullSub', { sub: winner.sub, prod: fmtRP(winner.rpProd) })}</div>
        </div>`);
      const w = drops.querySelector('.ct-win');
      setTimeout(() => { w.classList.add('out'); setTimeout(() => w.remove(), 450); }, 4000);
    }
  }, DUR + 250);
}

/* ---------- discover (swipe deck) ---------- */
let deckOrder = [], deckIdx = 0;

const DISCOVER_KEY = 'rambuy.discover';
const DISCOVER_MAX = 10;
const DISCOVER_REGEN_MS = 180000; // 1 swipe / 3 min - zysk pozostaje kosmetyczny (~+3% produkcji)
function discoverState() {
  const st = JSON.parse(localStorage.getItem(DISCOVER_KEY) || '{}');
  // Ladunki: pula DISCOVER_MAX, regeneracja co DISCOVER_REGEN_MS. Stare formaty
  // stanu (dzienny/lifetime) migruja do pelnej puli.
  if (typeof st.charges !== 'number') return { charges: DISCOVER_MAX, ts: Date.now() };
  const regen = Math.floor((Date.now() - st.ts) / DISCOVER_REGEN_MS);
  if (regen > 0) {
    st.charges = Math.min(DISCOVER_MAX, st.charges + regen);
    st.ts = st.charges >= DISCOVER_MAX ? Date.now() : st.ts + regen * DISCOVER_REGEN_MS;
  }
  return st;
}
const discoverNextIn = () => {
  const st = discoverState();
  return st.charges >= DISCOVER_MAX ? 0 : Math.max(0, st.ts + DISCOVER_REGEN_MS - Date.now());
};
function discoverReward() { return Math.max(5, Math.round(cps() * 5)); }

// Widok Odkrywaj na zywo: bez tego licznik ladunkow i ekran "wroc za X min"
// aktualizowaly sie dopiero po ponownym wejsciu, mimo ze regeneracja szla.
function tickDiscover() {
  const st = discoverState();
  const empty = document.querySelector('.discover-page') === null;
  if (empty) {
    if (st.charges > 0) { renderRoute(); return; }
    const p = document.querySelector('.empty-state p');
    if (p) p.textContent = t('disc.done.sub', { m: Math.ceil(discoverNextIn() / 60000) });
    return;
  }
  const leftEl = document.getElementById('disc-left');
  if (leftEl && String(st.charges) !== leftEl.textContent) leftEl.textContent = st.charges;
}

function discoverView() {
  const left0 = discoverState().charges;
  if (left0 === 0) {
    return `
    <div class="page"><div class="empty-state">
      ${icon('thumbs-up', 44)}
      <h3>${t('disc.done.title')}</h3>
      <p>${t('disc.done.sub', { m: Math.ceil(discoverNextIn() / 60000) })}</p>
      <a class="btn" href="#/">${t('disc.done.cta')}</a>
    </div></div>`;
  }
  deckOrder = RP_LADDER.filter(isRevealed).sort(() => Math.random() - 0.5);
  deckIdx = 0;
  const left = left0;
  return `
  <div class="page"><div class="discover-page">
    <h1>${t('disc.title')}</h1>
    <p class="m-sub" id="disc-sub">${t('disc.sub')} ${left
      ? t('disc.pays', { amount: fmtRP(discoverReward()), n: left })
      : t('disc.spent')}</p>
    <div class="deck" id="deck"></div>
    <div class="deck-btns">
      <button class="deck-btn no" onclick="swipeTop(-1)" aria-label="${t('disc.thumbsDown')}">${icon('thumbs-down', 24)}</button>
      <button class="deck-btn yes" onclick="swipeTop(1)" aria-label="${t('disc.thumbsUp')}">${icon('thumbs-up', 24)}</button>
    </div>
  </div></div>`;
}

function renderDeck() {
  const deck = document.getElementById('deck');
  if (!deck) return;
  if (deckIdx >= deckOrder.length) {
    deck.innerHTML = `<div class="deck-empty">${t('disc.seenAll', { n: deckOrder.length })}<br><br>
      <button class="btn" onclick="renderRoute()">${icon('rotate-ccw', 14)} ${t('disc.restart')}</button></div>`;
    hydrateIcons();
    return;
  }
  const html = [deckIdx + 1, deckIdx].filter(i => i < deckOrder.length + 1 && deckOrder[i]).reverse();
  deck.innerHTML = [deckIdx + 1, deckIdx]
    .filter(i => deckOrder[i])
    .map(i => {
      const p = deckOrder[i];
      const top = i === deckIdx;
      return `
      <div class="swipe-card ${top ? 'top' : 'under'}" data-idx="${i}" ${top ? 'id="top-card"' : ''}>
        <span class="stamp yes">${t('disc.like')}</span>
        <span class="stamp no">${t('disc.nope')}</span>
        <img src="${p.img}" alt="${p.name}" draggable="false">
        <h4>${p.name}</h4>
        <div class="sub">${p.sub}</div>
        <div class="price">${fmtRP(rpUnitCost(p))} RP</div>
        <div class="prod-line">+${fmtRP(p.rpProd)} RP/s</div>
      </div>`;
    })
    .reverse().join('');
  bindSwipe();
}

function bindSwipe() {
  const card = document.getElementById('top-card');
  if (!card) return;
  let sx = 0, sy = 0, dx = 0, dragging = false;
  card.addEventListener('pointerdown', e => {
    dragging = true; sx = e.clientX; sy = e.clientY;
    card.classList.remove('spring');
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    card.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx * 0.06}deg)`;
    card.querySelector('.stamp.yes').style.opacity = Math.max(0, Math.min(1, dx / 90));
    card.querySelector('.stamp.no').style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (dx > 110) swipeTop(1, true);
    else if (dx < -110) swipeTop(-1, true);
    else { card.classList.add('spring'); card.style.transform = ''; card.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0); }
    dx = 0;
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

function swipeTop(dir, fromDrag = false) {
  const card = document.getElementById('top-card');
  const p = deckOrder[deckIdx];
  if (!card || !p) return;
  card.classList.add('flying');
  card.style.transform = `translate(${dir * 560}px, -40px) rotate(${dir * 24}deg)`;
  sndTick(dir > 0 ? 300 : 0);

  // Every swipe gives visible feedback: blue "+X RP" while the daily pool
  // lasts, a grey "daily cap" note after it runs out.
  const discFloat = (text, capped) => {
    const deck = document.getElementById('deck');
    if (!deck) return;
    const r = deck.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'bo-float disc-float' + (capped ? ' capped' : '');
    f.textContent = text;
    f.style.position = 'fixed';
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top + 24) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 900);
  };
  const st = discoverState();
  if (st.charges <= 0) return;
  {
    const gain = discoverReward();
    if (st.charges >= DISCOVER_MAX) st.ts = Date.now();
    st.charges -= 1;
    localStorage.setItem(DISCOVER_KEY, JSON.stringify(st));
    addXp(gain, null, { swipes: 1 });
    discFloat('+' + fmtRP(gain) + ' RP', false);
    const leftEl = document.getElementById('disc-left');
    if (leftEl && st.charges > 0) leftEl.textContent = st.charges;
  }
  const capped = discoverState().charges <= 0;
  deckIdx++;
  if (capped) { setTimeout(renderRoute, 700); return; }
  setTimeout(renderDeck, fromDrag ? 240 : 300);
}

/* ---------- spin (wheel, 60s cooldown, pays production time) ---------- */
const WHEEL_KEY = 'rambuy.wheel';
const SPIN_COOLDOWN = 60000;
// Segments pay N seconds of your production (with an early-game floor).
// EV ~43s of production per spin at a 120s cooldown => a solid but not
// dominant ~35% bonus for players who keep coming back.
const WHEEL_SEGS = [
  { sec: 15,  w: 16, c: '#2c8ef8' },
  { sec: 60,  w: 9,  c: '#12245e' },
  { sec: 20,  w: 15, c: '#0071e3' },
  { sec: 300, w: 3,  c: 'url(#goldGrad)', gold: true },
  { sec: 30,  w: 16, c: '#2c8ef8' },
  { sec: 90,  w: 7,  c: '#12245e' },
  { sec: 25,  w: 14, c: '#0071e3' },
  { sec: 45,  w: 12, c: '#0b3d78' },
];
const spinWin = sec => Math.max(Math.round(sec / 3), Math.round(cps() * sec));
const spinReadyIn = () => {
  const st = JSON.parse(localStorage.getItem(WHEEL_KEY) || '{}');
  return Math.max(0, (st.ts || 0) + SPIN_COOLDOWN - Date.now());
};
const todayStr = () => new Date().toISOString().slice(0, 10);

function wheelSvg() {
  const cx = 160, cy = 160, r = 150;
  const seg = 360 / WHEEL_SEGS.length;
  let paths = '';
  WHEEL_SEGS.forEach((s, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const mid = (i + 0.5) * seg - 90;
    const lx = cx + r * 0.68 * Math.cos(mid * Math.PI / 180);
    const ly = cy + r * 0.68 * Math.sin(mid * Math.PI / 180);
    paths += `<path d="M${cx},${cy} L${(cx + r * Math.cos(a0)).toFixed(1)},${(cy + r * Math.sin(a0)).toFixed(1)} A${r},${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)},${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${s.c}" stroke="var(--bg)" stroke-width="2.5"/>
      <text class="wheel-seg-label ${s.gold ? 'gold' : ''}" data-sec="${s.sec}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(mid + 90).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${fmtRP(spinWin(s.sec))}</text>`;
  });
  return `<svg viewBox="0 0 320 320" id="wheel-svg">
    <defs><linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd700"/><stop offset="1" stop-color="#e8590c"/>
    </linearGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="var(--card)"/>
    ${paths}
  </svg>`;
}

function wheelPickIdx() {
  const total = WHEEL_SEGS.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < WHEEL_SEGS.length; i++) {
    roll -= WHEEL_SEGS[i].w;
    if (roll <= 0) return i;
  }
  return 0;
}

function spinView() {
  const wait = spinReadyIn();
  return `
  <div class="page"><div class="spin-page">
    <h1>${t('spin.title')}</h1>
    <p class="m-sub">${t('spin.sub')}</p>
    <div class="wheel-wrap ${wait > 0 ? '' : 'wheel-ready'}" id="wheel-wrap" onclick="spinWheel()">
      <div class="wheel-pointer"></div>
      ${wheelSvg()}
      <button class="wheel-hub" id="spin-btn" ${wait > 0 ? 'disabled' : ''}>
        ${wait > 0 ? t('spin.hubWait', { s: Math.ceil(wait / 1000) }) : t('spin.cta')}
      </button>
    </div>
    <p class="spin-result" id="spin-result">&nbsp;</p>
  </div></div>`;
}

function tickNavBadges() {
  const lvl = xpInfo().lvl;
  [['spin', '#nav-spin'], ['market', '#nav-market'], ['discover', '#nav-discover'], ['mystery', '#nav-mystery']].forEach(([k, sel]) => {
    const a = document.querySelector(sel);
    if (a) {
      const locked = !featureUnlocked(k);
      a.classList.toggle('nav-gated', locked);
      if (locked) a.dataset.tip = t('nav.unlocksAt', { lvl: FEATURE_LVL[k], cur: xpInfo().lvl });
      else delete a.dataset.tip;
      const li = a.querySelector('.nav-lock');
      if (li) {
        if (!li.innerHTML) li.innerHTML = icon('lock', 10);
        li.hidden = !locked;
      }
    }
  });
  const spinDot = document.querySelector('#nav-spin .nav-dot');
  if (spinDot) spinDot.hidden = !featureUnlocked('spin') || spinReadyIn() > 0;
  const discDot = document.querySelector('#nav-discover .nav-dot');
  if (discDot) discDot.hidden = !featureUnlocked('discover') || discoverState().charges <= 0;
  const caseDot = document.querySelector('#nav-mystery .nav-dot');
  if (caseDot) caseDot.hidden = !featureUnlocked('mystery') || !(caseReadyIn('standard') === 0 && caseCost('standard') !== null && rpBal >= caseCost('standard'));
  const mkDot = document.querySelector('#nav-market .nav-dot');
  if (mkDot) mkDot.hidden = !featureUnlocked('market') || !loadMarket().pos;

  const seen = parseInt(localStorage.getItem('rambuy.lvlseen') || '1', 10);
  if (lvl > seen) {
    localStorage.setItem('rambuy.lvlseen', String(lvl));
    const crossed = Object.entries(FEATURE_LVL)
      .filter(([, need]) => need > seen && need <= lvl)
      .map(([k]) => k);
    if (crossed.length) {
      const showing = !!document.querySelector('.unlock-modal');
      unlockQueue.push(...crossed);
      if (!showing) showUnlockModal(unlockQueue.shift());
    }
  }
}

function caseStatsHtml(type) {
  const cost = caseCost(type);
  if (cost === null) return '';
  let ev = 0, win = 0;
  for (const o of caseOutcomes(type)) {
    ev += o.prob * (o.p.rpCost / cost);
    if (o.p.rpCost >= cost) win += o.prob;
  }
  return `<div class="ct-stats">${t('case.stats', { ev: Math.round(ev * 100), win: Math.round(win * 100) })}</div>`;
}

function caseDropsHtml(type) {
  return caseOutcomes(type).map(o => {
    const rev = isRevealed(o.p);
    return `<div class="ct-drop">
      <img src="${rev ? o.p.img : 'assets/ram-mystery.webp'}" alt="">
      <span>${rev ? o.p.name : t('ladder.locked.name')}</span>
      <b>${o.pct}%</b>
    </div>`;
  }).join('') + caseStatsHtml(type);
}

function tickCaseBtn() {
  document.querySelectorAll('[data-drops]').forEach(el => {
    const html = caseDropsHtml(el.dataset.drops);
    if (el.innerHTML !== html) el.innerHTML = html;
  });
  document.querySelectorAll('[data-case]').forEach(btn => {
    const k = btn.dataset.case;
    const wait = caseReadyIn(k);
    const cost = caseCost(k);
    if (cost === null) { btn.disabled = true; btn.innerHTML = `${icon('lock', 13)} ${t('case.locked', { n: caseRevealNeed(k) })}`; }
    else if (wait > 0) { btn.disabled = true; btn.textContent = t('case.next', { s: Math.ceil(wait / 1000) }); }
    else { btn.disabled = rpBal < cost; btn.textContent = t('case.open', { amount: fmtRP(cost) }); }
  });
}

function tickSpinBtn() {
  document.querySelectorAll('#wheel-svg [data-sec]').forEach(t => {
    t.textContent = fmtRP(spinWin(+t.dataset.sec));
  });
  const btn = document.getElementById('spin-btn');
  if (!btn || btn.dataset.spinning) return;
  const wait = spinReadyIn();
  if (wait > 0) { btn.disabled = true; btn.textContent = t('spin.hubWait', { s: Math.ceil(wait / 1000) }); }
  else { btn.disabled = false; btn.textContent = t('spin.cta'); }
  document.getElementById('wheel-wrap')?.classList.toggle('wheel-ready', !btn.disabled);
}

function spinWheel() {
  const btn = document.getElementById('spin-btn');
  const svg = document.getElementById('wheel-svg');
  if (!btn || btn.disabled || spinReadyIn() > 0) return;
  // Cooldown startuje od razu (nie po animacji) - kropka w menu znika natychmiast.
  localStorage.setItem(WHEEL_KEY, JSON.stringify({ ts: Date.now() }));
  tickNavBadges();
  btn.disabled = true;
  btn.dataset.spinning = '1';
  btn.textContent = '…';
  document.getElementById('wheel-wrap')?.classList.remove('wheel-ready');
  const i = wheelPickIdx();
  const seg = 360 / WHEEL_SEGS.length;
  // Land the middle of segment i under the top pointer, plus 5 full laps.
  const target = 5 * 360 + (360 - (i + 0.5) * seg) + (Math.random() - 0.5) * seg * 0.5;
  svg.style.transform = `rotate(${target}deg)`;
  sndPop();
  // Tick as each segment edge passes the pointer - dense early, sparse late,
  // matching the wheel's deceleration curve.
  const crossings = Math.floor(target / seg);
  for (let k = 1; k <= crossings; k++) {
    const t = 4600 * (1 - Math.pow(1 - k / crossings, 1 / 3));
    setTimeout(() => sndTick(150), t);
  }
  setTimeout(() => {
    const win = spinWin(WHEEL_SEGS[i].sec);
    if (WHEEL_SEGS[i].gold) confetti();
    sndSuccess();
    addXp(win, null, { spins: 1 });
    const res = document.getElementById('spin-result');
    if (res) res.innerHTML = WHEEL_SEGS[i].gold
      ? t('spin.gold', { amount: fmtRP(win) })
      : t('spin.win', { amount: fmtRP(win) });
    delete btn.dataset.spinning;
    tickSpinBtn();
  }, 4700);
}

/* ---------- RAM Exchange (market) ---------- */
const MARKET_KEY = 'rambuy.market';
const MK = { W: 560, H: 240, L: 52, R: 14, T: 14, B: 22, MAX: 120, TICK: 700 };
const loadMarket = () => Object.assign({ pos: null, log: [] }, JSON.parse(localStorage.getItem(MARKET_KEY) || '{}'));
const saveMarket = m => localStorage.setItem(MARKET_KEY, JSON.stringify(m));
const mkStep = () => Math.floor(Date.now() / MK.TICK);
const mkRnd = (tag, i) => mulberry32(hashStr('ramx.' + tag + '.' + i))();

// RAMX is a pure function of wall-clock time: it keeps moving while nobody
// is looking and history redraws identically after a reload.
// Kurs = fraktalny szum (suma oktaw seedowanego value noise w log-przestrzeni):
// wyglada jak random walk i NIE MA sredniej, do ktorej wraca w horyzoncie gry
// (najwieksza oktawa ~19 h; "kupie i poczekam na pewny zysk" przestaje byc pewne).
// Poprzedni model (suma sinusow wokol 100) byl mean-reverting - trzymanie pozycji
// do zysku nigdy nie przegrywalo. Do tego jitter i seedowane pumpy/rugi jak wczesniej.
function mkNoise(tag, x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return (mkRnd(tag, i) * (1 - u) + mkRnd(tag, i + 1) * u) * 2 - 1;
}
function mkPriceAt(s) {
  let v = 0;
  for (let k = 0, lam = 6, amp = 0.035; k < 12; k++, lam *= 2.4, amp *= 1.3) {
    v += mkNoise('oct' + k, s / lam) * amp;
  }
  v += (mkRnd('jit', s) - 0.5) * 0.05;
  const b = Math.floor(s / 40), r = mkRnd('evt', b);
  if (r < 0.10) {
    const mag = 0.18 + mkRnd('mag', b) * 0.3;
    v += (r < 0.05 ? -1 : 1) * mag * Math.sin(Math.PI * (s - b * 40) / 40);
  }
  return 100 * Math.exp(v);
}
const mkPrice = () => mkPriceAt(mkStep());
// Prowizja gieldy: 3% od sprzedazy - scalping na malych ruchach jest EV-ujemny.
const MK_FEE = 0.03;
const mkNetValue = (pos, price) => Math.floor(pos.stake * (price / pos.entry) * (1 - MK_FEE));

let mkPct = 25;
let mkHist = [];
let mkLastStep = 0, mkDrawnStep = -1;
let mkRange = null;
const mkStakeRp = () => Math.floor(rpBal * mkPct / 100);

function mkPanelHtml(m = loadMarket()) {
  if (m.pos) {
    return `
    <div class="mk-pos">
      <div class="mk-stat"><span>${t('market.entry')}</span><b>${m.pos.entry.toFixed(2)} RP</b></div>
      <div class="mk-stat"><span>${t('market.stake')}</span><b>${fmtRP(m.pos.stake)} RP</b></div>
      <div class="mk-stat"><span>${t('market.value')}</span><b id="mk-value"></b></div>
      <div class="mk-stat"><span>${t('market.pnl')}</span><b id="mk-pnl"></b></div>
    </div>
    <button class="btn big" id="mk-sell" onclick="mkSell()"></button>
    <p class="queue-note" style="margin-top:8px">${t('market.fee', { pct: MK_FEE * 100 })}</p>`;
  }
  return `
  <div class="mk-stakes">
    ${[10, 25, 50, 100].map(p => `<button class="mk-pct ${p === mkPct ? 'on' : ''}" onclick="mkSetPct(${p})">${p === 100 ? 'ALL-IN' : p + '%'}</button>`).join('')}
  </div>
  <button class="btn big" id="mk-buy" onclick="mkBuy()"></button>
  <p class="queue-note" style="margin-top:8px">${t('market.fee', { pct: MK_FEE * 100 })}</p>`;
}

function marketView() {
  const m = loadMarket();
  const logHtml = m.log.length
    ? m.log.map(tr => `
      <div class="mk-tr ${tr.pnl >= 0 ? 'up' : 'down'}">
        <span>x${tr.x.toFixed(2)}</span><b>${tr.pnl >= 0 ? '+' : '-'}${fmtRP(Math.abs(tr.pnl))} RP</b>
      </div>`).join('')
    : `<p class="queue-note">${t('market.noTrades')}</p>`;
  return `
  <div class="page"><div class="market-page">
    <h1>${t('market.title')}</h1>
    <p class="m-sub">${t('market.sub')}</p>
    <div class="mk-quote"><span class="mk-sym">RAMX</span><b id="mk-price"></b><span id="mk-chip"></span></div>
    <div class="pc-wrap mk-wrap">
      <svg viewBox="0 0 ${MK.W} ${MK.H}" id="mk-svg">
        <defs><clipPath id="mk-clip"><rect x="${MK.L}" y="0" width="${MK.W - MK.L - MK.R}" height="${MK.H}"/></clipPath></defs>
        <g id="mk-grid"></g>
        <g id="mk-plot" clip-path="url(#mk-clip)">
          <path class="price-area" id="mk-area" d=""/>
          <path class="price-line" id="mk-line" d=""/>
        </g>
        <line class="mk-entry" id="mk-entry" x1="${MK.L}" x2="${MK.W - MK.R}" y1="0" y2="0" style="display:none"/>
        <circle class="price-dot" id="mk-dot" r="4"/>
      </svg>
    </div>
    <div class="mk-panel" id="mk-panel">${mkPanelHtml(m)}</div>
    <div class="mk-log"><h3>${t('market.log')}</h3>${logHtml}</div>
  </div></div>`;
}

function mkTick() {
  const s = mkStep();
  if (s === mkLastStep && mkHist.length) return;
  const slide = mkHist.length > 0 && s - mkLastStep === 1;
  mkLastStep = s;
  mkHist = [];
  for (let i = s - MK.MAX + 1; i <= s; i++) mkHist.push(mkPriceAt(i));
  mkDraw(slide);
}

function bindMarket() {
  mkLastStep = 0;
  mkDrawnStep = -1;
  mkRange = null;
  mkHist = [];
  mkTick();
  viewTimers.push(setInterval(mkTick, MK.TICK));
}

// Sticky y-domain: rescale only when the price escapes it or uses less than
// 45% of it. Between rescales older points stay put, so the chart can scroll
// like a conveyor instead of morphing on every tick.
function mkUpdateRange(m) {
  const vals = m.pos ? mkHist.concat(m.pos.entry) : mkHist;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const r = mkRange;
  if (r && lo >= r.lo && hi <= r.hi && (hi - lo) >= (r.hi - r.lo) * 0.45) return false;
  const pad = (hi - lo) * 0.2 || 10;
  mkRange = { lo: lo - pad, hi: hi + pad };
  return true;
}

function mkDraw(slide = false) {
  const svg = document.getElementById('mk-svg');
  if (!svg || !mkHist.length) return;
  const m = loadMarket();
  const stepChanged = mkDrawnStep !== mkLastStep;
  const rescaled = (stepChanged || !mkRange) ? mkUpdateRange(m) : false;
  const { lo, hi } = mkRange;
  const sc = {
    min: lo, max: hi,
    x: i => MK.L + (MK.W - MK.L - MK.R) * i / (mkHist.length - 1),
    y: v => MK.T + (MK.H - MK.T - MK.B) * (1 - (v - lo) / (hi - lo)),
  };
  const line = chartLinePath(mkHist, sc);
  document.getElementById('mk-line').setAttribute('d', line);
  document.getElementById('mk-area').setAttribute('d', chartAreaPath(line, sc, mkHist.length, MK));
  const grid = document.getElementById('mk-grid');
  if (rescaled || !grid.innerHTML) grid.innerHTML = chartGridHtml(sc, MK, v => v.toFixed(0));
  const price = mkHist[mkHist.length - 1];
  const dot = document.getElementById('mk-dot');
  // Conveyor: repaint the new data shifted one step right (looks identical to
  // the previous frame), then ease the plot group back to 0 - old points only
  // slide left, they never morph. The dot rides the right edge vertically.
  if (stepChanged) {
    const plot = document.getElementById('mk-plot');
    plot.style.transition = dot.style.transition = 'none';
    plot.style.transform = 'translateX(0)';
    if (slide && !rescaled) {
      const dx = (MK.W - MK.L - MK.R) / (mkHist.length - 1);
      plot.style.transform = `translateX(${dx}px)`;
      void plot.getBoundingClientRect();
      plot.style.transition = 'transform .68s linear';
      dot.style.transition = 'cy .68s linear';
      plot.style.transform = 'translateX(0)';
    }
    mkDrawnStep = mkLastStep;
  }
  dot.setAttribute('cx', sc.x(mkHist.length - 1)); dot.setAttribute('cy', sc.y(price));
  document.getElementById('mk-price').textContent = price.toFixed(2) + ' RP';
  const base = mkHist[Math.max(0, mkHist.length - 31)];
  const ch = (price - base) / base;
  document.getElementById('mk-chip').outerHTML =
    `<span class="mk-chip ${ch < 0 ? 'down' : 'up'}" id="mk-chip">${t(ch < 0 ? 'market.down' : 'market.up', { pct: Math.abs(ch * 100).toFixed(1) })}</span>`;
  const entry = document.getElementById('mk-entry');
  if (m.pos) {
    entry.style.display = '';
    entry.setAttribute('y1', sc.y(m.pos.entry).toFixed(1));
    entry.setAttribute('y2', sc.y(m.pos.entry).toFixed(1));
    const val = mkNetValue(m.pos, price);
    const pnl = val - m.pos.stake;
    const vEl = document.getElementById('mk-value');
    if (vEl) vEl.textContent = fmtRP(val) + ' RP';
    const pEl = document.getElementById('mk-pnl');
    if (pEl) {
      pEl.textContent = `${pnl >= 0 ? '+' : '-'}${fmtRP(Math.abs(pnl))} RP (${(pnl / m.pos.stake * 100).toFixed(1)}%)`;
      pEl.className = pnl >= 0 ? 'up' : 'down';
    }
    const sb = document.getElementById('mk-sell');
    if (sb) sb.textContent = t('market.sell', { amount: fmtRP(val) });
  } else {
    entry.style.display = 'none';
    const bb = document.getElementById('mk-buy');
    if (bb) {
      const st = mkStakeRp();
      bb.textContent = t('market.buy', { amount: fmtRP(Math.max(0, st)) });
      bb.disabled = st < 10;
    }
  }
}

function mkSetPct(p) {
  mkPct = p;
  const panel = document.getElementById('mk-panel');
  if (panel) { panel.innerHTML = mkPanelHtml(); mkDraw(); }
}

function mkBuy() {
  const m = loadMarket();
  if (m.pos) return;
  const stake = mkStakeRp();
  if (stake < 10) { toast(t('market.minStake'), 'x'); return; }
  spendRp(stake);
  m.pos = { stake, entry: mkPrice(), ts: Date.now() };
  saveMarket(m);
  sndPop();
  const panel = document.getElementById('mk-panel');
  if (panel) { panel.innerHTML = mkPanelHtml(m); mkDraw(); }
  tickNavBadges();
}

// Profit is paid out through addXp (RP + XP), the stake itself just returns
// to the balance; a loss returns only the proceeds and earns nothing.
function mkSell() {
  const m = loadMarket();
  if (!m.pos) return;
  const price = mkPrice();
  const x = price / m.pos.entry;
  const proceeds = mkNetValue(m.pos, price);
  const profit = proceeds - m.pos.stake;
  if (profit > 0) { rpBal += m.pos.stake; saveRp(); addXp(profit); }
  else { rpBal += proceeds; saveRp(); updateXpChip(); }
  m.log.unshift({ x, pnl: profit });
  m.log = m.log.slice(0, 6);
  m.pos = null;
  saveMarket(m);
  const st = loadStats();
  st.trades = (st.trades || 0) + 1;
  st.tradeNet = (st.tradeNet || 0) + profit;
  st.bestTradeX = Math.max(st.bestTradeX || 0, x);
  saveStats(st);
  if (x >= 1.25) { confetti(); sndSuccess(); }
  else if (profit >= 0) sndSuccess();
  else sndLoss();
  toast(profit >= 0
    ? t('market.win', { amount: fmtRP(profit) })
    : t('market.loss', { amount: fmtRP(-profit) }), 'chart-line');
  keepScrollY = window.scrollY;
  renderRoute();
  checkAchievements();
}

function sndLoss() {
  note(220, 0, 0.12, 0.05);
  note(165, 0.12, 0.16, 0.05);
  note(110, 0.28, 0.3, 0.06);
}

/* ---------- scratch card (order page) ---------- */
const SCRATCH_W = 400, SCRATCH_H = 128;

function scratchHtml(order) {
  const pct = 10 + hashStr(order.id) % 16;
  const code = 'LUCKY' + pct;
  if (order.scratched) {
    return `
    <div class="scratch-card">
      <h3>${icon('ticket', 16)} ${t('scratch.title')}</h3>
      <p>${t('scratch.revealedWith', { id: order.id })}</p>
      <div class="scratch-under" style="position:static;width:${SCRATCH_W}px;max-width:100%;height:${SCRATCH_H}px;margin:0 auto"><b>${code}</b><small>${t('scratch.off', { pct })}</small></div>
      ${hasScratchedAny()
        ? `<label class="auto-promo"><input type="checkbox" ${autoPromoOn() ? 'checked' : ''} onchange="setAutoPromo(this.checked)"><span>${t('scratch.autoApply')}</span></label>`
        : `<label class="auto-promo locked" data-tip="${t('scratch.autoLockedTip')}"><input type="checkbox" checked disabled><span>${icon('lock', 12)} ${t('scratch.autoApply')}</span></label>`}
    </div>`;
  }
  return `
  <div class="scratch-card">
    <h3>${icon('ticket', 16)} ${t('scratch.title')}</h3>
    <p>${t('scratch.sub')}</p>
    <div class="scratch-wrap">
      <div class="scratch-under"><b>${code}</b><small>${t('scratch.off', { pct })}</small></div>
      <canvas id="scratch-cv" width="${SCRATCH_W}" height="${SCRATCH_H}"></canvas>
    </div>
    ${hasScratchedAny()
        ? `<label class="auto-promo"><input type="checkbox" ${autoPromoOn() ? 'checked' : ''} onchange="setAutoPromo(this.checked)"><span>${t('scratch.autoApply')}</span></label>`
        : `<label class="auto-promo locked" data-tip="${t('scratch.autoLockedTip')}"><input type="checkbox" checked disabled><span>${icon('lock', 12)} ${t('scratch.autoApply')}</span></label>`}
  </div>`;
}

function bindScratch(order) {
  const cv = document.getElementById('scratch-cv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, SCRATCH_W, SCRATCH_H);
  g.addColorStop(0, '#b8bcc4'); g.addColorStop(0.5, '#d9dce2'); g.addColorStop(1, '#a9adb6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCRATCH_W, SCRATCH_H);
  ctx.fillStyle = '#8e939c';
  ctx.font = '600 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('scratch.hint'), SCRATCH_W / 2, SCRATCH_H / 2);

  let scratching = false, cleared = false;
  const scratch = e => {
    if (!scratching || cleared) return;
    const r = cv.getBoundingClientRect();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc((e.clientX - r.left) * (SCRATCH_W / r.width), (e.clientY - r.top) * (SCRATCH_H / r.height), 22, 0, Math.PI * 2);
    ctx.fill();
  };
  const checkDone = () => {
    if (cleared) return;
    // Liczy sie tylko srodkowe 60% szerokosci (tam jest kod) - boczne
    // marginesy po 20% nie wliczaja sie do progu zdrapania.
    const x0 = Math.round(SCRATCH_W * 0.2);
    const zoneW = Math.round(SCRATCH_W * 0.6);
    const data = ctx.getImageData(x0, 0, zoneW, SCRATCH_H).data;
    let clearPx = 0;
    for (let i = 3; i < data.length; i += 16) { if (data[i] === 0) clearPx++; }
    if (clearPx / (data.length / 16) > 0.45) {
      cleared = true;
      cv.style.transition = 'opacity .4s';
      cv.style.opacity = 0;
      order.scratched = true;
      if (trackedOrder && trackedOrder.id === order.id) trackedOrder.scratched = true;
      persistOrder(order);
      grantCode('LUCKY' + (10 + hashStr(order.id) % 16));
      dbg('scratch', { code: 'LUCKY' + (10 + hashStr(order.id) % 16) });
      const ap = document.querySelector('.auto-promo.locked');
      if (ap) {
        ap.classList.remove('locked');
        ap.removeAttribute('data-tip');
        const inp = ap.querySelector('input');
        inp.disabled = false;
        inp.onchange = function () { setAutoPromo(this.checked); };
        ap.querySelector('span').textContent = t('scratch.autoApply');
      }
      sndSuccess();
      addXp(Math.max(30, Math.round(cps() * 15)), t('scratch.revealed'));
    }
  };
  cv.addEventListener('pointerdown', e => { scratching = true; cv.setPointerCapture(e.pointerId); scratch(e); });
  cv.addEventListener('pointermove', scratch);
  cv.addEventListener('pointerup', () => { scratching = false; checkDone(); });
}

/* ---------- achievements ---------- */
const ACH_KEY = 'rambuy.ach';
const SINCE_KEY = 'rambuy.since';
const tierName = i => i ? t('tier.' + ['', 'bronze', 'silver', 'gold'][i]) : '';
const achName = a => t('ach.' + a.id + '.name');
const achDesc = a => t('ach.' + a.id + '.desc');

// tiers: [bronze, silver, gold] thresholds; single achievements use tiers: [1].
// Names and descriptions live in lang/<code>.json under ach.<id>.name / .desc.
const ACHIEVEMENTS = [
  { id: 'firstorder', icon: 'shopping-bag', tiers: [1], value: () => loadOrders().length },
  { id: 'delivered', icon: 'house', tiers: [10, 50, 250], value: () => loadOrders().filter(isDelivered).length },
  { id: 'collector', icon: 'memory-stick', tiers: [5, 20, 40], value: () => Object.keys(ownedCounts(true)).length },
  { id: 'complete', icon: 'trophy', tiers: [RP_LADDER.length], value: () => Object.keys(ownedCounts(true)).length },
  { id: 'hoarder', icon: 'boxes', tiers: [25, 100, 500], value: () => Object.values(ownedCounts(true)).reduce((a, b) => a + b, 0) },
  { id: 'baron', icon: 'gauge', tiers: [1000, 100000, 10000000], value: () => gbOwned() },
  { id: 'earner', icon: 'chart-line', tiers: [1e6, 1e9, 1e12], value: () => loadStats().xp },
  { id: 'level', icon: 'sparkles', tiers: [10, 25, 40], value: () => xpInfo().lvl },
  { id: 'clicker', icon: 'mouse-pointer-click', tiers: [500, 5000, 50000], value: () => loadStats().clicks || 0 },
  { id: 'booster', icon: 'zap', tiers: [1000, 25000, 500000], value: () => loadStats().bp || 0 },
  { id: 'cases', icon: 'gift', tiers: [5, 25, 100], value: () => loadGacha().length },
  { id: 'legendary', icon: 'flame', tiers: [1, 5, 20], value: () => loadGacha().filter(x => x.rarity === 'legendary').length },
  { id: 'gambler', icon: 'rotate-ccw', tiers: [10, 100, 1000], value: () => loadStats().spins || 0 },
  { id: 'trader', icon: 'arrow-right-left', tiers: [10, 100, 1000], value: () => loadStats().trades || 0 },
  { id: 'moonshot', icon: 'chart-line', tiers: [1], value: () => (loadStats().bestTradeX || 0) >= 1.5 ? 1 : 0 },
  { id: 'scout', icon: 'heart', tiers: [50, 500, 5000], value: () => loadStats().swipes || 0 },
  { id: 'golden', icon: 'gift', tiers: [1, 10, 50], value: () => loadStats().golden || 0 },
  { id: 'critic', icon: 'star', tiers: [1, 5, 20], value: () => Object.values(loadReviews()).reduce((a, l) => a + l.length, 0) },
  { id: 'night', icon: 'moon', tiers: [1], value: () => loadStats().nightOrders || 0 },
  { id: 'discovered', icon: 'search', tiers: [20, 40, RP_LADDER.length], value: () => RP_LADDER.filter(isRevealed).length },
  { id: 'spender', icon: 'receipt', tiers: [1e5, 1e8, 1e11], value: () => loadOrders().reduce((s, o) => s + o.total, 0) },
];

const loadAch = () => JSON.parse(localStorage.getItem(ACH_KEY) || '{}');

function achTier(a, v) {
  let t = 0;
  a.tiers.forEach((th, i) => { if (v >= th) t = i + 1; });
  return t;
}

function checkAchievements(silent = false) {
  const state = loadAch();
  let changed = false;
  ACHIEVEMENTS.forEach(a => {
    const tier = achTier(a, a.value());
    if (tier > (state[a.id] || 0)) {
      state[a.id] = tier;
      changed = true;
      if (!silent) {
        sndPop();
        toast(t('ach.toast', { name: achName(a) }) + (a.tiers.length > 1 ? ' - ' + tierName(tier) : ''), 'trophy');
      }
    }
  });
  if (changed) localStorage.setItem(ACH_KEY, JSON.stringify(state));
}

function achievementsHtml() {
  const state = loadAch();
  let unlockedCount = 0;
  const cards = ACHIEVEMENTS.map(a => {
    const v = a.value();
    const tier = Math.max(achTier(a, v), state[a.id] || 0);
    if (tier > 0) unlockedCount++;
    const tiered = a.tiers.length > 1;
    const next = tier < a.tiers.length ? a.tiers[tier] : null;
    const prog = next !== null
      ? `${fmtRP(Math.min(v, next))} / ${fmtRP(next)}`
      : (tiered ? t('ach.maxed') : t('ach.done'));
    const tierCls = tier === 0 ? 'locked' : (tiered ? ['', 'bronze', 'silver', 'gold'][tier] : 'gold');
    return `
    <div class="ach ${tier === 0 ? 'is-locked' : ''}">
      <div class="ach-ico ${tierCls}">${icon(a.icon, 18)}</div>
      <div class="ach-body">
        <b>${achName(a)}${tiered && tier > 0 ? ` <span class="ach-tier ${tierCls}">${tierName(tier)}</span>` : ''}</b>
        <small>${achDesc(a)}</small>
        <div class="ach-prog"><i style="width:${next !== null ? Math.min(100, v / next * 100) : 100}%"></i></div>
        <span class="ach-count">${prog}</span>
      </div>
    </div>`;
  }).join('');
  return { html: cards, unlockedCount };
}

/* ---------- feature level gates ---------- */
const FEATURE_LVL = { spin: 5, discover: 10, mystery: 15, market: 20, herobuy: 25 };
const FEATURE_ICON = { spin: 'rotate-ccw', market: 'chart-line', discover: 'heart', mystery: 'gift', herobuy: 'shopping-bag' };
const FEATURE_ROUTE = { spin: '#/spin', market: '#/market', discover: '#/discover', mystery: '#/mystery', herobuy: '#/' };

let unlockQueue = [];
function showUnlockModal(k) {
  confetti();
  sndSuccess();
  document.getElementById('overlay-root').innerHTML = `
    <div class="overlay"><div class="unlock-modal">
      <div class="um-icon">${icon(FEATURE_ICON[k], 30)}</div>
      <span class="eyebrow">${icon('sparkles', 12)} ${t('modal.levelReached', { n: FEATURE_LVL[k] })}</span>
      <h2>${t('modal.unlocked', { name: t('feat.' + k + '.name') })}</h2>
      <p>${t('feat.' + k + '.desc')}</p>
      <div class="um-actions">
        <button class="btn ghost" onclick="closeUnlockModal()">${t('modal.later')}</button>
        <button class="btn" onclick="closeUnlockModal(); location.hash = '${FEATURE_ROUTE[k]}'">${t('modal.tryNow')}</button>
      </div>
    </div></div>`;
}
function closeUnlockModal() {
  document.getElementById('overlay-root').innerHTML = '';
  if (unlockQueue.length) showUnlockModal(unlockQueue.shift());
}
const featureUnlocked = k => localStorage.getItem(CHEAT_KEY) === 'unlockall' || xpInfo().lvl >= FEATURE_LVL[k];

function lockedFeatureView(k) {
  return `
  <div class="page"><div class="empty-state">
    ${icon('lock', 44)}
    <h3>${t('modal.locked.title', { name: t('feat.' + k + '.name'), lvl: FEATURE_LVL[k] })}</h3>
    <p>${t('modal.locked.sub', { cur: xpInfo().lvl })}</p>
    <a class="btn" href="#/">${t('modal.locked.cta')}</a>
  </div></div>`;
}

/* ---------- tooltips ---------- */
let tipEl = null;
function showTip(target, text) {
  hideTip();
  tipEl = document.createElement('div');
  tipEl.className = 'ui-tip';
  tipEl.textContent = text;
  document.body.appendChild(tipEl);
  const r = target.getBoundingClientRect();
  tipEl.style.left = Math.max(70, Math.min(window.innerWidth - 70, r.left + r.width / 2)) + 'px';
  tipEl.style.top = (r.bottom + 9) + 'px';
}
function hideTip() {
  if (tipEl) { tipEl.remove(); tipEl = null; }
}
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]');
  if (t) showTip(t, t.dataset.tip);
  else if (tipEl && !tipEl.dataset.pinned) hideTip();
});
// Locked nav features: no navigation, just the tooltip.
document.addEventListener('click', e => {
  const g = e.target.closest('a.nav-gated');
  if (g) {
    e.preventDefault();
    e.stopPropagation();
    showTip(g, g.dataset.tip || t('nav.locked'));
    tipEl.dataset.pinned = '1';
    setTimeout(hideTip, 1700);
  }
}, true);

/* ---------- lightbox ---------- */
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = src;
  lb.hidden = false;
}
function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ---------- router ---------- */
function renderRoute() {
  closeBurger();
  viewTimers.forEach(clearInterval);
  viewTimers = [];
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/');

  let html;
  if (parts[0] === '' || parts[0] === 'kits') html = homeView();
  else if (parts[0] === 'product') html = productView(parts[1]);
  else if (parts[0] === 'bag' || parts[0] === 'checkout') html = bagView();
  else if (parts[0] === 'order') html = orderView(parts[1]);
  else if (parts[0] === 'orders') html = ordersView();
  else if (parts[0] === 'mystery') html = featureUnlocked('mystery') ? mysteryView() : lockedFeatureView('mystery');
  else if (parts[0] === 'discover') html = featureUnlocked('discover') ? discoverView() : lockedFeatureView('discover');
  else if (parts[0] === 'spin') html = featureUnlocked('spin') ? spinView() : lockedFeatureView('spin');
  else if (parts[0] === 'market') html = featureUnlocked('market') ? marketView() : lockedFeatureView('market');
  else if (parts[0] === 'profile') html = profileView();
  else if (parts[0] === 'terms') html = termsView();
  else if (parts[0] === 'privacy') html = privacyView();
  else html = notFoundView();

  $view.innerHTML = html;
  hydrateIcons();

  if (parts[0] === 'order') {
    startTracking(parts[1]);
    const ord = loadOrders().find(o => o.id === parts[1]);
    if (ord && !ord.scratched) bindScratch(ord);
  }
  if (parts[0] === 'discover') {
    renderDeck();
    viewTimers.push(setInterval(tickDiscover, 1000));
  }
  if (parts[0] === 'product') {
    const p = product(parts[1]);
    if (p) { startPdpLive(p); bindPriceChart(p); rvStars = 5; }
  }
  if (parts[0] === 'spin') {
    viewTimers.push(setInterval(tickSpinBtn, 1000));
  }
  if (parts[0] === 'market' && featureUnlocked('market')) bindMarket();
  if (parts[0] === 'mystery') {
    viewTimers.push(setInterval(tickCaseBtn, 1000));
  }
  if (keepScrollY !== null) {
    const y = keepScrollY;
    keepScrollY = null;
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  } else if (parts[0] === 'kits') {
    document.getElementById('kits')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0 });
  }
}

/* ---------- boot ---------- */
(async () => {
applyTheme(localStorage.getItem(THEME_KEY) ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Dev (rambuy.test / localhost): bez SW - cache maskowal swieze zmiany przy testach.
  const devHost = location.hostname === 'rambuy.test' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (devHost) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
  } else {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA optional */ });
  }
}

window.addEventListener('hashchange', renderRoute);
dbgHud();
window.addEventListener('scroll', () => {
  document.getElementById('to-top')?.classList.toggle('show', window.scrollY > 700);
}, { passive: true });
window.scrollTopFast = function () {
  // dlugie strony: skok w poblize gory + krotki smooth zamiast wielosekundowej animacji
  if (window.scrollY > 800) window.scrollTo(0, 800);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
hydrateIcons();
updateBagBadge();
// Migration: the wheel used to grant WHEEL* codes; they no longer exist.
localStorage.setItem(CODES_KEY, JSON.stringify(loadCodes().filter(c => !c.startsWith('WHEEL'))));
if (!localStorage.getItem(SINCE_KEY)) localStorage.setItem(SINCE_KEY, String(Date.now()));
await loadLang();
hydrateStatic();
updateXpChip();
tickNavBadges();
setTimeout(() => checkAchievements(!localStorage.getItem(ACH_KEY)), 2500);
renderRoute();
scheduleFeed(18000);
offlineEarnings();
viewTimersGlobalTick = setInterval(tickEconomy, 1000);
scheduleGolden();
if (welcomeGrant) { saveRp(); setTimeout(() => toast(t('toast.welcome'), 'sparkles'), 900); }
})();
