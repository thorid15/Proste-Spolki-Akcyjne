# DECYZJE.md — dziennik decyzji projektowych

> Append-only. To jest **rejestr**, nie analiza — wpisy nie oceniają decyzji ani nie proponują
> zmian. Nowe decyzje dopisuje się na końcu sekcji „Decyzje", z kolejnym numerem `D-0xx`; istniejące
> wpisy się nie zmieniają (poprawki jako nowy wpis odwołujący się do starego).
>
> Zasilony z trzech źródeł, w tej kolejności: (1) odpowiedzi Łukasza w
> `testy-audyt/PYTANIA-DO-LUKASZA.md`, (2) historia migracji (`server/migracje.js`) i git log,
> (3) `README.md`. **Stan na dziś (2026-09-18): źródło 1 jest puste** — żadne z 15 pytań P-001…P-015
> nie ma jeszcze odpowiedzi Łukasza pod blokiem „Pytanie" w pliku źródłowym. Wszystkie 15 trafia więc
> do sekcji „Decyzje otwarte", nie do rejestru decyzji — nic tu nie jest zgadywane. Gdy Łukasz
> odpowie, kolejna sesja dokumentacyjna przenosi je stąd jako nowe wpisy `D-0xx`.

---

## Decyzje

### D-001 — Kolumna `psa_stan_akcji.kategoria` spoza katalogu specyfikacji
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr
- Decyzja: dodać kolumnę `kategoria` (`nieobjeta`/`akcjonariusz`/`umorzona`) do `psa_stan_akcji`, mimo
  że `CLAUDE-PSA.md` sekcja 5 jej nie przewiduje.
- Uzasadnienie: bez niej nie da się odróżnić akcji nieobjętych od umorzonych (obie miałyby
  `osoba_id IS NULL`), a bilans akcji przestaje być sprawdzalny jednym warunkiem.
- Odrzucono: brak — uznano za wymóg techniczny reguły domenowej nr 3, nie opcję.
- Źródło: sesja Claude Code (odstępstwo 1)
- Skutek w kodzie: `server/migracje.js` (migracja 1), `server/logika/stan.js`.

### D-002 — Kolumna `psa_spolki.forma_prawna` spoza katalogu specyfikacji
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr
- Decyzja: dodać kolumnę `forma_prawna` do `psa_spolki`.
- Uzasadnienie: potrzebna do reguły domenowej nr 11 (walidacja, że rejestr prowadzi się wyłącznie
  dla P.S.A.) oraz do kontroli danych importowanych z KRS.
- Odrzucono: brak.
- Źródło: sesja Claude Code (odstępstwo 2)
- Skutek w kodzie: `server/migracje.js` (migracja 1), `server/trasy/spolki.js`.

### D-003 — Odczytanie reguły bilansu akcji jako „przypisane + nieobjęte + umorzone = wyemitowane”
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr
- Decyzja: literalne brzmienie specyfikacji („suma akcji akcjonariuszy = wyemitowane − umorzone”)
  egzekwować jako niezmiennik na PEŁNYM zakresie emisji (przypisane+nieobjęte+umorzone=wyemitowane,
  szczelne pokrycie), z ostrzeżeniem (nie blokadą) przy niezerowym stanie „nieobjęte”.
- Uzasadnienie: między zdarzeniami `emisja` i `objecie` istnieje realny stan „wyemitowane, jeszcze
  nieobjęte” — literalna reguła obowiązuje dopiero po objęciu całej serii.
- Odrzucono: brak.
- Źródło: sesja Claude Code (odstępstwo 3)
- Skutek w kodzie: `server/logika/stan.js`, `server/logika/walidacje.js`.

### D-004 — `emisja` i `objecie` pozostają dwoma osobnymi zdarzeniami
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr
- Decyzja: nie łączyć emisji i objęcia w jeden krok kreatora.
- Uzasadnienie: wariant łączony wymagałby identyfikatorów zastępczych w łańcuchu zdarzeń — uznano to
  za gorszą wymianę niż licznik akcji nieobjętych widoczny w kokpicie.
- Odrzucono: emisja+objęcie jako jedno zdarzenie.
- Źródło: sesja Claude Code (odstępstwo 4)
- Skutek w kodzie: `server/logika/typy-zdarzen.js`, `publiczne/js/kreator.js`.

### D-005 — Ścieżka zapisu zdarzeń `POST /api/psa/spolki/:id/zdarzenia` zostaje po sprincie 2
- Data: 2026-08-04 (sprint 2)
- Obszar: rejestr
- Decyzja: nowy endpoint sprawowy (`POST /sprawy/:id/wpisz`, sprint 2) opakowuje starszą ścieżkę
  bezpośrednią, nie zastępuje jej — ta zostaje jako szybka ścieżka wewnętrzna.
- Uzasadnienie: specyfikacja pierwotnie umieszczała wpis pod trasą sprawową, ale sprawy weszły
  dopiero w sprincie 2; usuwanie działającej ścieżki było zbędne.
- Odrzucono: usunięcie starej trasy po wdrożeniu workflow spraw.
- Źródło: sesja Claude Code (odstępstwo 5)
- Skutek w kodzie: `server/trasy/spolki.js` (`POST /:id/zdarzenia`, `POST /:id/zdarzenia/podglad`).

### D-006 — `dane_json` zdarzenia nie zawiera PESEL-u ani adresów
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr / dane osobowe
- Decyzja: snapshot zdarzenia niesie wyłącznie `osoba_id` i oznaczenie strony, nie kopiuje danych
  wrażliwych do niezmienialnego łańcucha.
- Uzasadnienie: utrwalanie PESEL-u w łańcuchu skrótów bez możliwości poprawki niepotrzebnie
  zabetonowałoby dane osobowe — tożsamość żyje w `psa_osoby`, zdarzenie się do niej odwołuje.
- Odrzucono: pełny snapshot danych osoby w każdym zdarzeniu.
- Źródło: sesja Claude Code (odstępstwo 6)
- Skutek w kodzie: `server/rejestr.js`, `server/logika/stan.js`.

### D-007 — Serializacja skrótu zdarzenia z separatorem U+001F
- Data: 2026-08-04 (sprint 1)
- Obszar: rejestr
- Decyzja: przy liczeniu skrótu pola sklejać separatorem U+001F, nie samą konkatenacją.
- Uzasadnienie: samo sklejenie (`id + spolka_id + …`) pozwala przesunąć treść między sąsiednimi
  polami bez zmiany skrótu; separator, którego `JSON.stringify` nie wypuszcza dosłownie, domyka
  granice pól.
- Odrzucono: prosta konkatenacja pól wg dosłownego brzmienia specyfikacji.
- Źródło: sesja Claude Code (odstępstwo 7)
- Skutek w kodzie: `server/logika/lancuch.js`.

### D-008 — Nagłówek `X-User-Name` kodowany procentowo (przed sesją bezstanową)
- Data: 2026-08-04 (sprint 1)
- Obszar: uwierzytelnianie
- Decyzja: wartość nagłówka identyfikującego autora kodować `encodeURIComponent`.
- Uzasadnienie: nagłówki HTTP przenoszą wyłącznie ISO-8859-1 — `fetch` odrzucał wartości takie jak
  „Łukasz Kozon” bez kodowania.
- Odrzucono: brak (wymóg techniczny protokołu HTTP).
- Źródło: sesja Claude Code (odstępstwo 8)
- Skutek w kodzie: zastąpione w sprincie 3 przez sesję (patrz D-020).

### D-009 — `design.css` podbity do wersji 1.1
- Data: 2026-08-04 (sprint 1)
- Obszar: interfejs
- Decyzja: dopisać nowe tokeny układu (`--sb`, `--r`, `--r-sm`, `--r-xs`, `--przejscie`,
  `--tresc-maks`) do wspólnego `design.css`, nie tworzyć osobnego pliku modułu.
- Uzasadnienie: wersja 1.0 pozostaje nietknięta, więc inne moduły kancelarii (Kalkulator, Kasa) mogą
  podmienić plik bez zmian u siebie.
- Odrzucono: fork pliku stylów tylko dla PSA.
- Źródło: sesja Claude Code (odstępstwo 9)
- Skutek w kodzie: `publiczne/wspolne/design.css`. (Uwaga: w sprincie 6 moduł ostatecznie przeszedł
  na własną tożsamość wizualną `publiczne/style/rejestr.css` — patrz D-030.)

### D-010 — AML jako bramka częściowa (status `niemozliwe` blokuje, `brak` tylko ostrzega)
- Data: 2026-08-04 (sprint 1)
- Obszar: AML
- Decyzja: tylko status `niemozliwe` twardo blokuje wpis; status `brak` generuje ostrzeżenie, a
  pełna bramka z obiegiem sprawy ma wejść w sprincie 2.
- Uzasadnienie: checklista sprawy i tak nie pozwala dokonać wpisu bez odhaczenia pozycji AML, więc
  częściowa bramka w sprincie 1 nie zostawia luki operacyjnej na starcie.
- Odrzucono: pełna blokada dla każdego statusu innego niż `wykonane` już w sprincie 1.
- Źródło: sesja Claude Code (odstępstwo 10)
- Skutek w kodzie: `server/logika/walidacje.js` (`sprawdzAml`), `server/logika/przepisy.js`.
- **Uwaga (audyt, 2026-09-17):** to zachowanie utrzymuje się do dziś — audyt (Z-200, KRYTYCZNY)
  potwierdził empirycznie, że `aml_status='brak'` (stan KAŻDEJ nowej osoby) nadal tylko ostrzega,
  nigdy nie blokuje wpisu, na wszystkich trzech drogach zapisu zdarzenia. Czy to nadal zamierzony
  stan — patrz P-013 w „Decyzje otwarte”.
- **Uzupełnienie (sesja napraw, 2026-09-19, D-040):** próg blokujący (`niemozliwe`) SAM się nie
  zmienił — `aml_status='brak'` nadal wyłącznie ostrzega, P-013 zostaje otwarte. Dodano natomiast
  OSOBNĄ bramkę na etapie OTWARCIA rejestru (`POST /:id/otworz-rejestr`): serwer odrzuca otwarcie,
  jeśli pozycja „aml” checklisty otwarcia nie jest odhaczona, tak samo jak pozostałe 9 pozycji —
  patrz D-040.

### D-011 — Zainstalowane tylko `express` i `better-sqlite3` na starcie
- Data: 2026-08-04 (sprint 1)
- Obszar: zależności
- Decyzja: `multer`, `bcrypt`, `nodemailer` dodać dopiero w sprintach, w których są faktycznie
  wywoływane (2 i 3).
- Uzasadnienie: nie trzymać zależności, których nikt jeszcze nie wywołuje.
- Odrzucono: instalacja całego docelowego zestawu zależności z góry.
- Źródło: sesja Claude Code (odstępstwo 11)

### D-012 — Krok 2 kreatora z uploadem plików (realizacja odroczonego punktu)
- Data: 2026-08-04 (sprint 2)
- Obszar: dokumenty
- Decyzja: dodać wgrywanie plików (multer) do kroku 2 kreatora i tabelę `psa_dokumenty`.
- Uzasadnienie: punkt odłożony w sprincie 1 do czasu, aż `multer` faktycznie stał się potrzebny.
- Odrzucono: brak.
- Źródło: sesja Claude Code (odstępstwo 12)
- Skutek w kodzie: `server/migracje.js` (migracja 2), `server/trasy/sprawy.js`.

### D-013 — Dokumenty wychodzące jako deterministyczny HTML, nie PDF
- Data: 2026-08-04 (sprint 2)
- Obszar: dokumenty
- Decyzja: zawiadomienia i wezwania generować jako HTML (`logika/dokumenty-tresc.js`) — ten sam
  tekst jako treść e-maila i jako zapis audytowy; kolumna `sciezka_pdf` zostaje w schemacie, ale
  pozostaje `NULL`.
- Uzasadnienie: zakaz bibliotek PDF (sekcja 13 specyfikacji); wydruk na kanale papierowym pracownik
  wykonuje z podglądu HTML przez `window.print()`.
- Odrzucono: generowanie PDF biblioteką zewnętrzną.
- Źródło: sesja Claude Code (odstępstwo 13)
- Skutek w kodzie: `server/logika/dokumenty-tresc.js`, `server/zawiadomienia.js`.
- **Uwaga:** w kolejnych sprintach (patrz D-034) doszedł RÓWNOLEGLE drugi silnik generowania —
  wypełnianie wzorów `.docx` z dysku (`logika/docx.js`) — używany dla innej klasy dokumentów.
  Decyzja o niekorzystaniu z bibliotek PDF pozostaje aktualna dla obu silników.

### D-014 — Wysyłka e-mail jako no-op z czytelnym powodem, gdy brak SMTP
- Data: 2026-08-04 (sprint 2)
- Obszar: dokumenty / integracje
- Decyzja: gdy `.env` nie ma danych SMTP, `poczta.js` nie rzuca wyjątku — zwraca
  `{wyslano:false, powod}`; ślad w `psa_wydane_dokumenty` i tak powstaje.
- Uzasadnienie: dokument ma być gotowy do ręcznej wysyłki kanałem papierowym, niezależnie od tego,
  czy SMTP jest skonfigurowany.
- Odrzucono: traktowanie braku SMTP jako błędu blokującego wpis/zawiadomienie.
- Źródło: sesja Claude Code (odstępstwo 14)
- Skutek w kodzie: `server/poczta.js`.

### D-015 — Sprawy `zajecie`/`wykreslenie_zajecia` pomijają fazę „nowa”
- Data: 2026-08-04 (sprint 2)
- Obszar: sprawy
- Decyzja: sprawy z urzędu zakładają się wprost w stanie `weryfikacja`.
- Uzasadnienie: organ egzekucyjny nie „żąda” wpisu w rozumieniu procedury — przekazuje kompletne
  zawiadomienie; art. 300³⁴ §2 KSH: bez żądania, bez uprzedniego powiadomienia, wolne od opłat.
- Odrzucono: jednolita maszyna stanów dla wszystkich typów spraw, włącznie z fazą „nowa”.
- Źródło: sesja Claude Code (odstępstwo 15)
- Skutek w kodzie: `server/trasy/sprawy.js`, `server/logika/typy-zdarzen.js`.

### D-016 — `prawo_glosu_zastawnika` jako atrybut bieżący, bez własnej osi czasu
- Data: 2026-08-04 (sprint 2)
- Obszar: rejestr
- Decyzja: zmiana `prawo_glosu` istniejącego obciążenia modyfikuje je w miejscu, bez odtwarzania
  historycznej wartości sprzed zmiany przy „stanie na dzień”.
- Uzasadnienie: to atrybut pomocniczy przy obciążeniu, nie fakt liczbowy wymagający odtwarzania
  wstecz jak stan posiadania akcji.
- Odrzucono: pełna historyzacja zmian prawa głosu zastawnika.
- Źródło: sesja Claude Code (odstępstwo 16)

### D-017 — UI sprostowania ogranicza się do adnotacji/wycofania, bez formularza `zamiast`
- Data: 2026-08-04 (sprint 2)
- Obszar: rejestr / interfejs
- Decyzja: API wspiera pełną podmianę treści zdarzenia (przetestowaną), ale formularz w kokpicie
  oferuje tylko uzasadnienie — strukturalna korekta z nową treścią wymaga dziś wywołania API wprost.
- Uzasadnienie: 90% realnych korekt to „ten wpis nie powinien był powstać”, nie zmiana treści —
  świadome cięcie zakresu UI.
- Odrzucono: pełny formularz podmiany treści w UI od razu.
- Źródło: sesja Claude Code (odstępstwo 17); nadal otwarte jako pozycja 10 w README „Do decyzji”.
- Skutek w kodzie: `server/trasy/zdarzenia.js` (API pełne), `publiczne/js/kokpit.js` (UI ograniczone).

### D-018 — Portal zbiera tylko kroki 1–2 kreatora zdarzeń, nie krok 3 „co się zmienia”
- Data: 2026-08-05 (sprint 3)
- Obszar: portal
- Decyzja: klient portalowy opisuje zdarzenie słownie i wgrywa dokumenty; krok „co się zmienia”
  (wybór konkretnych osób/akcji z pełnej kartoteki) wykonuje wyłącznie pracownik w kokpicie sprawy.
- Uzasadnienie: udostępnienie portalowi wyszukiwarki całej wspólnej kartoteki `psa_osoby` (widoczny
  status AML) ujawniałoby klientowi dane innych klientów kancelarii — sprzeczne w duchu z regułą
  domenową nr 9.
- Odrzucono: pełny, symetryczny kreator w portalu i w kancelarii.
- Źródło: sesja Claude Code (odstępstwo 18)
- Skutek w kodzie: `server/trasy/portal.js` (`typyZdarzen.dostepneWKreatorze(2)`), kontrast z
  kreatorem kancelaryjnym `(5)` — patrz D-029.

### D-019 — `PORTAL_WLACZONY` zostaje domyślnie `false` mimo ukończenia sprintu 3
- Data: 2026-08-05 (sprint 3)
- Obszar: portal
- Decyzja: flaga środowiskowa wyłącza portal domyślnie, niezależnie od gotowości kodu.
- Uzasadnienie: włączenie portalu to decyzja biznesowa/prawna (zgoda na wariant wdrożenia A, umowa
  powierzenia z hostingiem, TLS), nie techniczna.
- Odrzucono: włączenie portalu domyślnie po ukończeniu sprintu.
- Źródło: sesja Claude Code (odstępstwo 19); powiązane z „Do decyzji” pozycja 1 (rozstrzygnięta:
  wariant A) i pozycją 2 (aktywacja konta nadal częściowo ręczna w sprincie 3 — od sprintu 7+
  zautomatyzowana, patrz D-035).
- Skutek w kodzie: `server/konfiguracja.js`, `serwer.js`.

### D-020 — Sesja zamiast nagłówka `X-User-Name` obejmuje CAŁĄ aplikację, nie tylko portal
- Data: 2026-08-05 (sprint 3)
- Obszar: uwierzytelnianie
- Decyzja: `autor(zad)` przestaje czytać nagłówek klienta, czyta `zad.uzytkownik.imie` wypełnione
  przez middleware sesji — dla całej kancelaryjnej części aplikacji, nie tylko portalu.
- Uzasadnienie: skoro serwer stoi za wariantem wdrożenia A (publicznie wystawiony), identyfikacja
  pracownika samym nagłówkiem imienia przestaje mieć sens także dla części kancelaryjnej.
- Odrzucono: osobne mechanizmy identyfikacji dla portalu (sesja) i kancelarii (nagłówek).
- Źródło: sesja Claude Code (odstępstwo 20)
- Skutek w kodzie: `server/logika/sesja.js`, `server/pomocnicze/autoryzacja.js`.

### D-021 — Opłata za informację z rejestru zamówioną przez kancelarię to ręczny wpis, nie automat
- Data: 2026-08-05 (sprint 4)
- Obszar: opłaty
- Decyzja: `EkranInformacji` (podgląd „na żywo” dla pracownika) nie nalicza opłaty automatycznie;
  pracownik odnotowuje wydanie i opłatę osobnym kliknięciem w ekranie Opłaty.
- Uzasadnienie: dopinanie naliczenia do ekranu podglądu zmieniałoby jego naturę (podgląd → czynność
  z konsekwencją finansową) i wymagałoby rozróżnienia „to był tylko podgląd” od „to była wydana
  informacja”; portal ma inny charakter (pobranie=wygenerowanie to jedno zdarzenie), więc tam
  naliczenie automatyczne jest bezpieczne.
- Odrzucono: automatyczne naliczenie przy każdym wygenerowaniu podglądu w kancelarii.
- Źródło: sesja Claude Code (odstępstwo 21)
- Skutek w kodzie: `server/trasy/spolki.js` (`GET /:id/informacja.html`), `server/trasy/oplaty.js`.

### D-022 — Naliczenie roczne obejmuje każdą spółkę poza `wykreslona`
- Data: 2026-08-05 (sprint 4)
- Obszar: opłaty
- Decyzja: opłata za prowadzenie rejestru nalicza się dla spółek `aktywna`, `w_likwidacji` i
  `zawieszona`; wyłączona jest wyłącznie `wykreslona`.
- Uzasadnienie: przyjęto, że to umowa o prowadzenie rejestru (nie status spółki w KRS) rodzi
  obowiązek opłaty.
- Odrzucono: naliczanie wyłącznie dla spółek `aktywna`.
- Źródło: sesja Claude Code (odstępstwo 22); nadal otwarte do potwierdzenia — README „Do decyzji”
  pozycja 8, patrz „Decyzje otwarte” niżej.
- Skutek w kodzie: `server/oplaty.js` (`naliczOplateRoczneWszystkie`).

### D-023 — Ułamkowe części akcji: nowy, dedykowany typ zdarzenia zamiast rozszerzenia istniejących
- Data: 2026-08-07 (sprint 5)
- Obszar: rejestr
- Decyzja: rozporządzanie ułamkiem akcji obsługuje wyłącznie nowy typ zdarzenia
  `przeniesienie_ulamka` (`logika/ulamki.js` — arytmetyka wymierna, wyłącznie INTEGER); istniejące
  handlery `emisja`/`objecie`/`przeniesienie`/`umorzenie` pozostają nietknięte i świadomie
  WYKLUCZAJĄ wiersze ułamkowe z `pula()`.
- Uzasadnienie: na 08.2026 cały istniejący stan był 1/1 (żadna spółka bez współwłasności) — uznano
  za bezpieczniejsze wykluczyć wiersze ułamkowe z dobrze przetestowanej logiki całoakcyjnej, niż
  uczynić ją wszędzie świadomą ułamków.
- Odrzucono: rozszerzenie istniejących handlerów o obsługę ułamków wprost.
- Źródło: sesja Claude Code (odstępstwo 23, sekcja „Co powstało w sprincie 5”); rozstrzyga też
  README „Do decyzji” pozycję 7 („Współwłasność akcji”).
- Skutek w kodzie: `server/logika/ulamki.js`, `server/logika/stan.js` (`pula()`),
  `server/migracje.js` (migracja 5).

### D-024 — Pokrycie akcji zaliczane równomiernie na poziomie (emisja, osoba)
- Data: 2026-08-07 (sprint 5)
- Obszar: rejestr
- Decyzja: zdarzenie `pokrycie_akcji` stempluje `pokryta` na wszystkich otwartych wierszach danej
  osoby W DANEJ EMISJI, nie na wszystkich akcjach tej osoby we wszystkich emisjach spółki.
- Uzasadnienie: dosłowne brzmienie art. 300⁹ §3 KSH („wszystkie akcje akcjonariusza”) uznano za
  przedwczesne do rozszerzenia bez realnego przypadku spółki z wieloma emisjami o różnym stopniu
  pokrycia.
- Odrzucono: zaliczanie na poziomie całej spółki (wszystkie emisje naraz).
- Źródło: sesja Claude Code (odstępstwo 24); nadal otwarte do potwierdzenia — README „Do decyzji”
  pozycja 11, patrz „Decyzje otwarte” niżej.
- Skutek w kodzie: `server/logika/stan.js` (handler `pokrycie_akcji`).

### D-025 — Backfill `data_wpisu_krs = data_emisji` dla emisji sprzed sprintu 5
- Data: 2026-08-07 (sprint 5)
- Obszar: rejestr
- Decyzja: migracja 5 wypełnia `data_wpisu_krs` datą emisji dla wpisów historycznych, zamiast
  zostawić `NULL`.
- Uzasadnienie: emisje sprzed sprintu 5 to fakt dokonany (akcje już objęte) — pozostawienie `NULL`
  uruchomiłoby nową blokadę reguły domenowej 12 wstecznie i zablokowało `objecie` dla każdej
  prowadzonej dziś spółki.
- Odrzucono: pozostawienie `NULL` dla wpisów historycznych.
- Źródło: sesja Claude Code (odstępstwo 25)
- Skutek w kodzie: `server/migracje.js` (migracja 5, backfill `UPDATE psa_emisje`).

### D-026 — Usunięcie sztywnego katalogu form zgody na wpis
- Data: 2026-08-07 (sprint 5)
- Obszar: rejestr
- Decyzja: pole „forma zgody” przy odnotowaniu zgody (art. 300³⁴ §3 KSH) jest opisem tekstowym, nie
  wyborem ze sztywnego słownika `przepisy.FORMY_ZGODY` (usuniętego).
- Uzasadnienie: poprawka erraty nr 3 (`PRZEPISY-PSA.md` §12 pkt 3) — taki słownik form (podpis
  notarialnie poświadczony / obecność osoby upoważnionej / kwalifikowany, zaufany, osobisty) nie ma
  podstawy w przepisach o P.S.A., to regulacja właściwa spółce akcyjnej.
- Odrzucono: utrzymanie sztywnego katalogu form zgody.
- Źródło: sesja Claude Code (odstępstwo 26)

### D-027 — Wpis konstytutywny/deklaratoryjny: liczone i zapisywane, bez osobnej treści zawiadomienia
- Data: 2026-08-07 (sprint 5)
- Obszar: rejestr / dokumenty
- Decyzja: `przepisy.charakterWpisu(typ, tytul_prawny)` ustala i zapisuje charakter wpisu na
  `psa_sprawy.charakter_wpisu` w chwili wpisu (nie przelicza wstecz przy zmianie katalogu); sprawy
  sprzed sprintu 5 zostają `NULL` („nieustalone”). Treść zawiadomienia o wpisie pozostaje jedna,
  wspólna dla obu przypadków.
- Uzasadnienie: rozróżnienie treści zawiadomienia to świadomie odłożony krok — dzisiejsza treść jest
  merytorycznie poprawna dla obu przypadków, różni się tylko podstawa blokująca i checklista, które
  już działają poprawnie.
- Odrzucono: rekonstrukcja charakteru wpisu dla spraw historycznych; osobna treść zawiadomienia od
  razu w sprincie 5.
- Źródło: sesja Claude Code (odstępstwo 27); nadal otwarte — README „Do decyzji” pozycja 10.
- Skutek w kodzie: `server/logika/przepisy.js` (`charakterWpisu`), `server/migracje.js` (migracja 5).

### D-028 — Lista akcjonariuszy do KRS generowana automatycznie z każdym zawiadomieniem o wpisie
- Data: 2026-08-07 (sprint 5)
- Obszar: dokumenty
- Decyzja: przy każdym `POST /sprawy/:id/wpisz` powstaje trzeci dokument w `psa_wydane_dokumenty`
  (`typ='wykaz_akcjonariuszy'`), adresowany do spółki — kancelaria go PRZYGOTOWUJE, nie SKŁADA do
  sądu.
- Uzasadnienie: art. 300³⁴ §8 KSH nakłada obowiązek złożenia na zarząd (organ spółki), nie na
  podmiot prowadzący rejestr.
- Odrzucono: składanie dokumentu do sądu w imieniu spółki.
- Źródło: sesja Claude Code (odstępstwo 28)
- Skutek w kodzie: `server/rejestr.js` (`dokonajWpisuSprawy`), `server/logika/informacja-dokument.js`.

### D-029 — Kreator ułamków/przedstawiciela/pokrycia wyłącznie w kancelarii, nigdy w portalu
- Data: 2026-08-07 (sprint 5)
- Obszar: portal / rejestr
- Decyzja: `typyZdarzen.dostepneWKreatorze(5)` dla tras kancelaryjnych; `server/trasy/portal.js`
  celowo zostaje przy poziomie `(2)` — trzy typy zdarzeń związane z ułamkami/przedstawicielem/
  pokryciem wymagają oceny pracownika, nie samoobsługi klienta.
- Uzasadnienie: decyzja nr 10, sekcja 15 `CLAUDE-PSA.md`.
- Odrzucono: udostępnienie tych typów zdarzeń również w portalu.
- Źródło: sesja Claude Code (odstępstwo 29)

### D-030 — Moduł przechodzi na własną tożsamość wizualną zamiast wspólnego `design.css`
- Data: 2026-08-07/08 (sprint 6 / sesja 6)
- Obszar: interfejs
- Decyzja: `publiczne/style/rejestr.css` (nowy plik) zastępuje odwołanie do `design.css` — kanon
  wizualny kancelarii (`--sb`, `--r`, `--panel`, `--burgundy-2` itd.) przestrojony na wartości
  sesji 6, `psa.css` zrestrukturyzowany, usunięte lokalne style zdublowane.
- Uzasadnienie: zakres i zasada nadrzędna sesji interfejsowej — wyłącznie warstwa prezentacji, bez
  dotykania `server/logika/`, tabel czy kontraktów endpointów.
- Odrzucono: dalsze utrzymanie wspólnego `design.css` (odstępstwo 9, D-009) jako jedynego źródła
  tokenów wizualnych modułu.
- Źródło: sesja Claude Code (README, sekcja „Co powstało w sprincie 6”)
- Skutek w kodzie: `publiczne/style/rejestr.css`, `publiczne/index.html`, `publiczne/portal.html`.

### D-031 — Pasek serii pokazuje współwłasność pośrednio, bez dokładnego ułamka
- Data: 2026-08-07/08 (sprint 6)
- Obszar: interfejs
- Decyzja: `widoki.js` nie przekazuje `czesc_licznik`/`czesc_mianownik` do frontendu (tylko
  zsumowane `zakresy`/`procent`); pasek serii wykrywa współwłasność pośrednio (numer akcji
  występujący u więcej niż jednego akcjonariusza tej samej emisji), bez pokazania dokładnego ułamka.
- Uzasadnienie: poszerzenie kontraktu `GET /api/psa/spolki/:id/stan` byłoby wyjściem poza zakres
  sesji czysto wizualnej (jedyny dopuszczony wyjątek: „stan na” z dokładnością do minuty, D-032).
- Odrzucono: poszerzenie kontraktu API o pole `czesci_ulamkowe` już w tej sesji.
- Źródło: sesja Claude Code (README, sekcja „Co powstało w sprincie 6”)

### D-032 — „Stan na” z dokładnością do minuty jako jedyny dopuszczony wyjątek od reguły „tylko CSS”
- Data: 2026-08-07/08 (sprint 6)
- Obszar: rejestr / interfejs
- Decyzja: porównanie „stanu na chwilę” w kokpicie zmienia się z `data_zdarzenia` na `data_wpisu`
  (z dokładnością do minuty), mimo że sesja 6 miała być wyłącznie warstwą prezentacji.
- Uzasadnienie: bez tej zmiany logiki porównania punkt planu „stan na dzień/godzinę” w ogóle nie dał
  się zbudować.
- Odrzucono: pozostawienie porównania po `data_zdarzenia` i zrezygnowanie z tego punktu planu.
- Źródło: sesja Claude Code (README, nagłówek sekcji „Co powstało w sprincie 6”)
- Skutek w kodzie: `server/widoki.js`, `server/logika/stan.js`.
- **Uwaga (audyt, 2026-09-17):** Z-305 (POWAŻNY) — ten mechanizm istnieje dziś WYŁĄCZNIE w API;
  UI kokpitu (`publiczne/js/kokpit.js`) używa z powrotem tylko pola daty, bez godziny. Czy to
  świadoma regresja czy przypadkowa — patrz P-011 w „Decyzje otwarte”.
- **Zmieniony przez D-043 (sesja napraw, 2026-09-19):** godzina wróciła do UI kokpitu — ta uwaga
  (regresja UI-do-samej-daty) już nieaktualna, patrz D-043.

### D-033 — Weryfikacja UI zastąpiona metodami offline, gdy CDN (`unpkg.com`) zablokowane w sesji
- Data: 2026-08-07 (sprint 5), 2026-08-07/08 (sprint 6)
- Obszar: proces wytwórczy
- Decyzja: gdy środowisko sesji blokuje `unpkg.com` (skąd ładują się React/Babel), zamiast pełnej
  weryfikacji w przeglądarce: parsowanie JSX przez `@babel/core`+`preset-react` poza repo, sprawdzanie
  CSS programowo, `grep` po hardkodowanych kolorach, odpytywanie tras `curl`, uruchamianie kluczowej
  logiki komponentów w piaskownicy `vm`.
- Uzasadnienie: brak dostępu do CDN w danej sesji nie jest nowym ograniczeniem funkcjonalnym —
  interaktywna weryfikacja w przeglądarce zostaje jako dług do zrobienia przed produkcją.
- Odrzucono: pominięcie weryfikacji w ogóle.
- Źródło: sesja Claude Code (README, sekcje „Co powstało w sprincie 5” i „w sprincie 6”)

### D-034 — Drugi silnik dokumentów: wypełnianie wzorów `.docx` z dysku
- Data: 2026-08-16 (git: bloki A0–A4, „SESJA-PSA-8”)
- Obszar: dokumenty
- Decyzja: obok deterministycznego HTML (D-013) wprowadzić `logika/docx.js` +
  `logika/wzory-dysk.js` — wypełnianie gotowych wzorów `.docx` redagowanych przez notariusza w
  Wordzie (placeholdery `{{klucz}}`, pętle `{{#kolekcja}}`), bez konwersji zewnętrznych.
- Uzasadnienie: uzasadnienie nieznane — nie odtworzone z dostępnego tu materiału (commity „Blok A0:
  warstwa .docx — wypełnianie wzorów bez zależności” i kolejne nie mają w repo dołączonego opisu
  decyzji poza samą treścią zmiany).
- Odrzucono: nieznane.
- Źródło: historia migracji / git log (commity `25fc87d`, `9a46dac`, `036b23b`, `6d6ce10`,
  2026-08-16)
- Skutek w kodzie: `server/logika/docx.js`, `server/logika/wzory-dysk.js`, `server/logika/zip.js`
  (własny, minimalny czytnik ZIP bez zależności — `.docx` to archiwum ZIP), katalog `wzory/`.

### D-035 — Deklinacja polska: świadoma rezygnacja z automatu na rzecz mianownika z etykietą
- Data: nieznana — odtworzone z komentarza w kodzie
- Obszar: dokumenty
- Decyzja: dane reprezentanta w pismach podaje się w mianowniku z etykietą („działający jako: …”),
  zamiast automatycznie odmieniać przez przypadki.
- Uzasadnienie: uniknięcie potrzeby modułu automatycznej deklinacji i pól korekty przy błędach
  odmiany.
- Odrzucono: automatyczna deklinacja gramatyczna (moduł `logika/deklinacja.js`, wymieniony w
  komentarzu migracji jako plan — **nie istnieje w repozytorium**; kolumny `reprezentant_biernik_
  recznie`, `reprezentant_funkcja_biernik_recznie`, `reprezentant_rodzice_recznie` w schemacie to
  ślad tamtego planu, dziś martwe/nieużywane przez bieżący kod).
- Źródło: historia migracji (`server/migracje.js:994-1011`, komentarz), `server/logika/kontekst-pisma.js`
  (linie ~184-205)
- Skutek w kodzie: `server/logika/kontekst-pisma.js`; martwe kolumny w `psa_spolki`/`psa_wnioski`.

### D-036 — AML jako moduł konfigurowalny per spółka, domyślnie WYŁĄCZONY
- Data: nieznana — odtworzone z migracji 28
- Obszar: AML
- Decyzja: dodać `psa_spolki.stosuje_procedure_aml` (domyślnie `0`/wyłączone) sterujące m.in.
  dostępnością uploadu skanów AML (`wymagajProceduryAml`).
- Uzasadnienie: uzasadnienie nieznane — komentarz migracji opisuje CO (nowa kolumna, nowa tabela
  `psa_osoby_skany_aml`), nie DLACZEGO akurat opt-in per spółka, a nie globalny przełącznik albo
  zawsze włączone.
- Odrzucono: nieznane.
- Źródło: historia migracji (`server/migracje.js`, migracja 28)
- Skutek w kodzie: `server/trasy/osoby.js`, `server/migracje.js` (migracja 28).

### D-037 — Jedno konto portalowe może być powiązane z wieloma spółkami/wnioskami
- Data: nieznana — odtworzone z migracji 41
- Obszar: portal
- Decyzja: wprowadzić tabelę `psa_konta_spolki` (relacja wiele-do-wielu konto↔spółka) z backfillem
  z dotychczasowego `psa_konta.spolka_id`; usunąć ograniczenie `UNIQUE` na `psa_wnioski.konto_id`.
- Uzasadnienie: uzasadnienie nieznane — sama migracja (oznaczona `przebudowaTabeli: true`) pokazuje
  ZMIANĘ modelu z „jedno konto = jedna spółka” na „jedno konto = wiele spółek/wniosków”, bez
  komentarza tłumaczącego decyzję biznesową.
- Odrzucono: nieznane.
- Źródło: historia migracji (`server/migracje.js`, migracja 41)
- Skutek w kodzie: `server/trasy/portal.js`, `server/trasy/wnioski.js`.

### D-038 — Zgłoszenie publiczne wysyła zaproszenie do portalu od razu, bez etapu oceny kancelarii
- Data: nieznana — zachowanie odtworzone z komentarza w kodzie, sprzecznego z innym komentarzem w
  tym samym module
- Obszar: portal
- Decyzja: `POST /api/psa/portal/zgloszenia` zakłada zaproszenie i nieaktywne konto natychmiast po
  złożeniu zgłoszenia, bez interwencji pracownika.
- Uzasadnienie: komentarz w `server/trasy/portal.js` (linie ~290-293) mówi wprost: „Zaproszenie idzie
  od razu. Na tym etapie kancelaria niczego jeszcze nie sprawdza (...). Kolejka «Zgłoszenia» zostaje
  jako ślad, nie jako bramka.” — ale komentarz nagłówkowy `server/trasy/zgloszenia.js` opisuje
  PRZECIWNY model: „kancelaria przegląda listę i decyduje: zaprosić albo odrzucić”. Który z dwóch
  komentarzy odzwierciedla świadomą, aktualną decyzję — nieustalone.
- Odrzucono: nieznane (możliwe, że etap oceny był pierwotnym zamysłem, porzuconym bez aktualizacji
  drugiego komentarza — albo odwrotnie).
- Źródło: audyt (`testy-audyt/ZNALEZISKA.md` Z-003, POWAŻNY)
- Skutek w kodzie: `server/trasy/portal.js:189-307`, `server/trasy/zgloszenia.js` (komentarz
  nagłówkowy nieaktualny wobec zachowania).
- **Decyzja otwarta:** patrz P-003 w „Decyzje otwarte” niżej — to jest dokładnie pytanie, na które
  ten wpis nie ma jeszcze odpowiedzi Łukasza.

### D-039 — Dostęp portalowy akcjonariusza do rejestru spółki weryfikowany na żywo, nie statycznie
- Data: nieznana — odtworzone z kodu
- Obszar: portal / bezpieczeństwo
- Decyzja: dla roli `akcjonariusz` dostęp do `GET /portal/rejestr/:spolkaId` sprawdza NA ŻYWO stan
  `psa_stan_akcji` (czy osoba nadal posiada choć jedną akcję tej spółki), nie tylko statyczne
  powiązanie konta ze spółką.
- Uzasadnienie: uzasadnienie nieznane — konsekwencja praktyczna jest spójna z regułą jawności
  rejestru dla akcjonariuszy (art. 300³⁵ §1 KSH): dostęp wygasa automatycznie po zbyciu wszystkich
  akcji, bez potrzeby ręcznego odbierania dostępu.
- Odrzucono: nieznane.
- Źródło: sesja Claude Code (badanie kodu w ramach tej sesji dokumentacyjnej,
  `server/trasy/portal.js`, funkcja `maDostepDoSpolki`, linia ~126)
- Skutek w kodzie: `server/trasy/portal.js`.

### D-040 — Checklista otwarcia rejestru: pozycja „aml” traktowana jak pozostałe 9, bez progu EUR
- Data: 2026-09-19 (sesja napraw)
- Obszar: AML / rejestr
- Decyzja: literalny plan naprawy Z-200/Z-201/Z-204 („trzy dopuszczalne zamknięcia” checklisty,
  zależne od progu 15 000 EUR) NIE został zbudowany — zamiast tego `POST /:id/otworz-rejestr`
  odrzuca otwarcie, jeśli którakolwiek z 10 pozycji checklisty (w tym „aml”) nie jest odhaczona.
  Próg 15 000 EUR pozostaje wyłącznie ręcznym przełącznikiem `stosuje_procedure_aml` per spółka
  (D-036) — żadna automatyczna kwota transakcji nie jest liczona ani porównywana z kursem EUR.
- Uzasadnienie: wprost od Łukasza w tej sesji — pracownik sam ocenia, czy spółka w ogóle podlega
  procedurze AML (np. po wysokości kapitału), reszta ma być tylko miejscem na to, „nic nie musi się
  dziać automatycznie”. Budowa progu EUR/kursu byłaby zmianą spoza tego zlecenia.
- Odrzucono: automatyczne śledzenie wartości transakcji względem progu 15 000 EUR i „trzy zamknięcia”
  checklisty (`wykonano`/`nie_dotyczy_prog`/`odstąpiono`) z oryginalnego planu naprawy.
- Źródło: instrukcja użytkownika w tej sesji; `testy-audyt/ZNALEZISKA.md` Z-200/Z-201/Z-204.
- Skutek w kodzie: `server/trasy/spolki.js` (`KODY_CHECKLISTY_OTWARCIA`, `sprawdzChecklisteOtwarcia`),
  `publiczne/js/spolki.js`. Patrz też uzupełnienie przy D-010.

### D-041 — PEP „nieustalono” jako trzeci stan, dziennik dostępu obejmuje też odczyty portalu
- Data: 2026-09-19 (sesja napraw)
- Obszar: AML / dane osobowe / dziennik dostępu
- Decyzja: (a) domyślny status PEP nowej osoby to `nieustalono`, nie `nie` — „nieocenione” i
  „ocenione jako niebędące PEP” to teraz rozróżnialne stany (Z-151); (b) `pep_oswiadczenie` (deklaracja
  osoby) przenosi się z wniosku portalowego do kartoteki, `pep`/`pep_opis` (ocena kancelarii) — NIGDY;
  (c) `GET /portal/rejestr/:spolkaId` zapisuje wpis w dzienniku dostępu przy odczycie danych
  wrażliwych cudzych akcjonariuszy (nie tylko przy „wyniesieniu” dokumentu), z 15-minutową
  deduplikacją tego samego widza (Z-152); (d) akcjonariusz może sam wgrać własny skan dokumentu AML
  przez portal, tym samym mechanizmem co pracownik (P-012, część mechaniczna).
- Uzasadnienie: (a)-(b) mapowanie pól PEP było źródłem realnego rozjazdu (wniosek ustawiał `pep`,
  które jest oceną KANCELARII, nie deklaracją osoby); (c) audyt (Z-152, POWAŻNY) wskazał ślepą plamę
  w dzienniku; (d) zmniejsza obciążenie kancelarii przy identyfikacji zdalnej.
- Odrzucono: pytanie z UI wniosku o samoocenę PEP (osobna, większa funkcja niż naprawa mapowania);
  przechwytywanie danych płatnika z ITN Tpay (brak dostępu do dokumentacji pól API operatora —
  pozostaje jako P-012, część nierozstrzygnięta).
- Źródło: `testy-audyt/PYTANIA-DO-LUKASZA.md` P-009, P-010, P-012; `testy-audyt/ZNALEZISKA.md`
  Z-151, Z-152.
- Skutek w kodzie: `server/logika/przepisy.js`, `server/logika/akcjonariusz.js`,
  `server/logika/dziennik-dostepu.js`, `server/logika/maskowanie.js`, `server/trasy/{osoby,portal,
  wnioski}.js`, `publiczne/js/osoby.js`, migracje 49-50.
- **Decyzja otwarta:** okres retencji dziennika dostępu (mechanizm zapisu istnieje, wartość/polityka
  usuwania — nie); klauzula informacyjna RODO i oświadczenie PEP dla akcjonariuszy dochodzących PO
  założeniu spółki (Z-153) — podstawa prawna poza `PRZEPISY-PSA.md`, wymaga potwierdzenia Łukasza.

### D-042 — Drobne naprawy FAZA 6: integralność techniczna bez zmiany reguł prawnych
- Data: 2026-09-19 (sesja napraw)
- Obszar: techniczne (bezpieczeństwo, dostępność, odporność na błędy)
- Decyzja: seria niezależnych, wąsko zakresowanych poprawek, żadna nie zmienia reguł domenowych:
  - `TZ` serwera: nieustawione → programowy domyślny `Europe/Warsaw`; jawnie ustawione na coś
    innego → odmowa startu (wariant hybrydowy, wybrany i uzasadniony w kodzie — `server/konfiguracja.js`);
  - kartoteka osób ostrzega (nie blokuje) przy kolizji PESEL/NIP z innym rekordem (Z-350);
  - klucz idempotencyjny przy zakładaniu sprawy (kancelaria i portal) — powtórzone żądanie zwraca
    ten sam rekord zamiast duplikatu (Z-351/Z-353);
  - limit 200 znaków na nazwę spółki + obcinanie tekstu w listach (Z-354);
  - usunięty zacommitowany plik `:memory:`, naprawiona `konfiguracja.js::sciezka()` (Z-002);
  - błędy multer (limit rozmiaru/liczby plików) i niepoprawny JSON w ciele żądania mają teraz
    czytelne komunikaty PL i kod 400, nie surowy angielski tekst ani 500 (Z-254/Z-255);
  - `GET /api/psa/meta` wymaga sesji pracownika, jak reszta `/api/psa/*` (Z-001/Z-252);
  - przypomnienia o kończącym się roku prowadzenia rejestru dostały realny automatyczny wyzwalacz
    (`setInterval`, bez nowej zależności) zamiast wyłącznie ręcznego przycisku (Z-357);
  - etykiety formularzy kancelarii poprawnie powiązane z polami (`htmlFor`/`useId`) — dostępność
    WCAG (Z-018).
- Uzasadnienie: pozycje „drobne” z planu naprawy — każda ma regresyjny test (fails-before/passes-after)
  i nie zmienia żadnej reguły ustawowej ani decyzji Łukasza o ostrzeżeniach vs blokadach.
- Odrzucono: nic — żadna z tych pozycji nie miała alternatywy wartej odrzucenia poza status quo.
- Źródło: `testy-audyt/ZNALEZISKA.md` Z-001/Z-002/Z-018/Z-254/Z-255/Z-306/Z-350/Z-351/Z-353/Z-354/Z-357.
- Skutek w kodzie: `server/konfiguracja.js`, `server/trasy/{osoby,spolki,sprawy,portal}.js`,
  `server/pomocnicze/odpowiedzi.js`, `server/logika/harmonogram.js` (nowy), `publiczne/js/{app,ui,
  ui-rejestr,spolki}.js`, `.gitignore`, migracja 51.

### D-043 — „Stan na” z godziną wraca do UI kokpitu (koniec regresji z D-032)
- Data: 2026-09-19 (sesja napraw)
- Obszar: rejestr / interfejs
- Decyzja: kokpit spółki znowu pokazuje pole godziny obok daty przy „stan na chwilę” — mechanizm
  API (D-032) od teraz ma odpowiadający mu element UI, nie tylko samą datę.
- Uzasadnienie: Z-305 (POWAŻNY) — funkcja wymagana specyfikacją istniała wyłącznie w API; UI
  cichcem zredukował ją do samej daty, co dla pracownika wygląda jak brak funkcji.
- Odrzucono: pozostawienie regresji do czasu wyraźnej decyzji Łukasza (odrzucone — P-011 pytał też o
  coś INNEGO, wariant `TZ`, nie o to, czy przywrócić już istniejącą, udokumentowaną funkcję UI).
- Źródło: `testy-audyt/ZNALEZISKA.md` Z-305; P-011.
- Skutek w kodzie: `publiczne/js/kokpit.js`.

### D-044 — Mechanizm oznaczania danych jako testowe/demo: niepotrzebny
- Data: 2026-09-19 (sesja napraw)
- Obszar: operacyjne
- Decyzja: nie budujemy żadnego pola/mechanizmu odróżniającego rekordy „na serio” od demonstracyjnych
  w `psa_spolki`/`psa_osoby`/`psa_zdarzenia`/innych tabelach.
- Uzasadnienie: świadome pominięcie z planu naprawy tej sesji — pozycja uznana za niepotrzebną.
- Odrzucono: nowa kolumna `jest_testowy`/`tryb_testowy` per tabela (rozważana w audycie, Z-359).
- Źródło: plan naprawy tej sesji („Pomijamy świadomie: Z-359”); `testy-audyt/ZNALEZISKA.md` Z-359;
  P-015.
- Skutek w kodzie: brak (świadomy brak zmiany).

### D-045 — Cena emisyjna: zostaje pole „cena za akcję”, naprawiona precyzja (odpowiedź Q1)
- Data: 2026-09-20 (sesja frontendowa, FAZA 0 STOP)
- Obszar: rejestr / interfejs
- Decyzja: pole ceny emisyjnej zostaje w formie „cena za jedną akcję” (wariant A z pytania Q1), NIE
  przechodzi na „łączną cenę emisji” (wariant B). Ma zostać naprawione tak, by realnie
  odrzucało/ostrzegało przy próbie wpisania więcej niż 2 miejsc po przecinku, zamiast dzisiejszego
  cichego zaokrąglania (patrz B7, `FRONTEND-INWENTARZ.md` §7) — w tym przypadek zaokrąglenia do ZERA
  dla bardzo małych wartości (P.S.A. nie ma wartości nominalnej, cena poniżej 1 grosza za akcję jest
  prawnie dopuszczalna i realna).
- Uzasadnienie: odpowiedź Łukasza na Q1 z `SESJA-PSA-FRONTEND.md` §FAZA 0 STOP.
- Odrzucono: wariant B (łączna cena emisji, system wylicza cenę za akcję).
- Źródło: użytkownik (STOP po FAZA 0), `FRONTEND-INWENTARZ.md` §7 (B7).
- Skutek w kodzie: do wykonania w FAZIE 2 (B7) — podłączenie `kreator.js` do istniejącego
  `PoleKwoty` (`ui-rejestr.js`), które już poprawnie operuje na groszach jako liczbie całkowitej.

### D-046 — Zgoda na `esbuild`: prekompilacja JSX przy budowaniu (odpowiedź Q4)
- Data: 2026-09-20 (sesja frontendowa, FAZA 0 STOP)
- Obszar: wydajność / zależności
- Decyzja: `esbuild` wolno dodać jako zależność deweloperską do prekompilacji JSX przy budowaniu,
  zastępując kompilację Babela w przeglądarce.
- Uzasadnienie: zmierzone w FAZIE 0 (`FRONTEND-INWENTARZ.md` §5) — `babel.min.js` to 62-66%
  transferu strony logowania (2,98 MB), czas do interaktywności na profilu mobile 4G ok. 18-19 s,
  z czego 1,6-3,2 s to czysty koszt kompilacji CPU niezależny od sieci. Odpowiedź Łukasza na Q4.
- Odrzucono: pozostanie bez build stepu (samo cache'owanie skompilowanych modułów, bez realnego
  usunięcia Babela z przeglądarki) — to była alternatywna opcja w pytaniu, nie wybrana.
- Źródło: użytkownik (STOP po FAZA 0), `SESJA-PSA-FRONTEND.md` FAZA 1 pkt 6.
- Skutek w kodzie: do wykonania w FAZIE 1 pkt 6 — wprowadzenie kroku budowania, usunięcie
  `vendor/babel.min.js` z ładowania w przeglądarce, dostosowanie CSP (można zdjąć `unsafe-eval`).

### D-047 — Formularz publiczny zgłoszenia: numer KRS zostaje wymagany (odpowiedź Q3)
- Data: 2026-09-20 (sesja frontendowa, FAZA 0 STOP)
- Obszar: portal / zgłoszenia
- Decyzja: publiczny formularz „Zgłoś zainteresowanie” NIE przyjmuje zgłoszeń bez numeru KRS —
  wymóg KRS zostaje bez zmian.
- Uzasadnienie: odpowiedź Łukasza na Q3. Spółki w organizacji (przed wpisem do KRS) obsługuje
  kancelaria poza tym formularzem.
- Odrzucono: dopuszczenie zgłoszenia z pustym KRS i uzupełnieniem go później.
- Źródło: użytkownik (STOP po FAZA 0), `SESJA-PSA-FRONTEND.md` §FAZA 0 STOP Q3.
- Skutek w kodzie: brak — `server/trasy/portal.js` (walidacja KRS w `POST /zgloszenia`) zostaje bez
  zmian.

### D-048 — Strona publiczna: bez podstrony „/wzory” do pobrania (odpowiedź Q5)
- Data: 2026-09-20 (sesja frontendowa, FAZA 0 STOP)
- Obszar: strona publiczna (SEO)
- Decyzja: strona publiczna (FAZA 5) nie dostaje podstrony `/wzory` z dokumentami do pobrania.
- Uzasadnienie: odpowiedź Łukasza na Q5.
- Odrzucono: publikacja wzorów (uchwała o wyborze podmiotu prowadzącego rejestr, żądanie wpisu) do
  samodzielnego pobrania przez odwiedzających stronę.
- Źródło: użytkownik (STOP po FAZA 0), `SESJA-PSA-FRONTEND.md` §5.2 tabela stron.
- Skutek w kodzie: brak jeszcze — dotyczy FAZY 5, nieplanowanej struktury stron.

### D-049 — Domena strony publicznej: nierozstrzygnięta, `BASE_URL` jako parametr (odpowiedź Q2)
- Data: 2026-09-20 (sesja frontendowa, FAZA 0 STOP)
- Obszar: strona publiczna (SEO) / infrastruktura
- Decyzja: Łukasz nie rozstrzygnął jeszcze Q2 (podstrony `notariusz.gdansk.pl` / subdomena tej
  aplikacji / osobna domena). Do czasu decyzji strony FAZY 5 budowane tak, by domena była
  parametrem (`BASE_URL`), zgodnie z zaleceniem samego dokumentu sesji.
- Uzasadnienie: jawnie odłożone przez użytkownika przy STOP po FAZIE 0.
- Odrzucono: nic — decyzja odłożona, nie odrzucona.
- Źródło: użytkownik (STOP po FAZA 0), `SESJA-PSA-FRONTEND.md` §FAZA 0 STOP Q2.
- Skutek w kodzie: brak na razie — dotyczy FAZY 5.
- **Decyzja otwarta:** Q2 pozostaje w „Decyzje otwarte” niżej do czasu odpowiedzi.

### D-050 — „Stan na” w interfejsie tylko jako dzień
- Data: 2026-09-25 (sesja frontendowa v2, przed FAZĄ 1)
- Obszar: rejestr / interfejs
- Decyzja: kokpit spółki pokazuje „stan na” wyłącznie z dokładnością do **dnia** (stan na koniec
  dnia). Pole godziny znika z UI. Zastępuje D-043 w warstwie interfejsu; mechanizm API „stan na
  chwilę” z D-032 zostaje bez zmian.
- Uzasadnienie: decyzja Łukasza — pracownikowi potrzebny jest stan na dzień; chwila wpisu co do
  sekundy jest pokazywana przy pozycji akcjonariusza (B12), nie w filtrze kokpitu.
- Odrzucono: utrzymanie pola godziny z D-043.
- Źródło: Łukasz, przed sesją frontendową v2 (`SESJA-PSA-FRONTEND.md` v2 § 0.5).
- Skutek w kodzie: FAZA 2 (B12) — `publiczne/js/kokpit.js`. Zamyka P-011 w części UI.

### D-051 — Menu kancelarii bez scalania; pulpit z sekcją „Do zrobienia”
- Data: 2026-09-25 (sesja frontendowa v2, przed FAZĄ 1)
- Obszar: interfejs kancelarii
- Decyzja: pozycje menu Kolejka spraw, Zgłoszenia, Wnioski i Zawiadomienia zostają osobne. Pulpit
  zamiast kafli statystyk dostaje sekcję „Do zrobienia” zasilaną tą samą definicją co liczniki w
  nawigacji.
- Uzasadnienie: decyzja Łukasza.
- Odrzucono: scalenie czterech pozycji w jedną skrzynkę spraw.
- Źródło: Łukasz, przed sesją frontendową v2.
- Skutek w kodzie: FAZA 1 pkt 9 (wspólny `Licznik`), FAZA 3 (K1).

### D-052 — Checklisty weryfikacyjne zaznacza wyłącznie człowiek
- Data: 2026-09-25 (sesja frontendowa v2, przed FAZĄ 1)
- Obszar: rejestr / weryfikacja
- Decyzja: system nigdy sam nie zaznacza pozycji checklisty (otwarcie rejestru, weryfikacja wpisu,
  podpisy). Może jedynie **zablokować** zaznaczenie pozycji, która na pewno nie jest spełniona — z
  przyczyną i odnośnikiem „Uzupełnij” do pola, które to naprawia.
- Uzasadnienie: decyzja Łukasza — automatyzujemy wpisywanie danych, nie ocenę prawną.
- Odrzucono: automatyczne zaznaczanie pozycji rozstrzygalnych przez system.
- Źródło: Łukasz, przed sesją frontendową v2.
- Skutek w kodzie: FAZA 3 (K2, K3).

### D-053 — Wniosek w portalu bez liczby akcji i serii
- Data: 2026-09-25 (sesja frontendowa v2, przed FAZĄ 1)
- Obszar: portal / wniosek
- Decyzja: portal nie zbiera liczby akcji ani serii. Kreator otwarcia rejestru podstawia z wniosku
  osoby; akcjonariat założycielski (liczby akcji, serie) wpisuje kancelaria z umowy spółki.
- Uzasadnienie: decyzja Łukasza — źródłem akcjonariatu założycielskiego jest umowa spółki, nie
  deklaracja klienta.
- Odrzucono: pola liczby akcji i serii we wniosku klienta.
- Źródło: Łukasz, przed sesją frontendową v2.
- Skutek w kodzie: brak zmiany w portalu; FAZA 3 (K2) — podstawienie osób w kreatorze otwarcia.

### D-054 — Dokumenty do podpisu: mechanizm bez zmian
- Data: 2026-09-25 (sesja frontendowa v2, przed FAZĄ 1)
- Obszar: portal / kancelaria / dokumenty
- Decyzja: pobranie, wgranie skanu i potwierdzenie podpisu zostają dokument po dokumencie — w
  portalu i w kancelarii. Dozwolone wyłącznie zmiany wizualne.
- Uzasadnienie: decyzja Łukasza — każdy podpis sprawdzany osobno.
- Odrzucono: zbiorcze „potwierdź wszystkie podpisy” (propozycja z FAZY 0).
- Źródło: Łukasz, przed sesją frontendową v2.
- Skutek w kodzie: FAZA 4 (P4) — tylko wygląd listy.

### D-055 — Kraj w adresie akcjonariusza z wniosku; wyszukiwarka kartoteki po numerze KRS
- Data: 2026-09-25 (sesja frontendowa v2, FAZA 1 pkt 1–2)
- Obszar: portal / kartoteka / schemat
- Decyzja: (1) `psa_wnioski_akcjonariusze` dostaje kolumnę `kraj TEXT NOT NULL DEFAULT 'Polska'`
  (migracja 52), przyjmowaną przez `PUT/POST /api/psa/portal/wniosek/akcjonariusze` i przenoszoną do
  kartoteki przy przyjęciu wniosku (przez `POLA_OSOBY`). Puste pole = „Polska”. (2) `GET
  /api/psa/osoby?q=` szuka także po `numer_w_rejestrze`; ostrzeżenie o duplikacie przy zapisie osoby
  (D-042) obejmuje oprócz PESEL i NIP także numer w rejestrze.
- Uzasadnienie: wspólny `FormularzOsoby` (portal + kancelaria) zbiera kraj w obu miejscach — bez
  kolumny zagraniczny adres akcjonariusza ginął przy przyjęciu wniosku (B11). Wybór z kartoteki ma
  znajdować osobę prawną po KRS tak jak fizyczną po PESEL.
- Odrzucono: ukrycie pola „Kraj” w portalu do FAZY 2 (zostawiałoby lukę B11 w nowym formularzu).
- Źródło: `SESJA-PSA-FRONTEND.md` v2, FAZA 1 pkt 1–2, B11.
- Skutek w kodzie: `server/migracje.js` (52), `server/trasy/portal.js`, `server/trasy/osoby.js`,
  `publiczne/js/formularz-osoby.js`, `pola.js`.

### D-056 — Cena emisyjna poniżej 1 grosza: niemożliwa do zapisania (wariant C, odpowiedź Q6)
- Data: 2026-09-25 (sesja frontendowa v2, po FAZIE 1 STOP)
- Obszar: rejestr / interfejs
- Decyzja: pole „cena za akcję” zostaje przy 2 miejscach po przecinku (wariant C z FAZY 1 STOP).
  Cena poniżej 1 grosza za akcję jest świadomie niemożliwa do zapisania w tym polu — schemat i
  `PoleKwoty` (`publiczne/js/ui-rejestr.js`) bez zmian względem stanu z końca FAZY 1: więcej niż
  2 cyfry po przecinku dają komunikat przy polu, nie ciche zaokrąglenie (D-045).
- Uzasadnienie: odpowiedź Łukasza na Q6 — najprostszy z trzech wariantów, bez zmiany schematu
  (ułamki, kolumna łącznej ceny emisji). Przy emisji z ceną poniżej grosza za akcję kancelaria opisuje
  cenę w polu tekstowym podstawy emisji, tak jak dziś.
- Odrzucono: wariant A (cena za akcję jako ułamek licznik/mianownik w groszach) i wariant B (cena za
  akcję do 2 miejsc, a poniżej 0,01 zł formularz zbiera łączną cenę emisji) — oba wymagały zmiany
  schematu bez wyraźnej potrzeby dziś.
- Źródło: użytkownik (STOP po FAZIE 1), `frontend-audyt/raporty/faza1-raport.md` §3.
- Skutek w kodzie: brak — B7 (FAZA 2) podłącza `kreator.js` do już gotowego `PoleKwoty` na tych
  samych zasadach.

---

### D-059 — Reprezentant: dowód (rodzaj+numer) i adres ustrukturyzowany, stare pola tylko do odczytu (B2/B3)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 2)
- Obszar: rejestr / dokumenty
- Decyzja: reprezentant spółki (osoba, która podpisała umowę o prowadzenie rejestru) miał dotąd
  dwa pola tekstowe bez struktury: `reprezentant_dowod` (jeden ciąg, np. „DGK 138559", bez
  rozróżnienia dowód/paszport) i `reprezentant_adres` (jeden ciąg). Migracja 53 dodaje kolumny
  ustrukturyzowane — `reprezentant_dowod_rodzaj`/`reprezentant_dowod_numer` oraz
  `reprezentant_kod_pocztowy`/`reprezentant_miejscowosc`/`reprezentant_ulica`/`reprezentant_nr_domu`/
  `reprezentant_nr_lokalu` — na `psa_spolki` i `psa_wnioski`, analogicznie do akcjonariusza i
  `psa_osoby`. Formularze (`spolki.js`, `wniosek.js`, `wnioski.js`) używają odtąd dedykowanych
  komponentów `PoleDowod`/`PoleAdres` z jawnym `klucze` zamiast generycznych pól tekstowych.
- Uzasadnienie: spójność z resztą formularza osoby (reprezentant był jedynym miejscem bez
  struktury dowodu/adresu) — dokumenty generowane dla reprezentanta (umowa, uchwała) czytają teraz
  pola ustrukturyzowane wprost, bez parsowania wolnego tekstu.
- Migracja: stare kolumny (`reprezentant_dowod`, `reprezentant_adres`) NIE są usuwane ani
  migrowane automatycznie do struktury — tekstu adresu nie da się bezpiecznie rozbić na
  ulica/nr/kod. Istniejący `reprezentant_dowod` jest przepisywany do `reprezentant_dowod_numer`
  (rodzaj zostaje pusty, oznaczony w UI „do uzupełnienia"). `server/logika/kontekst-pisma.js`
  (`reprezentantDowodPelny`/`reprezentantAdresPelny`) czyta nowe pola, gdy są wypełnione, w
  przeciwnym razie stary tekst — stare pole zostaje kontraktowo TYLKO DO ODCZYTU, dopóki ktoś nie
  przepisze go przez nowy formularz.
- Źródło: `SESJA-PSA-FRONTEND.md` v2, punkty B2+B3.
- Skutek w kodzie: migracja 53; `server/logika/kontekst-pisma.js`; `publiczne/js/spolki.js`,
  `wniosek.js`, `wnioski.js` (pola `PoleDowod`/`PoleAdres` z jawnym `klucze`).

---

### D-060 — Ślad pierwszego otwarcia dokumentu w portalu jako dowód doręczenia (B6)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 2)
- Obszar: portal
- Decyzja: kolumna `otwarto_w_portalu` (migracja 54, `psa_wnioski_dokumenty` i
  `psa_wydane_dokumenty`) ustawia się RAZ, przy pierwszym pobraniu pliku przez klienta
  (`server/logika/pakiet-wniosku.js: oznaczOtwarte`). Portal pokazuje plakietkę „nowy" przy
  dokumencie, którego klient jeszcze nie otworzył (`PozycjaDokumentu`, `publiczne/js/wniosek.js`),
  a `PortalLayout` (`portal.js`) liczy nieotwarte dokumenty do licznika w nawigacji.
- Uzasadnienie: dwa cele jednym polem — licznik „coś nowego czeka" (brak którego był luką z FAZY 0,
  punkt B6) I jednocześnie ślad doręczenia: moment, w którym dokument NA PEWNO dotarł do adresata,
  a nie tylko został wystawiony przez kancelarię.
- Źródło: `SESJA-PSA-FRONTEND.md` v2, punkt B6; `FRONTEND-INWENTARZ.md` B6.
- Skutek w kodzie: migracja 54; `server/logika/pakiet-wniosku.js`; `publiczne/js/wniosek.js`
  (plakietka „nowy"); `publiczne/js/portal.js` (`PortalLayout`, `SzynaPortalu`, liczniki).

---

### D-061 — Portal: „Dodaj spółkę" jako nowy wniosek na już zalogowanym koncie (B8)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 2)
- Obszar: portal
- Decyzja: konto w roli `spolka` (przyjęte, prowadzi już ≥1 spółkę) może samodzielnie założyć
  KOLEJNY wniosek o drugą spółkę przyciskiem „Dodaj spółkę" (`PrzyciskDodajSpolke`,
  `publiczne/js/portal.js`) — bez pośrednictwa kancelarii. Backend: nowy `POST
  /api/psa/portal/wniosek/nowy` (odmawia, gdy konto jest w roli `wnioskodawca` bez żadnej spółki, i
  gdy konto ma już otwarty wniosek w toku) oraz nowy `GET /api/psa/portal/wnioski` (liczba mnoga —
  lista wszystkich wniosków konta z ich statusami, do „Użyj danych reprezentanta z poprzedniego
  wniosku" i etykiet stanu w „Moje spółki").
- Odrzucono: zmianę kształtu odpowiedzi istniejącego `GET /portal/wniosek` (liczba pojedyncza,
  dziś zwraca jeden obiekt) na listę/tablicę — literalne brzmienie specyfikacji sesji sugerowało tę
  zmianę, ale wymagałaby przepisania ~15 istniejących konsumentów tej trasy (dokumenty, podpisy,
  weryfikacja) pod nowy kontrakt bez wyraźnej korzyści — nowy endpoint w liczbie mnogiej osiąga ten
  sam cel funkcjonalny przy niższym ryzyku regresji.
- Wykorzystana infrastruktura: model wielu spółek na jedno konto (`psa_konta_spolki`,
  D-037) i endpoint `/moje` już poprawnie filtrowały po `status NOT IN ('przyjety', 'odrzucony')` —
  ten sam warunek zastosowano w nowym `wczytajOtwartyWniosekKonta()`, używanym też przez
  wszystkie dotychczasowe trasy `PUT/GET /wniosek*` (wcześniej szukały wyłącznie po `konto_id` bez
  rozróżnienia, KTÓRY z wielu wniosków konta jest „bieżący").
- Źródło: `SESJA-PSA-FRONTEND.md` v2, punkt B8.
- Skutek w kodzie: `server/trasy/portal.js` (`wymagajWnioskodawcy`, `wczytajOtwartyWniosekKonta`,
  `wczytajLubZalozWniosek`, `GET /wnioski`, `POST /wniosek/nowy`); `publiczne/js/portal.js`
  (`PrzyciskDodajSpolke`, `STAN_WNIOSKU_ETYKIETA`, routing `wniosek` gated po roli);
  `publiczne/js/wniosek.js` (podpowiedź danych reprezentanta z poprzedniego wniosku).

---

### D-062 — Zgłoszenie → wniosek: KRS podstawiany z powiązanego zgłoszenia (P2)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 4)
- Obszar: portal
- Decyzja: konto powstałe z publicznego formularza zgłoszenia (`psa_zgloszenia`, KRS wymagany —
  D-047) dostaje nową kolumnę `psa_konta.zgloszenie_id`, ustawianą raz, przy założeniu konta w
  `server/logika/zaproszenia.js: wyslij()`. Pierwszy pusty wniosek tego konta
  (`wczytajLubZalozWniosek`, `server/trasy/portal.js`) podstawia z powiązanego zgłoszenia `krs` i
  `nazwa_spolki` — klient nie wpisuje numeru KRS drugi raz (0.4 pkt 1). Front (`EkranWniosku`,
  `publiczne/js/wniosek.js`) uruchamia automatyczne pobranie z KRS od razu po wczytaniu wniosku,
  jeśli `krs` jest już wypełnione, a `nazwa` jeszcze nie — ten sam mechanizm co ręczne wpisanie
  numeru, bez osobnego przycisku.
- Zakres tej zmiany: wyłącznie KRS + nazwa. Pełne przeniesienie składu organu do wyboru
  reprezentanta z listy (część P2 dotycząca reprezentanta) **nie zostało zrobione w tej sesji** —
  krok „Reprezentant" nadal wymaga ręcznego wpisania imienia i nazwiska nawet po udanym pobraniu
  z KRS; `krs.js` już zwraca skład organu (użyty w kancelarii, K6), więc podłączenie tego samego
  wyboru w portalu jest gotowe do zrobienia w kolejnej sesji, bez zmian schematu.
- Konta założone inną drogą niż zgłoszenie (np. bezpośrednio przez pracownika) mają
  `zgloszenie_id IS NULL` — wniosek zakłada się wtedy pusty, jak dotychczas.
- Źródło: `SESJA-PSA-FRONTEND.md` v2, FAZA 4 — P2.
- Skutek w kodzie: migracja 56 (`psa_konta.zgloszenie_id`); `server/logika/zaproszenia.js`
  (`wyslij()` przyjmuje i zapisuje `zgloszenieId`); `server/trasy/zgloszenia.js` (przekazuje
  `zgloszenieId` do `wyslij()`); `server/trasy/portal.js` (`wczytajLubZalozWniosek` podstawia
  krs/nazwa); `publiczne/js/wniosek.js` (auto-pobranie z KRS przy wczytaniu).

---

### D-063 — Strona publiczna: bundel statyczny osobny od `serwer.js`, nie wpięty w routing kancelarii

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 5)
- Obszar: strona publiczna (SEO) / infrastruktura
- Decyzja: `serwer.js` dziś serwuje aplikację kancelarii pod `/` i w catch-allu (`aplikacja.get('*', ...)`
  → `publiczne/index.html`) — każda nieznana ścieżka ląduje w SPA kancelarii. FAZA 5 chce stron
  publicznych pod `/`, `/oplaty` itd., co koliduje z tym catch-allem. Zamiast przepinać `/` kancelarii
  na inny adres (zmiana wpływająca na codzienny adres pracy notariusza, poza wyraźnym zakresem tego
  dokumentu sesji), strona publiczna buduje się jako **osobny bundel statyczny**
  (`narzedzia/buduj-strone.js` → `strona/dist/*.html` + `sitemap.xml` + `robots.txt`), niepodłączony
  do `serwer.js` w tej sesji. Zgodne z D-049 (domena nierozstrzygnięta, Q2) — skoro nie wiadomo,
  czy strona stanie na subdomenie tej aplikacji, na `notariusz.gdansk.pl`, czy na osobnej domenie,
  wpięcie jej w ten sam proces Express byłoby przedwczesne i mogłoby wymagać odkręcenia.
- `publiczne/robots.txt` (nowy) blokuje CAŁĄ resztę tej aplikacji (`Disallow: /`) — uzupełnienie
  istniejących meta `noindex` na `index.html`/`portal.html` (już były, sprzed tej fazy).
  `strona/dist/robots.txt` (osobny plik, część bundla) zezwala na indeksowanie — to inna domena.
- Odrzucono: przepięcie `/` kancelarii na `/kancelaria` i oddanie `/` stronie publicznej w tym samym
  procesie — zbyt duża, nieodwracalna bez ostrzeżenia zmiana adresu roboczego notariusza, nigdzie
  wprost nie zlecona w tym dokumencie sesji.
- Źródło: `SESJA-PSA-FRONTEND.md` v2, FAZA 5.
- Skutek w kodzie: `server/konfiguracja.js` (`BASE_URL_STRONA`); `narzedzia/buduj-strone.js` (nowy);
  `strona/tresc/*.md` (nowy, źródła treści); `publiczne/robots.txt` (nowy). `serwer.js` — bez zmian.

---

### D-057 — Zgłoszenie nieprawidłowości we wpisie: nowa tabela, odrębna od `psa_sprawy` (B9)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 2)
- Obszar: portal / rejestr
- Decyzja: klient sygnalizujący, że ISTNIEJĄCY wpis w rejestrze jest błędny lub niezgodny z
  dokumentem, robi to osobnym formularzem portalu (`POST /api/psa/portal/zgloszenie-nieprawidlowosci`,
  ekran `EkranZgloszenieBleduPortal`) — odrębnym od „Poproś o nowy wpis” (żądanie art. 300³⁴ § 1 KSH,
  `POST /api/psa/portal/zgloszenia` → `psa_sprawy`). Dane trafiają do nowej tabeli
  `psa_zgloszenia_nieprawidlowosci` (migracja 55). Pracownik kancelarii wyłącznie KWALIFIKUJE
  zgłoszenie (`POST /api/psa/zgloszenia-nieprawidlowosci/:id/kwalifikuj`, sekcja w `kokpit.js` przy
  spółce) jedną z trzech wartości: `sprostowanie` / `zadanie_wpisu` / `brak_nieprawidlowosci`. Sama
  kwalifikacja NIE zakłada sprawy ani nie dokonuje sprostowania automatycznie — to świadoma, osobna
  czynność pracownika zwykłym kreatorem zdarzenia (K3), tak jak przy każdym innym wpisie do
  niezmienialnego rejestru (art. 300³¹ § 4 KSH).
- Uzasadnienie: `psa_sprawy` ma własne ograniczenia CHECK i semantykę 7-dniowego zegara ustawowego
  dopasowaną do żądań NOWEGO wpisu — nie pasuje do przepływu czysto triażowego (klient zgłasza
  wątpliwość, kancelaria ocenia, bez terminu ustawowego). Nowa, mała tabela jest tańsza niż
  przeciążanie `psa_sprawy` warunkowym polem „typ”.
- Odrzucono: rozszerzenie `psa_sprawy` o nowy `typ_sprawy` — wymagałoby rozplątania CHECK-ów i
  logiki terminów dla przypadku, który terminu ustawowego nie ma.
- Zakres pominięty świadomie: załączniki (upload skanu do zgłoszenia) — kolumny w schemacie
  zarezerwowane, endpoint uploadu nie zbudowany w tej sesji.
- Etykiety przycisków „Poproś o nowy wpis” / „Zgłoś błąd we wpisie” są DOMYŚLNE robocze — do
  akceptacji Łukasza (patrz raport FAZY 2, sekcja B9).
- Źródło: `SESJA-PSA-FRONTEND.md` v2, punkt B9 (`komponenty-formularze-b1b12-raport.md`).
- Skutek w kodzie: migracja 55 (`psa_zgloszenia_nieprawidlowosci`); `server/trasy/portal.js` (POST
  zgłoszenia + GET listy klienta), `server/trasy/zgloszenia-nieprawidlowosci.js` (nowy plik, trasy
  kancelaryjne); `publiczne/js/portal.js` (formularz + link w rejestrze + tabela „Moje zgłoszenia”);
  `publiczne/js/kokpit.js` (sekcja „Zgłoszenia nieprawidłowości z portalu” + modal kwalifikacji).

---

### D-058 — „Stan na dzień" bez godziny; „Wpisano do rejestru" z sekundami przy pozycji (B12)

- Data: 2026-09-25 (sesja frontendowa v2, FAZA 2)
- Obszar: rejestr / interfejs
- Decyzja: pole godziny dodane naprawą Z-305/P-011 do widgetu „Stan na dzień" w kokpicie
  (`kokpit.js`, `EkranKokpitu`) zostaje USUNIĘTE — zgodnie z D-050 zostaje wyłącznie wybór dnia.
  Serwer nadal przyjmuje `data` z dokładnością do minuty (`RRRR-MM-DDTGG:MM`) — kontrakt API bez
  zmian, zmiana jest wyłącznie w UI. W zamian przy KAŻDEJ pozycji akcjonariusza w kokpicie oraz w
  wydrukowanej „Informacji z rejestru" pojawia się etykieta „Wpisano do rejestru: DD.MM.RRRR,
  HH:MM:SS" — moment SYSTEMOWY (kolumna `psa_zdarzenia.data_wpisu`, ma precyzję co do sekundy od
  początku, patrz `server/migracje.js:92`), odrębny od daty PRAWNEJ zdarzenia (`data_zdarzenia`)
  widocznej wyżej w tej samej pozycji.
- Uzasadnienie: „stan na dzień" z godziną rozwiązywał rzadki przypadek (dwa wpisy tego samego dnia)
  kosztem złożoności widocznej w KAŻDYM użyciu kokpitu; etykieta przy pozycji daje tę samą
  precyzję tam, gdzie jest faktycznie potrzebna — przy konkretnym wpisie, nie w globalnym filtrze.
- Skutek w kodzie: `server/logika/stan.js` (`akcjonariatNaDzien`) śledzi
  `zdarzenie_najstarszego_nabycia_id` obok `data_najstarszego_nabycia`; `server/widoki.js`
  (`widokStanu`) dołącza `wpisano_do_rejestru` (z mapy `id zdarzenia → data_wpisu`) do każdej
  pozycji akcjonariusza; `server/logika/informacja-dokument.js` dodaje wiersz „Wpisano do
  rejestru" pod opisem pozycji, gdy pole jest ustawione; `publiczne/js/kokpit.js`
  (`EkranKokpitu`, `TabelaAkcjonariatu`) usuwa `<input type="time">` i renderuje tę samą etykietę.
  Pole jest `null` dla pozycji bez odnalezionego zdarzenia źródłowego (nie powinno się zdarzyć w
  normalnym przepływie — zabezpieczenie, nie oczekiwany stan).
- Sprawdzone (2026-09-25): baza produkcyjna (`dane/kancelaria.db`) jest pusta (0 zdarzeń) — nie ma
  dziś żadnych historycznych rekordów do porównania pod kątem brakującej precyzji sekund. Do
  ponownego sprawdzenia, gdy w bazie pojawią się prawdziwe dane historyczne.
- Źródło: `SESJA-PSA-FRONTEND.md` v2, punkt B12.

---

### D-064 — Strona publiczna przeprojektowana od zera (SESJA-PSA-STRONA.md, zastępuje FAZĘ 5); bez `/nowelizacja-2027`

- Data: 2026-09-25 (sesja `SESJA-PSA-STRONA.md`)
- Obszar: strona publiczna (SEO)
- Decyzja: strona publiczna zbudowana w FAZIE 5 (`SESJA-PSA-FRONTEND.md`) była poprawna merytorycznie,
  ale wyglądała jak dokumentacja (lewa kolumna menu, identyczny szablon każdej strony, ściana tekstu
  z przepisami w nawiasach). `SESJA-PSA-STRONA.md` zleciła przeprojektowanie od zera: wąski pasek
  górny zamiast bocznego menu, hero z „żywym wpisem” (przykładowy wpis do rejestru złożony z
  HTML/CSS, oś akcji), sekcje odpowiadające na konkretne pytania klienta („Wybierz swoją sytuację”,
  „Jak to działa”, „Najkrótsze odpowiedzi”), cytaty prawne jako przyciski `popover`/`popovertarget`
  (dymek z brzmieniem przepisu, zero JavaScriptu) zamiast przepisów w nawiasach w zdaniu. Faza A
  (plan + statyczna makieta + STOP A z odpowiedziami Łukasza na Q-S1/Q-S2/Q-S4) opisana w
  `frontend-audyt/raporty/faza-strona-plan-a.md` i `faza-strona-teksty-a.md`; wynik Fazy B (build,
  pomiary, lista DO WERYFIKACJI) w `frontend-audyt/raporty/faza-strona-stop-b.md`.
- **Nowa mapa strony** (zastępuje FAZĘ 5): `/`, `/jak-zaczac`, `/sprzedaz-akcji`,
  `/przeniesienie-rejestru`, `/oplaty`, `/pytania`, `/kontakt`. Usunięte adresy FAZY 5:
  `/czym-jest-rejestr-akcjonariuszy`, `/nowelizacja-2027`, `/zbycie-akcji-i-wpisy`,
  `/zmiana-podmiotu-prowadzacego-rejestr` — bundel D-063 nigdy nie był wdrożony pod realną domeną
  (Q2/D-049 wciąż otwarte), więc stare adresy nie były nigdzie publicznie zaindeksowane: usunięte
  bez przekierowań 301, zamiast ich utrzymywania.
- **Bez strony o nowelizacji 2027** — decyzja Łukasza z 25.09.2026 (przekazana wprost w
  `SESJA-PSA-STRONA.md` sekcja 2 pkt 4), niezależna od usunięcia starych adresów: termin 18.05.2027
  z FAZY 5 i tak nie miał odzwierciedlenia w `PRZEPISY-PSA.md` i wymagał sprawdzenia z tekstem
  ustawy nowelizującej przed publikacją (patrz `frontend-audyt/raporty/faza5-raport.md` § 4) —
  temat odłożony do czasu, aż będzie potrzebny.
- **STOP A — decyzje Łukasza (2026-09-25), zapisane też w `faza-strona-teksty-a.md`:**
  - Nagłówek hero: „Rejestr Akcjonariuszy Prostej Spółki Akcyjnej” (prosty, dosłowny wariant D,
    nie żaden z A/B/C zaproponowanych w makiecie).
  - Q-S1 (czy strona może obiecać „bez wizyty w kancelarii”): **tak** — ale zdanie z tą obietnicą
    zostaje oznaczone `<!-- DO WERYFIKACJI -->` w źródle, bo ocena prawna zdalnej identyfikacji AML
    (P-012, `## Decyzje otwarte` niżej) pozostaje **formalnie nadal otwarta** — to decyzja o treści
    marketingowej strony, nie zamknięcie P-012.
  - Q-S2 (jakie ceny publikować): stawki maksymalne z `przepisy.js` (1200/100/50 zł netto) — te
    same co dziś, oznaczone ⚠️ DO WERYFIKACJI (patrz `STAWKI_DO_WERYFIKACJI` w `przepisy.js`).
  - Q-S4 (czy pokazać notariusza z imienia): tak, „Notariusz Łukasz Kozon” w stopce/kontakcie, bez
    zdjęcia na razie.
  - Q-S3 (domena) — nadal otwarte, bez zmian względem D-049.
- Skutek w kodzie: `narzedzia/buduj-strone.js` (przepisany — szablon z paskiem górnym/menu
  mobilnym/CTA przyklejonym, strona główna komponowana bezpośrednio jako HTML), `strona/styl.css`
  (przepisany), `strona/js/wzmocnienia.js` (nowy, < 3 KB — kalkulator opłat + przyklejone CTA na
  telefonie, jedyny JavaScript na stronie), `strona/przepisy-cytaty.js` (nowy — brzmienie przepisów
  do dymków popover, wyłącznie z `PRZEPISY-PSA.md`), `strona/tresc/*.md` (nowe/usunięte pliki wg
  mapy wyżej). D-063 (bundel osobny od `serwer.js`) bez zmian.
- Źródło: `SESJA-PSA-STRONA.md`.

---

### D-065 — Chwila wpisu jedyną osią czasu rejestru; data zdarzenia usunięta (D-R01)

- Data: 2026-09-26 (aktualizacja po porównaniu z rejestrem KRN, etap 1)
- Obszar: rejestr / model danych / łańcuch skrótów
- Decyzja (notariusz, `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md`, D-R01; odpowiedzi w
  `docs/krn/ETAP-0-RAPORT.md`): stan rejestru liczy się wyłącznie od chwili wpisu, dla każdego
  rodzaju wpisu (art. 300³⁷ § 1; dla przypadków z § 2 — art. 300³⁸ § 1 KSH). Kolumna
  `psa_zdarzenia.data_zdarzenia` usunięta z tabeli i ze skrótu (`lancuch.skrot`). `data_wpisu`
  nadaje system (UTC, `RRRR-MM-DDTGG:MM:SSZ`); żadna trasa nie przyjmuje daty wpisu ani dawnej
  daty zdarzenia (`rejestr.odrzucRecznaDate` → odmowa). Jedyny wyjątek: stan otwarcia z KRN
  (`migracja_krn.data_rejestracji`, zapisane w treści zdarzenia, więc w skrócie), dopuszczalny tylko
  w rejestrze bez zwykłych wpisów. „Stan na dzień D” = zdarzenia wpisane do 23:59:59 dnia D
  (Europe/Warsaw); dla dnia bieżącego — do chwili sporządzenia. Sprostowanie działa od chwili
  swojego wpisu (A5), więc informacja na dzień wcześniejszy nie zmienia się.
- Uzasadnienie: nabycie akcji następuje z chwilą wpisu; informacja na dzień D ma być taka sama
  niezależnie od chwili jej wygenerowania. W produkcji nie ma spółek (potwierdzenie notariusza
  z 26.09.2026), więc usunięcie kolumny z łańcucha nie narusza żadnego zapisanego skrótu.
- Skutek w kodzie: migracja 57 (`DROP COLUMN`, wykonuje się tylko na pustej tabeli zdarzeń —
  hook `warunek` w `server/migracje.js`); `server/pomocnicze/czas.js` (`terazUtc`, `chwilaUtc`,
  `koniecDniaUtc`, `dzienLokalny`, `godzinaLokalna`); `server/logika/stan.js` (kolejność i
  przedziały po `data_wpisu`); `server/widoki.js` (jedna semantyka „stanu na”, pola
  `chwila_stanu`, `stan_biezacy`); `server/logika/walidacje.js` (`sprawdzChwile` zamiast
  `sprawdzDate`/`sprawdzChronologie`); `server/rejestr.js`, trasy, zawiadomienia i dokumenty
  (prezentacja w strefie kancelarii); UI bez pola „Data zdarzenia”, emisja dostała pole „Data
  emisji” (atrybut emisji, nie zdarzenia), migracja zbiera datę i godzinę rejestracji w KRN.
  `psa_sprawy.dokument_data` (data dokumentu-podstawy) zostaje (A4). Pozostałe znaczniki czasu
  poza rejestrem (np. `data_wplywu`, `utworzono`) bez zmian — dotyczą obsługi spraw, nie stanu
  rejestru. Testy: `testy/d-r01-chwila-wpisu.test.js`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-R01), `docs/krn/ETAP-0-RAPORT.md`.

---

### D-066 — Treść informacji z rejestru po porównaniu z KRN (D-R02–D-R07)

- Data: 2026-09-26 (etap 2)
- Obszar: informacja z rejestru / widok stanu
- Decyzja: w tabeli emisji wyłącznie „Data zarejestrowania emisji” (`data_wpisu_krs`, art. 300³³
  § 1 pkt 3 KSH), cena emisyjna z walutą emisji i opis emisji; bez podstawy prawnej i bez daty
  emisji (ta zostaje na ekranie). W sekcji „Spółka” opis spółki. „Data zarejestrowania spółki” =
  `data_utworzenia_spolki`, która przechowuje datę rejestracji w KRS (import `dataRejestracjiWKRS`)
  — D-R02a spełnione bez zmian. Wiersz akcjonariusza = osoba + seria; w kolumnie „Numery i data
  wpisu” zakresy z datą wpisu każdego z nich, scalane tylko w obrębie tego samego dnia wpisu
  (np. `1–889, 990 (wpis 12.08.2026); 890–989 (wpis 25.09.2026)`); wiersze osoby obok siebie i
  wiersz „Łącznie” (akcje, udział) dla osoby z kilkoma seriami. Osobny wiersz „Wpisano do rejestru”
  usunięty (powtarzałby datę wpisu). Liczba głosów nie występuje w żadnej odpowiedzi API ani
  dokumencie — wyjątek: uchwała o wyborze notariusza (wzór 03) prosi o nią opcją `zGlosami` (A6).
  Stopka: „Sporządzono dd.mm.rrrr, godz. gg:mm”; dla dnia bieżącego „Stan na dd.mm.rrrr, godz. gg:mm”.
- Skutek w kodzie: `server/logika/stan.js` (`grupy_wpisu`, kolejność wierszy wg osoby),
  `server/widoki.js` (`grupy_wpisu`, `akcjonariusze_lacznie`, `glosy` tylko z `zGlosami`),
  `server/logika/informacja-dokument.js`, `server/trasy/spolki.js` (wzór 03). Testy:
  `testy/etap2-informacja.test.js`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-R02, D-R02a, D-R03/R06, D-R04/R05, D-R06, D-R07).

---

### D-067 — Kokpit i portal: zakresy z datą wpisu, wiersz „Łącznie” (D-R03/R06, etap 3)

- Data: 2026-09-26 (etap 3)
- Obszar: interfejs kancelarii i portal klienta
- Decyzja: kolumna numerów w kokpicie i w podglądzie rejestru w portalu pokazuje każdą grupę
  zakresów z jej datą wpisu (te same `grupy_wpisu`, co informacja z rejestru). Widok szczegółowy
  kokpitu ma wiersz na grupę zakresów z jedną datą wpisu (dawniej: wiersz na zakres z datą
  najstarszej transzy). Osoba z kilkoma seriami ma wiersz „Łącznie” (akcje, udział) w obu widokach
  kokpitu i w portalu. Podtytuł „akcjonariusz od …” usunięty — daty stoją przy numerach. Liczba
  głosów nie jest nigdzie wyświetlana (sprawdzone: kokpit, portal, informacja, eksporty).
- Skutek w kodzie: `publiczne/js/kokpit.js` (`rozbijNaSzczegoly`, `NumeryZDatami`,
  `TabelaAkcjonariatu`), `publiczne/js/portal.js`, `publiczne/style/rejestr.css`, `publiczne/dist/*`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-R03/R06, etap 3).

---

### D-068 — Przekazanie rejestru: tylko ewidencja, potem rejestr tylko do odczytu (D-31)

- Data: 2026-09-26 (etap 4)
- Obszar: rejestr / dane spółki
- Decyzja: `POST /api/psa/spolki/:id/przekazanie` zapisuje zdarzenie `przekazanie_rejestru` (data
  przekazania, typ odbiorcy: notariusz / izba notarialna / podmiot z art. 300³¹ § 1 pkt 1 KSH,
  nazwa, identyfikator, podstawa — np. nowa umowa, art. 300³² § 2 KSH) i jego odbicie w
  `psa_spolki.przekazanie_*` (migracja 58); pusta `data_zakonczenia_umowy` dostaje datę
  przekazania. Od tej chwili każdy wpis jest odrzucany — jedna funkcja
  `przepisy.blokadaWpisu(spolka)` sprawdzana w walidacji wpisu, w `rejestr.zapiszZdarzenie`
  (ostatnia zapora), przy zakładaniu spraw (kancelaria i portal) i przy zmianie danych spółki.
  Podgląd, historia i informacja z rejestru pozostają dostępne. Kokpit: pigułka „Rejestr
  przekazany”, przyciski akcji ukryte jak w widoku archiwalnym, okno ewidencji przekazania.
  Pakietu eksportu nie budujemy.
- Testy: `testy/d-31-przekazanie-http.test.js`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-31).

---

### D-069 — Kraje: słownik ISO 3166-1 alfa-2, kod zapisuje baza (D-34)

- Data: 2026-09-26 (etap 4)
- Obszar: model danych / adresy
- Decyzja: słownik `psa_kraje` (249 kodów, polskie nazwy z ICU, `server/dane/kraje.json`) i
  kolumny `*kraj_kod` przy sześciu polach kraju (spółka, reprezentant spółki, osoba, wniosek,
  reprezentant we wniosku, akcjonariusz we wniosku) — migracja 59. Kod ustawiają wyzwalacze bazy
  przy KAŻDYM zapisie, więc obejmują wszystkie ścieżki (kreator, portal, przyjęcie wniosku, import
  z KRS) bez zmian w trasach: dokładne dopasowanie kodu albo nazwy polskiej lub angielskiej (bez
  wielkości liter) → kod, a pole tekstowe dostaje polską nazwę ze słownika (formatowanie adresów i
  pisma bez zmian). Wartość nierozpoznana zostaje, kod = NULL, trafia do raportu
  `GET /api/psa/kraje/do-poprawy` (karta „Kraje do poprawy” w konfiguracji) — bez zgadywania.
  Kolumny tekstowe zostają (odwracalność). W interfejsie pole kraju to lista wyboru ze słownika
  (`publiczne/js/kraje.js`, generowany z JSON; zgodność pilnowana testem).
- Uwaga: SQLite porównuje wielkość liter tylko w ASCII — „WŁOCHY” wielkimi literami nie zostanie
  rozpoznane i trafi do raportu (bezpieczny kierunek błędu).
- Testy: `testy/d-34-kraje.test.js`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-34).

---

### D-070 — Osoba działająca przy wpisie: tylko audyt (D-Z)

- Data: 2026-09-26 (etap 4)
- Obszar: rejestr / audyt
- Decyzja: słownik `psa_osoby_dzialajace` (imię, nazwisko, funkcja: notariusz / zastępca
  notarialny, aktywny) i domyślna osoba pracownika `psa_uzytkownicy.osoba_dzialajaca_id`
  (migracja 60). Przy KAŻDYM wpisie (sprawa, wpis bezpośredni, otwarcie rejestru, sprostowanie,
  zmiana danych spółki, przekazanie) zapisujemy kopię danych osoby w `dane_json.dzialajacy`
  (objęte skrótem — późniejsza zmiana słownika nie zmienia historii), niezależnie od autora-
  pracownika. Ustalanie (`server/logika/osoba-dzialajaca.js`): wskazana w żądaniu
  (`dzialajacy_id`) → domyślna pracownika → jedyny aktywny notariusz → notariusz z danych
  kancelarii, gdy słownik jest pusty; niejednoznaczność = odmowa, nie domysł. Nie drukujemy jej na
  żadnym dokumencie ani nie pokazujemy w portalu; widoczna tylko w historii zdarzeń kokpitu.
  Zarządzanie: ekran „Użytkownicy” (słownik + domyślna osoba pracownika); wybór przy wpisie w
  kreatorze sprawy.
- Testy: `testy/d-z-osoba-dzialajaca.test.js`.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-Z).

---

## Decyzje otwarte

> Nic poniżej nie jest rozstrzygnięte — nie zgaduj odpowiedzi. Gdy Łukasz odpowie (w
> `testy-audyt/PYTANIA-DO-LUKASZA.md` albo bezpośrednio), kolejna sesja dokumentacyjna przenosi
> odpowiedź tutaj jako nowy wpis `D-0xx` w sekcji „Decyzje”.

### Z `testy-audyt/PYTANIA-DO-LUKASZA.md` — wszystkie 15, bez odpowiedzi na dziś (2026-09-18)

| ID | Skrót pytania | Obszar | Stan po sesji napraw (2026-09-19) |
|---|---|---|---|
| P-001 | Czy przy wpisie transakcyjnym na rzecz osoby prawnej wymagamy identyfikacji beneficjenta rzeczywistego? | AML | otwarte |
| P-002 | Czy akcja `niema` ma być automatycznie pozbawiona głosu, czy zależy to od umowy spółki? | rejestr | otwarte |
| P-003 | Czy automatyczne zaproszenie „od razu” po zgłoszeniu ma zostać, czy przywrócić ocenę kancelarii? | portal (patrz D-038) | otwarte |
| P-004 | Jaki ma być docelowy sposób nadawania dostępu portalowego akcjonariuszom innym niż wnioskodawca? | portal | otwarte |
| P-005 | Czy niezgodność dat uchwała/umowa i nadpisanie umowy bez śladu mają być blokadą czy ostrzeżeniem? | rejestr | otwarte |
| P-006 | Jaka ma być reguła walidacji krzyżowej `data_wpisu_krs` emisji względem daty rejestracji spółki? | rejestr | otwarte |
| P-007 | Czy stan otwarcia to wpisy na żądanie (każdy odpłatny), czy tylko opłata za prowadzenie? | opłaty | otwarte |
| P-008 | Czy martwy w UI endpoint `/naliczenie-roczne` ma zostać usunięty, zabezpieczony, czy zostać bez zmian? | opłaty | otwarte |
| P-009 | Czy dziennik dostępu ma objąć też zwykłe odczyty portalowe? | dziennik dostępu | **rozstrzygnięte → D-041** (tak, objęto); okres retencji nadal otwarty |
| P-010 | Jak naprawić rozjazd pól PEP przy przejęciu wniosku; czy dokumenty RODO/PEP mają powstawać też dla akcjonariuszy dochodzących po założeniu spółki? | AML / dane osobowe | **częściowo → D-041** (mapowanie PEP naprawione); rozszerzenie RODO/PEP (Z-153) nadal otwarte |
| P-011 | Czy „stan na” z dokładnością do minuty ma wrócić do UI (patrz D-032); czy `TZ` serwera ma być programowo wymuszony? | rejestr / interfejs | **rozstrzygnięte → D-042, D-050** (UI: tylko dzień — D-050 zastępuje D-043; `TZ` — D-042) |
| P-012 | Czy zdalna identyfikacja akcjonariusza (dane + opcjonalny skan wgrywany przez pracownika) spełnia wymogi AML? | AML | częściowo — mechanizm samodzielnego wgrywania skanu przez akcjonariusza dodany (D-041); ocena PRAWNA wymogów AML nadal otwarta |
| P-013 | Czy status AML `brak` powinien blokować wpis tak jak `niemozliwe` (patrz D-010)? | AML | otwarte (świadomie nietknięte — patrz uzupełnienie D-010) |
| P-014 | Czy dezaktualizacja AML i brak beneficjenta rzeczywistego mają blokować wpis? | AML | otwarte (świadomie nietknięte) |
| P-015 | Czy potrzebny jest mechanizm oznaczania danych jako testowe/demo na produkcji? | operacyjne | **rozstrzygnięte → D-044** (nie, niepotrzebny) |
| P-016 | Kto fizycznie działa (podpisuje) za akcjonariusza-osobę prawną — brak pola reprezentanta akcjonariusza | AML / dokumenty (sesja frontendowa v2, B11) | otwarte |
| P-017 | Czy `beneficjent_rzeczywisty_id` (pojedyncze pole) wystarcza przy więcej niż jednym beneficjencie rzeczywistym | AML (sesja frontendowa v2, B11) | otwarte |

Pełny kontekst i warianty odpowiedzi dla każdego: `testy-audyt/PYTANIA-DO-LUKASZA.md`.

### Z `README.md`, sekcja „Do decyzji” — pozycje nadal otwarte (numeracja własna README)

1. **Konsekwencje wariantu wdrożenia A** przed realnym włączeniem portalu na produkcji: TLS
   obowiązkowe, kopie zapasowe szyfrowane offsite, umowa powierzenia przetwarzania danych (RODO),
   decyzja kiedy przełączyć `PORTAL_WLACZONY` na `true`. *(Sam wariant A jest już rozstrzygnięty —
   patrz D-019.)*
2. **Weryfikacja brzmienia przepisów nowelizacji** — pozycje oznaczone ⚠️ w `PRZEPISY-PSA.md` nie
   mogą być podstawą blokady, dopóki Łukasz nie potwierdzi tekstu ustaw źródłowych.
3. **Kto może dokonać wpisu** — pytanie do izby notarialnej; dziś: każdy zalogowany pracownik.
4. **Stawki** — dziś wpisane maksymalne (1200/100/50 zł); obniżenie to zmiana trzech liczb.
5. **Integracja opłat z modułem Kasa** — rekomendacja: osobno, scalenie po ustabilizowaniu modułu.
6. **Czy „prowadzenie rejestru” jest należne za spółki `w_likwidacji`/`zawieszona`** — dziś „tak”
   (D-022), do potwierdzenia.
7. **Weryfikacja tekstu ustawy przed realnym użyciem stubów sądowych** (bramkowanych datą
   18.02.2027) — nie pilne dziś.
8. **Osobna treść zawiadomienia dla wpisu deklaratoryjnego** (D-027) — `charakter_wpisu` już
   obliczany i zapisywany, zawiadomienie ma dziś jedną treść dla obu przypadków.
9. **Rozszerzenie `pokrycie_akcji` na wszystkie emisje spółki naraz** (D-024) — dziś jedna emisja na
   zdarzenie.
10. **Plik `STANDARDY-KANCELARIA-4-1.md` nie był dostępny przy budowie** — konwencje katalogów
    odtworzono ze specyfikacji modułu; przemianowanie tanie, jeśli inne moduły kancelarii (Kalkulator,
    Kasa) używają innej konwencji.

### Nowe pytania odkryte podczas tej sesji dokumentacyjnej (nie w `PYTANIA-DO-LUKASZA.md`)

- **Rozjazd dwóch komentarzy w kodzie o modelu zgłoszeń** (D-038, `portal.js` vs `zgloszenia.js`) —
  pokrywa się treściowo z P-003, ale warto zauważyć, że to nie tylko pytanie „co ma być”, tylko
  także „który z dwóch already-istniejących opisów w kodzie jest już nieaktualny i wymaga
  poprawienia komentarza niezależnie od decyzji”.
- **Uzasadnienie migracji 34/41/28 (AML per spółka, wiele spółek na konto, drugi silnik dokumentów)
  nieznane** — jeśli Łukasz pamięta kontekst tych decyzji, warto go dopisać do wpisów D-034/D-036/
  D-037 (dziś oznaczonych „uzasadnienie nieznane”), żeby rejestr był kompletny.

### Z sesji frontendowej (`SESJA-PSA-FRONTEND.md`, STOP po FAZIE 0, 2026-09-20)

- **Q2 — domena strony publicznej.** Jedyne z pytań Q1-Q5 bez odpowiedzi — Łukasz zapytany, wraca do
  tematu później. Warianty: (A) podstrony `notariusz.gdansk.pl` (WordPress), (B) subdomena
  obsługiwana przez tę aplikację, (C) osobna domena. Do czasu decyzji: strony FAZY 5 budowane z
  `BASE_URL` jako parametrem (patrz D-049).
