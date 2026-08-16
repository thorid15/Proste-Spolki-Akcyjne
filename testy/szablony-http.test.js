'use strict';

/**
 * Trasy wzorów pism (blok A1 sesji 8): lista i podgląd wzorów `.docx`
 * czytanych z `wzory/`.
 *
 * Sedno: te trasy tylko CZYTAJĄ katalog. Nie ma tu edycji treści — wzór
 * zmienia się podmieniając plik w `wzory/`, nie przez API.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-szablony-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-szablony-dokumenty');
process.env.ADMIN_EMAIL = 'admin-szablony@example.pl';

const app = require('../serwer');
const { db } = require('../server/baza');
const auth = require('../server/trasy/auth');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoAdmina;
let ciastkoPracownika;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe =
    typeof odp.headers.getSetCookie === 'function'
      ? odp.headers.getSetCookie()
      : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zaloguj(email, haslo) {
  const odp = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo }),
  });
  assert.equal(odp.status, 200, `logowanie ${email} nie powiodło się`);
  return ciasteczkoZOdpowiedzi(odp);
}

async function zapytaj(ciastko, metoda, sciezka, cialo) {
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

  await auth.zapewnijAdmina(db(), process.env.ADMIN_EMAIL);
  const hashAdmina = await hasla.hashuj('HasloAdmina123');
  db()
    .prepare('UPDATE psa_uzytkownicy SET hash_hasla = ? WHERE email = ?')
    .run(hashAdmina, process.env.ADMIN_EMAIL);
  ciastkoAdmina = await zaloguj(process.env.ADMIN_EMAIL, 'HasloAdmina123');

  const hashPracownika = await hasla.hashuj('HasloPracownika123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Pracownik', 'pracownik-szablony@example.pl', ?, 'pracownik', 1, ?)`
    )
    .run(hashPracownika, new Date().toISOString());
  ciastkoPracownika = await zaloguj('pracownik-szablony@example.pl', 'HasloPracownika123');
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('lista wzorow z katalogu wzory/ — dziesiec plikow, wszystkie poprawne', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony');
  assert.equal(status, 200);
  assert.equal(dane.szablony.length, 10);
  const umowa = dane.szablony.find((s) => s.kod === '01');
  assert.ok(umowa, 'wzor 01 (umowa o prowadzenie rejestru) jest na liscie');
  assert.ok(umowa.proste.includes('spolka_firma'));
  assert.ok(umowa.poprawny, 'wzor nie ma niezamknietych sekcji ani rozbitych pol');
  for (const s of dane.szablony) {
    assert.equal(s.niezamkniete.length, 0, `wzor ${s.kod} ma niezamkniete sekcje`);
    assert.equal(s.ostrzezenia.length, 0, `wzor ${s.kod} ma rozbite pola`);
  }
});

test('dostep do wzorow jest zastrzezony dla administratora', async () => {
  const [status] = await zapytaj(ciastkoPracownika, 'GET', '/api/psa/szablony');
  assert.equal(status, 403, 'pracownik nie zaglada do redakcji pism o skutkach prawnych');
});

test('szczegoly wzoru nieznanego kodu daja 404', async () => {
  const [status] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/99');
  assert.equal(status, 404);
});

test('szczegoly wzoru pokazuja klucze i sekcje', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/07');
  assert.equal(status, 200);
  assert.ok(dane.szablon.sekcje.includes('pozycje'));
  assert.ok(dane.szablon.hashKrotki.length > 0);
});

test('podglad na danych probnych renderuje bez brakow ani bledow', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/01/podglad');
  assert.equal(status, 200);
  assert.equal(dane.na_danych_probnych, true);
  assert.deepEqual(dane.brakujace, []);
  assert.deepEqual(dane.bledy, []);
  assert.match(dane.tekst, /CHARLIE UNICORN AI/, 'dane probne podstawione w tekscie');
  assert.ok(!dane.tekst.includes('{{'), 'brak niepodstawionych pol w podgladzie');
});

test('podglad wszystkich dziesieciu wzorow jest bez brakow', async () => {
  const [, lista] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony');
  for (const { kod } of lista.szablony) {
    const [status, dane] = await zapytaj(ciastkoAdmina, 'POST', `/api/psa/szablony/${kod}/podglad`);
    assert.equal(status, 200, `wzor ${kod}`);
    assert.deepEqual(dane.brakujace, [], `wzor ${kod} ma braki`);
  }
});

test('podglad nieznanego kodu daje 404', async () => {
  const [status] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/99/podglad');
  assert.equal(status, 404);
});

test('podglad.docx zwraca prawdziwy plik Worda', async () => {
  const odp = await fetch(`${baza}/api/psa/szablony/01/podglad.docx`, {
    headers: { Cookie: ciastkoAdmina },
  });
  assert.equal(odp.status, 200);
  assert.equal(
    odp.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  const bufor = Buffer.from(await odp.arrayBuffer());
  // Sygnatura lokalnego naglowka ZIP - potwierdza, ze to poprawne archiwum,
  // nie np. strona bledu wyslana z zlym naglowkiem.
  assert.equal(bufor.readUInt32LE(0), 0x04034b50);
});

test('dostepne-klucze: pelny katalog, niezalezny od tego, co uzywa ktory wzor', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/dostepne-klucze');
  assert.equal(status, 200);
  assert.ok(dane.proste.includes('spolka_firma'));
  assert.ok(dane.sekcje.includes('pozycje'));
  assert.ok(!dane.proste.includes('pozycje'), 'sekcje i proste klucze sie nie mieszaja');
});

test('nie ma trasy edytujacej ani usuwajacej wzor — tresc zmienia sie podmiana pliku', async () => {
  const [put] = await zapytaj(ciastkoAdmina, 'PUT', '/api/psa/szablony/01', { tresc: 'x' });
  const [del] = await zapytaj(ciastkoAdmina, 'DELETE', '/api/psa/szablony/01');
  const [wersje] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/01/wersje', { tresc: 'x' });
  assert.ok(put === 404 || put === 405);
  assert.ok(del === 404 || del === 405);
  assert.ok(wersje === 404 || wersje === 405);
});
