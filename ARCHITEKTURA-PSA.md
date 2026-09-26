# ARCHITEKTURA-PSA.md — opis stanu faktycznego

> **To jest opis TEGO, CO JEST W KODZIE, nie tego, co miało być.** `CLAUDE-PSA.md` opisuje stan
> sprzed kilku sprintów — realna aplikacja ma podsystemy, których tam nie ma (wnioski portalowe,
> zgłoszenia, płatności tpay, skany AML, dziennik dostępu, deklinacja polska w szablonach). Każda
> rozbieżność wobec `CLAUDE-PSA.md` jest odnotowana w sekcji 8, bez oceniania, które jest „lepsze".
>
> Ma obowiązek stałej aktualizacji — patrz `README.md`, sekcja „Dokumentacja".

---

## 1. Mapa plików

### Punkt wejścia

| Plik | Opis |
|---|---|
| `serwer.js` | Punkt wejścia: konfiguruje Express, uruchamia migracje, montuje wszystkie trasy `/api/psa/...` i serwuje `publiczne/`. |

### `server/*.js`

| Plik | Opis |
|---|---|
| `server/baza.js` | Otwiera wspólne połączenie SQLite (better-sqlite3) do bazy dzielonej z resztą kancelarii, dotykając wyłącznie obiektów `psa_*`. |
| `server/konfiguracja.js` | Własny (bez `dotenv`) parser `.env` i eksport stałych konfiguracyjnych modułu. |
| `server/migracje.js` | Tablica 44 idempotentnych migracji schematu SQLite + silnik je wykonujący przy starcie. |
| `server/oplaty.js` | Serwis rozliczeń (naliczanie/prowadzenie rejestru, wpis, informacja z rejestru) wg stawek z `logika/przepisy.js`. |
| `server/platnosci.js` | Łączy powiadomienia tpay z bazą: oznacza opłatę jako opłaconą, uskutecznia żądanie wpisu (start biegu 7 dni), odblokowuje informację z rejestru. |
| `server/poczta.js` | Wysyłka e-mail przez nodemailer, bezpieczna „no-op" gdy brak danych SMTP w `.env`. |
| `server/rejestr.js` | Serwis zapisu zdarzeń i pełnej materializacji stanu spółki (emisje, stan akcji, obciążenia, uprawnienia, ograniczenia) po każdym zdarzeniu. |
| `server/widoki.js` | Zamienia stan domenowy na struktury dla UI/wydruków z zastosowanym maskowaniem danych wrażliwych. |
| `server/zawiadomienia.js` | Generuje i wysyła cztery pisma wychodzące ze sprawy jako wypełnione wzory `.docx`, z zapisem śladu w `psa_wydane_dokumenty`. |

### `server/trasy/*.js` (15 plików)

| Plik | Opis |
|---|---|
| `auth.js` | Trasy logowania pracowników kancelarii (sesja w httpOnly cookie). |
| `krs.js` | **Nie jest routerem** — pobiera dane spółki z otwartego API KRS; przy błędzie zwraca odpowiedź bez wyjątku, nie blokuje rejestracji. Używany przez `spolki.js`/`wnioski.js`/`portal.js`. |
| `oplaty.js` | Trasy rozliczeń — lista, korekty, status opłat. |
| `osoby.js` | Trasy wspólnej kartoteki osób (`psa_osoby`) — jeden inwestor wpisany raz w wielu spółkach (reguła nr 10 — patrz sekcja 4, gdzie ta reguła jest w praktyce NIEegzekwowana). |
| `platnosci.js` | Trasa `/tpay/itn` — jedyne źródło prawdy o zapłacie, z trójwarstwową weryfikacją autentyczności powiadomienia (suma kontrolna, podpis JWS, adres nadawcy). |
| `portal.js` | Trasy portalu klienta — publiczna część API, tożsamość i sesja osobna od pracownika, świadomie zawężony kreator (bez kroku „co się zmienia"). |
| `pozostale.js` | Pulpit, integralność łańcucha, katalogi meta, nagłówek kancelarii, stuby 501. |
| `spolki.js` | Trasy zarządzania spółkami kancelarii — rejestracja, otwarcie rejestru, edycja. |
| `sprawy.js` | Trasy maszyny stanów sprawy (nowa→weryfikacja→wpisana/odmowa/wstrzymana/anulowana). |
| `szablony.js` | Trasy tylko-do-odczytu podglądu wzorów pism `.docx` z dysku, zastrzeżone dla admina. |
| `wnioski.js` | Trasy weryfikacji wniosku klienta przez kancelarię, łącznie z jedyną operacją realnie zakładającą wpisy (`POST /:id/przyjmij`). |
| `wspolne.js` | Trasa nagłówka dokumentów kancelarii (`rdzen_kancelaria`). |
| `zawiadomienia.js` | Trasy ręcznej, zbiorczej wysyłki zawiadomień o wpisie po zamknięciu kompletu zdarzeń sprawy. |
| `zdarzenia.js` | Trasa sprostowania zdarzenia — jedyna droga korekty wpisu w łańcuchu. |
| `zgloszenia.js` | Trasy kolejki zgłoszeń wstępnych portalu (lead przed założeniem konta/sprawy). |

### `server/logika/*.js` (36 plików, czysta domena — zero dostępu do bazy)

| Plik | Opis |
|---|---|
| `akcjonariusz.js` | Reguły walidacji danych akcjonariusza (art. 300³³ §1 pkt 2–5 KSH), współdzielone przez kartotekę, wniosek klienta i przyjęcie wniosku. |
| `aml.js` | Czysta ocena dezaktualizacji przeglądu AML — sygnał, nie blokada. |
| `bloki-dokumentu.js` | Model treści dokumentu jako lista edytowalnych bloków (zamiast gotowego PDF/HTML). |
| `dane-probne.js` | Komplet danych testowych do podglądu wzorów, przepisany 1:1 z generatora Python. |
| `daty-krs.js` | Parsuje daty z API KRS (`DD.MM.RRRR`) do formatu ISO. |
| `docx.js` | Wypełnia wzory `.docx` danymi z rejestru (silnik `{{klucz}}`). |
| `dokumenty-tresc.js` | Deterministyczna, offline generacja HTML dla pism wychodzących (mail + zapis audytowy). |
| `dokumenty-wniosku.js` | Komplet dokumentów wniosku o prowadzenie rejestru jako listy bloków. |
| `dziennik-dostepu.js` | Append-only log wglądu w dane osobowe (wąski zakres: tylko realny wgląd/eksport). |
| `hasla.js` | Hashowanie haseł przez bcrypt (koszt 12). |
| `informacja-dokument.js` | Jedyny dokument wystawiany ze stanu rejestru (art. 300³⁵ §3 KSH) — wspólny dla ekranu kancelarii i portalu. |
| `kontekst-pisma.js` | Buduje kontekst danych dla wszystkich 10 wzorów pism (4 automatyczne, 5 na żądanie). |
| `kreator.js` | Przekłada wejście z kreatora na treść zdarzenia; FIFO przydział numerów akcji (reguła nr 4). |
| `lancuch.js` | Globalny łańcuch skrótów SHA nad `psa_zdarzenia` (integralność append-only). |
| `limiter.js` | Rate limiting logowania — własna implementacja, licznik w pamięci procesu, okno przesuwne. |
| `maskowanie.js` | Maskuje PESEL/datę urodzenia/adres wobec innych akcjonariuszy (reguła nr 9) — patrz sekcja 4 co do zakresu tego maskowania. |
| `numery.js` | Algebra zakresów numerów akcji — normalizacja, FIFO po najniższym wolnym numerze. |
| `pakiet-wniosku.js` | Zarządza kompletem dokumentów wniosku na dysku/w bazie — wystawianie, poprawa, udostępnianie klientowi. |
| `pdf.js` | Składa oświadczenia (RODO, AML, zgoda komunikacji) jako PDF przez pdfkit. |
| `przepisy.js` | JEDYNE źródło stawek, terminów i reguł prawnych modułu, z odwołaniami do jednostek `PRZEPISY-PSA.md`. |
| `przypomnienia.js` | Nalicza kolejny okres i wysyła przypomnienie o kończącym się roku prowadzenia rejestru, liczone per rocznica spółki. |
| `regon.js` | Normalizacja i miękka walidacja sumy kontrolnej REGON. |
| `sad-rejestrowy.js` | Fallback sądu rejestrowego na podstawie tabeli gmin/wydziałów, gdy API KRS go nie zwraca. |
| `sesja.js` | Własny bezstanowy token sesji podpisany HMAC-SHA256 (bez JWT). |
| `stan.js` | Odbudowuje cały stan akcjonariatu ze zdarzeń (materializacja `psa_stan_akcji`/`psa_obciazenia`). |
| `szablony.js` | Minimalny silnik szablonów HTML (`{{klucz}}`, `{{#lista}}`) dla starszych pism wychodzących. |
| `terminy.js` | Liczy termin 7-dniowy z zawieszeniem (zamrożeniem) zegara na czas stanu `wstrzymana`. |
| `tpay.js` | Klient płatności tpay (OAuth, zakładanie transakcji, weryfikacja autentyczności ITN) — bez dostępu do bazy. |
| `typy-zdarzen.js` | Katalog typów zdarzeń rejestrowych jako dane: odpłatność, checklisty, generowane dokumenty. |
| `ulamki.js` | Arytmetyka całkowita (licznik/mianownik) na ułamkowych częściach akcji, bez floatów. |
| `ustawienia.js` | Ustawienia kancelarii edytowalne z aplikacji — baza nadpisuje `.env`. |
| `walidacje.js` | Walidacje blokujące zdarzenia — kontrole szczegółowe + odtworzenie i zbilansowanie całego rejestru. |
| `wzory-dysk.js` | Katalog wzorów pism `.docx` czytanych z `wzory/` na dysku (wersjonowanie przez git + hash SHA-256). |
| `zaproszenia.js` | Zakłada/odnajduje konto portalowe i wysyła link aktywacyjny. |
| `zip.js` | Własny, minimalny czytnik/zapis archiwów ZIP (bez zależności) do obsługi `.docx`. |
| `znak-sprawy.js` | Nadaje znak sprawy `RA/ROK/NNNN`, sekwencja per rok liczona jako MAX już nadanych numerów. |

**Podsystem deklinacji polskiej — rozbieżność.** Komentarz w `server/migracje.js:994-1011` (migracja 18)
opisuje plan modułu `logika/deklinacja.js`. **Ten plik nie istnieje w repozytorium.** Bieżący kod
(`kontekst-pisma.js`) świadomie z automatu deklinacji zrezygnował — dane reprezentanta idą do pism w
mianowniku z etykietą, nie w odmienionej formie. Kolumny `reprezentant_biernik_recznie`,
`reprezentant_funkcja_biernik_recznie`, `reprezentant_rodzice_recznie` w schemacie to ślad tamtego
planu — dziś martwe, nieużywane przez bieżący kod. Patrz też `DECYZJE.md` D-035.

### `server/pomocnicze/*.js` (5 plików)

| Plik | Opis |
|---|---|
| `autoryzacja.js` | Uwierzytelnianie sesyjne — dwa niezależne ciasteczka (`psa_sesja` pracownik, `psa_sesja_portal` klient). |
| `ciasteczka.js` | Własny minimalny parser/serializator ciasteczek (bez `cookie-parser`). |
| `czas.js` | Formatowanie dat/czasu w ISO 8601 ze strefą (TZ Europe/Warsaw). |
| `odpowiedzi.js` | Wspólne odpowiedzi HTTP i klasa błędu żądania (`BladZadania`), komunikaty po polsku. |
| `pliki.js` | Bezpieczne typowanie plików wgrywanych przez klientów — typ ustala serwer po rozszerzeniu z białej listy, nie nagłówek klienta. |

### `narzedzia/*.js`

| Plik | Opis |
|---|---|
| `scenariusz-e2e.js` | Skrypt E2E przechodzący całą ścieżkę od zgłoszenia klienta po pierwsze zawiadomienie, przez realne trasy HTTP z dwoma osobnymi sesjami (portal + kancelaria). |
| `dokumentacja-baza.js` | Generuje `testy-audyt/schemat-bazy.txt` z realnego schematu bazy (część `npm run dokumentacja`). |
| `dokumentacja-endpointy.js` | Generuje `testy-audyt/endpointy-api.md` przez introspekcję żywych routerów Express (część `npm run dokumentacja`). |

### `publiczne/js/*.js` (26 plików, frontend bez bundlera, React przez Babel)

| Plik | Opis |
|---|---|
| `app.js` | Powłoka aplikacji kancelaryjnej i router (nawigacja, topbar, paleta poleceń). |
| `auth.js` | Hook sesji pracownika (logowanie e-mail+hasło, blokuje aplikację do czasu znajomości sesji). |
| `dokumenty-na-zadanie.js` | Ekran pięciu wzorów wystawianych na żądanie ze spółki (umowa, RODO, uchwała, lista dla sądu, klauzula zbycia). |
| `kokpit.js` | Kokpit spółki — jeden ekran z metryką, rejestrami (akcjonariusze/akcje/uprawnienia/zajęcia), aktami i łańcuchem zdarzeń. |
| `konfiguracja.js` | Podgląd stawek i terminów pobieranych z API (front nie powiela wartości). |
| `kreator.js` | Kreator zdarzenia — 4 kroki, wspólny schemat dla każdego typu; ręczne numery akcji ukryte pod przełącznikiem. |
| `migracja.js` | Ekran „stan otwarcia" — ręczne wprowadzenie historycznego stanu akcjonariatu dla spółek migrowanych spoza aplikacji. |
| `oplaty.js` | Ekran podglądu i ręcznych korekt rozliczeń (logika naliczania żyje w `server/oplaty.js`). |
| `osoby.js` | Kartoteka wspólna osób/akcjonariuszy (reguła nr 10). |
| `pesel.js` | Rozkład numeru PESEL na datę urodzenia i płeć, bez zależności UI — do autouzupełniania, nigdy do blokady. |
| `podglad.js` | Strona `/podglad` — katalog systemu wizualnego (żywa dokumentacja stanów komponentów). |
| `portal.js` | Aplikacja portalu klienta — osobny punkt wejścia, własna sesja, zawężony kreator. |
| `prawne.js` | Treść polityki prywatności i regulaminu portalu, wspólna dla obu aplikacji. |
| `pulpit.js` | Ekran startowy — liczby zbiorcze + lista spraw w toku + szybkie akcje. |
| `rdzen.js` | Klient API (fetch + cookies), formatowanie, nawigacja, wspólne hooki — bez bundlera, przypisuje do `window`. |
| `spolki.js` | Lista spółek i czterokrokowy kreator rejestracji nowej spółki (import KRS + atomowe otwarcie rejestru). |
| `sprawy.js` | Kolejka spraw i kokpit sprawy — osadza kroki 3–4 kreatora, wspólne dla nowej sprawy i wznowienia. |
| `szablony.js` | Ekran podglądu wzorów pism z dysku (tylko do odczytu). |
| `ui-rejestr.js` | Nowe komponenty bazowe (przyciski, karty, pola) w klasach z `rejestr.css`. |
| `ui.js` | Starsze komponenty zastane, stopniowo wypierane przez `ui-rejestr.js`. |
| `uzytkownicy.js` | Zarządzanie kontami pracowników kancelarii (tylko admin). |
| `wniosek.js` | Kreator wniosku o prowadzenie rejestru w portalu klienta — 4 etapy (spółka, reprezentant, akcjonariusze, podsumowanie). |
| `wnioski.js` | Ekran wniosku klienta po stronie kancelarii — weryfikacja, porównanie z KRS, wystawienie i udostępnienie dokumentów. |
| `wydruk.js` | Ekran informacji z rejestru akcjonariuszy — pasek wyboru odbiorcy/dnia + podgląd (dokument składa serwer). |
| `zawiadomienia.js` | Kolejka zbiorczej wysyłki zawiadomień o wpisie, grupowana po spółce. |
| `zgloszenia.js` | Kolejka zgłoszeń wstępnych z publicznego formularza portalu (odrzuć/zaproś). |

### `publiczne/*.html`

| Plik | Opis |
|---|---|
| `index.html` | Renderuje powłokę SPA aplikacji kancelaryjnej — React/Babel lokalnie z `/vendor`, wszystkie 24 moduły `publiczne/js/*` w ustalonej kolejności. |
| `portal.html` | Renderuje osobną SPA portalu klienta — ten sam stack wizualny, tylko 7 modułów JS. |

### `strona/*` — strona publiczna (SEO), bundel statyczny osobny od `serwer.js` (D-063/D-065)

Wdrożenie 1:1 zatwierdzonego przez Łukasza projektu (`SESJA-PSA-STRONA.md` wersja 5,
26.09.2026) — jedna strona główna (sekcje: Opłaty, Jak działa portal, Informacja z rejestru,
Pytania) plus dwie podstrony prawne. Zastąpiło poprzedni, wieloplikowy generator z D-064.

| Plik | Opis |
|---|---|
| `projekt-strony/nowa-strona.html` | **Źródło prawdy** — zatwierdzony projekt, bez zmian poza tym, co wymaga wdrożenia. Nie edytować ręcznie treści/stylu/animacji. |
| `projekt-strony/notariat.png`, `projekt-strony/og-rejestr.png` | Obrazy: znak Notariatu (stopka) i wygenerowany zrzut sekcji hero 1200×630 (Open Graph). |
| `narzedzia/buduj-strone.js` | Generator: wydziela CSS/JS z projektu do osobnych plików, podstawia `{{BASE_URL}}`, kwoty (jedyne źródło: `server/logika/przepisy.js`, `STAWKI_GROSZE`) i dane kancelarii (jedyne źródło: `ustawienia.kancelaria(db())`), generuje `regulamin.html`/`polityka-prywatnosci.html` w tej samej ramie wizualnej (treść z `publiczne/js/prawne.js`, jedyne źródło tych tekstów). Wyjście: `strona/dist/`. Uruchamiane `npm run buduj-strone`. |
| `strona/dist/` | Wyjście generatora — śledzone w git, przebudowywane idempotentnie: `index.html`, `regulamin.html`, `polityka-prywatnosci.html`, `strona.css`, `strona.js` (defer — nawigacja/menu/animacje), `wczesnie.js` (bez defer — wykrycie `prefers-reduced-motion` przed pierwszym renderem), `fonty/`, `obrazy/`, `sitemap.xml`, `robots.txt`. |

Trzy strony: `/`, `/regulamin`, `/polityka-prywatnosci`. Adresy bezwzględne przez
`BASE_URL_STRONA` (`server/konfiguracja.js`) — domena nierozstrzygnięta (Q2/D-049). Strona nie
zapisuje żadnych ciasteczek ani danych w przeglądarce (zweryfikowane w tej sesji).

---

## 2. Podsystemy

**Zgłoszenia i wnioski portalowe.** Ścieżka: publiczny `POST /api/psa/portal/zgloszenia` (bez sesji)
zapisuje `psa_zgloszenia` (status `nowe`) i — o ile poczta skonfigurowana — od razu wysyła zaproszenie
(`logika/zaproszenia.js`), zakładając nieaktywne `psa_konta` (rola `wnioskodawca`,
`token_aktywacji`). Klient aktywuje konto (`GET/POST /api/psa/portal/aktywacja/:token`), zakłada
`psa_wnioski` (status `w_przygotowaniu`), edytuje dane (`PUT /portal/wniosek`, opcjonalnie z KRS),
dodaje pozycje do `psa_wnioski_akcjonariusze` i pliki do `psa_wnioski_dokumenty`. `POST /wniosek/zloz`
zamyka edycję (status `zlozony`). Kancelaria generuje komplet dokumentów do podpisu
(`logika/pakiet-wniosku.js`, `logika/dokumenty-wniosku.js`), klient odsyła podpisane skany
(`POST /wniosek/odeslij` → status `umowa_podpisana`). Kancelaria weryfikuje w `server/trasy/wnioski.js`
i finalizuje `POST /:id/przyjmij`. Tabele: `psa_zgloszenia`, `psa_wnioski`, `psa_wnioski_akcjonariusze`,
`psa_wnioski_dokumenty`, `psa_konta`. Pliki: `server/trasy/portal.js`, `server/trasy/wnioski.js`,
`server/trasy/zgloszenia.js`, `server/logika/zaproszenia.js`, `server/logika/pakiet-wniosku.js`.

**Rejestr i łańcuch zdarzeń.** `psa_zdarzenia` jest append-only, wymuszone triggerami
`BEFORE UPDATE/DELETE` na poziomie bazy, każdy wiersz niesie `hash`/`hash_poprzedni` (łańcuch
SHA-256). `psa_stan_akcji` to materializacja — zawsze pełne odtworzenie ze zdarzeń, nigdy
przyrostowe. Endpointy: `POST /api/psa/spolki/:id/zdarzenia`, `POST /:id/przelicz` (ręczna odbudowa),
`GET /:id/stan`, `GET/POST /api/psa/zdarzenia/:id[/sprostuj]`. Tabele: `psa_zdarzenia`,
`psa_stan_akcji`, `psa_emisje`, `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia`. Pliki:
`server/rejestr.js`, `server/logika/stan.js`, `server/logika/numery.js`, `server/logika/ulamki.js`,
`server/logika/lancuch.js`, `server/trasy/spolki.js`, `server/trasy/zdarzenia.js`.

**Sprawy i terminy.** `psa_sprawy` to workflow ze stanami
`nowa → weryfikacja → (wstrzymana ⇄ weryfikacja) → wpisana|odmowa|anulowana`, sterowany akcjami w
`PATCH /api/psa/sprawy/:id` (`body.akcja`). Termin 7-dniowy liczony wyłącznie w
`server/logika/terminy.js::policzTermin` — w stanie `wstrzymana` zegar jest zamrożony, po wznowieniu
biegnie pełne nowe 7 dni. Wpis dokonuje się `POST /sprawy/:id/wpisz`. Tabele: `psa_sprawy`,
`psa_dokumenty`. Pliki: `server/trasy/sprawy.js`, `server/logika/terminy.js`,
`server/logika/typy-zdarzen.js`, `server/logika/kreator.js`.

**Opłaty i płatności.** `psa_oplaty` naliczane automatycznie w trzech miejscach: przy wpisie
(`rejestr.dokonajWpisuSprawy`), przy informacji z rejestru (portal auto, kancelaria ręcznie) i
wsadowo `POST /api/psa/oplaty/naliczenie-roczne`. `psa_platnosci` to relacja jeden-do-wielu z opłatą
(dostawca `tpay`), sterowane przez `server/platnosci.js` + `server/logika/tpay.js` +
`server/trasy/platnosci.js`. Endpointy: `/api/psa/oplaty/*`, `/api/psa/portal/oplaty*`,
`/api/psa/portal/informacja/*`, `POST /api/psa/platnosci/tpay/itn`. Tabele: `psa_oplaty`,
`psa_platnosci`. Pliki: `server/oplaty.js`, `server/platnosci.js`, `server/logika/tpay.js`,
`server/trasy/oplaty.js`, `server/trasy/platnosci.js`.

**Dokumenty i szablony.** Dwa niezależne silniki generowania: (1) `logika/dokumenty-tresc.js` —
deterministyczny HTML (zawiadomienia/wezwania; `sciezka_pdf` zawsze `NULL` — brak bibliotek PDF,
wydruk przez `window.print()`); (2) `logika/docx.js` + `logika/wzory-dysk.js` — wypełnianie wzorów
`.docx` redagowanych w Wordzie. `logika/szablony.js` + `psa_szablony` (z triggerami append-only)
obsługują szablony HTML edytowalne w UI (tylko admin, `/api/psa/szablony/*`). Tabele: `psa_szablony`,
`psa_dokumenty`, `psa_wydane_dokumenty`, `psa_spolki_dokumenty`, `psa_wnioski_dokumenty`. Pliki:
`server/logika/dokumenty-tresc.js`, `server/logika/docx.js`, `server/logika/wzory-dysk.js`,
`server/logika/kontekst-pisma.js`, `server/logika/bloki-dokumentu.js`,
`server/logika/informacja-dokument.js`, `server/trasy/szablony.js`.

**Portal klienta.** Osobna SPA (`publiczne/portal.html`), osobna sesja (`psa_sesja_portal`),
montowana za flagą `PORTAL_WLACZONY` (503 gdy wyłączona). Izolacja od kancelarii: trzy warstwy w
`server/trasy/portal.js` — `router.use(wymagajKonta)`, `router.param('spolkaId', ...)` i
`router.use(wymagajDostepuDoSpolkiWCiele)`. `maDostepDoSpolki` (linia ~126): dla roli `spolka`
sprawdza `psa_konta_spolki`; dla roli `akcjonariusz` sprawdza **na żywo** `psa_stan_akcji` — dostęp
automatycznie wygasa po zbyciu wszystkich akcji (patrz też `DECYZJE.md` D-039). Portal celowo zbiera
tylko kroki 1-2 kreatora zdarzeń, nie krok 3 „co się zmienia" (żeby nie ujawniać klientowi wspólnej
kartoteki `psa_osoby` z cudzym statusem AML). Tabele: `psa_konta`, `psa_konta_spolki`. Pliki:
`server/trasy/portal.js`, `server/pomocnicze/autoryzacja.js`.

**AML.** Bramka częściowa: `psa_osoby.aml_status` ∈ `brak|w_toku|wykonane|niemozliwe`; tylko
`niemozliwe` twardo blokuje wpis, `brak` to tylko ostrzeżenie (patrz sekcja 4, niezmiennik #10 —
w praktyce ta bramka jest dziś skuteczna wyłącznie dla `niemozliwe`). `server/logika/aml.js` liczy
wyłącznie przeterminowanie okresowego przeglądu — sam sygnał, nie blokada. Skany dowodowe:
`psa_osoby_skany_aml` z polem retencji, upload przez multer za `wymagajProceduryAml`. Dwa
niezależne zestawy pól PEP (`pep_oswiadczenie`/`_data` vs `pep`/`pep_opis`) — patrz sekcja 8, rozjazd
przy onboardingu. Endpointy: `GET/POST /api/psa/osoby/:id/aml-skany*`. Pliki: `server/logika/aml.js`,
`server/trasy/osoby.js`.

**Dziennik dostępu.** `server/logika/dziennik-dostepu.js` — append-only (osobno od łańcucha
zdarzeń), WĄSKI zakres: loguje tylko realny wgląd/wyniesienie danych wrażliwych
(`informacja_z_rejestru`, `raport_sad`, `eksport`, `pobranie_pliku`, `zmiana_ustawien`) — nie każde
wyświetlenie listy/kokpitu ani odczyt portalowy. Tabela: `psa_dziennik_dostepu`.

**Uwierzytelnianie.** Dwie niezależne bezstanowe sesje ciasteczkowe, token HMAC-SHA256 w
`server/logika/sesja.js` — payload niesie tylko `{typ, id, exp}`, stan konta czytany z bazy przy
każdym żądaniu. TTL: 12h pracownik / 8h portal. `logika/limiter.js` — rate limiting logowania w
pamięci procesu, okno przesuwne 15 min, limit 5 prób per `IP+identyfikator` oraz 30 prób per samo IP.
Tabele: `psa_uzytkownicy`, `psa_konta`. Pliki: `server/logika/sesja.js`, `server/logika/limiter.js`,
`server/pomocnicze/autoryzacja.js`, `server/logika/hasla.js`, `server/trasy/auth.js`.

---

## 3. Przepływy

### (a) Od zgłoszenia publicznego do przyjęcia wniosku

1. `POST /api/psa/portal/zgloszenia` (publiczny) — wymaga e-maila i numeru KRS; limiter; sprawdza
   duplikaty po KRS; opcjonalnie odpytuje KRS. Zapisuje `psa_zgloszenia` i **od razu** wysyła
   zaproszenie — zakłada nieaktywne `psa_konta` (rola `wnioskodawca`); gdy poczta nie działa, link
   aktywacyjny wraca w odpowiedzi HTTP.
2. Aktywacja: `POST /api/psa/portal/aktywacja/:token` ustawia hasło, `aktywne=1` — od razu zalogowana
   sesja portalowa.
3. Klient wypełnia dane spółki (`PUT /portal/wniosek`), dodaje akcjonariuszy, wgrywa dokumenty.
   `POST /wniosek/zloz` zamyka edycję → status `zlozony`.
4. Kancelaria generuje komplet do podpisu, klient odsyła podpisane skany
   (`POST /portal/wniosek/odeslij`) → status `umowa_podpisana`.
5. Weryfikacja przez kancelarię w `server/trasy/wnioski.js`: porównanie z KRS, per pozycja
   zweryfikowanie akcjonariusza. Alternatywne ścieżki: `POST /:id/do-uzupelnienia` (wraca do klienta)
   albo `POST /:id/odrzuc` (status `odrzucony`, **terminalny** — dane zostają w bazie, nic nie jest
   kasowane).
6. **Przyjęcie** — `POST /api/psa/wnioski/:id/przyjmij`. Twarde bramki: status `umowa_podpisana`,
   ≥1 akcjonariusz, każda pozycja zweryfikowana, każdy dokument z potwierdzonym podpisem. Przepisanie
   danych: jeśli `wniosek.spolka_id` puste, szuka istniejącej spółki po KRS (dowiązuje, nie
   duplikuje); inaczej wstawia nowy wiersz `psa_spolki`. Dla każdego akcjonariusza bez `osoba_id` —
   insert do `psa_osoby`. Dokumenty kopiowane (pliki na dysku) do `psa_spolki_dokumenty`. Konto
   wnioskodawcy przepinane na rolę `spolka`, dodawany wiersz do `psa_konta_spolki`. Naliczana
   pierwsza opłata roczna. **Wniosek dostaje `status='przyjety'` — rekordy w `psa_wnioski*` NIE są
   kasowane**, zostają jako trwały ślad audytowy.

**Niedokończone / odrzucone wnioski.** Brak jakiegokolwiek automatycznego sprzątania — zero `DELETE
FROM psa_wnioski*` w kodzie poza pojedynczymi pozycjami przy edycji. Wniosek w stanie
`w_przygotowaniu` może trwać bezterminowo — nie ma zadania/crona wygaszającego porzucone wnioski.
Jedyny mechanizm czasowy w tej okolicy to `token_wygasa` na koncie aktywacyjnym (portal nie pozwoli
aktywować po wygaśnięciu tokenu), ale sam wiersz `psa_wnioski` nie ma odpowiednika. Status
`odrzucony` jest terminalny, ale dane trwają.

### (b) Od otwartego rejestru do wydanej „informacji z rejestru"

Dwie niezależne ścieżki generujące ten sam dokument (`logika/informacja-dokument.js`):

- **Portal**: `POST /api/psa/portal/informacja/zamow` sprawdza dostęp, sprawdza nierozliczone
  zamówienie (nie dubluje), nalicza opłatę. Dokument **jeszcze nie powstaje**. Po zaksięgowaniu
  opłaty: `POST /informacja/:oplataId/wydaj` generuje treść i zapisuje **raz** do
  `psa_wydane_dokumenty`; `psa_oplaty.wydany_dokument_id` blokuje ponowne wygenerowanie. Zapis do
  dziennika dostępu. `GET /informacja/:id` potem tylko oddaje zapisaną treść — bez ponownego
  naliczenia (ponowne otwarcie bezpłatne, płatne jest wydanie).
- **Kancelaria**: `GET /api/psa/spolki/:id/informacja.html` to czysty podgląd „na żywo" bez zapisu
  po stronie serwera. Fakt wydania i opłatę pracownik odnotowuje ręcznie w ekranie Opłaty (patrz
  `DECYZJE.md` D-021).

---

## 4. Niezmienniki

| # | Reguła (skrót) | Mechanizm | Dowód / uzasadnienie |
|---|---|---|---|
| 1 | Append-only `psa_zdarzenia` | **wyzwalacz DB** | `server/migracje.js:216-227` — RAISE ABORT. Potwierdzone atakiem bezpośrednim na SQLite (Z-300). |
| 2 | Append-only `psa_szablony` | **wyzwalacz DB** | `migracje.js:658-670`. |
| 3 | Bilans akcji per numer = suma ułamków dokładnie 1 lub 0 | **kod aplikacji** | `stan.js: sprawdzBilans()`, `walidacje.js:770-793`, `rejestr.js:418-423`. Brak agregatowego CHECK (niemożliwe w SQLite). Z-013, Z-056. |
| 4 | Ułamek ≠ 1/1 ⇒ dokładnie jeden numer akcji | **CHECK w schemacie** | `migracje.js:452-453,595-598`. |
| 5 | Brak akcji przed wpisem KRS (obecność `data_wpisu_krs`) | **kod aplikacji** | `walidacje.js:311-324,334-342`. Pozytywnie: Z-011. |
| 5b | …ale wiarygodność daty KRS względem daty rejestracji spółki | **kod aplikacji — NAPRAWIONE** | `walidacje.js: sprawdzDataWpisuKrsEmisji()` (komentarz „Naprawa Z-012") — emisja założycielska musi mieć `data_wpisu_krs` RÓWNĄ dacie rejestracji spółki, kolejne emisje wyłącznie PÓŹNIEJSZĄ, żadna data z przyszłości. Był: Z-012 (KRYTYCZNY). |
| 6 | Jeden aktywny podmiot prowadzący rejestr na spółkę | **kod aplikacji — NAPRAWIONE (częściowo)** | `spolki.js: POLA_UMOWY_PO_OTWARCIU` (komentarz „Z-009/P-005") — zmiana danych umowy PO otwarciu rejestru zostawia zdarzenie rejestrowe zamiast cichego nadpisania. Sama liczba aktywnych podmiotów nadal bez osobnej tabeli/blokady — pytanie modelowe pozostaje częściowo otwarte, patrz D-009. Był: Z-009 (POWAŻNY). |
| 7 | Forma prawna = PSA | **kod aplikacji** | `spolki.js:126` + `przepisy.ocenFormePrawna()`. Kolumna bez CHECK — gwarancja zależy od dyscypliny wywołania. Pozytywnie: Z-010. |
| 8 | Grosze jako INTEGER, zero floatów | **kod aplikacji — NAPRAWIONE** | `oplaty.js: dodajOplateReczna()` woła teraz `przepisy.walidujKwoteGrosze()` — ta sama walidacja (integer, brak ujemnych, limit stawki maksymalnej) co automat. Komentarz w kodzie: „Z-101..Z-104". Były: Z-103, Z-101 (KRYTYCZNE), Z-102, Z-104 (POWAŻNE/DROBNE). |
| 9 | Pokrycie jako atrybut akcji, przechodzi niezmienione przy przeniesieniu | **kod aplikacji — NAPRAWIONE** | `server/logika/stan.js` (komentarz „Naprawa Z-054") — `pokryta` domyślnie dziedziczy się ze stanu źródłowych pozycji, gdy wywołujący jej wprost nie narzuca; obejmuje teraz też zwykłe `przeniesienie`. Był: Z-054 (KRYTYCZNY). |
| 10 | Zbycie niepokrytej akcji wymaga zgody spółki | **kod aplikacji — NAPRAWIONE** | Konsekwencja naprawy niezmiennika #9 — `pokryta` już nie ginie po pierwszej transakcji, więc `walidacje.sprawdzPokrycie()` blokuje też kolejne zbycia tych samych akcji. Był: Z-054 (KRYTYCZNY). |
| 11 | Głos per akcja, nie per ułamek | **kod aplikacji — NAPRAWIONE** | `server/logika/kontekst-pisma.js` (komentarz „Naprawa Z-057") — dokumenty/UI liczą głos właściwie dla akcji ułamkowych (współwłasność, przedstawiciel), nie trzy niezależne głosy na jedną akcję. Był: Z-057 (KRYTYCZNY). |
| 12 | Unikalność osoby w kartotece wspólnej | **kod aplikacji — NAPRAWIONE (ostrzeżenie, nie blokada)** | `server/trasy/osoby.js: ostrzezeniaKolizji()` (Z-350, sesja napraw 2026-09-19) — kolizja PESEL/NIP z innym rekordem generuje ostrzeżenie widoczne pracownikowi; świadomie NIE jest twardą blokadą (ta sama osoba legalnie występuje w wielu spółkach — D-042). Był: Z-350 (POWAŻNY). |
| 13 | Maskowanie PESEL/data urodzenia/adres dla innego akcjonariusza | **kod aplikacji — DZIAŁA** | `maskowanie.zamaskujOsobe()`. Z-014, Z-155, Z-156. |
| 14 | Maskowanie AML/PEP/beneficjenta/`uwagi` dla ról spółka/organ | **kod aplikacji — NAPRAWIONE** | `server/logika/maskowanie.js` (komentarz „Naprawa Z-150") — odpowiedź budowana z BIAŁEJ listy pól per rola (`przepisy.BIALE_LISTY`), nie z listy pól do usunięcia; `pelnyDostep` już nie omija maskowania. Był: Z-150 (KRYTYCZNY). |
| 14b | …pól PEP/beneficjenta dla PEER-akcjonariusza | **kod aplikacji — NAPRAWIONE** | Ta sama naprawa (biała lista) obejmuje komplet ~8 pól wrażliwych, nie tylko 4 — ta sama Z-150. |
| 15 | Sesja unieważniana przy wylogowaniu | **kod aplikacji — NAPRAWIONE** | `server/pomocnicze/autoryzacja.js` — wylogowanie dopisuje bieżący token do czarnej listy unieważnień (komentarz „Z-250"); token przestaje działać natychmiast, nie dopiero po TTL. Był: Z-250 (KRYTYCZNY). |
| 16 | Sesja unieważniana przy zmianie hasła | **kod aplikacji — NAPRAWIONE** | `server/pomocnicze/autoryzacja.js` — licznik wersji tokenów podbijany przy zmianie hasła (komentarz „Z-251") unieważnia NATYCHMIAST wszystkie dotychczasowe tokeny konta, nie tylko bieżący. Był: Z-251 (KRYTYCZNY). |
| 17 | Integralność łańcucha zdarzeń | **wyzwalacz DB + kod (weryfikacja)** | `GET /api/psa/integralnosc` przelicza łańcuch, wykrywa manipulacje (Z-302). |
| 18 | Ochrona zdarzenia referencjonowanego przed DELETE | **klucz obcy (FK)** | `PRAGMA foreign_keys=ON`. Działa tylko dla zdarzeń faktycznie referencjonowanych — Z-301 (z zastrzeżeniem). |
| 19 | Odbudowa stanu ze zdarzeń = stan bieżący | **kod aplikacji** | `stan.odtworzStan()` + `POST /:id/przelicz`. Z-303. |
| 20 | Stawka maksymalna opłaty wg typu | **kod aplikacji — NAPRAWIONE** | Ta sama `przepisy.walidujKwoteGrosze()` co niezmiennik #8 — limit egzekwowany też dla ręcznego wpisu. Był: Z-101 (KRYTYCZNY). |
| 21 | „Jedno żądanie = jedna opłata" (idempotencja) | **kod aplikacji — NAPRAWIONE** | `server/oplaty.js: naliczOkresProwadzenia()` — jedna, wspólna, idempotentna funkcja naliczania woła się teraz zarówno z trasy `/naliczenie-roczne`, jak i z `okresyDoOdnowienia()`/przypomnień (Z-357); dwa niezależne mechanizmy z audytu połączone w jeden. Był: Z-100 (KRYTYCZNY). |
| 22 | Zajęcie egzekucyjne wolne od opłaty, bez powiadomienia | **kod aplikacji** | `typy-zdarzen.js:234-246`. Z-106. |
| 23 | Integralność treści podpisanego dokumentu po potwierdzeniu kancelarii | **kod aplikacji — NAPRAWIONE** | Migracja dodaje skrót SHA-256 treści podpisanego skanu w chwili potwierdzenia (komentarz „naprawa Z-205" w `server/migracje.js`); `server/logika/pakiet-wniosku.js` porównuje go przy odczycie, wykrywając podmianę pliku po potwierdzeniu. Był: Z-205 (KRYTYCZNY). |

---

## 5. Integracje zewnętrzne

**KRS** (`server/trasy/krs.js` — moduł logiki mimo lokalizacji w `trasy/`, nigdy nie montowany jako
router). Wywołanie: `GET {KRS_API_URL}/OdpisAktualny/{numerKrs}?rejestr=P&format=json` (otwarte API
Ministerstwa Sprawiedliwości), timeout 8s. Fallback przy niedostępności: błąd połączenia, 404 albo
inny błąd HTTP **nigdy nie rzuca wyjątku 500** — zwraca `{znaleziono:false, powod}`, formularz
przechodzi w tryb ręcznego wypełnienia. Wyjątek: przy zgłoszeniu awaria łącza NIE blokuje, ale jawna
odpowiedź „nie znaleziono"/„zła forma prawna" blokuje. Konfiguracja: `KRS_API_URL` w `.env`.

**tpay** (`server/logika/tpay.js` — klient HTTP bez dostępu do bazy; `server/platnosci.js` — logika
domenowa; `server/trasy/platnosci.js` — webhook). Wywołania: OAuth client credentials → token w
pamięci procesu; założenie transakcji; odpytanie stanu; anulowanie przy zmianie kwoty. Autentyczność
powiadomienia ITN (trasa **celowo poza wszystkimi bramkami sesji**) weryfikowana trójwarstwowo: suma
kontrolna z sekretem (jedyna warstwa realnie odrzucająca), podpis JWS RS256 (certyfikat pobierany raz
i cache'owany), lista adresów IP operatora (tylko sygnał do logu). Odpowiedź zawsze `TRUE` (200) dla
odrzuconych powiadomień, `FALSE`+500 dla błędu własnej aplikacji. Niedostępność/brak konfiguracji:
opłata i tak zostaje naliczona w `psa_oplaty`, rozliczana ręcznie/fakturą. Konfiguracja: `TPAY_CLIENT_ID`,
`TPAY_CLIENT_SECRET`, `TPAY_NOTIFICATION_SECRET`, `TPAY_API_URL`, `TPAY_TRYB_TESTOWY`, `TPAY_URL_POWROTU`.

**SMTP** (`server/poczta.js`, nodemailer). Brak konfiguracji → nie rzuca wyjątku, `wyslij()` zwraca
`{wyslano:false, powod}`; ślad w `psa_wydane_dokumenty` i tak powstaje, dokument czeka na wysyłkę
ręczną. Konfiguracja: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## 6. Migracje (`server/migracje.js`, tablica `MIGRACJE`, 51 pozycji)

| # | Co zmieniła |
|---|---|
| 1 | Rdzeń: `psa_spolki`, `psa_osoby`, `psa_zdarzenia`, `psa_emisje`, `psa_stan_akcji`, `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia` + triggery append-only na `psa_zdarzenia`. |
| 2 | `psa_sprawy`, `psa_dokumenty`, `psa_wydane_dokumenty` (workflow spraw). |
| 3 | `psa_uzytkownicy`, `psa_konta` (uwierzytelnianie). |
| 4 | `psa_oplaty` + przepisanie `psa_wydane_dokumenty` pod rozszerzony CHECK typu. |
| 5 | Ułamkowe części akcji, przedstawiciel, pokrycie, `data_wpisu_krs`, rodzaj akcji, charakter wpisu; backfill `data_wpisu_krs` dla wpisów historycznych. |
| 6 | Rozszerzony import KRS (kapitał akcyjny, e-doręczenia, skład organu) i warunki zgody spółki na zbycie. |
| 7 | `zadajacy_rola` na sprawach + kategoria `uniewazniona` w CHECK stanu akcji. |
| 8 | `psa_szablony` (wersjonowane, append-only) + referencje szablonu na dokumentach wydanych. |
| 9 | Dane pod wzory pism: płeć, numer/dokument/powód odmowy sprawy, dane reprezentanta spółki. |
| 10 | Rodzaj organu spółki, sposób i termin usunięcia przeszkody na sprawach. |
| 11 | Ścieżka pliku i skrót wzoru na dokumentach wydanych — przejście na `.docx`. |
| 12 | `platnik_vat` (trójstanowe) na spółkach — **cofnięte migracją 17**. |
| 13 | Rozszerzony CHECK typu dokumentów (umowa, RODO, uchwała, klauzula zbycia). |
| 14 | Kolejne rozszerzenie CHECK typu (żądanie dokonania wpisu, wzór 04). |
| 15 | AML/PEP: data przeglądu, beneficjent rzeczywisty, oświadczenie PEP i jego data. |
| 16 | `psa_dziennik_dostepu` (append-only log wglądu w dane osobowe). |
| 17 | **Usunięcie `platnik_vat`** — status VAT uznano za niebędący elementem rejestru (art. 300³³ §1 KSH). Nie cytuje żadnej reguły domenowej — patrz sekcja 7, weryfikacja numeracji. |
| 18 | Sposób zawarcia umowy, dane reprezentanta (imię/nazwisko, funkcja, ręczne odmiany) — patrz „deklinacja polska" w sekcji 1. |
| 19 | `data_zawarcia_umowy_spolki` (akt założycielski). |
| 20 | `tresc_postanowienia` na ograniczeniach (treść klauzuli zgody na zbycie). |
| 21 | `psa_zgloszenia` (formularz publiczny zgłoszeń wstępnych). |
| 22 | Rola `wnioskodawca` w `psa_konta` (zaproszenie przed istnieniem spółki). |
| 23 | `rodo_zaakceptowano` na kontach. |
| 24 | `psa_wnioski` (dane spółki/reprezentanta z wniosku portalu). |
| 25 | `psa_wnioski_akcjonariusze` (dane akcjonariusza z wniosku + zgoda elektroniczna). |
| 26 | Ścieżki projektu umowy i podpisanej kopii na wnioskach. |
| 27 | Weryfikacja wniosku: notatka, powiązanie ze spółką, kto/kiedy obsłużył; flaga zweryfikowania na akcjonariuszach wniosku. |
| 28 | `psa_osoby_skany_aml` + `stosuje_procedure_aml` na spółkach (AML konfigurowalny per spółka, domyślnie wyłączony). |
| 29 | `krs` na zgłoszeniach. |
| 30 | `reprezentant_email` na wnioskach. |
| 31 | Art. 300³³ §1 pkt 2-4 KSH: brak PESEL, rodzaj adresu rejestrowego, zgoda e-mail, współwłasność, udział; backfill. |
| 32 | `psa_wnioski_dokumenty` (dokumenty do podpisu przy wniosku). |
| 33 | Przemianowanie kolumny `dokument_rodzaj`→`dokument_rodzaj_v33` na sprawach (przepisanie tabeli, rozszerzony CHECK). |
| 34 | `psa_spolki_dokumenty` (akta spółki) + kolumny podpisu na dokumentach wniosku. |
| 35 | `pep`/`pep_opis` na osobach i akcjonariuszach wniosku. |
| 36 | Treść bloków, modyfikacja, braki, udostępnienie na dokumentach wniosku. |
| 37 | `uwagi_kancelarii` na akcjonariuszach wniosku; potwierdzenie podpisu na dokumentach wniosku. |
| 38 | `sprawdzono`/`sprawdzil` na dokumentach wniosku. |
| 39 | `psa_ustawienia` (metryka kancelarii, stawki — baza nadpisuje `.env`). |
| 40 | Skan dowodu tożsamości reprezentanta na wnioskach. |
| 41 | `psa_konta_spolki` (relacja wiele-do-wielu konto↔spółka) + backfill + usunięcie UNIQUE na `psa_wnioski.konto_id` — jedno konto, wiele spółek/wniosków. |
| 42 | `psa_platnosci` (transakcje tpay) + fakturowanie/okres na opłatach + `oczekuje_na_oplate` na sprawach. |
| 43 | `wydany_dokument_id` na opłatach (opłacona informacja wydaje się raz). |
| 44 | `zamawiajacy_osoba_id` na opłatach (NULL=należność spółki, wypełnione=prywatna należność akcjonariusza). |
| 45 | Unieważnianie sesji: czarna lista tokenów przy wylogowaniu + licznik wersji tokenów przy zmianie hasła (naprawa Z-250/Z-251). |
| 46 | Skrót SHA-256 treści podpisanego skanu w chwili potwierdzenia przez kancelarię — wykrywa podmianę pliku po fakcie (naprawa Z-205). |
| 47 | VAT na opłatach: osobna kolumna stawki, kwoty w bazie zostają netto (naprawa sekcji 2.1 planu VAT). |
| 48 | Unikalność numeru KRS w zgłoszeniach na poziomie bazy (indeks częściowy `WHERE status <> 'odrzucone'`) — koniec wyścigu przy równoczesnym zgłoszeniu (naprawa Z-004). |
| 49 | Status PEP `nieustalono` (trzeci stan obok `tak`/`nie`) na osobach i akcjonariuszach wniosku; `pep_oswiadczenie`/`pep_oswiadczenie_data` także na wniosku (naprawa Z-151/P-010). |
| 50 | `psa_dziennik_dostepu` dostaje wyzwalacze append-only (`BEFORE UPDATE`/`DELETE` → RAISE ABORT), analogicznie do `psa_zdarzenia` (naprawa Z-152/P-009). |
| 51 | Klucz idempotencyjny (`klucz_idempotencji` + indeks unikalny częściowy) przy zakładaniu sprawy — kancelaria i portal (naprawa Z-351/Z-353). |

**Uwaga techniczna:** tabela śledząca wersje (`psa_migracje`) jest tworzona osobno, poza tablicą
`MIGRACJE` — to nie jest migracja nr 44 ani żadna inna pozycja tablicy.

---

## 7. Tabela pokrycia reguł domenowych (§4 `CLAUDE-PSA.md`)

| # | Status | Plik : funkcja | Uzasadnienie |
|---|---|---|---|
| 1 | **TAK** | `migracje.js:216-227` (triggery); `rejestr.js` (jedyny INSERT) | Wyzwalacz DB. Z-300. |
| 2 | **TAK** | `stan.js: odtworzStan()`; `POST /:id/przelicz` | Z-303. |
| 3 | **TAK** | `stan.js: sprawdzBilans()`; `walidacje.js:770-793` | Brak DB CHECK na agregacie (niemożliwe w SQLite) — wyłącznie kod. Z-013, Z-056. |
| 4 | **TAK** | `numery.js: przydzielFifo()`, `ilosc()` | — |
| 4a | **TAK — naprawione** | CHECK: `migracje.js:452-453,595-598`; arytmetyka: `ulamki.js`; głosy: `kontekst-pisma.js: akcjonariuszeKlucze()` (komentarz „Naprawa Z-057") | Bilans działa (Z-056); liczenie głosów teraz poprawnie uwzględnia ułamki. Był: Z-057 (KRYTYCZNY). |
| 4b | **TAK — naprawione** | `stan.js` handler `przedstawiciel`; `kontekst-pisma.js` (Z-057) | `przedstawiciel_osoba_id` czytany przy głosach — ta sama naprawa Z-057. |
| 4c | **TAK — naprawione (blokada); zaliczanie wkładów nadal etykieta** | blokada: `walidacje.js: sprawdzPokrycie()`; przekazanie atrybutu: `stan.js` (komentarz „Naprawa Z-054") — `pokryta` dziedziczy się domyślnie ze stanu źródłowego, obejmuje też zwykłe `przeniesienie`; zaliczanie wkładów: `kreator.js:377-392` nadal etykieta, nie algorytm | Blokada teraz skuteczna przy KAŻDEJ transakcji, nie tylko pierwszej. Był: Z-054 (KRYTYCZNY). |
| 5 | **TAK — naprawione** | `oplaty.js: dodajOplateReczna()` woła `przepisy.walidujKwoteGrosze()` (komentarz „Z-101..Z-104") — integer, brak ujemnych, limit stawki maksymalnej, ta sama walidacja co automat | Kolumny `_grosze` nadal bez CHECK/STRICT w schemacie, ale egzekwowane spójnie w kodzie aplikacji. Były: Z-103, Z-101 (KRYTYCZNE), Z-102 (POWAŻNY). |
| 6 | **TAK** | `rejestr.js:106` | Fallback `\|\|` to teoretyczna, nieużywana furtka; drobne zastrzeżenie co do momentu ustawiania daty otwarcia — Z-019. |
| 7 | **TAK** | `terminy.js:74-138` | Z-358. |
| 8 | **TAK** | `typy-zdarzen.js:234-246`; `rejestr.js:568` | Z-106. |
| 9 | **TAK — naprawione** | `maskowanie.js` (komentarz „Naprawa Z-150") — odpowiedź budowana z BIAŁEJ listy pól per rola (`przepisy.BIALE_LISTY`), nie z listy do usunięcia; `pelnyDostep` już nie omija maskowania, komplet pól wrażliwych ukryty też dla peer-akcjonariusza | Był: **Z-150 (KRYTYCZNY)**, żywy kanał `trasy/portal.js`. |
| 10 | **TAK — naprawione (ostrzeżenie, nie blokada)** | `trasy/osoby.js: ostrzezeniaKolizji()` (Z-350, sesja napraw 2026-09-19) | Kolizja PESEL/NIP z innym rekordem generuje teraz ostrzeżenie; świadomie nie jest twardą blokadą (D-042). Był: Z-350 (POWAŻNY). |
| 11 | **TAK** | `spolki.js:126`, `krs.js:234` → `przepisy.js: ocenFormePrawna()` | Ta sama funkcja przy tworzeniu i edycji. Z-010. Kolumna bez CHECK. |
| 12 | **TAK — naprawione** | `walidacje.js: sprawdzDataWpisuKrsEmisji()` (komentarz „Naprawa Z-012") | Emisja założycielska musi mieć `data_wpisu_krs` równą dacie rejestracji spółki, kolejne — wyłącznie późniejszą; żadna data z przyszłości. Był: Z-012 (KRYTYCZNY). |
| 13 | **NIE — martwa etykieta** | klasyfikacja: `przepisy.js: charakterWpisu()`; zapis: `rejestr.js:541-549` | Etykieta zapisywana, treść checklisty/zawiadomień identyczna niezależnie od wartości. Potwierdzone też README odstępstwo 27 (D-027). Dopasowanie tytułu prawnego przez `.includes()` na wolnym tekście — kruche. |
| 14 | **TAK** (fakt braku obsługi płatności/dywidend) | brak wyników grep w modułach płatności | Patrz niżej — rozjazd numeracji dot. migracji 17 jest w `RAPORT.md`, nie w kodzie. |

### Weryfikacja numeracji reguł domenowych (grep pełnego `server/`)

Pełny grep „reguła domenowa"/„regula nr" w `server/` dał 47 trafień w 17 plikach. **Każde numerowane
odwołanie (1, 2, 3, 4, 4a, 4b, 5, 6, 7, 9, 10, 11, 12, 13) zgadza się treściowo z odpowiednią regułą
w `CLAUDE-PSA.md` §4.** Numer 14 nie występuje NIGDZIE w `server/`.

**Do podejrzenia o migrację 17 (usunięcie VAT):** komentarz `migracje.js:966-977` uzasadnia decyzję
wyłącznie art. 300³³ §1 KSH — **nie cytuje żadnej reguły domenowej**. Zdanie „usunięte zgodnie z
regułą domenową 14" pochodzi **wyłącznie z `testy-audyt/RAPORT.md` §5** (własna glosa interpretacyjna
raportu audytowego, nie coś, co mówi kod). Sam fakt (brak VAT/dywidend w module) jest prawdziwy i
zgodny z regułą 14, ale przypisanie go migracji 17 jest błędnym skojarzeniem dwóch niepowiązanych
faktów — **podejrzewany rozjazd numeracji nie istnieje w kodzie źródłowym**.

Dodatkowo: `oplaty.js:107` i `portal.js:450` używają frazy „reguła domenowa" dla nienumerowanych,
wewnętrznych konwencji (nie odpowiadają żadnej z 14 reguł). `przepisy.js:555` cytuje „regułę 4" jako
uzasadnienie, że `tytul_prawny` jest wolnym tekstem — treściowo słabe powiązanie (reguła 4 dotyczy
przydziału numerów akcji, nie formatu tego pola).

---

## 8. Rozbieżności wobec `CLAUDE-PSA.md`

### Podsystemy całkowicie nieopisane w specyfikacji

Zweryfikowane grepem nazw tabel/tematów po `CLAUDE-PSA.md` → zero trafień dla wszystkich sześciu.

| Podsystem | Tabele/pliki | Status w `CLAUDE-PSA.md` |
|---|---|---|
| Wnioski portalowe | `psa_wnioski*` | Nieopisany — §8 wspomina generyczne `portal/zadania`, nie oddaje realnej złożoności (Z-005, Z-205). |
| Zgłoszenia wstępne | `psa_zgloszenia` | Nieopisany — pierwszy publiczny endpoint całej ścieżki (Z-003, Z-004). |
| Płatności online tpay | `psa_platnosci` | Nieopisany — webhook ITN, CRC, podpis JWS. |
| Skany AML | `psa_osoby_skany_aml` | Nieopisany — moduł AML przełączany per spółka, skany z hashem i retencją. |
| Dziennik dostępu | `psa_dziennik_dostepu` | Nieopisany. Był celowo wąski zakres (Z-152) — naprawiony, teraz append-only i obejmuje też odczyty portalu (D-041). Specyfikacja nadal nie wspomina samego istnienia podsystemu. |
| Deklinacja polska | `logika/deklinacja.js` (nieistniejący), kolumny `*_recznie` | Nieopisany — automat porzucony na rzecz mianownika z etykietą. |

### Rozbieżności punktowe

1. **Reguła 4c** — **ZAMKNIĘTE.** Tekst: „zbycie akcji nie w pełni pokrytej wymaga zgody spółki —
   reguła blokująca". Było: skuteczna wyłącznie przy pierwszej transakcji (Z-054); naprawione —
   `pokryta` dziedziczy się przez KAŻDĄ transakcję (patrz §4 niezmiennik #9/#10).
2. **Reguła 4a** — **ZAMKNIĘTE.** Było: liczenie głosów ignorowało ułamki (Z-057); naprawione w
   `kontekst-pisma.js` (patrz §4 niezmiennik #11, §7 wiersz 4a/4b).
3. **Reguła 9** — **ZAMKNIĘTE.** Było: `pelnyDostep` omijał maskowanie AML/PEP/beneficjenta dla
   spółki/organu (Z-150); naprawione — biała lista pól per rola (patrz §4 niezmiennik #14/14b).
4. **Reguła 10** — **ZAMKNIĘTE (jako ostrzeżenie, świadomie nie jako blokada).** Było: zero
   deduplikacji (Z-350); dodano ostrzeżenie przy kolizji PESEL/NIP — twarda blokada świadomie
   odrzucona, bo ta sama osoba legalnie występuje w wielu spółkach (D-042).
5. **Reguła 13** — **NADAL OTWARTE.** Jedyny przypadek, gdzie dryf JEST udokumentowany: README
   odstępstwo 27 (D-027) wprost nazywa brak osobnej treści zawiadomienia „świadomie odłożonym
   krokiem" — pytanie, czy `charakter_wpisu` dostanie własną treść, pozostaje bez odpowiedzi
   Łukasza (patrz pytania końcowe sesji napraw, 2026-09-19).
6. **§11 „Integralność"** — **NADAL OTWARTE.** Tekst sugeruje wywołanie nocne; w kodzie brak
   harmonogramu dla WERYFIKACJI ŁAŃCUCHA (`GET /api/psa/integralnosc` istnieje wyłącznie on-demand).
   Nie mylić z Z-357 (przypomnienia o odnowieniu rejestru), który dostał wyzwalacz w tej sesji
   (D-042) — to inny, nienaprawiony jeszcze mechanizm.
7. **§9 kreator** — **ZAMKNIĘTE.** Było: odhaczenie checklisty to wyłącznie stan UI, serwer nigdy go
   nie walidował (Z-201); naprawione — `POST /:id/otworz-rejestr` odrzuca otwarcie bez kompletnej
   checklisty 10 pozycji (D-040).
8. **Reguła 4a** (zaokrąglanie) — **ZAMKNIĘTE.** Było: „Wykaz akcjonariuszy" i `stan.csv` bez
   zaokrąglenia procentu (Z-051); naprawione w `dokumenty-tresc.js`/`spolki.js`.
9. **Reguła 12** — **ZAMKNIĘTE.** Było: sprawdzenie samej obecności pola, zero walidacji krzyżowej
   z datą rejestracji spółki (Z-012); naprawione — patrz §4 niezmiennik #5b, §7 wiersz 12.
10. **§11 „nie logujemy danych osobowych"** — **CZĘŚCIOWO ZAMKNIĘTE.** Prawdziwe dla logów serwera
    (Z-261). Dziennik dostępu miał świadomie wąski zakres, przez co wyciek z Z-150 był
    niewykrywalny post factum (Z-152) — naprawione: odczyt danych wrażliwych przez portal zostawia
    teraz ślad (D-041). Specyfikacja `CLAUDE-PSA.md` nadal nie WSPOMINA istnienia dziennika dostępu
    jako podsystemu — to pozostaje rozbieżnością dokumentacyjną, nie funkcjonalną.

Pełne opisy znalezisk cytowanych powyżej: `testy-audyt/ZNALEZISKA.md`. Rejestr decyzji projektowych
(w tym te, które adresują część powyższych rozbieżności): `DECYZJE.md`.
