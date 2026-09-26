# Prompt dla Claude Code — aktualizacja rejestru PSA po porównaniu z KRN

> Wklej całość jako polecenie w repozytorium rejestru PSA. Pliki wejściowe `Inwentaryzacja_Rejestr_PSA.md` i `POROWNANIE-KRN-PSA.md` powinny leżeć w repozytorium, np. w `docs/krn/`.

---

## Kontekst

Porównaliśmy nasz rejestr PSA z rejestrem KRN (rejestry-notarialne.pl). Szczegóły są w dwóch plikach:
- `Inwentaryzacja_Rejestr_PSA.md` — inwentaryzacja KRN,
- `POROWNANIE-KRN-PSA.md` — porównanie z naszym kodem.

Notariusz Łukasz Kozon podjął decyzje opisane niżej. Są wiążące. Jeżeli któraś z nich koliduje z kodem, z przepisem albo z inną decyzją, **zatrzymaj się i zgłoś to**. Nie rozstrzygaj sam.

Zasady pracy:
1. **Zacznij od etapu 0** (weryfikacja + plan). Nie zmieniaj kodu, dopóki nie przedstawisz raportu i planu i nie dostaniesz akceptacji.
2. **Nie zmieniaj zdarzeń już zapisanych w łańcuchu** (hashe, art. 300³¹ § 4 KSH). Stan akcji jest projekcją zdarzeń. Zmiany reguł realizuj przez przeliczenie projekcji, a nie przez przepisywanie historii.
3. Migracje schematu mają być addytywne i odwracalne. Po każdym etapie: testy, osobny commit, wpis w rejestrze decyzji projektu (kolejne numery `D-0xx`, z odesłaniem do identyfikatorów decyzji poniżej).
4. Terminologia polska: akt notarialny, kancelaria, wpis, informacja z rejestru, zawiadomienie.

---

## Decyzje do wdrożenia

### D-R01 — stan rejestru liczony od chwili wpisu; data zdarzenia usunięta
- Stan rejestru (kto jest akcjonariuszem, zastawnikiem, użytkownikiem w danym dniu) liczymy **zawsze od chwili wpisu** (data i godzina), dla każdego rodzaju wpisu.
  - Podstawa: art. 300³⁷ § 1 KSH (nabycie z chwilą wpisu).
  - Dla przypadków z art. 300³⁷ § 2 (objęcie, spadek, zapis windykacyjny, aport, połączenie, podział, przekształcenie) podstawą jest art. 300³⁸ § 1 (wobec spółki akcjonariuszem jest tylko osoba wpisana).
- **Data zdarzenia (`data_zdarzenia`) — usuwamy.** Nie zbieramy jej w kreatorze i formularzach. Nie jest wymagana w walidacjach. Nie wyświetlamy jej, nie drukujemy i nie używamy w logice stanu. W już zapisanych zdarzeniach łańcucha pole zostaje nienaruszone, a nowe zdarzenia go nie zapisują (albo zapisują `null`, jeżeli wymaga tego format hasha — uzasadnij wybór).
- **Data wpisu nadaje system:** znacznik czasu w chwili zatwierdzenia wpisu. Nie można go edytować ani antydatować. Jedyny wyjątek to import z KRN (D-R08): tam przyjmujemy historyczną datę rejestracji z KRN, a zdarzenie oznaczamy jako migracyjne.
- **„Stan na dzień D”** oznacza stan na koniec dnia D (wpisy do 23:59:59 czasu Europe/Warsaw). Dla dnia bieżącego to stan na chwilę sporządzenia. Informacja wydana dla dnia D ma być identyczna niezależnie od tego, kiedy ją wygenerowano.
- Przelicz przedziały `psa_stan_akcji.data_od/data_do` według chwili wpisu. Przedziały powstałe z podziału transzy (pozostałość u zbywcy) zachowują pierwotną datę wpisu nabycia tych numerów.
- Daty dzienne przechowuj jako `DATE` (tekst ISO), a znaczniki czasu jako UTC z konwersją do Europe/Warsaw przy prezentacji. Nie powtarzaj błędu KRN, gdzie przy dacie pojawia się godzina 02:00:00.

### Treść informacji z rejestru (`server/logika/informacja-dokument.js`)
- **D-R02:** w tabeli emisji drukujemy **tylko datę wpisu emisji do KRS** (`data_wpisu_krs`), z etykietą „Data zarejestrowania emisji” (art. 300³³ § 1 pkt 3). `data_emisji` zostaje wyłącznie na ekranie.
- **D-R02a (spójnie z D-R02):** jako „Data zarejestrowania spółki” drukujemy **datę wpisu spółki do KRS**. Sprawdź, co faktycznie przechowuje `data_utworzenia_spolki` (etap 0). Jeżeli to data aktu założycielskiego albo umowy, zgłoś to i zaproponuj rozwiązanie: właściwe pole albo zmianę etykiety.
- **D-R03/R06 — prezentacja akcji:**
  - wiersz = **osoba + seria** (bez zmian);
  - w kolumnie numerów **data wpisu każdego zakresu**, np. `1–889, 990 (wpis 12.08.2026); 890–989 (wpis 25.09.2026)`;
  - zakresy scalamy tylko wtedy, gdy mają tę samą datę wpisu;
  - dla osoby z więcej niż jedną serią dodajemy wiersz **„Łącznie”** (liczba akcji, udział %);
  - to samo w widoku szczegółowym kokpitu, gdzie każdy zakres dostaje własną datę wpisu zamiast daty najstarszej transzy.
- **D-R04/R05:** dodajemy na informacji:
  - **cenę emisyjną z walutą** przy każdej emisji,
  - **opis emisji** pod emisją,
  - **opis spółki** w sekcji „Spółka”.
  Podstawy prawnej emisji **nie drukujemy**.
- **D-R06 — głosy:** liczby głosów **nie pokazujemy nigdzie** (ekran, informacja, eksporty). Usuń wyświetlanie. Obliczenie `glosy` usuń, jeżeli nie jest używane gdzie indziej. Jeżeli jest, zgłoś gdzie.
- **D-R07:** stopka „Sporządzono dd.mm.rrrr, godz. gg:mm”, a przy stanie na dzień bieżący także „Stan na dd.mm.rrrr, godz. gg:mm”.

### Dane i słowniki
- **D-31 — przekazanie rejestru (tylko ewidencja):**
  - zapisujemy datę przekazania, odbiorcę (typ: notariusz / izba notarialna / podmiot z art. 300³¹ § 1 pkt 1; nazwa; identyfikator) i podstawę (nowa umowa z dnia …, art. 300³² § 2);
  - po zapisaniu przekazania rejestr spółki jest tylko do odczytu (wpisy zablokowane, podgląd i informacje dostępne);
  - pakietu eksportu nie budujemy.
- **D-34 — kraje:**
  - słownik ISO 3166-1 alfa-2 z polskimi nazwami, stosowany dla spółki, akcjonariusza i wszystkich adresów; zapisujemy kod, domyślnie PL;
  - migracja istniejących wartości tekstowych na kody;
  - wartości nierozpoznane trafiają do raportu do ręcznej poprawy. Nie zgaduj.
- **D-Z — osoba działająca:** przy każdym wpisie zapisujemy osobę działającą (notariusz albo zastępca notarialny: imię, nazwisko, funkcja), niezależnie od pracownika-autora. **Tylko do audytu**, nie drukujemy jej na dokumentach.

### Przepływ wprowadzania danych
- **D-P1 — czynności z poziomu wiersza:** z wiersza akcjonariusza lub zakresu akcji (kokpit, widok szczegółowy) uruchamiamy od razu zbycie, obciążenie albo umorzenie. Kreator otwiera się z wypełnionym zbywcą, serią i zakresem, które można zawęzić.
- **D-P2 — wybór lub dodanie osoby w jednym oknie:** w polach nabywcy, obejmującego, zastawnika itp. wyszukujemy w kartotece `psa_osoby` i możemy dodać nową osobę bez wychodzenia z kreatora. Po zapisie osoba jest od razu wybrana.
- **D-P3 — blokada zmiany emisji po objęciu:** po objęciu choćby jednej akcji emisji nie można sprostować serii, numeracji ani liczby akcji. Blokada działa na backendzie i w UI. Komunikat ma skierować do właściwej czynności (umorzenie albo nowa emisja). Pola opisowe (tytuł, opis, uwagi) można nadal zmieniać.
- Podglądu „przed/po” nie wprowadzamy.
- Istniejąca walidacja „nabywca ≠ zbywca” zostaje. Potwierdź w etapie 0, że obejmuje wszystkie czynności przejścia.

### D-R08 — przejęcie danych z KRN (`PRZEJECIE-REJESTRU.md`)
Dopisz reguły:
1. Wpis U/P/O z maską kilku rodzajów rozbijamy na osobne wpisy, po jednym na rodzaj.
2. Treść postanowienia z „Komentarza do statusu” przenosimy do `tresc`.
3. Ograniczenia rozporządzania zapisane w „Uwagach notariusza” spółki przenosimy do `psa_ograniczenia`.
4. Pokrycie zapisane w „Uwagach” przenosimy do `pokrycie_akcji`.
5. Data rejestracji w KRN staje się datą wpisu (D-R01). Daty zdarzenia nie ma.
6. Transze KRN tego samego akcjonariusza w tej samej serii i z tą samą datą łączymy według D-R03. Transze z różnymi datami zachowują własne daty.
7. Przed migracją Charlie Unicorn AI PSA trzeba wyjaśnić anomalię: akcjonariusz ID 21995 bez akcji oraz transakcja z 25.09.2026 (nr 890–989), w której nabywca jest zarazem zbywcą. Migracja tej spółki czeka na decyzję notariusza.
8. Numeracja serii od numeru innego niż 1 (w KRN np. AN 1–25, AZ 26–100) musi przejść bez błędów.

### Pozycje, których nie przejmujemy z KRN
Status „spółka w przygotowaniu”, priorytet zdarzeń, wymagany tel./e-mail spółki, tel./e-mail/www spółki na informacji, komunikat „zmiana widoczna od D+1”.

---

## Etap 0 — weryfikacja i plan (raport, bez zmian w kodzie)

Przedstaw raport z odpowiedziami na poniższe punkty i plan etapów 1–6 z listą plików.

1. **`data_zdarzenia`:** gdzie jest zbierana, walidowana, używana (stan, dokumenty, zawiadomienia, terminy, opłaty, eksport). Wskaż też, czy wchodzi do hasha zdarzenia.
2. **Data wpisu:** gdzie dziś powstaje `data_wpisu`, czy można ją edytować i jak kreator ustala `data_od` przy przeniesieniu i objęciu.
3. **`glosy`:** gdzie są liczone i wyświetlane.
4. **`data_utworzenia_spolki`:** jakie ma znaczenie, co wpisuje kreator i co drukuje informacja.
5. **Blokada emisji:** czy sprostowanie emisji po objęciu jest dziś blokowane i z jakim komunikatem.
6. **Waluta:** czy UI pozwala wybrać walutę emisji inną niż PLN.
7. **Wyszukiwanie:** czy lista spółek szuka po nazwisku lub firmie akcjonariusza. Tylko zgłoś, nie implementuj.
8. **Numeracja:** czy `nr_pierwszy ≠ 1` działa w emisji, obejmowaniu i na informacji.
9. **Walidacja nabywca ≠ zbywca:** zakres (przeniesienie, darowizna, dziedziczenie, aport itd.).
10. **Cytaty ustawowe:** zweryfikuj w tekście jednolitym KSH (ISAP), czy istnieją **art. 300³⁵ § 1¹** (maskowanie danych) i **art. 300³² § 3**. W sprawdzonych źródłach art. 300³⁵ ma § 1–3, a art. 300³² § 1–2. Jeżeli nie potwierdzisz, wypisz wszystkie miejsca w kodzie, UI i dokumentach, gdzie te jednostki są cytowane.

## Etapy wdrożenia (po akceptacji planu)

1. D-R01: data wpisu systemowa, usunięcie daty zdarzenia, przeliczenie projekcji stanu.
2. Informacja z rejestru: D-R02, D-R02a, D-R03/R06, D-R04/R05, D-R06, D-R07.
3. Kokpit: widok szczegółowy z datą per zakres, wiersz „Łącznie”, usunięcie głosów.
4. Dane: D-31, D-34, D-Z.
5. Przepływ: D-P1, D-P2, D-P3.
6. Dokumentacja: `CLAUDE-PSA.md`, `PRZEJECIE-REJESTRU.md` (D-R08), rejestr decyzji.

## Kryteria akceptacji (testy)

- **Umowa zbycia z wpisem 06.10 o 14:00:** „stan na 05.10” pokazuje zbywcę, „stan na 06.10” pokazuje nabywcę. Informacja „stan na 05.10” wygenerowana 05.10 i 07.10 jest identyczna (poza znacznikiem sporządzenia).
- **Dziedziczenie wpisane 10.10:** do 09.10 akcjonariuszem jest spadkodawca, od 10.10 spadkobierca. W modelu nie ma daty śmierci ani daty zdarzenia.
- **Próba ręcznej zmiany daty wpisu:** odrzucona na backendzie.
- **Informacja dla spółki z przykładu Charlie:** `A | 1–889, 990 (wpis 12.08.2026); 890–989 (wpis 25.09.2026)`. Przy dwóch seriach pojawia się wiersz „Łącznie”. Nigdzie nie ma głosów.
- **Tabela emisji na informacji:** „Data zarejestrowania emisji” = `data_wpisu_krs`, cena emisyjna z walutą, opis emisji. W sekcji spółki jest opis spółki. Nie ma podstawy prawnej.
- **Stopka:** „Sporządzono …, godz. gg:mm”.
- **Emisja z objętą akcją:** zmiana liczby akcji lub numeracji odrzucona z komunikatem. Zmiana opisu przechodzi.
- **Rejestr po zapisaniu przekazania:** każdy nowy wpis odrzucony, informacja dostępna.
- **Kraje:** wybór ze słownika. Import nierozpoznanej wartości trafia do raportu i nie jest zgadywany.
- **Kreator zbycia uruchomiony z wiersza:** zbywca, seria i zakres wypełnione. Dodanie nowej osoby w oknie wyboru bez wychodzenia z kreatora.
- **Integralność:** weryfikacja łańcucha hashy po migracji przechodzi bez błędów.
