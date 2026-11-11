# Wdrożenie rejestru akcjonariuszy P.S.A. na serwer kancelarii

Instrukcja dla osoby, która stawia i utrzymuje serwer (informatyk kancelarii). Przykłady dotyczą Ubuntu Server 24.04 LTS,
nginx i systemd. Adres `rejestr.kancelaria.pl` i adresy IP biura podmień na prawdziwe. Kolejność kroków ma znaczenie.

## 0. Co przygotować przed startem

| Element | Uwagi |
|---|---|
| **Serwer** | VPS albo serwer w Polsce lub UE: 2 vCPU, 2 GB RAM, 40 GB dysku + osobny wolumen na dane. Umowa powierzenia przetwarzania danych osobowych z dostawcą (RODO). |
| **Domena** | np. `rejestr.kancelaria.pl` z rekordem A na adres serwera. |
| **Stałe adresy IP biura** | Tylko z nich będzie dostępna aplikacja kancelarii; portal klienta — z całego internetu. |
| **Skrzynka nadawcza** | np. `rejestr@kancelaria.pl` w Microsoft 365 (punkt 6). |
| **tpay** | konto produkcyjne z dostępem do Open API (punkt 7). |
| **Magazyn kopii poza serwerem** | np. magazyn obiektowy albo Storage Box w UE (punkt 9). |
| **Sejf haseł** | hasło do szyfrowania dysku, hasło do szyfrowania kopii, `SESJA_SEKRET`, klucze tpay, hasło SMTP — **nigdy w repozytorium ani w e-mailu**. |

## 1. System i zapora

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx sqlite3 gpg git build-essential python3 unattended-upgrades cryptsetup rclone
sudo dpkg-reconfigure -plow unattended-upgrades          # automatyczne poprawki bezpieczeństwa
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs   # Node.js 22 LTS
sudo adduser --system --group --home /srv/psa psa
```

Zapora: SSH tylko z biura, WWW dla wszystkich (portal klienta i powiadomienia tpay). Port aplikacji (3005) zostaje
zamknięty z zewnątrz.

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 203.0.113.10 to any port 22 proto tcp    # IP biura — powtórz dla każdego adresu
sudo ufw allow 80,443/tcp
sudo ufw enable
```

Logowanie SSH tylko kluczem: w `/etc/ssh/sshd_config` ustaw `PasswordAuthentication no` i `PermitRootLogin no`,
potem `sudo systemctl reload ssh`.

## 2. Szyfrowany wolumen na dane

Baza i pliki zawierają dane osobowe (PESEL, adresy) zapisane jawnie. Hasła i tokeny są w bazie tylko jako skróty.
Dlatego dane leżą na wolumenie zaszyfrowanym LUKS. Hasło do odszyfrowania podaje się ręcznie po każdym
restarcie serwera — dzięki temu skradziony dysk albo migawka u dostawcy są bezużyteczne.

```bash
sudo cryptsetup luksFormat /dev/sdb                 # wolumen danych z panelu dostawcy; hasło → sejf
sudo cryptsetup open /dev/sdb psa-dane
sudo mkfs.ext4 /dev/mapper/psa-dane
sudo mkdir -p /srv/psa/dane-szyfrowane && sudo mount /dev/mapper/psa-dane /srv/psa/dane-szyfrowane
sudo mkdir -p /srv/psa/dane-szyfrowane/{baza,dokumenty,kopie}
sudo chown -R psa:psa /srv/psa/dane-szyfrowane && sudo chmod -R 700 /srv/psa/dane-szyfrowane
```

Po restarcie serwera (aplikacja nie wystartuje sama, dopóki wolumen jest zamknięty):

```bash
sudo cryptsetup open /dev/sdb psa-dane && sudo mount /dev/mapper/psa-dane /srv/psa/dane-szyfrowane && sudo systemctl start psa
```

## 3. Aplikacja

Repozytorium jest prywatne. Na serwerze dodaj klucz SSH tylko do odczytu (GitHub → ustawienia repozytorium →
Deploy keys) i klonuj adresem `git@github.com:…`.

```bash
sudo -u psa git clone git@github.com:thorid15/Proste-Spolki-Akcyjne.git /srv/psa/app
cd /srv/psa/app && sudo -u psa git checkout <gałąź-albo-tag-wydania>
sudo -u psa npm ci --omit=dev        # front jest już zbudowany (publiczne/dist) — esbuild niepotrzebny
sudo -u psa cp .env.przyklad .env && sudo chmod 600 .env
```

W pliku `.env` ustaw wartości (pozostałe opisuje `.env.przyklad`):

```
WSPOLNA_BAZA=/srv/psa/dane-szyfrowane/baza/kancelaria.db
KATALOG_DOKUMENTOW=/srv/psa/dane-szyfrowane/dokumenty
URL_PORTALU=https://rejestr.kancelaria.pl/portal.html
NODE_ENV=production
SESJA_SEKRET=<wynik: openssl rand -hex 32>
ADMIN_EMAIL=<adres notariusza>
PORTAL_WLACZONY=true
```

Nigdy nie ustawiaj na produkcji `PSA_TRYB_TESTOWY` — przy `NODE_ENV=production` serwer odmówi startu.

## 4. Usługa systemd

Plik `/etc/systemd/system/psa.service`:

```ini
[Unit]
Description=Rejestr akcjonariuszy P.S.A.
After=network-online.target
RequiresMountsFor=/srv/psa/dane-szyfrowane

[Service]
User=psa
Group=psa
WorkingDirectory=/srv/psa/app
ExecStart=/usr/bin/node serwer.js
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/psa/dane-szyfrowane

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now psa
sudo journalctl -u psa -n 50          # tu, jeden raz, jest hasło tymczasowe administratora
```

## 5. nginx i HTTPS

```bash
sudo certbot --nginx -d rejestr.kancelaria.pl     # certyfikat Let's Encrypt, odnawiany automatycznie
```

Plik `/etc/nginx/sites-available/psa` (podlinkuj w `sites-enabled`, usuń `default`). Portal, jego pliki i powiadomienia
tpay są publiczne; **wszystko inne — w tym aplikacja kancelarii i jej API — tylko z adresów biura**.

```nginx
server {
  listen 443 ssl http2;
  server_name rejestr.kancelaria.pl;
  # ssl_certificate … — wpisze certbot
  client_max_body_size 11m;                      # pliki do 10 MB
  server_tokens off;

  location @aplikacja {
    proxy_pass http://127.0.0.1:3005;
    proxy_set_header Host $host;                 # wymagane: sprawdzenie nagłówka Origin
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }

  # Publiczne: portal klienta, jego zasoby, dane kancelarii do stopki, powiadomienia tpay.
  location ~ ^/(portal|portal\.html|dist/portal\.js|vendor/|style/|fonty/|obrazy/|robots\.txt|api/psa/portal/|api/wspolne/|api/psa/platnosci/tpay/itn) {
    try_files /nieistnieje @aplikacja;
  }

  # Aplikacja kancelarii — tylko biuro.
  location / {
    allow 203.0.113.10;                          # IP biura — powtórz dla każdego adresu
    deny all;
    try_files /nieistnieje @aplikacja;
  }
}
server { listen 80; server_name rejestr.kancelaria.pl; return 301 https://$host$request_uri; }
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Poczta (Microsoft 365)

W `.env`:

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=rejestr@kancelaria.pl
SMTP_PASS=<hasło>
SMTP_FROM=Kancelaria Notarialna <rejestr@kancelaria.pl>
```

Aplikacja łączy się tylko z TLS (STARTTLS jest obowiązkowy).

1. **Włącz logowanie SMTP dla skrzynki:** centrum administracyjne Microsoft 365 → Użytkownicy → skrzynka →
   Poczta → Zarządzaj aplikacjami poczty e-mail → „Uwierzytelniony SMTP”.
2. **Sprawdź, czy Microsoft nadal przyjmuje logowanie hasłem do SMTP.** Microsoft wycofuje to logowanie
   („Basic auth”) w Exchange Online. Jeśli wysyłka kończy się błędem uwierzytelnienia, masz dwie drogi:
   - zewnętrzny dostawca SMTP z serwerami w UE (login i hasło, TLS) — wystarczy zmienić `SMTP_*`;
   - logowanie OAuth2 do Microsoft 365 — wymaga małej zmiany w `server/poczta.js`.
3. **Test:** karta dowolnej osoby z Twoim adresem → „Zaproś do portalu”. E-mail powinien dojść; błąd widać
   od razu na ekranie.

Rekordy domeny (SPF, DKIM, DMARC) muszą obejmować Microsoft 365 albo wybranego dostawcę — inaczej pisma trafią
do spamu.

## 7. Płatności tpay

1. **Klucze:** panel tpay → Integracja → API (Open API) → utwórz klucz. Do `.env` wpisz:
   - `TPAY_CLIENT_ID` i `TPAY_CLIENT_SECRET`;
   - `TPAY_NOTIFICATION_SECRET` = „kod bezpieczeństwa” powiadomień z panelu;
   - `TPAY_API_URL=https://api.tpay.com` i `TPAY_TRYB_TESTOWY=false`.
2. **Adres powiadomień** aplikacja przekazuje sama przy każdej transakcji
   (`https://rejestr.kancelaria.pl/api/psa/platnosci/tpay/itn`). Musi być osiągalny z internetu — jest w części
   publicznej konfiguracji nginx.
3. **Test:** konto testowe w portalu → „Zamów informację z rejestru” → zapłać niewielką kwotę → opłata ma stan
   „opłacona”, a informacja jest do pobrania. Gdyby powiadomienie nie doszło, pracownik oznacza opłatę ręcznie
   („Opłacona”).

## 8. Pierwsze uruchomienie

1. Zaloguj się na `https://rejestr.kancelaria.pl/` adresem `ADMIN_EMAIL` i hasłem tymczasowym z logu (punkt 4).
   Od razu zmień hasło w menu konta.
2. **Ustawienia:** dane kancelarii (trafiają do każdej umowy i pisma), osoby zawierające umowy, konta pracowników.
3. `npm run wzory` na komputerze z repozytorium (albo nowa spółka testowa w aplikacji) — sprawdź wygląd umowy
   i pism z prawdziwymi danymi kancelarii.

## 9. Kopie zapasowe

Codziennie robiona jest spójna kopia bazy (także w trakcie pracy) i katalogu plików. Całość jest szyfrowana
i wysyłana poza serwer.

Skrypt `/usr/local/bin/psa-kopia` (właściciel root, `chmod 700`):

```bash
#!/bin/bash
set -euo pipefail
D=/srv/psa/dane-szyfrowane; T=$(date +%F); K=$D/kopie/$T
mkdir -p "$K"
sqlite3 "$D/baza/kancelaria.db" ".backup '$K/kancelaria.db'"
tar -C "$D" -czf "$K/dokumenty.tgz" dokumenty
tar -C "$D/kopie" -cf - "$T" | gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-file /root/.psa-haslo-kopii -o "$D/kopie/psa-$T.tar.gpg"
rm -rf "$K"
rclone copy "$D/kopie/psa-$T.tar.gpg" magazyn:psa-kopie/       # zdalny magazyn skonfigurowany w rclone
find "$D/kopie" -name 'psa-*.tar.gpg' -mtime +14 -delete       # lokalnie 14 dni
```

```bash
echo '30 2 * * * root /usr/local/bin/psa-kopia' | sudo tee /etc/cron.d/psa-kopia
```

- **Hasło kopii** zapisz w pliku `/root/.psa-haslo-kopii` (`chmod 600`) i w sejfie. Bez niego kopia jest bezużyteczna.
- **Retencja w zdalnym magazynie:** ustaw zgodnie z polityką kancelarii — dokumenty rejestru przechowuje się
  przez 6 lat (umowa § 17).
- **Próba odtworzenia — raz na kwartał** (na osobnym komputerze albo serwerze testowym):
  1. `gpg -d psa-RRRR-MM-DD.tar.gpg | tar -x`;
  2. ustaw `WSPOLNA_BAZA` i `KATALOG_DOKUMENTOW` na rozpakowane pliki;
  3. `node serwer.js`;
  4. Ustawienia → „Sprawdź integralność rejestru” — wynik musi być poprawny.

## 10. Aktualizacje aplikacji

```bash
sudo /usr/local/bin/psa-kopia                       # najpierw kopia
cd /srv/psa/app && sudo -u psa git pull && sudo -u psa npm ci --omit=dev
sudo systemctl restart psa && sudo journalctl -u psa -n 30
```

- Zmiany schematu bazy wykonują się same przy starcie.
- Migracja, która musiałaby skasować wpisy rejestru, **odmawia działania** — wtedy wróć do poprzedniej wersji
  (`git checkout <poprzedni-tag>`) i zgłoś problem.
- Raz w miesiącu `npm audit --omit=dev` — przy podatnościach zaktualizuj zależności, uruchom testy (na komputerze
  deweloperskim) i wdróż jak wyżej.

## 11. Kontrola po wdrożeniu

| Sprawdzenie | Oczekiwany wynik |
|---|---|
| `curl -sI https://rejestr.kancelaria.pl/portal.html` | 200; nagłówki `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY` |
| `https://rejestr.kancelaria.pl/` spoza biura (np. z telefonu bez Wi-Fi) | 403 (nginx) |
| `https://rejestr.kancelaria.pl/portal` spoza biura | ekran logowania portalu |
| `https://rejestr.kancelaria.pl/test` | 404 (tryb testowy wyłączony) |
| Zaproszenie do portalu na własny adres | e-mail dochodzi, link ustawia hasło |
| Płatność testowa w portalu | opłata „opłacona”, informacja do pobrania |
| Ustawienia → „Sprawdź integralność rejestru” | poprawna |
| Kopia z nocy w zdalnym magazynie i próba jej odtworzenia | plik jest, odtworzenie działa |
| `sudo reboot`, potem odblokowanie wolumenu (punkt 2) | aplikacja wstaje, dane na miejscu |

## 12. Sytuacje awaryjne

| Sytuacja | Co zrobić |
|---|---|
| Aplikacja nie odpowiada | `sudo systemctl status psa`, `sudo journalctl -u psa -n 100`. Po restarcie serwera — odblokuj wolumen (punkt 2). |
| Pracownik zapomniał hasła | Administrator: Ustawienia → Użytkownicy → „Resetuj hasło”. |
| Klient zapomniał hasła | Karta osoby → „Wyślij nowy link”. |
| Podejrzenie włamania albo wycieku | Zatrzymaj usługę (`sudo systemctl stop psa`), zmień `SESJA_SEKRET` (wyloguje wszystkich), hasła SMTP i klucze tpay. Zabezpiecz logi. Oceń obowiązek zgłoszenia naruszenia do UODO (72 godziny). |
| Utrata serwera | Nowy serwer według punktów 1–5, odtworzenie ostatniej kopii (punkt 9), kontrola integralności. |
