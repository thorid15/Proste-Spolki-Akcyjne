# SESJA-PSA-8 — DOMKNIĘCIE PROTOTYPU

Cel: **działający prototyp do testowania wewnętrznego na prawdziwych danych.**
Nie wdrożenie publiczne — to osobna ścieżka, `WDROZENIE-PSA.md`.

Podstawa: `KATALOG-WZOROW-PSA.md`, `PLACEHOLDERY-PSA.md`, `ANALIZA-UMOWA-I-OWU.md`,
`SESJA-PSA-7-ONBOARDING.md`, `WDROZENIE-PSA.md`.

---

## 1. Kryterium ukończenia

Prototyp jest domknięty, gdy Łukasz może **na własnych dwóch rejestrach**:

1. wprowadzić stan otwarcia z prawdziwych danych — ✅ *jest* (kreator migracji),
2. prowadzić bieżące wpisy przez kolejkę spraw — ✅ *jest* (sprinty 1–5),
3. **wygenerować prawdziwe pismo z własnego wzoru, dla konkretnej spółki
   i konkretnego akcjonariusza** — ✅ *jest* (blok A, zamknięty A0–A7),
4. wydać informację z rejestru i raport — ✅ *jest* (sesja 6, faza 4),
5. naliczyć i rozliczyć opłaty — ✅ *jest* (sprint 4),
6. odnotować weryfikację AML z datą przeglądu — ✅ *jest* (blok C, zamknięty C1–C4).

Punkt 3 był jedynym, który blokował sens testu — domknięty. Bloki A, B i C są zamknięte w całości —
prototyp spełnia kryterium ukończenia z sekcji 1.

---

## 2. Stan zastany — ustalenia z inwentaryzacji

Trzy rzeczy wyszły inaczej, niż zakładały pliki wejściowe. Warto je odnotować,
żeby nie zaplanować pracy, która jest już zrobiona.

### 2.1. Automat pism ISTNIEJE — brakuje mu tylko redagowalnej treści

`server/zawiadomienia.js` obsługuje już wszystkie cztery momenty:

| Funkcja | Kiedy | Podstawa |
|---|---|---|
| `powiadomienieUprzednie` | przed wpisem | art. 300³⁴ § 3 |
| `poWpisie` | po wpisie, do żądającego i do spółki | art. 300³⁴ § 7 zd. 1 |
| `wezwanie` | przy wstrzymaniu | art. 300³⁴ § 1 zd. 2 |
| `poOdmowie` | przy niedokonaniu wpisu | art. 300³⁴ § 7 zd. 2 |

Wysyłka, zapis do `psa_wydane_dokumenty` i obsługa braku SMTP — działają.
**Treść pochodzi ze sztywnego `logika/dokumenty-tresc.js`, nie z szablonów.**
Praca do wykonania to podmiana źródła treści, nie budowa mechanizmu.

### 2.2. `ANALIZA-UMOWA-I-OWU.md` A1 — aplikacja jest zgodna, wzory nie

Zarzut A1 (brak trybu wpisu z urzędu, wolnego od opłat, przy zajęciu komorniczym)
**nie dotyczy aplikacji**. Typy `zajecie` i `wykreslenie_zajecia` mają
`z_urzedu = true`, `odplatne = false`, `wymaga_powiadomienia = false` — dokładnie
to, czego wymaga art. 300³⁴ § 2 KSH. Postulowany osobny typ `wpis_z_urzedu` jest
zbędny: tryb jest cechą typu zdarzenia, nie odrębnym typem.

**Wniosek: A1 to poprawka do treści umowy, nie zadanie programistyczne.**

### 2.3. `ANALIZA` A2 — aplikacja nie blokuje wpisu za zaległość

Nigdzie w walidacjach ani w ścieżce wpisu nie ma warunku zapłaty. Zachowanie jest
zgodne z wnioskiem A2 (blokada wobec akcjonariusza byłaby naruszeniem obowiązku
ustawowego). **Nie wprowadzać takiej blokady** przy okazji prac nad opłatami —
gdyby kiedyś pojawił się postulat „wstrzymaj wpisy dłużnikom", to jest miejsce,
w którym trzeba powiedzieć nie.

### 2.4. Czego brakuje w modelu danych

| Pole | Potrzebne dla | Stan |
|---|---|---|
| `osoba.plec` | formy pochodne wzorów (`zamieszkały/zamieszkała`) | BRAK |
| `sprawa.numer` | `{{sprawa_numer}}` — znak sprawy na każdym piśmie | BRAK |
| `sprawa.dokument_rodzaj`, `dokument_data` | wzory 04, 05, 07 | BRAK (dziś wolna `notatka`) |
| `osoba.aml_data_przegladu` | SESJA-7 § 2.5, WDROZENIE § 7 | BRAK |
| `osoba.pep_oswiadczenie`, `beneficjent_rzeczywisty_id` | AML osoba fiz./prawna | BRAK |
| `wydany_dokument.status_doreczenia` | WDROZENIE § 1 | BRAK |
| tabele `psa_onboarding*` | SESJA-7 § 4 | BRAK (całość) |

### 2.5. Trzynaście szablonów wbudowanych to brudnopisy do wyrzucenia

Szablony zasiane w sesji 6 fazie 4 napisał wykonawca. **Zastępuje je dziesięć
wzorów z `KATALOG-WZOROW-PSA.md`.** Po wgraniu wzorów kancelarii brudnopisy
znikają z obiegu (zasiew nigdy nie nadpisuje istniejących wersji).

Uwaga: **klucze mojego silnika i klucze z `PLACEHOLDERY-PSA.md` to dwa różne
słowniki** (`spolka_nazwa` vs `spolka_firma`, `kancelaria_nazwa` vs rozłożone
`kancelaria_*`, brak form przypadków i form pochodnych). Przemapowanie jest
osobną pozycją — blok A2.

---

## 3. Decyzje — PODJĘTE

> Rozstrzygnięte 10.08.2026. Sekcja zachowana wraz z uzasadnieniem, żeby nie
> wracać do tych pytań. Wykonawca implementuje, nie kwestionuje.

| # | Decyzja | Rozstrzygnięcie |
|---|---|---|
| D1 | Format wzorów | **Aplikacja wypełnia `.docx`**, klient dostaje gotowy plik do podpisu. Pliki źródłowe w `wzory/`. **Bez nowej zależności** — patrz niżej |
| D2 | Zakres onboardingu | **Pełny onboarding odłożony.** Do prototypu wystarcza istniejący kreator rejestracji spółki |
| D3 | Automat pism na szablonach | **Tak** — wszystkie cztery pisma z § 2.1 idą przez wzory |
| D4a | Termin przeglądu AML | **12 miesięcy** |
| D4b | Odmowa zawarcia umowy | **Tylko notariusz** — czynność notarialna z obowiązkiem zawiadomienia (art. 108a § 2 Pr. not.) |
| — | OWU | **Zamknięte**: wcielone do umowy (wzór 01), zmiana aneksem. Nie wracać |
| — | Nazwy placeholderów | Wykonawca ma swobodę ujednolicenia — patrz § 3.2 |

### 3.1. Zależność okazała się niepotrzebna

Rekomendowałem wariant `.docx` „za cenę jednej zależności". **Sprawdziłem —
zależność nie jest potrzebna.** Wbudowany w Node `zlib` wystarcza: odczyt
archiwum ZIP, rozpakowanie `word/document.xml`, podstawienie i przepisanie
pliku przechodzą round-trip, a wynik otwiera się jako poprawny `.docx`
(test integralności archiwum bez zastrzeżeń, zero pozostałych `{{`).

Zakaz zależności z master pozostaje więc nienaruszony. Do udokumentowania
w kodzie: obsługujemy metody składowania 0 (bez kompresji) i 8 (deflate),
bez ZIP64 — to pokrywa pliki produkowane przez Worda i przez generatory.

### 3.2. Słownik kluczy — kierunek ujednolicenia

Notariusz przekazał swobodę w nazewnictwie. Przyjmuję kierunek **najtańszy
i najmniej ryzykowny**: bazą zostaje słownik z `PLACEHOLDERY-PSA.md`, bo
przekazywane wzory `.docx` już go używają, a jego konwencja (polski
`snake_case`) jest spójna z resztą aplikacji (`spolka_id`, `data_zdarzenia`,
`zadajacy_rola`).

Ujednolicenie polega więc na **dociągnięciu aplikacji do wzorów**, nie odwrotnie:

- klucze mojego silnika z sesji 6 (`spolka_nazwa`, `kancelaria_nazwa`) —
  **wycofane** na rzecz `spolka_firma`, `kancelaria_*` atomowych;
- uzupełnienie brakujących: formy przypadków, formy pochodne z płci;
- mapa migracji z `PLACEHOLDERY-PSA.md` § 10 wchodzi do kodu jako słownik
  ostrzeżeń — stary klucz we wzorze daje czytelny komunikat, nie ciche pominięcie.

Zmiana nazwy klucza po stronie aplikacji **wymusza regenerację wzoru**, więc
każdą taką zmianę odnotowujemy przy wzorze, którego dotyczy.

---

## 4. Blok A — pisma na prawdziwych danych ⛔ BLOKUJE TEST

| # | Zadanie | Zależy od |
|---|---|---|
| A0 | ✅ **ZROBIONE** — warstwa `.docx`: odczyt i zapis ZIP na `zlib`, podstawianie w `word/document.xml`, trzy tryby sekcji, scalanie rozbitych pól | — |
| A1 | ✅ **ZROBIONE** — `server/logika/wzory-dysk.js` czyta `wzory/*.docx` na żywo (kod = numer z nazwy pliku, hash SHA-256, walidacja); trzynaście brudnopisów z sesji 6 (`szablony-wbudowane.js`, `dokumenty.js`, zasiew w `serwer.js`) usunięte | — |
| A2 | ✅ **CZĘŚCIOWO** — `konfiguracja.js` ma teraz `kancelaria_*`/`notariusz_*` atomowo; `server/logika/dane-probne.js` to port `dane_testowe.py` (99 kluczy). Formy pochodne z `plec` już były (blok B1). **Nie zrobione**: mapa ostrzeżeń o starych kluczach — pominięta świadomie, bo żaden z dziesięciu wzorów nie zawiera starego klucza (sprawdzone `docx.kluczeWzoru`), więc mapowanie nie miałoby dziś czego ostrzegać | A1 |
| A3 | ✅ **ZROBIONE** — `server/logika/kontekst-pisma.js`: cztery funkcje (jedna na wzór 05/06/07/09 — automat pism). Sprawdzone end-to-end na PRAWDZIWYCH plikach z `wzory/`, zero brakujących kluczy. Doszły po drodze: `spolka.organ_rodzaj` (Zarząd/Rada Dyrektorów, migracja v10 — bez tego pola `spolka_organ` na wzorze 07 nie miał skąd się wziąć) i `sprawa.sposob_usuniecia`/`termin_usuniecia` (wzór 06, notariusz wskazuje wprost — ustawa nie narzuca liczby dni). Kontekst dla wzorów 01/02/03/08/10 (jednorazowe/na żądanie) zostaje w A5 | A2, B1–B3 |
| A4 | ✅ **ZROBIONE** — `server/zawiadomienia.js` przepisany na wzory .docx. Klient dostaje plik jako załącznik maila (treść maila to krótkie wprowadzenie + podgląd tekstowy, `poczta.js` obsługuje teraz `zalaczniki`). Plik zapisywany na dysku obok załączników sprawy, hash i ścieżka w `psa_wydane_dokumenty` (migracja v11). Brakujące klucze NIE blokują wysyłki (widoczne „—" w piśmie), ale wracają w odpowiedzi API i pokazują się w UI jako lista do sprawdzenia. Sprawdzone end-to-end: prawdziwy wpis → prawdziwe pismo na dysku, poprawny tekst prawny, poprawne dane z rejestru | A3, D3 |
| A5 | ✅ **ZROBIONE** — pięć wzorów jednorazowych (01 umowa, 02 RODO, 03 uchwała, 08 lista dla sądu, 10 klauzula zbycia) wystawianych z poziomu spółki (`GET/POST /api/psa/spolki/:id/dokumenty/...`) — wszystkie pięć to dokumenty spółki, nie sprawy, więc przycisk jest tylko w kokpicie spółki (karta „Dokumenty"), zgodnie z naturą tych pism. `server/logika/kontekst-pisma.js` dobudowuje kontekst per wzór: 01/02/08 w całości z kartoteki i konfiguracji (`platnik_vat` — migracja v12 — i stawki z `przepisy.STAWKI_GROSZE`), 03/10 przyjmują dodatkowo dane ad hoc z formularza (wynik głosowania, strony i treść klauzuli zbycia — to zdarzenia poza rejestrem, więc nie mają schematu w bazie). Podgląd na REALNYCH danych spółki bez zapisu; wystawienie zapisuje plik `.docx` na dysku i wiersz w `psa_wydane_dokumenty` (migracja v13 rozszerza `typ` o `umowa_rejestru`/`informacja_rodo`/`uchwala_wyboru`/`klauzula_zbycia` — wzór 08 współdzieli istniejący typ `wykaz_akcjonariuszy` z automatem KRS, bo to ten sam dokument prawny wystawiany na żądanie zamiast automatem) z hashem wzoru, `sprawa_id = NULL`. Sprawdzone end-to-end na realnych danych: 22 testy kontekstu + 8 testów HTTP + przejście przez wszystkie 5 wzorów w przeglądarce (podgląd, wystawienie, pobranie pliku), bez błędów konsoli | A3 |
| A6 | ✅ **ZROBIONE** — ekran Konfiguracja → Szablony dokumentów czyta z dysku: lista z walidacją, szczegóły (klucze/sekcje/ostrzeżenia), podgląd na danych próbnych (tekst + pobranie `.docx`), sekcja „Wszystkie dostępne klucze" (pełny słownik, nie tylko użyte) | A2 |
| A7 | ✅ **ZROBIONE** — test end-to-end (`testy/a7-wszystkie-wzory-e2e.test.js`) prowadzi PRAWDZIWE żądania HTTP przez API na jednym, realistycznie wypełnionym rejestrze (spółka z kompletem pól, dwie osoby, otwarcie rejestru, pełen cykl sprawy: weryfikacja → powiadomienie → wstrzymanie → wznowienie → wpis, plus druga sprawa zakończona odmową) i sprawdza, że KAŻDE z dziesięciu pism wystawionych po drodze ma `brakujace: []`. Odkrycie po drodze: **wzór 04 (żądanie dokonania wpisu) nie miał żadnej ścieżki wystawienia** — nie pasował do podziału automat/na-żądanie-ze-spółki z A3/A5 (dotyczy danych KONKRETNEJ sprawy, nie spółki). Dobudowany w całości w ramach A7: `kontekst-pisma.js: zadanieWpisu()` (dane żądającego z kartoteki, podstawa dokumentowa i załączniki z bloku B3/`psa_dokumenty`, opcjonalna zgoda innej osoby — ad hoc, jak zbywca/nabywca w A5, bo rejestr nie ma pola „kto wyraża zgodę"), trasy `GET/POST /api/psa/sprawy/:id/dokumenty/...` (migracja v14 dodaje typ `zadanie_wpisu`), przycisk „Wystaw żądanie wpisu" w ekranie sprawy (`ModalWystawDokumentu` z A5 uogólniony o `bazowyUrl`/`kontekstNazwa`, żeby działał i ze spółki, i ze sprawy). Sprawdzone: 4 nowe testy jednostkowe kontekstu, 2 nowe testy HTTP tras sprawy, pełny e2e test (10/10 wzorów bez braków), przejście przez UI w przeglądarce — bez błędów konsoli. Pełny pakiet: 309/309 | A1–A5 |

---

## 5. Blok B — dane, których wzory wymagają ⛔ BLOKUJE BLOK A

| # | Zadanie | Uzasadnienie |
|---|---|---|
| B1 | ✅ **ZROBIONE** — `osoba.plec` + `server/logika/formy-osobowe.js` (formy pochodne per miejsce użycia, nie per rdzeń słowa) | — |
| B2 | ✅ **ZROBIONE** — `sprawa.numer`, `server/logika/znak-sprawy.js`, format `RA/ROK/NNNN`, nadawany przy założeniu | — |
| B3 | ✅ **ZROBIONE** — `sprawa.dokument_rodzaj` (katalog wspólny z `psa_dokumenty.typ_dokumentu`) + `dokument_data`, oba razem albo żadne | — |
| B4 | ✅ **ZROBIONE** — `spolka.siedziba_miejscownik`, pole edytowalne obok „Miejscowość" | — |
| B5 | ✅ **ZROBIONE** — `sprawa.powod_odmowy_kod` (katalog zamknięty), `powod_odmowy` jako rozwinięcie, obowiązkowe przy kodzie „inna" | — |
| B6 | ✅ **ZROBIONE** — `spolka.reprezentant_*` (biernik, płeć, rodzice, dowód, PESEL, adres, funkcja, sposób reprezentacji) w kroku „Umowa o prowadzenie rejestru" | — |

---

## 6. Blok C — AML ⚠️ NIE BLOKUJE, ale bez tego test jest niepełny

| # | Zadanie | Podstawa |
|---|---|---|
| C1 | ✅ **ZROBIONE** — `psa_osoby.aml_data_przegladu` (migracja v15), odrębna od `aml_data` (pierwotne wykonanie). `server/logika/aml.js: wymagaPrzegladu()` — funkcja czysta, termin 12 miesięcy (decyzja D4a). Sygnał `wymaga_przegladu_aml` wraca z API i pokazuje się jako znacznik w kartotece i w formularzu — dotyczy WYŁĄCZNIE `aml_status='wykonane'` (`brak`/`niemożliwe` mają już własny, wyraźniejszy sygnał). **Świadomie NIE jest to nowa blokada wpisu** — `walidacje.js` w ogóle nie widzi tego pola | SESJA-7 § 2.5, WDROZENIE § 7 |
| C2 | ✅ **ZROBIONE** — `psa_osoby.beneficjent_rzeczywisty_id` (self-referencing FK, migracja v15). Trasa `sprawdzBeneficjenta()` wymusza: tylko dla `typ='prawna'`, cel musi być `typ='fizyczna'` (art. 2 ust. 2 pkt 1 ustawy AML), zakaz samoodwołania. UI: `WyborOsoby` dostał `typFiltr`, żeby wyszukiwarka pokazywała wyłącznie osoby fizyczne | SESJA-7 § 2.5 |
| C3 | ✅ **ZROBIONE** — `psa_osoby.pep_oswiadczenie` (`tak`/`nie`/`NULL` — katalog zamknięty, nigdy zgadywane) + `pep_oswiadczenie_data` (migracja v15). Etykieta w UI i podpowiedź jednoznacznie ramują to jako **oświadczenie składane przez osobę** (art. 46 ustawy AML), nie ocenę kancelarii | art. 46 ustawy AML |
| C4 | ✅ **ZROBIONE** — komentarz przy `przepisy.js: TERMIN_PRZEGLADU_AML_MIESIECY` wprost mówi, że C1–C3 to nadwyżka wobec PRZEPISY-PSA.md § 9 (który jest ⚠️ i nie zawiera żadnego z tych szczegółów) i że żaden z tych elementów nie tworzy nowej blokady — zgodnie z zasadą sprintu 5 | SESJA-7 § 2.5 — żeby za rok nikt nie uznał tego za pomyłkę |

Sprawdzone: 5 testów jednostkowych (`aml.js`, w tym granica 12 miesięcy i pierwszeństwo `aml_data_przegladu` nad `aml_data`) + 4 testy HTTP (`osoby-http.test.js`: walidacja beneficjenta, katalog PEP, sygnał w odpowiedzi) + przejście przez formularz osoby w przeglądarce (znacznik „wymaga przeglądu”, wybór beneficjenta, zapis oświadczenia PEP) — bez błędów konsoli. Pełny pakiet: 318/318.

---

## 7. Blok D — tanie teraz, drogie po zbudowaniu portalu ✅ ROZSTRZYGNIĘTE

Z `WDROZENIE-PSA.md` § 1. Cztery punkty ocenione osobno — model zagrożenia jest
**wyłącznie** „akcjonariusz/spółka portalu widzi cudzy rejestr" (kancelaria zawsze
jedna, „druga kancelaria na tej samej instalacji" świadomie poza zakresem — patrz
§ 8). Weryfikacja, czy spółka nie prowadzi rejestru gdzie indziej, jest oświadczeniem
strony, nie czymś, co system może wymusić.

| # | Decyzja | Uzasadnienie |
|---|---|---|
| D1 | ❌ **SKREŚLONE** — `psa_wydane_dokumenty.wyslano` (znacznik czasu / `NULL`) już dziś jest dokładnie tym, czego wymaga art. 300³⁴ § 7 KSH („niezwłocznie powiadamia" — obowiązkiem jest czynność powiadomienia, nie potwierdzenie odbioru). Automatyczne potwierdzenie odczytu nie istnieje jako wiarygodny mechanizm (MDN ignorowane, piksel śledzący blokowany + problem RODO), a webhooki dostawcy SMTP to nowa zależność, przez którą płynęłyby dane akcjonariuszy. Nie dokładamy `status_doreczenia` | — |
| D2 | ⏸ **ŚWIADOMIE ODŁOŻONE** — wszystkie zapisy już używają `path.relative(KATALOG_DOKUMENTOW, ...)` (sprawdzone w kodzie), więc ścieżki w bazie są już WZGLĘDNE. Przejście na inne składowanie nie wymaga migracji danych ani dziś, ani za rok — to jedyny punkt z całej czwórki, który nie drożeje z czasem. Zrobić przy realnym hostingu | — |
| D3 | ✅ **ZROBIONE** — izolacja portalu, domyślnie odmawiająca. `server/trasy/portal.js`: `router.param('spolkaId', ...)` (Express wywołuje to dla KAŻDEJ trasy z tym parametrem, obecnej i przyszłej — zwykły `router.use()` NIE widzi parametrów ścieżki należących do innych warstw, sprawdzone eksperymentalnie) + `wymagajDostepuDoSpolkiWCiele` dla `spolka_id` w ciele żądania. Odwołania POŚREDNIE (przez `sprawa_id`) idą przez `wczytajSpraweDlaKonta()` — jedyny sposób, w jaki trasa portalu dostaje sprawę do ręki. Test manifestu tras (`blok-d-http.test.js`): jeśli ktoś dopisze trasę, test się wywraca i wymusza świadomą decyzję | — |
| D4 | ✅ **ZROBIONE** — `psa_dziennik_dostepu` (migracja v16), append-only, osobna tabela od `psa_zdarzenia` (łańcuch skrótów treści rejestru zostaje nietknięty). Zakres WĄSKI (decyzja): tylko informacja z rejestru, raport dla sądu, eksport CSV, pobranie pliku — NIE każde wyświetlenie listy/kokpitu, bo to zasypałoby dziennik szumem zamiast odpowiadać na „kto miał wgląd" | — |

Sprawdzone: 3 testy jednostkowe (`dziennik-dostepu.js`) + 9 testów HTTP (`blok-d-http.test.js`:
manifest tras, odrzucenie cudzej spółki przez ścieżkę i przez ciało żądania, brak blokady
własnej spółki, ślad w dzienniku dla wszystkich czterech akcji z zakresu wąskiego) +
weryfikacja na żywym serwerze (eksport CSV, logowanie portalowe, wpis w dzienniku
potwierdzony bezpośrednio w bazie). Pełny pakiet: 330/330.

---

## 8. Świadomie poza zakresem

- **Weryfikacja, czy spółka nie prowadzi rejestru u innego podmiotu** — sprawa
  oświadczenia strony przy zawarciu umowy, nie coś, co aplikacja może wymusić
  (blok D, § 7).
- **Pełny onboarding** (SESJA-7 fazy 1–8) — patrz D2.
- **Hosting, kopie zapasowe, 2FA, testy bezpieczeństwa** (`WDROZENIE` §§ 2–5, 9) —
  dotyczą wystawienia publicznego.
- **Nowelizacja z 18.02.2027** — funkcje są już za bramką daty; wzory w wersji
  na 2027 to osobny pakiet (`PLACEHOLDERY` § 12).
- **Numeracja stron na wydruku** — niemożliwa bez biblioteki PDF; jeżeli D1
  wypadnie na wariant B z zależnością, wrócić do tematu przy okazji.
- **Wzory 11–14** (klauzula dla akcjonariuszy, oświadczenia AML, odmowa zawarcia
  umowy) — po stronie kancelarii, `KATALOG` § „Czego jeszcze nie ma".

---

## 9. Kolejność

```
A0 (warstwa .docx)  ──►  B1–B6 (dane)  ──►  A1–A7 (pisma)  ──►  test na 2 rejestrach
                              │
                              └──►  C1–C4 (AML, równolegle)

Blok D („tanie teraz, drogie potem") — decyzja osobna, do wplecenia w dowolnym
momencie; niekonieczny do testu wewnętrznego, konieczny przed pierwszym
klientem z zewnątrz.

A0 zrobione. Blok B zrobiony w całości (B1–B6). Pliki wzorów są w repozytorium
i dane, których wzory wymagają, są już zbierane — A1 jest odblokowane.
```

### 9.1. Wynik A0 — sprawdzone na prawdziwych wzorach

Warstwa `.docx` (`server/logika/zip.js` + `server/logika/docx.js`, 44 testy)
została puszczona na dziesięciu wzorach z katalogu `wzory/` i na komplecie
danych testowych z `wzory/_generatory/dane_testowe.py`:

- dziesięć na dziesięć wypełnia się **bez jednego brakującego klucza i bez
  błędu**; wynik jest poprawnym archiwum ZIP z poprawnym XML-em,
- części inne niż `word/document.xml` (style, czcionki, nagłówki) przechodzą
  **bajt w bajt** — nie ma jak zepsuć formatowania pisma,
- treść dziewięciu pism jest **znak w znak taka sama**, jak w folderze
  `Przyklad wypelniony`;
- rozbieżność w piśmie 07 wskazuje **błąd generatora pythonowego**, nie
  renderera: python gubi trzywierszowy blok adresata (`{{#adresat_zadajacy}}`
  i `{{#adresat_spolka}}` stoją tam wewnątrz akapitów, a python obsługuje
  sekcje tylko na poziomie całych akapitów). Node renderuje ten blok poprawnie.
  Plik `Przyklad wypelniony/07-…-TEST.docx` jest więc do przegenerowania.

### 9.2. Generatory pythonowe — do czego są, a do czego nie

Do zachowania: `slownik.py` jest źródłem prawdy dla nazw kluczy (zadanie A2),
a `gen_01…gen_10` pozostają narzędziem do przegenerowania wzorów, gdy zmieni
się ich treść. Poza obiegiem: `wypelnij.py` — renderer produkcyjny jest po
stronie aplikacji i jest od niego dokładniejszy (patrz § 9.1). Aplikacja
**nie uruchamia pythona** i nie ma zależności od `python-docx`.

Po bloku A prototyp spełnia kryterium z § 1 i nadaje się do testu na własnych
rejestrach. Blok C domyka obsługę AML, blok D przygotowuje grunt pod wdrożenie.

Po każdym bloku **STOP** i raport — jak w sesjach 6 i 7.
