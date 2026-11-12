# Rejestr jako dokument roboczy — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pracownik prowadzi rejestr na ekranie rejestru spółki i dokonuje wpisu na jednej stronie; nowy rejestr otwiera jedną czynnością; aplikacja spełnia wymagania audytu bezpieczeństwa z 12.11.2026.

**Architecture:** Silnik rejestru (`server/logika/stan.js`, `server/rejestr.js`, `server/sprawy.js`) bez zmian reguł. Nowe ekrany React w `publiczne/js/` na istniejących trasach plus trzy rozszerzenia serwera (opis wpisów i „w toku”, projekt otwarcia we wniosku, „Otwórz rejestr” w jednej transakcji). Poprawki bezpieczeństwa w `server/` z testami `node:test`.

**Tech Stack:** Node.js 20+, Express 4, better-sqlite3, React 18 (esbuild → `publiczne/dist/`), node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-rejestr-roboczy-design.md`

## Global Constraints

- Reguły domenowe z `ARCHITEKTURA-PSA.md` § 4–7 nie zmieniają się; numery akcji zawsze wpisuje pracownik (U-26, D-232).
- Informacja z rejestru (`server/informacje.js`, `wzory/informacja.md`, wariant „informacja” w `logika/wzory.js`) — bez zmian (D-234).
- Każda nowa trasa API dopisana do `testy/trasy-dozwolone.txt`; po zmianie w `publiczne/js/` — `npm run buduj` (test `front-js`).
- Bez nowych zależności poza podbiciem `multer` do 2.x. Bez `dangerouslySetInnerHTML`. Bez zewnętrznych zasobów (CSP `default-src 'self'`).
- Teksty interfejsu po polsku, nazwy z U-29 („powiadomienie”, „pismo”, „plik”); nazwy w kodzie po polsku jak dotąd.
- `Cache-Control: no-store` nie wprowadzamy (D-237).
- Przed każdym commitem: `npm test` zielone.

## Review Focus

1. Dwukrotne kliknięcie „Otwórz rejestr” albo „Dokonaj wpisu” — jeden wpis, druga odpowiedź nie tworzy niczego (test w B5 i B4).
2. Błąd numerów akcji w projekcie otwarcia — nic nie zostaje przyjęte: brak spółki, osób i sprawy w bazie, błąd wraca przy polu (test w B5).
3. Otwarcie formularza nowego wpisu i wyjście bez zmian — żadna sprawa nie powstaje (e2e w B6).
4. Żądanie z adresu spoza `KANCELARIA_ADRESY` na trasę pracownika — 403 także przy poprawnej sesji; portal i ITN nadal działają (test w A3).
5. Plik wysłany bez sesji na trasę portalu — 401 bez buforowania treści i bez zawieszenia przy polach `a[4294967294]` (test w A2).

---

## Część A — bezpieczeństwo (osobne drzewo robocze, scalane przed częścią B5)

### Task A1: Sekret sesji (K1)
**Files:** Modify `server/logika/sesja.js:21-28`, `.env.przyklad:15`, `docs/WDROZENIE.md` (krok `.env`); Test `testy/auth-logika.test.js`.
**Interfaces:** Produces `sesja.sprawdzSekret(wartosc, { produkcja }) → string|null` (komunikat błędu albo null), wywołane przy wczytaniu modułu — błąd = `throw`.
- [ ] Test: `sprawdzSekret('zmien-mnie-przed-wdrozeniem', {produkcja:false})` ≠ null; 31 znaków ≠ null; pusty przy `produkcja:true` ≠ null; pusty przy `produkcja:false` = null (sekret tymczasowy zostaje); 64 znaki hex = null.
- [ ] Implementacja; `.env.przyklad`: `SESJA_SEKRET=` z komentarzem `openssl rand -hex 32`. Testy HTTP ustawiają własny sekret ≥ 32 znaków (`testy/pomoc.js`).
- [ ] `npm test`, commit.

### Task A2: Wgrywanie plików (W1)
**Files:** Modify `package.json` (`multer` → `^2.5.0`), `server/pomocnicze/pliki.js:51`, `server/trasy/portal.js:91-125`; Test `testy/bezpieczenstwo.test.js`.
**Interfaces:** `pliki.odbierz` z `limits: { fileSize: LIMIT_BAJTOW, files: 1, fields: 10, parts: 12, fieldNameSize: 100, fieldSize: 10 * 1024 }`. W `trasy/portal.js` trasy `/wniosek/pliki` i `/sprawy/:id/pliki` wywołują kontrolę konta (ta sama funkcja, której używają pozostałe trasy portalu) **przed** `pliki.odbierz`.
- [ ] Test: POST multipart bez ciasteczka na obie trasy → 401; POST z polami `a[4294967294][0]` i `a[x]` wraca w < 2 s; z sesją i poprawnym PDF → 201 jak dotąd.
- [ ] Implementacja, `npm install`, `npm test`, commit (z `package-lock.json`).

### Task A3: Nasłuch i adresy kancelarii (W2)
**Files:** Modify `server/konfiguracja.js` (`HOST`, `KANCELARIA_ADRESY`), `serwer.js:28,141-155,211`, `.env.przyklad`, `docs/WDROZENIE.md` (nginx: zakotwiczone wyrażenie `^/(portal(\.html)?$|dist/portal\.js$|vendor/|style/|fonty/|obrazy/|robots\.txt$|api/psa/portal/|api/wspolne/|api/psa/platnosci/tpay/itn$)`, `limit_req` dla `/api/psa/portal/`, `WatchdogSec`/`MemoryMax` w usłudze); Create `server/logika/adresy.js`; Test `testy/bezpieczenstwo.test.js`, `testy/konfiguracja.test.js`.
**Interfaces:** `adresy.nalezy(ip: string, lista: string[]) → boolean` (IPv4 z maską CIDR i adresy dokładne, także `::ffff:` oraz `::1`); `konfiguracja.HOST` (domyślnie `'127.0.0.1'`), `konfiguracja.KANCELARIA_ADRESY: string[]` (z `KANCELARIA_ADRESY=192.168.1.0/24,203.0.113.10`; pusta = bez ograniczenia). Pośrednik w `serwer.js` przed routerami pracowników i `/api/auth/*`: adres spoza listy → 403 `{ blad: 'Dostęp tylko z sieci kancelarii.' }`; nie dotyczy `/api/psa/portal/*`, `/api/wspolne/*`, ITN ani plików statycznych portalu. `aplikacja.listen(PORT, HOST)`.
- [ ] Test `adresy.nalezy`: `10.0.0.5` w `10.0.0.0/8`; `192.168.2.1` poza `192.168.1.0/24`; `::ffff:192.168.1.7` w `192.168.1.0/24`; lista pusta → true.
- [ ] Test HTTP: z `KANCELARIA_ADRESY=10.9.9.9` logowanie pracownika i `GET /api/psa/spolki` → 403; `GET /api/psa/portal/ja` i `GET /api/wspolne/kancelaria` → nie 403.
- [ ] Implementacja, `npm test`, commit.

### Task A4: Limity plików (W3)
**Files:** Modify `server/wnioski.js:207-238`, `server/portal.js:128-136`, `server/dane/pliki.js`; Test `testy/wnioski-http.test.js`, `testy/portal-http.test.js`.
**Interfaces:** Stałe w `server/pomocnicze/pliki.js`: `LIMIT_PLIKOW_WNIOSKU = 30`, `LIMIT_PLIKOW_SPRAWY = 30`, `LIMIT_MB_LACZNIE = 100`. Przekroczenie → `BladWalidacji` „Limit plików został wyczerpany — skontaktuj się z kancelarią.” Nowy plik tego samego dokumentu wniosku (ten sam `dokument`, stan inny niż `potwierdzony`) usuwa poprzedni z dysku i z bazy.
- [ ] Test: 31. plik wniosku → 422; dwa kolejne pliki dokumentu `umowa` → w bazie jeden.
- [ ] Implementacja, `npm test`, commit.

### Task A5: Logowanie i formularz publiczny (S1–S3, S7)
**Files:** Modify `server/logika/limiter.js`, `server/trasy/auth.js:55,157,209,243-246`, `server/trasy/portal.js:27-46,112-115`, `server/wnioski.js:79-100`, `server/portal.js:105-126,249`; migracja nr 2 w `server/migracje.js` dopisuje `psa_uzytkownicy.zmien_haslo INTEGER NOT NULL DEFAULT 0` (razem z kolumną z B5 — jedna migracja, patrz B5); Test `testy/auth-http.test.js`, `testy/limiter.test.js`, `testy/portal-http.test.js`.
**Interfaces:** `limiter.proba(klucz, { limit, oknoMs })` bez zmian; nowe klucze: `konto:<email>` (20 nieudanych / 60 min, niezależnie od IP), `zgloszenia:dzien` (200 / 24 h globalnie), `sprawy-konta:<id>` (10 / 24 h). Nieznany e-mail przy logowaniu wykonuje `bcrypt.compare` na stałym skrócie. `whoami` pracownika zwraca `zmien_haslo: true`, dopóki administrator z hasłem tymczasowym go nie zmieni — front pokazuje wtedy wyłącznie ekran „Zmień hasło”. Niezaktywowane konto wniosku nie blokuje „Zaproś do portalu”.
- [ ] Testy: 21. nieudane logowanie na to samo konto z innego IP → 429; czas odpowiedzi dla nieznanego konta > 50 ms; 11. „Zgłoś zmianę” konta w dobie → 429; `whoami` po pierwszym logowaniu administratora ma `zmien_haslo: true`, po zmianie hasła — false.
- [ ] Implementacja, `npm test`, commit.

### Task A6: tpay i drobne (S5, N1–N3)
**Files:** Modify `server/trasy/platnosci.js:66-75`, `server/logika/wniosek.js:68-74`, `server/pomocnicze/odpowiedzi.js:117`, `server/trasy/wspolne.js:20`, `server/eksport.js:20-23`; Test `testy/platnosci.test.js`, `testy/wnioski-http.test.js`, `testy/eksport.test.js`.
**Interfaces:** Przy `NODE_ENV=production` brak nagłówka `X-JWS-Signature` → odpowiedź `TRUE` bez księgowania i log „odrzucone (brak podpisu JWS)”. `PUT` wniosku z `{"dane":null}` albo `akcjonariusze:[null]` → 422; treść > limitu → 413. `GET /api/wspolne/kancelaria` zwraca tylko pola używane przez stopkę i nagłówek (nazwa, adres, e-mail, telefon, www, znak). Komórki CSV w eksporcie ZIP zaczynające się od `= + - @` dostają apostrof (jak w CSV opłat).
- [ ] Testy na każde z czterech zachowań; implementacja; `npm test`; commit.

---

## Część B — ekrany

### Task B1: Serwer — opis wpisów i „w toku”
**Files:** Modify `server/trasy/spolki.js:45-68`, `server/sprawy.js` (eksport `skrot`); Test `testy/sprawy-http.test.js`.
**Interfaces:** `sprawy.skrot(db, sprawa) → { id, stan, opis: string, termin, braki: string[], krok }` — `opis` to zdania `pisma.opisOperacji` złączone spacją (pusta treść → „Wpis bez treści”), `braki` = komunikaty `rejestr.wymaganiaWpisu` albo błędy symulacji. `GET /api/psa/spolki/:id` dodaje `w_toku: skrot[]` (sprawy `w_toku`, `wstrzymana`) i w każdym elemencie `wpisy`: `opis: string`, `podstawa: string|null`.
- [ ] Test: po seedzie testowym odpowiedź dla spółki ze sprawą w toku ma `w_toku.length === 1` z `opis` zawierającym „Przeniesienie akcji z”, a `wpisy[0].opis` zaczyna się od „Otwarcie rejestru”.
- [ ] Implementacja, `npm test`, commit.

### Task B2: Powłoka i warstwa bazowa stylów
**Files:** Modify `publiczne/js/app.js`, `publiczne/js/ui-rejestr.js` (`NaglowekStrony` z okruszkiem), `publiczne/style/rejestr.css`, `publiczne/portal.html`/`publiczne/js/portal.js` (menu portalu jako przyciski warstwy bazowej; stopka zostaje).
**Interfaces:** `MENU` = Pulpit `/`, Rejestry `/spolki`, Osoby `/osoby`, Korespondencja `/korespondencja`, Opłaty `/oplaty`. `NaglowekStrony({ okruszek: [{nazwa, sciezka}], tytul, kontekst, akcje })`. Klasy przycisków: `.btn` (40 px), `.btn-maly` (32 px, 13 px, ramka), `.btn-glowny`, `.btn-danger`; `.btn-cichy` usunięta (zastąpiona `.btn-maly`). Globalna reguła `a` (kolor `--rejestr`, podkreślenie przy najechaniu). Usunięte: `.marka-pasek`, stopka w `Aplikacja`, topbar na ekranach szczegółu.
- [ ] Implementacja; `npm run buduj`; `npm test`; zrzuty kontrolne Pulpitu, listy i karty osoby przy 1440 px; commit.

### Task B3: Ekran rejestru
**Files:** Modify `publiczne/js/spolki.js` (`EkranKokpitu` → układ ze spec § 2.2), `publiczne/js/elementy.js` (`TabelaAkcjonariuszy({ widok, osoby, przed, akcja })` grupowana po osobie, z różnicą względem `przed`; `TabelaSerii({ widok, akcja })`; `TabelaAtrybutow` bez zmian interfejsu), `publiczne/style/rejestr.css`.
**Interfaces:** Consumes `w_toku`, `wpisy[].opis` z B1. „Nowy wpis” przy osobie → menu rodzajów → `idz('/spolki/:id/wpis?typ=<typ>&osoba=<id>')`; „Nowa emisja” → `?typ=emisja`. Wiersz obciążenia: „Zmień prawo głosu”, „Wykreśl” → `zalozSprawe` z gotową treścią (jak dziś).
- [ ] Implementacja; `npm run buduj`; zrzut Alfy przy 1440 i 390 px; commit.

### Task B4: Wpis na jednej stronie
**Files:** Modify `publiczne/js/sprawy.js` (usunąć `Kroki`, `KrokTresci`, `KrokSprawdzenia` jako kroki; nowy `EkranWpisu` i `NowyWpis`), `publiczne/js/app.js` (trasa `spolki/:id/wpis`), `publiczne/style/rejestr.css`; Test `testy/e2e/scenariusze/kancelaria.spec.js`.
**Interfaces:** `NowyWpis({ spolkaId })` trzyma treść lokalnie; pierwsza zmiana → `POST /api/psa/sprawy` (z `klucz_idempotencji`) → `idz('/sprawy/:id')` z zachowaniem fokusu. `EkranWpisu({ sprawaId })`: sekcje w kolejności ze spec § 2.3; przycisk główny: `przygotuj` = `POST /sprawy/:id/krok {krok:2}`; `wpisz` = (gdy treść niezatwierdzona) `krok 2` → `POST /sprawy/:id/stan {stan:'wpisana'}`; potwierdzenie pokazuje `opis` z odpowiedzi. Wiersz „Posiada: …” liczony z `stan_przed.akcjonariusze` dla osoby zbywcy / akcjonariusza.
- [ ] e2e: zbycie z e-mailem (jedna strona, bez „Dalej”), zbycie z listem („Przygotuj powiadomienia” → „Nadano” → „Dokonaj wpisu”), zastaw, wejście w `…/wpis` i wyjście bez zmian nie zwiększa liczby spraw (`GET /api/psa/sprawy`).
- [ ] Implementacja; `npm run buduj`; `npm test`; `npm run e2e`; commit.

### Task B5: Nowy rejestr na jednej stronie
**Files:** Modify `server/migracje.js` (migracja 2: `ALTER TABLE psa_wnioski ADD COLUMN otwarcie_json TEXT NOT NULL DEFAULT '{}'` oraz kolumna z A5), `server/dane/wnioski.js`, `server/wnioski.js` (`zmien` przyjmuje `otwarcie`; `otworzRejestr`; `widok` zwraca `otwarcie` i `konto_spolki`), `server/trasy/wnioski.js`, `testy/trasy-dozwolone.txt`, `publiczne/js/wnioski.js`, `narzedzia/dokumentacja-*` (regeneracja `docs/`); Test `testy/wnioski-http.test.js`, `testy/e2e/scenariusze/wniosek.spec.js`.
**Interfaces:**
- `otwarcie` (projekt): `{ serie: [{seria, numery, liczba, data_wpisu_krs}], akcje: { [kluczOsoby]: [{seria, numery, liczba, ulamek}] }, atrybuty: [...jak w operacji otwarcia], umorzone: [...], checklista: { dokumenty: bool, identyfikacja: bool } }`; `kluczOsoby` = `'reprezentant'` dla „to ja”, inaczej `a.klucz`.
- `wnioski.otworzRejestr(db, id, { osoby, potwierdzKonto }, kto) → { spolka_id, sprawa_id }` — transakcja: `przyjmij` → operacja `otwarcie` z osobami z przyjęcia → `sprawy.zaloz({ …, checklista: { zadajacy: true, dokumenty, identyfikacja }, klucz_idempotencji: 'otwarcie-wniosku-<id>', wpisz: true })`. Błędy pól operacji wracają z przedrostkiem `otwarcie.` zamiast `operacje.0.`.
- `POST /api/psa/wnioski/:id/otworz-rejestr` → 201 `{ spolka_id, sprawa_id }`.
- `widok.konto_spolki`: dla każdej dopasowanej osoby reprezentanta — nazwy spółek, do których ma już dostęp; `przyjmij` wymaga `potwierdzKonto` przy wyborze takiej osoby (S6).
- [ ] Testy: projekt z numerami 1–90 przy serii 1–100 → 422 z polem `otwarcie.…`, a w bazie brak spółki i osób; poprawny projekt → 201, `data_otwarcia` ustawiona, jedna opłata za prowadzenie; drugie wywołanie → 422 „Rejestr jest otwarty.” bez drugiego wpisu; wybór istniejącej osoby z dostępem do innej spółki bez `potwierdz_konto` → 422.
- [ ] Implementacja serwera; `npm test`; commit.
- [ ] Ekran (spec § 2.4) z `EdytorOtwarcia` dostosowanym do listy akcjonariuszy wniosku; e2e: Nowa spółka → Złóż → dokumenty → „Otwórz rejestr” → ekran rejestru; `npm run e2e`; commit.

### Task B6: Listy, Pulpit, portal, porządki
**Files:** Modify `publiczne/js/spolki.js` (`EkranSpolek` z „W przygotowaniu”), `publiczne/js/pulpit.js` (odnośniki), `publiczne/js/wniosek-formularz.js:79` („To ja” kopiuje dane reprezentanta), `publiczne/js/portal.js` (menu), `publiczne/style/rejestr.css` (usunięcie nieużywanych bloków: kroki kreatora sprawy, kafle osób w starym układzie, pas marki), `testy/e2e/malpa.spec.js`, `testy/e2e/pomocnicze/ekrany.js`, `ARCHITEKTURA-PSA.md` § 6, § 9, § 12, `DECYZJE.md` (D-230–D-239), `README.md`.
- [ ] Implementacja; `npm run buduj`; `npm test`; `npm run e2e`; `npm run e2e:malpa`; `npm run dokumentacja`; commit.
