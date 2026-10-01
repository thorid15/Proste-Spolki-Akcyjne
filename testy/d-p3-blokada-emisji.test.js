'use strict';

/** D-P3 — po objęciu akcji seria, numeracja i liczba akcji emisji nie są prostowane. */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

const EMISJA = { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-05', opis: 'Pierwotny opis' };

function spolkaZEmisja({ objeta }) {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', EMISJA);
  if (objeta) {
    wpis(db, spolka, 'objecie', '2026-01-11', {
      emisja_zdarzenie_id: emisja.zdarzenie.id,
      pozycje: [{ osoba_id: dodajOsobe(db), ilosc: 1 }],
    });
  }
  return { db, emisjaId: emisja.zdarzenie.id };
}

function sprostuj(db, emisjaId, dane) {
  return rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: emisjaId,
    uzasadnienie: 'Pomyłka',
    zamiast: dane === null ? null : { typ: 'emisja', dane: { ...EMISJA, ...dane } },
    autor: 'Test',
    teraz: '2026-01-12',
  });
}

test('emisja z objętą akcją: zmiana liczby akcji, numeracji, serii albo wycofanie — odmowa z komunikatem', () => {
  for (const zmiana of [{ ilosc: 90 }, { ilosc: 120 }, { nr_pierwszy: 11 }, { seria: 'B' }, null]) {
    const { db, emisjaId } = spolkaZEmisja({ objeta: true });
    assert.throws(
      () => sprostuj(db, emisjaId, zmiana),
      (e) => e.bledy.some((b) => /zostały już objęte.*umorzenia.*nową emisję/.test(b)),
      JSON.stringify(zmiana)
    );
  }
});

test('emisja z objętą akcją: zmiana opisu i tytułu przechodzi', () => {
  const { db, emisjaId } = spolkaZEmisja({ objeta: true });
  const wynik = sprostuj(db, emisjaId, { opis: 'Poprawiony opis', tytul: 'Emisja założycielska' });
  assert.equal(wynik.zdarzenie.typ, 'sprostowanie');
  assert.equal(db.prepare('SELECT opis FROM psa_emisje WHERE zdarzenie_id = ?').get(emisjaId).opis, 'Poprawiony opis');
});

test('emisja bez objęcia: liczbę akcji można sprostować', () => {
  const { db, emisjaId } = spolkaZEmisja({ objeta: false });
  sprostuj(db, emisjaId, { ilosc: 90 });
  assert.equal(db.prepare('SELECT ilosc FROM psa_emisje WHERE zdarzenie_id = ?').get(emisjaId).ilosc, 90);
});
