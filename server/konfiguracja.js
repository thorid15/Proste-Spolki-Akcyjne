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
 * `data_wpisu` na zawiadomieniach o wpisie musi byc czasem LOKALNYM
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
      `strefie, a data i godzina wpisu na zawiadomieniach musza byc czasem lokalnym kancelarii. Wykryto ` +
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
  WSPOLNA_BAZA: sciezka('WSPOLNA_BAZA', './dane/kancelaria.db'),
  KATALOG_DOKUMENTOW: sciezka('KATALOG_DOKUMENTOW', './dokumenty'),
  ADMIN_EMAIL: tekst('ADMIN_EMAIL', null),
  SESJA_SEKRET: tekst('SESJA_SEKRET', null),
  KRS_API_URL: tekst('KRS_API_URL', 'https://api-krs.ms.gov.pl/api/krs'),
  PORTAL_WLACZONY: flaga('PORTAL_WLACZONY', false),
  /**
   * Ekran `/podglad` to katalog komponentow systemu wizualnego - narzedzie
   * DEWELOPERSKIE, nie ekran pracy notariusza (nie ma zadnej funkcji poza
   * pokazaniem, jak wygladaja przyciski, pola i tabele). Domyslnie
   * WYLACZONY: nie pojawia sie w menu i trasa oddaje "nie ma takiej strony".
   * Wlacza sie go swiadomie przy pracach nad interfejsem.
   */
  PODGLAD_SYSTEMU: flaga('PODGLAD_SYSTEMU', false),
  // Adres portalu klienta w mailach zapraszajacych (etap 3B) - link
  // aktywacyjny musi wskazywac na PUBLICZNY adres, nie na "localhost".
  URL_PORTALU: tekst('URL_PORTALU', `http://localhost:${liczba('PORT', 3005)}/portal.html`),
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
    // Adres, z ktorego klient wraca po zaplacie. Musi byc PUBLICZNY.
    url_powrotu: tekst('TPAY_URL_POWROTU', null),
  },
  /**
   * Naglowek dokumentow - odpowiednik `rdzen_kancelaria` z mastera.
   *
   * Pola ponizej `email`/`telefon` sa ATOMOWE (blok A2 sesji 8) - wzory z
   * `wzory/` odwoluja sie do `kancelaria_ulica`, `kancelaria_kod` itd. z
   * osobna, bo zdanie "ulica X, 00-000 Miasto" sklada sie inaczej w kazdym
   * pismie. Pola `adres`/`miejscowosc` zostaja NIETKNIETE - czyta je istniejacy
   * automat zawiadomien (logika/dokumenty-tresc.js) i raporty; dublowanie na
   * dwa ksztalty jest tansze niz przepisywanie dzialajacego kodu.
   */
  KANCELARIA: {
    nazwa: tekst('KANCELARIA_NAZWA', 'Kancelaria Notarialna Łukasz Kozon'),
    adres: tekst('KANCELARIA_ADRES', ''),
    miejscowosc: tekst('KANCELARIA_MIEJSCOWOSC', ''),
    telefon: tekst('KANCELARIA_TELEFON', ''),
    email: tekst('KANCELARIA_EMAIL', ''),

    // Strona kancelarii - stopka aplikacji i portalu klienta. `www_psa` to
    // adres zakladki "Proste Spolki Akcyjne" (informacje o prowadzeniu
    // rejestru). Gdy nie podano dokladnego adresu zakladki, odsylamy na
    // strone glowna - lepiej niz link, ktory konczy sie bledem 404.
    www: tekst('KANCELARIA_WWW', 'https://notariusz.gdansk.pl'),
    www_psa: tekst('KANCELARIA_WWW_PSA', tekst('KANCELARIA_WWW', 'https://notariusz.gdansk.pl')),

    // Atomowe - na potrzeby wzorow .docx (PLACEHOLDERY-PSA.md, sekcja KANCELARIA).
    // Wszystkie w MIANOWNIKU: pisma opisuja dane etykieta ("notariusz: ...",
    // "siedziba: ..."), wiec zadna forma odmieniona nie jest juz potrzebna.
    kancelaria_ulica: tekst('KANCELARIA_ULICA', ''),
    kancelaria_kod: tekst('KANCELARIA_KOD', ''),
    kancelaria_miasto: tekst('KANCELARIA_MIASTO', ''),
    kancelaria_nip: tekst('KANCELARIA_NIP', ''),
    kancelaria_regon: tekst('KANCELARIA_REGON', ''),
    notariusz_mianownik: tekst('NOTARIUSZ_MIANOWNIK', 'Łukasz Kozon'),
    podpisujacy_funkcja: tekst('PODPISUJACY_FUNKCJA', 'Notariusz'),
    podpisujacy_mianownik: tekst('PODPISUJACY_MIANOWNIK', tekst('NOTARIUSZ_MIANOWNIK', 'Łukasz Kozon')),

    // Etap 4.7: rejestr prowadzi KANCELARIA (art. 300(31) § 1 KSH), nie izba
    // notarialna - znak izby na nagłówku raportu mógłby sugerować, że
    // dokument pochodzi od samorządu. Domyślnie WYŁĄCZONY; do rozstrzygnięcia
    // z notariuszem, czy i którą izbę pokazywać.
    pokaz_znak_izby: flaga('POKAZ_ZNAK_IZBY', false),
    nazwa_izby: tekst('NAZWA_IZBY', 'Izba Notarialna'),
  },
};

module.exports = konfiguracja;
// Eksportowana osobno do testow jednostkowych (Z-002) - reszta modulu zalezy
// od `process.env` odczytanego raz przy pierwszym `require`, ale `sciezka()`
// sama w sobie jest funkcja czysta.
module.exports.sciezka = sciezka;
