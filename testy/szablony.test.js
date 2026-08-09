'use strict';

/** Silnik szablonów dokumentów (sesja 6, faza 4). */

const test = require('node:test');
const assert = require('node:assert/strict');

const s = require('../server/logika/szablony');

test('liczebniki: jednostki, nastki, dziesiatki, setki', () => {
  assert.equal(s.liczbaSlownie(0), 'zero');
  assert.equal(s.liczbaSlownie(1), 'jeden');
  assert.equal(s.liczbaSlownie(7), 'siedem');
  assert.equal(s.liczbaSlownie(10), 'dziesięć');
  assert.equal(s.liczbaSlownie(11), 'jedenaście');
  assert.equal(s.liczbaSlownie(15), 'piętnaście');
  assert.equal(s.liczbaSlownie(20), 'dwadzieścia');
  assert.equal(s.liczbaSlownie(21), 'dwadzieścia jeden');
  assert.equal(s.liczbaSlownie(99), 'dziewięćdziesiąt dziewięć');
  assert.equal(s.liczbaSlownie(100), 'sto');
  assert.equal(s.liczbaSlownie(200), 'dwieście');
  assert.equal(s.liczbaSlownie(500), 'pięćset');
  assert.equal(s.liczbaSlownie(999), 'dziewięćset dziewięćdziesiąt dziewięć');
});

test('liczebniki: odmiana tysiecy wedlug reguly polskiej', () => {
  // 1 -> "tysiąc" (bez "jeden")
  assert.equal(s.liczbaSlownie(1000), 'tysiąc');
  // 2-4 -> "tysiące"
  assert.equal(s.liczbaSlownie(2000), 'dwa tysiące');
  assert.equal(s.liczbaSlownie(4000), 'cztery tysiące');
  // 5+ -> "tysięcy"
  assert.equal(s.liczbaSlownie(5000), 'pięć tysięcy');
  // 12-14 to WYJATEK: mimo koncowki 2-4 forma dopelniaczowa
  assert.equal(s.liczbaSlownie(12000), 'dwanaście tysięcy');
  assert.equal(s.liczbaSlownie(13000), 'trzynaście tysięcy');
  assert.equal(s.liczbaSlownie(14000), 'czternaście tysięcy');
  // 22 juz normalnie
  assert.equal(s.liczbaSlownie(22000), 'dwadzieścia dwa tysiące');
  assert.equal(s.liczbaSlownie(25000), 'dwadzieścia pięć tysięcy');
});

test('liczebniki: miliony, liczby zlozone i ujemne', () => {
  assert.equal(s.liczbaSlownie(1000000), 'milion');
  assert.equal(s.liczbaSlownie(2000000), 'dwa miliony');
  assert.equal(s.liczbaSlownie(5000000), 'pięć milionów');
  assert.equal(s.liczbaSlownie(1234), 'tysiąc dwieście trzydzieści cztery');
  assert.equal(s.liczbaSlownie(-5), 'minus pięć');
  // Ulamkowe odrzucamy - w rejestrze slownie zapisujemy liczby calkowite.
  assert.equal(s.liczbaSlownie(1.5), null);
  assert.equal(s.liczbaSlownie('nie liczba'), null);
});

test('data slownie', () => {
  assert.equal(s.dataSlownie('2026-08-09'), '9 sierpnia 2026');
  assert.equal(s.dataSlownie('2026-01-01'), '1 stycznia 2026');
  assert.equal(s.dataSlownie('2026-12-31'), '31 grudnia 2026');
  assert.equal(s.dataSlownie('bzdura'), null);
});

test('podstawienie prostych kluczy z escapowaniem wartosci', () => {
  const w = s.renderuj('<p>Spółka {{nazwa}}, akcji: {{ilosc}}.</p>', {
    nazwa: 'Wiatraki & Spółka',
    ilosc: 100,
  });
  assert.equal(w.html, '<p>Spółka Wiatraki &amp; Spółka, akcji: 100.</p>');
  assert.deepEqual(w.brakujace, []);
});

test('znaczniki w WARTOSCI sa escapowane, a w SZABLONIE zostaja', () => {
  const w = s.renderuj('<b>{{x}}</b>', { x: '<script>alert(1)</script>' });
  assert.match(w.html, /^<b>&lt;script&gt;/, 'szablonowe <b> zostaje, wartość escapowana');
  assert.ok(!w.html.includes('<script>'), 'żaden surowy <script> nie przechodzi');
});

test('klucz nieznany renderuje sie jako myslnik i trafia na liste brakow', () => {
  const w = s.renderuj('Kwota: {{kwota}}', {});
  assert.equal(w.html, 'Kwota: —');
  assert.deepEqual(w.brakujace, ['kwota']);
});

test('pusty ciag traktujemy jak brak - w dokumencie prawnym cisza jest grozna', () => {
  const w = s.renderuj('{{a}}', { a: '' });
  assert.equal(w.html, '—');
  assert.deepEqual(w.brakujace, ['a']);
});

test('sufiks _slownie zapisuje liczbe i date slowami', () => {
  const w = s.renderuj('{{ilosc}} ({{ilosc_slownie}}) akcji, dnia {{data_slownie}}', {
    ilosc: 120,
    data: '2026-08-09',
  });
  assert.equal(w.html, '120 (sto dwadzieścia) akcji, dnia 9 sierpnia 2026');
  assert.deepEqual(w.brakujace, []);
});

test('gotowe pole o nazwie _slownie ma pierwszenstwo przed wyliczeniem', () => {
  const w = s.renderuj('{{kwota_slownie}}', { kwota: 1200, kwota_slownie: 'tysiąc dwieście złotych' });
  assert.equal(w.html, 'tysiąc dwieście złotych');
});

test('_slownie od wartosci nieliczbowej zglasza brak zamiast zmyslac', () => {
  const w = s.renderuj('{{nazwa_slownie}}', { nazwa: 'Kowalski' });
  assert.equal(w.html, '—');
  assert.match(w.brakujace[0], /nie jest liczbą ani datą/);
});

test('blok listy powtarza sie dla kazdej pozycji', () => {
  const w = s.renderuj(
    '<ul>{{#akcjonariusze}}<li>{{oznaczenie}} — {{ilosc}}</li>{{/akcjonariusze}}</ul>',
    { akcjonariusze: [{ oznaczenie: 'Kowalski', ilosc: 60 }, { oznaczenie: 'Nowak', ilosc: 40 }] }
  );
  assert.equal(w.html, '<ul><li>Kowalski — 60</li><li>Nowak — 40</li></ul>');
});

test('wewnatrz bloku widac tez dane nadrzedne', () => {
  const w = s.renderuj('{{#poz}}[{{spolka}}:{{nr}}]{{/poz}}', {
    spolka: 'ACME',
    poz: [{ nr: 1 }, { nr: 2 }],
  });
  assert.equal(w.html, '[ACME:1][ACME:2]');
});

test('lista pusta usuwa blok w calosci, lista nieobecna zglasza brak', () => {
  const pusta = s.renderuj('A{{#x}}B{{/x}}C', { x: [] });
  assert.equal(pusta.html, 'AC');
  assert.deepEqual(pusta.brakujace, []);

  const brak = s.renderuj('A{{#x}}B{{/x}}C', {});
  assert.equal(brak.html, 'AC');
  assert.deepEqual(brak.brakujace, ['x (lista)']);
});

test('bloki zagniezdzone tej samej i roznej nazwy', () => {
  const w = s.renderuj('{{#a}}({{#b}}{{v}}{{/b}}){{/a}}', {
    a: [{ b: [{ v: 1 }, { v: 2 }] }, { b: [{ v: 3 }] }],
  });
  assert.equal(w.html, '(12)(3)');
});

test('niezamkniety blok zglasza blad zamiast po cichu psuc dokument', () => {
  const w = s.renderuj('{{#lista}}wiersz', { lista: [] });
  assert.equal(w.bledy.length, 1);
  assert.match(w.bledy[0], /nie został zamknięty/);
});

test('uzyteKlucze wylicza klucze proste i listy - do podpowiedzi w edytorze', () => {
  const k = s.uzyteKlucze('{{a}} {{#lista}}{{b}}{{/lista}} {{a}}');
  assert.deepEqual(k.proste, ['a', 'b']);
  assert.deepEqual(k.listy, ['lista']);
});
