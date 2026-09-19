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

const konfiguracja = require('../server/konfiguracja');

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
