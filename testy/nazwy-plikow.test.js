'use strict';

/** R4 zad. 6 (K1): nazwa pliku w UI nigdy z UUID. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { nazwaPlikuDoWyswietlenia } = require('../publiczne/js/nazwy-plikow.js');

const UUID = /[0-9a-f]{4,8}(-[0-9a-f]{4}){1,3}-[0-9a-f]{12}/i;

test('nazwa oryginalna bez zmian', () => {
  assert.equal(nazwaPlikuDoWyswietlenia({ nazwaOryginalna: 'umowa-sprzedazy.pdf' }), 'umowa-sprzedazy.pdf');
});

test('UUID (pełny albo ogon) usunięty z nazwy', () => {
  for (const n of ['8a4d-4b47-825e-a5a1d3486b27-Zadanie-dokonania-wpisu.docx',
    '0f1e2d3c-8a4d-4b47-825e-a5a1d3486b27-Zadanie-dokonania-wpisu.docx',
    '0f1e2d3c-8a4d-4b47-825e-a5a1d3486b27.pdf']) {
    const wynik = nazwaPlikuDoWyswietlenia({ nazwaOryginalna: n, rodzaj: 'zadanie', data: '2026-11-01T10:00:00Z' });
    assert.doesNotMatch(wynik, UUID, n);
  }
  assert.equal(nazwaPlikuDoWyswietlenia({ nazwaOryginalna: '8a4d-4b47-825e-a5a1d3486b27-Zadanie-dokonania-wpisu.docx' }), 'Zadanie-dokonania-wpisu.docx');
});

test('brak nazwy (albo sam UUID) → <rodzaj>-<RRRR-MM-DD>.pdf', () => {
  assert.equal(nazwaPlikuDoWyswietlenia({ nazwaOryginalna: null, rodzaj: 'umowa_zbycia', data: '2026-11-01T10:00:00Z' }), 'umowa_zbycia-2026-11-01.pdf');
  assert.equal(nazwaPlikuDoWyswietlenia({ nazwaOryginalna: '0f1e2d3c-8a4d-4b47-825e-a5a1d3486b27.pdf', rodzaj: 'inny', data: '2026-11-01' }), 'inny-2026-11-01.pdf');
});
