'use strict';

/**
 * Blok B sesji 8 — dane wymagane przez wzory pism: znak sprawy
 * (server/logika/znak-sprawy.js) i katalogi w server/logika/przepisy.js.
 *
 * Formy gramatyczne zalezne od plci znikly razem z `formy-osobowe.js`:
 * wzory nie odmieniaja juz danych przez przypadki, tylko opisuja je
 * etykieta ("imiona rodzicow:", "dzialajacy jako:").
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { nastepnyNumerSprawy } = require('../server/logika/znak-sprawy');
const przepisy = require('../server/logika/przepisy');
const { bazaTestowa } = require('./pomoc');


// ─────────────────────────────────────────────────────────────
// znak-sprawy.js
// ─────────────────────────────────────────────────────────────

function wstawSprawe(db, numer, dataWplywu) {
  db.prepare(
    `INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono)
     VALUES ('X', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', '2026-01-01T00:00:00.000Z')`
  ).run();
  const spolkaId = db.prepare('SELECT id FROM psa_spolki ORDER BY id DESC LIMIT 1').get().id;
  db.prepare(
    `INSERT INTO psa_sprawy (spolka_id, typ_zdarzenia, zrodlo, data_wplywu, stan, autor, numer, utworzono)
     VALUES (?, 'umorzenie', 'papier', ?, 'nowa', 'test', ?, '2026-01-01T00:00:00.000Z')`
  ).run(spolkaId, dataWplywu, numer);
}

test('nastepnyNumerSprawy: pierwszy numer roku to 0001', () => {
  const db = bazaTestowa();
  assert.equal(nastepnyNumerSprawy(db, '2026-03-01'), 'RA/2026/0001');
});

test('nastepnyNumerSprawy: rosnie sekwencyjnie w obrebie tego samego roku', () => {
  const db = bazaTestowa();
  wstawSprawe(db, 'RA/2026/0001', '2026-01-05');
  wstawSprawe(db, 'RA/2026/0002', '2026-02-10');
  assert.equal(nastepnyNumerSprawy(db, '2026-06-01'), 'RA/2026/0003');
});

test('nastepnyNumerSprawy: kazdy rok liczy sie od nowa', () => {
  const db = bazaTestowa();
  wstawSprawe(db, 'RA/2025/0042', '2025-12-30');
  assert.equal(nastepnyNumerSprawy(db, '2026-01-02'), 'RA/2026/0001');
});

test('nastepnyNumerSprawy: numer sprawy anulowanej nie wraca do puli', () => {
  const db = bazaTestowa();
  wstawSprawe(db, 'RA/2026/0001', '2026-01-05');
  db.prepare("UPDATE psa_sprawy SET stan = 'anulowana' WHERE numer = 'RA/2026/0001'").run();
  assert.equal(nastepnyNumerSprawy(db, '2026-06-01'), 'RA/2026/0002');
});

// ─────────────────────────────────────────────────────────────
// przepisy.js — nowe katalogi (blok B3, B5)
// ─────────────────────────────────────────────────────────────

test('RODZAJE_DOKUMENTU: ten sam katalog, co typy zalacznikow do sprawy', () => {
  assert.deepEqual(
    Object.values(przepisy.RODZAJE_DOKUMENTU).sort(),
    ['umowa_spolki', 'umowa_zbycia', 'uchwala', 'zgoda', 'postanowienie', 'pelnomocnictwo', 'inny'].sort()
  );
  for (const kod of Object.values(przepisy.RODZAJE_DOKUMENTU)) {
    assert.ok(przepisy.OPISY_RODZAJOW_DOKUMENTU[kod], `brak opisu dla „${kod}”`);
  }
});

/**
 * Katalog w kodzie i CHECK w bazie musza opisywac ten sam zbior. Rozjechanie
 * ich nie wychodzi przy zapisie kodu ani przy migracji - wychodzi dopiero
 * przy probie zapisania konkretnej sprawy, u notariusza.
 */
test('RODZAJE_DOKUMENTU: baza przyjmuje KAZDA wartosc z katalogu', () => {
  const db = bazaTestowa();
  db.prepare(
    `INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono)
     VALUES ('X', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', '2026-01-01T00:00:00.000Z')`
  ).run();
  const spolkaId = db.prepare('SELECT id FROM psa_spolki ORDER BY id DESC LIMIT 1').get().id;

  for (const kod of Object.values(przepisy.RODZAJE_DOKUMENTU)) {
    db.prepare(
      `INSERT INTO psa_sprawy (spolka_id, typ_zdarzenia, zrodlo, data_wplywu, stan,
                               dokument_rodzaj, autor, utworzono)
       VALUES (?, 'emisja', 'papier', '2026-01-02', 'nowa', ?, 'test', '2026-01-02T00:00:00.000Z')`
    ).run(spolkaId, kod);
    const sprawaId = db.prepare('SELECT id FROM psa_sprawy ORDER BY id DESC LIMIT 1').get().id;
    db.prepare(
      `INSERT INTO psa_dokumenty (sprawa_id, nazwa_pliku, sciezka, typ_dokumentu, wgral, utworzono)
       VALUES (?, 'plik.pdf', 'a/plik.pdf', ?, 'test', '2026-01-02T00:00:00.000Z')`
    ).run(sprawaId, kod);
  }

  assert.equal(
    db.prepare('SELECT COUNT(DISTINCT typ_dokumentu) c FROM psa_dokumenty').get().c,
    Object.values(przepisy.RODZAJE_DOKUMENTU).length
  );
});

test('PRZYCZYNY_ODMOWY_WPISU: katalog zamkniety, „inna” wymaga opisu', () => {
  assert.equal(przepisy.PRZYCZYNA_ODMOWY_WYMAGA_OPISU, przepisy.PRZYCZYNY_ODMOWY_WPISU.INNA);
  for (const kod of Object.values(przepisy.PRZYCZYNY_ODMOWY_WPISU)) {
    assert.ok(przepisy.OPISY_PRZYCZYN_ODMOWY_WPISU[kod], `brak opisu dla „${kod}”`);
  }
});

// ─────────────────────────────────────────────────────────────
// PEP — eksponowane stanowisko polityczne (etap 14)
// ─────────────────────────────────────────────────────────────

test('STATUSY_PEP: baza przyjmuje kazdy status, a wzmozone srodki tylko poza "nie"', () => {
  const db = bazaTestowa();
  for (const kod of Object.values(przepisy.STATUSY_PEP)) {
    assert.ok(przepisy.OPISY_STATUSOW_PEP[kod], `brak opisu dla „${kod}”`);
    db.prepare(
      `INSERT INTO psa_osoby (typ, nazwisko, imie, pep, utworzono)
       VALUES ('fizyczna', 'Testowy', 'Jan', ?, '2026-01-01T00:00:00.000Z')`
    ).run(kod);
  }
  assert.equal(
    db.prepare('SELECT COUNT(DISTINCT pep) c FROM psa_osoby').get().c,
    Object.values(przepisy.STATUSY_PEP).length
  );

  assert.equal(przepisy.pepWymagaWzmozonych(przepisy.STATUSY_PEP.NIE), false);
  assert.equal(przepisy.pepWymagaWzmozonych(przepisy.STATUSY_PEP.TAK), true);
  assert.equal(przepisy.pepWymagaWzmozonych(przepisy.STATUSY_PEP.RODZINA), true);
  assert.equal(przepisy.pepWymagaWzmozonych(przepisy.STATUSY_PEP.WSPOLPRACOWNIK), true);
  assert.equal(przepisy.pepWymagaWzmozonych(null), false, 'brak wartosci to nie jest PEP');
});

test('akcjonariusz: PEP bez opisu jest brakiem, nieznany status jest bledem', () => {
  const akcjonariusz = require('../server/logika/akcjonariusz');
  const osoba = { typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', pesel: '85030512345', miejscowosc: 'Gdańsk' };

  // Sam status nie wystarcza: wzmozone srodki wymagaja wiedzy, na czym polega.
  const braki = akcjonariusz.ostrzezenia({ ...osoba, pep: 'rodzina' });
  assert.ok(braki.some((b) => /eksponowane stanowisko polityczne/.test(b)));
  assert.deepEqual(
    akcjonariusz.ostrzezenia({ ...osoba, pep: 'rodzina', pep_opis: 'Siostra posła' })
      .filter((b) => /eksponowane/.test(b)),
    []
  );
  assert.deepEqual(akcjonariusz.ostrzezenia({ ...osoba, pep: 'nie' }).filter((b) => /eksponowane/.test(b)), []);

  assert.ok(akcjonariusz.bledy({ pep: 'prezydent' }).some((b) => /Nieznany status PEP/.test(b)));
  assert.deepEqual(akcjonariusz.bledy({ pep: 'tak' }), []);
  assert.equal(akcjonariusz.znormalizuj({ pep: '' }).pep, 'nie', 'puste normalizuje sie do „nie”');
});
