# RamNeverComes Mobile - projekt gry natywnej

Data: 2026-09-13. Status: do akceptacji. Dokument powstał w repo `rambuy`, docelowo przenosi się do nowego repozytorium aplikacji.

## 1. Cel i decyzje ramowe

Natywna gra na iOS i Android oparta na ekonomii RamNeverComes, z interfejsem zaprojektowanym od zera pod telefon w pionie. Ma wyglądać i czuć się jak gra, nie jak sklep, ale sklep zostaje w fikcji: gracz "zamawia" kity z katalogu, paczki nigdy nie dojeżdżają, recenzje i tracking są elementami świata.

Decyzje podjęte 2026-09-13:

- Tożsamość: sklep w fikcji, UI gry (ekran główny to płyta główna, kierunek A z prototypu).
- Stack: Capacitor + Vite + TypeScript, scena w PixiJS (WebGL), HUD i ekrany w DOM. Jeden kod na obie platformy.
- Monetyzacja: brak. Bez IAP, bez reklam, bez waluty premium.
- Repozytorium: osobne, nowe. Ekonomia przepisana na czysto jako pakiet `core` w tym repo (nie kopiowana z `js/app.js`, ale odtwarzająca te same reguły i stałe).
- Postęp: czysty start. Bez importu zapisów ze strony.
- Zakres mechanik: obecne systemy gry plus trzy pakiety angażujące (rozdział 6), fazowane w trzech wydaniach (rozdział 10).
- Języki: 11 obecnych (en, pl, fr, es, pt, pt-br, de, it, zh, ja, ko), pliki `lang/*.json` przeniesione jako baza, nowe klucze dopisywane we wszystkich. Angielski fallbackiem.
- Orientacja: tylko pion. Docelowe urządzenia: iPhone od SE 2 wzwyż, Android od API 26, ekran od 360 px szerokości.

Prototyp do porównania kierunków: artefakt "RamNeverComes Mobile" (trzy telefony A/B/C), źródło w scratchpadzie sesji.

## 2. Struktura repozytorium

```
ramnevercomes-mobile/
  packages/core/        czysta logika, zero DOM, zero Capacitora
    src/economy/        drabinka, kity, produkcja, mnożniki, koszty, odkrycia
    src/systems/        upgrades, golden, leaks, offline, missions, wafer, prestige, achievements, cases, spin, market, discover, scratch
    src/save/           schemat zapisu, migracje, walidacja
    src/rng/            seedowany RNG (mulberry32), value noise dla giełdy
    src/sim/            symulator balansu (skrypt + testy)
    src/i18n/           klucze, formatowanie liczb i czasu
  apps/mobile/          Capacitor + Vite
    src/scene/          PixiJS: płyta, sloty, procesor, impulsy, dron, cząsteczki, LED
    src/ui/             DOM: HUD, zakładki, katalog, skrzynki, giełda, profil, nakładki, sheety
    src/native/         adaptery pluginów (haptyka, powiadomienia, zapis, cykl życia)
    src/debug/          konsola, cheat(), HUD debug
    ios/  android/      projekty natywne generowane przez Capacitor
  lang/                 11 plików JSON
  assets/               grafiki kitów (webp), skrzynek, ikony, sprite'y sceny
```

Zasada podziału: `core` eksportuje czyste funkcje i reduktory stanu (`tick(state, dt, now)`, `buy(state, kitId)`, `applyGolden(state, effect)`), nie zna czasu ściennego poza argumentem, nie losuje bez podanego RNG. `apps/mobile` jest jedynym miejscem, które dotyka ekranu, zegara i systemu.

## 3. Ekrany i nawigacja

Dolny pasek pięciu zakładek, zawsze widoczny poza nakładkami pełnoekranowymi:

1. **Świat** - płyta główna (rozdział 4).
2. **Katalog** - sklep w fikcji. Lista kitów w kolejności drabinki: zdjęcie na białym kafelku, nazwa, specyfikacja, cena w RP, produkcja, liczba posiadanych, przycisk "Zamów" (od poziomu instant buy "Kup teraz", przytrzymanie kupuje wiele). Karta kitu: pełne zdjęcie, opis, 5 recenzji z puli i18n, wykres ceny. Nieodkryte kity jako sylwetki "?" (próg odkrycia 8x ceny, bez zmian).
3. **Skrzynki** - trzy karty skrzynek z obrazem full-width, cooldowny, statystyki z surowych prawdopodobieństw, kolekcja dropów pogrupowana z licznikami.
4. **Giełda** - RAMX: wykres taśmociągowy, pozycja, kup/sprzedaj, prowizja 3%.
5. **Profil** - poziom i XP, kamienie GB, osiągnięcia z paskiem LED, statystyki, RMA (od R2), ustawienia (język, dźwięk, haptyka, powiadomienia, motyw sceny), sekcja "O grze".

Nakładki pełnoekranowe: koło (wejście z płyty, przycisk na krawędzi), discover (swipe, wejście z płyty), "witaj z powrotem", cinematik odkrycia kitu, cinematik odblokowania funkcji, cinematik RMA, poziom w górę. Dialogi mniejsze jako bottom sheety.

Kropki gotowości na zakładkach i przyciskach nakładek: skrzynka zeszła z cooldownu, koło gotowe, ładunki discover pełne, dojrzały wafel, dostarczona paczka.

Odblokowania poziomami jak dziś: koło 5, discover 10, skrzynki 15, giełda 20, szybki zakup 25. Zablokowana zakładka pokazuje kłódkę i poziom.

## 4. Scena: płyta główna

- Pionowa płyta PCB przewijana w pionie. 59 slotów DIMM w sekcjach po 6 ("rewizja płyty" A, B, C...), nowa sekcja odsłania się z animacją, gdy odkryty zostaje pierwszy kit tej sekcji. Slot pusty: obrys z paskiem styków. Slot z kitem: stylizowana kość w kolorach kitu (paleta 2 kolorów na kit w danych), licznik kopii, delikatna poświata. Nieodkryty slot: przerywany obrys.
- Procesor przyklejony do dołu sceny (nie przewija się). Jest celem tapnięcia. Impulsy danych ze slotów płyną ścieżkami do szyny i do procesora; częstotliwość impulsów na kit proporcjonalna do udziału kitu w produkcji (min 0.4/s, max 6/s na kit; przy więcej niż 12 aktywnych kitach impulsy agregowane per sekcja, żeby nie przekroczyć ~40 impulsów na ekranie).
- Klik: pierścień, cząsteczki, unoszący się "+n", puls poświaty. Kryt: drżenie sceny, bursztynowy pierścień, haptyka "heavy". Combo: pasek pod procesorem, progi 10/25/50 klików (x2/x3/x5), seria pęka po 700 ms bez kliku.
- Elementy pakietów na płycie: układy SMD ulepszeń przy slotach (6.1), dron z paczką (6.2), karty Chrome na procesorze (6.3), pasek LED na krawędzi (6.8), wafel w prawym górnym rogu (6.6), ticker nad zakładkami (6.9).
- Skiny sceny: kolor laminatu zmienia się z rewizją RMA (6.7) i sezonem (6.10). Motyw jasny/ciemny nie dotyczy sceny (scena jest zawsze ciemna), tylko ekranów DOM.
- Wydajność: 60 fps na iPhone SE 2; cząsteczki w jednym ParticleContainer; scena pauzuje rysowanie w tle i na innych zakładkach (logika tyka dalej).

## 5. Systemy przenoszone bez zmian reguł

Przeniesione 1:1 z gry webowej, z tymi samymi stałymi (źródło prawdy: `js/app.js`, `js/data.js` i sekcja "Balans ekonomii" w CLAUDE.md rambuy):

- Drabinka 59 kitów, koszt kopii x1.15, tier x2.00, produkcja x1.618, próg odkrycia 8x ceny.
- Klik = (1 + 4% produkcji) x combo x frenzy, kryt 5% x10; combo: 10/25/50 kolejnych klików w odstępach < 700 ms daje x2/x3/x5.
- Poziomy i XP (xp = 50 * 2^lvl), dostawy skracane o 21 s na poziom, czas dostawy mrożony przy zamówieniu, instant buy przy dostawie <= 1 s.
- Kamienie GB: prodMult = 1.15^n, GB tylko z dostarczonych kitów i skrzynek.
- Skrzynki: trzy typy, po 8 dropów, EV 110/125/150%, cooldowny 2/5/10 min, cena kotwicy, okno dropów przycięte do odkryć, inwariant lvl 15.
- Koło: EV ~43 s produkcji, cooldown 60 s.
- Giełda RAMX: fraktalny szum 12 oktaw, seedowany, prowizja 3%, `mkNetValue`.
- Discover: pula 10 ładunków, regeneracja 1 na 3 min, nagroda max(5, 5 s produkcji).
- Zdrapki: kupon + XP = max(30, 15 s produkcji), auto-zdrapywanie od instant buy.
- Osiągnięcia: obecna lista i progi (bronze/silver/gold), rozszerzona o nowe systemy.
- Zarobki offline: liczone od dostarczonych kitów i dropów, z nową ceremonią i limitem (6.4).
- Złote paczki: obecne dwa efekty wchodzą w skład 6.2.

Zmiany względem weba, wynikające z formy natywnej: brak koszyka jako osobnej trasy (koszyk to sheet nad katalogiem), brak stron about/terms/privacy jako tras (sekcja w Profilu), brak SEO i prerenderu.

## 6. Pakiety angażujące

Każdy element ma: regułę, nagradzane zachowanie, miejsce na ekranie, wpływ na balans. Liczby oznaczone "(sim)" są wartościami startowymi do potwierdzenia symulatorem (rozdział 8), nie stałymi.

### 6.1 Firmware (ulepszenia) - MVP

- Ulepszenia kitów: dla każdego kitu przy 1, 5, 25, 50, 100 kopiach pojawia się ulepszenie x2 produkcji tego kitu. Nazwy w fikcji: "Profil XMP", "Binowanie", "Radiator", "Pasta na kościach", "Dziki overclock". Koszt: 10x koszt bieżącej kopii kitu w chwili odblokowania (sim).
- Ulepszenia kliku: pięć tierów, klik +1% produkcji każdy (4% -> 9%) (sim), koszt rosnący x50.
- Sterowniki (odpowiednik "kotków"): mnożą produkcję przez (1 + RGB% * współczynnik), gdzie RGB pochodzi z osiągnięć (6.8). Pięć tierów, dostępne od R2 razem z Podświetleniem.
- Nagradza: częste, krótkie cele zakupowe; zawsze jest "następna rzecz".
- UI: układ SMD obok slotu kitu, ciemny gdy niedostępny, podświetlony gdy stać; tapnięcie otwiera sheet z opisem i przyciskiem "Wgraj". Wgrane ulepszenia lądują na liście w Profilu.
- Balans: nowa oś mnożników. Wymóg: efektywny wzrost produkcji na tier (1.618 x kamień GB x średni wkład ulepszeń przypadający na tier) < 2.0; tempo odkryć pierwszych pięciu tierów w granicach ±20% obecnego (6.7 / 11.7 / 18 / 27 / 37 min). Jeśli symulacja przekracza, koszt ulepszeń rośnie, nie ich siła.

### 6.2 Złote paczki v2 - MVP

Dron kurierski przelatuje nad płytą co 5-15 min (sim), widoczny 13 s, rośnie i pulsuje, znika z zanikaniem. Tapnięcie losuje efekt. Efekty mnożą się przy nakładaniu.

| Efekt | Szansa | Działanie |
|---|---|---|
| Frenzy | 40% | produkcja x7 przez 77 s (istnieje) |
| Lucky | 40% | natychmiast 15% banku + 13, max 15 min produkcji (istnieje jako "gain", ujednolicone) |
| Kit Special | 8% | losowy posiadany kit +10% produkcji na kopię przez 30 s |
| Click Frenzy | 5% | klik x77 przez 13 s (sim) |
| Łańcuch | 3% | kolejne paczki 6, 66, 666 RP..., każda następna po 3 s, koniec gdy wypłata > 50% banku |
| Wysyp | 2% | 7 s deszczu małych paczek, każda 1-7 min produkcji |
| Zwrot | 1% | produkcja x0.5 przez 66 s (efekt "gniewny") |
| Priority | 1% | produkcja x666 przez 6 s |

- Nagradza: obecność i uwagę, polowanie na combo Frenzy + Click Frenzy.
- UI: dron ze sprite'em paczki, chime przy pojawieniu, etykieta efektu i licznik czasu w HUD (pasek aktywnych efektów pod licznikiem RP). Osiągnięcia: "Early bird" (tapnięcie w pierwszej sekundzie), "Fading luck" (w ostatniej).
- Balans: częstotliwość i mnożniki (sim), tak by paczki grane aktywnie dawały do +40% ekwiwalentu produkcji (skrzynki dają do +75%, koło do +72%; suma bonusów aktywnych ma nie przekraczać x3 produkcji pasywnej).

### 6.3 Wycieki pamięci (wrinklery) - MVP

- Od poziomu 12 karty Chrome przyczepiają się do procesora: pojawia się jedna co 10-20 min (sim), max 6 (8 z ulepszeniem "Więcej RAM-u"). Każda zjada 5% produkcji (bank rośnie wolniej), gromadząc zjedzone RP w sobie. Zamknięcie karty: 3 tapnięcia; oddaje x1.1 zjedzonego. 1 na 1000 to "karta incognito": x3.3.
- Karty działają offline w ramach limitu offline (6.4), więc powrót po przerwie to jackpot do zebrania.
- Nagradza: powroty po przerwie, tolerowanie widocznej kary dla większej wypłaty.
- UI: karty z tytułami w stylu "Zakładka (1 z 47)", drżą przy tapnięciu, rozpadają się w cząsteczki z dźwiękiem; w Profilu statystyka "Zamknięte karty".
- Balans: neutralny dla tempa odkryć (przesuwa wypłatę w czasie, netto +10% przy pełnym zbieraniu).

### 6.4 Witaj z powrotem - MVP

- Limit offline: 3 h bazowo (sim), +15 min na poziom od poziomu 20, ulepszenie "Magazyn" (Firmware) +2 h. Po limicie produkcja offline stoi.
- Powrót po >= 60 s nieobecności: pełnoekranowa ceremonia. Licznik RP wykręca się od zera, lista źródeł (kity, dropy skrzynek, karty Chrome), czas nieobecności. Jedna decyzja: "Odbierz" albo "Odbierz x2": 10-sekundowe tap-frenzy, w którym gracz musi utrzymać >= 4 tapnięcia na sekundę; sukces podwaja wypłatę, porażka daje x1.5.
- Powiadomienia lokalne (Capacitor LocalNotifications, zgoda pytana przy pierwszym uruchomieniu ceremonii, nie przy starcie gry): "Magazyn pełny" gdy limit offline zostanie osiągnięty; "Skrzynka gotowa" po najdłuższym cooldownie; "Wafel dojrzał" (R2); "Wydarzenie startuje" (R3). Max 2 powiadomienia dziennie, cisza 22:00-8:00 czasu lokalnego, każde wyłączalne w Profilu.
- Nagradza: rytm powrotów co kilka godzin, aktywność zaraz po powrocie.
- Balans: dzisiejsze offline jest nieograniczone; limit 3 h obniża zarobki graczy wracających raz dziennie, więc "x2" i karty Chrome mają to rekompensować przy powrocie co ~6 h. Do sprawdzenia symulacją dobowego profilu gracza (2, 4, 8 sesji dziennie).

### 6.5 Zlecenia - R2

- Trzy dzienne zlecenia losowane z puli (kup N kitów, złap N paczek, otwórz skrzynkę, zamknij N kart, wykonaj N transakcji, zdrap kupon, kliknij N razy, zdobądź N XP). Każde daje XP (30 s produkcji) i wypełnia pasek kamienia milowego. Pełny pasek (5 zleceń) = kamień: bonus jednorazowy (paczka Priority gwarantowana albo wafel) i licznik w Profilu. Reset o północy lokalnej, bez kary za pominięcie.
- Nagradza: sesje z celem, korzystanie z wszystkich systemów.
- UI: zwijany pasek pod HUD z trzema wierszami i paskiem kamienia; sheet ze szczegółami.

### 6.6 Wafel krzemowy - R2

- Jeden wafel dojrzewa w rogu płyty: 20 h "dojrzały", 24 h "opada" (auto-zbiór do banku wafli). Zbiór przed 20 h: 50% szansy na utratę. Zegar biegnie w czasie rzeczywistym, także z zamkniętą aplikacją. Od poziomu 18.
- Wydatki: poziom kitu (n-ty poziom kosztuje n wafli, +1% produkcji tego kitu na poziom), odświeżenie cooldownu skrzynki (1 wafel), "Wafel frenzy" x3 produkcji przez 1 h raz na rewizję RMA (10 wafli).
- Nagradza: powrót raz dziennie niezależnie od stanu ekonomii.
- UI: wafel z paskiem dojrzewania, tooltip z czasem, animacja zbioru; "Wafle: n" w HUD Profilu.

### 6.7 RMA (prestiż) - R2

- Od poziomu 30 lub 1e12 RP zarobionych w życiu (co pierwsze). Gracz "zwraca całą płytę na gwarancji": kity, ulepszenia, RP, poziom kitów, karty i efekty znikają. Zostają: poziom i XP gracza, osiągnięcia i RGB, wafle, statystyki, kolekcja skrzynek jako trofea (bez produkcji), odblokowania funkcji.
- Kredyty gwarancyjne = floor(cbrt(RP_lifetime / 1e9)) - już posiadane (sim). Każdy kredyt to +1% produkcji na stałe i punkt do wydania w drzewie "BIOS": ok. 40 węzłów w R2 (start z RP, szybsze dostawy, więcej kart Chrome, dłuższy offline, lepsze szanse paczek, permanentne sloty ulepszeń, "Season switcher" w R3). Węzły i koszty w osobnym pliku danych.
- Nowa płyta: rewizja +1 (A -> B -> C...), inny kolor laminatu i nazwa na płycie, więc pętla czuje się nowa (lekcja Idle Miner Tycoon: nowość wizualna zamiast samego resetu).
- UI: przycisk RMA w Profilu z podglądem kredytów do zdobycia; cinematik: płyta odpina się, paczka zwrotna odjeżdża "do serwisu", nowa płyta wjeżdża; drzewo BIOS jako pełny ekran z węzłami.
- Balans: krzywa pierwiastka sześciennego jak w Cookie Clicker (8x zarobków = 2x kredytów); pierwsze RMA sensowne przy ~300 kredytach (sim). Efektywny wzrost na tier liczony z uwzględnieniem +1%/kredyt musi pozostać < 2.0 do 1000 kredytów.

### 6.8 Podświetlenie (osiągnięcia z mocą) - R2

- Każdy zdobyty tier osiągnięcia dodaje 4% RGB. Sterowniki (6.1) zamieniają RGB w mnożnik produkcji: tier sterownika k daje x(1 + RGB * w_k), w_k od 0.05 do 0.2 (sim).
- Nagradza: kompletowanie osiągnięć, także dziwnych ("Zamówienie o 3 w nocy").
- UI: pasek LED wzdłuż krawędzi płyty wydłuża się o segment na osiągnięcie, zmienia kolor co 25 osiągnięć; toast osiągnięcia z ikoną; siatka w Profilu.
- Nowe osiągnięcia: paczki (Early bird, Fading luck, combo x2 efekty), karty Chrome (10/100/1000), wafle (1/10/100), RMA (1/5/20), zlecenia (10/100/1000), sezonowe.

### 6.9 Ticker - R3

- Jedna linijka nad zakładkami, odświeżana co 10 s albo tapnięciem. Pula: fragmenty recenzji z i18n ("Recenzja: ..."), newsy skalowane stanem (liczba kitów, GB, rewizja, karty Chrome, sezon). 2% linijek to "fortune": zielona linijka z ikoną, tapnięcie daje bonus (ulepszenie kitu -7% kosztu, +7% produkcji na 1 h, albo 5 min produkcji). 50 tapnięć tickera = osiągnięcie "Tabloid".
- Nagradza: zerkanie na ekran, humor na wierzchu.

### 6.10 Sezony - R3

- Kalendarz: Black Friday (ostatni tydzień listopada), Święta (15-31 grudnia, renifer-kurier zamiast drona, 20% szansy na naklejkę), RAM Day (data własna), Walentynki, Halloween. Każdy sezon: skin procesora i paczek, 7 naklejek kolekcjonerskich (+1% produkcji każda, na stałe), osiągnięcie za komplet.
- Konfiguracja sezonów (daty, mnożniki, teksty) pobierana z pliku JSON na Cloudflare Pages przy starcie, z cache; brak sieci = ostatnia znana konfiguracja. Sezony nie zmieniają ekonomii poza naklejkami.
- Nagradza: powroty według kalendarza, kolekcjonowanie.

### 6.11 Game Center / Play Games - R3

- Tablice: RP w życiu, najwyższa rewizja RMA, najdłuższe combo. Osiągnięcia natywne mapowane 1:1 na wybrane osiągnięcia gry. Plugin Capacitor (np. `@openforge/capacitor-game-connect`); logowanie opcjonalne z Profilu, nigdy wymuszane.

### Pominięte świadomie

Klany i kontrakty co-op (wymagają backendu), gacha na maskotki (skrzynki spełniają tę rolę), limity magazynu karzące produkcję (ograniczamy tylko offline), boosty za reklamy, oferty czasowe.

## 7. Stan, zapis, czas

- Jeden obiekt stanu w `core`, serializowany do JSON: `{ v: 1, createdAt, lastSeen, rp, xpTotal, kits: {id: {copies, deliveredAt[], level}}, upgrades: [...], golden: {active: [...], nextAt}, leaks: [...], offline: {...}, missions: {...}, wafer: {...}, prestige: {credits, revision, bios: [...]}, achievements: {...}, cases: {...}, spin: {...}, market: {...}, discover: {...}, coupons: {...}, stats: {...}, settings: {...}, seasons: {...} }`.
- Zapis: Capacitor Filesystem w katalogu danych aplikacji, plik `rnc.save.json` plus kopia `rnc.save.bak.json` z poprzedniego zapisu. Autozapis co 5 s gdy stan się zmienił, oraz na `appStateChange` (tło) i `pause`. Odczyt przy starcie: plik główny, przy błędzie parsowania kopia, przy obu błędach nowy stan i komunikat. Migracje wersji w `core/save`, testowane na zapisach z poprzednich wersji trzymanych w repo jako fixtures.
- Pętla: `requestAnimationFrame` do rysowania, logika w stałym kroku 100 ms (`tick(state, 0.1, now)`), maks 50 kroków nadrabiania na klatkę; nadwyżka trafia do liczenia offline.
- Czas: `Date.now()`; delta ujemna traktowana jako 0; delta powyżej limitu offline obcinana. Zegary cooldownów i wafla oparte na znacznikach absolutnych, więc cofnięcie zegara urządzenia wydłuża, nie skraca. Brak walidacji serwerowej (nie ma serwera).
- RNG: mulberry32 z seedem zapisanym w stanie dla giełdy i sezonów (determinizm), `Math.random` dla kliku, paczek i skrzynek.

## 8. Balans i symulator

`packages/core/src/sim` odtwarza logikę gry na profilach gracza: idle (gra ciągła, 0 klików), continuous (gra ciągła, 3 kliki/s), passive (1 sesja 5 min dziennie), moderate (4 sesje po 5 min, 3 kliki/s), active (8 sesji po 10 min, 8 klików/s). Polityka zakupów: najdroższy odkryty kit, na który stać. Testy `vitest` wymuszają:

1. Gra ciągła z 3 klikami/s odkrywa tier 2 w oknie 3-15 min i tier 6 przed 90 min.
2. Wzrost produkcji drabinki x bonus kamienia GB (1.15) < 2.0 na tier, od tieru 2 (tier 1 to zaokrąglenie 1 -> 2 RP/s). Po dodaniu ulepszeń (6.1), RGB (6.8) i RMA (6.7) do iloczynu wchodzi ich średni wkład na tier.
3. Odstępy między odkryciami niemalejące od tieru 4 dla gracza idle (gra nie ucieka).
4. Produkcja w pełni aktywnego gracza (8 klików/s, combo x5, średni kryt) między x2 a x3.5 pasywnej.
5. Inwariant skrzynek: na poziomie 15 co najmniej 11 odkrytych kitów.
6. Czas odkrycia tierów 2-10 dla profilu continuous w granicach ±20% nagranej linii bazowej (`sim/baseline.json`, nagrywanej świadomie przy zmianie balansu).

Każda zmiana stałej w `core` bez zielonych testów symulatora nie przechodzi CI.

## 9. Warstwa natywna

- Pluginy: `@capacitor/haptics` (klik: light, kryt: heavy, odkrycie: success), `@capacitor/local-notifications`, `@capacitor/app` (cykl życia), `@capacitor/filesystem`, `@capacitor/status-bar` (overlay, jasne ikony), `@capacitor/splash-screen`, `@capacitor/preferences` (ustawienia). Safe-area przez `env(safe-area-inset-*)`.
- Dźwięk: WebAudio, syntetyzowany jak dziś (reveal, sukces, klik), plus krótkie próbki dla drona i kart; wyciszany w tle; respektuje przełącznik w Profilu.
- Dostępność: cele dotyku >= 44 px, teksty skalowane z ustawieniami systemu do 130%, `prefers-reduced-motion` wyłącza drżenie i skraca cinematiki, kontrast tekstu na scenie >= 4.5:1.
- Sklepy: bundle id `com.ramnevercomes.app`, ikony i splash z obecnych assetów, opis podkreślający "nic nie jest sprzedawane". Bez logowania, bez zbierania danych, polityka prywatności = sekcja w Profilu i strona na ramnevercomes.com.

## 10. Fazy

**MVP (wydanie 1.0)**: core z systemami z rozdziału 5, scena płyty, pięć zakładek, koło i discover jako nakładki, cinematiki odkrycia i odblokowania, pakiet 1 (6.1 bez sterowników, 6.2, 6.3, 6.4), 11 języków, zapis z migracjami, symulator z testami 1-5, debug i cheat z konsoli, TestFlight i wewnętrzny test Play.

**R2 (1.1)**: 6.5 zlecenia, 6.6 wafel, 6.7 RMA z drzewem BIOS, 6.8 podświetlenie i sterowniki, nowe osiągnięcia.

**R3 (1.2)**: 6.9 ticker, 6.10 sezony z konfiguracją zdalną, 6.11 Game Center / Play Games, publikacja w sklepach.

Kolejność wewnątrz MVP: core + symulator (bez UI) -> scena i HUD z klikiem -> katalog i zakupy -> pozostałe zakładki -> pakiet 1 -> natywne pluginy -> polish i testy urządzeń.

## 11. Testy

- `core`: vitest, pokrycie reguł ekonomii (koszty, produkcja, odkrycia, mnożniki), efektów paczek (nakładanie), kart (zjadanie i wypłata offline), offline (limit, delta ujemna), zapisu (migracje z fixtures), RNG (determinizm giełdy), symulatora (rozdział 8).
- `apps/mobile`: Playwright na buildzie web (viewport 390x844 i 360x780): przepływ pierwszych 10 minut (klik, zakup, odkrycie, katalog, zakładki), witaj z powrotem (mock zegara), paczka (mock RNG), zapis i odczyt po przeładowaniu.
- Urządzenia: smoke na iPhone SE 2 i Androidzie z API 26 przy każdym wydaniu: 60 fps sceny, haptyka, powiadomienie, tło/powrót.
- Konsola (obowiązkowe wg CLAUDE.md): `cheat('unlockall')`, `cheat('rp', n)`, `cheat('lvl', n)`, `golden('frenzy')`, `leak()`, `welcomeBack(hours)`, `revealCinematic(idx)`, `rma()`, `wafer('ripe')`, `mission('done')`, `season('xmas')`, `debug(true)` z HUD i logiem.

## 12. Ryzyka

- Wydajność sceny na słabych Androidach: PixiJS z agregacją impulsów i limitem cząsteczek; awaryjnie tryb "mniej efektów" w Profilu.
- Balans po dodaniu trzech osi mnożników: symulator w CI, liczby z "(sim)" zamrażane dopiero po zielonych testach i tygodniu logów z TestFlight.
- Utrzymanie 11 języków: skrypt weryfikujący komplet kluczy (jak `verify-reviews.mjs`) uruchamiany w CI; nowe klucze bez tłumaczeń blokują build.
- Rozjazd z grą webową: obie wersje mają tę samą drabinkę, ale różne systemy; strona nie dostaje pakietów 1-3 w ramach tego projektu.
