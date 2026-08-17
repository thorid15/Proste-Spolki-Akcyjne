'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const d = require('../server/logika/deklinacja');

test('odmienImieNazwisko: przyklad juz zweryfikowany w danych testowych (Łukasz Adrian Szymborski)', () => {
  // Wartosc "Łukasza Adriana Szymborskiego" byla dotad wpisywana RECZNIE
  // (dane_testowe.py / kontekst-pisma.test.js) - deklinator ma ja odtworzyc
  // automatycznie z zapisu w mianowniku.
  assert.equal(
    d.odmienImieNazwisko('Łukasz Adrian Szymborski', 'biernik', 'mezczyzna'),
    'Łukasza Adriana Szymborskiego'
  );
  assert.equal(
    d.odmienImieNazwisko('Łukasz Adrian Szymborski', 'narzednik', 'mezczyzna'),
    'Łukaszem Adrianem Szymborskim'
  );
});

test('odmienImieNazwisko: mianownik zwracany bez zmian, niezaleznie od plci', () => {
  assert.equal(d.odmienImieNazwisko('Jan Kowalski', 'mianownik', null), 'Jan Kowalski');
});

test('odmienImieNazwisko: nazwisko zenskie przymiotnikowe (-ska)', () => {
  assert.equal(d.odmienImieNazwisko('Anna Kowalska', 'dopelniacz', 'kobieta'), 'Anny Kowalskiej');
  assert.equal(d.odmienImieNazwisko('Anna Kowalska', 'biernik', 'kobieta'), 'Annę Kowalską');
  assert.equal(d.odmienImieNazwisko('Anna Kowalska', 'narzednik', 'kobieta'), 'Anną Kowalską');
});

test('odmienImieNazwisko: koncowka "-eł" traci "e" (Paweł -> Pawła)', () => {
  assert.equal(d.odmienImieNazwisko('Paweł Nowak', 'biernik', 'mezczyzna'), 'Pawła Nowaka');
});

test('odmienImieNazwisko: bez plci zwraca null zamiast zgadywac', () => {
  assert.equal(d.odmienImieNazwisko('Jan Kowalski', 'biernik', null), null);
});

test('odmienRodzicow: "Piotr i Anna" na dopelniacz obu imion', () => {
  assert.equal(d.odmienRodzicow('Piotr i Anna'), 'Piotra i Anny');
  assert.equal(d.odmienRodzicow('Paweł i Izabela'), 'Pawła i Izabeli');
});

test('odmienImieDopelniacz: koncowka "-ia" (Maria, Zofia) -> "-ii", nie "-iy"', () => {
  assert.equal(d.odmienImieDopelniacz('Maria', 'kobieta'), 'Marii');
  assert.equal(d.odmienImieDopelniacz('Zofia', 'kobieta'), 'Zofii');
  assert.equal(d.odmienImieDopelniacz('Julia', 'kobieta'), 'Julii');
});

test('odmienRodzicow: nie da sie rozdzielic - null, nie zgadniety wynik', () => {
  assert.equal(d.odmienRodzicow('Piotr'), null);
  assert.equal(d.odmienRodzicow(''), null);
});

test('odmienFunkcjeBiernik: slownik najczestszych funkcji w PSA', () => {
  assert.equal(d.odmienFunkcjeBiernik('Prezes Zarządu'), 'Prezesa Zarządu');
  assert.equal(d.odmienFunkcjeBiernik('Dyrektor'), 'Dyrektora');
  assert.equal(d.odmienFunkcjeBiernik('Członek Zarządu'), 'Członka Zarządu');
});

test('odmienFunkcjeBiernik: nieznana funkcja - null, wymaga recznego wpisania', () => {
  assert.equal(d.odmienFunkcjeBiernik('Kurator ustanowiony postanowieniem sądu'), null);
});
