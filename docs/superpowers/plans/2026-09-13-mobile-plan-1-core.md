# RamNeverComes Mobile - Plan 1: repozytorium i pakiet core (ekonomia bazowa + symulator)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Założyć nowe repozytorium `ramnevercomes-mobile` i zbudować pakiet `@rnc/core`: czystą, przetestowaną ekonomię bazową gry (kity, koszty, produkcja, poziomy, dostawy, odkrycia, klik, tick, offline, zapis z migracjami, RNG) oraz symulator balansu z testami w CI. Bez UI.

**Architecture:** Monorepo npm workspaces. `packages/core` to czyste funkcje TypeScript operujące na jednym obiekcie stanu (`GameState`), bez DOM, bez zegara ściennego (czas zawsze argumentem `now` w ms), bez `Math.random` (RNG argumentem). Dane kitów są wygenerowane jednorazowo z `js/data.js` repo `rambuy` do `kits.json`. Symulator uruchamia politykę gracza na tej samej logice i mierzy tempo odkryć oraz wzrost produkcji na tier.

**Tech Stack:** Node 22, npm workspaces, TypeScript 5 (strict, ESM), vitest, tsx. Brak innych zależności runtime w core.

**Spec:** `docs/superpowers/specs/2026-09-13-mobile-game-design.md` (w repo `rambuy`; zadanie 1 kopiuje go do nowego repo).

**Seria planów** (każdy kończy się działającym oprogramowaniem):
1. Ten plan: repo + core ekonomii bazowej + symulator.
2. Aplikacja: Capacitor + Vite + scena płyty (PixiJS), HUD, zakładka Świat i Katalog, zapis, pętla.
3. Pozostałe systemy z rozdziału 5 specu: skrzynki, koło, giełda, discover, zdrapki, osiągnięcia, kamienie GB w UI, Profil.
4. Pakiet 1 (6.1 Firmware, 6.2 Złote paczki v2, 6.3 Wycieki, 6.4 Witaj z powrotem + powiadomienia).
5. Warstwa natywna, polish, TestFlight / Play internal.
6+. R2 i R3 według rozdziału 10 specu.

## Global Constraints

- Nowe repozytorium: `/Users/darek/Code/ramnevercomes-mobile`, gałąź `main`, autor commitów = domyślny `git config` (Darek). Commity i opisy PR bez `Co-Authored-By`, bez "Generated with Claude Code", bez linków do sesji, bez wzmianek o AI (reguła nadrzędna z globalnego CLAUDE.md).
- W tekstach, kodzie, komentarzach i dokumentach NIGDY długi myślnik (en dash U+2013, em dash U+2014), tylko "-".
- Stałe ekonomii są przeniesione 1:1 z `rambuy` (spec, rozdział 5): koszt kopii x1.15, próg odkrycia 8x ceny (pierwsze dwa kity zawsze odkryte), klik = (1 + 0.04 * cps) * combo * frenzy, kryt 5% x10, combo 10/25/50 klików w odstępach < 700 ms daje x2/x3/x5, frenzy x7, poziom = max(1, floor(log2(xp/50))), dostawa = max(1, 600 - 21*(lvl-1)) s, prodMult = 1.15^(liczba osiągniętych progów GB), GB liczone tylko z dostarczonych kitów i dropów, stan początkowy 128 RP, stock kitu = stock bazowy + floor(posiadane/2).
- Symulator w CI (spec, rozdział 8): odkrycia tierów 2 i 6 w oknie 3-15 min i < 90 min dla gry ciągłej z 3 klikami/s; wzrost produkcji drabinki x kamień GB < 2.0 na tier (od tieru 2); odstępy między odkryciami niemalejące od tieru 4 dla gracza idle; produkcja w pełni aktywnego gracza między x2 a x3.5 pasywnej; inwariant skrzynek (lvl 15 => co najmniej 11 odkrytych kitów); tempo odkryć tierów 2-10 w granicach ±20% zapisanej linii bazowej.
- Delivery booster (BP) z gry webowej NIE jest przenoszony (spec go nie wymienia); `Order` nie ma pola `booster`.
- Core nie importuje niczego z DOM ani Capacitora; `Date.now()` i `Math.random()` są zabronione w `packages/core/src` (test w zadaniu 13 to egzekwuje).
- Node 22, ESM (`"type": "module"`), TypeScript `strict: true`.

---

### Task 1: Nowe repozytorium i szkielet monorepo

**Files:**
- Create: `/Users/darek/Code/ramnevercomes-mobile/package.json`
- Create: `/Users/darek/Code/ramnevercomes-mobile/tsconfig.base.json`
- Create: `/Users/darek/Code/ramnevercomes-mobile/.gitignore`
- Create: `/Users/darek/Code/ramnevercomes-mobile/README.md`
- Create: `/Users/darek/Code/ramnevercomes-mobile/packages/core/package.json`
- Create: `/Users/darek/Code/ramnevercomes-mobile/packages/core/tsconfig.json`
- Create: `/Users/darek/Code/ramnevercomes-mobile/packages/core/vitest.config.ts`
- Create: `/Users/darek/Code/ramnevercomes-mobile/packages/core/src/index.ts`
- Create: `/Users/darek/Code/ramnevercomes-mobile/packages/core/test/smoke.test.ts`
- Copy: `docs/superpowers/specs/2026-09-13-mobile-game-design.md` i ten plan z `rambuy` do `docs/superpowers/{specs,plans}/`
- Copy: `lang/*.json` z `rambuy` do `lang/`

**Interfaces:**
- Produces: workspace `@rnc/core` z komendami `npm test -w @rnc/core`, `npm run typecheck -w @rnc/core`.

- [ ] **Step 1: Założyć katalog i repozytorium**

```bash
mkdir -p /Users/darek/Code/ramnevercomes-mobile && cd /Users/darek/Code/ramnevercomes-mobile
git init -b main
mkdir -p packages/core/src packages/core/test docs/superpowers/specs docs/superpowers/plans lang
cp /Users/darek/Code/rambuy/docs/superpowers/specs/2026-09-13-mobile-game-design.md docs/superpowers/specs/
cp /Users/darek/Code/rambuy/docs/superpowers/plans/2026-09-13-mobile-plan-1-core.md docs/superpowers/plans/
cp /Users/darek/Code/rambuy/lang/*.json lang/
ls lang | wc -l   # oczekiwane: 11
```

- [ ] **Step 2: Pliki konfiguracyjne root**

`package.json`:
```json
{
  "name": "ramnevercomes-mobile",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "RamNeverComes as a native mobile game. Nothing ships, no payment is taken.",
  "license": "MIT",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "sim": "npm run sim -w @rnc/core"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0"
  },
  "engines": { "node": ">=22" }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.DS_Store
*.log
.env
```

`README.md`:
```markdown
# RamNeverComes Mobile

Native mobile version of RamNeverComes: a fictional DDR5 store that is secretly an idle game. Nothing ships, no payment is taken, no ads, no in-app purchases.

- `packages/core` - pure game logic (economy, save format, simulator). No DOM, no wall clock, no `Math.random`.
- `apps/mobile` - Capacitor app (added in plan 2).
- `lang/` - 11 translation files, English is the fallback.
- `docs/superpowers/` - design spec and implementation plans.

## Development

```bash
npm install
npm test
npm run typecheck
npm run sim        # balance simulator report
```
```

- [ ] **Step 3: Pakiet core**

`packages/core/package.json`:
```json
{
  "name": "@rnc/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "sim": "tsx src/sim/cli.ts"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": ".", "noEmit": true, "types": ["node"] },
  "include": ["src/**/*.ts", "test/**/*.ts", "src/**/*.json"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
```

`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = '0.1.0';
```

`packages/core/test/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../src/index';

describe('core package', () => {
  it('exports a version', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 4: Instalacja i uruchomienie testu**

```bash
cd /Users/darek/Code/ramnevercomes-mobile
npm install --save-dev @types/node@^22
npm install
npm test
npm run typecheck
```
Oczekiwane: 1 test passed, typecheck bez błędów.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: monorepo scaffold with core package, spec and translations"
```

---

### Task 2: Dane kitów wygenerowane z rambuy

**Files:**
- Create: `packages/core/scripts/extract-kits.mjs`
- Create: `packages/core/src/data/kits.json` (wygenerowany)
- Create: `packages/core/src/data/kits.ts`
- Test: `packages/core/test/kits.test.ts`

**Interfaces:**
- Produces:
  - `interface KitDef { id: string; name: string; sub: string; rpCost: number; rpProd: number; price: number; img: string; stock: number; speed: string; latency: string; voltage: string; profile: string; desc: string; tag: { icon: string; label: string } | null; rating: number; reviews: number; gb: number; tier: number }`
  - `const KITS: readonly KitDef[]` posortowane rosnąco po `rpCost`; `tier` = indeks w tej tablicy (0..58).
  - `kitById(id: string): KitDef` (rzuca `Error('unknown kit: ' + id)`)
  - `capacityGB(sub: string): number`

- [ ] **Step 1: Test**

`packages/core/test/kits.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, capacityGB, kitById } from '../src/data/kits';

describe('kit ladder', () => {
  it('has 59 kits sorted by rpCost with tier = index', () => {
    expect(KITS.length).toBe(59);
    KITS.forEach((k, i) => {
      expect(k.tier).toBe(i);
      if (i > 0) expect(k.rpCost).toBeGreaterThan(KITS[i - 1]!.rpCost);
    });
  });

  it('doubles the cost per tier and starts at 128', () => {
    expect(KITS[0]!.rpCost).toBe(128);
    for (let i = 1; i < KITS.length; i++) {
      expect(KITS[i]!.rpCost / KITS[i - 1]!.rpCost).toBeCloseTo(2, 5);
    }
  });

  it('parses capacity from the sub line', () => {
    expect(capacityGB('2 × 16GB · DDR5-5600 · CL36')).toBe(32);
    expect(capacityGB('1 × 32GB · DDR5-5600 · CL40')).toBe(32);
    expect(capacityGB('no capacity here')).toBe(0);
    KITS.forEach(k => expect(k.gb).toBe(capacityGB(k.sub)));
  });

  it('finds kits by id and rejects unknown ids', () => {
    expect(kitById('sakura').name).toBe('Sakura Kit');
    expect(() => kitById('nope')).toThrow('unknown kit: nope');
  });
});
```

- [ ] **Step 2: Uruchomić test, oczekiwany FAIL** (`Cannot find module '../src/data/kits'`)

```bash
npm test -w @rnc/core
```

- [ ] **Step 3: Skrypt ekstrakcji (uruchamiany jednorazowo, wynik commitowany)**

`packages/core/scripts/extract-kits.mjs`:
```js
// One-off extraction of the product catalogue from the web game.
// Usage: node scripts/extract-kits.mjs /Users/darek/Code/rambuy/js/data.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = readFileSync(process.argv[2], 'utf8');
const match = src.match(/const PRODUCTS = \[[\s\S]*?\n\];/);
if (!match) throw new Error('PRODUCTS not found');
const PRODUCTS = new Function(match[0] + '; return PRODUCTS;')();

const capacity = sub => {
  const m = sub.match(/^(\d+)\s*×\s*(\d+)GB/);
  return m ? +m[1] * +m[2] : 0;
};

const kits = [...PRODUCTS]
  .sort((a, b) => a.rpCost - b.rpCost)
  .map((p, tier) => ({
    id: p.id, name: p.name, sub: p.sub, rpCost: p.rpCost, rpProd: p.rpProd,
    price: p.price, img: p.img, stock: p.stock, speed: p.speed, latency: p.latency,
    voltage: p.voltage, profile: p.profile, desc: p.desc, tag: p.tag ?? null,
    rating: p.rating, reviews: p.reviews, gb: capacity(p.sub), tier,
  }));

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'kits.json');
writeFileSync(out, JSON.stringify(kits, null, 2) + '\n');
console.log(`wrote ${kits.length} kits to ${out}`);
```

```bash
cd /Users/darek/Code/ramnevercomes-mobile/packages/core
mkdir -p src/data
node scripts/extract-kits.mjs /Users/darek/Code/rambuy/js/data.js
grep -c '"id"' src/data/kits.json   # oczekiwane: 59
grep -nP '\x{2013}|\x{2014}' src/data/kits.json   # oczekiwane: brak wyników
```

- [ ] **Step 4: Moduł kitów**

`packages/core/src/data/kits.ts`:
```ts
import raw from './kits.json';

export interface KitDef {
  id: string;
  name: string;
  sub: string;
  rpCost: number;
  rpProd: number;
  price: number;
  img: string;
  stock: number;
  speed: string;
  latency: string;
  voltage: string;
  profile: string;
  desc: string;
  tag: { icon: string; label: string } | null;
  rating: number;
  reviews: number;
  gb: number;
  tier: number;
}

export const KITS: readonly KitDef[] = raw as KitDef[];

const byId = new Map(KITS.map(k => [k.id, k]));

export function kitById(id: string): KitDef {
  const k = byId.get(id);
  if (!k) throw new Error('unknown kit: ' + id);
  return k;
}

export function capacityGB(sub: string): number {
  const m = sub.match(/^(\d+)\s*×\s*(\d+)GB/);
  return m ? Number(m[1]) * Number(m[2]) : 0;
}
```

- [ ] **Step 5: Testy zielone**

```bash
npm test -w @rnc/core && npm run typecheck -w @rnc/core
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/scripts/extract-kits.mjs packages/core/src/data packages/core/test/kits.test.ts
git commit -m "feat(core): kit ladder data extracted from the web game"
```

---

### Task 3: Formatowanie liczb RP

**Files:**
- Create: `packages/core/src/i18n/format.ts`
- Test: `packages/core/test/format.test.ts`

**Interfaces:**
- Produces: `fmtRP(n: number): string` (identyczne z webem: < 1000 pełna liczba, potem K/M/B/T/Q/Qi: >= 100 zaokrąglone do całości, >= 10 jedno miejsce, inaczej dwa), `fmtDuration(sec: number): string` (`45s`, `3m 5s`, `2h 7m`).

- [ ] **Step 1: Test**

`packages/core/test/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtRP } from '../src/i18n/format';

describe('fmtRP', () => {
  it('matches the web game formatting', () => {
    expect(fmtRP(0)).toBe('0');
    expect(fmtRP(999.9)).toBe('999');
    expect(fmtRP(1000)).toBe('1.00K');
    expect(fmtRP(12345)).toBe('12.3K');
    expect(fmtRP(123456)).toBe('123K');
    expect(fmtRP(2_500_000)).toBe('2.50M');
    expect(fmtRP(3e9)).toBe('3.00B');
    expect(fmtRP(4.2e12)).toBe('4.20T');
    expect(fmtRP(5e15)).toBe('5.00Q');
    expect(fmtRP(6e18)).toBe('6.00Qi');
  });
});

describe('fmtDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(fmtDuration(45.4)).toBe('45s');
    expect(fmtDuration(185)).toBe('3m 5s');
    expect(fmtDuration(7620)).toBe('2h 7m');
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL** (`npm test -w @rnc/core`)

- [ ] **Step 3: Implementacja**

`packages/core/src/i18n/format.ts`:
```ts
const UNITS: readonly [number, string][] = [
  [1e18, 'Qi'], [1e15, 'Q'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'],
];

export function fmtRP(n: number): string {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  for (const [v, u] of UNITS) {
    if (n >= v) {
      const x = n / v;
      return (x >= 100 ? String(Math.round(x)) : x.toFixed(x >= 10 ? 1 : 2)) + u;
    }
  }
  return String(n);
}

export function fmtDuration(sec: number): string {
  if (sec < 60) return Math.round(sec) + 's';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m ${Math.round(sec % 60)}s`;
}
```

- [ ] **Step 4: Testy zielone** (`npm test -w @rnc/core`)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/i18n/format.ts packages/core/test/format.test.ts
git commit -m "feat(core): RP and duration formatting"
```

---

### Task 4: Seedowany RNG

**Files:**
- Create: `packages/core/src/rng/rng.ts`
- Test: `packages/core/test/rng.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number` (liczba w [0, 1))
  - `mulberry32(seed: number): Rng`
  - `constantRng(value: number): Rng` (do testów)
  - `sequenceRng(values: number[]): Rng` (zwraca kolejne wartości, potem ostatnią)

- [ ] **Step 1: Test**

`packages/core/test/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { constantRng, mulberry32, sequenceRng } from '../src/rng/rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    const ys = Array.from({ length: 5 }, () => b());
    expect(xs).toEqual(ys);
  });

  it('stays in [0, 1) and differs between seeds', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('test helpers', () => {
  it('constantRng and sequenceRng behave as documented', () => {
    expect(constantRng(0.5)()).toBe(0.5);
    const s = sequenceRng([0.1, 0.9]);
    expect(s()).toBe(0.1);
    expect(s()).toBe(0.9);
    expect(s()).toBe(0.9);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/rng/rng.ts`:
```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function constantRng(value: number): Rng {
  return () => value;
}

export function sequenceRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i++;
    if (v === undefined) throw new Error('sequenceRng needs at least one value');
    return v;
  };
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/rng packages/core/test/rng.test.ts
git commit -m "feat(core): seeded rng"
```

---

### Task 5: Stan gry i stan początkowy

**Files:**
- Create: `packages/core/src/state.ts`
- Test: `packages/core/test/state.test.ts`

**Interfaces:**
- Produces:
```ts
interface OrderItem { id: string; qty: number }
interface Order { id: string; ts: number; dur: number; items: OrderItem[]; total: number }
interface Drop { id: string; ts: number; rarity: 'common' | 'rare' | 'epic' | 'legendary' }
interface Stats { clicks: number; crits: number; nightOrders: number; golden: number }
interface GameState {
  v: 1; createdAt: number; lastSeen: number; seed: number;
  rp: number; xpTotal: number;
  orders: Order[]; drops: Drop[];
  combo: { n: number; last: number };
  frenzyUntil: number;
  revealSeen: number; msSeen: number;
  stats: Stats;
}
const START_RP = 128;
function createState(now: number, seed: number): GameState
```

- [ ] **Step 1: Test**

`packages/core/test/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { START_RP, createState } from '../src/state';

describe('createState', () => {
  it('starts with the welcome grant and empty collections', () => {
    const s = createState(1_000, 99);
    expect(s.v).toBe(1);
    expect(s.rp).toBe(START_RP);
    expect(START_RP).toBe(128);
    expect(s.xpTotal).toBe(0);
    expect(s.createdAt).toBe(1_000);
    expect(s.lastSeen).toBe(1_000);
    expect(s.seed).toBe(99);
    expect(s.orders).toEqual([]);
    expect(s.drops).toEqual([]);
    expect(s.combo).toEqual({ n: 0, last: 0 });
    expect(s.frenzyUntil).toBe(0);
    expect(s.revealSeen).toBe(0);
    expect(s.msSeen).toBe(0);
    expect(s.stats).toEqual({ clicks: 0, crits: 0, nightOrders: 0, golden: 0 });
  });

  it('returns independent objects', () => {
    const a = createState(0, 1), b = createState(0, 1);
    a.orders.push({ id: 'x', ts: 0, dur: 1, items: [], total: 0 });
    expect(b.orders.length).toBe(0);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/state.ts`:
```ts
export interface OrderItem { id: string; qty: number }
export interface Order { id: string; ts: number; dur: number; items: OrderItem[]; total: number }
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface Drop { id: string; ts: number; rarity: Rarity }
export interface Stats { clicks: number; crits: number; nightOrders: number; golden: number }

export interface GameState {
  v: 1;
  createdAt: number;
  lastSeen: number;
  seed: number;
  rp: number;
  xpTotal: number;
  orders: Order[];
  drops: Drop[];
  combo: { n: number; last: number };
  frenzyUntil: number;
  revealSeen: number;
  msSeen: number;
  stats: Stats;
}

/** Welcome grant: the web game starts every player with 128 RP. */
export const START_RP = 128;

export function createState(now: number, seed: number): GameState {
  return {
    v: 1,
    createdAt: now,
    lastSeen: now,
    seed,
    rp: START_RP,
    xpTotal: 0,
    orders: [],
    drops: [],
    combo: { n: 0, last: 0 },
    frenzyUntil: 0,
    revealSeen: 0,
    msSeen: 0,
    stats: { clicks: 0, crits: 0, nightOrders: 0, golden: 0 },
  };
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/state.ts packages/core/test/state.test.ts
git commit -m "feat(core): game state shape and initial state"
```

---

### Task 6: Poziomy, XP, dostawy, odblokowania funkcji

**Files:**
- Create: `packages/core/src/economy/levels.ts`
- Test: `packages/core/test/levels.test.ts`

**Interfaces:**
- Produces:
  - `xpInfo(xpTotal: number): { lvl: number; cur: number; need: number }` (lvl = max(1, floor(log2(xp/50))), base = 50*2^lvl, cur = max(0, xp - base), need = base)
  - `STAGE_TIMES = [0, 70, 180, 340, 480, 600]`
  - `deliveryDuration(lvl: number): number` = max(1, 600 - 21*(lvl-1))
  - `FEATURE_LVL = { spin: 5, discover: 10, mystery: 15, market: 20, herobuy: 25 }`, `type FeatureId = keyof typeof FEATURE_LVL`
  - `featureUnlocked(xpTotal: number, id: FeatureId): boolean`

- [ ] **Step 1: Test**

`packages/core/test/levels.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FEATURE_LVL, STAGE_TIMES, deliveryDuration, featureUnlocked, xpInfo } from '../src/economy/levels';

describe('xpInfo', () => {
  it('uses log2 levels with a floor of 1', () => {
    expect(xpInfo(0).lvl).toBe(1);
    expect(xpInfo(99).lvl).toBe(1);
    expect(xpInfo(200).lvl).toBe(2);
    expect(xpInfo(50 * 2 ** 10).lvl).toBe(10);
    expect(xpInfo(50 * 2 ** 15).lvl).toBe(15);
  });

  it('reports progress inside the level', () => {
    const i = xpInfo(50 * 2 ** 3 + 100); // lvl 3, base 400
    expect(i).toEqual({ lvl: 3, cur: 100, need: 400 });
    expect(xpInfo(0).cur).toBe(0);
  });
});

describe('deliveryDuration', () => {
  it('starts at 600 s, drops 21 s per level, never below 1 s', () => {
    expect(STAGE_TIMES).toEqual([0, 70, 180, 340, 480, 600]);
    expect(deliveryDuration(1)).toBe(600);
    expect(deliveryDuration(2)).toBe(579);
    expect(deliveryDuration(29)).toBe(12);
    expect(deliveryDuration(30)).toBe(1);
    expect(deliveryDuration(40)).toBe(1);
  });
});

describe('featureUnlocked', () => {
  it('follows FEATURE_LVL thresholds', () => {
    expect(FEATURE_LVL).toEqual({ spin: 5, discover: 10, mystery: 15, market: 20, herobuy: 25 });
    expect(featureUnlocked(50 * 2 ** 5, 'spin')).toBe(true);
    expect(featureUnlocked(50 * 2 ** 5 - 1, 'spin')).toBe(false);
    expect(featureUnlocked(50 * 2 ** 15, 'mystery')).toBe(true);
    expect(featureUnlocked(0, 'market')).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/levels.ts`:
```ts
export interface XpInfo { lvl: number; cur: number; need: number }

/** Logarithmic levels for an exponential economy: each level doubles the lifetime RP required. */
export function xpInfo(xpTotal: number): XpInfo {
  const lvl = Math.max(1, Math.floor(Math.log2(xpTotal / 50)));
  const base = 50 * Math.pow(2, lvl);
  return { lvl, cur: Math.max(0, xpTotal - base), need: base };
}

/** Seconds after order placement at which each tracking stage activates. */
export const STAGE_TIMES = [0, 70, 180, 340, 480, 600] as const;

const FULL_DELIVERY = STAGE_TIMES[STAGE_TIMES.length - 1] as number;

/** Deliveries speed up with level: -21 s per level, 1 s at level 30. */
export function deliveryDuration(lvl: number): number {
  return Math.max(1, FULL_DELIVERY - 21 * (lvl - 1));
}

export const FEATURE_LVL = { spin: 5, discover: 10, mystery: 15, market: 20, herobuy: 25 } as const;
export type FeatureId = keyof typeof FEATURE_LVL;

export function featureUnlocked(xpTotal: number, id: FeatureId): boolean {
  return xpInfo(xpTotal).lvl >= FEATURE_LVL[id];
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/levels.ts packages/core/test/levels.test.ts
git commit -m "feat(core): levels, delivery duration and feature unlocks"
```

---

### Task 7: Posiadanie, GB, kamienie milowe, produkcja

**Files:**
- Create: `packages/core/src/economy/production.ts`
- Test: `packages/core/test/production.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Order` (Task 5), `kitById` (Task 2).
- Produces:
  - `isDelivered(order: Order, now: number): boolean` = (now - ts)/1000 >= dur
  - `ownedCounts(state, now, all = false): Record<string, number>` (all = wszystko zamówione + dropy; false = tylko dostarczone + dropy)
  - `GB_MILESTONES: readonly number[]` = [16, 32, 64, 128, 192, 512, 1024, 2048, 6144, 16384, 104000, 1300000, 4900000, 9200000]
  - `gbOwned(state, now): number`
  - `milestoneIndex(gb: number): number` (ile progów osiągnięto)
  - `prodMult(gb: number): number` = 1.15^milestoneIndex(gb)
  - `cps(state, now): number` = suma rpProd * dostarczone kopie * prodMult

- [ ] **Step 1: Test**

`packages/core/test/production.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createState } from '../src/state';
import { GB_MILESTONES, cps, gbOwned, isDelivered, milestoneIndex, ownedCounts, prodMult } from '../src/economy/production';

function stateWith(orders: { id: string; qty: number; ts: number; dur: number }[], drops: string[] = []) {
  const s = createState(0, 1);
  orders.forEach((o, i) => s.orders.push({ id: 'O' + i, ts: o.ts, dur: o.dur, items: [{ id: o.id, qty: o.qty }], total: 0 }));
  drops.forEach(id => s.drops.push({ id, ts: 0, rarity: 'common' }));
  return s;
}

describe('ownership', () => {
  it('counts delivered kits and drops for production, everything for pricing', () => {
    const s = stateWith([
      { id: 'brick-build', qty: 3, ts: 0, dur: 10 },
      { id: 'sakura', qty: 2, ts: 0, dur: 100 },
    ], ['sakura']);
    const now = 50_000; // 50 s: first order delivered, second not
    expect(isDelivered(s.orders[0]!, now)).toBe(true);
    expect(isDelivered(s.orders[1]!, now)).toBe(false);
    expect(ownedCounts(s, now)).toEqual({ 'brick-build': 3, sakura: 1 });
    expect(ownedCounts(s, now, true)).toEqual({ 'brick-build': 3, sakura: 3 });
  });
});

describe('GB milestones', () => {
  it('lists the web thresholds and counts reached ones', () => {
    expect(GB_MILESTONES).toEqual([16, 32, 64, 128, 192, 512, 1024, 2048, 6144, 16384, 104000, 1300000, 4900000, 9200000]);
    expect(milestoneIndex(0)).toBe(0);
    expect(milestoneIndex(16)).toBe(1);
    expect(milestoneIndex(200)).toBe(5);
    expect(milestoneIndex(1e9)).toBe(14);
  });

  it('multiplies production by 1.15 per milestone', () => {
    expect(prodMult(0)).toBe(1);
    expect(prodMult(64)).toBeCloseTo(1.15 ** 3, 10);
  });

  it('counts GB only from delivered kits and drops', () => {
    const s = stateWith([
      { id: 'brick-build', qty: 1, ts: 0, dur: 10 }, // 32 GB
      { id: 'sakura', qty: 1, ts: 0, dur: 1000 },    // not delivered
    ], ['brick-build']);                              // 32 GB
    expect(gbOwned(s, 20_000)).toBe(64);
  });
});

describe('cps', () => {
  it('sums rpProd of delivered copies times prodMult', () => {
    const s = stateWith([{ id: 'brick-build', qty: 2, ts: 0, dur: 1 }]); // 2 x 1 RP/s, 64 GB => 3 milestones
    expect(cps(s, 5_000)).toBeCloseTo(2 * 1.15 ** 3, 10);
    expect(cps(s, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/production.ts`:
```ts
import { kitById } from '../data/kits';
import type { GameState, Order } from '../state';

export function isDelivered(order: Order, now: number): boolean {
  return (now - order.ts) / 1000 >= order.dur;
}

/**
 * all=true counts everything you bought (pricing, stock);
 * all=false counts only delivered kits + case drops (production, GB).
 */
export function ownedCounts(state: GameState, now: number, all = false): Record<string, number> {
  const c: Record<string, number> = {};
  for (const o of state.orders) {
    if (all || isDelivered(o, now)) {
      for (const it of o.items) c[it.id] = (c[it.id] ?? 0) + it.qty;
    }
  }
  for (const d of state.drops) c[d.id] = (c[d.id] ?? 0) + 1;
  return c;
}

/** GB thresholds with real-world reference points (texts live in lang/*.json under ms.<gb>). */
export const GB_MILESTONES: readonly number[] = [
  16, 32, 64, 128, 192, 512, 1024, 2048, 6144, 16384, 104000, 1300000, 4900000, 9200000,
];

export function gbOwned(state: GameState, now: number): number {
  let gb = 0;
  for (const [id, n] of Object.entries(ownedCounts(state, now))) gb += kitById(id).gb * n;
  return gb;
}

export function milestoneIndex(gb: number): number {
  let n = 0;
  for (const m of GB_MILESTONES) if (gb >= m) n++;
  return n;
}

/**
 * 1.15^n. Stability condition of the economy: tier production growth (1.618)
 * times this bonus must stay below the tier cost growth (2.0). See spec, section 8.
 */
export function prodMult(gb: number): number {
  return Math.pow(1.15, milestoneIndex(gb));
}

export function cps(state: GameState, now: number): number {
  const counts = ownedCounts(state, now);
  let s = 0;
  for (const [id, n] of Object.entries(counts)) s += kitById(id).rpProd * n;
  return s * prodMult(gbOwned(state, now));
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/production.ts packages/core/test/production.test.ts
git commit -m "feat(core): ownership, GB milestones and production"
```

---

### Task 8: Ceny kopii, stock, odkrycia

**Files:**
- Create: `packages/core/src/economy/pricing.ts`
- Create: `packages/core/src/economy/reveal.ts`
- Test: `packages/core/test/pricing.test.ts`
- Test: `packages/core/test/reveal.test.ts`

**Interfaces:**
- Consumes: `KitDef`, `KITS`, `kitById` (Task 2), `ownedCounts` (Task 7).
- Produces:
  - `COPY_GROWTH = 1.15`
  - `copyCost(kit: KitDef, ownedAll: number): number` = round(rpCost * 1.15^ownedAll)
  - `orderTotal(kit: KitDef, ownedAll: number, qty: number): number` = round(sum_{k<qty} rpCost * 1.15^(ownedAll+k))
  - `stockOf(kit: KitDef, ownedAll: number): number` = stock + floor(ownedAll/2)
  - `REVEAL_MULT = 8`
  - `isRevealed(state, kit: KitDef, now): boolean` = tier < 2 || xpTotal >= rpCost*8 || ownedAll(kit) > 0
  - `revealedCount(state, now): number` (liczba odkrytych kitów; odkrycia są prefiksem drabinki, funkcja liczy wszystkie spełniające warunek)

- [ ] **Step 1: Testy**

`packages/core/test/pricing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { kitById } from '../src/data/kits';
import { COPY_GROWTH, copyCost, orderTotal, stockOf } from '../src/economy/pricing';

describe('pricing', () => {
  const brick = kitById('brick-build'); // rpCost 128, stock from data

  it('raises each copy by x1.15 and rounds', () => {
    expect(COPY_GROWTH).toBe(1.15);
    expect(copyCost(brick, 0)).toBe(128);
    expect(copyCost(brick, 1)).toBe(147);
    expect(copyCost(brick, 5)).toBe(Math.round(128 * 1.15 ** 5));
  });

  it('totals a multi-copy order before rounding', () => {
    expect(orderTotal(brick, 0, 1)).toBe(128);
    expect(orderTotal(brick, 0, 3)).toBe(Math.round(128 + 128 * 1.15 + 128 * 1.15 ** 2));
    expect(orderTotal(brick, 2, 2)).toBe(Math.round(128 * 1.15 ** 2 + 128 * 1.15 ** 3));
  });

  it('grows stock with loyalty', () => {
    expect(stockOf(brick, 0)).toBe(brick.stock);
    expect(stockOf(brick, 5)).toBe(brick.stock + 2);
  });
});
```

`packages/core/test/reveal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KITS, kitById } from '../src/data/kits';
import { REVEAL_MULT, isRevealed, revealedCount } from '../src/economy/reveal';
import { createState } from '../src/state';

describe('reveal', () => {
  it('always shows the first two rungs', () => {
    const s = createState(0, 1);
    expect(REVEAL_MULT).toBe(8);
    expect(isRevealed(s, KITS[0]!, 0)).toBe(true);
    expect(isRevealed(s, KITS[1]!, 0)).toBe(true);
    expect(isRevealed(s, KITS[2]!, 0)).toBe(false);
    expect(revealedCount(s, 0)).toBe(2);
  });

  it('reveals at 8x price of lifetime earnings', () => {
    const s = createState(0, 1);
    s.xpTotal = KITS[2]!.rpCost * 8 - 1;
    expect(isRevealed(s, KITS[2]!, 0)).toBe(false);
    s.xpTotal = KITS[2]!.rpCost * 8;
    expect(isRevealed(s, KITS[2]!, 0)).toBe(true);
    expect(revealedCount(s, 0)).toBe(3);
  });

  it('reveals anything you own (case drops)', () => {
    const s = createState(0, 1);
    s.drops.push({ id: 'abyss', ts: 0, rarity: 'rare' });
    expect(isRevealed(s, kitById('abyss'), 0)).toBe(true);
  });

  it('keeps the case invariant: level 15 reveals at least 11 kits', () => {
    const s = createState(0, 1);
    s.xpTotal = 50 * 2 ** 15;
    expect(revealedCount(s, 0)).toBeGreaterThanOrEqual(11);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/pricing.ts`:
```ts
import type { KitDef } from '../data/kits';

/** Each extra copy of the same kit costs x1.15 more (Cookie Clicker rate). */
export const COPY_GROWTH = 1.15;

export function copyCost(kit: KitDef, ownedAll: number): number {
  return Math.round(kit.rpCost * Math.pow(COPY_GROWTH, ownedAll));
}

export function orderTotal(kit: KitDef, ownedAll: number, qty: number): number {
  let s = 0;
  for (let k = 0; k < qty; k++) s += kit.rpCost * Math.pow(COPY_GROWTH, ownedAll + k);
  return Math.round(s);
}

/** Allocation grows with loyalty: base stock + half of the copies you own. */
export function stockOf(kit: KitDef, ownedAll: number): number {
  return kit.stock + Math.floor(ownedAll / 2);
}
```

`packages/core/src/economy/reveal.ts`:
```ts
import { KITS, type KitDef } from '../data/kits';
import { ownedCounts } from './production';
import type { GameState } from '../state';

/**
 * Reveal threshold: lifetime earnings of 8x the kit price. Verified by simulation
 * (2x revealed a kit every ~1 min at the start; 8x gives 6.7 / 11.7 / 18 / 27 / 37 min).
 */
export const REVEAL_MULT = 8;

/** Reveal rule given the number of copies ever ordered or dropped (avoids recounting per kit). */
export function isRevealedWith(state: GameState, kit: KitDef, ownedAll: number): boolean {
  if (kit.tier < 2) return true;
  if (state.xpTotal >= kit.rpCost * REVEAL_MULT) return true;
  return ownedAll > 0;
}

export function isRevealed(state: GameState, kit: KitDef, now: number): boolean {
  return isRevealedWith(state, kit, ownedCounts(state, now, true)[kit.id] ?? 0);
}

export function revealedCount(state: GameState, now: number): number {
  const counts = ownedCounts(state, now, true);
  let n = 0;
  for (const k of KITS) if (isRevealedWith(state, k, counts[k.id] ?? 0)) n++;
  return n;
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/pricing.ts packages/core/src/economy/reveal.ts packages/core/test/pricing.test.ts packages/core/test/reveal.test.ts
git commit -m "feat(core): copy pricing, stock and reveal rules"
```

---

### Task 9: Zamawianie kitów

**Files:**
- Create: `packages/core/src/economy/buy.ts`
- Test: `packages/core/test/buy.test.ts`

**Interfaces:**
- Consumes: `orderTotal`, `stockOf` (Task 8), `isRevealed` (Task 8), `ownedCounts` (Task 7), `deliveryDuration`, `xpInfo` (Task 6), `kitById` (Task 2).
- Produces:
  - `type BuyError = 'unknown_kit' | 'not_revealed' | 'out_of_stock' | 'not_enough_rp' | 'bad_qty'`
  - `type BuyResult = { ok: true; order: Order } | { ok: false; error: BuyError }`
  - `buy(state: GameState, kitId: string, qty: number, now: number, hourOfDay: number): BuyResult` (mutuje stan: odejmuje RP, dodaje zamówienie na początek listy, `dur` = deliveryDuration(bieżący poziom), id = `'RB-' + now.toString(36).toUpperCase().slice(-6)`, `nightOrders++` gdy hourOfDay < 4)
  - `affordableQty(state, kitId, now): number` (ile kopii stać, z uwzględnieniem stocku)

- [ ] **Step 1: Test**

`packages/core/test/buy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { affordableQty, buy } from '../src/economy/buy';
import { kitById } from '../src/data/kits';
import { orderTotal } from '../src/economy/pricing';
import { createState } from '../src/state';

describe('buy', () => {
  it('places an order, freezes delivery time and spends RP', () => {
    const s = createState(0, 1);
    s.rp = 1000;
    const r = buy(s, 'brick-build', 2, 5_000, 12);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.items).toEqual([{ id: 'brick-build', qty: 2 }]);
    expect(r.order.total).toBe(orderTotal(kitById('brick-build'), 0, 2));
    expect(r.order.dur).toBe(600);
    expect(r.order.ts).toBe(5_000);
    expect(r.order.id).toMatch(/^RB-[0-9A-Z]{1,6}$/);
    expect(s.rp).toBe(1000 - r.order.total);
    expect(s.orders[0]).toBe(r.order);
    expect(s.stats.nightOrders).toBe(0);
  });

  it('prices the next order from everything already ordered', () => {
    const s = createState(0, 1);
    s.rp = 10_000;
    buy(s, 'brick-build', 1, 0, 12);
    const r = buy(s, 'brick-build', 1, 1, 12);
    if (!r.ok) throw new Error(r.error);
    expect(r.order.total).toBe(147);
  });

  it('rejects unknown, unrevealed, unaffordable and overstocked orders', () => {
    const s = createState(0, 1);
    expect(buy(s, 'nope', 1, 0, 12)).toEqual({ ok: false, error: 'unknown_kit' });
    expect(buy(s, 'abyss', 1, 0, 12)).toEqual({ ok: false, error: 'not_revealed' });
    expect(buy(s, 'brick-build', 0, 0, 12)).toEqual({ ok: false, error: 'bad_qty' });
    s.rp = 1e9;
    const stock = kitById('brick-build').stock;
    expect(buy(s, 'brick-build', stock + 1, 0, 12)).toEqual({ ok: false, error: 'out_of_stock' });
    s.rp = 100;
    expect(buy(s, 'brick-build', 1, 0, 12)).toEqual({ ok: false, error: 'not_enough_rp' });
  });

  it('counts night orders before 4 am', () => {
    const s = createState(0, 1);
    s.rp = 1000;
    buy(s, 'brick-build', 1, 0, 3);
    expect(s.stats.nightOrders).toBe(1);
  });

  it('computes the affordable quantity within stock', () => {
    const s = createState(0, 1);
    s.rp = 128 + 147 + 169; // three copies exactly (128, 147.2, 169.28 -> total rounds to 444)
    expect(affordableQty(s, 'brick-build', 0)).toBe(3);
    s.rp = 1e12;
    expect(affordableQty(s, 'brick-build', 0)).toBe(kitById('brick-build').stock);
    expect(affordableQty(s, 'abyss', 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/buy.ts`:
```ts
import { KITS, kitById } from '../data/kits';
import { deliveryDuration, xpInfo } from './levels';
import { orderTotal, stockOf } from './pricing';
import { ownedCounts } from './production';
import { isRevealed } from './reveal';
import type { GameState, Order } from '../state';

export type BuyError = 'unknown_kit' | 'not_revealed' | 'out_of_stock' | 'not_enough_rp' | 'bad_qty';
export type BuyResult = { ok: true; order: Order } | { ok: false; error: BuyError };

function findKit(id: string) {
  return KITS.find(k => k.id === id);
}

export function buy(state: GameState, kitId: string, qty: number, now: number, hourOfDay: number): BuyResult {
  const kit = findKit(kitId);
  if (!kit) return { ok: false, error: 'unknown_kit' };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: 'bad_qty' };
  if (!isRevealed(state, kit, now)) return { ok: false, error: 'not_revealed' };
  const ownedAll = ownedCounts(state, now, true)[kit.id] ?? 0;
  if (qty > stockOf(kit, ownedAll)) return { ok: false, error: 'out_of_stock' };
  const total = orderTotal(kit, ownedAll, qty);
  if (state.rp < total) return { ok: false, error: 'not_enough_rp' };

  const order: Order = {
    id: 'RB-' + now.toString(36).toUpperCase().slice(-6),
    ts: now,
    dur: deliveryDuration(xpInfo(state.xpTotal).lvl),
    items: [{ id: kit.id, qty }],
    total,
  };
  state.rp -= total;
  state.orders.unshift(order);
  if (hourOfDay < 4) state.stats.nightOrders++;
  return { ok: true, order };
}

export function affordableQty(state: GameState, kitId: string, now: number): number {
  const kit = findKit(kitId);
  if (!kit || !isRevealed(state, kit, now)) return 0;
  const ownedAll = ownedCounts(state, now, true)[kit.id] ?? 0;
  const max = stockOf(kit, ownedAll);
  let q = 0;
  while (q < max && orderTotal(kit, ownedAll, q + 1) <= state.rp) q++;
  return q;
}

export { kitById };
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/buy.ts packages/core/test/buy.test.ts
git commit -m "feat(core): ordering kits with frozen delivery time"
```

---

### Task 10: Klik z combo, krytem i frenzy

**Files:**
- Create: `packages/core/src/economy/click.ts`
- Test: `packages/core/test/click.test.ts`

**Interfaces:**
- Consumes: `cps` (Task 7), `Rng` (Task 4), `GameState`.
- Produces:
  - `COMBO_WINDOW_MS = 700`, `CRIT_CHANCE = 0.05`, `CRIT_MULT = 10`, `FRENZY_MULT = 7`, `CLICK_SHARE = 0.04`
  - `comboMult(n: number): number` (n >= 50 -> 5, >= 25 -> 3, >= 10 -> 2, else 1)
  - `clickValue(state, now): number` = (1 + cps*0.04) * comboMult(state.combo.n) * (now < frenzyUntil ? 7 : 1)
  - `click(state, now, rng): { gain: number; crit: boolean; combo: number }` (mutuje: combo, rp += gain, xpTotal += gain, stats.clicks++, stats.crits++ przy krycie; gain = max(1, round(clickValue * (crit ? 10 : 1))))

Uwaga: `comboMult` w web liczy z `comboN` PO inkrementacji bieżącego kliku; tu tak samo: najpierw aktualizacja combo, potem wartość.

- [ ] **Step 1: Test**

`packages/core/test/click.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CLICK_SHARE, COMBO_WINDOW_MS, CRIT_CHANCE, CRIT_MULT, FRENZY_MULT, click, clickValue, comboMult } from '../src/economy/click';
import { constantRng, sequenceRng } from '../src/rng/rng';
import { createState } from '../src/state';

describe('constants', () => {
  it('match the web game', () => {
    expect([COMBO_WINDOW_MS, CRIT_CHANCE, CRIT_MULT, FRENZY_MULT, CLICK_SHARE]).toEqual([700, 0.05, 10, 7, 0.04]);
  });
});

describe('comboMult', () => {
  it('steps at 10, 25 and 50 hits', () => {
    expect(comboMult(1)).toBe(1);
    expect(comboMult(9)).toBe(1);
    expect(comboMult(10)).toBe(2);
    expect(comboMult(25)).toBe(3);
    expect(comboMult(50)).toBe(5);
    expect(comboMult(999)).toBe(5);
  });
});

describe('click', () => {
  it('gives at least 1 RP with no production and counts stats', () => {
    const s = createState(0, 1);
    const r = click(s, 1_000, constantRng(0.99));
    expect(r).toEqual({ gain: 1, crit: false, combo: 1 });
    expect(s.rp).toBe(129);
    expect(s.xpTotal).toBe(1);
    expect(s.stats.clicks).toBe(1);
  });

  it('builds combo inside the 700 ms window and breaks it outside', () => {
    const s = createState(0, 1);
    let t = 0;
    for (let i = 0; i < 10; i++) { t += 500; click(s, t, constantRng(0.99)); }
    expect(s.combo.n).toBe(10);
    expect(clickValue(s, t)).toBe(2); // (1 + 0) * x2
    click(s, t + 700, constantRng(0.99));
    expect(s.combo.n).toBe(1);
  });

  it('applies crit x10 and frenzy x7 on top of production share', () => {
    const s = createState(0, 1);
    s.orders.push({ id: 'o', ts: 0, dur: 1, items: [{ id: 'brick-build', qty: 100 }], total: 0 });
    const now = 10_000; // delivered; 100 RP/s, 3200 GB => 8 milestones
    const base = 1 + 100 * 1.15 ** 8 * 0.04;
    expect(clickValue(s, now)).toBeCloseTo(base, 6);
    const crit = click(s, now, sequenceRng([0.01]));
    expect(crit.crit).toBe(true);
    expect(crit.gain).toBe(Math.max(1, Math.round(base * 10)));
    expect(s.stats.crits).toBe(1);
    s.frenzyUntil = now + 20_000;
    expect(clickValue(s, now + 1_000)).toBeCloseTo(base * 7, 6);
    expect(clickValue(s, now + 20_000)).toBeCloseTo(base, 6);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/click.ts`:
```ts
import { cps } from './production';
import type { Rng } from '../rng/rng';
import type { GameState } from '../state';

export const COMBO_WINDOW_MS = 700;
export const CRIT_CHANCE = 0.05;
export const CRIT_MULT = 10;
export const FRENZY_MULT = 7;
/** Click = 4% of production (history: 1% -> 2% -> 4%; at 1% the click felt useless). */
export const CLICK_SHARE = 0.04;

/** Rhythmic clicking builds a combo: 10 fast hits = x2, 25 = x3, 50 = x5. */
export function comboMult(n: number): number {
  return n >= 50 ? 5 : n >= 25 ? 3 : n >= 10 ? 2 : 1;
}

export function clickValue(state: GameState, now: number): number {
  const frenzy = now < state.frenzyUntil ? FRENZY_MULT : 1;
  return (1 + cps(state, now) * CLICK_SHARE) * comboMult(state.combo.n) * frenzy;
}

export interface ClickResult { gain: number; crit: boolean; combo: number }

export function click(state: GameState, now: number, rng: Rng): ClickResult {
  state.combo.n = now - state.combo.last < COMBO_WINDOW_MS ? state.combo.n + 1 : 1;
  state.combo.last = now;
  state.stats.clicks++;
  const crit = rng() < CRIT_CHANCE;
  if (crit) state.stats.crits++;
  const gain = Math.max(1, Math.round(clickValue(state, now) * (crit ? CRIT_MULT : 1)));
  state.rp += gain;
  state.xpTotal += gain;
  return { gain, crit, combo: state.combo.n };
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/click.ts packages/core/test/click.test.ts
git commit -m "feat(core): click with combo, crit and frenzy"
```

---

### Task 11: Tick produkcji i zarobki offline

**Files:**
- Create: `packages/core/src/economy/tick.ts`
- Test: `packages/core/test/tick.test.ts`

**Interfaces:**
- Consumes: `cps`, `isDelivered`, `prodMult`, `gbOwned` (Task 7), `kitById` (Task 2), `revealedCount` (Task 8), `milestoneIndex`.
- Produces:
  - `tick(state, dtSec: number, now: number): TickEvents` (rp i xpTotal += cps*dt; lastSeen = now; zwraca zdarzenia do UI: `{ newReveals: number; milestone: number | null }`; aktualizuje `revealSeen` i `msSeen`; dt <= 0 ignorowane)
  - `interface TickEvents { newReveals: number; milestone: number | null }`
  - `OFFLINE_CAP_SEC = 3 * 3600` (spec 6.4, wartość startowa)
  - `offlineEarnings(state, now, capSec = OFFLINE_CAP_SEC): number` (czysta: suma po zamówieniach: kitProd * max(0, min(now, lastSeen+cap) - max(lastSeen, deliveredTs)) / 1000, po dropach analogicznie od `ts`, razy prodMult liczony dla `now`; delta ujemna daje 0; wynik floor)
  - `applyOffline(state, now, capSec = OFFLINE_CAP_SEC): number` (dodaje wynik do rp i xpTotal gdy >= 10, ustawia lastSeen = now, zwraca dodaną kwotę)

- [ ] **Step 1: Test**

`packages/core/test/tick.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_SEC, applyOffline, offlineEarnings, tick } from '../src/economy/tick';
import { KITS } from '../src/data/kits';
import { createState } from '../src/state';

function delivered(qty: number, id = 'brick-build') {
  const s = createState(0, 1);
  s.orders.push({ id: 'o', ts: 0, dur: 1, items: [{ id, qty }], total: 0 });
  s.lastSeen = 10_000;
  return s;
}

describe('tick', () => {
  it('accrues production into rp and lifetime xp', () => {
    const s = delivered(1); // 1 RP/s, 32 GB => x1.15^2
    const ev = tick(s, 2, 10_000);
    expect(s.rp).toBeCloseTo(128 + 2 * 1.15 ** 2, 10);
    expect(s.xpTotal).toBeCloseTo(2 * 1.15 ** 2, 10);
    expect(s.lastSeen).toBe(10_000);
    expect(ev.newReveals).toBe(0);
  });

  it('ignores non-positive dt', () => {
    const s = delivered(1);
    tick(s, 0, 10_000);
    tick(s, -5, 10_000);
    expect(s.rp).toBe(128);
  });

  it('reports new reveals once and the first milestone once', () => {
    const s = delivered(1);
    s.revealSeen = 2;
    s.xpTotal = KITS[2]!.rpCost * 8; // reveals tier 2 (and maybe more)
    const ev = tick(s, 1, 10_000);
    expect(ev.newReveals).toBeGreaterThanOrEqual(1);
    expect(s.revealSeen).toBe(2 + ev.newReveals);
    expect(tick(s, 1, 11_000).newReveals).toBe(0);
  });

  it('reports the milestone crossing exactly once', () => {
    const s = delivered(1); // 32 GB => milestones 16 and 32 reached
    const first = tick(s, 1, 10_000);
    expect(first.milestone).toBe(32);
    expect(s.msSeen).toBe(32);
    expect(tick(s, 1, 11_000).milestone).toBeNull();
  });
});

describe('offline', () => {
  it('pays production from max(lastSeen, delivery) to now, capped', () => {
    const s = delivered(2); // 2 RP/s raw, 64 GB => x1.15^3
    s.lastSeen = 10_000;
    const mult = 1.15 ** 3;
    expect(offlineEarnings(s, 10_000 + 100_000)).toBe(Math.floor(2 * 100 * mult));
    expect(offlineEarnings(s, 10_000 + 10 * 3600 * 1000)).toBe(Math.floor(2 * OFFLINE_CAP_SEC * mult));
    expect(OFFLINE_CAP_SEC).toBe(3 * 3600);
  });

  it('starts counting at delivery for orders delivered while away', () => {
    const s = createState(0, 1);
    s.orders.push({ id: 'o', ts: 0, dur: 50, items: [{ id: 'brick-build', qty: 1 }], total: 0 });
    s.lastSeen = 10_000; // delivered at 50 s, seen at 10 s
    expect(offlineEarnings(s, 110_000)).toBe(Math.floor(60 * 1.15 ** 2));
  });

  it('counts case drops from their timestamp', () => {
    const s = createState(0, 1);
    s.drops.push({ id: 'brick-build', ts: 20_000, rarity: 'common' });
    s.lastSeen = 10_000;
    expect(offlineEarnings(s, 30_000)).toBe(Math.floor(10 * 1.15 ** 2));
  });

  it('never pays for negative deltas and applies only from 10 RP', () => {
    const s = delivered(1);
    expect(offlineEarnings(s, 5_000)).toBe(0);
    expect(applyOffline(s, 5_000)).toBe(0);
    expect(s.lastSeen).toBe(10_000); // clock went backwards: lastSeen never moves back
    const t = delivered(1);
    t.lastSeen = 10_000;
    expect(applyOffline(t, 12_000)).toBe(0); // 2 s x 1.32 = 2 RP < 10
    expect(t.rp).toBe(128);
    const u = delivered(1);
    u.lastSeen = 10_000;
    const gain = applyOffline(u, 110_000);
    expect(gain).toBe(Math.floor(100 * 1.15 ** 2));
    expect(u.rp).toBe(128 + gain);
    expect(u.xpTotal).toBe(gain);
    expect(u.lastSeen).toBe(110_000);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/economy/tick.ts`:
```ts
import { kitById } from '../data/kits';
import { cps, gbOwned, milestoneIndex, prodMult, GB_MILESTONES } from './production';
import { revealedCount } from './reveal';
import type { GameState } from '../state';

export interface TickEvents { newReveals: number; milestone: number | null }

export function tick(state: GameState, dtSec: number, now: number): TickEvents {
  if (dtSec > 0) {
    const gain = cps(state, now) * dtSec;
    state.rp += gain;
    state.xpTotal += gain;
  }
  state.lastSeen = now;

  const revealed = revealedCount(state, now);
  let newReveals = 0;
  if (revealed > state.revealSeen) {
    newReveals = revealed - state.revealSeen;
    state.revealSeen = revealed;
  }

  const idx = milestoneIndex(gbOwned(state, now));
  const reached = idx > 0 ? (GB_MILESTONES[idx - 1] as number) : 0;
  let milestone: number | null = null;
  if (reached !== state.msSeen) {
    milestone = reached > state.msSeen ? reached : null;
    state.msSeen = reached;
  }
  return { newReveals, milestone };
}

/** Offline production stops after this many seconds (spec 6.4, starting value). */
export const OFFLINE_CAP_SEC = 3 * 3600;

export function offlineEarnings(state: GameState, now: number, capSec = OFFLINE_CAP_SEC): number {
  const end = Math.min(now, state.lastSeen + capSec * 1000);
  if (end <= state.lastSeen) return 0;
  let raw = 0;
  for (const o of state.orders) {
    const deliveredTs = o.ts + o.dur * 1000;
    const from = Math.max(state.lastSeen, deliveredTs);
    if (end > from) {
      let prod = 0;
      for (const it of o.items) prod += kitById(it.id).rpProd * it.qty;
      raw += prod * (end - from) / 1000;
    }
  }
  for (const d of state.drops) {
    const from = Math.max(state.lastSeen, d.ts);
    if (end > from) raw += kitById(d.id).rpProd * (end - from) / 1000;
  }
  return Math.floor(raw * prodMult(gbOwned(state, now)));
}

export function applyOffline(state: GameState, now: number, capSec = OFFLINE_CAP_SEC): number {
  const gain = offlineEarnings(state, now, capSec);
  state.lastSeen = Math.max(state.lastSeen, now);
  if (gain < 10) return 0;
  state.rp += gain;
  state.xpTotal += gain;
  return gain;
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/economy/tick.ts packages/core/test/tick.test.ts
git commit -m "feat(core): production tick, reveal and milestone events, capped offline earnings"
```

---

### Task 12: Zapis: serializacja, walidacja, migracje

**Files:**
- Create: `packages/core/src/save/save.ts`
- Create: `packages/core/test/fixtures/save-v1.json`
- Test: `packages/core/test/save.test.ts`

**Interfaces:**
- Consumes: `GameState`, `createState` (Task 5).
- Produces:
  - `SAVE_VERSION = 1`
  - `serialize(state: GameState): string` (JSON)
  - `type LoadResult = { ok: true; state: GameState; migratedFrom: number | null } | { ok: false; error: 'parse' | 'shape' | 'version' }`
  - `deserialize(text: string, now: number): LoadResult` (parsuje, uruchamia migracje `MIGRATIONS[v]` od wersji zapisu do `SAVE_VERSION`, waliduje kształt, przycina `lastSeen` do `now` jeśli z przyszłości)
  - `MIGRATIONS: Record<number, (raw: unknown) => unknown>` (pusty rejestr w v1; klucz = wersja źródłowa)

- [ ] **Step 1: Fixture i test**

`packages/core/test/fixtures/save-v1.json`:
```json
{
  "v": 1,
  "createdAt": 1000,
  "lastSeen": 5000,
  "seed": 7,
  "rp": 512.5,
  "xpTotal": 900,
  "orders": [{ "id": "RB-ABC123", "ts": 2000, "dur": 600, "items": [{ "id": "brick-build", "qty": 2 }], "total": 275 }],
  "drops": [{ "id": "sakura", "ts": 3000, "rarity": "common" }],
  "combo": { "n": 0, "last": 0 },
  "frenzyUntil": 0,
  "revealSeen": 2,
  "msSeen": 0,
  "stats": { "clicks": 12, "crits": 1, "nightOrders": 0, "golden": 0 }
}
```

`packages/core/test/save.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, deserialize, serialize } from '../src/save/save';
import { createState } from '../src/state';

const fixture = readFileSync(new URL('./fixtures/save-v1.json', import.meta.url), 'utf8');

describe('save', () => {
  it('round-trips a fresh state', () => {
    const s = createState(1_000, 3);
    s.rp = 999;
    const r = deserialize(serialize(s), 2_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state).toEqual(s);
      expect(r.migratedFrom).toBeNull();
    }
  });

  it('loads the v1 fixture', () => {
    expect(SAVE_VERSION).toBe(1);
    const r = deserialize(fixture, 10_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.rp).toBe(512.5);
      expect(r.state.orders[0]!.items[0]).toEqual({ id: 'brick-build', qty: 2 });
      expect(r.state.drops[0]!.rarity).toBe('common');
    }
  });

  it('rejects garbage, wrong shapes and future versions', () => {
    expect(deserialize('not json', 0)).toEqual({ ok: false, error: 'parse' });
    expect(deserialize('{"v":1}', 0)).toEqual({ ok: false, error: 'shape' });
    expect(deserialize(JSON.stringify({ ...JSON.parse(fixture), v: 99 }), 0)).toEqual({ ok: false, error: 'version' });
    expect(deserialize(JSON.stringify({ ...JSON.parse(fixture), orders: [{ id: 1 }] }), 0)).toEqual({ ok: false, error: 'shape' });
  });

  it('clamps lastSeen from the future to now', () => {
    const r = deserialize(JSON.stringify({ ...JSON.parse(fixture), lastSeen: 999_999 }), 10_000);
    expect(r.ok && r.state.lastSeen).toBe(10_000);
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL**

- [ ] **Step 3: Implementacja**

`packages/core/src/save/save.ts`:
```ts
import type { Drop, GameState, Order, Stats } from '../state';

export const SAVE_VERSION = 1;

/** Keyed by source version: MIGRATIONS[1] turns a v1 document into v2. Empty while v1 is current. */
export const MIGRATIONS: Record<number, (raw: unknown) => unknown> = {};

export type LoadResult =
  | { ok: true; state: GameState; migratedFrom: number | null }
  | { ok: false; error: 'parse' | 'shape' | 'version' };

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function isOrder(x: unknown): x is Order {
  return isObj(x) && isStr(x.id) && isNum(x.ts) && isNum(x.dur) && isNum(x.total) &&
    Array.isArray(x.items) && x.items.every(it => isObj(it) && isStr(it.id) && isNum(it.qty));
}

const RARITIES = new Set(['common', 'rare', 'epic', 'legendary']);
function isDrop(x: unknown): x is Drop {
  return isObj(x) && isStr(x.id) && isNum(x.ts) && isStr(x.rarity) && RARITIES.has(x.rarity);
}

function isStats(x: unknown): x is Stats {
  return isObj(x) && isNum(x.clicks) && isNum(x.crits) && isNum(x.nightOrders) && isNum(x.golden);
}

function validate(raw: unknown): GameState | null {
  if (!isObj(raw)) return null;
  if (raw.v !== SAVE_VERSION) return null;
  if (!isNum(raw.createdAt) || !isNum(raw.lastSeen) || !isNum(raw.seed) || !isNum(raw.rp) || !isNum(raw.xpTotal)) return null;
  if (!Array.isArray(raw.orders) || !raw.orders.every(isOrder)) return null;
  if (!Array.isArray(raw.drops) || !raw.drops.every(isDrop)) return null;
  if (!isObj(raw.combo) || !isNum(raw.combo.n) || !isNum(raw.combo.last)) return null;
  if (!isNum(raw.frenzyUntil) || !isNum(raw.revealSeen) || !isNum(raw.msSeen)) return null;
  if (!isStats(raw.stats)) return null;
  return {
    v: 1,
    createdAt: raw.createdAt, lastSeen: raw.lastSeen, seed: raw.seed,
    rp: raw.rp, xpTotal: raw.xpTotal,
    orders: raw.orders, drops: raw.drops,
    combo: { n: raw.combo.n, last: raw.combo.last },
    frenzyUntil: raw.frenzyUntil, revealSeen: raw.revealSeen, msSeen: raw.msSeen,
    stats: { ...raw.stats },
  };
}

export function deserialize(text: string, now: number): LoadResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'parse' }; }
  if (!isObj(raw) || !isNum(raw.v)) return { ok: false, error: 'shape' };
  if (raw.v > SAVE_VERSION) return { ok: false, error: 'version' };
  const from = raw.v;
  let v = raw.v;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, error: 'version' };
    raw = step(raw);
    v++;
  }
  const state = validate(raw);
  if (!state) return { ok: false, error: 'shape' };
  if (state.lastSeen > now) state.lastSeen = now;
  return { ok: true, state, migratedFrom: from === SAVE_VERSION ? null : from };
}
```

- [ ] **Step 4: Testy zielone**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/save packages/core/test/save.test.ts packages/core/test/fixtures/save-v1.json
git commit -m "feat(core): save serialization, validation and migration registry"
```

---

### Task 13: Publiczne API core i strażnik czystości

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/purity.test.ts`

**Interfaces:**
- Produces: `@rnc/core` eksportuje wszystko z zadań 2-12 (typy i funkcje) pod jednym wejściem.

- [ ] **Step 1: Test czystości**

`packages/core/test/purity.test.ts`:
```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('core purity', () => {
  const files = walk(new URL('../src', import.meta.url).pathname);

  it('never reads the wall clock or Math.random', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/Date\.now\(/);
      expect(src, f).not.toMatch(/new Date\(/);
      expect(src, f).not.toMatch(/Math\.random\(/);
    }
  });

  it('never touches the DOM or Capacitor', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/\bdocument\b|\bwindow\b|localStorage|@capacitor/);
    }
  });

  it('contains no long dashes', () => {
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Uruchomić** (powinien przejść od razu; jeśli nie, poprawić wskazany plik)

- [ ] **Step 3: Index**

`packages/core/src/index.ts`:
```ts
export const CORE_VERSION = '0.1.0';

export { KITS, kitById, capacityGB } from './data/kits';
export type { KitDef } from './data/kits';
export { fmtRP, fmtDuration } from './i18n/format';
export { mulberry32, constantRng, sequenceRng } from './rng/rng';
export type { Rng } from './rng/rng';
export { createState, START_RP } from './state';
export type { GameState, Order, OrderItem, Drop, Rarity, Stats } from './state';
export { xpInfo, deliveryDuration, featureUnlocked, FEATURE_LVL, STAGE_TIMES } from './economy/levels';
export type { XpInfo, FeatureId } from './economy/levels';
export { isDelivered, ownedCounts, gbOwned, milestoneIndex, prodMult, cps, GB_MILESTONES } from './economy/production';
export { copyCost, orderTotal, stockOf, COPY_GROWTH } from './economy/pricing';
export { isRevealed, revealedCount, REVEAL_MULT } from './economy/reveal';
export { buy, affordableQty } from './economy/buy';
export type { BuyError, BuyResult } from './economy/buy';
export { click, clickValue, comboMult, COMBO_WINDOW_MS, CRIT_CHANCE, CRIT_MULT, FRENZY_MULT, CLICK_SHARE } from './economy/click';
export type { ClickResult } from './economy/click';
export { tick, offlineEarnings, applyOffline, OFFLINE_CAP_SEC } from './economy/tick';
export type { TickEvents } from './economy/tick';
export { serialize, deserialize, SAVE_VERSION, MIGRATIONS } from './save/save';
export type { LoadResult } from './save/save';
```

- [ ] **Step 4: Testy i typecheck zielone**

```bash
npm test -w @rnc/core && npm run typecheck -w @rnc/core
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/test/purity.test.ts
git commit -m "feat(core): public api and purity guard"
```

---

### Task 14: Symulator balansu

**Files:**
- Create: `packages/core/src/sim/simulate.ts`
- Create: `packages/core/src/sim/cli.ts`
- Create: `packages/core/src/sim/baseline.json` (nagrywany w kroku 5)
- Test: `packages/core/test/sim.test.ts`

**Interfaces:**
- Consumes: całe API core.
- Produces:
```ts
interface Profile {
  name: 'idle' | 'continuous' | 'passive' | 'moderate' | 'active';
  sessionsPerDay: number;   // sesje rozłożone równo w dobie
  sessionSec: number;       // długość sesji w sekundach (86400 = cały dzień, czyli gra ciągła)
  clicksPerSec: number;     // w trakcie sesji
}
const PROFILES: Record<Profile['name'], Profile>
// idle:       1 x 86400 s x 0 klików   (gra ciągła bez klikania: czysta produkcja)
// continuous: 1 x 86400 s x 3 kliki    (gra ciągła, umiarkowane klikanie: linia bazowa odkryć)
// passive:    1 x 300 s x 0 klików     (jedna sesja dziennie)
// moderate:   4 x 300 s x 3 kliki
// active:     8 x 600 s x 8 klików
interface SimResult {
  profile: Profile['name'];
  revealAtSec: number[];        // indeks = tier, sekunda symulacji odkrycia (Infinity gdy nie odkryto)
  cpsAtReveal: number[];        // produkcja w chwili odkrycia tieru
  finalCps: number;
  finalXp: number;
}
function simulate(profile: Profile, span: { seconds: number }, seed?: number): SimResult
function activeProductionRatio(cpsValue: number): number
// = (cps + oczekiwany dochód z klików przy 8 klikach/s, combo x5 i średnim krycie 1.45) / cps
```
- Polityka gracza (identyczna dla profili, jak "szybki zakup" z gry): w każdej sekundzie sesji kupuje po jednej kopii najdroższego odkrytego kitu, na który go stać, dopóki go stać. Poza sesją nie kupuje. Klik w sesji: `clicksPerSec` kliknięć na sekundę rozłożonych równo (przy >= 2/s combo rośnie, bo odstęp < 700 ms). Czas: krok 1 s, `tick()` co krok; między sesjami `applyOffline()` z limitem 3 h.
- Wydajność: po każdym kroku dostarczone zamówienia są scalane w jedno syntetyczne zamówienie na kit (`ts: 0, dur: 0`), inaczej tysiące jednokopiowych zamówień spowalniają `ownedCounts` do kwadratu. Scalanie nie zmienia wyniku: wszystkie scalone zamówienia były już dostarczone przed `lastSeen`.

- [ ] **Step 1: Test**

`packages/core/test/sim.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KITS } from '../src/data/kits';
import { revealedCount } from '../src/economy/reveal';
import { PROFILES, activeProductionRatio, simulate } from '../src/sim/simulate';
import { createState } from '../src/state';

const H = 3600;
const baselinePath = new URL('../src/sim/baseline.json', import.meta.url);

describe('simulator', () => {
  const continuous = simulate(PROFILES.continuous, { seconds: 4 * H }, 1);
  const idle = simulate(PROFILES.idle, { seconds: 6 * H }, 1);

  it('1. reveals the early tiers within a sane window for continuous moderate clicking', () => {
    expect(continuous.revealAtSec[2]).toBeGreaterThan(3 * 60);
    expect(continuous.revealAtSec[2]).toBeLessThan(15 * 60);
    expect(continuous.revealAtSec[6]).toBeLessThan(90 * 60);
  });

  it('2. keeps effective production growth per tier below 2.0 (ladder x milestone bonus)', () => {
    // tier 1 is exempt: rpProd 1 -> 2 is a rounding artefact of the Fibonacci ladder
    for (let t = 2; t < KITS.length; t++) {
      const growth = (KITS[t]!.rpProd / KITS[t - 1]!.rpProd) * 1.15;
      expect(growth, `tier ${t}`).toBeLessThan(2.0);
    }
  });

  it('3. never shrinks reveal gaps for a pure idle player from tier 4 on', () => {
    const at = idle.revealAtSec;
    for (let t = 5; t < at.length; t++) {
      const a = at[t - 2] as number, b = at[t - 1] as number, c = at[t] as number;
      if (!Number.isFinite(c)) break;
      expect(c - b, `gap at tier ${t}`).toBeGreaterThanOrEqual((b - a) * 0.9);
    }
    expect(Number.isFinite(at[5])).toBe(true); // the 6 h run must reach at least tier 5 for the test to mean anything
  });

  it('4. rewards full activity between x2 and x3.5 of passive production', () => {
    for (const c of [100, 1e4, 1e6, 1e9]) {
      const r = activeProductionRatio(c);
      expect(r, `cps ${c}`).toBeGreaterThan(2);
      expect(r, `cps ${c}`).toBeLessThan(3.5);
    }
  });

  it('5. keeps the case invariant at level 15', () => {
    const s = createState(0, 1);
    s.xpTotal = 50 * 2 ** 15;
    expect(revealedCount(s, 0)).toBeGreaterThanOrEqual(11);
  });

  it('6. stays within 20% of the recorded baseline for tiers 2-10', () => {
    if (!existsSync(baselinePath)) return; // recorded by `npm run sim -- --record` in Step 5
    const base = JSON.parse(readFileSync(baselinePath, 'utf8')) as { continuous: (number | null)[] };
    for (let t = 2; t <= 10; t++) {
      const b = base.continuous[t];
      if (b === null || b === undefined) continue;
      const v = continuous.revealAtSec[t] as number;
      expect(v, `tier ${t}`).toBeGreaterThan(b * 0.8);
      expect(v, `tier ${t}`).toBeLessThan(b * 1.2);
    }
  });

  it('runs the session profiles without errors', () => {
    for (const name of ['passive', 'moderate', 'active'] as const) {
      const r = simulate(PROFILES[name], { seconds: 24 * H }, 1);
      expect(r.finalXp).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Uruchomić, oczekiwany FAIL** (brak modułu `simulate`)

- [ ] **Step 3: Implementacja symulatora**

`packages/core/src/sim/simulate.ts`:
```ts
import { KITS } from '../data/kits';
import { buy } from '../economy/buy';
import { CLICK_SHARE, CRIT_CHANCE, CRIT_MULT, click, comboMult } from '../economy/click';
import { isDelivered, cps } from '../economy/production';
import { revealedCount } from '../economy/reveal';
import { applyOffline, tick } from '../economy/tick';
import { mulberry32 } from '../rng/rng';
import { createState, type GameState, type Order } from '../state';

export interface Profile {
  name: 'idle' | 'continuous' | 'passive' | 'moderate' | 'active';
  sessionsPerDay: number;
  sessionSec: number;
  clicksPerSec: number;
}

const DAY = 86_400;

export const PROFILES: Record<Profile['name'], Profile> = {
  idle: { name: 'idle', sessionsPerDay: 1, sessionSec: DAY, clicksPerSec: 0 },
  continuous: { name: 'continuous', sessionsPerDay: 1, sessionSec: DAY, clicksPerSec: 3 },
  passive: { name: 'passive', sessionsPerDay: 1, sessionSec: 300, clicksPerSec: 0 },
  moderate: { name: 'moderate', sessionsPerDay: 4, sessionSec: 300, clicksPerSec: 3 },
  active: { name: 'active', sessionsPerDay: 8, sessionSec: 600, clicksPerSec: 8 },
};

export interface SimResult {
  profile: Profile['name'];
  revealAtSec: number[];
  cpsAtReveal: number[];
  finalCps: number;
  finalXp: number;
}

/** Buy one copy of the priciest revealed kit you can afford (mirrors the game's quick buy). */
function buyBest(state: GameState, now: number): boolean {
  for (let i = KITS.length - 1; i >= 0; i--) {
    const k = KITS[i]!;
    if (k.rpCost > state.rp) continue;
    const r = buy(state, k.id, 1, now, 12);
    if (r.ok) return true;
    if (r.error === 'not_enough_rp' || r.error === 'out_of_stock' || r.error === 'not_revealed') continue;
    throw new Error('unexpected buy error: ' + r.error);
  }
  return false;
}

/** Merge delivered orders into one synthetic order per kit. Pure optimisation, see plan notes. */
function compact(state: GameState, now: number): void {
  const merged = new Map<string, number>();
  const pending: Order[] = [];
  for (const o of state.orders) {
    if (isDelivered(o, now)) for (const it of o.items) merged.set(it.id, (merged.get(it.id) ?? 0) + it.qty);
    else pending.push(o);
  }
  state.orders = pending;
  for (const [id, qty] of merged) state.orders.push({ id: 'SIM-' + id, ts: 0, dur: 0, items: [{ id, qty }], total: 0 });
}

export function simulate(profile: Profile, span: { seconds: number }, seed = 1): SimResult {
  const rng = mulberry32(seed);
  const state = createState(0, seed);
  const revealAtSec: number[] = new Array(KITS.length).fill(Infinity);
  const cpsAtReveal: number[] = new Array(KITS.length).fill(NaN);
  const gap = DAY / profile.sessionsPerDay;
  const clickStep = profile.clicksPerSec > 0 ? Math.floor(1000 / profile.clicksPerSec) : 0;
  let nextSession = 0;
  let sec = 0;

  const noteReveals = (now: number) => {
    const n = revealedCount(state, now);
    for (let t = 0; t < n; t++) {
      if (revealAtSec[t] === Infinity) {
        revealAtSec[t] = sec;
        cpsAtReveal[t] = cps(state, now);
      }
    }
  };

  while (sec < span.seconds) {
    for (let s = 0; s < profile.sessionSec && sec < span.seconds; s++, sec++) {
      const now = sec * 1000;
      for (let c = 0; c < profile.clicksPerSec; c++) click(state, now + c * clickStep, rng);
      while (buyBest(state, now)) { /* keep buying while affordable */ }
      tick(state, 1, now);
      compact(state, now);
      noteReveals(now);
    }
    nextSession += gap;
    const wake = Math.min(span.seconds, Math.max(sec, Math.floor(nextSession)));
    if (wake > sec) {
      sec = wake;
      applyOffline(state, sec * 1000);
      compact(state, sec * 1000);
      noteReveals(sec * 1000);
    }
  }

  const end = sec * 1000;
  return { profile: profile.name, revealAtSec, cpsAtReveal, finalCps: cps(state, end), finalXp: state.xpTotal };
}

/**
 * Total production of a fully active player (8 clicks/s, combo x5, average crit) relative to
 * pure passive production. The spec asks for a value between 2 and 3.5.
 */
export function activeProductionRatio(cpsValue: number): number {
  const avgCrit = 1 - CRIT_CHANCE + CRIT_CHANCE * CRIT_MULT;
  const perClick = (1 + cpsValue * CLICK_SHARE) * comboMult(50) * avgCrit;
  return (cpsValue + perClick * 8) / cpsValue;
}
```

`packages/core/src/sim/cli.ts`:
```ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fmtDuration, fmtRP } from '../i18n/format';
import { PROFILES, activeProductionRatio, simulate } from './simulate';

const record = process.argv.includes('--record');
const H = 3600;
const runs = [
  simulate(PROFILES.continuous, { seconds: 4 * H }, 1),
  simulate(PROFILES.idle, { seconds: 6 * H }, 1),
  simulate(PROFILES.passive, { seconds: 72 * H }, 1),
  simulate(PROFILES.moderate, { seconds: 72 * H }, 1),
  simulate(PROFILES.active, { seconds: 72 * H }, 1),
];

for (const r of runs) {
  console.log(`\n== ${r.profile} == final cps ${fmtRP(r.finalCps)}/s, lifetime ${fmtRP(r.finalXp)} RP`);
  let prev = 0;
  r.revealAtSec.forEach((t, i) => {
    if (!Number.isFinite(t) || i < 2) return;
    console.log(`tier ${String(i).padStart(2)}  reveal ${fmtDuration(t).padStart(8)}  gap ${fmtDuration(t - prev).padStart(8)}  cps ${fmtRP(r.cpsAtReveal[i] as number).padStart(8)}`);
    prev = t;
  });
}
console.log(`\nactive/passive production ratio at 1e6 cps: ${activeProductionRatio(1e6).toFixed(2)}`);

if (record) {
  const out = fileURLToPath(new URL('./baseline.json', import.meta.url));
  const continuous = runs[0]!;
  writeFileSync(out, JSON.stringify({
    recordedWith: 'continuous profile, 4 h, seed 1',
    continuous: continuous.revealAtSec.map(v => (Number.isFinite(v) ? v : null)),
  }, null, 2) + '\n');
  console.log(`baseline written to ${out}`);
}
```

- [ ] **Step 4: Uruchomić testy** (`npm test -w @rnc/core`). Test 6 pomija się, bo pliku linii bazowej jeszcze nie ma. Jeśli test 1 lub 3 nie przechodzi, NIE zmieniać stałych ekonomii: sprawdzić politykę zakupów, scalanie i krok czasu (spec, rozdział 8), a różnicę opisać w commicie.

- [ ] **Step 5: Zapisać linię bazową i obejrzeć raport**

```bash
npm run sim -w @rnc/core -- --record
```
W raporcie profilu continuous sprawdzić, że odkrycia tierów 2-6 wypadają rzędu kilku do kilkudziesięciu minut i że odstępy w profilu idle rosną. Zapisać faktyczne liczby tierów 2-6 w opisie commita.

- [ ] **Step 6: Testy zielone z linią bazową**

```bash
npm test -w @rnc/core && npm run typecheck -w @rnc/core
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/sim packages/core/test/sim.test.ts
git commit -m "feat(core): balance simulator with recorded reveal baseline"
```

---

### Task 15: CI i README pakietu core

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `packages/core/README.md`
- Create: `scripts/verify-lang.mjs`
- Modify: `package.json` (skrypt `verify:lang`)

**Interfaces:**
- Produces: CI uruchamia `npm ci`, `npm run typecheck`, `npm test`, `npm run verify:lang` na każdym pushu i PR.

- [ ] **Step 1: Skrypt weryfikacji języków** (komplet kluczy względem `lang/en.json`, brak długich myślników)

`scripts/verify-lang.mjs`:
```js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../lang/', import.meta.url).pathname;
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
let errors = 0;

for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  if (/[\u2013\u2014]/.test(text)) { console.error(`${f}: contains a long dash`); errors++; }
  const data = JSON.parse(text);
  for (const k of Object.keys(en)) {
    if (!(k in data)) { console.error(`${f}: missing key ${k}`); errors++; }
    else if (typeof data[k] === 'string' && data[k].trim() === '') { console.error(`${f}: empty ${k}`); errors++; }
  }
}
if (files.length !== 11) { console.error(`expected 11 language files, found ${files.length}`); errors++; }
if (errors) { console.error(`${errors} problem(s)`); process.exit(1); }
console.log(`lang ok: ${files.length} files, ${Object.keys(en).length} keys`);
```

Dodać do root `package.json` w `scripts`: `"verify:lang": "node scripts/verify-lang.mjs"`.

```bash
npm run verify:lang
```
Oczekiwane: `lang ok: 11 files, N keys`. Jeśli skrypt zgłasza brakujące klucze (pliki z rambuy mogą nie być kompletne względem en), dopisać brakujące klucze z wartością angielską do danego pliku i zanotować to w commicie.

- [ ] **Step 2: Workflow CI**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run verify:lang
```

- [ ] **Step 3: README core**

`packages/core/README.md`:
```markdown
# @rnc/core

Pure game logic for RamNeverComes Mobile. No DOM, no wall clock, no `Math.random`: every function takes `now` (ms) and, where it needs randomness, an `Rng`.

## Modules

- `data/kits` - the 59-kit ladder generated from the web game (`scripts/extract-kits.mjs`).
- `economy/levels` - XP, levels, delivery duration, feature unlock levels.
- `economy/production` - ownership, GB, milestones (`prodMult = 1.15^n`), `cps`.
- `economy/pricing` - copy cost (x1.15), order totals, stock.
- `economy/reveal` - reveal rule (first two rungs, then 8x price of lifetime RP).
- `economy/buy` - placing orders with frozen delivery time.
- `economy/click` - click value with combo (10/25/50 -> x2/x3/x5), crit (5%, x10), frenzy (x7).
- `economy/tick` - production tick, reveal and milestone events, capped offline earnings.
- `save` - serialization, validation, migration registry.
- `sim` - balance simulator (`npm run sim`, `-- --record` refreshes `baseline.json`).

## Balance rules enforced by tests

1. Continuous play with 3 clicks/s reveals tier 2 within 3-15 min and tier 6 within 90 min.
2. Ladder production growth times the milestone bonus stays below 2.0 per tier (from tier 2).
3. Reveal gaps never shrink for a pure idle player (from tier 4).
4. A fully active player (8 clicks/s, combo x5, average crit) produces between x2 and x3.5 of passive.
5. Level 15 reveals at least 11 kits (case invariant).
6. Tiers 2-10 reveal within ±20% of `sim/baseline.json` (continuous profile).

Changing any economy constant without green simulator tests does not pass CI.
```

- [ ] **Step 4: Wszystko zielone**

```bash
npm run typecheck && npm test && npm run verify:lang
```

- [ ] **Step 5: Commit**

```bash
git add .github package.json scripts/verify-lang.mjs packages/core/README.md lang
git commit -m "chore: ci workflow, language verification and core readme"
```

---

## Self-review (wykonany przy pisaniu planu)

- **Pokrycie specu (zakres planu 1)**: rozdział 2 (struktura core) - Task 1, 13; rozdział 5: drabinka, koszty, odkrycia - Task 2, 8; klik - Task 10; poziomy, dostawy, instant buy (`deliveryDuration <= 1`) - Task 6, 9; kamienie GB - Task 7; offline z limitem (6.4, część logiczna) - Task 11; rozdział 7 (stan, zapis, migracje, czas z osłoną) - Task 5, 11, 12; rozdział 8 (symulator, testy 1-6) - Task 14; rozdział 12 (weryfikacja języków w CI) - Task 15. Skrzynki, koło, giełda, discover, zdrapki, osiągnięcia, złote paczki: plan 3 i 4 (świadomie poza tym planem).
- **Placeholdery**: brak TBD/TODO; każdy krok z kodem.
- **Spójność nazw**: `ownedCounts(state, now, all)`, `cps(state, now)`, `isRevealed(state, kit, now)` / `isRevealedWith(state, kit, ownedAll)`, `buy(state, kitId, qty, now, hourOfDay)`, `click(state, now, rng)`, `tick(state, dtSec, now)`, `applyOffline(state, now, capSec)` używane identycznie w zadaniach 7-14 i w `index.ts`.
