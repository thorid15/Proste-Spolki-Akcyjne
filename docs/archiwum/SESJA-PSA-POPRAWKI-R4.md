# SESJA-PSA-POPRAWKI-R4 — poprawki po przeglądzie w trybie testowym (1.11.2026)

> **Dla Claude Code:** wykonuj zadanie po zadaniu (superpowers:executing-plans, tryb natywny — jedna sesja, przegląd kodu raz na końcu fazy 2). Kroki odhaczaj `- [x]`. Po każdej fazie **STOP** — czekasz na akceptację Łukasza.

**Cel:** wdrożyć poprawki rundy czwartej (portal P1–P8, kancelaria K1–K5), a po decyzjach D-089–D-091 — nowy przebieg zbycia akcji.
**Źródła:** zapis „Poprawki — runda czwarta (1.11.2026)” (dalej: ZAPIS; jeśli nie ma go w repo, Łukasz dołącza go do sesji) + ten plik. Zadanie K5 to uzupełnienie Łukasza spoza ZAPISU.
**Stos:** jak w repo. Testy `npm test`, scenariusz `npm run scenariusz:testowy`.

## Skille

- superpowers:executing-plans — przebieg; superpowers:test-driven-development — każda zmiana zachowania zaczyna się od czerwonego testu; superpowers:systematic-debugging — P7 (najpierw odtworzenie i przyczyna, potem poprawka); superpowers:verification-before-completion — przed każdym „gotowe”; superpowers:requesting-code-review — raz, po fazie 2.
- frontend-design — P1–P5, K1, K2: wyłącznie dyscyplina i spójność z obecnym wyglądem (istniejące zmienne CSS, kolory, typografia; żadnej nowej identyfikacji). Przed STOP obejrzyj zrzuty i usuń jeden zbędny element z każdego poprawianego ekranu, jeśli się da.
- ux-copy — tylko teksty, których ten plik nie podaje. Teksty podane w cudzysłowie są wiążące.
- accessibility-review — zrzuty 390 px po fazie 1 (kontrast, cel dotyku ≥ 44 px, widoczny fokus).
- Brak skilla → pracuj bez niego, nie instaluj.

## Ograniczenia globalne

1. Treść prawna wyłącznie z `PRZEPISY-PSA.md`. Brak przepisu → nie wprowadzasz reguły, zgłaszasz.
2. Tabela zdarzeń rejestru jest append-only z łańcuchem SHA-256: żadnej edycji, usuwania ani migracji przepisującej zdarzenia.
3. Wyłącznie tryb testowy i dane fikcyjne (zrzuty i logi trafiają do modelu).
4. Checklisty weryfikacji zaznacza człowiek; system blokuje tylko to, co na pewno niespełnione.
5. „Stan na” — tylko dzień. Podpisy: kwalifikowany, zaufany, osobisty albo oryginał pocztą; skany odrzucane.
6. Każda zmiana zachowania → wpis w `DECYZJE.md` (kolejne numery od D-092; K5 = D-092).
7. Domyślne rozstrzygnięcia przyjęte w tym pliku są oznaczone **[domyślne]** — wpisz je do `DECYZJE.md` jako „do potwierdzenia przez Łukasza”.
8. Przed każdym STOP: `npm test` (0 błędów, podaj liczbę testów przed/po), `npm run scenariusz:testowy`, zrzuty: portal 390 px i 1440 px, kancelaria 1440 px.

## Na co uważać (każdy punkt ma test w swoim zadaniu)

1. K3: list-powiadomienie już nadany → usunięcie niedostępne (409); usunięcie nienadanego przywraca blokadę wpisu.
2. P7: ponowne złożenie oświadczenia po cofnięciu nie tworzy drugiego aktywnego oświadczenia tego samego rodzaju.
3. K5: osoba bez adresu e-mail, a z historyczną zgodą → znacznik „list” (liczy się stan bieżący, nie historia).
4. P6: konto z wnioskiem w toku (nieprzyjętym) dalej dokończy swój wniosek; 403 dotyczy tylko zakładania nowego przy przyjętym wniosku.
5. K4: seria z bardzo długim zakresem numerów (np. „000001–999999, 1000001–1000005”) zawija się w komórce, nie wychodzi poza margines.

---

## Faza 0 — narzędzie zrzutów i kontroli układu

### Zadanie 0
**Pliki:** `tests/e2e/pomocnicze/uklad.js`, `tests/e2e/zrzuty.spec.js`, `package.json` (skrypt `zrzuty`).
- [ ] Jeśli w repo nie ma Playwrighta — dodaj `@playwright/test` jako devDependency (tylko Chromium).
- [ ] Sprawdź tryb testowy przed startem (flaga/endpoint trybu testowego, wysyłka e-mail na atrapę). Bez trybu testowego skrypt kończy się błędem.
- [ ] `sprawdzUklad(page, selektorKontenera) -> Promise<Array<{selektor, problem}>>`: zgłasza (a) poziomy scroll dokumentu, (b) element tekstowy z `scrollWidth > clientWidth + 1` (bez celowo przewijanych), (c) element wychodzący poza obszar treści karty (prostokąt karty minus padding).
- [ ] `npm run zrzuty` → `tests/e2e/zrzuty/<ekran>-<szerokość>.png` dla ekranów z tego pliku, 390 i 1440 px.
- [ ] Test: na celowo zepsutej stronie testowej `sprawdzUklad` zwraca ≥ 1 problem; na poprawnej — `[]`.

Narzędzie zostaje w repo — używa go też sesja ANALIZA-PRZEPLYWOW.

## Faza 1 — wizualne i tekstowe (P1–P5, K4, K1)

### Zadanie 1 — P1 „Dane spółki”
**Pliki:** `publiczne/js/portal.js` (zakładka Rejestr), style portalu.
- [ ] Karta używa tego samego kontenera i marginesu wewnętrznego co pozostałe karty (istniejąca zmienna, nie nowa wartość).
- [ ] Wspólny komponent `ListaDanych(pary)` (użyty też w K2): siatka `minmax(7rem, 40%) 1fr`, odstęp kolumn ≥ 0,75rem, etykiety zawijane, bez ucinania; poniżej 420 px etykieta nad wartością.
- [ ] Test: `sprawdzUklad` na karcie „Dane spółki” przy 390 px → `[]`.

### Zadanie 2 — P2 „Do zapłaty” + baner kroku wniosku
**Pliki:** `portal.js` (`pozycjeDoZrobieniaPortal` ok. l. 913, 1028).
- [ ] `pozycjeDoZaplatyPortal(stan) -> Array<{idOplaty, opis, kwotaBrutto}>` — tylko nieopłacone. Karta „Do zapłaty”, każdy wiersz z przyciskiem „Zapłać”. Brak pozycji → karta się nie pokazuje **[domyślne]**.
- [ ] `banerKrokuWniosku(stan) -> {tekst, akcja} | null` — jeden baner na Start nad kartami, z jednym przyciskiem bieżącego kroku (np. „Podpisz dokumenty”).
- [ ] Testy: tylko nieopłacone; `[]` gdy wszystko opłacone; baner „Podpisz dokumenty” przy wniosku czekającym na podpis; `null` przy wniosku przyjętym.

### Zadanie 3 — P3 i P4
**Pliki:** `portal.js` (ok. l. 1243).
- [ ] „Zgłoś błąd we wpisie” = przycisk drugorzędny w karcie z „Zamów informację z rejestru”, w jednym rzędzie; na 390 px oba na pełną szerokość, główny wyżej.
- [ ] Komunikat dokładnie: „Stan akcjonariatu (akcjonariusze, akcje, obciążenia) jest dostępny w pełnej informacji z rejestru akcjonariuszy.” — przycisk pod spodem bez zmian.

### Zadanie 4 — P5 „Stan na dzień”
**Pliki:** `portal.js` (ok. l. 1718), komponent `PoleDaty`.
- [ ] Szerokość jak pozostałe pola dat; ikona kalendarza obok pola. Zmiana w `PoleDaty`, więc obejmuje wszystkie pola dat (zamierzone — jeden wzorzec).
- [ ] Test: `sprawdzUklad` na formularzu zamówienia informacji → `[]`; szerokość pola ≤ szerokość innego pola daty.

### Zadanie 5 — K4 PDF „Emisje i serie akcji”
**Pliki:** `server/logika/informacja-dokument.js` (ok. l. 589–642).
- [ ] `szerokosciKolumnEmisji(kolumny, dostepnaSzerokosc) -> number[]` — suma ≤ dostępna szerokość; kolumna numerów zawija po przecinkach i myślnikach; czcionka tabeli o 1 pt mniejsza od tekstu (min. 8 pt); przy więcej niż 5 kolumnach układ pionowy (blok na serię: etykieta — wartość).
- [ ] Testy: suma szerokości ≤ dostępna; PDF z 3 seriami i długim zakresem (Na co uważać pkt 5) generuje się bez wyjątku. Strona PDF jako PNG do zrzutów STOP.

### Zadanie 6 — K1 układ sprawy (bez zmiany przebiegu)
**Pliki:** `publiczne/js/sprawy.js`, `publiczne/js/kreator.js`, style.
- [ ] `KolumnaSprawy` — wszystkie karty i kroki tej samej szerokości: 48rem na komputerze, pełna szerokość minus 16 px marginesów na telefonie **[domyślne]**.
- [ ] `PasekAkcji(akcje)` — jeden pasek na sprawę: wyrównanie do prawej, jeden przycisk główny (skrajny prawy), drugorzędne po lewej; na 390 px w pionie, główny na górze. „Popraw podstawę wpisu” i „Wystaw żądanie wpisu” trafiają do paska jako drugorzędne (bez luźnych linków, bez pełnej szerokości).
- [ ] Pole zgody = zwykły checkbox w siatce formularza.
- [ ] `nazwaPlikuDoWyswietlenia({nazwaOryginalna, rodzaj, data}) -> string` — nazwa oryginalna, a gdy brak: `<rodzaj>-<RRRR-MM-DD>.pdf`. UUID nigdy w UI (sprawy, kartoteka, portal).
- [ ] `KolumnaSprawy` i `PasekAkcji` budujesz tak, by faza 3 (nowy przebieg zbycia) użyła ich bez przeróbek.
- [ ] Testy: `nazwaPlikuDoWyswietlenia` bez UUID; `sprawdzUklad` na sprawie przeniesienia przy 1440 i 390 px → `[]`.

**STOP 1** — zrzuty przed/po (P1–P5, K1, strona PDF z K4), wynik accessibility-review, liczba testów.

## Faza 2 — zachowanie (kolejność: K5 → P7 → P8 → P6 → K3 → K2)

### Zadanie 7 — K5 oświadczenia osób poza rejestrem + znacznik (D-092)
Decyzja Łukasza (1.11.2026): złożenie i cofnięcie zgody (na komunikację e-mail, na powiadomienia automatyczne) nie jest informacją w rejestrze ani w informacji z rejestru. To dane kartoteki osoby. Przy każdej czynności z udziałem osoby bez zgody system to sygnalizuje.
- [ ] Inwentaryzacja: gdzie oświadczenia są zapisywane i pokazywane (zdarzenia rejestru, `informacja-dokument.js`, zakładka Rejestr w portalu, sprawy, kartoteka). Lista w raporcie.
- [ ] Przeczytaj art. 300³³ § 1 w `PRZEPISY-PSA.md`. Jeśli katalog obejmuje adres e-mail akcjonariusza pod warunkiem zgody → w informacji z rejestru pokazuj tylko adres (gdy zgoda aktywna), bez żadnej pozycji o zgodzie lub jej cofnięciu; cofnięcie = adres znika z danych, bez opłaty (D-083). Jeśli katalog go nie obejmuje → adres w ogóle nie trafia do informacji. Wynik i przepis wpisz do D-092.
- [ ] Historyczne zdarzenia o zgodach w łańcuchu: nie ruszasz, wykluczasz je z widoku rejestru i z informacji filtrem po typie. Jeśli istnieją w bazie innej niż testowa → STOP z liczbą zdarzeń i propozycją.
- [ ] Jedno źródło stanu: `stanOswiadczen(osobaId) -> {zgodaEmail: boolean, powiadomieniaAutomatyczne: boolean, email: string|null, zmieniono: data}`; historia zmian (data, źródło: portal / kancelaria / pismo, kto) w kartotece — istniejąca tabela albo nowa, poza łańcuchem rejestru.
- [ ] `ZnacznikKontaktu(osoba)` — gdy brak zgody na e-mail albo brak adresu: „Brak zgody — konieczne powiadomienie listem”; podpowiedź: „Osoba nie wyraziła zgody na komunikację e-mail. Powiadomienie o zamiarze wpisu i zawiadomienie o dokonanym wpisie zostaną wysłane listem.” Przy zgodzie — nic (bez pozytywnego znacznika). Pokazuj: przy wyborze osoby w kreatorze (zbywca, nabywca, żądający), przy uczestnikach w nagłówku sprawy, na liście akcjonariuszy spółki, w kartotece, w kolejce listów (jako przyczyna listu).
- [ ] Testy: informacja z rejestru (tekst PDF i portal) dla osoby z cofniętą zgodą nie zawiera „zgod” ani „cofn” (bez rozróżniania wielkości liter); cofnięcie zgody nie zmienia liczby zdarzeń rejestru ani opłat; `stanOswiadczen` po cofnięciu → `zgodaEmail: false`; kreator przeniesienia ze zbywcą bez zgody pokazuje tekst znacznika; osoba bez adresu z historyczną zgodą → znacznik.

### Zadanie 8 — P7 ponowne oświadczenie po cofnięciu
**Pliki:** `portal.js` („Moje oświadczenia”, ok. l. 1998), `server/trasy/portal.js` (`/oswiadczenia`).
- [ ] Odtwórz w teście: złożenie → cofnięcie → ponowne złożenie (zgoda e-mail i powiadomienia automatyczne). Najpierw przyczyna (systematic-debugging), potem poprawka.
- [ ] Testy: ponowne złożenie → 200 i stan aktywny; jedno aktywne oświadczenie na rodzaj; checkbox znów dostępny, dopóki konto aktywne.

### Zadanie 9 — P8 ostrzeżenie przed cofnięciem zgody na e-mail
- [ ] Istniejący komponent okna potwierdzenia. Tytuł: „Cofnąć zgodę na e-mail?” Treść: „Bez zgody na e-mail postępowanie potrwa dłużej: powiadomienie o zamiarze wpisu i zawiadomienie o dokonanym wpisie wyślemy listem, a dostęp do portalu wygaśnie.” Przyciski: „Zostaw zgodę” (domyślny, z fokusem; Esc = to samo) i „Cofam zgodę”.
- [ ] Testy: „Zostaw zgodę” → brak żądania do API; „Cofam zgodę” → jedno żądanie.

### Zadanie 10 — P6 bez nowej spółki w tym samym logowaniu
**Pliki:** `portal.js` (ok. l. 866), `server/trasy/portal.js` (`/wniosek/nowy`), testy.
- [ ] Usuń „nowy wniosek” z konta z przyjętym wnioskiem. `POST /portal/wniosek/nowy` → 403, JSON `{ "blad": "Każdą spółkę zgłasza się osobno. Aby dodać kolejną spółkę, wypełnij zgłoszenie na stronie rejestru." }`.
- [ ] Testy: 403 przy przyjętym wniosku; konto z wnioskiem w toku nadal zapisuje i wysyła swój wniosek.

### Zadanie 11 — K3 „Usuń z wysyłki”
**Pliki:** `server/listy.js`, `server/trasy/listy.js`, `publiczne/js/listy.js`, migracja.
- [ ] Status `usuniety` + `powod` (wymagany, min. 5 znaków), `kto`, `kiedy`. `POST /listy/:id/usun-z-wysylki {powod}`. Pismo zostaje (bez fizycznego kasowania), wpis w historii.
- [ ] Po nadaniu → 409 „List został nadany — nie można go usunąć z wysyłki.”
- [ ] Usunięty list był powiadomieniem przed wpisem → sprawa wraca do stanu „bez powiadomienia”, „Dokonaj wpisu” zablokowane.
- [ ] UI: „Usuń z wysyłki” przy każdym nienadanym liście → okno z polem „Powód”.
- [ ] Testy: przed nadaniem → `usuniety`, plik istnieje; po nadaniu → 409; usunięcie powiadomienia → wpis zablokowany.

### Zadanie 12 — K2 kartoteka osoby w jednym widoku
**Pliki:** `publiczne/js/osoby.js` (kafelek „Sprawy” ok. l. 638).
- [ ] Jeden widok, sekcje w kolejności: Identyfikacja → Adresy → Kontakt i oświadczenia (`stanOswiadczen` + `ZnacznikKontaktu`, data ostatniej zmiany, historia rozwijana) → AML → Akcje w spółkach (spółka, liczba, seria) → Sprawy (data, typ, spółka, status; 5 ostatnich + „Pokaż wszystkie”). Usuń osobny kafelek „Sprawy”. „Edytuj” po prawej w nagłówku.
- [ ] Wszystkie sekcje na `ListaDanych` z zadania 1.
- [ ] Test: `sprawdzUklad` kartoteki przy 1440 i 390 px → `[]`.

**STOP 2** — superpowers:requesting-code-review na całą fazę 2, zrzuty, wpisy w `DECYZJE.md`, liczba testów.

## Faza 3 — po decyzjach D-089, D-090, D-091

Wykonujesz tylko te zadania, których decyzja jest w `DECYZJE.md` jako przyjęta. Brak decyzji → pomijasz i opisujesz w raporcie.

### Zadanie 13 — D-089 pokrycie akcji
- [ ] Pokrycie nie blokuje otwarcia rejestru; stan domyślny „brak informacji o pełnym pokryciu”.
- [ ] Wpis „Akcje pokryte w całości” na podstawie uchwały zarządu (art. 300⁹ § 2 KSH) — bezpłatny (D-083), tym samym kreatorem co inne wpisy.
- [ ] Przy zbyciu akcji bez pełnego pokrycia kreator pokazuje pole „zgoda spółki” (art. 300⁴⁰ § 1) i informację o solidarnej odpowiedzialności nabywcy (art. 300⁴⁰ § 3). Treść przepisów z `PRZEPISY-PSA.md`.
- [ ] Testy: otwarcie bez danych o pokryciu przechodzi; zbycie niepokrytych bez zgody spółki → walidacja jak dotąd; wpis pokrycia nie tworzy opłaty.

### Zadanie 14 — D-090 domyślnie powiadomienie
- [ ] Bez pytania o zgodę: ścieżką domyślną jest powiadomienie (e-mail przy zgodzie, inaczej list — `ZnacznikKontaktu`). Zgoda na wpis = jeden opcjonalny checkbox (D-088).
- [ ] Testy: sprawa bez zgody wymaga powiadomienia; zaznaczona zgoda pozwala na wpis od razu.

### Zadanie 15 — D-091 nowy przebieg zbycia (ZAPIS § 4)
**Pliki:** `publiczne/js/sprawy.js`, `publiczne/js/kreator.js`. Backend: bez zmian w logice wpisu — tylko wartości domyślne i przeniesienie pól; istniejące testy walidacji art. 300³⁴ i 300⁴⁰ przechodzą bez modyfikacji.
- [ ] Jeden ekran, trzy kroki: „Co się zbywa” → „Podstawa” → „Sprawdzenie i wpis”, na `KolumnaSprawy` i `PasekAkcji`.
- [ ] Kreator sterowany definicją typu, żeby kolejne typy wpisów dało się dodać bez nowego widoku: `definicjaWpisu.przeniesienie = { kroki: [...], pola: [{ klucz, krok, zrodlo: 'reczne'|'kartoteka'|'rejestr'|'auto'|'domyslne', domyslna, widoczneGdy(stanRejestru, sprawa), wymagane, podstawa }] }`.
- [ ] Automatyczny dobór akcji: z akcji zbywcy według kolejności emisji serii, numery rosnąco; akcje obciążone albo niepokryte dobierane na końcu, a gdy zostaną dobrane — krok 3 to pokazuje **[domyślne]**. Ręczny wybór numerów — za przyciskiem „Wybierz numery ręcznie”.
- [ ] Usunięte z widoku zgodnie z ZAPISEM § 4: rodzaj dokumentu, krok „weryfikuj”, „Osoba działająca przy wpisie” (domyślnie notariusz z ustawień); „Wystaw żądanie wpisu” — akcja drugorzędna w pasku (żądanie ustne).
- [ ] Testy: lista zbywców = akcjonariusze tej spółki; dobór numerów wg reguły powyżej; „zgoda spółki” widoczna tylko przy ograniczeniu rozporządzania (art. 300³⁴ § 6) albo niepełnym pokryciu; „prawo pierwszeństwa wyczerpane” tylko przy takim ograniczeniu w rejestrze; „Dokonaj wpisu” nieaktywny do wysłania e-maila / nadania listu albo zaznaczenia zgody; nowy nabywca z minimum danych (D-076) zapisuje się w kartotece.

**STOP 3** — zrzuty przebiegu zbycia (1440 i 390 px), liczba pól i kliknięć przed/po.

## Raport końcowy sesji
Zadania wykonane / pominięte (z powodem), liczba testów przed/po, nowe wpisy `DECYZJE.md` (w tym **[domyślne]** do potwierdzenia), otwarte problemy.
