# Czcionki wbudowane w dokumenty PDF

Aplikacja osadza te pliki w każdym generowanym PDF-ie. Leżą w repozytorium,
a nie są brane z systemu, z tego samego powodu, dla którego React jest
serwowany z `publiczne/vendor` zamiast z CDN: dokument ma wyglądać tak samo
niezależnie od tego, co jest zainstalowane na serwerze kancelarii.

| Plik | Krój |
|---|---|
| `LiberationSerif-Regular.ttf` | tekst dokumentu |
| `LiberationSerif-Bold.ttf` | nagłówki i wyróżnienia |

**Dlaczego Liberation Serif.** Ma pełny komplet polskich znaków i metryki
zgodne z Times New Roman — tym samym krojem, którym złożone są wzory `.docx`
w katalogu wyżej. Dokument w PDF i ten sam dokument w Wordzie wyglądają więc
tak samo.

**Licencja.** SIL Open Font License 1.1 (Copyright © 2012 Red Hat, Inc.,
Reserved Font Name „Liberation"). Licencja pozwala na redystrybucję,
w tym osadzanie w dokumentach. Pełny tekst: <https://scripts.sil.org/OFL>.
