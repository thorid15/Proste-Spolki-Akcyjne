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
