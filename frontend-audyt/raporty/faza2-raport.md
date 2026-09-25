# FAZA 2 — Naprawa błędów B1–B12: raport do STOP (2026-09-25)

Punkt odniesienia „przed": `frontend-audyt/raporty/komponenty-formularze-b1b12-raport.md`
(inwentaryzacja FAZY 0, ustalenia dla każdego B-punktu). Zrzuty: `frontend-audyt/zrzuty/faza2/`.
Q6 rozstrzygnięte wariantem C przed rozpoczęciem tej fazy (D-056, patrz `faza1-raport.md`).

## 1. Stan testów i migracji

- `npm test`: **511/511 zielone** (0 pominiętych, 0 `todo`) na commit `128783f` — obejmuje
  `kontekst-pisma.test.js` (25/25), wcześniej wspominany jako potencjalnie problematyczny; przy
  weryfikacji na STOP okazał się w pełni zielony.
- Migracje tej sesji: **52–55**, wszystkie z opisowym `nazwa` i komentarzem SQL w
  `server/migracje.js`, wszystkie z osobną decyzją w `DECYZJE.md`:
  - 52 — kolumna `kraj` w `psa_wnioski_akcjonariusze` → **D-055** (FAZA 1).
  - 53 — reprezentant: dowód (rodzaj+numer) i adres ustrukturyzowany → **D-059**.
  - 54 — `otwarto_w_portalu` (ślad pierwszego otwarcia dokumentu) → **D-060**.
  - 55 — `psa_zgloszenia_nieprawidlowosci` → **D-057**.
- Dodatkowe decyzje kontraktu API bez nowej migracji: **D-061** (B8 — `GET /portal/wnioski`,
  `POST /portal/wniosek/nowy`).
- Baza produkcyjna (`dane/kancelaria.db`) sprawdzona pod kątem historycznych `data_wpisu` bez
  sekund (B12): **pusta, 0 zdarzeń** — nic do backfillu ani flagowania dziś; do ponownego
  sprawdzenia, gdy pojawią się prawdziwe dane.

## 2. B1–B12 — co zrobiono

**B1 — Menedżer haseł: e-mail jako `autocomplete="username"`.** Ukryty input `username` przed
polami hasła na ekranie aktywacji konta portalowego (`EkranAktywacjaKonta`) — menedżery haseł
łączą teraz hasło z właściwym kontem zamiast proponować je do przypadkowego pola. `server/logika/
hasla.js`: siła hasła min. 12 znaków (test zaktualizowany do nowego progu).

**B2+B3 — Reprezentant: dowód i adres ustrukturyzowane.** Migracja 53 (D-059). Trzy miejsca
wpisania danych reprezentanta (kreator spółki, korekta kancelarii, wniosek portalowy) używają
`PoleDowod`/`PoleAdres` z jawnym `klucze={{rodzaj:'reprezentant_dowod_rodzaj', …}}` — naprawiony
błąd domyślnego `klucze` komponentu, który bez jawnego podania pisał dane pod nieprawidłowe,
nieprefiksowane klucze stanu (wykryty testem Playwright, niewidoczny gołym okiem, bo pola
wyglądały na wypełnione — po prostu pod złym `id`).

**B4 — Weryfikacja: braki ustawowe przy polu.** Ostrzeżenie sumy kontrolnej PESEL
(`walidujPesel`) i błędy przy polu (nie osobna lista) w kartotece, kreatorze i przy weryfikacji
wniosku przez kancelarię — jeden punkt walidacji (`walidujOsobe`) używany wszędzie.

**B5 — Test E2E licznika wniosków.** `GET /api/psa/liczniki`: licznik „wnioski" obejmuje status
`zlozony` (wcześniej tylko `umowa_podpisana`) — regresja przechwycona testem złożenia PRAWDZIWYM
endpointem portalu, nie fixture'em w bazie.

**B6 — Licznik nowego dokumentu w portalu.** Migracja 54 (D-060). `otwarto_w_portalu` ustawiane
raz, przy pierwszym pobraniu przez klienta — plakietka „nowy" przy dokumencie i licznik w
`SzynaPortalu`/`PortalLayout`.

**B7 — Cena emisyjna przez `PoleKwoty`.** `kreator.js` na `cena_emisyjna_grosze` (zamiast
`cena_zl` przeliczanego ręcznie), `PoleLiczbowe` dla ilości/nr pierwszego, `WyborZKartoteki` dla
zbywcy/nabywcy. Zamyka Q6 (D-056, wariant C — 2 miejsca po przecinku, cena poniżej grosza opisana
tekstem podstawy emisji).

**B8 — Portal: „Dodaj spółkę".** D-061. Konto w roli `spolka` zakłada kolejny wniosek
samodzielnie (`PrzyciskDodajSpolke`, `POST /portal/wniosek/nowy`). Krytyczna naprawa po drodze:
`wczytajOtwartyWniosekKonta()` musiał obejmować WSZYSTKIE nieterminalne statusy (nie tylko
`w_przygotowaniu`/`do_uzupelnienia`) — węższy filtr psuł 19 testów, bo istniejące trasy
(dokumenty, podpisy) przestawały znajdować wniosek w dalszych etapach.

**B9 — Zgłoszenie nieprawidłowości we wpisie.** D-057, migracja 55. Nowa, odrębna od „Poproś o
nowy wpis" ścieżka: `EkranZgloszenieBleduPortal` (portal) → `psa_zgloszenia_nieprawidlowosci` →
kolejka w kancelarii (`server/trasy/zgloszenia-nieprawidlowosci.js`) → kwalifikacja
(sprostowanie/żądanie wpisu/brak nieprawidłowości) w nowej sekcji kokpitu spółki
(`ModalKwalifikacjaZgloszenia`, `kokpit.js`). Sama kwalifikacja NIE zakłada sprawy ani nie
dokonuje sprostowania automatycznie. Po drodze naprawione dwa błędy odkryte dopiero wizualną
weryfikacją Playwright (nie przez testy jednostkowe, które nie renderują JS): zgubiona zmienna
`zapytanie` przy przekazywaniu trasy do `AplikacjaPortalZSesja` (`ReferenceError` blokował CAŁY
ekran zgłoszenia — biała strona) i kolizja tytułu belki z ekranem „Poproś o nowy wpis" (oba
pasowały do `sciezka.startsWith('/zgloszenie')`).

⚠️ **Etykiety przycisków „Poproś o nowy wpis" / „Zgłoś błąd we wpisie" są ROBOCZE — do akceptacji
Łukasza**, zgodnie z wymogiem STOP z `SESJA-PSA-FRONTEND.md` dla punktu B9. Zakres świadomie
pominięty: załączniki do zgłoszenia (kolumny zarezerwowane w schemacie, brak endpointu uploadu).

**B10 — pominięte** (poza zakresem tej sesji, jak w FAZIE 0).

**B11 — Weryfikacja trzech ścieżek osoby prawnej.** Bez implementacji, zgodnie z zakresem zadania.
Potwierdzono: kartoteka, „+ Nowa osoba" z kreatora i wniosek portalowy renderują dziś JEDEN
`FormularzOsoby` (luka z FAZY 0 — zduplikowany formularz portalu, brak kolumny `kraj` —
zamknięta). Dwie luki merytoryczne modelu danych, których ujednolicenie formularza NIE
rozwiązuje, udokumentowane jako nowe pytania **P-016** (brak pola reprezentanta
akcjonariusza-osoby prawnej przy podpisywaniu dokumentów) i **P-017** (`beneficjent_rzeczywisty_id`
jako pole pojedyncze a możliwa wielość beneficjentów) — pełne ustalenia:
`frontend-audyt/raporty/b11-osoba-prawna-faza2.md`.

**B12 — „Stan na" tylko dzień + „Wpisano do rejestru" z sekundami.** D-058. Pole godziny
(dodane naprawą Z-305/P-011) usunięte z widgetu „Stan na dzień" w kokpicie — zgodnie z D-050
zostaje wyłącznie dzień; kontrakt API bez zmian. W zamian każda pozycja akcjonariusza (kokpit i
wydrukowana „Informacja z rejestru") pokazuje moment SYSTEMOWEGO wpisu z sekundami
(`psa_zdarzenia.data_wpisu`), odrębny od daty prawnej zdarzenia. `server/logika/stan.js` śledzi
teraz `zdarzenie_najstarszego_nabycia_id` obok daty, żeby dociągnąć znacznik czasu.

## 3. Otwarte pytania do Łukasza (nowe w tej fazie)

| ID | Skrót | Powiązanie |
|---|---|---|
| P-016 | Kto fizycznie działa (podpisuje) za akcjonariusza-osobę prawną | B11 |
| P-017 | Czy `beneficjent_rzeczywisty_id` (pole pojedyncze) wystarcza przy wielu beneficjentach | B11 |
| — | Akceptacja etykiet „Poproś o nowy wpis" / „Zgłoś błąd we wpisie" | B9 |

Pełny kontekst: `testy-audyt/PYTANIA-DO-LUKASZA.md`, `DECYZJE.md` (tabela otwartych pytań).

## 4. Zrzuty

`frontend-audyt/zrzuty/faza2/` — po jednym lub więcej zrzucie na punkt B1, B2+B3, B4, B6, B7, B8,
B9, B12 (B5 to test bez zmiany UI, B10 pominięte, B11 bez implementacji).

## 5. Podsumowanie

Dwanaście punktów B1–B12 (minus B10, świadomie poza zakresem) zamknięte: dziewięć z implementacją
i testami, jeden (B11) weryfikacją i dwoma nowymi pytaniami bez implementacji (świadomie — luki
modelu danych wymagające decyzji), jeden (B9) z jawnie oznaczonymi etykietami roboczymi do
akceptacji. `npm test` zielone (511/511), migracje 52–55 udokumentowane, wszystkie zmiany
kontraktu API/schematu mają wpis w `DECYZJE.md` (D-055, D-057…D-061).
