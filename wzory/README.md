# Wzory dokumentów — pliki źródłowe `.docx`

Tu leżą wzory pism, które aplikacja wypełnia danymi z rejestru. Klient dostaje
gotowy plik `.docx` do podpisu — aplikacja nie przerabia go na PDF ani na HTML.

Opis dokumentów: `KATALOG-WZOROW-PSA.md`. Słownik kluczy: `PLACEHOLDERY-PSA.md`.

---

## Jak wgrać wzór

Nazwa pliku zaczyna się od **numeru z katalogu** — to on jest identyfikatorem
typu dokumentu w aplikacji. Reszta nazwy jest dla ludzi i nie ma znaczenia.

```
wzory/
  01-umowa-o-prowadzenie-rejestru.docx
  02-informacja-rodo.docx
  03-uchwala-o-wyborze.docx
  04-zadanie-wpisu.docx
  05-powiadomienie-o-zamierzonym-wpisie.docx
  06-wezwanie-do-usuniecia-przeszkody.docx
  07-zawiadomienie-o-wpisie.docx
  08-lista-akcjonariuszy-do-sadu.docx
  09-zawiadomienie-o-niedokonaniu-wpisu.docx
  10-klauzula-do-umowy-zbycia.docx
```

Podmiana pliku = nowa wersja wzoru. Aplikacja liczy skrót pliku i zapisuje go
przy każdym wydanym dokumencie, więc zawsze wiadomo, z której wersji powstało
pismo sprzed roku. **Starych plików nie trzeba trzymać** — treść wydanego
dokumentu jest zapisana w bazie w całości.

---

## Czego aplikacja oczekuje w treści

Składnia jest ta sama, co w `PLACEHOLDERY-PSA.md`:

| Konstrukcja | Znaczenie |
|---|---|
| `{{klucz}}` | podstawienie wartości |
| `{{klucz_slownie}}` | liczba albo data zapisana słowami |
| `{{#kolekcja}}` … `{{/kolekcja}}` | powtórzenie fragmentu dla każdej pozycji |
| `{{#warunek}}` … `{{/warunek}}` | to samo — sekcja o zero albo jednym elemencie |

### Co dokładnie się powtarza

Word nie ma pojęcia „blok tekstu", więc o jednostce powtórzenia decyduje to,
gdzie postawisz znaczniki. Aplikacja rozpoznaje trzy układy — wszystkie trzy są
używane w obecnych wzorach:

| Gdzie stoją znaczniki | Co się powtarza |
|---|---|
| w **jednym akapicie** — `{{#adresat_spolka}}zarząd spółki{{/adresat_spolka}}` | sam tekst pomiędzy; akapit zostaje |
| w **jednym wierszu tabeli**, w różnych komórkach | cały wiersz `<w:tr>` |
| w **osobnych akapitach**, każdy sam w swojej linii | akapity POMIĘDZY; oba akapity ze znacznikami znikają |

Stąd dwie praktyczne zasady:

- W tabeli wstaw `{{#pozycje}}` na początku **pierwszej** komórki wiersza,
  a `{{/pozycje}}` na końcu **ostatniej**. Gdy oba znajdą się w tej samej
  komórce, powtórzy się tylko tekst, a nie wiersz.
- W tabeli jednokolumnowej rozdziel znaczniki na dwa akapity wewnątrz komórki —
  wtedy powtarza się wiersz.
- Akapit ze znacznikiem `{{#…}}` albo `{{/…}}` ma zawierać **wyłącznie** ten
  znacznik. Treść dopisana obok zniknie razem z nim; aplikacja o tym uprzedza
  w podglądzie.

**Placeholder musi być w jednym kawałku.** Word potrafi rozbić tekst na kilka
fragmentów, gdy w środku wyrazu zmienia się formatowanie albo gdy działał
autokorektor — wtedy `{{spolka_firma}}` staje się `{{spolka_` + `firma}}`
i podstawienie nie zadziała. Dlatego:

- nie formatuj **części** placeholdera (nie pogrubiaj samych klamer),
- nie wstawiaj placeholderów przez autokorektę ani wklejanie ze zmianą stylu,
- najbezpieczniej: wpisz cały placeholder jednym ciągiem, bez zmiany stylu w środku.

Aplikacja **wykrywa rozbite placeholdery** przy wgraniu i mówi, który wzór
i który klucz wymagają poprawki — nie wypuści pisma z niepodstawionym polem.
Przy samym wypełnianiu scala je na tyle, żeby pismo dało się wydać, ale
sygnalizuje to jako ostrzeżenie: wzór lepiej poprawić u źródła.

*Stan na dziś: żaden z dziesięciu wzorów w tym katalogu nie ma rozbitego pola.*

---

## Czego NIE robić

- **Nie wpisywać danych konkretnej spółki ani osoby.** To wzory — wszystko,
  co zmienne, ma być placeholderem. Plik trafia do repozytorium, więc dane
  osobowe w nim nie mogą się znaleźć.
- **Nie zmieniać numeru w nazwie pliku** — po nim aplikacja rozpoznaje typ
  dokumentu i wie, jakimi danymi go wypełnić.
- Nie umieszczać w treści numerów artykułów jako **wartości** placeholderów.
  Indeksy górne (`art. 300³⁴`) zapisuj jako tekst stały wzoru.

---

## Skąd aplikacja bierze wartości

Wszystkie klucze pochodzą z rejestru, z konfiguracji kancelarii albo ze sprawy —
nic nie jest wpisywane ręcznie przy generowaniu pisma. Pełną listę dostępnych
kluczy pokazuje ekran **Konfiguracja → Szablony dokumentów**; tam też jest
podgląd wzoru na danych próbnych, zanim pismo wyjdzie do klienta.

Jeżeli wzór odwołuje się do klucza, którego aplikacja nie zna, podgląd wypisze
go na liście braków. Nic nie znika po cichu — w piśmie o skutkach prawnych puste
miejsce jest groźniejsze niż widoczna dziura.
