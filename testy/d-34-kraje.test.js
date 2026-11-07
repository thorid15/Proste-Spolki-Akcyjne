'use strict';

/** D-34 — słownik krajów ISO 3166-1 alfa-2 (stała; lista w interfejsie z tego samego pliku). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kraje = require('../server/dane/kraje.json');

test('słownik ma 249 kodów ISO 3166-1 alfa-2, Polska pierwsza', () => {
  assert.equal(kraje.length, 249);
  assert.equal(new Set(kraje.map((k) => k.kod)).size, 249);
  assert.deepEqual(kraje[0], { kod: 'PL', nazwa: 'Polska', nazwa_en: 'Poland' });
  assert.ok(kraje.every((k) => /^[A-Z]{2}$/.test(k.kod)));
});

test('lista w interfejsie jest wygenerowana z tego samego słownika', () => {
  const plik = fs.readFileSync(path.join(__dirname, '..', 'publiczne', 'js', 'kraje.js'), 'utf8');
  const lista = JSON.parse(plik.match(/const KRAJE = (\[.*\]);/)[1]);
  assert.deepEqual(lista, kraje.map((k) => [k.kod, k.nazwa]));
});

