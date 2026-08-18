'use strict';

/**
 * Blok C sesji 8: przegląd okresowy AML (C1), beneficjent rzeczywisty (C2)
 * i oświadczenie PEP (C3) przez `/api/psa/osoby`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-osoby-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;

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
  return [odp.status, await odp.json()];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-osoby@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-osoby@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastko = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

let licznik = 0;
function sufiks() {
  licznik += 1;
  return String(licznik).padStart(4, '0');
}

test('wymaga_przegladu_aml: sygnal wraca w odpowiedzi API, nie blokuje zapisu', async () => {
  const [stSwiezy, swiezy] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `Swiezy${sufiks()}`,
    aml_status: 'wykonane', aml_data: '2026-08-01',
  });
  assert.equal(stSwiezy, 201);
  assert.equal(swiezy.osoba.wymaga_przegladu_aml, false);

  const [stStary, stary] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `Stary${sufiks()}`,
    aml_status: 'wykonane', aml_data: '2020-01-01',
  });
  assert.equal(stStary, 201);
  assert.equal(stary.osoba.wymaga_przegladu_aml, true);

  const [, poPrzegladzie] = await zapytaj('PUT', `/api/psa/osoby/${stary.osoba.id}`, {
    aml_data_przegladu: new Date().toISOString().slice(0, 10),
  });
  assert.equal(poPrzegladzie.osoba.wymaga_przegladu_aml, false, 'swiezy przeglad usuwa sygnal natychmiast');
});

test('wymaga_przegladu_aml: status "brak"/"niemozliwe" nigdy nie daje sygnalu (maja wlasny)', async () => {
  const [, brak] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `Brak${sufiks()}`, aml_status: 'brak',
  });
  assert.equal(brak.osoba.wymaga_przegladu_aml, false);
});

test('PESEL: niepoprawna suma kontrolna daje ostrzezenie, NIE blokuje zapisu (etap 2.8)', async () => {
  const [stPoprawny, poprawny] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `PeselPoprawny${sufiks()}`, pesel: '90071500118',
  });
  assert.equal(stPoprawny, 201);
  assert.deepEqual(poprawny.ostrzezenia, []);

  const [stNiepoprawny, niepoprawny] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `PeselNiepoprawny${sufiks()}`, pesel: '90071500110',
  });
  assert.equal(stNiepoprawny, 201, 'zla suma kontrolna nie blokuje zapisu osoby');
  assert.ok(niepoprawny.ostrzezenia.some((o) => o.includes('Suma kontrolna')));

  const [, poprawka] = await zapytaj('PUT', `/api/psa/osoby/${niepoprawny.osoba.id}`, { pesel: '90071500118' });
  assert.deepEqual(poprawka.ostrzezenia, [], 'poprawiony PESEL usuwa ostrzezenie przy PUT');
});

test('beneficjent rzeczywisty: tylko dla osoby prawnej, tylko na osobe fizyczna, bez samoodwolania', async () => {
  const [, fizyczna] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: `Beneficjent${sufiks()}` });
  const [, prawna1] = await zapytaj('POST', '/api/psa/osoby', { typ: 'prawna', nazwa: `Spolka Jeden ${sufiks()}` });
  const [, prawna2] = await zapytaj('POST', '/api/psa/osoby', { typ: 'prawna', nazwa: `Spolka Dwa ${sufiks()}` });

  const [stFizycznaZBeneficjentem] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `NieMozeMiec${sufiks()}`, beneficjent_rzeczywisty_id: fizyczna.osoba.id,
  });
  assert.equal(stFizycznaZBeneficjentem, 400, 'osoba fizyczna nie ma beneficjenta rzeczywistego');

  const [stInnaPrawna] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: `Zla Spolka ${sufiks()}`, beneficjent_rzeczywisty_id: prawna1.osoba.id,
  });
  assert.equal(stInnaPrawna, 400, 'beneficjent musi byc osoba fizyczna, nie druga spolka');

  const [stOk, ok] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: `Dobra Spolka ${sufiks()}`, beneficjent_rzeczywisty_id: fizyczna.osoba.id,
  });
  assert.equal(stOk, 201);
  assert.equal(ok.osoba.beneficjent_rzeczywisty_id, fizyczna.osoba.id);

  const [stSamoodwolanie] = await zapytaj('PUT', `/api/psa/osoby/${prawna2.osoba.id}`, {
    beneficjent_rzeczywisty_id: prawna2.osoba.id,
  });
  assert.equal(stSamoodwolanie, 400, 'podmiot nie moze byc wlasnym beneficjentem');
});

test('oswiadczenie PEP: katalog zamkniety tak/nie, zapisuje sie z data', async () => {
  const [stZle] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `PepZle${sufiks()}`, pep_oswiadczenie: 'moze',
  });
  assert.equal(stZle, 400);

  const [stOk, ok] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: `PepOk${sufiks()}`,
    pep_oswiadczenie: 'tak', pep_oswiadczenie_data: '2026-08-16',
  });
  assert.equal(stOk, 201);
  assert.equal(ok.osoba.pep_oswiadczenie, 'tak');
  assert.equal(ok.osoba.pep_oswiadczenie_data, '2026-08-16');
});

// ─────────────────────────────────────────────────────────────
// Etap 3.1: modul AML konfigurowalny per spolka - wylaczony domyslnie.
// ─────────────────────────────────────────────────────────────

test('POST/PUT /api/psa/spolki: przelacznik stosuje_procedure_aml, domyslnie wylaczony', async () => {
  const [, domyslna] = await zapytaj('POST', '/api/psa/spolki', { nazwa: `AML Domyslna ${sufiks()}` });
  assert.equal(domyslna.spolka.stosuje_procedure_aml, 0);

  const [, wlaczona] = await zapytaj('POST', '/api/psa/spolki', {
    nazwa: `AML Wlaczona ${sufiks()}`, stosuje_procedure_aml: true,
  });
  assert.equal(wlaczona.spolka.stosuje_procedure_aml, 1);

  const [, wylaczona] = await zapytaj('PUT', `/api/psa/spolki/${wlaczona.spolka.id}`, { stosuje_procedure_aml: false });
  assert.equal(wylaczona.spolka.stosuje_procedure_aml, 0);
});

test('POST /api/psa/osoby/:id/aml-skany: wymaga spolka_id i wlaczonej procedury AML', async () => {
  const [, osoba] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: `SkanBrak${sufiks()}` });
  const [, spolkaBezAml] = await zapytaj('POST', '/api/psa/spolki', { nazwa: `Bez AML ${sufiks()}` });

  const formularzBezSpolki = new FormData();
  formularzBezSpolki.append('plik', new Blob(['x'], { type: 'application/pdf' }), 'dowod.pdf');
  const odpBrakSpolki = await fetch(`${baza}/api/psa/osoby/${osoba.osoba.id}/aml-skany`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularzBezSpolki,
  });
  assert.equal(odpBrakSpolki.status, 400, 'brak spolka_id');

  const formularzWylaczona = new FormData();
  formularzWylaczona.append('spolka_id', String(spolkaBezAml.spolka.id));
  formularzWylaczona.append('plik', new Blob(['x'], { type: 'application/pdf' }), 'dowod.pdf');
  const odpWylaczona = await fetch(`${baza}/api/psa/osoby/${osoba.osoba.id}/aml-skany`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularzWylaczona,
  });
  assert.equal(odpWylaczona.status, 400, 'spolka nie ma wlaczonej procedury AML');
});

test('POST/GET /api/psa/osoby/:id/aml-skany: upload, lista, pobranie z logiem dostepu; odrzuca zle rozszerzenie', async () => {
  const [, osoba] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: `SkanOk${sufiks()}` });
  const [, spolka] = await zapytaj('POST', '/api/psa/spolki', { nazwa: `Z AML ${sufiks()}`, stosuje_procedure_aml: true });

  const zlaKoncowka = new FormData();
  zlaKoncowka.append('spolka_id', String(spolka.spolka.id));
  zlaKoncowka.append('plik', new Blob(['x'], { type: 'text/plain' }), 'notatka.txt');
  const odpZlaKoncowka = await fetch(`${baza}/api/psa/osoby/${osoba.osoba.id}/aml-skany`, {
    method: 'POST', headers: { Cookie: ciastko }, body: zlaKoncowka,
  });
  assert.equal(odpZlaKoncowka.status, 400, 'niedozwolone rozszerzenie pliku');

  const formularz = new FormData();
  formularz.append('spolka_id', String(spolka.spolka.id));
  formularz.append('typ_dokumentu', 'dowod_osobisty');
  formularz.append('retencja_do', '2031-01-01');
  formularz.append('plik', new Blob(['tresc skanu'], { type: 'application/pdf' }), 'dowod-osobisty.pdf');
  const odpUpload = await fetch(`${baza}/api/psa/osoby/${osoba.osoba.id}/aml-skany`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularz,
  });
  assert.equal(odpUpload.status, 201);
  const dane = await odpUpload.json();
  assert.equal(dane.skan.typ_dokumentu, 'dowod_osobisty');
  assert.equal(dane.skan.retencja_do, '2031-01-01');

  const [stLista, listaWynik] = await zapytaj('GET', `/api/psa/osoby/${osoba.osoba.id}/aml-skany`);
  assert.equal(stLista, 200);
  assert.equal(listaWynik.skany.length, 1);
  assert.equal(listaWynik.skany[0].id, dane.skan.id);

  const liczbaWpisowDziennikaPrzed = db().prepare('SELECT COUNT(*) AS ile FROM psa_dziennik_dostepu').get().ile;
  const odpPlik = await fetch(`${baza}/api/psa/osoby/${osoba.osoba.id}/aml-skany/${dane.skan.id}/plik`, {
    headers: { Cookie: ciastko },
  });
  assert.equal(odpPlik.status, 200);
  assert.equal(odpPlik.headers.get('content-type'), 'application/pdf');
  const liczbaWpisowDziennikaPo = db().prepare('SELECT COUNT(*) AS ile FROM psa_dziennik_dostepu').get().ile;
  assert.equal(liczbaWpisowDziennikaPo, liczbaWpisowDziennikaPrzed + 1, 'pobranie skanu zostawia slad w dzienniku dostepu');
});
