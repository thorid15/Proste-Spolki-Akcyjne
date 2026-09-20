# FAZA 6 — integralność rejestru — WYNIK

> Zgodnie z `SESJA-PSA-AUDYT.md`. Zakres znalezisk: `testy-audyt/ZNALEZISKA.md` Z-300–Z-308
> (w zarezerwowanym paśmie Z-300–Z-329). Metoda: bezpośrednie żądania API na własnej spółce
> testowej (id=8, „Audyt Faza6 Integralnosc…", utworzona przez `POST /api/psa/spolki`), próby
> UPDATE/DELETE bezpośrednim SQL na żywej bazie (**wyłącznie próby, które miały i faktycznie
> zostały odrzucone** — zero trwałej zmiany), oraz manipulacje niszczące na **osobnych kopiach**
> pliku bazy w `/tmp` (checkpoint WAL na żywej bazie → `cp` → osobne połączenie `better-sqlite3` →
> manipulacja → weryfikacja funkcją `server/logika/lancuch.js` importowaną bezpośrednio, bez
> serwera HTTP → sprzątnięcie plików kopii).

## Wynik najważniejszy — BEZ znaleziska krytycznego w tej fazie

**Weryfikacja integralności (`GET /api/psa/integralnosc` / `server/logika/lancuch.js:zweryfikuj`)
WYKRYWA każdą przetestowaną manipulację — naiwną zmianę treści, „wyrafinowaną” zmianę treści z
przeliczonym własnym hashem, oraz usunięcie rekordu ze środka łańcucha. Odbudowa stanu
(`POST /:id/przelicz`) daje wynik identyczny z materializacją bieżącą.** To jest najlepszy możliwy
wynik tej fazy — checklista FAZA 6 nie ujawniła żadnej luki w warstwie, której awaria byłaby
nieodwracalna.

Znaleziono natomiast **dwa poważne braki w praktycznej OSIĄGALNOŚCI** części tej ochrony (nie w jej
poprawności merytorycznej) — opisane niżej jako Z-305 i Z-306. Żadne z nich nie pozwala nikomu
naruszyć integralności rejestru ani sfałszować stanu bez wykrycia; dotyczą wyłącznie tego, czy
pracownik kancelarii ma w praktyce narzędzie do odróżnienia dwóch zdarzeń tego samego dnia.

## Wynik każdego punktu checklisty FAZA 6

| # | Punkt checklisty | Wynik | Dowód |
|---|---|---|---|
| 1 | `UPDATE`/`DELETE` bezpośrednio w bazie — czy wyzwalacze blokują (nie tylko kod aplikacji) | **TAK, blokują** | Z-300 — próba surowym `better-sqlite3`, z pominięciem serwera; oba rzuciły `SqliteError` z treścią wyzwalacza; zero zmiany stanu |
| 1a (dodatkowo) | Czy istnieje inna, niezależna warstwa ochrony poza wyzwalaczem | **TAK, częściowo** | Z-301 — `FOREIGN KEY` (`foreign_keys=ON` w `server/baza.js:30`) dodatkowo blokuje `DELETE` zdarzeń referencjonowanych przez materializację, ale **nie wszystkich** zdarzeń — nie jest to jednolita druga warstwa |
| 2 | Ręczna modyfikacja jednego zdarzenia (na kopii) + weryfikacja — czy wykrywa; czy weryfikacja faktycznie przelicza łańcuch, czy zwraca „OK" bezwarunkowo | **WYKRYWA, przelicza naprawdę** | Z-302 — kod czyta WSZYSTKIE zdarzenia bez `LIMIT` i liczy `sha256` od zera przy każdym wywołaniu; naiwna manipulacja wykryta na zaatakowanym rekordzie (`zmieniona_tresc`); manipulacja z przeliczonym własnym hashem wykryta na NASTĘPNYM rekordzie (`zerwane_ogniwo`) |
| 3 | Usunięcie zdarzenia ze środka łańcucha + weryfikacja | **WYKRYWA** | Z-302 (ten sam test) — `zerwane_ogniwo` na rekordzie następującym po usuniętym |
| 4 | Odbudowa stanu ze zdarzeń vs materializacja — muszą być identyczne | **IDENTYCZNE** | Z-303 — porównanie `psa_stan_akcji` przed/po `POST /:id/przelicz`, pola merytoryczne identyczne; dodatkowo architektura (`zmaterializuj()` wywoływane po KAŻDYM zapisie i przez `przelicz`) czyni rozjazd strukturalnie nieosiągalnym przez normalną ścieżkę API |
| 5 | Wyścig — dwa jednoczesne wpisy na tych samych akcjach — czy bilans się psuje | **NIE PSUJE SIĘ** | Z-304 — `Promise.all` z dwoma `POST /zdarzenia` na te same 100 akcji; pierwsze `201`, drugie poprawnie odrzucone `422` („0 akcji wolnych"); transakcje `IMMEDIATE` serializują zapis na poziomie SQLite |
| 6 | Stan na dzień — granice (dzień zdarzenia, przed, po); dwa zdarzenia tego samego dnia różne stany wg momentu; strefa czasowa nie przesuwa granicy doby | **CZĘŚCIOWO** | Z-307 (granice dzień-przed/w dniu/po: POPRAWNE, odporne na strefę — porównanie surowych stringów dat). Z-305 (POWAŻNY): mechanizm różnicowania PO GODZINIE istnieje wyłącznie w API, jest NIEOSIĄGALNY z UI kokpitu — pracownik nie ma jak w praktyce odróżnić dwóch zdarzeń tego samego dnia. Z-306 (POWAŻNY/PYTANIE): tam gdzie mechanizm godzinowy JEST używany (API), jego poprawność zależy w 100% od zmiennej `TZ` procesu serwera, bez walidacji przy starcie, i formatu zapytania, który nie pozwala podać jawnego offsetu strefy — potwierdzone empirycznie, że identyczne zapytanie daje różne chwile absolutne w zależności od `TZ` |
| 7 | Sprostowanie — nowe zdarzenie czy modyfikacja poprzedniego | **NOWE ZDARZENIE, oryginał nietknięty** | Z-308 — zdarzenie prostowane ma identyczną treść przed/po; korekta widoczna wyłącznie w odtworzonym stanie, w chronologicznej pozycji oryginału; `integralnosc` nadal `ok:true` po operacji |

## Granica świadomie zaakceptowana przez projekt (nie znalezisko)

Łańcuch skrótów wykrywa manipulację POJEDYNCZEGO rekordu bez przeliczenia całego dalszego
łańcucha. Atakujący z PEŁNYM dostępem do pliku bazy i znajomością (jawnego, open-source) algorytmu
mógłby w teorii przeliczyć CAŁY ogon łańcucha od punktu ataku do końca i wewnętrzna weryfikacja by
tego nie wykryła — to jest znana, udokumentowana granica projektu (`CLAUDE-PSA.md` sekcja 11:
„świadomie NIE robimy: kwalifikowanych znaczników czasu, drzew Merkle'a, publikacji skrótów") — nie
testowałem tego scenariusza do końca, bo jest z definicji poza zasięgiem jakiegokolwiek schematu
bez zewnętrznego zakotwiczenia skrótu. Odnotowane w Z-302 jako potwierdzenie zakresu ochrony, nie
jako nowe znalezisko.

## Pytania do Łukasza z tej fazy

- **P-011** (`testy-audyt/PYTANIA-DO-LUKASZA.md`) — czy „stan na" z dokładnością do minuty ma
  wrócić do UI kokpitu, i czy interpretacja strefy czasowej dla tego mechanizmu ma być programowo
  wymuszana niezależnie od konfiguracji środowiska hostingowego.

## Sprzątanie środowiska

- Pliki kopii bazy użyte do testów niszczących (`/tmp/audyt-kopia-integralnosc.db`,
  `...2.db`, `...3.db` oraz ewentualne `-wal`/`-shm`) — **usunięte**, potwierdzone (`ls /tmp/*.db`
  po sprzątaniu nie zwraca wyników).
- Plik cookies sesji tymczasowej (`/tmp/psa-cookies*.txt`) — usunięty.
- Żywa baza `dane/audyt-test.db` — bez żadnej bezpośredniej modyfikacji SQL; jedyne zmiany to
  standardowe zapisy przez API (spółka testowa id=8, osoby id 19–21, zdarzenia id 28–30 i 37) —
  dokładnie tak, jak robili to inni agenci audytowi w równoległych fazach (np. spółki testowe id
  1–5 z FAZA 1). Próby `UPDATE`/`DELETE` bezpośrednim SQL na żywej bazie zostały wykonane
  WYŁĄCZNIE jako próby oczekiwanego odrzucenia (Z-300) — obie faktycznie odrzucone, zero zmiany
  stanu przed/po (potwierdzone liczbą wierszy i treścią zaatakowanego rekordu).
- Serwer produkcyjny (`localhost:3005`) przeszedł restart w trakcie sesji (przerwanie limitem API,
  niezwiązane z pracą tej fazy) — po restarcie zweryfikowano, że spółka testowa id=8 i cały łańcuch
  zdarzeń (37 pozycji) są nienaruszone, a `GET /api/psa/integralnosc` nadal zwraca `ok:true`.

## Czego nie udało się przetestować / świadomie ograniczono zakres

1. **Pełne przepisanie ogona łańcucha przez atakującego** (przeliczenie hashy WSZYSTKICH rekordów
   od punktu ataku do końca) — świadomie pominięte: to atak, przed którym żaden schemat oparty
   wyłącznie o łańcuch skrótów bez zewnętrznego zakotwiczenia (np. publikacji skrótu poza systemem)
   nie może się bronić z definicji; `CLAUDE-PSA.md` sekcja 11 świadomie rezygnuje z takiego
   zakotwiczenia. Potwierdzanie tego dodatkowo nie wniosłoby nowej informacji.
2. **`FOREIGN KEY` jako ochrona dla WSZYSTKICH typów zdarzeń** (Z-301) — sprawdzone praktycznie
   wyłącznie dla zdarzenia typu `emisja` (referencjonowane przez `psa_emisje.zdarzenie_id`); nie
   sprawdziłem systematycznie, które inne typy zdarzeń (`przeniesienie`, `zmiana_danych_akcjonariusza`
   itp.) mają analogiczne odwołania FK w `psa_stan_akcji`/innych tabelach materializacji, a które
   nie — koszt pełnego przeglądu schematu nie wydawał się uzasadniony, skoro i tak nie jest to
   główna, projektowo zamierzona ochrona (tą jest wyzwalacz append-only, sprawdzony dla wszystkich
   zdarzeń bez wyjątku w Z-300).
3. **Zachowanie mechanizmu „chwili” (godzina) na PRAWDZIWYM, oddzielnym serwerze z `TZ` inną niż
   `Europe/Warsaw`** — nie uruchamiałem drugiej instancji `serwer.js` na innym porcie (zgodnie z
   ograniczeniem środowiskowym sesji), więc dowód w Z-306 jest oparty na (a) analizie kodu, (b)
   bezpośrednim, empirycznym porównaniu wyniku `new Date(...)` pod różnymi `TZ` w osobnych
   procesach Node (bez serwera HTTP), nie na pełnym żądaniu HTTP do serwera uruchomionego z inną
   strefą. Uznałem to za wystarczający dowód przy koszcie/zysku dalszego drążenia (uruchomienie
   drugiej pełnej instancji serwera tylko dla tego testu nie zmieniłoby wniosku, a niosłoby ryzyko
   dla współdzielonego środowiska).
4. **Wyścig przy operacjach innych niż `przeniesienie`** (np. dwa jednoczesne `sprostowanie` tego
   samego zdarzenia, dwa jednoczesne `otworz-rejestr` dla tej samej spółki) — nietestowane wprost;
   mechanizm ochronny (transakcja `IMMEDIATE` w `zapiszZdarzenie`/`_wykonajWpis`) jest wspólny dla
   WSZYSTKICH ścieżek zapisu zdarzenia, więc oczekuję identycznego zachowania, ale nie zweryfikowałem
   tego empirycznie dla innych typów niż `przeniesienie` — ograniczenie czasowe fazy, ryzyko oceniam
   jako niskie z uwagi na wspólny mechanizm.
