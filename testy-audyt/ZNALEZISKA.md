# Znaleziska audytu PSA — log narastający

> Format: co zrobiłem → co się stało → co powinno się stać → podstawa → waga.
> Waga: KRYTYCZNY / POWAŻNY / DROBNY. Kolejne fazy dopisują na końcu, nie zmieniają numeracji
> wcześniejszych wpisów.

## Z-001 [DROBNY/do potwierdzenia wagi] — `GET /api/psa/meta` w pełni publiczny

- **Co zrobiłem:** `curl http://localhost:3005/api/psa/meta` bez żadnych ciasteczek/logowania.
- **Co się stało:** HTTP 200, pełna treść JSON — słowniki typów zdarzeń, checklisty, podstawy
  prawne, flagi `portal_wlaczony`/`podglad_systemu`.
- **Co powinno się stać:** endpoint pod prefiksem `/api/psa/*` w każdym innym pliku wymaga sesji
  pracownika (`wymagajPracownika`); ten jeden endpoint w `pozostale.js` (linia 68) nie ma żadnego
  middleware, mimo że plik jest montowany bez gate na poziomie `app.use` (każda trasa musi go
  dodać sama — ta jedna tego nie zrobiła).
- **Podstawa:** zasada techniczna (spójność modelu autoryzacji), nie przepis ustawy — dane
  ujawnione to metadane systemu (słowniki), nie dane osobowe ani rejestrowe konkretnej spółki.
- **Waga:** DROBNY–POWAŻNY (do ostatecznej klasyfikacji w FAZA 5 — ujawnia wewnętrzną logikę
  biznesową/checklisty bez uwierzytelnienia, ale bez danych osobowych ani dostępu do konkretnego
  rejestru).

## Z-002 [POWAŻNY] — zacommitowany plik `:memory:` (prawdziwa baza SQLite) w repozytorium

- **Co zrobiłem:** `git ls-files | grep ':memory:'`, otworzyłem plik przez `better-sqlite3`.
- **Co się stało:** plik `:memory:` w korzeniu repo jest śledzony przez git i jest prawdziwą bazą
  SQLite (71 stron). Wszystkie tabele `psa_*` puste (0 wierszy), tylko `psa_migracje` ma 35
  rekordów metadanych migracji — brak danych osobowych.
- **Co powinno się stać:** `WSPOLNA_BAZA=:memory:` w `.env` powinno dać efemeryczną bazę w
  pamięci (standardowa konwencja SQLite). Zamiast tego `server/konfiguracja.js::sciezka()` zawsze
  wywołuje `path.resolve(KATALOG_GLOWNY, wartosc)`, więc `:memory:` zamienia się w realną ścieżkę
  pliku na dysku w korzeniu repo — i w tym wypadku trafiła do gita.
- **Podstawa:** zasada techniczna — błąd konfiguracji + higiena repozytorium (przypadkowy
  artefakt w historii git). Art. 300³¹ § 4 KSH (bezpieczeństwo i integralność rejestru) czyni tego
  typu pomyłki tym bardziej istotnymi, mimo że akurat ten plik jest pusty.
- **Sprawdziłem dodatkowo:** `testy/pomoc.js:14` wywołuje `baza.otworz(':memory:')` bezpośrednio,
  z pominięciem `konfiguracja.sciezka()` — testy jednostkowe NIE są dotknięte tym błędem i dostają
  prawdziwą bazę w pamięci. Błąd materializuje się wyłącznie przy ustawieniu zmiennej środowiskowej
  `WSPOLNA_BAZA=:memory:` w `.env`, co przechodzi przez `sciezka()`.
- **Waga:** POWAŻNY (błąd konfiguracji — każdy, kto świadomie ustawi `WSPOLNA_BAZA=:memory:`
  licząc na efemeryczną bazę np. do jednorazowego testu na produkcyjnym hoście, dostanie trwały
  plik na dysku; potwierdzony przypadek trafienia takiego pliku do repozytorium git).

## FAZA 1 — warianty S2–S6 (zakres Z-050…Z-079)

## Z-050 [POZYTYWNE — DO POTWIERDZENIA] — S2: rada dyrektorów poprawnie adresowana we wszystkich
dokumentach, żadnego twardego „zarząd"

- **Co zrobiłem:** utworzyłem spółkę testową (`POST /api/psa/spolki/`, id=1, „Audyt S2 Rada
  Dyrektorow…") z `organ_rodzaj: "rada_dyrektorow"`, dwóch akcjonariuszy, otworzyłem rejestr
  (emisja 100 akcji serii A + objęcie 60/40) przez `POST /api/psa/spolki/1/otworz-rejestr`, potem
  bezpośrednim żądaniem API (z pominięciem formularza) założyłem sprawę `przeniesienie`, zweryfikowałem,
  wysłałem powiadomienie, dokonałem wpisu (`POST /api/psa/sprawy/1/wpisz`) i wygenerowałem komplet
  zawiadomień (`POST /api/psa/zawiadomienia/wyslij`). Sprawdziłem treść wygenerowanych dokumentów:
  „Umowa o prowadzenie rejestru" (wzór 01, podgląd `POST /api/psa/spolki/1/dokumenty/01/podglad`),
  „Zawiadomienie o dokonaniu wpisu" do spółki (wzór 07, `GET /api/psa/sprawy/1/wydane/3`) i „Lista
  akcjonariuszy do sądu" / „Wykaz akcjonariuszy".
- **Co się stało:** we wszystkich sprawdzonych dokumentach organ jest poprawnie podstawiony jako
  „Rada Dyrektorów" / „rady dyrektorów" — m.in. nagłówek adresata „Rada Dyrektorów spółki…", zdanie
  „Po otrzymaniu niniejszego zawiadomienia Rada Dyrektorów niezwłocznie składa do sądu rejestrowego
  listę akcjonariuszy podpisaną przez wszystkich członków rady dyrektorów…" (art. 300³⁴ § 8 KSH).
  Nigdzie nie znalazłem twardo wpisanego „zarząd"/„członkowie zarządu" mimo wybrania rady
  dyrektorów — mechanizm `{{spolka_organ}}`/`{{spolka_organ_czlonkowie}}`
  (`server/logika/kontekst-pisma.js:169-181`, słownik `OPISY_ORGANOW` w `server/logika/przepisy.js`)
  jest konsekwentnie użyty we wszystkich wzorach `.docx` (sprawdzone grepem po rozpakowanej treści
  `word/document.xml` wszystkich 10 wzorów — żaden nie ma twardego „Zarząd" poza placeholderem).
  `POST /api/psa/spolki/` i `POST /api/psa/portal/wniosek` (pole `organ_rodzaj`) poprawnie
  przyjmują wartość `rada_dyrektorow` (walidacja `spolki.js:131` dopuszcza tylko `zarzad` albo
  `rada_dyrektorow`).
- **Co powinno się stać:** dokładnie to, co się stało — dokumenty mają adresować organ faktycznie
  wybrany przez spółkę (art. 300⁵² § 1 KSH — rada dyrektorów jako organ P.S.A.).
- **Podstawa:** art. 300⁵² § 1 KSH (rada dyrektorów jako alternatywny organ P.S.A.); art. 300³⁴ § 8
  KSH (lista akcjonariuszy do sądu podpisana przez organ).
- **Waga:** POZYTYWNE (brak błędu) — zapisuję zgodnie z instrukcją sesji, żeby pokrycie było pełne.
  Nie sprawdziłem wszystkich pozostałych wzorów (05 powiadomienie o zamierzonym wpisie, 06 wezwanie,
  09 zawiadomienie o odmowie) z tą samą spółką — te trzy nie zostały wywołane w tym przebiegu; z
  przeglądu treści `.docx` (sekcja „co zrobiłem" w Z-002/FAZA 0) wynika, że żaden z pozostałych
  wzorów nie zawiera frazy „zarząd" w ogóle, więc ryzyko jest niskie, ale nie jest to zweryfikowane
  na żywych danych rady dyrektorów.
  Dodatkowo: kokpit spółki (widok READ-ONLY, `publiczne/js/kokpit.js`) NIE pokazuje nigdzie wybranego `organ_rodzaj` — pole jest widoczne wyłącznie w formularzu edycji danych spółki (`publiczne/js/spolki.js:456-465`, etykieta „Organ zarządzający”, z podpowiedzią „Widoczne na pismach jako adresat po stronie spółki”). Pracownik nie ma jak sprawdzić na pierwszy rzut oka, czy dana spółka ma zarząd czy radę dyrektorów, bez wejścia w edycję danych spółki — drobny brak UX, nie błąd merytoryczny.

## Z-051 [DROBNY] — procent udziału bez zaokrąglenia w dwóch miejscach: „Wykaz akcjonariuszy" i
eksport `stan.csv`

- **Co zrobiłem:** przy spółce z Z-050 (60/40 akcji, potem przeniesienie 5 akcji → 55/45) pobrałem
  dokument „Wykaz akcjonariuszy" (art. 476 § 1¹ KSH, wygenerowany automatycznie razem z
  zawiadomieniem o wpisie, `GET /api/psa/sprawy/1/wydane/4`).
- **Co się stało:** kolumna „Udział" pokazuje `55.00000000000001%` zamiast `55%` — surowy wynik
  dzielenia zmiennoprzecinkowego (`server/logika/stan.js:983`:
  `p.procent = razem === 0 ? 0 : (p.ilosc / razem) * 100;`) trafia bez zaokrąglenia wprost do
  szablonu HTML (`server/logika/dokumenty-tresc.js:214`: `${esc(a.procent)}%`, brak `toFixed`).
  Ten sam surowy `a.procent` trafia też bez zaokrąglenia do eksportu `GET /api/psa/spolki/:id/stan.csv`
  (`server/trasy/spolki.js:444`). Dla porównania: kokpit UI (`publiczne/js/kokpit.js:104`,
  `fmt.procent(...)`) i „Informacja z rejestru" (`server/logika/informacja-dokument.js:64`,
  `Number(p).toFixed(2)`) zaokrąglają poprawnie — błąd dotyczy WYŁĄCZNIE tych dwóch miejsc.
- **Co powinno się stać:** zgodnie z regułą domenową 4a z `CLAUDE-PSA.md` („procent udziału liczony
  na ułamkach, zaokrąglany WYŁĄCZNIE przy wyświetlaniu") każde miejsce wyświetlające/drukujące
  procent powinno przechodzić przez to samo zaokrąglenie (analogicznie do `procent()` w
  `informacja-dokument.js`), a nie ujawniać artefakt reprezentacji zmiennoprzecinkowej. Jest to tym
  bardziej istotne, że „Wykaz akcjonariuszy" to dokument idący do sądu rejestrowego (art. 476 § 1¹
  KSH), nie tylko wewnętrzny podgląd.
- **Podstawa:** zasada techniczna — reguła domenowa 4a `CLAUDE-PSA.md` („zaokrąglanie wyłącznie przy
  wyświetlaniu"); dokument dotyczy art. 476 § 1¹ KSH (wykaz akcjonariuszy przy wykreśleniu spółki).
- **Waga:** DROBNY (błąd kosmetyczny, nie wpływa na treść merytoryczną ani na bilans akcji), ale
  widoczny na dokumencie urzędowym kierowanym do sądu — do rozważenia podniesienia do POWAŻNY przy
  ocenie przez Łukasza.

## Z-052 [POZYTYWNE] — S3: osoba prawna jako akcjonariusz poprawnie rozróżniona od osoby fizycznej

- **Co zrobiłem:** utworzyłem spółkę testową (id=2, „Audyt S3 Osoba Prawna…"), bezpośrednim
  żądaniem `POST /api/psa/osoby/` utworzyłem akcjonariusza `typ: "prawna"` (bez PESEL/daty
  urodzenia, z `numer_w_rejestrze`+`nazwa_rejestru`+`nip`+`regon`), otworzyłem rejestr z tym
  podmiotem jako jednym z dwóch akcjonariuszy (70/30 akcji) i sprawdziłem `GET /api/psa/spolki/2/stan`
  oraz walidacje krzyżowe pola `beneficjent_rzeczywisty_id` (`server/trasy/osoby.js:149-162`).
- **Co się stało:**
  1. `POST /api/psa/osoby/` z `typ:"prawna"` wymaga `nazwa` (nie `nazwisko`) — próba bez `nazwa`
     zwraca 400 „Nazwa podmiotu jest wymagana." (nie testowałem tej gałęzi wprost tym razem, ale
     kod `osoby.js:83-85` to potwierdza; walidacje ustawowe `akcjonariusz.js:120-125` sprawdzają dla
     `prawna` wyłącznie firmę i spójność `numer_w_rejestrze`/`nazwa_rejestru`, NIGDY PESEL/datę
     urodzenia).
  2. `jawny_identyfikator` w odpowiedzi API poprawnie pokazuje `"KRS 0000999999"` dla osoby prawnej
     zamiast identyfikatora osoby fizycznej.
  3. Walidacja krzyżowa `beneficjent_rzeczywisty_id` działa poprawnie w obie strony: (a) próba
     wskazania beneficjenta rzeczywistego, który sam jest osobą PRAWNĄ → 400 „Beneficjent
     rzeczywisty musi być osobą fizyczną."; (b) próba wskazania beneficjenta rzeczywistego dla
     osoby FIZYCZNEJ (pole ma sens tylko dla `prawna`) → 400 „Beneficjenta rzeczywistego wskazuje
     się wyłącznie dla osoby prawnej."; (c) wskazanie osoby fizycznej jako beneficjenta osoby
     prawnej → 200, zapisane poprawnie.
- **Co powinno się stać:** dokładnie to — formularz/API ma odróżniać typ akcjonariusza i nie żądać
  pól właściwych wyłącznie osobie fizycznej (PRZEPISY-PSA.md sekcja 12 pkt 2 — PESEL i data
  urodzenia NIE są ustawową treścią rejestru P.S.A. dla nikogo, a tym bardziej nie mają sensu dla
  osoby prawnej).
- **Podstawa:** art. 300³³ § 1 pkt 5 KSH (nazwisko i imię ALBO firma/nazwa akcjonariusza); zasada
  techniczna (spójność modelu beneficjenta rzeczywistego, art. 2 ust. 2 pkt 1 ustawy AML — ta
  ostatnia podstawa oznaczona ⚠️ w `PRZEPISY-PSA.md` sekcja 9, niepotwierdzona wprost w tym pliku).
- **Waga:** POZYTYWNE (brak błędu w rozróżnieniu typów i w walidacji krzyżowej).

## Z-053 [DROBNY/PYTANIE] — S3: pole `beneficjent_rzeczywisty_id` jest w pełni opcjonalne, zero
sygnału ostrzegawczego przy jego braku dla osoby prawnej

- **Co zrobiłem:** utworzyłem osobę `typ: "prawna"` (id=3) BEZ podania `beneficjent_rzeczywisty_id`
  i sprawdziłem pola `ostrzezenia`/`braki_ustawowe` w odpowiedzi, oraz `wymaga_przegladu_aml`.
- **Co się stało:** zapis się powiódł, `ostrzezenia: []`, `braki_ustawowe: []` — żaden sygnał
  (nawet miękki, nieblokujący) nie informuje kancelarii, że dla akcjonariusza-osoby prawnej nie
  wskazano beneficjenta rzeczywistego. Dla porównania, inne braki AML mają swój sygnał
  (`wymaga_przegladu_aml` z `server/logika/aml.js`, ostrzeżenie o rozbieżności PEP w
  `osoby.js:134-138`) — beneficjent rzeczywisty nie ma odpowiednika.
- **Co powinno się stać:** nierozstrzygnięte bez decyzji Łukasza — podstawa AML dla beneficjenta
  rzeczywistego jest oznaczona ⚠️ w `PRZEPISY-PSA.md` (sekcja 9, „AML i taksa" — do zweryfikowania
  przy tekście ustawy), więc **nie może dziś być podstawą blokady** zgodnie z sekcją 13 tego pliku.
  Ale brak JAKIEGOKOLWIEK sygnału (nawet nieblokującego, analogicznego do `wymaga_przegladu_aml`)
  wygląda na lukę w skądinąd starannie zaprojektowanym systemie miękkich sygnałów AML — zapisuję
  też jako pytanie do Łukasza w `PYTANIA-DO-LUKASZA.md`.
- **Podstawa:** brak jednostki redakcyjnej w `PRZEPISY-PSA.md` dla wymogu identyfikacji
  beneficjenta rzeczywistego przy KYC akcjonariusza-osoby prawnej w tym module — do potwierdzenia.
- **Waga:** DROBNY (dziś nie narusza żadnej potwierdzonej reguły; potencjalnie POWAŻNY, jeśli
  Łukasz potwierdzi obowiązek identyfikacji beneficjenta rzeczywistego przy wpisie transakcyjnym
  dotyczącym osoby prawnej — patrz WYTYCZNE-MERYTORYCZNE-PSA.md sekcja 7).
- **Doprecyzowanie po dodatkowym teście:** pole `beneficjent_rzeczywisty_id` w formularzu „Nowa osoba w kartotece" (`publiczne/js/osoby.js:439-440`) pokazuje się w UI wyłącznie, gdy wybrana spółka ma włączony przełącznik „Stosuje procedurę AML" (`psa_spolki.stosuje_procedure_aml`, domyślnie WYŁĄCZONY). Włączyłem ten przełącznik dla spółki S3 (`PUT /api/psa/spolki/2`,
  `stosuje_procedure_aml: true`) i sprawdziłem `server/trasy/osoby.js` — flaga steruje WYŁĄCZNIE dostępem do uploadu skanu AML (`wymagajProceduryAml`, linie 356-358), nie wpływa w ogóle na `sprawdzOsobe`/`ostrzezeniaOsoby` (walidację zapisu osoby). Innymi słowy: nawet przy świadomie włączonej procedurze AML dla spółki, zapis akcjonariusza-osoby prawnej bez beneficjenta rzeczywistego wciąż nie generuje żadnego ostrzeżenia — luka z Z-053 utrzymuje się niezależnie od stanu tego przełącznika.

## Z-054 [KRYTYCZNY] — S4: wzmianka o niepełnym pokryciu ZNIKA po zwykłym przeniesieniu akcji —
blokada z art. 300⁴⁰ § 1 KSH omijalna po jednej transakcji

- **Co zrobiłem:** utworzyłem spółkę testową (id=3, „Audyt S4 Pokrycie Częściowe…"), emisję 50 akcji
  serii A, i objęcie WSZYSTKICH 50 przez akcjonariusza „Dorota Zbywcowa" ze wzmianką
  `pokryta: "czesciowo"` (`POST /api/psa/spolki/3/otworz-rejestr`). Przy okazji spróbowałem
  bezpośrednim żądaniem przemycić do pozycji objęcia pola `kwota_wplaty_grosze`,
  `kwota_wplacona_grosze`, `procent_pokrycia` — sprawdziłem `dane_json` zapisanego zdarzenia.
  Następnie bezpośrednim żądaniem `POST /api/psa/spolki/3/zdarzenia` (z pominięciem formularza/
  workflow spraw) wykonałem: (1) przeniesienie 10 z tych 50 akcji (nr 1–10) od Doroty do „Edwarda
  Nabywcy" BEZ `zgoda_spolki_niepelne_pokrycie` (oczekiwano blokady), (2) tę samą operację Z
  `zgoda_spolki_niepelne_pokrycie: true`, (3) kolejne przeniesienie TYCH SAMYCH 10 akcji (nr 1–10)
  od Edwarda do „Filipa TrzeciegoNabywcy", ponownie BEZ `zgoda_spolki_niepelne_pokrycie`. Sprawdziłem
  też wygenerowany dokument „Informacja z rejestru" (`GET /api/psa/spolki/3/informacja.html`).
- **Co się stało:**
  1. Wstrzyknięte pola pieniężne (`kwota_wplaty_grosze` itd.) zostały całkowicie zignorowane —
     `dane_json` zdarzenia `objecie` zawiera wyłącznie `"pokryta":"czesciowo"`, żadnej kwoty. To
     potwierdza praktycznie znalezisko FAZA 0 (reguła 4c „CZĘŚCIOWO") — API nie przyjmuje ŻADNEJ
     kwoty wpłaty, nie tylko nie liczy rozdziału — nie ma nawet pola do jej zapisania.
  2. Krok (1) został poprawnie ZABLOKOWANY: HTTP 422, „Akcje 1–10 nie są w pełni pokryte — zbycie
     wymaga zgody spółki (art. 300(40) § 1 KSH). Zgoda nie została odnotowana." — blokada działa na
     poziomie API, nie tylko UI (zgodnie z regułą 4c z `CLAUDE-PSA.md`).
  3. Krok (2), z flagą zgody, przeszedł poprawnie: HTTP 201.
  4. **Krok (3) — KLUCZOWY BŁĄD — przeszedł BEZ ŻADNEJ BLOKADY (HTTP 201)**, mimo że akcje nr 1–10
     WCIĄŻ nie są w pełni pokryte (żadne zdarzenie `pokrycie_akcji` nie zostało nigdy zapisane).
     Sprawdzenie „Informacji z rejestru" potwierdza przyczynę: po kroku (2) akcje 1–10 u Edwarda
     mają w rejestrze **„Pokrycie: brak wzmianki"** (zamiast odziedziczonego „częściowo" po Dorocie)
     — wzmianka o niepełnym pokryciu **znika przy zwykłym `przeniesienie`**, mimo że dotyczy tych
     samych, fizycznie tych samych, wciąż nieopłaconych w całości akcji.
- **Przyczyna (potwierdzona w kodzie):** `server/logika/stan.js`, handler `objecie` (linia ~332-350)
  poprawnie przekazuje `pokryta: poz.pokryta || null` do `przenies()`. Handler
  `przeniesienie_ulamka` (linia ~431-499) też poprawnie PRZENOSI wzmiankę o pokryciu razem z
  ułamkiem (komentarz w kodzie: „Pokrycie... jest atrybutem SAMEJ AKCJI... przechodzi wraz z
  ułamkiem niezmienione"). Ale handler zwykłego `przeniesienie` (linia ~353-368) wywołuje
  `przenies(stan, {..., tytul: d.tytul_prawny || 'przeniesienie akcji'})` **BEZ pola `pokryta`
  w ogóle** — funkcja `przenies()` (linia ~240-259) przekazuje `pokryta: opcje.pokryta` do
  `otworz()`, co przy braku pola daje `undefined`/`null`. Zasada wypisana wprost w komentarzu przy
  `przeniesienie_ulamka` NIE została zastosowana przy zwykłym `przeniesienie` — niespójność między
  dwoma bliźniaczymi typami zdarzeń.
- **Skutek praktyczny:** blokada z art. 300⁴⁰ § 1 KSH (zgoda spółki na zbycie akcji nie w pełni
  pokrytej) jest skuteczna wyłącznie przy PIERWSZYM przeniesieniu niepokrytych akcji od pierwotnego
  obejmującego. Każde KOLEJNE przeniesienie tych samych, wciąż nieopłaconych akcji, przechodzi już
  bez żadnej zgody i bez żadnego ostrzeżenia — bo rejestr „zapomina" o niepełnym pokryciu po
  jednym kroku. To też podważa możliwość wyegzekwowania art. 300⁴⁰ § 3 KSH (solidarna
  odpowiedzialność nabywcy ze zbywcą za dopłatę pozostałej części wkładu) wobec kolejnych nabywców,
  bo rejestr nie pokazuje już, że dług istnieje.
- **Co powinno się stać:** wzmianka o pokryciu (art. 300³³ § 1 pkt 9 KSH) jest atrybutem AKCJI, nie
  transakcji ani osoby — powinna przechodzić NIEZMIENIONA przy każdym przeniesieniu całych akcji,
  dokładnie tak, jak już działa to dla `przeniesienie_ulamka`, i znikać wyłącznie przez osobne,
  jawne zdarzenie `pokrycie_akcji` (uchwała zarządu stwierdzająca wniesienie wkładu, art. 300⁹ § 2).
- **Podstawa:** art. 300⁴⁰ § 1 i § 3 KSH (blokada zbycia akcji nie w pełni pokrytej bez zgody
  spółki + solidarna odpowiedzialność nabywcy); art. 300³³ § 1 pkt 9 KSH (wzmianka o pokryciu jako
  treść rejestru); reguła domenowa 4c `CLAUDE-PSA.md` („Zbycie akcji nie w pełni pokrytej wymaga
  zgody spółki — reguła blokująca" — bez zastrzeżenia, że dotyczy to tylko pierwszego zbycia).
- **Waga:** KRYTYCZNY — realna, dwuklikowa (dwa kolejne `POST` bez żadnej sztuczki) luka pozwalająca
  całkowicie obejść ustawową blokadę zbycia niepokrytych akcji już od drugiej transakcji na tych
  samych akcjach; dotyczy każdej spółki mającej choćby jedną akcję nie w pełni pokrytą.

## Z-055 [POWAŻNY] — S5: `rodzaj_akcji` (w tym „niema") jest czystą etykietą — zero wpływu na
liczbę głosów w dokumentach

- **Co zrobiłem:** utworzyłem spółkę testową (id=4, „Audyt S5 Akcje Nieme…") z dwiema emisjami:
  seria A (80 akcji, `rodzaj_akcji: "zwykla"`, akcjonariusz Grażyna Zwykła) i seria B (20 akcji,
  `rodzaj_akcji: "niema"`, akcjonariusz Henryk Niemy) — `POST /api/psa/spolki/4/otworz-rejestr`.
  Wygenerowałem podgląd wzoru „03 — Uchwała o wyborze notariusza"
  (`POST /api/psa/spolki/4/dokumenty/03/podglad`) oraz „Informację z rejestru"
  (`GET /api/psa/spolki/4/informacja.html`).
- **Co się stało:** „Informacja z rejestru" poprawnie pokazuje kolumnę „Rodzaj akcji" z wartością
  „Niema" dla serii B (zgodnie z art. 300³³ § 1 pkt 4 KSH — rejestr ma zawierać rodzaj akcji). Ale
  w uchwale (wzór 03) obaj akcjonariusze są opisani identycznym mechanizmem liczenia głosów:
  „Grazyna Zwykla – 80 akcji dających uprawnienie do 80 głosów" i **„Henryk Niemy – 20 akcji
  dających uprawnienie do 20 głosów"** — mimo że jego akcje są oznaczone jako `niema`. Kod wprost to
  potwierdza: `server/logika/kontekst-pisma.js:356-360`, funkcja `akcjonariuszeKlucze` (wspólna dla
  wzorów 03 i 08), liczy `akcjonariusz_liczba_glosow: String(a.ilosc)` bezwarunkowo, z komentarzem
  w kodzie: „Aplikacja nie prowadzi odrębnej wagi głosu na akcje (każda niesie jeden głos, chyba że
  umowa spółki stanowi inaczej — art. 300²³ § 1 KSH — a to nie jest dziś modelowane)". Pole
  `rodzaj_akcji` (`psa_emisje.rodzaj_akcji`, słownik `uprzywilejowana`/`założycielska`/`niema`) nie
  ma ŻADNEGO efektu funkcjonalnego nigdzie w aplikacji poza wyświetleniem etykiety — sprawdziłem
  grepem po całym `server/` i `publiczne/js/`: żadne miejsce liczące głosy, uprawnienia czy udział
  nie odczytuje `rodzaj_akcji`.
- **Co powinno się stać:** nierozstrzygnięte wprost bez decyzji Łukasza, bo art. 300²³ § 1 KSH
  („akcja daje prawo do jednego głosu") nie mówi wprost, że akcja niema jest automatycznie
  pozbawiona głosu — to zależy od treści umowy spółki (`PRZEPISY-PSA.md` nie zawiera dla P.S.A.
  odpowiednika art. 351/352 KSH o akcjach niemych S.A., które explicite pozbawiają prawa głosu; w
  Dziale IA takiego przepisu NIE MA — patrz `PRZEPISY-PSA.md` sekcja 12 pkt 5, zakaz stosowania
  przepisów S.A. przez analogię). Niemniej: jeśli `rodzaj_akcji='niema'` ma być w ogóle
  meaningful w tym systemie (a specyfikacja `CLAUDE-PSA.md` sekcja 5 i `WYTYCZNE-MERYTORYCZNE-PSA.md`
  sekcja 9 wymieniają ją jako odrębną kategorię, obok „uprzywilejowana"/„założycielska"), to
  dokument korporacyjny liczący głosy PRZY GŁOSOWANIU nie powinien milcząco zrównywać jej ze zwykłą
  akcją — a przynajmniej system powinien mieć MIEJSCE do zapisania w umowie spółki, czy dana seria
  głosu nie ma, zamiast zakładać z góry „akcja = głos" dla każdego `rodzaj_akcji`.
- **Podstawa:** art. 300²³ § 1 KSH (akcja daje prawo do jednego głosu — ale nie rozstrzyga wprost
  losu akcji niemej w P.S.A., stąd zapisuję to RÓWNIEŻ jako pytanie do Łukasza, nie tylko błąd);
  art. 300³³ § 1 pkt 4 KSH (rodzaj akcji jako treść rejestru — ta część działa poprawnie).
- **Waga:** POWAŻNY — dokument korporacyjny (uchwała akcjonariuszy) podaje nieprawdziwą/niepewną
  liczbę głosów dla akcji jawnie oznaczonej jako `niema`, a system nie ma żadnego mechanizmu, by to
  skorygować inaczej niż ręczną edycją tekstu po wydrukowaniu. Zapisuję też pytanie do Łukasza
  (`PYTANIA-DO-LUKASZA.md` P-002), bo ostateczna ocena prawna wymaga ustalenia, czy P.S.A. w ogóle
  przewiduje automatyczne pozbawienie głosu akcji niemej, czy to w całości zależy od umowy spółki
  (w którym to wypadku systemowi brakuje pola na tę treść umowy, a nie tylko przelicznika głosów).

## Z-056 [POZYTYWNE] — S6(a,b,c): ułamki akcji — tworzenie 1/3+1/3+1/3, blokada nadmiarowej sumy i
blokada przypisania ułamka do zakresu numerów działają poprawnie

- **Co zrobiłem:** utworzyłem spółkę testową (id=5, „Audyt S6 Ułamki Akcji…"), emisję 100 akcji
  serii A objętych w całości przez „Izę Wspólną" (`otworz-rejestr`). Bezpośrednimi żądaniami
  `POST /api/psa/spolki/5/zdarzenia` (typ `przeniesienie_ulamka`, z pominięciem formularza/UI):
  (1) przeniosłem 1/3 akcji nr 96 od Izy do „Jana Wspólnego"; (2) przeniosłem kolejne 1/3 akcji nr
  96 od Izy do „Karola Wspólnego" (Iza zostaje z 1/3); (3) spróbowałem, żeby Jan (mający tylko 1/3)
  zbył 1/2 akcji nr 96 na czwartą osobę; (4) spróbowałem przenieść ułamek na ZAKRESIE numerów
  (`nr_od:96, nr_do:98`) zamiast pojedynczego `nr`; (5) osobno spróbowałem podwójnie objąć TEN SAM
  pojedynczy numer akcji (ręczny `zakresy:[{nr_od:5,nr_do:5}]`) przez dwie różne osoby w kolejnych
  zdarzeniach `objecie` tej samej emisji.
- **Co się stało:**
  1. Krok (1)+(2): oba przeniesienia ułamków przeszły (HTTP 201); `GET /api/psa/spolki/5/stan`
     potwierdza dokładnie `1/3` u każdego z trojga (Iza, Jan, Karol) na numerze 96 — suma się
     domyka do 1.
  2. Krok (3): HTTP 422, „Zbywca posiada 1/3 akcji nr 96 serii A... — nie może zbyć 1/2." — nie da
     się nawet PRÓBOWAĆ zapisać sumy przekraczającej 1, bo `przeniesienie_ulamka` sprawdza
     rzeczywisty aktualny stan posiadania zbywcy PRZED każdym pojedynczym przeniesieniem
     (`server/logika/stan.js:438-444`, `u.mniejszyRowny`) — nie tylko na końcu przez zbiorczy
     bilans. Próba dojścia do „1/2+1/2+1/2=3/2" wprost nie jest w ogóle osiągalna przez API, bo
     każdy krok jest osobno ograniczony do tego, co zbywca faktycznie ma w danym momencie.
  3. Krok (4): HTTP 422, „Pole „numer akcji" musi być liczbą całkowitą..." — endpoint
     `przeniesienie_ulamka` przyjmuje WYŁĄCZNIE pojedynczy `nr` (kreator.js:326-338 czyta `we.nr`,
     nigdy `nr_od`/`nr_do`) — `nr_od`/`nr_do` są całkowicie ignorowane/nie mają gdzie trafić, więc
     nie da się w ten sposób nawet dotrzeć do zapisu, który złamałby CHECK bazodanowy
     `czesc_licznik = czesc_mianownik OR nr_od = nr_do` (`migracje.js:452-453,595-598`) — blokada
     aplikacyjna działa, zanim jeszcze dojdzie do próby zapisu do bazy.
  4. Krok (5): HTTP 422, „Wskazane numery nie są dostępne: 5. Dostępne: 1–4, 6–10." — podwójne
     objęcie tego samego numeru (co dałoby sumę 1/1+1/1=2 na jednym numerze) jest blokowane już na
     etapie doboru puli wolnych numerów, więc też nie dociera do zbiorczego bilansu.
- **Co powinno się stać:** dokładnie to — reguła 3/4a z `CLAUDE-PSA.md` (bilans akcji musi się
  zgadzać zawsze, ułamek tylko na pojedynczym numerze) ma być egzekwowana twardo. Warte odnotowania:
  ochrona jest tu SILNIEJSZA niż tylko „sprawdzenie bilansu po fakcie" — każdy pojedynczy krok jest
  z osobna ograniczony do rzeczywistego stanu posiadania, więc nieprawidłowej sumy nie da się w
  ogóle ZACZĄĆ zapisywać przez legalną ścieżkę zdarzeń (nie sprawdzałem obejścia przez bezpośredni
  zapis SQL do bazy — to poza zakresem sesji, która zabrania modyfikacji bazy inaczej niż przez API).
- **Podstawa:** art. 300³¹ § 2 KSH (zgodność liczby akcji w rejestrze); art. 300² § 3 + art. 300⁴³
  KSH (ułamek przypisany do pojedynczej, oznaczonej akcji); reguła domenowa 3 i 4a `CLAUDE-PSA.md`.
- **Waga:** POZYTYWNE — nie znalazłem żadnej ścieżki API pozwalającej zapisać niepoprawną sumę
  ułamków ani ułamek na zakresie szerszym niż jeden numer.

## Z-057 [KRYTYCZNY] — S6(d): akcja podzielona ułamkowo liczy się jako TRZY OSOBNE PEŁNE głosy w
uchwale akcjonariuszy — nie jeden głos wspólny, nawet po wskazaniu wspólnego przedstawiciela

- **Co zrobiłem:** przy spółce z Z-056 (akcja nr 96 podzielona 1/3+1/3+1/3 między Izę, Jana i
  Karola) wygenerowałem podgląd wzoru „03 — Uchwała o wyborze notariusza"
  (`POST /api/psa/spolki/5/dokumenty/03/podglad`) — dokument wylicza uprawnienie do głosowania dla
  KAŻDEGO akcjonariusza. Następnie bezpośrednim żądaniem ustanowiłem wspólnego przedstawiciela
  współuprawnionych (`typ: "przedstawiciel"`, `nr: 96`, `przedstawiciel_osoba_id` = Jan) i
  wygenerowałem dokument ponownie.
- **Co się stało:** dokument PRZED i PO ustanowieniu przedstawiciela wylicza identycznie:
  „Iza Wspólna – 100 akcji dających uprawnienie do 100 głosów" (jej pula „1–100" WCIĄŻ liczy nr 96
  jako pełną akcję, choć fizycznie ma tam tylko 1/3), **„Jan Wspólny – 1 akcji dających uprawnienie
  do 1 głosów"** i **„Karol Wspólny – 1 akcji dających uprawnienie do 1 głosów"** — czyli JEDNA
  fizyczna akcja (nr 96), podzielona na 1/3+1/3+1/3, generuje w dokumencie **TRZY PEŁNE, NIEZALEŻNE
  głosy** (Iza+Jan+Karol) zamiast JEDNEGO głosu przypisanego wspólnemu przedstawicielowi.
  Ustanowienie przedstawiciela (`przedstawiciel_osoba_id`) nie zmienia NIC w dokumencie — pole jest
  całkowicie pomijane przy liczeniu głosów.
- **Przyczyna (potwierdzona w kodzie):** `server/logika/kontekst-pisma.js:356-360`, funkcja
  `akcjonariuszeKlucze` liczy `akcjonariusz_liczba_glosow: String(a.ilosc)`, gdzie `a.ilosc` z kolei
  pochodzi z `server/logika/stan.js:974` (`n.ilosc(zakresy)`), a `n.ilosc()`
  (`server/logika/numery.js:64-66`) liczy WYŁĄCZNIE numery akcji dotknięte choćby częściowo —
  „dla wiersza ułamkowego to nadal »1 numer«, nie ułamek" (cytat z komentarza w kodzie,
  `stan.js:970-973`, który explicite odsyła to zadanie do „warstwy prezentacji, sprint 6" — a mimo
  to LIVE wygenerowany dokument nie ma tej korekty). Żadna funkcja licząca głosy nie odczytuje
  `przedstawiciel_osoba_id` ani nie sprawdza, czy dana pozycja jest częścią współwłasności.
- **Skutek praktyczny:** ta sama, pojedyncza, fizyczna akcja może wygenerować w uchwale WIĘCEJ
  głosów niż wynosi łączna liczba wyemitowanych akcji spółki — w tym przypadku spółka ma 100 akcji
  serii A, a suma głosów wyliczona w dokumencie (100+1+1=102, nie licząc jeszcze serii B) przekracza
  100. Dla uchwał podejmowanych w trybie pisemnym poza WZ (art. 300⁸⁰ § 2 zd. drugie, wzór wprost to
  cytuje) — wynik głosowania oparty na takim wyliczeniu jest formalnie wadliwy.
- **Co powinno się stać:** zgodnie z regułą domenową 4a `CLAUDE-PSA.md` („głos liczy się per akcja,
  nie per ułamek — akcja dzielona daje jeden głos, przypisany wspólnemu przedstawicielowi") i
  art. 300²³ § 1 + art. 300³⁸ § 3 KSH, akcja nr 96 powinna dać w sumie DOKŁADNIE JEDEN głos w
  dokumencie, wykonywany przez wspólnego przedstawiciela (a przy jego braku — spółka może przyjąć
  oświadczenie od któregokolwiek współuprawnionego, art. 300³⁸ § 4, ale to wciąż jeden głos, nie
  trzy).
- **Powiązane, ta sama przyczyna źródłowa:** ten sam błąd w `n.ilosc()`/`p.procent` zniekształca
  też „Informację z rejestru" — sprawdziłem `GET /api/psa/spolki/5/informacja.html`: dokument
  pokazuje Izę z „100 akcji / 97,09%", Jana z „1 akcji / 0,97%" i Karola z „1 akcji / 0,97%" dla
  TEJ SAMEJ akcji nr 96 policzonej trzykrotnie w całości — suma „akcji" w tabeli (103) przekracza
  faktyczną liczbę objętych akcji (101: 100 z serii A + 1 z serii B). To wprost narusza regułę 4a
  („procent udziału liczony na ułamkach") na dokumencie z art. 300³⁵ KSH wydawanym akcjonariuszom.
- **Podstawa:** art. 300²³ § 1 KSH (jeden głos na akcję) w zw. z art. 300³⁸ § 3 KSH (współuprawnieni
  wykonują prawa przez wspólnego przedstawiciela); art. 300³³ § 1 pkt 4 i art. 300³⁵ KSH (treść i
  rzetelność informacji z rejestru); reguła domenowa 4a `CLAUDE-PSA.md` (explicite: „głos liczy się
  per akcja, nie per ułamek").
- **Waga:** KRYTYCZNY — błąd dotyczy TREŚCI dokumentu korporacyjnego (uchwały akcjonariuszy) i
  oficjalnego dokumentu z rejestru (art. 300³⁵ KSH), nie tylko kosmetyki: liczba głosów i wielkość
  udziału są realnie zawyżone za każdym razem, gdy w spółce istnieje choć jedna akcja z ułamkowym
  współuprawnieniem — może to wpłynąć na wynik głosowania i na to, komu spółka słusznie przypisuje
  jaki % struktury właścicielskiej.
- **Potwierdzenie w UI (nie tylko w dokumentach):** zrzut ekranu `testy-audyt/zrzuty/faza1-warianty/S6-02-ulamki-widok-szczegolowy.png` (kokpit spółki, widok „Szczegółowy") pokazuje dokładnie ten sam błąd na żywo: wiersz „Wspólny Jan — 1 akcja — 96 — 0,97%" i „Wspólny Karol — 1 akcja — 96 — 0,97%" wyglądają jak DWIE ODRĘBNE, PEŁNE akcje o numerze 96, a licznik „Razem" na dole tabeli pokazuje **103** (zamiast poprawnych 101 objętych akcji: 100 z serii A + 1 z serii B) — błąd jest więc widoczny gołym okiem pracownikowi kancelarii, nie tylko w wygenerowanym dokumencie. Dodatkowo żaden wiersz nie ma JAKIEGOKOLWIEK wizualnego oznaczenia „to jest ułamek/współwłasność" — sam wygląd tabeli (`publiczne/js/kokpit.js`) nie odczytuje pola `czesci_ulamkowe` z API, mimo że dane tam są; jedyna wzmianka o współwłasności w kodzie UI to tekst podpowiedzi przycisku „Szczegółowy" („widać... współwłasność co do numeru"), bez żadnego faktycznego znacznika w wierszu.

## Z-058 [POWAŻNY] — Kokpit spółki (ekran roboczy) nie pokazuje ANI wzmianki o pokryciu, ANI rodzaju
akcji — te dwie ustawowe treści rejestru są widoczne wyłącznie na wydrukowanej „Informacji z rejestru"

- **Co zrobiłem:** przy okazji wariantów S4 (spółka id=3, akcje częściowo pokryte) i S5 (spółka
  id=4, seria B `rodzaj_akcji: "niema"`) obejrzałem w przeglądarce główny ekran roboczy — kokpit
  spółki (`GET /#/spolki/:id`), zarówno widok „Uproszczony" jak i „Szczegółowy", oraz rozwiniętą
  sekcję „Rejestr akcji" (zrzuty: `S4-01-pokrycie-czesciowe-kokpit.png`, `S5-01-akcje-nieme-kokpit.png`,
  `S5-02-rejestr-akcji-rozwiniety.png`). Dla porównania sprawdziłem też, że te same dane SĄ
  poprawnie widoczne na wydrukowanej „Informacji z rejestru" (`GET /api/psa/spolki/:id/informacja.html`
  — patrz Z-054, Z-055).
- **Co się stało:** ani tabela „Rejestr akcjonariuszy" (kolumny: Akcjonariusz, Seria, Liczba akcji,
  Numery, % akcji, Obciążenia), ani tabela „Rejestr akcji"/emisje (kolumny: Seria, Tytuł, Numery,
  Wyemitowane, Nieobjęte, Umorzone, Cena emisyjna, Data emisji) nie mają kolumny „Pokrycie" ani
  „Rodzaj akcji" — potwierdzone też grepem po `publiczne/js/kokpit.js`: żadna z tabel tego pliku nie
  odwołuje się do pól `pokryta` ani `rodzaj_akcji`. W przykładzie S4 pracownik patrzący na kokpit
  widzi wyłącznie „Zbywcowa Dorota — 40 akcji — 80%" bez żadnej wzmianki, że te akcje są tylko
  częściowo pokryte; w S5 seria B wygląda identycznie jak zwykła seria A (jedyna wskazówka to
  treść pola „Tytuł", którą akurat opisałem jako „Emisja akcji niemych" — w praktyce dowolna).
- **Co powinno się stać:** art. 300³³ § 1 pkt 4 i pkt 9 KSH czynią rodzaj akcji i wzmiankę o
  pokryciu OBOWIĄZKOWĄ treścią rejestru — powinny być widoczne na GŁÓWNYM, roboczym ekranie, którego
  pracownik używa codziennie do podejmowania decyzji (np. czy zbycie wymaga zgody spółki), a nie
  wyłącznie na osobno generowanym wydruku. To istotne również operacyjnie: Z-054 pokazuje, że
  blokada zbycia niepokrytych akcji bywa tracona po jednym przeniesieniu — bez kolumny „Pokrycie"
  na głównym ekranie pracownik nie ma nawet jak ZAUWAŻYĆ takiej anomalii bez świadomego
  wygenerowania informacji z rejestru za każdym razem.
- **Podstawa:** art. 300³³ § 1 pkt 4 i pkt 9 KSH (rodzaj akcji i wzmianka o pokryciu jako treść
  rejestru); `CLAUDE-PSA.md` sekcja 9 („Kokpit spółki — JEDEN EKRAN... tabela akcjonariatu:
  akcjonariusz | seria | ilość | numery | % udziału | znaczniki obciążeń" — specyfikacja też nie
  przewiduje kolumny pokrycia/rodzaju wprost, ale sekcja 1 modułu wymaga, by rejestr *jako całość*
  odzwierciedlał ustawową treść).
- **Waga:** POWAŻNY — dane są poprawnie zbierane i poprawnie drukowane, ale niedostępne na
  pierwszym, najczęściej używanym ekranie roboczym, co zwiększa ryzyko przeoczenia (np. właśnie
  błędu z Z-054) i utrudnia codzienną pracę zgodną z ustawą bez dodatkowego kroku (wydruku).

---

# FAZA 1 — scenariusz podstawowy S1 (Z-003 do Z-019)

> Ścieżka: zgłoszenie publiczne → aktywacja konta → wniosek (spółka, reprezentant, 2 akcjonariuszy:
> Anna Kowalska, osoba fizyczna; Inwestor Sp. z o.o., osoba prawna) → wystawienie i podpisanie
> kompletu dokumentów → przyjęcie wniosku → otwarcie rejestru (seria AZ, 1–100, cena 0,01 zł/akcję,
> pokryte w całości: Anna 95, Inwestor 5) → próba pobrania informacji z rejestru przez akcjonariusza
> mniejszościowego. Zrzuty: `testy-audyt/zrzuty/faza1-s1/`. Skrypty pomocnicze (Playwright + żądania
> bezpośrednie z pominięciem formularza): `testy-audyt/skrypty/`.

## Z-003 [POWAŻNY] — zgłoszenie publiczne wysyła zaproszenie do portalu OD RAZU, bez oceny kancelarii,
mimo że kod tego samego modułu opisuje to jako proces oceny i decyzji

- **Co zrobiłem:** wypełniłem i wysłałem formularz publiczny „Zgłoś zainteresowanie" (bez konta) —
  e-mail + numer KRS — w przeglądarce (zrzuty `08`–`09`, `24`–`25`), oraz przeczytałem
  `server/trasy/zgloszenia.js` (komentarz nagłówkowy pliku) i `server/trasy/portal.js:189-307` w
  celu potwierdzenia zaobserwowanego zachowania.
- **Co się stało:** natychmiast po wysłaniu formularza (bez żadnej interwencji pracownika) klient
  dostał ekran „Zaproszenie wysłane" z aktywnym linkiem aktywacyjnym do portalu — `psa_zgloszenia`
  dostaje status `zaproszono` w tej samej operacji. Komentarz nagłówkowy `zgloszenia.js` mówi:
  „kancelaria przegląda listę i decyduje: zaprosić (...) albo odrzucić" — ale komentarz przy
  właściwym kodzie w `portal.js:290-293` mówi wprost przeciwnie: „Zaproszenie idzie OD RAZU. Na tym
  etapie kancelaria niczego jeszcze nie sprawdza (...). Kolejka «Zgłoszenia» zostaje jako ślad, nie
  jako bramka." Endpoint `POST /api/psa/zgloszenia/:id/zapros` istnieje nadal, ale służy dziś
  wyłącznie do PONOWNEGO wysłania zaproszenia (np. gdy e-mail przepadł), nie do pierwszego
  zatwierdzenia — a mimo to `POST /:id/odrzuc` nadal istnieje i sugeruje, że coś można jeszcze
  odrzucić na tym etapie, choć konto i tak już zostało założone i aktywowane niezależnie od tej
  decyzji.
- **Co powinno się stać:** SESJA-PSA-AUDYT.md opisuje krok 2 S1 jako „Przegląd i zatwierdzenie
  zgłoszenia przez pracownika kancelarii" — co odpowiadało PIERWOTNEMU zamysłowi udokumentowanemu w
  nagłówku `zgloszenia.js`. Obecne zachowanie jest świadomą, udokumentowaną zmianą decyzji
  biznesowej (szybsza konwersja leadu), ale dwa komentarze w kodzie tego samego modułu się ze sobą
  kłócą, a przycisk „Odrzuć" w kolejce zgłoszeń dla zgłoszenia o statusie `zaproszono` nie cofa
  faktycznie nadanego dostępu (aktywne konto portalowe zostaje).
- **Podstawa:** zasada techniczna (spójność dokumentacji w kodzie z rzeczywistym zachowaniem;
  UX „odrzuć" bez realnego skutku). Brak bezpośredniego przepisu — publiczny formularz zgłoszeniowy
  nie jest czynnością ustawową, to etap przedkontraktowy kancelarii.
- **Waga:** POWAŻNY (mylące dla nowego pracownika czytającego kod i dla UI kolejki zgłoszeń;
  operacyjnie oznacza też, że KAŻDY, kto poda cudzy/przypadkowy, ale poprawny 10-cyfrowy numer KRS
  wraz z dowolnym e-mailem, dostaje aktywny dostęp do wypełniania wniosku bez żadnej ludzkiej
  weryfikacji — pytanie, czy to świadomie akceptowane ryzyko, patrz `PYTANIA-DO-LUKASZA.md`).

## Z-004 [POWAŻNY] — wyścig (race condition) przy równoczesnym zgłoszeniu: dwa identyczne żądania
tworzą DWA zgłoszenia w kolejce kancelarii i po cichu unieważniają pierwszy link aktywacyjny

- **Co zrobiłem:** wysłałem DWA jednoczesne (Promise.all, bez oczekiwania na odpowiedź pierwszego)
  żądania `POST /api/psa/portal/zgloszenia` z IDENTYCZNYM adresem e-mail i numerem KRS —
  bezpośrednio przez `fetch`, z pominięciem formularza (symulacja podwójnego kliknięcia/podwójnego
  żądania sieciowego szybszego niż blokada przycisku w UI).
- **Co się stało:** OBA żądania zwróciły `201` z odrębnymi linkami aktywacyjnymi. W kolejce
  „Zgłoszenia" powstały DWA rekordy `psa_zgloszenia` (id różne, identyczne `krs` i `email`, oba
  „zaproszono") — sprawdzone wprost przez `GET /api/psa/zgloszenia` z sesji pracownika. Konto
  portalowe (`psa_konta`, unikalne po e-mailu) pozostało jedno, ale token aktywacyjny został
  nadpisany przez DRUGIE żądanie: link z PIERWSZEJ odpowiedzi, otwarty później, zwraca `{"blad":
  "Link aktywacyjny jest nieprawidłowy albo wygasł."}`, mimo że został wydany kilka sekund wcześniej
  i w ogóle nie był jeszcze użyty. Przyczyna: sprawdzenie duplikatu w `portal.js:237-245`
  (`SELECT ... WHERE krs = ?`) jest odczytem-przed-zapisem bez transakcji ani ograniczenia `UNIQUE`
  na `krs` w `psa_zgloszenia` — dwa równoległe żądania nie widzą nawzajem swoich jeszcze
  niezapisanych wierszy.
- **Co powinno się stać:** drugie (późniejsze) żądanie dla tego samego numeru KRS powinno zostać
  odrzucone komunikatem „zgłoszenie już w toku" (dokładnie tak, jak dzieje się to przy żądaniach
  NIE nakładających się w czasie — mechanizm istnieje, ale nie jest odporny na współbieżność).
  Rozwiązanie: ograniczenie `UNIQUE` na `(krs)` dla zgłoszeń niezakończonych (albo transakcja z
  blokadą) — ten sam wzorzec ryzyka może dotyczyć innych miejsc z kontrolą duplikatów typu
  „sprawdź, potem wstaw" w kodzie (np. „jedna aktywna umowa" w Z-009, „seria nie koliduje z
  istniejącą" przy emisji) — wymaga przeglądu, nie tylko punktowej poprawki.
- **Podstawa:** zasada techniczna (integralność danych, jawnie wymagana w checkliście sesji:
  „Czy podwójne kliknięcie... tworzy dwa zgłoszenia"). Konsekwencja: klient, który raz dostał ekran
  potwierdzenia i zapisał/otworzył ten pierwszy link później, trafia na fałszywy komunikat
  „nieprawidłowy albo wygasł" mimo poprawnego zgłoszenia — realny scenariusz przy niestabilnym
  łączu (automatyczna retransmisja POST-a) lub przy kliknięciu dwa razy zanim front-end zdąży
  zablokować przycisk.
- **Waga:** POWAŻNY (duplikat rekordu roboczego + realna, myląca awaria linku dla klienta; brak
  wycieku danych ani utraty integralności rejestru głównego).

## Z-005 [KRYTYCZNY] — jedyna widoczna ścieżka otwarcia rejestru dla spółki z portalu klienta
(„Migracja — stan otwarcia") pomija w całości 10-punktową checklistę otwarcia i nigdy nie zbiera
daty umowy/uchwały ani wzmianki o pokryciu/cenie per akcjonariusz

- **Co zrobiłem:** przeszedłem CAŁĄ ścieżkę S1 do końca (zgłoszenie → aktywacja → wniosek z dwoma
  akcjonariuszami → wystawienie i podpisanie 9 dokumentów → przyjęcie wniosku), a następnie
  otworzyłem kokpit nowo powstałej spółki (zrzut `60`). Porównałem to z drugą, osobną ścieżką w tej
  samej aplikacji: `Spółki → Nowa spółka` (`/spolki/nowa`, komponent `EkranNowejSpolki`,
  `publiczne/js/spolki.js`), używaną gdy pracownik zakłada spółkę ręcznie od zera.
- **Co się stało:** dla spółki utworzonej przez przyjęcie wniosku klienta jedynym widocznym,
  wyeksponowanym w nagłówku kokpitu przyciskiem do wprowadzenia pierwszej emisji i objęcia akcji
  jest **„Migracja — stan otwarcia"** (widoczny tylko dopóki `liczba_zdarzen === 0` — po dodaniu
  JAKIEGOKOLWIEK zdarzenia, nawet pomyłkowego, znika bezpowrotnie z tego miejsca; potwierdzone
  empirycznie: po dodaniu przeze mnie testowej emisji przycisk zniknął, zrzut `62`). Ekran ten (
  `publiczne/js/migracja.js`) ma własny nagłówek: „Ręczne wprowadzenie stanu akcjonariatu
  przeniesionego z INNEGO REJESTRU (np. Rejestrów Notarialnych), z datami historycznymi (...) NIE
  zakłada sprawy ani opłaty za wpis — to odtworzenie już zaszłego stanu, nie bieżąca czynność." — a
  mimo to jest jedyną wyeksponowaną drogą do otwarcia rejestru RÓWNIEŻ dla spółki, która nigdy nie
  była nigdzie indziej prowadzona (świeżo zawiązana P.S.A. ze scenariusza S1). Krok „objęcie" tego
  kreatora (`KrokObjecie`/`PozycjaKreatora` w `publiczne/js/kreator.js:340-378`) **nie ma pól
  „wzmianka o pokryciu" ani „cena emisyjna"** — w przeciwieństwie do analogicznego kroku w
  `EkranNowejSpolki` (`PozycjaZalozycielska`, `spolki.js:80-162`), który te pola ma. Sam kreator
  Migracji nie pokazuje też ŻADNEJ z 10 pozycji `CHECKLISTA_OTWARCIA` zdefiniowanej w `spolki.js:
  67-78` (m.in. „Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr, skan wgrany",
  „Umowa o prowadzenie rejestru podpisana (...), wskazany podpisujący", „Spółka nie ma innej
  aktywnej umowy o prowadzenie rejestru", „Bilans akcji zgadza się z liczbą wyemitowanych") — ta
  checklista istnieje WYŁĄCZNIE w kreatorze `/spolki/nowa`, nieosiągalnym dla spółki, która już
  istnieje w bazie (jak każda spółka z wniosku portalowego). Co więcej, pola `data_uchwaly_wyboru`,
  `data_umowy`, `umowe_zawarl`, `umowe_zawarl_imie_nazwisko` na kokpicie spółki (`kokpit.js:
  258-266`) są WYŁĄCZNIE do odczytu (`MetrykaPoz`) — jedyny formularz, który je kiedykolwiek
  ustawia, to krok 1/2 `EkranNowejSpolki`. Dla spółki z portalu te pola pozostają trwale puste
  („–") bez JAKIEJKOLWIEK ścieżki UI, by je uzupełnić (potwierdzone na zrzucie `60`: „Data uchwały
  o wyborze: –", „Data umowy: –", „Zawarł: —") — dopiero moja bezpośrednia interwencja przez API
  (Z-008/Z-009 niżej) je uzupełniła.
  Dodatkowo istnieje TRZECIA droga — przycisk „Nowa emisja" wewnątrz zwiniętej sekcji „Rejestr
  akcji" na kokpicie (zawsze dostępny, niezależnie od `liczba_zdarzen`) — ale prowadzi do PEŁNEGO
  kreatora sprawy (`Nowa sprawa → Emisja akcji`, 4 kroki, z obowiązkowym polem „Żądający wpisu"
  wyszukiwanym w kartotece osób), architektonicznie CIĘŻSZEGO i niesygnowanego dla przypadku
  „zakładam rejestr tej nowej spółce po raz pierwszy" — w praktyce łatwo przeoczalny, bo schowany
  w zwiniętym akordeonie, podczas gdy „Migracja" stoi wyeksponowana w nagłówku strony.
- **Co powinno się stać:** dla spółki pochodzącej z wniosku portalowego kokpit powinien prowadzić
  pracownika do ścieżki „otwarcia rejestru" analogicznej do `EkranNowejSpolki` — z tą samą
  checklistą (uchwała, umowa, jedna aktywna umowa, bilans, dane z umowy spółki, zakres AML) oraz z
  polami pokrycia i ceny emisyjnej per akcjonariusz, i powinna zostać zebrana `data_uchwaly_wyboru`
  / `data_umowy` / `umowe_zawarl*`. „Migracja — stan otwarcia" — sądząc z własnej dokumentacji w
  kodzie — powinna być zarezerwowana wyłącznie dla faktycznych migracji z innych rejestrów.
- **Podstawa:** art. 300³¹ § 5 KSH (uchwała o wyborze podmiotu — musi istnieć data), art. 300³² § 1
  KSH (umowa o prowadzenie rejestru), art. 300³³ § 1 pkt 9 KSH (wzmianka o pokryciu jako TREŚĆ
  rejestru — obligatoryjna, nie opcjonalna), `CLAUDE-PSA.md` reguła domenowa 4c („pokrycie akcji
  (...) jest ustawowym elementem rejestru") oraz sekcja 15 pkt 3 („Kto dokonuje wpisu... Na start:
  każdy zalogowany pracownik" — zakłada, że w ogóle istnieje jedna spójna, kontrolowana ścieżka
  wpisu założycielskiego, nie dwie/trzy rozjeżdżające się).
- **Waga:** KRYTYCZNY — to jest NAJCZĘSTSZY stan faktyczny wskazany w treści zadania („to jest
  najczęstszy stan faktyczny i musi działać bez zarzutu"): każda spółka onboardowana przez portal
  klienta (czyli deklarowany model biznesowy całej aplikacji, patrz `CLAUDE-PSA.md` sekcja 1) trafia
  na tę właśnie, niedopracowaną ścieżkę otwarcia rejestru, bez żadnego zabezpieczenia przypominanego
  w specyfikacji jako krytyczne (checklista otwarcia, pokrycie akcji, data uchwały/umowy).

## Z-006 [KRYTYCZNY] — brak jakiejkolwiek ścieżki (UI lub API) tworzenia konta portalowego dla
akcjonariusza innego niż osoba, która złożyła pierwotne zgłoszenie — blokuje krok 6 scenariusza S1
w całości

- **Co zrobiłem:** po otwarciu rejestru (Anna Kowalska — 95 akcji, „Inwestor 410411 Sp. z o.o." —
  5 akcji, akcjonariusz mniejszościowy) spróbowałem zalogować się do portalu jako akcjonariusz
  mniejszościowy (`POST /api/psa/portal/login` z adresem e-mail podanym dla „Inwestor..." we
  wniosku) oraz przejrzałem: `publiczne/js/osoby.js` (ekran „Kartoteka osób" i szczegóły osoby —
  brak jakiegokolwiek przycisku/akcji związanej z kontem/portalem), `server/trasy/osoby.js` (zero
  endpointów dotyczących kont/portalu), całe drzewo `server/` pod kątem `INSERT INTO psa_konta`.
- **Co się stało:** logowanie zwróciło `{"blad":"Nieprawidłowy e-mail lub hasło."}` — konto nie
  istnieje. `grep -rn "INSERT INTO psa_konta"` w całym `server/` zwraca DOKŁADNIE JEDNO miejsce:
  `server/logika/zaproszenia.js:93`, wywoływane WYŁĄCZNIE z dwóch tras: publicznego formularza
  zgłoszeniowego (`portal.js POST /zgloszenia`) i ponownego zaproszenia z kolejki zgłoszeń
  (`zgloszenia.js POST /:id/zapros`) — obie zawsze tworzą konto z rolą na sztywno `'wnioskodawca'`.
  Jedyne dalsze przejście roli konta to `wnioski.js:793`: `UPDATE psa_konta SET rola = 'spolka' (...)`
  — WYŁĄCZNIE dla konta powiązanego z przyjmowanym wnioskiem (czyli konta pierwotnego zgłaszającego).
  Migracja bazy (`server/migracje.js:1106`) ma `CHECK ((rola = 'akcjonariusz') = (osoba_id IS NOT
  NULL))` — model danych PRZEWIDUJE rolę `akcjonariusz` powiązaną z konkretną `osoba_id` — ale ŻADEN
  fragment kodu aplikacji nigdy nie wykonuje takiego `INSERT`/`UPDATE`. `portal.js:1262` zwraca
  `rola: 'akcjonariusz'` w odpowiedzi `whoami`, ale to martwa gałąź bez sposobu jej osiągnięcia.
  Skutek: akcjonariusz, który NIE był osobą wypełniającą wniosek (typowy przypadek: inwestor
  mniejszościowy, drugi wspólnik, osoba prawna reprezentowana przez kogoś innego niż wnioskodawca)
  nigdy, w żaden sposób, nie dostaje własnego dostępu do portalu — mimo że `CLAUDE-PSA.md` opisuje
  „Portal klienta (spółka i **akcjonariusze**)" jako gotową funkcję (sekcja 1) i mimo że jest to
  ustawowe prawo każdego akcjonariusza (nie tylko zgłaszającego).
- **Co powinno się stać:** kancelaria (albo sama spółka z poziomu konta „spolka") powinna mieć
  sposób zaproszenia KAŻDEGO wpisanego akcjonariusza do portalu z osobnym kontem `rola='akcjonariusz'`
  powiązanym z jego `osoba_id` — struktura bazy na to czeka, brakuje wyłącznie trasy/ekranu.
- **Podstawa:** art. 300³⁵ § 1 KSH („Rejestr akcjonariuszy jest jawny dla spółki i **każdego
  akcjonariusza**"), art. 300³⁵ § 2 KSH (prawo dostępu „za pośrednictwem podmiotu prowadzącego
  rejestr"), art. 300³⁵ § 3 KSH (prawo żądania wydania informacji z rejestru, „w postaci papierowej
  lub elektronicznej" — postać elektroniczna zakłada jakiś kanał dostępu, którym tu jest portal).
  `CLAUDE-PSA.md` sekcja 1 („Portal klienta (spółka i akcjonariusze)") i model `psa_konta` (`rola`
  `spolka`/`akcjonariusz`).
- **Waga:** KRYTYCZNY — uniemożliwia wprost zrealizowanie ustawowego prawa dostępu akcjonariusza do
  rejestru drogą elektroniczną dla KAŻDEGO akcjonariusza poza pierwotnym wnioskodawcą; w S1
  dosłownie uniemożliwia wykonanie kroku 6 scenariusza tak, jak został zlecony („żądanie informacji
  z rejestru przez portal przez akcjonariusza mniejszościowego"). Obejście istnieje wyłącznie po
  stronie kancelarii (patrz Z-014 niżej — generowanie „papierowej" informacji z rejestru przez
  pracownika), ale to nie jest samoobsługa portalowa, którą model biznesowy (`CLAUDE-PSA.md`
  sekcja 1: „nasza przewaga: (...) pełna samoobsługa online") wprost obiecuje.

## Z-007 [POWAŻNY] — pole „sposób reprezentacji" reprezentanta spółki nie ma żadnego formularza do
ręcznego wypełnienia; w umowie o prowadzenie rejestru i uchwale wychodzi jako pusty myślnik, gdy
import z KRS jest niedostępny

- **Co zrobiłem:** wypełniłem krok „Reprezentant" wniosku (imię i nazwisko, funkcja, PESEL, dowód,
  adres, e-mail — wszystkie pola dostępne w formularzu), bez importu z KRS (środowisko audytu nie
  ma dostępu do zewnętrznego API KRS — `curl` do `api-krs.ms.gov.pl` kończy się resetem połączenia).
  Po wystawieniu kompletu dokumentów pobrałem treść umowy o prowadzenie rejestru przez
  `GET /api/psa/wnioski/:id/dokumenty/1/tresc` (sesja pracownika, ten sam widok co „Podgląd" w UI).
- **Co się stało:** akapit przedstawiający reprezentanta w treści umowy brzmi dosłownie: „(...)
  działający jako: Prezes Zarządu (zarząd jednoosobowy), **sposób reprezentacji: —**,". Komentarz
  w `publiczne/js/wniosek.js:1003-1006` potwierdza, że to celowe: „Sposób reprezentacji NIE jest
  polem do wypełnienia — kancelaria sprawdza go na wydruku z KRS przy podpisaniu umowy, a przy
  pobraniu danych przyciskiem «Pobierz z KRS» wartość dochodzi razem z resztą i trafia do umowy bez
  udziału tego formularza." Innymi słowy: jeżeli import z KRS się nie powiedzie (a `spolki.js`/
  `krs.js` explicite zakłada, że to się zdarza i NIE blokuje dalszej pracy — „awaria API nie
  blokuje rejestracji"), pole to nie ma ŻADNEGO zapasowego sposobu wypełnienia w całej aplikacji —
  ani w kroku wniosku klienta, ani później w kokpicie kancelarii. Dodatkowo lista `brakujace` (pola
  wykryte jako niewypełnione, widoczne pracownikowi przy wystawianiu dokumentów jako „X pustych
  miejsc") NIE wychwytuje tego konkretnego pola — dla dokumentu „Umowa o prowadzenie rejestru"
  `brakujace` zwróciło `["spolka_nip","spolka_regon","reprezentant_reprezentacja"` -- ależ owszem,
  jest wychwycone (poprawka: przy PIERWSZYM sprawdzeniu, zaraz po wystawieniu dokumentów, lista
  brzmiała `["spolka_nip","spolka_regon","reprezentant_reprezentacja","kancelaria_email"]` — a więc
  pole JEST wykrywane jako brakujące i pokazywane pracownikowi jako "pustych miejsc: 4" na etapie
  wystawiania — ale mimo wykrycia braku, nie ma z tego miejsca ŻADNEGO sposobu, by ten brak
  uzupełnić inaczej niż wpisując ręcznie treść całego dokumentu przez edycję treści (`PUT
  /:id/dokumenty/:dokId/tresc`, funkcja techniczna, nieopisana w żadnej instrukcji dla pracownika).
- **Co powinno się stać:** formularz wniosku (albo ekran kancelarii przy weryfikacji) powinien mieć
  zapasowe pole tekstowe „sposób reprezentacji" na wypadek niedostępności/nieaktualności importu z
  KRS — dokument prawny (umowa) nie powinien nigdy zawierać pustego myślnika w miejscu opisującym
  umocowanie osoby podpisującej w imieniu spółki.
- **Podstawa:** zasada techniczna — kompletność dokumentu wskazana wprost w checkliście sesji
  („czy wygenerowane dokumenty mają wypełnione wszystkie pola"); brak przepisu regulującego samą
  treść umowy o prowadzenie rejestru (umowa cywilnoprawna), ale sposób reprezentacji jest
  materialnie istotny dla ważności umowy zawartej w imieniu spółki (art. 39 k.c. przez analogię —
  do potwierdzenia, czy to argument prawny czy tylko należytej staranności, patrz pytania).
- **Waga:** POWAŻNY (dokument o charakterze prawnym z luką w treści dotyczącą umocowania strony —
  wykrywalne dopiero po fakcie, przy realnym braku dostępu do KRS, co — jak pokazuje ten audyt — nie
  jest sytuacją brzegową, tylko normalną w tym środowisku).

## Z-008 [KRYTYCZNY] — data uchwały o wyborze podmiotu prowadzącego rejestr może być zapisana jako
PÓŹNIEJSZA niż data umowy o prowadzenie rejestru — brak jakiejkolwiek walidacji kolejności

- **Co zrobiłem:** bezpośrednim żądaniem `PUT /api/psa/spolki/:id` (sesja pracownika, z pominięciem
  jakiegokolwiek formularza) ustawiłem na spółce z S1: `data_umowy = 2026-09-17` (dziś) oraz
  `data_uchwaly_wyboru = 2026-09-22` (+5 dni, czyli PO dacie umowy) — sytuacja logicznie odwrócona
  względem art. 300³² § 1 w zw. z art. 300³¹ § 5 KSH (umowę zawiera się z podmiotem JUŻ wybranym
  uchwałą, więc uchwała musi poprzedzać albo co najwyżej zbiegać się z umową, nigdy jej następować).
- **Co się stało:** żądanie zwróciło `200 OK`, zapis przyjęty bez ostrzeżenia ani błędu.
  `grep` po `data_umowy`/`data_uchwaly_wyboru` w `server/logika/walidacje.js` i
  `server/trasy/spolki.js` nie znajduje żadnego porównania tych dwóch pól ze sobą — jedyna
  walidacja przy `PUT /spolki/:id` to sprawdzenie, że `umowe_zawarl` należy do dozwolonego słownika
  (`spolki.js:111-112`).
- **Co powinno się stać:** zapis z `data_uchwaly_wyboru > data_umowy` powinien zostać odrzucony
  (albo przynajmniej zwrócić czytelne ostrzeżenie wymagające świadomego potwierdzenia) — zgodnie z
  konstrukcją przepisu, w której uchwała jest logicznie warunkiem wstępnym zawarcia umowy.
- **Podstawa:** art. 300³² § 1 KSH w zw. z art. 300³¹ § 5 KSH („Spółka jest obowiązana do
  niezwłocznego zawarcia umowy (...) z podmiotem wybranym zgodnie z art. 300³¹ § 5"; „Wybór podmiotu
  prowadzącego rejestr wymaga uchwały akcjonariuszy. Przy zawiązaniu spółki wyboru dokonują
  akcjonariusze.") — checklista sesji wprost o to prosi.
- **Waga:** KRYTYCZNY w sensie zgodności z modelem prawnym reprezentowanym przez rejestr (rejestr
  może udokumentować sekwencję zdarzeń sprzeczną z logiką ustawy bez żadnego ostrzeżenia), choć
  praktyczna szkoda zależy od tego, czy ktokolwiek kiedykolwiek wpisze rzeczywiście błędne daty —
  do ostatecznej kwalifikacji wagi polecam decyzję Łukasza (czy to ma być twarda blokada, czy
  tylko miękkie ostrzeżenie — patrz `PYTANIA-DO-LUKASZA.md`).

## Z-009 [POWAŻNY] — brak jakiejkolwiek ochrony przed nadpisaniem umowy o prowadzenie rejestru
(symulacja „drugiej umowy" dla tej samej spółki) — zero walidacji, zero śladu zmiany

- **Co zrobiłem:** po ustawieniu pierwszej umowy (`data_umowy`, `umowe_zawarl='notariusz'`,
  `umowe_zawarl_imie_nazwisko='Łukasz Kozon'`) wysłałem DRUGIE bezpośrednie żądanie
  `PUT /api/psa/spolki/:id` z inną datą umowy (+10 dni) i innym podpisującym
  (`umowe_zawarl='zastepca'`, `umowe_zawarl_imie_nazwisko='Ktoś Inny'`) — symulacja zawarcia drugiej
  umowy o prowadzenie rejestru dla tej samej, już prowadzonej spółki.
- **Co się stało:** `200 OK`, dane nadpisane bez ostrzeżenia. Ponieważ `data_umowy`/`umowe_zawarl*`
  to zwykłe kolumny na `psa_spolki` (nie osobna, dopisywana tabela `psa_umowy` — potwierdzone w
  `FAZA-0-INWENTARYZACJA.md`, lista 26 tabel `psa_*` nie zawiera takiej tabeli), nadpisanie jest
  bezpowrotne: NIE istnieje żaden ślad, że poprzednia umowa (z innym podmiotem/inną datą) w ogóle
  kiedyś obowiązywała — w przeciwieństwie do `psa_zdarzenia`, które jest jawnie i celowo
  append-only. `CHECKLISTA_OTWARCIA` w `spolki.js:72` ma pozycję „Spółka nie ma innej aktywnej
  umowy o prowadzenie rejestru" — ale to WYŁĄCZNIE ludzki checkbox w kreatorze `/spolki/nowa` (patrz
  Z-005), niewspierany żadną rzeczywistą kontrolą przy zapisie.
- **Co powinno się stać:** zgodnie z `WYTYCZNE-MERYTORYCZNE-PSA.md` sekcja 5 („Jeden rejestr = jeden
  podmiot prowadzący (...) Stąd walidacja: spółka może mieć w systemie dokładnie jedną aktywną
  umowę o prowadzenie rejestru") zmiana umowy powinna być odrębnym, świadomym zdarzeniem (najlepiej
  odzwierciedlonym w `psa_zdarzenia` jak każda inna zmiana danych spółki — `zmiana_danych_spolki`
  już istnieje jako typ zdarzenia i jest używany przy `PUT /spolki/:id` dla INNYCH pól, więc
  infrastruktura już istnieje), a nie ciche nadpisanie kolumn bez śladu.
- **Podstawa:** art. 300³² § 2 KSH („Rozwiązanie przez spółkę umowy jest dopuszczalne jedynie pod
  warunkiem zawarcia nowej umowy (...)"); `WYTYCZNE-MERYTORYCZNE-PSA.md` sekcja 5 (cytat wyżej).
- **Waga:** POWAŻNY (brak audytowalności zmiany kluczowego faktu prawnego — kto i od kiedy prowadzi
  rejestr tej spółki — mimo że cała reszta modułu jest zbudowana wokół zasady „nic się nie kasuje,
  nic się nie nadpisuje bez śladu").

## Z-010 [POZYTYWNE] — blokada przyjęcia spółki, która nie jest P.S.A., działa poprawnie również
przy bezpośrednim żądaniu do API, z pominięciem formularza

- **Co zrobiłem:** bezpośrednie żądanie `POST /api/psa/spolki` (sesja pracownika, z pominięciem
  formularza — pole `forma_prawna` nie jest w ogóle edytowalne w UI kreatora „Nowa spółka", które ma
  je zaszyte na sztywno jako „PROSTA SPÓŁKA AKCYJNA") z `forma_prawna: "SPÓŁKA Z OGRANICZONĄ
  ODPOWIEDZIALNOŚCIĄ"` i resztą wymaganych pól.
- **Co się stało:** `400 Bad Request`, komunikat: „Forma prawna «SPÓŁKA Z OGRANICZONĄ
  ODPOWIEDZIALNOŚCIĄ» nie jest prostą spółką akcyjną. Rejestr prowadzimy wyłącznie dla P.S.A.
  (art. 300(31) § 1 KSH)." — spółka NIE została utworzona.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** art. 300³¹ § 1 KSH; `CLAUDE-PSA.md` reguła domenowa 11 („Nie prowadzimy rejestru dla
  S.A./S.K.A. — walidacja przy dodawaniu spółki").
- **Waga:** POZYTYWNE (zapisane zgodnie z zasadą 3 sesji — reguła zweryfikowana bezpośrednim
  żądaniem, nie tylko obserwacją UI, i działa poprawnie).

## Z-011 [POZYTYWNE] — twarda blokada wpisu akcji bez daty wpisu emisji do KRS działa na obu
warstwach (podgląd na sucho i faktyczny zapis), również przy pominięciu formularza

- **Co zrobiłem:** dwa bezpośrednie żądania z pominięciem formularza kreatora: (1)
  `POST /api/psa/spolki/:id/zdarzenia/podglad` z `typ:"emisja"` i `data_wpisu_krs: null`; (2) —
  kluczowe — `POST /api/psa/spolki/:id/zdarzenia` (zapis właściwy, z pominięciem etapu podglądu w
  ogóle) z tymi samymi danymi.
- **Co się stało:** podgląd zwrócił `200` z `"dopuszczalne": false` i komunikatem cytującym
  art. 300³⁰ § 2 KSH. Właściwy zapis — wywołany BEZPOŚREDNIO, z pominięciem etapu podglądu —
  zwrócił `422` z tym samym komunikatem i żadne zdarzenie nie zostało utrwalone w
  `psa_zdarzenia` (sprawdzone: licznik zdarzeń spółki się nie zmienił).
- **Co powinno się stać:** dokładnie to, co się stało — to jest dokładnie scenariusz z checklisty
  sesji („to musi być twarda blokada, spróbuj to złamać bezpośrednim żądaniem POST z pominięciem
  tego pola").
- **Podstawa:** art. 300³⁰ § 2 KSH, sankcja art. 592 § 3 KSH; `CLAUDE-PSA.md` reguła domenowa 12.
- **Waga:** POZYTYWNE (blokada jest rzeczywiście po stronie serwera, nie tylko UI — zweryfikowane
  z pominięciem formularza i z pominięciem etapu „podglądu").

## Z-012 [KRYTYCZNY] — emisja z datą wpisu do KRS WCZEŚNIEJSZĄ niż data rejestracji samej spółki w
KRS jest przyjmowana bez zastrzeżeń — „twarda blokada" z Z-011 sprawdza tylko OBECNOŚĆ daty, nie
jej wiarygodność

- **Co zrobiłem:** bezpośrednie żądanie `POST /api/psa/spolki/:id/zdarzenia` dla spółki
  zarejestrowanej w KRS `2026-09-17` (data dzisiejsza w tym środowisku), z nową emisją mającą
  `data_wpisu_krs: "2000-01-01"` — data sprzed ćwierć wieku, jednoznacznie wcześniejsza niż istnienie
  samej spółki.
- **Co się stało:** `201 Created` — zdarzenie zostało zapisane bez żadnego ostrzeżenia dotyczącego
  niespójności dat. System sprawdza WYŁĄCZNIE, czy pole `data_wpisu_krs` jest niepuste
  (`walidacje.js`, reguła cytowana w Z-011), nigdy nie porównuje go z `data_utworzenia_spolki` tej
  samej spółki ani nie sprawdza, czy data nie jest z odległej przeszłości/nieprawdopodobna.
- **Co powinno się stać:** `data_wpisu_krs` emisji nie powinna móc być wcześniejsza niż
  `data_utworzenia_spolki` (dla emisji założycielskiej — a dla kolejnych emisji, niż data
  rzeczywistego istnienia spółki w ogóle) — w przeciwnym razie sama sankcja karna z art. 592 § 3
  staje się fikcją: technicznie „pole jest wypełnione", ale materialnie stwierdza fakt, który nie
  mógł zajść.
- **Podstawa:** art. 300³⁰ § 2 KSH („wpis do rejestru akcjonariuszy następuje po wpisie SPÓŁKI do
  rejestru albo wpisie do rejestru nowej emisji akcji") — logicznie zakłada, że data wpisu emisji
  nie poprzedza wpisu spółki; sankcja art. 592 § 3 KSH pkt 1) („dopuszcza do zarejestrowania akcji
  (...) przed zarejestrowaniem prostej spółki akcyjnej"). `CLAUDE-PSA.md` reguła domenowa 12: „to
  MUSI być twarda blokada, nie ostrzeżenie".
- **Waga:** KRYTYCZNY — to jest DOKŁADNIE ta sama rodzina ryzyka (sankcja karna dla członka
  zarządu), a obecna kontrola tylko POZORNIE ją realizuje: sprawdza kształt danych, nie ich
  wiarygodność względem reszty rejestru tej samej spółki.

## Z-013 [POZYTYWNE] — bilans akcji jest kontrolowany na żywo, blokuje nadmiarowe objęcie i działa
transakcyjnie (bez częściowego zapisu przy błędzie), zweryfikowane bezpośrednim żądaniem

- **Co zrobiłem:** dla emisji AZ (100 akcji, 1–100) wysłałem bezpośrednie żądanie `POST
  /api/psa/spolki/:id/zdarzenia` `typ:"objecie"` z pozycjami: Anna Kowalska — 96 akcji, Inwestor —
  5 akcji (razem 101 > 100 wyemitowanych) — celowa niezgodność bilansu z checklisty sesji.
- **Co się stało:** `422`, komunikat: „Brak pokrycia: żądano 5 akcji, a pula akcji nieobjętych serii
  AZ obejmuje 4 akcji wolnych." Sprawdziłem stan spółki zaraz potem przez `GET /api/psa/spolki/:id`
  (bez odświeżania przeglądarki, więc bez ryzyka złapania nieaktualnego widoku SPA) — `akcjonariusze:
  []`, `Akcje w obrocie: 0` — czyli operacja NIE zapisała częściowo pierwszej pozycji (96 dla Anny)
  przed odrzuceniem drugiej. Po tym teście wysłałem POPRAWNE żądanie (95 + 5 = 100) — przyjęte
  (`201`), zgodne z serią AZ 1–95 / 96–100, `Razem 100 (100%)` — zweryfikowane na zrzucie `68`.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** art. 300³¹ § 2 KSH („zapewnienie zgodności liczby akcji zarejestrowanych w rejestrze
  z liczbą wyemitowanych akcji"); `CLAUDE-PSA.md` reguła domenowa 3 („Naruszenie = odmowa zapisu,
  nie ostrzeżenie").
- **Waga:** POZYTYWNE (kontrola na żywo, blokująca, transakcyjna — zgodnie ze specyfikacją).

## Z-014 [POZYTYWNE] — maskowanie PESEL-u, daty urodzenia i adresu zamieszkania innego akcjonariusza
w informacji z rejestru działa poprawnie, zweryfikowane wprost w treści HTML dokumentu

- **Co zrobiłem:** ponieważ akcjonariusz mniejszościowy nie ma własnego konta portalowego (Z-006),
  zweryfikowałem maskowanie przez ten sam mechanizm serwerowy z poziomu kancelarii — ekran
  „Informacja z rejestru" (`/spolki/:id/wydruk/informacja`, komponent `EkranInformacji`) pozwala
  pracownikowi wybrać „Odbiorca: akcjonariusz" i wskazać KONKRETNEGO akcjonariusza z listy; wynikowy
  adres (`GET /api/psa/spolki/:id/informacja.html?rola=akcjonariusz&odbiorca=<id_inwestora>`)
  pobrałem bezpośrednim żądaniem i porównałem z tym samym dokumentem dla `rola=spolka`.
- **Co się stało:** dla `rola=akcjonariusz` (widok „oczami" Inwestora, akcjonariusza
  mniejszościowego) wiersz Anny Kowalskiej (akcjonariusza większościowego) pokazuje jej imię i
  nazwisko w pełni jawnie, ale w miejscu adresu zamieszkania widnieje `••• •••, ••• •••` — dokument
  zawiera też explicite dopisaną klauzulę: „Numeru PESEL, daty urodzenia ani adresu zamieszkania
  pozostałych akcjonariuszy nie udostępnia się akcjonariuszowi (...)". Dla porównania, ten sam
  wiersz w wersji `rola=spolka` (widok kancelarii/spółki) pokazuje pełny, jawny adres „Testowa 1,
  80-280 Gdańsk". Własny wiersz odbiorcy (Inwestor, o SWOICH danych) w wersji `rola=akcjonariusz`
  pozostaje w pełni jawny (adres siedziby widoczny) — maskowanie dotyczy wyłącznie danych CUDZYCH,
  zgodnie z przepisem. PESEL i data urodzenia nie pojawiają się w treści dokumentu w OGÓLE, w
  żadnej z ról — zgodne z `PRZEPISY-PSA.md` sekcja 12 pkt 2 („PESEL, data urodzenia (...) nie są
  obowiązkową treścią rejestru P.S.A.").
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** art. 300³⁵ § 1¹ KSH; `CLAUDE-PSA.md` reguła domenowa 9.
- **Waga:** POZYTYWNE — ale patrz Z-006: mechanizm maskowania działa poprawnie, PROBLEM leży w tym,
  że akcjonariusz mniejszościowy nie ma samodzielnego sposobu dotrzeć do tego dokumentu przez
  portal (musi go dla niego wygenerować pracownik kancelarii, co jest dopuszczalną „postacią
  papierową" z art. 300³⁵ § 3 KSH, ale nie jest samoobsługą, którą aplikacja ma docelowo zapewniać).

## Z-015 [POZYTYWNE] — podwójne złożenie wniosku (odświeżenie po POST, powtórne bezpośrednie
żądanie) jest poprawnie blokowane, bez duplikatu wniosku ani spółki

- **Co zrobiłem:** zaraz po tym, jak klient złożył wniosek przez UI (`POST
  /api/psa/portal/wniosek/zloz`), wysłałem DRUGIE, bezpośrednie żądanie do tego samego endpointu (z
  tej samej sesji, z pominięciem formularza) — symulacja podwójnego kliknięcia/ponownego żądania
  sieciowego. Dodatkowo odświeżyłem (`F5`, pełny `page.reload()`) stronę wniosku klienta zaraz po
  złożeniu.
- **Co się stało:** drugie żądanie zwróciło `400`: „Wniosek ma już status «zlozony» — nie można go
  edytować." — żaden duplikat nie powstał. Po `F5` strona poprawnie pokazała ten sam, jeden wniosek
  ze statusem „Wniosek złożony" (zrzut `50`) — bez utraty danych i bez ponownego przejścia przez
  kreator. W kolejce kancelarii (`GET /api/psa/wnioski`) widnieje dokładnie jeden wpis dla tego
  klienta przez CAŁY dalszy przebieg S1.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** zasada techniczna z checklisty sesji („czy podwójne kliknięcie... tworzy dwa
  zgłoszenia... sprawdź też odświeżenie strony po wysłaniu formularza").
- **Waga:** POZYTYWNE. (Kontrastuje z Z-004, gdzie analogiczna ochrona na WCZEŚNIEJSZYM etapie —
  zgłoszenie wstępne — nie jest odporna na współbieżność; tutaj, na etapie „złożenia wniosku",
  ochrona po prostu sprawdza AKTUALNY status rekordu, co wystarcza, bo do tego momentu istnieje już
  tylko jeden wiersz `psa_wnioski` na konto.)

## Z-016 [POZYTYWNE] — kolejność podpisów (spółka jako pierwsza, potwierdzenie przez kancelarię/
notariusza jako ostatnie) jest wymuszona przez backend, nie tylko opisana instrukcją w UI

- **Co zrobiłem:** DWIE próby „podpisania jako notariusz przed spółką" bezpośrednim żądaniem
  `POST /api/psa/wnioski/:id/dokumenty/:dokId/podpis-potwierdz` (funkcja, którą pracownik kancelarii
  wykonuje jako ostatni krok, potwierdzając otrzymany podpisany skan) — z pominięciem etapu, w
  którym klient (spółka) w ogóle przesyła podpisany skan: (1) zaraz po założeniu sprawy, zanim
  jakikolwiek dokument został w ogóle wystawiony (nieistniejące `dokId`); (2) zaraz po wystawieniu
  kompletu dokumentów przez kancelarię, ale PRZED odesłaniem przez klienta jakiegokolwiek podpisu.
- **Co się stało:** próba (1) → `404 Nie odnaleziono dokumentu.`. Próba (2) → `400 Klient nie
  odesłał jeszcze skanu tego dokumentu.` — w obu przypadkach kancelaria/notariusz NIE mógł
  „podpisać"/potwierdzić przed spółką, mimo wywołania wprost tego samego endpointu API, który
  wywołuje przycisk w UI. Dopiero po tym, jak klient faktycznie odesłał podpisany skan (`POST
  /api/psa/portal/wniosek/dokumenty/:id/podpis`), identyczne żądanie potwierdzenia zwróciło `200`.
- **Co powinno się stać:** dokładnie to, co się stało — kolejność wymuszona po stronie serwera.
- **Podstawa:** zasada techniczna z checklisty sesji („czy kolejność podpisów jest wymuszona przez
  aplikację, spróbuj podpisać jako notariusz przed spółką").
- **Waga:** POZYTYWNE.

## Z-017 [DROBNY] — autozapis danych wniosku (debounce 800 ms) może po cichu utracić OSTATNIĄ
zmienioną wartość pola przy szybkiej nawigacji/odświeżeniu, bez żadnego ostrzeżenia

- **Co zrobiłem:** wpisałem wartość w pole „Firma (nazwa) spółki" i natychmiast odświeżyłem stronę
  (`F5`) po odczekaniu (a) 300 ms i (b) 1200 ms — zmierzone wprost przez odczyt `input.value` po
  ponownym załadowaniu strony (nie przez `innerText`, który nie odczytuje wartości pól formularza —
  pierwsza próba z `innerText` dała fałszywie ujemny wynik nawet dla przypadku (b), gdzie dane
  faktycznie przetrwały; poprawiłem metodę pomiaru przed wyciągnięciem wniosków).
- **Co się stało:** w wariancie (a) — 300 ms, poniżej progu debounce — wartość pola po odświeżeniu
  wróciła PUSTA (dane utracone, zapis nigdy nie zdążył wystartować). W wariancie (b) — 1200 ms,
  powyżej progu — wartość przetrwała poprawnie. Mechanizm autozapisu (`useAutozapis`,
  `publiczne/js/ui-rejestr.js:1077-1126`, `OPOZNIENIE_AUTOZAPISU_MS = 800`) nie ma obsługi zdarzenia
  `beforeunload` (bez ostrzeżenia o niezapisanych zmianach) ani mechanizmu „wymuś zapis przed
  nawigacją" — jedynym sygnałem dla użytkownika jest dyskretny, niewielki napis „Zapisywanie…" /
  „Zapisano” (`StanZapisu`), łatwy do przeoczenia przy szybkim działaniu.
- **Co powinno się stać:** albo skrócenie okna ryzyka (natychmiastowy zapis na `onBlur` pola, nie
  tylko debounce po każdej zmianie), albo `beforeunload` ostrzegający o niezapisanych zmianach, albo
  wymuszenie zapisu przy każdej nawigacji między krokami kreatora (obecnie „Dalej" w krokach 0/1 NIE
  wywołuje żadnego zapisu — poleganie wyłącznie na tle działającym debounce, patrz
  `publiczne/js/wniosek.js:859-867`).
- **Podstawa:** zasada techniczna z checklisty sesji („czy da się przerwać w połowie i wrócić (...)
  bez utraty danych").
- **Waga:** DROBNY (okno ryzyka jest krótkie — 800 ms — i dotyczy tylko OSTATNIEGO edytowanego pola
  bezpośrednio przed nawigacją, nie całego formularza; wskaźnik „Zapisywanie…" istnieje, choć jest
  dyskretny).

## Z-018 [DROBNY] — formularze aplikacji w dwóch miejscach nie wiążą programowo etykiety pola z
samym polem (`label` bez `for`/`htmlFor`) — luka dostępności (WCAG), niezależnie odkryta podczas
automatyzacji przeglądarki tą samą metodą, którą posłużyłby się czytnik ekranu

- **Co zrobiłem:** podczas budowania automatyzacji Playwright dla całej ścieżki S1 standardowa
  metoda Playwrightu `getByLabel()` (oparta o DOKŁADNIE ten sam mechanizm co czytniki ekranu —
  drzewo dostępności/`aria`) systematycznie zawodziła dla pól formularzy PO STRONIE KANCELARII
  (`kreator.js`, `spolki.js`, `osoby.js`) i częściowo dla pól ZŁOŻONYCH po stronie portalu klienta.
  Prześledziłem przyczynę do dwóch definicji komponentu `Pole`.
- **Co się stało:** (1) `publiczne/js/ui.js:45-58` (używana po stronie kancelarii — kreator zdarzeń,
  „Nowa spółka", kartoteka osób) renderuje `<label className="fl">` jako zwykłe RODZEŃSTWO pola, BEZ
  `htmlFor` W OGÓLE — żadne pole formularza pracownika kancelarii nie jest programowo powiązane ze
  swoją etykietą. (2) `publiczne/js/ui-rejestr.js:472-503` (używana po stronie portalu klienta) ma
  rozwiązanie świadome i lepsze — `htmlFor` jest ustawiany, gdy dziecko `Pole` jest POJEDYNCZYM,
  prostym `<input>`/`<select>`/`<textarea>` (komentarz w kodzie: „układy złożone (...) zostają bez
  powiązania, bo nie wiadomo, które z nich etykieta opisuje" — świadoma decyzja, nie przeoczenie) —
  ale w praktyni pozostawia bez powiązania WSZYSTKIE pola zbudowane z własnych komponentów: datę
  (`PoleDaty` — 3 osobne pola, choć te akurat mają własne `aria-label` per segment, więc częściowo
  to rekompensują), kwotę (`PoleKwoty` — BEZ własnego `aria-label`, więc pole „Kapitał akcyjny" jest
  całkowicie nieopisane dla czytnika ekranu), pole KRS z przyciskiem, wybór z kartoteki.
- **Co powinno się stać:** strona kancelarii (ui.js) powinna dostać analogiczne, świadome
  rozwiązanie jak strona portalu (ui-rejestr.js); komponent `PoleKwoty` powinien mieć własny
  `aria-label` (analogicznie do segmentów `PoleDaty`) tak, by przynajmniej pola „proste w środku
  złożonego opakowania" były opisane.
- **Podstawa:** zasada techniczna (dostępność, WCAG 2.1 kryterium 1.3.1/4.1.2 — poza zakresem
  `PRZEPISY-PSA.md`, ale istotne dla portalu udostępnianego publicznie).
- **Waga:** DROBNY (nie blokuje funkcjonalności dla przeciętnego użytkownika myszy/klawiatury, ale
  jest realną barierą dla osób korzystających z czytnika ekranu — a portal jest z założenia
  publiczny i ma obsługiwać akcjonariuszy, niekoniecznie tylko pracowników).

## Z-019 [DROBNY] — pole „data otwarcia rejestru" jest ustawiane automatycznie na dzień przyjęcia
wniosku, ZANIM jakiekolwiek zdarzenie (emisja/objęcie) zostało w ogóle wpisane do rejestru

- **Co zrobiłem:** obejrzałem kokpit spółki bezpośrednio po `POST /api/psa/wnioski/:id/przyjmij`, a
  jeszcze PRZED wprowadzeniem jakiejkolwiek emisji/objęcia akcji (zrzut `60`).
- **Co się stało:** panel „Umowa o prowadzenie rejestru" pokazywał już „Data otwarcia rejestru:
  17.09.2026" (dzień przyjęcia wniosku), mimo że w tym samym momencie licznik zdarzeń spółki wynosił
  `0`, tabela akcjonariatu pokazywała „Brak akcjonariuszy na wskazany dzień", a łańcuch zdarzeń był
  pusty. Nazwa pola sugeruje fakt dokonany („rejestr został otwarty tego dnia"), podczas gdy
  rzeczywiście nic jeszcze nie zostało do niego wpisane.
- **Co powinno się stać:** albo pole powinno pozostać puste do chwili pierwszego realnego wpisu
  (emisji założycielskiej), albo jego etykieta/opis powinny jasno rozróżniać „data przyjęcia spółki
  do obsługi" od „data faktycznego otwarcia rejestru (pierwszy wpis)".
- **Podstawa:** zasada techniczna — spójność etykiet z rzeczywistym stanem danych; pośrednio art.
  300³⁴ § 1 KSH (kolejność zdarzeń w czasie ma znaczenie prawne dla samego rejestru).
- **Waga:** DROBNY (kosmetyczna niespójność nazewnictwa/momentu ustawienia pola, bez wpływu na
  poprawność samego rejestru zdarzeń, który w tym momencie poprawnie pokazuje zero wpisów).

---

## FAZA 2 — opłaty (zakres Z-100…Z-129, zajęte: Z-100…Z-109)

Wszystkie poniższe naliczenia zweryfikowane PRAKTYCZNIE przez bezpośrednie żądania HTTP do
`localhost:3005` (zalogowany jako `audyt@kancelaria.test`, rola `admin`), nie tylko przez lekturę
kodu. Spółka testowa własna: id `10` („Audyt Faza2 Otwarcie..."). Spółka współdzielona użyta za
zgodą instrukcji sesji (miała już wystarczającą liczbę akcjonariuszy/akcji z FAZY 1): id `6`
(„Audyt S1 410411..."). Wszystkie opłaty założone wyłącznie do testów zostały po zakończeniu testu
oznaczone `status: anulowana` przez `PATCH /api/psa/oplaty/:id` (nie usunięte — appka nie ma
kasowania opłat, tylko anulowanie), żeby nie zepsuć zestawień innych równolegle pracujących agentów
audytu. Zestawienie opłat, które zostały CELOWO pozostawione aktywne (bo są prawidłowym efektem
mojego testu na mojej własnej spółce), oraz tych anulowanych po teście, jest w
`testy-audyt/FAZA-2-WYNIK.md`.

## Z-100 [KRYTYCZNY] — dwa niezależne, wzajemnie „nieświadome" mechanizmy naliczania opłaty za
prowadzenie rejestru współdzielą tabelę `psa_oplaty` i mogą PODWÓJNIE obciążyć tę samą spółkę za
ten sam rok

- **Co zrobiłem:** w kodzie (`server/oplaty.js`) są DWIE osobne rodziny funkcji dla opłaty typu
  `prowadzenie`: (A) rocznicowa — `naliczOkresProwadzenia`/`naliczPierwszyRok`/`naliczOdnowienia`,
  wołana przy przyjęciu wniosku portalowego (`server/trasy/wnioski.js:820`) i przez
  `POST /api/psa/oplaty/odnowienia` (jedyny przycisk w UI: „Nalicz kolejny rok"), z idempotencją po
  kolumnie `okres_od` (data); (B) kalendarzowa — `naliczOplateProwadzenia`/`naliczOplateRoczneWszystkie`,
  wołana WYŁĄCZNIE przez `POST /api/psa/oplaty/naliczenie-roczne` (`wymagajAdmina`, ISTNIEJE w
  API, ale nie jest podpięta pod ŻADEN przycisk UI — `grep` po `naliczenie-roczne` w `publiczne/`
  daje zero wyników), z idempotencją po kolumnie `okres` (tekst roku, np. `"2026"`). Wywołałem (B)
  bezpośrednim żądaniem `POST /api/psa/oplaty/naliczenie-roczne {"rok":"2026"}` na współdzielonej
  bazie testowej, na której spółka id `6` MIAŁA JUŻ aktywną opłatę `prowadzenie` naliczoną przez (A)
  z `okres = "2026/2027"`, `okres_od = "2026-09-17"`, `okres_do = "2027-09-16"`.
- **Co się stało:** (B) nie rozpoznało istniejącej opłaty z (A) — bo szuka wyłącznie po
  `okres = '2026'` (dosłowny tekst), a opłata z (A) ma `okres = '2026/2027'` (etykieta rocznikowa,
  bo rok prowadzenia spółki 6 nie pokrywa się z rokiem kalendarzowym). W jednym wywołaniu (B)
  naliczyło DODATKOWĄ opłatę 1200 zł dla WSZYSTKICH 9 aktywnych spółek w bazie testowej (nie tylko
  spółki 6) — łącznie 9 nowych, nadmiarowych naliczeń po 1200 zł. Dla spółki `6` oznacza to, że w
  jednym roku prowadzenia rejestru istniałyby DWIE opłaty za `prowadzenie` (2400 zł zamiast 1200 zł),
  gdyby nie zostały ręcznie anulowane. Posprzątałem: wszystkie 9 nowo utworzonych opłat (id 8–16)
  oznaczyłem `anulowana` przez `PATCH /api/psa/oplaty/:id`, żeby nie zafałszować zestawień innych
  agentów audytu pracujących na tej samej bazie.
- **Co powinno się stać:** oba mechanizmy powinny albo być jednym mechanizmem (rocznicowy zastępuje
  kalendarzowy — dokładnie to mówi komentarz w kodzie przy `naliczOdnowienia`: „Zastepuje wsadowe
  «naliczenie roczne» po kalendarzu"), albo endpoint (B) powinien zostać usunięty/wyłączony teraz,
  gdy (A) jest jedynym mechanizmem używanym przez UI, albo (B) powinno przed wstawieniem sprawdzać
  BRAK JAKIEJKOLWIEK aktywnej opłaty `prowadzenie` pokrywającej ten rok u danej spółki (niezależnie
  od formatu `okres`), nie tylko dosłowne dopasowanie tekstu.
- **Podstawa:** checklista sesji („Czy naliczenie roczne jest idempotentne — uruchom je dwa razy dla
  tego samego roku") — w obrębie KAŻDEGO z dwóch mechanizmów z osobna idempotencja działa
  poprawnie (patrz Z-107), ale mechanizmy nie są idempotentne WZGLĘDEM SIEBIE, a operują na tej
  samej tabeli i tym samym `typ = 'prowadzenie'`. `PRZEPISY-PSA.md` § 9 (prowadzenie rejestru 1200
  zł za każdy rozpoczęty rok — RAZ, nie dwa razy za ten sam rok).
- **Waga:** KRYTYCZNY. Zawyżenie taksy notarialnej — dokładnie ten typ błędu, przed którym ostrzega
  wstęp do tej fazy audytu („zawyżenie taksy to nie błąd rachunkowy, tylko problem zawodowy”).
  Endpoint (B) jest wprawdzie martwy z punktu widzenia UI, ale jest w pełni funkcjonalny w API i
  wymaga wyłącznie roli `admin` — jedno przypadkowe wywołanie (skrypt, cron, ręczne wpisanie w
  konsoli przeglądarki przez admina) naliczy nadmiarowe opłaty dla WSZYSTKICH aktywnych spółek
  naraz, nie tylko jednej.

## Z-101 [KRYTYCZNY] — ręczny wpis opłaty (`POST /api/psa/oplaty/`) przyjmuje DOWOLNĄ kwotę w
groszach, łącznie z kwotą znacznie przekraczającą stawkę maksymalną z rozporządzenia

- **Co zrobiłem:** `POST /api/psa/oplaty/` z ciałem
  `{"spolka_id":6,"typ":"wpis","kwota_grosze":100000000}` (czyli 1 000 000 zł za wpis, którego
  stawka maksymalna to 100 zł — `PRZEPISY-PSA.md` § 9).
- **Co się stało:** `201`, opłata zapisana z `kwota_grosze: 100000000` bez żadnego błędu ani
  ostrzeżenia. `server/oplaty.js: dodajOplateReczna` liczy kwotę jako
  `kwotaGrosze != null ? Number(kwotaGrosze) : ustawienia.stawkaGrosze(...)` — brak JAKIEJKOLWIEK
  górnej granicy. Dla porównania: `server/logika/ustawienia.js: bledy()` (ekran „Ustawienia
  kancelarii", zmiana STAWKI DOMYŚLNEJ) ma dokładnie taką walidację
  (`Math.round(liczba) > gorna` → błąd), więc appka WIE, jaka jest stawka maksymalna i umie ją
  wyegzekwować — po prostu nie robi tego przy pojedynczym ręcznym wpisie opłaty. Posprzątałem:
  opłata (id 19) oznaczona `anulowana`.
- **Co powinno się stać:** `dodajOplateReczna` (albo trasa `POST /api/psa/oplaty/`) powinna
  odrzucać kwotę przekraczającą `przepisy.STAWKI_MAKSYMALNE_GROSZE[typ]`, tak samo jak robi to już
  `ustawienia.bledy()` dla stawki domyślnej kancelarii.
- **Podstawa:** checklista sesji („Czy gdziekolwiek da się naliczyć kwotę powyżej stawki
  maksymalnej (np. przez ręczną korektę bez walidacji)") — dokładnie ten scenariusz.
  `PRZEPISY-PSA.md` § 9 (stawki są MAKSYMALNE).
- **Waga:** KRYTYCZNY. To dokładnie ta furtka, o której ostrzega checklista sesji wprost, i którą
  aplikacja w INNYM miejscu (ustawienia kancelarii) już umie zamknąć — brakuje tylko powtórzenia tej
  samej walidacji przy ręcznym wpisie pojedynczej opłaty.

## Z-102 [POWAŻNY] — ręczny wpis opłaty przyjmuje kwotę UJEMNĄ bez żadnej walidacji

- **Co zrobiłem:** `POST /api/psa/oplaty/` z `{"spolka_id":6,"typ":"informacja","kwota_grosze":-5000}`.
- **Co się stało:** `201`, opłata zapisana z `kwota_grosze: -5000` (`kwota_zl: -50`). Żaden przepis
  ani reguła domenowa nie przewiduje pojęcia „opłaty ujemnej” — to albo błąd operatora (literówka
  minusa), albo próba ukrytego rabatu/korekty, która powinna iść inną drogą (np. adnotacja/notatka +
  osobna, jawna pozycja korygująca), nie przez ujemną kwotę tego samego typu opłaty. Ujemna opłata
  wchodzi też do sumy `suma_grosze` na liście opłat i do CSV eksportowanego do księgowości bez
  żadnego oznaczenia. Posprzątałem: opłata (id 18) oznaczona `anulowana`.
- **Co powinno się stać:** walidacja `kwotaGrosze >= 0` (analogicznie do walidacji, którą
  `ustawienia.bledy()` już stosuje dla stawki domyślnej: „musi być liczbą nieujemną”).
- **Podstawa:** reguła domenowa nr 5 (kwoty w groszach) w połączeniu ze zdrowym rozsądkiem
  księgowym — opłata z ujemną kwotą nie ma odpowiednika w żadnym z trzech typów opłat z
  `PRZEPISY-PSA.md` § 9.
- **Waga:** POWAŻNY — nie jest to bezpośrednio „zawyżenie taksy”, ale otwiera furtkę do cichego,
  niekontrolowanego zaniżania należności kancelarii bez śladu uzasadnienia.

## Z-103 [KRYTYCZNY] — ręczny wpis opłaty przyjmuje kwotę ZMIENNOPRZECINKOWĄ i zapisuje ją
dosłownie w kolumnie `kwota_grosze`, łamiąc regułę domenową nr 5

- **Co zrobiłem:** `POST /api/psa/oplaty/` z `{"spolka_id":6,"typ":"informacja","kwota_grosze":100.7}`.
- **Co się stało:** `201`, opłata zapisana i odczytana z powrotem jako
  `"kwota_grosze":100.7,"kwota_zl":1.0070000000000001` — dosłowny, nieskracalny float trafił do
  kolumny, która wg `CLAUDE-PSA.md` sekcja 4 reguła 5 („Kwoty w groszach (`INTEGER`). Cena
  emisyjna, opłaty. Żadnych floatów.”) ma być liczbą całkowitą. `SQLite` NIE wymusza typu kolumny
  (`psa_oplaty` nie jest tabelą `STRICT` — sprawdziłem, `grep -n STRICT server/migracje.js` nie daje
  wyników), więc REAL trafia do bazy bez żadnego błędu. Przyczyna: `dodajOplateReczna` liczy
  `Number(kwotaGrosze)` BEZ `Math.round()` — dla porównania, `ustawienia.stawkaGrosze()` (stawka
  domyślna kancelarii) używa `Math.round(liczba)` właśnie po to, żeby to wykluczyć. Interfejs
  (`publiczne/js/wnioski.js: ModalNowaOplata`) chroni przed tym PO STRONIE KLIENTA
  (`Math.round(Number(dane.kwota_grosze) * 100)`), ale to ochrona wyłącznie w UI — bezpośrednie
  żądanie ją omija, dokładnie jak przewiduje checklista sesji („Poszukaj arytmetyki
  zmiennoprzecinkowej na kwotach”). Posprzątałem: opłata (id 17) oznaczona `anulowana`.
- **Co powinno się stać:** `dodajOplateReczna` powinno robić `Math.round(Number(kwotaGrosze))` (i
  odrzucać wynik nie-skończony/nie-całkowity) zamiast gołego `Number(...)`, tak jak już robi to
  `ustawienia.stawkaGrosze()` dla tej samej jednostki (grosze).
- **Podstawa:** `CLAUDE-PSA.md` sekcja 4, reguła domenowa nr 5 — dosłownie naruszona, ze skutkiem w
  bazie danych, nie tylko teoretycznym. Checklista sesji FAZA 2, punkt o arytmetyce
  zmiennoprzecinkowej.
- **Waga:** KRYTYCZNY. To dokładnie scenariusz, przed którym ostrzega wstęp checklisty sesji
  („jeden `0.1 + 0.2` w kodzie opłat to błąd na fakturze”) — tu nie jest to nawet arytmetyka w
  kodzie appki, tylko brak ubezpieczenia przed tym, co przyjdzie z zewnątrz w żądaniu.

## Z-104 [DROBNY] — wartość nienumeryczna `kwota_grosze` w ręcznym wpisie opłaty powoduje
niezłapany błąd 500 zamiast czytelnego błędu walidacji

- **Co zrobiłem:** `POST /api/psa/oplaty/` z `{"spolka_id":6,"typ":"informacja","kwota_grosze":"abc"}`.
- **Co się stało:** `{"blad":"Wystąpił nieoczekiwany błąd serwera."}` — czyli wyjątek w handlerze
  (prawdopodobnie `INSERT` z `kwota_grosze = NaN`, SQLite odrzuca `NaN` jako parametr) zamiast `400`
  z czytelnym komunikatem. Nie sprawdzałem treści logu serwera pod kątem wycieku stack trace (to
  zakres FAZA 5 — bezpieczeństwo), odnotowuję wyłącznie brak walidacji wejścia w tym miejscu.
- **Co powinno się stać:** walidacja `Number.isFinite(...)` PRZED próbą zapisu, z czytelnym `400`
  („Kwota musi być liczbą”), analogicznie do wzorca stosowanego już w kilku innych miejscach modułu
  (np. `ustawienia.bledy()`).
- **Podstawa:** ogólna jakość obsługi błędów; pośrednio ta sama reguła nr 5 (kwota ma być liczbą
  całkowitą — appka nawet nie sprawdza, czy to w ogóle LICZBA, zanim odrzuci albo przyjmie).
- **Waga:** DROBNY (błąd 500 jest przynajmniej WIDOCZNY i NIE zapisuje błędnych danych — w
  przeciwieństwie do Z-101/102/103, które przechodzą bez ostrzeżenia).

## Z-105 [POZYTYWNE] — „jedno żądanie = jeden wpis = jedna opłata” działa poprawnie przy
przeniesieniu akcji do trzech nabywców naraz

- **Co zrobiłem:** na spółce `6` założyłem sprawę `przeniesienie` (zbywca — akcjonariuszka z 95
  akcjami serii `AZ`) z JEDNĄ pozycją `pozycje` zawierającą TRZECH różnych nabywców (30/30/35 akcji,
  osoby nowo założone z `aml_status: "wykonane"`), zweryfikowałem sprawę i wykonałem
  `POST /api/psa/sprawy/4/wpisz` w jednym żądaniu.
- **Co się stało:** powstało DOKŁADNIE JEDNO zdarzenie `przeniesienie` (`zdarzenie.id: 26`,
  wszystkie trzy przeniesienia w jednym `dane_json.pozycje`) i DOKŁADNIE JEDNA opłata typu `wpis`
  (100 zł, `kwota_grosze: 10000`) — nie 300 zł, nie trzy osobne wiersze `psa_oplaty`.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** checklista sesji („Jedno żądanie = jeden wpis = jedna opłata (...) Czy naliczono
  100 zł, czy 300 zł?").
- **Waga:** POZYTYWNE.

## Z-106 [POZYTYWNE] — odmowa wpisu nie nalicza opłaty; zajęcie egzekucyjne z urzędu jest wolne od
opłat i nie wymaga żądającego

- **Co zrobiłem:** (a) założyłem sprawę `przeniesienie` na spółce `6`, przeniosłem ją do
  `weryfikacja`, wykonałem `PATCH .../6 {"akcja":"odmow","powod_odmowy_kod":"brak_dokumentow"}` i
  porównałem listę opłat spółki przed/po (6 opłat przed, 6 opłat po — bez zmian, suma
  `130000` groszy identyczna); (b) założyłem sprawę `zajecie` ze `zrodlo: "z_urzedu"` BEZ
  `zadajacy_osoba_id`/`zadajacy_rola` (endpoint ich nie zażądał — sprawa od razu wylądowała w stanie
  `weryfikacja`, z pominięciem `nowa`) i wykonałem wpis.
- **Co się stało:** (a) żadna nowa opłata nie powstała po odmowie. (b) sprawa przyjęta bez
  żądającego, odpowiedź `POST .../wpisz` zawierała `"oplata": null` — zero opłat naliczonych za
  wpis z urzędu.
- **Co powinno się stać:** dokładnie to, co się stało — art. 300³⁴ § 2 KSH (zajęcie wolne od
  opłat, bez żądania) i ogólna zasada „opłata za DOKONANY wpis”, nie za samo złożenie/rozpatrzenie
  żądania.
- **Podstawa:** checklista sesji („Odmowa wpisu (...) Nie powinno [naliczać]”; „Zajęcie egzekucyjne
  (...) wolne od opłat (...) Sprawdź, że aplikacja nie nalicza niczego i nie wymaga żądania”).
  `PRZEPISY-PSA.md` § 9, art. 300³⁴ § 2 KSH.
- **Waga:** POZYTYWNE.

## Z-107 [POZYTYWNE] — rok prowadzenia rejestru liczony konsekwentnie od rocznicy otwarcia
rejestru (nie kalendarzowo); mechanizm rocznicowy jest sam w sobie idempotentny

- **Co zrobiłem:** (a) zweryfikowałem bezpośrednio funkcję `oplaty.okresProwadzenia("2025-12-20", 1)`
  (czysta funkcja z `server/oplaty.js`, bez zapisu do bazy) — data otwarcia rejestru 20 grudnia; (b)
  na spółce `6` (opłata `prowadzenie` już istniejąca za okres `2026-09-17`–`2027-09-16`) wywołałem
  `POST /api/psa/oplaty/odnowienia {"dni":365}` DWUKROTNIE pod rząd.
- **Co się stało:** (a) `{"od":"2025-12-20","do":"2026-12-19","etykieta":"2025/2026"}` — JEDNA
  opłata 1200 zł pokrywająca cały rok od 20 grudnia do 19 grudnia następnego roku, NIE osobno za
  „rozpoczęty” grudzień i osobno za styczeń nowego roku kalendarzowego. (b) pierwsze wywołanie
  naliczyło dokładnie jedną nową opłatę (kolejny rok, `okres: "2027/2028"`), drugie identyczne
  wywołanie: `"naliczone":0,"pominiete":0` — brak duplikatu. Posprzątałem: opłata z testu (b),
  id 20, oznaczona `anulowana` (nie była jeszcze wymagalna — powstała tylko dzięki sztucznie dużemu
  oknu `dni:365` użytemu do testu).
- **Co powinno się stać:** dokładnie to, co się stało — § 15b pkt 1 rozporządzenia mówi „za każdy
  rozpoczęty rok”, nie „za każdy rozpoczęty rok kalendarzowy”.
- **Podstawa:** checklista sesji („Rok rozpoczęty. Zawrzyj umowę z datą 20 grudnia (...) Sprawdź,
  czy rok liczony jest kalendarzowo, czy od daty umowy”; „Czy naliczenie roczne jest
  idempotentne — uruchom je dwa razy”).
- **Waga:** POZYTYWNE — w kontraście z Z-100, gdzie ten sam mechanizm rocznicowy jest poprawny SAM
  W SOBIE, ale nie chroni przed równoległym mechanizmem kalendarzowym operującym na tej samej
  tabeli.

## Z-108 [POWAŻNY] — spółki zakładane wewnętrznym kreatorem kancelarii (z pominięciem wniosku
portalowego) nigdy nie dostają automatycznie naliczonej opłaty za prowadzenie rejestru — ani przy
otwarciu, ani później

- **Co zrobiłem:** założyłem nową spółkę WYŁĄCZNIE przez `POST /api/psa/spolki/` (bez żadnego
  wniosku portalowego), z `data_otwarcia_rejestru: "2025-12-20"`, i otworzyłem jej rejestr przez
  `POST /api/psa/spolki/10/otworz-rejestr` z dwoma zdarzeniami założycielskimi (emisja 50 akcji +
  objęcie przez jednego akcjonariusza). Osobno sprawdziłem stan opłat spółek `1`–`5` (już istniejące
  w bazie testowej, też założone bez `data_otwarcia_rejestru`/bez wniosku — sądząc po `otwarcie:
  null` na liście spółek).
- **Co się stało:** po otwarciu rejestru spółki `10` (2 zdarzenia w łańcuchu, akcjonariusz wpisany)
  `GET /api/psa/oplaty/?spolka_id=10` zwróciło ZERO opłat. Spółki `1`–`5` miały ZERO opłat typu
  `prowadzenie` przed moim testem z Z-100 (dopiero mój — potem anulowany — kalendarzowy
  `naliczenie-roczne` cokolwiek im naliczył). Przyczyna: `naliczPierwszyRok` (jedyny automatyczny
  „starter” opłaty rocznicowej) jest wołany WYŁĄCZNIE z `server/trasy/wnioski.js:820`, czyli tylko
  przy przyjęciu wniosku ZŁOŻONEGO PRZEZ PORTAL. Ścieżka „kancelaria zakłada spółkę i otwiera jej
  rejestr ręcznie" (`spolki.js` + `otworz-rejestr`) nigdy tej funkcji nie woła. A skoro
  `okresyDoOdnowienia`/`/odnowienia` (mechanizm przypomnień i automatycznego naliczania KOLEJNYCH
  lat) wymaga JUŻ ISTNIEJĄCEGO wiersza `prowadzenie` z wypełnionym `okres_od`/`okres_do`, żeby
  policzyć „następny okres" — dla takiej spółki nie odpali się NIGDY, nawet w kolejnych latach,
  chyba że ktoś ręcznie doda pierwszą opłatę PRZEZ WYWOŁANIE NIEDOSTĘPNEJ Z ZEWNĄTRZ funkcji
  `naliczOkresProwadzenia` (jedyna droga „ręczna" — `POST /api/psa/oplaty/` z `dodajOplateReczna` —
  zapisuje `okres` jako tekst, ale NIGDY `okres_od`/`okres_do`, więc i tak nie wejdzie do
  mechanizmu odnowień).
- **Co powinno się stać:** albo `POST /:id/otworz-rejestr` powinno też naliczać pierwszy rok
  prowadzenia (analogicznie do `wnioski.js:820`), albo powinien istnieć jawny, osobny przycisk/
  endpoint „nalicz pierwszy rok prowadzenia" dla spółek zakładanych ręcznie, dostępny z poziomu
  kokpitu spółki — żeby nie polegać na tym, że pracownik PAMIĘTA o ręcznym wystawieniu pierwszej
  opłaty i wpisaniu jej w sposób zgodny z mechanizmem odnowień (co dziś nie jest w ogóle możliwe
  przez żaden dostępny endpoint).
- **Podstawa:** checklista sesji, punkt „Otwarcie rejestru (...) Ile opłat naliczono?" — zbadany tu
  dla DRUGIEJ, mniej oczywistej ścieżki zakładania spółki (patrz też pytanie P-007 poniżej dla
  ścieżki wniosku portalowego, gdzie naliczana jest dokładnie jedna opłata `prowadzenie`, zero
  opłat `wpis`).
- **Waga:** POWAŻNY. To odwrotność Z-100/Z-101 — nie „zawyżenie", tylko cichy, systemowy brak
  naliczenia, zależny wyłącznie od tego, KTÓRĄ z dwóch ścieżek zakładania spółki wybrał pracownik.
  Realne ryzyko utraty przychodu kancelarii, bez żadnego sygnału ostrzegawczego w UI.

## Z-109 [DROBNY] — pole `okres` przy ręcznym wpisie opłaty typu `prowadzenie` nie jest w ogóle
walidowane formatem, w przeciwieństwie do endpointu `/naliczenie-roczne`

- **Co zrobiłem:** przejrzałem `server/trasy/oplaty.js` — trasa `POST /` sprawdza tylko, że
  `cialo.okres` jest „prawdziwe" (`if (typ === 'prowadzenie' && !cialo.okres)`), bez żadnego
  dopasowania do wzorca roku. Endpoint `/naliczenie-roczne` obok wymaga `^\d{4}$`.
- **Co się stało:** (analiza kodu, bez dodatkowego żądania — pochodna Z-100/Z-109 nie wymagała
  osobnego testu) — pracownik może ręcznie wpisać `okres` w dowolnym formacie (np. `"rok 2026"`,
  `" 2026 "`, `"2026/2027 (dodatkowo)"`), co jeszcze bardziej utrudnia późniejsze dopasowanie do
  istniejących opłat rocznicowych (pogłębia ryzyko z Z-100, bo zwiększa liczbę możliwych,
  wzajemnie niedopasowanych zapisów tego samego roku).
- **Co powinno się stać:** walidacja formatu `okres` przy ręcznym wpisie, analogiczna do
  `/naliczenie-roczne`, ewentualnie z ostrzeżeniem, jeśli podobny `okres` już istnieje dla tej
  spółki.
- **Podstawa:** spójność walidacji między dwoma endpointami operującymi na tym samym polu.
- **Waga:** DROBNY.
