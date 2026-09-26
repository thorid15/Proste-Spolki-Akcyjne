# Przejęcie rejestru od domu maklerskiego

Docelowy klient kancelarii to spółka, która rejestr ma już gdzie indziej —
najczęściej w domu maklerskim, za około 4000 zł rocznie. Ten dokument opisuje,
jak takie przejście przebiega i co aplikacja robi na każdym jego kroku.

## 1. Co mówi ustawa

**Art. 300³¹ § 5 KSH** — wybór podmiotu prowadzącego rejestr wymaga **uchwały
akcjonariuszy**. Zmiana podmiotu to nowy wybór, więc też uchwała.

**Art. 300³² § 2 KSH** — rozwiązanie umowy jest niesymetryczne i to jest
najważniejsza rzecz w całym procesie:

| Kto rozwiązuje | Warunek | Termin wypowiedzenia |
|---|---|---|
| **spółka** | zawarcie **nowej umowy** o prowadzenie rejestru | ustawa **nie narzuca żadnego** |
| podmiot prowadzący rejestr | wyłącznie **ważne powody** | **nie krótszy niż 3 miesiące** |

Trzymiesięczny termin obciąża **dom maklerski, nie spółkę**. Spółka może
wypowiedzieć umowę w terminie wynikającym z samej umowy z domem maklerskim —
często krótszym — pod jednym warunkiem: że ma już podpisaną umowę z kancelarią.
Warunek z art. 300³² § 2 działa więc na naszą korzyść: **żeby wypowiedzieć,
spółka musi najpierw przyjść do nas.** Kolejność jest odwrotna, niż wydaje się
klientom.

**Art. 300³² § 3 KSH** — o wygaśnięciu albo rozwiązaniu umowy sąd rejestrowy
zawiadamia **podmiot ustępujący**, w terminie 7 dni od tej daty. Nie my.

**Art. 300³² § 1¹–1³ KSH** — zarząd zgłasza zawarcie **naszej** umowy do sądu
rejestrowego, podając imię i nazwisko notariusza oraz siedzibę i adres
kancelarii, i dołącza własne oświadczenie potwierdzające zawarcie umowy. To
obowiązek zarządu, nie kancelarii — ale to my mamy dane, które tam wchodzą.

## 2. Przebieg, krok po kroku

| # | Kto | Co robi | Gdzie w aplikacji |
|---|---|---|---|
| 1 | spółka | zgłasza się przez formularz publiczny | `/portal#/zglos-sie` — kontrola numeru KRS i formy prawnej |
| 2 | kancelaria | zaproszenie idzie automatycznie | konto portalowe zakłada się przy zgłoszeniu |
| 3 | spółka | wypełnia wniosek: dane spółki z KRS, reprezentant, akcjonariusze | kreator wniosku w portalu klienta |
| 4 | kancelaria | weryfikuje wniosek i wystawia komplet do podpisu | kolejka **Wnioski** |
| 5 | spółka | podejmuje **uchwałę o wyborze** (wzór w komplecie), podpisuje umowę, odsyła komplet | portal klienta, przycisk „Odeślij komplet” |
| 6 | spółka | **dopiero teraz** wypowiada umowę domowi maklerskiemu | poza aplikacją |
| 7 | dom maklerski | wydaje stan rejestru na dzień rozwiązania i zawiadamia sąd (7 dni) | poza aplikacją |
| 8 | kancelaria | przyjmuje wniosek i otwiera rejestr | **Wnioski → Przyjmij** |
| 9 | kancelaria | wprowadza **stan otwarcia** z datami historycznymi | kokpit spółki → **Migracja — stan otwarcia** |
| 10 | zarząd | zgłasza zawarcie umowy do sądu rejestrowego | poza aplikacją; dane bierze z umowy |

Krok 9 to jedyne miejsce, w którym aplikacja przyjmuje zdarzenia z datami
wstecznymi. Ekran migracji jest dostępny wyłącznie, dopóki rejestr jest pusty
(`liczba_zdarzen === 0`) — potem znika, bo rejestru nie da się „dosypać”.

## 3. Co warto wiedzieć, rozmawiając z klientem

- **„Nie mogę odejść przez trzy miesiące”** — to najczęstsze nieporozumienie.
  Trzy miesiące wiążą dom maklerski, gdy to on chce się rozstać. Spółkę wiąże
  wyłącznie jej własna umowa. Warto poprosić klienta o skan tej umowy i
  sprawdzić, jaki termin wypowiedzenia z niej wynika.
- **Kolejność jest przymusowa** — umowa z nami musi istnieć, zanim spółka
  wypowie starą. Wynika to wprost z art. 300³² § 2 KSH, więc nie jest to nasz
  wymóg handlowy, tylko ustawowy. Klientowi mówi się to raz, na początku.
- **Co zabrać od domu maklerskiego** — stan rejestru na dzień rozwiązania
  umowy: emisje (seria, numery, cena emisyjna, data wpisu emisji do KRS),
  akcjonariusze z przypisaniem numerów akcji, obciążenia, uprawnienia
  i ograniczenia. To jest dokładnie ten zakres, który przyjmuje ekran migracji.
- **Czego NIE przenosimy** — historii zdarzeń z tamtego rejestru. Nasz rejestr
  zaczyna się od stanu otwarcia; poprzednia historia zostaje u poprzednika i to
  on odpowiada za jej udostępnianie.

## 3a. Przejęcie z rejestru KRN (rejestry-notarialne.pl) — reguły (D-R08)

Zakres danych KRN opisuje `docs/krn/Inwentaryzacja_Rejestr_PSA.md`. Stan otwarcia wprowadza się
ekranem **Migracja — stan otwarcia** (wyłącznie w rejestrze bez zwykłych wpisów):

1. **Uprawnienia, przywileje, obowiązki z kilkoma rodzajami naraz** (w KRN maska bitowa, np. U+O)
   rozbijamy na osobne wpisy — po jednym na rodzaj.
2. **Treść postanowienia** zapisaną w KRN w „Komentarzu do statusu” przenosimy do pola `tresc`
   (w KRN komentarz nie drukuje się na raporcie — u nas treść drukuje się na informacji).
3. **Ograniczenia rozporządzania** zapisane w KRN w „Uwagach notariusza” spółki (np. prawo
   pierwszeństwa, zgoda spółki) wprowadzamy jako wpis „Ograniczenie” (`psa_ograniczenia`),
   nie do `uwagi`.
4. **Pokrycie akcji** zapisane w KRN w „Uwagach” wprowadzamy wpisem „Pokrycie akcji wkładem”
   (`pokrycie_akcji`).
5. **Data wpisu = data rejestracji w KRN** (kolumna DR, z godziną, jeżeli KRN ją podaje) — pole
   „Data rejestracji w KRN” na ekranie migracji; zapisuje się jako `data_wpisu` zdarzenia, a
   znacznik `migracja_krn` w treści zdarzenia (objęty skrótem) pokazuje, skąd pochodzi. Daty
   zdarzenia nie ma (D-R01). Wpisy migracyjne wprowadza się chronologicznie — aplikacja odrzuci
   wpis wcześniejszy niż poprzedni.
6. **Transze KRN** tego samego akcjonariusza w tej samej serii wprowadzamy jako osobne objęcia
   (z ręcznym zakresem numerów), każdą z jej datą rejestracji w KRN. Zakresy z tym samym dniem
   wpisu łączą się same (D-R03); transze z różnymi datami zachowują własne daty.
7. **Charlie Unicorn AI PSA — migracja wstrzymana do decyzji notariusza.** W KRN akcjonariusz
   ID 21995 nie ma akcji, a w transakcji z 25.09.2026 (akcje nr 890–989) nabywca jest zarazem
   zbywcą — prawdopodobnie wybrano niewłaściwą osobę. Przed migracją stan trzeba wyjaśnić ze
   spółką.
8. **Numeracja serii od numeru innego niż 1** (w KRN numeracja bywa ciągła między seriami, np.
   AN 1–25, AZ 26–100) — w emisji podaje się „Numer pierwszej akcji”; przechodzi przez emisję,
   objęcie, przeniesienie i informację z rejestru (test `testy/d-r08-krn-numeracja.test.js`).

## 4. Czego aplikacja jeszcze nie robi

Zapisane świadomie, do decyzji na później:

- **Terminarz przejścia** — kancelaria nie widzi dziś, że spółka jest w trakcie
  wypowiadania umowy i od kiedy rejestr ma być nasz. Dałoby się to zrobić jednym
  polem `data_przejecia` na wniosku i pozycją na pulpicie („3 spółki czekają na
  wydanie stanu”), ale dopiero gdy takich spraw będzie kilka naraz.
- **Import pliku od domu maklerskiego** — dziś stan otwarcia wpisuje się ręcznie.
  Domy maklerskie nie mają wspólnego formatu, więc import miałby sens dopiero
  przy powtarzalnym źródle.
