# Wdrożenie zatwierdzonego projektu strony — raport STOP

Data: 2026-09-26. Podstawa: `SESJA-PSA-STRONA.md` wersja 5 — „wdrożenie zatwierdzonego projektu
strony" (zastępuje w całości poprzednią wersję, D-064; nowa decyzja: D-065 w `DECYZJE.md`).

## 1. Co zrobiono

**Źródło prawdy** — `projekt-strony/nowa-strona.html` (zatwierdzony przez Łukasza) i
`projekt-strony/notariat.png`, zapisane bez zmian. Generator (`narzedzia/buduj-strone.js`,
przepisany od zera) zmienia w projekcie wyłącznie to, czego wymaga technika wdrożenia:

- wydziela `<style>` do `strona.css` i dwa zwykłe `<script>` (jednoliniowy wykrywacz
  `prefers-reduced-motion` w `<head>` → `wczesnie.js`, bez `defer`, żeby zdążył przed pierwszym
  renderem; główna logika nawigacji/menu/animacji → `strona.js`, z `defer`) — blok JSON-LD
  zostaje inline (CSP script-src go nie dotyczy, to dane, nie skrypt);
- podstawia `{{BASE_URL}}` (canonical, Open Graph, JSON-LD, sitemap) z `BASE_URL_STRONA`;
- podstawia kwoty (3 stawki × 3 miejsca każda = 9 wystąpień: karta ceny, linia netto, JSON-LD/FAQ)
  wyłącznie z `server/logika/przepisy.js` (`STAWKI_GROSZE`, `obliczBrutto`) — **zweryfikowane
  żywo**: zmiana stawki w `przepisy.js` i odbudowa strony faktycznie zmienia wszystkie 9 miejsc
  jednocześnie (test wykonany i cofnięty w tej sesji);
- podstawia dane kancelarii (nazwa, adres, e-mail — bez telefonu, zgodnie z projektem) wyłącznie
  z `ustawienia.kancelaria(db())`, to samo źródło co `/api/wspolne/kancelaria`;
- generuje `regulamin.html` i `polityka-prywatnosci.html` w tej samej ramie wizualnej (nagłówek,
  stopka, typografia z projektu — pkt 1 dokumentu sesji), z treścią przeniesioną z
  `publiczne/js/prawne.js` (jedyne źródło tych tekstów) plus nową sekcją o cookies (pkt 11,
  niżej).

**Stawki potwierdzone.** `STAWKI_DO_WERYFIKACJI` w `przepisy.js` → `false` (pkt 7 dokumentu
sesji). Gwarancja ceny 3 lata — decyzja handlowa Łukasza, opisana na stronie i w D-065 jako
niezautomatyzowana w kodzie rozliczeń (patrz D-065).

**Stare podstrony usunięte** (`/jak-zaczac`, `/sprzedaz-akcji`, `/przeniesienie-rejestru`,
`/oplaty`, `/pytania`, `/kontakt`, `/czym-jest-rejestr-akcjonariuszy`,
`/zbycie-akcji-i-wpisy`, `/zmiana-podmiotu-prowadzacego-rejestr`) — **bez przekierowań 301**,
bo żadna nie była nigdy opublikowana pod realną domeną (D-063: bundel nigdy nie wyszedł poza to
repozytorium); dodanie stron-przekierowań byłoby też podstroną, której dokument sesji wprost
zabrania dodawać (sekcja 4).

**Obraz Open Graph** (`obrazy/og-rejestr.png`, dokładnie 1200×630) wygenerowany zrzutem sekcji
hero (Playwright) — zawiera dziś widoczną zaślepkę „Zrzut ekranu portalu klienta", bo to
świadomie niedokończona treść (pkt 10 dokumentu sesji, patrz D-065).

## 2. Weryfikacja (sekcja 3 dokumentu sesji)

| Kontrola | Wynik |
|---|---|
| Zrzuty 1440/390, `reducedMotion: 'reduce'` | `frontend-audyt/zrzuty/faza-strona-v5/` (3 strony × 2 szerokości) — zgodne z projektem, brak różnic wizualnych poza podstawionymi danymi |
| Brak przewijania poziomego na 360/390/768/1024/1440 px | **0 px na wszystkich 3 stronach × 5 szerokości** (15 pomiarów, zmierzone programowo) |
| Lighthouse (mobile) ≥ 95 | **niezmierzone** — jak w każdej poprzedniej fazie tej sesji, brak dostępu do sieci w środowisku |
| axe-core: 0 critical/serious | **0/0 na wszystkich 3 stronach × 5 szerokości** (15 przebiegów) — zero też moderate/minor |
| Walidator danych strukturalnych | **niezmierzone bezpośrednio** (brak dostępu do walidatora Google — sieć); JSON-LD ręcznie sparsowany i sprawdzony: poprawny JSON, poprawny kształt `Notary`/`Service`/`Offer` wg schema.org |
| Każdy link prowadzi do istniejącej strony/trasy | Sprawdzone programowo: `#tresc`/`#oplaty`/`#portal`/`#informacja`/`#pytania` (kotwice na stronie głównej), `portal.html`, `portal.html#/zglos-sie` (istniejąca trasa `EkranZgloszenieWstepne`), `mailto:`, `regulamin.html`, `polityka-prywatnosci.html` — wszystkie prowadzą do istniejących celów w tym bundlu albo w portalu |
| Brak ciasteczek/pamięci przeglądarki | **Zweryfikowane żywo** (Playwright): `document.cookie`, `localStorage.length`, `sessionStorage.length` — puste na wszystkich 3 stronach po pełnym załadowaniu |

## 3. Testy i stan repo

`npm test`: **511/511 zielone** (zmiana `STAWKI_DO_WERYFIKACJI` na `false` nie ma dziś żadnego
testu/miejsca w kodzie, które by na niej polegały — flaga była eksportowana, ale nieużywana).

Build: `npm run buduj-strone` — idempotentny, generuje `strona/dist/` od zera z
`projekt-strony/nowa-strona.html`.

**Środowisko tej sesji.** Lokalny, nieśledzony `.env` (gitignored) uzupełniony o
`KANCELARIA_ULICA`/`KANCELARIA_KOD`/`KANCELARIA_MIASTO`/`KANCELARIA_EMAIL` — bez niego build w
tym środowisku dałby pustą stopkę i JSON-LD (env audytowy nie ma tych danych domyślnie).
W realnym wdrożeniu odpowiedzialność za wypełnienie tych zmiennych (albo odpowiednika w bazie)
jest po stronie osoby wdrażającej — patrz D-065.

## 4. Czego nie zrobiono (świadomie odłożone)

- **Lighthouse i walidator danych strukturalnych** — brak sieci w środowisku, jak w każdej
  poprzedniej fazie.
- **Zaślepki** (zrzut portalu w hero, przykładowa informacja z rejestru) — zostają do czasu
  materiałów od Łukasza (pkt 10 dokumentu sesji); `og-rejestr.png` do regeneracji wtedy.
- **Wpięcie w realne wdrożenie** (domena) — bez zmian względem D-063, czeka na Q-S3/D-049.
- **Treść nowej sekcji „Pliki cookies"** w polityce prywatności — oznaczona
  `<!-- DO WERYFIKACJI -->`, czeka na akceptację Łukasza (pkt 11 dokumentu sesji).

## 5. Zrzuty

`frontend-audyt/zrzuty/faza-strona-v5/`: strona główna, regulamin, polityka prywatności — po
1440 px i 390 px, `reducedMotion: 'reduce'`.
