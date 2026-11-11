# FAZA 1 — rdzeń: schemat, wpisy, sprawy (7.11.2026)

## Co zrobiono
- **Schemat bazowy (U-01):** jedna migracja zamiast 71 — 21 tabel z § 3.4, wyłącznie `psa_*`. Bazę z innym schematem zakłada od nowa tylko wtedy, gdy `psa_zdarzenia` jest pusta albo baza jest testowa; inaczej odmawia (sprawdzone na bazie z wpisem).
- **8 typów wpisów jako dane** (`typy-zdarzen.js`); `stan.js` — handlery, bilans z ułamkami, `ktoTraci` (R2), checklista (R5), widok „stan na dzień”; `walidacje.js` — seria/numery/liczba z błędami przy polach (R8), skład sprawy (R3), blokady R6; `osoby.js` — PESEL (U-18), jeden opis osoby.
- **R1:** do `psa_zdarzenia` dopisuje wyłącznie `rejestr.wpisz`, wołany przez `sprawy.zmienStan` (jedyna funkcja zmieniająca stan, tabela przejść § 3.3). Otwarcie, sprostowanie i zamknięcie idą przez sprawę; bez powiadomień — jednym kliknięciem. Kroki 1–3, powiadomienia po „Dalej”, „Zmień treść” (R2), opłata tylko po wyborze (U-02), pisma `do_wyslania` (rekord bez PDF).
- **Edycja danych osób i spółek** w miejscu z historią (U-25), zgoda e-mail z plikiem albo datą (U-11). SQL tylko w `server/dane/`.
- **Trasy dla ekranów § 5:** sprawy (7), spółki (3), osoby (5), plik (1), ustawienia i integralność (3, administrator). Jedna funkcja przyjęcia pliku (biała lista, sygnatura, 10 MB, losowa nazwa).
- **Usunięte:** dobór numerów (U-26), `kreator.js`, `aml.js`, `akcjonariusz.js`, `osoba-dzialajaca.js`, `znak-sprawy.js`, `widoki.js`, `oswiadczenia.js`, trasa `zdarzenia`, stawki w ustawieniach (U-05), stałe usuniętych pojęć w `przepisy.js`.
- **`test:seed`** na nowy model: rejestr z ułamkiem i zastawem, zgoda e-mail z plikiem, zbycie czekające na „Nadano”.

## Metryki § 9 (przed → po)
| Miara | Przed | Po |
|---|---|---|
| Typy wpisów | 22 | 8 |
| Trasy HTTP zamontowane (portal) | 191 (53) | 28 (0) — trasy Faz 2–5 wrócą w nowym kształcie |
| Tabele / kolumny; `psa_osoby` | 39 / 670; 48 | 21 / 228; 15 |
| Stany sprawa / wniosek / opłata / przeniesienie | 6+podstan / 7 / 4 / 8 | 5 / 4 / 3 / — (wniosek i opłata w schemacie) |
| Typy pism; pliki `server/logika/` | 13; 41 | 8 (schemat); 39 |
| Linie frontendu; pliki `.md` | 19 378; 6 | bez zmian (Faza 3); 6 |
| Pokrycie gałęzi (serwer) | 72,9% | 83,8% (pliki ładowane przez testy) |

## Testy
`npm test`: 503 testy — 292 ✓, 0 ✗, 211 pominiętych. Nowe: `rdzen-rejestru` (44), `powiadomienia` (19), `sprawy-http` (5). Usunięte 18 plików testów usuniętych funkcji; przypadki łańcucha, ułamków i daty KRS przeniesione. Pominięte z numerem fazy: **Faza 2** — 8 plików, 75 testów (wzory, informacja, opłaty, szablony, korespondencja); **Faza 3** — 1 test (formularz zbycia); **Faza 4** — 6 plików i 1 test, 72 (wniosek, zgłoszenie, przejęcie); **Faza 5** — 4 pliki, 62 (portal, tpay); 1 wcześniejszy (próbki podpisów). Interfejs nie działa do Fazy 3.

## Odstępstwa
1. „Wyślij”/„Nadano” bez tras do Fazy 2 — stan pisma zmienia `logika/pisma.js`, testy wołają ją wprost.
2. Przyjęcie plików z § 7 pkt 3 zrobione już teraz — potrzebne do plików sprawy i zgody.
3. Nazwy usuniętych typów: brak w kodzie zamontowanym i w uruchamianych testach; zostają w odłączonym `przeniesienia.js` (Faza 4), we froncie i e2e (Faza 3), w testach pominiętych i w `scenariusz-e2e*.js` (Faza 6). „uprawnienie”, „ograniczenie”, „zajęcie”, „przejęcie” żyją jako rodzaje i źródło otwarcia.
4. `zip.js` jest na liście usunięć Fazy 2 (U-04), a wymaga go eksport ZIP (bez zmian, § 3.6) — eksport odłączony do Fazy 2.
5. `auth.js` ma nadal SQL w trasach (poza „sprawami, spółkami i osobami”) — do Fazy 5/6. Gałąź jak w Fazie 0.

## Pytania i odpowiedzi Łukasza (DECYZJE D-155–D-168)
1. D-156 — osoby działającej przy wpisie nie zapisuje się wcale: pole „działa przez” w sprawie usunięte.
2. D-157 — potwierdzona (akcjonariusz powiadamiany, gdy zastawnik dostaje prawo głosu).
3. D-168 — zgoda na wpis jest ogólna (zgodnie z umową spółki albo umową sprzedaży), więc zostaje ważna po „Zmień treść”.
4. `zip.js` — na razie zostaje (eksport ZIP).
