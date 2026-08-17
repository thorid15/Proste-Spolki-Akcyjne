'use strict';

/**
 * Etap 3C: wniosek klienta o prowadzenie rejestru - dane spolki i reprezentanta.
 *   - `GET/PUT /api/psa/portal/wniosek` — wlasny wniosek konta 'wnioskodawca'.
 *   - `GET /api/psa/portal/wniosek/z-krs/:numer` — import z KRS, jak w kreatorze.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-wniosek-http.db');
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

async function zapytaj(metoda, sciezka, cialo, ciastko) {
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
       VALUES ('Notariusz', 'notariusz-wniosek@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-wniosek@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

/** Zaklada aktywne konto "wnioskodawca" WPROST w bazie (pomija limiter zgloszen). */
async function kontoWnioskodawcy(email) {
  const hash = await hasla.hashuj('HasloWnioskodawcy123');
  const wynik = db()
    .prepare(
      `INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono)
       VALUES (?, ?, 'wnioskodawca', 1, ?)`
    )
    .run(email, hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo: 'HasloWnioskodawcy123' }),
  });
  return { kontoId: Number(wynik.lastInsertRowid), ciastko: ciasteczkoZOdpowiedzi(odpLogin) };
}

test('GET /api/psa/portal/wniosek: wymaga sesji portalowej', async () => {
  const [status] = await zapytaj('GET', '/api/psa/portal/wniosek');
  assert.equal(status, 401);
});

test('GET /api/psa/portal/wniosek: zaklada pusty wniosek przy pierwszym uzyciu, status w_przygotowaniu', async () => {
  const { ciastko } = await kontoWnioskodawcy('nowy-wnioskodawca@example.pl');

  const [status, wynik] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'w_przygotowaniu');
  assert.equal(wynik.wniosek.nazwa, null);
  assert.equal(wynik.wniosek.forma_prawna, 'PROSTA SPÓŁKA AKCYJNA');

  const [, wynikPonownie] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(wynikPonownie.wniosek.id, wynik.wniosek.id, 'drugie wywolanie NIE zaklada drugiego wniosku');
});

test('PUT /api/psa/portal/wniosek: zapisuje czesciowy postep, waliduje wylacznie format', async () => {
  const { ciastko } = await kontoWnioskodawcy('edytujacy-wniosek@example.pl');

  const [stZlyKrs] = await zapytaj('PUT', '/api/psa/portal/wniosek', { krs: '123' }, ciastko);
  assert.equal(stZlyKrs, 400);

  const [stZlaData] = await zapytaj('PUT', '/api/psa/portal/wniosek', { data_zawarcia_umowy_spolki: '21.06.2024' }, ciastko);
  assert.equal(stZlaData, 400);

  const [stOk, ok] = await zapytaj(
    'PUT',
    '/api/psa/portal/wniosek',
    { nazwa: 'Testowa Spółka P.S.A.', miejscowosc: 'Gdańsk' },
    ciastko
  );
  assert.equal(stOk, 200);
  assert.equal(ok.wniosek.nazwa, 'Testowa Spółka P.S.A.');
  assert.equal(ok.wniosek.miejscowosc, 'Gdańsk');
  assert.ok(ok.wniosek.zaktualizowano);

  // Drugi zapis NIE zaciera pol z pierwszego, ktorych tu nie podano.
  const [, dalej] = await zapytaj('PUT', '/api/psa/portal/wniosek', { ulica: 'Długa' }, ciastko);
  assert.equal(dalej.wniosek.nazwa, 'Testowa Spółka P.S.A.');
  assert.equal(dalej.wniosek.ulica, 'Długa');
});

test('PUT /api/psa/portal/wniosek: odmawia edycji po zlozeniu wniosku', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('zlozony-wniosek@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko); // zaloz wniosek
  db().prepare(`UPDATE psa_wnioski SET status = 'zlozony' WHERE konto_id = ?`).run(kontoId);

  const [status, wynik] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Zmiana po złożeniu' }, ciastko);
  assert.equal(status, 400);
  assert.match(wynik.blad, /zlozony/);
});

test('GET /api/psa/portal/wniosek: inne role (spolka/akcjonariusz) nie maja dostepu', async () => {
  const osobaId = db()
    .prepare(`INSERT INTO psa_osoby (typ, nazwisko, imie, aml_status, utworzono) VALUES ('fizyczna', 'Testowy', 'Jan', 'wykonane', ?)`)
    .run(new Date().toISOString()).lastInsertRowid;
  const hash = await hasla.hashuj('HasloAkcjonariusza123');
  db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES (?, ?, 'akcjonariusz', ?, 1, ?)`)
    .run('akcjonariusz-bez-wniosku@example.pl', hash, osobaId, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'akcjonariusz-bez-wniosku@example.pl', haslo: 'HasloAkcjonariusza123' }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(odpLogin);

  const [status] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(status, 403);
});

test('GET /api/psa/portal/wniosek/z-krs/:numer: zly numer nie rzuca bledu, zwraca komunikat', async () => {
  const { ciastko } = await kontoWnioskodawcy('krs-test@example.pl');
  const [status, wynik] = await zapytaj('GET', '/api/psa/portal/wniosek/z-krs/123', undefined, ciastko);
  assert.equal(status, 200);
  assert.equal(wynik.znaleziono, false);
  assert.ok(wynik.komunikat);
});
