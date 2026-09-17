# Przymiarki ręczne — cała ścieżka na żywym serwerze

`node --test testy/*.test.js` sprawdza jednostki i pojedyncze trasy. Te trzy
skrypty sprawdzają co innego: czy **da się przejść całą drogę** od zgłoszenia
do wpisu, klikając to, co klika klient i pracownik, na świeżej bazie.

Uruchamia się je przed każdym wydaniem — automatyczne testy nie wyłapią tego,
że jakiś krok jest niedostępny z interfejsu albo że dwa etapy nie zazębiają się
w czasie.

## Jak uruchomić

```bash
# 1. Atrapa operatora płatności (zamiast piaskownicy tpay)
node testy/reczne/atrapa-tpay.js &

# 2. Serwer na świeżej bazie, BEZ płatności
rm -f /tmp/e2e.db*
PORT=3107 WSPOLNA_BAZA=/tmp/e2e.db PORTAL_WLACZONY=true node serwer.js &
# hasło administratora wypisze się na konsoli przy pierwszym starcie
ADMIN_HASLO=<z konsoli> node testy/reczne/przebieg-pelny.js

# 3. Serwer na świeżej bazie, Z płatnościami
rm -f /tmp/e2e2.db*
PORT=3108 WSPOLNA_BAZA=/tmp/e2e2.db PORTAL_WLACZONY=true \
  TPAY_CLIENT_ID=demo TPAY_CLIENT_SECRET=demo TPAY_NOTIFICATION_SECRET=sekret-itn \
  TPAY_API_URL=http://127.0.0.1:3199 node serwer.js &
ADMIN_HASLO=<z konsoli> node testy/reczne/przebieg-platnosci.js
node testy/reczne/sonda-bezpieczenstwa.js
```

## Co sprawdza który

| Skrypt | Zakres |
|---|---|
| `przebieg-pelny.js` | zgłoszenie → zaproszenie → wniosek → komplet do podpisu → odesłanie → przyjęcie → otwarcie rejestru → zgłoszenie zmiany → wpis → faktura (24 kroki) |
| `przebieg-platnosci.js` | to samo z włączonymi płatnościami: bramka „żądanie skuteczne po zapłacie”, powiadomienie ITN prawdziwe i podrobione, zaniżona kwota, powtórka, informacja z rejestru po zapłacie (20 kroków) |
| `sonda-bezpieczeństwa.js` | dostęp bez sesji, nagłówki, enumeracja kont, limiter, SQL w parametrach, podpis ITN, wyjście z katalogu (17 sprawdzeń) |

Skrypty piszą `OK` albo `BLAD` przy każdym kroku i kończą podsumowaniem.
Żaden nie zmienia bazy produkcyjnej — każdy wymaga wskazania `WSPOLNA_BAZA`.
