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

---

## Decyzje otwarte

> Nic poniżej nie jest rozstrzygnięte — nie zgaduj odpowiedzi. Gdy Łukasz odpowie (w
> `testy-audyt/PYTANIA-DO-LUKASZA.md` albo bezpośrednio), kolejna sesja dokumentacyjna przenosi
> odpowiedź tutaj jako nowy wpis `D-0xx` w sekcji „Decyzje”.

### Z `testy-audyt/PYTANIA-DO-LUKASZA.md` — wszystkie 15, bez odpowiedzi na dziś (2026-09-18)

| ID | Skrót pytania | Obszar |
|---|---|---|
| P-001 | Czy przy wpisie transakcyjnym na rzecz osoby prawnej wymagamy identyfikacji beneficjenta rzeczywistego? | AML |
| P-002 | Czy akcja `niema` ma być automatycznie pozbawiona głosu, czy zależy to od umowy spółki? | rejestr |
| P-003 | Czy automatyczne zaproszenie „od razu” po zgłoszeniu ma zostać, czy przywrócić ocenę kancelarii? | portal (patrz D-038) |
| P-004 | Jaki ma być docelowy sposób nadawania dostępu portalowego akcjonariuszom innym niż wnioskodawca? | portal |
| P-005 | Czy niezgodność dat uchwała/umowa i nadpisanie umowy bez śladu mają być blokadą czy ostrzeżeniem? | rejestr |
| P-006 | Jaka ma być reguła walidacji krzyżowej `data_wpisu_krs` emisji względem daty rejestracji spółki? | rejestr |
| P-007 | Czy stan otwarcia to wpisy na żądanie (każdy odpłatny), czy tylko opłata za prowadzenie? | opłaty |
| P-008 | Czy martwy w UI endpoint `/naliczenie-roczne` ma zostać usunięty, zabezpieczony, czy zostać bez zmian? | opłaty |
| P-009 | Czy dziennik dostępu ma objąć też zwykłe odczyty portalowe? | dziennik dostępu |
| P-010 | Jak naprawić rozjazd pól PEP przy przejęciu wniosku; czy dokumenty RODO/PEP mają powstawać też dla akcjonariuszy dochodzących po założeniu spółki? | AML / dane osobowe |
| P-011 | Czy „stan na” z dokładnością do minuty ma wrócić do UI (patrz D-032); czy `TZ` serwera ma być programowo wymuszony? | rejestr / interfejs |
| P-012 | Czy zdalna identyfikacja akcjonariusza (dane + opcjonalny skan wgrywany przez pracownika) spełnia wymogi AML? | AML |
| P-013 | Czy status AML `brak` powinien blokować wpis tak jak `niemozliwe` (patrz D-010)? | AML |
| P-014 | Czy dezaktualizacja AML i brak beneficjenta rzeczywistego mają blokować wpis? | AML |
| P-015 | Czy potrzebny jest mechanizm oznaczania danych jako testowe/demo na produkcji? | operacyjne |

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
