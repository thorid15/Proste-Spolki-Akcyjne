# Pytania do Łukasza — log narastający

> Rzeczy nierozstrzygalne bez decyzji człowieka podczas audytu. Dopisywać na końcu, nie zmieniać
> numeracji wcześniejszych wpisów.

## P-001 — Czy przy wpisie transakcyjnym dotyczącym akcjonariusza-osoby prawnej wymagamy
identyfikacji beneficjenta rzeczywistego?

- **Kontekst:** `psa_osoby.beneficjent_rzeczywisty_id` istnieje w schemacie i ma poprawną walidację
  krzyżową (musi wskazywać osobę fizyczną, tylko dla `typ='prawna'`), ale pole jest **w pełni
  opcjonalne** — można zapisać i przyjąć akcjonariusza-osobę prawną bez żadnego beneficjenta
  rzeczywistego, bez jakiegokolwiek ostrzeżenia (nawet miękkiego, nieblokującego). Patrz
  `testy-audyt/ZNALEZISKA.md` Z-053.
- **Dlaczego nie rozstrzygnąłem sam:** `PRZEPISY-PSA.md` sekcja 9 („AML i taksa") oznacza całą
  podstawę AML jako ⚠️ — niepotwierdzoną przy tekście ustawy — a sekcja 13 tego pliku wprost
  zabrania, by pozycje ⚠️ były podstawą blokady w systemie do czasu weryfikacji.
  `WYTYCZNE-MERYTORYCZNE-PSA.md` sekcja 7 dodatkowo zawęża definicję „klienta" AML do
  akcjonariusza/zastawnika/użytkownika **podlegającego wpisowi w związku z konkretną transakcją** —
  nie każdego akcjonariusza od razu przy otwarciu rejestru.
- **Pytanie:** czy przy zdarzeniu transakcyjnym (np. `przeniesienie` na rzecz osoby prawnej) system
  powinien choćby ostrzegać (nie blokować), gdy nabywca-osoba prawna nie ma wskazanego beneficjenta
  rzeczywistego? Jeśli tak — jaka jest jednostka redakcyjna ustawy AML uzasadniająca ten wymóg (do
  wpisania do `PRZEPISY-PSA.md`, żeby reguła miała podstawę)?

## P-002 — Czy akcja `rodzaj_akcji = "niema"` ma być automatycznie pozbawiona prawa głosu, czy
zależy to wyłącznie od treści umowy spółki (której dziś system nie ewidencjonuje)?

- **Kontekst:** testy wariantu S5 (patrz `testy-audyt/ZNALEZISKA.md` Z-055) pokazały, że pole
  `psa_emisje.rodzaj_akcji` (`zwykla`/`uprzywilejowana`/`zalozycielska`/`niema`) jest dziś czystą
  etykietą wyświetlaną w rejestrze — nie wpływa na liczbę głosów w żadnym generowanym dokumencie
  (np. uchwale akcjonariuszy, wzór 03/08). Kod wprost dokumentuje to jako świadome uproszczenie
  (`server/logika/kontekst-pisma.js:356-360`).
- **Dlaczego nie rozstrzygnąłem sam:** `PRZEPISY-PSA.md` nie zawiera dla P.S.A. odpowiednika
  przepisów o akcji niemej ze spółki akcyjnej (art. 351–352 KSH), które wprost pozbawiają ją prawa
  głosu — a sekcja 12 pkt 5 tego pliku wyraźnie zakazuje stosowania przepisów o S.A. przez analogię
  tam, gdzie Dział IA nie zawiera odesłania. Art. 300²³ § 1 KSH mówi tylko „akcja daje prawo do
  jednego głosu" — nie różnicuje wprost akcji zwykłej i niemej.
- **Pytanie:** czy w P.S.A. skutek „akcja niema = bez głosu" wynika wprost z ustawy (i z jakiej
  jednostki redakcyjnej — do dopisania w `PRZEPISY-PSA.md`), czy zależy wyłącznie od odrębnego
  postanowienia UMOWY SPÓŁKI (analogicznie do `zakaz_glosu_zastawnika_umowa` już istniejącego w
  schemacie)? Jeśli to drugie — system potrzebowałby nowego pola przy emisji/serii (np.
  `pozbawiona_glosu_umowa`), a nie tylko poprawki w liczniku głosów.

## P-003 — Czy „zgłoszenie" ma nadal iść przez ocenę kancelarii przed zaproszeniem, czy obecne
automatyczne zaproszenie „od razu" jest ostateczną, świadomą decyzją biznesową?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-003. `SESJA-PSA-AUDYT.md` (i pierwotny komentarz
  nagłówkowy `server/trasy/zgloszenia.js`) opisują krok „przegląd i zatwierdzenie zgłoszenia przez
  pracownika kancelarii" jako osobny etap decyzyjny. Rzeczywisty kod (`server/trasy/portal.js:290-293`)
  wysyła zaproszenie do portalu natychmiast po złożeniu zgłoszenia, z jawnym komentarzem, że to
  świadoma zmiana („kancelaria niczego jeszcze nie sprawdza (...) kolejka zostaje jako ślad, nie
  jako bramka").
- **Dlaczego nie rozstrzygnąłem sam:** to decyzja biznesowa (szybkość onboardingu vs. kontrola
  wstępna), nie kwestia zgodności z przepisem — `PRZEPISY-PSA.md` w ogóle nie reguluje etapu
  przedkontraktowego zgłoszenia zainteresowania.
- **Pytanie:** czy to ma tak zostać (każdy z poprawnym numerem KRS i dowolnym e-mailem dostaje od
  razu aktywne konto portalowe i może zacząć wypełniać wniosek), czy przycisk „Odrzuć" w kolejce
  zgłoszeń powinien realnie cofać już nadany dostęp (dziś tego nie robi — konto zostaje aktywne)?

## P-004 — Jaki ma być docelowy sposób nadawania akcjonariuszom innym niż wnioskodawca dostępu do
portalu?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-006 — KRYTYCZNE. Model danych (`psa_konta.rola`
  `spolka`/`akcjonariusz`, `CHECK` w migracji wiążący rolę `akcjonariusz` z `osoba_id`) zakłada
  istnienie kont akcjonariuszy, ale w całym kodzie nie ma ŻADNEJ trasy ani przycisku, który taki
  wiersz kiedykolwiek tworzy. W praktyce: akcjonariusz, który nie był osobą wypełniającą wniosek
  (typowo: drugi/kolejny wspólnik, inwestor mniejszościowy, wspólnik-osoba prawna reprezentowana
  przez kogoś innego) nigdy, żadną drogą, nie dostaje własnego logowania do portalu.
- **Dlaczego nie rozstrzygnąłem sam:** to brakująca funkcja, nie błąd logiki — wymaga decyzji
  produktowej (kto inicjuje zaproszenie: kancelaria ręcznie z kartoteki osób? spółka sama z
  poziomu swojego konta? automatycznie przy wpisaniu objęcia akcji na nową osobę?) i decyzji
  bezpieczeństwa (jak weryfikować, że dana osoba prawna faktycznie kontroluje podany adres e-mail,
  zanim dostanie wgląd we własne dane w rejestrze).
- **Pytanie:** który z powyższych mechanizmów zaproszenia ma powstać, i czy to jest praca do
  sprintu 7 („Aktywacja kont portalowych e-mailem" jest tam wymieniona ogólnie) — jeśli tak, warto
  to sprecyzować w `CLAUDE-PSA.md`, bo dziś zapis sprintu 7 nie rozróżnia „aktywacji" (co już
  działa dla wnioskodawcy) od „zaproszenia KOGOŚ INNEGO NIŻ wnioskodawca" (co nie istnieje wcale).

## P-005 — Czy niezgodność dat „uchwała później niż umowa" i nadpisanie umowy o prowadzenie
rejestru bez śladu mają być twardą blokadą, czy tylko ostrzeżeniem?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-008 i Z-009. Bezpośrednim żądaniem `PUT
  /api/psa/spolki/:id` dało się zapisać `data_uchwaly_wyboru` PÓŹNIEJSZĄ niż `data_umowy` (logicznie
  odwrócona kolejność względem art. 300³² § 1 w zw. z art. 300³¹ § 5 KSH), a także nadpisać całą
  umowę (datę, kto ją zawarł) drugi raz, bez żadnego ostrzeżenia i bez śladu poprzedniej wersji —
  mimo że reszta modułu jest zbudowana wokół zasady „nic się nie nadpisuje bez śladu"
  (`psa_zdarzenia` append-only).
- **Dlaczego nie rozstrzygnąłem sam:** `CLAUDE-PSA.md` reguła 1 mówi o append-only wyłącznie dla
  `psa_zdarzenia` — `psa_spolki` (gdzie żyją te pola) nie ma analogicznego zastrzeżenia wprost, więc
  nie jest jasne, czy zamierzeniem było też uczynienie zmiany umowy zdarzeniem w łańcuchu (typ
  `zmiana_danych_spolki` już istnieje i jest używany dla INNYCH pól tej samej tabeli).
- **Pytanie:** (a) czy zapis z `data_uchwaly_wyboru > data_umowy` ma być odrzucany, czy tylko
  oznaczany ostrzeżeniem wymagającym świadomego potwierdzenia; (b) czy zmiana `data_umowy`/
  `umowe_zawarl*` na już prowadzonej spółce powinna iść przez `psa_zdarzenia` (jak inne zmiany
  danych spółki) zamiast przez ciche `UPDATE` kolumn.

## P-006 — Czy `data_wpisu_krs` emisji powinna być walidowana względem `data_utworzenia_spolki`
(i ewentualnie względem `dzisiaj`), czy sama obecność pola wystarcza?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-012 — KRYTYCZNE. Bezpośrednim żądaniem dało się
  zapisać emisję z `data_wpisu_krs = "2000-01-01"` dla spółki zarejestrowanej w KRS dopiero dzisiaj
  — system sprawdza wyłącznie, że pole NIE JEST puste, nigdy że jest wiarygodne względem reszty
  danych tej samej spółki.
- **Dlaczego nie rozstrzygnąłem sam:** to nie brak reguły w `PRZEPISY-PSA.md` (art. 300³⁰ § 2 KSH
  jest tam jasno opisany i podstawa jest jednoznaczna), tylko pytanie o ZAKRES dodatkowej walidacji
  krzyżowej, której konkretny kształt (np. czy dopuszczać `data_wpisu_krs` RÓWNĄ dacie rejestracji
  spółki dla emisji założycielskiej, czy wymagać być późniejsza) wymaga decyzji, żeby nie zablokować
  prawidłowego przypadku (emisja założycielska ma zwykle TĘ SAMĄ datę co wpis spółki, bo rejestrują
  się razem — `spolki.js:329` tak właśnie to dziś ustawia: „mirroruje datę rejestracji w KRS").
- **Pytanie:** czy reguła ma brzmieć „data_wpisu_krs emisji ≥ data_utworzenia_spolki" (z
  dopuszczeniem równości dla emisji założycielskiej), czy coś innego — i czy analogiczna kontrola
  krzyżowa (data nie z przyszłości, data nie sprzed rejestracji spółki) powinna też objąć inne pola
  dat w całym module (np. `data_zdarzenia` zdarzeń późniejszych niż emisja, o czym wspomina już
  istniejąca reguła „walidacje.js" dla dat wcześniejszych niż ostatnie zdarzenie na tych akcjach)?

## P-007 — Czy wprowadzenie stanu otwarcia rejestru (emisja, objęcie, uprawnienia, ograniczenia) to
wpisy na żądanie w rozumieniu art. 300³⁴ § 1 KSH (każdy odpłatny 100 zł), czy czynność objęta
wyłącznie opłatą za prowadzenie rejestru? (pytanie postawione wprost przez checklistę FAZA 2 —
zgłaszam zachowanie aplikacji, nie rozstrzygam)

- **Kontekst:** zbadałem OBIE ścieżki, którymi w aplikacji powstaje stan otwarcia rejestru, i
  zachowują się RÓŻNIE co do liczby opłat:
  1. **Wniosek portalowy → `POST /api/psa/wnioski/:id/przyjmij`** (`server/trasy/wnioski.js:820`):
     nalicza dokładnie JEDNĄ opłatę — `prowadzenie` (1200 zł, pierwszy rok) — i ZERO opłat `wpis`,
     niezależnie od tego, ile zdarzeń założycielskich powstanie później w kreatorze. Sam moment
     „przyjęcia wniosku" jeszcze nie zapisuje żadnej emisji/objęcia do `psa_zdarzenia`.
  2. **Kreator wewnętrzny → `POST /api/psa/spolki/:id/otworz-rejestr`** (patrz
     `testy-audyt/ZNALEZISKA.md` Z-108): zapisuje KOMPLET zdarzeń założycielskich (przetestowałem:
     emisja + objęcie, dwa zdarzenia w jednej transakcji) i nalicza ZERO opłat — ani `wpis`, ani
     `prowadzenie`. Komentarz w kodzie (`server/rejestr.js`, przy `dokonajWpisuSprawy`) mówi wprost:
     „Sciezka bezposrednia `dokonajWpisu` (migracja «stan otwarcia») celowo NIE przechodzi tedy —
     wpisywanie historycznego stanu nie jest biezaca czynnoscia odplatna."
- **Dlaczego nie rozstrzygnąłem sam:** to dokładnie pytanie, które checklista sesji każe ZGŁOSIĆ, a
  nie rozstrzygać samodzielnie („PYTANIE DO ŁUKASZA: czy wprowadzenie stanu otwarcia to wpisy na
  żądanie (...), czy czynność objęta opłatą za prowadzenie rejestru"). Dodatkowo odkryłem, że samo
  pytanie ma DWIE osobne odpowiedzi w kodzie, zależnie od ścieżki zakładania spółki — więc nawet
  przy uznaniu, że „stan otwarcia = tylko opłata za prowadzenie", to i tak ścieżka 2 (kreator
  wewnętrzny) nigdy tej opłaty automatycznie nie nalicza (Z-108) — to osobny problem, ale powiązany.
- **Pytanie:** (a) czy stan otwarcia rejestru (niezależnie od ścieżki, którą powstała spółka) ma być
  objęty WYŁĄCZNIE opłatą za prowadzenie rejestru (obecne zachowanie ścieżki 1), czy każde zdarzenie
  założycielskie osobno powinno być traktowane jak zwykły odpłatny wpis; (b) jeśli odpowiedź na (a)
  to „tylko prowadzenie" — czy ścieżka 2 (kreator wewnętrzny) powinna zostać poprawiona tak, żeby
  RÓWNIEŻ automatycznie naliczała pierwszy rok prowadzenia przy `otworz-rejestr` (patrz Z-108), żeby
  obie ścieżki zachowywały się identycznie.

## P-008 — Czy endpoint `POST /api/psa/oplaty/naliczenie-roczne` (kalendarzowy, martwy w UI) ma
zostać wyłączony/usunięty teraz, gdy istnieje mechanizm rocznicowy (`/odnowienia`), czy ma zostać
jako świadomie utrzymywana alternatywa?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-100 — KRYTYCZNE, potwierdzone empirycznie:
  wywołanie tego endpointu naliczyło DODATKOWĄ opłatę `prowadzenie` (1200 zł) dla WSZYSTKICH 9
  aktywnych spółek testowych naraz, mimo że część z nich miała już aktywną, pokrywającą się w
  czasie opłatę `prowadzenie` naliczoną przez mechanizm rocznicowy — bo oba mechanizmy sprawdzają
  idempotencję po INNEJ kolumnie (`okres` tekst vs `okres_od` data) i nie widzą się nawzajem.
  Komentarz w kodzie przy `naliczOdnowienia` mówi, że mechanizm rocznicowy „Zastepuje wsadowe
  «naliczenie roczne» po kalendarzu" — sugeruje to, że kalendarzowy miał zostać zarzucony, ale kod i
  endpoint API nadal istnieją i działają (wymagają tylko roli `admin`, żadnego dodatkowego
  potwierdzenia).
- **Dlaczego nie rozstrzygnąłem sam:** to decyzja o utrzymaniu/usunięciu działającego kodu
  produkcyjnego (endpoint API), nie kwestia interpretacji przepisu — a audyt jest read-only i nie
  naprawia kodu.
- **Pytanie:** czy endpoint `/naliczenie-roczne` i funkcje `naliczOplateProwadzenia`/
  `naliczOplateRoczneWszystkie` mają zostać całkowicie usunięte z kodu (bo są martwe z punktu
  widzenia UI i niebezpieczne przy przypadkowym wywołaniu), czy zabezpieczone (np. idempotencja po
  sprawdzeniu WSZYSTKICH aktywnych opłat `prowadzenie` danej spółki niezależnie od formatu `okres`,
  nie tylko dosłownego dopasowania tekstu), czy mają pozostać bez zmian do czasu dalszej decyzji.

## P-009 — Czy zakres dziennika dostępu do danych osobowych powinien objąć też odczyty przez konta
portalowe (rola „spółka"/„akcjonariusz"), nie tylko formalne wydanie informacji/eksport/pobranie pliku?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-152 i Z-150. Obecny, świadomie WĄSKI zakres
  dziennika (`server/migracje.js:934-940`) był uzasadniony ryzykiem „szumu" przy każdym
  wyświetleniu kokpitu/listy — rozumowanie sensowne dla PRACOWNIKA kancelarii przeglądającego
  własne sprawy wielokrotnie dziennie. Nie obejmuje jednak odczytów przez `typ_kto='portal'`
  (znacznie rzadszych), a to właśnie one, w połączeniu z Z-150 (wyciek AML/PEP/uwagi do roli
  „spółka" w surowym JSON-ie), są dziś całkowicie niewidoczne dla kogokolwiek próbującego ustalić
  po fakcie, kto i kiedy miał wgląd w czyje dane wrażliwe.
- **Dlaczego nie rozstrzygnąłem sam:** to decyzja produktowa (zakres logowania, koszt/korzyść), nie
  wymóg wprost z `PRZEPISY-PSA.md` (RODO/rozliczalność nie jest tam regulowane).
- **Pytanie:** czy rozszerzyć `psa_dziennik_dostepu` o zwykłe odczyty `GET
  /api/psa/portal/rejestr/:spolkaId` (i ewentualnie `GET /api/psa/portal/moje`) przez konta
  portalowe, zostawiając odczyty pracownicze bez zmian jak dotąd?

## P-010 — Jak naprawić rozjazd pól statusu PEP (`pep` vs `pep_oswiadczenie`) przy przejęciu
wniosku portalowego — i czy dokumenty RODO/PEP mają powstawać też dla akcjonariuszy dochodzących do
spółki PO jej założeniu?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-151 i Z-153. `psa_wnioski_akcjonariusze` nie ma
  w ogóle kolumny `pep_oswiadczenie` (tylko `pep`/`pep_opis`), więc przy przejęciu wniosku wartość
  z formularza (faktycznie: to, co osoba PODPISUJE na oświadczeniu AML) trafia wyłącznie do
  `psa_osoby.pep` — pola opisanego w kodzie jako „ustalenie kancelarii", nigdy do
  `pep_oswiadczenie` — pola opisanego jako „oświadczenie osoby". Osobno: dokumenty RODO/PEP
  (`dokumenty-wniosku.js`) generują się WYŁĄCZNIE przy jednorazowym zakładaniu spółki przez
  wniosek — żaden typ zdarzenia w zwykłym kreatorze (`przeniesienie`, `objecie` itd.) nie generuje
  ich dla nowego akcjonariusza dochodzącego do już istniejącej spółki.
- **Dlaczego nie rozstrzygnąłem sam:** obie kwestie to decyzje o kształcie procesu (które pole ma
  się czym zasilać, czy dokument ma powstawać przy KAŻDYM wejściu nowej osoby do rejestru czy tylko
  przy założeniu spółki), nie luki w `PRZEPISY-PSA.md` (PEP/RODO są poza KSH).
- **Pytanie:** (a) czy przy przejęciu wniosku wartość z formularza ma iść do `pep_oswiadczenie`
  (bo to faktycznie oświadczenie podpisywane przez osobę), zostawiając `pep` do późniejszej,
  niezależnej oceny kancelarii — czy odwrotnie/inaczej; (b) czy typy zdarzeń wprowadzające nową
  osobę do rejestru już istniejącej spółki (`objecie`, `przeniesienie` na rzecz nowego
  akcjonariusza) powinny doczepiać do checklisty obowiązek wygenerowania i podpisania klauzuli
  RODO oraz (przy włączonej procedurze AML) oświadczenia PEP, analogicznie do wniosku.

## P-011 — Czy „stan na" z dokładnością do minuty ma wrócić do UI kokpitu (dziś dostępne wyłącznie
przez API), i czy interpretacja strefy czasowej dla tej funkcji ma być jawnie wymuszona programowo
zamiast polegać na zmiennej środowiskowej `TZ`?

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-305 i Z-306 (FAZA 6). Backend w pełni obsługuje
  „stan na chwilę" (`RRRR-MM-DDTGG:MM[:SS]`, filtrowanie po `data_wpisu`) — dokładnie mechanizm
  opisany w `CLAUDE-PSA.md` sekcja 9 („z dokładnością do minuty, bo wpisy z tego samego dnia mają
  kolejność"). Ale rzeczywisty kokpit (`publiczne/js/kokpit.js`) używa wyłącznie pola typu data
  (bez godziny) — komentarz w kodzie sugeruje, że to świadoma redukcja z wcześniejszej wersji UI
  („oś zniknęła, więc została sama data"). Dodatkowo, tam gdzie mechanizm chwili JEST używany
  (poziom API), jego poprawność zależy w 100% od zmiennej środowiskowej `TZ` procesu serwera, bez
  żadnej walidacji przy starcie — potwierdzone empirycznie, że identyczny parametr zapytania daje
  różne chwile absolutne w zależności od `TZ` (`Z-306`).
- **Dlaczego nie rozstrzygnąłem sam:** (a) czy usunięcie precyzji do minuty z UI było świadomą
  decyzją produktową (np. bo funkcja okazała się niepotrzebna/myląca w praktyce) czy przypadkową
  regresją przy którejś zmianie interfejsu — nie mam dostępu do historii tej decyzji; audyt jest
  read-only, więc nie przywracam pola samodzielnie. (b) wybór sposobu zabezpieczenia przed
  błędną konfiguracją `TZ` (asercja przy starcie, wymuszenie programowe, czy zaakceptowanie ryzyka
  jako część checklisty wdrożeniowej z sekcji 2 `CLAUDE-PSA.md`) to decyzja o priorytecie pracy przy
  wdrożeniu produkcyjnym, nie kwestia zgodności z przepisem.
- **Pytanie:** (a) czy pole godziny ma wrócić do kokpitu (zgodnie z dosłownym brzmieniem
  `CLAUDE-PSA.md` sekcja 9), czy specyfikacja ma zostać zaktualizowana, żeby odzwierciedlić obecne,
  uproszczone zachowanie (samo „stan na dzień")? (b) czy wdrożenie produkcyjne ma programowo
  wymuszać `TZ=Europe/Warsaw` niezależnie od tego, co ustawi platforma hostingowa, czy wystarczy to
  udokumentować jako wymóg konfiguracyjny w `.env` (obecny stan)?

---

# FAZA 4 — pytania (P-012 … P-014)

## P-012 — Czy zdalna identyfikacja akcjonariusza wyłącznie na podstawie danych przekazanych przez
spółkę i skanu dokumentu spełnia wymogi środków bezpieczeństwa finansowego (pytanie wskazane wprost
w treści zadania FAZA 4)

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-210 dla pełnego, faktycznego opisu, na czym
  dziś opiera się identyfikacja akcjonariusza (bez oceny wystarczalności — to właśnie jest to
  pytanie). W skrócie: (1) dane opisowe wpisane przez spółkę/wnioskodawcę w formularzu wniosku,
  zweryfikowane przez kancelarię wyłącznie pod kątem spójności z KRS i kartoteką (nie tożsamości);
  (2) skan dokumentu tożsamości reprezentanta — zbierany bezwarunkowo, ale komentarz w samym kodzie
  (`server/trasy/portal.js:969-971`) przyznaje: „Sam obraz dokumentu nie dowodzi tożsamości (można
  go mieć nie będąc właścicielem)"; (3) opcjonalny, domyślnie WYŁĄCZONY (`stosuje_procedure_aml`)
  skan dokumentu AML wgrywany przez pracownika kancelarii, nigdy nie przez samego akcjonariusza; (4)
  samoidentyfikacja w podpisanym oświadczeniu AML/PEP; (5) ostateczna decyzja `aml_status =
  wykonane` to swobodny osąd pracownika, bez wymogu uzasadnienia.
- **Dlaczego nie rozstrzygnąłem sam:** to dokładnie pytanie merytoryczne wskazane w
  `SESJA-PSA-AUDYT.md` na końcu sekcji FAZA 4, wymagające potwierdzenia przy tekście ustawy AML —
  cała podstawa (PRZEPISY-PSA.md § 9) jest oznaczona ⚠️.
- **Pytanie:** czy opisany wyżej zestaw (dane + nieobowiązkowy skan wgrywany przez pracownika, nie
  przez samego akcjonariusza + samoidentyfikacja + swobodny osąd) wystarcza jako środek
  bezpieczeństwa finansowego, czy ustawa wymaga metody dającej wyższy poziom pewności (podpis
  kwalifikowany samego akcjonariusza jako WARUNEK, nie tylko dopuszczalna forma umowy; weryfikacja
  wideo; przelew referencyjny; osobiste stawiennictwo)? Powiązane pytanie techniczne: czy skan
  dokumentu tożsamości powinien móc wgrywać SAM akcjonariusz (dziś może to zrobić wyłącznie
  pracownik kancelarii, `POST /api/psa/osoby/:id/aml-skany` jest za `wymagajPracownika`)?

## P-013 — Czy status AML `brak` (weryfikacja jeszcze niewykonana) powinien blokować wpis
transakcyjny tak samo jak `niemozliwe`, czy obecne zachowanie (ostrzeżenie, nie blokada) jest
zamierzone

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-200 (KRYTYCZNY) i Z-201/Z-202/Z-204. Bramka AML
  (`server/logika/walidacje.js: sprawdzAml`) blokuje wpis (`bledy`, wpis odrzucony) WYŁĄCZNIE dla
  jawnie ustawionego `aml_status: 'niemozliwe'`. Dla stanu domyślnego `brak` — czyli KAŻDEJ nowej
  osoby w kartotece, dopóki pracownik ręcznie nie zmieni statusu — generowane jest wyłącznie
  ostrzeżenie (`ostrzezenia`), które NIE blokuje zapisu. Potwierdzone bezpośrednim żądaniem: emisja
  założycielska i przeniesienie akcji na rzecz osoby bez jakiejkolwiek weryfikacji AML przechodzą
  ze statusem `201 Created`. Zachowanie jest identyczne na wszystkich trzech drogach zapisu
  zdarzenia (`POST .../zdarzenia`, `POST .../wpisz` przez sprawę, `POST .../otworz-rejestr`) — to
  nie jest błąd pojedynczego endpointu, tylko cecha wspólnej funkcji walidującej.
- **Dlaczego nie rozstrzygnąłem sam:** komentarz w `server/logika/przepisy.js` przy `AML_STATUSY`
  cytuje zasadę „brak możliwości zastosowania środków bezpieczeństwa finansowego = przeszkoda
  wpisu, przy nieusunięciu — odmowa wpisu" jako uzasadnienie ISTNIEJĄCEGO kodu, ale sam kod
  realizuje tę zasadę tylko dla `niemozliwe`, nie dla „jeszcze nie zweryfikowano" — to rozbieżność
  między komentarzem/uzasadnieniem a implementacją, którą PRZEPISY-PSA.md § 9 (⚠️ niezweryfikowana)
  nie rozstrzyga jednoznacznie samodzielnie.
- **Pytanie:** czy `aml_status: 'brak'` w chwili wpisu transakcyjnego (objęcie, przeniesienie,
  obciążenie na rzecz nowego uprawnionego) powinien BLOKOWAĆ wpis (tak jak `niemozliwe`, tyle że
  z innym komunikatem — „nie wykonano jeszcze weryfikacji" zamiast „weryfikacja niemożliwa"), czy
  obecne zachowanie (ostrzeżenie, decyzja zostaje przy pracowniku, który może je zignorować) jest
  świadomym, zaakceptowanym kompromisem operacyjnym?

## P-014 — Czy dezaktualizacja AML (upływ terminu przeglądu) i brak zidentyfikowanego beneficjenta
rzeczywistego dla nabywcy-osoby prawnej powinny mieć skutek blokujący wpis

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-202 (przegląd okresowy — dziś czysto kosmetyczny
  znacznik w kartotece, `aml.wymagaPrzegladu()`, nigdy nieużywany przez `sprawdzAml`) i Z-203
  (bramka nie rozróżnia osoby fizycznej/prawnej i nigdy nie sprawdza statusu beneficjenta
  rzeczywistego, nawet gdy jest wskazany w kartotece).
- **Dlaczego nie rozstrzygnąłem sam:** oba elementy (termin przeglądu 12 miesięcy, rozgraniczenie
  fizyczna/prawna przy beneficjencie) są — zgodnie z komentarzem wprost w
  `server/logika/przepisy.js` — „świadomą nadwyżką" wobec treści PRZEPISY-PSA.md § 9, pochodzącą
  z wcześniejszych decyzji roboczych, nie z brzmienia ustawy zweryfikowanego w tym pliku.
- **Pytanie:** (a) czy osoba z przeterminowanym `aml_status: 'wykonane'` (upłynęło ponad 12
  miesięcy od `aml_data`/`aml_data_przegladu`) powinna być przy nowej transakcji traktowana jak
  `brak` (ostrzeżenie/blokada — zależnie od odpowiedzi na P-013), czy termin przeglądu ma
  pozostać wyłącznie sygnałem informacyjnym dla pracownika; (b) czy dla nabywcy-osoby prawnej
  bramka AML powinna wymagać wskazania i zweryfikowania AML beneficjenta rzeczywistego jako
  ODRĘBNEGO warunku, czy wystarczy `aml_status` ustawiony na samym podmiocie prawnym.

## P-015 — Czy aplikacja ma docelowo obsługiwać oznaczanie danych jako testowe/demonstracyjne
na koncie produkcyjnym, czy testowanie zawsze odbywa się na osobnej instancji/bazie

- **Kontekst:** patrz `testy-audyt/ZNALEZISKA.md` Z-350 (kartoteka osób bez ochrony przed
  duplikatem — dwie różne osoby mogą mieć ten sam PESEL) i Z-359 (brak w całym schemacie bazy
  jakiegokolwiek pola oznaczającego rekord spółki/osoby/zdarzenia jako testowy — jedyny wyjątek,
  `psa_platnosci.tryb_testowy`, dotyczy wyłącznie piaskownicy operatora płatności Tpay, nie danych
  merytorycznych rejestru). W toku samego tego audytu utworzyłem przez API kilkanaście spółek i
  osób testowych w bazie `./dane/audyt-test.db` — w bazie PRODUKCYJNEJ, bez takiego mechanizmu,
  identyczne rekordy (np. założone przez pracownika w celu przeszkolenia się z aplikacją) byłyby
  nieodróżnialne od prawdziwych spraw klientów kancelarii.
- **Dlaczego nie rozstrzygnąłem sam:** to pytanie o docelowy sposób pracy z aplikacją (czy
  kancelaria będzie mieć osobne środowisko szkoleniowo-testowe, czy pracownicy mogą/będą czasem
  „klikać na produkcji"), nie o błąd w kodzie — `PRZEPISY-PSA.md`/`CLAUDE-PSA.md` się do tego nie
  odnoszą.
- **Pytanie:** czy potrzebny jest mechanizm oznaczania spółki/sprawy jako „testowa” (np. widoczna
  plakietka na każdym ekranie jej dotyczącym, wykluczenie z zestawień i eksportów), czy
  wystarczające jest organizacyjne zobowiązanie, że wszelkie testy/demonstracje odbywają się
  wyłącznie na osobnej instalacji, nigdy na koncie z prawdziwymi sprawami klientów?
