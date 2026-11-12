# Rejestr jako dokument roboczy — projekt (12.11.2026)

Idea: **klient zakłada rejestr prostym formularzem w portalu, kancelaria prowadzi go zgodnie z przepisami na jednym
ekranie rejestru — bez kazuistyki.** Silnik rejestru (wpisy tylko dopisywane, stan z wpisów, symulacja przed i po,
kogo powiadomić, checklista, blokady R6) zostaje bez zmian. Zmieniają się ekrany kancelarii, kilka tras i zabezpieczenia.

## 1. Rozstrzygnięcia Łukasza (12.11.2026) — do `DECYZJE.md` jako D-230…

| Nr | Decyzja |
|---|---|
| D-230 | Ekran spółki jest rejestrem w układzie informacji z rejestru: Spółka → Akcje (serie; tu „Nowa emisja”) → Akcjonariusze (jeden przycisk „Nowy wpis” przy akcjonariuszu) → Obciążenia, ograniczenia, obowiązki → Historia wpisów. |
| D-231 | Wpis na jednej stronie, od góry: dane wpisu → podstawa → przed wpisem (powiadomienie albo zgoda, checklista, opłata) → podgląd po wpisie → „Dokonaj wpisu”. Bez paska kroków. Sprawa zostaje w danych jako ślad żądania (art. 300³⁴ KSH). |
| D-232 | Numery akcji zawsze wpisuje pracownik (U-26 bez zmian). Formularz pokazuje obok, co akcjonariusz posiada — niczego nie podstawia. |
| D-233 | Nowy rejestr: klient składa wniosek w portalu (kreator bez zmian — D-227); kilka pierwszych spółek wprowadzi pracownik („Nowa spółka”). W kancelarii wniosek to jedna strona: Spółka → Akcje i akcjonariusze → Dokumenty → Otwarcie rejestru. „Otwórz rejestr” przyjmuje wniosek i dokonuje wpisu otwarcia jedną czynnością. |
| D-234 | Informacja z rejestru bez zmian (wygląd i treść z D-181, U-27); bez podpisu notariusza i bez dodatkowych zdań. |
| D-235 | Menu kancelarii po lewej: Pulpit · Rejestry · Osoby · Korespondencja · Opłaty. „Sprawy” i „Wnioski” nie są pozycjami menu: otwarte wpisy są na Pulpicie i w rejestrze spółki, wnioski — na liście „Rejestry”. Aplikacja kancelarii bez stopki i bez zielonego pasa; portal klienta zachowuje stopkę kancelarii. |
| D-236 | Portal klienta działa publicznie od pierwszego dnia. Serwer: Ubuntu w kancelarii, nginx, aplikacja kancelarii tylko z adresów biura (`docs/WDROZENIE.md`). |
| D-237 | Bezpieczeństwo przed startem: poprawki z audytu 12.11.2026 (§ 4). Nagłówka `Cache-Control: no-store` nie wprowadzamy (decyzja Łukasza). Drugi składnik logowania pracowników — później. |
| D-238 | Powiadomienia tpay (ITN) przychodzą i księgują się automatycznie; w produkcji bez podpisu JWS są odrzucane. |
| D-239 | Podpisy elektroniczne przez zewnętrznego dostawcę (Autenti, Certum i in.) — rozpoznanie możliwości API; wdrożenie po decyzji. |

## 2. Ekrany kancelarii

### 2.1 Powłoka
Szyna z menu po lewej (5 pozycji), pasek tytułu tylko na ekranach list; ekran szczegółu ma jeden nagłówek (okruszek +
nazwa). Bez pasa marki i bez stopki. Jedna warstwa bazowa stylów: link, dwa rozmiary przycisku (zwykły 40 px, mały
32 px — oba z czcionką 13–14 px i widoczną ramką), tabela, karta, pole. Przycisk główny ekranu zawsze w tym samym
miejscu: nagłówek listy albo dół formularza.

### 2.2 Rejestr spółki (`#/spolki/:id`)
1. Nagłówek: firma, KRS, stan rejestru, liczba akcji i akcjonariuszy; „Stan na dzień”; „Informacja z rejestru”
   (przycisk główny); menu „Więcej”: eksport ZIP, „Zamknij rejestr”.
2. „W toku” — otwarte sprawy spółki: opis zmiany, co zostało do zrobienia, termin, „Dokończ”.
3. **I. Spółka** — dane z art. 300³³ § 1 pkt 1–3; „Zmień dane” (edycja w miejscu, historia — U-25).
4. **II. Akcje** — serie: numery, liczba, rodzaj i uprawnienia, data rejestracji emisji, umorzone; przycisk „Nowa emisja”.
5. **III. Akcjonariusze** — osoba raz (nazwa, identyfikator, adres, e-mail przy zgodzie), pod nią pakiety: seria,
   numery, liczba albo ułamek, data wpisu, pokrycie, znaczniki obciążeń; „razem” przy osobie; jeden przycisk
   „Nowy wpis” przy osobie.
6. **IV. Obciążenia, ograniczenia, obowiązki** — wiersz: rodzaj, akcje, uprawniony i treść, prawo głosu, data wpisu;
   czynności: „Zmień prawo głosu” (zastaw, użytkowanie), „Wykreśl”.
7. **Historia wpisów** — rozwinięta, od najnowszego: numer, data, opis zdaniem, podstawa, sprawa; „Sprostuj”.
8. Zwinięte: Dostęp klienta (działają za spółkę), Dokumenty i pisma, Opłaty, Historia zmian danych.

Przy „Stan na dzień” w przeszłości oraz w rejestrze zamkniętym czynności znikają.

### 2.3 Wpis (`#/spolki/:id/wpis?typ=…&osoba=…` → `#/sprawy/:id`)
- Wejście: „Nowy wpis” przy akcjonariuszu (wybór: zbycie, zastaw albo użytkowanie, zajęcie, umorzenie, ograniczenie /
  uprawnienie / obowiązek), „Nowa emisja” przy akcjach, czynności wiersza obciążenia, „Sprostuj”, „Zamknij rejestr”.
- Sprawa powstaje dopiero przy pierwszej zmianie w formularzu (albo od razu, gdy czynność niesie gotową treść:
  wykreślenie, zmiana prawa głosu, sprostowanie, zamknięcie). Otwarcie i porzucenie pustego formularza nie zostawia śladu.
- Układ strony, od góry:
  1. **Co się zmienia** — edytor rodzaju wpisu; akcjonariusz z wiersza wstawiony jako zbywca / akcjonariusz; obok
     pól numerów wiersz „Posiada: seria A nr 601–1000 (400)…” (tylko informacja — D-232).
  2. **Podstawa** — opis dokumentu, data, pliki; żądający i data wpływu żądania; termin.
  3. **Przed wpisem** — osoby do powiadomienia (powiadomienie albo zgoda), checklista, opłata.
  4. **Po wpisie** — tabela akcjonariuszy z zaznaczoną różnicą (było / będzie), zmienione obciążenia.
  5. Pasek na dole: lista „Zostało do zrobienia” (gdy coś blokuje) i przycisk główny.
- Przycisk główny: „Przygotuj powiadomienia” (gdy ktoś wymaga powiadomienia i nie ma zgody — zatwierdza treść,
  R2), potem „Dokonaj wpisu”; gdy powiadomienia nie są potrzebne — od razu „Dokonaj wpisu” (zatwierdza treść
  i wpisuje). Potwierdzenie wpisu pokazuje opis wpisu zdaniem.
- Po zatwierdzeniu treści pola 1–2 są tylko do odczytu; „Zmień treść” działa jak dziś (R2).
- Błędy pól pokazują się dopiero po pierwszej zmianie pola albo po próbie przejścia dalej; błędy bez pola — listą
  nad przyciskiem głównym.
- Po wpisie: opis wpisu, powiadomienia o wpisie z „Wyślij wszystkie” / „Drukuj” i „Nadano”, powrót do rejestru.

### 2.4 Nowy rejestr (`#/wnioski/:id`)
Jedna strona z czterema kartami:
1. **Spółka** — dane z KRS (różnice podświetlone), e-mail, NIP, opłata (U-30), przejęcie, osoba podpisująca umowę.
2. **Akcje i akcjonariusze** — akcjonariusze z wniosku; serie, numery i liczby wpisuje pracownik (projekt wpisu
   otwarcia: serie, pakiety akcjonariuszy, obciążenia i adnotacje, akcje umorzone); licznik „rozdzielono X z Y”.
3. **Dokumenty** — umowa, uchwała, umowa spółki, zgody: pobierz, wgraj, potwierdź podpis, podpis notariusza.
4. **Otwarcie rejestru** — lista warunków (dane, akcje, dokumenty), jedna checklista (pozycje wniosku + „Dokumenty
   zbadane”, „Identyfikacja i AML”), wybór „istniejąca / nowa” przy osobach z kartoteki, przycisk „Otwórz rejestr”.
   Przy przejęciu przed dniem przejęcia przycisk jest wyszarzony („Dostępne od …”).
Stan „roboczy” (wypełnia kancelaria albo klient): karty 1–2 edytowalne, przycisk „Złóż — przygotuj dokumenty”.
Stan „złożony”: dane z kart 1 i lista akcjonariuszy tylko do odczytu (dokumenty powstały z tej treści), akcje nadal
edytowalne. „Zwróć do uzupełnienia” i „Odrzuć” — w menu „Więcej”.

### 2.5 Listy
- **Rejestry**: spółki (stan rejestru) i nad nimi „W przygotowaniu” — wnioski robocze i złożone; „Nowa spółka”.
- **Pulpit**: „Do zrobienia” (wnioski złożone, wpisy w toku z terminem, pisma do wysłania) — bez zmian w regułach.
- Lista wszystkich spraw (`#/sprawy`) i wniosków (`#/wnioski`) zostają pod adresem, bez pozycji w menu.

## 3. Serwer — zmiany

- `GET /api/psa/spolki/:id`: każdy wpis dostaje `opis` (zdanie z `pisma.opisOperacji`) i `podstawa`; nowe pole
  `w_toku` — otwarte sprawy z opisem zmian, terminem i listą braków.
- `GET /api/psa/spolki`: bez zmian; lista „W przygotowaniu” z `GET /api/psa/wnioski?stan=roboczy,zlozony`.
- Wniosek: nowa kolumna `psa_wnioski.otwarcie_json` (migracja nr 2) — projekt wpisu otwarcia; zapis przez
  `PUT /api/psa/wnioski/:id` (`otwarcie`), dozwolony w stanie roboczym i złożonym.
- `POST /api/psa/wnioski/:id/otworz-rejestr` `{ osoby, potwierdz_konto }`: w jednej transakcji `przyjmij` → sprawa
  z wpisem `otwarcie` (osoby z przyjęcia) → wpis. Błąd w dowolnym miejscu cofa wszystko i wraca przy polach.
- Przyjęcie z dopasowaniem reprezentanta do istniejącej osoby, która ma już dostęp do innych spółek, wymaga
  `potwierdz_konto: true` (audyt S6); widok wniosku podaje nazwy tych spółek.

## 4. Bezpieczeństwo (audyt 12.11.2026)

| Nr | Poprawka |
|---|---|
| K1 | Serwer odmawia startu, gdy `SESJA_SEKRET` jest wartością z `.env.przyklad`, krótszy niż 32 znaki albo (w produkcji) pusty. |
| W1 | `multer` 2.x; sesja sprawdzana przed przyjęciem pliku; limity liczby pól i części. |
| W2 | Nasłuch domyślnie na `127.0.0.1` (`HOST`); lista adresów kancelarii `KANCELARIA_ADRESY` egzekwowana w aplikacji dla tras pracowników. |
| W3 | Limit liczby i łącznego rozmiaru plików na wniosek i sprawę; nowy plik dokumentu zastępuje poprzedni. |
| S1–S3 | Licznik prób logowania per konto; stały czas odpowiedzi logowania; dzienny limit zgłoszeń publicznych i limit spraw z portalu. |
| S5 | W produkcji powiadomienie tpay bez podpisu JWS jest odrzucane. |
| S6 | Patrz § 3 (`potwierdz_konto`). |
| S7 | Hasło tymczasowe administratora wymaga zmiany przy pierwszym logowaniu. |
| N1–N3 | Błędne wejście → 4xx; publiczne dane kancelarii tylko do stopki; CSV w eksporcie ZIP bez formuł. |

Poza zakresem tej rundy: drugi składnik logowania, integracja z dostawcą podpisu, widok rejestru w portalu klienta.
