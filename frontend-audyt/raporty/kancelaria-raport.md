# FAZA 0 — inwentaryzacja UI aplikacji kancelarii (Rejestr akcjonariuszy P.S.A.)

Data: 2026-09-20. Serwer izolowany na porcie 4001, baza `dane/.audit-kancelaria.db`
(usunięta po zakończeniu), dane zasiane trzykrotnym uruchomieniem
`narzedzia/scenariusz-e2e.js` (spółki #1, #2 w pełni przetworzone; wniosek #3
zatrzymany na etapie „umowa_podpisana" i dokończony ręcznie przez UI podczas
pomiaru zadania (a), tworząc spółkę #3). Przeglądarka: Chromium przez
Playwright, viewport 1440×900, zalogowano się przez formularz logowania.

Zrzuty: `/tmp/frontend-audit/kancelaria/*.png` (21 plików, pełna strona, skala 1×).

## 1. Lista zrzutów

| # | Plik | Co widać | Uwagi |
|---|------|----------|-------|
| 00 | `00-logowanie.png` | Ekran logowania — dwukolumnowy layout (opis produktu + karta logowania), stopka z danymi kancelarii. Czysty, spójny. | OK |
| 01 | `01-pulpit.png` | Pulpit: 4 kafle liczbowe (rejestry, sprawy w toku, akcjonariusze, zdarzenia), „Sprawy w toku" pusty, lista spółek, „Szybkie akcje". | Sensowny układ; „Sprawy w toku: 0" mimo że w bazie są zamknięte sprawy — poprawnie liczy tylko aktywne. |
| 02 | `02-sprawy-lista.png` | Kolejka spraw z domyślnym filtrem „Sprawy w toku" → **pusty stan** („Kolejka jest pusta", ikona + CTA „Przejdź do spółek"). | Naturalnie złapany pusty stan (patrz punkt 3 niżej). |
| 03 | `03-sprawy-szczegoly.png` | Szczegóły zamkniętej sprawy #1 (Przeniesienie akcji, status „wpisana"), sekcje Dokumenty/Żądanie/Wydane dokumenty. | OK, czytelne. |
| 04 | `04-spolki-lista.png` | Lista spółek (2 pozycje), kolumny status/serie/akcjonariusze/akcje/ostatnie zdarzenie. | OK |
| 05 | `05-spolka-kreator-krok1.png` | Kreator nowej spółki, krok 1 „Spółka" — długi formularz (KRS, dane teleadresowe, kapitał, daty). | Formularz bardzo długi jak na krok 1/4; brak podziału na sekcje zwijane. |
| 06 | `06-kokpit-spolki.png` | Kokpit spółki z otwartym rejestrem: tabela akcjonariuszy, rejestry poboczne (akcji, uprawnień, zajęć, zdarzeń), panel boczny (dane rejestrowe, umowa, stan rejestru, AML). | Bogaty, dobrze zorganizowany widok. |
| 07 | `07-kreator-zdarzenia.png` | Krok 1 kreatora zdarzenia „Co się stało" — kafelki pogrupowane (Akcje / Obciążenia i zajęcia / Prawa i ograniczenia / Dane / Inne). | Czytelna kategoryzacja 17 typów zdarzeń. |
| 08 | `08-osoby-lista.png` | Kartoteka osób — 4 wiersze, w tym **dwie pary identycznych nazwisk** („Nowak Anna" ×2, „Wiśniewski Piotr" ×2, każda przypisana do innej spółki). | Patrz finding 3 niżej — brak wizualnego rozróżnienia w liście. |
| 09 | `09-zgloszenia.png` | Lista zgłoszeń wstępnych z portalu (3), wszystkie w statusie „zaproszono". | OK |
| 10 | `10-wnioski-lista.png` | Lista wniosków — 2 „przyjęty", 1 „podpisane — do przyjęcia". | OK |
| 11 | `11-wnioski-szczegoly.png` | Szczegóły przyjętego wniosku, zakładka „Dane spółki", baner „Porównanie z odpisem KRS: API KRS odpowiedziało błędem (403)". | Błąd API KRS oczekiwany w tym środowisku (brak dostępu do sieci zewnętrznej) — nie blokuje pracy. |
| 12 | `12-zawiadomienia.png` | Kolejka zawiadomień — 2 spółki, każda z 1 sprawą czekającą, przycisk „Wyślij zawiadomienie (1 sprawa)". | Bardzo klarowny ekran. |
| 13 | `13-oplaty.png` | Opłaty pogrupowane po spółce, 3 pozycje/spółkę (2× wpis, 1× prowadzenie rejestru rocznie), akcje „Odhacz fakturę" / „Oznacz opłaconą" / „Anuluj". | OK |
| 14 | `14-konfiguracja-kancelaria.png` | Dane kancelarii — formularz metryki + podgląd „Tak zobaczy to klient". | Dobry pattern (podgląd na żywo). |
| 15 | `15-konfiguracja-stawki.png` | Stawki i terminy — taksa notarialna, terminy ustawowe, katalog 17 typów zdarzeń z metadanymi (odpłatność, powiadomienie, dostępność w kreatorze). | Bardzo dużo treści na jednym ekranie (długi scroll), ale czytelne tabelarycznie. |
| 16 | `16-szablony.png` | Szablony dokumentów — 10 wzorów (.docx z katalogu `wzory/`), wszystkie „gotowy". | Uwaga: mimo że tabela `psa_szablony` w bazie ma 0 wierszy, ekran POPRAWNIE czyta wzory z systemu plików — nie jest to pusty stan. |
| 17 | `17-uzytkownicy.png` | Lista użytkowników — 1 konto (Administrator), akcje Resetuj hasło / Zablokuj. | OK |
| 18 | `18-blad-walidacji.png` | Kreator nowej spółki z pustym polem „Firma (nazwa) spółki" — przycisk „Dalej" jest **zablokowany (disabled)**, nie pojawia się żaden komunikat błędu. | Patrz finding 4 niżej. |
| 19 | `19-blad-otwarcia-rejestru.png` | Krok 4 kreatora otwarcia rejestru — cała checklista odhaczona, a mimo to czerwony baner blokujący: „Emisja nie ma daty wpisu do KRS — akcje z niej jeszcze nie istnieją (art. 300(30) § 2 KSH)". | Realny, złapany na żywo „ślepy zaułek" — patrz finding 1 (zadanie a). |
| 20 | `20-ladowanie-spinner.png` | Ekran Opłaty w trakcie ładowania (API opóźnione sztucznie o 3 s przez `page.route`) — widoczny spinner (kółko) na środku pustego obszaru treści, reszta layoutu (sidebar, nagłówek, stopka) już wyrenderowana. | Prosty, spójny spinner — brak szkieletu/skeleton loading. |

**Pusty stan** (pkt z instrukcji): złapany naturalnie na zrzucie **02** („Kolejka spraw" z domyślnym filtrem pokazuje „Kolejka jest pusta", bo obie istniejące sprawy są już zamknięte/„wpisana") — nie trzeba było tworzyć osobnego zrzutu.

**Stan ładowania**: złapany na zrzucie **20** przez opóźnienie odpowiedzi API `/api/psa/oplaty/wg-spolek` o 3 sekundy.

## 2. Najważniejsze obserwacje z przejścia przez FAZĘ 0

1. **„Otwórz rejestr" może się nie udać mimo w pełni odhaczonej checklisty, a powrót do naprawy kosztuje 6 dodatkowych kliknięć.** Wskaźniki kroków u góry kreatora (Spółka / Umowa / Pierwsza emisja / Weryfikacja) **nie są klikalne** — jedyna droga wstecz to przycisk „Wstecz", krok po kroku. Po odhaczeniu całej 10-punktowej checklisty i kliknięciu „Otwórz rejestr" aplikacja zatrzymuje się z błędem „Emisja nie ma daty wpisu do KRS" (pole „Data rejestracji w KRS" z kroku 1 nie zostało przeniesione automatycznie z przyjętego wniosku portalowego). Naprawa wymaga: 3× „Wstecz" → wypełnienie pola → 3× „Dalej" → ponowne „Otwórz rejestr" — w sumie 8 dodatkowych kliknięć w ślepy zaułek, którego nic wcześniej nie zapowiadało (checklista była w pełni zielona).
2. **Checklista weryfikacji przed wpisem zbycia akcji zawiera pozycję, którą zaznaczenie BLOKUJE zapis, nie odblokowuje.** Punkt „Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu" wygląda jak zwykła pozycja checklisty do odhaczenia „na wszelki wypadek", ale zaznaczenie jej wymaga dodatkowo wpisania notatki uzasadniającej wątpliwość, zanim przycisk „Dokonaj wpisu" się odblokuje. Pracownik, który odhacza wszystkie pozycje odruchowo, utyka w tym samym miejscu co przy błędzie z punktu 1, tylko bez żadnego wyjaśniającego komunikatu w chwili kliknięcia checkboxa.
3. **Kartoteka osób: brak jakiegokolwiek podglądu profilu osoby.** Przycisk „Otwórz" przy wierszu osoby nie prowadzi do widoku szczegółów/profilu — otwiera od razu **formularz edycji danych osobowych** (modal „Dane osoby"). Liczbę spółek, w których występuje dana osoba, widać wyłącznie jako liczbę w kolumnie „Spółki" listy (bez rozwinięcia: nie da się z tego miejsca zobaczyć, **które konkretnie** to spółki — trzeba by szukać ręcznie po nazwiskach w każdej spółce z osobna). Dodatkowo w kartotece są dwie osoby o identycznym imieniu i nazwisku („Nowak Anna" ×2, „Wiśniewski Piotr" ×2, każda przypisana do innej spółki z osobna wygenerowanych danych testowych) bez żadnego dodatkowego identyfikatora w widoku listy (kolumna „Identyfikator jawny" pusta dla obu) — użytkownik nie ma jak odróżnić ich na pierwszy rzut oka.
4. **Walidacja pola wymaganego przez blokadę przycisku, nie przez komunikat.** Na kroku 1 kreatora nowej spółki puste pole „Firma (nazwa) spółki" po prostu blokuje przycisk „Dalej" (staje się `disabled`) — nie pojawia się żaden tekst tłumaczący dlaczego. To spójne z resztą aplikacji (widziałem ten sam wzorzec w kreatorze zdarzenia i w kreatorze otwarcia rejestru), więc nie jest to błąd, ale dla nowego użytkownika brak komunikatu przy pierwszym natrafieniu może być mylący („dlaczego guzik jest szary?").
5. Drobne: ekran „Informacja z rejestru" (wydruk) nie ma przycisku „Pobierz PDF" — jedyna droga do pliku to „Drukuj" → natywne okno przeglądarki „Zapisz jako PDF". Kontrastuje to z ekranem wniosków, gdzie każdy dokument ma bezpośredni link „Pobierz" do gotowego pliku PDF wystawionego przez serwer. Nie zweryfikowałem renderowania samego podglądu iframe w tym środowisku (sandbox blokował część zasobów sieciowych przy pod-żądaniach z iframe — prawdopodobnie artefakt środowiska testowego, nie aplikacji: to samo query przez `curl` zwróciło kompletny, poprawny HTML).

## 3. Kliknięcia dla 5 zadań referencyjnych

Punkt startowy każdego pomiaru: pulpit po zalogowaniu. Kliknięcia zmierzone **na żywo** przez Playwright (licznik w skrypcie, nie szacunek) — poza wyjątkami opisanymi w uwagach.

| Zadanie | Kliknięć | Przejść ekranu | Ślepe zaułki / uwagi |
|---|---|---|---|
| (a) Przyjęcie wniosku portalowego + otwarcie rejestru (nowy wniosek #3, „umowa_podpisana" → rejestr otwarty) | **29** | ~9 (Wnioski → wniosek → 3 zakładki wniosku → kreator „Dokończ otwarcie rejestru" → 2 kroki kreatora → powrót do kokpitu spółki) | **Główny ślepy zaułek**: patrz finding 1 wyżej — 8 z 29 kliknięć to czysto naprawa błędu „brak daty wpisu do KRS" po w pełni odhaczonej checklistcie. Bez tego zaułka realna ścieżka to 21 kliknięć. Z tego 16 kliknięć (ponad połowa) to wyłącznie potwierdzanie 9 podpisów dokumentów jeden po drugim (otwórz + „Podpis prawidłowy" dla każdego z osobna — brak opcji „potwierdź wszystkie na raz"), a kolejne 3 to ręczne przepisanie akcjonariatu założycielskiego (seria, liczba akcji, wybór 2 osób z kartoteki) mimo że te same osoby i liczby akcji były już zweryfikowane chwilę wcześniej na wniosku. |
| (b) Wpis zbycia akcji z żądania (od pulpitu do zapisanego zdarzenia przeniesienia) | **16** | 5 (Spółki → kokpit → sprawa nowo założona, 3 zakładki: Podstawa/Co się zmienia/Weryfikacja) | Zaobserwowany ślepy zaułek opisany w finding 2 (checklista z pozycją-pułapką) — ominięty świadomie w tym pomiarze przez pozostawienie pozycji odznaczonej; **nieświadomy** pracownik dodałby sobie dodatkowe kliknięcia identyczne z zadaniem (a). Dodatkowo „zbywcę" trzeba wybrać DRUGI RAZ (raz jako „żądający wpisu" w kroku Podstawa, raz jako „Zbywca" w kroku Co się zmienia) — to samo pole koncepcyjnie, dwa oddzielne wybory z kartoteki. |
| (c) Wydanie informacji z rejestru (od pulpitu do pobranego dokumentu) | **4** (3 do ekranu wydruku + 1 „Drukuj") | 3 (Spółki → kokpit → ekran informacji) | Po kliknięciu „Drukuj" proces pobrania pliku PDF wychodzi poza aplikację (natywne okno drukowania przeglądarki, „Zapisz jako PDF") — nieliczone jako kliknięcie w aplikacji, ale to dodatkowy krok dla użytkownika, którego nie ma przy dokumentach wniosku (tam jest bezpośredni „Pobierz"). |
| (d) Odnalezienie akcjonariusza i jego spółek (od pulpitu, przez kartotekę osób, do zobaczenia liczby spółek) | **1** (żeby zobaczyć samą liczbę w kolumnie listy) / **2** jeśli pracownik odruchowo klika „Otwórz” oczekując profilu | 1–2 | Patrz finding 3: kliknięcie „Otwórz” to ślepy zaułek pod kątem tego zadania — otwiera edycję danych osobowych, a nie widok z listą spółek. Nazw konkretnych spółek (nie tylko liczby) **nie da się zobaczyć z tego miejsca w ogóle** — aplikacja nie ma na to żadnego widoku. |
| (e) Wysyłka zawiadomień (od pulpitu do wystawionego zawiadomienia) | **2** | 2 (Zawiadomienia → wynik na tym samym ekranie) | Najprostsze z 5 zadań — brak przeszkód, brak zaułków, jeden ekran grupuje sprawy po spółce i akcja jest natychmiastowa (brak nawet dialogu potwierdzającego). |

## 4. Sprzątanie

Serwer testowy (`PORT=4001`) zatrzymany po zakończeniu pomiarów. Plik bazy
`dane/.audit-kancelaria.db` (+ `-wal`/`-shm`) oraz katalog dokumentów
`/tmp/audit-kancelaria-dokumenty` pozostają jako artefakty tej sesji pomiarowej —
można je bezpiecznie usunąć przed kolejną sesją tym samym poleceniem `rm -f`
z instrukcji.
