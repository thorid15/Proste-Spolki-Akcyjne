# FAZA 2 — wynik audytu opłat

> Audyt read-only, zero zmian w kodzie produkcyjnym. Wszystkie naliczenia testowe wykonane
> BEZPOŚREDNIMI żądaniami HTTP do `localhost:3005` (zalogowany jako `audyt@kancelaria.test`, rola
> `admin`), z pominięciem formularza, zgodnie z priorytetem tej fazy („testy API/arytmetyki").
> Wszystkie opłaty testowe, które nie były zamierzonym, poprawnym skutkiem testu na WŁASNEJ spółce,
> zostały po zakończeniu testu oznaczone `status: anulowana` (jedyny mechanizm „cofnięcia" opłaty,
> jaki daje aplikacja — nic nie usunięto z bazy poza normalnym API).

## 🔴 KRYTYCZNE — przeczytaj to najpierw

**Aplikacja potrafi podwójnie naliczyć opłatę za prowadzenie rejestru za ten sam rok tej samej
spółce — potwierdzone empirycznie, nie tylko w kodzie (Z-100).** Istnieją DWA niezależne, nawzajem
„ślepe" mechanizmy naliczania opłaty `prowadzenie`, dzielące jedną tabelę (`psa_oplaty`) i jeden
typ (`prowadzenie`), ale sprawdzające idempotencję po INNEJ kolumnie każdy (`okres` — tekst roku —
kontra `okres_od` — data rocznicy). Wywołanie `POST /api/psa/oplaty/naliczenie-roczne` (endpoint
istnieje w API, wymaga tylko roli `admin`, ale NIE jest podpięty pod żaden przycisk w interfejsie)
naliczyło w jednym żądaniu dodatkową opłatę 1200 zł dla WSZYSTKICH 9 aktywnych spółek testowych
naraz — w tym dla spółki, która miała już aktywną, pokrywającą się w czasie opłatę `prowadzenie`
naliczoną przez „właściwy", rocznicowy mechanizm używany przez UI. Bez ręcznej korekty klient
zapłaciłby **2400 zł zamiast 1200 zł** za jeden rok prowadzenia rejestru jednej spółki. Wszystkie 9
nadmiarowych opłat zostało przeze mnie anulowane po teście (opis niżej).

**Drugie krytyczne znalezisko: ręczny wpis opłaty (`POST /api/psa/oplaty/`) nie ma ŻADNEJ górnej
granicy kwoty (Z-101).** Udało się zapisać opłatę za wpis (stawka maks. 100 zł) na kwotę
**1 000 000 zł**, bez błędu, bez ostrzeżenia. Ta sama walidacja („nie wyżej niż stawka maksymalna z
rozporządzenia") już istnieje w kodzie i już działa — ale tylko przy zmianie stawki DOMYŚLNEJ
kancelarii (`server/logika/ustawienia.js`), nie przy pojedynczym ręcznym wpisie opłaty. To dokładnie
scenariusz „zawyżenia taksy", przed którym ostrzega wstęp do tej fazy audytu.

Przy okazji tego samego endpointu potwierdzone też: przyjmuje kwotę **ujemną** (Z-102) i kwotę
**zmiennoprzecinkową** zapisywaną dosłownie do kolumny mającej być liczbą całkowitą w groszach
(Z-103 — narusza wprost `CLAUDE-PSA.md` regułę domenową nr 5).

## Zestawienie wszystkich naliczeń wykonanych w tej fazie

Aplikacja **nie rozróżnia netto/brutto** — nie ma pojęcia VAT w module (patrz sekcja niżej). Kwoty
poniżej to jedyne kwoty, jakie aplikacja zna: „kwota_grosze" / „kwota_zl", bez żadnego rozbicia
podatkowego.

| # | Scenariusz | Spółka | Typ opłaty | Kwota naliczona | Oczekiwane wg `PRZEPISY-PSA.md` § 9 | Zgodne? | Sprzątnięcie |
|---|---|---|---|---|---|---|---|
| 1 | Przeniesienie akcji do 3 nabywców w 1 żądaniu | 6 | wpis | **100 zł** (1×) | 100 zł (1 wpis = 1 opłata) | ✅ TAK | pozostawione (poprawne) |
| 2 | Odmowa wpisu | 6 | — | **0 zł** | 0 zł | ✅ TAK | brak (nic nie powstało) |
| 3 | Zajęcie egzekucyjne z urzędu | 6 | — | **0 zł** | 0 zł, bez żądania | ✅ TAK | brak (nic nie powstało) |
| 4 | Otwarcie rejestru — wniosek portalowy (dane historyczne z FAZY 1, spółka 6) | 6 | prowadzenie | **1200 zł** (1×), 0 zł `wpis` | do rozstrzygnięcia — P-007 | zgłoszone jako pytanie | pozostawione (istniejące od FAZY 1) |
| 5 | Otwarcie rejestru — kreator wewnętrzny, 2 zdarzenia założycielskie | 10 (własna) | — | **0 zł** | do rozstrzygnięcia — P-007, ale niespójne z # 4 | ⚠️ niespójność między ścieżkami (Z-108) | brak (nic nie powstało — to sam problem) |
| 6 | Rok prowadzenia liczony od 20 grudnia (funkcja czysta, bez zapisu) | — | prowadzenie | **1200 zł** za okres 20.12–19.12 (1×, nie 2×) | 1200 zł raz, nie osobno za grudzień i styczeń | ✅ TAK | nie dotyczy (brak zapisu do bazy) |
| 7 | Odnowienie roczne (mechanizm rocznicowy), 2× pod rząd | 6 | prowadzenie | **1200 zł** (1×), drugie wywołanie: 0 | 1200 zł raz | ✅ TAK (idempotentne) | opłata z testu anulowana (id 20) |
| 8 | Naliczenie roczne KALENDARZOWE (`/naliczenie-roczne`) na bazie ze spółkami mającymi już opłaty rocznicowe | 1–9 (wszystkie aktywne) | prowadzenie | **+1200 zł** DODATKOWO dla każdej z 9 spółek | 0 zł (opłata już istniała) | 🔴 **NIE — Z-100 KRYTYCZNE** | wszystkie 9 anulowane (id 8–16) |
| 9 | Ręczny wpis opłaty, kwota powyżej stawki maksymalnej | 6 | wpis | **1 000 000 zł** (stawka maks. 100 zł) | odrzucone | 🔴 **NIE — Z-101 KRYTYCZNE** | anulowana (id 19) |
| 10 | Ręczny wpis opłaty, kwota ujemna | 6 | informacja | **-50 zł** | odrzucone | 🔴 **NIE — Z-102 POWAŻNY** | anulowana (id 18) |
| 11 | Ręczny wpis opłaty, kwota zmiennoprzecinkowa | 6 | informacja | **1,007 zł** (`kwota_grosze: 100.7`) | zaokrąglone do liczby całkowitej albo odrzucone | 🔴 **NIE — Z-103 KRYTYCZNE** | anulowana (id 17) |
| 12 | Ręczny wpis opłaty, `kwota_grosze` nienumeryczne (`"abc"`) | 6 | informacja | błąd 500 (nic nie zapisano) | błąd 400 czytelny | ⚠️ DROBNE — Z-104 | nie dotyczy (nic nie zapisano) |
| 13 | Informacja z rejestru pobrana wielokrotnie (jedno zamówienie) | — | informacja | 1× naliczenie, 0× przy ponownym pobraniu tego samego dokumentu | 1× | ✅ TAK (zweryfikowane WYŁĄCZNIE przez lekturę kodu `portal.js` — nie miałem dostępu do działającego konta portalowego w współdzielonej bazie testowej, patrz „Czego nie udało się przetestować") | nie dotyczy |

Stan po sprzątnięciu: opłaty pozostawione aktywne w bazie testowej to WYŁĄCZNIE poprawne, zamierzone
efekty (wiersz #1, #4, #7-pierwsza-opłata istniejąca od FAZY 1) — żadna opłata testowa wykazująca
błąd nie pozostała aktywna.

## Lista znalezisk (Z-100…Z-109)

| ID | Waga | Skrót |
|---|---|---|
| Z-100 | **KRYTYCZNY** | Dwa niezależne mechanizmy „prowadzenie" mogą podwójnie naliczyć opłatę za ten sam rok (potwierdzone: +9× 1200 zł jednym wywołaniem) |
| Z-101 | **KRYTYCZNY** | Ręczny wpis opłaty bez górnej granicy — naliczono 1 000 000 zł zamiast maks. 100 zł |
| Z-102 | POWAŻNY | Ręczny wpis opłaty przyjmuje kwotę ujemną |
| Z-103 | **KRYTYCZNY** | Ręczny wpis opłaty przyjmuje kwotę zmiennoprzecinkową — narusza regułę „grosze = INTEGER" |
| Z-104 | DROBNY | Nienumeryczna kwota → błąd 500 zamiast czytelnego 400 |
| Z-105 | POZYTYWNE | 3 nabywców w 1 żądaniu = 1 opłata (100 zł), nie 300 zł |
| Z-106 | POZYTYWNE | Odmowa wpisu i zajęcie egzekucyjne — zero opłat, zgodnie z przepisem |
| Z-107 | POZYTYWNE | Rok liczony od rocznicy otwarcia, nie kalendarzowo; mechanizm rocznicowy sam w sobie idempotentny |
| Z-108 | POWAŻNY | Spółki zakładane kreatorem wewnętrznym nigdy nie dostają automatycznej opłaty za prowadzenie rejestru |
| Z-109 | DROBNY | Pole `okres` przy ręcznym wpisie „prowadzenie" bez walidacji formatu |

Pełne opisy z krokami odtworzenia: `testy-audyt/ZNALEZISKA.md`, sekcja „FAZA 2 — opłaty".

## Stawki — czy są w jednym miejscu?

**TAK.** `server/logika/przepisy.js` (`STAWKI_GROSZE`, `STAWKI_MAKSYMALNE_GROSZE`) jest jedynym
miejscem z literałami 120000/10000/5000 groszy w całym `server/` i `publiczne/` (sprawdzone
`grep`em po tych trzech literałach z wykluczeniem plików testowych/migracji/przepisy.js — zero
wyników). `server/logika/ustawienia.js` poprawnie odwołuje się do tych stałych zarówno przy
odczycie stawki efektywnej, jak i przy walidacji górnej granicy dla stawki DOMYŚLNEJ kancelarii.
Jedyna luka to Z-101/Z-102/Z-103 — walidacja z `ustawienia.js` nie jest powtórzona przy ręcznym
wpisie POJEDYNCZEJ opłaty (`dodajOplateReczna`).

## VAT — netto czy brutto?

Moduł **w ogóle nie ma pojęcia VAT**. Sprawdziłem historię: pole `psa_spolki.platnik_vat` istniało
krótko (migracja 12) i zostało CAŁKOWICIE usunięte (migracja 17, `ALTER TABLE psa_spolki DROP
COLUMN platnik_vat`) z jawnym uzasadnieniem w kodzie: „to nie jest element rejestru (art. 300³³ § 1
KSH), zmienia się niezależnie od KRS". Wszystkie kwoty w `psa_oplaty.kwota_grosze` są traktowane
jednolicie, bez rozbicia netto/brutto — ani w API, ani w CSV eksportowanym do księgowości, ani w
żadnym wygenerowanym dokumencie. Nie jest to sprzeczne z `PRZEPISY-PSA.md` § 9 („taksa to kwota
netto") w sensie BŁĘDU obliczeniowego — po prostu appka nie nalicza VAT-u wcale (żadnego podwójnego
naliczenia nie znalazłem), zostawiając to całkowicie systemowi księgowemu kancelarii. Nie zgłaszam
tego jako znalezisko (świadoma, udokumentowana decyzja architektoniczna, poza zakresem modułu wg
`CLAUDE-PSA.md` reguła domenowa nr 14: „Rejestr nie pośredniczy w płatnościach"), ale odnotowuję
wprost na żądanie checklisty sesji.

## Czego nie udało się przetestować (i dlaczego)

1. **„Opłata za informację z rejestru pobrana 3 razy" — ścieżka portalowa, na żywo.** Kod
   (`server/trasy/portal.js: /informacja/zamow` i `/informacja/:oplataId/wydaj`) ma jawny,
   dwuwarstwowy mechanizm dedupu: (a) niezapłacone/zapłacone-ale-niewykorzystane zamówienie tej
   samej osoby na tę samą spółkę jest ZWRACANE, nie duplikowane; (b) dokument generowany jest
   dokładnie raz na opłatę (`wydany_dokument_id`), ponowne `GET /informacja/:id` tylko odczytuje
   zapisaną wcześniej treść, bez ponownego naliczenia. Nie miałem jednak działających danych
   logowania do żadnego konta portalowego w współdzielonej bazie testowej (konta portalowe z FAZY 1
   mają hasła nieznane mi — utworzone przez inny wątek audytu; zakładanie NOWEGO konta portalowego
   od zera wymagałoby przejścia pełnej ścieżki zgłoszenie→aktywacja→wniosek→przyjęcie, co dla samej
   weryfikacji jednego zachowania dedupu uznałem za nieproporcjonalny koszt względem korzyści przy
   już jednoznacznym dowodzie z kodu — decyzja podjęta samodzielnie, zgodnie z zasadą sesji o
   ważeniu kosztu/zysku dalszego drążenia). Poziom pewności: wysoki (kod jest jednoznaczny, jedno
   miejsce wywołania, brak rozgałęzień), ale NIE zweryfikowany empirycznie tak jak reszta tej fazy.
2. **Zachowanie `POST /api/psa/oplaty/platnosci/:id/sprawdz` (odpytanie operatora tpay) i webhooka
   `POST /api/psa/platnosci/tpay/itn`** — nie testowane, bo `tpay` nie jest skonfigurowany w
   środowisku audytowym (`platnosci_wlaczone: false` byłoby zwrócone) i uruchomienie prawdziwego
   ruchu do zewnętrznego operatora płatności byłoby poza zakresem bezpiecznego audytu na
   środowisku testowym. Nie było to zresztą wymagane przez checklistę tej fazy.
3. **Interfejs użytkownika (przeglądarka) dla panelu „Opłaty".** Cała ta faza została zrobiona
   bezpośrednimi żądaniami HTTP (zgodnie z sugerowanym priorytetem checklisty: „głównie testy
   API/arytmetyki, przeglądarka opcjonalna"), bo kluczowe pytania („czy da się naliczyć kwotę
   niedozwoloną") lepiej i jednoznaczniej odpowiada bezpośrednie żądanie z pominięciem walidacji
   klienta, a nie klikanie w formularz, który i tak ma własną walidację po stronie przeglądarki
   (`Math.round(...*100)` w `publiczne/js/wniosek.js` — potwierdzone w Z-103, że to WYŁĄCZNIE
   ochrona UI). Nie zrobiono zrzutów ekranu w tej fazie z tego właśnie powodu — folder
   `testy-audyt/zrzuty/faza2/` pozostaje pusty.

## Pytania zapisane do `PYTANIA-DO-LUKASZA.md`

- **P-007** — czy stan otwarcia rejestru to wpisy na żądanie (każdy odpłatny 100 zł), czy wyłącznie
  opłata za prowadzenie rejestru — pytanie postawione wprost przez checklistę sesji; zgłaszam, że
  DWIE ścieżki zakładania spółki dają dziś DWIE RÓŻNE odpowiedzi w kodzie (portal: 1× prowadzenie,
  0× wpis; kreator wewnętrzny: 0× cokolwiek).
- **P-008** — czy martwy w UI endpoint kalendarzowy `/naliczenie-roczne` (źródło Z-100) ma zostać
  usunięty, zabezpieczony, czy pozostawiony bez zmian.

## Podsumowanie zgodności ze stawkami maksymalnymi

Poza dwoma opisanymi lukami walidacyjnymi (Z-101 przy ręcznym wpisie; Z-100 przy podwójnym
naliczeniu automatycznym) — WSZYSTKIE automatyczne ścieżki naliczania (`naliczOplateWpisu`,
`naliczOplateInformacji`, `naliczOkresProwadzenia`) poprawnie korzystają z jednego źródła stawek
(`ustawienia.stawkaGrosze`, które samo z kolei nigdy nie przekracza `STAWKI_MAKSYMALNE_GROSZE` przy
konfiguracji stawki własnej kancelarii) i we WSZYSTKICH przetestowanych scenariuszach naliczały
DOKŁADNIE stawkę maksymalną z rozporządzenia (100 / 1200 / 50 zł), nigdy więcej. Jedyna droga do
zawyżenia to (a) opisany brak walidacji przy ręcznym wpisie pojedynczej opłaty i (b) opisany brak
wzajemnej świadomości dwóch mechanizmów „prowadzenie".
