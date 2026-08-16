'use strict';

/**
 * Przegląd okresowy AML (blok C1 sesji 8) — sygnał, nie blokada.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const aml = require('../server/logika/aml');

test('dodajMiesiace: przesuwa date o zadana liczbe miesiecy, w tym przez granice roku', () => {
  assert.equal(aml.dodajMiesiace('2026-08-13', 12), '2027-08-13');
  assert.equal(aml.dodajMiesiace('2026-01-31', 1), '2026-03-03', 'luty krotszy - JS Date sam przenosi nadwyzke');
});

test('wymagaPrzegladu: status inny niz "wykonane" nigdy nie wymaga przegladu (ma juz wlasny sygnal)', () => {
  assert.equal(aml.wymagaPrzegladu({ aml_status: 'brak' }, '2026-08-13'), false);
  assert.equal(aml.wymagaPrzegladu({ aml_status: 'niemozliwe', aml_data: '2020-01-01' }, '2026-08-13'), false);
  assert.equal(aml.wymagaPrzegladu(null, '2026-08-13'), false);
});

test('wymagaPrzegladu: "wykonane" bez zadnej daty jest przeterminowane (brak nie moze wygladac lepiej niz jest)', () => {
  assert.equal(aml.wymagaPrzegladu({ aml_status: 'wykonane', aml_data: null, aml_data_przegladu: null }, '2026-08-13'), true);
});

test('wymagaPrzegladu: 12 miesiecy od aml_data, gdy brak aml_data_przegladu', () => {
  const osoba = { aml_status: 'wykonane', aml_data: '2025-08-13', aml_data_przegladu: null };
  assert.equal(aml.wymagaPrzegladu(osoba, '2026-08-12'), false, 'dzien przed terminem - jeszcze nie');
  assert.equal(aml.wymagaPrzegladu(osoba, '2026-08-13'), true, 'dokladnie 12 miesiecy - juz tak');
});

test('wymagaPrzegladu: aml_data_przegladu ma pierwszenstwo nad aml_data', () => {
  const osoba = { aml_status: 'wykonane', aml_data: '2020-01-01', aml_data_przegladu: '2026-06-01' };
  assert.equal(aml.wymagaPrzegladu(osoba, '2026-08-13'), false, 'swiezy przeglad przebija stara date wykonania');
  assert.equal(aml.wymagaPrzegladu(osoba, '2027-06-01'), true);
});
