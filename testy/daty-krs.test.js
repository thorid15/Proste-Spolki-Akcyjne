'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseKrsDate } = require('../server/logika/daty-krs');

test('parsuje DD.MM.RRRR z zywej odpowiedzi API (KRS 0001114217) do ISO', () => {
  assert.equal(parseKrsDate('04.07.2024'), '2024-07-04');
  assert.equal(parseKrsDate('15.07.2025'), '2025-07-15');
});

test('toleruje doklejony czas (np. dataCzasOdpisu) i pojedyncze cyfry dnia/miesiaca', () => {
  assert.equal(parseKrsDate('17.08.2026 11:40:10'), '2026-08-17');
  assert.equal(parseKrsDate('4.7.2024'), '2024-07-04');
});

test('zwraca null dla pustych, niepoprawnych i juz-ISO wartosci', () => {
  assert.equal(parseKrsDate(null), null);
  assert.equal(parseKrsDate(''), null);
  assert.equal(parseKrsDate('2024-07-04'), null);
  assert.equal(parseKrsDate('13.13.2024'), null);
  assert.equal(parseKrsDate('00.07.2024'), null);
});
