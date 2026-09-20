# FRONTEND-INWENTARZ.md — FAZA 0 sesji SESJA-PSA-FRONTEND

> Inwentaryzacja i pomiar, **bez żadnych zmian w kodzie repozytorium** (`git status --short` czysty
> przez całą pracę). Wykonane 2026-09-20, czterema równoległymi subagentami (zgodnie z regułą 0.6
> dokumentu sesji, która wprost sankcjonuje subagentów do tej fazy). Cztery izolowane serwery
> testowe (porty 4001–4004, osobne bazy `dane/.audit-*.db`) — wszystkie zatrzymane, bazy usunięte.
>
> Pełne raporty źródłowe: `frontend-audyt/raporty/*.md`. Zrzuty ekranu: `frontend-audyt/zrzuty/`
> (21 kancelaria × 1440px, 42 portal × 1440px+390px = 63 pliki, ~9,4 MB).

---

## 1. Zrzuty ekranu

**Kancelaria** (`frontend-audyt/zrzuty/kancelaria/`, 1440×900, 21 plików): logowanie, pulpit,
kolejka spraw (złapano naturalny **pusty stan**), szczegóły sprawy, lista spółek, kreator nowej
spółki krok 1, kokpit spółki z otwartym rejestrem, kreator zdarzenia, kartoteka osób, zgłoszenia,
wnioski (lista + szczegóły), zawiadomienia, opłaty, konfiguracja (kancelaria/stawki/szablony/
użytkownicy), **błąd walidacji** (pole wymagane → przycisk `disabled`, bez komunikatu), **błąd
blokujący** złapany na żywo w kreatorze otwarcia rejestru, **stan ładowania** (spinner, API
opóźnione sztucznie o 3 s).

**Portal** (`frontend-audyt/zrzuty/portal/`, 1440×900 i 390×844, 42 pliki): logowanie, publiczny
formularz zgłoszenia + stan „sprawdź skrzynkę", pulpit klienta (pusty/„coś do zrobienia"), rejestr
spółki (maskowanie wg roli), płatności, „moje zgłoszenia", kreator wniosku (3 kroki), dokumenty do
podpisu, błędy walidacji/logowania, zamówienie informacji z rejestru. Dwa zrzuty z listy **nie
istnieją w tej architekturze** — patrz sekcja 4 (Odchylenia architektury).

Szczegółowe opisy każdego zrzutu: `frontend-audyt/raporty/kancelaria-raport.md` i
`portal-raport.md`.

---

## 2. Inwentarz komponentów i przycisków

**Stare (`ui.js`) vs nowe (`ui-rejestr.js`).** Ponieważ oba pliki deklarują globalne funkcje w tej
samej kolejności ładowania, wersja z `ui-rejestr.js` zawsze wygrywa — „duplikaty" (Karta, Pole,
Modal, Sekcja, Komunikat, Pusto, Spinner) w `ui.js` są dziś martwym kodem, nie realnym konfliktem.
Realny dług migracyjny to komponenty, które istnieją **wyłącznie** w `ui.js` i nie mają jeszcze
zamiennika w użyciu:

| Komponent (tylko `ui.js`) | Używany w | Zamiennik w `ui-rejestr.js` |
|---|---|---|
| `Znacznik` | 9 plików (konfiguracja, oplaty, portal, sprawy, szablony, uzytkownicy, wniosek, wnioski, zgloszenia) | `Pigulka` istnieje, ale nikt jeszcze nie przełączył |
| `StatusSpolki`, `StatusAml`, `ZnacznikPrzegladuAml` | kokpit, spolki, osoby, sprawy | zależne od migracji `Znacznik` |
| `Wyniki` | sprawy.js | owija już-zmigrowany `Komunikat`, ale sam nie jest zmigrowany |
| `WyborOsoby` | dokumenty-na-zadanie, kreator, sprawy | **brak odpowiednika** w `ui-rejestr.js` — największa pojedyncza migracja (wyszukiwarka + inline „+ Nowa osoba") |

Odwrotna obserwacja, ważna dla FAZY 2: `ui-rejestr.js` ma gotowe `PoleLiczbowe`, `PoleKwoty`,
`WyborZKartoteki`, ale są używane w **jednym miejscu** (`podglad.js`, `spolki.js`) — **`kreator.js`
(kreator zdarzenia) nie używa żadnego z nich**, mimo że są gotowe. To bezpośrednia przyczyna B7
(cena emisyjna).

**Przyciski** (próbka: logowanie, kreatory, wniosek) — wzorzec jest w większości dobry: przyciski
zapisu zamieniają etykietę na czas trwający („Zapisywanie…", „Składanie…"). Słabe punkty:
jednosłowne etykiety bez obiektu („Usuń", „Zmień", „Dalej") niejednoznaczne poza kontekstem wiersza;
„Otwórz rejestr" nie sygnalizuje na samym przycisku, że operacja jest nieodwracalna (tylko w treści
strony); „Zgłoś zmianę" w portalu miesza się pojęciowo z (nieistniejącym) zgłoszeniem
nieprawidłowości (B9). Pełna tabela: `frontend-audyt/raporty/komponenty-formularze-b1b12-raport.md`
sekcja A.2.

---

## 3. Inwentarz formularzy

Dla każdego formularza (logowanie, aktywacja konta, kreator zdarzenia, wniosek portalowy —
spółka/reprezentant/akcjonariusz, kartoteka osób) — pełne tabele pole/typ/inputMode/autoComplete/
walidacja/wymagane w `frontend-audyt/raporty/komponenty-formularze-b1b12-raport.md` sekcja A.3.
Trzy wnioski systemowe:

1. **Walidacja jest niekonsekwentna w miejscu wyświetlania.** Suma kontrolna PESEL: komunikat tuż
   pod polem (dobrze, w 2 z 3 formularzy). Brak PESEL/daty urodzenia w ogóle (reguła „PESEL albo
   data urodzenia"): błąd zbiorczy na **ekranie podsumowania**, nie przy polu na kroku edycji (B4).
2. **Adres reprezentanta i dokument tożsamości reprezentanta są nieustrukturyzowane** — pojedyncze
   pola tekstowe, w przeciwieństwie do akcjonariusza i `psa_osoby`, gdzie te same dane są rozbite na
   kolumny. Komponentu `PoleAdres` **nie ma w całym repo** (B3).
3. **Zero komentarzy w kodzie cytujących numer reguły z `CLAUDE-PSA.md` §4 przy atrybucie
   `wymagane`** — uzasadnienia odwołują się do artykułów KSH/ustawy, nigdy do wewnętrznego numeru
   reguły. Systemowa luka dokumentacyjna, nie pojedynczy przypadek.

---

## 4. Pomiar ośmiu zadań referencyjnych

Wszystkie zmierzone **na żywo** (licznik kliknięć w skrypcie Playwright), od pulpitu/logowania.

### Kancelaria (a)–(e)

| Zadanie | Kliknięć | Ślepe zaułki |
|---|---:|---|
| (a) Przyjęcie wniosku + otwarcie rejestru | **29** (21 bez zaułka) | **Realny błąd złapany na żywo**: mimo w pełni odhaczonej checklisty 10 pozycji, zapis blokuje „Emisja nie ma daty wpisu do KRS" — pole nie jest przenoszone automatycznie z przyjętego wniosku. Kroki kreatora nieklikalne u góry → naprawa to 3× Wstecz + uzupełnienie + 3× Dalej = **8 dodatkowych kliknięć**. Dodatkowo 16/29 kliknięć to wyłącznie pojedyncze potwierdzanie 9 podpisów (brak „potwierdź wszystkie naraz"). |
| (b) Wpis zbycia akcji | **16** | Checklista weryfikacji ma pozycję-pułapkę (patrz sekcja 6); zbywcę wybiera się z kartoteki **dwa razy** (raz jako żądający, raz jako zbywca). |
| (c) Wydanie informacji z rejestru | **4** | Brak przycisku „Pobierz PDF" — jedyna droga to „Drukuj" → natywne okno przeglądarki (inaczej niż przy dokumentach wniosku, gdzie jest bezpośredni „Pobierz"). |
| (d) Odnalezienie akcjonariusza i jego spółek | **1** (samą liczbę) | Liczbę spółek widać w kolumnie listy, ale **nazw konkretnych spółek nie da się zobaczyć z tego miejsca w ogóle** — przycisk „Otwórz" to ślepy zaułek pod kątem tego zadania: otwiera edycję danych osobowych, nie profil/podgląd. |
| (e) Wysyłka zawiadomień | **2** | Brak — najprostsze z pięciu zadań. |

### Portal (f)–(h) — identyczne na 1440px i 390px

| Zadanie | Kliknięć | Uwagi |
|---|---:|---|
| (f) Logowanie → złożony wniosek (nowy klient) | **12** | Pełna ścieżka zmierzona na żywo, bez zaułków. |
| (g) Zgłoszenie zmiany (zalogowany klient) | **3** | — |
| (h) Opłacenie i pobranie informacji z rejestru | **2** *(niepełne)* | TPAY nieskonfigurowany w środowisku audytowym → portal poprawnie degraduje do „rozliczy fakturą"; pełnej ścieżki płatność→pobranie nie dało się zmierzyć end-to-end tutaj. |

Różnica mobile/desktop: **zero różnicy w liczbie kliknięć** — wyłącznie w ilości przewijania
(krok „dokumenty do podpisu": ~20 „ekranów" scrolla na telefonie vs ~4 na desktopie).

---

## 5. Wydajność — stan wyjściowy

| Metryka | Kancelaria | Portal |
|---|---:|---:|
| `vendor/babel.min.js` | 2,98 MB raw (**61,6%** transferu strony logowania) | 2,98 MB raw (**65,8%**) |
| Suma JS aplikacji | 521 KB raw / 151 KB gzip | 211 KB raw / 62 KB gzip |
| CSS | 124 KB raw / 29 KB gzip | (współdzielone) |
| Fonty (woff2, self-hosted) | 1,07 MB raw (górna granica, wszystkie warianty) | (współdzielone) |
| DOMContentLoaded — 4G emulowane | 16,1 s | 16,1 s |
| Czas do gotowości JSX (`#korzen` ma dzieci) — 4G | **19,3 s** | **17,8 s** |
| Czysty koszt kompilacji Babel (CPU, bez throttlingu) | 1,64 s | 0,74 s |

**Serwer nie ma middleware kompresującego** (brak `compression`/gzip) — powyższe „raw" to realny
transfer. Fonty: w pełni lokalne (`publiczne/fonty/*.woff2`), **zero połączeń z Google Fonts** —
CSS dokumentuje świadome przeniesienie z powodów RODO (adres IP klienta). Nie wymaga poprawy.

**Wniosek:** `babel.min.js` to pojedynczy największy koszt na obu ekranach logowania, a sama
kompilacja JSX kosztuje >1,6s czystego CPU na kancelarii **niezależnie od sieci**. To bezpośrednie,
zmierzone uzasadnienie dla pytania Q4 (zgoda na `esbuild`).

---

## 6. Dostępność — stan wyjściowy

`axe-core` niezainstalowany w repo — dodany tymczasowo tylko lokalnie w `testy-audyt/node_modules`
(`--no-save`, bez zmian w `package.json` głównego repo) na potrzeby pomiaru.

| Ekran | Critical | Serious | Moderate |
|---|---:|---:|---:|
| Kancelaria — logowanie | 0 | 2 | 3 |
| Kancelaria — pulpit | 0 | 2 | 2 |
| Kancelaria — kreator spółki krok 1 | **1** | 2 | 2 |
| Portal — logowanie | 0 | 2 | 3 |
| Portal — zgłoszenie | 0 | 2 | 3 |
| **Suma critical+serious** | **1** | **10** | |

Wzorzec systemowy (powtarza się na **każdym** z 5 zbadanych ekranów): brak `<main>`/landmarków,
brak `<h1>`, `color-contrast`, `link-in-text-block` — to luki we wspólnej powłoce layoutu, nie
pojedyncze przypadki. Jedyny `critical`: pole formularza bez `<label>` na kreatorze nowej spółki.

**Kontrast WCAG 2.2 AA (policzony ręcznie z tokenów `rejestr.css`) — 2 pary NIE przechodzą progu
4,5:1 dla zwykłego tekstu:**
- `--atrament-3` (#8A929C) na `--papier`/`--karta`: 2,93:1 / 3,15:1
- `--mosiadz` (#A97C3F) na `--mosiadz-tlo`: 3,26:1

Obie mieszczą się tylko w progu 3:1 (duży tekst/UI) — jeśli są dziś używane jako zwykły tekst
(etykiety pomocnicze, znaczniki daty), łamią WCAG AA. Dokładnie pokrywa się z naruszeniami
`color-contrast` z axe-core.

---

## 7. Odtworzenie B1–B12

| # | Stan dziś | Waga |
|---|---|---|
| B1 | Nie appka, tylko menedżer haseł przeglądarki. Formularz aktywacji ma poprawne `autocomplete="new-password"`, ale pole e-mail to zwykły `<div>`, nie `<input autoComplete="username">` — osłabia zdolność menedżera haseł do skojarzenia zapisu z kontem. | POWAŻNY |
| B2 | Etykieta to dziś „Dowód osobisty" (trzeci wariant, ani „Dokument", ani docelowe „Dowód tożsamości"), pojedyncze pole tekstowe, brak rozróżnienia dowód/paszport. | DROBNY |
| B3 | Adres reprezentanta — jedno pole tekstowe. Komponentu `PoleAdres` **nie ma w całym repo**. | POWAŻNY |
| B4 | Błąd „brak PESEL/daty" pojawia się wyłącznie na ekranie podsumowania wniosku, nie przy polu na kroku akcjonariusza. | POWAŻNY |
| B5 | **Potwierdzone żywo end-to-end**: licznik „wnioski" liczy WYŁĄCZNIE status `umowa_podpisana` — świeżo złożony wniosek (`zlozony`) jest niewidoczny w panelu bocznym, mimo że własny komentarz kodu deklaruje, że powinien być liczony wszystko, co czeka na kancelarię. | **KRYTYCZNY** |
| B6 | Brak mechanizmu `otwarto_w_portalu` i jakiegokolwiek licznika/odznaki nowego dokumentu w portalu — funkcja nie istnieje. | POWAŻNY |
| B7 | **Ustalone precyzyjnie** — `<input type="number" step="0.01">` bez wymuszenia natywnej walidacji submitu; `Math.round(cena_zl*100)` cicho zaokrągla, włącznie z zaokrągleniem **do zera** dla bardzo małych wartości, bez żadnego ostrzeżenia. Bezpośrednia przyczyna: `kreator.js` nie używa gotowego `PoleKwoty`. Odpowiedź na Q1. | POWAŻNY |
| B8 | Potwierdzone — „Dodaj spółkę" w portalu nie istnieje. | POWAŻNY |
| B9 | Potwierdzone — istnieje tylko „Zgłoś zmianę" (żądanie NOWEGO zdarzenia), nie zgłoszenie nieprawidłowości w ISTNIEJĄCYM wpisie. | POWAŻNY |
| B10 | (odsyła do FAZY 4 planu, nie do tej inwentaryzacji) | — |
| B11 | Potwierdzone wprost: `psa_wnioski_akcjonariusze` **nie ma kolumny `kraj`**, `psa_osoby` ma. Kartoteka i kreator dzielą jeden formularz (`FormularzOsoby`); wniosek portalowy ma własny, zduplikowany — stąd rozjazd. | POWAŻNY |
| B12 | Widget „Stan na" w kokpicie ma dziś **dzień + godzinę:minutę** (dokładnie odwrotnie niż chce nowa sesja — chce tylko dzień). Etykieta „Wpisany do rejestru HH:MM:SS" przy pozycji akcjonariusza **nie istnieje** — `data_wpisu` już przechowuje sekundy, brakuje wyłącznie warstwy prezentacji. | POWAŻNY/DROBNY (mieszany) |

Pełne kroki odtworzenia i cytaty plik:linia dla każdego: `frontend-audyt/raporty/komponenty-formularze-b1b12-raport.md` sekcja B.

---

## 8. Lista problemów z priorytetem

### 🔴 KRYTYCZNE (3) — wszystkie naprawione przed FAZĄ 1 (2026-09-20)

1. **B5 — licznik wniosków nie liczy statusu `zlozony`.** ✅ **Naprawione** (`1a41d6a`) — SQL rozszerzony
   o `status IN ('zlozony', 'umowa_podpisana')`, regresyjny test mierzący deltę liczby w
   `testy/wnioski-kancelaria-http.test.js`.
2. **Otwarcie rejestru może się zablokować mimo w pełni zielonej checklisty** (brak automatycznego
   przeniesienia daty wpisu emisji do KRS). ✅ **Naprawione** (`1a41d6a`) — pole edytowalne wprost na
   kroku „Pierwsza emisja i akcjonariat" (ta sama zmienna stanu co krok 1), dodane do warunku
   blokującego „Dalej". Zweryfikowane żywo w przeglądarce (Playwright): edytowalne, blokada działa
   przed wypełnieniem, odblokowuje po, zero błędów konsoli.
3. **Checklista weryfikacji wpisu zbycia akcji ma pozycję, którą zaznaczenie BLOKUJE zapis zamiast
   go odblokować, bez wyjaśnienia w miejscu kliknięcia.** ✅ **Naprawione** (`e7b996c`) — mechanizm był
   już funkcjonalnie poprawny (zmiana przycisku, wymagana notatka, kolor tekstu), dodano wyłącznie
   natychmiastowy komunikat DOKŁADNIE przy checkboxie, w chwili zaznaczenia.

### 🟠 POWAŻNE (13)

B1 (menedżer haseł), B3 (adres reprezentanta nieustrukturyzowany, brak `PoleAdres`), B4 (błąd
PESEL/daty z dala od pola), B6 (brak sygnału nowego dokumentu w portalu), B7 (cena emisyjna cicho
zaokrąglana/zerowana), B8 (brak „Dodaj spółkę" w portalu), B9 (brak zgłaszania nieprawidłowości),
B11 (brak kolumny `kraj`), B12b (brak etykiety czasu wpisu przy pozycji akcjonariusza),
**tabele portalu ucięte na 390px** (`#/rejestr`, `#/sprawy` — kolumny „Udział"/„Stan"/„Termin"
całkowicie niedostępne na telefonie, prawdopodobnie systemowa reguła CSS dla wszystkich tabel),
**`kreator.js` nie używa gotowych `PoleLiczbowe`/`PoleKwoty`/`WyborZKartoteki`** (dług migracyjny +
przyczyna B7), **kartoteka osób bez widoku profilu** (przycisk „Otwórz" = edycja, nie podgląd;
brak rozróżnienia dwóch osób o tym samym imieniu/nazwisku w liście), **1 critical + 10 serious
axe-core** na 5 zbadanych ekranów + **2 pary tokenów kolorów nie przechodzą kontrastu WCAG AA**.

### 🟡 DROBNE (8)

B2 (etykieta „Dowód osobisty"), B12a (widget „Stan na" ma dziś godzinę — do świadomego
zwężenia), migracja `Znacznik`→`Pigulka` (9 plików), `WyborOsoby` bez odpowiednika w
`ui-rejestr.js`, brak numeru reguły `CLAUDE-PSA.md` §4 przy żadnym polu „wymagane" w kodzie,
systemowy brak landmarków/`<h1>` w powłoce, przyciski jednosłowne bez obiektu („Usuń", „Zmień"),
brak „Pobierz PDF" na informacji z rejestru (tylko „Drukuj"), podwójny wybór zbywcy w kreatorze
przeniesienia.

---

## 9. Propozycja kolejności prac

Kolejność faz z dokumentu sesji (1→6) zostaje — poniższe to **priorytetyzacja wewnątrz faz**, nie
zmiana ich kolejności:

1. **Przed FAZĄ 1 (albo jako jej pierwszy, izolowany krok):** trzy pozycje KRYTYCZNE (sekcja 8) są
   małe, punktowe i niezależne od reszty przebudowy — kwalifikują się jako szybkie poprawki, zanim
   zacznie się głębsza praca nad komponentami. Zwłaszcza B5 (jedna linia SQL) i pozycja-pułapka w
   checklistcie zbycia (jeden warunek UI) nie wymagają czekania na Q1–Q5.
2. **FAZA 1** (fundament): migracja `Znacznik`→`Pigulka` i `WyborOsoby`→odpowiednik w
   `ui-rejestr.js` to jasno wytyczony zakres (sekcja 2) — zamyka dług migracyjny jednym zamachem.
   Landmarki/`<h1>` (axe-core, systemowe) najlepiej naprawić na poziomie wspólnej powłoki, jeśli w
   ogóle jest zmieniana w tej fazie.
3. **FAZA 1 pkt 6 (wydajność):** dane z sekcji 5 dają jednoznaczne uzasadnienie dla Q4 — bez
   `esbuild` TTI na 4G (~18-19s) pozostanie daleko od jakiegokolwiek rozsądnego standardu.
4. **FAZA 2 (B1–B12):** wszystkie 12 pozycji potwierdzone/sprecyzowane w sekcji 7 — gotowe do
   naprawy w kolejności z briefu. `PoleAdres` (B3) i podłączenie `kreator.js` do istniejących
   `PoleLiczbowe`/`PoleKwoty`/`WyborZKartoteki` (B7) warto zrobić razem, bo to ten sam wzorzec
   migracji co reszta FAZY 1.
5. **FAZA 3 (kancelaria ekran po ekranie):** kartoteka osób (brak profilu, kolizja imion/nazwisk) i
   ekran informacji z rejestru (brak „Pobierz PDF") to konkretne, gotowe do zaplanowania poprawki
   z tej inwentaryzacji.
6. **FAZA 4 (portal):** ucięte tabele na 390px to punkt zerowy tej fazy — bez naprawy layoutu
   tabelarycznego architektura informacji z briefu (zakładki Rejestr/Zgłoszenia) nie będzie
   użyteczna na telefonie, dla którego portal ma być projektowany od 390px w górę. Brak ekranów
   „Konto" i „Dokumenty" (sekcja 4 raportu portalu) potwierdza, że architektura informacji z briefu
   (pkt 1) wymaga realnej budowy, nie tylko dopracowania istniejących ekranów.
7. **Kontrast WCAG** (`--atrament-3`, `--mosiadz`) — do poprawki przy okazji FAZY 1 (tokeny są
   częścią „fundamentu"), zanim nowe komponenty zaczną z nich korzystać masowo.

---

## 10. Odtworzone środowisko pomiarowe (do powtórzenia w kolejnych fazach)

Wzorzec używany przez wszystkie cztery agenty — gotowy do skopiowania przy kolejnych pomiarach
przed/po:

```bash
rm -f dane/.audit-<nazwa>.db dane/.audit-<nazwa>.db-wal dane/.audit-<nazwa>.db-shm
mkdir -p /tmp/audit-<nazwa>-dokumenty
WSPOLNA_BAZA=$(pwd)/dane/.audit-<nazwa>.db ADMIN_EMAIL=admin-<nazwa>@example.pl PORT=<port> \
  PORTAL_WLACZONY=true KATALOG_DOKUMENTOW=/tmp/audit-<nazwa>-dokumenty \
  nohup node serwer.js > /tmp/audit-<nazwa>-serwer.log 2>&1 &
disown; sleep 2; grep "Hasło tymczasowe" /tmp/audit-<nazwa>-serwer.log
node narzedzia/scenariusz-e2e.js --adres http://localhost:<port> --admin admin-<nazwa>@example.pl --haslo '<hasło>'
```
Playwright: `require('testy-audyt/node_modules/playwright')`, `executablePath:
'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`, `args: ['--no-sandbox']`.

**Uwaga metodologiczna od trzech agentów niezależnie:** `pkill -f "PORT=<port>"` czasem nie trafia,
bo zmienne środowiskowe procesu potomnego uruchomionego przez `nohup`/`disown` nie zawsze trafiają
do `argv` widocznego przez `pkill -f`. Pewniejsza metoda: znaleźć PID przez
`grep -l "PORT=<port>" /proc/*/environ` (lub `ps aux | grep serwer.js` gdy działa tylko jeden) i
zabić bezpośrednio `kill -9 <PID>`.
