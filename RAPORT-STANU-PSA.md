# RAPORT-STANU-PSA — rejestr akcjonariuszy P.S.A., materiał do uproszczenia

Stan na 7.11.2026, commit `0565234`. Tryb tylko do odczytu: jedyny dodany plik to ten raport. Po testach przywrócono
`testy/e2e/raport/wyniki.json` i usunięto artefakty (`dane/`, `dokumenty/`, `test-results/`, `testy/e2e/raport/{czesci,arkusze,zrzuty}`).
Został ignorowany `node_modules/` (z `npm ci`). Odwołania podaję jako `plik:linia`, bez cytowania kodu i danych.

## 1. Testy i małpa

| Zestaw | Polecenie | Wynik | Czas | Niestabilne |
|---|---|---|---|---|
| Testy jednostkowe i HTTP (`node:test`, 66 plików) | `npm test` | 627 testów: 626 ✓, 0 ✗, 1 pominięty (`testy/podpisy.test.js:96`, brak lokalnych próbek podpisów) | ~40 s | 0 (3 przebiegi z identycznym wynikiem) |
| Scenariusze e2e (47 scenariuszy × szerokość 1440 i 390 px) | `npm run e2e` | 94/94 ✓, 0 przerwanych, 0 błędów JS i HTTP, 0 naruszeń axe, 0 problemów układu | 4,7 min | nie badano (1 przebieg) |
| Małpa (27 ekranów + test błędnych danych) | `npm run e2e:malpa` | 28/28 ✓ (test nie kończy się błędem, problemy trafiają do raportu): 207 klikniętych elementów, 29 zgłoszeń | 3,6 min | liczby zgłoszeń na każdym ekranie identyczne z poprzednim `wyniki.json` |
| Pokrycie testami (serwer) | `node --test --experimental-test-coverage` | 92,0% linii, 72,9% gałęzi, 90,5% funkcji | ~45 s | — |

Najsłabsze pokrycie gałęzi w module rejestru: `logika/walidacje.js` 67%, `logika/kreator.js` 74%, `logika/stan.js` 81%,
`trasy/spolki.js` 65%, `trasy/sprawy.js` 68%, `trasy/zgloszenia-nieprawidlowosci.js` 23%, `trasy/krs.js` 28%, `logika/dokumenty-tresc.js` 38%.

| Ekran małpy | Zgłoszenia | Przyczyna | Ocena |
|---|---|---|---|
| `p-wniosek-dokumenty` (podpis kompletu, `publiczne/js/portal.js`) | 17 | 12 × przycisk dokumentu znika po pierwszym kliknięciu; 4 × „Wgraj podpisany dokument” otwiera systemowe okno pliku; 1 × link mObywatel (strona zewnętrzna) | przepływ zależny od stanu: 3 kroki × N dokumentów × kilka form podpisu |
| `k-oplaty` | 7 | „Odhacz fakturę”, „Oznacz opłaconą”, „Anuluj” znikają po pierwszej akcji | przyciski zależne od 4 statusów opłaty |
| `k-kokpit` | 1 | „Uproszczony” to aktywny już przełącznik widoku | dwa widoki tej samej tabeli (`publiczne/js/kokpit.js:1051–1062`) |
| `k-pulpit`, `p-start`, `p-zgloszenie` | 3 | kliknięcie w bieżącą pozycję menu; systemowe okno „Wybierz plik” | błędy samego testera |
| błędne dane (10 pól) | 1 | kartoteka, nowa osoba: PESEL z błędną sumą kontrolną przyjęty z ostrzeżeniem, bez blokady | do decyzji |

## 2. Struktura

```
serwer.js (Express, port 3005)
server/trasy/        19 plików, 9 206 linii, 191 tras HTTP (portal 53, spolki 26, wnioski 20, sprawy 15); SQL wprost w trasach (275 × prepare)
server/rejestr.js    zapis zdarzeń, materializacja stanu, sprostowanie, otwarcie rejestru
server/logika/       41 plików, 12 192 linie: stan, walidacje, kreator, typy-zdarzen, przepisy, numery, ulamki, terminy, lancuch,
                     pisma (szablony, kontekst-pisma, dokumenty-tresc, docx, pdf), AML, tpay, zaproszenia
server/*.js          oplaty, platnosci, zawiadomienia, listy, przeniesienia, oswiadczenia, widoki, eksport, informacje, poczta, migracje
server/migracje.js   2 791 linii, 71 migracji → 39 tabel psa_*, 670 kolumn, 26 wyzwalaczy
server/pomocnicze/   autoryzacja, ciasteczka, czas, odpowiedzi, pliki
server/tryb-testowy/ atrapy KRS, poczty i tpay; 14 tras /test
publiczne/js/        38 plików, 19 378 linii, React 18 budowany przez esbuild do publiczne/dist
                     dwie aplikacje: kancelaria (index.html) i portal (portal.js, 2 273 linie)
testy/               66 plików node:test + testy/e2e (4 pliki scenariuszy, małpa, układ) — razem 16 633 linie
narzedzia/           budowanie, seed trybu testowego, scenariusz E2E, generatory dokumentacji
Zależności npm:      express, better-sqlite3, bcrypt, multer, nodemailer, pdfkit; dev: @playwright/test, esbuild, @axe-core/playwright
Zależności wewnętrzne: trasy → rejestr.js → logika/{stan, walidacje, kreator, lancuch}; trasy wołają też logika/* bezpośrednio;
                     SQL wykonuje 9 plików logika/ (dokumenty-wniosku, dziennik-dostepu, kontekst-pisma, osoba-dzialajaca,
                     pakiet-wniosku, przypomnienia, ustawienia, zaproszenia, znak-sprawy)
Dokumentacja:        26 plików .md w korzeniu + docs/ (razem 12 211 linii)
```

## 3. Model danych

| Obszar | Tabele (liczba kolumn) |
|---|---|
| Rdzeń rejestru | `psa_zdarzenia` (11; tylko dopisywanie, łańcuch skrótów), `psa_emisje` (17), `psa_stan_akcji` (17; materializacja), `psa_obciazenia` (15), `psa_uprawnienia` (12), `psa_ograniczenia` (16) |
| Podmioty | `psa_spolki` (74), `psa_osoby` (48), `psa_osoby_skany_aml`, `psa_osoby_dzialajace`, `psa_oswiadczenia` |
| Sprawy i pisma | `psa_sprawy` (33), `psa_dokumenty`, `psa_wydane_dokumenty` (19; 13 typów), `psa_listy` (18), `psa_szablony` |
| Opłaty | `psa_oplaty` (21), `psa_platnosci` (12), `psa_stawki_wersje` |
| Pozyskanie spółki | `psa_zgloszenia`, `psa_wnioski` (65), `psa_wnioski_akcjonariusze` (46), `psa_wnioski_dokumenty` (41), `psa_spolki_dokumenty`, `psa_przeniesienia` (24) z tabelami `_dokumenty`, `_historia`, `_archiwum` |
| Dostęp | `psa_uzytkownicy`, `psa_konta`, `psa_konta_spolki`, `psa_sesje_uniewaznione`, `psa_dziennik_dostepu`, `psa_dziennik_logowan`, `psa_zgloszenia_nieprawidlowosci` (16) |
| Techniczne | `psa_ustawienia`, `psa_kraje`, `psa_migracje`, `psa_baza_testowa` |

| Encja.pole | Wartości | Przejścia (gdzie) | Uwagi |
|---|---|---|---|
| sprawa.stan | nowa, weryfikacja, wstrzymana, wpisana, odmowa, anulowana | nowa→weryfikacja (`trasy/sprawy.js:506`); sprawa z urzędu startuje w weryfikacji (`:266`); weryfikacja↔wstrzymana (`:549`, `:593`); weryfikacja→wpisana (`rejestr.js:653`); weryfikacja/wstrzymana→odmowa (`:615`); nowa/weryfikacja/wstrzymana→anulowana (`:653`) | ukryty podstan „nowa + oczekuje_na_oplate” (`trasy/portal.js:1983`); warunki przejść rozproszone w `if`, bez tabeli przejść |
| wniosek.status | 7 (w_przygotowaniu … przyjety, odrzucony) | portal: →zlozony (`portal.js:837/968`), →umowa_podpisana (`:1232/1256`); kancelaria: 4 statusy→umowa_wygenerowana lub z powrotem →zlozony (`wnioski.js:262–285, 434`), każdy niezamknięty→do_uzupelnienia/odrzucony (`:525–736`), umowa_podpisana→przyjety (`:794–881`) | bez tabeli przejść; możliwe cofanie |
| przeniesienie.status | 8 | jawna tabela `PRZEJSCIA` (`logika/przeniesienie.js:42`) | jedyna encja z tabelą przejść |
| zgloszenie.status × rodzaj | nowe→zaproszono (`logika/zaproszenia.js:144`) / odrzucone (`trasy/zgloszenia.js:66`); rodzaj: nowy, przeniesienie | | |
| zgloszenie_nieprawidlowosci | nowe→zakwalifikowane, kwalifikacja ×3 (`trasy/zgloszenia-nieprawidlowosci.js:92`) | | kwalifikacja nie wywołuje żadnego skutku (`:16`) |
| list / opłata / płatność | do_wyslania→nadany/usuniety; naliczona→zafakturowana→oplacona, →anulowana; oczekuje→oplacona/nieudana/anulowana/wygasla | | |
| spolka.status | aktywna, w_likwidacji, zawieszona, wykreslona + pseudostatus `przekazanie_data` | wpis blokują tylko „wykreslona” i przekazanie (`logika/przepisy.js:436–448`) | w_likwidacji i zawieszona wpływają tylko na opłaty (`server/oplaty.js:261`) |
| emisja.status | aktywna, w_umarzaniu, umorzona, wykreslona | aktywna→umorzona (`stan.js:446`) | w_umarzaniu i wykreslona nigdy nie są ustawiane; unieważnienie nie zmienia statusu emisji |
| stan_akcji.kategoria | nieobjeta, akcjonariusz, umorzona, uniewazniona | nieobjeta→akcjonariusz→akcjonariusz→umorzona/uniewazniona (`stan.js:350–488`) | niezmiennik szczelnego pokrycia serii (`stan.js:825`) |
| obciążenie / uprawnienie / ograniczenie | otwarte→zamknięte; aktywne→wykreslone | obciążenie zwalnia osobny typ zdarzenia; uprawnienie i ograniczenie — ten sam typ z polem `wykresla_zdarzenie_id` (`stan.js:672, 696`) | dwa różne wzorce zwolnienia |
| osoba | typ ×2, aml_status ×3, zgoda_email 0/1 + zgoda_email_status ×3, pep ×5 + pep_oswiadczenie ×2, wspolwlasnosc ×3, adres rejestrowy ×3 | | |

## 4. Inwentarz kazuistyki

| # | Element | Gdzie | Co robi | Rozgałęzienia | Pokrycie testami |
|---|---|---|---|---|---|
| 1 | 22 typy zdarzeń | `logika/typy-zdarzen.js:48–510` | każdy typ ma 5 implementacji: katalog, `logika/kreator.js:119`, `logika/walidacje.js:422`, `logika/stan.js:350`, `publiczne/js/kreator.js:1147`, a do tego mapy w `publiczne/js/wpis-zbycia-logika.js:185–262` | ~100 | testy jednostkowe dla każdego typu (od 2 do 32 plików); e2e: 16 typów w kreatorze ogólnym + zbycie, objęcie, sprostowanie |
| 2 | Bramka „sprintu” | `typy-zdarzen.js:530–535`; `trasy/portal.js:1931` (próg 2); `trasy/sprawy.js:217` | numer sprintu filtruje typy; portal nie oferuje ułamków, pokrycia, przedstawiciela, unieważnienia | 2 progi | nie znaleziono testu progu portalu |
| 3 | `kreator: false` | 4 typy w katalogu | zmiana danych spółki, przekazanie, przejęcie i sprostowanie mają osobne ekrany i trasy | 4 | 1–8 plików |
| 4 | `wymaga_powiadomienia` = true/false/„zaleznie” | katalog; `trasy/sprawy.js:98, 293, 493`; `portal.js:1955`; `publiczne/js/kreator-wpisu.js:218` | „zaleznie” (sprostowanie) jest porównywane z `true`, więc działa jak false | 3 (1 martwa) | — |
| 5 | `z_urzedu` | zajęcie, wykreślenie zajęcia; `sprawy.js:226–266`; `portal.js:1932`; `kreator-wpisu.js:78, 132` | inny stan początkowy, bez żądającego, bez opłaty i bez powiadomienia | 5 warunków | 6 / 2 pliki |
| 6 | Źródło sprawy ×4 | `sprawy.js:47`; CHECK w `psa_sprawy` | „email” i „papier” działają tak samo; jedyny skutek źródła „portal”: przycisk zmiany rodzaju (`publiczne/js/sprawy.js:421`) | 4 (2 bez różnicy) | — |
| 7 | Rola żądającego ×8, kod odmowy ×7, rodzaj dokumentu podstawy ×7 | CHECK w `psa_sprawy`; `przepisy.js:549`; `wpis-zbycia-logika.js:185–230` | wartości domyślne zależne od typu; kod „inna” wymaga opisu | 22 + warunki | częściowo (sprawy-http, e2e D-096) |
| 8 | `oczekuje_na_oplate` | `portal.js:1983, 2026`; `trasy/oplaty.js:108`; `trasy/pozostale.js:176` | ukryty podstan sprawy zależny od tego, czy tpay jest skonfigurowany | 2 | 1 plik |
| 9 | `charakter_wpisu` | `przepisy.js:757`; `rejestr.js:673`; `logika/kontekst-pisma.js:302` | wpis konstytutywny albo deklaratoryjny, ustalany z typu i tytułu prawnego | 2 | 0 plików odwołuje się do tego pola |
| 10 | Ułamki akcji | `stan.js:489–575`; `logika/ulamki.js` | `przeniesienie_ulamka` i `przedstawiciel` mają ścieżkę osobną od `przenies` i `pula` | 2 typy | ulamki, sprint5, e2e |
| 11 | Współwłasność w kartotece | `psa_osoby` (wspolwlasnosc ×3, wspolwlasciciele, udzial_*); `logika/akcjonariusz.js:26–184`; 4 formularze frontu | drugi, opisowy model współwłasności, niezależny od ułamków w stanie akcji | 56 linii | **0 plików** |
| 12 | Pokrycie (tak, nie, czesciowo, NULL) | `przepisy.js:708`; `stan.js:581`; `walidacje.js:256–300` | blokuje zbycie akcji nie w pełni pokrytych bez zgody spółki | 4 | sprint5, pokrycie-d089, e2e |
| 13 | Rodzaj akcji ×4 | `przepisy.js:705`; `logika/kreator.js:129`; `publiczne/js/kreator.js:368–372` | „niema” ukryta w interfejsie (D-112), ale nadal przyjmowana przez API; „zalozycielska” istnieje obok reguły „pierwsza emisja = założycielska” (`walidacje.js:122`) | 4 + 2 reguły | — |
| 14 | Obciążenia: typ ×3 × blokada × prawo głosu | `stan.js:599–660`; `walidacje.js:581–660` | zastaw, użytkowanie i zajęcie w jednej tabeli, obsługiwane przez 5 typów zdarzeń | ~12 | nowe-typy, e2e |
| 15 | Uprawnienia: rodzaj ×3 × zakres ×3 + tryb wykreślenia | `stan.js:671–693`; `walidacje.js:669–684` | | 18 | 4 pliki |
| 16 | Ograniczenia: zakres ×3 × zgoda × pierwszeństwo + 3 pola warunków zgody + tryb wykreślenia | `stan.js:695–720`; `walidacje.js:190–255` | | ≥24 | 4–5 plików |
| 17 | Sprostowanie: 2 tryby × 3 wejścia | `stan.js:770–790` (podmiana treści albo wycofanie); interfejs: `kokpit.js:252` (tylko emisja), `kokpit.js:392` (dowolne zdarzenie, bez podmiany), kwalifikacja zgłoszenia (`kokpit.js:482–493`) | | 6 | nowe-typy, e2e D-103 |
| 18 | 6 dróg zapisu zdarzeń | `rejestr.js:486, 561, 609, 649, 722` + `zapiszZdarzenie` wołane z `trasy/spolki.js:469, 725` | różne zestawy kontroli: termin 7 dni, zawiadomienia i opłatę ma tylko droga przez sprawę | 6 | każda osobno |
| 19 | Wpis bez sprawy (z czasów sprintu 1) | `trasy/spolki.js:803–830`, wołany tylko z `publiczne/js/migracja.js:47` | omija obsługę sprawy | 1 | rejestr, d-r08 |
| 20 | `migracja_krn` | `rejestr.js:386–432` | jedyny wyjątek od zasady „data wpisu = teraz” | 2 | d-r08 |
| 21 | 5 dróg wejścia spółki | zgłoszenie → wniosek → przyjęcie (`wnioski.js:881`); „Dodaj spółkę” (D-124); otwarcie (`trasy/spolki.js:886`); migracja stanu (`#/spolki/:id/migracja`); przeniesienie → przejęcie | | 5 | p6, otworz-rejestr, przeniesienie-*, e2e |
| 22 | Osoba fizyczna / prawna | 42 porównania w 14 plikach (`publiczne/js/osoby.js` 8, `wnioski.js` 7, `wniosek.js` 6) | | 2 | rozproszone |
| 23 | `bez_pesel`, adres rejestrowy ×3 | 20 i 23 linie | | 2 + 3 | po 1 pliku |
| 24 | Zgoda e-mail w 3 miejscach | `psa_osoby.zgoda_email`, `zgoda_email_status`, `psa_oswiadczenia` (`server/oswiadczenia.js`) | 58 linii | 2 × 3 | 10 plików |
| 25 | PEP w 2 polach | `pep` ×5 + `pep_oswiadczenie` ×2 (+ `pep_opis`) | 40 linii | 7 | 4 pliki |
| 26 | Flagi spółki | `stosuje_procedure_aml`, `organ_rodzaj`, `zakaz_glosu_zastawnika_umowa`, `ograniczenie_dziedziczenia_umowa`, `umowa_sposob_zawarcia`, `umowe_zawarl` | | ~14 | 2–3 pliki |
| 27 | Flagi środowiska | `.env.przyklad`: 43 zmienne; zachowanie zmieniają PORTAL_WLACZONY, PSA_TRYB_TESTOWY (17 plików), PODGLAD_SYSTEMU, TPAY_TRYB_TESTOWY, POCZTA_TRANSPORT, POKAZ_ZNAK_IZBY | | 6 | tryb-testowy*, konfiguracja |
| 28 | Dane kancelarii w 2 źródłach | `.env` KANCELARIA_* (12 zmiennych) + `psa_ustawienia` (`logika/ustawienia.js:31–55`) | | 2 | konfiguracja |
| 29 | Bramka daty 18.02.2027 | 11 linii w 3 plikach; 3 odpowiedzi 501 (`trasy/pozostale.js:246, 457, 503`) | | 2 | — |
| 30 | Informacja z rejestru — 4 drogi | `trasy/spolki.js` (`informacja.html`, `stan`, `stan.csv`); wydruk z kokpitu; `/api/psa/informacje` (organy); portal (`/informacja/zamow`, `/:oplataId/wydaj`) | | 4 | e2e K12, P7–P9 |
| 31 | Wystawianie dokumentów — 3 trasy | `/dokumenty/wystaw` w `trasy/spolki.js`, `sprawy.js`, `wnioski.js` | | 3 | HTTP |
| 32 | Dobór numerów akcji — 2 algorytmy | front `wpis-zbycia-logika.js:43–86` (obciążone i niepokryte na końcu) vs serwer `logika/kreator.js:67–110` + `numery.js` (najniższe wolne, bez zablokowanych) | | 2 | wpis-zbycia-logika, numery |

## 5. Typy wpisów a podstawowe operacje na stanie akcji

| Typ | Operacja podstawowa | Mieści się? | Uwaga |
|---|---|---|---|
| emisja | wydanie (utworzenie puli nieobjętej) | tak | pula „nieobjęte” to konstrukcja aplikacji |
| objecie | wydanie (przypisanie akcjonariuszowi) | tak | |
| przeniesienie | przeniesienie | tak | |
| przeniesienie_ulamka | przeniesienie (część różna od 1/1) | tak | mieści się, jeśli przeniesienie przyjmie ułamek |
| umorzenie | umorzenie | tak | |
| uniewaznienie | umorzenie z inną podstawą (orzeczenie sądu) | tak | mechanika jak przy umorzeniu (`stan.js:428–488`) |
| obciazenie | obciążenie | tak | |
| zajecie | obciążenie (typ: zajęcie, z urzędu) | tak | ta sama struktura (`stan.js:619`) |
| wykreslenie_obciazenia, wykreslenie_zajecia | zwolnienie | tak | ten sam kod (`stan.js:640–646`) |
| prawo_glosu_zastawnika | zmiana istniejącego obciążenia | częściowo | to samo pole co przy ustanowieniu (`stan.js:608`) |
| zmiana_danych_akcjonariusza | zmiana danych akcjonariusza | tak | nie zmienia stanu akcji |
| sprostowanie | sprostowanie | tak | 2 tryby (podmiana / wycofanie) |
| **zmiana_danych_spolki** | — | **nie** | dane spółki, nie akcji |
| **przekazanie_rejestru**, **przejecie** | — | **nie** | cykl życia rejestru, nie stan akcji |
| **zobowiazanie** | — | **nie** | nie zmienia stanu; wg art. 300³⁴ § 4 KSH to podstawa wpisu przeniesienia lub obciążenia, a nie osobny wpis |
| **zdarzenie_inne** | — | **nie** | typ zbiorczy bez skutku |
| **uprawnienie**, **ograniczenie** | — | **nie** | atrybut serii lub zakresu numerów (art. 300³³ § 1 pkt 4, 10, 11), z własnym trybem wykreślenia |
| **pokrycie_akcji** | — | **nie** | atrybut akcji danej osoby (pkt 9) |
| **przedstawiciel** | — | **nie** | atrybut akcji współuprawnionych |

Wniosek: 13 z 22 typów mieści się w sześciu operacjach (w tym prawo_glosu_zastawnika częściowo). Wśród 9 pozostałych są 4 atrybuty akcji (uprawnienie, ograniczenie,
pokrycie_akcji, przedstawiciel). Razem z prawo_glosu_zastawnika tworzą jedną grupę „adnotacja na akcjach: dodanie i wykreślenie”.
Pozostałe 5 typów nie zmienia stanu akcji.

## 6. Przepis a dodatek aplikacji (podstawa: `PRZEPISY-PSA.md`)

| Element | Podstawa | Ocena |
|---|---|---|
| Bilans akcji (szczelne pokrycie serii) | art. 300³¹ § 2 KSH | przepis |
| Tylko dopisywanie + łańcuch skrótów | art. 300³¹ § 4 (bezpieczeństwo i integralność) | cel z przepisu, sposób (sha256) to dodatek |
| Blokada objęcia przed wpisem emisji do KRS | art. 300³⁰ § 2, 300¹⁰⁷ § 3, 592 § 3 | przepis |
| Katalog danych rejestru | art. 300³³ § 1 pkt 1–11 | przepis: 11 pozycji, którym w aplikacji odpowiada 22 typy zdarzeń |
| Pokrycie w 4 stanach | pkt 9: „czy w całości pokryte” (tak lub nie) | stan „czesciowo” i NULL to dodatek |
| Lista rodzajów akcji | pkt 4 (rodzaj, bez katalogu) | lista to dodatek; „założycielska” nie jest rodzajem akcji (D-114) |
| `zobowiazanie` jako osobny wpis | art. 300³⁴ § 4 (podstawa wpisu) | dodatek, przepis nie przewiduje osobnego wpisu |
| `sprostowanie` | nie ma przepisu wprost; wynika z 300³¹ § 2 i § 4. Katalog podaje art. 300³⁴ § 1 | dodatek konieczny, ale podstawa w katalogu nietrafna |
| `zdarzenie_inne` | ewentualnie art. 300³³ § 2 | dodatek |
| Wspólny przedstawiciel jako wpis | art. 300³⁸ § 3–4; brak w katalogu 300³³ § 1 | dodatek |
| Ułamki przypisane do numeru akcji | art. 300² § 3, 300⁴³ | przepis |
| Współwłasność w kartotece | brak | dodatek, dubluje model ułamków |
| Termin 7 dni; po usunięciu przeszkody pełne 7 dni | art. 300³⁴ § 1 | przepis; `dni_wstrzymania` to dodatek (statystyka) |
| Wpis z urzędu, bez opłaty | art. 300³⁴ § 2 | przepis |
| Powiadomienie przed wpisem; forma zgody | art. 300³⁴ § 3 zd. 1–2 | przepis (zd. 2 stosowane przed terminem, D-076) |
| Ograniczenia, zgoda spółki, pierwszeństwo, akcje niepokryte | art. 300³⁴ § 6, 300³⁹, 300⁴⁰, 300⁴² | przepis; 3 pola warunków zgody to szczegół z 300³⁹ § 3 |
| Zawiadomienie o wpisie i odmowie z podaniem przyczyny | art. 300³⁴ § 7 | przepis; katalog 7 kodów odmowy to dodatek |
| Lista akcjonariuszy do KRS | art. 300³⁴ § 8 (obowiązek **zarządu**) | dodatek: usługa dla spółki |
| Wpis konstytutywny i deklaratoryjny | art. 300³⁷ § 1–2 | przepis; pole w sprawie to dodatek |
| Rozróżnienie umorzenia i unieważnienia | art. 300⁴⁴–300⁴⁵, 300⁵¹ | przepis różni podstawę, mechanika jest wspólna |
| Prawo głosu zastawnika | art. 300²³ § 2, 300³³ § 1 pkt 7 | przepis |
| Maskowanie PESEL, daty urodzenia i adresu | art. 300³⁵ § 1¹ | przepis |
| Informacja z rejestru, także papierowa; dostęp organów z sygnaturą | art. 300³⁵ § 3–4 | przepis; 4 drogi wydania to dodatek |
| Portal z kontami i powiadomieniami na żądanie | art. 300³⁴ § 9 („mogą”) | przepis fakultatywny; zgłoszenia, wnioski i płatności w portalu to dodatek |
| Zgłoszenie zmian przez zarząd | art. 300³³ § 3 | przepis |
| Umowa o prowadzenie rejestru; kto ją zawarł | art. 300³² § 1, § 1² | przepis; wniosek z 7 statusami to dodatek |
| Przekazanie i przejęcie rejestru | art. 300³² § 2–3; art. 90a Prawa o notariacie; art. 83a ust. 4ac u.o.i.f. | skutek wynika z przepisu; proces z 8 statusami to dodatek |
| PESEL albo data urodzenia | art. 30 ustawy zmieniającej (od 18.02.2027) | przepis, stosowany przed terminem (D-076) |
| AML: status „niemozliwe” blokuje wpis | ⚠️ — `PRZEPISY-PSA.md` § 13 zakazuje blokad opartych na pozycjach ⚠️ | dodatek sprzeczny z § 13 (`walidacje.js:377–378`; D-010, D-117) |
| Stawki opłat | § 15b rozporządzenia (taksa) | przepis; płatność przez tpay to dodatek |
| Dziennik dostępu (5 lat), zgłoszenie nieprawidłowości, statusy w_likwidacji i zawieszona | brak przepisu | dodatki |

## 7. Duplikacje, martwy kod, TODO/FIXME, rozbieżności z README

**Duplikacje.** (a) Współwłasność opisana dwa razy: ułamki w stanie akcji (`stan.js:489`) i pola kartoteki
(`logika/akcjonariusz.js:26–184`). (b) Dane osoby w dwóch tabelach: `psa_osoby` (48 kolumn) i `psa_wnioski_akcjonariusze` (46).
(c) Dane spółki i reprezentanta: `psa_spolki` (74) i `psa_wnioski` (65); 16 kolumn `reprezentant_*` jest w obu.
(d) Zgoda e-mail w 3 miejscach; PEP w 2 polach; dane kancelarii w `.env` i w `psa_ustawienia`.
(e) Prawie identyczne handlery: `zajecie`/`obciazenie`, `wykreslenie_zajecia`/`wykreslenie_obciazenia`, `umorzenie`/`uniewaznienie`
(`stan.js:428–488, 599–646`). (f) Prawo głosu ustawiane na dwa sposoby: pole przy ustanowieniu (`stan.js:608`) i osobny typ (`stan.js:660`).
(g) Dobór numerów akcji liczony na froncie i na serwerze (§ 4 poz. 32). (h) Stan otwarcia na dwa sposoby: `publiczne/js/migracja.js`
(seria wywołań `POST /zdarzenia`) i `POST /:id/otworz-rejestr` (jedna transakcja). (i) 3 trasy `/dokumenty/wystaw`.
(j) Dwa generatory pism: stary `dokumenty-tresc.js:114–190` (nieużywany) i nowy `szablony.js` + `kontekst-pisma.js`.
(k) Pliki: `nowy-projekt/nowa-strona.html` ≡ `projekt-strony/nowa-strona.html`; `publiczne/obrazy/notariat.png` ≡
`projekt-strony/notariat.png`; blok „Tester e2e” powtórzony w `.gitignore`.

| Martwy kod | Miejsce | Testy |
|---|---|---|
| `zawiadomienieWpis`, `zawiadomienieOdmowa`, `powiadomienieZamierzonegoWpisu` | `logika/dokumenty-tresc.js:114, 140, 164` | 1 / 0 / 0 |
| `zapiszOdczytRejestruPortalu`; `widziWrazliweDaneInnych`; `przydziel` | `dziennik-dostepu.js:51`; `maskowanie.js:95`; `numery.js:179` | 0 |
| `wymagaPowiadomienia`, `pozycjeWymagane` | `typy-zdarzen.js:538, 548` | 0 |
| `STAWKI_DO_WERYFIKACJI`, `ROLE_PELNY_DOSTEP`, `OPISY_STATUSOW_ZGODY_EMAIL`, `OPISY_RODZAJOW_WSPOLWLASNOSCI` | `przepisy.js:129, 325, 647, 664` | 0 |
| `posrednik`; `wersjaStawek`; `FUNKCJE` | `pomocnicze/ciasteczka.js:48`; `ustawienia.js:93`; `osoba-dzialajaca.js:16` | 0 |
| Statusy emisji `w_umarzaniu`, `wykreslona`; wartość „zaleznie” | `przepisy.js:452, 454`; katalog typów | nigdy nie ustawiane / zawsze traktowana jak false |
| Kolumny bez odwołań w kodzie (poza migracjami) | `psa_spolki` i `psa_wnioski`: data_ostatniego_wpisu_krs, siedziba_miejscownik, reprezentant_biernik_recznie, reprezentant_funkcja_biernik_recznie; `psa_wydane_dokumenty`: sciezka_pdf, szablon_wersja; `psa_zgloszenia_nieprawidlowosci`: zalacznik_* (4); `psa_szablony.wbudowany`; `psa_kraje`: nazwa_klucz, nazwa_en_klucz | — |
| Ekran deweloperski za flagą | `publiczne/js/podglad.js` (545 linii), `PODGLAD_SYSTEMU` | 0 |

**TODO/FIXME/XXX/HACK:** 0 trafień w `server/`, `publiczne/js/`, `narzedzia/`, `testy/`.

| README.md | Stan kodu |
|---|---|
| `:6` „Stan: sprint 5 ukończony” | ukończone są też sprint 6, R4 i etapy 1–5 analizy przepływów (DECYZJE do D-124) |
| `:46`, `:480` React z Babelem z CDN, bez bundlera | esbuild buduje `publiczne/dist` (tak mówią też README `:8` i `publiczne/index.html:22`) |
| `:481` `publiczne/wspolne/design.css` | katalog nie istnieje |
| `:455` migracje v1–v5; `:479` 9 plików tras | 71 migracji; 19 plików w `trasy/` (`krs.js` jest modułem pomocniczym, nie routerem) |
| `:461`, `:496` „logika/* bez dostępu do bazy” | SQL wykonuje 9 plików `logika/` |
| `:275`, `:457`, `:490`, `:1029`, `:1073` naliczenie roczne | usunięte (D-121; `server/oplaty.js:281`) |
| `:826` unieważnienie akcji w „sprincie 7, niezaczętym” | typ `uniewaznienie` działa (`stan.js:460`, e2e) |
| `:909–910` aktywacja konta tylko ręcznie | jest `logika/zaproszenia.js` i scenariusz e2e P1–P3 (zaproszenie → aktywacja) |
| `:839` brak formularza sprostowania w interfejsie | formularz jest: `kokpit.js:245–282` (podmiana tylko dla emisji) i `kokpit.js:392` |
| `:963` 159 testów; `:823` `SESJA-PSA-5-INTERFEJS.md` | 627 testów; plik nazywa się `SESJA-PSA-6-INTERFEJS.md` |
| D-112: „niema” usunięta | `przepisy.js:705` i `logika/kreator.js:129` nadal ją przyjmują; `/api/psa/meta` ją zwraca (`pozostale.js:128`) |

## 8. Top 10 kandydatów do usunięcia lub scalenia

| # | Kandydat | Uzasadnienie | Ryzyko |
|---|---|---|---|
| 1 | Usunąć typ `zobowiazanie`; zrobić z oświadczenia rodzaj dokumentu podstawy przeniesienia lub obciążenia | art. 300³⁴ § 4 mówi o podstawie wpisu, nie o wpisie; typ nie zmienia stanu; −5 implementacji | zdarzenia tego typu w łańcuchu nie mogą zniknąć: odtwarzanie musi je nadal czytać (append-only) |
| 2 | Scalić `zajecie` i `wykreslenie_zajecia` z `obciazenie` i `wykreslenie_obciazenia` (typ obciążenia „zajęcie” + źródło z urzędu) | identyczne struktury i handler; różnią się tylko flagą z urzędu i brakiem opłaty | wpis z urzędu jest wolny od opłat i bez powiadomienia (art. 300³⁴ § 2) — te reguły trzeba przenieść do nowej flagi; zajęcia nie wolno wykreślić drogą zwykłego obciążenia (`walidacje.js:610`) |
| 3 | Scalić `uniewaznienie` z `umorzenie` (jedna operacja, pole „podstawa: uchwała / orzeczenie sądu”) | ta sama mechanika; dziś niespójny status emisji (`stan.js:446` tylko dla umorzenia) | rejestr i wydruk dla sądu muszą nadal rozróżniać kategorie (`stan.js:450–459`) |
| 4 | Usunąć współwłasność z kartoteki (`wspolwlasnosc`, `wspolwlasciciele`, `udzial_*`) | dubluje model ułamków ze stanu akcji; 56 linii; 0 testów; dwa źródła prawdy | dane już wpisane w kartotece i wnioskach; trzeba sprawdzić, czy trafiają do pism (`informacja-dokument.js:604`) |
| 5 | Jedna grupa „adnotacja na akcjach” zamiast uprawnienia, ograniczenia, pokrycia, przedstawiciela i prawa głosu, z jednym wzorcem wykreślenia | dwa wzorce zwolnienia (osobny typ albo `wykresla_zdarzenie_id`); 5 × 5 implementacji | ograniczenia blokują wpis (art. 300³⁴ § 6), a pokrycie blokuje zbycie (art. 300⁴⁰); trzeba zachować te dwie reguły |
| 6 | Scalić `przeniesienie_ulamka` z `przeniesienie` (ułamek domyślnie 1/1) | ten sam skutek prawny (art. 300⁴³); osobna ścieżka w `stan.js:489–558` i osobny krok frontu | arytmetyka ułamków pracuje na pojedynczym numerze akcji, a `pula` liczy całe numery — wysokie ryzyko regresji bilansu |
| 7 | Usunąć wpis bez sprawy (`POST /spolki/:id/zdarzenia`) i ekran migracji; zostawić `otworz-rejestr` | trasa z czasów sprintu 1, omija termin, zawiadomienia i opłatę; dubluje otwarcie rejestru | `migracja_krn` (historyczne daty z KRN) musi przejść do drogi otwarcia lub przejęcia |
| 8 | Ujednolicić sprostowanie: jedna droga, zawsze z treścią zastępczą | dziś 2 tryby × 3 wejścia; podmiana treści działa tylko dla emisji; „zaleznie” jest martwe | sprostowanie bez treści zastępczej „wycofuje” zdarzenie — trzeba rozstrzygnąć, czy ten skutek ma zostać |
| 9 | Usunąć bramkę „sprintu” i flagi zastępcze z katalogu (`sprint`, `SPRINT_KREATORA`, próg 2 w portalu, `wymaga_powiadomienia: 'zaleznie'`) oraz nieużywane eksporty z § 7 | numer sprintu to stan budowy, nie reguła prawna; martwy kod | portal zacznie pokazywać typy sprintów 5–6, jeśli zakres portalu nie zostanie podany wprost |
| 10 | Jedno źródło danych pomocniczych: zgoda e-mail (3 → 1), PEP (2 → 1), dane kancelarii (`.env` lub `psa_ustawienia`), źródło sprawy (email = papier), statusy emisji i spółki bez skutku | każdy duplikat to możliwy rozjazd; skutek tylko w etykietach | historia zgody (`psa_oswiadczenia`) jest dowodem (art. 300³³ § 1 pkt 5) — ją zachować; inne pola wymagają migracji danych |

Poza listą do decyzji: blokada AML przy statusie „niemozliwe”, sprzeczna z `PRZEPISY-PSA.md` § 13 (§ 6), oraz PESEL z błędną sumą
przyjmowany z ostrzeżeniem (§ 1).
