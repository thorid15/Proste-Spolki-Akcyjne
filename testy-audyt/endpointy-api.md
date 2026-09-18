# Endpointy API — wygenerowane automatycznie

> Wygenerowane przez `narzedzia/dokumentacja-endpointy.js` (introspekcja żywych routerów Express, nie lektura kodu) — `npm run dokumentacja`. Kolejność wierszy odzwierciedla kolejność rejestracji w pliku źródłowym; wiersz „router.use(X)” oznacza bramkę/middleware obejmujące wszystkie trasy PONIŻEJ niego w tym samym pliku.

## `server/trasy/wspolne.js` → mount `/api/wspolne` (bez bramki na poziomie mountu)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/wspolne/kancelaria` | — |

## `server/trasy/auth.js` → mount `/api/psa/auth` (bez bramki na poziomie mountu)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `POST /api/psa/auth/login` | — |
| 2 | `POST /api/psa/auth/logout` | — |
| 3 | `GET /api/psa/auth/whoami` | — |
| 4 | `POST /api/psa/auth/zmiana-hasla` | wymagajPracownika |
| 5 | `GET /api/psa/auth/uzytkownicy` | wymagajAdmina |
| 6 | `POST /api/psa/auth/uzytkownicy` | wymagajAdmina |
| 7 | `PATCH /api/psa/auth/uzytkownicy/:id` | wymagajAdmina |
| 8 | `POST /api/psa/auth/uzytkownicy/:id/reset-hasla` | wymagajAdmina |

## `server/trasy/platnosci.js` → mount `/api/psa/platnosci` (bez bramki na poziomie mountu)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `POST /api/psa/platnosci/tpay/itn` | urlencodedParser |

## `server/trasy/portal.js` → mount `/api/psa/portal` ((warunkowe: PORTAL_WLACZONY, inaczej 503 na całej ścieżce))

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `POST /api/psa/portal/login` | — |
| 2 | `POST /api/psa/portal/logout` | — |
| 3 | `GET /api/psa/portal/whoami` | — |
| 4 | `POST /api/psa/portal/zgloszenia` | — |
| 5 | `GET /api/psa/portal/aktywacja/:token` | — |
| 6 | `POST /api/psa/portal/aktywacja/:token` | — |
| | **router.use(`wymagajKonta`)** — od tego miejsca w dół | — |
| | **router.use(`wymagajDostepuDoSpolkiWCiele`)** — od tego miejsca w dół | — |
| 7 | `POST /api/psa/portal/rodo` | — |
| 8 | `GET /api/psa/portal/wniosek` | wymagajWnioskodawcy |
| 9 | `PUT /api/psa/portal/wniosek` | wymagajWnioskodawcy |
| 10 | `GET /api/psa/portal/wniosek/z-krs/:numer` | wymagajWnioskodawcy |
| 11 | `GET /api/psa/portal/wniosek/akcjonariusze` | wymagajWnioskodawcy |
| 12 | `POST /api/psa/portal/wniosek/akcjonariusze` | wymagajWnioskodawcy, wymagajWniosku |
| 13 | `PUT /api/psa/portal/wniosek/akcjonariusze/:id` | wymagajWnioskodawcy, wymagajWniosku |
| 14 | `DELETE /api/psa/portal/wniosek/akcjonariusze/:id` | wymagajWnioskodawcy, wymagajWniosku |
| 15 | `POST /api/psa/portal/wniosek/zloz` | wymagajWnioskodawcy, wymagajWniosku |
| 16 | `GET /api/psa/portal/wniosek/dokumenty` | wymagajWnioskodawcy |
| 17 | `GET /api/psa/portal/wniosek/dokumenty/:id` | wymagajWnioskodawcy |
| 18 | `GET /api/psa/portal/wniosek/umowa-projekt` | wymagajWnioskodawcy |
| 19 | `POST /api/psa/portal/wniosek/odeslij` | wymagajWnioskodawcy |
| 20 | `POST /api/psa/portal/wniosek/dowod` | wymagajWnioskodawcy, zaladujWniosekDoEdycji, przyjmijSkan |
| 21 | `DELETE /api/psa/portal/wniosek/dowod` | wymagajWnioskodawcy, zaladujWniosekDoEdycji |
| 22 | `GET /api/psa/portal/wniosek/dowod` | wymagajWnioskodawcy |
| 23 | `POST /api/psa/portal/wniosek/dokumenty/:id/podpis` | wymagajWnioskodawcy, zaladujWlasnyWniosekDoUploadu, przyjmijSkan |
| 24 | `GET /api/psa/portal/wniosek/dokumenty/:id/podpis` | wymagajWnioskodawcy |
| 25 | `DELETE /api/psa/portal/wniosek/dokumenty/:id/podpis` | wymagajWnioskodawcy |
| 26 | `POST /api/psa/portal/wniosek/umowa-podpisana` | wymagajWnioskodawcy, zaladujWlasnyWniosekDoUploadu, przyjmijSkan |
| 27 | `GET /api/psa/portal/wniosek/umowa-podpisana` | wymagajWnioskodawcy |
| 28 | `GET /api/psa/portal/moje` | — |
| 29 | `GET /api/psa/portal/rejestr/:spolkaId` | — |
| 30 | `GET /api/psa/portal/zadania` | — |
| 31 | `POST /api/psa/portal/zadania` | — |
| 32 | `POST /api/psa/portal/zadania/:id/dokumenty` | zaladujWlasnaSprawe, <anonymous> |
| 33 | `GET /api/psa/portal/cennik` | — |
| 34 | `GET /api/psa/portal/oplaty` | — |
| 35 | `POST /api/psa/portal/oplaty/:id/zaplac` | — |
| 36 | `POST /api/psa/portal/informacja/zamow` | — |
| 37 | `POST /api/psa/portal/informacja/:oplataId/wydaj` | — |
| 38 | `GET /api/psa/portal/informacja/:id` | — |

## `server/trasy/spolki.js` → mount `/api/psa/spolki` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/spolki` | — |
| 2 | `GET /api/psa/spolki/z-krs/:numer` | — |
| 3 | `POST /api/psa/spolki` | — |
| 4 | `POST /api/psa/spolki/:id/umowa-zalacznik` | <anonymous> |
| 5 | `GET /api/psa/spolki/:id/umowa-zalacznik` | — |
| 6 | `GET /api/psa/spolki/:id` | — |
| 7 | `PUT /api/psa/spolki/:id` | — |
| 8 | `GET /api/psa/spolki/:id/stan.csv` | — |
| 9 | `GET /api/psa/spolki/:id/stan` | — |
| 10 | `GET /api/psa/spolki/:id/informacja.html` | — |
| 11 | `GET /api/psa/spolki/:id/zdarzenia` | — |
| 12 | `POST /api/psa/spolki/:id/zdarzenia/podglad` | — |
| 13 | `POST /api/psa/spolki/:id/zdarzenia` | — |
| 14 | `POST /api/psa/spolki/:id/otworz-rejestr` | — |
| 15 | `POST /api/psa/spolki/:id/przelicz` | — |
| 16 | `GET /api/psa/spolki/:id/dokumenty/wystaw` | — |
| 17 | `POST /api/psa/spolki/:id/dokumenty/:kod/podglad` | — |
| 18 | `POST /api/psa/spolki/:id/dokumenty/:kod` | — |
| 19 | `GET /api/psa/spolki/:id/dokumenty-zalozycielskie` | — |
| 20 | `GET /api/psa/spolki/:id/dokumenty-zalozycielskie/:dokId` | — |
| 21 | `GET /api/psa/spolki/:id/akta` | — |
| 22 | `GET /api/psa/spolki/:id/wydane` | — |
| 23 | `GET /api/psa/spolki/:id/wydane/:wydanyId/plik` | — |

## `server/trasy/osoby.js` → mount `/api/psa/osoby` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/osoby` | — |
| 2 | `POST /api/psa/osoby` | — |
| 3 | `GET /api/psa/osoby/:id` | — |
| 4 | `PUT /api/psa/osoby/:id` | — |
| 5 | `GET /api/psa/osoby/:id/spolki` | — |
| 6 | `GET /api/psa/osoby/:id/aml-skany` | — |
| 7 | `POST /api/psa/osoby/:id/aml-skany` | <anonymous>, <anonymous> |
| 8 | `GET /api/psa/osoby/:id/aml-skany/:skanId/plik` | — |

## `server/trasy/sprawy.js` → mount `/api/psa/sprawy` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/sprawy` | — |
| 2 | `POST /api/psa/sprawy` | — |
| 3 | `GET /api/psa/sprawy/:id` | — |
| 4 | `POST /api/psa/sprawy/:id/podglad` | — |
| 5 | `POST /api/psa/sprawy/:id/wpisz` | — |
| 6 | `PATCH /api/psa/sprawy/:id` | — |
| 7 | `POST /api/psa/sprawy/:id/zgoda` | — |
| 8 | `POST /api/psa/sprawy/:id/powiadomienie` | — |
| 9 | `POST /api/psa/sprawy/:id/dokumenty` | zaladujSprawe, <anonymous> |
| 10 | `GET /api/psa/sprawy/:id/dokumenty/wystaw` | — |
| 11 | `POST /api/psa/sprawy/:id/dokumenty/:kod/podglad` | — |
| 12 | `POST /api/psa/sprawy/:id/dokumenty/:kod` | — |
| 13 | `GET /api/psa/sprawy/:id/dokumenty/:dokumentId` | — |
| 14 | `GET /api/psa/sprawy/:id/wydane/:wydanyId` | — |
| 15 | `GET /api/psa/sprawy/:id/wydane/:wydanyId/plik` | — |

## `server/trasy/zdarzenia.js` → mount `/api/psa/zdarzenia` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/zdarzenia/:id` | — |
| 2 | `POST /api/psa/zdarzenia/:id/sprostuj` | — |

## `server/trasy/oplaty.js` → mount `/api/psa/oplaty` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/oplaty/wg-spolek` | — |
| 2 | `PATCH /api/psa/oplaty/:id/faktura` | — |
| 3 | `POST /api/psa/oplaty/platnosci/:id/sprawdz` | — |
| 4 | `POST /api/psa/oplaty/przypomnienia` | — |
| 5 | `POST /api/psa/oplaty/odnowienia` | wymagajAdmina |
| 6 | `GET /api/psa/oplaty` | — |
| 7 | `GET /api/psa/oplaty/eksport` | — |
| 8 | `POST /api/psa/oplaty` | — |
| 9 | `PATCH /api/psa/oplaty/:id` | — |
| 10 | `POST /api/psa/oplaty/naliczenie-roczne` | wymagajAdmina |

## `server/trasy/szablony.js` → mount `/api/psa/szablony` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/szablony` | wymagajAdmina |
| 2 | `GET /api/psa/szablony/dostepne-klucze` | wymagajAdmina |
| 3 | `GET /api/psa/szablony/:kod` | wymagajAdmina |
| 4 | `POST /api/psa/szablony/:kod/podglad` | wymagajAdmina |
| 5 | `GET /api/psa/szablony/:kod/podglad.docx` | wymagajAdmina |

## `server/trasy/zgloszenia.js` → mount `/api/psa/zgloszenia` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/zgloszenia` | — |
| 2 | `GET /api/psa/zgloszenia/:id` | — |
| 3 | `POST /api/psa/zgloszenia/:id/odrzuc` | — |
| 4 | `POST /api/psa/zgloszenia/:id/zapros` | — |

## `server/trasy/wnioski.js` → mount `/api/psa/wnioski` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/wnioski` | — |
| 2 | `GET /api/psa/wnioski/:id` | — |
| 3 | `GET /api/psa/wnioski/:id/dowod` | — |
| 4 | `GET /api/psa/wnioski/:id/dokumenty/:dokId` | — |
| 5 | `POST /api/psa/wnioski/:id/dokumenty/wystaw` | — |
| 6 | `GET /api/psa/wnioski/:id/dokumenty/:dokId/tresc` | — |
| 7 | `PUT /api/psa/wnioski/:id/dokumenty/:dokId/tresc` | — |
| 8 | `POST /api/psa/wnioski/:id/dokumenty/:dokId/podpis-potwierdz` | — |
| 9 | `POST /api/psa/wnioski/:id/dokumenty/udostepnij` | — |
| 10 | `POST /api/psa/wnioski/:id/z-krs` | — |
| 11 | `PUT /api/psa/wnioski/:id` | — |
| 12 | `POST /api/psa/wnioski/:id/akcjonariusze` | — |
| 13 | `PUT /api/psa/wnioski/:id/akcjonariusze/:akcId` | — |
| 14 | `DELETE /api/psa/wnioski/:id/akcjonariusze/:akcId` | — |
| 15 | `POST /api/psa/wnioski/:id/akcjonariusze/:akcId/zweryfikuj` | — |
| 16 | `POST /api/psa/wnioski/:id/akcjonariusze/:akcId/do-poprawy` | — |
| 17 | `POST /api/psa/wnioski/:id/do-uzupelnienia` | — |
| 18 | `POST /api/psa/wnioski/:id/odrzuc` | — |
| 19 | `POST /api/psa/wnioski/:id/przyjmij` | — |

## `server/trasy/zawiadomienia.js` → mount `/api/psa/zawiadomienia` (wymagajPracownika)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/zawiadomienia` | — |
| 2 | `POST /api/psa/zawiadomienia/wyslij` | — |

## `server/trasy/pozostale.js` → mount `/api/psa` (bez bramki na poziomie mountu)

| # | Metoda i ścieżka | Middleware w trasie |
|---|---|---|
| 1 | `GET /api/psa/ustawienia` | wymagajPracownika |
| 2 | `PUT /api/psa/ustawienia` | wymagajPracownika |
| 3 | `GET /api/psa/meta` | — |
| 4 | `GET /api/psa/liczniki` | wymagajPracownika |
| 5 | `GET /api/psa/pulpit` | wymagajPracownika |
| 6 | `GET /api/psa/integralnosc` | wymagajPracownika |
| 7 | `POST /api/psa/sad/zapytania` | wymagajPracownika |
| 8 | `POST /api/psa/sad/zawiadomienie-o-rozwiazaniu` | wymagajPracownika |
