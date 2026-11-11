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

### D-071 — Przepływ wprowadzania danych (D-P1, D-P2, D-P3)

- Data: 2026-09-26 (etap 5)
- Obszar: interfejs kancelarii / walidacja
- Decyzja:
  - **D-P1** — przy każdym wierszu akcjonariusza (także w widoku szczegółowym, per zakres) przyciski
    „Zbycie / Obciążenie / Umorzenie”. Parametry `emisja`, `osoba`, `zakres` przechodzą przez
    założenie sprawy do kreatora (`daneStartowe` w `publiczne/js/sprawy.js`): wypełnione są seria,
    zbywca albo akcjonariusz i zakres numerów, który można zawęzić (umorzenie i obciążenie dostały
    pole „Numery akcji”; przeniesienie korzysta z istniejącego trybu ręcznego zakresu).
  - **D-P2** — było już zrealizowane: `WyborZKartoteki` (jeden komponent w całej aplikacji)
    wyszukuje w `psa_osoby` i ma „+ Nowa osoba w kartotece” w tym samym oknie; po zapisie osoba jest
    od razu wybrana. Używany dla nabywcy, obejmującego, zastawnika/użytkownika, przedstawiciela.
  - **D-P3** — po objęciu choć jednej akcji emisji sprostowanie serii, numeru pierwszej akcji albo
    liczby akcji (i wycofanie całej emisji) jest odrzucane w `walidacje.js`
    (`sprawdzSprostowanieEmisji`) z komunikatem kierującym do umorzenia albo nowej emisji; pola
    opisowe przechodzą. W kokpicie przycisk „Sprostuj” przy emisji otwiera okno z tymi trzema polami
    zablokowanymi i tym samym komunikatem.
  - Podglądu „przed/po” nie rozbudowujemy. Walidacja „nabywca ≠ zbywca” bez zmian (obejmuje
    wszystkie tytuły przejścia oraz przeniesienie ułamka — `ETAP-0-RAPORT.md`, B9).
- Testy: `testy/d-p3-blokada-emisji.test.js`; UI sprawdzone w przeglądarce (Playwright):
  wypełnienie kreatora dla trzech czynności, okna sprostowania emisji i przekazania, brak błędów JS.
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (D-P1, D-P2, D-P3).

---

### D-072 — Dokumentacja po porównaniu z KRN i reguły przejęcia z KRN (D-R08, etap 6)

- Data: 2026-09-26 (etap 6)
- Obszar: dokumentacja
- Decyzja: `CLAUDE-PSA.md` — nowa reguła domenowa 6 (chwila wpisu jedyną osią czasu), model danych
  (`psa_zdarzenia` bez daty zdarzenia, `przekazanie_*`, `*kraj_kod`, `psa_kraje`,
  `psa_osoby_dzialajace`, znaczenie `data_utworzenia_spolki`), typ `przekazanie_rejestru`, nowe
  walidacje blokujące. `PRZEJECIE-REJESTRU.md` §3a — reguły D-R08 pkt 1–8, w tym wstrzymanie
  migracji Charlie Unicorn AI PSA do decyzji notariusza. `docs/krn/POROWNANIE-KRN-PSA.md` —
  tabela rozstrzygnięć. Test scenariusza KRN z numeracją AN 1–25 / AZ 26–100:
  `testy/d-r08-krn-numeracja.test.js`.
- Otwarte: weryfikacja cytatów art. 300³⁵ § 1¹ i art. 300³² § 3 KSH (Dz.U. 2026 poz. 176) —
  notariusz odłożył ją na później (`ETAP-0-RAPORT.md`, A7).
- Źródło: `docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md` (etap 6, D-R08).

---

### D-073 — Strona publiczna wdrożona 1:1 z zatwierdzonego projektu (SESJA-PSA-STRONA.md wersja 5); stawki potwierdzone; gwarancja ceny 3 lata

- Data: 2026-09-26 (sesja `SESJA-PSA-STRONA.md`, wersja 5 — „wdrożenie zatwierdzonego projektu")
- Obszar: strona publiczna (SEO)
- Decyzja: poprzednia wersja strony (D-064, projektowana i budowana przez Claude) zastąpiona w
  całości projektem zaprojektowanym poza tą sesją i zatwierdzonym przez Łukasza —
  `projekt-strony/nowa-strona.html`, plik źródłowy, którego treści, kolorów, układu i animacji nie
  wolno zmieniać poza techniką wdrożenia (wydzielenie CSS/JS, podstawienie `{{BASE_URL}}`, kwot i
  danych kancelarii). Mapa stron zredukowana do jednej strony głównej (sekcje: Opłaty, Jak działa
  portal, Informacja z rejestru, Pytania) plus `/regulamin` i `/polityka-prywatnosci` — reszta
  podstron z D-064 (`/jak-zaczac`, `/sprzedaz-akcji`, `/przeniesienie-rejestru`, `/oplaty`,
  `/pytania`, `/kontakt`) usunięta. Żadna z nich nie była nigdy opublikowana pod realną domeną
  (bundel D-063 nigdy nie wyszedł poza to repozytorium), więc — zgodnie z warunkiem „jeśli był
  opublikowany" w dokumencie sesji — **bez przekierowań 301**; dodanie stron-przekierowań byłoby
  też sprzeczne z wprost zabronionym w tym samym dokumencie dodawaniem nowych podstron.
- **Stawki potwierdzone przez Łukasza 26.09.2026** (1200/100/50 zł netto — te same liczby co
  dotychczasowe stawki maksymalne w `przepisy.js`, teraz jako stawki DOCELOWE, nie „maksymalne do
  potwierdzenia"): `STAWKI_DO_WERYFIKACJI` w `server/logika/przepisy.js` ustawione na `false`.
  Strona pobiera kwoty wyłącznie z `STAWKI_GROSZE`/`obliczBrutto` — zweryfikowane w tej sesji
  zmianą stawki i odbudową strony (kwota faktycznie się zmieniła we wszystkich 9 miejscach:
  3× karta ceny, 3× netto, 3× JSON-LD/FAQ — potem przywrócono oryginał).
- **Gwarancja ceny — 3 lata od podpisania umowy, wszystkie opłaty** (decyzja Łukasza z tego
  samego dnia). To deklaracja handlowa na stronie (sekcja „Opłaty"), nie mechanizm w kodzie —
  `psa_oplaty`/`server/oplaty.js` nadal liczą wg aktualnej stawki z `przepisy.js` w chwili
  naliczenia; jeśli w przyszłości stawki się zmienią, dotrzymanie tej gwarancji dla umów
  zawartych wcześniej jest procesem po stronie kancelarii (np. osobna stawka umowna), nie czymś,
  co ten moduł dziś automatyzuje. Odnotowane, żeby przy ewentualnej zmianie stawek ktoś o tym
  pamiętał.
- **Dane kancelarii w tym repozytorium — przez `.env` (gitignored), nie na sztywno w kodzie.**
  W tym środowisku audytowym `KANCELARIA_ULICA`/`KANCELARIA_KOD`/`KANCELARIA_MIASTO`/
  `KANCELARIA_EMAIL` były puste (przykładowy `.env.przyklad` ich nie ustawia) — dodany lokalny,
  nieśledzony `.env` z rzeczywistym adresem i e-mailem z zatwierdzonego projektu, żeby build w tej
  sesji odzwierciedlał to, co zobaczy produkcja. W realnym wdrożeniu te wartości muszą być
  ustawione we właściwym `.env` serwera — inaczej strona zbuduje się z pustym adresem w stopce
  i JSON-LD (generator NIE ma literalnego fallbacku na te dane — jedyne źródło to
  `ustawienia.kancelaria(db())`, zgodnie z pkt 8 dokumentu sesji).
- Regulamin i polityka prywatności: treść przeniesiona z `publiczne/js/prawne.js` (jedyne źródło
  tych tekstów, bez zmian merytorycznych) na statyczny HTML w ramie wizualnej nowego projektu
  (nagłówek/stopka/typografia — pkt 1 dokumentu sesji). Do polityki prywatności dodana nowa
  sekcja „8. Pliki cookies" (pkt 11 dokumentu sesji) z nazwą ciasteczka portalu
  (`psa_sesja_portal`, `server/pomocnicze/autoryzacja.js`), celem i czasem przechowywania
  (8 godzin, `server/logika/sesja.js`, `TTL_PORTAL_MS`) oraz stwierdzeniem, że strona publiczna
  ciasteczek nie zapisuje — zweryfikowane żywo (Playwright, `document.cookie`/`localStorage`/
  `sessionStorage` puste na wszystkich 3 stronach). Treść oznaczona
  `<!-- DO WERYFIKACJI -->` do akceptacji Łukasza.
- Zaślepki (zrzut portalu w hero, przykładowa informacja z rejestru) — zostawione bez zmian,
  zgodnie z pkt 10 dokumentu sesji. Obraz Open Graph (`obrazy/og-rejestr.png`, 1200×630)
  wygenerowany ze zrzutu sekcji hero — zawiera więc dziś tę samą widoczną zaślepkę; do
  regeneracji, gdy zaślepka zniknie, przed publikacją produkcyjną.
- Odrzucono: literalne wpisanie adresu/e-maila kancelarii i kwot bezpośrednio w generatorze jako
  fallback dla pustego `.env` — złamałoby zasadę „jedno źródło" (pkt 6 i 8 dokumentu sesji) i
  ukryłoby brak realnej konfiguracji zamiast go ujawnić.
- Skutek w kodzie: `narzedzia/buduj-strone.js` (przepisany od zera — wydziela CSS/JS z
  `projekt-strony/nowa-strona.html`, podstawia kwoty/dane/BASE_URL, generuje 2 podstrony prawne),
  `projekt-strony/*` (nowy — źródło prawdy: `nowa-strona.html`, `notariat.png`, `og-rejestr.png`),
  `server/logika/przepisy.js` (`STAWKI_DO_WERYFIKACJI = false`), usunięte:
  `strona/tresc/*.md`, `strona/przepisy-cytaty.js`, `strona/makieta/`, `strona/js/`,
  `strona/styl.css` (cały poprzedni, wieloplikowy generator z D-064).
- Źródło: `SESJA-PSA-STRONA.md` wersja 5, `publiczne/js/prawne.js`, `server/pomocnicze/
  autoryzacja.js`, `server/logika/sesja.js`.

---

### D-074 — Tryb testowy bez poczty (SESJA-PSA-WYTYCZNE.md, Faza 1)

- Data: 2026-11-01 (sesja wdrożenia wytycznych „Rejestr akcjonariuszy PSA online”)
- Obszar: operacyjne / poczta / uwierzytelnianie
- Decyzja: tryb testowy (`PSA_TRYB_TESTOWY=1` w `.env`, nic innego go nie włącza):
  1. **Poczta przez jeden punkt** (`server/poczta.js: wyslij()`) z wymiennym transportem
     (`POCZTA_TRANSPORT`): `smtp` albo — wyłącznie w trybie testowym — `skrzynka-testowa`
     (`.eml` w `dane-testowe/skrzynka/`, nic nie wychodzi z serwera, status „testowa — niewysłana”).
     Bez transportu wysyłka zwraca widoczny błąd, nigdy cichy sukces. Strona „Skrzynka testowa”
     (`/test/skrzynka`) bez logowania, tylko w trybie testowym.
  2. **Logowanie bez poczty** bez osobnego endpointu ani tokenu: lista kont testowych na ekranach
     logowania woła zwykłe `POST /login` znanym hasłem kont testowych (`Test-Haslo-2026`), „Zaloguj
     (tryb testowy)” otwiera zwykły link aktywacyjny, `npm run test:link` drukuje ten sam link.
     Aplikacja nie ma logowania linkiem ani drugiego składnika — nie ma czego wyłączać.
  3. **Osobna baza** (`PSA_BAZA_TESTOWA`, domyślnie `dane-testowe/kancelaria-testowa.db`) i katalog
     dokumentów; oznaczenie bazy wierszem w `psa_baza_testowa` (migracja 61). **D-044 zostaje** —
     oznaczamy całą bazę, nie rekordy.
  4. **Jedna funkcja czasu** `czas.teraz()` z przesunięciem ustawianym tylko przez tryb testowy
     (symulowana data, zapisana w bazie testowej); data wcześniejsza niż ostatnie zdarzenie —
     odrzucana. Ważność sesji, tokenów i limiter logowania zostają w czasie rzeczywistym.
  5. **Atrapy:** KRS (numery `0000990001`–`0000990003`, kształt odpowiedzi API), tpay w aplikacji
     (`/test/tpay/*`, ITN na zwykły endpoint, gdy w `.env` brak danych tpay), walidator podpisu
     (wybór wyniku; podpięcie w Fazie 2).
  6. **Zabezpieczenia:** `NODE_ENV=production` albo baza bez oznaczenia → odmowa startu, zanim
     ruszą migracje; poza trybem testowym `/test/*` → 404; czerwony pasek na każdym ekranie;
     każde logowanie w trybie testowym w `psa_dziennik_logowan` (append-only, migracja 61).
- Uzasadnienie: wymaganie Łukasza — przejście każdego przepływu bez skonfigurowanej poczty
  (docelowo Microsoft 365, `biuro@notariusz.gdansk.pl`; transportu produkcyjnego nie konfigurujemy).
- Odrzucono: osobny endpoint „zaloguj bez hasła” (inna ścieżka niż produkcyjna); znaczniki testowe
  per rekord (D-044); nowa zależność do plików `.eml` (MailComposer jest w `nodemailer`).
- Testy: `testy/tryb-testowy.test.js`, `testy/tryb-testowy-wylaczony.test.js`.
- Skutek w kodzie: `server/tryb-testowy/*` (nowe), `server/poczta.js`, `server/pomocnicze/czas.js`,
  `server/konfiguracja.js`, `server/migracje.js` (61), `serwer.js`, `server/trasy/{auth,portal,
  zgloszenia,krs}.js`, `server/logika/{zaproszenia,dziennik-dostepu}.js`, `publiczne/js/tryb-testowy.js`
  (nowy), `publiczne/js/{auth,portal,osoby,zgloszenia,sprawy,rdzen}.js`, `narzedzia/test-{seed,link,
  oznacz}.js` (nowe).

---

### D-075 — Polityka podpisów (Łukasz, 31.10.2026) — zastępuje D-054 w zakresie mechanizmu

- Data: 2026-11-01 (SESJA-PSA-WYTYCZNE.md, Faza 2 pkt 1)
- Obszar: portal / kancelaria / dokumenty / podpisy
- Decyzja: **skany odrzucane**; dopuszczalne formy podpisu według tabeli § 2 wytycznych, zapisanej
  w jednym miejscu (`server/logika/formy-podpisu.js`); podpis online przez mObywatel (QES), podpis
  zaufany (PZ) albo osobisty (PO); oryginał pocztą (dla zgody na wpis — wyłącznie z podpisem
  notarialnie poświadczonym); podpis w kancelarii. Automatyczna walidacja po wgraniu blokuje tylko to,
  co na pewno niespełnione; niepewne → „Do weryfikacji ręcznej”; nigdy automatycznej akceptacji bez
  udanej walidacji. Checklistę nadal zaznacza człowiek (D-052). Zasada „dokument po dokumencie” z D-054
  **zostaje**.
- Uzasadnienie: decyzja Łukasza, wytyczne „Rejestr akcjonariuszy PSA online” § 2–3.
- Odrzucono: przyjmowanie skanu jako dokumentu podpisanego (D-054 w części „wgranie skanu”).
- Skutek w kodzie: Faza 2 — `formy-podpisu.js`, `walidacja-podpisu.js`, portal „Podpisz dokument”.

### D-076 — Forma zgody i PESEL albo data urodzenia według nowelizacji — od dziś (K1, K2)

- Data: 2026-11-01 (odpowiedź Łukasza na STOP Fazy 1)
- Obszar: rejestr / zgody / dane osobowe
- Decyzja: (1) zgoda na wpis (art. 300³⁴ § 3) przyjmowana **już teraz** wyłącznie w formach
  z art. 300³⁴ § 3 zd. 2 w brzmieniu nowelizacji (podpis notarialnie poświadczony, podpis w obecności
  osoby upoważnionej przez prowadzącego rejestr, QES, PZ, PO) — bez czekania na 18.02.2027 i bez
  bramki daty; skan i zwykły oryginał pocztą = brak zgody. **Zastępuje D-026** (forma zgody jako
  dowolny tekst). (2) Rejestr **wymaga PESEL albo daty urodzenia** akcjonariusza będącego osobą
  fizyczną już teraz (wymóg z art. 30 ustawy zmieniającej stosowany wcześniej jako polityka
  kancelarii); udostępnianie bez zmian — art. 300³⁵ § 1¹ (maskowanie dla pozostałych akcjonariuszy
  działa już dziś, W5.4). Klientów przygotowujemy od razu do formy docelowej.
- Uzasadnienie: decyzja Łukasza — „nie będziemy zmieniać w lutym”.
- Skutek w kodzie: (1) Faza 2 (W2.2); (2) Faza 3 (W6.1). `PRZEPISY-PSA.md` § 12 pkt 2–3 sprostowane.

### D-077 — Zakładka „Rejestr” w portalu: tylko dane spółki, bez akcjonariatu (K5)

- Data: 2026-11-01 (odpowiedź Łukasza na STOP Fazy 1)
- Obszar: portal / dostęp
- Decyzja: zakładka „Rejestr” w portalu pokazuje wyłącznie dane spółki; stan akcjonariatu — tylko
  w płatnej informacji z rejestru (W5.1). Sposób realizacji prawa dostępu z art. 300³⁵ § 2 (§ 9 pkt 1
  wytycznych) pozostaje do opisania w regulaminie.
- Skutek w kodzie: Faza 3 (W5.1) — portal i API (maskowanie na poziomie API, nie tylko widoku).

---

### D-078 — Przyjęcie wniosku bez podpisu notariusza na umowie

- Data: 2026-11-01 (odpowiedź Łukasza na STOP Fazy 2)
- Obszar: wnioski / umowa o prowadzenie rejestru
- Decyzja: przyjęcie wniosku **nie wymaga** podpisu notariusza na umowie — notariusz podpisuje ją
  później. Kolejność z W2.5 zostaje: podpis notariusza (QES) można wgrać dopiero po potwierdzeniu
  ważnego podpisu spółki.
- Skutek w kodzie: brak zmiany (stan zgodny); `POST /wnioski/:id/przyjmij` bez warunku podpisu notariusza.

### D-079 — Formularz publiczny nie ujawnia, czy kancelaria prowadzi rejestr spółki (K6)

- Data: 2026-11-01 (odpowiedź Łukasza na STOP Fazy 2)
- Obszar: portal / formularz zgłoszenia / ochrona informacji o klientach
- Decyzja: po wpisaniu numeru KRS formularz zgłoszenia odpowiada **tak samo** dla nowej spółki, dla
  spółki, której rejestr już prowadzimy, i dla zgłoszenia w toku. Duplikat obsługiwany po cichu:
  zgłoszenie zapisane jako zamknięte z notatką wewnętrzną (ślad w kolejce „Zgłoszenia”, filtr
  „odrzucone”), bez nowego konta i zaproszenia; na podany adres idzie neutralna wiadomość. Walidacja
  danymi publicznymi KRS („nie ma takiej spółki”, „to nie jest P.S.A.”) zostaje — dotyczy rejestru
  publicznego, nie relacji z kancelarią. **Link aktywacyjny nie wraca już w odpowiedzi formularza**
  (zdradzałby różnicę; usuwa też obserwację O1) — przy awarii poczty przekazuje go kancelaria
  z kolejki zgłoszeń.
- Testy: `testy/zgloszenia-http.test.js` (identyczna odpowiedź, ślad, brak konta).
- Skutek w kodzie: `server/trasy/portal.js` (`POST /zgloszenia`, `zgloszenieDuplikat`),
  `publiczne/js/portal.js` (ekran po zgłoszeniu), `narzedzia/scenariusz-e2e.js`, `testy/reczne/*`.

---

### D-080 — Eksport całego rejestru z dokumentami (W6.3) — zastępuje „pakietu eksportu nie budujemy” z D-068

- Data: 2026-11-01 (SESJA-PSA-WYTYCZNE.md, Faza 3)
- Obszar: rejestr / akta
- Decyzja: `GET /api/psa/spolki/:id/eksport.zip` — README, pełna informacja z rejestru (HTML), historia
  zdarzeń (CSV i JSON z łańcuchem SHA-256), dokumenty (sprawy, akta spółki, wniosek, wydane pisma,
  potwierdzenia nadania). Ślad w dzienniku dostępu (`eksport`). Nic nie jest usuwane (W6.4 — test
  regresyjny pilnuje miejsc usuwania plików).
- Podstawa: art. 90a PrNot (PRZEPISY-PSA.md § 8).

### D-081 — Komunikacja z akcjonariuszem: e-mail tylko przy zgodzie złożonej osobiście, inaczej list

- Data: 2026-11-01 (Faza 3, W4.1–W4.5)
- Obszar: zawiadomienia / powiadomienia / portal
- Decyzja: pismo do osoby (zawiadomienie o wpisie, odmowie, wezwanie, powiadomienie uprzednie) idzie
  e-mailem wyłącznie przy `zgoda_email_status = 'potwierdzona'`; `zadeklarowana` (deklaracja zarządu we
  wniosku) nie jest zgodą. W pozostałych przypadkach — kolejka listów: adres z rejestru (kopia w chwili
  wystawienia, nigdy z żądania), data i numer nadania, skan potwierdzenia; powiadomienie uprzednie jest
  „wysłane” z dniem nadania. Odmowa — także do spółki (bezpłatnie). Oświadczenia akcjonariusza (zgoda
  e-mail, żądanie automatycznych powiadomień) składa on sam w portalu; zgoda e-mail jako dana rejestru
  idzie przez żądanie wpisu `zmiana_danych_akcjonariusza` (opłata jak dziś — QW1 otwarte).
- Skutek w kodzie: `server/listy.js`, `server/trasy/listy.js`, `server/zawiadomienia.js`,
  `server/trasy/portal.js` (`/oswiadczenia`), migracja 64.

### D-082 — Informacje z rejestru: numer, wynagrodzenie z VAT, organy; wersje stawek i gwarancja ceny

- Data: 2026-11-01 (Faza 3, W5.3–W5.7)
- Obszar: informacje / opłaty
- Decyzja: każda informacja ma numer `INF/RRRR/NNNN` i sekcję „Wynagrodzenie” (netto, VAT, brutto,
  podstawa: § 15b ust. 3 rozporządzenia, art. 300³⁵ § 3 KSH, art. 89 § 2 PrNot). Informację organowi
  (art. 300³⁵ § 4) wydaje kancelaria z sygnaturą sprawy — bez automatycznej opłaty („nie pobrano”, do
  decyzji kancelarii). Dziennik wydanych informacji: numer, data, odbiorca, opłata. Zmiana stawek tworzy
  wersję z datą (`psa_stawki_wersje`); spółka w okresie gwarancji ceny (`gwarancja_ceny_lat`, domyślnie 3,
  liczone od `data_umowy`) rozliczana według wersji z dnia umowy. Informacja dla spółki pokazuje PESEL
  albo datę urodzenia (D-076); akcjonariusz nie widzi ich u innych.

---

### D-083 — Odpowiedzi QW1–QW3 i opłaty od organów (Łukasz, STOP Fazy 3)

- Data: 2026-11-01
- Obszar: opłaty / portal / komunikacja
- Decyzja:
  1. **QW1** — płatne są **wyłącznie zmiany w akcjonariacie**. Zmiana albo cofnięcie zgody na e-mail
     i inne zmiany danych są bezpłatne: `odplatne: false` dla `zmiana_danych_akcjonariusza`,
     `zmiana_danych_spolki`, `uprawnienie`, `ograniczenie`, `przedstawiciel`, `pokrycie_akcji`,
     `zdarzenie_inne`. Płatne zostają: emisja, objęcie, przeniesienie (także ułamka), umorzenie,
     unieważnienie, zobowiązanie do przeniesienia oraz obciążenia (ustanowienie, wykreślenie, prawo głosu
     zastawnika) — **obciążenia do potwierdzenia** (zmieniają prawa do akcji, nie osobę akcjonariusza).
  2. **QW2** — przy żądaniu automatycznych powiadomień kopia pisma trafia dodatkowo do zakładki
     „Dokumenty” portalu; e-mail albo list idą bez zmian.
  3. **QW3** — osoby bez zgody na komunikację e-mail **nie są zapraszane do portalu** (odmowa zaproszenia)
     i nie logują się do niego (po wpisaniu cofnięcia zgody dostęp wygasa); żądania składają pocztą albo
     w kancelarii. Uprzedzenie: pouczenie na każdym liście, podpowiedź we wniosku i w „Moich oświadczeniach”.
  4. **Organy** — informacja z rejestru bez opłaty.
- Skutek w kodzie: `logika/typy-zdarzen.js`, `zawiadomienia.js`, `listy.js`, `trasy/listy.js`,
  `logika/zaproszenia.js`, `trasy/portal.js` (logowanie), `trasy/informacje.js`, `publiczne/js/*`;
  dane testowe: bez konta portalu dla akcjonariusza bez zgody (lista kont T2 skrócona).

---

### D-084 — Przeniesienie rejestru od innego podmiotu (Faza 4, wytyczne § 7)

- Data: 2026-11-01 (SESJA-PSA-WYTYCZNE.md, Faza 4)
- Obszar: zgłoszenia / wnioski / rejestr / opłaty
- Decyzja:
  1. Wariant istniejącego przepływu zgłoszenie → wniosek: opcja „Przenoszę rejestr od innego podmiotu”
     w formularzu publicznym (odpowiedź jak przy każdym zgłoszeniu — D-079), rekord `psa_przeniesienia`.
  2. Statusy § 7.3 jako jawna maszyna stanów (`server/logika/przeniesienie.js`) z warunkami przejść;
     historia append-only; „Wygasła” — po 12 miesiącach bez ziszczenia warunku (przy odczycie listy i pulpitu).
  3. Checklisty Etapu 3 i 6 zaznacza człowiek (D-052); blokada tylko pozycji na pewno niespełnionych
     (brak uchwały, umowy spółki, danych poprzednika).
  4. Umowa: klauzula § 7.4 **dosłownie** (w pakiecie wniosku i jako szablon); uchwała — brzmienie wyboru
     spod klauzuli, reszta „PROJEKT — do akceptacji Łukasza”; pozostałe pisma pakietu przez `psa_szablony`
     (wbudowane, edytowalne), jako PROJEKT; zgłoszenie do KRS — za bramką 18.02.2027.
  5. Okres przejściowy: datę rozwiązania wpisuje kancelaria po weryfikacji dokumentu; przypomnienia
     (14 dni, 30 dni przed terminem 12 miesięcy) w „Do zrobienia” i w portalu; żądania przed skutecznością —
     odmowa (klauzula ust. 5), po skuteczności bez danych — przeszkoda (zamrożenie terminu).
  6. Otwarcie: zdarzenie `przejecie` na początku łańcucha SHA-256 (stan na dzień skuteczności, skróty
     dokumentów źródłowych, protokół), archiwum poprzednika tylko do odczytu poza łańcuchem, zatwierdzenie
     protokołu przejęcia podpisem kwalifikowanym notariusza (ścieżka walidacji z Fazy 2).
  7. Rozliczenie: rok prowadzenia od dnia skuteczności; bez opłaty za wpis przy imporcie. **Opłata za
     przejęcie i początek gwarancji ceny przy umowie warunkowej — „do ustalenia” (§ 9), bez wartości
     domyślnej** — do decyzji gwarancja ceny nie jest stosowana.
  8. Etap 8: spółka (potwierdzenie + stan rejestru), poprzednik (potwierdzenie odbioru — do druku),
     akcjonariusze (informacja z art. 14 RODO + formularz zgód — e-mail przy zgodzie, inaczej list);
     organy egzekucyjne i [2027] przypomnienie o KRS — zadania ręczne na pulpicie.
- Testy: `testy/przeniesienie-stany.test.js`, `testy/przeniesienie-http.test.js`.
- Skutek w kodzie: migracja 65, `server/przeniesienia.js`, `server/trasy/przeniesienia.js`,
  `server/trasy/{portal,spolki,sprawy,wnioski,pozostale}.js`, `server/rejestr.js`,
  `server/logika/{przeniesienie,typy-zdarzen,stan,dokumenty-wniosku,pakiet-wniosku,ustawienia}.js`,
  `publiczne/js/{przeniesienia,portal,pulpit,app}.js`.

### D-085 — Stałe stawki, obciążenia jako nowe wpisy, brak opłaty za przejęcie (Łukasz, STOP Fazy 4)

- Data: 2026-11-01 (SESJA-PSA-WYTYCZNE.md, odpowiedź Łukasza na STOP Fazy 4)
- Obszar: opłaty / przeniesienie / szablony
- Decyzja:
  1. **Obciążenia akcji ujawniane jako nowe wpisy** (np. ograniczenie rozporządzania po zmianie umowy
     spółki) — **płatne** jak wpis zmiany w akcjonariacie (`ograniczenie` → `odplatne: true`).
     Pozostałe zmiany bezpłatne bez zmian (D-083).
  2. **Brak opłaty za przejęcie rejestru** od innego podmiotu (W7.9) — rozstrzyga „do ustalenia” z D-084 pkt 7.
  3. **Stałe stawki aż do zmiany przez notariusza** — rozliczenie zawsze wg stawek bieżących
     (`stawkaGrosze` = stawka bieżąca). „Gwarancja ceny” to wyłącznie przekaz marketingowy (stawki
     i tak są maksymalne wg rozporządzenia, które zmienia się rzadko) — parametr `gwarancja_ceny_lat`
     usunięty z ustawień; wersje stawek (`psa_stawki_wersje`) zostają jako ślad zmian, nie podstawa
     rozliczeń. Zastępuje D-082 w części „gwarancja ceny” i D-084 pkt 7 w części „początek gwarancji”.
  4. **Szablony pism (PROJEKT — do akceptacji Łukasza)** — Łukasz akceptuje i poprawia je na końcu prac;
     do tego czasu zostają oznaczone jako PROJEKT.
- Skutek w kodzie: `server/logika/{ustawienia,typy-zdarzen}.js`, `server/przeniesienia.js`,
  `server/trasy/spolki.js`, `publiczne/js/przeniesienia.js`; testy `faza3-http`, `przeniesienie-http`.

### D-086 — Podpisy: tylko podstawowy test pliku, resztę sprawdza pracownik (Łukasz, po raporcie Fazy 5)

- Data: 2026-11-01
- Obszar: podpisy / portal / tryb testowy
- Decyzja:
  1. Po wgraniu system sprawdza **tylko**: czy plik ma podpis elektroniczny (PAdES, XAdES, CAdES — skan,
     zdjęcie, niepodpisany PDF → odrzucenie) oraz **porównanie z oryginałem** (pierwsza wersja = dokument
     wystawiony przez kancelarię; na pewno inny → odrzucenie; nie da się porównać → bez blokady).
  2. **Bez usługi DSS** i bez automatycznego sprawdzania osoby podpisującej (PESEL) — ważność podpisu,
     osobę i formę sprawdza **pracownik** („Do zrobienia → podpisy”), wskazując formę przy potwierdzeniu.
  3. Atrapa trybu testowego: „plik podpisany” (domyślnie), „brak podpisu”, „plik różny od oryginału”,
     „sprawdź plik jak na produkcji”.
  Zastępuje D-075 w części walidacji (W3.3, W3.5, W3.7 — do pracownika).
- Skutek w kodzie: `server/logika/walidacja-podpisu.js` (uproszczony), `server/trasy/{portal,wnioski}.js`,
  `server/przeniesienia.js`, `server/konfiguracja.js` (bez `DSS_URL`), `server/tryb-testowy/index.js`,
  `publiczne/js/{wniosek,wnioski,pulpit}.js`, `testy/podpisy.test.js`, `.env.przyklad`. Bez migracji
  (stara wartość atrapy w bazie testowej → „plik podpisany”).

### D-087 — Sposoby podpisu równorzędne, jak w KSH od 18.02.2027 (Łukasz, po raporcie Fazy 5)

- Data: 2026-11-01
- Obszar: podpisy / portal
- Decyzja:
  1. Przy **każdym** dokumencie przyjmujemy równorzędnie pięć sposobów z art. 300(34) § 3 zd. 2 KSH
     (Dz.U. 2026 poz. 176, `PRZEPISY-PSA.md`): podpis notarialnie poświadczony, podpis złożony w obecności
     osoby upoważnionej (w kancelarii), kwalifikowany podpis elektroniczny, podpis zaufany, podpis osobisty
     (`formy-podpisu.FORMY_USTAWOWE`). Zwykły oryginał pocztą — dodatkowo tam, gdzie wystarcza (tabela § 2;
     przy zgodzie na wpis nadal nie). Notariusz podpisuje umowę QES (bez zmian).
  2. **Ma być prosto.** Klient niczego nie kategoryzuje: domyślnie „Podpisz podpisem zaufanym (gov.pl)”
     (`PODPIS_PZ_URL`; wynik zwykle `.xml` — XAdES, przyjmowany i porównywany z oryginałem także, gdy
     w pliku jest kilka `ds:Object`), pod instrukcją krótka rozpiska pozostałych sposobów (kwalifikowany,
     np. mObywatel; osobisty; na papierze — pocztą, także z podpisem notarialnie poświadczonym, albo
     w kancelarii) i przycisk „Podpiszę na papierze” (adres kancelarii z ustawień). Instrukcja mObywatela
     z § 3 — zwinięta niżej.
  3. **Pracownik nie wskazuje formy** przy dokumentach wniosku — „Podpis prawidłowy” jednym kliknięciem;
     przy papierze tylko data otrzymania (domyślnie dziś). Forma podana wprost przez API nadal jest
     sprawdzana. Zgoda na wpis w sprawie (W2.2) — bez zmian (tam forma decyduje o ważności zgody).
- Skutek w kodzie: `server/logika/{formy-podpisu,walidacja-podpisu}.js`, `server/konfiguracja.js`,
  `server/trasy/portal.js`, `server/logika/pakiet-wniosku.js`, `publiczne/js/{wniosek,wnioski}.js`,
  `testy/{podpisy,wnioski-kancelaria-http}.test.js`, `.env.przyklad`.

### D-088 — Zgoda na wpis: pracownik potwierdza tylko „w dopuszczalnej formie” (Łukasz)

- Data: 2026-11-01
- Obszar: sprawy / zgoda na wpis (W2.2)
- Decyzja: zamiast wyboru konkretnej formy z listy — pole „Zgoda jest w dopuszczalnej formie” (podpis
  zaufany, kwalifikowany, osobisty, notarialnie poświadczony albo złożony w kancelarii) i data zgody.
  Bez zaznaczenia zgody nie odnotowuje się — przed wpisem idzie powiadomienie (art. 300(34) § 3 KSH),
  blokada wpisu bez zmian. API przyjmuje `dopuszczalna: true` (zapis `zgoda_forma = 'ustawowa'`);
  kod konkretnej formy nadal przyjmowany i sprawdzany. Upraszcza D-076 w części formularza.
- Skutek w kodzie: `server/trasy/sprawy.js`, `publiczne/js/sprawy.js`, `testy/sprawy-http.test.js`. Bez migracji.

### D-093 — Runda 4, faza 1: Start portalu, układ sprawy, pola dat, druk informacji (SESJA-PSA-POPRAWKI-R4)

- Data: 2026-11-01
- Obszar: portal / kancelaria / informacja z rejestru
- Decyzja:
  1. **Start portalu (P2):** baner bieżącego kroku wniosku (jeden przycisk) i karta **„Do zapłaty”** — tylko
     nieopłacone opłaty, kwota brutto, przycisk „Zapłać”. Terminy zgłoszeń nie są już na Start (zakładka
     „Zgłoszenia”). Brak pozycji → karta się nie pokazuje (**potwierdzone przez Łukasza 3.11.2026**).
  2. **Rejestr w portalu (P1, P3, P4):** „Dane spółki” na wspólnym `ListaDanych`; tekst: „Stan akcjonariatu
     (akcjonariusze, akcje, obciążenia) jest dostępny w pełnej informacji z rejestru akcjonariuszy.”;
     „Zgłoś błąd we wpisie” — przycisk drugorzędny obok „Zamów informację z rejestru”.
  3. **Pola dat (P5):** `PoleDaty` obejmuje tylko datę, kalendarz obok — jeden wzorzec dla wszystkich pól dat.
  4. **Sprawa (K1):** jedna kolumna (`KolumnaSprawy`) i jeden pasek akcji (`PasekAkcji`); „Popraw podstawę
     wpisu” i „Wystaw żądanie wpisu” w pasku; nazwy plików bez UUID (`nazwaPlikuDoWyswietlenia`).
     Szerokość kolumny 48rem; na telefonie pełna szerokość minus 16 px (**potwierdzone 3.11.2026**).
  5. **Informacja z rejestru (K4):** emisje jako blok na serię (więcej niż 5 kolumn), numery łamane po
     przecinkach i myślnikach, czcionka 1 pt mniejsza od tekstu — mieści się w marginesach A4.
  6. **Telefon (WCAG 2.5.5):** przyciski, pola i zakładki ≥ 44 px wysokości.
- Narzędzie: `npm run zrzuty` (Playwright, tryb testowy, osobna baza `dane-testowe/zrzuty/`), `sprawdzUklad`.
- Testy: `testy/{portal-start,nazwy-plikow,informacja-emisje-uklad,zrzuty-start}.test.js`,
  `testy/e2e/{uklad,uklad-ekrany}.spec.js`.

### D-092 — Oświadczenia osób (zgoda e-mail, powiadomienia) to dane kartoteki, nie rejestru (Łukasz, 1.11.2026; R4 K5)

- Data: 2026-11-02 (SESJA-PSA-POPRAWKI-R4, zadanie 7)
- Obszar: kartoteka / portal / informacja z rejestru / sprawy
- Decyzja Łukasza: złożenie i cofnięcie zgody na komunikację e-mail oraz żądania powiadomień automatycznych
  nie jest informacją w rejestrze ani w informacji z rejestru — to dane kartoteki osoby. Przy każdej
  czynności z udziałem osoby bez zgody system to sygnalizuje.
- Przepis (`PRZEPISY-PSA.md`, art. 300(33) § 1 pkt 5 KSH): rejestr zawiera adres poczty elektronicznej,
  **jeżeli akcjonariusz wyraził zgodę** na komunikację e-mail → w informacji z rejestru pokazujemy sam
  adres (gdy zgoda aktywna), bez żadnej pozycji o zgodzie lub jej cofnięciu; cofnięcie = adres znika,
  bez opłaty (D-083).
- Skutek:
  1. Jedno źródło stanu `stanOswiadczen` (`server/oswiadczenia.js`); oświadczenie z portalu działa **od
     razu** — bez sprawy wpisu, zdarzenia w łańcuchu i opłaty (zastępuje D-083 pkt QW1 w części „cofnięcie
     przez żądanie wpisu”). Zmiana zgody w kartotece przez kancelarię też trafia do historii.
  2. Historia (data, źródło: portal / kancelaria / pismo, kto) — `psa_oswiadczenia` (append-only, poza
     łańcuchem; migracja 66).
  3. Kreator „zmiana danych akcjonariusza” nie przyjmuje już pola zgody. Historyczne zdarzenia dotyczące
     wyłącznie zgody zostają w łańcuchu, ale nie są pokazywane w widoku rejestru (filtr); w zdarzeniach
     mieszanych pole zgody jest pomijane w opisie. Eksport ZIP zostawia łańcuch w całości (weryfikacja
     skrótów). W tym środowisku nie ma bazy innej niż testowa — liczby takich zdarzeń w bazie kancelarii
     nie sprawdzono.
  4. Znacznik „Brak zgody — konieczne powiadomienie listem” (`ZnacznikKontaktu`, liczy się stan bieżący:
     zgoda potwierdzona i adres) — przy wyborze zbywcy, nabywcy i żądającego w kreatorach, przy żądającym
     w nagłówku sprawy, na liście akcjonariuszy spółki, w kolejce listów (kartoteka — zadanie 12).
  5. Po przeglądzie kodu: zgoda w portalu tylko na **adres z kartoteki** (zmiana adresu = żądanie zmiany
     danych); jedna reguła „zgoda aktywna” (status „potwierdzona” i adres) w informacji, stanie i znaczniku
     — migracja 68 podnosi dawną flagę `zgoda_email` ustawioną przez kancelarię do statusu „potwierdzona”;
     stan zgody innych osób nie trafia do akcjonariusza (tylko spółka i organ).
  6. Sprawy o zgodę złożone dawnym trybem (żądanie wpisu „zmiana danych akcjonariusza” z portalu) —
     **obsługa automatyczna** (Łukasz, 3.11.2026 — nie ręcznie): migracja 69 stosuje oświadczenie w kartotece
     (jeśli to najnowsze oświadczenie osoby) i anuluje otwartą sprawę z notatką „D-092 — bez wpisu”.
- Testy: `testy/oswiadczenia-k5.test.js`, `testy/faza3-http.test.js` (W4.1/W4.2), e2e K5.

### D-094 — Runda 4, faza 2: oświadczenia w portalu, bez nowej spółki z konta, usuwanie listów, kartoteka (SESJA-PSA-POPRAWKI-R4)

- Data: 2026-11-02
- Obszar: portal / listy / kartoteka
- Decyzja:
  1. **P7:** „Moje oświadczenia” — dwa checkboxy na jednym stanie osoby (`stanOswiadczen`, D-092); oświadczenie
     można cofnąć i złożyć ponownie, dopóki konto jest aktywne; adres e-mail podpowiadany z kartoteki.
     Powiadomienia automatyczne liczone na osobę (jedno aktywne oświadczenie na rodzaj), nie na spółkę
     (**potwierdzone 3.11.2026**).
  2. **P8:** odznaczenie zgody na e-mail otwiera okno „Cofnąć zgodę na e-mail?” z ostrzeżeniem (list zamiast
     e-maila, wygaśnięcie dostępu do portalu); „Zostaw zgodę” domyślne (fokus, Esc), „Cofam zgodę” wysyła.
  3. **P6 (wycofuje „Dodaj spółkę” z B8):** konto spółki nie zakłada kolejnego wniosku — `POST
     /portal/wniosek/nowy` → 403 „Każdą spółkę zgłasza się osobno. Aby dodać kolejną spółkę, wypełnij
     zgłoszenie na stronie rejestru.”; wniosek w toku założony wcześniej konto dokańcza.
  4. **K3:** „Usuń z wysyłki” przy nienadanym liście — powód (min. 5 znaków), kto, kiedy; pismo zostaje,
     wpis w notatce sprawy; po nadaniu 409; usunięte powiadomienie przed wpisem → wpis zablokowany
     (art. 300(34) § 3 KSH). Migracja 67.
  5. **K2:** kartoteka osoby w jednym widoku: Identyfikacja → Adresy → Kontakt i oświadczenia (stan, znacznik,
     historia) → AML → Akcje w spółkach (z seriami) → Sprawy (5 ostatnich + „Pokaż wszystkie”).
- Testy: `testy/{oswiadczenia-k5,p6-nowa-spolka}.test.js`, `testy/faza3-http.test.js` (K3),
  `testy/wnioski-kancelaria-http.test.js` (B8 → P6), e2e P7, P8, K2, K5.

### D-089 — Pokrycie akcji: nie blokuje otwarcia, wpis pokrycia bezpłatny (Łukasz, 3.11.2026)

- Obszar: rejestr / kreator / opłaty
- Podstawa (`PRZEPISY-PSA.md`): wzmianka o pokryciu w rejestrze (art. 300(33) § 1 pkt 9 KSH); wkłady wnosi się
  w 3 lata od wpisu spółki (art. 300(9) § 1); zarząd stwierdza wniesienie wkładu uchwałą (art. 300(9) § 2); od
  18.02.2027 zarząd zgłasza zmianę w 7 dni (art. 300(33) § 3); zbycie akcji nie w pełni pokrytej wymaga zgody
  spółki, nabywca odpowiada solidarnie za resztę wkładu (art. 300(40) § 1 i § 3).
- Decyzja: pokrycie nie blokuje otwarcia rejestru; stan domyślny „brak informacji o pełnym pokryciu”; wpis
  „akcje pokryte w całości” na podstawie uchwały zarządu — bezpłatny (D-083), zwykłym kreatorem wpisu; przy
  zbyciu akcji bez pełnego pokrycia kreator pokazuje pole „zgoda spółki” i informację o solidarnej
  odpowiedzialności nabywcy.

### D-090 — Zgoda na wpis: domyślnie powiadomienie (Łukasz, 3.11.2026)

- Obszar: sprawy / kreator
- Podstawa: art. 300(34) § 3 KSH — przed wpisem powiadomienie, chyba że osoba wyraziła zgodę.
- Decyzja: ścieżką domyślną jest powiadomienie (e-mail przy zgodzie na e-mail, inaczej list); zgoda na wpis —
  jedno opcjonalne pole (D-088), które pozwala wpisać od razu. Okresu oczekiwania po powiadomieniu
  `PRZEPISY-PSA.md` nie przewiduje — nie wprowadzamy.

### D-091 — Nowy przebieg wpisu zbycia akcji (Łukasz, 3.11.2026)

- Obszar: sprawy / kreator (PLAN-POPRAWEK-4.md § 4)
- Decyzja: jeden ekran, trzy kroki: „Co się zbywa” → „Podstawa” → „Sprawdzenie i wpis”; zbywca z akcjonariuszy
  spółki; numery akcji dobierane automatycznie (ręcznie za przyciskiem); pola „zgoda spółki” i „prawo
  pierwszeństwa wyczerpane” tylko gdy rejestr tego wymaga; z widoku znikają: rodzaj dokumentu jako osobne pole,
  osobny krok „weryfikuj”, „osoba działająca przy wpisie” (domyślnie notariusz z ustawień); „Wystaw żądanie
  wpisu” — akcja drugorzędna. Logika wpisu i walidacje art. 300(34) / 300(40) bez zmian.

### D-095–D-106 — Analiza przepływów: uproszczenia procesów (Łukasz, 4.11.2026)

- Obszar: przepływy kancelarii i portalu (SESJA-PSA-ANALIZA-PRZEPLYWOW, `docs/analiza/RAPORT-PRZEPLYWY.md` § 6 — uzasadnienie i skutki)
- Przyjęte wszystkie propozycje raportu:
  1. **D-095** Protokół przejęcia rejestru bez osobnego kroku: generowany automatycznie przy zamknięciu checklisty odbioru
     (Etap 6) i dołączany do zdarzenia PRZEJĘCIE; zatwierdzenie notariusza = „Otwórz rejestr”. Dokument wymagany — uchwała
     akcjonariuszy o wyborze podmiotu (art. 300(31) § 5), jedno pole.
  2. **D-096** Spółka zawsze dostępna jako żądający wpisu (dane z rejestru spółek), bez dopisywania do kartoteki.
  3. **D-097** Jeden kreator wpisu dla wszystkich typów — przebieg zbycia (3 kroki, `definicjaWpisu`), sprawa zakładana w tle.
  4. **D-098** Sprawa z portalu bez „Rozpocznij weryfikację” — weryfikacja zaczyna się przy otwarciu sprawy w kancelarii.
  5. **D-099** E-mail akcjonariusza we wniosku portalu opcjonalny; wymagany tylko przy zgodzie na komunikację e-mail.
  6. **D-100** W interfejsie „Zbycie akcji” (przycisk, nagłówek sprawy, lista spraw); w pismach bez zmian.
  7. **D-101** Reprezentant spółki jako osoba w kartotece (dane osobowe i AML raz).
  8. **D-102** Zmiana adresu akcjonariusza jedną drogą: w kartotece; gdy dotyczy danych z art. 300(33) § 1 pkt 5 — aplikacja
     proponuje wpis (sprawa z wypełnionymi danymi).
  9. **D-103** Sprostowanie jedną drogą: przycisk „Sprostuj” przy zdarzeniu w historii; typ poza kafelkami kreatora.
  10. **D-104** Adresat uprzedniego powiadomienia domyślny z typu wpisu (jak D-090 dla zbycia).
  11. **D-105** Numery akcji dobierane automatycznie we wszystkich typach (jak D-091), ręcznie za przyciskiem.
  12. **D-106** PESEL ze złą sumą kontrolną — ostrzeżenie bez blokady (cudzoziemcy, stare nadania), pokazane także przy zapisie.

### D-107–D-111 — Rozstrzygnięcia po etapie 4 analizy przepływów (Łukasz, 7.11.2026)

- Obszar: kartoteka, reprezentant spółki, podstawa wpisu, przeniesienie rejestru (`docs/analiza/RAPORT-PRZEPLYWY.md` § 9 „Do decyzji”)
- Decyzje:
  1. **D-107** Zmiana danych akcjonariusza (D-102) obejmuje łącznie wpisy we wszystkich spółkach, w których osoba ma akcje:
     jeden wpis „Zmiana danych akcjonariusza” zapisuje to samo zdarzenie (przed → po) w rejestrze każdej z tych spółek,
     w jednej transakcji, a dopiero potem zmienia kartotekę. Skutek w kodzie: `server/rejestr.js` (`_wykonajWpis`,
     `inneSpolkiAkcjonariusza`), podgląd zapowiada wpis łączny, okno propozycji w kartotece — jeden przycisk.
  2. **D-108** Imiona rodziców i dokument tożsamości reprezentanta spółki nie są zapisywane ani w danych spółki, ani w kartotece —
     potrzebne są tylko do umowy o prowadzenie rejestru: podaje się je we wniosku (umowa z wniosku) albo przy wystawieniu wzoru 01
     na żądanie. Skutek w kodzie: pola usunięte z formularza spółki i z `POLA_SPOLKI` (nie przechodzą z wniosku do spółki);
     wzór 01 bierze je z formularza wystawienia. Wartości zapisane w spółkach przed tą decyzją zostają w bazie nieużywane.
  3. **D-109** Katalog rodzajów dokumentu podstawy wpisu bez zmian (bez „umowy zastawu”, „oświadczenia”, „zawiadomienia organu”) —
     dla tych typów domyślnie „inny dokument”.
  4. **D-110** Pole „Okres wypowiedzenia (jeśli znany)” w zgłoszeniu przeniesienia rejestru zostaje (A-029).
  5. **D-111** Każda spółka trafia do rejestru przez nowo przyjęty wniosek — reprezentantów spółek już zapisanych nie przenosi się
     do kartoteki (bez migracji danych); D-101 działa od przyjęcia wniosku.
  6. Uzupełnienie D-108 (7.11.2026): kopie imion rodziców i dowodów reprezentantów zapisane w spółkach i w przyjętych wnioskach
     usunięte migracją 71; po przyjęciu wniosku usuwane od razu (dane są w podpisanej umowie o prowadzenie rejestru).

### D-112–D-124 — Odpowiedzi na pytania P-001–P-017 i ustalenia po etapie 4 (Łukasz, 7.11.2026)

- Obszar: AML, portal, rejestr, opłaty, dziennik dostępu (`testy-audyt/PYTANIA-DO-LUKASZA.md`)
- Decyzje:
  1. **D-112 (P-002)** Akcje nieme — skutek zależy od umowy spółki; system ich nie rozróżnia (opcja „niema” usunięta z wyboru
     rodzaju akcji), pracownik opisuje to w „Opis” emisji. Liczba głosów bez zmian.
  2. **D-113 (P-005)** Uchwała o wyborze późniejsza niż umowa oraz zmiana daty zawartej umowy — ostrzeżenie, nie blokada
     (`POST/PUT /api/psa/spolki` zwraca `ostrzezenia`; w otwarciu rejestru — ostrzeżenie przy polu).
  3. **D-114 (P-006)** Emisja założycielska następuje z chwilą rejestracji spółki — jej data wpisu do KRS to data rejestracji;
     kolejne emisje — z datą zmiany, nie wcześniejszą niż rejestracja. Odstępstwo — ostrzeżenie (`walidacje.js`).
  4. **D-115 (P-016)** Za akcjonariusza-osobę prawną działa „Reprezentant” zgodnie z jej umową — pola osoby fizycznej (imię,
     nazwisko, PESEL, funkcja) we wniosku i w kartotece; wpisuje klient, kancelaria potwierdza przy weryfikacji (migracja 71).
  5. **D-116 (P-017)** Beneficjentów rzeczywistych może być kilku — domyślnie jedno pole, „Dodaj beneficjenta” dokłada kolejne
     (`beneficjenci_json`; pierwszy zostaje w `beneficjent_rzeczywisty_id`).
  6. **D-117 (P-013, P-014)** Status AML „nie wykonano”, przeterminowany przegląd AML i brak beneficjenta nie blokują wpisu
     (ostrzeżenia). Blokuje tylko „niemożliwe do zastosowania” (D-010).
  7. **D-118 (P-001)** Przy wpisie na rzecz osoby prawnej beneficjent rzeczywisty jest wymagany — wskazuje go sama spółka
     (oświadczenie); jego brak to ostrzeżenie przy wpisie.
  8. **D-119 (P-003, P-004)** Zaproszenie po zgłoszeniu idzie automatycznie (bez zmian). Dostęp do portalu domyślnie ma tylko
     wnioskodawca; innego akcjonariusza zaprasza się na jego zgłoszenie — „Zaproś nowego akcjonariusza” w kokpicie spółki
     generuje link do przekazania e-mailem (bez automatycznej wysyłki). Zaproszenie z kartoteki osoby usunięte — jedna ścieżka.
  9. **D-120 (P-007)** Otwarcie rejestru nie jest odrębną opłatą: wszystkie wpisy założycielskie (emisja, akcjonariusze) to jeden
     wpis — przy założeniu 1200 zł netto za pierwszy rok prowadzenia i 100 zł netto za pierwszy wpis. Zgodne z kodem
     (`oplaty.naliczOtwarcieRejestru`); przejęcie rejestru — bez opłaty za przejęcie (D-085).
  10. **D-121 (P-008)** Kalendarzowe „naliczenie roczne” usunięte (stan kodu potwierdzony testem Z-100/P-008).
  11. **D-122 (P-009)** Dziennik dostępu (zakres jak D-041): retencja 5 lat od wpisu (jak dokumentacja środków AML, art. 49
      ustawy AML; rozliczalność RODO). Harmonogram dobowy usuwa starsze wpisy; młodszych nadal nie da się usunąć (wyzwalacz).
  12. **D-123 (P-010, P-012)** Dokumenty RODO i PEP dla akcjonariuszy dochodzących po założeniu spółki przygotowuje pracownik
      (bez automatu). Zdalna identyfikacja (dane i skan przekazane przez klienta) spełnia wymogi AML.
  13. **D-124** „Dodaj spółkę” w kancelarii zostaje jako ścieżka zapasowa (D-111 — zasadą jest przyjęty wniosek).
- Propozycja do decyzji (Łukasz, „może warto”): AML stosować dopiero, gdy suma wartości akcji w spółce przekracza
  równowartość 15 000 EUR — dziś procedurę AML włącza się ręcznie przełącznikiem przy spółce (etap 3.1). Wymaga ustalenia,
  z czego liczyć wartość (kapitał akcyjny, cena emisyjna, cena z umowy zbycia).

### D-125–D-154 — Uproszczenie modułu: decyzje U-01…U-30 (Łukasz, 7.11.2026)

- Obszar: cały moduł. Źródło i pełna treść: `CLAUDE-PSA-UPROSZCZENIE.md` § 2 (tam, gdzie `CLAUDE-PSA.md` albo `SESJA-*.md` mówią co innego, obowiązuje ta specyfikacja). Poniżej streszczenie; „zastępuje” — ostatnia kolumna § 2.
- Decyzje:
  1. **D-125 (U-01)** Jeden nowy schemat bazowy zamiast 71 migracji, bez zgodności wstecz (w bazie nie ma prawdziwych wpisów); do końca Fazy 6 schemat wolno edytować. Zastępuje migracje 1–71.
  2. **D-126 (U-02)** Automatycznie naliczają się tylko opłata za prowadzenie rejestru i informacja zamawiana w portalu; przy operacji odpłatnej pracownik wybiera „Opłata 100 zł netto” albo „Bez opłaty” (bez wartości domyślnej, najwyżej jedna opłata na sprawę); informacja wydawana przez pracownika — 50 zł albo bez (organ — bez). Zastępuje podstan `oczekuje_na_oplate` i automatyczną opłatę za wpis.
  3. **D-127 (U-03)** Dokumenty do podpisu przy zawarciu umowy, każdy osobno: umowa o prowadzenie rejestru (spółka, potem notariusz — QES; PEP reprezentanta w treści, RODO jako załącznik), uchwała akcjonariuszy o wyborze podmiotu (pomijana przy własnej uchwale klienta albo wyborze w umowie spółki), zgoda na korespondencję e-mail dla każdego akcjonariusza bez konta; plus umowa spółki wgrywana bez podpisu. Zastępuje komplet dokumentów wniosku.
  4. **D-128 (U-04)** Wzory pism w Markdown (`wzory/*.md`), wynik zawsze PDF (pdfkit), wygląd zdefiniowany raz; `npm run wzory` — podgląd każdego wzoru; treść wzorów Word przeniesiona 1:1. Zastępuje `docx.js`, `zip.js`, `wzory-dysk.js`, `dokumenty-tresc.js`, `bloki-dokumentu.js`, `psa_szablony`.
  5. **D-129 (U-05)** Stawki jako stałe w `przepisy.js`, bez edycji i wersji w aplikacji. Zastępuje D-085, `psa_stawki_wersje`.
  6. **D-130 (U-06)** AML bez blokady systemowej: stała pozycja checklisty odhaczana przez pracownika; praktyka kancelarii bez zmian; dokumenty AML to zwykłe pliki osoby, data weryfikacji w kartotece. Zastępuje D-010, D-117, `aml_status`, `psa_osoby_skany_aml`, `stosuje_procedure_aml`.
  7. **D-131 (U-07)** Przejęcie rejestru: zaznaczenie „przejęcie” we wniosku + dotychczasowy podmiot i data przejęcia; umowa bez warunku; „Otwórz rejestr” od dnia przejęcia (wpis `otwarcie` ze stanem z dokumentów poprzednika); bez osobnego procesu, statusów, protokołu, okresu wypowiedzenia i opłaty za przejęcie. Zastępuje D-084, `psa_przeniesienia*`, umowę pod warunkiem.
  8. **D-132 (U-08)** Zgłoszenie i wniosek to jedna encja (formularz publiczny od razu zakłada wniosek); pozycja menu „Zgłoszenia” znika.
  9. **D-133 (U-09)** Pisma powstają automatycznie, wysyła je pracownik jednym kliknięciem po podglądzie; ekran „Korespondencja” to jedno miejsce dla wszystkiego, co wychodzi z rejestru; niewysłane i błędy — w „Do zrobienia”. Zastępuje kolejkę „Zawiadomienia” i ekran listów do wysyłki.
  10. **D-134 (U-10)** Pisma e-mailem z PDF w załączniku do adresatów ze zgodą na korespondencję e-mail (spółka — z umowy); bez zgody — list; treść e-maila krótka, bez danych osobowych; pismo widać też w portalu.
  11. **D-135 (U-11)** Zgoda na korespondencję e-mail i żądanie powiadomień to jedna zgoda (przełącznik w karcie osoby); włączenie przez pracownika wymaga pliku podpisanej zgody, wyłączenie — daty; historia w `psa_historia_danych`. Zastępuje zgodę w 3 miejscach, `psa_oswiadczenia`.
  12. **D-136 (U-12)** Aplikacja nie liczy głosów (to nie jest dana rejestru). Zastępuje głosy w `kontekst-pisma.js`.
  13. **D-137 (U-13)** Usunięte: zgłoszenie nieprawidłowości, dokumenty na żądanie (uchwała przechodzi do dokumentów wniosku), podgląd systemu, edycja szablonów, współwłasność w kartotece, ręczne wystawianie pism.
  14. **D-138 (U-14)** Zamiast statusu spółki — stan rejestru: otwarty / zamknięty (z powodem); opłata za prowadzenie przysługuje, dopóki rejestr jest otwarty. Zastępuje `w_likwidacji`, `zawieszona`, odstępstwo 22.
  15. **D-139 (U-15)** Tekst zamiast słowników: podstawa wpisu, przyczyna odmowy; żądający: spółka, osoba z kartoteki, organ (tylko przy zajęciu) albo brak. Zastępuje kody odmowy ×7, role ×8, rodzaje dokumentu ×7.
  16. **D-140 (U-16)** Usunięte pola bez skutku: `charakter_wpisu`, `dni_wstrzymania`, źródło sprawy, REGON, telefon, „ostatnia zmiana” w kartotece. Zastępuje D-027.
  17. **D-141 (U-17)** Rodzaj akcji wyliczany (uprzywilejowana, gdy ma adnotację „uprawnienie”); pokrycie przy emisji — obowiązkowe pytanie tak/nie, „nie” = adnotacja „niepokryte”. Zastępuje D-112, D-114, pokrycie ×4.
  18. **D-142 (U-18)** Nieprawidłowy PESEL (suma kontrolna albo data) blokuje zapis. Zastępuje ostrzeżenie bez blokady.
  19. **D-143 (U-19)** Wniosek odrzucony albo porzucony (90 dni bez zmian): dane klienta usuwane automatycznie; zostają KRS, daty i stan. Zastępuje bezterminowe przechowywanie.
  20. **D-144 (U-20)** Kontrola integralności łańcucha — na żądanie, przycisk w Ustawieniach, bez harmonogramu.
  21. **D-145 (U-21)** Emisja tylko z datą wpisu do KRS i od razu z obejmującymi — jeden wpis; warunkowa emisja (art. 300¹¹⁷–300¹¹⁸) nadal poza zakresem. Zastępuje odstępstwa 3–4 w README.
  22. **D-146 (U-22)** „Stan na” — tylko dzień. Zastępuje dokładność do minuty (sprint 6, poz. 2.3).
  23. **D-147 (U-23)** Jedno konto na osobę (logowanie e-mailem), zakres z danych przez `zakresKonta(konto)`: osoba działająca za spółkę widzi wszystko o spółce, akcjonariusz — swoje sprawy, pisma i opłaty oraz informację bez danych z art. 300³⁵ § 1¹ KSH; zakres akcjonariusza wymaga zgody na e-mail i wygasa po zbyciu wszystkich akcji (D-039). Zastępuje role `akcjonariusz`, `wnioskodawca`, `spolka` i konto spółki.
  24. **D-148 (U-24)** Informacja zamawiana w portalu — stan na koniec wybranego dnia: domyślnie i najpóźniej wczorajszego, najwcześniej dnia otwarcia; pierwszą można zamówić dzień po otwarciu. Dotyczy wyłącznie portalu — pracownik wydaje informację w każdej chwili, według stanu na dowolny dzień.
  25. **D-149 (U-25)** Zmiana danych osoby albo spółki nie jest wpisem: edycja w miejscu + wiersze historii w `psa_historia_danych` (append-only); bez sprawy, terminu, opłaty, powiadomień i zdarzeń w łańcuchu. Zastępuje typy `zmiana_danych_akcjonariusza`, `zmiana_danych_spolki`.
  26. **D-150 (U-26)** Numery akcji zawsze wpisuje pracownik (seria, numery, liczba) w każdej operacji; bez doboru automatycznego i skrótów; liczba niezgodna z numerami — błąd przy polu. Zastępuje dobór automatyczny (`logika/kreator.js`, `wpis-zbycia-logika.js`).
  27. **D-151 (U-27)** Informacja z rejestru zawiera tylko dane z art. 300³³ § 1 KSH, PESEL albo datę urodzenia (D-076), numer informacji i „stan na” (układ — spec § 4); bez wynagrodzenia, podstawy prawnej, odbiorcy, ceny emisyjnej (znika z modelu i formularzy), NIP, REGON, udziału procentowego i dat umowy i otwarcia rejestru.
  28. **D-152 (U-28)** List: „Nadano” jednym kliknięciem zapisuje dzisiejszą datę — bez numeru nadania i skanu potwierdzenia.
  29. **D-153 (U-29)** Nazwy pism jak w art. 300³⁴ § 9 KSH: powiadomienie o zamierzonym wpisie / o wpisie / o odmowie; „zawiadomienie” tylko wobec sądu (art. 300³² § 3); przychodzące to „pliki”, wychodzące — „pisma”.
  30. **D-154 (U-30)** Opłata za prowadzenie rejestru do wyboru we wniosku: raz w roku (1 200 zł netto, domyślnie) albo co miesiąc (100 zł netto); wybór wchodzi do umowy, zmienia go tylko kancelaria; po zamknięciu rejestru nowe opłaty nie powstają. Zastępuje tylko opłatę roczną.

### D-155–D-166 — Faza 1 uproszczenia: rozstrzygnięcia wykonawcze (7.11.2026; raport `raporty/FAZA-1.md`)

- Obszar: rdzeń rejestru (schemat, wpisy, sprawy). Decyzje podjęte przy wykonaniu specyfikacji — do akceptacji Łukasza razem z raportem.
- Decyzje:
  1. **D-155** Nazwa migracji bazowej niesie skrót treści SQL: każda zmiana schematu do końca Fazy 6 zakłada bazę od nowa (pod zabezpieczeniem U-01). Po Fazie 6 schemat zamrożony, zmiany jako kolejne migracje.
  2. **D-156** `psa_osoby_dzialajace` służyła do zapisu osoby działającej przy wpisie (notariusz albo zastępca notarialny — imię, nazwisko, funkcja w treści każdego wpisu, domyślna dla pracownika, słownik w trasach `auth`). Zastąpiona polem tekstowym `dziala_przez` w sprawie (poza treścią wpisu — R10); słownik, kolumna `psa_uzytkownicy.osoba_dzialajaca_id` i trasy usunięte.
  3. **D-157** R2 a art. 300³⁴ § 3 KSH (🟢, § 0 pkt 6): przyznanie uprawnionemu z obciążenia prawa głosu zmienia uprawnienia akcjonariusza — akcjonariusz jest na liście osób do powiadomienia.
  4. **D-158** R5: pozycje checklisty z atrybutów tylko przy operacjach, których dotyczą — ograniczenie: zbycie i ustanowienie obciążenia; niepokryte i zajęcie: zbycie (art. 300⁴⁰ § 1 dotyczy zbycia); prawo głosu: wpis, który je przyznaje.
  5. **D-159** Sprostowanie: przy kilku sprostowaniach jednego wpisu obowiązuje ostatnie; zastępuje treść wyłącznie tym samym typem; otwarcia się nie wycofuje (tylko zastępuje treść); w zamkniętym rejestrze wolno sprostować tylko zamknięcie.
  6. **D-160** Obciążenie i adnotacja to atrybut identyfikowany wpisem, który go ustanowił, i pozycją w tym wpisie; zmiana i wykreślenie wskazują atrybut i numery akcji (U-26); umorzenie akcji kończy atrybuty na tych numerach.
  7. **D-161** Data otwarcia rejestru = dzień wpisu `otwarcie`; nazwa dotychczasowego podmiotu nie trafia do treści wpisu (R10) — zostaje we wniosku.
  8. **D-162** Opłata za wpis (U-02) obciąża żądającego: osobę z kartoteki albo spółkę; sprawa bez operacji odpłatnej nie przyjmuje wyboru „opłata”.
  9. **D-163** Odmowa wpisu usuwa niewysłane powiadomienia o zamierzonym wpisie i wezwania (przestały być potrzebne); odnotowane zgody na wpis po „Zmień treść” zostają.
  10. **D-164** `terminy.js` — liczenie terminu bez zmian; funkcje `wstrzymaj`/`wznow` usunięte (stan zmienia wyłącznie `sprawy.zmienStan`), `dni_wstrzymania` usunięte (U-16).
  11. **D-165** D-R01: wpis z chwilą wcześniejszą niż ostatni wpis spółki jest wstrzymany (kontrola zegara w symulacji sprawy).
  12. **D-166** Do czasu przebudowy odłączone (trasy niemontowane, testy pominięte z numerem fazy): eksport ZIP i przypomnienia (Faza 2), import KRS i wnioski (Faza 4), portal i tpay (Faza 5).

### D-167 — Odpowiedzi do raportu Fazy 1 (Łukasz, 7.11.2026)

- Decyzje:
  1. Uzupełnienie D-156: nie zapisuje się, czy wpisu dokonał notariusz, czy zastępca — pole `dziala_przez` w sprawie usunięte (bez zastępstwa).
  2. D-157 potwierdzona.
  3. `zip.js` na razie zostaje (eksport ZIP rejestru, § 3.6) — odstępstwo od listy usunięć U-04.
  4. D-163 (zgoda na wpis po „Zmień treść”) — pytanie otwarte.

### D-168 — Zgoda na wpis jest ogólna (Łukasz, 7.11.2026)

- Obszar: sprawy / zgoda na wpis (art. 300³⁴ § 3 KSH; rozstrzyga pytanie z D-167 pkt 4)
- Decyzja: zgoda na wpis wyraża zgodę na wpis zgodnie z dokumentem podstawy (np. umową spółki albo umową sprzedaży), bez szczegółów
  wpisu — zostaje ważna po „Zmień treść” (w przeciwieństwie do wysłanych powiadomień, które tracą ważność — R2). Odnotowanie zgody: osoba,
  „dopuszczalna forma”, data, opcjonalnie plik (D-088). Potwierdza zachowanie z D-163; bez zmian w kodzie.

### D-169–D-180 — Faza 2 uproszczenia: rozstrzygnięcia wykonawcze (8.11.2026; raport `raporty/FAZA-2.md`)

- Obszar: pisma, Korespondencja, informacja z rejestru, opłaty, proces dzienny. Decyzje podjęte przy wykonaniu specyfikacji — do akceptacji Łukasza razem z raportem.
- Decyzje:
  1. **D-169** Wzory w Markdown: treść Word 1:1 poza elementami usuniętymi decyzjami — REGON spółki (U-16), głosy w uchwale (U-12), nazwy pism (U-29), charakter wpisu (U-16); w pismach kancelarii podstawa prawna jednym wierszem pod tytułem, pouczenia bez odesłań w nawiasach (§ 4); NIP spółki tylko w umowie; po firmie nie dopisuje się „prosta spółka akcyjna” (firma ją zawiera).
  2. **D-170** Umowa, uchwała i zgoda zachowują odesłania do przepisów (to akty stron). W umowie: „§ 15” → „§ 13” (adresy są w § 13); bez imion rodziców i dowodu reprezentanta (formularz z § 6 ich nie zbiera); dodane oświadczenie PEP (U-03), akapity o przejęciu (U-07) i płatności miesięcznej (U-30). Lista akcjonariuszy do KRS — jeden blok podpisów członków zarządu albo rady dyrektorów (imion nie przechowujemy). Zgoda e-mail: „pkt 4” → „pkt 5” i zdanie o przesyłaniu powiadomień (U-11).
  3. **D-171** Pismo dostaje przy czynności numer (PSA/RRRR/NNNN; informacja — INF/RRRR/NNNN) i migawkę treści; PDF powstaje przy pierwszym podglądzie, pobraniu albo wysyłce i od tej chwili jest ten sam (SHA-256 w `psa_pisma`).
  4. **D-172** Brak ulicy, kodu albo miejscowości kancelarii w Ustawieniach blokuje utworzenie pisma (a więc i wpis) komunikatem „Uzupełnij dane kancelarii w Ustawieniach”.
  5. **D-173** Informacja z rejestru ma nagłówek kancelarii (bez daty) — wspólny wygląd pism; w treści tylko części z § 4.
  6. **D-174** Wersja informacji dla akcjonariusza ukrywa u pozostałych PESEL, datę urodzenia, adres zamieszkania i e-mail; siedziba osoby prawnej i adres do doręczeń są widoczne (§ 3.5 poz. 23). Maskowanie białą listą na nowym modelu osoby.
  7. **D-175** W tabeli „Akcje” liczba = liczba akcji wyemitowanych w serii; numery umorzone — osobny wiersz pod tabelą, tylko gdy są.
  8. **D-176** Korespondencja: „Wyślij ponownie” tylko ze stanu „blad”; filtr „do wysłania” = e-maile i listy (bez kanału „portal” — Faza 5); podgląd PDF „inline”; niewysłane pismo usuwa się razem z plikiem PDF.
  9. **D-177** Opłaty: CSV dla Excela (średnik, przecinek dziesiętny, BOM).
  10. **D-178** Opłata za prowadzenie: okres „RRRR-MM-DD..RRRR-MM-DD”; proces dzienny nalicza od końca ostatniego okresu (nadrabia przerwy, zmiana rocznej na miesięczną nie dubluje); pierwsza opłata w dniu otwarcia; anulowany okres nie powstaje ponownie.
  11. **D-179** Przypomnienie o kolejnym roku: e-mail do spółki 30 dni przed rocznicą, raz (ślad w dzienniku), tylko przy płatności rocznej i adresie e-mail spółki.
  12. **D-180** Retencja U-19: wniosek odrzucony — od razu, roboczy albo złożony — po 90 dniach bez zmian; znikają dane klienta, checklista, notatka, dotychczasowy podmiot, pliki, niewysłane pisma i konto założone tylko dla wniosku; wysłane pisma zostają jako dowód.

### D-181–D-185 — Odpowiedzi do raportu Fazy 2 (Łukasz, 11.11.2026)

- Obszar: wygląd informacji z rejestru, umowa o prowadzenie rejestru, maskowanie.
- Decyzje:
  1. **D-181** Pisma są proste (wspólny wygląd „pismo” — bez zmian), ale **informacja z rejestru**, którą pobierają klient i pracownik, ma wygląd sprzed Fazy 2: znak „Notariat Rzeczypospolitej Polskiej” i dane kancelarii w nagłówku, zielona linia, tytuł krojem EB Garamond, treść krojem Inter, metryka (spółka z KRS · stan na · numer informacji) na zielonkawym tle, sekcje numerowane I., II., …, tabele bez siatki z etykietami kapitalikami, akcjonariusz — nazwa pogrubiona, dane szarym drobniejszym krojem pod nią; stopka: numer i „strona X z N”. Zastępuje D-173 i zdanie § 4 „jedna czcionka” (bez kroju o stałej szerokości — cyfry tabelaryczne Inter w kolumnach liczb). Treść bez zmian (U-27): firma i KRS stoją w metryce, więc sekcja „Spółka” podaje siedzibę, adres, sąd i datę rejestracji. Wygląd zdefiniowany raz, w `logika/wzory.js` (wariant „informacja”); kroje w `wzory/czcionki/` (OFL). Spółka do 10 akcjonariuszy i 3 serii nadal na jednej stronie (test).
  2. **D-182** E-mail pozostałych akcjonariuszy jest jawny w informacji dla akcjonariusza (art. 300³⁵ § 1¹ KSH go nie wymienia) — tylko przy zgodzie na korespondencję e-mail, bo wtedy jest daną rejestru. Zastępuje D-174 w części dotyczącej e-maila; PESEL, data urodzenia i adres zamieszkania nadal ukryte. Stanu zgody innych osób akcjonariusz nie dostaje.
  3. **D-183** Umowa § 6 i informacja RODO pkt 3a: rejestr prowadzi się w aplikacji, za pomocą której notariusz prowadzi rejestry w swojej kancelarii — w postaci elektronicznej, w sposób zapewniający bezpieczeństwo i integralność danych (art. 300³¹ § 3 i 4 KSH); odbiorcy danych — podmioty przetwarzające w imieniu kancelarii, w szczególności dostawcy usług informatycznych tej aplikacji. Bez odwołań do systemu Krajowej Rady Notarialnej.
  4. **D-184** Umowa § 11 ust. 3: zamiast „warunkiem … jest uiszczenie Taksy” — „Taksa jest należna za każdą z czynności, o których mowa w ust. 1.” Umowa nie uzależnia wpisu od opłaty (R4).
  5. **D-185** Akapity umowy o przejęciu rejestru (U-07) i płatności miesięcznej (U-30) oraz oświadczenie PEP reprezentanta (U-03) — akceptacja treści odłożona; do tego czasu zostają w brzmieniu z Fazy 2 (D-170). Pozycja w „Decyzjach otwartych”.

### D-186–D-192 — Faza 3 uproszczenia: ekrany kancelarii (11.11.2026; raport `raporty/FAZA-3.md`)

- Obszar: interfejs kancelarii (§ 5). Decyzje podjęte przy wykonaniu specyfikacji — do akceptacji Łukasza razem z raportem.
- Decyzje:
  1. **D-186** Pulpit: `GET /api/psa/pulpit` — sprawy w toku po terminie albo z terminem do 2 dni, sprawy wstrzymane z nowym plikiem, pisma z błędem wysyłki (na górze) i do wysłania; wiersz prowadzi do sprawy albo do Korespondencji z otwartym podglądem pisma. Wnioski, podpisy i przejęcia dochodzą w Fazie 4.
  2. **D-187** Pole daty: jedno pole tekstowe DD.MM.RRRR (szerokość z zapasem na pełny format), kropki wstawiają się same, wklejenie w dowolnym separatorze, ikona kalendarza w polu. Zastępuje pole segmentowe (DD | MM | RRRR) — wspólne z portalem.
  3. **D-188** Ekran sprawy: treść zapisuje się sama 0,6 s po zmianie, „Dalej” zapisuje przed przejściem; przycisk główny wyszarzony z krótkim powodem (pełna lista „Przed wpisem” pod treścią); „Wstrzymaj” (treść wezwania) i „Wznów” (data usunięcia przeszkody) — formularz w miejscu, „Odmów” — okno z przyczyną (czynność nieodwracalna), „Wycofaj” i „Dokonaj wpisu” — potwierdzenie; zaznaczenie checklisty widać od razu, zapis w tle. Po wpisie przycisk „Wyślij pisma” wysyła e-maile; listy — „Drukuj” i „Nadano” w wierszu; gdy wszystko wysłane, przycisku głównego nie ma.
  4. **D-189** Kokpit: „Zmień” (zastaw, użytkowanie — prawo głosu) i „Wykreśl” zakładają sprawę z operacją wypełnioną danymi wiersza (wykreślenie zajęcia — żądający organ); „Sprostuj” — sprawa bez żądającego z treścią wpisu do poprawienia albo wycofania; „Zamknij rejestr” — sprawa z wpisem zamknięcia (checklista i „Dokonaj wpisu”, nie jednym kliknięciem); „Informacja z rejestru” — formularz w kokpicie (odbiorca, dzień, opłata), wynik: PDF i pismo w Korespondencji.
  5. **D-190** Karta osoby: „Dokument zgody do podpisu” — `POST /api/psa/osoby/:id/dokument-zgody` (spółka do wyboru, gdy osoba ma akcje w kilku; wymaga adresu e-mail); pismo trafia do Korespondencji, kanał według R9. Włączenie zgody — wybór pliku z plików karty osoby.
  6. **D-191** Usunięte poza listą fazy: `kokpit.js`, `wydruk.js`, `uzytkownicy.js`, `wpis-zbycia.js` (zastąpione nowymi ekranami), niepodłączone ekrany `wnioski.js`, `zgloszenia.js`, `przeniesienia.js` (trasy odłączone od Fazy 1; Faza 4 buduje ekran wniosku od nowa) i nieużywane komponenty `ui-rejestr.js` (m.in. `WyborZKartoteki`, `PaletaPolecen`, `Kafel`, `StatusAml`). Do Faz 4–5: pozycja menu „Wnioski” i „Nowa spółka”, osoby zawierające umowy w Ustawieniach, „Działają za spółkę”, „Zaproś do portalu”.
  7. **D-192** e2e: scenariusze kancelarii przy 1440 i 390 px; `portal.spec.js` — `test.skip` „Faza 5”; `uklad-ekrany.spec.js` (regresje R4 usuniętych ekranów) usunięty; małpa — ekrany kancelarii, rozpoznaje okno wyboru pliku i pomija bieżącą pozycję menu. `test:seed`: poprawny NIP kancelarii (5840000016) — poprzedni nie przechodził walidacji Ustawień.
  8. **D-193** (Łukasz, 11.11.2026) Faza 3 zaakceptowana. „Sprostuj” zakłada sprawę bez żądającego (sprostowanie z inicjatywy kancelarii); pracownik może zmienić żądającego — zostaje.

### D-194–D-203 — Faza 4 uproszczenia: nowa spółka — wniosek → dokumenty → otwarcie (11.11.2026; raport `raporty/FAZA-4.md`)

- Obszar: formularz publiczny, wniosek (portal i kancelaria), dokumenty z U-03, przyjęcie, otwarcie rejestru. Decyzje podjęte przy wykonaniu specyfikacji — do akceptacji Łukasza razem z raportem.
- Decyzje:
  1. **D-194** Dane wniosku — jeden schemat (`logika/wniosek.js`) dla portalu i kancelarii: spółka (wstępnie z KRS), osoba podpisująca umowę za spółkę (z pytaniem o PEP), akcjonariusze (e-mail każdego obowiązkowy), płatność (U-30), uchwała. Konto wnioskodawcy należy do osoby podpisującej umowę; „to ja” przy akcjonariuszu = ta sama osoba, jej zgoda na e-mail zaznacza się w formularzu (bez dokumentu). Nowe kolumny `psa_wnioski`: `krs_json` (odpis przy założeniu — różnice podświetlone w kancelarii) i `umowe_zawarl` (U-01).
  2. **D-195** Formularz publiczny: zawsze ta sama odpowiedź (D-079); adres z kontem dostaje przypomnienie o logowaniu bez nowego wniosku; link aktywacyjny ważny 7 dni, w bazie tylko skrót tokenu; limit prób. Spółka już w rejestrze — wniosek powstaje, pracownik widzi ostrzeżenie i go odrzuca.
  3. **D-196** Dokumenty z U-03 powstają przy „Złóż” (roboczy → złożony): umowa, uchwała (gdy mają ją podpisać akcjonariusze), zgoda dla każdego akcjonariusza poza „to ja”; kanał „portal” (nie trafiają do Korespondencji). Wybór uchwały (do podpisu / własna / wybór w umowie spółki) można zmienić po złożeniu. Ponowne złożenie po zwrocie tworzy dokumenty od nowa, a dotychczasowe podpisy tracą ważność (odrzucone z powodem).
  4. **D-197** Test podpisu (D-086): plik klienta bez podpisu albo różny od pobranego dokumentu jest odrzucany od razu z komunikatem i się nie zapisuje; plik wgrany przez pracownika (np. skan oryginału z poczty) trafia do sprawdzenia. „Odrzuć plik” wymaga powodu, który widzi klient. Umowa spółki i własna uchwała — bez testu podpisu.
  5. **D-198** Podpis notariusza: pracownik wgrywa umowę z podpisem notariusza po potwierdzeniu podpisu spółki i wybiera osobę zawierającą umowę z nowego pola Ustawień „Osoby zawierające umowy” (domyślnie notariusz) — trafia do danych spółki (`umowe_zawarl`).
  6. **D-199** „Przyjmij” wymaga: umowy spółki, potwierdzonego podpisu spółki, umowy z podpisem notariusza, uchwały (podpisy potwierdzone, własna wgrana albo wybór w umowie spółki) i checklisty (reprezentacja według KRS, uchwała, zgody — z listą brakujących; przy przejęciu: rozwiązanie umowy i data, rejestr i dokumenty poprzednika). Spółka o istniejącym KRS — blokada. Przy powtórzonym PESEL albo numerze KRS osoby wybór „istniejąca / nowa” jest obowiązkowy. Zgody na e-mail — do historii (z plikiem albo z portalu); osoba podpisująca — osobą działającą za spółkę; konto — jej osobą (gdy ma już konto, konto z wniosku znika); pliki i pisma wniosku — do akt spółki.
  7. **D-200** „Otwórz rejestr” zakłada sprawę z wpisem `otwarcie` (R1) z akcjonariuszami z wniosku i serią A z datą wpisu spółki do KRS — numery wpisuje pracownik na ekranie sprawy (U-26), dalej checklista i „Dokonaj wpisu”. Zgodność stanu otwarcia z dokumentami poprzednika sprawdza pozycja checklisty sprawy „Dokumenty zbadane”. Przy przejęciu przycisk wyszarzony „Dostępne od DD.MM.RRRR”. Pierwsza opłata za prowadzenie powstaje przy wpisie otwarcia.
  8. **D-201** Odrzucenie wniosku: przyczyna obowiązkowa; powiadomienie o odmowie zawarcia umowy — listem, w Korespondencji (art. 108a PrNot). Zwrot do uzupełnienia: notatka widoczna w portalu, e-mail bez danych osobowych.
  9. **D-202** Uchwała: blok podpisów akcjonariuszy bez liczby akcji (U-12; wniosek nie zbiera liczby akcji).
  10. **D-203** Usunięte: podsystemy przeniesień i zgłoszeń, stary portal (nowy `trasy/portal.js` — zgłoszenie, aktywacja, logowanie, wniosek), `pakiet-wniosku`, `dokumenty-wniosku`, `zaproszenia`, `formy-podpisu` (sposoby podpisu — instrukcja w portalu, sprawdza pracownik), stare ekrany portalu i wniosku, `kraje`, `pesel`, `kontakt`, `nazwy-plikow`, nieużywane funkcje `formaty.js` i komponenty `ui-rejestr.js`; moduł KRS w `server/krs.js`. Testy pominięte „Faza 4” zastąpione nowymi. Konta testowe portalu dla zarządu Alfy i akcjonariuszy — Faza 5; atrapa KRS: Delta (0000990004) do scenariuszy od zera.

---

## Decyzje otwarte

> Nic poniżej nie jest rozstrzygnięte — nie zgaduj odpowiedzi. Gdy Łukasz odpowie (w
> `testy-audyt/PYTANIA-DO-LUKASZA.md` albo bezpośrednio), kolejna sesja dokumentacyjna przenosi
> odpowiedź tutaj jako nowy wpis `D-0xx` w sekcji „Decyzje”.

### Z raportu Fazy 2 uproszczenia (D-185)

- **Treść akapitów umowy** — przejęcie rejestru (§ 3 pkt 1, § 4 ust. 3), płatność miesięczna (§ 11 ust. 6)
  i oświadczenie PEP reprezentanta (§ 3 pkt 5): Łukasz zaakceptuje je później.

### Z `testy-audyt/PYTANIA-DO-LUKASZA.md` — P-001–P-017 (odpowiedzi 7.11.2026: D-112–D-123)

| ID | Skrót pytania | Obszar | Stan po sesji napraw (2026-09-19) |
|---|---|---|---|
| P-001 | Czy przy wpisie transakcyjnym na rzecz osoby prawnej wymagamy identyfikacji beneficjenta rzeczywistego? | AML | **rozstrzygnięte → D-118** |
| P-002 | Czy akcja `niema` ma być automatycznie pozbawiona głosu, czy zależy to od umowy spółki? | rejestr | **rozstrzygnięte → D-112** |
| P-003 | Czy automatyczne zaproszenie „od razu” po zgłoszeniu ma zostać, czy przywrócić ocenę kancelarii? | portal (patrz D-038) | **rozstrzygnięte → D-119** |
| P-004 | Jaki ma być docelowy sposób nadawania dostępu portalowego akcjonariuszom innym niż wnioskodawca? | portal | **rozstrzygnięte → D-119** |
| P-005 | Czy niezgodność dat uchwała/umowa i nadpisanie umowy bez śladu mają być blokadą czy ostrzeżeniem? | rejestr | **rozstrzygnięte → D-113** |
| P-006 | Jaka ma być reguła walidacji krzyżowej `data_wpisu_krs` emisji względem daty rejestracji spółki? | rejestr | **rozstrzygnięte → D-114** |
| P-007 | Czy stan otwarcia to wpisy na żądanie (każdy odpłatny), czy tylko opłata za prowadzenie? | opłaty | **rozstrzygnięte → D-120** |
| P-008 | Czy martwy w UI endpoint `/naliczenie-roczne` ma zostać usunięty, zabezpieczony, czy zostać bez zmian? | opłaty | **rozstrzygnięte → D-121** |
| P-009 | Czy dziennik dostępu ma objąć też zwykłe odczyty portalowe? | dziennik dostępu | **rozstrzygnięte → D-041** (tak, objęto); retencja → D-122 (5 lat) |
| P-010 | Jak naprawić rozjazd pól PEP przy przejęciu wniosku; czy dokumenty RODO/PEP mają powstawać też dla akcjonariuszy dochodzących po założeniu spółki? | AML / dane osobowe | **częściowo → D-041** (mapowanie PEP naprawione); RODO/PEP po założeniu — ręcznie (D-123) |
| P-011 | Czy „stan na” z dokładnością do minuty ma wrócić do UI (patrz D-032); czy `TZ` serwera ma być programowo wymuszony? | rejestr / interfejs | **rozstrzygnięte → D-042, D-050** (UI: tylko dzień — D-050 zastępuje D-043; `TZ` — D-042) |
| P-012 | Czy zdalna identyfikacja akcjonariusza (dane + opcjonalny skan wgrywany przez pracownika) spełnia wymogi AML? | AML | częściowo — mechanizm samodzielnego wgrywania skanu przez akcjonariusza dodany (D-041); spełnia AML → D-123 |
| P-013 | Czy status AML `brak` powinien blokować wpis tak jak `niemozliwe` (patrz D-010)? | AML | **rozstrzygnięte → D-117** |
| P-014 | Czy dezaktualizacja AML i brak beneficjenta rzeczywistego mają blokować wpis? | AML | **rozstrzygnięte → D-117** |
| P-015 | Czy potrzebny jest mechanizm oznaczania danych jako testowe/demo na produkcji? | operacyjne | **rozstrzygnięte → D-044** (nie, niepotrzebny) |
| P-016 | Kto fizycznie działa (podpisuje) za akcjonariusza-osobę prawną — brak pola reprezentanta akcjonariusza | AML / dokumenty (sesja frontendowa v2, B11) | **rozstrzygnięte → D-115** |
| P-017 | Czy `beneficjent_rzeczywisty_id` (pojedyncze pole) wystarcza przy więcej niż jednym beneficjencie rzeczywistym | AML (sesja frontendowa v2, B11) | **rozstrzygnięte → D-116** |

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
