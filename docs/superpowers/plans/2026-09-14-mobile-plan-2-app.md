# RamNeverComes Mobile - Plan 2: aplikacja w przeglądarce (scena płyty, HUD, katalog, profil)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grywalna wersja gry w przeglądarce w rozmiarze telefonu (także na prawdziwym telefonie przez sieć lokalną): scena płyty głównej z klikaniem, HUD, katalog z zamawianiem, minimalny profil, cinematik odkrycia, zapis w przeglądarce. Cel użytkownika: sprawdzić, czy gra wciąga, zanim powstanie opakowanie natywne.

**Architecture:** `apps/mobile` to aplikacja Vite + TypeScript. Cała logika gry pochodzi z `@rnc/core` (plan 1); aplikacja dokłada sesję (pętla stałego kroku, zapis, zdarzenia), scenę w PixiJS 8 (płyta, sloty, procesor, impulsy, efekty), ekrany DOM (HUD, zakładki, katalog, profil, nakładki) i i18n z plików `lang/`. Zapis przez interfejs `SaveStore` z implementacją na `localStorage`; adapter Capacitor dojdzie w planie 5 bez zmian w reszcie aplikacji. Wszystko, co wizualne, jest wywoływalne z konsoli (`rnc.*`).

**Tech Stack:** Vite 5, TypeScript 5, PixiJS 8, vitest (jsdom dla modułów DOM-owych), Playwright (smoke), sharp (jednorazowy skrypt palety kolorów).

**Spec:** `docs/superpowers/specs/2026-09-13-mobile-game-design.md` (sekcje 3, 4, 7, 9 i 10; kolejność wewnątrz MVP: scena i HUD z klikiem -> katalog i zakupy -> pozostałe zakładki).

**Poza zakresem tego planu** (kolejne plany): Capacitor i pluginy natywne, skrzynki, koło, giełda, discover, zdrapki, osiągnięcia, pakiet 1 (firmware, paczki v2, wycieki, witaj z powrotem), dźwięki poza czterema podstawowymi.

## Global Constraints

- Repozytorium: `/Users/darek/Code/ramnevercomes-mobile`, gałąź `main`, autor commitów = domyślny `git config`. Commity bez `Co-Authored-By`, bez "Generated with Claude Code", bez linków do sesji, bez wzmianek o AI.
- NIGDY długi myślnik (en dash U+2013, em dash U+2014) w kodzie, tekstach, tłumaczeniach i dokumentach; tylko "-". Test czystości w core i `verify:lang` to egzekwują; w aplikacji dochodzi test w zadaniu 12.
- Logika gry wyłącznie z `@rnc/core`: aplikacja nie liczy cen, produkcji ani odkryć sama. Jedyne miejsca, które wołają `Date.now()` i `Math.random()`, to `apps/mobile/src/main.ts` i `apps/mobile/src/game/session.ts` (czas i RNG są wstrzykiwane dalej).
- Sesja: krok stały 100 ms, maks 50 kroków nadrabiania na klatkę; przerwa dłuższa niż 5 s traktowana jako powrót z tła (`resume` z core, limit offline 3 h). Autozapis co 5 s gdy stan się zmienił oraz przy `visibilitychange` -> hidden i `pagehide`. Klucz zapisu `rnc.save`, kopia `rnc.save.bak`.
- i18n: 11 języków z `lang/*.json`, angielski fallbackiem; nowe klucze (prefiks `app.`) muszą być we wszystkich 11 plikach (`npm run verify:lang`), tłumaczone naturalnie (niemiecki "du", francuski "vous"), nazwy kitów nie są tłumaczone.
- UI pod pion, szerokość od 360 px, cele dotyku >= 44 px, `env(safe-area-inset-*)`, `prefers-reduced-motion` wyłącza drżenie i skraca cinematiki. Scena zawsze ciemna.
- Każda nowa rzecz wizualna wywoływalna z konsoli przez `rnc.*` (zadanie 11), zgodnie z regułą z CLAUDE.md rambuy.
- Stałe wizualne sceny: 59 slotów w sekcjach po 6, 2 kolumny, procesor przyklejony do dołu, impulsy na kit min 0.4/s i max 6/s, przy więcej niż 12 aktywnych kitach agregacja per sekcja (limit ~40 impulsów na ekranie).
- `apps/mobile` zależy od `@rnc/core` przez workspace (`"@rnc/core": "*"`); Vite kompiluje TS z `packages/core/src` bezpośrednio (brak kroku build w core).

## Struktura plików (docelowa po planie 2)

```
assets/kits/ram-*.webp                 61 grafik skopiowanych z rambuy (jednorazowo, zadanie 1)
apps/mobile/
  package.json  vite.config.ts  tsconfig.json  vitest.config.ts  playwright.config.ts  index.html
  scripts/sync-public.mjs              kopiuje ../../assets/kits i ../../lang do public/ (predev/prebuild)
  scripts/kit-colors.mjs               jednorazowo: paleta 2 kolorów na kit z grafiki (sharp)
  public/                              (generowane, w .gitignore)
  src/main.ts                          boot
  src/styles.css
  src/data/kit-colors.json             wynik kit-colors.mjs
  src/data/reviews.ts                  RV_META + seededReviews (port z rambuy)
  src/game/events.ts                   typowany emitter
  src/game/storage.ts                  SaveStore + LocalStorageStore
  src/game/loop.ts                     FixedStep (akumulator)
  src/game/session.ts                  Session: stan, rng, krok, zapis, resume, akcje
  src/i18n/i18n.ts                     I18n, loadLang, detectLang
  src/ui/dom.ts                        h(), qs(), pomocnicze
  src/ui/hud.ts  src/ui/tabs.ts  src/ui/fx.ts  src/ui/locked.ts
  src/ui/catalog.ts  src/ui/kitSheet.ts  src/ui/profile.ts
  src/ui/cinematic.ts                  reveal, toasty poziomu i kamienia
  src/scene/layout.ts                  czysta geometria płyty (testowana)
  src/scene/board.ts                   renderer PixiJS
  src/audio/sfx.ts
  src/debug/console.ts                 window.rnc
  test/*.test.ts                       vitest
  e2e/smoke.spec.ts                    Playwright
```

---

### Task 1: Szkielet aplikacji, assety, uruchomienie w przeglądarce

**Files:**
- Create: `assets/kits/` (kopia 61 plików `ram-*.webp` z `/Users/darek/Code/rambuy/assets/`)
- Create: `apps/mobile/package.json`, `apps/mobile/vite.config.ts`, `apps/mobile/tsconfig.json`, `apps/mobile/vitest.config.ts`, `apps/mobile/index.html`, `apps/mobile/src/main.ts`, `apps/mobile/src/styles.css`, `apps/mobile/scripts/sync-public.mjs`
- Modify: `.gitignore` (root), `package.json` (root: skrypty `dev`, `build`, `preview`)
- Test: `apps/mobile/test/sync-public.test.ts`

**Interfaces:**
- Produces: `npm run dev` (root) uruchamia Vite z `--host` (dostęp z telefonu po IP w sieci lokalnej), `npm run build`, `npm run preview`; `npm test -w @rnc/mobile`, `npm run typecheck -w @rnc/mobile`. Strona pokazuje tytuł i pusty szkielet (`#app` z `#hud`, `#scene`, `#screens`, `#tabs`, `#overlay`).

- [ ] **Step 1: Assety i .gitignore**

```bash
cd /Users/darek/Code/ramnevercomes-mobile
mkdir -p assets/kits apps/mobile/{src,scripts,test,e2e}
cp /Users/darek/Code/rambuy/assets/ram-*.webp assets/kits/
ls assets/kits | wc -l    # 61
printf '%s\n' 'apps/mobile/public/' 'apps/mobile/test-results/' 'apps/mobile/playwright-report/' >> .gitignore
```

- [ ] **Step 2: Test skryptu synchronizacji**

`apps/mobile/test/sync-public.test.ts`:
```ts
import { existsSync, mkdtempSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncPublic } from '../scripts/sync-public.mjs';

describe('syncPublic', () => {
  it('copies kit images and language files into public/', () => {
    const root = mkdtempSync(join(tmpdir(), 'rnc-'));
    mkdirSync(join(root, 'assets', 'kits'), { recursive: true });
    mkdirSync(join(root, 'lang'), { recursive: true });
    writeFileSync(join(root, 'assets', 'kits', 'ram-sakura.webp'), 'x');
    writeFileSync(join(root, 'lang', 'en.json'), '{}');
    const pub = join(root, 'public');
    const n = syncPublic(root, pub);
    expect(n).toBe(2);
    expect(existsSync(join(pub, 'assets', 'kits', 'ram-sakura.webp'))).toBe(true);
    expect(readdirSync(join(pub, 'lang'))).toEqual(['en.json']);
  });
});
```

- [ ] **Step 3: Skrypt synchronizacji**

`apps/mobile/scripts/sync-public.mjs`:
```js
// Copies repo-level assets/kits and lang/ into apps/mobile/public before dev/build.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function syncPublic(repoRoot, publicDir) {
  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(join(publicDir, 'assets', 'kits'), { recursive: true });
  mkdirSync(join(publicDir, 'lang'), { recursive: true });
  cpSync(join(repoRoot, 'assets', 'kits'), join(publicDir, 'assets', 'kits'), { recursive: true });
  cpSync(join(repoRoot, 'lang'), join(publicDir, 'lang'), { recursive: true });
  return readdirSync(join(publicDir, 'assets', 'kits')).length + readdirSync(join(publicDir, 'lang')).length;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const n = syncPublic(join(here, '..', '..', '..'), join(here, '..', 'public'));
  console.log(`public synced: ${n} files`);
}
```

- [ ] **Step 4: Konfiguracja pakietu**

`apps/mobile/package.json`:
```json
{
  "name": "@rnc/mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "sync": "node scripts/sync-public.mjs",
    "predev": "npm run sync",
    "dev": "vite --host",
    "prebuild": "npm run sync",
    "build": "vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@rnc/core": "*",
    "pixi.js": "^8.4.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "jsdom": "^25.0.0",
    "@playwright/test": "^1.48.0",
    "sharp": "^0.33.0"
  }
}
```

`apps/mobile/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["vite/client", "node"] },
  "include": ["src/**/*.ts", "src/**/*.json", "test/**/*.ts", "e2e/**/*.ts", "../../packages/core/src/**/*.ts", "../../packages/core/src/**/*.json"]
}
```

`apps/mobile/vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { target: 'es2022', sourcemap: true },
});
```

`apps/mobile/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
```

Root `package.json`: do `scripts` dodać `"dev": "npm run dev -w @rnc/mobile"`, `"build": "npm run build -w @rnc/mobile"`, `"preview": "npm run preview -w @rnc/mobile"`.

- [ ] **Step 5: Szkielet strony**

`apps/mobile/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="#0a1410">
  <title>RamNeverComes</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
</head>
<body>
  <div id="app">
    <header id="hud"></header>
    <main id="scene"></main>
    <section id="screens"></section>
    <nav id="tabs"></nav>
    <div id="overlay"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`apps/mobile/src/styles.css`:
```css
:root {
  --bg: #0a1410; --panel: #0e1a15; --ink: #e8eaf1; --ink-2: #9aa0b4; --ink-3: #5d6378;
  --line: rgba(255,255,255,.08); --accent: #4ce0d2; --amber: #ffb347; --danger: #ff6b6b;
  --font-display: 'Chakra Petch', 'Avenir Next Condensed', 'Arial Narrow', sans-serif;
  --font-body: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  --safe-top: env(safe-area-inset-top, 0px); --safe-bottom: env(safe-area-inset-bottom, 0px);
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font-body); overscroll-behavior: none; }
body { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
#app { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
#hud { padding: calc(var(--safe-top) + 10px) 16px 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; z-index: 3; }
#scene { flex: 1; min-height: 0; position: relative; }
#screens { position: absolute; inset: 0; display: none; }
#screens.on { display: block; }
#tabs { display: flex; gap: 2px; padding: 8px 8px calc(var(--safe-bottom) + 8px); background: rgba(0,0,0,.35); border-top: 1px solid var(--line); z-index: 3; backdrop-filter: blur(10px); }
#overlay { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
#overlay > * { pointer-events: auto; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.display { font-family: var(--font-display); }
@media (prefers-reduced-motion: reduce) { * { animation-duration: .01s !important; transition-duration: .01s !important; } }
```

`apps/mobile/src/main.ts` (tymczasowy, rozbudowywany w kolejnych zadaniach):
```ts
import './styles.css';
import { CORE_VERSION } from '@rnc/core';

const hud = document.getElementById('hud');
if (hud) hud.textContent = `RamNeverComes · core ${CORE_VERSION}`;
```

- [ ] **Step 6: Instalacja i uruchomienie**

```bash
cd /Users/darek/Code/ramnevercomes-mobile && npm install
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
npm run build && ls apps/mobile/dist/assets | head -3
```
Oczekiwane: test syncPublic zielony, typecheck czysty, build tworzy `apps/mobile/dist`. Sprawdzić ręcznie `npm run dev` (Vite wypisze adres `http://<ip>:5173`), strona pokazuje tekst z wersją core, i zakończyć serwer.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mobile): vite app scaffold with kit assets and public sync"
```

---

### Task 2: Paleta kolorów kitów

**Files:**
- Create: `apps/mobile/scripts/kit-colors.mjs`
- Create: `apps/mobile/src/data/kit-colors.json` (wygenerowany)
- Create: `apps/mobile/src/data/kitColors.ts`
- Test: `apps/mobile/test/kitColors.test.ts`

**Interfaces:**
- Produces: `kitColors(id: string): { c1: number; c2: number }` (kolory jako liczby 0xRRGGBB; c1 = średni kolor radiatora z pominięciem białego tła, c2 = c1 przyciemniony o 35%); fallback dla nieznanego id: `{ c1: 0x6c7a89, c2: 0x3a4452 }`.

- [ ] **Step 1: Test**

`apps/mobile/test/kitColors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS } from '@rnc/core';
import colors from '../src/data/kit-colors.json';
import { kitColors } from '../src/data/kitColors';

describe('kit colors', () => {
  it('has an entry for every kit with two distinct colors', () => {
    for (const k of KITS) {
      const c = (colors as Record<string, { c1: number; c2: number }>)[k.id];
      expect(c, k.id).toBeDefined();
      expect(c!.c1).not.toBe(c!.c2);
      expect(c!.c1).toBeGreaterThanOrEqual(0);
      expect(c!.c1).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('falls back for unknown ids', () => {
    expect(kitColors('nope')).toEqual({ c1: 0x6c7a89, c2: 0x3a4452 });
    expect(kitColors('sakura').c1).toBe((colors as Record<string, { c1: number }>).sakura!.c1);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Skrypt (uruchamiany jednorazowo)**

`apps/mobile/scripts/kit-colors.mjs`:
```js
// One-off: average heatsink color per kit from its product photo (white background ignored).
// Usage: node scripts/kit-colors.mjs   (writes src/data/kit-colors.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const kits = JSON.parse(readFileSync(join(here, '..', '..', '..', 'packages', 'core', 'src', 'data', 'kits.json'), 'utf8'));
const out = {};

for (const k of kits) {
  const file = join(here, '..', '..', '..', 'assets', 'kits', k.img.replace('assets/', ''));
  const { data, info } = await sharp(file).resize(48, 48, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
    if (Math.min(pr, pg, pb) > 225) continue; // background
    r += pr; g += pg; b += pb; n++;
  }
  if (!n) { r = 108; g = 122; b = 137; n = 1; }
  const c1 = ((r / n) << 16) | ((g / n) << 8) | (b / n);
  const dark = v => Math.round(v * 0.65);
  const c2 = (dark(r / n) << 16) | (dark(g / n) << 8) | dark(b / n);
  out[k.id] = { c1, c2 };
}
writeFileSync(join(here, '..', 'src', 'data', 'kit-colors.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${Object.keys(out).length} kit palettes`);
```

```bash
cd /Users/darek/Code/ramnevercomes-mobile/apps/mobile && mkdir -p src/data && node scripts/kit-colors.mjs
```

- [ ] **Step 4: Moduł**

`apps/mobile/src/data/kitColors.ts`:
```ts
import raw from './kit-colors.json';

export interface KitPalette { c1: number; c2: number }
const TABLE = raw as Record<string, KitPalette>;
const FALLBACK: KitPalette = { c1: 0x6c7a89, c2: 0x3a4452 };

export function kitColors(id: string): KitPalette {
  return TABLE[id] ?? FALLBACK;
}
```

- [ ] **Step 5: Testy zielone, commit**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
git add apps/mobile/scripts/kit-colors.mjs apps/mobile/src/data apps/mobile/test/kitColors.test.ts
git commit -m "feat(mobile): per-kit color palette generated from product photos"
```

---

### Task 3: Sesja gry: zdarzenia, zapis, pętla stałego kroku

**Files:**
- Create: `apps/mobile/src/game/events.ts`, `apps/mobile/src/game/storage.ts`, `apps/mobile/src/game/loop.ts`, `apps/mobile/src/game/session.ts`
- Test: `apps/mobile/test/loop.test.ts`, `apps/mobile/test/storage.test.ts`, `apps/mobile/test/session.test.ts`

**Interfaces:**
- Consumes z core: `createState, tick, click, buy, affordableQty, resume, serialize, deserialize, OFFLINE_CAP_SEC, mulberry32`, typy `GameState, TickEvents, ClickResult, BuyResult, ResumeResult, Rng`.
- Produces:
```ts
// events.ts
class Emitter<E extends Record<string, unknown>> { on<K extends keyof E>(k: K, fn: (p: E[K]) => void): () => void; emit<K extends keyof E>(k: K, p: E[K]): void }
// storage.ts
interface SaveStore { load(): Promise<string | null>; save(text: string): Promise<void>; clear(): Promise<void> }
class MemoryStore implements SaveStore
class LocalStorageStore implements SaveStore  // klucze rnc.save i rnc.save.bak; load: main, potem bak
// loop.ts
const STEP_MS = 100; const MAX_STEPS = 50; const RESUME_GAP_MS = 5000;
class FixedStep { constructor(now: number); advance(now: number): { steps: number; resumed: boolean } }
// advance: gap = now - last; gap >= RESUME_GAP_MS -> {steps: 0, resumed: true}, akumulator zerowany;
// inaczej akumulator += gap, steps = min(MAX_STEPS, floor(acc / STEP_MS)), acc -= steps*STEP_MS
// session.ts
interface SessionEvents { tick: TickEvents; click: ClickResult & { x: number; y: number }; order: { kitId: string; qty: number }; resume: ResumeResult; saved: number; reset: undefined }
class Session {
  readonly state: GameState; readonly events: Emitter<SessionEvents>;
  static async boot(store: SaveStore, now: number, rng: Rng): Promise<Session>  // deserialize lub createState(now, seed z rng)
  advance(now: number): void            // FixedStep -> tick(state, 0.1, stepNow) na każdy krok (emit 'tick' tylko gdy zdarzenia niepuste), albo resume(now) (emit 'resume' gdy offline > 0 lub zdarzenia)
  click(x: number, y: number, now: number): ClickResult
  buy(kitId: string, qty: number, now: number, hourOfDay: number): BuyResult
  affordable(kitId: string, now: number): number
  maybeSave(now: number, force = false): Promise<boolean>   // co 5 s gdy dirty, lub force
  reset(now: number): Promise<void>      // store.clear, nowy stan, emit 'reset'
}
```

- [ ] **Step 1: Testy**

`apps/mobile/test/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FixedStep, MAX_STEPS, RESUME_GAP_MS, STEP_MS } from '../src/game/loop';

describe('FixedStep', () => {
  it('runs whole steps and keeps the remainder', () => {
    const l = new FixedStep(0);
    expect(l.advance(250)).toEqual({ steps: 2, resumed: false });
    expect(l.advance(300)).toEqual({ steps: 1, resumed: false }); // 50 + 50 remainder
    expect(STEP_MS).toBe(100);
  });

  it('caps catch-up at MAX_STEPS', () => {
    const l = new FixedStep(0);
    expect(l.advance(4_999).steps).toBe(Math.min(MAX_STEPS, 49));
    expect(MAX_STEPS).toBe(50);
  });

  it('treats a long gap as a resume and drops the accumulator', () => {
    const l = new FixedStep(0);
    expect(l.advance(RESUME_GAP_MS)).toEqual({ steps: 0, resumed: true });
    expect(l.advance(RESUME_GAP_MS + 100)).toEqual({ steps: 1, resumed: false });
  });
});
```

`apps/mobile/test/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { LocalStorageStore, MemoryStore } from '../src/game/storage';

function fakeLocalStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, map: m };
}

describe('stores', () => {
  it('MemoryStore round-trips and clears', async () => {
    const s = new MemoryStore();
    expect(await s.load()).toBeNull();
    await s.save('a');
    expect(await s.load()).toBe('a');
    await s.clear();
    expect(await s.load()).toBeNull();
  });

  it('LocalStorageStore keeps a backup of the previous save and falls back to it', async () => {
    const ls = fakeLocalStorage();
    const s = new LocalStorageStore(ls);
    await s.save('one');
    await s.save('two');
    expect(ls.map.get('rnc.save')).toBe('two');
    expect(ls.map.get('rnc.save.bak')).toBe('one');
    ls.map.delete('rnc.save');
    expect(await s.load()).toBe('one');
    await s.clear();
    expect(ls.map.size).toBe(0);
  });

  it('LocalStorageStore survives a throwing backend', async () => {
    const s = new LocalStorageStore({ getItem: () => { throw new Error('quota'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
    expect(await s.load()).toBeNull();
    await expect(s.save('x')).resolves.toBeUndefined();
  });
});
```

`apps/mobile/test/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, START_RP, constantRng } from '@rnc/core';
import { Session } from '../src/game/session';
import { MemoryStore } from '../src/game/storage';

describe('Session', () => {
  it('boots a fresh state and saves it', async () => {
    const store = new MemoryStore();
    const s = await Session.boot(store, 1_000, constantRng(0.5));
    expect(s.state.rp).toBe(START_RP);
    expect(await s.maybeSave(1_000, true)).toBe(true);
    const again = await Session.boot(store, 2_000, constantRng(0.5));
    expect(again.state.createdAt).toBe(1_000);
  });

  it('advances production in fixed steps and emits ticks only with events', async () => {
    const s = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    s.state.orders.push({ id: 'o', ts: 0, dur: 1, items: [{ id: 'brick-build', qty: 1 }], total: 0 });
    let ticks = 0;
    s.events.on('tick', () => { ticks++; });
    s.advance(2_000);
    expect(s.state.rp).toBeGreaterThan(START_RP);
    expect(ticks).toBe(1); // the first tick reports the 32 GB milestone, later ones are silent
  });

  it('resumes after a long gap instead of catching up', async () => {
    const s = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    s.state.orders.push({ id: 'o', ts: 0, dur: 1, items: [{ id: 'brick-build', qty: 1 }], total: 0 });
    let resumed = 0;
    s.events.on('resume', r => { resumed += r.offline; });
    s.advance(1_000);
    s.advance(601_000);
    expect(resumed).toBeGreaterThan(500);
    expect(s.state.lastSeen).toBe(601_000);
  });

  it('clicks, buys and resets through the core rules', async () => {
    const store = new MemoryStore();
    const s = await Session.boot(store, 0, constantRng(0.99));
    expect(s.click(10, 10, 100).gain).toBe(1);
    s.state.rp = 10_000;
    const r = s.buy(KITS[0]!.id, 1, 200, 12);
    expect(r.ok).toBe(true);
    expect(s.affordable(KITS[0]!.id, 200)).toBeGreaterThan(0);
    await s.reset(300);
    expect(s.state.orders.length).toBe(0);
    expect(await store.load()).not.toBeNull();
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/game/events.ts`:
```ts
type Handler<T> = (payload: T) => void;

export class Emitter<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(key: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) { set = new Set(); this.handlers.set(key, set); }
    set.add(fn as Handler<never>);
    return () => { set!.delete(fn as Handler<never>); };
  }

  emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }
}
```

`apps/mobile/src/game/storage.ts`:
```ts
export interface SaveStore {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryStore implements SaveStore {
  private text: string | null = null;
  async load() { return this.text; }
  async save(text: string) { this.text = text; }
  async clear() { this.text = null; }
}

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export const SAVE_KEY = 'rnc.save';
export const BACKUP_KEY = 'rnc.save.bak';

/** Browser save with a one-deep backup; every call is guarded because storage can throw (quota, private mode). */
export class LocalStorageStore implements SaveStore {
  constructor(private readonly ls: StorageLike) {}

  async load() {
    try { return this.ls.getItem(SAVE_KEY) ?? this.ls.getItem(BACKUP_KEY); } catch { return null; }
  }

  async save(text: string) {
    try {
      const prev = this.ls.getItem(SAVE_KEY);
      if (prev !== null && prev !== text) this.ls.setItem(BACKUP_KEY, prev);
      this.ls.setItem(SAVE_KEY, text);
    } catch { /* storage unavailable: the game keeps running in memory */ }
  }

  async clear() {
    try { this.ls.removeItem(SAVE_KEY); this.ls.removeItem(BACKUP_KEY); } catch { /* ignore */ }
  }
}
```

`apps/mobile/src/game/loop.ts`:
```ts
export const STEP_MS = 100;
export const MAX_STEPS = 50;
/** A gap this long means the app was in the background: pay offline earnings instead of catching up. */
export const RESUME_GAP_MS = 5000;

export class FixedStep {
  private acc = 0;
  private last: number;

  constructor(now: number) { this.last = now; }

  advance(now: number): { steps: number; resumed: boolean } {
    const gap = Math.max(0, now - this.last);
    this.last = now;
    if (gap >= RESUME_GAP_MS) { this.acc = 0; return { steps: 0, resumed: true }; }
    this.acc += gap;
    const steps = Math.min(MAX_STEPS, Math.floor(this.acc / STEP_MS));
    this.acc -= steps * STEP_MS;
    return { steps, resumed: false };
  }
}
```

`apps/mobile/src/game/session.ts`:
```ts
import {
  affordableQty, buy, click, createState, deserialize, resume, serialize, tick,
  type BuyResult, type ClickResult, type GameState, type ResumeResult, type Rng, type TickEvents,
} from '@rnc/core';
import { Emitter } from './events';
import { FixedStep, STEP_MS } from './loop';
import type { SaveStore } from './storage';

export interface SessionEvents extends Record<string, unknown> {
  tick: TickEvents;
  click: ClickResult & { x: number; y: number };
  order: { kitId: string; qty: number };
  resume: ResumeResult;
  saved: number;
  reset: undefined;
}

export const AUTOSAVE_MS = 5000;

export class Session {
  readonly events = new Emitter<SessionEvents>();
  private loop: FixedStep;
  private dirty = false;
  private lastSave: number;

  private constructor(public state: GameState, private readonly store: SaveStore, private readonly rng: Rng, now: number) {
    this.loop = new FixedStep(now);
    this.lastSave = now;
  }

  static async boot(store: SaveStore, now: number, rng: Rng): Promise<Session> {
    const text = await store.load();
    const loaded = text === null ? null : deserialize(text, now);
    const state = loaded && loaded.ok ? loaded.state : createState(now, Math.floor(rng() * 2 ** 31));
    const s = new Session(state, store, rng, now);
    if (loaded && loaded.ok) {
      const r = resume(state, now);
      if (r.offline > 0 || r.events.newReveals || r.events.milestone !== null) s.events.emit('resume', r);
      s.dirty = true;
    }
    return s;
  }

  advance(now: number): void {
    const { steps, resumed } = this.loop.advance(now);
    if (resumed) {
      const r = resume(this.state, now);
      if (r.offline > 0 || r.events.newReveals || r.events.milestone !== null) this.events.emit('resume', r);
      this.dirty = true;
      return;
    }
    for (let i = steps; i > 0; i--) {
      const stepNow = now - (i - 1) * STEP_MS;
      const ev = tick(this.state, STEP_MS / 1000, stepNow);
      if (ev.newReveals || ev.milestone !== null) this.events.emit('tick', ev);
    }
    if (steps) this.dirty = true;
  }

  click(x: number, y: number, now: number): ClickResult {
    const r = click(this.state, now, this.rng);
    this.dirty = true;
    this.events.emit('click', { ...r, x, y });
    return r;
  }

  buy(kitId: string, qty: number, now: number, hourOfDay: number): BuyResult {
    const r = buy(this.state, kitId, qty, now, hourOfDay);
    if (r.ok) { this.dirty = true; this.events.emit('order', { kitId, qty }); }
    return r;
  }

  affordable(kitId: string, now: number): number {
    return affordableQty(this.state, kitId, now);
  }

  async maybeSave(now: number, force = false): Promise<boolean> {
    if (!force && (!this.dirty || now - this.lastSave < AUTOSAVE_MS)) return false;
    await this.store.save(serialize(this.state));
    this.dirty = false;
    this.lastSave = now;
    this.events.emit('saved', now);
    return true;
  }

  async reset(now: number): Promise<void> {
    await this.store.clear();
    this.state = createState(now, Math.floor(this.rng() * 2 ** 31));
    this.loop = new FixedStep(now);
    this.dirty = true;
    await this.maybeSave(now, true);
    this.events.emit('reset', undefined);
  }
}
```

- [ ] **Step 4: Testy zielone**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/game apps/mobile/test/loop.test.ts apps/mobile/test/storage.test.ts apps/mobile/test/session.test.ts
git commit -m "feat(mobile): game session with fixed-step loop, autosave and resume"
```

---
### Task 4: i18n i nowe klucze w 11 językach

**Files:**
- Create: `apps/mobile/src/i18n/i18n.ts`
- Modify: `lang/en.json`, `lang/pl.json`, `lang/fr.json`, `lang/es.json`, `lang/pt.json`, `lang/pt-br.json`, `lang/de.json`, `lang/it.json`, `lang/zh.json`, `lang/ja.json`, `lang/ko.json` (nowe klucze `app.*`)
- Test: `apps/mobile/test/i18n.test.ts`

**Interfaces:**
- Produces:
```ts
const LANGS = ['en', 'pl', 'fr', 'es', 'pt', 'pt-br', 'de', 'it', 'zh', 'ja', 'ko'] as const; type Lang = typeof LANGS[number];
type Dict = Record<string, string>;
class I18n { constructor(dict: Dict, fallback: Dict); t(key: string, params?: Record<string, string | number>): string }
// t: dict[key] ?? fallback[key] ?? key; {name} podmieniane z params; brak parametru zostawia {name}
function detectLang(navigatorLangs: readonly string[]): Lang   // 'pt-BR' -> 'pt-br', 'pt-PT' -> 'pt', 'zh-TW' -> 'zh', nieznane -> 'en'
async function loadI18n(lang: Lang, fetchJson: (url: string) => Promise<Dict>): Promise<I18n>  // /lang/en.json zawsze jako fallback
```
- Nowe klucze (wartości angielskie; pozostałe 10 języków tłumaczone naturalnie, nazwy kitów i "RP" bez zmian, bez długich myślników):

```
app.tab.world = Board
app.tab.catalog = Catalog
app.tab.cases = Cases
app.tab.market = Market
app.tab.profile = Profile
app.hud.perSec = /s
app.hud.tap = tap +{n}
app.hud.level = LVL
app.locked.title = Locked
app.locked.body = Unlocks at level {lvl}. You are level {cur}.
app.catalog.title = Parts catalog
app.catalog.order = Order
app.catalog.again = Order again
app.catalog.holdHint = Hold to order several
app.catalog.pending = {n} on the way
app.catalog.arrives = arrives in {time}
app.catalog.lockedName = Undiscovered kit
app.catalog.lockedSub = Reveals once your lifetime RP reaches {amount}
app.catalog.owned = you own x{n}
app.catalog.notEnough = Not enough RP
app.catalog.outOfStock = Out of stock
app.sheet.specs = Specifications
app.sheet.reviews = Reviews
app.sheet.close = Close
app.sheet.perKit = +{n} RP/s per kit, producing once delivered
app.profile.title = Profile
app.profile.level = Level {n}
app.profile.balance = Balance
app.profile.production = Production
app.profile.lifetime = Lifetime RP
app.profile.memory = Memory delivered
app.profile.nextMs = Next milestone at {gb} GB: production +15%
app.profile.msDone = Every milestone reached
app.profile.language = Language
app.profile.clear = Clear progress
app.profile.clearConfirm = Tap again to wipe everything
app.profile.cleared = Progress cleared. Here are your first 128 RP again.
app.toast.levelUp = Level {n}: deliveries now take {time}
app.toast.milestone = Milestone: you own as much memory as {what}. Production +15%
app.toast.ordered = {name} ordered. It will never arrive, but it will produce.
app.toast.away = While you were away your memory made {amount} RP
app.reveal.eyebrow = New kit discovered
app.reveal.more = +{n} more
app.board.section = Board rev. {n}
app.board.combo = COMBO
app.board.crit = CRIT
```

- [ ] **Step 1: Test**

`apps/mobile/test/i18n.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { I18n, LANGS, detectLang, loadI18n } from '../src/i18n/i18n';

const en = JSON.parse(readFileSync(new URL('../../../lang/en.json', import.meta.url), 'utf8')) as Record<string, string>;

describe('I18n', () => {
  it('translates with params and falls back to English, then to the key', () => {
    const i = new I18n({ 'app.hud.tap': 'tap +{n}' }, { 'app.tab.world': 'Board' });
    expect(i.t('app.hud.tap', { n: 12 })).toBe('tap +12');
    expect(i.t('app.tab.world')).toBe('Board');
    expect(i.t('nope')).toBe('nope');
    expect(i.t('app.hud.tap')).toBe('tap +{n}');
  });

  it('detects the language from navigator languages', () => {
    expect(detectLang(['pt-BR', 'en'])).toBe('pt-br');
    expect(detectLang(['pt-PT'])).toBe('pt');
    expect(detectLang(['zh-TW'])).toBe('zh');
    expect(detectLang(['de-AT'])).toBe('de');
    expect(detectLang(['xx'])).toBe('en');
    expect(detectLang([])).toBe('en');
    expect(LANGS.length).toBe(11);
  });

  it('loads a language with English as fallback', async () => {
    const fetchJson = async (url: string) => (url.endsWith('/pl.json') ? { 'app.tab.world': 'Płyta' } : { 'app.tab.world': 'Board', 'app.tab.catalog': 'Catalog' });
    const i = await loadI18n('pl', fetchJson);
    expect(i.t('app.tab.world')).toBe('Płyta');
    expect(i.t('app.tab.catalog')).toBe('Catalog');
  });

  it('ships every app.* key in every language file', () => {
    const appKeys = Object.keys(en).filter(k => k.startsWith('app.'));
    expect(appKeys.length).toBeGreaterThanOrEqual(44);
    for (const lang of LANGS) {
      const d = JSON.parse(readFileSync(new URL(`../../../lang/${lang}.json`, import.meta.url), 'utf8')) as Record<string, string>;
      for (const k of appKeys) expect(d[k], `${lang} ${k}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja i klucze**

`apps/mobile/src/i18n/i18n.ts`:
```ts
export const LANGS = ['en', 'pl', 'fr', 'es', 'pt', 'pt-br', 'de', 'it', 'zh', 'ja', 'ko'] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = Record<string, string>;

export class I18n {
  constructor(private readonly dict: Dict, private readonly fallback: Dict) {}

  t(key: string, params?: Record<string, string | number>): string {
    const raw = this.dict[key] ?? this.fallback[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }
}

export function detectLang(navigatorLangs: readonly string[]): Lang {
  for (const tag of navigatorLangs) {
    const lower = tag.toLowerCase();
    if (lower === 'pt-br') return 'pt-br';
    const base = lower.split('-')[0] ?? '';
    const hit = LANGS.find(l => l === base);
    if (hit) return hit;
  }
  return 'en';
}

export async function loadI18n(lang: Lang, fetchJson: (url: string) => Promise<Dict>): Promise<I18n> {
  const en = await fetchJson('/lang/en.json');
  const dict = lang === 'en' ? en : await fetchJson(`/lang/${lang}.json`);
  return new I18n(dict, en);
}

export const fetchJson = async (url: string): Promise<Dict> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as Dict;
};
```

Klucze: do każdego z 11 plików `lang/*.json` dopisać wszystkie klucze `app.*` z listy powyżej (angielskie wartości do `en.json`, tłumaczenia do pozostałych). Zachować formatowanie plików (2 spacje), dopisać na końcu obiektu. Sprawdzić `npm run verify:lang` i brak U+2013/U+2014.

- [ ] **Step 4: Testy zielone**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile && npm run verify:lang
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n apps/mobile/test/i18n.test.ts lang
git commit -m "feat(mobile): i18n loader with app keys in eleven languages"
```

---

### Task 5: Szkielet UI: pomocnicze DOM, HUD, zakładki, efekty, ekran blokady

**Files:**
- Create: `apps/mobile/src/ui/dom.ts`, `apps/mobile/src/ui/hud.ts`, `apps/mobile/src/ui/tabs.ts`, `apps/mobile/src/ui/fx.ts`, `apps/mobile/src/ui/locked.ts`
- Modify: `apps/mobile/src/styles.css` (sekcje HUD, tabs, fx, locked), `apps/mobile/vitest.config.ts` (`environment: 'jsdom'` dla `test/ui/*`)
- Test: `apps/mobile/test/ui/hud.test.ts`, `apps/mobile/test/ui/tabs.test.ts`

**Interfaces:**
- Consumes: `I18n` (Task 4); z core `cps, clickValue, xpInfo, fmtRP, featureUnlocked, FEATURE_LVL`, typ `GameState`.
- Produces:
```ts
// dom.ts
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | number | boolean | ((e: Event) => void)>, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K]
// attrs: 'class', 'id', 'data-*', 'aria-*', 'type', 'disabled' (boolean), 'onclick'/'onpointerdown'... jako funkcje
function icon(name: 'cpu' | 'box' | 'gift' | 'chart' | 'user' | 'lock' | 'x' | 'sparkles' | 'star', size = 24): SVGElement   // inline SVG, stroke currentColor
// hud.ts
class Hud { constructor(host: HTMLElement, i18n: I18n); render(state: GameState, now: number): void }
// wyświetla: RP (mono, fmtRP), "+{cps}/s", "tap +{clickValue}", pierścień poziomu (svg, dashoffset z xpInfo), numer poziomu
// tabs.ts
type TabId = 'world' | 'catalog' | 'cases' | 'market' | 'profile';
const TAB_FEATURE: Partial<Record<TabId, FeatureId>> = { cases: 'mystery', market: 'market' }
class Tabs { constructor(host: HTMLElement, i18n: I18n, onSelect: (id: TabId) => void); active: TabId; render(state: GameState): void; setDot(id: TabId, on: boolean): void }
// render: zablokowane zakładki dostają klasę 'locked' i ikonę kłódki; kliknięcie zablokowanej też woła onSelect (ekran blokady)
// fx.ts
class Fx { constructor(host: HTMLElement); fly(x: number, y: number, text: string, crit: boolean): void; toast(html: string, ms = 2600): void; shake(target: HTMLElement): void }
// locked.ts
function lockedScreen(i18n: I18n, feature: FeatureId, state: GameState): HTMLElement
```

- [ ] **Step 1: Testy (jsdom)**

`apps/mobile/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [['test/ui/**', 'jsdom']],
  },
});
```

`apps/mobile/test/ui/hud.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createState } from '@rnc/core';
import { I18n } from '../../src/i18n/i18n';
import { Hud } from '../../src/ui/hud';

const i18n = new I18n({}, { 'app.hud.perSec': '/s', 'app.hud.tap': 'tap +{n}', 'app.hud.level': 'LVL' });

describe('Hud', () => {
  it('renders balance, rate, tap value and level', () => {
    const host = document.createElement('div');
    const hud = new Hud(host, i18n);
    const s = createState(0, 1);
    s.rp = 12_345;
    hud.render(s, 0);
    expect(host.querySelector('[data-rp]')?.textContent).toBe('12.3K');
    expect(host.querySelector('[data-cps]')?.textContent).toBe('0');
    expect(host.querySelector('[data-tap]')?.textContent).toBe('1');
    expect(host.querySelector('[data-lvl]')?.textContent).toBe('1');
    const ring = host.querySelector('[data-ring]') as SVGCircleElement;
    expect(ring.getAttribute('stroke-dashoffset')).toBe('94.2');
  });
});
```

`apps/mobile/test/ui/tabs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createState } from '@rnc/core';
import { I18n } from '../../src/i18n/i18n';
import { Tabs } from '../../src/ui/tabs';

const i18n = new I18n({}, { 'app.tab.world': 'Board', 'app.tab.catalog': 'Catalog', 'app.tab.cases': 'Cases', 'app.tab.market': 'Market', 'app.tab.profile': 'Profile' });

describe('Tabs', () => {
  it('marks locked tabs and reports selection', () => {
    const host = document.createElement('div');
    const picked: string[] = [];
    const tabs = new Tabs(host, i18n, id => picked.push(id));
    const s = createState(0, 1);
    tabs.render(s);
    const buttons = host.querySelectorAll('button');
    expect(buttons.length).toBe(5);
    expect(buttons[2]!.classList.contains('locked')).toBe(true); // cases needs level 15
    expect(buttons[1]!.classList.contains('locked')).toBe(false);
    buttons[1]!.click();
    expect(picked).toEqual(['catalog']);
    expect(tabs.active).toBe('catalog');
    s.xpTotal = 50 * 2 ** 20;
    tabs.render(s);
    expect(host.querySelectorAll('button')[3]!.classList.contains('locked')).toBe(false);
    tabs.setDot('cases', true);
    expect(host.querySelector('[data-tab="cases"] .dot')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/ui/dom.ts`:
```ts
type Attr = string | number | boolean | ((e: Event) => void);

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else if (k === 'class') el.className = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}

const PATHS: Record<string, string> = {
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1M12 8c2-4 6-4 6-1s-4 1-6 1"/>',
  chart: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM5 3l.7 2 2 .7-2 .7L5 8.4l-.7-2-2-.7 2-.7zM19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};

export function icon(name: keyof typeof PATHS, size = 24): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = PATHS[name] ?? '';
  return svg;
}

export function clear(el: HTMLElement): void { while (el.firstChild) el.removeChild(el.firstChild); }
```

`apps/mobile/src/ui/hud.ts`:
```ts
import { clickValue, cps, fmtRP, xpInfo, type GameState } from '@rnc/core';
import type { I18n } from '../i18n/i18n';
import { h } from './dom';

const RING = 94.2; // 2 * PI * 15

export class Hud {
  private rp: HTMLElement; private cps: HTMLElement; private tap: HTMLElement; private lvl: HTMLElement; private ring: SVGCircleElement;

  constructor(host: HTMLElement, i18n: I18n) {
    this.rp = h('span', { 'data-rp': '' });
    this.cps = h('span', { 'data-cps': '' });
    this.tap = h('span', { 'data-tap': '' });
    this.lvl = h('div', { class: 'lvl-n display', 'data-lvl': '' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 36 36');
    svg.innerHTML = `<circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3"/><circle data-ring cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" transform="rotate(-90 18 18)"/>`;
    this.ring = svg.querySelector('[data-ring]') as SVGCircleElement;
    host.append(
      h('div', { class: 'hud-left' },
        h('div', { class: 'hud-rp mono' }, this.rp, h('small', { class: 'display' }, 'RP')),
        h('div', { class: 'hud-rate mono' }, '+', this.cps, i18n.t('app.hud.perSec'), h('span', { class: 'hud-tap' }, ' · ', i18n.t('app.hud.tap', { n: '' }).trim(), this.tap)),
      ),
      h('div', { class: 'hud-lvl' }, svg, h('div', {}, h('div', { class: 'lvl-l display' }, i18n.t('app.hud.level')), this.lvl)),
    );
  }

  render(state: GameState, now: number): void {
    this.rp.textContent = fmtRP(state.rp);
    this.cps.textContent = fmtRP(cps(state, now));
    this.tap.textContent = fmtRP(clickValue(state, now));
    const xp = xpInfo(state.xpTotal);
    this.lvl.textContent = String(xp.lvl);
    this.ring.setAttribute('stroke-dashoffset', (RING * (1 - Math.min(1, xp.cur / xp.need))).toFixed(1));
  }
}
```

`apps/mobile/src/ui/tabs.ts`:
```ts
import { FEATURE_LVL, featureUnlocked, type FeatureId, type GameState } from '@rnc/core';
import type { I18n } from '../i18n/i18n';
import { h, icon } from './dom';

export type TabId = 'world' | 'catalog' | 'cases' | 'market' | 'profile';
export const TAB_IDS: readonly TabId[] = ['world', 'catalog', 'cases', 'market', 'profile'];
export const TAB_FEATURE: Partial<Record<TabId, FeatureId>> = { cases: 'mystery', market: 'market' };
const TAB_ICON: Record<TabId, 'cpu' | 'box' | 'gift' | 'chart' | 'user'> = { world: 'cpu', catalog: 'box', cases: 'gift', market: 'chart', profile: 'user' };

export class Tabs {
  active: TabId = 'world';
  private buttons = new Map<TabId, HTMLButtonElement>();

  constructor(host: HTMLElement, i18n: I18n, private readonly onSelect: (id: TabId) => void) {
    for (const id of TAB_IDS) {
      const b = h('button', { type: 'button', class: 'tab display', 'data-tab': id, onclick: () => this.select(id) },
        h('span', { class: 'tab-icon' }, icon(TAB_ICON[id])), h('span', { class: 'tab-label' }, i18n.t('app.tab.' + id)));
      this.buttons.set(id, b);
      host.append(b);
    }
    this.buttons.get('world')!.classList.add('on');
  }

  select(id: TabId): void {
    this.active = id;
    for (const [k, b] of this.buttons) b.classList.toggle('on', k === id);
    this.onSelect(id);
  }

  render(state: GameState): void {
    for (const [id, b] of this.buttons) {
      const f = TAB_FEATURE[id];
      const locked = f ? !featureUnlocked(state.xpTotal, f) : false;
      b.classList.toggle('locked', locked);
      b.title = locked && f ? String(FEATURE_LVL[f]) : '';
    }
  }

  setDot(id: TabId, on: boolean): void {
    const b = this.buttons.get(id)!;
    const dot = b.querySelector('.dot');
    if (on && !dot) b.append(h('span', { class: 'dot' }));
    if (!on && dot) dot.remove();
  }
}
```

`apps/mobile/src/ui/fx.ts`:
```ts
import { h } from './dom';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Fx {
  constructor(private readonly hostEl: HTMLElement) {}

  get host(): HTMLElement { return this.hostEl; }

  fly(x: number, y: number, text: string, crit: boolean): void {
    const el = h('div', { class: 'fly mono' + (crit ? ' crit' : '') }, text);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    this.hostEl.append(el);
    setTimeout(() => el.remove(), 1200);
  }

  toast(html: string, ms = 2600): void {
    const el = h('div', { class: 'toastx' });
    el.innerHTML = html;
    el.style.animationDuration = ms + 'ms';
    this.hostEl.append(el);
    setTimeout(() => el.remove(), ms + 100);
  }

  shake(target: HTMLElement): void {
    if (reduced()) return;
    target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
  }
}
```

`apps/mobile/src/ui/locked.ts`:
```ts
import { FEATURE_LVL, xpInfo, type FeatureId, type GameState } from '@rnc/core';
import type { I18n } from '../i18n/i18n';
import { h, icon } from './dom';

export function lockedScreen(i18n: I18n, feature: FeatureId, state: GameState): HTMLElement {
  return h('div', { class: 'locked-screen' },
    h('div', { class: 'locked-icon' }, icon('lock', 36)),
    h('h2', { class: 'display' }, i18n.t('app.locked.title')),
    h('p', {}, i18n.t('app.locked.body', { lvl: FEATURE_LVL[feature], cur: xpInfo(state.xpTotal).lvl })),
  );
}
```

Dopisać do `apps/mobile/src/styles.css`:
```css
/* HUD */
.hud-rp { font-size: 32px; font-weight: 600; line-height: 1; letter-spacing: -.02em; }
.hud-rp small { font-size: 13px; color: var(--ink-2); margin-left: 6px; letter-spacing: .08em; }
.hud-rate { margin-top: 6px; font-size: 13px; color: var(--accent); }
.hud-tap { color: var(--ink-3); }
.hud-lvl { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid var(--line); color: var(--accent); }
.hud-lvl svg { width: 30px; height: 30px; display: block; }
.lvl-l { font-size: 10px; letter-spacing: .12em; color: var(--ink-2); line-height: 1; margin-bottom: 3px; }
.lvl-n { font-weight: 700; font-size: 14px; line-height: 1; color: var(--ink); }
/* tabs */
.tab { flex: 1; min-height: 52px; border: 0; background: none; color: var(--ink-3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; position: relative; border-radius: 14px; }
.tab svg { width: 24px; height: 24px; }
.tab.on { color: var(--accent); background: rgba(255,255,255,.05); }
.tab.locked { opacity: .45; }
.tab .dot { position: absolute; top: 8px; left: calc(50% + 8px); width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: dot 1.6s ease-out infinite; }
@keyframes dot { 0% { box-shadow: 0 0 0 0 rgba(255,179,71,.6); } 100% { box-shadow: 0 0 0 8px rgba(255,179,71,0); } }
/* fx */
.fly { position: absolute; font-weight: 600; font-size: 18px; color: var(--accent); transform: translate(-50%, -50%); animation: fly .9s ease-out forwards; text-shadow: 0 0 12px rgba(76,224,210,.6); white-space: nowrap; pointer-events: none; }
.fly.crit { color: var(--amber); font-size: 26px; text-shadow: 0 0 18px rgba(255,179,71,.8); animation-duration: 1.1s; }
@keyframes fly { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -180%); } }
.toastx { position: absolute; left: 50%; top: calc(var(--safe-top) + 84px); transform: translateX(-50%); background: rgba(12,16,24,.92); border: 1px solid rgba(76,224,210,.35); color: var(--ink); font-size: 13px; padding: 8px 14px; border-radius: 999px; max-width: calc(100% - 32px); text-align: center; animation: toastx 2.6s ease forwards; backdrop-filter: blur(6px); }
.toastx b { color: var(--accent); font-weight: 600; }
@keyframes toastx { 0% { opacity: 0; transform: translate(-50%, -10px); } 12%, 85% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -6px); } }
.shake { animation: shake .32s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 1px, 0); } 40%, 60% { transform: translate3d(4px, -1px, 0); } }
/* locked */
.locked-screen { height: 100%; display: grid; place-items: center; text-align: center; padding: 32px; color: var(--ink-2); background: var(--bg); }
.locked-screen h2 { margin: 12px 0 6px; color: var(--ink); }
.locked-screen p { margin: 0; max-width: 28ch; }
.locked-icon { color: var(--ink-3); }
```

- [ ] **Step 4: Testy zielone**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui apps/mobile/src/styles.css apps/mobile/vitest.config.ts apps/mobile/test/ui
git commit -m "feat(mobile): hud, tabs, effects and locked screen"
```

---

### Task 6: Geometria płyty (czysta, testowana)

**Files:**
- Create: `apps/mobile/src/scene/layout.ts`
- Test: `apps/mobile/test/layout.test.ts`

**Interfaces:**
- Produces:
```ts
const SLOT_W = 150; const SLOT_H = 24; const ROW_H = 54; const SECTION_SIZE = 6; const SECTION_HEAD = 28; const SECTION_GAP = 18; const CPU_SIZE = 104; const CPU_MARGIN = 118; const BUS_GAP = 6;
interface Rect { x: number; y: number; w: number; h: number }
function sectionOf(tier: number): number                  // floor(tier / 6)
function sectionsToShow(revealed: number): number         // ceil(revealed / 6), min 1
function sectionTop(section: number): number              // 24 + section * (SECTION_HEAD + 3 * ROW_H + SECTION_GAP)
function slotRect(tier: number, width: number): Rect      // 2 kolumny: x = width/2 - SLOT_W - 16 lub width/2 + 16; y = sectionTop + SECTION_HEAD + row * ROW_H, row = floor((tier % 6) / 2)
function boardHeight(revealed: number): number            // sectionTop(sectionsToShow) - SECTION_GAP + 24
function cpuRect(width: number, viewportH: number): Rect  // kwadrat CPU_SIZE wyśrodkowany, y = viewportH - CPU_MARGIN - CPU_SIZE/2 (środek), zwraca lewy górny róg
function tracePath(tier: number, width: number, cpuTopY: number): { x: number; y: number }[]  // [koniec slotu przy szynie, punkt na szynie, cpuTop]; szyna x = width/2 -/+ BUS_GAP
function pointAlong(path: { x: number; y: number }[], t: number): { x: number; y: number }
function clampCamera(y: number, boardH: number, viewportH: number): number   // 0 .. max(0, boardH - (viewportH - CPU_MARGIN - CPU_SIZE/2 - 20))
function pulseRate(kitCps: number, totalCps: number): number  // clamp((kitCps / totalCps) * 8, 0.4, 6); 0 gdy totalCps = 0
```

- [ ] **Step 1: Test**

`apps/mobile/test/layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CPU_MARGIN, CPU_SIZE, ROW_H, SECTION_HEAD, SLOT_W, boardHeight, clampCamera, cpuRect, pointAlong, pulseRate, sectionOf, sectionTop, sectionsToShow, slotRect, tracePath } from '../src/scene/layout';

describe('board layout', () => {
  it('groups tiers into sections of six', () => {
    expect(sectionOf(0)).toBe(0);
    expect(sectionOf(5)).toBe(0);
    expect(sectionOf(6)).toBe(1);
    expect(sectionsToShow(0)).toBe(1);
    expect(sectionsToShow(2)).toBe(1);
    expect(sectionsToShow(7)).toBe(2);
    expect(sectionsToShow(59)).toBe(10);
  });

  it('places slots in two columns, three rows per section', () => {
    const w = 390;
    const a = slotRect(0, w), b = slotRect(1, w), c = slotRect(2, w), g = slotRect(6, w);
    expect(a.x).toBe(w / 2 - SLOT_W - 16);
    expect(b.x).toBe(w / 2 + 16);
    expect(a.y).toBe(b.y);
    expect(c.y).toBe(a.y + ROW_H);
    expect(a.y).toBe(sectionTop(0) + SECTION_HEAD);
    expect(g.y).toBe(sectionTop(1) + SECTION_HEAD);
    expect(boardHeight(6)).toBeGreaterThan(slotRect(5, w).y + 24);
    expect(boardHeight(7)).toBeGreaterThan(boardHeight(6));
  });

  it('pins the cpu near the bottom of the viewport', () => {
    const r = cpuRect(390, 700);
    expect(r.w).toBe(CPU_SIZE);
    expect(r.x + r.w / 2).toBe(195);
    expect(r.y + r.h / 2).toBe(700 - CPU_MARGIN);
  });

  it('routes traces via the bus and interpolates along them', () => {
    const p = tracePath(0, 390, 500);
    expect(p.length).toBe(3);
    expect(p[0]!.y).toBe(p[1]!.y);
    expect(p[1]!.x).toBe(p[2]!.x);
    expect(p[2]!.y).toBe(500);
    expect(pointAlong(p, 0)).toEqual(p[0]);
    expect(pointAlong(p, 1)).toEqual(p[2]);
    const mid = pointAlong(p, 0.5);
    expect(mid.x).toBeGreaterThanOrEqual(Math.min(p[0]!.x, p[1]!.x));
  });

  it('clamps the camera and scales pulse rates', () => {
    expect(clampCamera(-10, 2000, 700)).toBe(0);
    expect(clampCamera(99_999, 2000, 700)).toBe(2000 - (700 - CPU_MARGIN - CPU_SIZE / 2 - 20));
    expect(clampCamera(50, 100, 700)).toBe(0);
    expect(pulseRate(0, 0)).toBe(0);
    expect(pulseRate(1, 100)).toBe(0.4);
    expect(pulseRate(100, 100)).toBe(6);
    expect(pulseRate(25, 100)).toBe(2);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/scene/layout.ts`:
```ts
export const SLOT_W = 150;
export const SLOT_H = 24;
export const ROW_H = 54;
export const SECTION_SIZE = 6;
export const SECTION_HEAD = 28;
export const SECTION_GAP = 18;
export const CPU_SIZE = 104;
export const CPU_MARGIN = 118;
export const BUS_GAP = 6;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

const ROWS = SECTION_SIZE / 2;
const SECTION_H = SECTION_HEAD + ROWS * ROW_H + SECTION_GAP;

export const sectionOf = (tier: number): number => Math.floor(tier / SECTION_SIZE);
export const sectionsToShow = (revealed: number): number => Math.max(1, Math.ceil(revealed / SECTION_SIZE));
export const sectionTop = (section: number): number => 24 + section * SECTION_H;

export function slotRect(tier: number, width: number): Rect {
  const inSection = tier % SECTION_SIZE;
  const col = inSection % 2;
  const row = Math.floor(inSection / 2);
  return { x: col ? width / 2 + 16 : width / 2 - SLOT_W - 16, y: sectionTop(sectionOf(tier)) + SECTION_HEAD + row * ROW_H, w: SLOT_W, h: SLOT_H };
}

export const boardHeight = (revealed: number): number => sectionTop(sectionsToShow(revealed)) - SECTION_GAP + 24;

export function cpuRect(width: number, viewportH: number): Rect {
  return { x: width / 2 - CPU_SIZE / 2, y: viewportH - CPU_MARGIN - CPU_SIZE / 2, w: CPU_SIZE, h: CPU_SIZE };
}

/** Slot edge -> bus -> cpu top. Left column joins the left bus lane, right column the right lane. */
export function tracePath(tier: number, width: number, cpuTopY: number): Pt[] {
  const s = slotRect(tier, width);
  const right = tier % 2 === 1;
  const ex = right ? s.x : s.x + s.w;
  const bx = right ? width / 2 + BUS_GAP : width / 2 - BUS_GAP;
  const y = s.y + s.h / 2;
  return [{ x: ex, y }, { x: bx, y }, { x: bx, y: cpuTopY }];
}

export function pointAlong(path: Pt[], t: number): Pt {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y); segs.push(d); total += d; }
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    const len = segs[i]!;
    if (dist <= len || i === segs.length - 1) {
      const k = len ? Math.min(1, dist / len) : 1;
      const a = path[i]!, b = path[i + 1]!;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    dist -= len;
  }
  return path[path.length - 1]!;
}

export function clampCamera(y: number, boardH: number, viewportH: number): number {
  const visible = viewportH - CPU_MARGIN - CPU_SIZE / 2 - 20;
  return Math.max(0, Math.min(y, Math.max(0, boardH - visible)));
}

export function pulseRate(kitCps: number, totalCps: number): number {
  if (totalCps <= 0) return 0;
  return Math.min(6, Math.max(0.4, (kitCps / totalCps) * 8));
}
```

- [ ] **Step 4: Testy zielone, commit**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
git add apps/mobile/src/scene/layout.ts apps/mobile/test/layout.test.ts
git commit -m "feat(mobile): board layout geometry"
```

---
### Task 7: Renderer sceny płyty (PixiJS)

**Files:**
- Create: `apps/mobile/src/scene/board.ts`
- Test: `apps/mobile/test/board-sim.test.ts` (logika pomocnicza sceny, bez WebGL)

**Interfaces:**
- Consumes: `layout.ts` (Task 6), `kitColors` (Task 2), z core `KITS, revealedCount, ownedCounts, cps, comboMult, STARTER_TIERS`, `I18n`.
- Produces:
```ts
interface BoardCallbacks { onTap(x: number, y: number): void }   // x, y w pikselach hosta sceny (dla Fx.fly)
class Board {
  static async create(host: HTMLElement, i18n: I18n, cb: BoardCallbacks): Promise<Board>
  render(state: GameState, now: number, dtMs: number): void   // wołane co klatkę
  flashClick(crit: boolean): void      // pierścień + iskry na procesorze (kryt: bursztyn, więcej iskier)
  install(tier: number): void          // animacja wjazdu kości do slotu
  scrollToTier(tier: number): void
  setVisible(on: boolean): void        // pauza rysowania, gdy inna zakładka
  destroy(): void
}
// pomocnicze, eksportowane do testów:
function slotSignature(state: GameState, now: number): string          // revealedCount + posortowane liczby dostarczonych/zamówionych kopii per tier
function pulseTargets(state: GameState, now: number): { tier: number; rate: number }[]
// rate z layout.pulseRate; gdy więcej niż 12 aktywnych kitów: jedna pozycja na sekcję (tier = najwyższy posiadany w sekcji, rate = suma udziałów sekcji)
```

- [ ] **Step 1: Test logiki pomocniczej**

`apps/mobile/test/board-sim.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, createState } from '@rnc/core';
import { pulseTargets, slotSignature } from '../src/scene/board';

function owning(tiers: number[]) {
  const s = createState(0, 1);
  for (const t of tiers) s.orders.push({ id: 'o' + t, ts: 0, dur: 0, items: [{ id: KITS[t]!.id, qty: 1 }], total: 0 });
  s.xpTotal = KITS[Math.max(...tiers, 2)]!.rpCost * 8;
  return s;
}

describe('board helpers', () => {
  it('changes the signature when ownership or reveals change', () => {
    const a = owning([0]);
    const sig = slotSignature(a, 1000);
    a.orders.push({ id: 'x', ts: 0, dur: 0, items: [{ id: KITS[1]!.id, qty: 1 }], total: 0 });
    expect(slotSignature(a, 1000)).not.toBe(sig);
    const b = owning([0]);
    b.xpTotal *= 4;
    expect(slotSignature(b, 1000)).not.toBe(sig);
  });

  it('gives every owned kit a pulse rate within bounds', () => {
    const s = owning([0, 1, 2]);
    const t = pulseTargets(s, 1000);
    expect(t.map(x => x.tier)).toEqual([0, 1, 2]);
    for (const x of t) { expect(x.rate).toBeGreaterThanOrEqual(0.4); expect(x.rate).toBeLessThanOrEqual(6); }
  });

  it('aggregates per section above twelve active kits', () => {
    const s = owning(Array.from({ length: 14 }, (_, i) => i));
    const t = pulseTargets(s, 1000);
    expect(t.length).toBe(3); // sections 0, 1, 2 (tiers 0-5, 6-11, 12-13)
    expect(t[2]!.tier).toBe(13);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/scene/board.ts`:
```ts
import { Application, Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import { KITS, comboMult, cps, ownedCounts, revealedCount, type GameState } from '@rnc/core';
import { kitColors } from '../data/kitColors';
import type { I18n } from '../i18n/i18n';
import { CPU_SIZE, SECTION_SIZE, SLOT_H, SLOT_W, boardHeight, clampCamera, cpuRect, pointAlong, pulseRate, sectionOf, sectionTop, sectionsToShow, slotRect, tracePath, type Pt } from './layout';

export interface BoardCallbacks { onTap(x: number, y: number): void }

const CYAN = 0x4ce0d2, AMBER = 0xffb347, COPPER = 0xc9803a, INK = 0xe8eaf1;
const MAX_PULSES = 40;
const AGGREGATE_ABOVE = 12;
const LABEL: TextStyleOptions = { fontFamily: 'Chakra Petch, sans-serif', fontSize: 11, fontWeight: '700', fill: INK };
const MONO: TextStyleOptions = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: '600', fill: 0xffffff };

export function slotSignature(state: GameState, now: number): string {
  const all = ownedCounts(state, now, true), delivered = ownedCounts(state, now);
  return revealedCount(state, now) + '|' + KITS.map(k => (all[k.id] ?? 0) + ':' + (delivered[k.id] ?? 0)).join(',');
}

export function pulseTargets(state: GameState, now: number): { tier: number; rate: number }[] {
  const delivered = ownedCounts(state, now);
  const active = KITS.filter(k => (delivered[k.id] ?? 0) > 0).map(k => ({ tier: k.tier, cps: k.rpProd * (delivered[k.id] ?? 0) }));
  const total = active.reduce((s, a) => s + a.cps, 0);
  if (!total) return [];
  if (active.length <= AGGREGATE_ABOVE) return active.map(a => ({ tier: a.tier, rate: pulseRate(a.cps, total) }));
  const bySection = new Map<number, { tier: number; cps: number }>();
  for (const a of active) {
    const s = sectionOf(a.tier);
    const cur = bySection.get(s);
    bySection.set(s, { tier: Math.max(cur?.tier ?? -1, a.tier), cps: (cur?.cps ?? 0) + a.cps });
  }
  return [...bySection.values()].map(a => ({ tier: a.tier, rate: pulseRate(a.cps, total) }));
}

interface Pulse { sprite: Sprite; tier: number; t: number }
interface Spark { sprite: Sprite; vx: number; vy: number; t: number; crit: boolean }
interface Ring { t: number; crit: boolean }
interface SlotView { root: Container; kit: Container | null; installT: number }

export class Board {
  private world = new Container();
  private fixed = new Container();
  private bg = new Graphics();
  private traces = new Graphics();
  private cpu = new Container();
  private cpuGfx = new Graphics();
  private glow: Sprite;
  private rings = new Graphics();
  private comboBar = new Graphics();
  private comboText: Text;
  private slots = new Map<number, SlotView>();
  private headers = new Map<number, Text>();
  private pulses: Pulse[] = [];
  private sparks: Spark[] = [];
  private ringList: Ring[] = [];
  private acc = new Map<number, number>();
  private signature = '';
  private camera = 0;
  private cameraTarget: number | null = null;
  private drag: { y: number; cam: number } | null = null;
  private visible = true;
  private dot: Texture;
  private state: GameState | null = null;

  private constructor(private readonly app: Application, private readonly i18n: I18n, private readonly cb: BoardCallbacks) {
    const dotG = new Graphics().circle(0, 0, 3).fill(0xffffff);
    this.dot = app.renderer.generateTexture(dotG);
    const glowG = new Graphics().circle(0, 0, 90).fill({ color: CYAN, alpha: 0.18 });
    this.glow = new Sprite(app.renderer.generateTexture(glowG));
    this.glow.anchor.set(0.5);
    this.comboText = new Text({ text: '', style: LABEL });
    this.comboText.anchor.set(0.5, 0);
    app.stage.addChild(this.bg, this.world, this.fixed);
    this.fixed.addChild(this.traces, this.glow, this.cpu, this.rings, this.comboBar, this.comboText);
    this.cpu.addChild(this.cpuGfx);
    this.buildCpu();
    this.bindPointer();
  }

  static async create(host: HTMLElement, i18n: I18n, cb: BoardCallbacks): Promise<Board> {
    const app = new Application();
    await app.init({ resizeTo: host, background: 0x0a1410, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
    host.append(app.canvas);
    app.canvas.style.touchAction = 'none';
    const board = new Board(app, i18n, cb);
    board.drawBackground();
    app.renderer.on('resize', () => board.drawBackground());
    return board;
  }

  get width(): number { return this.app.screen.width; }
  get height(): number { return this.app.screen.height; }

  setVisible(on: boolean): void { this.visible = on; this.app.canvas.style.visibility = on ? 'visible' : 'hidden'; }
  destroy(): void { this.app.destroy(true, { children: true }); }

  private drawBackground(): void {
    const g = this.bg.clear();
    g.rect(0, 0, this.width, this.height).fill(0x0d1b15);
    for (let x = 0; x < this.width; x += 20) g.moveTo(x, 0).lineTo(x, this.height);
    for (let y = 0; y < this.height; y += 20) g.moveTo(0, y).lineTo(this.width, y);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
  }

  private buildCpu(): void {
    const g = this.cpuGfx.clear();
    const s = CPU_SIZE;
    g.roundRect(-s / 2 - 14, -s / 2 - 14, s + 28, s + 28, 10).fill(0x0b120e);
    for (let y = -s / 2 - 8; y < s / 2 + 8; y += 6) for (let x = -s / 2 - 8; x < s / 2 + 8; x += 6) g.rect(x, y, 2, 2).fill({ color: 0xe8c547, alpha: 0.25 });
    g.roundRect(-s / 2, -s / 2, s, s, 12).fill(0x22262c);
    g.roundRect(-s / 2 + 12, -s / 2 + 12, s - 24, s - 24, 6).stroke({ width: 2, color: CYAN, alpha: 0.6 });
    const name = new Text({ text: 'RNC', style: { ...LABEL, fontSize: 18 } });
    name.anchor.set(0.5); name.y = -6;
    const sub = new Text({ text: 'DDR5 CTRL', style: { ...MONO, fontSize: 10, fill: 0x9aa0b4 } });
    sub.anchor.set(0.5); sub.y = 14;
    this.cpu.addChild(name, sub);
    this.cpu.eventMode = 'static';
    this.cpu.cursor = 'pointer';
    this.cpu.hitArea = { contains: (x: number, y: number) => Math.abs(x) < s * 0.8 && Math.abs(y) < s * 0.8 };
    this.cpu.on('pointerdown', e => { this.cb.onTap(e.global.x, e.global.y); });
  }

  private bindPointer(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = { contains: () => true };
    stage.on('pointerdown', e => { if (e.target === this.cpu || this.cpu.children.includes(e.target as Container)) return; this.drag = { y: e.global.y, cam: this.camera }; this.cameraTarget = null; });
    stage.on('pointermove', e => { if (this.drag) this.camera = this.clamp(this.drag.cam - (e.global.y - this.drag.y)); });
    const end = () => { this.drag = null; };
    stage.on('pointerup', end); stage.on('pointerupoutside', end);
    this.app.canvas.addEventListener('wheel', e => { this.camera = this.clamp(this.camera + e.deltaY); this.cameraTarget = null; e.preventDefault(); }, { passive: false });
  }

  private clamp(y: number): number {
    return clampCamera(y, boardHeight(this.state ? revealedCount(this.state, 0) : 0), this.height);
  }

  scrollToTier(tier: number): void {
    const r = slotRect(tier, this.width);
    this.cameraTarget = this.clamp(r.y - this.height * 0.3);
  }

  flashClick(crit: boolean): void {
    this.ringList.push({ t: 0, crit });
    const c = cpuRect(this.width, this.height);
    const n = crit ? 42 : 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * (crit ? 200 : 90);
      const sprite = new Sprite(this.dot);
      sprite.anchor.set(0.5); sprite.scale.set(0.5); sprite.tint = crit ? AMBER : 0x9ff5ec;
      sprite.position.set(c.x + c.w / 2, c.y + c.h / 2);
      this.fixed.addChild(sprite);
      this.sparks.push({ sprite, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, crit });
    }
  }

  install(tier: number): void {
    const v = this.slots.get(tier);
    if (v) v.installT = 0;
    this.scrollToTier(tier);
  }

  private rebuildSlots(state: GameState, now: number): void {
    const revealed = revealedCount(state, now);
    const all = ownedCounts(state, now, true), delivered = ownedCounts(state, now);
    const sections = sectionsToShow(revealed);
    for (const [tier, v] of this.slots) if (tier >= sections * SECTION_SIZE) { v.root.destroy({ children: true }); this.slots.delete(tier); }
    for (let s = 0; s < sections; s++) {
      if (!this.headers.has(s)) {
        const t = new Text({ text: this.i18n.t('app.board.section', { n: String.fromCharCode(65 + s) }), style: { ...LABEL, fill: 0x7a8a80, letterSpacing: 2 } });
        t.position.set(this.width / 2 - SLOT_W - 16, sectionTop(s) + 6);
        this.world.addChild(t); this.headers.set(s, t);
      }
    }
    for (let tier = 0; tier < sections * SECTION_SIZE && tier < KITS.length; tier++) {
      const kit = KITS[tier]!;
      const r = slotRect(tier, this.width);
      const isRevealed = tier < revealed || (all[kit.id] ?? 0) > 0;
      let v = this.slots.get(tier);
      if (!v) { v = { root: new Container(), kit: null, installT: 1 }; v.root.position.set(r.x, r.y); this.world.addChild(v.root); this.slots.set(tier, v); }
      v.root.removeChildren();
      v.kit = null;
      const g = new Graphics();
      if (!isRevealed) {
        for (let x = 0; x < SLOT_W; x += 8) g.moveTo(x, 0).lineTo(x + 4, 0).moveTo(x, SLOT_H).lineTo(x + 4, SLOT_H);
        for (let y = 0; y < SLOT_H; y += 8) g.moveTo(0, y).lineTo(0, y + 4).moveTo(SLOT_W, y).lineTo(SLOT_W, y + 4);
        g.stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
        v.root.addChild(g);
        continue;
      }
      g.roundRect(-3, -3, SLOT_W + 6, SLOT_H + 6, 5).fill(0x0a0e0c).stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
      g.rect(6, SLOT_H - 4, SLOT_W - 12, 2).fill({ color: 0xe8c547, alpha: 0.35 });
      v.root.addChild(g);
      const n = delivered[kit.id] ?? 0, pending = (all[kit.id] ?? 0) - n;
      if (n > 0) {
        const pal = kitColors(kit.id);
        const k = new Container();
        const stick = new Graphics().roundRect(2, 1, SLOT_W - 4, SLOT_H - 2, 3).fill(pal.c1);
        for (let x = 10; x < SLOT_W - 12; x += 9) stick.rect(x, 6, 5, 12).fill({ color: pal.c2, alpha: 0.7 });
        stick.roundRect(SLOT_W - 30, 4, 26, 16, 8).fill({ color: 0x000000, alpha: 0.55 });
        const badge = new Text({ text: 'x' + n, style: MONO }); badge.anchor.set(0.5); badge.position.set(SLOT_W - 17, 12);
        k.addChild(stick, badge);
        v.root.addChild(k); v.kit = k;
      }
      if (pending > 0) {
        const p = new Text({ text: '+' + pending, style: { ...MONO, fill: 0x9aa0b4, fontSize: 10 } });
        p.anchor.set(1, 0.5); p.position.set(n > 0 ? -8 : SLOT_W - 6, SLOT_H / 2);
        v.root.addChild(p);
      }
    }
  }

  private screenPath(tier: number): Pt[] {
    const c = cpuRect(this.width, this.height);
    const p = tracePath(tier, this.width, c.y);
    return [{ x: p[0]!.x, y: p[0]!.y - this.camera }, { x: p[1]!.x, y: p[1]!.y - this.camera }, p[2]!];
  }

  render(state: GameState, now: number, dtMs: number): void {
    this.state = state;
    if (!this.visible) return;
    const dt = Math.min(0.1, dtMs / 1000);
    const sig = slotSignature(state, now);
    if (sig !== this.signature) { this.signature = sig; this.rebuildSlots(state, now); }
    if (this.cameraTarget !== null) { this.camera += (this.cameraTarget - this.camera) * Math.min(1, dt * 8); if (Math.abs(this.cameraTarget - this.camera) < 0.5) this.cameraTarget = null; }
    this.world.y = -this.camera;

    // install animations
    for (const v of this.slots.values()) {
      if (v.kit && v.installT < 1) { v.installT = Math.min(1, v.installT + dt * 1.6); const e = 1 - v.installT; v.kit.y = -e * e * 140; v.kit.alpha = 0.4 + 0.6 * v.installT; }
      else if (v.kit) { v.kit.y = 0; v.kit.alpha = 1; }
    }

    // traces (screen space)
    const c = cpuRect(this.width, this.height);
    const revealed = revealedCount(state, now);
    const delivered = ownedCounts(state, now);
    const tr = this.traces.clear();
    for (let tier = 0; tier < Math.min(KITS.length, sectionsToShow(revealed) * SECTION_SIZE); tier++) {
      if (tier >= revealed) continue;
      const p = this.screenPath(tier);
      tr.moveTo(p[0]!.x, p[0]!.y).lineTo(p[1]!.x, p[1]!.y).lineTo(p[2]!.x, p[2]!.y).stroke({ width: 3, color: COPPER, alpha: (delivered[KITS[tier]!.id] ?? 0) ? 0.85 : 0.25 });
    }

    // pulses
    for (const { tier, rate } of pulseTargets(state, now)) {
      const a = (this.acc.get(tier) ?? 0) + rate * dt;
      if (a >= 1 && this.pulses.length < MAX_PULSES) {
        const sprite = new Sprite(this.dot); sprite.anchor.set(0.5); sprite.tint = 0x9ff5ec; sprite.alpha = 0.9;
        this.fixed.addChild(sprite); this.pulses.push({ sprite, tier, t: 0 });
        this.acc.set(tier, a - 1);
      } else this.acc.set(tier, Math.min(a, 1));
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]!; p.t += dt / 1.3;
      if (p.t >= 1) { p.sprite.destroy(); this.pulses.splice(i, 1); continue; }
      const q = pointAlong(this.screenPath(p.tier), p.t); p.sprite.position.set(q.x, q.y);
    }

    // cpu + glow
    const total = cps(state, now);
    const beat = 0.5 + 0.5 * Math.sin((now / 1000) * Math.PI * Math.min(4, 1 + total / 40));
    this.cpu.position.set(c.x + c.w / 2, c.y + c.h / 2);
    this.glow.position.copyFrom(this.cpu.position);
    this.glow.alpha = 0.5 + beat * 0.5;

    // rings and sparks
    const rg = this.rings.clear();
    for (let i = this.ringList.length - 1; i >= 0; i--) {
      const r = this.ringList[i]!; r.t += dt * 2.2;
      if (r.t >= 1) { this.ringList.splice(i, 1); continue; }
      rg.roundRect(c.x - r.t * 40, c.y - r.t * 40, c.w + r.t * 80, c.h + r.t * 80, 14 + r.t * 20).stroke({ width: 3 * (1 - r.t) + 1, color: r.crit ? AMBER : CYAN, alpha: 1 - r.t });
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!; s.t += dt;
      if (s.t > 0.7) { s.sprite.destroy(); this.sparks.splice(i, 1); continue; }
      s.sprite.x += s.vx * dt; s.sprite.y += s.vy * dt; s.vy += 260 * dt; s.sprite.alpha = 1 - s.t / 0.7;
    }

    // combo bar
    const mult = comboMult(state.combo.n), active = now - state.combo.last < 700;
    const fill = active ? Math.min(1, (state.combo.n % 10) / 10) : 0;
    const bx = c.x + c.w / 2 - 70, by = c.y + c.h + 26;
    this.comboBar.clear().roundRect(bx, by, 140, 6, 3).fill({ color: 0xffffff, alpha: 0.08 }).roundRect(bx, by, 140 * (mult >= 5 ? 1 : fill), 6, 3).fill(mult >= 5 ? AMBER : CYAN);
    this.comboText.text = `${this.i18n.t('app.board.combo')} x${mult}`;
    this.comboText.style.fill = active ? INK : 0x5d6378;
    this.comboText.position.set(c.x + c.w / 2, by + 12);
  }
}
```
Dodać `"noUnusedLocals": true` do `compilerOptions` w `apps/mobile/tsconfig.json`; typecheck musi być czysty (żadnych nieużywanych importów).

- [ ] **Step 4: Testy, typecheck i podgląd**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
```
Podgląd w przeglądarce nastąpi w zadaniu 11 (boot). Na tym etapie wystarczy typecheck i test pomocniczy.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scene/board.ts apps/mobile/test/board-sim.test.ts apps/mobile/tsconfig.json
git commit -m "feat(mobile): pixi board scene with slots, traces, pulses and click effects"
```

---

### Task 8: Katalog, zamawianie, arkusz kitu z recenzjami

**Files:**
- Create: `apps/mobile/src/data/reviews.ts`, `apps/mobile/src/ui/catalog.ts`, `apps/mobile/src/ui/kitSheet.ts`
- Modify: `apps/mobile/src/styles.css` (sekcje catalog, sheet)
- Test: `apps/mobile/test/reviews.test.ts`, `apps/mobile/test/ui/catalog.test.ts`

**Interfaces:**
- Consumes: `Session` (Task 3), `I18n`, `Fx`, `h/icon` (Task 5); z core `KITS, revealedCount, ownedCounts, copyCost, stockOf, isDelivered, fmtRP, fmtDuration, deliveryDuration, xpInfo`.
- Produces:
```ts
// reviews.ts
const RV_META: readonly { name: string; stars: number; days: number }[]   // 40 wpisów, kopia z rambuy js/data.js
function hashStr(s: string): number      // FNV-1a 32 bit, jak w rambuy js/seo-render.js
function seededReviews(kitId: string, t: (k: string) => string): { name: string; stars: number; days: number; text: string }[]  // 5 wpisów, meta = RV_META[(hash + i*11) % 40], text = t('rv.<id>.<i+1>'), posortowane po days rosnąco
// catalog.ts
class Catalog { constructor(host: HTMLElement, i18n: I18n, session: Session, fx: Fx, now: () => number, onOpenKit: (kitId: string) => void); render(state: GameState, now: number): void }
// wiersze: tiery < revealedCount plus jeden zablokowany (sylwetka "?" z app.catalog.lockedName/lockedSub i progiem fmtRP(rpCost*8)); pasek u góry "{n} on the way" gdy są niedostarczone zamówienia
// przycisk: koszt następnej kopii (copyCost z liczbą wszystkich zamówionych) + etykieta Order / Order again; disabled gdy niedostępny (title: notEnough / outOfStock)
// tap = 1 zamówienie; przytrzymanie 400 ms = kolejne co 150 ms dopóki stać; po każdym zamówieniu fx.toast(app.toast.ordered)
// kitSheet.ts
function openKitSheet(overlay: HTMLElement, i18n: I18n, kitId: string, state: GameState, now: number): void   // bottom sheet: zdjęcie, nazwa, sub, cena "{fmtRP(cost)} RP", desc, specs (speed, latency, voltage, profile), app.sheet.perKit, 5 recenzji (gwiazdki, imię, rv.daysAgo, tekst), przycisk zamknięcia; tap w tło zamyka
```

- [ ] **Step 1: Testy**

`apps/mobile/test/reviews.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS } from '@rnc/core';
import { RV_META, hashStr, seededReviews } from '../src/data/reviews';

describe('seeded reviews', () => {
  it('uses the same hash as the web game', () => {
    expect(RV_META.length).toBe(40);
    expect(hashStr('sakura')).toBe(hashStr('sakura'));
    expect(hashStr('sakura')).not.toBe(hashStr('abyss'));
    expect(hashStr('')).toBe(2166136261);
  });

  it('returns five reviews per kit sorted by days with texts from i18n keys', () => {
    const t = (k: string) => 'T:' + k;
    for (const k of KITS.slice(0, 5)) {
      const r = seededReviews(k.id, t);
      expect(r.length).toBe(5);
      expect(r.map(x => x.text).sort()).toEqual([1, 2, 3, 4, 5].map(i => `T:rv.${k.id}.${i}`).sort());
      for (let i = 1; i < r.length; i++) expect(r[i]!.days).toBeGreaterThanOrEqual(r[i - 1]!.days);
    }
  });
});
```

`apps/mobile/test/ui/catalog.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, constantRng } from '@rnc/core';
import { I18n } from '../../src/i18n/i18n';
import { Session } from '../../src/game/session';
import { MemoryStore } from '../../src/game/storage';
import { Catalog } from '../../src/ui/catalog';
import { Fx } from '../../src/ui/fx';

const en = new I18n({}, {
  'app.catalog.title': 'Parts catalog', 'app.catalog.order': 'Order', 'app.catalog.again': 'Order again', 'app.catalog.pending': '{n} on the way',
  'app.catalog.arrives': 'arrives in {time}', 'app.catalog.lockedName': 'Undiscovered kit', 'app.catalog.lockedSub': 'Reveals once your lifetime RP reaches {amount}',
  'app.catalog.owned': 'you own x{n}', 'app.catalog.notEnough': 'Not enough RP', 'app.catalog.outOfStock': 'Out of stock', 'card.prodLine': '+{n} RP/s each', 'app.toast.ordered': '{name} ordered.',
});

describe('Catalog', () => {
  it('lists revealed kits plus one locked row and orders on tap', async () => {
    const session = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    const host = document.createElement('div');
    const overlay = document.createElement('div');
    let now = 1_000;
    const opened: string[] = [];
    const cat = new Catalog(host, en, session, new Fx(overlay), () => now, id => opened.push(id));
    cat.render(session.state, now);
    const rows = host.querySelectorAll('.kit-row');
    expect(rows.length).toBe(3); // two starter kits + one locked
    expect(rows[2]!.classList.contains('locked')).toBe(true);
    const buy = rows[0]!.querySelector('button.buy') as HTMLButtonElement;
    expect(buy.disabled).toBe(false); // 128 RP buys the first brick
    buy.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    buy.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(session.state.orders.length).toBe(1);
    cat.render(session.state, now);
    expect(host.querySelector('.pending-strip')?.textContent).toContain('1 on the way');
    expect((host.querySelector('.kit-row button.buy') as HTMLButtonElement).disabled).toBe(true); // 0 RP left
    (host.querySelector('.kit-row .kit-name') as HTMLElement).click();
    expect(opened).toEqual([KITS[0]!.id]);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/data/reviews.ts`:
```ts
export interface RvMeta { name: string; stars: number; days: number }

/** Review metadata pool, identical to the web game (js/data.js RV_META). */
export const RV_META: readonly RvMeta[] = [
  { name: 'Minjun K.', stars: 5, days: 2 }, { name: 'Anna W.', stars: 5, days: 3 }, { name: 'Tomás R.', stars: 4, days: 5 }, { name: 'Yuki S.', stars: 5, days: 6 },
  { name: 'David L.', stars: 5, days: 7 }, { name: 'Ola N.', stars: 4, days: 8 }, { name: 'Chris B.', stars: 5, days: 9 }, { name: 'Hana P.', stars: 5, days: 11 },
  { name: 'Marco V.', stars: 5, days: 12 }, { name: 'Priya D.', stars: 5, days: 13 }, { name: 'Jonas F.', stars: 4, days: 14 }, { name: 'Elif A.', stars: 5, days: 16 },
  { name: 'Sam T.', stars: 5, days: 17 }, { name: 'Ingrid H.', stars: 5, days: 18 }, { name: 'Mateusz G.', stars: 5, days: 19 }, { name: 'Chloé M.', stars: 4, days: 21 },
  { name: 'Ravi P.', stars: 5, days: 22 }, { name: 'Sofia C.', stars: 5, days: 23 }, { name: 'Ben O.', stars: 5, days: 24 }, { name: 'Aiko T.', stars: 5, days: 26 },
  { name: 'Lucas M.', stars: 4, days: 27 }, { name: 'Freja L.', stars: 5, days: 28 }, { name: 'Diego S.', stars: 5, days: 29 }, { name: 'Nadia K.', stars: 5, days: 31 },
  { name: 'Ethan W.', stars: 5, days: 32 }, { name: 'Zofia B.', stars: 4, days: 33 }, { name: 'Hyun-woo J.', stars: 5, days: 34 }, { name: 'Marta P.', stars: 5, days: 36 },
  { name: 'Oscar E.', stars: 5, days: 37 }, { name: 'Léa D.', stars: 5, days: 38 }, { name: 'Piotr S.', stars: 4, days: 39 }, { name: 'Mei L.', stars: 5, days: 41 },
  { name: 'Jack R.', stars: 5, days: 42 }, { name: 'Amara O.', stars: 5, days: 43 }, { name: 'Felix N.', stars: 5, days: 44 }, { name: 'Carmen R.', stars: 4, days: 46 },
  { name: 'Taro Y.', stars: 5, days: 47 }, { name: 'Julia H.', stars: 5, days: 48 }, { name: 'Omar F.', stars: 5, days: 51 }, { name: 'Vera S.', stars: 5, days: 54 },
];

/** FNV-1a, same as the web game, so each kit keeps its familiar reviewers. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function seededReviews(kitId: string, t: (key: string) => string): (RvMeta & { text: string })[] {
  const base = hashStr(kitId);
  return [0, 1, 2, 3, 4]
    .map(i => ({ ...RV_META[(base + i * 11) % RV_META.length]!, text: t(`rv.${kitId}.${i + 1}`) }))
    .sort((a, b) => a.days - b.days);
}
```

`apps/mobile/src/ui/catalog.ts`:
```ts
import { KITS, REVEAL_MULT, copyCost, fmtDuration, fmtRP, isDelivered, ownedCounts, revealedCount, stockOf, type GameState, type KitDef } from '@rnc/core';
import type { Session } from '../game/session';
import type { I18n } from '../i18n/i18n';
import { clear, h } from './dom';
import type { Fx } from './fx';

const HOLD_DELAY_MS = 400, HOLD_REPEAT_MS = 150;

export class Catalog {
  private list: HTMLElement;
  private strip: HTMLElement;
  private signature = '';
  private lastRefresh = 0;
  private hold: { timer: number; interval: number } | null = null;

  constructor(host: HTMLElement, private readonly i18n: I18n, private readonly session: Session, private readonly fx: Fx, private readonly now: () => number, private readonly onOpenKit: (kitId: string) => void) {
    this.strip = h('div', { class: 'pending-strip mono' });
    this.list = h('div', { class: 'kit-list' });
    host.append(h('div', { class: 'catalog' }, h('h2', { class: 'display' }, i18n.t('app.catalog.title')), this.strip, this.list));
  }

  render(state: GameState, now: number): void {
    const all = ownedCounts(state, now, true);
    const pending = state.orders.filter(o => !isDelivered(o, now));
    const sig = revealedCount(state, now) + '|' + KITS.map(k => all[k.id] ?? 0).join(',') + '|' + pending.length;
    if (sig !== this.signature) { this.signature = sig; this.rebuild(state, now); }
    else if (now - this.lastRefresh > 500) this.refresh(state, now);
  }

  private pendingFor(state: GameState, kit: KitDef, now: number): { count: number; remaining: number } {
    let count = 0, remaining = Infinity;
    for (const o of state.orders) {
      if (isDelivered(o, now)) continue;
      const it = o.items.find(i => i.id === kit.id);
      if (!it) continue;
      count += it.qty;
      remaining = Math.min(remaining, o.dur - (now - o.ts) / 1000);
    }
    return { count, remaining };
  }

  private rebuild(state: GameState, now: number): void {
    this.lastRefresh = now;
    clear(this.list);
    const revealed = revealedCount(state, now);
    const all = ownedCounts(state, now, true);
    const pendingTotal = state.orders.filter(o => !isDelivered(o, now)).reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0);
    this.strip.textContent = pendingTotal ? this.i18n.t('app.catalog.pending', { n: pendingTotal }) : '';
    this.strip.hidden = !pendingTotal;
    for (let tier = 0; tier <= revealed && tier < KITS.length; tier++) {
      const kit = KITS[tier]!;
      if (tier === revealed) { this.list.append(this.lockedRow(kit)); break; }
      this.list.append(this.kitRow(kit, all[kit.id] ?? 0, state, now));
    }
  }

  private lockedRow(kit: KitDef): HTMLElement {
    return h('div', { class: 'kit-row locked' },
      h('div', { class: 'kit-thumb q display' }, '?'),
      h('div', { class: 'kit-body' }, h('div', { class: 'kit-name display' }, this.i18n.t('app.catalog.lockedName')), h('div', { class: 'kit-sub' }, this.i18n.t('app.catalog.lockedSub', { amount: fmtRP(kit.rpCost * REVEAL_MULT) }))));
  }

  private kitRow(kit: KitDef, ownedAll: number, state: GameState, now: number): HTMLElement {
    const btn = h('button', { type: 'button', class: 'buy display', 'data-kit': kit.id }) as HTMLButtonElement;
    const row = h('div', { class: 'kit-row', 'data-kit': kit.id },
      h('img', { class: 'kit-thumb', src: '/assets/kits/' + kit.img.replace('assets/', ''), alt: '', loading: 'lazy' }),
      h('div', { class: 'kit-body' },
        h('div', { class: 'kit-name display', onclick: () => this.onOpenKit(kit.id) }, kit.name),
        h('div', { class: 'kit-sub' }, kit.sub),
        h('div', { class: 'kit-stat mono' }, h('span', {}, this.i18n.t('card.prodLine', { n: kit.rpProd })), h('span', { class: 'kit-owned' }), h('span', { class: 'kit-pending' })),
      ),
      btn);
    this.bindHold(btn, kit);
    this.fillRow(row, kit, ownedAll, state, now);
    return row;
  }

  private fillRow(row: HTMLElement, kit: KitDef, ownedAll: number, state: GameState, now: number): void {
    const btn = row.querySelector('button.buy') as HTMLButtonElement;
    const cost = copyCost(kit, ownedAll);
    const inStock = stockOf(kit, ownedAll) > 0;
    const can = inStock && state.rp >= cost;
    btn.disabled = !can;
    btn.title = can ? '' : this.i18n.t(inStock ? 'app.catalog.notEnough' : 'app.catalog.outOfStock');
    btn.replaceChildren(h('span', {}, this.i18n.t(ownedAll ? 'app.catalog.again' : 'app.catalog.order')), h('small', { class: 'mono' }, fmtRP(cost) + ' RP'));
    (row.querySelector('.kit-owned') as HTMLElement).textContent = ownedAll ? ' · ' + this.i18n.t('app.catalog.owned', { n: ownedAll }) : '';
    const p = this.pendingFor(state, kit, now);
    (row.querySelector('.kit-pending') as HTMLElement).textContent = p.count ? ' · ' + this.i18n.t('app.catalog.arrives', { time: fmtDuration(Math.max(0, p.remaining)) }) : '';
  }

  private refresh(state: GameState, now: number): void {
    this.lastRefresh = now;
    const all = ownedCounts(state, now, true);
    for (const row of this.list.querySelectorAll<HTMLElement>('.kit-row[data-kit]')) {
      const kit = KITS.find(k => k.id === row.dataset.kit);
      if (kit) this.fillRow(row, kit, all[kit.id] ?? 0, state, now);
    }
  }

  private order(kit: KitDef): boolean {
    const now = this.now();
    const r = this.session.buy(kit.id, 1, now, new Date(now).getHours());
    if (r.ok) this.fx.toast(this.i18n.t('app.toast.ordered', { name: kit.name }));
    return r.ok;
  }

  private bindHold(btn: HTMLButtonElement, kit: KitDef): void {
    const stop = () => { if (this.hold) { clearTimeout(this.hold.timer); clearInterval(this.hold.interval); this.hold = null; } };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (btn.disabled) return;
      stop();
      let fired = false;
      const timer = window.setTimeout(() => { fired = true; }, HOLD_DELAY_MS);
      const interval = window.setInterval(() => { if (fired && !this.order(kit)) stop(); }, HOLD_REPEAT_MS);
      this.hold = { timer, interval };
      const up = () => { const wasHeld = fired; stop(); if (!wasHeld) this.order(kit); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up); btn.removeEventListener('pointerleave', up); };
      btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
    });
  }
}
```

`apps/mobile/src/ui/kitSheet.ts`:
```ts
import { copyCost, fmtRP, kitById, ownedCounts, type GameState } from '@rnc/core';
import { seededReviews } from '../data/reviews';
import type { I18n } from '../i18n/i18n';
import { h, icon } from './dom';

export function openKitSheet(overlay: HTMLElement, i18n: I18n, kitId: string, state: GameState, now: number): void {
  const kit = kitById(kitId);
  const ownedAll = ownedCounts(state, now, true)[kit.id] ?? 0;
  const close = () => veil.remove();
  const stars = (n: number) => h('span', { class: 'stars' }, ...Array.from({ length: n }, () => icon('star', 12)));
  const reviews = seededReviews(kit.id, k => i18n.t(k));
  const veil = h('div', { class: 'veil', onclick: (e: Event) => { if (e.target === veil) close(); } },
    h('div', { class: 'sheet' },
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': i18n.t('app.sheet.close'), onclick: close }, icon('x', 20)),
      h('img', { class: 'sheet-img', src: '/assets/kits/' + kit.img.replace('assets/', ''), alt: kit.name }),
      h('h2', { class: 'display' }, kit.name),
      h('p', { class: 'sheet-sub mono' }, kit.sub, ' · ', fmtRP(copyCost(kit, ownedAll)), ' RP'),
      h('p', { class: 'sheet-desc' }, kit.desc),
      h('h3', { class: 'display' }, i18n.t('app.sheet.specs')),
      h('dl', { class: 'specs mono' },
        h('dt', {}, i18n.t('pdp.speed')), h('dd', {}, kit.speed), h('dt', {}, i18n.t('pdp.latency')), h('dd', {}, kit.latency),
        h('dt', {}, i18n.t('pdp.voltage')), h('dd', {}, kit.voltage), h('dt', {}, i18n.t('pdp.profile')), h('dd', {}, kit.profile)),
      h('p', { class: 'sheet-prod mono' }, i18n.t('app.sheet.perKit', { n: kit.rpProd })),
      h('h3', { class: 'display' }, i18n.t('app.sheet.reviews')),
      ...reviews.map(r => h('div', { class: 'review' }, h('div', { class: 'review-head' }, stars(r.stars), h('b', {}, r.name), h('span', { class: 'review-date' }, i18n.t('rv.daysAgo', { n: r.days }))), h('p', {}, r.text))),
    ));
  overlay.append(veil);
}
```

Dopisać do `apps/mobile/src/styles.css`:
```css
/* catalog */
.catalog { height: 100%; overflow-y: auto; padding: 6px 14px calc(var(--safe-bottom) + 20px); display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
.catalog h2 { font-size: 18px; font-weight: 600; margin: 6px 4px 2px; }
.pending-strip { font-size: 12px; color: var(--amber); padding: 0 4px; }
.kit-list { display: flex; flex-direction: column; gap: 10px; }
.kit-row { display: grid; grid-template-columns: 60px 1fr auto; gap: 12px; align-items: center; padding: 10px; border-radius: 18px; background: rgba(255,255,255,.04); border: 1px solid var(--line); }
.kit-row.locked { opacity: .5; grid-template-columns: 60px 1fr; }
.kit-thumb { width: 60px; height: 60px; border-radius: 12px; background: #fff; object-fit: cover; display: block; }
.kit-thumb.q { display: grid; place-items: center; background: rgba(255,255,255,.08); color: var(--ink-3); font-size: 20px; font-weight: 700; }
.kit-name { font-weight: 600; font-size: 15px; line-height: 1.15; cursor: pointer; }
.kit-sub { font-size: 12px; color: var(--ink-3); margin-top: 2px; }
.kit-stat { font-size: 12px; color: var(--accent); margin-top: 4px; }
.kit-owned, .kit-pending { color: var(--ink-2); }
.buy { min-width: 44px; min-height: 44px; padding: 0 14px; border-radius: 14px; border: 0; background: var(--accent); color: #06201d; font-weight: 700; font-size: 13px; letter-spacing: .04em; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; touch-action: none; }
.buy small { font-size: 11px; opacity: .8; }
.buy:disabled { background: rgba(255,255,255,.08); color: var(--ink-3); }
/* sheet */
.veil { position: absolute; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: flex-end; animation: veilIn .2s ease; }
@keyframes veilIn { from { opacity: 0; } }
.sheet { position: relative; width: 100%; max-height: 88%; overflow-y: auto; background: #0e1a15; border-radius: 24px 24px 0 0; padding: 18px 18px calc(var(--safe-bottom) + 24px); animation: sheetIn .3s cubic-bezier(.2,.9,.3,1.1); }
@keyframes sheetIn { from { transform: translateY(40px); opacity: 0; } }
.sheet-close { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,.08); color: var(--ink); display: grid; place-items: center; }
.sheet-img { width: 160px; height: 160px; border-radius: 16px; background: #fff; object-fit: cover; display: block; margin: 0 auto 12px; }
.sheet h2 { margin: 0 0 4px; font-size: 22px; }
.sheet h3 { margin: 16px 0 6px; font-size: 13px; letter-spacing: .1em; color: var(--ink-2); text-transform: uppercase; }
.sheet-sub { margin: 0; color: var(--ink-2); font-size: 12px; }
.sheet-desc { color: var(--ink-2); font-size: 14px; line-height: 1.5; }
.specs { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 12px; margin: 0; }
.specs dt { color: var(--ink-3); } .specs dd { margin: 0; }
.sheet-prod { font-size: 12px; color: var(--accent); }
.review { padding: 10px 0; border-top: 1px solid var(--line); }
.review-head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); }
.review-head b { color: var(--ink); font-weight: 600; }
.stars { color: var(--amber); display: inline-flex; }
.review p { margin: 6px 0 0; font-size: 14px; line-height: 1.45; }
```

- [ ] **Step 4: Testy zielone**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/data/reviews.ts apps/mobile/src/ui/catalog.ts apps/mobile/src/ui/kitSheet.ts apps/mobile/src/styles.css apps/mobile/test/reviews.test.ts apps/mobile/test/ui/catalog.test.ts
git commit -m "feat(mobile): catalog with hold-to-order and kit sheet with seeded reviews"
```

---

### Task 9: Profil (minimalny)

**Files:**
- Create: `apps/mobile/src/ui/profile.ts`
- Modify: `apps/mobile/src/styles.css` (sekcja profile)
- Test: `apps/mobile/test/ui/profile.test.ts`

**Interfaces:**
- Consumes: `Session`, `I18n`, `LANGS`; z core `cps, xpInfo, gbOwned, milestoneIndex, GB_MILESTONES, fmtRP, deliveryDuration, fmtDuration, ownedCounts`.
- Produces: `class Profile { constructor(host: HTMLElement, i18n: I18n, session: Session, lang: Lang, onLang: (lang: Lang) => void); render(state: GameState, now: number): void }`
  - kafelki: balance, production (/s), lifetime, memory (GB) z tekstem kolejnego kamienia (`app.profile.nextMs` z `gb` i `ms.<gb>` z i18n jako `what` w toście, tu tylko `gb`) albo `app.profile.msDone`; poziom z paskiem XP i czasem dostawy; `select` języka (11 opcji, wartość bieżąca); przycisk "Clear progress" wymagający dwóch tapnięć w ciągu 4 s (drugi tap: `session.reset(now)`, toast `app.profile.cleared` przez `fx` przekazany... uproszczenie: Profile dostaje `fx: Fx` jako dodatkowy argument konstruktora po `session`).

- [ ] **Step 1: Test**

`apps/mobile/test/ui/profile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { constantRng } from '@rnc/core';
import { I18n } from '../../src/i18n/i18n';
import { Session } from '../../src/game/session';
import { MemoryStore } from '../../src/game/storage';
import { Fx } from '../../src/ui/fx';
import { Profile } from '../../src/ui/profile';

const en = new I18n({}, { 'app.profile.title': 'Profile', 'app.profile.level': 'Level {n}', 'app.profile.balance': 'Balance', 'app.profile.production': 'Production', 'app.profile.lifetime': 'Lifetime RP', 'app.profile.memory': 'Memory delivered', 'app.profile.nextMs': 'Next milestone at {gb} GB: production +15%', 'app.profile.msDone': 'Every milestone reached', 'app.profile.language': 'Language', 'app.profile.clear': 'Clear progress', 'app.profile.clearConfirm': 'Tap again to wipe everything', 'app.profile.cleared': 'Progress cleared.' });

describe('Profile', () => {
  it('shows tiles, switches language and clears progress on the second tap', async () => {
    const session = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    session.state.rp = 5000;
    const host = document.createElement('div');
    const langs: string[] = [];
    const p = new Profile(host, en, session, new Fx(document.createElement('div')), 'pl', l => langs.push(l));
    p.render(session.state, 1000);
    expect(host.querySelector('[data-tile="balance"] .tile-v')?.textContent).toBe('5.00K');
    expect(host.querySelector('[data-tile="memory"] .tile-s')?.textContent).toContain('16 GB');
    const sel = host.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('pl');
    sel.value = 'de'; sel.dispatchEvent(new Event('change'));
    expect(langs).toEqual(['de']);
    const clear = host.querySelector('button.clear') as HTMLButtonElement;
    clear.click();
    expect(clear.textContent).toBe('Tap again to wipe everything');
    clear.click();
    await new Promise(r => setTimeout(r, 0));
    expect(session.state.rp).toBe(128);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/ui/profile.ts`:
```ts
import { GB_MILESTONES, cps, deliveryDuration, fmtDuration, fmtRP, gbOwned, milestoneIndex, xpInfo, type GameState } from '@rnc/core';
import type { Session } from '../game/session';
import { LANGS, type I18n, type Lang } from '../i18n/i18n';
import { h } from './dom';
import type { Fx } from './fx';

const CONFIRM_MS = 4000;

export class Profile {
  private tiles = new Map<string, { v: HTMLElement; s: HTMLElement }>();
  private level: HTMLElement; private xpBar: HTMLElement; private delivery: HTMLElement; private clearBtn: HTMLButtonElement;
  private armedAt = 0;

  constructor(host: HTMLElement, private readonly i18n: I18n, private readonly session: Session, private readonly fx: Fx, lang: Lang, onLang: (lang: Lang) => void) {
    const tile = (id: string, label: string) => {
      const v = h('div', { class: 'tile-v mono' }), s = h('div', { class: 'tile-s' });
      this.tiles.set(id, { v, s });
      return h('div', { class: 'tile', 'data-tile': id }, h('div', { class: 'tile-l display' }, label), v, s);
    };
    this.level = h('div', { class: 'display level-t' });
    this.xpBar = h('div', { class: 'xp-fill' });
    this.delivery = h('div', { class: 'level-s mono' });
    const select = h('select', { class: 'lang', onchange: (e: Event) => onLang((e.target as HTMLSelectElement).value as Lang) }, ...LANGS.map(l => h('option', { value: l }, l)));
    select.value = lang;
    this.clearBtn = h('button', { type: 'button', class: 'clear display', onclick: () => this.onClear() }, i18n.t('app.profile.clear')) as HTMLButtonElement;
    host.append(h('div', { class: 'profile' },
      h('h2', { class: 'display' }, i18n.t('app.profile.title')),
      h('div', { class: 'level-card' }, this.level, h('div', { class: 'xp-bar' }, this.xpBar), this.delivery),
      h('div', { class: 'tiles' }, tile('balance', i18n.t('app.profile.balance')), tile('production', i18n.t('app.profile.production')), tile('lifetime', i18n.t('app.profile.lifetime')), tile('memory', i18n.t('app.profile.memory'))),
      h('label', { class: 'lang-row' }, h('span', {}, i18n.t('app.profile.language')), select),
      this.clearBtn));
  }

  render(state: GameState, now: number): void {
    const set = (id: string, v: string, s = '') => { const t = this.tiles.get(id)!; t.v.textContent = v; t.s.textContent = s; };
    const xp = xpInfo(state.xpTotal);
    this.level.textContent = this.i18n.t('app.profile.level', { n: xp.lvl });
    this.xpBar.style.width = (Math.min(1, xp.cur / xp.need) * 100).toFixed(1) + '%';
    this.delivery.textContent = fmtDuration(deliveryDuration(xp.lvl));
    set('balance', fmtRP(state.rp));
    set('production', fmtRP(cps(state, now)) + '/s');
    set('lifetime', fmtRP(state.xpTotal));
    const gb = gbOwned(state, now), idx = milestoneIndex(gb), next = GB_MILESTONES[idx];
    set('memory', gb.toLocaleString('en-US') + ' GB', next === undefined ? this.i18n.t('app.profile.msDone') : this.i18n.t('app.profile.nextMs', { gb: next.toLocaleString('en-US') }));
    if (this.armedAt && now - this.armedAt > CONFIRM_MS) this.disarm();
  }

  private onClear(): void {
    if (!this.armedAt) { this.armedAt = Date.now(); this.clearBtn.textContent = this.i18n.t('app.profile.clearConfirm'); this.clearBtn.classList.add('armed'); return; }
    this.disarm();
    void this.session.reset(Date.now()).then(() => this.fx.toast(this.i18n.t('app.profile.cleared')));
  }

  private disarm(): void { this.armedAt = 0; this.clearBtn.textContent = this.i18n.t('app.profile.clear'); this.clearBtn.classList.remove('armed'); }
}
```

Dopisać do `apps/mobile/src/styles.css`:
```css
/* profile */
.profile { height: 100%; overflow-y: auto; padding: 6px 14px calc(var(--safe-bottom) + 20px); display: flex; flex-direction: column; gap: 12px; background: var(--bg); }
.profile h2 { font-size: 18px; font-weight: 600; margin: 6px 4px 2px; }
.level-card { padding: 14px; border-radius: 18px; background: rgba(255,255,255,.04); border: 1px solid var(--line); }
.level-t { font-size: 20px; font-weight: 700; }
.xp-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); margin: 8px 0 6px; overflow: hidden; }
.xp-fill { height: 100%; background: var(--accent); width: 0; transition: width .3s; }
.level-s { font-size: 12px; color: var(--ink-3); }
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.tile { padding: 12px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid var(--line); }
.tile-l { font-size: 10px; letter-spacing: .12em; color: var(--ink-2); text-transform: uppercase; }
.tile-v { font-size: 20px; font-weight: 600; margin-top: 4px; }
.tile-s { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
.lang-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,.04); border: 1px solid var(--line); font-size: 14px; }
.lang { min-height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); padding: 0 10px; font-family: var(--font-mono); }
.clear { min-height: 44px; border-radius: 14px; border: 1px solid rgba(255,107,107,.4); background: transparent; color: var(--danger); font-weight: 600; margin-top: auto; }
.clear.armed { background: var(--danger); color: #fff; }
```

- [ ] **Step 4: Testy zielone, commit**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
git add apps/mobile/src/ui/profile.ts apps/mobile/src/styles.css apps/mobile/test/ui/profile.test.ts
git commit -m "feat(mobile): minimal profile with tiles, language switch and progress reset"
```

---
### Task 10: Cinematik odkrycia, toasty poziomu i kamienia, dźwięki

**Files:**
- Create: `apps/mobile/src/ui/cinematic.ts`, `apps/mobile/src/audio/sfx.ts`
- Modify: `apps/mobile/src/styles.css` (sekcja reveal)
- Test: `apps/mobile/test/ui/cinematic.test.ts`

**Interfaces:**
- Consumes: `I18n`, `h/icon`, `Fx`; z core `KITS, xpInfo, deliveryDuration, fmtDuration, fmtRP`.
- Produces:
```ts
// cinematic.ts
function revealCinematic(overlay: HTMLElement, i18n: I18n, tier: number, extra: number, onClose?: () => void): HTMLElement
// pełnoekranowa nakładka: poświata, 8 iskier, zdjęcie kitu, eyebrow app.reveal.eyebrow, nazwa, "+n more" gdy extra > 0; auto-zamknięcie po 3200 ms (przy prefers-reduced-motion 1200 ms), tap zamyka; pierwsze 600 ms nie łapie tapnięć (spam klików w procesor nie zamyka)
function levelUpToast(fx: Fx, i18n: I18n, lvl: number): void          // app.toast.levelUp z czasem dostawy fmtDuration(deliveryDuration(lvl))
function milestoneToast(fx: Fx, i18n: I18n, gb: number): void         // app.toast.milestone z what = i18n.t('ms.' + gb)
function awayToast(fx: Fx, i18n: I18n, amount: number): void          // app.toast.away z fmtRP(amount)
// sfx.ts (port z rambuy: triangle + obwiednia)
class Sfx { enabled: boolean; tick(pitchUp?: number): void; pop(): void; success(): void; reveal(): void }
// AudioContext tworzony leniwie przy pierwszym dźwięku (po geście użytkownika); każda metoda w try/catch
```

- [ ] **Step 1: Test**

`apps/mobile/test/ui/cinematic.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { I18n } from '../../src/i18n/i18n';
import { revealCinematic, levelUpToast, milestoneToast } from '../../src/ui/cinematic';
import { Fx } from '../../src/ui/fx';

const en = new I18n({}, { 'app.reveal.eyebrow': 'New kit discovered', 'app.reveal.more': '+{n} more', 'app.toast.levelUp': 'Level {n}: deliveries now take {time}', 'app.toast.milestone': 'Milestone: {what}', 'ms.32': 'a serious gaming PC (32 GB)' });

describe('cinematic', () => {
  it('shows the kit, the extra count, and closes on tap after the grace period', () => {
    vi.useFakeTimers();
    const overlay = document.createElement('div');
    let closed = 0;
    const el = revealCinematic(overlay, en, 1, 2, () => closed++);
    expect(el.querySelector('.kr-name')?.textContent).toBe('Sakura Kit');
    expect(el.querySelector('.kr-more')?.textContent).toBe('+2 more');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/assets/kits/ram-sakura.webp');
    el.click();
    expect(closed).toBe(0); // grace period
    vi.advanceTimersByTime(700);
    el.click();
    expect(closed).toBe(1);
    vi.advanceTimersByTime(400);
    expect(overlay.contains(el)).toBe(false);
    vi.useRealTimers();
  });

  it('auto-closes', () => {
    vi.useFakeTimers();
    const overlay = document.createElement('div');
    const el = revealCinematic(overlay, en, 0, 0);
    vi.advanceTimersByTime(3200 + 400);
    expect(overlay.contains(el)).toBe(false);
    vi.useRealTimers();
  });

  it('formats level and milestone toasts', () => {
    const host = document.createElement('div');
    const fx = new Fx(host);
    levelUpToast(fx, en, 2);
    milestoneToast(fx, en, 32);
    const toasts = host.querySelectorAll('.toastx');
    expect(toasts[0]?.textContent).toBe('Level 2: deliveries now take 9m 39s');
    expect(toasts[1]?.textContent).toBe('Milestone: a serious gaming PC (32 GB)');
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/ui/cinematic.ts`:
```ts
import { KITS, deliveryDuration, fmtDuration, fmtRP } from '@rnc/core';
import type { I18n } from '../i18n/i18n';
import { h, icon } from './dom';
import type { Fx } from './fx';

const GRACE_MS = 600;
const TTL_MS = 3200, TTL_REDUCED_MS = 1200, OUT_MS = 350;

export function revealCinematic(overlay: HTMLElement, i18n: I18n, tier: number, extra: number, onClose?: () => void): HTMLElement {
  overlay.querySelector('.kit-reveal')?.remove();
  const kit = KITS[Math.max(0, Math.min(KITS.length - 1, tier))]!;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ttl = reduced ? TTL_REDUCED_MS : TTL_MS;
  let closing = false;
  const el = h('div', { class: 'kit-reveal kr-passthrough' },
    h('div', { class: 'kr-card' },
      h('div', { class: 'kr-glow' }),
      ...Array.from({ length: 8 }, (_, i) => h('i', { class: 'kr-spark s' + i })),
      h('div', { class: 'kr-img' }, h('img', { src: '/assets/kits/' + kit.img.replace('assets/', ''), alt: kit.name, draggable: 'false' })),
      h('span', { class: 'kr-eyebrow display' }, icon('sparkles', 12), ' ', i18n.t('app.reveal.eyebrow')),
      h('b', { class: 'kr-name display' }, kit.name),
      extra > 0 ? h('span', { class: 'kr-more mono' }, i18n.t('app.reveal.more', { n: extra })) : null,
      h('i', { class: 'kr-timer' })));
  el.style.setProperty('--kr-ttl', ttl + 'ms');
  const close = () => {
    if (closing) return;
    closing = true;
    clearTimeout(timer);
    el.classList.add('kr-out');
    onClose?.();
    setTimeout(() => el.remove(), OUT_MS);
  };
  const timer = setTimeout(close, ttl);
  setTimeout(() => el.classList.remove('kr-passthrough'), GRACE_MS);
  el.addEventListener('click', () => { if (!el.classList.contains('kr-passthrough')) close(); });
  overlay.append(el);
  return el;
}

export function levelUpToast(fx: Fx, i18n: I18n, lvl: number): void {
  fx.toast(i18n.t('app.toast.levelUp', { n: lvl, time: fmtDuration(deliveryDuration(lvl)) }));
}

export function milestoneToast(fx: Fx, i18n: I18n, gb: number): void {
  fx.toast(i18n.t('app.toast.milestone', { what: i18n.t('ms.' + gb) }));
}

export function awayToast(fx: Fx, i18n: I18n, amount: number): void {
  fx.toast(i18n.t('app.toast.away', { amount: fmtRP(amount) }), 4000);
}
```

`apps/mobile/src/audio/sfx.ts`:
```ts
/** Tiny synth, ported from the web game: triangle oscillator with a short envelope. */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private note(freq: number, when: number, dur: number, vol: number): void {
    const ctx = this.context();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(when); o.stop(when + dur + 0.05);
  }

  private play(fn: (t0: number) => void): void {
    if (!this.enabled) return;
    try { fn(this.context().currentTime); } catch { /* audio unavailable */ }
  }

  tick(pitchUp = 0): void { this.play(t0 => this.note(1150 + pitchUp, t0, 0.045, 0.05)); }
  pop(): void { this.play(t0 => { this.note(560, t0, 0.09, 0.09); this.note(840, t0 + 0.055, 0.1, 0.07); }); }
  success(): void { this.play(t0 => [523, 659, 784].forEach((f, i) => this.note(f, t0 + i * 0.09, 0.22, 0.07))); }
  reveal(): void {
    this.play(t0 => {
      this.note(262, t0, 0.8, 0.035);
      [523, 659, 784, 1047].forEach((f, i) => this.note(f, t0 + 0.06 + i * 0.085, 0.32, 0.055));
      this.note(1319, t0 + 0.46, 0.16, 0.045);
      this.note(1568, t0 + 0.55, 0.2, 0.04);
    });
  }
}
```

Dopisać do `apps/mobile/src/styles.css`:
```css
/* reveal cinematic */
.kit-reveal { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(4,8,6,.86); backdrop-filter: blur(8px); animation: krFadeIn .3s ease; }
.kit-reveal.kr-passthrough { pointer-events: none; }
.kit-reveal.kr-out { animation: krFadeOut .35s ease forwards; }
@keyframes krFadeIn { from { opacity: 0; } } @keyframes krFadeOut { to { opacity: 0; } }
.kr-card { position: relative; width: min(78vw, 300px); display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; animation: krCardIn .6s cubic-bezier(.2,.9,.3,1.2); }
@keyframes krCardIn { from { transform: scale(.6) translateY(30px); opacity: 0; } }
.kr-glow { position: absolute; inset: -40px; border-radius: 50%; background: radial-gradient(circle, rgba(76,224,210,.35), transparent 70%); animation: krPulse 1.6s ease-in-out infinite; }
@keyframes krPulse { 50% { transform: scale(1.12); opacity: .7; } }
.kr-img { width: 100%; border-radius: 20px; overflow: hidden; background: #fff; box-shadow: 0 30px 80px rgba(0,0,0,.6); position: relative; }
.kr-img img { display: block; width: 100%; animation: krDevelop .9s ease .15s backwards; }
@keyframes krDevelop { from { filter: brightness(3) contrast(0); } }
.kr-eyebrow { margin-top: 10px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); display: inline-flex; align-items: center; gap: 4px; }
.kr-name { font-size: 24px; font-weight: 700; color: var(--ink); }
.kr-more { font-size: 12px; color: var(--ink-2); }
.kr-timer { position: absolute; left: 0; bottom: -18px; height: 2px; width: 100%; background: var(--accent); transform-origin: left; animation: krTimer var(--kr-ttl, 3200ms) linear forwards; }
@keyframes krTimer { to { transform: scaleX(0); } }
.kr-spark { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; border-radius: 50%; background: #fff; opacity: 0; }
.kr-spark.s0 { animation: krSpark 1.5s ease .5s infinite; --dx: -150px; --dy: -120px; } .kr-spark.s1 { animation: krSpark 1.7s ease .8s infinite; --dx: 160px; --dy: -90px; }
.kr-spark.s2 { animation: krSpark 1.4s ease .65s infinite; --dx: -180px; --dy: 40px; } .kr-spark.s3 { animation: krSpark 1.8s ease 1s infinite; --dx: 190px; --dy: 70px; }
.kr-spark.s4 { animation: krSpark 1.6s ease .9s infinite; --dx: -90px; --dy: -170px; } .kr-spark.s5 { animation: krSpark 1.5s ease 1.15s infinite; --dx: 110px; --dy: -160px; }
.kr-spark.s6 { animation: krSpark 1.7s ease .7s infinite; --dx: -60px; --dy: 150px; } .kr-spark.s7 { animation: krSpark 1.6s ease 1.3s infinite; --dx: 80px; --dy: 140px; }
@keyframes krSpark { 0% { opacity: 0; transform: translate(0, 0) scale(.5); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0); } }
```

- [ ] **Step 4: Testy zielone, commit**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
git add apps/mobile/src/ui/cinematic.ts apps/mobile/src/audio/sfx.ts apps/mobile/src/styles.css apps/mobile/test/ui/cinematic.test.ts
git commit -m "feat(mobile): reveal cinematic, level and milestone toasts, synth sfx"
```

---

### Task 11: Boot aplikacji, ekrany, konsola debug

**Files:**
- Modify: `apps/mobile/src/main.ts` (pełny boot)
- Create: `apps/mobile/src/app.ts` (składanie UI), `apps/mobile/src/debug/console.ts`
- Test: `apps/mobile/test/ui/app.test.ts` (składanie ekranów bez sceny WebGL: `Board` wstrzykiwany jako atrapa)

**Interfaces:**
- Consumes: wszystko z zadań 3-10.
- Produces:
```ts
// app.ts
interface BoardLike { render(state: GameState, now: number, dtMs: number): void; flashClick(crit: boolean): void; install(tier: number): void; scrollToTier(tier: number): void; setVisible(on: boolean): void }
interface AppDeps { root: HTMLElement; i18n: I18n; session: Session; board: BoardLike; sfx: Sfx; lang: Lang; now: () => number; onLang: (l: Lang) => void }
class App {
  constructor(deps: AppDeps)
  frame(now: number, dtMs: number): void      // session.advance(now); render aktywnego ekranu; hud; tabs; scena gdy zakładka world
  showTab(id: TabId): void                    // world: scena widoczna, #screens ukryte; inne: ekran w #screens (catalog / profile / locked(cases|market))
  onTap(x: number, y: number): void           // session.click -> fx.fly na (x, y), board.flashClick, sfx.tick(min(combo*12, 500)) / crit: sfx.pop + fx.shake(root)
}
// zdarzenia sesji podpięte w konstruktorze:
//  'tick' i 'resume': newReveals > 0 -> revealCinematic(overlay, i18n, state.revealSeen - 1, newReveals - 1) + sfx.reveal() + board.scrollToTier; milestone !== null -> milestoneToast + sfx.success
//  'resume': offline > 0 -> awayToast
//  'order': board.install(tier kitu), po dostarczeniu scena sama odświeży (sygnatura)
//  poziom: App pamięta ostatni lvl; gdy xpInfo(...).lvl rośnie -> levelUpToast + sfx.success + tabs.render
// console.ts
function installDebug(win: Window & typeof globalThis, ctx: { session: Session; app: App; board: BoardLike; i18n: I18n; now: () => number }): void
// win.rnc = {
//   state: () => session.state,
//   cheat: (code: 'rp' | 'lvl' | 'unlockall', n?: number) => void   // rp: state.rp += n; lvl: state.xpTotal = max(xpTotal, 50*2^n); unlockall: xpTotal = max(xpTotal, KITS[58].rpCost * 8)
//   revealCinematic: (tier: number, extra = 0) => void,
//   toast: (text: string) => void,
//   install: (tier: number) => void,
//   tab: (id: TabId) => void,
//   save: () => Promise<boolean>   // session.maybeSave(now(), true)
// }
```

- [ ] **Step 1: Test składania**

`apps/mobile/test/ui/app.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, constantRng } from '@rnc/core';
import { App } from '../../src/app';
import { Sfx } from '../../src/audio/sfx';
import { Session } from '../../src/game/session';
import { MemoryStore } from '../../src/game/storage';
import { I18n } from '../../src/i18n/i18n';
import { installDebug } from '../../src/debug/console';

function shell() {
  const root = document.createElement('div');
  root.innerHTML = '<header id="hud"></header><main id="scene"></main><section id="screens"></section><nav id="tabs"></nav><div id="overlay"></div>';
  return root;
}
const fakeBoard = () => { const calls: string[] = []; return { calls, render() { calls.push('render'); }, flashClick(c: boolean) { calls.push('flash:' + c); }, install(t: number) { calls.push('install:' + t); }, scrollToTier(t: number) { calls.push('scroll:' + t); }, setVisible(on: boolean) { calls.push('visible:' + on); } }; };

describe('App', () => {
  it('switches tabs, clicks through the session and reacts to orders and reveals', async () => {
    const session = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    const board = fakeBoard();
    const root = shell();
    let now = 1000;
    const i18n = new I18n({}, {});
    const sfx = new Sfx(); sfx.enabled = false;
    const app = new App({ root, i18n, session, board, sfx, lang: 'en', now: () => now, onLang: () => {} });
    app.frame(now, 16);
    expect(board.calls).toContain('render');
    app.onTap(50, 60);
    expect(session.state.stats.clicks).toBe(1);
    expect(root.querySelector('#overlay .fly')).not.toBeNull();
    expect(board.calls.some(c => c.startsWith('flash:'))).toBe(true);
    app.showTab('catalog');
    expect(root.querySelector('#screens')!.classList.contains('on')).toBe(true);
    expect(board.calls).toContain('visible:false');
    session.state.rp = 1000;
    app.frame(now, 16);
    (root.querySelector('#screens button.buy') as HTMLButtonElement).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    (root.querySelector('#screens button.buy') as HTMLButtonElement).dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(board.calls).toContain('install:0');
    app.showTab('cases');
    expect(root.querySelector('#screens .locked-screen')).not.toBeNull();
    session.state.xpTotal = KITS[2]!.rpCost * 8;
    now += 100; app.frame(now, 100);
    expect(root.querySelector('#overlay .kit-reveal .kr-name')?.textContent).toBe(KITS[2]!.name);
  });

  it('exposes console helpers', async () => {
    const session = await Session.boot(new MemoryStore(), 0, constantRng(0.5));
    const board = fakeBoard();
    const root = shell();
    const app = new App({ root, i18n: new I18n({}, {}), session, board, sfx: Object.assign(new Sfx(), { enabled: false }), lang: 'en', now: () => 5000, onLang: () => {} });
    const win = { } as Window & typeof globalThis & { rnc?: { cheat: (c: string, n?: number) => void; state: () => { rp: number } } };
    installDebug(win, { session, app, board, i18n: new I18n({}, {}), now: () => 5000 });
    win.rnc!.cheat('rp', 500);
    expect(win.rnc!.state().rp).toBe(628);
    win.rnc!.cheat('unlockall');
    app.frame(5100, 100);
    expect(root.querySelector('#overlay .kit-reveal')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`apps/mobile/src/app.ts`:
```ts
import { KITS, comboMult, featureUnlocked, fmtRP, kitById, xpInfo, type GameState } from '@rnc/core';
import type { Sfx } from './audio/sfx';
import type { Session } from './game/session';
import type { I18n, Lang } from './i18n/i18n';
import { Catalog } from './ui/catalog';
import { awayToast, levelUpToast, milestoneToast, revealCinematic } from './ui/cinematic';
import { clear, h } from './ui/dom';
import { Fx } from './ui/fx';
import { Hud } from './ui/hud';
import { openKitSheet } from './ui/kitSheet';
import { lockedScreen } from './ui/locked';
import { Profile } from './ui/profile';
import { TAB_FEATURE, Tabs, type TabId } from './ui/tabs';

export interface BoardLike {
  render(state: GameState, now: number, dtMs: number): void;
  flashClick(crit: boolean): void;
  install(tier: number): void;
  scrollToTier(tier: number): void;
  setVisible(on: boolean): void;
}

export interface AppDeps { root: HTMLElement; i18n: I18n; session: Session; board: BoardLike; sfx: Sfx; lang: Lang; now: () => number; onLang: (l: Lang) => void }

export class App {
  readonly fx: Fx;
  readonly tabs: Tabs;
  private hud: Hud;
  private catalog: Catalog;
  private profile: Profile;
  private screens: HTMLElement;
  private overlay: HTMLElement;
  private catalogHost = document.createElement('div');
  private profileHost = document.createElement('div');
  private lastLvl: number;

  constructor(private readonly d: AppDeps) {
    const q = (id: string) => d.root.querySelector<HTMLElement>('#' + id)!;
    this.screens = q('screens'); this.overlay = q('overlay');
    this.fx = new Fx(this.overlay);
    this.hud = new Hud(q('hud'), d.i18n);
    this.tabs = new Tabs(q('tabs'), d.i18n, id => this.showTab(id));
    this.catalog = new Catalog(this.catalogHost, d.i18n, d.session, this.fx, d.now, kitId => openKitSheet(this.overlay, d.i18n, kitId, d.session.state, d.now()));
    this.profile = new Profile(this.profileHost, d.i18n, d.session, this.fx, d.lang, d.onLang);
    this.catalogHost.className = 'screen-fill'; this.profileHost.className = 'screen-fill';
    this.lastLvl = xpInfo(d.session.state.xpTotal).lvl;
    d.session.events.on('tick', ev => this.onEvents(ev.newReveals, ev.milestone));
    d.session.events.on('resume', r => { if (r.offline > 0) awayToast(this.fx, d.i18n, r.offline); this.onEvents(r.events.newReveals, r.events.milestone); });
    d.session.events.on('order', o => d.board.install(kitById(o.kitId).tier));
    d.session.events.on('reset', () => { this.lastLvl = 1; this.showTab('world'); });
  }

  private onEvents(newReveals: number, milestone: number | null): void {
    const s = this.d.session.state;
    if (newReveals > 0) {
      const tier = Math.min(KITS.length - 1, s.revealSeen - 1);
      revealCinematic(this.overlay, this.d.i18n, tier, newReveals - 1);
      this.d.sfx.reveal();
      this.d.board.scrollToTier(tier);
    }
    if (milestone !== null) { milestoneToast(this.fx, this.d.i18n, milestone); this.d.sfx.success(); }
  }

  showTab(id: TabId): void {
    if (this.tabs.active !== id) this.tabs.select(id);
    const world = id === 'world';
    this.d.board.setVisible(world);
    this.screens.classList.toggle('on', !world);
    clear(this.screens);
    if (world) return;
    const s = this.d.session.state, now = this.d.now();
    const feature = TAB_FEATURE[id];
    if (id === 'catalog') { this.screens.append(this.catalogHost); this.catalog.render(s, now); }
    else if (id === 'profile') { this.screens.append(this.profileHost); this.profile.render(s, now); }
    else if (feature && !featureUnlocked(s.xpTotal, feature)) this.screens.append(lockedScreen(this.d.i18n, feature, s));
    else this.screens.append(h('div', { class: 'locked-screen' }, h('h2', { class: 'display' }, this.d.i18n.t('app.tab.' + id)))); // real screens arrive in plan 3
  }

  onTap(x: number, y: number): void {
    const now = this.d.now();
    const r = this.d.session.click(x, y, now);
    this.fx.fly(x, y - 10, (r.crit ? this.d.i18n.t('app.board.crit') + ' +' : '+') + fmtRP(r.gain), r.crit);
    this.d.board.flashClick(r.crit);
    if (r.crit) { this.d.sfx.pop(); this.fx.shake(this.d.root); }
    else this.d.sfx.tick(Math.min(comboMult(r.combo) * 60 + r.combo * 4, 500));
  }

  frame(now: number, dtMs: number): void {
    const s = this.d.session;
    s.advance(now);
    const lvl = xpInfo(s.state.xpTotal).lvl;
    if (lvl > this.lastLvl) { this.lastLvl = lvl; levelUpToast(this.fx, this.d.i18n, lvl); this.d.sfx.success(); }
    this.hud.render(s.state, now);
    this.tabs.render(s.state);
    const id = this.tabs.active;
    if (id === 'world') this.d.board.render(s.state, now, dtMs);
    else if (id === 'catalog') this.catalog.render(s.state, now);
    else if (id === 'profile') this.profile.render(s.state, now);
    void s.maybeSave(now);
  }
}
```
`apps/mobile/src/debug/console.ts`:
```ts
import { KITS, REVEAL_MULT } from '@rnc/core';
import type { App, BoardLike } from '../app';
import type { Session } from '../game/session';
import type { I18n } from '../i18n/i18n';
import { revealCinematic } from '../ui/cinematic';
import type { TabId } from '../ui/tabs';

export interface DebugApi {
  state: () => Session['state'];
  cheat: (code: 'rp' | 'lvl' | 'unlockall', n?: number) => void;
  revealCinematic: (tier: number, extra?: number) => void;
  toast: (text: string) => void;
  install: (tier: number) => void;
  tab: (id: TabId) => void;
  save: () => Promise<boolean>;
}

export function installDebug(win: Window & typeof globalThis, ctx: { session: Session; app: App; board: BoardLike; i18n: I18n; now: () => number }): void {
  const overlay = () => ctx.app.fx.host;
  const api: DebugApi = {
    state: () => ctx.session.state,
    cheat: (code, n = 0) => {
      const s = ctx.session.state;
      if (code === 'rp') s.rp += n;
      else if (code === 'lvl') s.xpTotal = Math.max(s.xpTotal, 50 * 2 ** n);
      else if (code === 'unlockall') s.xpTotal = Math.max(s.xpTotal, KITS[KITS.length - 1]!.rpCost * REVEAL_MULT);
    },
    revealCinematic: (tier, extra = 0) => { revealCinematic(overlay(), ctx.i18n, tier, extra); },
    toast: text => ctx.app.fx.toast(text),
    install: tier => ctx.board.install(tier),
    tab: id => ctx.app.showTab(id),
    save: () => ctx.session.maybeSave(ctx.now(), true),
  };
  (win as unknown as { rnc: DebugApi }).rnc = api;
}
```
`apps/mobile/src/main.ts`:
```ts
import './styles.css';
import { mulberry32 } from '@rnc/core';
import { App } from './app';
import { Sfx } from './audio/sfx';
import { installDebug } from './debug/console';
import { Session } from './game/session';
import { LocalStorageStore } from './game/storage';
import { LANGS, detectLang, fetchJson, loadI18n, type Lang } from './i18n/i18n';
import { Board } from './scene/board';

const LANG_KEY = 'rnc.lang';

function pickLang(): Lang {
  try { const saved = localStorage.getItem(LANG_KEY); if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang; } catch { /* ignore */ }
  return detectLang(navigator.languages ?? [navigator.language]);
}

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  const lang = pickLang();
  document.documentElement.lang = lang;
  const i18n = await loadI18n(lang, fetchJson);
  const now = () => Date.now();
  const session = await Session.boot(new LocalStorageStore(localStorage), now(), mulberry32((Math.random() * 2 ** 31) >>> 0));
  const sfx = new Sfx();
  let app: App;
  const board = await Board.create(document.getElementById('scene')!, i18n, { onTap: (x, y) => app.onTap(x, y) });
  app = new App({ root, i18n, session, board, sfx, lang, now, onLang: l => { try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } location.reload(); } });
  installDebug(window, { session, app, board, i18n, now });

  let last = performance.now();
  const loop = () => {
    const t = performance.now();
    app.frame(now(), t - last);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const flush = () => { void session.maybeSave(now(), true); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}

void boot();
```
Uwaga: `session.click` przyjmuje `rng` z `Session` (mulberry32 z losowym ziarnem przy starcie; klik używa go do krytów: per spec sekcja 7 "Math.random dla kliku" jest równoważne, bo ziarno jest losowe przy każdym uruchomieniu).

Dopisać do `apps/mobile/src/styles.css`: `.screen-fill { height: 100%; }`.

- [ ] **Step 4: Testy, typecheck, podgląd na żywo**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile
npm run dev
```
Otworzyć `http://localhost:5173` w Chrome z emulacją iPhone (390x844): klik w procesor daje "+1" i pierścień, seria klików buduje combo, w konsoli `rnc.cheat('rp', 5000)`, zakładka Katalog, "Order" na Brick Build Kit, powrót na Świat: kość wjeżdża do slotu, po 10 min (albo `rnc.cheat('lvl', 30)` dla dostaw 1 s) impulsy płyną do procesora; `rnc.cheat('unlockall')` odpala cinematik. Zanotować w raporcie, co działa, a co nie. Zamknąć serwer.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/main.ts apps/mobile/src/app.ts apps/mobile/src/debug/console.ts apps/mobile/src/ui/fx.ts apps/mobile/src/styles.css apps/mobile/test/ui/app.test.ts
git commit -m "feat(mobile): app boot with screens, event wiring and console helpers"
```

---

### Task 12: Test smoke w Playwright i strażnik myślników w aplikacji

**Files:**
- Create: `apps/mobile/playwright.config.ts`, `apps/mobile/e2e/smoke.spec.ts`
- Create: `apps/mobile/test/no-dashes.test.ts`
- Modify: root `package.json` (skrypt `e2e`), `.github/workflows/ci.yml` (krok e2e po testach)

**Interfaces:**
- Produces: `npm run e2e` (root) buduje aplikację i uruchamia smoke na Chromium 390x844.

- [ ] **Step 1: Test myślników (vitest)**

`apps/mobile/test/no-dashes.test.ts`:
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|css|html|json|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

describe('mobile sources', () => {
  it('contain no long dashes', () => {
    const roots = ['../src', '../e2e', '../scripts', '../index.html'].map(r => fileURLToPath(new URL(r, import.meta.url)));
    const files = roots.flatMap(r => (statSync(r).isDirectory() ? walk(r) : [r]));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Playwright**

```bash
cd /Users/darek/Code/ramnevercomes-mobile && npx playwright install chromium
```

`apps/mobile/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { ...devices['iPhone 13'], baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
```

`apps/mobile/e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('first minute of play', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-rp]')).toHaveText('128');
  const canvas = page.locator('#scene canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const cpu = { x: box.x + box.width / 2, y: box.y + box.height - 118 };
  for (let i = 0; i < 12; i++) await page.mouse.click(cpu.x, cpu.y);
  await expect.poll(async () => Number((await page.locator('[data-rp]').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(128);
  await expect(page.locator('#overlay .fly').first()).toBeVisible();

  await page.evaluate(() => (window as unknown as { rnc: { cheat: (c: string, n: number) => void } }).rnc.cheat('rp', 5000));
  await page.locator('[data-tab="catalog"]').click();
  await expect(page.locator('.kit-row').first()).toBeVisible();
  const buy = page.locator('.kit-row button.buy').first();
  await buy.dispatchEvent('pointerdown');
  await buy.dispatchEvent('pointerup');
  await expect(page.locator('.pending-strip')).toContainText('1');
  await expect(page.locator('#overlay .toastx')).toBeVisible();

  await page.locator('[data-tab="world"]').click();
  await page.evaluate(() => (window as unknown as { rnc: { cheat: (c: string) => void } }).rnc.cheat('unlockall'));
  await expect(page.locator('#overlay .kit-reveal')).toBeVisible();

  await page.reload();
  await expect.poll(async () => Number((await page.locator('[data-rp]').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(128);
});
```

Root `package.json`: dodać `"e2e": "npm run e2e -w @rnc/mobile"`. W `.github/workflows/ci.yml` po `npm run verify:lang` dodać:
```yaml
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
```

- [ ] **Step 3: Uruchomić**

```bash
npm test -w @rnc/mobile && npm run typecheck -w @rnc/mobile && npm run e2e
```
Oczekiwane: smoke zielony. Jeśli klik w procesor nie trafia (inny rozmiar viewportu), poprawić współrzędne w teście przez `cpuRect` z layoutu (y = wysokość canvasu - 118).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/playwright.config.ts apps/mobile/e2e apps/mobile/test/no-dashes.test.ts package.json .github/workflows/ci.yml
git commit -m "test(mobile): playwright smoke of the first minute and long-dash guard"
```

---

## Self-review (wykonany przy pisaniu planu)

- **Pokrycie specu (zakres planu 2)**: sekcja 3 (zakładki, HUD, katalog, profil, kropki gotowości, blokady poziomami) - zadania 5, 8, 9, 11; sekcja 4 (scena: sekcje po 6, procesor na dole, impulsy z agregacją, klik, combo, install) - zadania 6, 7; sekcja 7 (zapis, autozapis, resume, osłona czasu) - zadanie 3 + core; sekcja 9 (safe-area, reduced motion, cele 44 px) - zadania 1, 5, 10; sekcja 11 (Playwright 390x844, konsola `cheat`, `revealCinematic`) - zadania 11, 12. Kropki gotowości (`Tabs.setDot`) mają API, ale bez skrzynek/koła nic ich jeszcze nie zapala (plan 3).
- **Placeholdery**: brak.
- **Spójność nazw**: `Session.advance/click/buy/affordable/maybeSave/reset` (T3) używane w T8, T9, T11; `Board.render/flashClick/install/scrollToTier/setVisible` (T7) = `BoardLike` (T11); `Fx.fly/toast/shake` + `host` getter (T5, T11); `Tabs.active/select/render/setDot` (T5, T11); `revealCinematic(overlay, i18n, tier, extra, onClose)` (T10, T11); `I18n.t`, `loadI18n`, `detectLang`, `LANGS`, `Lang` (T4, T9, T11).
