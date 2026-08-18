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

function sciezka(nazwa, domyslna) {
  return path.resolve(KATALOG_GLOWNY, tekst(nazwa, domyslna));
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

    // Atomowe - na potrzeby wzorow .docx (PLACEHOLDERY-PSA.md, sekcja KANCELARIA).
    kancelaria_ulica: tekst('KANCELARIA_ULICA', ''),
    kancelaria_kod: tekst('KANCELARIA_KOD', ''),
    kancelaria_miasto: tekst('KANCELARIA_MIASTO', ''),
    kancelaria_miasto_miejscownik: tekst('KANCELARIA_MIASTO_MIEJSCOWNIK', ''),
    kancelaria_nip: tekst('KANCELARIA_NIP', ''),
    kancelaria_regon: tekst('KANCELARIA_REGON', ''),
    notariusz_mianownik: tekst('NOTARIUSZ_MIANOWNIK', 'Łukasz Kozon'),
    notariusz_dopelniacz: tekst('NOTARIUSZ_DOPELNIACZ', ''),
    notariusz_narzednik: tekst('NOTARIUSZ_NARZEDNIK', ''),
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
