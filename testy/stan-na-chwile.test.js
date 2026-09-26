'use strict';

/**
 * „Stan na" z dokładnością do minuty; od D-R01 jedyną osią czasu jest
 * chwila wpisu (`data_wpisu`, UTC).
 *
 * Zdarzenia budowane bezpośrednio przez `rejestr.zapiszZdarzenie` z
 * wewnętrznym parametrem `chwila` — pełna kontrola nad chwilą wpisu w teście
 * (normalna ścieżka zawsze wstawia `terazUtc()`).
 *
 * `TZ` ustawiona jawnie na strefę kancelarii (`.env.przyklad`) — porównanie
 * chwil (`?data=` bez przesunięcia, jak z formularza w przeglądarce, vs.
 * `data_wpisu` z przesunięciem) jest spójne wyłącznie wtedy, gdy proces
 * zapisujący i proces odczytujący używają tej samej strefy. Musi być
 * ustawiona PRZED jakimkolwiek użyciem `Date` w tym pliku.
 */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const widoki = require('../server/widoki');
const czas = require('../server/pomocnicze/czas');
const { bazaTestowa, dodajSpolke } = require('./pomoc');

function przygotujDwaWpisyTegoSamegoDnia(db, spolka) {
  // Emisja A wpisana rano, emisja B (inna seria) wpisana po południu tego
  // samego dnia — liczy się wyłącznie chwila wpisu (D-R01).
  rejestr.zapiszZdarzenie(db, {
    spolka_id: spolka,
    typ: 'emisja',
    chwila: '2026-01-15T09:00:00+01:00',
    autor: 'Test',
    dane: { seria: 'A', nr_pierwszy: 1, ilosc: 10 },
  });
  rejestr.zapiszZdarzenie(db, {
    spolka_id: spolka,
    typ: 'emisja',
    chwila: '2026-01-15T14:00:00+01:00',
    autor: 'Test',
    dane: { seria: 'B', nr_pierwszy: 1, ilosc: 5 },
  });
}

test('czas.poprawnaChwila i poprawnaDataAlboChwila rozpoznają oba formaty', () => {
  assert.equal(czas.poprawnaChwila('2026-01-15T14:00'), true);
  assert.equal(czas.poprawnaChwila('2026-01-15T14:00:30'), true);
  assert.equal(czas.poprawnaChwila('2026-01-15'), false);
  assert.equal(czas.poprawnaChwila('2026-01-15T25:00'), false);
  assert.equal(czas.poprawnaChwila('2026-01-15T14:60'), false);
  assert.equal(czas.poprawnaDataAlboChwila('2026-01-15'), true);
  assert.equal(czas.poprawnaDataAlboChwila('2026-01-15T14:00'), true);
  assert.equal(czas.poprawnaDataAlboChwila('nie-data'), false);
});

test('dwa wpisy tego samego dnia dają dwa różne stany (rozróżnienie po data_wpisu)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  przygotujDwaWpisyTegoSamegoDnia(db, spolka);

  const przedPoludniem = widoki.widokStanu(db, spolka, '2026-01-15T10:00');
  assert.equal(przedPoludniem.emisje.length, 1);
  assert.equal(przedPoludniem.emisje[0].seria, 'A');

  const poPoludniu = widoki.widokStanu(db, spolka, '2026-01-15T15:00');
  assert.equal(poPoludniu.emisje.length, 2);
  assert.deepEqual(poPoludniu.emisje.map((e) => e.seria).sort(), ['A', 'B']);
});

test('stan sprzed pierwszego wpisu jest pusty', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  przygotujDwaWpisyTegoSamegoDnia(db, spolka);

  const przedWszystkim = widoki.widokStanu(db, spolka, '2026-01-15T08:00');
  assert.equal(przedWszystkim.emisje.length, 0);
  assert.equal(przedWszystkim.razem_akcji, 0);
  assert.deepEqual(przedWszystkim.niezgodnosci, []);
});

test('D-R01: dzień D = koniec dnia D po chwili wpisu; emisje też liczą się od wpisu', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  przygotujDwaWpisyTegoSamegoDnia(db, spolka);

  const naDzien = widoki.widokStanu(db, spolka, '2026-01-15');
  assert.equal(naDzien.emisje.length, 2);
  const nieobjeteNaDzien = naDzien.bilans.reduce((s, b) => s + b.nieobjete, 0);
  assert.equal(nieobjeteNaDzien, 15, 'na koniec dnia 2026-01-15 obie serie (10+5) są już wpisane');

  const dzienWczesniej = widoki.widokStanu(db, spolka, '2026-01-14');
  assert.equal(dzienWczesniej.emisje.length, 0);
  assert.equal(dzienWczesniej.bilans.reduce((s, b) => s + b.nieobjete, 0), 0);
});

test('chwila z sekundami jest równoważna chwili bez sekund na tę samą minutę', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  przygotujDwaWpisyTegoSamegoDnia(db, spolka);

  const bezSekund = widoki.widokStanu(db, spolka, '2026-01-15T14:00');
  const zSekundami = widoki.widokStanu(db, spolka, '2026-01-15T14:00:00');
  assert.equal(bezSekund.emisje.length, zSekundami.emisje.length);
});
