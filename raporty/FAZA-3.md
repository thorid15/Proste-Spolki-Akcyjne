# FAZA 3 — ekrany kancelarii (11.11.2026)

## Co zrobiono
- **Menu (§ 5):** Pulpit · Sprawy · Spółki · Osoby · Korespondencja · Opłaty; Ustawienia w menu konta (administrator). Wnioski — Faza 4.
- **Pulpit:** jedna lista „Do zrobienia” według pilności (nowa trasa `GET /api/psa/pulpit`, D-186).
- **Sprawa (3 kroki):** 1. Treść — żądający, zmiany (Przeniesienie, Emisja, Umorzenie, Obciążenie, Informacja o akcjach; seria, numery i liczba ręcznie — U-26), podstawa i pliki, autozapis, błędy przy polach; 2. Sprawdzenie — stan przed i po, kafelki osób z R2 (jedna linia stanu, „Nadano”/„Wyślij”, „Odnotuj zgodę na wpis”, „Dopisz osobę”), checklista, opłata (dwa przyciski bez domyślnego); 3. Pisma — powiadomienia o wpisie, „Wyślij pisma”. „Więcej”: Zmień treść, Wstrzymaj, Odmów, Wycofaj; przy wstrzymanej przycisk główny „Wznów” (D-188).
- **Kokpit:** „stan na” dzień, akcjonariusze, akcje z obciążeniami („Zmień” / „Wykreśl” → nowa sprawa), dane spółki „Edytuj” w miejscu, historia wpisów („Sprostuj”), sprawy, akta, opłaty, historia zmian; „Nowy wpis”, obok „Informacja z rejestru”; „Więcej”: Eksport, Zamknij rejestr (D-189).
- **Karta osoby:** „Edytuj” w miejscu (U-25), zgoda e-mail przełącznikiem (plik / data — U-11), „Dokument zgody do podpisu” (nowa trasa, D-190), PEP, AML, pliki, akcje, sprawy, konto, historia.
- **Korespondencja i Opłaty:** filtry, podgląd (PDF, treść e-maila, identyfikator, odpowiedź serwera), Wyślij / Wyślij ponownie / Drukuj + Nadano; Opłacona, numer faktury, Anuluj z powodem, CSV.
- **Pole daty:** jedno pole DD.MM.RRRR, kropki same, ikona kalendarza w polu (D-187).
- **Usunięte:** 10 plików z listy fazy oraz `kokpit`, `wydruk`, `uzytkownicy`, `wpis-zbycia`, niepodłączone `wnioski`, `zgloszenia`, `przeniesienia`, nieużywane komponenty `ui-rejestr.js` (D-191).

## Metryki § 9 (po Fazie 2 → po Fazie 3)
| Miara | Przed | Po |
|---|---|---|
| Linie frontendu | 19 378 | 8 918 (ekrany kancelarii 2 160; portal 4 356 — Fazy 4–5) |
| Trasy HTTP zamontowane (portal) | 42 (0) | 44 (0) |
| Pliki `server/logika/`; tabele | 30; 21 | bez zmian |
| Małpa | 29 zgłoszeń | 12 ekranów, 0 błędów JS/HTTP; 5 zgłoszeń — każde to zmiana stanu po poprzednim kliknięciu (§ 3.3) |

## Testy
`npm test`: 407 — 272 ✓, 0 ✗, 135 pominiętych (Faza 3 — 0; Faza 4 — 72; Faza 5 — 62; 1 wcześniejszy). Nowe: `pulpit` (1), `sprawy-http` (+1: dokument zgody, Pulpit). `npm run e2e`: 4 scenariusze × 1440 i 390 px — zbycie bez zgody na e-mail (list w Korespondencji → Nadano → wpis → powiadomienia o wpisie → wysyłka), zmiana treści po kroku 1 (niewysłane znika, wysłane traci ważność, nowe powstaje), edycja karty osoby i nowa osoba, pola dat bez ucięcia — 8 ✓, błędy JS/HTTP 0; portal — `test.skip` „Faza 5”. `npm run e2e:malpa`: 12 ✓.

## Odstępstwa (DECYZJE D-186–D-192)
1. `elementy.js` — elementy ekranów kancelarii (wybór osoby, tabele stanu, pliki); `ui-rejestr.js` zostaje wspólny z portalem — scalenie z portalowymi resztkami w Fazie 5.
2. Poza zakresem do Faz 4–5: „Nowa spółka”, osoby zawierające umowy w Ustawieniach, „Działają za spółkę”, „Zaproś do portalu”.

## Pytania
1. „Sprostuj” zakłada sprawę bez żądającego (z inicjatywy kancelarii) — pracownik może zmienić. Tak zostawić?
