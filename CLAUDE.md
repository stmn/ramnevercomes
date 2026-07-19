# RamNeverComes (repo: rambuy)

Fikcyjny sklep DDR5 - nic nie jest wysyłane, nie ma płatności, wszystko dzieje się w przeglądarce (localStorage). Statyczny frontend bez backendu.

- Build: `node build.mjs` (wynik w `dist/`; generuje też 59 statycznych stron `/product/<id>/index.html` - pełny shell aplikacji z podmienionymi meta i prerenderem treści przez współdzielony `js/seo-render.js` - oraz `sitemap.xml` i `_redirects`)
- Routing: History API (`/product/sakura`, bez hashy). Stare linki `#/x` przepisywane w locie. `<base href="/">` w index.html jest OBOWIĄZKOWY (względne ścieżki assets/lang/js pod głębokimi trasami). Nawigacja w kodzie: `go('/trasa')`, nie `location.hash`. Cloudflare Pages: `_redirects` (`/* /index.html 200`) daje fallback SPA; lokalnie głębokie wejścia testować przez `npx wrangler pages dev dist` (rambuy.test serwuje źródła bez fallbacku - wejście od `/` działa, refresh na podstronie da 404)
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
- `ramRain()` - deszcz kości RAM (easter egg Konami: strzałki góra góra dół dół lewo prawo lewo prawo B A)
- `cheat('unlockall')` - odkrywa wszystkie kości drabinki
- `confetti()` - konfetti
- `toast('tekst', 'sparkles')` - toast
- Seed postępu (lvl ~22): `localStorage.setItem('rambuy.stats', JSON.stringify({xp:3e8})); localStorage.setItem('rambuy.rp','50000'); localStorage.setItem('rambuy.lvlseen','40'); location.reload()`
- Tryb debug: `debug(true)` / `debug(false)` z konsoli (działa wszędzie, także na produkcji; przeładowuje stronę). Bez flagi: auto-on na rambuy.test/localhost. HUD kl/s + log zdarzeń (reveal z gapS, order, case, golden, snap co 10 s z mult). `debugDump()` pobiera ramnevercomes-log.txt, `debugClear()` czyści. Klucze LS: `rambuy.debug`, `rambuy.debuglog`.

## Balans ekonomii (drabinka RP)

Zweryfikowane z normami gatunku idle/clicker (Cookie Clicker, AdVenture Capitalist; "The Math of Idle Games" - Pecorella/Kongregate, 2026-07-19):
- Koszt kolejnej KOPII tego samego kitu: x1.15 (identycznie jak Cookie Clicker) - nie zmieniać.
- Koszt kolejnego TIERU: x2.00, produkcja x~1.618 (Fibonacci - celowo). Norma CC to koszt ~11x/prod ~6x na tier, ale przy 20 budynkach; my mamy 59 kitów przy podobnej całkowitej rozpiętości (2^58), więc gęstsze kroki są zamierzone.
- Payback (koszt/produkcja) rośnie x~1.25 na tier - zdrowy wzrost (CC ~1.8x przy rzadszych tierach).
- Klik = 4% CpS z mnożnikami combo (x5)/frenzy (x7) - zgodne z praktyką "klik jako ułamek produkcji"; historia 1% -> 2% -> 4% (na prośby usera, klik czuł się za słaby). Aktywne klikanie 8/s z combo daje ~60-100% bonusu do produkcji - gruba nagroda za aktywność; kolejnego podbicia NIE robić bez symulacji tempa odkryć.
- Prog ODKRYCIA kolejnego kitu: 8x jego ceny (`isRevealed`). Historia: 0.5x = odkrycia natychmiastowe; 2x = wczesne odkrycia co ~1 min (za szybko, zweryfikowane symulacją i na żywo). Przy 8x symulacja daje odkrycia: 6.7 / 11.7 / 18 / 27 / 37 min - każde jest wydarzeniem. Zmiana progu = zmiana tempa "unlocków"; cen rpCost nie ruszać bez symulacji (łamie zapisy graczy i easter-eggi cenowe).
- Skrzynki (mystery): TRZY poziomy ryzyka (`CASE_TYPES`), KAŻDA ma równo 8 możliwych dropów. Osobne cooldowny 2/5/10 min. Cena = DOKŁADNIE cena kitu-kotwicy (najbliższy tier dla produkcja*secs) - dzięki temu statystyki są stałe: EV 110% / 125% / 150%, szansa zysku 42% / 36% / 26% (premia za ryzyko - EV MUSI rosnąć z ryzykiem; podbite z 101/108/115 na prośbę usera 2026-07-19 - skrzynki grane na cooldownie dają do ~+75% ekwiwalentu produkcji z czarnej, to świadoma nagroda za aktywność). Okno dropów jest przycinane do frontu ODKRYĆ (skrzynka nigdy nie zawiera nieodkrytych kitów; przy zbyt małej liczbie odkryć - zablokowana z komunikatem case.locked). INWARIANT: lvl 15 (odblokowanie Mystery, xp=50*2^15) gwarantuje 11 odkrytych kitów (próg odkryć 8x => tier 10), a skrzynki wymagają 8-9 - wszystkie trzy są otwieralne od pierwszej chwili; przy zmianie FEATURE_LVL.mystery, progu odkryć (8x) albo floorTier/maxOff PRZELICZYĆ tę gwarancję. Statystyki na kartach liczyć z SUROWYCH prawdopodobieństw (zaokrąglone pct fałszowały EV o +-10 p.p.). Karty: obraz full-width z tytułem na półprzezroczystym pasku, bez opisów. Grafiki: assets/case-<typ>.jpg (Recraft V4).
- Giełda RAMX: kurs = fraktalny szum (12 oktaw seedowanego value noise w log-przestrzeni, najwyższa oktawa ~19 h) - BEZ średniej, do której wraca (poprzedni model sinusowy był mean-reverting => trzymanie pozycji do zysku nigdy nie przegrywało; wykryte audytem 2026-07-19). Czysta funkcja czasu zegara (seed, nie Math.random) - rusza się offline, historia rysuje się identycznie po reloadzie. Prowizja `MK_FEE` 3% od sprzedaży (scalping EV-ujemny); wycena pozycji i sprzedaż netto przez `mkNetValue`. Czas dostawy zamówienia zamrażany przy złożeniu (`o.dur`, fallback deliveredAt() dla starych zapisów) - awans nie skraca retroaktywnie starych dostaw. GB do progów (`gbOwned`) liczone TYLKO z dostarczonych kitów + skrzynek (spójnie z produkcją); toast kamienia milowego pilnowany w tickEconomy przez `rambuy.msseen`.
- Koło (spin): EV segmentów ~43 s produkcji na spin; cooldown 60 s (decyzja usera 2026-07-19: częsta interakcja > czystość ekonomii; daje do ~+72% przy kręceniu co minutę, w praktyce mniej - wymaga wejścia na podstronę). Historia: 120 s (+36%), 240 s (+18%).
- Kamienie milowe GB: `prodMult() = 1.15^n`. KLUCZOWY warunek stabilności: progi GB wypadają ~1 na tier drabinki, więc EFEKTYWNY wzrost produkcji na tier = 1.618 (Fibonacci) x bonus kamienia. Musi być < 2.0 (wzrost cen), inaczej czas do kolejnego kitu maleje i gra ucieka. Dowody z logów gracza (2026-07-19): bonus 2.0 -> odstępy odkryć malały do 2 s; bonus 1.5 -> stały w miejscu ~20 s; bonus 1.15 (1.618x1.15=1.86) -> odstępy rosną ~7%/tier. Przy zmianach produkcji kitów lub siatki progów GB PRZELICZYĆ ten iloczyn. Teksty "produkcja +15%" w profile.ms.next i profile.how (11 języków).
- Zdrapka: od odblokowania instant buy (~lvl 30) zdrapki zdrapują się SAME przy złożeniu zamówienia (`maybeAutoScratch`: kupon + XP od razu, auto-apply dolicza do kolejnych zakupów) - ręczne zdrapywanie zostaje dla niższych poziomów. XP = max(30, 15 s produkcji) (było 60 s - z mnożnikiem dawało setki tysięcy XP za jedno pociągnięcie).
- Discover (swipe): system ładunków - pula 10, regeneracja 1 ładunek / 3 min (`DISCOVER_MAX`, `DISCOVER_REGEN_MS`); nagroda = max(5, 5 s produkcji) za swipe (~+3% produkcji przy graniu na okrągło). Historia: limit 59 na całe życie gry umierał po 1 dniu; dzienny reset zakładał wielodniową retencję, której jednorazowa stronka nie ma.
- Instant buy NIE jest osobnym feature: przycisk karty zmienia się z "Do koszyka" na "Kup teraz", gdy `deliveredAt() <= 1 s` (poziomy skracają dostawę o 21 s/lvl (1 s ~lvl 30)). "Kup teraz" w popoverze koszyka odblokowuje pierwsza dostarczona przesyłka.
- Telemetria balansu: snapy w debuglogu mają pole `mult` - przy kolejnych skargach na tempo prosić usera o log (debugDump()).

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
