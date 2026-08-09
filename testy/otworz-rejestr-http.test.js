'use strict';

/**
 * Sesja 6 (interfejs), faza 3 — trasa `POST /api/psa/spolki/:id/otworz-rejestr`
 * (krok 4 kreatora rejestracji spółki). Logika atomowości ma testy jednostkowe
 * w `kreator-rejestracji.test.js`; tu tylko autoryzacja i kontrakt HTTP.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-otworz-rejestr-http.db');
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
       VALUES ('Test', 'test-otworz-rejestr@example-test.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());

  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-otworz-rejestr@example-test.pl', haslo: 'HasloTestowe123' }),
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

test('POST /:id/otworz-rejestr bez sesji zwraca 401', async () => {
  const [status] = await zapytaj('POST', '/api/psa/spolki/1/otworz-rejestr', { zdarzenia: [] });
  assert.equal(status, 401);
});

test('POST /:id/otworz-rejestr dla nieistniejącej spółki zwraca 404', async () => {
  const [status] = await zapytaj('POST', '/api/psa/spolki/999999/otworz-rejestr', { zdarzenia: [{ typ: 'emisja', data_zdarzenia: '2026-01-01', dane: {} }] }, { Cookie: ciastkoSesji });
  assert.equal(status, 404);
});

test('POST /:id/otworz-rejestr bez zdarzeń zwraca 400', async () => {
  const [, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', { nazwa: 'Otwarcie Testowa P.S.A.', krs: '0000777666' }, { Cookie: ciastkoSesji });
  const spolkaId = spolkaOdp.spolka.id;

  const [status, dane] = await zapytaj('POST', `/api/psa/spolki/${spolkaId}/otworz-rejestr`, { zdarzenia: [] }, { Cookie: ciastkoSesji });
  assert.equal(status, 400);
  assert.ok(dane.blad);
});

test('POST /:id/otworz-rejestr zapisuje emisję + objęcie atomowo w jednym wywołaniu (odwołanie przez klucz_tymczasowy)', async () => {
  const [, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', { nazwa: 'Otwarcie Udane P.S.A.', krs: '0000777777' }, { Cookie: ciastkoSesji });
  const spolkaId = spolkaOdp.spolka.id;

  const [, osobaOdp] = await zapytaj(
    'POST',
    '/api/psa/osoby',
    { typ: 'fizyczna', nazwisko: 'Testowy', imie: 'Adam', data_urodzenia: '1990-01-01', email: 'adam.otworz@example.pl', aml_status: 'wykonane' },
    { Cookie: ciastkoSesji }
  );

  const [status, dane] = await zapytaj(
    'POST',
    `/api/psa/spolki/${spolkaId}/otworz-rejestr`,
    {
      zdarzenia: [
        {
          typ: 'emisja',
          klucz_tymczasowy: 'emisja-A',
          data_zdarzenia: '2026-01-10',
          dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' },
        },
        {
          typ: 'objecie',
          data_zdarzenia: '2026-01-10',
          dane: {
            emisja_zdarzenie_id: { __odwolanie_do_partii: 'emisja-A' },
            pozycje: [{ osoba_id: osobaOdp.osoba.id, ilosc: 100 }],
          },
        },
      ],
    },
    { Cookie: ciastkoSesji }
  );

  assert.equal(status, 201);
  assert.deepEqual(dane.zdarzenia.map((z) => z.typ), ['emisja', 'objecie']);

  const [, spolkaBogata] = await zapytaj('GET', `/api/psa/spolki/${spolkaId}`, undefined, { Cookie: ciastkoSesji });
  assert.equal(spolkaBogata.razem_akcji, 100);
});

test('POST /:id/otworz-rejestr: nieudane drugie zdarzenie cofa całą partię, łącznie z pierwszym', async () => {
  const [, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', { nazwa: 'Otwarcie Nieudane P.S.A.', krs: '0000777888' }, { Cookie: ciastkoSesji });
  const spolkaId = spolkaOdp.spolka.id;

  const [status, dane] = await zapytaj(
    'POST',
    `/api/psa/spolki/${spolkaId}/otworz-rejestr`,
    {
      zdarzenia: [
        {
          typ: 'emisja',
          klucz_tymczasowy: 'emisja-A',
          data_zdarzenia: '2026-01-10',
          dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' },
        },
        {
          typ: 'objecie',
          data_zdarzenia: '2026-01-10',
          // Odwolanie do nieistniejacego klucza - cala partia ma sie cofnac.
          dane: {
            emisja_zdarzenie_id: { __odwolanie_do_partii: 'literowka' },
            pozycje: [{ osoba_id: 999999, ilosc: 100 }],
          },
        },
      ],
    },
    { Cookie: ciastkoSesji }
  );

  assert.equal(status, 422);
  assert.ok(dane.blad);
  const zdarzenia = db().prepare('SELECT COUNT(*) AS n FROM psa_zdarzenia WHERE spolka_id = ?').get(spolkaId);
  assert.equal(zdarzenia.n, 0);
});
