# Etap 0 — weryfikacja i plan (aktualizacja rejestru PSA po porównaniu z KRN)

**Stan:** raport bez zmian w kodzie. Czeka na akceptację i odpowiedzi na pytania z sekcji A.
**Wejście:** `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (decyzje), `docs/krn/POROWNANIE-KRN-PSA.md`,
`docs/krn/Inwentaryzacja_Rejestr_PSA.md`.
**Testy przed zmianami:** 495/511 przechodzi. Wszystkie 16 błędów pochodzi z jednego pliku,
`testy/kontekst-pisma.test.js`, i mają jedną przyczynę: `no such table: psa_ustawienia` w bazie
testowej. Błąd istniał już wcześniej i nie wiąże się z tym zadaniem. Proponuję naprawić go w
etapie 1, żeby kryterium „testy przechodzą” było sprawdzalne.

---

## A. Kolizje i pytania — potrzebna decyzja przed etapem 1

### A1. Znaczniki czasu: UTC czy obecny zapis z przesunięciem strefy (D-R01) — **koliduje z kodem**
Dziś `data_wpisu` to czas lokalny z przesunięciem, np. `2026-10-06T14:00:00+02:00`
(`server/pomocnicze/czas.js`). Jest tak samo jednoznaczny jak UTC. `data_wpisu` wchodzi do
hasha, więc starych rekordów nie da się przepisać na UTC. Po zmianie w łańcuchu byłyby więc dwa
formaty naraz. Wtedy przestałoby działać porównywanie i sortowanie tekstowe, a „dzień lokalny”
nie dałby się już odczytać z pierwszych 10 znaków.
**Propozycja:** zostawić zapis ISO z przesunięciem strefy. Wymóg D-R01 („nie powtarzać błędu KRN
z godziną 02:00”) jest spełniony, bo daty dzienne są czystym `RRRR-MM-DD`, a znaczniki niosą
strefę. Prezentacja zawsze w Europe/Warsaw.

### A2. Co robimy z `data_zdarzenia` w nowych zdarzeniach (D-R01, uzasadnienie wyboru)
Kolumna ma w schemacie `NOT NULL` i wchodzi do hasha jako `String(data_zdarzenia)`.
- **(a) `NULL`**: format hasha się nie zmienia (`String(null)` = `"null"`). Wymaga jednak
  przebudowy tabeli `psa_zdarzenia`, żeby zdjąć `NOT NULL` (SQLite nie zmienia ograniczeń przez
  `ALTER`). To kopia tabeli łańcucha i ponowne założenie wyzwalaczy append-only. Wartości i hashe
  zostają te same, ale ruszamy tabelę-źródło prawdy.
- **(b) wartość pochodna**: nowe zdarzenia zapisują w tej kolumnie dzień z `data_wpisu`. Nie
  zbieramy jej, nie walidujemy, nie wyświetlamy i nie używamy w logice. Schemat, format hasha i
  weryfikacja łańcucha zostają bez zmian.
**Rekomendacja: (b)**, bo nie dotyka tabeli łańcucha. Formalnie odbiega jednak od sformułowania
„nowe zdarzenia go nie zapisują”, dlatego potrzebna jest zgoda. Jeżeli ma być ściśle według
decyzji, wybieramy (a).

### A3. Zdarzenia już zapisane ze „stanu otwarcia” (migracja z KRN) — **koliduje z D-R01**
Ekran „Migracja — stan otwarcia” (`publiczne/js/migracja.js`) zapisywał dotąd zdarzenia z
**historyczną `data_zdarzenia`** i `data_wpisu` = chwila wprowadzenia. Gdy stan zacznie się liczyć
od chwili wpisu, historia sprzed dnia wprowadzenia zniknie, a `data_wpisu` nie można poprawić
(hash). Nowe migracje obsługujemy według wyjątku z D-R01: historyczna data rejestracji z KRN jako
`data_wpisu` i znacznik migracji w treści zdarzenia, czyli objęty hashem.
**Pytanie:** czy w bazie produkcyjnej jest spółka, dla której wprowadzono już stan otwarcia? Jeżeli
tak, potrzebuję jej ID. Proponuję jawną listę takich zdarzeń w konfiguracji: dla nich chwilą
skuteczności będzie `data_zdarzenia`. Nie będę ich rozpoznawał heurystyką. Jeżeli takich spółek
nie ma, problem nie istnieje.

### A4. „Data dokumentu” sprawy (`psa_sprawy.dokument_data`) — do potwierdzenia
To osobne pole od `data_zdarzenia`: data dokumentu będącego podstawą wpisu, np. „umowa sprzedaży
akcji z dnia …”. Drukuje się w zawiadomieniach i identyfikuje dokument (art. 300³⁴ § 4–5).
**Propozycja:** zostaje, bo nie jest „datą zdarzenia” w rozumieniu D-R01 i nie wpływa na stan.
Proszę o potwierdzenie.

### A5. Sprostowanie a „stan na dzień” — informacyjnie, zgodne z kryterium
Przy stanie liczonym „ze zdarzeń wpisanych do końca dnia D” sprostowanie wpisane po dniu D nie
zmienia informacji „stan na D”. Kryterium niezmienności informacji jest więc spełnione. Skutek
uboczny: informacja na dzień sprzed sprostowania pokazuje wpis błędny, bo taki był wtedy stan
rejestru. Na dni od sprostowania pokazuje wpis poprawiony, z datą wpisu **pierwotnego** zdarzenia.
Tak to zaimplementuję, chyba że Pan zdecyduje inaczej.

### A6. Liczba głosów jest używana gdzie indziej (D-R06)
Pole `glosy` liczy `akcjonariatNaDzien()` w `server/logika/stan.js:1059`. **Nie jest dziś
wyświetlane** ani w kokpicie, ani na informacji z rejestru, ani w eksportach. Jedyne użycie to
**wzór 03 — uchwała o wyborze notariusza**: `server/logika/kontekst-pisma.js:398` →
`akcjonariusz_liczba_glosow`, `wzory/_generatory/gen_03_uchwala.py:58`. Na uchwale liczba głosów
ma znaczenie, bo akcjonariusze głosują.
**Propozycja:** obliczenie zostaje wyłącznie na potrzeby wzoru 03. Nie dodaję go nigdzie indziej i
usuwam `glosy` z odpowiedzi API kokpitu i portalu (`server/widoki.js`). Jeżeli głosy mają zniknąć
także z uchwały, proszę o wyraźną decyzję.

### A7. Cytaty ustawowe — nie potwierdziłem w ISAP
Polityka sieci tego środowiska blokuje `isap.sejm.gov.pl` i `api.sejm.gov.pl` (403). Źródło
projektu (`PRZEPISY-PSA.md`) wskazuje, że **art. 300³⁵ § 1¹ i art. 300³² § 3 KSH pochodzą z
nowelizacji z 23.01.2026 (Dz.U. 2026 poz. 176), która wchodzi w życie 18.02.2027**. To tłumaczy,
dlaczego w tekście jednolitym, który Pan sprawdzał, art. 300³⁵ ma § 1–3, a art. 300³² § 1–2.
Nowelizacja jeszcze nie obowiązuje. Proszę o weryfikację Dz.U. 2026 poz. 176. Jeżeli nie potwierdzi
Pan tych jednostek, trzeba zmienić cytaty w miejscach wymienionych w sekcji B10.
Dostęp można odblokować w ustawieniach środowiska (Network access → dozwolone domeny
`isap.sejm.gov.pl`, `api.sejm.gov.pl`).

---

## B. Odpowiedzi na punkty 1–10

### B1. `data_zdarzenia` — gdzie jest
- **Hash:** tak, wchodzi do skrótu (`server/logika/lancuch.js`, `skrot()`: `id | spolka_id | typ |
  data_zdarzenia | data_wpisu | autor | dane_json | hash_poprzedni`). Kolumna `NOT NULL`
  (`server/migracje.js:91`).
- **Zbieranie (UI):** kreator sprawy `publiczne/js/sprawy.js:529` (domyślnie dzień wpływu),
  migracja `publiczne/js/migracja.js:17,36,45`, otwarcie rejestru `publiczne/js/spolki.js:429–484`
  (data emisji / data otwarcia).
- **Zbieranie (API):** `server/trasy/sprawy.js:337–403` (podgląd, wpis), `server/trasy/spolki.js:655–724`
  (bezpośrednie zdarzenia, podgląd), `:792` (otwarcie rejestru), `:455` (zmiana danych spółki =
  dziś), `server/trasy/zdarzenia.js:58–75` (sprostowanie).
- **Walidacja:** `server/logika/walidacje.js`: `sprawdzDate` (format, nie z przyszłości, nie przed
  utworzeniem spółki), `sprawdzChronologie` (nie wcześniej niż ostatnie zdarzenie na tych akcjach),
  blokady obciążeń „na dzień”, komunikaty „nie posiada akcji na dzień …” (`:436, :467, :497, :521,
  :574, :682`).
- **Logika stanu:** `server/logika/stan.js`: kolejność zdarzeń (`porownajZdarzenia`, sortowanie
  po `data_zdarzenia`, potem `id`), każdy handler ustawia `data_od/data_do` przedziałów i obciążeń
  z `data_zdarzenia` (`:367–730`), `data_emisji` domyślnie z `data_zdarzenia`.
  `server/rejestr.js:49`: `ORDER BY data_zdarzenia`.
- **Kreator:** `server/logika/kreator.js:142–417`: blokady obciążeń „na dzień zdarzenia”.
- **Widoki:** `server/widoki.js:49–80`: tryb „stan na dzień” filtruje przedziały po
  `data_zdarzenia`, a tryb „stan na chwilę” (`…T…`) po `data_wpisu`. `:221` — oś czasu.
- **Dokumenty i zawiadomienia:** `server/zawiadomienia.js:126` (stan do zawiadomienia i listy
  akcjonariuszy „na dzień zdarzenia”), `:181`; `server/logika/dokumenty-tresc.js:125` (drukuje
  datę zdarzenia).
- **Pulpit/portal:** „ostatnia zmiana” = `MAX(data_zdarzenia)`: `server/trasy/spolki.js:208`,
  `server/trasy/pozostale.js:173`, `server/trasy/portal.js:1396`. Kokpit: `publiczne/js/kokpit.js:1039,1110`.
- **Terminy, opłaty, eksport:** `data_zdarzenia` nie jest używana (termin 7 dni biegnie od
  `data_wplywu`, opłaty od dat sprawy i otwarcia).
- Narzędzie `narzedzia/scenariusz-e2e.js` (4 użycia) i testy do dostosowania.

### B2. Data wpisu
- Powstaje w `server/rejestr.js:106`: `data_wpisu: zdarzenie.data_wpisu || czas.terazIso()`.
  Funkcja **dopuszcza** wartość od wywołującego, ale dziś żadna ścieżka API jej nie przekazuje,
  więc w praktyce jest systemowa. Nie ma ścieżki edycji (wyzwalacz append-only). Zamknę furtkę:
  wartość od wywołującego tylko dla zdarzenia migracyjnego (A3).
- `data_od` przy przeniesieniu i objęciu = `zdarzenie.data_zdarzenia` (`stan.js:384, 399, 420`).
  Kreator nie podstawia daty wpisu. Przy przeniesieniu kreator sprawy proponuje dzień wpływu, który
  użytkownik może zmienić.
- Podział transzy: pozostałość u zbywcy **zachowuje pierwotną datę nabycia** (`stan.js`,
  `zdejmij()`). To jest już zgodne z D-R01.

### B3. `glosy` — zob. A6.

### B4. `data_utworzenia_spolki`
Faktycznie przechowuje **datę rejestracji w KRS**. Import z API KRS bierze
`dataRejestracjiWKRS` (`server/trasy/krs.js:127`), formularz spółki ma etykietę „Data
rejestracji w KRS” (`publiczne/js/spolki.js:575`), a otwarcie rejestru przyjmuje ją jako
`data_wpisu_krs` emisji założycielskiej (`spolki.js:439`). Informacja drukuje ją jako „Data
zarejestrowania spółki”. **D-R02a jest spełnione.** Jedyna rozbieżność to myląca nazwa kolumny.
Proponuję jej **nie** zmieniać (ryzyko przy migracji), tylko dopisać komentarz w schemacie i w
`CLAUDE-PSA.md`.

### B5. Blokada zmiany emisji po objęciu
**Nie ma dedykowanej blokady.** Sprostowanie emisji przechodzi przez pełną walidację i ponowne
przeliczenie (`server/rejestr.js:594–650`). Zmiana psująca objęte akcje, czyli zmniejszenie liczby
akcji albo przesunięcie numeracji, zostaje odrzucona dopiero komunikatem technicznym „Bilans akcji:
…” albo „Brak pokrycia dla zakresu …”. **Zwiększenie** liczby akcji i **zmiana oznaczenia serii**
przechodzą. D-P3 wymaga nowej reguły.

### B6. Waluta
Backend ją przyjmuje (`server/logika/kreator.js:125`, domyślnie PLN), ale **UI nie ma wyboru
waluty**. Formularz emisji jej nie pokazuje, a `publiczne/js/formaty.js:75` zawsze dopisuje „zł”.
Poza zakresem decyzji. Zgłaszam, bo D-R04 drukuje „cenę emisyjną z walutą” — na informacji użyję
`waluta` z rekordu, a nie stałego „zł”.

### B7. Wyszukiwanie
Lista spółek szuka tylko po nazwie, KRS i NIP (`server/trasy/spolki.js:187–190`). **Nie** szuka po
akcjonariuszach. Tylko zgłaszam.

### B8. Numeracja od numeru innego niż 1
Obsługiwana w emisji (`kreator.js:109`, formularz `publiczne/js/kreator.js:317`), w obejmowaniu i na
informacji (zakres z `n.zakresEmisji`). Testy z `nr_pierwszy > 1` są w `testy/numery.test.js` i
`testy/sprint5.test.js`. W etapie 6 dodam test scenariusza KRN (AN 1–25, AZ 26–100) przez cały cykl.

### B9. Walidacja nabywca ≠ zbywca
Obejmuje `przeniesienie` (`walidacje.js:442`) — w tym sprzedaż, darowiznę, dziedziczenie, aport i
zapis windykacyjny, bo to jeden typ zdarzenia z `tytul_prawny` — oraz `przeniesienie_ulamka`
(`:663`). Pozostałe typy nie mają pary zbywca–nabywca. Zobowiązanie do przeniesienia
(`zobowiazanie`, `:639`) proponuję objąć tą samą regułą w etapie 5, jeżeli ma nabywcę — sprawdzę
przy wdrożeniu.

### B10. Miejsca cytujące art. 300³⁵ § 1¹ i art. 300³² § 3 (do zmiany, gdyby nie zostały potwierdzone)
**Widoczne dla użytkownika / na dokumentach:**
- `server/logika/przepisy.js:754` — `PODSTAWY.MASKOWANIE = 'art. 300(35) § 1(1) KSH'` (etykieta w UI/dokumentach)
- `publiczne/js/wydruk.js:134` — dopisek na wydruku
- `server/logika/dokumenty-tresc.js:281` — treść zawiadomienia sądu („na podstawie art. 300(32) § 3 …”)
- `server/trasy/pozostale.js:367` — podstawa dokumentu „zawiadomienie sądu”

**Komentarze w kodzie:** `server/logika/przepisy.js:50, 216, 302`; `server/logika/dokumenty-tresc.js:223, 271`;
`server/trasy/pozostale.js:359`; `server/trasy/osoby.js:82`; `server/logika/maskowanie.js:4`; `server/migracje.js:405`.
**Testy:** `testy/informacja-dokument.test.js`, `testy/blok-d-http.test.js`.
**Dokumentacja:** `PRZEPISY-PSA.md`, `CLAUDE-PSA.md`, `PRZEJECIE-REJESTRU.md`, `README.md`,
`testy-audyt/*` (ZNALEZISKA, SESJA-PSA-AUDYT, RAPORT, FAZA-3-WYNIK).

---

## C. Plan etapów 1–6

Każdy etap kończy się testami, osobnym commitem i wpisem `D-0xx` w `DECYZJE.md` z odesłaniem do
identyfikatora decyzji (D-R01…). Migracje schematu są addytywne. Nie zmieniamy żadnego zapisanego
zdarzenia.

### Etap 1 — D-R01: chwila wpisu jako jedyna oś czasu
- `server/logika/stan.js`: kolejność zdarzeń po (chwila wpisu, `id`). Przedziały, obciążenia,
  uprawnienia i ograniczenia dostają `data_od/data_do` = chwila wpisu (pełny znacznik). Wydzielona
  funkcja `chwilaSkutecznosci(z)`: `data_wpisu`, a dla zdarzeń z listy A3 — `data_zdarzenia`.
- `server/widoki.js`: „stan na dzień D” = odtworzenie ze zdarzeń wpisanych do 23:59:59 dnia D
  (Europe/Warsaw); dzień bieżący = do chwili sporządzenia. Jedna semantyka zamiast dwóch.
- `server/rejestr.js`: `ORDER BY data_wpisu, id`; `zapiszZdarzenie` ignoruje `data_wpisu` od
  wywołującego poza zdarzeniem migracyjnym; nowe zdarzenia według A2.
- `server/logika/walidacje.js`: usunięcie `sprawdzDate`/`sprawdzChronologie` w części dotyczącej
  daty zdarzenia, blokady i komunikaty „na chwilę wpisu”; odrzucenie próby przekazania daty wpisu.
- `server/logika/kreator.js`, `server/trasy/{sprawy,spolki,zdarzenia,portal,pozostale}.js`: bez
  `data_zdarzenia` w wejściu; „ostatnia zmiana” = `MAX(data_wpisu)`.
- `server/zawiadomienia.js`, `server/logika/dokumenty-tresc.js`: stan i data = chwila wpisu.
- UI: `publiczne/js/{sprawy,migracja,spolki,kokpit}.js`: usunięcie pola daty zdarzenia. Migracja
  zbiera datę i godzinę rejestracji z KRN (tylko przy pustym rejestrze, sprawdzane też na backendzie).
- `POST /spolki/:id/przelicz` dla wszystkich spółek (projekcja), test „odbudowa = stan”.
- Naprawa przyczyny 16 błędów w `testy/kontekst-pisma.test.js`.
- Testy: scenariusze z kryteriów (zbycie 06.10 14:00; dziedziczenie 10.10; informacja na 05.10
  wygenerowana 05.10 i 07.10 identyczna; ręczna data wpisu odrzucona; integralność łańcucha).

### Etap 2 — informacja z rejestru (`server/logika/informacja-dokument.js`, `server/widoki.js`)
- D-R02: kolumna „Data zarejestrowania emisji” = `data_wpisu_krs`; `data_emisji` znika z wydruku.
- D-R02a: bez zmian merytorycznych (B4), tylko test.
- D-R03/R06: wiersz osoba + seria; w kolumnie numerów grupy zakresów z datą wpisu (scalane przy tym
  samym dniu), np. `1–889, 990 (wpis 12.08.2026); 890–989 (wpis 25.09.2026)`; wiersz „Łącznie”
  (akcje, udział %) dla osób z więcej niż jedną serią. Nowa struktura w widoku:
  `akcjonariusze[].grupy_wpisu[] = { data_wpisu, zakresy, numery }`.
- D-R04/R05: cena emisyjna z walutą, opis emisji pod emisją, opis spółki w sekcji „Spółka”; bez
  podstawy prawnej.
- D-R06: `glosy` poza odpowiedziami API (zob. A6).
- D-R07: stopka „Sporządzono dd.mm.rrrr, godz. gg:mm”; dla dnia bieżącego „Stan na dd.mm.rrrr,
  godz. gg:mm”.
- Testy: `testy/informacja-dokument.test.js` (przykład Charlie, dwie serie, brak głosów, emisja).

### Etap 3 — kokpit (`publiczne/js/kokpit.js`, ewentualnie `publiczne/js/portal*.js`)
- Widok szczegółowy: wiersz na grupę zakresów z własną datą wpisu (z `grupy_wpisu`, zamiast
  `rozbijNaSzczegoly` dziedziczącego najstarszą datę).
- Wiersz „Łącznie” przy osobach z kilkoma seriami (oba widoki).
- Kontrola, że głosy nie są nigdzie wyświetlane.
- Przebudowa frontu (`npm run buduj`), test `testy/front-js.test.js`.

### Etap 4 — dane
- **D-31:** migracja addytywna `psa_spolki`: `przekazanie_data`, `przekazanie_odbiorca_typ`
  (`notariusz`/`izba_notarialna`/`podmiot_art_300_31_pkt_1`), `przekazanie_odbiorca_nazwa`,
  `przekazanie_odbiorca_identyfikator`, `przekazanie_podstawa`. Zapis przez zdarzenie
  `przekazanie_rejestru` (w łańcuchu). Po nim spółka tylko do odczytu: jedna reguła w
  `walidacje.js` i w trasach zapisu (sprawy, zdarzenia, PUT spółki, portal — zgłoszenie żądania).
  Podgląd i informacja z rejestru nadal dostępne. UI: formularz w kokpicie, pigułka „Rejestr
  przekazany” i ukrycie przycisków akcji.
- **D-34:** `server/dane/kraje.json` (ISO 3166-1 alfa-2, polskie nazwy). Nowe kolumny
  `kraj_kod` obok istniejących `kraj` w 6 miejscach: `psa_spolki.kraj`,
  `psa_spolki.reprezentant_kraj`, `psa_osoby.kraj`, `psa_wnioski.kraj`,
  `psa_wnioski.reprezentant_kraj`, `psa_wnioski_akcjonariusze.kraj`. Migracja mapuje tylko
  dokładne dopasowania nazwy (bez wielkości liter i znaków diakrytycznych), domyślnie PL dla
  „Polska”. Wartości nierozpoznane → `kraj_kod = NULL` i raport `GET /api/psa/kraje/do-poprawy`
  plus lista w konfiguracji (admin). Walidacja kodu na wejściu, wybór z listy w
  `publiczne/js/formularz-osoby.js`, `spolki.js`, `wniosek.js`, na wydrukach nazwa ze słownika.
  Starą kolumnę `kraj` zostawiamy (odwracalność).
- **D-Z:** migracja addytywna `psa_uzytkownicy`: `funkcja` (`notariusz`/`zastepca_notarialny`/
  `pracownik`) i słownik osób działających (`psa_osoby_dzialajace`: imię, nazwisko, funkcja,
  aktywny). Przy wpisie wybór osoby działającej, zapisywany w `dane_json.dzialajacy` (w hashu), a
  nie w kolumnie. Nie trafia do żadnego dokumentu (biała lista pól w `widoki.js` i
  `kontekst-pisma.js`). Test: brak na dokumentach.

### Etap 5 — przepływ
- **D-P1:** w kokpicie przy wierszu akcjonariusza i zakresu menu „Zbycie / Obciążenie / Umorzenie”
  → kreator z `?typ=&zbywca=&emisja=&zakres=`; kreator wstępnie wypełnia pola, zakres można
  zawęzić (`publiczne/js/kokpit.js`, `publiczne/js/sprawy.js`/`kreator.js`).
- **D-P2:** jeden komponent wyboru osoby: wyszukiwarka `GET /api/psa/osoby?q=` z przyciskiem „Dodaj
  nową”, który otwiera formularz osoby w tym samym oknie; po zapisie osoba jest wybrana. Użycie w
  polach nabywcy, obejmującego, zastawnika, użytkownika i przedstawiciela.
- **D-P3:** reguła w `walidacje.js` (także dla sprostowania emisji): jeżeli z emisji objęto choć
  jedną akcję, zmiana `seria`, `nr_pierwszy`, `ilosc` jest odrzucana z komunikatem „Akcje tej
  emisji zostały już objęte — seria, numeracja i liczba akcji nie mogą być prostowane. Jeżeli
  liczba akcji ma się zmniejszyć, dokonaj umorzenia; jeżeli zwiększyć — wpisz nową emisję.”.
  Pola opisowe przechodzą. W UI pola zablokowane z tym samym opisem.
- Nabywca ≠ zbywca — test regresyjny dla wszystkich tytułów przejścia (B9).

### Etap 6 — dokumentacja
- `CLAUDE-PSA.md`: reguła domenowa 6 („data wpisu jedyną osią czasu”), model danych (D-31, D-34,
  D-Z), znaczenie `data_utworzenia_spolki`.
- `PRZEJECIE-REJESTRU.md`: reguły D-R08 pkt 1–8 (w tym wstrzymanie migracji Charlie Unicorn AI PSA
  do decyzji notariusza).
- `DECYZJE.md`: wpisy `D-0xx` dla każdego etapu.
- `docs/krn/POROWNANIE-KRN-PSA.md`: uzupełnienie kolumny „Decyzja”.
- Test scenariusza KRN z numeracją AN 1–25 / AZ 26–100.

---

## D. Do akceptacji
1. A1 — zostawiamy ISO z przesunięciem strefy zamiast UTC? (rekomendacja: tak)
2. A2 — wariant (b), wartość pochodna, czy (a) `NULL` z przebudową tabeli łańcucha?
3. A3 — czy w produkcji jest spółka z wprowadzonym już stanem otwarcia? (jeżeli tak — ID)
4. A4 — `dokument_data` zostaje?
5. A5 — sprostowanie działa od chwili swojego wpisu (informacje wstecz bez zmian) — OK?
6. A6 — głosy zostają wyłącznie na uchwale o wyborze (wzór 03)?
7. A7 — weryfikacja Dz.U. 2026 poz. 176 po Pana stronie albo odblokowanie ISAP.
8. Plan etapów 1–6 — akceptacja.

### Odpowiedzi notariusza (2026-09-26)
- **Brak spółek w produkcji** — A3 bezprzedmiotowe; kolizja A1 (mieszane formaty w łańcuchu) znika.
- **A2 → wariant (c):** kolumnę `data_zdarzenia` usuwamy z `psa_zdarzenia` i ze skrótu
  (`lancuch.skrot`). Migracja przebudowuje tabelę łańcucha; przy niepustej tabeli migracja
  przerywa się z komunikatem (bazę deweloperską trzeba odtworzyć), bez przeliczania hashy.
- **A4:** `dokument_data` zostaje.
- Otwarte: A1 (UTC — skoro brak danych, wdrażamy zgodnie z D-R01), A5, A6, A7, akceptacja planu.
