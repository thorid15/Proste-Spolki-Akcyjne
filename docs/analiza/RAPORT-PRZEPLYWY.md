# RAPORT-PRZEPLYWY — analiza procesów, danych i automatyczny tester

> SESJA-PSA-ANALIZA-PRZEPLYWOW, 3–4.11.2026. **STOP — raport do akceptacji Łukasza.**
> Załączniki: `docs/analiza/MAPA-PROCESOW.md`, `docs/analiza/MAPA-DANYCH.md`, `docs/analiza/BLEDY.md` (odtworzenie i przyczyna każdego błędu),
> wyniki testera `testy/e2e/raport/wyniki.json` (z przebiegu 4.11.2026), arkusze zrzutów — wybrane w `docs/analiza/arkusze/`
> (komplet odtwarza `npm run e2e` w `testy/e2e/raport/arkusze/`, poza repozytorium).

## Podsumowanie

- **Tester e2e** (`npm run e2e`, `npm run e2e:malpa`) zostaje w repo jako regresja: 47 scenariuszy × 2 szerokości (1440, 390 px) = 94 testy oraz małpa — 27 głównych ekranów i test błędnych danych (28 testów). Każdy test ma własny serwer
  w trybie testowym na świeżej bazie z `test:seed`; strażnik przerywa test bez panelu `/test` i skrzynki testowej.
- **Błędy:** 6 (B-001–B-006), z czego **5 blokuje** proces: zajęcie z kokpitu, sprostowanie w kreatorze, otwarcie rejestru
  po przejęciu, zbycie akcji z ograniczeniem (zgoda spółki / prawo pierwszeństwa), nadanie listu na telefonie (390 px). Każdy odtworzony, z przyczyną w kodzie,
  bez poprawek; w zestawie regresji oznaczone `test.fail(…'B-00x')` — zgłoszą się same, gdy zostaną naprawione.
- **Ustalenia:** 37 (A-001…A-037): 6 tematów z mapy i scenariuszy, do tego przegląd zrzutów i małpa. Największy zysk: jeden kreator wpisu dla wszystkich typów (D-097),
  spółka jako żądający bez dopisywania do kartoteki (D-096), domyślni adresaci powiadomień i dobór numerów akcji (D-104, D-105).
- **Zmiany frontendu wprowadzone w tej sesji** (na polecenie: „zmiana we frontendzie, jeśli wpłynie pozytywnie na przepływ”):
  A-008 (powiadomienie listem — stan w panelu zamiast okna `alert`, bez dubla listu), A-017 (przyciski okien nazywają czynność),
  A-018 („wpis dokonany” po „Dokonaj wpisu” także w kreatorze ogólnym). Szczegóły i weryfikacja — § 8.
  Błędów B nie poprawiałem (zasada sesji „bez poprawiania”); B-001 i B-004 to zmiany jednej linii — pierwsze w planie (§ 7).

**Odstępstwa od pliku sesji:** (1) katalog `testy/e2e/` zamiast `tests/e2e/` — w repo testy są w `testy/`, tam też jest narzędzie R4
(`sprawdzUklad`), które rozbudowałem; (2) reset danych = świeży serwer z `test:seed` na każdy test (ta sama baza co
`npm run scenariusz:testowy`, bez jego 35 kontroli — te uruchamiam osobno, § 8); (3) P1–P3 mierzone na KRS spoza atrapy (atrapa zna
3 numery, wszystkie zajęte przez `test:seed`), więc bez autouzupełnienia z KRS — pola spółki wpisane ręcznie; (4) zmiany kodu
aplikacji — wyłącznie 3 zmiany frontendu z § 8, na wyraźne polecenie w tej sesji.

---

## 1. Metryki stanu obecnego

Z `wyniki.json` (automat; „czas” to czas automatu, nie człowieka — porównuje procesy między sobą). Pola wypełnione = pola logiczne
(np. `PoleDaty` = 1 pole), zaznaczenia = pola wyboru (głównie checklisty weryfikacji, D-052 — bez zmian). ✗ = scenariusz zatrzymany
na znanym błędzie (B-…), metryki do miejsca zatrzymania.

| Scenariusz (proces) | Status 1440 / 390 | Kroki | Ekrany | Pola wypełnione | Zaznaczenia | Pola widoczne (max) | Kliknięcia | Przejścia | Czas automatu [s] |
|---|---|---|---|---|---|---|---|---|---|
| `informacja-kancelaria` (K12 informacja z rejestru) | ✓ / ✓ | 2 | 2 | 2 | 0 | 4 | 1 | 2 | 1.3 |
| `kartoteka` (K13 kartoteka) | ✓ / ✓ | 3 | 2 | 8 | 0 | 0 | 4 | 2 | 1.9 |
| `list-usun-z-wysylki` (K11 kolejka listów) | ✓ / ✓ | 2 | 1 | 1 | 0 | 0 | 2 | 1 | 1.2 |
| `nowa-spolka-kancelaria` (K3a otwarcie rejestru — nowa spółka) | ✓ / ✓ | 5 | 1 | 2 | 0 | 18 | 4 | 2 | 3.5 |
| `oplaty` (K14 opłaty) | ✓ / ✓ | 2 | 1 | 0 | 0 | 0 | 2 | 1 | 16.1 |
| `portal-druga-spolka-403` (P12 druga spółka z konta) | ✓ / ✓ | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0.7 |
| `portal-nowa-spolka` (P1–P3 zgłoszenie, aktywacja, wniosek) | ✓ / ✓ | 7 | 3 | 22 | 1 | 14 | 11 | 4 | 3.8 |
| `portal-oplata` (P5 opłata) | ✓ / ✓ | 4 | 2 | 0 | 0 | 0 | 1 | 3 | 2.2 |
| `portal-oswiadczenia` (P10 oświadczenia) | ✓ / ✓ | 3 | 1 | 0 | 2 | 3 | 3 | 1 | 2.2 |
| `portal-podpis` (P4 podpis kompletu) | ✓ / ✓ | 4 | 2 | 0 | 0 | 0 | 2 | 2 | 3.3 |
| `portal-przeniesienie-dom` (P6 zgłoszenie przeniesienia) | ✓ / ✓ | 1 | 1 | 4 | 1 | 0 | 3 | 1 | 0.5 |
| `portal-przeniesienie-notariusz` (P6 zgłoszenie przeniesienia) | ✓ / ✓ | 1 | 1 | 4 | 1 | 0 | 3 | 1 | 0.4 |
| `portal-przeniesienie-rada` (P6 zgłoszenie przeniesienia) | ✓ / ✓ | 1 | 1 | 4 | 1 | 0 | 3 | 1 | 0.4 |
| `portal-zadanie-wpisu` (P11 żądanie wpisu z portalu) | ✓ / ✓ | 2 | 2 | 0 | 0 | 0 | 2 | 2 | 1.0 |
| `portal-zarzad` (P7 Start, P8 informacja, P9 zgłoś błąd) | ✓ / ✓ | 4 | 4 | 1 | 0 | 1 | 4 | 5 | 2.2 |
| `przejecie-otwarcie` (K3c otwarcie PRZEJĘCIEM) | ✗ / ✗ | 1 | 1 | 0 | 0 | 3 | 0 | 1 | 5.7 |
| `przejecie-rejestru` (K3c przejęcie rejestru) | ✓ / ✓ | 4 | 3 | 0 | 6 | 5 | 8 | 3 | 4.2 |
| `przeszkoda` (K7 wstrzymanie / wznowienie) | ✓ / ✓ | 2 | 1 | 1 | 0 | 2 | 3 | 1 | 0.9 |
| `spolka-zadajacy-spoza-kartoteki` (K4 podstawa — spółka jako żądający) | ✓ / ✓ | 3 | 1 | 8 | 1 | 6 | 4 | 1 | 1.8 |
| `sprawa-z-portalu` (K6 sprawa z portalu) | ✓ / ✓ | 4 | 2 | 2 | 1 | 1 | 6 | 2 | 1.9 |
| `wniosek-kancelaria` (K1 zgłoszenia, K2 wniosek) | ✓ / ✓ | 6 | 3 | 0 | 0 | 1 | 4 | 7 | 3.5 |
| `wpis-emisja` (K4 wpis emisja) | ✓ / ✓ | 5 | 3 | 5 | 4 | 11 | 8 | 3 | 2.7 |
| `wpis-emisja-objecie` (K4 wpis emisja) | ✓ / ✓ | 8 | 4 | 7 | 9 | 11 | 18 | 5 | 4.0 |
| `wpis-obciazenie` (K4 wpis obciazenie) | ✓ / ✓ | 5 | 3 | 6 | 2 | 6 | 11 | 3 | 3.6 |
| `wpis-ograniczenie` (K4 wpis ograniczenie) | ✓ / ✓ | 5 | 3 | 3 | 2 | 6 | 6 | 3 | 2.1 |
| `wpis-pokrycie_akcji` (K4 wpis pokrycie_akcji) | ✓ / ✓ | 5 | 3 | 3 | 1 | 6 | 6 | 3 | 2.4 |
| `wpis-prawo_glosu_zastawnika` (K4 wpis prawo_glosu_zastawnika) | ✓ / ✓ | 5 | 3 | 3 | 2 | 6 | 9 | 3 | 2.7 |
| `wpis-przedstawiciel` (K4 wpis przedstawiciel) | ✓ / ✓ | 5 | 3 | 4 | 1 | 6 | 6 | 3 | 2.5 |
| `wpis-przeniesienie_ulamka` (K4 wpis przeniesienie_ulamka) | ✓ / ✓ | 5 | 3 | 6 | 5 | 6 | 13 | 3 | 3.4 |
| `wpis-sprostowanie` (K4 wpis sprostowanie) | ✗ / ✗ | 5 | 3 | 2 | 1 | 6 | 4 | 3 | 17.8 |
| `wpis-umorzenie` (K4 wpis umorzenie) | ✓ / ✓ | 5 | 3 | 4 | 5 | 6 | 12 | 3 | 3.1 |
| `wpis-uniewaznienie` (K4 wpis uniewaznienie) | ✓ / ✓ | 5 | 3 | 6 | 4 | 6 | 8 | 3 | 2.8 |
| `wpis-uprawnienie` (K4 wpis uprawnienie) | ✓ / ✓ | 5 | 3 | 3 | 2 | 6 | 6 | 3 | 2.1 |
| `wpis-wykreslenie_obciazenia` (K4 wpis wykreslenie_obciazenia) | ✓ / ✓ | 5 | 3 | 2 | 2 | 6 | 6 | 3 | 2.1 |
| `wpis-wykreslenie_zajecia` (K4 wpis wykreslenie_zajecia) | ✗ / ✗ | 3 | 2 | 0 | 0 | 6 | 0 | 2 | 15.9 |
| `wpis-zajecie` (K4 wpis zajecie) | ✗ / ✗ | 3 | 2 | 0 | 0 | 6 | 0 | 2 | 15.8 |
| `wpis-zajecie-kafelek` (K4 wpis zajecie) | ✓ / ✓ | 5 | 3 | 3 | 2 | 5 | 8 | 3 | 2.9 |
| `wpis-zdarzenie_inne` (K4 wpis zdarzenie_inne) | ✓ / ✓ | 5 | 3 | 3 | 1 | 6 | 5 | 3 | 2.0 |
| `wpis-zmiana_danych_akcjonariusza` (K4 wpis zmiana_danych_akcjonariusza) | ✓ / ✓ | 5 | 3 | 4 | 1 | 6 | 6 | 3 | 2.4 |
| `wpis-zobowiazanie` (K4 wpis zobowiazanie) | ✓ / ✓ | 5 | 3 | 5 | 2 | 6 | 10 | 3 | 3.5 |
| `zbycie-bez-zgody` (K5 wpis zbycia) | ✓ / ✗ | 7 | 4 | 4 | 5 | 3 | 13 | 5 | 5.1 |
| `zbycie-dwoch-nabywcow` (K5 wpis zbycia) | ✓ / ✓ | 9 | 4 | 6 | 10 | 3 | 22 | 6 | 4.7 |
| `zbycie-niepokryte` (K5 wpis zbycia) | ✓ / ✗ | 7 | 4 | 4 | 6 | 3 | 14 | 5 | 4.1 |
| `zbycie-nowy-nabywca` (K5 wpis zbycia) | ✓ / ✓ | 5 | 3 | 8 | 5 | 3 | 12 | 3 | 2.9 |
| `zbycie-pierwszenstwo` (K5 wpis zbycia) | ✗ / ✗ | 5 | 3 | 3 | 0 | 3 | 4 | 3 | 12.1 |
| `zbycie-ze-zgoda` (K5 wpis zbycia) | ✓ / ✓ | 5 | 3 | 3 | 5 | 3 | 11 | 3 | 2.7 |
| `zbycie-zgoda-spolki` (K5 wpis zbycia) | ✗ / ✗ | 5 | 3 | 3 | 0 | 3 | 4 | 3 | 11.9 |

### Cel po uproszczeniu (najczęstsze procesy; cel — szacunek z propozycji § 3–6, do potwierdzenia testerem po wdrożeniu)

| Proces | Dziś: ekrany / pola wpisywane / kliknięcia / przejścia | Cel (szacunek) | Skąd spadek |
|---|---|---|---|
| Wpis kreatorem ogólnym, żądanie spółki (np. emisja) | 3 / 5 / 8 / 3 (`wpis-emisja`, spółka już w kartotece) + **dopisanie spółki do kartoteki: +8 pól, +4 kliknięcia** (`spolka-zadajacy-spoza-kartoteki`, zmierzone) | 1 ekran / 3 pola / 5 kliknięć / 1 | D-096 (−8 pól), D-097 (sprawa w tle, −1 przejście, −1 klik), „W jakim charakterze”, rodzaj dokumentu z typu (−2 pola) |
| Wpis z uprzednim powiadomieniem (np. obciążenie) | 3 / 6 / 11 / 3 (`wpis-obciazenie`, z B-003) | 1 / 5 / 7 / 1 | D-104 adresat domyślny (−1 pole), B-003 (−1 „Dalej” i ponowne odhaczenie), D-105 numery z doboru |
| Zbycie (K5) | 3 / 3 / 11 / 3 (`zbycie-ze-zgoda`); bez zgody zbywcy 4 / 4 / 13 / 5 (+ kolejka listów) | bez zmian (wzorzec) | — |
| Sprawa z portalu (K6) | 2 / 2 / 6 / 2 (`sprawa-z-portalu`) | 1 / 1 / 4 / 0 | D-098 (bez „Rozpocznij weryfikację”, −1 klik), podstawa z portalu (−2 pola) |
| Przejęcie rejestru (K3c, Etap 6–7) | 3 / 0 / 8 / 3 + 6 zaznaczeń (`przejecie-rejestru`) + B-004 | 1 / 0 / 7 / 1 | D-095 (bez pobierania i wgrywania protokołu: −2 czynności, −1 plik), B-004 |
| Wniosek w portalu (P1–P3) | 3 / 22 / 11 / 4 (`portal-nowa-spolka`, bez danych z KRS) | −5 pól spółki z KRS; e-mail akcjonariusza opcjonalny (D-099) | KRS (już jest — tu nieaktywny w atrapie), D-099 |

---

## 2. Błędy z testera i małpy

### 2.1 Błędy procesów (odtworzenie i przyczyna — `BLEDY.md`)

| Nr | Waga | Proces / ekran | Objaw | Przyczyna (miejsce) | Scenariusz |
|---|---|---|---|---|---|
| B-001 | B | K4 zajęcie, uchylenie zajęcia — wejście z kokpitu | „Podstawa” żąda żądającego przy komunikacie „wyłącznie z urzędu”; „Załóż sprawę” nieaktywne | efekt `zrodlo='z_urzedu'` z zależnością `[typ]`, a `definicjaTypu` ładuje się później (`kreator.js:1407`) | `wpis-zajecie`, `wpis-wykreslenie_zajecia` |
| B-002 | B | K4 sprostowanie | sprawa zakłada się, a w weryfikacji „typ nie jest jeszcze obsługiwany przez kreator” | brak budowniczego `sprostowanie` w `PRZYGOTOWANIA` (`server/logika/kreator.js:754`), typ mimo to w kreatorze | `wpis-sprostowanie` |
| B-003 | U | K4 typy z powiadomieniem | po „Wyślij powiadomienie” kreator wraca do „Co się zmienia”, checklista znika | `odswiez()` → `Spinner` zamiast drzewa (`sprawy.js:1053`) → `KreatorSprawy` od `useState(2)` | `wpis-obciazenie` i 4 inne |
| B-004 | B | K3c przejęcie → otwarcie | z ekranu przeniesienia do kokpitu; jedyne wejście to „Migracja z innego rejestru” (bez PRZEJĘCIA, przeniesienie nie dochodzi do „Aktywny”) | `przeniesienia.js:120` → `/spolki/:id` zamiast `/spolki/:id/otworz`; `kokpit.js:908` | `przejecie-rejestru`, `przejecie-otwarcie` |
| B-005 | B | K5 zbycie z ograniczeniem | pól „zgoda spółki” / „prawo pierwszeństwa wyczerpane” brak; serwer blokuje wpis | `ograniczeniaDlaDoboru` czyta `status`/`emisja_klucz`, a `GET /spolki/:id` daje `seria`/`numery` bez `status` (`wpis-zbycia-logika.js:88`, `widoki.js:194`); testy jednostkowe na niezgodnych danych | `zbycie-zgoda-spolki`, `zbycie-pierwszenstwo` |
| B-006 | B (390 px) | K11 „Listy do wysyłki” na telefonie | treści nachodzą na siebie, formularz nadania poza ekranem — „Zapisz nadanie” nieosiągalne | tabela na wąskim ekranie: komórka = jeden rząd flex bez zawijania (`rejestr.css:2557–2566`) | `zbycie-bez-zgody@390`, `zbycie-niepokryte@390` |

### 2.2 Małpa — każdy aktywny przycisk i link głównych ekranów w świeżym stanie

Małpa (`npm run e2e:malpa`): 27 głównych ekranów (18 kancelarii, 9 portalu), w sumie 190 elementów klikniętych w świeżym stanie ekranu
(pełne przeładowanie przed każdym kliknięciem). **Błędów JS: 0. Okien bez wyjścia: 0.** Odpowiedzi HTTP ≥ 400 — tylko na ekranie przeniesienia (niżej).

| Ekran | Zgłoszenie małpy | Ocena |
|---|---|---|
| `k-przeniesienie` | `POST … → 400` przy „→ Wstrzymane — rozbieżności” (bez opisu), „Dodaj dokument” (bez pliku), „Wgraj protokół podpisany przez notariusza” (bez pliku) | **A-033** — przyciski aktywne, choć wynik jest na pewno negatywny (D-052: blokować to, co na pewno niespełnione) |
| `p-konto` | „Zmień hasło” bez reakcji aplikacji — natywny dymek przeglądarki (`required`) | **A-020** |
| `k-kokpit` „Uproszczony”, `k-pulpit` „Pulpit”, `p-start` „Start”, `k-kreator-podstawa` „dziś” | brak zmiany — element już aktywny / data już dzisiejsza | bez znaczenia |
| `p-zgloszenie` „Wybierz plik”, `p-wniosek-dokumenty` „Wgraj podpisany dokument”, odnośnik mObywatel | systemowe okno wyboru pliku / odnośnik zewnętrzny (sieć testowa zamknięta) | bez znaczenia |
| `k-oplaty`, `p-wniosek-dokumenty` | część elementów zależy od stanu (menu, rozwinięte pozycje) — nie odnaleziono po przeładowaniu | ograniczenie małpy, nie aplikacji |
| `k-spolki`, `k-przeniesienia`, `k-wnioski`, `k-zawiadomienia`, `k-zgloszenia`, `p-platnosci` | 0–1 elementów do kliknięcia — wiersze list otwiera się kliknięciem `<tr onClick>` (bez łącza, przycisku, `tabIndex`) | **A-034** |

**Pola przyjmujące oczywiście błędne dane** (test „błędne dane”):

| Ekran / pole | Wartość | Wynik |
|---|---|---|
| Kreator — Podstawa: „Data wpływu” | data z przyszłości | przyjęta bez komunikatu (A-035) |
| Kreator — Podstawa: „Data dokumentu” | data z przyszłości | przyjęta bez komunikatu (A-035) |
| Zbycie — Podstawa: „Data umowy zbycia” | data z przyszłości | przyjęta, „Dalej” aktywne (A-035) |
| Listy — „Data nadania” | data z przyszłości | przyjęta, „Zapisz nadanie” aktywne (A-035) |
| Kartoteka — „Numer PESEL” | zła suma kontrolna | ostrzeżenie bez blokady — celowo (`pesel.js`), D-106 |
| Portal „Zgłoś się” — „Numer KRS spółki” | `00009ABC01` | odrzucone przy wysłaniu („dziesięć cyfr”) |

### 2.3 Dostępność (axe-core, WCAG 2.1 A/AA — każdy krok scenariuszy, 1440 i 390 px)

| Reguła axe | Wpływ | Kryterium WCAG | Kroki z naruszeniem | Scenariusze | Źródło (przykład) | Propozycja |
|---|---|---|---|---|---|---|
| `label` | krytyczny | 1.3.1, 3.3.2, 4.1.2 | 212 | 32 | `input.pole-pliku-ukryte` (90), `input[type=file]` (48), pola checklisty podpisu w portalu | ukryte pole pliku za przyciskiem bez nazwy dostępnej — `aria-label` z etykiety przycisku („Dołącz dokument”, „Wgraj podpisany dokument”); pola w `Pole` z więcej niż jednym dzieckiem nie dostają `htmlFor` |
| `select-name` | krytyczny | 1.3.1, 4.1.2 | 90 | 30 | `.row-g > select` (48) — lista typu dokumentu obok pliku („Dokumenty (opcjonalnie)”, `kreator.js:1633`), `select` bez `Pole` | nazwa dostępna (`aria-label`) albo `Pole`; A-005 usuwa tę listę w kreatorze |

Dwie reguły, obie z tych samych 3–4 komponentów — poprawka w komponencie (`Pole` z wieloma dziećmi, ukryte pole pliku) usuwa
naruszenia na wszystkich ekranach. Kontrast, nagłówki, landmarki, `aria-*` — bez naruszeń automatycznych (axe wykrywa ok. 30% problemów;
klawiatura — A-034; czytnik ekranu — nie testowany).

### 2.4 Układ (`sprawdzUklad`, R4)

`sprawdzUklad` przy każdym kroku: **1440 px — 0 problemów; 390 px — 26 scenariuszy z problemami** (`wyniki.json` → `problemy_ukladu`):

| Miejsce (390 px) | Problem | Ustalenie |
|---|---|---|
| Kreator ogólny — stopka („Załóż sprawę i przejdź dalej”, „Przelicz podgląd” + „Dokonaj wpisu”, „Wróć do kokpitu spółki”) | akcja główna wystaje poza kartę (`div.kreator-stopka-prawa`, np. 154–345 vs 65–325) — wszystkie 19 wpisów K4 | **A-037** (zbycie z `PasekAkcji` — bez problemu) |
| „Listy do wysyłki” z otwartym nadaniem | 11 problemów — formularz poza kartą | **B-006** |
| Przeniesienie — „Otwórz rejestr — PRZEJĘCIE” | przycisk szerszy niż karta (103–359 vs 65–325) | A-024 / A-032 |
| Lista przeniesień, płatności w portalu | ucięty tekst w komórkach (`scrollWidth > clientWidth`) | A-032 |
| Kolejka spraw | prawa część wiersza (stan, „7 dz.”, data) poza kartą (do 476 px przy 390) | A-032 |

Kontrola układu z R4 (`npm run zrzuty`, 9 ekranów): 39/39 — przy 390 px R4 sprawdzało ekrany bez otwartych formularzy w wierszach.

---

## 3. Ustalenia A-001…

Waga: **B** — blokuje, **U** — utrudnia, **K** — kosmetyka. Efekt: pola / kliknięcia mniej w typowej sprawie.
Pogrupowane w tematy (synteza: zasięg = liczba procesów, w których ustalenie występuje).

### T1. Dane wpisywane drugi raz (reguła 2) — 6 procesów

| Nr | Proces / ekran | Problem | Dowód | Waga | Propozycja | Podstawa | Efekt |
|---|---|---|---|---|---|---|---|
| A-001 | K4 „Podstawa” (każdy wpis na żądanie spółki) | Spółki nie ma w kartotece — żeby spółka była żądającym, trzeba ją dopisać jako osobę prawną (firma, KRS, adres) — dane, które są już w `psa_spolki` | `spolka-zadajacy-spoza-kartoteki` (krok 2–3), wyszukiwarka „Alfa” → pusto (`/api/psa/osoby?q=Alfa` → `[]`) | U | Spółka zawsze na liście żądających (pozycja „{firma spółki} — spółka”), bez osoby w kartotece (D-096) | art. 300(34) § 1 („na żądanie spółki”) | −8 pól, −4 kliknięcia (zmierzone), raz na spółkę |
| A-002 | P3 wniosek 1/4 i K3a nowa spółka 1/4 | Te same ~20 pól spółki w dwóch formularzach o innym układzie | `MAPA-DANYCH.md`, ekstraktor pól | U | Jeden formularz danych spółki (komponent) w obu miejscach; w kancelarii — z KRS albo z wniosku | operacyjna | spójność; −0 pól, ale jedna walidacja |
| A-003 | P3 2/4, K3a 1/4 | Reprezentant spółki (imię, nazwisko, PESEL, adres, e-mail) poza kartoteką — `psa_spolki.reprezentant_*`, `psa_wnioski.reprezentant_*`; AML reprezentanta osobno | schemat (`MAPA-DANYCH.md`) | U | Reprezentant jako osoba w kartotece, wybierany (D-101) | AML (🔵) / operacyjna | dane raz; AML raz |
| A-004 | K4 umorzenie, obciążenie, ograniczenie, zajęcie | Obok liczby akcji pole „Numery akcji” do wpisania; dobór automatyczny istnieje (`dobierzAkcje`, zbycie) | ekstraktor pól § 2.2 `MAPA-PROCESOW.md` | U | Dobór numerów jak w zbyciu, ręcznie za przyciskiem (D-105) | art. 300(33) § 1 pkt 6 | −1 pole na wpis |
| A-005 | K4 „Podstawa” | Rodzaj dokumentu wybierany dwa razy z tej samej listy: „Rodzaj dokumentu stanowiącego podstawę” i typ pliku w „Dokumenty (opcjonalnie)” | `kreator.js:42, 1612, 1633` | U | Jeden wybór; plik dziedziczy rodzaj | art. 300(34) § 4 | −1 pole |
| A-006 | K6 sprawa z portalu | Z portalu przychodzi typ i plik, a rodzaj i datę dokumentu pracownik wpisuje od nowa w oknie „Ustal podstawę wpisu” | `sprawa-z-portalu` krok 3 | U | Rodzaj dokumentu domyślny z typu (np. zbycie → umowa zbycia), data — z pliku albo jedno pole | art. 300(34) § 4 | −1 pole |
| A-007 | K13 kartoteka / K4 `zmiana_danych_akcjonariusza` | Adres akcjonariusza zmienia się dwiema drogami: edycją w kartotece i wpisem „Zmiana danych akcjonariusza” | `MAPA-PROCESOW.md` K13, `wpis-zmiana_danych_akcjonariusza` | U | Jedna droga (D-102) | art. 300(33) § 1 pkt 5 | — |

### T2. Kroki bez decyzji człowieka i proces rozbity (reguła 5) — 4 procesy

| Nr | Proces / ekran | Problem | Dowód | Waga | Propozycja | Podstawa | Efekt |
|---|---|---|---|---|---|---|---|
| A-009 | K4 kreator ogólny | 4 kroki na dwóch adresach; w środku „Załóż sprawę i przejdź dalej” (zmiana ekranu `#/spolki/:id/zdarzenie` → `#/sprawy/:id`); zbycie (K5) robi to samo w 3 krokach na jednym przebiegu | `wpis-*` kroki 3–4, przejścia | U | Jeden kreator 3 kroków dla wszystkich typów, sprawa zakładana w tle (D-097, rozszerzenie D-091) | operacyjna | −1 przejście, −1 kliknięcie |
| A-010 | K6 sprawa z portalu | „Rozpocznij weryfikację” — klik bez decyzji; ten sam przycisk dwa razy na ekranie (pasek akcji i karta) | `sprawa-z-portalu` krok 2 (Playwright: 2 elementy) | U | Weryfikacja zaczyna się sama przy otwarciu (jak K5, D-098) | operacyjna | −1 kliknięcie |
| A-011 | K3c przejęcie, Etap 7 | Protokół przejęcia: pobierz PDF → podpisz poza systemem → wgraj → dopiero otwarcie; protokół powstaje w całości z danych systemu (dokumenty + checklista Etapu 6) | `MAPA-PROCESOW.md` § 5, `przejecie-rejestru` krok 3 | U | Protokół generowany przy zamknięciu checklisty odbioru i dołączany do PRZEJĘCIA; zatwierdzenie notariusza = otwarcie rejestru (D-095) | brak ustawowej (wytyczne § 7.2 Etap 7 — „zatwierdzenie QES”) | −1 plik, −2 czynności |
| A-012 | K3c | „Otwórz rejestr — PRZEJĘCIE” widoczny jeszcze przed protokołem i checklistą; blokada wychodzi dopiero na końcu kreatora otwarcia | `przeniesienia.js:119` (`dozwolone_przejscia` bez przeszkód) | K | Przycisk aktywny, gdy `przeszkodyPrzejscia(…, 'aktywny')` puste; inaczej lista braków | D-052 | — |

### T3. Brak wartości domyślnych (reguła 3) — 3 procesy

| Nr | Proces / ekran | Problem | Dowód | Waga | Propozycja | Podstawa | Efekt |
|---|---|---|---|---|---|---|---|
| A-013 | K4 „Podstawa” | „W jakim charakterze” bez domyślnej, choć wynika z typu i osoby (spółka → spółka; obciążenie → zastawnik; zbycie → nabywca) | `wpis-*` krok „Podstawa” | U | Domyślna z typu (tabela § 4) | art. 300(34) § 1 | −1 pole |
| A-014 | K4 uprzednie powiadomienie | Adresat powiadomienia pusty; w zbyciu domyślny (zbywca, D-090) | `wpis-obciazenie` itd. — wymagał wyboru z kartoteki | U | Domyślny adresat = osoba, której prawa zmienia wpis (D-104) | art. 300(34) § 3 | −1 pole |
| A-015 | K4 typy z wyborem akcjonariusza | Wybór akcjonariusza z całej kartoteki (`WyborZKartoteki`) zamiast z akcjonariuszy z akcjami — da się wybrać osobę bez akcji (w teście wyszukanie „Testowa” trafiło na spółkę → „nie posiada akcji tej emisji”) | `wpis-pokrycie_akcji` (1. przebieg), W1 | U | Wybór osoby w trybie „z rejestru” tam, gdzie wpis dotyczy akcji akcjonariusza | art. 300(33) § 1 pkt 5–6 | mniej pomyłek |

### T4. Rozbieżne wzorce komponentów (reguła 6) — cała aplikacja

| Nr | Czynność | Problem (miejsca: `MAPA-PROCESOW.md` § 4) | Waga | Propozycja |
|---|---|---|---|---|
| A-016 | Pole daty | 4 natywne `<input type="date">` (nadanie listu, 2× przeniesienie, otrzymanie oryginału) obok 37 `PoleDaty` | K | `PoleDaty` wszędzie (z `max` tam, gdzie przyszłość nie ma sensu) |
| A-017 | Okno potwierdzenia | Przyciski „Potwierdź” zamiast nazwy czynności (wstrzymanie, odmowa, anulowanie, usunięcie listu); 9 × `window.confirm`, 5 × `alert` | K | **wprowadzone dla 4 okien (§ 8)**; `window.confirm` → `Modal` — plan |
| A-018 | Komunikat po wpisie | K4: „… — zdarzenie zapisane w rejestrze”, K5: „Zbycie akcji — wpis dokonany” (reguła 7) | K | **wprowadzone (§ 8)** |
| A-019 | Nowa osoba w trakcie wpisu | `FormularzOsoby` („Dodaj do kartoteki”) vs `NowyNabywca` w zbyciu („Zapisz w kartotece”, inny układ, 10 pól) | K | `FormularzOsoby` w obu; jedna nazwa |
| A-020 | Walidacja | Formularz zmiany hasła w portalu: natywny dymek przeglądarki (`required`, `minLength`), reszta aplikacji — `pole-blad` i `PodsumowanieBledow` | K | wzorzec aplikacji |
| A-021 | Pasek akcji | `PasekAkcji` tylko w sprawie i zbyciu; gdzie indziej przyciski w stopkach kart i `NawigacjaKreatora` | K | `PasekAkcji` we wszystkich kreatorach |
| A-022 | Podgląd danych | `ListaDanych` (8), `Metryka` (33), `Para` (8), tabele ad hoc | K | `ListaDanych` dla par etykieta–wartość |

### T5. Nazwy czynności (reguła 7, ux-copy) — 5 procesów

| Nr | Czynność | Nazwy dziś | Waga | Propozycja |
|---|---|---|---|---|
| A-023 | Zbycie akcji | „Przeniesienie akcji” (kokpit, nazwa typu, nagłówek sprawy), „Zbycie” (wiersz akcjonariusza), „Co się zbywa”, „Zbycie akcji — wpis dokonany” | K | Jedna nazwa w UI (D-100) |
| A-024 | Otwarcie rejestru po przejęciu | „Otwórz rejestr — PRZEJĘCIE (kreator stanu otwarcia)”, „Migracja z innego rejestru — stan otwarcia”, „Otwórz rejestr” (+ B-004) | U | „Otwórz rejestr” w całym przepływie |
| A-025 | Zapis nowej osoby | „Dodaj do kartoteki”, „Zapisz w kartotece”, „Gotowe” (akcjonariusz we wniosku), „Zapisz zmiany” | K | „Dodaj do kartoteki” / „Zapisz zmiany” |
| A-026 | Nowa spółka | przycisk „Dodaj spółkę”, ekran „Nowa spółka”, w portalu „Złóż wniosek” / „Zgłoś zainteresowanie” / „Wyślij zgłoszenie” | K | „Dodaj spółkę” (kancelaria), „Zgłoś spółkę” (portal) |
| A-027 | Zgłoszenia w portalu | „Złóż zgłoszenie” (żądanie wpisu), „Zgłoś błąd” (przycisk), „Zgłoś błąd we wpisie” (wejście), „Moje zgłoszenia” | K | „Zgłoś zmianę” / „Zgłoś błąd we wpisie” w obu miejscach |

### T6. Bez podstawy albo ponad podstawę (reguła 1) — 2 procesy

| Nr | Proces / ekran | Problem | Dowód | Waga | Propozycja | Podstawa |
|---|---|---|---|---|---|---|
| A-028 | P3 wniosek — akcjonariusz | E-mail każdego akcjonariusza wymagany (`formularz-osoby.js:100`, tryb portal), także przy „bez zgody na e-mail” — adres zbierany bez zgody; w kodzie i `DECYZJE.md` brak decyzji | `portal-nowa-spolka` krok 3 („Wpisz adres e-mail akcjonariusza.”; podsumowanie „bez zgody na e-mail” przy wpisanym adresie) | U | E-mail opcjonalny, wymagany przy zgodzie (D-099) | art. 300(33) § 1 pkt 5 (e-mail za zgodą) |
| A-029 | P6 zgłoszenie przeniesienia | „Okres wypowiedzenia (jeśli znany)” — informacyjne, nic go nie używa (data przejęcia ustalana w Etapie 5) | wytyczne 7.2 Etap 1 („informacyjnie”) | K | zostawić jako opcjonalne albo usunąć (decyzja przy D-095) | wytyczne (bez skutku w systemie) |

### Z przeglądu zrzutów (arkusze zbiorcze + zrzuty oznaczone przez heurystyki; `design-critique`)

| Nr | Ekran | Problem | Dowód | Waga | Propozycja |
|---|---|---|---|---|---|
| A-030 | K3c `#/przeniesienia/:id` | Wszystkie etapy naraz (status, Etap 3, Dokumenty, Etap 4, Etap 6, Etap 7) — bieżący etap niewyróżniony; przy „Uzgodnieniu” wciąż pełna checklista Etapu 3 | arkusz `przejecie-rejestru` 1440 (kroki 2–3) | U | Bieżący etap rozwinięty z jedną akcją główną; zakończone etapy zwinięte (podsumowanie + historia) — reguła 4 |
| A-031 | Kokpit, 390 px | Nazwa spółki w nagłówku łamana co słowo obok pola „Stan na dzień” i przycisków | arkusz `wpis-obciazenie` 390 (krok 1), `zbycie-bez-zgody` 390 | K | Nagłówek: nazwa na pełną szerokość, „Stan na dzień” pod nią |
| A-032 | Listy tabelaryczne, 390 px (przeniesienia, listy) | Tabele „etykieta: wartość” ściśnięte, długie wartości łamane nieczytelnie (patrz B-006 — ta sama reguła CSS) | arkusz `przejecie-rejestru` 390 (krok 1) | U | jak B-006 |

### Z małpy i testu błędnych danych

| Nr | Ekran | Problem | Dowód | Waga | Propozycja |
|---|---|---|---|---|---|
| A-033 | K3c `#/przeniesienia/:id` | „→ Wstrzymane — rozbieżności” bez opisu, „Dodaj dokument” i „Wgraj protokół…” bez pliku — aktywne, kończą się `400` | małpa `k-przeniesienie` | K | przycisk nieaktywny do wpisania opisu / wyboru pliku (D-052) |
| A-034 | Listy spółek, przeniesień, wniosków | Wiersz otwiera się tylko myszą (`<tr className="klikalna" onClick>`, `spolki.js:1119`, `przeniesienia.js:23`, `wnioski.js:67`) — bez łącza, `tabIndex`, obsługi Enter; `klikalna` bez stylu (jest tylko `.klikalny`) | małpa: 0–1 elementów na tych ekranach | U (WCAG 2.1.1) | nazwa w wierszu jako łącze (`<a href="#/spolki/1">`) — klawiatura, nowa karta; jedna klasa |
| A-035 | Kreator, zbycie, listy | Data z przyszłości wpisana z klawiatury przyjmowana bez komunikatu — `PoleDaty` stosuje `max` tylko w kalendarzu (`ui-rejestr.js` `PoleDaty`) | test „błędne dane” | U | `max` sprawdzany też dla wpisanej daty (komunikat pod polem) |
| A-036 | Kartoteka — PESEL | Zła suma kontrolna — ostrzeżenie bez blokady (celowo, `pesel.js`) | test „błędne dane” | K | D-106 |
| A-037 | Kreator ogólny, 390 px | Akcja główna wystaje poza kartę (stopka `kreator-stopka-prawa`) | `sprawdzUklad` — 19 scenariuszy K4 | K | `PasekAkcji` (jak zbycie) — przy D-097 znika |

### A-008 — powiadomienie listem: okno `alert`, mylący komunikat i możliwy drugi list (**wprowadzone**, § 8)

Zbywca bez zgody na e-mail → „Wyślij powiadomienie” → okno natywne „Brak zgody… pismo czeka w kolejce listów”. Po zamknięciu ekran
mówi przy „Dokonaj wpisu”: „…nie wysłano powiadomienia… Najpierw wyślij powiadomienie”, a „Wyślij powiadomienie” zostaje aktywne
(drugi klik = drugi list). Dowód: pierwsze przebiegi `zbycie-bez-zgody` przed zmianą (`dialogi_natywne`: „alert: Brak zgody na komunikację
e-mail — pismo czeka w kolejce listów…”) i `zbycie-niepokryte` (`stan_ekranu.przyciski` z „Wyślij powiadomienie” po wysłaniu);
po zmianie — asercje w `zbycie-bez-zgody` (komunikat w panelu, brak okna natywnego, brak przycisku).
Waga U. Podstawa: art. 300(34) § 3 (powiadomienie wysłane z dniem nadania — `listy.js`). Efekt: −1 kliknięcie, brak dubla listu.

---

## 4. Jeden wzorzec wpisu

Kreator trzech kroków **„Co” → „Podstawa” → „Sprawdzenie i wpis”** (jak zbycie, D-091), sterowany definicją typu (`definicjaWpisu`,
`wpis-zbycia-logika.js:103`) — rozszerzoną o pozostałe typy. Sprawa zakłada się w tle przy przejściu do kroku 3 (jak dziś w zbyciu).
Wspólne dla wszystkich typów:

- **Krok 2 „Podstawa”:** data dokumentu (`reczne`, wym.), plik (`reczne`, opc.), żądający (`domyslne` wg tabeli; spółka bez kartoteki — D-096),
  rodzaj dokumentu (`domyslne` z typu, ukryty — zmiana za przyciskiem), data wpływu (`auto` = dziś; ręcznie za przyciskiem — wpływ papierowy z datą wcześniejszą).
- **Krok 3:** pola warunkowe (tylko gdy rejestr tego wymaga), uprzednie powiadomienie z domyślnym adresatem (D-104) albo zgoda jednym polem (D-090),
  checklista typu (człowiek, D-052), podgląd, „Dokonaj wpisu” → „… — wpis dokonany”; osoba działająca `auto`.
- **Z portalu:** żądanie zakłada sprawę z wypełnionymi: typ, żądający (konto), data wpływu (= chwila zapłaty), plik; kancelaria otwiera sprawę od kroku 1
  z tymi danymi (bez „Rozpocznij weryfikację” — D-098), rodzaj dokumentu z typu.

| Typ | Krok 1 „Co” — pola (źródło) | Krok 2 — żądający domyślny / rodzaj dokumentu | Krok 3 — warunkowe | Powiadomienie (adresat domyślny) | Walidacja (przepis) | Dokumenty | Opłata |
|---|---|---|---|---|---|---|---|
| `emisja` | seria (reczne), liczba (reczne), nr pierwszej akcji (auto), data wpisu do KRS (reczne), rodzaj akcji (domyslne: zwykła), cena (reczne, opc.) | spółka / umowa spółki albo uchwała | — | — | art. 300(33) § 1 pkt 3–4, § 2 bilans (art. 300(31) § 2) | zawiadomienie o wpisie | tak |
| `objecie` | seria (rejestr: z nieobjętymi), obejmujący (kartoteka), liczba (reczne), numery (auto) | z emisji („Wpisz, kto objął akcje” — ta sama podstawa) | pokrycie (domyslne: brak informacji, D-089) | — | art. 300(33) § 1 pkt 5, 9 | jw. | tak |
| `przeniesienie` | **wzorzec (K5)**: zbywca (rejestr), liczba, nabywca (kartoteka), numery (auto) | nabywca / umowa zbycia | zgoda spółki, art. 300(40), pierwszeństwo (B-005) | zbywca | art. 300(34) § 3, § 6, art. 300(40), 300(42) | jw. + lista do KRS | tak |
| `przeniesienie_ulamka` | zbywca (rejestr), numer akcji (rejestr), ułamek (reczne), nabywca (kartoteka) | nabywca / umowa zbycia | jw. | zbywca | art. 300(43) | jw. | tak |
| `umorzenie` | akcjonariusz (rejestr), liczba, numery (auto), tryb (domyslne) | spółka / uchwała | — | akcjonariusz | art. 300(44) | jw. | tak |
| `uniewaznienie` | akcjonariusz (rejestr), liczba, numery (auto), sąd, sygnatura, data orzeczenia | spółka / postanowienie sądu | — | — | art. 300(51) | jw. | tak |
| `obciazenie` | akcjonariusz (rejestr), liczba, numery (auto), zastawnik/użytkownik (kartoteka), rodzaj (domyslne: zastaw) | zastawnik / umowa zastawu | ograniczenia rozporządzania | akcjonariusz | art. 300(33) § 1 pkt 6, 300(34) § 3 | jw. | tak |
| `prawo_glosu_zastawnika` | obciążenie (rejestr) | zastawnik / umowa | zakaz z umowy spółki (`zakaz_glosu_zastawnika_umowa`) | akcjonariusz | art. 300(33) § 1 pkt 7 | jw. | tak |
| `wykreslenie_obciazenia` | obciążenie (rejestr) | akcjonariusz / zgoda zastawnika | — | — | art. 300(33) § 1 pkt 8 | jw. | tak |
| `zajecie` ⚑ | organ (kartoteka, typ organ), dłużnik (rejestr), liczba/numery | **z urzędu** — bez żądającego; dokument: zawiadomienie organu | — | — (§ 2) | art. 300(34) § 2 | — | **nie** |
| `wykreslenie_zajecia` ⚑ | zajęcie (rejestr) | z urzędu | — | — | art. 300(34) § 2 | — | nie |
| `zobowiazanie` | akcjonariusz (rejestr), rodzaj (domyslne), seria (opc.), treść | uprawniony z zobowiązania / oświadczenie akcjonariusza | — | akcjonariusz | art. 300(34) § 4 | jw. | tak |
| `ograniczenie` | zakres (domyslne: seria), seria/numery (rejestr), wymaga zgody / pierwszeństwo (wybór), terminy zgody | spółka / umowa spółki | — | — | art. 300(33) § 1 pkt 10; komplet terminów zgody | jw. | tak |
| `uprawnienie` | rodzaj, zakres, akcjonariusz albo seria (rejestr), tytuł/treść | spółka / umowa spółki | — | — | art. 300(33) § 1 pkt 4, 11 | jw. | nie |
| `pokrycie_akcji` | akcjonariusz (rejestr), seria (rejestr), wzmianka (domyslne: tak) | spółka / uchwała zarządu (D-089) | — | — | art. 300(33) § 1 pkt 9 | jw. | nie |
| `zmiana_danych_akcjonariusza` | akcjonariusz (rejestr), nowe dane (z kartoteki — D-102) | akcjonariusz / oświadczenie | — | — | art. 300(33) § 1 pkt 5 | jw. | nie |
| `przedstawiciel` | akcja współwłasna (rejestr), przedstawiciel (współuprawniony) | współuprawniony | — | — | art. 300(38) § 3–4 | jw. | nie |
| `zdarzenie_inne` | opis (reczne) | spółka / dowolny | — | — | art. 300(33) § 2 | — | nie |
| `sprostowanie` ⚑ | zdarzenie (z historii), treść poprawiona, uzasadnienie | z urzędu albo żądający | — | osoba, której dotyczy zdarzenie | integralność (art. 300(31) § 4), D-… | jw. | nie |

⚑ **Odstępstwa od wzorca — najmniejsze możliwe:** zajęcie i uchylenie zajęcia — krok 2 bez żądającego (z urzędu), bez opłaty i powiadomienia
(art. 300(34) § 2) — to tylko inny zestaw pól tego samego kroku (B-001 wynika właśnie z tego, że dziś to stan, a nie definicja typu);
sprostowanie — krok 1 to wybór zdarzenia z historii, budowniczy istniejący (`przygotujSprostowanie`) — jedna droga zamiast trzech (D-103, B-002).
Poza wzorcem zostają (nie są wpisami na żądanie): otwarcie rejestru (nowa spółka / przejęcie — osobny kreator stanu otwarcia),
zmiana danych spółki (formularz danych spółki), przekazanie rejestru (okno).

---

## 5. Wspólne komponenty — lista docelowa

| Komponent | Gdzie dziś zastępowany innym | Liczba miejsc |
|---|---|---|
| `KreatorWpisu` (3 kroki, `definicjaWpisu`) | `EkranNowejSprawy` + `KreatorSprawy` (K4, 4 kroki na 2 adresach), okno `PodstawaWpisu` (K6) | 3 → 1 |
| `WyborOsoby` (tryb „z rejestru” / „z kartoteki”) | `<select>` akcjonariuszy (umorzenie, unieważnienie, zbywca) i `WyborZKartoteki` dla akcjonariusza (obciążenie, pokrycie, zobowiązanie, uprawnienie) | 11 |
| `FormularzOsoby` | `NowyNabywca` (zbycie), pola reprezentanta (wniosek, nowa spółka) | 3 |
| `PoleDaty` | natywne `type="date"` (`listy.js:65`, `przeniesienia.js:107, 110`, `wnioski.js:1156`) | 4 |
| `Modal` z `akcja` / `zamknij` (okno potwierdzenia) | `window.confirm` (9), `alert` (5; po § 8 — 4), przyciski „Potwierdź” (po § 8 — 0 w sprawach i listach) | 13 |
| `PasekAkcji` | stopki kart, `NawigacjaKreatora` (wniosek), przyciski etapów przeniesienia | ~6 ekranów |
| `ZnacznikKontaktu` | brak w liście akcjonariuszy kokpitu i w „Akcjonariusze” wniosku | 2 |
| `ListaDanych` | `Metryka`, `Para`, tabele ad hoc | ~40 |
| `PodgladWpisu` | podgląd w K4 („Przelicz podgląd”) i w K5 (automatycznie) | 2 |
| `FormularzSpolki` | P3 1/4 i K3a 1/4 | 2 |

---

## 6. Decyzje do podjęcia

| Nr | Pytanie | Propozycja | Skutek |
|---|---|---|---|
| **D-095** | Protokół przejęcia rejestru (Etap 7) — osobny dokument do podpisania i wgrania? | Nie jako osobny krok: protokół (dokumenty + skróty + checklista odbioru) generowany automatycznie przy zamknięciu checklisty Etapu 6, dołączany do zdarzenia PRZEJĘCIE; zatwierdzenie notariusza = „Otwórz rejestr” (osoba działająca w łańcuchu). Dokument wymagany: uchwała akcjonariuszy o wyborze podmiotu (art. 300(31) § 5) — jedno pole, dowolna dopuszczalna forma. | −1 plik, −2 czynności; znikają 7 kolumn `protokol_*`/`zatwierdzenie_*` z użycia; PDF zostaje jako wydruk |
| **D-096** | Spółka jako żądający wpisu | Spółka zawsze dostępna w „Żądający” (dane z `psa_spolki`, bez osoby w kartotece) | −8 pól i 4 kliknięcia przy pierwszym żądaniu spółki; brak drugiej kopii danych spółki |
| **D-097** | Jeden kreator wpisu | Wszystkie typy w przebiegu zbycia (3 kroki, `definicjaWpisu`), sprawa w tle | −1 przejście i −1 klik na wpis; znika B-003 (stan kreatora w jednym miejscu) |
| **D-098** | Sprawa z portalu — „Rozpocznij weryfikację” | Weryfikacja sama przy otwarciu sprawy przez pracownika (jak zbycie) | −1 klik; jedna akcja na ekranie |
| **D-099** | E-mail akcjonariusza we wniosku portalu | Opcjonalny; wymagany tylko przy zgodzie na komunikację e-mail | zgodność z art. 300(33) § 1 pkt 5; mniej danych bez zgody |
| **D-100** | Nazwa czynności „zbycie” / „przeniesienie” | W UI „Zbycie akcji” (przycisk, nagłówek sprawy, typ na liście spraw); w pismach — bez zmian (treść prawna) | jedna nazwa w przepływie |
| **D-101** | Reprezentant spółki | Osoba w kartotece, wybierana w spółce i wniosku | dane osobowe i AML raz |
| **D-102** | Zmiana adresu akcjonariusza | Jedna droga: zmiana w kartotece, a gdy dotyczy danych z art. 300(33) § 1 pkt 5 — aplikacja proponuje wpis (sprawa z wypełnionymi danymi) | koniec dwóch źródeł prawdy |
| **D-103** | Sprostowanie | Jedna droga: z historii zdarzeń (budowniczy `przygotujSprostowanie`); typ poza kafelkami kreatora | znika B-002 i ślepy zaułek |
| **D-104** | Adresat uprzedniego powiadomienia | Domyślny z typu (tabela § 4), jak D-090 | −1 pole na wpis z powiadomieniem |
| **D-105** | Numery akcji | Dobór automatyczny we wszystkich typach (jak zbycie), ręcznie za przyciskiem | −1 pole na wpis |
| **D-106** | PESEL ze złą sumą kontrolną | Dziś ostrzeżenie bez blokady (`pesel.js`, celowo). Zostawić czy blokować? Propozycja: zostawić ostrzeżenie (cudzoziemcy, stare nadania), ale pokazać je przy zapisie | bez zmian w danych |

---

## 7. Plan wdrożenia (kolejna sesja — od największego spadku pól i kliknięć)

1. **Błędy blokujące** (małe, pewne): B-004 (adres przycisku na ekranie przeniesienia — 1 linia), B-001 (zależność efektu — 1 linia),
   B-006 (reguła CSS tabel na wąskim ekranie — wspólna, z pełną regresją 390 px),
   B-005 (kształt ograniczeń dla kreatora + test na odpowiedzi API), B-002 (D-103: `kreator: false`), B-003 (odświeżanie bez `Spinner`).
   Regresja: usunąć `znanyBlad` / `test.fail` z odpowiednich scenariuszy.
2. **D-097 + D-104 + D-105 + A-013 + A-005** — jeden kreator z domyślnymi (największy spadek: ok. −4 pola i −3 kliknięcia na każdy wpis K4).
3. **D-096** — spółka jako żądający (−8 pól i −4 kliknięcia przy pierwszym żądaniu spółki).
4. **D-098 + A-006** — sprawa z portalu od razu w kreatorze, podstawa z portalu.
5. **D-095 + A-012 + A-024** — przejęcie: protokół automatyczny, „Otwórz rejestr” jedną nazwą.
6. **Komponenty** (§ 5): `PoleDaty`, `Modal` zamiast `confirm`/`alert`, `FormularzOsoby` w zbyciu, `PasekAkcji`.
7. **Dane:** D-101 (reprezentant), A-002 (jeden formularz spółki), D-099, D-102.
8. **Nazwy:** D-100, A-025–A-027.

Każdy etap kończy `npm test`, `npm run e2e` (i `npm run zrzuty` przy zmianach układu) przed STOP.

---

## 8. Zmiany frontendu wprowadzone w tej sesji

Na polecenie z tej sesji („co do frontend design — zastanów się, czy zmiana we frontendzie nie wpłynie pozytywnie na przepływ; jeśli tak,
możesz zmienić”). Kryterium: mniej kroków albo mniej niejasności w przepływie, bez zmian serwera, logiki wpisu i danych; nowy wygląd — nie.
Ocena wzorców (`frontend-design`, `ux-copy`): jedna nazwa czynności w całym przepływie, przycisk potwierdzenia nazywa skutek, jedna akcja główna.

| Ustalenie | Zmiana | Pliki | Weryfikacja |
|---|---|---|---|
| A-008 | Po „Wyślij powiadomienie” listem: zamiast `alert` — w panelu „Powiadomienie czeka w kolejce listów (adres z rejestru: …) — wpis będzie możliwy po nadaniu. Listy do wysyłki”; „Wyślij powiadomienie” ukryte, gdy list czeka (bez dubla); przy „Dokonaj wpisu” zamiast „Najpierw wyślij powiadomienie” — „wpis będzie możliwy po nadaniu listu” z odnośnikiem. Stan z `GET /api/psa/listy?status=do_wyslania` (dane już dostępne) | `publiczne/js/sprawy.js` (`useListPowiadomieniaWKolejce`, `przyczynaBlokadyWpisu`, `PanelPowiadomienia`, `KreatorSprawy`), `publiczne/js/wpis-zbycia.js` | `zbycie-bez-zgody` (asercja: komunikat, brak okna natywnego, brak przycisku), `zbycie-niepokryte` |
| A-017 | Przyciski okien nazywają czynność: „Wstrzymaj sprawę”, „Odmów wpisu”, „Anuluj sprawę” / „Zostaw sprawę”, „Usuń z wysyłki” / „Zostaw w wysyłce” (wzorzec R4 „Cofam zgodę” / „Zostaw zgodę”) | `sprawy.js` (`ModalPowod` z `akcja`, `zamknij`; `ModalWstrzymania`, `ModalOdmowy`), `listy.js` | `przeszkoda`, `list-usun-z-wysylki` |
| A-018 | Po wpisie kreatorem ogólnym: „{typ} — wpis dokonany” (było „— zdarzenie zapisane w rejestrze”), jak w zbyciu | `sprawy.js` | `wpis-*` |

Weryfikacja całości: `npm test` — 609 testów, 608 ✓, 0 ✗, 1 pominięty (próbki podpisów tylko lokalnie — tak samo przed zmianami);
`npm run e2e` — 94/94 (znane błędy jako `test.fail` z numerem B-…); `npm run e2e:malpa` — 28/28; `npm run zrzuty` (R4) — 39/39;
`npm run scenariusz:testowy` — 35 ✓, 0 ✗. Paczka `publiczne/dist/kancelaria.js` przebudowana (`npm run buduj`).
Wnioski z weryfikacji wprowadzone do zmiany A-008: po wysłaniu sprawa się odświeża i panel montuje się od nowa (B-003) —
przycisk „Wyślij powiadomienie” jest ukryty, dopóki stan listów się nie wczyta (bez chwilowego mignięcia i ryzyka drugiego listu).
