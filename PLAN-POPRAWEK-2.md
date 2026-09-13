# Plan poprawek — runda druga

Lista uwag z przeglądu po wdrożeniu przebiegu „dokumenty wystawia kancelaria".
**Nic z tego nie jest jeszcze zrobione** — to zapis do wykonania w kolejnych
sesjach. Etapy są ułożone tak, żeby każdy dało się wdrożyć i sprawdzić osobno,
a te trudniejsze stoją za tymi, od których zależą.

---

## Etap A — drobne poprawki wyglądu

### A1. Stopka: za wysoka, bez ikon
Stopka zajmuje dziś ~200 px wysokości. Do zrobienia:
* zmniejszyć odstępy (`.stopka-srodek` ma `--od-40` z góry) i znak
  (166 px to nadal dużo jak na pasek na dole ekranu),
* ikony przy telefonie, e-mailu i adresie — zestaw `SCIEZKI_IKON`
  w `publiczne/js/ui-rejestr.js` nie ma jeszcze koperty ani słuchawki,
  trzeba je dorysować w tej samej siatce 24 × 24 i grubości kreski.

### A2. Portal klienta: pasek górny jak w portalu pracownika
Nagłówek „Rejestr akcjonariuszy P.S.A." w portalu klienta idzie przez całą
szerokość i nie ma zaokrągleń. Ma wyglądać jak powłoka aplikacji kancelaryjnej:
zaokrąglony panel odsunięty od krawędzi, zgrany z resztą pól.
Pliki: `publiczne/js/portal.js` (`PortalLayout`), `publiczne/style/rejestr.css`
(`.powloka`, `.portal-topbar`).

### A3. Po przyjęciu wniosku: jedna zakładka „Moja spółka"
Konto przepięte z roli `wnioskodawca` na `spolka` ma przestać widzieć zakładkę
„Wniosek", a „Moje spółki" zmienia nazwę na „Moja spółka" (spółka jest jedna).
Plik: `publiczne/js/portal.js` (`kartyNawigacji`).

---

## Etap B — podpisywanie i weryfikacja dokumentów

### B1. Jeden przycisk zamiast „Podgląd" + „Edytuj treść"
Dziś przy każdym dokumencie stoją dwa przyciski. Ma być jeden — **„Otwórz"** —
który pokazuje dokument tak, jak wygląda, i pozwala poprawiać tekst w miejscu
(jak w Wordzie), a nie w liście pól obok podglądu. Po zapisie pozycja dostaje
znacznik „sprawdzone".

Uwaga wykonawcza: edytor bloków już istnieje i zapisuje treść
(`logika/bloki-dokumentu.js`, `PUT /api/psa/wnioski/:id/dokumenty/:dokId/tresc`).
Zmienia się **postać edytora**, nie mechanizm: zamiast listy pól — jedna kolumna
złożona jak dokument, z blokiem edytowalnym po kliknięciu w niego.

### B2. Po podpisaniu: tylko podgląd i potwierdzenie
Gdy klient odeśle podpisany skan, przy tej pozycji znika „Edytuj" (treść
została już podpisana — nie wolno jej ruszać). Zostaje podgląd obu
egzemplarzy i przycisk **„Podpis prawidłowy"**, którym pracownik potwierdza,
że skan jest kompletny i podpisany. Przyjęcie wniosku wymaga potwierdzenia
wszystkich pozycji.
Baza: nowa kolumna `podpis_potwierdzono` / `podpis_potwierdzil`
w `psa_wnioski_dokumenty`.

### B3. Klient nie przeklikuje wniosku po raz drugi
Po złożeniu wniosek jest zamknięty, więc kreator nie ma po co prowadzić przez
cztery kroki. Klient wraca na „Moja spółka", widzi, że dokumenty czekają na
podpis, i jednym kliknięciem trafia **wprost na podsumowanie z listą
dokumentów** — bez przechodzenia przez Spółkę, Reprezentanta i Akcjonariuszy.
Plik: `publiczne/js/wniosek.js` — krok początkowy zależny od statusu wniosku.

### B4. Ścieżka „do poprawy" przy akcjonariuszu
W szczegółach akcjonariusza (portal pracownika) zamiast „Zapisz i wróć" mają
stać **dwie decyzje**: „Zweryfikowano" albo „Odeślij do poprawy" (z notatką,
co poprawić). Odesłanie ustawia wniosek w `do_uzupelnienia` i wskazuje
konkretną pozycję, a nie cały wniosek.
Pliki: `publiczne/js/wnioski.js` (`SzczegolAkcjonariusza`),
`server/trasy/wnioski.js`.

---

## Etap C — otwarcie rejestru bez przepisywania danych

### C1. Dane z wniosku idą wprost do kartoteki
Przy pierwszej emisji znika pole „Opis żądającego / Jeśli żądający nie jest
wpisany do kartoteki". Zasada: **najpierw osoba jest w kartotece, potem się ją
wybiera** — a przyjęcie wniosku i tak zakłada już akcjonariuszy w `psa_osoby`
(`POST /api/psa/wnioski/:id/przyjmij`). Zostaje sam wybór z kartoteki.

### C2. Pierwszy wpis akcji z danych wniosku
Wniosek zna datę umowy spółki, kapitał akcyjny i listę akcjonariuszy —
emisja założycielska ma się z tego **podpowiadać**, a nie być wpisywana od zera.

### C3. Objęcie po emisji bez powtarzania podstawy wpisu
Po zapisaniu emisji przejście do objęcia ma przenosić podstawę wpisu i serię —
wskazuje się tylko, kto obejmuje i ile. Dziś trzeba wpisać to samo drugi raz.
(Częściowo już jest: `EkranNowejSprawy` przyjmuje `typPoczatkowy` i
`emisjaPoczatkowa`; brakuje przeniesienia podstawy.)

### C4. Emisja bez daty wpisu do KRS — nie do zapisania
**Zdiagnozowane.** Pole „Data wpisu emisji do KRS" (`publiczne/js/kreator.js`,
ok. linii 278) wolno zostawić puste, a wtedy objęcie akcji jest zablokowane
(art. 300³⁰ § 2 KSH — akcje przed wpisem formalnie nie istnieją). Blokada jest
**celowa i prawidłowa**, zła jest tylko droga wyjścia: podpowiedź mówi
„datę można uzupełnić później sprostowaniem tego zdarzenia", ale trzeba samemu
znaleźć sprostowanie.

Do rozstrzygnięcia — dwie drogi, wybrać jedną:
1. **nie pozwalać zapisać** emisji bez daty wpisu (tak proponuje uwaga), albo
2. zostawić zapis, ale przy zablokowanej emisji postawić przycisk
   „Uzupełnij datę wpisu do KRS", który otwiera sprostowanie tego zdarzenia.

Wariant 2 jest bliższy rzeczywistości kancelarii (emisja bywa znana przed
wpisem), wariant 1 jest prostszy. **Do decyzji notariusza.**

---

## Etap D — przebudowa kokpitu spółki

Największa pozycja. Kokpit ma być ułożony jak rejestr Krajowej Rady
Notarialnej: podsumowanie u góry i rozwijane sekcje o tych nazwach:

1. **Rejestr akcjonariuszy** (otwarty domyślnie) — przycisk „Dodaj akcjonariusza",
2. **Rejestr akcji** — „Nowa emisja", a zaraz po dodaniu emisji wskazanie,
   kto ją obejmuje,
3. **Rejestr uprawnień, przywilejów i obowiązków** — powiązane z konkretnymi
   akcjami,
4. **Rejestr zajęć, zastawów, użytkowania**,
5. **Rejestr zdarzeń**,
6. **Dokumenty** — dziś panel po prawej, ma być taką samą rozwijaną sekcją:
   komplet z wniosku (podpisana umowa, uchwała, zgody) plus wszystko, co klient
   dośle później, z datami. Skan umowy sprzedaży akcji ma się tu pojawiać razem
   z nowym żądaniem wpisu,
7. **Historia zdarzeń** — na końcu, tak jak dziś.

Przy okazji:
* **znika osobny przycisk „Nowe zdarzenie"** — każda sekcja ma własną akcję,
* **znika oś akcji** (`publiczne/js/ui-rejestr.js`, `Iskra` i widok osi) —
  niepotrzebna,
* każde zdarzenie trzeba przemyśleć od nowa pod kątem: co system już wie
  i o co naprawdę musi zapytać.

Pliki: `publiczne/js/kokpit.js` (1130 linii), `publiczne/js/kreator.js`
(1533 linie), `publiczne/js/os-akcji*`. To przepisanie, nie poprawka —
warto je zrobić osobną sesją, po etapach A–C.

---

## Odpowiedź na pytanie z przeglądu

**Skąd w umowie bierze się sposób reprezentacji („DO SKŁADANIA OŚWIADCZEŃ
W IMIENIU SPÓŁKI JEST UPOWAŻNIONY KAŻDY Z CZŁONKÓW ZARZĄDU SAMODZIELNIE.")?**

Z **KRS**, wprost i bez żadnej ingerencji aplikacji:

1. `server/trasy/krs.js` czyta `dzial2.reprezentacja.sposobReprezentacji`
   z otwartego API Ministerstwa Sprawiedliwości i zapisuje do pola
   `reprezentant_reprezentacja`;
2. pole dochodzi razem z nazwą, adresem i NIP-em przy „Pobierz z KRS" —
   formularz klienta **nie ma** takiego pola do ręcznego wpisania (to świadome:
   notariusz sprawdza reprezentację na wydruku z KRS);
3. `server/logika/kontekst-pisma.js` podstawia je pod `{{reprezentant_reprezentacja}}`
   we wzorze `wzory/01-Umowa-o-prowadzenie-rejestru-akcjonariuszy-WZOR.docx`.

Wersaliki i kropka na końcu pochodzą więc z samego rejestru — tak ten zapis
figuruje w KRS. Jeśli ma wyglądać inaczej w umowie (np. bez wersalików), da się
to poprawić przy dokumencie w edytorze treści albo znormalizować przy pobraniu.
**Do decyzji notariusza**, bo to zmiana cytatu z rejestru.
