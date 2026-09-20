# FAZA 0 — inwentaryzacja portalu klienta (publiczne/portal.html)

Data: 2026-09-20. Serwer testowy: `node serwer.js` na porcie 4002, baza izolowana
`dane/.audit-portal.db` (usunięta po zakończeniu), `KATALOG_DOKUMENTOW=/tmp/audit-portal-dokumenty`
(usunięty po zakończeniu). Serwer **zatrzymany** po zakończeniu prac (potwierdzone:
`curl http://localhost:4002/` nie odpowiada, procesy `node serwer.js` zabite).

Narzędzia: Playwright (Chromium 1194, headless, `--no-sandbox`), dwa viewporty:
1440×900 (desktop) i 390×844 (iPhone 14-podobny). Wszystkie zrzuty w
`/tmp/frontend-audit/portal/*-1440.png` / `*-390.png` (fullPage).

Dane testowe — trzej klienci portalu (hasło zawsze `HasloKlienta123`):

| # | e-mail | stan |
|---|---|---|
| Klient 1 | proba.535591@example-test.pl | pełna ścieżka do wpisu — rola „spółka", rejestr otwarty, 1 zdarzenie przeniesienia w toku (dodane w trakcie audytu, zadanie g) |
| Klient 2 | proba.626896@example-test.pl | rola „wnioskodawca", status `umowa_wygenerowana` — dokumenty czekają na podpis |
| Klient 3 | proba.632393@example-test.pl | rola „wnioskodawca", konto aktywowane, wniosek zupełnie pusty (`w_przygotowaniu`) |

Dodatkowo: dla zadania (f) i zrzutów 01/02 użyto jednorazowych, nowo zarejestrowanych
kont (pełna ścieżka zgłoszenie→aktywacja→wypełnienie→złożenie wykonana na żywo w
przeglądarce, osobno dla każdego viewportu).

## 1. Odchylenia architektury od założeń zadania

Routing portalu (`publiczne/js/portal.js`, `publiczne/js/wniosek.js`) różni się od
opisu w briefie w kilku miejscach — zanotowane, żeby nie szukać nieistniejących ekranów:

- **Brak ekranu „Konto"** (dane logowania, dokumenty prawne, zmiana hasła). Nawigacja
  portalu ma tylko: Wniosek (dla wnioskodawcy), Moja spółka/Moje spółki (`/`), Moje
  zgłoszenia (`/sprawy`), Płatności (`/platnosci`). Nie ma nigdzie ekranu do zmiany
  hasła ani przeglądu własnych danych konta — jedyna namiastka „dokumentów prawnych"
  to link Regulaminu/Polityki prywatności w stopce (`ekranPrawny`/`StronaPrawna`),
  dostępny bez logowania. Zrzut 13 zastąpiony tą stroną prawną z dopiskiem `ALT`.
- **Brak zakładki „Dokumenty" dla spółki.** Nie ma osobnego archiwum dokumentów
  spółki w portalu. Dokumenty do podpisu żyją WYŁĄCZNIE wewnątrz kreatora wniosku
  (`#/wniosek`, krok „Podsumowanie", widoczne gdy `status` to `umowa_wygenerowana`/
  `umowa_podpisana`) — to jest zrzut 12. Po przyjęciu wniosku (rola „spolka") ten
  ekran już nie istnieje i nigdzie indziej nie widać listy wydanych dokumentów.
  Zrzut 07 pominięty — nie ma odpowiednika; to realna luka funkcjonalna, nie
  tylko inna nazwa ekranu.
- **„Wnioski — oś statusu" (09)** to w rzeczywistości `#/sprawy` „Moje zgłoszenia" —
  zwykła tabela ze znacznikiem stanu i paskiem terminu, nie oś/wykres. Dodatkowo ten
  ekran jest dostępny wyłącznie dla ról `spolka`/`akcjonariusz` (przez `EkranMoje` →
  przycisk „Zgłoś zmianę"); klient 2 (rola `wnioskodawca`, bez spółki) w ogóle nie ma
  dostępu do tego widoku ani przycisku, który by go tam zaprowadził. Żeby dostarczyć
  wymagany zrzut, użyto klienta 1 i w ramach zadania (g) złożono na żywo jedno
  zgłoszenie zmiany — dopiero wtedy tabela miała czym się wypełnić.
- **Krok „Sprawdź skrzynkę"** (02) to nie osobny adres, tylko stan `gotowe` tego
  samego ekranu `#/zglos-sie` po wysłaniu formularza („Zaproszenie wysłane").
- Link aktywacyjny zwracany przez API i przez `narzedzia/scenariusz-e2e.js` ma
  zaszyty domyślny port `3005` (`link_aktywacyjny: http://localhost:3005/...`) —
  trzeba go ręcznie podmienić na `4002`, inaczej przeglądarka dostaje
  `ERR_CONNECTION_REFUSED`. Potwierdzone identyczne zachowanie jak opisane w briefie.

## 2. Lista zrzutów

Wszystkie poniżej istnieją w wersji `-1440.png` i `-390.png`.

| Plik | Opis | Uwagi |
|---|---|---|
| `00-logowanie` | Ekran logowania (`#/`, niezalogowany) | OK na obu szerokościach |
| `01-zglos-sie` | Publiczny formularz „Zgłoś zainteresowanie” (`#/zglos-sie`) | OK |
| `02-sprawdz-skrzynke` | Stan „Zaproszenie wysłane” po wysłaniu zgłoszenia | to samo `#/zglos-sie`, nie osobny adres |
| `03-start-puste` | Pulpit klienta 1 po zalogowaniu (`#/`, rola spółka) | = ekran „Moje spółki” (patrz niżej) |
| `04-start-do-zrobienia` | Pulpit klienta 2 (`#/`, rola wnioskodawca, status „Dokumenty czekają na podpis”) | Karta `StanWniosku` z przyciskiem „Przejdź do wniosku” |
| `05-moje-spolki` | „Moje spółki” klienta 1 | Identyczny ekran co 03 — dla roli `spolka` to jest ten sam komponent (`EkranMoje`) |
| `06-widok-rejestr` | `#/rejestr/1`, klient 1 — maskowanie danych | patrz ustalenie 3a niżej: tabela ucięta na 390px |
| `07-widok-dokumenty` | — (nie istnieje) | patrz sekcja 1 |
| `08-widok-oplaty` | `#/platnosci`, klient 1 | OK na obu szerokościach; 3 zduplikowane pozycje „Wpis w rejestrze” to artefakt powtórnych przebiegów skryptu testowego (zadanie g uruchamiane kilkukrotnie podczas debugowania), nie błąd portalu |
| `09-wnioski-os-statusu` | `#/sprawy`, klient 1, po złożeniu zgłoszenia zmiany | patrz ustalenie 3b niżej: kolumny „Stan”/„Termin” całkowicie niewidoczne na 390px |
| `10-wniosek-krok-spolka` | `#/wniosek`, krok „Spółka”, klient 3 (świeży) | OK |
| `11-wniosek-krok-akcjonariusze` | `#/wniosek`, krok „Akcjonariusze”, klient 3 (pusta lista) | OK |
| `12-dokumenty-do-podpisu` | `#/wniosek`, krok „Podsumowanie”, klient 2 (9 dokumentów nieodpisanych) | działa na 390px, ale bardzo długi scroll (~4460px wysokości) |
| `13-konto` | — (nie istnieje) — zastąpiono stroną prawną (Regulamin/Polityka) z footera | patrz sekcja 1 |
| `14-blad-walidacji` | `#/wniosek`, krok „Podsumowanie”, klient 3, bez wypełnienia | czytelny komunikat + wyszarzony przycisk „Złóż wniosek”, OK na obu szerokościach |
| `15-blad-logowania` | Złe hasło na ekranie logowania | OK |
| `16-zgloszenie-zmiany-potwierdzenie` | Ekran potwierdzenia po „Złóż zgłoszenie” (zadanie g) | dodatkowy zrzut poza listą zadania — pomocny kontekst |
| `17-informacja-formularz` | `#/informacja/1`, formularz zamówienia | dodatkowy zrzut — kontekst zadania (h) |
| `18-informacja-wynik` | Wynik zamówienia informacji z rejestru | patrz ustalenie 3c niżej: brak realnej płatności/pobrania w tym środowisku |
| `99-wniosek-zlozony-ALT-fresh` | Ekran po złożeniu wniosku przez zupełnie nowe konto (zadanie f) | dodatkowy zrzut dokumentujący zakończenie zadania (f) |
| `10-wniosek-krok-spolka-ALT-fresh`, `11-wniosek-krok-akcjonariusze-ALT-fresh` | Te same kroki, ale w trakcie przebiegu zadania (f) na świeżym koncie | dodatkowe, dla kompletności ścieżki (f) |

## 3. Kluczowe ustalenia jakościowe (mobile 390px)

**a) Tabela rejestru (`#/rejestr/:id`) jest ucięta na 390px — kolumny „Udział” i
„Obciążenia” są całkowicie niedostępne.** Zmierzono bezpośrednio w DOM: kontener
tabeli ma `overflow-x: hidden`, `scrollWidth` tabeli = 530px przy `clientWidth`
kontenera = 308px. To nie jest kwestia przewijania w bok — nadmiar jest **obcięty
i niedostępny żadnym gestem**. Na desktopie (1440px) wszystkie 6 kolumn widać w
całości (zrzut `06-widok-rejestr-1440.png`).

**b) Tabela „Moje zgłoszenia” (`#/sprawy`) na 390px pokazuje tylko 3 z 5 kolumn —
kolumny „Stan” i „Termin” (czyli sedno tego ekranu — status sprawy i licznik dni)
są całkowicie niewidoczne.** Ten sam mechanizm: `overflow-x: hidden` na wrapperze,
`scrollWidth` tabeli 467px vs `clientWidth` kontenera 308px. Klient na telefonie nie
ma żadnego sposobu, żeby zobaczyć, na jakim etapie jest jego zgłoszenie — musi
otworzyć portal na komputerze. To wygląda na globalną regułę CSS dla klasy `.tbl`
(albo jej kontenera), więc prawdopodobnie dotyczy **każdej** tabeli w portalu na
wąskim ekranie, nie tylko tych dwóch zmierzonych.

**c) Płatności online nie są skonfigurowane w tym środowisku (brak `TPAY_CLIENT_ID`
w `.env`)** — zarówno zadanie (g), jak i (h) kończą się komunikatem „Płatności online
są chwilowo niedostępne — kancelaria rozliczy fakturą”, więc pełnej ścieżki
płatność→pobranie dokumentu nie dało się zmierzyć end-to-end w tym środowisku
testowym; portal poprawnie degraduje do wariantu fakturowego zamiast się wywalić.

**d) Poza tabelami reszta portalu skaluje się na 390px poprawnie**: formularze,
karty, przyciski, nawigacja (chowa się do jednego rzędu zakładek pod paskiem
górnym), kreator wniosku wielokrokowy, lista dokumentów do podpisu (choć bardzo
długa — ok. 20 ekranów scrolla) — wszystko czytelne, bez poziomego przewijania
całej strony, bez nachodzących elementów.

## 4. Kliknięcia dla zadań referencyjnych

Liczone jako realne kliknięcia myszką/palcem na przyciski, linki, checkboxy i pola
`<select>` (wypełnianie pól tekstowych/dat nie jest liczone jako klik). Ten sam
przebieg wykonano osobno na 1440px i na 390px — **liczba kliknięć wyszła identyczna
na obu szerokościach** (portal nie chowa żadnej akcji za dodatkowe menu na wąskim
ekranie ani jej nie ujawnia dodatkowym krokiem).

| Zadanie | 1440px | 390px | Kroki (kolejność kliknięć) |
|---|---|---|---|
| **(f)** Od logowania do złożonego wniosku (nowy klient) | **12** | **12** | 1. „Nie mam konta — zgłaszam zainteresowanie” (z ekranu logowania) → 2. „Wyślij zgłoszenie” → 3. „Otwórz portal” (link aktywacyjny) → 4. „Aktywuj konto” → 5. zaznacz checkbox RODO → 6. „Przejdź dalej” → 7. „Dalej” (krok Spółka) → 8. „Dalej” (krok Reprezentant) → 9. „Dodaj akcjonariusza” → 10. „Gotowe” (zapis akcjonariusza) → 11. „Dalej” (krok Akcjonariusze) → 12. „Złóż wniosek” |
| **(g)** Zgłoszenie zmiany przez zalogowanego klienta | **3** | **3** | 1. „Zgłoś zmianę” (z karty spółki na pulpicie) → 2. wybór typu zgłoszenia (`<select>`) → 3. „Złóż zgłoszenie” |
| **(h)** Opłacenie i pobranie informacji z rejestru | **2** | **2** *(niepełne — patrz 3c)* | 1. „Informacja z rejestru” (z karty spółki) → 2. „Zamów informację” — **w tym środowisku na tym się kończy**: bez skonfigurowanego TPAY nie ma trzeciego kliknięcia „zapłać” ani czwartego „pobierz”, bo link płatności nigdy nie powstaje |

**Metodologia (f):** zmierzone bezpośrednio klik-po-kliku w Playwright (licznik
`tick()` w skrypcie audytowym), z tym zastrzeżeniem: skrypt sam wchodził na
`#/zglos-sie` przez `page.goto()` zamiast klikać przycisk „Nie mam konta —
zgłaszam zainteresowanie” na ekranie logowania (dla wygody powtarzalnych
przebiegów) — ten klik dodano tu ręcznie jako krok 1., bo w realnym użyciu jest
on konieczny (zadanie zaczyna się „od strony logowania”). Pozostałych 11 kliknięć
(2–12) to kliknięcia faktycznie wykonane i zliczone przez skrypt, identycznie na
obu viewportach.

**Różnice mobile vs desktop:** żadnych — te same przyciski, w tej samej kolejności,
bez dodatkowych kroków na 390px. Jedyna różnica jest wizualna/UX, nie w liczbie
kliknięć: na 390px trzeba więcej **przewijać** (pionowo) między polami formularza i
między kolejnymi dokumentami do podpisu (krok 12 ma ok. 20 „ekranów” scrolla na
telefonie wobec ok. 4 na desktopie), a w dwóch tabelach (3a, 3b) część danych jest
na 390px w ogóle nieosiągalna, niezależnie od przewijania.

## 5. Sprzątanie

- Baza testowa `dane/.audit-portal.db*` — usunięta.
- Katalog dokumentów `/tmp/audit-portal-dokumenty` — usunięty.
- Proces serwera (PID-y 368, 468, uruchomione z `PORT=4002`) — zabity (`kill -9`);
  potwierdzone brakiem odpowiedzi na `curl http://localhost:4002/`.
- `git status --short` w repo — czysty, brak zmian w plikach repozytorium.
