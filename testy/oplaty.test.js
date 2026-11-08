'use strict';

/** Opłaty (§ 3.3, § 5): do zapłaty → opłacona / anulowana; numer faktury to pole; eksport CSV. */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz } = require('./pomoc');
const oplaty = require('../server/oplaty');
const czas = require('../server/pomocnicze/czas');

function zOplatami() {
  const db = bazaTestowa();
  const s = dodajSpolke(db, { nazwa: 'Alfa; prosta spółka akcyjna' });
  const a = dodajOsobe(db, { nazwa: 'Anna A' });
  const b = dodajOsobe(db, { nazwa: 'Bartosz B' });
  otworz(db, s, { serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }] });
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: b, akcje: [{ seria: 'A', numery: '1', liczba: 1 }] }] }], { zadajacy: 'osoba', zadajacy_osoba_id: b, oplata: 'tak' });
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: b, akcje: [{ seria: 'A', numery: '2', liczba: 1 }] }] }], { oplata: 'tak' });
  const [wpisOsoby, wpisSpolki] = oplaty.lista(db, { filtr: 'wszystkie' }).sort((x, y) => x.id - y.id);
  return { db, s, a, b, wpisOsoby, wpisSpolki };
}

test('lista: płatnik, rodzaj, kwoty netto i brutto; filtry do zapłaty / opłacone / wszystkie', () => {
  const { db, wpisOsoby, wpisSpolki } = zOplatami();
  assert.deepEqual(
    [wpisOsoby.rodzaj, wpisOsoby.platnik_nazwa, wpisOsoby.kwota_netto_grosze, wpisOsoby.kwota_brutto_grosze, wpisOsoby.stan],
    ['Wpis', 'Bartosz B', 10000, 12300, 'do_zaplaty']
  );
  assert.equal(wpisSpolki.platnik_nazwa, 'Alfa; prosta spółka akcyjna');
  oplaty.oplacona(db, wpisSpolki.id);
  assert.deepEqual(oplaty.lista(db, { filtr: 'do_zaplaty' }).map((o) => o.id), [wpisOsoby.id]);
  assert.deepEqual(oplaty.lista(db, { filtr: 'oplacone' }).map((o) => [o.id, o.oplacono]), [[wpisSpolki.id, czas.dzisIso()]]);
  assert.equal(oplaty.lista(db, { filtr: 'wszystkie' }).length, 2);
});

test('przejścia: opłaconej ani anulowanej nie zmienia się; anulowanie wymaga powodu', () => {
  const { db, wpisOsoby, wpisSpolki } = zOplatami();
  assert.throws(() => oplaty.anuluj(db, wpisOsoby.id, ' '), (e) => e.name === 'BladWalidacji' && e.bledy.some((b) => b.pole === 'powod'));
  assert.equal(oplaty.anuluj(db, wpisOsoby.id, 'Opłata naliczona omyłkowo').stan, 'anulowana');
  assert.throws(() => oplaty.oplacona(db, wpisOsoby.id), /„anulowana”/);
  oplaty.oplacona(db, wpisSpolki.id);
  assert.throws(() => oplaty.anuluj(db, wpisSpolki.id, 'Za późno'), /„oplacona”/);
});

test('numer faktury to pole — nie zmienia stanu', () => {
  const { db, wpisOsoby } = zOplatami();
  const o = oplaty.ustawFakture(db, wpisOsoby.id, 'FV 12/11/2026');
  assert.deepEqual([o.numer_faktury, o.stan], ['FV 12/11/2026', 'do_zaplaty']);
});

test('CSV: nagłówek, średnik jako separator, kwoty z przecinkiem, pola ze średnikiem w cudzysłowie', () => {
  const { db } = zOplatami();
  const linie = oplaty.csv(oplaty.lista(db, { filtr: 'wszystkie' })).trim().split('\r\n');
  assert.equal(linie[0], 'Data;Spółka;Płatnik;Rodzaj;Okres;Netto;Brutto;Stan;Numer faktury;Opłacono');
  assert.equal(linie.length, 3);
  assert.ok(linie[1].includes(';"Alfa; prosta spółka akcyjna";') && linie[1].includes(';100,00;123,00;do zapłaty;'), linie[1]);
});

test('CSV: komórka zaczynająca się od =, +, -, @ nie staje się formułą w Excelu', () => {
  const linia = oplaty.csv([{ utworzono: '2026-11-08', spolka_nazwa: '=HYPERLINK("http://x")', platnik_nazwa: '+48 1', rodzaj: 'Wpis', okres: null, kwota_netto_grosze: 100, kwota_brutto_grosze: 123, stan: 'do_zaplaty', numer_faktury: '@x', oplacono: null }]).split('\r\n')[1];
  assert.ok(linia.includes(`;"'=HYPERLINK(""http://x"")";'+48 1;`), linia);
  assert.ok(linia.includes(";'@x;"), linia);
});
