# FAZA 0 — porządek przed zmianą (7.11.2026)

Baza: commit `0565234`. Bez zmian w działaniu aplikacji.

## Co zrobiono
- Tag `przed-uproszczeniem` na `0565234`.
- Do `docs/archiwum/` przeniesiono (`git mv`, historia zachowana) 22 pliki `.md` z korzenia: AUDYT, CLAUDE-PSA, FRONTEND-INWENTARZ, FRONTEND-RAPORT, PLAN-POPRAWEK-2/-3/-4/-PORTAL, PRZEJECIE-REJESTRU, RAPORT-BETA, SESJA-PSA-6-INTERFEJS, -8-PROTOTYP, -FRONTEND, -POPRAWKI-R4, -POPRAWKI-R4-RAPORT, -STRONA, -WYTYCZNE, TESTOWANIE-E2E-PORTAL, TPAY-INTEGRACJA, WYTYCZNE-MERYTORYCZNE-PSA, WYTYCZNE-STATUS, wytyczne-rejestr-psa.
- Z `docs/`: `WDROZENIE-ZESTAWIENIE.md` oraz katalogi `analiza/` (4 pliki `.md` + 11 zrzutów PNG, na które odwołują się te pliki) i `krn/` (4 pliki `.md`) — razem 42 przeniesienia.
- W korzeniu zostały: `README.md`, `ARCHITEKTURA-PSA.md`, `DECYZJE.md`, `PRZEPISY-PSA.md` i `CLAUDE-PSA-UPROSZCZENIE.md` (specyfikacja dodana do repozytorium).
- `DECYZJE.md`: dopisano D-125…D-154 = U-01…U-30 (streszczenia, pełna treść w specyfikacji § 2).
- Żaden kod ani test nie czyta przeniesionych plików (sprawdzone wyszukiwaniem) — `npm test` bez zmian.

## Testy
`npm test` przed i po: 627 testów, 626 przeszło, 1 pominięty (istniejący `skip`, nie z tej fazy), 0 błędów.

## Metryki § 9
- Pliki `.md` czytane przy pracy: przed 26 + `docs/`; po 5 w repozytorium (README, ARCHITEKTURA-PSA, DECYZJE, PRZEPISY-PSA, ta specyfikacja) — cel końcowy 4 po Fazie 6.
- Pozostałe miary bez zmian (faza nie dotyka kodu).

## Odstępstwa
1. **Gałąź:** zamiast `uproszczenie` praca idzie na `claude/amazing-archimedes-uoog4j` — gałąź wyznaczona przez środowisko sesji. **Tag** `przed-uproszczeniem` istnieje tylko lokalnie: push tagu kończy się zerwaniem połączenia (4 próby). Punkt wyjścia i tak jest w historii gałęzi jako `0565234` — tag można założyć ponownie poleceniem `git tag przed-uproszczeniem 0565234`.
2. **`RAPORT-STANU-PSA.md` nie ma w repozytorium** (ani w historii git, ani na dysku sesji; commit `0565234` go nie zawiera). Nie mogłem go czytać ani zachować przy przenoszeniu (nie było czego przenosić).
3. **Duplikaty plików (raport § 7 k) — nie usunięto.** Bez raportu nie wiem, o które chodzi. Byte-identyczne duplikaty plików tekstowych w repozytorium: tylko `nowy-projekt/nowa-strona.html` = `projekt-strony/nowa-strona.html` (strona publiczna — poza zakresem, § 0 pkt 10; `nowy-projekt/podglad.html` odwołuje się do tego pliku z nazwy). Poza tym tylko zrzuty PNG w `testy-audyt/zrzuty` i `frontend-audyt/zrzuty` oraz fonty `publiczne/fonty` = `strona/dist/fonty`.
4. Poza zakresem dosłownego polecenia (korzeń i `docs/`) zostały pliki `.md` w `testy-audyt/`, `frontend-audyt/raporty/`, `nowy-projekt/`, `server/dane/`, `wzory/`, `publiczne/obrazy/`, `testy/` — nie ruszane.
5. `CLAUDE-PSA.md` jest teraz w archiwum, a Faza 6 każe przenieść z jego § 4 reguły domenowe — do odczytu wyłącznie wtedy (§ 0 pkt 2).

## Pytania
- Dodać `RAPORT-STANU-PSA.md` (7.11.2026, `0565234`) do repozytorium — potrzebny od Fazy 1 (i do ustalenia duplikatów z § 7 k).
- Czy przenieść do archiwum także katalogi `testy-audyt/` i `frontend-audyt/raporty/` (pliki `.md`)?
