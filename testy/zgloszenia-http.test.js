'use strict';

/**
 * Etap 3A: zgloszenia wstepne portalu.
 *   - `POST /api/psa/portal/zgloszenia` — publiczny formularz, bez sesji.
 *   - `GET/POST /api/psa/zgloszenia/...` — kolejka po stronie kancelarii.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-zgloszenia-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoPracownik;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo, ciastko = ciastkoPracownik) {
  const opcje = { method: metoda, headers: {} };
  if (ciastko) opcje.headers.Cookie = ciastko;
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
       VALUES ('Notariusz', 'notariusz-zgloszenia@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-zgloszenia@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

test('POST /api/psa/portal/zgloszenia: publiczne, bez sesji, wymaga poprawnego e-maila', async () => {
  const [stBrak] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { opis: 'Chcę przenieść rejestr' }, null);
  assert.equal(stBrak, 400);

  const [stZle] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'nie-email' }, null);
  assert.equal(stZle, 400);

  const [stOk, ok] = await zapytaj(
    'POST',
    '/api/psa/portal/zgloszenia',
    { email: 'Prospect@Example.pl', nazwa_spolki: 'Nowa Nadzieja P.S.A.', opis: 'Zakładamy PSA, szukamy podmiotu prowadzącego rejestr.' },
    null
  );
  assert.equal(stOk, 201);
  assert.equal(ok.ok, true);

  const [, lista] = await zapytaj('GET', '/api/psa/zgloszenia');
  const wpis = lista.zgloszenia.find((z) => z.nazwa_spolki === 'Nowa Nadzieja P.S.A.');
  assert.ok(wpis, 'zgloszenie trafilo do kolejki kancelarii');
  assert.equal(wpis.email, 'prospect@example.pl', 'e-mail znormalizowany do malych liter');
  assert.equal(wpis.status, 'nowe');
});

test('POST /api/psa/portal/zgloszenia: NIE zaklada zadnego konta portalowego ani spolki', async () => {
  const przedKonta = db().prepare('SELECT COUNT(*) AS n FROM psa_konta').get().n;
  const przedSpolki = db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n;

  await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'lead-bez-konta@example.pl' }, null);

  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_konta').get().n, przedKonta);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n, przedSpolki);
});

test('GET /api/psa/zgloszenia: wymaga zalogowanego pracownika', async () => {
  const [status] = await zapytaj('GET', '/api/psa/zgloszenia', undefined, null);
  assert.equal(status, 401);
});

test('POST /api/psa/zgloszenia/:id/odrzuc: zmienia status, zapisuje autora, blokuje powtorne odrzucenie', async () => {
  const [, zgloszenieOdp] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'do-odrzucenia@example.pl' }, null);
  assert.equal(zgloszenieOdp.ok, true);
  const [, lista] = await zapytaj('GET', '/api/psa/zgloszenia');
  const id = lista.zgloszenia.find((z) => z.email === 'do-odrzucenia@example.pl').id;

  const [status, wynik] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/odrzuc`, { notatka: 'Poza obszarem działania kancelarii.' });
  assert.equal(status, 200);
  assert.equal(wynik.zgloszenie.status, 'odrzucone');
  assert.equal(wynik.zgloszenie.obsluzone_przez, 'Notariusz');
  assert.ok(wynik.zgloszenie.obsluzone_kiedy);

  const [stPonownie] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/odrzuc`, {});
  assert.equal(stPonownie, 400, 'nie mozna odrzucic zgloszenia drugi raz');
});
