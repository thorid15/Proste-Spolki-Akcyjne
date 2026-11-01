# WYTYCZNE-STATUS — wdrożenie „Rejestr akcjonariuszy PSA online” (SESJA-PSA-WYTYCZNE.md)

> Jedyny plik statusu tej sesji. Wejście: `wytyczne-rejestr-psa.md` (stan na 1.11.2026),
> `SESJA-PSA-WYTYCZNE.md` (wersja 1). Gałąź: `claude/busy-brahmagupta-aprxx1`.

## Stan sesji (wznowienie po `/clear`)

| Faza | Stan | Commit |
|---|---|---|
| 0 — Inwentarz | ZROBIONA (1.11.2026) | patrz `git log` — „Faza 0” |
| 1 — Tryb testowy (T1–T6) | ZROBIONA — sekcja 3 | patrz `git log` — „Faza 1” |
| 2 — Podpisy | CZEKA na akceptację STOP (konflikty K1–K4) | — |
| 3 — Zgody, dostęp, informacje | — | — |
| 4 — Przeniesienie rejestru | — | — |
| 5 — Raport końcowy | — | — |

**Następny krok:** decyzje Łukasza w sekcji „Konflikty” (K1–K10) i akceptacja propozycji uzupełnienia
`PRZEPISY-PSA.md`, potem Faza 2.

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
