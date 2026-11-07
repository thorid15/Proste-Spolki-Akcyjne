'use strict';

/**
 * Testy podsystemu przebudowywanego w późniejszej fazie uproszczenia (CLAUDE-PSA-UPROSZCZENIE.md
 * § 0 pkt 8): każdy test pliku rejestruje się jako pominięty z numerem fazy, a haki (before/after)
 * nie wykonują się. Po Fazie 6 — zero pominiętych testów; plik znika razem z tym modułem.
 *
 * Użycie: `const test = require('./pominiete')('Faza 4 — wnioski przebudowywane');`
 */

const nodeTest = require('node:test');

module.exports = function pominiete(powod) {
  const test = (nazwa) => nodeTest.test(nazwa, { skip: powod });
  const nic = () => {};
  Object.assign(test, { skip: test, only: test, todo: test, before: nic, after: nic, beforeEach: nic, afterEach: nic });
  return test;
};
