# Raport: stan wyjściowy wydajności i dostępności
## Rejestr akcjonariuszy P.S.A. — FAZA 0 (inwentaryzacja, bez zmian w kodzie)

Data pomiaru: 2026-09-20
Repo: `/home/user/Proste-Spolki-Akcyjne`
Serwer audytowy: izolowana instancja `node serwer.js`, port 4004, baza tymczasowa
`dane/.audit-perf.db` (usunięta po zakończeniu pomiarów), katalog dokumentów
`/tmp/audit-perf-dokumenty`. Serwer zatrzymany na koniec sesji (`kill -9` na PID
związany z PORT=4004 — patrz uwaga na końcu).

Żaden plik w repozytorium nie został zmieniony. Jedyna operacja z efektem
ubocznym poza `/tmp`: `npm install --no-save axe-core` w `testy-audyt/`
(lokalny `node_modules` narzędzia audytowego, nie ruszono `package.json`
głównego repo ani jego `node_modules`).

---

## Część A: wydajność

### A.1 Rozmiar zasobów

Serwer **nie ma middleware kompresującego** (brak `compression`/gzip w
`serwer.js` i `package.json`) — w praktyce przeglądarka pobiera zasoby w
rozmiarze "raw" podanym niżej, kolumna gzip pokazuje tylko teoretyczny
potencjał oszczędności, gdyby kompresję włączono.

**Kancelaria (`publiczne/index.html`) — 27 zasobów JS/CSS/vendor + fonty:**

| Zasób | Raw | Gzip | % całości (raw) |
|---|---:|---:|---:|
| `vendor/babel.min.js` | 2 983 904 B (2914 KB) | 640 702 B (626 KB) | **61,6%** |
| `vendor/react.production.min.js` + `react-dom.production.min.js` | 142 586 B (139 KB) | 47 224 B (46 KB) | 2,9% |
| CSS (`zgodnosc.css`+`psa.css`+`rejestr.css`) | 124 179 B (121 KB) | 29 048 B (28 KB) | 2,6% |
| JS aplikacji, 24 pliki (`rdzen…app.js`) | 520 695 B (508 KB) | 151 266 B (148 KB) | 10,8% |
| Fonty woff2, 18 plików (wszystkie warianty/podzbiory) | 1 069 856 B (1045 KB) | — (już skompresowane) | 22,1% |
| **RAZEM (worst case, wszystkie warianty fontów)** | **4 841 220 B (≈4,73 MB)** | — | 100% |

**Portal (`publiczne/portal.html`) — 10 zasobów JS/CSS/vendor + fonty:**

| Zasób | Raw | Gzip | % całości (raw) |
|---|---:|---:|---:|
| `vendor/babel.min.js` | 2 983 904 B | 640 702 B | **65,8%** |
| React + ReactDOM | 142 586 B | 47 224 B | 3,1% |
| CSS (3 pliki) | 124 179 B | 29 048 B | 2,7% |
| JS aplikacji, 7 plików (`rdzen, ui, ui-rejestr, prawne, pesel, wniosek, portal.js`) | 211 107 B (206 KB) | 62 467 B (61 KB) | 4,7% |
| Fonty woff2 (jak wyżej) | 1 069 856 B | — | 23,6% |
| **RAZEM** | **4 531 632 B (≈4,43 MB)** | — | 100% |

Uwaga: dzięki `unicode-range` w `@font-face` przeglądarka realnie pobiera
tylko podzbiory pasujące do użytych znaków (zwykle warianty `latin`, rzadziej
`latin-ext`) — powyższa suma fontów to górna granica (wszystkie 18 plików),
nie typowy request. Mimo to nawet realistyczny podzbiór (ok. 6-9 plików) to
kilkaset KB.

**Wniosek nr 1:** `babel.min.js` to pojedynczy największy zasób na obu
ekranach logowania — 62-66% całkowitego transferu strony. To bezpośredni
koszt architektury "Babel w przeglądarce, bez build stepu".

### A.2 Skąd ładowane są fonty

Sprawdzono `publiczne/index.html`, `publiczne/portal.html` i wszystkie pliki
`publiczne/style/*.css`. **Brak jakiegokolwiek połączenia z zewnętrznym CDN
dla fontów.** Wszystkie trzy rodziny (EB Garamond, Inter Tight, IBM Plex
Mono) są serwowane lokalnie jako pliki `.woff2` z `/fonty/` (katalog
`publiczne/fonty/`, 18 plików, deklaracje `@font-face` w
`publiczne/style/rejestr.css` linie 21-179). Brak `<link>` do
`fonts.googleapis.com`/`fonts.gstatic.com` w obu plikach HTML.

Sam plik CSS zawiera komentarz dokumentujący, że fonty **wcześniej** ładowano
z `fonts.googleapis.com` i świadomie przeniesiono je lokalnie (powód podany
w komentarzu: unikanie wysyłania adresu IP klienta do Google przy każdym
wejściu do rejestru prowadzonego przez notariusza — dane osobowe/RODO;
dodatkowa korzyść: działanie offline, brak zależności od CSP dla domeny
zewnętrznej). Stan ten jest już zgodny z dobrą praktyką i nie wymaga zmian
pod kątem prywatności.

### A.3 Czas kompilacji JSX (Babel) w przeglądarce i czas do interaktywności

Playwright + Chromium (`/opt/pw-browsers/chromium-1194/...`), throttling
przez CDP `Network.emulateNetworkConditions` (4G: 150ms RTT,
1,6 Mbps down / 0,75 Mbps up). Metryka "gotowość JSX" = moment, w którym
`#korzen` uzyskuje pierwsze dzieci DOM (mierzone `performance.now()` przez
`MutationObserver`/polling wstrzyknięty `addInitScript` przed nawigacją).

| Scenariusz | DOMContentLoaded | loadEventEnd | `#korzen` ma dzieci (od nawigacji) | Czas Babel (od DCL do `#korzen`) |
|---|---:|---:|---:|---:|
| Kancelaria `/` — throttling 4G | 16 096 ms | 16 096 ms | 19 343 ms | **3 247 ms** |
| Kancelaria `/` — bez throttlingu | 308 ms | 308 ms | 1 948 ms | **1 640 ms** |
| Portal `/portal.html` — throttling 4G | 16 096 ms | 16 097 ms | 17 844 ms | **1 748 ms** |
| Portal `/portal.html` — bez throttlingu | 328 ms | 330 ms | 1 072 ms | **744 ms** |

**Wniosek nr 2 (najważniejszy):** nawet na szybkim łączu (bez throttlingu,
lokalny serwer) sama kompilacja+wykonanie JSX przez Babel w przeglądarce
zajmuje **1,6-1,7 s dla kancelarii i ~0,7 s dla portalu** — to koszt czysto
obliczeniowy (CPU), niezależny od sieci. Na 4G ten koszt praktycznie się nie
zmienia (3,2 s / 1,7 s — nieznacznie więcej, prawdopodobnie z powodu
współzawodnictwa o wątek głównego renderowania z trwającymi jeszcze
pobraniami zasobów), ale **DOMContentLoaded rośnie z ~0,3 s do ~16,1 s** —
niemal wyłącznie z powodu sekwencyjnego, blokującego pobierania
`babel.min.js` (2,9 MB) i pozostałych skryptów przez ograniczone łącze.

Łączny czas do interaktywności (od nawigacji do renderu JSX) na emulowanym
4G: **kancelaria ≈19,3 s, portal ≈17,8 s**. To wartości bardzo dalekie od
standardów UX (Core Web Vitals sugeruje TTI < 3,8 s "dobry"), głównie z
powodu rozmiaru `babel.min.js` i braku kompresji transferu, a częściowo
(1,6-3,2 s) z powodu samej kompilacji JSX w locie.

---

## Część B: dostępność (axe-core)

`axe-core` nie było zainstalowane ani w głównym repo (`node_modules/`,
`package.json`), ani w `testy-audyt/node_modules`. Zainstalowano lokalnie:
`cd testy-audyt && npm install --no-save axe-core` — sukces, bez zmian w
`package.json` głównego repo.

Logowanie do kancelarii: `admin-perf@example.pl` / hasło tymczasowe z logu
serwera audytowego. Baza audytowa była pusta (0 rekordów w `psa_spolki`) —
**ekran kokpitu spółki pominięto** (brak jakiejkolwiek spółki do otwarcia w
świeżo zmigrowanej bazie).

### B.1 Naruszenia axe-core per ekran

| Ekran | Critical | Serious | Moderate | Minor | Suma |
|---|---:|---:|---:|---:|---:|
| Kancelaria — logowanie | 0 | 2 | 3 | 0 | 5 |
| Kancelaria — pulpit (po zalogowaniu) | 0 | 2 | 2 | 0 | 4 |
| Kancelaria — kokpit spółki | — (pominięte, baza pusta) | | | | |
| Kancelaria — kreator nowej spółki, krok 1 | **1** | 2 | 2 | 0 | 5 |
| Portal — logowanie | 0 | 2 | 3 | 0 | 5 |
| Portal — formularz zgłoszenia (`#/zglos-sie`) | 0 | 2 | 3 | 0 | 5 |
| **Suma (critical+serious, wszystkie 5 zbadanych ekranów)** | **1** | **10** | | | **11** |

### B.2 Pełna lista reguł naruszonych (`violations[].id`)

| id reguły | impact | opis | ekrany (liczba dotkniętych węzłów) |
|---|---|---|---|
| `label` | critical | "Form elements must have labels" — element formularza bez etykiety | kreator krok 1 (1 węzeł) |
| `color-contrast` | serious | "Elements must meet minimum color contrast ratio thresholds" | logowanie-kanc (5), pulpit (10), kreator (18), logowanie-portal (5), zgłoszenie (6) |
| `link-in-text-block` | serious | "Links must be distinguishable without relying on color" — linki w tekście nieodróżnialne bez koloru | wszystkie 5 ekranów (1 węzeł każdy) |
| `landmark-one-main` | moderate | "Document should have one main landmark" — brak `<main>` | logowanie-kanc (1)*, logowanie-portal (1), zgłoszenie (1) |
| `page-has-heading-one` | moderate | "Page should contain a level-one heading" — brak `<h1>` | wszystkie 5 ekranów (1 węzeł każdy) |
| `region` | moderate | "All page content should be contained by landmarks" | logowanie-kanc (10), pulpit (1), kreator (1), logowanie-portal (11), zgłoszenie (11) |

\* na ekranie "pulpit" `landmark-one-main` nie wystąpiło (inna struktura DOM po zalogowaniu).

**Wniosek nr 3:** najpoważniejszy wzorzec strukturalny to systemowy brak
landmarków (`<main>`, regiony) i nagłówka `<h1>` na każdym zbadanym ekranie —
to nie pojedynczy błąd, tylko brakujący element w powłoce aplikacji
(prawdopodobnie wspólny layout w `app.js`/`portal.js`/`ui.js`). Drugi
powtarzalny problem to `color-contrast` (serious) — widoczny na każdym
ekranie, z rosnącą liczbą dotkniętych węzłów na ekranach z większą ilością
UI (kreator: 18 węzłów). Jeden `critical` (brak `<label>`) na kreatorze
nowej spółki wymaga uwagi w pierwszej kolejności przy przebudowie.

### B.3 Kontrast WCAG 2.2 AA — tokeny kolorów z `rejestr.css`

Wzór WCAG (relative luminance + contrast ratio), policzony ręcznie skryptem
Node (bez zależności). Próg AA: 4,5:1 (tekst zwykły), 3:1 (duży tekst/UI).

| Para | Kolory (hex) | Kontrast | AA tekst zwykły (≥4,5:1) | AA duży tekst/UI (≥3:1) |
|---|---|---:|---|---|
| tekst podstawowy na tle treści | `--atrament` #14181C / `--papier` #F6F7F5 | 16,60:1 | PASS | PASS |
| tekst podstawowy na białej karcie | `--atrament` / `--karta` #FFFFFF | 17,84:1 | PASS | PASS |
| tekst drugorzędny na tle treści | `--atrament-2` #565E68 / `--papier` | 6,11:1 | PASS | PASS |
| tekst drugorzędny na karcie | `--atrament-2` / `--karta` | 6,57:1 | PASS | PASS |
| **tekst trzeciorzędny na tle treści** | `--atrament-3` #8A929C / `--papier` | **2,93:1** | **FAIL** | **FAIL** |
| **tekst trzeciorzędny na karcie** | `--atrament-3` / `--karta` | **3,15:1** | **FAIL** | PASS |
| biały tekst na `--rejestr` (zielony) | #FFFFFF / `--rejestr` #1F4D3D | 9,60:1 | PASS | PASS |
| biały tekst na `--rejestr-2` | #FFFFFF / `--rejestr-2` #2E6B54 | 6,27:1 | PASS | PASS |
| biały tekst na `--sygnal` (czerwony) | #FFFFFF / `--sygnal` #A32B22 | 7,18:1 | PASS | PASS |
| tekst `--sygnal` na `--sygnal-tlo` | #A32B22 / #F9EBE9 | 6,18:1 | PASS | PASS |
| **tekst `--mosiadz` na `--mosiadz-tlo`** | #A97C3F / #F7EFE2 | **3,26:1** | **FAIL** | PASS |
| tekst `--rejestr` na `--rejestr-tlo` | #1F4D3D / #E8EFEA | 8,21:1 | PASS | PASS |
| `--rejestr-2` na tle treści | #2E6B54 / `--papier` | 5,84:1 | PASS | PASS |
| tekst podstawowy na `--rejestr-tlo` | `--atrament` / #E8EFEA | 15,26:1 | PASS | PASS |

**Wniosek nr 4:** dwie pary tokenów **NIE przechodzą** progu AA dla zwykłego
tekstu: `--atrament-3` (2,93:1 na `--papier`, 3,15:1 na `--karta` — oba
poniżej 4,5:1) i `--mosiadz` na `--mosiadz-tlo` (3,26:1, poniżej 4,5:1). Obie
pasują jedynie progowi "duży tekst/UI" (3:1) — jeśli są używane jako zwykły
tekst (np. etykiety pomocnicze, znaczniki daty, tekst ostrzeżeń), łamią
WCAG 2.2 AA. To dokładnie pokrywa się z naruszeniami `color-contrast`
zgłoszonymi przez axe-core na wszystkich 5 ekranach.

---

## Podsumowanie punktu odniesienia

- Największy pojedynczy koszt wydajności: `babel.min.js` (2,9 MB raw,
  61-66% transferu strony logowania).
- Czas do interaktywności na emulowanym 4G: kancelaria ≈19,3 s, portal
  ≈17,8 s; sama kompilacja JSX przez Babel to 1,6-3,2 s niezależnie od sieci.
- Fonty: w pełni lokalne, brak zewnętrznego CDN — nie wymaga poprawy.
- Dostępność: 1 naruszenie critical + 10 serious (axe-core, suma z 5
  zbadanych ekranów), systemowy brak landmarków/`<h1>` na każdym ekranie.
- Kontrast: 2 pary tokenów kolorów (`--atrament-3`, `--mosiadz`) nie
  przechodzą progu AA 4,5:1 dla zwykłego tekstu.
- Serwer audytowy (port 4004) zatrzymany, baza tymczasowa usunięta.
