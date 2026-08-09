'use strict';

/**
 * Trasy redakcji szablonów (faza 4): lista, historia wersji, podgląd na
 * danych próbnych, zakładanie kolejnej wersji, przywracanie wcześniejszej.
 *
 * Sedno: szablonu NIE DA SIĘ nadpisać ani usunąć przez API - redakcja zawsze
 * zakłada nową wersję, bo poprzednia jest podstawą pism już wydanych.
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

test('lista szablonow zasianych przy starcie serwera', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony');
  assert.equal(status, 200);
  assert.ok(dane.szablony.length >= 13, 'wszystkie szablony wbudowane zasiane');
  const umowa = dane.szablony.find((s) => s.kod === 'umowa_o_prowadzenie');
  assert.equal(umowa.wersja, 1);
  assert.ok(umowa.klucze.proste.includes('spolka_nazwa'));
});

test('redakcja szablonow jest zastrzezona dla administratora', async () => {
  const [status] = await zapytaj(ciastkoPracownika, 'GET', '/api/psa/szablony');
  assert.equal(status, 403, 'pracownik nie redaguje tresci pism o skutkach prawnych');
});

test('podglad sklada dokument na danych probnych i wskazuje braki', async () => {
  const [status, dane] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/podglad', {
    tytul: 'Próba',
    tresc: '<p>{{spolka_nazwa}} — {{razem_akcji}} ({{razem_akcji_slownie}}) akcji, {{czegoNieMa}}</p>',
  });
  assert.equal(status, 200);
  assert.equal(dane.na_danych_probnych, true);
  assert.match(dane.html, /WIATRAKI POLSKIE/, 'dane próbne podstawione');
  assert.match(dane.html, /sto/, 'liczebnik zapisany słownie');
  assert.deepEqual(dane.brakujace, ['czegoNieMa'], 'brak wskazany zamiast ukryty');
  assert.match(dane.html, /—/, 'brak widoczny w treści');
});

test('podglad odmawia bez tresci', async () => {
  const [status] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/podglad', {});
  assert.equal(status, 400);
});

test('zapis zaklada KOLEJNA wersje, poprzednia zostaje nietknieta', async () => {
  const [, przed] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/wezwanie_przeszkoda');
  const trescV1 = przed.wersje[0].tresc;

  const [status, dane] = await zapytaj(
    ciastkoAdmina, 'POST', '/api/psa/szablony/wezwanie_przeszkoda/wersje',
    { tytul: 'Wezwanie — redakcja własna', tresc: '<p>Nowa treść dla {{spolka_nazwa}}.</p>' }
  );
  assert.equal(status, 201);
  assert.equal(dane.szablon.wersja, 2);
  assert.equal(dane.szablon.aktywna, 1);

  const [, po] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/wezwanie_przeszkoda');
  assert.equal(po.wersje.length, 2);
  const v1 = po.wersje.find((w) => w.wersja === 1);
  assert.equal(v1.tresc, trescV1, 'wersja 1 bez zmian');
  assert.equal(v1.aktywna, 0);
});

test('szablon z bledem skladni nie wchodzi do bazy', async () => {
  const [status, dane] = await zapytaj(
    ciastkoAdmina, 'POST', '/api/psa/szablony/zawiadomienie_odmowa/wersje',
    { tytul: 'Zepsuty', tresc: '{{#lista}}wiersz bez zamkniecia' }
  );
  assert.equal(status, 400);
  assert.match(dane.blad, /błąd składni/i);
});

test('nie da sie zalozyc wersji nieistniejacego szablonu', async () => {
  const [status] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/nie_ma_takiego/wersje', {
    tytul: 'X', tresc: '<p>x</p>',
  });
  assert.equal(status, 404);
});

test('mozna wrocic do wczesniejszej wersji bez zmiany jej tresci', async () => {
  await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/uchwala_wyboru/wersje', {
    tytul: 'Uchwała v2', tresc: '<p>wersja druga</p>',
  });
  const [status, dane] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/szablony/uchwala_wyboru/aktywuj', {
    wersja: 1,
  });
  assert.equal(status, 200);
  assert.equal(dane.szablon.wersja, 1);

  const [, historia] = await zapytaj(ciastkoAdmina, 'GET', '/api/psa/szablony/uchwala_wyboru');
  assert.equal(historia.wersje.length, 2, 'wersja 2 nadal w historii');
  assert.equal(historia.wersje.find((w) => w.wersja === 1).aktywna, 1);
});

test('nie ma trasy nadpisujacej ani usuwajacej szablon', async () => {
  const [put] = await zapytaj(ciastkoAdmina, 'PUT', '/api/psa/szablony/uchwala_wyboru', {
    tresc: '<p>podmiana</p>',
  });
  const [del] = await zapytaj(ciastkoAdmina, 'DELETE', '/api/psa/szablony/uchwala_wyboru');
  assert.ok(put === 404 || put === 405, `PUT nie moze byc obslugiwany (jest ${put})`);
  assert.ok(del === 404 || del === 405, `DELETE nie moze byc obslugiwany (jest ${del})`);
});
