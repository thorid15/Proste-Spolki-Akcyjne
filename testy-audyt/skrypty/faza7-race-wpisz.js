'use strict';
// Test wyscigu (race condition) dla POST /api/psa/sprawy/:id/wpisz - dwa
// ROWNOCZESNE zadania wpisu tej samej sprawy. Faza 7 audytu PSA.
const AID = 30, BID = 31, SID = 7, EMISJA = 32;

async function main() {
  const cookie = require('fs').readFileSync('/tmp/faza7-cookies.txt', 'utf8')
    .split('\n').find((l) => l.includes('psa_sesja'))
    .split('\t').pop().trim();

  const body = JSON.stringify({
    data_zdarzenia: '2026-09-05',
    dane: {
      emisja_zdarzenie_id: EMISJA,
      zbywca_osoba_id: AID,
      pozycje: [{ nabywca_osoba_id: BID, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    },
  });

  const zadanie = () =>
    fetch(`http://localhost:3005/api/psa/sprawy/${SID}/wpisz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `psa_sesja=${cookie}` },
      body,
    }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

  const [r1, r2] = await Promise.all([zadanie(), zadanie()]);
  console.log('Wynik 1:', r1.status, JSON.stringify(r1.json));
  console.log('Wynik 2:', r2.status, JSON.stringify(r2.json));
}

main().catch((e) => { console.error(e); process.exit(1); });
