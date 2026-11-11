'use strict';

/** Silnik wzorów pism (U-04): Markdown z polami → bloki → PDF. */

const test = require('node:test');
const assert = require('node:assert/strict');
const wzory = require('../server/logika/wzory');

const tekst = (szablon, dane) => wzory.tekst(wzory.wypelnij(szablon, dane).bloki);

test('pola, listy i warunki — lista widzi pola zewnętrzne, warunek z zaprzeczeniem', () => {
  const szablon = [
    'Spółka {{firma}}.',
    '',
    '{{#lista osoby}}',
    '- {{nazwa}} ({{firma}})',
    '{{/lista}}',
    '',
    '{{#jesli zgoda}}Jest zgoda.{{/jesli}}{{#jesli !zgoda}}Brak zgody.{{/jesli}}',
  ].join('\n');
  const t = tekst(szablon, { firma: 'Alfa P.S.A.', osoby: [{ nazwa: 'Anna' }, { nazwa: 'Bartosz' }], zgoda: false });
  assert.equal(t, 'Spółka Alfa P.S.A..\n– Anna (Alfa P.S.A.)\n– Bartosz (Alfa P.S.A.)\nBrak zgody.');
});

test('brakujące pole zostaje jako {{pole}} i trafia na listę brakujących', () => {
  const w = wzory.wypelnij('Adres: {{adres}}, e-mail: {{email}}.', { adres: 'ul. Krótka 1' });
  assert.deepEqual(w.brakujace, ['email']);
  assert.equal(wzory.tekst(w.bloki), 'Adres: ul. Krótka 1, e-mail: {{email}}.');
});

test('wartość z Markdownem nie zmienia struktury pisma (tabela, pogrubienie, nagłówek)', () => {
  const szablon = '| Osoba | Liczba |\n|---|---:|\n{{#lista w}}| {{o}} | {{l}} |\n{{/lista}}';
  const { bloki } = wzory.wypelnij(szablon, { w: [{ o: '# **X** | Y', l: 5 }] });
  assert.equal(bloki.length, 1);
  assert.equal(bloki[0].typ, 'tabela');
  assert.equal(bloki[0].wiersze.length, 1);
  assert.deepEqual(bloki[0].wiersze[0].map((k) => k.map((r) => r.tekst).join('')), ['# **X** | Y', '5']);
});

test('parser: nagłówki, akapit z łamaniem wiersza, listy, tabela z wyrównaniem, podział strony, podpisy', () => {
  const szablon = [
    '# Tytuł',
    '## § 1',
    'Pierwsza linia \\',
    'druga **gruba** i *kursywa*.',
    '',
    '1) jeden',
    '   - pod',
    'a) dwa',
    '',
    '| A | B |',
    '|:--|--:|',
    '| x | 1 |',
    '',
    '---',
    '[podpis: Za Spółkę | Za Notariusza]',
  ].join('\n');
  const { bloki } = wzory.wypelnij(szablon, {});
  assert.deepEqual(
    bloki.map((b) => b.typ),
    ['naglowek', 'naglowek', 'akapit', 'lista', 'tabela', 'strona', 'podpis']
  );
  assert.deepEqual([bloki[0].poziom, bloki[1].poziom], [1, 2]);
  assert.deepEqual(bloki[2].runs, [
    { tekst: 'Pierwsza linia\ndruga ', gruby: false, kursywa: false },
    { tekst: 'gruba', gruby: true, kursywa: false },
    { tekst: ' i ', gruby: false, kursywa: false },
    { tekst: 'kursywa', gruby: false, kursywa: true },
    { tekst: '.', gruby: false, kursywa: false },
  ]);
  assert.deepEqual(
    bloki[3].elementy.map((e) => [e.znacznik, e.poziom]),
    [['1)', 0], ['–', 1], ['a)', 0]]
  );
  assert.deepEqual(bloki[4].wyrownanie, ['lewo', 'prawo']);
  assert.deepEqual(bloki[6].podpisy, ['Za Spółkę', 'Za Notariusza']);
});

test('PDF: A4, długa tabela na kilku stronach z powtórzonym nagłówkiem, stopka z numerem i stroną', async () => {
  const wiersze = Array.from({ length: 80 }, (_, i) => ({ lp: i + 1, nazwa: `Akcjonariusz ${i + 1}` }));
  const szablon = '# Lista\n\n| Lp. | Nazwa |\n|--:|---|\n{{#lista wiersze}}| {{lp}} | {{nazwa}} |\n{{/lista}}';
  const { bloki } = wzory.wypelnij(szablon, { wiersze });
  const wynik = await wzory.pdf(bloki, { numer: 'PSA/2026/0001', naglowek: { lewy: ['Kancelaria'], prawy: 'Gdańsk, dnia 08.11.2026 r.' } });
  assert.equal(wynik.bufor.subarray(0, 5).toString(), '%PDF-');
  assert.ok(wynik.strony >= 2, `stron: ${wynik.strony}`);
  for (let s = 1; s <= wynik.strony; s += 1) {
    const naStronie = wynik.teksty.filter((t) => t.strona === s).map((t) => t.tekst);
    assert.ok(naStronie.includes('Nazwa'), `brak nagłówka tabeli na stronie ${s}`);
    assert.ok(naStronie.includes(`PSA/2026/0001 · strona ${s} z ${wynik.strony}`), `brak stopki na stronie ${s}`);
  }
  // Wiersz nie dzieli się między strony: liczba porządkowa i nazwa zawsze na tej samej stronie.
  for (const w of wiersze) {
    const lp = wynik.teksty.find((t) => t.tekst === String(w.lp) && t.kolumna === 0);
    const nazwa = wynik.teksty.find((t) => t.tekst === w.nazwa);
    assert.equal(lp.strona, nazwa.strona);
  }
  assert.ok(wynik.teksty.some((t) => t.strona === 1 && t.tekst === 'Gdańsk, dnia 08.11.2026 r.'));
});

test('PDF: podział strony zaczyna nową stronę', async () => {
  const { bloki } = wzory.wypelnij('Strona pierwsza.\n\n---\n\nStrona druga.', {});
  const wynik = await wzory.pdf(bloki, { numer: 'X' });
  assert.equal(wynik.strony, 2);
  assert.equal(wynik.teksty.find((t) => t.tekst.startsWith('Strona druga')).strona, 2);
});
