# FAZA 7 — wynik: klasyczne błędy aplikacji generowanych automatycznie

> Zakres znalezisk: **Z-350 do Z-361** w `testy-audyt/ZNALEZISKA.md` (zarezerwowany zakres
> Z-350–Z-379, wykorzystano częściowo). Pytanie dodatkowe: **P-015** w
> `testy-audyt/PYTANIA-DO-LUKASZA.md`. Zrzuty: `testy-audyt/zrzuty/faza7/`. Skrypty pomocnicze:
> `testy-audyt/skrypty/faza7-*.js`.

**Brak znalezisk wagi KRYTYCZNY w tej fazie.** Najpoważniejsze znaleziska to POWAŻNE (Z-350,
Z-351, Z-353, Z-354) — żadne z nich samo w sobie nie psuje integralności już dokonanego wpisu do
rejestru ani nie ujawnia danych; dotyczą duplikatów rekordów roboczych (kartoteka osób, sprawy) i
jednego wizualnego uszkodzenia layoutu. Ścieżka **dokonania wpisu** (`POST
/api/psa/sprawy/:id/wpisz`) jest, potwierdzone bezpośrednim testem współbieżności, odporna na
duplikat (Z-352) — to najważniejszy pojedynczy, POZYTYWNY wynik tej fazy: tam, gdzie liczy się to
najbardziej (sam rejestr), aplikacja się broni.

## `npm audit` w głównym repozytorium (`/home/user/Proste-Spolki-Akcyjne`)

Uruchomiono `npm audit` (odczyt, bez `--fix`) — zależności produkcyjne (192 pakiety w drzewie
`prod`):

| Waga | Liczba |
|---|---|
| krytyczna | 1 (`tar`, tranzytywnie przez `@mapbox/node-pre-gyp` ← `bcrypt`, wyłącznie przy budowaniu natywnego modułu) |
| wysoka | 3 (`bcrypt`, `@mapbox/node-pre-gyp`, `nodemailer`) |
| średnia | 3 (`express`/`body-parser` przez `qs`, `qs` samo) |
| niska | 0 |
| **razem** | **7** |

Szczegóły, cytaty poszczególnych CVE/advisory i ocena wagi „do decyzji" (nie automatyczny
KRYTYCZNY, bo ścieżka `tar`/`node-pre-gyp` dotyczy wyłącznie procesu budowy, nie runtime) — patrz
**Z-360**. Wersjonowanie zależności: `package.json` deklaruje WSZYSTKIE zależności zakresowo
(`^x.y.z`), żadna nie jest przypięta do dokładnej wersji; `package-lock.json` istnieje i przypina
faktycznie zainstalowane wersje na chwilę obecną, ale nie ogranicza przyszłych `npm install` do tych
samych wersji w ramach tego samego zakresu `^`.

## Lista znalezisk tej fazy

| ID | Waga | Skrót |
|---|---|---|
| Z-350 | POWAŻNY | Kartoteka osób: podwójne żądanie tworzy dwa identyczne rekordy; dwie różne osoby mogą mieć ten sam PESEL bez ostrzeżenia. |
| Z-351 | POWAŻNY | Założenie sprawy: podwójne żądanie tworzy dwie niezależne sprawy, każda z własnym terminem ustawowym 7 dni. |
| Z-352 | POZYTYWNE | Dokonanie wpisu (`/wpisz`) jest odporne na dwa równoczesne żądania — dokładnie jedno zdarzenie, jedna opłata. |
| Z-353 | POWAŻNY | Zerwanie połączenia klienta w trakcie zapisu nie przerywa zapisu po stronie serwera; brak potwierdzenia dla klienta; w zestawieniu z Z-350/Z-351 realne ryzyko duplikatu przy „retry". |
| Z-354 | POWAŻNY | Brak limitu długości pola „nazwa" spółki — nazwa 300-znakowa psuje layout pulpitu, listy spółek i kolejki spraw (zrzuty). |
| Z-355 | POZYTYWNE | Puste stany (spółka bez zdarzeń/akcjonariuszy) obsłużone poprawnie, bez błędów i bez placeholderów w dokumentach. |
| Z-356 | POZYTYWNE | Niepowodzenie wysyłki e-mail nigdy nie ginie po cichu — sprawdzone systematycznie we wszystkich miejscach wywołania. |
| Z-357 | DROBNY | Przypomnienia o kończącym się roku prowadzenia rejestru nie mają automatycznego wyzwalacza (tylko ręczny przycisk). |
| Z-358 | POZYTYWNE | Termin 7 dni liczony kalendarzowo; wznowienie po przeszkodzie uruchamia pełny nowy bieg — potwierdzone testem API, zgodne z art. 300³⁴ § 1 zd. 2. |
| Z-359 | DROBNY/pytanie | Brak mechanizmu oznaczania danych jako testowe/demonstracyjne w całej bazie (poza wąskim wyjątkiem `psa_platnosci.tryb_testowy`). |
| Z-360 | do decyzji | `npm audit`: 1 krytyczna, 3 wysokie, 3 średnie; zależności nieprzypięte (zakresy `^`). |
| Z-361 | POZYTYWNE | Walidacja liczby akcji/ceny/dat i obsługa znaków polskich/apostrofu — poprawne na serwerze niezależnie od front-endu, we wszystkich sprawdzonych wariantach. |

Pytanie dodatkowe: **P-015** (czy aplikacja ma docelowo wspierać oznaczanie danych testowych na
koncie produkcyjnym).

## Metoda (skrót)

Zgodnie z zasadą 3 sesji, każdy test wykonano bezpośrednim żądaniem HTTP z pominięciem formularza
(`curl`/`fetch`/surowy socket TCP), na dwóch nowych spółkach testowych utworzonych do tego celu w
`./dane/audyt-test.db` (spółka #9 z nazwą 300-znakową; spółka #11 bez żadnych zdarzeń) — bez
naruszania danych innych faz. Test wyścigu dla `/wpisz` (Z-352) i test zerwania połączenia (Z-353)
wykonano skryptami Node (`testy-audyt/skrypty/faza7-race-wpisz.js`,
`faza7-abort-socket.js`/`faza7-abort-polaczenia.js`). Przegląd „martwych funkcji" wykonano
Playwrightem (`faza7-martwe-funkcje.js`) — nawigacja po siedmiu głównych ekranach kancelarii z
przechwytywaniem błędów konsoli i odpowiedzi HTTP ≥400 na `/api/`; zrzuty w
`testy-audyt/zrzuty/faza7/martwe-*.png`.

## Czego NIE udało się przetestować i dlaczego

1. **Rzeczywisty automatyczny wyzwalacz przypomnień** (Z-357) — nie da się „przetestować", że coś
   NIE istnieje poza przeszukaniem kodu (`serwer.js`, `package.json`, brak `node-cron`/
   `setInterval`) — potwierdzone czytaniem kodu i jawnym komentarzem w `server/trasy/oplaty.js`,
   nie osobnym eksperymentem behawioralnym (nie da się „poczekać" realnie na coś, co nigdy nie ma
   się wydarzyć samo).
2. **Realna wysyłka e-mail** — jak w FAZA 1, środowisko audytu nie ma skonfigurowanego SMTP;
   Z-356 potwierdza wyłącznie, że BRAK wysyłki jest poprawnie zgłaszany, nie sprawdza treści/
   renderowania HTML maila w realnej skrzynce.
3. **Martwe funkcje / dead links** — przegląd Playwright objął TYLKO siedem głównych ekranów
   kancelarii (pulpit, spółki, kartoteka osób, opłaty, zgłoszenia, wnioski, kolejka spraw), nie
   każdy pod-ekran/modal/zakładkę (np. ekrany portalu klienta, kreator spółki krok po kroku,
   ustawienia/szablony dokumentów) — w granicach sprawdzonego zakresu nie znaleziono ani jednego
   błędu konsoli JS ani odpowiedzi API ≥400 poza oczekiwanymi (żadnego finding „martwy przycisk"
   nie odnotowano — brak dowodu nie jest dowodem nieobecności, zakres nie był wyczerpujący).
4. **Wpływ podatności `npm audit` w praktyce** — nie sprawdzałem, czy którakolwiek z 7 podatności
   jest FAKTYCZNIE wykorzystywalna w konkretnej konfiguracji tej aplikacji (np. czy `nodemailer`
   jest kiedykolwiek karmiony adresem/nagłówkiem pochodzącym wprost od nieuwierzytelnionego
   użytkownika) — to wymagałoby osobnej analizy per-CVE, poza zakresem rozsądnym dla tej fazy;
   odnotowano surowy wynik audytu i zostawiono ocenę wykorzystywalności do decyzji.
5. **Pola tekstowe inne niż „nazwa" spółki pod kątem limitu długości** (Z-354 wspomina to jako
   niepewność) — nie sprawdzałem systematycznie `ulica`, `opis`, `uwagi`, nazwisk osób itd. pod
   kątem analogicznego braku limitu — prawdopodobne na podstawie tego samego wzorca kodu
   (`sprawdzDaneSpolki`/`sprawdzOsobe` nie sprawdzają długości żadnego pola tekstowego), ale nie
   zweryfikowane wprost dla każdego pola z osobna.
