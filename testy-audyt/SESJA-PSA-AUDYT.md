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
