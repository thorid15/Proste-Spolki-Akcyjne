'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const u = require('../server/logika/ulamki');

test('1/3 + 1/3 + 1/3 = 1 (bez utraty precyzji przez skonczone rozwiniecie dziesietne)', () => {
  let suma = u.ZERO;
  suma = u.suma(suma, { licznik: 1, mianownik: 3 });
  suma = u.suma(suma, { licznik: 1, mianownik: 3 });
  suma = u.suma(suma, { licznik: 1, mianownik: 3 });
  assert.equal(u.rowne(suma, u.JEDEN), true);
  assert.deepEqual(suma, { licznik: 1, mianownik: 1 });
});

test('skracanie do postaci nieskracalnej (NWD = 1)', () => {
  assert.deepEqual(u.skroc({ licznik: 2, mianownik: 4 }), { licznik: 1, mianownik: 2 });
  assert.deepEqual(u.skroc({ licznik: 6, mianownik: 9 }), { licznik: 2, mianownik: 3 });
  assert.deepEqual(u.skroc({ licznik: 5, mianownik: 5 }), { licznik: 1, mianownik: 1 });
  assert.deepEqual(u.skroc({ licznik: 0, mianownik: 7 }), { licznik: 0, mianownik: 1 });
});

test('porownania przez mnozenie na krzyz, bez dzielenia', () => {
  assert.equal(u.rowne({ licznik: 1, mianownik: 2 }, { licznik: 2, mianownik: 4 }), true);
  assert.equal(u.mniejszy({ licznik: 1, mianownik: 3 }, { licznik: 1, mianownik: 2 }), true);
  assert.equal(u.mniejszy({ licznik: 1, mianownik: 2 }, { licznik: 1, mianownik: 3 }), false);
  assert.equal(u.mniejszyRowny({ licznik: 1, mianownik: 2 }, { licznik: 1, mianownik: 2 }), true);
});

test('suma przez wspolny mianownik, wynik skrocony', () => {
  assert.deepEqual(u.suma({ licznik: 1, mianownik: 4 }, { licznik: 1, mianownik: 4 }), { licznik: 1, mianownik: 2 });
  assert.deepEqual(u.suma({ licznik: 1, mianownik: 6 }, { licznik: 1, mianownik: 3 }), { licznik: 1, mianownik: 2 });
});

test('roznica: 1 - 1/3 = 2/3', () => {
  assert.deepEqual(u.roznica(u.JEDEN, { licznik: 1, mianownik: 3 }), { licznik: 2, mianownik: 3 });
});

test('roznica rzuca, gdy wynik wyszedlby ujemny (proba odjecia wiecej niz jest)', () => {
  assert.throws(() => u.roznica({ licznik: 1, mianownik: 3 }, u.JEDEN), u.BladUlamka);
});

test('jestZero i jestJeden', () => {
  assert.equal(u.jestZero(u.ZERO), true);
  assert.equal(u.jestZero({ licznik: 1, mianownik: 5 }), false);
  assert.equal(u.jestJeden(u.JEDEN), true);
  assert.equal(u.jestJeden({ licznik: 3, mianownik: 3 }), true);
  assert.equal(u.jestJeden({ licznik: 2, mianownik: 3 }), false);
});

test('waliduj: mianownik musi byc dodatni, licznik miedzy 1 a mianownikiem, wynik skrocony', () => {
  assert.deepEqual(u.waliduj({ licznik: 2, mianownik: 4 }), { licznik: 1, mianownik: 2 });
  assert.throws(() => u.waliduj({ licznik: 0, mianownik: 1 }), u.BladUlamka);
  assert.throws(() => u.waliduj({ licznik: 4, mianownik: 3 }), u.BladUlamka);
  assert.throws(() => u.waliduj({ licznik: 1, mianownik: 0 }), u.BladUlamka);
  assert.throws(() => u.waliduj({ licznik: 1, mianownik: -3 }), u.BladUlamka);
  assert.throws(() => u.waliduj({ licznik: 1.5, mianownik: 3 }), u.BladUlamka);
});

test('naProcent i opisz sluza wylacznie wyswietlaniu (regula domenowa 4a)', () => {
  assert.equal(u.naProcent({ licznik: 1, mianownik: 4 }), 25);
  assert.equal(u.opisz({ licznik: 1, mianownik: 3 }), '1/3');
});

test('wielokrotne skladanie ulamkow trzecich i czwartych sumuje sie poprawnie', () => {
  // 1/3 + 1/4 + 1/4 + 1/6 = 4/12 + 3/12 + 3/12 + 2/12 = 12/12 = 1
  let suma = u.ZERO;
  for (const cz of [{ licznik: 1, mianownik: 3 }, { licznik: 1, mianownik: 4 }, { licznik: 1, mianownik: 4 }, { licznik: 1, mianownik: 6 }]) {
    suma = u.suma(suma, cz);
  }
  assert.equal(u.rowne(suma, u.JEDEN), true);
});
