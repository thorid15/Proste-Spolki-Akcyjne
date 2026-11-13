'use strict';

/**
 * Prymitywy uwierzytelniania (sekcja 11 specyfikacji): hasla, sesje, rate
 * limiting. Testy czysto jednostkowe, bez HTTP ani bazy.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hasla = require('../server/logika/hasla');
const sesja = require('../server/logika/sesja');
const limiter = require('../server/logika/limiter');

test('hasla: hash i weryfikacja - poprawne i blednie haslo', async () => {
  const hash = await hasla.hashuj('BardzoTajneHaslo1');
  assert.notEqual(hash, 'BardzoTajneHaslo1');
  assert.equal(await hasla.zweryfikuj('BardzoTajneHaslo1', hash), true);
  assert.equal(await hasla.zweryfikuj('cos-innego', hash), false);
});

test('hasla: zweryfikuj zwraca false zamiast rzucac, gdy brak hasha', async () => {
  assert.equal(await hasla.zweryfikuj('cokolwiek', null), false);
});

test('hasla: ocenSile odrzuca za krotkie; dlugie haslo bez litery/cyfry jest OK (bez wymogow skladu, B1)', () => {
  assert.equal(hasla.ocenSile('krotkiehasl').ok, false);
  assert.equal(hasla.ocenSile('123456789012').ok, true);
  assert.equal(hasla.ocenSile('samesamelitery').ok, true);
  assert.equal(hasla.ocenSile('PoprawneHaslo1').ok, true);
});

test('hasla: losoweHaslo generuje rozne wartosci o rozsadnej dlugosci', () => {
  const a = hasla.losoweHaslo();
  const b = hasla.losoweHaslo();
  assert.notEqual(a, b);
  assert.equal(a.length >= 10, true);
});

test('sesja: token wystawiony jest odczytywany z poprawnym typem i id', () => {
  const token = sesja.wystaw({ typ: 'pracownik', id: 42 }, 60_000);
  const payload = sesja.odczytaj(token);
  assert.equal(payload.typ, 'pracownik');
  assert.equal(payload.id, 42);
  // Z-250/Z-251: kazdy token niesie tez wersje (do uniewaznienia wszystkich
  // tokenow konta przy zmianie hasla) i jti (do uniewaznienia TEGO jednego
  // tokenu przy wylogowaniu) — patrz testy/auth-http.test.js.
  assert.equal(payload.wersja, 0);
  assert.equal(typeof payload.jti, 'string');
  assert.ok(payload.jti.length > 0);
});

test('sesja: dwa tokeny tego samego podmiotu maja rozne jti (mozna uniewaznic pojedynczo)', () => {
  const tokenA = sesja.wystaw({ typ: 'pracownik', id: 42 }, 60_000);
  const tokenB = sesja.wystaw({ typ: 'pracownik', id: 42 }, 60_000);
  assert.notEqual(sesja.odczytaj(tokenA).jti, sesja.odczytaj(tokenB).jti);
});

test('sesja: token niesie wersje podana przy wystawieniu, do porownania z biezaca wartoscia w bazie', () => {
  const token = sesja.wystaw({ typ: 'pracownik', id: 42, wersja: 3 }, 60_000);
  assert.equal(sesja.odczytaj(token).wersja, 3);
});

test('sesja: token sfalszowany (zmieniona sygnatura) jest odrzucany', () => {
  const token = sesja.wystaw({ typ: 'konto', id: 7 }, 60_000);
  const [tresc] = token.split('.');
  const sfalszowany = `${tresc}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  assert.equal(sesja.odczytaj(sfalszowany), null);
});

test('sesja: token z podmieniona trescia (inny id) jest odrzucany', () => {
  const tokenA = sesja.wystaw({ typ: 'pracownik', id: 1 }, 60_000);
  const tokenB = sesja.wystaw({ typ: 'pracownik', id: 2 }, 60_000);
  const [, sygnaturaA] = tokenA.split('.');
  const [trescB] = tokenB.split('.');
  assert.equal(sesja.odczytaj(`${trescB}.${sygnaturaA}`), null);
});

test('sesja: token wygasly jest odrzucany', () => {
  const token = sesja.wystaw({ typ: 'pracownik', id: 1 }, -1);
  assert.equal(sesja.odczytaj(token), null);
});

test('sesja: smiec zamiast tokenu nie wywala wyjatku', () => {
  assert.equal(sesja.odczytaj(''), null);
  assert.equal(sesja.odczytaj(null), null);
  assert.equal(sesja.odczytaj('brak-kropki'), null);
  assert.equal(sesja.odczytaj('a.b'), null);
});

// ─────────────────────────────────────────────────────────────
// K1 (audyt 12.11.2026): sekret sesji
// ─────────────────────────────────────────────────────────────

test('K1: sprawdzSekret — wartość z .env.przyklad, krótszy niż 32 znaki albo pusty w produkcji to błąd', () => {
  assert.match(sesja.sprawdzSekret('zmien-mnie-przed-wdrozeniem', { produkcja: false }), /\.env\.przyklad/);
  assert.match(sesja.sprawdzSekret('zmien-mnie-przed-wdrozeniem', { produkcja: true }), /\.env\.przyklad/);
  assert.match(sesja.sprawdzSekret('a'.repeat(31), { produkcja: false }), /32 znaki/);
  assert.match(sesja.sprawdzSekret('', { produkcja: true }), /SESJA_SEKRET/);
  assert.match(sesja.sprawdzSekret(null, { produkcja: true }), /SESJA_SEKRET/);
});

test('K1: sprawdzSekret — pusty poza produkcją (sekret tymczasowy) i 64 znaki hex są w porządku', () => {
  assert.equal(sesja.sprawdzSekret('', { produkcja: false }), null);
  assert.equal(sesja.sprawdzSekret(null, { produkcja: false }), null);
  assert.equal(sesja.sprawdzSekret('0123456789abcdef'.repeat(4), { produkcja: false }), null);
  assert.equal(sesja.sprawdzSekret('0123456789abcdef'.repeat(4), { produkcja: true }), null);
  assert.equal(sesja.sprawdzSekret('a'.repeat(32), { produkcja: true }), null);
});

/** Kontrola działa przy wczytaniu modułu — osobny proces, bo tutaj moduł jest już wczytany. */
function wczytajSesjeZ(env) {
  return spawnSync(process.execPath, ['-e', "require('./server/logika/sesja')"], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: '', SESJA_SEKRET: '', ...env },
    encoding: 'utf8',
  });
}

test('K1: serwer odmawia startu z sekretem z .env.przyklad, za krótkim albo — w produkcji — pustym', () => {
  for (const env of [{ SESJA_SEKRET: 'zmien-mnie-przed-wdrozeniem' }, { SESJA_SEKRET: 'krotki-sekret' }, { NODE_ENV: 'production' }]) {
    const wynik = wczytajSesjeZ(env);
    assert.notEqual(wynik.status, 0, `proces miał odmówić startu: ${JSON.stringify(env)}`);
    assert.match(wynik.stderr, /SESJA_SEKRET/);
  }
  assert.equal(wczytajSesjeZ({}).status, 0, 'poza produkcją bez sekretu — sekret tymczasowy');
  assert.equal(wczytajSesjeZ({ NODE_ENV: 'production', SESJA_SEKRET: '0123456789abcdef'.repeat(4) }).status, 0);
});

test('limiter: blokuje po przekroczeniu limitu prob, wpis udany czysci licznik', () => {
  const ip = '203.0.113.1';
  const email = `test-${Date.now()}@example.pl`;
  for (let i = 0; i < limiter.LIMIT; i += 1) {
    limiter.sprawdz(ip, email);
    limiter.zanotujNieudana(ip, email);
  }
  assert.throws(() => limiter.sprawdz(ip, email), /Za dużo nieudanych prób/);

  limiter.wyczyscPoUdanej(ip, email);
  assert.doesNotThrow(() => limiter.sprawdz(ip, email));
});

test('limiter: klucze niezalezne dla roznych adresow IP', () => {
  const email = `test-${Date.now()}@example.pl`;
  for (let i = 0; i < limiter.LIMIT; i += 1) {
    limiter.sprawdz('198.51.100.10', email);
    limiter.zanotujNieudana('198.51.100.10', email);
  }
  assert.throws(() => limiter.sprawdz('198.51.100.10', email));
  assert.doesNotThrow(() => limiter.sprawdz('198.51.100.11', email));
});
