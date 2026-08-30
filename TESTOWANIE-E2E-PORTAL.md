# Test od zgłoszenia do pierwszego zawiadomienia

Jak przejść całą ścieżkę klienta i kancelarii — od publicznego formularza
zgłoszenia po pierwsze zawiadomienie o wpisie — i co dokładnie dzieje się
między jednym widokiem a drugim.

---

## 1. Jak te dwa widoki się ze sobą komunikują

Nie ma między nimi żadnego kanału „na żywo”. To **dwie osobne aplikacje
jednostronicowe stojące na jednym serwerze i jednej bazie**:

| | Aplikacja kancelaryjna | Portal klienta |
|---|---|---|
| Adres | `/` (`publiczne/index.html`) | `/portal` (`publiczne/portal.html`) |
| Kod | `publiczne/js/app.js` i pozostałe | `publiczne/js/portal.js`, `wniosek.js` |
| Trasy API | `/api/psa/spolki`, `/sprawy`, `/zgloszenia`, `/wnioski`, … | wyłącznie `/api/psa/portal/…` |
| Tożsamość | `psa_uzytkownicy` (pracownik) | `psa_konta` (konto klienta) |
| Ciasteczko sesji | `psa_sesja` | `psa_sesja_portal` |
| Bramka | `wymagajPracownika` | `wymagajKonta` |

Dwa różne ciasteczka to świadomy wybór: **można być zalogowanym jednocześnie
jako pracownik i jako klient w tej samej przeglądarce**, bez wychodzenia
z żadnej z sesji. To najwygodniejszy sposób testowania — dwa okna obok siebie.

Wymiana informacji idzie **przez bazę i przez pocztę**, nigdy bezpośrednio:

```
KLIENT (portal)                    BAZA                    KANCELARIA (aplikacja)
───────────────                    ────                    ─────────────────────
formularz „Zgłoś się"   ──────▶  psa_zgloszenia  ──────▶  ekran „Zgłoszenia"
                                                              │
link aktywacyjny        ◀── e-mail ── psa_konta  ◀───────  przycisk „Zaproś"
   │
wniosek + akcjonariusze ──────▶  psa_wnioski
                                 psa_wnioski_akcjonariusze ▶ ekran „Wnioski"
                                                              │
projekt umowy (.docx)   ◀──────  dokumenty/wnioski/…  ◀─── generowany przy złożeniu
skan podpisanej umowy   ──────▶  dokumenty/wnioski/…
                                                              │
                                 psa_spolki + psa_osoby ◀── „Przyjmij wniosek"
                                 psa_zdarzenia          ◀── otwarcie rejestru
                                                              │
zawiadomienie o wpisie  ◀── e-mail ── psa_wydane_dokumenty ◀── „Dokonaj wpisu"
```

Znaczy to tyle, że **żaden krok klienta nie robi nic po stronie kancelarii
automatycznie** — zawsze ląduje w kolejce (zgłoszeń, wniosków, spraw), którą
ktoś w kancelarii musi obejrzeć i ruszyć dalej. I odwrotnie: klient widzi
skutek dopiero, gdy odświeży swój ekran albo dostanie e-mail.

---

## 2. Przygotowanie środowiska testowego

### 2.1. Osobna baza

Scenariusz zapisuje prawdziwe dane. Testuj na osobnym pliku bazy:

```
# .env
WSPOLNA_BAZA=./dane/proba.db
KATALOG_DOKUMENTOW=./dokumenty-proba
PORTAL_WLACZONY=true
URL_PORTALU=http://localhost:3005/portal.html
ADMIN_EMAIL=lukasz@kancelaria.pl
SESJA_SEKRET=cokolwiek-dlugiego-do-testow
```

Żeby zacząć od zera, wystarczy skasować plik bazy i katalog dokumentów.

### 2.2. Poczta — celowo WYŁĄCZONA na czas testu

Zostaw `SMTP_HOST` puste. Wtedy:

* żaden e-mail nie wyjdzie do prawdziwej skrzynki (nikt przypadkiem nie
  dostanie próbnego zawiadomienia),
* każde pismo i tak powstaje i zapisuje się w `psa_wydane_dokumenty` —
  widać je w sprawie, tyle że z adnotacją „czeka na wysyłkę ręczną”,
* **link aktywacyjny z zaproszenia pokazuje się na ekranie kancelarii**
  w okienku do skopiowania (zamiast przepaść razem z niewysłanym mailem).

### 2.3. Start

```
npm install
npm start
```

Przy pierwszym starcie na pustej bazie serwer wypisuje w konsoli hasło
tymczasowe administratora — **zapisz je, nie pokaże się drugi raz**.

Otwórz dwa okna przeglądarki (albo jedno zwykłe i jedno prywatne):

* kancelaria — <http://localhost:3005/>
* klient — <http://localhost:3005/portal>

---

## 3. Przebieg ręczny (klikany)

### Krok 1 — klient: zgłoszenie wstępne

Portal → „Nie masz jeszcze konta? Zgłoś zainteresowanie”. Formularz zbiera
tylko e-mail, telefon, nazwę spółki i krótki opis — **żadnych danych
osobowych ani PESEL-u**; to dopiero lead do oceny.

### Krok 2 — kancelaria: zaproszenie

Aplikacja → **Zgłoszenia**. Wiersz ma dwa przyciski: „Zaproś” i „Odrzuć”.

„Zaproś” zakłada konto o roli `wnioskodawca` z jednorazowym tokenem i próbuje
wysłać maila. Przy wyłączonym SMTP pojawia się okno **„Zaproszenie założone,
e-mail nie wyszedł”** z linkiem aktywacyjnym do skopiowania — to jest ten link,
który normalnie klient dostałby mailem.

### Krok 3 — klient: aktywacja i klauzula RODO

Wklej link do drugiego okna. Klient ustawia hasło, po czym **od razu dostaje
sesję portalową**. Przed formularzem wniosku musi jednorazowo potwierdzić
zapoznanie się z klauzulą informacyjną (art. 13 RODO).

### Krok 4 — klient: wniosek o prowadzenie rejestru

Trzy kroki kreatora:

1. **Spółka i umowa** — dane spółki (jest „Pobierz z KRS” po numerze KRS)
   oraz reprezentant, który podpisze umowę. Dane wpisuje się w mianowniku;
   odmianę do treści umowy liczy serwer.
2. **Akcjonariusze** — dane do przyszłej kartoteki (imię, nazwisko, PESEL,
   adres, zgoda na komunikację elektroniczną). Każda pozycja zapisuje się osobno.
3. **Weryfikacja** — przycisk „Złóż wniosek”. Wniosek zamyka się do edycji
   i **od razu generuje się projekt umowy (.docx)** do pobrania.

### Krok 5 — klient: podpisana umowa

Klient pobiera projekt, podpisuje i wgrywa skan (PDF/JPG/PNG, do 20 MB).
Status wniosku: `umowa_podpisana`.

### Krok 6 — kancelaria: weryfikacja i przyjęcie wniosku

Aplikacja → **Wnioski** → wiersz klienta. Ekran porównuje dane wniosku
z danymi z KRS. Każdą pozycję akcjonariusza trzeba odhaczyć jako
zweryfikowaną — przy okazji można ją **dowiązać do osoby, która już jest
we wspólnej kartotece**, zamiast zakładać duplikat.

„Przyjmij wniosek” zakłada spółkę w `psa_spolki` i brakujące osoby
w `psa_osoby`. **Rejestr nie jest jeszcze otwarty** — nie ma żadnej emisji.

### Krok 7 — kancelaria: otwarcie rejestru

Kokpit spółki → kreator otwarcia: emisja założycielska (seria, numery,
ilość, data wpisu do KRS) i objęcie akcji przez akcjonariuszy. Obie rzeczy
zapisują się **jedną transakcją** — albo rejestr otwiera się cały, albo wcale.

### Krok 8 — kancelaria: pierwszy wpis i zawiadomienie

Kokpit spółki → „Nowe zdarzenie”. Dla przeniesienia akcji kolejność jest taka:

1. założenie sprawy (źródło, żądający, charakter, dokument będący podstawą),
2. „Przejdź do weryfikacji”,
3. **uprzednie powiadomienie zbywcy** (art. 300³⁴ § 3 KSH) — osobny przycisk,
4. odhaczenie checklisty badania dokumentu,
5. „Dokonaj wpisu”.

Wpis uruchamia automat zawiadomień: powstają pisma dla żądającego, dla spółki
oraz lista akcjonariuszy do KRS. Wszystkie widać w sprawie, w sekcji wydanych
dokumentów — z informacją, czy wyszły mailem, czy czekają na wysyłkę ręczną.

---

## 4. Przebieg automatyczny (skrypt)

Ten sam przebieg, po tych samych trasach HTTP, bez klikania:

```
node narzedzia/scenariusz-e2e.js --haslo <hasło-administratora>
```

Skrypt trzyma **dwa osobne komplety ciasteczek** — dokładnie tak, jak dwa okna
przeglądarki — i po każdym kroku wypisuje adres ekranu, na którym widać skutek.

Przydatne opcje:

| Opcja | Znaczenie |
|---|---|
| `--do <krok>` | zatrzymanie po kroku: `zgloszenie`, `zaproszenie`, `aktywacja`, `wniosek`, `umowa`, `przyjecie`, `rejestr`, `zawiadomienie` |
| `--email <adres>` | adres klienta w scenariuszu (domyślnie losowy — można uruchamiać wielokrotnie na tej samej bazie) |
| `--adres <url>` | inny adres serwera niż `http://localhost:3005` |
| `--admin <e-mail>` | pracownik inny niż `ADMIN_EMAIL` z `.env` |

Typowe użycie: `--do przyjecie` doprowadza bazę do momentu, w którym spółka
jest już założona, a dalej klika się już samemu w przeglądarce.

Skrypt kończy się wypisaniem loginu i hasła klienta — można się nimi zalogować
do portalu i obejrzeć to samo z drugiej strony.

---

## 5. Czego ten test NIE pokaże

**Konto klienta zostaje w roli `wnioskodawca` także po przyjęciu wniosku.**
Przyjęcie wniosku zakłada spółkę i osoby, ale nie przepina konta na rolę
`spolka` ani nie ustawia mu `spolka_id`. Klient po zalogowaniu widzi więc dalej
formularz wniosku (z komunikatem „Wniosek przyjęty”), a nie „Moje spółki”
z podglądem rejestru. Powiązanie konta ze spółką trzeba dziś zrobić w bazie:

```sql
UPDATE psa_konta
   SET rola = 'spolka', spolka_id = <id spółki>
 WHERE email = '<adres klienta>';
```

Po tym kliencki widok rejestru (z maskowaniem PESEL-u, daty urodzenia i adresu
pozostałych akcjonariuszy — art. 300³⁵ KSH), „Zgłoś zmianę” i „Informacja
z rejestru” działają normalnie. Docelowo warto to przepięcie zrobić częścią
przyjęcia wniosku albo osobnym przyciskiem na ekranie wniosku.
