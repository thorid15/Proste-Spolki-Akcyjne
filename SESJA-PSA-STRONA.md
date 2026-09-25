# SESJA-PSA-STRONA — nowa strona publiczna rejestru akcjonariuszy P.S.A.

> Sesja Claude Code. **Zastępuje Fazę 5 z `SESJA-PSA-FRONTEND.md`** — obecna strona publiczna
> (zbudowana w tej fazie) jest poprawna merytorycznie, ale wygląda jak dokumentacja. Budujesz ją od
> nowa: **prostą, zachęcającą, odpowiadającą na najważniejsze pytania klienta**, nowoczesną i spójną
> wizualnie z portalem klienta.
>
> Pracujesz jako **projektant i frontend developer w małym studiu**, któremu klient odrzucił już
> projekt „z szablonu” i płaci za wyrazisty, przemyślany kierunek. Jeśli w sesji jest skill do
> projektowania stron (np. `frontend-design`), wczytaj go przed Fazą A i stosuj; zasady z sekcji 7
> obowiązują niezależnie od niego.

---

## 1. Diagnoza obecnej strony (zrzuty: `E:\Materiały do rejestru PSA\screeny strona\`)

- Układ dokumentacji: lewa kolumna z 9 pozycjami menu, każda strona to ten sam szablon „nagłówek +
  akapity”. Strony nie różnią się niczym poza tekstem.
- Ściana tekstu: przepis w nawiasie w co drugim zdaniu. Czytelnik szuka odpowiedzi „co mam zrobić i ile
  to kosztuje”, a dostaje wykład.
- Brak odpowiedzi na pytanie „co mam zrobić teraz”: jedyne wezwanie do działania to link „Zaloguj się
  do portalu” na dole i przycisk w nagłówku. Nie ma „Złóż wniosek”.
- „Jak zacząć — trzy kroki” to jeden akapit z numerami w tekście; proces nie jest pokazany jako proces.
- Ceny tylko pod odnośnikiem; na stronie „Opłaty” widoczny publicznie znacznik „⚠️ DO WERYFIKACJI”.
- Na każdej stronie widoczna stopka „Podstawa prawna / Stan prawny na / Treść jest projektem do
  weryfikacji” — dobre w szkicu, nie do publikacji.
- Portal — główny sposób obsługi — pojawia się jako dodatek, bez pokazania, co w nim można zrobić.

---

## 2. Zasady nadrzędne (niezmienione z Fazy 5)

1. **Etyka zawodowa notariusza.** Według dostępnych omówień uchwały KRN nr XII/39/2024 dozwolone są
   krótkie, merytoryczne opisy czynności z podstawą prawną oraz optymalizacja w kodzie własnej strony;
   zakazane jest eksponowanie czynności w sposób ukierunkowany na pozyskanie klientów, pozycjonowanie
   poza stroną i aktywne pozyskiwanie opinii. **„Zachęcająca” znaczy tu: łatwa, przejrzysta i
   konkretna — nie reklamowa.** Zachęca to, że klient w 30 sekund wie, co zrobić, ile to kosztuje i
   ile trwa. Bez przymiotników w stopniu najwyższym, porównań z konkurencją, promocji, opinii klientów,
   logotypów klientów, liczników „zaufało nam…”, reklam i wymiany linków.
2. **Treści prawne wyłącznie z `PRZEPISY-PSA.md`**, każde twierdzenie z przepisem. Pozycje ⚠️ (m.in.
   stawki) nie idą do publikacji bez potwierdzenia Łukasza. Żadnego kopiowania tekstów z innych stron.
3. **Wszystkie teksty to projekty do akceptacji Łukasza** — znacznik `<!-- DO WERYFIKACJI -->` w
   źródle. Widoczny baner „projekt do weryfikacji” tylko w trybie szkicu (flaga budowania, np.
   `SZKIC=1`); w buildzie produkcyjnym — nigdy.
4. **Decyzje:** bez `/wzory` (D-048); domena nierozstrzygnięta — wszystkie adresy z `BASE_URL`
   (D-049); formularz zgłoszenia wymaga KRS, spółki w organizacji obsługuje kancelaria poza nim (D-047).
   **Bez strony o nowelizacji 2027** (decyzja Łukasza 25.09.2026 — zapisz jako D-xxx).
5. **Zakaz mieszania P.S.A. z S.A.** (`PRZEPISY-PSA.md` § 12): bez wartości nominalnej, akcji imiennych
   / na okaziciela, dokumentu akcji, dematerializacji.

---

## 3. Inspiracje — co bierzemy, czego nie

Podpatrujemy **układ i mechanikę**, nigdy treść.

| Źródło | Bierzemy | Nie bierzemy |
|---|---|---|
| GOV.UK „Start using a service” i NHS „Start page” | jedna strona = jeden cel; jeden główny przycisk o treści czynności; obok niego koszt, czas i „co przygotować”; reszta jako odnośniki, nie kolejne przyciski | urzędowego chłodu wizualnego |
| GOV.UK „Step by step navigation” | proces pokazany jako ponumerowana sekwencja z tym, kto co robi na danym etapie | — |
| Ledgy (strona „cap table”) | produkt pokazany w hero zamiast opisywany; proces migracji w kilku etapach (u nas: przeniesienie rejestru); FAQ jako rozwijane pytania | logotypów klientów, opinii, certyfikatów jako „dowodu” — zakazane etyką (sekcja 2 pkt 1) |
| Strony kancelarii notarialnych o rejestrze P.S.A. | lista pytań, które klienci faktycznie zadają (co to jest, jak zacząć, ile kosztuje) | długiego tekstu edukacyjnego i wezwania „umów wizytę” jako jedynej drogi — u nas drogą jest portal |

Nie oglądaj stron domów maklerskich pod kątem treści (mieszają S.A. i P.S.A.).

---

## 4. Koncepcja

**Teza strony:** w prostej spółce akcyjnej akcja nie ma dokumentu — istnieje tylko jako wpis w
rejestrze (art. 300²⁹ § 1 KSH — sprawdź dokładne brzmienie w `PRZEPISY-PSA.md`). Strona pokazuje ten
wpis, zamiast o nim opowiadać.

**Jedno odważne miejsce — hero „żywy wpis”.** Po prawej stronie nagłówka (na telefonie pod nim)
przykładowy wpis z rejestru, złożony z HTML/CSS (nie obrazek), w stylu widoku rejestru z portalu:

```
PRZYKŁAD
Wpis do rejestru akcjonariuszy · Przykładowa P.S.A.
Akcjonariusz      Anna Przykładowa
Akcje             seria A · nr 1–500 · zwykłe
Wpisano           25.09.2026, 14:35:07
Skrót wpisu       9f3a…c21e  ← łączy się z poprzednim wpisem
[oś akcji 1–1000: dwa odcinki, 1–500 i 501–1000]
```

- Liczby, numery akcji, daty i skrót w kroju mono (`--font-dane`), tak jak w portalu.
- Pod spodem uproszczona **oś akcji** z sesji 6 — znak rozpoznawczy strony; najechanie albo dotknięcie
  odcinka pokazuje posiadacza i zakres.
- Jedyny zaplanowany ruch na stronie: przy wczytaniu wpis „zapisuje się” — pola podświetlają się
  kolejno (≤ 900 ms łącznie), sekundy znacznika czasu przeskakują raz, linia skrótu rysuje się do
  poprzedniego wpisu. **Stan spoczynkowy jest w pełni widoczny od początku** (animacja podświetla, nie
  odsłania z `opacity: 0`); przy `prefers-reduced-motion` — brak animacji. Wyłącznie CSS.
- Wpis jest wyraźnie oznaczony jako przykład; dane fikcyjne.

Wszystko poza hero jest spokojne: dużo światła, typografia, jeden akcent.

---

## 5. Mapa strony

| Adres | Cel | Główne zapytanie |
|---|---|---|
| `/` | odpowiada na 5 najważniejszych pytań i prowadzi do wniosku | rejestr akcjonariuszy PSA, rejestr akcjonariuszy prostej spółki akcyjnej |
| `/jak-zaczac` | krok po kroku + „co przygotować” | jak założyć rejestr akcjonariuszy |
| `/sprzedaz-akcji` | zbycie akcji i wpis (forma dokumentowa, dokumenty, termin, chwila nabycia) | sprzedaż akcji PSA wpis do rejestru |
| `/przeniesienie-rejestru` | spółka ma rejestr u innego podmiotu | zmiana podmiotu prowadzącego rejestr akcjonariuszy |
| `/oplaty` | stawki, kiedy powstają, jak zapłacić | ile kosztuje rejestr akcjonariuszy |
| `/pytania` | pełne FAQ | — |
| `/kontakt`, `/regulamin`, `/polityka-prywatnosci` | dane kancelarii, regulamin portalu, RODO | — |

Znikają: `/czym-jest-rejestr-akcjonariuszy` (treść wchodzi na `/` i do `/pytania`),
`/nowelizacja-2027`, `/zbycie-akcji-i-wpisy` i `/zmiana-podmiotu-prowadzacego-rejestr` (nowe, krótsze
adresy). Jeśli stare adresy były gdziekolwiek opublikowane — przekierowania 301; jeśli nie — usuń.

**Nawigacja:** wąski pasek górny — nazwa kancelarii, 4 odnośniki (Jak zacząć · Opłaty · Pytania ·
Kontakt), „Zaloguj się” (drugorzędny) i „Złóż wniosek” (główny). Bez lewej kolumny menu. Na telefonie:
menu w jednym rozwijanym panelu; po przewinięciu hero przycisk „Złóż wniosek” przyklejony u dołu
(uwzględnij `env(safe-area-inset-bottom)`, nie zasłania treści ani stopki). Pasek i stopka to wspólny
fragment ze stroną portalu przed zalogowaniem (`SESJA-PSA-FRONTEND.md` Faza 4 pkt 2) — przejście
strona → portal ma wyglądać jak jedna całość.

---

## 6. Strona główna — sekcja po sekcji

Całość mieści się w ok. 6 ekranach na komputerze. Każda sekcja odpowiada na jedno pytanie klienta.

1. **Hero** — nagłówek `h1` (teza), jedno zdanie podtytułu, „Złóż wniosek” + „Zaloguj się”, obok
   „żywy wpis”. Propozycje nagłówka do wyboru przez Łukasza:
   - A: „W prostej spółce akcyjnej akcja istnieje tylko jako wpis w rejestrze.”
     Podtytuł: „Prowadzimy ten rejestr w Kancelarii Notarialnej Łukasz Kozon. Wniosek, podpisy,
     wpisy i informacje z rejestru załatwiasz w portalu.”
   - B: „Rejestr akcjonariuszy Twojej P.S.A. — u notariusza, obsługiwany przez portal.”
   - C: „Rejestr akcjonariuszy P.S.A. Wniosek złożysz w [N] minut.” (N — zmierzone, nie szacowane)
2. **Najkrótsze odpowiedzi** — cztery fakty w jednym rzędzie (na telefonie 2×2), każdy z przypisem
   do przepisu: „do 7 dni” — termin wpisu od otrzymania żądania (art. 300³⁴ § 1); „online” — wniosek,
   dokumenty, wpisy i informacje przez portal (zakres ⚠️ Q-S1); „[kwota] netto / rok” — prowadzenie
   rejestru (⚠️ Q-S2); „w każdej chwili” — informacja z rejestru dla spółki i akcjonariusza
   (art. 300³⁵ § 3). Liczby dużym krojem, opis małym.
3. **Wybierz swoją sytuację** — cztery karty (siatka 2×2) z jednym odnośnikiem każda:
   „Spółka jest w KRS i potrzebuje rejestru” → Złóż wniosek; „Spółka ma rejestr u innego podmiotu” →
   `/przeniesienie-rejestru`; „Spółka jest dopiero zakładana” → kontakt z kancelarią (D-047) + jedno
   zdanie o uchwale zawiązujących (art. 300³¹ § 5); „Jestem akcjonariuszem” → Zaloguj się /
   `/sprzedaz-akcji`.
4. **Jak to działa** — prawdziwa sekwencja, więc numerowana: 1. Uchwała o wyborze kancelarii
   (art. 300³¹ § 5) → 2. Wniosek w portalu (dane spółki pobieramy z KRS) → 3. Podpisy: umowa o
   prowadzenie rejestru (art. 300³² § 1), uchwała, oświadczenia — sposoby podpisu jak w portalu (⚠️
   Q-S1) → 4. Otwarcie rejestru i dostęp w portalu. Przy każdym kroku: kto działa (spółka / kancelaria).
   Obok: „Co przygotować” (umowa spółki, dane akcjonariuszy, adres e-mail spółki) i czas wypełnienia
   wniosku (zmierzony w E2E). Odnośnik do `/jak-zaczac`.
5. **Czym jest rejestr** — krótko, z osią akcji: co rejestr zawiera (katalog z art. 300³³ § 1
   pogrupowany po ludzku: kto, ile i jakich akcji, od kiedy, jakie ograniczenia) i co oznacza wpis
   (nabycie z chwilą wpisu — art. 300³⁷ § 1; wobec spółki akcjonariuszem jest osoba wpisana —
   art. 300³⁸ § 1).
6. **Co zrobisz w portalu** — lista czynności (złożyć wniosek, podpisać dokumenty, poprosić o wpis,
   zgłosić błąd, pobrać informację z rejestru, zapłacić) + opcjonalnie zrzut widoku „Start” portalu na
   przykładowych danych (WebP/AVIF, z `width`/`height`).
7. **Opłaty** — tabela netto / VAT / brutto generowana z `przepisy.js` + mały kalkulator rocznego
   kosztu (liczba wpisów i informacji w roku → kwota brutto). Kalkulator to ulepszenie: bez JS widać
   samą tabelę. Zajęcie komornicze wolne od opłat (art. 300³⁴ § 2) jednym zdaniem.
8. **Pytania** — 6 najczęstszych jako `<details>` (odpowiedź 1–2 zdania + przypis): czy muszę
   przyjść do kancelarii (⚠️ Q-S1); ile kosztuje; jak szybko wpis; co przy sprzedaży akcji (art. 300³⁶
   § 4, art. 300³⁷ § 1); czy mogę przenieść rejestr (art. 300³² § 2); kto ma dostęp do danych
   (art. 300³⁵ + polityka prywatności). Odnośnik do `/pytania`.
9. **Pas końcowy** (ciemny `--rejestr`, jak pasek górny portalu) — „Złóż wniosek” + czas + „Co
   przygotować”.
10. **Stopka** — dane kancelarii z `/api/wspolne/kancelaria` pobrane przy budowaniu (notariusz,
    adres, e-mail, telefon), regulamin, polityka prywatności, jedno „Stan prawny na: [data]” dla całej
    strony.

**Przepisy bez ściany tekstu:** w treści żadnych nawiasów z artykułami. Przepis to mały znacznik w
kroju mono (np. `art. 300³⁴ § 1`) przy twierdzeniu; kliknięcie otwiera dymek z brzmieniem przepisu z
`PRZEPISY-PSA.md` (atrybut HTML `popover` + `popovertarget` — działa bez JavaScriptu; przy braku
obsługi odnośnik prowadzi do listy przypisów na dole strony). Precyzja zostaje, tekst się czyta.

**Podstrony** — ten sam system: `h1` + jedno zdanie + treść w krótkich sekcjach + przypisy-znaczniki +
pas końcowy z właściwym przyciskiem. `/jak-zaczac` jako wzorzec GOV.UK step-by-step.
`/przeniesienie-rejestru` jako 3–4 etapy (nowa uchwała → nowa umowa przed rozwiązaniem starej,
art. 300³² § 2 → przekazanie → wpisy u nas).

---

## 7. System wizualny

**Punkt wyjścia to tokeny portalu** (`publiczne/style/rejestr.css`) — strona i portal to jedna marka.
Najpierw zapisz plan projektowy (STOP A), potem buduj wyłącznie z niego.

- **Kolor:** `--papier #F6F7F5` (tło), `--karta #FFFFFF` (powierzchnie wyróżnione), `--atrament
  #14181C` (tekst), `--atrament-2 #565E68` (tekst pomocniczy), `--rejestr #1F4D3D` (jedyny akcent:
  przyciski, pas końcowy, oś akcji), `--rejestr-tlo #E8EFEA` (wypełnienia), `--mosiadz #A97C3F`
  wyłącznie dekoracyjnie lub w dużym stopniu pisma (kontrast — `SESJA-PSA-FRONTEND.md` Faza 1 pkt 10).
  Jeden motyw jasny, jak portal.
- **Pismo:** EB Garamond (nagłówki, duże liczby w „najkrótszych odpowiedziach”), Inter Tight (tekst i
  interfejs), IBM Plex Mono (dane w „żywym wpisie”, przypisy-znaczniki). Te same lokalne pliki co
  portal (po deduplikacji z Fazy 1 pkt 7), bez nowych krojów. Skala: `h1` `clamp(40px, 6vw, 64px)`,
  `h2` 40, `h3` 24, tekst 17/1.6 (strona czytana, nie operowana — większy niż 15 px w aplikacji),
  małe 13. Nagłówki `text-wrap: balance`; szerokość tekstu ~65–68 znaków; etykiety wersalikami z lekkim
  rozstrzeleniem.
- **Układ:** siatka 12 kolumn, maks. ~1200 px; hero asymetryczny (tekst 7 kolumn, wpis 5). Sekcje
  oddzielone rytmem odstępów, nie ramkami. Karta (tło, obramowanie, promień) tylko tam, gdzie element
  jest osobnym obiektem: „żywy wpis” i karty sytuacji — nie każda sekcja. Odstępy przez `gap`, margines
  boczny ≥ 16 px, zero poziomego przewijania na 390 px.
- **Czego unikać (wygląd „z generatora”):** kremowe tło z terakotą, gradient w hero, ciemne tło z
  jaskrawym akcentem, emoji jako znaczniki, wszystko wyśrodkowane, identyczne zaokrąglone karty z cieniem
  wszędzie, pasek-akcent przy krawędzi kart, numeracja 01/02/03 przy treściach, które nie są sekwencją,
  karuzele, zdjęcia stockowe, ikony zamiast treści.
- **Szczegół, który ma tylko ten temat:** prawdziwe numery akcji, seria, znacznik czasu z sekundami,
  skrót wpisu, oś akcji — jako treść, nie ozdoba.

---

## 8. Teksty

- Pisz ze strony klienta: nazywaj rzeczy tak, jak je rozpoznaje („sprzedaż akcji”, nie „zbycie” w
  nagłówku; termin prawny w treści i w przypisie).
- Krótkie zdania, strona czynna, konkret zamiast ogólnika. Przycisk mówi, co się stanie („Złóż
  wniosek”, „Zaloguj się”, „Sprawdź opłaty”).
- Odpowiedź przed wyjaśnieniem: najpierw „tak / nie / 7 dni / 123 zł”, potem jedno zdanie dlaczego.
- Bez wtrąceń między myślnikami, bez „nie X, tylko Y”, bez pustych fraz („kompleksowo”,
  „profesjonalnie”, „szybko i wygodnie”).
- Każdy tekst: `<!-- DO WERYFIKACJI -->` w źródle; źródło prawne — `PRZEPISY-PSA.md`.

---

## 9. Technika i SEO

- Znajdź obecny generator strony z Fazy 5 (`grep` po `DO WERYFIKACJI`, `BASE_URL`, `sitemap`) i
  przebuduj szablony; treść zostaje w Markdownie w repo, tabela opłat z `przepisy.js`, dane kancelarii
  z `/api/wspolne/kancelaria` przy budowaniu.
- **Statyczny HTML**, nie SPA — treść widoczna bez JavaScriptu. JavaScript tylko dla kalkulatora
  opłat i menu mobilnego, łącznie < 3 KB, jako ulepszenie.
- Każda strona: jeden `h1`, unikalne `title` (do ~60 znaków) i `meta description` (do ~155),
  `canonical` z `BASE_URL`, Open Graph (obraz OG: „żywy wpis” wyrenderowany przy budowaniu), okruszki
  na podstronach.
- JSON-LD: `Notary`, `Service` (prowadzenie rejestru akcjonariuszy P.S.A.), `BreadcrumbList`;
  `FAQPage` na `/pytania` opcjonalnie (Google rzadko pokazuje dziś wyniki FAQ poza stronami
  rządowymi i medycznymi).
- `sitemap.xml`, `robots.txt`; portal i aplikacja kancelarii `noindex`, adres aplikacji kancelarii
  nigdzie nie linkowany.
- Budżet: HTML + CSS strony < 100 KB (bez fontów współdzielonych z portalem), LCP < 1,5 s na
  profilu mobilnym 4G, CLS < 0,1, Lighthouse (SEO, dostępność, wydajność, dobre praktyki) ≥ 95;
  axe-core bez błędów krytycznych i poważnych; WCAG 2.2 AA.
- Bez narzędzi analitycznych z ciasteczkami, bez czatów, bez zewnętrznych CDN. Regulamin, dane
  sprzedawcy, cennik i kontakt muszą istnieć przed płatnościami produkcyjnymi tpay.

---

## 10. Przebieg sesji

**Faza A — plan i makieta (bez zmian w generatorze).**
Plan projektowy: paleta (hex z tokenów), role krojów i skala, koncepcja układu w 1–2 zdaniach oraz
lista „co w planie brzmiało jak domyślny szablon i co zmieniłem”. Statyczna makieta strony głównej w
HTML na przykładowych tekstach, zrzuty 1440 px i 390 px (skala 0,5). Szkic wszystkich tekstów strony
głównej do akceptacji.

### ⛔ STOP A — plan + makieta + teksty + odpowiedzi na Q-S1–Q-S3

**Faza B — budowa.** Strona główna i podstrony w generatorze, przekierowania (jeśli potrzebne),
SEO, pomiary.

### ⛔ STOP B — zrzuty wszystkich stron (1440 / 390) + Lighthouse + axe + lista tekstów DO WERYFIKACJI

**Faza C — porządki.** Usunięcie starych szablonów i stron, wpis D-xxx (nowa struktura strony,
rezygnacja z `/nowelizacja-2027`), aktualizacja `ARCHITEKTURA-PSA.md` i README, test ręczny dla
Łukasza (telefon: Safari i Chrome; komputer: Edge).

---

## 11. Pytania otwarte — nie zgaduj

- **Q-S1 — „Bez wizyty w kancelarii”.** Czy cały proces (uchwała, umowa, oświadczenia, identyfikacja
  AML) odbywa się zdalnie i można to napisać na stronie? Portal przyjmuje skan podpisu własnoręcznego,
  podpis kwalifikowany i zaufany, ale ocena prawna zdalnej identyfikacji AML jest otwarta (P-012). Do
  czasu odpowiedzi: „online” tylko dla czynności, które faktycznie dzieją się w portalu.
- **Q-S2 — Ceny.** Dziś w `przepisy.js` stawki maksymalne (1 200 / 100 / 50 zł netto). Czy
  publikujemy te kwoty, czy niższe? Do czasu odpowiedzi tabela tylko w trybie szkicu.
- **Q-S3 — Domena** (Q2, D-049) — nadal otwarte; `BASE_URL`.
- **Q-S4 — Notariusz na stronie.** Czy strona ma pokazywać notariusza z imienia i nazwiska (i
  zdjęcie, jeśli Łukasz je dostarczy) w sekcji „Kto prowadzi rejestr”? Bez odpowiedzi — tylko nazwa
  kancelarii i dane z `/api/wspolne/kancelaria`.

---

## 12. Czego NIE robić

- Nie wracać do układu dokumentacji (lewa kolumna menu, identyczny szablon każdej strony).
- Nie pokazywać publicznie znaczników „DO WERYFIKACJI” ani banera szkicu w buildzie produkcyjnym.
- Nie tworzyć stron `/nowelizacja-2027` ani `/wzory`.
- Nie pisać tekstów reklamowych (sekcja 2 pkt 1); żadnych opinii, logotypów, liczników, porównań.
- Nie publikować treści prawnych ani cen bez akceptacji Łukasza; nie opierać treści na stronach
  konkurencji ani domów maklerskich.
- Nie wprowadzać pojęć z S.A.
- Nie dodawać nowych krojów pisma, frameworków, zdjęć stockowych, karuzel, wideo z autoodtwarzaniem,
  czatów ani narzędzi śledzących.
- Nie zasłaniać treści przyklejonym przyciskiem na telefonie.
- Nie animować niczego poza „żywym wpisem”; nie ukrywać treści do czasu przewinięcia.
