'use strict';

/**
 * Rozliczenia (sekcja 1, 5, 8, 15 specyfikacji) - testy jednostkowe serwisu
 * `server/oplaty.js` i czystych funkcji `logika/przepisy.js` zwiazanych
 * z nowelizacja/stawkami. Baza w pamieci (`testy/pomoc.js`).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke } = require('./pomoc');
const oplaty = require('../server/oplaty');
const przepisy = require('../server/logika/przepisy');

test('stawkaGrosze zwraca kwoty z przepisy.js, rzuca dla nieznanego typu', () => {
  assert.equal(przepisy.stawkaGrosze('prowadzenie'), przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE);
  assert.equal(przepisy.stawkaGrosze('wpis'), przepisy.STAWKI_GROSZE.WPIS);
  assert.equal(przepisy.stawkaGrosze('informacja'), przepisy.STAWKI_GROSZE.INFORMACJA);
  assert.throws(() => przepisy.stawkaGrosze('cos-innego'), /Nieznany typ opłaty/);
});

test('nowelizacjaObowiazuje porownuje z data wejscia w zycie (18.02.2027)', () => {
  assert.equal(przepisy.nowelizacjaObowiazuje('2026-08-05'), false);
  assert.equal(przepisy.nowelizacjaObowiazuje('2027-02-17'), false);
  assert.equal(przepisy.nowelizacjaObowiazuje('2027-02-18'), true);
  assert.equal(przepisy.nowelizacjaObowiazuje('2030-01-01'), true);
});

test('naliczOplateWpisu wstawia oplate typu wpis ze stawka z przepisow', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const wpis = oplaty.naliczOplateWpisu(db, { spolkaId: spolka, sprawaId: null, typZdarzenia: 'Przeniesienie akcji', autor: 'Test' });
  assert.equal(wpis.typ, 'wpis');
  assert.equal(wpis.kwota_grosze, przepisy.STAWKI_GROSZE.WPIS);
  assert.equal(wpis.sprawa_id, null);
  assert.equal(wpis.status, 'naliczona');
});

test('naliczOplateInformacji wstawia oplate typu informacja', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const inf = oplaty.naliczOplateInformacji(db, { spolkaId: spolka, odbiorcaOsobaId: null, autor: 'Test' });
  assert.equal(inf.typ, 'informacja');
  assert.equal(inf.kwota_grosze, przepisy.STAWKI_GROSZE.INFORMACJA);
});

test('naliczOplateProwadzenia jest idempotentne per spolka+rok', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  const pierwsza = oplaty.naliczOplateProwadzenia(db, { spolkaId: spolka, rok: '2026', autor: 'Test' });
  assert.equal(pierwsza.utworzono, true);
  assert.equal(pierwsza.oplata.kwota_grosze, przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE);

  const druga = oplaty.naliczOplateProwadzenia(db, { spolkaId: spolka, rok: '2026', autor: 'Test' });
  assert.equal(druga.utworzono, false);
  assert.equal(druga.oplata.id, pierwsza.oplata.id);

  const innyRok = oplaty.naliczOplateProwadzenia(db, { spolkaId: spolka, rok: '2027', autor: 'Test' });
  assert.equal(innyRok.utworzono, true);
  assert.notEqual(innyRok.oplata.id, pierwsza.oplata.id);
});

test('anulowana oplata prowadzenia nie blokuje ponownego naliczenia za ten sam rok', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const { oplata } = oplaty.naliczOplateProwadzenia(db, { spolkaId: spolka, rok: '2026', autor: 'Test' });
  oplaty.zmienStatus(db, { id: oplata.id, status: 'anulowana' });

  const ponownie = oplaty.naliczOplateProwadzenia(db, { spolkaId: spolka, rok: '2026', autor: 'Test' });
  assert.equal(ponownie.utworzono, true);
  assert.notEqual(ponownie.oplata.id, oplata.id);
});

test('naliczOplateRoczneWszystkie pomija spolki wykreslone i jest idempotentne', () => {
  const db = bazaTestowa();
  const aktywna = dodajSpolke(db, { krs: '0000000001' });
  const wykreslona = dodajSpolke(db, { krs: '0000000002', status: 'wykreslona' });

  const pierwsze = oplaty.naliczOplateRoczneWszystkie(db, { rok: '2026', autor: 'Test' });
  assert.equal(pierwsze.naliczone.length, 1);
  assert.equal(pierwsze.naliczone[0].spolka_id, aktywna);
  assert.equal(pierwsze.pominiete.length, 0);

  const drugie = oplaty.naliczOplateRoczneWszystkie(db, { rok: '2026', autor: 'Test' });
  assert.equal(drugie.naliczone.length, 0);
  assert.equal(drugie.pominiete.length, 1);

  const oplatyWykreslonej = db.prepare('SELECT * FROM psa_oplaty WHERE spolka_id = ?').all(wykreslona);
  assert.equal(oplatyWykreslonej.length, 0);
});

test('dodajOplateReczna: domyslna kwota ze stawki, mozliwe nadpisanie', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  const domyslna = oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', autor: 'Test' });
  assert.equal(domyslna.kwota_grosze, przepisy.STAWKI_GROSZE.INFORMACJA);

  const nadpisana = oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', kwotaGrosze: 1234, autor: 'Test' });
  assert.equal(nadpisana.kwota_grosze, 1234);
});

test('zmienStatus aktualizuje status i znacznik czasu', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const wpis = oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'wpis', autor: 'Test' });
  assert.equal(wpis.zaktualizowano, null);

  const po = oplaty.zmienStatus(db, { id: wpis.id, status: 'oplacona' });
  assert.equal(po.status, 'oplacona');
  assert.notEqual(po.zaktualizowano, null);
});

test('eksportujCsv - naglowek, escaping przecinka i cudzyslowu, kwota w zlotych', () => {
  const csv = oplaty.eksportujCsv([
    {
      id: 1,
      spolka_nazwa: 'Firma „X, Y" P.S.A.',
      typ: 'wpis',
      okres: null,
      kwota_grosze: 10050,
      status: 'naliczona',
      data_naliczenia: '2026-01-01',
      notatka: null,
      autor: 'Jan Kowalski',
    },
  ]);
  const linie = csv.split('\r\n');
  assert.equal(linie[0], 'id,spolka,typ,okres,kwota_zl,status,data_naliczenia,notatka,autor');
  assert.match(linie[1], /^1,"Firma „X, Y"" P\.S\.A\.",wpis,,100\.50,naliczona,2026-01-01,,Jan Kowalski$/);
});
