'use strict';

/** R4 zad. 5 (K4): tabela „Emisje i serie akcji” mieści się w marginesach druku A4. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { szerokosciKolumnEmisji } = require('../server/logika/informacja-dokument');
const { informacjaZTrzemaSeriami } = require('./e2e/pomocnicze/informacja-dluga');

test('szerokosciKolumnEmisji: suma ≤ dostępna szerokość (także gdy minima się nie mieszczą)', () => {
  const kolumny = [{ min: 15, waga: 1 }, { min: 40, waga: 3 }, { min: 20, waga: 1 }, { min: 20, waga: 1 }, { min: 25, waga: 1 }];
  for (const dostepna of [178, 100, 60]) {
    const w = szerokosciKolumnEmisji(kolumny, dostepna);
    assert.equal(w.length, kolumny.length);
    assert.ok(w.reduce((a, b) => a + b, 0) <= dostepna + 1e-9, `${dostepna}: ${w}`);
    assert.ok(w.every((x) => x > 0));
  }
  const pelne = szerokosciKolumnEmisji(kolumny, 178);
  assert.ok(Math.abs(pelne.reduce((a, b) => a + b, 0) - 178) < 1e-9, 'wolne miejsce rozdzielone wg wag');
  assert.ok(pelne[1] > pelne[0], 'kolumna o większej wadze szersza');
});

test('emisje: 3 serie z długim zakresem — układ pionowy (blok na serię), numery łamią się po przecinkach i myślnikach', () => {
  const html = informacjaZTrzemaSeriami();
  const sekcja = html.slice(html.indexOf('Emisje i serie akcji'), html.indexOf('Akcjonariusze'));
  assert.ok(!/<table/.test(sekcja), 'więcej niż 5 kolumn → bez tabeli');
  assert.equal((sekcja.match(/class="seria-blok"/g) || []).length, 3);
  assert.match(sekcja, /000001–<wbr>999999,<wbr> 1000001–<wbr>1000005/);
  assert.match(html, /\.seria-blok[^{]*\{[^}]*font-size:\s*(8\.5|9)pt/);
});
