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

## FAZA 5 — bezpieczeństwo i izolacja danych (zakres Z-250…Z-289)

Metodologia: żądania bezpośrednie do API (`curl`/skrypty `node` z `better-sqlite3`), z pominięciem
interfejsu, jak zaleca checklista sesji. Utworzono własne konta testowe portalu (`faza5.spolkaA@…`,
`faza5.spolkaB@…`, `faza5.akcjA@…`, `faza5.akcjB@…`, `faza5.akcjA2@…` wpisane bezpośrednio do
`psa_konta` z zahaszowanym hasłem przez `logika/hasla.js`, bo — patrz Z-006 z FAZA 1 — nie istnieje
żadna ścieżka API tworząca konto roli `akcjonariusz`) oraz dwóch wnioskodawców przez publiczne
`POST /portal/zgloszenia` + `POST /portal/aktywacja/:token` (`faza5.wnioskC@…` = wniosek id 6,
`faza5.wnioskD@…` = wniosek id 7), powiązanych z istniejącymi spółkami współdzielonej bazy testowej
(spółka 1 = „Audyt S2 Rada Dyrektorów”, spółka 2 = „Audyt S3 Osoba Prawna”, osoby 1/2 akcjonariusze
spółki 1, osoba 3 akcjonariusz spółki 2). Konto admina kancelarii: `audyt@kancelaria.test`.

## Z-250 [KRYTYCZNY] — wylogowanie z portalu klienta NIE unieważnia wydanego tokenu sesji — stary
ciasteczko działa dalej aż do naturalnego wygaśnięcia (do 8 godzin)

- **Co zrobiłem:** zalogowałem się do portalu jako konto testowe `faza5.spolkaA@example-test.pl`
  (rola „spółka”), zapisałem kopię ciasteczka sesji (`psa_sesja_portal`) PRZED wylogowaniem,
  wywołałem `POST /api/psa/portal/logout` (odpowiedź `{"ok":true}`), a następnie wysłałem
  `GET /api/psa/portal/moje` z ZACHOWANĄ KOPIĄ starego ciasteczka (nie z nowym, już usuniętym przez
  serwer).
- **Co się stało:** żądanie ze starym ciasteczkiem zwróciło HTTP 200 z pełną listą spółek konta
  (nazwa, KRS, NIP, adres, dane reprezentanta, liczba akcjonariuszy, liczba akcji) — dokładnie tak,
  jakby wylogowanie nigdy się nie wydarzyło. Przyczyna: sesje w `server/logika/sesja.js` to
  bezstanowy token podpisany HMAC-SHA256 (`typ + id + exp`, bez żadnego numeru/wersji sesji) —
  `wylogujKonto`/`wylogujPracownika` (`server/pomocnicze/autoryzacja.js`) WYŁĄCZNIE każe
  przeglądarce skasować ciasteczko (`Set-Cookie` z przeszłą datą wygaśnięcia); sam token nie jest
  nigdzie unieważniany (nie ma listy odwołanych tokenów, nie ma numeru sesji w bazie). Token
  przechwycony wcześniej (np. przez złośliwe rozszerzenie przeglądarki, XSS, dostęp fizyczny do
  urządzenia przed wylogowaniem, log pośredniczącego proxy) pozostaje w pełni ważny przez cały czas
  życia TTL — `TTL_PORTAL_MS = 8h` dla kont portalu, `TTL_PRACOWNIK_MS = 12h` dla pracowników
  kancelarii — niezależnie od tego, ile razy właściciel konta kliknie „Wyloguj”.
- **Kontrola pozytywna (dla porównania):** to samo stare ciasteczko PRZESTAJE działać natychmiast,
  gdy konto zostanie DEZAKTYWOWANE w bazie (`aktywne = 0`) — `wczytajSesje` sprawdza stan konta przy
  KAŻDYM żądaniu, więc ten mechanizm istnieje i działa poprawnie (potwierdzone empirycznie: konto
  13 dezaktywowane → `GET /whoami` natychmiast zwraca `zalogowany: false`). Oznacza to, że
  infrastruktura do unieważniania sesji po stronie serwera JUŻ ISTNIEJE (kolumna stanu konta
  sprawdzana za każdym razem) — po prostu wylogowanie i zmiana hasła (patrz Z-251) nie korzystają z
  analogicznego mechanizmu (np. znacznika czasu „sesje ważne od”/numeru wersji sesji w
  `psa_konta`/`psa_uzytkownicy`, porównywanego z `exp`/dodatkowym polem tokenu).
- **Co powinno się stać:** wylogowanie (i najlepiej też upływ dłuższej bezczynności) powinno
  unieważniać token po stronie serwera, nie tylko kasować ciasteczko po stronie przeglądarki — np.
  przez dopisanie kolumny „token ważny od” (znacznik czasu) do `psa_konta`/`psa_uzytkownicy`,
  ustawianej na `wylogujKonto`/`wylogujPracownika`, i porównywanej przy odczycie tokenu w
  `wczytajSesje` (token wystawiony PRZED tym znacznikiem jest odrzucany) — analogicznie do już
  istniejącego sprawdzenia `aktywne`.
- **Podstawa:** zasada techniczna — podstawowa właściwość funkcjonalna mechanizmu „wyloguj się”,
  której użytkownik ma prawo oczekiwać (RODO art. 32 ust. 1 lit. b — zdolność do zapewnienia
  poufności i integralności danych; sesja pozostająca ważna mimo wylogowania jest wprost sprzeczna
  z tym wymogiem, gdy token wyciekł). Poza formalnym zakresem `PRZEPISY-PSA.md` (KSH), ale
  bezpośrednio dotyczy poufności PESEL-i, adresów i danych finansowych przechowywanych w module.
- **Waga:** KRYTYCZNY (dotyczy WSZYSTKICH sesji w systemie — zarówno portalu klienta, jak
  i pracowników kancelarii, bo `logika/sesja.js` jest wspólny dla obu typów; „Wyloguj” daje
  fałszywe poczucie bezpieczeństwa, a okno ekspozycji sięga 8-12 godzin).

## Z-251 [KRYTYCZNY] — zmiana hasła NIE unieważnia już wydanych tokenów sesji — przejęta sesja
przetrwa reakcję na włamanie, którą użytkownik uważa za skuteczną

- **Co zrobiłem:** zalogowałem się jako administrator kancelarii (`audyt@kancelaria.test`),
  zapisałem kopię aktywnego ciasteczka sesji PRZED zmianą hasła, wywołałem
  `POST /api/psa/auth/zmiana-hasla` (zmiana z hasła audytowego na nowe, odpowiedź `{"ok":true}`),
  po czym wysłałem `GET /api/psa/spolki/` z ZACHOWANĄ KOPIĄ starego ciasteczka. Po teście
  natychmiast przywróciłem oryginalne hasło administratora przez ten sam endpoint, żeby nie
  zablokować dostępu innym agentom audytu korzystającym z tego samego konta.
- **Co się stało:** żądanie ze starym ciasteczkiem (wystawionym PRZED zmianą hasła) zwróciło HTTP
  200 z pełną listą spółek kancelarii — zmiana hasła nie miała żadnego wpływu na ważność już
  wydanego tokenu. Ten sam rdzeń przyczyny co Z-250: token niesie wyłącznie `{typ, id, exp}` i nie
  jest w żaden sposób powiązany z aktualnym hashem hasła ani z żadnym licznikiem/znacznikiem wersji
  sesji odczytywanym przy każdym żądaniu.
- **Dlaczego to jest gorsze niż samo Z-250:** zmiana hasła jest STANDARDOWĄ, powszechnie zalecaną
  pierwszą reakcją na podejrzenie przejęcia konta („zmień hasło natychmiast”) — użytkownik i admin
  słusznie oczekują, że ta czynność odcina napastnika od konta. W tym systemie NIE ODCINA: token
  skradziony PRZED zmianą hasła pozostaje w pełni użyteczny przez resztę swojego TTL (do 12h dla
  pracownika, do 8h dla portalu), mimo że hasło już zostało zmienione. Jedyną skuteczną reakcją na
  podejrzenie przejęcia sesji pracownika jest dziś DEZAKTYWACJA konta przez administratora
  (`PATCH /api/psa/auth/uzytkownicy/:id`) — sama zmiana/reset hasła (także `POST
  /uzytkownicy/:id/reset-hasla`) tego nie załatwia.
- **Co powinno się stać:** zmiana hasła (własna i reset przez admina) powinna unieważniać
  WSZYSTKIE dotychczasowe tokeny tego konta — ten sam mechanizm co proponowany w Z-250 (znacznik
  „sesje ważne od”, aktualizowany też przy zmianie/resecie hasła, nie tylko przy wylogowaniu).
- **Podstawa:** zasada techniczna — standardowa oczekiwana właściwość zarządzania sesją przy
  zmianie poświadczeń (OWASP Session Management: „zmiana hasła powinna unieważniać wszystkie
  aktywne sesje”). RODO art. 32 ust. 1 lit. b — jak w Z-250.
- **Waga:** KRYTYCZNY (ten sam mechanizm co Z-250, ale efekt praktyczny jest poważniejszy: to
  jedyna reakcja na włamanie, którą typowy pracownik w ogóle zna i wykona samodzielnie, i która
  okazuje się nieskuteczna).

## Z-252 [potwierdzenie/pogłębienie Z-001] — `GET /api/psa/meta` — ostateczna ocena wagi w
kontekście całej FAZY 5: DROBNY, nie POWAŻNY

- **Co zrobiłem:** pogłębiłem analizę zawartości `GET /api/psa/meta` (zgłoszone jako Z-001 w
  FAZA 0) w kontekście całościowego przeglądu bezpieczeństwa: pełny odczyt struktury JSON bez
  sesji, porównanie z zawartością analogicznego, chronionego logowaniem `GET /api/psa/portal/cennik`
  oraz z `GET /api/psa/ustawienia` (chronionym, `wymagajPracownika`).
- **Co się stało:** endpoint ujawnia WYŁĄCZNIE metadane systemowe niezwiązane z żadną konkretną
  spółką ani osobą: słownik typów zdarzeń wraz z checklistami i podstawami prawnymi, słowniki
  statusów/stanów, `pola_wrazliwe` (nazwy pól, nie wartości), datę serwera (`dzisiaj`), flagi
  `portal_wlaczony`/`podglad_systemu` oraz `stawki_grosze`/`stawki_maksymalne_grosze`. Istotny
  niuans: `stawki_grosze` w `/meta` pochodzi ze STAŁYCH w kodzie (`logika/przepisy.js:
  STAWKI_GROSZE`), NIE z bieżąco skonfigurowanych w bazie stawek tej konkretnej kancelarii
  (`ustawienia.stawkaGrosze(db(), …)`, którego używa chroniony logowaniem `GET
  /portal/cennik` i chroniony `wymagajPracownika` `GET /ustawienia`) — więc nawet gdyby kancelaria
  ustawiła inne, niestandardowe stawki w `/ustawienia`, `/meta` nadal pokazywałby stare, domyślne
  wartości ze źródła, nie faktycznie obowiązujące ceny. Nie znaleziono w odpowiedzi żadnych danych
  osobowych, danych konkretnej spółki, PESEL-i, adresów, ani informacji o klientach kancelarii.
- **Co powinno się stać:** dla spójności modelu autoryzacji (każdy inny endpoint pod `/api/psa/*`
  poza tym jednym wymaga sesji) endpoint powinien jednak dostać `wymagajPracownika` jak reszta
  plików `pozostale.js` — ale praktyczny skutek naprawy jest kosmetyczny/porządkowy, nie
  bezpieczeństwa danych osobowych: nic wrażliwego dziś nie wycieka.
- **Podstawa:** zasada techniczna (spójność modelu autoryzacji), nie przepis ustawy.
- **Waga:** DROBNY (podtrzymuję niższy kraniec widełek z Z-001: brak PII, brak danych rejestru
  konkretnej spółki, ujawnione stawki to wartości DOMYŚLNE ze źródła, nie faktyczna, aktualna
  konfiguracja kancelarii). Rekomenduję Łukaszowi PORZĄDKOWĄ, nie pilną, poprawkę.

## Z-253 [POWAŻNY] — brak kontroli sygnatury treści pliku przy dwóch trasach uploadu
(`osoby.js` — skany AML, `spolki.js` — załącznik umowy) — niespójność względem reszty aplikacji

- **Co zrobiłem:** przejrzałem wszystkie 4 trasy `multer` w aplikacji (`portal.js` ×2, `sprawy.js`,
  `osoby.js`, `spolki.js`) pod kątem obecności `pliki.trescPasuje()` (kontrola sygnatury bajtów pliku
  względem deklarowanego rozszerzenia — mechanizm opisany wprost w komentarzu
  `server/pomocnicze/pliki.js` jako obrona przed „skanem X udającym PDF”). Następnie zalogowany
  jako admin, wysłałem plik `.pdf` będący w rzeczywistości stroną HTML ze skryptem
  (`<script>alert(document.cookie)</script>`) na `POST /api/psa/spolki/1/umowa-zalacznik`.
- **Co się stało:** `portal.js` (dowód tożsamości, skan podpisany) i `sprawy.js` (dokumenty do
  sprawy) MAJĄ kontrolę sygnatury — potwierdzone wcześniej w tej samej sesji: identyczny plik
  HTML-jako-PDF wysłany na `POST /api/psa/portal/wniosek/dowod` został odrzucony (`400`, „Treść
  pliku nie odpowiada jego rozszerzeniu”). `osoby.js` (`POST /:id/aml-skany`) i `spolki.js`
  (`POST /:id/umowa-zalacznik`) TEJ KONTROLI NIE MAJĄ — upload HTML-jako-PDF na
  `/api/psa/spolki/1/umowa-zalacznik` zakończył się `201 Created` i plik trafił na dysk
  (`spolka_1/umowa-rejestru/…-fake.pdf`) bez żadnego ostrzeżenia.
- **Czynnik łagodzący (sprawdzony empirycznie):** przy POBIERANIU tego pliku z powrotem
  (`GET /api/psa/spolki/1/umowa-zalacznik`) serwer wymusza `Content-Type: application/pdf` na
  podstawie ROZSZERZENIA nazwy pliku (`pliki.naglowkiPliku` → `typZNazwy`), niezależnie od
  rzeczywistej treści, dodaje `X-Content-Type-Options: nosniff` i podaje plik jako `attachment`
  (nie `inline`) — więc przeglądarka nie wykona go jako HTML/JS w kontekście sesji kancelarii przy
  zwykłym pobraniu. Ryzyko XSS jest więc w praktyce silnie ograniczone, ale NIE wyeliminowane
  całkowicie (np. gdyby ktoś ręcznie zmienił rozszerzenie zapisanego pliku przy późniejszym
  eksporcie/ZIP-ie, albo gdyby inna, przyszła trasa serwowała ten sam plik inaczej).
- **Co powinno się stać:** dodać `pliki.trescPasuje()` do `uploadSkanuAml` (`osoby.js`) i
  `uploadUmowy` (`spolki.js`) — dokładnie ten sam trzyliniowy wzorzec, co w `portal.js`/`sprawy.js`
  — żeby WSZYSTKIE cztery trasy uploadu w aplikacji miały tę samą obronę, a nie trzy z czterech.
  Ma to dodatkowe znaczenie poza samym bezpieczeństwem: skany AML są dokumentem w rozumieniu
  procedury AML kancelarii — plik, który w rzeczywistości nie jest tym, za co się podaje, podważa
  integralność dokumentacji AML.
- **Podstawa:** zasada techniczna — spójność mechanizmu obrony między trasami tego samego typu w
  tej samej aplikacji (mechanizm istnieje i jest udokumentowany w kodzie jako celowa obrona, więc
  jego brak w dwóch miejscach na cztery jest przeoczeniem, nie świadomą decyzją).
- **Waga:** POWAŻNY (realny brak kontroli integralności pliku na dwóch z czterech tras uploadu w
  aplikacji obsługującej AML i dokumenty założycielskie spółek; obniżone z KRYTYCZNEGO wyłącznie
  dzięki potwierdzonym empirycznie zabezpieczeniom po stronie serwowania pliku, które ograniczają —
  ale nie zerują teoretycznie — praktyczną szkodliwość).

## Z-254 [DROBNY] — komunikaty błędów `multer` (limit rozmiaru/liczby plików) docierają do klienta
po angielsku, nie po polsku — przygotowane polskie tłumaczenie jest martwym kodem

- **Co zrobiłem:** wysłałem plik 21 MB (limit deklarowany wszędzie to 20 MB) na
  `POST /api/psa/portal/wniosek/dowod`, zalogowany jako testowe konto wnioskodawcy portalu.
- **Co się stało:** odpowiedź to `HTTP 400 {"blad":"File too large"}` — surowy, angielski komunikat
  biblioteki `multer`. Tymczasem `server/pomocnicze/odpowiedzi.js` (`posrednikBledow`) ma
  przygotowaną, przetłumaczoną obsługę dokładnie tego przypadku: `if (blad.name === 'MulterError')
  { … komunikaty = { LIMIT_FILE_SIZE: 'Plik jest za duży (limit 20 MB).', LIMIT_FILE_COUNT: … } }`
  — ale ten fragment kodu NIGDY się nie wykonuje, bo WSZYSTKIE cztery trasy uploadu w aplikacji
  (sprawdzone przeglądem `portal.js` ×2, `sprawy.js`, `osoby.js`, `spolki.js`) łapią błąd multer
  RĘCZNIE w callbacku i owijają go w `bledneZadanie(e.message)` — czyli w `BladZadania` z surowym
  `e.message` — zanim błąd w ogóle dotrze do centralnego `posrednikBledow`, którego test na
  `blad instanceof BladZadania` (linijka wcześniejsza niż test na `MulterError`) przechwytuje go
  pierwej i zwraca message bez tłumaczenia.
- **Co powinno się stać:** albo usunąć martwy kod tłumaczenia z `posrednikBledow` (bo nigdy się nie
  wykonuje), albo — lepiej — zmienić cztery miejsca wywołania na przekazywanie SUROWEGO błędu
  multer dalej (`dalej(e)`, nie `dalej(bledneZadanie(e.message))`), żeby faktycznie trafiał do
  przygotowanej gałęzi tłumaczenia.
- **Podstawa:** zasada techniczna — i18n/spójność UX (aplikacja jest po polsku wszędzie indziej);
  nie problem bezpieczeństwa — sam LIMIT rozmiaru pliku jest egzekwowany poprawnie (patrz Z-260),
  to wyłącznie treść komunikatu o odmowie jest w złym języku.
- **Waga:** DROBNY.

## Z-255 [DROBNY] — błąd parsowania nieprawidłowego JSON-a w treści żądania zwraca HTTP 500
(„nieoczekiwany błąd serwera”) zamiast HTTP 400 („błędne żądanie”)

- **Co zrobiłem:** wysłałem żądanie z nagłówkiem `Content-Type: application/json` i celowo
  uszkodzoną treścią (`{nieprawidlowy json`) na `POST /api/psa/spolki/` z sesją admina.
- **Co się stało:** `HTTP 500 {"blad":"Wystąpił nieoczekiwany błąd serwera."}`. Log serwera
  poprawnie zapisał WYŁĄCZNIE metadane techniczne, bez treści żądania: `[psa] POST /api/psa/spolki/
  — SyntaxError: Expected property name or '}' in JSON at position 1…` — więc TA konkretna część
  (nie ujawnianie treści/danych osobowych w logu, patrz też Z-261) działa poprawnie. Problemem jest
  wyłącznie KOD STATUSU: błąd parsowania JSON-a rzucany przez wbudowany `express.json()` to
  `SyntaxError`, którego `posrednikBledow` nie rozpoznaje jako błąd KLIENTA (nie jest instancją
  `BladZadania` ani żadnej z rozpoznawanych nazw), więc trafia do gałęzi ogólnej i dostaje 500,
  mimo że przyczyną jest wyłącznie nieprawidłowe żądanie klienta, nie awaria serwera.
- **Co powinno się stać:** `posrednikBledow` powinien rozpoznawać `blad instanceof SyntaxError &&
  blad.status === 400 &&  'body' in blad` (charakterystyczne dla błędu `body-parser`/`express.json`)
  i zwracać `400` z komunikatem „Nieprawidłowy format danych żądania.” zamiast `500`.
- **Podstawa:** zasada techniczna — poprawność kodów stanu HTTP (błąd klienta ≠ błąd serwera); nie
  problem bezpieczeństwa — żadna informacja wrażliwa nie wycieka, to wyłącznie niepoprawna
  klasyfikacja błędu.
- **Waga:** DROBNY.

## Z-256 [POZYTYWNE] — izolacja klientów portalu (trzypoziomowy mechanizm w `portal.js`) działa
poprawnie na WSZYSTKICH przetestowanych trasach — brak IDOR

- **Co zrobiłem:** systematycznie przetestowałem izolację między dwoma niezależnymi kontami
  „spółka” (spółka 1 / spółka 2), dwoma kontami „akcjonariusz” różnych spółek, dwoma kontami
  „akcjonariusz” TEJ SAMEJ spółki (osoby 1 i 2, obie akcjonariusze spółki 1) i dwoma kontami
  „wnioskodawca” (osobne wnioski C i D) — na każdej trasie portalu, która przyjmuje identyfikator
  spółki (w ścieżce `:spolkaId` albo w ciele `spolka_id`) albo identyfikator zasobu należącego do
  innego konta: `GET /rejestr/:spolkaId` (obca spółka → `404`), `POST /zadania` (obce `spolka_id`
  w ciele → `404`), `POST /informacja/zamow` (obce `spolka_id` → `404`), `POST
  /zadania/:id/dokumenty` (cudza sprawa jako `:id` → `404` przez `wczytajSpraweDlaKonta`), `PUT`/
  `DELETE /wniosek/akcjonariusze/:id` (cudza pozycja akcjonariusza wniosku, inne konto
  wnioskodawcy, ten sam mechanizm co poprzednio zgłoszone Z-014 dla PESEL-i → `404`, dane
  NIE zostały nadpisane ani odczytane), `GET/POST informacja/:oplataId/wydaj` (cudza opłata →
  `404` przez `wczytajOplateKonta`).
- **Co się stało:** KAŻDA próba dostępu do cudzego zasobu zwróciła `404 „Nie odnaleziono…”` (nigdy
  `403`, zgodnie z udokumentowaną w kodzie zasadą nieujawniania istnienia cudzych zasobów), a dane
  docelowe pozostały nietknięte we wszystkich próbach zapisu/modyfikacji. Nie znalazłem ANI JEDNEJ
  trasy portalu pomijającej bramki `wymagajKonta`/`router.param('spolkaId')`/
  `wymagajDostepuDoSpolkiWCiele`/lokalne sprawdzenie własności zasobu opisane w komentarzu
  `portal.js:363-384` — potwierdza to, dokładnie punkt po punkcie, zapowiedź audytu FAZA 0
  („portal.js — najbardziej podatne miejsce na błąd »jedna trasa zapomniana«”): NIE znalazłem takiej
  zapomnianej trasy.
- **Podstawa:** zasada techniczna — potwierdzenie poprawności izolacji wielopodmiotowej.
- **Waga:** POZYTYWNE.

## Z-257 [POZYTYWNE] — kontrola dostępu do wydanego dokumentu „informacja z rejestru”
(`GET /informacja/:id`) poprawnie rozróżnia odbiorcę spółka/akcjonariusz — działa zgodnie z opisem

- **Co zrobiłem:** przetestowałem cztery kombinacje na dwóch faktycznie wydanych dokumentach:
  (1) dokument wydany SPÓŁCE (odbiorca_osoba_id = NULL) otwarty przez samą spółkę → działa;
  (2) ten sam dokument otwarty przez INNĄ spółkę (mająca dostęp do innej spółki) → `404`;
  (3) ten sam dokument (wydany spółce) otwarty przez AKCJONARIUSZA tej samej spółki → `404`
  (zgodnie z komentarzem w kodzie: dostęp do spółki NIE WYSTARCZA, bo dokument spółki niesie pełne
  dane WSZYSTKICH akcjonariuszy); (4) dokument wydany KONKRETNEMU akcjonariuszowi (osoba 1) otwarty
  przez INNEGO akcjonariusza TEJ SAMEJ spółki (osoba 2) → `404`. Dodatkowo: dokument wydany
  akcjonariuszowi, otwarty przez SPÓŁKĘ tej samej spółki → dozwolone (bo rola „spółka” i tak ma
  pełny, nie zamaskowany dostęp do danych wszystkich swoich akcjonariuszy poprzez własny rejestr —
  `logika/maskowanie.js: ROLE_PELNY_DOSTEP` obejmuje `spolka` — więc to NIE jest dodatkowy wyciek).
- **Co się stało:** wszystkie cztery przypadki zachowały się zgodnie z oczekiwaniem opisanym w
  komentarzu kodu (`portal.js:1843-1886`) — mechanizm, który wg komentarza był kiedyś naprawiany po
  wykryciu błędu, dziś działa poprawnie.
- **Podstawa:** zasada techniczna — potwierdzenie poprawności kontroli dostępu opartej o
  `odbiorca_osoba_id`, nie tylko o dostęp do spółki.
- **Waga:** POZYTYWNE.

## Z-258 [POZYTYWNE] — ograniczenie liczby prób logowania działa i zostało potwierdzone
empirycznie zarówno dla portalu klienta, jak i dla logowania pracowników kancelarii

- **Co zrobiłem:** wysłałem 6 kolejnych żądań `POST /api/psa/auth/login` z nieprawidłowym hasłem
  (ten sam adres e-mail, ten sam adres IP) oraz analogicznie na `POST /api/psa/portal/login`
  (opisane wcześniej w tej samej sesji, przed restartem serwera).
- **Co się stało:** pierwsze 5 prób zwróciło `401 „Nieprawidłowy e-mail lub hasło”`, szósta zwróciła
  `429 „Za dużo nieudanych prób logowania. Spróbuj ponownie za 15 min.”` — dokładnie zgodnie z
  `logika/limiter.js` (`LIMIT = 5` prób na klucz IP+e-mail w oknie 15 minut, dodatkowo
  `LIMIT_IP = 30` na sam adres IP jako obrona przed rozpylaniem haseł po wielu kontach). Limiter
  działa niezależnie dla obu ścieżek logowania (`auth.js` i `portal.js`, każde wywołuje
  `limiter.sprawdz` z własnym kluczem).
- **Zastrzeżenie odnotowane, nie punktowane osobno:** licznik prób trzymany jest WYŁĄCZNIE w
  pamięci procesu (`const proby = new Map()`, komentarz w kodzie to przyznaje wprost) — restart
  serwera (co faktycznie nastąpiło w trakcie tej sesji audytu) zeruje wszystkie liczniki, a
  wdrożenie za load-balancerem z wieloma instancjami dzieliłoby ruch na kilka niezależnych liczników
  (limit efektywnie mnożony przez liczbę instancji). W obecnym wdrożeniu jednoinstancyjnym to
  świadomy, udokumentowany kompromis (sekcja 11 specyfikacji: „własna implementacja, licznik w
  pamięci”), nie błąd — nie kwalifikuję tego jako osobne znalezisko, wyłącznie jako zastrzeżenie do
  ewentualnej przyszłej skalowalności poziomej.
- **Podstawa:** zasada techniczna — potwierdzenie działania obrony przed brute-force.
- **Waga:** POZYTYWNE.

## Z-259 [POZYTYWNE] — path traversal w nazwie wgrywanego pliku zablokowany konsekwentnie na
wszystkich czterech trasach uploadu

- **Co zrobiłem:** wgrałem plik z `originalname` ustawionym ręcznie na
  `../../../../etc/cron.d/evil.pdf` na `POST /api/psa/portal/wniosek/dowod`.
- **Co się stało:** plik wylądował dokładnie tam, gdzie powinien
  (`dokumenty/wnioski/wniosek_7/podpisane/<uuid>-evil.pdf`) — katalogi ze złośliwej nazwy zostały
  odcięte. Przyczyna: wszystkie cztery konfiguracje `multer.diskStorage` w aplikacji (`portal.js`
  ×2 zestawy, `sprawy.js`, `osoby.js`, `spolki.js`) używają identycznego wzorca
  `path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_')` poprzedzonego
  losowym UUID — `path.basename` usuwa każdy komponent ścieżki, więc `../../x` staje się `x`.
  Dodatkowo każde pobranie pliku z dysku (`wyslijPlikDokumentu` w `portal.js`, analogiczne funkcje
  w `osoby.js`/`spolki.js`) sprawdza `pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW)` jako drugą
  linię obrony.
- **Podstawa:** zasada techniczna — potwierdzenie odporności na path traversal.
- **Waga:** POZYTYWNE.

## Z-260 [POZYTYWNE] — limit rozmiaru pliku (20 MB) egzekwowany konsekwentnie na wszystkich
trasach uploadu, żądanie ponadwymiarowe odrzucone bez zapisania pliku na dysk

- **Co zrobiłem:** wysłałem plik 21 MB (`.pdf` z doklejonym losowym balastem) na `POST
  /api/psa/portal/wniosek/dowod` (limit deklarowany: 20 MB).
- **Co się stało:** żądanie zostało odrzucone (`HTTP 400`, treść komunikatu patrz Z-254) — `multer`
  przerywa odbiór strumienia natychmiast po przekroczeniu `limits.fileSize`, więc ponadwymiarowy
  plik nie jest w całości zapisywany na dysk ani buforowany w pamięci serwera (nie sprawdzałem
  pełnych 500 MB z checklisty sesji wprost — uznałem to za nadmiarowe wobec kosztu/czasu, bo
  mechanizm odpowiedzialny za odcięcie strumienia jest tym samym mechanizmem `multer.limits`
  niezależnie od tego, o ile żądanie przekracza limit; zdecydowałem się przetestować margines tuż
  nad progiem (21 MB / 20 MB), co jest wystarczające do potwierdzenia, że ograniczenie faktycznie
  działa, a nie jest tylko deklaracją w kodzie).
- **Podstawa:** zasada techniczna — obrona przed wyczerpaniem miejsca na dysku/pamięci (DoS przez
  upload).
- **Waga:** POZYTYWNE.

## Z-261 [POZYTYWNE] — komunikaty błędów i logi serwera nie ujawniają stack trace, zapytań SQL,
ścieżek serwera ani danych osobowych/treści dokumentów

- **Co zrobiłem:** wywołałem błąd 500 (malformed JSON, patrz Z-255) i sprawdziłem zarówno
  odpowiedź HTTP, jak i log procesu serwera (`console.error` w `posrednikBledow`); dodatkowo
  przejrzałem zawartość tabeli `psa_dziennik_dostepu` (log dostępu do danych wrażliwych) po serii
  operacji z danymi wrażliwymi (PESEL, wydanie informacji z rejestru, pobranie załącznika umowy).
- **Co się stało:** odpowiedź HTTP dla błędu 500 to wyłącznie `{"blad":"Wystąpił nieoczekiwany błąd
  serwera."}` — bez stack trace, bez treści zapytania SQL, bez ścieżki pliku na serwerze. Log
  procesu zapisuje wyłącznie `[psa] METODA ŚCIEŻKA — NazwaBłędu: komunikat` (metadane techniczne,
  zgodnie z jawną zasadą w komentarzu `server/pomocnicze/odpowiedzi.js`: „NIE logujemy treści
  dokumentów ani danych osobowych — wyłącznie metadane techniczne”) — potwierdzone: nie znalazłem
  ani jednego przypadku treści żądania (PESEL, hasła, zawartości pliku) w logu procesu. Wpisy
  `psa_dziennik_dostepu` zawierają wyłącznie: kto (e-mail/imię), typ konta, id spółki/osoby, rodzaj
  akcji, krótki opis metadanowy (np. „stan na 2026-09-17”, „skan dokumentu AML: nazwa_pliku.pdf”) —
  żadnych wartości PESEL, adresów ani treści dokumentów. Tabela nie jest też udostępniona żadnym
  endpointem API (sprawdzone: `grep` po `psa_dziennik_dostepu` w całym `server/trasy/` nie
  znajduje żadnego odczytu) — dziś nie da się jej przeczytać inaczej niż bezpośrednim dostępem do
  bazy.
- **Zastrzeżenie drobne, nie punktowane osobno:** hasło tymczasowe administratora przy PIERWSZYM
  starcie aplikacji (`auth.js: zapewnijAdmina`) trafia jawnym tekstem do stdout serwera — jest to
  typowa, jednorazowa praktyka „bootstrap hasła” spotykana w wielu systemach (komunikat wprost
  każe je zmienić po pierwszym logowaniu), a dostęp do logów procesu produkcyjnego i tak zakłada
  poziom zaufania wyższy niż dostęp do samej aplikacji — nie kwalifikuję tego jako osobne
  znalezisko bezpieczeństwa, wyłącznie jako obserwację do rozważenia (np. wypisywanie hasła tylko
  gdy `NODE_ENV !== 'production'`, w produkcji generowanie i wymuszanie zmiany bez wypisywania).
- **Podstawa:** zasada techniczna — potwierdzenie zgodności z zasadą „logi bez PII” z sekcji 11
  specyfikacji.
- **Waga:** POZYTYWNE.

## Z-262 [POZYTYWNE] — katalog dokumentów NIE jest serwowany statycznie — pliki dostępne
wyłącznie przez kontrolowane trasy API z autoryzacją

- **Co zrobiłem:** po wgraniu pliku przez API (ścieżka względna zwrócona przez API, np.
  `wnioski/wniosek_6/podpisane/<uuid>-plik.pdf`), spróbowałem pobrać ten sam plik bezpośrednio pod
  `http://localhost:3005/dokumenty/<ta_sama_sciezka>` — z pominięciem jakiejkolwiek trasy API i bez
  żadnej sesji.
- **Co się stało:** żądanie zwróciło `HTTP 200`, ale treścią odpowiedzi był `index.html` aplikacji
  jednostronicowej (`Content-Type: text/html`, rozmiar pasujący do SPA), NIE zawartość pliku —
  ponieważ `KATALOG_DOKUMENTOW` (`./dokumenty`) leży POZA katalogiem serwowanym statycznie
  (`express.static(path.join(__dirname, 'publiczne'), …)`), więc żądanie trafia w
  `aplikacja.get('*', …)` (fallback SPA), a nie w rzeczywisty plik. Na pierwszy rzut oka `HTTP 200`
  wygląda niepokojąco (typowy sygnał udanego dostępu), dlatego odnotowuję to wyraźnie jako
  ZWERYFIKOWANY BRAK problemu, żeby ktoś inny nie musiał tego sprawdzać ponownie po zobaczeniu
  samego kodu stanu w innym narzędziu.
- **Podstawa:** zasada techniczna — potwierdzenie izolacji katalogu dokumentów od statycznego
  serwowania plików.
- **Waga:** POZYTYWNE.

## Z-263 [POZYTYWNE] — nadpisanie pól spoza formularza (mass assignment) skutecznie
zablokowane białymi listami pól na trasach portalu klienta

- **Co zrobiłem:** wysłałem żądania z dodatkowymi, nieautoryzowanymi polami w treści JSON,
  dokładnie wg checklisty sesji: `PUT /wniosek` z dodatkowym `{spolka_id, status: "przyjety",
  konto_id: 999, id: 999}` (po usunięciu `spolka_id`, które — patrz niżej — wyzwala osobną bramkę);
  `POST /wniosek/akcjonariusze` z dodatkowym `{aml_status: "pozytywny", zweryfikowano: 1,
  osoba_id: 999}`.
- **Co się stało:** żadne z podstawionych pól nie zostało zapisane — `status` wniosku pozostał
  `w_przygotowaniu` (nie `przyjety`), `konto_id` pozostał `13` (nie `999`), `aml_status` w ogóle nie
  pojawił się w odpowiedzi (nie ma go w białej liście `POLA_AKCJONARIUSZA_WNIOSKU`), `zweryfikowano`
  pozostał `0`, `osoba_id` pozostał `null`. Mechanizm: `wyczyscWniosek`/
  `wyczyscAkcjonariuszaWniosku` (`portal.js`) iterują WYŁĄCZNIE po zamkniętej liście dozwolonych pól
  (`POLA_WNIOSKU`/`POLA_AKCJONARIUSZA_WNIOSKU`) i ignorują wszystko inne w `zad.body` — klasyczna,
  poprawnie zaimplementowana biała lista zamiast czarnej listy. Efekt uboczny odnotowany przy
  okazji (nie błąd, zamierzone zachowanie): pole dosłownie NAZWANE `spolka_id` w treści JAKIEGOKOLWIEK
  żądania portalu jest przechwytywane przez globalny `wymagajDostepuDoSpolkiWCiele` (`router.use`)
  NIEZALEŻNIE od tego, czy dana trasa w ogóle używa tego pola semantycznie — próba z `spolka_id: 999`
  w ciele `PUT /wniosek` (gdzie to pole nic nie znaczy — `POLA_WNIOSKU` go nie zawiera) zwróciła
  `404 „Nie odnaleziono spółki”` zamiast przejść dalej, co jest zgodne z udokumentowaną w kodzie,
  celową zasadą „bezpieczne dla nieznanej przyszłej trasy”, ale warte odnotowania jako możliwe
  źródło mylącego komunikatu błędu, gdyby kiedyś jakieś pole formularza miało nazywać się dosłownie
  `spolka_id` w innym znaczeniu.
- **Podstawa:** zasada techniczna — potwierdzenie ochrony przed mass assignment.
- **Waga:** POZYTYWNE.

## Z-264 [POZYTYWNE] — sesja portalu klienta i sesja pracownika kancelarii są w pełni
niezależne; sesja portalu nie daje żadnego dostępu do endpointów kancelaryjnych

- **Co zrobiłem:** z aktywną, ważną sesją portalu klienta (ciasteczko `psa_sesja_portal`, brak
  `psa_sesja`) wywołałem sześć różnych endpointów kancelaryjnych: `GET /api/psa/spolki/`, `GET
  /api/psa/osoby/`, `GET /api/psa/wnioski/`, `GET /api/psa/auth/uzytkownicy` (admin), `GET
  /api/psa/pulpit`, `GET /api/psa/ustawienia`.
- **Co się stało:** wszystkie sześć zwróciło `401 „Ta operacja wymaga zalogowania”` — sesja portalu
  nie jest w żaden sposób honorowana przez `wymagajPracownika`/`wymagajAdmina` (te sprawdzają
  wyłącznie `zad.uzytkownik`, wypełniane wyłącznie z ciastka `psa_sesja`, nigdy z
  `psa_sesja_portal`) — potwierdza to opis w `pomocnicze/autoryzacja.js`, że oba typy sesji „nie
  mieszają się”, nawet w tej samej przeglądarce.
- **Podstawa:** zasada techniczna — potwierdzenie braku podniesienia uprawnień między dwoma typami
  sesji.
- **Waga:** POZYTYWNE.

---

# FAZA 4 — podpisy i tożsamość (Z-200 … Z-210)

> Testy przez bezpośrednie żądania HTTP (`curl`, sesja pracownika `audyt@kancelaria.test` i osobne
> konto portalowe klienta założone dla tej fazy) oraz Playwright dla zrzutów potwierdzających.
> Dane testowe własne, poza bazą współdzieloną z FAZA 1: spółka „Faza4 AML Test 001 P.S.A." (id 7,
> KRS `0000999001`) i osoby „Zalozyciel Adam" (id 17), „Nabywca Bogdan" (id 18) — do testów bramki
> AML; wniosek portalowy „Faza4 Podpisy P.S.A." (id 8, KRS `0000998877`, konto portalowe
> `faza4.klient@example-test.pl`, spółka końcowa id 12) — do testu integralności podpisanych
> dokumentów.

## Z-200 [KRYTYCZNY] — bramka AML NIE blokuje wpisu w stanie domyślnym `aml_status = 'brak'` —
blokuje WYŁĄCZNIE jawnie ustawiony status `niemozliwe`; to zachowanie strukturalne, nie luka
konkretnego endpointu

- **Co zrobiłem:** utworzyłem własną spółkę (id 7) i dwie osoby przez `POST /api/psa/osoby/`
  (obie z domyślnym, nigdy nietykanym `aml_status: "brak"` — tak wygląda KAŻDA nowo założona osoba
  w kartotece, dopóki pracownik jej ręcznie nie zmieni). Otworzyłem rejestr (`POST
  /api/psa/spolki/7/otworz-rejestr`, emisja 100 akcji dla „Zalozyciel Adam"), po czym wykonałem
  `POST /api/psa/spolki/7/zdarzenia` typu `przeniesienie` 10 akcji na „Nabywca Bogdan"
  (`aml_status` cały czas `"brak"`), bez żadnego obejścia UI poza pominięciem samego formularza.
  Kontrola: ten sam scenariusz powtórzony po ręcznym ustawieniu `aml_status = "niemozliwe"` dla
  „Nabywca Bogdan" (`PUT /api/psa/osoby/18`).
- **Co się stało:** przeniesienie z `aml_status: "brak"` zostało PRZYJĘTE — `201 Created`,
  zdarzenie #27 zapisane do łańcucha, jedyny ślad to `"ostrzezenia": ["Wobec nabywcy „Nabywca
  Bogdan" nie odnotowano wykonania środków bezpieczeństwa finansowego (AML)."]` w treści
  odpowiedzi (informacja, nie blokada). Kontrola z `aml_status: "niemozliwe"` — poprawnie
  ODRZUCONA: `400`, `"Wpis nie może zostać dokonany."`. Prześledziłem kod:
  `server/logika/walidacje.js` (`sprawdzAml`, linie ok. 237–271) traktuje `niemozliwe` jako wpis do
  tablicy `bledy` (blokuje — `dopuszczalne: bledy.length === 0`, linia 793), a KAŻDY inny status
  (w tym domyślny `brak`) jako wpis WYŁĄCZNIE do `ostrzezenia` (nigdy nie blokuje). To zachowanie
  jest wspólne dla WSZYSTKICH dróg wpisu przechodzących przez `_wykonajWpis`/`przygotujPodglad`
  (`server/rejestr.js`) — zarówno bezpośredniego `POST /api/psa/spolki/:id/zdarzenia`, jak
  i „oficjalnej" ścieżki `POST /api/psa/sprawy/:id/wpisz` używanej przez UI kancelarii — więc to
  NIE jest kwestia „ominięcia bramki przez ominięcie UI": nawet operator klikający przez normalny
  ekran sprawy trafia w tę samą, nieblokującą walidację, jeśli nikt wcześniej ręcznie nie ustawił
  `aml_status` na `wykonane`.
- **Co powinno się stać:** zależnie od odpowiedzi na PYTANIE-DO-ŁUKASZA poniżej — jeśli środki
  bezpieczeństwa finansowego są rzeczywiście obowiązkowe przed wpisem transakcyjnym (co sugeruje
  PRZEPISY-PSA.md § 9: „brak możliwości zastosowania środków bezpieczeństwa finansowego stanowi
  przeszkodę wpisu, a przy jej nieusunięciu — odmowę wpisu" — czyli PRZESZKODĄ jest tu chyba nie
  tylko `niemozliwe`, ale też brak jakiejkolwiek weryfikacji), status `brak` powinien blokować wpis
  transakcyjny tak samo jak `niemozliwe` (różnica powinna być w KOMUNIKACIE — „nie wykonano jeszcze
  weryfikacji" vs „weryfikacja niemożliwa" — nie w tym, czy wpis przechodzi).
- **Podstawa:** PRZEPISY-PSA.md § 9 (⚠️ do potwierdzenia) w zestawieniu z kodem
  `server/logika/przepisy.js` (komentarz przy `AML_STATUSY`: „Brak możliwości zastosowania środków
  bezpieczeństwa finansowego = przeszkoda wpisu, przy nieusunięciu — odmowa wpisu" — ale kod
  realizuje to WYŁĄCZNIE dla `niemozliwe`, nie dla `brak`, czyli dla stanu „jeszcze nie
  zweryfikowano" nie ma żadnej przeszkody).
- **Waga:** KRYTYCZNY. Zrzut `testy-audyt/zrzuty/faza4/02-spolka7-kokpit.png` potwierdza akcje
  „Nabywca Bogdan" widoczne w rejestrze mimo statusu AML nieukończonego w chwili wpisu.

## Z-201 [POWAŻNY] — pozycja checklisty „aml" przy typie zdarzenia `objecie`/`przeniesienie`
(„Wobec KAŻDEGO obejmującego zastosowano środki bezpieczeństwa finansowego (AML)", `wymagana:
true`) jest wyłącznie danymi opisowymi do wyświetlenia w UI — nic po stronie serwera nie sprawdza,
czy pozycja została odhaczona

- **Co zrobiłem:** przejrzałem `server/logika/typy-zdarzen.js` (katalog `checklista` per typ
  zdarzenia) oraz `grep -rn "checklista" server/trasy/*.js server/rejestr.js
  server/logika/walidacje.js`.
- **Co się stało:** poza jednym miejscem w komentarzu (`walidacje.js:234-235`, wyjaśniającym
  świadomie, że to TYLKO komentarz, nie kod) słowo „checklista" nie pojawia się NIGDZIE w kodzie
  odpowiedzialnym za zapis zdarzenia — endpointy `POST .../zdarzenia` i `POST .../wpisz` nie
  przyjmują ani nie sprawdzają żadnego pola typu „odhaczone pozycje checklisty". Katalog
  `checklista` służy wyłącznie do wyrenderowania listy w kreatorze UI; potwierdza to test
  Z-200 — wpis przeszedł mimo że pozycja „aml" (oznaczona jako `wymagana: true`, czyli w intencji
  autorów obowiązkowa) nigdy nie mogła zostać uczciwie odhaczona.
- **Co powinno się stać:** albo serwer powinien wymagać przesłania odhaczonych pozycji
  obowiązkowej checklisty przy zapisie zdarzenia (i sam z nich wyprowadzać blokady typu Z-200,
  zamiast polegać wyłącznie na osobnym polu `aml_status`), albo — jeśli intencja jest taka, że
  checklista to tylko przypomnienie dla pracownika, a rzeczywistą blokadą ma być pole
  `aml_status` — dokumentacja/etykieta pozycji nie powinna sugerować, że jest ona sama w sobie
  wymuszana.
- **Podstawa:** zasada techniczna (checklisty deklarowane jako `wymagana: true` powinny być
  wymuszalne, inaczej wprowadzają w błąd co do realnego poziomu ochrony).
- **Waga:** POWAŻNY — bezpośrednia przyczyna źródłowa Z-200 od strony UX/projektu (checklista daje
  złudne poczucie bramki, która w kodzie nie istnieje).

## Z-202 [POWAŻNY] — termin przeglądu okresowego AML (`aml_data_przegladu`,
`TERMIN_PRZEGLADU_AML_MIESIECY = 12`) jest wyliczany WYŁĄCZNIE do wyświetlenia w kartotece
(`wymaga_przegladu_aml`) i nigdy nie wpływa na to, czy nowa transakcja z udziałem tej osoby zostanie
dopuszczona — status raz ustawiony na `wykonane` nie „wygasa" funkcjonalnie

- **Co zrobiłem:** przejrzałem `server/logika/aml.js` (`wymagaPrzegladu`) oraz każde miejsce jego
  wywołania (`grep -rn "wymagaPrzegladu"`).
- **Co się stało:** jedyne wywołanie jest w `server/trasy/osoby.js:170`
  (`wymaga_przegladu_aml: aml.wymagaPrzegladu(osoba, czas.dzisIso())`), z komentarzem w kodzie
  wprost przyznającym: „Sygnal, NIE blokada (blok C1)". `server/logika/walidacje.js` (`sprawdzAml`)
  nigdy nie importuje ani nie odwołuje się do `logika/aml.js` — sprawdza wyłącznie surowe pole
  `aml_status`, bez względu na to, jak dawno temu zostało ustawione. Osoba zweryfikowana raz, np.
  w 2020 r., jest dla bramki transakcyjnej dziś identyczna jak osoba zweryfikowana wczoraj.
- **Co powinno się stać:** `sprawdzAml` powinno traktować `wykonane`, ale przeterminowane
  (`wymagaPrzegladu(...) === true`) tak samo jak `brak` (co najmniej ostrzeżenie, a jeśli Łukasz
  potwierdzi odpowiedź na Z-200 — także blokadę), zamiast wyłącznie jako kosmetyczną plakietkę w
  kartotece.
- **Podstawa:** WYTYCZNE-MERYTORYCZNE-PSA.md § 7: „Profil AML jest trwały przy osobie (...), o ile
  dane nie zdezaktualizowały się" — wyraźnie zakłada, że dezaktualizacja MA znaczenie funkcjonalne,
  a nie tylko wizualne.
- **Waga:** POWAŻNY.

## Z-203 [DROBNY/do potwierdzenia wagi] — bramka AML (`sprawdzAml`) nie rozróżnia osoby fizycznej
i prawnej; dla nabywcy będącego osobą prawną NIGDY nie sprawdza, czy wskazano i zweryfikowano
beneficjenta rzeczywistego

- **Co zrobiłem:** przejrzałem `server/logika/walidacje.js` (`sprawdzAml`) oraz
  `server/trasy/osoby.js` (`sprawdzBeneficjenta`, pole `beneficjent_rzeczywisty_id`).
- **Co się stało:** `sprawdzAml` sprawdza wyłącznie `osoba.aml_status` nabywcy — identycznie dla
  `typ: 'fizyczna'` i `typ: 'prawna'`. Pole `beneficjent_rzeczywisty_id` istnieje w kartotece,
  ale: (1) jest całkowicie OPCJONALNE — nic nie wymusza jego wypełnienia dla podmiotu typu
  `prawna`; (2) nawet gdy wypełnione, `sprawdzAml` NIGDY nie odczytuje ani nie sprawdza statusu AML
  wskazanego beneficjenta. Spółka (osoba prawna) może więc mieć `aml_status: 'wykonane'` ustawiony
  na SIEBIE, bez jakiegokolwiek wpisanego beneficjenta rzeczywistego, i przejść bramkę identycznie
  jak osoba fizyczna.
- **Co powinno się stać:** do ustalenia z Łukaszem (patrz pytanie w
  `testy-audyt/PYTANIA-DO-LUKASZA.md`) — czy ustawa AML wymaga identyfikacji beneficjenta
  rzeczywistego JAKO WARUNKU dopuszczenia wpisu dla nabywcy-osoby prawnej, czy to wyłącznie
  element treści oświadczenia (dokument `oswiadczenie_aml` już dziś o to pyta — patrz Z-209).
- **Podstawa:** WYTYCZNE-MERYTORYCZNE-PSA.md § 7 wspomina „beneficjenta rzeczywistego" jako
  element zawężonej definicji klienta, ale nie rozstrzyga wprost, czy to osobny warunek bramki.
- **Waga:** DROBNY/POWAŻNY (do potwierdzenia) — nie zgaduję oceny prawnej.

## Z-204 [POWAŻNY] — `POST /api/psa/spolki/:id/otworz-rejestr` (otwarcie rejestru „z marszu", poza
workflow sprawy) w ogóle NIE zwraca ostrzeżeń walidacji w odpowiedzi — ostrzeżenie AML przy emisji
założycielskiej ginie po cichu, niewidoczne nawet dla pracownika, który je wywołał wprost

- **Co zrobiłem:** wykonałem `POST /api/psa/spolki/7/otworz-rejestr` z emisją i objęciem akcji
  przez osobę o `aml_status: "brak"`, po czym porównałem strukturę odpowiedzi z odpowiedzią
  `POST .../zdarzenia` (Z-200) i `POST /api/psa/sprawy/:id/wpisz`.
- **Co się stało:** odpowiedź `otworz-rejestr` (`server/trasy/spolki.js`, ok. linii 670–680) zwraca
  wyłącznie `{ zdarzenia: [...] }` (id/typ/data/hash każdego zdarzenia) — bez pola `ostrzezenia`
  w ogóle, mimo że pod spodem `_wykonajWpis` te same ostrzeżenia generuje (są po prostu
  odrzucane przy budowaniu odpowiedzi). Dla porównania, `POST .../zdarzenia` i `POST .../wpisz`
  zwracają `ostrzezenia` wprost w JSON-ie. Ponieważ ta ścieżka jest — zgodnie z Z-005 z FAZA 1 —
  JEDYNĄ wyeksponowaną ścieżką otwarcia rejestru dla spółek onboardowanych z portalu klienta
  (deklarowany główny model biznesowy), to właśnie przy zdarzeniach założycielskich (pierwsze
  objęcie akcji przez każdego akcjonariusza — dokładnie ten moment, w którym AML MA sens) ostrzeżenie
  o brakującym AML jest NIEWIDOCZNE dla pracownika kancelarii nawet w treści odpowiedzi API, nie
  tylko w UI.
- **Co powinno się stać:** odpowiedź `otworz-rejestr` powinna zwracać zbiorczą listę `ostrzezenia`
  ze wszystkich zdarzeń partii, analogicznie do pozostałych dwóch endpointów zapisu.
- **Podstawa:** spójność API — ten sam typ operacji (zapis zdarzenia) nie powinien milczeć na jednej
  z trzech dróg, którymi można go wywołać.
- **Waga:** POWAŻNY — pogłębia Z-200 dla akurat tej ścieżki (główny model biznesowy wg Z-005).

## Z-205 [KRYTYCZNY] — TREŚĆ już „potwierdzonego przez kancelarię" podpisanego skanu można
podmienić po stronie klienta BEZ resetowania znacznika potwierdzenia — potwierdzenie
(`podpis_potwierdzono`/`podpis_potwierdzil`) zostaje przy NOWYM, nigdy nieobejrzanym pliku, i w tej
postaci trafia jako egzemplarz wiążący do akt spółki

- **Co zrobiłem:** pełna ścieżka wniosku #8 (portal, konto `faza4.klient@example-test.pl` →
  kancelaria `audyt@kancelaria.test`): wypełniłem wniosek, dodałem akcjonariusza-reprezentanta,
  wgrałem dowód tożsamości, kancelaria wystawiła i udostępniła komplet 5 dokumentów (status
  wniosku: `umowa_wygenerowana`). Dla dokumentu „Umowa o prowadzenie rejestru" (id 10): (1) klient
  wgrał plik A (`POST /api/psa/portal/wniosek/dokumenty/10/podpis`, plik 81 B, sygnatura
  `%PDF-1.4 ... test-file-A`); (2) kancelaria PRZED formalnym odesłaniem kompletu przez klienta
  (wniosek WCIĄŻ w statusie `umowa_wygenerowana`, nie `umowa_podpisana`) potwierdziła podpis
  (`POST /api/psa/wnioski/8/dokumenty/10/podpis-potwierdz`, `{"potwierdzono":true}`) —
  możliwe, bo `wczytajOtwartyWniosek` używane przez ten endpoint blokuje tylko statusy zamknięte
  (`przyjety`/`odrzucony`), nie wymaga konkretnego etapu obiegu; (3) klient, WCIĄŻ w tym samym
  statusie `umowa_wygenerowana` (upload klienta jest dopuszczony właśnie i wyłącznie w tym
  statusie — `STATUSY_PRZYJMUJACE_PODPISY`), wgrał INNY plik B na TEN SAM dokument (97 B, sygnatura
  `%PDF-1.4 ... test-file-B-SWAPPED-CONTENT`).
- **Co się stało:** `zapiszPodpisanySkan` (`server/trasy/portal.js`) nadpisuje `podpis_sciezka`/
  `podpis_nazwa_pliku`/`podpis_rozmiar`/`podpis_wgrano`, ale NIE dotyka kolumn
  `podpis_potwierdzono`/`podpis_potwierdzil`. Po podmianie dokument #10 pokazywał: nazwę pliku
  `umowa-podpisana-B-SWAPPED.pdf` (nowy plik), ale `podpis_potwierdzono` wciąż ze STAREGO
  znacznika czasu (potwierdzenia pliku A) i `podpis_potwierdzil: "Administrator"` — czyli
  wyglądało, jakby kancelaria zatwierdziła plik, którego nigdy nie widziała. Kontynuowałem
  ścieżkę do końca: uzupełniłem podpisy pozostałych 4 dokumentów, zweryfikowałem akcjonariusza,
  wywołałem `POST /api/psa/wnioski/8/przyjmij` — wniosek PRZYJĘTY (`status: "przyjety"`, spółka
  #12 założona), a `psa_wnioski.umowa_podpisana_sciezka` (pole opisane w kodzie jako to, które
  „prowadzi cały przebieg umowa_wygenerowana → umowa_podpisana") oraz kopia z rolą `podpisany`
  trwale skopiowana do akt spółki (`przeniesDokumentyDoSpolki`, `server/trasy/wnioski.js`) to
  DOKŁADNIE plik B — ten, którego treści kancelaria nigdy nie potwierdziła. Stan po restarcie
  serwera w trakcie sesji audytu — sprawdzony ponownie i NIEZMIENIONY: `GET
  /api/psa/wnioski/8` nadal zwracał `podpis_nazwa_pliku: "umowa-podpisana-B-SWAPPED.pdf"` razem
  ze starym `podpis_potwierdzono`/`podpis_potwierdzil`. Potwierdzone też WIZUALNIE w UI kancelarii
  (zrzut `testy-audyt/zrzuty/faza4/04-wniosek8-dokumenty-swap.png`): wiersz „Umowa o prowadzenie
  rejestru" pokazuje zieloną plakietkę „podpis potwierdzony" obok linku do pliku
  `umowa-podpisana-B-SWAPPED.pdf`, bez żadnego ostrzeżenia. Dodatkowo: w przeciwieństwie do
  `psa_osoby_skany_aml` (które przy każdym uploadzie liczy i zapisuje `sha256`), tabela
  `psa_wnioski_dokumenty` NIE ma kolumny hash dla `podpis_sciezka` — nawet ręczny audyt po fakcie
  nie ma jak wykryć podmiany treści, bo nie istnieje żaden zapisany „odcisk" potwierdzonej wersji.
- **Co powinno się stać:** każdy ponowny upload podpisanego skanu dla dokumentu, który ma już
  ustawione `podpis_potwierdzono`, powinien BEZWARUNKOWO czyścić `podpis_potwierdzono`/
  `podpis_potwierdzil` (tak jak `zapiszTresc` bezwarunkowo odmawia zmiany treści dokumentu już
  podpisanego — patrz Z-206, ten sam plik ma już jeden dobry precedens takiej ochrony). Dodatkowo:
  `psa_wnioski_dokumenty` powinno przechowywać hash (sha256) potwierdzonego pliku, żeby podmianę
  dało się wykryć niezależnie od tego, kiedy dokładnie nastąpiła.
- **Podstawa:** zasada techniczna — integralność „egzemplarza autorytatywnego" (pytanie wprost
  z checklisty FAZA 4: „Który plik system traktuje jako wiążący po zakończeniu obiegu? Czy jest
  oznaczony i niemodyfikowalny?" — odpowiedź brzmi: jest oznaczony jako wiążący
  [`umowa_podpisana_sciezka`, rola `podpisany` w aktach spółki], ale NIE jest niemodyfikowalny po
  potwierdzeniu, dopóki formalne odesłanie kompletu klienta nie zamknie okna).
- **Waga:** KRYTYCZNY. Warunkiem wystąpienia jest potwierdzenie podpisu przez kancelarię PRZED
  formalnym `POST /wniosek/odeslij` klienta (w normalnym biegu UI kancelaria zwykle widzi wniosek
  w kolejce dopiero po odesłaniu kompletu — status `umowa_podpisana`) — ale nic w kodzie serwera
  tego nie wymusza ani nie sygnalizuje, więc jedna przedwczesna akcja pracownika (albo pomyłka,
  albo świadome podejrzenie klienta chcącego „przetestować" reakcję) wystarczy do trwałego
  podważenia dowodu, na podstawie którego działa cały rejestr założycielski spółki.

## Z-206 [POZYTYWNE] — poza oknem opisanym w Z-205, integralność podpisanych dokumentów jest
chroniona dobrze: treści dokumentu nie da się zmienić po podpisaniu, a klient nie może podmienić
skanu PO formalnym odesłaniu kompletu

- **Co zrobiłem:** (1) `pakietWniosku.zapiszTresc` — sprawdziłem kod: rzuca błąd „Dokument został
  już podpisany — jego treści nie można zmieniać" natychmiast, gdy `wiersz.podpis_sciezka` jest
  ustawione, więc pracownik nie może po cichu zmienić WZORU dokumentu, do którego klient już
  odesłał podpis. (2) Po `POST /wniosek/odeslij` (status `umowa_podpisana`) próba ponownego
  uploadu na ten sam dokument przez klienta jest zablokowana przez `zaladujWlasnyWniosekDoUploadu`
  (`STATUSY_PRZYJMUJACE_PODPISY = new Set(['umowa_wygenerowana'])` — `umowa_podpisana` nie
  jest na liście), więc w NORMALNYM biegu (kancelaria potwierdza dopiero PO odesłaniu kompletu,
  co jest sposobem, w jaki wniosek trafia do jej kolejki) okno z Z-205 się nie otwiera.
- **Co się stało:** oba mechanizmy działają zgodnie z opisem w kodzie; potwierdzone czytaniem
  kodu (nie osobnym żądaniem — logika jednoznaczna, powtórzenie testu Z-205 już to pośrednio
  potwierdziło dla drugiego mechanizmu, bo podmiana zadziałała TYLKO w oknie sprzed `odeslij`).
- **Co powinno się stać:** nic — to poprawne zabezpieczenia, warte odnotowania jako punkt
  odniesienia dla naprawy Z-205 (ten sam wzorzec „podpisano → nie wolno ruszać" powinien objąć też
  znacznik potwierdzenia, nie tylko treść dokumentu).
- **Podstawa:** zasada techniczna.
- **Waga:** POZYTYWNE.

## Z-207 [POZYTYWNE] — forma umowy: aplikacja nigdzie nie żąda podpisu kwalifikowanego ani nie
sugeruje w treści dokumentów, że jest on wymagany; skan podpisu własnoręcznego jest wprost
przedstawiony jako równoważny, z poprawną podstawą prawną

- **Co zrobiłem:** przejrzałem instrukcję podpisu w kreatorze wniosku klienta
  (`publiczne/js/wniosek.js`, ok. linii 1258–1275) oraz komentarz historyczny w
  `server/logika/przepisy.js` (linie 22–26).
- **Co się stało:** instrukcja dla klienta wprost dopuszcza trzy równoważne metody — podpis
  własnoręczny + skan/zdjęcie, kwalifikowany podpis elektroniczny („równoważny podpisowi
  własnoręcznemu, art. 78¹ § 2 Kodeksu cywilnego") oraz podpis zaufany/osobisty — bez sugestii, że
  którakolwiek jest „lepsza" czy wymagana. Komentarz w `przepisy.js` dokumentuje ŚWIADOME usunięcie
  w sprincie 5 wcześniejszego katalogu `FORMY_ZGODY` (poświadczony notarialnie/kwalifikowany/
  zaufany/osobisty) jako niemającego podstawy w art. 300³⁴ § 3 KSH — pozostałość po myleniu
  przepisów P.S.A. z przepisami spółki akcyjnej (PRZEPISY-PSA.md § 12).
- **Co powinno się stać:** nic — zgodne z WYTYCZNE-MERYTORYCZNE-PSA.md § 3 (pojęcie dokumentu wg
  art. 77³ k.c. — skan wystarcza).
- **Podstawa:** WYTYCZNE-MERYTORYCZNE-PSA.md § 3; art. 78¹ § 2 k.c. cytowany poprawnie w UI.
- **Waga:** POZYTYWNE.

## Z-208 [do odnotowania — opis stanu, nie usterka sama w sobie] — aplikacja NIE weryfikuje
kryptograficznie obecności ani ważności podpisu kwalifikowanego w odesłanym pliku; kontrola treści
ogranicza się do sygnatury bajtowej formatu (PDF/JPG/PNG) — każdy plik przechodzący tę kontrolę
sygnatury jest przyjmowany identycznie, niezależnie od zadeklarowanej metody podpisania

- **Co zrobiłem:** przejrzałem `przyjmijSkan`/`pliki.trescPasuje`
  (`server/pomocnicze/pliki.js`, `server/trasy/portal.js` ok. linii 836–856) — jedyna kontrola
  treści porównuje pierwsze 8 bajtów pliku ze znanymi sygnaturami formatu; potwierdzone też przez
  to, że pliki testowe A/B w Z-205 (81 i 97 bajtów, żadną miarą nie „prawdziwe" podpisane umowy)
  zostały przyjęte bez zastrzeżeń, bo miały poprawny nagłówek `%PDF`.
- **Co się stało:** formularz klienta (Z-207) nie ma nawet pola do zadeklarowania, JAKĄ metodą
  podpisano dany plik — wszystkie trzy dopuszczone metody (własnoręczny+skan, kwalifikowany,
  zaufany/osobisty) trafiają tą samą drogą uploadu, bez różnicowania. Jeśli klient zadeklaruje
  ustnie/mailowo podpis kwalifikowany, a w rzeczywistości wgra zwykły, niepodpisany PDF, system
  tego nie wykryje — wykrycie zależy wyłącznie od tego, czy pracownik kancelarii OTWORZY plik
  (przycisk „Sprawdź podpis" w UI, widoczny na zrzucie 04) i oceni go wzrokowo/w czytniku PDF.
- **Co powinno się stać:** nie zgaduję — real-world weryfikacja podpisu kwalifikowanego (PAdES) to
  osobny, kosztowny temat techniczny; odnotowuję wyłącznie FAKTYCZNY stan na żądanie checklisty
  FAZA 4 („Czy aplikacja weryfikuje podpis kwalifikowany w odesłanym pliku, czy przyjmuje każdy
  PDF" — odpowiedź: przyjmuje każdy plik o poprawnej sygnaturze formatu, bez wglądu w treść).
- **Podstawa:** obserwacja kodu i testu, bez oceny prawnej.
- **Waga:** do odnotowania (nie klasyfikuję jako błąd — brak wymogu prawnego weryfikacji
  kryptograficznej, patrz Z-207; ale to zawęża realnie to, co „potwierdzenie podpisu" przez
  pracownika w ogóle może stwierdzić — widzi treść, nie podpis).

## Z-209 [POZYTYWNE, z zastrzeżeniem opisanym w P-poniżej] — ścieżka „przyjęcie skanu umowy" jest
w kodzie i uprawnieniach wyraźnie ODDZIELONA od ścieżki „ustalenie statusu AML"; klient portalowy
nie ma i nie może mieć wpływu na `aml_status` własnej ani cudzej kartoteki

- **Co zrobiłem:** sprawdziłem montowanie tras w `serwer.js` — `/api/psa/osoby` (jedyne miejsce,
  gdzie zapisuje się `aml_status`, oraz endpointy `aml-skany`) jest zamontowane WYŁĄCZNIE za
  `autoryzacja.wymagajPracownika` (linia 97); `/api/psa/portal/*` (klient) nie ma do niego dostępu
  pod żadną trasą. `grep -rn "aml_status" server/trasy/portal.js server/trasy/wnioski.js` nie
  zwraca żadnego wyniku — moduł wniosku w ogóle nie dotyka tego pola.
- **Co się stało:** ustawienie `aml_status` jest wyłącznie ręczną decyzją pracownika kancelarii
  (`PUT /api/psa/osoby/:id`, wolne pole tekstowe `aml_notatka`); nie jest w żaden sposób
  automatycznie wywoływane przez sam fakt odesłania/potwierdzenia podpisanej umowy — potwierdzenie
  Z-016 (FAZA 1) i Z-206 tej fazy dotyczy WYŁĄCZNIE skuteczności umowy, nigdy tożsamości na
  potrzeby AML. Upload skanu dokumentu tożsamości „na potrzeby AML" (`/api/psa/osoby/:id/aml-skany`)
  jest osobnym, opcjonalnym mechanizmem — aktywnym wyłącznie, gdy pracownik zaznaczy przełącznik
  „Stosuje procedurę AML dla tej spółki" per spółka (domyślnie WYŁĄCZONY,
  `stosuje_procedure_aml = 0` — widoczny odznaczony na zrzucie
  `testy-audyt/zrzuty/faza4/02-spolka7-kokpit.png`, z opisem w UI: „Wyłączona (domyślnie): kartoteka
  zbiera wyłącznie dane z dokumentu tożsamości (status, data weryfikacji, notatka) — bez pliku.").
  Nawet gdy WŁĄCZONY i gdy pracownik faktycznie wgra skan, upload NIGDY automatycznie nie zmienia
  `aml_status` — to zawsze osobna, świadoma decyzja pracownika.
- **Co powinno się stać:** nic — to poprawna architektura (rozdzielenie ścieżek, zgodnie
  z checklistą FAZA 4). Odnotowuję jako POZYTYWNE, z zastrzeżeniem że sama SKUTECZNOŚĆ tego
  rozdzielenia zależy od jakości bramki opisanej w Z-200 — dobre rozdzielenie dwóch ścieżek nie
  pomaga, jeśli jedna z nich (AML) i tak nie blokuje niczego w praktyce.
- **Podstawa:** PRZEPISY-PSA.md § 8 (art. 108b — do prowadzenia rejestru nie stosuje się art. 81–83
  i 85 Prawa o notariacie, czyli identyfikacja idzie wyłącznie reżimem AML, nie notarialnym — ⚠️ do
  potwierdzenia) — kod jest z tym zgodny w sensie ARCHITEKTURY (dwie osobne ścieżki), niezależnie
  od pytania, czy sama ścieżka AML jest wystarczająco silna (Z-200).
- **Waga:** POZYTYWNE (architektura rozdzielenia), z odesłaniem do Z-200 dla oceny skuteczności.

## Z-210 [opis stanu — do przekazania Łukaszowi jako pytanie, nie znalezisko usterki] — na czym
faktycznie opiera się identyfikacja akcjonariusza w obecnym prototypie

- **Co zrobiłem:** zebrałem w jednym miejscu wszystkie źródła danych, na których może się opierać
  „identyfikacja" akcjonariusza w obecnym stanie aplikacji, śledząc cały przepływ danych od
  formularza wniosku do wpisu w rejestrze.
- **Co się stało — opis FAKTYCZNEGO stanu, bez oceny wystarczalności:**
  1. **Dane opisowe** (imię, nazwisko, PESEL, adres, dla podmiotu — numer w rejestrze) — wpisywane
     w formularzu wniosku PRZEZ SPÓŁKĘ/WNIOSKODAWCĘ (portal), niezależnie zweryfikowane przez
     pracownika kancelarii wyłącznie o tyle, że musi ręcznie „zweryfikować pozycję" przed
     przyjęciem wniosku (`POST /:id/akcjonariusze/:akcId/zweryfikuj`) — ale weryfikacja ta
     sprawdza SPÓJNOŚĆ z odpisem KRS i z resztą kartoteki (unikanie duplikatów — regula domenowa
     nr 10), NIE tożsamość osoby fizycznej.
  2. **Skan dokumentu tożsamości REPREZENTANTA** (`psa_wnioski.dowod_sciezka`,
     `POST /api/psa/portal/wniosek/dowod`) — zbierany bezwarunkowo dla KAŻDEGO wniosku, ale
     WYŁĄCZNIE dla osoby podpisującej umowę w imieniu wnioskodawcy (reprezentanta), nie dla
     pozostałych akcjonariuszy. Komentarz w kodzie (`server/trasy/portal.js`, linie 965–972)
     wprost przyznaje ograniczenie: „Sam obraz dokumentu nie dowodzi tożsamości (można go mieć nie
     będąc właścicielem), ale jest śladem, na czym oparto identyfikację". Ten skan NIGDY nie jest
     automatycznie powiązany z żadnym polem `aml_status` w kartotece osób (potwierdzone —
     `grep` nie znajduje żadnego połączenia).
  3. **Skan dokumentu AML per osoba** (`psa_osoby_skany_aml`, `POST
     /api/psa/osoby/:id/aml-skany`) — opcjonalny, wyłączony domyślnie (Z-209), wgrywany WYŁĄCZNIE
     przez pracownika kancelarii (nie przez portal klienta), typ dokumentu (`dowod_osobisty` /
     `paszport` / `inny`) deklarowany swobodnie, treść pliku nie jest w żaden sposób
     zweryfikowana (brak OCR/porównania danych z formularzem) — to czysty ślad na dysku plus hash
     sha256 (dla integralności PO wgraniu, nie dla weryfikacji tożsamości).
  4. **Oświadczenie własne** (`oswiadczenie_aml`, `server/logika/dokumenty-wniosku.js`) —
     dokument podpisywany PRZEZ SAMEGO akcjonariusza, w którym deklaruje on beneficjenta
     rzeczywistego i status PEP „pod rygorem odpowiedzialności karnej za złożenie fałszywego
     oświadczenia" — czyli samoidentyfikacja, nie weryfikacja niezależna.
  5. **Ostateczna decyzja `aml_status = wykonane`** — wyłącznie ręczny osąd pracownika kancelarii
     (`PUT /api/psa/osoby/:id`), oparty na dowolnej kombinacji powyższego, bez wymogu podania
     podstawy poza wolnym polem tekstowym `aml_notatka` (nieobowiązkowym).

  **Podsumowanie faktycznego stanu:** identyfikacja akcjonariusza opiera się na (a) danych
  wpisanych przez spółkę/wnioskodawcę, (b) OPCJONALNYM i domyślnie wyłączonym skanie dokumentu
  tożsamości wgrywanym przez pracownika kancelarii (nie przez samego akcjonariusza), (c)
  samoidentyfikacji akcjonariusza w podpisanym oświadczeniu, oraz (d) swobodnym osądzie
  pracownika bez wymogu uzasadnienia. Nie ma żadnej metody dającej wyższy poziom pewności
  (weryfikacja wideo, przelew referencyjny, stawiennictwo, podpis kwalifikowany akcjonariusza
  jako WARUNEK, nie tylko dopuszczalna opcja formy umowy).
- **Co powinno się stać:** patrz PYTANIE DO ŁUKASZA w `testy-audyt/PYTANIA-DO-LUKASZA.md` — to
  pytanie o wystarczalność, nie o błąd kodu.
- **Podstawa:** WYTYCZNE-MERYTORYCZNE-PSA.md § 7 (⚠️ zakres i częstotliwość środków bezpieczeństwa
  finansowego do potwierdzenia przy tekście ustawy AML).
- **Waga:** opis stanu (nie klasyfikuję jako usterkę — to pytanie do rozstrzygnięcia przez
  Łukasza, nie luka kodu).

---

# FAZA 6 — integralność rejestru (Z-300 do Z-308)

> Zakres zarezerwowany: Z-300–Z-329. Metoda: bezpośrednie żądania API (spółka testowa własna,
> id=8, „Audyt Faza6 Integralnosc…", utworzona przez `POST /api/psa/spolki`) + bezpośrednie SQL
> przez `better-sqlite3` (żywa baza — WYŁĄCZNIE próby UPDATE/DELETE, które **powinny** i faktycznie
> **zostały** odrzucone, więc nie zmieniły stanu; brak modyfikacji treści na żywej bazie) + kopie
> pliku `dane/audyt-test.db` w `/tmp` (checkpoint WAL → `cp` → osobne połączenie
> `better-sqlite3` → manipulacja → weryfikacja funkcją `server/logika/lancuch.js` bezpośrednio,
> bez serwera HTTP → sprzątnięcie plików kopii po zakończeniu, potwierdzone).

## Z-300 [POZYTYWNE] — wyzwalacze append-only blokują UPDATE/DELETE także przy pominięciu aplikacji
(surowe połączenie `better-sqlite3` do żywej bazy)

- **Co zrobiłem:** otworzyłem `./dane/audyt-test.db` bezpośrednio przez `better-sqlite3` (osobny
  proces Node, całkowicie z pominięciem serwera/API) i spróbowałem `UPDATE psa_zdarzenia SET
  autor = ? WHERE id = ?` oraz `DELETE FROM psa_zdarzenia WHERE id = ?` na pierwszym zdarzeniu w
  łańcuchu (id=1, hash zapisany).
- **Co się stało:** obie próby rzuciły wyjątek `SqliteError` z treścią wyzwalacza: „psa_zdarzenia
  jest append-only — pomyłkę prostuje się zdarzeniem «sprostowanie»" (UPDATE) i „psa_zdarzenia jest
  append-only — rekordów zdarzeń nie usuwa się" (DELETE). Liczba zdarzeń w tabeli i treść
  zaatakowanego rekordu (hash, autor) były identyczne przed i po próbie — zero efektu ubocznego na
  żywej, współdzielonej bazie.
- **Co powinno się stać:** dokładnie to — reguła domenowa 1 (`CLAUDE-PSA.md`: „psa_zdarzenia jest
  append-only. Żadnego UPDATE, żadnego DELETE") ma być egzekwowana na poziomie bazy, nie tylko przez
  kod aplikacji, tak żeby błąd w aplikacji albo złośliwy dostęp z pominięciem API (np. skrypt
  administracyjny, bezpośredni dostęp do pliku) nie mógł naruszyć integralności rejestru.
- **Podstawa:** `CLAUDE-PSA.md` reguła domenowa 1 („Żadnego UPDATE, żadnego DELETE"); potwierdzone
  wcześniej w FAZA 0 wyłącznie przez odczyt definicji wyzwalaczy (`testy-audyt/FAZA-0-INWENTARYZACJA.md`
  sekcja 5) — tu potwierdzone PRAKTYCZNIE, próbą ataku.
- **Waga:** POZYTYWNE — najważniejsza pozycja checklisty FAZA 6 działa dokładnie tak, jak powinna.
  Dodatkowo sprawdziłem grepem `server/`: żaden fragment kodu aplikacji nigdy nie próbuje
  `UPDATE`/`DELETE FROM psa_zdarzenia` — wyzwalacz jest więc czystym zabezpieczeniem
  defense-in-depth, nie protezą na brakującą kontrolę w warstwie aplikacji.

## Z-301 [POZYTYWNE — Z ZASTRZEŻENIEM] — dodatkowa warstwa ochrony: `FOREIGN KEY` blokuje DELETE
zdarzenia, do którego odwołuje się materializacja — ale tylko dla zdarzeń faktycznie referencjonowanych

- **Co zrobiłem:** na KOPII bazy (`/tmp`, po `PRAGMA wal_checkpoint(TRUNCATE)` na żywej bazie i
  `cp`) spróbowałem usunąć zdarzenie ze środka łańcucha (typ „emisja", posiadające wiersz
  `psa_emisje.zdarzenie_id` wskazujący na nie) po uprzednim `DROP TRIGGER psa_zdarzenia_bez_delete`
  (symulacja atakującego z pełnym dostępem do pliku bazy, zdolnego usunąć definicję wyzwalacza).
- **Co się stało:** `DELETE` rzucił `SQLITE_CONSTRAINT_FOREIGNKEY` — operacja odrzucona, mimo że
  wyzwalacz append-only był już usunięty. Sprawdziłem `server/baza.js:30`:
  `db.pragma('foreign_keys = ON')` jest ustawiane jawnie dla każdego połączenia aplikacji (nie jest
  to domyślne zachowanie SQLite/better-sqlite3). Po ręcznym `PRAGMA foreign_keys = OFF` (symulacja
  ataku narzędziem, które domyślnie NIE wymusza kluczy obcych, np. `sqlite3` CLI bez jawnego
  `PRAGMA foreign_keys=ON`) usunięcie tego samego rekordu powiodło się.
- **Co powinno się stać:** to jest pozytywne, dodatkowe zabezpieczenie (klucz obcy
  `psa_emisje.zdarzenie_id → psa_zdarzenia.id` i analogiczne w innych tabelach materializacji) —
  ale działa **wyłącznie** dla zdarzeń, na które coś się realnie odwołuje (typowo `emisja`,
  `obciazenie`, `uprawnienie`, `ograniczenie`). Zdarzenie typu np. `przeniesienie` albo
  `zmiana_danych_akcjonariusza`, do którego żadna tabela materializacji nie trzyma FK wprost po
  jego ID (materializacja `psa_stan_akcji.zdarzenie_od_id`/`zdarzenie_do_id` — do sprawdzenia, czy
  ma FK), może nie mieć tej dodatkowej ochrony — nie jest to jednolita druga warstwa dla WSZYSTKICH
  zdarzeń, tylko przypadkowy efekt uboczny istniejących kluczy obcych zaprojektowanych z innego
  powodu (spójność referencyjna materializacji, nie ochrona łańcucha).
- **Podstawa:** zasada techniczna (defense in depth) — nie jest to wymóg z `CLAUDE-PSA.md` wprost,
  ale wzmacnia regułę domenową 1.
- **Waga:** POZYTYWNE, z zastrzeżeniem: nie polegać na tym mechanizmie jako na GŁÓWNEJ ochronie —
  główną i jedyną CELOWO zaprojektowaną ochroną pozostaje wyzwalacz append-only (Z-300) i łańcuch
  skrótów (Z-302), które obejmują KAŻDE zdarzenie bez wyjątku.

## Z-302 [POZYTYWNE] — weryfikacja integralności realnie przelicza cały łańcuch i wykrywa każdy
z trzech przetestowanych typów manipulacji (naiwna zmiana treści, „wyrafinowana" zmiana treści +
przeliczony własny hash, usunięcie rekordu ze środka)

- **Co zrobiłem:** na TRZECH niezależnych kopiach bazy (`/tmp`, checkpoint WAL + `cp` z żywej bazy
  przed każdą manipulacją, osobne połączenia `better-sqlite3`, sprzątnięte po teście) wykonałem po
  kolei:
  1. **Baseline** — `lancuch.zweryfikuj()` na nietkniętej kopii (34 zdarzenia) → `ok:true`.
  2. **Naiwna manipulacja treści** — `DROP TRIGGER psa_zdarzenia_bez_update`, zmiana `dane_json`
     środkowego zdarzenia (podmiana `"2026"` → `"2099"`) BEZ przeliczenia `hash`.
  3. **Manipulacja „wyrafinowana"** — to samo, ale z PRZELICZENIEM `hash` danego rekordu tak, by
     pasował do nowej treści (symulacja atakującego znającego algorytm `sha256(id|spolka_id|typ|
     data_zdarzenia|data_wpisu|autor|dane_json|hash_poprzedni)` i potrafiącego go odtworzyć).
  4. **Usunięcie rekordu ze środka łańcucha** — `PRAGMA foreign_keys=OFF` + `DROP TRIGGER
     psa_zdarzenia_bez_delete` + `DELETE` środkowego zdarzenia (bez emisji, żeby uniknąć FK
     z Z-301 i przetestować czystą lukę usunięcia).
  Każdorazowo wywołałem `lancuch.zweryfikuj()` (dokładnie tę samą funkcję, której używa
  `GET /api/psa/integralnosc` — `server/rejestr.js:667-669`) na pełnej, świeżo odczytanej liście
  zdarzeń z manipulowanej kopii, importując moduł logiki bezpośrednio, bez serwera HTTP.
- **Co się stało:**
  1. Baseline: `{"ok":true,"sprawdzono":34,"blad":null}`.
  2. Naiwna manipulacja: wykryta NATYCHMIAST na zaatakowanym rekordzie —
     `{"ok":false,"sprawdzono":17,"blad":{"id":18,"rodzaj":"zmieniona_tresc", ...}}` — „Treść
     zdarzenia #18 nie odpowiada zapisanemu skrótowi. Rekord został zmieniony poza aplikacją."
  3. Manipulacja wyrafinowana: własny hash rekordu #18 (`6df9ca42...`) PASOWAŁ do nowej treści (test
     `zmieniona_tresc` przeszedłby bez zastrzeżeń dla SAMEGO rekordu #18), ale łańcuch i tak wykrył
     atak — na KOLEJNYM rekordzie (#19): `{"ok":false,"sprawdzono":18,"blad":{"id":19,
     "rodzaj":"zerwane_ogniwo", "oczekiwano":"6df9ca42...", "zapisano":"0070d5c4..."}}` — bo
     `hash_poprzedni` zapisany w #19 (ustalony w chwili ORYGINALNEGO zapisu #18) nie zgadza się z
     NOWYM hashem #18. Żeby ukryć manipulację #18 do końca, atakujący musiałby przeliczyć i
     nadpisać `hash`/`hash_poprzedni` KAŻDEGO kolejnego rekordu aż do końca łańcucha (co jest
     technicznie możliwe przy pełnym dostępie do pliku bazy i znajomości algorytmu — patrz niżej).
  4. Usunięcie rekordu: wykryte identycznie jak w (3) — `zerwane_ogniwo` na rekordzie NASTĘPUJĄCYM
     po usuniętym, bo jego `hash_poprzedni` wskazuje na hash rekordu, którego już nie ma.
- **Co powinno się stać:** dokładnie to. Sprawdziłem też kod źródłowy weryfikacji
  (`server/logika/lancuch.js:zweryfikuj`, `server/rejestr.js:zweryfikujIntegralnosc`) —
  `GET /api/psa/integralnosc` (`server/trasy/pozostale.js:227`) odczytuje WSZYSTKIE zdarzenia
  (`SELECT * FROM psa_zdarzenia ORDER BY id ASC`, bez `LIMIT`) i przelicza każdy hash od zera przy
  KAŻDYM wywołaniu — to NIE jest wartość cache'owana ani bezwarunkowe „ok".
- **Granica ochrony (nie błąd, ale ważne dla oceny ryzyka — zgodnie z `CLAUDE-PSA.md` sekcja 11,
  „świadomie NIE robimy: kwalifikowanych znaczników czasu, drzew Merkle'a, publikacji skrótów"):**
  łańcuch skrótów SAM W SOBIE chroni przed manipulacją POJEDYNCZEGO rekordu bez przeliczenia całej
  reszty łańcucha PO nim. Atakujący z PEŁNYM zapisem do pliku bazy i znajomością algorytmu
  (jawnego, w kodzie open-source tej aplikacji) MÓGŁBY w teorii przeliczyć CAŁY łańcuch od
  zaatakowanego punktu do końca, co dałoby wewnętrznie spójny, ale sfałszowany łańcuch — weryfikacja
  wewnętrzna by tego nie wykryła. To jest znana i udokumentowana granica projektu (brak zewnętrznego
  zakotwiczenia skrótu — świadoma decyzja, nie luka projektowa) — nie testowałem tego scenariusza do
  końca (nie przeliczałem całego ogona łańcucha), bo cel checklisty sesji („zmodyfikuj jedno
  zdarzenie, uruchom weryfikację, czy wykrywa") jest spełniony, a atak wymagający przepisania całego
  ogona łańcucha jest z definicji poza zasięgiem JAKIEGOKOLWIEK schematu opartego wyłącznie o łańcuch
  skrótów bez zewnętrznego świadka (np. publikacji skrótu poza systemem) — dokładnie to, czego
  `CLAUDE-PSA.md` świadomie nie realizuje. Odnotowuję to jako **potwierdzenie zakresu ochrony**, nie
  jako nowe znalezisko: broni przed przypadkową korupcją, błędem operacyjnym, częściowym/nieudolnym
  atakiem i każdą modyfikacją NIEPOCIĄGAJĄCĄ za sobą przeliczenia całego dalszego łańcucha — nie
  broni przed w pełni skutecznym, świadomym przepisaniem całej bazy przez kogoś z nieograniczonym
  dostępem do pliku. To zgodne z tym, co system deklaruje, że robi.
- **Podstawa:** `CLAUDE-PSA.md` reguła domenowa 1 i sekcja 11 („Integralność: tabela zdarzeń
  append-only z łańcuchem skrótów + endpoint weryfikacji", „świadomie NIE robimy... drzew Merkle'a,
  publikacji skrótów"); checklista sesji FAZA 6 („czy weryfikacja faktycznie przelicza łańcuch, czy
  zwraca „OK" bezwarunkowo").
- **Waga:** POZYTYWNE — mechanizm działa dokładnie tak, jak zaprojektowano, wykrywa WSZYSTKIE
  przetestowane realistyczne scenariusze manipulacji (w tym wyrafinowaną, jednorekordową, ze
  świadomie przeliczonym własnym hashem), a jego udokumentowana granica (pełne przepisanie ogona
  łańcucha) jest świadomą, opisaną decyzją projektową, nie przeoczeniem.

## Z-303 [POZYTYWNE] — odbudowa materializacji ze zdarzeń (`POST /:id/przelicz`) daje identyczny
stan jak materializacja bieżąca; architektura czyni rozjazd strukturalnie niemożliwym przez
normalną ścieżkę zapisu

- **Co zrobiłem:** na własnej spółce testowej (id=8) z rzeczywistą historią zdarzeń (emisja →
  objęcie 100 akcji → przeniesienie 100 akcji → sprostowanie wzmianki o pokryciu) porównałem
  zawartość `psa_stan_akcji` (bezpośredni odczyt z żywej bazy, WYŁĄCZNIE `SELECT`, bez zapisu) PRZED
  i PO wywołaniu `POST /api/psa/spolki/8/przelicz`.
- **Co się stało:** odpowiedź: `{"ok":true,"niezgodnosci":[],"komunikat":"Stan odbudowany ze
  zdarzeń. Bilans akcji zgadza się w każdej serii."}`. Wiersze `psa_stan_akcji` przed i po są
  identyczne co do każdego pola merytorycznego (emisja, kategoria, osoba, zakres numerów, ilość,
  ułamek, tytuł nabycia, daty, pokrycie) — różni się wyłącznie techniczny klucz autoinkrementowany
  `id` (oczekiwane: `zmaterializuj()` robi pełny `DELETE` + `INSERT`, więc nowe wiersze dostają nowe
  ID — nie jest to niezgodność, tylko efekt uboczny strategii odtwarzania).
- **Dodatkowa obserwacja architektoniczna (wzmacnia, nie tylko potwierdza wynik testu):** przeczytałem
  `server/rejestr.js` — funkcja `zmaterializuj()` jest wywoływana przez `_wykonajWpis()` PO KAŻDYM
  pojedynczym zapisie zdarzenia (linia 418, wewnątrz tej samej transakcji `IMMEDIATE` co zapis
  zdarzenia), a `POST /:id/przelicz` wywołuje DOKŁADNIE TĘ SAMĄ funkcję. Nie ma osobnej,
  „przyrostowej” ścieżki aktualizacji materializacji, która mogłaby z czasem rozjechać się z pełną
  odbudową — komentarz w kodzie (`rejestr.js:11-15`) explicite to deklaruje: „Każdy zapis kończy się
  pełnym przeliczeniem materializacji – nie ma osobnej ścieżki przyrostowej, która mogłaby się
  rozjechać z odbudową." Test praktyczny to tylko potwierdza; architektura czyni ten konkretny błąd
  strukturalnie nieosiągalnym przez normalną ścieżkę API (mogłaby wystąpić wyłącznie po ręcznej
  ingerencji w bazę z pominięciem aplikacji — a to jest już poza zakresem „normalnej” pracy modułu i
  jest odrębnie testowane w Z-300/Z-302).
- **Co powinno się stać:** dokładnie to — reguła domenowa 2 (`CLAUDE-PSA.md`: „Test obowiązkowy:
  odbudowa = stan bieżący").
- **Podstawa:** `CLAUDE-PSA.md` reguła domenowa 2.
- **Waga:** POZYTYWNE.

## Z-304 [POZYTYWNE] — wyścig: dwa jednoczesne żądania przeniesienia TYCH SAMYCH akcji do dwóch
różnych nabywców — poprawnie zserializowane, żadnego podwójnego rozporządzenia

- **Co zrobiłem:** na własnej spółce testowej (id=8, 100 akcji serii F6 w całości u „Anny
  Testowa6A") wysłałem RÓWNOCZEŚNIE (`Promise.all`, bez oczekiwania na pierwszą odpowiedź) dwa
  żądania `POST /api/psa/spolki/8/zdarzenia` typu `przeniesienie` — jedno przenoszące WSZYSTKIE 100
  akcji od Anny do „Bartosza”, drugie przenoszące TE SAME 100 akcji od Anny do „Cezarego”.
- **Co się stało:** pierwsze żądanie (kolejność wykonania po stronie serwera, nie kolejność w kodzie
  klienta) zwróciło `201` (wpis przyjęty). Drugie zwróciło `422`: „Brak pokrycia: żądano 100 akcji,
  a pakiet zbywcy w serii F6 obejmuje 0 akcji wolnych." — odrzucone, bo w chwili jego przetwarzania
  Anna nie miała już żadnych akcji do zbycia. Stan końcowy (`GET /:id/stan`): dokładnie 100 akcji u
  JEDNEGO nabywcy (Bartosza), bilans zgadza się z emisją (100/100), `niezgodnosci: []`. Żaden
  duplikat własności, żadne rozjechanie sumy akcji.
- **Przyczyna (potwierdzona w kodzie):** `server/rejestr.js` — `zapiszZdarzenie()` wylicza kolejne
  `id` zdarzenia jako `MAX(id)+1` i wykonuje `INSERT` W TEJ SAMEJ transakcji `db.transaction(...).
  immediate()`, co `_wykonajWpis()`/`dokonajWpisu()` — tryb `IMMEDIATE` w SQLite nabiera blokady
  zapisu NATYCHMIAST na starcie transakcji (nie dopiero przy pierwszym zapisie), więc dwie
  równoległe transakcje zapisu na tej samej bazie są efektywnie SZEREGOWANE przez silnik SQLite —
  druga czeka, aż pierwsza się zakończy (`COMMIT`), i dopiero wtedy jej walidacja bilansu widzi już
  zaktualizowany stan po pierwszej.
- **Co powinno się stać:** dokładnie to — checklista sesji FAZA 6 („Wywołaj dwa jednoczesne wpisy
  dotyczące tych samych akcji. Czy powstaje stan, w którym suma akcji nie zgadza się z emisją?") —
  odpowiedź: NIE, nie powstaje.
- **Podstawa:** `CLAUDE-PSA.md` reguła domenowa 3 (bilans akcji musi się zgadzać zawsze, odmowa
  zapisu przy naruszeniu) w połączeniu z regułą techniczną transakcji `IMMEDIATE`.
- **Waga:** POZYTYWNE — kontrastuje pozytywnie z Z-004 (FAZA 1, wyścig na `psa_zgloszenia`, gdzie
  analogiczna ochrona NIE była odporna na współbieżność, bo sprawdzenie duplikatu robione było
  `SELECT` przed `INSERT` BEZ transakcji `IMMEDIATE` i bez `UNIQUE`). Rdzeń rejestru (zapis
  zdarzeń) jest odporny na wyścig; warstwa wcześniejsza (zgłoszenia/wnioski, poza zakresem FAZA 6)
  nie jest — do rozważenia jako wzorzec do naśladowania w innych miejscach z problemem „sprawdź,
  potem zapisz” (patrz też rekomendacja z Z-004).

## Z-305 [POWAŻNY] — „stan na" z dokładnością do minuty (wymagany explicite specyfikacją) NIE jest
dostępny w rzeczywistym UI kokpitu spółki — pracownik nie ma jak w praktyce odróżnić dwóch zdarzeń
tego samego dnia

- **Co zrobiłem:** przejrzałem `publiczne/js/kokpit.js` (suwak/pole „stan na" w kokpicie spółki) i
  porównałem z `server/widoki.js`/`server/pomocnicze/czas.js` (warstwa API). Dodatkowo praktycznie
  sprawdziłem przez API: spółka testowa (id=8) z emisją i objęciem zapisanymi TEGO SAMEGO dnia
  (`data_zdarzenia: "2026-01-05"` dla obu) — odpytałem `GET /:id/stan?data=2026-01-05` (format
  data-only, jedyny dostępny w UI).
- **Co się stało:**
  1. `kokpit.js:503,580` używa wyłącznie komponentu `PoleDaty` (pole typu data, BEZ godziny) do
     ustawienia parametru „stan na" wysyłanego do `GET /:id?data=...` — nigdzie w UI kancelaryjnym
     nie ma pola pozwalającego wybrać godzinę/minutę. Komentarz w kodzie (linia 501-502) wprost
     mówi: „Dawniej wybierało się go playheadem na osi akcji; oś zniknęła, więc została sama data,
     czyli to, o co naprawdę chodziło" — sugeruje to ŚWIADOME uproszczenie przy jakiejś wcześniejszej
     zmianie UI (redukcja z chwili do samej daty), nie przeoczenie pojedynczego pola.
  2. Backend NADAL W PEŁNI obsługuje precyzję do minuty: `server/pomocnicze/czas.js:poprawnaChwila`
     akceptuje format `RRRR-MM-DDTGG:MM[:SS]`, a `server/widoki.js:55-76` (`widokStanu`) faktycznie
     odtwarza stan WYŁĄCZNIE ze zdarzeń, których `data_wpisu` (rzeczywisty czas wpisania, co do
     sekundy) jest ≤ wskazanej chwili — to dokładnie mechanizm opisany w `CLAUDE-PSA.md` sekcja 9
     („suwak »stan na«... z dokładnością do minuty, bo wpisy z tego samego dnia mają kolejność").
     Endpoint istnieje i działa — ale NIC w UI kancelaryjnym go nie wywołuje.
  3. Test praktyczny potwierdza SKUTEK: `GET /:id/stan?data=2026-01-05` (dzień, w którym zapisano
     KOLEJNO emisję i objęcie) zwraca stan PO objęciu (Anna ma już 100 akcji) — dokładność
     data-only nigdy nie pokaże stanu „między” dwoma zdarzeniami tego samego dnia, bo z definicji
     funkcji `przedzialyNaDzien(stan, dzien)` (`server/logika/stan.js:879-888`) każdy dzień to JEDNA
     wartość graniczna, nie zbiór chwil.
- **Co powinno się stać:** zgodnie z `CLAUDE-PSA.md` sekcja 9 (explicite, dosłownie): „suwak »stan
  na« przełączający cały ekran wstecz — z dokładnością do minuty, bo wpisy z tego samego dnia mają
  kolejność (podpatrzone u DM BOŚ)" — dziś ten wymóg nie jest spełniony w interfejsie, którego
  pracownik faktycznie używa. Wynika z tego również, że checklista sesji FAZA 6 („Dwa zdarzenia
  tego samego dnia muszą dać różne stany w zależności od wskazanego momentu") jest spełniona
  WYŁĄCZNIE na poziomie API/backendu, NIE w praktyce operacyjnej kancelarii.
- **Podstawa:** `CLAUDE-PSA.md` sekcja 9 (wymóg „z dokładnością do minuty" — cytat dosłowny);
  checklista sesji FAZA 6.
- **Waga:** POWAŻNY — nie jest to utrata integralności rejestru (dane są poprawne, kolejność
  zdarzeń jest poprawnie zapisana i możliwa do odtworzenia przez API), ale jest to funkcja
  jednoznacznie wymagana przez specyfikację, która ISTNIEJE w warstwie serwera, a jest NIEOSIĄGALNA
  dla pracownika kancelarii w codziennej pracy — praktyczna konsekwencja: przy sporze co do
  kolejności dwóch zdarzeń tego samego dnia (np. które z dwóch przeniesień było pierwsze) pracownik
  nie ma narzędzia w UI, żeby to sprawdzić, mimo że dane do tego istnieją i są poprawne.

## Z-306 [POWAŻNY/PYTANIE] — mechanizm „stan na chwilę" (godzina) zależy w 100% od zmiennej
środowiskowej `TZ` procesu serwera, bez żadnej walidacji w czasie działania, a format zapytania
uniemożliwia przekazanie jednoznacznego offsetu strefy czasowej

- **Co zrobiłem:** przeczytałem `server/widoki.js:59,69-70` (`new Date(surowaData).getTime()`, gdzie
  `surowaData` to SUROWY parametr `?data=` z zapytania) i `server/pomocnicze/czas.js:poprawnaChwila`
  (regex `^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$` — BEZ możliwości podania `Z`/offsetu).
  Sprawdziłem `server/konfiguracja.js:32` (`if (process.env[klucz] === undefined) process.env[klucz]
  = wartosc;` — zmienna już ustawiona w środowisku procesu MA PIERWSZEŃSTWO nad `.env`) oraz
  `.env`/`.env.przyklad` (`TZ=Europe/Warsaw`). Zweryfikowałem empirycznie w tym samym środowisku
  (Node, bez uruchamiania serwera): `TZ=UTC node -e "new Date('2026-01-06T23:30').toISOString()"`
  → `2026-01-06T23:30:00.000Z`; `TZ=Europe/Warsaw node -e "..."` → `2026-01-06T22:30:00.000Z`
  (RÓŻNE chwile absolutne, godzina różnicy, dla IDENTYCZNEGO ciągu zapytania). Dodatkowo
  potwierdziłem, że system operacyjny tego środowiska ma domyślnie `Etc/UTC`
  (`cat /etc/timezone`), a proces `node serwer.js` uruchomiony wcześniej ma `TZ=Europe/Warsaw` w
  swoim `environ` WYŁĄCZNIE dlatego, że `.env` zdążył go ustawić, zanim cokolwiek innego użyło
  obiektu `Date` — nie ma żadnej asercji w kodzie startowym, która by to sprawdziła czy wymusiła.
- **Co się stało:** parametr `?data=RRRR-MM-DDTGG:MM` wysyłany przez dowolnego klienta API (albo
  przyszły UI, gdyby ktoś dodał pole godziny zgodnie z Z-305) jest interpretowany jako czas LOKALNY
  PROCESU SERWERA — bez żadnego jawnego wskazania strefy w samym zapytaniu (regex to wręcz
  wyklucza). Jeżeli platforma hostingowa/kontener produkcyjny ustawi zmienną środowiskową `TZ` na
  poziomie systemu/orkiestracji (częsta praktyka — wiele obrazów kontenerowych i platform PaaS
  domyślnie ustawia `TZ=UTC` albo w ogóle nie definiuje `TZ`, co w Node bez jawnego ustawienia
  domyślnie oznacza UTC) PRZED odczytaniem `.env` przez aplikację, `.env` NIE nadpisze tej wartości
  (linia 32 `konfiguracja.js` działa świadomie w tę stronę: zmienna środowiskowa wygrywa) —
  interpretacja „chwili" cichutko przesunie się o godzinę (czas letni) albo dwie (zimowy, choć akurat
  dla Warszawy to zawsze ±1h względem UTC), bez ŻADNEGO komunikatu błędu czy ostrzeżenia w logach.
- **Co powinno się stać:** nierozstrzygnięte wprost bez decyzji Łukasza co do tego, jak bardzo ma to
  być odporne na błędną konfigurację wdrożenia — techniczne opcje to np. (a) asercja przy starcie
  serwera, że `process.env.TZ === 'Europe/Warsaw'` (albo z awaryjnym `process.env.TZ =
  'Europe/Warsaw'` wymuszonym programowo, NIEZALEŻNIE od tego, co już jest w środowisku), (b)
  wymaganie explicite podanego offsetu w parametrze `?data=` zamiast API zakładającego strefę
  procesu. `CLAUDE-PSA.md` nie precyzuje tego wprost — to nie jest kwestia zgodności z przepisem,
  tylko odporności konfiguracyjnej infrastruktury (sekcja 2 tego pliku i tak zostawia „Wariant
  wdrożenia" i TLS/kopie zapasowe jako otwarte punkty do decyzji przed produkcją).
- **Podstawa:** checklista sesji FAZA 6 („Sprawdź, czy strefa czasowa nie przesuwa granicy doby");
  zasada techniczna — brak walidacji krytycznego założenia środowiskowego przy starcie procesu.
- **Waga:** POWAŻNY w sensie potencjału (przesunięcie granicy „chwili" o 1-2h przy błędnej
  konfiguracji wdrożenia jest realną, cichą usterką bez żadnego sygnału), ale ryzyko DZIŚ jest
  ograniczone przez Z-305 (funkcja i tak nieosiągalna z UI, więc efektywnie martwa w praktyce
  operacyjnej — jeśli i kiedy Z-305 zostanie naprawione, ta usterka staje się aktywna i powinna być
  naprawiona RAZEM z nim, nie osobno).

## Z-307 [POZYTYWNE] — „stan na dzień" (bez godziny) ma poprawne granice — dzień przed/w
dniu/po zdarzeniu — i jest w pełni odporny na przesunięcie strefy czasowej (w przeciwieństwie do
ścieżki „z godziną", Z-306)

- **Co zrobiłem:** dla spółki testowej (id=8) ze zdarzeniem `przeniesienie` datowanym na
  `2026-01-06` odpytałem `GET /:id/stan?data=` kolejno dla `2026-01-04`, `2026-01-05` (dzień
  poprzedniego stanu), `2026-01-06` (dzień samego zdarzenia) i `2026-01-07` (dzień po). Przeczytałem
  też `server/logika/stan.js:przedzialyNaDzien` i `server/pomocnicze/czas.js:poprawnaData` (walidacja
  formatu jawnie przez `Date.UTC`, bez zależności od strefy procesu).
- **Co się stało:** `2026-01-04` → brak akcjonariuszy (przed emisją); `2026-01-05` → Anna 100 akcji
  (dzień objęcia, PRZED przeniesieniem); `2026-01-06` → Bartosz 100 akcji (dzień przeniesienia — stan
  JUŻ PO zdarzeniu tego dnia, zgodnie z konwencją `data_od <= T AND (data_do IS NULL OR data_do >
  T)`); `2026-01-07` → Bartosz 100 akcji (bez zmian, poprawnie). Granice poprawne, żadnego
  przesunięcia o dzień. Materializacja porównuje surowe stringi dat kalendarzowych (`YYYY-MM-DD`),
  nigdy nie przechodząc przez `new Date(...)` zależny od strefy procesu — ta ścieżka jest z
  konstrukcji odporna na problem z Z-306.
- **Co powinno się stać:** dokładnie to.
- **Podstawa:** checklista sesji FAZA 6 („Stan na dzień — granice. Sprawdź stan na dzień zdarzenia,
  na dzień przed i po... Sprawdź, czy strefa czasowa nie przesuwa granicy doby").
- **Waga:** POZYTYWNE.

## Z-308 [POZYTYWNE] — sprostowanie tworzy NOWE zdarzenie i nigdy nie modyfikuje zdarzenia
prostowanego; korekta stosowana retroaktywnie wyłącznie w warstwie odtworzonego stanu

- **Co zrobiłem:** dla zdarzenia `objecie` (id=29, spółka 8, wzmianka o pokryciu „tak") wysłałem
  `POST /api/psa/zdarzenia/29/sprostuj` z `zamiast` wskazującym poprawioną wzmiankę „częściowo".
  Porównałem treść WSZYSTKICH zdarzeń spółki przed i po (bezpośredni odczyt `psa_zdarzenia`,
  wyłącznie `SELECT`) oraz `GET /:id/stan?data=2026-01-05` (dzień pierwotnego zdarzenia) przed i po
  sprostowaniu.
- **Co się stało:** powstało NOWE zdarzenie (id=37, `typ:"sprostowanie"`,
  `zdarzenie_prostowane_id:29`, treść zamienna w `dane_json.zamiast`). Zdarzenie id=29 pozostało W
  100% NIETKNIĘTE — identyczna treść `dane_json` przed i po (wzmianka nadal „tak" w ORYGINALNYM
  rekordzie). Mimo to `GET /:id/stan?data=2026-01-05` PO sprostowaniu pokazuje już poprawioną
  wartość („częściowo") — korekta jest więc widoczna w odtworzonym stanie DOKŁADNIE od
  chronologicznej pozycji oryginału, bez naruszenia samego łańcucha zdarzeń. `GET
  /api/psa/integralnosc` po całej operacji nadal `ok:true` (37 zdarzeń, łańcuch spójny).
- **Co powinno się stać:** dokładnie to — checklista sesji FAZA 6 („Sprostowanie — czy tworzy nowe
  zdarzenie, czy modyfikuje poprzednie") i `CLAUDE-PSA.md` reguła domenowa 1 („Pomyłka = zdarzenie
  »sprostowanie« wskazujące zdarzenie prostowane. W UI nie istnieje przycisk »Edytuj« dla
  zdarzenia").
- **Podstawa:** `CLAUDE-PSA.md` reguła domenowa 1; `server/logika/stan.js:694-710` (komentarz
  projektowy dokładnie opisujący ten mechanizm, potwierdzony tu praktycznie, nie tylko przez odczyt
  kodu).
- **Waga:** POZYTYWNE.

---

# FAZA 3 — dane osobowe: czy zbieramy właściwe (Z-150 – Z-179)

## Z-150 [KRYTYCZNY] — endpoint JSON zwracający stan rejestru (`widoki.widokStanu`) wysyła do roli
„spółka" (i „organ") pełne dane AML/PEP oraz notatkę wewnętrzną każdego akcjonariusza — pola, które
z definicji modułu (`CLAUDE-PSA.md` sekcja 10, komentarze w `maskowanie.js`) NIGDY nie mają trafiać
poza kancelarię; wyciek jest w surowym JSON-ie, nie w żadnym wydruku

- **Co zrobiłem:** zalogowany jako pracownik kancelarii, wywołałem bezpośrednio
  `GET /api/psa/spolki/1/stan` (bez parametru `rola` = domyślnie kancelaria), potem z
  `?rola=spolka` i z `?rola=organ` — dokładnie ta sama funkcja `widoki.widokStanu()`
  (`server/widoki.js:55`), z tym samym parametrem `rola`, stoi za: (a) tym testowym endpointem
  pracowniczym, (b) `GET /api/psa/portal/rejestr/:spolkaId` — czyli REALNYM endpointem, który w
  produkcji odpytuje ekran „Rejestr" konta portalowego roli `spolka` (`server/trasy/portal.js:1267-1282`,
  rola wyliczana **po stronie serwera** z sesji, `rolaOdbioru(zad.konto)` — bez możliwości
  manipulacji przez klienta, więc test przez `?rola=` daje identyczny wynik jak prawdziwe
  logowanie portalowe roli „spółka"). Dla porównania sprawdziłem też, jakie pola faktycznie
  wykorzystuje generator wydruku „Informacja z rejestru" (`server/logika/informacja-dokument.js`)
  oraz frontend kancelarii (`publiczne/js/kokpit.js`) i portalu (`publiczne/js/ui-rejestr.js`).
- **Co się stało:** dla `rola=spolka` obiekt `osoba` w `akcjonariusze[].osoba` zawiera m.in.
  `aml_status`, `aml_data`, `aml_notatka` (wolny tekst pisany przez pracownika o konkretnej
  osobie), `aml_data_przegladu`, `beneficjent_rzeczywisty_id`, `pep`, `pep_opis`,
  `pep_oswiadczenie`, `pep_oswiadczenie_data` oraz `uwagi` — **identycznie jak dla roli
  kancelaria**, bez żadnego okrojenia. To samo potwierdzone dla `rola=organ`. Przykład (spółka
  testowa #1, akcjonariusz „Testowa Ala"):
  ```
  rola=spolka: aml_status=brak pep=nie uwagi=None aml_notatka=None beneficjent_rzeczywisty_id=None
  rola=organ:  aml_status=brak pep=nie uwagi=None aml_notatka=None beneficjent_rzeczywisty_id=None
  ```
  (wartości akurat puste na tej testowej osobie — pole istnieje i JEST wysyłane; przy
  akcjonariuszu z realną notatką AML notatka poleciałaby w całości). Przyczyna w kodzie
  (`server/logika/maskowanie.js:24-45`): funkcja `zamaskujOsobe()` ma TYLKO dwie gałęzie —
  `pelnyDostep` (kancelaria/spółka/właściciel danych/organ) zwraca `{ ...osoba, zamaskowane: false }`
  czyli **cały surowy rekord bez wyjątku**, a usunięcie `aml_status`/`aml_data`/`aml_notatka`/`uwagi`
  (linie 40-43) wykonuje się WYŁĄCZNIE w gałęzi zamaskowanej (dla roli „akcjonariusz"). Innymi
  słowy: kod rozróżnia dwie NIEZALEŻNE polityki dostępu — (A) PESEL/data urodzenia/adres, gdzie
  pełny dostęp mają kancelaria+spółka+właściciel+organ (art. 300³⁵ §1/§4 — poprawnie), i (B)
  AML/PEP/uwagi wewnętrzne, które WEDŁUG WŁASNEJ dokumentacji modułu powinny zostać wyłącznie w
  kancelarii (`CLAUDE-PSA.md` sekcja 10: „Czego NIE umieszczać na wydrukach dla klienta: pole
  `uwagi`... notatki AML"; komentarz przy `uwagi` w schemacie spółki: „wewnętrzne, nigdy na
  wydruku"; `maskowanie.js` samo w sobie komentuje `aml_notatka` jako „nigdy nie wychodzi poza
  kancelarię w żadnym wariancie") — ale w kodzie polityka (B) jest POD WARUNKIEM tej samej flagi
  `pelnyDostep`, co polityka (A), więc spółka i organ (które słusznie mają pełny dostęp do (A))
  dostają przy okazji też (B), czego reguła nigdy nie zakładała.
  Dodatkowo sprawdziłem, że frontend kancelarii (`kokpit.js`) w ogóle NIE odczytuje
  `aml_status`/`aml_notatka`/`uwagi` z odpowiedzi `/stan` — te dane są pokazywane pracownikowi
  wyłącznie na osobnym ekranie kartoteki (`GET /api/psa/osoby/:id`), a nie w kokpicie spółki. Ten
  sam wniosek dla portalu (`ui-rejestr.js` też ich nie renderuje). Oznacza to, że pola te nie są
  potrzebne w tej odpowiedzi NIKOMU — trafiają do niej wyłącznie dlatego, że `zamaskujOsobe()` w
  gałęzi pełnego dostępu zwraca dosłownie cały wiersz `psa_osoby`, a nie wybrane pola (naruszenie
  zasady minimalizacji danych, niezależnie od problemu autoryzacji).
  **Doprecyzowanie po dalszym teście — dokładnie ten scenariusz, o który prosiła checklista sesji
  („zaloguj się jako akcjonariusz A i odpytaj endpoint zwracający dane rejestru… czy odpowiedź JSON
  zawiera PESEL, datę urodzenia i adres akcjonariusza B"):** dla `rola=akcjonariusz&odbiorca=1`
  (Ala ogląda Bogdana, `id=2`) `pesel`/`data_urodzenia`/`kod_pocztowy`/`miejscowosc`/`ulica`/
  `nr_domu` Bogdana są POPRAWNIE zamaskowane (`•••`), a `aml_status`/`aml_data`/`aml_notatka`/
  `uwagi` POPRAWNIE usunięte z odpowiedzi — ale `pep`, `pep_opis`, `pep_oswiadczenie`,
  `pep_oswiadczenie_data`, `beneficjent_rzeczywisty_id` i `aml_data_przegladu` Bogdana **zostają w
  odpowiedzi, w pełni jawne, nawet w tej gałęzi**. Sprawdzone bezpośrednio: `curl … ?rola=
  akcjonariusz&odbiorca=1` → klucz `pep` obecny w rekordzie osoby #2 (`"pep":"nie"`), klucze
  `aml_status`/`uwagi` nieobecne (poprawnie usunięte). Przyczyna: `server/logika/maskowanie.js:40-43`
  usuwa DOSŁOWNIE cztery pola (`aml_status`, `aml_data`, `aml_notatka`, `uwagi`) i ANI JEDNEGO z
  pól PEP/beneficjenta rzeczywistego — mimo że są to dane tej samej kategorii (AML, nigdy
  niewychodzące poza kancelarię wg własnego komentarza modułu) i mieszkają w tej samej sekcji
  formularza kartoteki co `pep_oswiadczenie`, opisanej w UI jako „Oświadczenie SKŁADANE PRZEZ
  OSOBĘ (art. 46 ustawy AML)". Znaczy to, że NAWET GDY Z-006 zostanie kiedyś naprawione i powstaną
  prawdziwe konta portalowe roli „akcjonariusz", jeden akcjonariusz już dziś (przy identycznym
  kodzie) zobaczyłby w surowej odpowiedzi JSON, czy inny akcjonariusz tej samej spółki jest osobą
  politycznie eksponowaną (i jej opis relacji/funkcji) oraz kto jest jego beneficjentem
  rzeczywistym — czyli scenariusz o jeden stopień gorszy niż wyciek do „spółki”/„organu”, bo
  dotyczy wprost PEER-a, a nie podmiotu z ustawowo uzasadnionym pełnym dostępem do żadnej kategorii
  danych tej osoby.
- **Co powinno się stać:** wyciek dotyczy pola z definicji poufnego (notatka AML to w istocie
  ocena ryzyka finansowo-politycznego konkretnej osoby, blisko kategorii szczególnie chronionych
  przy PEP) i trafia dziś — realnym kanałem produkcyjnym (`portal/rejestr/:spolkaId`) — do KAŻDEJ
  spółki obsługiwanej przez moduł, na każde odświeżenie ekranu „Rejestr" w portalu. Usunięcie
  `aml_status`/`aml_data`/`aml_notatka`/`aml_data_przegladu`/`beneficjent_rzeczywisty_id`/`pep`/
  `pep_opis`/`pep_oswiadczenie`/`pep_oswiadczenie_data`/`uwagi` powinno następować ZAWSZE poza rolą
  `kancelaria`, niezależnie od `pelnyDostep` liczonego dla PESEL-u/adresu — to dwie osobne
  polityki, którym w kodzie odpowiada dziś jedna wspólna flaga.
- **Podstawa:** `CLAUDE-PSA.md` sekcja 10 (lista pól niedozwolonych na wydrukach dla klienta,
  którą przez analogię — skoro nie mają trafiać nawet na wydruk — tym bardziej nie powinny trafiać
  do żywego API); komentarze własne modułu w `maskowanie.js` i `migracje.js` (uzasadnienie
  wydzielenia `pep_oswiadczenie`/`aml_notatka` jako danych nigdy niewychodzących poza kancelarię);
  pomocniczo art. 300³⁵ § 1/§ 2 KSH — jawność rejestru dla spółki dotyczy TREŚCI REJESTRU (art.
  300³³), a dokumentacja AML notariusza jako instytucji obowiązanej to odrębny zbiór danych, nie
  „treść rejestru akcjonariuszy".
- **Waga:** KRYTYCZNY — żywy, produkcyjny kanał (portal klienta, rola „spółka", włączony domyślnie
  w środowisku audytowym: `portal_wlaczony=true`), wyciek danych szczególnie wrażliwych (ocena
  PEP, notatki AML) do podmiotu, który nie powinien mieć do nich dostępu wcale, przy każdym
  odczycie ekranu rejestru. Dla roli „organ" ryzyko jest dziś głównie teoretyczne (rola używana
  wyłącznie przez pracownika kancelarii do podglądu/wydruku — automatyczny dostęp organów z art.
  300³⁵ § 4 jest 🔵, nieaktywny do 18.02.2027), ale ten sam błąd czeka gotowy do aktywacji razem z
  nowelizacją.

## Z-151 [POWAŻNY] — dwa pola statusu PEP (`pep` i `pep_oswiadczenie`) mają jasno udokumentowany,
odmienny sens („ustalenie kancelarii" vs „oświadczenie osoby"), ale ścieżka wniosku portalowego —
główny, docelowy kanał onboardingu — zasila WYŁĄCZNIE `pep`, więc „prawdziwe" pole oświadczenia
zostaje puste dla każdego akcjonariusza onboardowanego przez portal

- **Co zrobiłem:** przeczytałem komentarze i logikę w `server/trasy/osoby.js:131-141`
  (`ostrzezeniaOsoby` — „`pep` to ustalenie kancelarii, `pep_oswiadczenie` - to, co oświadczyła
  osoba… różnica musi być widoczna, bo to ona uruchamia wzmożone środki bezpieczeństwa mimo
  zaprzeczenia klienta") i w UI kartoteki `publiczne/js/osoby.js:368-465` (etykieta wprost:
  „Oświadczenie SKŁADANE PRZEZ OSOBĘ (art. 46 ustawy AML) — nie ocena ani domysł kancelarii" dla
  `pep_oswiadczenie`, kontra „Status PEP jest DANĄ osoby... kancelaria stosuje" dla `pep`).
  Porównałem to ze schematem `psa_wnioski_akcjonariusze` (`testy-audyt/schemat-bazy.txt`) i z
  kodem przejęcia wniosku `server/trasy/wnioski.js:747-764`, oraz z generatorem dokumentu do
  podpisu `server/logika/dokumenty-wniosku.js:304-324` (`oswiadczenieAml`).
- **Co się stało:** `psa_wnioski_akcjonariusze` NIE MA kolumny `pep_oswiadczenie` w ogóle —
  formularz wniosku portalowego (wypełniany przez wnioskodawcę dla siebie i dla POZOSTAŁYCH
  akcjonariuszy, zanim mają oni jakiekolwiek konto) zbiera wyłącznie pojedyncze pole `pep`/
  `pep_opis`. To właśnie ta wartość trafia do wydrukowanego „Oświadczenia o beneficjencie
  rzeczywistym i statusie PEP", które dana osoba fizycznie podpisuje — czyli w praktyce PEŁNI
  funkcję oświadczenia w rozumieniu art. 46 ustawy AML. Przy przyjęciu wniosku
  (`wnioski.js:750-751`: `for (const pole of osobyModul.POLA_OSOBY) { if (a[pole] !== undefined...)
  daneOsoby[pole] = a[pole]; }`) wartość ta trafia do `psa_osoby.pep` (bo `pep` jest na liście
  `POLA_USTAWOWE` wspólnej dla obu tabel), NIGDY do `psa_osoby.pep_oswiadczenie` (bo tej kolumny
  źródłowa tabela nie ma — pole zostaje `undefined` i jest pomijane). Efekt: dla KAŻDEGO
  akcjonariusza onboardowanego przez portal (czyli deklarowany główny model biznesowy modułu),
  pole `pep_oswiadczenie` w kartotece wspólnej zostaje trwale `NULL` („nie oświadczono"), mimo że
  fizycznie podpisany dokument oświadczenia w tej sprawie istnieje w aktach (jako skan w
  `psa_wnioski_dokumenty`) — a pole `pep`, opisane w kodzie jako „ustalenie/ocena kancelarii", w
  rzeczywistości zawiera nieskorygowaną wartość wpisaną przez KLIENTA (czasem przez wnioskodawcę W
  IMIENIU innego akcjonariusza), bez żadnego udziału kancelarii w jej ustaleniu. Ostrzeżenie o
  rozbieżności między oboma polami (`osoby.js:131-141`) w tym torze nigdy się nie uruchomi, bo
  `pep_oswiadczenie` jest zawsze puste, a warunek sprawdza `=== 'nie'`.
- **Co powinno się stać:** albo (a) `psa_wnioski_akcjonariusze` powinno mieć własne pole
  `pep_oswiadczenie`/`pep_oswiadczenie_data`, a przejęcie wniosku powinno mapować wartość z
  formularza wprost na `pep_oswiadczenie` (skoro to faktycznie oświadczenie podpisywane przez
  osobę), zostawiając `pep` puste do osobnej, późniejszej oceny kancelarii — albo (b) jeśli
  zamysłem jest, że przy onboardingu portalowym te dwa pola MAJĄ na starcie być tożsame (bo
  kancelaria dopiero przy weryfikacji wniosku potwierdza/koryguje `pep` na podstawie tego, co
  zobaczy), przejęcie wniosku powinno zapisywać wartość do OBU pól jednocześnie, żeby mechanizm
  wykrywania rozbieżności (`osoby.js:134`) miał w ogóle szansę zadziałać, gdy kancelaria później
  zmieni `pep` niezależnie.
- **Podstawa:** rozróżnienie i uzasadnienie obu pól są własnym, jawnym zamysłem projektu
  (`server/migracje.js:918-928` — komentarz „OŚWIADCZENIE OSOBY (art. 46 ustawy AML), nie ocena
  kancelarii"), więc to nie jest pytanie o nową regułę prawną — to niespójność między dwoma
  miejscami tego samego projektu, które miały tę samą zasadę realizować. `PRZEPISY-PSA.md` nie
  reguluje PEP wprost (to ustawa AML, poza zakresem KSH) — stąd nie klasyfikuję kwestii, CZY
  status PEP jest wymagany, tylko fakt niespójności mapowania.
- **Waga:** POWAŻNY — dotyczy zgodności z ustawą AML (art. 46) w GŁÓWNYM kanale onboardingu, a
  osłabia też mechanizm wykrywania rozbieżności między deklaracją klienta a oceną kancelarii,
  który sam projekt uznał za istotny na tyle, żeby dodać dwa osobne pola.

## Z-152 [POWAŻNY] — dziennik dostępu do danych osobowych (`psa_dziennik_dostepu`) rejestruje
wyłącznie „wyniesienie" danych na zewnątrz (informacja z rejestru, eksport, pobranie pliku), NIGDY
zwykły odczyt stanu rejestru przez API/ekran — w połączeniu z Z-150 oznacza to, że wyciek danych
AML/PEP do roli „spółka" jest całkowicie niewidoczny w dzienniku

- **Co zrobiłem:** przejrzałem `server/logika/dziennik-dostepu.js` oraz wszystkie 12 miejsc jego
  wywołania (`grep dziennikDostepu.zapisz` w `server/trasy/*.js`) i porównałem z listą wszystkich
  endpointów zwracających dane osoby (`widoki.widokStanu`, `GET /:id/stan`,
  `GET /api/psa/portal/rejestr/:spolkaId`, `GET /api/psa/osoby/:id`).
- **Co się stało:** katalog rejestrowanych akcji to wyłącznie:
  `informacja_z_rejestru`, `raport_sad`, `eksport`, `pobranie_pliku`, `zmiana_ustawien` — decyzja
  jest jawnie udokumentowana i świadoma (`server/migracje.js:934-940`: „WĄSKI zakres… NIE każde
  wyświetlenie listy/kokpitu — szeroki zakres zasypałby ją szumem"). W efekcie: zwykłe wywołanie
  `GET /api/psa/spolki/:id/stan` (kokpit pracownika) i `GET /api/psa/portal/rejestr/:spolkaId`
  (ekran „Rejestr" w portalu klienta — czyli DOKŁADNIE ten sam endpoint, przez który wycieka Z-150)
  NIE zostawia żadnego śladu w dzienniku dostępu. Dziennik odpowie więc poprawnie na pytanie „komu
  wydano formalną informację z rejestru", ale nie odpowie na pytanie „kto i kiedy oglądał pełne
  dane wrażliwe (PESEL, adres, a po Z-150 także AML/PEP) tej spółki przez ekran/API" — a to jest
  dokładnie pytanie, jakie zada kontrola albo klient przy podejrzeniu wycieku.
- **Co powinno się stać:** to świadoma decyzja projektowa (nie błąd implementacji) — zapisuję jako
  znalezisko, bo w połączeniu z Z-150 podnosi jego wagę (wyciek jest nie tylko szeroki, ale i
  niewykrywalny po fakcie) i bo skala „szumu", jaką autorzy chcieli uniknąć, dotyczyła głównie
  KANCELARII przeglądającej WŁASNE dane; nie rozważano chyba scenariusza, w którym to KLIENT
  (rola „spółka") wielokrotnie odpytuje cudze dane wrażliwe przez swoje własne, zaufane konto.
  Rekomendacja do rozważenia: rejestrować przynajmniej odczyty przez `typ_kto='portal'`
  (znacznie rzadsze niż odczyty pracownicze), zostawiając kokpit pracownika bez zmian.
- **Podstawa:** brak wprost w `PRZEPISY-PSA.md` (to nie wymóg ustawowy, tylko dobra praktyka
  bezpieczeństwa/rozliczalności) — zapisuję też jako **pytanie do Łukasza** (patrz
  `PYTANIA-DO-LUKASZA.md`), bo zmiana zakresu dziennika to decyzja produktowa, nie poprawka błędu.
- **Waga:** POWAŻNY (samodzielnie: brak rozliczalności; w połączeniu z Z-150: podnosi wagę Z-150).

## Z-153 [POWAŻNY] — klauzula informacyjna RODO i formalne oświadczenie o statusie PEP są
generowane WYŁĄCZNIE przy jednorazowym onboardingu spółki przez wniosek portalowy — akcjonariusz,
który obejmuje lub nabywa akcje PÓŹNIEJ, przez zwykły kreator zdarzenia (`przeniesienie`/`objecie`
zakładane bezpośrednio przez pracownika, poza wnioskiem), nigdy nie dostaje żadnego z tych dwóch
dokumentów

- **Co zrobiłem:** sprawdziłem, gdzie w kodzie wywoływane są generatory
  `oswiadczenieRodo`/`oswiadczenieAml` (`server/logika/dokumenty-wniosku.js`) —
  `grep -rl` pokazuje wyłącznie `server/trasy/portal.js` (etap wniosku) i
  `server/logika/pakiet-wniosku.js`. Następnie sprawdziłem listę dokumentów generowanych dla
  każdego typu zdarzenia w `server/logika/typy-zdarzen.js` (pole `dokumenty:`) — żaden z 20 typów
  (`przeniesienie`, `objecie`, `emisja`, `obciazenie`…) nie generuje odpowiednika RODO/PEP; jedyna
  pozycja w każdym z nich to `zawiadomienie_wpis` (albo `[]`).
- **Co się stało:** klauzula informacyjna o przetwarzaniu danych (obowiązek informacyjny
  kancelarii, skoro dane akcjonariuszy pozyskiwane są od spółki, nie od nich — dokładnie scenariusz
  z art. 14 RODO) i formalne, podpisywane oświadczenie o statusie PEP istnieją w systemie TYLKO
  jako część stałego pakietu 9 dokumentów wystawianych raz, przy zakładaniu NOWEJ spółki w portalu.
  Każdy kolejny akcjonariusz, który pojawia się w rejestrze tej samej spółki później — typowo przez
  zwykłą sprawę `przeniesienie` (sprzedaż/darowizna) albo `objecie` (kolejna emisja) zakładaną przez
  pracownika kancelarii wprost w kreatorze, z pominięciem wniosku portalowego — nie dostaje ani
  jednego, ani drugiego dokumentu z systemu. Pracownik MOŻE ręcznie ustawić `pep_oswiadczenie` takiej
  osobie w kartotece (Z-151 pokazuje, że to WŁAŚCIWE pole do tego), ale UI kartoteki
  (`publiczne/js/osoby.js`) nie generuje żadnego dokumentu do podpisu towarzyszącego tej zmianie —
  wpis może powstać na podstawie samej rozmowy telefonicznej, bez śladu w postaci podpisanego
  oświadczenia. To istotne, bo — jak pokazuje Z-005 z FAZY 1 — jedyna wyeksponowana ścieżka
  otwarcia rejestru dla spółek onboardowanych przez portal w ogóle pomija pełny kreator, a każda
  spółka prędzej czy później ma zdarzenia POzawnioskowe (to normalny, wieloletni cykl życia
  rejestru, nie wyjątek).
- **Co powinno się stać:** albo (a) każdy typ zdarzenia wprowadzający NOWĄ osobę do rejestru danej
  spółki po raz pierwszy powinien mieć w swojej liście `dokumenty` odpowiednik RODO (i AML/PEP,
  jeśli spółka ma włączoną `stosuje_procedure_aml`) — analogicznie do tego, jak dziś ma to
  wniosek — albo (b) jeśli intencją jest, że te dokumenty dotyczą wyłącznie ZAŁOŻENIA spółki (a
  klauzula informacyjna dla kolejnych akcjonariuszy jest realizowana poza aplikacją, np. papierowo
  przy podpisywaniu umowy zbycia), warto to jawnie odnotować w `CLAUDE-PSA.md`, żeby nie wyglądało
  to na przeoczenie przy kolejnym audycie.
- **Podstawa:** obowiązek informacyjny administratora, gdy dane pozyskiwane są nie od osoby, której
  dotyczą (art. 14 RODO — poza `PRZEPISY-PSA.md`, który nie reguluje RODO wprost, stąd zapisuję
  równolegle jako pytanie); ustawa o przeciwdziałaniu praniu pieniędzy art. 46 (oświadczenie PEP)
  — ta sama podstawa co w Z-151.
- **Waga:** POWAŻNY — luka strukturalna dotycząca większości realnego cyklu życia rejestru (wszystko
  poza jednorazowym założeniem spółki), nie tylko brzegowego przypadku.

## Z-154 [POZYTYWNE] — numer PESEL potwierdzony jako pole FAKULTATYWNE (nigdy wymagane twardo) —
zweryfikowane wprost próbą zapisu osoby bez PESEL-u i bez daty urodzenia

- **Co zrobiłem:** `POST /api/psa/osoby` z danymi osoby fizycznej BEZ pól `pesel` i
  `data_urodzenia` (tylko nazwisko, imię, adres).
- **Co się stało:** `201 Created` — rekord zapisany. Odpowiedź zawiera `"braki_ustawowe":
  ["Faza3 TestBezPesel: podaj PESEL albo — gdy akcjonariusz go nie ma — datę urodzenia."]`, czyli
  wyłącznie MIĘKKIE ostrzeżenie (pole `braki_ustawowe`, odrębne od blokujących `bledy`/400), a nie
  odmowę zapisu. Potwierdza to w kodzie `server/logika/akcjonariusz.js`: funkcja `bledy()` (blokuje
  zapis, zwraca 400) nigdy nie sprawdza obecności PESEL-u; wyłącznie `ostrzezenia()` (nieblokująca)
  zgłasza brak PESEL-u I daty urodzenia równocześnie jako brakujący element ustawowy z pkt 5.
  `psa_osoby.pesel` jest też `NULLable` na poziomie schematu (bez `NOT NULL`), zgodnie z
  `FAZA-0-INWENTARYZACJA.md`.
- **Co powinno się stać:** dokładnie to, co się stało — art. 300³³ § 1 pkt 5 KSH nie wymienia
  PESEL-u w katalogu obowiązkowej treści rejestru (patrz `PRZEPISY-PSA.md` sekcja 12 pkt 2);
  wymóg ustawowy dotyczy nazwiska/imienia (lub firmy) oraz adresu, co aplikacja poprawnie
  rozróżnia od PESEL-u/daty urodzenia (pola dodatkowe, informacyjne/AML).
- **Podstawa:** `PRZEPISY-PSA.md` art. 300³³ § 1 pkt 5 i sekcja 12 pkt 2.
- **Waga:** POZYTYWNE.

## Z-155 [POZYTYWNE] — maskowanie PESEL-u/daty urodzenia/adresu zamieszkania zweryfikowane
SYSTEMATYCZNIE w surowym JSON-ie API (nie tylko w jednym wydruku HTML jak w Z-014), dla wszystkich
czterech ról odbiorcy, a rola w kanale portalowym jest wyliczana wyłącznie po stronie serwera

- **Co zrobiłem:** cztery bezpośrednie żądania `GET /api/psa/spolki/1/stan` (spółka testowa z
  dwoma akcjonariuszami z PESEL-em, datą urodzenia i adresem — „Testowa Ala” id 1, „Wzorcowy
  Bogdan” id 2): bez parametru `rola` (domyślnie kancelaria), `?rola=spolka`,
  `?rola=akcjonariusz&odbiorca=1` (widok „oczami” Ali) i `?rola=organ`. Dodatkowo przeczytałem
  `server/trasy/portal.js:1266-1282` i `:134-136` (`rolaOdbioru`), żeby potwierdzić, że w REALNYM
  endpoincie portalowym `GET /api/psa/portal/rejestr/:spolkaId` rola nie jest w ogóle parametrem
  żądania — wynika wyłącznie z `zad.konto.rola` odczytanego z sesji server-side, więc klient
  portalowy (w tym złośliwy, sam wysyłający żądania z pominięciem UI) nie ma jak podać innej roli
  niż ta, do której faktycznie jest zalogowany.
- **Co się stało:** dla `rola=kancelaria` i `rola=spolka` obie osoby w pełni jawne (PESEL, data
  urodzenia, adres). Dla `rola=organ` — tak samo w pełni jawne (zgodnie z art. 300³⁵ § 4).
  Dla `rola=akcjonariusz&odbiorca=1` — własny rekord (Ala, id 1) w pełni jawny, `zamaskowane:
  false`; CUDZY rekord (Bogdan, id 2) ma `zamaskowane: true` i pola `pesel`, `data_urodzenia`,
  `kod_pocztowy`, `miejscowosc`, `ulica`, `nr_domu` zastąpione `•••`, z listą
  `zamaskowane_pola` wprost wymieniającą, co zasłonięto. Brak parametru `odbiorca` przy
  `rola=akcjonariusz` maskuje WSZYSTKICH (sprawdzone osobno) — nie da się „przypadkiem” zobaczyć
  cudzych danych przez pominięcie tego parametru.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** art. 300³⁵ § 1¹ KSH; `CLAUDE-PSA.md` reguła domenowa 9; potwierdza i rozszerza
  Z-014 z FAZY 1 (tam zweryfikowany wyłącznie sam wydruk HTML dla jednej pary spółka/akcjonariusz).
- **Waga:** POZYTYWNE.

## Z-157 [POZYTYWNE] — adres e-mail można zapisać jako zwykły kontakt bez zgody, ale jego użycie do
celów ustawowych (treść rejestru pkt 5, doręczenie zawiadomienia o WZ) jest odrębnie bramkowane
flagą zgody, która NIE ustawia się automatycznie przez sam fakt podania adresu

- **Co zrobiłem:** `POST /api/psa/osoby` z wypełnionym `email`, bez podawania
  `zgoda_email_status`. Sprawdziłem też `server/logika/informacja-dokument.js` (funkcja
  ustalająca adres do doręczeń na wydruku) i `server/logika/akcjonariusz.js:51-55`
  (`znormalizuj()`).
- **Co się stało:** zapis się powiódł, ale `zgoda_email` = `0` i `zgoda_email_status` = `"brak"`
  w odpowiedzi — sam adres e-mail nie uruchamia zgody. W kodzie `zgoda_email` jest WYLICZANE ze
  `zgoda_email_status` (`wynik.zgoda_email = status === ZGODA.POTWIERDZONA ? 1 : 0`), więc jedyna
  droga do „aktywnego” adresu e-mail w rejestrze to jawne ustawienie statusu na `potwierdzona`.
  Generator dokumentu `informacja-dokument.js` dodatkowo sam sprawdza ten sam warunek przed użyciem
  adresu e-mail do czegokolwiek (`if (osoba.zgoda_email_status !== 'potwierdzona' &&
  !Number(osoba.zgoda_email)) return null;`).
- **Co powinno się stać:** dokładnie to, co się stało — art. 300³³ § 1 pkt 5 in fine wymaga zgody
  akcjonariusza na komunikację elektroniczną jako warunku wpisania adresu e-mail do TREŚCI
  rejestru (w znaczeniu doręczeniowym z art. 300⁸⁷ § 1); samo posiadanie adresu kontaktowego w
  kartotece to inna sprawa i aplikacja poprawnie je rozróżnia.
- **Podstawa:** `PRZEPISY-PSA.md` art. 300³³ § 1 pkt 5 i art. 300⁸⁷ § 1.
- **Waga:** POZYTYWNE.

## Z-158 [POZYTYWNE] — pozycje „na żądanie” z art. 300³³ § 1 pkt 6–8 (przejście praw
zastawniczych, prawo głosu zastawnika, wykreślenie obciążenia) są osobnymi typami zdarzeń
wymagającymi WŁASNEJ sprawy z jawnie wskazanym żądającym — nie da się ich wpisać jako
automatyczny efekt uboczny innego zdarzenia

- **Co zrobiłem:** przejrzałem definicje typów `obciazenie`, `wykreslenie_obciazenia`,
  `prawo_glosu_zastawnika` w `server/logika/typy-zdarzen.js:195-233` oraz walidację zakładania
  sprawy w `server/trasy/sprawy.js:162-183`.
- **Co się stało:** każda z tych trzech pozycji to odrębny `typ_zdarzenia`, zapisywany jako
  odrębny wiersz `psa_zdarzenia` w efekcie odrębnej sprawy `psa_sprawy` — nie istnieje ścieżka,
  w której np. zdarzenie `przeniesienie` przy okazji samo dopisuje wzmiankę o prawie głosu
  zastawnika. Założenie sprawy dla typu, który nie jest `z_urzedu` (a żaden z tych trzech nim nie
  jest), wymaga podania `zadajacy_rola` z zamkniętego katalogu `ROLE_ZADAJACEGO` — bez tego pola
  `POST /api/psa/sprawy` zwraca 400 („Wskaż, w jakim charakterze żądający występuje o wpis”).
- **Co powinno się stać:** dokładnie to, co się stało — art. 300³³ § 1 pkt 6–8 KSH wymaga
  odrębnego żądania uprawnionego dla każdej z tych pozycji, a nie wpisu z urzędu przy okazji innej
  czynności.
- **Podstawa:** `PRZEPISY-PSA.md` art. 300³³ § 1 pkt 6–8.
- **Waga:** POZYTYWNE.

## Z-156 [POZYTYWNE] — generator wydruku „Informacja z rejestru” korzysta z wąskiej listy pól
osoby (whitelist), nigdy nie odwołuje się do pól AML/PEP/uwagi niezależnie od roli odbiorcy —
w przeciwieństwie do surowego API (Z-150), dokument końcowy jest bezpieczny

- **Co zrobiłem:** `grep` po wszystkich odwołaniach do pola `osoba.*`/`a.osoba` w
  `server/logika/informacja-dokument.js` oraz w `server/logika/dokumenty-tresc.js` (generator
  „Wykazu akcjonariuszy” dla sądu, art. 300³⁴ § 8/476 § 1¹).
- **Co się stało:** oba generatory odwołują się wyłącznie do konkretnych, wymienionych z nazwy pól
  (`ulica`, `nr_domu`, `nr_lokalu`, `kod_pocztowy`, `miejscowosc`, `adres_doreczen`,
  `adres_edoreczen`, `email` — warunkowo, gdy jest zgoda — `oznaczenie`, `jawny_identyfikator`,
  `zamaskowane`) i mają jawny komentarz nagłówkowy wykluczający `uwagi`, checklisty i notatki AML
  z wydruku. Żadne z pól `aml_*`, `pep*`, `beneficjent_rzeczywisty_id` nie występuje w treści
  dokumentu w żadnej roli.
- **Co powinno się stać:** dokładnie to, co się stało — potwierdza, że problem z Z-150 dotyczy
  WYŁĄCZNIE surowego API stanu rejestru, nie propaguje się do żadnego z generowanych dokumentów
  (ekran vs. wydruk pozostają spójne w zakresie AML tak samo, jak w zakresie PESEL/adresu — Z-014).
- **Podstawa:** `CLAUDE-PSA.md` sekcja 10.
- **Waga:** POZYTYWNE.

---

# FAZA 7 — klasyczne błędy aplikacji generowanych automatycznie

> Zakres Z-350–Z-379. Testowane bezpośrednim żądaniem HTTP (z pominięciem formularza, zgodnie
> z zasadą 3 sesji) na spółkach testowych utworzonych do tego celu (spółka #9 „Testowa Kancelaria
> Audytowa Spolka Faza7...”/300 znaków, spółka #11 „Faza7 Pusta Spolka Testowa P.S.A.” — bez
> żadnych zdarzeń), plus przeglądem Playwright kilku ekranów kancelarii. Skrypty pomocnicze w
> `testy-audyt/skrypty/faza7-*.js`, zrzuty w `testy-audyt/zrzuty/faza7/`. Znaleziska Z-004 i Z-017
> (FAZA 1, wyścig przy zgłoszeniu wstępnym i autozapis wniosku) NIE są tu powtarzane — poniżej
> rozszerzenie tej samej klasy błędów na INNE zapisy (kartoteka osób, założenie sprawy, wpis do
> rejestru).

## Z-350 [POWAŻNY] — kartoteka osób nie ma ŻADNEJ ochrony przed duplikatem: podwójne żądanie
tworzy dwa identyczne rekordy, a dwie RÓŻNE osoby mogą mieć TEN SAM numer PESEL bez ostrzeżenia

- **Co zrobiłem:** (1) wysłałem DWA kolejne (nie równoczesne — zwykłe, sekwencyjne) żądania
  `POST /api/psa/osoby` z identycznym ciałem (`{"typ":"fizyczna","nazwisko":"Duplikat
  Testowy","imie":"Jan"}`), bezpośrednio przez `curl`, z pominięciem przycisku „Zapisz” kartoteki.
  (2) osobno wysłałem DWA żądania `POST /api/psa/osoby` z RÓŻNYMI nazwiskami („PeselTest1 Anna” /
  „PeselTest2-INNA-OSOBA Ewa”), ale identycznym numerem PESEL `90010112349`.
- **Co się stało:** (1) powstały DWA osobne rekordy `psa_osoby` (id 26 i 27), oba „Duplikat Testowy
  Jan”, potwierdzone przez `GET /api/psa/osoby?q=Duplikat%20Testowy` (dwa wiersze) i widoczne wprost
  na liście kartoteki (zrzut `testy-audyt/zrzuty/faza7/martwe-osoby.png` — pozycja „Duplikat Testowy
  Jan” występuje dwukrotnie). (2) obie osoby o różnych nazwiskach zapisały się z tym samym PESEL-em
  (id 28 i 29), HTTP 201 bez żadnego błędu ani ostrzeżenia — `sprawdzOsobe`
  (`server/trasy/osoby.js`) sprawdza WYŁĄCZNIE sumę kontrolną PESEL-u danej osoby z osobna
  (miękkie ostrzeżenie, `ostrzezeniaOsoby`), nigdy kolizję z INNYM już istniejącym rekordem; schemat
  `psa_osoby` (`server/migracje.js:54-84`) nie ma ograniczenia `UNIQUE` na `pesel` ani `nip`. Nagłówek
  ekranu kartoteki brzmi wprost: „Wspólna dla wszystkich prowadzonych rejestrów — jeden inwestor
  wpisywany raz” (widoczne na tym samym zrzucie) — zachowanie aplikacji jest sprzeczne z własną
  deklaracją wyświetlaną użytkownikowi.
- **Co powinno się stać:** przy zapisie osoby z numerem PESEL/NIP już obecnym w kartotece pod INNYM
  `id` aplikacja powinna co najmniej ostrzec pracownika (a docelowo zaproponować połączenie z
  istniejącym rekordem) — dokładnie to, co „regula domenowa nr 10” (jeden inwestor wpisywany raz)
  ma zapewniać. Podwójne kliknięcie/podwójne żądanie zapisu NOWEJ osoby bez żadnych danych
  identyfikujących (samo imię i nazwisko) powinno być co najmniej utrudnione (np. przez krótkie,
  serwerowe okno „ten sam autor, te same dane, ostatnie N sekund”), skoro UI i tak tylko blokuje
  przycisk lokalnie (`ustawZapisywanie`/`disabled` w `publiczne/js/osoby.js:151-164`) — ochrona
  wyłącznie po stronie przeglądarki nie jest ochroną (dwie karty, odświeżenie, retransmisja po
  zerwanym połączeniu — patrz Z-353).
- **Podstawa:** `CLAUDE-PSA.md` „Regula domenowa nr 10: jeden inwestor w wielu spółkach wpisywany
  RAZ” (cytowana wprost w nagłówku `server/trasy/osoby.js`); zasada techniczna z checklisty sesji
  („brak idempotencji — powtórz to samo żądanie zapisu dwa razy”, rozszerzona tu z formularza
  zgłoszenia (Z-004) na kartotekę osób).
- **Waga:** POWAŻNY (nie KRYTYCZNY — nie psuje samego rejestru zdarzeń ani bilansu akcji, ale
  bezpośrednio podważa zasadę „jeden inwestor wpisywany raz”, którą aplikacja sama deklaruje, i
  tworzy realne ryzyko rozjazdu danych AML/kontaktowych między dwoma „tożsamymi” wpisami tej samej
  osoby).

## Z-351 [POWAŻNY] — założenie sprawy (`POST /api/psa/sprawy`) nie ma żadnej ochrony przed
duplikatem: podwójne żądanie tworzy DWIE niezależne sprawy, każda z WŁASNYM biegnącym terminem
ustawowym 7 dni dla tego samego zdarzenia

- **Co zrobiłem:** wysłałem DWA kolejne, identyczne żądania `POST /api/psa/sprawy` (spółka #9, typ
  `zdarzenie_inne`, źródło „papier”, ten sam opis żądającego), bezpośrednio przez `curl`.
- **Co się stało:** powstały DWIE osobne sprawy — `RA/2026/0006` (id 8) i `RA/2026/0007` (id 9) —
  każda z własnym `numer`, własnym `data_wplywu` i (kluczowe) własnym, niezależnie liczonym
  `termin_do` na podstawie art. 300³⁴ § 1 KSH. Obie widoczne równolegle w „Kolejce spraw” (zrzut
  `testy-audyt/zrzuty/faza7/martwe-sprawy.png`, obie oznaczone „nowa”/„w weryfikacji”, „6 dz.”/
  „7 dz.”). Przyczyna: `POST /` w `server/trasy/sprawy.js:125-237` nie sprawdza w ogóle, czy dla tej
  samej spółki i tego samego typu zdarzenia nie istnieje już sprawa w toku — w przeciwieństwie do
  zgłoszenia wstępnego (`portal.js`), które (poza wadą współbieżności z Z-004) odsiewa duplikat po
  numerze KRS.
- **Co powinno się stać:** przynajmniej ostrzeżenie przy zakładaniu sprawy tego samego typu dla tej
  samej spółki, gdy inna sprawa tego typu jest już w toku (nie „wpisana”/„odmówiona”); w praktyce
  kancelaryjnej duplikat oznacza, że pracownik może przez pomyłkę wykonać wpis DWA razy dla tego
  samego zdarzenia (dwa niezależne zdarzenia w łańcuchu rejestru) albo nabić dwie opłaty za wpis za
  jedną czynność (patrz też FAZA 2, zestaw Z-100+, w zakresie samych kwot).
- **Podstawa:** zasada techniczna z checklisty sesji („brak idempotencji”); pośrednio art. 300³⁴ § 1
  KSH — dwa równoległe, „ustawowe” terminy 7-dniowe dla jednego rzeczywistego zdarzenia nie mają
  sensu i utrudniają nadzór nad tym, która sprawa jest tą „prawdziwą”.
- **Waga:** POWAŻNY (organizacyjne ryzyko podwójnego wpisu/podwójnej opłaty za tę samą czynność;
  nie narusza samo w sobie integralności już dokonanego wpisu, bo `dokonajWpisuSprawy` — patrz
  Z-352 — i tak dopuszcza wpis tylko raz PER sprawa).

## Z-352 [POZYTYWNE] — dokonanie wpisu (`POST /api/psa/sprawy/:id/wpisz`) JEST odporne na
dwa równoczesne żądania — w przeciwieństwie do Z-350/Z-351/Z-004

- **Co zrobiłem:** przygotowałem sprawę (#7, „przeniesienie” 10 akcji od Adama do Beaty, spółka
  #9) i przeprowadziłem ją do stanu „weryfikacja”, po czym wysłałem DWA ROWNOCZESNE (Promise.all)
  żądania `POST /api/psa/sprawy/7/wpisz` z identycznym ciałem
  (`testy-audyt/skrypty/faza7-race-wpisz.js`).
- **Co się stało:** pierwsze żądanie zwróciło `201` (zdarzenie #34 zapisane, sprawa → „wpisana”,
  naliczona dokładnie JEDNA opłata 100,00 zł za wpis, id 21). Drugie, wykonane RÓWNOCZEŚNIE, zwróciło
  `422`: „Wpisu można dokonać wyłącznie ze stanu „weryfikacja” (sprawa jest w stanie „wpisana”).” —
  żadnego drugiego zdarzenia ani drugiej opłaty. Przyczyna (potwierdzona czytaniem
  `server/rejestr.js:522-560`): `dokonajWpisuSprawy` odczytuje AKTUALNY stan sprawy i całą logikę
  wpisu wykonuje w JEDNEJ synchronicznej transakcji `better-sqlite3` — a że `better-sqlite3` działa
  synchronicznie w jednowątkowej pętli zdarzeń Node, drugie żądanie fizycznie nie może „wcisnąć się”
  w środek transakcji pierwszego, tylko czeka na jej zakończenie i widzi już zaktualizowany stan.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** zasada techniczna z checklisty sesji („brak idempotencji — powtórz to samo żądanie
  zapisu dwa razy”, tu: dwa RÓWNOCZESNE).
- **Waga:** POZYTYWNE. Zestawione z Z-350/Z-351 (żadnej ochrony) i Z-004 z FAZA 1 (ochrona
  niekompletna — podatna na współbieżność) pokazuje, że aplikacja ma TRZY różne poziomy odporności
  na duplikat zapisu w trzech różnych miejscach — wzorzec z tego endpointu (przeczytaj-i-sprawdź-
  -stan-WEWNĄTRZ-tej-samej-transakcji) powinien być powielony tam, gdzie go dziś brakuje.

## Z-353 [POWAŻNY] — zerwanie połączenia klienta W TRAKCIE zapisu nie przerywa zapisu po stronie
serwera — klient nie ma żadnego potwierdzenia, czy dane trafiły do bazy, mimo widocznego błędu

- **Co zrobiłem:** otworzyłem surowe połączenie TCP do serwera, wysłałem kompletne żądanie
  `POST /api/psa/osoby` (nagłówki + ciało JSON) i NATYCHMIAST po wysłaniu ostatniego bajtu
  zniszczyłem gniazdo (`socket.destroy()`) — PRZED odebraniem jakiejkolwiek odpowiedzi
  (`testy-audyt/skrypty/faza7-abort-socket.js`); osobno sprawdziłem też wariant z `AbortController`
  na `fetch` (`faza7-abort-polaczenia.js`), który jednak przerywa żądanie PRZED wysłaniem go do
  serwera i niczego nie dowodzi o zachowaniu backendu.
- **Co się stało:** mimo zerwania połączenia bez odebrania odpowiedzi, osoba „AbortSocket-<znacznik
  czasu>” TRAFIŁA do bazy — potwierdzone kolejnym żądaniem `GET /api/psa/osoby?q=AbortSocket...` po
  800 ms (rekord istnieje, widoczny też na zrzucie kartoteki jako „AbortSocket-1789678016880 X”).
  Klient w tym scenariuszu (np. użytkownik z niestabilnym łączem albo przeglądarka, która pokazuje
  błąd sieciowy i nic więcej) nie ma ŻADNEGO sposobu dowiedzieć się z samej odpowiedzi, że zapis się
  jednak powiódł — jedyna droga to ręczne odświeżenie i przeszukanie kartoteki.
- **Co powinno się stać:** to poprawne zachowanie z punktu widzenia integralności danych (żaden
  zapis nie jest przerywany w połowie — `better-sqlite3` kończy rozpoczętą, synchroniczną transakcję
  niezależnie od stanu gniazda klienta) — problemem NIE jest sam ten fakt, tylko jego ZESTAWIENIE z
  Z-350/Z-351: typowa reakcja użytkownika na „błąd sieci” („nie wiem czy wysłało, kliknę/wyślę
  jeszcze raz”) przy braku jakiejkolwiek deduplikacji po stronie serwera tworzy duplikat dokładnie
  tam, gdzie żadna ochrona (Z-350, Z-351) nie istnieje.
- **Podstawa:** zasada techniczna z checklisty sesji („optymistyczny interfejs — zerwij połączenie
  w trakcie zapisu i sprawdź, co pokazuje aplikacja i co jest w bazie”).
- **Waga:** POWAŻNY jako ZESTAWIENIE z Z-350/Z-351 (samo zjawisko w izolacji byłoby co najwyżej
  DROBNE — zapis jest poprawny i atomowy, brakuje tylko potwierdzenia dla klienta).

## Z-354 [POWAŻNY] — brak jakiegokolwiek limitu długości pola „nazwa” spółki (front-end, API,
baza) — nazwa 300-znakowa psuje układ pulpitu, listy spółek i kolejki spraw

- **Co zrobiłem:** utworzyłem spółkę testową #9 przez `POST /api/psa/spolki` z polem `nazwa`
  o długości dokładnie 300 znaków (powtórzony fragment tekstu), bez żadnego innego naruszenia
  walidacji (`sprawdzDaneSpolki`, `server/trasy/spolki.js:89-134`, nie sprawdza długości `nazwa` w
  ogóle), po czym obejrzałem wynik w przeglądarce (Playwright,
  `testy-audyt/skrypty/faza7-martwe-funkcje.js`).
- **Co się stało:** żądanie przeszło (`201`), kolumna `nazwa` w SQLite (`TEXT`, bez `CHECK`/
  ograniczenia długości) przyjęła całość. W UI nazwa łamie się na dosłownie KAŻDYM słowie (brak
  `text-overflow: ellipsis`/skracania) i zajmuje kilkanaście linii tam, gdzie inne wiersze zajmują
  jedną — potwierdzone trzema zrzutami: `testy-audyt/zrzuty/faza7/martwe-pulpit.png` (karta „Sprawy
  w toku” — jedna pozycja zajmuje tyle miejsca, co reszta listy razem wzięta, i psuje w ten sposób
  całą hierarchię wizualną pulpitu), `martwe-spolki.png` (wiersz tabeli spółek rozciągnięty na 8
  linii, sąsiednie kolumny — akcjonariusze/akcje/data — wizualnie oderwane od etykiety), oraz
  `martwe-sprawy.png` (kolejka spraw — dwie pozycje „Inne zdarzenie” z tą nazwą zajmują 4 linie
  każda).
- **Co powinno się stać:** limit długości pola `nazwa` (i prawdopodobnie analogicznych pól
  tekstowych — `ulica`, `miejscowosc`, `opis` itd., nie testowanych osobno) ustawiony na rozsądną
  wartość praktyczną (rzeczywiste firmy spółek prawa handlowego rzadko przekraczają 200 znaków) na
  poziomie walidacji API — a niezależnie od tego, komponent listy/tabeli powinien skracać zbyt długi
  tekst (`text-overflow: ellipsis`, `white-space: nowrap` + tytuł/tooltip z pełną nazwą), żeby
  pojedynczy rekord nie potrafił rozłożyć układu całego ekranu roboczego pracownika kancelarii.
- **Podstawa:** zasada techniczna z checklisty sesji („puste stany i przypadki brzegowe — nazwa
  spółki o długości 300 znaków”).
- **Waga:** POWAŻNY (nie psuje danych ani obliczeń — czysto wizualne — ale na ekranach ROBOCZYCH
  pracownika kancelarii, którymi są właśnie pulpit i kolejka spraw, praktycznie uniemożliwia szybkie
  zorientowanie się w kolejce przy jednej takiej spółce w bazie).

## Z-355 [POZYTYWNE] — puste stany (spółka bez żadnych zdarzeń/akcjonariuszy) są obsłużone
poprawnie na poziomie API i wygenerowanych dokumentów, bez błędów 500 ani placeholderów

- **Co zrobiłem:** utworzyłem spółkę #11 („Faza7 Pusta Spolka Testowa P.S.A.”) i, PRZED wpisaniem
  do niej jakiegokolwiek zdarzenia, sprawdziłem: (1) `GET /api/psa/spolki/11` (kokpit), (2)
  `POST /api/psa/spolki/11/dokumenty/08/podglad` (dokument „Lista akcjonariuszy do sądu”, wzór
  wprost wymieniający akcjonariuszy).
- **Co się stało:** (1) `200`, `liczba_zdarzen: 0`, `akcjonariusze: []`, `bilans: []` — żadnego
  wyjątku. Na liście spółek (zrzut `martwe-spolki.png`) wiersz tej spółki poprawnie pokazuje same
  zera i myślnik zamiast daty ostatniego zdarzenia. (2) dokument wygenerował się poprawnie: tabela
  akcjonariuszy jest pusta, a treść wprost stwierdza „Łączna liczba akcji: 0.” — bez śladu `{{`,
  `undefined`, `null`, `NaN` ani `Invalid Date`; pola niedostępne dla tej spółki (adres, NIP) są
  poprawnie zgłoszone w osobnej liście `brakujace`, zgodnie ze wzorcem opisanym pozytywnie w FAZA 1
  (Z-007 dotyczy TYLKO pola „sposób reprezentacji”, reszta mechanizmu działa poprawnie).
- **Podstawa:** zasada techniczna z checklisty sesji („puste stany i przypadki brzegowe — spółka
  bez akcjonariuszy”; „wygenerowane dokumenty mają wypełnione wszystkie pola — poszukaj `{{`,
  `undefined`, `null`, `NaN`, `Invalid Date`”).
- **Waga:** POZYTYWNE.

## Z-356 [POZYTYWNE] — niepowodzenie wysyłki e-mail nigdy nie ginie po cichu: sprawdzone
systematycznie we WSZYSTKICH miejscach wywołania, wynik zawsze trafia do pracownika

- **Co zrobiłem:** przejrzałem WSZYSTKIE miejsca w kodzie serwera wywołujące `poczta.wyslij()`
  (`server/poczta.js` — środowisko audytu nie ma skonfigurowanego SMTP, więc każda próba realnie
  zwraca `wyslano:false` z powodem, zgodnie z ustaleniem FAZA 1) i dla każdego sprawdziłem, czy
  odpowiedź API niesie ten wynik dalej, oraz czy front-end go wyświetla: zgłoszenia portalowe
  (`server/logika/zaproszenia.js`, `publiczne/js/zgloszenia.js:35`), dokumenty wniosku
  (`server/trasy/wnioski.js:372`, `publiczne/js/wnioski.js:1242-1243`), zawiadomienia o wpisie i
  powiadomienia przed wpisem (`server/zawiadomienia.js`, `publiczne/js/sprawy.js:453,484-485,1040`),
  przypomnienia o odnowieniu (`server/logika/przypomnienia.js`, `publiczne/js/oplaty.js:283-341`) —
  potwierdziłem też empirycznie krok „wstrzymaj sprawę” (wysyła próbę powiadomienia), gdzie
  odpowiedź API niosła `wysylka: {wyslano:false, powod:"Odbiorca nie ma adresu e-mail w
  kartotece..."}`.
- **Co się stało:** w KAŻDYM sprawdzonym miejscu funkcja `poczta.wyslij` zwraca `{wyslano, powod}`
  (nigdy nie rzuca wyjątku przy braku SMTP — `server/poczta.js:41-64`), backend przekazuje ten wynik
  w odpowiedzi API pod jawnym kluczem, a front-end w każdym z wymienionych miejsc renderuje go
  pracownikowi jako `Komunikat` (ostrzeżenie/informację), nie tylko loguje po stronie serwera. Nie
  znalazłem ANI JEDNEGO miejsca, w którym wynik wysyłki byłby odczytany i odrzucony bez wyświetlenia.
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** zasada techniczna z checklisty sesji („czy niepowodzenie wysyłki jest widoczne dla
  pracownika, czy ginie po cichu”).
- **Waga:** POZYTYWNE.

## Z-357 [DROBNY] — przypomnienia o kończącym się roku prowadzenia rejestru nie mają żadnego
automatycznego wyzwalacza (cron/zadanie cykliczne) — działają wyłącznie po ręcznym kliknięciu

- **Co zrobiłem:** przeszukałem kod serwera (`serwer.js`, `server/logika/przypomnienia.js`) pod
  kątem `setInterval`/harmonogramu/`node-cron` wywołującego `wyslijPrzypomnienia`, oraz sprawdziłem
  jedyne miejsce jej wywołania: `server/trasy/oplaty.js:169-185` (`POST
  /api/psa/oplaty/przypomnienia`), z frontendowym przyciskiem „Wyślij przypomnienia”
  (`publiczne/js/oplaty.js:320-322`, widoczny na `martwe-oplaty.png` tylko gdy `do_odnowienia.length
  > 0`).
- **Co się stało:** funkcja jest kompletna i poprawnie zaimplementowana (idempotentna po
  `psa_oplaty`, jak głosi jej własny komentarz), ale istnieje WYŁĄCZNIE jako akcja ręczna — sam kod
  to przyznaje wprost: „Uruchamiane ręcznie przez pracownika; docelowo może je wołać zadanie
  cykliczne” (`server/trasy/oplaty.js:166-167`). Żaden mechanizm w repozytorium (skrypt `cron`,
  `setInterval`, zewnętrzny harmonogram) faktycznie tego nie robi. Jeśli żaden pracownik nie
  otworzy zakładki „Opłaty” i nie kliknie przycisku w oknie 30 dni przed końcem okresu, przypomnienie
  po prostu nigdy nie pójdzie, mimo że UI sugeruje istnienie „procesu” przypomnień (sekcja „Kończy
  się rok prowadzenia rejestru” na tym samym ekranie i tak pokazuje ostrzeżenie — ale tylko komuś,
  kto akurat wszedł w zakładkę „Opłaty”).
- **Co powinno się stać:** albo faktyczne zadanie cykliczne (poza zakresem tego audytu — zmiana
  kodu), albo przynajmniej wystawienie tego samego ostrzeżenia w widoczniejszym miejscu (pulpit
  główny), skoro dziś zależy ono od tego, czy ktoś akurat otworzy zakładkę rozliczeń.
- **Podstawa:** zasada techniczna z checklisty sesji („terminy — czy da się to pominąć niezauważone”
  w duchu; nie jest to termin ustawowy z `PRZEPISY-PSA.md`, tylko wewnętrzny proces biznesowy
  kancelarii, stąd waga DROBNY, nie POWAŻNY).
- **Waga:** DROBNY.

## Z-358 [POZYTYWNE, potwierdzone zachowaniem API, nie tylko czytaniem kodu] — termin ustawowy
7 dni liczony jest w dniach KALENDARZOWYCH, a wznowienie po usunięciu przeszkody uruchamia PEŁNY,
NOWY bieg 7 dni od dnia wznowienia — zgodnie dosłownie z art. 300³⁴ § 1 zd. 2

- **Co zrobiłem:** założyłem sprawę (#8, spółka #9), przeprowadziłem `PATCH .../8 {akcja:
  "weryfikuj"}`, potem `{akcja: "wstrzymaj"}`, odczekałem (upływ czasu rzeczywistego pomiędzy
  wywołaniami — sesja przerwana i wznowiona następnego dnia kalendarzowego), po czym wykonałem
  `{akcja: "wznow"}` i porównałem `termin_do` przed wstrzymaniem i po wznowieniu.
- **Co się stało:** przed wstrzymaniem `termin_do = 2026-09-24` (7 dni kalendarzowych od
  `data_wplywu` 17.09). Po wstrzymaniu: `termin_do: null`, `zamrozony: true` (zegar zatrzymany, nie
  tylko wizualnie — `policzTermin` w ogóle nie liczy dni w tym stanie,
  `server/logika/terminy.js:78-90`). Po wznowieniu NASTĘPNEGO DNIA KALENDARZOWEGO (18.09):
  `wznowiona_od: "2026-09-18"`, nowy `termin_do: "2026-09-25"` — czyli PEŁNE, NOWE 7 dni liczone OD
  DNIA WZNOWIENIA, nie kontynuacja pozostałych dni sprzed wstrzymania. Moduł liczy dni kalendarzowo
  (`dodajDni` operuje na `Date.UTC` czystych dat, bez składnika czasu/strefy — brak podatności na
  zmianę czasu letni/zimowy, bo obliczenia nigdy nie schodzą do rozdzielczości godzinowej).
- **Co powinno się stać:** dokładnie to, co się stało — interpretacja jest zgodna z dosłownym
  brzmieniem `PRZEPISY-PSA.md` art. 300³⁴ § 1 zd. 2 („Jeżeli dokonanie wpisu wymaga usunięcia
  przeszkody, wpis powinien być dokonany w terminie siedmiu dni **od dnia jej usunięcia**” — nie:
  „w pozostałym z pierwotnych siedmiu dni terminie”). Komentarz w kodzie
  (`server/logika/terminy.js:6-11`) świadomie odrzuca alternatywną interpretację „zaliczenia części
  terminu” i uzasadnia to tym samym cytatem.
- **Podstawa:** `PRZEPISY-PSA.md` art. 300³⁴ § 1 zd. 2 (oznaczenie 🟢 — jednostka niesporna).
- **Waga:** POZYTYWNE.

## Z-359 [DROBNY/do potwierdzenia — patrz PYTANIE P-015] — brak jakiegokolwiek mechanizmu
oznaczania rekordów jako dane testowe/demonstracyjne w CAŁEJ bazie (poza wąskim wyjątkiem
niezwiązanym z tym celem)

- **Co zrobiłem:** przeszukałem `server/migracje.js` (cały schemat) pod kątem kolumn typu
  `jest_testowy`/`is_demo`/`tryb_testowy`/`srodowisko` na tabelach `psa_spolki`, `psa_osoby`,
  `psa_zdarzenia`, `psa_wnioski`, `psa_oplaty`, `psa_zgloszenia`.
- **Co się stało:** jedyne trafienie to `psa_platnosci.tryb_testowy` (migracja 42) — kolumna
  dotyczy WYŁĄCZNIE odróżnienia powiadomienia z PIASKOWNICY operatora płatności Tpay od prawdziwej
  transakcji (komentarz wprost: „Powiadomienie z piaskownicy NIGDY nie księguje płatności
  produkcyjnej”) — nie ma nic wspólnego z oznaczaniem SPÓŁEK, OSÓB czy ZDARZEŃ jako demo/testowych.
  Poza tym wyjątkiem baza nie ma ŻADNEGO pola pozwalającego odróżnić rekord założony „na serio” od
  rekordu założonego w toku demonstracji, szkolenia pracownika albo — jak w niniejszej sesji audytu —
  testów samej aplikacji. Potwierdza to również FAZA 0 (brak automatycznego seedowania) — łącznie
  oznacza to, że KAŻDY rekord w bazie produkcyjnej (spółka, osoba, zdarzenie, opłata) wygląda
  identycznie niezależnie od tego, czy powstał z prawdziwej sprawy klienta, czy z testu/demonstracji
  pracownika kancelarii na koncie produkcyjnym.
- **Co powinno się stać:** to nie jest błąd logiki, tylko brak funkcji — zależy od decyzji, czy
  kancelaria w ogóle planuje testować/demonstrować aplikację NA KONCIE PRODUKCYJNYM (jeśli
  testowanie zawsze odbywa się na osobnej instancji/bazie, jak w tej sesji audytu, brak takiego
  mechanizmu nie jest problemem). Zapisane jako pytanie do Łukasza — P-015 w
  `testy-audyt/PYTANIA-DO-LUKASZA.md`.
- **Podstawa:** zasada techniczna z checklisty sesji („dane demonstracyjne — czy w bazie zostały
  rekordy testowe i czy da się je łatwo odróżnić od prawdziwych”).
- **Waga:** DROBNY (ryzyko organizacyjne, nie naruszenie przepisu — staje się POWAŻNE wyłącznie
  jeśli kancelaria faktycznie zamierza testować na koncie/bazie produkcyjnej; patrz pytanie).

## Z-360 — `npm audit` w głównym repozytorium: 1 podatność KRYTYCZNA, 3 WYSOKIE, 3 ŚREDNIE w
zależnościach produkcyjnych; wszystkie zależności zadeklarowane zakresowo (`^`), żadna nie
przypięta do dokładnej wersji

- **Co zrobiłem:** `cd /home/user/Proste-Spolki-Akcyjne && npm audit` (bez `--fix`, zgodnie z
  zasadami sesji — tylko odczyt), oraz przegląd `package.json` (sekcja `dependencies`).
- **Co się stało:** `npm audit` zgłasza **7 podatności** w zależnościach produkcyjnych (192 pakiety
  w drzewie `prod`): **1 KRYTYCZNA** (`tar` — pociągnięta tranzytywnie przez `@mapbox/node-pre-gyp` ←
  `bcrypt`; m.in. „Decompression/parse DoS via unlimited input”, plus kilkanaście innych wpisów
  ścieżki przejścia przez symlinki/hardlinki), **3 WYSOKIE** (`bcrypt` 5.0.1–5.1.1 przez
  `@mapbox/node-pre-gyp`; `@mapbox/node-pre-gyp` samo; `nodemailer` — m.in. „Quadratic time complexity
  w addressparser” i „Message-level raw option bypasses disableFileAccess/disableUrlAccess,
  enabling arbitrary file read and full-response SSRF”), **3 ŚREDNIE** (`express`/`body-parser` przez
  `qs`; `qs` samo — DoS przez `Attacker Controlled isBuffer`). Poprawka dostępna dla wszystkich poza
  wymagającą podniesienia wersji głównej (`bcrypt` → 6.0.0, zmiana niezgodna wstecznie —
  `isSemVerMajor: true`). Wszystkie zależności w `package.json` są zadeklarowane z `^` (zakres, np.
  `"express": "^4.21.2"`) — żadna nie jest przypięta do dokładnej wersji ani przez `package.json`,
  ani przez politykę `package-lock.json` (lockfile istnieje i przypina faktycznie zainstalowane
  wersje na tę chwilę, ale nic nie stoi na przeszkodzie, by kolejny `npm install` bez modyfikacji
  `package.json` podniósł wersję w ramach tego samego zakresu `^`, wraz z nowymi podatnościami albo
  ich brakiem — zależy od momentu instalacji, nie jest to odtwarzalne).
- **Co powinno się stać:** nie proponuję poprawki (zero zmian w `package.json`/`package-lock.json`
  zgodnie z zasadami sesji) — odnotowuję stan i przekazuję Łukaszowi/zespołowi wdrożeniowemu decyzję
  o aktualizacji `bcrypt` do wersji głównej 6 (wymaga testu regresji uwierzytelniania) oraz
  pozostałych, mniejszych aktualizacji.
- **Podstawa:** zasada techniczna z checklisty sesji („zależności — `npm audit`, wersje przypięte
  czy zakresowe”).
- **Waga:** POWAŻNY jako pozycja do decyzji (podatność KRYTYCZNA i WYSOKIE dotyczą pakietów
  faktycznie używanych w ścieżce krytycznej — hashowanie haseł `bcrypt`, wysyłka e-mail
  `nodemailer` — nie są to podatności dev-only; nie stwierdzam samodzielnie, czy są PRAKTYCZNIE
  wykorzystywalne w kontekście tej aplikacji, np. `tar`/`node-pre-gyp` działają wyłącznie przy
  budowaniu natywnego modułu `bcrypt`, nie w runtime serwera — stąd waga „do decyzji”, nie
  automatyczne KRYTYCZNY).

## Z-361 [POZYTYWNE] — walidacja przypadków brzegowych liczby akcji/ceny emisyjnej/dat działa
poprawnie NA SERWERZE, niezależnie od front-endu, we wszystkich sprawdzonych wariantach

- **Co zrobiłem:** bezpośrednimi żądaniami `POST /api/psa/spolki/9/zdarzenia/podglad` (z pominięciem
  formularza kreatora) sprawdziłem: liczbę akcji emisji ujemną (`-5`), tekstową (`"dziesiec"`) i
  zerową (`0`); cenę emisyjną ujemną (`-100`), tekstową (`"tania"`) i niecałkowitą (`10.5` grosza);
  datę zdarzenia z przyszłości (`2099-01-01`); emisję bez pola `seria`. Osobno: numer KRS o złej
  długości/formacie przy zakładaniu spółki (litery, 9 i 11 cyfr) oraz nieznany status spółki.
  Osobno: nazwisko z apostrofem i polskimi znakami diakrytycznymi („O'Konieczny-Żółć Łukasz”),
  zweryfikowane też w wygenerowanym dokumencie „Lista akcjonariuszy” (rozdział Z-355) — wyrenderowane
  poprawnie, bez uszkodzenia kodowania czy struktury dokumentu.
- **Co się stało:** WSZYSTKIE warianty liczbowe/datowe zostały poprawnie odrzucone z czytelnym
  komunikatem po polsku (`dopuszczalne: false`, konkretny `bledy[]`) — żaden nie przeszedł mimo że
  są to dokładnie te wartości, które typowy formularz HTML (`type="number"`, `min="1"`,
  `type="date"`) i tak by odrzucił PO STRONIE PRZEGLĄDARKI; tu potwierdzone, że identyczna blokada
  istnieje NIEZALEŻNIE na serwerze (`server/logika/walidacje.js`, `server/logika/kreator.js`).
  Zły numer KRS/status spółki: odrzucone (400) z cytowanym formatem oczekiwanym. Apostrof/znaki
  polskie: brak jakiegokolwiek problemu z kodowaniem na żadnym z przetestowanych etapów (zapis,
  odczyt z kartoteki, treść wygenerowanego dokumentu).
- **Co powinno się stać:** dokładnie to, co się stało.
- **Podstawa:** zasada techniczna z checklisty sesji („walidacja wyłącznie po stronie przeglądarki —
  wyślij do API dane odrzucane przez formularz”).
- **Waga:** POZYTYWNE.
