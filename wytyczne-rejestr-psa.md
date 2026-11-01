# Rejestr akcjonariuszy PSA online — wytyczne

Kancelaria Notarialna Łukasz Kozon · stan na 1.11.2026

**Podstawy:** KSH (t.j. Dz.U. 2024 poz. 18 ze zm.); ustawa z 23.01.2026 o zmianie KSH (Dz.U. 2026 poz. 176), wchodzi w życie **18.02.2027** — oznaczenie **[2027]**; Prawo o notariacie (t.j. Dz.U. 2026 poz. 614, dalej PrNot); rozp. MS w sprawie maksymalnych stawek taksy notarialnej, § 15b (bez zmian po Dz.U. 2026 poz. 1370).

---

## 1. Dopuszczalność — wnioski

Brak przepisu, który uniemożliwia prowadzenie rejestru, zawieranie umowy i dokonywanie wpisów w postaci elektronicznej.

- Art. 300³¹ § 1 pkt 2 i § 3 KSH — rejestr prowadzi notariusz, w postaci elektronicznej.
- Art. 108b PrNot — do czynności związanych z rejestrem nie stosuje się art. 81–83 i 85 PrNot (brak obowiązku stwierdzania tożsamości, brak wymogu stawiennictwa).
- Art. 300³⁴ § 5 KSH — prowadzący bada treść i formę dokumentów; nie bada prawdziwości podpisów, chyba że poweźmie uzasadnione wątpliwości.
- [2027] Art. 300³⁴ § 9 KSH — ustawa sama przewiduje system teleinformatyczny prowadzącego rejestr i konto adresata w tym systemie.
- Izba notarialna akceptuje prowadzenie rejestru na własnej platformie kancelarii.
- Rejestr działa na odrębnym, zabezpieczonym serwerze kancelarii.

---

## 2. Podpisy i dokumenty

| Dokument | Wymóg ustawowy | Polityka kancelarii |
|---|---|---|
| Zgoda na wpis osoby, której prawa są wykreślane / zmieniane / obciążane (art. 300³⁴ § 3) | [2027] podpis notarialnie poświadczony, podpis w obecności osoby upoważnionej przez prowadzącego rejestr, QES, PZ albo PO | QES (mObywatel), PZ, PO; oryginał pocztą **tylko** z podpisem notarialnie poświadczonym; podpis w kancelarii |
| Umowa zbycia / obciążenia akcji (art. 300³⁶ § 4) | forma dokumentowa pod rygorem nieważności | QES, PZ, PO albo oryginał pocztą; skan odrzucany |
| Zgoda spółki na zbycie (art. 300³⁹ § 4, art. 300⁴⁰ § 1) | forma dokumentowa (chyba że umowa spółki stanowi inaczej) | jak umowa zbycia |
| Umowa o prowadzenie rejestru | brak formy ustawowej; wymaga uchwały akcjonariuszy (art. 300³¹ § 5, art. 17 § 1 KSH) | spółka podpisuje pierwsza, notariusz ostatni (QES); zarząd: własny QES, PZ albo oryginał pocztą |

Lista kontrolna:

- [ ] Zgoda na wpis: tylko formy z tabeli. Skan i zwykły oryginał pocztą = brak zgody.
- [ ] Brak ważnej zgody → obowiązkowe powiadomienie przed wpisem (art. 300³⁴ § 3 zd. 1), wpis dopiero po nim.
- [ ] Automatyczna walidacja podpisu po wgraniu pliku: rozpoznanie typu (QES / PZ / PO), odrzucenie podpisów zaawansowanych i zwykłych.
- [ ] Umowa o prowadzenie rejestru: wymagana uchwała akcjonariuszy + sprawdzenie reprezentacji w KRS.
- [ ] Ścieżka podpisu online: mObywatel (pkt 3).

---

## 3. Podpis kwalifikowany przez mObywatel

### Fakty (źródła prasowe i MC — do okresowej weryfikacji)
- Bezpłatnie 5 dokumentów PDF miesięcznie, każdy do 5 MB; powyżej limitu płatnie u dostawcy.
- Wymagania: mDowód w aplikacji, e-dowód z warstwą elektroniczną (wydany po 4.03.2019), telefon z NFC, numer CAN i PIN.
- Wersja na komputer: **podpis.mObywatel.gov.pl** (plik z komputera, telefon tylko do autoryzacji).
- Dostawcy do wyboru: Sigillum (PWPW), SimplySign (Certum), mSzafir (KIR), Cencert (Enigma).
- Regulamin: sprawy prywatne. Ważności podpisu to nie podważa (certyfikat nie ma takiego zastrzeżenia). Dla zarządu podpisującego za spółkę proponować własny QES albo oryginał pocztą.
- Brak publicznego API dla podmiotów zewnętrznych — klient podpisuje sam; integracja = link + walidacja.

### Przepływ w systemie
1. System generuje PDF < 5 MB z unikalnym ID w stopce i zapisuje skrót SHA-256.
2. Ekran „Podpisz dokument": **Pobierz** → **Podpisz w mObywatelu** (podpis.mObywatel.gov.pl, nowa karta) → **Wgraj podpisany plik**.
3. Kontrola automatyczna (blokuje tylko to, co na pewno niespełnione):
   - [ ] ważny QES wg unijnej listy zaufania (biblioteka DSS Komisji Europejskiej jako osobna usługa na serwerze); przetestować na próbkach od wszystkich 4 dostawców (znane ostrzeżenia walidacji przy SimplySign);
   - [ ] podpisana wersja zawiera dokładnie oryginał (skrót SHA-256 pierwszej wersji = zapisany skrót);
   - [ ] podpisujący = oczekiwana osoba (imię, nazwisko, PESEL z pola serialNumber „PNOPL-…" — sprawdzić na próbkach).
4. Wynik pozytywny → „Do zrobienia"; listę kontrolną zaznacza człowiek.
5. Kilku podpisujących (np. umowa zbycia): kolejna osoba podpisuje plik już podpisany; system sprawdza, że pierwsza wersja = oryginał. Zgoda na wpis = zawsze osobny dokument jednej osoby.
6. Brak e-dowodu / NFC: PZ na gov.pl albo oryginał pocztą (zgoda — tylko z podpisem notarialnie poświadczonym).

### Instrukcja dla klienta (do portalu)

> **Jak podpisać dokument w mObywatelu (bezpłatnie)**
>
> Potrzebujesz:
> - telefonu z NFC i aktualnej aplikacji mObywatel z mDowodem,
> - dowodu osobistego z warstwą elektroniczną (wydanego po 4.03.2019),
> - numeru CAN (6 cyfr w prawym dolnym rogu dowodu) i PIN-u do dowodu.
>
> 1. Kliknij **Pobierz dokument** i zapisz plik na komputerze.
> 2. Wejdź na **podpis.mObywatel.gov.pl**, wybierz dowolnego dostawcę i wgraj pobrany plik.
> 3. Potwierdź podpis w aplikacji mObywatel: wpisz CAN i PIN, przyłóż dowód do telefonu.
> 4. Pobierz podpisany plik i wgraj go tutaj przyciskiem **Wgraj podpisany dokument**.
>
> **Ważne:** nie otwieraj i nie zapisuj ponownie pobranego pliku w innym programie, bo system odrzuci zmieniony dokument. Bezpłatnie możesz podpisać 5 dokumentów miesięcznie.
>
> Wolisz podpisać na telefonie? W aplikacji wybierz Usługi → Podpis kwalifikowany.

---

## 4. Zgody i powiadomienia

- [ ] Przy rejestracji każdego akcjonariusza i każdego nowego nabywcy dwa odrębne oświadczenia, składane osobiście (nie przez zarząd w jego imieniu):
  - zgoda na komunikację e-mail — wpisywana do rejestru (art. 300³³ § 1 pkt 5);
  - żądanie automatycznego przesyłania powiadomień ([2027] art. 300³⁴ § 9).
- [ ] Możliwość cofnięcia obu oświadczeń.
- [ ] Bez zgody: powiadomienie listem na adres z rejestru — kolejka do wysyłki, potwierdzenie nadania.
- [ ] Powiadomienie zbywcy zawsze na adres z rejestru, nigdy na adres podany przez żądającego wpisu.
- [ ] Powiadomienie o dokonanym wpisie / odmowie z przyczynami do żądającego i do spółki (art. 300³⁴ § 7) — obowiązek ustawowy, bezpłatny, nie może być ukryty za płatną informacją.

---

## 5. Dostęp do rejestru i informacje z rejestru

- [ ] Bez logowania widoczne tylko dane spółki; stan akcjonariatu wyłącznie w płatnej informacji (pobieranej automatycznie).
- [ ] Informację w portalu pobiera tylko spółka i akcjonariusz (art. 300³⁵ § 1).
- [ ] Sądy, prokuratura, komornicy, organy egzekucyjne ([2027] art. 300³⁵ § 4) — poza portalem; informację wysyła kancelaria na żądanie.
- [ ] [2027] Wersja dla akcjonariusza ukrywa PESEL, datę urodzenia i adres zamieszkania pozostałych akcjonariuszy (art. 300³⁵ § 1¹). Spółka dostaje wersję pełną.
- [ ] Na każdej informacji: wynagrodzenie i VAT z podstawą prawną — § 15b ust. 3 rozporządzenia, art. 300³⁵ § 3 KSH, art. 89 § 2 PrNot.
- [ ] Dziennik wydanych informacji: numer, data, odbiorca, opłata.

Stawki (maksymalne, netto + 23% VAT, § 15b): prowadzenie 1 200 zł za każdy rozpoczęty rok, wpis 100 zł, informacja 50 zł. Gwarancja ceny: 3 lata od podpisania umowy.

---

## 6. Pozostałe wymogi systemowe

- [ ] [2027] PESEL albo data urodzenia w nowych wpisach — tylko dla zdarzeń po 18.02.2027 (art. 30 ustawy zmieniającej).
- [ ] [2027] Zawiadomienie sądu rejestrowego przez system teleinformatyczny o wygaśnięciu / rozwiązaniu umowy w ciągu 7 dni (art. 300³² § 3).
- [ ] Eksport całego rejestru z dokumentami w czytelnym formacie (art. 90a PrNot); brak automatycznego usuwania dokumentów.

---

## 7. Przeniesienie rejestru od innego podmiotu

### 7.1 Ramy prawne

- **Uchwała** akcjonariuszy o wyborze nowego podmiotu (art. 300³¹ § 5); bez niej umowa nieważna (art. 17 § 1 KSH).
- **Kolejność wymuszona ustawą:** spółka może rozwiązać dotychczasową umowę tylko pod warunkiem zawarcia nowej (art. 300³² § 2). Zatem: uchwała → nowa umowa → wypowiedzenie starej. To jest wypowiedzenie / rozwiązanie na zasadach dotychczasowej umowy, nie „odstąpienie".
- **Nowa umowa pod warunkiem zawieszającym** (art. 89 KC): skuteczna z chwilą rozwiązania albo wygaśnięcia dotychczasowej umowy, bez wpisywania konkretnej daty. Termin (art. 116 KC) nie pasuje, bo rozwiązanie jest zdarzeniem niepewnym. Wzór klauzuli — pkt 7.4.
- **Kto przekazuje dane:**
  - dom maklerski / bank (firma inwestycyjna) — [2027] obowiązek przekazania rejestru i dokumentów podmiotowi wskazanemu przez spółkę (art. 83a ust. 4ac ustawy o obrocie instrumentami finansowymi); przed 18.02.2027 — umowa + prawo spółki do informacji (art. 300³⁵ § 3);
  - notariusz nadal działający — nie znaleziono przepisu szczególnego; umowa + art. 300³⁵ § 3;
  - notariusz, który zaprzestał działalności — rejestr jest w radzie izby; prezes rady przekazuje dokumenty po zawiadomieniu przez spółkę o zawarciu nowej umowy (art. 90a § 2 PrNot).
- **Luka między rozwiązaniem a otrzymaniem danych:** brak danych = przeszkoda; wpis w ciągu 7 dni od jej usunięcia (art. 300³⁴ § 1 zd. 2).
- **[2027] KRS:** zarząd zgłasza zawarcie umowy do sądu rejestrowego — imię i nazwisko notariusza, siedziba i adres kancelarii, oświadczenie zarządu (art. 300³² § 1¹–1³); dotychczasowy podmiot zawiadamia sąd o rozwiązaniu w 7 dni (art. 300³² § 3); KRS ujawnia dane podmiotu prowadzącego rejestr (art. 38 ustawy o KRS). Spółki z rejestrem istniejącym 18.02.2027 składają wniosek w ciągu 3 miesięcy (art. 29 ustawy zmieniającej).
- **Umowa spółki:** sprawdzić, czy wskazuje dotychczasowy podmiot; jeśli tak — potrzebna zmiana umowy spółki.
- **RODO art. 14:** dane akcjonariuszy pozyskane nie od nich → obowiązek informacyjny.
- **Etyka:** opcja „przenieś rejestr" opisana neutralnie, bez porównań z innymi podmiotami (KEZN § 27, § 31).

### 7.2 Ścieżka w portalu: „Przenoszę rejestr od innego podmiotu"

**Etap 1 — Zgłoszenie (ekran rejestracji)**
- Numer KRS → auto-uzupełnienie z Otwartego API KRS (api-krs.ms.gov.pl).
- Dotychczasowy podmiot: dom maklerski / bank, notariusz, notariusz, który zakończył działalność (rada izby).
- Okres wypowiedzenia dotychczasowej umowy (jeśli znany) — informacyjnie; data przejęcia ustalana dopiero po zawiadomieniu spółki (Etap 5).
- Kontakt do zarządu.

**Etap 2 — Dokumenty startowe**
- Upload: aktualny tekst umowy spółki; aktualna informacja z dotychczasowego rejestru (jeśli spółka ma) — do wstępnej analizy.
- System generuje wzór uchwały akcjonariuszy o wyborze notariusza Łukasza Kozona jako podmiotu prowadzącego rejestr od chwili rozwiązania albo wygaśnięcia dotychczasowej umowy.

**Etap 3 — Weryfikacja kancelarii (człowiek)**
- [ ] Reprezentacja wg KRS.
- [ ] Uchwała: ważność, większość, data.
- [ ] Umowa spółki: czy wskazuje dotychczasowy podmiot.
- [ ] AML: spółka, reprezentanci, beneficjent rzeczywisty (CRBR).
- [ ] Wstępna zgodność liczby akcji.

**Etap 4 — Umowa o prowadzenie rejestru pod warunkiem zawieszającym (pkt 7.4)**
- Spółka podpisuje pierwsza, notariusz ostatni (QES).
- System generuje pakiet dla spółki:
  - wzór wypowiedzenia dotychczasowej umowy (bez daty — skutek wg warunków tej umowy);
  - potwierdzenie zawarcia nowej umowy (do załączenia — art. 300³² § 2);
  - wezwanie do przekazania: rejestru wg stanu na dzień rozwiązania, historii wpisów, dokumentów uzasadniających wpisy, żądań w toku, obciążeń i zajęć (dla firmy inwestycyjnej [2027] powołanie art. 83a ust. 4ac u.o.i.f.; dla rady izby — zawiadomienie z art. 90a § 2 PrNot);
  - [2027] wzór zgłoszenia do sądu rejestrowego (art. 300³² § 1¹–1³) i wniosku o wpis danych podmiotu (art. 38 ustawy o KRS).
- Status: „Umowa zawarta pod warunkiem".

**Etap 5 — Okres przejściowy**
- Spółka zawiadamia o dacie rozwiązania albo wygaśnięcia (kopia wypowiedzenia z potwierdzeniem doręczenia albo potwierdzenie od poprzednika). Kancelaria weryfikuje datę wg warunków dotychczasowej umowy i wpisuje ją do systemu → status „Oczekuje na przekazanie".
- Przypomnienia automatyczne: brak zawiadomienia po 14 dniach od zawarcia umowy; zbliżający się termin ostateczny warunku (12 miesięcy).
- Dotychczasowy podmiot prowadzi rejestr do dnia rozwiązania i kończy wszystkie żądania w toku.
- Zalecenie dla spółki: w ostatnim tygodniu nie składać nowych żądań u dotychczasowego podmiotu.
- Żądania wpływające do kancelarii od chwili skuteczności umowy: przyjmowane; wpis po otrzymaniu danych (art. 300³⁴ § 1 zd. 2).

**Etap 6 — Odbiór i uzgodnienie (człowiek, lista kontrolna)**
- [ ] Kompletność przekazanych danych i dokumentów.
- [ ] Liczba akcji zarejestrowanych = liczba wyemitowanych (art. 300³¹ § 2), wg umowy spółki i KRS.
- [ ] Pokrycie akcji, ograniczenia rozporządzania, obowiązki (art. 300³³ § 1 pkt 9–11).
- [ ] Zastawy, użytkowania, zajęcia (art. 300³⁴ § 2), ułamkowe części akcji.
- [ ] Porównanie z ostatnią listą akcjonariuszy złożoną do KRS (art. 300³⁴ § 8).
- [ ] Rozbieżności: nie poprawiamy samodzielnie. Rejestr odwzorowujemy (wobec spółki akcjonariuszem jest wpisany — art. 300³⁸ § 1), wyjaśniamy z dotychczasowym podmiotem / spółką; korekty wyłącznie w trybie żądania wpisu.

**Etap 7 — Otwarcie rejestru**
- Import jako zdarzenie otwierające „PRZEJĘCIE" (początek łańcucha SHA-256) — stan na dzień X + skróty dokumentów źródłowych.
- Historia dotychczasowego podmiotu jako archiwum tylko do odczytu.
- Zatwierdzenie przez notariusza (QES).

**Etap 8 — Powiadomienia po otwarciu**
- Spółka: potwierdzenie przejęcia + stan rejestru.
- Dotychczasowy podmiot: potwierdzenie odbioru (podstawa jego zawiadomienia sądu — [2027] art. 300³² § 3).
- Akcjonariusze: informacja z art. 14 RODO + zaproszenie do portalu + formularze zgód (komunikacja e-mail, automatyczne powiadomienia — żądanie składane na nowo, bo dotyczy systemu nowego podmiotu); bez odpowiedzi → korespondencja pocztą.
- Organy egzekucyjne (jeśli są zajęcia): informacja o zmianie podmiotu — ręcznie przez kancelarię.
- [2027] Przypomnienie zarządowi o zgłoszeniu do KRS.

**Etap 9 — Rozliczenie**
- Opłata roczna od dnia skuteczności umowy (§ 15b ust. 1 — za każdy rozpoczęty rok); do chwili skuteczności brak wynagrodzenia.
- Opłata za przejęcie — do decyzji (import nie jest wpisem z art. 300³³ § 1 pkt 6).

### 7.3 Statusy w systemie
Zgłoszone → Weryfikacja → Umowa zawarta pod warunkiem → Oczekuje na przekazanie (data rozwiązania znana) → Uzgodnienie → Aktywny. Statusy boczne: Wstrzymane — rozbieżności; Wygasła — warunek się nie ziścił.

### 7.4 Wzór klauzuli — umowa warunkowa

> **§ … Skuteczność umowy**
>
> 1. Umowa zostaje zawarta pod warunkiem zawieszającym rozwiązania albo wygaśnięcia umowy o prowadzenie rejestru akcjonariuszy Spółki zawartej z [dotychczasowy podmiot] („Dotychczasowa Umowa").
> 2. Umowa staje się skuteczna z chwilą rozwiązania albo wygaśnięcia Dotychczasowej Umowy. Jeżeli Dotychczasowa Umowa uległa rozwiązaniu albo wygasła przed zawarciem Umowy, Umowa jest skuteczna z chwilą jej zawarcia.
> 3. Spółka zobowiązuje się złożyć oświadczenie o wypowiedzeniu Dotychczasowej Umowy w terminie 14 dni od zawarcia Umowy oraz zawiadomić Notariusza o dacie rozwiązania albo wygaśnięcia Dotychczasowej Umowy niezwłocznie, nie później niż w terminie 3 dni od jej ustalenia, przedkładając dokument potwierdzający tę datę.
> 4. Jeżeli warunek, o którym mowa w ust. 1, nie ziści się w terminie 12 miesięcy od zawarcia Umowy, Umowa wygasa.
> 5. Do chwili skuteczności Umowy Notariusz nie prowadzi rejestru akcjonariuszy Spółki i nie przysługuje mu wynagrodzenie.

Uchwała akcjonariuszy — analogicznie: wybór notariusza „od chwili rozwiązania albo wygaśnięcia dotychczasowej umowy o prowadzenie rejestru akcjonariuszy".

Uwagi:
- Art. 300³² § 2 wymaga *zawarcia* nowej umowy przed rozwiązaniem starej. Umowa warunkowa jest zawarta z chwilą podpisania; warunek dotyczy tylko skutków. Konstrukcja realizuje cel przepisu — ciągłość rejestru.
- Ziszczenie warunku zależy częściowo od woli spółki (wypowiedzenie) — stąd obowiązek z ust. 3 i termin ostateczny z ust. 4.
- Jedna klauzula obejmuje wszystkie przypadki: wypowiedzenie, porozumienie, umowę terminową, zakończenie działalności przez poprzedniego notariusza (ust. 2 zd. 2).

---

## 8. Ryzyka do monitorowania (nieblokujące)

- **Automatyczne informacje z rejestru** bez udziału notariusza — możliwy zarzut z KEZN § 12 (osobiste dokonywanie czynności). Rozważyć QES notariusza (np. wsadowo).
- **Strona internetowa** — KEZN § 27 (reklama osobista). „Gwarancja ceny" to stawki maksymalne z § 15b — ryzyko zarzutu reklamy wprowadzającej w błąd.
- **AML** (art. 2 ust. 1 pkt 13a ustawy AML) — identyfikacja zdalna; QES z PESEL wzmacnia; UKNF: bez eID / usług zaufania rozważyć wzmożone środki (art. 43).
- **Bezpieczeństwo serwera** — punkt odłożony; podstawa: art. 300³¹ § 4 KSH, art. 32 RODO.

---

## 9. Do decyzji

- [ ] Sposób realizacji prawa dostępu z art. 300³⁵ § 2 (odrębnego od płatnej informacji z § 3) — opisać w regulaminie.
- [ ] QES notariusza na automatycznie generowanych informacjach (wsadowo?).
- [ ] Opłata za przejęcie rejestru.
- [ ] Początek biegu 3-letniej gwarancji ceny przy umowie warunkowej (zawarcie czy skuteczność umowy).
- [ ] PESEL w certyfikatach QES (PNOPL-…) — test na próbkach od 4 dostawców mObywatela.
- [ ] Automatyzacja walidacji PZ i PO.

---

## 10. Stan weryfikacji źródeł

**Zweryfikowane w tekście aktów:** KSH art. 300²⁹–300⁴³; Dz.U. 2026 poz. 176 (w tym art. 300³² § 1¹–1³ i § 3, 300³³, 300³⁴ § 3 zd. 2 i § 9, 300³⁵ § 1¹ i § 4, art. 83a ust. 4ac u.o.i.f., art. 90a PrNot, art. 38 i 25da ustawy o KRS, art. 29–30 i 35 ustawy); PrNot art. 85–90a, 108a–108b; § 15b rozporządzenia; Dz.U. 2026 poz. 1370.

**Do sprawdzenia w tekście źródłowym** (źródła wtórne lub pamięć): ustawa AML art. 2 ust. 1 pkt 13a i art. 43; KEZN § 12, § 27, § 31; KSH art. 17 § 1; KC art. 89 i 116; RODO art. 14; Otwarte API KRS; parametry usługi mObywatel (limit, rozmiar pliku, regulamin).
