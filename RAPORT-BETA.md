# Raport z testów beta — przed oddaniem do testów zewnętrznych

Przebieg: 431 testów automatycznych, 3 przymiarki na żywym serwerze
(`testy/reczne/`), przegląd każdego ekranu obu portali. Wszystko na
świeżych bazach, nie na danych roboczych.

---

## 1. Wynik przymiarek

| Przymiarka | Zakres | Wynik |
|---|---|---|
| `przebieg-pelny.js` | zgłoszenie → wniosek → komplet do podpisu → przyjęcie → rejestr → zmiana → faktura | **24/24** |
| `przebieg-platnosci.js` | to samo z płatnościami: bramka, ITN prawdziwy i podrobiony, zaniżona kwota, powtórka, informacja | **20/20** |
| `sonda-bezpieczenstwa.js` | dostęp bez sesji, nagłówki, enumeracja, limiter, SQL, podpis ITN, wyjście z katalogu | **16/17** |
| `node --test testy/` | jednostki i trasy | **431/431** |

Jedno sprawdzenie nie przechodzi i jest to problem nr 1 poniżej.

## 2. Naprawione w tej rundzie (znalezione przymiarkami)

| # | Co | Jak znalezione |
|---|---|---|
| 1 | **Akcjonariusz otwierał informację wydaną SPÓŁCE** — czytał adresy pozostałych akcjonariuszy, zasłonięte w jego własnej informacji | przymiarka: ten sam adres widoczny w jednym dokumencie, zasłonięty w drugim |
| 2 | **Rozpylanie hasła** — limiter liczył po `IP + e-mail`, więc 25 kont z jednego adresu przechodziło bez blokady | sonda |
| 3 | Dwuklik w „Zamów informację” tworzył **dwa długi po 50 zł** za jedną chęć | przegląd trasy |
| 4 | Klient z dwiema spółkami nie mógł dołączyć dokumentu do sprawy tej drugiej | przegląd kodu po migracji 41 |
| 5 | Przy wyłączonych płatnościach zgłoszenie zmiany **znikało** — zapisane, nikomu niepokazane | własne przeoczenie, wyłapane przymiarką |

---

## 3. TRZY NAJPOWAŻNIEJSZE PROBLEMY

### 🔴 A. BEZPIECZEŃSTWO — `unsafe-eval` i `unsafe-inline` w CSP

**Co jest.** Interfejs kompiluje JSX **w przeglądarce** (`publiczne/vendor/babel.min.js`),
więc polityka bezpieczeństwa musi zawierać:

```
script-src 'self' 'unsafe-eval' 'unsafe-inline'
```

**Dlaczego to jest najpoważniejsze.** CSP jest ostatnią linią obrony przed XSS —
tą, która ratuje, gdy pierwsza zawiedzie. Z `unsafe-inline` i `unsafe-eval` CSP
nie chroni przed niczym. Jeden przeoczony punkt wstrzyknięcia (a jeden już był:
skan `.pdf` z treścią HTML, naprawiony w poprzedniej rundzie) daje wykonanie kodu
w sesji notariusza — czyli dostęp do **wszystkich rejestrów wszystkich spółek**.

To jest pierwsza rzecz, którą zobaczy zewnętrzny audyt, i pierwsza, którą dom
maklerski pokaże klientowi: „ich portal ma wyłączone zabezpieczenie przeglądarki”.

**Rozwiązanie.** Skompilować JSX **przy starcie serwera**, nie w przeglądarce.
Babel już jest w repozytorium, kompilacja wszystkich plików z `publiczne/js/`
zajmuje ułamek sekundy. Wtedy:
- `script-src 'self'` — bez żadnego wyjątku,
- znika 400 kB Babela z każdego wejścia na stronę,
- błąd składni wychodzi przy starcie, a nie pustą stroną u klienta.

Nakład: ok. pół dnia. **Rekomendacja: zrobić przed testami zewnętrznymi.**

---

### 🔴 B. PRAWO — wstrzymanie wpisu do czasu zapłaty

**Co jest.** Żądanie wpisu złożone przez portal jest skuteczne dopiero po
opłaceniu. Do tego czasu nie stoi w kolejce i nie biegnie żaden termin.

**Ryzyko.** Art. 300³⁴ § 1 KSH: podmiot prowadzący rejestr dokonuje wpisu
**niezwłocznie, nie później niż w terminie tygodnia od otrzymania żądania**.
Katalog przyczyn odmowy (§ 5–7) nie zna „braku zapłaty”. Gdyby przyjąć, że
żądanie zostało otrzymane w chwili kliknięcia, to wstrzymanie wpisu do zapłaty
jest **niedokonaniem czynności ustawowej** — a dla notariusza to sprawa
dyscyplinarna, nie handlowa. To jest dokładnie zarzut, który postawi izba
notarialna, i dokładnie ten, którym dom maklerski będzie straszył klienta.

**Jak to rozwiązałem i dlaczego uważam, że się obroni.** Konstrukcja jest taka,
że **żądania jeszcze nie ma**, dopóki nie jest opłacone:

1. umowa o prowadzenie rejestru stanowi, że żądanie składane przez portal
   dochodzi do skutku z chwilą zapłaty — to czynność umowna, nie odmowa;
2. `data_wplywu` ustawia się **na dzień zapłaty** i dopiero wtedy rusza tydzień
   (sprawdzone przymiarką);
3. droga papierowa i mailowa **zostaje otwarta** — żądanie złożone tak jest
   skuteczne natychmiast, a opłatę rozlicza faktura. Klient, któremu się śpieszy,
   nigdy nie jest zakładnikiem bramki;
4. przy wyłączonych płatnościach bramka nie obowiązuje w ogóle.

**Czego brakuje i co trzeba zrobić.** Punkt 1 **musi znaleźć się w umowie
i w regulaminie portalu** — inaczej cała konstrukcja wisi w powietrzu. Dziś
tego zapisu nie ma. Do napisania:

> Żądanie wpisu złożone za pośrednictwem portalu wywołuje skutek z chwilą
> uznania rachunku podmiotu prowadzącego rejestr. Żądanie złożone w formie
> pisemnej albo na adres poczty elektronicznej kancelarii wywołuje skutek
> z chwilą doręczenia, niezależnie od zapłaty.

**Rekomendacja: zapis do umowy i regulaminu PRZED uruchomieniem płatności.**
Do rozważenia z izbą: czy nie bezpieczniej byłoby zostawić wpis bez bramki
(wpis → faktura), a bramkę trzymać wyłącznie na informacji z rejestru, która
ustawowego terminu nie ma.

---

### 🔴 C. PRAWO/RODO — rejestr w jednym pliku, bez szyfrowania i bez kopii

**Co jest.** Cała baza to jeden plik SQLite (`dane/kancelaria.db`), nieszyfrowany.
Skany dowodów osobistych i podpisanych umów leżą jako zwykłe pliki na dysku.
Nie ma automatycznej kopii zapasowej ani procedury odtworzenia.

**Ryzyko — trzy warstwy naraz:**
- **art. 300³¹ § 4 KSH** wymaga prowadzenia rejestru „w sposób zapewniający
  bezpieczeństwo i integralność danych”. Integralność jest zrobiona dobrze
  (łańcuch skrótów, `append-only`). Bezpieczeństwo — nie: kopia pliku to kopia
  wszystkich rejestrów wszystkich spółek;
- **RODO art. 32** — brak szyfrowania w spoczynku przy danych obejmujących
  PESEL, adresy i **obrazy dokumentów tożsamości**;
- **ciągłość**: rejestr akcjonariuszy P.S.A. jest jedynym dowodem, kto jest
  akcjonariuszem (art. 300³⁶ § 1 KSH). Utrata pliku to utrata tego dowodu dla
  wszystkich obsługiwanych spółek jednocześnie. Tego się nie odtworzy z niczego.

**Rozwiązanie — trzy rzeczy, żadna droga:**
1. szyfrowanie dysku na serwerze (LUKS/dm-crypt) — pół godziny przy stawianiu
   maszyny, zamyka warstwę „ktoś wyniósł dysk/kopię”;
2. kopia zapasowa poza serwerem, **szyfrowana i testowana** — sama kopia, której
   nikt nigdy nie odtworzył, nie jest kopią;
3. dziennik dostępu już istnieje (`psa_dziennik_dostepu`) — dopisać do niego
   pobrania kopii i eksporty.

**Rekomendacja: zrobić przed pierwszym prawdziwym klientem.** To jedyny
z trzech problemów, w którym awaria jest nieodwracalna.

---

## 4. Elementy do usunięcia — PROSZĘ O DECYZJĘ (nic nie usuwałem)

| Element | Gdzie | Dlaczego podejrzany | Za czym przemawia zostawienie |
|---|---|---|---|
| **„Rejestr zdarzeń" obok „Historia zdarzeń"** | kokpit spółki | dwie sekcje o niemal tej samej nazwie; jedna to katalog reszty, druga to cała chronologia — nazwy tego nie mówią | obie niosą co innego; wystarczy **zmienić nazwy** (np. „Pozostałe wpisy” i „Łańcuch zdarzeń”) zamiast usuwać |
| **„Wystaw żądanie wpisu"** (wzór 04) | ekran sprawy | przy sprawie z portalu klient **już złożył** żądanie — kancelaria formalizuje coś, co istnieje | przy żądaniu papierowym/mailowym to jedyny sposób, żeby żądanie miało formę dokumentu. Propozycja: **pokazywać tylko dla `zrodlo != 'portal'`** |
| **„Przelicz podgląd"** | kreator wpisu, krok 3 | podgląd przelicza się sam przy wejściu w krok i po każdej zmianie | zostaje jako ratunek, gdy podgląd się zawiesi — ale można schować pod „Odśwież” w rogu |
| **Filtry opłat (spółka/typ/status/okres)** | usunięte przeze mnie z ekranu rozliczeń | zastąpione grupowaniem po spółkach + przełącznikiem „tylko nierozliczone” | **już usunięte** — jeśli brakuje, wracają w kwadrans. Trasa `/api/psa/oplaty` z filtrami działa dalej (używa jej eksport CSV) |
| **Lista 4 statusów opłaty** | usunięta przeze mnie | pozwalała cofnąć „opłaconą” na „naliczoną”; powtarzała znacznik stanu obok | **już usunięte**, zostały dwie akcje: „Oznacz opłaconą” (przelew poza portalem) i „Anuluj” |

## 5. Płatności — zgodność z notatką wdrożeniową

Notatka `TPAY-INTEGRACJA.md` trafiła do repozytorium po pierwszej wersji tej
implementacji. Porównanie punkt po punkcie wykryło **dwa błędy, które
zatrzymałyby płatności na produkcji**, i cztery braki. Wszystko poprawione,
każda poprawka ma test.

### Co było złe

| # | Błąd | Skutek na produkcji |
|---|---|---|
| 1 | `/oauth/auth` wysyłane jako **JSON** zamiast formularza | **żadna płatność by nie powstała** — autoryzacja odrzucona, komunikat nie mówiący dlaczego |
| 2 | `tr_status` sprawdzany tylko pod `TRUE`, bez **`PAID`** | **zapłacone należności nie księgowałyby się** — pieniądze na rachunku, opłata dalej „naliczona” |
| 3 | Kwota porównywana z `tr_amount` zamiast **`tr_paid`** | niedopłata przechodziłaby jako pełna zapłata |
| 4 | Stara transakcja unieważniana tylko u nas, bez `POST /transactions/{id}/cancel` | link z maila dalej żywy — klient płaci nieaktualną kwotę |
| 5 | Brak `currency`, `callbacks.notification.email`, limitu 128 znaków na opisie | brak niezależnego kanału powiadomień; opis mógł zostać ucięty przez operatora |
| 6 | Brak mapy statusów przy odpytywaniu (`correct` i nic więcej) | `paid`, `declined`, `chargeback` czytane jako „oczekuje” bez końca |

### Co doszło

- **Podpis JWS** (`X-JWS-Signature`) — certyfikat z `secure.tpay.com`, payload
  odłączony, wyłącznie `RS256`. `alg: none` i algorytmy symetryczne odrzucane
  wprost. Surowe ciało żądania zachowywane przez `verify` w `express.urlencoded`,
  bo podpis obejmuje dokładnie te bajty, które przyszły.
- **Lista adresów operatora** jako trzecia warstwa — **wyłącznie sygnał do logu,
  nigdy odmowa**: adresy się zmieniają i blokada na nich potrafi wyciąć
  prawdziwe płatności.
- **Ważność linku po naszej stronie** (14 dni) — operator nie ma pola wygaśnięcia.
- **Zapas na `payer`** — wysyłamy bez niego (żeby klient dostał potwierdzenie na
  swój adres), ale gdyby API kiedyś tego wymagało, ponawiamy raz z wartościami
  zastępczymi zamiast zostawiać klienta bez możliwości zapłaty.
- **Idempotencja także po `tr_id`** — powiadomienie o cudzej transakcji
  z podstawionym `tr_crc` nie księguje naszej.

Atrapa operatora w testach **pilnuje tego samego, co prawdziwe API** — odrzuca
`/oauth/auth` wysłane jako JSON. Gdyby pilnowała mniej, przepuściłaby błąd nr 1.

### Co nadal zostaje

| Rzecz | Stan |
|---|---|
| Automat uruchamiający przypomnienia | dziś przycisk w rozliczeniach; brakuje zadania cyklicznego (cron) |
| Zwrot i korekta płatności (`/refunds`) | brak — dziś tylko „Anuluj” na należności |
| Kod QR do zapłaty (`/qr`) | brak — przydatny dopiero przy wezwaniach papierowych |
| Pierwszy test na produkcji na własnym, drobnym zamówieniu | **do zrobienia przed uruchomieniem dla klientów** |
