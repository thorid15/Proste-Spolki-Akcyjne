# Błędy znalezione przez tester (Faza 2) — odtworzenie i przyczyna, bez poprawek

> Metoda: `superpowers:systematic-debugging` fazy 1–3 (odczyt błędu, reprodukcja, porównanie ścieżki działającej
> z wadliwą, jedna hipoteza sprawdzona minimalnym testem). Faza 4 (poprawka) — **nie w tej sesji**; poprawki w planie wdrożenia.
> Numeracja B-… wspólna z `RAPORT-PRZEPLYWY.md` § 2.

## B-001 — Wpis z urzędu z przycisku w kokpitu wymaga żądającego; „Załóż sprawę” nieaktywne

- **Waga:** B (blokuje — zajęcie / uchylenie zajęcia nie da się założyć wejściem z kokpitu).
- **Odtworzenie:** kokpit spółki → „Zajęcie egzekucyjne (z urzędu)” (`#/spolki/1/zdarzenie?typ=zajecie`) → krok „Podstawa”.
  Widać naraz komunikat „To zdarzenie zakłada się wyłącznie z urzędu — bez żądającego” **i** pola „Żądający wpisu”,
  „W jakim charakterze”; „Załóż sprawę i przejdź dalej” nieaktywne.
  Ten sam typ wybrany kafelkiem w kroku „Co się stało” (`#/spolki/1/zdarzenie`) działa: pól żądającego brak, przycisk aktywny.
  Skrypt reprodukcji (wynik): `A) z adresu: {"zadajacy":1,"info":1,"zaloz":false}`, `B) kafelek: {"zadajacy":0,"info":1,"zaloz":true}`.
  Scenariusze: `wpis-zajecie`, `wpis-wykreslenie_zajecia` (krok „Podstawa”).
- **Przyczyna:** `publiczne/js/kreator.js:1407–1411` — efekt ustawiający `zrodlo = 'z_urzedu'` ma zależność `[typ]`, a czyta
  `definicjaTypu` (z `useDane('/api/psa/meta')`, ładowane asynchronicznie). Przy typie z adresu (`typPoczatkowy`) efekt
  wykonuje się raz, zanim `meta` przyjdzie (`definicjaTypu === null`) — i już się nie powtarza, bo `typ` się nie zmienia.
  `zrodlo` zostaje `'papier'` → `zadajacyKompletny` (`:1467`) wymaga żądającego. Przez kafelek typ ustawia się po wczytaniu `meta`, więc działa.
- **Kierunek poprawki (następna sesja):** zależność efektu `[typ, definicjaTypu]` (albo wyliczenie `zrodlo` bez efektu) + test e2e `wpis-zajecie`.

## B-002 — „Sprostowanie” w kreatorze prowadzi do ślepego zaułka po założeniu sprawy

- **Waga:** B (blokuje — sprawa założona, wpisu nie da się dokonać; zostaje sprawa do anulowania).
- **Odtworzenie:** kreator → „Sprostowanie wcześniejszego zdarzenia” → „Podstawa” → „Załóż sprawę i przejdź dalej” (sprawa
  powstaje) → „Co się zmienia” → „Dalej” → „Weryfikacja i podgląd”: „Wpis nie może zostać dokonany: Typ zdarzenia
  „sprostowanie” nie jest jeszcze obsługiwany przez kreator w tym sprincie.”; „Dokonaj wpisu” nieaktywne. Scenariusz `wpis-sprostowanie`.
- **Przyczyna:** typ `sprostowanie` (`server/logika/typy-zdarzen.js:373`, `sprint: 2`, bez `kreator: false`) wchodzi do
  `dostepneWKreatorze()` i do kafelków kreatora, ale `server/logika/kreator.js` nie ma dla niego budowniczego
  w `PRZYGOTOWANIA` — `przygotuj()` (`:754`) rzuca `BladKreatora`. Działająca ścieżka sprostowania to osobne okno w historii
  kokpitu → `POST /zdarzenia/:id/sprostuj` → `rejestr.js:692` `przygotujSprostowanie`. Sprawdzone dla wszystkich typów kreatora:
  `sprostowanie` jest jedynym bez budowniczego.
- **Kierunek:** `kreator: false` dla `sprostowanie` (jedna droga — okno w historii, W9) albo budowniczy wołający `przygotujSprostowanie`.

## B-003 — Po „Wyślij powiadomienie” (K4) kreator wraca do „Co się zmienia”, checklista znika

- **Waga:** U (utrudnia — użytkownik traci miejsce i odhaczoną checklistę; jedno „Dalej” i ponowne odhaczenie więcej).
- **Odtworzenie:** typ z uprzednim powiadomieniem (obciążenie, umorzenie, zobowiązanie, prawo głosu zastawnika, zbycie ułamka)
  → „Weryfikacja i podgląd” → panel „Uprzednie powiadomienie”: „Kogo powiadomić” → „Wyślij powiadomienie” → nagłówek kroku
  zmienia się na „Co się zmienia” (krok 2/3), „Wstecz” nieaktywne, odhaczenia znikają. Sonda: stan przed wysłaniem
  `["Weryfikacja i podgląd"]`, po wysłaniu `["Co się zmienia"]`. Scenariusze `wpis-obciazenie`, `wpis-umorzenie`, `wpis-zobowiazanie`,
  `wpis-prawo_glosu_zastawnika`, `wpis-przeniesienie_ulamka`. To samo dotyczy „Odnotuj zgodę” (to samo `odswiez`).
- **Przyczyna:** `PanelPowiadomienia` po wysłaniu woła `odswiez()` sprawy; `useDane` ustawia `ladowanie: true`
  (`rdzen.js:315`), a `EkranSprawy` (`sprawy.js:1053`) przy `ladowanie` zwraca `<Spinner />` zamiast drzewa — `KreatorSprawy`
  odmontowuje się i po powrocie startuje od `useState(2)` (`sprawy.js:569`), `odhaczone = {}`, `podglad = null`.
  Zbycie (K5) ma własny stan kreatora i tego błędu nie ma (scenariusze `zbycie-*` przechodzą).
- **Kierunek:** odświeżanie w tle bez `Spinner` (zachować poprzednie `dane` w `useDane` przy `odswiez`) albo stan kroku nad kreatorem;
  docelowo — jeden wzorzec wpisu (raport § 4).
