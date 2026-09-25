# Faza A — plan i makieta (przeprojektowanie strony publicznej)

Data: 2026-09-25. Podstawa: `SESJA-PSA-STRONA.md` (zastępuje FAZA 5 z `SESJA-PSA-FRONTEND.md`).
Bez zmian w generatorze — wyłącznie plan + statyczna makieta.

## 1. Koncepcja (1-2 zdania)

Strona ma wyglądać jak produkt, nie jak wydruk ustawy: jedna asymetryczna sekcja hero z
„żywym" przykładowym wpisem do rejestru (ożywia abstrakcyjny temat), potem krótkie,
skanowalne bloki (fakty w liczbach, sytuacje do wyboru, kroki), a treść prawna wchodzi
dyskretnie — jako cytat przy twierdzeniu, nie jako osobny wykład.

## 2. Paleta (bez zmian względem `rejestr.css`, bez nowych tokenów)

| Token | Hex | Użycie |
|---|---|---|
| `--atrament` | `#14181C` | tekst główny |
| `--atrament-2` | `#565E68` | tekst drugorzędny |
| `--atrament-3` | `#646C76` | tekst pomocniczy/etykiety |
| `--papier` | `#F6F7F5` | tło strony |
| `--karta` | `#FFFFFF` | tło kart |
| `--linia` | `#E6E8E3` | linie/obwódki |
| `--rejestr` | `#1F4D3D` | akcent główny, przyciski, pas końcowy |
| `--rejestr-2` | `#2E6B54` | hover/warianty |
| `--rejestr-tlo` | `#E8EFEA` | tła odznak |
| `--rejestr-cien-4/5` | `#6BA88C` / `#8FC4AB` | segmenty osi akcji |
| `--mosiadz` | `#8A6330` | wartość po poprawce kontrastu (Faza 1 pkt 10 `SESJA-PSA-FRONTEND.md`), **nie** literalny `#A97C3F` z briefu — użyty tylko punktowo (cytaty prawne) |
| `--mosiadz-tlo` | `#F7EFE2` | tło znacznika cytatu |

## 3. Fonty i skala

- `--font-display` (EB Garamond) — wyłącznie H1 hero i liczby w sekcji „Fakty”.
- `--font-ui` (Inter Tight) — cały pozostały tekst UI.
- `--font-dane` (IBM Plex Mono) — dane z rejestru (karta „żywy wpis”, oś akcji, tabela opłat) —
  celowo odróżnia „dane" od „treści redakcyjnej".
- Skala: H1 44px/1.08 (mobile 32px), H2 28px, H3 18px, body 16px, drobny druk/cytaty 13px.

## 4. Co wyglądało jak domyślny szablon — i co zmieniono

- **Hero jako baner z ikoną i CTA** → zastąpione asymetryczną siatką 7fr/5fr z realną, ożywioną
  kartą danych rejestru zamiast ilustracji/ikony stockowej.
- **Karty funkcji z ikonami** → zastąpione sekcją „Wybierz swoją sytuację" adresowaną do
  4 konkretnych sytuacji czytelnika, każda z jednym CTA — bez generycznych ikon.
- **Lista „zalet" (3 kolumny z checkmarkami)** → zastąpiona wierszem czterech twardych liczb/faktów
  z cytatem artykułu, bo liczby przekonują bardziej niż przymiotniki.
- **Osobna, długa sekcja „o firmie"** → brak; dane kancelarii tylko w stopce i `/kontakt`.
- **Karuzela/testimoniale** → celowo pominięte (brak treści do wypełnienia, ryzyko fikcyjnych opinii).
- **Duży obrazek stockowy w hero** → zastąpiony rzeczywistym artefaktem produktu (przykładowy
  wpis + oś akcji), bo to jedyny „obraz", który coś prawdziwego pokazuje.

## 5. Nowa mapa strony (zastępuje FAZA 5)

`/`, `/jak-zaczac`, `/sprzedaz-akcji`, `/przeniesienie-rejestru`, `/oplaty`, `/pytania`,
`/kontakt`, `/regulamin`, `/polityka-prywatnosci`.

Usunięte względem FAZA 5: `/czym-jest-rejestr-akcjonariuszy`, `/nowelizacja-2027`,
`/zbycie-akcji-i-wpisy`, `/zmiana-podmiotu-prowadzacego-rejestr` (treść tych stron wchodzi do
nowych, skonsolidowana).

## 6. Zrzuty makiety

`frontend-audyt/zrzuty/faza-strona-plan-a/makieta-1440.png` (1440 px)
`frontend-audyt/zrzuty/faza-strona-plan-a/makieta-390.png` (390 px)

Plik makiety: `strona/makieta/index-makieta.html` (samodzielny, nie podpięty do generatora).

## 7. Braki świadome w tej makiecie (do domknięcia w Fazie B)

- Menu mobilne (obecnie po prostu ukryte <900px) — potrzebuje panelu `<details>` lub ~<3KB JS.
- Przyklejony przycisk „Złóż wniosek" na mobile po przewinięciu za hero.
- Cytaty prawne jako `popover`/`popovertarget` (obecnie zwykłe znaczniki tekstowe).
- Generowanie obrazu OG z karty „żywy wpis".
