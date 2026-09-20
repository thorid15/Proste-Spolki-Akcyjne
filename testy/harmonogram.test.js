'use strict';

/**
 * Z-357: przypomnienia o odnowieniu maja realny automatyczny wyzwalacz, nie
 * tylko przycisk w UI. Testujemy wylacznie mechanizm harmonogramu
 * (natychmiastowe pierwsze wywolanie + cykl) na atrapie `wyslij`, nie
 * prawdziwa wysylke - ta ma juz wlasne testy w innych plikach.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { uruchomHarmonogramPrzypomnien } = require('../server/logika/harmonogram');

test('uruchomHarmonogramPrzypomnien: wywoluje natychmiast i cyklicznie, bez zewnetrznego cron', async () => {
  const wywolania = [];
  const fikcyjnaBaza = {};

  const uchwyt = uruchomHarmonogramPrzypomnien(fikcyjnaBaza, {
    wyslij: async (db, opcje) => {
      wywolania.push({ db, opcje });
    },
    interwalMs: 20,
    dni: 30,
  });

  await new Promise((r) => setTimeout(r, 5));
  assert.equal(wywolania.length, 1, 'pierwsze wywolanie natychmiast, bez czekania na pierwszy interwal');
  assert.equal(wywolania[0].db, fikcyjnaBaza);
  assert.equal(wywolania[0].opcje.dni, 30);
  assert.equal(wywolania[0].opcje.autor, 'automat');

  await new Promise((r) => setTimeout(r, 65));
  clearInterval(uchwyt);
  assert.ok(
    wywolania.length >= 3,
    `oczekiwano co najmniej 3 wywolan w oknie ~70ms przy interwale 20ms, bylo ${wywolania.length}`
  );
});

test('uruchomHarmonogramPrzypomnien: blad wysylki jest zlapany i zalogowany, nie wywraca procesu', async () => {
  const oryginalError = console.error;
  const zalogowane = [];
  console.error = (...args) => zalogowane.push(args.join(' '));
  try {
    const uchwyt = uruchomHarmonogramPrzypomnien(
      {},
      { wyslij: async () => { throw new Error('awaria testowa'); }, interwalMs: 10_000 }
    );
    await new Promise((r) => setTimeout(r, 10));
    clearInterval(uchwyt);
    assert.ok(zalogowane.some((l) => l.includes('awaria testowa')), 'blad z wyslij trafia do console.error');
  } finally {
    console.error = oryginalError;
  }
});
