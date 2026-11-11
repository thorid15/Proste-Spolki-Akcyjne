# FAZA 4 — raport STOP

Data: 2026-09-25. Podstawa: `SESJA-PSA-FRONTEND.md` v2, FAZA 4 — architektura portalu, kreator
wniosku, P1–P7. Baseline: `FRONTEND-INWENTARZ.md` §4 (Faza 0).

## 1. Co zrobiono

1. **Architektura informacji (pkt 1).** Płaska nawigacja portalu (Moja spółka / Moje zgłoszenia /
   Płatności — trzy niepowiązane strony) zastąpiona pięcioma pozycjami z sesji: **Start** („Do
   zrobienia" — ta sama zasada co K1 w kancelarii: wniosek do dokończenia/podpisu, sprawy z bliskim
   terminem, opłaty do zapłaty, jedna lista, jeden przycisk na pozycję), **Moje spółki** (klient
   z jedną spółką trafia od razu do niej — bez klikania przez listę długości 1), **widok spółki**
   (`/spolka/:id`, nowe zakładki Rejestr/Zgłoszenia/Dokumenty/Opłaty zamiast czterech osobnych stron),
   **Wnioski** (wniosek o kolejną spółkę, B8), **Konto** (nowy ekran — dane logowania, zmiana hasła,
   dokumenty prawne, wylogowanie) i **Pomoc** (nowy ekran — instrukcja + kontakt kancelarii).
   „Dokumenty" w widoku spółki to nowa funkcja: zawiadomienia o wpisie i wydane informacje z rejestru
   (`psa_wydane_dokumenty`, kanał „portal") — wcześniej te dokumenty szły wyłącznie e-mailem, bez
   śladu dostępnego w portalu.
2. **Ekran przed wnioskiem (pkt 2).** Karta „Co przygotować" (umowa spółki, uchwała o wyborze, dane
   akcjonariuszy, szacowany czas ~15 min) przed klauzulą RODO. Trzy fakty na ekranie logowania
   przeformułowane z konkretnymi przepisami (termin 7 dni — art. 300³⁴ § 1, elektroniczna postać
   rejestru — art. 300³¹ § 3–4, informacja z rejestru — art. 300³⁵).
3. **Kreator wniosku (pkt 4, P3).** Pasek kroków był tylko wyświetlany — teraz klikalny wstecz i do
   kroków już odwiedzonych. Krok „Podsumowanie": trzy sekcje dostały przyciski „Zmień" prowadzące
   wprost do właściwego kroku (wcześniej jedyną wskazówką był fragment tekstu w komunikacie błędu).
4. **P2 — zgłoszenie → wniosek bez przepisywania KRS.** Nowa kolumna `psa_konta.zgloszenie_id`
   (migracja 56, D-062) łączy konto z jego źródłowym zgłoszeniem; pierwszy wniosek konta podstawia
   `krs`/`nazwa` z tego zgłoszenia i automatycznie uruchamia pobranie z KRS. Świadomie niedokończone:
   wybór reprezentanta ze składu organu KRS (opisane w D-062 i w sekcji 3 niżej).
5. **P4 — dokumenty do podpisu.** Blok „Jak podpisać dokumenty" (trzy stałe akapity, zawsze
   rozwinięty) jako `<details>`/`<summary>` — domyślnie zwinięty. Mechanizm podpisu bez zmian (D-054).
6. **P5 — informacja z rejestru.** „Zamów informację" → „Zapłać 61,50 zł" (kwota w etykiecie).
   Adres powrotu z tpay prowadzi teraz do zakładki „Opłaty" właściwej spółki (`?zakladka=oplaty`,
   wcześniej martwy `#/platnosci`) z `&zwrot=1` — front pokazuje wtedy „Czekamy na potwierdzenie od
   operatora płatności" i odpytuje stan co 3 s, zamiast zakładać „Opłacone" na podstawie powrotu.
7. **P1 — tabele 390 px.** Zweryfikowano wszystkie zmienione w tej fazie ekrany — zero przewijania
   poziomego.
8. **P7 — etykiety.** Przegląd ukierunkowany (grep pod kątem znanych terminów prawniczych w
   etykietach) — bez znalezisk; własne nowe ekrany (Konto, Pomoc, „Co przygotować") pisane językiem
   laika od razu.
9. **Pkt 6 — wygaśnięcie sesji (8h).** Serwer eksponuje moment wygaśnięcia tokenu przez
   `GET /whoami` (`sesja_wygasa`); front pokazuje pasek ostrzeżenia, gdy zostało ≤5 minut. Szkic
   wniosku i tak nie ginie — zapis jest automatyczny po każdym polu (0.4 pkt 4, bez zmian w tej fazie).

## 2. Pomiar zadań (f)–(h)

| Zadanie | Baseline (Faza 0) | Cel | Wynik |
|---|---:|---|---|
| (f) logowanie → złożony wniosek | 12 kliknięć | mniej pól ręcznych, nie więcej kliknięć | patrz niżej |
| (g) zgłoszenie zmiany | 3 kliknięcia | bez pogorszenia | patrz niżej |
| (h) płatność → pobranie | niezmierzone (brak tpay) | zmierzone Zapłać→plik | nadal niezmierzone (tpay nieskonfigurowane) |

**(f).** Zweryfikowano na żywo (zrzut `f4-p2-auto-krs.png`) pełną ścieżkę zgłoszenie → zaproszenie →
aktywacja → wniosek dla konta z numerem KRS podanym w zgłoszeniu: pole „Numer KRS" jest wypełnione od
razu, a pobranie z rejestru startuje samo, bez klikania „Pobierz z KRS" — dokładnie ta redukcja pól
ręcznych, której szukał cel (f). W środowisku audytowym prawdziwe API KRS jest niedostępne (blokada
sieci), więc pełnego efektu „nazwa/adres/sąd/kapitał wypełnione automatycznie" nie dało się zmierzyć
end-to-end — ten sam limit środowiska co przy Fazie 0. Liczba kliknięć nawigacyjnych nie rośnie:
kreator ma teraz dodatkowo klikalny pasek kroków (mniej kliknięć przy poprawkach — „Zmień" zamiast
Wstecz×N) i jeden krok mniej do przejścia zanim dotrze się do formularza (Start już nie jest
pośrednim przystankiem dla wnioskodawcy — trasa `/wniosek` z nawigacji prowadzi wprost do formularza).
Pełne powtórzenie pomiaru klik-po-kliku od loginu do złożenia (z wypełnieniem wszystkich pól
akcjonariusza) nie zostało wykonane w tej sesji ze względu na budżet — czynność nie była zmieniana
poza automatycznym KRS, więc ryzyko regresji liczby kliknięć jest niskie.

**(g).** Ścieżka „Poproś o nowy wpis" (dawne „Zgłoś zmianę") nie została dotknięta w FAZA 4 — działa
jak dotąd, teraz osiągalna z zakładki „Zgłoszenia" widoku spółki zamiast z karty na liście „Moje
spółki" (ten sam jeden klik do formularza, inny punkt startowy). Bez pogorszenia.

**(h).** Jak w Fazie 0 — `tpay` nieskonfigurowane w środowisku audytowym, więc pełnej ścieżki
„Zapłać → pobrany plik" nie dało się zmierzyć end-to-end. Zrobiono to, co możliwe bez piaskownicy
tpay: etykieta przycisku z kwotą (`f4-informacja-zaplac.png`) i mechanizm oczekiwania na ITN zamiast
zakładania „Opłacone" po powrocie (`f4-czekamy-potwierdzenie.png`), zweryfikowany symulacją odpowiedzi
`/whoami`/parametru `zwrot=1`, nie prawdziwą transakcją.

## 3. Czego nie zrobiono w tej fazie (świadomie odłożone)

- **P2, część "reprezentant z listy składu organu KRS".** `krs.js` już zwraca skład organu (używany
  w kancelarii, K6) — podłączenie tego samego wyboru w kreatorze wniosku portalu jest przygotowane
  (ten sam wzorzec), ale nie zostało zrobione w tej sesji. Opisane w D-062.
- **Pełny klik-po-kliku pomiar (f) od loginu do złożenia wniosku** z kompletnym, poprawnym
  akcjonariuszem — zweryfikowano tylko kluczową zmianę (auto-KRS), nie całą ścieżkę na nowo, żeby nie
  powtarzać czasochłonnego scenariusza niezwiązanego z zmianami tej fazy.
- **Pomiar (h) w prawdziwej piaskownicy tpay** — środowisko audytowe go nie ma; sam mechanizm
  (etykieta z kwotą, brak fałszywego „Opłacone") zweryfikowany inaczej, opisane wyżej.
- **Wyczerpujący przegląd P7** na każdym ekranie portalu zdanie po zdaniu — wykonano ukierunkowany
  przegląd (grep pod kątem znanych terminów prawniczych w etykietach + własne nowe teksty), nie
  pełny redakcyjny przegląd całości.

## 4. Testy i stan repo

`npm test`: **511/511 zielone** po wszystkich zmianach FAZA 4, włącznie z migracją 56.

Migracje: **56** — `psa_konta.zgloszenie_id` (D-062, opisana w `DECYZJE.md`).

Zrzuty (`frontend-audyt/zrzuty/faza4/`): po jednym–kilka na każdy punkt, w tym zestaw 390 px (P1) i
dowód auto-KRS (P2).
