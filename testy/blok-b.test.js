'use strict';

/**
 * Blok B sesji 8 — dane wymagane przez wzory pism: formy gramatyczne zalezne
 * od plci (server/logika/formy-osobowe.js), znak sprawy
 * (server/logika/znak-sprawy.js) i nowe katalogi w server/logika/przepisy.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const formy = require('../server/logika/formy-osobowe');
const { nastepnyNumerSprawy } = require('../server/logika/znak-sprawy');
const przepisy = require('../server/logika/przepisy');
const { bazaTestowa } = require('./pomoc');

// ─────────────────────────────────────────────────────────────
// formy-osobowe.js
// ─────────────────────────────────────────────────────────────

test('formyReprezentanta: rozne formy dla obu plci, null gdy plec nieznana', () => {
  assert.deepEqual(formy.formyReprezentanta('mezczyzna'), {
    reprezentant_syn_corka: 'syna',
    reprezentant_legitymujacy: 'legitymującego się',
    reprezentant_zamieszkaly: 'zamieszkałego',
    reprezentant_dzialajacy: 'działającego',
  });
  assert.deepEqual(formy.formyReprezentanta('kobieta'), {
    reprezentant_syn_corka: 'córkę',
    reprezentant_legitymujacy: 'legitymującą się',
    reprezentant_zamieszkaly: 'zamieszkałą',
    reprezentant_dzialajacy: 'działającą',
  });
  assert.equal(formy.formyReprezentanta(null), null);
  assert.equal(formy.formyReprezentanta(undefined), null);
  assert.equal(formy.formyReprezentanta('nieznana'), null);
});

test('formyZadajacego i formyZgadzajacego: mianownik, pierwsza/trzecia osoba', () => {
  assert.deepEqual(formy.formyZadajacego('mezczyzna'), {
    zadajacy_podpisany: 'podpisany',
    zadajacy_zamieszkaly: 'zamieszkały',
  });
  assert.deepEqual(formy.formyZadajacego('kobieta'), {
    zadajacy_podpisany: 'podpisana',
    zadajacy_zamieszkaly: 'zamieszkała',
  });
  assert.equal(formy.formyZadajacego(null), null);

  assert.deepEqual(formy.formyZgadzajacego('mezczyzna'), { zgadzajacy_podpisany: 'podpisany' });
  assert.deepEqual(formy.formyZgadzajacego('kobieta'), { zgadzajacy_podpisany: 'podpisana' });
  assert.equal(formy.formyZgadzajacego(null), null);
});

test('formaZapoznania: czasownik w pierwszej osobie, czas przeszly', () => {
  assert.deepEqual(formy.formaZapoznania('mezczyzna'), { zapoznany: 'zapoznałem się' });
  assert.deepEqual(formy.formaZapoznania('kobieta'), { zapoznany: 'zapoznałam się' });
  assert.equal(formy.formaZapoznania(null), null);
});

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
    ['umowa_zbycia', 'uchwala', 'zgoda', 'postanowienie', 'pelnomocnictwo', 'inny'].sort()
  );
  for (const kod of Object.values(przepisy.RODZAJE_DOKUMENTU)) {
    assert.ok(przepisy.OPISY_RODZAJOW_DOKUMENTU[kod], `brak opisu dla „${kod}”`);
  }
});

test('PRZYCZYNY_ODMOWY_WPISU: katalog zamkniety, „inna” wymaga opisu', () => {
  assert.equal(przepisy.PRZYCZYNA_ODMOWY_WYMAGA_OPISU, przepisy.PRZYCZYNY_ODMOWY_WPISU.INNA);
  for (const kod of Object.values(przepisy.PRZYCZYNY_ODMOWY_WPISU)) {
    assert.ok(przepisy.OPISY_PRZYCZYN_ODMOWY_WPISU[kod], `brak opisu dla „${kod}”`);
  }
});
