# Błędy znalezione przez tester (Faza 2) — odtworzenie i przyczyna, bez poprawek

> Metoda: `superpowers:systematic-debugging` fazy 1–3 (odczyt błędu, reprodukcja, porównanie ścieżki działającej
> z wadliwą, jedna hipoteza sprawdzona minimalnym testem). Faza 4 (poprawka) — **nie w tej sesji**; poprawki w planie wdrożenia.
> Numeracja B-… wspólna z `RAPORT-PRZEPLYWY.md` § 2.

## B-001 — Wpis z urzędu z przycisku w kokpitu wymaga żądającego; „Załóż sprawę” nieaktywne

> **Naprawione 4.11.2026:** `kreator.js` — efekt z zależnością `[typ, definicjaTypu]`. Scenariusz e2e bez `test.fail`.

- **Waga:** B (blokuje — zajęcie / uchylenie zajęcia nie da się założyć wejściem z kokpitu).
- **Odtworzenie:** kokpit spółki → „Zajęcie egzekucyjne (z urzędu)” (`#/spolki/1/zdarzenie?typ=zajecie`) → krok „Podstawa”.
  Widać naraz komunikat „To zdarzenie zakłada się wyłącznie z urzędu — bez żądającego” **i** pola „Żądający wpisu”,
  „W jakim charakterze”; „Załóż sprawę i przejdź dalej” nieaktywne.
  Ten sam typ wybrany kafelkiem w kroku „Co się stało” (`#/spolki/1/zdarzenie`) działa: pól żądającego brak, przycisk aktywny.
  Skrypt reprodukcji (wynik): `A) z adresu: {"zadajacy":1,"info":1,"zaloz":false}`, `B) kafelek: {"zadajacy":0,"info":1,"zaloz":true}`.
  Scenariusze: `wpis-zajecie`, `wpis-wykreslenie_zajecia` (krok „Podstawa”).
- **Przyczyna:** `publiczne/js/kreator.js:1407–1411` — efekt ustawiający `zrodlo = 'z_urzedu'` ma zależność `[typ]`, a czyta
  `definicjaTypu` (z `useDane('/api/psa/meta')`, ładowane asynchronicznie). Przy typie z adresu (`typPoczatkowy`) efekt
  wykonuje się raz, zanim `meta` przyjdzie (`definicjaTypu === null`) — i już się nie powtarza, bo `typ` się nie zmienia.
  `zrodlo` zostaje `'papier'` → `zadajacyKompletny` (`:1467`) wymaga żądającego. Przez kafelek typ ustawia się po wczytaniu `meta`, więc działa.
- **Kierunek poprawki (następna sesja):** zależność efektu `[typ, definicjaTypu]` (albo wyliczenie `zrodlo` bez efektu) + test e2e `wpis-zajecie`.

## B-002 — „Sprostowanie” w kreatorze prowadzi do ślepego zaułka po założeniu sprawy

> **Naprawione 4.11.2026:** D-103 — `kreator: false` dla `sprostowanie` (jedna droga: „Sprostuj” w historii). Scenariusz e2e bez `test.fail`.

- **Waga:** B (blokuje — sprawa założona, wpisu nie da się dokonać; zostaje sprawa do anulowania).
- **Odtworzenie:** kreator → „Sprostowanie wcześniejszego zdarzenia” → „Podstawa” → „Załóż sprawę i przejdź dalej” (sprawa
  powstaje) → „Co się zmienia” → „Dalej” → „Weryfikacja i podgląd”: „Wpis nie może zostać dokonany: Typ zdarzenia
  „sprostowanie” nie jest jeszcze obsługiwany przez kreator w tym sprincie.”; „Dokonaj wpisu” nieaktywne. Scenariusz `wpis-sprostowanie`.
- **Przyczyna:** typ `sprostowanie` (`server/logika/typy-zdarzen.js:373`, `sprint: 2`, bez `kreator: false`) wchodzi do
  `dostepneWKreatorze()` i do kafelków kreatora, ale `server/logika/kreator.js` nie ma dla niego budowniczego
  w `PRZYGOTOWANIA` — `przygotuj()` (`:754`) rzuca `BladKreatora`. Działająca ścieżka sprostowania to osobne okno w historii
  kokpitu → `POST /zdarzenia/:id/sprostuj` → `rejestr.js:692` `przygotujSprostowanie`. Sprawdzone dla wszystkich typów kreatora:
  `sprostowanie` jest jedynym bez budowniczego.
- **Kierunek:** `kreator: false` dla `sprostowanie` (jedna droga — okno w historii, W9) albo budowniczy wołający `przygotujSprostowanie`.

## B-003 — Po „Wyślij powiadomienie” (K4) kreator wraca do „Co się zmienia”, checklista znika

> **Naprawione 4.11.2026:** `EkranSprawy` — `Spinner` tylko przy pierwszym wczytaniu; odświeżenie zostawia kreator na miejscu. Scenariusz e2e bez `test.fail`.

- **Waga:** U (utrudnia — użytkownik traci miejsce i odhaczoną checklistę; jedno „Dalej” i ponowne odhaczenie więcej).
- **Odtworzenie:** typ z uprzednim powiadomieniem (obciążenie, umorzenie, zobowiązanie, prawo głosu zastawnika, zbycie ułamka)
  → „Weryfikacja i podgląd” → panel „Uprzednie powiadomienie”: „Kogo powiadomić” → „Wyślij powiadomienie” → nagłówek kroku
  zmienia się na „Co się zmienia” (krok 2/3), „Wstecz” nieaktywne, odhaczenia znikają. Sonda: stan przed wysłaniem
  `["Weryfikacja i podgląd"]`, po wysłaniu `["Co się zmienia"]`. Scenariusze `wpis-obciazenie`, `wpis-umorzenie`, `wpis-zobowiazanie`,
  `wpis-prawo_glosu_zastawnika`, `wpis-przeniesienie_ulamka`. To samo dotyczy „Odnotuj zgodę” (to samo `odswiez`).
- **Przyczyna:** `PanelPowiadomienia` po wysłaniu woła `odswiez()` sprawy; `useDane` ustawia `ladowanie: true`
  (`rdzen.js:315`), a `EkranSprawy` (`sprawy.js:1053`) przy `ladowanie` zwraca `<Spinner />` zamiast drzewa — `KreatorSprawy`
  odmontowuje się i po powrocie startuje od `useState(2)` (`sprawy.js:569`), `odhaczone = {}`, `podglad = null`.
  Zbycie (K5) ma własny stan kreatora i tego błędu nie ma (scenariusze `zbycie-*` przechodzą).
- **Kierunek:** odświeżanie w tle bez `Spinner` (zachować poprzednie `dane` w `useDane` przy `odswiez`) albo stan kroku nad kreatorem;
  docelowo — jeden wzorzec wpisu (raport § 4).

## B-004 — Przejęcie rejestru: z ekranu przeniesienia nie da się dojść do otwarcia PRZEJĘCIEM

> **Naprawione 4.11.2026:** `przeniesienia.js` — „Otwórz rejestr” → `/spolki/:id/otworz`. Scenariusz e2e bez `test.fail`.

- **Waga:** B (blokuje — ścieżka w UI prowadzi do niewłaściwego otwarcia; przeniesienie nie dochodzi do „Aktywny”).
- **Odtworzenie:** `#/przeniesienia/:id` (status „Uzgodnienie”, np. Theta z `test:seed`) → Etap 6 odhaczony, protokół wgrany →
  „Otwórz rejestr — PRZEJĘCIE (kreator stanu otwarcia)” → kokpit spółki. Przyciski kokpitu (scenariusz `przejecie-rejestru`,
  `stan_ekranu.przyciski`): „Migracja z innego rejestru — stan otwarcia”, „Informacja z rejestru”, „Przekazanie rejestru…”,
  „Dodaj akcjonariusza”, „Przeniesienie akcji” … — **brak „Otwórz rejestr”**. Jedyne wejście w stan otwarcia to „Migracja”.
- **Przyczyna:** `publiczne/js/przeniesienia.js:120` prowadzi do `/spolki/:id` (kokpit), nie do `/spolki/:id/otworz`.
  W kokpicie (`kokpit.js:908–918`) dla spółki bez zdarzeń jest tylko odnośnik do `/spolki/:id/migracja` (`EkranMigracji`
  — migracja z Rejestrów Notarialnych z datami historycznymi), który zapisuje emisję i objęcie wprost
  (`POST /spolki/:id/zdarzenia`, `migracja.js:47`) — bez `POST /spolki/:id/otworz-rejestr`. Tylko ta trasa
  (`server/trasy/spolki.js:893–939`) sprawdza przeszkody przejścia, zapisuje PRZEJĘCIE na początku łańcucha i ustawia
  przeniesienie na „Aktywny”. Kreator `/spolki/:id/otworz` (`app.js`, `EkranOtwarciaRejestru`) jest osiągalny tylko
  z wniosku (`wnioski.js:1706`) albo ręcznie wpisanym adresem.
- **Kierunek:** przycisk na ekranie przeniesienia → `/spolki/:id/otworz` (jedna nazwa czynności w całym przepływie,
  reguła 7); „Migracja z innego rejestru” niewidoczna dla spółki z przeniesieniem w toku.

## B-005 — Zbycie (K5): pola „zgoda spółki” i „prawo pierwszeństwa wyczerpane” nigdy się nie pokazują; wpis zablokowany

> **Naprawione 4.11.2026:** `widoki.js` — ograniczenia z `status`, `emisja_klucz`, `zakresy`; test na kształcie API (`testy/wpis-zbycia-logika.test.js`). Scenariusz e2e bez `test.fail`.

- **Waga:** B (blokuje — zbycia akcji objętych ograniczeniem z wymogiem zgody spółki albo prawem pierwszeństwa nie da się wpisać nowym przebiegiem).
- **Odtworzenie:** ograniczenie na serii A (`zakres: 'emisja'`, `prawo_pierwszenstwa: true`; analogicznie `wymaga_zgody_spolki: true`)
  → kokpit → „Przeniesienie akcji” → Anna Testowa → Celina, 20 akcji → „Podstawa” → „Sprawdzenie i wpis”.
  Pól wyboru tylko 6 (checklista); pola „Prawo pierwszeństwa wyczerpane” brak; komunikat serwera „Wpis nie może zostać dokonany:
  Zarejestrowane jest prawo pierwszeństwa nabycia akcji … Nie odnotowano jego wyczerpania.”; „Dokonaj wpisu” nieaktywne.
  Scenariusze `zbycie-pierwszenstwo`, `zbycie-zgoda-spolki`.
- **Przyczyna:** `publiczne/js/wpis-zbycia-logika.js:88–95` `ograniczeniaDlaDoboru` filtruje `stan.ograniczenia` po
  `o.status === 'aktywne'` i `o.emisja_klucz === dobor.emisja_klucz` (kształt wewnętrzny `stan.js`). Kreator dostaje jednak
  stan z `GET /api/psa/spolki/:id` (`wpis-zbycia.js:87`), a ten (`server/widoki.js:194–205`) zwraca ograniczenia w kształcie
  do wyświetlania: `{klucz, zakres, seria, numery, wymaga_zgody_spolki, prawo_pierwszenstwa, opis}` — bez `status`,
  bez `emisja_klucz`, bez `zakresy`. Filtr zawsze daje `[]` → `widoczneGdy` pól `zgoda_spolki` i `pierwszenstwo_wyczerpane`
  zawsze `false` → `daneZdarzenia` wysyła flagi 0 → walidacja serwera (`walidacje.js:217–235`) blokuje.
  Testy jednostkowe (`testy/wpis-zbycia-logika.test.js:49–51, 77`) przechodzą, bo ich dane mają kształt wewnętrzny, którego API nie zwraca.
- **Kierunek:** jeden kształt ograniczeń dla kreatora (np. `emisja_klucz`, `zakresy` w widoku) + test na odpowiedzi `GET /api/psa/spolki/:id`.

## B-006 — „Listy do wysyłki” przy 390 px: nakładające się treści, formularz nadania poza ekranem

> **Naprawione 4.11.2026:** `rejestr.css` — komórki tabeli na wąskim ekranie: zawijanie, `height: auto`, formularz na całą szerokość. Scenariusz e2e bez `test.fail`.

- **Waga:** B na telefonie (nie da się kliknąć „Zapisz nadanie” — wpis zbycia bez zgody zbywcy zostaje zablokowany); na 1440 px działa.
- **Odtworzenie:** 390 px, `#/listy` (3 listy z `test:seed` + nowy) → „Nadano” przy liście → pola „Data nadania”, „Numer nadania” wychodzą
  poza kartę i prawą krawędź ekranu; „Zapisz nadanie” poza zasięgiem. W wierszach „Pismo” i „Adresat” tekst nachodzi na etykiety,
  znacznik „Brak zgody — konieczne powiadomienie listem” leży pod przyciskami. Zrzut `docs/analiza/arkusze/B-006-kolejka-listow-390.png`;
  `sprawdzUklad`: 11 problemów w tym kroku („poza obszarem treści karty (133–386 vs 65–325)”). Scenariusze `zbycie-bez-zgody@390`, `zbycie-niepokryte@390`.
- **Przyczyna:** `publiczne/style/rejestr.css:2557–2566` — poniżej 600 px każda komórka `table.tabela td` to jeden rząd flex
  (`justify-content: space-between`, bez `flex-wrap`, bez `min-width: 0` dla dzieci), z etykietą `::before` (`max-width: 45%`).
  Komórka z kilkoma blokami (tekst + `div`, albo cały formularz `div.pion` w „Nadanie”) nie mieści się w jednym rzędzie i nie może się zwinąć.
  Kontrola układu R4 (`npm run zrzuty`) mierzyła ekran listów bez otwartego formularza nadania i z jednym listem.
- **Kierunek:** komórki tabeli na wąskim ekranie — `flex-wrap: wrap`, treść komórki jako jeden blok `min-width: 0`; formularz w komórce na całą szerokość
  pod etykietą. Zmiana wspólnej reguły → pełny przebieg `npm run zrzuty` i `npm run e2e` przy 390 px.
