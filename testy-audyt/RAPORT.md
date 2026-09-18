# RAPORT KOŃCOWY — Audyt prototypu „Rejestr akcjonariuszy P.S.A."

> Sesja audytowa wg `SESJA-PSA-AUDYT.md`. Audyt czysto analityczny — zero zmian w kodzie
> produkcyjnym. Wszystkie testy wykonane przez API (bezpośrednie żądania HTTP, z pominięciem
> formularzy) i przez przeglądarkę (Playwright), na testowej bazie `./dane/audyt-test.db`
> (gitignored, nigdy nie dotyka produkcji). Pełne dane źródłowe: `testy-audyt/ZNALEZISKA.md` (log
> narastający, 90 pozycji Z-001…Z-361), `testy-audyt/PYTANIA-DO-LUKASZA.md` (15 pytań P-001…P-015),
> `testy-audyt/FAZA-*-WYNIK.md` (raporty per faza), `testy-audyt/zrzuty/` (zrzuty ekranu),
> `testy-audyt/endpointy-api.md` i `testy-audyt/schemat-bazy.txt` (inwentaryzacja).

---

## 1. Podsumowanie

Ścieżka główna (zgłoszenie → wniosek → podpisy → otwarcie rejestru → informacja z rejestru) **działa
od początku do końca**, a rdzeń integralności rejestru (append-only, łańcuch skrótów, odbudowa stanu,
serializacja współbieżnych wpisów) jest **solidny i nie ma żadnego znaleziska krytycznego** — to
najlepszy możliwy wynik dla warstwy, której awaria byłaby nieodwracalna. Poza tym rdzeniem audyt
znalazł **14 znalezisk KRYTYCZNYCH** rozsianych po niemal każdej fazie: dwie ścieżki podwójnego
naliczenia opłaty i brak górnej granicy kwoty (opłaty), realny wyciek danych AML/PEP przez API portalu
klienta (dane osobowe), sesję pozostającą aktywną po wylogowaniu i po zmianie hasła (bezpieczeństwo),
bramkę AML nieblokowaniu wpisu w stanie domyślnym i możliwość podmiany podpisanego dokumentu po
potwierdzeniu przez kancelarię (podpisy/AML), a także lukę pozwalającą ominąć ustawową blokadę zbycia
niepokrytych akcji już od drugiej transakcji i błąd liczący ułamkowo podzieloną akcję jako trzy pełne
głosy (ścieżka główna). **Prototyp w obecnym stanie nie nadaje się do pilotażu na prawdziwych
rejestrach klientów bez usunięcia przynajmniej znalezisk KRYTYCZNYCH z sekcji 2** — większość ma
charakter punktowy (jedna funkcja, jedno pominięte pole) i nie wymaga przebudowy architektury.

---

## 2. Znaleziska — tabela zbiorcza (posortowana wg wagi)

### 🔴 KRYTYCZNE (14)

| ID | Obszar | Opis | Podstawa |
|---|---|---|---|
| Z-005 | Ścieżka główna / onboarding | Jedyna ścieżka otwarcia rejestru dla spółki z portalu klienta („Migracja — stan otwarcia") pomija 10-punktową checklistę otwarcia i nigdy nie zbiera daty umowy/uchwały ani wzmianki o pokryciu/cenie — dotyczy KAŻDEJ spółki onboardowanej przez portal | zasada techniczna; art. 300³² §1, art. 300³³ §1 pkt 9 KSH |
| Z-006 | Ścieżka główna / portal | Brak jakiejkolwiek ścieżki (UI/API) tworzenia konta portalowego dla akcjonariusza innego niż wnioskodawca — akcjonariusz mniejszościowy nie może samodzielnie zażądać informacji z rejestru | zasada techniczna (funkcja brakująca) |
| Z-008 | Ścieżka główna | Data uchwały o wyborze podmiotu prowadzącego rejestr może być zapisana jako późniejsza niż data umowy — zero walidacji kolejności | art. 300³² §1 w zw. z art. 300³¹ §5 KSH |
| Z-012 | Ścieżka główna | Emisja z datą wpisu do KRS wcześniejszą niż rejestracja samej spółki w KRS jest przyjmowana bez zastrzeżeń — „twarda blokada" z Z-011 sprawdza tylko obecność pola, nie jego wiarygodność | art. 300³⁰ §2 KSH, sankcja art. 592 §3 KSH |
| Z-054 | Ścieżka główna / warianty | Wzmianka o niepełnym pokryciu ZNIKA po zwykłym `przeniesienie` akcji — blokada zbycia bez zgody spółki skuteczna tylko przy pierwszej transakcji, każda kolejna na tych samych akcjach przechodzi bez zgody | art. 300⁴⁰ §1 i §3 KSH; reguła domenowa 4c |
| Z-057 | Ścieżka główna / warianty | Akcja podzielona ułamkowo (1/3+1/3+1/3) liczy się w uchwale i w „Informacji z rejestru" jako TRZY pełne, niezależne głosy zamiast jednego głosu wspólnego przedstawiciela — zawyża też sumę akcji i % udziału | art. 300²³ §1 w zw. z art. 300³⁸ §3 KSH; reguła domenowa 4a |
| Z-100 | Opłaty | Dwa niezależne mechanizmy naliczania opłaty za prowadzenie rejestru (rocznicowy używany przez UI vs kalendarzowy żywy tylko w API) nie widzą się nawzajem — potwierdzone empirycznie podwójne naliczenie (2400 zł zamiast 1200 zł) dla 9 spółek testowych | zasada techniczna; `PRZEPISY-PSA.md` §9 |
| Z-101 | Opłaty | Ręczny wpis opłaty nie ma żadnej górnej granicy kwoty — zapisano 1 000 000 zł za „wpis" (stawka maks. 100 zł) | `PRZEPISY-PSA.md` §9 (stawki maksymalne) |
| Z-103 | Opłaty | Ręczny wpis opłaty przyjmuje kwotę zmiennoprzecinkową i zapisuje ją dosłownie w `kwota_grosze` | reguła domenowa 5 (grosze = INTEGER) |
| Z-150 | Dane osobowe | `GET /api/psa/portal/rejestr/:spolkaId` (realny endpoint portalu klienta) wysyła pełne dane AML/PEP/beneficjenta rzeczywistego/notatkę wewnętrzną każdego akcjonariusza do roli „spółka"/„organ" bez okrojenia; funkcja maskująca nie usuwa tych pól nawet dla roli „akcjonariusz" (peer) — wyciek niewykrywalny post factum (brak w dzienniku dostępu) | `CLAUDE-PSA.md` reguła 9, sekcja 10; art. 300³⁵ §1¹ KSH |
| Z-200 | Podpisy / AML | Bramka AML nie blokuje wpisu w stanie domyślnym `aml_status='brak'` (stan każdej nowej osoby) — blokuje wyłącznie jawnie ustawiony `niemozliwe`; dotyczy wszystkich dróg zapisu zdarzenia | `PRZEPISY-PSA.md` §9 (⚠️, ale komentarz kodu cytuje zasadę „brak środków = przeszkoda wpisu") |
| Z-205 | Podpisy / AML | Podpisany plik uznany za wiążący można podmienić PO potwierdzeniu przez kancelarię, bez śladu (brak hasha treści) — podmieniony plik trafia jako oficjalny egzemplarz do akt spółki | zasada techniczna (integralność dokumentacji) |
| Z-250 | Bezpieczeństwo | `POST /logout` tylko każe przeglądarce skasować ciasteczko — token HMAC pozostaje ważny do końca TTL (8h portal / 12h pracownik) | zasada techniczna (cykl życia sesji) |
| Z-251 | Bezpieczeństwo | Zmiana hasła nie unieważnia już wydanych tokenów sesji — standardowa reakcja na podejrzenie włamania nic nie daje | zasada techniczna (cykl życia sesji) |
| Z-360 | Klasyczne błędy | `npm audit`: 1 podatność KRYTYCZNA, 3 WYSOKIE, 3 ŚREDNIE w zależnościach produkcyjnych; wszystkie zależności zadeklarowane zakresowo (`^`), żadna nie przypięta | zasada techniczna (bezpieczeństwo łańcucha dostaw) |

### 🟠 POWAŻNE (23)

| ID | Obszar | Opis |
|---|---|---|
| Z-002 | Higiena repo | Zacommitowany plik `:memory:` (prawdziwa, pusta baza SQLite) — bug w `konfiguracja.js::sciezka()` |
| Z-003 | Ścieżka główna | Zgłoszenie publiczne wysyła zaproszenie do portalu od razu, bez oceny kancelarii — komentarze w kodzie się kłócą, przycisk „Odrzuć" nie cofa faktycznego dostępu |
| Z-004 | Ścieżka główna | Wyścig przy równoczesnym zgłoszeniu — dwa identyczne żądania tworzą dwa rekordy i po cichu unieważniają pierwszy link aktywacyjny |
| Z-007 | Ścieżka główna | Pole „sposób reprezentacji" reprezentanta bez formularza do ręcznego wypełnienia — pusty myślnik w dokumentach |
| Z-009 | Ścieżka główna | Brak ochrony przed nadpisaniem umowy o prowadzenie rejestru — zero walidacji, zero śladu zmiany |
| Z-051 | Ścieżka główna / warianty | Procent udziału bez zaokrąglenia w „Wykazie akcjonariuszy" i eksporcie `stan.csv` (dokument idący do sądu) |
| Z-055 | Ścieżka główna / warianty | `rodzaj_akcji` (w tym „niema") jest czystą etykietą — zero wpływu na liczbę głosów w dokumentach |
| Z-058 | Ścieżka główna / warianty | Kokpit spółki nie pokazuje wzmianki o pokryciu ani rodzaju akcji — te ustawowe treści widoczne wyłącznie na wydrukowanej „Informacji z rejestru" |
| Z-102 | Opłaty | Ręczny wpis opłaty przyjmuje kwotę ujemną |
| Z-108 | Opłaty | Spółki zakładane wewnętrznym kreatorem kancelarii nigdy nie dostają automatycznej opłaty za prowadzenie rejestru |
| Z-151 | Dane osobowe | Dwa pola statusu PEP (`pep`/`pep_oswiadczenie`) mają odmienny sens, ale wniosek portalowy zasila wyłącznie `pep` — pole „oświadczenia" zostaje puste |
| Z-152 | Dane osobowe | Dziennik dostępu rejestruje tylko „wyniesienie" danych, nigdy zwykłych odczytów API/ekranu (w tym portalowych) |
| Z-153 | Dane osobowe | Klauzula RODO i oświadczenie PEP generowane wyłącznie przy jednorazowym onboardingu przez wniosek portalowy — akcjonariusze dochodzący później nigdy ich nie dostają |
| Z-201 | Podpisy / AML | Pozycja checklisty „aml" (`wymagana: true`) nie jest w ogóle sprawdzana serwerowo przed dokonaniem wpisu |
| Z-202 | Podpisy / AML | Termin przeglądu okresowego AML (12 mies.) jest czysto kosmetyczny — nigdy nie wpływa na bramkę |
| Z-204 | Podpisy / AML | `POST /:id/otworz-rejestr` w ogóle nie zwraca ostrzeżeń walidacji (w tym AML) w odpowiedzi |
| Z-253 | Bezpieczeństwo | Brak kontroli sygnatury treści pliku przy 2 z 4 tras uploadu (skany AML, załącznik umowy) — HTML ze `<script>` nazwany `.pdf` przyjęty jako załącznik umowy |
| Z-305 | Integralność | „Stan na" z dokładnością do minuty (wymagany specyfikacją) istnieje wyłącznie w API — UI kokpitu redukuje do samej daty |
| Z-306 | Integralność | Mechanizm godzinowy zależy w 100% od zmiennej `TZ` procesu serwera, bez walidacji przy starcie |
| Z-350 | Klasyczne błędy | Kartoteka osób bez ochrony przed duplikatem — dwie różne osoby mogą mieć ten sam PESEL bez ostrzeżenia |
| Z-351 | Klasyczne błędy | Założenie sprawy bez ochrony przed duplikatem — dwie niezależne sprawy z własnym biegnącym terminem dla tego samego zdarzenia |
| Z-353 | Klasyczne błędy | Zerwanie połączenia klienta w trakcie zapisu nie przerywa zapisu po stronie serwera — ryzyko duplikatu przy „retry po błędzie sieci" w połączeniu z Z-350/Z-351 |
| Z-354 | Klasyczne błędy | Brak limitu długości pola „nazwa" spółki — nazwa 300-znakowa psuje układ pulpitu/listy spółek/kolejki spraw |

### 🟡 DROBNE (12)

Z-001 (`GET /api/psa/meta` publiczny — metadane systemu, bez PII, ostatecznie DROBNY po pogłębieniu w FAZA 5/Z-252), Z-017 (autozapis 800ms bez beforeunload), Z-018 (brak `label`/`for` — WCAG), Z-019 (data otwarcia rejestru ustawiana przed pierwszym wpisem), Z-053 (brak sygnału przy braku beneficjenta rzeczywistego osoby prawnej), Z-104 (nienumeryczna kwota → 500 zamiast 400), Z-109 (pole `okres` bez walidacji formatu), Z-203 (bramka AML nie rozróżnia osoby fizycznej/prawnej), Z-254 (błędy multer po angielsku), Z-255 (malformed JSON → 500 zamiast 400), Z-357 (przypomnienia o odnowieniu bez automatycznego wyzwalacza), Z-359 (brak mechanizmu oznaczania danych jako testowe/demo).

### 🟢 POZYTYWNE — potwierdzone jako działające poprawnie (41)

Blokada spółki nie-P.S.A. (Z-010); twarda blokada wpisu akcji bez daty KRS (Z-011); bilans akcji na żywo, transakcyjny (Z-013); maskowanie PESEL/adres/data urodzenia w informacji z rejestru i systematycznie w API dla wszystkich ról (Z-014, Z-155); brak duplikatu przy podwójnym złożeniu wniosku (Z-015); kolejność podpisów wymuszona serwerowo (Z-016); rada dyrektorów poprawnie adresowana we wszystkich dokumentach (Z-050); osoba prawna poprawnie odróżniona od fizycznej z poprawną walidacją krzyżową beneficjenta rzeczywistego (Z-052); bilans ułamków solidnie zabezpieczony wielowarstwowo (Z-056); „jedno żądanie = jedna opłata" (Z-105); brak opłaty za odmowę wpisu i zajęcie egzekucyjne (Z-106); rok prowadzenia liczony konsekwentnie od rocznicy, idempotentnie (Z-107); wydruki nie dziedziczą wycieku AML (Z-156); zgoda na e-mail poprawnie odróżniona od posiadania adresu (Z-157); pozycje „na żądanie" strukturalnie wymagają osobnej sprawy (Z-158); integralność podpisanych dokumentów poza oknem z Z-205 (Z-206); forma umowy poprawnie dopuszcza zwykły skan (Z-207); rozdzielenie ścieżek podpis-umowy vs AML architektonicznie poprawne (Z-209); izolacja portalu — zero IDOR na 94 endpointach (Z-256); kontrola dostępu do wydanej informacji z rejestru (Z-257); rate limiting logowania działa (Z-258); brak path traversal (Z-259); limit rozmiaru pliku egzekwowany (Z-260); logi/błędy bez PII/stack trace (Z-261); katalog dokumentów nieserwowany statycznie (Z-262); mass assignment zablokowany (Z-263); sesje portal/kancelaria odseparowane (Z-264); wyzwalacze append-only skuteczne nawet przy bezpośrednim SQL (Z-300); FOREIGN KEY jako dodatkowa warstwa ochrony (Z-301); weryfikacja integralności realnie przelicza łańcuch i wykrywa manipulacje (Z-302); odbudowa stanu identyczna z materializacją (Z-303); wyścig na jednoczesnych wpisach poprawnie serializowany (Z-304); stan na dzień odporny na strefę czasową (Z-307); sprostowanie tworzy nowe zdarzenie, nie modyfikuje poprzedniego (Z-308); PESEL potwierdzony jako fakultatywny (Z-154); dokonanie wpisu odporne na współbieżność (Z-352); puste stany obsłużone poprawnie (Z-355); niepowodzenie wysyłki e-mail zawsze widoczne pracownikowi (Z-356); termin 7-dniowy liczony kalendarzowo z pełnym nowym biegiem po wznowieniu (Z-358); walidacja liczb/dat/znaków polskich na serwerze niezależna od front-endu (Z-361).

Pełne opisy (co zrobiłem → co się stało → co powinno się stać → podstawa) dla wszystkich powyższych
pozycji: `testy-audyt/ZNALEZISKA.md`.

---

## 3. Opis znalezisk KRYTYCZNYCH

> Pełne kroki odtworzenia (żądanie/odpowiedź, linie kodu) dla każdej pozycji poniżej —
> `testy-audyt/ZNALEZISKA.md`, pod tym samym numerem Z-xxx. Tu: streszczenie wystarczające do
> podjęcia decyzji, bez duplikowania całej treści.

**Z-005 — brak checklisty otwarcia dla spółek z portalu.** Jedyny przycisk widoczny w kokpicie nowo
przyjętej spółki to „Migracja — stan otwarcia", ekran opisany w kodzie jako narzędzie do przenoszenia
danych z INNEGO rejestru, z datami historycznymi, bez pól „pokrycie"/„cena emisyjna" i bez żadnej z
10 pozycji checklisty otwarcia, które ma analogiczny ekran dla spółek zakładanych ręcznie przez
pracownika. Przycisk znika bezpowrotnie po pierwszym zdarzeniu. Dotyczy to każdej spółki onboardowanej
głównym kanałem biznesowym aplikacji (portal klienta).

**Z-006 — brak konta portalowego dla akcjonariusza niebędącego wnioskodawcą.** Model danych zakłada
role „spółka"/„akcjonariusz" w `psa_konta`, ale nie istnieje żadna trasa (UI ani API) tworząca taki
wiersz dla kogokolwiek innego niż osoba, która złożyła wniosek. Praktyczny skutek: akcjonariusz
mniejszościowy nie może samodzielnie zażądać informacji z rejestru — jedyne obejście to „papierowa"
obsługa przez pracownika.

**Z-008 — brak walidacji kolejności dat umowy/uchwały.** `PUT /api/psa/spolki/:id` przyjmuje
`data_uchwaly_wyboru` późniejszą niż `data_umowy`, mimo że logicznie umowę zawiera się z podmiotem już
wybranym uchwałą.

**Z-012 — data wpisu emisji do KRS niewiarygodna względem daty rejestracji spółki.** System sprawdza
wyłącznie obecność pola `data_wpisu_krs`, nigdy jego sensowność względem `data_utworzenia_spolki` tej
samej spółki — dało się zapisać emisję „wpisaną do KRS" 26 lat przed zarejestrowaniem samej spółki.

**Z-054 — blokada zbycia niepokrytych akcji omijalna od drugiej transakcji.** Wzmianka o niepełnym
pokryciu jest atrybutem akcji i powinna przechodzić niezmieniona przy każdym przeniesieniu (dokładnie
tak, jak już działa to dla `przeniesienie_ulamka`) — ale handler zwykłego `przeniesienie` nie
przekazuje pola `pokryta` do nabywcy. Efekt: pierwsze zbycie niepokrytych akcji jest poprawnie
zablokowane bez zgody spółki, ale KAŻDE kolejne zbycie tych samych, wciąż nieopłaconych akcji
przechodzi już bez żadnej zgody i bez ostrzeżenia.

**Z-057 — ułamek akcji liczony jako wielokrotność głosów.** Ta sama, fizycznie jedna akcja podzielona
na 1/3+1/3+1/3 generuje w uchwale akcjonariuszy i w „Informacji z rejestru" trzy pełne, niezależne
głosy zamiast jednego głosu przypisanego wspólnemu przedstawicielowi — nawet po jego ustanowieniu.
Zawyża też sumę akcji i procent udziału w kokpicie (widoczne na żywo: „Razem: 103" zamiast 101).

**Z-100 — dwa niewidzące się mechanizmy naliczania opłaty za prowadzenie rejestru.** Mechanizm
rocznicowy (używany przez UI) i mechanizm kalendarzowy (żywy tylko w API, brak przycisku w UI)
sprawdzają idempotencję po różnych kolumnach. Wywołanie kalendarzowego naliczyło dodatkową opłatę 1200
zł dla wszystkich 9 aktywnych spółek testowych, mimo istniejącej już opłaty rocznicowej.

**Z-101 — brak górnej granicy kwoty przy ręcznym wpisie opłaty.** Zapisano 1 000 000 zł za „wpis"
(stawka maksymalna 100 zł) bez żadnego błędu. Identyczna walidacja istnieje już dla stawki domyślnej
kancelarii, ale nie jest powtórzona przy pojedynczym ręcznym wpisie.

**Z-103 — kwota opłaty jako liczba zmiennoprzecinkowa.** Ten sam endpoint przyjął `kwota_grosze:
100.7` i zapisał ją dosłownie — narusza wprost regułę domenową nr 5 (grosze = INTEGER).

**Z-150 — wyciek danych AML/PEP przez API portalu klienta.** `GET /api/psa/portal/rejestr/:spolkaId`
zwraca pełne pola AML (`aml_status`, `aml_data`, `aml_notatka`), PEP (`pep`, `pep_opis`,
`pep_oswiadczenie`) i `beneficjent_rzeczywisty_id` każdego akcjonariusza do roli „spółka"/„organ" bez
okrojenia. Gorzej: funkcja maskująca dla roli „akcjonariusz" (peer) usuwa tylko PESEL/adres/datę
urodzenia — pola PEP i beneficjenta rzeczywistego wyciekają RÓWNIEŻ do innego akcjonariusza. Zdarzenie
nie zostawia śladu w dzienniku dostępu, więc skala ewentualnego dotychczasowego wycieku jest
niemożliwa do ustalenia.

**Z-200 — bramka AML nieskuteczna w stanie domyślnym.** `aml_status='brak'` — stan KAŻDEJ nowej osoby,
dopóki pracownik jej ręcznie nie zmieni — generuje przy transakcji wyłącznie ostrzeżenie, nigdy
blokadę. Blokuje wyłącznie jawnie ustawiony `niemozliwe`. Dotyczy to zarówno bezpośredniego API, jak i
„oficjalnej" ścieżki UI kancelarii (`POST /:id/wpisz`) oraz otwarcia rejestru z pominięciem workflow
sprawy.

**Z-205 — podmiana podpisanego dokumentu po potwierdzeniu.** Klient może wgrać na ten sam dokument
zupełnie inny plik PO tym, jak kancelaria potwierdziła podpis — serwer to przyjmuje, znacznik
potwierdzenia zostaje niezmieniony (teraz fałszywie przypisany do nowej treści), a podmieniony plik
trafia jako oficjalny egzemplarz do akt spółki. Brak nawet hasha treści do wykrycia podmiany.

**Z-250 / Z-251 — sesja przeżywa wylogowanie i zmianę hasła.** `POST /logout` tylko każe przeglądarce
skasować ciasteczko — token HMAC pozostaje ważny do końca TTL (8h portal / 12h pracownik). Zmiana
hasła (standardowa reakcja na podejrzenie włamania) też nie unieważnia już wydanych tokenów. Jedyny
dziś skuteczny sposób odcięcia dostępu to dezaktywacja całego konta.

**Z-360 — podatności w zależnościach produkcyjnych.** `npm audit` w głównym repozytorium: 1 podatność
KRYTYCZNA, 3 WYSOKIE, 3 ŚREDNIE (łańcuch bcrypt/nodemailer/express-qs/tar), wszystkie zależności
zadeklarowane zakresowo (`^`), żadna nie przypięta do konkretnej, zweryfikowanej wersji.

---

## 4. Tabela pokrycia reguł domenowych (sekcja 4, `CLAUDE-PSA.md`)

Ustalona w FAZA 0, zweryfikowana praktycznie w kolejnych fazach.

| # | Reguła (skrót) | Status | Powiązane znaleziska |
|---|---|---|---|
| 1 | append-only `psa_zdarzenia` | **TAK** | potwierdzone praktycznie w FAZA 6 (Z-300) |
| 2 | stan = pochodna zdarzeń, odbudowa=stan bieżący | **TAK** | potwierdzone praktycznie w FAZA 6 (Z-303) |
| 3 | bilans akcji, odmowa zapisu przy naruszeniu | **TAK** | potwierdzone w FAZA 1 (Z-013) i FAZA 1 warianty (Z-056) |
| 4 | numery FIFO, ułamek→numer wskazany | **TAK** | — |
| 4a | ułamki INTEGER, CHECK 1 numer/wiersz | **TAK** (mechanizm sumy/CHECK), **ALE głosy błędne** | Z-056 (pozytywne — bilans), **Z-057 (KRYTYCZNY — głosy)** |
| 4b | współuprawnieni, przedstawiciel nieblokujący | **TAK** (zapis), **ALE nieużywany przy głosowaniu** | Z-057 |
| 4c | pokrycie akcji, zgoda przy niepełnym pokryciu, równomierne zaliczanie | **CZĘŚCIOWO → luka potwierdzona** | **Z-054 (KRYTYCZNY)** — blokada omijalna od 2. transakcji; brak algorytmu zaliczania wkładów potwierdzony (Z-054 opis) |
| 5 | grosze, zero floatów | **TAK w schemacie, NIE przy ręcznym wpisie opłaty** | **Z-103 (KRYTYCZNY)** |
| 6 | data_zdarzenia ≠ data_wpisu | **TAK** | Z-019 (drobne zastrzeżenie co do momentu ustawienia) |
| 7 | termin 7 dni w terminy.js, zawieszany | **TAK** | potwierdzone empirycznie w FAZA 7 (Z-358) |
| 8 | zajęcie z urzędu, bez opłaty/powiadomienia | **TAK** | potwierdzone w FAZA 2 (Z-106) |
| 9 | maskowanie danych wrażliwych dla innych akcjonariuszy | **CZĘŚCIOWO** — PESEL/adres TAK, AML/PEP NIE | Z-014, Z-155 (pozytywne) vs **Z-150 (KRYTYCZNY)** |
| 10 | kartoteka wspólna, jeden inwestor raz | **NIE — potwierdzona luka** | **Z-350 (POWAŻNY)** — brak deduplikacji PESEL |
| 11 | walidacja formy prawnej PSA | **TAK** | potwierdzone empirycznie (Z-010) |
| 12 | akcje nie istnieją przed wpisem KRS | **CZĘŚCIOWO** — obecność pola TAK, wiarygodność NIE | Z-011 (pozytywne) vs **Z-012 (KRYTYCZNY)** |
| 13 | wpis deklaratoryjny vs konstytutywny — inna checklista/zawiadomienie | **NIE — martwa etykieta** (ustalone w FAZA 0, nie retestowane praktycznie w kolejnych fazach) | patrz FAZA 0 |
| 14 | brak pośrednictwa w płatnościach/dywidendach | **TAK** | potwierdzone w FAZA 2 (brak pojęcia VAT/dywidend w module) |

---

## 5. Zestawienie opłat (wszystkie naliczenia testowe, FAZA 2)

Aplikacja **nie rozróżnia netto/brutto** — moduł nie ma pojęcia VAT (świadomie usunięte w migracji 17,
zgodnie z regułą domenową 14). Wszystkie kwoty poniżej to jedyne kwoty, jakie zna aplikacja.

| # | Scenariusz | Kwota naliczona | Oczekiwane | Zgodne? |
|---|---|---|---|---|
| 1 | Przeniesienie akcji do 3 nabywców w 1 żądaniu | 100 zł (1×) | 100 zł | ✅ |
| 2 | Odmowa wpisu | 0 zł | 0 zł | ✅ |
| 3 | Zajęcie egzekucyjne z urzędu | 0 zł | 0 zł | ✅ |
| 4 | Otwarcie rejestru — wniosek portalowy | 1200 zł (prowadzenie), 0 zł (wpis) | do rozstrzygnięcia (P-007) | zgłoszone jako pytanie |
| 5 | Otwarcie rejestru — kreator wewnętrzny | 0 zł | niespójne z # 4 | ⚠️ Z-108 |
| 6 | Rok liczony od 20 grudnia | 1200 zł (1×, nie 2×) | 1200 zł raz | ✅ |
| 7 | Odnowienie roczne, 2× pod rząd | 1200 zł, potem 0 | idempotentne | ✅ |
| 8 | Naliczenie kalendarzowe na spółkach z już naliczoną opłatą rocznicową | +1200 zł dodatkowo ×9 spółek | 0 zł | 🔴 **Z-100** |
| 9 | Ręczny wpis opłaty, kwota powyżej maksimum | 1 000 000 zł | odrzucone | 🔴 **Z-101** |
| 10 | Ręczny wpis opłaty, kwota ujemna | -50 zł | odrzucone | 🔴 **Z-102** |
| 11 | Ręczny wpis opłaty, kwota zmiennoprzecinkowa | 100,7 grosza | zaokrąglone/odrzucone | 🔴 **Z-103** |
| 12 | Ręczny wpis opłaty, kwota nienumeryczna | błąd 500 | błąd 400 | ⚠️ Z-104 |
| 13 | Informacja z rejestru pobrana wielokrotnie | 1× (zweryfikowane w kodzie, nie empirycznie) | 1× | ✅ |

Wszystkie automatyczne ścieżki naliczania korzystają z jednego źródła stawek (`server/logika/przepisy.js`)
i nigdy nie przekroczyły stawki maksymalnej — jedyne drogi do zawyżenia to Z-100 (podwójne naliczenie
automatyczne) i Z-101/Z-102/Z-103 (brak walidacji przy ręcznym wpisie pojedynczej opłaty). Wszystkie
opłaty testowe demonstrujące błąd zostały po udokumentowaniu oznaczone `anulowana` w bazie testowej.

---

## 6. Inwentaryzacja danych osobowych

Pełna tabela pole→podstawa: `testy-audyt/FAZA-3-WYNIK.md` sekcja 1 (odtworzona w skrócie niżej).
Status: **OBOWIĄZKOWE** (wymóg wprost z art. 300³³ §1), **FAKULTATYWNE Z KATALOGU** (na żądanie/
warunkowo wg ustawy), **SPOZA KATALOGU** (inna podstawa niż KSH — wskazana w kolumnie uwag).

| Pole | Status | Podstawa poza KSH (jeśli spoza katalogu) |
|---|---|---|
| firma/nazwa, siedziba, adres spółki; sąd i KRS; data rejestracji | OBOWIĄZKOWE | — |
| nazwisko/imię albo firma akcjonariusza; adres (jeden z 4 wariantów) | OBOWIĄZKOWE | — |
| seria, numery, rodzaj akcji; data wpisu emisji do KRS; wzmianka o pokryciu | OBOWIĄZKOWE | — |
| e-mail akcjonariusza (do celów ustawowych) | FAKULTATYWNE Z KATALOGU | wymaga jawnej, potwierdzonej zgody (Z-157 — poprawnie) |
| przejście akcji/praw zastawniczych; prawo głosu zastawnika; wykreślenie obciążenia | FAKULTATYWNE Z KATALOGU | wnioskowe, strukturalnie wymuszone (Z-158 — poprawnie) |
| dodatkowe postanowienia umowy spółki | FAKULTATYWNE Z KATALOGU | — |
| PESEL, data urodzenia | **SPOZA KATALOGU** | potrzeba identyfikacyjna/AML; fakultatywne (Z-154), maskowane innym akcjonariuszom (Z-155) |
| NIP, REGON, numer/nazwa rejestru (osoba prawna) | SPOZA KATALOGU | identyfikacja administracyjna |
| dane reprezentanta spółki (PESEL, adres, dowód, rodzice) | SPOZA KATALOGU | potrzebne do wzorów pism podpisywanych przez reprezentanta |
| `aml_status`, `aml_data`, `aml_notatka`, `aml_data_przegladu` | SPOZA KATALOGU | ustawa AML — **podstawa inna niż KSH; dziś błędnie w tym samym widoku co dane rejestru (Z-150)** |
| `beneficjent_rzeczywisty_id` | SPOZA KATALOGU | ustawa AML art. 2 ust. 2 pkt 1 |
| `pep`, `pep_opis`, `pep_oswiadczenie`, `pep_oswiadczenie_data` | SPOZA KATALOGU | ustawa AML art. 46; pola poprawnie zaprojektowane, ale rozjeżdżają się przy onboardingu (Z-151) |
| `uwagi` (notatka wewnętrzna) | SPOZA KATALOGU | potrzeba operacyjna kancelarii — jawnie wykluczona z wydruków, ale NIE z surowego API (Z-150) |
| `kapitał_akcyjny_grosze`, dane kontaktowe operacyjne | SPOZA KATALOGU | potrzeba operacyjna |

**Żadne pole nie zostało znalezione bez wskazanej podstawy** — problemem nie jest nadmiarowe zbieranie
danych, tylko (a) niewłaściwe udostępnianie danych AML/PEP przez API (Z-150) i (b) niespójność między
polami przy onboardingu (Z-151).

---

## 7. PYTANIA DO ŁUKASZA

Pełna treść z pełnym kontekstem: `testy-audyt/PYTANIA-DO-LUKASZA.md`. Streszczenie z wariantami:

1. **P-001** — Czy przy wpisie transakcyjnym dot. akcjonariusza-osoby prawnej wymagamy identyfikacji
   beneficjenta rzeczywistego (dziś: pole w pełni opcjonalne, zero ostrzeżenia)? *Warianty: (a) tak,
   dodać miękkie ostrzeżenie; (b) tak, blokować; (c) nie, zostawić jak jest.*
2. **P-002** — Czy akcja `niema` ma być automatycznie pozbawiona głosu, czy zależy to od umowy spółki
   (której system dziś nie ewidencjonuje)? *Warianty: (a) automatycznie bez głosu; (b) zależne od
   nowego pola „pozbawiona głosu wg umowy"; (c) zostawić jak jest (głos jak zwykła akcja).*
3. **P-003** — Czy automatyczne zaproszenie „od razu" po zgłoszeniu (bez oceny kancelarii) ma
   zostać, czy przywrócić etap decyzyjny? *Warianty: (a) zostaje, ale „Odrzuć" ma faktycznie cofać
   dostęp; (b) przywrócić etap oceny przed zaproszeniem.*
4. **P-004** — Jaki ma być docelowy sposób nadawania dostępu portalowego akcjonariuszom innym niż
   wnioskodawca (dziś: brak jakiejkolwiek ścieżki)? *Warianty: (a) kancelaria zaprasza ręcznie z
   kartoteki; (b) spółka zaprasza sama ze swojego konta; (c) automatycznie przy wpisaniu objęcia na
   nową osobę.*
5. **P-005** — Czy niezgodność dat uchwała/umowa i nadpisanie umowy bez śladu mają być twardą
   blokadą, czy ostrzeżeniem? *Warianty: (a) blokada; (b) ostrzeżenie wymagające potwierdzenia; (c)
   zmiana umowy ma iść przez `psa_zdarzenia` jak inne zmiany danych spółki.*
6. **P-006** — Jaka ma być reguła walidacji krzyżowej `data_wpisu_krs` emisji względem daty rejestracji
   spółki? *Warianty: (a) `≥ data_utworzenia_spolki` z dopuszczeniem równości dla emisji
   założycielskiej; (b) inna reguła.*
7. **P-007** — Czy wprowadzenie stanu otwarcia to wpisy na żądanie (każdy odpłatny), czy czynność
   objęta wyłącznie opłatą za prowadzenie? Dwie ścieżki dają dziś dwie różne odpowiedzi w kodzie.
   *Warianty: (a) tylko prowadzenie — ujednolicić obie ścieżki; (b) każde zdarzenie osobno płatne.*
8. **P-008** — Czy martwy w UI endpoint kalendarzowy `/naliczenie-roczne` (źródło Z-100) ma zostać
   usunięty, zabezpieczony, czy pozostawiony? *Warianty: (a) usunąć; (b) zabezpieczyć idempotencją
   współdzieloną z mechanizmem rocznicowym; (c) zostawić bez zmian.*
9. **P-009** — Czy dziennik dostępu ma objąć też zwykłe odczyty portalowe, nie tylko formalne
   wydanie/eksport/pobranie? *Warianty: (a) tak, rozszerzyć; (b) nie, zostawić wąski zakres.*
10. **P-010** — Jak naprawić rozjazd pól PEP przy przejęciu wniosku, i czy dokumenty RODO/PEP mają
    powstawać też dla akcjonariuszy dochodzących po założeniu spółki? *Warianty: (a) wartość z
    formularza → `pep_oswiadczenie`; (b) generować dokumenty RODO/PEP przy każdym nowym wejściu do
    rejestru, nie tylko przy założeniu.*
11. **P-011** — Czy „stan na" z dokładnością do minuty ma wrócić do UI kokpitu, i czy `TZ` serwera
    ma być programowo wymuszony? *Warianty: (a) przywrócić pole godziny w UI; (b) zaktualizować
    specyfikację do obecnego stanu; (c) wymusić `TZ=Europe/Warsaw` niezależnie od hostingu.*
12. **P-012** — Czy zdalna identyfikacja akcjonariusza (dane + opcjonalny skan wgrywany przez
    pracownika + samoidentyfikacja + osąd pracownika) spełnia wymogi AML, czy potrzebna jest metoda
    dająca wyższą pewność? *Warianty: (a) obecny zestaw wystarcza; (b) wymagać podpisu kwalifikowanego
    akcjonariusza; (c) weryfikacja wideo/przelew referencyjny/stawiennictwo; (d) umożliwić
    akcjonariuszowi samodzielne wgranie skanu (dziś tylko pracownik może).*
13. **P-013** — Czy status AML `brak` powinien blokować wpis tak jak `niemozliwe`? *Warianty: (a)
    tak, blokować z odrębnym komunikatem; (b) zostawić jako ostrzeżenie (decyzja przy pracowniku).*
14. **P-014** — Czy dezaktualizacja AML i brak beneficjenta rzeczywistego mają blokować wpis?
    *Warianty: (a) tak dla obu; (b) tylko informacyjnie; (c) różnicować.*
15. **P-015** — Czy potrzebny jest mechanizm oznaczania danych jako testowe/demo na produkcji, czy
    wystarczy organizacyjne zobowiązanie do testowania na osobnej instalacji? *Warianty: (a) dodać
    plakietkę/flagę „testowa"; (b) wyłącznie zasada organizacyjna.*

---

## 8. Czego nie udało się przetestować

- **Import z realnego API KRS** — brak dostępu do sieci zewnętrznej w środowisku audytowym; kod
  poprawnie obsługuje ten przypadek ręcznym fallbackiem (dane spółki wypełniane ręcznie).
- **Rzeczywista wysyłka e-mail** — brak konfiguracji SMTP w środowisku; zweryfikowano wyłącznie
  zachowanie offline (poprawne — błąd zawsze widoczny pracownikowi, nigdy nie ginie po cichu) i treść
  generowanych dokumentów (klauzula RODO, zawiadomienia).
- **Logowanie portalowe jako akcjonariusz mniejszościowy w prawdziwym przepływie** — zablokowane
  strukturalnie przez Z-006 (brak ścieżki tworzenia takiego konta), nie przez ograniczenie środowiska.
  Zastąpione dowodem równoważnym: bezpośrednim wywołaniem tej samej funkcji renderującej z rolą
  ustawianą identycznie jak z sesji.
- **Integracja płatności online (tpay)** — operator nieskonfigurowany w środowisku testowym; webhook
  ITN i odpytanie statusu nie zostały przetestowane (poza zakresem checklisty tej fazy).
- **Pełny zakres martwych funkcji** — sprawdzono 7 głównych ekranów kancelarii, nie każdy
  modal/podekran.
- **Praktyczna wykorzystywalność poszczególnych CVE z `npm audit`** — wypisano tylko liczby i wagę.
- **500 MB upload** — testowano margines 21/20 MB zamiast pełnego limitu z checklisty.
- **Ograniczenie liczby prób logowania przy wielu instancjach serwera** — środowisko jednoinstancyjne.
- **Rzeczywista treść zakresu AML dla emisji traktowanych jak transakcje** oraz **podstawa prawna
  notariusza jako instytucji obowiązanej** — `PRZEPISY-PSA.md` §9 oznaczone ⚠️, wymaga potwierdzenia
  przy tekście ustawy AML; zgodnie z zasadami sesji nie stanowi dziś podstawy żadnej oceny/blokady.

---

## Załączniki

- `testy-audyt/ZNALEZISKA.md` — pełne opisy wszystkich 90 znalezisk.
- `testy-audyt/PYTANIA-DO-LUKASZA.md` — pełna treść 15 pytań z kontekstem.
- `testy-audyt/FAZA-0-INWENTARYZACJA.md`, `endpointy-api.md`, `schemat-bazy.txt` — inwentaryzacja.
- `testy-audyt/FAZA-1-S1-WYNIK.md`, `FAZA-1-WARIANTY-WYNIK.md`, `FAZA-2-WYNIK.md`, `FAZA-3-WYNIK.md`,
  `FAZA-4-WYNIK.md`, `FAZA-5-WYNIK.md`, `FAZA-6-WYNIK.md`, `FAZA-7-WYNIK.md` — raporty per faza.
- `testy-audyt/zrzuty/` — zrzuty ekranu (89 z FAZA 1, kilkanaście z faz 3–7).
- `testy-audyt/skrypty/` — pomocnicze skrypty testowe (Playwright + API), nietrwałe narzędzie audytu.
