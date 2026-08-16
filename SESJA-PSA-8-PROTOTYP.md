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
   i konkretnego akcjonariusza** — ❌ *brak, blok A*,
4. wydać informację z rejestru i raport — ✅ *jest* (sesja 6, faza 4),
5. naliczyć i rozliczyć opłaty — ✅ *jest* (sprint 4),
6. odnotować weryfikację AML z datą przeglądu — ⚠️ *częściowo, blok B*.

Punkt 3 jest jedynym, który blokuje sens testu. Reszta to uzupełnienia.

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
| A1 | Wgranie dziesięciu wzorów z `wzory/`; wycofanie brudnopisów z sesji 6 | pliki od Łukasza |
| A2 | Słownik kluczy wg `PLACEHOLDERY-PSA.md`: `kancelaria_*` atomowo, formy przypadków, formy pochodne z `plec`, mapa migracji ze starych kluczy | A1 |
| A3 | Kontekst pisma per typ: żądający, adresat, `wpis_opis`, `dokument_rodzaj`/`data`, `sprawa_numer`, sekcje `adresat_*` i `wpis_konstytutywny`/`deklaratoryjny` | A2, B1–B3 |
| A4 | Przełączenie automatu (`poWpisie`, `powiadomienieUprzednie`, `wezwanie`, `poOdmowie`) na szablony | A3, D3 |
| A5 | Wystawianie na żądanie: przycisk przy sprawie i przy spółce, podgląd na **realnych** danych, zapis do `psa_wydane_dokumenty` z wersją szablonu | A3 |
| A6 | Lista **dostępnych** kluczy w edytorze z wstawianiem w miejscu kursora (dziś widać tylko już użyte) | A2 |
| A7 | Test: każdy z dziesięciu wzorów renderuje się na realnym rejestrze bez ani jednego nieuzupełnionego klucza | A1–A5 |

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
| C1 | `aml_data_przegladu` + sygnał dezaktualizacji w kartotece | SESJA-7 § 2.5, WDROZENIE § 7 |
| C2 | Rozgałęzienie osoba fizyczna / prawna: beneficjent rzeczywisty | SESJA-7 § 2.5 |
| C3 | PEP jako **oświadczenie osoby** z podpisem, nie ocena kancelarii | art. 46 ustawy AML |
| C4 | Komentarz w kodzie: zakres AML jest **świadomą nadwyżką** wobec ustawy | SESJA-7 § 2.5 — żeby za rok nikt nie uznał tego za pomyłkę |

---

## 7. Blok D — tanie teraz, drogie po zbudowaniu portalu ⚠️ DECYZJA

Z `WDROZENIE-PSA.md` § 1. Wszystkie dotykają schematu albo warstwy dostępu, więc
wprowadzenie ich po onboardingu kosztuje wielokrotnie więcej.

| # | Zadanie | Dlaczego teraz |
|---|---|---|
| D1 | `status_doreczenia` per dokument | zawiadomienie w spamie = niewykonany obowiązek z art. 300³⁴ § 7, o którym nie wiemy |
| D2 | Warstwa dostępu do plików jako abstrakcja, nie ścieżki w bazie | przejście na składowanie obiektowe bez migracji repozytorium |
| D3 | Izolacja `spolka_id` wymuszona w warstwie danych | jedno zapomniane ograniczenie = wgląd w cudzy rejestr |
| D4 | Dziennik dostępu do danych osobowych (append-only) | jedyna odpowiedź na „kto miał wgląd" przy incydencie |

Przy teście **wewnętrznym, jednoosobowym** żaden z nich nie jest konieczny.
Przy pierwszym kliencie z zewnątrz — wszystkie cztery.

---

## 8. Świadomie poza zakresem

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
