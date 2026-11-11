# Raport FAZA 0 — inwentaryzacja komponentów/formularzy + odtworzenie B1–B12

Repo: `/home/user/Proste-Spolki-Akcyjne`. Praca czysto diagnostyczna — żaden plik repo nie został zmieniony.
Serwer audytowy uruchamiany na porcie 4003 z izolowaną bazą `dane/.audit-b1b12.db`; zatrzymany na końcu pracy (`pkill -9 -f "PORT=4003"` — proces już nie istniał, killa nie było czego wykonać, potwierdzone brakiem wpisów w `ps aux`).

---

## CZĘŚĆ A — inwentarz komponentów i formularzy

### A.1 Stare (`ui.js`) vs nowe (`ui-rejestr.js`) komponenty

Nagłówek `ui.js` (linie 1–7) mówi wprost: prymitywy Karta/Pole/Modal/Sekcja/Komunikat/Pusto/Spinner **są już nadpisane** nowszymi wersjami z `ui-rejestr.js`, ładowanego zaraz po `ui.js` (patrz kolejność `<script>` w `publiczne/index.html:28-31` i `publiczne/portal.html:25-27`). W `ui.js` zostały wyłącznie komponenty, których `ui-rejestr.js` jeszcze nie ma: **Znacznik, StatusSpolki, StatusAml, ZnacznikPrzegladuAml, Wyniki, WyborOsoby**.

Ponieważ JS-owe `<script>` nadpisują globalne `window.X` w kolejności ładowania, każdy plik używający np. `<Pole>` faktycznie dostaje wersję z `ui-rejestr.js` (nowszą), niezależnie od tego, że `ui.js` też definiuje `Pole` — więc "duplikaty" nie są dziś problemem funkcjonalnym, tylko martwym kodem w `ui.js` (Karta, Pole, Modal, Sekcja, Komunikat, Pusto, Spinner zdefiniowane tam nigdy się nie wykonują).

Realny stan migracji — komponenty istniejące WYŁĄCZNIE w `ui.js` (czyli to, co faza 2–4 ma jeszcze przepisać) i kto ich używa:

| Komponent (tylko ui.js) | Pliki używające | Uwagi |
|---|---|---|
| `Znacznik` | konfiguracja.js, oplaty.js, portal.js, sprawy.js, szablony.js, uzytkownicy.js, wniosek.js, wnioski.js, zgloszenia.js (+ ui.js) | Odpowiednik w ui-rejestr.js to `Pigulka` (ui-rejestr.js:152) — funkcjonalnie bardzo podobny (span z klasą wariantu), ale **nikt jeszcze nie zamienił `Znacznik` na `Pigulka`**, mimo że oba systemy współistnieją. To ok. 9 plików do migracji. |
| `StatusSpolki` | kokpit.js, spolki.js | Owija `Znacznik` (ui.js:95-101) — zależny od migracji Znacznika. |
| `StatusAml` | osoby.js | j.w. |
| `ZnacznikPrzegladuAml` | osoby.js, sprawy.js | j.w. |
| `Wyniki` | sprawy.js | Owija (nadpisany) `Komunikat` — mimo że `Komunikat` sam jest już z ui-rejestr.js, `Wyniki` jako całość wciąż mieszka w ui.js. |
| `WyborOsoby` | dokumenty-na-zadanie.js, kreator.js, sprawy.js | Brak odpowiednika w ui-rejestr.js (nie ma np. `WyborZOsob`) — to największy kawałek logiki (wyszukiwarka + inline „+ Nowa osoba w kartotece" otwierające `FormularzOsoby`), której ui-rejestr.js nie replikuje. Najkosztowniejsza migracja z całej listy. |

Komponenty ui-rejestr.js i ich zasięg (wybrane; pełna lista 34 komponentów w pliku) — pokazuje, że **prawie cała aplikacja już korzysta z nowego systemu pól** (Pole, PoleDaty, Komunikat, Karta, Ikona, Pigulka), ale kilka ekranów wciąż nie korzysta z wyspecjalizowanych `PoleLiczbowe`/`PoleKwoty`/`WyborZKartoteki`:

| Komponent ui-rejestr.js | Pliki używające | Obserwacja |
|---|---|---|
| `Pole` | auth, dokumenty-na-zadanie, kokpit, kreator, migracja, oplaty, osoby, podglad, portal, spolki, sprawy, uzytkownicy, wniosek, wnioski (14 plików) | Pełna migracja z ui.js zakończona. |
| `PoleDaty` | kokpit, kreator, migracja, osoby, podglad, portal, spolki, sprawy, wydruk (9) | OK. |
| `PoleLiczbowe` | **tylko** podglad.js, spolki.js | `kreator.js` (kreator zdarzenia — emisja, cena emisyjna, ilość akcji) **NIE używa `PoleLiczbowe`**, tylko surowe `<input type="number">` (patrz B7) — to bezpośrednia przyczyna błędu z groszami. |
| `PoleKwoty` | tylko podglad.js, spolki.js | Podobnie: kreator.js nie używa dedykowanego pola do kwot/grosze mimo że pole istnieje i jest gotowe. |
| `WyborZKartoteki` | tylko podglad.js | Nowy odpowiednik `WyborOsoby` istnieje, ale jest używany w JEDNYM miejscu — reszta aplikacji (kreator, sprawy, dokumenty-na-zadanie) nadal na starym `WyborOsoby` z ui.js. |
| `Modal`, `Sekcja`, `Komunikat`, `Pusto`, `Karta`, `Ikona`, `Kroki` | szeroko | Zmigrowane (nadpisują ui.js). |

**Wniosek #1 (najważniejszy z inwentarza):** migracja NIE jest kwestią „ile plików używa starych komponentów" (bo nadpisywanie window.X już ją częściowo maskuje) — realny dług to (a) ok. 9 plików wciąż wołających `Znacznik` zamiast `Pigulka`, i (b) **`kreator.js` (kreator zdarzenia) w ogóle nie korzysta z `PoleLiczbowe`/`PoleKwoty`/`WyborZKartoteki`**, mimo że są one gotowe i używane gdzie indziej — to jest zarówno dług migracyjny, jak i bezpośrednia przyczyna B7.

### A.2 Inwentarz przycisków (próbka: logowanie, kreator spółki, kreator zdarzenia, wniosek portalowy)

| Etykieta | Plik:linia | Rola (po className) | Mówi wprost co się stanie? |
|---|---|---|---|
| „Zaloguj się" / „Logowanie…" | auth.js:114-121 | główny (`btn btn-glowny btn-duzy`), `type="submit"` | TAK |
| „+ Nowy pracownik" | uzytkownicy.js:114 | główny (`btn btn-glowny`) | TAK |
| „Resetuj hasło” | uzytkownicy.js:148 | drugorzędny (`btn btn-sm`) | TAK, ale bez ostrzeżenia że stare hasło od razu przestanie działać (brak `title`/potwierdzenia) |
| „Zablokuj” / „Odblokuj” | uzytkownicy.js:149-151 | drugorzędny, zmienia etykietę wg stanu | TAK |
| „Usuń” | spolki.js:158 | destrukcyjny (`btn btn-maly btn-sygnal`) | NIEJEDNOZNACZNE — „Usuń” bez obiektu w etykiecie (co dokładnie usuwa — wiersz? spółkę? załącznik?), trzeba znać kontekst wiersza tabeli. |
| „Otwórz rejestr” | spolki.js:827 | główny (`btn btn-glowny btn-duzy`), `disabled` dopóki nie zaznaczone wszystkie checkboxy | TAK, ale etykieta nie mówi że to operacja NIEODWRACALNA (rejestr „nie da się cofnąć" wg auth.js:26) — brak sygnału wagi decyzji na samym przycisku, tylko w treści strony. |
| „Anuluj” / „Wstecz” | kreator.js:1582 | drugorzędny (`btn`), etykieta zależna od kroku | TAK, kontekstowo jasne; „Anuluj” na kroku 0 pyta `window.confirm` tylko gdy coś wpisano (dobra praktyka). |
| „Dalej” | kreator.js:1587 | główny (`btn btn-glowny`) | NIEJEDNOZNACZNE — nie mówi do czego „dalej” (typowe dla wizardów, ale nie mówi np. że krok 2 zablokuje edycję typu zdarzenia). |
| „Załóż sprawę i przejdź dalej” / „Zakładanie sprawy…” | kreator.js:1590-1592 | główny, duży (`btn btn-glowny btn-lg`), stan ładowania podmienia etykietę | TAK — bardzo dobry przykład etykiety opisującej efekt. |
| „Złóż wniosek” / „Składanie…” | wniosek.js:1298 (etykieta), przycisk ~1250 (`btn btn-glowny btn-duzy`) | główny | TAK |
| „+ Nowa osoba w kartotece” | ui.js:313-315 (używane przez kreator.js, sprawy.js, dokumenty-na-zadanie.js przez `WyborOsoby`) | drugorzędny (`btn btn-sm`) | TAK |
| „Zmień” (w `WyborOsoby` po wybraniu osoby) | ui.js:252-260 | drugorzędny | NIEJEDNOZNACZNE — „Zmień” bez dopełnienia (zmień co? wybór osoby, ale w oderwaniu od reszty ekranu nie jest oczywiste). |
| „Ustaw hasło” (przycisk submit aktywacji portalu) | portal.js:362-364 (fragment, treść przycisku dalej w pliku) | główny, duży | TAK (kontekstowo — cały ekran to „Aktywacja konta”). |
| „← Wróć do logowania” | portal.js:291 | cichy/drugorzędny (`btn btn-cichy`), `type="button"` | TAK |
| „Zgłoś zmianę” | portal.js:770 | drugorzędny (`btn`) | NIEJEDNOZNACZNE dla laika — „zmiana” w rejestrze brzmi ogólnie; nie odróżnia się jasno od „zgłoszenia nieprawidłowości” (patrz B9) — użytkownik portalu może pomyśleć, że to miejsce na zgłoszenie błędu w istniejącym wpisie, a to w rzeczywistości formularz ŻĄDANIA NOWEGO zdarzenia (zbycie/emisja/uprawnienie). |

**Wniosek #2:** przyciski główne akcji zapisu (kreator, wniosek, logowanie) konsekwentnie zamieniają etykietę na czas trwający („Zapisywanie…”, „Składanie…”, „Zakładanie sprawy…”) — dobry, powtarzalny wzorzec w całej appce. Słabym punktem są etykiety jednosłowne bez obiektu („Usuń”, „Zmień”, „Dalej”) powtarzające się w wielu miejscach — nie łamią wprost zasad, ale są niejednoznaczne poza kontekstem wizualnym wiersza/karty.

### A.3 Inwentarz formularzy

**Logowanie pracownika kancelarii** (`auth.js:90-122`, prawdziwy `<form onSubmit>`):
| Pole | typ input | inputMode | autoComplete | Walidacja — gdzie/kiedy | Wymagane — podstawa |
|---|---|---|---|---|---|
| E-mail | `email` | — | `username` | Brak walidacji formatu w JS; przycisk `disabled` dopóki `!email.trim()`; błąd serwera pokazywany w `Komunikat odmiana="blad"` NAD formularzem (górą) | `wymagane` na `<Pole>`, ale bez odwołania do reguły z CLAUDE-PSA.md w komentarzu — brak podstawy w komentarzu |
| Hasło | `password` | — | `current-password` | jw., `disabled` gdy `!haslo` | jw., brak podstawy w komentarzu |

**Aktywacja konta w portalu** (`portal.js:301-365`, `<form onSubmit={aktywuj}>`):
| Pole | typ | autoComplete | Walidacja | Wymagane |
|---|---|---|---|---|
| E-mail (identyfikator) | **brak `<input>`** — renderowany jako zwykły `<div>{email}</div>` (portal.js:351) | — | — | — (patrz B1) |
| Hasło | `password` | `new-password` | dopiero przy submit: porównanie `haslo !== powtorzHaslo` w `aktywuj()` (portal.js:319-321); brak podpowiedzi walidacji siły na bieżąco, tylko statyczny opis „co najmniej 10 znaków, litera i cyfra” w `podpowiedz` | `wymagane` na `<Pole>`, brak numeru reguły w komentarzu |
| Powtórz hasło | `password` | `new-password` | jw. — błąd „Hasła nie są takie same” pokazuje się dopiero po kliknięciu submit, w `Komunikat` nad polami hasła | `wymagane`, brak podstawy w komentarzu |

**Logowanie do portalu klienta** (`portal.js:143-165`): analogiczna struktura jak logowanie kancelarii — `email` (`autoComplete="username"`), `password` (`autoComplete="current-password"`), walidacja tylko przez `disabled` na przycisku.

**Kreator zdarzenia (nowa sprawa/wpis)** (`kreator.js`, wielokrokowy, m.in. `KrokEmisja` ok. linii 280-320):
| Pole | typ | inputMode | Walidacja | Wymagane — podstawa |
|---|---|---|---|---|
| Oznaczenie serii | `text` | — | brak walidacji JS na bieżąco; opis „musi być niepowtarzalne” tylko w `podpowiedz`, sprawdzane dopiero po stronie serwera | `wymagane`, brak podstawy w komentarzu |
| Liczba akcji | `number`, `min="1"` | — | natywna walidacja HTML5 (min), nic ponad to | `wymagane`, brak podstawy |
| Numer pierwszej akcji | `number`, `min="1"` | — | natywna | niewymagane (domyślnie 1) |
| Cena emisyjna jednej akcji (zł) | `number`, `step="0.01"`, `min="0"` | — | WYŁĄCZNIE natywna walidacja przeglądarki (step); patrz B7 — nic nie blokuje > 2 miejsc po przecinku poza samą przeglądarką, a zaokrąglenie server-side jest ciche | niewymagane |
| Rodzaj akcji | `<select>` | — | — | — (art. 300(33) §1 pkt 4 KSH cytowane w `podpowiedz`, nie jako uzasadnienie „wymagane”) |
| Data wpisu emisji do KRS | `PoleDaty` (ui-rejestr.js) | — | walidacja daty wewnątrz komponentu `PoleDaty`/`Kalendarz` | `wymagane`, brak numeru reguły w komentarzu przy tym polu |

**Wniosek portalowy — dane spółki i reprezentanta** (`wniosek.js` ok. 990-1024):
| Pole | typ | Walidacja | Wymagane |
|---|---|---|---|
| Imię i nazwisko reprezentanta | `text` | brak inline | brak `wymagane` na `<Pole>` mimo że pole jest merytorycznie kluczowe |
| Funkcja | `text` | brak inline | brak `wymagane` |
| Sposób reprezentacji | `text` | brak inline; nadpisywane przez „Pobierz z KRS” | brak `wymagane` |
| PESEL reprezentanta | `text`, `maxLength={11}` | brak walidacji sumy kontrolnej dla reprezentanta (w przeciwieństwie do akcjonariusza — patrz `parsujPesel`/`pesel.poprawnaSumaKontrolna` używane tylko dla akcjonariusza, linie 329-338 i 442-445) | brak `wymagane` |
| Dowód osobisty | `text`, placeholder „ABC 123456” | brak | brak `wymagane` (patrz B2 — pojedyncze pole tekstowe, nie lista typ+numer) |
| Imiona rodziców | `text` | brak | brak |
| Adres zamieszkania | `text` — pojedyncze pole | brak | brak (patrz B3 — brak rozbicia na kraj/kod/miejscowość/ulica/nr) |
| Adres e-mail | `email` | brak inline poza natywnym `type=email` | brak |

**Wniosek portalowy — akcjonariusz** (`wniosek.js` ok. 372-450 + `brakiUstawoweAkcjonariusza` 239-285):
| Pole | typ | Walidacja — gdzie | Wymagane — podstawa |
|---|---|---|---|
| PESEL | `text`, `maxLength={11}` | suma kontrolna: inline `Komunikat odmiana="uwaga"` TUŻ POD polem (linie 442-445) — to działa dobrze; ALE brak PESEL-u/daty urodzenia w ogóle (reguła „PESEL albo data urodzenia”) zgłasza się tylko w `brakiUstawoweAkcjonariusza`, zbierane do `braki`/`brakiUstawowe` i renderowane w `Komunikat` na EKRANIE PODSUMOWANIA (linia ~1187-1194), nie przy polu — patrz B4 | częściowo — komentarz kodu (linia ~251) odwołuje się do „art. 300(33) § 1 pkt 2 i 3 KSH” (widoczne też w podpowiedzi osoby.js:302), czyli ma podstawę merytoryczną, ale nie numer reguły z CLAUDE-PSA.md §4 |
| Data urodzenia | `PoleDaty` | jw. — błąd zbiorczy na końcu wizarda | jw. |
| Adres (kod/miejscowość/ulica/nr domu/nr lokalu) | osobne pola tekstowe (rozbite, w przeciwieństwie do reprezentanta) | brak inline | brak jawnej reguły w komentarzu |

**Kartoteka osób (`osoby.js`, `FormularzOsoby`)** — formularz „źródłowy”, używany też inline z poziomu kreatora przez `WyborOsoby → + Nowa osoba w kartotece`:
| Pole | typ | Walidacja | Wymagane |
|---|---|---|---|
| Nazwisko | `text` | brak inline | `wymagane` |
| Imię | `text` | brak | brak `wymagane` |
| PESEL | `text`, `maxLength={11}` | suma kontrolna: `Komunikat odmiana="uwaga"` bezpośrednio pod siatką pól (linie 284-289) — najbliżej pola ze wszystkich formularzy w aplikacji | warunkowo `wymagane={Boolean(Number(dane.bez_pesel))}` na polu Data urodzenia (czyli PESEL LUB data urodzenia — logika bez odwołania do numeru reguły w komentarzu) |
| Data urodzenia | `PoleDaty` | autouzupełnia się z PESEL (efekt uboczny, `useEffect` linia ~331-338) | jw. |

**Wniosek #3 (z inwentarza formularzy):** w całej aplikacji NIE MA ani jednego przykładu komentarza kodu cytującego wprost numer reguły z `CLAUDE-PSA.md §4` przy atrybucie `wymagane` na polu formularza — uzasadnienia „wymagane” są albo brakiem komentarza, albo odwołaniami do artykułów KSH/ustawy AML (nie do wewnętrznego dokumentu reguł). To systemowa luka udokumentowania, nie pojedynczy przypadek.

---

## CZĘŚĆ B — odtworzenie B1–B12

### B1 — „Zaproponuj silne hasło” nie wstawia hasła
**Kroki odtworzenia:** Otworzyć link aktywacyjny z portalu (`/portal.html#/aktywuj/<token>`), skupić pole „Hasło”, obserwować czy przeglądarka (Chrome/Firefox) proponuje wygenerowane silne hasło.

**Ustalenie:** to NIE jest przycisk aplikacji — w całym `publiczne/js` (auth.js, uzytkownicy.js, portal.js) nie ma żadnego przycisku typu „zaproponuj/wygeneruj silne hasło” (grep „silne hasł|wygeneruj|zaproponuj” — brak trafień poza placeholder-em „(wygeneruj automatycznie)” przy tworzeniu konta pracownika przez admina, `uzytkownicy.js:57`, co jest podpowiedzią tekstową, nie funkcją). Zgłoszenie dotyczy więc menedżera haseł przeglądarki.

**Przyczyna (plik:linia):** `publiczne/js/portal.js:301-365` (`EkranAktywacjaKonta`):
- Formularz JEST prawdziwym `<form onSubmit={aktywuj}>` (portal.js:349) — OK.
- Oba pola hasła mają `autoComplete="new-password"` i są kontrolowane przez `useState` bez niekontrolowanego nadpisywania wartości przy re-renderze — OK, to nie blokuje menedżera haseł.
- **Brak jest jednak jakiegokolwiek pola `<input>` dla adresu e-mail/identyfikatora** — e-mail jest renderowany jako zwykły tekst `<div className="brama-karta-podtytul">{email}</div>` (portal.js:351), nie jako `<input type="email" autoComplete="username" readOnly>`. To odbiega od wzorca zastosowanego poprawnie w ekranie logowania (auth.js:96-104, portal.js:159), gdzie pole e-mail JEST inputem z `autoComplete="username"`.
- Pola haseł nie mają jawnych `name`/`id` (ani tu, ani na ekranie logowania) — mniej istotne niż brak pola username, bo nowoczesne przeglądarki opierają się głównie na `autoComplete`+typie pola, ale to dodatkowy odchył od najlepszych praktyk.

**Ocena:** POWAŻNY. Menedżery haseł (Chrome/Firefox) w większości przypadków i tak oferują „Suggest a strong password” na podstawie samego `type="password"` + `autocomplete="new-password"` w obrębie `<form>`, więc podstawowa ścieżka raczej działa — ale brak pola username łamie zdolność menedżera do skojarzenia zapisanego hasła z kontem/domeną w sposób w pełni wiarygodny i może w niektórych przeglądarkach/heurystykach wyłączyć podpowiedź. To jedyny strukturalny defekt, jaki kod ujawnia; nie da się tego wiarygodnie zweryfikować Playwrightem (zgodnie z poleceniem, nie próbowano).

### B2 — Reprezentant: etykieta „Dowód tożsamości”
**Kroki odtworzenia:** Otworzyć kreator nowej spółki (`spolki.js`) lub wniosek portalowy — sekcja danych reprezentanta.

**Ustalenie:** Obecna etykieta w kodzie to **„Dowód osobisty”** (`wniosek.js:1011`, `wnioski.js:136`) — czyli ani „Dokument tożsamości”, ani (docelowe) „Dowód tożsamości”, tylko TRZECI wariant, węższy znaczeniowo (sugeruje wyłącznie dowód osobisty, wyklucza paszport). Pole to pojedynczy `<input type="text">` (`wniosek.js:1011`, `spolki.js:611`) — nie ma osobnej listy „Dowód osobisty / Paszport” + pola numeru.

**Przyczyna (plik:linia):** `publiczne/js/wniosek.js:1011`, `publiczne/js/spolki.js:611`, kolumna bazy `reprezentant_dowod TEXT` (`server/migracje.js:744, 1189, 1753`) — pojedyncza kolumna tekstowa bez rozróżnienia typu dokumentu.

**Ocena:** DROBNY (etykieta/UX), ale ze skutkiem merytorycznym: brak pola „typ dokumentu” może być problemem przy cudzoziemcach z paszportem zamiast dowodu osobistego.

### B3 — Reprezentant: adres jako jedno pole tekstowe
**Kroki odtworzenia:** j.w., pole „Adres zamieszkania” w sekcji reprezentanta.

**Ustalenie potwierdzone:** `reprezentant_adres` to pojedynczy `<input type="text">` (`wniosek.js:1017`, analogicznie w `spolki.js`), BEZ podziału na kraj/kod pocztowy/miejscowość/ulicę/nr domu/nr lokalu — w przeciwieństwie do akcjonariusza i do `psa_osoby`, gdzie te pola SĄ rozbite (`osoby.js:326` i sąsiednie, kolumny `kraj`, `kod_pocztowy`, `miejscowosc`, `ulica`, `nr_domu`, `nr_lokalu` w `server/migracje.js:20-30, 54-66`). W bazie kolumna `reprezentant_adres TEXT` (`server/migracje.js:746, 1191, 1755`) jest jedną kolumną tekstową. Komponentu `PoleAdres` **w całym kodzie nie ma** (grep po repo — zero trafień) — czyli nie istnieje nawet gotowy element do ponownego użycia.

**Ocena:** POWAŻNY — dane adresowe reprezentanta są nieustrukturyzowane, co utrudnia automatyczne wypełnianie pism i walidację (kod pocztowy, kraj) w porównaniu z akcjonariuszem.

### B4 — Błąd PESEL/daty urodzenia widoczny tylko na dole formularza
**Kroki odtworzenia:** W kreatorze wniosku portalowego dodać akcjonariusza fizycznego BEZ PESEL i BEZ daty urodzenia, przejść do kroku podsumowania.

**Ustalenie:** Rozróżnić dwa typy błędu PESEL:
1. **Suma kontrolna niepoprawna** (PESEL wpisany, ale niepoprawny): komunikat pojawia się TUŻ POD polem PESEL, w obrębie tego samego kroku formularza — `wniosek.js:442-445` (wniosek portalowy — akcjonariusz) i analogicznie `osoby.js:284-289` (kartoteka). To działa poprawnie.
2. **Brak PESEL/daty urodzenia w ogóle** (reguła „PESEL albo data urodzenia”): błąd jest zbierany funkcją `brakiUstawoweAkcjonariusza()` (`wniosek.js:239-285`) do tablicy `brakiUstawowe` (`wniosek.js:850`) i renderowany WYŁĄCZNIE na ekranie podsumowania wniosku, w jednym zbiorczym `Komunikat` (`wniosek.js:1187-1194`), z treścią „Wróć do kroku «Akcjonariusze» i wpisz brakujące pozycje” — czyli błąd faktycznie jest widoczny tylko na innym (końcowym) kroku formularza, nie przy samym polu na kroku wypełniania danych akcjonariusza.

**Przyczyna (plik:linia):** `publiczne/js/wniosek.js:239-285` (zbieranie), `wniosek.js:1187-1194` (renderowanie na ekranie podsumowania, nie na kroku edycji akcjonariusza).

**Ocena:** POWAŻNY — użytkownik portalu (klient, niekoniecznie prawnik) musi ręcznie skojarzyć zbiorczy komunikat z konkretnym wierszem/polem i wrócić kilka kroków wstecz.

### B5 — Brak licznika nowego wniosku w panelu bocznym
**Kroki odtworzenia (zweryfikowane żywo):**
1. Zalogowano się jako admin, sprawdzono `GET /api/psa/liczniki` → `{"wnioski":0,...}`.
2. Uruchomiono `node narzedzia/scenariusz-e2e.js --adres http://localhost:4003 --admin admin-b1b12@example.pl --haslo <hasło> --do wniosek` — utworzono zgłoszenie, aktywowano konto klienta, wypełniono dane spółki i 2 akcjonariuszy (status wniosku: `w_przygotowaniu`, jeszcze nie złożony).
3. Uruchomiono ponownie do kroku `--do umowa` na NOWYM zgłoszeniu — po `POST /api/psa/portal/wniosek/zloz` status przeszedł na `zlozony`, następnie po wystawieniu dokumentów na `umowa_wygenerowana`, po odesłaniu podpisów na `umowa_podpisana`.
4. Licznik `GET /api/psa/liczniki` pokazał `"wnioski":1` DOPIERO gdy status osiągnął `umowa_podpisana` — potwierdzone bezpośrednim odczytem bazy (`psa_wnioski`: id 2, status `umowa_podpisana`) i odpowiedzią API.

**Przyczyna (plik:linia):** `server/trasy/pozostale.js:120-147` (`GET /liczniki`) — SQL liczy `wnioski` wyłącznie jako `SELECT COUNT(*) FROM psa_wnioski WHERE status = 'umowa_podpisana'` (linia 128). Status `zlozony` (ustawiany w `server/trasy/portal.js:753` przy faktycznym złożeniu wniosku przez klienta) NIE jest wliczany. Komentarz nad zapytaniem (pozostale.js:107-118) mówi, że licznik ma pokazywać WSZYSTKO, co czeka na ruch KANCELARII, a NIE pokazywać tego, co czeka na klienta — ale świeżo złożony wniosek (`zlozony`) czeka właśnie na kancelarię (przegląd danych i wygenerowanie umowy, patrz `server/trasy/wnioski.js` obsługa `umowa_wygenerowana`), więc wg własnej deklarowanej intencji komentarza POWINIEN być liczony, a nie jest — to niespójność definicji zapytania z jej udokumentowanym celem, nie świadomy wybór projektowy.

Odświeżanie: `publiczne/js/app.js:270` — `useDane(sesja.zalogowany ? '/api/psa/liczniki' : null, [sciezka])` odświeża się przy KAŻDEJ zmianie trasy (nawigacji), więc problem nie leży w odświeżaniu, tylko w samym zapytaniu SQL.

**Ocena:** KRYTYCZNY — świeżo złożony wniosek klienta jest całkowicie niewidoczny w panelu bocznym kancelarii, dopóki ktoś ręcznie nie zajrzy do listy wniosków; przy większej liczbie spraw realne ryzyko przeoczenia nowego zgłoszenia.

### B6 — Brak informacji w portalu po wystawieniu dokumentów
**Ustalenie:** grep `otwarto_w_portalu` po `server/migracje.js` — zero trafień. Nie istnieje żaden mechanizm śladu „pierwszego otwarcia dokumentu przez klienta” ani w schemacie (`psa_wnioski_dokumenty`/`psa_wydane_dokumenty` nie mają takiej kolumny), ani w kodzie serwera. Portal (`portal.js`) nie ma też żadnego licznika/odznaki przy „Moje spółki” ani „Wnioski” sygnalizującej nowy dokument do pobrania (jedyna logika „do_pobrania” w `server/trasy/portal.js:1822` dotyczy typu `informacja` po opłaceniu, nie ogólnego „nowy dokument czeka”).

**Przyczyna:** brak implementacji — cecha nie istnieje, nie błąd logiki.

**Ocena:** POWAŻNY (brak funkcji, nie regresja) — klient nie ma żadnego sygnału w interfejsie, że kancelaria wystawiła komplet dokumentów do podpisu/pobrania poza mailem (który i tak nie działa bez SMTP w środowisku testowym — potwierdzone komunikatem „Wysyłka e-mail nie jest skonfigurowana” podczas testu e2e).

### B7 — Cena emisyjna, miejsca po przecinku
**Ustalenie precyzyjne (kod źródłowy):**
- Pole w UI: `<input type="number" step="0.01" min="0" value={dane.cena_zl}>` (`publiczne/js/kreator.js:298-305`) — to zwykły natywny input liczbowy, NIE komponent `PoleKwoty` (który istnieje w `ui-rejestr.js:779-812` i poprawnie operuje na groszach, ale nie jest tu użyty — patrz A.1).
- Konwersja przy budowaniu żądania: `wynik.cena_emisyjna_grosze = dane.cena_zl === '' || dane.cena_zl === undefined ? null : Math.round(Number(dane.cena_zl) * 100);` (`kreator.js:1197-1198`).
- Walidacja server-side (`server/logika/kreator.js:111-113`): `liczbaCalkowita(we.cena_emisyjna_grosze, 'cena emisyjna (grosze)', { min: 0 })` — sprawdza tylko, że WYNIK (już zaokrąglony grosz) jest liczbą całkowitą ≥ 0; nie ma żadnej wiedzy o oryginalnej precyzji w złotych.

**Zachowanie przy wpisaniu wartości z >2 miejscami po przecinku (np. „0,0001” zł/akcję):**
1. `type="number"` w przeglądarce w ogóle nie akceptuje przecinka jako separatora dziesiętnego (tylko kropkę) — próba wpisania „0,0001” zostanie przez przeglądarkę odfiltrowana/odrzucona przy wpisywaniu znaku „,” (zachowanie zależne od przeglądarki, ale generalnie przecinek nie trafia do wartości pola).
2. Jeśli użytkownik wpisze z kropką, np. „0.0001”: `step="0.01"` NIE blokuje wpisania — to tylko atrybut walidacji natywnej (`:invalid`/`reportValidity`), a formularz kreatora NIE wywołuje natywnego `checkValidity()`/`reportValidity()` przed przejściem dalej (logika `mozeDalej` w kreator.js opiera się na własnych warunkach JS, nie na HTML5 constraint validation) — więc wartość PRZECHODZI bez ostrzeżenia.
3. Przeliczenie: `Number("0.0001") * 100 = 0.01`, `Math.round(0.01) = 0` → **cena emisyjna zapisuje się jako 0 groszy, czyli wartość jest CICHO ZERUJONA**, bez żadnego komunikatu do użytkownika o utracie precyzji. Dla wartości pośrednich typu „0.015” zł: `1.5` grosza → `Math.round` zaokrągla do `2` grosze — czyli SILNIE zaokrągla (o 33%) bez ostrzeżenia.
4. Walidacja serwera nie wykrywa tego problemu, bo dostaje już zaokrągloną liczbę całkowitą groszy — z jej punktu widzenia wszystko jest poprawne.

**Przyczyna (plik:linia):** `publiczne/js/kreator.js:298-305` (input bez zabezpieczenia precyzji) + `kreator.js:1197-1198` (ciche `Math.round` bez ostrzeżenia) + brak użycia gotowego `PoleKwoty` (`ui-rejestr.js:779`), które NIE ma tego problemu (operuje bezpośrednio na groszach jako liczbie całkowitej, patrz jego użycie w `spolki.js`/`podglad.js`).

**Ocena:** POWAŻNY — to bezpośrednia odpowiedź na pytanie Q1 do Łukasza: dziś JEST możliwe wpisanie ułamka grosza (przez `.`), a system go CICHO ZAOKRĄGLA (włącznie z zaokrągleniem do zera dla bardzo małych wartości), bez żadnej informacji zwrotnej dla użytkownika.

### B8 — Portal „Dodaj spółkę”
**Ustalenie:** grep „Dodaj spółkę”/„dodaj spolke” po całym `publiczne/js/portal.js` (1470 linii) — **zero trafień**. Taki przycisk/ścieżka nie istnieje. Ekrany portalu klienta to: logowanie, „zgłoś się” (prospekt), aktywacja konta, wniosek (jednorazowy, dane spółki + akcjonariusze), lista spraw, rejestr (podgląd), informacja z rejestru, „zgłoszenie zmiany” (żądanie nowego zdarzenia — patrz B9). Brak jakiejkolwiek ścieżki dodania KOLEJNEJ spółki do portfela klienta z poziomu portalu.

**Ocena:** POWAŻNY (brak funkcji) — klient obsługujący więcej niż jedną spółkę u tej samej kancelarii nie ma samoobsługowej drogi dodania drugiej spółki przez portal; musi to zrobić kancelaria ręcznie.

### B9 — Portal: zgłoszenie nieprawidłowości we wpisie
**Ustalenie:** grep „nieprawidłow” w `server/` dał 2 trafienia — obydwa to komunikaty o NIEWAŻNYM LINKU AKTYWACYJNYM (`server/trasy/auth.js:347,356` — „Link aktywacyjny jest nieprawidłowy albo wygasł”), nie mają nic wspólnego ze zgłaszaniem błędu we wpisie rejestrowym. Istnieje za to przycisk **„Zgłoś zmianę”** (`portal.js:770`) prowadzący do `EkranZgloszeniePortal` (`portal.js:876+`) — ale to mechanizm ŻĄDANIA NOWEGO ZDARZENIA (zbycie/nabycie akcji, emisja/umorzenie, ustanowienie uprawnienia — `GRUPY_ZGLOSZENIA`, `portal.js:870-874`), na podstawie DOKUMENTU (komentarz `portal.js:862-868` cytuje art. 300(34) § 4 KSH: „podstawa wpisu to dokument, nie opis żądającego”) — czyli klient zgłasza, że coś się WYDARZYŁO i trzeba to wpisać, a NIE że istniejący wpis w rejestrze jest BŁĘDNY i wymaga korekty. To semantycznie inna funkcja.

**Ocena:** POWAŻNY (brak funkcji) — potwierdzone: dedykowana ścieżka „to, co już jest wpisane w rejestrze, jest nieprawidłowe” nie istnieje ani we frontendzie, ani w backendzie; klient nie ma jak zasygnalizować błędu we WCZEŚNIEJSZYM wpisie inaczej niż mailem/telefonem poza systemem.

### B10 — pominięte (poza zakresem tego zadania).

### B11 — Akcjonariusz osoba prawna, trzy ścieżki
**Ustalenie ścieżek:**
1. **Kartoteka kancelarii** (`osoby.js`, `FormularzOsoby`) — poprawnie przełącza pola wg `dane.typ === 'fizyczna'` (linia 247) / (dorozumiane `else` dla `'prawna'`): dla osoby prawnej pokazuje „Firma (nazwa)”/„Adres siedziby” (analogiczne pola), ukrywa PESEL/datę urodzenia/płeć/imiona rodziców. Ma pełny, rozbity adres (kraj/kod/miejscowość/ulica/nr).
2. **Kreator zdarzenia** (`kreator.js`) — **NIE MA WŁASNEGO formularza tworzenia osoby**. Wybór akcjonariusza odbywa się wyłącznie przez `WyborOsoby` (11 wystąpień w kreator.js, np. linie 46, 698, 701, 767…), a nowa osoba tworzona jest przez przycisk „+ Nowa osoba w kartotece” (`ui.js:313-315`), który otwiera TEN SAM `FormularzOsoby` z `osoby.js`. Czyli ścieżka 1 i 2 to w praktyce JEDEN formularz, tylko dwa punkty wejścia.
3. **Wniosek portalowy** (`wniosek.js`) — MA WŁASNY, zduplikowany formularz akcjonariusza (fizyczna/prawna toggle na `a.typ === 'prawna'`, linie 219-244 i dalej), niezależny od `FormularzOsoby`.

**Sprawdzenie kolumny `kraj` w `psa_wnioski_akcjonariusze` (kluczowe dla zgłoszonej luki):**
`server/migracje.js:1215-1245` — pełna definicja `CREATE TABLE psa_wnioski_akcjonariusze`: kolumny `kod_pocztowy, miejscowosc, ulica, nr_domu, nr_lokalu, adres_doreczen, adres_edoreczen, email, telefon` — **BRAK kolumny `kraj`**. Dla porównania `psa_osoby` (`server/migracje.js:54-66`) MA `kraj TEXT DEFAULT 'Polska'` (linia 66). **Potwierdzone wprost: luka istnieje** — dane kraju adresu akcjonariusza zebrane przez portal nie mają gdzie się zapisać w tabeli pośredniej `psa_wnioski_akcjonariusze`, mimo że docelowa `psa_osoby` tę kolumnę ma (praktyczny skutek: albo pole nie jest w ogóle zbierane w portalu — trzeba by to sprawdzić w formularzu `wniosek.js`, ale w schemacie miejsca na nie nie ma — albo kraj przy przenoszeniu do kartoteki jest zawsze domyślnie „Polska” niezależnie od realnych danych klienta zagranicznego).

**Ocena:** POWAŻNY — potwierdzona luka schematu bazy (brak `kraj` w `psa_wnioski_akcjonariusze`), plus zduplikowana logika formularza osoby prawnej między kartoteką/kreatorem (wspólne) a portalem (osobne, więc podatne na rozjazd — patrz właśnie brak `kraj`).

### B12 — „Stan na godzinę i minutę” w interfejsie + godzina wpisu akcjonariusza
**Stan aktualny widgetu „Stan na” w kokpicie** (`kokpit.js:530-635`, `EkranKokpitu`):
- Komentarz w kodzie (linie 532-540) potwierdza, że była to świadoma naprawa „Z-305/P-011”: przywrócono pole godziny.
- Jest DATA (`PoleDaty`, linia 624) ORAZ OSOBNY input `type="time"` (linia 625-631, `pole-godziny-stanu`) — bez atrybutu `step`, więc natywna granulacja to MINUTY (bez sekund). Puste pole godziny = „cały dzień” (linia 539-540, 543).
- Czyli **dziś UI „stan na” pozwala wybrać dzień + opcjonalnie godzinę:minutę** — to jest DOKŁADNIE ODWROTNIE niż to, czego nowa sesja chce (chce: TYLKO dzień w tym widgecie).

**Etykieta „Wpisany do rejestru: DD.MM.RRRR, HH:MM:SS” przy pozycji akcjonariusza:**
- grep „Wpisany do rejestru” i „data_wpisu” po `publiczne/js/*.js` — jedyne trafienia to `kokpit.js:965,1030`, czyli w SEKCJI HISTORII ZDARZEŃ/AUDYTU (`wpisano {fmt.dataCzas(z.data_wpisu)} · {z.autor} · skrót {z.hash_skrocony}…`), NIE przy pozycji akcjonariusza w tabeli stanu rejestru. W `podglad.js` (ekran stanu rejestru/wydruku informacji z rejestru) grep „wpisano|data_wpisu|Wpisan” — **zero trafień**. **Potwierdzone: taka etykieta przy pozycji akcjonariusza dziś NIE ISTNIEJE.**
- `fmt.dataCzas()` (`rdzen.js:91-97`) faktycznie renderuje sekundy, jeśli są w stringu ISO (`tekst.slice(11,19)` = `HH:MM:SS`) — więc TAM, gdzie jest używana (historia zdarzeń), precyzja co do sekundy JEST widoczna; brakuje jedynie zastosowania tego samego formatowania przy samej pozycji akcjonariusza / w wydruku „Informacja z rejestru”.

**Dokładność `psa_zdarzenia.data_wpisu`:** `server/migracje.js:92`: `data_wpisu TEXT NOT NULL, -- DATETIME co do sekundy, systemowa` — kolumna jest TEXT, a komentarz jawnie deklaruje precyzję co do sekundy (systemowa, czyli generowana serwerem, nie wpisywana ręcznie). Dane źródłowe MAJĄ więc już dziś wymaganą precyzję — brakuje wyłącznie warstwy prezentacji przy pozycji akcjonariusza.

**Ocena:** POWAŻNY/DROBNY (mieszany) — (a) widget „Stan na” trzeba ZWĘZIĆ z powrotem do samego dnia (cofnięcie Z-305/P-011 w tym konkretnym miejscu) — DROBNY techniczne, ale wymaga świadomej decyzji bo ktoś celowo przywracał godzinę; (b) etykieta z sekundami przy POZYCJI akcjonariusza wymaga NOWEJ pracy frontendowej (dane po stronie serwera już są, `data_wpisu` ma sekundy) — POWAŻNY zakres brakującej funkcji, ale niski koszt techniczny bo dane już istnieją.

---

## Zatrzymanie serwera audytowego
Uwaga metodologiczna: `pkill -9 -f "PORT=4003"` NIE zadziałał (zmienne środowiskowe nie trafiają do `argv` procesu potomnego uruchomionego przez `nohup`/`disown`), więc serwer żył dalej mimo raportu "brak procesu". Wykryto to przez sprawdzenie `/proc/<pid>/environ` procesów `node serwer.js` i zabito właściwy proces bezpośrednio: `kill -9 649` (PID zweryfikowany po `PORT=4003`/`WSPOLNA_BAZA=.../.audit-b1b12.db` w jego environ). Potwierdzone: `ps -p 649` nie znajduje procesu, `curl http://localhost:4003/...` zwraca connection refused. Serwer audytowy na porcie 4003 jest zatrzymany.
