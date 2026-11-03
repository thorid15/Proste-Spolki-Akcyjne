'use strict';

/** R4 zad. 2 (P2): Start portalu — „Do zapłaty” i baner kroku wniosku. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { pozycjeDoZaplatyPortal, banerKrokuWniosku } = require('../publiczne/js/portal-start.js');

// Kształt odpowiedzi `/api/psa/portal/oplaty` (widokOplatyKlienta): `kwota_grosze` to już BRUTTO.
const OPLATY = [
  { id: 1, status: 'nieoplacona', opis: 'Wpis w rejestrze akcjonariuszy', kwota_grosze: 12300, kwota_brutto_grosze: 12300, kwota_netto_grosze: 10000, stawka_vat_procent: 23 },
  { id: 2, status: 'oplacona', opis: 'Informacja z rejestru', kwota_grosze: 6150, kwota_brutto_grosze: 6150, kwota_netto_grosze: 5000, stawka_vat_procent: 23 },
  { id: 3, status: 'oczekuje', opis: 'Prowadzenie rejestru', kwota_grosze: 14760, kwota_brutto_grosze: 14760, kwota_netto_grosze: 12000, stawka_vat_procent: 23 },
];

test('Do zapłaty: tylko nieopłacone, netto i brutto wprost z API (bez ponownego doliczania VAT)', () => {
  assert.deepEqual(pozycjeDoZaplatyPortal({ oplaty: OPLATY }), [
    { idOplaty: 1, opis: 'Wpis w rejestrze akcjonariuszy', kwotaNetto: 10000, kwotaBrutto: 12300 },
    { idOplaty: 3, opis: 'Prowadzenie rejestru', kwotaNetto: 12000, kwotaBrutto: 14760 },
  ]);
});

test('Do zapłaty: [] gdy wszystko opłacone albo brak opłat', () => {
  assert.deepEqual(pozycjeDoZaplatyPortal({ oplaty: [OPLATY[1]] }), []);
  assert.deepEqual(pozycjeDoZaplatyPortal({}), []);
});

test('baner: „Podpisz dokumenty” przy wniosku czekającym na podpis', () => {
  const b = banerKrokuWniosku({ wniosek: { id: 7, status: 'umowa_wygenerowana' } });
  assert.equal(b.akcja.etykieta, 'Podpisz dokumenty');
  assert.equal(b.akcja.adres, '/wniosek');
  assert.ok(b.tekst);
});

test('baner: null przy wniosku przyjętym albo bez wniosku', () => {
  assert.equal(banerKrokuWniosku({ wniosek: { id: 7, status: 'przyjety' } }), null);
  assert.equal(banerKrokuWniosku({ wniosek: null }), null);
});
