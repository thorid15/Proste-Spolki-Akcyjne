# Wytyczne merytoryczne — moduł Rejestr akcjonariuszy P.S.A.

> **Relacja do pozostałych plików.** `PRZEPISY-PSA.md` mówi **co stanowi ustawa** (jedyne źródło
> prawne, brzmienie przepisów). Ten plik mówi **jak to rozumieć w praktyce** — wykładnia, standard
> dowodowy, granice odpowiedzialności, konsekwencje dla modelu danych i UI. `CLAUDE-PSA.md` mówi
> **jak to zbudować**.
>
> **Źródła (opracowania, nie akty prawne):** komentarz do przepisów o P.S.A. (Wolters Kluwer, 2021;
> aut. m.in. A. Fus, R. Adamus, G. Keler) oraz prezentacja notarialna o P.S.A. (S. Posadzy, 2019).
> **Opracowania nie mogą być podstawą blokady w systemie** — służą do rozumienia przepisu, nie do
> jego zastępowania. Każda reguła nadal wskazuje jednostkę redakcyjną z `PRZEPISY-PSA.md`.
>
> ⚠️ Prezentacja pochodzi z 2019 r. i posługuje się numeracją Prawa o notariacie sprzed
> konsolidacji — treść zgadza się z aktualnym stanem, **numery jednostek wymagają potwierdzenia**.

---

## 1. Rejestr ma trzy kategorie danych, nie jedną

To najważniejszy wniosek dla modelu danych i formularzy. Katalog z art. 300³³ dzieli się na:

| Kategoria | Zakres | Skąd trafia do rejestru |
|---|---|---|
| **Obligatoryjne** | pkt 1–4, pkt 5 (dane i adres akcjonariusza), pkt 9–11 | pierwsze dane przekazuje **spółka** przy otwarciu rejestru; kolejne przy emisjach — też od spółki |
| **Fakultatywne** | pkt 5 (adres e-mail), pkt 6, 7, 8 | **wyłącznie na żądanie** uprawnionego, z dokumentami uzasadniającymi |
| **Dodatkowe z umowy spółki** | dowolne, art. 300³³ § 2 | jeżeli umowa spółki je przewiduje — wpisywane **obligatoryjnie** |

**Konsekwencje:**
- Formularz otwarcia rejestru i formularz emisji zbierają wyłącznie dane obligatoryjne — reszta
  nie może być wymagana.
- Wpisy pkt 6–8 (przejście akcji, prawo głosu zastawnika, wykreślenie obciążenia) to **zawsze
  osobna sprawa na żądanie**, nigdy automat przy okazji innego zdarzenia.
- Dane dodatkowe z umowy spółki są obowiązkowe, **ale tylko o ile podmiot prowadzący rejestr ma
  techniczną możliwość ich wpisania**. Stąd praktyczny wymóg: pole `dodatkowe_informacje_umowa_spolki`
  musi być swobodne (tekst strukturalny), a przy zawieraniu umowy trzeba sprawdzić, czy umowa
  spółki nie żąda czegoś, czego system nie udźwignie. **To pytanie do checklisty przyjęcia spółki.**

---

## 2. Kto może żądać wpisu

Ustawa mówi „spółka lub inna osoba mająca interes prawny". Doktryna wypełnia to konkretami —
listę wyboru w kreatorze budujemy na niej:

- **akcjonariusz** — podstawowy uprawniony,
- **zbywca** i **nabywca** akcji,
- **zastawnik** i **użytkownik**,
- osoby i organy uprawnione do zaskarżenia uchwał walnego zgromadzenia,
- **spółka**.

**Nie dokonujemy wpisów z urzędu** — jedynym wyjątkiem jest ujawnienie zajęcia praw majątkowych
(art. 300³⁴ § 2). Każda inna zmiana wymaga żądania uprawnionego podmiotu. W UI: brak przycisku
„dodaj wpis" poza ścieżką sprawy.

**Nie pozyskujemy dokumentów samodzielnie.** Ciężar przedłożenia dokumentów spoczywa na żądającym.
Brak dokumentów = brak podstawy wpisu = przeszkoda, nie odmowa merytoryczna.

---

## 3. Standard dowodowy — co badamy i jak głęboko

### Czym jest „dokument"

Ustawa nie określa formy dokumentów uzasadniających wpis. Stosuje się cywilistyczne pojęcie
dokumentu: **nośnik informacji umożliwiający zapoznanie się z jej treścią** (art. 77³ k.c.).
W praktyce oznacza to, że dokumentem mogą być również: skan, wydruk, kserokopia, wiadomość e-mail,
a nawet wiadomość z komunikatora — o ile pozwalają zbadać treść i formę.

**Konsekwencja dla checklisty:** pozycja „dokument w odpowiedniej formie" **nie może** oznaczać
„oryginał z podpisem notarialnie poświadczonym". Odrzucenie skanu jako „nie-dokumentu" byłoby
błędem merytorycznym. Osobna sprawa: samo **zbycie lub obciążenie akcji** wymaga formy dokumentowej
pod rygorem nieważności (art. 300³⁶ § 4) — to wymóg wobec czynności, nie wobec sposobu jej
przedłożenia.

### Granice badania

Badamy **treść i formę**. Nie badamy zgodności z prawem ani prawdziwości — w tym podpisów —
**chyba że powstaną uzasadnione wątpliwości**. Rola podmiotu prowadzącego rejestr jest rolą
pośrednika o celowo ograniczonych kompetencjach; to nie jest kontrola sądowa.

**Uwzględniamy ograniczenia w rozporządzaniu akcją — zarówno ustawowe, jak i wynikające z umowy
spółki.** To oznacza, że przy przyjęciu spółki musimy wczytać z umowy spółki i zapisać w systemie:
zgodę spółki na zbycie, prawo pierwszeństwa, zakaz prawa głosu zastawnika, ograniczenia dziedziczenia.
Bez tego art. 300³⁴ § 6 jest niewykonalny.

### Spory

**Podmiot prowadzący rejestr nie rozstrzyga sporów między żądającymi wpisu.** Gdy pojawia się spór
co do prawa do akcji, podstawą wpisu może być dopiero orzeczenie sądu.

**Konsekwencja:** sprawa potrzebuje odrębnego stanu **„spór"** — nie „przeszkoda" (bo nie ma czego
uzupełnić) i nie zwykła odmowa. Szablon zawiadomienia powinien wskazywać, że rozstrzygnięcie
wymaga drogi sądowej. Wejście w ten stan zatrzymuje zegar tak samo jak przeszkoda.

---

## 4. „Niezwłocznie" znaczy krócej niż siedem dni

Siedem dni to **termin maksymalny**, nie docelowy. Ustawa nakazuje działać niezwłocznie, a termin
siedmiodniowy tylko domyka ten obowiązek od góry.

**Konsekwencja dla UI:** kolejka spraw pokazuje dwie wartości — **cel wewnętrzny** (proponuję 3 dni
robocze, do ustalenia w regulaminie) i **termin ustawowy**. Wyróżnienie kolorem zaczyna się przy
przekroczeniu celu, nie przy zbliżaniu się do siódmego dnia.

To samo dotyczy zawiadomień z § 7 — „niezwłocznie" oznacza bez zbędnej zwłoki, czyli w praktyce
w tym samym dniu roboczym. Nasze zawiadomienia generują się automatycznie przy wpisie, więc ten
wymóg jest spełniony z definicji — warto to odnotować jako przewagę nad obiegiem mailowym.

Notariusz jako podmiot prowadzący rejestr ma **legitymację do wezwania do usunięcia przeszkody** —
wezwanie nie jest uprzejmością, tylko czynnością w procedurze. Stąd wymóg, by miało własny szablon
i datę, od której liczy się wznowiony bieg terminu.

---

## 5. Dlaczego append-only i łańcuch skrótów to realizacja ustawy

Ustawa dopuszcza prowadzenie rejestru **w formie rozproszonej i zdecentralizowanej bazy danych** —
i uzasadnienie projektu wprost wskazywało, że chodzi o dopuszczenie technologii rozproszonego
rejestru. Opis, którym posłużono się w pracach legislacyjnych, to dokładnie: bloki rekordów,
znacznik czasu, odesłanie do poprzedniego bloku w postaci skrótu jego zawartości — dzięki czemu
zmiana wcześniejszego zapisu bez przepisania całej historii jest niemożliwa.

**Nasza architektura (tabela zdarzeń append-only + skrót każdego zdarzenia obejmujący skrót
poprzedniego) realizuje dokładnie ten model, bez rozproszenia.** Obowiązek z art. 300³¹ § 4
— zapewnienie bezpieczeństwa i integralności — nie jest w ustawie zdefiniowany, więc to my
definiujemy, jak go spełniamy. Warto mieć to zapisane, bo:

- to uzasadnienie architektury wobec klienta i wobec izby,
- to argument sprzedażowy wobec domów maklerskich, które prowadzą rejestry w klasycznych bazach
  z możliwością edycji wstecz,
- to odpowiedź na pytanie audytowe „skąd wiadomo, że rejestr nie był zmieniany".

**Jeden rejestr = jeden podmiot prowadzący.** Rejestr prowadzi się **dla spółki**, nie dla
poszczególnych akcjonariuszy, a prowadzenie rejestru jednej spółki przez więcej niż jeden podmiot
zagrażałoby jego integralności. Stąd walidacja: spółka może mieć w systemie **dokładnie jedną**
aktywną umowę o prowadzenie rejestru.

---

## 6. Notariusz jako podmiot prowadzący rejestr — Prawo o notariacie

⚠️ Numeracja do potwierdzenia w aktualnym tekście; treść zgodna w obu źródłach.

- **Prowadzenie rejestru akcjonariuszy P.S.A. i czynności z tym związane to odrębna czynność
  notarialna** (katalog czynności notarialnych). Nie jest to działalność poboczna — to czynność
  z ustawowego katalogu.
- **Notariusz może, ale nie musi** zawrzeć umowę. Przy odmowie ma obowiązek **pisemnie
  poinformować spółkę**, jeżeli zwróciła się w formie dokumentowej lub pisemnej.
- **Nie stosuje się przepisów o odmowie dokonania czynności notarialnej ani o obowiązku
  stwierdzenia tożsamości.** Istnieją zatem dwa odrębne tryby odmowy: notarialny (dla czynności
  klasycznych) i rejestrowy (art. 300³⁴ § 7). **Nie mieszać ich w kodzie ani w szablonach.**
- **Tajemnica notarialna jest uchylona w zakresie wydawania informacji z rejestru** spółce
  i każdemu akcjonariuszowi. Bez tego wyłączenia portal byłby niemożliwy.
- **Zastępca notariusza wyznaczony przez prezesa rady izby albo przez radę izby jest upoważniony
  do czynności z zakresu prowadzenia rejestru.** To odpowiedź na decyzję 3 w `CLAUDE-PSA.md`:
  zastępstwo obejmuje czynności rejestrowe z mocy wyznaczenia.
- **Zaprzestanie prowadzenia kancelarii:** notariusz przekazuje dokumenty czynności rejestrowych
  **wraz z rejestrem** radzie właściwej izby notarialnej; prezes rady niezwłocznie zawiadamia
  spółkę; po zawarciu przez spółkę nowej umowy prezes przekazuje dokumenty nowemu podmiotowi
  prowadzącemu rejestr. **Nie stosuje się przekazania do archiwum sądu rejonowego.**

**Konsekwencja krytyczna dla architektury:** rejestr musi dać się **wyeksportować w całości wraz
z dokumentacją** w formie nadającej się do przekazania izbie i odczytania przez inny podmiot.
Nie jest to funkcja „na wszelki wypadek" — to ustawowy scenariusz. Format eksportu (rejestr +
łańcuch zdarzeń + pliki + raport integralności) należy zaprojektować tak, by był czytelny bez
naszej aplikacji.

---

## 7. AML — definicja klienta jest zawężona

**To jest najważniejsze uproszczenie operacyjne z całej analizy.**

Notariusz jest instytucją obowiązaną także w zakresie prowadzenia rejestru akcjonariuszy. Ale
w przypadku umowy o prowadzenie rejestru P.S.A. **za klienta uważa się wyłącznie akcjonariusza,
zastawnika lub użytkownika akcji podlegającego wpisowi do rejestru w związku z transakcją
stanowiącą podstawę wpisu**.

**Konsekwencje:**
- **Nie prowadzimy KYC spółki** ani członków jej zarządu przy zawieraniu umowy o prowadzenie
  rejestru.
- **Nie prowadzimy KYC wszystkich akcjonariuszy** przy otwarciu rejestru — tylko tych, którzy
  podlegają wpisowi w związku z transakcją.
- Bramka AML uruchamia się **przy zdarzeniach transakcyjnych** (przeniesienie, obciążenie,
  ustanowienie prawa głosu zastawnika), a nie przy zdarzeniach ewidencyjnych (zmiana adresu,
  wzmianka o pokryciu, zajęcie z urzędu).
- Profil AML jest trwały przy osobie (kartoteka wspólna), więc kolejna transakcja tej samej osoby
  nie wymaga powtórzenia procedury, o ile dane nie zdezaktualizowały się.

⚠️ Zakres i częstotliwość stosowania środków bezpieczeństwa finansowego — do potwierdzenia przy
tekście ustawy AML. Powyższe zawężenie definicji klienta potwierdzają oba źródła, ale **przed
zakodowaniem bramki trzeba je zweryfikować w ustawie.**

---

## 8. Umowa o prowadzenie rejestru — obowiązkowa treść

Z opracowań wynika lista postanowień, które umowa powinna zawierać. To jest gotowy brief dla
szablonu generowanego przez aplikację:

1. **Ważne powody uzasadniające wypowiedzenie przez notariusza** — ustawa dopuszcza wypowiedzenie
   tylko z ważnych powodów, więc bez ich zdefiniowania w umowie wyjście z relacji jest sporne.
2. **Terminy płatności wynagrodzenia** za czynności rejestrowe.
3. **Wzór rejestru i techniczny sposób jego prowadzenia** — czyli opis naszej aplikacji jako
   narzędzia; tu wchodzi opis mechanizmu integralności z sekcji 5.
4. **Sposób i termin przechowywania dokumentów** stanowiących podstawę wpisu.
5. **Skutki wypowiedzenia**, w szczególności przekazanie dokumentacji i samego rejestru.

Punkty 3–5 to jednocześnie **wymagania funkcjonalne**: opis techniczny musi odpowiadać temu, co
aplikacja robi, a punkt 5 wymaga działającego eksportu (sekcja 6).

---

## 9. Anatomia akcji P.S.A. — czego nie wolno przenieść ze spółki akcyjnej

| Cecha | P.S.A. | Skutek dla modelu |
|---|---|---|
| Wartość nominalna | **brak** | nie ma pola „wartość nominalna"; jest **cena emisyjna** |
| Relacja do kapitału | akcje **nie stanowią części kapitału akcyjnego** | procent udziału liczymy z liczby akcji, nie z kapitału |
| Podzielność | akcje **niepodzielne**, ale dopuszczalne **ułamkowe części akcji** | ułamek przypisany do numeru akcji, nie do puli |
| Podział na imienne / na okaziciela | **nie istnieje** | żadnego pola „rodzaj akcji: imienne / na okaziciela" |
| Kapitał akcyjny | min. **1 zł**, **nie jest określany w umowie spółki**, zmiana bez zmiany umowy | poza zakresem rejestru — nie ewidencjonujemy |
| Wkłady | dopuszczalne **świadczenie pracy lub usług**; taki wkład **nie zasila kapitału akcyjnego** | rodzaj wkładu wpływa na pokrycie i na dziedziczenie (art. 300⁴¹ § 2) |
| Termin wniesienia wkładów | **3 lata** od wpisu spółki do KRS; zarząd podejmuje uchwałę stwierdzającą wniesienie | uchwała = podstawa wpisu wzmianki o pokryciu |
| Rodzaje uprzywilejowania | akcje **uprzywilejowane**, **założycielskie**, **nieme**, **uprawnienia indywidualne akcjonariuszy** | to jest słownik pola `rodzaj_akcji` + katalog uprawnień |
| Obrót zorganizowany | **wykluczony** | brak integracji giełdowych, brak ISIN |

**Umowa spółki P.S.A. musi zawierać** liczbę, serie i numery akcji, związane z nimi
uprzywilejowanie, akcjonariuszy obejmujących poszczególne akcje oraz cenę emisyjną; przy wkładach
niepieniężnych — przedmiot wkładu, serie i numery akcji obejmowanych za wkład i obejmujących je
akcjonariuszy; przy pracy lub usługach — **rodzaj i czas świadczenia**.

→ To znaczy, że **umowa spółki jest kompletnym źródłem stanu otwarcia rejestru.** Kreator „stan
otwarcia" powinien być prowadzony wprost po strukturze umowy spółki, a nie po dowolnym formularzu.

---

## 10. Ułamkowe części akcji i współuprawnieni

Komentarz do art. 300⁴³ jest lakoniczny — przepisy o rozporządzaniu stosuje się odpowiednio do
ułamkowych części akcji, bez dalszego rozwinięcia. Doktryna potwierdza za to, że **ograniczenie
rozporządzania może dotyczyć zarówno akcji, jak i jej ułamkowej części**, a prawo pierwszeństwa
może obejmować ułamkową część akcji.

**Wnioski dla implementacji** (nasze, nie z opracowań — do świadomego przyjęcia):
- ułamek dziedziczy wszystkie ograniczenia całej akcji (zgoda spółki, pierwszeństwo, obciążenia),
- prawo pierwszeństwa musi umieć operować na ułamku,
- współuprawnieni wykonują prawa **przez wspólnego przedstawiciela** i odpowiadają solidarnie;
  gdy przedstawiciela nie wskazano, spółka może składać oświadczenia wobec któregokolwiek z nich
  — więc brak przedstawiciela **nie blokuje wpisu**, ale musi być widoczny w rejestrze,
- głos przypada **na akcję**, nie na ułamek.

---

## 11. Pozostałe reguły warte odwzorowania

**Umorzenie akcji** stanowi zmianę umowy spółki. Umorzenie **dobrowolne** jest możliwe nawet bez
upoważnienia w umowie spółki; **przymusowe** wymaga wyraźnej podstawy w umowie. Praktyka:
jedna uchwała obejmująca umorzenie i zmianę umowy spółki. → checklista typu `umorzenie` różnicuje
się w zależności od trybu.

**Zgoda spółki na zbycie** (art. 300³⁹): jeżeli umowa spółki uzależnia zbycie od zgody, ale **nie
określa terminu wskazania innego nabywcy, ceny ani terminu zapłaty — akcja może być zbyta bez
ograniczenia**. → walidacja ograniczeń musi sprawdzać kompletność postanowienia, nie tylko jego
istnienie. Termin na wskazanie nabywcy: **nie dłuższy niż miesiąc**.

**Skutki braku wpisu**: wobec spółki za akcjonariusza (zastawnika, użytkownika) uważa się wyłącznie
osobę wpisaną do rejestru. Niedopełnienie wpisu praktycznie wyklucza wykonywanie praw. → to jest
treść, którą warto umieścić w zawiadomieniu o wpisie i w wezwaniu do uzupełnienia; podnosi
skuteczność wezwań.

**Odpowiedzialność zarządu**: za dopuszczenie do nieprowadzenia rejestru grozi grzywna do 20 000 zł
nakładana przez sąd rejestrowy; orzecznictwo wiąże ją z zaniechaniem, przy czym część doktryny
dopuszcza też winę nieumyślną. → argument w komunikacji ze spółkami, które zwlekają z zawarciem
umowy albo z aktualizacją danych.

---

## 12. Co z tego wynika — zmiany do wprowadzenia

| Wniosek | Gdzie |
|---|---|
| Trzy kategorie danych rejestru — formularze i model | `CLAUDE-PSA.md` sekcja 5–6 |
| Lista uprawnionych do żądania wpisu jako słownik | katalog typów zdarzeń, krok 1 kreatora |
| Stan sprawy **„spór"** + szablon zawiadomienia | maszyna stanów, sekcja 7 |
| Cel wewnętrzny 3 dni obok terminu ustawowego 7 dni | kolejka spraw, `terminy.js` |
| „Dokument" wg art. 77³ k.c. — skan wystarcza | checklisty weryfikacji |
| Ograniczenia z umowy spółki wczytywane przy przyjęciu spółki | kreator dodawania spółki |
| **AML tylko wobec strony transakcji**, nie wobec spółki i nie wobec wszystkich akcjonariuszy | bramka AML, sekcja 4 reguł domenowych |
| **Eksport rejestru + dokumentacji do przekazania izbie** jako funkcja ustawowa | nowy element sprintu 7 |
| Dokładnie jedna aktywna umowa o prowadzenie rejestru na spółkę | walidacja |
| Zastępca upoważniony do czynności rejestrowych z mocy wyznaczenia | model uprawnień, decyzja 3 |
| Słownik `rodzaj_akcji`: uprzywilejowane / założycielskie / nieme / z uprawnieniami indywidualnymi | `psa_emisje` |
| Kompletność postanowienia o zgodzie spółki (brak ceny/terminu → brak ograniczenia) | walidacja ograniczeń |
| Kreator „stan otwarcia" prowadzony po strukturze umowy spółki | UI |
| Uzasadnienie architektury integralności w umowie i materiałach ofertowych | szablon umowy, oferta |

---

## 13. Pytania otwarte

1. **Cel wewnętrzny terminu** — 3 dni robocze czy inna wartość. Wpływa na kolorystykę kolejki
   i na obietnicę składaną klientowi w umowie.
2. **Zakres AML** — potwierdzić w ustawie zawężoną definicję klienta oraz częstotliwość
   aktualizacji środków bezpieczeństwa finansowego przy powtarzających się transakcjach.
3. **Format eksportu rejestru do przekazania izbie** — czy projektujemy go teraz, czy dopiero gdy
   będzie potrzebny. Rekomendacja: teraz, bo jest to argument w umowie i w ofercie.
4. **Dane dodatkowe z umowy spółki** — czy przyjmujemy spółki, których umowa żąda danych spoza
   naszego modelu, i jak je wtedy obsługujemy (pole swobodne vs odmowa zawarcia umowy).
5. **Zakres danych osobowych w informacji z rejestru** — do przemyślenia szerzej. Dziś dokument
   pokazuje adres akcjonariusza, a wobec innego akcjonariusza zasłania go zgodnie z art. 300³⁵
   § 1¹ KSH. Pytanie postawione przez kancelarię: skoro PESEL i adres i tak są maskowane, może
   w ogóle usunąć te pozycje z informacji?

   Co trzeba rozstrzygnąć, zanim to zrobimy:
   - § 1¹ ogranicza dostęp **tylko pozostałym akcjonariuszom**. Spółka (§ 1) oraz sąd, prokurator,
     komornik i administracyjny organ egzekucyjny (§ 4) mają prawo do pełnych danych — usunięcie
     kolumn dla wszystkich odebrałoby im to, do czego są uprawnieni;
   - art. 300³⁵ § 3 **nie określa treści** samej informacji, więc nie ma przeszkody, żeby wydawać
     ją w zakresie węższym niż rejestr. Do ustalenia: zakres domyślny i zakres na żądanie;
   - RODO (minimalizacja) przemawia za tym, żeby akcjonariuszowi nie wysyłać nawet zasłoniętych
     rubryk cudzych danych — pusta rubryka „adres" i tak mówi, że adres w rejestrze jest;
   - kontrargument: informacja ma dowodzić **stanu rejestru**. Brak rubryki i zasłonięta rubryka
     znaczą co innego, a wypis bez adresów może nie wystarczyć spółce do doręczeń.

   Możliwy kierunek do sprawdzenia: kolumna znika, gdy odbiorca nie ma prawa do **żadnej** wartości
   w niej (dziś: akcjonariusz), a zostaje w całości tam, gdzie prawo do danych jest pełne. Wtedy
   wypis dla akcjonariusza w ogóle nie wspomina o cudzych adresach, a wypis dla spółki i organu
   zostaje bez zmian. Wymaga decyzji, czy „węższy wypis" nie podważa jego mocy dowodowej.
