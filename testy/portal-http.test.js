'use strict';

/**
 * Testy integracyjne portalu klienta przez HTTP (sekcja 8 i 9 specyfikacji):
 * logowanie, "moje spolki/akcje", podglad rejestru z maskowaniem, zlozenie
 * zadania, upload dokumentow do wlasnej sprawy, informacja z rejestru.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-portal-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-portal-dokumenty');
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const { db } = require('../server/baza');
const rejestr = require('../server/rejestr');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let baza;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

function dodajOsobe(nadpisania = {}) {
  const dane = {
    typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan', pesel: '80010112345',
    data_urodzenia: '1980-01-01', aml_status: 'wykonane', utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db()
    .prepare(
      `INSERT INTO psa_osoby (typ, nazwisko, imie, pesel, data_urodzenia, aml_status, utworzono)
       VALUES (@typ, @nazwisko, @imie, @pesel, @data_urodzenia, @aml_status, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

function dodajSpolke(nadpisania = {}) {
  const dane = {
    krs: null, nazwa: 'Portal Testowa P.S.A.', forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
    status: 'aktywna', utworzono: czas.terazIso(), ...nadpisania,
  };
  const wynik = db()
    .prepare(`INSERT INTO psa_spolki (krs, nazwa, forma_prawna, status, utworzono) VALUES (@krs, @nazwa, @forma_prawna, @status, @utworzono)`)
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

async function dodajKonto({ email, haslo, rola, spolkaId = null, osobaId = null }) {
  const hash = await hasla.hashuj(haslo);
  const wynik = db()
    .prepare(
      `INSERT INTO psa_konta (email, hash_hasla, rola, spolka_id, osoba_id, aktywne, utworzono)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    )
    .run(email, hash, rola, spolkaId, osobaId, czas.terazIso());
  return Number(wynik.lastInsertRowid);
}

async function zalogujPortal(email, haslo) {
  const odp = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo }),
  });
  assert.equal(odp.status, 200, `logowanie portalowe ${email} nie powiodło się`);
  return ciasteczkoZOdpowiedzi(odp);
}

let spolkaId;
let kowalskiId;
let nowakId;
let ciastkoSpolka;
let ciastkoAkcjonariusz;
let ciastkoInnyAkcjonariusz;

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  spolkaId = dodajSpolke();
  kowalskiId = dodajOsobe({ nazwisko: 'Kowalski', imie: 'Jan', pesel: '80010112345' });
  nowakId = dodajOsobe({ nazwisko: 'Nowak', imie: 'Anna', pesel: '85050512345', typ: 'fizyczna' });

  const emisja = rejestr.dokonajWpisu(db(), {
    spolkaId, typ: 'emisja', data_zdarzenia: '2026-01-10', wejscie: { seria: 'A', ilosc: 100 }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db(), {
    spolkaId, typ: 'objecie', data_zdarzenia: '2026-01-10',
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: kowalskiId, ilosc: 60 }, { osoba_id: nowakId, ilosc: 40 }] },
    autor: 'Test',
  });

  await dodajKonto({ email: 'spolka@example.pl', haslo: 'HasloSpolki123', rola: 'spolka', spolkaId });
  await dodajKonto({ email: 'kowalski@example.pl', haslo: 'HasloJana12345', rola: 'akcjonariusz', osobaId: kowalskiId });
  await dodajKonto({ email: 'nowak@example.pl', haslo: 'HasloAnny123456', rola: 'akcjonariusz', osobaId: nowakId });

  ciastkoSpolka = await zalogujPortal('spolka@example.pl', 'HasloSpolki123');
  ciastkoAkcjonariusz = await zalogujPortal('kowalski@example.pl', 'HasloJana12345');
  ciastkoInnyAkcjonariusz = await zalogujPortal('nowak@example.pl', 'HasloAnny123456');
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('logowanie portalowe: bledne haslo -> 401, trasy portalu wymagaja sesji konta', async () => {
  const zle = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kowalski@example.pl', haslo: 'zle-haslo' }),
  });
  assert.equal(zle.status, 401);

  const bezSesji = await fetch(`${baza}/api/psa/portal/moje`);
  assert.equal(bezSesji.status, 401);
});

test('sesja portalowa jest niezalezna od sesji pracownika (inne ciasteczko)', () => {
  assert.match(ciastkoSpolka, /^psa_sesja_portal=/);
});

test('moje: konto spolki widzi swoja spolke', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/moje`, { headers: { Cookie: ciastkoSpolka } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.equal(dane.rola, 'spolka');
  assert.equal(dane.spolki.length, 1);
  assert.equal(dane.spolki[0].id, spolkaId);
});

test('moje: konto akcjonariusza widzi wlasny pakiet akcji, bez cudzych danych', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/moje`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.equal(dane.rola, 'akcjonariusz');
  assert.equal(dane.spolki.length, 1);
  assert.equal(dane.spolki[0].razem_akcji, 60);
});

test('rejestr: akcjonariusz widzi wlasne dane w pelni, dane wspolakcjonariusza zamaskowane', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${spolkaId}`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();

  const jan = dane.akcjonariusze.find((a) => a.osoba_id === kowalskiId);
  const anna = dane.akcjonariusze.find((a) => a.osoba_id === nowakId);
  assert.equal(jan.osoba.zamaskowane, false);
  assert.equal(jan.osoba.pesel, '80010112345');
  assert.equal(anna.osoba.zamaskowane, true);
  assert.notEqual(anna.osoba.pesel, '85050512345');
});

test('rejestr: konto spolki widzi wszystkie dane bez maskowania', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${spolkaId}`, { headers: { Cookie: ciastkoSpolka } });
  const dane = await odp.json();
  const anna = dane.akcjonariusze.find((a) => a.osoba_id === nowakId);
  assert.equal(anna.osoba.zamaskowane, false);
  assert.equal(anna.osoba.pesel, '85050512345');
});

test('rejestr: dostep do cudzej spolki jest odrzucany (404, nie wyciek istnienia)', async () => {
  const innaSpolkaId = dodajSpolke({ nazwa: 'Inna P.S.A., bez powiazania', krs: '0009998887' });
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${innaSpolkaId}`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 404);
});

test('zadania: zlozenie zgloszenia typu dostepnego portalowi', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: 'Sprzedaję część akcji sąsiadowi.' }),
  });
  assert.equal(odp.status, 201);
  const dane = await odp.json();
  assert.equal(dane.sprawa.stan, 'nowa');
  assert.equal(dane.sprawa.zrodlo, 'portal');
});

test('zadania: typ z_urzedu jest odrzucany na poziomie portalu', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'zajecie', opis: 'proba' }),
  });
  assert.equal(odp.status, 400);
});

test('zadania: konto spolki widzi zgloszenia o swojej spolce, obcy akcjonariusz — nie', async () => {
  const dlaJana = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoAkcjonariusz } })).json();
  assert.equal(dlaJana.sprawy.length, 1, 'Jan widzi wlasne zgloszenie');

  // Spolka widzi KAZDE zgloszenie portalowe dotyczace jej wlasnego rejestru
  // (nie tylko zlozone przez samo konto spolki) - to zamierzone: pracownicy
  // spolki maja przegladac napływajace zadania dotyczace ich rejestru.
  const dlaSpolki = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoSpolka } })).json();
  assert.equal(dlaSpolki.sprawy.length, 1, 'zgłoszenie Jana o TEJ spółce jest widoczne dla konta spółki');

  // Ale inny akcjonariusz tej samej spolki (Anna) nie widzi zgloszenia Jana -
  // to NIE jest jej sprawa.
  const dlaAnny = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoInnyAkcjonariusz } })).json();
  assert.equal(dlaAnny.sprawy.length, 0, 'zgłoszenie Jana nie jest widoczne dla innego akcjonariusza');
});

test('dokumenty: upload do wlasnej sprawy dziala, do cudzej jest odrzucany', async () => {
  const zadanie = await (
    await fetch(`${baza}/api/psa/portal/zadania`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
      body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: 'Dokument dowodowy w załączeniu.' }),
    })
  ).json();
  const sprawaId = zadanie.sprawa.id;

  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'umowa_zbycia');
  formularz.append('pliki', new Blob(['tresc testowa'], { type: 'application/pdf' }), 'umowa.pdf');

  const wlasny = await fetch(`${baza}/api/psa/portal/zadania/${sprawaId}/dokumenty`, {
    method: 'POST', headers: { Cookie: ciastkoAkcjonariusz }, body: formularz,
  });
  assert.equal(wlasny.status, 201);

  // Anna (inny akcjonariusz tej samej spolki, bez zwiazku z ta konkretna
  // sprawa) nie moze dolaczac dokumentow do cudzego zgloszenia.
  const formularz2 = new FormData();
  formularz2.append('typ_dokumentu', 'inny');
  formularz2.append('pliki', new Blob(['x'], { type: 'application/pdf' }), 'x.pdf');
  const cudzy = await fetch(`${baza}/api/psa/portal/zadania/${sprawaId}/dokumenty`, {
    method: 'POST', headers: { Cookie: ciastkoInnyAkcjonariusz }, body: formularz2,
  });
  assert.equal(cudzy.status, 404);
});

test('informacja z rejestru: generuje HTML i zapisuje slad audytowy', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/informacja`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId }),
  });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.match(dane.tresc_html, /Informacja z rejestru akcjonariuszy/);
  assert.match(dane.tresc_html, /Portal Testowa P\.S\.A\./);

  const slad = db()
    .prepare(`SELECT * FROM psa_wydane_dokumenty WHERE spolka_id = ? AND typ = 'informacja_z_rejestru'`)
    .all(spolkaId);
  assert.equal(slad.length, 1);
  assert.equal(slad[0].kanal, 'portal');
});

test('portal wylaczony flaga: PORTAL_WLACZONY=false zwraca 503 dla wszystkich tras portalu', async () => {
  const PLIK_BAZY2 = path.join(__dirname, '..', 'dane', '.test-portal-wylaczony.db');
  fs.rmSync(PLIK_BAZY2, { force: true });
  const skrypt = `
    process.env.WSPOLNA_BAZA = ${JSON.stringify(PLIK_BAZY2)};
    process.env.KATALOG_DOKUMENTOW = ${JSON.stringify(path.join(__dirname, '..', 'dane', '.test-portal-wylaczony-dok'))};
    process.env.PORTAL_WLACZONY = 'false';
    const app = require(${JSON.stringify(path.join(__dirname, '..', 'serwer.js'))});
    const serwer = app.listen(0, () => {
      fetch(\`http://localhost:\${serwer.address().port}/api/psa/portal/whoami\`)
        .then((r) => { console.log(r.status); serwer.close(); process.exit(0); });
    });
  `;
  const { execFileSync } = require('node:child_process');
  const wynik = execFileSync(process.execPath, ['-e', skrypt], { encoding: 'utf8' });
  const ostatniaLinia = wynik.trim().split('\n').pop();
  assert.equal(ostatniaLinia, '503');
  fs.rmSync(PLIK_BAZY2, { force: true });
  fs.rmSync(`${PLIK_BAZY2}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY2}-shm`, { force: true });
});
