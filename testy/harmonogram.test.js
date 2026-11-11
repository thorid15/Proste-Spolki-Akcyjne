'use strict';

/** Jeden proces dzienny uruchamiany od razu po starcie i potem cyklicznie — bez zewnętrznego crona. */

const test = require('node:test');
const assert = require('node:assert/strict');

const { uruchomProcesDzienny } = require('../server/logika/harmonogram');

test('proces dzienny: od razu po starcie i cyklicznie', async () => {
  let wywolania = 0;
  const uchwyt = uruchomProcesDzienny('db', { interwalMs: 20, proces: async (db) => { assert.equal(db, 'db'); wywolania += 1; } });
  await new Promise((r) => setTimeout(r, 70));
  clearInterval(uchwyt);
  assert.ok(wywolania >= 3, `wywołań: ${wywolania}`);
});

test('proces dzienny: błąd jest złapany i zapisany w logu, proces serwera trwa', async () => {
  const bledy = [];
  const oryginal = console.error;
  console.error = (m) => bledy.push(m);
  try {
    const uchwyt = uruchomProcesDzienny('db', { interwalMs: 1000, proces: async () => { throw new Error('SMTP niedostępny'); } });
    await new Promise((r) => setTimeout(r, 10));
    clearInterval(uchwyt);
  } finally {
    console.error = oryginal;
  }
  assert.deepEqual(bledy, ['[psa] proces dzienny: SMTP niedostępny']);
});
