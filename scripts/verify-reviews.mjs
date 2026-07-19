// Weryfikacja kompletnosci i jakosci recenzji produktow (zasady: CLAUDE.md).
import { readFileSync } from 'node:fs';

const LANGS = ['en', 'pl', 'fr', 'es', 'pt', 'pt-br', 'de', 'it', 'zh', 'ja', 'ko'];
const dataSrc = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const ids = [...dataSrc.matchAll(/^\s*id: '([a-z0-9-]+)'/gm)].map(m => m[1]);
if (!ids.length) { console.error('Nie znaleziono produktow w js/data.js'); process.exit(1); }

let errors = 0;
const err = msg => { errors++; console.error('BLAD:', msg); };

for (const lang of LANGS) {
  const dict = JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), 'utf8'));
  const seen = new Map();
  for (const id of ids) {
    for (let i = 1; i <= 5; i++) {
      const key = `rv.${id}.${i}`;
      const v = dict[key];
      if (typeof v !== 'string' || !v.trim()) { err(`${lang}: brak lub pusty ${key}`); continue; }
      if (/[—–]/.test(v)) err(`${lang}: dlugi myslnik w ${key}`);
      if (v.length < 15 || v.length > 400) err(`${lang}: podejrzana dlugosc (${v.length}) w ${key}`);
      if (seen.has(v)) err(`${lang}: duplikat tekstu ${key} == ${seen.get(v)}`);
      seen.set(v, key);
    }
  }
}

console.log(`Produkty: ${ids.length}, jezyki: ${LANGS.length}, oczekiwane klucze: ${ids.length * 5 * LANGS.length}`);
if (errors) { console.error(`\n${errors} bledow.`); process.exit(1); }
console.log('OK - kazdy produkt ma 5 recenzji w kazdym jezyku, bez duplikatow.');
