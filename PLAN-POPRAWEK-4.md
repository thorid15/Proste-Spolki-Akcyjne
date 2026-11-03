# Poprawki — runda czwarta (przegląd w trybie testowym, 1.11.2026)

Uwagi Łukasza z przeglądu w trybie testowym (zrzuty: portal spółki, „Informacja z rejestru”, sprawa
przeniesienia akcji). Stan: **zapis do wprowadzenia** — nic jeszcze nie zmieniono. Treść prawna wyłącznie
z `PRZEPISY-PSA.md`.

---

## 1. Odpowiedzi na pytania prawne

### 1.1. Pokrycie akcji — skąd brać informację, czy może być później, czy jest obowiązek informowania

- **Rejestr musi to zawierać:** „wzmiankę o tym, czy akcje zostały w całości pokryte”
  (art. 300³³ § 1 pkt 9 KSH).
- **Pokrycie może nastąpić długo po rejestracji:** wkłady wnosi się w całości **w ciągu trzech lat od
  dnia wpisu spółki do rejestru** (art. 300⁹ § 1 KSH).
- **Źródło informacji:** zarząd **niezwłocznie podejmuje uchwałę stwierdzającą wniesienie w całości
  wkładu** (art. 300⁹ § 2 KSH) — to jest dokument, na podstawie którego wpisujemy wzmiankę o pokryciu.
  Przy otwarciu rejestru — dane z umowy spółki / wniosku.
- **Obowiązek informowania nas:** od 18.02.2027 zarząd zgłasza podmiotowi prowadzącemu rejestr zmiany
  danych z § 1 pkt 1–4 i **9**–11 (czyli także pokrycia) w terminie **7 dni** od zdarzenia
  (art. 300³³ § 3 KSH, nowelizacja). W `PRZEPISY-PSA.md` nie ma takiego obowiązku przed tą datą.
- **Dlaczego to ważne w systemie:** zbycie akcji nie w pełni pokrytej wymaga zgody spółki
  (art. 300⁴⁰ § 1 KSH), a nabywca odpowiada solidarnie za resztę wkładu (§ 3).

**Propozycja (do decyzji D-089):** pokrycie nie blokuje otwarcia rejestru; domyślnie „brak informacji
o pełnym pokryciu” (wtedy przy zbyciu system przypomina o zgodzie spółki — art. 300⁴⁰); zmiana na
„pokryte w całości” jako zwykły wpis na podstawie uchwały zarządu, **bezpłatny** (nie jest zmianą
w akcjonariacie — D-083).

### 1.2. Czy można zrezygnować ze zgody na wpis i zawsze robić powiadomienie?

- **Tak, ustawa na to pozwala.** Art. 300³⁴ § 3 KSH: przed wpisem podmiot prowadzący rejestr
  **powiadamia** o treści zamierzonego wpisu osobę, której uprawnienia mają być wykreślone, zmienione lub
  obciążone, **chyba że wyraziła ona zgodę na wpis**. Zgoda jest więc tylko wyjątkiem pozwalającym
  pominąć powiadomienie.
- **Skutek rezygnacji:** każde zbycie wymaga powiadomienia zbywcy; przy zbywcy bez zgody na e-mail —
  listem (koszt, czas). Zgoda pozwala wpisać od razu.

**Propozycja (do decyzji D-090):** domyślną ścieżką jest **powiadomienie** (bez pytania o zgodę);
zgoda zostaje jako opcjonalny skrót (jedno pole, D-088) — nie znika, bo przy zbywcy bez e-maila
oszczędza list.

### 1.3. Ile czasu czekać od powiadomienia do wpisu?

- **`PRZEPISY-PSA.md` nie zawiera żadnego okresu oczekiwania** między powiadomieniem a wpisem.
  Jedyny termin to: wpis niezwłocznie, **nie później niż w 7 dni od otrzymania żądania**
  (art. 300³⁴ § 1 KSH); przy przeszkodzie — 7 dni od jej usunięcia.
- Wytyczne: „wpis dopiero po” powiadomieniu (`wytyczne-rejestr-psa.md`). System już tak działa —
  wpis jest możliwy od chwili wysłania e-maila albo **nadania listu**.
- **Do sprawdzenia przez Łukasza:** czy kancelaria chce stosować własny, krótki okres na reakcję
  powiadomionego (np. 2–3 dni) — w granicach 7 dni z § 1. Bez decyzji: nie wprowadzamy.

---

## 2. Poprawki — portal klienta

| # | Problem | Poprawka | Pliki |
|---|---|---|---|
| P1 | „Dane spółki” — tekst przy samej krawędzi kafelka, etykiety ucinane przez zaokrąglenie („od” w „prowadzony od”) | wewnętrzny margines karty jak w pozostałych kartach, kolumna etykiet z zawijaniem, odstęp etykieta–wartość; sprawdzić 390 px | `publiczne/js/portal.js` (zakładka Rejestr), style |
| P2 | Start: karta „Do zrobienia” | zmienić na **„Do zapłaty”** — tylko nieopłacone opłaty z przyciskiem „Zapłać”; kroki wniosku (np. „Podpisz dokumenty”) jako osobny baner na Start, nie w tej karcie | `portal.js` (`pozycjeDoZrobieniaPortal`, ok. l. 913, 1028) |
| P3 | „Zgłoś błąd we wpisie” — goły link bez warstwy wizualnej | przycisk drugorzędny w tej samej karcie co „Zamów informację”, wyrównany | `portal.js` (ok. l. 1243) |
| P4 | Treść komunikatu o akcjonariacie | dokładnie: „Stan akcjonariatu (akcjonariusze, akcje, obciążenia) jest dostępny w pełnej informacji z rejestru akcjonariuszy.” — przycisk „Zamów informację z rejestru” bez zmian pod spodem | `portal.js` |
| P5 | „Stan na dzień” — pole daty na całą szerokość | pole tylko na datę (szerokość jak w innych polach dat), ikonka kalendarza obok | `portal.js` (ok. l. 1718), `PoleDaty` |
| P6 | Dodawanie nowej spółki w tym samym logowaniu klienta | **usunąć** „nowy wniosek” z konta spółki/wnioskodawcy z przyjętym wnioskiem; nowa spółka = standardowy tryb od nowa (zgłoszenie → zaproszenie → wniosek); API `POST /portal/wniosek/nowy` → 403 z komunikatem | `portal.js` (ok. l. 866), `server/trasy/portal.js` (`/wniosek/nowy`), testy |
| P7 | „Moje oświadczenia”: po cofnięciu nie da się ponownie zaznaczyć | odtworzyć w trybie testowym (zgoda e-mail i „powiadomienia automatyczne”) i naprawić — ponowne oświadczenie musi być możliwe, dopóki konto jest aktywne | `portal.js` (`Moje oświadczenia`, ok. l. 1998), `server/trasy/portal.js` (`/oswiadczenia`) |
| P8 | Cofnięcie zgody na e-mail „za łagodne” | przed cofnięciem okno z ostrzeżeniem: brak zgody **wydłuży postępowanie** — powiadomienie o zamiarze wpisu i zawiadomienie o dokonanym wpisie pójdą **listem**, dostęp do portalu wygaśnie; przyciski „Zostaw zgodę” (domyślny) / „Cofam zgodę” | `portal.js` |

## 3. Poprawki — kancelaria

| # | Problem | Poprawka | Pliki |
|---|---|---|---|
| K1 | Sprawa przeniesienia akcji — frontend „leży” (zrzuty 4–5): różne szerokości kart i kroków, luźny link „Popraw podstawę wpisu”, przycisk „Wystaw żądanie wpisu” na całą szerokość, rozjechane pole zgody, nazwa pliku z UUID | jedna kolumna o stałej szerokości dla całej sprawy; akcje sprawy w jednym pasku przycisków; pole zgody jako zwykły checkbox w siatce; nazwy plików bez UUID; patrz też § 4 (nowy przebieg) | `publiczne/js/sprawy.js`, `publiczne/js/kreator.js`, style |
| K2 | Kartoteka osoby — osobny kafelek „Sprawy”, dane rozrzucone | jeden **kompaktowy widok**: identyfikacja, adresy, kontakt, **zgoda na e-mail (status) i oświadczenie o powiadomieniach**, AML, akcje w spółkach, sprawy jako krótka lista w tym samym widoku; przycisk „Edytuj” po prawej jak teraz | `publiczne/js/osoby.js` (kafelek „Sprawy” ok. l. 638) |
| K3 | Brak usuwania listów z kolejki | „Usuń z wysyłki” dla listu **przed nadaniem** (z powodem; ślad w historii, bez fizycznego kasowania pisma); po nadaniu — niedostępne. Jeśli usuwany list był powiadomieniem przed wpisem — sprawa wraca do stanu „bez powiadomienia” (blokada wpisu) | `server/listy.js`, `server/trasy/listy.js`, `publiczne/js/listy.js`, migracja (status `usuniety` + powód) |
| K4 | Informacja z rejestru (PDF): tabela „Emisje i serie akcji” wychodzi poza margines | węższe kolumny / zawijanie numerów, mniejsza czcionka tabeli albo układ pionowy przy wielu kolumnach; test: PDF z 3 seriami i długim zakresem numerów | `server/logika/informacja-dokument.js` (ok. l. 589–642) |

## 4. Nowy przebieg wpisu zbycia akcji (propozycja do akceptacji — D-091)

**Dziś** (za dużo kroków i pól): założenie sprawy (typ, źródło, żądający z kartoteki, rola, data wpływu,
rodzaj i data dokumentu) → „weryfikuj” → panel powiadomienia/zgody → „Wystaw żądanie wpisu” → kreator
3 kroki (podstawa / seria, zbywca, tytuł, nabywcy, liczby, numery, zgoda spółki, pierwszeństwo /
podgląd) → wpis → zawiadomienia.

**Proponowany przebieg — jeden ekran, trzy kroki:**

1. **Co się zbywa** — spółka → **zbywca z listy akcjonariuszy tej spółki** (nie z całej kartoteki) →
   liczba akcji (numery i seria dobierane automatycznie; ręcznie tylko wyjątkowo) → **nabywca** z kartoteki
   albo „nowa osoba” w tym samym oknie, z minimum danych wymaganych przez art. 300³³ § 1 (imię i nazwisko
   albo firma, adres, PESEL albo data urodzenia — D-076, e-mail tylko przy zgodzie).
2. **Podstawa** — umowa (plik) i jej data; kto żąda (domyślnie z portalu; zbywca / nabywca / spółka);
   data wpływu — automatycznie; tytuł przejścia domyślnie „umowa sprzedaży” (zmiana tylko gdy inny).
3. **Sprawdzenie i wpis** — system sam pokazuje tylko to, co dotyczy tej sprawy:
   - pole „zgoda spółki” **tylko gdy** w rejestrze jest ograniczenie rozporządzania (art. 300³⁴ § 6)
     albo akcje nie są w pełni pokryte (art. 300⁴⁰ § 1);
   - pole „prawo pierwszeństwa wyczerpane” **tylko gdy** w rejestrze jest takie ograniczenie;
   - powiadomienie zbywcy — domyślnie (e-mail przy zgodzie, inaczej list); zgoda — opcjonalny skrót (D-090);
   - podgląd wpisu → **„Dokonaj wpisu”** (aktywny po wysłaniu e-maila / nadaniu listu albo przy zgodzie).

**Usuwamy z widoku** (wartości domyślne albo automatyczne): rodzaj dokumentu jako osobne pole, osobny
krok „weryfikuj”, „Wystaw żądanie wpisu” (tylko na życzenie, gdy żądanie wpłynęło ustnie), „Osoba
działająca przy wpisie” (domyślnie notariusz z ustawień). AML żądającego — informacja w kroku 3,
bez blokady (jak dziś).

**Zakres techniczny:** nowy widok w `publiczne/js/sprawy.js` + uproszczony `kreator.js` dla
`przeniesienie`; backend bez zmian w logice wpisu (walidacje art. 300³⁴/300⁴⁰ zostają) — tylko wartości
domyślne i przeniesienie pól. Pozostałe typy wpisów — w kolejnym kroku tym samym wzorem.

---

## 5. Decyzje do podjęcia

| ID | Pytanie | Propozycja |
|---|---|---|
| D-089 | Pokrycie akcji | nie blokuje otwarcia; domyślnie „brak informacji”; zmiana na podstawie uchwały zarządu, bezpłatnie |
| D-090 | Zgoda na wpis | domyślnie powiadomienie; zgoda jako opcjonalny skrót |
| — | Okres oczekiwania po powiadomieniu | ustawa go nie przewiduje (`PRZEPISY-PSA.md`); bez decyzji — nie wprowadzamy |
| D-091 | Nowy przebieg zbycia (§ 4) | akceptacja przebiegu przed wdrożeniem |

## 6. Kolejność prac

1. **Szybkie poprawki wizualne i tekstowe:** P1–P5, K4 (PDF), K1 (układ strony sprawy bez zmiany przebiegu).
2. **Zachowanie:** P6 (bez nowej spółki w tym samym logowaniu), P7–P8 (oświadczenia), K3 (usuwanie listów), K2 (kartoteka).
3. **Po decyzjach D-089–D-091:** pokrycie, domyślna ścieżka powiadomienia, nowy przebieg zbycia.

Każdy krok: testy (`npm test`), `npm run scenariusz:testowy`, zrzuty w trybie testowym (portal 390 px
i kancelaria), wpis w `DECYZJE.md` dla zmian zachowania.
