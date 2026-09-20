# Sesja Claude Code — PSA: audyt prototypu (ścieżka onboardingu)

> **To nie jest sesja implementacyjna. Niczego nie naprawiaj.**
> Twoim zadaniem jest znaleźć błędy, luki i niezgodności z przepisami — i je opisać.
> Poprawki wykonamy w osobnej sesji, po decyzji Łukasza, które z nich naprawiamy.
>
> **Pliki kontekstu:** `PRZEPISY-PSA.md` (jedyne źródło prawne — każdą ocenę zgodności
> uzasadniaj jednostką redakcyjną stamtąd), `WYTYCZNE-MERYTORYCZNE-PSA.md` (wykładnia),
> `CLAUDE-PSA.md` (specyfikacja).

## Zasady sesji

1. **Zero zmian w kodzie produkcyjnym.** Wolno pisać skrypty testowe i dane testowe w osobnym
   katalogu `testy-audyt/`.
2. **Testuj przez API i przez przeglądarkę (Playwright), nie przez czytanie kodu.** Czytanie
   kodu służy wyłącznie potwierdzeniu znalezionego zachowania. Wiele błędów tej klasy jest
   niewidocznych w kodzie, bo „logika jest, tylko nie jest wywoływana".
3. **Nie ufaj interfejsowi.** Każdą regułę, którą UI wymusza, sprawdź osobno **bezpośrednim
   żądaniem do API** z pominięciem formularza. Blokada wyłącznie po stronie przeglądarki to
   brak blokady.
4. **Każde znalezisko** opisz jako: co zrobiłem → co się stało → co powinno się stać → podstawa
   (przepis z `PRZEPISY-PSA.md` albo zasada techniczna) → waga.
5. **Waga:** `KRYTYCZNY` (naruszenie prawa, wyciek danych, utrata integralności rejestru),
   `POWAŻNY` (błędna kwota, błędny dokument, błędny termin), `DROBNY` (UX, literówka, brak
   komunikatu).
6. Jeżeli czegoś nie da się rozstrzygnąć bez decyzji człowieka — zapisz jako **PYTANIE DO
   ŁUKASZA**, nie zgaduj.

---

## FAZA 1 — ścieżka główna od zgłoszenia do pierwszej informacji z rejestru

Przejdź **całą ścieżkę jako użytkownik**, w przeglądarce, na danych testowych. Zrób zrzut ekranu
po każdym kroku. To jest najczęstszy stan faktyczny i musi działać bez zarzutu.

### Scenariusz podstawowy (S1)

Spółka: nowo zawiązana P.S.A., dwóch akcjonariuszy — osoba fizyczna (95 akcji) i osoba prawna
(5 akcji), seria AZ, numery 1–100, cena emisyjna 0,01 zł, akcje pokryte w całości, zarząd
jednoosobowy.

1. Zgłoszenie przez formularz publiczny (bez konta): numer KRS → import danych → wgranie umowy
   spółki → dane akcjonariuszy → oświadczenia → akceptacja warunków.
2. Przegląd i zatwierdzenie przez pracownika kancelarii.
3. Wygenerowanie i udostępnienie kompletu dokumentów.
4. Podpisanie: **spółka pierwsza**, notariusz na końcu.
5. Wprowadzenie stanu otwarcia rejestru i otwarcie rejestru.
6. Żądanie informacji z rejestru przez **akcjonariusza mniejszościowego** i pobranie dokumentu.

### Co sprawdzić po drodze

- [ ] Czy na każdym etapie widać, **kto jest właścicielem następnego kroku** (klient czy
      kancelaria) i czego się czeka.
- [ ] Czy da się **przerwać w połowie i wrócić** (zamknięcie karty, powrót z linku, przycisk
      wstecz w przeglądarce) bez utraty danych i bez utworzenia duplikatu zgłoszenia.
- [ ] Czy **podwójne kliknięcie** przycisku zatwierdzającego tworzy dwa zgłoszenia, dwa wpisy,
      dwie opłaty. Sprawdź też odświeżenie strony po wysłaniu formularza (`F5` po POST).
- [ ] Czy wygenerowane dokumenty mają **wypełnione wszystkie pola** — poszukaj w plikach
      wyjściowych ciągów `{{`, `undefined`, `null`, `NaN`, `Invalid Date`, pustych miejsc po
      znacznikach.
- [ ] Czy kolejność podpisów jest **wymuszona przez aplikację**, czy tylko opisana w instrukcji.
      Spróbuj podpisać jako notariusz przed spółką.
- [ ] Czy data uchwały o wyborze podmiotu prowadzącego rejestr może być **późniejsza niż data
      umowy** (art. 300³² § 1 w zw. z art. 300³¹ § 5 — umowa zawierana z podmiotem już wybranym).
- [ ] Czy aplikacja przyjmie spółkę, która **nie jest P.S.A.** (podaj KRS spółki z o.o.).
- [ ] Czy aplikacja przyjmie **drugą umowę** o prowadzenie rejestru dla tej samej spółki
      (art. 300³² § 2).
- [ ] Czy da się wpisać akcje **przed datą wpisu spółki do KRS** albo dla emisji bez
      `data_wpisu_krs` (art. 300³⁰ § 2; sankcja karna art. 592 § 3 — to musi być twarda blokada).
- [ ] Czy **bilans akcji** jest kontrolowany na żywo i czy blokuje otwarcie rejestru przy
      niezgodności (art. 300³¹ § 2).
- [ ] Czy informacja z rejestru dla akcjonariusza ma **zamaskowane** PESEL, datę urodzenia
      i adres zamieszkania pozostałych akcjonariuszy (art. 300³⁵ § 1¹).

### Warianty do przejścia po scenariuszu podstawowym

- **S2 — rada dyrektorów zamiast zarządu** (art. 300⁵² § 1). Czy dokumenty adresują właściwy
  organ, czy wszędzie wpisuje się „zarząd"? To najbardziej prawdopodobne miejsce, w którym
  wzór przepisany ze spółki akcyjnej wyprodukuje pismo do organu, który nie istnieje.
- **S3 — akcjonariusz będący osobą prawną.** Czy formularz zbiera dane beneficjenta
  rzeczywistego, czy traktuje osobę prawną jak fizyczną?
- **S4 — akcje nie w pełni pokryte.** Czy aplikacja odnotowuje wzmiankę o pokryciu
  (art. 300³³ § 1 pkt 9) i czy blokuje późniejsze zbycie bez zgody spółki (art. 300⁴⁰ § 1)?
- **S5 — akcje uprzywilejowane i nieme.** Czy pole rodzaju akcji istnieje i czy wpływa na
  liczbę głosów w widoku udziałów?
- **S6 — ułamkowa część akcji.** Utwórz stan 1/3 + 1/3 + 1/3 akcji nr 96. Czy suma się domyka,
  czy da się zapisać 1/2 + 1/2 + 1/2, czy ułamek da się przypisać do zakresu numerów.

**Pokaż: zrzuty każdego kroku, wygenerowane dokumenty, listę znalezisk.**

---

> **AKTUALIZACJA ZASAD SESJI (decyzja Łukasza, po FAZA 1):** ze względu na porę i brak możliwości
> bieżącej akceptacji, wszystkie kolejne fazy (2–7) są zaakceptowane z góry — NIE czekaj na
> potwierdzenie między fazami, przechodź dalej samodzielnie. Pytania nierozstrzygalne bez decyzji
> człowieka zapisuj w `testy-audyt/PYTANIA-DO-LUKASZA.md` (odpowie następnego dnia). Przy większych
> trudnościach (niejasna instrukcja, brak dostępu do zasobu, ryzyko dla środowiska) rozważ koszt i
> zysk dalszego drążenia i podejmij decyzję samodzielnie — udokumentuj ją. Jeżeli znajdziesz coś
> **KRYTYCZNEGO** — wyróżnij to jawnie na początku podsumowania fazy, nie chowaj w środku listy.

## FAZA 2 — opłaty

> Zawyżenie taksy to nie błąd rachunkowy, tylko problem zawodowy. Ta faza ma najwyższy priorytet
> po integralności rejestru.

Stawki maksymalne (`PRZEPISY-PSA.md` sekcja 9, pozycja oznaczona ⚠️ — jeżeli w kodzie widnieją
inne, zgłoś to jako rozbieżność, nie poprawiaj): prowadzenie rejestru **1200 zł** za każdy
rozpoczęty rok, wpis **100 zł**, informacja z rejestru **50 zł**.

- [ ] Czy stawki są w jednym miejscu (`przepisy.js`), czy rozsiane po kodzie.
- [ ] Czy kwoty są **liczbami całkowitymi w groszach**. Poszukaj arytmetyki zmiennoprzecinkowej
      na kwotach — jeden `0.1 + 0.2` w kodzie opłat to błąd na fakturze.
- [ ] **VAT.** Czy aplikacja rozróżnia kwotę netto i brutto? Taksa to kwota netto. Sprawdź, co
      widzi klient, co trafia do zestawienia i czy nie ma podwójnego naliczenia.
- [ ] **Jedno żądanie = jeden wpis = jedna opłata.** Dokonaj wpisu obejmującego przeniesienie
      akcji do trzech nabywców naraz. Czy naliczono 100 zł, czy 300 zł?
- [ ] **Otwarcie rejestru.** Stan otwarcia generuje kilka zdarzeń (emisja, objęcie, uprawnienia,
      ograniczenia). Ile opłat naliczono? → **PYTANIE DO ŁUKASZA:** czy wprowadzenie stanu
      otwarcia to wpisy na żądanie w rozumieniu art. 300³⁴ § 1, czy czynność objęta opłatą za
      prowadzenie rejestru. Zgłoś, jak zachowuje się aplikacja, i nie rozstrzygaj.
- [ ] **Odmowa wpisu.** Czy naliczono opłatę za wpis, którego nie dokonano? Nie powinno.
- [ ] **Zajęcie egzekucyjne** — ujawnienie następuje z urzędu i jest **wolne od opłat**
      (art. 300³⁴ § 2). Sprawdź, że aplikacja nie nalicza niczego i nie wymaga żądania.
- [ ] **Rok rozpoczęty.** Zawrzyj umowę z datą 20 grudnia. Czy naliczono 1200 zł za grudzień
      i kolejne 1200 zł w styczniu? Sprawdź, czy rok liczony jest kalendarzowo, czy od daty
      umowy — i czy jest to konsekwentne w całej aplikacji.
- [ ] Czy naliczenie roczne jest **idempotentne** — uruchom je dwa razy dla tego samego roku.
- [ ] Czy opłata za informację z rejestru nalicza się przy **każdym pobraniu** tego samego
      dokumentu, czy raz za żądanie. Pobierz ten sam dokument trzy razy.
- [ ] Czy gdziekolwiek da się naliczyć kwotę **powyżej stawki maksymalnej** (np. przez ręczną
      korektę bez walidacji).

**Pokaż: zestawienie naliczeń dla wszystkich scenariuszy z fazy 1, z kwotami netto i brutto.**

---

## FAZA 3 — dane osobowe: czy zbieramy właściwe

> Pytanie brzmi nie „czy dane są chronione", tylko „czy każde pole ma podstawę prawną i czy
> nie brakuje pola, którego wymaga ustawa".

- [ ] **Zestaw pól rejestru vs art. 300³³ § 1 pkt 1–11.** Wypisz tabelę: pole w aplikacji →
      punkt katalogu → obowiązkowe / fakultatywne („na żądanie") / spoza katalogu.
- [ ] **PESEL.** Czy jest polem **wymaganym** dla każdego akcjonariusza? W katalogu z art. 300³³
      § 1 pkt 5 PESEL nie występuje — wymaga się nazwiska i imienia albo firmy oraz adresu.
      PESEL bywa potrzebny na podstawie AML albo postanowień umowy spółki (§ 2), ale to **inna
      podstawa przetwarzania**. Sprawdź, czy aplikacja to rozróżnia, czy wymusza PESEL zawsze.
- [ ] **Pozycje „na żądanie"** (pkt 6, 7, 8) — czy aplikacja wpisuje je automatycznie przy okazji
      innego zdarzenia, czy wyłącznie na odrębne żądanie uprawnionego.
- [ ] **Adres e-mail** (pkt 5) — czy wpisywany tylko przy zgodzie akcjonariusza na komunikację
      elektroniczną, czy zawsze. Zgoda ma znaczenie doręczeniowe (art. 300⁸⁷ § 1).
- [ ] **Dane zbierane ponad katalog** — wypisz wszystkie i przypisz im podstawę: AML, umowa
      spółki (§ 2), potrzeba operacyjna. Pola bez podstawy zgłoś jako nadmiarowe.
- [ ] **Dane AML** — czy są oddzielone od danych rejestrowych, czy trafiają do tej samej tabeli
      i tych samych widoków? Przy szerszym niż ustawowy zakresie AML (decyzja Łukasza: emisje
      traktowane jak transakcje) podstawa przetwarzania jest inna niż obowiązek prawny.
- [ ] **Status PEP** — czy jest oświadczeniem osoby, czy polem wypełnianym przez pracownika?
      Powinno być oświadczeniem.
- [ ] **Maskowanie w API, nie w UI.** Zaloguj się jako akcjonariusz A i odpytaj bezpośrednio
      endpoint zwracający dane rejestru. Czy odpowiedź JSON zawiera PESEL, datę urodzenia
      i adres zamieszkania akcjonariusza B? Maskowanie wyłącznie w warstwie widoku to wyciek.
- [ ] Czy w **wygenerowanych dokumentach** maskowanie jest spójne z widokiem ekranowym.
- [ ] Czy **klauzula informacyjna dla akcjonariuszy** w ogóle istnieje w systemie i kiedy jest
      doręczana. Dane akcjonariuszy pozyskujemy od spółki, nie od nich — obowiązek informacyjny
      jest po stronie kancelarii.
- [ ] Czy **dziennik dostępu do danych osobowych** rejestruje odczyty, czy tylko zapisy.

---

## FAZA 4 — podpisy i tożsamość

> Najbardziej prawdopodobna luka prawna całej aplikacji. Test ma rozstrzygnąć, czy aplikacja
> **myli dwie różne rzeczy**: skuteczność umowy i weryfikację tożsamości na potrzeby AML.

- [ ] **Forma umowy.** Art. 300³² nie zastrzega formy szczególnej — skan podpisanej umowy jest
      skuteczny. Sprawdź, czy aplikacja niczego ponad to nie wymaga i czy nie twierdzi w treści
      dokumentów, że wymagany jest podpis kwalifikowany.
- [ ] **Kolejność podpisów.** Czy aplikacja wymusza: spółka → notariusz? Podpis kwalifikowany
      notariusza złożony jako pierwszy ginie przy wydruku i ponownym skanowaniu.
- [ ] **Egzemplarz autorytatywny.** Który plik system traktuje jako wiążący po zakończeniu obiegu?
      Czy jest oznaczony i niemodyfikowalny?
- [ ] **Czy aplikacja weryfikuje podpis kwalifikowany** w odesłanym pliku, czy przyjmuje każdy
      PDF. Jeżeli klient deklaruje podpis kwalifikowany, a wgrywa zwykły skan — czy system to
      wykryje?
- [ ] **Rozdzielenie ścieżek.** Czy w kodzie i w interfejsie widać, że weryfikacja tożsamości
      na potrzeby AML jest **odrębna** od podpisania umowy? Przyjęcie skanu umowy nie jest
      identyfikacją osoby.
- [ ] **Na czym opiera się identyfikacja akcjonariusza** w obecnym prototypie: na danych
      wpisanych przez spółkę w formularzu, na skanie dokumentu tożsamości, na czymś innym?
      Opisz faktyczny stan — bez oceny, czy to wystarcza.
- [ ] Czy istnieje **bramka AML blokująca wpis** i czy da się ją ominąć, wywołując endpoint
      wpisu bezpośrednio.
- [ ] Czy weryfikacja AML ma **datę i termin przeglądu**, czy jest zdarzeniem jednorazowym bez
      dezaktualizacji.
- [ ] Czy aplikacja rozróżnia **osobę fizyczną i prawną** w procedurze AML (beneficjent
      rzeczywisty).

**PYTANIE DO ŁUKASZA:** czy zdalna identyfikacja akcjonariusza wyłącznie na podstawie danych
przekazanych przez spółkę i skanu dokumentu spełnia wymogi środków bezpieczeństwa finansowego,
czy potrzebna jest metoda dająca wyższy poziom pewności (podpis kwalifikowany akcjonariusza,
weryfikacja wideo, przelew referencyjny, stawiennictwo). Wymaga potwierdzenia przy tekście ustawy
AML — pozycja ⚠️ w `PRZEPISY-PSA.md`.

---

## FAZA 5 — bezpieczeństwo i izolacja danych

Wszystko przez bezpośrednie żądania do API, z pominięciem interfejsu.

- [ ] **Dostęp do cudzego rejestru.** Zaloguj się jako akcjonariusz spółki A i podmień
      identyfikator spółki w ścieżce na spółkę B. Powtórz dla każdego endpointu zwracającego
      dane. To najczęstszy i najpoważniejszy błąd aplikacji wielopodmiotowych.
- [ ] **Dostęp do cudzych plików.** Pobierz dokument po identyfikatorze należący do innej spółki.
      Sprawdź też, czy pliki są serwowane bezpośrednio z katalogu statycznego (wtedy znajomość
      nazwy wystarcza do pobrania).
- [ ] **Nadpisanie pól spoza formularza.** Wyślij w treści żądania dodatkowe pola (`rola`,
      `spolka_id`, `aml_status`, `kwota_grosze`, `data_wpisu`). Czy zostaną przyjęte?
- [ ] **Podniesienie uprawnień.** Wywołaj endpointy kancelaryjne z sesją klienta portalu.
- [ ] **Sesja po wylogowaniu.** Wyloguj się i użyj wcześniejszego tokenu.
- [ ] **Wgrywanie plików.** Prześlij plik `.pdf` będący w rzeczywistości skryptem; plik 500 MB;
      plik z nazwą zawierającą `../`.
- [ ] **Komunikaty błędów.** Wywołaj błąd bazy danych i sprawdź, czy odpowiedź zawiera ślad
      stosu, zapytanie SQL albo ścieżki serwera.
- [ ] **Logi.** Sprawdź, czy do logów trafiają dane osobowe albo treść dokumentów.
- [ ] **Liczba prób logowania** — czy istnieje ograniczenie.

---

## FAZA 6 — integralność rejestru

> Jedyna warstwa, której awaria jest nieodwracalna.

- [ ] Spróbuj wykonać `UPDATE` i `DELETE` na `psa_zdarzenia` **bezpośrednio w bazie**. Czy
      wyzwalacze blokują? Jeżeli blokuje wyłącznie kod aplikacji — to nie jest zabezpieczenie.
- [ ] Zmodyfikuj ręcznie jedno zdarzenie w bazie (na kopii) i uruchom weryfikację integralności.
      **Czy wykrywa?** Sprawdź, czy weryfikacja faktycznie przelicza łańcuch, czy zwraca „OK"
      bezwarunkowo.
- [ ] Usuń jedno zdarzenie ze środka łańcucha i powtórz weryfikację.
- [ ] Uruchom **odbudowę stanu ze zdarzeń** i porównaj z materializacją. Muszą być identyczne.
- [ ] **Wyścig.** Wywołaj dwa jednoczesne wpisy dotyczące tych samych akcji. Czy powstaje stan,
      w którym suma akcji nie zgadza się z emisją?
- [ ] **Stan na dzień — granice.** Sprawdź stan na dzień zdarzenia, na dzień przed i po. Dwa
      zdarzenia tego samego dnia muszą dać różne stany w zależności od wskazanego momentu.
      Sprawdź, czy strefa czasowa nie przesuwa granicy doby.
- [ ] **Sprostowanie** — czy tworzy nowe zdarzenie, czy modyfikuje poprzednie.

**WAŻNE — bezpieczeństwo środowiska:** testy niszczące (ręczna modyfikacja/usunięcie zdarzenia
w bazie) rób WYŁĄCZNIE na osobnej KOPII pliku bazy danych, nigdy na bazie współdzielonej z innymi
równolegle działającymi fazami audytu. Skopiuj plik `.db` (i `.db-wal`/`.db-shm` jeśli istnieją,
albo wykonaj checkpoint WAL przed kopiowaniem), otwórz kopię osobnym połączeniem SQLite i tam
przeprowadź manipulację.

---

## FAZA 7 — klasyczne błędy aplikacji generowanych automatycznie

Przejdź celowo, bo te błędy nie ujawniają się w ścieżce głównej:

- [ ] Walidacja **wyłącznie po stronie przeglądarki** — wyślij do API dane odrzucane przez
      formularz (puste pola wymagane, ujemna liczba akcji, data z przyszłości, tekst w polu
      liczbowym, numer KRS o złej długości).
- [ ] **Optymistyczny interfejs** — komunikat o powodzeniu przed potwierdzeniem serwera. Zerwij
      połączenie w trakcie zapisu i sprawdź, co pokazuje aplikacja i co jest w bazie.
- [ ] **Brak idempotencji** — powtórz to samo żądanie zapisu dwa razy.
- [ ] **Puste stany i przypadki brzegowe** — spółka bez akcjonariuszy, emisja o zerowej liczbie
      akcji, akcjonariusz z zerem akcji po przeniesieniu całości, nazwa spółki o długości 300
      znaków, nazwisko z polskimi znakami i apostrofem.
- [ ] **Poczta** — czy wiadomości faktycznie wychodzą, czy tylko są logowane. Czy niepowodzenie
      wysyłki jest widoczne dla pracownika, czy ginie po cichu.
- [ ] **Terminy** — czy licznik 7 dni liczy dni kalendarzowe, czy robocze; jak zachowuje się
      przy zmianie czasu; czy zatrzymanie i wznowienie po usunięciu przeszkody przelicza termin
      od nowa (art. 300³⁴ § 1 zd. 2).
- [ ] **Dane demonstracyjne** — czy w bazie zostały rekordy testowe i czy da się je łatwo
      odróżnić od prawdziwych.
- [ ] **Zależności** — `npm audit`, wersje przypięte czy zakresowe.
- [ ] **Martwe funkcje** — przyciski i widoki, które nic nie robią albo prowadzą do 404.

---

## Format raportu końcowego

Plik `testy-audyt/RAPORT.md`:

1. **Podsumowanie** — trzy zdania: czy ścieżka główna działa, ile znalezisk krytycznych, czy
   aplikacja nadaje się do pilotażu na własnych rejestrach.
2. **Znaleziska** — tabela posortowana po wadze: numer, waga, obszar, jednozdaniowy opis,
   podstawa.
3. **Opis każdego znaleziska** — wg schematu z zasad sesji, z żądaniem/odpowiedzią lub zrzutem.
4. **Tabela pokrycia** — reguły domenowe ze specyfikacji vs stan faktyczny.
5. **Zestawienie opłat** — wszystkie naliczenia ze scenariuszy testowych, netto i brutto.
6. **Inwentaryzacja danych osobowych** — pole → podstawa prawna → obowiązkowe/fakultatywne.
7. **PYTANIA DO ŁUKASZA** — osobna lista, ponumerowana, każde z wariantami odpowiedzi.
8. **Czego nie udało się przetestować** i dlaczego.

Nie proponuj poprawek w raporcie. Opis problemu wystarczy.
