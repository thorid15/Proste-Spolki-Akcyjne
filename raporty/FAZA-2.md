# FAZA 2 — pisma, Korespondencja, informacja z rejestru, opłaty (8.11.2026)

## Co zrobiono
- **Wzory (U-04, U-29):** 8 plików `wzory/*.md` zamiast 10 wzorów Word i generatorów; jeden wygląd w `logika/wzory.js` (Liberation Serif, A4, nagłówek kancelarii, stopka „numer · strona X z N”, tabele z powtarzanym nagłówkiem, wiersz nie dzieli się między strony). `npm run wzory` — podgląd PDF każdego wzoru z danymi próbnymi.
- **Pisma (`logika/pisma.js`):** przy czynności numer (PSA/… albo INF/…) i migawka treści; PDF powstaje raz (SHA-256 w `psa_pisma`). Powiadomienia, wezwanie i odmowa mają opis zmian i tabelę stanu; egzemplarz spółki — projekt listy akcjonariuszy do KRS.
- **Informacja z rejestru:** `wydajInformacje` — części z § 4, maskowanie dla akcjonariusza (biała lista na nowym modelu osoby), U-24 (portal: najpóźniej wczoraj; pracownik: także dziś), opłata U-02 (organ — bez), wpis do dziennika. Trasa w kokpicie.
- **Korespondencja:** filtry, podgląd PDF, „Wyślij” (e-mail z PDF, identyfikator wiadomości i odpowiedź serwera), błąd → „blad” → „Wyślij ponownie”, „Nadano”. Niepotrzebne niewysłane pismo znika razem z plikiem.
- **Opłaty:** tabela przejść, „Opłacona”, numer faktury, „Anuluj” z powodem, CSV (z ochroną przed formułami Excela).
- **Proces dzienny:** opłaty za prowadzenie rocznie albo co miesiąc (U-30, nadrabia przerwy), przypomnienie o kolejnym roku, retencja wniosków (U-19) i dziennika — jeden harmonogram.
- **Eksport ZIP** (odłączony od Fazy 1) przepisany i podpięty. **Usunięte:** `docx`, `wzory-dysk`, `szablony` (logika, trasy), `dokumenty-tresc`, `bloki-dokumentu`, `informacja-dokument`, `pdf`, `kontekst-pisma`, `dane-probne`, `przypomnienia`, zawiadomienia zbiorcze, listy, stare trasy informacji; `zip.js` zostaje (D-167).

## Metryki § 9 (po Fazie 1 → po Fazie 2)
| Miara | Przed | Po |
|---|---|---|
| Trasy HTTP zamontowane (portal) | 28 (0) | 42 (0) |
| Typy pism | 8 (schemat) | 8 (wzory Markdown → PDF) |
| Pliki `server/logika/` | 39 | 30 |
| Tabele / kolumny | 21 / 228 | bez zmian |
| Pokrycie gałęzi (serwer, pliki ładowane przez testy) | 83,8% | 86,0% |
| Linie frontendu; pliki `.md` | 19 378; 6 | bez zmian (Faza 3); 6 |

## Testy
`npm test`: 411 — 275 ✓, 0 ✗, 136 pominiętych. Nowe: `wzory` (6), `wzory-pisma` (10), `pisma` (6), `informacja` (9), `korespondencja` (5), `korespondencja-http` (5), `oplaty` (5), `proces-dzienny` (7), `harmonogram` (2), `eksport` (1). Usunięte testy usuniętych modułów (9 plików). Pominięte: **Faza 2 — 0**; Faza 3 — 1; Faza 4 — 72; Faza 5 — 62; 1 wcześniejszy (próbki podpisów). `npm run test:seed` — dane kancelarii, opłata za prowadzenie, informacja, pismo wysłane do skrzynki testowej.

Próbne PDF-y informacji: `raporty/FAZA-2-informacja-pelna.pdf` i `raporty/FAZA-2-informacja-akcjonariusz.pdf` (dane fikcyjne).

## Odstępstwa (DECYZJE D-169–D-180)
1. Treść Word przeniesiona 1:1 poza elementami usuniętymi decyzjami (REGON, głosy, charakter wpisu, nazwy U-29); w pismach kancelarii podstawa prawna jednym wierszem, pouczenia bez odesłań (D-169). Umowa: „§ 15” → „§ 13”, bez imion rodziców i dowodu reprezentanta, dodane PEP, przejęcie, rata miesięczna (D-170).
2. Brak adresu kancelarii w Ustawieniach blokuje pismo, a więc i wpis (D-172). Informacja ma nagłówek kancelarii bez daty (D-173).
3. Opis akcjonariusza w informacji w dwóch wierszach — warunek „10 akcjonariuszy i 3 serie na jednej stronie” (test).

## Pytania
1. Umowa § 6 i informacja RODO pkt 3a mówią o oprogramowaniu i systemie Krajowej Rady Notarialnej — rejestr prowadzi własna aplikacja kancelarii. Zmienić tekst?
2. Umowa § 11 ust. 3: „warunkiem … dokonania Wpisu … jest uiszczenie Taksy”, a R4 mówi, że opłata nigdy nie warunkuje wpisu. Zostawić zapis w umowie?
3. Czy e-mail innych akcjonariuszy ma być widoczny w informacji dla akcjonariusza (art. 300³⁵ § 1¹ go nie wymienia; dziś ukryty — D-174)?
4. Akapity o przejęciu i racie miesięcznej w umowie oraz oświadczenie PEP — proszę o akceptację treści (D-170).
