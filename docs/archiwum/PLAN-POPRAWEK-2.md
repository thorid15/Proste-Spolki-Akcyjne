# Plan poprawek — runda druga

Lista uwag z przeglądu po wdrożeniu przebiegu „dokumenty wystawia kancelaria".
Etapy są ułożone tak, żeby każdy dało się wdrożyć i sprawdzić osobno, a te
trudniejsze stoją za tymi, od których zależą.

**Stan: wszystkie etapy (A, B, C, D) wykonane.**

---

## Etap A — drobne poprawki wyglądu

### A1. Stopka: za wysoka, bez ikon ✔
Stopka zajmuje dziś ~200 px wysokości. Do zrobienia:
* zmniejszyć odstępy (`.stopka-srodek` ma `--od-40` z góry) i znak
  (166 px to nadal dużo jak na pasek na dole ekranu),
* ikony przy telefonie, e-mailu i adresie — zestaw `SCIEZKI_IKON`
  w `publiczne/js/ui-rejestr.js` nie ma jeszcze koperty ani słuchawki,
  trzeba je dorysować w tej samej siatce 24 × 24 i grubości kreski.

### A2. Portal klienta: pasek górny jak w portalu pracownika ✔
Nagłówek „Rejestr akcjonariuszy P.S.A." w portalu klienta idzie przez całą
szerokość i nie ma zaokrągleń. Ma wyglądać jak powłoka aplikacji kancelaryjnej:
zaokrąglony panel odsunięty od krawędzi, zgrany z resztą pól.
Pliki: `publiczne/js/portal.js` (`PortalLayout`), `publiczne/style/rejestr.css`
(`.powloka`, `.portal-topbar`).

### A3. Po przyjęciu wniosku: jedna zakładka „Moja spółka" ✔
Konto przepięte z roli `wnioskodawca` na `spolka` ma przestać widzieć zakładkę
„Wniosek", a „Moje spółki" zmienia nazwę na „Moja spółka" (spółka jest jedna).
Plik: `publiczne/js/portal.js` (`kartyNawigacji`).

---

## Etap B — podpisywanie i weryfikacja dokumentów

### B1. Jeden przycisk zamiast „Podgląd" + „Edytuj treść" ✔
Dziś przy każdym dokumencie stoją dwa przyciski. Ma być jeden — **„Otwórz"** —
który pokazuje dokument tak, jak wygląda, i pozwala poprawiać tekst w miejscu
(jak w Wordzie), a nie w liście pól obok podglądu. Po zapisie pozycja dostaje
znacznik „sprawdzone".

Uwaga wykonawcza: edytor bloków już istnieje i zapisuje treść
(`logika/bloki-dokumentu.js`, `PUT /api/psa/wnioski/:id/dokumenty/:dokId/tresc`).
Zmienia się **postać edytora**, nie mechanizm: zamiast listy pól — jedna kolumna
złożona jak dokument, z blokiem edytowalnym po kliknięciu w niego.

### B2. Po podpisaniu: tylko podgląd i potwierdzenie ✔
Gdy klient odeśle podpisany skan, przy tej pozycji znika „Edytuj" (treść
została już podpisana — nie wolno jej ruszać). Zostaje podgląd obu
egzemplarzy i przycisk **„Podpis prawidłowy"**, którym pracownik potwierdza,
że skan jest kompletny i podpisany. Przyjęcie wniosku wymaga potwierdzenia
wszystkich pozycji.
Baza: nowa kolumna `podpis_potwierdzono` / `podpis_potwierdzil`
w `psa_wnioski_dokumenty`.

### B3. Klient nie przeklikuje wniosku po raz drugi ✔
Po złożeniu wniosek jest zamknięty, więc kreator nie ma po co prowadzić przez
cztery kroki. Klient wraca na „Moja spółka", widzi, że dokumenty czekają na
podpis, i jednym kliknięciem trafia **wprost na podsumowanie z listą
dokumentów** — bez przechodzenia przez Spółkę, Reprezentanta i Akcjonariuszy.
Plik: `publiczne/js/wniosek.js` — krok początkowy zależny od statusu wniosku.

### B4. Ścieżka „do poprawy" przy akcjonariuszu ✔
W szczegółach akcjonariusza (portal pracownika) zamiast „Zapisz i wróć" mają
stać **dwie decyzje**: „Zweryfikowano" albo „Odeślij do poprawy" (z notatką,
co poprawić). Odesłanie ustawia wniosek w `do_uzupelnienia` i wskazuje
konkretną pozycję, a nie cały wniosek.
Pliki: `publiczne/js/wnioski.js` (`SzczegolAkcjonariusza`),
`server/trasy/wnioski.js`.

---

## Etap C — otwarcie rejestru bez przepisywania danych

### C1. Dane z wniosku idą wprost do kartoteki ✔
Przy pierwszej emisji znika pole „Opis żądającego / Jeśli żądający nie jest
wpisany do kartoteki". Zasada: **najpierw osoba jest w kartotece, potem się ją
wybiera** — a przyjęcie wniosku i tak zakłada już akcjonariuszy w `psa_osoby`
(`POST /api/psa/wnioski/:id/przyjmij`). Zostaje sam wybór z kartoteki.

### C2. Pierwszy wpis akcji z danych wniosku ✔
Wniosek zna datę umowy spółki, kapitał akcyjny i listę akcjonariuszy —
emisja założycielska ma się z tego **podpowiadać**, a nie być wpisywana od zera.

### C3. Objęcie po emisji bez powtarzania podstawy wpisu ✔
Po zapisaniu emisji przejście do objęcia ma przenosić podstawę wpisu i serię —
wskazuje się tylko, kto obejmuje i ile. Dziś trzeba wpisać to samo drugi raz.
(Częściowo już jest: `EkranNowejSprawy` przyjmuje `typPoczatkowy` i
`emisjaPoczatkowa`; brakuje przeniesienia podstawy.)

### C4. Emisja bez daty wpisu do KRS — nie do zapisania ✔
Dawniej pole „Data wpisu emisji do KRS" wolno było zostawić puste. Emisja
zapisywała się, ale objęcie akcji odbijało się o art. 300³⁰ § 2 KSH (przed
wpisem akcje formalnie nie istnieją) — w rejestrze siedziało zdarzenie, którego
nie dało się ani użyć, ani poprawić inaczej niż sprostowaniem, o którym trzeba
było wiedzieć.

**Wdrożono wariant „nie da się zapisać bez daty"** (decyzja notariusza): pole
jest obowiązkowe, a walidacja odrzuca zapis (`logika/walidacje.js`,
`PER_TYP.emisja`).

Bramka przy OBJĘCIU zostaje mimo to. Dziennik zdarzeń jest append-only, więc
emisje zapisane przed tą zmianą — bez daty — nadal w nim siedzą i nie mogą
nagle stać się podstawą objęcia; ich drogą wyjścia jest sprostowanie zdarzenia.
Sprawdza to test na samej walidacji (`testy/sprint5.test.js`), bo przez API
takiego stanu nie da się już wytworzyć.

---

## Etap D — przebudowa kokpitu spółki ✔

Kokpit jest ułożony jak rejestr Krajowej Rady Notarialnej: metryka u góry,
niżej rozwijane sekcje, każda z własnym przyciskiem wpisu.

1. **Rejestr akcjonariuszy** (otwarty domyślnie) — „Dodaj akcjonariusza"
   pyta o jedno: czy akcjonariusz OBEJMUJE nowo wyemitowane akcje, czy
   NABYŁ je od kogoś, kto już je ma. Droga wykluczona stanem rejestru
   (objęcie, gdy żadna emisja nie czeka) zostaje widoczna razem z powodem.
   Pod tabelą: przeniesienie, zmiana danych, przedstawiciel współuprawnionych.
2. **Rejestr akcji** — „Nowa emisja"; przy emisji z akcjami nieobjętymi stoi
   w jej wierszu „Kto obejmuje" z już wybraną serią. Pod tabelą: umorzenie,
   unieważnienie, pokrycie wkładem, zbycie ułamka.
3. **Rejestr uprawnień, przywilejów i obowiązków** — razem z ograniczeniami
   w rozporządzaniu (art. 300³³ § 1 pkt 10 KSH to obowiązek akcjonariusza,
   nie osobny rejestr).
4. **Rejestr zajęć, zastawów, użytkowania** — zajęcie egzekucyjne osobno,
   bo idzie z urzędu (art. 300³⁴ § 2 KSH).
5. **Rejestr zdarzeń** — wpisy bez własnej tabeli stanu: zmiany danych,
   zobowiązania, sprostowania, zdarzenia „inne".
6. **Dokumenty** — rozwijana sekcja zamiast panelu po prawej. Jeden nowy
   endpoint `GET /api/psa/spolki/:id/akta` zbiera całą teczkę: komplet
   z wniosku (oba egzemplarze w jednej pozycji, dwa odnośniki), skany
   dosyłane przy żądaniach wpisu (tu trafia umowa sprzedaży akcji, razem
   z numerem sprawy) i pisma wystawione przez kancelarię.
7. **Historia zdarzeń** — łańcuch skrótów, sprostowania, „Przelicz stan".

Przy okazji:
* **zniknął przycisk „Nowe zdarzenie"** — typ zdarzenia jedzie w adresie
  (`?typ=…`), więc kreator otwiera się od razu na podstawie wpisu, bez
  ekranu z dwudziestoma kafelkami;
* **zniknęła oś akcji** — wykres „numer akcji × czas" z playheadem, razem
  z trasą `GET /:id/os-akcji`, projekcją `widokOsiAkcji` i jej testami.
  Stan na dzień wsteczny wybiera się polem daty w nagłówku (art. 300³⁵ KSH
  mówi o informacji NA DZIEŃ — po to oś była używana);
* nagłówek sekcji przestał być przyciskiem w przycisku: rozwijanie i wpis
  to teraz rodzeństwo, nie zagnieżdżenie.

Pliki: `publiczne/js/kokpit.js`, `publiczne/js/ui-rejestr.js`,
`publiczne/js/ui.js`, `publiczne/style/rejestr.css`,
`server/trasy/spolki.js`, `server/widoki.js`.

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
