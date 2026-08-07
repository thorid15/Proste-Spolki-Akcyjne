# Przepisy dla modułu Rejestr akcjonariuszy P.S.A. — plik referencyjny

> **To jest jedyne źródło prawne modułu.** Każda reguła w `server/logika/przepisy.js` musi
> wskazywać jednostkę redakcyjną z tego pliku i dać się przy nim zweryfikować wprost.
>
> **Zakaz opierania się na opracowaniach branżowych.** Dotychczasowe błędy w specyfikacji wzięły
> się z artykułów kancelarii opisujących zmiany w **spółce akcyjnej**, mechanicznie przeniesione
> na P.S.A. Sekcja 12 wymienia te przepisy, których w P.S.A. **nie ma** — czytać przed każdym
> dopisaniem nowej reguły.
>
> **Źródło:** tekst ustawy z 15.09.2000 r. — Kodeks spółek handlowych, wydruk z 06.08.2026,
> z przypisami oznaczającymi przepisy niewchodzące jeszcze w życie. Weryfikowane 1:1 z tekstem,
> nie z omówieniami.

**Legenda:**
🟢 obowiązuje · 🔵 wchodzi w życie **18.02.2027** (ustawa z 23.01.2026, Dz.U. 2026 poz. 176)
⚠️ nie pochodzi z tego wydruku — wymaga weryfikacji przez Łukasza

---

## 1. Rejestr akcjonariuszy — rdzeń (Oddział 2 „Forma akcji")

### 🟢 Art. 300²⁹ — forma akcji
§ 1. Akcje nie mają formy dokumentu.
§ 2. Przepisy o akcjach stosuje się odpowiednio do warrantów subskrypcyjnych i innych tytułów
uczestnictwa w dochodach lub podziale majątku spółki.

### 🟢 Art. 300³⁰ — objęcie akcji, wpis
§ 1. Akcje podlegają zarejestrowaniu w rejestrze akcjonariuszy.
§ 2. **W przypadku objęcia akcji wpis do rejestru akcjonariuszy następuje po wpisie spółki do
rejestru albo wpisie do rejestru nowej emisji akcji.**

→ *Blokada systemowa.* Emisja bez `data_wpisu_krs` nie może przyjąć wpisu akcji. Sankcja: art.
592 § 3 (sekcja 10).

### 🟢 Art. 300³¹ — zadania podmiotu prowadzącego rejestr
§ 1. Rejestr akcjonariuszy prowadzi: 1) podmiot uprawniony do prowadzenia rachunków papierów
wartościowych; 2) **notariusz prowadzący kancelarię notarialną na terytorium RP**.
§ 2. Do zadań podmiotu prowadzącego rejestr należy **zapewnienie zgodności liczby akcji
zarejestrowanych w rejestrze z liczbą wyemitowanych akcji** oraz dokonywanie wpisów zmian danych,
o których mowa w art. 300³³.
§ 3. Rejestr jest prowadzony w postaci elektronicznej, która może mieć formę rozproszonej
i zdecentralizowanej bazy danych.
§ 4. Niezależnie od formy rejestru, podmiot prowadzi go w sposób, który **zapewnia bezpieczeństwo
i integralność** zawartych w nim danych.
§ 5. Wybór podmiotu prowadzącego rejestr wymaga uchwały akcjonariuszy. Przy zawiązaniu spółki
wyboru dokonują akcjonariusze.

→ § 2 to podstawa niezmiennika bilansu. § 4 to podstawa append-only + łańcucha skrótów.

### Art. 300³² — umowa o prowadzenie rejestru
🟢 § 1. Spółka jest obowiązana do niezwłocznego zawarcia umowy o prowadzenie rejestru
akcjonariuszy z podmiotem wybranym zgodnie z art. 300³¹ § 5.

🔵 § 1¹. Zarząd zgłasza zawarcie umowy do sądu rejestrowego.

🔵 § 1². Zgłoszenie zawiera, w przypadku zawarcia umowy z notariuszem prowadzącym kancelarię
notarialną na terytorium RP — **imię i nazwisko notariusza oraz siedzibę i adres jego kancelarii,
a jeżeli umowę zawarła osoba wyznaczona do zastępstwa notariusza albo upoważniona do dokonywania
czynności notarialnych — ponadto imię i nazwisko tej osoby.**

🔵 § 1³. Do zgłoszenia należy dołączyć **oświadczenie zarządu potwierdzające zawarcie umowy**.

🟢 § 2. Rozwiązanie przez spółkę umowy jest dopuszczalne **jedynie pod warunkiem zawarcia nowej
umowy** o prowadzenie rejestru. Rozwiązanie umowy przez podmiot prowadzący rejestr jest
dopuszczalne jedynie z ważnych powodów, z zachowaniem terminu wypowiedzenia **nie krótszego niż
trzy miesiące**.

🔵 § 3. Podmiot prowadzący rejestr **zawiadamia sąd rejestrowy za pośrednictwem systemu
teleinformatycznego** o wygaśnięciu albo rozwiązaniu umowy, **ze wskazaniem daty** jej wygaśnięcia
albo rozwiązania, **w terminie siedmiu dni** od tej daty.

→ § 1² potwierdza, że umowę może zawrzeć **zastępca notariusza albo osoba upoważniona do
dokonywania czynności notarialnych** — z obowiązkiem ujawnienia jej danych. System musi
przechowywać, kto konkretnie zawarł umowę.
→ § 3 to **drugi zegar ustawowy** w module, obok terminu wpisu.

### Art. 300³³ — zakres informacji w rejestrze
🟢 § 1. Rejestr akcjonariuszy zawiera:
1. firmę, siedzibę i adres spółki;
2. oznaczenie sądu rejestrowego i numer, pod którym spółka jest wpisana do rejestru;
3. **datę zarejestrowania spółki i emisji akcji**;
4. **serię i numer, rodzaj danej akcji i uprawnienia szczególne z akcji**;
5. nazwisko i imię albo firmę (nazwę) akcjonariusza oraz adres jego zamieszkania albo siedziby
   albo inny adres do doręczeń albo adres do doręczeń elektronicznych, a także **adres poczty
   elektronicznej, jeżeli akcjonariusz wyraził zgodę** na komunikację ze spółką i podmiotem
   prowadzącym rejestr przy wykorzystaniu poczty elektronicznej;
6. **na żądanie osoby mającej interes prawny** — wpis o przejściu akcji lub praw zastawniczych na
   inną osobę albo o ustanowieniu na akcji ograniczonego prawa rzeczowego, wraz z datą wpisu,
   wskazaniem nabywcy albo zastawnika lub użytkownika, ich adresów (w tym e-mail, jeżeli wyrazili
   zgodę) oraz liczby, rodzaju, serii i numerów nabytych albo obciążonych akcji;
7. **na żądanie zastawnika albo użytkownika** — wpis, że przysługuje mu prawo wykonywania prawa
   głosu z obciążonej akcji;
8. **na żądanie akcjonariusza** — wpis o wykreśleniu obciążenia jego akcji ograniczonym prawem
   rzeczowym;
9. **wzmiankę o tym, czy akcje zostały w całości pokryte**;
10. ograniczenia co do rozporządzania akcją;
11. postanowienia umowy spółki o związanych z akcją obowiązkach wobec spółki.

🟢 § 2. **Umowa spółki może zawierać dodatkowe postanowienia dotyczące informacji ujawnianych
w rejestrze akcjonariuszy.**

🔵 § 3. Wszelkie zmiany danych, o których mowa w **§ 1 pkt 1–4 oraz 9–11**, zarząd zgłasza
**podmiotowi prowadzącemu rejestr akcjonariuszy** w terminie **siedmiu dni** od dnia wystąpienia
zdarzenia uzasadniającego dokonanie wpisu.

→ **UWAGA — wcześniejszy błąd specyfikacji:** § 3 kieruje zgłoszenie **do nas**, nie do KRS.
To nowy, obowiązkowy strumień przychodzący od 2027. Sankcja wobec zarządu: art. 594 § 1 pkt 2¹.
→ pkt 6–8 są **wnioskowe** („na żądanie"), a nie z urzędu — wpływa na katalog typów spraw.
→ pkt 9 i 11 nie są dziś odwzorowane w modelu danych (patrz `CLAUDE-PSA.md`, sprint 5).

### Art. 300³⁴ — dokonywanie wpisów
🟢 § 1. Podmiot prowadzący rejestr dokonuje wpisu **na żądanie spółki lub innej osoby mającej
interes prawny** w dokonaniu wpisu, niezwłocznie, ale **nie później niż w terminie siedmiu dni
od dnia otrzymania żądania**. Jeżeli dokonanie wpisu wymaga **usunięcia przeszkody**, wpis powinien
być dokonany w terminie **siedmiu dni od dnia jej usunięcia**.

🟢 § 2. W przypadku zajęcia praw majątkowych akcjonariusza przez komornika sądowego (art. 911³ § 2
k.p.c.), przekazania zawiadomienia przez organ egzekucyjny (art. 95a pkt 2 lit. b u.p.e.a.) albo
wniosku w trybie art. 95f § 2 tej ustawy — **ujawnienie zajęcia następuje z urzędu i jest wolne
od opłat**.

🟢 § 3. **Przed wpisem**, z wyłączeniem przypadku z § 2, podmiot prowadzący rejestr **powiadamia
o treści zamierzonego wpisu osobę, której uprawnienia mają być wykreślone, zmienione lub obciążone**
przez wpis, **chyba że wyraziła ona zgodę na wpis**.

🟢 § 4. Osoba żądająca wpisu jest obowiązana przedłożyć dokumenty uzasadniające dokonanie wpisu.
**Podstawę dokonania wpisu stanowi także oświadczenie akcjonariusza o zobowiązaniu do przeniesienia
akcji albo obciążenia akcji ograniczonym prawem rzeczowym.**

🟢 § 5. Podmiot prowadzący rejestr **bada treść i formę** dokumentów uzasadniających dokonanie
wpisu. **Nie ma obowiązku badania zgodności z prawem oraz prawdziwości** dokumentów, w tym podpisów
zbywcy akcji lub osób ustanawiających ograniczone prawo rzeczowe, **chyba że poweźmie w tym
względzie uzasadnione wątpliwości**.

🟢 § 6. Przy dokonywaniu wpisów podmiot prowadzący rejestr **uwzględnia ograniczenia co do
rozporządzania akcją**.

🟢 § 7. O dokonanym wpisie podmiot prowadzący rejestr **niezwłocznie powiadamia osobę żądającą
wpisu oraz spółkę**. W przypadku **niedokonania wpisu** — niezwłocznie powiadamia osobę żądającą,
**podając przyczyny**.

🟢 § 8. Po otrzymaniu powiadomienia z § 7 zdanie pierwsze **zarząd niezwłocznie składa do sądu
rejestrowego podpisaną przez wszystkich członków zarządu nową listę akcjonariuszy** z podaniem
nazwiska i imienia albo firmy (nazwy) oraz liczby i serii akcji posiadanych przez każdego z nich
oraz **wzmianką o ustanowieniu zastawu lub użytkowania** na akcjach.

🔵 § 9. Powiadomienia z § 3 zd. 1 oraz § 7 zd. 1 **mogą być automatycznie przesyłane na żądanie
ich adresata za pośrednictwem systemu teleinformatycznego podmiotu prowadzącego rejestr
akcjonariuszy na konto adresata w tym systemie** lub wskazany przez niego adres poczty
elektronicznej, adres do doręczeń elektronicznych albo inny adres umożliwiający odbiór
korespondencji w postaci elektronicznej.

→ § 8 to źródło funkcji „lista akcjonariuszy do KRS" generowanej razem z zawiadomieniem o wpisie.
→ § 9 jest **ustawową podstawą portalu**: ustawodawca zakłada system teleinformatyczny podmiotu
prowadzącego rejestr z kontami adresatów. Wymaga przechowywania **żądania adresata** per osoba
i per kanał.
→ **UWAGA — wcześniejszy błąd specyfikacji:** § 3 **nie zawiera** wymogów formy zgody (podpis
notarialnie poświadczony / w obecności osoby upoważnionej / podpis kwalifikowany, zaufany, osobisty).
To regulacja dla spółki akcyjnej. W P.S.A. zgoda podlega ogólnym regułom.

### Art. 300³⁵ — jawność rejestru
🟢 § 1. Rejestr akcjonariuszy jest **jawny dla spółki i każdego akcjonariusza**.
🔵 § 1¹. **Informacji o numerze PESEL, dacie urodzenia ani adresie zamieszkania akcjonariusza nie
udostępnia się pozostałym akcjonariuszom.**
🟢 § 2. Podmioty z § 1 mają prawo dostępu do danych zawartych w rejestrze **za pośrednictwem
podmiotu prowadzącego rejestr**.
🟢 § 3. Podmioty z § 1 mają prawo żądać wydania, **w postaci papierowej lub elektronicznej**,
informacji z rejestru akcjonariuszy.
🔵 § 4. Przepisy § 1, 2 i 3 stosuje się odpowiednio do **sądów, prokuratury, komorników sądowych
oraz administracyjnych organów egzekucyjnych w związku z toczącymi się przed nimi postępowaniami**.

→ § 1¹ ogranicza dostęp **innych akcjonariuszy** — spółka i organy z § 4 dostają pełne dane.
→ § 3 obejmuje także **postać papierową** — osobny typ sprawy.
→ § 4 wiąże dostęp organu z **toczącym się postępowaniem** → obowiązek zapisania sygnatury.

---

## 2. Akcje, ułamki, pokrycie

### 🟢 Art. 300² § 3
Akcje **nie posiadają wartości nominalnej, nie stanowią części kapitału akcyjnego i są
niepodzielne**.

### 🟢 Art. 300⁴³
Przepisy oddziału o rozporządzaniu akcją **stosuje się odpowiednio do ułamkowych części akcji**.

→ **Rozstrzygnięcie napięcia:** akcji nie da się podzielić na mniejsze akcje (300² § 3), ale można
być uprawnionym do **ułamka jednej, oznaczonej numerem akcji** i tym ułamkiem rozporządzać
(300⁴³). Stąd model: ułamek zawsze przypisany do pojedynczego numeru akcji, nigdy do „ilości".

### 🟢 Art. 300⁹ — wkłady
§ 1. Wkłady powinny zostać wniesione do spółki w całości **w ciągu trzech lat od dnia wpisu spółki
do rejestru**.
§ 2. Zarząd **podejmuje niezwłocznie uchwałę stwierdzającą wniesienie w całości wkładu** przez
akcjonariusza.
§ 3. Wkłady wniesione do spółki powinny być **zaliczane równomiernie na pokrycie wszystkich akcji
akcjonariusza**, chyba że umowa spółki stanowi inaczej.

→ § 2 daje dokument będący podstawą wpisu wzmianki o pokryciu (300³³ § 1 pkt 9).
→ § 3 określa domyślny algorytm zaliczania — pokrycie rozkłada się równomiernie na wszystkie akcje
akcjonariusza, nie „od najniższego numeru".

### 🟢 Art. 300²³ — prawo głosu
§ 1. **Akcja daje prawo do jednego głosu.**
§ 2. Zastawnik i użytkownik akcji mogą wykonywać prawo głosu, jeżeli **przewiduje to czynność
prawna ustanawiająca ograniczone prawo rzeczowe** oraz gdy w rejestrze **dokonano wzmianki o jego
ustanowieniu i upoważnieniu do wykonywania prawa głosu**, chyba że **umowa spółki zakazuje**
przyznawania prawa głosu zastawnikowi lub użytkownikowi albo **uzależnia je od zgody organu
spółki**.

→ Głos liczy się **per akcja**, nie per ułamek — przy akcji dzielonej ułamkowo głos przypada raz.
→ Wpis prawa głosu zastawnika wymaga sprawdzenia, czy umowa spółki go nie wyłącza.

---

## 3. Rozporządzanie akcją (Oddział 3)

### 🟢 Art. 300³⁶
§ 1. Akcje są zbywalne.
§ 2. Akcje nie mogą być dopuszczane ani wprowadzane do obrotu zorganizowanego.
§ 4. **Zbycie lub obciążenie akcji powinno być dokonane w formie dokumentowej pod rygorem
nieważności.**

### 🟢 Art. 300³⁷ — chwila nabycia
§ 1. **Nabycie akcji albo ustanowienie na niej ograniczonego prawa rzeczowego następuje z chwilą
dokonania w rejestrze akcjonariuszy wpisu** wskazującego nabywcę albo zastawnika albo użytkownika,
liczbę oraz rodzaj, serie i numery nabytych albo obciążonych akcji.

§ 2. **Przepisu § 1 nie stosuje się w przypadku:** objęcia akcji (z wyjątkiem art. 300¹¹⁸),
powołania do spadku, zapisu windykacyjnego, wniesienia akcji jako wkładu niepieniężnego do spółki,
połączenia, podziału lub przekształcenia spółki, **lub zajścia innego zdarzenia prawnego
powodującego z mocy prawa przejście akcji** lub ustanowionego na niej ograniczonego prawa
rzeczowego na inną osobę. Przepis art. 300³⁸ § 1 stosuje się.

→ **Wpis konstytutywny vs deklaratoryjny.** W przypadkach z § 2 prawo przechodzi poza rejestrem,
a wpis tylko ujawnia stan istniejący. Inne skutki opóźnienia, inna treść zawiadomienia, inna
checklista.

### 🟢 Art. 300³⁸ — akcjonariusz i współuprawnieni
§ 1. **Wobec spółki uważa się za akcjonariusza tylko tę osobę, która jest wpisana do rejestru.**
§ 2. Stosuje się odpowiednio do zastawnika lub użytkownika.
§ 3. **Współuprawnieni z akcji wykonują swoje prawa w spółce przez wspólnego przedstawiciela.**
Za świadczenia związane z akcją **odpowiadają solidarnie**.
§ 4. Jeżeli współuprawnieni nie wskazali wspólnego przedstawiciela, **oświadczenia spółki mogą być
dokonywane wobec któregokolwiek z nich**.

→ Przy akcji dzielonej ułamkowo rejestr powinien prowadzić pole **wspólnego przedstawiciela**.

### 🟢 Art. 300³⁹ — zgoda spółki na zbycie
§ 1. Umowa spółki może uzależnić rozporządzenie akcją od zgody spółki lub w inny sposób je
ograniczyć.
§ 3. Jeżeli spółka odmawia zgody, powinna wskazać innego nabywcę; termin do wskazania nabywcy
**nie może być dłuższy niż miesiąc** od zgłoszenia zamiaru zbycia.
§ 4. Czynności dokonuje zarząd **w formie dokumentowej** pod rygorem nieważności.
§ 6. **Zbycie akcji w postępowaniu egzekucyjnym nie wymaga zgody spółki.**

### 🟢 Art. 300⁴⁰ — akcje nie w pełni pokryte
§ 1. **Zbycie akcji nie w pełni pokrytej wymaga zgody spółki** aż do chwili wniesienia wkładu
w całości. Zgoda wymaga **formy dokumentowej** pod rygorem nieważności, chyba że umowa spółki
stanowi inaczej.
§ 2. Spółka może odmówić zgody **bez wskazania innego nabywcy**. Udzielenie albo odmowa następuje
**w terminie czternastu dni** od zgłoszenia zamiaru zbycia. Spółka niezwłocznie informuje nabywcę
o braku pełnego pokrycia akcji.
§ 3. **Nabywca akcji nie w pełni pokrytej odpowiada wobec spółki solidarnie ze zbywcą** za
wniesienie pozostałej części wkładu.

→ Reguła blokująca, zależna od pkt 9 art. 300³³. Bez pola pokrycia nie da się jej wyegzekwować.

### 🟢 Art. 300⁴¹ — spadkobiercy
§ 2. W razie śmierci akcjonariusza uprawnionego z akcji objętych **za wkład w postaci pracy lub
usług**, który nie został w całości wniesiony, wstąpienie spadkobierców **wymaga zgody spółki**,
chyba że umowa spółki stanowi inaczej.
§ 3. Umowa spółki może **wyłączyć lub ograniczyć podział akcji między spadkobierców**.

### 🟢 Art. 300⁴² — prawo pierwszeństwa
§ 1–7. Umowa spółki może przewidywać prawo pierwszeństwa pozostałych akcjonariuszy. Oferta
i oświadczenia w **formie dokumentowej**; termin na przyjęcie oferty **nie krótszy niż czternaście
dni**. Zarząd wyraża zgodę na zbycie, jeżeli spełniono wymogi § 3–5 albo złożono oświadczenia
o rezygnacji (§ 6).

---

## 4. Umorzenie i unieważnienie akcji

### 🟢 Art. 300⁴⁴
§ 1. Akcja może być umorzona **za zgodą akcjonariusza (dobrowolne) albo bez jego zgody
(przymusowe)**.
§ 2. **Umorzenie akcji stanowi zmianę umowy spółki.**
§ 3. Od chwili uiszczenia spłaty za akcje podlegające umorzeniu dobrowolnemu akcjonariusz nie może
wykonywać z nich praw udziałowych.

### 🟢 Art. 300⁴⁵ § 2
Umorzenie przymusowe następuje za spłatą nie niższą od wartości godziwej. **Spółka uiszcza spłatę
po dokonaniu wpisu umorzenia akcji do rejestru.**

### 🟢 Art. 300⁵¹ — unieważnienie akcji
Sąd może **unieważnić wszystkie albo niektóre akcje** w przypadku niewykonania lub nienależytego
wykonania zobowiązania do wniesienia wkładów. → osobny typ zdarzenia, podstawa: orzeczenie sądu.

---

## 5. Emisje akcji

### 🟢 Art. 300¹⁰⁴ § 1 — treść uchwały o emisji
Uchwała określa m.in.: **liczbę, serie i numery akcji**; uprzywilejowanie; **cenę emisyjną** lub
upoważnienie do jej oznaczenia; datę, od której akcje uczestniczą w dywidendzie; **terminy i sposób
wnoszenia wkładów**; przedmiot wkładów niepieniężnych i osoby obejmujące za nie akcje; **rodzaj
i czas świadczenia pracy lub usług**, jeżeli to przedmiot wkładu.

### 🟢 Art. 300¹⁰⁷
§ 1. Emisję akcji zarząd zgłasza do rejestru [KRS].
§ 3. **Akcje nowej emisji powstają z chwilą wpisu do rejestru** [KRS].

→ Razem z art. 300³⁰ § 2: bez wpisu emisji do KRS akcje nie istnieją i nie mogą być wpisane
do rejestru akcjonariuszy.

### 🟢 Art. 300¹¹⁷ — warunkowa emisja
§ 1. Osoby uprawnione obejmują akcje **w drodze pisemnego oświadczenia**.
§ 2. Niezwłocznie po otrzymaniu oświadczenia **zarząd wydaje dyspozycję dokonania wpisu akcji do
rejestru akcjonariuszy** zgodnie z uchwałą o warunkowej emisji i treścią wykonanego prawa.

### 🟢 Art. 300¹¹⁸
§ 1. **Wraz z wpisem akcji do rejestru akcjonariuszy następuje nabycie praw z akcji.**
§ 2. W terminie **trzydziestu dni po upływie każdego roku kalendarzowego** zarząd zgłasza do
rejestru [KRS] wykaz akcji objętych w danym roku.

→ Ścieżka ESOP/warranty. Tu wpis **jest** konstytutywny mimo objęcia akcji (wyjątek z art. 300³⁷
§ 2). Podstawą wpisu jest dyspozycja zarządu, nie żądanie akcjonariusza.

---

## 6. Walne zgromadzenie — powiązania z rejestrem

🟢 **Art. 300⁸⁷ § 1.** Walne zgromadzenie zwołuje się **pocztą elektroniczną na adres akcjonariusza
wpisany do rejestru akcjonariuszy**, na adres do doręczeń elektronicznych lub listem poleconym albo
przesyłką kurierską. Zawiadomienie wysyła się co najmniej **dwa tygodnie** przed terminem.

🟢 **Art. 300⁹¹.** Uprawnionym do uczestnictwa w walnym zgromadzeniu jest **osoba wpisana do
rejestru akcjonariuszy w dniu przypadającym na trzy dni przed dniem walnego zgromadzenia**.

🟢 **Art. 300⁹³ § 1.** Zarząd wykłada listę uprawnionych zawierającą dane, **liczbę, serie, numery
i rodzaj akcji oraz liczbę przysługujących głosów**.

→ Adres e-mail w rejestrze ma **skutek doręczeniowy** dla zwołania WZ — to nie pole porządkowe.
→ „Stan na dzień" pokrywa art. 300⁹¹: lista uprawnionych to raport na dzień WZ minus 3 dni.

---

## 7. Likwidacja

🟢 **Art. 300¹²⁰ § 5.** Do likwidacji spółki stosuje się odpowiednio m.in. **art. 476**.

🔵 **Art. 476 § 1¹.** Do wniosku o wykreślenie spółki z rejestru dołącza się **wykaz akcjonariuszy
sporządzony na podstawie informacji z rejestru akcjonariuszy** (odesłanie do art. 328¹³ § 1,
stosowane odpowiednio), zawierający imiona i nazwiska albo firmy, miejsca zamieszkania albo
siedziby, adresy (w tym do doręczeń elektronicznych) oraz **liczbę, serie i numery** posiadanych
akcji.

⚠️ Stosowanie do P.S.A. **przez odesłanie** — przed implementacją potwierdzić, czy nie ma
odrębnej praktyki.

---

## 8. Podmiot prowadzący rejestr jako notariusz — Prawo o notariacie

⚠️ **Cała ta sekcja pochodzi spoza wydruku KSH — do zweryfikowania przy tekście ustawy.**

Rozdział 8a „Rejestr akcjonariuszy prostej spółki akcyjnej":
- **art. 108a** — notariusz *może* zawrzeć ze spółką umowę o prowadzenie rejestru na zasadach
  art. 300³¹–300³⁵ KSH; przy odmowie ma obowiązek **pisemnie poinformować spółkę**, jeżeli zwróciła
  się w formie dokumentowej lub pisemnej;
- **art. 108b** — do czynności związanych z prowadzeniem rejestru **nie stosuje się art. 81–83
  i art. 85** (odmowa dokonania czynności notarialnej; obowiązek stwierdzenia tożsamości).

→ Jeżeli potwierdzone: identyfikacja przy wpisie idzie **wyłącznie reżimem AML**, nie notarialnym.
Nie mieszać tych dwóch ścieżek w kodzie ani w checklistach.

---

## 9. AML i taksa

⚠️ Do zweryfikowania przy tekstach ustaw — poniżej stan przyjęty w projekcie:
- notariusz w zakresie prowadzonego rejestru akcjonariuszy jest **instytucją obowiązaną**;
  brak możliwości zastosowania środków bezpieczeństwa finansowego stanowi **przeszkodę wpisu**,
  a przy jej nieusunięciu — **odmowę wpisu**;
- maksymalne stawki taksy: prowadzenie rejestru **1200 zł** rocznie za każdy rozpoczęty rok,
  wpis **100 zł**, informacja z rejestru **50 zł**.

---

## 10. Sankcje

🟢 **Art. 592 § 3.** Karze grzywny, ograniczenia wolności albo pozbawienia wolności do roku podlega
członek zarządu, który **dopuszcza do zarejestrowania akcji w rejestrze akcjonariuszy przed:**
1) zarejestrowaniem prostej spółki akcyjnej; 2) wpisem do rejestru zmiany liczby akcji — w przypadku
emisji nowych akcji P.S.A.

🔵 **Art. 594 § 1 pkt 2¹.** Grzywnie **do 20 000 zł** podlega członek zarządu, który dopuszcza do
tego, że zarząd **nie zgłasza zmian, o których mowa w art. 300³³ § 3**. Grzywnę nakłada sąd
rejestrowy.

🟢 **Art. 594 § 1 pkt 2.** Grzywnie do 20 000 zł podlega też dopuszczenie do **nieprowadzenia
rejestru akcjonariuszy zgodnie z przepisami ustawy**.

---

## 11. Mapa: przepis → element systemu

| Przepis | Element |
|---|---|
| 300³⁰ § 2, 300¹⁰⁷ § 3, 592 § 3 | blokada wpisu akcji bez `data_wpisu_krs` emisji |
| 300³¹ § 2 | niezmiennik bilansu akcji |
| 300³¹ § 4 | append-only + łańcuch skrótów + endpoint integralności |
| 300³² § 1²  🔵 | pole „kto zawarł umowę" (notariusz / zastępca / osoba upoważniona) |
| 300³² § 1³  🔵 | szablon „oświadczenie zarządu o zawarciu umowy" |
| 300³² § 2 | blokada rozwiązania umowy bez wskazania nowego podmiotu |
| 300³² § 3  🔵 | drugi zegar 7 dni + zawiadomienie sądu (system teleinformatyczny) |
| 300³³ § 1 pkt 4 | pole `rodzaj_akcji` |
| 300³³ § 1 pkt 9 | pole pokrycia akcji |
| 300³³ § 1 pkt 11, § 2 | obowiązki wobec spółki + dodatkowe informacje z umowy spółki |
| 300³³ § 3  🔵 | nowy typ sprawy: zgłoszenie zmiany danych przez zarząd |
| 300³⁴ § 1 | zegar 7 dni z zawieszeniem |
| 300³⁴ § 2 | ścieżka „z urzędu", bez opłaty, bez powiadomienia |
| 300³⁴ § 3 | krok powiadomienia zainteresowanego / zgoda |
| 300³⁴ § 4 | typ zdarzenia `zobowiazanie` |
| 300³⁴ § 5 | checklista + przełącznik „uzasadnione wątpliwości" |
| 300³⁴ § 6 | walidacja ograniczeń |
| 300³⁴ § 7 | zawiadomienia o wpisie / odmowie |
| 300³⁴ § 8 | **generowanie listy akcjonariuszy do KRS** |
| 300³⁴ § 9  🔵 | kanały powiadomień + żądanie adresata |
| 300³⁵ § 1¹ 🔵 | maskowanie PESEL / daty urodzenia / adresu |
| 300³⁵ § 3 | informacja z rejestru — także **papierowa** |
| 300³⁵ § 4  🔵 | zapytania organów + sygnatura postępowania |
| 300² § 3 + 300⁴³ | ułamkowe części akcji przypisane do numeru |
| 300⁹ § 2–3 | uchwała zarządu o pokryciu; równomierne zaliczanie |
| 300²³ § 2 | prawo głosu zastawnika + zakaz z umowy spółki |
| 300³⁷ § 2 | rozróżnienie wpisu konstytutywnego i deklaratoryjnego |
| 300³⁸ § 3–4 | wspólny przedstawiciel współuprawnionych |
| 300⁴⁰ | blokada zbycia akcji nie w pełni pokrytej bez zgody spółki |
| 300⁴² | ścieżka prawa pierwszeństwa |
| 300⁴⁵ § 2 | kolejność: wpis umorzenia → spłata |
| 300⁵¹ | typ zdarzenia: unieważnienie akcji orzeczeniem sądu |
| 300¹¹⁷–300¹¹⁸ | warunkowa emisja: dyspozycja zarządu, wpis konstytutywny |
| 300⁸⁷ § 1, 300⁹¹, 300⁹³ | znaczenie adresu e-mail; lista uprawnionych na WZ |
| 476 § 1¹ 🔵 | wykaz akcjonariuszy przy wykreśleniu spółki |

---

## 12. Czego w P.S.A. NIE MA — lista sprostowań

Te przepisy **istnieją dla spółki akcyjnej i nie mają odpowiednika w Dziale IA**. Wszystkie trafiły
błędnie do wcześniejszych wersji specyfikacji. Nie wprowadzać ich ponownie.

1. **Pośredniczenie w wypłatach na rzecz akcjonariuszy.** Art. 328¹⁰ KSH (S.A.) nakazuje spółce
   wykonywać zobowiązania pieniężne wobec akcjonariuszy za pośrednictwem podmiotu prowadzącego
   rejestr, chyba że statut stanowi inaczej. **W Dziale IA takiego przepisu nie ma.** Dywidendę
   w P.S.A. wypłaca spółka bezpośrednio (art. 300¹⁵–300¹⁷). Nie trzeba niczego wyłączać w umowie.

2. **Rozszerzony katalog danych rejestru.** Nowelizacja **nie zmieniła** art. 300³³ § 1 pkt 1–11.
   PESEL, data urodzenia, numer w rejestrze osób prawnych i współwłasność **nie są** obowiązkową
   treścią rejestru P.S.A. (zmiana dotyczyła art. 328³ dla S.A.). Art. 300³⁵ § 1¹ jedynie zakazuje
   udostępniania PESEL-u, daty urodzenia i adresu zamieszkania pozostałym akcjonariuszom.

3. **Wymogi formy zgody na wpis.** Art. 300³⁴ § 3 **nie zawiera** katalogu form (podpis notarialnie
   poświadczony / w obecności osoby upoważnionej / kwalifikowany, zaufany, osobisty). To regulacja
   spółki akcyjnej.

4. **Kierunek zgłoszenia zmian danych.** Art. 300³³ § 3 kieruje zgłoszenie **do podmiotu
   prowadzącego rejestr**, nie do sądu rejestrowego.

5. **Brak ogólnego odesłania do przepisów o spółce akcyjnej.** Dział IA ma wyłącznie odesłania
   punktowe (m.in. art. 300¹³, 300²⁴, 300¹⁰¹, 300¹²⁰ § 5). **Nie wolno stosować przepisów o S.A.
   przez analogię** tam, gdzie ustawa ich nie przywołuje.

---

## 13. Zasada pracy z tym plikiem

- Każda nowa reguła: najpierw znaleźć jednostkę redakcyjną **tutaj**; jeśli jej nie ma — sprawdzić
  sekcję 12; jeśli nadal nie ma — **zapytać Łukasza**, nie szukać w opracowaniach.
- Pozycje ⚠️ nie mogą być podstawą blokady w systemie do czasu weryfikacji.
- Pozycje 🔵 implementujemy, ale za bramką daty **18.02.2027** — nieaktywne wcześniej.
- Przy każdej aktualizacji ustawy: nowy wydruk tekstu jednolitego → aktualizacja tego pliku →
  dopiero potem zmiany w `przepisy.js`.
