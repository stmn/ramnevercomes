# RamNeverComes (repo: rambuy)

Fikcyjny sklep DDR5 - nic nie jest wysyłane, nie ma płatności, wszystko dzieje się w przeglądarce (localStorage). Statyczny frontend bez backendu.

- Build: `node build.mjs` (wynik w `dist/`)
- Deploy: `./deploy.sh` (Cloudflare Pages, projekt `ramnevercomes`) - TYLKO na jawne polecenie
- i18n: `lang/<code>.json`, 11 języków: en, pl, fr, es, pt, pt-br, de, it, zh, ja, ko; angielski jest fallbackiem dla brakujących kluczy
- Przy zmianach plików statycznych bumpnąć `CACHE` w `sw.js` (rambuy-vNN), inaczej powracający użytkownicy nie zobaczą zmian
- Klucze localStorage mają prefiks `rambuy.` - NIE zmieniać (skasowałoby graczom postęp); brand widoczny dla usera to "RamNeverComes"
- W tekstach NIGDY nie używać długiego myślnika ("—", "–") - tylko zwykły "-"

## Testowanie nowych rzeczy z konsoli (obowiązkowe)

Każda nowa funkcja wizualna/interakcyjna (animacja, modal, minigra, efekt) MUSI dać się wywołać z konsoli devtools bez grania - globalną funkcją albo przez `cheat('...')`. Po zaimplementowaniu podać userowi gotowe polecenie do wklejenia w konsolę.

Istniejące wyzwalacze:
- `revealCinematic(RP_LADDER[7], 2)` - animacja odblokowania nowej kości (drugi argument: ile dodatkowych "+n")
- `sndReveal()` - dźwięk towarzyszący animacji odblokowania (pad + arpeggio + iskierki)
- `toggleBurger()` - otwiera/zamyka mobilny drawer nawigacji (widoczny sensownie przy oknie <=860px)
- `cheat('unlockall')` - odkrywa wszystkie kości drabinki
- `confetti()` - konfetti
- `toast('tekst', 'sparkles')` - toast
- Seed postępu (lvl ~22): `localStorage.setItem('rambuy.stats', JSON.stringify({xp:3e8})); localStorage.setItem('rambuy.rp','50000'); localStorage.setItem('rambuy.lvlseen','40'); location.reload()`

## Recenzje produktów - zasady (obowiązkowe przy każdym nowym produkcie)

Każdy produkt z `PRODUCTS` (js/data.js) ma DOKŁADNIE 5 dedykowanych recenzji jako klucze i18n `rv.<id>.1` ... `rv.<id>.5`, obecne we WSZYSTKICH 11 plikach `lang/*.json`.

Zasady treści:
1. Każda recenzja musi nawiązywać do TEGO konkretnego produktu: nazwy, wyglądu/materiału (z nazwy lub `desc`), speców (`sub`, `speed`, `latency`), ceny albo żartu z `desc`. Recenzja, która pasowałaby do dowolnej kości, nie przechodzi.
2. Ton: zachwycony klient na pełnym serio, deadpan; absurd podawany jak fakt. Parodia recenzji sklepów premium.
3. Maksymalnie 1 z 5 recenzji produktu może żartować z "nigdy nie doszło / wieczny tracking" - pozostałe muszą mieć inne żarty.
4. 1-3 zdania, ok. 40-220 znaków, zróżnicowane głosy (gracz, programista, małżonek, kolekcjoner, emeryt...).
5. Bez emoji, bez numeracji, bez odniesień do liczby gwiazdek i imienia recenzenta (te pochodzą z osobnej puli), bez długich myślników.
6. Nazwy produktów NIE są tłumaczone - zostają po angielsku we wszystkich językach.
7. Tłumaczenia mają być naturalne i zabawne w danym języku (lokalizacja, nie kalka); niemiecki w formie "du", francuski "vous".

Mechanika (js/app.js + js/data.js):
- `seededReviews(p)` dobiera 5 wpisów metadanych (imię, gwiazdki, dni) z puli `RV_META` (js/data.js) deterministycznie hashem `p.id`, a teksty bierze z `t('rv.<id>.<1..5>')`.
- Recenzje użytkownika (formularz) trafiają do localStorage i wyświetlają się nad seedowanymi.

Weryfikacja (uruchamiać po każdej zmianie produktów lub recenzji):
```
node scripts/verify-reviews.mjs
```
Sprawdza: komplet 5 kluczy dla każdego produktu w każdym z 11 języków, brak pustych, brak duplikatów tekstów w obrębie języka, brak długich myślników, sensowne długości. Nowy produkt bez kompletu recenzji = build nie powinien iść na produkcję.
