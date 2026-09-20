'use strict';
// Test: zerwanie polaczenia klienta W TRAKCIE zapisu (POST /api/psa/osoby).
// Sprawdza, czy zapis mimo to trafia do bazy (serwer synchroniczny,
// better-sqlite3) i czy klient dostaje jakikolwiek sygnal.
async function main() {
  const cookie = require('fs').readFileSync('/tmp/faza7-cookies.txt', 'utf8')
    .split('\n').find((l) => l.includes('psa_sesja'))
    .split('\t').pop().trim();

  const znacznik = `AbortTest-${Date.now()}`;
  const controller = new AbortController();
  const body = JSON.stringify({ typ: 'fizyczna', nazwisko: znacznik, imie: 'X' });

  const p = fetch('http://localhost:3005/api/psa/osoby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `psa_sesja=${cookie}` },
    body,
    signal: controller.signal,
  }).then((r) => ({ ok: true, status: r.status })).catch((e) => ({ ok: false, err: e.message }));

  // Zrywamy polaczenie natychmiast (0ms) - PRZED jakimkolwiek uplywem czasu.
  controller.abort();
  const wynikKlienta = await p;
  console.log('Wynik po stronie klienta:', JSON.stringify(wynikKlienta));

  // Czekamy chwile i sprawdzamy, czy mimo to zapis trafil do bazy.
  await new Promise((r) => setTimeout(r, 500));
  const sprawdz = await fetch(`http://localhost:3005/api/psa/osoby?q=${znacznik}`, {
    headers: { Cookie: `psa_sesja=${cookie}` },
  }).then((r) => r.json());
  console.log('Czy osoba trafila do bazy mimo zerwania:', sprawdz.osoby.length > 0, sprawdz.osoby.map((o) => o.id));
}

main().catch((e) => { console.error(e); process.exit(1); });
