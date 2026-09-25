'use strict';

/**
 * Czyste funkcje formatowania i walidacji pól (`publiczne/js/formaty.js`) —
 * FAZA 1 sesji frontendowej, pkt 2–3 i sekcja „Testy".
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../publiczne/js/formaty.js');

const NBSP = ' ';

test('parsujKwote: zwykłe zapisy kwot', () => {
  assert.deepEqual(f.parsujKwote('1'), { grosze: 100 });
  assert.deepEqual(f.parsujKwote('10,5'), { grosze: 1050 });
  assert.deepEqual(f.parsujKwote('10.50'), { grosze: 1050 });
  assert.deepEqual(f.parsujKwote('1 000,00'), { grosze: 100000 });
  assert.deepEqual(f.parsujKwote(`1${NBSP}000,00${NBSP}zł`), { grosze: 100000 });
  assert.deepEqual(f.parsujKwote('1.000,50'), { grosze: 100050 });
  assert.deepEqual(f.parsujKwote('1,000.50'), { grosze: 100050 });
  assert.deepEqual(f.parsujKwote('1.000.000'), { grosze: 100000000 });
  assert.deepEqual(f.parsujKwote(',5'), { grosze: 50 });
  assert.deepEqual(f.parsujKwote('0,01'), { grosze: 1 });
});

test('parsujKwote: puste pole to brak wartości, nie zero', () => {
  assert.deepEqual(f.parsujKwote(''), { grosze: null });
  assert.deepEqual(f.parsujKwote('   '), { grosze: null });
  assert.deepEqual(f.parsujKwote(null), { grosze: null });
});

test('parsujKwote: „0,001" odrzucone z komunikatem — bez cichego zaokrąglania (D-045)', () => {
  const w = f.parsujKwote('0,001');
  assert.equal(w.grosze, undefined);
  assert.match(w.blad, /najwyżej 2 cyfry po przecinku/);
  assert.match(f.parsujKwote('10,555').blad, /1 grosza/);
});

test('parsujKwote: tekst, ujemne i błędne grupy tysięcy odrzucone z komunikatem „co zrobić"', () => {
  assert.match(f.parsujKwote('dziesięć').blad, /^Wpisz kwotę/);
  assert.match(f.parsujKwote('-5').blad, /ujemna/);
  assert.match(f.parsujKwote('1.00.0,5').blad, /^Wpisz kwotę/);
});

test('formatujKwote: „10,00 zł", grupy tysięcy niełamliwą spacją', () => {
  assert.equal(f.formatujKwote(1000), `10,00${NBSP}zł`);
  assert.equal(f.formatujKwote(1050), `10,50${NBSP}zł`);
  assert.equal(f.formatujKwote(100000), `1${NBSP}000,00${NBSP}zł`);
  assert.equal(f.formatujKwote(1), `0,01${NBSP}zł`);
  assert.equal(f.formatujKwote(123456789, { waluta: false }), `1${NBSP}234${NBSP}567,89`);
  assert.equal(f.formatujKwote(null), '');
});

test('parsujKwote ∘ formatujKwote: zapis po opuszczeniu pola wczytuje się z powrotem bez zmiany', () => {
  for (const g of [0, 1, 99, 100, 1050, 100000, 123456789]) {
    assert.equal(f.parsujKwote(f.formatujKwote(g)).grosze, g);
  }
});

test('walidujPesel: poprawny numer daje datę urodzenia i płeć', () => {
  const w = f.walidujPesel('44051401359');
  assert.equal(w.blad, undefined);
  assert.equal(w.ostrzezenie, null);
  assert.equal(w.data_urodzenia, '1944-05-14');
  assert.equal(w.plec, 'mezczyzna');
  assert.equal(f.walidujPesel('02270803628').data_urodzenia, '2002-07-08');
});

test('walidujPesel: błędna suma kontrolna — ostrzeżenie przy polu, nie blokada', () => {
  const w = f.walidujPesel('44051401358');
  assert.equal(w.blad, undefined);
  assert.match(w.ostrzezenie, /Suma kontrolna/);
  assert.equal(w.data_urodzenia, '1944-05-14');
});

test('walidujPesel: zła długość, litery, nieistniejąca data — błąd z komunikatem „co zrobić"', () => {
  assert.equal(f.walidujPesel('4405140135').blad, 'Wpisz 11 cyfr numeru PESEL — wpisano 10.');
  assert.match(f.walidujPesel('4405140135a').blad, /samymi cyframi/);
  assert.match(f.walidujPesel('44023101359').blad, /nieistniejącą datę/);
  assert.deepEqual(f.walidujPesel(''), { pusty: true });
});

test('formatujAdres: adres krajowy — bez nazwy kraju', () => {
  const a = { kraj: 'Polska', kod_pocztowy: '80-280', miejscowosc: 'Gdańsk', ulica: 'Bolesława Leśmiana', nr_domu: '3', nr_lokalu: 'U10' };
  assert.equal(f.formatujAdres(a), 'Bolesława Leśmiana 3/U10, 80-280 Gdańsk');
  assert.equal(f.formatujAdres(a, { wieloliniowy: true }), 'Bolesława Leśmiana 3/U10\n80-280 Gdańsk');
});

test('formatujAdres: adres zagraniczny — kraj na końcu, kod bez maski', () => {
  const a = { kraj: 'Niemcy', kod_pocztowy: '10115', miejscowosc: 'Berlin', ulica: 'Invalidenstraße', nr_domu: '117' };
  assert.equal(f.formatujAdres(a), 'Invalidenstraße 117, 10115 Berlin, Niemcy');
  assert.equal(f.maskujKodPocztowy('10115', 'Niemcy'), '10115');
  assert.equal(f.walidujKodPocztowy('10115', 'Niemcy'), null);
});

test('formatujAdres: miejscowość bez ulic i kolumny z przedrostkiem', () => {
  assert.equal(
    f.formatujAdres({ kod_pocztowy: '83-050', miejscowosc: 'Kolbudy', nr_domu: '12' }),
    'Kolbudy 12, 83-050 Kolbudy'
  );
  assert.equal(
    f.formatujAdres({ reprezentant_miejscowosc: 'Sopot', reprezentant_ulica: 'Monte Cassino', reprezentant_nr_domu: '1' }, { prefiks: 'reprezentant_' }),
    'Monte Cassino 1, Sopot'
  );
  assert.equal(f.formatujAdres({}), '');
});

test('kod pocztowy w Polsce: maska 00-000 i komunikat przy złym formacie', () => {
  assert.equal(f.maskujKodPocztowy('80280', 'Polska'), '80-280');
  assert.equal(f.maskujKodPocztowy('80-2', ''), '80-2');
  assert.equal(f.walidujKodPocztowy('80-280', 'Polska'), null);
  assert.equal(f.walidujKodPocztowy('8028', 'Polska'), 'Wpisz kod pocztowy w formacie 00-000.');
});

test('parsujDate: format polski i wklejony ISO', () => {
  assert.equal(f.parsujDate('12.03.2026'), '2026-03-12');
  assert.equal(f.parsujDate('2026-03-12'), '2026-03-12');
  assert.equal(f.parsujDate('12032026'), '2026-03-12');
  assert.equal(f.parsujDate('31.02.2026'), null);
});
