'use strict';

/** Zadanie 0 — zrzuty bez trybu testowego kończą się błędem. */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const start = require('./e2e/pomocnicze/start');

test('start zrzutów: serwer bez trybu testowego → błąd', async () => {
  const serwer = http.createServer((zad, odp) => { odp.writeHead(404); odp.end(); }).listen(0);
  await new Promise((r) => serwer.once('listening', r));
  try {
    await assert.rejects(
      start({ projects: [{ use: { baseURL: `http://127.0.0.1:${serwer.address().port}` } }] }),
      /nie działa w trybie testowym/
    );
  } finally {
    serwer.close();
  }
});
