# Faza B — raport STOP (przeprojektowanie strony publicznej)

Data: 2026-09-25. Podstawa: `SESJA-PSA-STRONA.md` (zastępuje FAZĘ 5, patrz D-064 w `DECYZJE.md`
i `frontend-audyt/raporty/faza-strona-plan-a.md`/`faza-strona-teksty-a.md` dla Fazy A/STOP A).

## 1. Co zrobiono

**Generator przepisany od zera** (`narzedzia/buduj-strone.js`): nowy szablon z wąskim paskiem
górnym (nazwa kancelarii, 4 odnośniki, Zaloguj się/Złóż wniosek) zamiast bocznego menu z FAZY 5;
menu mobilne jako `<details>` z jawnym `display:none`/`[open]{display:flex}` (bez polegania na
natywnym ukrywaniu treści `<details>` — zmierzone w tej sesji, że ta konkretna wersja Chromium go
nie stosuje); przyklejone CTA „Złóż wniosek” na telefonie po przewinięciu hero
(`IntersectionObserver`, `env(safe-area-inset-bottom)`).

**Strona główna** komponowana bezpośrednio jako HTML w generatorze (nie przez konwerter
Markdown — zbyt gęsto skomponowana z powtarzalnych bloków): hero z „żywym wpisem” (CSS-only
podświetlenie przy wczytaniu, `prefers-reduced-motion` respektowane), najkrótsze odpowiedzi (4
fakty), „Wybierz swoją sytuację” (4 karty), „Jak to działa” (4 kroki + „Co przygotować”), „Czym
jest rejestr” z miniaturową osią akcji, „Co zrobisz w portalu”, skrócone Opłaty i Pytania z
odnośnikiem do pełnych podstron, pas końcowy.

**Cytaty prawne jako `popover`** (`strona/przepisy-cytaty.js`, sekcja 6 briefu): każdy znacznik
`{{c:klucz}}` w treści (Markdown i strona główna) zamienia się w przycisk
`popovertarget="wyj-klucz"` — kliknięcie otwiera dymek z dokładnym brzmieniem przepisu, natywne
HTML Popover API, **zero JavaScriptu**. Brzmienie wyłącznie z `PRZEPISY-PSA.md`.

**Nowa mapa strony** (sekcja 5 briefu): `/`, `/jak-zaczac`, `/sprzedaz-akcji`,
`/przeniesienie-rejestru`, `/oplaty`, `/pytania`, `/kontakt`. Usunięte adresy FAZY 5
(`/czym-jest-rejestr-akcjonariuszy`, `/nowelizacja-2027`, `/zbycie-akcji-i-wpisy`,
`/zmiana-podmiotu-prowadzacego-rejestr`) — bez przekierowań 301, bo bundel (D-063) nigdy nie był
wdrożony pod realną domeną, więc stare adresy nie były nigdzie zaindeksowane (patrz D-064).

**JavaScript** (`strona/js/wzmocnienia.js`, 1,5 KB nieminifikowany — budżet z sekcji 9 to < 3 KB):
kalkulator rocznego kosztu na `/oplaty` (liczba wpisów/informacji → kwota brutto, stawki z
`data-*` generowane z `przepisy.js`) i widoczność przyklejonego CTA. Strona działa w pełni bez
tego pliku — `<div class="kalkulator" hidden>` bez JS pozostaje ukryty, sama tabela stawek jest
zawsze widoczna.

**Regulamin/polityka prywatności** — bez zmian względem FAZY 5: stopka linkuje do dokumentów już
istniejących w portalu (`publiczne/js/prawne.js`), zamiast duplikować ich treść jako osobne strony
generatora (kontynuacja zasady „jeden komponent, jedno miejsce” z D-063).

## 2. Pomiar wobec celów sekcji 9

| Cel | Wynik |
|---|---|
| HTML + CSS < 100 KB na stronę | `index.html` 17,5 KB + `styl.css` 16 KB (współdzielony) + `wzmocnienia.js` 1,5 KB ≈ 35 KB/stronę — poniżej celu |
| JavaScript < 3 KB, tylko kalkulator + menu mobilne | 1,5 KB — menu mobilne finalnie bez JS (CSS `<details>`), JS tylko na kalkulator + przyklejone CTA |
| Zero zewnętrznych CDN | fonty, CSS, JS w całości self-hosted |
| axe-core: 0 critical/serious | **0/0 na wszystkich 7 stronach × 2 szerokości** (zmierzone na żywo) — po naprawie 3 usterek znalezionych w tej sesji (niżej) |
| Brak przewijania poziomego na 390 px | zweryfikowane programowo na wszystkich 7 stronach — bez przewijania |
| Lighthouse ≥ 95 | **niezmierzone** — jak w FAZIE 5, `lighthouse` niedostępny w tym środowisku (brak sieci) |

## 3. Usterki znalezione i naprawione w tej sesji

1. **Kontrast koloru (serious)** — biały tekst na jasnozielonym tle segmentu osi akcji
   (`--rejestr-cien-4`, 2,76:1) — zmieniony na `--atrament` (kontrast ≥ 4,5:1).
2. **Przewijanie poziome na 390 px (213 px)** — dwie niezależne przyczyny: (a) panel menu
   mobilnego pozycjonowany względem zbyt wąskiego rodzica (`<details>` zamiast paska górnego) —
   naprawione przeniesieniem kontekstu pozycjonowania na `.pasek-wew`; (b) przycisk „Zaloguj
   się”/„Złóż wniosek” w pasku górnym pozostawał widoczny obok hamburgera na telefonie — ukryty
   w `@media (max-width:900px)`. Tabela opłat na stronie głównej i `/oplaty` owinięta w
   `.tabela-wrap{overflow-x:auto}`, żeby jej minimalna szerokość nie rozpychała całej strony.
3. **`heading-order` (moderate)** — nagłówek kalkulatora na `/oplaty` (`h3`) poprzedzał pierwszy
   `h2` strony — podniesiony do `h2`.
4. **`scrollable-region-focusable` (serious)** — nowy wrapper tabeli z `overflow-x:auto` wymagał
   `tabindex="0"` + `role="region"` + `aria-label`, żeby przewijalny region był dostępny z
   klawiatury.

## 4. Zrzuty

`frontend-audyt/zrzuty/faza-strona-stop-b/`: strona główna na 1440 px i 390 px, `/oplaty` i
`/jak-zaczac` na 1440 px.

## 5. Lista tekstów DO WERYFIKACJI (przed publikacją produkcyjną)

- **„Bez wizyty w kancelarii”** (hero strony głównej, FAQ „Czy muszę przyjść do kancelarii?”) —
  decyzja Łukasza z STOP A (Q-S1) o samej treści; ocena prawna zdalnej identyfikacji AML (P-012)
  pozostaje formalnie otwarta w `DECYZJE.md`.
- **Wszystkie kwoty w sekcji Opłaty** (`/oplaty`, skrót na `/`, FAQ) — stawki maksymalne z
  `przepisy.js` (`STAWKI_DO_WERYFIKACJI=true`), nie z wydruku rozporządzenia.
- **„[N] minut” na wypełnienie wniosku** (`/jak-zaczac`, strona główna, pas końcowy) — czas do
  zmierzenia w scenariuszu E2E, nie zmyślony.
- Front-matter/komentarz `<!-- DO WERYFIKACJI -->` na początku źródła każdej z 7 podstron
  Markdown (`jak-zaczac.md`, `sprzedaz-akcji.md`, `przeniesienie-rejestru.md`, `oplaty.md`,
  `pytania.md`, `kontakt.md`) — cała treść merytoryczna do przejrzenia przez notariusza przed
  publikacją, zgodnie z sekcją 2 pkt 3 briefu.

Baner „projekt do weryfikacji” celowo NIE jest pokazywany w buildzie (sekcja 2 pkt 3 briefu) —
znaczniki są tylko w źródle, nie w wyrenderowanym HTML.

## 6. Czego nie zrobiono (świadomie odłożone)

- **Lighthouse** — jak w FAZIE 5, brak dostępu do sieci w środowisku.
- **Obraz OG generowany z „żywego wpisu”** (sekcja 9) — strony mają Open Graph tekstowy
  (`og:title`/`og:description`), bez wygenerowanego obrazu; do domknięcia razem z Q-S3 (domena),
  bo obraz OG musi być pod bezwzględnym adresem.
- **Wpięcie strony w realne wdrożenie** — bez zmian względem D-063, czeka na Q-S3/D-049.

## 7. Testy i stan repo

`npm test` (aplikacja): **511/511 zielone** — zmian w kodzie aplikacji (poza generatorem strony)
brak.

Build: `npm run buduj-strone` — generuje `strona/dist/` od zera, idempotentnie.
