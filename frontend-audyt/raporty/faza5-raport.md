# FAZA 5 — raport STOP (strona publiczna, SEO)

Data: 2026-09-25. Podstawa: `SESJA-PSA-FRONTEND.md` v2, FAZA 5.

## 1. Co zrobiono

**Infrastruktura.** `narzedzia/buduj-strone.js` — generator statycznego HTML bez frameworka i bez
JavaScriptu wykonywalnego (jedyne `<script>` to inertne bloki `application/ld+json`). Treść w
Markdownie (`strona/tresc/*.md`, front-matter `title`/`description`/`podstawa_prawna`), własny,
celowo minimalny konwerter Markdown→HTML (nagłówki, akapity, **pogrubienie**, odnośniki, listy,
cytaty) — zero nowej zależności npm, zgodnie z „Czego NIE robić" (dopuszczone tylko
esbuild/axe-core/lighthouse). Wyjście: `strona/dist/*.html` + `sitemap.xml` + `robots.txt` (allow)
+ skopiowane fonty (Inter Tight, EB Garamond — te same pliki co aplikacja).

**D-063 (decyzja architektoniczna, opisana w `DECYZJE.md`).** `serwer.js` dziś serwuje aplikację
kancelarii pod `/` i w catch-allu — każda nieznana ścieżka ląduje w SPA kancelarii. Strona
publiczna nie jest w tej sesji wpięta w ten routing (przepięcie adresu roboczego kancelarii jest
zbyt dużą, nieodwracalną zmianą poza wyraźnym zakresem tego dokumentu). Bundel jest w pełni
samodzielny — gotowy do wdrożenia pod dowolnym adresem, gdy Q2 (domena) zostanie rozstrzygnięte.
`publiczne/robots.txt` (nowy) blokuje resztę tej aplikacji (`Disallow: /`), uzupełniając istniejące
już (sprzed tej fazy) meta `noindex` na `index.html`/`portal.html`.

**Dziewięć stron** (5.2): `/`, `/czym-jest-rejestr-akcjonariuszy`, `/jak-to-dziala`, `/oplaty`,
`/zbycie-akcji-i-wpisy`, `/zmiana-podmiotu-prowadzacego-rejestr`, `/nowelizacja-2027`, `/pytania`,
`/kontakt`. Treść prawna wyłącznie z `PRZEPISY-PSA.md`, każde twierdzenie z numerem artykułu.
`/regulamin` i `/polityka-prywatnosci` **nie dublują** treści — strona publiczna linkuje do
istniejących dokumentów w portalu (`publiczne/js/prawne.js`), zamiast trzymać dwie kopie tej samej
treści prawnej w dwóch miejscach (0.4, zasada „jeden komponent, jedno miejsce" zastosowana tu do
treści porządkowych).

**`/oplaty`** — tabela netto/VAT/brutto generowana przy budowaniu wprost z
`server/logika/przepisy.js` (`STAWKI_MAKSYMALNE_GROSZE`, `obliczBrutto`, `STAWKA_VAT_PROCENT`), tym
samym formatowaniem złotówek co `fmt.zlote` w aplikacji — jedno źródło stawek, nie przepisane
ręcznie. Cała sekcja oznaczona ⚠️ **DO WERYFIKACJI** (`STAWKI_DO_WERYFIKACJI` w `przepisy.js` samo
mówi, że te stawki nie pochodzą z wydruku KSH i wymagają potwierdzenia).

**Znaczniki DO WERYFIKACJI.** Każda strona ma `<!-- DO WERYFIKACJI -->` na początku źródła
Markdown; jeden dodatkowy, punktowy znacznik przy dacie 18 maja 2027 na `/nowelizacja-2027`
(termin dostosowania dla spółek z już otwartym rejestrem) — ten konkretny termin nie ma dziś
odzwierciedlenia w `PRZEPISY-PSA.md` i wymaga sprawdzenia z tekstem ustawy nowelizującej przed
publikacją.

**Technika (5.3).** `<title>` i `meta description` unikalne na każdej stronie, `canonical` z
`BASE_URL_STRONA` (nowa zmienna w `server/konfiguracja.js`, wzorzec identyczny jak `URL_PORTALU`
z D-049 — placeholder do czasu rozstrzygnięcia Q2), Open Graph, nawigacja okruszkowa (poza stroną
główną). JSON-LD: `Notary` + `Service` na każdej stronie, `BreadcrumbList`. `sitemap.xml` z datą
modyfikacji, `robots.txt` z `Sitemap:`.

## 2. Pomiar wobec celów 5.3

| Cel | Wynik |
|---|---|
| HTML + CSS < 100 KB **na stronę** | ~6,5 KB HTML + 6,3 KB CSS (współdzielony) ≈ 13 KB/stronę — poniżej celu |
| JavaScript ~0 | 0 — jedyne `<script>` to inertne `application/ld+json` |
| Zero zewnętrznych CDN | fonty i CSS w całości self-hosted (skopiowane do `strona/dist/`) |
| axe-core: 0 critical/serious | **0/0 na wszystkich 9 stronach** (zmierzone na żywo, Playwright + axe-core) — jedno ostrzeżenie `moderate` (heading-order na `/pytania`) znalezione i naprawione (nagłówki pytań z `###` na `##`) |
| Brak przewijania poziomego na 390 px | zweryfikowane programowo (`scrollWidth === clientWidth`) na `/` — bez przewijania |
| Lighthouse ≥ 95 | **niezmierzone** — `lighthouse` niedostępny w tym środowisku (brak dostępu do sieci, nie da się doinstalować); zrekompensowane axe-core + ręczną kontrolą rozmiaru i braku JS |

## 3. Zrzuty

`frontend-audyt/zrzuty/faza5/`: strona główna i `/oplaty` na 1440 px, strona główna na 390 px.

## 4. Czego nie zrobiono (świadomie odłożone)

- **Lighthouse** — brak dostępu do sieci w środowisku audytowym uniemożliwił instalację; axe-core
  i ręczna kontrola budżetu rozmiaru/JS są tym, co dało się zrobić bez niego.
- **Wpięcie strony w realne wdrożenie** (domena, serwowanie) — czeka na rozstrzygnięcie Q2;
  bundel jest przygotowany i samodzielny (D-063).
- **Termin 18.05.2027** na `/nowelizacja-2027` — do potwierdzenia z tekstem ustawy nowelizującej
  przed publikacją (oznaczone osobnym `<!-- DO WERYFIKACJI -->` w źródle).
- **`/wzory`** — świadomie pominięte (D-048).

## 5. Testy i stan repo

`npm test` (aplikacja): **511/511 zielone** — zmiana w `server/konfiguracja.js` (dodanie
`BASE_URL_STRONA`) nie narusza istniejącej konfiguracji.

Build: `npm run buduj-strone` (nowy skrypt w `package.json`) — generuje `strona/dist/` od zera,
idempotentnie.
