# Audyt aplikacji — wrzesień 2026

Przegląd całości przed oddaniem aplikacji do testów zewnętrznych: co działa,
co jest zepsute, co da się uprościć. Osobno projekt płatności online (tpay)
i lista rzeczy do zrobienia przed audytem bezpieczeństwa.

Metoda: cztery skrypty przechodzące aplikację po tych samych trasach HTTP,
których używa przeglądarka (osobne sesje klienta i pracownika, jak dwa okna),
plus przejście ekranów przeglądarką. Razem **97 sprawdzeń**.

---

## 1. Co działa

### Rejestracja spółki — cztery konfiguracje akcjonariatu

Pełna ścieżka: zgłoszenie → zaproszenie → aktywacja konta → wniosek →
komplet dokumentów od kancelarii → podpisane skany → weryfikacja → przyjęcie.

| Konfiguracja | Dokumentów w komplecie | Wynik |
|---|---|---|
| 1 akcjonariusz (os. fizyczna) | 6 | przeszło |
| 2 akcjonariuszy | 9 | przeszło |
| 5 akcjonariuszy | 18 | przeszło |
| os. fizyczna + os. prawna | 9 | przeszło |

Komplet rośnie prawidłowo: oświadczenia (RODO, AML, zgoda na e-mail)
wystawiają się **po jednym na akcjonariusza**, umowa i uchwała po jednym na
spółkę. Przy pięciu akcjonariuszach to 18 dokumentów do podpisania —
punkt, do którego wracam w części 4.

### Zdarzenia rejestrowe — wszystkie typy

Przeszły: emisja, objęcie, przeniesienie, umorzenie, unieważnienie, zastaw,
użytkowanie, prawo głosu zastawnika, wykreślenie obciążenia, zajęcie
egzekucyjne, uchylenie zajęcia, uprawnienie, ograniczenie, zobowiązanie,
pokrycie akcji, zmiana danych akcjonariusza, zdarzenie inne, sprostowanie.

**Współwłasność ułamkowa** (akcja nr 1 podzielona na 1/4 + 1/4 + 1/2 między
trzy osoby, wspólny przedstawiciel) — działa razem z kontrolą, że nikt nie
zbywa więcej, niż ma, i że przedstawicielem może być tylko współuprawniony.

### Blokady zadziałały wszędzie tam, gdzie miały

* emisja bez daty wpisu do KRS — odrzucona,
* przeniesienie ponad stan posiadania — odrzucone, z **wyliczeniem, ile akcji
  jest wolnych i które są obciążone**,
* zbywca = nabywca, zastawnik = akcjonariusz — odrzucone,
* umorzenie cudzych akcji, objęcie ponad emisję — odrzucone,
* zbycie 3/4 akcji przez kogoś, kto ma 1/4 — odrzucone.

Komunikaty odmowy są mocną stroną aplikacji: mówią, co konkretnie jest nie
tak i jaki jest stan faktyczny, zamiast „błąd walidacji".

Po serii kilkunastu zdarzeń: **bilans akcji się zgadza, przeliczenie stanu ze
zdarzeń daje ten sam wynik co projekcja, łańcuch skrótów nieprzerwany.**

### Kontrola dostępu — bez zastrzeżeń

Sprawdzone 20 prób: wszystkie trasy kancelarii odrzucają żądanie bez sesji
(401); konto klienta nie wchodzi do kokpitu, kartoteki, kolejki wniosków ani
nie zakłada zdarzeń; klient A nie zobaczy rejestru, informacji ani dokumentów
klienta B (404/403); podmieniony numer dokumentu, przejście katalogiem
(`..%2F..%2Fetc%2Fpasswd`), nieistniejąca spółka i tekstowe `id` dają 404,
nie 500 i nie ślad stosu. Hasła: bcrypt. Ciasteczka: HttpOnly, SameSite=Lax,
Secure po HTTPS.

---

## 2. Błędy znalezione i naprawione w tej sesji

### 2.1. Trwały XSS przez „skan" odesłany przez klienta — POWAŻNY

Klient odsyłał plik nazwany `skan-umowy.pdf`, którego treścią był HTML,
a deklarowanym typem `text/html`. Serwer zapisywał **typ podany przez
przeglądarkę klienta** i przy `?podglad=1` oddawał go pracownikowi z powrotem
jako `text/html` do wyświetlenia w ramce. Skrypt z takiego „skanu" wykonywał
się na adresie aplikacji, w sesji kancelarii — czyli z dostępem do wszystkiego,
co widzi notariusz.

Naprawione trzema warstwami:
1. typ odpowiedzi ustala **serwer** z rozszerzenia z białej listy
   (`server/pomocnicze/pliki.js`); co nierozpoznane — do pobrania, nie do
   wyświetlenia; w ramce wolno pokazać wyłącznie PDF/JPG/PNG,
2. przy każdym wgraniu sprawdzana jest **sygnatura treści** (`%PDF-`, magic
   bytes JPEG/PNG) — plik ma być tym, czym się nazywa,
3. nagłówki bezpieczeństwa dla całej aplikacji (niżej).

Test regresyjny w `testy/wniosek-http.test.js`.

### 2.2. Brak nagłówków bezpieczeństwa

Aplikacja nie wysyłała żadnego: dało się ją osadzić w cudzej ramce
(clickjacking na ekranie podpisywania dokumentów), przeglądarka mogła zgadywać
typ pliku wbrew `Content-Type`, a adres z numerem sprawy wyciekał w `Referer`.
Dodane: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, HSTS po HTTPS.

### 2.3. Limiter formularza publicznego

Formularz „Zgłoś zainteresowanie" odpowiadał *„Za dużo nieudanych prób
logowania"* — na formularzu, na którym nikt się nie loguje — i liczył **5 prób
na cały adres IP**. Sześciu klientów z jednej sieci (biuro, wspólne łącze)
blokowało się nawzajem na 15 minut. Licznik jest teraz na adres e-mail,
z komunikatem o tym, co się faktycznie stało.

### 2.4. Po zalogowaniu klient lądował na „Nie ma takiej strony"

Wejście na `/portal.html#/logowanie` (naturalny odruch, trafia też do
zakładek) kończyło się po poprawnym haśle pustą stroną błędu — przy
zalogowanej sesji i działającej nawigacji. Teraz nieznany adres prowadzi na
stronę główną.

---

## 3. Do decyzji notariusza — braki, nie błędy

### 3.1. Dane kancelarii nie mają gdzie być wpisane

W każdej wystawianej umowie i uchwale zostaje **22 pustych miejsc**, w tym:

* `kancelaria_ulica`, `kancelaria_kod`, `kancelaria_miasto`, `kancelaria_nip`,
  `kancelaria_regon`, `kancelaria_email` — dane własne kancelarii,
* `spolka_sad_rejestrowy`, `spolka_nip`, `spolka_regon` — są w KRS,
* `reprezentant_pesel`, `reprezentant_adres`, `reprezentant_rodzice`,
  `reprezentant_dowod`, `spolka_organ_czlonkowie` — nikt o nie nie pyta.

Dane kancelarii da się dziś ustawić **wyłącznie przez zmianę pliku `.env` na
serwerze**. Zakładka „Konfiguracja" ma stawki, szablony i użytkowników — nie
ma metryki kancelarii. Do zrobienia: ekran „Dane kancelarii" zapisujący je
w bazie. To jedna tabela i jeden formularz, a bez tego każda umowa wychodzi
z kreskami w miejscu NIP-u notariusza.

Dane spółki (sąd, NIP, REGON) przychodzą z KRS przy „Pobierz z KRS" —
warto je **dociągać przy składaniu wniosku**, a nie tylko gdy klient kliknie
przycisk. Dane reprezentanta trzeba albo dodać do formularza, albo usunąć
ze wzorów — dziś są w jednym i drugim miejscu na pół gwizdka.

### 3.2. Sprawy, których nikt nie zamyka

Po audycie w kolejce zostało 27 spraw w stanie „w weryfikacji" — takich,
przy których wpis się nie udał (dane były sprzeczne) i nikt ich nie zamknął.
Liczą się jako „w toku" i tyka im siedmiodniowy termin z art. 300³⁴ § 1 KSH.

Aplikacja ma stan `odmowa` z powodem i `anulowana`, ale nic nie popycha
pracownika, żeby ich użył. Propozycja: w kolejce sekcja **„Bez ruchu od
X dni"** i przy każdej sprawie dwa przyciski kończące — „Odmów wpisu"
(z uzasadnieniem, art. 300³⁴ § 5 KSH) i „Anuluj".

### 3.3. Kroje pisma lecą z serwerów Google

`publiczne/index.html` ładuje EB Garamond, Inter Tight i IBM Plex Mono
z `fonts.googleapis.com`. Przy każdym wejściu do rejestru **adres IP klienta
trafia do Google** — dla rejestru akcjonariuszy prowadzonego przez notariusza
to zbędne ryzyko RODO, które audytor zewnętrzny na pewno podniesie (w Niemczech
zapadły w tej sprawie wyroki cywilne). Kroje mają licencje pozwalające je
hostować u siebie; po przeniesieniu znikają też dwa wyjątki z CSP, a aplikacja
zaczyna działać bez internetu.

### 3.4. Kompilacja JSX w przeglądarce

Interfejs ładuje `babel.min.js` i kompiluje wszystkie 25 plików **przy każdym
otwarciu strony**. Skutki: CSP musi dopuszczać `unsafe-eval` i `unsafe-inline`
(czyli najsłabszą ochronę przed XSS — to jedyny powód, dla którego przy
znalezisku 2.1 nagłówki by nie pomogły), a start aplikacji trwa dłużej, niż
powinien.

Do zrobienia bez zmiany sposobu pracy: kompilacja **raz, przy starcie
serwera**, do katalogu `publiczne/js-gotowe/`, i serwowanie gotowych plików.
Ten sam Babel, który już jest w repozytorium, ten sam kod źródłowy — zmienia
się tylko moment. Potem CSP schodzi do `script-src 'self'`.

---

## 4. Uproszczenia — portal klienta

### 4.1. „Zgłoś zmianę" prosi o wypracowanie, a nie o dane

Dziś: klient wybiera typ zdarzenia z listy, pisze **własnymi słowami**, co się
stało, i załącza skan. Pracownik czyta, zakłada sprawę i przepisuje do
kreatora to, co klient już wiedział: kto zbywa, kto nabywa, ile akcji, z jakiej
serii, na jakiej podstawie.

Propozycja: formularz **zależny od typu**. Przy „sprzedaży akcji" klient widzi
listę swoich akcjonariuszy (zna ich, to jego spółka), wybiera zbywcę,
wskazuje nabywcę (z kartoteki albo wpisuje dane nowej osoby), podaje liczbę
akcji i datę umowy, załącza skan. Zgłoszenie dochodzi do kancelarii jako
**wypełniony projekt wpisu** — pracownik sprawdza i zatwierdza, zamiast
przepisywać.

Technicznie jest to już przygotowane: `psa_sprawy` ma kolumnę
`dane_wejsciowe_json`, a kreator umie otworzyć się na wskazanym typie
(`?typ=...`). Brakuje formularza po stronie portalu i wczytania tych danych
w kroku „Co się zmienia".

To jest **największa pojedyncza oszczędność czasu pracownika** w całej
aplikacji i jednocześnie mniej miejsc, w których dane można przepisać źle.

### 4.2. Ekran startowy klienta nic nie mówi

Po zalogowaniu klient widzi nazwę spółki, numer KRS i trzy przyciski. Nie
widzi tego, po co przyszedł: ilu ma akcjonariuszy, ile akcji jest w obrocie,
kiedy była ostatnia zmiana, czy coś czeka na jego działanie.

Wzór z domów maklerskich: **stan na wejściu, akcja obok**. Trzy liczby
(akcjonariusze / akcje / data ostatniego wpisu), pod spodem trzy ostatnie
zdarzenia, a dopiero potem przyciski. Wszystkie te dane już przychodzą
z `GET /api/psa/portal/rejestr/:id`.

### 4.3. Dwie nazwy na dwie różne rzeczy, brzmiące tak samo

„Podgląd rejestru" i „Informacja z rejestru" to dla laika to samo. Pierwsze
jest darmowym wglądem na ekranie, drugie — **odpłatnym dokumentem**
z art. 300³⁵ KSH, za który nalicza się opłatę (i którego klient nie widzi
w cenniku, dopóki jej nie zapłaci).

Propozycja: „**Zobacz rejestr**" i „**Zamów informację z rejestru (PDF) —
XX zł**". Cena przy przycisku, przed kliknięciem.

### 4.4. Osiemnaście dokumentów do podpisania

Przy pięciu akcjonariuszach klient dostaje 18 plików: każdy musi wydrukować,
podpisać, zeskanować i odesłać osobno. To najdłuższy odcinek całej ścieżki.

Dwa kierunki, oba do decyzji:
* **jeden PDF zbiorczy na akcjonariusza** (jego trzy oświadczenia razem)
  zamiast trzech osobnych — 18 plików schodzi do 7,
* **wgrywanie hurtem**: jedno pole „przeciągnij wszystkie skany",
  dopasowywanie po nazwie pliku, ręczne poprawienie tam, gdzie się nie udało.

### 4.5. Klient nie widzi, na czym stoi jego sprawa

Sprawa ma stany (nowa → weryfikacja → wpisana / odmowa) i termin, ale portal
pokazuje je skrótowo. Wzór z bankowości: **pasek postępu z datami** —
„przyjęto 13.09 → sprawdzamy → wpis do 20.09". Klient przestaje dzwonić
z pytaniem, co się dzieje.

---

## 5. Uproszczenia — portal pracownika

1. **Pulpit jest dobry** — cztery liczby, kolejka, spółki, terminy. Zielona
   ramka „Rejestru nie da się cofnąć" to jednorazowe wyjaśnienie zajmujące
   stałe miejsce; po miesiącu pracy nikt jej nie czyta.
2. **Kolejka bez sekcji „bez ruchu"** — patrz 3.2.
3. **Zakładanie sprawy to wciąż dwa ekrany** (typ + podstawa), zanim
   pracownik dojdzie do rzeczy. Przy zgłoszeniu z portalu (4.1) podstawa jest
   już znana — ten krok powinien się wtedy **sam wypełnić i zwinąć**.
4. **Kartoteka osób a akcjonariusze wniosku** — przy przyjęciu wniosku
   aplikacja dopasowuje istniejące osoby po danych i nie duplikuje kartoteki
   (sprawdzone). Warto to pokazać pracownikowi wprost: „ta osoba jest już
   w kartotece jako akcjonariusz spółki X" — dziś dowiaduje się o tym dopiero
   po przyjęciu.

---

## 6. Przepływ dokumentów i informacji

Stan dzisiejszy, od zgłoszenia do wpisu:

```
KLIENT                        KANCELARIA                    REJESTR
──────                        ──────────                    ───────
zgłoszenie  ───────────────►  kolejka zgłoszeń
                              zaproszenie  ──────────────►  konto
wniosek (51 pól)  ─────────►  weryfikacja pozycji
                              wystawienie kompletu
                              udostępnienie  ────────────►  portal klienta
podpisane skany  ──────────►  potwierdzenie podpisów
                              przyjęcie wniosku  ────────►  spółka + kartoteka
                              otwarcie rejestru  ────────►  emisja + objęcie
zgłoszenie zmiany (tekst) ─►  sprawa → kreator (ręcznie)
                              wpis  ─────────────────────►  zdarzenie + zawiadomienia
```

Dwa miejsca, w których informacja **gubi postać strukturalną i trzeba ją
odtwarzać ręcznie**:

1. **zgłoszenie zmiany** — opisane słowami, przepisywane do kreatora (4.1),
2. **dane reprezentanta i spółki** — klient je zna, wzory ich potrzebują,
   nikt o nie nie pyta (3.1).

Poza tym przepływ jest szczelny: dokumenty z wniosku przechodzą do akt spółki
w obu egzemplarzach (wzór + podpisany skan), skany dosyłane przy żądaniach
wpisu trafiają do tej samej teczki z numerem sprawy, a każde pobranie pliku
zostawia ślad w dzienniku dostępu.

**Jedna luka w widoczności:** dziennik dostępu zapisuje się, ale nie ma trasy,
która pozwoliłaby go obejrzeć w aplikacji. Przy kontroli („kto oglądał dane
akcjonariusza X?") trzeba sięgać do bazy. Do zrobienia: zakładka „Kto i kiedy"
w kokpicie spółki.

---

## 7. Płatności online (tpay)

### Co już jest

Model opłat **jest gotowy i działa**. `psa_oplaty` ma typy (`prowadzenie`,
`wpis`, `informacja`), kwotę w groszach, okres i statusy:
`naliczona → zafakturowana → opłacona → anulowana`. Informacja pobrana przez
portal **już dziś nalicza opłatę** wg stawki z konfiguracji — tylko nikt jej
nie płaci i klient nie wie, że powstała.

Płatności nie trzeba więc „dobudowywać" do aplikacji — trzeba dopiąć jeden
brakujący krok: `naliczona → opłacona`.

### Co dodać

**Tabela `psa_platnosci`** — jedna płatność to jedna próba zapłaty za opłatę:

```
id, oplata_id → psa_oplaty, dostawca ('tpay'), identyfikator_transakcji,
kwota_grosze, status (rozpoczeta|oplacona|odrzucona|wygasla),
utworzono, zakonczono, surowa_odpowiedz (JSON — do reklamacji)
```

**Trzy trasy:**

* `POST /api/psa/portal/oplaty/:id/zaplac` — tworzy transakcję u operatora
  i zwraca adres strony płatności. Kwotę bierze **z bazy**, nigdy z żądania.
* `POST /api/psa/platnosci/powiadomienie` — publiczny webhook operatora.
  To **jedyne** źródło prawdy o zapłacie.
* `GET /api/psa/portal/oplaty` — klient widzi, co ma zapłacone i co czeka.

### Zasady, przy których to jest bezpieczne

1. **Powrót klienta na stronę nie jest dowodem zapłaty.** Adres powrotny jest
   pod kontrolą klienta. Status zmienia wyłącznie webhook.
2. **Podpis każdego powiadomienia sprawdzany**, zanim cokolwiek zapiszemy
   (tpay podpisuje powiadomienia sekretem sprzedawcy — dokładny algorytm
   do sprawdzenia w ich dokumentacji i przetestowania na środowisku
   testowym).
3. **Idempotencja.** Operator powtarza powiadomienie, dopóki nie dostanie
   odpowiedzi. Drugie powiadomienie o tej samej transakcji nie może
   drugi raz zmienić statusu ani wystawić drugiego dokumentu.
4. **Kwota sprawdzana po stronie serwera** — jeśli zapłacono mniej, niż
   wynosi opłata, płatność nie zamyka opłaty, tylko trafia do wyjaśnienia.
5. **Sekret sprzedawcy w `.env`**, nigdy w repozytorium; webhook ograniczony
   do adresów IP operatora, jeśli je udostępnia.
6. **Żadnych danych karty w aplikacji** — stronę płatności hostuje operator.
   To wyklucza obowiązki PCI DSS.
7. Każde powiadomienie do **dziennika dostępu**, razem z surową treścią.

### Gdzie postawić przycisk

| Czynność | Model | Uwaga |
|---|---|---|
| Informacja z rejestru | **zapłać, potem pobierz** | tak jak wydruk z KRS; kwota przy przycisku |
| Wniosek o prowadzenie rejestru | do decyzji | opłata wynika z umowy — może być rozliczana fakturą |
| Wpis na żądanie | **ostrożnie** | wpisu nie należy wstrzymywać płatnością: art. 300³⁴ § 1 KSH każe działać niezwłocznie, a termin biegnie od żądania. Bezpieczniej: wpis jak dziś, opłata naliczona i widoczna do zapłaty w portalu |
| Prowadzenie rejestru (rocznie) | link do zapłaty w wezwaniu | naliczenie roczne już jest |

Rekomendacja: **zacząć od informacji z rejestru**. Jedna czynność, jasna
cena, natychmiastowy skutek (PDF po zapłacie), zero ryzyka prawnego wokół
terminów ustawowych. Reszta po sprawdzeniu, jak działa w praktyce.

### Pomysł na później, z tej samej okolicy

Każda wystawiona informacja z rejestru mogłaby nieść **kod weryfikacyjny**
i publiczną stronę `/sprawdz/<kod>`, na której kontrahent potwierdza, że
dokument jest prawdziwy i na jaki dzień został wydany — tak jak weryfikacja
wydruków z KRS. `psa_wydane_dokumenty` zapisuje już każdy wydany dokument;
brakuje kodu i jednej publicznej strony. Dla odbiorcy informacji to różnica
między „PDF-em od kogoś" a dokumentem, który da się sprawdzić u źródła.

---

## 8. Przed testami zewnętrznymi — lista kontrolna

Zrobione w tej sesji:

- [x] nagłówki bezpieczeństwa (CSP, X-Frame-Options, nosniff, Referrer-Policy)
- [x] typ pliku ustalany przez serwer, nie przez klienta
- [x] kontrola sygnatury treści wgrywanych plików
- [x] limiter formularza publicznego z sensownym progiem i komunikatem

Do zrobienia przed oddaniem:

- [ ] **kroje pisma na własnym serwerze** (RODO — 3.3)
- [ ] **kompilacja JSX przy starcie serwera**, potem CSP bez `unsafe-eval`
      i bez `unsafe-inline` (3.4)
- [ ] **drugi składnik logowania (TOTP) dla pracowników kancelarii** — konto
      notariusza otwiera dane osobowe wszystkich akcjonariuszy wszystkich
      spółek; samo hasło to dziś za mało jak na taki zbiór
- [ ] **podgląd dziennika dostępu w aplikacji** (część 6)
- [ ] **rotacja i przechowywanie kopii bazy** — `dane/kancelaria.db` to jeden
      plik; rejestru nie da się odtworzyć z niczego innego
- [ ] **przegląd wielkości uploadu** — 20 MB × 10 plików na żądanie, bez
      limitu łącznego na konto; przy złej woli to prosta droga do zapełnienia
      dysku
- [ ] **`SESJA_SEKRET` obowiązkowy w produkcji** — dziś brak sekretu wypisuje
      ostrzeżenie i generuje tymczasowy; na produkcji powinien zatrzymać start
- [ ] testy obciążeniowe rejestru z kilkoma tysiącami zdarzeń (projekcja
      przelicza cały łańcuch — warto wiedzieć, gdzie jest granica)

---

## 9. Priorytety

**Najpierw (tydzień pracy):**
1. Ekran „Dane kancelarii" w konfiguracji — bez tego umowy wychodzą z lukami (3.1).
2. Strukturalne „Zgłoś zmianę" + wczytanie danych do kreatora (4.1).
3. Kroje pisma u siebie + kompilacja JSX na starcie (3.3, 3.4).

**Potem:**
4. Płatności tpay za informację z rejestru (część 7).
5. Ekran startowy klienta ze stanem rejestru (4.2) i nazwy przycisków (4.3).
6. Sekcja „bez ruchu" w kolejce i zamykanie spraw (3.2).

**Przed oddaniem do testów:**
7. TOTP dla pracowników, podgląd dziennika, kopie bazy, limity uploadu.
