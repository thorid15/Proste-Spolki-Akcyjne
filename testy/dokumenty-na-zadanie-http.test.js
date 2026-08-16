'use strict';

/**
 * Wystawianie pism na żądanie ze spółki (blok A5 sesji 8): pięć wzorów
 * jednorazowych (umowa, RODO, uchwała, lista dla sądu, klauzula zbycia),
 * podgląd na realnych danych i zapis do psa_wydane_dokumenty z hashem wzoru.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-na-zadanie-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-na-zadanie-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastko;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { Cookie: ciastko } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const typ = odp.headers.get('content-type') || '';
  return [odp.status, typ.includes('json') ? await odp.json() : await odp.arrayBuffer(), odp.headers];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-na-zadanie@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-na-zadanie@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastko = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

let licznik = 0;
async function nowaSpolka(nadpisania = {}) {
  licznik += 1;
  const sufiks = String(licznik).padStart(4, '0');
  const [, odp] = await zapytaj('POST', '/api/psa/spolki', {
    nazwa: `Na Żądanie ${sufiks} P.S.A.`,
    krs: `0001${sufiks}00`,
    organ_rodzaj: 'zarzad',
    platnik_vat: 1,
    siedziba_miejscownik: 'Testowie',
    reprezentant_biernik: 'Jana Testowego',
    reprezentant_plec: 'mezczyzna',
    ...nadpisania,
  });
  return odp.spolka;
}

test('lista wzorow na zadanie: piec pozycji', async () => {
  const spolka = await nowaSpolka();
  const [status, odp] = await zapytaj('GET', `/api/psa/spolki/${spolka.id}/dokumenty/wystaw`);
  assert.equal(status, 200);
  assert.equal(odp.wzory.length, 5);
  assert.ok(odp.wzory.some((w) => w.kod === '01'));
});

test('podglad 02 (RODO) na realnych danych spolki — bez zapisu', async () => {
  const spolka = await nowaSpolka();
  const [status, odp] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/02/podglad`);
  assert.equal(status, 200);
  assert.deepEqual(odp.bledy, []);
  assert.match(odp.tekst, /zapoznałem się/);

  const [, wydaneOdp] = await zapytaj('GET', `/api/psa/spolki/${spolka.id}/wydane`);
  assert.equal(wydaneOdp.wydane.length, 0, 'podglad nie zostawia sladu');
});

test('wystawienie 01 (umowa): zapis w psa_wydane_dokumenty z hashem, plik pobieralny', async () => {
  const spolka = await nowaSpolka();
  const [status, odp] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/01`);
  assert.equal(status, 201);
  assert.deepEqual(odp.bledy, []);

  const wiersz = db().prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(odp.id);
  assert.equal(wiersz.typ, 'umowa_rejestru');
  assert.equal(wiersz.szablon_kod, '01');
  assert.ok(wiersz.szablon_hash.length > 0);
  assert.ok(wiersz.sciezka_plik);
  assert.equal(wiersz.sprawa_id, null);

  const [plikStatus, bajty, naglowki] = await zapytaj('GET', `/api/psa/spolki/${spolka.id}/wydane/${odp.id}/plik`);
  assert.equal(plikStatus, 200);
  assert.match(naglowki.get('content-type'), /wordprocessingml/);
  const bufor = Buffer.from(bajty);
  assert.equal(bufor.readUInt32LE(0), 0x04034b50, 'poprawne archiwum ZIP');
});

test('wystawienie 03 (uchwala): dane glosowania ad hoc trafiaja do tresci', async () => {
  const spolka = await nowaSpolka();
  const [status, odp] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/03`, {
    uchwala: {
      numer: '1', dataSlownie: '12 sierpnia 2026 roku', trybGlosowania: 'jednogłośnie',
      glosyZa: 100, glosyPrzeciw: 0, glosyWstrzymujace: 0, procentGlosow: '100%',
    },
  });
  assert.equal(status, 201);
  const wiersz = db().prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(odp.id);
  assert.match(wiersz.tresc_html, /jednogłośnie/);
});

test('wystawienie 10 (klauzula): zbywca i nabywca ze wskazanych osob w kartotece', async () => {
  const spolka = await nowaSpolka();
  const [, zbywcaOdp] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: 'Nowak', imie: 'Anna', email: 'anna@nowak.pl' });
  const [, nabywcaOdp] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan', email: 'jan@kowalski.pl' });

  const [status, odp] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/10`, {
    klauzula: { paragraf: '7', pokrycie: 'zostały w całości pokryte', ograniczenia: 'brak' },
    zbywca_osoba_id: zbywcaOdp.osoba.id,
    nabywca_osoba_id: nabywcaOdp.osoba.id,
  });
  assert.equal(status, 201);
  const wiersz = db().prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(odp.id);
  assert.match(wiersz.tresc_html, /anna@nowak\.pl/);
  assert.match(wiersz.tresc_html, /jan@kowalski\.pl/);
});

test('brakujace dane (np. brak reprezentanta) nie blokuja wystawienia — wracaja w odpowiedzi', async () => {
  const spolka = await nowaSpolka({ reprezentant_biernik: null, organ_rodzaj: null, platnik_vat: null });
  const [status, odp] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/01`);
  assert.equal(status, 201, 'wystawienie sie udaje mimo brakow');
  assert.ok(odp.brakujace.includes('reprezentant_biernik'));
});

test('nieznany kod wzoru daje 404', async () => {
  const spolka = await nowaSpolka();
  const [status] = await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/99/podglad`);
  assert.equal(status, 404);
});

test('historia wydanych na zadanie nie miesza sie z dokumentami sprawy', async () => {
  const spolka = await nowaSpolka();
  await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/02`);
  await zapytaj('POST', `/api/psa/spolki/${spolka.id}/dokumenty/10`, {
    klauzula: {}, zbywca_osoba_id: null, nabywca_osoba_id: null,
  });
  const [, odp] = await zapytaj('GET', `/api/psa/spolki/${spolka.id}/wydane`);
  assert.equal(odp.wydane.length, 2);
  assert.ok(odp.wydane.every((w) => w.szablon_kod));
});
