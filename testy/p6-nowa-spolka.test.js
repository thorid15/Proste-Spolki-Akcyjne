'use strict';

/** R4 zad. 10 (P6): kolejnej spółki nie zakłada się w tym samym logowaniu — każda przez zgłoszenie. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-p6.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-p6-dok');
process.env.PORTAL_WLACZONY = 'true';
delete process.env.PSA_TRYB_TESTOWY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let ADRES;
const ciastko = (odp) => odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
async function zapytaj(metoda, sciezka, cialo, kto) {
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: { 'Content-Type': 'application/json', Cookie: kto }, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
  return [odp.status, await odp.json()];
}
async function kontoSpolki(email, krs) {
  const teraz = czas.terazIso();
  const spolka = Number(db().prepare(`INSERT INTO psa_spolki (nazwa, krs, forma_prawna, status, utworzono) VALUES (?, ?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`).run(`Spółka ${krs} P.S.A.`, krs, teraz).lastInsertRowid);
  const konto = Number(db().prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, spolka_id, aktywne, utworzono, rodo_zaakceptowano) VALUES (?, ?, 'spolka', ?, 1, ?, ?)`).run(email, await hasla.hashuj('HasloTestowe123'), spolka, teraz, teraz).lastInsertRowid);
  db().prepare('INSERT INTO psa_konta_spolki (konto_id, spolka_id, utworzono) VALUES (?, ?, ?)').run(konto, spolka, teraz);
  const l = await fetch(`${ADRES}/api/psa/portal/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, haslo: 'HasloTestowe123' }) });
  return { konto, ciastko: ciastko(l) };
}

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
});
test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('P6: konto spółki z przyjętym wnioskiem — nowy wniosek 403 z komunikatem', async () => {
  const { ciastko: c } = await kontoSpolki('zarzad-p6@example.pl', '0000600601');
  const [st, odp] = await zapytaj('POST', '/api/psa/portal/wniosek/nowy', {}, c);
  assert.equal(st, 403);
  assert.deepEqual(odp, { blad: 'Każdą spółkę zgłasza się osobno. Aby dodać kolejną spółkę, wypełnij zgłoszenie na stronie rejestru.' });
});

test('P6: wniosek w toku (założony wcześniej) — konto nadal go zapisuje', async () => {
  const { konto, ciastko: c } = await kontoSpolki('zarzad2-p6@example.pl', '0000600602');
  db().prepare('INSERT INTO psa_wnioski (konto_id, utworzono) VALUES (?, ?)').run(konto, czas.terazIso());
  const [st, odp] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Druga Spółka P.S.A.' }, c);
  assert.equal(st, 200, JSON.stringify(odp));
  assert.equal(odp.wniosek.nazwa, 'Druga Spółka P.S.A.');
});
