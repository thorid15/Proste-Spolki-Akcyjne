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

test('naliczOtwarcieRejestru nalicza prowadzenie + wpis w jednym zadaniu, idempotentnie (Z-108/P-007)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  const pierwsze = oplaty.naliczOtwarcieRejestru(db, { spolkaId: spolka, dataOtwarcia: '2026-03-10', autor: 'Test' });
  assert.equal(pierwsze.prowadzenie.utworzono, true);
  assert.equal(pierwsze.prowadzenie.oplata.kwota_grosze, przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE);
  assert.equal(pierwsze.wpis.utworzono, true);
  assert.equal(pierwsze.wpis.oplata.kwota_grosze, przepisy.STAWKI_GROSZE.WPIS);
  assert.equal(pierwsze.wpis.oplata.sprawa_id, null);

  // Druga proba (np. po przerwanym zadaniu) nic nie dublauje.
  const druga = oplaty.naliczOtwarcieRejestru(db, { spolkaId: spolka, dataOtwarcia: '2026-03-10', autor: 'Test' });
  assert.equal(druga.prowadzenie.utworzono, false);
  assert.equal(druga.prowadzenie.oplata.id, pierwsze.prowadzenie.oplata.id);
  assert.equal(druga.wpis.utworzono, false);
  assert.equal(druga.wpis.oplata.id, pierwsze.wpis.oplata.id);

  const wszystkie = db.prepare('SELECT * FROM psa_oplaty WHERE spolka_id = ?').all(spolka);
  assert.equal(wszystkie.length, 2, 'dokladnie dwie pozycje - prowadzenie i wpis - bez wzgledu na liczbe wywolan');
});

test('dodajOplateReczna: domyslna kwota ze stawki, mozliwe nadpisanie', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  const domyslna = oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', autor: 'Test' });
  assert.equal(domyslna.kwota_grosze, przepisy.STAWKI_GROSZE.INFORMACJA);

  const nadpisana = oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', kwotaGrosze: 1234, autor: 'Test' });
  assert.equal(nadpisana.kwota_grosze, 1234);
});

test('dodajOplateReczna: Z-101..Z-104 - kwota niecalkowita, ujemna albo powyzej stawki maksymalnej odrzucone', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  assert.throws(
    () => oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', kwotaGrosze: 100.5, autor: 'Test' }),
    /liczbą całkowitą/
  );
  assert.throws(
    () => oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'informacja', kwotaGrosze: -500, autor: 'Test' }),
    /dodatnia/
  );
  assert.throws(
    () => oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'wpis', kwotaGrosze: 100000000, autor: 'Test' }),
    /stawki maksymalnej/
  );
  assert.throws(
    () => oplaty.dodajOplateReczna(db, { spolkaId: spolka, typ: 'wpis', kwotaGrosze: 'abc', autor: 'Test' }),
    /liczbą całkowitą/
  );
});

test('obliczBrutto: 23% VAT, zaokraglenie matematyczne do pelnego grosza', () => {
  assert.equal(przepisy.obliczBrutto(10000), 12300);
  assert.equal(przepisy.obliczBrutto(5000), 6150);
  // 33 * 1.23 = 40.59 -> zaokraglenie matematyczne w dol do 41 (40.59 -> 41).
  assert.equal(przepisy.obliczBrutto(33), 41);
  assert.equal(przepisy.obliczBrutto(10000, 8), 10800);
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
