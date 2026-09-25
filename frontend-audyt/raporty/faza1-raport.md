# FAZA 1 — Fundament: raport do STOP (2026-09-25)

Punkt odniesienia „przed”: `FRONTEND-INWENTARZ.md` (Faza 0). Zrzuty: `frontend-audyt/zrzuty/faza1/`.

## 1. Pomiary przed / po

| Miara | Przed | Po | Uwagi |
|---|---:|---:|---|
| Czas do gotowości, 4G (150 ms RTT, 1,6 Mb/s) — portal | 17,8 s | **2,7 s** | cel ≤ 5 s — spełniony |
| Czas do gotowości, 4G — kancelaria | 19,3 s | **3,8 s** | |
| Czas do gotowości bez throttlingu — portal / kancelaria | 1,07 / 1,95 s | 0,10 / 0,12 s | koniec kompilacji JSX w przeglądarce |
| Transfer strony logowania — portal / kancelaria (raw) | ~4,5 / ~4,8 MB | 752 / 968 KB | bez kompresji — ta należy do reverse proxy (pkt 8) |
| `babel.min.js` | 2,98 MB | usunięty | CSP bez `unsafe-eval` i bez `unsafe-inline` dla skryptów |
| Paczka JS — kancelaria / portal (raw / gzip) | 521 / 211 KB źródeł + Babel | 354 KB / 91 KB · 138 KB / 39 KB | + React z `/vendor` 142 KB / 47 KB |
| Fonty | 18 plików, 1,07 MB | 8 plików, 349 KB | Inter Tight i EB Garamond: identyczne kopie fontu zmiennego (MD5) → jedna reguła na krój i podzbiór z zakresem `font-weight`; IBM Plex Mono ma różne pliki — zostaje |
| axe-core (5 ekranów z Fazy 0) critical / serious | 1 / 10 | **0 / 0** | moderate 0; 1 minor na pulpicie |
| `<main>` i `h1` | brak na 5/5 ekranach | każdy z 13 sprawdzonych widoków kancelarii + portal: dokładnie 1 `h1`, `main` | |
| (a) pola puste na ścieżce przyjęcie → otwarcie rejestru | 9 (min. 7 do wpisania) | 9 (min. 7) | redukcja to K2 (Faza 3) — kreator startuje z wniosku na kroku „Pierwsza emisja” |
| (f) pola puste na ścieżce logowanie → wniosek (1 akcjonariusz) | 41 | 40 | formularz akcjonariusza 11 → 10: data urodzenia i płeć wynikają z PESEL, kraj domyślny; główna redukcja to P2 (Faza 4: krok „Spółka” 17 pól z KRS) |
| Tabele na 390 px | kolumny ucięte (`#/rejestr`, `#/sprawy`) | 0 komórek poza ekranem, brak poziomego przewijania strony (portal: rejestr, zgłoszenia; kancelaria: spółki, osoby, sprawy, kokpit, opłaty, zawiadomienia) | |

Metoda pól: skrypt Playwright liczy widoczne, edytowalne pola (segmenty daty = 1 pole) na każdym
kroku ścieżki; „puste” = do wpisania ręcznie.

## 2. Co zrobiono (pkt 0–11)

0. **D-050–D-054** wpisane do `DECYZJE.md` (P-011 zamknięte w części UI przez D-050). Nowe: **D-055**
   (kolumna `kraj` we wniosku — migracja 52; wyszukiwarka kartoteki po KRS).
1. **Jedna biblioteka komponentów.** `ui.js` usunięty. `Znacznik` → `Pigulka` w 9 plikach
   (dawne nazwy odmian mapowane na cztery znaczenia rejestru); `StatusSpolki`, `StatusAml`,
   `ZnacznikPrzegladuAml`, `Wyniki` przeniesione do `ui-rejestr.js` na `Pigulka`. `WyborOsoby`
   wchłonięty przez rozbudowany `WyborZKartoteki`: szuka po nazwisku, firmie, PESEL, NIP i KRS od
   2. znaku, filtr typu, „+ Nowa osoba w kartotece” zawsze na końcu listy (wpisany tekst przechodzi do
   nowej osoby: 11 cyfr → PESEL, 10 cyfr → KRS, tekst → nazwisko/firma), obsługa klawiatury
   (combobox/listbox). Przy zgodnym PESEL/NIP/KRS panel osoby pokazuje przy polu „W kartotece jest już
   … — Wybierz tę osobę” (D-042).
2. **Pola wspólne** (`pola.js`, nowy plik w obu paczkach): `PoleAdres` (kraj domyślnie Polska, maska
   `00-000` tylko dla Polski), `PoleTozsamosc` (PESEL z sumą kontrolną → data urodzenia i płeć jako
   zdanie pod polem, albo „Ta osoba nie ma numeru PESEL” → data urodzenia), `PoleDowod` (Dowód osobisty
   / Paszport + seria i numer — podpięcie do reprezentanta w B2 z migracją), `WyborTypuOsoby` (B11).
   `PoleKwoty` przepisane: wpisuje się normalnie, format po opuszczeniu pola, > 2 cyfry po przecinku =
   komunikat przy polu i `null` na zewnątrz (bez zaokrąglania — D-045/Q6). `PoleDaty`: bez daty
   słownie pod polem (0.4 pkt 7), wkleja ISO. **`FormularzOsoby` wspólny** (`formularz-osoby.js`):
   kartoteka kancelarii (panel boczny `PanelOsoby` + sekcja AML/PEP/notatki tylko w kancelarii) i
   wniosek w portalu (`tryb="portal"`, język laika) — zduplikowany formularz z `wniosek.js` usunięty.
   Czyste funkcje w `formaty.js` (`parsujKwote`, `formatujKwote`, `walidujPesel`, `formatujAdres`,
   `maskujKodPocztowy`, `parsujDate`) + `testy/formaty.test.js` (14 testów, w tym „0,001”, zła suma
   PESEL, adres zagraniczny).
3. **Walidacja (GOV.UK):** `Pole` — błąd pod polem z `aria-describedby`/`aria-invalid`, ostrzeżenie
   osobno, oznaczane pola opcjonalne (gwiazdka usunięta), walidacja po opuszczeniu pola
   (`przyOpuszczeniu`). `PodsumowanieBledow` z odnośnikami przewijającymi do pól i fokusem. Wniosek w
   portalu: braki ustawowe (w tym „PESEL albo data urodzenia”) przy polach przy „Gotowe” — to też
   B4 dla ścieżki portalu. Kreator otwarcia rejestru: „Dalej” nie jest wyłączany z powodu braków —
   kliknięcie pokazuje podsumowanie z odnośnikami (dawny zrzut 18).
4. **Przyciski:** `NawigacjaKreatora` przyjmuje `powod` wyłączenia (wyświetlany i podpięty
   `aria-describedby`); „Otwórz rejestr” i „Dokonaj wpisu” poprzedza zdanie „…nie można cofnąć —
   możliwe jest tylko sprostowanie”; „Zmień osobę”, „Dodaj do kartoteki” / „Zapisz zmiany” zamiast
   „zmień”/„Zapisz”. Pełny przegląd etykiet ekran po ekranie — Faza 3.
5. **Płynność:** View Transitions przy zmianie ekranu (180 ms, `ease-out`, wyłączone przy
   `prefers-reduced-motion`); szkielet treści zamiast spinnera (`Spinner` rysuje szkielet); fokus na
   `h1` po nawigacji; „wstecz” przywraca przewinięcie; filtry i zakładki w adresie (`useParametrAdresu`:
   spółki, osoby, sprawy, wnioski + zakładka wniosku, zgłoszenia); długi formularz osoby w panelu
   bocznym zamiast modala; kroki kreatora otwarcia klikalne (wstecz zawsze, naprzód do osiągniętych);
   niezapisane zmiany (autozapis w toku, panel osoby) → pytanie przed zmianą ekranu i zamknięciem karty.
6. **Wydajność (D-046):** `narzedzia/buduj-front.js` (esbuild, JSX + minifikacja), paczki w
   `publiczne/dist/` w repozytorium (serwer produkcyjny bez esbuild), `npm run buduj` / `npm run dev`
   (bez `&` — działa na Windows), `prestart` buduje. Test pilnuje aktualności paczek, kompletności list
   i tego, że każda paczka definiuje używane komponenty.
7. **Fonty** — jak w tabeli; `preload` tylko `inter-tight-latin.woff2`.
8. **Kompresja** — nie dodana do aplikacji; w tabeli rozmiary raw i gzip.
9. **`Licznik`** + `useOdswiezaneDane`: odświeżanie przy nawigacji, przy powrocie do karty
   (`visibilitychange`) i co 60 s (karta w tle nie odpytuje). Podpięte w nawigacji kancelarii.
   Portal (B6) i ujednolicenie definicji z „Do zrobienia” (K1) — Fazy 2–3.
10. **Powłoka i dostępność:** `main` z `id="tresc"` + „Przejdź do treści”, `nav` z etykietami,
    `aria-current`, jeden `h1` na widok (tytuł w topbarze albo `NaglowekStrony`), ekrany logowania z
    `main` i `h1`. Kontrast: `--atrament-3` #8A929C → #646C76 (4,95:1), `--mosiadz` #A97C3F → #8A6330
    (4,71:1). Odnośniki w tekście podkreślone.
11. **Tabele < 600 px** → karty „etykieta: wartość” (etykiety z nagłówków dopisuje `rdzen.js` każdej
    tabeli, także dorysowanej później). Przy okazji: pasek nawigacji na telefonie i ukryty tekst
    licznika rozpychały stronę kancelarii poziomo — naprawione.

**Testy:** `npm test` — 490/506; 16 niepowodzeń to `testy/kontekst-pisma.test.js` („no such table:
psa_ustawienia”) — **te same przed zmianami** (sprawdzone na czystej gałęzi), niezwiązane z frontendem.

## 3. Q6 — cena emisyjna poniżej 1 grosza (do decyzji)

Do czasu odpowiedzi: `PoleKwoty` odrzuca więcej niż 2 cyfry po przecinku komunikatem przy polu;
schemat bez zmian. B7 (podpięcie w kreatorze zdarzenia) — Faza 2.

- **A — cena za akcję z większą precyzją** (np. do 4 miejsc), przechowywana jako ułamek
  licznik/mianownik w groszach (jak ułamkowe części akcji). Zmiana schematu i pisma muszą umieć
  wypisać np. „0,0001 zł”. Najwierniejsze D-045 („cena za akcję”), najwięcej pracy.
- **B — cena za akcję do 2 miejsc; poniżej 0,01 zł formularz prosi o łączną cenę emisji** i ją
  przechowuje (cena za akcję tylko wyświetlana jako wynik dzielenia). Zmiana schematu (kolumna ceny
  łącznej). Dla laika naturalne, ale dwa tryby jednego pola.
- **C — zostają 2 miejsca**, cena poniżej grosza świadomie niemożliwa do zapisania (wpis w
  `DECYZJE.md`); przy takiej emisji cenę opisuje się w polu tekstowym podstawy emisji.

**Rekomendacja:** B — nie wymaga ułamków w całej arytmetyce kwot (grosze zostają liczbą całkowitą),
a przypadek „10 000 akcji za 1 zł” jest właśnie łączną ceną emisji z uchwały.

## 4. Co zostaje na kolejne fazy (świadomie)

- (a) liczba pól — K2 (Faza 3); (f) krok „Spółka” z KRS — P2 (Faza 4).
- `kreator.js` (cena emisyjna, pola liczbowe) i `oplaty.js` nadal mają surowe `<input type="number">`
  — B7 (Faza 2) zgodnie z dokumentem.
- Nagłówek kokpitu spółki na 390 px jest ściśnięty (tytuł w wąskiej kolumnie obok pola „stan na”) —
  K7 (Faza 3), razem z D-050 („stan na” tylko dzień).
- `PoleDowod` gotowy, podpięcie do reprezentanta wymaga migracji — B2 (Faza 2).
- Wyszukiwarka `/api/psa/osoby` przeszukuje `LIKE %q%` — przy ~500 spółkach wystarcza; indeks FTS
  niepotrzebny na dziś.
