'use strict';

/**
 * Dziennik dostępu do danych osobowych (blok D4 sesji 8) — zapis append-only.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke, dodajOsobe } = require('./pomoc');
const dziennik = require('../server/logika/dziennik-dostepu');

test('zapisz: tworzy wiersz z kompletem pol', () => {
  const db = bazaTestowa();
  const spolkaId = dodajSpolke(db);
  const osobaId = dodajOsobe(db);
  dziennik.zapisz(db, {
    kto: 'Łukasz Kozon',
    typKto: 'pracownik',
    spolkaId,
    osobaId,
    akcja: dziennik.AKCJE.EKSPORT,
    opis: 'eksport CSV',
  });

  const wiersz = db.prepare('SELECT * FROM psa_dziennik_dostepu ORDER BY id DESC LIMIT 1').get();
  assert.equal(wiersz.kto, 'Łukasz Kozon');
  assert.equal(wiersz.typ_kto, 'pracownik');
  assert.equal(wiersz.spolka_id, spolkaId);
  assert.equal(wiersz.osoba_id, osobaId);
  assert.equal(wiersz.akcja, 'eksport');
  assert.equal(wiersz.opis, 'eksport CSV');
  assert.ok(wiersz.chwila);
});

test('zapisz: osoba_id i opis sa opcjonalne (np. raport dotyczy calej spolki, nie jednej osoby)', () => {
  const db = bazaTestowa();
  const spolkaId = dodajSpolke(db);
  dziennik.zapisz(db, {
    kto: 'Portal — jan@kowalski.pl',
    typKto: 'portal',
    spolkaId,
    akcja: dziennik.AKCJE.INFORMACJA_Z_REJESTRU,
  });

  const wiersz = db.prepare('SELECT * FROM psa_dziennik_dostepu ORDER BY id DESC LIMIT 1').get();
  assert.equal(wiersz.osoba_id, null);
  assert.equal(wiersz.opis, null);
});

test('kazde wywolanie dopisuje nowy wiersz - append-only', () => {
  const db = bazaTestowa();
  dziennik.zapisz(db, { kto: 'X', typKto: 'pracownik', akcja: dziennik.AKCJE.POBRANIE_PLIKU });
  dziennik.zapisz(db, { kto: 'X', typKto: 'pracownik', akcja: dziennik.AKCJE.POBRANIE_PLIKU });
  const n = db.prepare('SELECT COUNT(*) AS n FROM psa_dziennik_dostepu').get().n;
  assert.equal(n, 2);
});
