'use strict';

/**
 * Testy integracyjne rozliczen przez HTTP (sekcja 8): naliczanie przy wpisie
 * odplatnym (sprawa-bound), brak naliczenia przy zajeciu z_urzedu i przy
 * migracji "stan otwarcia" (sciezka bezposrednia), naliczenie roczne
 * (admin, idempotentne), reczny wpis, zmiana statusu, filtry, eksport CSV,
 * oplata za informacje z portalu, stuby sadowe (501 przed nowelizacja).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-oplaty-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-oplaty-dokumenty');
process.env.PORTAL_WLACZONY = 'true';
process.env.ADMIN_EMAIL = 'admin-oplaty@example.pl';

const app = require('../serwer');
const { db } = require('../server/baza');
const auth = require('../server/trasy/auth');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoAdmina;
let ciastkoPracownika;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zaloguj(email, haslo) {
  const odp = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo }),
  });
  assert.equal(odp.status, 200, `logowanie ${email} nie powiodło się`);
  return ciasteczkoZOdpowiedzi(odp);
}

async function zapytaj(ciastko, metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { Cookie: ciastko } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const dane = await odp.json();
  return [odp.status, dane];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  await auth.zapewnijAdmina(db(), process.env.ADMIN_EMAIL);
  const hashAdmina = await hasla.hashuj('HasloAdmina123');
  db().prepare('UPDATE psa_uzytkownicy SET hash_hasla = ? WHERE email = ?').run(hashAdmina, process.env.ADMIN_EMAIL);
  ciastkoAdmina = await zaloguj(process.env.ADMIN_EMAIL, 'HasloAdmina123');

  const hashPracownika = await hasla.hashuj('HasloPracownika123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Pracownik Testowy', 'pracownik-oplaty@example.pl', ?, 'pracownik', 1, ?)`
    )
    .run(hashPracownika, new Date().toISOString());
  ciastkoPracownika = await zaloguj('pracownik-oplaty@example.pl', 'HasloPracownika123');
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

let licznik = 0;
async function przygotujSpolke() {
  licznik += 1;
  const sufiks = String(licznik).padStart(4, '0');
  const [, spolkaOdp] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/spolki', {
    nazwa: `Oplaty Testowa P.S.A. ${sufiks}`,
    krs: `0001${sufiks}00`,
  });
  const spolkaId = spolkaOdp.spolka.id;

  const [, kowalski] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Kowalski', imie: `Jan${sufiks}`,
    data_urodzenia: '1980-01-01', aml_status: 'wykonane',
  });
  const [, nowak] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Nowak', imie: `Anna${sufiks}`,
    data_urodzenia: '1985-05-05', aml_status: 'wykonane',
  });

  return { spolkaId, kowalski: kowalski.osoba, nowak: nowak.osoba };
}

test('wpis odplatny przez sprawe nalicza oplate typu wpis', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();

  const [, sprawaOdp] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'emisja', zrodlo: 'papier',
  });
  const sprawaId = sprawaOdp.sprawa.id;
  await zapytaj(ciastkoAdmina, 'PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });

  const [status, wpisOdp] = await zapytaj(ciastkoAdmina, 'POST', `/api/psa/sprawy/${sprawaId}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: { seria: 'A', ilosc: 100 },
  });
  assert.equal(status, 201);
  assert.equal(wpisOdp.oplata.typ, 'wpis');
  assert.equal(wpisOdp.oplata.sprawa_id, sprawaId);

  const [, listaOdp] = await zapytaj(ciastkoAdmina, 'GET', `/api/psa/oplaty?spolka_id=${spolkaId}`);
  assert.equal(listaOdp.oplaty.length, 1);
  assert.equal(listaOdp.oplaty[0].typ, 'wpis');
  void kowalski;
});

test('zajecie z urzedu (wolne od oplat) NIE nalicza oplaty', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const emisja = await zapytaj(ciastkoAdmina, 'POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'emisja', data_zdarzenia: '2026-01-01', dane: { seria: 'A', ilosc: 50, data_wpisu_krs: '2026-01-01' },
  });
  await zapytaj(ciastkoAdmina, 'POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'objecie', data_zdarzenia: '2026-01-01',
    dane: { emisja_zdarzenie_id: emisja[1].zdarzenie.id, pozycje: [{ osoba_id: kowalski.id, ilosc: 50 }] },
  });

  const [, komornik] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: 'Komornik Testowy', nazwisko: null,
  });

  const [, sprawaOdp] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'zajecie', zrodlo: 'z_urzedu',
  });
  const [status, wpisOdp] = await zapytaj(ciastkoAdmina, 'POST', `/api/psa/sprawy/${sprawaOdp.sprawa.id}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: { emisja_zdarzenie_id: emisja[1].zdarzenie.id, akcjonariusz_osoba_id: kowalski.id, osoba_id: komornik.osoba.id, ilosc: 10 },
  });
  assert.equal(status, 201);
  assert.equal(wpisOdp.oplata, null);

  const [, listaOdp] = await zapytaj(ciastkoAdmina, 'GET', `/api/psa/oplaty?spolka_id=${spolkaId}`);
  assert.equal(listaOdp.oplaty.length, 0);
});

test('migracja "stan otwarcia" (sciezka bezposrednia) NIE nalicza oplaty', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  await zapytaj(ciastkoAdmina, 'POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'emisja', data_zdarzenia: '2020-01-01', dane: { seria: 'A', ilosc: 100 },
  });
  const [, listaOdp] = await zapytaj(ciastkoAdmina, 'GET', `/api/psa/oplaty?spolka_id=${spolkaId}`);
  assert.equal(listaOdp.oplaty.length, 0, 'wpis historyczny spoza workflow spraw nie jest odpłatny');
  void kowalski;
});

test('naliczenie roczne: tylko admin, idempotentne przez HTTP', async () => {
  const { spolkaId } = await przygotujSpolke();

  const [odmowa] = await zapytaj(ciastkoPracownika, 'POST', '/api/psa/oplaty/naliczenie-roczne', { rok: '2031' });
  assert.equal(odmowa, 403);

  const [stPierwszy, pierwszy] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/oplaty/naliczenie-roczne', { rok: '2031' });
  assert.equal(stPierwszy, 200);
  assert.equal(pierwszy.naliczone.some((o) => o.spolka_id === spolkaId), true);

  const [, drugi] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/oplaty/naliczenie-roczne', { rok: '2031' });
  assert.equal(drugi.pominiete.some((o) => o.spolka_id === spolkaId), true);
  assert.equal(drugi.naliczone.some((o) => o.spolka_id === spolkaId), false);
});

test('reczny wpis oplaty: walidacja typu i okresu, PATCH zmienia status', async () => {
  const { spolkaId } = await przygotujSpolke();

  const [zlyTyp] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/oplaty', { spolka_id: spolkaId, typ: 'cos-innego' });
  assert.equal(zlyTyp, 400);

  const [brakOkresu] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/oplaty', { spolka_id: spolkaId, typ: 'prowadzenie' });
  assert.equal(brakOkresu, 400);

  const [status, wpis] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/oplaty', {
    spolka_id: spolkaId, typ: 'informacja', notatka: 'wydana na miejscu',
  });
  assert.equal(status, 201);
  assert.equal(wpis.oplata.status, 'naliczona');

  const [stPatch, poPatch] = await zapytaj(ciastkoAdmina, 'PATCH', `/api/psa/oplaty/${wpis.oplata.id}`, { status: 'oplacona' });
  assert.equal(stPatch, 200);
  assert.equal(poPatch.oplata.status, 'oplacona');

  const [zlyStatus] = await zapytaj(ciastkoAdmina, 'PATCH', `/api/psa/oplaty/${wpis.oplata.id}`, { status: 'cos-innego' });
  assert.equal(zlyStatus, 400);
});

test('eksport CSV zwraca text/csv z naglowkiem BOM (Excel PL) i poprawna trescia', async () => {
  const odp = await fetch(`${baza}/api/psa/oplaty/eksport`, { headers: { Cookie: ciastkoAdmina } });
  assert.equal(odp.status, 200);
  assert.match(odp.headers.get('content-type'), /text\/csv/);

  // `.text()` dekoduje UTF-8 i domyslnie ZDEJMUJE BOM (spec WHATWG Encoding) -
  // BOM sprawdzamy wiec na surowych bajtach, nie na zdekodowanym tekscie.
  const bajty = new Uint8Array(await odp.clone().arrayBuffer());
  assert.deepEqual([...bajty.slice(0, 3)], [0xef, 0xbb, 0xbf], 'plik zaczyna sie od UTF-8 BOM');

  const tekst = await odp.text();
  assert.match(tekst, /^id,spolka,typ,okres,kwota_zl,status,data_naliczenia,notatka,autor/);
});

test('portal: pobranie informacji z rejestru nalicza oplate', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const emisja = await zapytaj(ciastkoAdmina, 'POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'emisja', data_zdarzenia: '2026-01-01', dane: { seria: 'A', ilosc: 20, data_wpisu_krs: '2026-01-01' },
  });
  await zapytaj(ciastkoAdmina, 'POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'objecie', data_zdarzenia: '2026-01-01',
    dane: { emisja_zdarzenie_id: emisja[1].zdarzenie.id, pozycje: [{ osoba_id: kowalski.id, ilosc: 20 }] },
  });

  const hashPortal = await hasla.hashuj('HasloPortal12345');
  db()
    .prepare(
      `INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono)
       VALUES (?, ?, 'akcjonariusz', ?, 1, ?)`
    )
    .run('portal-oplaty@example.pl', hashPortal, kowalski.id, new Date().toISOString());

  const loginPortal = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'portal-oplaty@example.pl', haslo: 'HasloPortal12345' }),
  });
  const ciastkoPortal = ciasteczkoZOdpowiedzi(loginPortal);

  const odpInf = await fetch(`${baza}/api/psa/portal/informacja`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastkoPortal },
    body: JSON.stringify({ spolka_id: spolkaId }),
  });
  assert.equal(odpInf.status, 200);
  const infOdp = await odpInf.json();
  assert.equal(infOdp.oplata.typ, 'informacja');

  const [, listaOdp] = await zapytaj(ciastkoAdmina, 'GET', `/api/psa/oplaty?spolka_id=${spolkaId}&typ=informacja`);
  assert.equal(listaOdp.oplaty.length, 1);
});

test('stuby sadowe zwracaja 501 przed wejsciem w zycie nowelizacji', async () => {
  const { spolkaId } = await przygotujSpolke();

  const [stZapytania, zapytaniaOdp] = await zapytaj(ciastkoAdmina, 'POST', '/api/psa/sad/zapytania', { spolka_id: spolkaId });
  assert.equal(stZapytania, 501);
  assert.equal(zapytaniaOdp.wymaga_weryfikacji_brzmienia, true);
  assert.match(zapytaniaOdp.uruchomienie, /2027-02-18/);

  const [stZawiadomienie, zawiadomienieOdp] = await zapytaj(
    ciastkoAdmina, 'POST', '/api/psa/sad/zawiadomienie-o-rozwiazaniu', { spolka_id: spolkaId }
  );
  assert.equal(stZawiadomienie, 501);
  assert.match(zawiadomienieOdp.podstawa, /300\(32\)/);
});

test('trasa oplat wymaga sesji pracownika', async () => {
  const odp = await fetch(`${baza}/api/psa/oplaty`);
  assert.equal(odp.status, 401);
});
