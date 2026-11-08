'use strict';

/** 8 wzorów pism (§ 4): każdy wypełniony danymi próbnymi daje PDF bez pustych pól. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wzory = require('../server/logika/wzory');
const pisma = require('../server/logika/pisma');

const DANE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'wzory', 'dane-probne.json'), 'utf8'));
const PROBNE = Object.fromEntries(Object.keys(DANE).filter((k) => k !== 'wspolne').map((k) => [k, { ...DANE.wspolne, ...DANE[k] }]));

test('§ 4: dokładnie 8 typów pism, każdy ma swój wzór i dane próbne', () => {
  assert.equal(Object.keys(pisma.TYPY).length, 8);
  const pliki = fs.readdirSync(path.join(__dirname, '..', 'wzory')).filter((p) => p.endsWith('.md') && p !== 'README.md');
  assert.deepEqual(pliki.map((p) => p.slice(0, -3)).sort(), Object.keys(pisma.TYPY).map(pisma.nazwaWzoru).sort());
  for (const typ of Object.keys(pisma.TYPY)) assert.ok(PROBNE[pisma.nazwaWzoru(typ)], `brak danych próbnych: ${typ}`);
});

for (const typ of Object.keys(pisma.TYPY)) {
  test(`wzór „${pisma.nazwaWzoru(typ)}” — PDF bez pustych pól`, async () => {
    const nazwa = pisma.nazwaWzoru(typ);
    const { bloki, brakujace } = wzory.wypelnij(wzory.wczytaj(nazwa), PROBNE[nazwa]);
    assert.deepEqual(brakujace, []);
    assert.ok(!wzory.tekst(bloki).includes('{{'));
    const { bufor, strony } = await wzory.pdf(bloki, { numer: 'PSA/2026/0001' });
    assert.equal(bufor.subarray(0, 5).toString(), '%PDF-');
    assert.ok(strony >= 1);
  });
}

test('warianty: przejęcie i płatność miesięczna w umowie, odmowa zawarcia umowy, egzemplarz spółki z listą akcjonariuszy', () => {
  const umowa = (z) => wzory.tekst(wzory.wypelnij(wzory.wczytaj('umowa'), { ...PROBNE.umowa, ...z }).bloki);
  assert.ok(umowa({ przejecie: true, dotychczasowy_podmiot: 'Rejestr Sp. z o.o.', data_przejecia: '01.12.2026' }).includes('od dnia 01.12.2026'));
  assert.ok(!umowa({ przejecie: false }).includes('dzień przejęcia'));
  assert.ok(umowa({ platnosc_miesieczna: true }).includes('w ratach miesięcznych'));
  const odmowa = wzory.tekst(wzory.wypelnij(wzory.wczytaj('powiadomienie-odmowa'), { ...PROBNE['powiadomienie-odmowa'], odmowa_umowy: true }).bloki);
  assert.ok(odmowa.includes('odmawiam zawarcia umowy'));
  const wpis = (z) => wzory.tekst(wzory.wypelnij(wzory.wczytaj('powiadomienie-wpis'), { ...PROBNE['powiadomienie-wpis'], ...z }).bloki);
  assert.ok(wpis({ adresat_spolka: true }).includes('Lista akcjonariuszy'));
  assert.ok(!wpis({ adresat_spolka: false }).includes('Lista akcjonariuszy'));
});
