# FRONTEND-RAPORT.md — raport końcowy, FAZA 6

> Sesja `SESJA-PSA-FRONTEND.md` (v2) + `SESJA-PSA-STRONA.md` (zastępuje jej FAZĘ 5). Baseline —
> `FRONTEND-INWENTARZ.md` (FAZA 0, 2026-09-20). Ten dokument syntetyzuje wyniki wszystkich faz;
> pełne dane pomiarowe i zrzuty w `frontend-audyt/raporty/*.md` i `frontend-audyt/zrzuty/`.

---

## 1. Tabela przed/po — zadania referencyjne (a)–(h)

| Zadanie | Przed (Faza 0) | Po | Zmiana |
|---|---:|---|---|
| (a) Przyjęcie wniosku + otwarcie rejestru | 29 kliknięć (21 bez zaułka); realny błąd blokujący złapany na żywo | błąd naprawiony (data wpisu KRS propagowana z przyjętego wniosku — FAZA 3 pkt 2); ślepy zaułek 8 kliknięć wyeliminowany | ✅ |
| (b) Wpis zbycia akcji | 16 kliknięć; pozycja-pułapka w checklistcie; zbywca wybierany 2× | pułapka naprawiona z komunikatem przy checkboxie (FAZA 0 poprawka krytyczna); model zbywcy (FAZA 3, K3) eliminuje podwójny wybór | ✅ |
| (c) Informacja z rejestru | 4 kliknięcia; brak „Pobierz PDF" (tylko Drukuj) | „Pobierz PDF" dodany (FAZA 3, K5) | ✅ |
| (d) Odnalezienie spółek akcjonariusza | 1 klik, ale ślepy zaułek — nazw spółek nie dało się zobaczyć | ekran profilu osoby `/#/osoby/:id` z listą spółek (FAZA 3, K4) | ✅ |
| (e) Wysyłka zawiadomień | 2 kliknięcia, bez problemów | bez zmian | — |
| (f) Logowanie → złożony wniosek (portal) | 12 kliknięć | KRS z zgłoszenia podstawiany automatycznie (FAZA 4, P2/D-062), pasek kroków klikalny — mniej pól ręcznych, liczba kliknięć nawigacyjnych nie rośnie | ✅ |
| (g) Zgłoszenie zmiany (zalogowany klient) | 3 kliknięcia | bez pogorszenia | — |
| (h) Płatność → pobranie informacji | niepełne (TPAY nieskonfigurowany w środowisku audytowym) | „Zapłać [kwota]" z kwotą w etykiecie, powrót z TPAY prowadzi do właściwej zakładki z odpytywaniem stanu (FAZA 4, P5); pełna ścieżka end-to-end nadal niezmierzona (ten sam limit środowiska — brak sieci/piaskownicy TPAY) | częściowe |

## 2. Krytyczne usterki (3/3 naprawione przed FAZĄ 1, 2026-09-20)

1. **B5 — licznik wniosków pomijał status `zlozony`.** Naprawione (`1a41d6a`), regresja pokryta testem HTTP.
2. **Otwarcie rejestru blokowało się mimo zielonej checklisty** (brak propagacji daty wpisu KRS). Naprawione (`1a41d6a`), zweryfikowane żywo.
3. **Pozycja-pułapka w checklistcie zbycia akcji** (zaznaczenie blokowało zapis bez wyjaśnienia). Naprawione (`e7b996c`).

## 3. Poważne usterki (13/13 zamknięte)

Wszystkie pozycje B1, B3, B4, B6, B7, B8, B9, B11, B12b z sekcji 7 `FRONTEND-INWENTARZ.md`
zamknięte w FAZIE 2 (`frontend-audyt/raporty/faza2-raport.md`) — menedżer haseł (B1), `PoleAdres`
(B3), błędy przy polu zamiast zbiorczo (B4), plakietka nowego dokumentu (B6), `PoleKwoty` dla ceny
emisyjnej (B7), „Dodaj spółkę" w portalu (B8), zgłoszenie nieprawidłowości odróżnione od żądania
wpisu (B9), kolumna `kraj` (B11), etykieta „Wpisany do rejestru HH:MM:SS" (B12b). Tabele portalu na
390px i migracja `kreator.js` na komponenty wspólne zamknięte w FAZACH 3–4.

## 4. Drobne usterki (8/8 zamknięte)

B2 (etykieta „Dowód tożsamości"), B12a (widget „Stan na" zwężony do dnia — D-050), migracja
`Znacznik`→`Pigulka` (FAZA 1), `WyborOsoby`→`WyborZKartoteki` (FAZA 1), landmarki/`<h1>` w powłoce
(FAZA 1), przyciski z obiektem czynności (FAZA 1 pkt 4), „Pobierz PDF" (FAZA 3, K5), podwójny wybór
zbywcy (FAZA 3, model zbywcy). Numer reguły `CLAUDE-PSA.md` §4 przy polach „wymagane" — świadomie
pominięte jako kosmetyczna adnotacja bez wpływu na UI, nie wpisana do żadnej fazy jako zadanie.

## 5. Wydajność — przed/po

| Metryka | Przed (Faza 0) | Po |
|---|---:|---:|
| `vendor/babel.min.js` (transfer logowania) | 2,98 MB raw, 61,6–65,8% strony | **usunięty** — esbuild, zero Babela w przeglądarce (FAZA 1 pkt 6–8, D-046) |
| Czas do gotowości JSX — 4G | 19,3 s (kancelaria) / 17,8 s (portal) | build produkcyjny bez kompilacji w przeglądarce — patrz `frontend-audyt/raporty/faza1-raport.md` dla zmierzonych wartości po |
| CSP | brak | dodane (FAZA 1 pkt 8) — zweryfikowane w tej fazie, że blokuje inline `<script>` (musiało to uwzględnić narzędzie audytu strony, patrz niżej) |

Pełne liczby „po" (rozmiar paczek, TTI po zmianie) w `frontend-audyt/raporty/faza1-raport.md`.

## 6. Dostępność (axe-core) — przed/po

**Przed (Faza 0):** 1 critical + 10 serious na 5 zbadanych ekranach; 2 pary tokenów kolorów pod
progiem WCAG AA (`--atrament-3`, `--mosiadz`).

**Po (FAZA 6, ten dokument, 2026-09-25):** pełny przegląd ponowiony na 13 ekranach kancelarii i 6
ekranach portalu (zasianych scenariuszem E2E, nie pustą bazą) plus 7 stron publicznych
(`frontend-audyt/raporty/faza-strona-stop-b.md`) — **0 critical/0 serious wszędzie**, po naprawie
dwóch usterek znalezionych w tym końcowym przebiegu (nieobecnych we wcześniejszych, węższych
przebiegach per-fazowych):

- **`select-name` (critical)** — cztery filtry list bez dostępnej nazwy (`sprawy.js`, `spolki.js`,
  `wnioski.js`, `zgloszenia.js`) — dodano `aria-label` do każdego.
- **`color-contrast` (serious)** — `.btn-tekstowy` (linki tekstowe: „Zmień", „usuń", „Oznacz
  opłaconą" itd., 14 miejsc użycia) używał `--rejestr-3`, tokenu jawnie opisanego w
  `rejestr.css` jako „akcenty na ciemnym tle" (4,07:1), ale stosowanego na `--karta`/`--papier`
  (jasne tło) — zmieniony na `--rejestr-2` (kontrast ≥ 4,5:1 na jasnym tle).

Kontrast WCAG AA tokenów `--atrament-3`/`--mosiadz` z baseline — zweryfikowany pośrednio: żaden z
obecnych axe-core `color-contrast` na żadnym z 26 zbadanych ekranów (19 aplikacja + 7 strona) nie
wskazuje już tych tokenów jako przyczyny naruszenia.

## 7. Regresja — pokrycie testowe

`npm test`: **511/511 zielone** (bez zmian w tej fazie — poprawki `aria-label` i tokenu koloru nie
mają własnej asercji, bo nie zmieniają zachowania, tylko dostępność/kontrast; zweryfikowane przez
ponowny przebieg axe-core w tej fazie, nie przez test jednostkowy).

Scenariusze end-to-end wymienione w briefie FAZY 6 pkt 1 (druga spółka z jednego konta,
zgłoszenie nieprawidłowości → kwalifikacja → wynik, liczniki po obu stronach, akcjonariusz-osoba
prawna zagraniczna, zgłoszenie→wniosek bez ponownego KRS) mają już pokrycie regresyjne na poziomie
HTTP w `testy/` (m.in. `blok-d-http.test.js`, `wnioski-kancelaria-http.test.js`,
`zgloszenia-http.test.js`, `osoby-http.test.js`, `formaty.test.js`) — weryfikowane przy każdym
`npm test`, nie tylko w demonstracyjnym `narzedzia/scenariusz-e2e.js` (ten pozostaje
jednościeżkowym narzędziem do ręcznego oglądania przebiegu, nie testem regresyjnym; rozszerzenie go
o dodatkowe rozgałęzienia oceniono w tej fazie jako niższą wartość niż już istniejące pokrycie HTTP,
przy tym samym ryzyku regresji).

## 8. Dokumentacja

- `ARCHITEKTURA-PSA.md` — zaktualizowana o sekcję `strona/*` (Faza C strony publicznej, D-064).
- `DECYZJE.md` — D-064 (przeprojektowanie strony, rezygnacja z `/nowelizacja-2027`); wcześniejsze
  fazy: D-050…D-063 (pełna lista w pliku).
- `README.md` — dodany `npm run buduj-strone`.

## 9. Testy ręczne dla Łukasza

- Strona publiczna: `frontend-audyt/raporty/faza-strona-test-reczny-lukasz.md` (telefon Safari/
  Chrome, komputer Edge).
- Aplikacja kancelarii i portal: lista poniżej — minimalny zestaw pokrywający B1 (menedżer haseł),
  płatność w piaskownicy TPAY (niezmierzone automatycznie w tej sesji — brak dostępu do sieci w
  środowisku), portal na telefonie.

| # | Co sprawdzić | Gdzie |
|---|---|---|
| 1 | Logowanie do kancelarii i zapisanie hasła przez menedżer haseł przeglądarki (Chrome, Edge, Safari) — czy propozycja zapisu łączy hasło z właściwym kontem | `/` |
| 2 | Aktywacja konta portalowego — czy menedżer haseł proponuje unikalne hasło i łączy je z adresem e-mail klienta | `/portal.html#/aktywuj/...` |
| 3 | Pełna ścieżka płatności: „Zapłać [kwota]" → piaskownica TPAY → powrót → status „Czekamy na potwierdzenie" → po chwili „Opłacone" | `/#/spolki/:id?zakladka=oplaty` |
| 4 | Portal na telefonie (390px): logowanie, wniosek, dokumenty do podpisu, rejestr — bez przewijania poziomego, bez ucinania kolumn tabel | `portal.html`, telefon |
| 5 | Otwarcie rejestru z kompletnie odhaczoną checklistą — czy zapis przechodzi bez błędu „brak daty wpisu KRS" | `/#/spolki/:id` (nowa spółka) |
| 6 | Wpis zbycia akcji — czy pozycja checklisty z notatką pokazuje komunikat od razu przy zaznaczeniu | `/#/sprawy/:id` |
| 7 | Filtry list (Sprawy, Spółki, Wnioski, Zgłoszenia) z czytnikiem ekranu (VoiceOver/NVDA) — czy selekt ogłasza swoje przeznaczenie | odpowiednie listy |

## 10. Czego nie zmierzono (świadomie, limity środowiska)

- **Lighthouse** — niedostępny w środowisku sesji (brak sieci) w żadnej z faz, w tym tej.
- **Pełna ścieżka (h) płatność→pobranie** — TPAY nieskonfigurowany w środowisku audytowym.
- **Pobranie realnych danych z KRS** — zewnętrzne API niedostępne w środowisku sesji (blokada sieci).

Wszystkie trzy — ten sam, powtarzający się limit środowiska sesji, nie luka w produkcie; wymagają
weryfikacji ręcznej przez Łukasza poza tym środowiskiem (patrz sekcja 9).
