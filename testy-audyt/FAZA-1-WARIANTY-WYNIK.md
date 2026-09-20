# FAZA 1 — warianty S2–S6: wynik

> Scenariusz podstawowy (S1) prowadził równolegle inny agent na tej samej bazie testowej
> (`./dane/audyt-test.db`). Ten dokument obejmuje WYŁĄCZNIE warianty S2–S6 z
> `testy-audyt/SESJA-PSA-AUDYT.md`, testowane zarówno przez UI (Playwright) jak i bezpośrednimi
> żądaniami HTTP z pominięciem formularza. Numeracja znalezisk: **Z-050…Z-058**
> (`testy-audyt/ZNALEZISKA.md`).

## Spółki testowe utworzone w tej sesji

| Wariant | ID spółki | Nazwa | KRS testowy |
|---|---|---|---|
| S2 | 1 | Audyt S2 Rada Dyrektorow Prosta Spolka Akcyjna | 0000920002 |
| S3 | 2 | Audyt S3 Osoba Prawna Prosta Spolka Akcyjna | 0000930003 |
| S4 | 3 | Audyt S4 Pokrycie Czesciowe Prosta Spolka Akcyjna | 0000940004 |
| S5 | 4 | Audyt S5 Akcje Nieme Prosta Spolka Akcyjna | 0000950005 |
| S6 | 5 | Audyt S6 Ulamki Akcji Prosta Spolka Akcyjna | 0000960006 |

Wszystkie utworzone bezpośrednimi żądaniami do `/api/psa/spolki/`, `/api/psa/osoby/`,
`/api/psa/spolki/:id/otworz-rejestr` i `/api/psa/spolki/:id/zdarzenia` (kancelaryjne API, sesja
pracownika `audyt@kancelaria.test`) — z pominięciem kreatora UI dla szybkiego postawienia stanu
wyjściowego każdego wariantu, a następnie testowane zarówno przez API jak i przez przeglądarkę.

## S2 — rada dyrektorów zamiast zarządu

**Przetestowano:** utworzenie spółki z `organ_rodzaj: "rada_dyrektorow"`; pełna ścieżka zdarzeń
(emisja → objęcie → przeniesienie akcji przez sprawę → zawiadomienia); treść wygenerowanych
dokumentów: „Umowa o prowadzenie rejestru" (wzór 01), „Zawiadomienie o dokonaniu wpisu" do spółki
(wzór 07) i „Lista akcjonariuszy do sądu"/„Wykaz akcjonariuszy"; przeszukanie treści WSZYSTKICH 10
wzorów `.docx` pod kątem twardo wpisanego „zarząd"; UI: kokpit spółki, formularz edycji danych
spółki (pole „Organ zarządzający").

**Wynik:** mechanizm `{{spolka_organ}}`/`{{spolka_organ_czlonkowie}}` działa poprawnie we
wszystkich sprawdzonych dokumentach — żadnego twardo wpisanego „zarząd" przy wybranej radzie
dyrektorów. Jedyny drobny brak: kokpit spółki (widok roboczy) nie pokazuje wybranego organu —
widoczny wyłącznie w formularzu edycji.

**Znaleziska:** Z-050 (pozytywne, z dopiskiem o braku widoczności w kokpicie).

## S3 — akcjonariusz osoba prawna

**Przetestowano:** utworzenie osoby `typ: "prawna"` bez PESEL/daty urodzenia; walidację krzyżową
`beneficjent_rzeczywisty_id` (musi wskazywać osobę fizyczną, tylko dla `typ="prawna"`, nie może
wskazywać samego siebie) — w obie strony poprawne/niepoprawne przypadki; UI formularza „Nowa osoba
w kartotece" w obu trybach (fizyczna/prawna); wpływ przełącznika `stosuje_procedure_aml` per spółka
na dostępność i wymagalność pola beneficjenta.

**Wynik:** rozróżnienie typu działa poprawnie (formularz, walidacje, `jawny_identyfikator` = numer
KRS zamiast PESEL-u, brak żądania PESEL/daty urodzenia dla osoby prawnej). Luka: pole beneficjenta
rzeczywistego jest w pełni opcjonalne i nie generuje żadnego ostrzeżenia (nawet miękkiego) przy
braku, niezależnie od tego, czy spółka ma włączoną procedurę AML — podstawa prawna tego wymogu jest
w `PRZEPISY-PSA.md` oznaczona ⚠️ (niepotwierdzona), więc nie może dziś być podstawą blokady; zgodnie
z zasadami sesji zapisałem to jako pytanie do Łukasza, nie jako pewny błąd.

**Znaleziska:** Z-052 (pozytywne), Z-053 (drobny/pytanie) → P-001 w `PYTANIA-DO-LUKASZA.md`.

## S4 — akcje nie w pełni pokryte

**Przetestowano:** (a) zapisywalność i widoczność wzmianki o pokryciu (`pokryta: "czesciowo"`) w
dokumencie „Informacja z rejestru"; (b) bezpośrednia próba `POST /api/psa/spolki/:id/zdarzenia`
(przeniesienie akcji nie w pełni pokrytych) bez `zgoda_spolki_niepelne_pokrycie` — oczekiwano i
otrzymano twardą blokadę HTTP 422; (c) próba wstrzyknięcia pól pieniężnych (`kwota_wplaty_grosze`
itp.) do zdarzenia `objecie` — zignorowane, brak jakiegokolwiek pola do zapisania kwoty wpłaty,
potwierdzając praktycznie znalezisko FAZA 0 (reguła 4c „CZĘŚCIOWO" — brak algorytmu równomiernego
zaliczania wkładów, bo nie ma nawet DANYCH o kwocie); (d) **kluczowy test dodatkowy**: czy blokada z
(b) utrzymuje się przy KOLEJNYM przeniesieniu tych samych akcji (po legalnym obejściu za zgodą
spółki) — NIE utrzymuje się.

**Wynik:** blokada zbycia niepokrytych akcji bez zgody spółki działa poprawnie na poziomie API przy
PIERWSZYM przeniesieniu, ale wzmianka o niepełnym pokryciu **znika** po zwykłym (całościowym)
`przeniesienie` — atrybut `pokryta` nie jest przenoszony na nabywcę, w przeciwieństwie do
`przeniesienie_ulamka`, które robi to poprawnie. Skutek: druga i każda kolejna transakcja na tych
samych, wciąż nieopłaconych akcjach przechodzi już bez żadnej zgody i ostrzeżenia.

**Znaleziska:** Z-054 (KRYTYCZNY — najpoważniejsze znalezisko tej fazy), Z-058 (POWAŻNY — wzmianka
o pokryciu w ogóle nie jest widoczna w kokpicie roboczym, tylko na wydruku).

## S5 — akcje uprzywilejowane i nieme

**Przetestowano:** utworzenie emisji z `rodzaj_akcji: "niema"` obok zwykłej; widoczność rodzaju akcji
w „Informacji z rejestru" (poprawna — kolumna „Rodzaj akcji" pokazuje „Niema"); wpływ na liczbę
głosów w dokumencie „Uchwała o wyborze notariusza" (wzór 03, sekcja `{{#akcjonariusze}}` wspólna z
wzorem 08 „Lista akcjonariuszy do sądu"); widoczność rodzaju akcji w kokpicie roboczym (brak).

**Wynik:** `rodzaj_akcji` jest poprawnie zbierane i poprawnie drukowane na „Informacji z rejestru",
ale nie ma ŻADNEGO wpływu na liczbę głosów — akcja niema daje dokładnie tyle samo głosów co akcja
zwykła (kod wprost to dokumentuje jako świadome uproszczenie). Nie jest jasne bez decyzji Łukasza,
czy to w ogóle powinno mieć znaczenie ustawowe w P.S.A. (brak odpowiednika art. 351/352 KSH S.A. w
Dziale IA) — zapisane jako pytanie.

**Znaleziska:** Z-055 (POWAŻNY + pytanie), P-002 w `PYTANIA-DO-LUKASZA.md`.

## S6 — ułamkowa część akcji

**Przetestowano:** (a) utworzenie stanu 1/3+1/3+1/3 akcji nr 96 między trzema współuprawnionymi
przez `przeniesienie_ulamka`; (b) próba przekroczenia sumy 1 (zbywca posiadający 1/3 próbujący
zbyć 1/2) — zablokowane; (c) próba przypisania ułamka do zakresu numerów (`nr_od`/`nr_do` zamiast
pojedynczego `nr`) — zablokowane, bo endpoint nie odczytuje w ogóle takich pól; próba podwójnego
objęcia tego samego pojedynczego numeru przez dwie osoby — zablokowana przez pulę wolnych numerów;
(d) wpływ na liczbę głosów w uchwale (wzór 03) — PRZED i PO ustanowieniu wspólnego przedstawiciela;
dodatkowo sprawdzone bezpośrednio w UI (kokpit, widok „Szczegółowy").

**Wynik:** (a)-(c) — reguła 3/4a (bilans akcji, ułamek tylko na pojedynczym numerze) jest
egzekwowana solidnie, na wielu niezależnych warstwach (aplikacyjnej i przez CHECK bazodanowy),
niepoprawnej sumy nie da się w ogóle zacząć zapisywać przez API. (d) — **poważny błąd**: jedna
fizyczna akcja podzielona ułamkowo generuje TRZY pełne, niezależne głosy w uchwale akcjonariuszy
zamiast jednego głosu wspólnego przedstawiciela — potwierdzone zarówno w dokumencie, jak i na żywo
w UI kokpitu (tabela pokazuje „Razem: 103" zamiast poprawnych 101 objętych akcji). Ten sam błąd
źródłowy (`n.ilosc()` niewrażliwe na ułamki) zniekształca też procent udziału na „Informacji z
rejestru" wszędzie, gdzie występuje współwłasność ułamkowa.

**Znaleziska:** Z-056 (pozytywne, a-c), Z-057 (KRYTYCZNY, d — drugie najpoważniejsze znalezisko tej
fazy).

## Lista znalezisk (ten agent, zakres Z-050…Z-079)

| ID | Waga | Skrót |
|---|---|---|
| Z-050 | POZYTYWNE | S2: organ (rada dyrektorów) poprawnie adresowany we wszystkich dokumentach |
| Z-051 | DROBNY | Procent bez zaokrąglenia w „Wykaz akcjonariuszy" i `stan.csv` (znalezisko przy okazji S2) |
| Z-052 | POZYTYWNE | S3: osoba prawna poprawnie rozróżniona od fizycznej |
| Z-053 | DROBNY/PYTANIE | S3: brak jakiegokolwiek ostrzeżenia przy braku beneficjenta rzeczywistego |
| Z-054 | **KRYTYCZNY** | S4: wzmianka o niepełnym pokryciu znika po przeniesieniu — blokada z art. 300⁴⁰ omijalna od drugiej transakcji |
| Z-055 | POWAŻNY | S5: `rodzaj_akcji` (w tym „niema") bez wpływu na liczbę głosów |
| Z-056 | POZYTYWNE | S6(a-c): ułamki — tworzenie, blokada nadmiarowej sumy, blokada zakresu numerów |
| Z-057 | **KRYTYCZNY** | S6(d): akcja ułamkowa = trzy pełne głosy zamiast jednego wspólnego |
| Z-058 | POWAŻNY | Kokpit roboczy nie pokazuje pokrycia ani rodzaju akcji (tylko wydruk) |

Dodatkowo: **P-001** (beneficjent rzeczywisty — czy wymagany) i **P-002** (akcja niema — czy z
mocy ustawy bez głosu, czy tylko z umowy spółki) w `testy-audyt/PYTANIA-DO-LUKASZA.md`.

## Zrzuty ekranu

Katalog `testy-audyt/zrzuty/faza1-warianty/`:
- `S2-01-rada-dyrektorow-kokpit.png` — kokpit spółki S2 (organ niewidoczny w tym widoku, patrz Z-050).
- `S3-01-osoba-prawna-kokpit.png` — kokpit S3, wiersz osoby prawnej z KRS zamiast PESEL.
- `S3-02-dodaj-akcjonariusza-modal.png` — modal wyboru sposobu nabycia akcji (kreator zdarzenia).
- `S3-02-nowa-osoba-fizyczna.png` / `S3-03-nowa-osoba-prawna.png` — formularz „Nowa osoba w
  kartotece" w obu trybach — widać różnicę pól (PESEL/data urodzenia/płeć znikają dla osoby
  prawnej, pojawia się Nazwa/Numer w rejestrze/NIP/REGON).
- `S4-01-pokrycie-czesciowe-kokpit.png` — kokpit S4, brak kolumny „Pokrycie" (Z-058).
- `S5-01-akcje-nieme-kokpit.png` / `S5-02-rejestr-akcji-rozwiniety.png` — kokpit S5, brak kolumny
  „Rodzaj akcji" w obu tabelach (Z-058).
- `S6-01-ulamki-akcji-kokpit.png` / `S6-02-ulamki-widok-szczegolowy.png` — kokpit S6, widoczne na
  żywo potrójne liczenie akcji nr 96 („Razem: 103" zamiast 101) — dowód wizualny do Z-057.

## Czego nie udało się przetestować / ograniczenia

- **Zewnętrzne API KRS** (`KRS_API_URL`, `api-krs.ms.gov.pl`) jest niedostępne z tego środowiska
  (potwierdzone: `curl` zwraca błąd połączenia / kod 000). Wszystkie dane spółek testowych zostały
  wypełnione ręcznie w żądaniach zamiast przez import z KRS — krok „import z KRS" (S1, wspólny dla
  wszystkich wariantów) nie został przetestowany w tej sesji; polegam na tym, że wykonał go
  równoległy agent w ramach S1.
- **Ścieżka portalu klienta (formularz publiczny, kreator wniosku)** nie została użyta do
  postawienia spółek testowych S2–S6 — zamiast tego użyłem bezpośrednich żądań do API
  kancelaryjnego (`/api/psa/spolki/`, `/api/psa/spolki/:id/otworz-rejestr`,
  `/api/psa/spolki/:id/zdarzenia`), zgodnie z sugestią w poleceniu sesji („od otwarcia rejestru
  wprowadź już zmiany właściwe dla danego wariantu ręcznie przez API"). Nie sprawdziłem więc, czy
  formularz PORTALU KLIENTA (a nie tylko API kancelaryjne) poprawnie obsługuje: wybór rady
  dyrektorów, dodanie akcjonariusza-osoby prawnej z polem beneficjenta, wybór rodzaju akcji ani
  ułamków — to inny formularz (`publiczne/js/portal.js`) niż ten, którego pola sprawdziłem
  (`publiczne/js/spolki.js`, `publiczne/js/osoby.js`, oba w części kancelaryjnej). Wynika z tego
  ryzyko, że formularz PUBLICZNY mógłby mieć inne (gorsze) zachowanie niż API — nie zweryfikowane.
- **Nie próbowałem obejść walidacji przez bezpośredni zapis SQL do bazy** (np. ręczne `INSERT`
  do `psa_stan_akcji` z sumą ułamków ≠ 1) — sesja ogranicza modyfikacje bazy wyłącznie do działań
  przez API aplikacji, więc CHECK bazodanowy jako „druga linia obrony" nie został wprost
  wyćwiczony, tylko potwierdzony czytaniem `migracje.js`.
- **Nie przetestowałem wpływu `zakaz_glosu_zastawnika_umowa` ani innych postanowień umowy spółki**
  na akcje nieme (P-002) — to należałoby zrobić dopiero po odpowiedzi Łukasza, bo dziś nie ma pola
  „pozbawiona głosu z umowy" per emisja/seria.
- **Nie sprawdziłem wzorów 05 (powiadomienie o zamierzonym wpisie), 06 (wezwanie do uzupełnienia)
  i 09 (zawiadomienie o odmowie) pod kątem organu z S2** — z przeglądu treści `.docx` (FAZA 0)
  żaden nie zawiera frazy „zarząd", ale nie wygenerowałem ich na żywych danych rady dyrektorów.
