# FAZA 0 — porządek przed zmianą (7.11.2026)

Baza: commit `0565234`. Bez zmian w działaniu aplikacji.

## Co zrobiono
- Tag `przed-uproszczeniem` na `0565234`.
- Do `docs/archiwum/` przeniesiono (`git mv`, historia zachowana) 22 pliki `.md` z korzenia: AUDYT, CLAUDE-PSA, FRONTEND-INWENTARZ, FRONTEND-RAPORT, PLAN-POPRAWEK-2/-3/-4/-PORTAL, PRZEJECIE-REJESTRU, RAPORT-BETA, SESJA-PSA-6-INTERFEJS, -8-PROTOTYP, -FRONTEND, -POPRAWKI-R4, -POPRAWKI-R4-RAPORT, -STRONA, -WYTYCZNE, TESTOWANIE-E2E-PORTAL, TPAY-INTEGRACJA, WYTYCZNE-MERYTORYCZNE-PSA, WYTYCZNE-STATUS, wytyczne-rejestr-psa.
- Z `docs/`: `WDROZENIE-ZESTAWIENIE.md` oraz katalogi `analiza/` (4 pliki `.md` + 11 zrzutów PNG, na które odwołują się te pliki) i `krn/` (4 pliki `.md`) — razem 42 przeniesienia.
- W korzeniu zostały: `README.md`, `ARCHITEKTURA-PSA.md`, `DECYZJE.md`, `PRZEPISY-PSA.md`, `RAPORT-STANU-PSA.md` (dołączony scaleniem `claude/Main` po PR #17) i `CLAUDE-PSA-UPROSZCZENIE.md` (specyfikacja dodana do repozytorium).
- `DECYZJE.md`: dopisano D-125…D-154 = U-01…U-30 (streszczenia, pełna treść w specyfikacji § 2).
- Duplikaty (raport § 7 k): usunięto `nowy-projekt/nowa-strona.html` (źródłem prawdy jest `projekt-strony/nowa-strona.html`, czyta go `buduj-strone.js`; kod nie czyta kopii) oraz zdublowany blok „Tester e2e” w `.gitignore` (zostawiono pełniejszy).
- Żaden kod ani test nie czyta przeniesionych plików (sprawdzone wyszukiwaniem) — `npm test` bez zmian.

## Testy
`npm test` przed i po: 627 testów, 626 przeszło, 1 pominięty (istniejący `skip`, nie z tej fazy), 0 błędów.

## Metryki § 9
- Pliki `.md` czytane przy pracy: przed 26 + `docs/`; po 6 w korzeniu (README, ARCHITEKTURA-PSA, DECYZJE, PRZEPISY-PSA, RAPORT-STANU-PSA, ta specyfikacja) — cel końcowy 4 po Fazie 6.
- Pozostałe miary bez zmian (faza nie dotyka kodu).

## Odstępstwa
1. **Gałąź:** zamiast `uproszczenie` praca idzie na `claude/amazing-archimedes-uoog4j` — gałąź wyznaczona przez środowisko sesji. **Tag** `przed-uproszczeniem` istnieje tylko lokalnie: push tagu kończy się zerwaniem połączenia (4 próby). Punkt wyjścia i tak jest w historii gałęzi jako `0565234` — tag można założyć ponownie poleceniem `git tag przed-uproszczeniem 0565234`.
2. **Duplikat `notariat.png` zostaje:** `publiczne/obrazy/notariat.png` ≡ `projekt-strony/notariat.png`, ale oba mają wywołującego (aplikacja: `ui-rejestr.js`, `informacja-dokument.js`; generator strony: `buduj-strone.js`, a `projekt-strony/` jest poza zakresem — § 0 pkt 10). Usunięcie któregokolwiek zepsułoby aplikację albo generator.
3. Pliki `.md` w `testy-audyt/`, `frontend-audyt/raporty/` i innych podkatalogach zostają w miejscu (decyzja Łukasza).
4. `CLAUDE-PSA.md` jest teraz w archiwum, a Faza 6 każe przenieść z jego § 4 reguły domenowe — do odczytu wyłącznie wtedy (§ 0 pkt 2).

## Pytania
Brak.
