'use strict';

/**
 * § 7 specyfikacji uproszczenia: lista dozwolonych tras (pkt 1), brak HTML z danymi użytkownika i zakaz
 * `dangerouslySetInnerHTML` (pkt 4), nagłówki (pkt 5), `Origin` przy żądaniach zmieniających stan (pkt 6),
 * wyłączenie portalu flagą, limit zamówień informacji (pkt 11). Izolacja portalu — `portal-http.test.js`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-bezpieczenstwo.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
delete process.env.PSA_TRYB_TESTOWY;
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const konfiguracja = require('../server/konfiguracja');
const { listaTras, wiersz } = require('../narzedzia/trasy');

const KORZEN = path.join(__dirname, '..');
let serwer;
let ADRES;

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
});

test('pkt 1: trasy API = testy/trasy-dozwolone.txt (nowa trasa wymaga świadomego dopisania)', () => {
  const dozwolone = fs.readFileSync(path.join(__dirname, 'trasy-dozwolone.txt'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(listaTras(app.ROUTERY_API).map(wiersz), dozwolone);
  assert.ok(dozwolone.filter((l) => l.includes('/api/psa/portal')).length <= 20, 'portal — najwyżej 20 tras (§ 6)');
});

test('pkt 4: front bez dangerouslySetInnerHTML; serwer nie składa stron HTML poza trybem testowym', () => {
  for (const f of fs.readdirSync(path.join(KORZEN, 'publiczne', 'js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(KORZEN, 'publiczne', 'js', f), 'utf8'), /dangerouslySetInnerHTML|\.innerHTML\s*=/, f);
  }
  const pliki = [];
  const zbierz = (d) => fs.readdirSync(d).forEach((f) => {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'tryb-testowy') zbierz(p); } else if (p.endsWith('.js')) pliki.push(p);
  });
  zbierz(path.join(KORZEN, 'server'));
  for (const p of pliki) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /type\('html'\)|text\/html/, p);
});

test('pkt 5: nagłówki — CSP bez zewnętrznych skryptów i bez unsafe-inline, bez ramek, nosniff, Referrer-Policy', async () => {
  const odp = await fetch(`${ADRES}/`);
  const csp = odp.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
  assert.equal(odp.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(odp.headers.get('referrer-policy'), 'same-origin');
});

test('pkt 6: żądanie zmieniające stan z obcym Origin — 403; własny Origin i ITN tpay przechodzą', async () => {
  const post = (sciezka, naglowki = {}) => fetch(`${ADRES}${sciezka}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...naglowki }, body: '{}' });
  assert.equal((await post('/api/psa/portal/login', { Origin: 'https://zla-strona.example' })).status, 403);
  assert.equal((await post('/api/psa/auth/login', { Origin: 'null' })).status, 403);
  assert.equal((await post('/api/psa/portal/login', { Origin: ADRES })).status, 401, 'własna strona — zwykła odpowiedź');
  const itn = await fetch(`${ADRES}/api/psa/platnosci/tpay/itn`, { method: 'POST', headers: { Origin: 'https://zla-strona.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tr_id=x' });
  assert.equal(await itn.text(), 'TRUE', 'ITN — bez sprawdzania Origin');
});

test('PORTAL_WLACZONY=false — cały portal 503', async () => {
  konfiguracja.PORTAL_WLACZONY = false;
  try {
    assert.equal((await fetch(`${ADRES}/api/psa/portal/ja`)).status, 503);
  } finally {
    konfiguracja.PORTAL_WLACZONY = true;
  }
});
