#!/usr/bin/env node
'use strict';

/**
 * `npm run test:link -- <e-mail>` — link logowania dla istniejacego konta
 * w bazie testowej (T2, D-074). Bez wysylki e-maila.
 *
 * Aplikacja nie ma logowania linkiem: jedynym linkiem z e-maila jest LINK
 * AKTYWACYJNY konta portalu. Dla konta nieaktywnego drukujemy wiec ten sam
 * link, ktory poszedlby w zaproszeniu (biezacy token, a gdy wygasl — nowy,
 * tym samym generatorem co `zaproszenia.js`). Konto aktywne loguje sie
 * haslem — drukujemy adres ekranu logowania (tam lista kont testowych).
 *
 * Dziala WYLACZNIE na bazie oznaczonej jako testowa.
 */

process.env.PSA_TRYB_TESTOWY = '1';

const konfiguracja = require('../server/konfiguracja');
const trybTestowy = require('../server/tryb-testowy');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Użycie: npm run test:link -- <e-mail>');
  process.exit(1);
}
try {
  trybTestowy.sprawdzStart();
} catch (e) {
  console.error(`[test:link] ${e.message}`);
  process.exit(1);
}

const { db } = require('../server/baza');
const migracje = require('../server/migracje');
const { nowyToken } = require('../server/logika/zaproszenia');

migracje.uruchom(db());
const adresKancelarii = new URL('/', konfiguracja.URL_PORTALU).toString();

const pracownik = db().prepare('SELECT * FROM psa_uzytkownicy WHERE lower(email) = ?').get(email);
const konto = db().prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(email);

if (!pracownik && !konto) {
  console.error(`[test:link] Nie ma konta ${email} w bazie testowej.`);
  process.exit(1);
}
if (pracownik) {
  console.log(`Konto kancelarii (${pracownik.rola}) — logowanie hasłem: ${adresKancelarii}`);
  console.log(`Hasło kont testowych: ${trybTestowy.HASLO_TESTOWE} (albo lista kont na ekranie logowania).`);
}
if (konto) {
  if (konto.aktywne) {
    console.log(`Konto portalu (${konto.rola}) jest aktywne — logowanie hasłem: ${konfiguracja.URL_PORTALU}`);
    console.log(`Hasło kont testowych: ${trybTestowy.HASLO_TESTOWE} (albo lista kont na ekranie logowania).`);
  } else {
    let token = konto.token_aktywacji;
    if (!token || !konto.token_wygasa || new Date(konto.token_wygasa) < new Date()) {
      const nowy = nowyToken();
      token = nowy.token;
      db().prepare('UPDATE psa_konta SET token_aktywacji = ?, token_wygasa = ? WHERE id = ?')
        .run(nowy.token, nowy.tokenWygasa, konto.id);
    }
    console.log(`${konfiguracja.URL_PORTALU}#/aktywuj/${token}`);
  }
}
