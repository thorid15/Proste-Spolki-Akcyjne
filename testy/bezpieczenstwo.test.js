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

/** Formularz multipart z dowolnymi polami tekstowymi (nazwy pól jak w próbie z audytu W1). */
function multipart(pola) {
  const granica = '----psa-test';
  const czesci = pola.map(([nazwa, wartosc]) => `--${granica}\r\nContent-Disposition: form-data; name="${nazwa}"\r\n\r\n${wartosc}\r\n`);
  return { naglowki: { 'Content-Type': `multipart/form-data; boundary=${granica}` }, tresc: `${czesci.join('')}--${granica}--\r\n` };
}

test('W1: wgranie pliku do portalu bez sesji — 401 od razu, także dla pól, które zawieszały parser', async () => {
  const { naglowki, tresc } = multipart([['a[4294967294][0]', 'x'], ['a[x]', 'y']]);
  for (const sciezka of ['/api/psa/portal/wniosek/pliki', '/api/psa/portal/sprawy/1/pliki']) {
    const start = Date.now();
    const odp = await fetch(`${ADRES}${sciezka}`, { method: 'POST', headers: { ...naglowki, Origin: ADRES }, body: tresc, signal: AbortSignal.timeout(5000) });
    assert.equal(odp.status, 401, sciezka);
    assert.ok(Date.now() - start < 2000, `${sciezka}: odpowiedź w ${Date.now() - start} ms`);
  }
});

test('W1: wgranie pliku przez pracownika wymaga sesji; nadmiar pól formularza to 4xx, nie zawieszenie', async () => {
  const { naglowki, tresc } = multipart(Array.from({ length: 40 }, (_, i) => [`p${i}`, 'x']));
  for (const sciezka of ['/api/psa/sprawy/1/pliki', '/api/psa/wnioski/1/pliki', '/api/psa/osoby/1/pliki']) {
    const odp = await fetch(`${ADRES}${sciezka}`, { method: 'POST', headers: { ...naglowki, Origin: ADRES }, body: tresc, signal: AbortSignal.timeout(5000) });
    assert.equal(odp.status, 401, sciezka);
  }
  assert.equal(require('multer/package.json').version.split('.')[0] >= '2', true, 'multer 2.x (1.x: znane podatności DoS)');
});

test('W1: parser formularza nie zawiesza się na polach a[4294967294][0] i odrzuca nadmiar pól', async () => {
  const express = require('express');
  const pliki = require('../server/pomocnicze/pliki');
  const proba = express();
  proba.post('/x', (zad, odp) => pliki.odbierz(zad, odp, (e) => odp.status(e ? 400 : 200).json({ kod: e ? e.code || e.message : null })));
  const s = proba.listen(0);
  await new Promise((r) => s.once('listening', r));
  const adres = `http://127.0.0.1:${s.address().port}/x`;
  try {
    const grozne = multipart([['a[4294967294][0]', 'x'], ['a[x]', 'y']]);
    const start = Date.now();
    const odp = await fetch(adres, { method: 'POST', headers: grozne.naglowki, body: grozne.tresc, signal: AbortSignal.timeout(5000) });
    assert.equal(odp.status, 400, 'pola tekstowe nie są przyjmowane');
    assert.ok(Date.now() - start < 2000, `odpowiedź w ${Date.now() - start} ms`);
    const duzo = multipart(Array.from({ length: 40 }, (_, i) => [`p${i}`, 'x']));
    const nadmiar = await fetch(adres, { method: 'POST', headers: duzo.naglowki, body: duzo.tresc, signal: AbortSignal.timeout(5000) });
    assert.equal(nadmiar.status, 400);
    assert.match((await nadmiar.json()).kod, /LIMIT_(FIELD|PART)_COUNT/);
  } finally {
    s.close();
  }
});

test('W2: adresy kancelarii — maska CIDR, adres dokładny, IPv4 w zapisie IPv6; pusta lista nie ogranicza', () => {
  const adresy = require('../server/logika/adresy');
  assert.equal(adresy.nalezy('10.0.0.5', ['10.0.0.0/8']), true);
  assert.equal(adresy.nalezy('192.168.2.1', ['192.168.1.0/24']), false);
  assert.equal(adresy.nalezy('::ffff:192.168.1.7', ['192.168.1.0/24']), true);
  assert.equal(adresy.nalezy('203.0.113.10', ['192.168.1.0/24', '203.0.113.10']), true);
  assert.equal(adresy.nalezy('203.0.113.11', ['192.168.1.0/24', '203.0.113.10']), false);
  assert.equal(adresy.nalezy('::1', ['::1']), true);
  assert.equal(adresy.nalezy('198.51.100.1', []), true);
  assert.deepEqual(adresy.wczytajListe(' 192.168.1.0/24, 203.0.113.10 '), ['192.168.1.0/24', '203.0.113.10']);
  assert.throws(() => adresy.wczytajListe('192.168.1.0/33'), /KANCELARIA_ADRESY/);
  assert.throws(() => adresy.wczytajListe('biuro'), /KANCELARIA_ADRESY/);
});

test('W2: trasy pracowników spoza sieci kancelarii — 403; portal, dane do stopki i ITN tpay działają dalej', async () => {
  const lista = konfiguracja.KANCELARIA_ADRESY;
  konfiguracja.KANCELARIA_ADRESY = ['10.9.9.9'];
  try {
    const login = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ADRES }, body: '{}' });
    assert.equal(login.status, 403);
    assert.equal((await login.json()).blad, 'Dostęp tylko z sieci kancelarii.');
    for (const s of ['/api/psa/spolki', '/api/psa/sprawy', '/api/psa/pulpit', '/api/psa/auth/whoami']) assert.equal((await fetch(`${ADRES}${s}`)).status, 403, s);
    assert.equal((await fetch(`${ADRES}/api/psa/portal/ja`)).status, 200);
    assert.equal((await fetch(`${ADRES}/api/wspolne/kancelaria`)).status, 200);
    const itn = await fetch(`${ADRES}/api/psa/platnosci/tpay/itn`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
    assert.notEqual(itn.status, 403);
    konfiguracja.KANCELARIA_ADRESY = ['127.0.0.1', '::1'];
    assert.equal((await fetch(`${ADRES}/api/psa/spolki`)).status, 401, 'z sieci kancelarii — zwykła kontrola sesji');
  } finally {
    konfiguracja.KANCELARIA_ADRESY = lista;
  }
});

test('PORTAL_WLACZONY=false — cały portal 503', async () => {
  konfiguracja.PORTAL_WLACZONY = false;
  try {
    assert.equal((await fetch(`${ADRES}/api/psa/portal/ja`)).status, 503);
  } finally {
    konfiguracja.PORTAL_WLACZONY = true;
  }
});
