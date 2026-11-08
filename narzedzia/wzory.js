'use strict';

/**
 * `npm run wzory` — podgląd PDF każdego wzoru pisma z danymi próbnymi (`wzory/dane-probne.json`).
 * Wynik: `wzory/podglad/<wzór>.pdf`. Pole bez wartości kończy działanie błędem.
 */

const fs = require('node:fs');
const path = require('node:path');
const pisma = require('../server/logika/pisma');
const wzory = require('../server/logika/wzory');

const KATALOG = path.join(__dirname, '..', 'wzory');
const WYNIK = path.join(KATALOG, 'podglad');

async function main() {
  const dane = JSON.parse(fs.readFileSync(path.join(KATALOG, 'dane-probne.json'), 'utf8'));
  fs.mkdirSync(WYNIK, { recursive: true });
  let bledy = 0;
  for (const typ of Object.keys(pisma.TYPY)) {
    const nazwa = pisma.nazwaWzoru(typ);
    const kontekst = { ...dane.wspolne, ...dane[nazwa], data: '08.11.2026' };
    const { brakujace } = wzory.wypelnij(wzory.wczytaj(nazwa), kontekst);
    if (brakujace.length > 0) {
      bledy += 1;
      console.error(`✗ ${nazwa}: brak pól ${brakujace.join(', ')}`);
      continue;
    }
    const { bufor, strony } = await pisma.renderuj(typ, kontekst, typ === 'informacja' ? 'INF/2026/0001' : 'PSA/2026/0001');
    fs.writeFileSync(path.join(WYNIK, `${nazwa}.pdf`), bufor);
    console.log(`✓ ${nazwa}.pdf (${strony} str.)`);
  }
  if (bledy > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
