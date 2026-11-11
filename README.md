# Rejestr akcjonariuszy P.S.A.

Aplikacja Kancelarii Notarialnej (notariusz Łukasz Kozon) do prowadzenia rejestrów akcjonariuszy prostych spółek
akcyjnych (art. 300³⁰ i nast. KSH) i portal klienta dla spółek i akcjonariuszy. Node.js 20+, Express, SQLite
(better-sqlite3), React 18 budowany esbuildem, pisma w PDF (pdfkit).

## Mapa dokumentów

| Plik | Co zawiera |
|---|---|
| `README.md` | uruchomienie, tryb testowy, testy, wzory pism (ten plik) |
| `ARCHITEKTURA-PSA.md` | budowa aplikacji, model danych, reguły domenowe, bezpieczeństwo |
| `DECYZJE.md` | rozstrzygnięcia notariusza i decyzje projektowe (D-001…, U-01…U-30) |
| `PRZEPISY-PSA.md` | przepisy (KSH, Prawo o notariacie, taksa) i mapa przepis → element systemu |
| `raporty/FAZA-*.md` | raporty z faz uproszczenia (listopad 2026) |
| `docs/endpointy-api.md`, `docs/schemat-bazy.txt` | generowane: `npm run dokumentacja` |
| `docs/archiwum/` | dawne specyfikacje, audyty i raporty — tylko do wglądu |

## Uruchomienie

```bash
npm install
cp .env.przyklad .env        # sekret sesji, ADMIN_EMAIL, SMTP, tpay, URL_PORTALU
npm start                    # buduje front i startuje serwer: http://localhost:3005
```

- **Kancelaria:** `http://localhost:3005/` (pracownicy, logowanie e-mailem i hasłem).
  **Portal klienta:** `/portal` (gdy `PORTAL_WLACZONY=true`).
- **Pierwszy start:** przy pustej tabeli pracowników serwer zakłada administratora `ADMIN_EMAIL` z hasłem
  tymczasowym wypisanym raz w logu. Potem **Ustawienia** (menu konta): dane kancelarii do pism, osoby
  zawierające umowy, użytkownicy, „Sprawdź integralność rejestru”. Dane kancelarii są wyłącznie tam, nie w `.env`.
- **Schemat bazy** zakłada się sam (jedna migracja bazowa). Migracja odmawia działania, jeśli zakładanie od nowa
  skasowałoby wpisy rejestru w bazie nieoznaczonej jako testowa.
- **Front:** źródła w `publiczne/js/` (JSX), paczki w `publiczne/dist/` są w repozytorium.
  Po zmianie w `publiczne/js/` uruchom `npm run buduj`, bo test `front-js` pilnuje zgodności.
  `npm run dev` buduje na bieżąco.
- **Produkcja:** reverse proxy z HTTPS (nagłówek `Host` przekazany bez zmian), `NODE_ENV=production`, dostęp
  do aplikacji kancelarii tylko z adresów kancelarii (zapora). Dysk serwera i kopie zapasowe bazy oraz katalogu
  `KATALOG_DOKUMENTOW` — szyfrowane (baza zawiera dane osobowe jawnie; hasła — bcrypt, tokeny — skróty).
- **Proces dzienny** startuje z serwerem: opłaty za prowadzenie rejestru, przypomnienia, retencja danych.

## Tryb testowy (dane fikcyjne, bez wysyłki e-maili)

1. W `.env`: `PSA_TRYB_TESTOWY=1`.
2. `npm run test:seed` — zakłada od nowa bazę `dane-testowe/kancelaria-testowa.db` z danymi fikcyjnymi.
3. `npm start` → na ekranie logowania lista kont testowych (jedno kliknięcie = logowanie).

Konta (hasło `Test-Haslo-2026`):

| Konto | Rola |
|---|---|
| `notariusz@example.com` | kancelaria, administrator |
| `pracownik@example.com` | kancelaria, pracownik |
| `alfa.zarzad@example.com` | portal, działa za Alfa Testowa P.S.A. |
| `anna.zgoda@example.com` | portal, akcjonariuszka Alfy ze zgodą na e-mail |
| `gamma.zarzad@example.com` | portal, wnioskodawca z dokumentami do podpisu |

Dane w seedzie:
- Alfa: otwarty rejestr, dwie serie, ułamek akcji, zastaw z prawem głosu;
- zbycie akcji czekające na „Nadano” powiadomienia listem;
- informacja z rejestru do zapłaty;
- Beta: rejestr nieotwarty;
- wniosek Gammy;
- atrapa KRS odpowiada dla numerów `0000990001`–`0000990004`.

Narzędzia trybu testowego:
- **Skrzynka testowa** `/test/skrzynka`: każdy e-mail jako `.eml`, nic nie wychodzi z serwera.
- **Panel** `/test`:
  - symulowana data (terminy, chwile wpisów; nie wcześniej niż ostatni wpis);
  - atrapa testu podpisu;
  - atrapa kasy tpay — wysyła prawdziwe powiadomienie ITN na `/api/psa/platnosci/tpay/itn`.
- `npm run test:link -- <e-mail>` — link aktywacyjny albo adres logowania konta.
- `npm run test:oznacz -- <plik>` — oznacza kopię bazy jako testową.

Zabezpieczenia trybu testowego:
- serwer odmawia startu przy `NODE_ENV=production` albo na bazie nieoznaczonej jako testowa;
- poza trybem testowym `/test/*` zwraca 404, a moduły `server/tryb-testowy/` w ogóle się nie wczytują.

## Testy

```bash
npm test                     # node:test — serwer, logika, trasy HTTP, bezpieczeństwo (§ 7)
npm run e2e                  # Playwright: scenariusze kancelarii i portalu przy 1440 i 390 px
npm run e2e:malpa            # „małpa”: każdy aktywny przycisk i link głównych ekranów
node --test --experimental-test-coverage "testy/*.test.js"   # pokrycie
```

- **Testy HTTP** stawiają serwer na osobnej bazie w `dane/.test-*.db`.
- **e2e:** każdy scenariusz dostaje własny serwer w trybie testowym na świeżej bazie z `test:seed`. Wynik trafia do
  `testy/e2e/raport/wyniki.json` (błędy JS i HTTP, naruszenia axe, problemy układu), zrzuty — do `testy/e2e/raport/arkusze/`.
- **Lista dozwolonych tras API:** `testy/trasy-dozwolone.txt`. Nowa trasa wymaga świadomego dopisania — inaczej
  `bezpieczenstwo.test.js` nie przejdzie.
- **Uruchom przed każdą zmianą:** `npm test`, a przy zmianie ekranów także `npm run e2e`.

## Wzory pism

Pisma powstają z plików Markdown w `wzory/` (8 wzorów: umowa, uchwała, zgoda na e-mail, trzy powiadomienia,
wezwanie, informacja z rejestru); wynik zawsze PDF. Składnia pól (`{{pole}}`, `{{#lista}}`, `{{#jesli}}`)
i lista pól — `wzory/README.md`.

Zmiana treści pisma:
1. edytuj plik wzoru;
2. `npm run wzory` — tworzy podgląd każdego wzoru z danymi próbnymi w `wzory/podglad/`;
3. `npm test` — test „bez pustych pól”.

Pismo raz wydane zostaje bez zmian, bo PDF i jego SHA-256 zapisują się przy pierwszym wygenerowaniu.

## Strona publiczna

`npm run buduj-strone` buduje stronę informacyjną (`strona/` → `strona/dist/`). Stawki czyta z `server/logika/przepisy.js`,
adres z `BASE_URL_STRONA`; serwer aplikacji jej nie serwuje.
