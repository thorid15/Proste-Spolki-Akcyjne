#!/usr/bin/env node
'use strict';

/**
 * `npm run test:oznacz -- <ścieżka>` — oznacza KOPIĘ bazy (np. prototypu)
 * jako testową, żeby tryb testowy mógł na niej wystartować (T6, D-074).
 *
 * Wymaga wpisania „TAK”. Odmawia dla pliku wskazanego w WSPOLNA_BAZA
 * (baza robocza) i przy NODE_ENV=production. Uruchamia migracje na kopii.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const konfiguracja = require('../server/konfiguracja');

const plik = path.resolve(process.argv[2] || '');
function stop(k) {
  console.error(`[test:oznacz] ${k}`);
  process.exit(1);
}
if (!process.argv[2]) stop('Użycie: npm run test:oznacz -- <ścieżka do kopii bazy>');
if (String(konfiguracja.NODE_ENV || '').toLowerCase() === 'production') stop('Odmowa: NODE_ENV=production.');
if (!fs.existsSync(plik)) stop(`Nie ma pliku ${plik}.`);
const robocza = konfiguracja.WSPOLNA_BAZA_PRODUKCYJNA || konfiguracja.WSPOLNA_BAZA;
if (plik === path.resolve(robocza)) stop(`To jest baza robocza (WSPOLNA_BAZA) — oznacz jej KOPIĘ, nie oryginał.`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
  `Oznaczyć ${plik} jako bazę TESTOWĄ? Tryb testowy będzie na niej zapisywał dane fikcyjne.\nWpisz TAK: `,
  (odp) => {
    rl.close();
    if (String(odp).trim() !== 'TAK') stop('Przerwano — baza bez zmian.');
    const baza = require('../server/baza').otworz(plik);
    require('../server/migracje').uruchom(baza);
    require('../server/tryb-testowy').oznaczBaze(baza, `Kopia oznaczona ręcznie (test:oznacz) — ${path.basename(plik)}`);
    baza.close();
    console.log(`[test:oznacz] Oznaczono. Ustaw w .env: PSA_BAZA_TESTOWA=${plik}`);
  }
);
