#!/usr/bin/env node
'use strict';
/**
 * `npm run dokumentacja` (część): `docs/endpointy-api.md` — trasy API z introspekcji routerów
 * zamontowanych w `serwer.js` (metoda, ścieżka, rola). Baza tymczasowa — nie dotyka danych kancelarii.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.WSPOLNA_BAZA = path.join(os.tmpdir(), `psa-dokumentacja-${process.pid}.db`);
process.env.SESJA_SEKRET = 'dokumentacja-tymczasowy-sekret-do-generowania';

const { ROUTERY_API } = require('../serwer');
const { listaTras } = require('./trasy');

const trasy = listaTras(ROUTERY_API);
const linie = [
  '# Endpointy API',
  '',
  '> Wygenerowane przez `npm run dokumentacja` (introspekcja routerów). Rola: `pracownik`, `admin` — sesja kancelarii;',
  '> `portal` — sesja konta, zakres z `zakresKonta()` (cudze dane — 404); `publiczna` — bez sesji.',
  '',
  `Razem: ${trasy.length} tras (portal: ${trasy.filter((t) => t.rola === 'portal' || t.sciezka.startsWith('/api/psa/portal')).length}).`,
  '',
  '| Metoda | Ścieżka | Rola |',
  '|---|---|---|',
  ...trasy.map((t) => `| ${t.metoda} | \`${t.sciezka}\` | ${t.rola} |`),
  '',
];
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'endpointy-api.md'), linie.join('\n'));
for (const p of [process.env.WSPOLNA_BAZA, `${process.env.WSPOLNA_BAZA}-wal`, `${process.env.WSPOLNA_BAZA}-shm`]) fs.rmSync(p, { force: true });
console.log(`[dokumentacja] docs/endpointy-api.md — ${trasy.length} tras`);
process.exit(0);
