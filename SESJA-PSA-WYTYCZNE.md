# SESJA-PSA-WYTYCZNE — wdrożenie wytycznych „Rejestr akcjonariuszy PSA online” i tryb testowy bez poczty

> **Wersja 1 — 1.11.2026.** Sesja Claude Code dla modułu **Rejestr akcjonariuszy P.S.A.** (`:3005`, tabele `psa_*`).
> Pracujesz jako **senior developer aplikacji dla usług prawnych**.
>
> **Dokument wejściowy:** `wytyczne-rejestr-psa.md` (katalog główny repozytorium, stan na 1.11.2026). Oznaczenia
> „§ n” w tym pliku odnoszą się do sekcji wytycznych. Jeśli pliku nie ma — zatrzymaj się i poproś o niego.
>
> **Stan wejściowy jest nieznany.** Część wymagań mogła powstać w poprzednich sesjach (m.in. `SESJA-PSA-FRONTEND.md`).
> Dlatego najpierw inwentarz, potem wdrażasz wyłącznie braki.

---

## 0. Zasady

1. **Najpierw sprawdź, potem zmieniaj.** Przed zakończeniem Fazy 0 nie zmieniasz kodu. Element zgodny z wytycznymi
   zostawiasz — nie przepisujesz go.
2. **Jeden plik statusu: `WYTYCZNE-STATUS.md`.** Faza 0 go zakłada, każda faza aktualizuje, na końcu jest raportem
   końcowym. Innych raportów nie tworzysz.
3. **Wznowienie po `/clear`.** Po każdym STOP Łukasz może zacząć nową sesję. Wtedy czytasz tylko ten plik,
   `WYTYCZNE-STATUS.md` i sekcje wytycznych dla bieżącej fazy — inwentarza nie powtarzasz. Gdy kontekst się kończy:
   zapisz stan w `WYTYCZNE-STATUS.md` (co zrobione, następny krok), commit, STOP.
4. **Oszczędność tokenów.** Szukaj (`grep`, `glob`) zamiast czytać całe pliki; z `DECYZJE.md`, `ARCHITEKTURA-PSA.md`
   i `PRZEPISY-PSA.md` czytaj tylko potrzebne fragmenty. Nie wklejaj do rozmowy diffów ani całych plików. Bez
   subagentów. Zrzuty ekranu tylko zmienionych widoków, w skali 0,5. W trakcie pracy testy zmienianego obszaru, pełny
   zestaw na koniec fazy. Komunikat przy STOP: najwyżej 15 linii + odesłanie do `WYTYCZNE-STATUS.md`.
5. **Źródła prawa.** `PRZEPISY-PSA.md` pozostaje jedynym źródłem treści prawnych w kodzie (`przepisy.js`, UI, pisma).
   Przepisy z wytycznych, których tam brak, zbierasz w Fazie 0 jako propozycję uzupełnienia (z adnotacją, czy § 10
   wytycznych podaje je jako zweryfikowane); dopisujesz dopiero po akceptacji przy STOP. Pozycje „do sprawdzenia”
   z § 10 nie mogą być podstawą blokady w systemie.
6. **Obowiązujące decyzje** (`DECYZJE.md`), w szczególności: D-052 (checklisty zaznacza wyłącznie człowiek; system
   blokuje tylko pozycję na pewno niespełnioną — z przyczyną i odnośnikiem do miejsca naprawy), D-053 (portal nie zbiera
   liczby akcji ani serii), append-only i łańcuch skrótów, izolacja danych spółek, maskowanie na poziomie API, zakaz
   mieszania P.S.A. z S.A. D-054 zostaje częściowo zastąpiona (Faza 2 pkt 1).
7. **Elementy [2027]** wdrażasz za istniejącą bramką daty 18.02.2027 (🔵), bez drugiego mechanizmu. Bramka i wszystkie
   terminy korzystają z jednej funkcji czasu (warunek Fazy 1 pkt 4). Nie wyłączasz istniejących zabezpieczeń danych
   (np. maskowania) tylko dlatego, że wytyczne oznaczają je [2027] — jeśli działają już dziś, opisz to w inwentarzu.
8. **Zmiana schematu lub kontraktu API** = migracja + wpis `D-xxx` w `DECYZJE.md` (kolejny wolny numer). Nowe pisma
   o treści prawnej, której wytyczne nie podają dosłownie, oznaczasz „PROJEKT — do akceptacji Łukasza”.
9. **Terminy i stawki** jako parametry konfiguracji („Stawki i terminy”), nie w logice. Kwoty w groszach.
10. Gałąź robocza i PR do `main`; commit na koniec każdej fazy. Nowa zależność — tylko z uzasadnieniem przy STOP.

### 0.1 Pliki wejściowe

| Plik | Jak czytać |
|---|---|
| `wytyczne-rejestr-psa.md` | w całości raz; potem tylko sekcja bieżącej fazy |
| `DECYZJE.md` | lista nagłówków + D-052–D-054 + „Decyzje otwarte” |
| `ARCHITEKTURA-PSA.md` | mapa plików i przepływów |
| `PRZEPISY-PSA.md` | spis treści + wyszukiwanie artykułów |
| `WDROZENIE-PSA.md` | § 1 i § 4 (konta, aktywacja, status doręczenia) |
| `SESJA-PSA-FRONTEND.md`, `CLAUDE-PSA.md` | tylko w razie wątpliwości lub konfliktu |

---

## 1. Lista wymagań

Identyfikatory służą do statusu i raportu. Szczegóły — w podanej sekcji wytycznych.

**T — tryb testowy (wymaganie Łukasza spoza wytycznych)**
- **T1** Wysyłka poczty przez jeden punkt + skrzynka testowa
- **T2** Logowanie bez poczty
- **T3** Baza testowa z danymi fikcyjnymi + atrapa KRS
- **T4** Symulowana data
- **T5** Atrapy: walidator podpisu, ITN tpay
- **T6** Zabezpieczenia trybu testowego

**§ 2 Podpisy i dokumenty**
- **W2.1** Dopuszczalne formy podpisu per typ dokumentu (tabela § 2); skan odrzucany
- **W2.2** Zgoda na wpis tylko w formach z tabeli; skan i zwykły oryginał pocztą = brak zgody
- **W2.3** Brak ważnej zgody → powiadomienie przed wpisem (art. 300³⁴ § 3 zd. 1); wpis dopiero po nim
- **W2.4** Automatyczna walidacja po wgraniu: rozpoznanie QES / PZ / PO, odrzucenie podpisów zaawansowanych i zwykłych
- **W2.5** Umowa o prowadzenie rejestru: spółka podpisuje pierwsza, notariusz ostatni (QES); checklista: uchwała
  akcjonariuszy + reprezentacja wg KRS

**§ 3 Podpis przez mObywatel**
- **W3.1** PDF do podpisu < 5 MB, unikalne ID w stopce, SHA-256 zapisany przy generowaniu
- **W3.2** Ekran „Podpisz dokument” (Pobierz → Podpisz w mObywatelu → Wgraj podpisany plik) + instrukcja dla klienta
- **W3.3** Walidacja QES przez usługę DSS
- **W3.4** Pierwsza wersja podpisanego pliku = oryginał
- **W3.5** Podpisujący = oczekiwana osoba
- **W3.6** Wynik pozytywny → „Do zrobienia”; checklistę zaznacza człowiek
- **W3.7** Kilku podpisujących na jednym pliku; zgoda na wpis = osobny dokument jednej osoby
- **W3.8** Ścieżki alternatywne (PZ, oryginał pocztą); podpowiedź dla zarządu (własny QES albo oryginał)

**§ 4 Zgody i powiadomienia**
- **W4.1** Dwa odrębne oświadczenia składane osobiście: zgoda na komunikację e-mail (do rejestru) i żądanie
  automatycznych powiadomień
- **W4.2** Cofnięcie obu oświadczeń
- **W4.3** Bez zgody → list na adres z rejestru: kolejka wysyłki + potwierdzenie nadania
- **W4.4** Powiadomienie zbywcy wyłącznie na adres z rejestru
- **W4.5** Powiadomienie o wpisie / odmowie z przyczynami — do żądającego i spółki, bezpłatne

**§ 5 Dostęp i informacje**
- **W5.1** Bez logowania tylko dane spółki; stan akcjonariatu wyłącznie w płatnej informacji
- **W5.2** Informację w portalu pobiera tylko spółka i akcjonariusz
- **W5.3** Organy — poza portalem; informację wydaje kancelaria na żądanie
- **W5.4** [2027] Wersja dla akcjonariusza bez PESEL, daty urodzenia i adresu zamieszkania innych akcjonariuszy;
  spółka — wersja pełna
- **W5.5** Na każdej informacji wynagrodzenie i VAT z podstawą prawną
- **W5.6** Dziennik wydanych informacji (numer, data, odbiorca, opłata)
- **W5.7** Stawki § 15b + gwarancja ceny 3 lata od podpisania umowy

**§ 6 Pozostałe**
- **W6.1** [2027] Wymóg PESEL albo daty urodzenia w nowych wpisach — tylko dla zdarzeń po 18.02.2027
- **W6.2** [2027] Zawiadomienie sądu rejestrowego o rozwiązaniu / wygaśnięciu umowy w 7 dni
- **W6.3** Eksport całego rejestru z dokumentami w czytelnym formacie
- **W6.4** Brak automatycznego usuwania dokumentów
- **W6.5** [2027] Przypomnienie spółkom z rejestrem istniejącym 18.02.2027 o zgłoszeniu do KRS w 3 miesiące (§ 7.1)

**§ 7 Przeniesienie rejestru od innego podmiotu**
- **W7.1** Etap 1 — wejście „Przenoszę rejestr od innego podmiotu”
- **W7.2** Etap 2 — dokumenty startowe, wzór uchwały
- **W7.3** Etap 3 — checklista weryfikacji
- **W7.4** Etap 4 — umowa pod warunkiem zawieszającym (§ 7.4) + pakiet dokumentów dla spółki
- **W7.5** Etap 5 — okres przejściowy, przypomnienia
- **W7.6** Etap 6 — odbiór i uzgodnienie
- **W7.7** Etap 7 — otwarcie rejestru („PRZEJĘCIE”)
- **W7.8** Etap 8 — powiadomienia po otwarciu
- **W7.9** Etap 9 — rozliczenie
- **W7.10** Statusy (§ 7.3)

**Poza wdrożeniem:** § 1 (kontekst), § 8 (ryzyka — tylko obserwacje w raporcie, jeśli kod ich dotyczy), § 9 (decyzje
Łukasza — wyłącznie punkty rozszerzenia, bez rozstrzygnięć), bezpieczeństwo serwera, strona publiczna.

---

## FAZA 0 — Inwentarz (bez zmian w kodzie)

1. Dla każdej pozycji z sekcji 1 ustal stan i zapisz w `WYTYCZNE-STATUS.md`:

   | ID | Wymóg | Stan przed | Dowód (plik:linia, test) | Brakuje | Zakres S/M/L |
   |---|---|---|---|---|---|

   Stany: **JEST** (zgodne z wytycznymi, potwierdzone istniejącym testem albo krótkim uruchomieniem) · **CZĘŚCIOWO** ·
   **BRAK** · **SPRZECZNE** (kod działa inaczej niż wytyczne, np. przyjmuje skan jako zgodę) · **ZA BRAMKĄ** (gotowe,
   aktywne od 18.02.2027). Bez dowodu w kodzie stan nie może być JEST.
   Przykładowe frazy wyszukiwania: `skan`, `podpis`, `zgod`, `zawiadom`, `powiadom`, `informacj`, `dziennik`, `masku`,
   `2027`, `eksport`, `usun`, `stan otwarcia`, `mail`, `smtp`, `token`.
2. Ustal dodatkowo i opisz w `WYTYCZNE-STATUS.md`:
   - jak logują się pracownicy i klienci; które przepływy wysyłają e-mail (aktywacja, link logowania, reset hasła,
     zawiadomienia, powiadomienia); gdzie jest punkt wysyłki i co dzieje się dziś bez skonfigurowanej poczty;
   - czy istnieją: wspólna funkcja czasu i bramka 2027, mechanizm dokumentów do podpisu (D-054), kreator „stan
     otwarcia”, generator PDF i pism (`pdf.js`, `kontekst-pisma.js`), `krs.js`, atrapa ITN tpay, sekcja „Do zrobienia”;
   - **propozycję uzupełnienia `PRZEPISY-PSA.md`** (zasada 5);
   - **konflikty** wytycznych z `DECYZJE.md` lub kodem — do decyzji Łukasza. Sprawdź co najmniej:
     (a) D-054 a polityka podpisów; (b) zakładka „Rejestr” w portalu (jeśli pokazuje stan akcjonariatu) a W5.1
     i § 9 pkt 1 — sposób realizacji prawa dostępu z art. 300³⁵ § 2 nie jest jeszcze wybrany; (c) W5.1 („bez logowania
     widoczne dane spółki”) a zasada, że formularze publiczne nie zdradzają, czy spółka jest klientem kancelarii;
   - plan Faz 2–4: pozycje do wdrożenia (JEST pomijasz); jeśli Faza 4 nie zmieści się w jednej sesji — zaproponuj podział.

Fazę 1 wykonujesz bezpośrednio po Fazie 0, bez czekania na akceptację — Łukasz będzie mógł testować aplikację,
oceniając inwentarz.

---

## FAZA 1 — Tryb testowy bez poczty (T1–T6)

Cel: Łukasz przechodzi każdy przepływ kancelarii i portalu bez skonfigurowanej poczty. Poczta docelowo przez
Microsoft 365 (`biuro@notariusz.gdansk.pl`) — produkcyjnego transportu w tej sesji nie konfigurujesz, zostawiasz
interfejs, do którego się go podepnie.

0. Wpisz do `DECYZJE.md`: **D-xxx — tryb testowy** (zasady z pkt 6).
1. **T1 — poczta przez jeden punkt.** Każda wiadomość przechodzi przez jedną funkcję wysyłki z wymiennym transportem.
   Transport `skrzynka-testowa` zapisuje wiadomość jako plik `.eml` w `dane-testowe/skrzynka/` (poza katalogiem
   serwowanym, w `.gitignore`) — nic nie wychodzi z serwera; status doręczenia „testowa — niewysłana”. Strona
   **„Skrzynka testowa”** (dostępna bez logowania, wyłącznie w trybie testowym): lista (adresat, temat, czas), podgląd
   treści, klikalne linki. Bez trybu testowego i bez konfiguracji poczty wysyłka kończy się widocznym statusem błędu —
   nigdy cichym sukcesem.
2. **T2 — logowanie bez poczty.**
   - po „Wyślij link” ekran pokazuje dodatkowo przycisk „Zaloguj (tryb testowy)”;
   - na ekranach logowania kancelarii i portalu lista kont testowych — jedno kliknięcie = zalogowanie (notariusz,
     pracownik, zarząd spółki, akcjonariusz ze zgodą e-mail, akcjonariusz bez zgody);
   - `npm run test:link -- <e-mail>` drukuje link logowania dla istniejącego konta;
   - wszystkie trzy drogi używają **tego samego tokenu i endpointu** co normalny przepływ — pomijają wyłącznie
     doręczenie e-mailem; uprawnienia, izolacja spółek i wygasanie tokenu działają bez zmian; drugiego składnika (jeśli
     jest) nie wyłączasz — skrzynka testowa pokazuje bieżący kod konta testowego;
   - poza trybem testowym odpowiedź formularza bez zmian (nie zdradza, czy konto lub spółka istnieje).
3. **T3 — dane testowe.** `npm run test:seed` tworzy osobną bazę testową, oznaczoną w bazie jako testowa, z danymi
   fikcyjnymi (adresy `@example.com`, fikcyjne PESEL z poprawną sumą kontrolną). Scenariusze: spółka z aktywnym
   rejestrem; akcjonariusze ze zgodą e-mail i bez niej; żądanie wpisu bez zgody zbywcy; wydana informacja. W kolejnych
   fazach dopisujesz scenariusze nowych funkcji (w Fazie 4 — spółka w każdym statusie § 7.3). Atrapa KRS dla numerów
   z danych testowych; pozostałe numery — prawdziwe API.
4. **T4 — symulowana data** (pasek trybu testowego): przez jedną funkcję czasu działa na bramkę 2027, terminy (7 dni,
   14 dni, 12 miesięcy) i znaczniki nowych zdarzeń w bazie testowej. Ustawienie daty wcześniejszej niż ostatnie
   zdarzenie — zablokowane (porządek łańcucha).
5. **T5 — atrapy.** Walidator podpisu z wyborem wyniku: QES poprawny / PZ / PO / podpis zaawansowany / brak podpisu /
   plik zmieniony / inna osoba. Istniejąca atrapa ITN tpay — dostępna z paska trybu testowego.
6. **T6 — zabezpieczenia.**
   - włączenie wyłącznie zmienną w `.env` (np. `PSA_TRYB_TESTOWY=1`);
   - przy `NODE_ENV=production` albo na bazie nieoznaczonej jako testowa proces **odmawia startu** z czytelnym
     komunikatem; kopię bazy prototypu można oznaczyć jako testową osobnym poleceniem z potwierdzeniem;
   - poza trybem testowym trasy testowe nie są rejestrowane (404), atrapy niedostępne;
   - czerwony pasek „TRYB TESTOWY — e-maile nie są wysyłane” na każdym ekranie kancelarii i portalu;
   - każde logowanie testowe w dzienniku zdarzeń uwierzytelniania;
   - polecenia działają na Windows (konfiguracja w `.env`, nie składnia `VAR=1 polecenie`);
   - testy `node:test`: odmowa startu w produkcji i na bazie nietestowej, 404 poza trybem testowym, logowanie testowe
     używa tego samego tokenu co normalne.
7. Sekcja „Tryb testowy” w README: uruchomienie, konta, skrzynka, symulowana data, atrapy.

### ⛔ STOP — `WYTYCZNE-STATUS.md` (inwentarz, konflikty, propozycja uzupełnienia `PRZEPISY-PSA.md`, plan) + instrukcja w 3 krokach: jak uruchomić tryb testowy i się zalogować

---

## FAZA 2 — Podpisy i dokumenty (§ 2–3)

1. Na start wpisz do `DECYZJE.md`: **D-xxx — polityka podpisów (Łukasz, 31.10.2026)**, zastępuje D-054 w zakresie
   mechanizmu: skany odrzucane; formy według tabeli § 2; podpis online przez mObywatel (QES), PZ albo PO; oryginał
   pocztą (dla zgody na wpis — wyłącznie z podpisem notarialnie poświadczonym); podpis w kancelarii. Zasada „dokument po
   dokumencie” zostaje.
2. **W2.1–W2.2, W2.5:** reguły form podpisu per typ dokumentu w jednym miejscu (dosłownie wg tabeli § 2), nie
   w widokach. Oryginał papierowy: kancelaria zaznacza w checkliście otrzymanie i rodzaj podpisu (w tym „notarialnie
   poświadczony”). Umowa o prowadzenie rejestru: podpis notariusza dostępny dopiero po ważnym podpisie spółki.
3. **W2.3:** bez ważnej zgody „Dokonaj wpisu” zablokowane do wysłania powiadomienia — z przyczyną obok przycisku.
4. **Walidacja (W2.4, W3.3–W3.5).** Zasada: **blokujesz tylko to, co na pewno niespełnione; niepewne → „Do weryfikacji
   ręcznej”; nigdy automatycznej akceptacji bez udanej walidacji.**
   - adapter do usługi DSS (biblioteka Komisji Europejskiej) uruchomionej jako osobna usługa na serwerze, przez jej
     REST API (adres w konfiguracji, ścieżkę endpointu sprawdź w dokumentacji DSS); usługa niedostępna albo błąd →
     weryfikacja ręczna; instrukcja uruchomienia DSS w README (bez instalacji na produkcji). Typ podpisu i dane
     podpisującego bierzesz z raportu DSS — nie dodajesz do Node bibliotek kryptograficznych ani PDF;
   - plik bez podpisu elektronicznego (np. skan) → odrzucenie z komunikatem zrozumiałym dla laika;
   - PZ i PO DSS najpewniej zaklasyfikuje jako niekwalifikowane — **nie odrzucaj ich jako podpisów zaawansowanych**;
     sposób rozpoznania ustal na próbkach, do tego czasu PZ i PO → weryfikacja ręczna; podpis zaawansowany odrzucasz
     tylko wtedy, gdy na pewno nie jest PZ ani PO;
   - W3.4: przy generowaniu zapisz skrót i długość pliku; PAdES — skrót początkowych bajtów podpisanego pliku
     o długości oryginału = zapisany skrót (podpis przyrostowy); XAdES — skrót podpisanego dokumentu; niezgodność →
     odrzucenie z komunikatem, że plik zmieniono po pobraniu;
   - W3.5: imię i nazwisko z certyfikatu; PESEL z `serialNumber` „PNOPL-…”, jeśli jest; brak PESEL w certyfikacie albo
     w danych oczekiwanej osoby → weryfikacja ręczna, nie odrzucenie;
   - próbki: `test/fixtures/podpisy/` (Łukasz dostarczy: 4 dostawców mObywatela, PZ, PO). Test parametryzowany po
     plikach; pusty katalog = test pominięty z komunikatem. Na próbkach sprawdź też, czy każdy dostawca zachowuje
     oryginał jako pierwszą rewizję — jeśli któryś nie, opisz przy STOP i nie luzuj kontroli.
5. **W3.1–W3.2, W3.6–W3.8:** PDF przez istniejący generator, kontrola rozmiaru 5 MB, ID w stopce; adres
   podpis.mObywatel.gov.pl jako parametr konfiguracji (nowa karta); instrukcja dla klienta **dosłownie** z § 3; wynik
   walidacji trafia do „Do zrobienia” (jeśli tej sekcji nie ma — do kolejki spraw); checklista ręczna (D-052).
   Podpowiedź dla zarządu podpisującego za spółkę: własny QES albo oryginał pocztą — bez blokowania QES z mObywatela.

### ⛔ STOP — testy, zrzuty „Podpisz dokument” (portal 390 px, kancelaria), wynik na próbkach albo informacja o ich braku

---

## FAZA 3 — Zgody, powiadomienia, dostęp, informacje (§ 4–6)

1. **W4.1–W4.2:** oświadczenia składa sam akcjonariusz albo nabywca (ze swojego konta albo przez link z zaproszenia) —
   nie zarząd w jego imieniu; każde z datą i odwołalne. Zgoda na komunikację e-mail jest daną rejestru (art. 300³³ § 1
   pkt 5) — jej zmiana i cofnięcie idą przez żądanie wpisu, nie przez ustawienia konta. Żądanie automatycznych
   powiadomień — oświadczenie w portalu.
2. **W4.3:** kolejka listów w aplikacji kancelarii — pismo do druku z adresem z rejestru, data i numer nadania, skan
   potwierdzenia nadania; status doręczenia zawiadomienia.
3. **W4.4:** adres zbywcy pobierany wyłącznie z rejestru — pole tylko do odczytu + test.
4. **W4.5, W5.1–W5.7, W6.1–W6.5** według wytycznych, a ponadto:
   - W5.1 — po rozstrzygnięciu konfliktów (b) i (c) z Fazy 0;
   - W5.3: w aplikacji kancelarii „Wydaj informację organowi” (odbiorca, sygnatura sprawy, wpis do dziennika W5.6);
   - W5.4: maskowanie sprawdzasz testem API, nie tylko interfejsu;
   - W5.5: podstawa prawna z `PRZEPISY-PSA.md`;
   - W5.7: stawki wersjonowane z datą; spółka w okresie gwarancji rozliczana według wersji z dnia podpisania umowy;
   - W6.2, W6.5: zadanie z terminem w „Do zrobienia” i projekt treści; zgłoszenie składa się przez Portal Rejestrów
     Sądowych — nie automatyzuj.

### ⛔ STOP — testy, zrzuty zmienionych widoków, pytania QW1–QW3

---

## FAZA 4 — Przeniesienie rejestru (§ 7)

1. **W7.1–W7.2:** wariant istniejącego przepływu zgłoszenie → wniosek, nie osobna aplikacja. KRS → dane z `krs.js`.
   Portal nie zbiera liczby akcji (D-053) — akcjonariat pochodzi z danych poprzednika. Formularz nie zdradza, czy
   spółka ma już u nas rejestr. Opis opcji neutralny, bez porównań z innymi podmiotami.
2. **W7.3:** checklista Etapu 3 — ręczna (D-052); blokada tylko pozycji na pewno niespełnionych (np. brak uchwały);
   AML przez istniejący mechanizm.
3. **W7.4:** klauzula § 7.4 — dosłownie; uchwała — z brzmieniem wyboru podanym pod klauzulą, reszta jako PROJEKT.
   Pozostałe pisma pakietu (wypowiedzenie, potwierdzenie zawarcia, wezwanie do przekazania w trzech wariantach
   poprzednika, [2027] zgłoszenie do KRS i wniosek o wpis danych, informacja z art. 14 RODO, potwierdzenie odbioru dla
   poprzednika) — przez istniejący mechanizm szablonów, jako „PROJEKT — do akceptacji Łukasza”.
4. **W7.10:** statusy § 7.3 jako jawna maszyna stanów z dozwolonymi przejściami; test każdego przejścia, w tym
   „Wygasła” po 12 miesiącach bez ziszczenia warunku.
5. **W7.5:** datę rozwiązania wpisuje kancelaria po weryfikacji; przypomnienia (14 dni bez zawiadomienia, zbliżający się
   termin 12 miesięcy) w „Do zrobienia” i w portalu spółki; żądania od chwili skuteczności umowy przyjmowane, brak
   danych = przeszkoda (istniejący mechanizm zamrożenia terminu).
6. **W7.6:** checklista Etapu 6; rozbieżność → „Wstrzymane — rozbieżności”; system niczego nie poprawia sam — korekty
   tylko w trybie żądania wpisu.
7. **W7.7:** rozbudowa istniejącego kreatora „stan otwarcia”: zdarzenie otwierające „PRZEJĘCIE” na początku łańcucha
   SHA-256, skróty dokumentów źródłowych, historia poprzednika jako archiwum tylko do odczytu (poza łańcuchem),
   zatwierdzenie przez notariusza podpisem kwalifikowanym (ścieżka z Fazy 2).
8. **W7.8:** powiadomienia według Etapu 8; zawiadomienie organów egzekucyjnych — zadanie ręczne w „Do zrobienia”.
9. **W7.9:** zapisuj datę zawarcia i datę skuteczności umowy; opłata roczna od dnia skuteczności, wcześniej brak
   wynagrodzenia. Opłata za przejęcie i początek gwarancji ceny przy umowie warunkowej — punkty rozszerzenia bez
   wartości domyślnej (§ 9), w interfejsie „do ustalenia”.

### ⛔ STOP — scenariusz przeniesienia przejście w trybie testowym od zgłoszenia do „Aktywny” (zrzuty kluczowych ekranów)

---

## FAZA 5 — Weryfikacja końcowa i raport

1. `scenariusz-e2e.js` uruchamiany w trybie testowym (seed, logowanie testowe, skrzynka testowa) obejmuje: podpis
   z każdym wynikiem atrapy walidatora; wpis zbycia bez zgody → list; zgody akcjonariusza; informację w wersji spółki
   i akcjonariusza (maskowanie przy symulowanej dacie po 18.02.2027); przeniesienie rejestru.
2. Pełny zestaw testów zielony.
3. `WYTYCZNE-STATUS.md` jako raport końcowy — dla każdej pozycji z sekcji 1 kolumny **Wynik** i **Jak**:

   | Wynik | Znaczenie | „Jak” zawiera |
   |---|---|---|
   | **BYŁO** | rozwiązane przed sesją | plik:linia, test |
   | **POPRAWIONE** | było, wymagało zmiany | co zmieniono, commit |
   | **WDROŻONE** | zrobione w tej sesji | jedno zdanie, pliki, commit, test |
   | **CZĘŚCIOWO** | niedokończone | co zostało i dlaczego |
   | **DO DECYZJI** | czeka na Łukasza | pytanie |
   | **POMINIĘTE** | poza zakresem albo blokada | powód |

   Na górze podsumowanie liczbowe. Pod tabelą: pytania otwarte, lista pism „PROJEKT — do akceptacji”, **lista testów
   ręcznych dla Łukasza w trybie testowym** (konto → kroki → oczekiwany wynik), lista próbek podpisów do dostarczenia.
4. Aktualizacja `ARCHITEKTURA-PSA.md`, `DECYZJE.md`, README.
5. Na koniec w rozmowie: podsumowanie liczbowe + najważniejsze pytania (najwyżej 10 linii).

### ⛔ STOP — raport końcowy

---

## Pytania otwarte — nie zgaduj, przedstaw przy STOP Fazy 3

- **QW1** Czy zmiana albo cofnięcie zgody na komunikację e-mail (dana rejestru) podlega opłacie za wpis? Do odpowiedzi
  nie zmieniasz logiki opłat — opisz, jak kod traktuje to dziś.
- **QW2** Kanał powiadomień przed 18.02.2027 dla akcjonariusza z żądaniem automatycznych powiadomień. Domyślnie:
  powiadomienie w portalu jest dodatkiem do e-maila (przy zgodzie) albo listu, nie zastępuje ich.
- **QW3** Jak zaprosić do portalu akcjonariusza bez zgody na komunikację e-mail (np. list z kodem)? Opisz istniejący
  mechanizm i propozycję.
- Punkty § 9 wytycznych — bez rozstrzygnięć.

## Czego NIE robić

- Nie przepisywać elementów ze stanem JEST.
- Nie zaznaczać automatycznie checklist; nie akceptować podpisu bez udanej walidacji.
- Nie przyjmować skanu jako podpisanego dokumentu ani zgody; nie odrzucać PZ i PO jako podpisów zaawansowanych.
- Nie wysyłać powiadomienia zbywcy na adres podany przez żądającego; nie uzależniać powiadomień z art. 300³⁴ § 7
  od płatności.
- Nie usuwać istniejącego dostępu akcjonariuszy do rejestru przed rozstrzygnięciem konfliktu (b); nie dawać organom
  dostępu do portalu.
- Nie usuwać automatycznie dokumentów; nie naruszać append-only.
- Nie poprawiać samodzielnie rozbieżności w przejmowanym rejestrze.
- Nie rozstrzygać punktów § 9; nie wdrażać § 8, zabezpieczeń serwera ani zmian strony publicznej.
- Nie dopisywać przepisów do `przepisy.js` przed akceptacją uzupełnienia `PRZEPISY-PSA.md`.
- Nie automatyzować składania pism do KRS.
- Nie wysyłać prawdziwych e-maili w trybie testowym; nie dopuścić trybu testowego w produkcji ani na bazie nietestowej.
