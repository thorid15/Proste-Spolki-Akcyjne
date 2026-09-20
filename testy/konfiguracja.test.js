'use strict';

/**
 * Naprawa Z-002: `konfiguracja.js::sciezka()` skladala KAZDA wartosc z
 * KATALOG_GLOWNY przez `path.resolve`, wliczajac literal `:memory:` - efekt:
 * SQLite dostawal absolutna sciezke konczaca sie na `/:memory:` (realny plik
 * na dysku), nie specjalna wartosc oznaczajaca baze wylacznie w pamieci,
 * ktorej `server/baza.js` oczekuje (`sciezkaPliku !== ':memory:'`).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const konfiguracja = require('../server/konfiguracja');

/**
 * Naprawa Z-306: asercja strefy czasowej dziala przy PIERWSZYM `require`
 * modulu (efekt uboczny na poziomie pliku) - w tym samym procesie co reszta
 * testow modul jest juz zaladowany i zcache'owany, wiec zeby w ogole
 * wywolac ten kod, trzeba odpalic go w OSOBNYM procesie Node.
 */
function uruchomZTz(tz) {
  const env = { ...process.env };
  if (tz === undefined) delete env.TZ;
  else env.TZ = tz;
  return spawnSync(
    process.execPath,
    ['-e', "require('./server/konfiguracja'); console.log(process.env.TZ)"],
    { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' }
  );
}

test('konfiguracja: strefa czasowa inna niz Europe/Warsaw odmawia startu procesu', () => {
  const wynik = uruchomZTz('America/New_York');
  assert.notEqual(wynik.status, 0, 'proces mial odmowic startu');
  assert.match(wynik.stderr, /wymaga strefy czasowej "Europe\/Warsaw"/);
});

test('konfiguracja: strefa czasowa nieustawiona dostaje bezpieczny domysl Europe/Warsaw, proces startuje', () => {
  const wynik = uruchomZTz(undefined);
  assert.equal(wynik.status, 0, wynik.stderr);
  assert.equal(wynik.stdout.trim(), 'Europe/Warsaw');
});

test('konfiguracja: strefa czasowa Europe/Warsaw przechodzi bez przeszkod', () => {
  const wynik = uruchomZTz('Europe/Warsaw');
  assert.equal(wynik.status, 0, wynik.stderr);
  assert.equal(wynik.stdout.trim(), 'Europe/Warsaw');
});

test('sciezka(): ":memory:" zostaje literalem, nie sciezka wzgledem katalogu glownego', () => {
  const poprzednia = process.env.PSA_TEST_SCIEZKA;
  try {
    process.env.PSA_TEST_SCIEZKA = ':memory:';
    assert.equal(konfiguracja.sciezka('PSA_TEST_SCIEZKA', './dane/domyslna.db'), ':memory:');
  } finally {
    if (poprzednia === undefined) delete process.env.PSA_TEST_SCIEZKA;
    else process.env.PSA_TEST_SCIEZKA = poprzednia;
  }
});

test('sciezka(): zwykla sciezka wzgledna nadal sklada sie z katalogiem glownym', () => {
  const poprzednia = process.env.PSA_TEST_SCIEZKA;
  try {
    process.env.PSA_TEST_SCIEZKA = './dane/przyklad.db';
    const wynik = konfiguracja.sciezka('PSA_TEST_SCIEZKA', './dane/domyslna.db');
    assert.ok(path.isAbsolute(wynik));
    assert.ok(wynik.endsWith(path.join('dane', 'przyklad.db')));
  } finally {
    if (poprzednia === undefined) delete process.env.PSA_TEST_SCIEZKA;
    else process.env.PSA_TEST_SCIEZKA = poprzednia;
  }
});
