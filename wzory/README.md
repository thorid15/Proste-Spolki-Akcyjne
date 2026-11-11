# Wzory pism

Każde pismo rejestru powstaje z jednego pliku Markdown w tym katalogu; wynik to zawsze PDF.
Wygląd (krój z polskimi znakami, marginesy, nagłówek z danymi kancelarii, stopka z numerem pisma
i numerem strony, bloki podpisów) jest wspólny i zdefiniowany w `server/logika/wzory.js` — wzór
zawiera tylko treść. Podgląd wszystkich wzorów z danymi próbnymi: `npm run wzory` (PDF-y trafiają
do `wzory/podglad/`).

| Plik | Pismo |
|---|---|
| `umowa.md` | Umowa o prowadzenie rejestru akcjonariuszy (z załącznikiem RODO) |
| `uchwala.md` | Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr |
| `zgoda-email.md` | Zgoda na korespondencję e-mail |
| `powiadomienie-zamierzony.md` | Powiadomienie o zamierzonym wpisie |
| `powiadomienie-wpis.md` | Powiadomienie o wpisie (egzemplarz spółki z listą akcjonariuszy do KRS) |
| `powiadomienie-odmowa.md` | Powiadomienie o odmowie wpisu albo zawarcia umowy |
| `wezwanie.md` | Wezwanie do uzupełnienia |
| `informacja.md` | Informacja z rejestru akcjonariuszy |

## Składnia

| Zapis | Znaczenie |
|---|---|
| `{{pole}}` | wartość pola |
| `{{#lista pozycje}}…{{/lista}}` | powtórzenie dla każdej pozycji (wewnątrz widać pola pozycji i pola zewnętrzne) |
| `{{#jesli pole}}…{{/jesli}}`, `{{#jesli !pole}}…{{/jesli}}` | fragment tylko, gdy pole jest (nie jest) ustawione |
| `#`, `##`, `###` | tytuł, nagłówek wyśrodkowany, nagłówek sekcji |
| `**tekst**`, `*tekst*` | pogrubienie, kursywa |
| wiersz zakończony `\` | złamanie wiersza w akapicie |
| `- `, `1. `, `1) `, `a) ` | pozycja listy (wcięcie o 2 spacje = poziom niżej) |
| `\| A \| B \|` + `\|---\|--:\|` | tabela; `--:` wyrównuje kolumnę do prawej |
| `---` | nowa strona |
| `[podpis: Za Spółkę \| Za Notariusza]` | blok podpisów |

Znacznik bloku sam w wierszu znika razem z wierszem. Pole bez wartości zostaje w treści jako
`{{pole}}` — test `testy/wzory-pisma.test.js` sprawdza, że żaden wzór nie ma pustych pól.
Dane próbne do podglądu i testów: `wzory/dane-probne.json`.
