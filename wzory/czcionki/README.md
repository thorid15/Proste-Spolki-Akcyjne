# Czcionki wbudowane w dokumenty PDF

Aplikacja osadza te pliki w każdym generowanym PDF-ie. Leżą w repozytorium,
a nie są brane z systemu, z tego samego powodu, dla którego React jest
serwowany z `publiczne/vendor` zamiast z CDN: dokument ma wyglądać tak samo
niezależnie od tego, co jest zainstalowane na serwerze kancelarii.

| Plik | Krój |
|---|---|
| `LiberationSerif-Regular.ttf` | tekst dokumentu |
| `LiberationSerif-Bold.ttf` | nagłówki i wyróżnienia |
| `LiberationSerif-Italic.ttf` | kursywa we wzorach (`*tekst*`) |
| `EBGaramond12-Regular.otf` | informacja z rejestru — tytuł i tytuły sekcji |
| `Inter-Regular.otf`, `Inter-SemiBold.otf` | informacja z rejestru — treść, tabele, wyróżnienia |

**Informacja z rejestru** ma własny wygląd (D-181): te same kroje co aplikacja
(`publiczne/style/rejestr.css`) — EB Garamond i Inter (w aplikacji Inter Tight;
w PDF Inter, bo pliki aplikacji to podzbiory WOFF2 bez kompletu polskich znaków w jednym pliku).

**Dlaczego Liberation Serif.** Ma pełny komplet polskich znaków i metryki
zgodne z Times New Roman — krojem, którym kancelaria składała dotąd te pisma.

**Licencja.** Wszystkie trzy kroje — SIL Open Font License 1.1: Liberation
(© 2012 Red Hat, Inc., Reserved Font Name „Liberation"), EB Garamond (© 2010–2012
Georg Duffner), Inter (© 2016–2023 The Inter Project Authors). Licencja pozwala na
redystrybucję, w tym osadzanie w dokumentach. Pełny tekst: <https://scripts.sil.org/OFL>.
