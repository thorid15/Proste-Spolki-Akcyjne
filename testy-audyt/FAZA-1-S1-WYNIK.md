# FAZA 1 — wynik scenariusza podstawowego S1

> Zgodnie z `SESJA-PSA-AUDYT.md`: audyt read-only, zero zmian w kodzie produkcyjnym. Ścieżka
> przechodzona zarówno w przeglądarce (Playwright, ze zrzutami), jak i bezpośrednimi żądaniami HTTP
> z pominięciem formularza (`fetch`/`context.request`), zgodnie z zasadą 3 sesji. Skrypty pomocnicze
> w `testy-audyt/skrypty/` (nietrwałe narzędzie audytu, nie kod produkcyjny), zrzuty w
> `testy-audyt/zrzuty/faza1-s1/`.

## Co przetestowano

Pełna ścieżka S1: zgłoszenie publiczne (bez konta) → aktywacja konta portalowego → wniosek o
prowadzenie rejestru (dane spółki, reprezentant, dwóch akcjonariuszy: **Anna Kowalska** — osoba
fizyczna, docelowo 95 akcji; **Inwestor 410411 Sp. z o.o.** — osoba prawna, docelowo 5 akcji) →
złożenie wniosku → wystawienie kompletu 9 dokumentów przez kancelarię → udostępnienie klientowi →
odesłanie podpisanych skanów → potwierdzenie podpisów przez kancelarię → przyjęcie wniosku (powstaje
spółka) → otwarcie rejestru (emisja **AZ**, numery **1–100**, cena emisyjna **0,01 zł/akcję**,
pokryte **w całości**: Anna 1–95, Inwestor 96–100) → próba uzyskania informacji z rejestru przez
akcjonariusza mniejszościowego.

Spółka testowa końcowa: **Audyt S1 410411 Prosta Spółka Akcyjna** (id spółki #6 w bazie testowej,
KRS `0000410411`). Wynik końcowy stanu rejestru zweryfikowany bezpośrednio przez API i zrzut ekranu
`68-kokpit-rejestr-otwarty-95-5-CORRECT.png`: Kowalska Anna — seria AZ, 95 akcji, numery 1–95, 95 %,
w całości pokryte; Inwestor 410411 Sp. z o.o. — seria AZ, 5 akcji, numery 96–100, 5 %, w całości
pokryte; razem 100 (100 %).

Dla każdej pozycji checklisty z `SESJA-PSA-AUDYT.md` (sekcja „co sprawdzić po drodze") wykonano
zarówno test przez UI, jak i bezpośrednie żądanie HTTP z pominięciem formularza — wyniki poniżej z
odsyłaczami do `ZNALEZISKA.md`.

## Wyniki per punkt checklisty

| # | Punkt checklisty | Wynik | Znalezisko |
|---|---|---|---|
| 1 | Widoczność „czyja kolej" na każdym etapie | Częściowo dobrze: statusy wniosku („złożony — do sprawdzenia" / „Kancelaria sprawdza dane...") czytelne po obu stronach. | pozytywne, brak osobnego wpisu (opisane w Z-015 kontekstowo) |
| 2 | Przerwanie w połowie i powrót bez utraty danych/duplikatu | Wniosek: bez duplikatu (potwierdzone — osobny nieukończony wniosek z wcześniejszej próby pozostał odrębny, „w przygotowaniu"). Autozapis pola: utrata możliwa przy nawigacji **w oknie <800 ms** od ostatniej zmiany, bez ostrzeżenia. | Z-017 (autozapis); brak duplikatu — pozytywne, w opisie Z-015 |
| 3 | Podwójne kliknięcie / F5 po POST | Złożenie wniosku: poprawnie zablokowane (Z-015, pozytywne). Zgłoszenie WSTĘPNE: realny wyścig (race condition) przy dwóch RÓWNOCZESNYCH żądaniach — duplikat w kolejce + unieważniony pierwszy link aktywacyjny. | **Z-004** (POWAŻNY), Z-015 (pozytywne) |
| 4 | Wypełnienie wszystkich pól w wygenerowanych dokumentach | Pole „sposób reprezentacji" nigdy nie ma ścieżki ręcznego wypełnienia przy braku importu z KRS — w umowie/uchwale wychodzi jako pusty myślnik. System poprawnie WYKRYWA braki (`brakujące pola`) i pokazuje je pracownikowi, ale nie dla tego konkretnego pola we wszystkich sprawdzonych momentach. Reszta dokumentów (informacja z rejestru) — czysta, bez `{{`, `undefined`, `NaN`, `Invalid Date`. | **Z-007** (POWAŻNY) |
| 5 | Wymuszenie kolejności podpisów przez aplikację | Potwierdzone: notariusz/kancelaria nie może potwierdzić podpisu przed przesłaniem skanu przez klienta — zablokowane bezpośrednim żądaniem API (400/404), nie tylko przez UI. | **Z-016 (pozytywne)** |
| 6 | Data uchwały o wyborze podmiotu późniejsza niż data umowy | Możliwe — brak jakiejkolwiek walidacji porównującej te dwie daty. | **Z-008 (KRYTYCZNY)** |
| 7 | Przyjęcie spółki, która nie jest P.S.A. | Poprawnie odrzucone (400, z cytatem art. 300³¹ § 1 KSH), również przy bezpośrednim żądaniu. | **Z-010 (pozytywne)** |
| 8 | Druga umowa o prowadzenie rejestru dla tej samej spółki | Możliwa — `data_umowy`/`umowe_zawarl*` to zwykłe kolumny bez wersjonowania i bez blokady nadpisania; nie ma osobnej tabeli umów. | **Z-009 (POWAŻNY)** |
| 9 | Wpis akcji przed datą wpisu spółki do KRS / bez `data_wpisu_krs` | Emisja BEZ `data_wpisu_krs`: twardo zablokowana (422) na poziomie podglądu i bezpośredniego zapisu — dobrze. Emisja z `data_wpisu_krs` ustawioną na datę WCZEŚNIEJSZĄ niż rzeczywista rejestracja spółki: **przyjęta bez zastrzeżeń** — blokada sprawdza tylko obecność pola, nie jego wiarygodność. | **Z-011 (pozytywne)** + **Z-012 (KRYTYCZNY)** |
| 10 | Bilans akcji kontrolowany na żywo, blokujący | Potwierdzone: próba objęcia 96+5=101>100 odrzucona (422), transakcyjnie (bez częściowego zapisu), zweryfikowane bezpośrednim żądaniem. | **Z-013 (pozytywne)** |
| 11 | Maskowanie PESEL/data urodzenia/adres dla innego akcjonariusza | Potwierdzone wprost w treści HTML dokumentu „Informacja z rejestru": adres Anny zamaskowany (`••• •••, ••• •••`) w widoku „oczami" Inwestora; w pełni jawny w widoku „oczami" spółki. PESEL/data urodzenia nie pojawiają się w dokumencie w ogóle (zgodnie z `PRZEPISY-PSA.md` sekcja 12 pkt 2). | **Z-014 (pozytywne)** |

## Znaleziska dodatkowe (poza wprost wymienioną checklistą, odkryte po drodze)

- **Z-003** (POWAŻNY) — automatyczne zaproszenie do portalu przy zgłoszeniu, bez oceny kancelarii;
  sprzeczność między dwoma komentarzami w kodzie tego samego modułu.
- **Z-005** (**KRYTYCZNY**, najważniejsze znalezisko fazy) — jedyna wyeksponowana ścieżka otwarcia
  rejestru dla spółki z portalu klienta („Migracja — stan otwarcia") pomija w całości 10-punktową
  checklistę otwarcia z `EkranNowejSpolki` oraz nigdy nie zbiera daty uchwały/umowy ani wzmianki o
  pokryciu/cenie emisyjnej per akcjonariusz — dotyczy KAŻDEJ spółki onboardowanej przez portal,
  czyli deklarowanego głównego modelu biznesowego aplikacji.
- **Z-006** (**KRYTYCZNY**) — brak jakiejkolwiek ścieżki (UI lub API) tworzenia konta portalowego
  dla akcjonariusza innego niż osoba, która złożyła pierwotne zgłoszenie. W praktyce uniemożliwiło
  to wykonanie kroku 6 scenariusza S1 dosłownie tak, jak został zlecony (obejście: informację z
  rejestru dla akcjonariusza mniejszościowego wygenerowała kancelaria „papierowo" — Z-014).
- **Z-018** (DROBNY) — brak powiązania `label`↔`input` w formularzach po stronie kancelarii
  (`ui.js`), częściowe po stronie portalu (`ui-rejestr.js`) — dostępność (WCAG), odkryte przy
  budowaniu automatyzacji przeglądarkowej tą samą metodą co czytnik ekranu.
- **Z-019** (DROBNY) — „data otwarcia rejestru" ustawiana automatycznie w dniu przyjęcia wniosku,
  zanim jakikolwiek wpis do rejestru faktycznie zaistniał.

## Czego NIE udało się przetestować i dlaczego

1. **Import danych spółki z otwartego API KRS.** Środowisko audytu nie ma dostępu do sieci
   zewnętrznej (`curl https://api-krs.ms.gov.pl/...` kończy się resetem połączenia — potwierdzone
   przed rozpoczęciem testów). Kod aplikacji **poprawnie obsługuje ten przypadek** — `pobierzZKrs()`
   przechwytuje błąd i pozwala kontynuować z ręcznym wypełnieniem formularza (potwierdzone: cała
   ścieżka S1 przeszła z danymi wpisanymi ręcznie, komunikat z prośbą o uzupełnienie danych ręcznie
   pojawia się poprawnie). Nie zweryfikowano więc SAMEGO mapowania pól z odpowiedzi realnego API KRS
   (`server/logika/krs.js`) — to wymaga dostępu do sieci zewnętrznej i osobnego testu.
2. **Rzeczywista wysyłka e-mail.** `.env` środowiska audytowego nie ma skonfigurowanego SMTP —
   wszystkie powiadomienia (zaproszenie, dokumenty do podpisu, zawiadomienie o wpisie) poprawnie
   zwracają `wyslano:false` z podanym powodem i zapisują ślad w `psa_wydane_dokumenty`/wracają link
   bezpośrednio w odpowiedzi API zamiast e-mailem — zgodnie z projektowanym zachowaniem offline.
   Nie zweryfikowano samej treści/renderowania e-maili HTML ani rzeczywistej dostawy.
3. **Portal jako akcjonariusz mniejszościowy — logowanie i widok „Moje spółki"/„Rejestr" z
   maskowaniem z POZIOMU KONTA AKCJONARIUSZA.** Zablokowane strukturalnie przez Z-006 (brak
   mechanizmu tworzenia takiego konta) — nie jest to ograniczenie środowiska audytowego, tylko
   realny brak funkcji w aplikacji, opisany jako osobne, krytyczne znalezisko. Maskowanie
   zweryfikowano alternatywną, legalną ścieżką (kancelaria generuje „Informację z rejestru" dla
   wskazanego akcjonariusza — Z-014), ale NIE przez samoobsługowe logowanie portalowe, którego S1
   wprost wymagał.
4. **Warianty S2–S6** (rada dyrektorów, akcje nie w pełni pokryte w kontekście S1, akcje
   uprzywilejowane/nieme, ułamkowe części akcji) — świadomie pominięte zgodnie z podziałem pracy w
   `SESJA-PSA-AUDYT.md` (wykonuje je równolegle inny agent, numeracja Z-050+ już widoczna w
   `ZNALEZISKA.md`).
5. **Treść e-maili wysyłanych przez `nodemailer` i realny wygląd wydrukowanego PDF/HTML w
   przeglądarce klienta** (poza samą treścią tekstową pobraną przez API) — zweryfikowano treść
   tekstową dokumentów (`bloki` z endpointu podglądu) pod kątem `{{`, `undefined`, `NaN`, `Invalid
   Date`, pustych placeholderów — czysto poza opisanym w Z-007 przypadkiem — ale nie otwarto
   samego wygenerowanego pliku PDF w przeglądarce (poza samym pobraniem — rozmiar i status HTTP
   200 zweryfikowane).

## Zrzuty ekranu (wybrane, chronologicznie; pełna lista w `testy-audyt/zrzuty/faza1-s1/`)

Ścieżka główna S1 (numeracja zawiera powtórzenia z nieudanych prób podczas pisania automatyzacji —
zaznaczone kursywą; finalny, kompletny przebieg zaczyna się od `24`):

- `01`–`09` — pierwsza próba zgłoszenia publicznego (formularz pusty/wypełniony/wysłany), logowanie
  kancelarii, pulpit, lista zgłoszeń.
- *`10`–`23`* — pierwsza, nieudokończona próba wypełnienia wniosku (przerwana podczas naprawiania
  selektorów automatyzacji — pozostawiony wniosek widoczny na `51` jako „w przygotowaniu", dowód
  braku duplikatu przy wznowieniu, patrz punkt 2 checklisty).
- `24`–`29` — **zgłoszenie finalne**: formularz, potwierdzenie, aktywacja konta, zalogowanie
  kancelarii.
- `30`–`49` — **wniosek finalny**: RODO, krok „Spółka", krok „Reprezentant", krok „Akcjonariusze"
  (dwie pozycje: Anna Kowalska — fizyczna, Inwestor 410411 Sp. z o.o. — prawna), podsumowanie,
  złożenie.
- `50` — odświeżenie (F5) strony wniosku zaraz po złożeniu (bez duplikatu/utraty stanu).
- `51`–`54` — kancelaria: lista wniosków (statusy widoczne), widok wniosku, wystawienie kompletu 9
  dokumentów, udostępnienie klientowi.
- `55`–`57` — klient: lista dokumentów do podpisu, wszystkie skany załączone, komplet odesłany.
- `58`–`59` — kancelaria: weryfikacja akcjonariuszy i potwierdzenie podpisów (po tym, jak próba
  potwierdzenia PRZED odesłaniem skanu została odrzucona bezpośrednim żądaniem — Z-016).
- `60` — kokpit spółki zaraz po przyjęciu wniosku: **jedyny widoczny przycisk to „Migracja — stan
  otwarcia"**, pola daty uchwały/umowy puste (dowód do Z-005).
- `61`–`65` — próba dotarcia do ogólnej ścieżki „Nowa emisja" (przycisk znika po dodaniu
  jakiegokolwiek zdarzenia — dowód do Z-005; „Nowa emisja" prowadzi do cięższego kreatora sprawy).
- `66`–`68` — otwarcie rejestru przez bezpośrednie API (z uwagi na brak pól pokrycia/ceny w
  kreatorze Migracji): próba bilansu niezgodnego (96+5, odrzucona, `66`), poprawne objęcie 95+5
  (`67`/`68` — `68` to zrzut po twardym odświeżeniu, poprawnie pokazujący pełny stan rejestru).
- `69` — szczegóły „Rejestru akcji" po otwarciu (dwie emisje: testowa `ZZ-WCZESNA` z testów blokad
  + właściwa `AZ`).
- `70` — kartoteka osób, poszukiwanie ścieżki do konta portalowego akcjonariusza (brak — Z-006).
- `71`–`72` — informacja z rejestru: rola „spółka" (pełne dane) vs. rola „akcjonariusz" — Inwestor
  jako odbiorca (adres Anny zamaskowany — Z-014).
- `73`–`79` — testy przerwania w połowie/autozapisu (`Z-017`): próba z przyciskiem „wstecz"
  przeglądarki oraz kontrolowany pomiar okna utraty danych (300 ms — utrata, 1200 ms — zachowane).

## Uwaga o danych testowych pozostawionych w bazie

Spółka #6 (Audyt S1 410411 P.S.A.) ma w rejestrze zdarzeń, oprócz właściwej emisji założycielskiej
AZ (100 akcji, objęte w całości), również **testową emisję `ZZ-WCZESNA`** (10 akcji, seria
niepowiązana z serią AZ, nigdy nie objęta) — efekt uboczny testu Z-012 (emisja z datą wpisu do KRS
sprzed rejestracji spółki). Widoczna jako ostrzeżenie „10 akcji czeka na wpis objęcia" na kokpicie
tej spółki. To dane testowe w bazie `./dane/audyt-test.db`, nie produkcyjnej — pozostawione świadomie
jako dowód znaleziska Z-012, zgodnie z zasadami sesji (baza testowa, można swobodnie tworzyć dane
przez API).
