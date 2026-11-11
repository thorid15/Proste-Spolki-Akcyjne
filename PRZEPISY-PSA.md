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
🔵 § 3 zd. 2 (Dz.U. 2026 poz. 176). Zgoda na wpis wymaga formy: **podpis notarialnie poświadczony,
podpis złożony w obecności osoby upoważnionej przez podmiot prowadzący rejestr, kwalifikowany podpis
elektroniczny, podpis zaufany albo podpis osobisty.** *(treść według wytycznych z 1.11.2026, § 10 —
zweryfikowane w tekście aktu; brzmienie dosłowne do wklejenia z Dz.U.)* → kancelaria stosuje tę formę
**już teraz** jako politykę (D-076).

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
→ **Sprostowanie 1.11.2026 (D-076):** wymogi formy zgody wprowadza nowelizacja w § 3 **zd. 2**
(wyżej) — wcześniejsza uwaga, że to wyłącznie regulacja spółki akcyjnej, dotyczyła stanu sprzed
nowelizacji. Kancelaria stosuje formę z zd. 2 już teraz.

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

🟢 Art. 85–90a i 108a–108b zweryfikowane w tekście ustawy (t.j. Dz.U. 2026 poz. 614) — wytyczne
z 1.11.2026, § 10. Poniżej omówienie; brzmienie dosłowne do wklejenia.

- **art. 89 § 2** — wynagrodzenie notariusza powiększa się o podatek od towarów i usług (podstawa
  wskazania VAT na informacji z rejestru, W5.5);
- **art. 90a** — § 1: akta i rejestr w postaci umożliwiającej przekazanie (eksport, W6.3); § 2: po
  zaprzestaniu działalności przez notariusza rejestr przechowuje rada izby, a prezes rady przekazuje
  dokumenty po zawiadomieniu przez spółkę o zawarciu nowej umowy (przeniesienie rejestru, § 7).

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

Taksa (§ 15b rozporządzenia — 🟢 zweryfikowane, wytyczne § 10; bez zmian po Dz.U. 2026 poz. 1370):
**§ 15b ust. 1** — prowadzenie rejestru za każdy rozpoczęty rok; **ust. 3** — informacja z rejestru
(podstawa na informacji obok art. 300³⁵ § 3 KSH i art. 89 § 2 PrNot). AML — ⚠️ nadal do weryfikacji
(ustawa AML art. 2 ust. 1 pkt 13a, art. 43 — „do sprawdzenia” w § 10 wytycznych):
- notariusz w zakresie prowadzonego rejestru akcjonariuszy jest **instytucją obowiązaną**;
  brak możliwości zastosowania środków bezpieczeństwa finansowego stanowi **przeszkodę wpisu**,
  a przy jej nieusunięciu — **odmowę wpisu**;
- maksymalne stawki taksy: prowadzenie rejestru **1200 zł** rocznie za każdy rozpoczęty rok,
  wpis **100 zł**, informacja z rejestru **50 zł**.

---

## 9a. Przepisy przejściowe i przeniesienie rejestru (dopisane 1.11.2026, wytyczne § 10)

🟢 zweryfikowane w tekście aktów (wytyczne § 10); omówienie, brzmienie dosłowne do wklejenia:
- **art. 29 ustawy zmieniającej** (Dz.U. 2026 poz. 176) — spółki z rejestrem istniejącym 18.02.2027
  składają wniosek do KRS w ciągu **3 miesięcy** (`przepisy.NOWELIZACJA.KONIEC_OKRESU_PRZEJSCIOWEGO`);
- **art. 30 ustawy zmieniającej** — PESEL albo data urodzenia w nowych wpisach po 18.02.2027
  (kancelaria — od dziś, D-076);
- 🔵 **art. 83a ust. 4ac ustawy o obrocie instrumentami finansowymi** — firma inwestycyjna przekazuje
  rejestr i dokumenty podmiotowi wskazanemu przez spółkę;
- **art. 38 ustawy o KRS** — KRS ujawnia dane podmiotu prowadzącego rejestr; **art. 25da** — sąd
  pozyskuje wykaz akcjonariuszy bezpośrednio od podmiotu prowadzącego rejestr.

⚠️ **Do sprawdzenia w tekście źródłowym** (wytyczne § 10) — **nie mogą być podstawą blokady**:
art. 17 § 1 KSH (uchwała jako warunek ważności umowy), KC art. 89 (warunek zawieszający) i art. 116,
RODO art. 14, ustawa AML art. 2 ust. 1 pkt 13a i art. 43, KEZN § 12, § 27, § 31, Otwarte API KRS,
parametry usługi mObywatel (limit 5 dokumentów miesięcznie, 5 MB, regulamin).

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
| 300³⁰ § 2, 300¹⁰⁷ § 3, 592 § 3 | blokada R6: emisja tylko z wiarygodną datą wpisu do KRS, od razu z obejmującymi (U-21) |
| 300³¹ § 2 | niezmiennik bilansu akcji — blokada R6 (`stan.js`) |
| 300³¹ § 4 | wpisy tylko dopisywane (wyzwalacze) + łańcuch skrótów + „Sprawdź integralność rejestru” w Ustawieniach (U-20) |
| 300³² § 1²  🔵 | pole „kto zawarł umowę” — wybór z osób zawierających umowy (Ustawienia) przy podpisie notariusza |
| 300³² § 1³  🔵 | — (brak osobnego pisma; dokumenty przy zawarciu umowy — U-03) |
| 300³² § 2 | przejęcie: zaznaczenie we wniosku i wpis `otwarcie` od dnia przejęcia (U-07); przekazanie: wpis `zamkniecie` z powodem |
| 300³² § 3  🔵 | — (zawiadomienie sądu po zamknięciu rejestru — czynność kancelarii poza aplikacją) |
| 300³³ § 1 pkt 4 | rodzaj akcji wyliczany z adnotacji „uprawnienie” (U-17) |
| 300³³ § 1 pkt 9 | przy emisji obowiązkowe „pokryte: tak/nie”; „nie” = adnotacja „niepokryte” (U-17) |
| 300³³ § 1 pkt 11, § 2 | adnotacje „obowiązek” i „inna” na akcjach |
| 300³³ § 3  🔵 | portal „Zgłoś zmianę” → sprawa w toku; zmiana danych spółki/osoby — „Edytuj” z historią (U-25) |
| 300³⁴ § 1 | termin 7 dni z zawieszeniem przy wstrzymaniu (`terminy.js`) |
| 300³⁴ § 2 | z urzędu ⇔ zajęcie: bez opłaty, bez powiadomienia (R3) |
| 300³⁴ § 3 | `ktoTraci()` + powiadomienie o zamierzonym wpisie albo zgoda na wpis — blokada R6 (R2) |
| 300³⁴ § 4 | podstawa wpisu — opis, data i pliki w sprawie (bez osobnego typu wpisu) |
| 300³⁴ § 5 | checklista sprawy: trzy pozycje stałe + pozycje z atrybutów akcji (R5) |
| 300³⁴ § 6 | pozycja checklisty „Ograniczenie uwzględnione” przy akcjach z adnotacją „ograniczenie” |
| 300³⁴ § 7 | powiadomienie o wpisie / o odmowie (z przyczyną), Korespondencja |
| 300³⁴ § 8 | egzemplarz powiadomienia o wpisie dla spółki z listą akcjonariuszy do KRS |
| 300³⁴ § 9  🔵 | kanał pisma według zgody na e-mail (R9); portal: pisma na koncie osoby i u działających za spółkę |
| 300³⁵ § 1¹ 🔵 | maskowanie białą listą pól według odbiorcy (`maskowanie.js`) |
| 300³⁵ § 3 | informacja z rejestru — PDF e-mailem, listem albo w portalu (U-24, U-27) |
| 300³⁵ § 4  🔵 | informacja dla organu: nazwa i sygnatura w `psa_pisma`, bez opłaty |
| 300² § 3 + 300⁴³ | ułamki przypisane do jednego numeru akcji (`ulamki.js`, CHECK w schemacie) |
| 300⁹ § 2–3 | adnotacja „niepokryte”, wykreślana po pokryciu (bez liczenia kwot wpłat) |
| 300²³ § 2 | obciążenie z prawem głosu (ustanowienie, zmiana) + pozycja checklisty „Umowa spółki nie wyłącza prawa głosu” |
| 300³⁷ § 2 | — (bez pola w sprawie — U-16) |
| 300³⁸ § 3–4 | adnotacja „inna” na akcji (wspólny przedstawiciel); ułamki w stanie akcji |
| 300⁴⁰ | pozycja checklisty „Zgoda spółki na zbycie” przy akcjach niepokrytych |
| 300⁴² | adnotacja „ograniczenie” + pozycja checklisty |
| 300⁴⁵ § 2 | wpis `umorzenie` (podstawa: uchwała) |
| 300⁵¹ | wpis `umorzenie` z podstawą „orzeczenie sądu” |
| 300¹¹⁷–300¹¹⁸ | — (warunkowa emisja poza zakresem — U-21) |
| 300⁸⁷ § 1, 300⁹¹, 300⁹³ | zgoda na e-mail w karcie osoby; informacja z rejestru na wybrany dzień (U-24) |
| 476 § 1¹ 🔵 | informacja z rejestru i eksport ZIP (art. 90a PrNot) |

---

## 12. Czego w P.S.A. NIE MA — lista sprostowań

Te przepisy **istnieją dla spółki akcyjnej i nie mają odpowiednika w Dziale IA**. Wszystkie trafiły
błędnie do wcześniejszych wersji specyfikacji. Nie wprowadzać ich ponownie.

1. **Pośredniczenie w wypłatach na rzecz akcjonariuszy.** Art. 328¹⁰ KSH (S.A.) nakazuje spółce
   wykonywać zobowiązania pieniężne wobec akcjonariuszy za pośrednictwem podmiotu prowadzącego
   rejestr, chyba że statut stanowi inaczej. **W Dziale IA takiego przepisu nie ma.** Dywidendę
   w P.S.A. wypłaca spółka bezpośrednio (art. 300¹⁵–300¹⁷). Nie trzeba niczego wyłączać w umowie.

2. ~~**Rozszerzony katalog danych rejestru.**~~ **SPROSTOWANE 1.11.2026 (D-076):** art. 300³³ § 1
   pkt 1–11 nie zmienia się, ale **art. 30 ustawy zmieniającej** wymaga PESEL albo daty urodzenia
   w nowych wpisach po 18.02.2027 (wytyczne § 6, § 10 — zweryfikowane). Kancelaria wymaga ich **już
   teraz** (D-076). Art. 300³⁵ § 1¹ zakazuje ich udostępniania pozostałym akcjonariuszom.

3. ~~**Wymogi formy zgody na wpis.**~~ **SPROSTOWANE 1.11.2026 (D-076):** nowelizacja dodaje
   art. 300³⁴ § 3 **zd. 2** z katalogiem form (patrz sekcja 1). Kancelaria stosuje go już teraz.

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
