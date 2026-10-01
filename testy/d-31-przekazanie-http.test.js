'use strict';

/**
 * D-31 — przekazanie prowadzenia rejestru: tylko ewidencja; po zapisie każdy
 * wpis jest odrzucany, a informacja z rejestru pozostaje dostępna.
 */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-d31-przekazanie-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoSesji = '';

// Z-200/Z-201/Z-204: serwer wymaga teraz kompletnej checklisty otwarcia
// rejestru (patrz `server/trasy/spolki.js: KODY_CHECKLISTY_OTWARCIA`).
const CHECKLISTA_PELNA = {
  forma: true, wpis_krs: true, uchwala: true, umowa: true, jedna_umowa: true,
  dane_z_umowy: true, ograniczenia: true, bilans: true, zakres_danych: true, aml: true,
};

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Test', 'test-d31@example-test.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());

  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-d31@example-test.pl', haslo: 'HasloTestowe123' }),
  });
  if (odpLogin.status !== 200) throw new Error(`Logowanie testowe nie powiodło się: ${odpLogin.status}`);
  ciastkoSesji = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

async function zapytaj(metoda, sciezka, cialo, naglowki = {}) {
  const opcje = { method: metoda, headers: { ...naglowki } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const dane = await odp.json();
  return [odp.status, dane];
}

const { dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

test('po zapisaniu przekazania rejestr jest tylko do odczytu, informacja dostępna', async () => {
  const spolka = dodajSpolke(db(), { krs: '0000313131', nazwa: 'Przekazywana P.S.A.' });
  const osoba = dodajOsobe(db());
  const emisja = wpis(db(), spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 10 });
  wpis(db(), spolka, 'objecie', '2026-01-11', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: osoba, ilosc: 10 }],
  });

  const [stBrak, brak] = await zapytaj('POST', `/api/psa/spolki/${spolka}/przekazanie`, {
    data_przekazania: '2026-09-01', odbiorca_typ: 'notariusz', odbiorca_nazwa: 'Notariusz X',
  }, { Cookie: ciastkoSesji });
  assert.equal(stBrak, 400);
  assert.match(brak.blad, /podstawę przekazania/);

  const [st, wynik] = await zapytaj('POST', `/api/psa/spolki/${spolka}/przekazanie`, {
    data_przekazania: '2026-09-01',
    odbiorca_typ: 'izba_notarialna',
    odbiorca_nazwa: 'Izba Notarialna w Gdańsku',
    podstawa: 'nowa umowa o prowadzenie rejestru z dnia 01.09.2026 (art. 300³² § 2 KSH)',
  }, { Cookie: ciastkoSesji });
  assert.equal(st, 201);
  assert.equal(wynik.spolka.przekazanie_data, '2026-09-01');
  assert.equal(wynik.spolka.przekazanie_odbiorca_typ, 'izba_notarialna');
  assert.equal(wynik.zdarzenie.typ, 'przekazanie_rejestru');

  // Każdy nowy wpis odrzucony — bezpośredni, zmiana danych spółki, nowa sprawa, drugie przekazanie.
  const [stWpis, odpWpis] = await zapytaj('POST', `/api/psa/spolki/${spolka}/zdarzenia`, {
    typ: 'zdarzenie_inne', dane: { tytul: 'WZA', opis: 'Walne zgromadzenie akcjonariuszy' },
  }, { Cookie: ciastkoSesji });
  assert.ok(stWpis >= 400 && stWpis < 500);
  assert.match(JSON.stringify(odpWpis), /tylko do odczytu/);

  const [stPut] = await zapytaj('PUT', `/api/psa/spolki/${spolka}`, { telefon: '123' }, { Cookie: ciastkoSesji });
  assert.equal(stPut, 400);

  const [stSprawa, odpSprawa] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolka, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier',
  }, { Cookie: ciastkoSesji });
  assert.equal(stSprawa, 400);
  assert.match(odpSprawa.blad, /tylko do odczytu/);

  const [stDrugie] = await zapytaj('POST', `/api/psa/spolki/${spolka}/przekazanie`, {
    data_przekazania: '2026-09-02', odbiorca_typ: 'notariusz', odbiorca_nazwa: 'Y', podstawa: 'Z',
  }, { Cookie: ciastkoSesji });
  assert.equal(stDrugie, 400);

  // Podgląd i informacja z rejestru nadal dostępne.
  const [stStan, stan] = await zapytaj('GET', `/api/psa/spolki/${spolka}`, undefined, { Cookie: ciastkoSesji });
  assert.equal(stStan, 200);
  assert.equal(stan.razem_akcji, 10);
  const odpInfo = await fetch(`${baza}/api/psa/spolki/${spolka}/informacja.html`, { headers: { Cookie: ciastkoSesji } });
  assert.equal(odpInfo.status, 200);
  assert.match(await odpInfo.text(), /Informacja z rejestru akcjonariuszy/);
});
