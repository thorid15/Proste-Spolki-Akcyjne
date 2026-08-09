'use strict';

/**
 * Sprint 6 (interfejs), faza 2 — trasa `GET /api/psa/spolki/:id/os-akcji` przez HTTP.
 * Sama logika projekcji ma testy jednostkowe w `os-akcji.test.js`; tu tylko
 * autoryzacja i kontrakt odpowiedzi.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-os-akcji-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoSesji = '';

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Test', 'test-os-akcji@example-test.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());

  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-os-akcji@example-test.pl', haslo: 'HasloTestowe123' }),
  });
  if (odpLogin.status !== 200) throw new Error(`Logowanie testowe nie powiodło się: ${odpLogin.status}`);
  ciastkoSesji = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

async function zapytaj(metoda, sciezka, cialo, naglowki = {}) {
  const opcje = { method: metoda, headers: { ...naglowki } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const dane = await odp.json();
  return [odp.status, dane];
}

test('GET /:id/os-akcji bez sesji zwraca 401', async () => {
  const [status] = await zapytaj('GET', '/api/psa/spolki/1/os-akcji');
  assert.equal(status, 401);
});

test('GET /:id/os-akcji dla nieistniejącej spółki zwraca 404', async () => {
  const [status, dane] = await zapytaj('GET', '/api/psa/spolki/999999/os-akcji', undefined, { Cookie: ciastkoSesji });
  assert.equal(status, 404);
  assert.ok(dane.blad);
});

test('GET /:id/os-akcji zwraca emisje, pasma, obciążenia i zdarzenia', async () => {
  const [, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', { nazwa: 'Oś Akcji Testowa P.S.A.', krs: '0000999888' }, { Cookie: ciastkoSesji });
  const spolkaId = spolkaOdp.spolka.id;

  const [, osobaOdp] = await zapytaj(
    'POST',
    '/api/psa/osoby',
    { typ: 'fizyczna', nazwisko: 'Testowy', imie: 'Adam', data_urodzenia: '1990-01-01', email: 'adam.testowy@example.pl', aml_status: 'wykonane' },
    { Cookie: ciastkoSesji }
  );

  const [, emisjaOdp] = await zapytaj(
    'POST',
    `/api/psa/spolki/${spolkaId}/zdarzenia`,
    { typ: 'emisja', data_zdarzenia: '2026-01-10', dane: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-10' } },
    { Cookie: ciastkoSesji }
  );
  await zapytaj(
    'POST',
    `/api/psa/spolki/${spolkaId}/zdarzenia`,
    { typ: 'objecie', data_zdarzenia: '2026-01-12', dane: { emisja_zdarzenie_id: emisjaOdp.zdarzenie.id, pozycje: [{ osoba_id: osobaOdp.osoba.id, ilosc: 10 }] } },
    { Cookie: ciastkoSesji }
  );

  const [status, dane] = await zapytaj('GET', `/api/psa/spolki/${spolkaId}/os-akcji`, undefined, { Cookie: ciastkoSesji });
  assert.equal(status, 200);
  assert.equal(dane.spolka.nazwa, 'Oś Akcji Testowa P.S.A.');
  assert.equal(dane.emisje.length, 1);
  assert.equal(dane.zdarzenia.length, 2);
  assert.equal(dane.obciazenia.length, 0);

  const otwarte = dane.pasma.filter((p) => p.data_do === null);
  assert.equal(otwarte.length, 1);
  assert.equal(otwarte[0].kategoria, 'akcjonariusz');
  assert.equal(otwarte[0].osoba.oznaczenie, 'Testowy Adam');
});
