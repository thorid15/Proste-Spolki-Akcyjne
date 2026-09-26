# Porównanie: Rejestr PSA KRN (rejestry-notarialne.pl) ↔ nasz rejestr PSA

**Cel:** zestawić inwentaryzację rejestru KRN (`Inwentaryzacja_Rejestr_PSA.md`, stan 2026-09-26)
z naszym systemem i wskazać **rozbieżności do decyzji**. Dokument nie wprowadza żadnych zmian w
kodzie — każdą pozycję trzeba zaakceptować albo odrzucić.
**Podstawa po naszej stronie:** kod (`server/migracje.js`, `server/logika/stan.js`,
`server/widoki.js`, `server/logika/informacja-dokument.js`, `publiczne/js/kokpit.js`,
`server/logika/kreator.js`, `server/logika/walidacje.js`), nie tylko specyfikacja
`CLAUDE-PSA.md`. Tam, gdzie opis i kod się rozjeżdżają, rozstrzyga kod.

Oznaczenia:
- ✅ **mamy** (tak samo albo szerzej niż KRN) — nic do zrobienia,
- 🟡 **mamy inaczej** — do decyzji, czy zostaje, czy przejmujemy rozwiązanie KRN,
- 🔴 **nie mamy** — rozwiązanie KRN albo luka, którą warto rozważyć,
- ⚪ **świadomie nie przejmujemy** (propozycja) — rozwiązanie KRN słabsze albo zbędne u nas,
- ❓ **do sprawdzenia** — nie da się rozstrzygnąć z samej lektury kodu.

Kolumna **Decyzja** jest pusta — do uzupełnienia przez Łukasza (T = wprowadzamy, N = nie, ? = później).

---

## 0. Wniosek ogólny

KRN to w praktyce **ewidencja formularzowa** (6 rejestrów zależnych, edycja wpisów przez
„sprostowanie", soft delete). Nasz rejestr jest **łańcuchem zdarzeń** z pełnym workflow
żądania (7 dni, zawiadomienia, odmowa), pokryciem, ograniczeniami, obciążeniami, ułamkami i
maskowaniem. W większości pozycji z art. 300³³ KSH jesteśmy **szerzej** niż KRN (luki z sekcji
8–9 inwentaryzacji są u nas już zamknięte).

Od KRN warto przejąć przede wszystkim **sposób prezentacji** i kilka elementów **treści wydruku**,
a do przemyślenia jest **jedna kwestia merytoryczna** (R-01: od kiedy zmiana jest widoczna w
„stanie na dzień").

### Najważniejsze rozbieżności (priorytet)

| ID | Rozbieżność | Waga | Decyzja |
|---|---|---|---|
| **R-01** | „Stan na dzień" u nas liczony od **daty zdarzenia z dokumentu**, w KRN od **daty wpisu** (widoczne na wydruku od D+1). Przy przeniesieniu konstytutywnym (art. 300³⁷ § 1) nabycie następuje dopiero z chwilą wpisu | **wysoka** | |
| **R-02** | Informacja z rejestru drukuje **datę emisji**, a nie **datę zarejestrowania emisji** (art. 300³³ § 1 pkt 3) — mimo że pole `data_wpisu_krs` mamy | **wysoka** | |
| **R-03** | Na informacji brak **daty nabycia per zakres numerów** — łączymy zakresy tej samej serii nabyte w różnych dniach w jeden wiersz z datą najstarszą; KRN pokazuje każdą transzę z jej datą | średnia | |
| **R-04** | Na informacji brak **ceny emisyjnej, waluty, podstawy prawnej i opisu emisji** (KRN je drukuje) | średnia | |
| **R-05** | Pola `opis` („drukowany na raporcie") w spółce i emisji — **nie są nigdzie drukowane** | niska | |
| **R-06** | Brak **sumy na akcjonariusza** przez wszystkie serie (łącznie akcji / % / głosów) — mamy wiersz per osoba + seria | średnia | |
| **R-07** | Znacznik czasu sporządzenia informacji — u nas tylko data, w KRN data + godzina | niska | |
| **R-08** | UPO w KRN może mieć naraz kilka rodzajów (maska U+P+O); u nas jeden rodzaj na wpis — istotne przy **migracji** danych KRN | migracja | |

Szczegóły poniżej, w układzie sekcji inwentaryzacji KRN.

---

## 1. Treść informacji z rejestru — porównanie pole po polu

KRN ma jeden wydruk: **„Rejestr akcjonariuszy prostej spółki akcyjnej"** (pkt 4.9 inwentaryzacji).
My mamy **„Informację z rejestru akcjonariuszy"** (`server/logika/informacja-dokument.js`), jedyny
dokument wystawiany ze stanu rejestru, z zakresem zależnym od odbiorcy.

| Element | Art. 300³³ § 1 | KRN (wydruk) | My (informacja) | Status | Decyzja |
|---|---|---|---|---|---|
| Firma, forma, siedziba i adres spółki | pkt 1 | ✔ | ✔ | ✅ | |
| Tel./e-mail/www spółki | — | ✔ | ✗ | ⚪ (nie jest treścią rejestru) | |
| NIP, REGON | — | ✔ | ✔ | ✅ | |
| Sąd rejestrowy, wydział, nr KRS | pkt 2 | ✔ | ✔ | ✅ | |
| Data zarejestrowania spółki | pkt 3 | „DU – data utworzenia" (niejednoznaczne) | „Data zarejestrowania spółki" z pola `data_utworzenia_spolki` | 🟡 ❓ upewnić się, że w polu jest data **wpisu do KRS**, nie data aktu (u nas jest też `data_ostatniego_wpisu_krs`) | |
| Data rejestracji wpisu spółki w rejestrze (DR) | — | ✔ | „Data otwarcia rejestru" + daty uchwały i umowy | ✅ (szerzej) | |
| Organ prowadzący rejestr | — | ✔ | nagłówek: kancelaria jako „podmiot prowadzący rejestr akcjonariuszy" | ✅ | |
| **Data zarejestrowania emisji** | **pkt 3** | „DE – data emisji" | drukujemy `data_emisji`, **nie** `data_wpisu_krs` | 🔴 **R-02** — dodać kolumnę „Data wpisu do KRS" (albo zastąpić) | |
| Seria, zakres numerów, liczba akcji | pkt 4 | ✔ | ✔ + umorzone + istniejące | ✅ (szerzej) | |
| Rodzaj akcji | pkt 4 | ✗ | ✔ | ✅ | |
| Tytuł emisji | — | ✔ | ✔ | ✅ | |
| **Cena emisyjna + waluta** | — | ✔ | ✗ (jest w kokpicie) | 🔴 **R-04** | |
| **Podstawa prawna emisji** | — | ✔ („Podstawa: …") | ✗ | 🔴 **R-04** | |
| Opis emisji | — | ✔ | ✗ | 🔴 **R-04/R-05** | |
| Uprawnienia szczególne | pkt 4 | tytuł + litery U/P/O + DU/DR (treść nie drukuje się!) | rodzaj, dotyczy, tytuł, **treść**, od dnia | ✅ (lepiej — KRN gubi treść) | |
| Akcjonariusz: nazwisko i imię / firma | pkt 5 | ✔ | ✔ | ✅ | |
| Adres zamieszkania/siedziby | pkt 5 | jeden adres (albo zamieszkania, albo do doręczeń) | adres podstawowy, zastępczo adres do doręczeń / e-doręczeń; maskowanie wobec innego akcjonariusza (art. 300³⁵ § 1¹) | ✅ | |
| E-mail akcjonariusza | pkt 5 | drukowany zawsze, w [ ] | **tylko przy zgodzie** na komunikację elektroniczną | ✅ (zgodnie z pkt 5 in fine) | |
| PESEL/NIP akcjonariusza | — | ✗ | identyfikator jawny wg roli odbiorcy, PESEL maskowany | ✅ | |
| Seria / numery / liczba akcji akcjonariusza | pkt 4–5 | **wiersz na transzę** (1–889, 890–989, 990 osobno) | **wiersz na osobę + serię**, zakresy scalone („1–889, 990") | 🟡 **R-03, R-06** | |
| Data nabycia / wpisu przy akcjach | pkt 6 | data transakcji **każdej transzy** | „Wpisano do rejestru" — moment wpisu **najstarszej** transzy w wierszu | 🟡 **R-03** | |
| Udział % | — | ✗ | ✔ | ✅ | |
| Wzmianka o pokryciu | pkt 9 | ✗ | ✔ (w całości / częściowo / niepokryte / brak wzmianki) | ✅ | |
| Obciążenia (zastaw, użytkowanie, zajęcie) i prawo głosu | pkt 6–8 | ✗ (rejestr „w przygotowaniu") | ✔ | ✅ | |
| Ograniczenia w rozporządzaniu | pkt 10 | ✗ | ✔ | ✅ | |
| Obowiązki wobec spółki | pkt 11 | UPO „O" | ✔ (z emisji) | ✅ | |
| Współwłasność ułamkowa, wspólny przedstawiciel | art. 300³⁸ | ✗ | ✔ | ✅ | |
| „Stan na" | — | ✔ (z komunikatem, że zmiana widoczna od D+1) | ✔ (dzień) | 🟡 **R-01** | |
| Znacznik czasu wygenerowania | — | data + godzina | „Sporządzono dd.mm.rrrr" | 🟡 **R-07** | |
| Odbiorca informacji | — | ✗ | ✔ | ✅ | |
| Suma akcji przypisanych / liczba pozycji | — | licznik „RAZEM" (w UI) | ✔ | ✅ | |
| Liczba głosów | art. 300²³ | ✗ | liczona (`glosy`), **nie drukowana** | 🔴 do rozważenia razem z **R-06** | |
| Historia przejść (kto od kogo) | pkt 6 („wpis o przejściu") | ✗ (tylko stan) | ✗ na informacji (jest w historii zdarzeń w kokpicie) | ❓ czy informacja „pełna" ma zawierać historię wpisów — ustawa nie określa treści informacji | |

---

## 2. Rozbieżności szczegółowe

### R-01. Od kiedy zmiana jest widoczna w „stanie na dzień" — **do decyzji merytorycznej**

- **KRN:** zmiana akcjonariatu widoczna w aplikacji natychmiast, a **na wydruku od dnia
  następnego** po dacie rejestracji. Stan liczony od daty wpisu (data transakcji = dzień rejestracji).
- **My:** przedziały stanu akcji (`psa_stan_akcji.data_od`) otrzymują **`data_zdarzenia`**, czyli
  datę z dokumentu (np. umowy zbycia) — `server/logika/stan.js`, `przeniesienie()` i pozostałe
  handlery. „Stan na dzień D" = przedziały z `data_od <= D`.
- **Problem:**
  1. **Art. 300³⁷ § 1:** przy przeniesieniu konstytutywnym (zwykła umowa zbycia) nabycie następuje
     **z chwilą wpisu**. Jeżeli umowę zawarto 1.10, a wpisu dokonano 6.10, to informacja „stan na
     3.10" wykaże u nas nabywcę jako akcjonariusza, choć w tym dniu nim jeszcze nie był.
  2. **Zmiana przeszłości:** informacja wydana 3.10 („stan na 3.10") i ta sama informacja
     wygenerowana 7.10 („stan na 3.10") będą się różnić. KRN tego problemu nie ma.
  3. Przy wpisach **deklaratoryjnych** (dziedziczenie, objęcie, aport, połączenie — art. 300³⁷ § 2)
     nasze podejście jest merytorycznie trafne: prawo przeszło w dniu zdarzenia.
- **Opcje:**
  - (a) zostawić jak jest;
  - (b) dla wpisów **konstytutywnych** przyjmować jako `data_od` datę **wpisu** (`data_wpisu`),
    dla deklaratoryjnych — datę zdarzenia (mamy już `charakter_wpisu` w sprawie, D-027);
  - (c) jak KRN — zawsze data wpisu, a data zdarzenia tylko informacyjnie.
- Rekomendacja: **(b)**, bo odpowiada art. 300³⁷ i wykorzystuje istniejące pole. ❓ Przed zmianą
  sprawdzić, czy kreator nie podstawia już dziś daty wpisu jako `data_zdarzenia` przy przeniesieniu
  (w kodzie `stan.js` tego nie widać).

### R-02. Data zarejestrowania emisji na informacji

Art. 300³³ § 1 pkt 3: rejestr zawiera **datę zarejestrowania** spółki i emisji akcji. Pole
`psa_emisje.data_wpisu_krs` istnieje, jest wymagane do wpisu akcji (blokada art. 300³⁰ § 2), jest
w widoku stanu — ale `informacja-dokument.js` w tabeli emisji drukuje `data_emisji`. Poprawka
jednowierszowa. KRN ma tu tę samą lukę (inwentaryzacja, pkt 8, poz. 3 „⚠").

### R-03. Wiersz akcjonariusza: transza (KRN) czy osoba + seria (my)

- **KRN:** jeden wiersz = jedna **transza** (spójny zakres numerów z jedną datą nabycia). Ten sam
  akcjonariusz występuje wielokrotnie, nawet w tej samej serii (np. 1–889 i 990–990).
- **My:** `akcjonariatNaDzien()` grupuje po kluczu **osoba + emisja (seria)**. Różne serie są
  **osobnymi wierszami — nie sumujemy akcji między seriami** (to już działa tak, jak Łukasz chce).
  W ramach jednej serii zakresy są scalane w jeden opis („1–889, 990"), a data nabycia to data
  **najstarszej** transzy.
- Kokpit ma przełącznik „uproszczony / szczegółowy"; szczegółowy rozbija wiersz na zakresy, ale
  **bez własnej daty nabycia** każdego zakresu (dziedziczy datę najstarszą) i dzieli procent
  proporcjonalnie.
- **Luka:** gubimy informację, **kiedy** nabyto które akcje w obrębie serii (a to jest istotne dla
  pkt 6 oraz dla ustalenia, czy konkretne numery były już u akcjonariusza w danym dniu).
- **Opcje:** (a) w widoku szczegółowym i na informacji pokazywać datę nabycia i tytuł (`tytul_nabycia`
  mamy w przedziale) **per zakres**; (b) zostawić grupowanie, a daty per zakres wypisać w drugim
  wierszu opisu („1–889 od 12.08.2026; 990 od 12.08.2026"); (c) bez zmian.

### R-04. Dane emisji na informacji

KRN drukuje przy emisji: tytuł, seria, nr początkowy, ilość, **cenę emisyjną z walutą**,
**podstawę** i **opis**. My: seria, tytuł, rodzaj, numery, wyemitowane / umorzone / istniejące,
data emisji. Cena i podstawa prawna nie są wymagane przez art. 300³³, ale są użyteczne dla spółki
(i KRN je pokazuje). Decyzja: dopisać do tabeli emisji (kolumna „Cena emisyjna" + wiersz podstawy).

### R-05. Pola „opis — drukowany na raporcie"

W schemacie `psa_spolki.opis` i `psa_emisje.opis` mają komentarz „drukowany na raporcie", ale ani
informacja z rejestru, ani inny dokument ich nie drukuje. W KRN *Opis* jest jedynym sposobem na
dodatkowy tekst na wydruku. Decyzja: (a) drukować opis (spółki pod sekcją „Spółka", emisji pod
emisją), albo (b) usunąć obietnicę z komentarzy / UI.

### R-06. Suma na akcjonariusza przez wszystkie serie

Lista akcjonariuszy w KRN nie pokazuje liczby akcji w ogóle (inwentaryzacja pkt 9, usterka 4).
U nas przy kilku seriach akcjonariusz ma kilka wierszy, ale **nie ma podsumowania na osobę**
(„łącznie: 1 000 akcji, 45,00 %, 1 000 głosów"). Propozycja: zachować wiersze per seria (wymóg
pkt 4 — seria i numery), a dodać wiersz sumy przy osobach z więcej niż jedną serią, na ekranie i
na informacji. Przy okazji rozważyć druk **liczby głosów** (mamy ją policzoną).

### R-07. Godzina sporządzenia informacji

KRN: „RRRR-MM-DD GG:MM:SS". U nas „Sporządzono dd.mm.rrrr" — przy kilku wpisach tego samego dnia
nie wiadomo, czy informacja uwzględnia wpis z godziny 14:00. Dodać godzinę (dane `sporzadzono` już
ją niosą).

### R-08. Uprawnienia / przywileje / obowiązki — wiele rodzajów w jednym wpisie

KRN: `intTyp` to maska bitowa (1 przywilej, 2 uprawnienie, 4 obowiązek) — jeden wpis może być np.
U+O („AKCJE NIEME"). U nas `psa_uprawnienia.rodzaj` to jedna wartość. Merytorycznie nasze
podejście jest czytelniejsze, ale przy **przejęciu rejestru z KRN** wpis U+O trzeba rozbić na dwa.
Dodatkowo w danych KRN **treść** postanowień leży w *Komentarzu do statusu* (nie w polu treści),
więc migracja musi ją przenieść do `tresc`. → do dopisania w `PRZEJECIE-REJESTRU.md`.

---

## 3. Pozostałe pozycje wg sekcji inwentaryzacji KRN

### 3.1 Spółka (KRN pkt 4.2)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Status „SPÓŁKA W PRZYGOTOWANIU" | brak; odpowiada mu wniosek w portalu (`psa_wnioski`, status `w_przygotowaniu`) | ⚪ | |
| Statusy zawieszona / w likwidacji / aktywna / wykreślona | ✔ | ✅ | |
| Komentarz do statusu, opis, uwagi notariusza | ✔ (`komentarz_statusu`, `opis`, `uwagi`) | ✅ (opis → R-05) | |
| Kraj spółki (PL zablokowane) | `kraj` tekst, domyślnie „Polska" | ✅ | |
| Tel./e-mail wymagane | opcjonalne | ⚪ | |
| Organ prowadzący: notariusz albo izba notarialna (11 izb) | jeden podmiot (kancelaria); zakończenie umowy + zawiadomienie sądu (art. 300³² § 3) | 🟡 ❓ czy potrzebujemy ewidencji **komu przekazano** rejestr i eksportu „do przekazania" (inny notariusz / izba) — w KRN to jedno pole | |
| Umowa o prowadzenie rejestru | KRN brak | ✅ my: data uchwały, data umowy, sposób zawarcia, załącznik | |
| Zastępca notariusza przy każdym wpisie | `autor` zdarzenia (pracownik) | ❓ czy na zawiadomieniach/informacji ma się pojawiać „zastępca notarialny" jako działający — do decyzji | |

### 3.2 Rejestr zdarzeń (KRN pkt 4.3)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Zdarzenie „zwykłe" z tematem i datą | `zdarzenie_inne` | ✅ | |
| **Priorytet** (wysoki/średni/niski) | brak | ⚪ (u nas kolejka spraw z terminem 7 dni) | |
| Zdarzenia tymczasowo zastępujące zastawy | niepotrzebne — mamy obciążenia | ✅ | |

### 3.3 Uprawnienia, przywileje, obowiązki (KRN pkt 4.4)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| 3 konteksty: spółka / akcjonariusz / emisja | `zakres` spolka / emisja / akcjonariusz | ✅ | |
| Maska U+P+O | jeden rodzaj | 🟡 **R-08** | |
| Brak pola treści | mamy `tresc` i drukujemy | ✅ | |
| Wykreślenie (status) | `status` aktywne/wykreślone + data | ✅ | |

### 3.4 Akcjonariusze (KRN pkt 4.5)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Akcjonariusz per spółka | kartoteka wspólna `psa_osoby` (jedna osoba w wielu spółkach) | ✅ | |
| Jeden adres z wyborem typu | adres + adres do doręczeń + e-doręczenia | ✅ | |
| Pełny słownik krajów ISO-3166 (+ XX NIEZNANY) | `kraj` tekst swobodny | 🔴 ❓ rozważyć listę wyboru (spójność danych, eksport do KRS) | |
| Imiona w jednym polu | `imie` jedno pole | ✅ (tak samo) | |
| Status akcjonariusza (wykreślony) | brak — akcjonariusz „znika", gdy nie ma akcji; osoba w kartotece zostaje | ✅ | |
| Brak liczby akcji na liście | kokpit pokazuje | ✅ | |

### 3.5 Emisje (KRN pkt 4.6)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Tytuł, podstawa prawna, data, seria, nr pierwszy, ilość, cena, waluta | ✔ | ✅ | |
| Waluty PLN/EUR/USD/CHF | `waluta` (domyślnie PLN) | ❓ sprawdzić, czy UI pozwala wybrać inną walutę | |
| Rodzaj akcji, data wpisu do KRS, obowiązki | ✔ (KRN brak) | ✅ | |
| Statusy: w przygotowaniu / w umarzaniu / umorzony / aktywny / wykreślony | aktywna / w_umarzaniu / umorzona / wykreślona | ✅ | |
| **Blokada sprostowania emisji po objęciu akcji** | ❓ sprostowanie zdarzenia emisji przechodzi przez walidację bilansu — do sprawdzenia testem, czy zmiana np. liczby akcji po objęciu jest blokowana z czytelnym komunikatem | ❓ | |

### 3.6 Objęcie akcji (KRN pkt 4.6)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Ręczne wskazanie zakresu numerów | FIFO + ręczne nadpisanie | ✅ | |
| Data objęcia = data rejestracji | data zdarzenia z dokumentu | ✅ (wpis deklaratoryjny — zob. R-01) | |
| Brak pokrycia / dokumentu | pokrycie, dokumenty sprawy | ✅ | |

### 3.7 Rejestr akcji / transakcje (KRN pkt 4.7)

| Element KRN | U nas | Status | Decyzja |
|---|---|---|---|
| Transakcja = każde przejście (bez tytułu) | `przeniesienie` z `tytul_prawny`, dokumentem, datą, żądającym | ✅ | |
| Umorzenie dobrowolne / przymusowe | `tryb` umorzenia (domyślnie „dobrowolne") | ✅ | |
| Brak walidacji nabywca = zbywca | walidacja jest (`walidacje.js`) | ✅ | |
| Historia „stan na" | ✔ (+ tryb archiwalny ekranu) | ✅ / R-01 | |
| Status w widoku historycznym = bieżący (usterka KRN) | nie dotyczy (stan liczony na dzień) | ✅ | |
| Wiersz na transzę | wiersz na osobę + serię | 🟡 **R-03** | |

### 3.8 Zajęcia, zastawy, użytkowanie (KRN pkt 4.8)

KRN: niezaimplementowane. U nas: `obciazenie`, `zajecie`, `prawo_glosu_zastawnika`, wykreślenia. ✅

### 3.9 Wyszukiwanie (KRN: fraza po firmie, NIP, REGON, KRS, e-mailu)

❓ Sprawdzić, czy lista spółek u nas szuka także po **nazwisku akcjonariusza** (KRN nie szuka — to
była zgłoszona usterka; u nas przy kartotece wspólnej jest `GET /osoby/:id/spolki`).

---

## 4. Co mamy, a KRN nie ma (bez decyzji — dla porządku)

Workflow żądania i termin 7 dni ze wstrzymaniem; zawiadomienia (uprzednie, o wpisie, o odmowie);
status odmowy z uzasadnieniem; dokumenty sprawy i ich badanie (art. 300³⁴ § 4–5); łańcuch
zdarzeń z hashami (art. 300³¹ § 4); pokrycie akcji; ograniczenia w rozporządzaniu; obciążenia i
zajęcia; ułamkowe części akcji i wspólny przedstawiciel; rodzaj akcji; data wpisu emisji do KRS z
blokadą; maskowanie danych (art. 300³⁵ § 1¹); portal klienta; opłaty; lista akcjonariuszy do KRS
(art. 300³⁴ § 8); AML.

## 5. Usterki KRN, których nie powielamy

Nabywca = zbywca (mamy walidację); treść UPO w niedrukowanym komentarzu; status bieżący w widoku
historycznym; daty z godziną 02:00 (przesunięcie strefy) — u nas `DATE` jako tekst ISO; e-mail
drukowany bez zgody.

## 6. Uwagi do przejęcia danych z KRN (`PRZEJECIE-REJESTRU.md`)

1. UPO z maską kilku rodzajów → rozbić na osobne wpisy (R-08).
2. Treść postanowień z *Komentarza do statusu* UPO → pole `tresc`.
3. *Uwagi notariusza* spółki zawierają ograniczenia rozporządzania (np. prawo pierwszeństwa) →
   przenieść do `psa_ograniczenia`, nie do `uwagi`.
4. Pokrycie akcji zapisane w KRN wyłącznie w *Uwagach* → wzmianka o pokryciu (`pokrycie_akcji`).
5. Data transakcji w KRN = dzień rejestracji, nie data umowy — przy imporcie nie mamy daty
   zdarzenia prawnego; trzeba ją ustalić z dokumentów albo przyjąć datę wpisu (zależne od R-01).
6. Anomalia w **Charlie Unicorn AI PSA** (transakcja 2026-09-25, nabywca = zbywca, akcjonariusz
   ID 21995 bez akcji) — wyjaśnić przed migracją.
7. Numeracja KRN jest ciągła między seriami (AN 1–25, AZ 26–100) — ❓ sprawdzić, czy nasz model
   przyjmuje serię zaczynającą się od numeru innego niż 1 (`nr_pierwszy` jest, więc powinien).

---

## 7. Lista decyzji do podjęcia (skrót)

- [ ] **R-01** — data skuteczności w „stanie na": (a) bez zmian / (b) konstytutywne od wpisu / (c) zawsze od wpisu
- [ ] **R-02** — data wpisu emisji do KRS na informacji
- [ ] **R-03** — data nabycia per zakres numerów (ekran szczegółowy i informacja)
- [ ] **R-04** — cena emisyjna, podstawa prawna, opis emisji na informacji
- [ ] **R-05** — drukować pola `opis` czy usunąć tę obietnicę
- [ ] **R-06** — suma na akcjonariusza przez serie (+ liczba głosów)
- [ ] **R-07** — godzina sporządzenia na informacji
- [ ] **R-08** — reguły migracji UPO z KRN
- [ ] 3.1 — ewidencja przekazania rejestru innemu notariuszowi / izbie
- [ ] 3.4 — słownik krajów zamiast tekstu
- [ ] ❓ weryfikacje: blokada sprostowania emisji po objęciu, wybór waluty w UI, wyszukiwanie po akcjonariuszu, znaczenie `data_utworzenia_spolki`
