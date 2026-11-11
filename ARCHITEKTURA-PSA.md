# ARCHITEKTURA-PSA — rejestr akcjonariuszy P.S.A.

Stan po uproszczeniu (Fazy 0–6, listopad 2026). Źródło prawne: `PRZEPISY-PSA.md`; rozstrzygnięcia: `DECYZJE.md`
(U-01…U-30, D-xxx). Ten plik opisuje to, co jest w kodzie — przy zmianie zachowania aktualizuj go razem z kodem.

## 1. Zasady

1. **Jedna droga do celu:**
   - jedna droga zapisu wpisu: `rejestr.wpisz` przez sprawę (R1);
   - jedna droga wydania informacji: `informacje.wydajInformacje`;
   - jeden generator pism: `logika/pisma.js`;
   - jedna tabela plików przychodzących: `psa_pliki`;
   - jedno źródło każdej danej.
2. **Rejestr zawiera tylko fakty dokonane** — bez emisji przed wpisem do KRS i bez akcji „nieobjętych”.
3. **Typ wpisu to operacja na akcjach** — różnice (podstawa, z urzędu, ułamek) są polami, nie typami.
4. **Reguły wynikają z danych** — kogo powiadomić i co sprawdzić liczą funkcje z porównania stanu przed
   i po wpisie, nie flagi typów.
5. **Każdy status ma jedną tabelę przejść** (`PRZEJSCIA`) i zmienia go tylko funkcja, która ją sprawdza.
6. **Blokada systemowa tylko z podstawą 🟢 w `PRZEPISY-PSA.md`** (R6); wszystko inne to pozycja checklisty
   odhaczana przez człowieka.
7. **Każda trasa, tabela, kolumna i plik ma wywołującego w kodzie produkcyjnym.**

## 2. Struktura

| Miejsce | Zawartość |
|---|---|
| `serwer.js` | Express: nagłówki, sprawdzenie `Origin`, sesje, montowanie routerów (`ROUTERY_API`), strony |
| `server/trasy/` | routery HTTP — tylko parsowanie żądania i odpowiedź; lista: `docs/endpointy-api.md` |
| `server/*.js` | moduły domenowe z transakcjami: `rejestr`, `sprawy`, `informacje`, `korespondencja`, `oplaty`, `platnosci`, `wnioski`, `portal`, `pulpit`, `eksport`, `proces-dzienny`, `krs`, `poczta` |
| `server/logika/` | czyste funkcje (stan, walidacje, terminy, ułamki, numery, maskowanie, łańcuch skrótów, wzory) i moduły z małym SQL (pisma, ustawienia, dziennik) |
| `server/dane/` | SQL według tabel (spółki, osoby, sprawy, rejestr, pisma, pliki, opłaty, wnioski, konta, historia) |
| `server/pomocnicze/` | autoryzacja i sesje, ciasteczka, czas (`czas.teraz()`), odpowiedzi i błędy, przyjęcie plików |
| `server/tryb-testowy/` | atrapy (KRS, tpay, skrzynka, test podpisu) — wczytywane tylko przy `PSA_TRYB_TESTOWY=1` |
| `publiczne/js/` → `publiczne/dist/` | dwie aplikacje React: kancelaria (`index.html`) i portal (`portal.html`) |
| `wzory/` | 8 wzorów pism w Markdown; wygląd PDF wspólny (`logika/wzory.js`) |
| `narzedzia/` | budowanie frontu i strony, seed trybu testowego, dokumentacja, lista tras, podgląd wzorów |

## 3. Model danych (21 tabel `psa_*`, jeden schemat bazowy — `server/migracje.js`)

| Tabela | Rola |
|---|---|
| `psa_zdarzenia` | **źródło prawdy**: wpisy tylko dopisywane (wyzwalacze blokują UPDATE/DELETE), łańcuch skrótów SHA-256 |
| `psa_emisje`, `psa_stan_akcji`, `psa_atrybuty` | materializacja stanu: serie, własność z ułamkami, obciążenia i adnotacje |
| `psa_spolki` | dane z KRS, NIP, kto zawarł umowę, płatność (U-30), daty otwarcia i zamknięcia rejestru |
| `psa_osoby` | kartoteka wspólna: nazwa, PESEL / data urodzenia / numer w rejestrze, adres z rodzajem, e-mail i zgoda, PEP, data AML |
| `psa_historia_danych` | historia zmian danych osób i spółek, zgód, „Działają za spółkę”, zaproszeń — tylko dopisywanie |
| `psa_sprawy` | stan, żądający, termin, robocze operacje i checklista (JSON), podstawa, opłata, przyczyna odmowy |
| `psa_pliki` / `psa_pisma` | pliki przychodzące (skrót, kto wgrał, stan podpisu) / pisma wychodzące (PDF, SHA-256, numer, kanał, stan) |
| `psa_oplaty`, `psa_platnosci` | opłaty (netto w groszach, płatnik) i próby zapłaty tpay |
| `psa_wnioski` | wniosek o prowadzenie rejestru: stan, przejęcie, dane klienta w jednym JSON, odpis KRS, checklista |
| `psa_konta`, `psa_reprezentanci` | konto portalu = osoba (przed przyjęciem — wniosek); osoby działające za spółkę |
| `psa_uzytkownicy`, `psa_sesje_uniewaznione` | pracownicy kancelarii; czarna lista tokenów po wylogowaniu |
| `psa_dziennik` | dziennik dostępu (tylko dopisywanie, retencja 5 lat) |
| `psa_ustawienia` | dane kancelarii i osoby zawierające umowy — jedyne źródło |
| `psa_migracje`, `psa_baza_testowa` | wersja schematu; oznaczenie bazy testowej i symulowana data |

Pełny schemat: `docs/schemat-bazy.txt`. Zmiana schematu przed pierwszymi prawdziwymi wpisami — edycja migracji
bazowej (U-01); po nich — nowa migracja.

## 4. Reguły domenowe (nie zmieniać bez decyzji notariusza)

1. **Wpisy tylko dopisywane.** Pomyłka = wpis `sprostowanie` (zastąpienie treści albo wycofanie wpisu).
   Kontrola łańcucha na żądanie: Ustawienia → „Sprawdź integralność rejestru” (U-20).
2. **Stan = pochodna wpisów.** Każdy zapis odtwarza stan spółki w całości (`stan.js`); test: odtworzenie = stan bieżący.
3. **Bilans** (art. 300³¹ § 2): dla każdego numeru akcji suma ułamków uprawnionych = 1 (albo akcja umorzona).
   Naruszenie = odmowa zapisu.
4. **Numery akcji wpisuje pracownik** — seria, numery i liczba — w każdej operacji (U-26). Serwer sprawdza zgodność
   liczby z numerami i to, że numery należą do rozporządzającego.
5. **Ułamki** (art. 300² § 3, 300⁴³):
   - zapis jako para liczb całkowitych, arytmetyka wymierna (`ulamki.js`);
   - wiersz z ułamkiem ≠ 1/1 obejmuje jeden numer akcji (CHECK w schemacie);
   - procent tylko do wyświetlania;
   - aplikacja nie liczy głosów (U-12).
6. **Kwoty w groszach netto**; brutto liczy `przepisy.obliczBrutto`.
7. **Chwila wpisu nadaje system** (bez antydatowania). „Stan na” to dzień: wpisy do końca dnia (Europe/Warsaw, U-22).
8. **Termin 7 dni** (`terminy.js`, art. 300³⁴ § 1): od wpływu żądania; wstrzymanie zamraża bieg, a po usunięciu
   przeszkody biegnie pełne 7 dni.
9. **Z urzędu ⇔ zajęcie** (R3, art. 300³⁴ § 2): bez opłaty, bez powiadomienia, żądający = organ.
10. **Maskowanie** (art. 300³⁵ § 1¹): biała lista pól według odbiorcy. Akcjonariusz nie dostaje PESEL, daty urodzenia
    ani adresu zamieszkania innych. AML, PEP i uwagi widzi tylko kancelaria.
11. **Kartoteka wspólna:**
    - osoba wpisywana raz dla wszystkich spółek;
    - osoba fizyczna ma PESEL albo datę urodzenia (D-076);
    - nieprawidłowy PESEL blokuje zapis (U-18);
    - zmiana danych to „Edytuj” z historią, nie wpis (U-25).
12. **Akcje nie istnieją przed wpisem do KRS** (art. 300³⁰ § 2, 300¹⁰⁷ § 3, 592 § 3). Emisja tylko z datą wpisu
    do KRS — równą dacie rejestracji spółki przy założeniu, późniejszą przy kolejnych — i od razu z obejmującymi (U-21).
13. **Dane osobowe nie trafiają do treści zdarzeń** (R10) — zdarzenia wskazują osoby identyfikatorem z kartoteki.
14. **Rejestr nie pośredniczy w płatnościach spółki** (dywidendy, spłaty). tpay służy wyłącznie opłatom kancelarii.

## 5. Wpisy: 8 typów (`logika/typy-zdarzen.js`)

| Typ | Operacja | Uwagi |
|---|---|---|
| `otwarcie` | stan początkowy: serie, akcjonariusze, atrybuty | założenie albo przejęcie od innego podmiotu (U-07) |
| `emisja` | nowa seria z obejmującymi | data wpisu do KRS obowiązkowa; pokrycie tak/nie bez domyślnej (U-17) |
| `przeniesienie` | zbywca → nabywcy, także ułamek | odpłatne |
| `umorzenie` | podstawa: uchwała albo orzeczenie sądu | unieważnienie = umorzenie z podstawą „orzeczenie” |
| `obciazenie` | ustanowienie, zmiana prawa głosu, wykreślenie | zastaw, użytkowanie, zajęcie (z urzędu) |
| `adnotacja` | dodanie, wykreślenie | uprawnienie, ograniczenie, obowiązek, niepokryte, inna |
| `sprostowanie` | zastąpienie albo wycofanie wpisu | żądający może być „brak” (z inicjatywy kancelarii) |
| `zamkniecie` | koniec prowadzenia rejestru | przekazanie, wykreślenie spółki, rozwiązanie umowy |

Rodzaj akcji jest wyliczany: uprzywilejowana, gdy ma adnotację „uprawnienie”, inaczej zwykła (U-17).

## 6. Sprawa — jedyna droga wpisu (R1)

**Ekran sprawy ma trzy kroki:**
1. **Treść:** zmiany i podstawa.
2. **Sprawdzenie:** stan przed i po, osoby do powiadomienia, checklista, opłata.
3. **Pisma:** powiadomienia o wpisie.

„Dokonaj wpisu” wykonuje jedną transakcję: walidacje → zdarzenia → odtworzenie stanu → opłata → pisma → `wpisana`.

- **R2 Kogo powiadomić** — `stan.ktoTraci(przed, po)`: każdy, komu ubywa akcji; akcjonariusz, którego akcje obciążono;
  uprawniony z wykreślanego obciążenia lub tracący prawo głosu; akcjonariusz tracący „uprawnienie”.
  - Pracownik może dopisać osobę, ale nie może usunąć wyliczonej.
  - Powiadomienia o zamierzonym wpisie powstają po kroku 1.
  - Wpis jest zablokowany, dopóki każda wyliczona osoba nie ma wysłanego powiadomienia albo odnotowanej zgody na wpis.
  - „Zmień treść” usuwa niewysłane powiadomienia, a wysłane unieważnia.
- **R5 Checklista** — trzy pozycje stałe (żądający uprawniony; dokumenty zbadane; identyfikacja i AML) oraz pozycje
  z atrybutów akcji: ograniczenie, niepokryte, zajęcie, zastaw z prawem głosu. Odhacza zawsze człowiek.
- **R6 Blokady systemowe — tylko te:**
  - bilans;
  - emisja bez wiarygodnej daty wpisu do KRS;
  - rozporządzenie ponad stan posiadania;
  - brak powiadomienia albo zgody;
  - rejestr zamknięty;
  - niepełna checklista;
  - nieprawidłowy PESEL.
- **Opłata (U-02)** — przy operacji odpłatnej pracownik wybiera „100 zł netto” albo „bez opłaty”. Wybór jest
  obowiązkowy, najwyżej jedna opłata na sprawę. Opłata nie warunkuje terminu ani wpisu.

## 7. Statusy i przejścia

| Encja | Stany | Przejścia |
|---|---|---|
| sprawa | `w_toku`, `wstrzymana`, `wpisana`, `odmowa`, `wycofana` | `w_toku` ⇄ `wstrzymana`; `w_toku` → `wpisana`; obie otwarte → `odmowa`, `wycofana` |
| wniosek | `roboczy`, `zlozony`, `przyjety`, `odrzucony` | `roboczy` → `zlozony`; `zlozony` → `roboczy` (zwrot z notatką), `przyjety`, `odrzucony` |
| plik do podpisu | `do_podpisu`, `do_sprawdzenia`, `potwierdzony`, `odrzucony` | wgranie po teście podpisu (D-086) → do sprawdzenia → decyzja pracownika |
| pismo | `do_wyslania`, `wyslane`, `blad` | e-mail: wysyłka albo błąd → ponowna; list: „Nadano” (U-28); niepotrzebne niewysłane usuwa się samo |
| opłata | `do_zaplaty`, `oplacona`, `anulowana` | ręcznie („Opłacona”, „Anuluj” z powodem) albo przez ITN tpay |
| rejestr spółki | otwarty / zamknięty | wynika z wpisów `otwarcie` i `zamkniecie` (U-14) |

## 8. Pisma, Korespondencja, informacja z rejestru

- **Rodzaje pism (8):** umowa, uchwała, zgoda na e-mail, powiadomienie o zamierzonym wpisie, o wpisie, o odmowie,
  wezwanie, informacja z rejestru.
  - Pismo powstaje z czynności. PDF i SHA-256 zapisują się raz.
  - Numer: `PSA/RRRR/NNNN`, dla informacji `INF/RRRR/NNNN`.
- **Kanał (R9):** e-mail z PDF w załączniku, gdy adresat ma zgodę na korespondencję e-mail (spółka — z umowy);
  w każdym innym przypadku list. Treść e-maila jest krótka, bez danych osobowych.
  - Wysyła zawsze pracownik po podglądzie, z ekranu „Korespondencja”.
  - Pismo widać też w portalu: do spółki — u osób działających za nią, do osoby — na jej koncie.
- **Informacja z rejestru (U-24, U-27):** zawiera wyłącznie dane z art. 300³³ § 1, PESEL albo datę urodzenia,
  numer i „stan na” dzień.
  - Pracownik wydaje ją na dowolny dzień od otwarcia, także dziś: 50 zł albo bez opłaty (organ — zawsze bez,
    z sygnaturą).
  - Portal: stan najpóźniej na wczoraj, płatna z góry, do pobrania po zaksięgowaniu. Osoba działająca za spółkę
    dostaje pełną, akcjonariusz — bez danych innych akcjonariuszy z art. 300³⁵ § 1¹.
- **Eksport rejestru** (art. 90a PrNot): ZIP — informacja, historia wpisów (JSON i CSV ze skrótami), pliki i pisma.

## 9. Nowa spółka: wniosek → przyjęcie → otwarcie

1. **Formularz publiczny (U-08):** KRS, e-mail i „przenoszę rejestr”. Zakłada wniosek i konto z linkiem
   aktywacyjnym (7 dni, w bazie tylko skrót tokenu). Odpowiedź jest zawsze ta sama (D-079).
2. **Wniosek** — jeden schemat danych (`logika/wniosek.js`) dla portalu i kancelarii („Nowa spółka”).
   „Złóż” tworzy dokumenty (U-03):
   - umowę — w niej § 12 ust. 3: obowiązek zawiadamiania o odwołaniu osoby działającej za spółkę;
   - uchwałę — „100% akcji”, podpisy wszystkich akcjonariuszy;
   - zgody akcjonariuszy bez konta.
3. **Podpisy:** wgrany plik przechodzi podstawowy test podpisu (D-086); resztę sprawdza pracownik.
   Na umowie pracownik wgrywa podpis notariusza.
4. **„Przyjmij”** zakłada spółkę i osoby (przy powtórzonym PESEL/KRS — wybór istniejąca albo nowa), zgody do
   historii i reprezentanta jako osobę działającą za spółkę. Konto wnioskodawcy przechodzi na jego osobę.
5. **„Otwórz rejestr”** zakłada sprawę z wpisem `otwarcie` — numery akcji wpisuje pracownik. Przy przejęciu
   działa dopiero od dnia przejęcia (U-07). Wpis otwarcia nalicza pierwszą opłatę za prowadzenie.

## 10. Portal i konta (U-23)

**Konto należy do osoby z kartoteki** (przed przyjęciem wniosku — do wniosku). Jego zakres liczy `portal.zakresKonta()`
przy **każdym** żądaniu:

| Rola | Warunek | Dostęp |
|---|---|---|
| osoba działająca za spółkę | wpis w `psa_reprezentanci` | wszystko o spółce; informacja pełna na koszt spółki |
| akcjonariusz | ma dziś akcje i zgodę na korespondencję e-mail | swoje sprawy, pisma i opłaty; informacja bez danych innych, na swój koszt |
| obie role | — | suma zakresów |
| konto z wnioskiem | wniosek nieprzyjęty | wyłącznie ten wniosek |

- Cudza spółka, sprawa, pismo, opłata albo dokument — 404.
- **Odebranie dostępu działa od razu, bez wylogowania (D-206):**
  - zbycie wszystkich akcji albo wycofanie zgody — samo;
  - odwołanie z zarządu lub koniec pełnomocnictwa — „Usuń” w kokpicie („Działają za spółkę”), ze śladem w historii spółki.
- **„Zaproś do portalu”** (karta osoby) zakłada konto albo wysyła nowy link do hasła. Ustawienie hasła unieważnia
  inne sesje konta.
- **Ekrany portalu:** Start (wybór spółki, „Do zrobienia”, sprawy z pismami, informacje), Zgłoś zmianę (opis i pliki
  → sprawa w toku), Konto (hasło, zgoda). Bez słownictwa prawniczego.

## 11. Opłaty, płatności, proces dzienny

- **Opłata za prowadzenie** (U-30): 1 200 zł netto rocznie albo 100 zł miesięcznie. Nalicza ją proces dzienny
  w rocznicę albo co miesiąc w dniu otwarcia (31 → ostatni dzień miesiąca), dopóki rejestr jest otwarty.
  Pozostałe opłaty — według U-02.
- **tpay:** „Zapłać [kwota brutto]” zakłada transakcję (idempotentnie, zmiana kwoty unieważnia stare linki także
  u operatora).
  - Opłatę księguje **wyłącznie ITN** `/api/psa/platnosci/tpay/itn`: suma kontrolna, podpis JWS, kwota faktycznie
    zapłacona, zgodność trybu piaskownicy, idempotencja.
  - Odpowiedź ITN to zawsze czyste `TRUE`.
- **Proces dzienny** (`proces-dzienny.js`, start z serwerem):
  - opłaty za prowadzenie;
  - przypomnienie o kolejnym roku (30 dni wcześniej);
  - retencja danych klienta z wniosków odrzuconych i porzuconych po 90 dniach (U-19);
  - usuwanie wpisów dziennika starszych niż 5 lat.

## 12. Bezpieczeństwo (§ 7 specyfikacji uproszczenia)

1. **Sesje:** dwa ciasteczka (`psa_sesja` — pracownik, `psa_sesja_portal` — konto), `HttpOnly`, `SameSite=Lax`,
   `Secure` za HTTPS.
   - Token niesie tylko tożsamość i wersję — stan konta czyta się z bazy przy każdym żądaniu.
   - Zmiana hasła unieważnia inne sesje.
   - Hasła: bcrypt (koszt 12); tokeny aktywacyjne: SHA-256.
2. **Lista dozwolonych tras** `testy/trasy-dozwolone.txt` porównywana z introspekcją routerów (`narzedzia/trasy.js`).
3. **Izolacja portalu** — test tabelaryczny każdej trasy dla każdej roli (`portal-http.test.js`).
4. **Pliki przychodzące** — jedna funkcja `pomocnicze/pliki.przyjmij`:
   - biała lista PDF, JPG, PNG, XML, P7S, P7M po rozszerzeniu i sygnaturze;
   - limit 10 MB, losowa nazwa poza `publiczne/`;
   - pobieranie jako załącznik z `nosniff`.
5. **Brak HTML z danymi użytkownika:** serwer składa tylko PDF; zakaz `dangerouslySetInnerHTML` (test).
6. **Nagłówki:**
   - CSP `default-src 'self'` bez zewnętrznych skryptów i bez `unsafe-inline` (poza trybem testowym);
   - `frame-ancestors 'none'`, `nosniff`, HSTS za HTTPS;
   - `Referrer-Policy: same-origin`, a nie `no-referrer` — przy `no-referrer` przeglądarki wysyłają `Origin: null`
     przy własnych żądaniach POST, co wyłączyłoby punkt 7.
7. **`Origin`:** żądanie zmieniające stan z obcym `Origin` dostaje 403. Wyjątek: ITN tpay.
8. **Limity prób** (`logika/limiter.js`): logowanie (kancelaria, portal), aktywacja konta, formularz publiczny,
   zamówienie informacji.
9. **Poczta:** wyłącznie SMTP z TLS (465 albo STARTTLS obowiązkowy). W trybie testowym — skrzynka na dysku.
10. **Tryb testowy:**
    - moduły wczytywane tylko przy fladze;
    - odmowa startu przy `NODE_ENV=production` albo na bazie nieoznaczonej.
11. **Dziennik dostępu:** wydanie informacji, eksport, pobranie pliku, zmiana ustawień, przypomnienia (w trybie testowym także logowania) — tylko dopisywanie, 5 lat.
12. **Poza kodem:**
    - aplikacja kancelarii dostępna tylko z adresów kancelarii (zapora);
    - szyfrowany dysk serwera i szyfrowane kopie zapasowe (dane osobowe w bazie są jawne).

## 13. Testy

| Rodzaj | Zakres |
|---|---|
| `npm test` | jednostkowe i HTTP (`node:test`) — reguły R1–R10, statusy, pisma i wzory, informacja i maskowanie, opłaty i tpay, wniosek, portal (izolacja), bezpieczeństwo |
| `npm run e2e` | scenariusze kancelarii, wniosku i portalu przy 1440 i 390 px; zbiera błędy JS i HTTP, naruszenia axe, problemy układu |
| `npm run e2e:malpa` | „małpa” — klika każdy aktywny element ekranów kancelarii i portalu, test błędnych danych |
