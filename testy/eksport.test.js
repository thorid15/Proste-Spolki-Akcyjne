'use strict';

/** Eksport ZIP rejestru spółki (art. 90a PrNot; § 3.6 — bez zmian w zakresie). */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-eksport-'));

const { bazaTestowa, dodajSpolke, dodajOsobe, otworz, PDF_TESTOWY } = require('./pomoc');
const eksport = require('../server/eksport');
const informacje = require('../server/informacje');
const zip = require('../server/logika/zip');
const czas = require('../server/pomocnicze/czas');

test('eksport: README, informacja PDF, historia wpisów z łańcuchem, pliki spółki i pisma', async () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  otworz(db, s, { serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }] });
  fs.writeFileSync(path.join(process.env.KATALOG_DOKUMENTOW, 'plik-1.pdf'), PDF_TESTOWY);
  db.prepare("INSERT INTO psa_pliki (spolka_id, nazwa, sciezka, typ, sha256, wgral, wgrano) VALUES (?, 'umowa spółki.pdf', 'plik-1.pdf', 'application/pdf', 'x', 'Test', ?)").run(s, czas.terazIso());
  const { numer } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, oplata: 'nie', kto: 'Test' });

  const wpisy = zip.rozpakujWszystko(await eksport.zbudujEksport(db, s));
  const nazwy = [...wpisy.keys()];
  for (const n of ['README.txt', 'informacja-z-rejestru.pdf', 'historia-wpisow.json', 'historia-wpisow.csv', 'dokumenty/pliki/1-umowa spółki.pdf', `dokumenty/pisma/${numer.replace(/\//g, '-')}.pdf`]) {
    assert.ok(nazwy.includes(n), `brak ${n} w: ${nazwy.join(', ')}`);
  }
  const plik = (n) => wpisy.get(n);
  assert.equal(plik('informacja-z-rejestru.pdf').subarray(0, 5).toString(), '%PDF-');
  const csv = plik('historia-wpisow.csv').toString();
  assert.ok(csv.includes('hash_poprzedni;hash') && csv.includes('otwarcie'));
  assert.ok(plik('README.txt').toString().includes('art. 90a'));
});
