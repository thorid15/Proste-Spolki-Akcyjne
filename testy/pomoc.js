'use strict';

/**
 * Wspolne rusztowanie testow: baza w pamieci + skroty do budowania zdarzen.
 */

const baza = require('../server/baza');
const migracje = require('../server/migracje');
const rejestr = require('../server/rejestr');
const czas = require('../server/pomocnicze/czas');

/** Swiezia baza w pamieci z wykonanymi migracjami. */
function bazaTestowa() {
  const db = baza.otworz(':memory:');
  migracje.uruchom(db);
  return db;
}

function dodajSpolke(db, nadpisania = {}) {
  const dane = {
    krs: '0000111222',
    nip: '5252525252',
    regon: null,
    nazwa: 'Testowa P.S.A.',
    forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
    status: 'aktywna',
    data_umowy: '2026-01-02',
    opis: null,
    uwagi: null,
    utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db
    .prepare(
      `INSERT INTO psa_spolki
         (krs, nip, regon, nazwa, forma_prawna, status, data_umowy, opis, uwagi, utworzono)
       VALUES
         (@krs, @nip, @regon, @nazwa, @forma_prawna, @status, @data_umowy, @opis, @uwagi, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

function dodajOsobe(db, nadpisania = {}) {
  const dane = {
    typ: 'fizyczna',
    nazwisko: 'Kowalski',
    imie: 'Jan',
    nazwa: null,
    pesel: null,
    aml_status: 'wykonane',
    utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db
    .prepare(
      `INSERT INTO psa_osoby (typ, nazwisko, imie, nazwa, pesel, aml_status, utworzono)
       VALUES (@typ, @nazwisko, @imie, @nazwa, @pesel, @aml_status, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

/**
 * Skrot: dokonuje wpisu i zwraca zapisane zdarzenie.
 *
 * Emisje domyslnie dostaja `data_wpisu_krs` rowna dacie zdarzenia - wiekszosc
 * testow sprawdza logike NIEZWIAZANA z regula domenowa 12 (blokada wpisu akcji
 * przed wpisem emisji do KRS, sprint 5) i zaklada, ze akcje juz istnieja.
 * Testy TEJ konkretnej blokady nadpisuja `data_wpisu_krs: null` wprost.
 */
function wpis(db, spolkaId, typ, data, wejscie, opcje = {}) {
  const wejscieFinalne = typ === 'emisja' ? { data_wpisu_krs: data, ...wejscie } : wejscie;
  return rejestr.dokonajWpisu(db, {
    spolkaId,
    typ,
    data_zdarzenia: data,
    wejscie: wejscieFinalne,
    autor: opcje.autor || 'Test',
    dzisiaj: opcje.dzisiaj || '2026-12-31',
  });
}

/** Zdarzenie w formie "surowej" - do testow czystej logiki, bez bazy. */
function zdarzenie(id, typ, data, dane) {
  return { id, typ, data_zdarzenia: data, dane };
}

module.exports = { bazaTestowa, dodajSpolke, dodajOsobe, wpis, zdarzenie };
