# Rejestr akcjonariuszy P.S.A.

Moduł do prowadzenia rejestrów akcjonariuszy prostych spółek akcyjnych
(art. 300³⁰ i nast. KSH) przez notariusza — Kancelaria Notarialna Łukasza Kozona.

**Stan: sprint 5 ukończony** (rdzeń rejestru + workflow spraw + logowanie
i portal klienta + rozliczenia + migracja spółek z innych rejestrów +
zgodność z ustawą: ułamkowe części akcji, pokrycie, blokada wpisu przed KRS,
wspólny przedstawiciel, wpis konstytutywny/deklaratoryjny).
Portal jest gotowy funkcjonalnie, ale domyślnie **wyłączony** flagą
`PORTAL_WLACZONY` — patrz „Do decyzji”. Jedyne źródło prawne modułu:
`PRZEPISY-PSA.md` (korzeń repozytorium).

---

## Uruchomienie

```bash
npm install
cp .env.przyklad .env      # uzupełnij dane kancelarii, ADMIN_EMAIL, SESJA_SEKRET, (opcjonalnie) SMTP
npm start                  # http://localhost:3005
npm test                   # 154 testy
```

Migracje wykonują się automatycznie przy starcie i są idempotentne.

Przy pierwszym starcie z pustą tabelą `psa_uzytkownicy` serwer zakłada konto
administratora z adresem `ADMIN_EMAIL` i **losowym hasłem tymczasowym,
wypisanym jeden raz w logu startu** — trzeba je zapisać wtedy, bo nie da się
go odzyskać (można za to wygenerować nowe przez „Resetuj hasło” w ekranie
Użytkownicy, jako inny zalogowany admin, albo bezpośrednio w bazie).

Kancelaria: `http://localhost:3005/` — wymaga zalogowania (e-mail + hasło).
Portal klienta: `http://localhost:3005/portal` — osobna aplikacja, osobna
sesja, aktywna tylko gdy `PORTAL_WLACZONY=true`.

Front ładuje React 18 i Babel z CDN (`unpkg.com`, wersje przypięte) — maszyna
uruchamiająca przeglądarkę musi mieć do niego dostęp. Bez bundlera, bez
TypeScriptu, bez Tailwinda, bez bibliotek PDF.

---

## Co powstało w sprincie 1

| Punkt z planu | Stan |
|---|---|
| Szkielet modułu, migracje idempotentne, pragmy WAL | ✅ |
| Tabele `psa_spolki`, `psa_osoby`, `psa_emisje`, `psa_zdarzenia`, `psa_stan_akcji`, `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia` | ✅ |
| `logika/przepisy.js`, `typy-zdarzen.js`, `walidacje.js`, `stan.js`, `numery.js` | ✅ (+ `kreator.js`, `lancuch.js`, `maskowanie.js`) |
| Kokpit spółki + kreator dla `emisja`, `objecie`, `przeniesienie`, `umorzenie` | ✅ |
| Dodawanie spółki (3 kroki, z pobraniem z KRS), kartoteka osób | ✅ |
| Wydruk raportu spółki + „stan na dzień” | ✅ (+ informacja z rejestru z maskowaniem) |
| Testy: bilans, numery, odbudowa stanu, łańcuch skrótów, brzegowe przeniesienia | ✅ 45 testów |

Poza planem sprintu, bo wymagały tego reguły krytyczne:

- **maskowanie danych wrażliwych** (reguła 9) — wdrożone od pierwszego dnia,
  z wydrukiem „informacja z rejestru” w wariancie dla innego akcjonariusza;
- **odtwarzanie obciążeń, uprawnień i ograniczeń** ze zdarzeń — bez tego
  walidacje blokujące z sekcji 6 nie miałyby czego sprawdzać. Kreatorów dla
  tych typów nie było w sprincie 1 (doszły w sprincie 2), ale odczyt i
  blokady działały od początku.

## Co powstało w sprincie 2

| Punkt z planu | Stan |
|---|---|
| `psa_sprawy`, `psa_dokumenty`, `psa_wydane_dokumenty`; upload; kolejka na pulpicie | ✅ |
| `logika/terminy.js` (7 dni z zawieszeniem) + testy | ✅ |
| Checklisty per typ, ścieżka „uzasadnione wątpliwości”, AML jako bramka | ✅ |
| Powiadomienie z art. 300³⁴ § 3, zawiadomienia o wpisie/odmowie, wezwanie | ✅ |
| Pozostałe typy zdarzeń (obciążenia, zajęcia, uprawnienia, ograniczenia, sprostowanie) | ✅ |

Kreator jest teraz **sprawa-bound**: „Nowe zdarzenie” zakłada sprawę (start
licznika 7 dni), a kroki 3–4 działają na już istniejącej sprawie — ta sama
ścieżka obsługuje świeżo założoną sprawę i wznowienie z kolejki (z zachowanym
roboczym stanem formularza). Endpoint `POST /api/psa/spolki/:id/zdarzenia`
z sprintu 1 zostaje jako szybka ścieżka wewnętrzna (np. zasiewanie danych),
ale UI już go nie używa.

## Co powstało w sprincie 3

| Punkt z planu | Stan |
|---|---|
| Decyzja o wariancie wdrożenia (sekcja 2) | ✅ **A — wszystko na VPS** |
| Konta, logowanie, rate limiting | ✅ |
| Podgląd rejestru z maskowaniem, złożenie żądania, statusy spraw (portal) | ✅ |

Wariant A oznacza, że rejestr (dane osobowe akcjonariuszy) opuszcza serwer
kancelarii — konsekwencje (TLS, kopie zapasowe offsite szyfrowane, umowa
powierzenia z hostingiem, RODO) są infrastrukturalne/prawne, nie kodowe;
odnotowane tu jako do zrobienia przed realnym wdrożeniem, nie zaimplementowane
w tym sprincie.

**Uwierzytelnianie zastępuje `X-User-Name` w całej aplikacji**, nie tylko
w portalu — to była konsekwencja wariantu A (serwer wystawiony publicznie,
identyfikacja samym imieniem przestaje mieć sens). Sesja jest **bezstanowa**:
token HMAC-SHA256 (`logika/sesja.js`, `node:crypto`, zero nowych zależności)
w httpOnly cookie, `SameSite=Lax`, `Secure` gdy połączenie idzie przez HTTPS
(bezpośrednio albo za reverse proxy, `trust proxy`). Dwa niezależne ciasteczka,
dwie niezależne sesje w tej samej przeglądarce: `psa_sesja` (pracownik) i
`psa_sesja_portal` (konto klienta) — nigdy się nie mieszają.

Portal jest **osobną aplikacją jednostronicową** (`publiczne/portal.html` +
`publiczne/js/portal.js`), nie kolejną trasą w SPA kancelaryjnej — inna
tożsamość, inny zestaw ekranów, inny model zaufania. Dzieli z kancelarią
tylko `rdzen.js` i `ui.js` (klient API, formatowanie, komponenty wspólne),
świadomie nie dzieli routingu ani stanu.

## Co powstało w sprincie 4

| Punkt z planu | Stan |
|---|---|
| `psa_oplaty`, naliczenie roczne, eksport zestawienia | ✅ |
| Migracja obecnych rejestrów z RN (kreator „stan otwarcia”, z datami historycznymi) | ✅ |
| Stuby `501` → implementacja: zawiadomienie sądu o rozwiązaniu umowy, obsługa zapytań sądu | ✅ (bramkowane datą nowelizacji) |
| Migracja na wspólny `design.css` | poza zakresem tego repozytorium — patrz niżej |

**Naliczanie opłat jest automatyczne w punktach, gdzie opłata faktycznie
powstaje** — nie osobnym krokiem, który dałoby się pominąć:
- **wpis** — naliczany wewnątrz `rejestr.dokonajWpisuSprawy`, w tej samej
  transakcji SQLite co zapis zdarzenia, wyłącznie dla typów `odplatne: true`
  z katalogu (`logika/typy-zdarzen.js`) — zajęcie i wykreślenie zajęcia są
  z mocy ustawy wolne od opłat i nigdy nie generują wiersza w `psa_oplaty`;
- **informacja z rejestru** — naliczana zarówno przy pobraniu przez portal
  (`POST /api/psa/portal/informacja`), jak i przy ręcznym wpisie przez
  pracownika (ekran Opłaty — patrz odstępstwo 21 niżej);
- **prowadzenie rejestru** — WYŁĄCZNIE wsadowo, `POST /api/psa/oplaty/naliczenie-roczne`
  (admin), idempotentne per spółka+rok — bezpieczne do uruchomienia
  wielokrotnie (np. co miesiąc, żeby złapać nowo dodane spółki).

**Ścieżka bezpośrednia `dokonajWpisu` (migracja „stan otwarcia”) świadomie
NIE nalicza opłaty za wpis** — wprowadzenie już zaszłego stanu historycznego
nie jest bieżącą czynnością odpłatną. To jedyny powód, dla którego ta
sprzątnięta w sprincie 2 ścieżka (opisana tam jako „wewnętrzna, UI już jej
nie używa”) wraca teraz do UI — z nowym, jawnym zastosowaniem.

**Stuby sądowe implementują realną logikę, ale zostają bramkowane datą**
(`przepisy.nowelizacjaObowiazuje`) — przed 18.02.2027 nadal zwracają `501`
z informacją, kiedy ruszą; po tej dacie generują dokument (wykaz
akcjonariuszy / zawiadomienie) i zapisują go w `psa_wydane_dokumenty`.
Zgodnie z decyzją nr 2 z sekcji 15 specyfikacji, obie trasy WYŁĄCZNIE
generują dokument z już potwierdzonych danych (stan rejestru, data
zakończenia umowy) — nie oceniają treści przepisu, więc zakaz „walidacji
blokującej opartej na brzmieniu DO_WERYFIKACJI” ich nie dotyczy.

---

## Co powstało w sprincie 5 — zgodność z ustawą

> **Zamiana kolejności wobec pierwotnego planu.** Sprint interfejsowy
> (`SESJA-PSA-5-INTERFEJS.md`) renderuje dokładnie te struktury, które zmienia
> ten sprint — pasek serii, tabelę akcjonariatu, kreator przeniesienia.
> Zrobienie interfejsu na modelu bez ułamków oznaczałoby przerabianie go
> zaraz potem, więc ten sprint (zgodność z ustawą, sekcja 14 `CLAUDE-PSA.md`)
> wykonano PRZED nim. `CLAUDE-PSA.md` i `PRZEPISY-PSA.md` (nowe, dedykowane
> źródło prawne modułu — zastępuje odwołania do opracowań branżowych) leżą
> w korzeniu repozytorium.

| Punkt z planu | Stan |
|---|---|
| Ułamkowe części akcji: `czesc_licznik`/`czesc_mianownik`, arytmetyka wymierna, `CHECK`-i, niezmiennik bilansu per numer akcji, migracja 1/1 | ✅ |
| Pokrycie akcji + blokada zbycia akcji nie w pełni pokrytej (art. 300⁴⁰) | ✅ |
| `data_wpisu_krs` na emisji + twarda blokada wpisu akcji przed wpisem do KRS | ✅ |
| `rodzaj_akcji`, obowiązki wobec spółki, dodatkowe informacje z umowy spółki | ✅ |
| Wspólny przedstawiciel współuprawnionych (art. 300³⁸ § 3) | ✅ |
| Rozróżnienie wpisu konstytutywnego i deklaratoryjnego (art. 300³⁷ § 2) | ✅ (obliczane i zapisywane; osobna treść zawiadomienia — patrz odstępstwo 27) |
| Lista akcjonariuszy do KRS generowana z zawiadomieniem o wpisie (art. 300³⁴ § 8) | ✅ |
| Korekty errat (4 pozycje — patrz niżej) | ✅ |
| `przepisy.js` przepisany, każda reguła cytuje `PRZEPISY-PSA.md` | ✅ |
| Testy: arytmetyka ułamków, bilans per numer, blokady, migracja 1/1 | ✅ |

**Ułamkowe części akcji — architektura.** Akcja jest niepodzielna
(art. 300² § 3), ale można być uprawnionym do ułamka jednej, oznaczonej
akcji i nim rozporządzać (art. 300⁴³). Rozwiązanie: nowy moduł czysty
`logika/ulamki.js` (NWD, skracanie, porównania przez mnożenie na krzyż,
sumowanie przez wspólny mianownik — **wyłącznie `INTEGER`**, zero floatów)
oraz **jeden, nowy, dedykowany typ zdarzenia** `przeniesienie_ulamka` — nie
dotknięto istniejących handlerów `emisja`/`objecie`/`przeniesienie`/`umorzenie`
w `stan.js`. Decyzja o zawężeniu zakresu (nie wynikająca wprost z
`CLAUDE-PSA.md`, podjęta podczas implementacji): skoro cały istniejący stan
na 08.2026 jest 1/1 (żadna spółka nie ma współwłasności), prościej i
bezpieczniej dla dobrze przetestowanej logiki calo-akcyjnej jest **wykluczyć**
wiersze ułamkowe z `stan.pula()` (funkcji, na której opierają się WSZYSTKIE
zwykłe operacje), niż uczynić `otworz`/`zdejmij`/`przenies` świadome
ułamków wszędzie. Efekt: zwykłe `przeniesienie`/`umorzenie`/`obciazenie` nie
widzą akcji podzielonej ułamkowo jako w pełni należącej do jednego
współuprawnionego — rozporządzać ułamkiem można wyłącznie przez
`przeniesienie_ulamka`.

**Niezmiennik bilansu, uogólniony.** Stara reguła: „każdy numer akcji należy
do dokładnie jednego otwartego przedziału". Nowa: „dla każdego numeru akcji
suma ułamków wszystkich uprawnionych wynosi dokładnie 1 (albo 0, gdy
nieobjęta)" — szczególny przypadek starej reguły dla ułamka 1/1.
Nakładanie się przedziałów różnych akcjonariuszy jest teraz dozwolone
WYŁĄCZNIE gdy: (a) nakładający się zakres to dokładnie jeden numer (wiersz
ułamkowy zawsze obejmuje jeden numer — wymuszone `CHECK`-iem, nie
konwencją) i (b) suma ułamków wszystkich wierszy na tym numerze wynosi
dokładnie 1. Każde inne nakładanie się pozostaje twardym błędem, tak jak
przed sprintem 5.

**`przeniesienie_ulamka` nie przechodzi przez `przenies()`.** Ten prymityw
liczy w całych zakresach numerów. Handler zamiast tego: zamyka CAŁĄ
dotychczasową pozycję zbywcy na wskazanym numerze (niezależnie od tego, czy
była to część szerszego zakresu 1/1, czy już istniejący wiersz ułamkowy),
odejmuje zbywany ułamek arytmetyką wymierną i otwiera z powrotem to, co
zbywcy zostaje (jeśli cokolwiek), a nabywcy — sumę tego, co już miał (jeśli
cokolwiek) i ułamka nabywanego. Pokrycie (`pokryta`) jest atrybutem SAMEJ
AKCJI (wkład już wniesiony do spółki), nie osoby — przechodzi niezmienione
na obie powstałe pozycje.

**Migracja v5 nie przepisuje `psa_stan_akcji`.** W przeciwieństwie do
migracji v4 (gdzie SQLite wymagał przepisania tabeli, żeby zmienić
`CHECK`), tu wystarczyło `ALTER TABLE ADD COLUMN` — SQLite pozwala dopisać
kolumnę z `CHECK`-iem odwołującym się do INNYCH, już istniejących kolumn
tego samego wiersza (np. `czesc_licznik BETWEEN 1 AND czesc_mianownik AND
(czesc_licznik = czesc_mianownik OR nr_od = nr_do)`), potwierdzone testem
przed napisaniem migracji. Każdy istniejący wiersz dostaje przez `DEFAULT`
wartość 1/1 — to jest cała „migracja” na poziomie danych.

**`data_wpisu_krs`: backfill, nie pusty start.** Emisje zapisane PRZED tym
sprintem już istnieją w rejestrze jako fakt dokonany (ich akcje zostały
objęte), więc spółka/emisja musiała już być wpisana do KRS — migracja
ustawia im `data_wpisu_krs = data_emisji`. Nowe emisje (po tym sprincie)
startują z `NULL`, zgodnie z regułą domenową 12 — `objecie` jest wtedy
twardo zablokowane do czasu uzupełnienia daty (sprostowaniem zdarzenia
emisji — istniejący mechanizm z poprzednich sprintów, nie nowy endpoint).

---

## Architektura

```
serwer.js                  punkt wejścia, port 3005
server/
  konfiguracja.js          .env (własny parser — dotenv nie jest na liście zależności)
  baza.js                  better-sqlite3, WAL, foreign_keys
  migracje.js              idempotentne, wyłącznie obiekty psa_* (v1 rdzeń, v2 sprawy, v3 konta, v4 opłaty, v5 zgodność z ustawą)
  rejestr.js               transakcje: zapis zdarzenia, materializacja, wpis sprawy, sprostowanie
  oplaty.js                naliczanie opłat (wpis/informacja/prowadzenie), naliczenie roczne, eksport CSV
  widoki.js                stan domenowy → struktura dla UI, Z MASKOWANIEM
  zawiadomienia.js         generowanie + próba wysyłki dokumentów wychodzących (poza transakcją SQLite)
  poczta.js                nodemailer; no-op z czytelnym powodem, gdy brak SMTP
  logika/                  czysta domena, zero dostępu do bazy
    przepisy.js            JEDYNE źródło wiedzy prawnej: terminy, stawki, maskowanie
    typy-zdarzen.js        katalog typów: checklisty, odpłatność, powiadomienia
    numery.js              algebra zakresów numerów akcji, przydział FIFO
    ulamki.js              arytmetyka wymierna ułamkowych części akcji — wyłącznie INTEGER (sprint 5)
    stan.js                odbudowa stanu ze zdarzeń, kontrola bilansu, sprostowania
    terminy.js             termin 7 dni z zawieszeniem (art. 300³⁴ § 1 KSH)
    kreator.js              wejście z kreatora → treść zdarzenia (przydział numerów, sprostowania)
    walidacje.js           walidacje BLOKUJĄCE
    lancuch.js             sha256, kanoniczny JSON, weryfikacja łańcucha
    maskowanie.js          art. 300³⁵ § 1¹
    dokumenty-tresc.js     deterministyczny HTML zawiadomień/wezwań/informacji (bez bibliotek PDF)
    hasla.js               bcrypt (hash, weryfikacja, siła hasła) — jedyna nowa zależność bezpieczeństwa
    sesja.js                token sesji: HMAC-SHA256 bezstanowy, `node:crypto`, zero zależności
    limiter.js              rate limiting logowania — własna implementacja, licznik w pamięci
  pomocnicze/
    autoryzacja.js          middleware sesji (pracownik / konto), guardy wymagajPracownika/wymagajAdmina/wymagajKonta
    ciasteczka.js            parser/serializator ciasteczek — cookie-parser nie jest na liście zależności
  trasy/                   HTTP (spolki, osoby, sprawy, zdarzenia, oplaty, pozostale, wspolne, auth, portal)
publiczne/                 React 18 + Babel z CDN, bez bundlera
  wspolne/design.css       kanon wizualny kancelarii (wersja 1.1)
  style/psa.css            wyłącznie układ modułu, kolory tylko przez var(--…)
  index.html               SPA kancelaryjna
  portal.html              SPA portalu klienta — OSOBNA aplikacja, osobna sesja
  js/sprawy.js             kolejka + kokpit sprawy + kroki 3–4 kreatora (osadzone)
  js/kreator.js            kroki 1–2 (zakłada sprawę) + formularze kroku 3 per typ
  js/auth.js                sesja pracownika + ekran logowania (kancelaria)
  js/uzytkownicy.js         zarządzanie kontami pracowników (tylko admin)
  js/oplaty.js               ekran Opłaty: filtry, ręczny wpis, status, naliczenie roczne, eksport CSV
  js/migracja.js             kreator „stan otwarcia” — ponownie używa KrokEmisja/KrokObjecie z kreator.js
  js/portal.js              cała aplikacja portalu klienta (logowanie, moje, rejestr, zgłoszenie, status, informacja)
testy/
```

Podział jest ostry: `logika/*` nie wie o istnieniu bazy ani HTTP, więc testuje
się ją w izolacji. `rejestr.js` odpowiada za transakcje i materializację,
`trasy/*` wyłącznie za HTTP.

---

## Jak działa rdzeń

### Stan akcjonariatu jako kafelkowanie serii

Każdy numer akcji należy w danej chwili do **dokładnie jednego** otwartego
przedziału, o jednej z trzech kategorii: `nieobjeta`, `akcjonariusz`, `umorzona`.
Zdarzenia wyłącznie przesuwają zakresy między kategoriami.

Dzięki temu reguła domenowa nr 3 („bilans musi się zgadzać zawsze”) sprawdza się
jednym warunkiem: otwarte przedziały serii pokrywają zakres emisji **szczelnie
i bez nakładania**. Naruszenie = odmowa zapisu, nie ostrzeżenie.

To wymagało dodania kolumny `kategoria` w `psa_stan_akcji` — patrz „Odstępstwa”.

### Materializacja zawsze przez pełne odtworzenie

Nie ma osobnej ścieżki „przyrostowej”. Każdy zapis kończy się pełnym
odtworzeniem stanu spółki ze zdarzeń i przepisaniem materializacji. Nie da się
więc doprowadzić do rozjazdu między „stanem bieżącym” a „stanem odbudowanym” —
to jedna i ta sama ścieżka kodu. `POST /:id/przelicz` uruchamia ją ręcznie.

Test `ODBUDOWA STANU ZE ZDARZEN = STAN BIEZACY` porównuje tabelę wiersz po
wierszu przed przeliczeniem i po nim.

### Append-only egzekwowane przez bazę

`psa_zdarzenia` ma wyzwalacze `BEFORE UPDATE` i `BEFORE DELETE`, które
przerywają operację. Działają także wtedy, gdy ktoś sięgnie do pliku bazy
z pominięciem aplikacji. Skrót liczymy **przed** wstawieniem (`id` = `MAX(id)+1`
w transakcji IMMEDIATE), bo rekordu nie wolno potem zaktualizować.

### Przydział numerów

Użytkownik podaje **wyłącznie ilość**. Aplikacja przydziela FIFO po najniższym
wolnym numerze, przy czym „wolny” znaczy też: nieobjęty blokującym obciążeniem —
inaczej kreator proponowałby akcje, których walidacja i tak nie przepuści.
Ręczne wskazanie zakresu jest schowane pod przełącznikiem, dla przypadków takich
jak przeniesienie konkretnych akcji obciążonych zastawem.

### Termin 7 dni: zamrożenie, nie zaliczanie

Ustawa: „nie później niż 7 dni od otrzymania żądania; przy przeszkodzie —
7 dni od jej usunięcia”. Interpretacja przyjęta w `terminy.js`: w stanie
`wstrzymana` zegar jest **zamrożony** (nie płynie), a po wznowieniu biegnie
**pełne nowe 7 dni** od dnia usunięcia przeszkody — nie kontynuacja z zaliczeniem
części terminu sprzed wstrzymania. To czytanie dosłowne brzmienia przepisu, nie
doktryny „zawieszenia biegu terminu” z zaliczeniem. `dni_wstrzymania` w bazie
jest wyłącznie skumulowaną statystyką do audytu — nie wpływa na `termin_do`.

### Sprostowanie: podmiana w miejscu chronologicznym, nie na końcu

Zdarzenie `sprostowanie` z treścią `zamiast` **nie** jest wstawiane osobno pod
swoim własnym ID — podmienia treść zdarzenia prostowanego **dokładnie w jego
pozycji** w chronologii. Dwa powody, oba wykryte testem integracyjnym podczas
budowy:

1. **Stabilność klucza.** Handlery czytają `zdarzenie.id` jako klucz struktury,
   którą tworzą (`HANDLERY.emisja: klucz = Number(zdarzenie.id)`). Późniejsze
   zdarzenia (np. `objecie`) odwołują się do tego klucza przez
   `emisja_zdarzenie_id` wskazujący na ID zdarzenia **pierwotnego**. Gdyby
   korekta wstawiała się pod ID sprostowania, każde takie odwołanie by się
   zerwało.
2. **Kolejność przetwarzania.** Sprostowanie ma zwykle późniejszy ID niż
   zdarzenia między oryginałem a korektą (przy tej samej `data_zdarzenia`
   decyduje ID). Wstawione na końcu, korekta przychodzi za późno — zdarzenia
   pomiędzy nią a oryginałem przetworzyłyby się na starej, błędnej treści.

Treść zastępczą (`zamiast`) liczymy względem stanu **tuż przed** zdarzeniem
pierwotnym (chronologicznie), nie „bez niego w ogóle” — wykluczenie całego
zdarzenia z listy zrywałoby referencje zdarzeń zależnych w trakcie samego
liczenia treści (np. `objecie` po `emisji`). Stan sprzed jest naturalną bazą
do pytania „jak to zdarzenie powinno było wyglądać”.

Sprostowanie **bez** `zamiast` jest pełnym wycofaniem zdarzenia (nie ma czym
go zastąpić) — działa tylko, gdy nic już od niego nie zależy (inaczej: błąd
integralności referencyjnej, celowo).

### Sesja bezstanowa: token niesie tylko tożsamość, stan czyta się z bazy

`logika/sesja.js` podpisuje token HMAC-SHA256 (`base64url(payload).base64url(podpis)`,
payload = `{ typ, id, exp }`) — nie JWT (żadnej nowej zależności), nie
przechowuje żadnej sesji po stronie serwera. Przy **każdym** żądaniu
middleware (`pomocnicze/autoryzacja.js`) odczytuje token, sprawdza podpis
i termin ważności, po czym **na nowo** wczytuje rekord `psa_uzytkownicy`/`psa_konta`
z bazy — dezaktywacja konta albo zmiana roli działa natychmiast, bez czekania
na wygaśnięcie tokenu. Cena tej prostoty: wylogowanie kasuje ciasteczko po
stronie przeglądarki (`Max-Age=0`), ale sam token pozostaje kryptograficznie
ważny do naturalnego wygaśnięcia (12 h dla pracownika, 8 h dla konta portalu) —
nie ma listy unieważnionych tokenów. Świadomy kompromis „minimum komplikacji”
(por. sekcja 11 specyfikacji), akceptowalny przy tych czasach życia tokenu;
gdyby był potrzebny natychmiastowy revoke, wymagałoby to magazynu sesji
(Redis albo tabeli) — nie zaimplementowano, bo nikt o to nie prosił.

### Rate limiting logowania: okno przesuwne w pamięci procesu

`logika/limiter.js` liczy nieudane próby logowania per `IP + identyfikator`
(nie sam IP — jeden adres NAT-owany całej kancelarii nie usypia się nawzajem;
nie sam e-mail — atakujący nie blokuje cudzego konta z dowolnego adresu).
Pięć nieudanych prób w 15 minutach → 429 z odliczeniem. Licznik jest w
pamięci procesu (sekcja 11: „własna implementacja, licznik w pamięci”) —
restart serwera go czyści, co przy tej skali ruchu jest akceptowalne.

### Portal: co klient zbiera sam, a co robi pracownik

Sekcja 9 mówi: „ten sam kreator, ale bez kroku weryfikacji”. Krok „co się
zmienia” (krok 3) w kancelarii korzysta z `WyborOsoby` — wyszukiwarki **całej
wspólnej kartoteki** `psa_osoby`, pokazującej m.in. status AML. Udostępnienie
tego wyszukiwania portalowi ujawniałoby klientowi dane innych klientów
kancelarii (nazwiska, status AML) — sprzeczne z regułą domenową nr 9 w duchu,
jeśli nie w literze. Portal zbiera więc wyłącznie **krok 1 (typ) i krok 2
(opis + dokumenty)** i zakłada sprawę w stanie `nowa`; krok „co się zmienia”
i weryfikację wykonuje pracownik w kokpicie sprawy — dokładnie tak samo jak
dla zgłoszeń przyjętych mailem czy papierowo. Udokumentowane jako odstępstwo
18 niżej.

---

## Odstępstwa od specyfikacji i decyzje projektowe

Wszystkie świadome, wszystkie do zakwestionowania.

1. **`psa_stan_akcji.kategoria`** — kolumna spoza katalogu z sekcji 5. Bez niej
   nie da się odróżnić akcji nieobjętych od umorzonych (obie mają `osoba_id`
   NULL), a bilans przestaje być sprawdzalny.

2. **`psa_spolki.forma_prawna`** — kolumna spoza katalogu, potrzebna do reguły
   nr 11 (walidacja przy dodawaniu spółki + kontrola danych z KRS).

3. **Odczytanie reguły bilansu.** Literalnie brzmi ona „suma akcji przypisanych
   akcjonariuszom = wyemitowane − umorzone”. Ale `emisja` i `objecie` to dwa
   osobne zdarzenia, więc między nimi istnieje stan „wyemitowane, nieobjęte”.
   Egzekwujemy więc: *przypisane + nieobjęte + umorzone = wyemitowane*, przy
   szczelnym pokryciu zakresu. Literalna wersja obowiązuje po objęciu całej
   serii, a niezerowe „nieobjęte” generuje **ostrzeżenie** z art. 300³¹ § 3 KSH
   widoczne w kokpicie i po zapisie emisji.

4. **`emisja` i `objecie` pozostają osobnymi czynnościami** — kreator nie łączy
   ich w jeden krok. Kokpit eksponuje licznik akcji nieobjętych, więc krok
   drugi jest trudny do przeoczenia. Wariant łączony wymagałby identyfikatorów
   zastępczych w łańcuchu zdarzeń; uznałem to za gorszą wymianę.

5. **Ścieżka zapisu w sprincie 1: `POST /api/psa/spolki/:id/zdarzenia`.**
   Specyfikacja umieszcza wpis pod `POST /api/psa/sprawy/:id/wpisz`, ale sprawy
   wchodzą w sprincie 2. Sprint 2 opakuje tę ścieżkę, nie zastąpi jej.
   Jest też `POST /:id/zdarzenia/podglad` — zasila krok 4 kreatora (tabela
   przed/po), niczego nie zapisuje.

6. **`dane_json` nie zawiera numeru PESEL ani adresów.** Snapshot niesie
   `osoba_id` i oznaczenie strony, żeby zdarzenie dało się odczytać bez łączenia
   z innymi tabelami. Utrwalanie numeru PESEL w niezmienialnym łańcuchu skrótów
   niepotrzebnie zabetonowałoby dane osobowe; tożsamość żyje w `psa_osoby`.

7. **Serializacja skrótu z separatorem U+001F.** Specyfikacja pisze
   `sha256(id + spolka_id + …)`. Samo sklejenie pozwala przesunąć treść między
   sąsiednimi polami bez zmiany skrótu (`autor` sąsiaduje z `dane_json`).
   Separator, którego `JSON.stringify` nie wypuszcza dosłownie, domyka granice.
   Jest na to test.

8. **Nagłówek `X-User-Name` kodowany procentowo.** Nagłówki HTTP przenoszą
   wyłącznie ISO-8859-1 — `fetch` odrzuca „Łukasz Kozon”. Nazwa nagłówka zgodna
   z konwencją mastera, wartość przez `encodeURIComponent`.

9. **`design.css` podbity do 1.1** — dopisane tokeny układu (`--sb`, `--r`,
   `--r-sm`, `--r-xs`, `--przejscie`, `--tresc-maks`), zgodnie z sekcją 2.
   Wersja 1.0 nietknięta, więc Kalkulator i Kasa mogą podmienić plik bez zmian
   u siebie.

10. **AML jako bramka częściowa.** Status `niemozliwe` **blokuje** wpis
    (przeszkoda → odmowa). Status `brak` daje ostrzeżenie, a checklista i tak nie
    pozwoli dokonać wpisu bez odhaczenia pozycji AML. Pełna bramka z obiegiem
    sprawy wchodzi w sprincie 2.

11. **Zainstalowane tylko `express` i `better-sqlite3`.** `multer`, `bcrypt`
    i `nodemailer` dojdą razem ze sprintami, w których są potrzebne (2 i 3) —
    nie trzymamy zależności, których nikt nie wywołuje.

12. ~~Krok 2 kreatora bez wgrywania plików~~ — zrealizowane w sprincie 2
    (upload przez multer, `psa_dokumenty`).

13. **Dokumenty wychodzące jako HTML, nie PDF.** Zawiadomienia i wezwania są
    deterministycznym HTML-em (`logika/dokumenty-tresc.js`) — ten sam tekst
    idzie jako treść e-maila (nodemailer) i jako zapis audytowy w
    `psa_wydane_dokumenty.tresc_html`. Kolumna `sciezka_pdf` zostaje w
    schemacie zgodnie ze specyfikacją, ale w tym sprincie pozostaje `NULL` —
    zgodnie z zakazem bibliotek PDF (sekcja 13), wydruk na kanale papierowym
    pracownik robi z podglądu HTML przez `window.print()`.

14. **Wysyłka e-mail jako no-op z czytelnym powodem, gdy brak SMTP.**
    `.env.przyklad` nie ma domyślnie danych SMTP — `poczta.js` wtedy nie rzuca
    wyjątku, tylko zwraca `{ wyslano: false, powod }`. Ślad w
    `psa_wydane_dokumenty` i tak powstaje (`wyslano` zostaje `NULL` do czasu
    faktycznej wysyłki) — dokument jest gotowy do ręcznego wysłania kanałem
    papierowym.

15. **Ścieżka `z_urzedu` pomija fazę „nowa”.** Sprawy `zajecie`/`wykreslenie_zajecia`
    zakładają się wprost w stanie `weryfikacja` — organ egzekucyjny nie
    „żąda” wpisu (nie ma fazy oczekiwania na żądającego), tylko przekazuje
    kompletne zawiadomienie (art. 300³⁴ § 2 KSH: bez żądania, bez uprzedniego
    powiadomienia, wolne od opłat).

16. **`prawo_glosu_zastawnika` jest atrybutem bieżącym, bez własnej osi
    czasu.** Zmienia `prawo_glosu` istniejącego obciążenia w miejscu — „stan
    na dzień” z suwaka wiernie odtwarza skład akcjonariatu i to, które akcje
    są obciążone (regułą domenową nr 3), ale nie odtwarza historycznej
    wartości samego prawa głosu sprzed jego zmiany. Świadome uproszczenie:
    to atrybut pomocniczy przy obciążeniu, nie fakt liczbowy wymagający
    odtwarzania wstecz jak stan posiadania akcji.

17. **UI sprostowania ogranicza się do adnotacji/wycofania (bez `zamiast`).**
    API wspiera pełną podmianę treści (przetestowane), ale formularz w
    kokpicie oferuje tylko uzasadnienie — strukturalna korekta z nową treścią
    wymaga dziś wywołania API wprost. Świadome cięcie zakresu: 90% realnych
    korekt to „ten wpis nie powinien był powstać”, nie zmiana treści.

18. **Portal zbiera tylko kroki 1–2 kreatora, nie krok 3 („co się zmienia”).**
    Uzasadnienie pełne w „Jak działa” wyżej — krok 3 wymagałby udostępnienia
    portalowi wyszukiwarki całej wspólnej kartoteki `psa_osoby` (z widocznym
    statusem AML innych klientów). Zamiast tego klient opisuje zdarzenie
    słownie (`opis`) i wgrywa dokumenty; pracownik dopełnia treść w kokpicie
    sprawy, dokładnie jak dla zgłoszeń papierowych czy mailowych. Sprawa
    startuje w stanie `nowa` niezależnie od źródła.

19. **`PORTAL_WLACZONY` zostaje domyślnie `false` mimo ukończenia sprintu 3.**
    Włączenie portalu to decyzja biznesowa/prawna (zgoda na wariant A,
    umowa powierzenia z hostingiem, TLS), nie techniczna — flaga istnieje
    właśnie po to, żeby kod mógł być gotowy wcześniej niż decyzja o jego
    włączeniu.

20. **Sesja zamiast `X-User-Name` obejmuje CAŁĄ aplikację, nie tylko portal.**
    Konsekwencja wariantu A (sekcja 2): skoro serwer jest wystawiony
    publicznie, identyfikacja pracownika samym imieniem przestaje mieć sens
    również dla części kancelaryjnej. `autor(zad)` (dawniej czytający
    nagłówek) dziś czyta `zad.uzytkownik.imie` wypełnione przez middleware
    sesji — jedno miejsce zmiany, żadna trasa zapisująca zdarzenie nie
    wymagała edycji.

21. **Opłata za „informację z rejestru” zamówioną przez kancelarię (nie
    portal) jest ręcznym wpisem w ekranie Opłaty, nie automatycznym haczykiem
    w `EkranInformacji`.** `EkranInformacji` (sprint 1) renderuje podgląd
    „na żywo” z `/spolki/:id/stan` — czysto klientową ścieżkę bez żadnego
    zapisu po stronie serwera; dopinanie do niej naliczenia zmieniałoby jej
    naturę (podgląd → czynność z konsekwencją finansową) i wymagałoby
    osobnego rozróżnienia „to był tylko podgląd” od „to była wydana
    informacja”. Prostsze i bardziej zgodne z tym, jak faktycznie pracuje
    sekretariat: pracownik wydaje informację (drukuje z `EkranInformacji`,
    tak jak dotąd), a fakt wydania i opłatę odnotowuje jednym kliknięciem
    w ekranie Opłaty (`+ Nowa opłata`, typ „informacja”, stawka
    podpowiedziana z `przepisy.js`). Portal ma inny charakter — tam
    „pobranie” i „wygenerowanie” są tym samym zdarzeniem, więc automatyczne
    naliczenie w `POST /portal/informacja` jest bezpieczne i nie duplikuje
    niczego.

22. **Naliczenie roczne obejmuje każdą spółkę poza `wykreslona`, nie tylko
    `aktywna`.** Spec nie rozstrzyga wprost, czy spółki `w_likwidacji` albo
    `zawieszona` nadal podlegają opłacie za prowadzenie rejestru — przyjęto,
    że umowa o prowadzenie rejestru (a nie status spółki w KRS) jest tym, co
    rodzi obowiązek opłaty, więc tylko `wykreslona` (rejestr zakończony,
    umowa najpewniej wygasła) jest wyłączona automatycznie. Do potwierdzenia
    przez Łukasza — zmiana to jeden warunek SQL w `oplaty.naliczOplateRoczneWszystkie`.

23. **`przeniesienie_ulamka` jako jedyny nowy typ zdarzenia tworzący/przenoszący
    ułamki — istniejące handlery calo-akcyjne pozostają nietknięte.** Patrz
    uzasadnienie w sekcji „Co powstało w sprincie 5". Konsekwencja: `pula()`
    (współdzielona przez `walidacje.js` i `kreator.js`) wyklucza wiersze z
    `czesc_licznik ≠ czesc_mianownik` — współuprawniony do ułamka nie może
    zostać wzięty pod uwagę jako w pełni posiadający akcję przez zwykłe
    `przeniesienie`/`umorzenie`/`obciazenie`.

24. **`pokrycie_akcji` działa na poziomie (emisja, osoba), nie pojedynczego
    numeru akcji.** Art. 300⁹ § 3 KSH: wkłady zalicza się równomiernie na
    WSZYSTKIE akcje akcjonariusza, chyba że umowa spółki stanowi inaczej —
    zdarzenie stempluje `pokryta` na wszystkich otwartych wierszach danej
    osoby w danej emisji. Rozszerzenie na „wszystkie akcje we WSZYSTKICH
    emisjach spółki" (dosłowne brzmienie „wszystkie akcje akcjonariusza")
    uznano za przedwczesne bez realnego przypadku wielu emisji z różnym
    stopniem pokrycia.

25. **Backfill `data_wpisu_krs = data_emisji` dla emisji sprzed sprintu 5,
    NIE `NULL`.** Patrz uzasadnienie w sekcji „Co powstało w sprincie 5" —
    inaczej blokada z reguły domenowej 12 unieruchomiłaby `objecie` dla
    każdej prowadzonej dziś spółki, mimo że jej akcje od dawna prawnie
    istnieją.

26. **Usunięto `przepisy.FORMY_ZGODY` i katalog form zgody na wpis w UI**
    (poprawka erraty nr 3, `PRZEPISY-PSA.md` § 12 pkt 3). Pole „forma zgody"
    w kroku odnotowania zgody (art. 300³⁴ § 3 KSH) jest dziś opisem
    tekstowym, nie wyborem ze sztywnego słownika — bo taki słownik nie ma
    podstawy w przepisach P.S.A.

27. **Wpis konstytutywny/deklaratoryjny: obliczane i zapisywane na
    `psa_sprawy.charakter_wpisu`, ale bez osobnego formularza/treści
    zawiadomienia w UI.** `przepisy.charakterWpisu(typ, tytul_prawny)`
    ustala charakter w chwili wpisu (żeby późniejsza zmiana katalogu
    tytułów deklaratoryjnych nie przepisywała historii już załatwionych
    spraw) — `objecie` jest deklaratoryjne z wyjątkiem `objecie_warunkowe`
    (sprint 7), `przeniesienie` jest deklaratoryjne, gdy `tytul_prawny`
    zawiera frazę wskazującą przejście z mocy prawa (dziedziczenie, zapis
    windykacyjny, aport, połączenie/podział/przekształcenie). Sprawy
    sprzed tego sprintu zostają `NULL` ("nieustalone") — nie rekonstruuje
    się historii. Osobna treść zawiadomienia dla obu przypadków to
    świadomie odłożony krok — dzisiejsza treść jest poprawna dla obu,
    różni się tylko podstawą blokującą i checklistą, które już działają.

28. **Lista akcjonariuszy do KRS generowana automatycznie z KAŻDYM
    zawiadomieniem o wpisie, adresowana do spółki, nie składana przez nas
    do sądu.** Art. 300³⁴ § 8 KSH nakłada obowiązek złożenia na ZARZĄD —
    nasza rola to przygotowanie gotowego dokumentu (do podpisu wszystkich
    członków zarządu), nie jego złożenie. Stąd trzeci wpis w
    `psa_wydane_dokumenty` (`typ='wykaz_akcjonariuszy'`) przy każdym
    `POST /sprawy/:id/wpisz` — patrz zaktualizowane liczby w testach.

29. **Kreator ułamków/przedstawiciela/pokrycia dostępny wyłącznie w
    kreatorze kancelaryjnym, NIE w portalu klienta** (decyzja nr 10,
    sekcja 15 `CLAUDE-PSA.md`). `typyZdarzen.dostepneWKreatorze(5)` dla
    tras kancelaryjnych, ale `trasy/portal.js` celowo zostaje przy `(2)` —
    te trzy typy wymagają oceny pracownika, nie samoobsługi.

---

## Czego świadomie nie ma

Sprint 6 (warstwa wizualna, `SESJA-PSA-5-INTERFEJS.md`) i sprint 7 (domknięcie
domeny: warunkowa emisja, unieważnienie akcji, prawo pierwszeństwa jako
osobna blokada, kanały powiadomień, zgłoszenie zmian danych przez zarząd,
drugi zegar 7 dni, scalenie/split, uruchomienie portalu) zostają zaplanowane
w `CLAUDE-PSA.md` sekcja 14 — nie w tym sprincie. Co zostaje poza zakresem
CAŁEGO modułu, nie tylko dotychczasowych sprintów:

Portal jest funkcjonalnie gotowy (patrz sprint 3 wyżej), ale za flagą
`PORTAL_WLACZONY=false` domyślnie — patrz odstępstwo 19 i „Do decyzji”.
Krok „co się zmienia” w zgłoszeniu portalowym świadomie zostaje po stronie
pracownika (odstępstwo 18) — nie jest to luka do domknięcia, tylko trwały
podział odpowiedzialności.

Struktura pełnej podmiany treści przy sprostowaniu jest gotowa i przetestowana
na poziomie API; brakuje jej wyłącznie formularza w UI (patrz odstępstwo 17).

**„Migracja na wspólny `design.css`” z planu sprintu 4 nie dotyczy tego
repozytorium.** To zadanie z poziomu mastera — inne moduły kancelarii
(Kalkulator, Kasa) mają migrację na `design.css` jako dług; PSA linkuje go
poprawnie od pierwszego dnia (sekcja 2 specyfikacji, patrz architektura
wyżej). Nie ma tu nic do zrobienia — modułów Kalkulator/Kasa nie ma w tym
repozytorium.

**Zawiadomienie sądu i obsługa zapytań sądu MAJĄ realną implementację**
(sprint 4), ale zostają bramkowane datą wejścia w życie nowelizacji
(18.02.2027) — do tego dnia `POST /api/psa/sad/zapytania` i
`POST /api/psa/sad/zawiadomienie-o-rozwiazaniu` nadal zwracają `501`.
Integracja z Kasą (§ decyzja nr 5, sekcja 15) — wciąż osobno, jak ustalono.

Poza zakresem modułu, zgodnie z sekcją 1: rejestry S.A. i S.K.A., walne
zgromadzenia, dywidenda, e-voting, wysyłki do KRS w imieniu spółki.

Poza zakresem świadomie, zgodnie z sekcją 11: kwalifikowane znaczniki czasu,
drzewa Merkle'a, publikacja skrótów, XAdES/PAdES, integracja z podpisem
kwalifikowanym.

---

## Do decyzji

Nie blokują tego, co powstało, ale blokują kolejne kroki:

1. ~~Wariant wdrożenia~~ — **rozstrzygnięte: A, wszystko na VPS** (decyzja
   Łukasza, sprint 3). Konsekwencje do domknięcia PRZED realnym włączeniem
   portalu na produkcji (infrastrukturalne/prawne, nie kodowe):
   - TLS obowiązkowe (reverse proxy) — `trust proxy` już ustawione w kodzie;
   - kopie zapasowe SQLite + katalogu dokumentów, szyfrowane, offsite;
   - umowa powierzenia przetwarzania danych z dostawcą hostingu (RODO);
   - decyzja, kiedy przełączyć `PORTAL_WLACZONY` na `true` i kogo zaprosić
     jako pierwsze konta (`psa_konta`) — dziś zakładane wyłącznie ręcznie
     w bazie, nie ma jeszcze ekranu zaproszeń/aktywacji (patrz niżej).
2. **Aktywacja konta portalowego jest dziś ręczna.** Kolumna
   `token_aktywacji` istnieje w schemacie (sekcja 5), ale nie ma jeszcze
   przepływu „e-mail z linkiem aktywacyjnym” — konto zakłada się wprost
   w bazie z gotowym hasłem. Do zrobienia przed realnym udostępnieniem
   portalu klientom.
3. **Weryfikacja brzmienia przepisów nowelizacji.** Pozycje oznaczone w
   `PRZEPISY-PSA.md` jako ⚠️ (poza wydrukiem KSH — Prawo o notariacie, AML,
   taksa, art. 476 § 1¹ stosowany przez odesłanie) nie mogą być podstawą
   walidacji blokującej, dopóki Łukasz nie potwierdzi tekstu ustaw źródłowych
   (`PRZEPISY-PSA.md` § 13). Dziś żadna nowa reguła sprintu 5 na nich się nie
   opiera; AML jako bramka (`niemozliwe` → blokada) jest wcześniejszym,
   świadomym wyborem ze sprintu 2, sprint 5 go nie dodał ani nie rozszerzył.
4. **Kto może dokonać wpisu** — pytanie do izby. Na start: każdy zalogowany
   pracownik, z zapisem autora przy zdarzeniu (tak to działa).
5. **Stawki** — wpisane maksymalne (1200/100/50 zł) zgodnie z ustaleniem;
   obniżenie to zmiana trzech liczb w `przepisy.js`.
6. **Integracja opłat z modułem Kasa** — rekomendacja: osobno, scalenie po
   ustabilizowaniu modułu. `psa_oplaty` jest dziś jedynym źródłem prawdy
   o należnościach — bez eksportu/importu do Kasy, wyłącznie CSV ręcznie.
7. ~~Współwłasność akcji~~ — **rozstrzygnięte i zbudowane w sprincie 5**
   (ułamkowe części akcji, `logika/ulamki.js`, typ zdarzenia
   `przeniesienie_ulamka`, wspólny przedstawiciel). Otwarte pozostaje
   wyłącznie **zdefiniowanie osobnej treści zawiadomienia dla wpisu
   deklaratoryjnego** (odstępstwo 27) — dzisiejsza treść jest poprawna, ale
   nie rozróżnia charakteru wpisu w tekście.
8. **Czy „prowadzenie rejestru” jest należne za spółki `w_likwidacji` i
   `zawieszona`, nie tylko `aktywna`.** Przyjęto na razie „tak, wszystkie poza
   `wykreslona`” (odstępstwo 22) — do potwierdzenia.
9. **Weryfikacja tekstu ustawy przed realnym użyciem stubów sądowych.**
   Kod jest gotowy i bramkowany datą (18.02.2027), ale sama treść
   dokumentów (`dokumenty-tresc.js: wykazAkcjonariuszy`,
   `zawiadomienieSaduORozwiazaniu`) nie była jeszcze zestawiona z ostatecznym
   brzmieniem znowelizowanych przepisów — do zrobienia razem z resztą
   pozycji ⚠️ z `PRZEPISY-PSA.md` przed 18.02.2027, nie pilne dziś.
10. **Osobna treść zawiadomienia dla wpisu deklaratoryjnego** (odstępstwo 27) —
    `charakter_wpisu` jest już obliczany i zapisywany, ale zawiadomienie
    o wpisie ma dziś jedną treść dla obu przypadków.
11. **Rozszerzenie `pokrycie_akcji` na wszystkie emisje spółki naraz**
    (odstępstwo 24) — dziś jedna emisja na zdarzenie; do potwierdzenia, czy
    to wystarczające dla spółek z wieloma emisjami o różnym pokryciu.

Otwarta kwestia techniczna: **plik `STANDARDY-KANCELARIA-4-1.md` nie był
dostępny przy budowie.** Konwencje odtworzono ze specyfikacji modułu. Jeśli
Kalkulator i Kasa układają katalogi inaczej, przemianowanie jest tanie.

---

## Testy

```bash
npm test
```

154 testy, bez zależności zewnętrznych (`node:test`), baza w pamięci lub plik tymczasowy.

- `numery.test.js` — algebra zakresów, przydział FIFO, ręczne nadpisanie
- `ulamki.test.js` — arytmetyka wymierna ułamkowych części akcji: 1/3+1/3+1/3=1
  bez utraty precyzji, skracanie do postaci nieskracalnej (NWD=1), porównania
  przez mnożenie na krzyż, suma przez wspólny mianownik, odejmowanie rzuca
  przy próbie zejścia poniżej zera, walidacja zakresu licznika/mianownika
- `sprint5.test.js` — niezmiennik bilansu per numer akcji (współwłasność
  sumująca się do 1, błąd blokujący gdy nie sumuje się do 1), `pula()`
  wyklucza wiersze ułamkowe, `przeniesienie_ulamka` odrzuca zbycie ponad
  posiadany ułamek i ułamek rozciągnięty na więcej niż jeden numer,
  `przedstawiciel` wymaga istniejącego uprawnionego, `pokrycie_akcji`
  obejmuje wszystkie wiersze osoby w emisji, odtworzenie zdarzeń sprzed
  sprintu 5 (bez pól ułamkowych) daje 1/1 — migracja bezbolesna, blokada
  `objecie` bez `data_wpisu_krs` i jej zdjęcie sprostowaniem emisji, blokada
  zbycia ułamka akcji nie w pełni pokrytej bez zgody spółki, pełny cykl
  emisja→objęcie→przeniesienie_ulamka→przedstawiciel z materializacją do
  `psa_stan_akcji`, odbudową stanu i integralnością łańcucha
- `przeniesienie.test.js` — całość / część / wielu nabywców, pakiet nieciągły,
  łańcuch A→B→C, zachowanie daty nabycia reszty pakietu
- `rejestr.test.js` — bilans, stan na dzień, odbudowa = stan bieżący, łańcuch
  skrótów (podmiana treści i usunięcie rekordu), append-only, walidacje blokujące
- `reguly.test.js` — maskowanie, kartoteka wspólna, zakres podmiotowy,
  determinizm i jednoznaczność skrótu
- `terminy.test.js` — termin 7 dni, zamrożenie w stanie wstrzymana, pełny
  restart po wznowieniu, kumulacja `dni_wstrzymania`
- `nowe-typy.test.js` — obciążenia (blokada rozporządzania, wykreślenie,
  prawo głosu), zajęcie z urzędu, uprawnienia, ograniczenia (prawo
  pierwszeństwa), zmiana danych akcjonariusza, sprostowanie (adnotacja,
  podmiana treści, ochrona integralności referencyjnej, podwójne sprostowanie)
- `sprawy-http.test.js` — pełny cykl HTTP: założenie sprawy → weryfikacja →
  wpis z zawiadomieniem (do żądającego, do spółki i lista akcjonariuszy do
  KRS — trzy dokumenty od sprintu 5); wstrzymanie/wznowienie z wezwaniem;
  odmowa; ścieżka z urzędu (dwa dokumenty, oba do spółki — bez żądającego);
  AML jako bramka w workflow sprawy; upload i pobranie dokumentu
  (w tym odrzucenie niedozwolonego rozszerzenia); sprostowanie przez
  dedykowany endpoint (sesja pracownika zakładana raz w `test.before`,
  ciasteczko przekazywane do każdego zapytania)
- `auth-logika.test.js` — hasła (hash/weryfikacja, ocena siły), sesja
  (wystawienie/odczyt, odrzucenie sfałszowanej sygnatury, podmienionej
  treści i tokenu wygasłego), rate limiter (blokada po przekroczeniu limitu,
  niezależne liczniki per IP, czyszczenie po udanym logowaniu)
- `auth-http.test.js` — bootstrap administratora z `ADMIN_EMAIL`, logowanie
  (błędne/poprawne hasło), ochrona tras kancelaryjnych sesją, rate limiting
  na `/auth/login` przez HTTP, admin zakłada pracownika (hasło tymczasowe
  zwrócone raz), pracownik nie widzi listy użytkowników (403) ale ma dostęp
  do rdzenia, admin nie może zablokować własnego konta, zmiana hasła
  (błędne obecne, za krótkie nowe, poprawna zmiana + logowanie nowym),
  wylogowanie kasuje ciasteczko (`Max-Age=0`)
- `portal-http.test.js` — logowanie portalowe niezależne od sesji pracownika
  (inne ciasteczko), „moje” dla roli spółka i akcjonariusz, maskowanie
  w `rejestr/:spolkaId` (własne dane w pełni, dane współakcjonariusza
  częściowo zamaskowane; konto spółki widzi wszystko), odrzucenie dostępu
  do cudzej spółki (404), złożenie zgłoszenia (i odrzucenie typu `z_urzedu`),
  scoping listy zgłoszeń (spółka widzi wszystkie o swoim rejestrze, inny
  akcjonariusz — nic), upload dokumentu do własnej sprawy vs. odrzucenie
  dla cudzej, generowanie informacji z rejestru + ślad audytowy w
  `psa_wydane_dokumenty`, flaga `PORTAL_WLACZONY=false` → 503 na całym `/portal`
- `oplaty.test.js` — jednostkowe: `stawkaGrosze`/`nowelizacjaObowiazuje` (czyste
  funkcje z `przepisy.js`), naliczenie opłaty za wpis/informację ze stawką
  z przepisów, idempotencja naliczenia rocznego per spółka+rok (w tym po
  anulowaniu — nie blokuje ponownego naliczenia), naliczenie wsadowe pomija
  spółki `wykreslona`, ręczny wpis z domyślną/nadpisaną kwotą, zmiana statusu,
  eksport CSV (nagłówek, escaping przecinka i cudzysłowu, kwota w złotych)
- `oplaty-http.test.js` — wpis odpłatny przez sprawę nalicza opłatę typu
  „wpis”; zajęcie z urzędu (wolne od opłat) i migracja „stan otwarcia”
  (ścieżka bezpośrednia) NIE naliczają; naliczenie roczne tylko dla admina
  i idempotentne przez HTTP; walidacja ręcznego wpisu (typ, okres wymagany
  dla „prowadzenie”); zmiana statusu; eksport CSV zwraca poprawny
  `Content-Type` i BOM na surowych bajtach (nie na tekście zdekodowanym —
  `.text()` domyślnie zdejmuje BOM); pobranie informacji przez portal
  nalicza opłatę; stuby sądowe zwracają `501` przed nowelizacją; trasa
  `/oplaty` wymaga sesji pracownika

UI sprawdzony w przeglądarce (Chromium) po każdym sprincie: wszystkie ekrany,
pełny cykl sprawy od założenia po wpis z podglądem przed/po i bramką
checklisty, wstrzymanie/wznowienie z realnym przeliczeniem terminu, upload
dokumentu, sprostowanie z kokpitu (potwierdzone: cofnięcie transferu akcji
widoczne w tabeli akcjonariatu), kolejka i pulpit z realnymi danymi.

Sprint 3: ekran logowania (błędne hasło → komunikat, poprawne → pulpit
z sesją w stopce sidebara), ekran Użytkownicy (założenie pracownika →
hasło tymczasowe pokazane raz → wylogowanie → logowanie nowym pracownikiem
→ pozycja „Użytkownicy” poprawnie ukryta dla roli innej niż admin), cała
ścieżka portalu jako osobna aplikacja pod `/portal`: logowanie, „moje
spółki” z posiadanymi akcjami, podgląd rejestru z widocznym maskowaniem
danych współakcjonariusza, złożenie zgłoszenia, status zgłoszeń, otwarcie
wygenerowanej informacji z rejestru w nowej karcie, wylogowanie. Zero
błędów konsoli/strony poza spodziewanym `net::ERR_CONNECTION_RESET` na
zablokowanych przez proxy środowiska Google Fonts.

Sprint 4: założenie nowej spółki → kreator „stan otwarcia” (emisja z datą
historyczną 15.03.2019 → objęcie całości przez akcjonariusza z kartoteki →
kokpit poprawnie pokazuje oś czasu z tą datą, nie dzisiejszą) → potwierdzenie,
że migracja NIE zostawia śladu w Opłatach → realny wpis (umorzenie akcji)
przez pełny workflow sprawy z checklistą → potwierdzenie, że TEN wpis
naliczył opłatę typu „wpis” → ręczny wpis opłaty za informację z ekranu
Opłaty → naliczenie roczne (admin) → zmiana statusu na „opłacona”. Zero
błędów konsoli/strony poza tym samym spodziewanym `net::ERR_CONNECTION_RESET`.

**Sprint 5 — weryfikacja UI w Playwright niewykonalna w tej sesji: środowisko
zablokowało `unpkg.com` (React/Babel z CDN, `403` na poziomie proxy), nie
tylko Google Fonts jak we wcześniejszych sprintach — bez tych trzech plików
aplikacja się nie renderuje.** Zamiast tego zweryfikowano: (1) serwer startuje
czysto z migracją v5 i pełnym zestawem tras; (2) wszystkie zmienione pliki
JSX (`kreator.js`, `sprawy.js`, `konfiguracja.js`, `spolki.js`) parsują się
bez błędu przez `@babel/core` z presetem `react` — ten sam silnik transformacji,
którego używa `@babel/standalone` w przeglądarce; (3) pełny stos backendu
(kreator → walidacje → stan → materializacja → integralność łańcucha) dla
wszystkich trzech nowych typów zdarzeń przez `testy/sprint5.test.js`. Realna
weryfikacja w przeglądarce (nowe kroki kreatora, pole daty KRS na emisji,
komunikat blokady) pozostaje do zrobienia w środowisku z dostępem do CDN —
nie jest to nowe ograniczenie tego sprintu, tylko brak możliwości obejścia
znanego już wcześniej ograniczenia proxy tej konkretnej sesji.
