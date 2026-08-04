'use strict';

/**
 * Termin 7 dni z zawieszeniem (regula domenowa nr 7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const terminy = require('../server/logika/terminy');

test('termin bez wstrzymania = data_wplywu + 7 dni', () => {
  const wynik = terminy.policzTermin(
    { data_wplywu: '2026-01-01', stan: 'weryfikacja', wstrzymana_od: null, wznowiona_od: null },
    '2026-01-03'
  );
  assert.equal(wynik.zamrozony, false);
  assert.equal(wynik.termin_do, '2026-01-08');
  assert.equal(wynik.dni_pozostale, 5);
  assert.equal(wynik.po_terminie, false);
});

test('termin jest zamrożony w stanie wstrzymana', () => {
  const wynik = terminy.policzTermin(
    { data_wplywu: '2026-01-01', stan: 'wstrzymana', wstrzymana_od: '2026-01-04', wznowiona_od: null },
    '2026-02-01'
  );
  assert.equal(wynik.zamrozony, true);
  assert.equal(wynik.termin_do, null);
  assert.equal(wynik.dni_pozostale, null);
  assert.equal(wynik.wstrzymana_od, '2026-01-04');
});

test('po wznowieniu biegnie PEŁNE nowe 7 dni od dnia usunięcia przeszkody — niezależnie od tego, ile upłynęło wcześniej', () => {
  // Sprawa wpłynęła 1., wstrzymana 3. dnia (2 dni upłynęły z pierwotnego
  // terminu), wznowiona po tygodniu przerwy. Ustawa: „7 dni od jej usunięcia”.
  const sprawa = { data_wplywu: '2026-01-01', stan: 'wstrzymana', wstrzymana_od: '2026-01-03' };
  const poprawki = terminy.wznow(sprawa, '2026-01-10');

  assert.equal(poprawki.stan, 'weryfikacja');
  assert.equal(poprawki.wznowiona_od, '2026-01-10');
  assert.equal(poprawki.dni_wstrzymania, 7);

  const wznowiona = { ...sprawa, ...poprawki };
  const termin = terminy.policzTermin(wznowiona, '2026-01-10');
  assert.equal(termin.zamrozony, false);
  // Pełne 7 dni od 10., NIE 5 dni (7 − 2 zaliczone przed wstrzymaniem).
  assert.equal(termin.termin_do, '2026-01-17');
  assert.equal(termin.dni_pozostale, 7);
});

test('dni_wstrzymania kumuluje się przy wielokrotnym wstrzymaniu', () => {
  let sprawa = { data_wplywu: '2026-01-01', stan: 'weryfikacja', dni_wstrzymania: 0 };

  sprawa = { ...sprawa, ...terminy.wstrzymaj(sprawa, '2026-01-05') };
  assert.equal(sprawa.stan, 'wstrzymana');

  sprawa = { ...sprawa, ...terminy.wznow(sprawa, '2026-01-08') };
  assert.equal(sprawa.dni_wstrzymania, 3);

  sprawa = { ...sprawa, ...terminy.wstrzymaj(sprawa, '2026-01-20') };
  sprawa = { ...sprawa, ...terminy.wznow(sprawa, '2026-01-25') };
  assert.equal(sprawa.dni_wstrzymania, 8, '3 + 5 dni z dwóch wstrzymań');
});

test('po_terminie i pilny — progi ostrzegania na pulpicie', () => {
  const sprawa = { data_wplywu: '2026-01-01', stan: 'weryfikacja' };

  assert.equal(terminy.policzTermin(sprawa, '2026-01-06').pilny, true, '2 dni do terminu = pilne');
  assert.equal(terminy.policzTermin(sprawa, '2026-01-06').po_terminie, false);
  assert.equal(terminy.policzTermin(sprawa, '2026-01-04').pilny, false, '4 dni do terminu = jeszcze nie pilne');
  assert.equal(terminy.policzTermin(sprawa, '2026-01-09').po_terminie, true, 'dzień po terminie');
});

test('nie można wstrzymać sprawy już wstrzymanej ani wznowić niewstrzymanej', () => {
  assert.throws(
    () => terminy.wstrzymaj({ stan: 'wstrzymana' }, '2026-01-01'),
    /już wstrzymana/
  );
  assert.throws(
    () => terminy.wznow({ stan: 'weryfikacja' }, '2026-01-01'),
    /nie jest wstrzymana/
  );
});

test('dodajDni i dniMiedzy są spójne ze sobą', () => {
  assert.equal(terminy.dodajDni('2026-02-25', 7), '2026-03-04');
  assert.equal(terminy.dniMiedzy('2026-02-25', '2026-03-04'), 7);
  assert.equal(terminy.dniMiedzy('2026-03-04', '2026-02-25'), -7);
});
