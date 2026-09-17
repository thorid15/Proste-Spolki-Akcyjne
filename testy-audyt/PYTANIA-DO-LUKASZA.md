# Pytania do Łukasza — log narastający

> Rzeczy nierozstrzygalne bez decyzji człowieka podczas audytu. Dopisywać na końcu, nie zmieniać
> numeracji wcześniejszych wpisów.

## P-001 — Czy przy wpisie transakcyjnym dotyczącym akcjonariusza-osoby prawnej wymagamy
identyfikacji beneficjenta rzeczywistego?

- **Kontekst:** `psa_osoby.beneficjent_rzeczywisty_id` istnieje w schemacie i ma poprawną walidację
  krzyżową (musi wskazywać osobę fizyczną, tylko dla `typ='prawna'`), ale pole jest **w pełni
  opcjonalne** — można zapisać i przyjąć akcjonariusza-osobę prawną bez żadnego beneficjenta
  rzeczywistego, bez jakiegokolwiek ostrzeżenia (nawet miękkiego, nieblokującego). Patrz
  `testy-audyt/ZNALEZISKA.md` Z-053.
- **Dlaczego nie rozstrzygnąłem sam:** `PRZEPISY-PSA.md` sekcja 9 („AML i taksa") oznacza całą
  podstawę AML jako ⚠️ — niepotwierdzoną przy tekście ustawy — a sekcja 13 tego pliku wprost
  zabrania, by pozycje ⚠️ były podstawą blokady w systemie do czasu weryfikacji.
  `WYTYCZNE-MERYTORYCZNE-PSA.md` sekcja 7 dodatkowo zawęża definicję „klienta" AML do
  akcjonariusza/zastawnika/użytkownika **podlegającego wpisowi w związku z konkretną transakcją** —
  nie każdego akcjonariusza od razu przy otwarciu rejestru.
- **Pytanie:** czy przy zdarzeniu transakcyjnym (np. `przeniesienie` na rzecz osoby prawnej) system
  powinien choćby ostrzegać (nie blokować), gdy nabywca-osoba prawna nie ma wskazanego beneficjenta
  rzeczywistego? Jeśli tak — jaka jest jednostka redakcyjna ustawy AML uzasadniająca ten wymóg (do
  wpisania do `PRZEPISY-PSA.md`, żeby reguła miała podstawę)?

## P-002 — Czy akcja `rodzaj_akcji = "niema"` ma być automatycznie pozbawiona prawa głosu, czy
zależy to wyłącznie od treści umowy spółki (której dziś system nie ewidencjonuje)?

- **Kontekst:** testy wariantu S5 (patrz `testy-audyt/ZNALEZISKA.md` Z-055) pokazały, że pole
  `psa_emisje.rodzaj_akcji` (`zwykla`/`uprzywilejowana`/`zalozycielska`/`niema`) jest dziś czystą
  etykietą wyświetlaną w rejestrze — nie wpływa na liczbę głosów w żadnym generowanym dokumencie
  (np. uchwale akcjonariuszy, wzór 03/08). Kod wprost dokumentuje to jako świadome uproszczenie
  (`server/logika/kontekst-pisma.js:356-360`).
- **Dlaczego nie rozstrzygnąłem sam:** `PRZEPISY-PSA.md` nie zawiera dla P.S.A. odpowiednika
  przepisów o akcji niemej ze spółki akcyjnej (art. 351–352 KSH), które wprost pozbawiają ją prawa
  głosu — a sekcja 12 pkt 5 tego pliku wyraźnie zakazuje stosowania przepisów o S.A. przez analogię
  tam, gdzie Dział IA nie zawiera odesłania. Art. 300²³ § 1 KSH mówi tylko „akcja daje prawo do
  jednego głosu" — nie różnicuje wprost akcji zwykłej i niemej.
- **Pytanie:** czy w P.S.A. skutek „akcja niema = bez głosu" wynika wprost z ustawy (i z jakiej
  jednostki redakcyjnej — do dopisania w `PRZEPISY-PSA.md`), czy zależy wyłącznie od odrębnego
  postanowienia UMOWY SPÓŁKI (analogicznie do `zakaz_glosu_zastawnika_umowa` już istniejącego w
  schemacie)? Jeśli to drugie — system potrzebowałby nowego pola przy emisji/serii (np.
  `pozbawiona_glosu_umowa`), a nie tylko poprawki w liczniku głosów.
