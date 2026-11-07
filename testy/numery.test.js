'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const n = require('../server/logika/numery');

test('normalizuje: sortuje, scala nakladajace sie i przylegle zakresy', () => {
  assert.deepEqual(n.normalizuj([{ nr_od: 6, nr_do: 10 }, { nr_od: 1, nr_do: 5 }]), [
    { nr_od: 1, nr_do: 10 },
  ]);
  assert.deepEqual(n.normalizuj([{ nr_od: 1, nr_do: 5 }, { nr_od: 3, nr_do: 8 }]), [
    { nr_od: 1, nr_do: 8 },
  ]);
  assert.deepEqual(n.normalizuj([{ nr_od: 1, nr_do: 5 }, { nr_od: 7, nr_do: 8 }]), [
    { nr_od: 1, nr_do: 5 },
    { nr_od: 7, nr_do: 8 },
  ]);
});

test('odrzuca zakresy odwrocone i numery mniejsze od 1', () => {
  assert.throws(() => n.normalizuj([{ nr_od: 10, nr_do: 5 }]), n.BladZakresu);
  assert.throws(() => n.normalizuj([{ nr_od: 0, nr_do: 5 }]), n.BladZakresu);
  assert.throws(() => n.normalizuj([{ nr_od: 1.5, nr_do: 5 }]), n.BladZakresu);
});

test('roznica rozcina zakres na dwie czesci', () => {
  const wynik = n.roznica([{ nr_od: 1, nr_do: 100 }], [{ nr_od: 40, nr_do: 60 }]);
  assert.deepEqual(wynik, [
    { nr_od: 1, nr_do: 39 },
    { nr_od: 61, nr_do: 100 },
  ]);
  assert.equal(n.ilosc(wynik), 79);
});

test('przeciecie i zawieranie', () => {
  assert.deepEqual(
    n.przeciecie([{ nr_od: 1, nr_do: 50 }], [{ nr_od: 40, nr_do: 90 }]),
    [{ nr_od: 40, nr_do: 50 }]
  );
  assert.equal(n.zawiera([{ nr_od: 1, nr_do: 100 }], [{ nr_od: 5, nr_do: 10 }]), true);
  assert.equal(n.zawiera([{ nr_od: 1, nr_do: 100 }], [{ nr_od: 95, nr_do: 105 }]), false);
  assert.equal(n.nakladaja([{ nr_od: 1, nr_do: 10 }], [{ nr_od: 11, nr_do: 20 }]), false);
});

test('parsowanie i opis zapisu numerow', () => {
  assert.deepEqual(n.parsuj('1-10, 21, 30–35'), [
    { nr_od: 1, nr_do: 10 },
    { nr_od: 21, nr_do: 21 },
    { nr_od: 30, nr_do: 35 },
  ]);
  assert.equal(n.opisz([{ nr_od: 1, nr_do: 10 }, { nr_od: 21, nr_do: 21 }]), '1–10, 21');
  assert.throws(() => n.parsuj('abc'), /Nie rozumiem zapisu numerów/);
});

