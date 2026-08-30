'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizujRegon } = require('../server/logika/regon');

test('obcina 14-znakowy REGON dopelniony zerami do REGON-9 (zywe dane KRS 0001114217)', () => {
  assert.deepEqual(normalizujRegon('52906603800000'), { regon: '529066038', ostrzezenie: null });
});

test('zostawia 14-znakowy REGON jednostki lokalnej z poprawna suma kontrolna bez zmian', () => {
  // REGON-14 z niezerowa koncowka i poprawna suma kontrolna (wagi 2,4,8,5,0,9,7,3,6,1,2,4,8).
  assert.deepEqual(normalizujRegon('52906603800010'), { regon: '52906603800010', ostrzezenie: null });
});

test('ostrzega (nie blokuje) przy niepoprawnej sumie kontrolnej', () => {
  const wynik = normalizujRegon('123456789');
  assert.equal(wynik.regon, '123456789');
  assert.match(wynik.ostrzezenie, /suma kontrolna/i);
});

test('puste wejscie daje null bez ostrzezenia', () => {
  assert.deepEqual(normalizujRegon(''), { regon: null, ostrzezenie: null });
  assert.deepEqual(normalizujRegon(null), { regon: null, ostrzezenie: null });
});
