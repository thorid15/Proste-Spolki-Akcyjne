# Wdrożenie rejestru PSA w internecie — zestawienie informacji

**Dla kogo:** notariusz (decyzje) oraz wykonawca IT / administrator / inspektor ochrony danych
(realizacja). **Stan na:** 2026-09-26, gałąź `claude/serene-cray-y373cf`.
**Źródło:** kod aplikacji i dokumentacja w repozytorium. Tam, gdzie opis i kod się różnią,
rozstrzyga kod (np. `ARCHITEKTURA-PSA.md` wspomina jeszcze o Babelu, którego już nie ma).

Oznaczenia: ✅ gotowe w aplikacji · ⚠️ do zrobienia albo do decyzji przed uruchomieniem ·
❌ brak w aplikacji, trzeba zapewnić w infrastrukturze.

---

## 0. Streszczenie dla notariusza

1. Aplikacja to **jeden program serwerowy** (Node.js) z **jednym plikiem bazy danych** (SQLite)
   i **jednym katalogiem plików** (skany dokumentów, w tym skany dowodów osobistych do AML).
   Jest prosta w utrzymaniu, ale działa tylko jako **jedna kopia na jednym serwerze**.
2. Przetwarza **dane osobowe wysokiego ryzyka**: numery PESEL, adresy zamieszkania, skany dowodów
   tożsamości, oświadczenia PEP, dane beneficjentów rzeczywistych. Wszystko objęte tajemnicą
   notarialną. To najważniejsze kryterium wyboru hostingu.
3. **Nie ma w aplikacji kopii zapasowych** — to trzeba zapewnić w infrastrukturze. To warunek
   konieczny przed uruchomieniem.
4. Pięć decyzji po Pana stronie jest w sekcji 11. Najważniejsza to **gdzie fizycznie stoi serwer
   z danymi**: u zewnętrznego dostawcy w Polsce (VPS) czy w kancelarii.
5. Kilka drobnych poprawek w kodzie warto zrobić przed startem (sekcja 9). Nie blokują wyboru
   hostingu.

---

## 1. Z czego składa się system

| Część | Dla kogo | Adres (przykład) | Uwagi |
|---|---|---|---|
| **Panel kancelarii** | notariusz, zastępca, pracownicy | `https://rejestr.kancelaria.pl/` | pełny dostęp do rejestru, AML, dokumentów |
| **Portal klienta** | spółki i akcjonariusze | `https://rejestr.kancelaria.pl/portal.html` | zgłoszenie, wniosek, wgrywanie dokumentów, podgląd rejestru (z maskowaniem), płatności; **wyłączany flagą** `PORTAL_WLACZONY` |
| **Strona publiczna** (informacyjna, SEO) | wszyscy | np. `https://psa.kancelaria.pl` | **osobny zestaw plików statycznych** (`strona/dist/`), nie potrzebuje serwera aplikacji ani bazy |
| **Webhook płatności** | operator tpay | `https://…/api/psa/platnosci/tpay/itn` | musi być osiągalny z internetu, jeśli płatności online mają działać |

Panel i portal to **ten sam program** i ta sama baza — różnią się tylko uprawnieniami po zalogowaniu.

---

## 2. Technologia (dla wykonawcy)

| Element | Co jest | Znaczenie dla wdrożenia |
|---|---|---|
| Środowisko | **Node.js ≥ 20** (testowane na 22 LTS) | na serwerze musi być Node 20/22 LTS |
| Serwer HTTP | **Express 4.22** | jeden proces, domyślnie port **3005** (`PORT`) |
| Baza danych | **SQLite** przez `better-sqlite3` 11.10, **jeden plik** (`WSPOLNA_BAZA`, domyślnie `./dane/kancelaria.db`), tryb WAL, 37 tabel, migracje wykonują się same przy starcie | brak osobnego serwera bazy; plik musi leżeć na **dysku lokalnym** (nie NFS/udział sieciowy); **tylko jedna instancja aplikacji** naraz |
| Frontend | **React 18** — pliki z repozytorium (`publiczne/vendor/`), bez CDN | **Babela w przeglądarce nie ma** (usunięty, D-046). JSX kompiluje `esbuild` na etapie budowania, a gotowe pliki `publiczne/dist/*.js` są w repozytorium. Serwer produkcyjny **nie potrzebuje** esbuild ani kroku budowania |
| Czcionki | lokalne pliki `publiczne/fonty/` | brak odwołań do Google Fonts w panelu i portalu (wyjątek: sekcja 9, pkt 3) |
| Hasła | **bcrypt** 6.0 | moduł natywny — do instalacji potrzebne narzędzia kompilacji (`build-essential`, `python3`) albo gotowe binaria dla danej platformy |
| Pliki od klientów | **multer** 1.4.5-lts.2, limit **20 MB** na plik, do 10 plików | typ pliku ustala serwer (biała lista: PDF, JPG, PNG, DOC, DOCX) i sprawdza sygnaturę treści |
| PDF | **pdfkit** 0.20 | generowanie po stronie serwera, bez usług zewnętrznych |
| Dokumenty Word | własny generator `.docx` ze wzorów w `wzory/` | bez usług zewnętrznych |
| E-mail | **nodemailer** 10 (SMTP) | potrzebny zewnętrzny serwer poczty (sekcja 6) |
| Zadania cykliczne | `setInterval` w procesie (przypomnienia o opłacie rocznej, raz na dobę) | brak crona; działa, dopóki działa proces |
| Podatności | `npm audit --omit=dev`: **0 znanych podatności** (26.09.2026) | sprawdzać przy każdej aktualizacji |
| Rozmiar | `node_modules` ok. 60 MB; baza dziś 0,4 MB; dokumenty testowe 63 MB | dysk rośnie głównie przez skany (patrz sekcja 7) |

**Ważne ograniczenia architektury (do przekazania wykonawcy):**
- **Jedna instancja.** SQLite, limiter prób logowania w pamięci, harmonogram w procesie i token
  tpay w pamięci zakładają jeden proces. Nie uruchamiać kilku kopii ani „auto-skalowania”.
- **Strefa czasowa `Europe/Warsaw` jest wymuszona.** Aplikacja odmówi startu przy innej strefie
  (godziny na zawiadomieniach). Data wpisu do rejestru jest zapisywana w UTC, a pokazywana
  w czasie polskim.
- **Za reverse proxy.** Aplikacja zakłada, że HTTPS obsługuje proxy (nginx / Caddy / Traefik) przed
  nią (`trust proxy = 1`). Proces nie powinien być wystawiony bezpośrednio na port 80/443.

---

## 3. Dane osobowe — co, gdzie, kto widzi

### 3.1 Kategorie danych

| Kategoria | Przykłady pól | Gdzie | Ryzyko |
|---|---|---|---|
| Akcjonariusze — osoby fizyczne | imię, nazwisko, **PESEL**, **data urodzenia**, **adres zamieszkania**, adres do doręczeń / e-doręczeń, e-mail, telefon, płeć | baza (`psa_osoby`, `psa_wnioski_akcjonariusze`) | **wysokie** |
| Akcjonariusze — osoby prawne | firma, KRS, NIP, REGON, siedziba | baza | niskie |
| AML / przeciwdziałanie praniu pieniędzy | status AML, notatka, oświadczenie **PEP**, **beneficjent rzeczywisty** | baza (`psa_osoby`) | **wysokie** |
| **Skany dokumentów tożsamości** (dowód, paszport) | pliki obrazów / PDF, pole `retencja_do` | **dysk** `KATALOG_DOKUMENTOW/aml/` + wpis w `psa_osoby_skany_aml` | **najwyższe** |
| Reprezentant spółki | imię, nazwisko, **PESEL**, **dokument tożsamości**, **imiona rodziców**, adres | baza (`psa_spolki`, `psa_wnioski`) | **wysokie** |
| Dokumenty spraw | umowy zbycia akt, postanowienia spadkowe, uchwały, podpisane umowy | **dysk** `KATALOG_DOKUMENTOW/spolka_N/` | **wysokie** (tajemnica notarialna) |
| Rejestr (łańcuch zdarzeń) | kto, kiedy, ile akcji, od kogo; osoba działająca (notariusz/zastępca) | baza (`psa_zdarzenia`, append-only) | wysokie; **nie da się usunąć** — patrz 3.4 |
| Wygenerowane pisma | zawiadomienia, informacje z rejestru, wezwania | baza (`psa_wydane_dokumenty`) + pliki | wysokie |
| Konta portalu | e-mail, skrót hasła (bcrypt), akceptacja RODO | baza (`psa_konta`) | średnie |
| Pracownicy | imię, e-mail, skrót hasła, rola | baza (`psa_uzytkownicy`) | średnie |
| Dziennik dostępu | kto, kiedy, jaka spółka / osoba, jaka czynność (bez adresu IP) | baza (`psa_dziennik_dostepu`, append-only) | średnie |
| Płatności | kwota, status, identyfikator transakcji tpay (**bez danych kart**) | baza (`psa_platnosci`, `psa_oplaty`) | niskie |

### 3.2 Kto widzi co (zaimplementowane ✅)
- **Kancelaria** — wszystko, w tym AML, PEP, uwagi wewnętrzne.
- **Spółka** — pełne dane rejestru swojej spółki (art. 300³⁵ KSH), bez AML/PEP i uwag wewnętrznych.
- **Akcjonariusz** — dane własne w całości; dane innych akcjonariuszy **z maskowaniem** PESEL, daty
  urodzenia i adresu zamieszkania.
- Wgląd spółki w dane współakcjonariuszy jest zapisywany w dzienniku dostępu.

### 3.3 Obowiązki RODO i tajemnica notarialna (do zrobienia poza aplikacją ⚠️)
- **Administrator danych:** kancelaria. **Podmioty przetwarzające:** hosting, dostawca poczty
  (SMTP), tpay (tylko dane płatności), dostawca kopii zapasowych. Z każdym potrzebna **umowa
  powierzenia przetwarzania** (art. 28 RODO).
- **Lokalizacja danych:** rekomendacja — serwery i kopie zapasowe w Polsce, co najmniej w EOG; bez
  przekazywania poza EOG.
- **Tajemnica notarialna i przepisy samorządu notarialnego:** przed wyborem hostingu zewnętrznego
  potwierdzić z właściwą izbą notarialną / KRN, czy i na jakich warunkach dane objęte tajemnicą
  mogą być przechowywane u zewnętrznego dostawcy.
- **Ocena skutków dla ochrony danych (DPIA):** przy skanach dowodów, PESEL i danych AML na serwerze
  dostępnym z internetu jest wysoce zalecana — do decyzji inspektora ochrony danych.
- **Rejestr czynności przetwarzania** — dopisać tę usługę.
- **Klauzula informacyjna** dla klientów portalu — w aplikacji jest wzór 02 (informacja RODO)
  i akceptacja przy zakładaniu konta ✅.

### 3.4 Retencja (okres przechowywania) ⚠️
- Pole `retencja_do` przy skanach AML **jest zapisywane, ale nic go nie egzekwuje** — brak
  automatycznego usuwania.
- Porzucone i odrzucone wnioski z portalu (z danymi osobowymi) **nie są nigdy usuwane**.
- Zdarzenia rejestru są **nieusuwalne z założenia** (integralność rejestru, art. 300³¹ § 4 KSH).
  Uzasadnienie retencji trzeba ująć w dokumentacji RODO.
- Do ustalenia: okresy (AML — zwykle 5 lat od zakończenia relacji; wnioski porzucone — np. 12
  miesięcy) i czy robimy automatyczne sprzątanie.

---

## 4. Przepływ informacji

```
                       INTERNET
 ┌────────────────┐        │        ┌──────────────────────────────┐
 │ Klient         │──HTTPS─┼───────▶│ Reverse proxy (TLS)          │
 │ (spółka,       │        │        │  nginx / Caddy               │
 │  akcjonariusz) │        │        └──────────────┬───────────────┘
 └────────────────┘        │                       │ http://127.0.0.1:3005
 ┌────────────────┐        │        ┌──────────────▼───────────────┐
 │ Pracownik      │──HTTPS─┼───────▶│ Aplikacja (Node.js, 1 proces)│
 │ kancelarii     │        │        │  ├─ baza SQLite (1 plik)     │
 └────────────────┘        │        │  └─ katalog dokumentów       │
 ┌────────────────┐        │        └──┬──────────┬─────────┬──────┘
 │ tpay (ITN)     │──HTTPS─┼──────────▶│          │         │
 └────────────────┘        │  wychodzące połączenia:        │
                           │    ├─▶ API KRS (api-krs.ms.gov.pl) — dane spółki po numerze KRS
                           │    ├─▶ tpay (api.tpay.com) — zakładanie płatności
                           │    └─▶ serwer SMTP — e-maile (zaproszenia, zawiadomienia)
```

### 4.1 Główne ścieżki danych
1. **Zgłoszenie przez stronę / portal** — klient podaje e-mail i numer KRS → aplikacja pobiera dane
   spółki z API KRS → zakłada nieaktywne konto → wysyła e-mail z linkiem aktywacyjnym.
2. **Wniosek w portalu** — dane spółki, reprezentanta i akcjonariuszy (PESEL, adresy), wgrywanie
   skanów (także dowodów do AML) → kancelaria weryfikuje → generuje umowę → klient odsyła podpisaną
   → kancelaria przyjmuje wniosek i otwiera rejestr.
3. **Sprawy (żądania wpisu)** — z portalu albo wprowadzone w kancelarii (papier, e-mail) → termin
   7 dni → weryfikacja (checklista, AML) → wpis → **zawiadomienia e-mailem** → opłata.
4. **Informacja z rejestru** — zamawiana w portalu → opłata (tpay albo faktura) → dokument HTML do
   wydruku / PDF; w kancelarii podgląd na żywo.
5. **Płatności** — aplikacja zakłada transakcję w tpay → klient płaci na stronie tpay → tpay wysyła
   powiadomienie (ITN) na publiczny adres aplikacji → opłata oznaczona jako zapłacona.
6. **Przypomnienia** — raz na dobę e-mail o kończącym się roku prowadzenia rejestru.

### 4.2 Połączenia sieciowe (dla firewalla)

| Kierunek | Z / do | Port | Po co | Obowiązkowe? |
|---|---|---|---|---|
| przychodzące | internet → proxy | 443 (i 80 → przekierowanie) | panel, portal, webhook tpay | tak |
| lokalne | proxy → aplikacja | 3005 (tylko 127.0.0.1) | — | tak |
| wychodzące | aplikacja → `api-krs.ms.gov.pl` | 443 | pobieranie danych z KRS | zalecane (bez niego formularz ręczny) |
| wychodzące | aplikacja → `api.tpay.com`, `secure.tpay.com` (certyfikat JWS) | 443 | płatności | tylko jeśli płatności online |
| wychodzące | aplikacja → serwer SMTP | 587 (STARTTLS) albo 465 | e-maile | tak (bez poczty zaproszenia i zawiadomienia trzeba wysyłać ręcznie) |
| wychodzące | serwer → miejsce kopii zapasowych | wg dostawcy | kopie | tak |

---

## 5. Bezpieczeństwo — co już jest w aplikacji ✅

- Nagłówki bezpieczeństwa: **CSP** (tylko własne skrypty, bez `unsafe-eval`), `X-Frame-Options:
  DENY`, `nosniff`, `Referrer-Policy`, **HSTS** przy HTTPS.
- Logowanie e-mail + hasło, hasła **bcrypt**; sesje w ciasteczku **HttpOnly, SameSite=Lax,
  Secure** (za HTTPS), podpisane HMAC (`SESJA_SEKRET`); ważność: pracownik **12 h**, portal **8 h**;
  unieważnianie sesji przy wylogowaniu.
- **Limit prób logowania** (per IP i per konto) — w pamięci procesu.
- Role: admin / pracownik / spółka / akcjonariusz / wnioskodawca; każda trasa sprawdza dostęp do
  konkretnej spółki.
- Pliki: biała lista typów, kontrola sygnatury, pliki poza katalogiem publicznym, serwowane tylko
  po sprawdzeniu uprawnień.
- **Integralność rejestru:** łańcuch skrótów SHA-256 nad zdarzeniami, tabela append-only
  (wyzwalacze w bazie), endpoint weryfikacji.
- Dziennik dostępu do danych rejestru (append-only).
- Maskowanie danych wrażliwych wobec innych akcjonariuszy; dane AML/PEP nigdy poza kancelarią.
- Sekrety (hasła SMTP, klucze tpay) tylko w `.env`, nigdy w bazie; `.env`, baza i katalog
  dokumentów są wyłączone z repozytorium (`.gitignore`).
- Portal i narzędzie deweloperskie `/podglad` domyślnie **wyłączone** flagami.

## 6. Czego aplikacja nie zapewnia — musi to zrobić infrastruktura ❌

| Obszar | Wymaganie | Rekomendacja |
|---|---|---|
| **HTTPS** | certyfikat TLS, przekierowanie 80→443 | Caddy albo nginx + Let's Encrypt |
| **Kopie zapasowe** | brak w aplikacji | co najmniej raz na dobę: **baza** (spójna kopia przez `sqlite3 .backup` albo `VACUUM INTO`, **nie** kopiowanie pliku w trakcie pracy) + **katalog dokumentów** + `.env`; **szyfrowane**, poza serwerem (offsite, PL/EOG); retencja np. 30 dni + miesięczne; **test odtworzenia** przed startem i okresowo |
| **Szyfrowanie danych na dysku** | baza i skany leżą jawnie | szyfrowanie dysku/woluminu (LUKS lub szyfrowany wolumin dostawcy) |
| **Uruchamianie procesu** | brak | systemd (albo pm2) z automatycznym restartem; `NODE_ENV=production` |
| **Monitoring** | brak endpointu „health” | monitoring dostępności strony (np. co 5 min) + alarm; kontrola wolnego miejsca na dysku |
| **Logi** | aplikacja pisze na konsolę | zbierać przez journald / pliki z rotacją; logi **nie zawierają** treści dokumentów ani PESEL (zasada projektu) |
| **Aktualizacje** | — | łatki systemu (unattended-upgrades), aktualizacje Node LTS, `npm audit` przy wdrożeniu |
| **Poczta** | potrzebny SMTP | dostawca z TLS i umową powierzenia; domena nadawcy z **SPF, DKIM, DMARC** (inaczej e-maile trafią do spamu) |
| **Dostęp administracyjny** | — | SSH tylko kluczem, bez logowania hasłem i bez roota; firewall (ufw) |
| **Ochrona panelu kancelarii** | brak 2FA | patrz sekcja 9, pkt 4 |

## 7. Wymagania sprzętowe (szacunek)

| Zasób | Minimum | Uwagi |
|---|---|---|
| CPU | 1–2 vCPU | obciążenie znikome (setki spółek, kilku użytkowników) |
| RAM | 1–2 GB | Node + system |
| Dysk | 20–40 GB SSD na start | baza rośnie wolno (MB); **skany**: przy ~500 spółkach i kilku dokumentach po 1–5 MB → rząd **5–20 GB** w kilka lat; limit 20 MB na plik |
| System | Linux (Ubuntu 22.04/24.04 LTS albo Debian 12) | strefa czasowa `Europe/Warsaw` |
| Lokalizacja | PL / EOG | patrz 3.3 |

---

## 8. Konfiguracja (`.env`) — co trzeba ustawić

Wzór: `.env.przyklad`. Plik `.env` **nie trafia do repozytorium**.

| Zmienna | Sekret? | Wartość produkcyjna / uwagi |
|---|---|---|
| `PORT` | nie | 3005 (nasłuch tylko lokalnie, za proxy) |
| `WSPOLNA_BAZA` | nie | ścieżka na dysku lokalnym, np. `/srv/psa/dane/kancelaria.db` |
| `KATALOG_DOKUMENTOW` | nie | np. `/srv/psa/dokumenty` (poza katalogiem publicznym) |
| `ADMIN_EMAIL` | nie | e-mail notariusza — przy pierwszym starcie powstaje konto admina, **hasło tymczasowe jest raz wypisane w logu** (zmienić od razu, log wyczyścić) |
| `SESJA_SEKRET` | **TAK** | długi losowy ciąg (np. 64 znaki); bez niego sesje wygasają przy każdym restarcie |
| `SMTP_HOST/PORT/USER/PASS/FROM` | **PASS — tak** | dane dostawcy poczty |
| `KRS_API_URL` | nie | `https://api-krs.ms.gov.pl/api/krs` |
| `PORTAL_WLACZONY` | nie | `false` do czasu decyzji; `true` po testach |
| `URL_PORTALU` | nie | publiczny adres portalu (linki w e-mailach) |
| `TZ` | nie | `Europe/Warsaw` (wymagane) |
| `PODGLAD_SYSTEMU` | nie | **`false`** na produkcji |
| `KANCELARIA_*`, `NOTARIUSZ_MIANOWNIK`, `PODPISUJACY_*` | nie | dane na nagłówki pism — **uzupełnić** (puste pola dają kreski w umowach) |
| `POKAZ_ZNAK_IZBY`, `NAZWA_IZBY` | nie | wg decyzji notariusza |
| `TPAY_CLIENT_ID`, `TPAY_CLIENT_SECRET`, `TPAY_NOTIFICATION_SECRET` | **TAK** | z panelu tpay; bez nich płatności online są wyłączone (opłaty rozlicza się fakturą) |
| `TPAY_API_URL` | nie | `https://api.tpay.com` (produkcja) |
| `TPAY_TRYB_TESTOWY` | nie | **`false`** na produkcji (inaczej fałszywe powiadomienia testowe mogłyby księgować opłaty) |
| `TPAY_URL_POWROTU` | nie | publiczny adres portalu `#/platnosci` |

Uprawnienia pliku `.env`: tylko użytkownik systemowy aplikacji (`chmod 600`).

---

## 9. Do poprawienia w aplikacji przed uruchomieniem ⚠️

| # | Co | Dlaczego | Pilność |
|---|---|---|---|
| 1 | **Link aktywacyjny w odpowiedzi HTTP**, gdy nie działa poczta (`POST /api/psa/portal/zgloszenia`) | ktoś może zgłosić się cudzym e-mailem i od razu aktywować konto, bez dostępu do skrzynki. W prototypie wygodne, w internecie — furtka | **wysoka** — wyłączyć w produkcji |
| 2 | **Brak kopii zapasowych** | utrata serwera = utrata rejestru | **krytyczna** (infrastruktura, sekcja 6) |
| 3 | **Informacja z rejestru odwołuje się do Google Fonts** | CSP i tak blokuje ładowanie (czcionka zastępcza), ale odwołanie jest zbędne i przy innej konfiguracji ujawniłoby Google adres IP klienta | niska — usunąć, użyć lokalnych czcionek |
| 4 | **Brak drugiego składnika logowania (2FA)** do panelu kancelarii | panel daje dostęp do PESEL, skanów dowodów i AML; samo hasło to słabe zabezpieczenie w internecie | **wysoka** — albo 2FA (TOTP), albo panel dostępny tylko z adresów kancelarii / przez VPN (sekcja 10) |
| 5 | **Brak automatycznej retencji** (skany AML, porzucone wnioski) | RODO — minimalizacja danych | średnia — po ustaleniu okresów (3.4) |
| 6 | **Endpoint „health”** do monitoringu | żeby monitoring nie musiał logować się do aplikacji | niska |
| 7 | **Start z czystą bazą** | aktualizacja bazy nr 57 (usunięcie daty zdarzenia) wykona się tylko na bazie bez wpisów; baza deweloperska z danymi testowymi **nie może** trafić na produkcję | **wysoka** (procedura) |
| 8 | **multer 1.x** | wersja 1.4.5-lts.2 nie ma dziś zgłoszonych podatności, ale linia 1.x jest wygaszana | niska — rozważyć 2.x przy najbliższej aktualizacji |
| 9 | **Cytaty art. 300³⁵ § 1¹ i 300³² § 3 KSH** (nowelizacja Dz.U. 2026 poz. 176, od 18.02.2027) | teksty na dokumentach | przed 18.02.2027 |

---

## 10. Warianty wdrożenia

| Wariant | Opis | Plusy | Minusy |
|---|---|---|---|
| **A. Wszystko na VPS w Polsce** (rekomendacja specyfikacji) | panel + portal + baza u dostawcy chmurowego/VPS w PL | prosto, portal pokazuje stan rejestru na żywo, łatwe kopie i monitoring | dane objęte tajemnicą poza kancelarią → umowa powierzenia, szyfrowanie, potwierdzenie z samorządem |
| **A+. VPS, panel ograniczony** (moja rekomendacja) | jak A, ale **panel kancelarii dostępny tylko z IP kancelarii albo przez VPN**, portal publiczny | jak A + panel z pełnymi danymi niewidoczny z internetu; rozwiązuje brak 2FA (pkt 9.4) bez zmian w kodzie | wymaga konfiguracji VPN / stałego IP w kancelarii |
| **B. Rdzeń w kancelarii + „skrzynka podawcza” na VPS** | rejestr na serwerze w kancelarii; w internecie tylko przyjmowanie zgłoszeń i plików | dane nie opuszczają kancelarii | **wymaga przebudowy aplikacji** (dziś to jeden program z jedną bazą); portal nie pokaże stanu na żywo; serwer w kancelarii = własne kopie, zasilanie, łącze |
| **C. Serwer w kancelarii wystawiony do internetu** | cała aplikacja na serwerze w biurze, dostęp przez łącze kancelarii | dane fizycznie u notariusza | zależność od łącza i zasilania biura, trudniejsze zabezpieczenie; zwykle gorsze bezpieczeństwo niż profesjonalny VPS |

Strona publiczna (informacyjna) może stać osobno, na dowolnym hostingu statycznym albo na tej samej
maszynie — nie zawiera danych.

---

## 11. Decyzje do podjęcia (notariusz)

1. **Wariant:** A, A+ (rekomendacja), B czy C?
2. **Dostawca hostingu** (serwery w PL; umowa powierzenia; kopie offsite) — np. polscy dostawcy VPS
   lub chmury z centrami danych w Polsce. Wybór i umowę najlepiej zlecić wykonawcy IT.
3. **Konsultacja z samorządem notarialnym** — przechowywanie danych objętych tajemnicą u
   zewnętrznego dostawcy.
4. **Portal klienta od pierwszego dnia czy później?** (`PORTAL_WLACZONY`) — można najpierw
   uruchomić sam panel kancelarii.
5. **Płatności online (tpay) od startu czy faktury?**
6. **Okresy retencji** skanów AML i porzuconych wniosków (3.4) i czy robimy automatyczne sprzątanie.
7. **Domena i adresy:** np. `rejestr.<domena kancelarii>` (panel/portal), osobno strona publiczna.
8. **Dostawca poczty** i adres nadawcy (np. `rejestr@<domena>`).

---

## 12. Lista kontrolna dla wykonawcy

- [ ] Serwer Linux w PL/EOG, strefa `Europe/Warsaw`, szyfrowany dysk, SSH tylko kluczem, firewall.
- [ ] Node.js 22 LTS, narzędzia kompilacji dla modułów natywnych (`bcrypt`, `better-sqlite3`).
- [ ] Użytkownik systemowy aplikacji bez uprawnień roota; katalogi `dane/` i `dokumenty/` tylko
      dla niego.
- [ ] `git clone` gałęzi produkcyjnej → `npm ci --omit=dev` → `.env` wg sekcji 8 → **pusta baza**.
- [ ] systemd z restartem; nasłuch tylko na `127.0.0.1:3005`.
- [ ] Reverse proxy z TLS (Let's Encrypt), przekierowanie 80→443, limit rozmiaru żądania ≥ 25 MB
      (pliki do 20 MB), nagłówek `X-Forwarded-Proto`.
- [ ] (Wariant A+) Ograniczenie panelu (`/`, `/api/psa/*` poza `/api/psa/portal/*` i
      `/api/psa/platnosci/*`) do IP kancelarii / VPN — do uzgodnienia listy tras z autorem aplikacji.
- [ ] SMTP z TLS; SPF, DKIM, DMARC dla domeny nadawcy; test wysyłki.
- [ ] tpay: konto produkcyjne, adres powiadomień ITN = publiczny adres webhooka, `TPAY_TRYB_TESTOWY=false`.
- [ ] Kopie zapasowe: codziennie baza (`.backup`) + dokumenty + `.env`, szyfrowane, offsite;
      **test odtworzenia**.
- [ ] Monitoring dostępności i miejsca na dysku; zbieranie i rotacja logów.
- [ ] Pierwsze logowanie admina, zmiana hasła, usunięcie hasła tymczasowego z logu.
- [ ] Weryfikacja: `GET /api/psa/integralnosc` zwraca `ok`; logowanie, portal (jeśli włączony),
      wysyłka e-maila, płatność testowa w piaskownicy tpay przed przełączeniem na produkcję.
- [ ] Strona publiczna: `node narzedzia/buduj-strone.js` z `BASE_URL_STRONA` → wgrać
      `strona/dist/` na hosting statyczny.
- [ ] Procedura aktualizacji: kopia bazy → `git pull` → `npm ci --omit=dev` → restart (migracje
      wykonują się same przy starcie).

---

## 13. Słowniczek (dla notariusza)

- **VPS** — wynajęty serwer w centrum danych dostawcy.
- **Reverse proxy** — „bramka” przed aplikacją, która obsługuje szyfrowanie HTTPS.
- **TLS / HTTPS** — szyfrowanie połączenia między przeglądarką a serwerem (kłódka w przeglądarce).
- **SQLite** — baza danych w jednym pliku; nie wymaga osobnego serwera bazy.
- **Babel / esbuild** — narzędzia, które tłumaczą kod interfejsu na zrozumiały dla przeglądarki.
  U nas robi to esbuild **przed** wdrożeniem, więc na serwerze nic takiego nie działa.
- **SMTP** — serwer wysyłający e-maile.
- **Webhook / ITN** — automatyczne powiadomienie od tpay, że klient zapłacił.
- **2FA** — drugi składnik logowania (np. kod z aplikacji w telefonie).
- **Offsite** — kopia zapasowa przechowywana w innym miejscu niż serwer.
- **DPIA** — ocena skutków dla ochrony danych (RODO, art. 35).
