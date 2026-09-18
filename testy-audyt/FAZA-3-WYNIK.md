# FAZA 3 — wynik: dane osobowe, czy zbieramy właściwe

> Audyt read-only, zero zmian w kodzie produkcyjnym. Zakres: `testy-audyt/SESJA-PSA-AUDYT.md`,
> sekcja FAZA 3. Znaleziska: `testy-audyt/ZNALEZISKA.md` Z-150 – Z-158. Pytania:
> `testy-audyt/PYTANIA-DO-LUKASZA.md` P-009, P-010.

## ⚠️ KRYTYCZNE — PRZECZYTAJ NAJPIERW

**Surowy JSON zwracany przez `widoki.widokStanu()` — czyli m.in. przez REALNY, produkcyjny
endpoint portalu klienta `GET /api/psa/portal/rejestr/:spolkaId` (ekran „Rejestr" konta spółki) —
zawiera pełne dane AML/PEP oraz wewnętrzną notatkę (`aml_status`, `aml_data`, `aml_notatka`,
`aml_data_przegladu`, `beneficjent_rzeczywisty_id`, `pep`, `pep_opis`, `pep_oswiadczenie`,
`pep_oswiadczenie_data`, `uwagi`) KAŻDEGO akcjonariusza, bez żadnego okrojenia, dla roli „spółka".**
To dane, które własna dokumentacja modułu (`CLAUDE-PSA.md` sekcja 10, komentarze w
`server/logika/maskowanie.js`) opisuje jako mające NIGDY nie wychodzić poza kancelarię — notatka
AML to w praktyce ocena ryzyka konkretnej osoby, a status PEP dotyczy jej powiązań politycznych.
Wyciek nie jest widoczny w żadnym WYDRUKU (te są poprawnie budowane z wąskiej listy pól — Z-156),
tylko w surowej odpowiedzi JSON zasilającej ekran — dokładnie schemat „maskowanie wyłącznie w
warstwie widoku", przed którym ostrzegała ta faza audytu, tylko dotyczy innego zestawu pól niż
PESEL/adres (te są zamaskowane poprawnie — Z-155). Zdarzenie nie jest logowane w dzienniku dostępu
(Z-152), więc dotychczasowa skala wycieku jest niemożliwa do ustalenia post factum.
Szczegóły, dowód (żądania `curl`, dokładne linie kodu) i rekomendacja napraw: **Z-150** w
`ZNALEZISKA.md`. Powiązane: Z-152 (brak śladu w dzienniku), Z-156 (dowód, że wydruki są bezpieczne
— problem jest ograniczony do API).

---

## 1. Tabela pól rejestru vs art. 300³³ § 1 KSH

Legenda kolumny „Status": **OBOWIĄZKOWE** (wymóg ustawowy wprost z katalogu), **FAKULTATYWNE
Z KATALOGU** (pozycja katalogu, ale zbierana „na żądanie" / warunkowo per ustawa), **SPOZA
KATALOGU** (pole zbierane w aplikacji, którego art. 300³³ § 1 pkt 1–11 nie wymienia — z podstawą
inną niż KSH).

### Dane spółki (`psa_spolki`)

| Pole aplikacji | Punkt katalogu | Status | Uwagi |
|---|---|---|---|
| `nazwa`, `kraj`, `kod_pocztowy`, `miejscowosc`, `ulica`, `nr_domu`, `nr_lokalu` | pkt 1 (firma, siedziba, adres spółki) | OBOWIĄZKOWE | — |
| `sad_rejestrowy`, `krs` | pkt 2 | OBOWIĄZKOWE | — |
| `data_utworzenia_spolki` | pkt 3 (data zarejestrowania spółki) | OBOWIĄZKOWE | — |
| `dodatkowe_informacje_umowa_spolki` | § 2 (dodatkowe postanowienia umowy) | FAKULTATYWNE Z KATALOGU | wprost przewidziane przez § 2 |
| `nip`, `regon` | — | SPOZA KATALOGU | identyfikacja administracyjna/operacyjna, nie KSH |
| `wydzial`, `telefon`, `email`, `www` | — | SPOZA KATALOGU | dane operacyjne kontaktowe kancelarii ze spółką |
| `status`, `komentarz_statusu` | — | SPOZA KATALOGU | stan wewnętrzny obsługi sprawy |
| `data_uchwaly_wyboru`, `data_umowy`, `umowe_zawarl`, `umowe_zawarl_imie_nazwisko` | art. 300³² § 1/§ 1² (umowa o prowadzenie rejestru) | OBOWIĄZKOWE (osobna jednostka od 300³³) | dot. umowy o prowadzenie rejestru, nie treści rejestru samej w sobie |
| `zakaz_glosu_zastawnika_umowa`, `ograniczenie_dziedziczenia_umowa` | § 2 / art. 300²³ § 2 / 300⁴¹ § 3 | FAKULTATYWNE Z KATALOGU | postanowienia umowy spółki wpływające na treść rejestru |
| `kapital_akcyjny_grosze` | — | SPOZA KATALOGU | dana KRS, przydatna operacyjnie, nie element katalogu rejestru akcjonariuszy |
| `reprezentant_*` (imię, funkcja, PESEL, adres, dowód, rodzice…) | — | SPOZA KATALOGU | dane reprezentanta spółki potrzebne do WZORÓW PISM (umowa, uchwała), nie do rejestru akcjonariuszy — zbierane, bo reprezentant podpisuje dokumenty w imieniu spółki |
| `stosuje_procedure_aml` | — | SPOZA KATALOGU | przełącznik AML per spółka — ustawa o przeciwdziałaniu praniu pieniędzy, nie KSH |
| `uwagi` | — | SPOZA KATALOGU | notatka wewnętrzna kancelarii, jawnie wykluczona z wydruków |

### Dane osoby / akcjonariusza (`psa_osoby`, `psa_wnioski_akcjonariusze`)

| Pole aplikacji | Punkt katalogu | Status | Uwagi |
|---|---|---|---|
| `nazwisko`, `imie` / `nazwa` (dla osoby prawnej) | pkt 5 (nazwisko i imię albo firma) | OBOWIĄZKOWE | — |
| `kod_pocztowy`, `miejscowosc`, `ulica`, `nr_domu`, `nr_lokalu` **albo** `adres_doreczen` **albo** `adres_edoreczen` | pkt 5 (adres zamieszkania/siedziby/doręczeń/e-doręczeń) | OBOWIĄZKOWE (jeden z czterech wariantów) | `rodzaj_adresu_rejestrowego` wskazuje, KTÓRY z podanych jest tym ustawowym — patrz Z-154 dla weryfikacji, że sam PESEL/data urodzenia NIE są tu wymagane |
| `email` + `zgoda_email`/`zgoda_email_status` | pkt 5 in fine (adres e-mail, jeśli zgoda na komunikację elektroniczną) | FAKULTATYWNE Z KATALOGU | zweryfikowane wprost (Z-157): e-mail można zapisać bez zgody jako kontakt, ale do treści rejestru/doręczeń liczy się wyłącznie przy `zgoda_email_status='potwierdzona'` |
| wpis o przejściu akcji/praw zastawniczych (typ zdarzenia `przeniesienie`, `obciazenie`) | pkt 6 | FAKULTATYWNE Z KATALOGU („na żądanie") | zweryfikowane strukturalnie (Z-158): wymaga osobnej sprawy z `zadajacy_rola` |
| prawo głosu zastawnika/użytkownika (`psa_obciazenia.prawo_glosu`, typ `prawo_glosu_zastawnika`) | pkt 7 | FAKULTATYWNE Z KATALOGU („na żądanie") | jw., Z-158 |
| wykreślenie obciążenia (typ `wykreslenie_obciazenia`) | pkt 8 | FAKULTATYWNE Z KATALOGU („na żądanie") | jw., Z-158 |
| `pesel`, `data_urodzenia`, `bez_pesel` | — | SPOZA KATALOGU | `PRZEPISY-PSA.md` sekcja 12 pkt 2 wprost: nowelizacja nie wprowadziła PESEL-u/daty urodzenia do katalogu; zbierane fakultatywnie (Z-154), podstawa: potrzeba identyfikacyjna/AML — **maskowane innym akcjonariuszom** (art. 300³⁵ § 1¹, zweryfikowane Z-155) |
| `nip`, `regon` (osoba prawna) | — | SPOZA KATALOGU | identyfikacja administracyjna |
| `numer_w_rejestrze`, `nazwa_rejestru` | — | SPOZA KATALOGU | `PRZEPISY-PSA.md` sekcja 12 pkt 2 wprost wymienia jako NIE wprowadzone przez nowelizację; przydatne operacyjnie do identyfikacji akcjonariusza-osoby prawnej |
| `telefon` | — | SPOZA KATALOGU | kontakt operacyjny |
| `plec` | — | SPOZA KATALOGU | wyliczane automatycznie z PESEL-u; wyłącznie do poprawnej odmiany gramatycznej w generowanych pismach (`server/migracje.js:681-692`) — nie samodzielnie zbierane |
| `wspolwlasnosc`, `wspolwlasciciele`, `udzial_licznik`, `udzial_mianownik` | pośrednio art. 300⁴³ (ułamkowe części akcji) / 300³⁸ § 3 (współuprawnieni) | FAKULTATYWNE Z KATALOGU | mechanizm ułamków akcji — osobno audytowany w innej fazie (reguła 4a/4b) |
| `aml_status`, `aml_data`, `aml_notatka`, `aml_data_przegladu` | — | SPOZA KATALOGU | ustawa AML (art. 46 i n.), notariusz jako instytucja obowiązana — **podstawa przetwarzania INNA niż obowiązek prawny z KSH**; zob. Z-150 — dziś w tej samej tabeli i (błędnie) w tym samym JSON-ie co dane rejestru |
| `beneficjent_rzeczywisty_id` | — | SPOZA KATALOGU | ustawa AML art. 2 ust. 2 pkt 1; jw. |
| `pep`, `pep_opis`, `pep_oswiadczenie`, `pep_oswiadczenie_data` | — | SPOZA KATALOGU | ustawa AML art. 46; **status oświadczeniowy potwierdzony jako zaprojektowany poprawnie w kartotece (dwa odrębne, jasno opisane pola), ale rozjeżdżający się w głównym kanale onboardingu — Z-151** |
| `uwagi` | — | SPOZA KATALOGU | notatka wewnętrzna, jawnie wykluczona z wydruków (ale nie z surowego JSON-u — Z-150) |

### Dane emisji / akcji (`psa_emisje`, `psa_stan_akcji`)

| Pole aplikacji | Punkt katalogu | Status |
|---|---|---|
| `seria`, `nr_pierwszy`+`ilosc` (numery), `rodzaj_akcji` | pkt 4 | OBOWIĄZKOWE |
| `data_wpisu_krs` (emisji) | pkt 3 (data emisji akcji) | OBOWIĄZKOWE |
| uprawnienia szczególne z akcji (`psa_uprawnienia`, `rodzaj='przywilej'`) | pkt 4 in fine | FAKULTATYWNE Z KATALOGU |
| `pokryta` | pkt 9 (wzmianka o pokryciu) | OBOWIĄZKOWE (jeśli akcja objęta) |
| `obowiazki_wobec_spolki` (emisja) | pkt 11 | FAKULTATYWNE Z KATALOGU |
| `psa_ograniczenia.*` | pkt 10 (ograniczenia rozporządzania) | FAKULTATYWNE Z KATALOGU |
| `cena_emisyjna_grosze`, `waluta`, `tytul`, `podstawa_prawna`, `status`, `opis` | — | SPOZA KATALOGU (operacyjne, dla rozliczeń i dokumentów) |
| `uwagi` (emisji) | — | SPOZA KATALOGU |

## 2. Odpowiedzi na pozostałe pytania checklisty FAZA 3

| Pytanie | Odpowiedź | Dowód |
|---|---|---|
| Czy PESEL jest wymagany zawsze? | NIE — pole fakultatywne, tylko miękkie ostrzeżenie przy braku PESEL-u I daty urodzenia jednocześnie | Z-154 |
| Pozycje „na żądanie" (pkt 6–8) — automatyczne czy wnioskowe? | Wnioskowe — osobny typ zdarzenia + obowiązkowy `zadajacy_rola` per sprawa | Z-158 |
| E-mail — zawsze czy przy zgodzie? | Przechowywany zawsze jako kontakt; do celów ustawowych (treść rejestru/doręczenia) liczy się wyłącznie z jawną zgodą (`zgoda_email_status='potwierdzona'`) | Z-157 |
| Dane ponad katalog — czy mają podstawę? | Tak, każde pole sklasyfikowane w tabeli wyżej ma wskazaną podstawę (AML, dokumenty/wzory pism, operacyjna); żadnego pola „bez podstawy" nie znaleziono | tabela wyżej |
| Dane AML — oddzielone od rejestrowych? | NIE — ta sama tabela `psa_osoby`, i (błędnie) te same widoki JSON dla ról spoza kancelarii | **Z-150 (KRYTYCZNY)** |
| Status PEP — oświadczenie osoby czy pole pracownika? | Zaprojektowane poprawnie (dwa pola, jasno opisane), ale w głównym kanale onboardingu (wniosek portalowy) wartość z formularza trafia do NIEWŁAŚCIWEGO z dwóch pól, a pole „prawdziwego" oświadczenia zostaje puste | Z-151 |
| Maskowanie w API, nie tylko w UI — PESEL/adres | Zweryfikowane systematycznie, poprawne, dla wszystkich 4 ról, w surowym JSON-ie | Z-155 |
| Maskowanie w API — dane AML/PEP/uwagi | Niepoprawne dla ról „spółka"/„organ" — wyciek | **Z-150 (KRYTYCZNY)** |
| Wydruki spójne z ekranem? | Tak dla PESEL/adresu (już Z-014 w FAZIE 1), i dodatkowo potwierdzone, że wydruki NIE dziedziczą wycieku AML/PEP z Z-150 | Z-156 |
| Klauzula informacyjna dla akcjonariuszy — istnieje? Kiedy doręczana? | Istnieje, ale WYŁĄCZNIE jako dokument do podpisu w jednorazowym pakiecie przy zakładaniu spółki przez wniosek portalowy; akcjonariusze dochodzący do rejestru później (zwykły kreator zdarzenia) nigdy jej nie dostają z systemu | Z-153 |
| Dziennik dostępu — odczyty czy tylko zapisy? | Ani jedno, ani drugie wprost — rejestruje wyłącznie „wyniesienie" danych (informacja z rejestru, eksport, pobranie pliku), świadomie pomijając zwykłe odczyty ekranu/API, w tym odczyty portalowe | Z-152 |

## 3. Lista znalezisk tej fazy

- **Z-150 [KRYTYCZNY]** — wyciek AML/PEP/uwagi do ról „spółka"/„organ" przez surowy JSON `widoki.widokStanu`.
- **Z-151 [POWAŻNY]** — rozjazd pól `pep`/`pep_oswiadczenie` przy przejęciu wniosku portalowego.
- **Z-152 [POWAŻNY]** — dziennik dostępu nie obejmuje zwykłych odczytów (w tym portalowych).
- **Z-153 [POWAŻNY]** — klauzula RODO i oświadczenie PEP generowane tylko przy zakładaniu spółki.
- **Z-154 [POZYTYWNE]** — PESEL potwierdzony jako fakultatywny.
- **Z-155 [POZYTYWNE]** — maskowanie PESEL/adres/data urodzenia systematycznie poprawne w API.
- **Z-156 [POZYTYWNE]** — wydruki nie dziedziczą wycieku AML z Z-150 (bezpieczna whitelist pól).
- **Z-157 [POZYTYWNE]** — zgoda na e-mail poprawnie odróżniona od samego posiadania adresu.
- **Z-158 [POZYTYWNE]** — pozycje „na żądanie" (pkt 6–8) strukturalnie wymagają osobnego żądania.

Pytania do Łukasza: **P-009** (zakres dziennika dostępu) i **P-010** (naprawa pól PEP i zakres
dokumentów RODO/PEP) w `testy-audyt/PYTANIA-DO-LUKASZA.md`.

## 4. Czego nie udało się przetestować

1. **Rzeczywiste logowanie portalowe jako akcjonariusz** — niemożliwe wprost (Z-006 z FAZY 1: brak
   ścieżki tworzenia konta dla akcjonariusza innego niż wnioskodawca). Obejście zastosowane w tej
   fazie: (a) dla PESEL/adresu — bezpośrednie żądania do `GET /api/psa/spolki/:id/stan` z
   parametrem `?rola=` i `?odbiorca=`, czyli DOKŁADNIE ta sama funkcja `widoki.widokStanu()`, którą
   woła prawdziwy endpoint portalowy `GET /api/psa/portal/rejestr/:spolkaId` — jedyna różnica to
   to, że w prawdziwym porcie rola jest wyliczana z sesji (`rolaOdbioru(zad.konto)`), a w
   endpoincie testowym z parametru zapytania; obie ścieżki są nierozróżnialne dla funkcji
   maskującej, więc dowód jest równoważny prawdziwemu logowaniu. Potwierdzono w kodzie
   (`server/trasy/portal.js:134-136, 1266-1282`), że rola NIE jest sterowalna przez klienta
   portalowego (brak parametru, wyłącznie sesja) — nie próbowano więc obchodzić tego inaczej, bo
   nie ma czego obchodzić. (b) dla samego faktu logowania portalowego (ekran, ciasteczko sesji
   `psa_sesja_portal`) — nie zweryfikowano wizualnie w przeglądarce, bo nie istnieje żadne konto o
   roli „akcjonariusz" do zalogowania.
2. **Rzeczywista treść zakresu AML dla emisji traktowanych jak transakcje** (decyzja Łukasza
   wspomniana w checkliście sesji) — potwierdzono w kodzie, że checklisty AML obejmują `objecie`
   (nie tylko `przeniesienie`), ale NIE oceniałem, czy podstawa przetwarzania tej części AML jest
   gdziekolwiek w aplikacji jawnie odróżniona od obowiązku prawnego KSH (poza tym, że dane leżą w
   tej samej tabeli — Z-150) — pytanie prawne poza zakresem kodu, zostawione bez oceny.
3. **Rzeczywista wysyłka i treść e-maila zawierającego klauzulę RODO** — SMTP nieskonfigurowany w
   środowisku audytowym (ta sama okoliczność co w FAZIE 1); zweryfikowano wyłącznie treść
   generowanego dokumentu (`oswiadczenieRodo`), nie samą wysyłkę.
4. **Zgodność notariusza jako „instytucji obowiązanej" i szczegółowy zakres AML** — sekcja 9
   `PRZEPISY-PSA.md` oznaczona ⚠️, niepotwierdzona przy tekście ustawy; zgodnie z zasadami sesji nie
   jest podstawą żadnej blokady/oceny w tym raporcie.
