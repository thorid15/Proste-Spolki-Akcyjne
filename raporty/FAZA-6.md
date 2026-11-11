# FAZA 6 — porządki, bezpieczeństwo, dokumentacja; raport końcowy uproszczenia (11.11.2026)

## Co zrobiono
- **Umowa:** § 12 ust. 3 — obowiązek zawiadamiania notariusza o odwołaniu osoby działającej za Spółkę, także w portalu (D-215).
- **Martwy kod (D-216):** usunięte nieużywane funkcje, stałe i eksporty, awaryjne odpytanie tpay, REGON z KRS, stare skrypty scenariuszy; czytnik ZIP przeniesiony do `testy/`.
- **§ 7 w całości (D-217, D-218):** lista dozwolonych tras z testem; `Origin`; CSP bez `unsafe-inline`; tryb testowy wczytywany tylko przy fladze; `PORTAL_WLACZONY` egzekwowany; limit zamówień informacji; SMTP wyłącznie z TLS; dane kancelarii tylko w Ustawieniach; nowy `.env.przyklad`; `npm audit`: 0 podatności (podbity `nodemailer` w ramach wersji 10).
- **Dokumentacja (D-219):** `README.md` (111 linii) i `ARCHITEKTURA-PSA.md` (253) od nowa; w `PRZEPISY-PSA.md` tylko kolumna „Element” mapy § 11; `npm run dokumentacja` → `docs/`; specyfikacja, raport stanu i stare audyty → `docs/archiwum/`.

## Metryki § 9 — start (7.11) → koniec
| Miara | Start | Koniec | Cel |
|---|---|---|---|
| Typy wpisów | 22 | 8 | 8 ✓ |
| Trasy HTTP API (portal) | 191 (53) | 73 (17) | ≤ 80 (≤ 20) ✓ |
| Tabele / kolumny | 39 / 670 | 21 / 227 | 21 / ≤ 300 ✓ |
| Kolumny `psa_osoby` | 48 | 15 | ≤ 15 ✓ |
| Konta w portalu | 3 role | 1 konto na osobę, zakres z danych | ✓ |
| Stany sprawa / wniosek / opłata / przeniesienie | 6 + podstan / 7 / 4 / 8 | 5 / 4 / 3 / — | ✓ |
| Typy pism | 13 | 8 | 8 ✓ |
| Pliki `server/logika/` | 41 | 25 | ≤ 25 ✓ |
| Linie frontendu | 19 378 | 4 871 | ≤ 10 000 ✓ |
| Pliki `.md` czytane przy pracy | 26 + `docs/` | 4 | 4 ✓ |
| Pokrycie gałęzi (serwer) | 72,9% | 83,0% (linie 94,9%) | ≥ 80% ✓ |
| Małpa | 29 zgłoszeń | 7, każde wyjaśnione, 0 błędów | ✓ |

## Testy
`npm test`: 275 — 274 ✓, 0 ✗, 1 pominięty (próbki podpisów tylko lokalnie). Nowy `bezpieczenstwo`: lista tras, bez `dangerouslySetInnerHTML` i HTML z danymi, nagłówki, `Origin`, wyłączony portal. `npm run e2e`: 8 scenariuszy × 1440 i 390 px — 16 ✓, błędy JS/HTTP 0, axe 0, układ 0. `npm run e2e:malpa`: 21 ✓; 7 zgłoszeń to zmiana stanu po poprzednim kliknięciu. „Wyślij” w „Zgłoś zmianę” wyszarzony bez opisu — było 422 (D-220).

## Odstępstwa
1. `Referrer-Policy: same-origin` zamiast `no-referrer` — przy `no-referrer` przeglądarki wysyłają `Origin: null` przy własnych POST, co wyłączyłoby sprawdzenie `Origin` (pkt 6).
2. Żądanie bez nagłówka `Origin` przechodzi — klient spoza przeglądarki nie ma ciasteczek ofiary (`SameSite=Lax`).
3. `.env.przyklad`: dodatkowo `KATALOG_DOKUMENTOW`, `URL_PORTALU`, `NODE_ENV`, `PSA_BAZA_TESTOWA` (konieczne); bez `POKAZ_ZNAK_IZBY` (nikt go nie czytał).
4. Awaryjne odpytanie tpay usunięte (brak wywołującego) — gdy ITN nie dojdzie, pracownik klika „Opłacona”.

## Pytania
1. Zawiadomienie sądu rejestrowego po zamknięciu rejestru (art. 300³² § 3, od 18.02.2027) jest dziś czynnością poza aplikacją. Dodać przypomnienie na Pulpicie?
2. Przygotować instrukcję wdrożenia na serwer kancelarii (HTTPS, szyfrowanie dysku i kopii, SMTP Microsoft 365, tpay, zapora)?
