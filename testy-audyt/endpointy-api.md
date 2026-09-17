# Pełna lista endpointów HTTP — server/trasy/*.js

> Zebrane przez subagenta (audyt FAZA 0), zweryfikowane przeglądem plik:linia. 94 endpointy w 14
> plikach routingu; `krs.js` to moduł logiki, nie router (0 endpointów).

## Model autoryzacji

Dwie niezależne sesje ciasteczkowe (HMAC-podpisany token, `logika/sesja.js`):
- `psa_sesja` (pracownik, `psa_uzytkownicy`) → `zad.uzytkownik`
- `psa_sesja_portal` (klient, `psa_konta`) → `zad.konto`

Middleware z `autoryzacja.js`: `wczytajSesje` (globalnie w `serwer.js`, nigdy nie blokuje — tylko
wypełnia `zad.uzytkownik`/`zad.konto`), `wymagajPracownika` (401 bez zalogowanego pracownika),
`wymagajAdmina` (401/403, rola `admin`), `wymagajKonta` (401 bez zalogowanego konta portalu).

| Prefiks montowania | Gate na poziomie `app.use(...)` |
|---|---|
| `/api/wspolne` | brak — publiczny |
| `/api/psa/auth` | brak — gate per-trasa wewnątrz `auth.js` |
| `/api/psa/platnosci` | brak — webhook operatora, celowo przed bramkami sesji |
| `/api/psa/portal` | brak na poziomie mountu (przełącznik `PORTAL_WLACZONY`, inaczej 503); gate `wymagajKonta` wewnątrz `portal.js` (linia 361) |
| `/api/psa/spolki`, `/osoby`, `/sprawy`, `/zdarzenia`, `/oplaty`, `/szablony`, `/zgloszenia`, `/wnioski`, `/zawiadomienia` | `wymagajPracownika` jako argument `app.use(...)` — obejmuje wszystkie trasy pliku |
| `/api/psa` (reszta → `pozostale.js`) | brak — każda trasa musi sama dodać `wymagajPracownika`; jedna tego nie robi |

## Tabela endpointów

| Plik | Metoda i ścieżka | Plik:linia | Middleware / sprawdzenie uprawnień | Przeznaczenie |
|---|---|---|---|---|
| **auth.js** *(mount `/api/psa/auth` bez gate)* | POST `/api/psa/auth/login` | auth.js:40 | brak (publiczny) | Kancelaria |
| | POST `/api/psa/auth/logout` | auth.js:69 | brak | Kancelaria |
| | GET `/api/psa/auth/whoami` | auth.js:78 | brak (zawsze 200) | Kancelaria |
| | POST `/api/psa/auth/zmiana-hasla` | auth.js:85 | `wymagajPracownika` | Kancelaria |
| | GET `/api/psa/auth/uzytkownicy` | auth.js:108 | `wymagajAdmina` | Kancelaria (admin) |
| | POST `/api/psa/auth/uzytkownicy` | auth.js:117 | `wymagajAdmina` | Kancelaria (admin) |
| | PATCH `/api/psa/auth/uzytkownicy/:id` | auth.js:157 | `wymagajAdmina` | Kancelaria (admin) |
| | POST `/api/psa/auth/uzytkownicy/:id/reset-hasla` | auth.js:186 | `wymagajAdmina` | Kancelaria (admin) |
| **krs.js** | *(brak endpointów — moduł pomocniczy `pobierzZKrs`/`zmapuj`, używany przez spolki.js/wnioski.js/portal.js)* | — | — | — |
| **oplaty.js** *(mount + wymagajPracownika, serwer.js:100)* | GET `/api/psa/oplaty/wg-spolek` | oplaty.js:32 | mount | Kancelaria |
| | PATCH `/api/psa/oplaty/:id/faktura` | oplaty.js:107 | mount | Kancelaria |
| | POST `/api/psa/oplaty/platnosci/:id/sprawdz` | oplaty.js:151 | mount | Kancelaria |
| | POST `/api/psa/oplaty/przypomnienia` | oplaty.js:169 | mount | Kancelaria |
| | POST `/api/psa/oplaty/odnowienia` | oplaty.js:188 | mount + `wymagajAdmina` | Kancelaria (admin) |
| | GET `/api/psa/oplaty/` | oplaty.js:208 | mount | Kancelaria |
| | GET `/api/psa/oplaty/eksport` | oplaty.js:251 | mount | Kancelaria |
| | POST `/api/psa/oplaty/` | oplaty.js:302 | mount | Kancelaria |
| | PATCH `/api/psa/oplaty/:id` | oplaty.js:333 | mount | Kancelaria |
| | POST `/api/psa/oplaty/naliczenie-roczne` | oplaty.js:348 | mount + `wymagajAdmina` | Kancelaria (admin) |
| **osoby.js** *(mount + wymagajPracownika, serwer.js:97)* | GET `/api/psa/osoby/` | osoby.js:177 | mount | Kancelaria |
| | POST `/api/psa/osoby/` | osoby.js:217 | mount | Kancelaria |
| | GET `/api/psa/osoby/:id` | osoby.js:248 | mount | Kancelaria |
| | PUT `/api/psa/osoby/:id` | osoby.js:257 | mount | Kancelaria |
| | GET `/api/psa/osoby/:id/spolki` | osoby.js:290 | mount | Kancelaria |
| | GET `/api/psa/osoby/:id/aml-skany` | osoby.js:365 | mount | Kancelaria |
| | POST `/api/psa/osoby/:id/aml-skany` | osoby.js:385 | mount + multer + `wymagajProceduryAml` | Kancelaria |
| | GET `/api/psa/osoby/:id/aml-skany/:skanId/plik` | osoby.js:432 | mount | Kancelaria |
| **platnosci.js** *(mount bez gate — webhook)* | POST `/api/psa/platnosci/tpay/itn` | platnosci.js:51 | brak Express; suma kontrolna + podpis JWS + IP w handlerze | Zewnętrzny (tpay) |
| **portal.js** *(mount warunkowy PORTAL_WLACZONY)* | POST `/api/psa/portal/login` | portal.js:142 | brak (przed router.use) | Portal (publiczny) |
| | POST `/api/psa/portal/logout` | portal.js:166 | brak | Portal |
| | GET `/api/psa/portal/whoami` | portal.js:174 | brak | Portal |
| | POST `/api/psa/portal/zgloszenia` | portal.js:189 | brak — w pełni publiczny | Portal (przed kontem) |
| | GET `/api/psa/portal/aktywacja/:token` | portal.js:326 | brak (token w URL) | Portal (aktywacja) |
| | POST `/api/psa/portal/aktywacja/:token` | portal.js:335 | brak (token w URL) | Portal (aktywacja) |
| | *(od linii 361: `router.use(wymagajKonta)`; od 386: `router.param('spolkaId', ...)`; od 403: `router.use(wymagajDostepuDoSpolkiWCiele)`)* | | | |
| | POST `/api/psa/portal/rodo` | portal.js:411 | wymagajKonta | Portal |
| | GET `/api/psa/portal/wniosek` | portal.js:489 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | PUT `/api/psa/portal/wniosek` | portal.js:497 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | GET `/api/psa/portal/wniosek/z-krs/:numer` | portal.js:521 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | GET `/api/psa/portal/wniosek/akcjonariusze` | portal.js:606 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | POST `/api/psa/portal/wniosek/akcjonariusze` | portal.js:619 | + wymagajWniosku | Portal |
| | PUT `/api/psa/portal/wniosek/akcjonariusze/:id` | portal.js:642 | + wymagajWniosku | Portal |
| | DELETE `/api/psa/portal/wniosek/akcjonariusze/:id` | portal.js:664 | + wymagajWniosku | Portal |
| | POST `/api/psa/portal/wniosek/zloz` | portal.js:701 | + wymagajWniosku | Portal |
| | GET `/api/psa/portal/wniosek/dokumenty` | portal.js:758 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | GET `/api/psa/portal/wniosek/dokumenty/:id` | portal.js:768 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | GET `/api/psa/portal/wniosek/umowa-projekt` | portal.js:782 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | POST `/api/psa/portal/wniosek/odeslij` | portal.js:928 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | POST `/api/psa/portal/wniosek/dowod` | portal.js:989 | + zaladujWniosekDoEdycji + multer | Portal |
| | DELETE `/api/psa/portal/wniosek/dowod` | portal.js:1022 | + zaladujWniosekDoEdycji | Portal |
| | GET `/api/psa/portal/wniosek/dowod` | portal.js:1045 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | POST `/api/psa/portal/wniosek/dokumenty/:id/podpis` | portal.js:1056 | + zaladujWlasnyWniosekDoUploadu + multer | Portal |
| | GET `/api/psa/portal/wniosek/dokumenty/:id/podpis` | portal.js:1080 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | DELETE `/api/psa/portal/wniosek/dokumenty/:id/podpis` | portal.js:1099 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | POST `/api/psa/portal/wniosek/umowa-podpisana` | portal.js:1148 | + zaladujWlasnyWniosekDoUploadu + multer (legacy) | Portal |
| | GET `/api/psa/portal/wniosek/umowa-podpisana` | portal.js:1168 | wymagajKonta + wymagajWnioskodawcy | Portal |
| | GET `/api/psa/portal/moje` | portal.js:1189 | wymagajKonta | Portal (wszystkie role) |
| | GET `/api/psa/portal/rejestr/:spolkaId` | portal.js:1267 | wymagajKonta + router.param('spolkaId') | Portal |
| | GET `/api/psa/portal/zadania` | portal.js:1305 | wymagajKonta | Portal |
| | POST `/api/psa/portal/zadania` | portal.js:1351 | wymagajKonta + wymagajDostepuDoSpolkiWCiele | Portal |
| | POST `/api/psa/portal/zadania/:id/dokumenty` | portal.js:1517 | + zaladujWlasnaSprawe + multer | Portal |
| | GET `/api/psa/portal/cennik` | portal.js:1597 | wymagajKonta | Portal |
| | GET `/api/psa/portal/oplaty` | portal.js:1612 | wymagajKonta | Portal |
| | POST `/api/psa/portal/oplaty/:id/zaplac` | portal.js:1658 | wymagajKonta | Portal |
| | POST `/api/psa/portal/informacja/zamow` | portal.js:1701 | + wymagajDostepuDoSpolkiWCiele | Portal |
| | POST `/api/psa/portal/informacja/:oplataId/wydaj` | portal.js:1778 | wymagajKonta | Portal |
| | GET `/api/psa/portal/informacja/:id` | portal.js:1854 | wymagajKonta (+ kontrola własności w handlerze) | Portal |
| **pozostale.js** *(mount bez gate)* | GET `/api/psa/ustawienia` | pozostale.js:32 | `wymagajPracownika` | Kancelaria |
| | PUT `/api/psa/ustawienia` | pozostale.js:40 | `wymagajPracownika` | Kancelaria |
| | **GET `/api/psa/meta`** | pozostale.js:68 | **brak jakiegokolwiek middleware** | **Publiczny — znalezisko** |
| | GET `/api/psa/liczniki` | pozostale.js:112 | `wymagajPracownika` | Kancelaria |
| | GET `/api/psa/pulpit` | pozostale.js:142 | `wymagajPracownika` | Kancelaria |
| | GET `/api/psa/integralnosc` | pozostale.js:227 | `wymagajPracownika` | Kancelaria |
| | POST `/api/psa/sad/zapytania` | pozostale.js:265 | `wymagajPracownika` | Kancelaria |
| | POST `/api/psa/sad/zawiadomienie-o-rozwiazaniu` | pozostale.js:312 | `wymagajPracownika` | Kancelaria |
| **spolki.js** *(mount + wymagajPracownika, serwer.js:96)* | GET `/api/psa/spolki/` | spolki.js:139 | mount | Kancelaria |
| | GET `/api/psa/spolki/z-krs/:numer` | spolki.js:180 | mount | Kancelaria |
| | POST `/api/psa/spolki/` | spolki.js:196 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/umowa-zalacznik` | spolki.js:253 | mount + multer | Kancelaria |
| | GET `/api/psa/spolki/:id/umowa-zalacznik` | spolki.js:279 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id` | spolki.js:308 | mount | Kancelaria |
| | PUT `/api/psa/spolki/:id` | spolki.js:329 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/stan.csv` | spolki.js:397 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/stan` | spolki.js:472 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/informacja.html` | spolki.js:507 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/zdarzenia` | spolki.js:547 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/zdarzenia/podglad` | spolki.js:557 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/zdarzenia` | spolki.js:606 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/otworz-rejestr` | spolki.js:650 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/przelicz` | spolki.js:685 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/dokumenty/wystaw` | spolki.js:786 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/dokumenty/:kod/podglad` | spolki.js:798 | mount | Kancelaria |
| | POST `/api/psa/spolki/:id/dokumenty/:kod` | spolki.js:817 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/dokumenty-zalozycielskie` | spolki.js:868 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/dokumenty-zalozycielskie/:dokId` | spolki.js:883 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/akta` | spolki.js:918 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/wydane` | spolki.js:1012 | mount | Kancelaria |
| | GET `/api/psa/spolki/:id/wydane/:wydanyId/plik` | spolki.js:1028 | mount | Kancelaria |
| **sprawy.js** *(mount + wymagajPracownika, serwer.js:98)* | GET `/api/psa/sprawy/` | sprawy.js:79 | mount | Kancelaria |
| | POST `/api/psa/sprawy/` | sprawy.js:125 | mount | Kancelaria |
| | GET `/api/psa/sprawy/:id` | sprawy.js:240 | mount | Kancelaria |
| | POST `/api/psa/sprawy/:id/podglad` | sprawy.js:276 | mount | Kancelaria |
| | POST `/api/psa/sprawy/:id/wpisz` | sprawy.js:320 | mount | Kancelaria |
| | PATCH `/api/psa/sprawy/:id` | sprawy.js:363 | mount; akcje wg `body.akcja` w handlerze | Kancelaria |
| | POST `/api/psa/sprawy/:id/zgoda` | sprawy.js:580 | mount | Kancelaria |
| | POST `/api/psa/sprawy/:id/powiadomienie` | sprawy.js:596 | mount | Kancelaria |
| | POST `/api/psa/sprawy/:id/dokumenty` | sprawy.js:673 | mount + zaladujSprawe + multer | Kancelaria |
| | GET `/api/psa/sprawy/:id/dokumenty/wystaw` | sprawy.js:747 | mount (rejestr. przed `:dokumentId`) | Kancelaria |
| | POST `/api/psa/sprawy/:id/dokumenty/:kod/podglad` | sprawy.js:757 | mount | Kancelaria |
| | POST `/api/psa/sprawy/:id/dokumenty/:kod` | sprawy.js:776 | mount | Kancelaria |
| | GET `/api/psa/sprawy/:id/dokumenty/:dokumentId` | sprawy.js:830 | mount | Kancelaria |
| | GET `/api/psa/sprawy/:id/wydane/:wydanyId` | sprawy.js:857 | mount | Kancelaria |
| | GET `/api/psa/sprawy/:id/wydane/:wydanyId/plik` | sprawy.js:871 | mount | Kancelaria |
| **szablony.js** *(mount + wymagajPracownika; KAŻDA trasa też wymagajAdmina)* | GET `/api/psa/szablony/` | szablony.js:40 | mount + wymagajAdmina | Kancelaria (admin) |
| | GET `/api/psa/szablony/dostepne-klucze` | szablony.js:58 | mount + wymagajAdmina | Kancelaria (admin) |
| | GET `/api/psa/szablony/:kod` | szablony.js:74 | mount + wymagajAdmina | Kancelaria (admin) |
| | POST `/api/psa/szablony/:kod/podglad` | szablony.js:88 | mount + wymagajAdmina | Kancelaria (admin) |
| | GET `/api/psa/szablony/:kod/podglad.docx` | szablony.js:106 | mount + wymagajAdmina | Kancelaria (admin) |
| **wnioski.js** *(mount + wymagajPracownika, serwer.js:103)* | GET `/api/psa/wnioski/` | wnioski.js:133 | mount | Kancelaria |
| | GET `/api/psa/wnioski/:id` | wnioski.js:156 | mount | Kancelaria |
| | GET `/api/psa/wnioski/:id/dowod` | wnioski.js:193 | mount | Kancelaria |
| | GET `/api/psa/wnioski/:id/dokumenty/:dokId` | wnioski.js:218 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/dokumenty/wystaw` | wnioski.js:260 | mount | Kancelaria |
| | GET `/api/psa/wnioski/:id/dokumenty/:dokId/tresc` | wnioski.js:293 | mount | Kancelaria |
| | PUT `/api/psa/wnioski/:id/dokumenty/:dokId/tresc` | wnioski.js:309 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/dokumenty/:dokId/podpis-potwierdz` | wnioski.js:333 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/dokumenty/udostepnij` | wnioski.js:353 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/z-krs` | wnioski.js:400 | mount | Kancelaria |
| | PUT `/api/psa/wnioski/:id` | wnioski.js:464 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/akcjonariusze` | wnioski.js:489 | mount | Kancelaria |
| | PUT `/api/psa/wnioski/:id/akcjonariusze/:akcId` | wnioski.js:511 | mount | Kancelaria |
| | DELETE `/api/psa/wnioski/:id/akcjonariusze/:akcId` | wnioski.js:532 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/akcjonariusze/:akcId/zweryfikuj` | wnioski.js:549 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/akcjonariusze/:akcId/do-poprawy` | wnioski.js:587 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/do-uzupelnienia` | wnioski.js:641 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/odrzuc` | wnioski.js:660 | mount | Kancelaria |
| | POST `/api/psa/wnioski/:id/przyjmij` | wnioski.js:687 | mount | Kancelaria |
| **wspolne.js** *(mount bez gate)* | GET `/api/wspolne/kancelaria` | wspolne.js:20 | brak | Publiczny (nagłówek kancelarii) |
| **zawiadomienia.js** *(mount + wymagajPracownika)* | GET `/api/psa/zawiadomienia/` | zawiadomienia.js:53 | mount | Kancelaria |
| | POST `/api/psa/zawiadomienia/wyslij` | zawiadomienia.js:89 | mount | Kancelaria |
| **zdarzenia.js** *(mount + wymagajPracownika)* | GET `/api/psa/zdarzenia/:id` | zdarzenia.js:22 | mount | Kancelaria |
| | POST `/api/psa/zdarzenia/:id/sprostuj` | zdarzenia.js:53 | mount | Kancelaria |
| **zgloszenia.js** *(mount + wymagajPracownika)* | GET `/api/psa/zgloszenia/` | zgloszenia.js:25 | mount | Kancelaria |
| | GET `/api/psa/zgloszenia/:id` | zgloszenia.js:42 | mount | Kancelaria |
| | POST `/api/psa/zgloszenia/:id/odrzuc` | zgloszenia.js:51 | mount | Kancelaria |
| | POST `/api/psa/zgloszenia/:id/zapros` | zgloszenia.js:74 | mount | Kancelaria |

## Uwagi dodatkowe

1. Brak zakomentowanych/martwych tras (grep po `//\s*router\.(get|post|...)` — pusty wynik).
2. `krs.js` nie jest routerem — mimo nazwy, nie zawiera `express.Router()` i nie jest montowany
   w `serwer.js`. Czysty moduł logiki reużywany przez 3 inne pliki tras.
3. **`GET /api/psa/meta` jest w pełni publiczny** — jedyna trasa w `pozostale.js` bez
   `wymagajPracownika`, mimo że plik wymaga dodania go per-trasa. Ujawnia słowniki/stawki/typy
   zdarzeń bez logowania. Najważniejszy wynik tego audytu endpointów — do weryfikacji w FAZA 5.
4. `POST /api/psa/platnosci/tpay/itn` celowo przed globalnymi bramkami sesji — bezpieczeństwo
   oparte o sumę kontrolną + podpis JWS sprawdzane ręcznie w handlerze.
5. `portal.js` — trzypoziomowy mechanizm autoryzacji w jednym pliku (opisany w kodzie, linie
   363-384): `router.use(wymagajKonta)` od połowy pliku, `router.param('spolkaId', ...)`,
   `router.use(wymagajDostepuDoSpolkiWCiele)`.
6. Cały `/api/psa/portal` zwraca 503 gdy `PORTAL_WLACZONY=false`.
7. Kolejność rejestracji ma znaczenie w `sprawy.js` — `/:id/dokumenty/wystaw` zarejestrowana
   przed ogólnym `/:id/dokumenty/:dokumentId`, żeby Express nie dopasował "wystaw" jako ID.
8. `osoby.js POST /:id/aml-skany` — `wymagajProceduryAml` owinięty w funkcję czyszczącą już
   wgrany przez multer plik przy odmowie.
