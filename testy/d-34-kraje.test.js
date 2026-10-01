'use strict';

/** D-34 — słownik krajów ISO 3166-1 alfa-2; kod zapisuje baza, nierozpoznane do raportu. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { bazaTestowa, dodajOsobe } = require('./pomoc');
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

test('zapis kodu, nazwy polskiej albo angielskiej daje kod; nierozpoznane — NULL i raport', () => {
  const db = bazaTestowa();
  const odczyt = (id) => db.prepare('SELECT kraj, kraj_kod FROM psa_osoby WHERE id = ?').get(id);
  const osoba = (kraj) => {
    const id = dodajOsobe(db);
    db.prepare('UPDATE psa_osoby SET kraj = ? WHERE id = ?').run(kraj, id);
    return odczyt(id);
  };
  assert.deepEqual(osoba('DE'), { kraj: 'Niemcy', kraj_kod: 'DE' });
  assert.deepEqual(osoba('Czechy'), { kraj: 'Czechy', kraj_kod: 'CZ' });
  assert.deepEqual(osoba('united kingdom'), { kraj: 'Wielka Brytania', kraj_kod: 'GB' });
  // Bez zgadywania: literówka i nazwa potoczna zostają jak są, bez kodu.
  assert.deepEqual(osoba('Niemcy Zachodnie'), { kraj: 'Niemcy Zachodnie', kraj_kod: null });
  assert.deepEqual(osoba('Anglia'), { kraj: 'Anglia', kraj_kod: null });
  // Domyślna wartość przy wstawieniu też dostaje kod.
  assert.equal(odczyt(dodajOsobe(db)).kraj_kod, 'PL');
});
