# SESJA-PSA-FRONTEND — dopracowanie interfejsu, portal klienta, strona publiczna

> **Wersja 2 — 25.09.2026.** Zmiany względem wersji 1: Faza 0 zakończona (`FRONTEND-INWENTARZ.md`),
> odpowiedzi na Q1 i Q3–Q5 (D-045–D-048), pięć nowych decyzji Łukasza (sekcja 0.5), zasady prostoty
> przepływu (sekcja 0.4), konkretne zadania z inwentarza (K1–K8, P1–P7), nazwy komponentów dopasowane
> do istniejącego kodu, nowe pytanie Q6.
>
> Sesja Claude Code dla modułu **Rejestr akcjonariuszy P.S.A.** (`:3005`, tabele `psa_*`).
> Pracujesz jako **senior frontend developer aplikacji webowych dla usług prawnych**. Celem jest
> aplikacja **wydajna, prosta, minimalistyczna i odporna na pomyłki użytkownika — także laika**,
> która zachowuje **wszystkie funkcje wymagane przepisami**.
>
> **Stan wejściowy:** Faza 0 wykonana 20.09.2026, trzy pozycje KRYTYCZNE naprawione (`1a41d6a`,
> `e7b996c`). Zaczynasz od Fazy 1. Nie powtarzaj inwentaryzacji — `FRONTEND-INWENTARZ.md` jest
> punktem odniesienia „przed” dla wszystkich pomiarów „po”. Jeśli gałąź nie zawiera tych dwóch
> commitów albo w `DECYZJE.md` brakuje D-045–D-049 — zatrzymaj się i zapytaj.

---

## 0. Zasady nadrzędne

1. **Żadne pole, układ ani widok nie jest święty.** Możesz przebudować każdy ekran, zmienić kolejność
   kroków, scalić lub rozdzielić widoki. Ta swoboda nie obejmuje **funkcji wymaganych przepisami**
   (sekcja 0.2) ani **decyzji Łukasza** (sekcja 0.5).
2. **Tożsamość wizualna z sesji 6 (`publiczne/style/rejestr.css`) jest punktem wyjścia, nie
   ograniczeniem.** Tokeny (`--atrament`, `--papier`, `--rejestr`, `--mosiadz`, `--sygnal`) i trzy kroje
   pisma zostają, chyba że znajdziesz konkretny powód zmiany — wtedy go opisz przy STOP. Wyjątek już
   ustalony: dwie pary tokenów nie spełniają kontrastu (Faza 1 pkt 10).
3. **Jeden komponent = jedno zachowanie w całej aplikacji.** Adres, tożsamość osoby, PESEL, kwota i data
   wyglądają i działają tak samo w kancelarii, w portalu i w kreatorze wniosku. Dziś tak nie jest:
   adres reprezentanta to jedno pole tekstowe, a wniosek w portalu ma własny, zduplikowany formularz
   akcjonariusza (`wniosek.js`) — stąd luka `kraj` z B11.
4. **Odporność na pomyłki zapewnia konstrukcja, nie komunikat.** Lepsze jest pole, w które nie da się
   wpisać błędnej wartości, niż ostrzeżenie po fakcie. Jeśli błąd jest możliwy, komunikat pojawia się
   **przy polu, którego dotyczy**.
5. **Backend zmieniasz tylko tam, gdzie wymaga tego konkretny punkt tego dokumentu.** Każda zmiana
   kontraktu API lub schematu = migracja + wpis w `DECYZJE.md` (format D-xxx, kolejny wolny numer).
   Logiki domenowej (`server/logika/*`) nie ruszasz poza wskazanymi punktami.
6. **Oszczędność tokenów.** Zrzuty ekranu tylko dla zmienianych widoków, w skali 0,5, chyba że
   szczegół wymaga pełnej rozdzielczości. Zamiast czytać całe pliki, szukaj (`grep`); z raportów
   `frontend-audyt/raporty/*.md` czytaj tylko potrzebną sekcję. Subagentów używaj wyłącznie do
   równoległych pomiarów przed/po.
7. **Skille.** Jeśli w sesji jest dostępny skill do projektowania frontendu (np. `frontend-design`),
   wczytaj go przed Fazą 1 i stosuj. Weryfikacja wizualna: Playwright (Chromium jest w środowisku).
8. **Rozbudowuj istniejące komponenty, nie twórz równoległych.** W `ui-rejestr.js` są już `PoleKwoty`,
   `PoleDaty`, `PoleLiczbowe`, `WyborZKartoteki`, `Pigulka` — nowe zachowania dodajesz do nich. Nowy
   komponent tylko tam, gdzie odpowiednika brak (`PoleAdres`, `PoleTozsamosc`, `PoleDowod`,
   `WyborTypuOsoby`, `Licznik`, wspólny `FormularzOsoby`).

### 0.1 Pliki wejściowe (przeczytaj przed Fazą 1)

| Plik | Po co |
|---|---|
| `FRONTEND-INWENTARZ.md` | wynik Fazy 0 — stan „przed”, lista problemów, środowisko pomiarowe (§10) |
| `frontend-audyt/raporty/*.md` | szczegóły z plik:linia — sięgaj po konkretną sekcję, nie czytaj w całości |
| `ARCHITEKTURA-PSA.md` | stan faktyczny kodu — mapa plików, podsystemy, przepływy |
| `DECYZJE.md` | szczególnie D-018, D-029–D-033, D-037–D-049 i „Decyzje otwarte” |
| `PRZEPISY-PSA.md` | **jedyne** źródło treści prawnych — także dla strony publicznej |
| `WYTYCZNE-MERYTORYCZNE-PSA.md` | praktyka stosowania przepisów |
| `SESJA-PSA-6-INTERFEJS.md` | kierunek wizualny (tokeny, typografia, oś akcji, suwak) |
| `CLAUDE-PSA.md` §4 | reguły domenowe (numeracja używana w komentarzach kodu) |
| `TPAY-INTEGRACJA.md` | Faza 4 pkt 5 i P5 |

### 0.2 Funkcje wymagane przepisami — nie wolno ich usunąć ani ukryć

- termin wpisu 7 dni z zamrożeniem na czas przeszkody (art. 300³⁴ § 1 KSH);
- powiadomienie o treści zamierzonego wpisu przed wpisem, chyba że jest zgoda (art. 300³⁴ § 3);
- powiadomienie o dokonanym wpisie i o odmowie wpisu z podaniem przyczyn (art. 300³⁴ § 7);
- uwzględnianie ograniczeń co do rozporządzania akcją (art. 300³⁴ § 6);
- informacja z rejestru (art. 300³⁵);
- pełny katalog danych rejestru (art. 300³³ § 1 pkt 1–11);
- rozróżnienie wpisu konstytutywnego i deklaratoryjnego (art. 300³⁷ § 1–2);
- append-only i łańcuch skrótów (art. 300³¹ § 4) — interfejs nigdy nie sugeruje „edycji” wpisu,
  tylko **sprostowanie**;
- maskowanie danych wrażliwych zależnie od roli;
- zegary z nowelizacji 🔵 (od 18.02.2027) — widoczne jako nieaktywne z datą wejścia w życie.

### 0.3 Zakaz mieszania P.S.A. z S.A.

Obowiązuje `PRZEPISY-PSA.md` § 12. W interfejsie i w treściach **nie pojawiają się**: akcje imienne /
na okaziciela, wartość nominalna, dokument akcji, dematerializacja, rozszerzony katalog danych z art.
328³ (PESEL, numer KRS akcjonariusza jako dane obowiązkowe), pośrednictwo w wypłatach dywidendy.
**Uwaga przy szukaniu inspiracji:** strony domów maklerskich (np. DM Navigator) opisują rejestr łącznie
dla S.A. i P.S.A. — ich treści są pod tym względem skażone. Wolno podpatrywać układ, nie treść.

### 0.4 Prostota przepływu — zasady dla każdego ekranu

Kryterium oceny każdego widoku: czy laik przejdzie go bez instrukcji, bez wpisywania czegoś, co
system już wie, i bez możliwości utknięcia.

1. **Raz wpisane — nigdy więcej.** Dana wpisana raz (przez klienta, pracownika albo pobrana z KRS)
   przechodzi dalej sama: zgłoszenie → wniosek → kartoteka → kreator otwarcia rejestru → pisma. Ta
   sama osoba lub wartość wybierana drugi raz w jednym przepływie to błąd do naprawy.
2. **Pobieraj, zamiast pytać.** Numer KRS → dane spółki bez osobnego przycisku (po wpisaniu 10 cyfr,
   z potwierdzeniem „Czy to Twoja spółka?”); PESEL → data urodzenia i płeć (`pesel.js`); gmina
   siedziby → propozycja sądu rejestrowego (`krs.js`); skład organu z KRS → wybór reprezentanta z
   listy. Dane pobrane pokazuj jako podsumowanie tylko do odczytu z odnośnikiem „Popraw”, nie jako
   formularz do przepisania. Awaria API KRS → formularz ręczny, bez blokady (zasada z `krs.js`).
3. **Wartości domyślne zamiast pustych pól** tam, gdzie domyślna jest prawie zawsze trafna: kraj
   „Polska”, kolejna wolna seria i numer pierwszej akcji w emisji. Pole „Forma prawna” znika —
   rejestr prowadzimy wyłącznie dla P.S.A.; inna forma w odpisie KRS = komunikat i stop.
   **Nie ustawiaj domyślnie dat o znaczeniu prawnym** (data zdarzenia, uchwały, umowy) — puste pole
   jest bezpieczniejsze niż błędna wartość domyślna.
4. **Zapis automatyczny.** Kreatory zapisują się same po opuszczeniu pola, z dyskretnym „Zapisano”;
   w krokach kreatora nie ma przycisków „Zapisz”. Czynność ze skutkiem prawnym lub wysyłką (złożenie
   wniosku, dokonanie wpisu, wysłanie zawiadomień, płatność) zawsze wymaga świadomego kliknięcia.
   Szkice z danymi osobowymi — tylko na serwerze albo w `sessionStorage` czyszczonym przy
   wylogowaniu, **nigdy w `localStorage`**.
5. **Jeden przycisk = jedna czynność do końca.** Gdy następny krok jest jednoznaczny, jedno kliknięcie
   go wykonuje: kafelek typu zdarzenia przechodzi dalej, „Zapłać 61,50 zł” prowadzi do pobrania
   dokumentu po potwierdzeniu płatności, bez szukania go w innym miejscu.
6. **Automatyzujemy wpisywanie danych, nie ocenę prawną.** Potwierdzenia weryfikacyjne (checklisty,
   podpisy, zgoda na wpis) zawsze zaznacza człowiek (D-052). System może jedynie zablokować
   zaznaczenie pozycji, która na pewno nie jest spełniona — z przyczyną i odnośnikiem do pola, które
   to naprawia.
7. **Pokazuj tylko to, co potrzebne teraz.** Pola rzadkie i opcjonalne pod „Więcej danych
   (opcjonalnie)”; pola zależne dopiero po wyborze (dane osoby prawnej po wyborze typu). Ta sama
   informacja nie występuje na ekranie dwa razy (np. data w polu i ta sama data słownie pod nim).
8. **Nie da się utknąć.** Kroki kreatora są klikalne wstecz, a do przodu — do kroków już
   ukończonych. Przycisk „Dalej” nie jest wyłączany z powodu braków w formularzu: kliknięcie pokazuje
   podsumowanie błędów (Faza 1 pkt 3). Wyłączony przycisk zostaje tylko przy blokadzie prawnej,
   zawsze z uzasadnieniem obok i odnośnikiem do miejsca naprawy.
9. **Język laika w portalu.** Etykieta mówi zwykłym językiem, co się stanie; termin prawny i przepis —
   w podpowiedzi pod polem. W aplikacji kancelarii terminologia prawnicza bez zmian.
10. **Telefon to pełnoprawne urządzenie.** Żadna dana nie może być niedostępna na ekranie 390 px (dziś
    tabele portalu są ucięte — Faza 1 pkt 11).

### 0.5 Decyzje podjęte przed sesją

| Temat | Decyzja | Wpis |
|---|---|---|
| Q1 Cena emisyjna | cena za jedną akcję, koniec cichego zaokrąglania (patrz Q6) | D-045 |
| Q2 Domena strony publicznej | **otwarte** — domena jako parametr `BASE_URL` | D-049 |
| Q3 Spółka w organizacji | numer KRS w formularzu publicznym zostaje wymagany | D-047 |
| Q4 Prekompilacja JSX | zgoda na `esbuild` (dev) | D-046 |
| Q5 Wzory do pobrania | bez podstrony `/wzory` | D-048 |

Nowe decyzje z 25.09.2026 — na początku Fazy 1 wpisz je do `DECYZJE.md` (kolejne wolne numery, dziś
D-050–D-054; źródło: „Łukasz, przed sesją frontendową v2”):

- **D-050 — „Stan na” w UI tylko dzień.** Zastępuje D-043 w warstwie interfejsu; mechanizm API z D-032
  zostaje. Zamyka P-011 w części UI (B12).
- **D-051 — Menu kancelarii bez scalania.** Kolejka spraw, Zgłoszenia, Wnioski i Zawiadomienia
  zostają osobnymi pozycjami. Pulpit: sekcja „Do zrobienia” zamiast kafli statystyk (K1).
- **D-052 — Checklisty zaznacza wyłącznie człowiek.** System nie zaznacza pozycji sam; blokuje jedynie
  zaznaczenie pozycji na pewno niespełnionej, z przyczyną i odnośnikiem „Uzupełnij” (K2, K3).
- **D-053 — Wniosek bez liczby akcji.** Portal nie zbiera liczby akcji ani serii. Kreator otwarcia
  rejestru podstawia z wniosku osoby; akcjonariat założycielski wpisuje kancelaria z umowy spółki.
- **D-054 — Dokumenty do podpisu bez zmian w mechanizmie.** Pobranie, wgranie skanu i potwierdzenie
  podpisu zostają dokument po dokumencie — w portalu i w kancelarii. Dozwolone wyłącznie zmiany
  wizualne (P4).

### 0.6 Pytania otwarte — nie zgaduj

- **Q6 — Cena emisyjna poniżej 1 grosza** (wynika z D-045). D-045 każe odrzucać więcej niż 2 miejsca po
  przecinku, a jednocześnie stwierdza, że cena poniżej 1 grosza za akcję jest dopuszczalna i realna.
  Przy 2 miejscach nie da się jej zapisać (10 000 akcji za 1 zł = 0,0001 zł za akcję). Warianty do
  przedstawienia przy STOP Fazy 1:
  **A** — cena za akcję z większą precyzją (np. do 4 miejsc), przechowywana jako ułamek
  licznik/mianownik w groszach, jak ułamkowe części akcji — zmiana schematu;
  **B** — cena za akcję do 2 miejsc, a przy cenie poniżej 0,01 zł formularz prosi o łączną cenę emisji
  i ją przechowuje (cena za akcję tylko wyświetlana) — zmiana schematu;
  **C** — zostają 2 miejsca, cena poniżej grosza świadomie niemożliwa do zapisania (wpis w
  `DECYZJE.md`).
  **Do czasu odpowiedzi:** B7 wdrażasz tylko w części „bez cichego zaokrąglania” — wartość z więcej
  niż 2 miejscami jest odrzucana komunikatem przy polu; schematu nie zmieniasz.
- **Q2 — domena strony publicznej** (D-049) — nadal otwarte.

---

## FAZA 0 — zakończona 20.09.2026 (nie powtarzać)

Wynik: `FRONTEND-INWENTARZ.md`, zrzuty `frontend-audyt/zrzuty/` (21 kancelaria, 42 portal), raporty
`frontend-audyt/raporty/`. Stan „przed”, do którego odnosisz pomiary:

| Miara | Stan przed |
|---|---|
| (a) przyjęcie wniosku + otwarcie rejestru | 29 kliknięć (21 bez ślepego zaułka; 16 to potwierdzanie 9 podpisów) |
| (b) wpis zbycia akcji | 16 kliknięć; zbywca wybierany dwa razy |
| (c) informacja z rejestru | 4 kliknięcia; brak „Pobierz PDF” |
| (d) akcjonariusz i jego spółki | nazw spółek nie da się zobaczyć |
| (e) zawiadomienia | 2 kliknięcia |
| (f) portal: logowanie → złożony wniosek | 12 kliknięć |
| (g) portal: zgłoszenie zmiany | 3 kliknięcia |
| (h) portal: płatność → pobranie | niezmierzone (brak konfiguracji tpay) |
| Czas do gotowości, 4G | kancelaria 19,3 s, portal 17,8 s (`babel.min.js` = 62–66% transferu) |
| axe-core (5 ekranów) | 1 critical, 10 serious; brak `<main>` i `h1` na każdym ekranie |

Środowisko pomiarowe do powtórzenia: `FRONTEND-INWENTARZ.md` §10 (uwaga o zabijaniu procesu przez
`/proc/*/environ`).

---

## FAZA 1 — Fundament: komponenty, formularze, ruch, wydajność

*(zakończona — patrz `frontend-audyt/raporty/faza1-raport.md`)*

---

## FAZA 2 — Poprawki zgłoszone przez Łukasza (B1–B12)

*(zakończona — patrz `frontend-audyt/raporty/faza2-raport.md`)*

---

## FAZA 3 — Aplikacja kancelarii: przegląd ekran po ekranie

*(zakończona — patrz `frontend-audyt/raporty/faza3-raport.md`)*

---

## FAZA 4 — Portal klienta

Portal ma być **zachęcający i oczywisty w obsłudze**, także na telefonie (projektuj od 390 px w górę).

1. **Architektura informacji — minimum.** Uwaga z inwentarza: ekranów „Konto” i „Dokumenty” dziś
   **nie ma** — trzeba je zbudować, nie tylko dopracować.
   - **Start** — karta „Co dalej” z działaniami wymagającymi uwagi (podpis, opłata, uzupełnienie,
     nowy dokument); pusta = „Wszystko załatwione”.
   - **Moje spółki** — lista + „Dodaj spółkę” (B8). Klient z jedną spółką trafia od razu do niej.
     Widok spółki ma zakładki: **Rejestr** (z maskowaniem wg roli, z B9 i B12) · **Zgłoszenia**
     (żądania wpisu i zgłoszenia nieprawidłowości, ze statusem i terminem) · **Dokumenty**
     (zawiadomienia, informacje z rejestru, umowa) · **Opłaty** (brutto, „Zapłać”).
   - **Wnioski** — widoczne, gdy jest wniosek w toku; oś statusu: złożony → weryfikacja → dokumenty
     do podpisu → podpisane → rejestr otwarty.
   - **Konto** — dane logowania (e-mail tylko do odczytu, zmiana przez kancelarię; zmiana hasła),
     powiadomienia portalu (ustawienia konta, **nie** dane rejestru), dokumenty prawne (regulamin,
     polityka prywatności, klauzula informacyjna z datą akceptacji), wylogowanie. Duży przycisk
     „Wyloguj się” u góry każdego widoku na telefonie przenieś tutaj (albo do menu konta).
   - **Pomoc** — krótka instrukcja + dane kontaktowe kancelarii (`/api/wspolne/kancelaria`) +
     odnośnik do strony publicznej.
   - **Zasada:** dane w rejestrze (adres, e-mail akcjonariusza, zgoda na komunikację e-mail z art.
     300³³ § 1 pkt 5) zmienia się wyłącznie przez żądanie wpisu, nigdy przez ustawienia konta.
2. **Ekran przed zalogowaniem (wejście z publicznej strony):** logowanie + „Nie masz konta? Złóż
   wniosek” + trzy fakty oparte na przepisach (ton według sekcji 5.1), np. termin wpisu (art. 300³⁴
   § 1), elektroniczna postać rejestru z zapewnieniem integralności (art. 300³¹ § 3–4). Przed startem
   wniosku lista „Co przygotować” (umowa spółki, uchwała o wyborze, dane akcjonariuszy) i szacowany
   czas wypełnienia.
3. **Publiczny formularz zgłoszenia** (KRS wymagany — D-047):
   - po wpisaniu numeru KRS nazwa spółki pobierana z KRS („Czy to Twoja spółka?”) zamiast
     ręcznego pola „Nazwa spółki”;
   - **formularz nie może zdradzić, czy spółka już ma u nas rejestr** (tajemnica zawodowa) —
     identyczna odpowiedź w każdym przypadku;
   - ekran „Sprawdź skrzynkę” z zamaskowanym adresem i przyciskiem „Wyślij ponownie” (blokada
     60 s; endpoint z limiterem, jeśli go nie ma).
4. **Kreator wniosku:** zapisywanie automatyczne (0.4 pkt 4); pasek postępu z nazwami kroków,
   klikalny; na ostatnim kroku podsumowanie z odnośnikami „Zmień” przy każdej sekcji; komponenty z
   Fazy 1; błędy przy polu (B4).
5. **Płatność tpay:** strona powrotu **nie pokazuje „Opłacone” na podstawie samego powrotu** —
   źródłem prawdy jest powiadomienie ITN. Pokazuje „Czekamy na potwierdzenie od operatora płatności”
   i odpytuje status; po potwierdzeniu — dalsza akcja (np. pobranie informacji z rejestru).
   Bez konfiguracji tpay zostaje dzisiejszy wariant „kancelaria rozliczy fakturą”.
6. **Wygaśnięcie sesji (8 h):** ostrzeżenie 5 minut wcześniej; szkic formularza nie ginie.

**Zadania z inwentarza:**

- **P1 — Tabele 390 px** — sprawdź po Fazie 1 pkt 11 każdy ekran portalu (rejestr, zgłoszenia,
  płatności, emisje).
- **P2 — Zgłoszenie → wniosek bez przepisywania.** Dziś wniosek zakłada się pusty
  (`wczytajLubZalozWniosek`) i klient ponownie wpisuje KRS. Wniosek startuje z KRS ze zgłoszenia i
  od razu pobranymi danymi; klient widzi podsumowanie z KRS i uzupełnia tylko to, czego KRS nie ma.
  Dziś krok „Spółka” prosi laika o NIP, REGON, sąd, wydział, organ, datę rejestracji i kapitał —
  wszystko to jest w odpisie albo z niego wynika (sąd — propozycja z gminy siedziby, `krs.js`).
  Reprezentant: wybór z listy członków organu z KRS (`krs.js` już czyta skład organu; imię,
  nazwisko, funkcja i sposób reprezentacji podstawione), ręcznie tylko PESEL, dowód, adres. Jeśli brak
  powiązania zgłoszenie → konto → wniosek — dodaj je (migracja + D-xxx).
- **P3 — Kreator wniosku** — według pkt 4.
- **P4 — Dokumenty do podpisu (D-054).** Mechanizm bez zmian. Wyłącznie wizualnie: zwarta lista na
  telefonie (dziś ~20 ekranów przewijania), stan każdego dokumentu w jego wierszu, instrukcja „Jak
  podpisać dokumenty” zwinięta i rozwijana.
- **P5 — Informacja z rejestru (zadanie h).** Jeden przycisk z kwotą brutto w etykiecie („Zapłać
  61,50 zł”); po potwierdzeniu ITN od razu „Pobierz”. Pomiar (h) w piaskownicy tpay, jeśli `.env` ma
  jej dane; jeśli nie — test z atrapą ITN i opis przy STOP.
- **P6 — Link aktywacyjny** zawiera dziś domyślny `http://localhost:3005` niezależnie od faktycznego
  adresu (raport portalu §1). Link budowany z konfiguracji adresu publicznego (spójnie z `BASE_URL`),
  test.
- **P7 — Etykiety** według 0.4 pkt 9 — przegląd wszystkich tekstów portalu pod kątem laika.

Cel pomiaru: (f) mniej pól wpisywanych ręcznie niż przed i nie więcej kliknięć; (g) bez pogorszenia;
(h) zmierzone od „Zapłać” do pobranego pliku.

### ⛔ STOP — zadania (f)–(h): kliknięcia i pola ręczne przed/po + zrzuty 390 px i 1440 px

---

## FAZA 5 — Strona publiczna (SEO)

### 5.1 Ograniczenia, które kształtują stronę

- **Etyka zawodowa notariusza.** Według dostępnych omówień uchwały KRN nr XII/39/2024 dozwolone są
  krótkie, merytoryczne opisy czynności z podstawą prawną oraz optymalizacja w kodzie własnej strony;
  zakazane jest eksponowanie czynności w sposób ukierunkowany na pozyskanie klientów, pozycjonowanie
  poza stroną (linki, kampanie) i aktywne pozyskiwanie opinii. **Treść jest informacyjna:** bez
  przymiotników w stopniu najwyższym, porównań z konkurencją, promocji, opinii klientów, liczników
  „zaufało nam…”, reklam Google ani wymiany linków. Wezwania do działania są funkcjonalne („Złóż
  wniosek”, „Zaloguj się”).
- **Treści prawne pochodzą wyłącznie z `PRZEPISY-PSA.md`**, każde twierdzenie z przepisem. Przepisy 🔵
  oznaczone „od 18.02.2027”. Pozycje ⚠️ (m.in. stawki z rozporządzenia) — nie publikujemy bez
  potwierdzenia Łukasza. Każda strona ma na dole „Podstawa prawna” i „Stan prawny na: [data]”.
- **Wszystkie teksty to projekty do akceptacji Łukasza** — oznaczone w repo `<!-- DO WERYFIKACJI -->`.
  Żadnego kopiowania tekstów z innych stron (prawa autorskie + kara za duplikację treści).
- **Domena nierozstrzygnięta (D-049)** — wszystkie adresy bezwzględne z `BASE_URL`.

### 5.2 Strony (jedna myśl na stronę, pod konkretne zapytania)

| Adres | Treść | Zapytania |
|---|---|---|
| `/` | czym jest rejestr, kto może go prowadzić (art. 300³¹ § 1), jak zacząć w 3 krokach, skrót opłat, wejście do portalu | rejestr akcjonariuszy PSA |
| `/czym-jest-rejestr-akcjonariuszy` | art. 300²⁹–300³³: brak formy dokumentu akcji, zakres danych, znaczenie wpisu | rejestr akcjonariuszy prostej spółki akcyjnej |
| `/jak-to-dziala` | uchwała → umowa → otwarcie rejestru → wpisy → informacja z rejestru | jak założyć rejestr akcjonariuszy |
| `/oplaty` | tabela netto / VAT / brutto **generowana z `przepisy.js`** przy budowaniu, kiedy opłata powstaje, zajęcie komornicze wolne od opłat (art. 300³⁴ § 2) | ile kosztuje rejestr akcjonariuszy |
| `/zbycie-akcji-i-wpisy` | forma dokumentowa zbycia (art. 300³⁶ § 4), jakie dokumenty do wpisu (art. 300³⁴ § 4), termin 7 dni, chwila nabycia (art. 300³⁷) | sprzedaż akcji PSA wpis do rejestru |
| `/zmiana-podmiotu-prowadzacego-rejestr` | przeniesienie rejestru (art. 300³² § 2) | zmiana podmiotu prowadzącego rejestr akcjonariuszy |
| `/nowelizacja-2027` | obowiązki od 18.02.2027 i termin 18.05.2027 dla istniejących spółek (Dz.U. 2026 poz. 176) | rejestr akcjonariuszy KRS 2027 |
| `/pytania` | FAQ — tylko pytania z odpowiedzią opartą na przepisie | — |
| `/kontakt`, `/regulamin`, `/polityka-prywatnosci` | dane kancelarii, regulamin portalu z trybem reklamacji, informacja RODO | — |

Bez podstrony `/wzory` (D-048).

### 5.3 Technika

- **Statyczny HTML** generowany skryptem przy budowaniu (bez frameworka; szablony + treść w
  Markdownie w repo), **nie SPA** — treść widoczna bez JavaScriptu. Portal i aplikacja kancelarii
  mają `noindex` i są wyłączone w `robots.txt`; adres aplikacji kancelarii nigdzie nie jest
  linkowany.
- Każda strona: jeden `h1`, unikalne `title` (do ~60 znaków) i `meta description` (do ~155), `canonical`
  z `BASE_URL`, Open Graph, nawigacja okruszkowa.
- Dane strukturalne JSON-LD: `Notary` (dane kancelarii), `Service` (prowadzenie rejestru
  akcjonariuszy P.S.A.), `BreadcrumbList`. `FAQPage` opcjonalnie — Google od 2023 r. pokazuje
  rozszerzone wyniki FAQ głównie stronom rządowym i medycznym, więc nie licz na efekt.
- `sitemap.xml` z datą modyfikacji, `robots.txt`, linkowanie wewnętrzne między stronami tematycznymi.
- Budżet: HTML + CSS strony < 100 KB, JavaScript ~0, LCP < 1,5 s na profilu mobilnym 4G, CLS < 0,1;
  Lighthouse (SEO, dostępność, wydajność) ≥ 95.
- **Bez narzędzi analitycznych z ciasteczkami** — wtedy nie jest potrzebny baner zgód. Jeśli Łukasz
  zechce statystyk — analiza logów serwera.
- Operator płatności przy aktywacji konta sprawdza zwykle, czy strona ma regulamin, dane sprzedawcy,
  cennik i kontakt — te strony muszą istnieć przed uruchomieniem płatności produkcyjnych.

### 5.4 Ton wizualny

Ta sama tożsamość co portal, w wydaniu redakcyjnym: nagłówki EB Garamond, szerokość kolumny tekstu
~68 znaków, dużo światła, jeden akcent `--rejestr`. Zero stockowych zdjęć; jedna ilustracja
koncepcyjna — uproszczona „oś akcji” z sesji 6 jako znak rozpoznawczy.

### ⛔ STOP — strony w wersji roboczej do przeczytania przez Łukasza + wyniki Lighthouse

---

## FAZA 6 — Weryfikacja końcowa i dokumentacja

1. Scenariusz E2E (`scenariusz-e2e.js`) rozszerzony o: dodanie drugiej spółki z jednego konta,
   zgłoszenie nieprawidłowości → kwalifikacja w kancelarii → wynik w portalu, liczniki po obu
   stronach, akcjonariusza-osobę prawną zagraniczną, przejście zgłoszenie → wniosek bez ponownego
   wpisywania KRS.
2. `axe-core` bez błędów krytycznych i poważnych na każdym ekranie; kontrast WCAG 2.2 AA.
3. `FRONTEND-RAPORT.md`: tabela przed/po względem `FRONTEND-INWENTARZ.md` — wydajność, kliknięcia i
   pola wpisywane ręcznie w zadaniach (a)–(h), liczba komponentów, wyniki axe i Lighthouse.
4. Aktualizacja `ARCHITEKTURA-PSA.md`, `DECYZJE.md` (każda zmiana kontraktu i schematu), README.
5. Lista testów ręcznych dla Łukasza (min. B1 w Chrome, Edge i Safari, płatność w piaskownicy tpay,
   portal i strona publiczna na telefonie).

### ⛔ STOP — raport końcowy

---

## Czego NIE robić

- Nie usuwać ani nie ukrywać funkcji z sekcji 0.2.
- Nie wprowadzać pojęć z S.A. (sekcja 0.3) — ani w interfejsie, ani w treściach.
- Nie scalać pozycji menu kancelarii (D-051).
- Nie zaznaczać automatycznie pozycji checklist weryfikacyjnych (D-052).
- Nie dodawać do wniosku w portalu liczby akcji ani serii (D-053).
- Nie zmieniać mechanizmu dokumentów do podpisu — pobierania, wgrywania, potwierdzania (D-054).
- Nie tworzyć komponentów równoległych do istniejących w `ui-rejestr.js` (sekcja 0, zasada 8).
- Nie przechowywać danych osobowych w `localStorage`.
- Nie ustawiać domyślnie dat o znaczeniu prawnym.
- Nie dodawać frameworków UI ani CSS (Tailwind, MUI, Next.js itd.). Dopuszczalne zależności
  deweloperskie: `esbuild` (D-046), `axe-core`, `lighthouse`. Nie dodawać `compression` (Faza 1 pkt 8).
- Nie ładować niczego z zewnętrznych CDN (fonty, skrypty, piksele śledzące).
- Nie publikować treści prawnych bez akceptacji Łukasza; nie opierać treści na stronach konkurencji.
- Nie pisać tekstów reklamowych (sekcja 5.1).
- Nie pozwalać na zmianę danych rejestru z poziomu ustawień konta.
- Nie zdradzać w publicznych formularzach, czy dana spółka jest klientem kancelarii.
- Nie pokazywać statusu „Opłacone” bez potwierdzenia ITN.
- Nie zostawiać wyłączonego przycisku bez wyjaśnienia ani komunikatu o błędzie z dala od pola.
- Nie stosować animacji dłuższych niż 250 ms ani ignorujących `prefers-reduced-motion`.
- Nie zmieniać logiki domenowej poza punktami tego dokumentu i nie naruszać append-only.
- Nie zgadywać odpowiedzi na Q6 i Q2.
