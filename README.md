# Rejestr akcjonariuszy P.S.A.

Moduł do prowadzenia rejestrów akcjonariuszy prostych spółek akcyjnych
(art. 300³⁰ i nast. KSH) przez notariusza — Kancelaria Notarialna Łukasza Kozona.

**Stan: sprint 2 ukończony** (rdzeń rejestru + workflow spraw; bez portalu klienta).

---

## Uruchomienie

```bash
npm install
cp .env.przyklad .env      # uzupełnij dane kancelarii i (opcjonalnie) SMTP
npm start                  # http://localhost:3005
npm test                   # 81 testów
```

Migracje wykonują się automatycznie przy starcie i są idempotentne.

Front ładuje React 18 i Babel z CDN (`unpkg.com`, wersje przypięte) — maszyna
uruchamiająca przeglądarkę musi mieć do niego dostęp. Bez bundlera, bez
TypeScriptu, bez Tailwinda, bez bibliotek PDF.

---

## Co powstało w sprincie 1

| Punkt z planu | Stan |
|---|---|
| Szkielet modułu, migracje idempotentne, pragmy WAL | ✅ |
| Tabele `psa_spolki`, `psa_osoby`, `psa_emisje`, `psa_zdarzenia`, `psa_stan_akcji`, `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia` | ✅ |
| `logika/przepisy.js`, `typy-zdarzen.js`, `walidacje.js`, `stan.js`, `numery.js` | ✅ (+ `kreator.js`, `lancuch.js`, `maskowanie.js`) |
| Kokpit spółki + kreator dla `emisja`, `objecie`, `przeniesienie`, `umorzenie` | ✅ |
| Dodawanie spółki (3 kroki, z pobraniem z KRS), kartoteka osób | ✅ |
| Wydruk raportu spółki + „stan na dzień” | ✅ (+ informacja z rejestru z maskowaniem) |
| Testy: bilans, numery, odbudowa stanu, łańcuch skrótów, brzegowe przeniesienia | ✅ 45 testów |

Poza planem sprintu, bo wymagały tego reguły krytyczne:

- **maskowanie danych wrażliwych** (reguła 9) — wdrożone od pierwszego dnia,
  z wydrukiem „informacja z rejestru” w wariancie dla innego akcjonariusza;
- **odtwarzanie obciążeń, uprawnień i ograniczeń** ze zdarzeń — bez tego
  walidacje blokujące z sekcji 6 nie miałyby czego sprawdzać. Kreatorów dla
  tych typów nie było w sprincie 1 (doszły w sprincie 2), ale odczyt i
  blokady działały od początku.

## Co powstało w sprincie 2

| Punkt z planu | Stan |
|---|---|
| `psa_sprawy`, `psa_dokumenty`, `psa_wydane_dokumenty`; upload; kolejka na pulpicie | ✅ |
| `logika/terminy.js` (7 dni z zawieszeniem) + testy | ✅ |
| Checklisty per typ, ścieżka „uzasadnione wątpliwości”, AML jako bramka | ✅ |
| Powiadomienie z art. 300³⁴ § 3, zawiadomienia o wpisie/odmowie, wezwanie | ✅ |
| Pozostałe typy zdarzeń (obciążenia, zajęcia, uprawnienia, ograniczenia, sprostowanie) | ✅ |

Kreator jest teraz **sprawa-bound**: „Nowe zdarzenie” zakłada sprawę (start
licznika 7 dni), a kroki 3–4 działają na już istniejącej sprawie — ta sama
ścieżka obsługuje świeżo założoną sprawę i wznowienie z kolejki (z zachowanym
roboczym stanem formularza). Endpoint `POST /api/psa/spolki/:id/zdarzenia`
z sprintu 1 zostaje jako szybka ścieżka wewnętrzna (np. zasiewanie danych),
ale UI już go nie używa.

---

## Architektura

```
serwer.js                  punkt wejścia, port 3005
server/
  konfiguracja.js          .env (własny parser — dotenv nie jest na liście zależności)
  baza.js                  better-sqlite3, WAL, foreign_keys
  migracje.js              idempotentne, wyłącznie obiekty psa_* (v1 rdzeń, v2 sprawy)
  rejestr.js               transakcje: zapis zdarzenia, materializacja, wpis sprawy, sprostowanie
  widoki.js                stan domenowy → struktura dla UI, Z MASKOWANIEM
  zawiadomienia.js         generowanie + próba wysyłki dokumentów wychodzących (poza transakcją SQLite)
  poczta.js                nodemailer; no-op z czytelnym powodem, gdy brak SMTP
  logika/                  czysta domena, zero dostępu do bazy
    przepisy.js            JEDYNE źródło wiedzy prawnej: terminy, stawki, maskowanie
    typy-zdarzen.js        katalog typów: checklisty, odpłatność, powiadomienia
    numery.js              algebra zakresów numerów akcji, przydział FIFO
    stan.js                odbudowa stanu ze zdarzeń, kontrola bilansu, sprostowania
    terminy.js             termin 7 dni z zawieszeniem (art. 300³⁴ § 1 KSH)
    kreator.js              wejście z kreatora → treść zdarzenia (przydział numerów, sprostowania)
    walidacje.js           walidacje BLOKUJĄCE
    lancuch.js             sha256, kanoniczny JSON, weryfikacja łańcucha
    maskowanie.js          art. 300³⁵ § 1¹
    dokumenty-tresc.js     deterministyczny HTML zawiadomień/wezwań (bez bibliotek PDF)
  trasy/                   HTTP (spolki, osoby, sprawy, zdarzenia, pozostale, wspolne)
publiczne/                 React 18 + Babel z CDN, bez bundlera
  wspolne/design.css       kanon wizualny kancelarii (wersja 1.1)
  style/psa.css            wyłącznie układ modułu, kolory tylko przez var(--…)
  js/sprawy.js             kolejka + kokpit sprawy + kroki 3–4 kreatora (osadzone)
  js/kreator.js            kroki 1–2 (zakłada sprawę) + formularze kroku 3 per typ
testy/
```

Podział jest ostry: `logika/*` nie wie o istnieniu bazy ani HTTP, więc testuje
się ją w izolacji. `rejestr.js` odpowiada za transakcje i materializację,
`trasy/*` wyłącznie za HTTP.

---

## Jak działa rdzeń

### Stan akcjonariatu jako kafelkowanie serii

Każdy numer akcji należy w danej chwili do **dokładnie jednego** otwartego
przedziału, o jednej z trzech kategorii: `nieobjeta`, `akcjonariusz`, `umorzona`.
Zdarzenia wyłącznie przesuwają zakresy między kategoriami.

Dzięki temu reguła domenowa nr 3 („bilans musi się zgadzać zawsze”) sprawdza się
jednym warunkiem: otwarte przedziały serii pokrywają zakres emisji **szczelnie
i bez nakładania**. Naruszenie = odmowa zapisu, nie ostrzeżenie.

To wymagało dodania kolumny `kategoria` w `psa_stan_akcji` — patrz „Odstępstwa”.

### Materializacja zawsze przez pełne odtworzenie

Nie ma osobnej ścieżki „przyrostowej”. Każdy zapis kończy się pełnym
odtworzeniem stanu spółki ze zdarzeń i przepisaniem materializacji. Nie da się
więc doprowadzić do rozjazdu między „stanem bieżącym” a „stanem odbudowanym” —
to jedna i ta sama ścieżka kodu. `POST /:id/przelicz` uruchamia ją ręcznie.

Test `ODBUDOWA STANU ZE ZDARZEN = STAN BIEZACY` porównuje tabelę wiersz po
wierszu przed przeliczeniem i po nim.

### Append-only egzekwowane przez bazę

`psa_zdarzenia` ma wyzwalacze `BEFORE UPDATE` i `BEFORE DELETE`, które
przerywają operację. Działają także wtedy, gdy ktoś sięgnie do pliku bazy
z pominięciem aplikacji. Skrót liczymy **przed** wstawieniem (`id` = `MAX(id)+1`
w transakcji IMMEDIATE), bo rekordu nie wolno potem zaktualizować.

### Przydział numerów

Użytkownik podaje **wyłącznie ilość**. Aplikacja przydziela FIFO po najniższym
wolnym numerze, przy czym „wolny” znaczy też: nieobjęty blokującym obciążeniem —
inaczej kreator proponowałby akcje, których walidacja i tak nie przepuści.
Ręczne wskazanie zakresu jest schowane pod przełącznikiem, dla przypadków takich
jak przeniesienie konkretnych akcji obciążonych zastawem.

### Termin 7 dni: zamrożenie, nie zaliczanie

Ustawa: „nie później niż 7 dni od otrzymania żądania; przy przeszkodzie —
7 dni od jej usunięcia”. Interpretacja przyjęta w `terminy.js`: w stanie
`wstrzymana` zegar jest **zamrożony** (nie płynie), a po wznowieniu biegnie
**pełne nowe 7 dni** od dnia usunięcia przeszkody — nie kontynuacja z zaliczeniem
części terminu sprzed wstrzymania. To czytanie dosłowne brzmienia przepisu, nie
doktryny „zawieszenia biegu terminu” z zaliczeniem. `dni_wstrzymania` w bazie
jest wyłącznie skumulowaną statystyką do audytu — nie wpływa na `termin_do`.

### Sprostowanie: podmiana w miejscu chronologicznym, nie na końcu

Zdarzenie `sprostowanie` z treścią `zamiast` **nie** jest wstawiane osobno pod
swoim własnym ID — podmienia treść zdarzenia prostowanego **dokładnie w jego
pozycji** w chronologii. Dwa powody, oba wykryte testem integracyjnym podczas
budowy:

1. **Stabilność klucza.** Handlery czytają `zdarzenie.id` jako klucz struktury,
   którą tworzą (`HANDLERY.emisja: klucz = Number(zdarzenie.id)`). Późniejsze
   zdarzenia (np. `objecie`) odwołują się do tego klucza przez
   `emisja_zdarzenie_id` wskazujący na ID zdarzenia **pierwotnego**. Gdyby
   korekta wstawiała się pod ID sprostowania, każde takie odwołanie by się
   zerwało.
2. **Kolejność przetwarzania.** Sprostowanie ma zwykle późniejszy ID niż
   zdarzenia między oryginałem a korektą (przy tej samej `data_zdarzenia`
   decyduje ID). Wstawione na końcu, korekta przychodzi za późno — zdarzenia
   pomiędzy nią a oryginałem przetworzyłyby się na starej, błędnej treści.

Treść zastępczą (`zamiast`) liczymy względem stanu **tuż przed** zdarzeniem
pierwotnym (chronologicznie), nie „bez niego w ogóle” — wykluczenie całego
zdarzenia z listy zrywałoby referencje zdarzeń zależnych w trakcie samego
liczenia treści (np. `objecie` po `emisji`). Stan sprzed jest naturalną bazą
do pytania „jak to zdarzenie powinno było wyglądać”.

Sprostowanie **bez** `zamiast` jest pełnym wycofaniem zdarzenia (nie ma czym
go zastąpić) — działa tylko, gdy nic już od niego nie zależy (inaczej: błąd
integralności referencyjnej, celowo).

---

## Odstępstwa od specyfikacji i decyzje projektowe

Wszystkie świadome, wszystkie do zakwestionowania.

1. **`psa_stan_akcji.kategoria`** — kolumna spoza katalogu z sekcji 5. Bez niej
   nie da się odróżnić akcji nieobjętych od umorzonych (obie mają `osoba_id`
   NULL), a bilans przestaje być sprawdzalny.

2. **`psa_spolki.forma_prawna`** — kolumna spoza katalogu, potrzebna do reguły
   nr 11 (walidacja przy dodawaniu spółki + kontrola danych z KRS).

3. **Odczytanie reguły bilansu.** Literalnie brzmi ona „suma akcji przypisanych
   akcjonariuszom = wyemitowane − umorzone”. Ale `emisja` i `objecie` to dwa
   osobne zdarzenia, więc między nimi istnieje stan „wyemitowane, nieobjęte”.
   Egzekwujemy więc: *przypisane + nieobjęte + umorzone = wyemitowane*, przy
   szczelnym pokryciu zakresu. Literalna wersja obowiązuje po objęciu całej
   serii, a niezerowe „nieobjęte” generuje **ostrzeżenie** z art. 300³¹ § 3 KSH
   widoczne w kokpicie i po zapisie emisji.

4. **`emisja` i `objecie` pozostają osobnymi czynnościami** — kreator nie łączy
   ich w jeden krok. Kokpit eksponuje licznik akcji nieobjętych, więc krok
   drugi jest trudny do przeoczenia. Wariant łączony wymagałby identyfikatorów
   zastępczych w łańcuchu zdarzeń; uznałem to za gorszą wymianę.

5. **Ścieżka zapisu w sprincie 1: `POST /api/psa/spolki/:id/zdarzenia`.**
   Specyfikacja umieszcza wpis pod `POST /api/psa/sprawy/:id/wpisz`, ale sprawy
   wchodzą w sprincie 2. Sprint 2 opakuje tę ścieżkę, nie zastąpi jej.
   Jest też `POST /:id/zdarzenia/podglad` — zasila krok 4 kreatora (tabela
   przed/po), niczego nie zapisuje.

6. **`dane_json` nie zawiera numeru PESEL ani adresów.** Snapshot niesie
   `osoba_id` i oznaczenie strony, żeby zdarzenie dało się odczytać bez łączenia
   z innymi tabelami. Utrwalanie numeru PESEL w niezmienialnym łańcuchu skrótów
   niepotrzebnie zabetonowałoby dane osobowe; tożsamość żyje w `psa_osoby`.

7. **Serializacja skrótu z separatorem U+001F.** Specyfikacja pisze
   `sha256(id + spolka_id + …)`. Samo sklejenie pozwala przesunąć treść między
   sąsiednimi polami bez zmiany skrótu (`autor` sąsiaduje z `dane_json`).
   Separator, którego `JSON.stringify` nie wypuszcza dosłownie, domyka granice.
   Jest na to test.

8. **Nagłówek `X-User-Name` kodowany procentowo.** Nagłówki HTTP przenoszą
   wyłącznie ISO-8859-1 — `fetch` odrzuca „Łukasz Kozon”. Nazwa nagłówka zgodna
   z konwencją mastera, wartość przez `encodeURIComponent`.

9. **`design.css` podbity do 1.1** — dopisane tokeny układu (`--sb`, `--r`,
   `--r-sm`, `--r-xs`, `--przejscie`, `--tresc-maks`), zgodnie z sekcją 2.
   Wersja 1.0 nietknięta, więc Kalkulator i Kasa mogą podmienić plik bez zmian
   u siebie.

10. **AML jako bramka częściowa.** Status `niemozliwe` **blokuje** wpis
    (przeszkoda → odmowa). Status `brak` daje ostrzeżenie, a checklista i tak nie
    pozwoli dokonać wpisu bez odhaczenia pozycji AML. Pełna bramka z obiegiem
    sprawy wchodzi w sprincie 2.

11. **Zainstalowane tylko `express` i `better-sqlite3`.** `multer`, `bcrypt`
    i `nodemailer` dojdą razem ze sprintami, w których są potrzebne (2 i 3) —
    nie trzymamy zależności, których nikt nie wywołuje.

12. ~~Krok 2 kreatora bez wgrywania plików~~ — zrealizowane w sprincie 2
    (upload przez multer, `psa_dokumenty`).

13. **Dokumenty wychodzące jako HTML, nie PDF.** Zawiadomienia i wezwania są
    deterministycznym HTML-em (`logika/dokumenty-tresc.js`) — ten sam tekst
    idzie jako treść e-maila (nodemailer) i jako zapis audytowy w
    `psa_wydane_dokumenty.tresc_html`. Kolumna `sciezka_pdf` zostaje w
    schemacie zgodnie ze specyfikacją, ale w tym sprincie pozostaje `NULL` —
    zgodnie z zakazem bibliotek PDF (sekcja 13), wydruk na kanale papierowym
    pracownik robi z podglądu HTML przez `window.print()`.

14. **Wysyłka e-mail jako no-op z czytelnym powodem, gdy brak SMTP.**
    `.env.przyklad` nie ma domyślnie danych SMTP — `poczta.js` wtedy nie rzuca
    wyjątku, tylko zwraca `{ wyslano: false, powod }`. Ślad w
    `psa_wydane_dokumenty` i tak powstaje (`wyslano` zostaje `NULL` do czasu
    faktycznej wysyłki) — dokument jest gotowy do ręcznego wysłania kanałem
    papierowym.

15. **Ścieżka `z_urzedu` pomija fazę „nowa”.** Sprawy `zajecie`/`wykreslenie_zajecia`
    zakładają się wprost w stanie `weryfikacja` — organ egzekucyjny nie
    „żąda” wpisu (nie ma fazy oczekiwania na żądającego), tylko przekazuje
    kompletne zawiadomienie (art. 300³⁴ § 2 KSH: bez żądania, bez uprzedniego
    powiadomienia, wolne od opłat).

16. **`prawo_glosu_zastawnika` jest atrybutem bieżącym, bez własnej osi
    czasu.** Zmienia `prawo_glosu` istniejącego obciążenia w miejscu — „stan
    na dzień” z suwaka wiernie odtwarza skład akcjonariatu i to, które akcje
    są obciążone (regułą domenową nr 3), ale nie odtwarza historycznej
    wartości samego prawa głosu sprzed jego zmiany. Świadome uproszczenie:
    to atrybut pomocniczy przy obciążeniu, nie fakt liczbowy wymagający
    odtwarzania wstecz jak stan posiadania akcji.

17. **UI sprostowania ogranicza się do adnotacji/wycofania (bez `zamiast`).**
    API wspiera pełną podmianę treści (przetestowane), ale formularz w
    kokpicie oferuje tylko uzasadnienie — strukturalna korekta z nową treścią
    wymaga dziś wywołania API wprost. Świadome cięcie zakresu: 90% realnych
    korekt to „ten wpis nie powinien był powstać”, nie zmiana treści.

---

## Czego świadomie nie ma

Poza zakresem sprintu 2, zgodnie z planem: portal klienta (sprint 3), opłaty
i naliczenie roczne (sprint 4), migracja obecnych rejestrów z RN (sprint 4),
zawiadomienie sądu o rozwiązaniu umowy i obsługa zapytań sądu — stuby `501`
czekające na nowelizację (18.02.2027).

Struktura pełnej podmiany treści przy sprostowaniu jest gotowa i przetestowana
na poziomie API; brakuje jej wyłącznie formularza w UI (patrz odstępstwo 17).

Poza zakresem modułu, zgodnie z sekcją 1: rejestry S.A. i S.K.A., walne
zgromadzenia, dywidenda, e-voting, wysyłki do KRS w imieniu spółki.

Poza zakresem świadomie, zgodnie z sekcją 11: kwalifikowane znaczniki czasu,
drzewa Merkle'a, publikacja skrótów, XAdES/PAdES, integracja z podpisem
kwalifikowanym.

Stuby `501` czekające na nowelizację: `/api/psa/sad/zapytania`,
`/api/psa/sad/zawiadomienie-o-rozwiazaniu`.

---

## Do decyzji

Nie blokują tego, co powstało, ale blokują kolejne kroki:

1. **Wariant wdrożenia** (A: wszystko na VPS; B: rdzeń w kancelarii + skrzynka
   podawcza) — blokuje sprint 3. Nie zmieniło się w sprincie 2.
2. **Weryfikacja brzmienia przepisów nowelizacji.** Pozycje oznaczone
   w `przepisy.js` jako `DO_WERYFIKACJI` nie mogą być podstawą walidacji
   blokującej, dopóki Łukasz nie potwierdzi tekstu ustawy. Dziś żadna z nich
   nią nie jest.
3. **Kto może dokonać wpisu** — pytanie do izby. Na start: każdy zalogowany
   pracownik, z zapisem autora przy zdarzeniu (tak to działa).
4. **Stawki** — wpisane maksymalne (1200/100/50 zł) zgodnie z ustaleniem;
   obniżenie to zmiana trzech liczb w `przepisy.js`.
5. **Integracja opłat z modułem Kasa** — rekomendacja: osobno, scalenie po
   ustabilizowaniu modułu.
6. **Współwłasność akcji** — struktura przewidziana w `dane_json`, UI dopiero
   przy pierwszym przypadku.

Otwarta kwestia techniczna: **plik `STANDARDY-KANCELARIA-4-1.md` nie był
dostępny przy budowie.** Konwencje odtworzono ze specyfikacji modułu. Jeśli
Kalkulator i Kasa układają katalogi inaczej, przemianowanie jest tanie —
warto to zrobić przed sprintem 2.

---

## Testy

```bash
npm test
```

81 testów, bez zależności zewnętrznych (`node:test`), baza w pamięci lub plik tymczasowy.

- `numery.test.js` — algebra zakresów, przydział FIFO, ręczne nadpisanie
- `przeniesienie.test.js` — całość / część / wielu nabywców, pakiet nieciągły,
  łańcuch A→B→C, zachowanie daty nabycia reszty pakietu
- `rejestr.test.js` — bilans, stan na dzień, odbudowa = stan bieżący, łańcuch
  skrótów (podmiana treści i usunięcie rekordu), append-only, walidacje blokujące
- `reguly.test.js` — maskowanie, kartoteka wspólna, zakres podmiotowy,
  determinizm i jednoznaczność skrótu
- `terminy.test.js` — termin 7 dni, zamrożenie w stanie wstrzymana, pełny
  restart po wznowieniu, kumulacja `dni_wstrzymania`
- `nowe-typy.test.js` — obciążenia (blokada rozporządzania, wykreślenie,
  prawo głosu), zajęcie z urzędu, uprawnienia, ograniczenia (prawo
  pierwszeństwa), zmiana danych akcjonariusza, sprostowanie (adnotacja,
  podmiana treści, ochrona integralności referencyjnej, podwójne sprostowanie)
- `sprawy-http.test.js` — pełny cykl HTTP: założenie sprawy → weryfikacja →
  wpis z zawiadomieniem; wstrzymanie/wznowienie z wezwaniem; odmowa; ścieżka
  z urzędu; AML jako bramka w workflow sprawy; upload i pobranie dokumentu
  (w tym odrzucenie niedozwolonego rozszerzenia); sprostowanie przez
  dedykowany endpoint

UI sprawdzony w przeglądarce (Chromium) po każdym sprincie: wszystkie ekrany,
pełny cykl sprawy od założenia po wpis z podglądem przed/po i bramką
checklisty, wstrzymanie/wznowienie z realnym przeliczeniem terminu, upload
dokumentu, sprostowanie z kokpitu (potwierdzone: cofnięcie transferu akcji
widoczne w tabeli akcjonariatu), kolejka i pulpit z realnymi danymi.
