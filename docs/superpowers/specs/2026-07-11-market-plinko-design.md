# RAM Exchange (giełda) - design

Data: 2026-07-11. Zatwierdzone w rozmowie (wariant A: kurs deterministyczny z czasu).
Rewizja 2026-07-11: Plinko usunięte na życzenie użytkownika; animacja wykresu
zmieniona z morfującej ścieżki na przewijanie typu taśmociąg.

## Cel

Minigra hazardowa zasilana RP, w stylu istniejących (spin, mystery):
szybka pętla dopaminowa, zero serwera, wszystko w localStorage.

## RAM Exchange (`#/market`, unlock lvl 18)

- Jeden instrument: RAM Index (RAMX). Prosty long: kup, potem sprzedaj.
- Kurs deterministyczny z czasu zegarowego: `step = floor(Date.now() / 700ms)`,
  `price(step) = 100 * exp(suma sinusów + jitter(mulberry32(step)) + event)`.
  Eventy (pompy/rugi ±18-48%) losowane per blok 40 ticków z seeded RNG,
  narastają i gasną sinusoidalnie w ramach bloku. Kurs "żyje" też offline,
  historia 120 ticków odtwarzalna wstecz przy wejściu na widok.
- Pozycja: jedna naraz, `{stake, entry, ts}` w `rambuy.market`. Stawka z
  presetów 10/25/50/100% salda RP (min 10 RP). Sprzedaż: `stake * price/entry`.
  Zysk wypłacany przez `addXp(profit)` (RP+XP), zwrot stawki bezpośrednio do
  `rpBal`; strata: tylko `proceeds` wraca do salda.
- UI: duży kurs + chip zmiany, wykres SVG (helpery `chartLinePath` /
  `chartAreaPath` / `chartGridHtml` współdzielone z wykresem PDP), linia
  wejścia na wykresie, licznik PnL na żywo, log ostatnich 6 tradów.
- Animacja wykresu (taśmociąg): oś Y ma lepką domenę (rescale tylko gdy kurs
  z niej ucieknie albo używa < 45% zakresu). Nowy tick rysuje dane przesunięte
  o krok w prawo (klatka identyczna z poprzednią) i easuje grupę `#mk-plot`
  transformem do zera - stare punkty tylko suną w lewo, nigdy nie morfują.
  Kropka jedzie pionowo po prawej krawędzi, clipPath tnie wjeżdżający punkt.
- Efekty: confetti przy zamknięciu >= x1.25, dźwięk straty przy stracie.
- Statystyki: `trades`, `tradeNet`, `bestTradeX`. Kropka w nav gdy pozycja
  otwarta. Achievementy: trader [10/100/1000 tradów], moonshot [trade >= x1.5].
- Kafelek w profilu: liczba tradów + net RP.
- i18n: komplet kluczy we wszystkich 10 językach. `sw.js`: cache v60.
- Bez zmian w ekonomii bazowej; gra to sink/redystrybucja RP, zysk XP tylko
  z realnego profitu.

Uwaga: projekt nie jest repozytorium git - spec bez commita.
