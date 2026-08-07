# Rejestr akcjonariuszy P.S.A. — Kancelaria Notarialna Łukasza Kozona

Moduł do **prowadzenia rejestrów akcjonariuszy prostych spółek akcyjnych** (art. 300³⁰ i nast.
KSH) przez notariusza. Zastępuje w całości korzystanie z platformy *Rejestry Notarialne / Rejestr
PSA* (przejście pełne po zbudowaniu modułu — bez pracy równoległej).

Cel biznesowy: obsłużyć docelowo **~500 umów o prowadzenie rejestru** siłami jednej osoby na
sprawę, od przyjęcia dokumentów do wysłania zawiadomień. Konkurencja: domy maklerskie (rozliczają
się per akcjonariusz miesięcznie; obsługa mailowo-oddziałowa). Nasza przewaga: taksa notarialna
nie zależy od liczby akcjonariuszy + pełna samoobsługa online.

> Stosuje się **STANDARDY-KANCELARIA-4-1.md** (architektura, rdzeń, API + namespacing, dane,
> design, wydruk, konwencje). Poniżej specyfika modułu oraz **świadome odstępstwa** (sekcja 2).
> Port dev: **`:3005`**. Prefiks tabel: **`psa_*`**. Trasy: **`/api/psa/...`**.

---

## 1. Zakres i funkcje

- **Rejestr akcjonariuszy** prowadzony jako **łańcuch zdarzeń** (append-only); stan akcjonariatu
  jest wartością pochodną, nigdy edytowaną wprost.
- **Kreator zdarzenia** — użytkownik wybiera *co się stało* (przeniesienie akcji, emisja,
  umorzenie, zastaw, zajęcie…), a aplikacja sama zapisuje to do właściwych struktur i przelicza
  stan. Brak ręcznego wpisywania numerów akcji.
- **Obsługa sprawy end-to-end**: przyjęcie żądania i dokumentów → weryfikacja (checklista + AML)
  → wpis → automatyczne zawiadomienia → naliczenie opłaty.
- **Termin ustawowy 7 dni** liczony i pilnowany przez aplikację, z zawieszeniem na czas usuwania
  przeszkody.
- **Stan na dowolny dzień** — podgląd i wydruk akcjonariatu wstecz.
- **Portal klienta** (spółka i akcjonariusze): złożenie żądania, wgranie dokumentów, podgląd
  rejestru z maskowaniem danych wrażliwych, status sprawy.
- **Dokumenty generowane deterministycznie, offline**: zawiadomienie o wpisie, zawiadomienie o
  odmowie, informacja z rejestru, wezwanie do uzupełnienia, raport spółki, umowa o prowadzenie
  rejestru, uchwała o wyborze podmiotu.
- **Opłaty**: prowadzenie rejestru (rocznie), wpis, informacja z rejestru — wg taksy.
- **Integralność**: tabela zdarzeń append-only z łańcuchem skrótów + endpoint weryfikacji.

**Poza zakresem (świadomie):** rejestry akcjonariuszy S.A. i S.K.A. (notariusz nie może ich
prowadzić), obsługa walnych zgromadzeń, wypłata dywidendy, e-voting, wysyłki do KRS w imieniu
spółki.

---

## 2. Odstępstwa od mastera (WYMAGAJĄ ŚWIADOMEJ AKCEPTACJI)

To pierwszy moduł wychodzący poza LAN kancelarii. Trzy różnice wobec STANDARDY:

| Master | Tu | Uzasadnienie |
|---|---|---|
| „Nie wystawiać serwera publicznie — tylko LAN" | Aplikacja dostępna publicznie (portal klienta) | Bez samoobsługi klienta nie ma przewagi nad DM; obsługa 500 rejestrów mailem jest niewykonalna |
| Tożsamość = nagłówek `X-User-Name`, bez haseł | Logowanie e-mail + hasło (bcrypt), sesja w httpOnly cookie | Publiczny dostęp wyklucza identyfikację samym imieniem |
| Jeden wspólny plik bazy SQLite | Wspólny plik bazy **tylko** dla części kancelaryjnej; brak fizycznego dostępu z LAN do serwera publicznego | Patrz „Wariant wdrożenia" niżej |

**Wariant wdrożenia (do decyzji przed sprintem 3, nie blokuje sprintów 1–2):**
- **A) Wszystko na VPS w PL** — prościej, ale rejestr (dane osobowe akcjonariuszy) opuszcza
  serwer kancelarii. Wymaga: TLS, kopie zapasowe offsite, umowa powierzenia z hostingiem, RODO.
- **B) Rdzeń w kancelarii + cienka skrzynka podawcza na VPS** — VPS przyjmuje żądania i pliki,
  kancelaria je pobiera; rejestr nigdy nie wychodzi. Bezpieczniejsze, ale portal nie może
  pokazywać stanu rejestru na żywo (a to jest funkcja sprzedażowa).
- **Rekomendacja: A**, z szyfrowaniem kopii zapasowych i pełną kontrolą dostępu. Decyzja Łukasza.

Reszta mastera obowiązuje bez zmian: Node + Express, SQLite/`better-sqlite3`, React 18 z CDN bez
bundlera, wspólny `design.css`, kwoty w groszach, daty ISO 8601, polski w UI i kodzie domenowym,
brak bibliotek PDF, brak ORM.

**`design.css`:** plik **już istnieje** (`design.css`, wersja 1.0 — ekstrakcja 1:1 z Weryfikatora),
zawiera tokeny `:root` i gotowe klasy komponentów (`.btn`/`.btn-primary`/`.btn-danger`, `.card`,
`.tbl`, `.overlay`/`.modal`, `.fl`, pola formularza, `.empty`). **PSA linkuje go od pierwszego
dnia** (`<link rel="stylesheet" href="/wspolne/design.css">`), bez pisania własnego `<style>` od
zera i bez kopiowania tokenów do osobnego pliku — Kalkulator i Kasa wciąż mają to jako dług
migracyjny, PSA jako nowy moduł zaczyna już poprawnie.

Uwaga: realny plik nie zawiera `--panel`, `--sb`, `--r`/`--r-sm`/`--r-xs`, `--przejscie` z opisu w
mastera sekcji 9 — jeśli PSA ich potrzebuje (np. `--sb` do szerokości sidebara), dopisać do
`design.css` jako rozszerzenie wersji (np. 1.1), nie hardkodować lokalnie w module.

---

## 3. Podstawa prawna

> **Jedyne źródło prawne modułu: `PRZEPISY-PSA.md`.** Zawiera tekst przepisów z oznaczeniem, co
> obowiązuje, a co wchodzi 18.02.2027, mapę „przepis → element systemu" oraz sekcję 12 z listą
> przepisów, których w P.S.A. **nie ma**. Każda reguła w `server/logika/przepisy.js` wskazuje
> jednostkę redakcyjną z tego pliku.
>
> **Zakaz opierania się na opracowaniach branżowych.** Wcześniejsze wersje tej specyfikacji
> zawierały błędy wzięte z artykułów opisujących zmiany w **spółce akcyjnej**, przeniesione
> mechanicznie na P.S.A.

### Errata — cztery poprawki wobec wersji z 08.2026

1. **Nie ma pośredniczenia w wypłatach.** Odpowiednika art. 328¹⁰ KSH w Dziale IA brak. Dywidendę
   wypłaca spółka bezpośrednio. Nie trzeba niczego wyłączać w umowie (dawna decyzja 7 — usunięta).
2. **Nowelizacja nie rozszerza katalogu danych rejestru** (art. 300³³ § 1 pkt 1–11 bez zmian).
   PESEL, data urodzenia, numer w rejestrze osób prawnych i współwłasność **nie są** obowiązkową
   treścią rejestru P.S.A. Dodano wyłącznie zakaz udostępniania PESEL-u, daty urodzenia i adresu
   zamieszkania pozostałym akcjonariuszom (art. 300³⁵ § 1¹).
3. **Nie ma wymogów formy zgody na wpis.** Art. 300³⁴ § 3 nie zawiera katalogu form podpisu.
4. **Zgłoszenie zmian danych z art. 300³³ § 3 idzie do nas**, nie do sądu rejestrowego — od 2027
   to nowy, obowiązkowy strumień przychodzący od zarządu spółki.

### Cztery zegary ustawowe w module

| Termin | Podstawa | Bieg |
|---|---|---|
| **7 dni na wpis** | 300³⁴ § 1 | od otrzymania żądania; przy przeszkodzie — od jej usunięcia |
| **7 dni na zawiadomienie sądu** o wygaśnięciu/rozwiązaniu umowy 🔵 | 300³² § 3 | od daty wygaśnięcia/rozwiązania |
| **7 dni zarządu** na zgłoszenie zmian danych 🔵 | 300³³ § 3 | od zdarzenia (my tylko przypominamy) |
| **3 lata** na wniesienie wkładów | 300⁹ § 1 | od wpisu spółki do KRS (my tylko przypominamy) |

## 4. Reguły domenowe (KRYTYCZNE — nie zmieniać bez potwierdzenia)

1. **`psa_zdarzenia` jest append-only.** Żadnego `UPDATE`, żadnego `DELETE`. Pomyłka = zdarzenie
   `sprostowanie` wskazujące zdarzenie prostowane. W UI **nie istnieje przycisk „Edytuj"** dla
   zdarzenia.
2. **Stan akcjonariatu jest pochodną zdarzeń.** `psa_stan_akcji` i `psa_obciazenia` to
   materializacja dla szybkości — muszą dać się odbudować w całości ze zdarzeń
   (`POST /api/psa/spolki/:id/przelicz`). Test obowiązkowy: odbudowa = stan bieżący.
3. **Bilans akcji musi się zgadzać zawsze** (art. 300³¹ § 2). Dla **każdego numeru akcji** suma
   ułamków wszystkich uprawnionych wynosi dokładnie `1` albo `0` (akcja nieobjęta). Reguła
   „suma akcji = wyemitowane − umorzone" jest jej szczególnym przypadkiem. Naruszenie = **odmowa
   zapisu**, nie ostrzeżenie.
4. **Numery akcji przydziela aplikacja.** Użytkownik podaje wyłącznie ilość. Algorytm: FIFO po
   najniższym wolnym numerze w serii, z możliwością ręcznego nadpisania zakresu (rzadki przypadek
   — np. przeniesienie konkretnych obciążonych akcji). **Wyjątek: przy ułamku użytkownik wskazuje
   konkretny numer akcji i ułamek, nie ilość.**
4a. **Ułamkowe części akcji** (art. 300² § 3 + art. 300⁴³). Akcji nie da się podzielić na mniejsze
   akcje, ale można być uprawnionym do **ułamka jednej, oznaczonej numerem akcji** i nim
   rozporządzać. Stąd:
   - ułamek zapisujemy jako parę **`INTEGER`** (`czesc_licznik`, `czesc_mianownik`), domyślnie 1/1
     — **żadnych floatów ani stałoprzecinkowych**, bo 1/3 nie ma skończonego rozwinięcia;
   - arytmetyka na liczbach wymiernych: porównania przez mnożenie na krzyż, sumowanie przez wspólny
     mianownik, wynik zawsze skracany;
   - **wiersz z ułamkiem ≠ 1/1 obejmuje dokładnie jeden numer akcji** (`nr_od = nr_do`) —
     wymuszone `CHECK` w schemacie, nie konwencją;
   - **głos liczy się per akcja, nie per ułamek** (art. 300²³ § 1): akcja dzielona daje jeden głos,
     przypisany wspólnemu przedstawicielowi;
   - procent udziału liczony na ułamkach, zaokrąglany **wyłącznie przy wyświetlaniu**.
4b. **Współuprawnieni** (art. 300³⁸ § 3–4). Akcja z ułamkami ma pole **wspólnego przedstawiciela**;
   jego brak nie blokuje wpisu, ale jest oznaczany w rejestrze i na wydruku (spółka może wtedy
   składać oświadczenia wobec któregokolwiek ze współuprawnionych).
4c. **Pokrycie akcji** (art. 300³³ § 1 pkt 9, art. 300⁹, art. 300⁴⁰). Wzmianka o pokryciu jest
   ustawowym elementem rejestru. Zbycie akcji nie w pełni pokrytej **wymaga zgody spółki** — reguła
   blokująca. Domyślne zaliczanie wkładów: **równomiernie na wszystkie akcje akcjonariusza**
   (art. 300⁹ § 3), chyba że umowa spółki stanowi inaczej.
5. **Kwoty w groszach (`INTEGER`).** Cena emisyjna, opłaty. Żadnych floatów.
6. **Data zdarzenia ≠ data wpisu.** `data_zdarzenia` (z dokumentu, `DATE`) i `data_wpisu`
   (`DATETIME` co do sekundy, ustawiana przez system, nieedytowalna).
7. **Termin 7 dni** liczony w `server/logika/terminy.js` (czysta funkcja): od `data_wplywu`,
   zawieszany na czas stanu `wstrzymana`, wznawiany od dnia usunięcia przeszkody.
8. **Zajęcie egzekucyjne**: ścieżka z urzędu — bez żądania, bez uprzedniego powiadomienia
   zainteresowanego, **bez opłaty**.
9. **Maskowanie danych wrażliwych** (PESEL, data urodzenia, adres zamieszkania) w każdym widoku i
   dokumencie kierowanym do **innego akcjonariusza**. Pełne dane: kancelaria, sama osoba, spółka,
   organy wymienione w art. 300³⁵ § 1¹.
10. **Osoby w kartotece wspólnej** (`psa_osoby`) — jeden inwestor w wielu spółkach wpisywany raz.
11. **Nie prowadzimy rejestru dla S.A./S.K.A.** — walidacja przy dodawaniu spółki (forma prawna
    musi być PSA).
12. **Akcje nie istnieją przed wpisem do KRS** (art. 300³⁰ § 2, art. 300¹⁰⁷ § 3). Wpis akcji do
    rejestru możliwy dopiero po wpisie spółki albo emisji do KRS. Sankcja karna wobec zarządu
    (art. 592 § 3) → **twarda blokada**, nie ostrzeżenie.
13. **Wpis bywa deklaratoryjny** (art. 300³⁷ § 2). Przy objęciu akcji, dziedziczeniu, zapisie
    windykacyjnym, aporcie akcji, połączeniu, podziale, przekształceniu i innych przejściach
    z mocy prawa — prawo przechodzi poza rejestrem, wpis tylko ujawnia stan. Inna checklista, inna
    treść zawiadomienia, inne skutki opóźnienia. Wyjątek: warunkowa emisja (art. 300¹¹⁸ § 1) —
    tam wpis jest konstytutywny.
14. **Rejestr nie pośredniczy w płatnościach.** Żadnych przepływów pieniężnych, dywidend ani
    rozliczeń spłat — patrz `PRZEPISY-PSA.md` sekcja 12 pkt 1.

---

## 5. Model danych (tabele `psa_*` we wspólnej bazie)

### `psa_spolki`
`id`, `krs` (UNIQUE), `nip`, `regon`, `nazwa`, `kraj`, `kod_pocztowy`, `miejscowosc`, `ulica`,
`nr_domu`, `nr_lokalu`, `sad_rejestrowy`, `wydzial`, `telefon`, `email`, `www`,
`status` (`aktywna`/`w_likwidacji`/`zawieszona`/`wykreslona`), `komentarz_statusu`,
`data_utworzenia_spolki`, `data_uchwaly_wyboru`, `data_umowy`, `data_otwarcia_rejestru`,
`umowe_zawarl` (`notariusz`/`zastepca`/`osoba_upowazniona`), `umowe_zawarl_imie_nazwisko`
(art. 300³² § 1² — wymagane w zgłoszeniu do KRS), `dodatkowe_informacje_umowa_spolki`
(art. 300³³ § 2), `zakaz_glosu_zastawnika` 0/1 (art. 300²³ § 2),
`data_zakonczenia_umowy`, `opis` (drukowany na raporcie), `uwagi` (wewnętrzne, nigdy na wydruku),
`utworzono`, `zaktualizowano`.

### `psa_osoby` — kartoteka wspólna
`id`, `typ` (`fizyczna`/`prawna`), `nazwisko`, `imie`, `nazwa`, `pesel`, `data_urodzenia`, `nip`,
`regon`, `numer_w_rejestrze`, `nazwa_rejestru`, `kraj`, `kod_pocztowy`, `miejscowosc`, `ulica`,
`nr_domu`, `nr_lokalu`, `adres_doreczen`, `adres_edoreczen`, `email`, `telefon`,
`zgoda_email` 0/1 (art. 300³³ § 1 pkt 5 — **adres doręczeń dla zwołania WZ**, art. 300⁸⁷ § 1),
`zadanie_powiadomien_auto` 0/1 + `kanal_powiadomien` (`portal`/`email`/`edoreczenia`) —
art. 300³⁴ § 9 🔵, `aml_status` (`brak`/`wykonane`/`niemozliwe`),
`aml_data`, `aml_notatka`, `utworzono`.

### `psa_emisje`
`id`, `spolka_id` FK, `tytul`, `podstawa_prawna`, `seria`, `nr_pierwszy`, `ilosc`,
`cena_emisyjna_grosze`, `waluta` (domyślnie `PLN`), `data_emisji`,
**`data_wpisu_krs`** (NULL = akcje jeszcze nie istnieją, blokada wpisu — art. 300³⁰ § 2),
**`rodzaj_akcji`** (`zwykla`/`uprzywilejowana`/`zalozycielska`/`niema` — art. 300³³ § 1 pkt 4),
`obowiazki_wobec_spolki` (art. 300³³ § 1 pkt 11),
`status` (`aktywna`/`w_umarzaniu`/`umorzona`/`wykreslona`), `zdarzenie_id` FK, `opis`, `uwagi`.

### `psa_zdarzenia` — ŹRÓDŁO PRAWDY (append-only)
`id`, `spolka_id` FK, `typ` (katalog z sekcji 6), `data_zdarzenia` (DATE),
`data_wpisu` (DATETIME), `autor`, `sprawa_id` FK NULL, `dane_json` (pełna treść zdarzenia —
snapshot, nie referencje), `zdarzenie_prostowane_id` NULL, `uzasadnienie` NULL,
`hash_poprzedni`, `hash`.

`hash` = `sha256(id + spolka_id + typ + data_zdarzenia + data_wpisu + autor + dane_json + hash_poprzedni)`.
Łańcuch **globalny** (nie per spółka) — prostsze i wykrywa usunięcie całego rekordu.
Implementacja: `node:crypto`, bez zależności zewnętrznych.

### `psa_stan_akcji` — materializacja (przedziały czasowe)
`id`, `spolka_id`, `emisja_id`, `osoba_id`, `nr_od`, `nr_do`, `ilosc` (redundantnie, dla czytelności),
**`czesc_licznik` INTEGER NOT NULL DEFAULT 1**, **`czesc_mianownik` INTEGER NOT NULL DEFAULT 1**,
**`przedstawiciel_osoba_id`** NULL (wspólny przedstawiciel współuprawnionych — art. 300³⁸ § 3),
**`pokryta`** (`tak`/`nie`/`czesciowo` — art. 300³³ § 1 pkt 9),
`zdarzenie_od_id`, `data_od`, `zdarzenie_do_id` NULL, `data_do` NULL.

Ograniczenia schematu (`CHECK`, nie konwencja):
- `czesc_mianownik > 0` i `czesc_licznik BETWEEN 1 AND czesc_mianownik`;
- `czesc_licznik = czesc_mianownik OR nr_od = nr_do` — **ułamek zawsze na pojedynczym numerze**;
- ułamek zapisywany w postaci skróconej (NWD = 1).

Stan na moment `T`: `WHERE data_od <= T AND (data_do IS NULL OR data_do > T)`.

### `psa_obciazenia`
`id`, `spolka_id`, `typ` (`zastaw`/`uzytkowanie`/`zajecie`), `emisja_id`, `nr_od`, `nr_do`,
`osoba_id` (zastawnik/użytkownik/organ egzekucyjny), `prawo_glosu` 0/1 (art. 300³³ § 1 pkt 7),
`blokuje_rozporzadzanie` 0/1, `opis`, `zdarzenie_ustanowienia_id`, `data_od`,
`zdarzenie_wykreslenia_id` NULL, `data_do` NULL.

### `psa_uprawnienia`
`id`, `spolka_id`, `rodzaj` (`uprawnienie`/`przywilej`/`obowiazek`), `zakres`
(`spolka`/`emisja`/`akcjonariusz`), `emisja_id` NULL, `osoba_id` NULL, `tytul`, `tresc`,
`data_ustanowienia`, `zdarzenie_id`, `status` (`aktywne`/`wykreslone`), `data_wykreslenia`.

### `psa_ograniczenia` — ograniczenia w rozporządzaniu akcją (art. 300³³ § 1 pkt 10, art. 300³⁴ § 6)
`id`, `spolka_id`, `zakres` (`wszystkie`/`emisja`/`zakres_numerow`), `emisja_id` NULL, `nr_od`,
`nr_do`, `wymaga_zgody_spolki` 0/1, `prawo_pierwszenstwa` 0/1, `opis`, `zdarzenie_id`, `status`.

### `psa_sprawy` — workflow
`id`, `spolka_id`, `typ_zdarzenia`, `zrodlo` (`portal`/`email`/`papier`/`z_urzedu`),
`zadajacy_osoba_id` NULL, `zadajacy_opis` (gdy nie z kartoteki), `data_wplywu` (DATETIME),
`stan` (`nowa`/`weryfikacja`/`wstrzymana`/`wpisana`/`odmowa`/`anulowana`),
`termin_do` (wyliczany), `wstrzymana_od`, `dni_wstrzymania` (skumulowane),
`wymaga_powiadomienia` 0/1, `zgoda_forma` NULL, `zgoda_data` NULL,
`sygnatura_postepowania` NULL (wymagana dla zapytań organów — art. 300³⁵ § 4 🔵),
`charakter_wpisu` (`konstytutywny`/`deklaratoryjny` — art. 300³⁷),
`powiadomienie_wyslano` NULL, `zdarzenie_id` NULL, `powod_odmowy` NULL, `autor`, `notatka`.

### `psa_dokumenty`
`id`, `sprawa_id`, `nazwa_pliku`, `sciezka`, `mime`, `rozmiar`, `typ_dokumentu`
(`umowa_zbycia`/`uchwala`/`zgoda`/`postanowienie`/`pelnomocnictwo`/`inny`), `hash`, `wgral`,
`utworzono`. **Pliki na dysku**, nie w bazie; katalog per spółka.

### `psa_wydane_dokumenty` — ślad wysyłki
`id`, `sprawa_id` NULL, `spolka_id`, `typ` (`zawiadomienie_wpis`/`zawiadomienie_odmowa`/
`informacja_z_rejestru`/`wezwanie`/`raport`), `odbiorca_osoba_id`, `kanal` (`email`/`portal`/`papier`),
`sciezka_pdf`, `wyslano`, `autor`.

### `psa_oplaty`
`id`, `spolka_id`, `sprawa_id` NULL, `typ` (`prowadzenie`/`wpis`/`informacja`),
`okres` (dla `prowadzenie`, np. `2026`), `kwota_grosze`, `status` (`naliczona`/`zafakturowana`/
`oplacona`/`anulowana`), `data_naliczenia`, `notatka`.
*Integracja z modułem Kasa: opcjonalna, w przyszłości (pozycja `zrodlo='psa'`). Na start osobno.*

### `psa_konta` — dostęp portalowy
`id`, `email` (UNIQUE), `hash_hasla`, `rola` (`spolka`/`akcjonariusz`), `spolka_id` NULL,
`osoba_id` NULL, `aktywne` 0/1, `token_aktywacji`, `ostatnie_logowanie`.

### `psa_uzytkownicy` — pracownicy kancelarii
`id`, `imie`, `email` (UNIQUE), `hash_hasla`, `rola` (`admin`/`pracownik`), `aktywny`.
Admin = Łukasz (env `ADMIN_EMAIL`).

---

## 6. Katalog typów zdarzeń

Każdy typ definiuje: pola kreatora, **checklistę weryfikacji**, **walidacje blokujące**,
generowane dokumenty i odpłatność. Definicje w `server/logika/typy-zdarzen.js` (dane, nie kod
rozproszony po routerach).

| Typ | Opis | Odpłatne | Wymaga powiadomienia (art. 300³⁴ § 3) |
|---|---|---|---|
| `emisja` | Nowa emisja akcji (założycielska lub kolejna) | tak | nie |
| `objecie` | Objęcie akcji z emisji przez akcjonariusza | tak | nie |
| `przeniesienie` | Sprzedaż / darowizna / dziedziczenie / inne przejście akcji | tak | **tak** (zbywca) |
| `zobowiazanie` | Oświadczenie o zobowiązaniu do przeniesienia/obciążenia (art. 300³⁴ § 4 zd. 2) | tak | tak |
| `umorzenie` | Umorzenie akcji | tak | tak |
| `obciazenie` | Ustanowienie zastawu / użytkowania | tak | **tak** (akcjonariusz) |
| `wykreslenie_obciazenia` | Wykreślenie ograniczonego prawa rzeczowego (art. 300³³ § 1 pkt 8) | tak | nie |
| `prawo_glosu_zastawnika` | Wpis o prawie głosu zastawnika/użytkownika (pkt 7) | tak | tak |
| `zajecie` | Zajęcie praw majątkowych przez komornika / organ egzekucyjny | **nie** | **nie** (wyjątek § 2) |
| `wykreslenie_zajecia` | Uchylenie zajęcia | nie | nie |
| `zmiana_danych_akcjonariusza` | Adres, e-mail, nazwisko, zgoda na komunikację elektroniczną | tak | nie |
| `zmiana_danych_spolki` | Firma, siedziba, adres, dane KRS | tak | nie |
| `uprawnienie` | Ustanowienie/zmiana/wykreślenie uprawnienia, przywileju, obowiązku | tak | nie |
| `ograniczenie` | Ograniczenia co do rozporządzania akcją | tak | nie |
| `zdarzenie_inne` | WZA, zmiana umowy spółki, inne bez odzwierciedlenia w pozostałych strukturach | tak | nie |
| `sprostowanie` | Korekta wcześniejszego zdarzenia | nie | zależnie od treści |
| `przeniesienie_ulamka` | Przeniesienie ułamkowej części oznaczonej akcji (art. 300⁴³) | tak | **tak** |
| `objecie_warunkowe` | Objęcie akcji z warunkowej emisji — podstawą **dyspozycja zarządu**, nie żądanie akcjonariusza (art. 300¹¹⁷ § 2); wpis **konstytutywny** (art. 300¹¹⁸ § 1) | tak | nie |
| `pokrycie_akcji` | Wzmianka o pokryciu — podstawa: uchwała zarządu (art. 300⁹ § 2) | tak | nie |
| `przedstawiciel` | Wskazanie/zmiana wspólnego przedstawiciela współuprawnionych (art. 300³⁸ § 3) | tak | nie |
| `uniewaznienie` | Unieważnienie akcji orzeczeniem sądu (art. 300⁵¹) | nie | nie |
| `zgloszenie_zarzadu` 🔵 | Zgłoszenie zmian danych pkt 1–4 i 9–11 przez zarząd (art. 300³³ § 3) | tak | nie |

### Checklisty (przykłady — pełne w `typy-zdarzen.js`)

**`przeniesienie`:**
- [ ] dokument stanowiący podstawę (umowa zbycia / postanowienie o stwierdzeniu nabycia spadku / inny)
- [ ] badanie treści i formy dokumentu (art. 300³⁴ § 5) — z odrębnym przełącznikiem
      **„uzasadnione wątpliwości"**, który wymusza notatkę i przełącza sprawę na ścieżkę pogłębioną
- [ ] AML nabywcy (status `wykonane`)
- [ ] brak ograniczeń w rozporządzaniu / zgoda spółki uzyskana / prawo pierwszeństwa wyczerpane
- [ ] zgoda zbywcy **albo** wysłane powiadomienie o treści zamierzonego wpisu

**`emisja`:**
- [ ] uchwała WZA lub akt założycielski
- [ ] seria nie koliduje z istniejącą
- [ ] zgodność z uprawnieniami (np. minimalny udział głosów z akcji założycielskich)

**`zajecie`:**
- [ ] zawiadomienie organu egzekucyjnego
- [ ] identyfikacja akcji dłużnika (zakres numerów)

### Walidacje blokujące (wspólne, `server/logika/walidacje.js`)

Zapis odrzucany z komunikatem po polsku, gdy:
- suma ułamków na którymkolwiek numerze akcji ≠ 1 (albo ≠ 0 dla akcji nieobjętej),
- bilans akcji po zdarzeniu ≠ wyemitowane − umorzone (per seria),
- zbywca nie posiada wskazanej liczby akcji **lub ułamka** na moment zdarzenia,
- **emisja nie ma `data_wpisu_krs`** (art. 300³⁰ § 2, sankcja z art. 592 § 3),
- **zbycie akcji nie w pełni pokrytej bez zgody spółki** (art. 300⁴⁰ § 1),
- **wpis prawa głosu zastawnika, gdy umowa spółki tego zakazuje** (art. 300²³ § 2),
- **rozwiązanie umowy o prowadzenie rejestru bez wskazania nowego podmiotu** (art. 300³² § 2),
- ułamek zapisany na zakresie numerów szerszym niż jedna akcja,
- akcje należą do emisji, która nie została objęta,
- akcje są objęte zajęciem lub obciążeniem z `blokuje_rozporzadzanie=1`,
- `data_zdarzenia` jest z przyszłości lub wcześniejsza niż ostatnie zdarzenie na tych akcjach,
- zakres numerów wykracza poza serię lub nakłada się na cudzy,
- spółka ma status `wykreslona`.

---

## 7. Ścieżka sprawy (maszyna stanów)

```
                    ┌──────────────► odmowa (art. 300³⁴ § 7 zd. 2)
                    │
nowa ──► weryfikacja ──► wpisana ──► [zawiadomienia + opłata]
           ▲   │
           │   └──► wstrzymana (przeszkoda; licznik 7 dni zatrzymany)
           └────────┘  (usunięcie przeszkody → 7 dni liczone od nowa)
```

- **nowa** — `data_wplywu` zapisana co do sekundy, kanał, żądający. Start licznika.
- **weryfikacja** — checklista + AML + ograniczenia + ewentualne powiadomienie zainteresowanego.
- **wstrzymana** — wygenerowane wezwanie do uzupełnienia; `wstrzymana_od`; po uzupełnieniu
  `dni_wstrzymania` rośnie, `termin_do` przeliczany.
- **wpisana** — zapis zdarzenia, przeliczenie stanu, generowanie i wysyłka zawiadomień do
  **żądającego i spółki**, naliczenie opłaty.
- **odmowa** — obowiązkowe `powod_odmowy`; zawiadomienie do żądającego z uzasadnieniem.

Ścieżka `z_urzedu` (zajęcie): `nowa → wpisana`, bez powiadomienia uprzedniego, bez opłaty.

---

## 8. Endpointy `/api/psa/...`

**Kancelaria (wymaga sesji pracownika):**
- `spolki` — GET (lista + filtry), POST, GET `/:id` (kokpit: stan + emisje + obciążenia +
  uprawnienia + ostatnie zdarzenia), PUT `/:id` (dane spółki → tworzy zdarzenie
  `zmiana_danych_spolki`), GET `/:id/stan?data=YYYY-MM-DD`, GET `/:id/zdarzenia`,
  POST `/:id/przelicz` (odbudowa materializacji ze zdarzeń, admin).
- `spolki/z-krs/:numer` — GET (pobranie danych z otwartego API KRS; przy błędzie → 200 z pustym
  wynikiem i komunikatem, formularz do wypełnienia ręcznego).
- `osoby` — GET (wyszukiwarka kartoteki), POST, PUT `/:id`, GET `/:id/spolki`.
- `sprawy` — GET (kolejka, sort po `termin_do`), POST, GET `/:id`, PATCH `/:id`
  (przejścia stanów: `wstrzymaj`, `wznow`, `odmow`), POST `/:id/dokumenty` (upload, `multer`),
  POST `/:id/powiadomienie` (wysłanie powiadomienia z art. 300³⁴ § 3),
  **POST `/:id/wpisz`** (transakcja: zdarzenie + materializacja + dokumenty + opłata).
- `zdarzenia/:id/sprostuj` — POST.
- `oplaty` — GET (filtry), POST `/naliczenie-roczne` (admin, idempotentne per spółka+rok).
- `integralnosc` — GET (weryfikacja łańcucha skrótów; zwraca `ok` albo `id` pierwszego zerwanego).
- `dokumenty/:typ` — GET (generowanie PDF/HTML do wydruku).

**Portal (sesja klienta):**
- `portal/moje` — GET (spółki/akcje zalogowanego, **z maskowaniem**).
- `portal/rejestr/:spolkaId` — GET (stan akcjonariatu z maskowaniem wg roli).
- `portal/zadania` — POST (złożenie żądania wpisu + upload), GET (statusy moich spraw).
- `portal/informacja` — POST (żądanie informacji z rejestru).

**Wspólne (rdzeń):** `/api/wspolne/kancelaria` (nagłówki dokumentów).

Przyszłe funkcje jako stub `501`: `sad/zapytania` (art. 25da), `sad/zawiadomienie-o-rozwiazaniu`
(art. 300³² § 3) — uruchamiane przy wejściu nowelizacji.

---

## 9. Specyfika UI / ekrany

Sidebar: **Praca** (Kolejka spraw / Spółki / Kartoteka osób) · **Rozliczenia** (Opłaty) ·
**Konfiguracja** (Stawki / Szablony dokumentów / Użytkownicy — tylko admin).

### 9.0. Kierunek wizualny (ustalony 08.2026, przed sprintem 5)

Paleta, przyciski, karty, pola i tabele — **bez zmian, ze wspólnego `design.css`**. Ustalenia
dotyczą wyłącznie warstwy układu i typografii:

- **Trzy role typograficzne.** EB Garamond wyłącznie na nazwy spółek i tytuły ekranów. Inter na
  całe UI. **Mono na numery i serie akcji** (`AZ 96–100` to identyfikator techniczny, nie liczba —
  mono ustawia go w kolumnie i odróżnia od ilości). Ilości i procenty: Inter + `tabular-nums`.
- **Szerokości treści:** **1180 px** kokpit spółki i listy, **720 px** kreator i formularze.
  ⚠ **Świadome odstępstwo** od `max-width:1000px` z mastera sekcja 9.4 — tabela akcjonariatu
  z paskiem serii nie mieści się w 1000 px. Nie „poprawiać" przy scalaniu modułów.
- **Element sygnaturowy — pasek serii.** Pozioma wstęga reprezentująca całą emisję, podzielona
  proporcjonalnie na segmenty akcjonariuszy; akcje nieobjęte = `--paper-3`; obciążenia i zajęcia =
  ukośne kreskowanie nałożone na segment; hover = akcjonariusz + zakres; klik = przewinięcie do
  wiersza. Wierny obraz danych (numery akcji są ciągłe), nie ozdobnik. **Tylko na ekranie** —
  na wydruku zostaje tabela (kreskowanie ginie na druku czarno-białym).
- **Tryb archiwalny jako stan całego ekranu.** Gdy „stan na" ≠ teraz: tło aplikacji `--paper-2`,
  pigułka „Widok archiwalny — <data>" w topbarze z powrotem do dziś, **wszystkie przyciski akcji
  znikają** (nie wyszarzają się). Eliminuje pomylenie przeszłości z teraźniejszością i wpis
  „w przeszłości".
- **Mikro-interakcje:** wiersz kolejki jest linkiem (bez menu kontekstowego); aging jako cienki
  pasek na lewej krawędzi wiersza (`--burgundy` przy ≤2 dniach), nie kolorowanie tła; animacja
  tylko przy zmianie stanu paska serii i rozwijaniu szczegółu.
- **Puste stany mówią, co zrobić** („Brak spraw w toku. Nowe zgłoszenia z portalu pojawią się
  tutaj."), nie „Brak danych".
- **Portal to ten sam system, nie odchudzona wersja** — ta sama paleta, ten sam pasek serii,
  mniej kolumn.

### Pulpit
Dwie kolumny: **sprawy w toku** posortowane po pozostałym czasie (≤2 dni = `--burgundy`,
po terminie = wyróżnienie) i **spółki** z liczbą akcjonariuszy i datą ostatniego zdarzenia.

### Kokpit spółki — JEDEN EKRAN
- nagłówek: nazwa, KRS/NIP, status, data umowy, organ prowadzący;
- **suwak „stan na"** przełączający cały ekran wstecz — **z dokładnością do minuty**, bo wpisy
  z tego samego dnia mają kolejność (podpatrzone u DM BOŚ);
- **pasek serii** (sekcja 9.0) nad tabelą;
- **przełącznik widoku: uproszczony / szczegółowy** — uproszczony = jeden wiersz na akcjonariusza
  (szybki przegląd struktury, zarazem cap table dla spółki); szczegółowy = wiersz na zakres
  numerów, z obciążeniami i uprawnieniami;
- **tabela akcjonariatu**: akcjonariusz | seria | ilość | numery | % udziału | znaczniki obciążeń;
- zwijane sekcje: Emisje · Uprawnienia i przywileje · Obciążenia i zajęcia · Ograniczenia ·
  Historia zdarzeń (oś czasu);
- jeden duży przycisk **„Nowe zdarzenie"**;
- przyciski wydruku: raport spółki, informacja z rejestru.

### Kreator zdarzenia — 4 kroki, ten sam schemat dla każdego typu
1. **Wybór typu** — kafelki z ikonami, opisane językiem zdarzenia („Ktoś sprzedał lub przekazał
   akcje"), nie nazwami rejestrów.
2. **Podstawa** — upload/wybór dokumentów (drag&drop), podgląd PDF po prawej, data zdarzenia,
   żądający.
3. **Co się zmienia** — dla `przeniesienie`: zbywca z listy (widoczne ile ma i jakie numery) →
   **tylko ilość** → nabywca (z kartoteki lub nowy). Aplikacja pokazuje wyliczony zakres numerów
   do potwierdzenia.
4. **Weryfikacja i podgląd** — checklista + automatyczne ostrzeżenia + tabela **przed/po** ze
   zmianami podświetlonymi + lista dokumentów do wygenerowania. Przycisk „Dokonaj wpisu"
   nieaktywny do czasu odhaczenia checklisty.

Zasady: jedna kolumna, duże pola, przycisk „Dalej" zawsze w tym samym miejscu, brak modali
w modalach, każdy krok da się cofnąć bez utraty danych, `Esc` nie zamyka kreatora bez pytania.

### Portal klienta
Minimalny: lista moich spółek/akcji, przycisk „Zgłoś zmianę" (ten sam kreator, ale bez kroku
weryfikacji — klient tylko składa żądanie i wgrywa dokumenty), status spraw, pobranie informacji
z rejestru.

---

## 10. Wydruki i dokumenty

Natywny `window.print()` + `@media print` (bez bibliotek PDF), nagłówek z `rdzen_kancelaria`.

| Dokument | Treść |
|---|---|
| **Raport spółki** | dane spółki, organ prowadzący rejestr, uprawnienia/przywileje, emisje, akcjonariusze na wskazany dzień |
| **Informacja z rejestru** | art. 300³⁵ — zakres wg roli odbiorcy, z maskowaniem dla innego akcjonariusza |
| **Zawiadomienie o wpisie** | do żądającego i do spółki; treść wpisu, data i godzina |
| **Zawiadomienie o odmowie** | z podaniem przyczyn (art. 300³⁴ § 7 zd. 2) |
| **Powiadomienie o zamierzonym wpisie** | art. 300³⁴ § 3 |
| **Wezwanie do uzupełnienia** | wskazanie przeszkody i skutków |
| **Umowa o prowadzenie rejestru** + **uchwała o wyborze** | szablony dla nowej spółki |
| **Lista akcjonariuszy do KRS** | art. 300³⁴ § 8 — generowana **razem z zawiadomieniem o wpisie**, do podpisu wszystkich członków zarządu, ze wzmianką o zastawie/użytkowaniu |
| **Oświadczenie zarządu o zawarciu umowy** 🔵 | art. 300³² § 1³ — załącznik do zgłoszenia w KRS, wraz z kartą danych z § 1² |
| **Lista uprawnionych do udziału w WZ** | art. 300⁹¹ — stan rejestru na dzień WZ − 3 dni |
| **Informacja z rejestru — postać papierowa** | art. 300³⁵ § 3 — osobny typ sprawy |
| **Zawiadomienie sądu o rozwiązaniu umowy** 🔵 | art. 300³² § 3 — ze wskazaniem daty, kanał teleinformatyczny |
| **Wykaz akcjonariuszy** | art. 476 § 1¹ — przy wykreśleniu spółki |

**Czego NIE umieszczać na wydrukach dla klienta:** pole `uwagi` (wewnętrzne), checklisty
weryfikacji, notatki AML, dane kontaktowe innych akcjonariuszy, hashe, **pasek serii**
(kreskowanie obciążeń ginie na druku czarno-białym — zostaje tabela).

**Obowiązkowy dopisek na eksportach roboczych** (XLSX/CSV z listy akcjonariatu): „Zestawienie
robocze — nie stanowi informacji z rejestru akcjonariuszy w rozumieniu art. 300³⁵ KSH."
Wzorowane na rozwiązaniu DM BOŚ; zapobiega traktowaniu eksportu jak dokumentu urzędowego.

---

## 11. Integralność i bezpieczeństwo

- `psa_zdarzenia` **append-only** + łańcuch `sha256` (`node:crypto`, zero zależności).
- `GET /api/psa/integralnosc` — przelicza cały łańcuch, zwraca `ok` albo pierwszy zerwany rekord.
  Wywoływane nocnie; wynik na pulpicie jako dyskretny znacznik.
- Hasła: `bcrypt` (jedyna nowa zależność bezpieczeństwa), sesja w httpOnly cookie, `SameSite=Lax`.
- Rate limiting na logowaniu portalu (własna implementacja, licznik w pamięci).
- HTTPS obowiązkowo (reverse proxy).
- **Pliki dokumentów** poza katalogiem publicznym; serwowane wyłącznie przez endpoint
  sprawdzający uprawnienia.
- Kopie: nocny dump SQLite + katalog plików, szyfrowane, offsite.
- **Nie logujemy** treści dokumentów ani danych osobowych — wyłącznie metadane techniczne.

Świadomie **nie robimy** (decyzja Łukasza — minimum komplikacji): kwalifikowanych znaczników
czasu, drzew Merkle'a, publikacji skrótów, formatów archiwalnych XAdES/PAdES, integracji z
podpisem kwalifikowanym. Dokumenty wychodzące podpisywane są poza aplikacją, jak każde inne.

---

## 12. Zmienne środowiskowe

- `PORT` (domyślnie `3005`)
- `WSPOLNA_BAZA` — ścieżka pliku bazy
- `KATALOG_DOKUMENTOW` — katalog plików spraw
- `ADMIN_EMAIL` — konto administratora
- `SESJA_SEKRET` — klucz podpisu sesji
- `SMTP_*` — wysyłka zawiadomień (host, port, user, pass, from)
- `KRS_API_URL` — otwarte API KRS (z sensownym domyślnym)
- `PORTAL_WLACZONY` (domyślnie `false` — portal za flagą do czasu sprintu 3)

## 13. Zależności

`express`, `better-sqlite3`, `multer` (upload), `bcrypt` (hasła), `nodemailer` (wysyłka).
Front: React 18 + Babel z CDN, **wersje przypięte** (`@babel/standalone@7.26.4`,
`react`/`react-dom@18.3.1`) — jak w module Kasa.
**Bez** bibliotek PDF, bundlera, TypeScriptu, Tailwinda, ORM-a.

---

## 14. Plan sprintów

**Sprint 1 — rdzeń rejestru (bez workflow, bez portalu)** ⛔ STOP
- [ ] Szkielet modułu wg sekcji 4 mastera; migracje idempotentne; pragmy WAL.
- [ ] Tabele: `psa_spolki`, `psa_osoby`, `psa_emisje`, `psa_zdarzenia`, `psa_stan_akcji`,
      `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia`.
- [ ] `logika/przepisy.js`, `logika/typy-zdarzen.js`, `logika/walidacje.js`,
      `logika/stan.js` (odbudowa stanu ze zdarzeń), `logika/numery.js` (przydział zakresów).
- [ ] Kokpit spółki + kreator zdarzenia dla typów: `emisja`, `objecie`, `przeniesienie`,
      `umorzenie`.
- [ ] Dodawanie spółki (3 kroki, z pobraniem z KRS), kartoteka osób.
- [ ] Wydruk raportu spółki + „stan na dzień".
- [ ] Testy: bilans akcji, przydział numerów, odbudowa stanu ze zdarzeń = stan bieżący,
      łańcuch skrótów, przypadki brzegowe przeniesienia (całość / część / wielu nabywców).

**Sprint 2 — workflow spraw** ⛔ STOP
- [ ] `psa_sprawy`, `psa_dokumenty`, `psa_wydane_dokumenty`; upload; kolejka na pulpicie.
- [ ] `logika/terminy.js` (7 dni z zawieszeniem) + testy.
- [ ] Checklisty per typ, ścieżka „uzasadnione wątpliwości", AML jako bramka.
- [ ] Powiadomienie z art. 300³⁴ § 3, zawiadomienia o wpisie/odmowie, wezwanie.
- [ ] Pozostałe typy zdarzeń (obciążenia, zajęcia, uprawnienia, ograniczenia, sprostowanie).

**Sprint 3 — portal klienta** ⛔ STOP
- [ ] Decyzja o wariancie wdrożenia (sekcja 2), konta, logowanie, rate limiting.
- [ ] Podgląd rejestru z maskowaniem, złożenie żądania, statusy spraw.

**Sprint 4 — rozliczenia, migracja, obowiązki 2027**
- [x] `psa_oplaty`, naliczenie roczne, eksport zestawienia.
- [x] Kreator „stan otwarcia" dla spółek przenoszonych (bez opłat, poza workflow sprawy).
- [x] Stuby sądowe z nowelizacji (bramkowane datą 18.02.2027).

> **Sprinty 1–4 wykonane (07–08.2026).** 132 testy (`node:test`), weryfikacja UI w Playwright.
> Pełna lista odstępstw i decyzji implementacyjnych — w `README.md` repozytorium modułu.

**Sprint 5 — ZGODNOŚĆ Z USTAWĄ** ⛔ STOP *(zamiana kolejności — patrz nota niżej)*
- [ ] **Ułamkowe części akcji**: `czesc_licznik`/`czesc_mianownik`, arytmetyka wymierna, `CHECK`-i,
      nowy niezmiennik bilansu per numer akcji, migracja istniejącego stanu na 1/1.
- [ ] **Pokrycie akcji** (pkt 9) + blokada zbycia akcji nie w pełni pokrytej (art. 300⁴⁰).
- [ ] **`data_wpisu_krs`** na emisji + twarda blokada wpisu akcji przed wpisem do KRS.
- [ ] **`rodzaj_akcji`** (pkt 4), **obowiązki wobec spółki** (pkt 11), **dodatkowe informacje
      z umowy spółki** (§ 2).
- [ ] **Wspólny przedstawiciel** współuprawnionych (art. 300³⁸ § 3).
- [ ] **Rozróżnienie wpisu konstytutywnego i deklaratoryjnego** (art. 300³⁷ § 2) — osobne
      checklisty i treści zawiadomień.
- [ ] **Lista akcjonariuszy do KRS** (art. 300³⁴ § 8) generowana z zawiadomieniem o wpisie.
- [ ] Korekty errat: usunięcie nieistniejących wymogów formy zgody, poprawa kierunku zgłoszenia
      z art. 300³³ § 3, usunięcie wszystkiego, co dotyczyło pośredniczenia w wypłatach.
- [ ] `przepisy.js` przepisany tak, by każda reguła wskazywała jednostkę redakcyjną
      z `PRZEPISY-PSA.md`; `PRZEPISY-PSA.md` w repozytorium.
- [ ] Testy: arytmetyka ułamków (1/3 + 1/3 + 1/3 = 1), bilans per numer, blokady, migracja 1/1.

> **Nota o zamianie kolejności (08.2026).** Sprint interfejsowy renderuje dokładnie te struktury,
> które zmienia sprint zgodnościowy — pasek serii, tabelę akcjonariatu, kreator przeniesienia.
> Robienie interfejsu na modelu bez ułamków oznaczałoby przerabianie go zaraz potem.
> Migracja jest bezbolesna: **na 08.2026 żadna z prowadzonych spółek nie ma akcji objętych
> współwłasnością ani ułamkami** — cały istniejący stan konwertuje się na 1/1.

**Sprint 6 — warstwa wizualna** ⛔ STOP (prompt: `SESJA-PSA-5-INTERFEJS.md`, bez zmian w treści)
- [ ] `design.css` v1.1, shell, szerokości 1180/720, trzy role typograficzne.
- [ ] **Pasek serii** — z obsługą akcji dzielonych ułamkowo (pionowa kreska podziału + lista
      pozycji ułamkowych pod paskiem, bo przy dużych emisjach segment jest niewidoczny).
- [ ] Tryb archiwalny, „stan na" z dokładnością do minuty, przełącznik uproszczony/szczegółowy.
- [ ] Kolejka spraw, kreator, puste stany, mikrocopy, wydruki.

**Sprint 7 — domknięcie domeny i uruchomienie portalu**
- [ ] Warunkowa emisja (art. 300¹¹⁷–300¹¹⁸) — ścieżka ESOP/warranty.
- [ ] Unieważnienie akcji (art. 300⁵¹), prawo pierwszeństwa (art. 300⁴²).
- [ ] Informacja z rejestru w postaci papierowej; lista uprawnionych na WZ.
- [ ] Kanały powiadomień + żądanie adresata (art. 300³⁴ § 9 🔵), sygnatura postępowania
      przy zapytaniach organów (art. 300³⁵ § 4 🔵).
- [ ] Zgłoszenie zmian danych przez zarząd jako typ sprawy (art. 300³³ § 3 🔵) + przypomnienia.
- [ ] Zawiadomienie sądu o rozwiązaniu umowy — drugi zegar 7 dni (art. 300³² § 3 🔵).
- [ ] Scalenie/split akcji, wypłata dywidendy jako zdarzenie **wyłącznie ewidencyjne**.
- [ ] Aktywacja kont portalowych e-mailem; unieważnianie sesji; umowa warunkowa jako szablon.

---

## 15. Decyzje do ustalenia

1. **Wariant wdrożenia** (sekcja 2) — A: wszystko na VPS; B: rdzeń w kancelarii + skrzynka
   podawcza. Wybrano **A** (sprint 3). Nadal otwarte: TLS produkcyjny, szyfrowane kopie offsite,
   umowa powierzenia z hostingiem.
2. **Weryfikacja pozycji ⚠️ z `PRZEPISY-PSA.md`** — Prawo o notariacie (rozdz. 8a), AML, taksa,
   art. 476 § 1¹ stosowany do P.S.A. przez odesłanie. **Do czasu weryfikacji nie mogą być podstawą
   blokady w systemie.**
3. **Kto dokonuje wpisu.** Art. 300³² § 1² potwierdza, że **umowę** może zawrzeć notariusz,
   zastępca albo osoba upoważniona do dokonywania czynności notarialnych. Czy to samo dotyczy
   **dokonania wpisu** — pytanie do izby, nie do kodu. Na start: każdy zalogowany pracownik,
   z zapisem autora przy zdarzeniu.
4. **Stawki własne kancelarii** — maksymalne (1200/100/50 zł) czy niższe jako argument sprzedażowy.
5. **Integracja opłat z modułem Kasa** — rekomendacja: osobno, scalenie po ustabilizowaniu modułu.
6. ~~Współwłasność akcji~~ — **ROZSTRZYGNIĘTE (08.2026):** modelujemy od razu, bo art. 300⁴³
   dopuszcza ułamkowe części akcji niezależnie od nowelizacji. Sprint 5.
7. ~~Pośredniczenie w wypłatach~~ — **BEZPRZEDMIOTOWE (08.2026):** w Dziale IA nie ma odpowiednika
   art. 328¹⁰ KSH. Nic nie trzeba wyłączać w umowie.
8. **Monitorowanie 3-letniego terminu wniesienia wkładów** (art. 300⁹ § 1) — czy przypominamy
   spółce jako usługa dodana, czy zostaje poza zakresem. Termin potwierdzony w tekście ustawy.
9. **Pozycjonowanie „rejestr = cap table"** — w P.S.A. rejestr jest definitywnym źródłem struktury
   właścicielskiej; widok uproszczony + eksport historii do due diligence czyni drugą ewidencję
   zbędną. Decyzja: czy komunikować jako osobną wartość w ofercie.
10. **Zakres obsługi ułamków w UI** — czy kreator ułamków jest dostępny od razu dla wszystkich
    pracowników, czy tylko dla admina do czasu pierwszego realnego przypadku. Rekomendacja:
    dostępny, ale z dodatkowym krokiem potwierdzenia.

---

## 16. Czego NIE robić

- Nie edytować i nie kasować rekordów w `psa_zdarzenia` — nigdy, w żadnym trybie.
- Nie pozwalać użytkownikowi wpisywać numerów akcji ręcznie w ścieżce podstawowej.
- Nie zapisywać stanu akcjonariatu jako jedynego źródła prawdy.
- Nie ostrzegać tam, gdzie ma być blokada (bilans akcji, obciążenia, brak pokrycia).
- Nie pokazywać PESEL, daty urodzenia ani adresu zamieszkania innemu akcjonariuszowi.
- Nie prowadzić rejestru dla S.A. i S.K.A.
- Nie dodawać bibliotek PDF, bundlera, TypeScriptu, Tailwinda ani ORM-a.
- Nie hardkodować stawek, terminów ani reguł prawnych poza `logika/przepisy.js`.
- **Nie opierać żadnej reguły prawnej na opracowaniach branżowych, blogach kancelarii ani
  omówieniach nowelizacji.** Jedyne źródło: `PRZEPISY-PSA.md`. Brak jednostki redakcyjnej =
  pytanie do Łukasza.
- **Nie stosować przepisów o spółce akcyjnej przez analogię** — Dział IA ma wyłącznie odesłania
  punktowe (`PRZEPISY-PSA.md`, sekcja 12 pkt 5).
- Nie używać floatów ani typów stałoprzecinkowych do ułamków akcji — wyłącznie para `INTEGER`.
- Nie zapisywać ułamka na zakresie szerszym niż jedna akcja.
- Nie prowadzić żadnych przepływów pieniężnych ani rozliczeń dywidend.
