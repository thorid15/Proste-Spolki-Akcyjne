# FAZA 4 — nowa spółka: wniosek → dokumenty → otwarcie (11.11.2026)

## Co zrobiono
- **Formularz publiczny (U-08):** KRS, e-mail, „Przenoszę rejestr od innej firmy” → wniosek i konto z linkiem (7 dni); zawsze ta sama odpowiedź (D-079); limit prób (D-195).
- **Portal:** aktywacja (hasło, regulamin), logowanie, Nowa spółka 1/2 — dane wstępnie z KRS, osoba podpisująca umowę z pytaniem o PEP prostymi słowami, akcjonariusze z obowiązkowym e-mailem, „to ja” ze zgodą na e-mail, płatność rocznie albo miesięcznie z kwotą brutto, przejęcie; autozapis. 2/2 — dokumenty: Pobierz / Wgraj podpisany / stan, uchwała własna albo w umowie spółki, instrukcja podpisu, „Wyślę pocztą”.
- **Jeden schemat danych** wniosku dla portalu i kancelarii (`logika/wniosek.js`, D-194); dokumenty z U-03 przy „Złóż” (D-196); test podpisu przy wgraniu (D-197).
- **Kancelaria — Wnioski:** lista, „Nowa spółka” (też na liście spółek), ekran wniosku: różnice wobec KRS, dokumenty („Potwierdź podpis” / „Odrzuć plik”, podpis notariusza z osobą zawierającą umowę — D-198), checklista, osoby już w kartotece (istniejąca / nowa), notatka; „Przyjmij” (D-199) → „Otwórz rejestr” (sprawa otwarcia, przy przejęciu od dnia przejęcia — D-200); „Więcej”: Zwróć do uzupełnienia, Odrzuć (D-201). Pulpit: wnioski złożone, podpisy do sprawdzenia, dzień przejęcia. Ustawienia: osoby zawierające umowy.
- **Usunięte (D-203):** podsystemy przeniesień i zgłoszeń, stary portal, pakiet/dokumenty wniosku, zaproszenia, formy podpisu, stare ekrany i nieużywany kod frontu.

## Metryki § 9 (po Fazie 3 → po Fazie 4)
| Miara | Przed | Po |
|---|---|---|
| Trasy HTTP zamontowane (portal) | 44 (0) | 64 (10) |
| Pliki `server/logika/` | 30 | 26 |
| Linie frontendu | 8 918 | 4 595 |
| Tabele | 21 | bez zmian (2 kolumny wniosku — U-01) |
| Testy pominięte | 135 | 53 (Faza 5 — 52; próbki podpisów — 1) |

## Testy
`npm test`: 300 — 247 ✓, 0 ✗, 53 pominiętych. Nowe: `wnioski-http` (5 — zgłoszenie, aktywacja, izolacja kont, dokumenty, test podpisu, przyjęcie, otwarcie z pierwszą opłatą, przejęcie, zwrot, odrzucenie, wniosek pracownika), T2 trybu testowego (link z e-maila). Usunięte: 7 plików testów Fazy 4 (usunięte podsystemy), testy usuniętych plików frontu (kraje, nazwy plików) i 2 pominięte pliki Fazy 5 testujące stary portal (oświadczenia, Start). `npm run e2e`: 6 scenariuszy × 1440 i 390 px — 12 ✓, błędy JS/HTTP 0, w tym: zgłoszenie → link z e-maila → dane → dokumenty (umowa spółki w PDF, podpisy) → przyjęcie → otwarcie i wpis; nowa spółka pracownika z przejęciem — „Otwórz rejestr” dopiero od dnia przejęcia. `npm run e2e:malpa`: 16 ekranów i test błędnych danych — 17 ✓; zgłoszenia — zmiana stanu po poprzednim kliknięciu, logowanie pustym formularzem (401 z komunikatem), link zewnętrzny w stopce.

## Odstępstwa
1. „Stan otwarcia zgodny z dokumentami poprzednika” — w checkliście sprawy otwarcia („Dokumenty zbadane”), nie w checkliście wniosku: stan otwarcia powstaje po przyjęciu (D-200).
2. Uchwała bez liczby akcji w podpisach (D-202).

## Pytania
1. Konto wnioskodawcy należy do osoby podpisującej umowę za spółkę (po przyjęciu — osoba działająca za spółkę). Tak?
2. Uchwała: blok podpisów akcjonariuszy bez liczby akcji — wystarczy?
