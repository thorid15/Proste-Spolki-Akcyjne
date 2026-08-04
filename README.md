# Rejestr akcjonariuszy P.S.A.

Moduł do prowadzenia rejestrów akcjonariuszy prostych spółek akcyjnych
(art. 300³⁰ i nast. KSH) przez notariusza — Kancelaria Notarialna Łukasza Kozona.

**Stan: sprint 1 ukończony** (rdzeń rejestru, bez workflow spraw i bez portalu klienta).

---

## Uruchomienie

```bash
npm install
cp .env.przyklad .env      # uzupełnij dane kancelarii
npm start                  # http://localhost:3005
npm test                   # 45 testów
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
  tych typów nie ma (wchodzą w sprincie 2), ale odczyt i blokady działają.

---

## Architektura

```
serwer.js                  punkt wejścia, port 3005
server/
  konfiguracja.js          .env (własny parser — dotenv nie jest na liście zależności)
  baza.js                  better-sqlite3, WAL, foreign_keys
  migracje.js              idempotentne, wyłącznie obiekty psa_*
  rejestr.js               transakcje: zapis zdarzenia + materializacja
  widoki.js                stan domenowy → struktura dla UI, Z MASKOWANIEM
  logika/                  czysta domena, zero dostępu do bazy
    przepisy.js            JEDYNE źródło wiedzy prawnej: terminy, stawki, maskowanie
    typy-zdarzen.js        katalog typów: checklisty, odpłatność, powiadomienia
    numery.js              algebra zakresów numerów akcji, przydział FIFO
    stan.js                odbudowa stanu ze zdarzeń, kontrola bilansu
    kreator.js             wejście z kreatora → treść zdarzenia (przydział numerów)
    walidacje.js           walidacje BLOKUJĄCE
    lancuch.js             sha256, kanoniczny JSON, weryfikacja łańcucha
    maskowanie.js          art. 300³⁵ § 1¹
  trasy/                   HTTP
publiczne/                 React 18 + Babel z CDN, bez bundlera
  wspolne/design.css       kanon wizualny kancelarii (wersja 1.1)
  style/psa.css            wyłącznie układ modułu, kolory tylko przez var(--…)
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

12. **Krok 2 kreatora bez wgrywania plików.** `psa_dokumenty` i upload to
    sprint 2. Na razie podstawa wpisu opisywana jest tekstem, który trafia do
    treści zdarzenia.

---

## Czego świadomie nie ma

Poza zakresem sprintu 1, zgodnie z planem: obieg spraw i termin 7 dni
(`logika/terminy.js`), wgrywanie dokumentów, zawiadomienia i powiadomienia,
pozostałe typy zdarzeń w kreatorze, portal klienta, opłaty.

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
   podawcza) — blokuje sprint 3.
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

45 testów, bez zależności zewnętrznych (`node:test`), baza w pamięci.

- `numery.test.js` — algebra zakresów, przydział FIFO, ręczne nadpisanie
- `przeniesienie.test.js` — całość / część / wielu nabywców, pakiet nieciągły,
  łańcuch A→B→C, zachowanie daty nabycia reszty pakietu
- `rejestr.test.js` — bilans, stan na dzień, odbudowa = stan bieżący, łańcuch
  skrótów (podmiana treści i usunięcie rekordu), append-only, walidacje blokujące
- `reguly.test.js` — maskowanie, kartoteka wspólna, zakres podmiotowy,
  determinizm i jednoznaczność skrótu

UI sprawdzony w przeglądarce (Chromium): wszystkie ekrany, przejście kreatora do
kroku 4 z tabelą przed/po i bramką checklisty, stan historyczny, oba wydruki.
