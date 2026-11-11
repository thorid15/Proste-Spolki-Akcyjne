# FAZA 5 — portal klienta (11.11.2026)

## Co zrobiono
- **Konto = osoba, zakres z danych (U-23):** jedna funkcja `zakresKonta()` liczona przy każdym żądaniu — osoba działająca za spółkę widzi wszystko o spółce, akcjonariusz (akcje + zgoda na e-mail) swoje sprawy, pisma i opłaty, obie role — sumę; konto z wnioskiem — tylko wniosek, do przyjęcia (D-205).
- **Portal (§ 6):** Start (wybór spółki, „Do zrobienia”: zapłać / dodaj pliki, sprawy ze statusem prostymi słowami i pismami do pobrania, wydane informacje), Zgłoś zmianę (opis + pliki → sprawa w toku, Pulpit kancelarii — D-207), informacja z rejestru z wyborem dnia (najpóźniej wczoraj) i „Zapłać 61,50 zł” → tpay → pobranie po ITN (D-208), Konto (hasło, zgoda na e-mail). Menu Start · Konto; po przyjęciu wniosku bez jego ekranów.
- **Kancelaria:** kokpit — „Działają za spółkę” (Dodaj z kartoteki albo nowa osoba, Usuń); karta osoby — stan konta i zakres, „Zaproś do portalu” / „Wyślij nowy link” (D-211).
- **Odebranie dostępu (pytanie z akceptacji Fazy 4) — D-206:** bez osobnej blokady. Sprzedaż wszystkich akcji i wycofanie zgody zamykają dostęp akcjonariusza same; odwołanie z zarządu — „Usuń” w kokpicie. Działa od następnego kliknięcia, bez wylogowania, ślad w historii spółki.
- **Płatności:** `platnosci.js` na nowym modelu opłat, ITN zamontowane, weryfikacja bez zmian (D-210). **Uchwała:** „W głosowaniu oddano głosy ze 100% akcji Spółki.” + podpisy wszystkich akcjonariuszy (D-204).
- **Usunięte:** zgłoszenie nieprawidłowości (U-13), stare testy starego portalu (D-213).

## Metryki § 9 (po Fazie 4 → po Fazie 5)
| Miara | Przed | Po |
|---|---|---|
| Trasy HTTP zamontowane (portal) | 64 (10) | 75 (17) — cel ≤ 80 (≤ 20) |
| Konta w portalu | konto wnioskodawcy | 1 konto na osobę, zakres z danych |
| Pliki `server/logika/` | 26 | 26 |
| Linie frontendu | 4 595 | 4 879 |
| Tabele | 21 | 21 (bez zmian schematu) |
| Testy pominięte | 53 | 1 (próbki podpisów) |

## Testy
`npm test`: 276 — 275 ✓, 0 ✗, 1 pominięty. Nowe `portal-http` (8): izolacja tabelaryczna 17 tras × 6 kont + bez logowania (404/401), Start trzech ról, Zgłoś zmianę (dwuklik, plik, Pulpit), informacja z płatnością i ITN, odebranie dostępu (Usuń, wycofanie zgody, zbycie wszystkich akcji), zaproszenie, Konto, lista tras. `platnosci` (20) odblokowane. `npm run e2e`: 8 scenariuszy × 1440 i 390 px — 16 ✓, błędy JS/HTTP 0, axe 0, układ 0; nowe: zarząd (zgłoszenie z plikiem, informacja → atrapa kasy → pobranie), akcjonariuszka (tylko swoje; obie role po „Dodaj” w kokpicie, z powrotem po „Usuń”), wniosek — Start po przyjęciu. `npm run e2e:malpa`: 20 ekranów + błędne dane — 21 ✓; na 7 ekranach portalu 0 zgłoszeń; 7 zgłoszeń w kancelarii — zmiana stanu po poprzednim kliknięciu (licznik historii po „Usuń”/„Zaproś”, wiersze opłat i korespondencji po „Opłacona”/„Wyślij”).

## Odstępstwa
1. Zaproszenie do portalu nie jest pismem w Korespondencji (U-09) — e-mail od razu po kliknięciu, ślad w historii osoby (D-211).
2. E-mail w Koncie tylko do odczytu — zmienia go kancelaria (D-212).

## Pytania
1. Czy dopisać do umowy obowiązek spółki zawiadamiania kancelarii o odwołaniu osoby działającej za spółkę? Bez tego „Usuń” zależy od tego, czy ktoś nam to zgłosi.
2. Osoba, która ma już konto, nie zgłosi drugiej spółki formularzem publicznym (dostaje przypomnienie o logowaniu) — drugą spółkę zakłada kancelaria („Nowa spółka”). Wystarczy?
