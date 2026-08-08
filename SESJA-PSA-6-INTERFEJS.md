# Sesja Claude Code — PSA sprint 6: interfejs od podstaw

> **Pliki kontekstu:** `CLAUDE-PSA.md`, `PRZEPISY-PSA.md` (jedyne źródło prawne),
> `WYTYCZNE-MERYTORYCZNE-PSA.md`, `README.md` repozytorium.
>
> **`design.css` NIE obowiązuje w tym module.** Jest kanonem dla wewnętrznych modułów kancelarii
> (Kalkulator, Kasa, Weryfikator). Rejestr akcjonariuszy to **produkt publiczny**, który widzą
> zarządy spółek i inwestorzy i który konkuruje z aplikacjami domów maklerskich — dostaje własną
> tożsamość wizualną w pliku `public/rejestr.css`. Wspólna zostaje tylko rodzina szeryfowa,
> jako cichy łącznik z resztą systemu kancelarii.
>
> Moduł działa (sprinty 1–5). Ta sesja **nie zmienia logiki domenowej** — poza polami, których
> wymaga nowy kreator rejestracji spółki (faza 3).

---

## 1. Brief

**Przedmiot:** rejestr akcjonariuszy prostej spółki akcyjnej prowadzony przez notariusza.
**Odbiorcy:** pracownik kancelarii obsługujący do ośmiu wpisów dziennie przy 500 rejestrach;
zarząd spółki i akcjonariusze zaglądający kilka razy w roku.
**Zadanie ekranu głównego:** wiedzieć, co ma termin, i wejść w to jednym kliknięciem.
**Zadanie kokpitu spółki:** zobaczyć, kto ma które akcje — dziś albo w dowolnym dniu przeszłości.

**Materiał, z którego wyrasta projekt.** Rejestr nie jest listą osób. Jest **zbiorem przedziałów
liczb całkowitych rozłożonym w czasie**: akcje 1–100 to ciągła oś, własność to odcinki na tej osi,
a zdarzenia rejestrowe to momenty, w których odcinki się dzielą, łączą i zmieniają właściciela.
Każdy system na rynku — łącznie z naszym prototypem — pokazuje to jako tabelę. Tabela gubi obie
rzeczy, które są w tych danych najciekawsze: **ciągłość numeracji i ruch w czasie**.

---

## 2. Plan projektu

### 2.1. Paleta

Odchodzimy od kremowej bieli i burgundu. Nowa paleta wyrasta z dwóch przedmiotów ze świata
notariatu i papierów wartościowych: **mosiężnej tabliczki na drzwiach kancelarii** oraz **zieleni
druku zabezpieczonego**, którą od XIX wieku drukowano akcje i obligacje.

```
--atrament    #14181C   tekst główny, linie osi
--atrament-2  #565E68   tekst drugorzędny
--atrament-3  #8A929C   etykiety, wyciszone
--papier      #F6F7F5   tło aplikacji (chłodna biel, NIE krem)
--karta       #FFFFFF   powierzchnie
--linia       #E3E5E1   linie, siatka
--rejestr     #1F4D3D   kolor instytucjonalny: stan aktywny, przycisk główny, pasma wykresu
--rejestr-2   #2E6B54   hover, druga warstwa
--rejestr-tlo #E8EFEA   delikatne tła
--mosiadz     #A97C3F   „teraz", playhead, termin, obciążenia
--mosiadz-tlo #F5EDE0
--sygnal      #A32B22   po terminie, odmowa, akcje destrukcyjne — NIC więcej
```

Zasada: **jeden kolor = jedno znaczenie w całej aplikacji.** Zieleń nigdy nie oznacza „sukces",
tylko „rejestr". Mosiądz nigdy nie oznacza „błąd", tylko „czas". Czerwień wyłącznie po terminie
i przy odmowie.

### 2.2. Typografia — trzy role, trzy kroje

| Rola | Krój | Zastosowanie |
|---|---|---|
| Display | **EB Garamond** (zostaje z systemu kancelarii) | wyłącznie nazwy spółek i tytuły ekranów |
| Interfejs | **Inter Tight** | wszystko pozostałe: nawigacja, etykiety, przyciski, treść |
| Dane | **IBM Plex Mono** | numery i serie akcji, KRS, NIP, daty w tabelach, skróty łańcucha |

Wszystkie z Google Fonts, `display=swap`, podzbiór `latin-ext`.

**Numery akcji zawsze w monie.** `AZ 96–100` to identyfikator, nie liczba — w monie ustawia się
w kolumnie i da się porównać wzrokiem. Ilości i procenty: Inter Tight z `tabular-nums`.
W zakresach półpauza, nie dywiz.

Skala stopni: 40 / 28 / 20 / 15 / 13 / 11 px. Skala odstępów: 4 / 8 / 12 / 16 / 24 / 40 / 64.
**Nic spoza tych dwóch list.**

### 2.3. Układ

Koniec z treścią przyklejoną do lewej krawędzi przy pustej prawej połowie ekranu.

- **Szyna nawigacji 220 px**: grupy wersalikami 11 px, stan aktywny to zielony pasek 2 px na lewej
  krawędzi pozycji plus pogrubienie — **nie** wypełnione tło.
- **Treść wyśrodkowana**, `max-width: 1240px`, `margin-inline: auto`, wewnętrzny margines 40 px.
- **Paleta poleceń `Ctrl/⌘+K`** — przy 500 rejestrach wpisanie nazwy spółki jest szybsze niż
  jakakolwiek lista. Wyszukuje spółki, osoby i sprawy, uruchamia „nowe zdarzenie".
- Nagłówek strony bez belki na całą szerokość: tytuł serifem, pod nim jedno zdanie kontekstu,
  akcje po prawej. Bez powtarzania nazwy modułu na każdym ekranie.

### 2.4. Element sygnaturowy — oś akcji

To ma być rzecz, którą zapamiętuje każdy, kto zobaczy tę aplikację, i której nie ma nikt na rynku.

**Wykres o dwóch osiach: numer akcji (pionowo) × czas (poziomo).** Własność to poziome pasma.
Pasmo zaczyna się w dniu zdarzenia, które je utworzyło, i kończy w dniu, w którym akcje zmieniły
właściciela. Przy przeniesieniu pasmo się rozszczepia, przy emisji dochodzi nowy zakres u góry,
przy umorzeniu pasmo się urywa i pole zostaje puste.

```
  nr akcji
   100 ┤        ┌──────────────── Grabska (96–100) ─────────
       │        │
    96 ┤━━━━━━━━┥
       │
       │  Grabski (1–95)
     1 ┤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       └────┬────────┬─────────────────────────┬──────────►
        emisja   przeniesienie              ▮ dziś        czas
                                        (playhead)
```

- Pasma w zieleni `--rejestr`, każdy akcjonariusz w innym stopniu jasności **tej samej zieleni** —
  nie w tęczy kolorów. Obciążenia i zajęcia: ukośne kreskowanie mosiądzem nałożone na pasmo.
  Akcje nieobjęte: puste pole z siatką.
- Pozycje ułamkowe: pasmo o wysokości jednej akcji, podzielone pionową kreską proporcjonalnie
  do ułamka, z etykietą `1/3 akcji nr 96`.
- Najechanie: akcjonariusz, zakres, liczba akcji, zdarzenie początkowe.
- Kliknięcie: przewinięcie do wiersza w tabeli pod wykresem.
- Powyżej 40 pasm wykres agreguje najmniejsze w jedno pasmo „pozostali" z rozwinięciem.

**Czysty SVG.** Bez bibliotek wykresów.

### 2.5. Suwak — playhead na osi czasu

Suwak zostaje, ale przestaje być doklejonym elementem sterującym i staje się **częścią wykresu**:
pionową mosiężną linią, którą przeciąga się po osi czasu tego samego wykresu, na który się patrzy.

Dlaczego to naprawia migotanie: **playhead zatrzaskuje się na datach zdarzeń.** Między zdarzeniami
stan rejestru się nie zmienia, więc pozycji pośrednich nie ma po co renderować. Suwak ma tyle
położeń, ile spółka ma zdarzeń — przy dwóch zdarzeniach dwa położenia, nie tysiąc pikseli.
Stan przelicza się przy zatrzaśnięciu, nie przy każdym ruchu myszy.

- Znaczniki zdarzeń na osi jako mosiężne kropki z etykietami dat.
- ←/→ przesuwają o jedno zdarzenie, `Home`/`End` na początek i koniec.
- Obok osi **pole daty** (wzorzec z 2.6) do wskazania dowolnego dnia — playhead przeskakuje wtedy
  do ostatniego zdarzenia przed tą datą.
- **Bez pola godziny.** W warstwie danych porównanie idzie po `data_wpisu` (DATETIME), a wybór dnia
  oznacza jego koniec — kolejność wpisów z tego samego dnia zostaje zachowana, a użytkownik nie
  widzi zbędnego pola.
- **Wysokość wykresu i tabeli stała**, niezależna od stanu — układ nie może skakać przy
  przewijaniu playheadu. Kontener tabeli rezerwuje miejsce na maksymalną liczbę wierszy
  w widocznym oknie.
- Gdy playhead nie stoi na „dziś": pigułka **„Stan na 12 marca 2026"** w nagłówku kokpitu
  z przyciskiem powrotu, tło treści przechodzi na `--mosiadz-tlo` w słabym natężeniu,
  **przyciski akcji znikają z DOM** (nie `disabled`).
- `prefers-reduced-motion`: brak przejść, natychmiastowa zmiana stanu.

### 2.6. Pola — projekt od nowa

**Daty.** Pole segmentowe `DD.MM.RRRR`: trzy sekcje, automatyczne przejście między nimi, tylko
cyfry, obsługa wklejenia w dowolnym separatorze, strzałki góra/dół zmieniają wartość sekcji.
Obok mały przycisk kalendarza otwierający popover z miesiącem — kalendarz **nie otwiera się sam**
przy fokusie. Etykieta zawsze nad polem, nigdy jako placeholder. Pod polem, po wpisaniu, **data
słownie** („12 marca 2026") jako potwierdzenie, że system zrozumiał wpis. Pigułki „dziś"
i „wczoraj" przy dacie zdarzenia.

**Liczby akcji i kwoty.** Wyrównane do prawej, w monie, separator tysięcy wstawiany na bieżąco,
jednostka jako sufiks wewnątrz pola (`akcji`, `zł`), nie jako osobna etykieta.

**Pola tekstowe.** Etykieta nad polem, obramowanie 1 px `--linia`, promień 8 px, fokus:
obramowanie `--rejestr` plus cień 3 px w zieleni 10 %. Komunikat błędu pod polem mówi, co
poprawić; pole nie czyści się przy błędzie.

**Wybór z kartoteki.** Podpowiedzi od trzeciego znaku; wynik pokazuje nazwisko, zamaskowany PESEL
i liczbę spółek, w których osoba już występuje. Dodanie nowej osoby bez opuszczania formularza.

### 2.7. Tabele

- Nagłówek przyklejony przy przewijaniu, tło pełne (nie przezroczyste).
- Wiersz 44 px, bez pasków zebry — rozdziela linia `--linia` 1 px.
- Cały wiersz jest odnośnikiem; bez menu kontekstowych i przycisków w wierszu.
- Kolumny liczbowe do prawej, w monie. Sortowanie po kliknięciu nagłówka.
- Brak wyników: zdanie mówiące co zrobić plus przycisk, nie „Brak danych".

### 2.8. Ruch

Trzy animacje w całej aplikacji, nic poza nimi:
1. przejście pasm na osi akcji przy zmianie playheadu (180 ms, `ease-out`),
2. wysunięcie szczegółu wiersza (140 ms),
3. pojawienie się palety poleceń (120 ms).

---

## 3. Fazy

### FAZA 1 — system wizualny i powłoka ⛔ STOP

- `public/rejestr.css`: tokeny z 2.1, skale z 2.2, komponenty bazowe (przycisk, pole, karta,
  tabela, pigułka, modal, pusty stan). **Zero wartości spoza skal.**
- Powłoka: szyna nawigacji, wyśrodkowany kontener, nagłówek strony, paleta poleceń `Ctrl/⌘+K`.
- Pola z 2.6 jako komponenty wielokrotnego użytku — **najpierw one, potem ekrany**.
- Wygaszenie `design.css` w tym module.
- Kontrola: `grep -E "#[0-9a-fA-F]{3,6}"` w plikach modułu zwraca wyłącznie definicje tokenów.

**Pokaż:** zrzuty powłoki oraz strony `/podglad` z wszystkimi komponentami w stanach domyślnym,
hover, fokus, błąd i wyłączony; wynik `grep`; zielone testy.

### FAZA 2 — kokpit spółki i oś akcji ⛔ STOP

Układ dwukolumnowy: po lewej oś akcji i tabela akcjonariatu, po prawej przyklejona **metryka
rejestru** — KRS, sąd, data wpisu do KRS, data umowy o prowadzenie rejestru, kto ją zawarł,
status łańcucha zdarzeń, najbliższe terminy.

```
┌─────────────────────────────────────────────────┬──────────────────┐
│ HERMES DATA & SOFTWARE SOLUTIONS P.S.A.         │ METRYKA REJESTRU │
│ Rejestr prowadzony od 26.07.2024                │ KRS 0001114217   │
│                                    [Nowe zdarz.]│ Wpis do KRS      │
├─────────────────────────────────────────────────┤ 21.06.2024       │
│  ┌───────────────────────────────────────────┐  │ Umowa 26.07.2024 │
│  │            OŚ AKCJI (SVG)              ▮  │  │ zawarł: notariusz│
│  └───────────────────────────────────────────┘  │                  │
│  ◄ ●────────●──────────────────────●──► [data]  │ Łańcuch zdarzeń  │
│    emisja  przeniesienie         dziś           │ nieprzerwany (2) │
├─────────────────────────────────────────────────┤ sprawdzono 10:46 │
│  [uproszczony] [szczegółowy]        100 akcji   │                  │
│  AKCJONARIUSZ      SERIA  ILOŚĆ  NUMERY   UDZIAŁ│ Terminy          │
│  Grabski Jędrzej   AZ        95   1–95     95 % │ brak w toku      │
│  Grabska Izabella  AZ         5   96–100    5 % │                  │
├─────────────────────────────────────────────────┤                  │
│  ▸ Emisje  ▸ Uprawnienia  ▸ Obciążenia  ▸ Historia                 │
└─────────────────────────────────────────────────┴──────────────────┘
```

- Przełącznik **uproszczony / szczegółowy**: uproszczony to jeden wiersz na akcjonariusza (widok,
  który spółka pokaże inwestorowi); szczegółowy to wiersz na zakres numerów, z obciążeniami
  i uprawnieniami.
- Sekcje pod tabelą domyślnie zwinięte poza Historią.

**Pokaż:** kokpit w obu widokach, oś akcji z obciążeniem, z akcjami nieobjętymi i z pozycją
ułamkową, playhead w trzech położeniach, dowód braku migotania i braku skoków układu.

### FAZA 3 — rejestracja spółki od nowa ⛔ STOP

Spółka w chwili powstania **ma już akcje**. Formularz musi to odzwierciedlać.

**Import z KRS — rozszerzony.** Otwarte API Ministerstwa Sprawiedliwości zwraca aktualny odpis
w JSON (dane osobowe zanonimizowane — nam to nie przeszkadza, danych akcjonariuszy z KRS nie
bierzemy). Pobieramy: firmę, formę prawną (**walidacja: musi być P.S.A.**), siedzibę i adres,
NIP, REGON, sąd i wydział, **datę rejestracji w KRS**, datę ostatniego wpisu, **adres e-mail**,
**adres do doręczeń elektronicznych**, **kapitał akcyjny**, skład organu reprezentującego.

⚠️ **Pierwszym krokiem fazy jest pokazanie surowego JSON-a dla realnej P.S.A. wraz z mapowaniem
pól** — nie zakładaj struktury odpowiedzi. Sprawdź w szczególności adres do doręczeń
elektronicznych, kapitał akcyjny oraz to, czy odpis zawiera liczbę akcji. Brak pola = wpis ręczny.
Awaria API nie blokuje rejestracji, tylko przełącza formularz w tryb ręczny.

**Cztery kroki:**

1. **Spółka** — numer KRS, import, podgląd z możliwością korekty każdego pola.
2. **Umowa o prowadzenie rejestru** — data uchwały akcjonariuszy, data umowy, **kto ją zawarł**
   (notariusz / zastępca / osoba upoważniona; przy zastępcy imię i nazwisko — wymagane
   w zgłoszeniu do KRS), skany, data otwarcia rejestru. Tu również **ograniczenia z umowy spółki**,
   bez których art. 300³⁴ § 6 jest niewykonalny: zgoda spółki na zbycie (termin wskazania nabywcy,
   cena, termin zapłaty — **brak kompletu oznacza brak ograniczenia**), prawo pierwszeństwa, zakaz
   prawa głosu zastawnika, ograniczenia dziedziczenia, dodatkowe informacje ujawniane w rejestrze
   (art. 300³³ § 2).
3. **Pierwsza emisja i akcjonariat** — krok obowiązkowy: seria, numer początkowy, liczba akcji,
   cena emisyjna, data emisji, **data wpisu emisji do KRS**, **rodzaj akcji** (zwykłe /
   uprzywilejowane / założycielskie / nieme — art. 300³³ § 1 pkt 4), uprawnienia szczególne,
   obowiązki wobec spółki (pkt 11), akcjonariusze obejmujący akcje z liczbą akcji (numery
   przydziela aplikacja i pokazuje do potwierdzenia), **wzmianka o pokryciu** per akcjonariusz
   (pkt 9), a przy wkładzie w postaci pracy lub usług — rodzaj i czas świadczenia.
   Kontrola bilansu widoczna na żywo, blokuje przejście dalej.
   **NIE dodawać pola „akcje imienne / na okaziciela" ani „wartość nominalna" — w P.S.A. te
   kategorie nie istnieją.**
4. **Weryfikacja** — checklista w tym samym wzorcu co przy zdarzeniach; przycisk otwarcia rejestru
   nieaktywny do odhaczenia wszystkich pozycji:
   - [ ] forma prawna potwierdzona jako prosta spółka akcyjna
   - [ ] spółka wpisana do KRS, data wpisu ustalona
   - [ ] uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr, skan wgrany
   - [ ] umowa o prowadzenie rejestru podpisana, skan wgrany, wskazany podpisujący
   - [ ] spółka nie ma innej aktywnej umowy o prowadzenie rejestru
   - [ ] dane z umowy spółki przeniesione: seria, numery, uprzywilejowanie, cena emisyjna, wkłady
   - [ ] ograniczenia w rozporządzaniu akcją wprowadzone
   - [ ] bilans akcji zgadza się z liczbą wyemitowanych
   - [ ] umowa spółki nie wymaga ujawniania danych, których system nie obsługuje
   - [ ] ustalono zakres AML wobec osób podlegających wpisowi

Otwarcie rejestru zapisuje komplet zdarzeń w jednej transakcji, z zachowaniem append-only
i łańcucha skrótów.

**Kreator zdarzenia** — ten sam język wizualny: kafelki z **rozdzielonym** tytułem i opisem (dziś
zlewają się w „Spółka wyemitowała nową serię akcjiEmisja"), stała wysokość, kategoria jako pigułka
w rogu. Krok końcowy: **oś akcji przed i po** oraz tabela zmian.

**Pokaż:** surowy JSON z KRS z mapowaniem, wszystkie cztery kroki, zapis kompletu zdarzeń,
weryfikację łańcucha po zapisie.

### FAZA 4 — szablony dokumentów i raport ⛔ STOP

**Szablony** (`psa_szablony`, wersjonowane, edytowalne przez admina; składnia `{{klucz}}`,
`{{klucz_slownie}}`, `{{#lista}}…{{/lista}}`; podgląd przed wydaniem; ślad w
`psa_wydane_dokumenty`; brak edycji po wydaniu):

| Dokument | Podstawa |
|---|---|
| Zawiadomienie o wpisie — do żądającego | 300³⁴ § 7 |
| Zawiadomienie o wpisie — do spółki, z listą akcjonariuszy w załączeniu | 300³⁴ § 7 |
| **Lista akcjonariuszy do złożenia w sądzie rejestrowym** | 300³⁴ § 8 |
| Powiadomienie o treści zamierzonego wpisu | 300³⁴ § 3 |
| Wezwanie do usunięcia przeszkody | 300³⁴ § 1 |
| Zawiadomienie o odmowie wpisu | 300³⁴ § 7 zd. 2 |
| Zawiadomienie o sporze — wskazanie drogi sądowej | wykładnia |
| Informacja z rejestru: dla spółki / dla akcjonariusza / dla organu | 300³⁵ § 3 |
| Umowa o prowadzenie rejestru | — |
| Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr | 300³¹ § 5 |
| Oświadczenie zarządu o zawarciu umowy | 300³² § 1³ 🔵 |
| Lista uprawnionych do udziału w walnym zgromadzeniu | 300⁹¹ |

W opisie technicznego sposobu prowadzenia rejestru w szablonie umowy umieść akapit o mechanizmie
integralności (dziennik zdarzeń bez możliwości edycji, każde zdarzenie powiązane skrótem
z poprzednim) — to realizacja obowiązku z art. 300³¹ § 4.

**Raport z rejestru.** Wzorzec do pobicia: obecny wydruk z systemu zewnętrznego. Jego **struktura
zostaje** (spółka → organ prowadzący → uprawnienia → emisje → akcjonariusze na dzień), wykonanie
idzie na poziom dokumentu kancelaryjnego:

- nagłówek: **logo Notariatu Rzeczypospolitej** i **logo Izby Notarialnej w Gdańsku**, tytuł
  serifem, dane kancelarii jako podmiotu prowadzącego rejestr, data i godzina sporządzenia;
- sekcje oddzielone nagłówkami serifem na tle `--rejestr-tlo`, zamiast niebieskich belek;
- tabela akcjonariuszy z kolumną udziału procentowego; wiersze obciążone z pigułką; pozycje
  ułamkowe zapisane jako `1/3 akcji nr 96`;
- stopka: podstawa prawna, oznaczenie, że dokument stanowi informację z rejestru w rozumieniu
  art. 300³⁵ § 3 KSH, numeracja stron, miejsce na podpis;
- **oś akcji nie trafia na wydruk** — kreskowanie ginie na druku czarno-białym;
- eksport roboczy XLSX/CSV z obowiązkowym dopiskiem, że **nie stanowi informacji z rejestru
  w rozumieniu art. 300³⁵ KSH**;
- `@page { margin: 0 }`, margines przez padding, `print-color-adjust: exact`,
  `document.title` = `Rejestr <nazwa spółki> <RRRR-MM-DD>`.

⚠️ **Pliki logotypów dostarcza Łukasz** — nie generować, nie odtwarzać, nie pobierać z sieci.
Do czasu dostarczenia: placeholdery o właściwych proporcjach.

**Pokaż:** wszystkie szablony z danymi testowymi, raport w trzech wariantach, porównanie
z obecnym wydrukiem, pełny wynik testów, brak błędów w konsoli.

---

## 4. Czego NIE robić

- Nie wracać do kremowego tła, burgundu ani do `design.css` — ten moduł ma własną tożsamość.
- Nie dodawać pola „akcje imienne / na okaziciela" ani „wartość nominalna akcji".
- Nie zmieniać logiki domenowej, walidacji blokujących, arytmetyki ułamków ani maskowania danych.
- Nie dotykać `psa_zdarzenia` — append-only, łańcuch skrótów nienaruszony.
- Nie dodawać zależności: bibliotek UI, wykresów, kalendarzy, ikon, PDF, bundlera, TypeScriptu.
  Wykres i kalendarz piszemy sami.
- Nie kolorować pasm wykresu tęczą — jeden odcień, różne jasności.
- Nie przeliczać stanu przy każdym ruchu playheadu — wyłącznie przy zatrzaśnięciu na zdarzeniu.
- Nie generować ani nie pobierać logotypów samorządu notarialnego.
- Nie opierać reguł prawnych na źródłach innych niż `PRZEPISY-PSA.md`.
- Nie zostawiać czerwonych testów po żadnej fazie.
