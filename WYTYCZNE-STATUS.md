# WYTYCZNE-STATUS — wdrożenie „Rejestr akcjonariuszy PSA online” (SESJA-PSA-WYTYCZNE.md)

> Jedyny plik statusu tej sesji. Wejście: `wytyczne-rejestr-psa.md` (stan na 1.11.2026),
> `SESJA-PSA-WYTYCZNE.md` (wersja 1). Gałąź: `claude/busy-brahmagupta-aprxx1`.

## Stan sesji (wznowienie po `/clear`)

| Faza | Stan | Commit |
|---|---|---|
| 0 — Inwentarz | ZROBIONA (1.11.2026) | patrz `git log` — „Faza 0” |
| 1 — Tryb testowy (T1–T6) | ZROBIONA — sekcja 3 | patrz `git log` — „Faza 1” |
| 2 — Podpisy (§ 2–3) | ZROBIONA — sekcja 4; STOP | patrz `git log` — „Faza 2” |
| 3 — Zgody, dostęp, informacje (§ 4–6) | ZROBIONA — sekcja 5; QW1–QW3 rozstrzygnięte (D-083) | patrz `git log` — „Faza 3” |
| 4 — Przeniesienie rejestru (§ 7) | ZROBIONA — sekcja 6; STOP | patrz `git log` — „Faza 4” |
| 5 — Raport końcowy | — | — |

**Decyzje Łukasza (STOP Fazy 1, 1.11.2026):** K1/K2 — forma zgody i PESEL albo data urodzenia według
nowelizacji **od dziś** (D-076); K5 — zakładka „Rejestr” w portalu tylko z danymi spółki (D-077, Faza 3);
propozycja uzupełnienia `PRZEPISY-PSA.md` (P1–P9) przyjęta i dopisana; Faza 1 zaakceptowana, PR
https://github.com/thorid15/Proste-Spolki-Akcyjne/pull/13 (do `claude/Main` — w repozytorium nie ma `main`).
K6 rozstrzygnięte po STOP Fazy 2 — D-079.

**Następny krok:** akceptacja STOP Fazy 4, potem Faza 5 (weryfikacja końcowa, `scenariusz-e2e.js` w trybie testowym, raport).

Stan wejściowy testów: `npm test` — 534/534 zielone (przed zmianami).

---

## 1. Inwentarz (Faza 0)

Stany: **JEST** · **CZĘŚCIOWO** · **BRAK** · **SPRZECZNE** · **ZA BRAMKĄ**. Zakres: S (godziny) / M (dzień) / L (kilka dni).

### T — tryb testowy

| ID | Wymóg | Stan przed | Dowód (plik:linia, test) | Brakuje | Zakres |
|---|---|---|---|---|---|
| T1 | Poczta przez jeden punkt + skrzynka testowa | CZĘŚCIOWO | jeden punkt: `server/poczta.js:41 wyslij()`; wołają go `logika/zaproszenia.js:68,103,199`, `zawiadomienia.js:100,185`, `trasy/wnioski.js:371`, `logika/przypomnienia.js:107`. Bez SMTP zwraca `{wyslano:false, powod}` — nie cichy sukces | wymienny transport, skrzynka `.eml`, strona „Skrzynka testowa” | M |
| T2 | Logowanie bez poczty | BRAK | pracownicy i klienci logują się **hasłem** (`trasy/auth.js:42`, `trasy/portal.js:143`); e-mailem idzie tylko **link aktywacyjny** konta portalu (`zaproszenia.js:60,152`, token 7 dni) | lista kont testowych, przycisk po zaproszeniu, `test:link` | M |
| T3 | Baza testowa + atrapa KRS | BRAK | `logika/dane-probne.js` służy tylko podglądowi wzorów; D-044 odrzuca znaczniki testowe **per rekord**; KRS wyłącznie prawdziwe API (`trasy/krs.js:164`) | `test:seed`, oznaczenie bazy, atrapa KRS | M |
| T4 | Symulowana data | BRAK | `pomocnicze/czas.js` — `terazIso/dzisIso/terazUtc(data = new Date())`; bramka 2027: `przepisy.nowelizacjaObowiazuje(czas.dzisIso())` (`trasy/pozostale.js:348,395`); `Date.now()` poza `czas.js`: `sesja.js`, `limiter.js`, `zaproszenia.js` (tokeny — zostają w czasie rzeczywistym), `dziennik-dostepu.js:55` (miesza zegary) | jedno źródło czasu z przesunięciem | S |
| T5 | Atrapy: walidator podpisu, ITN tpay | CZĘŚCIOWO | `testy/reczne/atrapa-tpay.js` — osobny proces na :3199, udaje API operatora, **bez ITN**; walidatora podpisu w kodzie brak | atrapa w aplikacji z ITN; atrapa walidatora | M |
| T6 | Zabezpieczenia trybu testowego | BRAK | — | całość | M |

### § 2–3 Podpisy

| ID | Wymóg | Stan przed | Dowód | Brakuje | Zakres |
|---|---|---|---|---|---|
| W2.1 | Formy podpisu per typ dokumentu, skan odrzucany | SPRZECZNE | portal przyjmuje „PDF albo skan/zdjęcie (JPG, PNG)” jako podpisany dokument: `trasy/portal.js:985–1030`; D-054 | reguły form w jednym miejscu, odrzucenie skanu | L |
| W2.2 | Zgoda na wpis tylko w formach z tabeli | SPRZECZNE | `POST /sprawy/:id/zgoda` (`trasy/sprawy.js:635`) — `forma` to dowolny tekst (D-026) | słownik form, „skan/zwykły oryginał = brak zgody” | M |
| W2.3 | Brak zgody → powiadomienie przed wpisem | BRAK | `POST /sprawy/:id/wpisz` (`sprawy.js:375`) nie sprawdza ani zgody, ani `powiadomienie_wyslano` (`sprawy.js:674` tylko zapisuje) | blokada z przyczyną | S |
| W2.4 | Automatyczna walidacja po wgraniu | BRAK | — | adapter DSS | L |
| W2.5 | Umowa: spółka pierwsza, notariusz ostatni; uchwała + reprezentacja | CZĘŚCIOWO | checklista otwarcia: `uchwala`, `umowa` (`publiczne/js/spolki.js:72`, serwer `trasy/spolki.js:822`) | „reprezentacja wg KRS”, kolejność podpisów | M |
| W3.1 | PDF < 5 MB, ID w stopce, SHA-256 przy generowaniu | CZĘŚCIOWO | generator PDF `logika/pdf.js` (pdfkit, oświadczenia), umowa `.docx` (`logika/docx.js`); skrót liczony dopiero przy potwierdzeniu skanu (`logika/pakiet-wniosku.js:307`) | ID, skrót i długość przy generowaniu, limit 5 MB | M |
| W3.2 | Ekran „Podpisz dokument” + instrukcja | BRAK | lista dokumentów w portalu (`publiczne/js/wniosek.js`) — pobierz/wgraj skan | ekran 3 kroków, instrukcja § 3 | M |
| W3.3 | Walidacja QES przez DSS | BRAK | — | adapter REST | L |
| W3.4 | Pierwsza wersja = oryginał | BRAK | — | porównanie skrótu prefiksu | M |
| W3.5 | Podpisujący = oczekiwana osoba | BRAK | — | imię, nazwisko, PNOPL | M |
| W3.6 | Wynik → „Do zrobienia”; checklistę zaznacza człowiek | CZĘŚCIOWO | „Do zrobienia”: `trasy/pozostale.js:255`, `publiczne/js/pulpit.js:165`; ręczne potwierdzenie podpisu `POST /wnioski/:id/dokumenty/:d/podpis-potwierdz` (D-052) | pozycja z wynikiem walidacji | S |
| W3.7 | Kilku podpisujących; zgoda = osobny dokument | BRAK | — | — | M |
| W3.8 | Ścieżki alternatywne, podpowiedź dla zarządu | BRAK | — | — | S |

### § 4–6 Zgody, dostęp, pozostałe

| ID | Wymóg | Stan przed | Dowód | Brakuje | Zakres |
|---|---|---|---|---|---|
| W4.1 | Dwa odrębne oświadczenia składane osobiście | SPRZECZNE | `zgoda_email_status` brak/zadeklarowana/potwierdzona (`migracje.js:1401`, `logika/akcjonariusz.js:51`) — **deklaruje wnioskodawca (zarząd) za akcjonariusza** we wniosku (`trasy/portal.js:700`); żądania automatycznych powiadomień brak | oświadczenia z konta osoby, data, odwołalność | M |
| W4.2 | Cofnięcie obu oświadczeń | BRAK | zmiana tylko edycją kartoteki przez pracownika | — | M |
| W4.3 | Bez zgody → list, kolejka, potwierdzenie nadania | SPRZECZNE | zawiadomienia idą na `psa_osoby.email` **bez sprawdzenia zgody** (`zawiadomienia.js:147,268`); kanał `papier` jest w `psa_wydane_dokumenty`, kolejki listów i nadania brak | sprawdzenie zgody, kolejka, nadanie | M |
| W4.4 | Powiadomienie zbywcy wyłącznie na adres z rejestru | CZĘŚCIOWO | adres brany z kartoteki osoby wskazanej przez pracownika (`sprawy.js:651`, `zawiadomienia.js:268`) — w praktyce adres z rejestru; brak testu i pola tylko do odczytu | test, pole RO | S |
| W4.5 | Powiadomienie o wpisie / odmowie — żądający i spółka, bezpłatne | CZĘŚCIOWO | wpis: żądający + spółka (`zawiadomienia.js:125`); odmowa: **tylko żądający** (`zawiadomienia.js:207`); opłaty brak ✓ | odmowa do spółki | S |
| W5.1 | Bez logowania tylko dane spółki; akcjonariat w płatnej informacji | SPRZECZNE | zakładka „Rejestr” w portalu pokazuje stan akcjonariatu bez informacji (`trasy/portal.js:1459`, `publiczne/js/portal.js:1098`) — konflikt (b) | decyzja K5 | — |
| W5.2 | Informację w portalu pobiera spółka i akcjonariusz | JEST | `trasy/portal.js:2230,2307` za `wymagajKonta` + izolacja `maDostepDoSpolki`; test `portal-http.test.js` „informacja z rejestru: odplatna — bez zaplaty nie wychodzi” | — | — |
| W5.3 | Organy poza portalem; informacja na żądanie przez kancelarię | CZĘŚCIOWO | organ nie ma konta ✓; kancelaria ma tylko podgląd `GET /spolki/:id/informacja.html?rola=organ` (`spolki.js:605`) — bez sygnatury, bez śladu; [2027] `POST /sad/zapytania` | „Wydaj informację organowi” + dziennik | M |
| W5.4 | [2027] Wersja dla akcjonariusza bez PESEL/daty ur./adresu innych | JEST (działa już dziś, nie za bramką) | biała lista `logika/maskowanie.js:32`, `przepisy.js:231`; testy `reguly.test.js:39,103`, API: `portal-http.test.js:158,171`. Zgodnie z zasadą 7 **nie wyłączamy** do 18.02.2027 | — | — |
| W5.5 | Wynagrodzenie i VAT z podstawą prawną | BRAK | `logika/informacja-dokument.js` — brak | — | S |
| W5.6 | Dziennik wydanych informacji | CZĘŚCIOWO | `psa_wydane_dokumenty` (numer = id, data, odbiorca, kanał) + `psa_oplaty.wydany_dokument_id`; brak widoku dziennika z opłatą | widok | M |
| W5.7 | Stawki § 15b + gwarancja 3 lata | CZĘŚCIOWO | stawki maks. `przepisy.js:110`, edytowalne `logika/ustawienia.js:52`; gwarancja tylko na stronie (D-073) | wersjonowanie, gwarancja per umowa | M |
| W6.1 | [2027] PESEL albo data ur. w nowych wpisach | SPRZECZNE z `PRZEPISY-PSA.md` § 12 pkt 2 | brak w kodzie; plik przepisów twierdzi, że nowelizacja nie rozszerza katalogu art. 300³³ § 1 | decyzja K2 | S |
| W6.2 | [2027] Zawiadomienie sądu o rozwiązaniu w 7 dni | CZĘŚCIOWO (ZA BRAMKĄ) | `POST /sad/zawiadomienie-o-rozwiazaniu` — 501 przed 18.02.2027 (`pozostale.js:392`) | zadanie z terminem w „Do zrobienia” | S |
| W6.3 | Eksport rejestru z dokumentami | CZĘŚCIOWO | `GET /spolki/:id/stan.csv` (`spolki.js:491`) — sam stan, „eksport roboczy”; D-068: „pakietu eksportu nie budujemy” | historia + dokumenty (ZIP — `logika/zip.js` już jest) | M |
| W6.4 | Brak automatycznego usuwania dokumentów | JEST | brak harmonogramu usuwania (`logika/harmonogram.js` — tylko przypomnienia); `retencja_do` tylko informacyjne (`trasy/osoby.js:507`); `rmSync` wyłącznie przy podmianie pliku przez użytkownika przed złożeniem (`portal.js:1074,1177`) i sprzątaniu nieudanego uploadu (`sprawy.js:746`); zdarzenia append-only (triggery) | test regresyjny (Faza 3) | — |
| W6.5 | [2027] Przypomnienie o zgłoszeniu do KRS w 3 miesiące | BRAK | `przepisy.NOWELIZACJA.KONIEC_OKRESU_PRZEJSCIOWEGO = '2027-05-18'` (`przepisy.js:814`) — stała jest, zadania brak | — | S |

### § 7 Przeniesienie rejestru

| ID | Wymóg | Stan przed | Dowód | Brakuje | Zakres |
|---|---|---|---|---|---|
| W7.1 | Etap 1 — wejście „Przenoszę rejestr” | BRAK | zgłoszenie publiczne `portal.js:195` (bez wariantu) | wariant zgłoszenia | M |
| W7.2 | Etap 2 — dokumenty startowe, wzór uchwały | CZĘŚCIOWO | auto-uzupełnienie z KRS (`trasy/krs.js`), wzór uchwały `wzory/03-...docx` (bez warunku „od chwili rozwiązania”) | wariant uchwały, upload | M |
| W7.3 | Etap 3 — checklista | BRAK | AML jest (`logika/aml.js`, D-036) | checklista | S |
| W7.4 | Etap 4 — umowa warunkowa + pakiet | BRAK | — | klauzula § 7.4, pisma PROJEKT | M |
| W7.5 | Etap 5 — okres przejściowy, przypomnienia | BRAK | mechanizm zamrożenia terminu jest (`logika/terminy.js`) | — | M |
| W7.6 | Etap 6 — odbiór, uzgodnienie | BRAK | — | — | M |
| W7.7 | Etap 7 — otwarcie „PRZEJĘCIE” | CZĘŚCIOWO | kreator stanu otwarcia `POST /spolki/:id/otworz-rejestr` (`spolki.js:853`), migracja z KRN (`rejestr.js:398`, D-072) | zdarzenie „PRZEJĘCIE”, archiwum poprzednika, QES | M |
| W7.8 | Etap 8 — powiadomienia po otwarciu | BRAK | — | — | S |
| W7.9 | Etap 9 — rozliczenie | BRAK | naliczenie roczne od `data_umowy` (`server/oplaty.js`) | data skuteczności | S |
| W7.10 | Statusy § 7.3 | BRAK | — | maszyna stanów | M |

Podsumowanie Fazy 0: JEST 3 · CZĘŚCIOWO 17 · BRAK 23 · SPRZECZNE 8 · ZA BRAMKĄ 0 (+1 częściowo za bramką).

---

## 2. Ustalenia dodatkowe (Faza 0 pkt 2)

**Logowanie.** Pracownicy: e-mail + hasło (`POST /api/psa/auth/login`), konto admina zakładane przy pierwszym
starcie z hasłem w logu, pozostałe konta zakłada admin (hasło tymczasowe w odpowiedzi API — bez poczty), reset hasła
przez admina (też bez poczty). Klienci portalu: konto zakładane przy zgłoszeniu/zaproszeniu z **linkiem aktywacyjnym**
(token 7 dni, e-mail), potem e-mail + hasło (`POST /api/psa/portal/login`). **Aplikacja nie ma logowania linkiem
(„Wyślij link”) ani drugiego składnika** — T2 zrealizowano na tym, co jest (patrz Faza 1).

**Przepływy z e-mailem** (wszystkie przez `poczta.wyslij`): zaproszenie do portalu (zgłoszenie, ponowne zaproszenie,
zaproszenie akcjonariusza), „dokumenty do podpisu” (wnioski), zawiadomienie o wpisie / odmowie, wezwanie,
powiadomienie uprzednie, lista akcjonariuszy do KRS, przypomnienie o opłacie rocznej. Bez SMTP: `wyslano:false` +
powód; przy zgłoszeniu publicznym link aktywacyjny wraca w odpowiedzi do przeglądarki zgłaszającego (obserwacja O1).

**Istniejące mechanizmy:** wspólna funkcja czasu — `czas.js` (bez przesunięcia; Faza 1 ją dodała); bramka 2027 —
`przepisy.nowelizacjaObowiazuje()` (jedyna); dokumenty do podpisu (D-054) — `logika/pakiet-wniosku.js`,
`logika/dokumenty-wniosku.js`; kreator „stan otwarcia” — `publiczne/js/migracja.js` + `otworz-rejestr`; generator
PDF i pism — `logika/pdf.js`, `logika/kontekst-pisma.js`, `logika/docx.js`, `logika/wzory-dysk.js`; `trasy/krs.js`;
atrapa tpay — `testy/reczne/atrapa-tpay.js` (bez ITN); „Do zrobienia” — pulpit kancelarii (D-051).

**Brak pliku `WDROZENIE-PSA.md`** w repozytorium — najbliższy odpowiednik: `docs/WDROZENIE-ZESTAWIENIE.md`.

### 2.1 Propozycja uzupełnienia `PRZEPISY-PSA.md` (do akceptacji — nic nie dopisano)

| # | Przepis | Gdzie | § 10 wytycznych | Uwagi |
|---|---|---|---|---|
| P1 | 🔵 art. 300³⁴ § 3 **zd. 2** — forma zgody na wpis (podpis notarialnie poświadczony, w obecności osoby upoważnionej przez prowadzącego rejestr, QES, PZ, PO) | sekcja 1, art. 300³⁴ | **zweryfikowane** (Dz.U. 2026 poz. 176) | sprzeczne z § 12 pkt 3 pliku — **K1** |
| P2 | art. 30 ustawy zmieniającej — PESEL albo data urodzenia w nowych wpisach po 18.02.2027 | nowa sekcja „Przepisy przejściowe” | zweryfikowane (art. 29–30, 35) | sprzeczne z § 12 pkt 2 — **K2** |
| P3 | art. 29 ustawy zmieniającej — wniosek do KRS w 3 miesiące dla rejestrów istniejących 18.02.2027 | jw. | zweryfikowane | stała jest już w `przepisy.js:814` bez wpisu w pliku |
| P4 | 🔵 art. 83a ust. 4ac u.o.i.f. — obowiązek przekazania rejestru przez firmę inwestycyjną | nowa sekcja „Przeniesienie rejestru” | zweryfikowane | Faza 4 |
| P5 | art. 90a PrNot (§ 1 — eksport/archiwum, § 2 — przekazanie przez prezesa rady izby) | sekcja 8 | zweryfikowane (PrNot art. 85–90a) | W6.3, W7 |
| P6 | art. 89 § 2 PrNot (VAT na wynagrodzeniu) + § 15b ust. 1 i 3 rozporządzenia | sekcja 9 | zweryfikowane | W5.5; proponuję zdjąć ⚠️ z sekcji 9 (stawki) |
| P7 | art. 108a–108b PrNot | sekcja 8 (jest z ⚠️) | zweryfikowane | proponuję zdjąć ⚠️ |
| P8 | art. 38 i art. 25da ustawy o KRS | sekcja 1 / mapa | zweryfikowane | `25da` jest w `przepisy.js:804` bez wpisu w pliku |
| P9 | art. 17 § 1 KSH; KC art. 89 i 116; RODO art. 14; ustawa AML art. 2 ust. 1 pkt 13a i art. 43; KEZN § 12, 27, 31 | jako ⚠️ | **do sprawdzenia** | nie mogą być podstawą blokady (zasada 5) |

### 2.2 Konflikty — do decyzji Łukasza

| # | Konflikt | Stan dziś | Propozycja |
|---|---|---|---|
| K1 | Wytyczne § 2 (zgoda — formy z art. 300³⁴ § 3 zd. 2 [2027]) vs `PRZEPISY-PSA.md` § 12 pkt 3 („§ 3 nie zawiera katalogu form”) i D-026 (forma zgody = dowolny tekst) | kod: tekst dowolny | przyjąć P1; formy z tabeli § 2 jako **polityka kancelarii od dziś**, a od 18.02.2027 także wymóg ustawowy |
| K2 | W6.1 (PESEL albo data ur. po 18.02.2027, art. 30 ustawy zm.) vs `PRZEPISY-PSA.md` § 12 pkt 2 | brak wymogu | potwierdzić tekst art. 30; do tego czasu W6.1 nie blokuje |
| K3 | (a) D-054 („skan + potwierdzenie”) vs polityka podpisów (skan odrzucany) | portal przyjmuje JPG/PNG/PDF-skan | Faza 2 pkt 1 — nowa decyzja zastępuje D-054 w zakresie mechanizmu (zapowiedziana w sesji) |
| K4 | D-026 (usunięcie katalogu form zgody) vs W2.2 | — | zastąpić D-026 nową decyzją przy Fazie 2 |
| K5 | (b) zakładka „Rejestr” w portalu pokazuje akcjonariat bez płatnej informacji vs W5.1 i § 9 pkt 1 (sposób realizacji art. 300³⁵ § 2 niewybrany) | dostęp jest; **nie usuwam** | wybór: (i) zostawić jako realizację art. 300³⁵ § 2 (wgląd za pośrednictwem prowadzącego) i opisać w regulaminie; (ii) zastąpić płatną informacją |
| K6 | (c) W5.1 „bez logowania widoczne dane spółki” vs zasada, że formularze publiczne nie zdradzają, czy spółka jest klientem — **a dziś formularz zgłoszenia ją zdradza**: „Rejestr dla spółki o numerze KRS … jest już prowadzony przez kancelarię” (`portal.js:234`) i „Zgłoszenie … jest już w toku” (`portal.js:248`) | zdradza | ujednolicić odpowiedź (komunikat neutralny + e-mail do adresata) — wymaga decyzji, bo T2 każe nie zmieniać odpowiedzi poza trybem testowym |
| K7 | D-044 (brak oznaczania danych testowych) vs T3/T6 (baza oznaczona jako testowa) | — | **rozstrzygnięte w D-074**: oznaczenie dotyczy całej bazy, nie rekordów — D-044 zostaje |
| K8 | W4.3 / art. 300³³ § 1 pkt 5 vs wysyłka zawiadomień e-mailem bez sprawdzenia zgody (`zawiadomienia.js`) | e-mail na adres z kartoteki | Faza 3: bez zgody → kolejka listów |
| K9 | W4.1 (oświadczenie osobiste) vs deklaracja zgody przez zarząd we wniosku (`zadeklarowana`) | zarząd deklaruje | Faza 3: zarząd tylko „zaprasza”, oświadcza akcjonariusz |
| K10 | W4.5 „odmowa do żądającego i spółki” vs art. 300³⁴ § 7 zd. 2 (odmowa — tylko żądający) | tylko żądający | wysyłać też spółce jako informację (wytyczne), bez zmiany podstawy |

**Obserwacje (§ 8, bez wdrażania):** O1 — przy braku poczty publiczny formularz zgłoszenia oddaje w odpowiedzi link
aktywacyjny konta dla **podanego** adresu e-mail; zgłaszający cudzym adresem przejmuje nieaktywne konto (dotyczy
produkcji bez SMTP). O2 — automatyczne informacje z rejestru bez QES notariusza (§ 8 pkt 1).

### 2.3 Plan Faz 2–4 (pozycje JEST pominięte)

- **Faza 2** (1 sesja): D-075 polityka podpisów; reguły form (W2.1, W2.2, W2.5) w `logika/formy-podpisu.js`; blokada
  wpisu (W2.3); adapter DSS + atrapa z Fazy 1 (W2.4, W3.3–W3.5); PDF z ID i skrótem, ekran „Podpisz dokument”,
  instrukcja (W3.1, W3.2, W3.6–W3.8).
- **Faza 3** (1 sesja, duża): W4.1–W4.5, W5.1 (po K5/K6), W5.3, W5.5–W5.7, W6.1–W6.3, W6.5; test W6.4.
- **Faza 4** — proponuję podział na **4a** (W7.10 maszyna stanów, W7.1–W7.3, W7.9 daty umowy) i **4b** (W7.4 pakiet
  pism PROJEKT, W7.5–W7.8, scenariusze seed w każdym statusie).

---

## 3. Faza 1 — tryb testowy (T1–T6) — WDROŻONE

Decyzja: **D-074**. Testy: `testy/tryb-testowy.test.js` (9), `testy/tryb-testowy-wylaczony.test.js` (5).
Pełny zestaw po Fazie 1: **548/548 zielone** (534 + 14 nowych). Opis dla użytkownika: README, „Tryb testowy”.

| ID | Wynik | Jak |
|---|---|---|
| T1 | WDROŻONE | `server/poczta.js` — jeden punkt, transport `smtp` / `skrzynka-testowa` (+ `zarejestrujTransport` pod Microsoft 365); `server/tryb-testowy/skrzynka.js` — `.eml` przez MailComposer z `nodemailer` (bez nowej zależności) w `dane-testowe/skrzynka/`; strona `/test/skrzynka` (lista, podgląd, klikalne linki, pobranie `.eml`); status „testowa — niewysłana” w odpowiedzi i w kancelarii (`sprawy.js`: wydane pisma, powiadomienie). Bez trybu i bez SMTP: `status: 'blad'` (test) |
| T2 | WDROŻONE (dopasowane) | Aplikacja nie ma „Wyślij link” ani drugiego składnika — logowanie hasłem. Lista kont testowych na ekranach logowania kancelarii i portalu (`publiczne/js/tryb-testowy.js`) woła zwykłe `POST /login`; po zaproszeniu (formularz publiczny, kolejka zgłoszeń, zaproszenie akcjonariusza) przycisk „Zaloguj (tryb testowy)” = ten sam link aktywacyjny (`link_testowy` tylko w trybie testowym); `npm run test:link -- <e-mail>`. Test: ten sam token w bazie, e-mailu i odpowiedzi; błędne hasło nadal 401 |
| T3 | WDROŻONE | `npm run test:seed` (`narzedzia/test-seed.js`) — przez zwykłe API: spółka z aktywnym rejestrem, akcjonariusze ze zgodą e-mail i bez, żądanie zbycia bez zgody zbywcy, wydana informacja (atrapa tpay + ITN), zgłoszenie publiczne; PESEL fikcyjne z poprawną sumą; atrapa KRS `server/tryb-testowy/krs-atrapa.js` (0000990001–3) |
| T4 | WDROŻONE | `czas.teraz()` + przesunięcie (`server/pomocnicze/czas.js`), zapis w `psa_baza_testowa`; panel `/test`; blokada daty sprzed ostatniego zdarzenia; front (`rdzen.js: dzisIso`) bierze tę samą datę. Naprawione mieszanie zegarów w `dziennik-dostepu.js:55` |
| T5 | WDROŻONE / CZĘŚCIOWO | atrapa tpay w aplikacji (`/test/tpay/api`, kasa z ITN na zwykły endpoint) — dostępna z paska (panel); atrapa walidatora podpisu z 7 wynikami — zapis wyboru gotowy, **podpięcie w Fazie 2** (walidatora w kodzie jeszcze nie ma) |
| T6 | WDROŻONE | `server/tryb-testowy/index.js: sprawdzStart` przed migracjami (produkcja / baza nieoznaczona → odmowa startu, test w procesie potomnym); `/test/*` → 404 poza trybem (test); pasek na każdym ekranie (wstrzyknięcie w `serwer.js`); `psa_dziennik_logowan` append-only (migracja 61); `npm run test:oznacz` z potwierdzeniem; konfiguracja wyłącznie w `.env` (Windows) |

Sprawdzone w przeglądarce (Playwright): pasek w kancelarii i portalu (390 px), logowanie jednym kliknięciem
w obu aplikacjach, wpisy w dzienniku logowań, brak błędów JS.

**Odchylenia od planu:** brak logowania linkiem w aplikacji → T2 oparte na liście kont i linku
aktywacyjnym (D-074 pkt 2). `ARCHITEKTURA-PSA.md` zaktualizuję w Fazie 5 (zasada: aktualizacja na końcu).

### Instrukcja — tryb testowy w 3 krokach

1. W `.env` dopisz `PSA_TRYB_TESTOWY=1`.
2. `npm run test:seed`
3. `npm start` → `http://localhost:3005/` (kancelaria) lub `/portal.html` (portal) → kliknij konto pod
   „Tryb testowy — konta testowe”. Skrzynka: `/test/skrzynka`, symulowana data i atrapy: `/test`.

---

## 4. Faza 2 — podpisy i dokumenty (§ 2–3) — WDROŻONE

Decyzje: **D-075** (polityka podpisów, zastępuje D-054 w zakresie mechanizmu), **D-076** (K1/K2, zastępuje
D-026), **D-077** (K5). Migracje 62–63. Testy: `testy/podpisy.test.js` (8, w tym 1 pominięty — brak próbek),
nowy test HTTP w `testy/wnioski-kancelaria-http.test.js`, rozszerzone `sprawy-http`, `wniosek-http`.
Pełny zestaw: **556 zielonych, 1 pominięty** (próbki podpisów).

| ID | Wynik | Jak |
|---|---|---|
| W2.1 | WDROŻONE | reguły form dosłownie wg tabeli § 2 w jednym miejscu (`server/logika/formy-podpisu.js`); portal odrzuca skan; kancelaria zaznacza formę i — przy oryginale — datę otrzymania (`potwierdzPodpis`, `pakiet-wniosku.js`) |
| W2.2 | WDROŻONE | `POST /sprawy/:id/zgoda` przyjmuje kod formy z art. 300³⁴ § 3 zd. 2; skan i zwykły oryginał → 400 „to nie jest ważna zgoda”; UI — lista form z `/meta` |
| W2.3 | WDROŻONE | `blokadaWpisu()` (`trasy/sprawy.js`) — bez ważnej zgody i bez powiadomienia 400 z przyczyną; w UI przycisk nieaktywny, przyczyna i „Uzupełnij” obok |
| W2.4 | WDROŻONE | `server/logika/walidacja-podpisu.js` — format (obraz/PDF bez `/ByteRange` → odrzucenie z komunikatem dla laika), PZ/PO i niekwalifikowane → ręcznie |
| W2.5 | WDROŻONE | podpis notariusza `POST /wnioski/:id/dokumenty/:d/podpis-notariusza` — dopiero po potwierdzonym podpisie spółki (test); checklista otwarcia + „reprezentacja wg KRS” |
| W3.1 | WDROŻONE | ID w stopce każdej strony (`pdf.js`), SHA-256 + długość przy wystawieniu i po poprawce treści, kontrola 5 MB (`PODPIS_LIMIT_BAJTOW`) |
| W3.2 | WDROŻONE | portal: Pobierz → Podpisz w mObywatelu (`PODPIS_MOBYWATEL_URL`, nowa karta) → Wgraj podpisany dokument; instrukcja dosłownie z § 3 (`publiczne/js/wniosek.js: InstrukcjaMobywatel`) |
| W3.3 | WDROŻONE (bez usługi) | adapter REST DSS, odporny na wersje raportu; DSS niedostępna/błąd → ręcznie; test na atrapie HTTP DSS. **Usługi DSS nie zainstalowano** — instrukcja w README |
| W3.4 | WDROŻONE | PAdES: skrót prefiksu o długości oryginału; XAdES: skrót dokumentu osadzonego; niezgodność → odrzucenie |
| W3.5 | WDROŻONE | PESEL z `PNOPL-…`; inny PESEL → odrzucenie; brak PESEL po którejkolwiek stronie → ręcznie |
| W3.6 | WDROŻONE | wynik w „Do zrobienia” (`/pulpit` → `podpisy`); potwierdza człowiek |
| W3.7 | CZĘŚCIOWO | kolejny podpisujący (notariusz) — kontrola pierwszej wersji = oryginał; wielu podpisujących pod uchwałą: walidacja bez oczekiwanej osoby (ręcznie). Zgoda na wpis = osobny dokument jednej osoby — reguła `jedenPodpisujacy` w tabeli, wymuszenie w sprawach w Fazie 3 (dokumenty żądań) |
| W3.8 | WDROŻONE | „Wolę wysłać podpisany oryginał pocztą” (migracja 63), podpowiedź dla zarządu przy umowie (własny QES albo oryginał; QES z mObywatela nie blokowany), PZ na gov.pl w instrukcji |
| T5 | WDROŻONE | atrapa walidatora podpięta: w trybie testowym wynik z panelu `/test` (portal i podpis notariusza) |

**Próbki podpisów (Łukasz, 1.11.2026):** SimplySign, Szafir, CENCERT, EUROCERT — ten sam dokument
(„rejestry-notarialne.pl_211”). Pliki tylko lokalnie w `testy/fixtures/podpisy/` (`.gitignore` — dane osobowe).

| Dostawca | Podpis | Oryginał jako pierwsza rewizja (W3.4) | PESEL w certyfikacie (W3.5) |
|---|---|---|---|
| SimplySign (Certum) | CAdES + znacznik czasu dokumentu (RFC 3161), przyrostowo | **tak** — pierwsze 99 090 B identyczne jak u CENCERT i EUROCERT | tak, `serialNumber` PNOPL |
| CENCERT (Enigma) | CAdES, przyrostowo | **tak** | tak, PNOPL |
| EUROCERT | PKCS#7 (`adbe.pkcs7.detached`), przyrostowo | **tak** | tak, PNOPL |
| Szafir (KIR) | CAdES, przyrostowo | struktura przyrostowa (pierwsza rewizja 87 508 B), ale **podpisany inny wydruk** (Chrome m154 zamiast m153) — nie da się porównać z oryginałem pozostałych | tak, PNOPL |

Wynik testu `podpisy.test.js` na próbkach: wszystkie 4 rozpoznane jako podpisane, oryginał zgodny,
podmieniony oryginał → odrzucenie; bez DSS wynik „do weryfikacji ręcznej” (poprawnie — brak automatycznej
akceptacji). Kontroli oryginału nie luzowałem. **Brakuje:** Sigillum (PWPW), podpis zaufany (PZ), podpis
osobisty (PO); dla Szafira — oryginał, który był podpisywany (potwierdzi zachowanie pierwszej rewizji).
EUROCERT nie jest dostawcą mObywatela — próbka potwierdza obsługę zwykłego QES (np. zarządu).

**Decyzje po STOP Fazy 2:** D-078 (przyjęcie wniosku bez podpisu notariusza), D-079 (K6 — formularz
publiczny nie ujawnia, czy rejestr jest prowadzony; link aktywacyjny nie wraca w odpowiedzi).
Pełny zestaw testów: **561/561**.

**Uwagi:**
- Ścieżka endpointu DSS (`/services/rest/validation/validateSignature`) przyjęta z pamięci — zweryfikować
  przy instalacji usługi (README).
- Do Fazy 3 (kolejka listów W4.3) powiadomienie bez e-maila nie oznacza się jako wysłane — wpis w takiej
  sprawie wymaga ważnej zgody. W trybie testowym (skrzynka) powiadomienie liczy się jako wysłane.
- Przyjęcie wniosku nie wymaga podpisu notariusza — potwierdzone (D-078).
- Katalog próbek: `testy/fixtures/podpisy/` (konwencja repozytorium `testy/`, nie `test/`).

---

## 5. Faza 3 — zgody, powiadomienia, dostęp, informacje (§ 4–6) — WDROŻONE

Decyzje: **D-080** (eksport ZIP), **D-081** (komunikacja: e-mail tylko przy zgodzie osobistej, inaczej list),
**D-082** (informacje: numer, VAT, organy; wersje stawek, gwarancja). Realizacja **D-076** (PESEL albo data
urodzenia) i **D-077** (zakładka „Rejestr”). Migracja 64. Testy: `testy/faza3-http.test.js` (9) + zmiany
w `portal-http`, `blok-d-http`, `sprint5`, `informacja-dokument`. Pełny zestaw: **571/571**.

| ID | Wynik | Jak |
|---|---|---|
| W4.1 | WDROŻONE | portal → Konto → „Moje oświadczenia” (`GET/POST /api/psa/portal/oswiadczenia`), tylko rola akcjonariusza (nie zarząd); zgoda e-mail → żądanie wpisu `zmiana_danych_akcjonariusza` (ta sama droga co „Zgłoś zmianę”); `psa_oswiadczenia` append-only, z datą |
| W4.2 | WDROŻONE | cofnięcie obu oświadczeń (zgoda — przez żądanie wpisu; powiadomienia — od razu) |
| W4.3 | WDROŻONE | `server/listy.js` + „Listy do wysyłki”: adres z rejestru, druk, data i numer nadania, skan potwierdzenia; e-mail tylko przy zgodzie `potwierdzona`; nadanie powiadomienia = `powiadomienie_wyslano` (odblokowuje W2.3) |
| W4.4 | WDROŻONE | adres zbywcy wyłącznie z rekordu kartoteki; pola adresu/e-maila w żądaniu ignorowane — test; panel powiadomienia nie ma pola adresu (wybór osoby z kartoteki) |
| W4.5 | WDROŻONE | odmowa — także do spółki; bez opłaty (test) |
| W5.1 | WDROŻONE | D-077: `GET /portal/rejestr/:id` zwraca tylko dane spółki (test API — brak akcjonariatu i PESEL); ekran z przyciskiem „Zamów informację” |
| W5.2 | BYŁO | `portal.js` informacja tylko dla konta spółki/akcjonariusza z dostępem (test istniejący) |
| W5.3 | WDROŻONE | „Wydaj informację organowi” (`POST /api/psa/informacje/organ`): odbiorca, sygnatura (obowiązkowa), numer, dziennik dostępu; bez automatycznej opłaty |
| W5.4 | POPRAWIONE | maskowanie działało (biała lista); informacja pokazuje teraz PESEL albo datę urodzenia w wersji pełnej (spółka), a akcjonariuszowi zasłania u innych — test API (`portal-http`) |
| W5.5 | WDROŻONE | sekcja „Wynagrodzenie” na każdej informacji: netto, VAT, brutto, podstawa z `PRZEPISY-PSA.md` (`PODSTAWY.WYNAGRODZENIE_INFORMACJI`) |
| W5.6 | WDROŻONE | „Dziennik informacji” (`GET /api/psa/informacje`): numer `INF/RRRR/NNNN`, data, spółka, odbiorca, sygnatura, opłata |
| W5.7 | WDROŻONE / CZĘŚCIOWO | `psa_stawki_wersje` — każda zmiana stawek to wersja z datą; spółka w gwarancji rozliczana wg wersji z dnia umowy (test); parametr `gwarancja_ceny_lat` w API ustawień — **pola w ekranie „Stawki i terminy” jeszcze nie ma** |
| W6.1 | WDROŻONE | D-076: walidacja wpisu — osoba fizyczna nabywca/obejmujący/zastawnik bez PESEL i daty urodzenia → błąd (od dziś, bez bramki) |
| W6.2 | WDROŻONE (ZA BRAMKĄ) | zadanie z terminem 7 dni w „Do zrobienia” po rozwiązaniu/przekazaniu (od 18.02.2027); projekt przez istniejący generator |
| W6.3 | WDROŻONE | D-080: eksport ZIP (README, informacja, historia z łańcuchem, dokumenty) — przycisk przy „Eksport CSV” |
| W6.4 | BYŁO + test | test regresyjny: usuwanie plików tylko w znanych miejscach wywoływanych przez użytkownika; harmonogram niczego nie usuwa |
| W6.5 | WDROŻONE (ZA BRAMKĄ) | zadanie „Przypomnij o zgłoszeniu do KRS” (termin 18.05.2027) + projekt pisma „PROJEKT — do akceptacji Łukasza” |

### Pytania QW1–QW3 (do decyzji — logiki nie zmieniałem)

- **QW1 — opłata za zmianę/cofnięcie zgody e-mail.** Dziś typ `zmiana_danych_akcjonariusza` ma
  `odplatne: true` → opłata za wpis (stawka „wpis”, 100 zł netto). Oświadczenie w portalu zakłada takie
  żądanie, więc jest odpłatne (przy włączonych płatnościach żądanie czeka na zapłatę). Czy ma być bezpłatne?
- **QW2 — kanał powiadomień przed 18.02.2027 przy żądaniu automatycznych powiadomień.** Dziś żądanie jest
  zapisywane, ale kanał zależy wyłącznie od zgody e-mail (e-mail albo list). Propozycja zgodna z domyślną:
  przy żądaniu — dodatkowo kopia pisma w zakładce „Dokumenty” portalu (kanał `portal`), bez zastępowania
  e-maila/listu. Do potwierdzenia.
- **QW3 — zaproszenie do portalu akcjonariusza bez zgody e-mail.** Dziś pracownik w kartotece „Zaproś do
  portalu” podaje adres e-mail konta (kanał operacyjny, odrębny od e-maila w rejestrze) i link idzie
  e-mailem (albo do przekazania ręcznie). Propozycja: list z jednorazowym kodem aktywacyjnym (np. 8 znaków,
  ważny 30 dni) do kolejki listów na adres z rejestru; aktywacja kodem → akcjonariusz sam składa oświadczenia.

**Uwagi:** zgoda e-mail jest polem osoby w kartotece (wspólnej dla rejestrów) — oświadczenie wskazuje spółkę,
żądanie wpisu powstaje w jej rejestrze; przy kilku spółkach akcjonariusz składa oświadczenie w każdej
(do rozważenia przy QW1). Organy: opłata za informację — do decyzji (dziś „nie pobrano”).

**Odpowiedzi Łukasza (STOP Fazy 3) — D-083, wdrożone:** QW1 — płatne tylko zmiany w akcjonariacie
(zmiany danych, w tym zgoda e-mail, bezpłatne; obciążenia zostawiłem płatne — do potwierdzenia); QW2 — kopia
pisma w portalu przy żądaniu automatycznych powiadomień; QW3 — bez zaproszeń i bez logowania do portalu dla
osób bez zgody na e-mail, pouczenie na liście i w formularzach; organy — bez opłaty. Testy: **574/574**.
Lista kont testowych (T2) bez „akcjonariusza bez zgody” — taka osoba nie ma konta w portalu (D-083).

---

## 6. Faza 4 — przeniesienie rejestru (§ 7) — WDROŻONE (jedna sesja, bez podziału 4a/4b)

Decyzja **D-084**. Migracja 65. Testy: `testy/przeniesienie-stany.test.js` (7 — każde przejście, „Wygasła”
po 12 miesiącach, przypomnienia), `testy/przeniesienie-http.test.js` (przebieg od zgłoszenia do „Aktywny”).
Pełny zestaw: **582/582**. Scenariusz przeszedł też na żywo w trybie testowym (Beta: zgłoszenie → aktywacja
konta → wniosek z umową warunkową → przyjęcie → wszystkie statusy → „Aktywny”).

| ID | Wynik | Jak |
|---|---|---|
| W7.1 | WDROŻONE | opcja w formularzu publicznym (rodzaj zgłoszenia `przeniesienie`, poprzednik, okres wypowiedzenia); odpowiedź jak dla każdego zgłoszenia (D-079); KRS — `krs.js` |
| W7.2 | WDROŻONE | portal (Start → „Przeniesienie rejestru”): umowa spółki, informacja poprzednika, podpisana uchwała; wzór uchwały z brzmieniem „od chwili rozwiązania albo wygaśnięcia…”; akcjonariat z danych poprzednika (D-053) |
| W7.3 | WDROŻONE | checklista Etapu 3 (5 pozycji, człowiek); „uchwała” i „umowa spółki” zablokowane bez dokumentu; AML — istniejący mechanizm (pozycja checklisty) |
| W7.4 | WDROŻONE | klauzula § 7.4 dosłownie (pakiet wniosku + szablon), uchwała — brzmienie spod klauzuli; 9 pism w `psa_szablony` jako PROJEKT (wezwanie w 3 wariantach poprzednika; KRS za bramką 2027); pakiet dla spółki w portalu po zawarciu umowy |
| W7.5 | WDROŻONE | data rozwiązania wpisywana przez kancelarię (z dokumentem); przypomnienia 14 dni / 30 dni przed terminem 12 miesięcy — „Do zrobienia” i portal; żądania: przed skutecznością odmowa, po — przeszkoda (zamrożenie terminu) |
| W7.6 | WDROŻONE | checklista Etapu 6 (6 pozycji); rozbieżność → „Wstrzymane — rozbieżności” z opisem; system niczego nie poprawia |
| W7.7 | WDROŻONE | kreator stanu otwarcia w trybie przejęcia: zdarzenie `przejecie` na początku łańcucha (stan na dzień, skróty dokumentów, protokół), archiwum poprzednika append-only poza łańcuchem, protokół przejęcia (PDF z ID) zatwierdzany podpisem kwalifikowanym (walidator z Fazy 2) |
| W7.8 | WDROŻONE | spółka — e-mail z potwierdzeniem i stanem; poprzednik — potwierdzenie odbioru (PROJEKT do druku); akcjonariusze — informacja z art. 14 RODO + formularz zgód (e-mail przy zgodzie, inaczej list); organy egzekucyjne i [2027] KRS — zadania ręczne |
| W7.9 | WDROŻONE | data zawarcia i data skuteczności; rok prowadzenia od skuteczności, bez opłaty za wpis; opłata za przejęcie i początek gwarancji — „do ustalenia” (bez wartości domyślnej — gwarancja nie jest stosowana) |
| W7.10 | WDROŻONE | jawna maszyna stanów z warunkami; historia append-only; test każdego przejścia |

**Pisma „PROJEKT — do akceptacji Łukasza”** (Szablony dokumentów, kody `przeniesienie_*`): uchwała,
wypowiedzenie, potwierdzenie zawarcia, wezwanie do przekazania (dom maklerski/bank, notariusz, rada izby),
zgłoszenie do KRS i wniosek o wpis danych [2027], informacja z art. 14 RODO, potwierdzenie odbioru. Klauzula
§ 7.4 — dosłownie z wytycznych (nie PROJEKT).

**Do decyzji (§ 9):** opłata za przejęcie; początek 3-letniej gwarancji ceny przy umowie warunkowej
(zawarcie czy skuteczność). **Uwaga:** KC art. 89 i art. 17 § 1 KSH są w § 10 „do sprawdzenia” — nie są
podstawą blokady (blokady opierają się na brakach dokumentów i danych).
