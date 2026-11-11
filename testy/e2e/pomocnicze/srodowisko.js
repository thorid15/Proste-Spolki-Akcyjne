'use strict';

/**
 * Środowisko scenariusza e2e (SESJA-PSA-ANALIZA-PRZEPLYWOW, Faza 2).
 *
 * Każdy test dostaje WŁASNY serwer w trybie testowym na świeżej bazie z `test:seed`
 * (osobny katalog `dane-testowe/e2e/<n>/`, osobny port) — to jest reset danych przed scenariuszem
 * (ta sama baza co w `npm run test:seed`).
 *
 * Strażnik: zanim scenariusz ruszy, serwer MUSI pokazać panel trybu testowego (`/test`) i skrzynkę
 * testową (`/test/skrzynka`) — w trybie testowym `poczta.js` zawsze pisze do skrzynki (atrapa wysyłki).
 * Bez tego test kończy się błędem, zanim dotknie danych.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const base = require('@playwright/test');
const { HASLO } = require('./ekrany');

const KORZEN = path.join(__dirname, '..', '..', '..');
const SERWER = path.join(__dirname, 'serwer-testowy.js');
let licznik = 0;

function wolnyPort() {
  return new Promise((ok, zle) => {
    const srv = require('node:net').createServer();
    srv.once('error', zle);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => ok(port)); });
  });
}

async function czekajNaSerwer(adres, proc, limitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < limitMs) {
    if (proc.exitCode !== null) throw new Error(`serwer testowy zakończył się (kod ${proc.exitCode})`);
    try {
      const odp = await fetch(`${adres}/test`);
      if (odp.ok) return;
    } catch { /* jeszcze nie słucha */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('serwer testowy nie wstał w 60 s');
}

/** Strażnik trybu testowego i atrapy wysyłki e-mail. Rzuca, gdy którejś brak. */
async function straznik(adres) {
  const panel = await fetch(`${adres}/test`).catch(() => null);
  const tresc = panel && panel.ok ? await panel.text() : '';
  const skrzynka = await fetch(`${adres}/test/skrzynka`).catch(() => null);
  if (!/Panel trybu testowego/.test(tresc)) throw new Error('STRAŻNIK: serwer nie działa w trybie testowym — scenariusz przerwany.');
  if (!skrzynka || !skrzynka.ok) throw new Error('STRAŻNIK: brak skrzynki testowej (atrapy wysyłki e-mail) — scenariusz przerwany.');
}

async function uruchomSerwer() {
  licznik += 1;
  const nr = `${process.pid}-${licznik}`;
  const katalog = path.join(KORZEN, 'dane-testowe', 'e2e', nr);
  fs.rmSync(katalog, { recursive: true, force: true });
  const port = await wolnyPort();
  const proc = spawn(process.execPath, [SERWER], {
    cwd: KORZEN,
    env: { ...process.env, PSA_ZRZUTY_PORT: String(port), PSA_E2E_KATALOG: katalog, PSA_TRYB_TESTOWY: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  const adres = `http://127.0.0.1:${port}`;
  try {
    await czekajNaSerwer(adres, proc);
  } catch (e) {
    proc.kill();
    throw new Error(`${e.message}\n${stderr.slice(-2000)}`);
  }
  await straznik(adres);
  return {
    adres,
    katalog,
    async zatrzymaj() {
      proc.kill();
      await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
      fs.rmSync(katalog, { recursive: true, force: true });
    },
  };
}

/** Logowanie przez API (to samo co ekran logowania; samo logowanie nie jest częścią procesu). */
async function zaloguj(page, email, aplikacja) {
  const trasa = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';
  const odp = await page.request.post(trasa, { data: { email, haslo: HASLO, droga_testowa: 'formularz' } });
  if (!odp.ok()) throw new Error(`logowanie ${email}: ${odp.status()} ${await odp.text()}`);
}

/** Zapytanie API z sesją strony (przygotowanie danych scenariusza przez zwykłe API — te same walidacje). */
async function api(page, metoda, trasa, dane) {
  const odp = await page.request.fetch(trasa, { method: metoda, data: dane });
  const tekst = await odp.text();
  let json = null;
  try { json = JSON.parse(tekst); } catch { /* nie JSON */ }
  if (!odp.ok()) throw new Error(`${metoda} ${trasa}: ${odp.status()} ${tekst.slice(0, 300)}`);
  return json;
}

const test = base.test.extend({
  serwer: [async ({}, use) => {
    const s = await uruchomSerwer();
    await use(s);
    await s.zatrzymaj();
  }, { scope: 'test', timeout: 90000 }],
  baseURL: async ({ serwer }, use) => use(serwer.adres),
});

module.exports = { test, expect: base.expect, zaloguj, api, straznik, uruchomSerwer, KORZEN };
