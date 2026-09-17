# Integracja z tpay Open API — notatka wdrożeniowa

Podsumowanie działającego wdrożenia z kalkulatora opłat notarialnych, spisane
tak, żeby dało się je przenieść do innego modułu. Zawiera też pułapki, na które
natknęliśmy się w praktyce — większość z nich nie wynika wprost z dokumentacji.

**Stan:** integracja działa na produkcji (Node.js + Express + SQLite).

---

## 1. Źródła wiedzy

Strony `docs-api.tpay.com` i `openapi.tpay.com` bywają niedostępne z środowisk
narzędziowych. Rzetelne i zawsze dostępne są repozytoria GitHub tpay:

| Repozytorium | Do czego |
|---|---|
| `tpay-com/tpay-openapi-php` | biblioteka referencyjna — modele pól, ich limity i wymagalność, obsługa powiadomień |
| `tpay-com/tpay-open-api-postman-collection` | oficjalne wzorce żądań |

Gdy dokumentacja czegoś nie rozstrzyga, `src/Model/` w bibliotece PHP jest
najbliższe prawdy: każde pole ma tam typ, `maxLength` i listę `getRequiredFields()`.

---

## 2. Przepływ w skrócie

```
1. Twój backend  --POST /oauth/auth-->        tpay      (token, ważny 2 h)
2. Twój backend  --POST /transactions-->      tpay      (kwota, opis, callbacks)
                 <--transactionPaymentUrl---
3. Przeglądarka  --przekierowanie-->          kasa tpay (klient wybiera BLIK/karta/przelew)
4. tpay          --POST na Twój webhook-->    Twój backend   (ITN — potwierdzenie)
5. tpay          --przekierowanie-->          Twoja strona powrotna
```

**Kluczowa zasada: stan płatności ustala krok 4, nie krok 5.** Powrót
przeglądarki to tylko wygoda dla użytkownika — można go sfałszować, pominąć
albo zamknąć kartę przed przekierowaniem.

---

## 3. Dane dostępowe

Panel Akceptanta → **Integracja → API → Klucze do Open API → Dodaj nowy klucz**.

- Hasło widoczne **tylko raz**, przy generowaniu.
- Klucz musi mieć uprawnienie do **tworzenia transakcji**. Z kluczem tylko do
  odczytu `POST /transactions` zwróci błąd — to najczęstszy powód, dla którego
  wdrożenie nie działa za pierwszym razem.
- Osobno w panelu jest **kod weryfikacyjny powiadomień** (merchant secret) —
  inny niż `client_secret`, potrzebny do sprawdzania sumy MD5 w ITN.

Trzymać wyłącznie w zmiennych środowiskowych. Nigdy w bazie, w kodzie ani
w żadnym miejscu, do którego sięga przeglądarka:

```
TPAY_CLIENT_ID=...
TPAY_CLIENT_SECRET=...
TPAY_NOTIFICATION_SECRET=...        # kod weryfikacyjny powiadomień
TPAY_API_URL=https://api.tpay.com   # sandbox: https://openapi.sandbox.tpay.com
```

Adresy: produkcja `https://api.tpay.com`, sandbox `https://openapi.sandbox.tpay.com`.
Konto sandbox zakłada się osobno na `register.sandbox.tpay.com`.

---

## 4. Autoryzacja

`POST {baza}/oauth/auth`, `Content-Type: application/x-www-form-urlencoded`,
pola `client_id` i `client_secret`. Odpowiedź:

```json
{ "access_token": "...", "token_type": "Bearer", "expires_in": 7200 }
```

Dalej `Authorization: Bearer <access_token>`.

**Token trzymaj w pamięci procesu i odnawiaj dopiero przed wygaśnięciem.**
Dokumentacja tpay wprost odradza pobieranie go przy każdym żądaniu. Warto
zostawić minutę zapasu i jednorazowo ponowić żądanie po HTTP 401 — token bywa
unieważniony przed upływem `expires_in`.

```js
let token = null; // { wartosc, wygasaO }

async function pobierzToken() {
    if (token && token.wygasaO - 60_000 > Date.now()) return token.wartosc;
    const odp = await fetch(`${BAZA}/oauth/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: ID, client_secret: SECRET }).toString()
    });
    const d = await odp.json();
    if (!odp.ok || !d.access_token) throw new Error('tpay: autoryzacja nieudana');
    token = { wartosc: d.access_token, wygasaO: Date.now() + (d.expires_in || 7200) * 1000 };
    return token.wartosc;
}
```

---

## 5. Utworzenie transakcji

`POST /transactions`. Minimalne, sprawdzone w praktyce ciało żądania:

```js
{
    amount: 199.99,                    // liczba, dokładność do groszy
    currency: 'PLN',
    description: 'Opis widoczny dla klienta',   // max 128 znaków
    hiddenDescription: 'zamowienie:123',        // niewidoczny, wraca w ITN jako tr_crc
    lang: 'pl',
    callbacks: {
        notification: {
            url: 'https://twoja-domena.pl/webhook/tpay',
            email: 'biuro@twoja-domena.pl'
        },
        payerUrls: {
            success: 'https://twoja-domena.pl/platnosc/ok',
            error:   'https://twoja-domena.pl/platnosc/blad'
        }
    }
}
```

Odpowiedź zawiera `transactionId`, `title` oraz **`transactionPaymentUrl`** —
adres kasy, na który przekierowujesz klienta.

### Pułapki, które kosztowały nas czas

**`payer` — nie wysyłaj, jeśli klient ma dostać potwierdzenie.**
Gdy podasz `payer.email` i `payer.name`, kasa tpay pokazuje te pola
**wypełnione i zablokowane**. Klient nie może wpisać własnego adresu, więc
potwierdzenie płatności idzie na adres, który wpisałeś Ty. Bez `payer` klient
podaje dane sam i dostaje potwierdzenie — a Ty nie przechowujesz jego danych
osobowych.

Biblioteka PHP oznacza `payer` jako wymagany, ale API przyjmuje żądania bez
niego. Warto na wszelki wypadek obsłużyć obie możliwości: wysłać bez `payer`,
a gdy API odrzuci żądanie z powodu brakującego płatnika — ponowić raz
z wartościami zastępczymi.

**`callbacks.notification.email` to Twój niezależny kanał.**
Rozwiązuje konflikt: klient dostaje potwierdzenie na swój adres, a Ty
dostajesz powiadomienie na swój, niezależnie od tego, co klient wpisał.

**Pomiń `pay`.** Bez tego obiektu klient trafia na stronę wyboru metody
płatności. Wymuszenie jednej metody (`pay.groupId`) jest ryzykowne przy
większych kwotach — BLIK i karty mają limity dzienne, przelew online nie.

**`description` ma limit 128 znaków** i tpay poprzedza go w kasie słowami
„Płatność za …". Nie wstawiaj tam nazwy swojej firmy: odbiorca jest pokazany
osobno („Dla Odbiorcy: …") i wychodzi zlepek. Zacznij od rzeczownika, który po
„Płatność za" czyta się poprawnie.

**Numer zamówienia trzymaj w `description` i `hiddenDescription`**, nigdy
w `payer.name` — tam ląduje w polu „Imię i nazwisko / Nazwa firmy" i wygląda
jak pomyłka systemu.

**Nie ma pola daty wygaśnięcia.** Ważność linku pilnujesz po swojej stronie:
zapisujesz datę utworzenia, a po upływie terminu oznaczasz płatność jako
wygasłą i wołasz `POST /transactions/{id}/cancel`.

**Zmiana kwoty musi unieważniać poprzednią transakcję.** Inaczej klient ze
starym linkiem zapłaci nieaktualną kwotę. U nas: anuluj starą, utwórz nową.

---

## 6. Potwierdzenie płatności

### Droga właściwa dla aplikacji webowej: ITN (webhook)

tpay wysyła `POST` na `callbacks.notification.url` — dane jako pola formularza
(`application/x-www-form-urlencoded`), nie JSON:

| Pole | Znaczenie |
|---|---|
| `id` | identyfikator sprzedawcy |
| `tr_id` | identyfikator transakcji w tpay |
| `tr_amount` | kwota transakcji |
| `tr_paid` | kwota faktycznie zapłacona |
| `tr_crc` | to, co wysłałeś w `hiddenDescription` |
| `tr_status` | `TRUE` / `PAID` / `CHARGEBACK` |
| `tr_error` | kod błędu, gdy płatność się nie powiodła |
| `tr_email` | adres podany przez klienta |
| `md5sum` | suma kontrolna do weryfikacji |
| `test_mode` | `1` dla sandboxa |

**Weryfikacja jest obowiązkowa — bez niej endpoint przyjmuje sfałszowane
„potwierdzenia płatności" od kogokolwiek.** Trzy warstwy:

1. **Suma MD5:**
   `md5(id + tr_id + tr_amount + tr_crc + merchant_secret) === md5sum`
   gdzie `merchant_secret` to kod weryfikacyjny powiadomień z panelu.

2. **Podpis JWS** w nagłówku `X-JWS-Signature` — weryfikowany certyfikatem
   pobranym z `https://secure.tpay.com` (sandbox: `https://secure.sandbox.tpay.com`).
   Format: `naglowek.payload.podpis`, base64url. Implementacja referencyjna:
   `src/Webhook/JWSVerifiedPaymentNotification.php`.

3. **Lista adresów IP** (opcjonalnie, jako dodatkowa warstwa) —
   `src/Dictionary/NotificationsIP.php`:
   `176.119.38.175`, `195.149.229.109`, `148.251.96.163`,
   `178.32.201.77`, `46.248.167.59`, `46.29.19.106`.

**Odpowiedz czystym tekstem `TRUE`** (bez HTML, bez JSON), gdy powiadomienie
zostało przyjęte i zapisane. Cokolwiek innego tpay uzna za niepowodzenie
i ponowi wysyłkę.

Dalsze zasady:

- **Powiadomienie może przyjść wielokrotnie.** Obsługa musi być idempotentna —
  klucz po `tr_id`, i sprawdzenie, czy zamówienie nie jest już opłacone.
- **Porównaj `tr_paid` z kwotą, której oczekujesz** (ze swojej bazy, po
  `tr_crc`). Nie ufaj kwocie z powiadomienia jako źródłu prawdy o tym, ile
  klient był winien.
- **Sprawdzaj `test_mode`** — powiadomienie z sandboxa nie może zaksięgować
  płatności na produkcji.
- Zapisz stan i zwróć `TRUE` szybko; ciężką robotę (maile, faktury) zrób
  poza obsługą żądania.

### Droga awaryjna: odpytywanie

`GET /transactions/{id}` zwraca m.in. `status`. Stosuj, gdy nie możesz wystawić
publicznego endpointu (u nas: serwer w LAN kancelarii, bez adresu z internetu).
W aplikacji webowej ITN jest lepszy — odpytywanie nie dowie się o zwrocie
(chargeback) ani o płatności dokonanej po tygodniu.

**Mapuj statusy defensywnie: cokolwiek nierozpoznanego traktuj jako oczekujące,
nigdy jako opłacone.** Lista wartości po stronie tpay bywa rozszerzana.

```js
const MAPA = {
    correct: 'oplacona', paid: 'oplacona', true: 'oplacona',
    declined: 'nieudana', error: 'nieudana', chargeback: 'nieudana',
    canceled: 'anulowana', cancelled: 'anulowana',
    pending: 'oczekuje', new: 'oczekuje'
};
const status = MAPA[String(odp.status || '').toLowerCase()] || 'oczekuje';
```

Dobra praktyka nawet przy ITN: przy otwarciu zamówienia w panelu obsługi
odpytaj `GET /transactions/{id}`, gdy stan lokalny to wciąż „oczekuje".
Wychwytuje przypadki, w których webhook nie doszedł.

---

## 7. Pozostałe endpointy

| Wywołanie | Zastosowanie |
|---|---|
| `GET /transactions/{id}` | status transakcji |
| `POST /transactions/{id}/cancel` | unieważnienie linku (wygaśnięcie, zmiana kwoty) |
| `POST /transactions/{id}/qr` | kod QR jako obraz — `{ size: 'M', outputType: 'image/png' }`, zwraca binarnie. Przydatne na wydrukach; nie trzeba własnej biblioteki QR |
| `POST /transactions/{id}/refunds` | zwrot pełny lub częściowy |

---

## 8. Model danych po stronie aplikacji

Minimum, które sprawdziło się u nas:

```sql
CREATE TABLE platnosci (
    id              INTEGER PRIMARY KEY,
    zamowienie_id   INTEGER NOT NULL REFERENCES zamowienia(id) ON DELETE CASCADE,
    tpay_id         TEXT,           -- transactionId
    kwota           REAL NOT NULL,  -- kwota, na którą opiewa transakcja
    link            TEXT NOT NULL,  -- transactionPaymentUrl
    status          TEXT NOT NULL DEFAULT 'oczekuje',
    utworzony       DATETIME DEFAULT CURRENT_TIMESTAMP,
    oplacona_data   DATETIME
);
```

Dwie decyzje warte przeniesienia:

- **Jedno zamówienie może mieć wiele wierszy płatności.** Zmiana kwoty
  unieważnia poprzednią transakcję i tworzy nową, a historia prób zostaje.
  Aktualna płatność to najnowszy wiersz o statusie „oczekuje".
- **Zapisuj kwotę transakcji osobno.** To jedyny sposób, żeby wykryć, że
  zamówienie zmieniło się po wygenerowaniu linku.

---

## 9. Warstwa interfejsu

Przycisk „Zapłać online" **nie prowadzi bezpośrednio do tpay**. Prowadzi do
Twojego backendu, który tworzy transakcję i dopiero zwraca adres kasy — inaczej
kwota i opis byłyby ustalane w przeglądarce, czyli przez klienta.

```js
async function zaplac(zamowienieId) {
    const r = await fetch(`/api/platnosci/${zamowienieId}`, { method: 'POST' });
    const { platnosc } = await r.json();
    window.location.href = platnosc.link;   // przekierowanie do kasy tpay
}
```

Generowanie linku zrób **idempotentnym**: dopóki istnieje aktualny link na tę
samą kwotę, zwróć go zamiast tworzyć w tpay drugą transakcję. Inaczej
dwukrotne kliknięcie przycisku zostawia w panelu tpay śmieci.

Strona powrotna (`payerUrls.success`) ma pokazać stan **z Twojej bazy**, a nie
zakładać, że skoro klient tu trafił, to zapłacił. Typowy scenariusz: klient
wraca szybciej, niż dotrze ITN. Pokaż wtedy „sprawdzamy płatność" i odśwież
stan po kilku sekundach.

---

## 10. Testowanie bez produkcji

Sandbox tpay (`openapi.sandbox.tpay.com`) wymaga osobnego konta. Szybszy
i pewniejszy w testach automatycznych okazał się **lokalny serwer-atrapa**:
kilkadziesiąt linii, odpowiada na `/oauth/auth`, `/transactions`,
`/transactions/{id}` i `/cancel`. Pozwala przetestować scenariusze, których na
sandboxie nie wywołasz na żądanie:

- klient płaci → status się przestawia,
- zmiana kwoty → stary link anulowany, nowy wygenerowany,
- upływ terminu ważności,
- API odrzuca żądanie bez `payer`,
- brak łączności z tpay — aplikacja nie może się wtedy wywrócić.

W kodzie aplikacji wystarczy, że adres API jest konfigurowalny (`TPAY_API_URL`).

---

## 11. Lista kontrolna przed uruchomieniem

- [ ] Klucz Open API ma uprawnienie do tworzenia transakcji, nie tylko odczytu
- [ ] Sekrety w zmiennych środowiskowych, poza repozytorium
- [ ] Webhook na publicznym HTTPS, weryfikuje MD5 **i** podpis JWS
- [ ] Webhook odpowiada czystym `TRUE` i jest idempotentny
- [ ] `test_mode` odróżnia sandbox od produkcji
- [ ] Kwota z powiadomienia porównywana z kwotą z Twojej bazy
- [ ] Token cache'owany, nie pobierany przy każdym żądaniu
- [ ] Nieznany status = „oczekuje", nigdy „opłacona"
- [ ] Zmiana kwoty unieważnia poprzedni link
- [ ] Generowanie linku idempotentne
- [ ] Awaria tpay nie blokuje reszty aplikacji
- [ ] Pierwszy test na produkcji na własnym, drobnym zamówieniu
