'use strict';

/**
 * Przed `npm run e2e` / `e2e:malpa`: czyści poprzedni raport i sprawdza na jednym serwerze próbnym, że
 * działa tryb testowy i atrapa wysyłki (strażnik). Bez tego cały przebieg kończy się błędem.
 */

const fs = require('node:fs');
const path = require('node:path');
const { uruchomSerwer } = require('./srodowisko');
const { RAPORT } = require('./krok');

module.exports = async () => {
  const malpa = process.env.PSA_E2E_TRYB === 'malpa';
  // Małpa i scenariusze piszą do jednego wyniki.json — czyścimy tylko własne części.
  const czesci = path.join(RAPORT, 'czesci');
  if (fs.existsSync(czesci)) {
    for (const f of fs.readdirSync(czesci)) {
      if (malpa === f.startsWith('malpa-')) fs.rmSync(path.join(czesci, f));
    }
  }
  if (!malpa) fs.rmSync(path.join(RAPORT, 'zrzuty'), { recursive: true, force: true });
  fs.rmSync(path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'dane-testowe', 'e2e'), { recursive: true, force: true });
  const s = await uruchomSerwer(); // rzuca, gdy strażnik nie przepuści
  await s.zatrzymaj();
};
