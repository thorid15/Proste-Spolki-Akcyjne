'use strict';

/**
 * Tryb testowy WYLACZONY (T6, D-074): trasy testowe nie istnieja (404),
 * atrapy niedostepne, ekrany i odpowiedzi bez zmian.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-tryb-wylaczony.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-tryb-wylaczony-dok');
delete process.env.PSA_TRYB_TESTOWY;
process.env.PORTAL_WLACZONY = 'true';
// Bez sieci: KRS „niedostepny” — formularz i tak przyjmuje zgloszenie.
process.env.KRS_API_URL = 'http://127.0.0.1:9/krs';

const app = require('../serwer');
const konfiguracja = require('../server/konfiguracja');
const poczta = require('../server/poczta');

let serwer;
let ADRES;

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('T6: poza trybem testowym trasy /test/* to 404, atrapy niedostępne', async () => {
  assert.equal(konfiguracja.TRYB_TESTOWY, false);
  for (const adres of ['/test', '/test/skrzynka', '/test/konfiguracja.js', '/test/pasek.js', '/test/tpay/kasa/TR-1']) {
    assert.equal((await fetch(`${ADRES}${adres}`)).status, 404, adres);
  }
  const tpay = await fetch(`${ADRES}/test/tpay/api/transactions`, { method: 'POST' });
  assert.equal(tpay.status, 404);
  const data = await fetch(`${ADRES}/test/data`, { method: 'POST' });
  assert.equal(data.status, 404);
});

test('T6: poza trybem testowym strony bez pasków i bez stanu trybu', async () => {
  for (const adres of ['/', '/portal.html', '/portal']) {
    const html = await (await fetch(`${ADRES}${adres}`)).text();
    assert.doesNotMatch(html, /\/test\//, adres);
  }
});

test('T1: bez trybu testowego i bez SMTP wysyłka kończy się widocznym błędem, nie cichym sukcesem', async () => {
  const wynik = await poczta.wyslij({ do: 'ktos@example.com', temat: 'x', html: '<p>x</p>' });
  assert.equal(wynik.wyslano, false);
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.powod, /nie jest skonfigurowana/);
});

test('T1: skrzynka testowa poza trybem testowym jest odrzucana', async () => {
  const przed = konfiguracja.POCZTA_TRANSPORT;
  konfiguracja.POCZTA_TRANSPORT = 'skrzynka-testowa';
  try {
    const wynik = await poczta.wyslij({ do: 'ktos@example.com', temat: 'x', html: '<p>x</p>' });
    assert.equal(wynik.wyslano, false);
    assert.match(wynik.powod, /wyłącznie w trybie testowym/);
  } finally {
    konfiguracja.POCZTA_TRANSPORT = przed;
  }
});

test('T2: poza trybem testowym odpowiedź formularza zgłoszenia bez pola link_testowy', async () => {
  const odp = await fetch(`${ADRES}/api/psa/portal/zgloszenia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'klient@example.com', krs: '0000990003' }),
  });
  const dane = await odp.json();
  assert.equal('link_testowy' in dane, false);
});
