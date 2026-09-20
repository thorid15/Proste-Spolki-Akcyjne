'use strict';

/**
 * Naprawa Z-253: kontrola sygnatury tresci pliku na trasie
 * `POST /api/psa/spolki/:id/umowa-zalacznik` (wczesniej sprawdzano wylacznie
 * rozszerzenie z nazwy pliku, tak jak dawniej `/api/psa/osoby/:id/aml-skany`
 * — patrz testy/osoby-http.test.js, ten sam scenariusz).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-spolki-uploady-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastko;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { Cookie: ciastko } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  return [odp.status, await odp.json()];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-spolki-upload@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-spolki-upload@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastko = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

let licznik = 0;
function sufiks() {
  licznik += 1;
  return String(licznik).padStart(4, '0');
}

test('Z-253: POST /:id/umowa-zalacznik przyjmuje prawdziwy PDF', async () => {
  const [, spolka] = await zapytaj('POST', '/api/psa/spolki', { nazwa: `Zalacznik OK ${sufiks()}` });

  const formularz = new FormData();
  formularz.append('plik', new Blob(['%PDF-1.4\ntresc umowy'], { type: 'application/pdf' }), 'umowa.pdf');
  const odp = await fetch(`${baza}/api/psa/spolki/${spolka.spolka.id}/umowa-zalacznik`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularz,
  });
  assert.equal(odp.status, 201);
});

test('Z-253: POST /:id/umowa-zalacznik odrzuca plik nazwany „.pdf", ktorego tresc jest HTML-em', async () => {
  const [, spolka] = await zapytaj('POST', '/api/psa/spolki', { nazwa: `Zalacznik Falszywy ${sufiks()}` });

  const podrobiony = new FormData();
  podrobiony.append('plik', new Blob(['<html><script>alert(document.cookie)</script></html>'], { type: 'application/pdf' }), 'umowa.pdf');
  const odp = await fetch(`${baza}/api/psa/spolki/${spolka.spolka.id}/umowa-zalacznik`, {
    method: 'POST', headers: { Cookie: ciastko }, body: podrobiony,
  });
  assert.equal(odp.status, 400);

  const odpPobranie = await fetch(`${baza}/api/psa/spolki/${spolka.spolka.id}/umowa-zalacznik`, { headers: { Cookie: ciastko } });
  assert.equal(odpPobranie.status, 404, 'odrzucony plik nie zostaje zapisany jako zalacznik spolki');
});
