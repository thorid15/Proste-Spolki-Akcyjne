'use strict';

/** Pulpit (§ 5): „Do zrobienia” — sprawy z terminem do 2 dni albo po terminie, pisma do wysłania i błędy. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-pulpit-'));

const { bazaTestowa, dodajSpolke, dodajOsobe, otworz } = require('./pomoc');
const pulpit = require('../server/pulpit');
const sprawy = require('../server/sprawy');
const pisma = require('../server/logika/pisma');
const czas = require('../server/pomocnicze/czas');
const terminy = require('../server/logika/terminy');

test('Do zrobienia: pilne sprawy przed pismami, sprawa z dalekim terminem pominięta, błąd wysyłki na górze', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  otworz(db, s, { serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }] });
  const stara = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', data_wplywu: terminy.dodajDni(czas.dzisIso(), -6), operacje: [] }, 'Test').id;
  const nowa = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', operacje: [] }, 'Test').id;

  let lista = pulpit.doZrobienia(db);
  const sciezki = lista.map((p) => p.sciezka);
  assert.ok(sciezki.includes(`/sprawy/${stara}`), 'sprawa z terminem jutro');
  assert.ok(!sciezki.includes(`/sprawy/${nowa}`), 'sprawa z terminem za 7 dni — jeszcze nie');
  assert.equal(lista[0].sciezka, `/sprawy/${stara}`);
  const pismo = lista.find((p) => p.rodzaj === 'pismo');
  assert.ok(pismo && /do wysłania/.test(pismo.opis), 'powiadomienie o otwarciu do wysłania');

  pisma.zmienStan(db, Number(pismo.sciezka.split('=')[1]), 'blad', { odpowiedzSerwera: '550' });
  lista = pulpit.doZrobienia(db);
  assert.equal(lista[0].rodzaj, 'pismo');
  assert.match(lista[0].opis, /błąd wysyłki/);
});
