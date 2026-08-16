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

## 3. Decyzje do podjęcia PRZED startem

### D1. Format wzorów — najważniejsza, przesądza o całym bloku A

`PLACEHOLDERY-PSA.md` § 11 mówi, że wzory `.docx` są **produktem generatorów
Pythona**, nie plikami edytowanymi ręcznie. Źródło prawdy leży więc poza tą
aplikacją. Trzeba ustalić postać przekazania:

| Wariant | Jak działa | Koszt | Cena |
|---|---|---|---|
| **A. Konwersja do HTML** | wzory `.docx` przerabiane raz na szablony w aplikacji; dalsza redakcja w aplikacji | mały | rozjazd z generatorami Pythona; dwa źródła prawdy |
| **B. Aplikacja wypełnia `.docx`** | aplikacja czyta wzór `.docx`, podstawia, zwraca `.docx` | średni/duży | wymaga obsługi ZIP — **jedna zależność** albo własna implementacja |
| **C. Eksport pośredni** | generatory Pythona produkują `.docx` **i** szablon dla aplikacji | średni | jedno źródło prawdy, ale build poza aplikacją |

**Rekomendacja: B, za cenę jednej zależności.** Wariant B jest jedyny, w którym
Łukasz pracuje na dokumencie, który zna, a klient dostaje plik `.docx` gotowy do
podpisu. Master zabrania zależności — więc to świadome odstępstwo do akceptacji,
nie decyzja wykonawcza. Własna implementacja ZIP jest technicznie możliwa
(`zlib` jest wbudowany), ale plik, którego Word nie otworzy, to gorszy problem
niż jedna biblioteka.

**Bez tej decyzji blok A nie rusza.**

### D2. Zakres onboardingu

`SESJA-PSA-7` opisuje pełny przepływ: formularz publiczny bez konta, tokeny,
paczka dokumentów, dwie rundy podpisów, otwarcie rejestru — osiem faz.

**Do testów wewnętrznych na dwóch własnych rejestrach nie jest potrzebny.**
Istniejący kreator rejestracji spółki (sesja 6, faza 3) plus wygenerowanie umowy
i uchwały wystarczają, żeby przejść ścieżkę od zera do otwartego rejestru.

Pełny onboarding to praca pod **klientów zewnętrznych**, czyli już wdrożenie.

**Rekomendacja: minimum teraz, pełna SESJA-7 po decyzji o wdrożeniu.**

### D3. Czy automat przechodzi na szablony

Automat z § 2.1 działa na treści zaszytej w kodzie. Przełączenie daje jedno
miejsce redakcji, ale rusza żywy workflow spraw.

**Rekomendacja: tak, po D1** — inaczej Łukasz redaguje wzory, a klient i tak
dostaje treść wykonawcy.

### D4. Drobne z `SESJA-PSA-7` § 8

- termin przeglądu AML: **12 czy 24 miesiące** (wartość do konfiguracji),
- odmowa zawarcia umowy: **tylko notariusz czy także pracownik** (sugestia pliku: notariusz).

Rozstrzygnięte już gdzie indziej — **nie wracać**: OWU nie istnieją jako osobny
dokument, ich treść jest w umowie (wzór 01), zmiana aneksem. To zamyka pytanie
`SESJA-PSA-7` § 8 pkt 1 i `WDROZENIE` § 8.

---

## 4. Blok A — pisma na prawdziwych danych ⛔ BLOKUJE TEST

| # | Zadanie | Zależy od |
|---|---|---|
| A1 | Wgranie dziesięciu wzorów kancelarii; wycofanie brudnopisów | pliki od Łukasza + D1 |
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
| B1 | `osoba.plec` + wyliczanie form pochodnych | `PLACEHOLDERY` § 1; bez tego „zamieszkały/zamieszkała" zostaje do skreślenia ręcznie |
| B2 | `sprawa.numer` — znak sprawy, generowany przy założeniu (`RA/2026/0042`) | `{{sprawa_numer}}` na każdym piśmie |
| B3 | `sprawa.dokument_rodzaj` (lista zamknięta z `PLACEHOLDERY` § 6) + `dokument_data` | wzory 04, 05, 07 czytają to z jednego miejsca |
| B4 | Formy przypadków spółki i siedziby (`spolka_siedziba_miejscownik` itd.) | pola przy spółce; odmiana algorytmiczna jest zawodna |
| B5 | Katalog przyczyn niedokonania wpisu jako lista zamknięta (`PLACEHOLDERY` § 7) | dziś wolny tekst; przyczyna musi być konkretna, art. 300³⁴ § 7 zd. 2 |
| B6 | Dane reprezentanta spółki podpisującego umowę (wzór 01 § 5) | dziś nie zbieramy |

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
D1 (decyzja o formacie wzorów)  ──►  B1–B6 (dane)  ──►  A1–A7 (pisma)  ──►  test
                                          │
                                          └──►  C1–C4 (AML, równolegle)

D (blok „tanie teraz") — decyzja osobna, można wpleść w dowolnym momencie
```

Po bloku A prototyp spełnia kryterium z § 1 i nadaje się do testu na własnych
rejestrach. Blok C domyka obsługę AML, blok D przygotowuje grunt pod wdrożenie.

Po każdym bloku **STOP** i raport — jak w sesjach 6 i 7.
