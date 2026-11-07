# CLAUDE-PSA-UPROSZCZENIE.md — uproszczenie modułu Rejestr akcjonariuszy P.S.A.

> Specyfikacja dla Claude Code. Wejście: `RAPORT-STANU-PSA.md` (7.11.2026, commit `0565234`) i `PRZEPISY-PSA.md` (jedyne źródło prawne). Tam, gdzie `CLAUDE-PSA.md` albo pliki `SESJA-*.md` mówią co innego, obowiązuje ten plik. Uwagi Łukasza z testów interfejsu (7.11.2026) są w nim już uwzględnione.
>
> **Cel:** prosta aplikacja dla klientów i prosta aplikacja dla kancelarii. Każda opcja, wariant, status i dokument to miejsce na pomyłkę i na atak. Zostaje to, czego wymaga przepis 🟢 albo codzienna praca kancelarii; reszta znika.

## 0. Zasady pracy — w każdej fazie

1. Przed startem `git tag przed-uproszczeniem`; praca na gałęzi `uproszczenie`.
2. Każda faza w nowej sesji. Czytaj tylko ten plik, `PRZEPISY-PSA.md`, potrzebny fragment `RAPORT-STANU-PSA.md` i pliki wskazane w fazie (duże pliki — wyszukiwaniem i fragmentami). Nie czytaj `docs/archiwum/`.
3. Nie otwieraj bazy produkcyjnej ani katalogów z prawdziwymi dokumentami — dane osobowe nie mogą trafić do Claude Code. Pracuj na bazie z `npm run test:seed`.
4. Bez nowych zależności npm. Usunięte znaczy usunięte: bez flag zgodności, kodu „na wszelki wypadek" i komentarzy o dawnym działaniu (historia jest w git).
5. Blokada systemowa z powodów prawnych — tylko dla warunku pewnego, z podstawą 🟢 w `PRZEPISY-PSA.md`. Wszystko inne to pozycja checklisty odhaczana przez człowieka. Sprawdzenie poprawności danych (format, liczba zgodna z numerami) to błąd przy polu, nie blokada prawna.
6. Gdy ta specyfikacja jest sprzeczna z przepisem 🟢, wygrywa przepis; opisz to w raporcie.
7. Koniec fazy: `npm test` zielony; raport `raporty/FAZA-N.md` do 40 linii, bez kodu (co zrobiono, metryki z § 9 przed i po, testy, odstępstwa, pytania); wpisy w `DECYZJE.md`. Potem **STOP** — czekaj na akceptację.
8. Podsystemy przebudowywane w późniejszej fazie: jeśli po zmianie schematu nie działają, odłącz ich trasy (nie montuj), a ich testy oznacz `test.skip` z numerem fazy — lista w raporcie. Po Fazie 6 — zero pominiętych testów. Interfejs może nie działać do Fazy 3.
9. Obowiązek aktualizacji `ARCHITEKTURA-PSA.md` po każdej sesji (README) jest zawieszony — plik powstaje od nowa w Fazie 6. `DECYZJE.md` aktualizuj na bieżąco.
10. Strona publiczna (`strona/`, `projekt-strony/`) poza zakresem; jej generator ma dalej czytać stawki z `przepisy.js` i dane kancelarii z `psa_ustawienia`.

## 1. Zasady docelowe

1. **Jedna droga do celu:** jedna droga zapisu wpisu, jedna droga wydania informacji z rejestru, jeden generator pism, jedna tabela plików przychodzących, jedno źródło każdej danej.
2. **Rejestr zawiera tylko fakty dokonane.** Nie ma emisji bez wpisu do KRS ani akcji „nieobjętych".
3. **Typ wpisu to operacja na akcjach, nie przypadek z życia.** Różnice (podstawa, z urzędu, ułamek) są polami, nie typami.
4. **Reguły wynikają z danych:** kogo powiadomić i co sprawdzić liczy jedna funkcja z porównania stanu przed i po wpisie oraz z atrybutów akcji — nie flagi przypisane typom.
5. **Każdy status ma jedną tabelę przejść** (`PRZEJSCIA`, wzór: `logika/przeniesienie.js`). Status zmienia wyłącznie funkcja, która ją sprawdza.
6. **Każda trasa, tabela, kolumna i plik ma wywołującego w kodzie produkcyjnym** — inaczej znika.
7. **Minimum danych.** Pole, etykieta, przycisk i element pisma zostają tylko wtedy, gdy wymaga ich przepis albo konieczna czynność — mniej pól to mniej pomyłek. Przy każdej zmianie interfejsu i pism usuń to, czego nie da się tak uzasadnić.
8. **Jedna nazwa na jedną rzecz** (U-29): przychodzące — „pliki", wychodzące — „pisma", wszystkie wychodzące na ekranie „Korespondencja".

## 2. Decyzje

Zatwierdzone przez Łukasza 7.11.2026. Dopisz do `DECYZJE.md` jako kolejne D-xxx z oznaczeniem U-xx.

| Nr | Rozstrzygnięcie | Zastępuje |
|---|---|---|
| U-01 | W bazie nie ma prawdziwych wpisów → jeden nowy schemat bazowy zamiast 71 migracji, bez zgodności wstecz. Do końca Fazy 6 schemat wolno edytować; bazy deweloperskie odtwarza `test:seed`. | migracje 1–71 |
| U-02 | Automatycznie naliczają się tylko: opłata za prowadzenie rejestru (rocznie albo miesięcznie — U-30) i informacja zamawiana w portalu (płatna z góry). Przy sprawie z operacją odpłatną (§ 3.1) pracownik przed wpisem wybiera „Opłata 100 zł netto" albo „Bez opłaty" — wybór obowiązkowy, bez wartości domyślnej, najwyżej jedna opłata na sprawę (kilka wpisów może łączyć jedna opłata). Tak samo przy informacji wydawanej przez pracownika: 50 zł albo bez (organ — zawsze bez). | podstan `oczekuje_na_oplate`, automatyczna opłata za wpis |
| U-03 | Dokumenty do podpisu przy zawarciu umowy, każdy podpisywany osobno: (1) umowa o prowadzenie rejestru — spółka, potem notariusz (QES); oświadczenie PEP reprezentanta w treści umowy, informacja RODO jako załącznik do wglądu, bez podpisu; (2) uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr — akcjonariusze; pomijana, gdy klient wgra własną albo wybór wynika z umowy spółki; (3) zgoda na korespondencję e-mail — osobny dokument dla każdego akcjonariusza bez konta w portalu. Do tego klient wgrywa aktualną umowę spółki (bez podpisu). Pliki wgrywa osoba z kontem. | komplet dokumentów wniosku |
| U-04 | Wzory pism w Markdown (`wzory/*.md`), ograniczony zestaw: nagłówki, akapity, pogrubienie, kursywa, listy, tabele, podział strony, pola `{{pole}}`, `{{#lista}}`, `{{#jesli}}`. Wygląd — czcionka z polskimi znakami, marginesy, nagłówek z danymi kancelarii, stopka z numerem pisma i numerem strony, bloki podpisów — zdefiniowany raz, wspólny dla wszystkich pism; SHA-256 pisma tylko w `psa_pisma`. Wynik zawsze PDF (pdfkit). `npm run wzory` tworzy podgląd PDF każdego wzoru z danymi próbnymi. Treść obecnych wzorów Word przenieść 1:1 (nazwy według U-29). Bez `.docx`, HTML i edycji wzorów w aplikacji. | `docx.js`, `zip.js`, `wzory-dysk.js`, `dokumenty-tresc.js`, `bloki-dokumentu.js`, `psa_szablony` |
| U-05 | Stawki jako stałe w `przepisy.js`. Bez edycji i wersji stawek w aplikacji. | D-085, `psa_stawki_wersje` |
| U-06 | AML bez blokady systemowej (`PRZEPISY-PSA.md` § 9 ⚠️ i § 13): stała pozycja checklisty odhaczana przez pracownika; praktyka kancelarii (także emisje, próg 15 000 EUR) bez zmian. Dokumenty AML to zwykłe pliki osoby, data weryfikacji w kartotece. | D-010, D-117, `aml_status`, `psa_osoby_skany_aml`, `stosuje_procedure_aml` |
| U-07 | Przejęcie rejestru od innego podmiotu: we wniosku zaznaczenie „przejęcie" i dwa pola — dotychczasowy podmiot oraz data przejęcia (dzień, od którego kancelaria prowadzi rejestr; można ją uzupełnić później). Umowa bez warunku: prowadzenie rejestru zaczyna się w dniu przejęcia (spółka zawiera umowę z kancelarią, potem rozwiązuje dotychczasową — art. 300³² § 2 KSH). „Otwórz rejestr" działa od dnia przejęcia: wpis `otwarcie` ze stanem z dokumentów poprzednika (pliki w aktach spółki). Bez osobnego procesu, statusów, protokołu, terminu warunku, okresu wypowiedzenia i opłaty za przejęcie. | D-084, `psa_przeniesienia*`, umowa pod warunkiem |
| U-08 | Zgłoszenie i wniosek to jedna encja: formularz publiczny od razu zakłada wniosek i wysyła link. Pozycja menu „Zgłoszenia" znika. | ustalenie o menu z 09.2026 |
| U-09 | Pisma powstają automatycznie, ale wysyła je pracownik jednym kliknięciem po podglądzie. Ekran „Korespondencja" to jedno miejsce dla wszystkiego, co wychodzi z rejestru: powiadomienia (o zamierzonym wpisie, o wpisie, o odmowie), wezwania, informacje z rejestru (e-mailem, listem albo pobrane w portalu) i zaproszenia do portalu (treść bez linku aktywacyjnego). Przy każdej pozycji: adresat, kanał, treść (PDF i tekst e-maila), stan, data, identyfikator wiadomości i odpowiedź serwera poczty; ponowna wysyłka. Niewysłane pisma i błędy wysyłki trafiają do „Do zrobienia". Zastępuje kolejkę „Zawiadomienia" i ekran listów do wysyłki. | ustalenie o menu z 09.2026 |
| U-10 | Pisma e-mailem z PDF w załączniku do adresatów ze zgodą na korespondencję e-mail (spółka — z umowy); bez zgody — list. Treść e-maila krótka, bez danych osobowych. Pismo widać też w portalu (R9). | — |
| U-11 | Zgoda na korespondencję e-mail i żądanie powiadomień to jedna zgoda — w karcie osoby przełącznik. Akcjonariusz z kontem składa ją w portalu, pozostali — podpisując dokument zgody (U-03). Włączenie przez pracownika wymaga pliku podpisanej zgody, wyłączenie (wycofanie) — daty. Historia w `psa_historia_danych`. | zgoda w 3 miejscach, `psa_oswiadczenia` |
| U-12 | Aplikacja nie liczy głosów (to nie jest dana rejestru). | głosy w `kontekst-pisma.js` |
| U-13 | Usunięte: zgłoszenie nieprawidłowości, dokumenty na żądanie (uchwała przechodzi do dokumentów wniosku — U-03), podgląd systemu, edycja szablonów, współwłasność w kartotece, ręczne wystawianie pism (pole „wydane dokumenty"). | — |
| U-14 | Zamiast statusu spółki — stan rejestru: otwarty / zamknięty (z powodem). Opłata za prowadzenie (U-30) przysługuje, dopóki rejestr jest otwarty. | `w_likwidacji`, `zawieszona`, odstępstwo 22 |
| U-15 | Tekst zamiast słowników: podstawa wpisu, przyczyna odmowy. Żądający: spółka, osoba z kartoteki, organ (tylko przy zajęciu) albo brak (sprostowanie z inicjatywy kancelarii). | kody odmowy ×7, role ×8, rodzaje dokumentu ×7 |
| U-16 | Usunięte pola bez skutku: `charakter_wpisu`, `dni_wstrzymania`, źródło sprawy, REGON, telefon, „ostatnia zmiana" w kartotece (jest historia — U-25). | D-027 |
| U-17 | Rodzaj akcji wyliczany: uprzywilejowana, gdy ma adnotację „uprawnienie", inaczej zwykła — bez osobnego pola. Pokrycie: przy emisji obowiązkowe pytanie tak/nie (bez wartości domyślnej); „nie" = adnotacja „niepokryte", wykreślana po pokryciu. | D-112, D-114, pokrycie ×4 |
| U-18 | Nieprawidłowy PESEL (suma kontrolna albo data) blokuje zapis. | ostrzeżenie bez blokady |
| U-19 | Wniosek odrzucony albo porzucony (90 dni bez zmian): dane klienta usuwane automatycznie; zostają KRS, daty i stan. | bezterminowe przechowywanie |
| U-20 | Kontrola integralności łańcucha — na żądanie, przycisk w Ustawieniach (bez harmonogramu). | — |
| U-21 | Emisja tylko z datą wpisu do KRS i od razu z obejmującymi — jeden wpis. Warunkowa emisja (art. 300¹¹⁷–300¹¹⁸) nadal poza zakresem. | odstępstwa 3–4 w README |
| U-22 | „Stan na" — tylko dzień. | dokładność do minuty (sprint 6, poz. 2.3) |
| U-23 | Jedno konto na osobę (logowanie e-mailem) — nie ma osobnego konta spółki. Konto należy do osoby z kartoteki (przed przyjęciem wniosku — do wniosku). Zakres wynika z danych: osoba działająca za spółkę (reprezentant z wniosku; kolejnych dodaje kancelaria w kokpicie) widzi wszystko o spółce i zamawia pełną informację na koszt spółki; akcjonariusz widzi swoje sprawy, pisma i opłaty, a informację dostaje bez danych z art. 300³⁵ § 1¹ KSH; osoba w obu rolach ma jedno konto z sumą zakresów. Zakres akcjonariusza wymaga zgody na korespondencję e-mail (wycofanie go wyłącza — D-083) i wygasa po zbyciu wszystkich akcji (D-039). Zakres liczy jedna funkcja `zakresKonta(konto)`, przez którą przechodzą wszystkie trasy portalu. | role `akcjonariusz`, `wnioskodawca`, `spolka`; konto spółki |
| U-24 | Informacja z rejestru zamawiana w portalu — stan na koniec wybranego dnia: domyślnie i najpóźniej wczorajszego, najwcześniej dnia otwarcia rejestru (wybór dnia zostaje: spółka potrzebuje stanu na trzy dni przed walnym zgromadzeniem — art. 300⁹¹ KSH). Wpisy z danego dnia widać od następnego dnia; pierwszą informację można zamówić dzień po otwarciu rejestru. Zasada dotyczy wyłącznie portalu: pracownik widzi stan rejestru i wydaje informację w każdej chwili, według stanu na dowolny dzień, także bieżący (z dzisiejszymi wpisami). | — |
| U-25 | Zmiana danych osoby albo spółki nie jest wpisem: „Edytuj" w karcie osoby albo w danych spółki zmienia pola w miejscu, a zapis dodaje wiersze historii (pole, stara i nowa wartość, kto, kiedy) w `psa_historia_danych` (append-only). Bez sprawy, terminu, opłaty, powiadomień i zdarzeń w łańcuchu. Gdy zmiany danych żąda klient przez portal, pracownik zmienia dane i kończy jego sprawę zwykłym „Dokonaj wpisu" (R1). | typy `zmiana_danych_akcjonariusza`, `zmiana_danych_spolki`; sprawa zmiany danych |
| U-26 | Numery akcji zawsze wpisuje pracownik — seria, numery i liczba — w każdej operacji, także w otwarciu i emisji. Bez doboru automatycznego i skrótów („cała seria", „akcje osoby X"). Liczba niezgodna z numerami — błąd przy polu. | dobór automatyczny: `logika/kreator.js:67–110`, `publiczne/js/wpis-zbycia-logika.js:43–86` |
| U-27 | Informacja z rejestru zawiera tylko: dane z art. 300³³ § 1 KSH, PESEL albo datę urodzenia (D-076), numer informacji i „stan na" — treść i układ w § 4. Bez wynagrodzenia, podstawy prawnej, odbiorcy, ceny emisyjnej (nie jest daną rejestru — znika też z modelu i formularzy), NIP, REGON, udziału procentowego oraz dat umowy i otwarcia rejestru. | wynagrodzenie i podstawa prawna na każdej informacji (ustalenie z 09.2026) |
| U-28 | List: „Nadano" jednym kliknięciem zapisuje dzisiejszą datę — bez numeru nadania i skanu potwierdzenia. | formularz nadania |
| U-29 | Nazwy pism jak w art. 300³⁴ § 9 KSH: powiadomienie o zamierzonym wpisie, powiadomienie o wpisie, powiadomienie o odmowie; „zawiadomienie" tylko wobec sądu (art. 300³² § 3). Przychodzące to „pliki", wychodzące — „pisma". | „zawiadomienia", „wydane dokumenty", „listy do wysyłki" |
| U-30 | Opłata za prowadzenie rejestru do wyboru we wniosku: raz w roku (1 200 zł netto) albo co miesiąc (100 zł netto); domyślnie raz w roku. Wybór wchodzi do umowy; zmienia go tylko kancelaria (dane spółki). Proces dzienny nalicza opłatę w rocznicę otwarcia rejestru albo co miesiąc w dniu otwarcia (31 → ostatni dzień miesiąca); każda rata to osobna opłata. Po zamknięciu rejestru nowe opłaty nie powstają. | tylko opłata roczna |

## 3. Model docelowy

### 3.1. Typy wpisów: 22 → 8

| Typ | Zastępuje | Co robi | Pytanie o opłatę (U-02) |
|---|---|---|---|
| `otwarcie` | otwarcie rejestru, migracja stanu, `przejecie`, `migracja_krn` | stan na dzień otwarcia (przy przejęciu — na dzień przejęcia, U-07): serie, własność (z ułamkami), zakresy umorzone, atrybuty; `zrodlo`: założenie / przejęcie | nie |
| `emisja` | `emisja`, `objecie` | nowa seria od razu przypisana obejmującym; data wpisu do KRS i pytanie o pokrycie obowiązkowe | tak |
| `przeniesienie` | `przeniesienie`, `przeniesienie_ulamka` | akcje albo ułamek jednej akcji (ułamek ≠ 1 ⇒ dokładnie jeden numer) od zbywcy do nabywców | tak |
| `umorzenie` | `umorzenie`, `uniewaznienie` | akcje przestają istnieć; `podstawa`: uchwała / orzeczenie sądu — widoczna w informacji z rejestru | tak |
| `obciazenie` | `obciazenie`, `zajecie`, `wykreslenie_obciazenia`, `wykreslenie_zajecia`, `prawo_glosu_zastawnika` | `operacja`: ustanowienie / zmiana prawa głosu / wykreślenie; `rodzaj`: zastaw / użytkowanie / zajęcie | przy ustanowieniu, poza zajęciem |
| `adnotacja` | `uprawnienie`, `ograniczenie`, `pokrycie_akcji`, `przedstawiciel`, `zdarzenie_inne` | `operacja`: dodanie / wykreślenie; `rodzaj`: uprawnienie / ograniczenie / obowiązek / niepokryte / inna; zakres numerów + treść | nie |
| `sprostowanie` | `sprostowanie` | zastępuje treść wpisu w jego miejscu w chronologii albo wycofuje wpis | nie |
| `zamkniecie` | `przekazanie_rejestru` | zamyka rejestr; `powod`: przekazanie / wykreślenie spółki / rozwiązanie umowy | nie |
| — | `zobowiazanie` | usunięty: oświadczenie z art. 300³⁴ § 4 to podstawa wpisu `przeniesienie` albo `obciazenie` | — |
| — | `zmiana_danych_akcjonariusza`, `zmiana_danych_spolki` | usunięte: zmiana danych to edycja z historią, nie wpis (U-25) | — |

Zakres akcji w każdej operacji: seria, numery i liczba, wpisywane ręcznie (U-26). Wspólny przedstawiciel współuprawnionych to adnotacja „inna" z treścią.

### 3.2. Reguły uniwersalne

- **R1. Jedna droga zapisu.** Do `psa_zdarzenia` dopisuje wyłącznie `rejestr.wpisz(sprawaId)`. Każdy wpis — także otwarcie, sprostowanie i zamknięcie — idzie przez sprawę; jeśli nie wymaga powiadomień, sprawa powstaje i zamyka się jednym kliknięciem. Sprawa bez zmian na akcjach (np. żądanie zmiany danych — U-25) też kończy się „Dokonaj wpisu", tylko bez zdarzeń. Jedna transakcja: walidacje → zdarzenia wszystkich operacji sprawy → pełne odtworzenie stanu → opłata (wybór U-02) → pisma w stanie `do_wyslania` → sprawa `wpisana`.
- **R2. Kogo powiadomić (art. 300³⁴ § 3).** Funkcja `ktoTraci(stanPrzed, stanPo)` zwraca: każdego, komu ubywa akcji albo części akcji; akcjonariusza, którego akcje zostają obciążone; uprawnionego z obciążenia wykreślanego albo tracącego prawo głosu; akcjonariusza, któremu wykreśla się adnotację „uprawnienie". Wyjątek: zajęcie i jego wykreślenie. Pracownik może dopisać osobę, nie może usunąć wyliczonej. Powiadomienia powstają same po zatwierdzeniu treści sprawy (krok 1 → 2, § 5) dla każdej wyliczonej osoby bez odnotowanej zgody na wpis. Wpis zablokowany, dopóki każda wyliczona osoba nie ma wysłanego powiadomienia (list — po „Nadano") albo odnotowanej zgody na wpis (zgoda w dopuszczalnej formie + data, opcjonalnie plik — D-088). Zmiana treści po kroku 1 usuwa niewysłane powiadomienia, a wysłane tracą ważność — wpis wymaga nowych. Funkcja zastępuje `wymaga_powiadomienia` i obsługuje też sprostowanie.
- **R3. Z urzędu (art. 300³⁴ § 2)** ⇔ `obciazenie` rodzaju „zajęcie" (ustanowienie albo wykreślenie): bez opłaty, bez powiadomienia, żądający = organ (opis tekstowy). Jedna funkcja `zUrzedu(operacja)`, żadnych innych warunków.
- **R4. Opłaty** wyłącznie według U-02. Opłata nigdy nie warunkuje terminu ani wpisu; decyzja „bez opłaty" zostaje zapisana w sprawie.
- **R5. Checklista** = 3 pozycje stałe (żądający uprawniony; dokumenty zbadane co do treści i formy; identyfikacja osób i AML — wykonano albo nie dotyczy) + pozycje wynikające z atrybutów akcji objętych operacją: ograniczenie → „Ograniczenie uwzględnione"; niepokryte → „Zgoda spółki na zbycie"; zajęcie → „Zbycie dopuszczalne mimo zajęcia"; obciążenie z prawem głosu → „Umowa spółki nie wyłącza prawa głosu". Odhacza zawsze człowiek; bez kompletu wpis zablokowany. Krótki dopisek z podstawą prawną — tylko w aplikacji kancelarii.
- **R6. Blokady systemowe — tylko te:** bilans (art. 300³¹ § 2); emisja bez daty wpisu do KRS albo z datą niewiarygodną (art. 300³⁰ § 2, reguła z Z-012); rozporządzenie ponad stan posiadania; brak powiadomienia albo zgody (R2); rejestr zamknięty; niepełna checklista (R5); nieprawidłowy PESEL (U-18; art. 30 ustawy zmieniającej, D-076).
- **R7. Termin 7 dni** — `terminy.js` bez zmian. Przy wznowieniu data usunięcia przeszkody domyślnie = data ostatniego pliku od żądającego (pracownik może zmienić).
- **R8. Numery akcji (U-26)** wpisuje pracownik: seria, numery, liczba. Serwer sprawdza, że liczba odpowiada numerom, a numery istnieją i należą do rozporządzającego (R6); atrybuty tych akcji dodają pozycje checklisty (R5). Bez doboru automatycznego na serwerze i we froncie.
- **R9. Kanał pisma:** e-mail z PDF w załączniku, gdy adresat ma zgodę na korespondencję e-mail (spółka — z umowy); w każdym innym przypadku list. Pismo widać też w portalu: pismo do spółki — u osób działających za nią, pismo do osoby — na jej koncie. Wysyła zawsze pracownik po podglądzie (U-09).
- **R10.** Dane osobowe nie trafiają do `dane_json` zdarzeń (bez zmian — README, odstępstwo 6).

### 3.3. Statusy

| Encja | Stany | Przejścia |
|---|---|---|
| sprawa | `w_toku`, `wstrzymana`, `wpisana`, `odmowa`, `wycofana` | `w_toku` ⇄ `wstrzymana`; `w_toku` → `wpisana`; `w_toku`/`wstrzymana` → `odmowa`, `wycofana`. Stanu `nowa` nie ma — każda sprawa zaczyna od `w_toku`. |
| wniosek | `roboczy`, `zlozony`, `przyjety`, `odrzucony` | `roboczy` → `zlozony`; `zlozony` → `roboczy` (do uzupełnienia, z notatką), `przyjety`, `odrzucony`. Stan dokumentów wynika z ich plików. |
| plik do podpisu | `do_podpisu`, `do_sprawdzenia`, `potwierdzony`, `odrzucony` | wgranie po teście D-086 → `do_sprawdzenia`; pracownik → `potwierdzony` / `odrzucony` (z powodem); ponowne wgranie → `do_sprawdzenia` |
| pismo | `do_wyslania`, `wyslane`, `blad` | e-mail: `do_wyslania` → `wyslane` / `blad` → ponowna wysyłka; list: `do_wyslania` → `wyslane` po „Nadano" (U-28). Niewysłane pismo, które przestało być potrzebne (zmiana treści sprawy, zgoda na wpis, wycofanie sprawy), usuwa się samo. |
| opłata | `do_zaplaty`, `oplacona`, `anulowana` | `do_zaplaty` → `oplacona` / `anulowana` (z powodem); numer faktury to pole, nie status |
| płatność tpay | bez zmian | — |
| rejestr spółki | otwarty / zamknięty | wynika z wpisów `otwarcie` i `zamkniecie` |

### 3.4. Tabele: 39 → 21

| Tabela | Zawartość | Wchłania |
|---|---|---|
| `psa_spolki` | dane z KRS (bez REGON), NIP do faktur, kto zawarł umowę (art. 300³² § 1²), sposób płatności (U-30), daty otwarcia i zamknięcia rejestru | 74 → ok. 20 kolumn |
| `psa_osoby` | kartoteka, tylko: imię i nazwisko albo firma; PESEL, data urodzenia albo numer w rejestrze; adres z rodzajem; e-mail i zgoda na e-mail; PEP (tak/nie + opis); data weryfikacji AML; uwagi | `psa_wnioski_akcjonariusze`, `psa_osoby_dzialajace` |
| `psa_zdarzenia` | bez zmian: append-only, łańcuch skrótów | — |
| `psa_emisje` | seria, numery, data wpisu do KRS — bez statusu i ceny emisyjnej | — |
| `psa_stan_akcji` | materializacja własności z ułamkami; kategorie `akcjonariusz`, `umorzona` | `nieobjeta`, `uniewazniona` |
| `psa_atrybuty` | materializacja obciążeń i adnotacji: rodzaj, numery, osoba uprawniona, treść, prawo głosu, od–do | `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia`, kolumna `pokryta` |
| `psa_sprawy` | stan, żądający, termin, robocze operacje i checklista (JSON), podstawa, przyczyna odmowy, decyzja o opłacie, klucz idempotencji | — |
| `psa_pliki` | każdy plik przychodzący (spółka / osoba / sprawa / wniosek): nazwa, skrót, kto wgrał (zapisywane samo), stan podpisu | `psa_dokumenty`, `psa_spolki_dokumenty`, `psa_wnioski_dokumenty`, `psa_osoby_skany_aml`, `psa_przeniesienia_dokumenty` |
| `psa_pisma` | każde pismo wychodzące: PDF, skrót, numer, adresat, kanał, stan, identyfikator wiadomości i odpowiedź serwera poczty, data nadania | `psa_wydane_dokumenty`, `psa_listy` |
| `psa_historia_danych` | historia zmian danych osób i spółek oraz zgody na e-mail (append-only): pole, stara i nowa wartość, kto, kiedy, plik (U-11, U-25) | `psa_oswiadczenia`, `zgoda_email_status` |
| `psa_wnioski` | stan, przejęcie (dotychczasowy podmiot, data przejęcia — U-07), dane klienta w jednym JSON, checklista, notatka | 65 kolumn, `psa_zgloszenia`, `psa_przeniesienia` z tabelami pomocniczymi |
| `psa_oplaty`, `psa_platnosci` | opłaty (płatnik: spółka albo osoba) i transakcje tpay | `psa_stawki_wersje` |
| `psa_konta`, `psa_reprezentanci` | konto = osoba (przed przyjęciem wniosku — wniosek); osoby działające za spółkę (U-23) | `psa_konta_spolki`, role `akcjonariusz`, `wnioskodawca`, `spolka` |
| `psa_uzytkownicy`, `psa_sesje_uniewaznione` | bez zmian | — |
| `psa_dziennik` | dziennik dostępu i logowań (append-only) | `psa_dziennik_dostepu`, `psa_dziennik_logowan` |
| `psa_ustawienia` | dane kancelarii i osób zawierających umowy — jedyne źródło | zmienne `KANCELARIA_*` |
| `psa_migracje`, `psa_baza_testowa` | bez zmian | — |

Usunięte bez zastępstwa: `psa_zgloszenia_nieprawidlowosci`, `psa_szablony` (wzory w plikach — U-04), `psa_kraje` (lista krajów jako stała). Kolumna zostaje tylko wtedy, gdy czyta ją kod produkcyjny.

### 3.5. Pozostałe pozycje raportu (§ 4)

- poz. 2 — usuń bramkę „sprintu" (`sprint`, `SPRINT_KREATORA`, próg portalu).
- poz. 3, 17 — bez osobnych ekranów dla typów. Sprostowanie: Historia → „Sprostuj" otwiera sprawę z formularzem wypełnionym treścią wpisu; „Wycofaj wpis" to opcja tego formularza.
- poz. 10 — ułamki w `przeniesienie`; logika `ulamki.js` i wyłączenie wierszy ułamkowych z `pula()` (README odstępstwo 23) zostają.
- poz. 18–20 — usuń `POST /spolki/:id/zdarzenia`, ekran migracji i `migracja_krn`.
- poz. 22 — rozróżnienie osoby fizycznej i prawnej w jednym komponencie i jednej funkcji opisu osoby.
- poz. 23 — PESEL albo data urodzenia (bez flagi `bez_pesel`); jeden adres + rodzaj: zamieszkania/siedziby albo do doręczeń; maskowany tylko adres zamieszkania osoby fizycznej.
- poz. 25 — PEP: przełącznik tak/nie + opis (gdy tak).
- poz. 26 — flagi spółki usuń; zakazy i ograniczenia z umowy spółki zapisuj jako adnotacje. Zostaje „kto zawarł umowę" — wybór z listy w Ustawieniach przy wgraniu podpisu notariusza.
- poz. 29 — usuń trasy 501; data 18.02.2027 zostaje tylko dla przypomnienia o zawiadomieniu sądu przy zamknięciu rejestru (art. 300³² § 3).
- poz. 30–31 — patrz § 4.
- poz. 32 — oba algorytmy doboru numerów usuń (U-26).
- § 7 raportu — usuń cały martwy kod, nieużywane kolumny i duplikaty plików.
- `psa_osoby_dzialajace` — zastąp polem tekstowym „działa przez" w sprawie; jeśli kod pokaże inne użycie, opisz je w raporcie Fazy 1 przed zmianą.

### 3.6. Bez zmian

Append-only `psa_zdarzenia` z wyzwalaczami i łańcuchem skrótów (`lancuch.js`); pełne odtworzenie stanu przy każdym zapisie; niezmiennik bilansu z ułamkami (`ulamki.js`, `numery.js`); `terminy.js`; maskowanie z białej listy pól per odbiorca; sesje, unieważnianie tokenów, `limiter.js`, `hasla.js`; podstawowy test podpisu po wgraniu (`walidacja-podpisu.js`, D-086) i zasada „skan to nie podpis"; weryfikacja ITN tpay; KRS z bezpiecznym fallbackiem; tryb testowy z zabezpieczeniami startu i `czas.teraz()`; idempotencja zakładania sprawy; dziennik dostępu append-only; eksport ZIP rejestru (art. 90a PrNot); przypomnienia o rocznicy umowy; formularz publiczny nie ujawnia, czy prowadzimy rejestr spółki (D-079).

## 4. Pisma: 13 typów → 8

| Pismo | Powstaje | Odbiorca |
|---|---|---|
| Umowa o prowadzenie rejestru (oświadczenie PEP reprezentanta w treści; informacja RODO jako załącznik; akapity o przejęciu i o płatności miesięcznej, gdy dotyczą) | złożenie wniosku | spółka — podpis, potem notariusz |
| Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr | złożenie wniosku, chyba że klient wgra własną albo wybór wynika z umowy spółki | akcjonariusze — podpis |
| Zgoda na korespondencję e-mail | złożenie wniosku — dla każdego akcjonariusza bez konta; później z karty osoby | akcjonariusz — podpis |
| Powiadomienie o zamierzonym wpisie | zatwierdzenie treści sprawy (krok 1 → 2) | osoby z R2 bez zgody na wpis |
| Powiadomienie o wpisie | wpis | żądający i spółka; egzemplarz spółki ma na drugiej stronie listę akcjonariuszy do złożenia w KRS (art. 300³⁴ § 8) |
| Powiadomienie o odmowie | odmowa wpisu albo odrzucenie wniosku | żądający albo wnioskodawca; odmowa zawarcia umowy zawsze listem (art. 108a PrNot) |
| Wezwanie do uzupełnienia | wstrzymanie sprawy | żądający |
| Informacja z rejestru | zamówienie w portalu (U-24) albo przycisk w kokpicie | spółka, akcjonariusz (bez danych z art. 300³⁵ § 1¹) albo organ (bez opłaty) |

- Jeden moduł `logika/pisma.js`: wzór Markdown (U-04) → PDF; numer w stopce, SHA-256 w `psa_pisma`.
- Pisma powstają tylko z czynności (krok sprawy, wpis, odmowa, wstrzymanie, zamówienie informacji) — bez ręcznego wystawiania. Pismo powstaje raz; ponowne pobranie zwraca ten sam plik. Wysyłka zawsze przez pracownika (U-09), kanał według R9.
- Informacja z rejestru: jedna funkcja `wydajInformacje({spolka, odbiorca, dzien, sygnatura})` — numer `INF/RRRR/NNNN`, opłata według U-02, wpis do dziennika; odbiorca i sygnatura organu zapisują się tylko w `psa_pisma`, nie w treści. Usuń `informacja.html`, `stan`, `stan.csv`, podglądy „na żywo" i trasy `/dokumenty/wystaw` ×3.
- W pismach podstawa prawna najwyżej jednym zdaniem (w informacji z rejestru — wcale); w portalu i w treści e-maili — wcale.

### Informacja z rejestru — treść i układ (U-27)

| Część | Zawartość | Podstawa |
|---|---|---|
| Nagłówek | „Informacja z rejestru akcjonariuszy", pod nim jedna linia: „nr INF/2026/0001 · stan na 07.11.2026" | — |
| Spółka | firma; siedziba i adres; sąd rejestrowy i numer KRS; data rejestracji spółki | art. 300³³ § 1 pkt 1–3 |
| Akcje | tabela: seria · numery · liczba · rodzaj i uprawnienia szczególne · data rejestracji emisji; numery umorzone — tylko gdy są | pkt 3–4 |
| Akcjonariusze | tabela: akcjonariusz (w jednej komórce: imię i nazwisko albo firma, PESEL albo data urodzenia, adres, e-mail przy zgodzie) · seria · numery · liczba · data wpisu · pokryte w całości (tak/nie) | pkt 5–6, 9; D-076 |
| Obciążenia, ograniczenia, obowiązki | tylko gdy są — tabela: numery · treść · uprawniony · prawo głosu · data wpisu | pkt 6–7, 10–11 |

- Wersja dla akcjonariusza pomija dane pozostałych akcjonariuszy z art. 300³⁵ § 1¹ (maskowanie jak dziś) — bez dopisków, że coś pominięto.
- Układ: A4 pionowo, jedna czcionka (bez czcionki o stałej szerokości), liczby wyrównane do prawej, tabele na całą szerokość, wiersz nie dzieli się między strony, nagłówek tabeli powtarza się na kolejnej stronie, pustych sekcji nie ma. Spółka do 10 akcjonariuszy i 3 serii mieści się na jednej stronie.
- Raport Fazy 2 zawiera dwa próbne PDF-y (pełny i dla akcjonariusza) do oceny przez Łukasza.

## 5. Aplikacja kancelarii

**Zasady interfejsu (obie aplikacje):**
- jeden ekran na jedną rzecz (sprawa, spółka, osoba, wniosek); kroki tylko tam, gdzie kolejność jest konieczna (sprawa: powiadomienia przed wpisem) albo użytkownik musi coś zrobić poza aplikacją (podpis);
- jeden przycisk główny zależny od stanu — gdy niedostępny, wyszarzony z powodem obok; pozostałe czynności w menu „Więcej", ukryte, gdy niedostępne;
- bez przełączników widoku; jedyny tryb to „Edytuj" w karcie osoby i w danych spółki — wszystkie pola w miejscu, „Zapisz" / „Anuluj", bez okien;
- okno modalne tylko do potwierdzenia czynności nieodwracalnej (wpis, odmowa, odrzucenie wniosku, zamknięcie rejestru);
- pole tak/nie z wartością domyślną — przełącznik (zgoda na e-mail, PEP); wybór obowiązkowy bez wartości domyślnej (pokrycie — U-17, opłata — U-02) — dwa przyciski, żaden niewybrany;
- stan dotyczący osoby (np. „Powiadomienie — list", „Zgoda na wpis") — jedna linia wewnątrz jej kafelka, nie osobny element pod nim;
- jeden komponent daty: pole mieści pełny format DD.MM.RRRR z zapasem (dziś ucina „MM"), kropki wstawiają się same, ikona kalendarza w polu — bez osobnego przycisku obok;
- wgrywanie: jedno pole „Dodaj plik" (także przeciągnięciem) — bez wyboru rodzaju i źródła; plik od razu na liście;
- pola podpowiadane z danych już wprowadzonych (KRS, kartoteka, wniosek, poprzednie sprawy) — poza numerami akcji (U-26); nową osobę dodaje się w miejscu, bez opuszczania ekranu; autozapis roboczy; błąd przy polu, zwykłym językiem;
- działa przy 390 i 1440 px; jeden zestaw komponentów (scal `ui.js` z `ui-rejestr.js`).

**Menu:** Pulpit · Sprawy · Spółki · Osoby · Wnioski · Korespondencja · Opłaty. Ustawienia (dane kancelarii, osoby zawierające umowy, użytkownicy, „Sprawdź integralność rejestru") — w menu konta, tylko administrator.

| Ekran | Zawartość | Przycisk główny | Więcej |
|---|---|---|---|
| Pulpit | jedna lista „Do zrobienia" według pilności: sprawy z terminem do 2 dni albo po terminie, pisma do wysłania i błędy wysyłki, podpisy do sprawdzenia, wnioski złożone, przejęcia, w których nadszedł dzień przejęcia, nowe pliki w sprawach wstrzymanych; wiersz otwiera właściwy ekran | — | — |
| Sprawa (= kreator wpisu), 3 kroki | nagłówek: spółka, żądający, termin. **1. Treść** — zmiany („Dodaj zmianę": Przeniesienie, Emisja, Umorzenie, Obciążenie, Informacja o akcjach; seria, numery i liczba wpisywane ręcznie) i podstawa (opis, data, pliki). **2. Sprawdzenie** — stan przed i po; kafelki osób z R2 z jedną linią stanu („Powiadomienie — e-mail" / „Powiadomienie — list" / „Wysłano DD.MM.RRRR" / „Zgoda na wpis") i czynnością w kafelku („Wyślij" albo „Drukuj" i „Nadano"; „Odnotuj zgodę na wpis"); checklista; opłata (U-02). **3. Pisma** — powiadomienia o wpisie: podgląd (PDF i tekst e-maila), adresat, kanał, stan | według kroku: „Dalej" (tworzy powiadomienia — R2) → „Dokonaj wpisu" → „Wyślij pisma" | Zmień treść (powrót do kroku 1 — R2), Wstrzymaj (treść wezwania), Wznów, Odmów (przyczyna), Wycofaj |
| Kokpit spółki | nagłówek i „stan na" (dzień); dane spółki („Edytuj" w miejscu — U-25; sposób płatności — U-30); działają za spółkę (osoby; „Dodaj" — z kartoteki albo nowa osoba w miejscu; „Usuń"); akcjonariusze; akcje — serie z obciążeniami i adnotacjami („Zmień" / „Wykreśl" otwiera nową sprawę); historia wpisów („Sprostuj"); akta (pliki i pisma); opłaty | „Nowy wpis" (obok: „Informacja z rejestru") | Eksport, Zamknij rejestr |
| Karta osoby | dane („Edytuj" — U-25, bez sprawy i wpisu); zgoda na e-mail — przełącznik (włączenie: plik podpisanej zgody; wyłączenie: data) i „Dokument zgody do podpisu"; PEP — przełącznik + opis; AML (data, pliki); akcje w spółkach; sprawy; konto w portalu (stan); historia zmian (zwinięta) | „Edytuj" → „Zapisz" | Zaproś do portalu (osoba działająca za spółkę albo akcjonariusz ze zgodą) |
| Wniosek | dane spółki (różnice wobec KRS podświetlone), reprezentant, akcjonariusze, sposób płatności (U-30); przy przejęciu: dotychczasowy podmiot i data przejęcia (U-07); dokumenty: umowa spółki (wgrana) oraz umowa o prowadzenie rejestru, uchwała i zgody — przy dokumentach do podpisu stan, „Potwierdź podpis" / „Odrzuć plik"; przy umowie „Wgraj podpis notariusza" z wyborem osoby zawierającej umowę; checklista; notatka; po przyjęciu sekcja **Stan otwarcia** (serie, akcjonariusze, atrybuty — numery wpisywane ręcznie, U-26) | według stanu: „Przyjmij" → „Otwórz rejestr" (przy przejęciu — od dnia przejęcia) | Zwróć do uzupełnienia, Odrzuć |
| Korespondencja | wszystko, co wychodzi (U-09); filtr: do wysłania / listy do nadania / błędy / wysłane; wiersz: data, spółka, adresat, pismo, kanał, stan; „Podgląd"; przy liście „Drukuj" | w wierszu: „Wyślij" / „Wyślij ponownie" / „Nadano" (U-28) | — |
| Opłaty | filtr: do zapłaty / opłacone / wszystkie; eksport CSV | „Opłacona" (w wierszu) | Numer faktury, Anuluj (powód) |

„Nowa spółka" na liście spółek zakłada wniosek wypełniany przez pracownika — ten sam ekran co wniosek klienta.

## 6. Portal klienta

**Zasady:** jedno konto na osobę, zakres z danych (U-23) — te same ekrany dla osoby działającej za spółkę i dla akcjonariusza; gdy konto obejmuje kilka spółek — wybór spółki na górze Startu. W ekranach i e-mailach żadnych odwołań do przepisów ani słownictwa prawniczego; statusy prostymi słowami (W toku / Wymaga uzupełnienia / Wpisane / Odmowa / Wycofane). Ekrany wniosku widać tylko do jego przyjęcia; potem najwyżej trzy ekrany (Start, Zgłoś zmianę, Konto), w menu Start · Konto — bez pustej zakładki „Wnioski". Kwota tylko na przycisku płatności („Zapłać 61,50 zł") — bez osobnych wierszy netto i brutto. Widać tylko podstawowe dane spółki; akcjonariat — wyłącznie w płatnej informacji z rejestru. Trasy portalu: najwyżej 20.

| Ekran | Zawartość | Przycisk główny |
|---|---|---|
| Rejestracja (publiczna) | numer KRS, e-mail, „Przenoszę rejestr od innej firmy" → e-mail z linkiem | „Wyślij" |
| Aktywacja konta (link z e-maila — także dla osób zaproszonych przez kancelarię) | hasło, akceptacja regulaminu | „Zapisz" |
| Nowa spółka 1/2: Dane | wszystko z KRS (do poprawienia); reprezentant, z pytaniem prostymi słowami o wysokie stanowisko publiczne (PEP); akcjonariusze: imię i nazwisko albo firma; PESEL, data urodzenia albo KRS; adres; e-mail — obowiązkowy. Przy sobie zaznaczenie „to ja" i zgoda na korespondencję e-mail. Płatność za prowadzenie: raz w roku (1 476 zł) albo co miesiąc (123 zł) — U-30. Przy przejęciu: kto dotąd prowadził rejestr i od kiedy mamy go prowadzić (jeśli wiadomo) | „Dalej" |
| Nowa spółka 2/2: Dokumenty | lista: umowa spółki („Wgraj"), umowa o prowadzenie rejestru, uchwała (albo „Mam własną uchwałę" / „Wybór jest w umowie spółki"), zgody akcjonariuszy bez konta; przy dokumentach do podpisu „Pobierz", „Wgraj podpisany" i stan (do podpisu / sprawdzamy / podpisany / odrzucony — z powodem); jedna zwinięta instrukcja podpisu nad listą (mObywatel, profil zaufany, podpis kwalifikowany); „Wyślę dokumenty pocztą" (adres) | „Wgraj" (w wierszu) |
| Start | firma i KRS; „Do zrobienia" (podpisz, zapłać, uzupełnij); sprawy ze statusem i pismami do pobrania („Dodaj pliki" przy „Wymaga uzupełnienia"); opłaty (przycisk z kwotą); wydane informacje | „Zgłoś zmianę" (obok: „Zamów informację z rejestru") |
| Zgłoś zmianę | opis + pliki; pod polem krótka podpowiedź, co dołączyć (np. umowę sprzedaży akcji); bez wyboru rodzaju zmiany | „Wyślij" |
| Konto | e-mail, hasło, zgoda na korespondencję e-mail (gdy osoba z kontem jest akcjonariuszem), regulamin, polityka prywatności | „Zapisz" |

Informacja z rejestru: wybór dnia (domyślnie i najpóźniej wczoraj — U-24) i przycisk „Zapłać 61,50 zł" → pobranie automatycznie po zaksięgowaniu; ponowne pobranie bez opłaty. Osoba działająca za spółkę dostaje informację pełną (płaci spółka), akcjonariusz — wersję bez danych z art. 300³⁵ § 1¹ (płaci on). Przed upływem dnia od otwarcia rejestru przycisk jest wyszarzony z datą „Dostępna od…".

## 7. Bezpieczeństwo

1. **Lista dozwolonych tras** `testy/trasy-dozwolone.txt` (metoda, ścieżka, rola). Test porównuje ją z introspekcją routerów (`narzedzia/dokumentacja-endpointy.js`) — nowa trasa wymaga świadomego dopisania.
2. **Izolacja portalu:** test tabelaryczny po wszystkich trasach portalu — osoba działająca za spółkę A nie dostaje danych spółki B (404); konto przed przyjęciem wniosku widzi tylko swój wniosek; akcjonariusz nie widzi cudzych spraw, pism i opłat, dostaje wyłącznie informację bez danych z art. 300³⁵ § 1¹ i traci dostęp po zbyciu wszystkich akcji albo wycofaniu zgody; osoba w obu rolach ma sumę zakresów, nic więcej.
3. **Pliki przychodzące:** jedna funkcja przyjęcia — biała lista: PDF, JPG, PNG i formaty podpisu obsługiwane przez `walidacja-podpisu.js` (bez DOCX, ZIP, HTML, SVG), sprawdzana po rozszerzeniu i sygnaturze (magic bytes); limit 10 MB; losowa nazwa na dysku; katalog poza `publiczne/`. Inny format — komunikat „Wgraj plik PDF". Pobieranie tylko trasą z autoryzacją, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`.
4. **Serwer nie generuje HTML z danymi użytkownika** — pisma tylko PDF. We froncie zakaz `dangerouslySetInnerHTML` (test wyszukujący).
5. **Nagłówki** (bez nowej zależności): CSP `default-src 'self'` dopasowane do faktycznych zasobów, bez zewnętrznych skryptów; `frame-ancestors 'none'`; `Referrer-Policy: no-referrer`; HSTS za reverse proxy.
6. **Żądania zmieniające stan:** sprawdzenie nagłówka `Origin` (wyjątek: ITN tpay).
7. **Poczta:** wyłącznie SMTP z TLS; treść e-maila krótka, bez danych osobowych — pismo w załączniku PDF (U-10).
8. **Dane klienta przed weryfikacją** tylko w `psa_wnioski` (JSON), z retencją U-19.
9. **Tryb testowy:** moduły `server/tryb-testowy/` wczytywane (`require`) wyłącznie przy `PSA_TRYB_TESTOWY=1` — w produkcji ten kod się nie ładuje. Zabezpieczenia startu bez zmian.
10. **`.env.przyklad`** tylko: port, ścieżka bazy, sekret sesji, `ADMIN_EMAIL`, `SMTP_*`, `TPAY_*`, `KRS_API_URL`, `PORTAL_WLACZONY`, `PSA_TRYB_TESTOWY`, `POKAZ_ZNAK_IZBY`. Usuń m.in. `PODGLAD_SYSTEMU` (razem z `podglad.js`), `POCZTA_TRANSPORT` (w trybie testowym skrzynka włącza się sama), `KANCELARIA_*`.
11. **Limity prób:** logowanie, aktywacja konta, formularz publiczny, zamówienie informacji.
12. Raport końcowy zawiera wynik `npm audit`.

Poza kodem (decyzja Łukasza): dostęp do aplikacji kancelarii tylko z adresów kancelarii — reguła na zaporze serwera.

## 8. Fazy

**Faza 0 — porządek przed zmianą** (bez zmian w działaniu)
- Tag i gałąź (§ 0). Do `docs/archiwum/` przenieś wszystkie pliki `.md` z korzenia i z `docs/` poza `README.md`, `ARCHITEKTURA-PSA.md`, `DECYZJE.md`, `PRZEPISY-PSA.md`, `RAPORT-STANU-PSA.md` i tym plikiem. Usuń duplikaty plików (raport § 7 k).
- Dopisz decyzje U-01…U-30 do `DECYZJE.md`.
- Raport: lista przeniesionych plików, wynik `npm test`. **STOP.**

**Faza 1 — rdzeń: schemat, wpisy, sprawy (serwer)**
- Schemat bazowy (U-01): jedna migracja tworząca tabele z § 3.4, wyłącznie obiekty `psa_*`. Zabezpieczenie: migracja odmawia działania, gdy `psa_zdarzenia` istnieje i ma wiersze, a baza nie jest oznaczona jako testowa.
- `typy-zdarzen.js` (8 typów jako dane), `stan.js` (handlery, `ktoTraci`, checklista), `walidacje.js` (R6 i sprawdzenie numerów — R8), `rejestr.js` (R1, sprostowanie, otwarcie, zamknięcie), maszyna stanów sprawy (§ 3.3), decyzja o opłacie (U-02), edycja danych osób i spółek z historią (U-25). Usuń dobór numerów (U-26). Pisma przez interfejs `pisma.utworz(typ, kontekst)` — w tej fazie zapis rekordu bez PDF.
- Trasy spraw, spółek i osób — tylko te, których potrzebują ekrany z § 5. SQL w warstwie danych (`server/dane/`), nie w trasach.
- `narzedzia/test-seed.js` przepisz na nowy model (dane fikcyjne); rozbudowuj w kolejnych fazach.
- Testy: bilans, odtworzenie = stan bieżący, łańcuch i append-only (przenieś obecne; append-only także `psa_historia_danych`), każda operacja tabelarycznie, `ktoTraci` dla każdego typu, powiadomienia (powstają po kroku 1; zmiana treści usuwa niewysłane i unieważnia wysłane), sprostowanie (zastąpienie i wycofanie) dla każdego typu, ułamki (`ulamki.test.js` i przypadki z `sprint5.test.js`), blokady R6 (w tym PESEL), liczba niezgodna z numerami, przejścia statusów, opłata tylko po wyborze, edycja danych bez zdarzeń w łańcuchu i z wierszem historii.
- Gotowe, gdy testy są zielone, a w kodzie nie ma nazw usuniętych typów (sprawdź wyszukiwaniem). **STOP.**

**Faza 2 — pisma, korespondencja, informacja z rejestru, opłaty**
- § 4: 8 wzorów Markdown (treść obecnych wzorów Word 1:1, nazwy według U-29), moduł `pisma.js`, `npm run wzory`; informacja z rejestru według § 4 (treść i układ, U-27). Korespondencja (serwer): stany pisma, wysyłka po kliknięciu, identyfikator wiadomości i odpowiedź serwera poczty, ponowna wysyłka, „Nadano" (U-28), samoczynne usuwanie niepotrzebnych niewysłanych pism. `wydajInformacje()` z U-24. Opłaty (§ 3.3, CSV). Jeden proces dzienny: opłaty za prowadzenie (rocznie albo miesięcznie — U-30), przypomnienia, retencja (U-19).
- Usuń `docx.js`, `zip.js`, `wzory-dysk.js`, `szablony.js` (logika i trasy), `dokumenty-tresc.js`, `bloki-dokumentu.js`, `informacja-dokument.js`, `pdf.js` i `kontekst-pisma.js` (zawartość przechodzi do `pisma.js`), serwis i trasy zbiorczych zawiadomień, trasy 501.
- Testy: każdy wzór daje PDF bez pustych pól (`{{` w wyniku = błąd); informacja ma wyłącznie części z § 4, a w jej tekście nie ma kwot, odwołań do przepisów („art.", „§"), słów „odbiorca", „cena emisyjna", „REGON", „NIP" ani godziny; maskowanie dla każdego odbiorcy; U-24 (portal: najpóźniej wczoraj; pracownik: dzień bieżący); kanał R9; błąd wysyłki → `blad`; opłaty roczne i miesięczne; proces dzienny. Raport: próbne PDF-y informacji (§ 4). **STOP.**

**Faza 3 — ekrany kancelarii**
- § 5. Usuń `kreator.js` i `kreator-wpisu.js` (zastępuje je ekran sprawy), `wpis-zbycia-logika.js`, `migracja.js`, `podglad.js`, `zawiadomienia.js`, `listy.js`, `szablony.js`, `dokumenty-na-zadanie.js`, `konfiguracja.js`.
- e2e: scenariusze kancelarii na nowe ekrany (390 i 1440 px), w tym: zbycie akcji, w którym zbywca nie ma zgody na e-mail → po kroku 1 powiadomienie (list) w Korespondencji → „Nadano" → wpis → powiadomienia o wpisie w Korespondencji → wysyłka; zmiana treści po kroku 1 (nowe powiadomienie); edycja karty osoby w miejscu; pola dat pokazują pełny format przy obu szerokościach. Małpa na tych ekranach. **STOP.**

**Faza 4 — nowa spółka: wniosek → dokumenty → otwarcie (serwer i oba interfejsy)**
- Formularz publiczny (U-08). `psa_wnioski` z `dane_json` sprawdzanym jednym schematem, wspólnym dla portalu i kancelarii; e-mail każdego akcjonariusza obowiązkowy; sposób płatności (U-30). Dokumenty z U-03, każdy ze stanem (§ 3.3) i testem podpisu (D-086); umowa spółki wgrywana; podpis notariusza na umowie.
- Przejęcie (U-07): dotychczasowy podmiot i data przejęcia, akapit w umowie, „Otwórz rejestr" od dnia przejęcia.
- Checklista: reprezentacja według KRS; uchwała o wyborze podmiotu (podpisana, własna albo wybór w umowie spółki); zgody akcjonariuszy (system pokazuje brakujące); przy przejęciu — rozwiązanie dotychczasowej umowy i data przejęcia potwierdzone, rejestr i dokumenty od poprzednika otrzymane, stan otwarcia z nimi zgodny.
- „Przyjmij" → spółka, osoby (ostrzeżenie o powtórzonym PESEL/NIP — wybór: istniejąca czy nowa), zgody do `psa_historia_danych`, reprezentant jako osoba działająca za spółkę, konto wnioskodawcy powiązane z jego osobą. „Otwórz rejestr" → wpis `otwarcie`, pierwsza opłata za prowadzenie.
- Usuń `psa_zgloszenia`, `psa_przeniesienia*`, `trasy/zgloszenia.js`, cały podsystem przeniesień (`logika/przeniesienie.js` po przeniesieniu wzoru tabeli przejść, `server/przeniesienia.js`, trasy, ekran), `pakiet-wniosku.js`, `dokumenty-wniosku.js`, stare ekrany `zgloszenia.js`, `przeniesienia.js`, `wniosek.js`.
- e2e: zgłoszenie → dokumenty (w tym wgranie umowy spółki w PDF) → podpisy → przyjęcie → otwarcie; to samo z przejęciem (otwarcie dopiero od dnia przejęcia); wniosek założony przez pracownika. **STOP.**

**Faza 5 — portal klienta**
- § 6. Konto = osoba, zakres z danych przez `zakresKonta()` (U-23) — w miejsce trzech ról; usuń zgłoszenie nieprawidłowości (U-13). „Zaproś do portalu" na karcie osoby, „Działają za spółkę" w kokpicie (serwer i interfejs). tpay bez zmian w weryfikacji ITN. Test izolacji (§ 7 pkt 2) dla każdej trasy portalu.
- e2e: osoba działająca za spółkę, akcjonariusz i osoba w obu rolach; płatność jednym przyciskiem z kwotą; brak zakładki wniosku po przyjęciu; wybór dnia informacji (U-24); małpa na portalu. **STOP.**

**Faza 6 — porządki, bezpieczeństwo, dokumentacja**
- Resztki martwego kodu (raport § 7, nieużywane eksporty), § 7 w całości, `narzedzia/scenariusz-e2e*.js` (zastępuje je e2e).
- `README.md` od nowa (do 150 linii: uruchomienie, tryb testowy, testy, edycja wzorów, mapa dokumentów); `ARCHITEKTURA-PSA.md` od nowa (do 300 linii, stan faktyczny, z aktualnymi regułami domenowymi przeniesionymi z `CLAUDE-PSA.md` § 4); w `PRZEPISY-PSA.md` aktualizuj wyłącznie mapę w § 11 (kolumna „Element") — treści przepisów nie zmieniaj; `npm run dokumentacja`. `RAPORT-STANU-PSA.md` i ten plik przenieś do `docs/archiwum/`.
- Pełny przebieg: `npm test`, `npm run e2e`, `npm run e2e:malpa`, pokrycie; raport końcowy z metrykami § 9. **STOP.**

## 9. Metryki

| Miara | Teraz | Cel |
|---|---|---|
| Typy wpisów | 22 | 8 |
| Trasy HTTP (w tym portal) | 191 (53) | ≤ 80 (≤ 20) |
| Tabele / kolumny | 39 / 670 | 21 / ≤ 300 |
| Kolumny `psa_osoby` | 48 | ≤ 15 |
| Konta w portalu | 3 role | 1 konto na osobę, zakres z danych |
| Stany: sprawa / wniosek / opłata / przeniesienie | 6 + podstan / 7 / 4 / 8 | 5 / 4 / 3 / — |
| Typy pism | 13 | 8 |
| Pliki `server/logika/` | 41 | ≤ 25 |
| Linie frontendu | 19 378 | ≤ 10 000 |
| Pliki `.md` czytane przy pracy | 26 + `docs/` | 4 |
| Pokrycie gałęzi (serwer) | 72,9% | ≥ 80% |
| Małpa | 29 zgłoszeń | każde wyjaśnione (zmiana stanu zgodna z § 3.3 albo ograniczenie testera), 0 błędów |

Cele są orientacyjne — nie wolno ich osiągać kosztem reguły 🟢 z `PRZEPISY-PSA.md`.
