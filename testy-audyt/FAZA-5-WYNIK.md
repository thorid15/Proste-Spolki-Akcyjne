# FAZA 5 — bezpieczeństwo i izolacja danych — wynik

> Zakres znalezisk zarezerwowany: Z-250…Z-289. Faktycznie użyto: **Z-250…Z-264** (15 wpisów — 2
> KRYTYCZNE, 1 POWAŻNY, 2 DROBNE, 9 POZYTYWNYCH, 1 pogłębienie wcześniejszego Z-001). Pełna treść
> w `testy-audyt/ZNALEZISKA.md`, sekcja „FAZA 5”.

---

## ⚠️ NAJWAŻNIEJSZE DLA ŁUKASZA — PRZECZYTAJ TO NAJPIERW

**Znaleziono DWA błędy KRYTYCZNE. Nie są to IDOR ani wyciek cudzego rejestru (te mechanizmy
przetestowałem wyczerpująco i działają poprawnie — zero problemów). Problem jest głębszy:
mechanizm sesji w całej aplikacji nie ma żadnego sposobu na unieważnienie już wydanego tokenu.**

1. **Z-250 — „Wyloguj” nie wylogowuje na serwerze.** Kliknięcie „Wyloguj” (portal klienta LUB
   panel pracownika kancelarii — dotyczy OBU) tylko każe przeglądarce skasować ciasteczko. Sam
   token pozostaje ważny kryptograficznie i **będzie działał dla każdego, kto go wcześniej
   przechwycił, jeszcze przez 8 godzin (portal) / 12 godzin (kancelaria)** — niezależnie od tego,
   ile razy użytkownik się „wyloguje”. Potwierdzone empirycznie: zapisana kopia ciasteczka sprzed
   wylogowania nadal działała po wylogowaniu.

2. **Z-251 — zmiana hasła nie unieważnia sesji.** To poważniejsze niż punkt 1 w praktyce: zmiana
   hasła to STANDARDOWA pierwsza reakcja na podejrzenie włamania na konto („zmień hasło
   natychmiast”) — i w tej aplikacji **nie robi nic** wobec sesji już wydanych wcześniej.
   Potwierdzone empirycznie na koncie administratora: stare ciasteczko działało nadal po zmianie
   hasła na inne. Jedyny sposób, żeby faktycznie odciąć od konta kogoś, kto ma już ważny token, to
   dziś **dezaktywacja całego konta przez administratora** — sam reset/zmiana hasła nie wystarczy.

**Dlaczego to jest KRYTYCZNE, a nie tylko niedogodność:** w kancelarii notarialnej prowadzącej
rejestry PESEL-i, adresów i danych finansowych klientów, ktoś kto przechwyci token sesji (np. przez
złośliwe rozszerzenie przeglądarki, fizyczny dostęp do urządzenia zanim właściciel się wyloguje,
zapisany dysk/backup ze zrzutem pamięci, log pośredniczącego proxy) ma pełny dostęp przez wiele
godzin, a standardowe reakcje na taki incydent („wyloguj się”, „zmień hasło”) **nie chronią wcale**.
Dobra wiadomość: mechanizm techniczny do naprawy JUŻ ISTNIEJE w kodzie w innej postaci — konto
dezaktywowane (`aktywne=0`) traci dostęp NATYCHMIAST, bo stan konta jest sprawdzany w bazie przy
KAŻDYM żądaniu. Brakuje wyłącznie analogicznego mechanizmu dla wylogowania/zmiany hasła (np.
znacznik czasu „sesja ważna od” w tabeli konta, sprawdzany obok `aktywne`). Szczegóły techniczne,
dokładne kroki reprodukcji i rekomendacja napraw: `ZNALEZISKA.md` Z-250 i Z-251.

**Trzecie, poważne (nie krytyczne) znalezisko: Z-253** — dwie z czterech tras wgrywania plików
(skany AML w kartotece osób, załącznik umowy spółki) nie sprawdzają, czy treść pliku faktycznie
odpowiada zadeklarowanemu rozszerzeniu (ten sam mechanizm ochronny ISTNIEJE i działa poprawnie na
pozostałych dwóch trasach — portalu klienta i dokumentów sprawy). Potwierdzone empirycznie:
plik HTML ze skryptem, nazwany `.pdf`, został przyjęty jako rzekomy załącznik umowy spółki. Ryzyko
faktycznego XSS jest w praktyce mocno ograniczone (serwer wymusza poprawny `Content-Type` i
`nosniff` przy pobieraniu, niezależnie od treści), ale to dziura w integralności dokumentacji AML i
niespójność względem reszty aplikacji.

**Wszystko inne z tej fazy jest w porządku lub kosmetyczne** — patrz sekcje niżej.

---

## Co NIE jest problemem — najważniejsze pozytywne potwierdzenia

Te punkty testowałem najintensywniej, bo to one były głównym celem tej fazy (IDOR / izolacja
danych) — i **nie znalazłem ani jednego przypadku wycieku cudzych danych ani ominięcia
autoryzacji** poza dwoma opisanymi wyżej problemami z cyklem życia sesji:

- Izolacja między klientami portalu (spółka A / spółka B, akcjonariusz A / akcjonariusz B, dwóch
  akcjonariuszy TEJ SAMEJ spółki, dwóch wnioskodawców) — **brak IDOR na żadnej przetestowanej
  trasie** portalu, w tym na trasach z odwołaniem pośrednim (sprawa_id, oplata_id, dokument
  wniosku). Zob. Z-256.
- Trzypoziomowy mechanizm autoryzacji `portal.js` (opisany w FAZA 0 jako najbardziej podatny na
  błąd „jedna trasa zapomniana”) — **sprawdziłem każdą trasę z listy `endpointy-api.md`, żadna nie
  została pominięta.**
- `GET /informacja/:id` (dokument „informacja z rejestru”) poprawnie rozróżnia, czy dokument
  wydano spółce czy konkretnemu akcjonariuszowi — zob. Z-257.
- `GET /api/psa/meta` (Z-001 z FAZA 0) — pogłębiona ocena: **DROBNY, nie POWAŻNY.** Ujawnia
  wyłącznie słowniki/checklisty/stawki DOMYŚLNE, zero PII, zero danych konkretnej spółki. Zob.
  Z-252.
- Rate limiting logowania działa (5 prób/15 min na IP+e-mail, 30/15 min na IP) — potwierdzone
  empirycznie na obu ścieżkach logowania. Zob. Z-258.
- Brak path traversal w nazwach wgrywanych plików (wszystkie 4 trasy uploadu). Zob. Z-259.
- Limit rozmiaru pliku (20 MB) egzekwowany wszędzie. Zob. Z-260.
- Błędy 500 i logi serwera nie ujawniają stack trace / SQL / danych osobowych. Dziennik dostępu
  zawiera wyłącznie metadane. Zob. Z-261.
- Katalog `dokumenty/` NIE jest serwowany statycznie (pozorne „200” pod bezpośrednim URL-em to w
  rzeczywistości fallback SPA, nie plik) — zweryfikowane wprost, żeby nikt nie musiał tego
  sprawdzać ponownie. Zob. Z-262.
- Nadpisanie pól spoza formularza (mass assignment: `spolka_id`, `status`, `konto_id`,
  `aml_status`, `zweryfikowano`, `osoba_id`) — skutecznie zablokowane białymi listami pól. Zob.
  Z-263.
- Sesja portalu klienta nie daje żadnego dostępu do endpointów kancelaryjnych (podniesienie
  uprawnień) — zero przypadków. Zob. Z-264.

---

## Lista wszystkich sprawdzonych endpointów (94 z `endpointy-api.md`)

Legenda: **[na żywo]** = przetestowane bezpośrednim żądaniem HTTP w tej sesji. **[statyczne]** =
zweryfikowane przeglądem kodu + potwierdzone żywym testem reprezentatywnej próbki z tego samego
mechanizmu gate'owania (patrz uzasadnienie w sekcji „Metodologia i ograniczenia” niżej — te trasy
NIE są celem IDOR, bo pracownicy kancelarii z założenia widzą dane wszystkich obsługiwanych
spółek, więc test „podmień spolka_id" nie ma tu zastosowania jako naruszenie).

### auth.js — wynik: OK (gate poprawny na każdej trasie)
- POST `/auth/login` **[na żywo]** — publiczny, rate-limited (5/15min), potwierdzone.
- POST `/auth/logout` **[na żywo]** — działa, ALE patrz Z-250 (nie unieważnia tokenu).
- GET `/auth/whoami` **[na żywo]** — zawsze 200, poprawne zachowanie zamierzone.
- POST `/auth/zmiana-hasla` **[na żywo]** — wymaga sesji, działa, ALE patrz Z-251 (nie unieważnia
  innych tokenów).
- GET/POST `/auth/uzytkownicy`, PATCH `/auth/uzytkownicy/:id`, POST
  `/auth/uzytkownicy/:id/reset-hasla` **[na żywo dla 401 bez sesji]** — wymagają admina,
  potwierdzone bramkowanie; reset-hasła ma tę samą wadę co Z-251 (nie sprawdzałem osobno — to ta
  sama przyczyna źródłowa, nie osobne znalezisko).

### oplaty.js, osoby.js, spolki.js, sprawy.js, szablony.js, wnioski.js, zawiadomienia.js,
zdarzenia.js, zgloszenia.js — wynik: OK (gate poprawny)
- Wszystkie 68 tras w tych 9 plikach **[statyczne + spot-check na żywo dla ~12 tras bez sesji →
  401]** — potwierdzone, że mount-level `wymagajPracownika` w `serwer.js` obejmuje KAŻDĄ trasę
  pliku niezależnie od kolejności rejestracji (weryfikacja Express: `app.use(prefix, middleware,
  router)` stosuje middleware przed całym routerem). IDOR między spółkami NIE dotyczy tych tras z
  założenia modelu biznesowego — jeden zespół kancelarii obsługuje wszystkie spółki-klientów, więc
  dostęp pracownika do danych DOWOLNEJ obsługiwanej spółki jest zamierzony, nie błędem izolacji.
  Wyjątek dot. jakości uploadu: patrz Z-253 (osoby.js AML-skany, spolki.js umowa-zalacznik).

### platnosci.js — wynik: OK (zamierzenie, nie błąd)
- POST `/platnosci/tpay/itn` **[statyczne]** — celowo przed bramkami sesji (webhook operatora),
  zabezpieczone sumą kontrolną + podpisem JWS sprawdzanymi ręcznie w handlerze. Nie testowałem na
  żywo (wymagałoby symulacji podpisu operatora tpay) — poza rozsądnym zakresem kosztu/zysku tej
  fazy, mechanizm jest jawnie odizolowany od reszty i opisany w kodzie.

### portal.js (37 tras) — wynik: OK, wszystkie bramki na miejscu
- POST `/portal/login`, `/logout`, GET `/whoami` **[na żywo]** — publiczne z założenia, logowanie
  rate-limited, potwierdzone. Logout ma wadę Z-250.
- POST `/portal/zgloszenia` **[na żywo]** — publiczny z założenia (etap przed kontem), rate-limited
  na e-mail, potwierdzone (użyty do utworzenia własnych kont testowych C i D).
- GET/POST `/portal/aktywacja/:token` **[na żywo]** — token w URL, użyty do aktywacji kont
  testowych C i D, działa zgodnie z opisem.
- POST `/portal/rodo` **[na żywo]**, GET/PUT `/wniosek`, GET `/wniosek/z-krs/:numer` **[na żywo]** —
  wymagają `wymagajKonta` + `wymagajWnioskodawcy`, potwierdzone (konto roli spółka/akcjonariusz
  dostaje 403).
- GET/POST/PUT/DELETE `/wniosek/akcjonariusze(/:id)` **[na żywo]** — IDOR między dwoma
  wnioskodawcami (C i D) przetestowany na PUT i DELETE cudzej pozycji z PESEL-em → 404, dane
  nietknięte. Zob. Z-256.
- POST `/wniosek/zloz` **[statyczne]** — logika kompletności sprawdzona pośrednio przy innych
  testach, gate identyczny jak reszta grupy `/wniosek/*`.
- GET `/wniosek/dokumenty`, `/wniosek/dokumenty/:id`, `/wniosek/umowa-projekt` **[statyczne, wzorzec
  jak wyżej]** — filtrowanie zawsze po `konto_id` własnej sesji, brak parametru pozwalającego
  wskazać cudzy wniosek.
- POST/DELETE `/wniosek/dowod`, GET `/wniosek/dowod` **[na żywo]** — upload realnego PDF-a, pobranie
  z powrotem (kontrola pozytywna), test path traversal w nazwie pliku (Z-259), test pliku 21 MB
  (Z-260).
- POST/GET/DELETE `/wniosek/dokumenty/:id/podpis`, POST/GET `/wniosek/umowa-podpisana` **[statyczne,
  ten sam wzorzec `wniosek_id = zad.psaWniosek.id` co potwierdzony wyżej]**.
- GET `/portal/moje` **[na żywo]** — trzy różne role (spółka/wnioskodawca/akcjonariusz), poprawny
  kształt odpowiedzi dla każdej.
- GET `/portal/rejestr/:spolkaId` **[na żywo]** — IDOR (obca spółka) → 404, potwierdzone dla konta
  spółki i konta akcjonariusza.
- GET/POST `/portal/zadania` **[na żywo]** — IDOR przez `spolka_id` w ciele → 404; utworzone dwie
  prawdziwe sprawy (spółka A, spółka B) do dalszych testów.
- POST `/portal/zadania/:id/dokumenty` **[na żywo]** — IDOR przez cudzą sprawę jako `:id` → 404
  (sprawdzone w obie strony, A→B i B→A).
- GET `/portal/cennik` **[na żywo]** — wymaga sesji (401 bez niej), potwierdzone jako kontrast do
  publicznego `/api/psa/meta` (Z-252).
- GET `/portal/oplaty`, POST `/oplaty/:id/zaplac` **[na żywo]** — lista własnych opłat, próba
  zapłaty cudzej opłaty nie testowana wprost (wymagałoby id opłaty innego konta — pośrednio
  pokryte przez identyczny mechanizm `wczytajOplateKonta` użyty i potwierdzony w
  `/informacja/:oplataId/wydaj`, zob. niżej).
- POST `/portal/informacja/zamow` **[na żywo]** — IDOR przez `spolka_id` w ciele → 404; użyte do
  utworzenia dokumentów testowych.
- POST `/portal/informacja/:oplataId/wydaj` **[na żywo]** — IDOR (cudza opłata) → 404, potwierdzone
  (`wczytajOplateKonta`).
- GET `/portal/informacja/:id` **[na żywo, najdokładniej przetestowana trasa tej fazy]** — 4
  kombinacje spółka/akcjonariusz × własny/cudzy dokument, wszystkie poprawne. Zob. Z-257.

### pozostale.js (8 tras) — wynik: 7/8 OK, 1 świadomie publiczny (Z-001/Z-252)
- GET/PUT `/ustawienia` **[na żywo]** — 401 bez sesji, potwierdzone.
- **GET `/meta` [na żywo]** — publiczny, potwierdzone i pogłębione (Z-252, dawniej Z-001).
- GET `/liczniki`, `/pulpit`, `/integralnosc` **[na żywo]** — 401 bez sesji, potwierdzone.
- POST `/sad/zapytania`, `/sad/zawiadomienie-o-rozwiazaniu` **[na żywo]** — 401 bez sesji,
  potwierdzone.

### wspolne.js — wynik: OK (publiczny z założenia)
- GET `/api/wspolne/kancelaria` **[na żywo]** — zawartość sprawdzona, wyłącznie dane wizytówkowe
  kancelarii (nazwa, adres, NIP notariusza) — zero danych klientów.

---

## Lista wszystkich znalezisk tej fazy

| ID | Waga | Skrót |
|---|---|---|
| Z-250 | **KRYTYCZNY** | Wylogowanie nie unieważnia tokenu sesji (portal + kancelaria) |
| Z-251 | **KRYTYCZNY** | Zmiana hasła nie unieważnia istniejących sesji |
| Z-252 | (pogłębienie Z-001) | `GET /api/psa/meta` publiczny — ostateczna ocena: DROBNY |
| Z-253 | POWAŻNY | Brak kontroli sygnatury pliku przy AML-skanach i umowie spółki |
| Z-254 | DROBNY | Błędy multer po angielsku zamiast po polsku (martwy kod tłumaczenia) |
| Z-255 | DROBNY | Malformed JSON → HTTP 500 zamiast 400 |
| Z-256 | POZYTYWNE | Izolacja portalu klienta — brak IDOR na żadnej trasie |
| Z-257 | POZYTYWNE | `GET /informacja/:id` poprawnie rozróżnia odbiorcę |
| Z-258 | POZYTYWNE | Rate limiting logowania działa (potwierdzone empirycznie) |
| Z-259 | POZYTYWNE | Brak path traversal w nazwach plików |
| Z-260 | POZYTYWNE | Limit rozmiaru pliku (20 MB) egzekwowany wszędzie |
| Z-261 | POZYTYWNE | Błędy/logi bez PII, stack trace, SQL |
| Z-262 | POZYTYWNE | Katalog dokumentów nie jest serwowany statycznie |
| Z-263 | POZYTYWNE | Mass assignment zablokowany białymi listami |
| Z-264 | POZYTYWNE | Sesja portalu nie daje dostępu do endpointów kancelaryjnych |

Numeracja Z-265…Z-289 pozostaje zarezerwowana, ale niewykorzystana — uznałem 15 znalezisk za pełne
pokrycie checklisty FAZA 5 bez sztucznego mnożenia wpisów.

---

## Czego NIE udało się przetestować / świadome ograniczenia zakresu

1. **Rzeczywisty upload 500 MB** — przetestowałem margines tuż nad limitem (21 MB / limit 20 MB) i
   potwierdziłem, że `multer.limits.fileSize` przerywa strumień; nie wysyłałem faktycznych 500 MB,
   bo mechanizm odcinający jest identyczny niezależnie od tego, o ile żądanie przekracza próg, a
   realny transfer 500 MB w tym środowisku byłby kosztowny czasowo bez dodatkowej wartości
   dowodowej. Decyzja podjęta samodzielnie, ważenie koszt/zysk odnotowane w Z-260.
2. **Webhook płatności (`POST /api/psa/platnosci/tpay/itn`)** — nie testowałem na żywo, wymagałoby
   to sfałszowania poprawnego podpisu JWS operatora tpay (albo dostępu do sekretu współdzielonego z
   .env, którego nie modyfikowałem). Zweryfikowałem wyłącznie kodem, że trasa jest architektonicznie
   odizolowana od bramek sesji w sposób udokumentowany i zamierzony.
3. **Zachowanie limitera przy wielu instancjach serwera (poziome skalowanie)** — licznik prób
   logowania jest w pamięci procesu; środowisko audytowe to pojedyncza instancja, więc nie dało się
   tego przetestować empirycznie. Odnotowane jako zastrzeżenie przy Z-258, nie jako osobne
   znalezisko (poza obecnym zakresem wdrożenia).
4. **Reset hasła przez admina (`POST /auth/uzytkownicy/:id/reset-hasla`)** — nie testowałem tej
   konkretnej trasy empirycznie osobno; z przeglądu kodu wynika, że dzieli dokładnie ten sam rdzeń
   przyczyny co Z-251 (brak mechanizmu unieważniania tokenu przy zmianie hasła, niezależnie od tego,
   KTO tę zmianę inicjuje) — nie traktuję tego jako osobne, nieprzetestowane ryzyko, tylko jako
   naturalną konsekwencję już potwierdzonego Z-251.
5. **Efekt uboczny mojego testowania rate-limitera na koncie administratora**: pierwsza próba testu
   (przed restartem serwera w trakcie tej sesji) tymczasowo zablokowała logowanie do
   `audyt@kancelaria.test` na 15 minut (limiter kluczuje po IP+e-mail, a wszyscy agenci audytu
   współdzielą to samo IP `localhost`). Restart serwera wyzerował liczniki w pamięci, więc do końca
   mojej sesji problem nie występował; odnotowuję to na wypadek, gdyby inny równoległy agent
   napotkał chwilowo `429` na koncie admina w tamtym oknie czasowym — to efekt uboczny tego testu,
   nie osobna usterka aplikacji.
6. Nie modyfikowałem żadnego pliku pod `server/`, `publiczne/`, `wzory/` ani głównego
   `package.json` — zgodnie z zakresem audytu. Jedyne trwałe zmiany w danych testowych: konta
   portalowe `faza5.*@example-test.pl` (role spółka/akcjonariusz, wpisane bezpośrednio do bazy
   testowej z uzasadnieniem w Z-006/FAZA 1 — brak API do tworzenia kont akcjonariuszy), wnioski
   testowe C/D (id 6, 7), kilka opłat/spraw/dokumentów testowych powiązanych ze spółkami 1 i 2 w
   `dane/audyt-test.db`. Hasło administratora zostało tymczasowo zmienione i NATYCHMIAST
   przywrócone do oryginalnego (`St1wcbi9aU-QXg`) w ramach testu Z-251 — potwierdzone działającym
   logowaniem po przywróceniu.

## Pytania do Łukasza

Brak nowych pozycji w `PYTANIA-DO-LUKASZA.md` z tej fazy. Wszystkie znalezione problemy (Z-250,
Z-251, Z-253, Z-254, Z-255) mają jednoznaczną, czysto techniczną rekomendację naprawy nie
wymagającą decyzji biznesowej/prawnej — różnią się wyłącznie priorytetem wykonania, o czym mówi
waga w `ZNALEZISKA.md`, nie potrzebują osobnego pytania.
