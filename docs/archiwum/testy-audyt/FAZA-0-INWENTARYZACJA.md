# FAZA 0 — Inwentaryzacja

> Sesja audytu PSA wg `SESJA-PSA-AUDYT.md`. Zero zmian w kodzie produkcyjnym.
> Schemat bazy zdobyty z realnie zmigrowanej bazy (`PRAGMA table_info`), nie ze specyfikacji.

## 1. Endpointy API (94, w 14 plikach; `krs.js` to moduł logiki, nie router)

Model autoryzacji: dwie niezależne sesje ciasteczkowe (`psa_sesja` — pracownik kancelarii,
`psa_sesja_portal` — konto portalu klienta). Większość plików tras ma `wymagajPracownika`
podpięte na poziomie `app.use(...)` w `serwer.js` (obejmuje wszystkie trasy pliku automatycznie).
Wyjątki wymagające sprawdzenia per-trasa: `auth.js`, `pozostale.js`, `portal.js`, `platnosci.js`,
`wspolne.js`.

**Znalezisko wstępne (do potwierdzenia w FAZA 5):** `GET /api/psa/meta` (`pozostale.js:68`) nie ma
ŻADNEGO middleware autoryzacji — jedyna trasa w `pozostale.js` bez `wymagajPracownika`, mimo że
plik jest montowany bez gate na poziomie `app.use` i każda trasa musi go dodać sama. Ujawnia
słowniki/stawki/typy zdarzeń bez logowania i bez sesji.

Pełna tabela endpointów (94 pozycji, plik:linia, middleware, przeznaczenie) — patrz
`testy-audyt/endpointy-api.md` (kopia raportu agenta, poniżej podsumowanie ilościowe):

| Plik | Mount | Gate na poziomie app.use | Liczba endpointów |
|---|---|---|---|
| auth.js | /api/psa/auth | brak (per-trasa) | 7 |
| krs.js | — (moduł logiki, nie router) | — | 0 |
| oplaty.js | /api/psa/oplaty | wymagajPracownika | 9 |
| osoby.js | /api/psa/osoby | wymagajPracownika | 8 |
| platnosci.js | /api/psa/platnosci | brak (celowo — webhook tpay) | 1 |
| portal.js | /api/psa/portal | warunkowe (PORTAL_WLACZONY + wymagajKonta wewnątrz pliku) | 37 |
| pozostale.js | /api/psa | brak (per-trasa) | 8 (w tym 1 publiczny: `/meta`) |
| spolki.js | /api/psa/spolki | wymagajPracownika | 21 |
| sprawy.js | /api/psa/sprawy | wymagajPracownika | 13 |
| szablony.js | /api/psa/szablony | wymagajPracownika + wymagajAdmina na każdej trasie | 5 |
| wnioski.js | /api/psa/wnioski | wymagajPracownika | 17 |
| wspolne.js | /api/wspolne | brak (publiczny, dane nagłówkowe kancelarii) | 1 |
| zawiadomienia.js | /api/psa/zawiadomienia | wymagajPracownika | 2 |
| zdarzenia.js | /api/psa/zdarzenia | wymagajPracownika | 2 |
| zgloszenia.js | /api/psa/zgloszenia | wymagajPracownika | 4 |

Inne uwagi z audytu endpointów:
- Brak zakomentowanych/martwych tras.
- `POST /api/psa/platnosci/tpay/itn` stoi celowo przed bramkami sesji — bezpieczeństwo oparte
  wyłącznie o sumę kontrolną + podpis JWS + adres IP sprawdzane ręcznie w handlerze.
- `portal.js` ma trzypoziomowy mechanizm autoryzacji (`router.use(wymagajKonta)` od połowy pliku,
  `router.param('spolkaId', ...)`, `router.use(wymagajDostepuDoSpolkiWCiele)`) — złożone, wymaga
  dokładnego sprawdzenia w FAZA 5 czy każda trasa faktycznie jest objęta właściwym gate'em.
- Cały `/api/psa/portal` zwraca 503 gdy `PORTAL_WLACZONY=false`.

## 2. Schemat bazy danych — 26 tabel `psa_*` (z realnie zmigrowanej bazy)

Pełny zrzut kolumn: `testy-audyt/schemat-bazy.txt`. Tabele: psa_dokumenty, psa_dziennik_dostepu,
psa_emisje, psa_konta, psa_konta_spolki, psa_migracje, psa_obciazenia, psa_ograniczenia,
psa_oplaty, psa_osoby, psa_osoby_skany_aml, psa_platnosci, psa_spolki, psa_spolki_dokumenty,
psa_sprawy, psa_stan_akcji, psa_szablony, psa_uprawnienia, psa_ustawienia, psa_uzytkownicy,
psa_wnioski, psa_wnioski_akcjonariusze, psa_wnioski_dokumenty, psa_wydane_dokumenty,
psa_zdarzenia, psa_zgloszenia.

Obserwacje:
- Wyzwalacze `BEFORE UPDATE`/`BEFORE DELETE` na `psa_zdarzenia` (RAISE ABORT) — **egzekwowane na
  poziomie bazy**, nie tylko przez kod aplikacji. Analogiczne wyzwalacze istnieją dla
  `psa_szablony` (`bez_edycji_tresci`, `bez_delete`).
- `czesc_licznik`/`czesc_mianownik` w `psa_stan_akcji` — INTEGER z CHECK wymuszającym
  `czesc_licznik = czesc_mianownik OR nr_od = nr_do`, zgodnie z regułą 4a.
- `psa_osoby.pesel` — nullable, brak `NOT NULL`.
- `psa_osoby` ma DWA zestawy pól PEP: `pep_oswiadczenie`/`pep_oswiadczenie_data` oraz
  `pep`/`pep_opis` (osobno w `psa_wnioski_akcjonariusze` też jest `pep`/`pep_opis`) — możliwa
  pozostałość po zmianie modelu; do sprawdzenia w FAZA 3, czy oba są używane spójnie.
- Wszystkie kwoty jako `_grosze INTEGER` (psa_emisje, psa_oplaty, psa_platnosci, psa_spolki,
  psa_wnioski) — brak kolumn REAL/FLOAT dla pieniędzy.
- Brak `UNIQUE` na PESEL/NIP w `psa_osoby` — potwierdza znalezisko reguły 10 (brak twardej
  deduplikacji kartoteki wspólnej).

## 3. Tabela pokrycia reguł domenowych (sekcja 4, `CLAUDE-PSA.md`)

| # | Reguła (skrót) | Status | Dowód | Uwagi |
|---|---|---|---|---|
| 1 | append-only `psa_zdarzenia` | **TAK** | `migracje.js:216-227` (triggery), `rejestr.js:93-126` (jedyny INSERT) | Wymuszone na poziomie bazy |
| 2 | stan = pochodna zdarzeń, odbudowa=stan bieżący | **TAK** | `stan.js:711-760`, `rejestr.js:139-340` | jedna funkcja materializująca wszędzie |
| 3 | bilans akcji, odmowa zapisu przy naruszeniu | **TAK** | `stan.js:766-872`, `walidacje.js:770-777`, `rejestr.js:418-423` | podwójna warstwa, brak DB CHECK (niemożliwe w SQLite dla agregatu) |
| 4 | numery FIFO, ułamek→numer wskazany | **TAK** | `numery.js:126-184` | — |
| 4a | ułamki INTEGER, CHECK 1 numer/wiersz | **TAK** | `ulamki.js`, `migracje.js:452-453,595-598` | CHECK bazodanowy + aplikacyjny |
| 4b | współuprawnieni, przedstawiciel nieblokujący | **TAK** | `stan.js:501-515`, `walidacje.js:640-658` | — |
| 4c | pokrycie akcji, zgoda przy niepełnym pokryciu, równomierne zaliczanie | **CZĘŚCIOWO** | blokada: `walidacje.js:182-229`; równomierne zaliczanie: **brak implementacji** — `kreator.js:377-392` to ręczna etykieta tak/nie/częściowo | brak algorytmu rozdziału wpłaty na akcje |
| 5 | grosze, zero floatów | **TAK** | wszystkie kolumny `_grosze INTEGER` | — |
| 6 | data_zdarzenia ≠ data_wpisu | **TAK** | `rejestr.js:106` | fallback `\|\|` teoretyczną furtką, obecnie nieużywaną |
| 7 | termin 7 dni w terminy.js, zawieszany | **TAK** | `terminy.js:74-138` | jedyne miejsce liczenia terminu |
| 8 | zajęcie z urzędu, bez opłaty/powiadomienia | **TAK** | `typy-zdarzen.js:234-246`, `rejestr.js:568` | — |
| 9 | maskowanie danych wrażliwych dla innych akcjonariuszy | **TAK** | `maskowanie.js:24-45`, rola z sesji server-side | brak trasy z pominięciem maskowania — do potwierdzenia bezpośrednim żądaniem w FAZA 3/5 |
| 10 | kartoteka wspólna, jeden inwestor raz | **CZĘŚCIOWO** | `psa_osoby` bez `spolka_id` (struktura OK) | brak UNIQUE/dedup na PESEL/NIP — polega na czujności użytkownika |
| 11 | walidacja formy prawnej PSA | **TAK** | `spolki.js:126-130`, `przepisy.ocenFormePrawna` | ta sama funkcja przy tworzeniu i edycji |
| 12 | akcje nie istnieją przed wpisem KRS | **TAK** | `walidacje.js:311-324,334-342,608-613` | `przeniesienie` nie sprawdza wprost, ale niemożliwe bez wcześniejszego `objecie` |
| 13 | wpis deklaratoryjny vs konstytutywny — inna checklista/zawiadomienie | **CZĘŚCIOWO** | klasyfikacja: `przepisy.js:542-594`, zapis: `rejestr.js:541-549` | **etykieta zapisywana, ale nigdzie realnie użyta** — treść zawiadomień i checklisty identyczne niezależnie od charakteru wpisu; dopasowanie fraz przez `includes()` na wolnym tekście — kruche |
| 14 | brak pośrednictwa w płatnościach/dywidendach | **TAK** | brak wyników grep `dywidenda\|wyplata\|rozliczenie\|splat` w modułach płatności | — |

**Zero reguł ocenionych jako NIE.** Trzy CZĘŚCIOWO: 4c (brak algorytmu równomiernego zaliczania
wkładów), 10 (brak deduplikacji osób), 13 (klasyfikacja deklaratoryjny/konstytutywny to martwa
etykieta — najsłabsze ogniwo, bo reguła jest jawnie wymagana w specyfikacji, a jej skutki nigdzie
nie są wdrożone).

## 4. Dane demonstracyjne / seed

- Brak automatycznego seedowania produkcyjnej bazy realnymi/demo rekordami.
- `DANE_PROBNE` (`server/logika/dane-probne.js`) używane wyłącznie do podglądu wzorów pism
  (`trasy/szablony.js`) — nie jest nigdy zapisywane do `psa_*`.
- Jedyny automatyczny zapis przy pustej bazie: konto administratora zakładane przy pierwszym
  starcie z pustą tabelą `psa_uzytkownicy` (`ADMIN_EMAIL` z `.env` + losowe hasło tymczasowe
  wypisywane raz w logu startu).
- `narzedzia/scenariusz-e2e.js` — ręczny skrypt zapisujący realne rekordy przez te same trasy HTTP
  co przeglądarka; komentarz w kodzie ostrzega, by nie uruchamiać go na bazie produkcyjnej.

## 5. Wyzwalacze append-only

Potwierdzone w bazie (nie tylko w kodzie): `psa_zdarzenia_bez_update`, `psa_zdarzenia_bez_delete`
(RAISE ABORT), plus analogiczne dla `psa_szablony`. Będzie to zweryfikowane praktycznie w FAZA 6
(próba UPDATE/DELETE bezpośrednio w bazie).

## 6. Wysyłka poczty

Realny `nodemailer` przez SMTP (`server/poczta.js`). Gdy SMTP nieskonfigurowany — nie rzuca
wyjątku, zwraca `{wyslano:false, powod}`, ślad w `psa_wydane_dokumenty` i tak powstaje (dokument
gotowy do wysyłki ręcznej/papierowej). Brak `console.log` z treścią/danymi.

## 7. Znalezisko dodatkowe spoza checklisty FAZA 0

**Plik `:memory:` zacommitowany w repozytorium** (śledzony przez git, prawdziwy plik SQLite,
71 stron). Przyczyna: `server/konfiguracja.js::sciezka()` zawsze wywołuje `path.resolve()`, nawet
dla specjalnej wartości SQLite `:memory:` — jeśli ktoś ustawi `WSPOLNA_BAZA=:memory:` w `.env`
oczekując efemerycznej bazy w pamięci, dostanie zamiast tego prawdziwy plik na dysku (i, jak
widać, może trafić do repozytorium). Sprawdzona zawartość: wszystkie tabele `psa_*` puste (0
wierszy), tylko `psa_migracje` ma 35 rekordów — **brak wycieku danych osobowych**, ale to dowód na
realny bug konfiguracyjny i lukę w higienie repozytorium (przypadkowy artefakt trafił do gita).
Waga: **POWAŻNY** (błąd konfiguracji + hygiene repo), nie krytyczny (brak danych wrażliwych).

## Status

Inwentaryzacja zakończona. Zgodnie z regułami sesji (`SESJA-PSA-AUDYT.md`, FAZA 0 ⛔ STOP) —
czekam na akceptację przed przejściem do FAZA 1 (ścieżka główna, przeglądarka + Playwright + API).
