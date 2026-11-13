'use strict';

/**
 * Konfiguracja modulu (sekcja 12 specyfikacji).
 *
 * Czytamy `.env` wlasnym parserem - `dotenv` nie jest na liscie zaleznosci
 * (sekcja 13), a plik ma kilkanascie linii i zaden pakiet nie jest tu potrzebny.
 */

const fs = require('node:fs');
const path = require('node:path');

const KATALOG_GLOWNY = path.resolve(__dirname, '..');

function wczytajEnv(sciezka) {
  if (!fs.existsSync(sciezka)) return;
  const tresc = fs.readFileSync(sciezka, 'utf8');
  for (const linia of tresc.split('\n')) {
    const czysta = linia.trim();
    if (!czysta || czysta.startsWith('#')) continue;
    const rozdzial = czysta.indexOf('=');
    if (rozdzial === -1) continue;
    const klucz = czysta.slice(0, rozdzial).trim();
    let wartosc = czysta.slice(rozdzial + 1).trim();
    if (
      (wartosc.startsWith('"') && wartosc.endsWith('"')) ||
      (wartosc.startsWith("'") && wartosc.endsWith("'"))
    ) {
      wartosc = wartosc.slice(1, -1);
    }
    // Zmienne ustawione w srodowisku maja pierwszenstwo nad plikiem.
    if (process.env[klucz] === undefined) process.env[klucz] = wartosc;
  }
}

wczytajEnv(path.join(KATALOG_GLOWNY, '.env'));

/**
 * Naprawa Z-306 — kancelaria dziala WYLACZNIE w Europie/Warszawie, a
 * `data_wpisu` na powiadomieniach o wpisie musi byc czasem LOKALNYM
 * (patrz `pomocnicze/czas.js`, ktory czyta strefe z `Date` procesu). Zla
 * strefa nie rzuca zadnego bledu w trakcie dzialania - po cichu przesuwa
 * godziny na oficjalnych dokumentach notarialnych, do wykrycia dopiero
 * przy realnym sporze.
 *
 * Wariant WYBRANY: zmienna NIEUSTAWIONA (swiezy checkout bez `.env`, CI bez
 * `.env` w repo - jest w `.gitignore`) dostaje BEZPIECZNY domyslny wymog
 * programowo, zeby brak konfiguracji nie byl przeszkoda do uruchomienia
 * testow ani pierwszego startu. Zmienna USTAWIONA na COKOLWIEK innego niz
 * Europe/Warsaw to natomiast SWIADOMA (choc zapewne omylkowa) decyzja kogos,
 * kto skonfigurowal srodowisko - taka odmawiamy uruchomienia od razu, zamiast
 * pozwolic jej po cichu popsuc daty na dokumentach. Symetryczny wzgledem
 * reszty kodu: "rola nieznana dostaje najwezszy zakres" (maskowanie.js) -
 * tu "strefa nieustalona dostaje bezpieczny domysl, strefa zla odmawia".
 */
const STREFA_WYMAGANA = 'Europe/Warsaw';
if (!process.env.TZ) {
  process.env.TZ = STREFA_WYMAGANA;
}
const strefaFaktyczna = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (strefaFaktyczna !== STREFA_WYMAGANA) {
  throw new Error(
    `Serwer wymaga strefy czasowej "${STREFA_WYMAGANA}" (zmienna TZ) - kancelaria dziala wylacznie w tej ` +
      `strefie, a data i godzina wpisu na powiadomieniach musza byc czasem lokalnym kancelarii. Wykryto ` +
      `strefe "${strefaFaktyczna}" (TZ=${process.env.TZ}). Ustaw TZ=${STREFA_WYMAGANA} w .env albo w ` +
      'srodowisku procesu.'
  );
}

function tekst(nazwa, domyslna) {
  const v = process.env[nazwa];
  return v === undefined || v === '' ? domyslna : v;
}

function liczba(nazwa, domyslna) {
  const v = Number(process.env[nazwa]);
  return Number.isFinite(v) ? v : domyslna;
}

function flaga(nazwa, domyslna) {
  const v = tekst(nazwa, null);
  if (v === null) return domyslna;
  return ['1', 'true', 'tak', 'yes', 'on'].includes(String(v).toLowerCase());
}

/**
 * Naprawa Z-002: `:memory:` to specjalna wartosc SQLite (baza wylacznie
 * w pamieci, bez pliku), nie sciezka wzgledna. `path.resolve` tego nie
 * wiedzial i skladal ja z KATALOG_GLOWNY jak kazdy inny tekst, tworzac
 * REALNY plik na dysku o nazwie dosłownie `:memory:` - `server/baza.js`
 * porownuje potem wynik z literalem `':memory:'`, ktory po przejsciu
 * przez ta funkcje nigdy juz nie pasowal.
 */
function sciezka(nazwa, domyslna) {
  const wartosc = tekst(nazwa, domyslna);
  if (wartosc === ':memory:') return wartosc;
  return path.resolve(KATALOG_GLOWNY, wartosc);
}

const konfiguracja = {
  KATALOG_GLOWNY,
  PORT: liczba('PORT', 3005),
  // Audyt W2: nasłuch tylko na pętli zwrotnej (za nginx na tym samym serwerze); inny układ — ustaw HOST.
  HOST: tekst('HOST', '127.0.0.1'),
  // Audyt W2: adresy, z których działają trasy pracowników (sieć biura). Pusta lista = bez ograniczenia.
  KANCELARIA_ADRESY: require('./logika/adresy').wczytajListe(process.env.KANCELARIA_ADRESY),
  WSPOLNA_BAZA: sciezka('WSPOLNA_BAZA', './dane/kancelaria.db'),
  KATALOG_DOKUMENTOW: sciezka('KATALOG_DOKUMENTOW', './dokumenty'),
  ADMIN_EMAIL: tekst('ADMIN_EMAIL', null),
  SESJA_SEKRET: tekst('SESJA_SEKRET', null),
  KRS_API_URL: tekst('KRS_API_URL', 'https://api-krs.ms.gov.pl/api/krs'),
  PORTAL_WLACZONY: flaga('PORTAL_WLACZONY', false),
  // Adres portalu klienta w mailach zapraszajacych (etap 3B) - link
  // aktywacyjny musi wskazywac na PUBLICZNY adres, nie na "localhost".
  URL_PORTALU: tekst('URL_PORTALU', `http://localhost:${liczba('PORT', 3005)}/portal.html`),
  // D-049/FAZA 5 — domena strony publicznej (SEO) nierozstrzygnieta (Q2);
  // uzywana wylacznie przez `narzedzia/buduj-strone.js` (adresy bezwzgledne,
  // canonical, sitemap.xml, JSON-LD) - NIE przez ten serwer, ktory strony
  // publicznej nie serwuje w tej sesji (patrz DECYZJE.md D-063).
  BASE_URL_STRONA: tekst('BASE_URL_STRONA', 'https://przyklad-domena-do-ustalenia.pl'),
  SMTP: {
    host: tekst('SMTP_HOST', null),
    port: liczba('SMTP_PORT', 587),
    user: tekst('SMTP_USER', null),
    pass: tekst('SMTP_PASS', null),
    from: tekst('SMTP_FROM', null),
  },
  /**
   * Platnosci online (tpay). Sekrety siedza WYLACZNIE w `.env` — nigdy
   * w bazie: baza jedzie do kopii zapasowej i do eksportu, a klucz
   * platniczy to klucz do pieniedzy kancelarii.
   *
   * `api_url` wskazuje na piaskownice albo na produkcje; w testach
   * automatycznych podstawiamy pod niego lokalny serwer-atrape, zeby dalo
   * sie wywolac scenariusze, ktorych w piaskownicy nie wywolasz na zadanie
   * (zmiana kwoty, podwojne powiadomienie, brak lacznosci).
   *
   * `tryb_testowy` decyduje, czy powiadomienie oznaczone jako testowe wolno
   * zaksiegowac. Na produkcji ma byc `false` — inaczej ktokolwiek, kto zna
   * nasz adres ITN, ksieguje oplaty powiadomieniem z piaskownicy.
   */
  TPAY: {
    client_id: tekst('TPAY_CLIENT_ID', null),
    client_secret: tekst('TPAY_CLIENT_SECRET', null),
    notification_secret: tekst('TPAY_NOTIFICATION_SECRET', null),
    api_url: tekst('TPAY_API_URL', 'https://api.tpay.com'),
    tryb_testowy: flaga('TPAY_TRYB_TESTOWY', false),
  },
  /**
   * Tryb testowy (T1-T6, DECYZJE.md D-074). Wlacza go WYLACZNIE zmienna
   * `PSA_TRYB_TESTOWY` (w `.env`). Serwer odmawia startu przy
   * `NODE_ENV=production` i na bazie nieoznaczonej jako testowa
   * (`server/tryb-testowy/index.js: sprawdzStart`). Baza, dokumenty i
   * skrzynka trybu testowego leza w `dane-testowe/` (poza `publiczne/`,
   * w `.gitignore`) — produkcyjna `WSPOLNA_BAZA` nie jest wtedy otwierana.
   */
  TRYB_TESTOWY: flaga('PSA_TRYB_TESTOWY', false),
  NODE_ENV: tekst('NODE_ENV', null),
  BAZA_TESTOWA: sciezka('PSA_BAZA_TESTOWA', './dane-testowe/kancelaria-testowa.db'),
  KATALOG_TESTOWY: sciezka('PSA_KATALOG_TESTOWY', './dane-testowe'),
};

if (konfiguracja.TRYB_TESTOWY) {
  konfiguracja.WSPOLNA_BAZA_PRODUKCYJNA = konfiguracja.WSPOLNA_BAZA;
  konfiguracja.WSPOLNA_BAZA = konfiguracja.BAZA_TESTOWA;
  konfiguracja.KATALOG_DOKUMENTOW = path.join(konfiguracja.KATALOG_TESTOWY, 'dokumenty');
  // Tryb testowy sluzy przejsciu takze przeplywow portalu.
  konfiguracja.PORTAL_WLACZONY = true;
}
konfiguracja.KATALOG_SKRZYNKI = path.join(konfiguracja.KATALOG_TESTOWY, 'skrzynka');

module.exports = konfiguracja;
// Eksportowana osobno do testow jednostkowych (Z-002) - reszta modulu zalezy
// od `process.env` odczytanego raz przy pierwszym `require`, ale `sciezka()`
// sama w sobie jest funkcja czysta.
module.exports.sciezka = sciezka;
