# Wytyczne i plan — runda trzecia

Odpowiedzi na pytania z przeglądu, wnioski z regulaminów dwóch domów
maklerskich (Navigator, ING) i plan prac na tej podstawie.

---

## 1. Odpowiedzi na pytania

### 1.1. Dane kancelarii: `.env` czy baza?

**Rekomendacja: baza, z `.env` jako ziarnem przy pierwszym uruchomieniu.**

Podział, który się broni:

| Gdzie | Co tam trzyma się słusznie |
|---|---|
| `.env` | sekrety i rzeczy związane z *maszyną*: ścieżka bazy, katalog dokumentów, SMTP, klucze tpay, `SESJA_SEKRET`, port |
| baza | dane *kancelarii jako podmiotu*: nazwa, adres, NIP, REGON, e-mail, notariusz, stawki, terminy |

Dlaczego nie `.env` dla metryki kancelarii:

* żeby zmienić NIP albo adres, trzeba mieć dostęp do serwera i zrestartować
  aplikację — w praktyce **tego się nie robi**, i stąd 22 puste miejsca
  w każdej umowie (audyt, pkt 3.1),
* notariusz nie ma jak sprawdzić, co jest wpisane — pliku `.env` nie widać
  z aplikacji,
* nie ma walidacji: literówka w NIP-ie wychodzi dopiero na wydruku umowy,
* nie ma śladu, kto i kiedy zmienił dane, które trafiają do aktów.

Dlaczego nie „wszystko do bazy":

* sekret sesji i klucze tpay w bazie to sekret w kopii zapasowej, w eksporcie
  i w każdym miejscu, do którego trafia plik `.db`. Zostają w `.env`.

**Jak to wdrożyć bez wywracania kodu:** jedna tabela `psa_ustawienia`
(klucz, wartość, kto zmienił, kiedy). Migracja przy pierwszym uruchomieniu
**przepisuje do niej obecne wartości z `.env`** — nic nie znika i nie trzeba
niczego wpisywać od nowa. `konfiguracja.KANCELARIA` przestaje być stałą,
a staje się odczytem: najpierw baza, a gdy klucza nie ma — `.env` jak dotąd.
Wszystkie miejsca, które dziś czytają `konfiguracja.KANCELARIA.nip`, działają
bez zmian.

Do tego ekran **Konfiguracja → Dane kancelarii** z:
* walidacją NIP (suma kontrolna) i kodu pocztowego,
* **podglądem**: „tak będzie wyglądał nagłówek umowy" — bo to jest jedyny
  sposób, żeby zobaczyć skutek wpisu przed wystawieniem dokumentu,
* wpisem do dziennika przy każdej zmianie (te dane idą do aktów).

Przy okazji ten sam mechanizm rozwiązuje drugą rzecz: **stawki są dziś
zaszyte w `server/logika/przepisy.js`**, a ekran „Stawki i terminy" tylko je
pokazuje. Po zmianie rozporządzenia trzeba poprawić kod. Stawki idą do tej
samej tabeli, z porównaniem do maksymalnych — te zostają w kodzie jako
granica, której nie wolno przekroczyć.

### 1.2. Zgłoszenie zmiany przez formularz — wycofuję tę propozycję

Miałeś rację i mój pomysł z audytu (pkt 4.1) był chybiony. Uzasadnienie
mocniejsze niż samo zaufanie: **wpisu dokonuje się na podstawie dokumentu,
nie na podstawie tego, co klient wpisał w formularzu** (art. 300³⁴ § 4 KSH).
Gdyby aplikacja zbierała od klienta „kto zbywa, ile akcji", tworzyłaby drugie
źródło prawdy obok umowy — i pierwszą rzeczą, którą pracownik musiałby robić,
byłoby sprawdzanie, czy te dwa źródła się zgadzają. Gorzej niż dziś.

**Zamiast tego: lista dokumentów zamiast listy pól.** Klient wybiera typ
zdarzenia i widzi, **co ma dołączyć** — a to akurat wiedzą domy maklerskie
i mają to spisane (Navigator § 7 ust. 4):

| Tytuł prawny | Czego żąda się od nabywcy |
|---|---|
| sprzedaż, zamiana | oryginał albo notarialnie poświadczona kopia umowy; dopuszczalny podpis kwalifikowany lub ePUAP |
| darowizna | akt notarialny (oświadczenie darczyńcy); oświadczenie obdarowanego może być w zwykłej formie pisemnej |
| orzeczenie sądu, decyzja administracyjna | orzeczenie/decyzja **plus** potwierdzenie prawomocności albo ostateczności |
| dziedziczenie | prawomocne postanowienie o stwierdzeniu nabycia spadku albo zarejestrowany akt poświadczenia dziedziczenia |

Klient dostaje tę listę **przed** wysłaniem zgłoszenia, z polami do
zaznaczenia „załączam". Nie wpisuje żadnych faktów — przynosi papiery.
Zyskujemy mniej rund „proszę jeszcze o…", a nie tracimy nic na wiarygodności.

Po stronie pracownika zostaje to, co i tak robi: czyta dokument i wpisuje
z niego dane. Aplikacja ma mu podpowiedzieć tylko to, co **sama wie**:
spółkę, żądającego (właściciela konta), datę wpływu, typ zdarzenia i
załączniki jako podstawę wpisu. Żadnych danych transakcyjnych od klienta.

### 1.3. Kroje pisma z serwerów Google — **zrobione**

Chodziło o trzy kroje wczytywane w `index.html` i `portal.html`:
**EB Garamond** (nagłówki), **Inter Tight** (interfejs), **IBM Plex Mono**
(dane liczbowe). Szły z `fonts.googleapis.com`, więc **przy każdym wejściu
do rejestru adres IP klienta trafiał do Google** — bez potrzeby, bo wszystkie
trzy są na licencji SIL Open Font License i wolno je trzymać u siebie.

Zrobione w tej sesji (commit `42c6f02`):
* pobrane podzbiory `latin` i `latin-ext` — 18 plików `.woff2`, 1,1 MB,
  w `publiczne/fonty/`,
* deklaracje `@font-face` na początku `rejestr.css`,
* usunięte `<link>` do Google z obu stron,
* CSP zwężone do `style-src 'self'` i `font-src 'self'`.

Wygląd bez zmian (sprawdzone zrzutem ekranu), a aplikacja działa teraz bez
internetu i nie czeka na cudzy serwer przy pierwszym malowaniu.

### 1.4. Dokument tożsamości przy rejestracji zdalnej

Uwaga notariusza po pierwszej wersji tej odpowiedzi: **aplikacja ma działać
online, więc klienta można nigdy nie zobaczyć.** To zmienia wnioski —
„tożsamość stwierdzona osobiście" przestaje być drogą podstawową i staje się
wyjątkiem.

**Czy skan dowodu poprawia bezpieczeństwo? Sam z siebie — prawie nie.**

Co skan *udowadnia*: że ktoś dysponował obrazem dokumentu. Nie dowodzi, że
przysyła go osoba, do której dokument należy. Szablony dowodów krążą po
sieci, wycieki z serwisów pożyczkowych i wynajmu dostarczyły ich dziesiątki
tysięcy, a dorobienie w edytorze graficznym imienia na czyimś skanie zajmuje
kwadrans. Jako **uwierzytelnienie** skan jest słaby.

Co skan naprawdę daje — i to nie jest nic:

1. **Ślad dowodowy i odpowiedzialność.** Przy sporze albo oszustwie sytuacja
   przestaje być „nie mamy nic", a staje się „przedłożono nam ten dokument".
   Posłużenie się podrobionym dokumentem jest przestępstwem (art. 270 i 272
   KK), więc sam obowiązek przedłożenia odstrasza — nie każdego, ale część.
2. **Zgodność z AML.** Przy relacji nawiązywanej bez fizycznej obecności
   ustawa nakazuje **wzmożone** środki bezpieczeństwa finansowego, a kopia
   dokumentu jest tu standardem rynkowym. Ustawa AML wprost dopuszcza
   sporządzanie kopii dokumentów tożsamości — podstawa prawna istnieje,
   inaczej niż przy zwykłym „kopiowaniu dowodów", przed którym ostrzega UODO.
3. **Jakość danych.** Sprawdzenie, że PESEL i pisownia nazwiska zgadzają się
   z dokumentem, wyłapuje literówki — a te w rejestrze akcjonariuszy potrafią
   uniemożliwić późniejsze wykazanie tożsamości akcjonariusza.

Co skan **kosztuje**: zbiór skanów dowodów to materiał wprost pod kradzież
tożsamości. Wyciek takiego zbioru z kancelarii jest dużo gorszy niż wyciek
samych danych rejestrowych. To argument nie za rezygnacją, tylko za
**minimalizacją**: skan reprezentanta — tak; skany wszystkich akcjonariuszy
„na zapas" — nie.

**Co jest mocniejsze od skanu przy pracy zdalnej** (i co proponuję dołożyć):

| Metoda | Siła | Koszt wdrożenia |
|---|---|---|
| **Podpis kwalifikowany** na umowie i oświadczeniach | najwyższa — dostawca podpisu zweryfikował tożsamość, podpis równoważny własnoręcznemu | żaden po naszej stronie; wystarczy przyjmować PDF-y podpisane i **sprawdzać podpis** przy odbiorze |
| **Przelew weryfikacyjny** (1 zł z rachunku na nazwisko) | wysoka — bank wykonał KYC, nazwisko nadawcy musi się zgadzać | mamy już integrację tpay; zapisujemy nazwę nadawcy i numer rachunku, nie obraz dokumentu |
| **Profil Zaufany / mObywatel** | wysoka | wymaga osobnej integracji — do rozważenia później |
| **Skan dowodu** | niska jako weryfikacja, średnia jako dowód | najniższy |
| **Osobiście u notariusza** | najwyższa | wymaga wizyty — przy pracy zdalnej wyjątek |

**Rekomendacja:** skan **obowiązkowy** dla reprezentanta podpisującego umowę
(to jest ten obowiązek, o który pytałeś — i tak robią oba domy maklerskie),
ale traktowany jako *dowód*, nie jako *weryfikacja*. Do tego **jeden mocny
czynnik**: albo umowa podpisana podpisem kwalifikowanym, albo przelew
weryfikacyjny. Aplikacja zapisuje, **którą drogą** ustalono tożsamość — przy
kontroli widać wtedy, na czym oparto identyfikację, zamiast „był skan".

Akcjonariusze bez zmian: dane z dokumentu zawsze, skan tylko przy włączonej
procedurze AML dla tej spółki.

Jeśli przechowujemy skany, trzeba dołożyć trzy rzeczy, których dziś nie ma:
termin usunięcia, szyfrowanie plików na dysku i osobne uprawnienie do ich
oglądania (nie każdy pracownik musi widzieć dowody).

## 2. Czego jeszcze uczą regulaminy domów maklerskich

Rzeczy, które warto przenieść — i dwie, których nie.

### 2.1. Komplet dokumentów przy zawarciu umowy (Navigator § 5)

Wymagają siedmiu pozycji. Mamy większość, brakuje trzech:

* **wydruk informacji odpowiadającej odpisowi aktualnemu z KRS** — mamy
  pobieranie danych z KRS przez API, ale nie zapisujemy wydruku do akt,
* **tekst umowy spółki** plus **uchwały o zmianie umowy jeszcze
  niezarejestrowane w KRS — albo oświadczenie, że takich nie ma**. Tego
  drugiego nie ma w ogóle, a to jest ważne: rejestr zakłada się na stanie,
  który z KRS jeszcze nie wynika,
* **oświadczenie spółki o wykonaniu obowiązków dematerializacyjnych**.

### 2.2. Przejęcie rejestru od innego podmiotu (Navigator § 5 ust. 3)

Żądają **dokumentu potwierdzającego rozwiązanie umowy z poprzednim
podmiotem** i kompletu danych z tamtego rejestru. Mamy ekran
„Migracja — stan otwarcia", ale nie prosi o ten dokument. To jedna pozycja
na liście załączników — a bez niej można otworzyć drugi rejestr tej samej
spółki, co jest stanem, którego nie wolno dopuścić.

### 2.3. Tydzień od **usunięcia przeszkody** (Navigator § 7 ust. 1)

Termin tygodniowy biegnie od żądania, ale gdy brakuje dokumentu — **od dnia
usunięcia przeszkody**. Mamy w bazie `wstrzymana_od` i `wznowiona_od`, więc
mechanizm jest; brakuje rzeczy, która go uruchamia: **wezwania do uzupełnienia**
jako dokumentu wychodzącego, który jednocześnie zatrzymuje zegar. Dziś
pracownik musi o tym pamiętać sam.

### 2.4. Skargi i reklamacje (Navigator § 17)

Cały tryb, którego u nas nie ma: forma (pisemna, ustna, elektroniczna),
30 dni na odpowiedź, w sprawach zawiłych do 60 z uprzedzeniem, skarga bez
danych identyfikujących zostaje bez rozpoznania, a **brak odpowiedzi
w terminie wobec osoby fizycznej oznacza uznanie skargi zgodnie z jej wolą**.
Ostatnie zdanie jest wystarczającym powodem, żeby skargi miały w aplikacji
własny rejestr z terminem — tak jak sprawy.

### 2.5. Archiwizacja (Navigator § 16 — 5 lat, ING § 19 — 6 lat)

Oba domy mają spisany okres przechowywania. Nasza aplikacja nie ma żadnej
polityki: pliki leżą w `dokumenty/` bez końca. Dla notariusza obowiązują
własne przepisy o przechowywaniu (Prawo o notariacie), więc okresy z DM są
**dolną granicą, nie wzorem** — ale sam fakt, że nic nie jest spisane ani
widoczne w aplikacji, jest do poprawy.

### 2.6. Lista sankcyjna GIIF (Navigator § 2 pkt 9)

Sprawdzają akcjonariuszy wobec list sankcyjnych. Mamy PEP i beneficjenta
rzeczywistego, nie mamy śladu takiego sprawdzenia. Minimum: pozycja
w checkliście AML „sprawdzono listy sankcyjne, data" — bez automatycznego
odpytywania, sam zapis, kto i kiedy sprawdził.

### 2.7. Konta dla akcjonariuszy — ODŁOŻONE

Navigator ma w aplikacji **osobne moduły dla spółki i dla akcjonariuszy**,
ING tak samo. U nas rola `akcjonariusz` **istnieje w bazie i w portalu**
(trasa `/moje` umie pokazać spółki akcjonariusza), ale **nie ma jak takiego
konta założyć** — nie ma zaproszenia z kartoteki.

**Decyzja notariusza: odkładamy.** Najpierw konto reprezentanta spółki ma
być dopracowane — funkcjonalnie i wizualnie. Dopiero gotowy, sprawdzony
wzorzec jednego konta warto powielać na drugą rolę; inaczej poprawialibyśmy
dwa portale naraz.

### 2.8. Czego NIE przenosić

* **Odbieranie dostępu do aplikacji przy zaległości** (Navigator § 12a).
  Dom maklerski może; notariusz prowadzi rejestr, którego jawność wynika
  z ustawy — odcięcie akcjonariusza od wglądu za cudze zaległości spółki
  jest ryzykowne. Jeśli już, to jako świadomy przełącznik z decyzją
  notariusza, nigdy automatycznie.
* **Indeksacja rocznej opłaty wskaźnikiem GUS** (Navigator § 12 ust. 5).
  Nasze stawki to stawki **maksymalne z rozporządzenia** — indeksuje je
  ustawodawca, nie my.

---

## 3. Płatności tpay — plan na podstawie wdrożenia z kalkulatora

Notatka z kalkulatora jest do przeniesienia niemal w całości. Różnice biorą
się z jednego: tam serwer stoi w sieci kancelarii i nie ma publicznego
adresu, więc stan płatności ustalało **odpytywanie**. Tutaj aplikacja jest
w internecie, więc źródłem prawdy jest **ITN (webhook)**, a odpytywanie
zostaje jako awaryjne.

### 3.1. Co już mamy

`psa_oplaty` ze statusami `naliczona → zafakturowana → opłacona → anulowana`,
stawki i naliczanie. Informacja z rejestru pobrana przez portal **już dziś
nalicza opłatę**. Brakuje jednego kroku: zapłaty.

### 3.2. Model danych

```sql
CREATE TABLE psa_platnosci (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  oplata_id      INTEGER NOT NULL REFERENCES psa_oplaty(id),
  dostawca       TEXT NOT NULL DEFAULT 'tpay',
  tpay_id        TEXT,            -- transactionId
  crc            TEXT NOT NULL,   -- nasz identyfikator, wraca w ITN jako tr_crc
  kwota_grosze   INTEGER NOT NULL,-- kwota, NA KTÓRĄ opiewa transakcja
  link           TEXT,            -- transactionPaymentUrl
  status         TEXT NOT NULL DEFAULT 'oczekuje'
                   CHECK (status IN ('oczekuje','oplacona','nieudana','anulowana','wygasla')),
  tryb_testowy   INTEGER NOT NULL DEFAULT 0,
  utworzono      TEXT NOT NULL,
  zakonczono     TEXT,
  odpowiedz_json TEXT             -- surowa treść ITN, do reklamacji
);
```

Dwie decyzje z notatki, obie przenosimy: **jedna opłata może mieć wiele
wierszy płatności** (zmiana kwoty unieważnia poprzednią transakcję, historia
prób zostaje) i **kwota transakcji zapisana osobno** — jedyny sposób, żeby
wykryć, że opłata zmieniła się po wygenerowaniu linku.

### 3.3. Trasy

| Trasa | Kto | Co robi |
|---|---|---|
| `POST /api/psa/portal/oplaty/:id/zaplac` | klient | tworzy transakcję i zwraca `link`. Kwotę bierze **z bazy**. Idempotentna: dopóki jest ważny link na tę samą kwotę, zwraca go zamiast tworzyć nowy |
| `POST /api/psa/platnosci/tpay/itn` | tpay | publiczny webhook; **jedyne** źródło prawdy o zapłacie |
| `GET /api/psa/portal/oplaty` | klient | co zapłacone, co czeka |
| `GET /api/psa/oplaty/:id/sprawdz` | pracownik | awaryjne odpytanie `GET /transactions/{id}`, gdy ITN nie doszedł |

### 3.4. Zasady, od których nie odstępujemy

1. **Powrót klienta na stronę nie jest dowodem zapłaty.** Strona powrotna
   pokazuje stan z naszej bazy; gdy jeszcze „oczekuje" — „sprawdzamy płatność"
   i odświeżenie po kilku sekundach.
2. **Weryfikacja ITN w dwóch warstwach:** suma MD5
   (`md5(id + tr_id + tr_amount + tr_crc + sekret)`) **oraz** podpis JWS
   z nagłówka `X-JWS-Signature`. Lista adresów IP tpay jako trzecia, luźna
   warstwa.
3. **Odpowiedź czystym `TRUE`**, bez HTML i JSON — inaczej tpay ponawia.
4. **Idempotencja po `tr_id`** — powiadomienie przychodzi wielokrotnie.
5. **Kwotę porównujemy z naszą bazą** po `tr_crc`; zapłacono mniej — opłata
   nie zostaje zamknięta, trafia do wyjaśnienia.
6. **`test_mode` odróżnia sandbox od produkcji** — powiadomienie z sandboxa
   nigdy nie księguje płatności na produkcji.
7. **Nieznany status = „oczekuje"**, nigdy „opłacona".
8. **Bez obiektu `payer`** — klient sam podaje adres i dostaje potwierdzenie,
   a my nie przechowujemy jego danych. `callbacks.notification.email` jako
   nasz niezależny kanał.
9. **Token w pamięci procesu**, odnawiany przed wygaśnięciem, jednorazowe
   ponowienie po 401.
10. **Sekrety w `.env`** (`TPAY_CLIENT_ID`, `TPAY_CLIENT_SECRET`,
    `TPAY_NOTIFICATION_SECRET`, `TPAY_API_URL`), nigdy w bazie.
11. **Awaria tpay nie blokuje rejestru.** Nie da się zapłacić — opłata
    zostaje „naliczona", wpis i tak się odbywa.

### 3.5. Gdzie stawiamy przycisk

| Czynność | Model | Dlaczego |
|---|---|---|
| **Informacja z rejestru** | zapłać, potem pobierz | jasna cena, natychmiastowy skutek, zero ryzyka wokół terminów ustawowych — **tym zaczynamy** |
| Wpis na żądanie | wpis jak dziś, opłata do zapłaty w portalu | art. 300³⁴ § 1 KSH każe działać niezwłocznie; wstrzymywanie wpisu do czasu zapłaty byłoby wstrzymywaniem czynności ustawowej |
| Prowadzenie rejestru (rocznie) | link do zapłaty w wezwaniu | naliczenie roczne już działa |
| Wniosek o prowadzenie rejestru | do decyzji | opłata wynika z umowy, może iść fakturą |

### 3.6. Testy bez produkcji

Z notatki: **lokalny serwer-atrapa** zamiast sandboxa w testach
automatycznych — pozwala wywołać scenariusze, których na sandboxie nie
wywołasz na żądanie (zmiana kwoty, wygaśnięcie linku, brak łączności,
podwójne powiadomienie). `TPAY_API_URL` już to umożliwia.

---

## 4. Plan prac

### Etap E — konfiguracja kancelarii ✔ WYKONANE

1. Tabela `psa_ustawienia` + migracja przepisująca wartości z `.env`.
2. `konfiguracja.KANCELARIA` czyta bazę, `.env` jako zapas.
3. Ekran **Konfiguracja → Dane kancelarii**: metryka, walidacja NIP,
   podgląd nagłówka umowy, wpis do dziennika przy zmianie.
4. Stawki i terminy do tej samej tabeli, z porównaniem do maksymalnych.
5. Pola reprezentanta w formularzu wniosku (PESEL, dokument, adres) —
   domykają puste miejsca we wzorach.

*Wykonane (commit `c59cfd4`): tabela `psa_ustawienia`, moduł
`server/logika/ustawienia.js`, trasy `GET/PUT /api/psa/ustawienia`, ekran
„Dane kancelarii" z podglądem nagłówka umowy i walidacją NIP-u. Puste
miejsca we wzorach spadły z 22 do 11 — zostały dane spółki z KRS i
reprezentanta, czyli etap F. Punkt 5 (pola reprezentanta) przechodzi do F.*

### Etap F — dokumenty i tożsamość

1. **Lista dokumentów wymaganych** przy zgłoszeniu zmiany, zależna od typu
   zdarzenia i tytułu prawnego (tabela z 1.2) — zaznaczane przez klienta,
   widoczne dla pracownika.
2. **Identyfikacja reprezentanta przy pracy zdalnej** (patrz 1.4): pola
   dokumentu tożsamości + **obowiązkowy skan** + wskazanie drogi, którą
   ustalono tożsamość (podpis kwalifikowany / przelew weryfikacyjny /
   osobiście). Zapis, którą drogą — nie sam fakt, że „był skan".
3. Uzupełnienie kompletu przy wniosku: wydruk z KRS do akt, oświadczenie
   o uchwałach niezarejestrowanych, oświadczenie o dematerializacji.
4. Dokument rozwiązania umowy z poprzednim podmiotem przy migracji.
5. Pozycja „sprawdzono listy sankcyjne" w checkliście AML.

### Etap G — płatności tpay

1. `psa_platnosci`, klient tpay (token w pamięci, tworzenie transakcji,
   anulowanie, odpytanie), serwer-atrapa do testów.
2. Webhook ITN z weryfikacją MD5 + JWS, idempotencją i odpowiedzią `TRUE`.
3. Przycisk „Zamów informację z rejestru — XX zł" w portalu, strona powrotna
   pokazująca stan z naszej bazy.
4. Lista „Moje opłaty" u klienta i podgląd płatności przy opłacie
   u pracownika.

### Etap H — obsługa spraw i terminów

1. **Wezwanie do uzupełnienia** jako dokument wychodzący, który zatrzymuje
   zegar (`wstrzymana_od`) i wznawia go po uzupełnieniu.
2. **Rejestr skarg** z terminem 30/60 dni i śladem odpowiedzi.
3. Sekcja „bez ruchu od X dni" w kolejce + zamykanie sprawy odmową
   albo anulowaniem (audyt, pkt 3.2).

*Konta akcjonariuszy — dopiero po dopracowaniu konta reprezentanta spółki
(patrz 2.7).*

### Etap I — przed testami zewnętrznymi

Lista z `AUDYT.md`, część 8, pomniejszona o kroje pisma (zrobione):
kompilacja JSX przy starcie i CSP bez `unsafe-eval`, TOTP dla pracowników,
podgląd dziennika dostępu, kopie zapasowe bazy, limity uploadu,
`SESJA_SEKRET` obowiązkowy na produkcji, polityka przechowywania dokumentów.

---

## 5. Kolejność i uzasadnienie

**E → F → G → H → I.**

E jest pierwsze, bo bez niego **każda umowa wychodzi z lukami** — to jedyna
pozycja, która psuje dokument już wystawiony klientowi. F jest drugie, bo
zmniejsza liczbę rund „proszę jeszcze o dokument", czyli działa na to samo,
na co miał działać odrzucony formularz z 1.2, tylko właściwą drogą. G można
robić równolegle do F — dotyka innych plików. H to porządek w kolejce, który
zaczyna doskwierać dopiero przy kilkunastu spółkach. I jest ostatnie, ale
**przed** oddaniem komukolwiek na zewnątrz.
